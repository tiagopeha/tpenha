import { BaseTracker } from './baseTracker';
import type { Bases } from './baseTracker';
import type { GameEndReason, GameEvent, Half } from './events';
import { effectiveEvents } from './events';
import type { MercyRule, RulesProfile } from './rulesProfile';

export type GameStatus = 'scheduled' | 'inProgress' | 'ended';

export type BatterCount = { balls: number; strikes: number };

/**
 * Intervenções obrigatórias que o app apresenta ao anotador — nunca depender
 * da memória de quem anota (docs/regras-cbbs.md §2).
 */
export type GamePrompt =
  | { kind: 'mercy'; rule: MercyRule; scoreDiff: number; immediate: boolean }
  | { kind: 'runCap'; cap: number; runsThisHalf: number }
  | { kind: 'timeExpired'; stop: 'hard' | 'noNewInning' };

export type GameState = {
  status: GameStatus;
  mode: 'quick' | 'official' | null;
  sport: 'baseball' | 'softball' | null;
  opponentName: string | null;
  /** O time do anotador é o mandante? (payload `home` do gameCreated) */
  teamIsHome: boolean | null;
  competitionDayId: string | null;
  inning: number | null;
  half: Half | null;
  /** true entre halfInningEnded e o próximo halfInningStarted. */
  halfEnded: boolean;
  outs: number;
  bases: Bases;
  score: { home: number; away: number };
  /** Contagem do rebatedor atual (derivada de pitchThrown; zera a cada PA). */
  count: BatterCount;
  clock: {
    /** ts do clockStarted ("Play Ball"); null antes dele. */
    startedAt: string | null;
    limitMinutes: number | null;
    stop: 'hard' | 'noNewInning' | null;
    /** Preenchido só quando `opts.now` é fornecido e há timeLimit no perfil. */
    remainingSeconds: number | null;
  };
  prompts: GamePrompt[];
  endReason: GameEndReason | null;
};

export type DeriveGameStateOptions = {
  /** Instante atual (ISO 8601) para derivar relógio restante e prompt de tempo. */
  now?: string;
};

/**
 * Deriva placar, entrada, outs, corredores, contagem, relógio e prompts
 * obrigatórios a partir do log + RulesProfile. Função pura: alimenta a tela
 * de marcação e a página pública. O perfil nunca é hardcoded — nocaute, teto
 * de corridas, relógio e restrições de corrida vêm todos dele.
 *
 * Convenções: alta (`top`) = visitante rebate; baixa (`bottom`) = mandante.
 */
export function deriveGameState(
  events: readonly GameEvent[],
  profile: RulesProfile,
  opts: DeriveGameStateOptions = {},
): GameState {
  const tracker = new BaseTracker(profile.running);

  const state: GameState = {
    status: 'scheduled',
    mode: null,
    sport: null,
    opponentName: null,
    teamIsHome: null,
    competitionDayId: null,
    inning: null,
    half: null,
    halfEnded: false,
    outs: 0,
    bases: tracker.bases,
    score: { home: 0, away: 0 },
    count: { balls: 0, strikes: 0 },
    clock: {
      startedAt: null,
      limitMinutes: profile.timeLimit?.minutes ?? null,
      stop: profile.timeLimit?.stop ?? null,
      remainingSeconds: null,
    },
    prompts: [],
    endReason: null,
  };

  let runsThisHalf = 0;

  const battingSide = (): 'home' | 'away' => (state.half === 'bottom' ? 'home' : 'away');

  const scoreRun = (): void => {
    state.score[battingSide()] += 1;
    runsThisHalf += 1;
  };

  const resetCount = (): void => {
    state.count = { balls: 0, strikes: 0 };
  };

  for (const event of effectiveEvents(events)) {
    switch (event.type) {
      case 'gameCreated': {
        state.sport = event.payload.sport;
        state.mode = event.payload.mode;
        state.opponentName = event.payload.opponentName;
        state.teamIsHome = event.payload.home;
        state.competitionDayId = event.payload.competitionDayId ?? null;
        break;
      }

      case 'clockStarted': {
        state.clock.startedAt = event.ts;
        break;
      }

      case 'lineupSet':
      case 'defensiveChange':
        break;

      case 'offensiveSubstitution': {
        tracker.applyOffensiveSubstitution(event.payload.outPlayerId, event.payload.inPlayerId);
        break;
      }

      case 'courtesyRunnerIn': {
        tracker.applyCourtesyRunnerIn(event.payload, event.id);
        break;
      }

      case 'halfInningStarted': {
        tracker.startHalf(event.id);
        state.status = 'inProgress';
        state.inning = event.payload.inning;
        state.half = event.payload.half;
        state.halfEnded = false;
        runsThisHalf = 0;
        resetCount();
        break;
      }

      case 'halfInningEnded': {
        tracker.endHalf(event.id);
        state.halfEnded = true;
        resetCount();
        break;
      }

      case 'pitchThrown': {
        const { call } = event.payload;
        if (call === 'ball') state.count.balls += 1;
        else if (call === 'strikeSwinging' || call === 'strikeLooking') state.count.strikes += 1;
        else if (call === 'foul' && state.count.strikes < 2) state.count.strikes += 1;
        // inPlay / hitByPitch encerram o confronto; a PA zera a contagem.
        break;
      }

      case 'plateAppearanceRecorded': {
        state.status = 'inProgress';
        resetCount();
        const outcome = tracker.applyPlateAppearance(event.payload, event.id);
        if (outcome.run !== undefined) scoreRun();
        break;
      }

      case 'runnerAdvanced': {
        const outcome = tracker.applyRunnerAdvanced(event.payload, event.id);
        if (outcome.run !== undefined) scoreRun();
        break;
      }

      case 'runnerOut': {
        tracker.applyRunnerOut(event.payload, event.id);
        break;
      }

      case 'gameEnded': {
        tracker.settle(event.id);
        state.status = 'ended';
        state.endReason = event.payload.reason;
        break;
      }
    }
  }

  tracker.settle();
  state.bases = tracker.bases;
  state.outs = tracker.outs;

  // Relógio restante (quando o chamador informa `now`).
  if (state.clock.startedAt !== null && profile.timeLimit !== undefined && opts.now !== undefined) {
    const elapsedMs = Date.parse(opts.now) - Date.parse(state.clock.startedAt);
    state.clock.remainingSeconds = Math.ceil(profile.timeLimit.minutes * 60 - elapsedMs / 1000);
  }

  // Prompts obrigatórios — avaliados sobre o estado corrente, nunca em jogo encerrado.
  if (state.status === 'inProgress') {
    const scoreDiff = Math.abs(state.score.home - state.score.away);
    const inning = state.inning ?? 0;
    for (const rule of profile.mercy) {
      if (scoreDiff >= rule.runDiff && inning >= rule.fromInning) {
        state.prompts.push({ kind: 'mercy', rule, scoreDiff, immediate: rule.immediate });
      }
    }

    if (
      profile.runCapPerInning !== undefined &&
      !state.halfEnded &&
      runsThisHalf >= profile.runCapPerInning
    ) {
      state.prompts.push({ kind: 'runCap', cap: profile.runCapPerInning, runsThisHalf });
    }

    if (
      state.clock.remainingSeconds !== null &&
      state.clock.remainingSeconds <= 0 &&
      profile.timeLimit !== undefined
    ) {
      state.prompts.push({ kind: 'timeExpired', stop: profile.timeLimit.stop });
    }
  }

  return state;
}
