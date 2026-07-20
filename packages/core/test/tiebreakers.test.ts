import { describe, expect, it } from 'vitest';
import { deriveLOB, deriveTQB } from '../src';
import { GameLogBuilder } from './helpers';

// Desempates oficiais — docs/regras-cbbs.md §5.

describe('deriveTQB — entradas fracionárias (out = ⅓)', () => {
  it('TQB = (feitos ÷ atacadas) − (sofridos ÷ defendidas)', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true }); // mandante: defende na alta, ataca na baixa

    g.halfInning(1, 'top'); // defendemos: 3 outs
    g.pa('opp-1', 'strikeoutSwinging');
    g.pa('opp-2', 'strikeoutLooking');
    g.pa('opp-3', 'outInPlay');

    g.halfInning(1, 'bottom'); // atacamos: 1 corrida, 3 outs
    g.pa('camisa-1', 'homeRun');
    g.pa('camisa-2', 'outInPlay');
    g.pa('camisa-3', 'outInPlay');
    g.pa('camisa-4', 'outInPlay');

    g.halfInning(2, 'top'); // defendemos: 1 corrida sofrida, 2 outs (parcial)
    g.pa('opp-4', 'triple');
    g.pa('opp-5', 'outInPlay');
    g.advance('opp-4', 3, 'home', 'batterAction');
    g.pa('opp-6', 'strikeoutSwinging');

    const tqb = deriveTQB(g.events);
    expect(tqb.runsScored).toBe(1);
    expect(tqb.runsAllowed).toBe(1);
    expect(tqb.offensiveOuts).toBe(3);
    expect(tqb.defensiveOuts).toBe(5); // 2 outs na 2ª = 1,667 entradas defendidas
    expect(tqb.inningsAttacked).toBe(1);
    expect(tqb.inningsDefended).toBeCloseTo(5 / 3, 10);
    expect(tqb.tqb).toBeCloseTo(1 / 1 - 1 / (5 / 3), 10); // 1 − 0,6 = 0,4
  });

  it('sem outs registrados não há TQB (null, nunca NaN)', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    expect(deriveTQB(g.events).tqb).toBeNull();
  });
});

describe('deriveLOB — deixados em base no fim da meia-entrada', () => {
  it('snapshot no halfInningEnded conta os corredores que ficaram', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });

    g.halfInning(1, 'top'); // visitante deixa 1
    g.pa('opp-1', 'double');
    g.pa('opp-2', 'strikeoutSwinging');
    g.pa('opp-3', 'strikeoutLooking');
    g.pa('opp-4', 'outInPlay');
    g.halfEnd('threeOuts');

    g.halfInning(1, 'bottom'); // mandante deixa 2
    g.pa('camisa-1', 'single');
    g.pa('camisa-2', 'single');
    g.advance('camisa-1', 1, 2, 'batterAction');
    g.pa('camisa-3', 'strikeoutSwinging');
    g.pa('camisa-4', 'strikeoutSwinging');
    g.pa('camisa-5', 'outInPlay');
    g.halfEnd('threeOuts');

    const lob = deriveLOB(g.events);
    expect(lob.perHalfInning).toHaveLength(2);
    expect(lob.perHalfInning[0]).toEqual({ inning: 1, half: 'top', runners: ['opp-1'] });
    expect([...lob.perHalfInning[1]!.runners].sort()).toEqual(['camisa-1', 'camisa-2']);
    expect(lob.totals).toEqual({ home: 2, away: 1 });
  });

  it('corredor de cortesia deixado em base conta como o titular', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.halfInning(1, 'bottom');
    g.pa('camisa-2', 'double'); // receptor embasa
    g.courtesyRunner('camisa-2', 'camisa-15', 2);
    g.pa('camisa-3', 'strikeoutSwinging');
    g.pa('camisa-4', 'strikeoutSwinging');
    g.pa('camisa-5', 'outInPlay');
    g.halfEnd('threeOuts');

    const lob = deriveLOB(g.events);
    expect(lob.perHalfInning[0]!.runners).toEqual(['camisa-2']); // titular, não o CC
    expect(lob.totals.home).toBe(1);
  });

  it('meia-entrada encerrada por teto de corridas também gera snapshot', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.halfInning(1, 'bottom');
    g.pa('camisa-1', 'single');
    g.halfEnd('runCap');

    const lob = deriveLOB(g.events);
    expect(lob.perHalfInning[0]!.runners).toEqual(['camisa-1']);
  });
});
