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
import type { Readable, Writable } from 'node:stream';
import type { AllowPathEntry, PayloadExitRecord, ProviderResult, SpawnRequest, StreamingOptions } from '../../sandbox-provider/index.js';
import { type PathIdentityResolver } from '../../member-io-policy/src/provider-capabilities.js';
import type { EffectiveIoPolicy, PathRuleSet } from '../../member-io-policy/src/types.js';
import type { FsGuard } from './fs.js';
import { type GuardConsultObserver } from './guard-observability.js';
/** The methods this provider consults its guard under (the fact's `method`). */
export declare const SUBPROCESS_GUARD_METHOD = "spawn";
/** Closed per-stream dispositions, mirrored from the native seam's vocabulary. */
export type ConfinedStdinMode = 'ignore' | 'pipe' | {
    readonly data: string;
};
export type ConfinedCollectMode = {
    readonly maxBytes: number;
    readonly spill?: {
        readonly maxBytes: number;
    };
};
export type ConfinedOutputMode = 'pipe' | 'inherit' | ConfinedCollectMode;
/** A spawn request shaped like the native `SubprocessSpawnSpec`. */
export interface ConfinedSpawnSpec {
    readonly argv: readonly string[];
    readonly cwd: string;
    readonly stdio: {
        readonly stdin: ConfinedStdinMode;
        readonly stdout: ConfinedOutputMode;
        readonly stderr: ConfinedOutputMode;
        readonly control?: 'pipe';
    };
    readonly graceMs: number;
    readonly signal?: AbortSignal | undefined;
    readonly env?: NodeJS.ProcessEnv | undefined;
    /**
     * BL-17: the DECLARED shell-class invocation. Present only for a shell-class
     * `argv[0]`; it states which admitted program runs and which roots the
     * command declares it will touch. The body is read-opaque, so this
     * declaration is the ONLY statically attributable input the face has — and
     * the OS profile stays the boundary for everything it does not name.
     */
    readonly shell?: ConfinedShellDeclaration | undefined;
}
/** The streaming handle P1-07's provider hands back (structural subset). */
export interface ConfinedStreamProcess {
    readonly pid: number;
    readonly stdin: Writable;
    readonly stdout: Readable;
    readonly stderr: Readable;
    readonly exited: Promise<{
        readonly code: number | null;
        readonly signal: string | null;
    }>;
    terminate(options?: StreamingOptions): Promise<unknown>;
    readonly payloadExit: Promise<PayloadExitRecord>;
}
/** One capability row as the confined provider's OWN probe states it. */
export interface ConfinedCapabilityRow {
    readonly dimension: string;
    readonly level: string;
    readonly note?: string | undefined;
    /**
     * BL-42 — the mechanism the backend names for this row (required for an
     * `enforced` network answer). Optional here because the OTHER dimensions
     * keep their historical three-field shape; the probe treats a missing
     * mechanism on `network-destination: enforced` as `unsupported`.
     */
    readonly mechanism?: string | null | undefined;
    /** BL-42 — the recorded evidence reference for this row, when it carries one. */
    readonly evidence?: string | null | undefined;
}
/** The one provider method a confined spawn needs. */
export interface ConfinedProcessProvider {
    spawnStreaming(request: SpawnRequest, streaming?: StreamingOptions): Promise<ProviderResult<ConfinedStreamProcess>>;
    /**
     * OPTIONAL capability probe (BL-17). The shipped OS provider carries it; a
     * double without one is `unsupported`, never a default allow. BL-18 shares
     * this declaration with the confined `web` face through
     * {@link NetworkCapabilityProbeCarrier}, so one probe answers both lanes.
     */
    readonly probe?: () => Promise<ProviderResult<readonly ConfinedCapabilityRow[]>>;
}
/** One bounded output reader (the native `SubprocessOutputReader` contract). */
export interface ConfinedOutputReader {
    readFrom(fromByte: number): {
        readonly text: string;
        readonly nextOffset: number;
        readonly lossy: boolean;
    };
    finalize(): {
        readonly text: string;
        readonly truncated: boolean;
    };
    snapshot(): {
        readonly bytes: Buffer;
        readonly totalBytes: number;
    };
    seal(): void;
    readonly total: number;
}
/**
 * The bounded in-memory tail collector, matching the native seam's documented
 * collect semantics (offset-based, non-consuming; overflow keeps the TAIL and
 * reports `lossy`). It is a local implementation because this lane must not
 * import an upstream provider's internal module (CORE PATCH BUDGET = 0 and the
 * AGENTS.md "no upstream internal API" rule).
 */
