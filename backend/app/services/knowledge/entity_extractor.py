import json
import re
import uuid
from typing import List, Dict, Any

def extract_structured_entities(
    text: str,
    url: str,
    page_id: str,
    sector: str = "general"
) -> List[Dict[str, Any]]:
    """
    Extracts structured domain entities from page content based on detected sector.
    Returns list of entity dictionaries:
    [{ id, entity_type, entity_name, attributes, source_url, page_id }]
    """
    entities = []

    # 1. Schema.org Structured Data Extraction
    if "Structured Business Information:" in text:
        try:
            parts = text.split("Structured Business Information:")
            for p in parts[1:]:
                json_str = p.strip().split("\n\n")[0]
                data = json.loads(json_str)
                name = data.get("name") or data.get("alternateName") or "Organization"
                entity_type = data.get("@type", "Organization").lower()
                
                attrs = {}
                if data.get("address"):
                    attrs["address"] = data["address"]
                if data.get("telephone"):
                    attrs["phone"] = data["telephone"]
                if data.get("email"):
                    attrs["email"] = data["email"]
                if data.get("description"):
                    attrs["description"] = data["description"]

                entities.append({
                    "id": str(uuid.uuid4()),
                    "page_id": page_id,
                    "entity_type": entity_type,
                    "entity_name": name,
                    "attributes": attrs,
                    "source_url": url
                })
        except Exception:
            pass

    # 2. Universal Contact, Phone, Email & Address Extraction
    # Address
    addr_matches = re.findall(
        r'(?:Address|Office|Location|HQ)[:\s]+([A-Z0-9\-\/,\s]{10,120}(?:Market|Circle|Road|Street|Avenue|Sector|Floor|Nagar|Jaipur|Delhi|Mumbai|Bangalore|Pune|Hyderabad|Noida|Gurugram|India|Raj|Rajasthan|Pin)[^`\'"<\n\r]*)',
        text, re.I
    )
    for addr in set(addr_matches):
        clean_addr = addr.strip(" ,.-:;")
        if len(clean_addr) > 15:
            entities.append({
                "id": str(uuid.uuid4()),
                "page_id": page_id,
                "entity_type": "address",
                "entity_name": clean_addr,
                "attributes": {"category": "Office Location"},
                "source_url": url
            })

    # Phone
    phone_matches = re.findall(r'(\+91[\s\-]?[6-9]\d{4}[\s\-]?\d{5}|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b)', text)
    for ph in set(phone_matches):
        entities.append({
            "id": str(uuid.uuid4()),
            "page_id": page_id,
            "entity_type": "phone",
            "entity_name": ph.strip(),
            "attributes": {"category": "Support / Contact Phone"},
            "source_url": url
        })

    # Email
    email_matches = re.findall(r'([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)', text)
    for em in set(email_matches):
        em_clean = em.strip(" ,.-:;")
        if not em_clean.endswith(('.png', '.jpg', '.jpeg', '.gif', '.svg', '.js', '.css', '.ico')):
            entities.append({
                "id": str(uuid.uuid4()),
                "page_id": page_id,
                "entity_type": "email",
                "entity_name": em_clean,
                "attributes": {"category": "Contact Email"},
                "source_url": url
            })

    # 3. Sector Specific Entity Patterns
    if sector == "college":
        # Course / Program extraction
        course_patterns = [
            r"(B\.?Tech\s+in\s+[A-Za-z\s\&]+|B\.?Tech\s+[A-Za-z\s\&]+(?:\([^\)]+\))?)",
            r"(M\.?Tech\s+in\s+[A-Za-z\s\&]+|M\.?Tech\s+[A-Za-z\s\&]+)",
            r"(MBA\s+in\s+[A-Za-z\s\&]+|MBA|BBA|BCA|MCA|Ph\.?D(?:\s+in\s+[A-Za-z\s]+)?)",
            r"(Computer Science Engineering|Artificial Intelligence & Data Science|Artificial Intelligence|Data Science|Internet of Things|Civil Engineering|Mechanical Engineering|Electrical Engineering)"
        ]
        found_courses = set()
        for pat in course_patterns:
            matches = re.findall(pat, text, re.I)
            for m in matches:
                clean_name = m.strip(" ,.-:;")
                if len(clean_name) > 3 and clean_name.lower() not in found_courses:
                    found_courses.add(clean_name.lower())
                    entities.append({
                        "id": str(uuid.uuid4()),
                        "page_id": page_id,
                        "entity_type": "course",
                        "entity_name": clean_name,
                        "attributes": {
                            "degree_level": "Undergraduate" if "b." in clean_name.lower() or "bachelor" in clean_name.lower() else "Postgraduate",
                            "category": "Engineering & Technology"
                        },
                        "source_url": url
                    })

    elif sector == "hospital":
        # Doctor / Specialization extraction
        doctor_matches = re.findall(r"(Dr\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)", text)
        for doc in set(doctor_matches):
            entities.append({
                "id": str(uuid.uuid4()),
                "page_id": page_id,
                "entity_type": "doctor",
                "entity_name": doc,
                "attributes": {"role": "Consultant Physician"},
                "source_url": url
            })

    # 4. Service, Product & Industry Extraction (SaaS, General, Manufacturing)
    # Services
    service_patterns = [
        r"(Data Analytics(?:\s*\&\s*Business Intelligence)?)",
        r"(Predictive Analytics(?:\s*(?:\&|and)\s*Machine Learning)?)",
        r"(Predictive Model(?:ing|ling)(?:\s+Services)?)",
        r"(Big Data Analytics)",
        r"(Business Intelligence(?:\s*(?:\&|and)\s*Analytics)?)",
        r"(Software\s+(?:\&|and)\s+Custom Development|Custom Software Development|Software Development)",
        r"(Data Engineering(?:\s*(?:\&|and)\s*Integration)?)",
        r"(CFD\s*(?:\&|and)\s*FDS(?:\s+Simulation)?|CFD Simulation|Fire Dynamics Simulation)",
        r"(Custom Dashboard Development|AI\s*\&\s*ML Implementation|Data-Driven Decision Making Services)"
    ]
    found_services = set()
    for spat in service_patterns:
        smatches = re.findall(spat, text, re.I)
        for sm in smatches:
            clean_s = sm.strip(" ,.-:;")
            if len(clean_s) > 4 and clean_s.lower() not in found_services:
                found_services.add(clean_s.lower())
                entities.append({
                    "id": str(uuid.uuid4()),
                    "page_id": page_id,
                    "entity_type": "service",
                    "entity_name": clean_s,
                    "attributes": {"category": "Core Service Offering"},
                    "source_url": url
                })

    # Products / Platforms
    product_matches = re.findall(r"\b([A-Z][a-zA-Z0-9\-_]+\s+(?:Platform|Software|Suite|Engine|Intelligence Platform|Tool|Analytics))\b", text)
    for prod in set(product_matches):
        entities.append({
            "id": str(uuid.uuid4()),
            "page_id": page_id,
            "entity_type": "product",
            "entity_name": prod.strip(),
            "attributes": {"category": "Proprietary Software Product"},
            "source_url": url
        })

    # Industries Served
    industry_matches = re.findall(r"\b(Retail Industry|Construction Industry|Manufacturing Industry)\b", text, re.I)
    for ind in set(industry_matches):
        entities.append({
            "id": str(uuid.uuid4()),
            "page_id": page_id,
            "entity_type": "industry_served",
            "entity_name": ind.strip(),
            "attributes": {"category": "Industry Focus"},
            "source_url": url
        })

    # Pricing plan extraction
    if sector == "saas":
        plan_matches = re.findall(r"([A-Z][a-z]+\s+Plan|[A-Z][a-z]+\s+Tier|Starter|Pro|Enterprise|Free Tier)", text)
        for plan in set(plan_matches):
            entities.append({
                "id": str(uuid.uuid4()),
                "page_id": page_id,
                "entity_type": "pricing_plan",
                "entity_name": plan,
                "attributes": {"type": "Subscription Tier"},
                "source_url": url
            })

    elif sector == "manufacturing":
        model_matches = re.findall(r"(Model\s+[A-Z0-9\-]+|Series\s+[A-Z0-9\-]+)", text)
        for model in set(model_matches):
            entities.append({
                "id": str(uuid.uuid4()),
                "page_id": page_id,
                "entity_type": "product_model",
                "entity_name": model,
                "attributes": {"type": "Industrial Equipment"},
                "source_url": url
            })

    return entities
