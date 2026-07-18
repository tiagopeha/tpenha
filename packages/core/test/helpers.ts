import type {
  AdvanceTarget,
  Base,
  BattingLine,
  BoxScore,
  GameCreatedPayload,
  GameEvent,
  Half,
  LineupEntry,
  PAResult,
  PitchingLine,
  RunnerOutPayload,
} from '../src';

type EventOpts = { supersedes?: string };

/**
 * Constrói logs de eventos para os testes na ordem em que a UI grava:
 * `plateAppearanceRecorded` primeiro, confirmação dos corredores em seguida.
 * ids/seq/ts são gerados sequencialmente (um único escritor por jogo no v1).
 */
export class GameLogBuilder {
  readonly events: GameEvent[] = [];
  private seq = 0;

  private add(partial: { type: GameEvent['type']; payload: unknown }, opts?: EventOpts): GameEvent {
    this.seq += 1;
    const event = {
      id: `evt-${String(this.seq).padStart(3, '0')}`,
      gameId: 'game-1',
      seq: this.seq,
      ts: new Date(Date.UTC(2026, 2, 14, 14, 0, this.seq)).toISOString(),
      deviceId: 'device-1',
      ...partial,
      ...(opts?.supersedes !== undefined ? { supersedes: opts.supersedes } : {}),
    } as GameEvent;
    this.events.push(event);
    return event;
  }

  gameCreated(overrides: Partial<GameCreatedPayload> = {}): GameEvent {
    return this.add({
      type: 'gameCreated',
      payload: {
        sport: 'baseball',
        category: 'sub-13',
        rulesProfileId: 'rules-baseball-sub13',
        scheduledInnings: 7,
        opponentName: 'Guerreiros de Ibiúna',
        home: true,
        ...overrides,
      },
    });
  }

  lineup(entries: LineupEntry[]): GameEvent {
    return this.add({ type: 'lineupSet', payload: { entries } });
  }

  sub(outPlayerId: string, inPlayerId: string, battingSlot: number, position: string): GameEvent {
    return this.add({
      type: 'substitutionMade',
      payload: { outPlayerId, inPlayerId, battingSlot, position },
    });
  }

  halfInning(inning: number, half: Half): GameEvent {
    return this.add({ type: 'halfInningStarted', payload: { inning, half } });
  }

  pa(batterId: string, result: PAResult, opts?: EventOpts): GameEvent {
    return this.add({ type: 'plateAppearanceRecorded', payload: { batterId, result } }, opts);
  }

  advance(runnerId: string, from: Base, to: AdvanceTarget, opts?: EventOpts): GameEvent {
    return this.add({ type: 'runnerAdvanced', payload: { runnerId, from, to } }, opts);
  }

  out(runnerId: string, base: Base | 'home', reason?: RunnerOutPayload['reason']): GameEvent {
    return this.add({
      type: 'runnerOut',
      payload: { runnerId, base, ...(reason !== undefined ? { reason } : {}) },
    });
  }

  steal(runnerId: string, to: AdvanceTarget): GameEvent {
    return this.add({ type: 'stolenBase', payload: { runnerId, to } });
  }

  end(reason: 'regulation' | 'mercyRule' | 'walkOff' | 'forfeit' | 'other'): GameEvent {
    return this.add({ type: 'gameEnded', payload: { reason } });
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