export declare function createConfinedOutputReader(maxBytes: number): ConfinedOutputReader;
/**
 * The DECLARED, typed list of programs whose reads this face can attribute to
 * `argv` operands. It is an ALLOW-LIST, not a shell-class deny-list: a program
 * not named here is unknown to the admission and is refused, so a future tool
 * must add its program here deliberately (with its argv contract) instead of
 * inheriting the face by accident. `rg` is the binary the shipped `grep`/`glob`
 * argv executes (`@vscode/ripgrep`, invoked by `dsh-tool-fs-search` with
 * `--no-config` and the search root behind `--`).
 */
export declare const CONFINED_SUBPROCESS_STATIC_PROGRAMS: readonly string[];
/**
 * Interpreter / shell-class program names. They are named ONLY so the refusal
 * detail is truthful ("this is a shell body, not a declared operand"); the
 * allow-list above is what refuses them (they are not on it). Prefixes cover
 * versioned interpreters (`python3.12`, `nodejs`, …).
 */
export declare const CONFINED_SUBPROCESS_SHELL_CLASS_PROGRAMS: readonly string[];
/** One attribution refusal (a typed denial, decided before any process). */
export interface ProgramAttributionRefusal {
    /** The existing denial code: this is a read refusal, decided at admission. */
    readonly code: 'IO_READ_DENIED';
    /** Why the reads cannot be attributed to the declared operands. */
    readonly detail: string;
    /** The program path the refusal is about (also the recorded fact locator). */
    readonly target: string;
}
/** True for a shell/interpreter-class program name (basename, lower-case). */
export declare function isShellClassProgram(programName: string): boolean;
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
export declare function programAttributionRefusal(spec: {
    readonly argv: readonly string[];
}): ProgramAttributionRefusal | undefined;
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
export declare function programWriteLaneRefusal(program: string, writeLane: PathRuleSet, resolver?: PathIdentityResolver): Promise<ProgramAttributionRefusal | undefined>;
/**
 * The closed refusal vocabulary of the shell-class admission. A shell program
 * is not "not-rg, therefore refused" (BL-16) and not "not-rg, therefore
 * passed" (the hole BL-17 must not open): it is a class the REALM declares and
 * a call DECLARES, with a typed refusal for every way that declaration can be
 * missing or malformed.
 */
export declare const CONFINED_SHELL_ADMISSION_CODES: readonly ["SUBPROCESS_SHELL_NOT_DECLARED", "SUBPROCESS_SHELL_PROGRAM_NOT_ADMITTED", "SUBPROCESS_SHELL_INVOCATION_UNDECLARED", "SUBPROCESS_SHELL_ARGV_UNSUPPORTED"];
export type ConfinedShellAdmissionCode = (typeof CONFINED_SHELL_ADMISSION_CODES)[number];
/** One shell-admission refusal (decided before any process). */
export interface ShellAdmissionRefusal {
    readonly code: ConfinedShellAdmissionCode;
    readonly detail: string;
    readonly target: string;
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
    readonly programs: readonly string[];
}
/**
 * The declared invocation of ONE shell spawn. The body is read-opaque, so the
 * caller declares what the command will touch; each root is resolved against
 * `cwd` and consulted on the axis it belongs to. The declaration is NOT a
 * grant: every root still has to be admitted by the compiled lane.
 */
export interface ConfinedShellDeclaration {
    /** The shell program basename this invocation runs; must match `argv[0]`. */
    readonly program: string;
    /** Roots the command declares it will READ. */
    readonly reads?: readonly string[] | undefined;
    /** Roots the command declares it will CREATE / MODIFY / REMOVE. */
    readonly writes?: readonly string[] | undefined;
    /**
     * Paths whose MODE the command declares it will change (`chmod`). Landlock
     * cannot mediate a same-uid mode change, so this declaration is the ONLY
     * layer that can refuse an out-of-lane one — disclosed, not claimed away.
     */
    readonly chmod?: readonly string[] | undefined;
}
/** True when `argv[0]` names a shell-class program (the class this gate owns). */
export declare function isShellClassSpawn(spec: {
    readonly argv: readonly string[];
}): boolean;
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
export declare function shellClassAdmissionRefusal(spec: {
    readonly argv: readonly string[];
    readonly shell?: ConfinedShellDeclaration | undefined;
}, admission: ConfinedShellClassAdmission | undefined): ShellAdmissionRefusal | undefined;
/**
 * Resolve one declared shell root against `cwd`. Roots are the CALLER's
 * declaration; resolving is the same normalisation `readIntentsOf` applies to
 * operands, never a widening.
 */
