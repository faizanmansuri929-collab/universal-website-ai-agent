import json
import re
from typing import List, Optional, Callable, Awaitable
from urllib.parse import urlparse, urljoin
import httpx
from bs4 import BeautifulSoup

from app.services.product_scraper.base import BaseProductAdapter, ScrapedProductItem, ScrapeResult

GENERIC_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
}

class GenericWebsiteAdapter(BaseProductAdapter):
    name: str = "Generic Website"

    def can_handle(self, url: str) -> bool:
        # Generic adapter handles any valid HTTP(S) URL
        parsed = urlparse(url.strip())
        return parsed.scheme in ["http", "https"] and bool(parsed.netloc)

    async def scrape(
        self,
        url: str,
        max_products: int = 100,
        progress_callback: Optional[Callable[[str, int, int], Awaitable[None]]] = None,
    ) -> ScrapeResult:
        if progress_callback:
            await progress_callback("Validating URL...", 0, 0)

        target_url = url.strip()
        if not target_url.startswith("http"):
            target_url = f"https://{target_url}"

        domain = urlparse(target_url).netloc
        website_label = domain.replace("www.", "").capitalize()

        if progress_callback:
            await progress_callback(f"Connecting to {website_label}...", 0, 0)

        try:
            async with httpx.AsyncClient(
                headers=GENERIC_HEADERS,
                follow_redirects=True,
                timeout=20.0,
                verify=False
            ) as client:
                resp = await client.get(target_url)
                if resp.status_code != 200:
                    return ScrapeResult(
                        products=[],
                        website=website_label,
                        total_found=0,
                        duplicates_removed=0,
                        error_message=f"Failed to load website (HTTP {resp.status_code})."
                    )
                html_text = resp.text
        except Exception as e:
            return ScrapeResult(
                products=[],
                website=website_label,
                total_found=0,
                duplicates_removed=0,
                error_message=f"Network error while connecting to {domain}: {str(e)}"
            )

        if progress_callback:
            await progress_callback("Page loaded. Searching for structured product data...", 0, 0)

        soup = BeautifulSoup(html_text, 'html.parser')
        raw_items: List[ScrapedProductItem] = []

        # ----------------------------------------------------
        # STRATEGY 1: JSON-LD Schema.org Data
        # ----------------------------------------------------
        for script in soup.find_all('script', type='application/ld+json'):
            try:
                content = script.get_text().strip()
                if not content:
                    continue
                data = json.loads(content)

                items_to_process = []
                if isinstance(data, dict):
                    if data.get('@type') == 'ItemList' and 'itemListElement' in data:
                        items_to_process = data['itemListElement']
                    elif data.get('@type') in ['Product', 'IndividualProduct']:
                        items_to_process = [data]
                    elif '@graph' in data:
                        for g_item in data['@graph']:
                            if isinstance(g_item, dict) and g_item.get('@type') == 'Product':
                                items_to_process.append(g_item)
                elif isinstance(data, list):
                    items_to_process = data

                for entry in items_to_process:
                    p = entry.get('item', entry) if isinstance(entry, dict) else entry
                    if not isinstance(p, dict):
                        continue

                    name = (p.get('name') or '').strip()
                    if not name or len(name) < 2:
                        continue

                    offers = p.get('offers')
                    price = None
                    mrp = None
                    avail = "In Stock"

                    if isinstance(offers, dict):
                        p_val = offers.get('price')
                        if p_val is not None:
                            try:
                                price = float(p_val)
                            except (ValueError, TypeError):
                                pass
                        if offers.get('priceSpecification'):
                            spec = offers['priceSpecification']
                            if isinstance(spec, dict) and spec.get('price'):
                                try:
                                    mrp = float(spec['price'])
                                except (ValueError, TypeError):
                                    pass
                        if 'OutOfStock' in str(offers.get('availability', '')):
                            avail = "Out of Stock"
                    elif isinstance(offers, list) and offers:
                        first_offer = offers[0]
                        if isinstance(first_offer, dict) and first_offer.get('price'):
                            try:
                                price = float(first_offer['price'])
                            except (ValueError, TypeError):
                                pass

                    img = p.get('image', '')
                    if isinstance(img, list) and img:
                        img = img[0]
                    elif isinstance(img, dict):
                        img = img.get('url', '')

                    brand_str = ""
                    if isinstance(p.get('brand'), dict):
                        brand_str = p['brand'].get('name', '')
                    elif isinstance(p.get('brand'), str):
                        brand_str = p['brand']

                    prod_link = p.get('url') or target_url
                    if not prod_link.startswith('http'):
                        prod_link = urljoin(target_url, prod_link)

                    discount = ""
                    if mrp and price and mrp > price:
                        pct = round(((mrp - price) / mrp) * 100)
                        discount = f"{pct}% OFF"

                    desc_val = (p.get('description') or '').strip()

                    raw_items.append(ScrapedProductItem(
                        product_name=name,
                        product_url=prod_link,
                        source_url=target_url,
                        selling_price=price,
                        mrp=mrp,
                        discount=discount,
                        pack_size="",
                        availability=avail,
                        image_url=str(img) if img else "",
                        description=desc_val,
                        brand=brand_str,
                        category=p.get('category', ''),
                        raw_data={"source": "json-ld"}
                    ))
            except Exception:
                pass

        # ----------------------------------------------------
        # STRATEGY 2: Next.js __NEXT_DATA__
        # ----------------------------------------------------
        if not raw_items:
            next_script = soup.find('script', id='__NEXT_DATA__')
            if next_script and next_script.string:
                try:
                    next_data = json.loads(next_script.string)
                    def extract_next_prods(d):
                        found = []
                        if isinstance(d, dict):
                            if ('name' in d or 'title' in d) and ('price' in d or 'sellingPrice' in d):
                                name = d.get('name') or d.get('title')
                                p_val = d.get('price') or d.get('sellingPrice') or d.get('finalPrice')
                                try:
                                    price = float(p_val)
                                except (ValueError, TypeError):
                                    price = None
                                if name and isinstance(name, str) and len(name) > 2 and price is not None:
                                    n_desc = (d.get('description') or d.get('shortDescription') or d.get('subtitle') or '').strip()
                                    found.append(ScrapedProductItem(
                                        product_name=name,
                                        product_url=target_url,
                                        source_url=target_url,
                                        selling_price=price,
                                        mrp=None,
                                        discount="",
                                        pack_size="",
                                        availability="In Stock",
                                        description=n_desc,
                                        brand=d.get('brand', ''),
                                        category=d.get('category', ''),
                                        raw_data={"source": "__NEXT_DATA__"}
                                    ))
                            for v in d.values():
                                found.extend(extract_next_prods(v))
                        elif isinstance(d, list):
                            for it in d:
                                found.extend(extract_next_prods(it))
                        return found

                    raw_items = extract_next_prods(next_data)
                except Exception:
                    pass

        # ----------------------------------------------------
        # STRATEGY 3: Heuristic DOM Product Card Extraction
        # ----------------------------------------------------
        if not raw_items:
            if progress_callback:
                await progress_callback("Scanning DOM for product listing cards...", 0, 0)

            card_candidates = soup.find_all(
                lambda tag: tag.name in ['div', 'article', 'li'] and
                any(keyword in ' '.join(tag.get('class', [])).lower() for keyword in ['product', 'item', 'card', 'goods', 'listing'])
            )

            for card in card_candidates:
                # Find title/name
                title_tag = card.find(['h2', 'h3', 'h4', 'h5', 'p', 'a'], class_=re.compile(r'title|name|heading', re.I))
                if not title_tag:
                    title_tag = card.find(['h2', 'h3', 'h4'])
                if not title_tag:
                    continue

                p_name = title_tag.get_text().strip()
                if not p_name or len(p_name) < 3 or len(p_name) > 150:
                    continue

                # Find price (₹ or $ or INR or digits)
                price_match = re.search(r'(?:₹|Rs\.?|INR|\$)\s*([\d,]+(?:\.\d{1,2})?)', card.get_text())
                price = None
                if price_match:
                    try:
                        price = float(price_match.group(1).replace(',', ''))
                    except ValueError:
                        pass

                if price is None:
                    continue

                # Find description if present in card
                desc_tag = card.find(class_=re.compile(r'desc|summary|subtitle', re.I))
                c_desc = desc_tag.get_text().strip() if desc_tag else ""

                # Find image
                img_tag = card.find('img')
                img_url = ""
                if img_tag:
                    img_url = img_tag.get('src') or img_tag.get('data-src') or ""
                    if img_url and not img_url.startswith('http'):
                        img_url = urljoin(target_url, img_url)

                # Find link
                link_tag = card.find('a', href=True)
                p_url = urljoin(target_url, link_tag['href']) if link_tag else target_url

                raw_items.append(ScrapedProductItem(
                    product_name=p_name,
                    product_url=p_url,
                    source_url=target_url,
                    selling_price=price,
                    mrp=None,
                    discount="",
                    pack_size="",
                    availability="In Stock",
                    image_url=img_url,
                    description=c_desc,
                    brand="",
                    category="",
                    raw_data={"source": "dom-heuristic"}
                ))

        if not raw_items:
            return ScrapeResult(
                products=[],
                website=website_label,
                total_found=0,
                duplicates_removed=0,
                error_message=f"No product listings were detected on {domain}. Please check if the page contains a public product catalog or list."
            )

        # Deduplicate
        unique_products: List[ScrapedProductItem] = []
        seen = set()
        duplicates_count = 0

        for it in raw_items:
            key = (it.product_name.strip().lower(), (it.pack_size or "").strip().lower())
            if key in seen:
                duplicates_count += 1
                continue
            seen.add(key)
            unique_products.append(it)

        if max_products and len(unique_products) > max_products:
            unique_products = unique_products[:max_products]

        return ScrapeResult(
            products=unique_products,
            website=website_label,
            total_found=len(raw_items),
            duplicates_removed=duplicates_count,
            error_message=None
        )
