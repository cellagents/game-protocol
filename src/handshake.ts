// Protocol 1.0 handshake. Clients open a socket.io connection and
// emit `subscribe`; the server replies with either `welcome` (and
// then starts streaming `tick`) or `reject` (and disconnects).
//
// Identity: two ids per subscriber.
//
//   clientId   Opaque, caller-chosen, stable across sessions. Max
//              64 chars. The web client persists a UUID in
//              localStorage; cells-mcp generates one per MCP
//              session. Omit on first contact and the server mints
//              one and echoes it back in welcome.
//   sessionId  The socket id for this connection. Changes on every
//              reconnect; useful for admin audit. Direct messages
//              route by PLAYER id, not sessionId — the server
//              resolves a player id to the one socket currently
//              owning that presence.
//
// Credentials: out of scope for 1.0. When they arrive they will
// travel in the socket.io handshake `auth` field (standard
// socket.io path), not in the subscribe payload, and policy will be
// evaluated per principal across sockets.

import { z } from 'zod';
import { PROTOCOL_VERSION } from './version';
import { CapabilitySchema, validCapabilitySet, type Capability } from './capabilities';
import { ScreenSchema, WorldSizeSchema } from './entities';
import { RulesSchema } from './rules';

/** Nickname rules. Any Unicode letter or digit plus underscore,
 *  1..25 chars. Lets non-ASCII names (`Jiří`, `学生01`) through
 *  while still blocking spaces and angle-bracket tags. The server
 *  additionally strips angle-bracket tags before persisting; its
 *  own `validNick` MUST use the same expression so the two never
 *  disagree. */
export const NameSchema = z.string().regex(/^[\p{L}\p{N}_]+$/u).min(1).max(25);

/** Caller-chosen stable identity. Opaque. The server does not
 *  interpret the value; it is used only to tie this socket back to
 *  a persistent handle (localStorage UUID, MCP session id, ...). */
export const ClientIdSchema = z.string().min(1).max(64);

/** Informal client / server identity. Each side sends a short
 *  free-form identifier so logs, the admin subscriber list and
 *  future gated-feature decisions can group them without a wire
 *  bump. Neither side is required to parse the other's value.
 *
 *  Recommended (not required) format: `name/semver[+build]` so
 *  admin audit and metrics can group by name and sort by version.
 *  Examples:
 *    web/4.0.0            cells-mcp/2.0.0
 *    cells-game/4.0.0     core/0.1.0+linux
 *    custom-bot/0.3+rust
 *
 *  Content is free text and MUST be treated as untrusted display
 *  data by any consumer (the admin page MUST escape it before
 *  rendering). Capped at 128 chars to avoid runaway strings. */
export const AgentIdSchema = z.string().min(1).max(128);

export const SubscribeSchema = z.object({
    protocol: z.literal(PROTOCOL_VERSION),
    /** User-agent-like identifier of the client software ("web/4.0.0",
     *  "cells-mcp/2.0.0", "custom-bot/0.3+rust"). Mandatory presence;
     *  content is free. Distinct from `clientId`: `userAgent` is the
     *  software identity ("what are you"), `clientId` is the
     *  per-instance identity ("which install of yourself"). */
    userAgent: AgentIdSchema,
    capabilities: z
        .array(CapabilitySchema)
        .refine(
            (arr) => new Set(arr).size === arr.length,
            { message: 'capabilities must not contain duplicates' }
        ),
    name: NameSchema.optional(),
    screen: ScreenSchema.optional(),
    follow: z.string().optional(),
    clientId: ClientIdSchema.optional()
});
export type Subscribe = z.infer<typeof SubscribeSchema>;

/** Parse + semantically-validate a subscribe payload. Returns either
 *  the typed value or a structured error with the matching reject
 *  code so the server has a single call site for the handshake
 *  decision. */
