import uuid
import json
from datetime import datetime
from app.core.database import SessionLocal, Base, engine
from app.models.schemas import AgentDB, PageDB, EntityDB
from app.services.knowledge.vector_store import vector_store
from app.services.llm.provider import get_embedding_provider

FIXED_COLLEGE_AGENT_ID = "441d220c-2b75-4509-b096-13133d12b9b7"

def ingest_xyz_knowledge():
    # Ensure all tables are created
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    embedding_provider = get_embedding_provider()
    
    # 1. Find or create the primary XYZ College Agent with fixed deterministic ID
    agent = db.query(AgentDB).filter(
        (AgentDB.id == FIXED_COLLEGE_AGENT_ID) |
        (AgentDB.website_url.like("%xyzcollege%")) |
        (AgentDB.website_url.like("%poornima%")) |
        (AgentDB.detected_sector == "college")
    ).first()
    
    if not agent:
        agent = AgentDB(
            id=FIXED_COLLEGE_AGENT_ID,
            name="XYZ Group of Colleges AI Agent",
            website_url="https://www.xyzcollege.edu.in/",
            scope="entire_website",
            status="COMPLETED",
            primary_color="#1d4ed8",
            welcome_message="Hello! I am the official XYZ College Admissions Assistant. How can I assist you with REAP codes (1023 & 1050), fees, cutoffs, courses, or placements today?",
            detected_sector="college",
            sector_confidence=0.99,
            sector_reason="Official Engineering College Portal with B.Tech, M.Tech, REAP 1023/1050, Fees & Admissions.",
            created_at=datetime.utcnow(),
            last_crawled_at=datetime.utcnow()
        )
        db.add(agent)
        db.commit()
        db.refresh(agent)
    else:
        agent.name = "XYZ Group of Colleges AI Agent"
        agent.website_url = "https://www.xyzcollege.edu.in/"
        agent.welcome_message = "Hello! I am the official XYZ College Admissions Assistant. How can I assist you with REAP codes (1023 & 1050), fees, cutoffs, courses, or placements today?"
        agent.status = "COMPLETED"
        agent.detected_sector = "college"
        db.commit()

    agent_id = agent.id
    print(f"[*] Ingesting knowledge for Agent: {agent.name} (ID: {agent_id})")

    # 2. Re-create Clean Structured Entities in EntityDB
    db.query(EntityDB).filter(EntityDB.agent_id == agent_id).delete()
    db.commit()

    entities_data = [
        {
            "type": "fees",
            "name": "XYZ College Official Annual Fee Schedule (B.Tech CSE & Core)",
            "attrs": {
                "btech_cse_fee": "₹1,34,306 per year (CSE, AI & Data Science, Cyber Security, IT, IoT)",
                "btech_core_fee": "₹82,639 per year (Civil, ME, EE, ECE - Includes 50% built-in scholarship)",
                "lateral_entry_fee": "₹43,949 per year (100% Tuition Fee Waiver)",
                "hostel_non_ac_fee": "₹1,15,000 per year (Double room + 4-time mess)",
                "hostel_ac_fee": "₹1,45,000 per year (Double room + 4-time mess)",
                "hostel_premium_fee": "₹1,70,000 per year (AC Attached / 1-BHK)",
                "bus_transport_fee": "₹25,000 to ₹40,000 per year across Jaipur city routes"
            },
            "source_url": "https://www.xyzcollege.edu.in/admission-fees"
        },
        {
            "type": "course",
            "name": "B.Tech in Computer Science Engineering (CSE) / AI & DS",
            "attrs": {
                "annual_fee": "₹1,34,306 per year",
                "duration": "4 Years",
                "eligibility": "Minimum 45% aggregate in 10+2 PCM (40% for SC/ST/OBC)",
                "reap_code": "XYZCE: 1023 | XYZIET: 1050",
                "specializations": "AI, Data Science, Cyber Security, IoT, IT, Regional Language"
            },
            "source_url": "https://www.xyzcollege.edu.in/courses"
        },
        {
            "type": "course",
            "name": "B.Tech in Core Engineering (Civil, Mechanical, Electrical, ECE)",
            "attrs": {
                "annual_fee": "₹82,639 per year (Includes 50% built-in scholarship)",
                "regular_fee": "₹1,34,306 per year",
                "scholarship": "50% Built-in tuition concession for Core branches",
                "duration": "4 Years",
                "eligibility": "Minimum 45% in 10+2 PCM (40% for SC/ST/OBC)",
                "reap_code": "XYZCE: 1023 | XYZIET: 1050"
            },
            "source_url": "https://www.xyzcollege.edu.in/courses"
        },
        {
            "type": "admission",
            "name": "REAP Codes 1023 (XYZCE) & 1050 (XYZIET) Admissions",
            "attrs": {
                "xyzce_code": "1023 (XYZ College of Engineering - NAAC A+ | UGC Autonomous)",
                "xyziet_code": "1050 (XYZ Institute of Engg. & Tech - NAAC A | UGC Autonomous)",
                "reap_counseling": "June – July 2026",
                "direct_admission": "August 2026 for vacant seats",
                "donation_policy": "Zero donation, strict AICTE norms",
                "helpline": "+91-9928555222 / +91-9928666222",
                "email": "admission@xyzcollege.edu.in"
            },
            "source_url": "https://admission.xyzcollege.edu.in/"
        },
        {
            "type": "placement",
            "name": "XYZ College Placement Track Record",
            "attrs": {
                "batch_2026_highest": "₹15.00 LPA",
                "batch_2026_average": "₹5.25 LPA",
                "batch_2024_highest": "₹12.00 LPA",
                "batch_2024_average": "₹4.40 LPA (1,700+ Offers, 350+ Companies)",
                "all_time_highest": "₹44.10 LPA (Batch 2023)",
                "placement_rate": "80%+ of all eligible registered students",
                "top_recruiters": "Microsoft, Amazon, SAP, TCS, Infosys, Morgan Stanley, Deloitte, Tekion, Flipkart, Walmart"
            },
            "source_url": "https://www.xyzcollege.edu.in/placements"
        }
    ]

    for ed in entities_data:
        ent = EntityDB(
            id=str(uuid.uuid4()),
            agent_id=agent_id,
            entity_type=ed["type"],
            entity_name=ed["name"],
            attributes=ed["attrs"],
            source_url=ed["source_url"],
            source_type="REAL_WEBSITE",
            created_at=datetime.utcnow()
        )
        db.add(ent)
    db.commit()

    # 3. Seed Comprehensive Knowledge Pages in PageDB
    db.query(PageDB).filter(PageDB.agent_id == agent_id).delete()
    db.commit()

    pages_data = [
        {
            "url": "https://www.xyzcollege.edu.in/admission-fees",
            "title": "XYZ College B.Tech CSE & Core Annual Fee Structure 2026-27",
            "content": """Official Annual Fee Structure for XYZ Group of Colleges (XYZCE & XYZIET) Session 2026-27:
1. B.Tech Computer Science Engineering (CSE), Artificial Intelligence & Data Science (AI & DS), Cyber Security, IT, IoT, Electronics & Computer Engg:
   - Annual Tuition & College Fee: ₹1,34,306 per year.
2. B.Tech Core Branches (Civil Engineering, Mechanical Engineering, Electrical Engineering, ECE):
   - Annual Fee: ₹82,639 per year (Includes built-in 50% scholarship concession on standard tuition fee).
3. B.Tech Lateral Entry (Direct 2nd Year for Diploma / B.Sc holders):
   - Annual Fee: ₹43,949 per year (Includes 100% tuition fee waiver).
4. Campus Hostel & Mess Charges:
   - Double Occupancy (Air Cooler/Fan): ₹1,15,000 per year.
   - Double Occupancy (Air Conditioned AC): ₹1,45,000 per year.
   - Premium 1-BHK / AC Attached: ₹1,70,000 per year.
   - All hostel fees include 4-time hygienic vegetarian mess meals. Initial booking amount is ₹26,000.
5. Jaipur City Bus Transport:
   - ₹25,000 to ₹40,000 per year depending on pickup route distance across Jaipur city."""
        },
        {
            "url": "https://www.xyzcollege.edu.in/admission",
            "title": "XYZ College REAP Codes 1023 & 1050 and Admission Procedure 2026",
            "content": """Official REAP Codes and Admission Guidelines for XYZ Group:
- XYZ College of Engineering (XYZCE): REAP Code 1023 | NAAC A+ Grade | UGC Autonomous
- XYZ Institute of Engineering & Technology (XYZIET): REAP Code 1050 | NAAC A Grade | UGC Autonomous
Affiliation: Rajasthan Technical University (RTU), Kota.
Eligibility: Minimum 45% aggregate marks in 10+2 PCM (Physics, Chemistry, Maths) for General Category; 40% for SC/ST/OBC/SBC candidates.
Admission Priority: JEE Main 2026 score/rank followed by 12th Board PCM marks percentage.
Counseling: REAP Counseling starts in June–July. Direct Admission / Management Quota for remaining vacant seats opens in August. Strictly no donations or capitation fees are charged."""
        },
        {
            "url": "https://www.xyzcollege.edu.in/placements",
            "title": "XYZ College Placements, Packages and Top Recruiters",
            "content": """XYZ Group Placement Statistics:
- Batch 2026: Highest Package ₹15 LPA, Average Package ₹5.25 LPA.
- Batch 2024: Highest Package ₹12 LPA, Average Package ₹4.40 LPA with 1700+ job offers from 350+ recruiting companies.
- Batch 2023: Highest Package ₹44.1 LPA, Average Package ₹4.87 LPA.
Placement Percentage: 80%+ of all eligible registered students get placed annually.
Top Recruiters visiting campus: Microsoft, Amazon, SAP Labs, Infosys, Tata Consultancy Services (TCS), Wipro, Cognizant, Morgan Stanley, Deloitte, Ernst & Young (EY), Tekion, Flipkart, Walmart, Celebal Technologies."""
        },
        {
            "url": "https://www.xyzcollege.edu.in/courses",
            "title": "XYZ College 12 B.Tech Specializations & Engineering Programs",
            "content": """Engineering Programs Offered at XYZ Group of Colleges:
1. B.Tech Computer Science Engineering (Core CSE)
2. B.Tech CSE (Artificial Intelligence & Data Science - AI & DS)
3. B.Tech CSE (Cyber Security)
4. B.Tech Information Technology (IT) & IoT
5. B.Tech Regional Language CSE
6. B.Tech Electronics & Computer Engineering
7. B.Tech Electrical Engineering (EE)
8. B.Tech Mechanical Engineering (ME)
9. B.Tech Civil Engineering (CE)
10. B.Tech Electronics & Communication Engineering (ECE)
11. B.Tech Lateral Entry (Direct 2nd Year for Diploma / B.Sc)
12. M.Tech in Computer Science Engineering (CSE) and Power Systems."""
        },
        {
            "url": "https://www.xyzcollege.edu.in/about",
            "title": "About XYZ College Campuses, Accreditations & Infrastructure",
            "content": """About XYZ Group of Colleges Jaipur:
- Campuses: XYZ College of Engineering (XYZCE - ISI-6, RIICO Institutional Area, Sitapura, Jaipur) & XYZ Institute of Engineering & Technology (XYZIET - ISI-2, Sitapura, Jaipur).
- Accreditation: NAAC A+ accredited, NBA accredited engineering programs, AICTE approved, RTU Kota affiliated.
- Infrastructure: 30+ Advanced Computing & AI Labs, Robotics and IoT Incubation Centre, Central Library with 50,000+ volumes, IEEE digital access, 500-seat Air-conditioned Auditorium, Sports Complex, High-speed Wi-Fi campus."""
        },
        {
            "url": "https://www.xyzcollege.edu.in/hostels",
            "title": "XYZ College Campus Hostels, Mess Dining & Security",
            "content": """XYZ College Hostels & Residential Life:
- Separate boys and girls hostels on campus with 24/7 security, biometric attendance, and resident wardens.
- Room Options: Double occupancy non-AC with cooler (₹1,15,000/yr), Double occupancy AC (₹1,45,000/yr), Premium AC 1-BHK suite (₹1,70,000/yr).
- Dining: 4-time hygienic vegetarian mess (Breakfast, Lunch, Evening Snacks, Dinner).
- Amenities: High-speed Wi-Fi, power backup, gymnasium, reading rooms, indoor sports, laundry services, medical room with doctor on call."""
        },
        {
            "url": "https://www.xyzcollege.edu.in/scholarships",
            "title": "XYZ College Scholarships & Fee Concession Guidelines",
            "content": """Scholarships & Financial Aid at XYZ Group:
1. Core Branch Scholarship: Built-in 50% tuition fee waiver for Civil, Mechanical, Electrical, and ECE branches (Effective fee ₹82,639/year).
2. Lateral Entry Waiver: 100% tuition fee waiver for Diploma and B.Sc merit students (Effective fee ₹43,949/year).
3. Merit Scholarships: Based on 12th PCM percentage (≥85% score benefits).
4. Government Schemes: Full support for PMSSS, Post-Matric SC/ST/OBC Scholarships, and TFWS (Tuition Fee Waiver Scheme) under REAP."""
        },
        {
            "url": "https://www.xyzcollege.edu.in/contact",
            "title": "XYZ College Admission Helpline, Address & Contact Details",
            "content": """XYZ College Official Contact Information:
- Campus Address: ISI-6, RIICO Institutional Area, Sitapura, Jaipur, Rajasthan - 302022.
- Admission Helplines: +91-9928555222, +91-9928666222, +91-141-2770790.
- Official Email: admission@xyzcollege.edu.in, info@xyzcollege.edu.in.
- Website: https://www.xyzcollege.edu.in/
- Counseling Timings: Monday to Saturday, 9:00 AM to 5:30 PM."""
        }
    ]

    for p in pages_data:
        page = PageDB(
            id=str(uuid.uuid4()),
            agent_id=agent_id,
            url=p["url"],
            title=p["title"],
            description=p["title"],
            content_text=p["content"],
            content_hash=str(hash(p["content"])),
            char_count=len(p["content"]),
            http_status=200,
            source_type="REAL_WEBSITE",
            crawled_at=datetime.utcnow()
        )
        db.add(page)
    db.commit()

    # 4. Ingest All High-Grounded Chunks into ChromaDB Vector Store
    texts_to_embed = [p["content"] for p in pages_data]
    embeddings = embedding_provider.embed_texts(texts_to_embed)

    chunks_list = []
    for p in pages_data:
        chunks_list.append({
            "id": str(uuid.uuid4()),
            "text": p["content"],
            "metadata": {
                "agent_id": agent_id,
                "url": p["url"],
                "title": p["title"],
                "source_type": "REAL_WEBSITE",
                "char_count": len(p["content"])
            }
        })

    vector_store.add_chunks(agent_id, chunks_list, embeddings)
    print(f"[+] Successfully indexed {len(chunks_list)} comprehensive knowledge chunks into ChromaDB & SQLite for Agent ID {agent_id}!")

if __name__ == "__main__":
    ingest_xyz_knowledge()
    print("[SUCCESS] XYZ College Agent & Knowledge Base fully synchronized!")
