"""
Rotas de dados Samsung Health.
"""
from __future__ import annotations

from datetime import date as date_type

from fastapi import APIRouter, Query

from services.samsung_health_service import get_daily_data, is_authenticated, get_auth_url
from models import SamsungHealthData

router = APIRouter()


@router.get("/health/daily", response_model=SamsungHealthData)
async def get_health_daily(date: str = Query(default=None)):
    """Retorna dados diários do Samsung Health para a data especificada."""
    target_date = None
    if date:
        try:
            target_date = date_type.fromisoformat(date)
        except ValueError:
            target_date = None

    data = await get_daily_data(target_date)
    return SamsungHealthData(**data)


@router.get("/health/auth-url")
async def get_health_auth_url():
    """Retorna a URL de autorização OAuth2 do Samsung Health."""
    url = get_auth_url()
    if url is None:
        return {
            "auth_url": None,
            "message": "SAMSUNG_HEALTH_CLIENT_ID não configurado no .env",
        }
    return {"auth_url": url}


@router.get("/health/auth-status")
async def get_health_auth_status():
    """Verifica se o Samsung Health está autenticado."""
    authenticated = is_authenticated()
    return {
        "authenticated": authenticated,
        "message": (
            "Conectado ao Samsung Health"
            if authenticated
            else "Samsung Health não autenticado. Use /api/health/auth-url para conectar."
        ),
    }
