import { describe, expect, it } from 'vitest';
import { InconsistentGameLogError, deriveGameState } from '../src';
import { GameLogBuilder, testProfile } from './helpers';

const profile = testProfile();

describe('deriveGameState — ciclo de vida', () => {
  it('log vazio: jogo agendado, placar zerado, bases vazias', () => {
    const state = deriveGameState([], profile);
    expect(state.status).toBe('scheduled');
    expect(state.score).toEqual({ home: 0, away: 0 });
    expect(state.bases).toEqual({ first: null, second: null, third: null });
    expect(state.outs).toBe(0);
    expect(state.inning).toBeNull();
    expect(state.half).toBeNull();
    expect(state.count).toEqual({ balls: 0, strikes: 0 });
  });

  it('gameCreated preenche a configuração sem iniciar o jogo', () => {
    const g = new GameLogBuilder();
    g.gameCreated({
      sport: 'softball',
      mode: 'official',
      opponentName: 'Cocamar',
      home: false,
      competitionDayId: 'taca-brasil-2026-03-14',
    });
    const state = deriveGameState(g.events, profile);
    expect(state.status).toBe('scheduled');
    expect(state.sport).toBe('softball');
    expect(state.mode).toBe('official');
    expect(state.opponentName).toBe('Cocamar');
    expect(state.teamIsHome).toBe(false);
    expect(state.competitionDayId).toBe('taca-brasil-2026-03-14');
  });

  it('halfInningStarted zera outs e limpa as bases', () => {
    const g = new GameLogBuilder();
    g.gameCreated();
    g.halfInning(1, 'top');
    g.pa('opp-1', 'single');
    g.pa('opp-2', 'strikeoutSwinging');
    g.halfInning(1, 'bottom');
    const state = deriveGameState(g.events, profile);
    expect(state.outs).toBe(0);
    expect(state.bases).toEqual({ first: null, second: null, third: null });
    expect(state.half).toBe('bottom');
  });

  it('halfInningEnded marca a virada e limpa o diamante', () => {
    const g = new GameLogBuilder();
    g.gameCreated();
    g.halfInning(1, 'top');
    g.pa('opp-1', 'single');
    g.halfEnd('threeOuts');
    const state = deriveGameState(g.events, profile);
    expect(state.halfEnded).toBe(true);
    expect(state.bases).toEqual({ first: null, second: null, third: null });
  });

  it('walk-off encerra o jogo com a corrida contada', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.halfInning(6, 'bottom');
    g.pa('camisa-1', 'double');
    g.pa('camisa-2', 'single');
    g.advance('camisa-1', 2, 'home', 'batterAction');
    g.end('walkOff');
    const state = deriveGameState(g.events, profile);
    expect(state.status).toBe('ended');
    expect(state.endReason).toBe('walkOff');
    expect(state.score).toEqual({ home: 1, away: 0 });
  });
});

describe('deriveGameState — contagem do rebatedor', () => {
  it('deriva balls/strikes do pitch a pitch; foul não passa do 2º strike', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.lineup({ '1': 'camisa-21' });
    g.halfInning(1, 'top');
    g.pitch('camisa-21', 'ball');
    g.pitch('camisa-21', 'strikeSwinging');
    g.pitch('camisa-21', 'foul');
    g.pitch('camisa-21', 'foul'); // já com 2 strikes: não sobe
    g.pitch('camisa-21', 'ball');
    const state = deriveGameState(g.events, profile);
    expect(state.count).toEqual({ balls: 2, strikes: 2 });
  });

  it('a contagem zera quando a PA é registrada', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.lineup({ '1': 'camisa-21' });
    g.halfInning(1, 'top');
    g.pitch('camisa-21', 'ball');
    g.pitch('camisa-21', 'strikeLooking');
    g.pa('opp-1', 'strikeoutLooking');
    const state = deriveGameState(g.events, profile);
    expect(state.count).toEqual({ balls: 0, strikes: 0 });
  });
});

