// Protocol-shape unit tests for the published @cellagents/game-protocol
// package. Exercises parseSubscribe over the capability grammar and
// the Tick schema's forward-compatibility promises.

const { expect } = require('chai');
const protocol = require('../dist');

describe('protocol 1.0 — parseSubscribe (capability grammar)', () => {
    const base = (over) => Object.assign(
        { protocol: '1.0', userAgent: 'test-suite/1.0', capabilities: [] },
        over
    );

    // -------- Legal sets ---------------------------------------------------

    it('accepts a player (presence + steer + act + chat)', () => {
        const r = protocol.parseSubscribe(base({
            capabilities: ['presence', 'steer', 'act', 'chat'],
            name: 'alice',
            screen: { width: 1920, height: 1080 }
        }));
        expect(r.ok).to.be.true;
    });

    it('accepts a bot (presence + steer + act) without chat', () => {
        const r = protocol.parseSubscribe(base({
            capabilities: ['presence', 'steer', 'act'],
            name: 'cells_mcp_bot',
            screen: { width: 1920, height: 1920 }
        }));
        expect(r.ok).to.be.true;
    });

    it('accepts an omniscient-only view', () => {
        const r = protocol.parseSubscribe(base({ capabilities: ['omniscient'] }));
        expect(r.ok).to.be.true;
    });

    it('accepts a follow-only view with no initial target', () => {
        const r = protocol.parseSubscribe(base({ capabilities: ['follow'] }));
        expect(r.ok).to.be.true;
    });

    it('accepts a follow-only view with an initial target', () => {
        const r = protocol.parseSubscribe(base({
            capabilities: ['follow'],
            follow: 'target-player-id'
        }));
        expect(r.ok).to.be.true;
    });

    it('accepts a spectator with view toggle (omniscient + follow)', () => {
        const r = protocol.parseSubscribe(base({
            capabilities: ['omniscient', 'follow']
        }));
        expect(r.ok).to.be.true;
    });

    // -------- Conflicts ----------------------------------------------------

    it('rejects an empty capability set with INVALID_CAPABILITIES', () => {
        const r = protocol.parseSubscribe(base({ capabilities: [] }));
        expect(r.ok).to.be.false;
        expect(r.code).to.equal('INVALID_CAPABILITIES');
    });

    it('rejects an unknown protocol version with UNSUPPORTED_PROTOCOL', () => {
        const r = protocol.parseSubscribe({ protocol: '9.9', capabilities: ['omniscient'] });
        expect(r.ok).to.be.false;
        expect(r.code).to.equal('UNSUPPORTED_PROTOCOL');
    });

    it('rejects steer without presence', () => {
        const r = protocol.parseSubscribe(base({ capabilities: ['steer'] }));
        expect(r.ok).to.be.false;
        expect(r.code).to.equal('INVALID_CAPABILITIES');
    });

    it('rejects act without presence', () => {
        const r = protocol.parseSubscribe(base({ capabilities: ['act'] }));
        expect(r.ok).to.be.false;
        expect(r.code).to.equal('INVALID_CAPABILITIES');
    });

    it('rejects chat without presence', () => {
        const r = protocol.parseSubscribe(base({ capabilities: ['chat'] }));
        expect(r.ok).to.be.false;
        expect(r.code).to.equal('INVALID_CAPABILITIES');
    });

    it('rejects presence without name with INVALID_NAME', () => {
        const r = protocol.parseSubscribe(base({
            capabilities: ['presence', 'steer', 'act', 'chat'],
            screen: { width: 800, height: 600 }
        }));
        expect(r.ok).to.be.false;
        expect(r.code).to.equal('INVALID_NAME');
    });

    it('rejects presence combined with omniscient (wall-hack)', () => {
        const r = protocol.parseSubscribe(base({
            capabilities: ['presence', 'steer', 'omniscient'],
            name: 'cheater',
            screen: { width: 800, height: 600 }
        }));
        expect(r.ok).to.be.false;
        expect(r.code).to.equal('INVALID_CAPABILITIES');
    });

    it('rejects presence combined with follow (wall-hack)', () => {
        const r = protocol.parseSubscribe(base({
            capabilities: ['presence', 'steer', 'follow'],
            name: 'cheater',
            screen: { width: 800, height: 600 }
        }));
        expect(r.ok).to.be.false;
        expect(r.code).to.equal('INVALID_CAPABILITIES');
    });

    it('rejects name without presence', () => {
        const r = protocol.parseSubscribe(base({
            capabilities: ['omniscient'],
            name: 'liar'
        }));
        expect(r.ok).to.be.false;
        expect(r.code).to.equal('INVALID_CAPABILITIES');
    });

    it('rejects screen without presence', () => {
        const r = protocol.parseSubscribe(base({
            capabilities: ['omniscient'],
            screen: { width: 800, height: 600 }
        }));
        expect(r.ok).to.be.false;
        expect(r.code).to.equal('INVALID_CAPABILITIES');
    });

    it('rejects follow target without follow capability', () => {
        const r = protocol.parseSubscribe(base({
            capabilities: ['omniscient'],
            follow: 'target'
        }));
        expect(r.ok).to.be.false;
        expect(r.code).to.equal('INVALID_CAPABILITIES');
    });

    it('rejects a bad nickname with INVALID_NAME', () => {
        const r = protocol.parseSubscribe(base({
            capabilities: ['presence', 'steer', 'act', 'chat'],
            name: 'has space',
            screen: { width: 800, height: 600 }
        }));
        expect(r.ok).to.be.false;
        expect(r.code).to.equal('INVALID_NAME');
    });

    it('rejects duplicate capabilities', () => {
        const r = protocol.parseSubscribe({
            protocol: '1.0',
            capabilities: ['omniscient', 'omniscient']
        });
        expect(r.ok).to.be.false;
        expect(r.code).to.equal('INVALID_PAYLOAD');
    });

    // -------- clientId ------------------------------------------------------

    it('accepts a 64-char clientId', () => {
        const r = protocol.parseSubscribe(base({
            capabilities: ['omniscient'],
            clientId: 'a'.repeat(64)
        }));
        expect(r.ok).to.be.true;
    });

    it('rejects a clientId longer than 64 chars', () => {
        const r = protocol.parseSubscribe(base({
            capabilities: ['omniscient'],
            clientId: 'a'.repeat(65)
        }));
        expect(r.ok).to.be.false;
        expect(r.code).to.equal('INVALID_PAYLOAD');
    });

    // -------- userAgent (mandatory client identity) ----------------------

    it('rejects a subscribe missing the userAgent identity', () => {
        const r = protocol.parseSubscribe({
            protocol: '1.0',
            capabilities: ['omniscient']
        });
        expect(r.ok).to.be.false;
        expect(r.code).to.equal('INVALID_PAYLOAD');
    });

    it('rejects an empty userAgent string', () => {
        const r = protocol.parseSubscribe({
            protocol: '1.0',
            userAgent: '',
            capabilities: ['omniscient']
        });
        expect(r.ok).to.be.false;
        expect(r.code).to.equal('INVALID_PAYLOAD');
    });

    it('rejects a userAgent longer than 128 chars', () => {
        const r = protocol.parseSubscribe({
            protocol: '1.0',
            userAgent: 'x'.repeat(129),
            capabilities: ['omniscient']
        });
        expect(r.ok).to.be.false;
        expect(r.code).to.equal('INVALID_PAYLOAD');
    });

    it('accepts a 128-char userAgent', () => {
        const r = protocol.parseSubscribe({
            protocol: '1.0',
            userAgent: 'x'.repeat(128),
            capabilities: ['omniscient']
        });
        expect(r.ok).to.be.true;
    });

    // -------- Nickname — Unicode acceptance ------------------------------

    it('accepts a Unicode nickname (diacritics + non-ASCII script)', () => {
        const r1 = protocol.parseSubscribe(base({
            capabilities: ['presence', 'steer', 'act', 'chat'],
            name: 'Jiří',
            screen: { width: 800, height: 600 }
        }));
        expect(r1.ok).to.be.true;
        const r2 = protocol.parseSubscribe(base({
            capabilities: ['presence', 'steer', 'act', 'chat'],
            name: '学生01',
            screen: { width: 800, height: 600 }
        }));
        expect(r2.ok).to.be.true;
    });

    it('still rejects a name with a space (not a letter / digit / underscore)', () => {
        const r = protocol.parseSubscribe(base({
            capabilities: ['presence', 'steer', 'act', 'chat'],
            name: 'has space',
            screen: { width: 800, height: 600 }
        }));
        expect(r.ok).to.be.false;
        expect(r.code).to.equal('INVALID_NAME');
    });
});

