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
 * R-1 STREAMING ARM (user ruling 07:53Z, PARALLEL-ADDITIVE): `spawnStreaming`
 * reuses the SAME prepare ladder, byte-pin double gate, one-shot plan law and
 * lease/termination vocabulary, and hands back a LIVE handle (stdin Writable,
 * stdout/stderr Readers, lease, terminate). `spawn`/`RunOutput` and every old
 * call site keep their exact historical behavior.
 *
 * @module @dsh-agent-team/runtime/sandbox-provider/provider
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawn as spawnChildProcess } from 'node:child_process'
import { type Readable, type Writable } from 'node:stream'
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
  verifyLauncherIntegrity,
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
  /** FD inheritance declarations (fd-inheritance.ts is the law). FD CONTRACT:
   *  fd 3 is launcher-owned (handshake / ruleset reservation) — declaring it
   *  is NOT using it; `prepare()` refuses such a plan as `fd-launcher-owned`
   *  before any plan or process exists, one-shot and streaming arms alike. */
  readonly declaredFds?: readonly { fd: number; purpose: 'stdin' | 'stdout' | 'stderr' | 'delivery'; resourceFingerprint: string }[]
  /**
   * B2 EXIT-CODE FIDELITY (additive, DEFAULT OFF): ask the streaming arm to carry
   * the payload's OWN completion state as the observable exit code.
   *
   * Off (every existing caller, and this field's absence is exactly "off"), the
   * stream arm keeps its historical law: the launcher exits 0 whatever the payload
   * did and the payload's code lives only in `<out-dir>/exit.json` as bookkeeping —
   * the constant-completion law the glob and search rows were built against and
   * still pin. On, the launcher re-exports the waitpid result: a payload that
   * RETURNED is reported with the code it returned, and a payload killed by signal
   * N is reported as 128+N — a value the launcher CONSTRUCTS from the convention
   * /bin/sh uses, not a code the payload returned. The two can coincide (a payload
   * that runs `exit 137` produces the number a SIGKILL death produces), so the
   * reported number never identifies a cause of death; the raw waitpid-derived rc,
   * which does separate the two cases, stays in `<out-dir>/exit.json`.
   *
   * It changes NO policy, NO grant and NO rule: the flag rides the launcher argv
   * only, which is why `prepare()` never copies it into the policy file (an extra
   * key there would be a second source of truth for the same byte).
   */
  readonly exitPassthrough?: boolean
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

// ---------------------------------------------------------------------------
// THE STREAMING ARM (R-1) — shapes. `spawnStreaming()` is the PARALLEL entry:
// same ladder, same lease law, plus live pipes.
// ---------------------------------------------------------------------------

/** The streaming launcher process as the injected seam exposes it. */
export interface LauncherStreamProcess {
  /** The LAUNCHER's pid; the confined payload's pid arrives on the fd-3 handshake. */
  readonly pid: number
  readonly stdin: Writable
  readonly stdout: Readable
  readonly stderr: Readable
  /** fd-3 handshake channel: launcher-owned, never crosses the payload boundary. */
  readonly handshake: Readable
  kill(signal?: string | number): boolean
  readonly exit: Promise<{ code: number | null; signal: string | null }>
}

/** Per-call streaming windows (tests script them per leg). */
export interface StreamingOptions {
  /** Bounded wait for the launcher's fd-3 handshake line (default 15000). */
  readonly handshakeTimeoutMs?: number
  /** SIGTERM → SIGKILL escalation point inside the terminate window (default 1500). */
  readonly graceMs?: number
  /** Bounded confirmation window; past it the lease settles `termination-unconfirmed` (default 8000). */
  readonly deadlineMs?: number
}

