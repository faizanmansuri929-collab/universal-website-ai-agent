import re
import difflib
from typing import List, Dict, Any, Optional, Tuple

STOP_WORDS = {
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "shall", "should",
    "can", "could", "may", "might", "must", "and", "or", "but", "if", "then",
    "else", "when", "at", "from", "by", "for", "with", "about", "against",
    "between", "into", "through", "during", "before", "after", "above", "below",
    "to", "of", "in", "on", "off", "over", "under", "again", "further", "then",
    "once", "here", "there", "all", "any", "both", "each", "few", "more", "most",
    "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so",
    "than", "too", "very", "s", "t", "just", "don", "now", "i", "me", "my",
    "myself", "we", "our", "ours", "you", "your", "yours", "he", "him", "his",
    "she", "her", "hers", "it", "its", "they", "them", "their", "what", "which",
    "who", "whom", "this", "that", "these", "those", "am", "tell", "give", "please",
    "want", "know", "how", "where", "why"
}

def normalize_text(text: str) -> str:
    """Normalizes text by lowercasing and stripping punctuation."""
    text = (text or "").lower().strip()
    text = re.sub(r"[^\w\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()

def extract_keywords(text: str) -> List[str]:
    """Extracts non-stopword tokens from normalized text."""
    normalized = normalize_text(text)
    tokens = normalized.split()
    return [t for t in tokens if len(t) > 2 and t not in STOP_WORDS]

class MatchResult:
    def __init__(
        self,
        matched: bool,
        faq: Optional[Dict[str, Any]] = None,
        score: float = 0.0,
        match_type: str = "none",
        matched_question: str = ""
    ):
        self.matched = matched
        self.faq = faq
        self.score = score
        self.match_type = match_type
        self.matched_question = matched_question

def match_query_to_faqs(
    user_query: str,
    faqs: List[Dict[str, Any]],
    threshold: float = 0.40
) -> MatchResult:
    """
    Fast, deterministic runtime matching algorithm against saved predefined FAQs.
    Zero LLM calls.
    """
    if not user_query or not faqs:
        return MatchResult(matched=False, score=0.0)

    clean_query = normalize_text(user_query)
    query_keywords = extract_keywords(user_query)

    best_faq: Optional[Dict[str, Any]] = None
    best_score: float = 0.0
    best_match_type: str = "none"
    best_matched_q: str = ""

    for faq in faqs:
        # Check answer availability
        if not faq.get("answer_available", True):
            continue

        faq_questions = faq.get("questions") or []
        intent_name = (faq.get("intent") or "").replace("_", " ").lower()
        category_name = (faq.get("category") or "").lower()
        priority_weight = min(faq.get("priority", 1) / 10.0, 1.2)

        # 1. Exact Match Check
        for q in faq_questions:
            clean_q = normalize_text(q)
            if clean_query == clean_q:
                return MatchResult(
                    matched=True,
                    faq=faq,
                    score=1.0 * priority_weight,
                    match_type="exact",
                    matched_question=q
                )

        # 2. Intent / Substring direct match
        if clean_query in intent_name or intent_name in clean_query:
            score = 0.85 * priority_weight
            if score > best_score:
                best_score = score
                best_faq = faq
                best_match_type = "intent_exact"
                best_matched_q = faq_questions[0] if faq_questions else intent_name

        # 3. Fuzzy Similarity & Keyword Overlap across all question variations
        for q in faq_questions:
            clean_q = normalize_text(q)
            q_keywords = extract_keywords(q)

            # SequenceMatcher Fuzzy Ratio
            fuzzy_ratio = difflib.SequenceMatcher(None, clean_query, clean_q).ratio()

            # Keyword Jaccard / Overlap Ratio
            if query_keywords and q_keywords:
                overlap = set(query_keywords).intersection(set(q_keywords))
                overlap_ratio = len(overlap) / float(len(set(query_keywords).union(set(q_keywords))))
                keyword_recall = len(overlap) / float(len(query_keywords))
            else:
                overlap_ratio = 0.0
                keyword_recall = 0.0

            # Boost if category or intent keywords match
            domain_bonus = 0.0
            if any(k in category_name or k in intent_name for k in query_keywords):
                domain_bonus = 0.15

            combined_score = (fuzzy_ratio * 0.45) + (keyword_recall * 0.40) + (overlap_ratio * 0.15) + domain_bonus
            combined_score = combined_score * (0.8 + 0.2 * priority_weight)

            if combined_score > best_score:
                best_score = combined_score
                best_faq = faq
                best_match_type = "fuzzy_keyword"
                best_matched_q = q

    if best_faq and best_score >= threshold:
        return MatchResult(
            matched=True,
            faq=best_faq,
            score=min(best_score, 1.0),
            match_type=best_match_type,
            matched_question=best_matched_q
        )

    return MatchResult(
        matched=False,
        faq=None,
        score=best_score,
        match_type="none"
    )
