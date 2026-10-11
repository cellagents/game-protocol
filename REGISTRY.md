# Protocol 1.0 — namespace registry

Every open-ended name on the wire (entity `kind`, effect `type`,
action `type`, rules key) is tracked here. A name not in this
registry is not part of the protocol.

**Adding a row is a documentation change under forward-compat
rule 5.** A new minor MAY add rows; it MUST NOT remove or retype
them.

Scope column glossary:

- `cell`     — attached to an entity with `kind === 'cell'`.
- `entity`   — attached to any entity.
- `player`   — attached to a `PlayerMeta` entry.
- `world`    — carried on `rules`, affects everyone.

---

## Entity kinds

Entities on the field, keyed by `kind`. Every entity carries both
`mass` (gameplay quantity) and `radius` (geometry); nothing is
derived on the client. Position is `(x, y)` in world coordinates;
optional velocity is `(vx, vy)` in world units / second.

| Kind        | Fields beyond `EntityBase`           | Semantics                                                                 | Since |
|-------------|--------------------------------------|---------------------------------------------------------------------------|-------|
| `cell`      | `owner: string` (player id)          | A player's body. Multiple cells per player after splits. Cell-versus-cell is settled by full enclosure (one cell's centre falls inside the other's radius), not a mass ratio; `rules.eatRatio` applies only to eating `ejected` mass. **Caveat (1.0):** cell ids are derived from `<owner>/<slot>` and change on every split, so they are not stable for the entity's life. A client that correlates cells across ticks should re-key on each tick. The post-1.0 `core` server will promote cell ids to first-class state. | 1.0   |
| `food`      | `hue: number`                        | Static food pellet. Eating grants `mass`.                                 | 1.0   |
| `ejected`   | `hue: number`                        | Mass fired by a player via the `eject` action.                            | 1.0   |
| `virus`     | —                                    | Static hazard. Being touched by a bigger cell pops the cell into pieces.  | 1.0   |

Unknown kinds parse and are preserved on the wire; a 1.0-era
renderer should draw them as a plain circle of `radius`.

---

## Action types

Client → server `action { type, params? }` values the server will
accept for a subscriber. The per-subscriber list is advertised in
`welcome.actions` and may be updated at any time via
`actionsChanged`. Types not in the current list are dropped
silently.

| Type     | Scope   | Params                        | Semantics                                                   | Since |
|----------|---------|-------------------------------|-------------------------------------------------------------|-------|
| `split`  | player  | —                             | Split the subscriber's cells. Capped by `rules.splitLimit`. | 1.0   |
| `eject`  | player  | —                             | Eject `rules.fireFoodMass` of mass as an `ejected` entity.  | 1.0   |

---

## Effect types

Open modifiers attached to an entity or player. `until` is an
absolute tick-time (same base as `Tick.time`); absent means the
effect is permanent until explicitly cleared. `magnitude` and
`params` are the escape hatches so a new effect can ship numbers
or a labelled payload without a wire bump. Unknown effect types
MUST be ignored by clients.

| Type           | Scope  | Params                                        | Semantics                                                                                                                                                      | Since |
|----------------|--------|-----------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------|-------|
| `noMerge`      | cell   | `until` = merge-timer expiry (ms)             | A cell cannot merge back with its sibling cells until `tick.time >= until`. Emitted after a split. Replaces visual-only inference of the server's `timeToMerge`. | 1.0   |
| `invulnerable` | player | `until` = grace expiry (ms, spawn/respawn + 3 s) | The player cannot be eaten, but can still eat others. Emitted during the spawn-grace window and cleared automatically when `tick.time >= until`. The 1.0 server always ships a concrete `until`; schema leaves it optional so a future server can emit an open-ended variant. | 1.0   |

---

## Rule keys

Opaque settings that bots and clients should read instead of
hardcoding. The welcome ships the active bag; `rulesChanged`
replaces it wholesale (never a diff). Clients MUST ignore keys
they do not recognise.

| Key                     | Type    | Scope  | Semantics                                                                   | Since |
|-------------------------|---------|--------|-----------------------------------------------------------------------------|-------|
| `eatRatio`              | number  | world  | Applies only to a cell eating an `ejected` mass pellet: the cell eats it when `cell.mass > ejected.mass * eatRatio`. Cell-versus-cell is settled by full enclosure, not by this ratio. Bots that judge fights against other cells should use geometric overlap, not `eatRatio`. | 1.0   |
| `splitLimit`            | number  | world  | Hard cap on simultaneous cells per player.                                  | 1.0   |
| `defaultPlayerMass`     | number  | world  | Starting mass granted on spawn.                                             | 1.0   |
| `foodMass`              | number  | world  | Mass granted on eating one `food` entity.                                   | 1.0   |
| `fireFoodMass`          | number  | world  | Mass spent and ejected per `eject` action.                                  | 1.0   |
| `maxHeartbeatInterval`  | number  | world  | Idle-kick threshold in ms. Server kicks sockets that go silent for longer. | 1.0   |
| `chatMaxLength`         | number  | world  | Hard cap on `Say.text` length in characters.                                | 1.0   |
| `chatRateHz`            | number  | world  | Per-sender rate ceiling on `say` events; excess dropped silently.           | 1.0   |

Values are serialized as JSON primitives (number, string, boolean);
servers that need composite values should either add new keys or
promote the subject to a dedicated event.