/** The live handle the streaming arm returns (receipt + pipes + lease + terminate). */
export interface StreamingSpawnHandle {
  readonly lease: ProviderLease
  readonly processIdentity: string
  /** The confined payload's OS pid (handshake-reported; the identity inside `processIdentity`). */
  readonly pid: number
  readonly stdin: Writable
  readonly stdout: Readable
  readonly stderr: Readable
  /**
   * Resolves when the process is OBSERVED to exit — observation never settles the
   * lease. `code` is the LAUNCHER's exit status: with the plan's `exitPassthrough`
   * unset that is the constant 0 of the historical stream arm (a 0 here therefore
   * proves nothing about the payload, which is why rows that leave the flag off
   * prove completion from the stream instead); with the flag set it is the code the
   * payload returned, or the constructed 128+signum convention for a payload killed
   * by a signal — see `SpawnRequest.exitPassthrough`, whose value can coincide with
   * a code a payload chose itself.
   */
  readonly exited: Promise<{ code: number | null; signal: string | null }>
  /** The handle's termination arm: signal (SIGTERM→SIGKILL escalation), await, settle. */
  terminate(options?: StreamingOptions): Promise<ProviderResult<ProviderLease>>
}

/** The injected world (tests inject a counting fake to watch ZERO calls). */
export interface ProviderDeps {
  readonly availability: () => { readonly rows: readonly AvailabilityRow[] }
  readonly run: (argv: readonly string[], timeoutMs?: number) => RunResult
  readonly probeFacts: () => { readonly abiVersion: number | null; readonly legs: Partial<Record<LegName, LegVerdict>> }
  /**
   * Streaming arm (R-1): spawn the launcher in stream mode with the fd-3
   * handshake channel. OPTIONAL — absent, the production arm (node:child_process
   * spawn) runs; injected, the leg watches ZERO/signal facts through the fake.
   */
  readonly spawnStream?: (argv: readonly string[]) => ProviderResult<LauncherStreamProcess>
  /** Signal the PAYLOAD pid (terminate arm). Absent: `process.kill` (false = already gone). */
  readonly signalProcess?: (pid: number, signal: 'SIGTERM' | 'SIGKILL') => boolean
  /** OS liveness of a payload pid. Absent: `/proc/<pid>` existence. */
  readonly pidAlive?: (pid: number) => boolean
}

/**
 * THE ASSEMBLY CONFIG FACE (PR4/5 install round, pb-CONTRACT.md §1): the
 * production entry parameters the assembler OWNS and this lane never
 * hardcodes. Every field is optional — ABSENT keeps the historical lane
 * default (module-relative launcher copy, `A5P4_PYTHON` env, no byte pin,
 * no ABI floor) so the DORMANT face and every existing consumer stay exact.
 *
 * The launcher path matters because the committed install surface is tsc
 * emit, which carries NO `.py` assets: the module-relative default exists
 * for the SOURCE TREE only, and an assembly that installs the lane must
 * name the trusted launcher here (that is what the W4 row had to fake
 * through the deps spy — this face is the honest seam, `provider` never
 * asks the assembler to rewrite argv).
 */
export interface ProviderAssemblyConfig {
  /** Interpreter used for probe legs and confined-exec (default: `A5P4_PYTHON` env, else `python3`). */
  readonly pythonPath?: string
  /** Absolute path of the trusted launcher script (default: the module-relative source-tree copy). */
  readonly launcherPath?: string
  /** sha256 (hex, 64) of the launcher BYTES. When set it gates every probe leg and every confined-exec. */
  readonly launcherSha256?: string
  /** Landlock ABI floor: a measured `GET_VERSION` below this refuses before any process exists. */
  readonly minAbiVersion?: number
}

/** Provider construction options. */
export interface ProviderOptions {
  readonly realmId: string
  readonly trustRoot: string | null
  readonly scratchRoot: string
  readonly deps?: ProviderDeps
  readonly hardDimensions?: readonly AssuranceDimension[]
  readonly runnerCommand?: string | null
  /** The assembler's entry parameters (see `ProviderAssemblyConfig`). */
  readonly assembly?: ProviderAssemblyConfig
  /** Bound of the settled-lease audit ledger (see the ledger block in the
   *  implementation): terminal leases are audited FIFO up to this many
   *  entries, older ones are forgotten. Default 1024. */
  readonly settledLedgerCap?: number
}

const EVIDENCE_BASE = 'evidence://a5p4/probe'

