import type { GameEvent, Half } from './events';
import { CATCHER_POSITION, PITCHER_POSITION, effectiveEvents } from './events';
import type { RulesProfile } from './rulesProfile';

export type BattingLine = {
  playerId: string;
  pa: number;
  ab: number;
  h: number;
  singles: number;
  doubles: number;
  triples: number;
  homeRuns: number;
  bb: number;
  hbp: number;
  k: number;
  sacBunts: number;
  sacFlies: number;
  r: number;
  rbi: number;
  tb: number;
  /** null quando o denominador é zero — a UI exibe "—", nunca NaN. */
  ba: number | null;
  obp: number | null;
  slg: number | null;
  ops: number | null;
};

export type PitchingLine = {
  playerId: string;
  outsRecorded: number;
  /** Notação de súmula: "5.1" = 5⅓ entradas. */
  ip: string;
  h: number;
  r: number;
  bb: number;
  k: number;
  /** Arremessos deste jogo (o razão diário fica em derivePitcherDayLedger). */
  pitches: number;
  /** null quando IP = 0 — a UI exibe "—", nunca NaN. */
  whip: number | null;
  ra9: number | null;
};

export type BoxScore = {
  batting: BattingLine[];
  pitching: PitchingLine[];
};

/** Formata uma taxa (BA/OBP/SLG/OPS/WHIP/RA9) para exibição; null vira "—". */
export function formatRate(value: number | null, digits = 3): string {
  return value === null ? '—' : value.toFixed(digits);
}

type BattingTally = {
  pa: number;
  singles: number;
  doubles: number;
  triples: number;
  homeRuns: number;
  bb: number;
  hbp: number;
  k: number;
  sacBunts: number;
  sacFlies: number;
  r: number;
  rbi: number;
};

type PitchingTally = {
  outsRecorded: number;
  h: number;
  r: number;
  bb: number;
  k: number;
  pitches: number;
};

const PA_OUT_RESULTS = new Set([
  'strikeoutSwinging',
  'strikeoutLooking',
  'outInPlay',
  'sacBunt',
  'sacFly',
]);

/**
 * Deriva as linhas de rebatedores e arremessadores a partir do log de eventos.
 * Função pura; a UI nunca calcula estatística por conta própria.
 *
 * Fórmulas (docs/modelo-de-eventos.md):
 * - PA = toda plateAppearanceRecorded não substituída
 * - AB = PA − (BB + HBP + SAC + SF)
 * - H = 1B + 2B + 3B + HR · TB = 1B + 2·2B + 3·3B + 4·HR
 * - BA = H/AB · OBP = (H+BB+HBP)/(AB+BB+HBP+SF) · SLG = TB/AB · OPS = OBP+SLG
 * - R = corredor com `to: 'home'` não substituído (+ a corrida do próprio
 *   rebatedor no homeRun)
 * - RBI (simplificado v1) = corridas na PA do rebatedor cujo avanço é ação do
 *   rebatedor (`reason` ausente ou 'batterAction'), exceto PA de
 *   `reachedOnError`; roubo de casa, WP/PB, balk e erro não geram RBI
 * - IP = outs/3 (notação 5.1 = 5⅓) · WHIP = (BB+H)/IP · RA9 = 9·R/IP
 *
 * Atribuição de arremessador: posição '1' do mapa defensivo (lineupSet /
 * defensiveChange) responde pelas meias-entradas em que defendemos — alta se
 * mandantes, baixa se visitantes. Corridas são debitadas de quem está no
 * montinho quando a corrida cruza o home (corredores herdados: fase 2, com ERA).
 *
 * Corredor de cortesia: a corrida credita ao TITULAR (o CC é alias, não
 * substituição) — pendente de validação com o árbitro (regras-cbbs.md §6.3).
 *
 * `profile` é opcional e só afeta as regras de corrida aplicadas pelo motor
 * (roubo de home proibido ⇒ tentativa vira out, coerente com deriveGameState).
 */
