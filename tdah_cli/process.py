import time
from pathlib import Path
from typing import Optional

import httpx
from rich.console import Console
from rich.status import Status

console = Console()

CLAUDE_URL = "https://api.anthropic.com/v1/messages"
TIMEOUT = 90.0
MAX_TOKENS = 2000
MAX_RETRIES = 3
RETRY_DELAYS = [2, 4, 8]
FALLBACK_MODEL = "claude-sonnet-4-6"

PROMPT_DIR = Path(__file__).parent / "prompts"


def processar(
    transcricao: str,
    comando: str,
    config: dict,
    contexto_saude: Optional[str] = None,
) -> str:
    """Processa a transcrição com Claude. Retorna o markdown gerado.

    Args:
        transcricao: Texto transcrito do áudio.
        comando: Nome do bloco (ignicao, destrava, triagem, fechamento, saude).
        config: Dicionário de configuração carregado por load_config().
        contexto_saude: Contexto formatado do Samsung Health para injetar no prompt.
                        Se None, nenhum dado de saúde é incluído.
    """
    api_key = config["anthropic_api_key"]
    model = config.get("claude_model", "claude-opus-4-7")
    system_prompt = _carregar_prompt(comando)

    # Injeta dados de saúde no início da mensagem do usuário, se disponíveis
    mensagem = transcricao
    if contexto_saude:
        mensagem = (
            f"{contexto_saude}\n\n"
            f"---\n\n"
            f"**Relato do usuário:**\n{transcricao}"
        )

    with Status("🧠 Processando...", console=console, spinner="dots"):
        for tentativa in range(MAX_RETRIES):
            try:
                return _chamar_claude(mensagem, system_prompt, api_key, model)
            except httpx.TimeoutException:
                if tentativa == MAX_RETRIES - 1:
                    raise
                _aguardar(tentativa, "Timeout")
            except httpx.HTTPStatusError as e:
                status = e.response.status_code
                if status == 429:
                    if tentativa == MAX_RETRIES - 1:
                        raise
                    _aguardar(tentativa, "Rate limit")
                elif status == 404 and model != FALLBACK_MODEL:
                    console.print(
                        f"[yellow]⚠ Modelo {model} não encontrado, usando {FALLBACK_MODEL}[/yellow]"
                    )
                    model = FALLBACK_MODEL
                else:
                    raise
            except httpx.ConnectError:
                if tentativa == MAX_RETRIES - 1:
                    raise RuntimeError(
                        "Sem conexão com a internet. Transcrição salva em _falhas/ para retry manual."
                    )
                _aguardar(tentativa, "Sem conexão")

    raise RuntimeError("Falha no processamento após todas as tentativas.")


def processar_saude(contexto_saude: str, config: dict) -> str:
    """Envia os dados de saúde para o Claude gerar análise e recomendações."""
    return processar(
        transcricao=contexto_saude,
        comando="saude",
        config=config,
        contexto_saude=None,  # O próprio contexto já é a entrada
    )


def _chamar_claude(mensagem: str, system_prompt: str, api_key: str, model: str) -> str:
    payload = {
        "model": model,
        "max_tokens": MAX_TOKENS,
        "system": system_prompt,
        "messages": [{"role": "user", "content": mensagem}],
    }
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }

    with httpx.Client(timeout=TIMEOUT) as client:
        resp = client.post(CLAUDE_URL, json=payload, headers=headers)

    resp.raise_for_status()
    texto = resp.json()["content"][0]["text"].strip()
    console.print(f"[green]✓ Processamento concluído[/green] ({len(texto)} chars)")
    return texto


def _carregar_prompt(comando: str) -> str:
    prompt_file = PROMPT_DIR / f"{comando}.md"
    if not prompt_file.exists():
        raise FileNotFoundError(f"Prompt não encontrado: {prompt_file}")
    return prompt_file.read_text(encoding="utf-8").strip()


def _aguardar(tentativa: int, motivo: str):
    delay = RETRY_DELAYS[tentativa]
    console.print(f"[yellow]⚠ {motivo} — aguardando {delay}s...[/yellow]")
    time.sleep(delay)
