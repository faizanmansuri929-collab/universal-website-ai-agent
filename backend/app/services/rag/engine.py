import json
import re
from typing import List, Dict, Any, Tuple, Optional
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.schemas import (
    PageDB, AgentDB, EntityDB, DebugTrace, DebugTraceItem,
    CitationSchema, LeadScoreSchema, EnrollmentPredictionSchema, BookingSlotSchema
)
from app.core.sectors import get_sector_config
from app.services.knowledge.vector_store import vector_store
from app.services.rag.query_analyzer import analyze_user_query
from app.services.rag.reranker import rerank_candidate_chunks
from app.services.rag.education_agent import analyze_lead_and_qualification
from app.services.llm.provider import get_llm_provider, get_embedding_provider

def sanitize_branding(text: str) -> str:
    """Strictly ensures Poornima references are replaced by XYZ College."""
    if not text:
        return text
    # 1. Full URLs and domain patterns first
    text = re.sub(r'(?i)https?://(www\.)?poornimainstitute\.edu\.in/?', 'https://www.xyzcollege.edu.in/', text)
    text = re.sub(r'(?i)https?://(www\.)?poornima\.org/?', 'https://www.xyzcollege.edu.in/', text)
    text = re.sub(r'(?i)www\.poornimainstitute\.edu\.in', 'www.xyzcollege.edu.in', text)
    text = re.sub(r'(?i)poornimainstitute\.edu\.in', 'xyzcollege.edu.in', text)
    text = re.sub(r'(?i)admission\.poornima\.org', 'admission.xyzcollege.edu.in', text)
    text = re.sub(r'(?i)www\.poornima\.org', 'www.xyzcollege.edu.in', text)
    text = re.sub(r'(?i)poornima\.org', 'xyzcollege.edu.in', text)
    text = re.sub(r'(?i)admission@poornima\.org', 'admission@xyzcollege.edu.in', text)

    # 2. Institution names
    text = re.sub(r'(?i)poornima group of colleges', 'XYZ Group of Colleges', text)
    text = re.sub(r'(?i)poornima college of engineering', 'XYZ College of Engineering', text)
    text = re.sub(r'(?i)poornima institute of engineering & technology', 'XYZ Institute of Engineering & Technology', text)
    text = re.sub(r'(?i)poornima institute of engineering and technology', 'XYZ Institute of Engineering & Technology', text)
    text = re.sub(r'(?i)poornima institute', 'XYZ Institute', text)
    text = re.sub(r'(?i)poornima university', 'XYZ University', text)
    text = re.sub(r'(?i)poornima', 'XYZ College', text)

    # 3. Clean up any accidental URL spacing or repetitions
    text = re.sub(r'(?i)https?://www\.XYZ College\.org', 'https://www.xyzcollege.edu.in', text)
    text = re.sub(r'(?i)XYZ College College', 'XYZ College', text)
    text = re.sub(r'(?i)XYZ College Group of Colleges', 'XYZ Group of Colleges', text)
    return text

SYSTEM_GROUNDING_INSTRUCTION = """You are an intelligent, helpful AI representative for XYZ College / XYZ Group of Colleges (XYZCE & XYZIET).
Answer the user's question accurately, thoroughly, and professionally based exclusively on the provided website knowledge.
Rules:
1. Handle minor typos in user questions gracefully (e.g. 'crouse' -> course, 'addmision' -> admission).
2. When the user asks about courses, programs, degrees, or offerings, clearly list all matching programs and branches available in the knowledge base.
3. If structured entities (courses, doctors, pricing plans, specifications, contact, fees) are provided, use them prominently.
4. If information is sourced from a [DEMO DATA] or [DEMO DOCUMENT] section, transparently mention that this is based on sample university demo records.
5. If a specific factual detail cannot be found in the website knowledge, explain: "I couldn't find that specific detail in the available website knowledge."
6. NEVER use or mention the name "Poornima" under any circumstances. Always refer to the college as XYZ College / XYZ Group of Colleges (XYZCE & XYZIET).
7. Never invent or hallucinate facts, pricing, policies, or contact details not supported by the context."""

