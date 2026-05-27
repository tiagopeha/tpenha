import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

PROMPT_DIR = Path(__file__).parent / "prompts"

# Arquivo de tokens Samsung Health (armazenado fora do repo)
SAMSUNG_TOKEN_PATH = Path.home() / ".tdah-ia" / ".samsung_tokens.json"


class ConfigError(Exception):
    pass


def load_config() -> dict:
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY", "")
    openai_key = os.environ.get("OPENAI_API_KEY", "")

    missing = []
    if not anthropic_key or anthropic_key.startswith("sk-ant-..."):
        missing.append("ANTHROPIC_API_KEY")
    if not openai_key or openai_key.startswith("sk-..."):
        missing.append("OPENAI_API_KEY")

    if missing:
        env_example = Path(__file__).parent.parent / ".env.example"
        raise ConfigError(
            f"Chaves de API faltando: {', '.join(missing)}\n"
            f"  1. Copie .env.example → .env\n"
            f"  2. Preencha as chaves reais\n"
            f"  Exemplo: {env_example}"
        )

    return {
        "anthropic_api_key": anthropic_key,
        "openai_api_key": openai_key,
        "base_dir": os.environ.get("TDAH_BASE_DIR", "~/tdah-ia"),
        "editor": os.environ.get("TDAH_EDITOR", "code"),
        "claude_model": os.environ.get("TDAH_CLAUDE_MODEL", "claude-opus-4-7"),
        # Samsung Health (opcionais — integração desabilitada se ausentes)
        "samsung_client_id": os.environ.get("SAMSUNG_HEALTH_CLIENT_ID", ""),
        "samsung_client_secret": os.environ.get("SAMSUNG_HEALTH_CLIENT_SECRET", ""),
        "samsung_token_path": SAMSUNG_TOKEN_PATH,
    }


def samsung_health_configurado(config: dict) -> bool:
    """Retorna True se as credenciais Samsung estão definidas no .env."""
    return bool(
        config.get("samsung_client_id")
        and config.get("samsung_client_secret")
        and not config["samsung_client_id"].startswith("seu-client-id")
    )