describe('deriveGameState — relógio e prompts do perfil', () => {
  it('relógio conta a partir do clockStarted e expira no limite do perfil', () => {
    const timed = testProfile({ timeLimit: { minutes: 90, stop: 'noNewInning' } });
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.clockStart({ ts: '2026-03-14T14:00:00.000Z' });
    g.halfInning(1, 'top');

    const running = deriveGameState(g.events, timed, { now: '2026-03-14T15:00:00.000Z' });
    expect(running.clock.remainingSeconds).toBe(30 * 60);
    expect(running.prompts).toEqual([]);

    const expired = deriveGameState(g.events, timed, { now: '2026-03-14T15:31:00.000Z' });
    expect(expired.clock.remainingSeconds).toBeLessThanOrEqual(0);
    expect(expired.prompts).toContainEqual({ kind: 'timeExpired', stop: 'noNewInning' });
  });

  it('Super Nocaute (immediate) vira prompt assim que a diferença é atingida', () => {
    const mercyProfile = testProfile({ mercy: [{ runDiff: 2, fromInning: 2, immediate: true }] });
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.halfInning(2, 'bottom');
    g.pa('camisa-1', 'homeRun');
    g.pa('camisa-2', 'homeRun');
    const state = deriveGameState(g.events, mercyProfile);
    expect(state.prompts).toContainEqual({
      kind: 'mercy',
      rule: { runDiff: 2, fromInning: 2, immediate: true },
      scoreDiff: 2,
      immediate: true,
    });
  });

  it('nocaute não dispara antes da entrada mínima do perfil', () => {
    const mercyProfile = testProfile({ mercy: [{ runDiff: 2, fromInning: 4, immediate: false }] });
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.halfInning(1, 'bottom');
    g.pa('camisa-1', 'homeRun');
    g.pa('camisa-2', 'homeRun');
    const state = deriveGameState(g.events, mercyProfile);
    expect(state.prompts).toEqual([]);
  });

  it('teto de corridas da entrada vira prompt e some após halfInningEnded', () => {
    const capped = testProfile({ runCapPerInning: 2 });
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.halfInning(1, 'bottom');
    g.pa('camisa-1', 'homeRun');
    g.pa('camisa-2', 'homeRun');

    const atCap = deriveGameState(g.events, capped);
    expect(atCap.prompts).toContainEqual({ kind: 'runCap', cap: 2, runsThisHalf: 2 });

    g.halfEnd('runCap');
    const afterEnd = deriveGameState(g.events, capped);
    expect(afterEnd.prompts).toEqual([]);
  });
});

describe('deriveGameState — placar por meia-entrada', () => {
  it('corrida na alta vai para o visitante; na baixa, para o mandante', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.halfInning(1, 'top');
    g.pa('opp-1', 'homeRun');
    g.halfInning(1, 'bottom');
    g.pa('camisa-1', 'homeRun');
    g.pa('camisa-2', 'homeRun');
    const state = deriveGameState(g.events, profile);
    expect(state.score).toEqual({ home: 2, away: 1 });
  });

  it('home run limpa o diamante quando os corredores confirmam o avanço', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.halfInning(1, 'bottom');
    g.pa('camisa-1', 'single');
    g.pa('camisa-2', 'homeRun');
    g.advance('camisa-1', 1, 'home', 'batterAction');
    const state = deriveGameState(g.events, profile);
    expect(state.score).toEqual({ home: 2, away: 0 });
    expect(state.bases).toEqual({ first: null, second: null, third: null });
  });
});

