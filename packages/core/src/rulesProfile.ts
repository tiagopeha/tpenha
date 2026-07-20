import { z } from 'zod';

// Regra é DADO, não código (docs/regras-cbbs.md). Limites, tempos, nocautes e
// restrições vivem em RulesProfile versionados por torneio/categoria e
// validados por árbitro contra o regulamento vigente. Nunca hardcode um limite.

export const categorySchema = z.enum([
  'tball',
  'preInfantil',
  'infantil',
  'preJunior',
  'junior',
  'juvenil',
  'sub23',
  'adult',
]);
export type Category = z.infer<typeof categorySchema>;

export const mercyRuleSchema = z.object({
  runDiff: z.number().int().positive(),
  fromInning: z.number().int().positive(),
  /** Super Nocaute (ex.: 20 pontos na 2ª) encerra imediatamente, mesmo no meio da entrada. */
  immediate: z.boolean(),
});
export type MercyRule = z.infer<typeof mercyRuleSchema>;

export const rulesProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1), // "CBBS Pré-Infantil 2026 — fase classificatória"
  sport: z.enum(['baseball', 'softball']),
  category: categorySchema,
  scheduledInnings: z.number().int().positive(),
  timeLimit: z
    .object({
      minutes: z.union([z.literal(90), z.literal(100), z.literal(120)]),
      stop: z.enum(['hard', 'noNewInning']),
    })
    .optional(),
  runCapPerInning: z.number().int().positive().optional(),
  mercy: z.array(mercyRuleSchema),
  pitching: z.object({
    style: z.enum(['tee', 'coachPitch', 'kidPitch']),
    dailyPitchLimit: z.number().int().positive().optional(),
    dailyOutLimit: z.number().int().positive().optional(), // Sub-23/Adulto: limite por outs
    warnAt: z.number().int().nonnegative(), // dailyPitchLimit − 5
    reentryBanMargin: z.union([z.literal(6), z.literal(8), z.literal(9)]).optional(),
    twoDayAggregateLimit: z.number().int().positive().optional(), // validar CT-02 vigente
  }),
  // Pré-Infantil: leadOff false, stealHome false (tentativa = OUT declarado),
  // WP/PB além da linha de 10 m ⇒ máx. 1 base.
  running: z.object({
    leadOffAllowed: z.boolean(),
    stealHomeAllowed: z.boolean(),
    wpPbAdvanceCap: z.literal('oneBase').optional(),
  }),
  battingOrder: z.object({
    mode: z.enum(['traditional9', 'continuous']),
    maxSlots: z.number().int().min(9).max(14),
    extraHitter: z.boolean().optional(),
  }),
  tball: z
    .object({
      minHitDistanceM: z.literal(5),
      buntProhibited: z.literal(true),
      infieldFly: z.literal(false),
      deadBallOnReturnToCoach: z.literal(true),
    })
    .optional(),
});
export type RulesProfile = z.infer<typeof rulesProfileSchema>;

export function parseRulesProfile(input: unknown): RulesProfile {
  return rulesProfileSchema.parse(input);
}
