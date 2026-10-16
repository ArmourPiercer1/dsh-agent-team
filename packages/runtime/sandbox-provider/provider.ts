/**
 * THE CONFINED PROCESS PROVIDER — the lane's implementation of the frozen
 * `ConfinedProcessProvider` seam shape (probe / spawn / requestCancellation /
 * settleTermination) over the C-PROC phase closed set, the Linux P1 posture
 * (the trusted launcher self-locks at child entry, THEN execs the untrusted
 * argv — the DSH host process never calls `landlock_restrict_self`), and the
 * NO-FALLBACK law: when the launcher is absent, the ABI does not answer, or
 * a hard-required dimension lacks its double evidence, the refusal is typed
 * and happens BEFORE any process exists. "Sandbox unavailable → run naked"
 * cannot be expressed through this seam.
 *
 * DORMANT: this provider is wired to nothing. `prepare`/`execute` are exposed
 * as a real split (plan PoC-4c: async launch may hold prepare aside from
 * execute; a plan is ONE-SHOT — consuming it twice is a second spawn without
 * a second grant, so the second execute is refused). Cancellation settles
 * through the lease law (`settleTermination` is the only path to
 * `terminated`; an unconfirmed settlement keeps its `sideEffectUnknown`).
 *
 * @module @dsh-agent-team/runtime/sandbox-provider/provider
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { refuse, type AssuranceDimension, type ProcessCapabilityRow, type ProviderResult } from './contract-stub.js'
import { advancePhase } from './phases.js'
import { compileFdPlan, fdPlanToPayload, type FdPlan } from './fd-inheritance.js'
import { evaluateNetworkRequirement } from './network.js'
import {
  createLauncherDeps,
  probeToCapabilities,
  runAbiProbe,
  runAvailabilityPreflight,
  runEnforcementLeg,
  ENFORCEMENT_LEGS,
  type AvailabilityRow,
  type LegName,
  type LegVerdict,
  type RunResult,
} from './probe-abi.js'
import { recordLegEvidence, verifyHardProfileEvidence, type LegEvidenceRow, type ProviderProbeEvidence } from './realm-evidence.js'

// ---------------------------------------------------------------------------
// Request / plan / receipt shapes (grant-per-call by FINGERPRINT — the grant
// itself lives in the PR2 admission lane; the provider verifies identity, it
// never mints or reads a wallet).
// ---------------------------------------------------------------------------

/** One path allow-entry with the named access bits the launcher maps. */
export interface AllowPathEntry {
  readonly path: string
  readonly accessBits: {
    readonly execute?: boolean
    readonly writeFile?: boolean
    readonly readFile?: boolean
    readonly readDir?: boolean
    readonly removeFile?: boolean
    readonly makeReg?: boolean
    readonly truncate?: boolean
  }
}

/** One confined-spawn request (argv is an explicit array — never a shell string). */
export interface SpawnRequest {
  readonly grantFingerprint: string
  readonly realmId: string
  readonly bindingId: string
  readonly memberScope: string
  readonly argv: readonly string[]
  readonly cwd: string
  readonly env: readonly (readonly [string, string])[]
  readonly networkProfile?: 'deny' | 'restricted'
  readonly allowPaths?: readonly AllowPathEntry[]
  readonly declaredFds?: readonly { fd: number; purpose: 'stdin' | 'stdout' | 'stderr' | 'delivery'; resourceFingerprint: string }[]
}

/** The lease the provider issues (mirror of the frozen lease vocabulary). */
export interface ProviderLease {
  readonly leaseId: string
  readonly grantFingerprint: string
  readonly realmId: string
  readonly bindingId: string
  readonly memberScope: string
  readonly executionKind: 'process'
  readonly status: 'active' | 'cancelling' | 'termination-unconfirmed' | 'terminated'
}

/** The compiled, ONE-SHOT execution plan (prepare output, execute input). */
export interface SpawnPlan {
  readonly planId: string
  readonly phase: 'prepared'
  readonly request: SpawnRequest
  readonly policyPath: string
  readonly outDir: string
  readonly fdPlan: FdPlan
}

