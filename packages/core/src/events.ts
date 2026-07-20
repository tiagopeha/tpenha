import { z } from 'zod';
import { categorySchema } from './rulesProfile';

// Modelo de eventos do jogo — ver docs/modelo-de-eventos.md.
// Só o jogo ao vivo é event-sourced; eventos são imutáveis e append-only.
// Correção = novo evento com `supersedes`; nunca editar ou apagar.
//
// Dois modos (rápido / súmula oficial), um único log: o schema já nasce em
// nível de súmula — pitch a pitch, atribuição defensiva, erros — e o modo só
// muda o que a UI exige.

export const paResultSchema = z.enum([
  'single',
  'double',
  'triple',
  'homeRun',
  'walk',
  'hitByPitch',
  'strikeoutSwinging',
  'strikeoutLooking',
  'outInPlay',
  'fieldersChoice',
  'reachedOnError',
  'sacBunt', // indisponível em perfis T-Bol (bunt proibido)
  'sacFly',
]);
export type PAResult = z.infer<typeof paResultSchema>;

export const baseSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type Base = z.infer<typeof baseSchema>;

export const advanceTargetSchema = z.union([z.literal(2), z.literal(3), z.literal('home')]);
export type AdvanceTarget = z.infer<typeof advanceTargetSchema>;

export const halfSchema = z.enum(['top', 'bottom']);
export type Half = z.infer<typeof halfSchema>;

/** Numeração defensiva oficial: 1 P · 2 C · 3 1B · 4 2B · 5 3B · 6 SS · 7 LF · 8 CF · 9 RF. */
export const fieldingPositionSchema = z.number().int().min(1).max(9);
export type FieldingPosition = z.infer<typeof fieldingPositionSchema>;

/** Mapa defensivo `posição ('1'..'9') → playerId` — chaves de string por ser JSON. */
export const defenseMapSchema = z.record(z.string().regex(/^[1-9]$/), z.string().min(1));
export type DefenseMap = z.infer<typeof defenseMapSchema>;

export const PITCHER_POSITION = '1';
export const CATCHER_POSITION = '2';

export const gameCreatedPayloadSchema = z.object({
  sport: z.enum(['baseball', 'softball']),
  category: categorySchema,
  rulesProfileId: z.string().min(1),
  mode: z.enum(['quick', 'official']),
  // Adversário é SEMPRE texto livre — nunca exigir que exista na plataforma.
  opponentName: z.string().min(1),
  // Modo oficial: elenco avulso do adversário (nome + número, sem contas —
  // minimização LGPD).
  opponentRoster: z.array(z.object({ name: z.string().min(1), number: z.string().min(1) })).optional(),
  home: z.boolean(),
  // Torneio + data — alimenta o razão diário de arremessos. Não é chaveamento.
  competitionDayId: z.string().min(1).optional(),
});
export type GameCreatedPayload = z.infer<typeof gameCreatedPayloadSchema>;

/** "Play Ball" — o cronômetro do `timeLimit` conta a partir do `ts` deste evento. */
export const clockStartedPayloadSchema = z.object({});
export type ClockStartedPayload = z.infer<typeof clockStartedPayloadSchema>;

export const battingSlotSchema = z.object({
  slot: z.number().int().min(1).max(14), // ordem contínua: até 14 slots
  playerId: z.string().min(1),
});
export type BattingSlot = z.infer<typeof battingSlotSchema>;

// Ordem de rebatida (até 14, modo contínuo) DESACOPLADA do mapa defensivo (9).
export const lineupSetPayloadSchema = z.object({
  battingSlots: z.array(battingSlotSchema).min(1),
  defense: defenseMapSchema,
  extraHitter: z.boolean().optional(),
});
export type LineupSetPayload = z.infer<typeof lineupSetPayloadSchema>;

/** Reposiciona o campo; **não** altera a ordem de rebatida. */
export const defensiveChangePayloadSchema = z.object({
  assignments: defenseMapSchema,
});
export type DefensiveChangePayload = z.infer<typeof defensiveChangePayloadSchema>;

/** Substituição ofensiva (permanente no slot) — desativada em ordem contínua. */
export const offensiveSubstitutionPayloadSchema = z.object({
  slot: z.number().int().min(1).max(14),
  outPlayerId: z.string().min(1),
  inPlayerId: z.string().min(1),
});
export type OffensiveSubstitutionPayload = z.infer<typeof offensiveSubstitutionPayloadSchema>;

