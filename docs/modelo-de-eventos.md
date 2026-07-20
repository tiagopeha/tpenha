# Modelo de eventos do jogo

Só o **jogo ao vivo** é event-sourced. Elenco, agenda e RSVP são CRUD relacional normal. Regras de categoria vêm de `RulesProfile` (ver `regras-cbbs.md`) — o motor consome o perfil, nunca hardcoda limites.

## Dois modos, um único log

O mesmo modelo de eventos serve dois níveis de anotação, escolhidos no pré-jogo:

- **Modo rápido** — amistosos, festivais, família na arquibancada. Desfechos de PA + corredores + arremessos (quando a categoria tem pitch count). Sem atribuição defensiva obrigatória.
- **Modo súmula oficial** — mesa oficial ("back net"). Anota **as duas equipes**, exige atribuição defensiva nos outs (sequência tipo 6-3) e erros. É o que habilita o fechamento automático (ERA, LOB, TQB) na fase 2.

O schema é o mesmo; o modo só muda o que a UI exige. Assim o modelo já nasce em nível oficial — retrofit de granularidade seria fatal — sem impor o custo do detalhe a quem só quer marcar o jogo do filho.

## Envelope do evento

```ts
type GameEvent = {
  id: string;          // ULID gerado no dispositivo — chave de idempotência
  gameId: string;
  seq: number;         // monotônico por jogo no dispositivo do anotador
  ts: string;          // ISO 8601
  deviceId: string;
  type: EventType;
  payload: unknown;    // discriminado por type (Zod)
  supersedes?: string; // id do evento corrigido, quando for correção
};
```

Evento **nunca** é editado ou apagado. Correção = novo evento com `supersedes`; derivadores ignoram eventos substituídos.

## Tipos de evento (v1)

**Ciclo de vida**

- `gameCreated` — `{ sport, category, rulesProfileId, mode: 'quick' | 'official', opponentName /* texto livre — nunca exigir adversário na plataforma */, opponentRoster?: {name, number}[] /* modo oficial: elenco avulso, sem contas */, home: boolean, competitionDayId? /* torneio+data — alimenta o razão diário de arremessos */ }`
- `clockStarted` — "Play Ball"; o cronômetro do `timeLimit` conta a partir daqui
- `lineupSet` — `{ battingSlots: [{ slot: 1..14, playerId }], defense: Record<Position, PlayerId>, extraHitter?: boolean }` — ordem de rebatida (até 14, modo contínuo) desacoplada do mapa defensivo
- `defensiveChange` — `{ assignments: Record<Position, PlayerId> }` — **não** altera a ordem de rebatida
- `offensiveSubstitution` — `{ slot, outPlayerId, inPlayerId }` — desativado quando o perfil usa ordem contínua
- `courtesyRunnerIn` — `{ forPlayerId /* P ou C */, runnerId, base }` — **sobreposição, não substituição**: o titular segue ativo; o CC ocupa a base como alias e se dissolve ao fim da meia-entrada ou quando sai da base
- `halfInningStarted` — `{ inning, half: 'top' | 'bottom' }`
- `halfInningEnded` — `{ reason: 'threeOuts' | 'runCap' | 'timeHard' | 'walkOff' }` — snapshot de LOB é derivado neste ponto
- `gameEnded` — `{ reason: 'regulation' | 'mercy' | 'timeLimit' | 'walkOff' | 'forfeit' | 'suspended' | 'other', detail? }`

**Arremessos** (obrigatório quando `pitching.style === 'kidPitch'`; módulo oculto em tee/coachPitch)

- `pitchThrown` — `{ pitcherId, call: 'ball' | 'strikeSwinging' | 'strikeLooking' | 'foul' | 'inPlay' | 'hitByPitch' }` — alimenta contagem do confronto E o razão diário de pitch count

**Aparição ao bastão**

- `plateAppearanceRecorded` —

```ts
{
  batterId: string;
  result: PAResult;
  battedBall?: 'ground' | 'fly' | 'line';
  defense?: {                       // exigido no modo oficial p/ outs e ROE
    putoutSequence?: number[];      // ex.: [6, 3] — numeração em regras-cbbs.md
    errors?: { position: number }[];
  };
}

type PAResult =
  | 'single' | 'double' | 'triple' | 'homeRun'
  | 'walk' | 'hitByPitch'
  | 'strikeoutSwinging' | 'strikeoutLooking'
  | 'outInPlay' | 'fieldersChoice' | 'reachedOnError'
  | 'sacBunt' | 'sacFly';           // sacBunt indisponível em perfis T-Bol (bunt proibido)
```

