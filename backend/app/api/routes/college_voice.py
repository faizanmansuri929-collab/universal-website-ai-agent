import os
import json
import httpx
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.core.config import settings
from app.models.schemas import CollegeWebSearchProjectDB, CollegeWebSourceDB
from app.services.web_search.allowlist import seed_poornima_allowlist
from app.services.web_search.search_engine import select_and_fetch_college_sources
from app.services.web_search.generator import generate_college_web_search_answer

router = APIRouter(prefix="/college-voice", tags=["College Voice Web Search"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class CreateVoiceSessionRequest(BaseModel):
    project_id: Optional[str] = "proj_poornima"
    voice: Optional[str] = "alloy" # alloy, ash, ballad, coral, echo, sage, shimmer, verse
    language: Optional[str] = "en-IN" # en-IN, hi


class VoiceSessionResponse(BaseModel):
    client_secret: Dict[str, Any]
    session_id: str
    project_id: str
    college_name: str
    base_domain: str
    model: str
    voice: str
    language: str


class VoiceSearchToolRequest(BaseModel):
    project_id: Optional[str] = "proj_poornima"
    query: str
    language: Optional[str] = "en-IN"
    max_sources: Optional[int] = 3


class VoiceSourceItem(BaseModel):
    title: str
    url: str
    score: Optional[float] = 1.0
    category: Optional[str] = "General"


class VoiceSearchToolResponse(BaseModel):
    query: str
    college_name: str
    detected_intent: str
    sources_used_count: int
    sources: List[VoiceSourceItem]
    context: str
    summary_for_voice: str
    detailed_answer: str


def build_voice_system_prompt(college_name: str, base_domain: str, language: str = "en-IN") -> str:
    lang_instruction = ""
    if language == "hi":
        lang_instruction = """
LANGUAGE & ACCENT (HINDI / HINGLISH):
- You MUST speak strictly in clear, polite, natural Hindi / Hinglish with an authentic Indian accent.
- Example: "पूर्णिमा में B.Tech CSE की सालाना फीस और एलिजिबिलिटी की पूरी जानकारी नीचे स्क्रीन पर टेबल में दिखाई दे रही है।"
"""
    else:
        lang_instruction = """
LANGUAGE & ACCENT (INDIAN ENGLISH):
- You MUST speak with a natural, polite, professional Indian English tone and cadence.
- Use standard Indian academic terminology naturally (e.g., 'B.Tech', 'Lakhs per annum', 'hostel accommodation', 'annual fee structure', 'REAP counseling').
- Keep spoken pronunciation clear, warm, and helpful.
"""

    return f"""You are the official Indian Voice Assistant for {college_name} (official website: {base_domain}).

CRITICAL MANDATORY INSTRUCTIONS:
1. TOOL CALLING IS STRICTLY MANDATORY:
   Whenever the user asks ANY question about {college_name} (including fees, tuition cost, fee structure, scholarships, courses, B.Tech, M.Tech, MBA, branches, admissions, eligibility, cutoffs, placements, highest package, hostels, mess, campus facilities, faculty, contacts), you MUST IMMEDIATELY call the `college_web_search` function tool with the user's query.
2. DO NOT ANSWER FROM MEMORY AND NEVER GIVE GENERIC FILLER (e.g., "I understand, ask me anything"). ALWAYS call `college_web_search`.
3. CONCISE SPOKEN SUMMARY (CRITICAL FOR AUDIO):
   - When the tool returns data, speak a short 1 to 2 sentence polite conversational summary aloud (10 to 35 words).
   - Inform the user that full detailed breakdown tables, branch lists, and verified official links are displayed on their screen.
   - Example: "B.Tech tuition fee is approximately 1.5 Lakhs per year. I have displayed the complete detailed fee breakdown table and official links on your screen!"
4. NEVER read long tables, fee rows, or raw URLs aloud. Keep speech crisp and natural.
5. User speech is in English or Hindi. Never output or transcribe into unrelated languages or strange scripts.
{lang_instruction}
"""


@router.post("/session", response_model=VoiceSessionResponse)
async def create_voice_realtime_session(
    payload: CreateVoiceSessionRequest,
    db: Session = Depends(get_db)
):
    """
    Creates an OpenAI Realtime WebRTC session with ephemeral client credentials:
    1. Validates the college project and approved domain.
    2. Builds specialized concise voice instructions with Indian English or Hindi tone.
    3. Configures `college_web_search` function tool for live search retrieval.
    4. Authenticates with OpenAI and returns ephemeral client secret for browser WebRTC.
    """
    seed_poornima_allowlist(db)
    
    project_id = payload.project_id or "proj_poornima"
    language = payload.language or "en-IN"
    project = db.query(CollegeWebSearchProjectDB).filter(CollegeWebSearchProjectDB.id == project_id).first()
    
    college_name = project.college_name if project else "Poornima University"
    base_domain = project.base_domain if project else "poornima.org"
    
    api_key = settings.OPENAI_API_KEY
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="OPENAI_API_KEY is not configured on the server. Please check backend .env settings."
        )

    voice_instructions = build_voice_system_prompt(college_name=college_name, base_domain=base_domain, language=language)
    
    # Realtime model configuration
    model_name = "gpt-realtime-mini"
    selected_voice = payload.voice if payload.voice in ["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse"] else "alloy"

    whisper_lang = "en" if language == "en-IN" else "hi"

    session_payload = {
        "session": {
            "type": "realtime",
            "model": model_name,
            "instructions": voice_instructions,
            "output_modalities": ["audio"],
            "audio": {
                "input": {
                    "transcription": {
                        "model": "whisper-1",
                        "language": whisper_lang
                    },
                    "noise_reduction": {
                        "type": "near_field"
                    },
                    "turn_detection": {
                        "type": "server_vad",
                        "threshold": 0.75,
                        "prefix_padding_ms": 300,
                        "silence_duration_ms": 800,
                        "create_response": True,
                        "interrupt_response": True
                    }
                },
                "output": {
                    "voice": selected_voice,
                    "speed": 1.0
                }
            },
            "tools": [
                {
                    "type": "function",
                    "name": "college_web_search",
                    "description": f"Mandatory search tool: Searches official {college_name} website ({base_domain}) for live fees, courses, admissions, placements, hostels, and campus details.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "The specific query to search on the official college website, e.g., 'B.Tech CSE fees structure', 'hostel fees', 'placement statistics', 'admission criteria'"
                            }
                        },
                        "required": ["query"]
                    }
                }
            ],
            "tool_choice": "auto"
        }
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/realtime/client_secrets",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json=session_payload
            )
            
            if resp.status_code != 200:
                # Fallback to gpt-realtime-2.1 if mini fails
                fallback_payload = dict(session_payload)
                fallback_payload["session"]["model"] = "gpt-realtime-2.1"
                resp_fallback = await client.post(
                    "https://api.openai.com/v1/realtime/client_secrets",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    },
                    json=fallback_payload
                )
                if resp_fallback.status_code == 200:
                    data = resp_fallback.json()
                    ephemeral_val = data.get("value") or data.get("client_secret", {}).get("value", "")
                    sess_id = data.get("session", {}).get("id") or data.get("id", "")
                    return VoiceSessionResponse(
                        client_secret={"value": ephemeral_val, "expires_at": data.get("expires_at")},
                        session_id=sess_id,
                        project_id=project_id,
                        college_name=college_name,
                        base_domain=base_domain,
                        model="gpt-realtime-2.1",
                        voice=selected_voice,
                        language=language
                    )
                
                raise HTTPException(
                    status_code=resp.status_code,
                    detail=f"OpenAI Realtime Session creation failed: {resp.text}"
                )

            data = resp.json()
            ephemeral_val = data.get("value") or data.get("client_secret", {}).get("value", "")
            sess_id = data.get("session", {}).get("id") or data.get("id", "")
            return VoiceSessionResponse(
                client_secret={"value": ephemeral_val, "expires_at": data.get("expires_at")},
                session_id=sess_id,
                project_id=project_id,
                college_name=college_name,
                base_domain=base_domain,
                model=model_name,
                voice=selected_voice,
                language=language
            )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Network error connecting to OpenAI Realtime API: {str(e)}"
        )


