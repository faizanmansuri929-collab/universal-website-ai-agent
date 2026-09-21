import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.schemas import (
    AgentDB, ChatLogDB, ChatRequest, ChatResponse, CitationSchema,
    BookingRequest, BookingResponse
)
from app.services.rag.engine import query_rag_engine
from app.services.rag.education_agent import create_mock_booking

router = APIRouter(prefix="/agents/{agent_id}", tags=["Chat & Actions"])

@router.post("/chat", response_model=ChatResponse)
async def chat_with_agent(
    agent_id: str,
    req: ChatRequest,
    db: Session = Depends(get_db)
):
    agent = db.query(AgentDB).filter(AgentDB.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    user_msg = req.message.strip()
    if not user_msg:
        raise HTTPException(status_code=400, detail="Empty chat message")

    history_dicts = [{"role": m.role, "content": m.content} for m in (req.history or [])]

    # Run Sector-Aware RAG answer engine with Education Agent support & Debug Trace
    (
        answer,
        citations,
        debug_trace,
        lead_score,
        enrollment_prediction,
        admission_lead,
        apply_url,
        management_quota_url,
        suggested_actions,
        booking_slots
    ) = await query_rag_engine(
        agent_id=agent_id,
        user_message=user_msg,
        history=history_dicts,
        mode=req.mode or "student",
        include_debug=bool(req.debug)
    )

    # Log chat history
    citations_data = [c.dict() if hasattr(c, "dict") else c for c in citations]
    chat_log = ChatLogDB(
        id=str(uuid.uuid4()),
        agent_id=agent_id,
        user_message=user_msg,
        bot_answer=answer,
        citations=citations_data
    )
    db.add(chat_log)
    db.commit()

    return ChatResponse(
        answer=answer,
        citations=citations,
        debug_trace=debug_trace,
        lead_score=lead_score,
        enrollment_prediction=enrollment_prediction,
        admission_lead=admission_lead,
        apply_url=apply_url,
        management_quota_url=management_quota_url,
        suggested_actions=suggested_actions,
        booking_slots=booking_slots
    )



@router.post("/booking", response_model=BookingResponse)
async def book_counselor_slot(
    agent_id: str,
    req: BookingRequest,
    db: Session = Depends(get_db)
):
    agent = db.query(AgentDB).filter(AgentDB.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    booking_res = create_mock_booking(
        slot_id=req.slot_id,
        name=req.name,
        email=req.email,
        phone=req.phone,
        course_interest=req.course_interest
    )
    return booking_res

