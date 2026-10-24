/** Type face for schedule-trigger-governance.mjs — the frozen trigger-gate. */

export declare const A5_SCHEDULE_TRIGGER_CODES: Record<string, string>
export interface TriggerLaws {
  FROZEN_DECISION: string
  TRIGGER_GOVERNANCE: string
  PLAN_ONCE_MEMO: string
  REVOCATION: string
  TRIGGER_PATH: { resolveAgent: string, followup: string, publicPreDeliveryGovernanceSeam: null }
  TOOL_PATH: { register: string, create: string, update: string, callerLaw: string }
  GATED_NAMES: readonly ['schedule_create', 'schedule_update']
}
export declare const A5_SCHEDULE_TRIGGER_LAWS: TriggerLaws
export interface TriggerEvaluation {
  enabled: boolean
  code?: string
  detail: string
  generationId?: number
  law?: string
  seam?: unknown
}
export interface TriggerDeps {
  seamFace?: () => unknown
  lifecycleFace?: () => { id: number, active: boolean } | null | undefined
  rootGo?: () => unknown
}
export type TriggerGovernance
  = { ok: true, evaluateDispatch: (name: string) => TriggerEvaluation, laws: TriggerLaws }
    | { ok: false, code: string, detail: string }
export declare function createScheduleTriggerGovernance (deps?: TriggerDeps): TriggerGovernance
