import re
from typing import List, Dict, Any

def rerank_candidate_chunks(
    candidates: List[Dict[str, Any]],
    query_analysis: Dict[str, Any],
    top_n: int = 5
) -> List[Dict[str, Any]]:
    """
    Reranks candidate chunks using multi-factor scoring:
    - Entity exact/fuzzy match
    - Intent match
    - Keyword term frequency
    - Vector semantic score
    """
    if not candidates:
        return []

    target_entity = (query_analysis.get("entity") or "").lower()
    target_entity_type = (query_analysis.get("entity_type") or "").lower()
    target_intent = (query_analysis.get("intent") or "").lower()
    query_keywords = set(query_analysis.get("keywords") or [])

    reranked = []
    for cand in candidates:
        text = cand.get("text", "")
        text_lower = text.lower()
        meta = cand.get("metadata", {})
        base_score = cand.get("score", 0.5)

        # 1. Entity Match Score (0.0 to 1.0)
        entity_score = 0.0
        if target_entity and target_entity in text_lower:
            entity_score = 1.0
        elif target_entity_type and target_entity_type in text_lower:
            entity_score = 0.7

        # 2. Intent Match Score (0.0 to 1.0)
        intent_score = 0.0
        if target_intent == "course_inquiry" and any(w in text_lower for w in ["b.tech", "course", "degree", "branch", "engineering"]):
            intent_score = 1.0
        elif target_intent == "fee_inquiry" and any(w in text_lower for w in ["fee", "fees", "cost", "scholarship"]):
            intent_score = 1.0
        elif target_intent == "doctor_search" and any(w in text_lower for w in ["dr.", "doctor", "physician", "specialist"]):
            intent_score = 1.0
        elif target_intent == "pricing_inquiry" and any(w in text_lower for w in ["pricing", "plan", "month", "annual", "tier"]):
            intent_score = 1.0
        elif target_intent == "contact_info" and any(w in text_lower for w in ["address", "phone", "email", "telephone"]):
            intent_score = 1.0

        # 3. Keyword Overlap
        doc_words = set(re.findall(r"\w+", text_lower))
        overlap = len(query_keywords.intersection(doc_words))
        kw_score = min(1.0, overlap / (len(query_keywords) or 1.0))

        # Composite Rerank Score (Weighted)
        # Entity: 30%, Intent: 25%, Keyword: 25%, Base Vector: 20%
        final_score = (
            (entity_score * 0.30) +
            (intent_score * 0.25) +
            (kw_score * 0.25) +
            (base_score * 0.20)
        )

        reranked.append({
            "chunk_id": cand.get("id", "chunk_1"),
            "text": text,
            "metadata": meta,
            "score": round(final_score, 4),
            "matched_entity": target_entity if entity_score > 0.5 else None,
            "url": meta.get("url", ""),
            "title": meta.get("title", "Website Page")
        })

    # Sort descending by composite score
    reranked.sort(key=lambda x: x["score"], reverse=True)
    return reranked[:top_n]
