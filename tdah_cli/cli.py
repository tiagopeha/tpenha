import time
import sys
import os
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from tdah_cli import __version__
from tdah_cli.config import load_config, samsung_health_configurado, ConfigError

console = Console()


# ── Samsung Health helper ──────────────────────────────────────────────────────

def _criar_cliente_samsung(config: dict):
    """Instancia o SamsungHealthClient se as credenciais estiverem configuradas."""
    from tdah_cli.samsung_health import SamsungHealthClient
    return SamsungHealthClient(
        client_id=config["samsung_client_id"],
        client_secret=config["samsung_client_secret"],
        token_path=config["samsung_token_path"],
    )


def _buscar_contexto_saude(config: dict) -> Optional[str]:
    """
    Tenta buscar dados do Samsung Health para enriquecer os prompts.
    Retorna None silenciosamente se não estiver configurado ou autenticado.
    """
    if not samsung_health_configurado(config):
        return None

    try:
        from tdah_cli.samsung_health import SamsungHealthClient, formatar_contexto_saude
        cliente = _criar_cliente_samsung(config)
        if not cliente.autenticado:
            return None

        with console.status("📊 Buscando dados Samsung Health...", spinner="dots"):
            contexto = formatar_contexto_saude(cliente)
        console.print("[dim]✓ Dados de saúde incluídos como contexto[/dim]")
        return contexto

    except Exception as e:
        console.print(f"[dim yellow]⚠ Samsung Health indisponível: {e}[/dim yellow]")
        return None


# ── Fluxo principal ────────────────────────────────────────────────────────────

def run_bloco(comando: str, incluir_saude: bool = True):
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

    # Busca contexto de saúde antes de gravar (não bloqueia se falhar)
    contexto_saude = _buscar_contexto_saude(config) if incluir_saude else None

    audio_path = None
    transcricao = None

    try:
        audio_path = gravar_audio()

        transcricao = transcrever(audio_path, config)

        output = processar(transcricao, comando, config, contexto_saude=contexto_saude)

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


# ── CLI ────────────────────────────────────────────────────────────────────────

@click.group()
@click.version_option(__version__, prog_name="tdah")
def main():
    """CLI pessoal para rotina TDAH com IA.

    Quatro blocos de rotina, cada um com captura de áudio,
    transcrição via Whisper e processamento via Claude.

    Samsung Health (opcional): configure SAMSUNG_HEALTH_CLIENT_ID e
    SAMSUNG_HEALTH_CLIENT_SECRET no .env para enriquecer os blocos com
    dados de atividade. Use `tdah saude --autorizar` para autenticar.
    """
    pass


@main.command()
@click.option("--sem-saude", is_flag=True, help="Desativa o contexto Samsung Health nesta execução.")
def ignicao(sem_saude: bool):
    """🌅 Bloco da manhã: despejo mental + alvo do dia."""
    console.print(Panel("[bold yellow]IGNIÇÃO[/bold yellow] — Bloco da manhã", expand=False))
    run_bloco("ignicao", incluir_saude=not sem_saude)


@main.command()
@click.option("--sem-saude", is_flag=True, help="Desativa o contexto Samsung Health nesta execução.")
def destrava(sem_saude: bool):
    """🔓 Travado numa tarefa? Aqui você destravar."""
    console.print(Panel("[bold yellow]DESTRAVA[/bold yellow] — Quebrando o bloqueio", expand=False))
    run_bloco("destrava", incluir_saude=not sem_saude)


@main.command()
@click.option("--sem-saude", is_flag=True, help="Desativa o contexto Samsung Health nesta execução.")
def triagem(sem_saude: bool):
    """📋 Triagem semanal de ideias capturadas."""
    console.print(Panel("[bold yellow]TRIAGEM[/bold yellow] — Classificando ideias da semana", expand=False))
    run_bloco("triagem", incluir_saude=not sem_saude)


@main.command()
@click.option("--sem-saude", is_flag=True, help="Desativa o contexto Samsung Health nesta execução.")
def fechamento(sem_saude: bool):
    """🌙 Fim do dia: fechar limpo e armar amanhã."""
    console.print(Panel("[bold yellow]FECHAMENTO[/bold yellow] — Fechando o dia", expand=False))
    run_bloco("fechamento", incluir_saude=not sem_saude)


