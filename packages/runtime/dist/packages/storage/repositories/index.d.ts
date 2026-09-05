/**
 * The storage repositories of the TeamDomain sidecar.
 *
 * One facade (`createTeamDomain` / `openTeamDomain` over the injected
 * storage seam) plus the eight store repositories:
 *
 * - `base` — the shared seam boundary (string rows, canonical bytes,
 *   typed seam/validation normalization);
 * - `schema-meta` — per-store schema stamps (L2 of the version policy);
 * - `team-sessions` — TeamSession records, keyed by root session id;
 * - `member-instances` — MemberInstance records, keyed by member
 *   identity key (instance ids unique within a team);
 * - `session-bindings` — session-kind bindings, keyed by session id;
 * - `overrides` — governance overrides, keyed by identity key (agent
 *   autonomy vs human override, never untraceable);
 * - `compatibility` — compatibility states, keyed by root session id;
 * - `operations` — the operation journal (append-only);
 * - `ledger` — the fact ledger with atomic sequence allocation
 *   (append-only, gap-diagnosable).
 *
 * No module in this package imports any host backend: repositories take
 * the `StorageDomainHandle` as an injected parameter, and tests exercise
 * them against the in-memory fake seam in `test/p4-helpers.ts`.
 *
 * @module @dsh-agent-team/storage/repositories
 */
export * from './base.js';
export * from './schema-meta.js';
export * from './team-sessions.js';
export * from './member-instances.js';
export * from './session-bindings.js';
export * from './overrides.js';
export * from './compatibility.js';
export * from './operations.js';
export * from './ledger.js';
export * from './team-domain.js';
//# sourceMappingURL=index.d.ts.map