import type {
  AdvanceTarget,
  Base,
  CourtesyRunnerInPayload,
  PlateAppearanceRecordedPayload,
  RunnerAdvancedPayload,
  RunnerOutPayload,
} from './events';
import type { RulesProfile } from './rulesProfile';

/** O log descreve um estado de jogo impossível (ex.: dois corredores na mesma base). */
export class InconsistentGameLogError extends Error {
  constructor(message: string, readonly eventId?: string) {
    super(eventId === undefined ? message : `${message} (event ${eventId})`);
    this.name = 'InconsistentGameLogError';
  }
}

export type Bases = {
  first: string | null;
  second: string | null;
  third: string | null;
};

/**
 * Corrida cruzando o home: `runnerId` é quem estava fisicamente na base;
 * `officialRunnerId` resolve o alias de corredor de cortesia para o titular.
 * (Crédito da corrida do CC ao titular: pendente de validação com o árbitro.)
 */
export type RunScored = { runnerId: string; officialRunnerId: string };

export type AdvanceOutcome = { run?: RunScored; declaredOut?: boolean };

const BASE_KEYS: Record<Base, keyof Bases> = { 1: 'first', 2: 'second', 3: 'third' };

const PA_OUT_RESULTS = new Set([
  'strikeoutSwinging',
  'strikeoutLooking',
  'outInPlay',
  'sacBunt',
  'sacFly',
]);

const PA_REACH_BASE: Partial<Record<string, Base>> = {
  single: 1,
  double: 2,
  triple: 3,
  walk: 1,
  hitByPitch: 1,
  fieldersChoice: 1,
  reachedOnError: 1,
};

/**
 * Rastreia bases, outs, rebatedor pendente e aliases de corredor de cortesia.
 * Compartilhado por deriveGameState e deriveLOB — uma única fonte de verdade
 * para a mecânica de corredores.
 *
 * Convenções (docs/modelo-de-eventos.md):
 * - a UI grava o `plateAppearanceRecorded` ANTES de confirmar o diamante, então
 *   a base do rebatedor fica pendente até os movimentos serem aplicados;
 * - no `homeRun`, a corrida do rebatedor é automática; corredores marcam via
 *   `runnerAdvanced` explícito;
 * - regras de corrida do perfil: roubo de home proibido ⇒ tentativa é OUT
 *   declarado; WP/PB com teto de 1 base ⇒ avanço maior é log inválido.
 */
export class BaseTracker {
  bases: Bases = { first: null, second: null, third: null };
  outs = 0;

  private pendingBatter: { runnerId: string; base: Base } | null = null;
  /** aliasRunnerId → titularId (corredor de cortesia). */
  private aliases = new Map<string, string>();

  constructor(private readonly running?: RulesProfile['running']) {}

  officialId(runnerId: string): string {
    return this.aliases.get(runnerId) ?? runnerId;
  }

  /** Corredores em base, incluindo o rebatedor pendente (para LOB). */
  occupiedRunners(): string[] {
    const runners = [this.bases.first, this.bases.second, this.bases.third].filter(
      (r): r is string => r !== null,
    );
    if (this.pendingBatter !== null) runners.push(this.pendingBatter.runnerId);
    return runners.map((r) => this.officialId(r));
  }

  /** Assenta o rebatedor pendente; valida "dois corredores na mesma base". */
  settle(eventId?: string): void {
    if (this.pendingBatter === null) return;
    const key = BASE_KEYS[this.pendingBatter.base];
    const occupant = this.bases[key];
    if (occupant !== null) {
      throw new InconsistentGameLogError(
        `two runners on base ${this.pendingBatter.base}: ${occupant} and ${this.pendingBatter.runnerId}`,
        eventId,
      );
    }
    this.bases[key] = this.pendingBatter.runnerId;
    this.pendingBatter = null;
  }

  startHalf(eventId: string): void {
    this.settle(eventId);
    this.clearBases();
    this.outs = 0;
  }

  /** Fim da meia-entrada: assenta, tira o snapshot de LOB e limpa o diamante. */
  endHalf(eventId: string): string[] {
    this.settle(eventId);
    const stranded = this.occupiedRunners();
    this.clearBases();
    return stranded;
  }

  applyPlateAppearance(payload: PlateAppearanceRecordedPayload, eventId: string): AdvanceOutcome {
    this.settle(eventId);
    const { batterId, result } = payload;
    if (PA_OUT_RESULTS.has(result)) {
      this.outs += 1;
      return {};
    }
    if (result === 'homeRun') {
      return { run: { runnerId: batterId, officialRunnerId: batterId } };
    }
    const base = PA_REACH_BASE[result];
    if (base !== undefined) {
      this.pendingBatter = { runnerId: batterId, base };
    }
    return {};
  }

