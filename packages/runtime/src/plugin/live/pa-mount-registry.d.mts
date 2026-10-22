/**
 * pa-mount-registry.d.mts — the declaration half of `pa-mount-registry.mjs`
 * (an untyped `.mjs` SOURCE module). It exists so `src/` consumes the
 * registry through a typed seam instead of `@ts-ignore` / `any` (the
 * lint-identities gate counts a ban-ts-comment as a new identity; a real
 * declaration is the honest fix).
 *
 * THE CONTRACT BELOW IS DESCRIBED FROM THE IMPLEMENTATION, not invented:
 * see the module header for the facts law (no cached facts, every read
 * re-answers fresh, ANY missing/contradicting source ⇒ `undefined` ⇒
 * `authority-undetermined`).
 */

import type { PaCallFacts } from '../../../control/types.js'

/** The named call-level facts the ONE injected PA verifier awaits per gate. */
export type PaCallFactsResult = PaCallFacts | undefined

/** What agent-bindings publishes per mounted member (references ONLY — this
 *  is deliberately not an authority ledger; see the module header). */
export interface PaMountEntry {
  readonly instanceId: string
  /** the member's ToolBinding guard (`.dispatcher.surface.entryOf(name)`). */
  readonly guard?: unknown
  /** the mounted plane face (`.assembly`, `.livePaPlan`, `.realmId`,
 *  and the plane-local confirmed `authorityGeneration` reader). */
  readonly plane?: unknown
  /** durable attribution of the mount ('leader' | 'member'). */
  readonly beneficiaryAuthority?: string
  /** trusted current-fact readers (permissionPlane, overlaySnapshot, …). */
  readonly readers?: Record<string, unknown>
  /** the plane's own governed tool names (the dispatcher-name family). */
  readonly surface?: { names?: () => readonly string[]; entryOf?: (name: string) => unknown }
  readonly [key: string]: unknown
}

/** The adapter input (the verifier's `readCallFacts` port plus the
 *  OPTIONAL explicit mount override). */
export interface ReadPaCallFactsInput {
  readonly rootSessionId: string
  readonly requestId: string
  readonly manifest: unknown
  readonly decider?: unknown
  readonly stage?: string
  readonly mount?: PaMountEntry
}

/** Publish the CURRENT mount for (teamRoot, instanceId); returns the MOUNT
 *  IDENTITY the matching revoke must present (a key alone never revokes
 *  somebody else's mount). */
export declare function publishPaMount(
  teamRoot: string,
  instanceId: string,
  entry: PaMountEntry,
): unknown

/** Revoke ONLY when `identity` is the handle this mount published; a stale
 *  disposer clears nothing. Returns whether a mount was actually removed. */
export declare function revokePaMount(
  teamRoot: string,
  instanceId: string,
  identity: unknown,
): boolean

/** The CURRENT published mount for the pair, or undefined. */
export declare function resolvePaMount(teamRoot: string, instanceId: string): PaMountEntry | undefined

/** The ONE call-level facts adapter: the complete named `PaCallFacts` for
 *  exactly this call, or `undefined` (never a partial shape, never a 0/1
 *  or empty-envelope fallback). */
export declare function readPaCallFacts(input: ReadPaCallFactsInput): Promise<PaCallFactsResult>
