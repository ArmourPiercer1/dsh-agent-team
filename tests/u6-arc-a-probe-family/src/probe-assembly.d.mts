/**
 * Type surface for the ARC-A probe lane's `probe-assembly.mjs` (plain-.mjs
 * lane + sidecar declaration, the testkit convention). Only the walk-test
 * consumption surface is typed; the runtime file stays plain JavaScript.
 */
export declare const PROBE_FAMILY_ID: 'dsh.u6-probe-family'

export type ProbeWalkResult = {
  ok: boolean
  stage: 'plan' | 'consume' | 'executed'
  code?: string
  detail?: string
  markerFile?: string
  generation?: number
}

export type ProbeAssembly = {
  definition: { name: string, parameters: unknown }
  contribution: Record<string, unknown>
  registry: {
    register: (contribution: unknown, opts: { origin: string }) => { ok: boolean; code?: string; detail?: string }
    revoke: (familyId: string, reason: string) => unknown
  }
  kernel: {
    state: () => string
    publish: () => { ok: boolean; code?: string }
    addApprovalEntry: (entry: { scopeKey: string, nativeName: string, definitionIdentity: string, familyId: string }) => { ok: boolean; code?: string }
    decide: (call: { nativeName: string, scopeKey?: string, definitionIdentity?: string }) => { outcome: string; code: string }
    consumeOnce: (grant: unknown, grantId: string, facts?: Record<string, unknown>) => Promise<{ ok: boolean; code?: string; detail?: string }>
    beginDrain: () => unknown
    tombstone: () => unknown
    release: () => { ok: boolean; code?: string }
    dropApprovalsForFamily: (familyId: string) => unknown
    approvalFor: (scopeKey: string, nativeName: string) => { definitionIdentity: string } | undefined
  }
  bindApproval: () => { ok: boolean; already?: boolean; code?: string }
  walk: (call: { callId: string, nonce: string, scopeKey?: string, identity?: string, grantId?: string }) => Promise<ProbeWalkResult>
  teardown: () => { ok: boolean; already?: boolean; code?: string }
  faces: () => { state: string; familyIds: string[]; generation: number; approval: { definitionIdentity: string } | null }
}

export declare function createU6ProbeAssembly(input: {
  markerDir: string
  scopeKey: string
  definitionIdentity?: string
  mode?: 'enforcing' | 'shadow'
}): ProbeAssembly