STUDENT_ADMISSION_INSTRUCTION = """You are the official XYZ College Admissions AI Assistant for XYZ Group of Colleges (XYZCE & XYZIET).
Your primary goal is to guide prospective students and parents, answer questions about courses, eligibility, fees, scholarships, and admission procedures from official website knowledge, and smoothly gather key admission lead information (Name, Mobile, Father's Name, 12th/Diploma Score, Annual Family Income, Target Course, Admission Year, Hostel need).

Guidelines:
1. Answer course and admission questions accurately using the provided website knowledge base. Always list offered branches/specializations when asked.
2. STRICT IDENTITY: Always represent XYZ College / XYZ Group of Colleges (XYZCE & XYZIET). NEVER mention or use the name "Poornima" under any circumstances.
3. Be warm, supportive, and conversational.
4. PROGRESSIVE INFORMATION CAPTURE: Do NOT interrogate the student with 10 questions at once! Ask only 1 or 2 relevant follow-up questions at a time in a natural, polite manner.
   - For example: if they ask about B.Tech CSE, answer their question thoroughly, then ask: "What was your 12th percentage or academic score?"
   - If they provide their score, ask: "Great! Could you share your father's name and approximate annual family income?"
   - Then ask for their name and mobile number to dispatch the brochure and application link.
5. If the student has a lower percentage (e.g. 50-55%), encourage them! Inform them about eligibility review, entrance quota, or management quota opportunities without making false promises.
6. Provide helpful next steps and point them to action buttons like [Apply Now], [Talk to Counselor], or [Explore Management Quota]."""

TEACHER_FACULTY_INSTRUCTION = """You are the XYZ College Faculty & Staff Policy Assistant.
Answer questions regarding faculty service rules, casual/medical leave policies, research grants, conference reimbursements, and academic administrative protocols based on the official faculty handbook and university policy documents. Never mention the name "Poornima"."""


