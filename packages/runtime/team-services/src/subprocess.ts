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
 * LANE-SCOPED SEARCH MUST NOT DEPEND ON OUTSIDE DATA (BL-16 live row 1,
 * 2026-11-05): a confined `rg` whose search root sits inside a git worktree
 * performs VCS/ancestor ignore discovery ABOVE that root, reads the worktree's
 * `.git` FILE, and treats the lane's (correct) kernel denial of that read as
 * fatal: `rg: …/.git: Permission denied (os error 13)`, `exit 2`, so the tool
 * reported a search failure although the match was on stdout. The repair is in
 * the INVOCATION, never the lane: {@link laneSafeSearchArgv} adds
 * `--no-ignore-parent --no-ignore-vcs` (after `--no-config`) **only when a
 * directory search root's ancestors are outside the effective read lane**, and
 * the allow fact records exactly what that removed
 * ({@link SEARCH_IGNORE_DISCOVERY_NOTES}) on the SAME fact — no extra fact,
 * no extra process. A root whose discovery already stays inside the lane (the
 * lane includes the worktree root) keeps the shipped argv and ordinary
 * `.gitignore` semantics. `.git` remains unreadable outside the lane.
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
 * SHELL-CLASS ADMISSION (BL-17 / P2-04 backend — NOT a widening of that rule):
 * the block above stays true for every caller that declares nothing. A realm
 * may DECLARE a shell class ({@link ConfinedShellClassAdmission} on the face's
 * options), and then a `bash`/`sh` spawn is a first-class, explicitly admitted
 * invocation — never "not rg, therefore pass":
 *
 *  - the program basename must be in the realm's declared `programs`, the
 *    request must carry the declared invocation, and the argv shape is a
 *    closed contract (`<program> -c <body>` only);
 *  - the body is READ-OPAQUE, so static attribution is impossible by
 *    construction (BL-40/BL-41). The caller therefore DECLARES the roots the
 *    command will read, write and `chmod`, and each declared root is consulted
 *    against the SAME compiled effective lane through the SAME
 *    `evaluateLocatorAccess` / `TeamIoDenial` / `observeGuard` chain the `fs`
 *    face uses, BEFORE any provider call. An out-of-lane declared read is
 *    `IO_READ_DENIED`; an out-of-lane declared write or `chmod` is
 *    `IO_WRITE_DENIED` — the same typed axis refusals, one fact each;
 *  - the OS profile remains the boundary for everything the declaration did
 *    not name (BL-41: argv checking is defence in depth, never the only
 *    permission evidence). `chmod` is the measured exception: Landlock does
 *    not mediate it for a same-uid owner, so an UNDECLARED mode change is not
 *    refused by the kernel — it is refused only when declared. That limit is
 *    disclosed, never claimed away;
 *  - the network axis is consulted. `network: deny` is admitted ONLY when the
 *    backend's own capability probe reports `network-destination: enforced`
 *    ({@link probeNetworkDenial}); otherwise the spawn is refused with the
 *    existing `NETWORK_UNCONFINED_REALM` concept before any process. On this
 *    host's provider set the probe reports `unsupported`, so a
 *    network-denied shell is REFUSED, never simulated as denied;
 *  - a PTY is NOT part of this face: the spawn spec carries no terminal,
 *    `spawnTerminal` refuses, and the composition seam refuses a
 *    `terminals`-consuming module on a governed realm
 *    (`TERMINALS_LEGACY_PTY_REFUSED`) instead of letting the inherited,
 *    legacy-generation PTY serve a governed Member.
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

import { existsSync, statSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, resolve as resolvePath } from 'node:path'
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
  /**
   * BL-17: the DECLARED shell-class invocation. Present only for a shell-class
   * `argv[0]`; it states which admitted program runs and which roots the
   * command declares it will touch. The body is read-opaque, so this
   * declaration is the ONLY statically attributable input the face has — and
   * the OS profile stays the boundary for everything it does not name.
   */
  readonly shell?: ConfinedShellDeclaration | undefined
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

/** One capability row as the confined provider's OWN probe states it. */
export interface ConfinedCapabilityRow {
  readonly dimension: string
  readonly level: string
  readonly note?: string | undefined
  /**
   * BL-42 — the mechanism the backend names for this row (required for an
   * `enforced` network answer). Optional here because the OTHER dimensions
   * keep their historical three-field shape; the probe treats a missing
   * mechanism on `network-destination: enforced` as `unsupported`.
   */
  readonly mechanism?: string | null | undefined
  /** BL-42 — the recorded evidence reference for this row, when it carries one. */
  readonly evidence?: string | null | undefined
}

/** The one provider method a confined spawn needs. */
export interface ConfinedProcessProvider {
  spawnStreaming(request: SpawnRequest, streaming?: StreamingOptions): Promise<ProviderResult<ConfinedStreamProcess>>
  /**
   * OPTIONAL capability probe (BL-17). The shipped OS provider carries it; a
   * double without one is `unsupported`, never a default allow. BL-18 shares
   * this declaration with the confined `web` face through
   * {@link NetworkCapabilityProbeCarrier}, so one probe answers both lanes.
   */
  readonly probe?: () => Promise<ProviderResult<readonly ConfinedCapabilityRow[]>>
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
 *  - for `rg`, only the flag SHAPES the shipped `grep`/`glob` module emits are
 *    admitted (see {@link rgArgvRefusal}); `--no-config` must be the FIRST
 *    argument (a positional `--no-config` after `--` is an operand, and a
 *    ripgrep config could inject `--pre`); `-f`/`--file`/`--ignore-file`
 *    (pattern/ignore file reads), `--pre`/`--search-zip`/`-z` (another program
 *    or decompressor runs) and every other flag are refused.
 *
 * The NAME check is not an identity check. {@link programWriteLaneRefusal} is
 * the second half: a program whose realpath is inside the Member's effective
 * write lane is refused even when its basename is `rg`.
 *
 * Every other program — including `sh`, `bash`, `python*`, `node`, `perl`,
 * `ruby`, `awk`, `xargs`, `find` and any unknown binary — is refused. An
 * unknown program cannot be proven to read only its operands, so the face
 * fails closed instead of guessing.
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
  if (name === 'rg') return rgArgvRefusal(program, spec.argv)
  return undefined
}

