/**
 * A5M2 B-SCHEDULE TRIGGER CARRIER — shared binding interface (root ruling
 * 2026-10-24). Typed surface for schedule-carrier.mjs; the semantics live in
 * the module header law.
 */

export declare const SCHEDULE_CARRIER_REVISION: 1
export declare const SCHEDULE_CARRIER_TOOL_NAME: 'schedule.trigger-carrier'

export interface ScheduleCarrierFingerprint {
  readonly kind: 'once' | 'recurring'
  /** COMPLETE fired-group record-id set (sorted by the emitter, unique, non-empty). */
  readonly groupTaskIds: readonly string[]
  readonly scheduledAt: string
  readonly occurrenceAt: string
}

export interface ScheduleCarrierIntent {
  readonly ownerSessionId: string
  readonly taskId: string
  readonly revision: null
  readonly occurrence: { readonly scheduledAt: string, readonly occurrenceAt: string }
  readonly destination: { readonly sessionId: string }
  readonly groupSize: number
  readonly phase: 'pre-resolve' | 'pre-followup'
  readonly carrierFingerprint: ScheduleCarrierFingerprint
}

export type ScheduleCarrierAdmissionResult = true | { readonly ok: false, readonly code: string, readonly detail?: string }

export interface ScheduleTriggerCarrierDeps {
  /** LIVE a5PlaneValue: paAdmit.open/edge + paTokenLedger.take/settle. */
  readonly plane: {
    readonly paAdmit?: {
      open: (walk: Record<string, unknown>) => Promise<{ kind?: string, cancelled?: boolean, grant?: unknown, paDurableMint?: unknown, request?: unknown, placementName?: unknown, paConstructionBinding?: unknown } | null | undefined>
      edge: (walk: Record<string, unknown>) => Promise<{ kind?: string, cancelled?: boolean } | null | undefined>
    }
    readonly paTokenLedger?: {
      take: (token: object | symbol, correlation?: string) => boolean
      settle: (token: object | symbol) => boolean
    }
  } | null | undefined
  readonly realmId: string
  readonly familyFacts: { readonly familyId: string, readonly adapterRevision: string | number, readonly providerIdentity: string }
  readonly consumerProbe: () => { readonly mounted: boolean, readonly generation: string }
  readonly observations?: (line: string) => void
}

export interface ScheduleTriggerCarrier {
  readonly admit: (intent: ScheduleCarrierIntent) => Promise<ScheduleCarrierAdmissionResult>
  readonly dispose: () => void
  readonly SCHEDULE_CARRIER_REVISION: 1
}

export declare function createScheduleTriggerCarrier(deps: ScheduleTriggerCarrierDeps): ScheduleTriggerCarrier
