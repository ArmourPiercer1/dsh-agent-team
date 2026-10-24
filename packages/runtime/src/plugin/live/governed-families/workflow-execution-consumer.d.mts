/**
 * Adjacent tsc type surface for `workflow-execution-consumer.mjs`
 * (A5M2 B-ORCHESTRATION execution-arm DECLARED_INACTIVE closure, records
 * 47/48). Consumed-only; the runtime law lives in the `.mjs`.
 */

export interface G2OrchExecState {
  readonly record: 47 | 48
  readonly state: 'DECLARED_INACTIVE'
  readonly mountCondition: string
  readonly reasonCode: 'P_B_ORCH_EXEC_UNLANDABLE_RUN_CONTROL'
  readonly why: string
  readonly citations: readonly string[]
}

export interface G2OrchExecRefusal {
  readonly ok: false
  readonly code: string
  readonly detail: string
}

export declare const A5_B_ORCH_EXEC_RECORDS: readonly ['workflow', 'ralph']

export declare const A5_B_ORCH_EXEC_STATES: Readonly<{
  workflow: G2OrchExecState
  ralph: G2OrchExecState
}>

export declare const A5_B_ORCH_EXEC_SUPPLY_GATE: Readonly<{
  closed: true
  items: readonly string[]
}>

/** The ONLY execution surface at this tip — typed refusal for every
 *  input; no delegate, no native, no engine path exists behind it. */
export declare function refuseBOrchExecution (name: unknown): G2OrchExecRefusal
