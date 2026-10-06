// Event-name string constants and payload schemas for the ongoing
// stream after a successful subscribe. The constants let callers
// avoid string literals so a typo is caught at compile time. All
// server→client payload schemas are loose (looseObject or similar)
// so unknown fields survive — see forward-compat rule 3 in
// README.md.

import { z } from 'zod';
import { EntitySchema } from './entities';
import { EffectSchema, RulesPrimitiveSchema, RulesSchema } from './rules';

// -------- Players ----------------------------------------------------------

/** Per-tick metadata about one player. Replaces the earlier split
 *  between PlayerSnapshot and SelfSnapshot: every player carries
 *  its centroid and the cells live in Tick.entities. */
export const PlayerMetaSchema = z.looseObject({
    id: z.string(),
    name: z.string().nullable(),
    hue: z.number(),
    massTotal: z.number(),
    x: z.number(),
    y: z.number(),
    team: z.string().optional(),
    effects: z.array(EffectSchema).optional()
});
export type PlayerMeta = z.infer<typeof PlayerMetaSchema>;

// -------- Tick --------------------------------------------------------------

/** The periodic world-state fan-out. `self` is the camera anchor:
 *
 *    presence subscriber   → own player; null between death and
 *                            respawn.
 *    follow holder         → followed player if present, else null.
 *                            If the subscriber also has omniscient
 *                            the tick is full-map with self: null;
 *                            otherwise an empty tick.
 *    omniscient-only       → always null (full-map, no anchor).
 */
export const TickSchema = z.looseObject({
    /** Monotonically increasing per server. */
    seq: z.number().int().nonnegative(),
    /** Server-stamped ms timestamp. Same base as Effect.until. */
    time: z.number().int().nonnegative(),
    self: PlayerMetaSchema.nullable(),
    players: z.array(PlayerMetaSchema),
    entities: z.array(EntitySchema)
});
export type Tick = z.infer<typeof TickSchema>;

// -------- Leaderboard ------------------------------------------------------

export const LeaderboardEntrySchema = z.looseObject({
    id: z.string(),
    name: z.string().nullable()
});
export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

export const LeaderboardSchema = z.looseObject({
    players: z.number(),
    leaderboard: z.array(LeaderboardEntrySchema)
});
export type Leaderboard = z.infer<typeof LeaderboardSchema>;

// -------- Rules updates ----------------------------------------------------

/** Full replacement of the active rules bag. Clients MUST replace
 *  their local view wholesale (not merge). 1.0 server never emits. */
export const RulesChangedSchema = z.looseObject({
    rules: RulesSchema
});
export type RulesChanged = z.infer<typeof RulesChangedSchema>;

/** Full replacement of the subscriber's granted action list. Twin
 *  of `rulesChanged`. Lets a mutator grant or revoke an action
 *  mid-session (a timed `dash`, a penalty that removes `split`).
 *  Clients MUST replace their local view wholesale (not merge).
 *  1.0 server emits only if it ever changes a subscriber's list. */
export const ActionsChangedSchema = z.looseObject({
    actions: z.array(z.string())
});
export type ActionsChanged = z.infer<typeof ActionsChangedSchema>;

// -------- Chat and messaging -----------------------------------------------

export const MessageScopeSchema = z.enum(['all', 'team', 'direct']);
export type MessageScope = z.infer<typeof MessageScopeSchema>;

/** Client → server, gated on `chat`. The server stamps the sender
 *  from its subscriber record; a client-supplied `from` field would
 *  be ignored. `data` is a structured payload for bots that want
 *  to exchange machine-readable messages without wedging them into
 *  `text`. Length and rate are capped by `rules.chatMaxLength` and
 *  `rules.chatRateHz` respectively; excess is dropped silently.
 *  For `scope: 'direct'`, `to` is the TARGET PLAYER id (not a
 *  sessionId); the server routes to whichever socket currently
 *  owns that presence. */
