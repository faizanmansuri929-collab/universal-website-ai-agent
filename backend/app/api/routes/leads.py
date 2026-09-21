import uuid
import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.models.schemas import (
    AgentDB, AdmissionLeadDB, CallbackRequestDB,
    AdmissionLeadSchema, AdmissionLeadCreate,
    CallbackRequestSchema, CallbackCreateRequest,
    LeadsSummaryResponse
)
from app.services.rag.education_agent import create_counselor_callback
from app.services.knowledge.demo_data_seeder import seed_demo_admission_leads

router = APIRouter(prefix="/agents/{agent_id}", tags=["Admission Leads & Callbacks"])

@router.get("/leads", response_model=LeadsSummaryResponse)
async def get_agent_leads(
    agent_id: str,
    source: Optional[str] = Query(None, description="Filter by source: REAL_CHAT, DEMO_DATA, or ALL"),
    temperature: Optional[str] = Query(None, description="Filter by temperature: HOT, WARM, COLD"),
    search: Optional[str] = Query(None, description="Search by student name or course"),
    db: Session = Depends(get_db)
):
    agent = db.query(AgentDB).filter(AgentDB.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # If college sector and no demo leads yet, seed them
    if agent.detected_sector == "college":
        seed_demo_admission_leads(agent_id, db)

    query = db.query(AdmissionLeadDB).filter(AdmissionLeadDB.agent_id == agent_id)

    # Compute overall statistics before filters
    all_leads = query.all()
    total_leads = len(all_leads)
    hot_leads = sum(1 for l in all_leads if l.lead_temperature == "HOT")
    warm_leads = sum(1 for l in all_leads if l.lead_temperature == "WARM")
    cold_leads = sum(1 for l in all_leads if l.lead_temperature == "COLD")
    real_leads_count = sum(1 for l in all_leads if l.source == "REAL_CHAT")
    demo_leads_count = sum(1 for l in all_leads if l.source == "DEMO_DATA")
    
    # High income leads (>= 10 LPA or Cr)
    high_income_leads = sum(
        1 for l in all_leads 
        if l.annual_income and any(k in l.annual_income.lower() for k in ["10", "12", "14", "15", "16", "18", "20", "25", "cr"])
    )

    # Apply filters
    if source and source.upper() != "ALL":
        query = query.filter(AdmissionLeadDB.source == source.upper())
    if temperature and temperature.upper() != "ALL":
        query = query.filter(AdmissionLeadDB.lead_temperature == temperature.upper())
    if search:
        s = f"%{search.strip().lower()}%"
        query = query.filter(
            (AdmissionLeadDB.student_name.ilike(s)) |
            (AdmissionLeadDB.course_name.ilike(s)) |
            (AdmissionLeadDB.mobile_number.ilike(s))
        )

    leads = query.order_by(
        desc(AdmissionLeadDB.source == "REAL_CHAT"), # Put real captured leads first
        desc(AdmissionLeadDB.lead_score),
        desc(AdmissionLeadDB.created_at)
    ).all()

    return LeadsSummaryResponse(
        total_leads=total_leads,
        hot_leads=hot_leads,
        warm_leads=warm_leads,
        cold_leads=cold_leads,
        real_leads_count=real_leads_count,
        demo_leads_count=demo_leads_count,
        high_income_leads=high_income_leads,
        leads=[AdmissionLeadSchema.from_orm(l) if hasattr(AdmissionLeadSchema, "from_orm") else AdmissionLeadSchema.model_validate(l) for l in leads]
    )

@router.get("/leads/{lead_id}", response_model=AdmissionLeadSchema)
async def get_lead_detail(
    agent_id: str,
    lead_id: str,
    db: Session = Depends(get_db)
):
    lead = db.query(AdmissionLeadDB).filter(
        AdmissionLeadDB.id == lead_id,
        AdmissionLeadDB.agent_id == agent_id
    ).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Admission lead not found")

    return AdmissionLeadSchema.from_orm(lead) if hasattr(AdmissionLeadSchema, "from_orm") else AdmissionLeadSchema.model_validate(lead)

@router.post("/callback", response_model=CallbackRequestSchema)
async def request_counselor_callback(
    agent_id: str,
    req: CallbackCreateRequest,
    db: Session = Depends(get_db)
):
    agent = db.query(AgentDB).filter(AgentDB.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    cb = create_counselor_callback(
        agent_id=agent_id,
        student_name=req.student_name,
        mobile_number=req.mobile_number,
        course=req.course,
        preferred_time=req.preferred_time or "Today - ASAP",
        lead_id=req.lead_id,
        db=db
    )
    return CallbackRequestSchema.from_orm(cb) if hasattr(CallbackRequestSchema, "from_orm") else CallbackRequestSchema.model_validate(cb)

@router.get("/callbacks", response_model=List[CallbackRequestSchema])
async def get_agent_callbacks(
    agent_id: str,
    db: Session = Depends(get_db)
):
    cbs = db.query(CallbackRequestDB).filter(
        CallbackRequestDB.agent_id == agent_id
    ).order_by(desc(CallbackRequestDB.created_at)).all()
    return [CallbackRequestSchema.from_orm(c) if hasattr(CallbackRequestSchema, "from_orm") else CallbackRequestSchema.model_validate(c) for c in cbs]