describe('protocol 1.0 — TickSchema (forward-compat)', () => {
    const sampleTick = (entities, extra = {}) => Object.assign({
        seq: 1,
        time: 1_000_000,
        self: null,
        players: [],
        entities
    }, extra);

    const baseEntity = (over) => Object.assign({
        kind: 'food',
        id: 42,
        x: 10,
        y: 20,
        radius: 4,
        mass: 2,
        hue: 180
    }, over);

    it('accepts a tick with known entity kinds and preserves fields', () => {
        const r = protocol.TickSchema.safeParse(sampleTick([
            baseEntity({}),
            { kind: 'virus', id: 1, x: 0, y: 0, radius: 60, mass: 100 }
        ]));
        expect(r.success).to.be.true;
        expect(r.data.entities).to.have.length(2);
    });

    it('accepts a tick with an unknown entity kind and keeps it (forward-compat)', () => {
        const r = protocol.TickSchema.safeParse(sampleTick([
            { kind: 'portal', id: 99, x: 500, y: 500, radius: 20, mass: 0, exits_to: 'realm-7' }
        ]));
        expect(r.success).to.be.true;
        const [ent] = r.data.entities;
        expect(ent.kind).to.equal('portal');
        expect(ent.exits_to).to.equal('realm-7');
    });

    it('accepts an entity carrying an unknown effect type', () => {
        const r = protocol.TickSchema.safeParse(sampleTick([
            {
                kind: 'cell', id: 1, x: 0, y: 0, radius: 10, mass: 25, owner: 'p1',
                effects: [{ type: 'rainbow_boost', magnitude: 1.4, params: { color: 'red' } }]
            }
        ]));
        expect(r.success).to.be.true;
        expect(r.data.entities[0].effects[0].type).to.equal('rainbow_boost');
    });

    it('preserves unknown top-level tick fields', () => {
        const r = protocol.TickSchema.safeParse(sampleTick([], { futureMetric: 7 }));
        expect(r.success).to.be.true;
        expect(r.data.futureMetric).to.equal(7);
    });

    it('rejects an entity missing mass', () => {
        const r = protocol.TickSchema.safeParse(sampleTick([
            { kind: 'food', id: 1, x: 0, y: 0, radius: 4, hue: 180 }
        ]));
        expect(r.success).to.be.false;
    });

    it('rejects an entity missing radius', () => {
        const r = protocol.TickSchema.safeParse(sampleTick([
            { kind: 'food', id: 1, x: 0, y: 0, mass: 2, hue: 180 }
        ]));
        expect(r.success).to.be.false;
    });

    it('rejects an entity missing an id', () => {
        const r = protocol.TickSchema.safeParse(sampleTick([
            { kind: 'food', x: 0, y: 0, radius: 4, mass: 2, hue: 180 }
        ]));
        expect(r.success).to.be.false;
    });
});

