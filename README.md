# @cellagents/game-protocol

The wire contract between a subscriber and the cells-game server.
Protocol version `1.0`. Zod schemas are the ground truth; the
TypeScript types are inferred via `z.infer` so the compiler and the
runtime validator can never disagree.

> **v1.0.0 was re-cut on 2026-10-06 before any external consumer
> existed; the protocol string did not change.**

## Status

Stable for the duration of the archival window. `cells-game` 4.0.x
and `cells-mcp` 2.0.x consume this package as their shared source
of truth; the post-archival `core` / `web` / `mcp` repos will too.

See `REGISTRY.md` for the authoritative list of entity kinds,
action types, effect types and rule keys currently defined.

## Install

```bash
npm install @cellagents/game-protocol
```

or, in the pre-publish era, as a git-tag dependency:

```json
{
    "dependencies": {
        "@cellagents/game-protocol": "github:cellagents/game-protocol#v1.0.0"
    }
}
```

## Shape

```
src/
  version.ts        PROTOCOL_VERSION constant
  capabilities.ts   Capability enum + validCapabilitySet
  rules.ts          Rules bag + Effect modifiers
  entities.ts       EntityBase, Cell, Food, Ejected, Virus, Screen,
                    WorldSize; Entity discriminated union with an
                    unknown-kind fallback
  handshake.ts      Subscribe, Welcome, Reject, ProtocolProbe +
                    parseSubscribe helper, Reject codes
  events.ts         PlayerMeta, Tick, Leaderboard, Say, Message,
                    Action, SetFollow, RulesChanged, ActionsChanged,
                    lifecycle events, ClientEvent / ServerEvent
                    string-constant maps
```

Everything is re-exported from `index.ts`.

## Protocol summary

### Handshake

Client → server, on connect:

```ts
import { PROTOCOL_VERSION } from '@cellagents/game-protocol';

socket.emit('subscribe', {
    protocol: PROTOCOL_VERSION,
    userAgent: 'my-client/0.3+linux',   // mandatory, free content
    capabilities: ['presence', 'steer', 'act', 'chat'],
    name: 'alice',
    screen: { width: 1920, height: 1080 },
    clientId: 'persisted-uuid'          // optional
});
```

Server → client, on acceptance:

```ts
socket.on('welcome', (w) => {
    w.protocol     // protocol version string, matches the subscribe
    w.server       // server identity + version, mandatory free content
    w.sessionId    // this socket's id
    w.clientId     // echoed or minted
    w.world        // { width, height }
    w.capabilities // the GRANTED set
    w.actions      // action types the server will accept
    w.rules        // active rules bag (eatRatio, splitLimit, ...)
    w.self         // own player camera anchor or null
});
```

**Client / server identity.** `subscribe.userAgent` and
`welcome.server` are mandatory free-form strings capped at 128
characters, with recommended (not required) format
`name/semver[+build]`:
`web/4.0.0`, `cells-mcp/2.0.0`, `cells-game/4.0.0`,
`core/0.1.0+rust`. Each side MUST send one; neither side is
required to parse or act on the other's value. Both MUST be
treated as untrusted display data by any consumer (the admin
page MUST escape before rendering).

`userAgent` is the software identity ("what are you"); `clientId`
is the per-instance identity ("which install of yourself", stable
across sessions, max 64 chars). Credentials, when they arrive,
will travel in the Socket.IO handshake `auth` field, never in
subscribe.

On rejection, `reject({ code, message })` is emitted and the
socket is closed.

### Capabilities (grants only)

| Capability   | Grants                                        | Requires   |
|--------------|-----------------------------------------------|------------|
| `presence`   | Embodiment: own cell, eat/eaten, died/respawn, leaderboard presence. Culled around own body. | `name` |
| `steer`      | `heartbeat` movement input                    | `presence` |
| `act`        | `action { type }` events in `welcome.actions` | `presence` |
| `chat`       | `say` messages                                | `presence` |
| `omniscient` | Full-world ticks, unculled                    | —          |
| `follow`     | Observe through another presence; `setFollow` events | — |

