/**
 * Adjacent tsc type surface for `team-governed-provider.mjs` (A5M2-WIRE-G2
 * the Team-governed SubagentProvider, pairing A). Consumed-only; the
 * runtime law lives in the `.mjs`.
 */

export interface G2TgpRefusalError extends Error {
  code: string
  tgpRefusal: { code: string, detail: string }
}

export interface G2TgpParentContext {
  callId: string
  parametersFingerprint: string
  realmId: string
  toolName: string
  ordinal: number
  providerIdentity?: string
}

export interface G2TgpInput {
  name?: string
  agents: { create: (options: Record<string, unknown>) => Promise<Record<string, unknown>> }
  pa: ((walk: Record<string, unknown>) => Promise<{ kind?: string, cancelled?: boolean, detail?: string, reason?: string }>) & { closePlan?: (callId: string) => void }
  teamActivation: {
    runOwned: <T>(sessionId: string, operation: () => Promise<T>) => Promise<T>
    wrapSetup: (sessionId: string, setup: (agentCtx: unknown, agent: unknown) => unknown | Promise<unknown>) => (agentCtx: unknown, agent: unknown) => Promise<unknown>
  }
  laneResolver: (memberAgent: unknown) => { deny: string[] } | null
  activeCalls: WeakMap<object, G2TgpParentContext>
  laneRecheck?: () => boolean
  observe?: (row: Record<string, unknown>) => void
  [key: string]: unknown
}

export interface G2TgpProvider {
  readonly name: string
  readonly capabilities: Readonly<Record<string, boolean>>
  readonly inheritsParentContext: false
  start (request: Record<string, unknown>): Promise<{
    runId: string
    provider: string
    id: string
    local: true
    localAgent: unknown
    result: Promise<unknown>
    dispose: () => Promise<void>
  }>
}

export declare const A5_TGP_CODES: Readonly<Record<string, string>>
export declare const A5_TGP_DEFAULT_PROVIDER_NAME: 'team-governed-spawn'

export declare function createTeamGovernedSubagentProvider (input?: G2TgpInput):
  | (G2TgpProvider & { ok?: undefined })
  | { ok: false, code: string, message: string }
