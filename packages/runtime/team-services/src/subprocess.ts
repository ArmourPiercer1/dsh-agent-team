/**
 * Alpha.5 BL-16 — the confined per-Member `subprocess` Provider.
 *
 * WHY THIS MODULE EXISTS (measured, not assumed): the native
 * `@deepseek-ai/dsh-tool-fs-search` module (`grep`/`glob`) injects
 * `["tools","systemPrompt","subprocess"]` and executes the packaged ripgrep
 * through `ctx.subprocess.spawn`. The Member realm (`install.ts`) confined
 * **`fs`** only, so the routed `grep`/`glob` definitions ran on the inherited,
 * unconfined `subprocess` service: an out-of-lane search executed and returned
 * the outside bytes with ZERO guard facts (`SEARCH-3` in
 * `dev/agent-workflow/evidence/a5sf-fs-tools/README.md`). Mounting an
 * OS-confined `subprocess` Provider on the Member's isolated scope is the one
 * arm that closes it.
 *
 * TWO LAYERS, and neither is a result filter:
 *
 *  1. ADMISSION (this module, before any process): the request's DECLARED read
 *     intents — the operands after `--`, or the cwd when the argv names none —
 *     are resolved to absolute paths and consulted against the **effective**
 *     read lane (the `EffectiveIo` the ONE compiler already produced, i.e.
 *     `ceiling ∩ restriction`). A target outside that lane is refused with the
 *     existing typed `TeamIoDenial` (`IO_READ_DENIED`), one guard-consult fact
 *     on the Member's realm, and NO process: the refusal is decided before the
 *     bytes are ever reachable, so it cannot be a filter over results.
 *
 *  2. CONTAINMENT (the OS): the child runs under
 *     {@link compileExecutionProfile}'s Landlock profile for the same policy —
 *     the SAME compiler P1-07 ships, reused rather than re-derived. That layer
 *     cannot be expressed as string filtering either.
 *
 * THE MEASURED BOUNDARY OF LAYER 2 (do not read it as "the kernel refuses every
 * undeclared read"): the profile is the effective lane PLUS a runtime allowance
 * — `/bin`, `/usr`, `/lib`, `/lib64` (when present) and the program's own
 * directory (execute + read), added here, PLUS the shared launcher's own
 * `runtime_base` (`/usr` execute+read, `/etc` READ_FILE/READ_DIR, `/proc`
 * READ_FILE/READ_DIR). The kernel therefore DOES serve
 * `/bin/sh -c 'cat /etc/passwd'`, an in-lane symlink whose target is
 * `/etc/passwd` / `/usr/lib/os-release` / `/proc/self/status`, and a
 * pre-existing in-lane hardlink to an outside inode (hardlink resolution is
 * inode-based; the path is in the lane). It DOES refuse an out-of-lane path
 * (`/home`, `/srv`, `/var`, a scratch sibling) and a symlink whose target is
 * outside the allowance. The arms in
 * `dev/agent-workflow/evidence/a5sf-bl16-grep/` pin both halves.
 *
 * Because of that allowance, admission is the ONLY layer for a DECLARED root
 * inside it: a declared `/etc`, `/usr` or `/proc` root is refused by layer 1
 * even though layer 2 would allow it. Undeclared reads inside the allowance
 * (a nested symlink, a hardlink, a shell body) are closed by the shell-class
 * refusal below where they can be named; what remains is disclosed, not
 * claimed away.
 *
 * SHELL-CLASS REFUSAL (BL-16 review round 2): a `spawn` whose reads cannot be
 * statically attributed to the declared operands is refused at ADMISSION, with
 * one typed `TeamIoDenial` and one recorded fact, before any process. The
 * declared typed list is {@link CONFINED_SUBPROCESS_STATIC_PROGRAMS} (`rg`
 * today — the binary the shipped grep/glob argv uses); every other program is
 * unknown and therefore refused fail-closed. Interpreter/shell-class programs
 * (sh, bash, python*, node, perl, ruby, awk, xargs, find, …) are named in
 * {@link CONFINED_SUBPROCESS_SHELL_CLASS_PROGRAMS} only to make the refusal
 * detail truthful; they are refused by the same allow-list rule.
 *
 * WHAT IT DOES NOT DO, stated so it cannot be read as more:
 *  - It is not a second policy evaluator. The lane decision is
 *    `evaluateLocatorAccess`, the OS profile is `compileExecutionProfile`, and
 *    the fact transport is `observeGuard` — all three already exist.
 *  - It never falls back to a bare `spawn`: an unexpressible lane
 *    (`mode: all`, an `ask`, a nested deny) refuses the spawn with the
 *    compiler's own code. "Sandbox unavailable ⇒ run naked" is inexpressible.
 *  - It refuses stdio shapes it cannot honour (spill files, control pipes,
 *    `inherit` output) instead of silently degrading them.
 *
 * THE RUNTIME ALLOWANCE (disclosed, not hidden): the OS profile carries the
 * effective lane PLUS a small, closed runtime set — the system executable /
 * loader directories and the program's own directory — because a child cannot
 * exec or load without them. It is the same allowance the governed
 * `search-background` rows already ship (`SYSTEM_RX(...)` in
 * `packages/tools/search-family/src/glob-backend.mjs`), and it is an OS-level
 * grant OUTSIDE the read lane: it is why layer 1 (admission) is load-bearing
 * for grep/glob rather than decorative.
 *
 * @module @dsh-agent-team/runtime/team-services/subprocess
 */

