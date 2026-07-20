import { deriveBoxScore } from './deriveBoxScore';
import type { FieldingPosition, GameEvent } from './events';
import { CATCHER_POSITION, PITCHER_POSITION, effectiveEvents } from './events';
import type { RulesProfile } from './rulesProfile';

/**
 * Razão diário do atleta no dia de competição (docs/regras-cbbs.md §1).
 * Atravessa jogos: recebe os eventos de TODOS os jogos do dia
 * (`competitionDayId` = torneio + data).
 */
export type PitcherDayEntry = {
  playerId: string;
  /** Arremessos que contam no limite diário e nos tetos agregados. */
  officialPitches: number;
  /**
   * Excedente legal para "terminar de enfrentar o rebatedor": confronto
   * iniciado com `officialPitches ≤ limite` pode ultrapassar o teto; o
   * excedente NÃO acumula para os tetos agregados de dois dias.
   */
  overageToFinishBatter: number;
  /** Outs registrados no montinho (limite por outs no Sub-23/Adulto). */
  outsRecorded: number;
  pitchedToday: boolean;
  /** Qualquer atuação como receptor no dia ("uma única recepção" basta). */
  caughtToday: boolean;
  /** null quando o perfil não usa limite por bolas. */
  remainingPitches: number | null;
  /** null quando o perfil não usa limite por outs. */
  remainingOuts: number | null;
  /** officialPitches ≥ warnAt (limite − 5): "notifique o árbitro principal". */
  warned: boolean;
  /** Removido do montículo dentro da margem exígua — não volta a arremessar hoje. */
  reentryBlocked: boolean;
  /** Iniciou um confronto já com o limite atingido — irregularidade a exibir. */
  illegalAtBatStart: boolean;
  gamesPitched: string[];
};

export type PitcherDayLedger = {
  players: PitcherDayEntry[];
};

export function ledgerEntryFor(ledger: PitcherDayLedger, playerId: string): PitcherDayEntry | undefined {
  return ledger.players.find((entry) => entry.playerId === playerId);
}

type MutableEntry = PitcherDayEntry;

/**
 * Deriva o razão diário de arremessos e flags P/C por atleta, agregando os
 * eventos de todos os jogos do dia de competição. Jogo suspenso retomado em
 * outro dia NÃO entra: o razão diário recomeça por dia-calendário — o
 * chamador seleciona os eventos do dia.
 */
export function derivePitcherDayLedger(
  events: readonly GameEvent[],
  profile: RulesProfile,
): PitcherDayLedger {
  const limit = profile.pitching.dailyPitchLimit;
  const outLimit = profile.pitching.dailyOutLimit;
  const entries = new Map<string, MutableEntry>();

  const entryFor = (playerId: string): MutableEntry => {
    let entry = entries.get(playerId);
    if (entry === undefined) {
      entry = {
        playerId,
        officialPitches: 0,
        overageToFinishBatter: 0,
        outsRecorded: 0,
        pitchedToday: false,
        caughtToday: false,
        remainingPitches: null,
        remainingOuts: null,
        warned: false,
        reentryBlocked: false,
        illegalAtBatStart: false,
        gamesPitched: [],
      };
      entries.set(playerId, entry);
    }
    return entry;
  };

  // Agrupa por jogo preservando a ordem cronológica entre jogos do dia.
  const byGame = new Map<string, GameEvent[]>();
  for (const event of events) {
    const list = byGame.get(event.gameId);
    if (list === undefined) byGame.set(event.gameId, [event]);
    else list.push(event);
  }
  const games = [...byGame.entries()].sort(
    ([, a], [, b]) => Date.parse(a[0]!.ts) - Date.parse(b[0]!.ts),
  );

  const markMoundRemoval = (playerId: string): void => {
    if (limit === undefined || profile.pitching.reentryBanMargin === undefined) return;
    const entry = entryFor(playerId);
    if (!entry.pitchedToday) return;
    const remaining = Math.max(0, limit - entry.officialPitches);
    if (remaining <= profile.pitching.reentryBanMargin) {
      entry.reentryBlocked = true;
    }
  };

  for (const [gameId, gameEvents] of games) {
    const effective = effectiveEvents(gameEvents);

    let currentPitcherId: string | null = null;
    // Primeiro arremesso de cada confronto decide a legalidade do excedente.
    let atBatHasPitches = false;

    const assignDefense = (assignments: Record<string, string>): void => {
      const newPitcher = assignments[PITCHER_POSITION];
      if (newPitcher !== undefined && newPitcher !== currentPitcherId) {
        if (currentPitcherId !== null) markMoundRemoval(currentPitcherId);
        currentPitcherId = newPitcher;
      }
      const catcher = assignments[CATCHER_POSITION];
      if (catcher !== undefined) entryFor(catcher).caughtToday = true;
    };

    for (const event of effective) {
      switch (event.type) {
        case 'lineupSet':
          assignDefense(event.payload.defense);
          break;

        case 'defensiveChange':
          assignDefense(event.payload.assignments);
          break;

        case 'offensiveSubstitution':
          if (event.payload.outPlayerId === currentPitcherId) {
            markMoundRemoval(currentPitcherId);
            currentPitcherId = null;
          }
          break;

        case 'pitchThrown': {
          const entry = entryFor(event.payload.pitcherId);
          if (!atBatHasPitches) {
            atBatHasPitches = true;
            if (limit !== undefined && entry.officialPitches >= limit) {
              entry.illegalAtBatStart = true;
            }
          }
          if (limit !== undefined && entry.officialPitches >= limit) {
            entry.overageToFinishBatter += 1;
          } else {
            entry.officialPitches += 1;
          }
          entry.pitchedToday = true;
          if (!entry.gamesPitched.includes(gameId)) entry.gamesPitched.push(gameId);
          break;
        }

        case 'plateAppearanceRecorded':
        case 'halfInningStarted':
        case 'halfInningEnded':
          atBatHasPitches = false;
          break;

        default:
          break;
      }
    }

    // Outs no montinho (limite por outs): reaproveita a atribuição do box score.
    for (const line of deriveBoxScore(effective).pitching) {
      if (line.outsRecorded > 0) {
        const entry = entryFor(line.playerId);
        entry.outsRecorded += line.outsRecorded;
        entry.pitchedToday = true;
        if (!entry.gamesPitched.includes(gameId)) entry.gamesPitched.push(gameId);
      }
    }
  }

  for (const entry of entries.values()) {
    if (limit !== undefined) {
      entry.remainingPitches = Math.max(0, limit - entry.officialPitches);
      entry.warned = entry.officialPitches >= profile.pitching.warnAt;
    }
    if (outLimit !== undefined) {
      entry.remainingOuts = Math.max(0, outLimit - entry.outsRecorded);
    }
  }

  return { players: [...entries.values()] };
}

