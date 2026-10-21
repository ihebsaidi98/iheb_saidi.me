"""Version 1 API router with internal authentication dependency."""

from fastapi import APIRouter, Depends

from app.api.v1.agent import router as agent_router
from app.api.v1.copilot import router as copilot_router
from app.api.v1.info import router as info_router
from app.api.v1.interview import router as interview_router
from app.api.v1.rag import router as rag_router
from app.dependencies import verify_internal_token

v1_router = APIRouter(
    prefix="/v1",
    dependencies=[Depends(verify_internal_token)],
)

# Include v1 endpoints
v1_router.include_router(info_router)
v1_router.include_router(rag_router)
v1_router.include_router(agent_router)
v1_router.include_router(copilot_router)
v1_router.include_router(interview_router)
