# Modelo de eventos do jogo

Só o **jogo ao vivo** é event-sourced. Elenco, agenda e RSVP são CRUD relacional normal.

## Por que event sourcing aqui

Cada jogada é um fato imutável. Estatísticas são derivações. Isso resolve, com um único modelo: offline-first (log local → replicação append-only), correções do anotador (evento de correção, nunca edição), e recomputação de qualquer estatística futura sobre jogos antigos.

## Envelope do evento

```ts
type GameEvent = {
  id: string;          // ULID gerado no dispositivo — chave de idempotência
  gameId: string;
  seq: number;         // monotônico por jogo no dispositivo do anotador
  ts: string;          // ISO 8601, relógio do dispositivo
  deviceId: string;
  type: EventType;
  payload: unknown;    // discriminado por type (Zod)
  supersedes?: string; // id do evento corrigido, quando for correção
};
```

Um evento **nunca** é editado ou apagado. Correção = novo evento com `supersedes`; o derivador ignora eventos substituídos.

## Tipos de evento (v1)

**Ciclo de vida**

- `gameCreated` — payload: `{ sport: 'baseball' | 'softball', category, rulesProfileId, scheduledInnings, opponentName /* texto livre! */, home: boolean }`
- `lineupSet` — ordem de rebatida inicial + posições
- `substitutionMade` — `{ outPlayerId, inPlayerId, battingSlot, position }`
- `halfInningStarted` — `{ inning, half: 'top' | 'bottom' }`
- `gameEnded` — `{ reason: 'regulation' | 'mercyRule' | 'walkOff' | 'forfeit' | 'other' }`

**Aparição ao bastão**

- `plateAppearanceRecorded` — `{ batterId, result: PAResult, battedBall?: 'ground' | 'fly' | 'line' /* opcional */ }`

```ts
type PAResult =
  | 'single' | 'double' | 'triple' | 'homeRun'
  | 'walk' | 'hitByPitch'
  | 'strikeoutSwinging' | 'strikeoutLooking'
  | 'outInPlay' | 'fieldersChoice' | 'reachedOnError'
  | 'sacBunt' | 'sacFly';
```

**Corredores**

- `runnerAdvanced` — `{ runnerId, from: 1|2|3, to: 2|3|'home' }` (`to: 'home'` = corrida)
- `runnerOut` — `{ runnerId, base: 1|2|3|'home', reason?: 'caughtStealing' | 'pickoff' | 'forceOut' | 'tagOut' | 'other' }`
- `stolenBase` — `{ runnerId, to: 2|3|'home' }`

Após cada `plateAppearanceRecorded`, a UI pede confirmação do estado dos corredores no diamante; cada movimento vira um evento próprio. O derivador valida consistência (não pode haver dois corredores na mesma base) e a UI impede estados inválidos antes de gravar.

**Arremessos (granularidade opcional — decisão pendente da questão nº 2 da spec)**

- `pitchThrown` — `{ pitcherId, call: 'ball' | 'strikeSwinging' | 'strikeLooking' | 'foul' | 'inPlay' }`

Se pitch count for exigência de torneio, este evento vira obrigatório e alimenta alertas de limite. Caso contrário, v1 registra só desfechos de PA.

## Derivação (packages/core)

Funções puras: `deriveGameState(events)` → placar, entrada, outs, corredores (alimenta UI e página web) e `deriveBoxScore(events)` → linhas de rebatedores e arremessadores.

**Fórmulas exatas** (a implementação segue isto, e os testes cobram):

- `PA` = toda `plateAppearanceRecorded` não substituída
- `AB` = PA − (BB + HBP + SAC + SF)
- `H` = 1B + 2B + 3B + HR
- `TB` = 1B + 2·2B + 3·3B + 4·HR
- `BA` = H / AB
- `OBP` = (H + BB + HBP) / (AB + BB + HBP + SF)  ← SAC bunt fora do denominador; SF dentro
- `SLG` = TB / AB · `OPS` = OBP + SLG
- `R` = corredor com `to: 'home'` não substituído · `RBI` (simplificado v1): corridas na PA do rebatedor, exceto quando `result: 'reachedOnError'`
- Arremessador: `IP` = outs registrados / 3 (notação 5.1 = 5⅓) · `WHIP` = (BB + H) / IP · `RA9` = 9 · R / IP — **sem** separar corridas limpas no v1 (nada de ERA ainda; atribuição de erro fica para a fase 2)

Divisão por zero (AB = 0, IP = 0): exibir "—", nunca NaN.

## Sync offline-first

1. Evento grava no SQLite local e entra na fila de sync na mesma transação. A UI nunca espera rede.
2. Push em lote para o Postgres (tabela append-only, `INSERT ... ON CONFLICT (id) DO NOTHING` — idempotente, pode reenviar à vontade).
3. **Um único escritor por jogo (v1)** ⇒ ordem total pelo `seq` local, sem resolução de conflito.
4. A página web assina o canal do `gameId` via Supabase Realtime e re-deriva o estado incrementalmente a cada evento novo.
5. Servidor valida apenas forma (schema) e autorização — nunca regras de negócio; a verdade do jogo é o log.

## Fora do modelo v1 (anotado, não implementado)

Balk, wild pitch/passed ball como avanço tipado (usar `runnerAdvanced` genérico), interferências, terceiro strike caído (registrar como K + `runnerAdvanced` do rebatedor — confirmar com árbitro), corredor substituto/courtesy runner (aguardando questão nº 1), atribuição defensiva (putouts/assists), earned runs.
