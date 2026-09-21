/**
 * Strict-read + Core-spill — the cross-row bridge of the artifact-read
 * authority (Phases C/E).
 *
 * The {@link TeamArtifactAuthority} of one production root is constructed
 * by the HOST row (it needs the open TeamDomain — the durable session
 * identity + the grant ledger — plus the host's lazy `fs` seam). Its
 * consumers live in SIBLING rows: the Team-aware spill provider
 * (./team-spill-local.ts, which replaces the base `spill-local` row in
 * the bundle layer) records an artifact on every `saveText`, and the
 * live glue's permission lane consults it at read time.
 *
 * Cordis services provided at row scope are visible to sibling top-level
 * rows (the same mechanism the upstream `spill-local` → `spill-policy`
 * seam relies on — both are top-level rows of the base bundle), so the
 * host row exposes the authority as the row-scope service
 * {@link TEAM_ARTIFACT_AUTHORITY_SERVICE}. The service value is a MUTABLE
 * BRIDGE object, provided SYNCHRONOUSLY (before the first await, next to
 * the `teamRoot` facade): the host fills `authority` once the bootstrap
 * has constructed it. A consumer that observes a bridge WITHOUT an
 * authority (bootstrap still running or failed) must treat every session
 * as UNMANAGED (upstream-equivalent behavior — no grant, no record I/O);
 * the bridge itself never rejects on bootstrap state.
 *
 * One bridge per process: the composition carries one team row per
 * profile, and a second provision of the same service name throws in
 * Cordis (fail loud, per the service-registration contract).
 *
 * Pure module: a constant and a type only — no state, no I/O (the
 * authority instance is built by the host entry; the spill provider
 * reads it lazily per `saveText`).
 * @module @dsh-agent-team/runtime/plugin/artifact-grant-bridge
 */
import type { TeamArtifactAuthority } from '../../artifact-read/index.js'

/** The Cordis service name the host row provides the bridge under. */
export const TEAM_ARTIFACT_AUTHORITY_SERVICE = 'teamArtifactAuthority'

/**
 * The mutable bridge object the host row provides (module docs for the
 * visibility and lifetime contract).
 */
export interface TeamArtifactAuthorityBridge {
  /**
   * The live authority of this row's production root — filled by the
   * host row after the bootstrap constructed it; `undefined` until then
   * (and when the bootstrap failed: consumers treat every session as
   * unmanaged — the upstream-equivalent path, never a crash).
   */
  authority: TeamArtifactAuthority | undefined
}