describe('deriveGameState — corredores', () => {
  it('rebatedor embasado assenta na base mesmo com o corredor anterior avançando depois do PA', () => {
    // Ordem real de gravação da UI: PA primeiro, diamante confirmado depois.
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.halfInning(1, 'bottom');
    g.pa('camisa-1', 'single');
    g.pa('camisa-2', 'single');
    g.advance('camisa-1', 1, 2, 'batterAction');
    const state = deriveGameState(g.events, profile);
    expect(state.bases).toEqual({ first: 'camisa-2', second: 'camisa-1', third: null });
  });

  it('dois corredores na mesma base derrubam a derivação', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.halfInning(1, 'bottom');
    g.pa('camisa-1', 'single');
    g.pa('camisa-2', 'single'); // camisa-1 nunca saiu da primeira
    g.pa('camisa-3', 'walk');
    expect(() => deriveGameState(g.events, profile)).toThrow(InconsistentGameLogError);
  });

  it('avanço de corredor que não está na base indicada derruba a derivação', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.halfInning(1, 'bottom');
    g.advance('fantasma', 2, 3);
    expect(() => deriveGameState(g.events, profile)).toThrow(InconsistentGameLogError);
  });

  it('runnerOut tira o corredor da base e soma out (pego roubando)', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.halfInning(1, 'bottom');
    g.pa('camisa-1', 'single');
    g.out('camisa-1', 2, 'caughtStealing');
    const state = deriveGameState(g.events, profile);
    expect(state.outs).toBe(1);
    expect(state.bases).toEqual({ first: null, second: null, third: null });
  });

  it('roubo de base move o corredor; roubo de casa marca corrida quando permitido', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.halfInning(1, 'bottom');
    g.pa('camisa-1', 'single');
    g.advance('camisa-1', 1, 2, 'stolenBase');
    g.advance('camisa-1', 2, 3, 'stolenBase');
    g.advance('camisa-1', 3, 'home', 'stolenBase');
    const state = deriveGameState(g.events, profile);
    expect(state.score).toEqual({ home: 1, away: 0 });
    expect(state.bases).toEqual({ first: null, second: null, third: null });
  });

  it('substituição ofensiva troca o corredor em base (pinch runner)', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.halfInning(1, 'bottom');
    g.pa('camisa-1', 'double');
    g.offSub(4, 'camisa-1', 'camisa-12');
    const state = deriveGameState(g.events, profile);
    expect(state.bases.second).toBe('camisa-12');
  });
});

describe('deriveGameState — regras de corrida do perfil', () => {
  const preInfantil = testProfile({
    category: 'preInfantil',
    running: { leadOffAllowed: false, stealHomeAllowed: false, wpPbAdvanceCap: 'oneBase' },
  });

  it('roubo de home proibido: tentativa vira OUT declarado, sem corrida', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.halfInning(1, 'bottom');
    g.pa('camisa-1', 'triple');
    g.advance('camisa-1', 3, 'home', 'stolenBase');
    const state = deriveGameState(g.events, preInfantil);
    expect(state.score).toEqual({ home: 0, away: 0 });
    expect(state.outs).toBe(1);
    expect(state.bases).toEqual({ first: null, second: null, third: null });
  });

  it('WP/PB com teto de 1 base: avanço de 2 bases é log inválido', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.halfInning(1, 'bottom');
    g.pa('camisa-1', 'single');
    g.advance('camisa-1', 1, 3, 'wildPitch');
    expect(() => deriveGameState(g.events, preInfantil)).toThrow(InconsistentGameLogError);
  });

  it('WP/PB de 1 base passa normalmente', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.halfInning(1, 'bottom');
    g.pa('camisa-1', 'single');
    g.advance('camisa-1', 1, 2, 'passedBall');
    const state = deriveGameState(g.events, preInfantil);
    expect(state.bases.second).toBe('camisa-1');
  });
});

describe('deriveGameState — corredor de cortesia', () => {
  it('CC é sobreposição: ocupa a base do titular e se dissolve ao marcar', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.halfInning(1, 'bottom');
    g.pa('camisa-2', 'double'); // o receptor embasa
    g.courtesyRunner('camisa-2', 'camisa-15', 2);
    const mid = deriveGameState(g.events, profile);
    expect(mid.bases.second).toBe('camisa-15');

    g.advance('camisa-15', 2, 'home', 'batterAction');
    const done = deriveGameState(g.events, profile);
    expect(done.score).toEqual({ home: 1, away: 0 });
    expect(done.bases).toEqual({ first: null, second: null, third: null });
  });

  it('CC para titular que não está na base indicada é log inválido', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.halfInning(1, 'bottom');
    g.pa('camisa-2', 'single');
    g.courtesyRunner('camisa-2', 'camisa-15', 3);
    expect(() => deriveGameState(g.events, profile)).toThrow(InconsistentGameLogError);
  });

  it('um CC pode ser trocado por outro na mesma base', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.halfInning(1, 'bottom');
    g.pa('camisa-2', 'double');
    g.courtesyRunner('camisa-2', 'camisa-15', 2);
    g.courtesyRunner('camisa-2', 'camisa-16', 2);
    const state = deriveGameState(g.events, profile);
    expect(state.bases.second).toBe('camisa-16');
  });
});