import { existsSync } from 'node:fs'
import { basename, dirname, isAbsolute, resolve as resolvePath } from 'node:path'
import type { Readable, Writable } from 'node:stream'
import { constants as osConstants } from 'node:os'
import type { AllowPathEntry, PayloadExitRecord, ProviderResult, SpawnRequest, StreamingOptions } from '../../sandbox-provider/index.js'
import {
  NODE_PATH_IDENTITY_RESOLVER,
  evaluateLocatorAccess,
  type PathIdentityResolver,
} from '../../member-io-policy/src/provider-capabilities.js'
import type { EffectiveIoPolicy, PathRuleSet } from '../../member-io-policy/src/types.js'
import { compileExecutionProfile } from '../../team-sandbox/src/profile.js'
import type { FsGuard } from './fs.js'
import { observeGuard, type GuardConsultObserver } from './guard-observability.js'
import { TeamIoDenial } from './types.js'

/** The methods this provider consults its guard under (the fact's `method`). */
export const SUBPROCESS_GUARD_METHOD = 'spawn'

/** Closed per-stream dispositions, mirrored from the native seam's vocabulary. */
export type ConfinedStdinMode = 'ignore' | 'pipe' | { readonly data: string }
export type ConfinedCollectMode = { readonly maxBytes: number; readonly spill?: { readonly maxBytes: number } }
export type ConfinedOutputMode = 'pipe' | 'inherit' | ConfinedCollectMode

/** A spawn request shaped like the native `SubprocessSpawnSpec`. */
export interface ConfinedSpawnSpec {
  readonly argv: readonly string[]
  readonly cwd: string
  readonly stdio: {
    readonly stdin: ConfinedStdinMode
    readonly stdout: ConfinedOutputMode
    readonly stderr: ConfinedOutputMode
    readonly control?: 'pipe'
  }
  readonly graceMs: number
  readonly signal?: AbortSignal | undefined
  readonly env?: NodeJS.ProcessEnv | undefined
}

// ---------------------------------------------------------------------------
// The confined process provider seam this module consumes (P1-07's provider).
// ---------------------------------------------------------------------------

/** The streaming handle P1-07's provider hands back (structural subset). */
export interface ConfinedStreamProcess {
  readonly pid: number
  readonly stdin: Writable
  readonly stdout: Readable
  readonly stderr: Readable
  readonly exited: Promise<{ readonly code: number | null; readonly signal: string | null }>
  terminate(options?: StreamingOptions): Promise<unknown>
  readonly payloadExit: Promise<PayloadExitRecord>
}

/** The one provider method a confined spawn needs. */
export interface ConfinedProcessProvider {
  spawnStreaming(request: SpawnRequest, streaming?: StreamingOptions): Promise<ProviderResult<ConfinedStreamProcess>>
}

/** One bounded output reader (the native `SubprocessOutputReader` contract). */
export interface ConfinedOutputReader {
  readFrom(fromByte: number): { readonly text: string; readonly nextOffset: number; readonly lossy: boolean }
  finalize(): { readonly text: string; readonly truncated: boolean }
  snapshot(): { readonly bytes: Buffer; readonly totalBytes: number }
  seal(): void
  readonly total: number
}

/**
 * The bounded in-memory tail collector, matching the native seam's documented
 * collect semantics (offset-based, non-consuming; overflow keeps the TAIL and
 * reports `lossy`). It is a local implementation because this lane must not
 * import an upstream provider's internal module (CORE PATCH BUDGET = 0 and the
 * AGENTS.md "no upstream internal API" rule).
 */
export function createConfinedOutputReader(maxBytes: number): ConfinedOutputReader {
  if (!Number.isFinite(maxBytes) || maxBytes < 1) {
    throw new TypeError('createConfinedOutputReader needs a positive finite maxBytes')
  }
  const chunks: Buffer[] = []
  let bytes = 0
  let dropped = false
  let total = 0
  return Object.freeze({
    get total() {
      return total
    },
    push(chunk: Buffer): void {
      total += chunk.length
      chunks.push(chunk)
      bytes += chunk.length
      while (bytes > maxBytes) {
        const head = chunks[0]
        if (head === undefined) break
        const excess = bytes - maxBytes
        if (head.length <= excess) {
          chunks.shift()
          bytes -= head.length
        } else {
          chunks[0] = head.subarray(excess)
          bytes -= excess
        }
        dropped = true
      }
    },
    readFrom(fromByte: number): { readonly text: string; readonly nextOffset: number; readonly lossy: boolean } {
      const windowStart = total - bytes
      const buffer = Buffer.concat(chunks)
      const lossy = fromByte < windowStart
      return {
        text: (lossy ? buffer : buffer.subarray(fromByte - windowStart)).toString('utf8'),
        nextOffset: total,
        lossy,
      }
    },
    finalize(): { readonly text: string; readonly truncated: boolean } {
      return { text: Buffer.concat(chunks).toString('utf8'), truncated: dropped }
    },
    snapshot(): { readonly bytes: Buffer; readonly totalBytes: number } {
      return { bytes: Buffer.concat(chunks), totalBytes: total }
    },
    seal(): void {
      /* memory-only collector: sealing is a lifecycle no-op */
    },
  } as ConfinedOutputReader & { push(chunk: Buffer): void })
}

