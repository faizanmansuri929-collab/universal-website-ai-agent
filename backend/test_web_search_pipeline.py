import asyncio
import os
from dotenv import load_dotenv
load_dotenv("backend/.env")

from app.core.database import SessionLocal, Base, engine
from app.models.schemas import WebSearchSourceDB, WebSearchConfigDB
from app.services.web_search.allowlist import seed_poornima_allowlist, is_allowed_domain_url
from app.services.web_search.intent_router import classify_poornima_intent
from app.services.web_search.search_engine import select_and_fetch_poornima_sources
from app.services.web_search.generator import generate_poornima_web_search_answer
from app.models.schemas import ChatMessage

Base.metadata.create_all(bind=engine)

async def test_pipeline():
    print("=== Testing College Live Web Search Pipeline ===")
    db = SessionLocal()
    
    # 1. Test Allowlist Seeding
    count = seed_poornima_allowlist(db)
    print(f"[1] Seeded Poornima Sources Count: {count}")
    assert count >= 70, f"Expected >= 70 sources, got {count}"
    
    # 2. Test Domain Validation
    assert is_allowed_domain_url("https://www.poornima.org/placement"), "Valid domain check failed"
    assert is_allowed_domain_url("https://poornima.org/admission"), "Valid domain check failed"
    assert not is_allowed_domain_url("https://wikipedia.org/wiki/Poornima"), "Wikipedia should be blocked"
    assert not is_allowed_domain_url("https://anothercollege.com/fees"), "Another college should be blocked"
    print("[2] Domain validation passed: Only poornima.org allowed!")

    # 3. Test Intent Classification & Query Optimization
    q1 = "What B.Tech courses are available at Poornima?"
    intent1 = classify_poornima_intent(q1)
    print(f"[3.1] Query: '{q1}' -> Intent: {intent1['intent']}, Search: {intent1['search_query']}")
    assert intent1["intent"] == "courses_btech"

    q2 = "What is the placement information and highest package?"
    intent2 = classify_poornima_intent(q2)
    print(f"[3.2] Query: '{q2}' -> Intent: {intent2['intent']}, Search: {intent2['search_query']}")
    assert intent2["intent"] == "placements_recruiters"

    q3 = "What hostel facilities and dining are available?"
    intent3 = classify_poornima_intent(q3)
    print(f"[3.3] Query: '{q3}' -> Intent: {intent3['intent']}, Search: {intent3['search_query']}")
    assert intent3["intent"] == "hostel_mess"

    q_off = "Who is the president of the United States?"
    intent_off = classify_poornima_intent(q_off)
    print(f"[3.4] Query: '{q_off}' -> Intent: {intent_off['intent']}, is_off_topic: {intent_off['is_off_topic']}")
    assert intent_off["is_off_topic"] is True

    # 4. Test Source Selection (Top 1-3 sources)
    candidates, selected, info, reason = await select_and_fetch_poornima_sources(
        user_message=q1,
        history=[],
        db=db,
        max_sources=3
    )
    print(f"[4] Selected Sources count: {len(selected)} (1 to 3)")
    assert 1 <= len(selected) <= 3
    for idx, s in enumerate(selected):
        print(f"    Source {idx+1}: {s['title']} ({s['url']})")

    # 5. Test Full End-to-End Generation
    print("\n[5] Running Full End-to-End Chat Generation for: 'What B.Tech branches are offered?'")
    resp = await generate_poornima_web_search_answer(
        user_message="What B.Tech branches are offered at Poornima?",
        history=[],
        include_debug=True,
        db=db
    )
    print("\n--- BOT ANSWER ---")
    print(resp.answer[:400] + "...")
    print(f"\n--- SOURCES USED ({resp.sources_used_count} pages) ---")
    for s in resp.sources:
        print(f"- {s.title} -> {s.url}")
    
    if resp.debug_trace:
        print(f"\n--- DEBUG TRACE ---")
        print(f"Detected Intent: {resp.debug_trace.detected_intent}")
        print(f"Search Query: {resp.debug_trace.optimized_search_query}")
        print(f"Selected Count: {len(resp.debug_trace.selected_sources)}")

    # 6. Test Off-Topic Handling
    print("\n[6] Testing Off-Topic Question: 'Tell me about Harvard University'")
    resp_off = await generate_poornima_web_search_answer(
        user_message="Tell me about Harvard University",
        history=[],
        include_debug=True,
        db=db
    )
    print("Off-topic response:", resp_off.answer)
    assert "Poornima" in resp_off.answer

    db.close()
    print("\n>>> ALL COLLEGE WEB SEARCH TESTS PASSED SUCCESSFULLY! <<<")

if __name__ == "__main__":
    asyncio.run(test_pipeline())