Nothing is granted implicitly. The empty capability set is rejected
on subscribe. `presence` combined with `omniscient` or `follow` is a
wall-hack and rejected by the 1.0 server; a future authenticated
admin or teacher role may be granted it without a wire bump.

Legal subscribe sets:

| Set                                     | Role                          |
|-----------------------------------------|-------------------------------|
| `{presence, steer, act, chat}` + name   | player / bot                  |
| `{omniscient}`                          | full-map view                 |
| `{follow}` + target                     | follow view                   |
| `{omniscient, follow}`                  | spectator with toggle         |

The `{omniscient, follow}` spectator can toggle between full map and
following a specific player by emitting `setFollow { target }`
without reconnecting.

### Tick payload

```ts
{
    seq: number,                   // monotonic per server
    time: number,                  // server ms, same base as Effect.until
    self: PlayerMeta | null,       // camera anchor
    players: PlayerMeta[],
    entities: Entity[]
}
```

`entities` is one flat list keyed by `kind`. Cells are entities with
`kind: 'cell'` and `owner: playerId`; find a player's cells by
`entities.filter(e => e.kind === 'cell' && e.owner === p.id)`.

Every entity carries both `mass` (gameplay quantity) and `radius`
(geometry); nothing is derived on the client.

### Actions

```ts
socket.emit('action', { type: 'split' });
socket.emit('action', { type: 'eject' });
```

`type` must be in `welcome.actions`. 1.0 server lists
`['split', 'eject']` for every `act` holder. Unknown types are
dropped silently without disconnect.

The server may replace the subscriber's action list mid-session via
`actionsChanged { actions: string[] }` (full replacement, not a
diff). Mutator-era primitive; 1.0 server emits only if it ever
changes a subscriber's list.

### Rules

The server advertises active rules in `welcome.rules` (opaque bag of
primitives, see `REGISTRY.md` for the keys 1.0 ships). It may
replace the bag mid-session via `rulesChanged { rules }` (full
replacement). Clients MUST ignore keys they do not recognise.

### Death and respawn

A presence subscriber whose cell is eaten receives a `died` event
and keeps receiving ticks with `self: null` (culled around the
last-known position). Emitting `respawn` asks the server to place
the subscriber back into the world; the server answers with a
fresh `welcome` (same shape as on subscribe) and resumes streaming
`self` on tick.

### Messaging

```ts
socket.emit('say', {
    scope: 'all' | 'team' | 'direct',
    to?: string,                    // target PLAYER id, required for direct
    text: string,
    data?: { ... }                  // optional structured payload
});
```

The server stamps `from` from the subscriber record. `team` is
reserved for future gameplay; the 1.0 server drops team messages
silently. `direct` routes to whichever socket currently owns the
target player id.

### HTTP /protocol probe

Dual-mode clients (cells-mcp) check `GET /protocol` before
connecting to decide which wire to speak:

```json
{ "protocol": "1.0", "server": "cells-game/4.0.0" }
```

`server` carries the same `name/semver[+build]` string the server
will later send in `welcome.server`. A pre-1.0 server does not
expose this route; the 404 is the legacy signal.

## Forward-compatibility rules

1. Clients MUST ignore entities whose `kind` they do not know.
2. Clients MUST ignore effect `type`s and `rules` keys they do not
   recognise.
3. Clients MUST NOT validate server payloads with strict schemas.
   The shipped schemas use `z.looseObject` so unknown fields on
   inbound messages are preserved rather than stripped.
4. Servers MUST drop action types they did not list in
   `welcome.actions` and MUST NOT disconnect for them.
5. A MINOR version MAY add kinds, effect types, rule keys, action
   types, events and optional fields. It MUST NOT remove or retype
   anything. Anything else is a MAJOR.

Every open-ended name on the wire (entity `kind`, effect `type`,
action `type`, rule key) lives in `REGISTRY.md`. A name not in the
registry is not part of the protocol; adding one is a documentation
change under rule 5.

## License

MIT.