/**
 * Corredor de cortesia: sobreposição efêmera (alias) sobre a ocupação da base
 * do P ou C — NUNCA substituição. O titular segue ativo; o alias se dissolve
 * no fim da meia-entrada ou quando sai da base.
 */
export const courtesyRunnerInPayloadSchema = z.object({
  forPlayerId: z.string().min(1), // P ou C
  runnerId: z.string().min(1),
  base: baseSchema,
});
export type CourtesyRunnerInPayload = z.infer<typeof courtesyRunnerInPayloadSchema>;

export const halfInningStartedPayloadSchema = z.object({
  inning: z.number().int().positive(),
  half: halfSchema,
});
export type HalfInningStartedPayload = z.infer<typeof halfInningStartedPayloadSchema>;

/** Snapshot de LOB é derivado neste ponto (deriveLOB). */
export const halfInningEndedPayloadSchema = z.object({
  reason: z.enum(['threeOuts', 'runCap', 'timeHard', 'walkOff']),
});
export type HalfInningEndedPayload = z.infer<typeof halfInningEndedPayloadSchema>;

export const gameEndReasonSchema = z.enum([
  'regulation',
  'mercy',
  'timeLimit',
  'walkOff',
  'forfeit',
  'suspended',
  'other',
]);
export type GameEndReason = z.infer<typeof gameEndReasonSchema>;

export const gameEndedPayloadSchema = z.object({
  reason: gameEndReasonSchema,
  detail: z.string().optional(),
});
export type GameEndedPayload = z.infer<typeof gameEndedPayloadSchema>;

// Obrigatório quando pitching.style === 'kidPitch'; módulo oculto em tee/coachPitch.
// Alimenta a contagem do confronto E o razão diário de pitch count.
export const pitchThrownPayloadSchema = z.object({
  pitcherId: z.string().min(1),
  call: z.enum(['ball', 'strikeSwinging', 'strikeLooking', 'foul', 'inPlay', 'hitByPitch']),
});
export type PitchThrownPayload = z.infer<typeof pitchThrownPayloadSchema>;

// Exigido no modo oficial para outs e ROE — é o que habilita o fechamento
// (ERA, súmula) na fase 2.
export const defenseAttributionSchema = z.object({
  putoutSequence: z.array(fieldingPositionSchema).min(1).optional(), // ex.: [6, 3]
  errors: z.array(z.object({ position: fieldingPositionSchema })).min(1).optional(),
});
export type DefenseAttribution = z.infer<typeof defenseAttributionSchema>;

export const plateAppearanceRecordedPayloadSchema = z.object({
  batterId: z.string().min(1),
  result: paResultSchema,
  battedBall: z.enum(['ground', 'fly', 'line']).optional(),
  defense: defenseAttributionSchema.optional(),
});
export type PlateAppearanceRecordedPayload = z.infer<typeof plateAppearanceRecordedPayloadSchema>;

// `reason` tipado é o que permitirá separar corrida merecida na fase 2 e
// aplicar o teto de 1 base em WP/PB das categorias menores.
export const runnerAdvanceReasonSchema = z.enum([
  'batterAction',
  'stolenBase',
  'wildPitch',
  'passedBall',
  'error',
  'balk',
  'other',
]);
export type RunnerAdvanceReason = z.infer<typeof runnerAdvanceReasonSchema>;

export const runnerAdvancedPayloadSchema = z
  .object({
    runnerId: z.string().min(1),
    from: baseSchema,
    to: advanceTargetSchema, // to: 'home' = corrida
    reason: runnerAdvanceReasonSchema.optional(),
  })
  .refine((p) => p.to === 'home' || p.to > p.from, {
    message: 'runner must advance to a base ahead of `from`',
  });
export type RunnerAdvancedPayload = z.infer<typeof runnerAdvancedPayloadSchema>;

// `stealHomeProhibited`: no Pré-Infantil, tentativa de roubo de home = out
// declarado (o motor aplica pelo perfil).
export const runnerOutPayloadSchema = z.object({
  runnerId: z.string().min(1),
  base: z.union([baseSchema, z.literal('home')]),
  reason: z
    .enum(['caughtStealing', 'pickoff', 'forceOut', 'tagOut', 'stealHomeProhibited', 'other'])
    .optional(),
});
export type RunnerOutPayload = z.infer<typeof runnerOutPayloadSchema>;