/** Internal shape used while feeding a collector (not part of the public face). */
type FeedableReader = ConfinedOutputReader & { push(chunk: Buffer): void }

// ---------------------------------------------------------------------------
// Layer 1 — declared read intents and their admission
// ---------------------------------------------------------------------------

/**
 * The DECLARED, typed list of programs whose reads this face can attribute to
 * `argv` operands. It is an ALLOW-LIST, not a shell-class deny-list: a program
 * not named here is unknown to the admission and is refused, so a future tool
 * must add its program here deliberately (with its argv contract) instead of
 * inheriting the face by accident. `rg` is the binary the shipped `grep`/`glob`
 * argv executes (`@vscode/ripgrep`, invoked by `dsh-tool-fs-search` with
 * `--no-config` and the search root behind `--`).
 */
export const CONFINED_SUBPROCESS_STATIC_PROGRAMS: readonly string[] = Object.freeze(['rg'])

/**
 * Interpreter / shell-class program names. They are named ONLY so the refusal
 * detail is truthful ("this is a shell body, not a declared operand"); the
 * allow-list above is what refuses them (they are not on it). Prefixes cover
 * versioned interpreters (`python3.12`, `nodejs`, …).
 */
export const CONFINED_SUBPROCESS_SHELL_CLASS_PROGRAMS: readonly string[] = Object.freeze([
  'sh', 'bash', 'dash', 'zsh', 'ksh', 'mksh', 'ash', 'fish', 'csh', 'tcsh',
  'busybox', 'env', 'xargs', 'find', 'sed', 'awk', 'gawk', 'mawk', 'nawk',
  'perl', 'ruby', 'lua', 'php', 'tclsh', 'wish', 'expect', 'script', 'timeout',
  'nice', 'nohup', 'stdbuf', 'setsid', 'su', 'sudo', 'doas',
])
const SHELL_CLASS_PREFIXES: readonly string[] = Object.freeze(['python', 'node', 'perl', 'ruby', 'php', 'lua'])

/** One attribution refusal (a typed denial, decided before any process). */
export interface ProgramAttributionRefusal {
  /** The existing denial code: this is a read refusal, decided at admission. */
  readonly code: 'IO_READ_DENIED'
  /** Why the reads cannot be attributed to the declared operands. */
  readonly detail: string
  /** The program path the refusal is about (also the recorded fact locator). */
  readonly target: string
}

/** True for a shell/interpreter-class program name (basename, lower-case). */
export function isShellClassProgram(programName: string): boolean {
  const name = programName.toLowerCase()
  return CONFINED_SUBPROCESS_SHELL_CLASS_PROGRAMS.includes(name)
    || SHELL_CLASS_PREFIXES.some((prefix) => name.startsWith(prefix))
}

/**
 * Decide whether this `argv` is statically attributable to the declared read
 * roots. Returns `undefined` when it is, or the typed refusal when it is not.
 *
 * The rule is a declared allow-list plus a per-program argv contract:
 *  - the program's basename must be in {@link CONFINED_SUBPROCESS_STATIC_PROGRAMS};
 *  - for `rg`, `--no-config` MUST be present (otherwise a ripgrep config file is
 *    read without appearing in any operand) and the flags that EXECUTE another
 *    program (`--pre`, `--search-zip`/`-z`) are refused.
 *
 * Every other program — including `sh`, `bash`, `python*`, `node`, `perl`,
 * `ruby`, `awk`, `xargs`, `find` and any unknown binary — is refused. An
 * unknown program cannot be proven to read only its operands, so the face
 * fails closed instead of guessing.
 */
export function programAttributionRefusal(
  spec: { readonly argv: readonly string[] },
): ProgramAttributionRefusal | undefined {
  const program = spec.argv[0]
  if (typeof program !== 'string' || program.length === 0) {
    return Object.freeze({ code: 'IO_READ_DENIED', detail: 'argv has no program element, so its reads cannot be attributed', target: String(program) })
  }
  const name = basename(program).toLowerCase()
  if (isShellClassProgram(name)) {
    return Object.freeze({
      code: 'IO_READ_DENIED',
      detail: `argv[0] ${JSON.stringify(program)} is shell/interpreter-class (${name}); its reads cannot be statically attributed to the declared read roots, so the spawn is refused before any process`,
      target: program,
    })
  }
  if (!CONFINED_SUBPROCESS_STATIC_PROGRAMS.includes(name)) {
    return Object.freeze({
      code: 'IO_READ_DENIED',
      detail: `argv[0] ${JSON.stringify(program)} (${name}) is not in the declared statically-attributable program list (${CONFINED_SUBPROCESS_STATIC_PROGRAMS.join(', ')}); an unknown binary is refused fail-closed`,
      target: program,
    })
  }
  if (name === 'rg') {
    if (!spec.argv.includes('--no-config')) {
      return Object.freeze({
        code: 'IO_READ_DENIED',
        detail: 'argv[0] rg did not pass --no-config: a ripgrep config file would be read without appearing in the declared operands',
        target: program,
      })
    }
    const escaping = spec.argv.find((token) => token === '--pre' || token.startsWith('--pre=')
      || token === '--search-zip' || token === '-z'
      || (token.length > 1 && token.startsWith('-') && !token.startsWith('--') && token.slice(1).includes('z')))
    if (escaping !== undefined) {
      return Object.freeze({
        code: 'IO_READ_DENIED',
        detail: `argv[0] rg passes ${JSON.stringify(escaping)}, which executes another program (or a decompressor) whose reads are not in the declared operands`,
        target: program,
      })
    }
  }
  return undefined
}

