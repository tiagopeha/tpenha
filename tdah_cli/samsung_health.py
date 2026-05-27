"""
Cliente Samsung Health REST API com OAuth2.

Documentação oficial: https://developer.samsung.com/health/server-api
Registro de app:      https://shealth.samsung.com/developer/

Para usar esta integração:
  1. Cadastre-se no Samsung Health Developer Portal
  2. Crie um app e anote o Client ID e Client Secret
  3. Adicione ao .env: SAMSUNG_HEALTH_CLIENT_ID e SAMSUNG_HEALTH_CLIENT_SECRET
  4. Execute: tdah saude --autorizar
"""

from __future__ import annotations

import json
import threading
import time
import webbrowser
from datetime import date, datetime, timedelta
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Optional
from urllib.parse import parse_qs, urlencode, urlparse

import httpx
from rich.console import Console

console = Console()

# ── Endpoints Samsung Health ───────────────────────────────────────────────────
SAMSUNG_AUTH_URL = "https://account.samsung.com/accounts/v1/oauth2/authorize"
SAMSUNG_TOKEN_URL = "https://account.samsung.com/accounts/v1/oauth2/token"
SAMSUNG_API_BASE = "https://api.shealthservice.com/user/v2"

# Callback local para capturar o code OAuth2
REDIRECT_URI = "http://localhost:8765/callback"
OAUTH_PORT = 8765

# Escopos necessários (Samsung Health Developer Portal)
SCOPES = " ".join([
    "shealth.read_step",
    "shealth.read_sleep",
    "shealth.read_heart_rate",
    "shealth.read_exercise",
])

TIMEOUT = 30.0
MAX_RETRIES = 3
RETRY_DELAYS = [2, 4, 8]

# Mapeamento de tipos de exercício Samsung Health
EXERCISE_TYPES: dict[int, str] = {
    1001: "Caminhada",
    1002: "Corrida",
    2001: "Ciclismo",
    3001: "Natação",
    7001: "Musculação",
    7002: "Funcional",
    8001: "Yoga",
    8002: "Pilates",
    50001: "Corrida na esteira",
    50002: "Ciclismo indoor",
}


# ── Servidor OAuth2 local ──────────────────────────────────────────────────────

class _OAuthCallbackHandler(BaseHTTPRequestHandler):
    """Servidor HTTP mínimo para capturar o callback OAuth2."""
    auth_code: Optional[str] = None
    auth_error: Optional[str] = None

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/callback":
            params = parse_qs(parsed.query)
            _OAuthCallbackHandler.auth_code = (params.get("code") or [None])[0]
            _OAuthCallbackHandler.auth_error = (params.get("error") or [None])[0]

            html = (
                "<html><body style='font-family:sans-serif;text-align:center;padding:40px'>"
                "<h2>✅ Autorização concluída!</h2>"
                "<p>Pode fechar esta aba e voltar ao terminal.</p>"
                "</body></html>"
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(html)
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, fmt, *args):  # silencia logs do servidor
        pass


# ── Cliente principal ──────────────────────────────────────────────────────────

