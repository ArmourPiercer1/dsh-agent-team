/**
 * P7-T7 — legacy Team Session read-only reader: the operational core.
 *
 * One entry point ({@link inspectLegacyTeam}) plus the dispatch surface
 * ({@link dispatchReaderAction}) that makes the read-only mandate a typed
 * guarantee: every non-`inspect` action routed through the surface throws
 * `LEGACY_READER_MUTATION_REJECTED`. The module performs NO mutation of the
 * inspected home — the injected port has no write surface, and the reader
 * itself never calls beyond `listDir`/`readFile`.
 *
 * Detection rule (DevPlan §20.6, best-effort): the home degrades to the
 * native Chat/Trajectory view iff it carries NO roster members AND no
 * session log with legacy Team events in its own suffix. Everything else
 * surfaces as a legacy view with per-field degradation.
 *
 * Leader selection (frozen-fork projection semantics, best-effort): the
 * legacy bound-teammate mark (the member-bound event in a session's own
 * suffix) identifies member sessions; a leader is an UNBOUND session that
 * still carries Team facts. Among candidates: most Team events first (the
 * leader's log accumulates the team's coordination traffic), then earliest
 * `createdAt` (missing last), then id — deterministic.
 *
 * @module @dsh-agent-team/legacy/session-reader/inspect
 */
import type { LegacyHomePort, LegacyTeamInspection } from './types.js';
/**
 * Inspect one legacy DSH home for Team Session metadata (READ-ONLY).
 *
 * This is the ONLY operational entry of the reader. It never writes,
 * mutates, resumes, or restores anything in the inspected home: the port
 * surface has no write method, and the result is a frozen plain-JSON view.
 *
 * Degradation (required behavior, DevPlan §20.6): a home with no roster
 * members and no session log carrying legacy Team events in its own suffix
 * yields the native Chat/Trajectory fallback view — the legacy metadata
 * simply is not there, and that is not an error.
 *
 * @param port - the injected read-only home port.
 * @param request - the inspect request (`{ dshHome, workspaceCwd?, projectDir? }`).
 * @returns the frozen inspection view (legacy-team or native-fallback).
 * @throws `LegacyReaderError` with `LEGACY_READER_INVALID_REQUEST` for a
 *   malformed request, or `LEGACY_READER_PORT_FAILURE` when the port
 *   violates its best-effort contract.
 */
export declare function inspectLegacyTeam(port: LegacyHomePort, request: unknown): LegacyTeamInspection;
/**
 * The reader dispatch surface (what the mounted tool / harness rows expose).
 * `inspect` is the only accepted action; EVERY other action — a mutation,
 * resume, restore, delete, or anything else — is rejected with the typed
 * `LEGACY_READER_MUTATION_REJECTED` error. Legacy Team Sessions are
 * read-only (invariant 65); there is no entry to change them, ever.
 *
 * @param port - the injected read-only home port.
 * @param action - the requested action token (only `inspect` is accepted).
 * @param request - the inspect request (validated for `inspect`).
 * @returns the frozen inspection view.
 * @throws `LegacyReaderError` `LEGACY_READER_MUTATION_REJECTED` for any
 *   non-inspect action, `LEGACY_READER_INVALID_REQUEST` for a malformed
 *   action or request.
 */
export declare function dispatchReaderAction(port: LegacyHomePort, action: unknown, request: unknown): LegacyTeamInspection;
//# sourceMappingURL=inspect.d.ts.map