from fastapi import APIRouter
from app.api.routes import agent, chat, widget

api_router = APIRouter(prefix="/api")
api_router.include_router(agent.router)
api_router.include_router(chat.router)
api_router.include_router(widget.router)
