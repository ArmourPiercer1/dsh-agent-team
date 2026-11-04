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
/** The one provider method a confined spawn needs. */
export interface ConfinedProcessProvider {
    spawnStreaming(request: SpawnRequest, streaming?: StreamingOptions): Promise<ProviderResult<ConfinedStreamProcess>>;
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
 * Build the admission function for one Member's subprocess face. It is the
 * SAME `FsGuard` shape the confined `fs` Provider uses, so one
 * `observeGuard` wrapper serves both and no second decision vocabulary exists:
 * the read lane decides, and the refusal is the existing `IO_READ_DENIED` /
 * `IO_POLICY_UNSUPPORTED`.
 */
export declare function createMemberSubprocessGuard(policy: Pick<EffectiveIoPolicy, 'memberIdentity' | 'read'>, resolver?: PathIdentityResolver): FsGuard;
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
}
/** A Provider constructor Cordis can mount as the `subprocess` service. */
export type SubprocessProviderConstructor = new (ctx: unknown, config?: Record<string, unknown>) => unknown;
/** The closed refusal vocabulary of THIS provider (never a bare `Error`). */
export declare const CONFINED_SUBPROCESS_REFUSAL_CODES: readonly ["SUBPROCESS_PROGRAM_NOT_ABSOLUTE", "SUBPROCESS_STDIO_UNSUPPORTED", "SUBPROCESS_PROFILE_REFUSED", "SUBPROCESS_PROVIDER_REFUSED", "SUBPROCESS_TERMINAL_UNSUPPORTED", "SUBPROCESS_EXIT_UNRECORDABLE"];
export type ConfinedSubprocessRefusalCode = (typeof CONFINED_SUBPROCESS_REFUSAL_CODES)[number];
/** A typed refusal from the confined subprocess face. */
export declare class ConfinedSubprocessRefusal extends Error {
    readonly code: ConfinedSubprocessRefusalCode;
    readonly detail: string;
    constructor(code: ConfinedSubprocessRefusalCode, detail: string);
}
export declare function createConfinedSubprocessClass(Base: new (ctx: never, config?: never) => unknown, options: ConfinedSubprocessOptions): SubprocessProviderConstructor;
//# sourceMappingURL=subprocess.d.ts.map