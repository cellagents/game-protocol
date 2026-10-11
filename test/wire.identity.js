// Guards against drift between the lean `/wire` subpath entry and
// the full `.` entry. `/wire` inlines the constant literals so a
// client bundle never requires('./events') (which would pull in
// zod and the schemas). If someone adds or renames a client event
// without updating wire.ts, this test fails loudly.

const { expect } = require('chai');
const full = require('../dist/index');
const wire = require('../dist/wire');

describe('wire.ts — identity with full entry', () => {
    it('PROTOCOL_VERSION matches', () => {
        expect(wire.PROTOCOL_VERSION).to.equal(full.PROTOCOL_VERSION);
    });

    it('ClientEvent has identical entries', () => {
        expect(wire.ClientEvent).to.deep.equal(full.ClientEvent);
    });

    it('ServerEvent has identical entries', () => {
        expect(wire.ServerEvent).to.deep.equal(full.ServerEvent);
    });
});
