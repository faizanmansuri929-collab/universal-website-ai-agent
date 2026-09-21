import re
from typing import Dict, Any, Optional

TYPO_REPLACEMENTS = {
    r"\bcrouse\b": "course",
    r"\bcourses\b": "courses",
    r"\bcouse\b": "course",
    r"\bcorses\b": "courses",
    r"\baddmission\b": "admission",
    r"\baddmision\b": "admission",
    r"\badmision\b": "admission",
    r"\bfeee\b": "fees",
    r"\bplcmnt\b": "placement",
    r"\bplacment\b": "placement",
    r"\bdept\b": "department",
    r"\bfaculti\b": "faculty",
    r"\blocaton\b": "location",
    r"\bcntact\b": "contact",
    r"\bphoe\b": "phone",
    r"\bnumbr\b": "number",
    r"\bdocter\b": "doctor",
    r"\bdocters\b": "doctors",
    r"\bpricng\b": "pricing",
    r"\bprce\b": "price"
}

def analyze_user_query(query: str, sector: str = "general") -> Dict[str, Any]:
    """
    Analyzes user question, corrects typos, and extracts:
    - cleaned_query
    - intent
    - entity_type
    - entity
    - keywords
    - applied_filters
    """
    cleaned = query.strip()
    for pattern, replacement in TYPO_REPLACEMENTS.items():
        cleaned = re.sub(pattern, replacement, cleaned, flags=re.IGNORECASE)

    q_lower = cleaned.lower()
    words = re.findall(r"\w+", q_lower)

    intent = "general_inquiry"
    entity_type = None
    entity = None
    applied_filters = {}

    # Sector Aware Intent Mapping
    if sector == "college" or any(w in q_lower for w in ["course", "fee", "admission", "b.tech", "degree", "program", "college", "placement", "exam", "faculty", "leave", "hostel", "timetable"]):
        if any(w in q_lower for w in ["counselor", "book call", "book counselor", "speak with advisor", "talk to advisor", "campus tour", "request callback"]):
            intent = "counselor_booking"
            entity_type = "counselor"
        elif any(w in q_lower for w in ["exam", "timetable", "admit card", "semester exam", "backlog", "re-evaluation", "attendance", "75%"]):
            intent = "student_exam_timetable"
            entity_type = "student_support"
        elif any(w in q_lower for w in ["leave policy", "casual leave", "medical leave", "duty leave", "research grant", "reimbursement", "faculty", "handbook", "hr policy", "exam duty"]):
            intent = "faculty_policy_inquiry"
            entity_type = "faculty_policy"
        elif any(w in q_lower for w in ["course", "program", "degree", "branch", "specialization", "b.tech", "m.tech", "mba", "bba", "bca", "mca", "cse", "data science"]):
            intent = "course_inquiry"
            entity_type = "course"
        elif any(w in q_lower for w in ["fee", "fees", "cost", "scholarship", "tuition", "instalment"]):
            intent = "fee_inquiry"
            entity_type = "fee"
        elif any(w in q_lower for w in ["eligibility", "criteria", "cutoff", "minimum percentage", "pcm percentage", "entrance exam", "jee", "gate", "cat"]):
            intent = "eligibility_check"
            entity_type = "eligibility"
        elif any(w in q_lower for w in ["admission", "apply", "application process", "intake", "registration", "seat"]):
            intent = "admission_process"
            entity_type = "admission"
        elif any(w in q_lower for w in ["placement", "package", "salary", "recruiter", "company", "companies", "highest package", "average package"]):
            intent = "placement_record"
            entity_type = "placement"
        elif any(w in q_lower for w in ["hostel", "accommodation", "room", "mess", "curfew", "gate pass"]):
            intent = "hostel_inquiry"
            entity_type = "hostel"
        elif any(w in q_lower for w in ["contact", "address", "phone", "email", "location"]):
            intent = "contact_info"
            entity_type = "contact"

    elif sector == "hospital" or any(w in q_lower for w in ["doctor", "treatment", "cardiologist", "hospital", "opd", "appointment"]):
        if any(w in q_lower for w in ["doctor", "dr", "physician", "surgeon"]):
            intent = "doctor_search"
            entity_type = "doctor"
        elif any(w in q_lower for w in ["timing", "timings", "available", "schedule", "hour", "hours"]):
            intent = "timing_check"
            entity_type = "timing"
        elif any(w in q_lower for w in ["emergency", "ambulance", "icu", "trauma"]):
            intent = "emergency_info"
            entity_type = "emergency"
        elif any(w in q_lower for w in ["department", "cardiology", "neurology", "orthopedic"]):
            intent = "department_search"
            entity_type = "department"

    elif sector == "saas" or any(w in q_lower for w in ["pricing", "plan", "feature", "integration", "api"]):
        if any(w in q_lower for w in ["price", "pricing", "cost", "plan", "subscription", "tier"]):
            intent = "pricing_inquiry"
            entity_type = "pricing_plan"
        elif any(w in q_lower for w in ["feature", "capabilities", "what can you do"]):
            intent = "feature_check"
            entity_type = "feature"
        elif any(w in q_lower for w in ["api", "integration", "webhook", "sdk"]):
            intent = "integration_support"
            entity_type = "integration"

    elif sector == "manufacturing" or any(w in q_lower for w in ["spec", "specification", "model", "quote", "rfq", "warranty"]):
        if any(w in q_lower for w in ["spec", "specification", "dimension", "tolerance", "datasheet"]):
            intent = "product_spec"
            entity_type = "specification"
        elif any(w in q_lower for w in ["quote", "rfq", "price", "order", "distributor"]):
            intent = "rfq_quote"
            entity_type = "product"

    # Greeting check
    if q_lower in ["hello", "hi", "hey", "greetings", "good morning", "good afternoon", "good evening", "who are you"]:
        intent = "greeting"

    # Specific Entity Extraction from Query
    if "computer science" in q_lower:
        entity = "Computer Science Engineering"
    elif "artificial intelligence" in q_lower or "ai" in words:
        entity = "Artificial Intelligence & Data Science"
    elif "iot" in words or "internet of things" in q_lower:
        entity = "Internet of Things (IoT)"

    if entity_type:
        applied_filters["entity_type"] = entity_type

    return {
        "cleaned_query": cleaned,
        "sector": sector,
        "intent": intent,
        "entity_type": entity_type,
        "entity": entity,
        "keywords": words,
        "applied_filters": applied_filters
    }
