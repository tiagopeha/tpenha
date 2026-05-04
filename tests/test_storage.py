"""Smoke tests para storage.py — estrutura de pastas e salvamento."""

import tempfile
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

import pytest

from tdah_cli.storage import salvar_markdown, salvar_falha


@pytest.fixture
def tmp_base(tmp_path):
    config = {"base_dir": str(tmp_path), "editor": "echo"}
    return tmp_path, config


def test_salvar_markdown_cria_pasta_do_dia(tmp_base):
    base, config = tmp_base
    caminho = salvar_markdown("transcrição teste", "output teste", "ignicao", config)
    hoje = datetime.now().strftime("%Y-%m-%d")
    assert (base / hoje).is_dir()
    assert caminho.exists()


def test_salvar_markdown_conteudo(tmp_base):
    base, config = tmp_base
    caminho = salvar_markdown("minha transcrição", "meu output", "ignicao", config)
    conteudo = caminho.read_text()
    assert "minha transcrição" in conteudo
    assert "meu output" in conteudo
    assert "# Ignicao" in conteudo


def test_salvar_markdown_segundo_arquivo_tem_horario(tmp_base):
    base, config = tmp_base
    c1 = salvar_markdown("transcricao 1", "output 1", "ignicao", config)
    c2 = salvar_markdown("transcricao 2", "output 2", "ignicao", config)
    assert c1 != c2
    assert c1.name == "ignicao.md"
    assert c2.name.startswith("ignicao-")


def test_salvar_falha_audio_inexistente_nao_crasha(tmp_base):
    base, config = tmp_base
    salvar_falha("/tmp/nao-existe.wav", None, "ignicao", config)
    falhas = base / "_falhas"
    assert falhas.is_dir()


def test_salvar_falha_salva_transcricao(tmp_base):
    base, config = tmp_base
    salvar_falha(None, "texto da transcrição", "destrava", config)
    falhas = base / "_falhas"
    arquivos = list(falhas.glob("destrava-*-transcricao.txt"))
    assert len(arquivos) == 1
    assert "texto da transcrição" in arquivos[0].read_text()
