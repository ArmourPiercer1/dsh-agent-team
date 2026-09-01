/**
 * legacy-reader.d.mts — the type surface of `legacy-reader.mjs` (the
 * live-world re-export adapter for the frozen legacy session reader).
 *
 * The signatures mirror the frozen `@dsh-agent-team/legacy`
 * `session-reader` entry points; the parameter/result types are the
 * STRUCTURAL MIRRORS declared in `../types.js` (the frozen package is
 * never imported by the tsc-checked sources — see the mirror docs there).
 */

import type {
  LegacyHomePort,
  LegacyTeamInspectRequest,
  LegacyTeamInspection,
} from '../types.js'

/**
 * Inspect one legacy home (best-effort legacy Team view, or the native
 * Chat/Trajectory degradation).
 * @param port - the injected read-only home port.
 * @param request - the inspect request.
 * @returns the frozen inspection view.
 */
export declare function inspectLegacyTeam(
  port: LegacyHomePort,
  request: LegacyTeamInspectRequest,
): LegacyTeamInspection

/**
 * The reader dispatch surface: only `inspect` is accepted; every other
 * action throws `LEGACY_READER_MUTATION_REJECTED` (the frozen reader is
 * read-only by construction, invariant 65).
 * @param port - the injected read-only home port.
 * @param action - the requested action token (only `inspect` is accepted).
 * @param request - the inspect request (validated for `inspect`).
 * @returns the frozen inspection view.
 */
export declare function dispatchReaderAction(
  port: LegacyHomePort,
  action: unknown,
  request: unknown,
): LegacyTeamInspection
