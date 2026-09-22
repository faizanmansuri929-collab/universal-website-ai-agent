import re
import datetime
import httpx
from bs4 import BeautifulSoup
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.schemas import WebSearchSourceDB
from app.services.web_search.allowlist import is_allowed_domain_url

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 (PoornimaWebSearchBot/1.0)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
}

def clean_html_content(html: str) -> str:
    """Extracts clean readable text from HTML markup."""
    if not html:
        return ""
    soup = BeautifulSoup(html, "html.parser")
    
    # Remove junk tags
    for tag in soup(["script", "style", "noscript", "svg", "header", "footer", "nav", "iframe"]):
        tag.decompose()
        
    # Get text
    text = soup.get_text(separator="\n")
    
    # Clean whitespace and repeated newlines
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    cleaned_text = "\n".join(lines)
    cleaned_text = re.sub(r'\n{3,}', '\n\n', cleaned_text)
    return cleaned_text[:6000] # Limit to top 6k chars per page for concise LLM context


async def fetch_poornima_page(url: str, db: Session, force_refresh: bool = False) -> Dict[str, Any]:
    """
    Fetches the live content of an approved Poornima page with database caching.
    """
    if not is_allowed_domain_url(url):
        return {"url": url, "title": "Blocked URL", "content": "", "status": "BLOCKED_NON_POORNIMA"}

    source = db.query(WebSearchSourceDB).filter(WebSearchSourceDB.url == url).first()
    now = datetime.datetime.utcnow()

    # Check cache freshness (valid for 6 hours unless force_refresh)
    if source and source.content_full and not force_refresh:
        if source.last_fetched_at and (now - source.last_fetched_at).total_seconds() < 21600:
            return {
                "url": url,
                "title": source.title or url,
                "content": source.content_full,
                "status": "CACHED"
            }

    # Fetch live
    try:
        async with httpx.AsyncClient(timeout=12.0, verify=False, follow_redirects=True) as client:
            resp = await client.get(url, headers=HEADERS)
            if resp.status_code == 200:
                raw_html = resp.text
                clean_text = clean_html_content(raw_html)
                
                # Extract page title if available
                soup = BeautifulSoup(raw_html, "html.parser")
                page_title = soup.title.string.strip() if soup.title and soup.title.string else (source.title if source else "Poornima Official Page")
                page_title = re.sub(r'\s+', ' ', page_title)

                if source:
                    source.content_full = clean_text
                    source.content_snippet = clean_text[:300]
                    if not source.title or source.title.startswith("http"):
                        source.title = page_title
                    source.last_fetched_at = now
                    db.commit()

                return {
                    "url": url,
                    "title": page_title,
                    "content": clean_text,
                    "status": "LIVE_FETCHED"
                }
            else:
                # Return cached or snippet fallback
                fallback_content = source.content_full if source and source.content_full else (source.content_snippet if source else "")
                return {
                    "url": url,
                    "title": source.title if source else url,
                    "content": fallback_content or f"Official Poornima URL: {url}",
                    "status": f"HTTP_{resp.status_code}_FALLBACK"
                }
    except Exception as e:
        # Fallback gracefully
        fallback_content = source.content_full if source and source.content_full else (source.content_snippet if source else "")
        return {
            "url": url,
            "title": source.title if source else url,
            "content": fallback_content or f"Official Poornima URL: {url}",
            "status": f"ERROR_FALLBACK: {str(e)[:50]}"
        }
