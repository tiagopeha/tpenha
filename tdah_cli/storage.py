import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

from rich.console import Console

console = Console()


def _base_dir(config: dict | None = None) -> Path:
    if config:
        base = config.get("base_dir", "~/tdah-ia")
    else:
        base = "~/tdah-ia"
    return Path(base).expanduser()


def salvar_markdown(transcricao: str, output: str, comando: str, config: dict | None = None) -> Path:
    hoje = datetime.now()
    pasta_dia = _base_dir(config) / hoje.strftime("%Y-%m-%d")
    pasta_dia.mkdir(parents=True, exist_ok=True)

    caminho = pasta_dia / f"{comando}.md"
    if caminho.exists():
        caminho = pasta_dia / f"{comando}-{hoje.strftime('%H%M')}.md"

    data_legivel = hoje.strftime("%d/%m/%Y")
    timestamp = hoje.strftime("%d/%m/%Y %H:%M")

    conteudo = f"""# {comando.capitalize()} — {data_legivel}

> Gerado em {timestamp}

## Transcrição (áudio original)

{transcricao}

---

## Processado

{output}
"""

    caminho.write_text(conteudo, encoding="utf-8")
    return caminho


def abrir_editor(caminho: Path, config: dict | None = None):
    editor = "code"
    if config:
        editor = config.get("editor", "code")

    if shutil.which(editor):
        try:
            subprocess.Popen([editor, str(caminho)])
        except OSError:
            console.print(f"[yellow]⚠ Não foi possível abrir o editor. Arquivo em:[/yellow] {caminho}")
    else:
        console.print(f"[yellow]⚠ Editor '{editor}' não encontrado. Arquivo em:[/yellow] {caminho}")


def salvar_falha(audio_path: str | None, transcricao: str | None, comando: str, config: dict | None = None):
    falhas_dir = _base_dir(config) / "_falhas"
    falhas_dir.mkdir(parents=True, exist_ok=True)

    ts = datetime.now().strftime("%Y%m%d-%H%M%S")

    if audio_path:
        src = Path(audio_path)
        if src.exists():
            shutil.copy2(src, falhas_dir / f"{comando}-{ts}.wav")

    if transcricao:
        (falhas_dir / f"{comando}-{ts}-transcricao.txt").write_text(transcricao, encoding="utf-8")