/** Create one provider instance for one realm. Probes are captured ONCE per instance. */
export function createConfinedProcessProvider(opts: ProviderOptions) {
  // Accessor casts: the runtime program carries the plugin node-min ambient
  // shim (src/plugin/node-min.d.ts) which structurally narrows the `process`
  // and `URL` globals; the lane reads env and module paths through globalThis
  // so the SHARED typecheck (`pnpm -r run typecheck`) passes untouched.
  const laneProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  const assembly: ProviderAssemblyConfig = opts.assembly ?? {}
  const launcher = createLauncherDeps({
    pythonPath: assembly.pythonPath ?? laneProcess?.env?.['A5P4_PYTHON'] ?? 'python3',
    launcherPath: assembly.launcherPath ?? join(dirname(fileURLToPath(import.meta.url)), 'launcher', 'landlock-prelauncher.py'),
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
  // ---- settled-lease audit ledger (review note (b), root 09:43Z) ------------
  // `leases`/`streamRuns` used to be append-only: EVERY one-shot spawn and
  // EVERY streaming run left entries behind forever, so a long-lived provider
  // (one realm, many calls) grew without bound. A terminal lease is no longer
  // a live claim: it is retired from the live maps into this FIFO-bounded
  // audit ledger, which keeps the FULL frozen lease record (leaseId +
  // grantFingerprint + realm/binding/member + terminal status), not just an
  // id. Behavior is preserved for every record still inside the horizon:
  // `requestCancellation`/`settleTermination` resolve through the ledger
  // exactly as through the live map (idempotent ok, same frozen bytes), and
  // `settleTermination` remains the ONLY path to 'terminated'.
  // `termination-unconfirmed` is deliberately NOT retired — it is a real
  // state that a later `settleTermination(true)` still upgrades; it stays
  // live until a terminal settle or eviction-horizon semantics apply.
  const ledgerCap = opts.settledLedgerCap ?? 1024
  const settledLeases = new Map<string, ProviderLease>() // insertion order = FIFO
  function auditSettledLease(lease: ProviderLease): void {
    settledLeases.set(lease.leaseId, lease)
    while (settledLeases.size > ledgerCap) {
      const oldest = settledLeases.keys().next()
      if (oldest.done === true) break
      settledLeases.delete(oldest.value)
    }
  }
  function heldLease(leaseId: string): ProviderLease | undefined {
    return leases.get(leaseId) ?? settledLeases.get(leaseId)
  }
  let captured: { readonly rows: readonly ProcessCapabilityRow[]; readonly evidence: ProviderProbeEvidence } | null = null

  // ---- streaming arm (R-1): state + production seam defaults ----------------
  interface StreamRun {
    readonly leaseId: string
    readonly process: LauncherStreamProcess
    readonly payloadPid: number
    exited: boolean
    exitInfo: { code: number | null; signal: string | null } | null
    readonly exitWaiters: ((v: { code: number | null; signal: string | null }) => void)[]
    killStarted: boolean
    terminating: Promise<ProviderResult<ProviderLease>> | null
  }
  const streamRuns = new Map<string, StreamRun>()

  const osProcess = (globalThis as { process?: { kill?: (pid: number, signal?: string | number) => boolean } }).process
  const defaultSpawnStream: NonNullable<ProviderDeps['spawnStream']> = (argv) => {
    try {
      const child = spawnChildProcess(launcher.pythonPath, [...argv], { stdio: ['pipe', 'pipe', 'pipe', 'pipe'] })
      const handshake = child.stdio[3] as Readable | undefined
      if (child.pid === undefined || handshake === undefined) {
        try { child.kill('SIGKILL') } catch { /* already gone */ }
        return refuse('SANDBOX_UNAVAILABLE', 'streaming launcher spawn produced no pid/fd-3 channel')
      }
      const guard = (s: Writable | Readable | null): void => { s?.on('error', () => { /* post-exit pipe errors never crash the provider */ }) }
      guard(child.stdin); guard(child.stdout); guard(child.stderr)
      const exit = new Promise<{ code: number | null; signal: string | null }>((resolve) => {
        child.once('exit', (code, signal) => resolve({ code: typeof code === 'number' ? code : null, signal: typeof signal === 'string' ? signal : '' }))
        child.once('error', () => resolve({ code: null, signal: 'spawn-error' }))
      })
      return {
        ok: true,
        value: Object.freeze({
          pid: child.pid,
          stdin: child.stdin as Writable,
          stdout: child.stdout as Readable,
          stderr: child.stderr as Readable,
          handshake,
          kill: (signal?: string | number): boolean => { try { return child.kill(signal as never) } catch { return false } },
          exit,
        }),
      }
    } catch (error) {
      return refuse('SANDBOX_UNAVAILABLE', `streaming launcher spawn failed: ${String((error as Error)?.message ?? error).slice(0, 160)}`)
    }
  }
  const streamSpawn: NonNullable<ProviderDeps['spawnStream']> = deps.spawnStream ?? defaultSpawnStream
  const signalProcess: NonNullable<ProviderDeps['signalProcess']> = deps.signalProcess
    ?? ((pid, signal) => { try { osProcess?.kill?.(pid, signal); return true } catch { return false } })
  const pidAlive: NonNullable<ProviderDeps['pidAlive']> = deps.pidAlive ?? ((pid) => existsSync(`/proc/${pid}`))

  const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

  /** Read the launcher's single-line fd-3 handshake, bounded; null = missing/unparsable/timed out. */
  function readHandshake(stream: Readable, timeoutMs: number): Promise<Record<string, unknown> | null> {
    return new Promise((resolve) => {
      let buffer = ''
      let done = false
      const onData = (chunk: unknown): void => {
        buffer += String(chunk)
        const nl = buffer.indexOf('\n')
        if (nl < 0) return
        const line = buffer.slice(0, nl).trim()
        if (line.length === 0) return
        try {
          const parsed: unknown = JSON.parse(line)
          finish(typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null)
        } catch {
          finish(null)
        }
      }
      const onEnd = (): void => { finish(null) }
      const onError = (): void => { finish(null) }
      const finish = (value: Record<string, unknown> | null): void => {
        if (done) return
        done = true
        clearTimeout(timer)
        stream.off('data', onData)
        stream.off('end', onEnd)
        stream.off('error', onError)
        resolve(value)
      }
      const timer = setTimeout(() => { finish(null) }, timeoutMs)
      stream.on('data', onData)
      stream.on('end', onEnd)
      stream.on('error', onError)
    })
  }

  /** Own the SIGNAL sequence for one streaming run (single flight; never settles a lease). */
  function beginKillSequence(run: StreamRun, graceMs: number, deadlineMs: number): void {
    if (run.killStarted) return
    run.killStarted = true
    const t0 = Date.now()
    let termSent = false
    let killSent = false
    const tick = (): void => {
      if (run.exited && !pidAlive(run.payloadPid)) return // gone; settling is the lease law's job
      if (!run.exited && pidAlive(run.payloadPid)) {
        if (!termSent) { signalProcess(run.payloadPid, 'SIGTERM'); termSent = true }
        else if (!killSent && Date.now() - t0 >= graceMs) {
          signalProcess(run.payloadPid, 'SIGKILL')
          run.process.kill('SIGKILL') // the launcher supervisor too — never leave a supervisor behind
          killSent = true
        }
      }
      if (Date.now() - t0 >= deadlineMs + 1_000) return // signal loop is bounded too
      setTimeout(tick, 25)
    }
    tick()
  }

  /**
   * The byte-pin gate (assembly.launcherSha256). UNPINNED passes — that is
   * the historical lane face. When pinned, the bytes at the configured
   * launcher path must hash to the pin; this gate runs before any probe leg
   * and again before every confined-exec (bytes swapped AFTER a clean probe
   * still never reach `run`).
   */
  function launcherIntegrityGate(): ProviderResult<true> {
    if (assembly.launcherSha256 === undefined) return { ok: true, value: true }
    const verdict = verifyLauncherIntegrity({ launcherPath: launcher.launcherPath, launcherSha256: assembly.launcherSha256 })
    if (verdict.kind === 'PINNED-MATCH') return { ok: true, value: true }
    return refuse('SANDBOX_UNAVAILABLE', `launcher integrity gate: ${verdict.detail}`)
  }

  /** probe(): availability → byte-pin gate → real legs → capability rows (cached per instance). */
  async function probe(): Promise<ProviderResult<readonly ProcessCapabilityRow[]>> {
    if (captured !== null) return { ok: true, value: captured.rows }
    const avail = deps.availability()
    const missing = avail.rows.filter((r) => !r.present && r.subject !== 'runner-command')
    if (missing.length > 0) {
      return refuse('SANDBOX_UNAVAILABLE', `confined spawn unavailable: ${missing.map((m) => m.note).join('; ')}`)
    }
    const integrity = launcherIntegrityGate()
    if (!integrity.ok) return integrity
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
    if (assembly.minAbiVersion !== undefined && captured !== null) {
      // The ABI pin (assembly floor): the assembler decides which kernel ABI
      // its realm's policies need; a measured answer below the floor refuses
      // here — BEFORE any process exists — never "runs on a weaker plane".
      const measured = captured.evidence.abiVersion
      if (measured === null || measured < assembly.minAbiVersion) {
        return refuse('SANDBOX_UNAVAILABLE', `ABI pin: the authoritative probe measured ${String(measured)}, below the assembly-pinned floor v${String(assembly.minAbiVersion)} — confined spawn refused before any process exists`)
      }
    }
    if ((opts.hardDimensions?.length ?? 0) > 0 && captured !== null) {
      const check = verifyHardProfileEvidence(captured.evidence, { realmId: request.realmId, hardDimensions: opts.hardDimensions ?? [] })
      if (!check.ok) return check
    }
    const compiled = compileFdPlan(request.declaredFds ?? [])
    if (!compiled.ok) {
      return refuse('IO_POLICY_UNSUPPORTED', `fd inheritance declaration refused: ${compiled.problems.map((x) => `${x.code} @ ${x.path}: ${x.detail}`).join('; ')}`)
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
      // runtime-base-narrow (bug fix, root 22:43Z): the flag requests the
      // launcher's EXPLICIT base enumeration (architecture.md:77 interpreter/
      // libraries/devices face = /usr, /etc, /proc — see build_ruleset in
      // landlock-prelauncher.py), NOT whole-tree READ_DIR. The former '/'
      // READ_DIR reading had no authorizing sentence (glue7 runtime-base-probe)
      // and was the name-class leak's load-bearing piece (glue7 §4b; witness
      // dev/agent-workflow/evidence/alpha5/runtime-base-narrow/). Beyond this
      // enumeration only the per-call `allow` grants below apply — a row's
      // governed anchor root rides `allowPaths` per invocation, never "/".
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
    // Re-gate the pinned bytes IMMEDIATELY before the spawn: bytes swapped
    // after a clean probe still never reach `run`. The refusal happens
    // BEFORE the plan is consumed — the one-shot grant is not burned by a
    // refusal that stopped nothing (at most one spawn per grant stays true
    // because the gate re-opens only when the bytes match the pin again).
    const integrity = launcherIntegrityGate()
    if (!integrity.ok) return integrity
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
    auditSettledLease(lease) // spawnSync semantics: born terminal — straight to the audit ledger
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

  /**
   * executeStreaming(): the R-1 arm over a PREPARED plan — same one-shot plan
   * law and same byte-pin re-gate (refusal BEFORE consumption never burns the
   * grant), then the launcher's stream mode with live pipes. The handle's
   * lease starts `active`; only `settleTermination` ever makes it terminal.
   */
  async function executeStreaming(plan: SpawnPlan, streaming?: StreamingOptions): Promise<ProviderResult<StreamingSpawnHandle>> {
    if (!plans.has(plan.planId) || consumedPlans.has(plan.planId)) {
      return refuse('IO_POLICY_UNSUPPORTED', `plan '${plan.planId}' was already consumed — re-executing a plan is a second spawn without a second grant`)
    }
    const moved = advancePhase('prepare', 'execute')
    if (!moved.ok) return refuse('IO_POLICY_UNSUPPORTED', 'phase machine refused prepare → execute (impossible on this lane; kept defensive)')
    const integrity = launcherIntegrityGate()
    if (!integrity.ok) return integrity // BEFORE consumption: the grant survives a gate refusal (same law as execute)
    consumedPlans.add(plan.planId)
    // The one place the B2 flag enters the world: an ADDITIVE token on the launcher
    // argv, present only when the REQUEST asked for it. Nothing else about the
    // launch changes, so an unset flag is the same argv, byte for byte, that every
    // pre-B2 leg has always spawned.
    const spawned = streamSpawn([launcher.launcherPath, '--confined-exec-stream', '--policy', plan.policyPath, '--out-dir', plan.outDir,
      ...(plan.request.exitPassthrough === true ? ['--exit-passthrough'] : [])])
    if (!spawned.ok) return spawned
    const proc = spawned.value
    const handshakeTimeoutMs = streaming?.handshakeTimeoutMs ?? 15_000
    const handshake = await readHandshake(proc.handshake, handshakeTimeoutMs)
    if (handshake === null || handshake['stream'] !== true || typeof handshake['pid'] !== 'number') {
      // no half-lived handles: the launcher is killed, and its reap is awaited BOUNDED
      proc.kill('SIGKILL')
      await Promise.race([proc.exit.catch(() => undefined), sleep(2_000)])
      if (handshake?.['abi_unavailable'] === true) {
        return refuse('SANDBOX_UNAVAILABLE', 'the confined launcher measured no landlock ABI at stream-exec time and refused to run the payload unconfined')
      }
      return refuse('SANDBOX_UNAVAILABLE', `streaming launcher handshake missing, unparsable or timed out (${String(handshakeTimeoutMs)}ms) — no streaming handle is issued`)
    }
    const payloadPid = handshake['pid']
    const leaseId = `lease-${plan.planId}`
    const lease: ProviderLease = Object.freeze({
      leaseId,
      grantFingerprint: plan.request.grantFingerprint,
      realmId: plan.request.realmId,
      bindingId: plan.request.bindingId,
      memberScope: plan.request.memberScope,
      executionKind: 'process' as const,
      status: 'active' as const,
    })
    const run: StreamRun = { leaseId, process: proc, payloadPid, exited: false, exitInfo: null, exitWaiters: [], killStarted: false, terminating: null }
    void proc.exit.then(
      (info) => {
        run.exited = true
        run.exitInfo = info
        for (const w of run.exitWaiters.splice(0)) w(info)
      },
      () => {
        run.exited = true
        run.exitInfo = { code: null, signal: 'exit-error' }
        for (const w of run.exitWaiters.splice(0)) w(run.exitInfo as { code: number | null; signal: string | null })
      },
    )
    leases.set(leaseId, lease)
    streamRuns.set(leaseId, run)
    const exited = new Promise<{ code: number | null; signal: string | null }>((resolve) => {
      if (run.exited && run.exitInfo !== null) resolve(run.exitInfo)
      else run.exitWaiters.push(resolve)
    })
    const terminate = (options?: StreamingOptions): Promise<ProviderResult<ProviderLease>> => {
      if (run.terminating !== null) return run.terminating
      run.terminating = (async (): Promise<ProviderResult<ProviderLease>> => {
        const held0 = heldLease(leaseId)
        if (held0 === undefined) return refuse('IO_POLICY_UNSUPPORTED', `lease '${leaseId}' is not one of this provider's leases`)
        if (held0.status === 'terminated') return { ok: true, value: held0 }
        const held = held0.status === 'active'
          ? ((): ProviderLease => { const m = Object.freeze({ ...held0, status: 'cancelling' as const }); leases.set(leaseId, m); return m })()
          : held0
        const graceMs = options?.graceMs ?? 1_500
        const deadlineMs = options?.deadlineMs ?? 8_000
        beginKillSequence(run, graceMs, deadlineMs)
        const t0 = Date.now()
        let confirmed = false
        for (;;) {
          if (run.exited && !pidAlive(payloadPid)) { confirmed = true; break }
          if (Date.now() - t0 >= deadlineMs) break
          await sleep(25)
        }
        return settleTermination(held, confirmed)
      })()
      return run.terminating
    }
    const handle: StreamingSpawnHandle = Object.freeze({
      lease,
      processIdentity: `pid:${payloadPid}:${plan.planId}`,
      pid: payloadPid,
      stdin: proc.stdin,
      stdout: proc.stdout,
      stderr: proc.stderr,
      exited,
      terminate,
    })
    return { ok: true, value: handle }
  }

  /** spawnStreaming(): prepare + executeStreaming as ONE call (the R-1 parallel entry). */
  async function spawnStreaming(request: SpawnRequest, streaming?: StreamingOptions): Promise<ProviderResult<StreamingSpawnHandle>> {
    const prepared = await prepare(request)
    if (!prepared.ok) return prepared
    return executeStreaming(prepared.value, streaming)
  }

  /** requestCancellation(): the REQUEST leg — moves the lease, settles via the sync reap. */
  async function requestCancellation(lease: ProviderLease): Promise<ProviderResult<ProviderLease>> {
    const held = heldLease(lease.leaseId)
    if (held === undefined) {
      return refuse('IO_POLICY_UNSUPPORTED', `lease '${lease.leaseId}' is not one of this provider's leases`)
    }
    const run = streamRuns.get(lease.leaseId)
    if (run !== undefined) {
      // Async streaming semantics (R-1): the REQUEST moves the lease to
      // 'cancelling' and starts the signal sequence — it NEVER settles the
      // lease itself; only settleTermination does (the frozen law).
      if (held.status === 'active') {
        const moved = Object.freeze({ ...held, status: 'cancelling' as const })
        leases.set(lease.leaseId, moved)
        beginKillSequence(run, 1_500, 8_000)
        return { ok: true, value: moved }
      }
      return { ok: true, value: held }
    }
    if (held.status === 'terminated') return { ok: true, value: held }
    // Sync spawn semantics: when run() returned the child is already reaped,
    // so the request settles confirmed HERE. An async provider settles with
    // settleTermination instead — the request never settles itself.
    const settled: ProviderLease = Object.freeze({ ...held, status: 'terminated' as const })
    leases.delete(held.leaseId)
    auditSettledLease(settled)
    return { ok: true, value: settled }
  }

  /** settleTermination(): the ONLY path to a terminal lease status. */
  async function settleTermination(lease: ProviderLease, confirmed = true): Promise<ProviderResult<ProviderLease>> {
    const held = heldLease(lease.leaseId)
    if (held === undefined) {
      return refuse('IO_POLICY_UNSUPPORTED', `lease '${lease.leaseId}' is not one of this provider's leases`)
    }
    if (held.status === 'terminated') return { ok: true, value: held }
    const next = confirmed
      ? Object.freeze({ ...held, status: 'terminated' as const })
      : Object.freeze({ ...held, status: 'termination-unconfirmed' as const })
    if (next.status === 'terminated') {
      // settled terminal: the live claim ends here — release the process
      // handle (streamRuns) and retire the frozen record to the bounded
      // audit ledger. `termination-unconfirmed` stays LIVE on purpose.
      leases.delete(held.leaseId)
      streamRuns.delete(held.leaseId)
      auditSettledLease(next)
    } else {
      leases.set(held.leaseId, next)
    }
    return { ok: true, value: next }
  }

  /** Read-only bookkeeping (review note (b) forensics): the live maps must
   *  stay bounded for a long-lived realm; the settled ledger is FIFO-capped. */
  function bookkeeping(): { readonly liveLeases: number; readonly streamRuns: number; readonly settledLedger: number; readonly settledLedgerCap: number } {
    return Object.freeze({ liveLeases: leases.size, streamRuns: streamRuns.size, settledLedger: settledLeases.size, settledLedgerCap: ledgerCap })
  }

  return Object.freeze({ probe, prepare, execute, spawn, spawnStreaming, executeStreaming, requestCancellation, settleTermination, bookkeeping })
}