export declare function resolveShellRoot(cwd: string, root: string): string;
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
export declare function readIntentsOf(spec: {
    readonly argv: readonly string[];
    readonly cwd: string;
}, deps?: {
    readonly exists?: (path: string) => boolean;
}): readonly string[];
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
export declare const SEARCH_IGNORE_DISCOVERY_FLAGS: readonly string[];
/**
 * The disclosure recorded ON THE ALLOW FACT (never as an extra fact) when the
 * flags are added. The second line says exactly what `--no-ignore-vcs` removed:
 * `.gitignore` semantics are OFF for this invocation, so files a `.gitignore`
 * would hide ARE searched — the recorded answer to "why did my grep not honour
 * .gitignore". `.git` itself is never read.
 */
export declare const SEARCH_IGNORE_DISCOVERY_NOTES: readonly string[];
/** The result of {@link laneSafeSearchArgv}. */
export interface LaneSafeSearchArgv {
    /** The argv to execute (the declared argv, plus the flags when needed). */
    readonly argv: readonly string[];
    /** Flags this face added (empty when the declared argv is kept). */
    readonly addedFlags: readonly string[];
    /** The fact annotation for roots that triggered the flags (empty otherwise). */
    readonly annotations: readonly string[];
    /** The directory roots whose ancestor discovery would have left the lane. */
    readonly annotatedRoots: readonly string[];
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
export declare function laneSafeSearchArgv(spec: {
    readonly argv: readonly string[];
    readonly cwd: string;
}, readLane: PathRuleSet, resolver?: PathIdentityResolver, deps?: {
    readonly exists?: (path: string) => boolean;
    readonly isDirectory?: (path: string) => boolean;
}): Promise<LaneSafeSearchArgv>;
/**
 * Build the admission function for one Member's subprocess face. It is the
 * SAME `FsGuard` shape the confined `fs` Provider uses, so one
 * `observeGuard` wrapper serves both and no second decision vocabulary exists:
 * the read lane decides, and the refusal is the existing `IO_READ_DENIED` /
 * `IO_POLICY_UNSUPPORTED` / `IO_ASK_REQUIRES_APPROVAL` (the `ask` lane has no
 * approval consumer here either — A5-DUAL-PLANE-01).
 */
export declare function createMemberSubprocessGuard(policy: Pick<EffectiveIoPolicy, 'memberIdentity' | 'read'>, resolver?: PathIdentityResolver): FsGuard;
/**
 * BL-17 — the guard METHOD this face consults for a declared shell WRITE
 * (`writes`, and `chmod` targets). It is a distinct method name so the fact
 * says which axis was consulted; the decision is the SAME
 * `evaluateLocatorAccess` (write access) and the SAME typed `TeamIoDenial`
 * vocabulary the `fs` face uses.
 */
export declare const SHELL_WRITE_GUARD_METHOD = "spawn:write";
/**
 * The WRITE half of the shell admission. It is deliberately NOT the `fs`
 * guard's `writeText` path: the `fs` face adds a write⇒read requirement for an
 * existing target (the native read-before-write contract), while a shell lane
 * that grants write and withholds read MUST be able to write (`只写不读`).
 * The axis decision itself is identical — one evaluator, no second policy.
 */
export declare function createMemberSubprocessWriteGuard(policy: Pick<EffectiveIoPolicy, 'memberIdentity' | 'write'>, resolver?: PathIdentityResolver): FsGuard;
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
    readonly probe?: () => Promise<ProviderResult<readonly ConfinedCapabilityRow[]>>;
}
/** What the backend's own probe said about the network dimension. */
export interface ConfinedNetworkCapabilityProbe {
    readonly dimension: 'network-destination';
    /** `enforced` only when the backend's probe says so; absence is `unsupported`. */
    readonly level: 'enforced' | 'unsupported';
    /** The probe's own note (or why no row was available). */
    readonly note: string;
    /**
     * BL-42 — the mechanism the backend named for an `enforced` answer. `null`
     * for every `unsupported` answer (and for an `enforced` row that named none,
     * which is itself treated as `unsupported`).
     */
    readonly mechanism?: string | null;
    /** BL-42 — the evidence reference the backend's row carried, or `null`. */
    readonly evidence?: string | null;
    /** The raw capability rows the backend returned (empty when it has no probe). */
    readonly rows: readonly ConfinedCapabilityRow[];
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
export declare function probeNetworkDenial(provider: NetworkCapabilityProbeCarrier): Promise<ConfinedNetworkCapabilityProbe>;
/**
 * Merge the compiled profile with the runtime allowance (lane wins on overlap).
 *
 * Exported so an OS-layer arm can build the SAME request the product builds
 * WITHOUT re-deriving the allowance in the test (a test-local copy could drift
 * from the shipped one). It is a construction helper, not a policy decision.
 */
export declare function confinedSpawnAllowPaths(profile: readonly AllowPathEntry[], program: string, extra?: readonly AllowPathEntry[]): AllowPathEntry[];
/**
 * The child environment: the ambient parent environment minus credential-shaped
 * names and minus every `DSH_*` name, then the spec's explicit entries (a
 * string is a deliberate opt-in; `undefined` is a tombstone). This mirrors the
 * native provider's documented scrub — implemented here because the Team lane
 * has no dependency on the upstream subprocess package (lockfile untouched).
 */
export declare function confinedChildEnvironment(overrides: NodeJS.ProcessEnv | undefined): Record<string, string>;
/** Everything the confined subprocess Provider needs, supplied by the realm. */
export interface ConfinedSubprocessOptions {
    /** The compiled `EffectiveIo` (`ceiling ∩ restriction`) this face enforces. */
    readonly effective: EffectiveIoPolicy;
    /** The OS-confined process provider instance (P1-07; the caller builds it). */
    readonly provider: ConfinedProcessProvider;
    /** Extra runtime allow-entries (e.g. an interpreter's own dir); additive. */
    readonly runtimeAllowPaths?: readonly AllowPathEntry[];
    /** Extra child env entries layered after the scrub (never policy). */
    readonly env?: Readonly<Record<string, string>>;
    /**
     * The provider's own realm identity. The confined process provider refuses a
     * request that names a different realm ("realm confusion"), so the
     * composition that CREATED the provider supplies its realm id here; the
     * Member identity is only the fallback.
     */
    readonly realmId?: string;
    /** The lease's binding id; defaults to the effective policy's binding identity. */
    readonly bindingId?: string;
    /** The lease's member scope; defaults to the Member instance identity. */
    readonly memberScope?: string;
    /** The admission guard; defaults to `createMemberSubprocessGuard(effective)`. */
    readonly guard?: FsGuard;
    /** Optional fact observer — wrapped with `observeGuard` (one fact/consult). */
    readonly onGuardConsult?: GuardConsultObserver;
    /** The realm this face reports its facts on (defaults to the Member ceiling). */
    readonly realm?: 'member' | 'binding';
    /** The binding identity the effective policy was compiled for, if any. */
    readonly toolBindingIdentity?: string | null;
    /**
     * BL-17 — the realm's declared shell class. Absent = no shell program is
     * admitted on this face (the BL-16 refusal, unchanged). A composition that
     * intends to run a declared `bash -c` invocation supplies the programs it
     * admits; the Member cannot widen this through argv, config or a tool call.
     */
    readonly shellClass?: ConfinedShellClassAdmission;
}
/** A Provider constructor Cordis can mount as the `subprocess` service. */
export type SubprocessProviderConstructor = new (ctx: unknown, config?: Record<string, unknown>) => unknown;
/** The closed refusal vocabulary of THIS provider (never a bare `Error`). */
export declare const CONFINED_SUBPROCESS_REFUSAL_CODES: readonly ["SUBPROCESS_PROGRAM_NOT_ABSOLUTE", "SUBPROCESS_STDIO_UNSUPPORTED", "SUBPROCESS_PROFILE_REFUSED", "SUBPROCESS_PROVIDER_REFUSED", "SUBPROCESS_TERMINAL_UNSUPPORTED", "SUBPROCESS_EXIT_UNRECORDABLE", "NETWORK_UNCONFINED_REALM"];
export type ConfinedSubprocessRefusalCode = (typeof CONFINED_SUBPROCESS_REFUSAL_CODES)[number] | ConfinedShellAdmissionCode;
/** A typed refusal from the confined subprocess face. */
export declare class ConfinedSubprocessRefusal extends Error {
    readonly code: ConfinedSubprocessRefusalCode;
    readonly detail: string;
    constructor(code: ConfinedSubprocessRefusalCode, detail: string);
}
export declare function createConfinedSubprocessClass(Base: new (ctx: never, config?: never) => unknown, options: ConfinedSubprocessOptions): SubprocessProviderConstructor;
//# sourceMappingURL=subprocess.d.ts.map