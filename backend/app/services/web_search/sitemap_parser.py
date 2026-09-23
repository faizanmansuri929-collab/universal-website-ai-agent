import re
import uuid
import datetime
from urllib.parse import urlparse, urlunparse, parse_qs, urlencode
from typing import List, Dict, Any, Set, Tuple, Optional
import httpx
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session
from app.models.schemas import CollegeWebSearchProjectDB, CollegeWebSourceDB

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 (CollegeWebSearchBot/2.0)",
    "Accept": "text/xml,application/xml,application/xhtml+xml,text/html;q=0.9,*/*;q=0.8"
}

IGNORED_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".bmp", ".tiff",
    ".mp4", ".mp3", ".avi", ".mov", ".mkv", ".webm",
    ".css", ".js", ".json", ".xml", ".rss", ".woff", ".woff2", ".ttf", ".eot",
    ".zip", ".tar", ".gz", ".rar", ".7z", ".exe", ".dmg", ".apk"
}

CATEGORY_PATTERNS = [
    ("Courses", r'/(btech|course|courses|program|programs|degree|curriculum|department|specialization|mtech|bba|mba|bca|mca|b\.tech|engineering|academics)'),
    ("Admissions", r'/(admission|admissions|apply|eligibility|reap|fee|fees|scholarship|scholarships|cutoff|counseling|enroll)'),
    ("Placements", r'/(placement|placements|recruiter|recruiters|career|careers|tpo|internship|internships|salary|package)'),
    ("Hostels", r'/(hostel|hostels|mess|dining|room|accommodation|residence|campus-life/hostel)'),
    ("Faculty", r'/(faculty|professors|teachers|staff|leadership|chancellor|director|dean|management|governing)'),
    ("Infrastructure", r'/(infrastructure|labs|laboratory|workshop|auditorium|library|smart-class|campus-map)'),
    ("Students", r'/(student|students|current-students|study-materials|notes|syllabus|exam|calendar|notices)'),
    ("Events", r'/(event|events|fest|conference|conferences|hackathon|workshop|seminar|gallery|cultural|sports)'),
    ("Policies", r'/(policy|policies|anti-ragging|grievance|terms|disclaimer|rules|code-of-conduct|naac|aicte|rtu|accreditation)'),
    ("Contact", r'/(contact|about-us/contact|reach-us|helpline|location|address)'),
    ("About", r'/(about|about-us|history|philosophy|vision|mission|legacy|advantage|overview)')
]


def extract_base_domain(url: str) -> str:
    """Extracts clean base domain (e.g., 'https://www.poornima.org/sitemap.xml' -> 'poornima.org')."""
    if not url:
        return ""
    try:
        parsed = urlparse(url if "://" in url else f"https://{url}")
        host = (parsed.hostname or "").lower()
        if host.startswith("www."):
            host = host[4:]
        return host
    except Exception:
        return ""


def clean_and_normalize_url(raw_url: str, base_domain: str) -> Optional[Tuple[str, str]]:
    """
    Cleans, normalizes, and filters a URL.
    Returns (cleaned_url, source_type ['HTML' or 'PDF']) or None if invalid/filtered.
    """
    if not raw_url:
        return None

    try:
        raw_url = raw_url.strip()
        parsed = urlparse(raw_url)
        if not parsed.scheme or not parsed.netloc:
            return None

        # Domain restriction: Hostname must match or be a subdomain
        host = (parsed.hostname or "").lower()
        if host.startswith("www."):
            host_no_www = host[4:]
        else:
            host_no_www = host

        base_clean = base_domain.lower().replace("www.", "")
        if not (host_no_www == base_clean or host_no_www.endswith(f".{base_clean}")):
            return None

        # Strip fragment (#section)
        # Strip tracking query params (utm_*, fbclid, gclid)
        query_dict = parse_qs(parsed.query)
        cleaned_query_dict = {
            k: v for k, v in query_dict.items()
            if not k.lower().startswith("utm_") and k.lower() not in ["fbclid", "gclid", "_ga", "_gl"]
        }
        cleaned_query = urlencode(cleaned_query_dict, doseq=True)

        cleaned_url = urlunparse((
            parsed.scheme,
            parsed.netloc,
            parsed.path,
            parsed.params,
            cleaned_query,
            "" # Fragment removed
        ))

        # Check file extension
        path_lower = parsed.path.lower()
        if any(path_lower.endswith(ext) for ext in IGNORED_EXTENSIONS):
            return None

        source_type = "PDF" if path_lower.endswith(".pdf") else "HTML"
        return cleaned_url, source_type

    except Exception:
        return None


