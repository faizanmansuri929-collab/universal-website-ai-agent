import re
from typing import Tuple, Dict, Any, List

SECTOR_KEYWORDS = {
    "college": {
        "strong": ["university", "college", "institute of engineering", "institute of technology", "admissions", "campus", "academics", "faculty", "b.tech", "m.tech", "mba", "bba", "phd", "curriculum", "scholarship", "hostel", "placement cell", "degree", "diploma", "rtu affiliated", "aicte", "naac", "syllabus"],
        "medium": ["course", "courses", "student", "students", "departments", "exam", "education", "fees", "eligibility", "alumni", "programs", "undergraduate", "postgraduate"]
    },
    "hospital": {
        "strong": ["hospital", "medical center", "clinic", "healthcare", "cardiologist", "orthopedic", "pediatrician", "neurology", "radiology", "opd", "icu", "emergency care", "ambulance", "surgery", "doctor", "doctors", "patient care", "inpatient", "outpatient"],
        "medium": ["treatment", "treatments", "consultation", "medical", "appointment", "specialist", "specialization", "pharmacy", "diagnostic", "nursing", "timings", "insurance"]
    },
    "saas": {
        "strong": ["software", "saas", "api documentation", "pricing plan", "cloud platform", "developer", "sdk", "integrations", "free trial", "monthly plan", "annual billing", "enterprise plan", "changelog", "github", "web app", "data analytics", "predictive modeling", "business intelligence", "cfd simulation", "custom software development", "data engineering"],
        "medium": ["features", "product", "platform", "dashboard", "analytics", "security", "workflow", "automation", "solutions", "documentation", "support", "power bi", "python", "machine learning", "big data", "modelling", "consulting"]
    },
    "manufacturing": {
        "strong": ["manufacturing", "industrial", "machinery", "fabrication", "tolerance", "iso 9001", "datasheet", "rfq", "request for quote", "oem", "assembly", "raw material", "cnc", "production line", "distributor network"],
        "medium": ["specifications", "spec sheet", "products", "catalog", "models", "warranty", "materials", "dimensions", "factory", "engineering"]
    }
}

def detect_website_sector(text_sample: str, title: str = "", meta_desc: str = "") -> Tuple[str, float, str]:
    """
    Classifies website content into an industry sector with confidence and reason.
    Returns: (sector_name, confidence_score, reason)
    """
    combined_text = f"{title} {meta_desc} {text_sample}".lower()
    scores: Dict[str, float] = {"college": 0.0, "hospital": 0.0, "saas": 0.0, "manufacturing": 0.0}

    # 1. Schema.org keyword priority
    if "educationalorganization" in combined_text or "collegeoruniversity" in combined_text or "school" in combined_text:
        scores["college"] += 4.0
    if "hospital" in combined_text or "medicalclinic" in combined_text or "physician" in combined_text:
        scores["hospital"] += 4.0
    if "softwareapplication" in combined_text or "techarticle" in combined_text:
        scores["saas"] += 4.0

    # 2. Vocabulary scoring
    for sector, kw_dict in SECTOR_KEYWORDS.items():
        for kw in kw_dict["strong"]:
            matches = len(re.findall(r"\b" + re.escape(kw) + r"\b", combined_text))
            scores[sector] += matches * 1.5

        for kw in kw_dict["medium"]:
            matches = len(re.findall(r"\b" + re.escape(kw) + r"\b", combined_text))
            scores[sector] += matches * 0.5

    total_score = sum(scores.values())
    if total_score == 0:
        return "general", 0.70, "General organization website with standard business offerings."

    best_sector = max(scores, key=scores.get)
    best_score = scores[best_sector]
    confidence = min(0.98, max(0.65, round(best_score / total_score, 2)))

    reason_templates = {
        "college": "The website contains educational programs, degrees, course offerings, admissions, and campus information.",
        "hospital": "The website contains medical services, doctors, departments, treatments, and patient care details.",
        "saas": "The website contains software features, pricing tiers, cloud platform tools, and documentation.",
        "manufacturing": "The website contains industrial products, technical specifications, certifications, and manufacturing catalogs."
    }

    reason = reason_templates.get(best_sector, "Classified based on core content analysis.")
    return best_sector, confidence, reason
