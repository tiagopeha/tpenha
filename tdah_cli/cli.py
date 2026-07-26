import time
import sys
import os
from pathlib import Path

import click
from rich.console import Console
from rich.panel import Panel

from tdah_cli import __version__
from tdah_cli.config import load_config, ConfigError
from aiobs import init_tracker
from aiobs.backends import JSONLBackend

console = Console()


def run_bloco(comando: str):
    """Fluxo principal: gravar → transcrever → processar → salvar → abrir."""
    from tdah_cli.audio import gravar_audio, AudioCurtoError
    from tdah_cli.transcribe import transcrever
    from tdah_cli.process import processar
    from tdah_cli.storage import salvar_markdown, abrir_editor

    inicio = time.time()

    try:
        config = load_config()
    except ConfigError as e:
        console.print(f"\n[red]❌ Configuração inválida:[/red] {e}")
        sys.exit(1)

    init_tracker(project="tdah-ia-cli", backends=[JSONLBackend()])

    audio_path = None
    transcricao = None

    try:
        audio_path = gravar_audio()

        transcricao = transcrever(audio_path, config)

        output = processar(transcricao, comando, config)

        caminho = salvar_markdown(transcricao, output, comando)

        duracao = int(time.time() - inicio)
        console.print(f"\n[green]✓ Concluído em {duracao}s[/green] → {caminho}")

        abrir_editor(caminho, config)

    except AudioCurtoError as e:
        console.print(f"\n[red]❌ {e}[/red]")
        sys.exit(1)

    except KeyboardInterrupt:
        console.print("\n[yellow]⚠ Interrompido.[/yellow]")
        sys.exit(0)

    except Exception as e:
        console.print(f"\n[red]❌ Erro inesperado:[/red] {e}")
        _salvar_falha(audio_path, transcricao, comando)
        sys.exit(1)

    finally:
        if audio_path and Path(audio_path).exists():
            try:
                Path(audio_path).unlink()
            except OSError:
                pass


def _salvar_falha(audio_path, transcricao, comando):
    """Salva o que conseguiu em _falhas/ para não perder nada."""
    from tdah_cli.storage import salvar_falha
    try:
        salvar_falha(audio_path, transcricao, comando)
        console.print("[yellow]⚠ Dados salvos em ~/tdah-ia/_falhas/ para retry manual.[/yellow]")
    except Exception:
        pass


@click.group()
@click.version_option(__version__, prog_name="tdah")
def main():
    """CLI pessoal para rotina TDAH com IA.

    Quatro blocos de rotina, cada um com captura de áudio,
    transcrição via Whisper e processamento via Claude.
    """
    pass


@main.command()
def ignicao():
    """🌅 Bloco da manhã: despejo mental + alvo do dia."""
    console.print(Panel("[bold yellow]IGNIÇÃO[/bold yellow] — Bloco da manhã", expand=False))
    run_bloco("ignicao")


@main.command()
def destrava():
    """🔓 Travado numa tarefa? Aqui você destravar."""
    console.print(Panel("[bold yellow]DESTRAVA[/bold yellow] — Quebrando o bloqueio", expand=False))
    run_bloco("destrava")


@main.command()
def triagem():
    """📋 Triagem semanal de ideias capturadas."""
    console.print(Panel("[bold yellow]TRIAGEM[/bold yellow] — Classificando ideias da semana", expand=False))
    run_bloco("triagem")


@main.command()
def fechamento():
    """🌙 Fim do dia: fechar limpo e armar amanhã."""
    console.print(Panel("[bold yellow]FECHAMENTO[/bold yellow] — Fechando o dia", expand=False))
    run_bloco("fechamento")


@main.command()
def config():
    """⚙️  Mostra configuração atual (paths, modelo, editor)."""
    try:
        cfg = load_config()
    except ConfigError as e:
        console.print(f"[red]❌ {e}[/red]")
        sys.exit(1)

    base_dir = Path(cfg["base_dir"]).expanduser()
    env_path = Path(".env").resolve()

    console.print(Panel(
        f"[bold].env[/bold]: {env_path}\n"
        f"[bold]Base dir[/bold]: {base_dir}\n"
        f"[bold]Editor[/bold]: {cfg['editor']}\n"
        f"[bold]Modelo Claude[/bold]: {cfg['claude_model']}\n"
        f"[bold]ANTHROPIC_API_KEY[/bold]: {'✓ definida' if cfg.get('anthropic_api_key') else '✗ FALTANDO'}\n"
        f"[bold]OPENAI_API_KEY[/bold]: {'✓ definida' if cfg.get('openai_api_key') else '✗ FALTANDO'}",
        title="Configuração tdah-ia",
        expand=False,
    ))
