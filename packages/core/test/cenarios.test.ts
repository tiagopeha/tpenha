import { describe, expect, it } from 'vitest';
import { deriveBoxScore, deriveGameState, formatRate } from '../src';
import { GameLogBuilder, battingLineOf, testProfile } from './helpers';

// Espec executável de regras — docs/cenarios-de-teste.md.
// Em caso de conflito entre este arquivo e o doc, o doc vence.
//
// Os cenários 02, 03 e 05 ainda não têm a prosa preenchida pelo Tiago no doc;
// os testes abaixo cobrem a regra indicada pelo título de cada cenário (com as
// fórmulas de docs/modelo-de-eventos.md) e devem ser ajustados quando a
// redação oficial chegar.

const profile = testProfile();

describe('Cenário 01 — sac fly não conta AB, mas conta RBI', () => {
  // Baixa da 3ª entrada, 1 out, corredor na terceira. Rebatedor nº 7 acerta um
  // fly profundo para o campo central; defensor pega (2º out) e o corredor da
  // terceira reclassifica e marca.
  const g = new GameLogBuilder();
  g.gameCreated({ home: true });
  g.halfInning(3, 'bottom');
  g.pa('camisa-5', 'triple'); // corredor na terceira
  g.pa('camisa-6', 'outInPlay'); // 1 out
  g.pa('camisa-7', 'sacFly'); // defensor pega — 2º out
  g.advance('camisa-5', 3, 'home', 'batterAction'); // reclassifica e marca

  it('rebatedor nº 7: PA 1, AB 0, SF 1, RBI 1', () => {
    const line = battingLineOf(deriveBoxScore(g.events), 'camisa-7');
    expect(line.pa).toBe(1);
    expect(line.ab).toBe(0);
    expect(line.sacFlies).toBe(1);
    expect(line.rbi).toBe(1);
    expect(line.h).toBe(0);
  });

  it('placar +1 para o mandante; 2 outs; bases vazias', () => {
    const state = deriveGameState(g.events, profile);
    expect(state.score).toEqual({ home: 1, away: 0 });
    expect(state.outs).toBe(2);
    expect(state.bases).toEqual({ first: null, second: null, third: null });
    expect(state.inning).toBe(3);
    expect(state.half).toBe('bottom');
  });

  it('OBP considera o SF no denominador: uma PA com só esse SF ⇒ OBP 0.000, BA "—"', () => {
    const line = battingLineOf(deriveBoxScore(g.events), 'camisa-7');
    expect(line.obp).toBe(0);
    expect(line.ba).toBeNull();
    expect(formatRate(line.obp)).toBe('0.000');
    expect(formatRate(line.ba)).toBe('—');
  });
});

describe('Cenário 02 — chegou por erro não é hit', () => {
  // Alta da 1ª, corredor na terceira. Rebatedor bate para o defensor, que
  // comete erro; rebatedor chega à primeira e o corredor da terceira marca.
  const g = new GameLogBuilder();
  g.gameCreated({ home: false });
  g.halfInning(1, 'top');
  g.pa('camisa-1', 'triple');
  g.pa('camisa-2', 'reachedOnError', { defense: { errors: [{ position: 6 }] } });
  g.advance('camisa-1', 3, 'home', 'batterAction');

  it('ROE conta PA e AB, mas não é hit — mantém a BA honesta', () => {
    const line = battingLineOf(deriveBoxScore(g.events), 'camisa-2');
    expect(line.pa).toBe(1);
    expect(line.ab).toBe(1);
    expect(line.h).toBe(0);
    expect(line.ba).toBe(0);
  });

  it('a corrida vale, mas não há RBI numa PA de reachedOnError', () => {
    const box = deriveBoxScore(g.events);
    expect(battingLineOf(box, 'camisa-1').r).toBe(1);
    expect(battingLineOf(box, 'camisa-2').rbi).toBe(0);

    const state = deriveGameState(g.events, profile);
    expect(state.score).toEqual({ home: 0, away: 1 });
    expect(state.bases.first).toBe('camisa-2');
  });
});

