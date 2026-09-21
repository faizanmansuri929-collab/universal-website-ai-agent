import json
import re
from typing import Dict, Any, List, Optional
from app.core.config import settings
from app.services.hardcoded.templates import get_sector_template
from app.services.llm.provider import get_llm_provider

SYSTEM_PROMPT = """You are generating a deterministic FAQ / intent dataset for a website chatbot.

CRITICAL GROUNDING RULES:
1. Use ONLY the supplied website content.
2. Do NOT invent or hallucinate information (no fake fees, fake doctors, fake dates, fake pricing, or fake phone numbers).
3. If the website does not contain the information for a given intent:
   - Either omit the FAQ completely OR set "answer_available": false with a neutral message ("Information not available on website").
4. Return VALID JSON ONLY. No markdown formatting, no explanations, no wrapping in code blocks if possible.
5. Create multiple natural language variations of each question (at least 3-5 variations per FAQ).
6. Each answer must be concise, factual, and strictly grounded in the supplied text.
7. Attach the exact source URL for every answer where the info was found.
8. When available, specify a Call-To-Action (cta) object with "label" and "url" using real links from the site.

JSON OUTPUT SCHEMA:
{
  "sector": "detected_sector_key",
  "bot_name": "Organization Name Assistant",
  "welcome_message": "...",
  "faqs": [
    {
      "id": "faq_001",
      "intent": "intent_identifier",
      "category": "Category Name",
      "priority": 10,
      "questions": [
        "Primary question variation 1?",
        "Alternative question variation 2?",
        "Alternative question variation 3?"
      ],
      "answer": "Concise, grounded answer based strictly on website text.",
      "source_urls": ["https://example.com/page"],
      "cta": {
        "label": "Action Button Label",
        "url": "https://example.com/target"
      },
      "answer_available": true
    }
  ]
}
"""

async def generate_hardcoded_faq_dataset(
    website_url: str,
    sector: str,
    crawled_pages: List[Dict[str, Any]],
    bot_name: Optional[str] = None
) -> Dict[str, Any]:
    """
    Sends processed website pages & sector template to OpenAI once to produce
    a deterministic JSON FAQ / intent dataset.
    """
    template = get_sector_template(sector)
    
    # 1. Prepare summarized/cleaned content snippets from pages (up to ~18,000 chars to stay safely within context)
    content_snippets = []
    total_len = 0
    max_len = 22000
    
    for page in crawled_pages[:25]:
        p_url = page.get("url", "")
        p_title = page.get("title", "")
        p_text = (page.get("content_text") or "")[:2000]
        if not p_text.strip():
            continue
        snippet = f"--- PAGE: {p_title} ({p_url}) ---\n{p_text}\n"
        if total_len + len(snippet) > max_len:
            break
        content_snippets.append(snippet)
        total_len += len(snippet)

    combined_content = "\n".join(content_snippets)
    
    user_prompt = f"""
Detected Sector: {sector} ({template.get('display_name', '')})
Website URL: {website_url}
Suggested Bot Name: {bot_name or 'Website Assistant'}

RECOMMENDED INTENTS & TOPICS TO COVER FOR THIS SECTOR:
{json.dumps(template.get('intents', []), indent=2)}

WEBSITE CONTENT EXTRACTS:
{combined_content}

Instructions:
Extract all factual answers for the recommended sector topics from the website content extracts above.
Output the complete dataset matching the exact JSON format specified.
"""

    llm = get_llm_provider()
    
    try:
        response_text = await llm.generate_response(user_prompt, SYSTEM_PROMPT)
        dataset = _clean_and_parse_json(response_text)
        
        # Verify valid structure
        if dataset and isinstance(dataset, dict) and "faqs" in dataset and len(dataset["faqs"]) > 0:
            # Ensure sector and bot_name fields exist
            if "sector" not in dataset or not dataset["sector"]:
                dataset["sector"] = sector
            if "bot_name" not in dataset or not dataset["bot_name"]:
                dataset["bot_name"] = bot_name or f"{sector.capitalize()} Assistant"
            return dataset
    except Exception as e:
        print(f"[HardcodedGenerator] LLM JSON generation error: {e}")

    # Fallback to deterministic local extraction if LLM is unavailable or JSON failed
    return _generate_local_fallback_dataset(website_url, sector, template, crawled_pages, bot_name)


def _clean_and_parse_json(raw_text: str) -> Optional[Dict[str, Any]]:
    """Clean markdown code fences and parse JSON robustly."""
    if not raw_text:
        return None
    cleaned = raw_text.strip()
    # Remove markdown ```json ... ```
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    cleaned = cleaned.strip()

    try:
        return json.loads(cleaned)
    except Exception:
        # Try extracting innermost JSON object {...}
        match = re.search(r"\{[\s\S]*\}", cleaned)
        if match:
            try:
                return json.loads(match.group(0))
            except Exception:
                pass
    return None


def _generate_local_fallback_dataset(
    website_url: str,
    sector: str,
    template: Dict[str, Any],
    crawled_pages: List[Dict[str, Any]],
    bot_name: Optional[str] = None
) -> Dict[str, Any]:
    """
    Deterministic offline generator using sector templates and keyword matching
    across crawled content.
    """
    faqs = []
    faq_counter = 1

    # Extract available links from crawled pages
    all_urls = [p.get("url", website_url) for p in crawled_pages if p.get("url")]
    page_texts = {p.get("url", website_url): (p.get("content_text") or "") for p in crawled_pages}

    for item in template.get("intents", []):
        intent = item["intent"]
        category = item["category"]
        questions = item.get("sample_questions", [])
        priority = item.get("priority", 5)

        # Search for matching content in crawled pages
        matched_answer = ""
        matched_url = website_url

        keywords = [w.lower() for w in re.findall(r"\w+", intent.replace("_", " "))]
        for p_url, p_text in page_texts.items():
            text_lower = p_text.lower()
            if any(k in text_lower for k in keywords if len(k) > 3):
                # Extract 2-3 relevant sentences
                sentences = re.split(r"(?<=[.!?])\s+", p_text)
                relevant_sentences = [s.strip() for s in sentences if any(k in s.lower() for k in keywords if len(k) > 3)]
                if relevant_sentences:
                    matched_answer = " ".join(relevant_sentences[:3])
                    matched_url = p_url
                    break

        if not matched_answer:
            # Check if there is general text available on first page
            first_page_text = list(page_texts.values())[0] if page_texts else ""
            if first_page_text:
                matched_answer = first_page_text[:350].strip() + "..."
            else:
                matched_answer = f"Information regarding {item.get('description', intent)} is available on our official website."

        faq_entry = {
            "id": f"faq_{faq_counter:03d}",
            "intent": intent,
            "category": category,
            "priority": priority,
            "questions": questions,
            "answer": matched_answer,
            "source_urls": [matched_url],
            "cta": {
                "label": template.get("default_cta", {}).get("label", "Learn More"),
                "url": matched_url
            },
            "answer_available": True
        }
        faqs.append(faq_entry)
        faq_counter += 1

    return {
        "sector": sector,
        "bot_name": bot_name or f"{template.get('display_name', 'Website').split('/')[0].strip()} Assistant",
        "welcome_message": template.get("welcome_message", "Welcome! How may I assist you today?"),
        "faqs": faqs
    }
