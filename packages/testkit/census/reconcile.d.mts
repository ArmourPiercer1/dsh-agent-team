import type { ObservedInventory } from './inventory.mjs'
import type { CensusArtifact } from './expected-obligations.mjs'
export interface ReconcileCounts {
  missing: number
  unknown: number
  out_of_scope_observed: number
  drift: number
  scope_gaps: number
}
export interface ReconcileResult {
  schema: string
  inputs: Record<string, unknown>
  missing: Array<Record<string, unknown>>
  unknown: Array<Record<string, unknown>>
  out_of_scope_observed: Array<Record<string, unknown>>
  drift: Array<Record<string, unknown>>
  scope_gaps: Array<Record<string, unknown>>
  notes: Array<Record<string, unknown>>
  counts: ReconcileCounts
  verdict_digest: string
}
export type ReconcileInput = {
  expected: CensusArtifact
  sources: CensusArtifact
  observed: ObservedInventory
  baseline?: ObservedInventory | null
  testRowNames?: string[]
}
export type ReconcileOutcome = { ok: false; violations: string[] } | { ok: true; result: ReconcileResult }
export declare function reconcile(input: ReconcileInput): ReconcileOutcome