/**
 * The `rg` flag shapes the shipped `grep`/`glob` module emits. This is an
 * ALLOW-LIST of shapes, not a deny-list of dangerous flags:
 * `buildGrepCommand` emits `--json`, `--regexp=…`, optional `--glob=…` and the
 * root behind `--`; `buildGlobCommand` emits `--files`, `--glob=…`,
 * `--sort=modified`, `--no-ignore`, `--hidden` and the VCS-exclude `--glob=!…`
 * pairs; `runRipgrep` prepends `--no-config`. Anything else — including
 * `-f`/`--file`/`--ignore-file` (a pattern/ignore file read), `--pre`/
 * `--search-zip`/`-z` (another program runs), `--follow` (a nested symlink is
 * followed), or a `--no-config` that fell behind `--` and became an operand —
 * is refused before any process.
 *
 * The allow-list admits the DECLARED argv. The face may then ADD two flags it
 * owns — `--no-ignore-parent` / `--no-ignore-vcs` — and does so only through
 * {@link laneSafeSearchArgv} (see that function); those are never admitted
 * from a caller and never widen a read.
 */
const RG_ADMITTED_FLAGS: readonly string[] = Object.freeze([
  '--json',
  '--files',
  '--sort=modified',
  '--no-ignore',
  '--hidden',
])
const RG_ADMITTED_PREFIXES: readonly string[] = Object.freeze(['--regexp=', '--glob='])

/** The per-program argv contract for `rg` (called only after the name check). */
function rgArgvRefusal(program: string, argv: readonly string[]): ProgramAttributionRefusal | undefined {
  const refusal = (detail: string): ProgramAttributionRefusal =>
    Object.freeze({ code: 'IO_READ_DENIED', detail: `argv[0] rg ${detail}`, target: program })
  // B2 (review round 3): the token must be the FIRST argument, before any `--`.
  // `argv.includes('--no-config')` was position-insensitive: a lane file named
  // `--no-config` placed after `--` satisfied it while rg never received the
  // flag, so `RIPGREP_CONFIG_PATH` could inject `--pre` and execute a program.
  if (argv[1] !== '--no-config') {
    return refusal('must pass --no-config as its FIRST argument (immediately after the program, before the first --): a --no-config after -- is an OPERAND, not a flag, and a ripgrep config file could otherwise inject --pre')
  }
  const separator = argv.indexOf('--')
  const flags = argv.slice(1, separator === -1 ? argv.length : separator)
  for (const token of flags.slice(1)) {
    if (RG_ADMITTED_FLAGS.includes(token) || RG_ADMITTED_PREFIXES.some((prefix) => token.startsWith(prefix))) continue
    if (token === '--pre' || token.startsWith('--pre=')) {
      return refusal(`passes ${JSON.stringify(token)}, which executes another program whose reads are not in the declared operands`)
    }
    if (token === '--search-zip' || token === '-z'
      || (token.length > 1 && token.startsWith('-') && !token.startsWith('--') && token.slice(1).includes('z'))) {
      return refusal(`passes ${JSON.stringify(token)}, which runs a decompressor (search-zip) whose reads are not in the declared operands`)
    }
    if (token === '-f' || token === '--file' || token.startsWith('--file=')
      || token === '--ignore-file' || token.startsWith('--ignore-file=')) {
      return refusal(`passes ${JSON.stringify(token)}, which reads a pattern/ignore FILE that is not a declared operand; only the shipped search argv shapes are admitted`)
    }
    return refusal(`passes ${JSON.stringify(token)}, which is not one of the argv shapes the shipped grep/glob module emits (${[...RG_ADMITTED_FLAGS, '--regexp=…', '--glob=…'].join(', ')}); every other flag fails closed`)
  }
  return undefined
}

/**
 * B3 (review round 3): refuse a program whose REALPATH lies inside the
 * Member's effective WRITE lane. The allow-list above keys on the program
 * NAME, so `inside/rg` — a shell script the caller can write — passed the name
 * check and executed. A caller cannot legitimately supply a program it can
 * write, so the spawn is refused before any process instead.
 *
 * The decision reuses the SAME `evaluateLocatorAccess` (write access, the same
 * resolver) the `fs` face uses, so there is no second policy evaluator. It
 * resolves symlinks: an authored in-lane link whose target also resolves into
 * the lane is refused; a link resolving outside the lane is accepted (the
 * target is not writable through this lane).
 */
