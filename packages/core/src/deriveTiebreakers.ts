import { BaseTracker } from './baseTracker';
import type { GameEvent, Half } from './events';
import { effectiveEvents } from './events';

// Desempates oficiais de classificação em grupos (docs/regras-cbbs.md §5):
// vitórias → TQB → saldo de pontos → confronto direto.

const PA_OUT_RESULTS = new Set([
  'strikeoutSwinging',
  'strikeoutLooking',
  'outInPlay',
  'sacBunt',
  'sacFly',
]);

export type TQBResult = {
  runsScored: number;
  runsAllowed: number;
  /** Outs sofridos no ataque — cada out vale ⅓ de entrada. */
  offensiveOuts: number;
  /** Outs registrados na defesa. */
  defensiveOuts: number;
  inningsAttacked: number;
  inningsDefended: number;
  /** (feitos ÷ atacadas) − (sofridos ÷ defendidas); null se faltar denominador. */
  tqb: number | null;
};

/**
 * TQB do time do anotador num jogo, com entradas FRACIONÁRIAS
 * (2 outs na 5ª = 4,667 entradas atacadas). Requer `gameCreated` para saber
 * qual meia-entrada é ataque (alta = visitante).
 */
export function deriveTQB(events: readonly GameEvent[]): TQBResult {
  let teamIsHome: boolean | null = null;
  let half: Half | null = null;

  let runsScored = 0;
  let runsAllowed = 0;
  let offensiveOuts = 0;
  let defensiveOuts = 0;

  const onOffense = (): boolean =>
    teamIsHome !== null && half !== null && (teamIsHome ? half === 'bottom' : half === 'top');

  const addRun = (): void => {
    if (onOffense()) runsScored += 1;
    else runsAllowed += 1;
  };

  const addOut = (): void => {
    if (onOffense()) offensiveOuts += 1;
    else defensiveOuts += 1;
  };

  for (const event of effectiveEvents(events)) {
    switch (event.type) {
      case 'gameCreated':
        teamIsHome = event.payload.home;
        break;
      case 'halfInningStarted':
        half = event.payload.half;
        break;
      case 'plateAppearanceRecorded':
        if (PA_OUT_RESULTS.has(event.payload.result)) addOut();
        else if (event.payload.result === 'homeRun') addRun();
        break;
      case 'runnerAdvanced':
        if (event.payload.to === 'home') addRun();
        break;
      case 'runnerOut':
        addOut();
        break;
      default:
        break;
    }
  }

  const inningsAttacked = offensiveOuts / 3;
  const inningsDefended = defensiveOuts / 3;
  const tqb =
    inningsAttacked > 0 && inningsDefended > 0
      ? runsScored / inningsAttacked - runsAllowed / inningsDefended
      : null;

  return {
    runsScored,
    runsAllowed,
    offensiveOuts,
    defensiveOuts,
    inningsAttacked,
    inningsDefended,
    tqb,
  };
}

export type LOBSnapshot = {
  inning: number;
  half: Half;
  /** Corredores deixados em base no fim da meia-entrada (aliases de CC resolvidos). */
  runners: string[];
};

export type LOBResult = {
  perHalfInning: LOBSnapshot[];
  /** Total por lado que atacava (alta = visitante, baixa = mandante). */
  totals: { home: number; away: number };
};

/**
 * Deixados em base: snapshot dos corredores no momento exato do fim de cada
 * meia-entrada (`halfInningEnded` — 3º out, teto de corridas ou tempo).
 * O rastreio posicional já dá isso direto do log.
 */
export function deriveLOB(events: readonly GameEvent[]): LOBResult {
  const tracker = new BaseTracker();
  let inning: number | null = null;
  let half: Half | null = null;

  const perHalfInning: LOBSnapshot[] = [];
  const totals = { home: 0, away: 0 };

  for (const event of effectiveEvents(events)) {
    switch (event.type) {
      case 'halfInningStarted':
        tracker.startHalf(event.id);
        inning = event.payload.inning;
        half = event.payload.half;
        break;
      case 'halfInningEnded': {
        const stranded = tracker.endHalf(event.id);
        if (inning !== null && half !== null) {
          perHalfInning.push({ inning, half, runners: stranded });
          totals[half === 'bottom' ? 'home' : 'away'] += stranded.length;
        }
        break;
      }
      case 'plateAppearanceRecorded':
        tracker.applyPlateAppearance(event.payload, event.id);
        break;
      case 'runnerAdvanced':
        tracker.applyRunnerAdvanced(event.payload, event.id);
        break;
      case 'runnerOut':
        tracker.applyRunnerOut(event.payload, event.id);
        break;
      case 'courtesyRunnerIn':
        tracker.applyCourtesyRunnerIn(event.payload, event.id);
        break;
      case 'offensiveSubstitution':
        tracker.applyOffensiveSubstitution(event.payload.outPlayerId, event.payload.inPlayerId);
        break;
      default:
        break;
    }
  }

  return { perHalfInning, totals };
}
