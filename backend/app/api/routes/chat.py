import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.schemas import AgentDB, ChatLogDB, ChatRequest, ChatResponse, CitationSchema
from app.services.rag.engine import query_rag_engine

router = APIRouter(prefix="/agents/{agent_id}/chat", tags=["Chat"])

@router.post("", response_model=ChatResponse)
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

    # Run Sector-Aware RAG answer engine with Debug Trace support
    answer, citations, debug_trace = await query_rag_engine(
        agent_id=agent_id,
        user_message=user_msg,
        include_debug=bool(req.debug)
    )

    # Log chat history
    chat_log = ChatLogDB(
        id=str(uuid.uuid4()),
        agent_id=agent_id,
        user_message=user_msg,
        bot_answer=answer,
        citations=citations
    )
    db.add(chat_log)
    db.commit()

    return ChatResponse(
        answer=answer,
        citations=[CitationSchema(**c) for c in citations],
        debug_trace=debug_trace
    )
