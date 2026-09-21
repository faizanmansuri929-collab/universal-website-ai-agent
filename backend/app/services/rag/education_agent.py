import re
import uuid
import datetime
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from app.models.schemas import (
    LeadScoreSchema, EnrollmentPredictionSchema, BookingSlotSchema, BookingResponse,
    AdmissionLeadDB, AdmissionLeadSchema, CallbackRequestDB
)

MOCK_BOOKING_SLOTS = [
    {
        "id": "slot-counselor-10am",
        "title": "Admissions Senior Counselor Video Call",
        "date": "Tomorrow",
        "time": "10:00 AM",
        "type": "counselor_call",
        "is_available": True
    },
    {
        "id": "slot-counselor-12pm",
        "title": "Admissions Senior Counselor Video Call",
        "date": "Tomorrow",
        "time": "12:00 PM",
        "type": "counselor_call",
        "is_available": True
    },
    {
        "id": "slot-counselor-3pm",
        "title": "Admissions Senior Counselor Video Call",
        "date": "Tomorrow",
        "time": "03:00 PM",
        "type": "counselor_call",
        "is_available": True
    },
    {
        "id": "slot-tour-morning",
        "title": "Guided Campus & Lab Tour",
        "date": "Saturday",
        "time": "11:00 AM",
        "type": "campus_tour",
        "is_available": True
    },
    {
        "id": "slot-callback-now",
        "title": "Request Immediate Advisor Callback",
        "date": "Today",
        "time": "Within 30 mins",
        "type": "callback",
        "is_available": True
    }
]

