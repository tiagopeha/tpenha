import time
from pathlib import Path

import httpx
from rich.console import Console
from rich.status import Status

console = Console()

WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions"
TIMEOUT = 60.0
MAX_RETRIES = 3
RETRY_DELAYS = [2, 4, 8]


def transcrever(audio_path: str, config: dict) -> str:
    """Transcreve o arquivo WAV usando Whisper API. Retorna o texto."""
    api_key = config["openai_api_key"]

    with Status("🔤 Transcrevendo...", console=console, spinner="dots"):
        for tentativa in range(MAX_RETRIES):
            try:
                return _chamar_whisper(audio_path, api_key)
            except httpx.TimeoutException:
                if tentativa == MAX_RETRIES - 1:
                    raise
                _aguardar(tentativa, "Timeout")
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    if tentativa == MAX_RETRIES - 1:
                        raise
                    _aguardar(tentativa, "Rate limit")
                else:
                    raise
            except httpx.ConnectError:
                if tentativa == MAX_RETRIES - 1:
                    raise RuntimeError(
                        "Sem conexão com a internet. Áudio salvo em _falhas/ para retry manual."
                    )
                _aguardar(tentativa, "Sem conexão")

    raise RuntimeError("Falha na transcrição após todas as tentativas.")


def _chamar_whisper(audio_path: str, api_key: str) -> str:
    path = Path(audio_path)
    with path.open("rb") as f:
        with httpx.Client(timeout=TIMEOUT) as client:
            resp = client.post(
                WHISPER_URL,
                headers={"Authorization": f"Bearer {api_key}"},
                files={"file": (path.name, f, "audio/wav")},
                data={"model": "whisper-1", "language": "pt"},
            )
    resp.raise_for_status()
    texto = resp.json().get("text", "").strip()
    console.print(f"[green]✓ Transcrição concluída[/green] ({len(texto)} chars)")
    return texto


def _aguardar(tentativa: int, motivo: str):
    delay = RETRY_DELAYS[tentativa]
    console.print(f"[yellow]⚠ {motivo} — aguardando {delay}s...[/yellow]")
    time.sleep(delay)