  applyRunnerAdvanced(payload: RunnerAdvancedPayload, eventId: string): AdvanceOutcome {
    const { runnerId, from, to, reason } = payload;

    // Roubo de home proibido pelo perfil (Pré-Infantil): tentativa = OUT declarado.
    if (
      to === 'home' &&
      reason === 'stolenBase' &&
      this.running !== undefined &&
      !this.running.stealHomeAllowed
    ) {
      this.removeRunner(runnerId, eventId);
      this.outs += 1;
      return { declaredOut: true };
    }

    // WP/PB com teto de 1 base pelo perfil: avanço maior é log inválido.
    if (
      this.running?.wpPbAdvanceCap === 'oneBase' &&
      (reason === 'wildPitch' || reason === 'passedBall')
    ) {
      const distance = (to === 'home' ? 4 : to) - from;
      if (distance > 1) {
        throw new InconsistentGameLogError(
          `wild pitch/passed ball advance capped at one base by rules profile (${from} → ${String(to)})`,
          eventId,
        );
      }
    }

    return this.moveRunner(runnerId, from, to, eventId);
  }

  applyRunnerOut(payload: RunnerOutPayload, eventId: string): void {
    this.removeRunner(payload.runnerId, eventId);
    this.outs += 1;
  }

  /** Substituição ofensiva com o atleta em base (pinch runner): troca a ocupação. */
  applyOffensiveSubstitution(outPlayerId: string, inPlayerId: string): void {
    if (this.swapPendingRunner(outPlayerId, inPlayerId)) return;
    const base = this.findRunnerBase(outPlayerId);
    if (base !== null) {
      this.bases[BASE_KEYS[base]] = inPlayerId;
    }
  }

  /**
   * Corredor de cortesia: sobreposição (alias) sobre a base do titular — o
   * titular segue ativo na escalação. Aceita trocar um CC por outro.
   */
  applyCourtesyRunnerIn(payload: CourtesyRunnerInPayload, eventId: string): void {
    const { forPlayerId, runnerId, base } = payload;
    const key = BASE_KEYS[base];

    if (this.pendingBatter !== null && this.officialId(this.pendingBatter.runnerId) === forPlayerId) {
      if (this.pendingBatter.base !== base) {
        throw new InconsistentGameLogError(
          `courtesy runner declared on base ${base} but ${forPlayerId} reached base ${this.pendingBatter.base}`,
          eventId,
        );
      }
      this.aliases.delete(this.pendingBatter.runnerId);
      this.pendingBatter = { runnerId, base };
      this.aliases.set(runnerId, forPlayerId);
      return;
    }

    const occupant = this.bases[key];
    if (occupant === null || this.officialId(occupant) !== forPlayerId) {
      throw new InconsistentGameLogError(
        `courtesy runner for ${forPlayerId} on base ${base}, but the base is held by ${occupant ?? 'nobody'}`,
        eventId,
      );
    }
    this.aliases.delete(occupant); // troca de CC por outro
    this.bases[key] = runnerId;
    this.aliases.set(runnerId, forPlayerId);
  }

  private clearBases(): void {
    this.bases = { first: null, second: null, third: null };
    this.aliases.clear(); // o alias de CC se dissolve no fim da meia-entrada
  }

  private swapPendingRunner(outPlayerId: string, inPlayerId: string): boolean {
    if (this.pendingBatter !== null && this.pendingBatter.runnerId === outPlayerId) {
      this.pendingBatter = { runnerId: inPlayerId, base: this.pendingBatter.base };
      return true;
    }
    return false;
  }

  private findRunnerBase(runnerId: string): Base | null {
    for (const base of [1, 2, 3] as const) {
      if (this.bases[BASE_KEYS[base]] === runnerId) return base;
    }
    return null;
  }

  private removeRunner(runnerId: string, eventId: string): void {
    if (this.pendingBatter !== null && this.pendingBatter.runnerId === runnerId) {
      this.pendingBatter = null;
      this.aliases.delete(runnerId);
      return;
    }
    const base = this.findRunnerBase(runnerId);
    if (base === null) {
      throw new InconsistentGameLogError(`runner ${runnerId} is not on base`, eventId);
    }
    this.bases[BASE_KEYS[base]] = null;
    this.aliases.delete(runnerId);
  }

  private moveRunner(runnerId: string, from: Base, to: AdvanceTarget, eventId: string): AdvanceOutcome {
    if (this.pendingBatter !== null && this.pendingBatter.runnerId === runnerId) {
      // Rebatedor-corredor avançando na mesma jogada (ex.: erro no arremesso).
      if (this.pendingBatter.base !== from) {
        throw new InconsistentGameLogError(
          `runner ${runnerId} advanced from base ${from} but reached base ${this.pendingBatter.base}`,
          eventId,
        );
      }
      if (to === 'home') {
        this.pendingBatter = null;
        return { run: { runnerId, officialRunnerId: this.officialId(runnerId) } };
      }
      this.pendingBatter = { runnerId, base: to };
      return {};
    }

    const fromKey = BASE_KEYS[from];
    if (this.bases[fromKey] !== runnerId) {
      throw new InconsistentGameLogError(`runner ${runnerId} is not on base ${from}`, eventId);
    }
    this.bases[fromKey] = null;
    if (to === 'home') {
      const officialRunnerId = this.officialId(runnerId);
      this.aliases.delete(runnerId); // alias se dissolve ao sair da base
      return { run: { runnerId, officialRunnerId } };
    }
    const toKey = BASE_KEYS[to];
    const occupant = this.bases[toKey];
    if (occupant !== null) {
      throw new InconsistentGameLogError(
        `two runners on base ${to}: ${occupant} and ${runnerId}`,
        eventId,
      );
    }
    this.bases[toKey] = runnerId;
    return {};
  }
}
