import { describe, expect, it } from 'vitest';
import { derivePitcherDayLedger, validateDefensiveAssignment } from '../src';
import { GameLogBuilder, ledgerOf, testProfile } from './helpers';

// Razão diário do atleta — docs/regras-cbbs.md §1. Valores de limite abaixo
// são fictícios (regra é dado): o motor lê tudo do RulesProfile.
const profile = testProfile({
  pitching: { style: 'kidPitch', dailyPitchLimit: 10, warnAt: 5, reentryBanMargin: 6 },
});

function pitches(g: GameLogBuilder, pitcherId: string, n: number): void {
  for (let i = 0; i < n; i += 1) g.pitch(pitcherId, 'ball');
}

describe('derivePitcherDayLedger — contagem oficial e alerta', () => {
  it('conta arremessos oficiais, restantes e dispara o alerta em limite − 5', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.lineup({ '1': 'camisa-21', '2': 'camisa-9' });
    g.halfInning(1, 'top');
    pitches(g, 'camisa-21', 5);

    const entry = ledgerOf(derivePitcherDayLedger(g.events, profile), 'camisa-21');
    expect(entry.officialPitches).toBe(5);
    expect(entry.remainingPitches).toBe(5);
    expect(entry.warned).toBe(true); // warnAt = 5: "notifique o árbitro principal"
    expect(entry.pitchedToday).toBe(true);
    expect(entry.overageToFinishBatter).toBe(0);
  });

  it('"terminar de enfrentar o rebatedor": excedente legal não conta como oficial', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.lineup({ '1': 'camisa-21' });
    g.halfInning(1, 'top');
    pitches(g, 'camisa-21', 8);
    g.pa('opp-1', 'outInPlay'); // fim do confronto
    // Novo confronto começa com 8 ≤ 10 ⇒ legal ultrapassar o teto dentro dele.
    pitches(g, 'camisa-21', 4);
    g.pa('opp-2', 'single');

    const entry = ledgerOf(derivePitcherDayLedger(g.events, profile), 'camisa-21');
    expect(entry.officialPitches).toBe(10); // trava no limite
    expect(entry.overageToFinishBatter).toBe(2); // excedente legal do confronto
    expect(entry.remainingPitches).toBe(0);
    expect(entry.illegalAtBatStart).toBe(false);
  });

  it('iniciar confronto já no limite marca a irregularidade', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.lineup({ '1': 'camisa-21' });
    g.halfInning(1, 'top');
    pitches(g, 'camisa-21', 10);
    g.pa('opp-1', 'outInPlay');
    g.pitch('camisa-21', 'ball'); // novo confronto com 10/10

    const entry = ledgerOf(derivePitcherDayLedger(g.events, profile), 'camisa-21');
    expect(entry.illegalAtBatStart).toBe(true);
    expect(entry.overageToFinishBatter).toBe(1);
  });

  it('agrega jogos do mesmo dia de competição', () => {
    const g1 = new GameLogBuilder('game-1');
    g1.gameCreated({ home: true, competitionDayId: 'copa-2026-03-14' });
    g1.lineup({ '1': 'camisa-21' });
    g1.halfInning(1, 'top');
    pitches(g1, 'camisa-21', 6);

    const g2 = new GameLogBuilder('game-2', 60); // segundo jogo do dia
    g2.gameCreated({ home: false, competitionDayId: 'copa-2026-03-14' });
    g2.lineup({ '1': 'camisa-21' });
    g2.halfInning(1, 'bottom');
    pitches(g2, 'camisa-21', 5);

    const entry = ledgerOf(
      derivePitcherDayLedger([...g1.events, ...g2.events], profile),
      'camisa-21',
    );
    expect(entry.officialPitches).toBe(10); // 6 + 4; o 5º do jogo 2 é excedente
    expect(entry.overageToFinishBatter).toBe(1);
    expect(entry.gamesPitched).toEqual(['game-1', 'game-2']);
  });
});

