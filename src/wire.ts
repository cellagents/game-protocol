// Lean entry point for clients that don't need the zod validators.
// Exports the handful of plain-JS constants and the inferred types
// (which are erased at compile time), nothing else.
//
// Browser bundles use this entry so webpack never pulls in zod and
// its ~1 MB of runtime schema code. Server-side consumers and any
// caller that needs runtime validation continue to import from the
// package root ('@cellagents/game-protocol') which exports the full
// schemas.

// Inline the three constants rather than re-exporting from their
// defining modules: a CJS re-export compiles to `require('./events')`
// which transitively pulls zod and the schemas into the client
// bundle, defeating the whole point of this entry point. The
// identical-values test suite in test/wire.identity.js guards
// drift between these literals and the originals.

export const PROTOCOL_VERSION = '1.0' as const;

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

// Re-export the inferred types. These are 100% erased by the TS
// compiler, so they add zero runtime weight. Keep in sync with
// index.ts; a type listed here but missing from the full barrel is
// a mistake.
export type {
    Capability
} from './capabilities';

export type {
    Rules,
    Effect,
    RulesPrimitive
} from './rules';

export type {
    Entity,
    KnownEntityKind
} from './entities';

export type {
    ProtocolProbe,
    Subscribe,
    Welcome,
    Reject
} from './handshake';

export type {
    Tick,
    Leaderboard,
    RulesChanged,
    ActionsChanged,
    Say,
    Message,
    MessageScope,
    PlayerJoin,
    PlayerDisconnect,
    PlayerDied,
    PlayerMeta,
    Kick,
    Heartbeat,
    Action,
    SetFollow,
    WindowResized
} from './events';
