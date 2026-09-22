import re
from typing import Dict, Any, List, Optional
from app.models.schemas import ChatMessage

INTENT_KEYWORD_MAP = {
    "courses_btech": [
        "b.tech", "btech", "course", "courses", "branch", "branches", "specialization",
        "specializations", "program", "programs", "computer science", "cse", "it",
        "civil", "mechanical", "electrical", "ece", "ai", "data science", "cyber security",
        "iot", "artificial intelligence", "degree", "b tech"
    ],
    "admissions_eligibility": [
        "admission", "admissions", "apply", "eligibility", "reap", "cutoff", "cutoffs",
        "criteria", "how to get admission", "admission process", "lateral entry",
        "direct admission", "management quota", "jee", "12th percentage"
    ],
    "fees_scholarships": [
        "fee", "fees", "fee structure", "tuition", "annual fee", "cost", "scholarship",
        "scholarships", "waiver", "concession", "merit scholarship", "installment", "pay online"
    ],
    "placements_recruiters": [
        "placement", "placements", "highest package", "average package", "package", "salary",
        "recruiter", "recruiters", "mnc", "companies", "tpo", "internship", "internships",
        "tcs", "infosys", "wipro", "capgemini", "job offer", "placement statistics"
    ],
    "hostel_mess": [
        "hostel", "hostels", "mess", "dining", "room", "rooms", "accommodation", "stay",
        "warden", "gym", "boys hostel", "girls hostel", "ac room", "cooler room", "food"
    ],
    "faculty_management": [
        "faculty", "professors", "teachers", "chairman", "director", "management",
        "hod", "deans", "mentors", "chancellor", "leadership"
    ],
    "infrastructure_labs": [
        "infrastructure", "labs", "laboratory", "workshop", "auditorium", "campus building",
        "smart classroom", "practical lab", "library", "sports complex"
    ],
    "academic_calendar_exams": [
        "academic calendar", "calendar", "exam", "exams", "semester", "datesheet",
        "holidays", "vacation", "mid term", "schedule"
    ],
    "forms_student_resources": [
        "form", "forms", "download forms", "study materials", "notes", "archive",
        "syllabus", "bonafide", "transcript", "grievance", "anti ragging"
    ],
    "contact_location": [
        "contact", "phone", "mobile", "helpline", "email", "address", "location",
        "where is", "sitapura", "jaipur campus", "reach"
    ],
    "events_fests": [
        "event", "events", "fest", "cultural", "aarohan", "lakshya", "hackathon",
        "sports fest", "technical events", "conference", "conferences", "etmepp", "icsme"
    ],
    "about_history_accreditation": [
        "about", "history", "legacy", "accreditation", "naac", "aicte", "rtu",
        "nba", "ranking", "philosophy", "foundation", "poornima advantage"
    ]
}


def classify_poornima_intent(user_message: str, history: Optional[List[Dict[str, str]]] = None) -> Dict[str, Any]:
    """
    Classifies the user query into Poornima-specific intents, resolves follow-up context,
    and builds an optimized site-restricted search query.
    """
    history = history or []
    clean_msg = user_message.strip()
    lower_msg = clean_msg.lower()

    # Context resolution from previous turn
    context_keywords = []
    if history:
        last_turn = history[-2:] # last 1-2 messages
        for item in last_turn:
            txt = (item.get("content") or "").lower()
            if any(k in txt for k in ["b.tech", "btech", "cse", "course", "branch"]):
                context_keywords.append("B.Tech")
            if any(k in txt for k in ["placement", "package", "recruiter"]):
                context_keywords.append("Placement")
            if any(k in txt for k in ["hostel", "mess", "room"]):
                context_keywords.append("Hostel")
            if any(k in txt for k in ["admission", "eligibility", "reap"]):
                context_keywords.append("Admission")

    # Resolve anaphora / follow-up phrases (e.g. "Which one is related to AI?", "What about hostel fees?", "And placements?")
    is_follow_up = bool(re.search(r'\b(which one|what about|and for|how much for|tell me more|is there any|where is it)\b', lower_msg))
    
    # Score each intent
    intent_scores = {}
    for intent, kw_list in INTENT_KEYWORD_MAP.items():
        score = 0
        for kw in kw_list:
            if " " in kw:
                if kw in lower_msg:
                    score += 3
            else:
                if re.search(r'\b' + re.escape(kw) + r'\b', lower_msg):
                    score += 2
        intent_scores[intent] = score

    # Determine primary intent
    best_intent = "general"
    max_score = 0
    for intent, score in intent_scores.items():
        if score > max_score:
            max_score = score
            best_intent = intent

    # Check for greeting or off-topic indicators
    if lower_msg in ["hi", "hello", "hey", "namaste", "good morning", "good afternoon", "good evening", "hii", "helloo"]:
        return {
            "intent": "greeting",
            "search_query": "Poornima University overview programs admissions site:poornima.org",
            "is_greeting": True,
            "is_off_topic": False,
            "target_categories": ["Home", "Courses", "Admissions"]
        }

    # Off-topic filter
    off_topic_patterns = [
        r'\b(harvard|stanford|iit bombay|iit delhi|vit vellore|manipal|bits pilani|amity|lpu|sharda)\b',
        r'\b(weather in|prime minister|president of|bitcoin|stock market|ipl score|cricket match)\b',
        r'\b(recipe|movie review|hollywood|bollywood news|iphone 16)\b'
    ]
    for otp in off_topic_patterns:
        if re.search(otp, lower_msg) and "poornima" not in lower_msg:
            return {
                "intent": "off_topic",
                "search_query": "",
                "is_greeting": False,
                "is_off_topic": True,
                "target_categories": []
            }

    # Build optimized search query
    search_terms = ["Poornima"]
    if context_keywords and is_follow_up:
        search_terms.extend(context_keywords)
    
    # Clean tokens
    cleaned_tokens = [w for w in re.findall(r'[a-zA-Z0-9_\-\+]+', clean_msg) if len(w) > 1 and w.lower() not in ["what", "is", "the", "are", "of", "for", "in", "to", "and", "do", "you", "provide", "give", "tell", "me", "about", "which"]]
    search_terms.extend(cleaned_tokens[:6])
    
    optimized_query = f"{' '.join(search_terms)} site:poornima.org"

    category_map = {
        "courses_btech": ["Courses", "Admissions"],
        "admissions_eligibility": ["Admissions", "Courses"],
        "fees_scholarships": ["Admissions", "Courses"],
        "placements_recruiters": ["Placements", "About"],
        "hostel_mess": ["Hostels", "Campus Life"],
        "faculty_management": ["Faculty", "About"],
        "infrastructure_labs": ["Infrastructure", "Campus Life"],
        "academic_calendar_exams": ["Students"],
        "forms_student_resources": ["Students", "Policies"],
        "contact_location": ["Contact", "About"],
        "events_fests": ["Events", "Campus Life"],
        "about_history_accreditation": ["About", "Policies"]
    }

    return {
        "intent": best_intent,
        "search_query": optimized_query,
        "is_greeting": False,
        "is_off_topic": False,
        "target_categories": category_map.get(best_intent, ["General", "Home", "Courses", "Admissions"])
    }
