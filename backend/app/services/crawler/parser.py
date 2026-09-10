import hashlib
import json
import re
from typing import Set, Tuple, Optional, List, Dict, Any
from urllib.parse import urlparse, urljoin
from bs4 import BeautifulSoup
import httpx

def parse_spa_bundles(bundle_urls: List[str], base_url: str) -> Tuple[Set[str], List[Dict[str, Any]], str]:
    """
    Downloads and parses SPA JavaScript bundles (React/Vite/Next/Vue) to extract:
    1. Discovered internal route URLs
    2. Distinct virtual subpages with titles, descriptions, and specific content
    3. Aggregated rich business knowledge text (contacts, services, addresses)
    """
    domain = urlparse(base_url).netloc
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    
    all_js = ""
    try:
        with httpx.Client(timeout=12.0, follow_redirects=True, verify=False, headers=headers) as client_sync:
            for b_url in bundle_urls[:5]:
                try:
                    resp = client_sync.get(b_url)
                    if resp.status_code == 200 and len(resp.text) > 300:
                        all_js += "\n" + resp.text
                except Exception as err:
                    print(f"[Parser] Failed fetching JS bundle {b_url}: {err}")
    except Exception:
        pass

    if not all_js:
        return set(), [], ""

    discovered_routes: Set[str] = set()
    virtual_pages: List[Dict[str, Any]] = []

    # 1. Extract Contact Info (Email, Phone, Address)
    contact_info_lines = []
    contact_cards = re.findall(
        r'\{[^{}]*title\s*:\s*[`\'"](Address|Phone|Email|Location)[`\'"][^{}]*value\s*:\s*[`\'"]([^`\'"]+)[`\'"][^{}]*\}',
        all_js
    )
    for title, val in contact_cards:
        clean_val = val.strip()
        line = f"{title}: {clean_val}"
        if line not in contact_info_lines:
            contact_info_lines.append(line)
            
    contact_section = "\n".join(contact_info_lines) if contact_info_lines else ""

    # 2. Extract Schema.org & JSON-LD structures embedded in JS
    structured_sections = re.findall(
        r'\{\s*(?:"@type"|@type)?\s*:\s*[`\'"]?(\w+)[`\'"]?\s*,\s*(?:"@id"|@id)?[^{}]*url\s*:\s*[`\'"]([^`\'"]+)[`\'"][^{}]*name\s*:\s*[`\'"]([^`\'"]+)[`\'"][^{}]*description\s*:\s*[`\'"]([^`\'"]+)[`\'"]',
        all_js
    )
    if not structured_sections:
        alt_structured = re.findall(
            r'url\s*:\s*[`\'"]([^`\'"]+)[`\'"][^{}]*name\s*:\s*[`\'"]([^`\'"]+)[`\'"][^{}]*description\s*:\s*[`\'"]([^`\'"]+)[`\'"]',
            all_js
        )
        structured_sections = [("WebPage", s[0], s[1], s[2]) for s in alt_structured]

    for item in structured_sections:
        _, page_url, name, desc = item
        clean_url = urljoin(base_url, page_url.split('#')[0])
        parsed = urlparse(clean_url)
        if parsed.netloc == domain:
            discovered_routes.add(clean_url)
            virtual_pages.append({
                "url": clean_url,
                "title": name,
                "description": desc,
                "content_text": f"Page Title: {name}\nDescription: {desc}\n\nKey Details & Offerings:\n- Offering: {name}\n- Summary: {desc}\n\n{contact_section}"
            })

    # 3. Extract Route Cards with title and link
    route_cards = re.findall(
        r'\{[^{}]*(?:title|name)\s*:\s*[`\'"]([^`\'"]+)[`\'"][^{}]*(?:path|link|url|href)\s*:\s*[`\'"]([^`\'"]+)[`\'"][^{}]*\}',
        all_js
    )
    for name, path in route_cards:
        if not path.startswith(("/assets", "mailto:", "tel:", "#", "javascript:", "data:")):
            clean_url = urljoin(base_url, path.split('#')[0])
            parsed = urlparse(clean_url)
            if parsed.netloc == domain and not re.search(r"\.(pdf|png|jpg|jpeg|gif|svg|css|js|ico)$", clean_url, re.I):
                discovered_routes.add(clean_url)
                if not any(p["url"] == clean_url for p in virtual_pages):
                    virtual_pages.append({
                        "url": clean_url,
                        "title": f"{name} | {domain}",
                        "description": f"Details and offerings for {name}.",
                        "content_text": f"Page Title: {name}\nTopic: {name}\nDescription: Offerings and details regarding {name}.\n\n{contact_section}"
                    })

    # 4. Extract human prose strings for homepage context
    meaningful_prose = []
    seen_prose = set()
    for pat in [r'`([^`\\]*(?:\\.[^`\\]*)*)`', r'"([^"\\]*(?:\\.[^"\\]*)*)"', r"'([^'\\]*(?:\\.[^'\\]*)*)'"]:
        for match in re.finditer(pat, all_js):
            s = match.group(1).strip()
            if len(s) < 15 or len(s) > 1000:
                continue
            # Noise filter
            if any(skip in s for skip in [
                '--radix', 'data-[', 'hover:', 'focus:', 'group-', 'rounded-', 'animate-',
                'className', 'onClick', 'return ', 'function', 'webpack', 'node_modules',
                'px', 'calc(', 'transform:', 'display:', 'http://www.w3.org'
            ]):
                continue
            # Must have multiple words
            if re.search(r'[a-zA-Z]{3,}\s+[a-zA-Z]{2,}', s):
                s_clean = re.sub(r'\s+', ' ', s.replace('\\"', '"').replace("\\'", "'").replace('\\n', ' ')).strip()
                if s_clean not in seen_prose and len(s_clean) > 20:
                    seen_prose.add(s_clean)
                    meaningful_prose.append(s_clean)

    prose_block = "\n".join(meaningful_prose[:120])
    combined_spa_text = f"{contact_section}\n\nWebsite Offerings & Overview:\n{prose_block}"

    return discovered_routes, virtual_pages, combined_spa_text


