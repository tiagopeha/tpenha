# Cenários de teste — espec executável de regras

**Autor: Tiago (árbitro de beisebol e softbol).** Cada cenário abaixo vira um teste automatizado em `packages/core`. Em caso de conflito entre código e este arquivo, este arquivo vence — o código está errado.

## Formato

Escreva em português corrido, jogada a jogada, e termine com o **resultado esperado** (placar, outs, corredores e/ou linhas do box score). O Claude Code traduz para eventos + asserts. Quanto mais capcioso o cenário, melhor: os fáceis qualquer um acerta.

---

## Cenário 01 — Sac fly não conta AB, mas conta RBI (exemplo preenchido)

> Baixa da 3ª entrada, 1 out, corredor na terceira. Rebatedor nº 7 acerta um fly profundo para o campo central; defensor pega (2º out) e o corredor da terceira reclassifica e marca.

**Esperado:** rebatedor nº 7 → PA 1, AB 0, SF 1, RBI 1. Placar +1. 2 outs, bases vazias. OBP dele considera o SF no denominador (uma PA com só esse SF ⇒ OBP = 0.000, BA = —).

---

## Cenário 02 — Chegou por erro não é hit

> _(escreva aqui)_

**Esperado:** _(...)_

---

## Cenário 03 — Escolha do defensor com corrida marcando

> _(escreva aqui)_

**Esperado:** _(...)_

---

## Cenário 04 — Correção de jogada depois que o próximo rebatedor já foi anotado

> _(anotador marcou 1B, mas era erro do defensor; corrige duas jogadas depois)_

**Esperado:** _(...)_

---

## Cenário 05 — Fim de jogo por mercy rule

> _(regra exata da categoria: preencher com a diferença de corridas e a entrada mínima)_

**Esperado:** _(...)_

---

## Sugestões de cenários capciosos para adicionar

Terceiro strike caído com rebatedor chegando na primeira · roubo de casa · walk-off (jogo termina no meio da jogada?) · corredor substituto (courtesy runner) para o catcher · rebatedor fora de ordem · dupla eliminação com corrida marcando antes do 3º out (força vs toque) · abandono de base.