def slug_to_title_and_category(url: str) -> Tuple[str, str]:
    """Generates human-friendly page title and category from URL path."""
    parsed = urlparse(url)
    path = parsed.path.strip("/")
    
    if not path:
        return "Home Overview", "Home"

    # Match Category
    category = "General"
    url_lower = url.lower()
    for cat_name, pattern in CATEGORY_PATTERNS:
        if re.search(pattern, url_lower):
            category = cat_name
            break

    # Build title from slug
    segments = [s for s in path.split("/") if s and not s.endswith(".xml")]
    last_seg = segments[-1] if segments else "Page"
    # Remove file extension if any
    last_seg = re.sub(r'\.(html|htm|php|aspx)$', '', last_seg)
    # Replace dashes/underscores with spaces
    title_words = re.split(r'[-_]+', last_seg)
    title = " ".join([w.capitalize() for w in title_words if w])

    if len(segments) > 1 and len(title) < 15:
        parent_seg = segments[-2]
        parent_words = " ".join([w.capitalize() for w in re.split(r'[-_]+', parent_seg) if w])
        title = f"{parent_words} - {title}"

    return title or "Official Page", category


async def parse_sitemap_recursive(
    sitemap_url: str,
    base_domain: str,
    client: httpx.AsyncClient,
    visited_sitemaps: Optional[Set[str]] = None,
    depth: int = 0
) -> List[Dict[str, Any]]:
    """
    Recursively fetches and parses sitemap.xml, supporting sitemap indexes and child XMLs.
    """
    if visited_sitemaps is None:
        visited_sitemaps = set()

    if sitemap_url in visited_sitemaps or depth > 3 or len(visited_sitemaps) > 50:
        return []

    visited_sitemaps.add(sitemap_url)
    discovered_urls: List[Dict[str, Any]] = []

    try:
        resp = await client.get(sitemap_url, headers=HEADERS)
        if resp.status_code != 200:
            return []

        content = resp.text
        # Parse XML
        soup = BeautifulSoup(content, "xml")

        # 1. Check if this is a Sitemap Index (<sitemapindex>)
        sitemaps = soup.find_all("sitemap")
        if sitemaps:
            child_tasks = []
            for sm in sitemaps:
                loc_tag = sm.find("loc")
                if loc_tag and loc_tag.text:
                    child_url = loc_tag.text.strip()
                    child_tasks.append(
                        parse_sitemap_recursive(child_url, base_domain, client, visited_sitemaps, depth + 1)
                    )
            
            import asyncio
            results = await asyncio.gather(*child_tasks)
            for res in results:
                discovered_urls.extend(res)
            return discovered_urls

        # 2. Parse standard URL set (<urlset>)
        urls = soup.find_all("url")
        for u in urls:
            loc_tag = u.find("loc")
            if loc_tag and loc_tag.text:
                raw_u = loc_tag.text.strip()
                normalized = clean_and_normalize_url(raw_u, base_domain)
                if normalized:
                    clean_u, src_type = normalized
                    title, cat = slug_to_title_and_category(clean_u)
                    discovered_urls.append({
                        "url": clean_u,
                        "title": title,
                        "category": cat,
                        "source_type": src_type
                    })

        # 3. Fallback: If no <url> tags found, regex scan for <loc>
        if not urls and not sitemaps:
            loc_matches = re.findall(r'<loc>(.*?)</loc>', content, re.IGNORECASE)
            for raw_u in loc_matches:
                raw_u = raw_u.strip()
                if raw_u.endswith(".xml") and raw_u not in visited_sitemaps:
                    child_res = await parse_sitemap_recursive(raw_u, base_domain, client, visited_sitemaps, depth + 1)
                    discovered_urls.extend(child_res)
                else:
                    normalized = clean_and_normalize_url(raw_u, base_domain)
                    if normalized:
                        clean_u, src_type = normalized
                        title, cat = slug_to_title_and_category(clean_u)
                        discovered_urls.append({
                            "url": clean_u,
                            "title": title,
                            "category": cat,
                            "source_type": src_type
                        })

    except Exception as e:
        print(f"[SitemapParser] Error fetching {sitemap_url}: {e}")

    return discovered_urls


async def discover_college_urls_from_sitemap(
    sitemap_url: str,
    base_domain: Optional[str] = None
) -> Tuple[str, List[Dict[str, Any]]]:
    """
    Entrypoint to discover all approved URLs from a college sitemap.
    Returns (resolved_base_domain, list_of_unique_sources).
    """
    domain = base_domain or extract_base_domain(sitemap_url)
    if not domain:
        raise ValueError("Invalid sitemap URL: Could not extract base domain.")

    async with httpx.AsyncClient(timeout=15.0, verify=False, follow_redirects=True) as client:
        raw_sources = await parse_sitemap_recursive(sitemap_url, domain, client)

    # Deduplicate by URL
    seen_urls: Set[str] = set()
    unique_sources: List[Dict[str, Any]] = []

    for item in raw_sources:
        u = item["url"]
        if u not in seen_urls:
            seen_urls.add(u)
            unique_sources.append(item)

    return domain, unique_sources


