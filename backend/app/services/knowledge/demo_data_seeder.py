import uuid
import datetime
from sqlalchemy.orm import Session
from app.models.schemas import PageDB, EntityDB
from app.services.knowledge.chunker import chunk_text
from app.services.knowledge.vector_store import vector_store
from app.services.crawler.parser import compute_content_hash
from app.services.llm.provider import get_embedding_provider
from app.core.config import settings

EDUCATION_DEMO_PAGES = [
    {
        "url": "https://demo.university.internal/student-support/exam-schedule",
        "title": "[DEMO DATA] Semester Examination Schedule & Deadlines",
        "description": "Official student exam registration, admit card dates, and tentative timetable for semester exams.",
        "source_type": "DEMO_DATA",
        "content_text": """[DEMO DATA - STUDENT SUPPORT]
Document: Semester Examination Schedule & Guidelines
Source Type: DEMO DATA (University Student Portal Mock)

Key Examination Dates & Instructions:
1. Exam Form Submission Deadline: 15th April (Without late fee) / 22nd April (With Rs. 500 late fee).
2. Admit Card Release Date: Available on student portal 5 days prior to first theory exam.
3. Mid-Term Examination: First week of October (Odd Sem) / First week of March (Even Sem).
4. End-Term Theory Examinations: Begins from 2nd May for undergraduate (B.Tech/BBA/BCA) and postgraduate (M.Tech/MBA) batches.
5. Practical / Viva Voce Examinations: Conducted 10 days before theory commencement in departmental labs.
6. Re-evaluation & Backlog Forms: Must be submitted within 14 days of result declaration via Student ERP."""
    },
    {
        "url": "https://demo.university.internal/student-support/academic-calendar",
        "title": "[DEMO DATA] Academic Calendar & Attendance Policy",
        "description": "Standard academic session calendar, holiday list, and 75% minimum attendance rule.",
        "source_type": "DEMO_DATA",
        "content_text": """[DEMO DATA - STUDENT SUPPORT]
Document: University Academic Calendar & Attendance Regulations
Source Type: DEMO DATA (Mock Academic Registry)

Attendance Policy & Regulations:
1. Minimum Attendance Requirement: Every student must maintain at least 75% aggregate attendance across all registered courses to be eligible for End-Semester examinations.
2. Medical Condonation: Up to 10% relaxation (lowering threshold to 65%) may be granted by the Dean of Academics upon submission of valid medical certificates within 7 days of absence.
3. Semester Break & Vacations: Winter Break (Dec 20 - Jan 5), Summer Internship / Vacation (June 1 - July 15).
4. Continuous Assessment Breakdown: 30% Internal (Assignments, Quizzes, Mid-Term), 70% End-Term Final Exam."""
    },
    {
        "url": "https://demo.university.internal/student-support/hostel-rules",
        "title": "[DEMO DATA] Campus Hostel Rules, Curfew & Mess Timings",
        "description": "Guidelines for on-campus residential hostels, mess meal timings, and gate pass procedures.",
        "source_type": "DEMO_DATA",
        "content_text": """[DEMO DATA - STUDENT SUPPORT]
Document: Campus Residential Hostel Regulations
Source Type: DEMO DATA (Mock Campus Administration)

Hostel Timings & Rules:
1. Hostel Entry Curfew: 9:00 PM for all boys and girls hostel wings. Late entry requires prior warden approval via parent SMS.
2. Mess Timings:
   - Breakfast: 7:30 AM – 9:00 AM
   - Lunch: 12:30 PM – 2:00 PM
   - Evening Tea: 5:00 PM – 6:00 PM
   - Dinner: 7:30 PM – 9:30 PM
3. Night Out / Outstation Leave: Digital Gate Pass must be applied 24 hours in advance on the student hostel app and approved by local guardian."""
    },
    {
        "url": "https://demo.university.internal/faculty/leave-policy-handbook",
        "title": "[DEMO DOCUMENT] Faculty Leave Policy & Service Rules",
        "description": "Comprehensive leave rules, entitlement for teaching and research staff.",
        "source_type": "DEMO_DOCUMENT",
        "content_text": """[DEMO DOCUMENT - FACULTY & STAFF HANDBOOK]
Document: University Faculty Leave Regulations & Service Manual
Source Type: DEMO DOCUMENT (HR & Academic Council Policies)

Faculty Leave Entitlements:
1. Casual Leave (CL): 12 days per calendar year. Maximum 3 consecutive days may be availed at one time.
2. Academic / Duty Leave (DL): Up to 15 days per academic year for attending conferences, symposiums, Ph.D. defense, or university external evaluation duties.
3. Medical Leave: 10 days on half pay or 5 days on full pay with registered medical practitioner certificate.
4. Earned Leave (EL): 10 days for non-vacation staff or 1/30th of vacation period spent on duty.
5. Maternity Leave: 180 days with full pay as per statutory norms; Paternity Leave: 15 days."""
    },
    {
        "url": "https://demo.university.internal/faculty/research-grant-policy",
        "title": "[DEMO DOCUMENT] Research Grant & Conference Reimbursement Policy",
        "description": "Guidelines for faculty seed funding, Scopus/SCI publication rewards, and travel allowance.",
        "source_type": "DEMO_DOCUMENT",
        "content_text": """[DEMO DOCUMENT - FACULTY & STAFF HANDBOOK]
Document: Research Promotion, Seed Grants & Publication Incentives
Source Type: DEMO DOCUMENT (Research & Development Cell)

Research Reimbursement & Support:
1. National Conference Travel Grant: 100% registration fee + AC-II train travel reimbursement up to Rs. 15,000 per faculty per year for presenting peer-reviewed papers.
2. International Conference Grant: Up to Rs. 50,000 once every two years for reputed IEEE / ACM / Springer indexed conferences.
3. Publication Reward: Rs. 10,000 incentive for first author papers published in SCI / Scopus Q1 indexed journals.
4. Internal Seed Research Grant: Faculty can apply for seed funding up to Rs. 1.5 Lakhs for innovative student-faculty prototyping projects approved by the Dean (R&D)."""
    }
]