export function deriveBoxScore(events: readonly GameEvent[], profile?: RulesProfile): BoxScore {
  const batting = new Map<string, BattingTally>();
  const pitching = new Map<string, PitchingTally>();

  const battingLine = (playerId: string): BattingTally => {
    let line = batting.get(playerId);
    if (line === undefined) {
      line = {
        pa: 0,
        singles: 0,
        doubles: 0,
        triples: 0,
        homeRuns: 0,
        bb: 0,
        hbp: 0,
        k: 0,
        sacBunts: 0,
        sacFlies: 0,
        r: 0,
        rbi: 0,
      };
      batting.set(playerId, line);
    }
    return line;
  };

  const pitchingLine = (playerId: string): PitchingTally => {
    let line = pitching.get(playerId);
    if (line === undefined) {
      line = { outsRecorded: 0, h: 0, r: 0, bb: 0, k: 0, pitches: 0 };
      pitching.set(playerId, line);
    }
    return line;
  };

  let teamIsHome: boolean | null = null;
  let half: Half | null = null;
  let currentPitcherId: string | null = null;
  // PA em andamento: corridas por ação do rebatedor na mesma jogada creditam RBI.
  let currentPA: { batterId: string; result: string } | null = null;
  // Corredor de cortesia: aliasRunnerId → titularId (crédito ao titular).
  const courtesyAliases = new Map<string, string>();

  const onDefense = (): boolean =>
    teamIsHome !== null && half !== null && (teamIsHome ? half === 'top' : half === 'bottom');

  const defensivePitcher = (): PitchingTally | null =>
    onDefense() && currentPitcherId !== null ? pitchingLine(currentPitcherId) : null;

  const runScored = (runnerId: string): void => {
    const officialRunnerId = courtesyAliases.get(runnerId) ?? runnerId;
    courtesyAliases.delete(runnerId);
    battingLine(officialRunnerId).r += 1;
    const pitcher = defensivePitcher();
    if (pitcher !== null) pitcher.r += 1;
  };

  for (const event of effectiveEvents(events)) {
    switch (event.type) {
      case 'gameCreated': {
        teamIsHome = event.payload.home;
        break;
      }

      case 'lineupSet': {
        currentPitcherId = event.payload.defense[PITCHER_POSITION] ?? currentPitcherId;
        break;
      }

      case 'defensiveChange': {
        const newPitcher = event.payload.assignments[PITCHER_POSITION];
        if (newPitcher !== undefined) currentPitcherId = newPitcher;
        break;
      }

      case 'offensiveSubstitution': {
        // Substituição permanente: se o atleta que sai é o arremessador, o
        // montinho fica vago até um defensiveChange.
        if (event.payload.outPlayerId === currentPitcherId) currentPitcherId = null;
        break;
      }

      case 'courtesyRunnerIn': {
        courtesyAliases.set(event.payload.runnerId, event.payload.forPlayerId);
        break;
      }

      case 'halfInningStarted':
      case 'halfInningEnded': {
        if (event.type === 'halfInningStarted') half = event.payload.half;
        currentPA = null;
        courtesyAliases.clear(); // alias de CC se dissolve na virada da meia-entrada
        break;
      }

      case 'pitchThrown': {
        pitchingLine(event.payload.pitcherId).pitches += 1;
        break;
      }

      case 'plateAppearanceRecorded': {
        const { batterId, result } = event.payload;
        currentPA = { batterId, result };
        const line = battingLine(batterId);
        line.pa += 1;
        switch (result) {
          case 'single':
            line.singles += 1;
            break;
          case 'double':
            line.doubles += 1;
            break;
          case 'triple':
            line.triples += 1;
            break;
          case 'homeRun':
            line.homeRuns += 1;
            break;
          case 'walk':
            line.bb += 1;
            break;
          case 'hitByPitch':
            line.hbp += 1;
            break;
          case 'strikeoutSwinging':
          case 'strikeoutLooking':
            line.k += 1;
            break;
          case 'sacBunt':
            line.sacBunts += 1;
            break;
          case 'sacFly':
            line.sacFlies += 1;
            break;
          case 'outInPlay':
          case 'fieldersChoice':
          case 'reachedOnError':
            break;
        }

        if (result === 'homeRun') {
          // A corrida e o RBI do próprio rebatedor são automáticos no HR.
          runScored(batterId);
          line.rbi += 1;
        }

        const pitcher = defensivePitcher();
        if (pitcher !== null) {
          if (PA_OUT_RESULTS.has(result)) pitcher.outsRecorded += 1;
          if (result === 'strikeoutSwinging' || result === 'strikeoutLooking') pitcher.k += 1;
          if (result === 'single' || result === 'double' || result === 'triple' || result === 'homeRun') {
            pitcher.h += 1;
          }
          if (result === 'walk') pitcher.bb += 1;
        }
        break;
      }

      case 'runnerAdvanced': {
        const { runnerId, to, reason } = event.payload;
        if (to !== 'home') break;

        // Roubo de home proibido pelo perfil: tentativa = out declarado.
        if (reason === 'stolenBase' && profile !== undefined && !profile.running.stealHomeAllowed) {
          courtesyAliases.delete(runnerId);
          const pitcher = defensivePitcher();
          if (pitcher !== null) pitcher.outsRecorded += 1;
          break;
        }

        runScored(runnerId);
        const rbiEligible = reason === undefined || reason === 'batterAction';
        if (rbiEligible && currentPA !== null && currentPA.result !== 'reachedOnError') {
          battingLine(currentPA.batterId).rbi += 1;
        }
        break;
      }

      case 'runnerOut': {
        courtesyAliases.delete(event.payload.runnerId);
        const pitcher = defensivePitcher();
        if (pitcher !== null) pitcher.outsRecorded += 1;
        break;
      }

      case 'gameEnded': {
        currentPA = null;
        break;
      }

      case 'clockStarted':
        break;
    }
  }

  const battingLines: BattingLine[] = [...batting.entries()].map(([playerId, t]) => {
    const h = t.singles + t.doubles + t.triples + t.homeRuns;
    const ab = t.pa - (t.bb + t.hbp + t.sacBunts + t.sacFlies);
    const tb = t.singles + 2 * t.doubles + 3 * t.triples + 4 * t.homeRuns;
    const obpDenominator = ab + t.bb + t.hbp + t.sacFlies;
    const ba = ab > 0 ? h / ab : null;
    const obp = obpDenominator > 0 ? (h + t.bb + t.hbp) / obpDenominator : null;
    const slg = ab > 0 ? tb / ab : null;
    const ops = obp !== null && slg !== null ? obp + slg : null;
    return {
      playerId,
      pa: t.pa,
      ab,
      h,
      singles: t.singles,
      doubles: t.doubles,
      triples: t.triples,
      homeRuns: t.homeRuns,
      bb: t.bb,
      hbp: t.hbp,
      k: t.k,
      sacBunts: t.sacBunts,
      sacFlies: t.sacFlies,
      r: t.r,
      rbi: t.rbi,
      tb,
      ba,
      obp,
      slg,
      ops,
    };
  });

  const pitchingLines: PitchingLine[] = [...pitching.entries()].map(([playerId, t]) => {
    const innings = t.outsRecorded / 3;
    return {
      playerId,
      outsRecorded: t.outsRecorded,
      ip: `${Math.floor(t.outsRecorded / 3)}.${t.outsRecorded % 3}`,
      h: t.h,
      r: t.r,
      bb: t.bb,
      k: t.k,
      pitches: t.pitches,
      whip: t.outsRecorded > 0 ? (t.bb + t.h) / innings : null,
      ra9: t.outsRecorded > 0 ? (9 * t.r) / innings : null,
    };
  });

  return { batting: battingLines, pitching: pitchingLines };
}
