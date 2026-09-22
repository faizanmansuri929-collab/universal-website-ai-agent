import time
import hashlib
import json
import datetime
from typing import List, Dict, Any, Tuple, Optional
from sqlalchemy.orm import Session
from app.models.schemas import (
    CitationSchema, WebSearchDebugTrace, WebSearchChatResponse,
    WebSearchCacheDB, WebSearchConfigDB, ChatMessage
)
from app.services.llm.provider import get_llm_provider
from app.services.web_search.search_engine import select_and_fetch_poornima_sources

POORNIMA_SYSTEM_PROMPT = """You are the official-style AI web assistant for Poornima University / Poornima Group of Colleges.

You answer questions only about Poornima and information contained in the approved official Poornima website sources provided in the context.

Guidelines:
1. Use ONLY the provided/search-retrieved Poornima official sources.
2. If the user asks about another college, unrelated company, unrelated person, unrelated product, politics, entertainment, general internet information, or any topic outside Poornima, politely explain that you can only help with Poornima University/College information.
3. NEVER invent or hallucinate information.
4. If the answer is not available in the approved Poornima sources, say clearly: "I couldn't find that specific information in the available official Poornima website sources." and suggest contacting Poornima Admissions/Helpline.
5. Structure answers cleanly with bullet points, headings, or tables where appropriate.
6. Be warm, accurate, and professional."""


