import { describe, expect, it } from 'vitest';
import { InconsistentGameLogError, deriveGameState } from '../src';
import { GameLogBuilder } from './helpers';

describe('deriveGameState — ciclo de vida', () => {
  it('log vazio: jogo agendado, placar zerado, bases vazias', () => {
    const state = deriveGameState([]);
    expect(state.status).toBe('scheduled');
    expect(state.score).toEqual({ home: 0, away: 0 });
    expect(state.bases).toEqual({ first: null, second: null, third: null });
    expect(state.outs).toBe(0);
    expect(state.inning).toBeNull();
    expect(state.half).toBeNull();
  });

  it('gameCreated preenche a configuração sem iniciar o jogo', () => {
    const g = new GameLogBuilder();
    g.gameCreated({
      sport: 'softball',
      category: 'sub-15',
      scheduledInnings: 5,
      opponentName: 'Cocamar',
      home: false,
    });
    const state = deriveGameState(g.events);
    expect(state.status).toBe('scheduled');
    expect(state.sport).toBe('softball');
    expect(state.category).toBe('sub-15');
    expect(state.scheduledInnings).toBe(5);
    expect(state.opponentName).toBe('Cocamar');
    expect(state.teamIsHome).toBe(false);
  });

  it('halfInningStarted zera outs e limpa as bases', () => {
    const g = new GameLogBuilder();
    g.gameCreated();
    g.halfInning(1, 'top');
    g.pa('opp-1', 'single');
    g.pa('opp-2', 'strikeoutSwinging');
    g.halfInning(1, 'bottom');
    const state = deriveGameState(g.events);
    expect(state.outs).toBe(0);
    expect(state.bases).toEqual({ first: null, second: null, third: null });
    expect(state.half).toBe('bottom');
  });

  it('walk-off encerra o jogo com a corrida contada', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.halfInning(7, 'bottom');
    g.pa('camisa-1', 'double');
    g.pa('camisa-2', 'single');
    g.advance('camisa-1', 2, 'home');
    g.end('walkOff');
    const state = deriveGameState(g.events);
    expect(state.status).toBe('ended');
    expect(state.endReason).toBe('walkOff');
    expect(state.score).toEqual({ home: 1, away: 0 });
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
    const state = deriveGameState(g.events);
    expect(state.score).toEqual({ home: 2, away: 1 });
  });

  it('home run limpa o diamante quando os corredores confirmam o avanço', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.halfInning(1, 'bottom');
    g.pa('camisa-1', 'single');
    g.pa('camisa-2', 'homeRun');
    g.advance('camisa-1', 1, 'home');
    const state = deriveGameState(g.events);
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
    g.advance('camisa-1', 1, 2);
    const state = deriveGameState(g.events);
    expect(state.bases).toEqual({ first: 'camisa-2', second: 'camisa-1', third: null });
  });

  it('rebatedor-corredor pode avançar além da base do resultado na mesma jogada', () => {
    // Single + erro no arremesso de volta: rebatedor estica para a segunda.
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.halfInning(1, 'bottom');
    g.pa('camisa-1', 'single');
    g.advance('camisa-1', 1, 2);
    const state = deriveGameState(g.events);
    expect(state.bases).toEqual({ first: null, second: 'camisa-1', third: null });
  });

  it('dois corredores na mesma base derrubam a derivação', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.halfInning(1, 'bottom');
    g.pa('camisa-1', 'single');
    g.pa('camisa-2', 'single'); // camisa-1 nunca saiu da primeira
    g.pa('camisa-3', 'walk');
    expect(() => deriveGameState(g.events)).toThrow(InconsistentGameLogError);
  });

  it('avanço de corredor que não está na base indicada derruba a derivação', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.halfInning(1, 'bottom');
    g.advance('fantasma', 2, 3);
    expect(() => deriveGameState(g.events)).toThrow(InconsistentGameLogError);
  });

  it('runnerOut tira o corredor da base e soma out (pego roubando)', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.halfInning(1, 'bottom');
    g.pa('camisa-1', 'single');
    g.out('camisa-1', 2, 'caughtStealing');
    const state = deriveGameState(g.events);
    expect(state.outs).toBe(1);
    expect(state.bases).toEqual({ first: null, second: null, third: null });
  });

  it('dupla eliminação: out do rebatedor + out de corredor na mesma jogada', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.halfInning(1, 'bottom');
    g.pa('camisa-1', 'single');
    g.pa('camisa-2', 'outInPlay');
    g.out('camisa-1', 2, 'forceOut');
    const state = deriveGameState(g.events);
    expect(state.outs).toBe(2);
    expect(state.bases).toEqual({ first: null, second: null, third: null });
  });

  it('roubo de base move o corredor; roubo de casa marca corrida', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.halfInning(1, 'bottom');
    g.pa('camisa-1', 'single');
    g.steal('camisa-1', 2);
    g.steal('camisa-1', 3);
    g.steal('camisa-1', 'home');
    const state = deriveGameState(g.events);
    expect(state.score).toEqual({ home: 1, away: 0 });
    expect(state.bases).toEqual({ first: null, second: null, third: null });
  });

  it('substituição troca o corredor em base (pinch runner)', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.halfInning(1, 'bottom');
    g.pa('camisa-1', 'double');
    g.sub('camisa-1', 'camisa-12', 4, 'DH');
    const state = deriveGameState(g.events);
    expect(state.bases.second).toBe('camisa-12');
  });
});