@router.post("/search-tool", response_model=VoiceSearchToolResponse)
async def execute_voice_search_tool(
    payload: VoiceSearchToolRequest,
    db: Session = Depends(get_db)
):
    """
    Executes the exact same College Web Search pipeline as text search:
    1. Calls `generate_college_web_search_answer` directly to get the identical grounded markdown answer, fee tables & verified sources.
    2. Constructs a crisp 1-2 sentence spoken summary for voice audio.
    3. Returns full structured tables & citations for screen display.
    """
    seed_poornima_allowlist(db)
    
    project_id = payload.project_id or "proj_poornima"
    language = payload.language or "en-IN"
    query = payload.query.strip()
    
    chat_res = await generate_college_web_search_answer(
        project_id=project_id,
        user_message=query,
        history=[],
        include_debug=False,
        db=db
    )
    
    sources_list: List[VoiceSourceItem] = []
    for s in (chat_res.sources or []):
        sources_list.append(VoiceSourceItem(
            title=s.title or f"{chat_res.college_name} Official Page",
            url=s.url,
            score=1.0,
            category=getattr(s, "category", "General")
        ))
    
    # Generate concise spoken summary for the audio model
    spoken_summary = ""
    if language == "hi":
        spoken_summary = f"{chat_res.college_name} की आधिकारिक वेबसाइट से पूरी जानकारी और फीस टेबल नीचे स्क्रीन पर दिखाई दे रही है।"
    else:
        spoken_summary = f"I found the verified details and fee breakdown from {chat_res.college_name}'s official website and displayed the complete table on your screen."
    
    return VoiceSearchToolResponse(
        query=query,
        college_name=chat_res.college_name,
        detected_intent=chat_res.detected_intent or "general",
        sources_used_count=chat_res.sources_used_count,
        sources=sources_list,
        context=chat_res.answer[:2000],
        summary_for_voice=spoken_summary,
        detailed_answer=chat_res.answer
    )
