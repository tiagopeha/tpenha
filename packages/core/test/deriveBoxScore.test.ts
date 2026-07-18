import { describe, expect, it } from 'vitest';
import { deriveBoxScore, formatRate } from '../src';
import { GameLogBuilder, battingLineOf, pitchingLineOf } from './helpers';

describe('deriveBoxScore — fórmulas de rebatedor', () => {
  it('AB = PA − (BB + HBP + SAC + SF); OBP tira o SAC do denominador e mantém o SF', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.halfInning(1, 'bottom');
    g.pa('camisa-1', 'single');
    g.halfInning(2, 'bottom');
    g.pa('camisa-1', 'walk');
    g.halfInning(3, 'bottom');
    g.pa('camisa-1', 'sacBunt');
    g.halfInning(4, 'bottom');
    g.pa('camisa-1', 'sacFly');
    g.halfInning(5, 'bottom');
    g.pa('camisa-1', 'hitByPitch');

    const line = battingLineOf(deriveBoxScore(g.events), 'camisa-1');
    expect(line.pa).toBe(5);
    expect(line.ab).toBe(1); // 5 − (1 BB + 1 HBP + 1 SAC + 1 SF)
    expect(line.h).toBe(1);
    expect(line.ba).toBe(1);
    // OBP = (H + BB + HBP) / (AB + BB + HBP + SF) = 3/4 — sacBunt fora
    expect(line.obp).toBe(3 / 4);
    expect(line.slg).toBe(1);
    expect(line.ops).toBe(3 / 4 + 1);
  });

  it('TB = 1B + 2·2B + 3·3B + 4·HR; SLG = TB/AB; OPS = OBP + SLG', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.halfInning(1, 'bottom');
    g.pa('camisa-1', 'single');
    g.halfInning(2, 'bottom');
    g.pa('camisa-1', 'double');
    g.halfInning(3, 'bottom');
    g.pa('camisa-1', 'triple');
    g.halfInning(4, 'bottom');
    g.pa('camisa-1', 'homeRun');
    g.halfInning(5, 'bottom');
    g.pa('camisa-1', 'strikeoutLooking');

    const line = battingLineOf(deriveBoxScore(g.events), 'camisa-1');
    expect(line.ab).toBe(5);
    expect(line.h).toBe(4);
    expect(line.tb).toBe(10);
    expect(line.ba).toBe(4 / 5);
    expect(line.slg).toBe(2);
    expect(line.ops).toBe(line.obp! + line.slg!);
  });

  it('divisão por zero vira null, e a formatação exibe "—" — nunca NaN', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.halfInning(1, 'bottom');
    g.pa('camisa-1', 'walk');

    const line = battingLineOf(deriveBoxScore(g.events), 'camisa-1');
    expect(line.ab).toBe(0);
    expect(line.ba).toBeNull();
    expect(line.slg).toBeNull();
    expect(line.ops).toBeNull();
    expect(line.obp).toBe(1); // (0+1+0)/(0+1+0+0)
    expect(formatRate(line.ba)).toBe('—');
    expect(formatRate(line.slg)).toBe('—');
  });
});

describe('deriveBoxScore — corridas e RBI', () => {
  it('home run credita corrida e RBI do próprio rebatedor mais os corredores que marcam', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.halfInning(1, 'bottom');
    g.pa('camisa-1', 'single');
    g.pa('camisa-2', 'homeRun');
    g.advance('camisa-1', 1, 'home');

    const box = deriveBoxScore(g.events);
    expect(battingLineOf(box, 'camisa-1').r).toBe(1);
    expect(battingLineOf(box, 'camisa-2').r).toBe(1);
    expect(battingLineOf(box, 'camisa-2').rbi).toBe(2);
  });

  it('base por bolas com bases lotadas empurra corrida e gera RBI', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.halfInning(1, 'bottom');
    g.pa('camisa-1', 'single');
    g.pa('camisa-2', 'single');
    g.advance('camisa-1', 1, 2);
    g.pa('camisa-3', 'single');
    g.advance('camisa-1', 2, 3);
    g.advance('camisa-2', 1, 2);
    g.pa('camisa-4', 'walk');
    g.advance('camisa-1', 3, 'home');
    g.advance('camisa-2', 2, 3);
    g.advance('camisa-3', 1, 2);

    const box = deriveBoxScore(g.events);
    expect(battingLineOf(box, 'camisa-4').rbi).toBe(1);
    expect(battingLineOf(box, 'camisa-4').ab).toBe(0);
    expect(battingLineOf(box, 'camisa-1').r).toBe(1);
  });

  it('roubo de casa conta corrida para o corredor, sem RBI para ninguém', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.halfInning(1, 'bottom');
    g.pa('camisa-1', 'triple');
    g.steal('camisa-1', 'home');

    const box = deriveBoxScore(g.events);
    expect(battingLineOf(box, 'camisa-1').r).toBe(1);
    for (const line of box.batting) {
      expect(line.rbi).toBe(0);
    }
  });
});

