# Projeto Diamante (codinome provisório)

App de anotação oficial, pitch count e placar ao vivo para clubes e famílias do beisebol e softbol amador brasileiro.

**Antes de implementar qualquer coisa, leia:** `docs/spec-mvp.md` (escopo e telas), `docs/regras-cbbs.md` (regras federativas → requisitos), `docs/modelo-de-eventos.md` (domínio) e `docs/cenarios-de-teste.md` (spec executável de regras).

## O que estamos construindo (MVP)

Duas funcionalidades âncora sobre um mesmo motor: **Guardião de Pitch Count** (compliance CT-02 na mesa oficial — alertas, limites, bloqueios de escalação) e **página pública de jogo compartilhável via WhatsApp** (crescimento). Em volta: elenco/agenda/RSVP e marcação ao vivo em dois modos (rápido e súmula oficial). Tudo gratuito no MVP.

**Fora de escopo — não implementar, não criar stubs:** chaveamento/gestão de torneio (o agrupamento "dia de competição" para o razão de arremessos ESTÁ dentro), fechamento completo com ERA e súmula em PDF (fase 2 — mas o log captura os dados desde já), acumulados de temporada, marketplace de treinadores, pagamentos/crowdfunding, caronas, câmera AR/video locker, multi-anotador simultâneo.

## Princípios de arquitetura (inegociáveis)

1. **Offline-first.** A marcação funciona 100% sem rede — campo no interior é zona morta de 4G. Todo evento grava primeiro no SQLite local; sync é oportunista e nunca bloqueia a UI.
2. **Event sourcing SÓ no domínio do jogo.** Jogadas são eventos imutáveis append-only; estatísticas SEMPRE derivadas por funções puras; correções via `supersedes`. Elenco, agenda e RSVP são CRUD relacional com cache offline.
3. **Regra é dado, não código.** Limites, tempos, nocautes e restrições vivem em `RulesProfile` versionados por torneio/categoria, validados por árbitro contra o regulamento vigente. Nunca hardcode um limite — eles mudam por edição.
4. **O modelo nasce em nível de súmula oficial.** O schema captura pitch a pitch, atribuição defensiva (6-3) e erros desde o dia 1 — retrofit de granularidade é fatal. A UI é que escala em camadas: modo rápido exige pouco, modo oficial exige tudo. Dois modos, um log.
5. **Nunca hard block no contador de arremessos.** O regulamento permite terminar de enfrentar o rebatedor além do limite. O app avisa, colore e registra; quem decide é o humano. Bloqueios rígidos só em alocação de escalação comprovadamente ilegal (P↔C no dia, reentrada vetada), sempre exibindo a norma.
6. **Um anotador oficial por jogo (v1).** Um único dispositivo escreve eventos de um jogo — elimina conflito de sync por design.
7. **A página pública do jogo é o produto de crescimento.** Abre instantânea no browser do WhatsApp com OG image dinâmica do placar. Performance dessa página > qualquer outra coisa no web app.
8. **PT-BR é a língua do produto; inglês é a do código.** Glossário abaixo é a ponte — usar sempre os mesmos termos.
9. **Dados de menores por padrão.** Perfil de atleta pertence à conta do responsável (LGPD Art. 14). Minimização: nada de foto, biometria ou documento no MVP. Elencos avulsos de adversários (modo oficial) guardam só nome e número.

## Stack

- **Mobile:** Expo (React Native) + TypeScript `strict`. `expo-sqlite` + fila de sync própria (append-only, idempotente por id).
- **Backend:** Supabase — Postgres (eventos append-only), Auth, Realtime (canal por `gameId`).
- **Web:** Next.js server-rendered, OG images dinâmicas.
- **Monorepo:** pnpm workspaces + Turborepo. **Testes:** vitest no `packages/core`.

## Estrutura

```
apps/
  mobile/     # Expo — mesa oficial, técnico, pais
  web/        # Next.js — páginas públicas de jogo
packages/
  core/       # Domínio puro: eventos, derivadores (box score, game state,
              # pitcher day ledger, TQB, LOB), RulesProfile e validações.
              # Zero dependência de plataforma.
docs/         # Specs — fonte de verdade do produto
```

## Regras de implementação

- `packages/core` é TypeScript puro: proibido importar React, Expo ou Supabase. Tudo testável com vitest.
- **Toda derivação e toda validação de regra nasce com teste.** Cenários vêm de `docs/cenarios-de-teste.md`, escritos por um árbitro federado de beisebol e softbol (o Tiago) — tratar como espec oficial. Dúvida de regra: perguntar a ele, nunca assumir.
- IDs de evento: ULID no dispositivo. Idempotência de sync por ID. Estatística nunca calculada na UI — sempre derivadores do `core`.
- Validações de escalação retornam a referência da norma (ex.: "CT-02 — exclusividade arremessador/receptor") para a UI exibir.
- Commits pequenos, mensagens em inglês, convenção `feat:/fix:/docs:/test:`.

## Glossário do domínio (PT ↔ código)

| Termo em campo | No código | Nota |
| --- | --- | --- |
| rebatida válida | `single` / `double` / `triple` / `homeRun` | conta como hit |
| base por bolas | `walk` (BB) | não é AB |
| bola morta no rebatedor | `hitByPitch` (HBP) | não é AB |
| strikeout | `strikeoutSwinging` / `strikeoutLooking` | K / KL |
| eliminado com bola em jogo | `outInPlay` + `defense.putoutSequence` | ex.: [6,3] = interbases→primeira |
| escolha do defensor | `fieldersChoice` (FC) | não é hit |
| chegou por erro | `reachedOnError` (ROE) + `defense.errors` | não é hit |
| toque / fly de sacrifício | `sacBunt` / `sacFly` | fora do AB; SF entra no denominador do OBP |
| roubo de base | `runnerAdvanced` reason `stolenBase` | roubo de home proibido no Pré-Infantil |
| corredor de cortesia | `courtesyRunnerIn` | sobreposição (alias), NUNCA substituição |
| ordem contínua | `battingOrder.mode: 'continuous'` | 12–14 slots; defesa desacoplada (9) |
| entrada atacada/defendida | fração outs/3 | alimenta o TQB |
| deixados em base | LOB | corredores em base no 3º out |
| nocaute / super nocaute | `mercy[]` no RulesProfile | 20 pontos na 2ª = fim imediato |
| súmula / fechamento | scoresheet / closing | tabulação oficial pós-jogo (fase 2: automática + PDF) |
| razão do dia | `pitcherDayLedger` | arremessos e flags P/C por atleta por dia de competição |