export async function programWriteLaneRefusal(
  program: string,
  writeLane: PathRuleSet,
  resolver: PathIdentityResolver = NODE_PATH_IDENTITY_RESOLVER,
): Promise<ProgramAttributionRefusal | undefined> {
  if (typeof program !== 'string' || program.length === 0) return undefined
  let decision
  try {
    decision = await evaluateLocatorAccess({ lane: writeLane, locator: program, access: 'write', resolver })
  } catch (error) {
    return Object.freeze({
      code: 'IO_READ_DENIED',
      detail: `argv[0] ${JSON.stringify(program)} could not be resolved against the Member write lane (${error instanceof Error ? error.message : String(error)}); an unresolvable program is refused fail-closed`,
      target: program,
    })
  }
  if (decision.decision === 'allow') {
    return Object.freeze({
      code: 'IO_READ_DENIED',
      detail: `argv[0] ${JSON.stringify(program)} resolves inside the Member's effective WRITE lane ('${decision.resolved}'); a program the caller can write is not statically attributable (the caller could replace its bytes), so the spawn is refused before any process`,
      target: program,
    })
  }
  if (decision.decision === 'unsupported') {
    return Object.freeze({
      code: 'IO_READ_DENIED',
      detail: `argv[0] ${JSON.stringify(program)} could not be resolved by the path identity Provider (${decision.detail}); an unresolvable program is refused fail-closed`,
      target: program,
    })
  }
  return undefined
}

// ---------------------------------------------------------------------------
// BL-17 — the shell-class ADMISSION (a declared class, never a fall-through)
// ---------------------------------------------------------------------------

/**
 * The closed refusal vocabulary of the shell-class admission. A shell program
 * is not "not-rg, therefore refused" (BL-16) and not "not-rg, therefore
 * passed" (the hole BL-17 must not open): it is a class the REALM declares and
 * a call DECLARES, with a typed refusal for every way that declaration can be
 * missing or malformed.
 */
export const CONFINED_SHELL_ADMISSION_CODES = [
  /** The realm declared no shell class at all: no shell program may run. */
  'SUBPROCESS_SHELL_NOT_DECLARED',
  /** The realm declared a shell class but not THIS program (e.g. `sh` vs `bash`). */
  'SUBPROCESS_SHELL_PROGRAM_NOT_ADMITTED',
  /** The request carries no declared invocation, so its roots are unattributable. */
  'SUBPROCESS_SHELL_INVOCATION_UNDECLARED',
  /** The declared invocation is not the admitted shape (`<program> -c <body>`). */
  'SUBPROCESS_SHELL_ARGV_UNSUPPORTED',
] as const

export type ConfinedShellAdmissionCode = (typeof CONFINED_SHELL_ADMISSION_CODES)[number]

/** One shell-admission refusal (decided before any process). */
export interface ShellAdmissionRefusal {
  readonly code: ConfinedShellAdmissionCode
  readonly detail: string
  readonly target: string
}

/**
 * The realm's DECLARED shell class. Absent means "this realm admits no shell
 * program" — the BL-16 behaviour, unchanged. Present means exactly the named
 * basenames are admissible, each still subject to its declared invocation and
 * the lane consults below. The declaration belongs to the COMPOSITION (the
 * same place that pins the launcher and builds the process provider), not to
 * the Member: a Member cannot widen it through argv or config.
 */
export interface ConfinedShellClassAdmission {
  /** Admitted shell-class program basenames (e.g. `['bash','sh']`), lower-case. */
  readonly programs: readonly string[]
}

/**
 * The declared invocation of ONE shell spawn. The body is read-opaque, so the
 * caller declares what the command will touch; each root is resolved against
 * `cwd` and consulted on the axis it belongs to. The declaration is NOT a
 * grant: every root still has to be admitted by the compiled lane.
 */
export interface ConfinedShellDeclaration {
  /** The shell program basename this invocation runs; must match `argv[0]`. */
  readonly program: string
  /** Roots the command declares it will READ. */
  readonly reads?: readonly string[] | undefined
  /** Roots the command declares it will CREATE / MODIFY / REMOVE. */
  readonly writes?: readonly string[] | undefined
  /**
   * Paths whose MODE the command declares it will change (`chmod`). Landlock
   * cannot mediate a same-uid mode change, so this declaration is the ONLY
   * layer that can refuse an out-of-lane one — disclosed, not claimed away.
   */
  readonly chmod?: readonly string[] | undefined
}

const shellRefusal = (
  code: ConfinedShellAdmissionCode,
  detail: string,
  target: string,
): ShellAdmissionRefusal => Object.freeze({ code, detail, target })

/** True when `argv[0]` names a shell-class program (the class this gate owns). */
export function isShellClassSpawn(spec: { readonly argv: readonly string[] }): boolean {
  const program = spec.argv[0]
  return typeof program === 'string' && program.length > 0 && isShellClassProgram(basename(program))
}

/**
 * THE ADMISSION. Returns `undefined` for a non-shell program (the rg / unknown
 * path, unchanged) and for an admitted shell invocation; otherwise the typed
 * refusal that decides the spawn before any process.
 *
 * An admitted shell is one where ALL of the following hold:
 *  1. the realm declared a shell class;
 *  2. `argv[0]`'s basename is in that class;
 *  3. the request carries a declared invocation for the same program;
 *  4. the argv shape is exactly `<program> -c <non-empty body>` — the one shape
 *     whose body is a command line rather than a set of operands;
 *  5. every declared root is a non-empty string.
 *
 * The lane decisions happen after this gate (they are async: they resolve
 * symlinks and consult the guard); this function is pure so the shape refusal
 * is synchronous and independently testable.
 */