def seed_education_demo_data(agent_id: str, db: Session):
    """
    Seeds clearly labeled DEMO datasets for education agents if not already present.
    """
    embedding_provider = get_embedding_provider()
    
    for item in EDUCATION_DEMO_PAGES:
        url = item["url"]
        existing = db.query(PageDB).filter(PageDB.agent_id == agent_id, PageDB.url == url).first()
        if existing:
            continue
            
        page_id = str(uuid.uuid4())
        page = PageDB(
            id=page_id,
            agent_id=agent_id,
            url=url,
            title=item["title"],
            description=item["description"],
            content_text=item["content_text"],
            content_hash=compute_content_hash(item["content_text"]),
            char_count=len(item["content_text"]),
            source_type=item["source_type"],
            http_status=200
        )
        db.add(page)
        
        # Add corresponding structured entity
        ent_type = "student_support" if item["source_type"] == "DEMO_DATA" else "faculty_policy"
        ent_name = item["title"].replace("[DEMO DATA] ", "").replace("[DEMO DOCUMENT] ", "")
        entity = EntityDB(
            id=str(uuid.uuid4()),
            agent_id=agent_id,
            page_id=page_id,
            entity_type=ent_type,
            entity_name=ent_name,
            attributes={"source_type": item["source_type"], "document_scope": "Internal Campus Policy"},
            source_url=url,
            source_type=item["source_type"]
        )
        db.add(entity)
        
        # Chunk and embed into ChromaDB
        chunks = chunk_text(
            text=item["content_text"],
            url=url,
            title=item["title"],
            page_id=page_id,
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP
        )
        for c in chunks:
            c["metadata"]["agent_id"] = agent_id
            c["metadata"]["sector"] = "college"
            c["metadata"]["content_type"] = "demo_resource"
            c["metadata"]["source_type"] = item["source_type"]
            
        if chunks:
            try:
                texts = [c["text"] for c in chunks]
                embs = embedding_provider.embed_texts(texts)
                vector_store.add_chunks(agent_id, chunks, embs)
            except Exception as err:
                print(f"[DemoSeeder] Vector embedding error for {url}: {err}")
                
    db.commit()
    print(f"[DemoSeeder] Seeded education demo datasets for agent {agent_id}")
    
    # Also seed initial demo admission leads for dashboard
    seed_demo_admission_leads(agent_id, db)