/** The bounded output of one confined run. */
export interface RunOutput {
  readonly stdout: string
  readonly stderr: string
  readonly combined: string
}

/** Spawn receipt: the process identity AND the lease that scopes it. */
export interface SpawnReceipt {
  readonly lease: ProviderLease
  readonly processIdentity: string
}

/** The injected world (tests inject a counting fake to watch ZERO calls). */
export interface ProviderDeps {
  readonly availability: () => { readonly rows: readonly AvailabilityRow[] }
  readonly run: (argv: readonly string[], timeoutMs?: number) => RunResult
  readonly probeFacts: () => { readonly abiVersion: number | null; readonly legs: Partial<Record<LegName, LegVerdict>> }
}

/** Provider construction options. */
export interface ProviderOptions {
  readonly realmId: string
  readonly trustRoot: string | null
  readonly scratchRoot: string
  readonly deps?: ProviderDeps
  readonly hardDimensions?: readonly AssuranceDimension[]
  readonly runnerCommand?: string | null
}

const EVIDENCE_BASE = 'evidence://a5p4/probe'

/** Create one provider instance for one realm. Probes are captured ONCE per instance. */
export function createConfinedProcessProvider(opts: ProviderOptions) {
  // Accessor casts: the runtime program carries the plugin node-min ambient
  // shim (src/plugin/node-min.d.ts) which structurally narrows the `process`
  // and `URL` globals; the lane reads env and module paths through globalThis
  // so the SHARED typecheck (`pnpm -r run typecheck`) passes untouched.
  const laneProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  const launcher = createLauncherDeps({
    pythonPath: laneProcess?.env?.['A5P4_PYTHON'] ?? 'python3',
    launcherPath: join(dirname(fileURLToPath(import.meta.url)), 'launcher', 'landlock-prelauncher.py'),
  })
  const deps: ProviderDeps = opts.deps ?? {
    availability: () => ({
      rows: runAvailabilityPreflight({
        pythonPath: launcher.pythonPath,
        launcherPath: launcher.launcherPath,
        runnerCommand: opts.runnerCommand ?? null,
      }),
    }),
    run: launcher.run,
    probeFacts: () => {
      const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
      const abi = runAbiProbe(launcher)
      const legs: Partial<Record<LegName, LegVerdict>> = {}
      for (const leg of ENFORCEMENT_LEGS) legs[leg] = runEnforcementLeg(launcher, leg, join(opts.scratchRoot, `probe-${stamp}`, leg))
      return { abiVersion: abi.abiVersion, legs }
    },
  }

  const plans = new Map<string, SpawnPlan>()
  const consumedPlans = new Set<string>()
  const leases = new Map<string, ProviderLease>()
  let captured: { readonly rows: readonly ProcessCapabilityRow[]; readonly evidence: ProviderProbeEvidence } | null = null

  /** probe(): availability → real legs → capability rows (cached per instance). */
  async function probe(): Promise<ProviderResult<readonly ProcessCapabilityRow[]>> {
    if (captured !== null) return { ok: true, value: captured.rows }
    const avail = deps.availability()
    const missing = avail.rows.filter((r) => !r.present && r.subject !== 'runner-command')
    if (missing.length > 0) {
      return refuse('SANDBOX_UNAVAILABLE', `confined spawn unavailable: ${missing.map((m) => m.note).join('; ')}`)
    }
    const facts = deps.probeFacts()
    const evidenceRef = `${EVIDENCE_BASE}/${opts.realmId}/${Date.now().toString(36)}`
    const legs: readonly LegEvidenceRow[] = Object.entries(facts.legs).map(([leg, v]) =>
      recordLegEvidence(leg as LegName, v?.verdict ?? 'MIXED/FAILED', evidenceRef, ['--enforce-leg', leg]))
    const rows = probeToCapabilities(
      { kind: facts.abiVersion === null ? 'abi-unavailable' : 'abi-available', abiVersion: facts.abiVersion, rawLines: [], syscall: 'landlock_create_ruleset(NULL,0,GET_VERSION)' },
      facts.legs,
      { realmId: opts.realmId, trustRoot: opts.trustRoot, evidenceRef },
    )
    captured = { rows, evidence: { realmId: opts.realmId, trustRoot: opts.trustRoot, abiVersion: facts.abiVersion, legs, capabilities: rows } }
    return { ok: true, value: rows }
  }

  /** prepare(): every gate BEFORE any process exists; compiles the launcher policy. */
  async function prepare(request: SpawnRequest): Promise<ProviderResult<SpawnPlan>> {
    if (request.argv.length === 0 || request.argv.some((a) => typeof a !== 'string' || a.length === 0)) {
      return refuse('IO_POLICY_UNSUPPORTED', 'argv must be a non-empty array of non-empty strings (explicit argv, never a shell string)')
    }
    if (request.realmId !== opts.realmId) {
      return refuse('IO_POLICY_UNSUPPORTED', `realm confusion: request carries realm '${request.realmId}', this provider is bound to '${opts.realmId}'`)
    }
    const net = evaluateNetworkRequirement(request.networkProfile, request.realmId)
    if (!net.ok) return net
    const p = await probe()
    if (!p.ok) return p
    if (captured !== null && captured.evidence.abiVersion === null) {
      // The authoritative probe measured NO landlock ABI on this host.
      // Confinement is impossible and the naked-spawn arm does not exist.
      return refuse('SANDBOX_UNAVAILABLE', 'confined spawn refused: the authoritative probe measured no landlock ABI on this host; an unconfined fallback is forbidden by construction')
    }
    if ((opts.hardDimensions?.length ?? 0) > 0 && captured !== null) {
      const check = verifyHardProfileEvidence(captured.evidence, { realmId: request.realmId, hardDimensions: opts.hardDimensions ?? [] })
      if (!check.ok) return check
    }
    const compiled = compileFdPlan(request.declaredFds ?? [])
    if (!compiled.ok) {
      return refuse('IO_POLICY_UNSUPPORTED', `fd inheritance declaration refused: ${compiled.problems.map((x) => `${x.path}: ${x.detail}`).join('; ')}`)
    }
    const planId = `plan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    const plansDir = join(opts.scratchRoot, 'plans')
    mkdirSync(plansDir, { recursive: true })
    const outDir = join(opts.scratchRoot, 'out', planId)
    mkdirSync(outDir, { recursive: true })
    const policyPath = join(plansDir, `${planId}.json`)
    const policy = {
      argv: [...request.argv],
      cwd: request.cwd,
      env: request.env.map(([k, v]) => [k, v]),
      runtime_base: true,
      allow: (request.allowPaths ?? []).map((a) => ({
        path: a.path,
        bits: {
          execute: a.accessBits.execute === true,
          write_file: a.accessBits.writeFile === true,
          read_file: a.accessBits.readFile === true,
          read_dir: a.accessBits.readDir === true,
          remove_file: a.accessBits.removeFile === true,
          make_reg: a.accessBits.makeReg === true,
          truncate: a.accessBits.truncate === true,
        },
      })),
      fd_plan: fdPlanToPayload(compiled.plan),
      close_extra_fds: true,
    }
    writeFileSync(policyPath, JSON.stringify(policy))
    const plan: SpawnPlan = Object.freeze({ planId, phase: 'prepared' as const, request, policyPath, outDir, fdPlan: compiled.plan })
    plans.set(planId, plan)
    return { ok: true, value: plan }
  }

  /** execute(): consumes a prepared plan EXACTLY ONCE; runs the launcher confined-exec. */
  async function execute(plan: SpawnPlan): Promise<ProviderResult<{ receipt: SpawnReceipt; output: RunOutput; lease: ProviderLease }>> {
    if (!plans.has(plan.planId) || consumedPlans.has(plan.planId)) {
      return refuse('IO_POLICY_UNSUPPORTED', `plan '${plan.planId}' was already consumed — re-executing a plan is a second spawn without a second grant`)
    }
    const moved = advancePhase('prepare', 'execute')
    if (!moved.ok) return refuse('IO_POLICY_UNSUPPORTED', 'phase machine refused prepare → execute (impossible on this lane; kept defensive)')
    consumedPlans.add(plan.planId)
    const r = deps.run([launcher.launcherPath, '--confined-exec', '--policy', plan.policyPath, '--out-dir', plan.outDir], 60_000)
    let answer: Record<string, unknown> | null = null
    try {
      const line = r.stdout.trim().split('\n').filter((l) => l.length > 0).pop()
      if (line !== undefined) answer = JSON.parse(line) as Record<string, unknown>
    } catch {
      answer = null
    }
    if (answer === null) {
      return refuse('SANDBOX_UNAVAILABLE', `launcher answer unparseable (rc=${String(r.rc)}); the confined run's outcome is unknown — never assumed benign: ${(r.stderr || r.stdout).slice(0, 240)}`)
    }
    if (answer['abi_unavailable'] === true) {
      return refuse('SANDBOX_UNAVAILABLE', 'the confined launcher measured no landlock ABI at exec time and refused to run the payload unconfined')
    }
    const readOut = (ref: unknown): string => {
      if (typeof ref !== 'string') return ''
      try {
        return readFileSync(ref, 'utf8').slice(0, 64 * 1024)
      } catch {
        return ''
      }
    }
    const stdout = readOut(answer['out_ref'])
    const stderr = readOut(answer['err_ref'])
    const leaseId = `lease-${plan.planId}`
    const status: ProviderLease['status'] = 'terminated' // spawnSync semantics: the child is reaped when run() returns
    const lease: ProviderLease = Object.freeze({
      leaseId,
      grantFingerprint: plan.request.grantFingerprint,
      realmId: plan.request.realmId,
      bindingId: plan.request.bindingId,
      memberScope: plan.request.memberScope,
      executionKind: 'process' as const,
      status,
    })
    leases.set(leaseId, lease)
    const pid = typeof answer['pid'] === 'number' ? answer['pid'] : 0
    const receipt: SpawnReceipt = Object.freeze({ lease, processIdentity: `pid:${pid}:${plan.planId}` })
    return { ok: true, value: Object.freeze({ receipt, output: Object.freeze({ stdout, stderr, combined: stdout + stderr }), lease }) }
  }

  /** spawn(): prepare + execute as ONE call (the frozen seam's shape). */
  async function spawn(request: SpawnRequest): Promise<ProviderResult<{ receipt: SpawnReceipt; output: RunOutput; lease: ProviderLease }>> {
    const prepared = await prepare(request)
    if (!prepared.ok) return prepared
    return execute(prepared.value)
  }

  /** requestCancellation(): the REQUEST leg — moves the lease, settles via the sync reap. */
  async function requestCancellation(lease: ProviderLease): Promise<ProviderResult<ProviderLease>> {
    const held = leases.get(lease.leaseId)
    if (held === undefined) {
      return refuse('IO_POLICY_UNSUPPORTED', `lease '${lease.leaseId}' is not one of this provider's leases`)
    }
    if (held.status === 'terminated') return { ok: true, value: held }
    // Sync spawn semantics: when run() returned the child is already reaped,
    // so the request settles confirmed HERE. An async provider settles with
    // settleTermination instead — the request never settles itself.
    const settled: ProviderLease = Object.freeze({ ...held, status: 'terminated' as const })
    leases.set(held.leaseId, settled)
    return { ok: true, value: settled }
  }

  /** settleTermination(): the ONLY path to a terminal lease status. */
  async function settleTermination(lease: ProviderLease, confirmed = true): Promise<ProviderResult<ProviderLease>> {
    const held = leases.get(lease.leaseId)
    if (held === undefined) {
      return refuse('IO_POLICY_UNSUPPORTED', `lease '${lease.leaseId}' is not one of this provider's leases`)
    }
    if (held.status === 'terminated') return { ok: true, value: held }
    const next = confirmed
      ? Object.freeze({ ...held, status: 'terminated' as const })
      : Object.freeze({ ...held, status: 'termination-unconfirmed' as const })
    leases.set(held.leaseId, next)
    return { ok: true, value: next }
  }

  return Object.freeze({ probe, prepare, execute, spawn, requestCancellation, settleTermination })
}
