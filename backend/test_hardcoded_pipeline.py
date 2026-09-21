import asyncio
import datetime
import uuid
from app.core.database import SessionLocal, Base, engine
from app.models.schemas import HardcodedBotDB, HardcodedFAQDB, ChatVisitorDB, ChatSessionDB
from app.services.hardcoded.templates import get_sector_template
from app.services.hardcoded.generator import generate_hardcoded_faq_dataset
from app.services.hardcoded.matcher import match_query_to_faqs
from app.services.hardcoded.service import handle_hardcoded_visitor_chat

async def test_complete_hardcoded_flow():
    print("\n========== [1] TESTING SECTOR TEMPLATES ==========")
    for sector in ["college", "hospital", "saas", "manufacturing", "general"]:
        tmpl = get_sector_template(sector)
        assert len(tmpl["intents"]) >= 4, f"Sector {sector} must have at least 4 intents"
        print(f"[OK] Sector '{sector}': {len(tmpl['intents'])} intents configured (Focus: {tmpl['primary_focus']})")

    print("\n========== [2] TESTING ONE-TIME DATASET GENERATOR ==========")
    mock_pages = [
        {
            "url": "https://www.poornima.org/admissions",
            "title": "Poornima Admissions 2026",
            "description": "Admissions for B.Tech CSE, AI, Data Science",
            "content_text": "Poornima Group of Colleges offers B.Tech programs in Computer Science, Artificial Intelligence, and Civil Engineering. Eligibility requires 45% marks in 12th with Physics and Mathematics. Annual tuition fee is INR 82,500 with merit scholarships up to 100% for students scoring above 85%. Direct admission is available through REAP code 1023."
        },
        {
            "url": "https://www.poornima.org/placements",
            "title": "Poornima Placements",
            "description": "Placement statistics",
            "content_text": "Poornima placements record highest package of 33 LPA and average package of 5.8 LPA. Top recruiting companies include TCS, Infosys, Capgemini, and Cognizant."
        }
    ]

    dataset = await generate_hardcoded_faq_dataset(
        website_url="https://www.poornima.org/",
        sector="college",
        crawled_pages=mock_pages,
        bot_name="Poornima Admissions Assistant"
    )

    assert "faqs" in dataset and len(dataset["faqs"]) > 0, "Generated dataset must have faqs"
    print(f"[OK] One-time extraction produced {len(dataset['faqs'])} structured FAQs.")
    sample_faq = dataset["faqs"][0]
    print(f"  Sample FAQ Intent: {sample_faq['intent']}")
    print(f"  Sample Questions: {sample_faq['questions'][:2]}")
    print(f"  Sample Answer: {sample_faq['answer'][:80]}...")

    print("\n========== [3] TESTING DATABASE PERSISTENCE & TTL ==========")
    db = SessionLocal()
    bot_id = str(uuid.uuid4())
    now = datetime.datetime.utcnow()
    expires_at = now + datetime.timedelta(days=7)

    bot = HardcodedBotDB(
        id=bot_id,
        name="Poornima Predefined Bot",
        website_url="https://www.poornima.org/",
        sector="college",
        status="READY",
        version=1,
        ttl_days=7,
        welcome_message=dataset.get("welcome_message", "Welcome!"),
        created_at=now,
        expires_at=expires_at,
        last_generated_at=now
    )
    db.add(bot)

    for item in dataset["faqs"]:
        cta_info = item.get("cta") or {}
        faq_db = HardcodedFAQDB(
            id=str(uuid.uuid4()),
            bot_id=bot_id,
            intent=item["intent"],
            category=item["category"],
            questions=item["questions"],
            answer=item["answer"],
            source_urls=item.get("source_urls") or ["https://www.poornima.org/"],
            cta_label=cta_info.get("label", "Apply Now"),
            cta_url=cta_info.get("url", "https://www.poornima.org/apply"),
            priority=item.get("priority", 5),
            answer_available=1
        )
        db.add(faq_db)
    db.commit()

    saved_faqs_count = db.query(HardcodedFAQDB).filter(HardcodedFAQDB.bot_id == bot_id).count()
    assert saved_faqs_count == len(dataset["faqs"]), "All FAQs must be persisted to DB"
    print(f"[OK] Persisted bot {bot_id} and {saved_faqs_count} FAQs to SQLite with 7-day TTL.")

    print("\n========== [4] TESTING FAST DETERMINISTIC MATCHING ENGINE ==========")
    # Test Exact & Fuzzy Queries
    test_queries = [
        ("What courses do you offer?", "course_information"),
        ("Which programs are available?", "course_information"),
        ("What is the fee structure?", "fee_structure"),
        ("How much is tuition fee?", "fee_structure"),
        ("How are campus placements and highest package?", "placements_and_careers"),
        ("Tell me about scholarships for high marks", "scholarships"),
    ]

    faq_records = [
        {
            "id": f.id,
            "intent": f.intent,
            "category": f.category,
            "questions": f.questions,
            "answer": f.answer,
            "source_urls": f.source_urls,
            "priority": f.priority,
            "answer_available": True
        }
        for f in db.query(HardcodedFAQDB).filter(HardcodedFAQDB.bot_id == bot_id).all()
    ]

    for query_text, expected_intent in test_queries:
        res = match_query_to_faqs(query_text, faq_records)
        assert res.matched, f"Query '{query_text}' should match"
        assert res.faq["intent"] == expected_intent, f"Query '{query_text}' expected intent '{expected_intent}', got '{res.faq['intent']}'"
        print(f"[OK] Matched '{query_text}' -> Intent '{res.faq['intent']}' (Score: {res.score:.2f}, Type: {res.match_type})")

    print("\n========== [5] TESTING CONVERSATIONAL LEAD CAPTURE ==========")
    session_id = None
    
    # 5a. Initial touch - email prompt
    res1 = handle_hardcoded_visitor_chat(bot, session_id, "Hello, can you help me?", {}, db)
    session_id = res1.session_id
    assert res1.step == "ask_email", f"Expected ask_email, got {res1.step}"
    print(f"[OK] Step 1: Greeting -> Bot asks: '{res1.answer}'")

    # 5b. Visitor provides email
    res2 = handle_hardcoded_visitor_chat(bot, session_id, "my email is faizan@test.com", {}, db)
    assert res2.step == "ask_mobile", f"Expected ask_mobile, got {res2.step}"
    print(f"[OK] Step 2: Email captured (faizan@test.com) -> Bot asks: '{res2.answer}'")

    # 5c. Visitor provides phone number
    res3 = handle_hardcoded_visitor_chat(bot, session_id, "+91 98765 43210", {"student_name": "Faizan", "course": "B.Tech CSE"}, db)
    assert res3.step == "active", f"Expected active, got {res3.step}"
    assert res3.visitor.email == "faizan@test.com"
    assert "98765" in res3.visitor.mobile
    print(f"[OK] Step 3: Mobile captured (+91 98765 43210) -> Session active -> Bot replies: '{res3.answer}'")

    # 5d. Visitor asks questions in active session
    res4 = handle_hardcoded_visitor_chat(bot, session_id, "What are the B.Tech course fees?", {}, db)
    assert not res4.fallback_triggered, "Known question should not trigger fallback"
    assert "82,500" in res4.answer or "fee" in res4.answer.lower()
    print(f"[OK] Step 4: Asked fees -> Instant Predefined Answer returned: '{res4.answer[:70]}...'")

    # 5e. Unknown question triggers fallback
    res5 = handle_hardcoded_visitor_chat(bot, session_id, "What is the quantum orbital radius of the cafeteria?", {}, db)
    assert res5.fallback_triggered, "Unknown question should trigger fallback"
    assert res5.show_ask_ai and res5.show_request_callback
    print(f"[OK] Step 5: Unknown question -> Fallback triggered with [Ask AI Assistant] & [Request Callback] buttons")

    print("\n[OK] ALL PIPELINE TESTS PASSED SUCCESSFULLY!")
    db.close()

if __name__ == "__main__":
    asyncio.run(test_complete_hardcoded_flow())
