import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy import Column, String, Integer, Float, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from pydantic import BaseModel, HttpUrl
from app.core.database import Base

# --- SQLAlchemy Database Models ---

class AgentDB(Base):
    __tablename__ = "agents"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    website_url = Column(String, nullable=False)
    scope = Column(String, default="entire_website")
    status = Column(String, default="QUEUED")
    primary_color = Column(String, default="#3B82F6")
    welcome_message = Column(String, default="Hello! How can I help you today with information from this website?")
    
    # Sector Intelligence fields
    detected_sector = Column(String, default="general")
    sector_confidence = Column(Float, default=0.75)
    sector_reason = Column(Text, default="")

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    last_crawled_at = Column(DateTime, nullable=True)

    pages = relationship("PageDB", back_populates="agent", cascade="all, delete-orphan")
    entities = relationship("EntityDB", back_populates="agent", cascade="all, delete-orphan")
    crawl_jobs = relationship("CrawlJobDB", back_populates="agent", cascade="all, delete-orphan")
    chat_logs = relationship("ChatLogDB", back_populates="agent", cascade="all, delete-orphan")


class PageDB(Base):
    __tablename__ = "pages"

    id = Column(String, primary_key=True, index=True)
    agent_id = Column(String, ForeignKey("agents.id"), nullable=False)
    url = Column(String, nullable=False, index=True)
    title = Column(String, default="")
    description = Column(Text, default="")
    content_text = Column(Text, default="")
    content_hash = Column(String, index=True)
    char_count = Column(Integer, default=0)
    http_status = Column(Integer, default=200)
    crawled_at = Column(DateTime, default=datetime.datetime.utcnow)

    agent = relationship("AgentDB", back_populates="pages")
    entities = relationship("EntityDB", back_populates="page", cascade="all, delete-orphan")


class EntityDB(Base):
    __tablename__ = "entities"

    id = Column(String, primary_key=True, index=True)
    agent_id = Column(String, ForeignKey("agents.id"), nullable=False)
    page_id = Column(String, ForeignKey("pages.id"), nullable=True)
    entity_type = Column(String, index=True) # course, doctor, pricing_plan, spec, contact, etc.
    entity_name = Column(String, index=True)
    attributes = Column(JSON, default=dict)  # Key-value JSON data
    source_url = Column(String, default="")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    agent = relationship("AgentDB", back_populates="entities")
    page = relationship("PageDB", back_populates="entities")


class CrawlJobDB(Base):
    __tablename__ = "crawl_jobs"

    id = Column(String, primary_key=True, index=True)
    agent_id = Column(String, ForeignKey("agents.id"), nullable=False)
    status = Column(String, default="QUEUED")
    pages_discovered = Column(Integer, default=0)
    pages_processed = Column(Integer, default=0)
    pages_indexed = Column(Integer, default=0)
    pages_failed = Column(Integer, default=0)
    pages_skipped = Column(Integer, default=0)
    current_page_url = Column(String, default="")
    started_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)

    agent = relationship("AgentDB", back_populates="crawl_jobs")


class ChatLogDB(Base):
    __tablename__ = "chat_logs"

    id = Column(String, primary_key=True, index=True)
    agent_id = Column(String, ForeignKey("agents.id"), nullable=False)
    user_message = Column(Text, nullable=False)
    bot_answer = Column(Text, nullable=False)
    citations = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    agent = relationship("AgentDB", back_populates="chat_logs")


# --- Pydantic Schemas for API Requests & Responses ---

class CreateAgentRequest(BaseModel):
    url: str
    name: Optional[str] = None
    scope: Optional[str] = "entire_website"

class UpdateAgentRequest(BaseModel):
    name: Optional[str] = None
    primary_color: Optional[str] = None
    welcome_message: Optional[str] = None

class EntitySchema(BaseModel):
    id: str
    entity_type: str
    entity_name: str
    attributes: Dict[str, Any]
    source_url: str
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class PageSchema(BaseModel):
    id: str
    url: str
    title: str
    char_count: int
    http_status: int
    crawled_at: datetime.datetime

    class Config:
        from_attributes = True

class PageDetailSchema(PageSchema):
    description: str
    content_text: str
    entities: List[EntitySchema] = []

class CrawlJobSchema(BaseModel):
    id: str
    agent_id: str
    status: str
    pages_discovered: int
    pages_processed: int
    pages_indexed: int
    pages_failed: int
    pages_skipped: int
    current_page_url: Optional[str] = ""
    started_at: datetime.datetime
    completed_at: Optional[datetime.datetime] = None
    error_message: Optional[str] = None

    class Config:
        from_attributes = True

class SectorInfoSchema(BaseModel):
    sector: str
    confidence: float
    reason: str

class AgentResponse(BaseModel):
    id: str
    name: str
    website_url: str
    scope: str
    status: str
    primary_color: str
    welcome_message: str
    detected_sector: str = "general"
    sector_confidence: float = 0.75
    sector_reason: str = ""
    created_at: datetime.datetime
    last_crawled_at: Optional[datetime.datetime] = None
    indexed_pages_count: int = 0
    structured_entities_count: int = 0
    total_chunks_count: int = 0
    active_job: Optional[CrawlJobSchema] = None

    class Config:
        from_attributes = True

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []
    debug: Optional[bool] = False

class CitationSchema(BaseModel):
    url: str
    title: str
    snippet: str

class DebugTraceItem(BaseModel):
    chunk_id: str
    title: str
    url: str
    score: float
    matched_entity: Optional[str] = None
    snippet: str

class DebugTrace(BaseModel):
    detected_intent: str
    detected_entity_type: Optional[str] = None
    detected_entity: Optional[str] = None
    applied_filters: Dict[str, Any] = {}
    matched_structured_entities: List[str] = []
    retrieved_sources: List[str] = []
    reranked_chunks: List[DebugTraceItem] = []

class ChatResponse(BaseModel):
    answer: str
    citations: List[CitationSchema]
    debug_trace: Optional[DebugTrace] = None
