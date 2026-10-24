/**
 * Adjacent tsc type surface for `team-governed-provider.mjs` (A5M2-WIRE-G2
 * the Team-governed SubagentProvider, REAL-CHAIN supply after the root
 * C1/C2 rulings). Consumed-only; the runtime law lives in the `.mjs`.
 */

export interface G2TgpRefusalError extends Error {
  code: string
  tgpRefusal: { code: string, detail: string }
}

/** The admitted per-run call context the closure correlation rides (no WeakMap). */
export interface G2TgpRunContext {
  callId: string
  parametersFingerprint: string
  realmId: string
  toolName?: string
  providerIdentity?: string
}

/** The arm's wrapper over the EXISTING durable fresh-member chain faces. */
export interface G2TgpChildChain {
  // THE REAL accepted request of childFactory.createChildSession (root
  // interface card): exactly these fields; the wrapper typed-refuses any
  // extra rather than silently dropping it.
  ensureChild (args: {
    rootSessionId: string
    instanceId: string
    templateId: string
  }): Promise<{ childSessionId: string, handle: { agent: unknown, dispose?: () => Promise<void> } }>
}

export interface G2TgpInput {
  name?: string
  pa: ((walk: Record<string, unknown>) => Promise<{ kind?: string, cancelled?: boolean, detail?: string, reason?: string }>) & { closePlan?: (callId: string) => void }
  runContext: G2TgpRunContext
  childChain: G2TgpChildChain
  /** The ACTIVATED template the run is authorized to spawn under (locateTemplate). */
  templateId: string
  settlement: {
    rootSessionId: string
    workDelivery: { deliver (args: Record<string, unknown>): Promise<Record<string, unknown>> }
  }
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

/** The frozen WorkDeliveryResult (admission/types.ts:559) of one delivered turn. */
export interface G2TgpWorkDeliveryResult {
  readonly requestToken: string
  readonly status: 'succeeded' | 'failed' | 'unavailable'
  readonly body?: string
  readonly error?: { readonly code: string, readonly message: string }
}

/**
 * C1 normalization: the frozen DTO -> the run settlement. succeeded maps
 * ONLY with a readable non-empty body; failed/unavailable/unknown NEVER
 * map to success (typed throws carrying the DTO's own bytes); the
 * requestToken echo is verified, never re-mapped.
 */
export declare function mapWorkDeliveryResult (
  result: G2TgpWorkDeliveryResult | unknown,
  expectedRequestToken: string,
): { output: readonly { type: 'text', text: string }[], isError: false, stopReason: 'completed' }

/**
 * The deterministic durable child-instance NAME for one admitted child
 * call (contracts INSTANCE_ID_PATTERN namespace; the ROW commits through
 * the existing fresh-member activation chain — never a minted UUID).
 */
export declare function childInstanceIdForAdmittedCall (rootSessionId: string, childCallId: string): string

export declare const A5_TGP_CODES: Readonly<Record<string, string>>
export declare const A5_TGP_DEFAULT_PROVIDER_NAME: 'team-governed-spawn'

export declare function createTeamGovernedSubagentProvider (input?: G2TgpInput):
  | (G2TgpProvider & { ok?: undefined })
  | { ok: false, code: string, message: string }