describe('protocol 1.0 — Welcome / Rules', () => {
    const sampleWelcome = (over = {}) => Object.assign({
        protocol: '1.0',
        server: 'cells-game/4.0.0',
        sessionId: 'abc',
        clientId: 'xyz',
        world: { width: 5000, height: 5000 },
        capabilities: ['omniscient'],
        actions: [],
        rules: {
            eatRatio: 1.1,
            splitLimit: 16,
            defaultPlayerMass: 10,
            foodMass: 1,
            fireFoodMass: 20,
            maxHeartbeatInterval: 5000,
            chatMaxLength: 200,
            chatRateHz: 2
        },
        self: null
    }, over);

    it('accepts a welcome with an opaque rules bag of primitives', () => {
        const r = protocol.WelcomeSchema.safeParse(sampleWelcome());
        expect(r.success).to.be.true;
    });

    it('rejects a welcome missing the server identity', () => {
        const w = sampleWelcome();
        delete w.server;
        const r = protocol.WelcomeSchema.safeParse(w);
        expect(r.success).to.be.false;
    });

    it('rejects a welcome with an empty server identity', () => {
        const r = protocol.WelcomeSchema.safeParse(sampleWelcome({ server: '' }));
        expect(r.success).to.be.false;
    });

    it('rejects a welcome with a server identity longer than 128 chars', () => {
        const r = protocol.WelcomeSchema.safeParse(sampleWelcome({ server: 'x'.repeat(129) }));
        expect(r.success).to.be.false;
    });

    it('preserves unknown welcome fields (forward-compat)', () => {
        const w = sampleWelcome({ experimentalFeature: 'tango' });
        const r = protocol.WelcomeSchema.safeParse(w);
        expect(r.success).to.be.true;
        expect(r.data.experimentalFeature).to.equal('tango');
    });

    it('preserves unknown reject fields (forward-compat)', () => {
        const r = protocol.RejectSchema.safeParse({
            code: 'FORBIDDEN',
            message: 'policy says no',
            retryAfterMs: 5000
        });
        expect(r.success).to.be.true;
        expect(r.data.retryAfterMs).to.equal(5000);
    });
});

