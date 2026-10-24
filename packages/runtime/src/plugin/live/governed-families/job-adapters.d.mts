/* Type declarations for job-adapters.mjs — the B-JOB governed-adapter rows
 * (FC-JOB census records 18/19/20). The runtime module is the law; these
 * declarations mirror its closed surface and add no behaviour. */

export interface BJobRecordSpec {
  readonly recordIndex: number
  readonly operation: string
  readonly effectDelta: string
  readonly jobIdRequired: boolean
}

export interface BJobRefusal {
  readonly ok: false
  readonly refused: true
  readonly code: string
  readonly detail: string
}

export interface BJobProbeFacts {
  readonly caller?: string
  readonly ownerRelation?: string
  readonly ownerAdjudication?: string
  readonly producerIncarnation?: string
}

export interface BJobMintedTarget {
  readonly contract: string
  readonly revision: string
  readonly effect: string
  readonly depth: string
  readonly action: string
  readonly caller: string
  readonly address: { readonly claim: string | null, readonly relation: string, readonly adjudication: string }
  readonly producerIncarnation: string
  readonly budget: string
}

export interface BJobRegistration {
  readonly name: string
  readonly recordIndex: number
  readonly definitionIdentity: string
  readonly entry: { readonly familyId: string, readonly adapterRevision: number, readonly providerIdentity: string }
}

export interface BJobAssemblyInput {
  providerId: string
  bridge: {
    jobOutput: (args: Record<string, unknown>, callerId: string, signal?: AbortSignal) => Promise<{ text?: string } | unknown>
    jobList: (callerId: string) => Promise<{ text?: string } | unknown>
    jobKill: (args: Record<string, unknown>, callerId: string) => Promise<{ text?: string } | unknown>
  }
  liveBridge: () => unknown
  placementFeed?: (name: string) => { definitionIdentity?: string, realmId?: string } | undefined
}

export interface BJobAssembly {
  readonly ok: true
  readonly familyId: typeof A5_B_JOB_FAMILY_ID
  readonly revision: number
  readonly providerId: string
  readonly placementNames: readonly string[]
  classifyArgs: (name: string, rawArgs: unknown) => ({ ok: true, snapshot: Readonly<Record<string, unknown>>, parametersFingerprint: string } | BJobRefusal)
  mintTarget: (name: string, snapshot: Record<string, unknown>, facts?: BJobProbeFacts) => BJobMintedTarget
  canonicalJson: (value: unknown) => string
  namedGaps: Record<string, string>
  verifyBridge: (name: string) => ({ ok: true, methods: BJobAssemblyInput['bridge'] } | BJobRefusal)
  familyRegistrations: () => readonly BJobRegistration[]
}

export declare const A5_B_JOB_FAMILY_ID: 'B-JOB'
export declare const A5_B_JOB_ADAPTER_REVISION: number
export declare const A5_B_JOB_RECORD_SPECS: Readonly<Record<'job_output' | 'job_list' | 'job_kill', BJobRecordSpec>>
export declare const A5_B_JOB_NAMED_GAPS: Readonly<Record<string, string>>
export declare const A5_B_JOB_ADAPTER_CODES: Readonly<Record<string, string>>
export declare const A5_B_JOB_PARAM_LAWS: Readonly<Record<'job_output' | 'job_list' | 'job_kill', unknown>>
export declare const A5_B_JOB_PARAM_FINGERPRINTS: Readonly<Record<'job_output' | 'job_list' | 'job_kill', string>>
export declare function mintBJobTarget (name: string, snapshot: Record<string, unknown>, facts?: BJobProbeFacts): BJobMintedTarget
export declare function createBJobGovernedAssembly (input: BJobAssemblyInput): BJobAssembly | BJobRefusal
