from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.schemas import AgentDB

router = APIRouter(tags=["Widget"])

@router.get("/agents/{agent_id}/widget-config")
def get_widget_config(agent_id: str, db: Session = Depends(get_db)):
    agent = db.query(AgentDB).filter(AgentDB.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    return {
        "agent_id": agent.id,
        "name": agent.name,
        "website_url": agent.website_url,
        "primary_color": agent.primary_color,
        "welcome_message": agent.welcome_message,
        "status": agent.status
    }