const eventEnvelopeShape = {
  // ULID gerado no dispositivo — chave de idempotência do sync.
  id: z.string().min(1),
  gameId: z.string().min(1),
  // Monotônico por jogo no dispositivo do anotador (um único escritor no v1).
  seq: z.number().int().nonnegative(),
  ts: z.iso.datetime({ offset: true, local: true }),
  deviceId: z.string().min(1),
  supersedes: z.string().min(1).optional(),
};

export const gameEventSchema = z.discriminatedUnion('type', [
  z.object({ ...eventEnvelopeShape, type: z.literal('gameCreated'), payload: gameCreatedPayloadSchema }),
  z.object({ ...eventEnvelopeShape, type: z.literal('clockStarted'), payload: clockStartedPayloadSchema }),
  z.object({ ...eventEnvelopeShape, type: z.literal('lineupSet'), payload: lineupSetPayloadSchema }),
  z.object({ ...eventEnvelopeShape, type: z.literal('defensiveChange'), payload: defensiveChangePayloadSchema }),
  z.object({
    ...eventEnvelopeShape,
    type: z.literal('offensiveSubstitution'),
    payload: offensiveSubstitutionPayloadSchema,
  }),
  z.object({ ...eventEnvelopeShape, type: z.literal('courtesyRunnerIn'), payload: courtesyRunnerInPayloadSchema }),
  z.object({ ...eventEnvelopeShape, type: z.literal('halfInningStarted'), payload: halfInningStartedPayloadSchema }),
  z.object({ ...eventEnvelopeShape, type: z.literal('halfInningEnded'), payload: halfInningEndedPayloadSchema }),
  z.object({ ...eventEnvelopeShape, type: z.literal('gameEnded'), payload: gameEndedPayloadSchema }),
  z.object({ ...eventEnvelopeShape, type: z.literal('pitchThrown'), payload: pitchThrownPayloadSchema }),
  z.object({
    ...eventEnvelopeShape,
    type: z.literal('plateAppearanceRecorded'),
    payload: plateAppearanceRecordedPayloadSchema,
  }),
  z.object({ ...eventEnvelopeShape, type: z.literal('runnerAdvanced'), payload: runnerAdvancedPayloadSchema }),
  z.object({ ...eventEnvelopeShape, type: z.literal('runnerOut'), payload: runnerOutPayloadSchema }),
]);

export type GameEvent = z.infer<typeof gameEventSchema>;
export type EventType = GameEvent['type'];
export type GameEventOfType<T extends EventType> = Extract<GameEvent, { type: T }>;

export function parseGameEvent(input: unknown): GameEvent {
  return gameEventSchema.parse(input);
}

/**
 * Resolve o log bruto para a sequência efetiva de eventos:
 *
 * - ordena por `seq` (ordem total — um único escritor por jogo no v1);
 * - aplica correções: um evento com `supersedes` substitui o evento corrigido
 *   NA POSIÇÃO ORIGINAL dele, preservando a ordem do jogo;
 * - cadeias de correção (A ← B ← C) resolvem para o último da cadeia;
 * - um `supersedes` apontando para id desconhecido é tratado como evento
 *   normal (nada a substituir).
 *
 * Todos os derivadores consomem o resultado desta função — eventos
 * substituídos nunca contam para estado ou estatística.
 */
export function effectiveEvents(events: readonly GameEvent[]): GameEvent[] {
  const sorted = [...events].sort((a, b) => a.seq - b.seq);
  const ids = new Set(sorted.map((e) => e.id));
  const supersededBy = new Map<string, GameEvent>();
  for (const event of sorted) {
    if (event.supersedes !== undefined && ids.has(event.supersedes)) {
      supersededBy.set(event.supersedes, event);
    }
  }

  const result: GameEvent[] = [];
  for (const event of sorted) {
    if (event.supersedes !== undefined && ids.has(event.supersedes)) {
      continue; // aparece na posição do evento que corrige
    }
    let current = event;
    const visited = new Set<string>([current.id]);
    while (supersededBy.has(current.id)) {
      current = supersededBy.get(current.id)!;
      if (visited.has(current.id)) {
        throw new Error(`supersedes cycle detected at event ${current.id}`);
      }
      visited.add(current.id);
    }
    result.push(current);
  }
  return result;
}
