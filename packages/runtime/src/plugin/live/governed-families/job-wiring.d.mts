/* Type declarations for job-wiring.mjs — the B-JOB governed CALL bridge.
 * The runtime module is the law; these declarations mirror its closed
 * surface and add no behaviour. */

import type { BJobAssemblyInput, BJobRefusal, BJobRegistration } from './job-adapters.mjs'

export interface BJobWiringInput extends Partial<BJobAssemblyInput> {
  providerId: string
  pa: ((walk: Record<string, unknown>) => Promise<Record<string, unknown>>) & { closePlan?: (callId: string) => void }
  probe?: (name: string, caller: string, snapshot: Record<string, unknown>) => Promise<Record<string, string | null>>
  observe?: (row: Record<string, unknown>) => void
}

export interface BJobWiring {
  readonly ok: true
  readonly familyId: 'B-JOB'
  readonly wiringRevision: number
  readonly adapterRevision: number
  readonly providerId: string
  readonly placementNames: readonly string[]
  /** One governed management call; refusals answer the row's closed
   *  { text: 'refused: CODE — detail' } envelope. */
  dispatch: (name: 'job_output' | 'job_list' | 'job_kill', args: unknown, exec: { agent?: { id?: string }, callId?: string, signal?: AbortSignal }) => Promise<unknown>
  walks: () => number
  familyRegistrations: () => readonly BJobRegistration[]
  dispose: () => void
}

export declare const A5_B_JOB_WIRING_REVISION: number
export declare const A5_B_JOB_WIRING_CODES: Readonly<Record<string, string>>
export declare function createBJobControlWiring (input: BJobWiringInput): BJobWiring | BJobRefusal
