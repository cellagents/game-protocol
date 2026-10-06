// @cellagents/game-protocol — the wire contract between a subscriber
// and the cells-game server. Zod is the ground truth; TypeScript
// types are inferred via z.infer so the compiler and the runtime
// validator can never disagree.
//
// Forward-compatibility rules (enforced throughout):
//
//   1. Clients MUST ignore entities whose `kind` they do not know.
//      The Entity union keeps an EntityBase fallback for exactly
//      this purpose: an unknown kind parses, is preserved, and
//      renders by whatever default the client picks.
//
//   2. Clients MUST ignore effect `type`s and `rules` keys they do
//      not recognise.
//
//   3. Clients MUST NOT validate server payloads with strict
//      schemas. The schemas in this package use `z.looseObject`
//      (or equivalent) so unknown fields on inbound messages
//      survive and are preserved on the parsed value.
//
//   4. Servers MUST drop action types they did not list in
//      `welcome.actions` and MUST NOT disconnect for them. Same
//      posture as "steer-channel event without steer": silently
//      ignored, no socket close.
//
//   5. A MINOR version MAY add kinds, effect types, rule keys,
//      action types, events and optional fields. It MUST NOT remove
//      or retype anything. Anything else is a MAJOR.
//
// Every open-ended name on the wire (entity `kind`, effect `type`,
// action `type`, rules key) lives in REGISTRY.md. A name not in
// the registry is not part of the protocol; adding one is a
// documentation change under rule 5.

export * from './version';
export * from './capabilities';
export * from './rules';
export * from './entities';
export * from './handshake';
export * from './events';