# ── Comando saude ──────────────────────────────────────────────────────────────

@main.command()
@click.option(
    "--autorizar",
    is_flag=True,
    help="Abre o browser para autenticar com Samsung Health via OAuth2.",
)
@click.option(
    "--analise",
    is_flag=True,
    help="Envia os dados para o Claude gerar análise e recomendações.",
)
@click.option(
    "--data",
    default=None,
    metavar="YYYY-MM-DD",
    help="Consulta dados de uma data específica (padrão: hoje).",
)
def saude(autorizar: bool, analise: bool, data: Optional[str]):
    """📊 Dados de atividade do Samsung Health.

    Exibe passos, sono, frequência cardíaca e exercícios do dia.
    Com --analise, o Claude interpreta os dados no contexto do TDAH.

    Primeira vez: execute `tdah saude --autorizar` para conectar.
    """
    console.print(Panel("[bold cyan]SAÚDE[/bold cyan] — Samsung Health", expand=False))

    try:
        config = load_config()
    except ConfigError as e:
        console.print(f"\n[red]❌ Configuração inválida:[/red] {e}")
        sys.exit(1)

    if not samsung_health_configurado(config):
        console.print(
            "\n[yellow]⚠ Samsung Health não configurado.[/yellow]\n"
            "Adicione ao seu .env:\n"
            "  [bold]SAMSUNG_HEALTH_CLIENT_ID[/bold]=seu-client-id\n"
            "  [bold]SAMSUNG_HEALTH_CLIENT_SECRET[/bold]=seu-client-secret\n\n"
            "Obtenha as credenciais em: "
            "[link=https://developer.samsung.com/health/server-api]"
            "developer.samsung.com/health/server-api[/link]"
        )
        sys.exit(1)

    from tdah_cli.samsung_health import (
        SamsungHealthClient,
        formatar_contexto_saude,
    )

    cliente = _criar_cliente_samsung(config)

    # ── Autorização OAuth2 ─────────────────────────────────────────────────────
    if autorizar:
        try:
            cliente.autorizar()
            console.print(
                "\n[green]✓ Samsung Health conectado com sucesso![/green]\n"
                "Execute [bold]tdah saude[/bold] para ver seus dados."
            )
        except TimeoutError as e:
            console.print(f"\n[red]❌ Timeout:[/red] {e}")
            sys.exit(1)
        except PermissionError as e:
            console.print(f"\n[red]❌ Acesso negado:[/red] {e}")
            sys.exit(1)
        except Exception as e:
            console.print(f"\n[red]❌ Erro na autorização:[/red] {e}")
            sys.exit(1)
        return

    # ── Verifica autenticação ──────────────────────────────────────────────────
    if not cliente.autenticado:
        console.print(
            "\n[yellow]⚠ Não autenticado.[/yellow] "
            "Execute [bold]tdah saude --autorizar[/bold] primeiro."
        )
        sys.exit(1)

    # ── Define data alvo ───────────────────────────────────────────────────────
    from datetime import date
    alvo = None
    if data:
        try:
            alvo = date.fromisoformat(data)
        except ValueError:
            console.print(f"[red]❌ Data inválida:[/red] {data!r} (use YYYY-MM-DD)")
            sys.exit(1)

    # ── Busca e exibe dados ────────────────────────────────────────────────────
    console.print()

    dados_passos = None
    dados_sono = None
    dados_fc = None
    dados_ex = None

    with console.status("📊 Buscando dados...", spinner="dots"):
        try:
            dados_passos = cliente.passos(alvo)
        except Exception as e:
            console.print(f"[dim yellow]⚠ Passos: {e}[/dim yellow]")

        try:
            dados_sono = cliente.sono(alvo)
        except Exception as e:
            console.print(f"[dim yellow]⚠ Sono: {e}[/dim yellow]")

        try:
            dados_fc = cliente.frequencia_cardiaca(alvo)
        except Exception as e:
            console.print(f"[dim yellow]⚠ FC: {e}[/dim yellow]")

        try:
            dados_ex = cliente.exercicios(alvo)
        except Exception as e:
            console.print(f"[dim yellow]⚠ Exercícios: {e}[/dim yellow]")

    # Tabela de resumo
    tabela = Table(title=f"Samsung Health — {alvo or date.today()}", expand=False)
    tabela.add_column("Métrica", style="bold")
    tabela.add_column("Valor")
    tabela.add_column("Detalhe", style="dim")

    if dados_passos:
        total = dados_passos.get("total", 0)
        meta = 10000
        barra = "█" * min(20, int(total / meta * 20))
        tabela.add_row(
            "🦶 Passos",
            f"{total:,}",
            f"{dados_passos.get('distancia_km', 0)} km · {dados_passos.get('calorias', 0)} kcal  [{barra:<20}]",
        )
    else:
        tabela.add_row("🦶 Passos", "[dim]sem dados[/dim]", "")

    if dados_sono and dados_sono.get("duracao_horas") is not None:
        fases = dados_sono.get("fases", {})
        fases_str = (
            f"leve {fases.get('leve', 0)}min · "
            f"profundo {fases.get('profundo', 0)}min · "
            f"REM {fases.get('rem', 0)}min"
            if any(fases.values())
            else ""
        )
        tabela.add_row(
            "😴 Sono",
            f"{dados_sono['duracao_horas']}h ({dados_sono.get('qualidade', '?')})",
            fases_str,
        )
    else:
        tabela.add_row("😴 Sono", "[dim]sem dados[/dim]", "")

    if dados_fc and dados_fc.get("media") is not None:
        tabela.add_row(
            "❤️  Freq. Cardíaca",
            f"{dados_fc['media']} bpm",
            f"mín {dados_fc['minima']} · máx {dados_fc['maxima']}",
        )
    else:
        tabela.add_row("❤️  Freq. Cardíaca", "[dim]sem dados[/dim]", "")

    if dados_ex:
        for ex in dados_ex:
            km_str = f" · {ex['distancia_km']} km" if ex.get("distancia_km") else ""
            tabela.add_row(
                f"🏃 {ex['tipo']}",
                f"{ex['duracao_min']} min",
                f"{ex['calorias']} kcal{km_str}",
            )
    else:
        tabela.add_row("🏃 Exercícios", "[dim]nenhum hoje[/dim]", "")

    console.print(tabela)

    # ── Análise Claude (opcional) ──────────────────────────────────────────────
    if analise:
        console.print()
        try:
            contexto = formatar_contexto_saude(cliente)
            from tdah_cli.process import processar_saude
            resultado = processar_saude(contexto, config)
            console.print(Panel(
                resultado,
                title="🧠 Análise Claude — Saúde & Foco",
                border_style="cyan",
                expand=False,
            ))
        except Exception as e:
            console.print(f"[red]❌ Erro na análise:[/red] {e}")


