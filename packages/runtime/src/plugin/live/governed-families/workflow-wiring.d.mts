/**
 * Adjacent tsc type surface for `workflow-wiring.mjs` (A5M2
 * B-ORCHESTRATION execution consumer). Consumed-only; the runtime law
 * lives in the `.mjs`.
 */

export interface G2OrchWiringRefusal {
  readonly ok: false
  readonly code: string
  readonly detail?: string
  readonly message?: string
  readonly name?: string
}

export interface G2OrchWiringInput {
  providerId?: string
  captured?: Record<string, { native: object, definitionIdentity: string }>
  liveNative?: (name: string) => object | undefined
  workflowDelegates?: Record<string, (args: unknown, exec: unknown) => Promise<unknown>>
  liveWorkflowDelegates?: () => Record<string, unknown>
  placementFeed: (name: string) => { definitionIdentity?: string, realmId?: string } | undefined
  pa: ((walk: Record<string, unknown>) => Promise<{ kind?: string, cancelled?: boolean, detail?: string, reason?: string }>) & { closePlan?: (callId: string) => void }
  observe?: (row: Record<string, unknown>) => void
  [key: string]: unknown
}

export interface G2OrchWiringOk {
  readonly ok: true
  readonly familyId: string
  readonly adapterRevision: number
  readonly providerId: string
  readonly definitions: readonly Record<string, unknown>[]
  readonly placementNames: readonly string[]
  readonly rows: Readonly<Record<string, unknown>>
  readonly declared: readonly Record<string, unknown>[]
  rowOf: (name: string) => unknown
  inFlight: () => Readonly<{ dispatches: number, refuses: number }>
  walks: () => number
  familyRegistrations: () => readonly Readonly<{ name: string, recordIndex: number, definitionIdentity: string, entry: Readonly<Record<string, unknown>> }>[]
  mount: (agentCtx: unknown) => Readonly<{ ok: true, dispose: () => Record<string, unknown> }> | G2OrchWiringRefusal
  dispose: () => Record<string, unknown>
}

export declare const A5_B_ORCH_WIRING_CODES: Readonly<Record<string, string>>

/** The real execution consumer: mounts the frozen adapter VERBATIM and
 *  occupies its required admit seat with the real PA walk. */
export declare function createBOrchestrationExecutionWiring (input?: G2OrchWiringInput): G2OrchWiringOk | G2OrchWiringRefusal
