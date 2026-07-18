import { z } from 'zod';

// Modelo de eventos do jogo — ver docs/modelo-de-eventos.md.
// Só o jogo ao vivo é event-sourced; eventos são imutáveis e append-only.
// Correção = novo evento com `supersedes`; nunca editar ou apagar.

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
  'sacBunt',
  'sacFly',
]);
export type PAResult = z.infer<typeof paResultSchema>;

export const baseSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type Base = z.infer<typeof baseSchema>;

export const advanceTargetSchema = z.union([z.literal(2), z.literal(3), z.literal('home')]);
export type AdvanceTarget = z.infer<typeof advanceTargetSchema>;

export const halfSchema = z.enum(['top', 'bottom']);
export type Half = z.infer<typeof halfSchema>;

export const gameCreatedPayloadSchema = z.object({
  sport: z.enum(['baseball', 'softball']),
  category: z.string().min(1),
  rulesProfileId: z.string().min(1),
  scheduledInnings: z.number().int().positive(),
  // Adversário é SEMPRE texto livre — nunca exigir que exista na plataforma.
  opponentName: z.string().min(1),
  home: z.boolean(),
});
export type GameCreatedPayload = z.infer<typeof gameCreatedPayloadSchema>;

// Posição como string ('P', 'C', '1B', 'SS'…): o nº de defensores varia por
// categoria e modalidade, então o core não restringe o conjunto. A derivação
// de arremessador só depende de 'P'.
export const lineupEntrySchema = z.object({
  playerId: z.string().min(1),
  battingSlot: z.number().int().positive(),
  position: z.string().min(1),
});
export type LineupEntry = z.infer<typeof lineupEntrySchema>;

export const lineupSetPayloadSchema = z.object({
  entries: z.array(lineupEntrySchema).min(1),
});
export type LineupSetPayload = z.infer<typeof lineupSetPayloadSchema>;

export const substitutionMadePayloadSchema = z.object({
  outPlayerId: z.string().min(1),
  inPlayerId: z.string().min(1),
  battingSlot: z.number().int().positive(),
  position: z.string().min(1),
});
export type SubstitutionMadePayload = z.infer<typeof substitutionMadePayloadSchema>;

export const halfInningStartedPayloadSchema = z.object({
  inning: z.number().int().positive(),
  half: halfSchema,
});
export type HalfInningStartedPayload = z.infer<typeof halfInningStartedPayloadSchema>;

export const gameEndedPayloadSchema = z.object({
  reason: z.enum(['regulation', 'mercyRule', 'walkOff', 'forfeit', 'other']),
});
export type GameEndedPayload = z.infer<typeof gameEndedPayloadSchema>;

export const plateAppearanceRecordedPayloadSchema = z.object({
  batterId: z.string().min(1),
  result: paResultSchema,
  battedBall: z.enum(['ground', 'fly', 'line']).optional(),
});
export type PlateAppearanceRecordedPayload = z.infer<typeof plateAppearanceRecordedPayloadSchema>;

export const runnerAdvancedPayloadSchema = z
  .object({
    runnerId: z.string().min(1),
    from: baseSchema,
    to: advanceTargetSchema,
  })
  .refine((p) => p.to === 'home' || p.to > p.from, {
    message: 'runner must advance to a base ahead of `from`',
  });
export type RunnerAdvancedPayload = z.infer<typeof runnerAdvancedPayloadSchema>;

export const runnerOutPayloadSchema = z.object({
  runnerId: z.string().min(1),
  base: z.union([baseSchema, z.literal('home')]),
  reason: z.enum(['caughtStealing', 'pickoff', 'forceOut', 'tagOut', 'other']).optional(),
});
export type RunnerOutPayload = z.infer<typeof runnerOutPayloadSchema>;

export const stolenBasePayloadSchema = z.object({
  runnerId: z.string().min(1),
  to: advanceTargetSchema,
});
export type StolenBasePayload = z.infer<typeof stolenBasePayloadSchema>;

// Granularidade opcional — decisão pendente da questão nº 2 da spec.
export const pitchThrownPayloadSchema = z.object({
  pitcherId: z.string().min(1),
  call: z.enum(['ball', 'strikeSwinging', 'strikeLooking', 'foul', 'inPlay']),
});
export type PitchThrownPayload = z.infer<typeof pitchThrownPayloadSchema>;

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
  z.object({ ...eventEnvelopeShape, type: z.literal('lineupSet'), payload: lineupSetPayloadSchema }),
  z.object({ ...eventEnvelopeShape, type: z.literal('substitutionMade'), payload: substitutionMadePayloadSchema }),
  z.object({ ...eventEnvelopeShape, type: z.literal('halfInningStarted'), payload: halfInningStartedPayloadSchema }),
  z.object({ ...eventEnvelopeShape, type: z.literal('gameEnded'), payload: gameEndedPayloadSchema }),
  z.object({
    ...eventEnvelopeShape,
    type: z.literal('plateAppearanceRecorded'),
    payload: plateAppearanceRecordedPayloadSchema,
  }),
  z.object({ ...eventEnvelopeShape, type: z.literal('runnerAdvanced'), payload: runnerAdvancedPayloadSchema }),
  z.object({ ...eventEnvelopeShape, type: z.literal('runnerOut'), payload: runnerOutPayloadSchema }),
  z.object({ ...eventEnvelopeShape, type: z.literal('stolenBase'), payload: stolenBasePayloadSchema }),
  z.object({ ...eventEnvelopeShape, type: z.literal('pitchThrown'), payload: pitchThrownPayloadSchema }),
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
