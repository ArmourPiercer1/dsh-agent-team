/**
 * Adjacent tsc type surface for `child-identity-bridge.mjs` (A5M2 item A):
 * a trusted identity ROUTING / lifecycle index ONLY — routing facts and
 * lifecycle state, zero permission decisions, zero quota semantics.
 */

export type G2ChildBridgeState = 'active' | 'draining' | 'retired'

export interface G2ChildRoute {
  readonly childSessionId: string
  readonly rootSessionId: string
  readonly owningMemberInstanceId: string
  readonly admittedCallId: string
  readonly generation: number
  readonly state: G2ChildBridgeState
  readonly drainReason?: string
}

export interface G2ChildIdentityBridge {
  install (binding: {
    childSessionId: string
    rootSessionId: string
    owningMemberInstanceId: string
    admittedCallId: string
    generation: number
  }): G2ChildRoute
  resolve (childSessionId: string): G2ChildRoute | undefined
  beginDrain (childSessionId: string, reason?: string): G2ChildRoute | undefined
  retire (childSessionId: string): G2ChildRoute | undefined
  drainByOwner (
    rootSessionId: string,
    owningMemberInstanceId: string,
    opts?: { belowGeneration?: number, reason?: string },
  ): readonly G2ChildRoute[]
  settle<T> (childSessionId: string, reclaim: () => Promise<T>): Promise<T>
  size (): number
  readonly STATES: Readonly<Record<string, G2ChildBridgeState>>
}

export declare function createChildIdentityBridge (): G2ChildIdentityBridge
export declare const BRIDGE_STATE: Readonly<Record<string, G2ChildBridgeState>>
