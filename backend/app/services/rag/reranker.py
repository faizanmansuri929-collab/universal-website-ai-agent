import re
from typing import List, Dict, Any

def rerank_candidate_chunks(
    candidates: List[Dict[str, Any]],
    query_analysis: Dict[str, Any],
    top_n: int = 5
) -> List[Dict[str, Any]]:
    """
    Reranks candidate chunks using multi-factor scoring with Source Priority Hierarchy:
    1. Official Structured Data & Real Website Pages (Highest Priority)
    2. Official / Demo Documents for Faculty/Staff Policy Inquiries
    3. Demo Student Support Data for Timetable/Exams (fills gaps when real data is absent)
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
        source_type = meta.get("source_type") or ("DEMO_DOCUMENT" if "DEMO DOCUMENT" in text or "faculty" in meta.get("url", "") else "DEMO_DATA" if "DEMO DATA" in text or "demo" in meta.get("url", "") else "REAL_WEBSITE")

        # 1. Entity Match Score (0.0 to 1.0)
        entity_score = 0.0
        if target_entity and target_entity in text_lower:
            entity_score = 1.0
        elif target_entity_type and target_entity_type in text_lower:
            entity_score = 0.75

        # 2. Intent Match Score (0.0 to 1.0)
        intent_score = 0.0
        if target_intent in ("course_inquiry", "admission_process") and any(w in text_lower for w in ["b.tech", "m.tech", "mba", "course", "degree", "branch", "engineering", "admission", "eligibility"]):
            intent_score = 1.0
        elif target_intent == "fee_inquiry" and any(w in text_lower for w in ["fee", "fees", "cost", "scholarship", "tuition"]):
            intent_score = 1.0
        elif target_intent == "placement_record" and any(w in text_lower for w in ["placement", "package", "recruiter", "lpa", "salary"]):
            intent_score = 1.0
        elif target_intent == "student_exam_timetable" and any(w in text_lower for w in ["exam", "timetable", "admit card", "semester", "attendance", "75%"]):
            intent_score = 1.0
        elif target_intent == "faculty_policy_inquiry" and any(w in text_lower for w in ["leave", "casual leave", "medical leave", "reimbursement", "research", "faculty", "handbook"]):
            intent_score = 1.0
        elif target_intent == "contact_info" and any(w in text_lower for w in ["address", "phone", "email", "telephone"]):
            intent_score = 1.0

        # 3. Keyword Overlap
        doc_words = set(re.findall(r"\w+", text_lower))
        overlap = len(query_keywords.intersection(doc_words))
        kw_score = min(1.0, overlap / (len(query_keywords) or 1.0))

        # 4. Source Priority Multiplier
        source_priority = 1.0
        if target_intent == "faculty_policy_inquiry" and source_type == "DEMO_DOCUMENT":
            source_priority = 1.25
        elif target_intent in ("student_exam_timetable", "student_support") and source_type == "DEMO_DATA":
            source_priority = 1.20
        elif source_type == "REAL_WEBSITE":
            source_priority = 1.15
        elif source_type in ("DEMO_DATA", "DEMO_DOCUMENT"):
            source_priority = 0.85 # De-prioritize demo data for general real website questions

        # Composite Rerank Score (Weighted)
        raw_composite = (
            (entity_score * 0.30) +
            (intent_score * 0.30) +
            (kw_score * 0.20) +
            (base_score * 0.20)
        )
        final_score = round(min(1.0, raw_composite * source_priority), 4)

        reranked.append({
            "chunk_id": cand.get("id", "chunk_1"),
            "text": text,
            "metadata": meta,
            "score": final_score,
            "source_type": source_type,
            "matched_entity": target_entity if entity_score > 0.5 else None,
            "url": meta.get("url", ""),
            "title": meta.get("title", "Website Page")
        })

    # Sort descending by composite score
    reranked.sort(key=lambda x: x["score"], reverse=True)
    return reranked[:top_n]