export function parseSubscribe(raw: unknown):
    | { ok: true; value: Subscribe }
    | { ok: false; code: 'INVALID_PAYLOAD' | 'UNSUPPORTED_PROTOCOL' | 'INVALID_CAPABILITIES' | 'INVALID_NAME'; message: string }
{
    const shape = SubscribeSchema.safeParse(raw);
    if (!shape.success) {
        const issue = shape.error.issues[0];
        if (issue && issue.path.length === 1 && issue.path[0] === 'protocol') {
            return { ok: false, code: 'UNSUPPORTED_PROTOCOL', message: issue.message };
        }
        if (issue && issue.path.length >= 1 && issue.path[0] === 'name') {
            return { ok: false, code: 'INVALID_NAME', message: issue.message };
        }
        return { ok: false, code: 'INVALID_PAYLOAD', message: issue ? issue.message : 'invalid subscribe payload' };
    }
    const parsed = shape.data;
    const combo = validCapabilitySet(new Set<Capability>(parsed.capabilities), parsed);
    if (!combo.ok) {
        const code: 'INVALID_NAME' | 'INVALID_CAPABILITIES' =
            combo.message === 'presence requires name' ? 'INVALID_NAME' : 'INVALID_CAPABILITIES';
        return { ok: false, code, message: combo.message };
    }
    return { ok: true, value: parsed };
}

/** Reject codes. FORBIDDEN is reserved for policy denials from a
 *  future authenticated role layer; 1.0 server never emits it. */
export const RejectCodeSchema = z.enum([
    'UNSUPPORTED_PROTOCOL',
    'INVALID_PAYLOAD',
    'INVALID_CAPABILITIES',
    'INVALID_NAME',
    'FORBIDDEN',
    'SERVER_FULL',
    'NAME_TAKEN'
]);
export type RejectCode = z.infer<typeof RejectCodeSchema>;

/** Reject carries at least a code + message. Loose so a future
 *  server can attach advisory fields (retry-after, policy ref)
 *  without a wire bump. */
export const RejectSchema = z.looseObject({
    code: RejectCodeSchema,
    message: z.string()
});
export type Reject = z.infer<typeof RejectSchema>;

/** Camera-anchor self payload returned on welcome. Non-null iff the
 *  subscriber was granted `presence` (own player) or `follow` with
 *  an initial target that was present at subscribe time. */
export const WelcomeSelfSchema = z.object({
    id: z.string(),
    name: z.string().nullable(),
    hue: z.number()
});
export type WelcomeSelf = z.infer<typeof WelcomeSelfSchema>;

/** Server response to a successful subscribe. The `capabilities`
 *  echo is the GRANTED set, which today always equals the requested
 *  set but may become narrower under a future policy layer.
 *  `actions` lists action types the server will accept from this
 *  subscriber (empty if the caller didn't ask for `act`). `rules`
 *  carries the active gameplay knobs the client needs to read
 *  rather than hardcode. */
export const WelcomeSchema = z.looseObject({
    protocol: z.literal(PROTOCOL_VERSION),
    /** Server's informal identity + version. Semver-like string
     *  (e.g. "cells-game/4.0.0"). Mandatory presence; content is
     *  free. Mirrors `subscribe.client` on the other side. */
    server: AgentIdSchema,
    sessionId: z.string(),
    clientId: z.string(),
    world: WorldSizeSchema,
    capabilities: z.array(CapabilitySchema),
    actions: z.array(z.string()),
    rules: RulesSchema,
    self: WelcomeSelfSchema.nullable()
});
export type Welcome = z.infer<typeof WelcomeSchema>;

/** Response from GET /protocol on the game server. Used by dual-mode
 *  clients (cells-mcp) to decide which wire to speak before opening
 *  a socket. A pre-1.0 server does not expose this route and 404s.
 *  `server` carries the same `name/semver[+build]` string the
 *  server will later send in `welcome.server`; the probe and the
 *  handshake are aligned so a dual-mode client can log and compare
 *  one value. */
export const ProtocolProbeSchema = z.looseObject({
    protocol: z.literal(PROTOCOL_VERSION),
    server: AgentIdSchema
});
export type ProtocolProbe = z.infer<typeof ProtocolProbeSchema>;