DEMO_ADMISSION_LEADS = [
    {
        "student_name": "Rahul Sharma",
        "mobile_number": "9829012345",
        "father_name": "Manoj Sharma",
        "percentage": 88.5,
        "annual_income": "₹16 LPA",
        "course_name": "B.Tech Computer Science Engineering",
        "preferred_department": "Computer Science & Engineering",
        "email": "rahul.sharma88@gmail.com",
        "city": "Jaipur",
        "state": "Rajasthan",
        "entrance_exam": "JEE Main",
        "entrance_score": "94.2 %ile",
        "admission_year": "2026",
        "hostel_required": "Yes",
        "lead_score": 92,
        "lead_temperature": "HOT",
        "academic_qualification": "ELIGIBLE",
        "qualification_status": "Academic score (88.5%) and JEE percentile meet standard direct merit criteria.",
        "lead_factors": [
            "Specific course identified: B.Tech Computer Science Engineering",
            "High Financial Capability: ₹16 LPA annual income",
            "Strong Academic Merit: 88.5% with 94.2 %ile JEE",
            "Active 2026-27 intake timeline",
            "Outstation hostel accommodation requested"
        ]
    },
    {
        "student_name": "Aman Verma",
        "mobile_number": "9876543210",
        "father_name": "Suresh Verma",
        "percentage": 52.0,
        "annual_income": "₹18 LPA",
        "course_name": "Bachelor of Business Administration (BBA)",
        "preferred_department": "Management & Business Studies",
        "email": "aman.verma.biz@yahoo.com",
        "city": "Kota",
        "state": "Rajasthan",
        "entrance_exam": "None",
        "entrance_score": "",
        "admission_year": "2026",
        "hostel_required": "Yes",
        "lead_score": 88,
        "lead_temperature": "HOT",
        "academic_qualification": "NEEDS_REVIEW",
        "qualification_status": "Academic score (52.0%) is borderline. Eligible for entrance counseling or management quota review.",
        "lead_factors": [
            "High Financial Capability: ₹18 LPA family income",
            "Immediate admission timeline & intake urgency",
            "Requested admissions counselor phone consultation",
            "Target Program Identified: BBA",
            "Outstation candidate requiring campus residential hostel"
        ]
    },
    {
        "student_name": "Priya Patel",
        "mobile_number": "9414098765",
        "father_name": "Rajesh Patel",
        "percentage": 84.0,
        "annual_income": "₹6 LPA",
        "course_name": "B.Tech Artificial Intelligence & Data Science",
        "preferred_department": "AI & Data Science",
        "email": "priya.patel.ai@gmail.com",
        "city": "Ahmedabad",
        "state": "Gujarat",
        "entrance_exam": "GUJCET",
        "entrance_score": "88.4 Marks",
        "admission_year": "2026",
        "hostel_required": "Yes",
        "lead_score": 82,
        "lead_temperature": "HOT",
        "academic_qualification": "ELIGIBLE",
        "qualification_status": "Academic score (84.0%) meets direct admission prerequisites.",
        "lead_factors": [
            "Specific course identified: B.Tech AI & Data Science",
            "Strong Academic Merit: 84.0%",
            "Active 2026 intake timeline",
            "Requested scholarship and fee breakdown"
        ]
    },
    {
        "student_name": "Rohan Gupta",
        "mobile_number": "9828112233",
        "father_name": "Ramesh Gupta",
        "percentage": 68.0,
        "annual_income": "₹14 LPA",
        "course_name": "Master of Business Administration (MBA)",
        "preferred_department": "Management Studies",
        "email": "rohan.gupta.mba@outlook.com",
        "city": "Delhi",
        "state": "Delhi NCR",
        "entrance_exam": "CAT",
        "entrance_score": "76.5 %ile",
        "admission_year": "2026",
        "hostel_required": "No",
        "lead_score": 78,
        "lead_temperature": "HOT",
        "academic_qualification": "ELIGIBLE",
        "qualification_status": "Graduation score (68.0%) and CAT percentile meet eligibility.",
        "lead_factors": [
            "High Financial Capability: ₹14 LPA annual income",
            "Target Program Identified: MBA",
            "Standard Academic Score: 68.0%",
            "Requested campus executive tour"
        ]
    },
    {
        "student_name": "Sneha Joshi",
        "mobile_number": "9166778899",
        "father_name": "Dinesh Joshi",
        "percentage": 62.5,
        "annual_income": "₹3.5 LPA",
        "course_name": "Bachelor of Computer Applications (BCA)",
        "preferred_department": "Computer Applications",
        "email": "sneha.joshi@gmail.com",
        "city": "Ajmer",
        "state": "Rajasthan",
        "entrance_exam": "None",
        "entrance_score": "",
        "admission_year": "2026",
        "hostel_required": "No",
        "lead_score": 65,
        "lead_temperature": "WARM",
        "academic_qualification": "ELIGIBLE",
        "qualification_status": "Academic score (62.5%) meets direct BCA eligibility.",
        "lead_factors": [
            "Course Identified: BCA",
            "Standard Academic Score: 62.5%",
            "Inquired about state government scholarship eligibility"
        ]
    },
    {
        "student_name": "Vikram Singh",
        "mobile_number": "9785123456",
        "father_name": "Karan Singh",
        "percentage": 48.0,
        "annual_income": "₹3 LPA",
        "course_name": "General Engineering Inquiry",
        "preferred_department": "Admissions Cell",
        "email": "vikram.singh@gmail.com",
        "city": "Alwar",
        "state": "Rajasthan",
        "entrance_exam": "None",
        "entrance_score": "",
        "admission_year": "2027",
        "hostel_required": "No",
        "lead_score": 42,
        "lead_temperature": "COLD",
        "academic_qualification": "NEEDS_REVIEW",
        "qualification_status": "Academic score (48.0%) is low; timeline is deferred to next academic session.",
        "lead_factors": [
            "Deferred timeline: 2027 session",
            "General inquiry without specific specialization commitment",
            "Academic score requires counselor review"
        ]
    },
    {
        "student_name": "Aditya Roy",
        "mobile_number": "9929887766",
        "father_name": "Subhash Roy",
        "percentage": 91.2,
        "annual_income": "₹12 LPA",
        "course_name": "B.Tech Internet of Things (IoT)",
        "preferred_department": "Electronics & IoT",
        "email": "aditya.roy.tech@gmail.com",
        "city": "Udaipur",
        "state": "Rajasthan",
        "entrance_exam": "JEE Main",
        "entrance_score": "96.1 %ile",
        "admission_year": "2026",
        "hostel_required": "Yes",
        "lead_score": 95,
        "lead_temperature": "HOT",
        "academic_qualification": "ELIGIBLE",
        "qualification_status": "Outstanding academic score (91.2%) meets top-tier merit scholarship criteria.",
        "lead_factors": [
            "Specific course identified: B.Tech Internet of Things",
            "Top Tier Academic Merit: 91.2% with 96.1 %ile JEE",
            "Requested immediate counselor video call",
            "High Financial Capability: ₹12 LPA annual income",
            "Hostel residential requirement noted"
        ]
    },
    {
        "student_name": "Ananya Mehra",
        "mobile_number": "9829334455",
        "father_name": "Vinod Mehra",
        "percentage": 72.0,
        "annual_income": "₹8.5 LPA",
        "course_name": "B.Tech Mechanical Engineering",
        "preferred_department": "Mechanical Engineering",
        "email": "ananya.mehra@gmail.com",
        "city": "Jodhpur",
        "state": "Rajasthan",
        "entrance_exam": "REAP / JEE",
        "entrance_score": "81.0 %ile",
        "admission_year": "2026",
        "hostel_required": "Yes",
        "lead_score": 80,
        "lead_temperature": "HOT",
        "academic_qualification": "ELIGIBLE",
        "qualification_status": "Academic score (72.0%) satisfies core engineering prerequisites.",
        "lead_factors": [
            "Course Identified: B.Tech Mechanical Engineering",
            "Requested official application link & admission form",
            "Standard Academic Merit: 72.0%",
            "Active 2026 intake candidate"
        ]
    }
]

