# Fitness Dashboard

Aplicação web para rastreamento de déficit calórico com integração Samsung Health e análise de refeições com Claude IA.

## Estrutura

```
web/
├── backend/       # FastAPI (Python)
└── frontend/      # Next.js 14 (TypeScript + Tailwind)
```

## Pré-requisitos

- Python 3.11+
- Node.js 18+
- Chave de API Anthropic (para análise de refeições com Claude)

## Variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto (`/home/user/tpenha/.env`):

```env
ANTHROPIC_API_KEY=sk-ant-...

# Opcional — necessário para Samsung Health
SAMSUNG_HEALTH_CLIENT_ID=seu-client-id
SAMSUNG_HEALTH_CLIENT_SECRET=seu-client-secret
```

## Backend (FastAPI)

```bash
cd web/backend

# Instalar dependências
pip install -r requirements.txt

# Iniciar servidor (porta 8000)
python main.py
# ou
uvicorn main:app --reload
```

A API ficará disponível em: http://localhost:8000  
Documentação Swagger: http://localhost:8000/docs

### Endpoints principais

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /api/dashboard | Dashboard completo do dia |
| GET | /api/meals?date=YYYY-MM-DD | Listar refeições |
| POST | /api/meals | Criar refeição (analisa com Claude) |
| DELETE | /api/meals/{id} | Deletar refeição |
| GET | /api/profile | Buscar perfil |
| PUT | /api/profile | Atualizar perfil |
| GET | /api/health/daily?date=YYYY-MM-DD | Dados Samsung Health |
| GET | /api/health/auth-status | Status de autenticação |
| GET | /api/health/auth-url | URL de autorização OAuth2 |

## Frontend (Next.js)

```bash
cd web/frontend

# Instalar dependências
npm install

# Iniciar em desenvolvimento (porta 3000)
npm run dev

# Build de produção
npm run build && npm start
```

A aplicação ficará disponível em: http://localhost:3000

## Funcionalidades

### Dashboard (`/`)
- Gauge circular mostrando calorias consumidas vs. TDEE
- Barras de progresso de macronutrientes (proteína, carboidratos, gordura)
- Cards Samsung Health: passos, sono, FC, último treino
- Recomendação do dia (descanso / cardio / treino completo)
- Lista de refeições do dia com quick-add

### Refeições (`/refeicoes`)
- Registro de refeições por tipo (café, almoço, jantar, lanche)
- Análise automática com Claude (texto + foto opcional)
- Totais diários de calorias e macros
- Navegação por data

### Treinos (`/treinos`)
- Strip semanal de atividade
- Lista de exercícios do Samsung Health
- Cards de sono (com fases) e frequência cardíaca
- Recomendação baseada em recuperação

### Perfil (`/perfil`)
- Formulário de dados pessoais (peso, altura, idade, sexo)
- Nível de atividade física
- Meta (déficit/manter/superávit) com slider de kcal
- BMR e TDEE calculados em tempo real (Mifflin-St Jeor)
- Status e botão de conexão Samsung Health

## Tecnologias

### Backend
- **FastAPI** — framework web assíncrono
- **aiosqlite** — SQLite assíncrono
- **anthropic** — SDK Claude para análise de refeições
- **httpx** — cliente HTTP para Samsung Health API

### Frontend
- **Next.js 14** — App Router, SSR/CSR
- **Tailwind CSS** — estilização
- **@tanstack/react-query** — gerenciamento de estado e cache
- **recharts** — gráficos (gauge de déficit)
- **lucide-react** — ícones

## Samsung Health

A integração Samsung Health usa o cliente OAuth2 existente em `tdah_cli/samsung_health.py`.

Para autenticar:
1. Configure `SAMSUNG_HEALTH_CLIENT_ID` e `SAMSUNG_HEALTH_CLIENT_SECRET` no `.env`
2. Acesse a página Perfil no app web
3. Clique em "Conectar Samsung Health"
4. Autorize no browser
