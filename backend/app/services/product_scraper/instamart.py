import json
import re
import urllib.parse
from typing import List, Optional, Callable, Awaitable, Tuple, Dict
from urllib.parse import urlparse
import httpx
from bs4 import BeautifulSoup

from app.services.product_scraper.base import BaseProductAdapter, ScrapedProductItem, ScrapeResult

INSTAMART_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
}

class InstamartAdapter(BaseProductAdapter):
    name: str = "Instamart"

    def can_handle(self, url: str) -> bool:
        parsed = urlparse(url.strip())
        netloc = parsed.netloc.lower()
        return "instamart.in" in netloc or ("swiggy.com" in netloc and "instamart" in parsed.path.lower())

    def _extract_from_state(self, state_obj: dict, base_url: str, json_ld_desc_map: Optional[Dict[str, str]] = None) -> Tuple[List[ScrapedProductItem], List[dict], str, str]:
        """
        Recursively extracts products, tabs, and location info from Instamart's INITIAL_STATE.
        """
        raw_items: List[ScrapedProductItem] = []
        tabs_list: List[dict] = []
        city = ""
        location_context = ""

        # Extract user location context
        user_loc = state_obj.get('userLocation', {})
        if user_loc:
            addr = user_loc.get('address', '')
            location_context = addr
            if addr:
                parts = [p.strip() for p in addr.split(',')]
                if len(parts) >= 3:
                    city = parts[-3]
                elif len(parts) >= 2:
                    city = parts[0]

        # Discover navigation tabs for multi-subcategory scraping
        nav_tabs = state_obj.get('categoryListingV2', {}).get('navigationTabs', {})
        for k, tab_group in nav_tabs.items():
            if isinstance(tab_group, list):
                for tab in tab_group:
                    if isinstance(tab, dict) and tab.get('name'):
                        tabs_list.append(tab)

        def walk_state(obj, current_cat=""):
            found_list = []
            if isinstance(obj, dict):
                cat = current_cat
                if 'category' in obj and isinstance(obj['category'], str):
                    cat = obj['category']
                elif 'name' in obj and isinstance(obj['name'], str) and len(obj['name']) < 60:
                    cat = obj['name']

                # Instamart Product Card structure
                if 'displayName' in obj and ('variations' in obj or 'productId' in obj or 'inStock' in obj):
                    p_name = (obj.get('displayName') or '').strip()
                    p_brand = (obj.get('brand') or '').strip()
                    in_stock = obj.get('inStock', True) and obj.get('isAvail', True)
                    avail_str = "In Stock" if in_stock else "Out of Stock"
                    variations = obj.get('variations', [])

                    if variations and isinstance(variations, list):
                        for v in variations:
                            if not isinstance(v, dict):
                                continue
                            v_name = (v.get('displayName') or p_name).strip()
                            v_brand = (v.get('brandName') or p_brand).strip()
                            v_qty = (v.get('quantityDescription') or '').strip()
                            v_cat = (v.get('category') or cat).strip()
                            v_price_obj = v.get('price') or {}

                            selling_price = None
                            mrp = None
                            discount = ""

                            if isinstance(v_price_obj, dict):
                                if 'offerPrice' in v_price_obj and v_price_obj['offerPrice']:
                                    try:
                                        selling_price = float(v_price_obj['offerPrice'].get('units', 0))
                                    except (ValueError, TypeError):
                                        pass
                                if 'mrp' in v_price_obj and v_price_obj['mrp']:
                                    try:
                                        mrp = float(v_price_obj['mrp'].get('units', 0))
                                    except (ValueError, TypeError):
                                        pass

                                if selling_price is None and mrp is not None:
                                    selling_price = mrp

                                if mrp and selling_price and mrp > selling_price:
                                    disc_pct = round(((mrp - selling_price) / mrp) * 100)
                                    discount = f"{disc_pct}% OFF"
                                elif 'discountValue' in v_price_obj and v_price_obj['discountValue']:
                                    disc_units = v_price_obj['discountValue'].get('units')
                                    if disc_units:
                                        discount = f"₹{disc_units} OFF"

                            img_url = ""
                            img_ids = v.get('imageIds', [])
                            if img_ids and isinstance(img_ids, list):
                                img_url = f"https://instamart-media-assets.swiggy.com/swiggy/image/upload/fl_lossy,f_auto,q_auto/{img_ids[0]}"

                            p_id = v.get('skuId') or v.get('spinId') or obj.get('productId')
                            prod_url = f"https://instamart.in/item/{p_id}" if p_id else base_url

                            # Extract description if easily available (from item attributes, subtitle, or JSON-LD)
                            v_desc = (
                                v.get('description') or
                                obj.get('description') or
                                v.get('subTitle') or
                                obj.get('subTitle') or
                                v.get('shortDescription') or
                                obj.get('shortDescription') or
                                (json_ld_desc_map.get(v_name.strip().lower()) if json_ld_desc_map else "") or
                                ""
                            )
                            if not isinstance(v_desc, str):
                                v_desc = ""
                            v_desc = v_desc.strip()

                            if v_name:
                                found_list.append(ScrapedProductItem(
                                    product_name=v_name,
                                    product_url=prod_url,
                                    source_url=base_url,
                                    selling_price=selling_price,
                                    mrp=mrp,
                                    discount=discount,
                                    pack_size=v_qty,
                                    availability=avail_str,
                                    image_url=img_url,
                                    description=v_desc,
                                    brand=v_brand,
                                    category=v_cat,
                                    city=city,
                                    location_context=location_context,
                                    raw_data={
                                        "skuId": v.get('skuId'),
                                        "spinId": v.get('spinId'),
                                        "parentProductId": obj.get('productId')
                                    }
                                ))
                    elif p_name:
                        p_id = obj.get('productId')
                        prod_url = f"https://instamart.in/item/{p_id}" if p_id else base_url
                        p_desc = (
                            obj.get('description') or
                            obj.get('subTitle') or
                            obj.get('shortDescription') or
                            (json_ld_desc_map.get(p_name.strip().lower()) if json_ld_desc_map else "") or
                            ""
                        )
                        if not isinstance(p_desc, str):
                            p_desc = ""
                        p_desc = p_desc.strip()

                        found_list.append(ScrapedProductItem(
                            product_name=p_name,
                            product_url=prod_url,
                            source_url=base_url,
                            selling_price=None,
                            mrp=None,
                            discount="",
                            pack_size="",
                            availability=avail_str,
                            image_url="",
                            description=p_desc,
                            brand=p_brand,
                            category=cat,
                            city=city,
                            location_context=location_context,
                            raw_data={"productId": p_id}
                        ))

                # Walk down nested keys
                for k, val in obj.items():
                    found_list.extend(walk_state(val, cat))

            elif isinstance(obj, list):
                for item in obj:
                    found_list.extend(walk_state(item, current_cat))

            return found_list

        raw_items = walk_state(state_obj)
        return raw_items, tabs_list, city, location_context

    def _parse_html_page(self, html_text: str, target_url: str) -> Tuple[List[ScrapedProductItem], List[dict], str, str]:
        soup = BeautifulSoup(html_text, 'html.parser')
        raw_items: List[ScrapedProductItem] = []
        tabs_list: List[dict] = []
        city = ""
        location_context = ""

        # Pre-build description map from JSON-LD schema if present
        json_ld_desc_map: Dict[str, str] = {}
        for script in soup.find_all('script', type='application/ld+json'):
            try:
                ld_data = json.loads(script.get_text())
                items_list = []
                if isinstance(ld_data, dict):
                    if 'itemListElement' in ld_data:
                        items_list = ld_data['itemListElement']
                    elif ld_data.get('@type') == 'Product':
                        items_list = [ld_data]
                elif isinstance(ld_data, list):
                    items_list = ld_data

                for item_wrapper in items_list:
                    it = item_wrapper.get('item', item_wrapper) if isinstance(item_wrapper, dict) else item_wrapper
                    if isinstance(it, dict):
                        n = (it.get('name') or '').strip().lower()
                        d = (it.get('description') or '').strip()
                        if n and d and d.lower() != n:
                            json_ld_desc_map[n] = d
            except Exception:
                pass

        # STRATEGY 1: Parse window.___INITIAL_STATE___
        for script in soup.find_all('script'):
            txt = script.get_text()
            if 'window.___INITIAL_STATE___' in txt:
                try:
                    start_idx = txt.find('{')
                    decoder = json.JSONDecoder()
                    state_obj, _ = decoder.raw_decode(txt[start_idx:])
                    raw_items, tabs_list, city, location_context = self._extract_from_state(state_obj, target_url, json_ld_desc_map)
                    if raw_items or tabs_list:
                        break
                except Exception as ex:
                    print(f"[InstamartAdapter] State parse error: {ex}")

        # STRATEGY 2: Fallback to JSON-LD Schema
        if not raw_items:
            for script in soup.find_all('script', type='application/ld+json'):
                try:
                    ld_data = json.loads(script.get_text())
                    items_list = []
                    if isinstance(ld_data, dict):
                        if 'itemListElement' in ld_data:
                            items_list = ld_data['itemListElement']
                        elif ld_data.get('@type') == 'Product':
                            items_list = [ld_data]
                    elif isinstance(ld_data, list):
                        items_list = ld_data

                    for item_wrapper in items_list:
                        item = item_wrapper.get('item', item_wrapper) if isinstance(item_wrapper, dict) else item_wrapper
                        if isinstance(item, dict) and ('name' in item or item.get('@type') == 'Product'):
                            name = (item.get('name') or '').strip()
                            if not name:
                                continue

                            offers = item.get('offers', {})
                            price = None
                            avail = "In Stock"
                            if isinstance(offers, dict):
                                p_val = offers.get('price')
                                if p_val:
                                    try:
                                        price = float(p_val)
                                    except (ValueError, TypeError):
                                        pass
                                if 'OutOfStock' in offers.get('availability', ''):
                                    avail = "Out of Stock"
                            elif isinstance(offers, list) and offers:
                                p_val = offers[0].get('price')
                                if p_val:
                                    try:
                                        price = float(p_val)
                                    except (ValueError, TypeError):
                                        pass

                            img = item.get('image', '')
                            if isinstance(img, list) and img:
                                img = img[0]

                            brand_name = ""
                            if isinstance(item.get('brand'), dict):
                                brand_name = item['brand'].get('name', '')
                            elif isinstance(item.get('brand'), str):
                                brand_name = item.get('brand')

                            raw_items.append(ScrapedProductItem(
                                product_name=name,
                                product_url=item.get('url') or target_url,
                                source_url=target_url,
                                selling_price=price,
                                mrp=None,
                                discount="",
                                pack_size="",
                                availability=avail,
                                image_url=str(img) if img else "",
                                description=(item.get('description') or '').strip(),
                                brand=brand_name,
                                category=item.get('category', ''),
                                city=city,
                                location_context=location_context,
                                raw_data={"source": "json-ld"}
                            ))
                except Exception:
                    pass

        return raw_items, tabs_list, city, location_context

    async def scrape(
        self,
        url: str,
        max_products: int = 100,
        progress_callback: Optional[Callable[[str, int, int], Awaitable[None]]] = None,
    ) -> ScrapeResult:
        if progress_callback:
            await progress_callback("Validating Instamart URL...", 0, 0)

        target_url = url.strip()
        if not target_url.startswith("http"):
            target_url = f"https://{target_url}"

        # Clean query parameters for base URL
        parsed_base = urlparse(target_url)
        clean_base_url = f"{parsed_base.scheme}://{parsed_base.netloc}{parsed_base.path}"

        if progress_callback:
            await progress_callback("Loading initial product catalog page...", 0, 0)

        all_unique_items: List[ScrapedProductItem] = []
        seen_keys = set()
        total_found_count = 0
        duplicates_count = 0
        city = ""
        location_context = ""

        try:
            async with httpx.AsyncClient(
                headers=INSTAMART_HEADERS,
                follow_redirects=True,
                timeout=25.0,
                verify=False
            ) as client:
                # 1. Fetch Initial Page
                resp = await client.get(target_url)
                if resp.status_code != 200:
                    return ScrapeResult(
                        products=[],
                        website=self.name,
                        total_found=0,
                        duplicates_removed=0,
                        error_message=f"Failed to fetch Instamart page (HTTP {resp.status_code})."
                    )

                init_items, tabs_list, city, location_context = self._parse_html_page(resp.text, target_url)
                total_found_count += len(init_items)

                for item in init_items:
                    key = (item.product_name.strip().lower(), (item.pack_size or "").strip().lower())
                    if key in seen_keys:
                        duplicates_count += 1
                        continue
                    seen_keys.add(key)
                    all_unique_items.append(item)

                if progress_callback:
                    await progress_callback(
                        f"Initial batch extracted: {len(all_unique_items)} unique products ({len(tabs_list)} subcategories found)...",
                        total_found_count,
                        len(all_unique_items)
                    )

                # 2. If max_products is greater than initial batch and subcategory tabs exist, iterate through tabs
                if len(all_unique_items) < max_products and tabs_list:
                    for tab in tabs_list:
                        if len(all_unique_items) >= max_products:
                            break

                        tab_name = tab.get('name', '')
                        dlink = tab.get('deepLink', '')

                        # Form subcategory URL
                        if dlink and '?' in dlink:
                            query_str = dlink.split('?', 1)[1]
                            tab_url = f"{clean_base_url}?{query_str}"
                        elif tab_name:
                            tab_url = f"{clean_base_url}?filterName={urllib.parse.quote(tab_name)}"
                        else:
                            continue

                        if progress_callback:
                            await progress_callback(
                                f"Scraping subcategory: '{tab_name}' ({len(all_unique_items)}/{max_products} collected)...",
                                total_found_count,
                                len(all_unique_items)
                            )

                        try:
                            tab_resp = await client.get(tab_url)
                            if tab_resp.status_code == 200:
                                tab_items, _, _, _ = self._parse_html_page(tab_resp.text, tab_url)
                                total_found_count += len(tab_items)
                                for item in tab_items:
                                    key = (item.product_name.strip().lower(), (item.pack_size or "").strip().lower())
                                    if key in seen_keys:
                                        duplicates_count += 1
                                        continue
                                    seen_keys.add(key)
                                    all_unique_items.append(item)
                                    if len(all_unique_items) >= max_products:
                                        break
                        except Exception as e:
                            print(f"[InstamartAdapter] Error fetching tab {tab_name}: {e}")

        except httpx.TimeoutException:
            if not all_unique_items:
                return ScrapeResult(
                    products=[],
                    website=self.name,
                    total_found=0,
                    duplicates_removed=0,
                    error_message="Connection timed out while fetching Instamart page."
                )
        except Exception as e:
            if not all_unique_items:
                return ScrapeResult(
                    products=[],
                    website=self.name,
                    total_found=0,
                    duplicates_removed=0,
                    error_message=f"Network error: {str(e)}"
                )

        if not all_unique_items:
            return ScrapeResult(
                products=[],
                website=self.name,
                total_found=0,
                duplicates_removed=0,
                city=city,
                location_context=location_context,
                error_message="No product listings were detected on this Instamart URL."
            )

        # Enforce max limit
        if max_products and len(all_unique_items) > max_products:
            all_unique_items = all_unique_items[:max_products]

        if progress_callback:
            await progress_callback(
                f"Completed extraction! {len(all_unique_items)} unique products ready.",
                total_found_count,
                len(all_unique_items)
            )

        return ScrapeResult(
            products=all_unique_items,
            website=self.name,
            total_found=total_found_count,
            duplicates_removed=duplicates_count,
            city=city,
            location_context=location_context,
            error_message=None
        )