/**
 * The DECLARED read roots of one spawn request.
 *
 * The rule is deliberately narrow and auditable: everything after the first
 * `--` is an operand (resolved against `cwd`); with no `--`, a token counts as
 * a path only when it is absolute or already exists relative to `cwd` — a
 * pattern (`--regexp=a/b`) and a flag are never consulted as paths. When no
 * operand exists, the walk root IS `cwd`, so `cwd` is the intent.
 *
 * A shell's `-c` argument is a COMMAND STRING, not a path: for a shell-class
 * `argv[0]` the token after `-c` is skipped instead of being resolved (it used
 * to be mistaken for an operand whenever the body began with an absolute path,
 * and the lane guard then reported `IO_READ_DENIED: ... does not exist` — a
 * misleading code for a body that is refused for a different reason). The
 * shell-class refusal ({@link programAttributionRefusal}) is what actually
 * decides that spawn, and it runs BEFORE intent extraction.
 *
 * This is admission, NOT containment: a process that names no path can still
 * try to read one, and the OS profile (layer 2) is what refuses that — within
 * the runtime allowance documented at the top of this module.
 */
export function readIntentsOf(
  spec: { readonly argv: readonly string[]; readonly cwd: string },
  deps: { readonly exists?: (path: string) => boolean } = {},
): readonly string[] {
  const exists = deps.exists ?? existsSync
  const cwd = resolvePath(spec.cwd)
  const separator = spec.argv.indexOf('--')
  if (separator !== -1) {
    const operands = spec.argv.slice(separator + 1).map((token) => (isAbsolute(token) ? resolvePath(token) : resolvePath(cwd, token)))
    return operands.length === 0 ? Object.freeze([cwd]) : Object.freeze(operands)
  }
  const shellClass = spec.argv.length > 1 && typeof spec.argv[0] === 'string' && isShellClassProgram(basename(spec.argv[0]))
  const operands: string[] = []
  for (let index = 1; index < spec.argv.length; index += 1) {
    const token = spec.argv[index] as string
    if (token === '-c' && shellClass) {
      index += 1 // the command string is not a path; the shell is refused anyway
      continue
    }
    if (token.startsWith('-')) continue
    if (isAbsolute(token)) {
      operands.push(resolvePath(token))
      continue
    }
    const candidate = resolvePath(cwd, token)
    if (exists(candidate)) operands.push(candidate)
  }
  return operands.length === 0 ? Object.freeze([cwd]) : Object.freeze(operands)
}

/**
 * Build the admission function for one Member's subprocess face. It is the
 * SAME `FsGuard` shape the confined `fs` Provider uses, so one
 * `observeGuard` wrapper serves both and no second decision vocabulary exists:
 * the read lane decides, and the refusal is the existing `IO_READ_DENIED` /
 * `IO_POLICY_UNSUPPORTED`.
 */