async def query_rag_engine(
    agent_id: str,
    user_message: str,
    history: Optional[List[Dict[str, str]]] = None,
    mode: str = "student",
    include_debug: bool = False
) -> Tuple[
    str,
    List[CitationSchema],
    Optional[DebugTrace],
    Optional[LeadScoreSchema],
    Optional[EnrollmentPredictionSchema],
    Optional[Any],
    Optional[str],
    Optional[str],
    Optional[List[str]],
    Optional[List[BookingSlotSchema]]
]:
    """
    Unified Sector-Aware RAG Engine with Query Understanding, Structured Entity Lookup,
    Source-Prioritized Hybrid Retrieval, Multi-Factor Reranking, Admission Lead Scoring & Persistence,
    and Debug Trace.
    """
    history = history or []
    embedding_provider = get_embedding_provider()
    llm_provider = get_llm_provider()

    db: Session = SessionLocal()
    try:
        agent = db.query(AgentDB).filter(AgentDB.id == agent_id).first()
        sector = agent.detected_sector if agent else "general"
        sector_cfg = get_sector_config(sector)
        agent_url = agent.website_url if agent else "https://www.xyzcollege.edu.in"

        # 1. Query Understanding
        query_analysis = analyze_user_query(user_message, sector=sector)
        cleaned_query = query_analysis["cleaned_query"]
        target_entity_type = query_analysis["entity_type"]

        # 2. Structured Entity Lookup
        matched_entities = []
        entity_context_blocks = []
        if target_entity_type or query_analysis.get("entity"):
            ent_query = db.query(EntityDB).filter(EntityDB.agent_id == agent_id)
            if target_entity_type:
                ent_query = ent_query.filter(EntityDB.entity_type == target_entity_type)
            
            entities = ent_query.limit(8).all()
            for ent in entities:
                matched_entities.append(f"{ent.entity_name} ({ent.entity_type})")
                attrs_str = ", ".join([f"{k}: {v}" for k, v in (ent.attributes or {}).items()])
                entity_context_blocks.append(
                    f"OFFICIAL ENTITY: {ent.entity_name} [{ent.entity_type}]\nDetails: {attrs_str}\nSource: {ent.source_url}"
                )

        # 3. Vector & Keyword Retrieval
        query_emb = embedding_provider.embed_query(cleaned_query)
        raw_chunks = vector_store.search(
            agent_id=agent_id,
            query_embedding=query_emb,
            top_k=10
        )

        # 4. Multi-Factor Reranking & Priority Hierarchy
        reranked_chunks = rerank_candidate_chunks(
            candidates=raw_chunks,
            query_analysis=query_analysis,
            top_n=5
        )

        # 5. Build Grounded Context
        context_blocks = []
        citations_dict = {}

        for ent_block in entity_context_blocks:
            context_blocks.append(ent_block)

        for chunk in reranked_chunks:
            source_type = chunk.get("source_type", "REAL_WEBSITE")
            prefix = f"[{source_type}] " if source_type != "REAL_WEBSITE" else ""
            context_blocks.append(
                f"{prefix}SOURCE: {chunk.get('title', 'Website Document')}\nURL: {chunk.get('url', '')}\nCONTENT:\n{chunk.get('text', '')}"
            )
            url = chunk.get("url", "")
            if url and url not in citations_dict:
                citations_dict[url] = CitationSchema(
                    url=url,
                    title=chunk.get("title", "Website Reference"),
                    snippet=chunk.get("text", "")[:200] + "...",
                    source_type=source_type
                )

        context_str = "\n\n---\n\n".join(context_blocks)

        # 6. Select Grounding Instruction based on mode & sector
        if mode == "student" or (sector == "college" and mode != "teacher"):
            system_instruction = STUDENT_ADMISSION_INSTRUCTION
        elif mode == "teacher" or (sector == "college" and mode == "teacher"):
            system_instruction = TEACHER_FACULTY_INSTRUCTION
        else:
            system_instruction = SYSTEM_GROUNDING_INSTRUCTION

        # 7. LLM Generation
        prompt = f"""KNOWLEDGE BASE CONTEXT:
{context_str}

USER INQUIRY:
{user_message}"""

        answer = await llm_provider.generate_response(
            prompt=prompt,
            system_instruction=system_instruction
        )

        citations_list = list(citations_dict.values())

        # 8. Education Agent Lead Extraction, Scoring & Database Persistence
        lead_score = None
        enrollment_prediction = None
        booking_slots = None
        admission_lead = None
        apply_url = None
        management_quota_url = None
        suggested_actions = sector_cfg.get("suggested_actions", [])

        if sector == "college" or mode == "student":
            lead_score, enrollment_prediction, booking_slots, edu_actions, admission_lead, apply_url, management_quota_url = analyze_lead_and_qualification(
                current_message=user_message,
                history=history,
                agent_id=agent_id,
                agent_url=agent_url,
                db=db
            )
            if edu_actions:
                suggested_actions = edu_actions

        # 9. Build Debug Trace if requested
        debug_trace = None
        if include_debug:
            debug_items = [
                DebugTraceItem(
                    chunk_id=c.get("chunk_id", "chunk_1"),
                    title=c.get("title", "Page"),
                    url=c.get("url", ""),
                    score=c.get("score", 0.0),
                    source_type=c.get("source_type", "REAL_WEBSITE"),
                    matched_entity=c.get("matched_entity"),
                    snippet=c.get("text", "")[:150] + "..."
                )
                for c in reranked_chunks
            ]
            debug_trace = DebugTrace(
                detected_intent=query_analysis.get("intent", "general_inquiry"),
                detected_entity_type=query_analysis.get("entity_type"),
                detected_entity=query_analysis.get("entity"),
                applied_filters=query_analysis.get("applied_filters", {}),
                matched_structured_entities=matched_entities[:6],
                retrieved_sources=list(citations_dict.keys()),
                reranked_chunks=debug_items
            )

        # Strict Branding Sanitization
        answer = sanitize_branding(answer)
        clean_citations = []
        for cit in citations_list:
            clean_citations.append(CitationSchema(
                url=sanitize_branding(cit.url),
                title=sanitize_branding(cit.title),
                snippet=sanitize_branding(cit.snippet),
                source_type=cit.source_type
            ))
        apply_url = sanitize_branding(apply_url) if apply_url else apply_url
        management_quota_url = sanitize_branding(management_quota_url) if management_quota_url else management_quota_url

        return (
            answer,
            clean_citations,
            debug_trace,
            lead_score,
            enrollment_prediction,
            admission_lead,
            apply_url,
            management_quota_url,
            suggested_actions,
            booking_slots
        )

    finally:
        db.close()
