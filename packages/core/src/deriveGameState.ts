import type { Base, GameEvent, Half } from './events';
import { effectiveEvents } from './events';

export type GameStatus = 'scheduled' | 'inProgress' | 'ended';
export type EndReason = 'regulation' | 'mercyRule' | 'walkOff' | 'forfeit' | 'other';

export type Bases = {
  first: string | null;
  second: string | null;
  third: string | null;
};

export type GameState = {
  status: GameStatus;
  sport: 'baseball' | 'softball' | null;
  category: string | null;
  scheduledInnings: number | null;
  opponentName: string | null;
  /** O time do anotador é o mandante? (payload `home` do gameCreated) */
  teamIsHome: boolean | null;
  inning: number | null;
  half: Half | null;
  outs: number;
  bases: Bases;
  score: { home: number; away: number };
  endReason: EndReason | null;
};

/** O log descreve um estado de jogo impossível (ex.: dois corredores na mesma base). */
export class InconsistentGameLogError extends Error {
  constructor(message: string, readonly eventId?: string) {
    super(eventId === undefined ? message : `${message} (event ${eventId})`);
    this.name = 'InconsistentGameLogError';
  }
}

const BASE_KEYS: Record<Base, keyof Bases> = { 1: 'first', 2: 'second', 3: 'third' };

const PA_OUT_RESULTS = new Set([
  'strikeoutSwinging',
  'strikeoutLooking',
  'outInPlay',
  'sacBunt',
  'sacFly',
]);

const PA_REACH_BASE: Partial<Record<string, Base>> = {
  single: 1,
  double: 2,
  triple: 3,
  walk: 1,
  hitByPitch: 1,
  fieldersChoice: 1,
  reachedOnError: 1,
};

/**
 * Deriva placar, entrada, outs e corredores a partir do log de eventos.
 * Função pura: alimenta a tela de marcação e a página pública do jogo.
 *
 * Convenções:
 * - alta (`top`) = visitante rebate; baixa (`bottom`) = mandante rebate;
 * - a UI grava o `plateAppearanceRecorded` ANTES de confirmar os corredores,
 *   então a ocupação da base do rebatedor fica pendente até os movimentos dos
 *   corredores serem aplicados; a consistência é validada no assentamento;
 * - no `homeRun`, a corrida do próprio rebatedor é automática; corredores em
 *   base marcam via `runnerAdvanced` explícito, como em qualquer jogada.
 */