async def generate_poornima_web_search_answer(
    user_message: str,
    history: Optional[List[ChatMessage]] = None,
    include_debug: bool = True,
    db: Optional[Session] = None
) -> WebSearchChatResponse:
    """
    Complete pipeline:
    1. Check 10-min cache.
    2. Intent routing & OpenAI dynamic URL selection from allowlist.
    3. Live web fetch of 1-3 selected Poornima sources.
    4. Grounded answer synthesis with OpenAI.
    5. Return structured answer + verified source links + debug trace.
    """
    start_time = time.time()
    history = history or []
    history_dicts = [{"role": m.role, "content": m.content} for m in history]

    # 1. Check Short-Term Query Cache (10 mins TTL)
    clean_query = user_message.strip()
    query_hash = hashlib.md5(f"{clean_query.lower()}_{len(history)}".encode("utf-8")).hexdigest()
    now = datetime.datetime.utcnow()

    config = db.query(WebSearchConfigDB).filter(WebSearchConfigDB.id == "poornima_config").first() if db else None
    max_sources = config.max_sources_per_query if config else 3
    cache_ttl = config.cache_ttl_seconds if config else 600

    if db and not history: # cache top standalone queries
        cached = db.query(WebSearchCacheDB).filter(
            WebSearchCacheDB.id == query_hash,
            WebSearchCacheDB.expires_at > now
        ).first()

        if cached:
            citations = [CitationSchema(**c) for c in (cached.citations or [])]
            debug_trace = None
            if include_debug and cached.debug_trace:
                cached.debug_trace["cache_hit"] = True
                cached.debug_trace["processing_time_ms"] = round((time.time() - start_time) * 1000, 2)
                debug_trace = WebSearchDebugTrace(**cached.debug_trace)

            return WebSearchChatResponse(
                answer=cached.answer,
                sources_used_count=len(citations),
                sources=citations,
                is_live_searched=True,
                detected_intent=cached.detected_intent,
                debug_trace=debug_trace
            )

    # 2. Select & Live Fetch 1-3 Poornima Sources
    candidates, selected_sources, intent_info, ai_reason = await select_and_fetch_poornima_sources(
        user_message=user_message,
        history=history_dicts,
        db=db,
        max_sources=max_sources
    )

    detected_intent = intent_info.get("intent", "general")
    search_query = intent_info.get("search_query", "")

    # Handle Off-Topic Query
    if intent_info.get("is_off_topic"):
        answer = (
            "I am the official AI assistant for **Poornima University & Poornima Group of Colleges** (Jaipur).\n\n"
            "I can only help with information related to Poornima (such as B.Tech courses, admissions, eligibility, fees, hostels, campus life, and placements).\n\n"
            "Please ask a question about Poornima programs or admissions!"
        )
        debug_trace = WebSearchDebugTrace(
            user_query=user_message,
            detected_intent="off_topic",
            optimized_search_query="",
            sources_returned=[],
            selected_sources=[],
            ai_link_selection_reason="Query outside Poornima domain; polite refusal triggered.",
            cache_hit=False,
            processing_time_ms=round((time.time() - start_time) * 1000, 2)
        )
        return WebSearchChatResponse(
            answer=answer,
            sources_used_count=0,
            sources=[],
            is_live_searched=False,
            detected_intent="off_topic",
            debug_trace=debug_trace
        )

    # Handle Greeting
    if intent_info.get("is_greeting"):
        answer = (
            "👋 **Hello! Welcome to Poornima Live Web Assistant.**\n\n"
            "I am connected to the official Poornima website (`poornima.org`) with live web search enabled. You can ask me about:\n"
            "- 🎓 **B.Tech Programs & Specializations** (CSE, AI & DS, Cyber Security, etc.)\n"
            "- 🏛️ **Admission Procedure & REAP Eligibility**\n"
            "- 💰 **Fee Structure & Scholarships**\n"
            "- 💼 **Placements, Highest Packages & Top MNCs**\n"
            "- 🛏️ **Hostel Facilities, Mess & Campus Life**\n\n"
            "What would you like to know about Poornima?"
        )
        citations = [
            CitationSchema(
                url="https://www.poornima.org/",
                title="Poornima Group of Colleges - Official Website",
                snippet="Official portal for Poornima University & Engineering Colleges in Jaipur.",
                source_type="REAL_WEBSITE"
            ),
            CitationSchema(
                url="https://www.poornima.org/admission/btech-at-poornima-group-of-colleges",
                title="B.Tech Admissions 2026",
                snippet="B.Tech admission guidelines, specializations, and eligibility criteria.",
                source_type="REAL_WEBSITE"
            )
        ]
        debug_trace = WebSearchDebugTrace(
            user_query=user_message,
            detected_intent="greeting",
            optimized_search_query=search_query,
            sources_returned=[{"url": c.url, "title": c.title, "score": 1.0} for c in citations],
            selected_sources=[{"url": c.url, "title": c.title, "score": 1.0} for c in citations],
            ai_link_selection_reason="Standard welcome greeting response.",
            cache_hit=False,
            processing_time_ms=round((time.time() - start_time) * 1000, 2)
        )
        return WebSearchChatResponse(
            answer=answer,
            sources_used_count=len(citations),
            sources=citations,
            is_live_searched=True,
            detected_intent="greeting",
            debug_trace=debug_trace
        )

    # 3. Build Grounded Context from Fetched Pages
    context_blocks = []
    citations_list = []

    for s in selected_sources:
        content_text = s.get("content", "")
        context_blocks.append(
            f"SOURCE TITLE: {s.get('title')}\nOFFICIAL URL: {s.get('url')}\nWEBSITE CONTENT:\n{content_text}"
        )
        citations_list.append(CitationSchema(
            url=s.get("url"),
            title=s.get("title") or "Poornima Official Page",
            snippet=content_text[:220].replace("\n", " ") + "...",
            source_type="REAL_WEBSITE"
        ))

    context_str = "\n\n====================\n\n".join(context_blocks)

    # Build prompt
    prompt = f"""LIVE SEARCHED POORNIMA OFFICIAL WEBSITE CONTEXT:
{context_str}

USER QUESTION:
{user_message}"""

    # 4. Generate Answer via LLM Provider
    llm_provider = get_llm_provider()
    system_prompt = (config.system_prompt_override if config and config.system_prompt_override else POORNIMA_SYSTEM_PROMPT)

    answer = await llm_provider.generate_response(prompt=prompt, system_instruction=system_prompt)
    answer = answer.strip()

    # 5. Build Debug Trace
    proc_time = round((time.time() - start_time) * 1000, 2)
    debug_trace = None
    if include_debug:
        debug_trace = WebSearchDebugTrace(
            user_query=user_message,
            detected_intent=detected_intent,
            optimized_search_query=search_query,
            sources_returned=candidates,
            selected_sources=[{
                "url": s.get("url"),
                "title": s.get("title"),
                "score": s.get("score"),
                "status": s.get("fetch_status")
            } for s in selected_sources],
            ai_link_selection_reason=ai_reason,
            cache_hit=False,
            processing_time_ms=proc_time
        )

    # 6. Save to 10-Minute Cache
    if db and not history and citations_list:
        try:
            expires_at = now + datetime.timedelta(seconds=cache_ttl)
            cache_entry = WebSearchCacheDB(
                id=query_hash,
                query=clean_query,
                detected_intent=detected_intent,
                search_query=search_query,
                selected_source_ids=[s.get("url") for s in selected_sources],
                answer=answer,
                citations=[c.dict() for c in citations_list],
                debug_trace=debug_trace.dict() if debug_trace else {},
                created_at=now,
                expires_at=expires_at
            )
            db.merge(cache_entry)
            db.commit()
        except Exception as e:
            print(f"[WebSearchCache] Cache save error: {e}")

    return WebSearchChatResponse(
        answer=answer,
        sources_used_count=len(citations_list),
        sources=citations_list,
        is_live_searched=True,
        detected_intent=detected_intent,
        debug_trace=debug_trace
    )
