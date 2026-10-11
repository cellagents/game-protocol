// Rules and effects. Rules are the mutable gameplay-wide settings
// a server advertises on welcome and can replace mid-session via
// `rulesChanged`. Effects are temporary modifiers attached to a
// specific entity or player. Both are intentionally open: unknown
// rule keys and unknown effect types MUST be ignored by clients
// (see forward-compat rule 2 in README.md).
//
// The 1.0 server emits two effects, `invulnerable` (player, during
// the 3 s spawn-grace window) and `noMerge` (cell, after a split
// until the merge timer expires). Rules are static in 1.0: the bag
// shipped on `welcome.rules` matches the one in REGISTRY.md and the
// server does not emit `rulesChanged`. The shape stays open so a
// future minor can introduce mutators without a wire bump.

import { z } from 'zod';

/** Primitive values allowed inside an Effect's params and inside
 *  Rules. Keeps the schema trivially JSON-encodable and keeps bots
 *  from reaching for arbitrary structures over the wire. */
export const RulesPrimitiveSchema = z.union([
    z.number(),
    z.string(),
    z.boolean()
]);
export type RulesPrimitive = z.infer<typeof RulesPrimitiveSchema>;

/** The open rules bag advertised on `welcome.rules` and replaced
 *  in-flight by `rulesChanged`. Minimum keys expected in 1.0:
 *
 *    eatRatio             cell eats an ejected mass pellet when
 *                         cell.mass > ejected.mass * eatRatio;
 *                         cell-vs-cell is full enclosure, not this ratio
 *    splitLimit           max cells per player
 *    defaultPlayerMass    spawn mass
 *    foodMass             mass granted when eating one food
 *    fireFoodMass         mass ejected per `eject` action
 *    maxHeartbeatInterval idle-kick threshold, ms
 *    chatMaxLength        character cap on `say.text`
 *    chatRateHz           server-side say rate cap per sender
 *
 *  Clients MUST ignore keys they do not recognise.
 */
export const RulesSchema = z.record(z.string(), RulesPrimitiveSchema);
export type Rules = z.infer<typeof RulesSchema>;

/** Modifier on an entity or player. `type` is open: unknown types
 *  MUST be ignored. `until` is an absolute tick-time (same base as
 *  `Tick.time`) at which the effect expires; absent means permanent
 *  until explicitly cleared. `magnitude` and `params` are the two
 *  escape hatches so a new effect kind can ship numbers (speed
 *  multiplier) or a labelled payload (team id, charge count) without
 *  a wire bump. */
export const EffectSchema = z.looseObject({
    type: z.string(),
    until: z.number().optional(),
    magnitude: z.number().optional(),
    params: z.record(z.string(), RulesPrimitiveSchema).optional()
});
export type Effect = z.infer<typeof EffectSchema>;
