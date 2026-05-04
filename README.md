# tdah-ia-cli

CLI pessoal para apoiar rotina TDAH com IA. Captura áudio do microfone, transcreve com Whisper (OpenAI) e processa com Claude (Anthropic), salvando o resultado como markdown organizado por data.

## Quatro blocos de rotina

| Comando | Alias | Quando usar |
|---|---|---|
| `tdah ignicao` | `ig` | Manhã: despejo mental + alvo do dia |
| `tdah destrava` | `dt` | Travado numa tarefa específica |
| `tdah triagem` | `tr` | Semanal: classificar ideias capturadas |
| `tdah fechamento` | `fc` | Fim do dia: fechar limpo e armar amanhã |

## Setup

### 1. Pré-requisitos

- Python 3.11+
- `uv` instalado (`curl -LsSf https://astral.sh/uv/install.sh | sh`)
- Conta na [Anthropic Console](https://console.anthropic.com) com créditos
- Conta na [OpenAI Platform](https://platform.openai.com) com créditos

### 2. Instalar

```bash
git clone <repo>
cd tdah-ia-cli
uv sync
```

Ou com pip:

```bash
pip install -e .
```

### 3. Configurar chaves de API

```bash
cp .env.example .env
# Edite .env com suas chaves reais
```

Conteúdo do `.env`:

```
ANTHROPIC_API_KEY=sk-ant-SUA_CHAVE_AQUI
OPENAI_API_KEY=sk-SUA_CHAVE_AQUI
```

### 4. Aliases no zsh (recomendado)

Adicione ao final do seu `~/.zshrc`:

```bash
alias ig='tdah ignicao'
alias dt='tdah destrava'
alias tr='tdah triagem'
alias fc='tdah fechamento'
```

Depois rode:

```bash
source ~/.zshrc
```

Agora você pode usar `ig`, `dt`, `tr` e `fc` diretamente no terminal.

### 5. Testar

```bash
tdah --help      # lista os 4 comandos
tdah config      # mostra configuração atual
ig               # testa ignição (fale algo, Ctrl+C pra parar)
```

## Como funciona

1. Roda o comando → terminal exibe barra de gravação amarela
2. Fale o que quiser → Ctrl+C pra parar
3. Whisper transcreve o áudio (em português)
4. Claude processa com o prompt específico do bloco
5. Markdown salvo em `~/tdah-ia/YYYY-MM-DD/{bloco}.md`
6. VS Code abre o arquivo automaticamente

## Estrutura de arquivos gerados

```
~/tdah-ia/
├── 2025-05-04/
│   ├── ignicao.md
│   ├── destrava-1430.md    # segundo arquivo do dia
│   └── fechamento.md
├── 2025-05-05/
│   └── ignicao.md
└── _falhas/                # salvamento de emergência em caso de erro
```

## Variáveis de ambiente (opcionais)

| Variável | Default | Descrição |
|---|---|---|
| `TDAH_BASE_DIR` | `~/tdah-ia` | Pasta raiz dos markdowns |
| `TDAH_EDITOR` | `code` | Editor pra abrir o arquivo |
| `TDAH_CLAUDE_MODEL` | `claude-opus-4-7` | Modelo Claude |

## Erros comuns

**"Chaves de API faltando"** → Crie o `.env` a partir do `.env.example` e preencha as chaves reais.

**"Áudio muito curto"** → Grave pelo menos 2 segundos de áudio.

**Arquivo salvo em `_falhas/`** → Erro de API ou internet. Os arquivos ficam lá para retry manual.

## Desenvolvimento

```bash
uv run pytest tests/          # smoke tests
```
