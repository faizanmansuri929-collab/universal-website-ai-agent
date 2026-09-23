import uuid
import datetime
from urllib.parse import urlparse
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.schemas import (
    WebSearchSourceDB, WebSearchConfigDB,
    CollegeWebSearchProjectDB, CollegeWebSourceDB
)

ALLOWED_DOMAIN = "poornima.org"

INITIAL_73_POORNIMA_SOURCES = [
    {
        "url": "https://www.poornima.org/",
        "title": "Poornima Group of Colleges & University - Official Home",
        "category": "Home",
        "keywords": ["home", "main", "overview", "poornima group", "university", "campus"]
    },
    {
        "url": "https://www.poornima.org/about-us/chairman-message",
        "title": "Chairman's Message - Poornima Leadership",
        "category": "About",
        "keywords": ["chairman", "message", "leadership", "vision", "founder"]
    },
    {
        "url": "https://www.poornima.org/about-us/management",
        "title": "Management & Governing Council - Poornima",
        "category": "About",
        "keywords": ["management", "director", "governing body", "administration"]
    },
    {
        "url": "https://www.poornima.org/about-us/history-of-poornima",
        "title": "History & Legacy of Poornima Group",
        "category": "About",
        "keywords": ["history", "establishment", "legacy", "foundation", "heritage"]
    },
    {
        "url": "https://www.poornima.org/social-media-digital-conduct-policy",
        "title": "Social Media & Digital Conduct Policy",
        "category": "Policies",
        "keywords": ["social media", "conduct", "policy", "digital", "guidelines"]
    },
    {
        "url": "https://www.poornima.org/about-us/affiliation-accreditation",
        "title": "Affiliation & Accreditation - RTU, AICTE, NAAC, NBA",
        "category": "About",
        "keywords": ["affiliation", "accreditation", "naac", "aicte", "rtu kota", "nba", "ugc"]
    },
    {
        "url": "https://www.poornima.org/about-us/poornima-philosophy",
        "title": "Poornima Philosophy & Core Values",
        "category": "About",
        "keywords": ["philosophy", "values", "mission", "vision", "culture"]
    },
    {
        "url": "https://www.poornima.org/about-us/poornima-faculties",
        "title": "Faculty & Academic Mentors Directory",
        "category": "Faculty",
        "keywords": ["faculty", "professors", "teachers", "academic staff", "mentors"]
    },
    {
        "url": "https://www.poornima.org/about-us/poornima-advantage",
        "title": "The Poornima Advantage - Why Choose Poornima",
        "category": "About",
        "keywords": ["advantage", "why choose", "benefits", "special features", "ranking"]
    },
    {
        "url": "https://www.poornima.org/about-us/value-added-programs-with-ibm",
        "title": "Value Added Industry Programs with IBM & Global Partners",
        "category": "Courses",
        "keywords": ["ibm", "value added", "certifications", "industry collaboration", "cloud", "ai"]
    },
    {
        "url": "https://www.poornima.org/admission/btech-at-poornima-group-of-colleges",
        "title": "B.Tech Admission Procedure & Eligibility 2026",
        "category": "Admissions",
        "keywords": ["admission", "btech admission", "apply", "reap", "eligibility", "process", "criteria", "fees"]
    },
    {
        "url": "https://www.poornima.org/admission/b-tech-lateral-entry",
        "title": "B.Tech Lateral Entry (Direct 2nd Year) Admissions",
        "category": "Admissions",
        "keywords": ["lateral entry", "diploma", "direct second year", "b.sc", "btech lateral"]
    },
    {
        "url": "https://www.poornima.org/admission/m-tech",
        "title": "M.Tech Post-Graduate Admissions & Specializations",
        "category": "Admissions",
        "keywords": ["mtech", "post graduate", "masters", "gate", "m.tech admission"]
    },
    {
        "url": "https://www.poornima.org/contact-us",
        "title": "Contact Poornima - Campus Address, Helpline & Email",
        "category": "Contact",
        "keywords": ["contact", "address", "helpline", "phone number", "email", "location", "sitapura jaipur"]
    },
    {
        "url": "https://www.poornima.org/updates",
        "title": "Latest News, Circulars & Campus Updates",
        "category": "News",
        "keywords": ["updates", "news", "announcements", "circulars", "notifications"]
    },
    {
        "url": "https://www.poornima.org/placement",
        "title": "Training & Placement Cell - Career Overview",
        "category": "Placements",
        "keywords": ["placement", "careers", "tpo", "jobs", "training", "salary package", "highest package"]
    },
    {
        "url": "https://www.poornima.org/current-students",
        "title": "Current Students Portal & Resources",
        "category": "Students",
        "keywords": ["students", "portal", "student life", "resources", "notices"]
    },
    {
        "url": "https://www.poornima.org/hostel/basic-essentials",
        "title": "Campus Hostels - Room Types & Basic Essentials",
        "category": "Hostels",
        "keywords": ["hostel", "rooms", "accommodation", "boys hostel", "girls hostel", "facilities", "ac cooler"]
    },
    {
        "url": "https://www.poornima.org/placement/recruiters",
        "title": "Top Recruiters & MNC Hiring Partners",
        "category": "Placements",
        "keywords": ["recruiters", "companies", "mncs", "tcs", "infosys", "wipro", "capgemini", "morgan stanley"]
    },
    {
        "url": "https://www.poornima.org/faculty",
        "title": "Distinguished Faculty Members & Departments",
        "category": "Faculty",
        "keywords": ["faculty", "hod", "professors", "departments", "teaching staff"]
    },
    {
        "url": "https://www.poornima.org/gallery",
        "title": "Campus Photo & Video Gallery",
        "category": "Campus Life",
        "keywords": ["gallery", "photos", "campus pictures", "images"]
    },
    {
        "url": "https://www.poornima.org/gallery/practical-lab",
        "title": "Practical Laboratories & High-Tech Labs",
        "category": "Infrastructure",
        "keywords": ["labs", "laboratory", "practical", "computer lab", "hardware", "iot lab"]
    },
    {
        "url": "https://www.poornima.org/gallery/workshop",
        "title": "Engineering Workshops & Fabrication Labs",
        "category": "Infrastructure",
        "keywords": ["workshop", "mechanical workshop", "fabrication", "lathe", "carpentry"]
    },
    {
        "url": "https://www.poornima.org/gallery/infrastructure",
        "title": "Campus Infrastructure, Classrooms & Auditoriums",
        "category": "Infrastructure",
        "keywords": ["infrastructure", "classrooms", "auditorium", "smart classes", "campus building"]
    },
    {
        "url": "https://www.poornima.org/gallery/conferences",
        "title": "International Conferences & Research Symposia",
        "category": "Events",
        "keywords": ["conferences", "research", "seminars", "symposia", "papers"]
    },
    {
        "url": "https://www.poornima.org/gallery/event",
        "title": "Annual Cultural & College Events (Lakshya / Aarohan)",
        "category": "Events",
        "keywords": ["events", "fest", "aarohan", "lakshya", "cultural fest", "celebrations"]
    },
    {
        "url": "https://www.poornima.org/gallery/sports",
        "title": "Sports Complex & Athletic Activities",
        "category": "Campus Life",
        "keywords": ["sports", "cricket", "football", "basketball", "gym", "athletics", "tournaments"]
    },
    {
        "url": "https://www.poornima.org/gallery/technical-events",
        "title": "Technical Fests, Hackathons & Coding Contests",
        "category": "Events",
        "keywords": ["technical events", "hackathons", "coding", "robotics", "tech fest"]
    },
    {
        "url": "https://www.poornima.org/faqs",
        "title": "Frequently Asked Questions (FAQs) - Poornima",
        "category": "Admissions",
        "keywords": ["faqs", "questions", "answers", "admission queries", "common questions"]
    },
    {
        "url": "https://www.poornima.org/anti-ragging",
        "title": "Anti-Ragging Policy & Student Safety Cell",
        "category": "Policies",
        "keywords": ["anti ragging", "safety", "helpline", "discipline", "ugc norms"]
    },
    {
        "url": "https://www.poornima.org/disclaimer",
        "title": "Official Disclaimer & Website Terms",
        "category": "Policies",
        "keywords": ["disclaimer", "legal", "official notice"]
    },
    {
        "url": "https://www.poornima.org/proud-parents",
        "title": "Parent Testimonials & Feedback",
        "category": "About",
        "keywords": ["parents", "testimonials", "feedback", "reviews"]
    },
    {
        "url": "https://www.poornima.org/recruiters-feedback",
        "title": "Corporate Recruiters' Reviews & Feedback",
        "category": "Placements",
        "keywords": ["recruiters feedback", "industry reviews", "corporate feedback"]
    },
    {
        "url": "https://www.poornima.org/staff-forms",
        "title": "Staff & Faculty Administrative Forms",
        "category": "Policies",
        "keywords": ["staff forms", "leave application", "reimbursement", "faculty portal"]
    },
    {
        "url": "https://www.poornima.org/grievance-cell",
        "title": "Online Grievance Redressal Mechanism",
        "category": "Policies",
        "keywords": ["grievance", "complaint", "redressal", "student help", "ombudsman"]
    },
    {
        "url": "https://www.poornima.org/terms-conditions",
        "title": "Terms & Conditions of Admission & Portal",
        "category": "Policies",
        "keywords": ["terms", "conditions", "regulations", "rules"]
    },
    {
        "url": "https://www.poornima.org/initiatives-and-innovations",
        "title": "Incubation, Startups & Innovation Cell (IIC)",
        "category": "About",
        "keywords": ["innovation", "startups", "incubation", "patents", "entrepreneurship"]
    },
    {
        "url": "https://www.poornima.org/about-us/poornima-faculties/poornima-jiet-education-foundation",
        "title": "Poornima & JIET Education Foundation Legacy",
        "category": "About",
        "keywords": ["education foundation", "trust", "sponsors", "society"]
    },
    {
        "url": "https://www.poornima.org/about-us/poornima-faculties/campus-team",
        "title": "Campus Administrative & Academic Team",
        "category": "Faculty",
        "keywords": ["campus team", "registrar", "deans", "proctors", "officers"]
    },
    {
        "url": "https://www.poornima.org/btech-at-poornima-group-of-colleges/electrical-engineering",
        "title": "B.Tech Electrical Engineering (EE) - Curriculum & Labs",
        "category": "Courses",
        "keywords": ["electrical engineering", "ee", "power systems", "circuits", "machines", "btech ee"]
    },
    {
        "url": "https://www.poornima.org/btech-at-poornima-group-of-colleges/civil-engineering",
        "title": "B.Tech Civil Engineering (CE) - Structures & Surveying",
        "category": "Courses",
        "keywords": ["civil engineering", "ce", "structures", "surveying", "construction", "btech civil"]
    },
    {
        "url": "https://www.poornima.org/btech-at-poornima-group-of-colleges/electronics-communication-engineering",
        "title": "B.Tech Electronics & Communication Engineering (ECE)",
        "category": "Courses",
        "keywords": ["electronics", "ece", "telecom", "vlsi", "embedded systems", "btech ece"]
    },
    {
        "url": "https://www.poornima.org/btech-at-poornima-group-of-colleges/information-technology/",
        "title": "B.Tech Information Technology (IT) - Program Details",
        "category": "Courses",
        "keywords": ["information technology", "it", "web dev", "software", "networking", "btech it"]
    },
    {
        "url": "https://www.poornima.org/btech-at-poornima-group-of-colleges/mechanical-engineering/",
        "title": "B.Tech Mechanical Engineering (ME) - Robotics & Thermal",
        "category": "Courses",
        "keywords": ["mechanical engineering", "me", "thermal", "robotics", "automobile", "cad cam", "btech me"]
    },
    {
        "url": "https://www.poornima.org/btech-at-poornima-group-of-colleges/computer-engineering/",
        "title": "B.Tech Computer Engineering / Computer Science (CSE)",
        "category": "Courses",
        "keywords": ["computer engineering", "cse", "computer science", "algorithms", "software development", "btech cse"]
    },
    {
        "url": "https://www.poornima.org/btech-at-poornima-group-of-colleges/computer-science-cyber-security/",
        "title": "B.Tech CSE with Cyber Security Specialization",
        "category": "Courses",
        "keywords": ["cyber security", "network security", "ethical hacking", "cryptography", "cse cyber"]
    },
    {
        "url": "https://www.poornima.org/btech-at-poornima-group-of-colleges/artificial-intelligence-data-science/",
        "title": "B.Tech Artificial Intelligence & Data Science (AI & DS)",
        "category": "Courses",
        "keywords": ["artificial intelligence", "data science", "ai & ds", "machine learning", "deep learning", "ai ds"]
    },
    {
        "url": "https://www.poornima.org/btech-at-poornima-group-of-colleges/computer-science-artificial-intelligence/",
        "title": "B.Tech CSE (Artificial Intelligence)",
        "category": "Courses",
        "keywords": ["computer science ai", "cse ai", "machine intelligence", "nlp", "computer vision"]
    },
    {
        "url": "https://www.poornima.org/btech-at-poornima-group-of-colleges/computer-science-engineering-regional",
        "title": "B.Tech CSE (Regional Language Medium Option)",
        "category": "Courses",
        "keywords": ["regional language", "cse regional", "hindi medium btech", "multilingual"]
    },
    {
        "url": "https://www.poornima.org/btech-at-poornima-group-of-colleges/computer-engineering-it",
        "title": "B.Tech Computer Engineering & Information Technology",
        "category": "Courses",
        "keywords": ["computer engineering it", "software engineering", "computing systems"]
    },
    {
        "url": "https://www.poornima.org/btech-at-poornima-group-of-colleges/computer-engineering-data-science",
        "title": "B.Tech Computer Engineering (Data Science Track)",
        "category": "Courses",
        "keywords": ["data science", "big data", "analytics", "computer engineering data science"]
    },
    {
        "url": "https://www.poornima.org/placement/placement-statistics",
        "title": "Annual Placement Statistics, Packages & Offers (2025-26)",
        "category": "Placements",
        "keywords": ["placement statistics", "highest package", "average package", "offers count", "salary records", "45 lpa", "33 lpa"]
    },
    {
        "url": "https://www.poornima.org/placement/internships",
        "title": "Corporate Internships & Industry Stipends",
        "category": "Placements",
        "keywords": ["internships", "summer training", "stipend", "pre placement offer", "ppo"]
    },
    {
        "url": "https://www.poornima.org/placement/illustrious-alumni",
        "title": "Illustrious Alumni Network & Global Achievements",
        "category": "About",
        "keywords": ["alumni", "notable alumni", "graduates", "success stories", "global leaders"]
    },
    {
        "url": "https://www.poornima.org/placement/recruitment-procedure",
        "title": "Campus Recruitment Procedure & On-Campus Drives",
        "category": "Placements",
        "keywords": ["recruitment procedure", "on campus drive", "selection process", "aptitude interview"]
    },
    {
        "url": "https://www.poornima.org/placement/special-programs",
        "title": "Special Placement Training Programs & Soft Skills",
        "category": "Placements",
        "keywords": ["placement training", "soft skills", "crt", "mock interviews", "personality development"]
    },
    {
        "url": "https://www.poornima.org/placement/training-and-certification",
        "title": "Technical Training, Global Certifications & Coding Bootcamps",
        "category": "Placements",
        "keywords": ["certifications", "aws", "red hat", "java", "python", "technical training"]
    },
    {
        "url": "https://www.poornima.org/placement/rules-regulations",
        "title": "Placement Policy, Code of Conduct & Regulations",
        "category": "Placements",
        "keywords": ["placement rules", "regulations", "one job policy", "eligibility for drives"]
    },
    {
        "url": "https://www.poornima.org/placement/contact-tpo",
        "title": "Contact Training & Placement Officer (TPO)",
        "category": "Placements",
        "keywords": ["tpo contact", "placement cell", "officer email", "campus drive inquiry"]
    },
    {
        "url": "https://www.poornima.org/public/uploads/ACADEMIC%20CALENDAR%20(EVEN%20SEM%20)%202024-25",
        "title": "Official Academic Calendar (Even Semester 2024-25 / 2025-26)",
        "category": "Students",
        "keywords": ["academic calendar", "semester dates", "exam schedule", "holidays", "vacation"]
    },
    {
        "url": "https://www.poornima.org/download-forms",
        "title": "Student Downloadable Forms & Applications",
        "category": "Students",
        "keywords": ["download forms", "bonafide certificate", "transcript form", "hostel leave", "noc"]
    },
    {
        "url": "https://www.poornima.org/current-students/study-materials",
        "title": "Study Materials, Lecture Notes & Question Banks",
        "category": "Students",
        "keywords": ["study materials", "notes", "syllabus", "question bank", "mid term papers"]
    },
    {
        "url": "https://www.poornima.org/current-students/poornima-archive",
        "title": "Poornima Archive - Newsletters & Annual Magazines",
        "category": "Campus Life",
        "keywords": ["archive", "magazines", "newsletters", "poornima bulletin", "publications"]
    },
    {
        "url": "https://www.poornima.org/hostel/dining-facilities",
        "title": "Hostel Dining Facilities & Hygienic Mess Menu",
        "category": "Hostels",
        "keywords": ["dining", "mess", "food", "meals", "breakfast", "dinner", "vegetarian mess"]
    },
    {
        "url": "https://www.poornima.org/hostel/health-care",
        "title": "Hostel Healthcare, First Aid & 24x7 Ambulance",
        "category": "Hostels",
        "keywords": ["health care", "doctor on call", "ambulance", "first aid", "medical assistance"]
    },
    {
        "url": "https://www.poornima.org/hostel/hostel-fest",
        "title": "Annual Hostel Fests & Night Celebrations",
        "category": "Hostels",
        "keywords": ["hostel fest", "hostel night", "cultural programs", "celebrations"]
    },
    {
        "url": "https://www.poornima.org/hostel/mentorship",
        "title": "Hostel Warden & Faculty Mentorship System",
        "category": "Hostels",
        "keywords": ["mentorship", "warden", "chief warden", "counseling", "hostel discipline"]
    },
    {
        "url": "https://www.poornima.org/hostel/recreational-facilities",
        "title": "Hostel Recreation - Gym, TV Lounge & Indoor Games",
        "category": "Hostels",
        "keywords": ["recreation", "gym", "tv lounge", "table tennis", "badminton", "indoor games"]
    },
    {
        "url": "https://www.poornima.org/hostel/security-parking",
        "title": "24x7 CCTV Campus Security & Vehicle Parking",
        "category": "Hostels",
        "keywords": ["security", "cctv", "guards", "parking", "safe campus", "biometric"]
    },
    {
        "url": "https://www.poornima.org/hostel/additional-benefits",
        "title": "Hostel Additional Benefits - Wi-Fi, Laundry & Power Backup",
        "category": "Hostels",
        "keywords": ["wi-fi", "laundry", "power backup", "solar water heater", "water purifiers"]
    },
    {
        "url": "https://www.poornima.org/online/",
        "title": "Poornima Online Fee Payment & Admission Portal",
        "category": "Admissions",
        "keywords": ["online admission", "fee payment", "registration portal", "pay online"]
    },
    {
        "url": "https://www.poornima.org/ETMEPP/",
        "title": "ETMEPP - International Conference on Emerging Trends",
        "category": "Events",
        "keywords": ["etmepp", "emerging trends", "conference", "research publication", "ieee"]
    },
    {
        "url": "https://www.poornima.org/ICSME/",
        "title": "ICSME - International Conference on Smart Materials & Engineering",
        "category": "Events",
        "keywords": ["icsme", "smart materials", "engineering conference", "symposium"]
    }
]