async def ingest_college_sitemap_project(
    project_id: str,
    college_name: str,
    sitemap_url: str,
    db: Session,
    max_sources: int = 3
) -> CollegeWebSearchProjectDB:
    """
    Creates/updates a CollegeWebSearchProject and seeds all discovered URLs from the sitemap.
    """
    domain, discovered_sources = await discover_college_urls_from_sitemap(sitemap_url)

    project = db.query(CollegeWebSearchProjectDB).filter(CollegeWebSearchProjectDB.id == project_id).first()
    if not project:
        project = CollegeWebSearchProjectDB(
            id=project_id,
            college_name=college_name,
            sitemap_url=sitemap_url,
            base_domain=domain,
            status="PROCESSING",
            progress_message="Extracting URLs from sitemap...",
            total_urls=0,
            active_urls=0,
            max_sources_per_query=max_sources,
            created_at=datetime.datetime.utcnow()
        )
        db.add(project)
        db.commit()

    # Insert sources
    now = datetime.datetime.utcnow()
    existing_urls = {s.url for s in db.query(CollegeWebSourceDB.url).filter(CollegeWebSourceDB.project_id == project_id).all()}

    new_sources_to_add = []
    for item in discovered_sources:
        if item["url"] not in existing_urls:
            new_sources_to_add.append(
                CollegeWebSourceDB(
                    id=f"src_{uuid.uuid4().hex[:8]}",
                    project_id=project_id,
                    url=item["url"],
                    title=item["title"],
                    category=item["category"],
                    source_type=item["source_type"],
                    is_enabled=1,
                    content_snippet=f"Discovered from sitemap: {item['category']} | {item['title']}",
                    discovered_at=now
                )
            )

    if new_sources_to_add:
        db.bulk_save_objects(new_sources_to_add)
        db.commit()

    total_count = db.query(CollegeWebSourceDB).filter(CollegeWebSourceDB.project_id == project_id).count()
    active_count = db.query(CollegeWebSourceDB).filter(
        CollegeWebSourceDB.project_id == project_id,
        CollegeWebSourceDB.is_enabled == 1
    ).count()

    project.status = "READY"
    project.total_urls = total_count
    project.active_urls = active_count
    project.progress_message = f"Discovered {total_count} approved URLs from sitemap."
    project.updated_at = now
    db.commit()
    db.refresh(project)

    return project


async def rebuild_college_project_sources(
    project_id: str,
    db: Session
) -> Dict[str, Any]:
    """
    Manually rebuilds sources for an existing project by re-fetching the sitemap and syncing diff.
    """
    project = db.query(CollegeWebSearchProjectDB).filter(CollegeWebSearchProjectDB.id == project_id).first()
    if not project:
        raise ValueError("Project not found.")

    domain, discovered_sources = await discover_college_urls_from_sitemap(project.sitemap_url, project.base_domain)
    
    current_sources = db.query(CollegeWebSourceDB).filter(CollegeWebSourceDB.project_id == project_id).all()
    current_url_map = {s.url: s for s in current_sources}
    discovered_url_set = {d["url"] for d in discovered_sources}

    added_count = 0
    now = datetime.datetime.utcnow()

    # Add new URLs
    new_to_add = []
    for item in discovered_sources:
        if item["url"] not in current_url_map:
            new_to_add.append(
                CollegeWebSourceDB(
                    id=f"src_{uuid.uuid4().hex[:8]}",
                    project_id=project_id,
                    url=item["url"],
                    title=item["title"],
                    category=item["category"],
                    source_type=item["source_type"],
                    is_enabled=1,
                    content_snippet=f"Discovered from sitemap: {item['category']}",
                    discovered_at=now
                )
            )
            added_count += 1

    if new_to_add:
        db.bulk_save_objects(new_to_add)

    # Note URLs removed from sitemap
    removed_count = 0
    for url, src_obj in current_url_map.items():
        if url not in discovered_url_set:
            # We don't delete permanently to preserve chat history, but can flag or track
            removed_count += 1

    db.commit()

    total_count = db.query(CollegeWebSourceDB).filter(CollegeWebSourceDB.project_id == project_id).count()
    active_count = db.query(CollegeWebSourceDB).filter(
        CollegeWebSourceDB.project_id == project_id,
        CollegeWebSourceDB.is_enabled == 1
    ).count()

    project.total_urls = total_count
    project.active_urls = active_count
    project.progress_message = f"Rebuilt: {added_count} new URLs added. Total {total_count} approved sources."
    project.updated_at = now
    db.commit()

    return {
        "project_id": project_id,
        "status": "READY",
        "message": f"Successfully synced sitemap. Discovered {added_count} new URLs. Active: {active_count}",
        "total_urls": total_count,
        "added_count": added_count,
        "removed_count": removed_count,
        "active_urls": active_count
    }