export function shellClassAdmissionRefusal(
  spec: { readonly argv: readonly string[]; readonly shell?: ConfinedShellDeclaration | undefined },
  admission: ConfinedShellClassAdmission | undefined,
): ShellAdmissionRefusal | undefined {
  if (!isShellClassSpawn(spec)) return undefined
  const program = spec.argv[0] as string
  const name = basename(program).toLowerCase()
  if (admission === undefined || admission.programs.length === 0) {
    return shellRefusal(
      'SUBPROCESS_SHELL_NOT_DECLARED',
      `argv[0] ${JSON.stringify(program)} is shell/interpreter-class (${name}) and this realm declares no shell class; `
        + 'a shell body cannot be statically attributed to declared operands, so it is refused before any process. '
        + 'A composition that intends to run it must declare the program in the confined subprocess face\'s shellClass.programs',
      program,
    )
  }
  if (!admission.programs.includes(name)) {
    return shellRefusal(
      'SUBPROCESS_SHELL_PROGRAM_NOT_ADMITTED',
      `argv[0] ${JSON.stringify(program)} (${name}) is not in the realm's declared shell class (${admission.programs.join(', ')}); `
        + 'a program outside the declaration is refused before any process',
      program,
    )
  }
  const declaration = spec.shell
  if (declaration === undefined) {
    return shellRefusal(
      'SUBPROCESS_SHELL_INVOCATION_UNDECLARED',
      `argv[0] ${JSON.stringify(program)} is an admitted shell program but the request carries no declared invocation; `
        + 'the declared read/write/chmod roots are the only statically attributable input for a shell body, so an undeclared one is refused',
      program,
    )
  }
  if (typeof declaration.program !== 'string' || basename(declaration.program).toLowerCase() !== name) {
    return shellRefusal(
      'SUBPROCESS_SHELL_PROGRAM_NOT_ADMITTED',
      `the declared invocation names program ${JSON.stringify(declaration.program)}, which does not match argv[0] ${JSON.stringify(program)}; `
        + 'a declaration that describes another program is refused',
      program,
    )
  }
  if (spec.argv.length !== 3 || spec.argv[1] !== '-c' || typeof spec.argv[2] !== 'string' || spec.argv[2].trim() === '') {
    return shellRefusal(
      'SUBPROCESS_SHELL_ARGV_UNSUPPORTED',
      `argv[0] ${JSON.stringify(program)} is admitted only in the closed command-string shape '<program> -c <body>'; `
        + `got ${JSON.stringify([...spec.argv])} — flags such as -l/--login and positional operands are refused because their reads are not the declared ones`,
      program,
    )
  }
  const declaredRoots: readonly (readonly [string, readonly string[] | undefined])[] = [
    ['reads', declaration.reads],
    ['writes', declaration.writes],
    ['chmod', declaration.chmod],
  ]
  for (const [axis, roots] of declaredRoots) {
    if (roots === undefined) continue
    if (roots.some((root) => typeof root !== 'string' || root.trim() === '')) {
      return shellRefusal(
        'SUBPROCESS_SHELL_INVOCATION_UNDECLARED',
        `the declared ${axis} roots must be non-empty strings; an empty declaration cannot be admitted as "nothing to check"`,
        program,
      )
    }
  }
  return undefined
}

/**
 * Resolve one declared shell root against `cwd`. Roots are the CALLER's
 * declaration; resolving is the same normalisation `readIntentsOf` applies to
 * operands, never a widening.
 */
