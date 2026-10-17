/**
 * THE AUTHORITATIVE PROBE SURFACE — the ruling from
 * `evidence/alpha5/pr4-pre/findings-landlock-probe-divergence.md` §3, adopted
 * verbatim into C-PROC:
 *
 *   authoritative surface = BARE SYSCALL `GET_VERSION` + REAL enforcement,
 *   BOTH legs (the launcher self-confines inside its own process — the host
 *   process never calls `landlock_restrict_self`, and no system setting is
 *   touched); existence checks (python3 / launcher script / `runnerCommand`)
 *   are PRECONDITION REPORTS ONLY and their wording must carry NO
 *   kernel-capability assertion — the host bash backend's historical defect
 *   was exactly "a missing binary probes unusable the same way an unenforcing
 *   kernel does"; the host-side copy fix is an upstream seam request (lane
 *   doc), not an edit this lane may make.
 *
 * Every integer crosses the syscall boundary as `c_long` and the ruleset
 * attribute is `pack("@QQ")` / the rule `pack("@Qi")` — the exact measured
 * posture of `04-process/landlock-diag.sh` and `10-landlock-lanes`, kept in
 * the reference launcher this module shells out to (fixed argv arrays, never
 * a shell string).
 *
 * @module @dsh-agent-team/runtime/sandbox-provider/probe-abi
 */

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { type AssuranceDimension, type ProcessCapabilityRow } from './contract-stub.js'
import { networkProbeRow } from './network.js'
import { fdPlanToPayload, type FdPlan } from './fd-inheritance.js'

/** One launcher invocation outcome (no shell — argv arrays only). */
export interface RunResult {
  readonly rc: number | null
  readonly stdout: string
  readonly stderr: string
}

/** Everything this module needs from the outside world, injectable for tests. */
export interface LauncherDeps {
  readonly pythonPath: string
  readonly launcherPath: string
  readonly run: (argv: readonly string[], timeoutMs?: number) => RunResult
}