def extract_lead_fields_from_conversation(
    current_message: str,
    history: List[Dict[str, str]]
) -> Dict[str, Any]:
    """
    Extracts structured admission lead fields from multi-turn chat history.
    """
    all_turns = [m.get("content", "") for m in history] + [current_message]
    full_text = " ".join(all_turns)
    full_text_lower = full_text.lower()
    
    extracted = {
        "student_name": "",
        "mobile_number": "",
        "father_name": "",
        "percentage": None,
        "annual_income": "",
        "course_name": "",
        "preferred_department": "",
        "email": "",
        "city": "",
        "state": "",
        "entrance_exam": "",
        "entrance_score": "",
        "admission_year": "2026",
        "hostel_required": "",
        "requested_counselor": False,
        "requested_apply": False
    }

    # 1. Mobile Number (10 digits, optionally with +91 or dashes)
    phone_match = re.search(r"(?:\+91[\-\s]?)?[6789]\d{9}", full_text)
    if phone_match:
        extracted["mobile_number"] = phone_match.group(0).replace(" ", "").replace("-", "")

    # 2. Email Address
    email_match = re.search(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", full_text)
    if email_match:
        extracted["email"] = email_match.group(0)

    # 3. Student Name (e.g. "My name is Rahul Sharma", "I am Rahul", "Name: Rahul")
    name_match = re.search(r"(?:my name is|i am|name[:\s]+)\s*([A-Za-z\s]{2,25})(?:,|\.|\n|$|and|\sand)", full_text, re.IGNORECASE)
    if name_match:
        cand = name_match.group(1).strip()
        if len(cand.split()) <= 3 and not any(w in cand.lower() for w in ["student", "interested", "applying", "calling", "admission"]):
            extracted["student_name"] = cand.title()

    # 4. Father's Name (e.g. "Father's name is Manoj Sharma", "Father name Manoj")
    father_match = re.search(r"(?:father(?:'s)?(?:\s+name)?(?:\s+is)?[:\s]+)\s*([A-Za-z\s]{2,25})(?:,|\.|\n|$|and)", full_text, re.IGNORECASE)
    if father_match:
        cand = father_match.group(1).strip()
        if len(cand.split()) <= 3 and not any(w in cand.lower() for w in ["business", "service", "lpa", "lakh"]):
            extracted["father_name"] = cand.title()

    # 5. Academic Percentage / Score (e.g. "88%", "52 in PCM", "scored 65.5%")
    pct_match = re.search(r"(?:scored|got|have|with|is)?\s*(\b\d{2}(?:\.\d{1,2})?\b)\s*(?:%|percent|percentage|\s*(?:in|marks|pcm|pcb|aggregate))", full_text, re.IGNORECASE)
    if pct_match:
        try:
            val = float(pct_match.group(1))
            if 30 <= val <= 100:
                extracted["percentage"] = val
        except ValueError:
            pass

    # 6. Annual Family Income (e.g. "18 LPA", "12 Lakhs", "4.5 LPA", "₹18,00,000", "income is 15 lpa")
    income_match = re.search(r"(?:income(?:\s+is)?[:\s]*)?(?:₹\s*)?(\d+(?:\.\d+)?)\s*(?:lpa|lakh|lakhs|lac|lacs|cr)", full_text, re.IGNORECASE)
    if income_match:
        extracted["annual_income"] = f"₹{income_match.group(1)} LPA"
    elif "income" in full_text_lower:
        num_m = re.search(r"(?:income.*?)(?:₹\s*)?(\d{5,8})", full_text_lower)
        if num_m:
            extracted["annual_income"] = f"₹{int(num_m.group(1)):,}"

    # 7. Interested Course
    course_keywords = [
        ("b.tech computer science", "B.Tech Computer Science Engineering"),
        ("computer science", "B.Tech Computer Science Engineering"),
        ("b.tech cse", "B.Tech Computer Science Engineering"),
        ("cse", "B.Tech Computer Science Engineering"),
        ("artificial intelligence", "B.Tech Artificial Intelligence & Data Science"),
        ("ai & data science", "B.Tech Artificial Intelligence & Data Science"),
        ("ai and data science", "B.Tech Artificial Intelligence & Data Science"),
        ("ai/ds", "B.Tech Artificial Intelligence & Data Science"),
        ("internet of things", "B.Tech Internet of Things (IoT)"),
        ("iot", "B.Tech Internet of Things (IoT)"),
        ("civil engineering", "B.Tech Civil Engineering"),
        ("mechanical engineering", "B.Tech Mechanical Engineering"),
        ("electrical engineering", "B.Tech Electrical Engineering"),
        ("b.tech", "B.Tech Engineering"),
        ("m.tech", "M.Tech"),
        ("bba", "Bachelor of Business Administration (BBA)"),
        ("bca", "Bachelor of Computer Applications (BCA)"),
        ("mba", "Master of Business Administration (MBA)"),
        ("mca", "Master of Computer Applications (MCA)")
    ]
    for key, cname in course_keywords:
        if key in full_text_lower:
            extracted["course_name"] = cname
            break

    # 8. Admission Year & Intake Timeline
    if any(k in full_text_lower for k in ["2026", "2026-27", "this year", "immediate", "urgent", "upcoming"]):
        extracted["admission_year"] = "2026"
    elif any(k in full_text_lower for k in ["2027", "next year"]):
        extracted["admission_year"] = "2027"

    # 9. Entrance Exam & Score
    if "jee" in full_text_lower:
        extracted["entrance_exam"] = "JEE Main"
    elif "gate" in full_text_lower:
        extracted["entrance_exam"] = "GATE"
    elif "cat" in full_text_lower or "mat" in full_text_lower:
        extracted["entrance_exam"] = "CAT/MAT"
    elif "cuet" in full_text_lower:
        extracted["entrance_exam"] = "CUET"

    # 10. Hostel Requirement
    if any(k in full_text_lower for k in ["hostel", "stay", "accommodation", "room", "boarding"]):
        extracted["hostel_required"] = "Yes"

    # 11. Intent Signals
    if any(k in full_text_lower for k in ["counselor", "advisor", "call me", "callback", "talk to", "contact me", "speak"]):
        extracted["requested_counselor"] = True
    if any(k in full_text_lower for k in ["apply", "application link", "admission form", "how to apply", "registration"]):
        extracted["requested_apply"] = True

    return extracted


def compute_lead_scoring_and_qualification(
    lead_data: Dict[str, Any],
    all_text: str
) -> Tuple[LeadScoreSchema, str, str, List[str]]:
    """
    Computes explainable Lead Priority Score (0-100, HOT/WARM/COLD)
    and SEPARATE Academic Qualification status (ELIGIBLE / NEEDS_REVIEW).
    
    IMPORTANT RULE:
    A student with lower percentage (e.g. 52%) + high family income (e.g. ₹18 LPA)
    gets a HIGH Lead Priority (HOT), while Academic Qualification is 'NEEDS_REVIEW'.
    """
    score = 20  # Base inquiry score
    factors = ["Initial admission engagement recorded"]
    
    # 1. Course Selection
    if lead_data.get("course_name"):
        score += 25
        factors.append(f"Target Program Identified: {lead_data['course_name']}")

    # 2. Annual Family Income Signal
    income_str = lead_data.get("annual_income", "")
    inc_num_m = re.search(r"(\d+(?:\.\d+)?)", income_str)
    if inc_num_m:
        inc_val = float(inc_num_m.group(1))
        if inc_val >= 10.0 or "cr" in income_str.lower():
            score += 20
            factors.append(f"High Financial Capability: {income_str} annual income")
        elif inc_val >= 5.0:
            score += 10
            factors.append(f"Moderate Financial Capability: {income_str} annual income")
    
    # 3. Admission Urgency / Year
    if lead_data.get("admission_year") in ["2026", "this year"] or any(k in all_text for k in ["immediate", "urgent", "2026"]):
        score += 15
        factors.append("Active 2026-27 intake timeline detected")

    # 4. Counselor Callback or Application Link Request
    if lead_data.get("requested_counselor") or any(k in all_text for k in ["counselor", "call", "callback"]):
        score += 20
        factors.append("Direct admissions counselor callback requested")
    elif lead_data.get("requested_apply") or any(k in all_text for k in ["apply", "form", "application"]):
        score += 15
        factors.append("Application link & registration requested")

    # 5. Completed Contact Information
    has_name = bool(lead_data.get("student_name"))
    has_phone = bool(lead_data.get("mobile_number"))
    if has_name and has_phone:
        score += 15
        factors.append("Verified student identity and mobile contact")
    elif has_name or has_phone:
        score += 5

    # 6. Hostel Requirement
    if lead_data.get("hostel_required") == "Yes":
        score += 10
        factors.append("Outstation candidate requiring campus residential hostel")

    # 7. Academic Score
    pct = lead_data.get("percentage")
    if pct is not None:
        if pct >= 75.0:
            score += 10
            factors.append(f"Strong Academic Merit: {pct}%")
        elif pct >= 60.0:
            score += 5
            factors.append(f"Standard Academic Score: {pct}%")

    final_score = min(100, max(25, score))

    if final_score >= 75:
        temperature = "HOT"
    elif final_score >= 50:
        temperature = "WARM"
    else:
        temperature = "COLD"

    # --- SEPARATE ACADEMIC QUALIFICATION STATUS ---
    if pct is not None:
        if pct >= 60.0:
            acad_status = "ELIGIBLE"
            acad_desc = f"Academic score ({pct}%) meets standard direct eligibility criteria for {lead_data.get('course_name') or 'engineering/management programs'}."
        elif pct >= 45.0:
            acad_status = "NEEDS_REVIEW"
            acad_desc = f"Academic score ({pct}%) is borderline. Eligible for entrance counseling or management quota review."
        else:
            acad_status = "NEEDS_REVIEW"
            acad_desc = f"Academic score ({pct}%) requires special academic committee approval or alternate quota evaluation."
    else:
        acad_status = "NEEDS_REVIEW"
        acad_desc = "Academic percentage pending student confirmation."

    lead_score_obj = LeadScoreSchema(
        score=final_score,
        status=temperature,
        factors=factors,
        is_demo=True
    )

    return lead_score_obj, temperature, acad_status, acad_desc


def persist_admission_lead(
    agent_id: str,
    lead_data: Dict[str, Any],
    lead_score_obj: LeadScoreSchema,
    temperature: str,
    acad_status: str,
    acad_desc: str,
    db: Session
) -> AdmissionLeadDB:
    """
    Saves or updates the captured admission lead in the SQLite database.
    """
    phone = lead_data.get("mobile_number") or ""
    name = lead_data.get("student_name") or "Prospective Student"
    
    # Check if lead already exists by mobile for this agent
    existing = None
    if phone:
        existing = db.query(AdmissionLeadDB).filter(
            AdmissionLeadDB.agent_id == agent_id,
            AdmissionLeadDB.mobile_number == phone
        ).first()

    if not existing and name != "Prospective Student":
        existing = db.query(AdmissionLeadDB).filter(
            AdmissionLeadDB.agent_id == agent_id,
            AdmissionLeadDB.student_name == name,
            AdmissionLeadDB.source == "REAL_CHAT"
        ).first()

    if existing:
        lead = existing
        if name and name != "Prospective Student":
            lead.student_name = name
        if phone:
            lead.mobile_number = phone
        if lead_data.get("father_name"):
            lead.father_name = lead_data["father_name"]
        if lead_data.get("percentage") is not None:
            lead.percentage = lead_data["percentage"]
        if lead_data.get("annual_income"):
            lead.annual_income = lead_data["annual_income"]
        if lead_data.get("course_name"):
            lead.course_name = lead_data["course_name"]
        if lead_data.get("email"):
            lead.email = lead_data["email"]
        if lead_data.get("admission_year"):
            lead.admission_year = lead_data["admission_year"]
        if lead_data.get("hostel_required"):
            lead.hostel_required = lead_data["hostel_required"]
        if lead_data.get("entrance_exam"):
            lead.entrance_exam = lead_data["entrance_exam"]

        lead.lead_score = lead_score_obj.score
        lead.lead_temperature = temperature
        lead.academic_qualification = acad_status
        lead.qualification_status = acad_desc
        lead.lead_factors = lead_score_obj.factors
        lead.updated_at = datetime.datetime.utcnow()
    else:
        lead_id = str(uuid.uuid4())
        lead = AdmissionLeadDB(
            id=lead_id,
            agent_id=agent_id,
            student_name=name,
            mobile_number=phone if phone else f"Inquiry-{lead_id[:6]}",
            father_name=lead_data.get("father_name") or "",
            percentage=lead_data.get("percentage"),
            annual_income=lead_data.get("annual_income") or "",
            course_name=lead_data.get("course_name") or "",
            email=lead_data.get("email") or "",
            city=lead_data.get("city") or "",
            state=lead_data.get("state") or "",
            entrance_exam=lead_data.get("entrance_exam") or "",
            entrance_score=lead_data.get("entrance_score") or "",
            admission_year=lead_data.get("admission_year") or "2026",
            hostel_required=lead_data.get("hostel_required") or "",
            lead_score=lead_score_obj.score,
            lead_temperature=temperature,
            academic_qualification=acad_status,
            qualification_status=acad_desc,
            lead_factors=lead_score_obj.factors,
            source="REAL_CHAT",
            created_at=datetime.datetime.utcnow(),
            updated_at=datetime.datetime.utcnow()
        )
        db.add(lead)

    db.commit()
    db.refresh(lead)
    return lead


def get_admission_ctas(agent_url: str) -> Tuple[str, str]:
    """Returns official Apply Now link and Management Quota link."""
    clean_url = agent_url.rstrip("/")
    apply_url = f"{clean_url}/admissions" if "xyzcollege" in clean_url or "poornima" in clean_url else f"{clean_url}/apply"
    mgmt_url = f"{clean_url}/direct-admission-guidelines"
    return apply_url, mgmt_url


def analyze_lead_and_qualification(
    current_message: str,
    history: List[Dict[str, str]],
    agent_id: Optional[str] = None,
    agent_url: Optional[str] = None,
    db: Optional[Session] = None
) -> Tuple[LeadScoreSchema, EnrollmentPredictionSchema, List[BookingSlotSchema], List[str], Optional[AdmissionLeadSchema], str, str]:
    """
    Main entry point for Education Lead Generation & Admission Analysis.
    """
    all_text = " ".join([m.get("content", "") for m in history] + [current_message]).lower()
    
    # 1. Extract Lead Data from Multi-turn Chat
    lead_data = extract_lead_fields_from_conversation(current_message, history)

    # 2. Compute Explainable Scoring & Academic Qualification
    lead_score, temperature, acad_status, acad_desc = compute_lead_scoring_and_qualification(lead_data, all_text)

    # 3. Compute Enrollment Likelihood Prediction
    likelihood = min(95, max(35, int(lead_score.score * 0.9 + 5)))
    pred_confidence = "High" if lead_score.score >= 75 else "Moderate" if lead_score.score >= 50 else "Low"
    
    pred_factors = [
        f"+ Priority Intent: {temperature} ({lead_score.score}/100)",
        f"+ Academic Profile: {acad_status} ({lead_data.get('percentage') or 'N/A'}%)"
    ]
    if lead_data.get("course_name"):
        pred_factors.append(f"+ Direct alignment with {lead_data['course_name']} intake")
    if lead_data.get("annual_income"):
        pred_factors.append(f"+ Family income tier: {lead_data['annual_income']}")
    if lead_data.get("requested_counselor"):
        pred_factors.append("+ High conversion signal via counselor callback")

    enrollment_prediction = EnrollmentPredictionSchema(
        likelihood_percent=likelihood,
        factors=pred_factors,
        confidence=pred_confidence,
        is_demo=True
    )

    # 4. Determine CTAs
    apply_url, mgmt_url = get_admission_ctas(agent_url or "https://www.xyzcollege.edu.in")

    # 5. Persist Lead in Database if DB session provided
    lead_schema = None
    if agent_id and db:
        try:
            lead_db = persist_admission_lead(agent_id, lead_data, lead_score, temperature, acad_status, acad_desc, db)
            lead_schema = AdmissionLeadSchema.from_orm(lead_db) if hasattr(AdmissionLeadSchema, "from_orm") else AdmissionLeadSchema.model_validate(lead_db)
        except Exception as e:
            print(f"[LeadEngine] Error saving lead to database: {e}")

    # 6. Booking slots and action pills
    booking_slots = [BookingSlotSchema(**s) for s in MOCK_BOOKING_SLOTS]
    
    suggested_actions = []
    if not lead_data.get("course_name"):
        suggested_actions.append("Explore Courses")
    if lead_data.get("percentage") is None:
        suggested_actions.append("Check Eligibility")
    suggested_actions.extend(["Talk to Counselor", "Apply Now", "Explore Management Quota"])

    return lead_score, enrollment_prediction, booking_slots, suggested_actions, lead_schema, apply_url, mgmt_url


def create_counselor_callback(
    agent_id: str,
    student_name: str,
    mobile_number: str,
    course: Optional[str],
    preferred_time: str,
    lead_id: Optional[str],
    db: Session
) -> CallbackRequestDB:
    """Creates and persists a counselor callback request record in SQLite."""
    cb_id = str(uuid.uuid4())
    cb_req = CallbackRequestDB(
        id=cb_id,
        lead_id=lead_id,
        agent_id=agent_id,
        student_name=student_name,
        mobile_number=mobile_number,
        course=course or "",
        preferred_time=preferred_time or "Today - ASAP",
        status="CONFIRMED",
        created_at=datetime.datetime.utcnow()
    )
    db.add(cb_req)
    db.commit()
    db.refresh(cb_req)
    return cb_req


def create_mock_booking(slot_id: str, name: str, email: str, phone: str, course_interest: Optional[str] = None) -> BookingResponse:
    """Generates a mock booking confirmation response."""
    matched_slot = next((s for s in MOCK_BOOKING_SLOTS if s["id"] == slot_id), MOCK_BOOKING_SLOTS[0])
    slot_schema = BookingSlotSchema(**matched_slot)
    return BookingResponse(
        booking_id=f"BOOK-{uuid.uuid4().hex[:6].upper()}",
        status="CONFIRMED",
        message=f"Appointment booked for {name} ({phone}) for {matched_slot['title']} on {matched_slot['date']} at {matched_slot['time']}.",
        slot=slot_schema,
        is_demo=True
    )



