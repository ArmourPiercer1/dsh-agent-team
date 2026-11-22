/**
 * admission-port.d.mts — the declaration half of `admission-port.mjs`.
 *
 * The implementation is a plain `.mjs` because the product composition and the node:test arms import
 * it untyped; the TypeScript suites that drive it (`test/u6-pr2-review-r1`, `test/u6-pr3-bl01-ask-door`)
 * reach it through this file so `tsc` sees the ONE exported entry point without a repo-wide `allowJs`
 * change — the same shape as `host-surface-refusal.d.mts` beside it.
 */

/** The host tools service the point installs on (the two seams it uses, nothing more). */
export interface AdmissionToolsService {
  guard(fn: (exec: unknown) => unknown): unknown
  readonly get?: (name: string) => unknown
  readonly schemas?: (scope?: unknown) => readonly { name: string }[]
}

/** The slice of the host agent context the point reads. */
export interface AdmissionHostContext {
  get(name: string): unknown
  on(event: string, fn: (...args: never[]) => unknown): () => void
}

/** What `resolveBinding` answers for one call: a compiled binding, or nothing (a foreign call). */
export type AdmissionResolver = (exec: unknown) => Record<string, unknown> | undefined

export interface InstallAdmissionPointInput {
  readonly ctx: AdmissionHostContext
  readonly resolveBinding: AdmissionResolver
  readonly record: (fact: unknown) => void
  readonly callIdOf?: (exec: unknown) => string | undefined
  readonly isReplay?: (callId: string) => boolean
  readonly recordReplay?: (callId: string) => void
  readonly grants?: unknown
  readonly approvals?: unknown
  readonly settlement?: unknown
  readonly overlayDecision?: unknown
  readonly onFault?: unknown
  readonly closedBinding?: unknown
}

/**
 * Install the point on one agent context and return its disposer. After the disposer runs the point
 * answers nothing (it is retired, not closed): the host's own path is what remains.
 */
export declare function installAdmissionPoint(input: InstallAdmissionPointInput): () => void
