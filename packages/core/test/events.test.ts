import { describe, expect, it } from 'vitest';
import { effectiveEvents, parseGameEvent, parseRulesProfile } from '../src';
import { GameLogBuilder, testProfile } from './helpers';

describe('gameEventSchema', () => {
  const envelope = {
    id: '01J8ZC2V9T5X4Q6W8E0R1T2Y3U',
    gameId: 'game-1',
    seq: 1,
    ts: '2026-03-14T14:00:00.000Z',
    deviceId: 'device-1',
  };

  it('aceita uma PA com atribuição defensiva do modo oficial', () => {
    const event = parseGameEvent({
      ...envelope,
      type: 'plateAppearanceRecorded',
      payload: {
        batterId: 'camisa-7',
        result: 'outInPlay',
        battedBall: 'ground',
        defense: { putoutSequence: [6, 3] },
      },
    });
    expect(event.type).toBe('plateAppearanceRecorded');
  });

  it('aceita gameCreated com modo oficial, elenco avulso e dia de competição', () => {
    const event = parseGameEvent({
      ...envelope,
      type: 'gameCreated',
      payload: {
        sport: 'baseball',
        category: 'preInfantil',
        rulesProfileId: 'cbbs-pi-2026',
        mode: 'official',
        opponentName: 'Nikkei Curitiba',
        opponentRoster: [{ name: 'Sato', number: '7' }],
        home: false,
        competitionDayId: 'brasileiro-pi-2026-03-14',
      },
    });
    expect(event.type).toBe('gameCreated');
  });

  it('aceita corredor de cortesia e fim de meia-entrada', () => {
    expect(
      parseGameEvent({
        ...envelope,
        type: 'courtesyRunnerIn',
        payload: { forPlayerId: 'camisa-2', runnerId: 'camisa-15', base: 2 },
      }).type,
    ).toBe('courtesyRunnerIn');
    expect(
      parseGameEvent({
        ...envelope,
        type: 'halfInningEnded',
        payload: { reason: 'runCap' },
      }).type,
    ).toBe('halfInningEnded');
  });

  it('rejeita payload que não bate com o type', () => {
    expect(() =>
      parseGameEvent({
        ...envelope,
        type: 'plateAppearanceRecorded',
        payload: { batterId: 'camisa-7', result: 'bunt' },
      }),
    ).toThrow();
  });

  it('rejeita corredor "avançando" para trás', () => {
    expect(() =>
      parseGameEvent({
        ...envelope,
        type: 'runnerAdvanced',
        payload: { runnerId: 'camisa-1', from: 3, to: 2 },
      }),
    ).toThrow();
  });

  it('rejeita type desconhecido e ts fora do ISO 8601', () => {
    expect(() => parseGameEvent({ ...envelope, type: 'balk', payload: {} })).toThrow();
    expect(() =>
      parseGameEvent({
        ...envelope,
        ts: '14/03/2026 14:00',
        type: 'gameEnded',
        payload: { reason: 'regulation' },
      }),
    ).toThrow();
  });

  it('aceita os novos motivos de encerramento (mercy, timeLimit, suspended)', () => {
    for (const reason of ['mercy', 'timeLimit', 'suspended'] as const) {
      expect(
        parseGameEvent({ ...envelope, type: 'gameEnded', payload: { reason } }).type,
      ).toBe('gameEnded');
    }
  });
});

describe('rulesProfileSchema', () => {
  it('valida o perfil de teste e rejeita margem de reentrada fora da norma', () => {
    expect(() => parseRulesProfile(testProfile())).not.toThrow();
    expect(() =>
      parseRulesProfile(
        testProfile({
          pitching: { style: 'kidPitch', dailyPitchLimit: 60, warnAt: 55, reentryBanMargin: 7 as never },
        }),
      ),
    ).toThrow();
  });
});

describe('effectiveEvents — resolução de supersedes', () => {
  it('a correção substitui o evento original na posição original', () => {
    const g = new GameLogBuilder();
    g.gameCreated();
    g.halfInning(1, 'bottom');
    const wrong = g.pa('camisa-1', 'single');
    g.pa('camisa-2', 'outInPlay');
    const fix = g.pa('camisa-1', 'reachedOnError', { supersedes: wrong.id });

    const effective = effectiveEvents(g.events);
    expect(effective).toHaveLength(4);
    expect(effective[2]!.id).toBe(fix.id);
    expect(effective[3]!.type).toBe('plateAppearanceRecorded');
    expect(effective.some((e) => e.id === wrong.id)).toBe(false);
  });

  it('cadeia de correções resolve para o último evento da cadeia', () => {
    const g = new GameLogBuilder();
    g.gameCreated();
    g.halfInning(1, 'bottom');
    const first = g.pa('camisa-1', 'single');
    const second = g.pa('camisa-1', 'double', { supersedes: first.id });
    const third = g.pa('camisa-1', 'reachedOnError', { supersedes: second.id });

    const effective = effectiveEvents(g.events);
    expect(effective).toHaveLength(3);
    expect(effective[2]!.id).toBe(third.id);
  });

  it('ordena pelo seq mesmo com o array embaralhado', () => {
    const g = new GameLogBuilder();
    g.gameCreated();
    g.halfInning(1, 'bottom');
    g.pa('camisa-1', 'single');
    const shuffled = [...g.events].reverse();

    const effective = effectiveEvents(shuffled);
    expect(effective.map((e) => e.seq)).toEqual([1, 2, 3]);
  });

  it('supersedes apontando para id desconhecido mantém o evento no log', () => {
    const g = new GameLogBuilder();
    g.gameCreated();
    g.halfInning(1, 'bottom');
    g.pa('camisa-1', 'single', { supersedes: 'evt-inexistente' });

    const effective = effectiveEvents(g.events);
    expect(effective).toHaveLength(3);
    expect(effective[2]!.type).toBe('plateAppearanceRecorded');
  });
});