**Corredores** — após cada PA, a UI confirma o diamante; cada movimento é um evento:

- `runnerAdvanced` — `{ runnerId, from: 1|2|3, to: 2|3|'home', reason?: 'batterAction' | 'stolenBase' | 'wildPitch' | 'passedBall' | 'error' | 'balk' | 'other' }` (`to: 'home'` = corrida; `reason` tipado é o que permitirá separar corrida merecida na fase 2 e aplicar o teto de 1 base em WP/PB das categorias menores)
- `runnerOut` — `{ runnerId, base, reason?: 'caughtStealing' | 'pickoff' | 'forceOut' | 'tagOut' | 'stealHomeProhibited' | 'other' }` — `stealHomeProhibited`: no Pré-Infantil, tentativa de roubo de home = out declarado (o motor aplica pelo perfil)

O derivador valida consistência (duas pessoas na mesma base = estado inválido) e a UI impede o registro antes de gravar.

## Derivações (packages/core — funções puras)

- `deriveGameState(events, profile)` → placar, entrada, outs, corredores, contagem do rebatedor, relógio restante, e **prompts obrigatórios**: nocaute/Super Nocaute atingido, teto de corridas da entrada, fim por tempo (`hard` vs `noNewInning`).
- `deriveBoxScore(events)` → linhas de rebatedores e arremessadores (fórmulas abaixo).
- `derivePitcherDayLedger(eventsOfCompetitionDay)` → por atleta no dia: `officialPitches`, `overageToFinishBatter` (legal se `pitchesAtStartOfAtBat ≤ limite`; não acumula no agregado de 2 dias), `pitchedToday`, `caughtToday`, restantes, `reentryBlocked` (margens 6/8/9), elegibilidade T-Bol (um único dia no torneio).
- `validateDefensiveAssignment(ledger, profile, playerId, position)` → consumida pelo construtor de escalação: bloqueia P↔C no mesmo dia, reentrada na margem proibida, T-Bol reincidente — sempre com a referência da norma para exibir na UI.
- `deriveTQB(events)` e `deriveLOB(events)` → desempates oficiais; entradas fracionárias (out = ⅓) e corredores em base no 3º out saem direto do log.

## Fórmulas exatas (os testes cobram)

- `PA` = toda `plateAppearanceRecorded` não substituída · `AB` = PA − (BB + HBP + SAC + SF)
- `H` = 1B + 2B + 3B + HR · `TB` = 1B + 2·2B + 3·3B + 4·HR
- `BA` = H / AB · `OBP` = (H + BB + HBP) / (AB + BB + HBP + SF) · `SLG` = TB / AB · `OPS` = OBP + SLG
- `R` = `runnerAdvanced to:'home'` não substituído · `RBI` (simplificado v1): corridas na PA do rebatedor, exceto `reachedOnError`
- Arremessador: `IP` = outs / 3 (notação 5.1 = 5⅓ — a mesma fração alimenta o TQB) · `WHIP` = (BB + H) / IP · `RA9` = 9 · R / IP
- `ERA` (fase 2, só modo oficial): exige reconstrução da entrada sem os erros — depende de `defense.errors` e `reason: 'error'` já capturados desde o v1
- Divisão por zero (AB = 0, IP = 0): exibir "—", nunca NaN

## Sync offline-first

1. Evento grava no SQLite local e entra na fila de sync na mesma transação; a UI nunca espera rede.
2. Push em lote para o Postgres (append-only, `INSERT ... ON CONFLICT (id) DO NOTHING`).
3. **Um único escritor por jogo (v1)** ⇒ ordem total pelo `seq` local, sem resolução de conflito.
4. Página web assina o canal do `gameId` (Supabase Realtime) e re-deriva incrementalmente.
5. Servidor valida forma e autorização — nunca regra de negócio; a verdade do jogo é o log.
6. Jogo suspenso e retomado: mesmo `gameId` (restrições da partida persistem), novo `calendarDay` no razão diário.