export function resolveShellRoot(cwd: string, root: string): string {
  return isAbsolute(root) ? resolvePath(root) : resolvePath(resolvePath(cwd), root)
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

// ---------------------------------------------------------------------------
// Ancestor/VCS ignore discovery — the live row-1 repair
// ---------------------------------------------------------------------------

/**
 * THE MEASURED DEFECT (live `a5sf-search-live` 2026-11-04T20-17-23-485Z, row 1;
 * judged FAIL `ROW1_CLAUSE_FAILED`):
 *
 *   Error: grep search failed (exit 2):
 *   rg: …/.worktrees/a5sf-search-live2/.git: Permission denied (os error 13)
 *
 * The lane admitted the search root and denied the worktree's `.git` FILE. The
 * confined `rg` walked ABOVE the search root for VCS/ancestor ignore discovery,
 * tried to read that `.git`, was refused by the OS profile, and treats the
 * refusal as FATAL (`exit 2`) even though the answer was already on stdout. The
 * sandbox is correct; the INVOCATION depended on data outside the lane.
 *
 * These two flags stop that discovery. Measured on the packaged
 * `@vscode/ripgrep-linux-x64@1.18.0` against a worktree whose `.git` file is
 * unreadable: `--no-ignore-parent` ALONE still reads `.git` and still exits 2;
 * `--no-ignore-vcs` is the flag that stops the VCS walk. Both are passed
 * together so the ignore LAW above the root is the confined walker's default
 * rather than an accident of which ancestors the lane happened to include.
 */
export const SEARCH_IGNORE_DISCOVERY_FLAGS: readonly string[] = Object.freeze(['--no-ignore-parent', '--no-ignore-vcs'])

/**
 * The disclosure recorded ON THE ALLOW FACT (never as an extra fact) when the
 * flags are added. The second line says exactly what `--no-ignore-vcs` removed:
 * `.gitignore` semantics are OFF for this invocation, so files a `.gitignore`
 * would hide ARE searched — the recorded answer to "why did my grep not honour
 * .gitignore". `.git` itself is never read.
 */
export const SEARCH_IGNORE_DISCOVERY_NOTES: readonly string[] = Object.freeze([
  'search-ignore-discovery=disabled: rg ran with --no-ignore-parent --no-ignore-vcs because an ancestor of the search root is outside the effective read lane, so ancestor/VCS ignore discovery would leave the lane and the kernel would deny it',
  'search-ignore-semantics: .gitignore and .git/info/exclude are NOT applied (rg --no-ignore-vcs) and parent ignore files are NOT read (--no-ignore-parent); files they would ignore under this search root ARE searched. .git was not read',
])

/** The result of {@link laneSafeSearchArgv}. */
export interface LaneSafeSearchArgv {
  /** The argv to execute (the declared argv, plus the flags when needed). */
  readonly argv: readonly string[]
  /** Flags this face added (empty when the declared argv is kept). */
  readonly addedFlags: readonly string[]
  /** The fact annotation for roots that triggered the flags (empty otherwise). */
  readonly annotations: readonly string[]
  /** The directory roots whose ancestor discovery would have left the lane. */
  readonly annotatedRoots: readonly string[]
}

const unchangedSearchArgv = (argv: readonly string[]): LaneSafeSearchArgv => Object.freeze({
  argv: Object.freeze([...argv]),
  addedFlags: Object.freeze([]),
  annotations: Object.freeze([]),
  annotatedRoots: Object.freeze([]),
})

/**
 * Does every ignore-discovery read from `root` upward stay inside `readLane`?
 *
 * The walk starts at the search root and only inspects directories the lane
 * ALLOWS, so it never depends on data outside the lane. It stops when:
 *  - it finds a `.git` that the lane allows → rg stops there too; contained;
 *  - it finds a `.git` the lane denies → that read is the fatal one; not
 *    contained (an explicit `deny: [<root>/.git]` is respected);
 *  - the next ancestor is outside the lane → unknown above; not contained;
 *  - it reaches the filesystem root → nothing above to read; contained.
 *
 * A FILE operand is skipped: ripgrep does no parent discovery for a file
 * argument (measured: exit 0 with an unreadable ancestor `.git`), so adding
 * ignore flags there would only change selection semantics for no reason.
 */
async function ancestorsStayInLane(
  root: string,
  readLane: PathRuleSet,
  resolver: PathIdentityResolver,
  deps: { readonly exists: (path: string) => boolean; readonly isDirectory: (path: string) => boolean },
): Promise<boolean> {
  if (!deps.isDirectory(root)) return true
  let dir = root
  for (;;) {
    const decision = await evaluateLocatorAccess({ lane: readLane, locator: dir, access: 'read', resolver })
    if (decision.decision !== 'allow') return false
    const git = join(dir, '.git')
    if (deps.exists(git)) {
      const gitDecision = await evaluateLocatorAccess({ lane: readLane, locator: git, access: 'read', resolver })
      return gitDecision.decision === 'allow'
    }
    const parent = dirname(dir)
    // Reaching `/` through an allowed path means there is no ancestor left to
    // read; `/.git` was just checked.
    if (parent === dir) return true
    dir = parent
  }
}

/**
 * Make an admitted `rg` invocation lane-self-contained: when a directory
 * search root's ancestors are outside the effective read lane, add
 * {@link SEARCH_IGNORE_DISCOVERY_FLAGS} before the first `--` (after
 * `--no-config`) so ripgrep does not walk out of the lane. When the root's
 * discovery already stays in the lane (e.g. the lane includes the worktree
 * root), the declared argv is kept EXACTLY as shipped — ordinary `.gitignore`
 * semantics are not changed globally.
 *
 * Callers must run this ONLY for argv {@link programAttributionRefusal}
 * already admitted (it re-checks the `rg` basename anyway). `--no-ignore`
 * already disables every ignore file and therefore the ancestor walk
 * (measured), so such an invocation is left untouched. This function reads
 * lane metadata only (in-lane ancestors), never the content of an outside
 * path, and it launches no process.
 */
export async function laneSafeSearchArgv(
  spec: { readonly argv: readonly string[]; readonly cwd: string },
  readLane: PathRuleSet,
  resolver: PathIdentityResolver = NODE_PATH_IDENTITY_RESOLVER,
  deps: {
    readonly exists?: (path: string) => boolean
    readonly isDirectory?: (path: string) => boolean
  } = {},
): Promise<LaneSafeSearchArgv> {
  const program = spec.argv[0]
  if (typeof program !== 'string' || basename(program).toLowerCase() !== 'rg') return unchangedSearchArgv(spec.argv)
  if (readLane.mode === 'all') return unchangedSearchArgv(spec.argv)
  const separator = spec.argv.indexOf('--')
  const flags = spec.argv.slice(1, separator === -1 ? spec.argv.length : separator)
  // `--no-ignore` disables ALL ignore files (and, measured, the `.git` walk),
  // so the shipped glob argv needs nothing added.
  if (flags.includes('--no-ignore')) return unchangedSearchArgv(spec.argv)
  const missing = SEARCH_IGNORE_DISCOVERY_FLAGS.filter((flag) => !flags.includes(flag))
  if (missing.length === 0) return unchangedSearchArgv(spec.argv)

  const exists = deps.exists ?? existsSync
  const isDirectory = deps.isDirectory ?? ((path: string): boolean => {
    try {
      return statSync(path).isDirectory()
    } catch {
      return false
    }
  })
  const roots = readIntentsOf(
    { argv: spec.argv, cwd: spec.cwd },
    { exists },
  )
  const outside: string[] = []
  for (const root of roots) {
    if (await ancestorsStayInLane(root, readLane, resolver, { exists, isDirectory })) continue
    outside.push(root)
  }
  if (outside.length === 0) return unchangedSearchArgv(spec.argv)

  // Insert AFTER `--no-config` when it is the first argument (the admitted
  // shape), otherwise immediately before the first `--`. Both positions keep
  // the flags out of the operand list.
  const insertAt = spec.argv[1] === '--no-config'
    ? 2
    : (separator === -1 ? spec.argv.length : separator)
  const argv = [
    ...spec.argv.slice(0, insertAt),
    ...missing,
    ...spec.argv.slice(insertAt),
  ]
  return Object.freeze({
    argv: Object.freeze(argv),
    addedFlags: Object.freeze(missing),
    annotations: SEARCH_IGNORE_DISCOVERY_NOTES,
    annotatedRoots: Object.freeze(outside),
  })
}

/**
 * Build the admission function for one Member's subprocess face. It is the
 * SAME `FsGuard` shape the confined `fs` Provider uses, so one
 * `observeGuard` wrapper serves both and no second decision vocabulary exists:
 * the read lane decides, and the refusal is the existing `IO_READ_DENIED` /
 * `IO_POLICY_UNSUPPORTED` / `IO_ASK_REQUIRES_APPROVAL` (the `ask` lane has no
 * approval consumer here either — A5-DUAL-PLANE-01).
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
        decision.decision === 'deny'
          ? 'IO_READ_DENIED'
          : decision.decision === 'ask' ? 'IO_ASK_REQUIRES_APPROVAL' : 'IO_POLICY_UNSUPPORTED',
        decision.detail,
        { memberIdentity: policy.memberIdentity, method, target: hostPath },
      )
    }
  }
}

/**
 * BL-17 — the guard METHOD this face consults for a declared shell WRITE
 * (`writes`, and `chmod` targets). It is a distinct method name so the fact
 * says which axis was consulted; the decision is the SAME
 * `evaluateLocatorAccess` (write access) and the SAME typed `TeamIoDenial`
 * vocabulary the `fs` face uses.
 */
export const SHELL_WRITE_GUARD_METHOD = 'spawn:write'

/**
 * The WRITE half of the shell admission. It is deliberately NOT the `fs`
 * guard's `writeText` path: the `fs` face adds a write⇒read requirement for an
 * existing target (the native read-before-write contract), while a shell lane
 * that grants write and withholds read MUST be able to write (`只写不读`).
 * The axis decision itself is identical — one evaluator, no second policy.
 */
export function createMemberSubprocessWriteGuard(
  policy: Pick<EffectiveIoPolicy, 'memberIdentity' | 'write'>,
  resolver: PathIdentityResolver = NODE_PATH_IDENTITY_RESOLVER,
): FsGuard {
  return async function subprocessWriteGuard(method: string, hostPath: string): Promise<void> {
    const lane: PathRuleSet = policy.write
    const decision = await evaluateLocatorAccess({ lane, locator: hostPath, access: 'write', resolver })
    if (decision.decision !== 'allow') {
      throw new TeamIoDenial(
        decision.decision === 'deny'
          ? 'IO_WRITE_DENIED'
          : decision.decision === 'ask' ? 'IO_ASK_REQUIRES_APPROVAL' : 'IO_POLICY_UNSUPPORTED',
        decision.detail,
        { memberIdentity: policy.memberIdentity, method, target: hostPath },
      )
    }
  }
}

// ---------------------------------------------------------------------------
// BL-17 — the network dimension: ask the backend, never assume it
// ---------------------------------------------------------------------------

/**
 * BL-18 — the structural carrier `probeNetworkDenial` needs.
 *
 * The probe is an OPTIONAL capability discovered on the backend object
 * (`provider.probe?.()`); `ConfinedProcessProvider` was only ever the FIRST
 * carrier. Declaring the minimum shape here is what lets the confined `web`
 * face call the SAME probe instead of growing a second, disagreeable one: a
 * process backend and a web backend answer one question with one vocabulary.
 * Every existing caller satisfies it structurally, so this is a widening that
 * changes no call site and no behaviour.
 */
export interface NetworkCapabilityProbeCarrier {
  readonly probe?: () => Promise<ProviderResult<readonly ConfinedCapabilityRow[]>>
}

/** What the backend's own probe said about the network dimension. */
export interface ConfinedNetworkCapabilityProbe {
  readonly dimension: 'network-destination'
  /** `enforced` only when the backend's probe says so; absence is `unsupported`. */
  readonly level: 'enforced' | 'unsupported'
  /** The probe's own note (or why no row was available). */
  readonly note: string
  /**
   * BL-42 — the mechanism the backend named for an `enforced` answer. `null`
   * for every `unsupported` answer (and for an `enforced` row that named none,
   * which is itself treated as `unsupported`).
   */
  readonly mechanism?: string | null
  /** BL-42 — the evidence reference the backend's row carried, or `null`. */
  readonly evidence?: string | null
  /** The raw capability rows the backend returned (empty when it has no probe). */
  readonly rows: readonly ConfinedCapabilityRow[]
}

/**
 * Ask the confined provider's OWN capability probe about network enforcement.
 *
 * WHY THIS IS NOT OPTIMISM: this host's provider set ships no network-deny
 * enforcement (`sandbox-provider/network.ts` refuses `deny`/`restricted`
 * before any process and states `network-destination: unsupported`). A face
 * that ran a `network: deny` command while claiming denial would be the worst
 * outcome available, so `deny` is admitted only on an explicit `enforced`
 * answer. No probe, a refused probe, or any other level all mean
 * `unsupported` — the closed answer, never a default-allow.
 */
export async function probeNetworkDenial(provider: NetworkCapabilityProbeCarrier): Promise<ConfinedNetworkCapabilityProbe> {
  const unsupported = (note: string): ConfinedNetworkCapabilityProbe => Object.freeze({
    dimension: 'network-destination' as const,
    level: 'unsupported' as const,
    note,
    rows: Object.freeze([]),
  })
  // The probe is an OPTIONAL capability of the backend, discovered structurally
  // (`ConfinedProcessProvider` stays the one-method seam every existing provider
  // and double already satisfies; P1-07's provider carries `probe()`). Absence,
  // a throw, a refusal or a missing row are all the SAME closed answer.
  const probe = provider.probe
  if (typeof probe !== 'function') {
    return unsupported('the confined provider exposes no capability probe, so network enforcement cannot be proven')
  }
  let probed
  try {
    probed = await probe.call(provider)
  } catch (error) {
    return unsupported(`the confined provider's capability probe threw (${error instanceof Error ? error.message : String(error)}); enforcement cannot be proven`)
  }
  if (!probed.ok) {
    return unsupported(`the confined provider's capability probe refused (${probed.error.code}); enforcement cannot be proven`)
  }
  const rows = probed.value
  const row = rows.find((candidate) => candidate.dimension === 'network-destination')
  if (row === undefined) {
    return unsupported('the confined provider reported no network-destination capability row; enforcement cannot be proven')
  }
  // BL-42 — A LEVEL ALONE IS NOT EVIDENCE. The bar (§7 item 1) asks for a
  // mechanism AND a recorded evidence row, so an `enforced` answer without both
  // is treated as `unsupported`: this is what stops "the code intends to
  // enforce" from ever being read as "the mechanism was applied". The real
  // provider now supplies both from its own measured net leg; a fixture or a
  // future backend that cannot is refused by the same gate.
  if (row.level === 'enforced') {
    if (typeof row.mechanism !== 'string' || row.mechanism.trim() === '') {
      return unsupported(`the confined provider reported network-destination='enforced' with NO mechanism — a level without a mechanism is not evidence; enforcement cannot be proven`)
    }
    if (typeof row.evidence !== 'string' || row.evidence.trim() === '') {
      return unsupported(`the confined provider reported network-destination='enforced' with mechanism '${row.mechanism}' but NO evidence row — an unrecorded mechanism is not evidence; enforcement cannot be proven`)
    }
  }
  return Object.freeze({
    dimension: 'network-destination' as const,
    level: row.level === 'enforced' ? 'enforced' as const : 'unsupported' as const,
    note: typeof row.note === 'string' && row.note !== '' ? row.note : `probe reported network-destination='${row.level}'`,
    mechanism: typeof row.mechanism === 'string' && row.mechanism !== '' ? row.mechanism : null,
    evidence: typeof row.evidence === 'string' && row.evidence !== '' ? row.evidence : null,
    rows: Object.freeze([...rows]),
  })
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
  /**
   * BL-17 — the realm's declared shell class. Absent = no shell program is
   * admitted on this face (the BL-16 refusal, unchanged). A composition that
   * intends to run a declared `bash -c` invocation supplies the programs it
   * admits; the Member cannot widen this through argv, config or a tool call.
   */
  readonly shellClass?: ConfinedShellClassAdmission
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
  /**
   * BL-17 — the lane requests `network: deny` and the backend's own capability
   * probe does NOT report `network-destination: enforced`. The existing
   * `NETWORK_UNCONFINED_REALM` concept (its install-time token lives in
   * `TEAM_SERVICE_INSTALL_CODES`), reused at the per-spawn refusal point: a
   * command that would reach the network is refused instead of run, and the
   * refusal never claims an enforcement this host does not have.
   */
  'NETWORK_UNCONFINED_REALM',
] as const

export type ConfinedSubprocessRefusalCode =
  | (typeof CONFINED_SUBPROCESS_REFUSAL_CODES)[number]
  | ConfinedShellAdmissionCode

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
  // BL-17: the WRITE lane consult a declared shell uses. Same evaluator, same
  // typed denial, same observed-guard transport — only the axis differs.
  const writeLaneGuard = createMemberSubprocessWriteGuard(effective)
  // The attribution refusal is a DECISION of this face, not a lane lookup, but
  // it must travel through the SAME observed guard so it is recorded as one
  // fact with the same schema. The queue is consumed synchronously by the
  // guard call below (spawn runs to that first `await` before returning), so a
  // concurrent spawn can never pick up another spawn's refusal.
  interface AdmissionFactRefusal {
    readonly code: 'IO_READ_DENIED' | 'IO_WRITE_DENIED'
    readonly detail: string
    readonly target: string
  }
  const pendingAttribution: AdmissionFactRefusal[] = []
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
    if (method === SHELL_WRITE_GUARD_METHOD) {
      await writeLaneGuard(method, hostPath)
      return
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
      //
      // BL-17: the shell-class DECISION comes before that: a declared shell
      // class admits a declared invocation; every other shell is refused with
      // its own typed code (not by falling through the rg allow-list, and not
      // by passing because it is not rg).
      const shellRefusal = shellClassAdmissionRefusal(spec, options.shellClass)
      const shellInvocation = shellRefusal === undefined && isShellClassSpawn(spec) ? spec.shell : undefined
      const attribution = shellRefusal !== undefined || shellInvocation !== undefined
        ? undefined
        : programAttributionRefusal(spec)
      // A shell body's own reads are NOT statically attributable (that is why it
      // needs a declaration); its declared roots are consulted below instead.
      const intents = attribution === undefined && shellInvocation === undefined
        ? readIntentsOf(spec)
        : Object.freeze([] as string[])
      const started = (async () => {
        if (shellRefusal !== undefined) {
          // One fact on the SAME observed transport (a read-axis refusal: the
          // body's reads cannot be attributed), then the shell-specific typed
          // code for the caller. No provider call in either case.
          pendingAttribution.push({ code: 'IO_READ_DENIED', detail: shellRefusal.detail, target: shellRefusal.target })
          try {
            await guard(SUBPROCESS_GUARD_METHOD, shellRefusal.target)
          } catch (error) {
            if (!(error instanceof TeamIoDenial)) throw error
          }
          throw new ConfinedSubprocessRefusal(shellRefusal.code, shellRefusal.detail)
        }
        // B3 (review round 3): the name allow-list cannot tell a shipped `rg`
        // from a Member-writable script that happens to be named `rg`. A
        // program whose realpath is inside the effective WRITE lane is refused
        // through the SAME guard/evaluator, before any provider call. BL-17:
        // the same identity check covers an admitted shell program (a
        // Member-writable file named `bash` is still refused).
        const refusal = attribution ?? await programWriteLaneRefusal(spec.argv[0] as string, effective.write)
        if (refusal !== undefined) {
          pendingAttribution.push(refusal)
          await guard(SUBPROCESS_GUARD_METHOD, refusal.target)
          // The guard rethrows the typed denial above; this line is defence
          // against an admission invariant breaking silently.
          throw new TeamIoDenial(refusal.code, refusal.detail, {
            memberIdentity: effective.memberIdentity,
            method: SUBPROCESS_GUARD_METHOD,
            target: refusal.target,
          })
        }
        // BL-17 — THE NETWORK AXIS, ASKED NOT ASSUMED. `network: deny` is a
        // claim about the OS; it is admitted only on the backend's own
        // `enforced` capability row. Anything else refuses the spawn with the
        // existing `NETWORK_UNCONFINED_REALM` concept, before any process, so
        // no command can reach the network under a claim this host cannot keep.
        const networkDenied = effective.network.access === 'deny'
        if (networkDenied) {
          const capability = await probeNetworkDenial(provider)
          if (capability.level !== 'enforced') {
            throw new ConfinedSubprocessRefusal(
              'NETWORK_UNCONFINED_REALM',
              `the effective lane requests network=deny, but the confined provider's capability probe reports `
                + `${capability.dimension}='${capability.level}' (${capability.note}); refusing before any process instead of running `
                + 'a network-capable child under a deny claim this host cannot enforce. A backend that proves '
                + `'enforced' is the only configuration that admits this spawn`,
            )
          }
        }
        // BL-16 live row 1: a confined `rg` whose search root sits inside a
        // git worktree used to walk ABOVE the lane for VCS/ancestor ignore
        // discovery, read the lane-denied `.git`, and treat that kernel refusal
        // as fatal (exit 2) even though the answer was on stdout. The lane is
        // NOT widened: the INVOCATION is made self-contained (or, for a root
        // whose discovery already stays in the lane, left exactly as shipped).
        // The rewrite is disclosed on the allow fact, never as an extra fact.
        const searchArgv = attribution === undefined && shellInvocation === undefined
          ? await laneSafeSearchArgv(spec, effective.read)
          : unchangedSearchArgv(spec.argv)
        for (const intent of intents) {
          const annotations = searchArgv.annotatedRoots.includes(intent) && searchArgv.annotations.length > 0
            ? searchArgv.annotations
            : undefined
          await guard(SUBPROCESS_GUARD_METHOD, intent, annotations)
        }
        // BL-17: every DECLARED shell root is consulted before the provider is
        // called — reads on the read lane, writes and `chmod` targets on the
        // write lane. The body itself is the OS profile's problem (and
        // `chmod` has no Landlock right at all, which is why an UNDECLARED mode
        // change is disclosed as outside this admission's reach).
        if (shellInvocation !== undefined) {
          for (const root of shellInvocation.reads ?? []) {
            await guard(SUBPROCESS_GUARD_METHOD, resolveShellRoot(spec.cwd, root))
          }
          for (const root of [...(shellInvocation.writes ?? []), ...(shellInvocation.chmod ?? [])]) {
            await guard(SHELL_WRITE_GUARD_METHOD, resolveShellRoot(spec.cwd, root))
          }
        }
        const allowPaths = confinedSpawnAllowPaths(profile.value.allowPaths, spec.argv[0] as string, options.runtimeAllowPaths ?? [])
        const request: SpawnRequest = {
          grantFingerprint: `bl16:${options.realmId ?? effective.memberIdentity}:${effective.policyRevision}:${String(Date.now())}:${String(++spawnSequence)}`,
          realmId: options.realmId ?? effective.memberIdentity,
          bindingId: options.bindingId ?? (effective.toolBindingIdentity ?? 'member'),
          memberScope: options.memberScope ?? effective.memberIdentity,
          argv: [...searchArgv.argv],
          cwd: resolvePath(spec.cwd),
          env: envPairs({ ...confinedChildEnvironment(spec.env), ...options.env }),
          allowPaths,
          // BL-17: the request carries the network dimension ONLY when the
          // probe proved it (checked above). With `allow` the field is absent,
          // exactly as before — the face never claims a dimension it did not
          // probe.
          ...(networkDenied ? { networkProfile: 'deny' as const } : {}),
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