# ── Comando config ─────────────────────────────────────────────────────────────

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

    samsung_status = (
        "[green]✓ configurado[/green]"
        if samsung_health_configurado(cfg)
        else "[dim]✗ não configurado (opcional)[/dim]"
    )

    # Verifica se tem tokens salvos
    token_path = cfg["samsung_token_path"]
    samsung_auth = (
        "[green]✓ autenticado[/green]"
        if token_path.exists()
        else "[dim]✗ não autenticado[/dim]"
    )

    console.print(Panel(
        f"[bold].env[/bold]: {env_path}\n"
        f"[bold]Base dir[/bold]: {base_dir}\n"
        f"[bold]Editor[/bold]: {cfg['editor']}\n"
        f"[bold]Modelo Claude[/bold]: {cfg['claude_model']}\n"
        f"[bold]ANTHROPIC_API_KEY[/bold]: {'✓ definida' if cfg.get('anthropic_api_key') else '✗ FALTANDO'}\n"
        f"[bold]OPENAI_API_KEY[/bold]: {'✓ definida' if cfg.get('openai_api_key') else '✗ FALTANDO'}\n"
        f"[bold]Samsung Health[/bold]: {samsung_status}\n"
        f"[bold]Samsung Auth[/bold]: {samsung_auth}",
        title="Configuração tdah-ia",
        expand=False,
    ))
