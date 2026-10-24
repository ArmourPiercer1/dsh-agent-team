/** Type face for pwsh-arm.mjs — the governed PWSH arm class (root FIXED
 *  scope 2026-10-24). Tier 接线未测; win32 acceptance is ENV-NOT-AVAILABLE
 *  off-win32 hosts and is never simulated as passed. */

export type PwshDeny = { kind: 'deny', code: string, detail: string, sideEffectPossible?: boolean }
export type PwshPlan = {
  toolName: 'pwsh'
  command: string
  description: string
  workdir?: string | undefined
  timeoutMs?: number | undefined
  background: boolean
  effects: readonly string[]
  parametersFingerprint: string
}
export type PwshClassify = { ok: true, plan: PwshPlan } | PwshDeny
export type PwshRun =
  | { kind: 'allow', mode: 'foreground', sideEffectPossible: true, exitCode: number | null, stdout: string, stderr: string, movedToBackground?: true, cancelledAfterStart?: true }
  | { kind: 'allow', mode: 'background', jobId?: string, sideEffectPossible: true }
  | PwshDeny

export interface PwshArmDeps {
  declared?: () => boolean
  platform?: () => string
  fsExists?: (path: string) => boolean
  which?: (binary: string) => string | undefined
  resolveBinary?: () => string | undefined
  jobsFace?: () => boolean
  consumePaAtBody?: (exec: unknown, plan: PwshPlan) => unknown | Promise<unknown>
  spawnForeground?: (argv: readonly string[], opts: Record<string, unknown>) => unknown | Promise<unknown>
  startBackground?: (argv: readonly string[], opts: Record<string, unknown>) => { jobId?: string } | Promise<{ jobId?: string }>
  spillObserver?: (artifact: Record<string, unknown>) => void
}

export interface GovernedPwshArm {
  readonly name: 'pwsh'
  readonly familyId: string
  readonly adapterRevision: number
  readonly providerId: string
  classify: (raw: unknown) => PwshClassify
  execute: (exec: unknown, plan: PwshPlan) => Promise<PwshRun>
  drain: () => Promise<{ ok: true }>
  readonly refusalVocabulary: Record<string, string>
}

export declare const PWSH_FAMILY_ID: string
export declare const PWSH_ADAPTER_REVISION: number
export declare const PWSH_PROVIDER_ID: string
export declare const PWSH_EFFECT_FOREGROUND: readonly ['shell-exec-powershell-win32']
export declare const PWSH_EFFECT_BACKGROUND: readonly ['shell-exec-powershell-win32', 'bg-jobs']
export declare function createGovernedPwshArm (deps?: PwshArmDeps): GovernedPwshArm