/** The production deps: spawnSync without a shell, bounded buffers. */
export function createLauncherDeps(init: { pythonPath: string; launcherPath: string }): LauncherDeps {
  return Object.freeze({
    ...init,
    run: (argv: readonly string[], timeoutMs?: number): RunResult => {
      const r = spawnSync(init.pythonPath, [...argv], { encoding: 'utf8', timeout: timeoutMs ?? 20_000, maxBuffer: 8 * 1024 * 1024 })
      if (r.error !== undefined && r.status === null) {
        return { rc: null, stdout: '', stderr: String(r.error.message ?? r.error) }
      }
      return { rc: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
    },
  })
}

/** Parse the launcher's single-line JSON verdict (never throws: unparseable is a MIXED/FAILED leg). */
function parseVerdict(stdout: string): Record<string, unknown> | null {
  const line = stdout.trim().split('\n').filter((l) => l.length > 0).pop()
  if (line === undefined) return null
  try {
    const parsed: unknown = JSON.parse(line)
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function strArray(v: unknown): readonly string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

/** The ABI probe verdict (bare `landlock_create_ruleset(NULL, 0, GET_VERSION)`). */
export interface AbiVerdict {
  readonly kind: 'abi-available' | 'abi-unavailable'
  readonly abiVersion: number | null
  readonly rawLines: readonly string[]
  readonly syscall: string
}

/** Run the ABI probe leg (GET_VERSION) through the launcher. */
export function runAbiProbe(deps: LauncherDeps): AbiVerdict {
  const r = deps.run([deps.launcherPath, '--abi-probe'])
  const v = parseVerdict(r.stdout)
  if (v !== null && v['kind'] === 'abi-available' && typeof v['abi_version'] === 'number') {
    return Object.freeze({ kind: 'abi-available', abiVersion: v['abi_version'], rawLines: strArray(v['raw']), syscall: 'landlock_create_ruleset(NULL,0,GET_VERSION)' })
  }
  const rawLines = v !== null ? strArray(v['raw']) : [`launcher answer unparseable rc=${String(r.rc)}`, ...r.stderr.split('\n').filter(Boolean)]
  return Object.freeze({ kind: 'abi-unavailable', abiVersion: null, rawLines, syscall: 'landlock_create_ruleset(NULL,0,GET_VERSION)' })
}

/** The three enforcement legs pinned by the C-PROC ruling. */
export const ENFORCEMENT_LEGS = ['selective', 'denyall', 'badhandled'] as const
export type LegName = (typeof ENFORCEMENT_LEGS)[number]

/** One check inside a leg (name / expect / got / match — raw errno words). */
export interface LegCheck {
  readonly name: string
  readonly expect: string
  readonly got: string
  readonly match: boolean
}

/** One enforcement leg verdict. */
export interface LegVerdict {
  readonly leg: LegName
  readonly verdict: 'ENFORCE-CONFIRMED' | 'DEMO-CONFIRMED' | 'NO-ENFORCEMENT' | 'MIXED/FAILED' | 'ABI-UNAVAILABLE'
  readonly rc: number | null
  readonly checks: readonly LegCheck[]
}

function toChecks(v: unknown): readonly LegCheck[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null)
    .map((c) => Object.freeze({
      name: typeof c['name'] === 'string' ? c['name'] : '?',
      expect: typeof c['expect'] === 'string' ? c['expect'] : '?',
      got: typeof c['got'] === 'string' ? c['got'] : '?',
      match: c['match'] === true,
    }))
}

/** Run one real enforcement leg; the launcher self-confines, this process never does. */
export function runEnforcementLeg(deps: LauncherDeps, leg: LegName, scratchDir: string): LegVerdict {
  mkdirSync(scratchDir, { recursive: true })
  const r = deps.run([deps.launcherPath, '--enforce-leg', leg, '--scratch', scratchDir])
  const v = parseVerdict(r.stdout)
  const verdict = v !== null && typeof v['verdict'] === 'string' ? v['verdict'] : 'MIXED/FAILED'
  const known = ['ENFORCE-CONFIRMED', 'DEMO-CONFIRMED', 'NO-ENFORCEMENT', 'MIXED/FAILED', 'ABI-UNAVAILABLE'] as const
  return Object.freeze({
    leg,
    verdict: (known as readonly string[]).includes(verdict) ? (verdict as LegVerdict['verdict']) : 'MIXED/FAILED',
    rc: r.rc,
    checks: toChecks(v?.['checks']),
  })
}

/** The FD-closure leg (P2 fork-not-exec handoff). */
export interface FdCloseVerdict {
  readonly verdict: 'FD-CLOSURE-CONFIRMED' | 'NO-ENFORCEMENT' | 'MIXED/FAILED' | 'ABI-UNAVAILABLE'
  readonly declaredSeen: boolean | null
  readonly undeclaredClosed: boolean | null
  readonly rc: number | null
}

/** Run the real FD-closure leg: ruleset compiled parent-side, fork (no exec), child closes undeclared + self-locks. */
export function runFdCloseProbe(deps: LauncherDeps, scratchDir: string, plan?: FdPlan): FdCloseVerdict {
  mkdirSync(scratchDir, { recursive: true })
  const payload = plan === undefined ? '' : JSON.stringify(fdPlanToPayload(plan))
  const argv = [deps.launcherPath, '--fd-close', '--scratch', scratchDir]
  if (payload !== '') argv.push('--fd-plan-json', payload)
  const r = deps.run(argv)
  const v = parseVerdict(r.stdout)
  if (v === null) return { verdict: 'MIXED/FAILED', declaredSeen: null, undeclaredClosed: null, rc: r.rc }
  const known = ['FD-CLOSURE-CONFIRMED', 'NO-ENFORCEMENT', 'MIXED/FAILED', 'ABI-UNAVAILABLE'] as const
  const verdict = typeof v['verdict'] === 'string' && (known as readonly string[]).includes(v['verdict']) ? (v['verdict'] as FdCloseVerdict['verdict']) : 'MIXED/FAILED'
  return Object.freeze({
    verdict,
    declaredSeen: typeof v['declared_seen'] === 'boolean' ? v['declared_seen'] : null,
    undeclaredClosed: typeof v['undeclared_closed'] === 'boolean' ? v['undeclared_closed'] : null,
    rc: r.rc,
  })
}

// ---------------------------------------------------------------------------
// LAUNCHER INTEGRITY — the assembly-pinned BYTES gate (PR4/5 install round,
// pb-CONTRACT.md §1.3). The existence preflight above only asks "is a file
// there"; an installer or a swapped tree answers YES to a file that is NOT
// the bytes the assembler trusted. When the assembly pins `launcherSha256`,
// the provider verifies the bytes at the configured path BEFORE any probe
// leg runs and AGAINST THE SAME PATH before every confined-exec. Like every
// refusal on this lane it is typed and happens before any process exists.
// ---------------------------------------------------------------------------

/** Inputs (the `read` seam is injectable for tests; production reads the file). */
export interface LauncherIntegrityInput {
  readonly launcherPath: string
  readonly launcherSha256: string
  readonly read?: (path: string) => Uint8Array
}

export type LauncherIntegrityKind = 'PINNED-MATCH' | 'PIN-MISMATCH' | 'UNREADABLE' | 'INVALID-PIN'

/** One integrity verdict. `observed`/`pinned` are full sha256 hex (public bytes-hash facts). */
export interface LauncherIntegrityVerdict {
  readonly kind: LauncherIntegrityKind
  readonly pinned: string
  readonly observed: string | null
  readonly detail: string
}

/** Verify the launcher bytes against the assembly pin. Never throws. */
export function verifyLauncherIntegrity(input: LauncherIntegrityInput): LauncherIntegrityVerdict {
  const pinned = String(input.launcherSha256 ?? '').trim().toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(pinned)) {
    return Object.freeze({ kind: 'INVALID-PIN', pinned, observed: null, detail: `assembly launcherSha256 pin is not a 64-hex-digit sha256 (got '${pinned.slice(0, 72)}') — the pin itself is a configuration defect, refusing closed` })
  }
  let bytes: Uint8Array
  try {
    bytes = input.read !== undefined ? input.read(input.launcherPath) : readFileSync(input.launcherPath)
  } catch (error) {
    return Object.freeze({ kind: 'UNREADABLE', pinned, observed: null, detail: `launcher file at '${input.launcherPath}' could not be read (${String((error as Error)?.message ?? error).slice(0, 160)}) — the pinned bytes cannot be verified, refusing closed` })
  }
  const observed = createHash('sha256').update(bytes).digest('hex')
  if (observed === pinned) {
    return Object.freeze({ kind: 'PINNED-MATCH', pinned, observed, detail: `launcher bytes at '${input.launcherPath}' hash to the assembly-pinned sha256` })
  }
  return Object.freeze({ kind: 'PIN-MISMATCH', pinned, observed, detail: `launcher bytes at '${input.launcherPath}' hash to sha256:${observed}, the assembly pins sha256:${pinned} — the bytes at the configured path are NOT the trusted bytes, refusing closed` })
}

// ---------------------------------------------------------------------------
// EXISTENCE PREFLIGHT — precondition reports only; NO kernel assertions.
// ---------------------------------------------------------------------------

/** The vocabulary an availability note must NEVER contain (ruling: 文案禁内核断言). */
export const KERNEL_ASSERTION_FORBIDDEN = ['kernel', 'landlock', 'enforc', 'abi', 'syscall'] as const

/** One precondition row. */
export interface AvailabilityRow {
  readonly subject: 'python3' | 'launcher-script' | 'runner-command'
  readonly present: boolean
  readonly note: string
}

/** Preflight inputs (kept structural so tests can simulate an absent runtime). */
export interface PreflightInput {
  readonly pythonPath: string
  readonly launcherPath: string
  readonly runnerCommand: string | null
}

/**
 * Run the existence preflight. Failure notes state ONLY what was looked for
 * and not found; whether the KERNEL can enforce is a question this function
 * has no way to answer and therefore never comments on.
 */
export function runAvailabilityPreflight(input: PreflightInput): readonly AvailabilityRow[] {
  const rows: AvailabilityRow[] = []
  const py = spawnSync(input.pythonPath, ['--version'], { encoding: 'utf8', timeout: 10_000 })
  const pyPresent = py.status === 0
  rows.push(Object.freeze({
    subject: 'python3',
    present: pyPresent,
    note: pyPresent
      ? `precondition check: python interpreter '${input.pythonPath}' present`
      : `precondition check: python interpreter '${input.pythonPath}' not found (presence only — this report states nothing else)`,
  }))
  const launcherPresent = spawnSync(input.pythonPath, ['-c', `import os,sys; sys.exit(0 if os.path.isfile(${JSON.stringify(input.launcherPath)}) else 1)`], { timeout: 10_000 }).status === 0
    || spawnSync('test', ['-f', input.launcherPath], { timeout: 5_000 }).status === 0
  rows.push(Object.freeze({
    subject: 'launcher-script',
    present: launcherPresent,
    note: launcherPresent
      ? `precondition check: launcher script '${input.launcherPath}' present`
      : `precondition check: launcher script '${input.launcherPath}' not found (presence only — this report states nothing else)`,
  }))
  const runnerPresent = input.runnerCommand !== null && input.runnerCommand.trim().length > 0
  rows.push(Object.freeze({
    subject: 'runner-command',
    present: runnerPresent,
    note: runnerPresent
      ? `precondition check: Config.runnerCommand '${String(input.runnerCommand)}' configured (escape hatch)`
      : 'precondition check: no Config.runnerCommand configured (optional escape hatch; its absence changes nothing for the local launcher path)',
  }))
  return Object.freeze(rows)
}

// ---------------------------------------------------------------------------
// THE DOUBLE-EVIDENCE MAPPING — verdicts → capability rows.
// ---------------------------------------------------------------------------

/** The probe inputs the mapping reads (kept a pure function of verdicts). */
export interface ProbeFacts {
  readonly abiVersion: number | null
  readonly legs: Partial<Record<LegName, LegVerdict>>
}

/** Where the rows bind their claims. */
export interface ProbeBinding {
  readonly realmId: string
  readonly trustRoot: string | null
  readonly evidenceRef: string
}

function bothConfirm(abi: AbiVerdict, legs: Partial<Record<LegName, LegVerdict>>): boolean {
  return typeof abi.abiVersion === 'number'
    && legs.selective?.verdict === 'ENFORCE-CONFIRMED'
    && legs.denyall?.verdict === 'ENFORCE-CONFIRMED'
}

/**
 * Map probe facts to capability rows under the DOUBLE-EVIDENCE LAW:
 * `enforced` is issued only when GET_VERSION answered AND BOTH enforcement
 * legs confirmed; any missing or MIXED leg demotes. The rows the lane can
 * never claim (metadata hiding, alias safety, network deny) stay `unsupported`
 * whatever the host says (PoC-4a / PoC-4b posture, no-overclaim law).
 */
export function probeToCapabilities(abi: AbiVerdict, legs: Partial<Record<LegName, LegVerdict>>, binding: ProbeBinding): readonly ProcessCapabilityRow[] {
  const facts: ProbeFacts = { abiVersion: abi.abiVersion, legs }
  const dbl = bothConfirm(abi, legs)
  const abiVersion = facts.abiVersion
  const mech = abiVersion === null ? null : `landlock ABI v${abiVersion} entry self-lock (bare syscalls 444/445/446), selective+denyall double evidence`
  const writeNeg = facts.legs.selective?.checks.some((c) => c.name.startsWith('NEG create') && c.match) === true
  const rows: ProcessCapabilityRow[] = [
    Object.freeze({
      dimension: 'content-read' as AssuranceDimension,
      level: dbl ? ('enforced' as const) : ('untested' as const),
      mechanism: dbl ? mech : null,
      realmId: binding.realmId,
      trustRoot: dbl ? binding.trustRoot : null,
      evidence: dbl ? binding.evidenceRef : null,
      note: dbl
        ? 'GET_VERSION answered and selective+denyall both ENFORCE-CONFIRMED with raw errno words; badhandled discriminator proves the negative control can detect missing enforcement'
        : 'no double enforcement evidence on this host — content-read is UNTESTED, not "absent", not "denied"',
    }),
    Object.freeze({
      dimension: 'write' as AssuranceDimension,
      level: dbl && writeNeg ? ('enforced' as const) : dbl ? ('partial' as const) : ('untested' as const),
      mechanism: dbl ? mech : null,
      realmId: binding.realmId,
      trustRoot: dbl ? binding.trustRoot : null,
      evidence: dbl ? binding.evidenceRef : null,
      note: dbl
        ? writeNeg
          ? 'create-NEG legs confirmed EACCES inside the domain (clean landlock write refusal, not a mount artifact)'
          : 'double enforcement confirmed but the create-NEG legs did not match — write demotes to partial, never rides on read'
        : 'no double enforcement evidence on this host',
    }),
    Object.freeze({
      dimension: 'directory-metadata' as AssuranceDimension,
      level: 'unsupported' as const,
      mechanism: null,
      realmId: binding.realmId,
      trustRoot: null,
      evidence: null,
      note: 'landlock read enforcement does not hide metadata; READ_DIR grants directory-name enumeration by design (PoC-4a posture — strict metadata isolation is a mount-namespace capability this lane has not demonstrated)',
    }),
    Object.freeze({
      dimension: 'alias' as AssuranceDimension,
      level: 'unsupported' as const,
      mechanism: null,
      realmId: binding.realmId,
      trustRoot: null,
      evidence: null,
      note: 'symlink/hardlink/alias safety requires the openat2-by-FD discipline (PR3 territory); this lane states no alias guarantee',
    }),
    { ...networkProbeRow(abiVersion, binding.realmId) },
    Object.freeze({
      dimension: 'inherit-cancel' as AssuranceDimension,
      level: 'author-trusted' as const,
      mechanism: 'trusted launcher closes all undeclared inherited FDs + lane lease mediation separates cancel-request from termination settlement',
      realmId: binding.realmId,
      trustRoot: binding.trustRoot,
      evidence: binding.evidenceRef,
      note: 'the FD-closure leg carries its own recorded evidence row when run; cancel is a REQUEST on the lease and only settleTermination decides (C-GW boundary)',
    }),
  ]
  return Object.freeze(rows)
}