describe('Cenário 03 — escolha do defensor com corrida marcando', () => {
  // Baixa da 2ª, 0 out, corredores na 1ª e na 3ª. Grounder; a defesa força o
  // corredor da 1ª na segunda base; o corredor da 3ª marca; rebatedor salvo
  // na primeira.
  const g = new GameLogBuilder();
  g.gameCreated({ home: true });
  g.halfInning(2, 'bottom');
  g.pa('camisa-3', 'triple');
  g.pa('camisa-4', 'single');
  g.pa('camisa-5', 'fieldersChoice', { defense: { putoutSequence: [6, 4] } });
  g.out('camisa-4', 2, 'forceOut');
  g.advance('camisa-3', 3, 'home', 'batterAction');

  it('FC não é hit, mas conta AB e leva RBI na corrida da jogada', () => {
    const line = battingLineOf(deriveBoxScore(g.events), 'camisa-5');
    expect(line.pa).toBe(1);
    expect(line.ab).toBe(1);
    expect(line.h).toBe(0);
    expect(line.rbi).toBe(1);
  });

  it('1 out, corrida no placar, rebatedor fica na primeira', () => {
    const state = deriveGameState(g.events, profile);
    expect(state.outs).toBe(1);
    expect(state.score).toEqual({ home: 1, away: 0 });
    expect(state.bases).toEqual({ first: 'camisa-5', second: null, third: null });
  });
});

describe('Cenário 04 — correção de jogada depois que o próximo rebatedor já foi anotado', () => {
  // Anotador marcou 1B para o rebatedor, mas era erro do defensor; corrige
  // duas jogadas depois. Correção = novo evento com `supersedes`, e as
  // estatísticas re-derivam sozinhas.
  const build = () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.halfInning(1, 'bottom');
    const wrong = g.pa('camisa-1', 'single');
    g.pa('camisa-2', 'outInPlay');
    g.pa('camisa-1', 'reachedOnError', { supersedes: wrong.id });
    return g;
  };

  it('o hit some da linha do rebatedor; PA e AB permanecem', () => {
    const line = battingLineOf(deriveBoxScore(build().events), 'camisa-1');
    expect(line.pa).toBe(1);
    expect(line.ab).toBe(1);
    expect(line.h).toBe(0);
    expect(line.singles).toBe(0);
    expect(line.ba).toBe(0);
  });

  it('o rebatedor seguinte não é afetado', () => {
    const line = battingLineOf(deriveBoxScore(build().events), 'camisa-2');
    expect(line.pa).toBe(1);
    expect(line.ab).toBe(1);
  });

  it('o estado re-deriva como se a jogada tivesse sido anotada certa desde o início', () => {
    const corrected = deriveGameState(build().events, profile);

    const clean = new GameLogBuilder();
    clean.gameCreated({ home: true });
    clean.halfInning(1, 'bottom');
    clean.pa('camisa-1', 'reachedOnError');
    clean.pa('camisa-2', 'outInPlay');

    expect(corrected).toEqual(deriveGameState(clean.events, profile));
    expect(corrected.bases.first).toBe('camisa-1');
    expect(corrected.outs).toBe(1);
  });
});

describe('Cenário 05 — fim de jogo por nocaute (mercy)', () => {
  // A regra exata (diferença × entrada) vem do `mercy[]` do RulesProfile —
  // regra é dado, não código. O motor apresenta o prompt; o encerramento é
  // registrado pelo anotador e o placar é preservado.
  const mercyProfile = testProfile({ mercy: [{ runDiff: 3, fromInning: 1, immediate: false }] });

  const build = () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.halfInning(1, 'bottom');
    g.pa('camisa-1', 'homeRun');
    g.pa('camisa-2', 'homeRun');
    g.pa('camisa-3', 'homeRun');
    return g;
  };

  it('atingiu a diferença do perfil: o motor apresenta o prompt de nocaute', () => {
    const state = deriveGameState(build().events, mercyProfile);
    expect(state.prompts).toContainEqual({
      kind: 'mercy',
      rule: { runDiff: 3, fromInning: 1, immediate: false },
      scoreDiff: 3,
      immediate: false,
    });
  });

  it('jogo encerra com endReason mercy e placar preservado', () => {
    const g = build();
    g.end('mercy');
    const state = deriveGameState(g.events, mercyProfile);
    expect(state.status).toBe('ended');
    expect(state.endReason).toBe('mercy');
    expect(state.score).toEqual({ home: 3, away: 0 });
    expect(state.prompts).toEqual([]); // jogo encerrado não pede intervenção
  });
});