export function deriveGameState(events: readonly GameEvent[]): GameState {
  const state: GameState = {
    status: 'scheduled',
    sport: null,
    category: null,
    scheduledInnings: null,
    opponentName: null,
    teamIsHome: null,
    inning: null,
    half: null,
    outs: 0,
    bases: { first: null, second: null, third: null },
    score: { home: 0, away: 0 },
    endReason: null,
  };

  // Rebatedor que embasou mas ainda não teve a base confirmada no diamante.
  let pendingBatter: { runnerId: string; base: Base } | null = null;

  const battingSide = (): 'home' | 'away' => (state.half === 'bottom' ? 'home' : 'away');

  const scoreRun = (): void => {
    state.score[battingSide()] += 1;
  };

  const settlePendingBatter = (eventId?: string): void => {
    if (pendingBatter === null) return;
    const key = BASE_KEYS[pendingBatter.base];
    const occupant = state.bases[key];
    if (occupant !== null) {
      throw new InconsistentGameLogError(
        `two runners on base ${pendingBatter.base}: ${occupant} and ${pendingBatter.runnerId}`,
        eventId,
      );
    }
    state.bases[key] = pendingBatter.runnerId;
    pendingBatter = null;
  };

  const swapPendingRunner = (outPlayerId: string, inPlayerId: string): boolean => {
    if (pendingBatter !== null && pendingBatter.runnerId === outPlayerId) {
      pendingBatter = { runnerId: inPlayerId, base: pendingBatter.base };
      return true;
    }
    return false;
  };

  const findRunnerBase = (runnerId: string): Base | null => {
    for (const base of [1, 2, 3] as const) {
      if (state.bases[BASE_KEYS[base]] === runnerId) return base;
    }
    return null;
  };

  const removeRunner = (runnerId: string, eventId: string): void => {
    if (pendingBatter !== null && pendingBatter.runnerId === runnerId) {
      pendingBatter = null;
      return;
    }
    const base = findRunnerBase(runnerId);
    if (base === null) {
      throw new InconsistentGameLogError(`runner ${runnerId} is not on base`, eventId);
    }
    state.bases[BASE_KEYS[base]] = null;
  };

  const moveRunner = (runnerId: string, from: Base, to: 2 | 3 | 'home', eventId: string): void => {
    if (pendingBatter !== null && pendingBatter.runnerId === runnerId) {
      // Rebatedor-corredor avançando na mesma jogada (ex.: erro no arremesso).
      if (pendingBatter.base !== from) {
        throw new InconsistentGameLogError(
          `runner ${runnerId} advanced from base ${from} but reached base ${pendingBatter.base}`,
          eventId,
        );
      }
      if (to === 'home') {
        pendingBatter = null;
        scoreRun();
      } else {
        pendingBatter = { runnerId, base: to };
      }
      return;
    }

    const fromKey = BASE_KEYS[from];
    if (state.bases[fromKey] !== runnerId) {
      throw new InconsistentGameLogError(`runner ${runnerId} is not on base ${from}`, eventId);
    }
    state.bases[fromKey] = null;
    if (to === 'home') {
      scoreRun();
      return;
    }
    const toKey = BASE_KEYS[to];
    const occupant = state.bases[toKey];
    if (occupant !== null) {
      throw new InconsistentGameLogError(
        `two runners on base ${to}: ${occupant} and ${runnerId}`,
        eventId,
      );
    }
    state.bases[toKey] = runnerId;
  };

  for (const event of effectiveEvents(events)) {
    switch (event.type) {
      case 'gameCreated': {
        state.sport = event.payload.sport;
        state.category = event.payload.category;
        state.scheduledInnings = event.payload.scheduledInnings;
        state.opponentName = event.payload.opponentName;
        state.teamIsHome = event.payload.home;
        break;
      }

      case 'lineupSet':
      case 'pitchThrown':
        break;

      case 'substitutionMade': {
        // Substituição de corredor em base (pinch runner) troca a ocupação.
        const { outPlayerId, inPlayerId } = event.payload;
        if (swapPendingRunner(outPlayerId, inPlayerId)) break;
        const base = findRunnerBase(outPlayerId);
        if (base !== null) {
          state.bases[BASE_KEYS[base]] = inPlayerId;
        }
        break;
      }

      case 'halfInningStarted': {
        settlePendingBatter(event.id);
        state.status = 'inProgress';
        state.inning = event.payload.inning;
        state.half = event.payload.half;
        state.outs = 0;
        state.bases = { first: null, second: null, third: null };
        break;
      }

      case 'plateAppearanceRecorded': {
        settlePendingBatter(event.id);
        state.status = 'inProgress';
        const { batterId, result } = event.payload;
        if (PA_OUT_RESULTS.has(result)) {
          state.outs += 1;
          break;
        }
        if (result === 'homeRun') {
          scoreRun();
          break;
        }
        const base = PA_REACH_BASE[result];
        if (base !== undefined) {
          pendingBatter = { runnerId: batterId, base };
        }
        break;
      }

      case 'runnerAdvanced': {
        moveRunner(event.payload.runnerId, event.payload.from, event.payload.to, event.id);
        break;
      }

      case 'stolenBase': {
        const { runnerId, to } = event.payload;
        const from =
          pendingBatter !== null && pendingBatter.runnerId === runnerId
            ? pendingBatter.base
            : findRunnerBase(runnerId);
        if (from === null) {
          throw new InconsistentGameLogError(`runner ${runnerId} is not on base`, event.id);
        }
        moveRunner(runnerId, from, to, event.id);
        break;
      }

      case 'runnerOut': {
        removeRunner(event.payload.runnerId, event.id);
        state.outs += 1;
        break;
      }

      case 'gameEnded': {
        settlePendingBatter(event.id);
        state.status = 'ended';
        state.endReason = event.payload.reason;
        break;
      }
    }
  }

  settlePendingBatter();
  return state;
}