export const SaySchema = z.object({
    scope: MessageScopeSchema,
    to: z.string().optional(),
    text: z.string(),
    data: z.record(z.string(), RulesPrimitiveSchema).optional()
}).refine(
    (s) => s.scope !== 'direct' || typeof s.to === 'string' && s.to.length > 0,
    { message: `scope 'direct' requires 'to' player id`, path: ['to'] }
);
export type Say = z.infer<typeof SaySchema>;

/** Server → client. `from.id` points at a player id for a player
 *  message; `from` is null for server / admin broadcasts. `time`
 *  shares its base with `Tick.time` so a receiver can order
 *  messages against ticks. */
export const MessageSchema = z.looseObject({
    from: z.object({ id: z.string(), name: z.string().nullable() }).nullable(),
    scope: MessageScopeSchema,
    text: z.string(),
    data: z.record(z.string(), RulesPrimitiveSchema).optional(),
    time: z.number().int().nonnegative()
});
export type Message = z.infer<typeof MessageSchema>;

// -------- Lifecycle events -------------------------------------------------

export const PlayerJoinSchema = z.looseObject({ name: z.string() });
export type PlayerJoin = z.infer<typeof PlayerJoinSchema>;

export const PlayerDisconnectSchema = z.looseObject({ name: z.string() });
export type PlayerDisconnect = z.infer<typeof PlayerDisconnectSchema>;

export const PlayerDiedSchema = z.looseObject({
    playerEatenName: z.string(),
    killerName: z.string().nullable()
});
export type PlayerDied = z.infer<typeof PlayerDiedSchema>;

export const KickSchema = z.looseObject({ reason: z.string() });
export type Kick = z.infer<typeof KickSchema>;

// -------- Steering + actions -----------------------------------------------

export const HeartbeatSchema = z.object({
    x: z.number(),
    y: z.number()
});
export type Heartbeat = z.infer<typeof HeartbeatSchema>;

export const WindowResizedSchema = z.object({
    width: z.number().positive(),
    height: z.number().positive()
});
export type WindowResized = z.infer<typeof WindowResizedSchema>;

/** Generic client → server action. Gated by the `act` capability
 *  AND `type ∈ welcome.actions`. Types the server didn't list are
 *  dropped silently without disconnect (forward-compat rule 4). */
export const ActionSchema = z.object({
    type: z.string(),
    params: z.record(z.string(), RulesPrimitiveSchema).optional()
});
export type Action = z.infer<typeof ActionSchema>;

/** Client → server follow-target change. Gated on `follow`. `null`
 *  clears the target: the subscriber then receives either full-map
 *  (if it also has omniscient) or empty ticks (otherwise). */
export const SetFollowSchema = z.object({
    target: z.string().nullable()
});
export type SetFollow = z.infer<typeof SetFollowSchema>;

// -------- Event-name constants ---------------------------------------------

/** Client → server event names. */
export const ClientEvent = {
    subscribe: 'subscribe',
    heartbeat: 'heartbeat',
    action: 'action',
    setFollow: 'setFollow',
    respawn: 'respawn',
    pingcheck: 'pingcheck',
    windowResized: 'windowResized',
    say: 'say'
} as const;
export type ClientEventName = typeof ClientEvent[keyof typeof ClientEvent];

/** Server → client event names. */
export const ServerEvent = {
    welcome: 'welcome',
    reject: 'reject',
    tick: 'tick',
    leaderboard: 'leaderboard',
    rulesChanged: 'rulesChanged',
    actionsChanged: 'actionsChanged',
    pongcheck: 'pongcheck',
    kick: 'kick',
    died: 'died',
    playerJoin: 'playerJoin',
    playerDisconnect: 'playerDisconnect',
    playerDied: 'playerDied',
    message: 'message'
} as const;
export type ServerEventName = typeof ServerEvent[keyof typeof ServerEvent];

/** The two built-in action types the 1.0 server always lists in
 *  welcome.actions for an `act` subscriber. */
export const BuiltinActionType = {
    split: 'split',
    eject: 'eject'
} as const;
export type BuiltinActionTypeName = typeof BuiltinActionType[keyof typeof BuiltinActionType];
