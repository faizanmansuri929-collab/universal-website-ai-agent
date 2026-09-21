import uuid
import datetime
from typing import List, Optional
from urllib.parse import urlparse
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.orm import Session

from app.core.database import get_db, SessionLocal
from app.models.schemas import (
    HardcodedBotDB, HardcodedFAQDB, ChatVisitorDB, ChatSessionDB,
    CreateHardcodedBotRequest, HardcodedBotResponse, HardcodedFAQSchema,
    HardcodedChatRequest, HardcodedChatResponse, ChatVisitorSchema
)
from app.services.hardcoded.service import (
    build_hardcoded_bot_pipeline,
    regenerate_hardcoded_bot_dataset,
    handle_hardcoded_visitor_chat
)

router = APIRouter(prefix="/hardcoded-bots", tags=["Hardcoded / Predefined Chatbot"])

@router.get("", response_model=List[HardcodedBotResponse])
def list_hardcoded_bots(db: Session = Depends(get_db)):
    bots = db.query(HardcodedBotDB).order_by(HardcodedBotDB.created_at.desc()).all()
    results = []
    now = datetime.datetime.utcnow()

    for b in bots:
        faq_count = db.query(HardcodedFAQDB).filter(HardcodedFAQDB.bot_id == b.id).count()
        visitor_count = db.query(ChatVisitorDB).filter(ChatVisitorDB.bot_id == b.id).count()
        is_expired = bool(b.expires_at and b.expires_at < now)

        results.append(HardcodedBotResponse(
            id=b.id,
            agent_id=b.agent_id,
            name=b.name,
            website_url=b.website_url,
            sector=b.sector or "general",
            status=b.status,
            version=b.version or 1,
            ttl_days=b.ttl_days or 7,
            welcome_message=b.welcome_message,
            primary_color=b.primary_color or "#3B82F6",
            error_message=b.error_message,
            created_at=b.created_at,
            updated_at=b.updated_at,
            expires_at=b.expires_at,
            last_generated_at=b.last_generated_at,
            is_expired=is_expired,
            faqs_count=faq_count,
            visitors_count=visitor_count
        ))
    return results