describe('protocol 1.0 — EntitySchema (discriminated union + fallback)', () => {
    it('rejects a malformed known kind (cell without owner)', () => {
        const r = protocol.EntitySchema.safeParse({
            kind: 'cell', id: 1, x: 0, y: 0, mass: 10, radius: 4
        });
        expect(r.success).to.be.false;
    });

    it('rejects a malformed known kind (food without hue)', () => {
        const r = protocol.EntitySchema.safeParse({
            kind: 'food', id: 1, x: 0, y: 0, mass: 2, radius: 4
        });
        expect(r.success).to.be.false;
    });

    it('accepts an unknown kind via the fallback and preserves fields', () => {
        const r = protocol.EntitySchema.safeParse({
            kind: 'portal', id: 7, x: 100, y: 100, mass: 1, radius: 20, destination: 'nebula-3'
        });
        expect(r.success).to.be.true;
        expect(r.data.destination).to.equal('nebula-3');
    });
});

describe('protocol 1.0 — SaySchema (direct scope)', () => {
    it('accepts direct scope with a to field', () => {
        const r = protocol.SaySchema.safeParse({ scope: 'direct', to: 'player-id', text: 'hi' });
        expect(r.success).to.be.true;
    });

    it('rejects direct scope without a to field', () => {
        const r = protocol.SaySchema.safeParse({ scope: 'direct', text: 'hi' });
        expect(r.success).to.be.false;
    });

    it('accepts all scope without a to field', () => {
        const r = protocol.SaySchema.safeParse({ scope: 'all', text: 'hello' });
        expect(r.success).to.be.true;
    });

    it('accepts team scope without a to field', () => {
        const r = protocol.SaySchema.safeParse({ scope: 'team', text: 'team' });
        expect(r.success).to.be.true;
    });
});

describe('protocol 1.0 — ActionsChanged / ProtocolProbe', () => {
    it('accepts an actionsChanged payload with an array of strings', () => {
        const r = protocol.ActionsChangedSchema.safeParse({
            actions: ['split', 'eject', 'dash']
        });
        expect(r.success).to.be.true;
    });

    it('rejects actionsChanged without the actions array', () => {
        const r = protocol.ActionsChangedSchema.safeParse({});
        expect(r.success).to.be.false;
    });

    it('accepts the probe shape { protocol, server }', () => {
        const r = protocol.ProtocolProbeSchema.safeParse({
            protocol: '1.0',
            server: 'cells-game/4.0.0'
        });
        expect(r.success).to.be.true;
    });

    it('preserves unknown probe fields', () => {
        const r = protocol.ProtocolProbeSchema.safeParse({
            protocol: '1.0',
            server: 'cells-game/4.0.0',
            motd: 'back soon'
        });
        expect(r.success).to.be.true;
        expect(r.data.motd).to.equal('back soon');
    });
});
