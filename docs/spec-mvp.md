# Spec do MVP

## Objetivo

Duas dores, um produto:

1. **Guardião de Pitch Count** — na mesa oficial, o app assume o cálculo mental que o regulamento impõe ao anotador voluntário: limites diários por categoria, alerta nos últimos 5 arremessos, "terminar o rebatedor", margens de reentrada, exclusividade arremessador↔receptor. É a proposta de valor dominante para clubes e a razão de adoção na mesa ("back net").
2. **Página de jogo compartilhável** — a família a 400 km acompanha cada jogada por um link no WhatsApp. É o motor de crescimento viral.

**Métricas norte:** jogos marcados por fim de semana · acessos remotos únicos por jogo · alertas de pitch count disparados (proxy de uso na mesa oficial) · % de jogos iniciados que são concluídos.

## Personas

1. **Anotador(a) da mesa oficial** — obrigatório por regulamento (multa de R$ 350 se a equipe não apresentar). Hoje faz contagem de arremessos e "fechamento" da súmula à mão. Persona prioritária.
2. **Pai/mãe na arquibancada** — marca o jogo do filho no modo rápido, sem treinamento.
3. **Técnico(a)** — elenco, convocações, escalação; precisa saber em tempo real quais braços ainda estão disponíveis no dia.
4. **Familiar remoto** — não baixa app: clica no link e acompanha ao vivo.

## Os dois modos de anotação

| | Modo rápido | Modo súmula oficial |
| --- | --- | --- |
| Para quem | família, amistosos, festivais | mesa oficial do torneio |
| Equipes anotadas | só o próprio time | **as duas** (adversário como elenco avulso: nome + número, sem contas) |
| Arremessos | obrigatório se a categoria tem pitch count | pitch a pitch, sempre |
| Defesa | opcional | sequência de eliminação (6-3) e erros obrigatórios nos outs/ROE |
| Habilita | placar ao vivo, box score, stats de rebatida | tudo do rápido + fechamento automático (fase 2: ERA, súmula em PDF) |

Mesmo log de eventos nos dois — o modo só muda o que a UI exige (ver `modelo-de-eventos.md`).

## Escopo

### Dentro (MVP)

- Time → categorias → elenco (nome, número, posições).
- Agenda + RSVP com notificação.
- **Dia de competição:** agrupamento leve de jogos (torneio + data) que alimenta o razão diário de arremessos entre jogos. Não é chaveamento.
- Marcação ao vivo nos dois modos: escalação com ordem contínua (9–14 slots) desacoplada da defesa, pitch a pitch quando aplicável, desfechos de PA, corredores, corredor de cortesia, substituições com validação de regras.
- **Motor de regras por perfil** (`RulesProfile`): relógio hard/noNewInning, nocaute e Super Nocaute automáticos, teto de corridas por entrada, restrições de roubo das categorias menores, template T-Bol (sem módulo de arremesso, sem bunt/infield fly, foul < 5 m).
- **Painel "Braços do dia":** todos os arremessadores do dia de competição — bolas oficiais, excedente legal, restantes, bloqueios (reentrada, P↔C, T-Bol) — visível ao técnico e à mesa.
- Página pública do jogo (web) + resumo pós-jogo compartilhável.

### Fora (não construir)

Chaveamento/gestão de torneio · fechamento completo com ERA e **súmula em PDF** (fase 2 — mas o log já captura tudo desde o v1) · acumulados de temporada · marketplace de personais · pagamentos/crowdfunding · caronas · vídeo/AR · multi-anotador · qualquer paywall.

## Fluxos principais

