import uuid
import datetime
import re
from typing import Dict, Any, List, Optional
from urllib.parse import urlparse
import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.schemas import (
    HardcodedBotDB, HardcodedFAQDB, ChatVisitorDB, ChatSessionDB, HardcodedMessageDB,
    AdmissionLeadDB, CitationSchema, HardcodedCTA, HardcodedChatResponse, ChatVisitorSchema
)
from app.services.crawler.parser import clean_and_extract_html
from app.services.crawler.robots import RobotsManager
from app.services.knowledge.sector_detector import detect_website_sector
from app.services.hardcoded.generator import generate_hardcoded_faq_dataset
from app.services.hardcoded.matcher import match_query_to_faqs
from app.services.hardcoded.templates import get_sector_template

robots_manager = RobotsManager()
BROWSER_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

EMAIL_REGEX = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
PHONE_REGEX = re.compile(r"(?:\+?\d{1,3}[ -]?)?(?:\d{10}|\d{5}[ -]?\d{5})")

async def build_hardcoded_bot_pipeline(bot_id: str, db_session_factory):
    """
    Asynchronous worker pipeline:
    1. Crawl website pages & extract clean content.
    2. Detect industry sector.
    3. Apply sector template & call OpenAI One-Time FAQ Dataset generation.
    4. Save generated dataset to SQLite DB.
    5. Set bot status to READY with 7-day TTL.
    """
    db: Session = db_session_factory()
    try:
        bot = db.query(HardcodedBotDB).filter(HardcodedBotDB.id == bot_id).first()
        if not bot:
            return

        bot.status = "CRAWLING"
        db.commit()

        start_url = bot.website_url
        parsed = urlparse(start_url)
        start_domain = parsed.netloc

        crawled_pages: List[Dict[str, Any]] = []
        queue: List[str] = [start_url]
        visited = set()
        detected_sector = bot.sector or "general"
        sector_detected = False

        async with httpx.AsyncClient(
            timeout=settings.CRAWL_TIMEOUT,
            follow_redirects=True,
            verify=False,
            headers={"User-Agent": BROWSER_USER_AGENT, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"}
        ) as client:
            while queue and len(visited) < 15:
                current_url = queue.pop(0)
                if current_url in visited:
                    continue
                visited.add(current_url)

                try:
                    resp = await client.get(current_url)
                    if resp.status_code != 200:
                        continue
                    raw_html = resp.text
                except Exception as e:
                    print(f"[HardcodedCrawl] Error fetching {current_url}: {e}")
                    continue

                title, desc, cleaned_text, links, _ = clean_and_extract_html(raw_html, current_url)
                if len(cleaned_text.strip()) < 15:
                    continue

                if not sector_detected:
                    detected_sector, _, _ = detect_website_sector(cleaned_text, title, desc)
                    bot.sector = detected_sector
                    sector_detected = True
                    db.commit()

                crawled_pages.append({
                    "url": current_url,
                    "title": title,
                    "description": desc,
                    "content_text": cleaned_text
                })

                # Enqueue internal links
                for link in links:
                    if link not in visited and link not in queue:
                        if urlparse(link).netloc == start_domain:
                            queue.append(link)

        # 2. Sector Template & OpenAI One-Time Generation
        bot.status = "GENERATING"
        db.commit()

        dataset = await generate_hardcoded_faq_dataset(
            website_url=bot.website_url,
            sector=detected_sector,
            crawled_pages=crawled_pages,
            bot_name=bot.name
        )

        # 3. Store Generated FAQs in Backend Database
        # Clear any prior FAQs for this bot
        db.query(HardcodedFAQDB).filter(HardcodedFAQDB.bot_id == bot_id).delete()

        generated_faqs = dataset.get("faqs", [])
        for item in generated_faqs:
            cta_info = item.get("cta") or {}
            faq_db = HardcodedFAQDB(
                id=str(uuid.uuid4()),
                bot_id=bot_id,
                intent=item.get("intent", "general_inquiry"),
                category=item.get("category", "General"),
                questions=item.get("questions", []),
                answer=item.get("answer", ""),
                source_urls=item.get("source_urls", [bot.website_url]),
                cta_label=cta_info.get("label"),
                cta_url=cta_info.get("url"),
                priority=item.get("priority", 5),
                answer_available=1 if item.get("answer_available", True) else 0
            )
            db.add(faq_db)

        # 4. Update Bot Metadata & Expiry TTL
        ttl_days = bot.ttl_days or settings.HARD_CODED_BOT_TTL_DAYS
        now = datetime.datetime.utcnow()
        expires_at = now + datetime.timedelta(days=ttl_days)

        if dataset.get("bot_name"):
            bot.name = dataset["bot_name"]
        if dataset.get("welcome_message"):
            bot.welcome_message = dataset["welcome_message"]

        bot.status = "READY"
        bot.last_generated_at = now
        bot.expires_at = expires_at
        bot.updated_at = now
        db.commit()
        print(f"[HardcodedBot] Successfully built bot {bot_id} with {len(generated_faqs)} predefined FAQs.")

    except Exception as e:
        print(f"[HardcodedBot] Fatal pipeline error for bot {bot_id}: {e}")
        bot.status = "FAILED"
        bot.error_message = str(e)
        db.commit()
    finally:
        db.close()


async def regenerate_hardcoded_bot_dataset(bot_id: str, db_session_factory):
    """
    Manual regeneration of the Hardcoded Bot dataset:
    Increments version, re-runs crawl & OpenAI generation, and resets TTL.
    """
    db: Session = db_session_factory()
    try:
        bot = db.query(HardcodedBotDB).filter(HardcodedBotDB.id == bot_id).first()
        if not bot:
            return
        bot.version = (bot.version or 1) + 1
        bot.status = "QUEUED"
        db.commit()
    finally:
        db.close()

    await build_hardcoded_bot_pipeline(bot_id, db_session_factory)


def handle_hardcoded_visitor_chat(
    bot: HardcodedBotDB,
    req_session_id: Optional[str],
    user_message: str,
    extra_data: Dict[str, Any],
    db: Session
) -> HardcodedChatResponse:
    """
    Deterministic runtime chat handler with zero runtime LLM calls:
    1. Check 7-day TTL expiration status.
    2. Conversational lead capture (Email -> Phone -> Session Active).
    3. Fast deterministic intent & FAQ matching.
    4. Grounded answer + real citations + CTAs + fallback triggers.
    """
    now = datetime.datetime.utcnow()
    clean_msg = user_message.strip()

    # Check expiration
    if bot.expires_at and bot.expires_at < now:
        bot.status = "UPDATE_REQUIRED"
        db.commit()

    # Retrieve or create session
    session = None
    if req_session_id:
        session = db.query(ChatSessionDB).filter(ChatSessionDB.id == req_session_id).first()

    if not session:
        session = ChatSessionDB(
            id=str(uuid.uuid4()),
            bot_id=bot.id,
            step="ask_email",
            status="ACTIVE",
            started_at=now,
            last_activity=now
        )
        db.add(session)
        db.commit()

    session.last_activity = now
    visitor = None
    if session.visitor_id:
        visitor = db.query(ChatVisitorDB).filter(ChatVisitorDB.id == session.visitor_id).first()

    # --- STEP 1: Conversational Email Collection ---
    if session.step == "ask_email":
        email_match = EMAIL_REGEX.search(clean_msg)
        if email_match:
            detected_email = email_match.group(0).lower()
            # Store temporary visitor or update session
            visitor = ChatVisitorDB(
                id=str(uuid.uuid4()),
                bot_id=bot.id,
                email=detected_email,
                mobile="",
                student_name=extra_data.get("student_name", ""),
                source_url=bot.website_url,
                created_at=now
            )
            db.add(visitor)
            db.commit()

            session.visitor_id = visitor.id
            session.step = "ask_mobile"
            db.commit()

            reply = "Thank you! Please enter your mobile number so we can connect you with the right advisor if needed."
            _log_message(db, session.id, bot.id, "user", clean_msg)
            _log_message(db, session.id, bot.id, "assistant", reply)

            return HardcodedChatResponse(
                session_id=session.id,
                bot_id=bot.id,
                step="ask_mobile",
                answer=reply,
                visitor=ChatVisitorSchema.from_orm(visitor) if visitor else None
            )
        else:
            reply = f"Welcome! Before we get started, please enter your email address."
            _log_message(db, session.id, bot.id, "user", clean_msg)
            _log_message(db, session.id, bot.id, "assistant", reply)

            return HardcodedChatResponse(
                session_id=session.id,
                bot_id=bot.id,
                step="ask_email",
                answer=reply
            )

    # --- STEP 2: Conversational Mobile Collection ---
    elif session.step == "ask_mobile":
        # Extract digits
        digits = re.sub(r"[^\d+]", "", clean_msg)
        if len(re.sub(r"[^\d]", "", digits)) >= 7:
            if visitor:
                visitor.mobile = digits
                if extra_data.get("student_name"):
                    visitor.student_name = extra_data["student_name"]
                if extra_data.get("course"):
                    visitor.course = extra_data["course"]
                if extra_data.get("percentage"):
                    visitor.percentage = extra_data["percentage"]
                db.commit()

                # Also create an AdmissionLeadDB if bot is college sector for unified CRM
                if bot.sector == "college":
                    lead = AdmissionLeadDB(
                        id=str(uuid.uuid4()),
                        agent_id=bot.agent_id or bot.id,
                        student_name=visitor.student_name or "Website Prospect",
                        mobile_number=visitor.mobile,
                        email=visitor.email,
                        course_name=visitor.course or "",
                        percentage=visitor.percentage,
                        lead_score=75,
                        lead_temperature="WARM",
                        source="HARDCODED_BOT",
                        created_at=now
                    )
                    db.add(lead)
                    db.commit()

            session.step = "active"
            db.commit()

            # Sector-based welcome quick actions
            template = get_sector_template(bot.sector)
            sample_questions = []
            for item in template.get("intents", [])[:4]:
                if item.get("sample_questions"):
                    sample_questions.append(item["sample_questions"][0])

            reply = f"Thank you! Your information has been registered. How can I assist you with {bot.name} today?"
            _log_message(db, session.id, bot.id, "user", clean_msg)
            _log_message(db, session.id, bot.id, "assistant", reply)

            return HardcodedChatResponse(
                session_id=session.id,
                bot_id=bot.id,
                step="active",
                answer=reply,
                suggested_actions=sample_questions,
                visitor=ChatVisitorSchema.from_orm(visitor) if visitor else None
            )
        else:
            reply = "Please enter a valid mobile number (e.g., +91 98765 43210 or 10-digit number)."
            _log_message(db, session.id, bot.id, "user", clean_msg)
            _log_message(db, session.id, bot.id, "assistant", reply)

            return HardcodedChatResponse(
                session_id=session.id,
                bot_id=bot.id,
                step="ask_mobile",
                answer=reply,
                visitor=ChatVisitorSchema.from_orm(visitor) if visitor else None
            )

    # --- STEP 3: Active Runtime FAQ Matching (Zero LLM Calls) ---
    else:
        # Load all saved FAQs for this bot
        db_faqs = db.query(HardcodedFAQDB).filter(HardcodedFAQDB.bot_id == bot.id).all()
        faq_dicts = []
        for f in db_faqs:
            faq_dicts.append({
                "id": f.id,
                "intent": f.intent,
                "category": f.category,
                "questions": f.questions or [],
                "answer": f.answer,
                "source_urls": f.source_urls or [],
                "cta_label": f.cta_label,
                "cta_url": f.cta_url,
                "priority": f.priority or 1,
                "answer_available": bool(f.answer_available)
            })

        match_result = match_query_to_faqs(clean_msg, faq_dicts)
        _log_message(db, session.id, bot.id, "user", clean_msg)

        if match_result.matched and match_result.faq:
            matched_faq = match_result.faq
            answer = matched_faq["answer"]
            
            # Format citations
            citations = []
            for url in matched_faq.get("source_urls", []):
                citations.append(CitationSchema(
                    url=url,
                    title=f"Source: {urlparse(url).path or '/'}",
                    snippet=answer[:180],
                    source_type="REAL_WEBSITE"
                ))

            cta = None
            if matched_faq.get("cta_label") and matched_faq.get("cta_url"):
                cta = HardcodedCTA(label=matched_faq["cta_label"], url=matched_faq["cta_url"])

            # Suggested related questions from other FAQs
            suggested = []
            for f in faq_dicts:
                if f["id"] != matched_faq["id"] and f.get("questions"):
                    suggested.append(f["questions"][0])
                if len(suggested) >= 3:
                    break

            _log_message(
                db, session.id, bot.id, "assistant", answer,
                matched_faq_id=matched_faq["id"],
                matched_intent=matched_faq["intent"],
                citations=[c.dict() for c in citations],
                cta=cta.dict() if cta else None
            )

            return HardcodedChatResponse(
                session_id=session.id,
                bot_id=bot.id,
                step="active",
                answer=answer,
                matched_intent=matched_faq["intent"],
                matched_faq_id=matched_faq["id"],
                citations=citations,
                cta=cta,
                suggested_actions=suggested,
                fallback_triggered=False,
                visitor=ChatVisitorSchema.from_orm(visitor) if visitor else None
            )

        else:
            # Fallback when no predefined answer matches
            fallback_answer = "I don't have a predefined answer for that question. Would you like to speak with an advisor or query our AI Assistant?"
            _log_message(db, session.id, bot.id, "assistant", fallback_answer)

            return HardcodedChatResponse(
                session_id=session.id,
                bot_id=bot.id,
                step="active",
                answer=fallback_answer,
                fallback_triggered=True,
                show_ask_ai=True,
                show_request_callback=True,
                visitor=ChatVisitorSchema.from_orm(visitor) if visitor else None
            )


def _log_message(
    db: Session,
    session_id: str,
    bot_id: str,
    role: str,
    content: str,
    matched_faq_id: Optional[str] = None,
    matched_intent: Optional[str] = None,
    citations: List[Any] = None,
    cta: Optional[Dict[str, Any]] = None
):
    msg = HardcodedMessageDB(
        id=str(uuid.uuid4()),
        session_id=session_id,
        bot_id=bot_id,
        role=role,
        content=content,
        matched_faq_id=matched_faq_id,
        matched_intent=matched_intent,
        citations=citations or [],
        cta=cta,
        timestamp=datetime.datetime.utcnow()
    )
    db.add(msg)
    db.commit()