describe('derivePitcherDayLedger — reentrada e flags P/C', () => {
  it('removido do montículo dentro da margem exígua fica com reentrada vetada', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.lineup({ '1': 'camisa-21' });
    g.halfInning(1, 'top');
    pitches(g, 'camisa-21', 5); // restam 5 ≤ margem 6
    g.defChange({ '1': 'camisa-33' });

    const ledger = derivePitcherDayLedger(g.events, profile);
    expect(ledgerOf(ledger, 'camisa-21').reentryBlocked).toBe(true);
  });

  it('removido com folga não é bloqueado', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.lineup({ '1': 'camisa-21' });
    g.halfInning(1, 'top');
    pitches(g, 'camisa-21', 2); // restam 8 > margem 6
    g.defChange({ '1': 'camisa-33' });

    const ledger = derivePitcherDayLedger(g.events, profile);
    expect(ledgerOf(ledger, 'camisa-21').reentryBlocked).toBe(false);
  });

  it('marca quem arremessou e quem recebeu no dia', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.lineup({ '1': 'camisa-21', '2': 'camisa-9' });
    g.halfInning(1, 'top');
    pitches(g, 'camisa-21', 1);

    const ledger = derivePitcherDayLedger(g.events, profile);
    expect(ledgerOf(ledger, 'camisa-21').pitchedToday).toBe(true);
    expect(ledgerOf(ledger, 'camisa-9').caughtToday).toBe(true);
  });
});

describe('validateDefensiveAssignment — bloqueios com referência da norma', () => {
  const dayLog = () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.lineup({ '1': 'camisa-21', '2': 'camisa-9' });
    g.halfInning(1, 'top');
    pitches(g, 'camisa-21', 5);
    g.defChange({ '1': 'camisa-33' }); // camisa-21 sai na margem exígua
    return derivePitcherDayLedger(g.events, profile);
  };

  it('quem arremessou não recebe; quem recebeu não arremessa (CT-02)', () => {
    const ledger = dayLog();

    const pitcherAsCatcher = validateDefensiveAssignment(ledger, profile, 'camisa-21', 2);
    expect(pitcherAsCatcher.allowed).toBe(false);
    expect(pitcherAsCatcher.violations[0]!.rule).toContain('exclusividade');

    const catcherAsPitcher = validateDefensiveAssignment(ledger, profile, 'camisa-9', 1);
    expect(catcherAsPitcher.allowed).toBe(false);
    expect(catcherAsPitcher.violations[0]!.rule).toContain('exclusividade');
  });

  it('reentrada vetada bloqueia a volta ao montículo', () => {
    const result = validateDefensiveAssignment(dayLog(), profile, 'camisa-21', 1);
    expect(result.allowed).toBe(false);
    expect(result.violations.some((v) => v.rule.includes('reentrada'))).toBe(true);
  });

  it('limite diário atingido bloqueia nova alocação como arremessador', () => {
    const g = new GameLogBuilder();
    g.gameCreated({ home: true });
    g.lineup({ '1': 'camisa-21' });
    g.halfInning(1, 'top');
    pitches(g, 'camisa-21', 10);
    const ledger = derivePitcherDayLedger(g.events, profile);

    const result = validateDefensiveAssignment(ledger, profile, 'camisa-21', 1);
    expect(result.allowed).toBe(false);
    expect(result.violations.some((v) => v.rule.includes('limite diário'))).toBe(true);
  });

  it('atleta sem restrição no dia é liberado', () => {
    const result = validateDefensiveAssignment(dayLog(), profile, 'camisa-33', 2);
    expect(result.allowed).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('T-Bol: quem arremessou em data anterior do torneio não arremessa de novo', () => {
    const tball = testProfile({ category: 'tball', pitching: { style: 'tee', warnAt: 0 } });
    const empty = derivePitcherDayLedger([], tball);
    const result = validateDefensiveAssignment(empty, tball, 'camisa-8', 1, {
      pitchedOnEarlierTournamentDay: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.violations[0]!.rule).toContain('T-Bol');
  });
});