export type AssignmentViolation = {
  /** Referência da norma, para a UI exibir junto do bloqueio. */
  rule: string;
  message: string;
};

export type AssignmentValidation = {
  allowed: boolean;
  violations: AssignmentViolation[];
};

export type AssignmentContext = {
  /** T-Bol: o atleta arremessou em data anterior do MESMO torneio? */
  pitchedOnEarlierTournamentDay?: boolean;
};

/**
 * Valida a alocação de um atleta numa posição defensiva contra o razão do dia.
 * Consumida pelo construtor de escalação: bloqueia apenas alocação
 * comprovadamente ilegal, sempre com a referência da norma (nunca hard block
 * no contador de arremessos — "terminar o rebatedor" é decisão humana).
 */
export function validateDefensiveAssignment(
  ledger: PitcherDayLedger,
  profile: RulesProfile,
  playerId: string,
  position: FieldingPosition,
  context: AssignmentContext = {},
): AssignmentValidation {
  const entry = ledgerEntryFor(ledger, playerId);
  const violations: AssignmentViolation[] = [];

  if (position === 2 && entry?.pitchedToday === true) {
    violations.push({
      rule: 'CT-02 — exclusividade arremessador↔receptor',
      message: `${playerId} arremessou hoje; não pode atuar como receptor no mesmo dia de competição.`,
    });
  }

  if (position === 1) {
    if (entry?.caughtToday === true) {
      violations.push({
        rule: 'CT-02 — exclusividade arremessador↔receptor',
        message: `${playerId} atuou como receptor hoje (uma única recepção basta); não pode arremessar no mesmo dia.`,
      });
    }
    if (entry?.reentryBlocked === true) {
      violations.push({
        rule: 'CT-02 — reentrada no montículo',
        message: `${playerId} foi removido do montículo dentro da margem de ${String(
          profile.pitching.reentryBanMargin ?? '—',
        )} arremessos restantes; não pode voltar a arremessar hoje.`,
      });
    }
    if (entry !== undefined && entry.remainingPitches === 0) {
      violations.push({
        rule: 'CT-02 — limite diário de arremessos',
        message: `${playerId} atingiu o limite diário de ${String(
          profile.pitching.dailyPitchLimit ?? '—',
        )} arremessos; não pode iniciar novo confronto.`,
      });
    }
    if (profile.category === 'tball' && context.pitchedOnEarlierTournamentDay === true) {
      violations.push({
        rule: 'CT-02 — T-Bol: arremessos em um único dia do torneio',
        message: `${playerId} já arremessou em data anterior deste torneio; no T-Bol o atleta só arremessa em um único dia.`,
      });
    }
  }

  return { allowed: violations.length === 0, violations };
}
