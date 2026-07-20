import type {
  AdvanceTarget,
  Base,
  BattingLine,
  BattingSlot,
  BoxScore,
  DefenseAttribution,
  DefenseMap,
  GameCreatedPayload,
  GameEndReason,
  GameEvent,
  Half,
  PAResult,
  PitchThrownPayload,
  PitcherDayLedger,
  PitchingLine,
  RulesProfile,
  RunnerAdvanceReason,
  RunnerOutPayload,
} from '../src';
import { ledgerEntryFor } from '../src';

/** Perfil de regras de teste — valores fictícios; os reais vêm de RulesProfile versionado. */
export function testProfile(overrides: Partial<RulesProfile> = {}): RulesProfile {
  return {
    id: 'rules-infantil-teste',
    name: 'CBBS Infantil — perfil de teste',
    sport: 'baseball',
    category: 'infantil',
    scheduledInnings: 6,
    mercy: [],
    pitching: { style: 'kidPitch', dailyPitchLimit: 60, warnAt: 55 },
    running: { leadOffAllowed: true, stealHomeAllowed: true },
    battingOrder: { mode: 'traditional9', maxSlots: 9 },
    ...overrides,
  };
}

type EventOpts = { supersedes?: string; gameId?: string; ts?: string };

/**
 * Constrói logs de eventos para os testes na ordem em que a UI grava:
 * `plateAppearanceRecorded` primeiro, confirmação dos corredores em seguida.
 * ids/seq/ts são gerados sequencialmente (um único escritor por jogo no v1).
 */
export class GameLogBuilder {
  readonly events: GameEvent[] = [];
  private seq = 0;

  constructor(
    private readonly gameId = 'game-1',
    private readonly startMinute = 0,
  ) {}

  private add(partial: { type: GameEvent['type']; payload: unknown }, opts?: EventOpts): GameEvent {
    this.seq += 1;
    const event = {
      id: `${opts?.gameId ?? this.gameId}-evt-${String(this.seq).padStart(3, '0')}`,
      gameId: opts?.gameId ?? this.gameId,
      seq: this.seq,
      ts: opts?.ts ?? new Date(Date.UTC(2026, 2, 14, 14, this.startMinute, this.seq)).toISOString(),
      deviceId: 'device-1',
      ...partial,
      ...(opts?.supersedes !== undefined ? { supersedes: opts.supersedes } : {}),
    } as GameEvent;
    this.events.push(event);
    return event;
  }

  gameCreated(overrides: Partial<GameCreatedPayload> = {}, opts?: EventOpts): GameEvent {
    return this.add(
      {
        type: 'gameCreated',
        payload: {
          sport: 'baseball',
          category: 'infantil',
          rulesProfileId: 'rules-infantil-teste',
          mode: 'quick',
          opponentName: 'Guerreiros de Ibiúna',
          home: true,
          ...overrides,
        },
      },
      opts,
    );
  }

  clockStart(opts?: EventOpts): GameEvent {
    return this.add({ type: 'clockStarted', payload: {} }, opts);
  }

  lineup(defense: DefenseMap, battingSlots?: BattingSlot[], opts?: EventOpts): GameEvent {
    return this.add(
      {
        type: 'lineupSet',
        payload: {
          battingSlots: battingSlots ?? [{ slot: 1, playerId: 'camisa-1' }],
          defense,
        },
      },
      opts,
    );
  }

  defChange(assignments: DefenseMap, opts?: EventOpts): GameEvent {
    return this.add({ type: 'defensiveChange', payload: { assignments } }, opts);
  }

  offSub(slot: number, outPlayerId: string, inPlayerId: string, opts?: EventOpts): GameEvent {
    return this.add({ type: 'offensiveSubstitution', payload: { slot, outPlayerId, inPlayerId } }, opts);
  }

  courtesyRunner(forPlayerId: string, runnerId: string, base: Base, opts?: EventOpts): GameEvent {
    return this.add({ type: 'courtesyRunnerIn', payload: { forPlayerId, runnerId, base } }, opts);
  }

  halfInning(inning: number, half: Half, opts?: EventOpts): GameEvent {
    return this.add({ type: 'halfInningStarted', payload: { inning, half } }, opts);
  }

  halfEnd(reason: 'threeOuts' | 'runCap' | 'timeHard' | 'walkOff' = 'threeOuts', opts?: EventOpts): GameEvent {
    return this.add({ type: 'halfInningEnded', payload: { reason } }, opts);
  }

  pitch(pitcherId: string, call: PitchThrownPayload['call'], opts?: EventOpts): GameEvent {
    return this.add({ type: 'pitchThrown', payload: { pitcherId, call } }, opts);
  }

  pa(
    batterId: string,
    result: PAResult,
    opts?: EventOpts & { defense?: DefenseAttribution },
  ): GameEvent {
    return this.add(
      {
        type: 'plateAppearanceRecorded',
        payload: {
          batterId,
          result,
          ...(opts?.defense !== undefined ? { defense: opts.defense } : {}),
        },
      },
      opts,
    );
  }

  advance(
    runnerId: string,
    from: Base,
    to: AdvanceTarget,
    reason?: RunnerAdvanceReason,
    opts?: EventOpts,
  ): GameEvent {
    return this.add(
      {
        type: 'runnerAdvanced',
        payload: { runnerId, from, to, ...(reason !== undefined ? { reason } : {}) },
      },
      opts,
    );
  }

  out(
    runnerId: string,
    base: Base | 'home',
    reason?: RunnerOutPayload['reason'],
    opts?: EventOpts,
  ): GameEvent {
    return this.add(
      { type: 'runnerOut', payload: { runnerId, base, ...(reason !== undefined ? { reason } : {}) } },
      opts,
    );
  }

  end(reason: GameEndReason, opts?: EventOpts): GameEvent {
    return this.add({ type: 'gameEnded', payload: { reason } }, opts);
  }
}

export function battingLineOf(box: BoxScore, playerId: string): BattingLine {
  const line = box.batting.find((l) => l.playerId === playerId);
  if (line === undefined) throw new Error(`no batting line for ${playerId}`);
  return line;
}

export function pitchingLineOf(box: BoxScore, playerId: string): PitchingLine {
  const line = box.pitching.find((l) => l.playerId === playerId);
  if (line === undefined) throw new Error(`no pitching line for ${playerId}`);
  return line;
}

export function ledgerOf(ledger: PitcherDayLedger, playerId: string) {
  const entry = ledgerEntryFor(ledger, playerId);
  if (entry === undefined) throw new Error(`no ledger entry for ${playerId}`);
  return entry;
}