export function createMemberSubprocessGuard(
  policy: Pick<EffectiveIoPolicy, 'memberIdentity' | 'read'>,
  resolver: PathIdentityResolver = NODE_PATH_IDENTITY_RESOLVER,
): FsGuard {
  return async function subprocessGuard(method: string, hostPath: string): Promise<void> {
    const lane: PathRuleSet = policy.read
    const decision = await evaluateLocatorAccess({ lane, locator: hostPath, access: 'read', resolver })
    if (decision.decision !== 'allow') {
      throw new TeamIoDenial(
        decision.decision === 'deny' ? 'IO_READ_DENIED' : 'IO_POLICY_UNSUPPORTED',
        decision.detail,
        { memberIdentity: policy.memberIdentity, method, target: hostPath },
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Layer 2 — the runtime allowance added to the compiled profile
// ---------------------------------------------------------------------------

/**
 * The system directories a confined child needs to exec its program and load
 * its libraries. `execute` is what makes `execve` legal; the read bits are the
 * dynamic loader's. This is the SAME allowance the governed search family
 * ships, and it is deliberately the only widening the profile gets.
 */
function systemRuntimeAllowPaths(): AllowPathEntry[] {
  const rx = (path: string): AllowPathEntry => ({ path, accessBits: { execute: true, readFile: true, readDir: true } })
  const entries: AllowPathEntry[] = [rx('/bin'), rx('/usr'), rx('/lib')]
  if (existsSync('/lib64')) entries.push(rx('/lib64'))
  return entries
}

/**
 * Merge the compiled profile with the runtime allowance (lane wins on overlap).
 *
 * Exported so an OS-layer arm can build the SAME request the product builds
 * WITHOUT re-deriving the allowance in the test (a test-local copy could drift
 * from the shipped one). It is a construction helper, not a policy decision.
 */
export function confinedSpawnAllowPaths(profile: readonly AllowPathEntry[], program: string, extra: readonly AllowPathEntry[] = []): AllowPathEntry[] {
  const byPath = new Map<string, AllowPathEntry>()
  for (const entry of [...systemRuntimeAllowPaths(), ...extra]) byPath.set(entry.path, entry)
  for (const entry of profile) {
    const prior = byPath.get(entry.path)
    byPath.set(entry.path, prior === undefined ? entry : { path: entry.path, accessBits: { ...prior.accessBits, ...entry.accessBits } })
  }
  const programDir = dirname(program)
  const priorProgram = byPath.get(programDir)
  byPath.set(programDir, priorProgram === undefined
    ? { path: programDir, accessBits: { execute: true, readFile: true, readDir: true } }
    : { path: programDir, accessBits: { execute: true, readFile: true, readDir: true, ...priorProgram.accessBits } })
  return [...byPath.values()]
}

// ---------------------------------------------------------------------------
// The env law (the published scrub, implemented locally)
// ---------------------------------------------------------------------------

const SENSITIVE_ENV_PATTERN = /KEY|PASSWORD|SECRET|TOKEN/i

/**
 * The child environment: the ambient parent environment minus credential-shaped
 * names and minus every `DSH_*` name, then the spec's explicit entries (a
 * string is a deliberate opt-in; `undefined` is a tombstone). This mirrors the
 * native provider's documented scrub — implemented here because the Team lane
 * has no dependency on the upstream subprocess package (lockfile untouched).
 */
export function confinedChildEnvironment(overrides: NodeJS.ProcessEnv | undefined): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(ambientProcess().env ?? {})) {
    if (value === undefined) continue
    if (SENSITIVE_ENV_PATTERN.test(key) || key.toUpperCase().startsWith('DSH_')) continue
    env[key] = value
  }
  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (value === undefined) Reflect.deleteProperty(env, key)
    else env[key] = value
  }
  return env
}

/** The ambient process face as this lane can rely on it (see node-min.d.ts). */
function ambientProcess(): { readonly env?: Record<string, string | undefined> } {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process ?? {}
}

function envPairs(env: Record<string, string>): (readonly [string, string])[] {
  return Object.entries(env).map(([key, value]) => [key, value] as const)
}

// ---------------------------------------------------------------------------
// The confined Provider class
// ---------------------------------------------------------------------------

/** Everything the confined subprocess Provider needs, supplied by the realm. */
export interface ConfinedSubprocessOptions {
  /** The compiled `EffectiveIo` (`ceiling ∩ restriction`) this face enforces. */
  readonly effective: EffectiveIoPolicy
  /** The OS-confined process provider instance (P1-07; the caller builds it). */
  readonly provider: ConfinedProcessProvider
  /** Extra runtime allow-entries (e.g. an interpreter's own dir); additive. */
  readonly runtimeAllowPaths?: readonly AllowPathEntry[]
  /** Extra child env entries layered after the scrub (never policy). */
  readonly env?: Readonly<Record<string, string>>
  /**
   * The provider's own realm identity. The confined process provider refuses a
   * request that names a different realm ("realm confusion"), so the
   * composition that CREATED the provider supplies its realm id here; the
   * Member identity is only the fallback.
   */
  readonly realmId?: string
  /** The lease's binding id; defaults to the effective policy's binding identity. */
  readonly bindingId?: string
  /** The lease's member scope; defaults to the Member instance identity. */
  readonly memberScope?: string
  /** The admission guard; defaults to `createMemberSubprocessGuard(effective)`. */
  readonly guard?: FsGuard
  /** Optional fact observer — wrapped with `observeGuard` (one fact/consult). */
  readonly onGuardConsult?: GuardConsultObserver
  /** The realm this face reports its facts on (defaults to the Member ceiling). */
  readonly realm?: 'member' | 'binding'
  /** The binding identity the effective policy was compiled for, if any. */
  readonly toolBindingIdentity?: string | null
}

/** A Provider constructor Cordis can mount as the `subprocess` service. */
export type SubprocessProviderConstructor = new (ctx: unknown, config?: Record<string, unknown>) => unknown

/** The closed refusal vocabulary of THIS provider (never a bare `Error`). */
export const CONFINED_SUBPROCESS_REFUSAL_CODES = [
  'SUBPROCESS_PROGRAM_NOT_ABSOLUTE',
  'SUBPROCESS_STDIO_UNSUPPORTED',
  'SUBPROCESS_PROFILE_REFUSED',
  'SUBPROCESS_PROVIDER_REFUSED',
  'SUBPROCESS_TERMINAL_UNSUPPORTED',
  'SUBPROCESS_EXIT_UNRECORDABLE',
] as const

export type ConfinedSubprocessRefusalCode = (typeof CONFINED_SUBPROCESS_REFUSAL_CODES)[number]

/** A typed refusal from the confined subprocess face. */
export class ConfinedSubprocessRefusal extends Error {
  readonly code: ConfinedSubprocessRefusalCode
  readonly detail: string

  constructor(code: ConfinedSubprocessRefusalCode, detail: string) {
    super(`${code}: ${detail}`)
    this.name = 'ConfinedSubprocessRefusal'
    this.code = code
    this.detail = detail
  }
}

/** Map a negative waitpid status to the signal NAME the native outcome uses. */
function signalNameOf(signalNumber: number): string {
  const table = osConstants.signals as unknown as Record<string, number>
  for (const [name, number] of Object.entries(table)) {
    if (number === signalNumber) return name
  }
  return `SIG${String(signalNumber)}`
}

function isCollectMode(mode: ConfinedOutputMode): mode is ConfinedCollectMode {
  return typeof mode === 'object' && mode !== null
}

/** Refuse the stdio shapes this provider cannot honour (fail closed). */
function assertStdio(spec: ConfinedSpawnSpec): void {
  if (spec.stdio === undefined || spec.stdio === null || typeof spec.stdio !== 'object') {
    throw new ConfinedSubprocessRefusal('SUBPROCESS_STDIO_UNSUPPORTED', 'every stream disposition must be explicit')
  }
  if (spec.stdio.control !== undefined) {
    throw new ConfinedSubprocessRefusal(
      'SUBPROCESS_STDIO_UNSUPPORTED',
      'a control channel is not available on the confined face (fd 3 is the launcher handshake, not a caller channel)',
    )
  }
  for (const [stream, mode] of [['stdout', spec.stdio.stdout], ['stderr', spec.stdio.stderr]] as const) {
    if (mode === 'inherit') {
      throw new ConfinedSubprocessRefusal(
        'SUBPROCESS_STDIO_UNSUPPORTED',
        `${stream}: 'inherit' cannot be honoured — the confined launcher owns fd 1/2 and never passes them to the harness`,
      )
    }
    if (isCollectMode(mode)) {
      if (!Number.isFinite(mode.maxBytes) || mode.maxBytes < 1) {
        throw new ConfinedSubprocessRefusal('SUBPROCESS_STDIO_UNSUPPORTED', `${stream}: maxBytes must be a positive finite number`)
      }
      if (mode.spill !== undefined) {
        throw new ConfinedSubprocessRefusal(
          'SUBPROCESS_STDIO_UNSUPPORTED',
          `${stream}: a spill file is not produced by this provider; refusing instead of silently returning a lossy tail with no recovery path`,
        )
      }
    }
  }
  const stdin = spec.stdio.stdin
  if (stdin !== 'ignore' && stdin !== 'pipe' && !(typeof stdin === 'object' && stdin !== null && typeof stdin.data === 'string')) {
    throw new ConfinedSubprocessRefusal('SUBPROCESS_STDIO_UNSUPPORTED', 'stdin must be \'ignore\', \'pipe\' or { data }')
  }
}

function assertSpawnSpec(spec: ConfinedSpawnSpec): void {
  if (spec === null || typeof spec !== 'object') throw new ConfinedSubprocessRefusal('SUBPROCESS_PROGRAM_NOT_ABSOLUTE', 'a spawn spec is required')
  const [program] = Array.isArray(spec.argv) ? spec.argv : []
  if (typeof program !== 'string' || program.length === 0) {
    throw new ConfinedSubprocessRefusal('SUBPROCESS_PROGRAM_NOT_ABSOLUTE', 'argv must be a non-empty array whose [0] is the program')
  }
  if (!isAbsolute(program)) {
    // The runtime allowance is granted on the program's OWN directory, so the
    // program must name that directory unambiguously. A bare PATH name would
    // make the grant a PATH-wide one — refused instead of widened.
    throw new ConfinedSubprocessRefusal(
      'SUBPROCESS_PROGRAM_NOT_ABSOLUTE',
      `argv[0] must be an absolute executable path; ${JSON.stringify(program)} would make the executable allowance a PATH-wide grant`,
    )
  }
  if (typeof spec.cwd !== 'string' || !isAbsolute(spec.cwd)) {
    throw new ConfinedSubprocessRefusal('SUBPROCESS_PROFILE_REFUSED', 'cwd must be an absolute directory')
  }
  if (!Number.isFinite(spec.graceMs) || spec.graceMs <= 0) {
    throw new ConfinedSubprocessRefusal('SUBPROCESS_PROFILE_REFUSED', 'graceMs must be a positive finite number')
  }
  assertStdio(spec)
}

function waitForStreamEnd(stream: Readable, boundMs: number): Promise<void> {
  if (stream.readableEnded || stream.destroyed) return Promise.resolve()
  return new Promise<void>((resolve) => {
    let settled = false
    const finish = (): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      stream.off('end', finish)
      stream.off('close', finish)
      stream.off('error', finish)
      resolve()
    }
    const timer = setTimeout(finish, boundMs)
    stream.once('end', finish)
    stream.once('close', finish)
    stream.once('error', finish)
  })
}

