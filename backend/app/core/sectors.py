from typing import Dict, Any, List

SECTOR_CONFIGS: Dict[str, Dict[str, Any]] = {
    "college": {
        "name": "College / University / Education",
        "description": "Educational institutions, universities, colleges, and academic schools offering degree, diploma, and research programs.",
        "common_content_types": [
            "course_catalog", "admission_criteria", "fee_structure", "placement_report",
            "faculty_profile", "campus_facilities", "hostel_rules", "student_services",
            "academic_calendar", "exam_schedule", "faculty_policies"
        ],
        "important_entities": [
            "course", "program", "degree", "specialization", "fee", "eligibility",
            "admission", "scholarship", "hostel", "placement", "department", "faculty",
            "exam_deadline", "attendance_policy", "faculty_leave_policy"
        ],
        "typical_intents": [
            "course_inquiry", "fee_inquiry", "admission_process", "eligibility_check",
            "placement_record", "hostel_inquiry", "faculty_inquiry", "counselor_booking",
            "campus_tour", "student_exam_timetable", "student_support", "faculty_policy_inquiry"
        ],
        "retrieval_priorities": {
            "course": 1.35,
            "admission": 1.30,
            "fee": 1.25,
            "eligibility": 1.20,
            "placement": 1.15,
            "student_support": 1.10,
            "faculty_policy": 1.10,
            "department": 1.0,
            "general": 0.85
        },
        "answer_style": "Authoritative, helpful, and academically structured. When answering admission or course inquiries, clearly list matching programs, eligibility criteria, and offer counselor guidance.",
        "suggested_actions": [
            "Explore Courses",
            "Admission Information",
            "Check Eligibility",
            "Fees & Scholarships",
            "Book Counselor Call",
            "Student Exams & Timetable",
            "Faculty Policy Handbook"
        ]
    },
    "hospital": {
        "name": "Hospital / Healthcare",
        "description": "Hospitals, medical centers, clinics, and healthcare providers offering medical treatments and specialized departments.",
        "common_content_types": ["doctor_directory", "department_services", "treatment_details", "emergency_guidelines", "appointment_booking", "insurance_coverage"],
        "important_entities": ["doctor", "department", "specialization", "treatment", "service", "timing", "availability", "insurance", "emergency", "location", "facility"],
        "typical_intents": ["doctor_search", "timing_check", "appointment_info", "department_search", "emergency_info", "treatment_details", "insurance_inquiry"],
        "retrieval_priorities": {
            "doctor": 1.3,
            "timing": 1.3,
            "emergency": 1.2,
            "department": 1.1,
            "treatment": 1.0,
            "insurance": 1.0,
            "general": 0.8
        },
        "answer_style": "Compassionate, precise, and authoritative with doctor qualifications, specialization, and consultation timings."
    },
    "saas": {
        "name": "Software / SaaS",
        "description": "Software-as-a-service companies, digital platforms, cloud services, and developer tooling providers.",
        "common_content_types": ["feature_matrix", "pricing_tier", "api_documentation", "integration_guide", "case_study", "faq_support"],
        "important_entities": ["product", "feature", "pricing_plan", "tier", "integration", "api", "support", "faq", "security", "use_case"],
        "typical_intents": ["pricing_inquiry", "feature_check", "integration_support", "demo_request", "api_query", "security_compliance", "onboarding"],
        "retrieval_priorities": {
            "pricing_plan": 1.3,
            "feature": 1.2,
            "integration": 1.1,
            "api": 1.0,
            "faq": 1.0,
            "general": 0.8
        },
        "answer_style": "Clear, modern, and value-focused with distinct pricing tiers, feature lists, and technical capabilities."
    },
    "manufacturing": {
        "name": "Manufacturing / Industrial",
        "description": "Manufacturing plants, industrial equipment suppliers, B2B producers, and engineering product catalogs.",
        "common_content_types": ["product_catalog", "technical_datasheet", "certification_list", "warranty_policy", "rfq_form", "distributor_network"],
        "important_entities": ["product", "specification", "model", "catalog", "certification", "warranty", "material", "distributor", "rfq", "application"],
        "typical_intents": ["product_spec", "rfq_quote", "certification_check", "distributor_inquiry", "warranty_policy", "custom_manufacturing"],
        "retrieval_priorities": {
            "specification": 1.3,
            "product": 1.2,
            "certification": 1.1,
            "warranty": 1.0,
            "distributor": 1.0,
            "general": 0.8
        },
        "answer_style": "Technical, precise, and professional highlighting exact model numbers, dimensions, tolerances, and compliance standards."
    },
    "general": {
        "name": "General Business / Organization",
        "description": "General corporate, service, non-profit, or portfolio website.",
        "common_content_types": ["about_us", "services_offered", "team_directory", "contact_info", "news_articles"],
        "important_entities": ["service", "team_member", "location", "contact", "about", "policy", "faq"],
        "typical_intents": ["service_inquiry", "contact_info", "about_company", "location_search", "faq_question"],
        "retrieval_priorities": {
            "service": 1.1,
            "contact": 1.1,
            "about": 1.0,
            "general": 0.8
        },
        "answer_style": "Professional, polite, and helpful representation of the organization."
    }
}

def get_sector_config(sector_key: str) -> Dict[str, Any]:
    return SECTOR_CONFIGS.get(sector_key.lower(), SECTOR_CONFIGS["general"])
