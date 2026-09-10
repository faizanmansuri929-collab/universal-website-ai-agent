import json
import re
from typing import List, Dict, Any, Tuple, Optional
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.schemas import PageDB, AgentDB, EntityDB, DebugTrace, DebugTraceItem
from app.core.sectors import get_sector_config
from app.services.knowledge.vector_store import vector_store
from app.services.rag.query_analyzer import analyze_user_query
from app.services.rag.reranker import rerank_candidate_chunks
from app.services.llm.provider import get_llm_provider, get_embedding_provider

SYSTEM_GROUNDING_INSTRUCTION = """You are an intelligent, helpful AI representative for this organization.
Answer the user's question accurately, thoroughly, and professionally based exclusively on the provided website knowledge.
Rules:
1. Handle minor typos in user questions gracefully (e.g. 'crouse' -> course, 'addmision' -> admission).
2. When the user asks about courses, programs, degrees, or offerings, clearly list all matching programs and branches available in the knowledge base.
3. If structured entities (courses, doctors, pricing plans, specifications, contact) are provided, use them prominently.
4. If a specific factual detail cannot be found in the website knowledge, explain: "I couldn't find that specific detail in the available website knowledge."
5. Never invent or hallucinate facts, pricing, policies, or contact details not supported by the context."""


async def query_rag_engine(
    agent_id: str,
    user_message: str,
    include_debug: bool = False
) -> Tuple[str, List[Dict[str, str]], Optional[DebugTrace]]:
    """
    Unified Sector-Aware RAG Engine with Query Understanding, Structured Entity Lookup,
    Hybrid Retrieval, Multi-Factor Reranking, and Debug Trace.
    """
    embedding_provider = get_embedding_provider()
    llm_provider = get_llm_provider()

    db: Session = SessionLocal()
    try:
        agent = db.query(AgentDB).filter(AgentDB.id == agent_id).first()
        sector = agent.detected_sector if agent else "general"
        sector_cfg = get_sector_config(sector)

        # 1. Query Understanding
        query_analysis = analyze_user_query(user_message, sector=sector)
        cleaned_query = query_analysis["cleaned_query"]
        target_entity_type = query_analysis["entity_type"]

        # 2. Structured Entity Lookup from DB
        matched_entities = []
        entity_context_blocks = []
        if target_entity_type:
            db_entities = db.query(EntityDB).filter(
                EntityDB.agent_id == agent_id,
                EntityDB.entity_type == target_entity_type
            ).all()
            for ent in db_entities:
                matched_entities.append(f"{ent.entity_name} ({ent.entity_type})")
                entity_context_blocks.append(
                    f"[Structured Entity: {ent.entity_name} ({ent.entity_type})]\n"
                    f"Attributes: {json.dumps(ent.attributes)}\nSource: {ent.source_url}"
                )
        
        # Also fetch all entities if query is a broad inquiry
        if not matched_entities and query_analysis["intent"] in ("course_inquiry", "doctor_search", "pricing_inquiry", "contact_info"):
            all_db_entities = db.query(EntityDB).filter(EntityDB.agent_id == agent_id).all()
            for ent in all_db_entities:
                matched_entities.append(f"{ent.entity_name} ({ent.entity_type})")
                entity_context_blocks.append(
                    f"[Structured Record: {ent.entity_name} ({ent.entity_type})]\n"
                    f"Attributes: {json.dumps(ent.attributes)}"
                )

        # 3. Hybrid Semantic & Keyword Retrieval
        query_vector = embedding_provider.embed_query(cleaned_query)
        candidates = vector_store.search_similarity(
            agent_id=agent_id,
            query_embedding=query_vector,
            top_k=10,
            query_text=cleaned_query
        )

        # Fallback to DB pages if candidate pool was empty
        if not candidates:
            pages = db.query(PageDB).filter(PageDB.agent_id == agent_id).all()
            for p in pages:
                candidates.append({
                    "id": p.id,
                    "text": p.content_text,
                    "metadata": {
                        "url": p.url,
                        "title": p.title or "Website Page",
                        "page_id": p.id
                    },
                    "score": 0.5
                })

        # 4. Multi-Factor Reranker
        reranked_chunks = rerank_candidate_chunks(candidates, query_analysis, top_n=5)

        # 5. Assemble Context & Citations
        context_blocks = []
        if agent:
            context_blocks.append(f"Organization: {agent.name}\nWebsite: {agent.website_url}\nIndustry Sector: {sector_cfg['name']}")

        if entity_context_blocks:
            context_blocks.append("--- STRUCTURED DOMAIN RECORDS ---\n" + "\n\n".join(entity_context_blocks))

        citations_dict = {}
        for chunk in reranked_chunks:
            text = chunk["text"]
            url = chunk.get("url", "")
            title = chunk.get("title", "Website Page")
            context_blocks.append(f"[Source Page: {title} ({url})]\n{text}")

            if url and url not in citations_dict:
                citations_dict[url] = {
                    "url": url,
                    "title": title,
                    "snippet": text[:180] + ("..." if len(text) > 180 else "")
                }

        context_str = "\n\n---\n\n".join(context_blocks)

        # 6. LLM Generation
        prompt = f"""KNOWLEDGE BASE CONTEXT:
{context_str}

USER INQUIRY:
{user_message}"""

        answer = await llm_provider.generate_response(
            prompt=prompt,
            system_instruction=SYSTEM_GROUNDING_INSTRUCTION
        )

        citations_list = list(citations_dict.values())

        # 7. Build Debug Trace if requested
        debug_trace = None
        if include_debug:
            debug_items = [
                DebugTraceItem(
                    chunk_id=c.get("chunk_id", "chunk_1"),
                    title=c.get("title", "Page"),
                    url=c.get("url", ""),
                    score=c.get("score", 0.0),
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

        return answer, citations_list, debug_trace

    finally:
        db.close()
