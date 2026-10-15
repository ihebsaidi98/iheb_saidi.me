"""Version 1 API router with internal authentication dependency."""

from fastapi import APIRouter, Depends

from app.api.v1.info import router as info_router
from app.dependencies import verify_internal_token

v1_router = APIRouter(
    prefix="/v1",
    dependencies=[Depends(verify_internal_token)],
)

# Include v1 endpoints
v1_router.include_router(info_router)
