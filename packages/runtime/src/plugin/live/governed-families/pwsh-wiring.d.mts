/** Type face for pwsh-wiring.mjs — the governed pwsh mount bridge.
 *  Tier 接线未测; win32 acceptance is ENV-NOT-AVAILABLE off-win32 hosts. */

import type { GovernedPwshArm, PwshArmDeps } from './pwsh-arm.mjs'

export declare const A5_PWSH_MOUNT_NAME: 'pwsh'
export declare const A5_PWSH_WIRING_CODES: Record<string, string>

export interface PwshWiringInput {
  realmId: string
  providerId: string
  memberAgentId: string
  sessionHeaderId: string
  readNative: (name: string) => unknown
  declaredMount?: boolean | undefined
  jobsMounted?: (() => boolean) | undefined
  placementFeed: (name: string) => { definitionIdentity: string, realmId: string } | undefined
  identityOf: (def: unknown) => string | null | undefined
  pa: {
    open: (walk: Record<string, unknown>) => unknown | Promise<unknown>
    edge: (walk: Record<string, unknown>) => unknown | Promise<unknown>
    closePlan: (callId: string) => void
  }
  observe?: (row: Record<string, unknown>) => void
}

export interface PwshFamilyRegistration {
  name: string
  definitionIdentity: string
  entry: { familyId: string, adapterRevision: number, providerIdentity: string }
}

export type PwshWiringResult
  = {
      ok: true
      familyId: string
      adapterRevision: number
      definitions: readonly Record<string, unknown>[]
      placementNames: readonly string[]
      familyRegistrations: () => readonly PwshFamilyRegistration[]
      declared: readonly { name: string, reason: string }[]
      definition?: Record<string, unknown>
      boundIdentity?: string | null
      drain: () => { ok: true, served: number }
    }
  | { ok: false, code: string, detail: string }

export declare function buildPwshGovernedWiring (input?: PwshWiringInput): PwshWiringResult
export type { GovernedPwshArm, PwshArmDeps }