def clean_and_extract_html(html_content: str, base_url: str, client: Optional[httpx.AsyncClient] = None) -> Tuple[str, str, str, Set[str], List[Dict[str, Any]]]:
    """
    Cleans HTML and performs deep extraction:
    - Title & Meta descriptions
    - Schema.org / JSON-LD structured business info
    - Visible HTML text (including headers, footers, addresses, nav menus)
    - SPA / React / Vite JavaScript bundle text, routes & structured virtual pages
    - Discovered internal links
    Returns: (title, description, cleaned_text, discovered_links, virtual_spa_pages)
    """
    soup = BeautifulSoup(html_content, "html.parser")

    # 1. Extract Title
    title = ""
    if soup.title and soup.title.string:
        title = soup.title.string.strip()
    elif soup.find("h1"):
        title = soup.find("h1").get_text(strip=True)
    if not title:
        parsed = urlparse(base_url)
        title = parsed.netloc + parsed.path

    # 2. Extract Meta Description & Keywords
    description = ""
    meta_texts = []
    for meta in soup.find_all("meta"):
        name = (meta.get("name") or meta.get("property") or "").lower()
        content = (meta.get("content") or "").strip()
        if not content:
            continue
        if "description" in name:
            description = content
            meta_texts.append(f"Description: {content}")
        elif "keyword" in name:
            meta_texts.append(f"Keywords: {content}")
        elif any(k in name for k in ["title", "about", "site_name", "og:"]):
            meta_texts.append(f"{name}: {content}")

    # 3. Extract JSON-LD Structured Data (Schema.org)
    structured_texts = []
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            if script.string:
                data = json.loads(script.string)
                structured_texts.append("Structured Business Information:\n" + json.dumps(data, indent=2))
        except Exception:
            pass

    # 4. Extract Links BEFORE stripping elements
    discovered_links = set()
    base_domain = urlparse(base_url).netloc
    
    for a_tag in soup.find_all("a", href=True):
        href = a_tag["href"].strip()
        if href.startswith(("#", "javascript:", "mailto:", "tel:", "data:")):
            continue
        full_url = urljoin(base_url, href)
        parsed_url = urlparse(full_url)
        
        if parsed_url.netloc == base_domain and parsed_url.scheme in ("http", "https"):
            clean_path = parsed_url.path or "/"
            clean_url = f"{parsed_url.scheme}://{parsed_url.netloc}{clean_path}"
            if not re.search(r"\.(pdf|png|jpg|jpeg|gif|svg|css|zip|tar|gz|mp4|mp3|exe|ico)$", clean_url, re.I):
                discovered_links.add(clean_url)

    # 5. Extract SPA JavaScript Bundle URLs
    script_bundles = []
    for s in soup.find_all("script", src=True):
        src = s["src"]
        if any(keyword in src.lower() for keyword in ["assets", "bundle", "main", "app", "index", "chunk", "pages"]):
            script_bundles.append(urljoin(base_url, src))

    # 6. Remove only non-content tags (KEEP header, footer, nav, address for rich contact & service details)
    unwanted_tags = ["script", "style", "noscript", "iframe", "svg", "button", "input", "form", "dialog"]
    for tag in soup.find_all(unwanted_tags):
        tag.decompose()

    ad_selectors = [re.compile(r"(cookie|consent|banner|advertisement|popup)", re.I)]
    for element in soup.find_all(attrs={"class": ad_selectors}):
        element.decompose()
    for element in soup.find_all(attrs={"id": ad_selectors}):
        element.decompose()

    # 7. Extract visible HTML text
    lines = []
    for element in soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "tr", "td", "blockquote", "article", "section", "address", "div"]):
        text = element.get_text(separator=" ", strip=True)
        if text and len(text) > 3 and not any(t in text for t in ["{", "}", "function()", "const "]):
            lines.append(text)

    # Deduplicate consecutive lines
    dedup_lines = []
    for l in lines:
        if not dedup_lines or dedup_lines[-1] != l:
            dedup_lines.append(l)

    body_text = "\n\n".join(dedup_lines)
    if not body_text and soup.body:
        body_text = soup.body.get_text(separator="\n", strip=True)

    # 8. Deep SPA Bundle Text & Virtual Page Extraction
    virtual_spa_pages = []
    spa_combined_text = ""
    if (len(body_text.strip()) < 350 or len(discovered_links) <= 1) and script_bundles:
        spa_routes, virtual_spa_pages, spa_combined_text = parse_spa_bundles(script_bundles, base_url)
        discovered_links.update(spa_routes)

    # 9. Combine all extracted knowledge
    all_sections = []
    if title:
        all_sections.append(f"Page Title: {title}")
    if meta_texts:
        all_sections.append("\n".join(meta_texts))
    if structured_texts:
        all_sections.extend(structured_texts)
    if body_text and len(body_text.strip()) > 50:
        all_sections.append(body_text)
    if spa_combined_text:
        all_sections.append(spa_combined_text)

    cleaned_text = "\n\n".join(all_sections)
    cleaned_text = re.sub(r"\n{3,}", "\n\n", cleaned_text)

    return title, description, cleaned_text, discovered_links, virtual_spa_pages


def compute_content_hash(text: str) -> str:
    """Computes MD5 hash of text for change detection."""
    return hashlib.md5(text.encode("utf-8")).hexdigest()

