// Capability flags a subscriber can hold. Each flag grants something;
// nothing is granted implicitly. The empty set has no observation
// right (would see nothing worth sending) and is rejected on
// subscribe. Omniscient / wall-hack combinations are rejected by
// the 1.0 server; an authenticated admin or teacher role in a future
// minor can be granted them without a wire bump.
//
// Grammar matrix:
//
//   presence     Embodiment: a cell is spawned, you can eat and be
//                eaten, `died` + `respawn` apply, name is set,
//                leaderboard and join/leave events reference you.
//                Observation is culled by server policy around your
//                body. Requires `name`.
//   steer        Movement input for your presence via `heartbeat`.
//                Requires `presence`.
//   act          May send `action { type }` events; the accepted
//                types are listed per subscriber in
//                `welcome.actions`. Requires `presence`.
//   chat         May send `say` messages. Requires `presence`.
//   omniscient   Receive the whole world, unculled.
//   follow       Observe through another presence's perception. May
//                change the target via `setFollow` events.

import { z } from 'zod';

export const CapabilitySchema = z.enum([
    'presence',
    'steer',
    'act',
    'chat',
    'omniscient',
    'follow'
]);
export type Capability = z.infer<typeof CapabilitySchema>;

/** Shape of the payload fields the validator inspects. The real
 *  Subscribe type (defined in handshake.ts) satisfies this
 *  structurally; keeping it local here avoids a type cycle. */
interface CapabilityPayload {
    name?: string;
    screen?: { width: number; height: number };
    follow?: string;
}

/** Validates a capability combination plus its matching required /
 *  disallowed fields. Returns a discriminated result so the server
 *  can surface a tight reject message instead of a generic one.
 *
 *  Legal sets and their resulting roles:
 *
 *    {presence, steer, act, chat}  + name              player / bot
 *    {omniscient}                                      full-map view
 *    {follow} (target optional)                        follow view
 *    {omniscient, follow}                              spectator with toggle
 *
 *  Conflicts rejected:
 *    - presence with omniscient (wall-hack via own body)
 *    - presence with follow (wall-hack via followed body)
 *    - steer / act / chat without presence
 *    - the empty set (nothing to observe through)
 *    - name without presence (lie)
 *    - screen without presence (meaningless)
 */
export function validCapabilitySet(
    caps: Set<Capability>,
    payload: CapabilityPayload
): { ok: true } | { ok: false; message: string } {
    const has = (c: Capability) => caps.has(c);

    if (caps.size === 0) {
        return { ok: false, message: 'empty capability set is not observing anything' };
    }

    // Steer / act / chat all require presence.
    for (const dependent of ['steer', 'act', 'chat'] as const) {
        if (has(dependent) && !has('presence')) {
            return { ok: false, message: `${dependent} requires presence` };
        }
    }

    // Presence requires a name; nothing else does.
    if (has('presence') && !payload.name) {
        return { ok: false, message: 'presence requires name' };
    }
    if (!has('presence') && payload.name) {
        return { ok: false, message: 'name requires presence' };
    }

    // screen is a hint to the server's presence-culling policy; it
    // can only narrow, never widen. It is only meaningful when the
    // subscriber has a body.
    if (!has('presence') && payload.screen) {
        return { ok: false, message: 'screen requires presence' };
    }

    // Wall-hack conflicts: a presence subscriber cannot also observe
    // the whole world or through someone else.
    if (has('presence') && has('omniscient')) {
        return { ok: false, message: 'presence conflicts with omniscient' };
    }
    if (has('presence') && has('follow')) {
        return { ok: false, message: 'presence conflicts with follow' };
    }

    // `follow` target is optional; set via `setFollow` later. But a
    // subscriber without `follow` MUST NOT carry one.
    if (!has('follow') && payload.follow) {
        return { ok: false, message: 'follow target requires follow capability' };
    }

    return { ok: true };
}
