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

/** The named facts WITHOUT `planSnapshot` — the honest shape of a call that
 *  walked NO approval question (an all-allow call has no case, so that one
 *  source does not exist; it is never synthesized to complete the 12). */
export type PaCallAuthorityFacts = Omit<PaCallFacts, 'planSnapshot'>

/** What the public call-level entry answers for ONE live call:
 *  - `call-facts`: the complete 12-field contract (the call walked an
 *    approval question, so `planSnapshot` has a real source);
 *  - `no-approval-question`: the same named facts minus `planSnapshot`,
 *    STATED as such (never a partial `PaCallFacts`);
 *  - `undefined`: any missing / unhealthy / contradicting source. */
export type PaCallLevelAnswer =
  | { readonly kind: 'call-facts'; readonly facts: PaCallFacts }
  | { readonly kind: 'no-approval-question'; readonly facts: PaCallAuthorityFacts }
  | undefined

/** The public entry's input: the REAL call identity — no `requestId`, no
 *  manifest, no Control row, and NO caller-supplied binding identity.
 *  `placementName` is the caller's OWN dispatcher placement spelling; it only
 *  SEEDS the family, and `matchUniqueBindingEntry` still requires that family
 *  to have exactly one verified+ACTIVE carrier. A row's `bindingId` is
 *  deliberately absent: reading the real binding THROUGH a row would make the
 *  row the authority (the circularity A5-M1 forbids), so a row's binding is
 *  only ever compared afterwards — see `readPaCallFacts`. */
export interface ReadPaCallFactsForCallInput {
  readonly mount?: PaMountEntry
  readonly rootSessionId: string
  readonly instanceId: string
  readonly realmId: string
  readonly callId: string
  readonly requestedEffects: unknown
  readonly placementName?: string
}

/** THE public call-level entry (A5-M1 B): the CURRENT facts of one live call
 *  read through the mount, keyed by the call identity alone. Both PA paths
 *  await this — the durable row's verifier reaches it through
 *  `readPaCallFacts`, which layers the row's manifest validation on the same
 *  shared read. */
export declare function readPaCallFactsForCall(
  input: ReadPaCallFactsForCallInput,
): Promise<PaCallLevelAnswer>
