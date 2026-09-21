from typing import Dict, Any, List

SECTOR_TEMPLATES: Dict[str, Dict[str, Any]] = {
    "college": {
        "sector": "college",
        "display_name": "College / University / Education",
        "primary_focus": "Admissions, Programs, Eligibility, Fees & Placements",
        "welcome_message": "Welcome to our Admissions & Campus Assistant! Before we get started, please enter your email.",
        "intents": [
            {
                "intent": "course_information",
                "category": "Courses & Academics",
                "priority": 10,
                "description": "Information about available degree programs, B.Tech, MBA, BCA, Diploma courses and branches",
                "sample_questions": [
                    "What courses do you offer?",
                    "Which programs are available?",
                    "What degrees do you have?",
                    "What branches are available for B.Tech?",
                    "Tell me about your academic programs"
                ]
            },
            {
                "intent": "admission_eligibility",
                "category": "Admissions",
                "priority": 9,
                "description": "Eligibility criteria, cutoff marks, minimum percentage, REAP/JEE/entrance exam requirements",
                "sample_questions": [
                    "What is the eligibility criteria for admission?",
                    "What are the admission requirements?",
                    "What percentage is required for B.Tech?",
                    "Do I need JEE or REAP for admission?",
                    "Can I get direct admission with 12th percentage?"
                ]
            },
            {
                "intent": "fee_structure",
                "category": "Fees & Financing",
                "priority": 9,
                "description": "Tuition fees, semester fees, hostel fees, payment schedules and modes",
                "sample_questions": [
                    "What is the fee structure?",
                    "How much is the tuition fee per year?",
                    "What are the total charges for B.Tech?",
                    "What is the hostel fee?",
                    "How can I pay the admission fees?"
                ]
            },
            {
                "intent": "admission_process",
                "category": "Admissions",
                "priority": 8,
                "description": "Step by step application and admission process, required documents, counseling",
                "sample_questions": [
                    "How can I apply for admission?",
                    "What is the admission procedure?",
                    "Where do I submit the application form?",
                    "What documents are required for admission?",
                    "What are the steps to join the college?"
                ]
            },
            {
                "intent": "scholarships",
                "category": "Scholarships & Financial Aid",
                "priority": 8,
                "description": "Merit scholarships, government schemes, fee waivers, criteria for tuition discount",
                "sample_questions": [
                    "Are scholarships available?",
                    "How can I get a merit scholarship?",
                    "What are the scholarship criteria?",
                    "Is there any financial aid or fee concession?",
                    "What scholarship is given for high 12th marks?"
                ]
            },
            {
                "intent": "placements_and_careers",
                "category": "Placements",
                "priority": 8,
                "description": "Placement records, average package, highest package, recruiting companies, career cell",
                "sample_questions": [
                    "How are the campus placements?",
                    "What is the average and highest package?",
                    "Which companies visit the campus for recruitment?",
                    "What is the placement percentage?",
                    "Tell me about the training and placement cell"
                ]
            },
            {
                "intent": "hostel_and_campus",
                "category": "Campus Life",
                "priority": 7,
                "description": "Hostel facilities, mess, Wi-Fi, transport/bus facility, sports, library, labs",
                "sample_questions": [
                    "Do you provide hostel accommodation?",
                    "What facilities are available on campus?",
                    "Is there a college bus/transport service?",
                    "Tell me about the hostel rooms, mess, and amenities",
                    "Is there a library and sports complex?"
                ]
            },
            {
                "intent": "important_dates",
                "category": "Admissions",
                "priority": 7,
                "description": "Admission deadlines, application start/end dates, counseling schedule, session start date",
                "sample_questions": [
                    "What are the important admission dates?",
                    "What is the last date to apply?",
                    "When does the academic session begin?",
                    "When is the entrance counseling scheduled?"
                ]
            },
            {
                "intent": "contact_admission_office",
                "category": "Contact & Support",
                "priority": 7,
                "description": "Admission office phone numbers, email, campus address, helpline hours",
                "sample_questions": [
                    "How can I contact the admission office?",
                    "What is the phone number and email for admissions?",
                    "Where is the campus located?",
                    "Can I visit the college campus?"
                ]
            }
        ],
        "default_cta": {"label": "Apply for Admission", "url": ""}
    },
    "hospital": {
        "sector": "hospital",
        "display_name": "Hospital / Healthcare",
        "primary_focus": "Departments, Doctors, Appointments, Timings & Emergency",
        "welcome_message": "Welcome to our Healthcare & Patient Assistant! Before we get started, please enter your email.",
        "intents": [
            {
                "intent": "departments_and_specialties",
                "category": "Medical Services",
                "priority": 10,
                "description": "Clinical departments, specialties, cardiology, neurology, pediatrics, orthopedics",
                "sample_questions": [
                    "What departments and medical specialties do you have?",
                    "Do you have cardiology and neurology departments?",
                    "What medical services are offered?",
                    "Which treatments are available?"
                ]
            },
            {
                "intent": "doctors_and_specialists",
                "category": "Doctors",
                "priority": 9,
                "description": "Doctor directory, consultants, surgeons, qualifications, OPD schedules",
                "sample_questions": [
                    "Who are the specialist doctors?",
                    "How can I find a doctor's schedule?",
                    "Which doctors are available for consultation?",
                    "Tell me about the senior consultants"
                ]
            },
            {
                "intent": "appointment_booking",
                "category": "Appointments",
                "priority": 9,
                "description": "How to book OPD appointment, online booking, tele-consultation, registration",
                "sample_questions": [
                    "How do I book a doctor appointment?",
                    "Can I book an OPD consultation online?",
                    "What is the procedure for doctor appointments?",
                    "Where can I get an appointment token?"
                ]
            },
            {
                "intent": "emergency_and_ambulance",
                "category": "Emergency",
                "priority": 10,
                "description": "24x7 emergency services, trauma care, ambulance helpline, ICU availability",
                "sample_questions": [
                    "Is there 24/7 emergency service?",
                    "What is the emergency helpline and ambulance number?",
                    "Do you have ICU and critical care?",
                    "Where is the emergency department located?"
                ]
            },
            {
                "intent": "hospital_timings",
                "category": "Timings & Visiting",
                "priority": 8,
                "description": "OPD timings, visitor hours, pharmacy timings, sample collection hours",
                "sample_questions": [
                    "What are the OPD consultation timings?",
                    "What are the patient visiting hours?",
                    "When is the pharmacy and diagnostic lab open?"
                ]
            },
            {
                "intent": "insurance_and_tpa",
                "category": "Billing & Insurance",
                "priority": 8,
                "description": "Cashless insurance empanelment, TPA list, government health schemes, payment modes",
                "sample_questions": [
                    "Which insurance policies and TPAs are accepted for cashless treatment?",
                    "Do you support government health schemes?",
                    "What are the billing and payment options?"
                ]
            },
            {
                "intent": "location_and_contact",
                "category": "Contact",
                "priority": 7,
                "description": "Hospital address, landmark, contact numbers, reception desk",
                "sample_questions": [
                    "Where is the hospital located?",
                    "What is the address and contact number?",
                    "How do I reach the hospital?"
                ]
            }
        ],
        "default_cta": {"label": "Book Appointment", "url": ""}
    },
    "saas": {
        "sector": "saas",
        "display_name": "Software / SaaS",
        "primary_focus": "Features, Pricing, Integrations, Demo & Support",
        "welcome_message": "Welcome to our Product Assistant! Before we get started, please enter your email.",
        "intents": [
            {
                "intent": "product_features",
                "category": "Features",
                "priority": 10,
                "description": "Core software capabilities, module list, platform tools, use cases",
                "sample_questions": [
                    "What are the main features of the platform?",
                    "What does the software do?",
                    "What tools and capabilities are included?",
                    "How does the product work?"
                ]
            },
            {
                "intent": "pricing_and_plans",
                "category": "Pricing",
                "priority": 9,
                "description": "Subscription plans, monthly/annual tiers, free trial, enterprise pricing",
                "sample_questions": [
                    "What are the pricing plans?",
                    "How much does the subscription cost?",
                    "Is there a free trial available?",
                    "What is included in the Pro or Enterprise plan?"
                ]
            },
            {
                "intent": "integrations_and_api",
                "category": "Integrations",
                "priority": 8,
                "description": "Third party integrations, webhooks, REST API, developer SDKs",
                "sample_questions": [
                    "Which tools and apps does it integrate with?",
                    "Do you have a REST API or webhook support?",
                    "Can we connect our CRM and Slack?"
                ]
            },
            {
                "intent": "demo_request",
                "category": "Demo & Sales",
                "priority": 9,
                "description": "Schedule live product walkthrough, contact sales team, proof of concept",
                "sample_questions": [
                    "How can I book a live product demo?",
                    "Can I see a walkthrough with sales?",
                    "How do I schedule a demo session?"
                ]
            },
            {
                "intent": "security_and_compliance",
                "category": "Security",
                "priority": 7,
                "description": "Data encryption, SOC2, GDPR, HIPAA, hosting infrastructure, compliance",
                "sample_questions": [
                    "Is the platform SOC 2 / GDPR compliant?",
                    "How is our customer data secured and encrypted?",
                    "Where is the data hosted?"
                ]
            },
            {
                "intent": "support_and_documentation",
                "category": "Support",
                "priority": 7,
                "description": "Help center, documentation links, customer support channels, SLA",
                "sample_questions": [
                    "Where can I find user documentation?",
                    "How do I reach technical support?",
                    "What customer support channels are available?"
                ]
            }
        ],
        "default_cta": {"label": "Book a Demo", "url": ""}
    },
    "manufacturing": {
        "sector": "manufacturing",
        "display_name": "Manufacturing / Industrial",
        "primary_focus": "Products, Specifications, RFQ / Quotes & Certifications",
        "welcome_message": "Welcome to our Industrial & Product Inquiries Assistant! Before we get started, please enter your email.",
        "intents": [
            {
                "intent": "product_catalog",
                "category": "Products",
                "priority": 10,
                "description": "Industrial product lineup, machinery, materials, engineered components",
                "sample_questions": [
                    "What industrial products and equipment do you manufacture?",
                    "What is your product range?",
                    "Which models and product lines are available?"
                ]
            },
            {
                "intent": "technical_specifications",
                "category": "Specifications",
                "priority": 9,
                "description": "Dimensions, tolerances, material grades, datasheets, technical parameters",
                "sample_questions": [
                    "What are the technical specifications?",
                    "Where can I get the product datasheet?",
                    "What material grades and capacities are supported?"
                ]
            },
            {
                "intent": "rfq_and_quotation",
                "category": "Quotation & Sales",
                "priority": 9,
                "description": "Request for quotation, bulk order pricing, MOQ, lead times, delivery terms",
                "sample_questions": [
                    "How do I request a price quotation or RFQ?",
                    "What is the minimum order quantity (MOQ)?",
                    "What are the typical lead times and delivery terms?"
                ]
            },
            {
                "intent": "certifications_and_quality",
                "category": "Quality & Standards",
                "priority": 8,
                "description": "ISO certifications, CE, ASTM, quality assurance protocols, test certificates",
                "sample_questions": [
                    "What quality certifications do you hold (ISO, CE)?",
                    "What are your quality assurance standards?",
                    "Do you provide test and inspection certificates?"
                ]
            },
            {
                "intent": "distributors_and_warranty",
                "category": "Distributors & Support",
                "priority": 7,
                "description": "Authorized dealer network, warranty coverage, replacement parts, servicing",
                "sample_questions": [
                    "Where can I find authorized dealers or distributors?",
                    "What is the warranty period and policy?",
                    "How do I order spare parts or request servicing?"
                ]
            },
            {
                "intent": "contact_sales",
                "category": "Contact",
                "priority": 7,
                "description": "Sales department contact, factory location, inquiry email",
                "sample_questions": [
                    "How do I contact the industrial sales department?",
                    "Where is the manufacturing plant located?",
                    "What is the sales phone number and email?"
                ]
            }
        ],
        "default_cta": {"label": "Request a Quote (RFQ)", "url": ""}
    },
    "general": {
        "sector": "general",
        "display_name": "General Business",
        "primary_focus": "Services, About, Pricing & Contact",
        "welcome_message": "Welcome to our website assistant! Before we get started, please enter your email.",
        "intents": [
            {
                "intent": "services_overview",
                "category": "Services",
                "priority": 10,
                "description": "Services offered, core solutions, company offerings",
                "sample_questions": [
                    "What services do you offer?",
                    "What does your organization do?",
                    "How can you help my business?"
                ]
            },
            {
                "intent": "pricing_and_packages",
                "category": "Pricing",
                "priority": 8,
                "description": "Pricing details, packages, quotes, consultation fees",
                "sample_questions": [
                    "How much do your services cost?",
                    "What are the pricing options?",
                    "How do I get a custom quote?"
                ]
            },
            {
                "intent": "about_organization",
                "category": "About",
                "priority": 7,
                "description": "Company history, mission, leadership team, achievements",
                "sample_questions": [
                    "Tell me about your company",
                    "What is your background and experience?",
                    "Who is on the team?"
                ]
            },
            {
                "intent": "contact_and_location",
                "category": "Contact",
                "priority": 8,
                "description": "Address, phone numbers, email, business hours, contact form",
                "sample_questions": [
                    "How can I contact you?",
                    "Where is your office located?",
                    "What is your email and phone number?"
                ]
            }
        ],
        "default_cta": {"label": "Contact Us", "url": ""}
    }
}

def get_sector_template(sector: str) -> Dict[str, Any]:
    return SECTOR_TEMPLATES.get((sector or "general").lower(), SECTOR_TEMPLATES["general"])
