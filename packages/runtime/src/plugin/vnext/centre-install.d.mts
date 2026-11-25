/**
 * centre-install.d.mts — the declaration half of `centre-install.mjs`, limited
 * to the two entry points the COLLECTED vitest suites drive.
 *
 * The implementation is plain `.mjs` (the product glue and the node:test arms
 * import it untyped); a TypeScript suite reaches the same implementation
 * through this file so `tsc` sees it without a repo-wide `allowJs` change —
 * the same shape as `admission-port.d.mts` beside it. Only the exports the
 * TypeScript population uses are declared; a new TS consumer adds its
 * declaration HERE.
 */

/** The admission binding the centre decides with (`bindingFromCompiledMember`'s answer). */
export interface CentreBinding {
  readonly agentId?: string
  readonly sessionId?: string
  readonly workspaceRoot?: string
  readonly read?: unknown
  readonly write?: unknown
  readonly network?: unknown
  readonly [key: string]: unknown
}

/** Map one compiled Member policy onto a binding (by reference, never re-interpreted). */
export declare function bindingFromCompiledMember(input: {
  readonly member: unknown
  readonly agentId: string
  readonly sessionId: string
  readonly workspaceRoot?: string
  readonly owner?: string
  readonly instanceId?: string
  readonly bindings?: readonly unknown[]
  readonly executors?: unknown
  readonly processFace?: unknown
  readonly processShellClass?: unknown
}): CentreBinding

/** Install admission + execution facts + settlement over ONE callId on a member context. */
export declare function installMemberCentre(input: {
  readonly ctx: object
  readonly binding?: CentreBinding
  readonly resolveBinding?: (exec: unknown) => CentreBinding | undefined
  readonly recordAdmission: (fact: unknown) => void
  readonly recordExecution: (fact: unknown) => void
  readonly isReplay?: (callId: string) => boolean
  readonly recordReplay?: (input: unknown) => void
  readonly grants?: unknown
  readonly approvals?: unknown
  readonly store?: unknown
  readonly identityOf?: (exec: unknown) => { executionId: string, actorId: string, worldId: string }
  readonly overlayDecision?: unknown
  readonly onFault?: (error: unknown, context: object) => void
}): { dispose(): void, close(): void }