/**
 * Create the confined `subprocess` Provider class for one Member: the live
 * Provider class is the service identity, and `spawn` is REPLACED by the
 * confined path (there is no bare-spawn fallback to inherit).
 */
/** Monotonic per-process spawn counter (grant identity, never a decision). */
let spawnSequence = 0

export function createConfinedSubprocessClass(
  Base: new (ctx: never, config?: never) => unknown,
  options: ConfinedSubprocessOptions,
): SubprocessProviderConstructor {
  const { effective, provider } = options
  if (effective === undefined || effective === null) {
    throw new TypeError('createConfinedSubprocessClass needs the compiled EffectiveIo policy')
  }
  if (provider === undefined || provider === null || typeof provider.spawnStreaming !== 'function') {
    throw new TypeError('createConfinedSubprocessClass needs the OS-confined process provider')
  }
  // The profile is compiled ONCE per realm. A refusal is REMEMBERED and turns
  // every spawn into a typed refusal — never into an unconfined run, and never
  // into an install-time failure that would take the Member's `fs` lane down.
  const profile = compileExecutionProfile(effective)
  const laneGuard = options.guard ?? createMemberSubprocessGuard(effective)
  // The attribution refusal is a DECISION of this face, not a lane lookup, but
  // it must travel through the SAME observed guard so it is recorded as one
  // fact with the same schema. The queue is consumed synchronously by the
  // guard call below (spawn runs to that first `await` before returning), so a
  // concurrent spawn can never pick up another spawn's refusal.
  const pendingAttribution: ProgramAttributionRefusal[] = []
  const admissionGuard: FsGuard = async (method: string, hostPath: string): Promise<void> => {
    const at = pendingAttribution.findIndex((refusal) => refusal.target === hostPath)
    if (at !== -1) {
      const [refusal] = pendingAttribution.splice(at, 1)
      if (refusal === undefined) throw new TypeError('subprocess admission: attribution queue lost its head')
      throw new TeamIoDenial(refusal.code, refusal.detail, {
        memberIdentity: effective.memberIdentity,
        method,
        target: hostPath,
      })
    }
    await laneGuard(method, hostPath)
  }
  const guard = options.onGuardConsult === undefined
    ? admissionGuard
    : observeGuard(admissionGuard, options.onGuardConsult, {
      realm: options.realm ?? 'member',
      memberIdentity: effective.memberIdentity,
      toolBindingIdentity: options.toolBindingIdentity ?? null,
      policyRevision: effective.policyRevision,
    })

  class ConfinedSubprocess extends (Base as new (ctx: never, config?: never) => object) {
    spawn(spec: ConfinedSpawnSpec): {
      readonly stdin: Writable | undefined
      readonly stdout: Readable | undefined
      readonly stderr: Readable | undefined
      readonly collected: { readonly stdout?: ConfinedOutputReader; readonly stderr?: ConfinedOutputReader }
      readonly done: Promise<{ readonly exitCode: number | null; readonly signal: string | null }>
      terminate(): void
      waitForExit(signal?: AbortSignal): Promise<boolean>
    } {
      assertSpawnSpec(spec)
      if (!profile.ok) {
        throw new ConfinedSubprocessRefusal(
          'SUBPROCESS_PROFILE_REFUSED',
          `the effective policy cannot be expressed as an OS profile (${profile.code}: ${profile.detail}); refusing instead of spawning an unconfined child`,
        )
      }
      // THE ADMISSION IS ASYNCHRONOUS (the guard resolves symlinks), but the
      // native `spawn` contract is synchronous. That is why the returned
      // handle's `done` is the rejection point for a refused admission: the
      // refusal is still decided BEFORE any provider call, and `spawn` itself
      // throws synchronously for every purely syntactic refusal above.
      //
      // ATTRIBUTION RUNS FIRST (BL-16 review round 2): a shell-class or unknown
      // program is refused before intent extraction, so a shell body can never
      // reach the lane guard (and can no longer be misreported as a lane "does
      // not exist" denial). A shell body that reaches the KERNEL is exactly the
      // general-face hole this refusal closes.
      const attribution = programAttributionRefusal(spec)
      const intents = attribution === undefined ? readIntentsOf(spec) : Object.freeze([] as string[])
      const started = (async () => {
        if (attribution !== undefined) {
          pendingAttribution.push(attribution)
          await guard(SUBPROCESS_GUARD_METHOD, attribution.target)
          // The guard rethrows the typed denial above; this line is defence
          // against an admission invariant breaking silently.
          throw new TeamIoDenial(attribution.code, attribution.detail, {
            memberIdentity: effective.memberIdentity,
            method: SUBPROCESS_GUARD_METHOD,
            target: attribution.target,
          })
        }
        for (const intent of intents) await guard(SUBPROCESS_GUARD_METHOD, intent)
        const allowPaths = confinedSpawnAllowPaths(profile.value.allowPaths, spec.argv[0] as string, options.runtimeAllowPaths ?? [])
        const request: SpawnRequest = {
          grantFingerprint: `bl16:${options.realmId ?? effective.memberIdentity}:${effective.policyRevision}:${String(Date.now())}:${String(++spawnSequence)}`,
          realmId: options.realmId ?? effective.memberIdentity,
          bindingId: options.bindingId ?? (effective.toolBindingIdentity ?? 'member'),
          memberScope: options.memberScope ?? effective.memberIdentity,
          argv: [...spec.argv],
          cwd: resolvePath(spec.cwd),
          env: envPairs({ ...confinedChildEnvironment(spec.env), ...options.env }),
          allowPaths,
          // The payload's OWN completion state MUST reach the handle: `grep`
          // distinguishes exit 0 (matches) from 1 (no matches) and treats 2+
          // as a search failure. The B2 passthrough is this lane's only user
          // of that additive arm, and it changes no rule.
          exitPassthrough: true,
        }
        const spawned = await provider.spawnStreaming(request, { graceMs: spec.graceMs })
        if (!spawned.ok) {
          throw new ConfinedSubprocessRefusal(
            'SUBPROCESS_PROVIDER_REFUSED',
            `the confined provider refused the spawn (${spawned.error.code}: ${spawned.error.message})`,
          )
        }
        return spawned.value
      })()
      // A refused admission must not become an unhandled rejection when the
      // caller only observes `done`; the rejection is still delivered there.
      started.catch(() => undefined)

      const readers: { stdout?: FeedableReader; stderr?: FeedableReader } = {}
      const collectFrom = (mode: ConfinedOutputMode, live: Readable): ConfinedOutputReader | undefined => {
        if (!isCollectMode(mode)) return undefined
        const reader = createConfinedOutputReader(mode.maxBytes) as FeedableReader
        live.on('data', (chunk: Buffer | string) => {
          reader.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        })
        return reader
      }

      let terminated = false
      let live: ConfinedStreamProcess | undefined
      let stdinForCaller: Writable | undefined
      let stdoutForCaller: Readable | undefined
      let stderrForCaller: Readable | undefined
      let abortListener: (() => void) | undefined

      started.then(
        (handle) => {
          live = handle
          readers.stdout = collectFrom(spec.stdio.stdout, handle.stdout) as FeedableReader | undefined
          readers.stderr = collectFrom(spec.stdio.stderr, handle.stderr) as FeedableReader | undefined
          stdoutForCaller = spec.stdio.stdout === 'pipe' ? handle.stdout : undefined
          stderrForCaller = spec.stdio.stderr === 'pipe' ? handle.stderr : undefined
          if (spec.stdio.stdin === 'pipe') {
            stdinForCaller = handle.stdin
          } else if (spec.stdio.stdin === 'ignore') {
            handle.stdin.end()
          } else {
            handle.stdin.end(spec.stdio.stdin.data)
          }
          if (terminated) void handle.terminate({ graceMs: spec.graceMs }).catch(() => undefined)
          if (spec.signal !== undefined) {
            abortListener = () => {
              terminated = true
              void handle.terminate({ graceMs: spec.graceMs }).catch(() => undefined)
            }
            if (spec.signal.aborted) abortListener()
            else spec.signal.addEventListener('abort', abortListener, { once: true })
          }
        },
        () => undefined,
      )

      const done = (async () => {
        const handle = await started
        const record = await handle.payloadExit
        // Wait for the collected pipes to drain BEFORE reporting the outcome:
        // a caller that reads `collected.stdout` right after `done` must see
        // every byte the child wrote (the native seam's pipe-drain law).
        await Promise.all([
          spec.stdio.stdin === 'pipe' ? Promise.resolve() : waitForStreamEnd(handle.stdout, spec.graceMs),
          waitForStreamEnd(handle.stderr, spec.graceMs),
        ])
        if (abortListener !== undefined && spec.signal !== undefined) spec.signal.removeEventListener('abort', abortListener)
        if (record.form !== 'recorded') {
          throw new ConfinedSubprocessRefusal(
            'SUBPROCESS_EXIT_UNRECORDABLE',
            `the payload's exit state was not recorded (${record.form}); the confined arm never guesses a success code`,
          )
        }
        if (record.rc >= 0) return { exitCode: record.rc, signal: null }
        return { exitCode: null, signal: signalNameOf(-record.rc) }
      })()
      // The handle's rejection is the caller's to read; this keeps an
      // unobserved failure from becoming a process-level unhandled rejection.
      done.catch(() => undefined)

      return Object.freeze({
        get stdin(): Writable | undefined {
          return stdinForCaller
        },
        get stdout(): Readable | undefined {
          return stdoutForCaller
        },
        get stderr(): Readable | undefined {
          return stderrForCaller
        },
        collected: {
          get stdout(): ConfinedOutputReader | undefined {
            return readers.stdout as ConfinedOutputReader | undefined
          },
          get stderr(): ConfinedOutputReader | undefined {
            return readers.stderr as ConfinedOutputReader | undefined
          },
        },
        done,
        terminate(): void {
          terminated = true
          if (live !== undefined) void live.terminate({ graceMs: spec.graceMs }).catch(() => undefined)
        },
        async waitForExit(signal?: AbortSignal): Promise<boolean> {
          if (signal?.aborted === true) return false
          try {
            await done
            return true
          } catch {
            return false
          }
        },
      })
    }

    /** This face owns no terminal: a PTY cannot be confined by the OS profile. */
    async spawnTerminal(): Promise<never> {
      throw new ConfinedSubprocessRefusal(
        'SUBPROCESS_TERMINAL_UNSUPPORTED',
        'the confined subprocess face owns no terminal process (a PTY cannot ride the Landlock profile); use the Member terminal lane',
      )
    }
  }

  return ConfinedSubprocess as unknown as SubprocessProviderConstructor
}
