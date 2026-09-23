import asyncio
import os
from dotenv import load_dotenv
load_dotenv("backend/.env")

from app.core.database import SessionLocal, Base, engine
from app.models.schemas import (
    CollegeWebSearchProjectDB, CollegeWebSourceDB, ChatMessage
)
from app.services.web_search.allowlist import seed_poornima_allowlist
from app.services.web_search.sitemap_parser import (
    clean_and_normalize_url, extract_base_domain,
    discover_college_urls_from_sitemap, ingest_college_sitemap_project,
    rebuild_college_project_sources
)
from app.services.web_search.search_engine import select_and_fetch_college_sources
from app.services.web_search.generator import generate_college_web_search_answer

Base.metadata.create_all(bind=engine)

async def test_generic_pipeline():
    print("=== Testing Generic Sitemap College Web Search Pipeline ===")
    db = SessionLocal()

    # 1. Test URL cleaner and domain restriction
    assert extract_base_domain("https://www.abcuniversity.edu/sitemap.xml") == "abcuniversity.edu"
    assert extract_base_domain("https://sub.college.org/sitemap_index.xml") == "sub.college.org"

    # URL cleaning test
    clean_html = clean_and_normalize_url("https://www.abc.edu/courses/btech?utm_source=fb#faq", "abc.edu")
    assert clean_html is not None
    assert clean_html[0] == "https://www.abc.edu/courses/btech"
    assert clean_html[1] == "HTML"

    clean_pdf = clean_and_normalize_url("https://www.abc.edu/uploads/brochure2026.pdf", "abc.edu")
    assert clean_pdf is not None
    assert clean_pdf[1] == "PDF"

    # Table formatting test
    from app.services.web_search.fetcher import clean_html_content
    raw_table_html = """<div><h4>Fee Structure</h4><table><tr><th>Sem</th><th>Tuition Fee</th><th>Total</th></tr><tr><td>Sem I</td><td>₹ 59,905</td><td>₹ 73,093</td></tr></table></div>"""
    cleaned_table_text = clean_html_content(raw_table_html)
    assert "[TABLE START]" in cleaned_table_text
    assert "Sem I | ₹ 59,905 | ₹ 73,093" in cleaned_table_text
    print("[1] Domain restriction, URL normalizer & Table Preserving Parser passed!")

    # 2. Test Seed Default Poornima Project
    p_count = seed_poornima_allowlist(db)
    print(f"[2] Seeded Poornima Project Sources Count: {p_count}")
    assert p_count >= 70

    poornima_proj = db.query(CollegeWebSearchProjectDB).filter(CollegeWebSearchProjectDB.id == "proj_poornima").first()
    assert poornima_proj is not None
    assert poornima_proj.college_name == "Poornima University & Colleges"
    print(f"[2.1] Poornima Showcase Project Loaded: {poornima_proj.college_name} ({poornima_proj.total_urls} URLs)")

    # 3. Test Creating a Generic College Project from Sitemap
    print("\n[3] Testing Ingestion for Generic College Project...")
    test_proj_id = "proj_test_demo_college"
    # Create test project
    demo_proj = await ingest_college_sitemap_project(
        project_id=test_proj_id,
        college_name="Apex Institute of Engineering",
        sitemap_url="https://www.poornima.org/sitemap.xml",
        db=db,
        max_sources=3
    )
    print(f"[3.1] Created Project '{demo_proj.college_name}': Status={demo_proj.status}, Total URLs={demo_proj.total_urls}")
    assert demo_proj.status == "READY"
    assert demo_proj.total_urls > 0

    # 4. Test Dynamic Search Selection for Generic Project
    print("\n[4] Testing Dynamic Search Selection for Generic Project...")
    candidates, selected, intent_info, reason, college = await select_and_fetch_college_sources(
        project_id=test_proj_id,
        user_message="What B.Tech engineering branches are offered?",
        history=[],
        db=db,
        max_sources=3
    )
    print(f"[4.1] College: {college} | Selected: {len(selected)} sources (Max 3)")
    assert 1 <= len(selected) <= 3
    for s in selected:
        print(f"    - [{s['source_type']}] {s['title']} ({s['url']})")

    # 5. Test End-to-End Grounded Generation for Generic Project
    print("\n[5] Testing End-to-End Chat for Generic Project...")
    resp = await generate_college_web_search_answer(
        project_id=test_proj_id,
        user_message="What are the B.Tech branches available?",
        history=[],
        include_debug=True,
        db=db
    )
    print("--- RESPONSE ---")
    print(resp.answer[:350] + "...")
    print(f"Sources Used: {resp.sources_used_count}")
    for src in resp.sources:
        print(f"- {src.title} ({src.url})")

    # 6. Test Manual Rebuild Sources
    print("\n[6] Testing Manual Rebuild Sources...")
    rebuild_res = await rebuild_college_project_sources(test_proj_id, db)
    print(f"[6.1] Rebuild Result: {rebuild_res['message']}")
    assert rebuild_res["status"] == "READY"

    # Cleanup test project
    db.query(CollegeWebSourceDB).filter(CollegeWebSourceDB.project_id == test_proj_id).delete()
    db.query(CollegeWebSearchProjectDB).filter(CollegeWebSearchProjectDB.id == test_proj_id).delete()
    db.commit()

    db.close()
    print("\n>>> ALL GENERIC SITEMAP COLLEGE SEARCH TESTS PASSED! <<<")

if __name__ == "__main__":
    asyncio.run(test_generic_pipeline())