@router.post("", response_model=HardcodedBotResponse)
async def create_hardcoded_bot(
    req: CreateHardcodedBotRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    url = req.url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    parsed = urlparse(url)
    if not parsed.netloc:
        raise HTTPException(status_code=400, detail="Invalid website URL provided")

    bot_id = str(uuid.uuid4())
    name = req.name
    if not name:
        name = parsed.netloc.replace("www.", "").capitalize() + " Predefined Bot"

    bot = HardcodedBotDB(
        id=bot_id,
        name=name,
        website_url=url,
        sector=req.sector or "general",
        status="QUEUED",
        version=1,
        ttl_days=req.ttl_days or 7,
        created_at=datetime.datetime.utcnow()
    )
    db.add(bot)
    db.commit()

    background_tasks.add_task(build_hardcoded_bot_pipeline, bot_id, SessionLocal)

    return HardcodedBotResponse(
        id=bot.id,
        name=bot.name,
        website_url=bot.website_url,
        sector=bot.sector,
        status=bot.status,
        version=bot.version,
        ttl_days=bot.ttl_days,
        welcome_message=bot.welcome_message,
        primary_color=bot.primary_color,
        created_at=bot.created_at,
        is_expired=False,
        faqs_count=0,
        visitors_count=0
    )


@router.get("/{bot_id}", response_model=HardcodedBotResponse)
def get_hardcoded_bot(bot_id: str, db: Session = Depends(get_db)):
    bot = db.query(HardcodedBotDB).filter(HardcodedBotDB.id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Hardcoded Bot not found")

    now = datetime.datetime.utcnow()
    faq_count = db.query(HardcodedFAQDB).filter(HardcodedFAQDB.bot_id == bot_id).count()
    visitor_count = db.query(ChatVisitorDB).filter(ChatVisitorDB.bot_id == bot_id).count()
    is_expired = bool(bot.expires_at and bot.expires_at < now)

    return HardcodedBotResponse(
        id=bot.id,
        agent_id=bot.agent_id,
        name=bot.name,
        website_url=bot.website_url,
        sector=bot.sector or "general",
        status=bot.status,
        version=bot.version or 1,
        ttl_days=bot.ttl_days or 7,
        welcome_message=bot.welcome_message,
        primary_color=bot.primary_color or "#3B82F6",
        error_message=bot.error_message,
        created_at=bot.created_at,
        updated_at=bot.updated_at,
        expires_at=bot.expires_at,
        last_generated_at=bot.last_generated_at,
        is_expired=is_expired,
        faqs_count=faq_count,
        visitors_count=visitor_count
    )


@router.get("/{bot_id}/faqs", response_model=List[HardcodedFAQSchema])
def list_bot_faqs(
    bot_id: str,
    search: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    bot = db.query(HardcodedBotDB).filter(HardcodedBotDB.id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Hardcoded Bot not found")

    query = db.query(HardcodedFAQDB).filter(HardcodedFAQDB.bot_id == bot_id)

    if category:
        query = query.filter(HardcodedFAQDB.category.ilike(f"%{category}%"))

    faqs = query.order_by(HardcodedFAQDB.priority.desc(), HardcodedFAQDB.created_at.asc()).all()

    if search:
        search_lower = search.lower()
        filtered = []
        for f in faqs:
            q_match = any(search_lower in q.lower() for q in (f.questions or []))
            a_match = search_lower in f.answer.lower()
            i_match = search_lower in f.intent.lower()
            if q_match or a_match or i_match:
                filtered.append(f)
        return [HardcodedFAQSchema.from_orm(f) for f in filtered]

    return [HardcodedFAQSchema.from_orm(f) for f in faqs]


@router.post("/{bot_id}/regenerate", response_model=HardcodedBotResponse)
async def regenerate_bot_faqs(
    bot_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    bot = db.query(HardcodedBotDB).filter(HardcodedBotDB.id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Hardcoded Bot not found")

    background_tasks.add_task(regenerate_hardcoded_bot_dataset, bot_id, SessionLocal)

    bot.status = "QUEUED"
    bot.version = (bot.version or 1) + 1
    db.commit()

    return get_hardcoded_bot(bot_id, db)


@router.post("/{bot_id}/chat", response_model=HardcodedChatResponse)
def chat_with_hardcoded_bot(
    bot_id: str,
    req: HardcodedChatRequest,
    db: Session = Depends(get_db)
):
    bot = db.query(HardcodedBotDB).filter(HardcodedBotDB.id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Hardcoded Bot not found")

    extra_data = {
        "email": req.email,
        "mobile": req.mobile,
        "student_name": req.student_name,
        "course": req.course,
        "percentage": req.percentage
    }

    res = handle_hardcoded_visitor_chat(
        bot=bot,
        req_session_id=req.session_id,
        user_message=req.message,
        extra_data=extra_data,
        db=db
    )
    return res


@router.get("/{bot_id}/visitors", response_model=List[ChatVisitorSchema])
def list_bot_visitors(bot_id: str, db: Session = Depends(get_db)):
    visitors = db.query(ChatVisitorDB).filter(ChatVisitorDB.bot_id == bot_id).order_by(ChatVisitorDB.created_at.desc()).all()
    return [ChatVisitorSchema.from_orm(v) for v in visitors]


@router.get("/{bot_id}/widget-config")
def get_hardcoded_widget_config(bot_id: str, db: Session = Depends(get_db)):
    bot = db.query(HardcodedBotDB).filter(HardcodedBotDB.id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Hardcoded Bot not found")

    return {
        "bot_id": bot.id,
        "name": bot.name,
        "website_url": bot.website_url,
        "sector": bot.sector,
        "status": bot.status,
        "primary_color": bot.primary_color,
        "welcome_message": bot.welcome_message,
        "version": bot.version
    }