1. **Setup:** técnico cria time, elenco, agenda; se for torneio, cria o dia de competição e vincula os jogos.
2. **Pré-jogo:** escolher modo (rápido/oficial), confirmar `RulesProfile` da categoria, escalação (slots de rebatida + mapa defensivo), adversário em texto livre ou elenco avulso no modo oficial. O construtor de escalação já bloqueia alocações ilegais (P↔C do dia, reentrada vetada, T-Bol reincidente) exibindo a norma.
3. **Ao vivo:** pitch a pitch (ball/strike/foul — categoria kid pitch) com contador do arremessador sempre visível: verde → **laranja em limite−5** (alerta "notifique o árbitro principal") → **vermelho no limite** ("pode terminar este rebatedor; não pode iniciar outro"). Desfecho da PA em grid de botões grandes; no modo oficial, o out pede a sequência defensiva por toques no diamante numerado (6 → 3, dois toques). Confirmação de corredores no diamante a cada jogada.
4. **Automação de regras:** corrida registrada → avaliação de nocaute; 5 corridas na entrada (grupos B) → encerramento da meia-entrada; tempo expirado → hard stop ou "não inicia nova entrada", conforme perfil. O app apresenta a intervenção; nunca depende da memória do anotador.
5. **Correção:** "corrigir última jogada" sempre visível; anteriores via linha do tempo. Correção = evento com `supersedes`, estatísticas re-derivam.
6. **Compartilhar:** link do jogo formatado para WhatsApp desde o pré-jogo.
7. **Pós-jogo:** encerramento (com motivo: regulamentar, nocaute, tempo…), resumo com box score e TQB/LOB do jogo, link vira registro histórico.

## Telas (mobile)

1. **Home do time** — próximos compromissos, jogo ao vivo, atalho para "Braços do dia" se houver dia de competição ativo.
2. **Elenco** — por categoria; atleta vinculado à conta do responsável.
3. **Agenda + RSVP**.
4. **Pré-jogo** — modo, perfil de regras, escalação em dois painéis (ordem de rebatida ↕ / diamante defensivo), validações inline com referência à norma.
5. **Marcação ao vivo** — a tela crítica: diamante no topo (corredores, outs, entrada, placar, relógio), contador de arremessos com estados de cor, rebatedor atual, grid de desfechos, atribuição defensiva por toques (modo oficial). Zero digitação durante o jogo; uso com uma mão, sob sol.
6. **Braços do dia** — razão de arremessadores do dia de competição com bloqueios explicados.
7. **Play-by-play / correções**.
8. **Resumo do jogo** — placar, box score, compartilhar.

## Página pública do jogo (web)

- Estados: pré-jogo → ao vivo (placar, entrada, outs, corredores, play-by-play) → final (resumo + box score).
- Requisitos duros: abrir instantânea no browser do WhatsApp em 4G fraco; OG image dinâmica com o placar (o preview do link É a primeira impressão); Supabase Realtime sem refresh; sem login.
- Rodapé: "Marcado com [nome do app]" — único canal de aquisição do MVP.

## Questões em aberto — para o Tiago (árbitro)

_Respondidas pela pesquisa de regras: perfis por categoria, pitch count (prioridade máxima confirmada), funcionamento da súmula oficial. Detalhes em `regras-cbbs.md`. Restam:_

1. **Softbol:** existe limite de arremessos (windmill) nas categorias de base da CBBS? A regra DP/FLEX é usada? (Define o perfil de regras do piloto no softbol.)
2. **Valores vigentes:** CT-02 desta temporada — limites por categoria e teto agregado de 2 dias. Ideal: anexar o PDF do regulamento ao repo como fonte dos `RulesProfile`.
3. **Súmula oficial preenchida** (foto/PDF) para clonar o layout na fase 2.
4. Corrida do corredor de cortesia credita ao CC ou ao titular?
5. **Piloto:** qual time/categoria e em qual jogo/torneio do calendário?

## Riscos de produto

- **A tela de marcação é o produto.** No modo oficial, a atribuição defensiva precisa custar dois toques — se custar mais, o anotador volta pro papel. Prototipar com um anotador real antes de polir qualquer outra tela.
- **Regras mudam por edição.** Limite errado no app = infração em jogo oficial + confiança destruída. Perfis versionados, validados por árbitro, com a fonte (regulamento) anexada — nunca hardcode.
- **Correção é fluxo principal, não exceção.** Anotador voluntário erra; o design parte disso.
- **WhatsApp é o concorrente do módulo de agenda.** RSVP em um toque na notificação.