describe('deriveBoxScore — arremessadores', () => {
  // Nosso time é mandante ⇒ defende na alta. Arremessador = posição 'P' na
  // escalação, atualizado por substituição.
  const buildPitchingGame = () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.lineup([{ playerId: 'camisa-21', battingSlot: 9, position: 'P' }]);

    g.halfInning(1, 'top');
    g.pa('opp-1', 'strikeoutSwinging');
    g.pa('opp-2', 'strikeoutLooking');
    g.pa('opp-3', 'outInPlay');

    g.halfInning(1, 'bottom');
    g.pa('camisa-1', 'outInPlay');
    g.pa('camisa-2', 'outInPlay');
    g.pa('camisa-3', 'outInPlay');

    g.halfInning(2, 'top');
    g.pa('opp-4', 'single');
    g.pa('opp-5', 'walk');
    g.advance('opp-4', 1, 2);
    g.sub('camisa-21', 'camisa-33', 9, 'P'); // troca de arremessador no meio da entrada
    g.pa('opp-6', 'strikeoutLooking');
    g.pa('opp-7', 'homeRun');
    g.advance('opp-4', 2, 'home');
    g.advance('opp-5', 1, 'home');
    g.pa('opp-8', 'outInPlay');
    return g;
  };

  it('IP em notação de súmula (outs/3), K, H e BB por arremessador', () => {
    const box = deriveBoxScore(buildPitchingGame().events);

    const starter = pitchingLineOf(box, 'camisa-21');
    expect(starter.outsRecorded).toBe(3);
    expect(starter.ip).toBe('1.0');
    expect(starter.k).toBe(2);
    expect(starter.h).toBe(1);
    expect(starter.bb).toBe(1);

    const reliever = pitchingLineOf(box, 'camisa-33');
    expect(reliever.outsRecorded).toBe(2);
    expect(reliever.ip).toBe('0.2'); // 0⅔
    expect(reliever.k).toBe(1);
    expect(reliever.h).toBe(1);
    expect(reliever.bb).toBe(0);
  });

  it('WHIP = (BB + H) / IP e RA9 = 9·R / IP, com corridas debitadas a quem está no montinho', () => {
    const box = deriveBoxScore(buildPitchingGame().events);

    const starter = pitchingLineOf(box, 'camisa-21');
    expect(starter.r).toBe(0);
    expect(starter.whip).toBe(2); // (1 BB + 1 H) / 1 IP
    expect(starter.ra9).toBe(0);

    // Simplificação v1: os corredores herdados de camisa-21 marcam com
    // camisa-33 no montinho e são debitados dele (RA, sem ERA).
    const reliever = pitchingLineOf(box, 'camisa-33');
    expect(reliever.r).toBe(3);
    expect(reliever.whip).toBeCloseTo(1 / (2 / 3), 10);
    expect(reliever.ra9).toBeCloseTo((9 * 3) / (2 / 3), 10);
  });

  it('nossa meia-entrada de ataque não gera linha de arremessador', () => {
    const box = deriveBoxScore(buildPitchingGame().events);
    expect(box.pitching.map((l) => l.playerId).sort()).toEqual(['camisa-21', 'camisa-33']);
  });

  it('IP = 0: WHIP e RA9 viram null, exibidos como "—"', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.lineup([{ playerId: 'camisa-21', battingSlot: 9, position: 'P' }]);
    g.halfInning(1, 'top');
    g.pa('opp-1', 'single');

    const line = pitchingLineOf(deriveBoxScore(g.events), 'camisa-21');
    expect(line.ip).toBe('0.0');
    expect(line.whip).toBeNull();
    expect(line.ra9).toBeNull();
    expect(formatRate(line.whip, 2)).toBe('—');
  });
});
