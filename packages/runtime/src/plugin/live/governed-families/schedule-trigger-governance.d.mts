/** Type face for schedule-trigger-governance.mjs — measured gap + gate. */

export declare const A5_SCHEDULE_TRIGGER_CODES: Record<string, string>
export interface TriggerGap {
  G1_firing_no_hook: Record<string, string>
  G2_api_admission_not_permission: Record<string, string>
  G3_attribution: Record<string, string>
  G4_parent_cancellation: Record<string, string>
  G5_permission_supply: Record<string, string>
  PLAN_ONCE_MEMO: string
  REVOCATION: string
  GATED_NAMES: readonly ['schedule_create', 'schedule_update']
}
export declare const A5_SCHEDULE_TRIGGER_GAP: TriggerGap
export interface TriggerLaws { FROZEN_DECISION: string, TRIGGER_GOVERNANCE: string, PLAN_ONCE_MEMO: string }
export declare const A5_SCHEDULE_TRIGGER_LAWS: TriggerLaws
export interface TriggerEvaluation {
  enabled: false | boolean
  code?: string
  detail: string
  generationId?: number
  law?: string
  gap?: TriggerGap
}
export interface TriggerDeps { lifecycleFace?: () => { id: number, active: boolean } | null | undefined }
export type TriggerGovernance
  = { ok: true, evaluateDispatch: (name: string) => TriggerEvaluation, gap: TriggerGap, laws: TriggerLaws }
    | { ok: false, code: string, detail: string }
export declare function createScheduleTriggerGovernance (deps?: TriggerDeps): TriggerGovernance
