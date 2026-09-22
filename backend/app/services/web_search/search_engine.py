import re
import json
import asyncio
from typing import List, Dict, Any, Tuple, Optional
from sqlalchemy.orm import Session
from app.models.schemas import WebSearchSourceDB, WebSearchConfigDB
from app.services.web_search.intent_router import classify_poornima_intent
from app.services.web_search.fetcher import fetch_poornima_page
from app.services.web_search.allowlist import is_allowed_domain_url
from app.services.llm.provider import get_llm_provider

async def select_and_fetch_poornima_sources(
    user_message: str,
    history: Optional[List[Dict[str, str]]] = None,
    db: Optional[Session] = None,
    max_sources: int = 3
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], Dict[str, Any], str]:
    """
    1. Understands user query & detects Poornima intent.
    2. Uses AI Decision + Allowlist Scoring to select top 1-3 most relevant Poornima official URLs.
    3. Performs live web fetch on those selected URLs.
    4. Returns (candidate_sources, selected_sources_with_content, intent_info, ai_selection_reason).
    """
    history = history or []
    intent_info = classify_poornima_intent(user_message, history)
    
    if intent_info.get("is_off_topic"):
        return [], [], intent_info, "Query classified as off-topic (outside Poornima domain)."

    # 1. Fetch active allowlist sources from database
    active_sources = db.query(WebSearchSourceDB).filter(WebSearchSourceDB.is_enabled == 1).all() if db else []
    if not active_sources:
        return [], [], intent_info, "No active sources found in allowlist."

    # 2. Score and rank candidates based on query tokens & intent
    query_lower = user_message.lower()
    query_tokens = set(re.findall(r'\b\w+\b', query_lower))
    target_categories = set(intent_info.get("target_categories", []))

    scored_candidates = []
    for src in active_sources:
        if not is_allowed_domain_url(src.url):
            continue
        
        url_lower = src.url.lower()
        title_lower = (src.title or "").lower()
        snippet_lower = (src.content_snippet or "").lower()

        score = 0.0

        # Category match
        if src.category in target_categories:
            score += 3.0

        # Title keyword match
        title_tokens = set(re.findall(r'\b\w+\b', title_lower))
        overlap = query_tokens.intersection(title_tokens)
        score += len(overlap) * 2.5

        # URL slug match
        url_tokens = set(re.findall(r'\b\w+\b', url_lower.replace("https", "").replace("www", "").replace("poornima", "").replace("org", "")))
        url_overlap = query_tokens.intersection(url_tokens)
        score += len(url_overlap) * 3.0

        # Snippet/keywords overlap
        snippet_tokens = set(re.findall(r'\b\w+\b', snippet_lower))
        snip_overlap = query_tokens.intersection(snippet_tokens)
        score += len(snip_overlap) * 1.0

        # Specific high-priority intent boosters
        if intent_info["intent"] == "courses_btech" and "/btech-at-poornima" in url_lower:
            score += 4.0
            # If specific branch is mentioned
            for branch in ["cyber", "artificial", "data-science", "electrical", "civil", "mechanical", "information-technology", "computer-engineering"]:
                if branch in query_lower and branch in url_lower:
                    score += 6.0
        elif intent_info["intent"] == "placements_recruiters" and "placement" in url_lower:
            score += 5.0
            if "statistics" in query_lower and "statistics" in url_lower:
                score += 5.0
            if "recruiter" in query_lower and "recruiters" in url_lower:
                score += 5.0
        elif intent_info["intent"] == "hostel_mess" and "hostel" in url_lower:
            score += 5.0
            if "dining" in query_lower and "dining" in url_lower:
                score += 4.0
        elif intent_info["intent"] == "admissions_eligibility" and ("admission" in url_lower or "faqs" in url_lower):
            score += 5.0

        if score > 0 or src.category in target_categories:
            scored_candidates.append({
                "id": src.id,
                "url": src.url,
                "title": src.title or src.url,
                "category": src.category,
                "score": round(score, 2),
                "snippet": src.content_snippet or ""
            })

    # Sort descending by score
    scored_candidates.sort(key=lambda x: x["score"], reverse=True)
    top_candidates = scored_candidates[:8]

    if not top_candidates:
        # Fallback to general home/admissions/about
        top_candidates = [
            {"id": s.id, "url": s.url, "title": s.title, "category": s.category, "score": 1.0, "snippet": ""}
            for s in active_sources[:3]
        ]

    # 3. OpenAI Dynamic Link Selection (Select 1-3 best pages)
    selected_sources = []
    ai_reason = "Selected based on highest relevance score and intent alignment."

    # Try LLM-based intelligent selection if LLM available
    llm_provider = get_llm_provider()
    if hasattr(llm_provider, "primary_provider") and llm_provider.primary_provider and len(top_candidates) > 1:
        candidates_listing = "\n".join([
            f"- [{idx+1}] URL: {c['url']} | Title: {c['title']} | Category: {c['category']}"
            for idx, c in enumerate(top_candidates[:6])
        ])
        
        selection_prompt = f"""You are the URL selector for Poornima University / College Web Search.
User Question: "{user_message}"
Detected Intent: {intent_info['intent']}

Here are top candidate Poornima official URLs:
{candidates_listing}

Task:
Decide which 1 to {max_sources} URLs from the list above are MOST RELEVANT to answer the user's specific inquiry.
Do NOT choose more than {max_sources} URLs. If 1 or 2 pages are enough, select only 1 or 2.

Output strictly valid JSON with this exact format:
{{"selected_indexes": [1, 2], "reason": "brief reason for choice"}}"""

        try:
            llm_decision_raw = await llm_provider.generate_response(selection_prompt, system_instruction="You are a strict URL selection analyzer. Output JSON only.")
            clean_json = re.search(r'\{.*\}', llm_decision_raw, re.DOTALL)
            if clean_json:
                data = json.loads(clean_json.group(0))
                indexes = data.get("selected_indexes", [])
                ai_reason = data.get("reason", ai_reason)
                for idx in indexes:
                    if isinstance(idx, int) and 1 <= idx <= len(top_candidates):
                        cand = top_candidates[idx-1]
                        if cand not in selected_sources:
                            selected_sources.append(cand)
        except Exception as e:
            print(f"[SearchEngine] LLM URL selection fallback: {e}")

    # Ensure max_sources limit is strictly respected
    if selected_sources:
        selected_sources = selected_sources[:max_sources]

    # If LLM didn't select or fallback
    if not selected_sources:
        num_to_pick = min(max_sources, len(top_candidates))
        # If top score is substantially higher, pick top 1-2
        if len(top_candidates) >= 2 and top_candidates[0]["score"] >= 8.0 and top_candidates[1]["score"] < 4.0:
            num_to_pick = 1
        elif num_to_pick > 3:
            num_to_pick = 3
        selected_sources = top_candidates[:max(1, min(num_to_pick, max_sources))]

    # 4. Perform Live Web Search / Content Fetch on selected 1-3 URLs
    fetch_tasks = [fetch_poornima_page(s["url"], db) for s in selected_sources]
    fetched_results = await asyncio.gather(*fetch_tasks)

    # Attach fetched live content
    selected_sources_with_content = []
    for s, f in zip(selected_sources, fetched_results):
        selected_sources_with_content.append({
            "id": s["id"],
            "url": s["url"],
            "title": f.get("title") or s["title"],
            "category": s.get("category", "General"),
            "score": s.get("score", 1.0),
            "content": f.get("content", ""),
            "fetch_status": f.get("status", "FETCHED")
        })

    return top_candidates, selected_sources_with_content, intent_info, ai_reason