class SamsungHealthClient:
    """Cliente OAuth2 + REST para Samsung Health."""

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        token_path: Path,
    ):
        self.client_id = client_id
        self.client_secret = client_secret
        self.token_path = token_path
        self._tokens: dict = self._carregar_tokens()

    # ── Tokens ─────────────────────────────────────────────────────────────────

    def _carregar_tokens(self) -> dict:
        if self.token_path.exists():
            try:
                return json.loads(self.token_path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                return {}
        return {}

    def _salvar_tokens(self, tokens: dict) -> None:
        self.token_path.parent.mkdir(parents=True, exist_ok=True)
        self.token_path.write_text(
            json.dumps(tokens, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        self._tokens = tokens

    @property
    def autenticado(self) -> bool:
        return bool(self._tokens.get("access_token"))

    # ── OAuth2 ─────────────────────────────────────────────────────────────────

    def autorizar(self) -> None:
        """Abre o browser para login Samsung e captura o token via callback local."""
        params = {
            "client_id": self.client_id,
            "redirect_uri": REDIRECT_URI,
            "response_type": "code",
            "scope": SCOPES,
        }
        auth_url = f"{SAMSUNG_AUTH_URL}?{urlencode(params)}"

        # Reinicia estado do handler
        _OAuthCallbackHandler.auth_code = None
        _OAuthCallbackHandler.auth_error = None

        server = HTTPServer(("localhost", OAUTH_PORT), _OAuthCallbackHandler)

        def _serve():
            server.handle_request()  # processa apenas 1 request (o callback)

        thread = threading.Thread(target=_serve, daemon=True)
        thread.start()

        console.print(
            f"\n[bold cyan]🔑 Abrindo browser para autenticação Samsung Health...[/bold cyan]"
        )
        console.print(f"[dim]Se não abrir automaticamente, acesse:[/dim]\n{auth_url}\n")
        webbrowser.open(auth_url)

        thread.join(timeout=120)

        if _OAuthCallbackHandler.auth_error:
            raise PermissionError(
                f"Samsung Health negou acesso: {_OAuthCallbackHandler.auth_error}"
            )
        if not _OAuthCallbackHandler.auth_code:
            raise TimeoutError(
                "Timeout aguardando autorização Samsung Health (120s). Tente novamente."
            )

        self._trocar_codigo(_OAuthCallbackHandler.auth_code)
        console.print("[green]✓ Tokens salvos com sucesso![/green]")

    def _trocar_codigo(self, code: str) -> None:
        """Troca o authorization code por access + refresh tokens."""
        with httpx.Client(timeout=TIMEOUT) as client:
            resp = client.post(
                SAMSUNG_TOKEN_URL,
                data={
                    "grant_type": "authorization_code",
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": code,
                    "redirect_uri": REDIRECT_URI,
                },
            )
            resp.raise_for_status()
            self._salvar_tokens(resp.json())

    def _renovar_token(self) -> None:
        """Usa o refresh token para obter novo access token."""
        refresh_token = self._tokens.get("refresh_token")
        if not refresh_token:
            raise PermissionError(
                "Sem refresh token. Execute `tdah saude --autorizar` para autenticar novamente."
            )

        with httpx.Client(timeout=TIMEOUT) as client:
            resp = client.post(
                SAMSUNG_TOKEN_URL,
                data={
                    "grant_type": "refresh_token",
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "refresh_token": refresh_token,
                },
            )
            resp.raise_for_status()
            novos = resp.json()
            # Mantém o refresh token antigo se a resposta não trouxer um novo
            if "refresh_token" not in novos:
                novos["refresh_token"] = refresh_token
            self._salvar_tokens(novos)

    # ── Chamadas REST ──────────────────────────────────────────────────────────

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self._tokens['access_token']}",
            "Content-Type": "application/json",
        }

    def _get(self, endpoint: str, params: dict | None = None) -> dict:
        url = f"{SAMSUNG_API_BASE}/{endpoint}"

        for tentativa in range(MAX_RETRIES):
            try:
                with httpx.Client(timeout=TIMEOUT) as client:
                    resp = client.get(url, headers=self._headers(), params=params)

                    if resp.status_code == 401:
                        self._renovar_token()
                        resp = client.get(url, headers=self._headers(), params=params)

                    resp.raise_for_status()
                    return resp.json()

            except httpx.TimeoutException:
                if tentativa == MAX_RETRIES - 1:
                    raise RuntimeError(f"Timeout ao buscar {endpoint}")
                time.sleep(RETRY_DELAYS[tentativa])
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    if tentativa == MAX_RETRIES - 1:
                        raise RuntimeError("Rate limit Samsung Health — tente em alguns minutos")
                    time.sleep(RETRY_DELAYS[tentativa])
                else:
                    raise

        raise RuntimeError(f"Falha após {MAX_RETRIES} tentativas em {endpoint}")

    # ── Utilitários de data ────────────────────────────────────────────────────

    @staticmethod
    def _iso(dt: datetime) -> str:
        """Formata datetime para ISO 8601 UTC esperado pela API."""
        return dt.strftime("%Y-%m-%dT%H:%M:%SZ")

    @staticmethod
    def _intervalo_dia(alvo: date) -> tuple[str, str]:
        inicio = datetime(alvo.year, alvo.month, alvo.day, 0, 0, 0)
        fim = datetime(alvo.year, alvo.month, alvo.day, 23, 59, 59)
        return SamsungHealthClient._iso(inicio), SamsungHealthClient._iso(fim)

    # ── Endpoints de dados ─────────────────────────────────────────────────────

    def passos(self, alvo: date | None = None) -> dict:
        """Retorna contagem de passos do dia."""
        alvo = alvo or date.today()
        inicio, fim = self._intervalo_dia(alvo)
        dados = self._get("step_daily_trend", {
            "start_time": inicio,
            "end_time": fim,
        })
        return _parsear_passos(dados)

    def sono(self, alvo: date | None = None) -> dict:
        """Retorna dados de sono da noite anterior (18h → 12h do dia seguinte)."""
        alvo = alvo or (date.today() - timedelta(days=1))
        inicio = datetime(alvo.year, alvo.month, alvo.day, 18, 0, 0)
        fim = datetime((alvo + timedelta(days=1)).year,
                       (alvo + timedelta(days=1)).month,
                       (alvo + timedelta(days=1)).day, 12, 0, 0)
        dados = self._get("sleep", {
            "start_time": self._iso(inicio),
            "end_time": self._iso(fim),
        })
        return _parsear_sono(dados)

    def frequencia_cardiaca(self, alvo: date | None = None) -> dict:
        """Retorna frequência cardíaca do dia."""
        alvo = alvo or date.today()
        inicio, fim = self._intervalo_dia(alvo)
        dados = self._get("heart_rate", {
            "start_time": inicio,
            "end_time": fim,
        })
        return _parsear_frequencia_cardiaca(dados)

    def exercicios(self, alvo: date | None = None) -> list[dict]:
        """Retorna sessões de exercício do dia."""
        alvo = alvo or date.today()
        inicio, fim = self._intervalo_dia(alvo)
        dados = self._get("exercise", {
            "start_time": inicio,
            "end_time": fim,
        })
        return _parsear_exercicios(dados)


# ── Parsers ────────────────────────────────────────────────────────────────────

def _parsear_passos(dados: dict) -> dict:
    itens = dados.get("items", [])
    total = sum(item.get("count", 0) for item in itens)
    distancia_m = sum(item.get("distance", 0) for item in itens)
    calorias = sum(item.get("calorie", 0) for item in itens)
    return {
        "total": total,
        "distancia_km": round(distancia_m / 1000, 2),
        "calorias": round(calorias),
    }


def _parsear_sono(dados: dict) -> dict:
    itens = dados.get("items", [])
    if not itens:
        return {"duracao_horas": None, "qualidade": None, "fases": {}}

    # Pega o registro mais recente
    registro = itens[-1]
    duracao_ms = registro.get("duration", 0)
    duracao_horas = duracao_ms / (1000 * 60 * 60)

    qualidade_map = {
        0: "não avaliada",
        1: "ruim",
        2: "regular",
        3: "boa",
    }
    qualidade = qualidade_map.get(registro.get("quality", 0), "desconhecida")

    # Fases do sono (em minutos)
    fases_ms = registro.get("stages", {})
    fases = {
        "leve": round(fases_ms.get("light", 0) / 60000),
        "profundo": round(fases_ms.get("deep", 0) / 60000),
        "rem": round(fases_ms.get("rem", 0) / 60000),
        "acordado": round(fases_ms.get("awake", 0) / 60000),
    }

    return {
        "duracao_horas": round(duracao_horas, 1),
        "qualidade": qualidade,
        "fases": fases,
    }


def _parsear_frequencia_cardiaca(dados: dict) -> dict:
    itens = dados.get("items", [])
    batimentos = [item.get("heart_rate", 0) for item in itens if item.get("heart_rate")]

    if not batimentos:
        return {"media": None, "minima": None, "maxima": None}

    return {
        "media": round(sum(batimentos) / len(batimentos)),
        "minima": min(batimentos),
        "maxima": max(batimentos),
    }


def _parsear_exercicios(dados: dict) -> list[dict]:
    itens = dados.get("items", [])
    resultado = []

    for item in itens:
        tipo_id = item.get("exercise_type", 0)
        tipo = EXERCISE_TYPES.get(tipo_id, f"Exercício ({tipo_id})")
        duracao_min = round(item.get("duration", 0) / 60000)
        calorias = round(item.get("calorie", 0))
        distancia_km = round(item.get("distance", 0) / 1000, 2)

        resultado.append({
            "tipo": tipo,
            "duracao_min": duracao_min,
            "calorias": calorias,
            "distancia_km": distancia_km,
        })

    return resultado


# ── Formatação de contexto para IA ────────────────────────────────────────────

def formatar_contexto_saude(cliente: SamsungHealthClient) -> str:
    """
    Busca todos os dados de saúde e retorna string formatada
    para injeção nos prompts de IA.
    """
    linhas = ["## 📊 Dados Samsung Health (hoje)"]

    # Passos
    try:
        p = cliente.passos()
        total = p.get("total", 0)
        km = p.get("distancia_km", 0)
        cal = p.get("calorias", 0)
        linhas.append(
            f"- 🦶 Passos: **{total:,}** ({km} km, {cal} kcal)"
        )
    except Exception as e:
        linhas.append(f"- 🦶 Passos: sem dados ({e})")

    # Sono
    try:
        s = cliente.sono()
        if s.get("duracao_horas") is not None:
            fases = s.get("fases", {})
            fases_str = ""
            if any(fases.values()):
                fases_str = (
                    f" [leve {fases.get('leve')}min, "
                    f"profundo {fases.get('profundo')}min, "
                    f"REM {fases.get('rem')}min]"
                )
            linhas.append(
                f"- 😴 Sono: **{s['duracao_horas']}h** "
                f"({s.get('qualidade', 'sem qualidade')}){fases_str}"
            )
        else:
            linhas.append("- 😴 Sono: sem dados")
    except Exception as e:
        linhas.append(f"- 😴 Sono: sem dados ({e})")

    # Frequência cardíaca
    try:
        fc = cliente.frequencia_cardiaca()
        if fc.get("media") is not None:
            linhas.append(
                f"- ❤️  FC: **{fc['media']} bpm** "
                f"(mín {fc['minima']}, máx {fc['maxima']})"
            )
        else:
            linhas.append("- ❤️  FC: sem dados")
    except Exception as e:
        linhas.append(f"- ❤️  FC: sem dados ({e})")

    # Exercícios
    try:
        ex = cliente.exercicios()
        if ex:
            for e in ex:
                km_str = f", {e['distancia_km']} km" if e.get("distancia_km") else ""
                linhas.append(
                    f"- 🏃 {e['tipo']}: {e['duracao_min']}min "
                    f"({e['calorias']} kcal{km_str})"
                )
        else:
            linhas.append("- 🏃 Exercícios: nenhum registrado hoje")
    except Exception as e:
        linhas.append(f"- 🏃 Exercícios: sem dados ({e})")

    return "\n".join(linhas)