def is_allowed_domain_url(url: str) -> bool:
    """Strictly validates if a URL belongs to poornima.org"""
    if not url:
        return False
    try:
        parsed = urlparse(url)
        hostname = (parsed.hostname or "").lower()
        return hostname == "poornima.org" or hostname.endswith(".poornima.org")
    except Exception:
        return False


def seed_poornima_allowlist(db: Session) -> int:
    """Seeds the initial Poornima project and its 73 approved sources into database if not present."""
    now = datetime.datetime.utcnow()

    # 1. Ensure Generic CollegeWebSearchProjectDB row exists for Poornima
    generic_project = db.query(CollegeWebSearchProjectDB).filter(CollegeWebSearchProjectDB.id == "proj_poornima").first()
    if not generic_project:
        generic_project = CollegeWebSearchProjectDB(
            id="proj_poornima",
            college_name="Poornima University & Colleges",
            sitemap_url="https://www.poornima.org/sitemap.xml",
            base_domain="poornima.org",
            status="READY",
            progress_message="73 official Poornima pages loaded and active",
            total_urls=73,
            active_urls=73,
            max_sources_per_query=3,
            cache_ttl_seconds=600,
            created_at=now
        )
        db.add(generic_project)
        db.commit()

    # 2. Ensure legacy WebSearchConfigDB row exists
    config = db.query(WebSearchConfigDB).filter(WebSearchConfigDB.id == "poornima_config").first()
    if not config:
        config = WebSearchConfigDB(
            id="poornima_config",
            college_name="Poornima University / College",
            primary_domain="poornima.org",
            max_sources_per_query=3,
            status="ACTIVE",
            cache_ttl_seconds=600
        )
        db.add(config)
        db.commit()

    # 3. Check existing generic sources count
    existing_generic_count = db.query(CollegeWebSourceDB).filter(CollegeWebSourceDB.project_id == "proj_poornima").count()
    if existing_generic_count < 70:
        for idx, item in enumerate(INITIAL_73_POORNIMA_SOURCES, start=1):
            url = item["url"]
            if not is_allowed_domain_url(url):
                continue
            
            exists = db.query(CollegeWebSourceDB).filter(
                CollegeWebSourceDB.project_id == "proj_poornima",
                CollegeWebSourceDB.url == url
            ).first()

            if not exists:
                new_src = CollegeWebSourceDB(
                    id=f"csrc_poornima_{idx}_{uuid.uuid4().hex[:6]}",
                    project_id="proj_poornima",
                    url=url,
                    title=item["title"],
                    category=item["category"],
                    source_type="HTML",
                    is_enabled=1,
                    content_snippet=" | ".join(item["keywords"]),
                    discovered_at=now
                )
                db.add(new_src)

        # Also seed legacy table
        for idx, item in enumerate(INITIAL_73_POORNIMA_SOURCES, start=1):
            url = item["url"]
            exists_leg = db.query(WebSearchSourceDB).filter(WebSearchSourceDB.url == url).first()
            if not exists_leg:
                new_leg = WebSearchSourceDB(
                    id=f"p_src_{idx}_{uuid.uuid4().hex[:6]}",
                    url=url,
                    title=item["title"],
                    category=item["category"],
                    is_enabled=1,
                    content_snippet=" | ".join(item["keywords"]),
                    created_at=now
                )
                db.add(new_leg)

        db.commit()

    return db.query(CollegeWebSourceDB).filter(CollegeWebSourceDB.project_id == "proj_poornima").count()
