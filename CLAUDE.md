# Projeto Diamante (codinome provisório)

App de placar ao vivo e gestão de time para clubes e famílias do beisebol e softbol amador brasileiro.

**Antes de implementar qualquer coisa, leia:** `docs/spec-mvp.md` (escopo e telas), `docs/modelo-de-eventos.md` (domínio) e `docs/cenarios-de-teste.md` (spec executável de regras).

## O que estamos construindo (MVP)

Uma única cunha: **marcação de jogo ao vivo simplificada + página pública de jogo compartilhável via WhatsApp + elenco/agenda/RSVP**. Tudo gratuito no MVP.

**Fora de escopo — não implementar, não criar stubs, não "preparar para o futuro":** marketplace de treinadores, pagamentos/crowdfunding, caronas, câmera AR/video locker, ERA com corridas limpas (usamos RA), multi-anotador simultâneo, modo torneio/chaveamento.

## Princípios de arquitetura (inegociáveis)

1. **Offline-first.** A marcação do jogo funciona 100% sem rede — campo no interior é zona morta de 4G. Todo evento grava primeiro no SQLite local; sync é oportunista, em background, e nunca bloqueia a UI de marcação.
2. **Event sourcing SÓ no domínio do jogo.** Jogadas são eventos imutáveis append-only. Estatísticas são SEMPRE derivadas do log por funções puras — nunca armazenadas como fonte de verdade. Correções são novos eventos com `supersedes`; nunca editar ou deletar eventos. Elenco, agenda e RSVP são CRUD relacional normal com cache offline — não transformar tudo em evento.
3. **Um anotador oficial por jogo (v1).** Um único dispositivo escreve eventos de um jogo. Isso elimina conflitos de sync por design. Multi-anotador está fora de escopo.
4. **A página pública do jogo é o produto de crescimento.** Abre instantânea no browser do WhatsApp, com OG image dinâmica mostrando o placar no preview do link. A performance dessa página tem prioridade sobre qualquer outra coisa no web app.
5. **PT-BR é a língua do produto; inglês é a língua do código.** UI, textos e docs em português. Tipos, funções e eventos em inglês. O glossário abaixo é a ponte — usar sempre os mesmos termos.
6. **Dados de menores por padrão.** Perfil de atleta pertence à conta do responsável (LGPD Art. 14). Minimização: não coletar nenhum dado que o MVP não usa. Nada de foto, biometria ou documento escolar no MVP.

## Stack

- **Mobile:** Expo (React Native) + TypeScript `strict`. `expo-sqlite` local + fila de sync própria (append-only, idempotente por id de evento).
- **Backend:** Supabase — Postgres (tabela de eventos append-only), Auth, Realtime (subscription por `gameId` para a página web).
- **Web (páginas de jogo):** Next.js server-rendered, com geração dinâmica de OG image do placar.
- **Monorepo:** pnpm workspaces + Turborepo.
- **Testes:** vitest no `packages/core`.

## Estrutura

```
apps/
  mobile/     # Expo — técnico, anotador(a), pais
  web/        # Next.js — páginas públicas de jogo
packages/
  core/       # Domínio puro: tipos de evento, derivadores de estatística,
              # perfis de regra por categoria. Zero dependência de plataforma.
docs/         # Specs — fonte de verdade do produto
```

## Regras de implementação

- `packages/core` é TypeScript puro: proibido importar React, Expo, Supabase ou qualquer coisa de plataforma. Tudo testável com vitest.
- **Toda regra de derivação de estatística nasce com teste.** Os cenários vêm de `docs/cenarios-de-teste.md`, escritos por um árbitro federado de beisebol e softbol (o Tiago). Tratar esse arquivo como espec oficial de regras — em caso de dúvida sobre uma regra, perguntar a ele em vez de assumir.
- IDs de evento: ULID gerado no dispositivo. Idempotência de sync por ID.
- Nunca calcular estatística na UI — sempre via derivadores do `core`.
- Commits pequenos e frequentes; mensagens em inglês, convenção `feat:/fix:/docs:/test:`.

## Glossário do domínio (PT ↔ código)

| Termo em campo | No código | Nota |
| --- | --- | --- |
| rebatida válida | `single` / `double` / `triple` / `homeRun` | conta como hit |
| base por bolas | `walk` (BB) | não é AB |
| bola morta no rebatedor | `hitByPitch` (HBP) | não é AB |
| strikeout | `strikeoutSwinging` / `strikeoutLooking` | K / KL |
| eliminado com bola em jogo | `outInPlay` | fly, grounder, linha — sem detalhe defensivo no v1 |
| escolha do defensor | `fieldersChoice` (FC) | rebatedor salvo, corredor eliminado; não é hit |
| chegou por erro | `reachedOnError` (ROE) | não é hit — mantém BA honesta |
| toque de sacrifício | `sacBunt` (SAC) | não é AB |
| fly de sacrifício | `sacFly` (SF) | não é AB; entra no denominador do OBP |
| roubo de base | `stolenBase` (SB) | evento de corredor |
| entrada (alta/baixa) | `inning` (`top` / `bottom`) | |
| corrida | `run` | corredor chega ao home |
| súmula | scoresheet | anotação oficial da federação |
