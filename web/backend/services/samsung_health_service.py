"""
Adaptador para o cliente Samsung Health existente no tdah_cli.
"""
from __future__ import annotations

import os
import sys
from datetime import date
from pathlib import Path

# Adiciona a raiz do projeto ao path para importar tdah_cli
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

try:
    from tdah_cli.samsung_health import SamsungHealthClient
    from tdah_cli.config import SAMSUNG_TOKEN_PATH
    _SAMSUNG_AVAILABLE = True
except ImportError:
    _SAMSUNG_AVAILABLE = False
    SamsungHealthClient = None  # type: ignore
    SAMSUNG_TOKEN_PATH = Path.home() / ".tdah-ia" / ".samsung_tokens.json"


def get_client() -> "SamsungHealthClient | None":
    """Retorna instância do cliente Samsung Health se credenciais estiverem configuradas."""
    if not _SAMSUNG_AVAILABLE:
        return None

    client_id = os.environ.get("SAMSUNG_HEALTH_CLIENT_ID", "")
    client_secret = os.environ.get("SAMSUNG_HEALTH_CLIENT_SECRET", "")

    if not client_id or not client_secret:
        return None

    return SamsungHealthClient(client_id, client_secret, SAMSUNG_TOKEN_PATH)


def is_authenticated() -> bool:
    """Verifica se o cliente Samsung Health está autenticado."""
    client = get_client()
    if client is None:
        return False
    return client.autenticado


def get_auth_url() -> str | None:
    """Retorna a URL de autorização OAuth2 do Samsung Health."""
    if not _SAMSUNG_AVAILABLE:
        return None

    client_id = os.environ.get("SAMSUNG_HEALTH_CLIENT_ID", "")
    if not client_id:
        return None

    from urllib.parse import urlencode
    from tdah_cli.samsung_health import SAMSUNG_AUTH_URL, SCOPES, REDIRECT_URI

    params = {
        "client_id": client_id,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": SCOPES,
    }
    return f"{SAMSUNG_AUTH_URL}?{urlencode(params)}"


async def get_daily_data(target_date: date | None = None) -> dict:
    """
    Busca todos os dados diários do Samsung Health.

    Returns:
        Dict compatível com o modelo SamsungHealthData.
        Campos None se não disponíveis.
    """
    result = {
        "passos": None,
        "distancia_km": None,
        "calorias_passos": None,
        "sono_horas": None,
        "sono_qualidade": None,
        "sono_fases": None,
        "fc_media": None,
        "fc_min": None,
        "fc_max": None,
        "exercicios": None,
    }

    client = get_client()
    if client is None or not client.autenticado:
        return result

    # Passos
    try:
        passos_data = client.passos(target_date)
        result["passos"] = passos_data.get("total")
        result["distancia_km"] = passos_data.get("distancia_km")
        result["calorias_passos"] = passos_data.get("calorias")
    except Exception:
        pass

    # Sono
    try:
        sono_data = client.sono(target_date)
        result["sono_horas"] = sono_data.get("duracao_horas")
        result["sono_qualidade"] = sono_data.get("qualidade")
        result["sono_fases"] = sono_data.get("fases")
    except Exception:
        pass

    # Frequência cardíaca
    try:
        fc_data = client.frequencia_cardiaca(target_date)
        result["fc_media"] = fc_data.get("media")
        result["fc_min"] = fc_data.get("minima")
        result["fc_max"] = fc_data.get("maxima")
    except Exception:
        pass

    # Exercícios
    try:
        exercicios = client.exercicios(target_date)
        result["exercicios"] = exercicios
    except Exception:
        pass

    return result