def seed_demo_admission_leads(agent_id: str, db: Session):
    """
    Seeds realistic synthetic admission leads for college agents with source=DEMO_DATA.
    """
    from app.models.schemas import AdmissionLeadDB
    
    existing_count = db.query(AdmissionLeadDB).filter(
        AdmissionLeadDB.agent_id == agent_id,
        AdmissionLeadDB.source == "DEMO_DATA"
    ).count()
    
    if existing_count > 0:
        return
        
    for item in DEMO_ADMISSION_LEADS:
        lead_id = str(uuid.uuid4())
        lead = AdmissionLeadDB(
            id=lead_id,
            agent_id=agent_id,
            student_name=item["student_name"],
            mobile_number=item["mobile_number"],
            father_name=item.get("father_name", ""),
            percentage=item.get("percentage"),
            annual_income=item.get("annual_income", ""),
            course_name=item.get("course_name", ""),
            preferred_department=item.get("preferred_department", ""),
            email=item.get("email", ""),
            city=item.get("city", ""),
            state=item.get("state", ""),
            entrance_exam=item.get("entrance_exam", ""),
            entrance_score=item.get("entrance_score", ""),
            admission_year=item.get("admission_year", "2026"),
            hostel_required=item.get("hostel_required", "No"),
            lead_score=item["lead_score"],
            lead_temperature=item["lead_temperature"],
            academic_qualification=item["academic_qualification"],
            qualification_status=item["qualification_status"],
            lead_factors=item["lead_factors"],
            source="DEMO_DATA",
            created_at=datetime.datetime.utcnow() - datetime.timedelta(hours=hash(item["student_name"]) % 48),
            updated_at=datetime.datetime.utcnow()
        )
        db.add(lead)
        
    db.commit()
    print(f"[DemoSeeder] Seeded {len(DEMO_ADMISSION_LEADS)} synthetic admission leads for agent {agent_id}")


