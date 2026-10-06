// Protocol version identifier. Sent by both sides in the first
// exchange so each can tell what it's talking to.
//
// Rule 1: The server speaks exactly one protocol version per build.
// Rule 2: The client advertises what it would like; server responds
//         with what it will serve or refuses the connection.
// Rule 3: Minor versions ('1.1') are backwards-compatible with the
//         same-major client; major versions are not.

export const PROTOCOL_VERSION = '1.0' as const;
export type ProtocolVersion = typeof PROTOCOL_VERSION;
