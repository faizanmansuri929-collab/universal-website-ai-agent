import uuid
import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.schemas import (
    WebSearchConfigDB, WebSearchSourceDB,
    WebSearchChatRequest, WebSearchChatResponse,
    WebSearchSourceSchema, WebSearchSourceCreate, WebSearchSourceUpdate,
    WebSearchConfigSchema, WebSearchConfigUpdate,
    WebSearchTestRequest, WebSearchTestResponse
)
from app.services.web_search.allowlist import (
    seed_poornima_allowlist, is_allowed_domain_url
)
from app.services.web_search.generator import generate_poornima_web_search_answer
from app.services.web_search.search_engine import select_and_fetch_poornima_sources

router = APIRouter(prefix="/web-search", tags=["College Web Search"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/chat", response_model=WebSearchChatResponse)
async def chat_web_search(
    request: WebSearchChatRequest,
    db: Session = Depends(get_db)
):
    """
    Direct endpoint for College Live Web Search Chatbot:
    1. Understands query intent.
    2. OpenAI decides 1-3 best Poornima URLs from allowlist.
    3. Fetches real-time web data for those URLs.
    4. Generates grounded answer + real citations.
    """
    # Ensure allowlist is initialized
    seed_poornima_allowlist(db)

    response = await generate_poornima_web_search_answer(
        user_message=request.message,
        history=request.history,
        include_debug=request.include_debug,
        db=db
    )
    return response


@router.get("/config", response_model=WebSearchConfigSchema)
def get_web_search_config(db: Session = Depends(get_db)):
    """Returns the current Poornima Web Search configuration and stats."""
    seed_poornima_allowlist(db)
    config = db.query(WebSearchConfigDB).filter(WebSearchConfigDB.id == "poornima_config").first()
    if not config:
        raise HTTPException(status_code=404, detail="Web search configuration not found.")
    
    total = db.query(WebSearchSourceDB).count()
    active = db.query(WebSearchSourceDB).filter(WebSearchSourceDB.is_enabled == 1).count()

    return WebSearchConfigSchema(
        id=config.id,
        college_name=config.college_name,
        primary_domain=config.primary_domain,
        max_sources_per_query=config.max_sources_per_query,
        status=config.status,
        cache_ttl_seconds=config.cache_ttl_seconds,
        total_sources_count=total,
        active_sources_count=active,
        updated_at=config.updated_at or config.created_at
    )


@router.put("/config", response_model=WebSearchConfigSchema)
def update_web_search_config(
    payload: WebSearchConfigUpdate,
    db: Session = Depends(get_db)
):
    """Updates configuration parameters (max sources, cache TTL, status)."""
    config = db.query(WebSearchConfigDB).filter(WebSearchConfigDB.id == "poornima_config").first()
    if not config:
        raise HTTPException(status_code=404, detail="Web search configuration not found.")

    if payload.college_name is not None:
        config.college_name = payload.college_name
    if payload.primary_domain is not None:
        config.primary_domain = payload.primary_domain
    if payload.max_sources_per_query is not None:
        config.max_sources_per_query = max(1, min(payload.max_sources_per_query, 5))
    if payload.status is not None:
        config.status = payload.status
    if payload.cache_ttl_seconds is not None:
        config.cache_ttl_seconds = payload.cache_ttl_seconds
    if payload.system_prompt_override is not None:
        config.system_prompt_override = payload.system_prompt_override

    config.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(config)

    total = db.query(WebSearchSourceDB).count()
    active = db.query(WebSearchSourceDB).filter(WebSearchSourceDB.is_enabled == 1).count()

    return WebSearchConfigSchema(
        id=config.id,
        college_name=config.college_name,
        primary_domain=config.primary_domain,
        max_sources_per_query=config.max_sources_per_query,
        status=config.status,
        cache_ttl_seconds=config.cache_ttl_seconds,
        total_sources_count=total,
        active_sources_count=active,
        updated_at=config.updated_at
    )


@router.get("/sources", response_model=List[WebSearchSourceSchema])
def list_web_search_sources(
    category: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Lists all approved Poornima URLs in the allowlist."""
    seed_poornima_allowlist(db)
    query = db.query(WebSearchSourceDB)

    if category and category != "All":
        query = query.filter(WebSearchSourceDB.category == category)
    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            (WebSearchSourceDB.title.ilike(term)) |
            (WebSearchSourceDB.url.ilike(term)) |
            (WebSearchSourceDB.category.ilike(term))
        )

    sources = query.order_by(WebSearchSourceDB.category, WebSearchSourceDB.title).all()
    return sources


@router.post("/sources", response_model=WebSearchSourceSchema)
def add_web_search_source(
    payload: WebSearchSourceCreate,
    db: Session = Depends(get_db)
):
    """Adds a new URL to the approved allowlist (must belong to poornima.org)."""
    url = payload.url.strip()
    if not is_allowed_domain_url(url):
        raise HTTPException(
            status_code=400,
            detail="Security restriction: Only official 'poornima.org' URLs are permitted in the allowlist."
        )

    existing = db.query(WebSearchSourceDB).filter(WebSearchSourceDB.url == url).first()
    if existing:
        raise HTTPException(status_code=400, detail="This URL is already present in the allowlist.")

    new_source = WebSearchSourceDB(
        id=f"src_{uuid.uuid4().hex[:8]}",
        url=url,
        title=payload.title or url,
        category=payload.category or "General",
        is_enabled=1,
        created_at=datetime.datetime.utcnow()
    )
    db.add(new_source)
    db.commit()
    db.refresh(new_source)
    return new_source


@router.put("/sources/{source_id}", response_model=WebSearchSourceSchema)
def update_web_search_source(
    source_id: str,
    payload: WebSearchSourceUpdate,
    db: Session = Depends(get_db)
):
    """Updates or toggles enabled/disabled state of an allowlist source."""
    source = db.query(WebSearchSourceDB).filter(WebSearchSourceDB.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found.")

    if payload.title is not None:
        source.title = payload.title
    if payload.category is not None:
        source.category = payload.category
    if payload.is_enabled is not None:
        source.is_enabled = 1 if payload.is_enabled else 0

    db.commit()
    db.refresh(source)
    return source


@router.delete("/sources/{source_id}")
def delete_web_search_source(
    source_id: str,
    db: Session = Depends(get_db)
):
    """Deletes an URL from the allowlist."""
    source = db.query(WebSearchSourceDB).filter(WebSearchSourceDB.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found.")

    db.delete(source)
    db.commit()
    return {"message": "Source successfully removed from allowlist.", "id": source_id}


@router.post("/test", response_model=WebSearchTestResponse)
async def test_web_search_selection(
    payload: WebSearchTestRequest,
    db: Session = Depends(get_db)
):
    """
    Test endpoint for developer debug:
    Executes intent routing and OpenAI link selection without full answer generation.
    """
    seed_poornima_allowlist(db)
    candidates, selected, intent_info, ai_reason = await select_and_fetch_poornima_sources(
        user_message=payload.query,
        history=[],
        db=db,
        max_sources=payload.max_sources or 3
    )

    return WebSearchTestResponse(
        query=payload.query,
        detected_intent=intent_info.get("intent", "general"),
        optimized_search_query=intent_info.get("search_query", ""),
        candidate_sources=candidates,
        selected_sources=[{
            "url": s.get("url"),
            "title": s.get("title"),
            "score": s.get("score"),
            "fetch_status": s.get("fetch_status")
        } for s in selected]
    )
