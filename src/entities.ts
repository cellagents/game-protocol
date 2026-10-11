// Entities on the game field. Protocol 1.0 ships one flat entity
// list per tick with a `kind` discriminator; everything culled into
// view by the server lands here. Entities are open-shaped: unknown
// kinds parse into the base shape and are preserved so a client
// built against 1.0 can keep running against a 1.1 server that
// adds, say, a 'portal' kind (see forward-compat rules 1 and 3 in
// README.md).
//
// Every entity carries BOTH `mass` and `radius`:
//   mass    gameplay quantity. For food this is the mass gained on
//           eating; for cells and ejected blobs it is the mass
//           carried; for viruses it is the mass threshold a cell
//           must exceed to be popped.
//   radius  geometry (culling, collision, drawing).
//
// The server authoritatively derives one from the other via the
// usual `radius = 4 + 6√mass` relation, but the protocol does not
// make that a constant and the client does not derive one from the
// other; both are always on the wire.

import { z } from 'zod';
import { EffectSchema } from './rules';

/** Shape every entity shares. Open-shaped: unknown fields are
 *  preserved rather than stripped so a 1.1 server can add fields
 *  without a wire bump. */
export const EntityBaseSchema = z.looseObject({
    kind: z.string(),
    /** Server-side counter, stable for the entity's lifetime. */
    id: z.number().int(),
    x: z.number(),
    y: z.number(),
    radius: z.number(),
    mass: z.number(),
    /** Optional velocity in world units per second. 1.0 server does
     *  not emit; movable viruses and projectiles will. */
    vx: z.number().optional(),
    vy: z.number().optional(),
    effects: z.array(EffectSchema).optional()
});
export type EntityBase = z.infer<typeof EntityBaseSchema>;

/** A player's cell on the field. `owner` is the player id (same as
 *  PlayerMeta.id). A player's cells are found by filtering
 *  entities with kind === 'cell' && owner === id.
 *
 *  **Caveat (1.0):** the server derives cell `id` from
 *  `<owner>/<slot>`, so a cell's id changes on every split. The
 *  protocol-level promise of ids stable for the entity's life does
 *  not yet hold for cells; a client that correlates cells across
 *  ticks should re-key on each tick. The post-1.0 `core` server
 *  will promote cell ids to first-class state. */
export const CellSchema = EntityBaseSchema.extend({
    kind: z.literal('cell'),
    owner: z.string()
});
export type Cell = z.infer<typeof CellSchema>;

/** Food pellet. hue is for rendering; the mass gained on eating is
 *  the entity's own `mass`. */
export const FoodSchema = EntityBaseSchema.extend({
    kind: z.literal('food'),
    hue: z.number()
});
export type Food = z.infer<typeof FoodSchema>;

/** Ejected mass blob (the thing a player fires with the eject
 *  action). hue is for rendering; mass is what a cell gains on
 *  eating it. */
export const EjectedSchema = EntityBaseSchema.extend({
    kind: z.literal('ejected'),
    hue: z.number()
});
export type Ejected = z.infer<typeof EjectedSchema>;

/** Virus. mass is the threshold for being eaten + the pop logic. */
export const VirusSchema = EntityBaseSchema.extend({
    kind: z.literal('virus')
});
export type Virus = z.infer<typeof VirusSchema>;

/** Entity kinds this version of the protocol knows about. The
 *  discriminated union below validates these strictly: a `cell`
 *  without `owner` fails rather than silently degrading to the
 *  base shape. Unknown kinds take the fallback path and parse. */
export const KNOWN_ENTITY_KINDS = ['cell', 'food', 'ejected', 'virus'] as const;
export type KnownEntityKind = typeof KNOWN_ENTITY_KINDS[number];
const KNOWN_ENTITY_KIND_SET: ReadonlySet<string> = new Set(KNOWN_ENTITY_KINDS);

/** Fallback shape for forward-compatibility: an entity whose `kind`
 *  is NOT in the known set still parses, which is how a 1.0-era
 *  client renders future kinds. A known kind that fails its strict
 *  shape (e.g. a cell with no owner) does NOT fall through to this;
 *  the refine below rejects known kinds. */
const UnknownKindEntitySchema = EntityBaseSchema.refine(
    (e) => !KNOWN_ENTITY_KIND_SET.has(e.kind),
    { message: 'malformed known-kind entity' }
);

/** The entity union. A client built against 1.0 that meets an
 *  unknown kind parses it as EntityBase and can still cull,
 *  collision-test and ignore-render it. Rendering code switches on
 *  `kind` with a default of "draw a circle of radius `r` in grey"
 *  so new kinds remain visible on screen. */
export const EntitySchema = z.union([
    z.discriminatedUnion('kind', [
        CellSchema,
        FoodSchema,
        EjectedSchema,
        VirusSchema
    ]),
    UnknownKindEntitySchema
]);
export type Entity = z.infer<typeof EntitySchema>;

// -------- Supporting shapes --------------------------------------------------

export const WorldSizeSchema = z.object({
    width: z.number().positive(),
    height: z.number().positive()
});
export type WorldSize = z.infer<typeof WorldSizeSchema>;

export const ScreenSchema = z.object({
    width: z.number().positive(),
    height: z.number().positive()
});
export type Screen = z.infer<typeof ScreenSchema>;
