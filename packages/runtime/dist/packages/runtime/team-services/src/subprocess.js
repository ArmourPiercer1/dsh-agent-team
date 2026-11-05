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
import { existsSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve as resolvePath } from 'node:path';
import { constants as osConstants } from 'node:os';
import { NODE_PATH_IDENTITY_RESOLVER, evaluateLocatorAccess, } from '../../member-io-policy/src/provider-capabilities.js';
import { compileExecutionProfile } from '../../team-sandbox/src/profile.js';
import { observeGuard } from './guard-observability.js';
import { TeamIoDenial } from './types.js';
/** The methods this provider consults its guard under (the fact's `method`). */
export const SUBPROCESS_GUARD_METHOD = 'spawn';
/**
 * The bounded in-memory tail collector, matching the native seam's documented
 * collect semantics (offset-based, non-consuming; overflow keeps the TAIL and
 * reports `lossy`). It is a local implementation because this lane must not
 * import an upstream provider's internal module (CORE PATCH BUDGET = 0 and the
 * AGENTS.md "no upstream internal API" rule).
 */
export function createConfinedOutputReader(maxBytes) {
    if (!Number.isFinite(maxBytes) || maxBytes < 1) {
        throw new TypeError('createConfinedOutputReader needs a positive finite maxBytes');
    }
    const chunks = [];
    let bytes = 0;
    let dropped = false;
    let total = 0;
    return Object.freeze({
        get total() {
            return total;
        },
        push(chunk) {
            total += chunk.length;
            chunks.push(chunk);
            bytes += chunk.length;
            while (bytes > maxBytes) {
                const head = chunks[0];
                if (head === undefined)
                    break;
                const excess = bytes - maxBytes;
                if (head.length <= excess) {
                    chunks.shift();
                    bytes -= head.length;
                }
                else {
                    chunks[0] = head.subarray(excess);
                    bytes -= excess;
                }
                dropped = true;
            }
        },
        readFrom(fromByte) {
            const windowStart = total - bytes;
            const buffer = Buffer.concat(chunks);
            const lossy = fromByte < windowStart;
            return {
                text: (lossy ? buffer : buffer.subarray(fromByte - windowStart)).toString('utf8'),
                nextOffset: total,
                lossy,
            };
        },
        finalize() {
            return { text: Buffer.concat(chunks).toString('utf8'), truncated: dropped };
        },
        snapshot() {
            return { bytes: Buffer.concat(chunks), totalBytes: total };
        },
        seal() {
            /* memory-only collector: sealing is a lifecycle no-op */
        },
    });
}
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
export const CONFINED_SUBPROCESS_STATIC_PROGRAMS = Object.freeze(['rg']);
/**
 * Interpreter / shell-class program names. They are named ONLY so the refusal
 * detail is truthful ("this is a shell body, not a declared operand"); the
 * allow-list above is what refuses them (they are not on it). Prefixes cover
 * versioned interpreters (`python3.12`, `nodejs`, …).
 */
export const CONFINED_SUBPROCESS_SHELL_CLASS_PROGRAMS = Object.freeze([
    'sh', 'bash', 'dash', 'zsh', 'ksh', 'mksh', 'ash', 'fish', 'csh', 'tcsh',
    'busybox', 'env', 'xargs', 'find', 'sed', 'awk', 'gawk', 'mawk', 'nawk',
    'perl', 'ruby', 'lua', 'php', 'tclsh', 'wish', 'expect', 'script', 'timeout',
    'nice', 'nohup', 'stdbuf', 'setsid', 'su', 'sudo', 'doas',
]);
const SHELL_CLASS_PREFIXES = Object.freeze(['python', 'node', 'perl', 'ruby', 'php', 'lua']);
/** True for a shell/interpreter-class program name (basename, lower-case). */
export function isShellClassProgram(programName) {
    const name = programName.toLowerCase();
    return CONFINED_SUBPROCESS_SHELL_CLASS_PROGRAMS.includes(name)
        || SHELL_CLASS_PREFIXES.some((prefix) => name.startsWith(prefix));
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
export function programAttributionRefusal(spec) {
    const program = spec.argv[0];
    if (typeof program !== 'string' || program.length === 0) {
        return Object.freeze({ code: 'IO_READ_DENIED', detail: 'argv has no program element, so its reads cannot be attributed', target: String(program) });
    }
    const name = basename(program).toLowerCase();
    if (isShellClassProgram(name)) {
        return Object.freeze({
            code: 'IO_READ_DENIED',
            detail: `argv[0] ${JSON.stringify(program)} is shell/interpreter-class (${name}); its reads cannot be statically attributed to the declared read roots, so the spawn is refused before any process`,
            target: program,
        });
    }
    if (!CONFINED_SUBPROCESS_STATIC_PROGRAMS.includes(name)) {
        return Object.freeze({
            code: 'IO_READ_DENIED',
            detail: `argv[0] ${JSON.stringify(program)} (${name}) is not in the declared statically-attributable program list (${CONFINED_SUBPROCESS_STATIC_PROGRAMS.join(', ')}); an unknown binary is refused fail-closed`,
            target: program,
        });
    }
    if (name === 'rg')
        return rgArgvRefusal(program, spec.argv);
    return undefined;
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
const RG_ADMITTED_FLAGS = Object.freeze([
    '--json',
    '--files',
    '--sort=modified',
    '--no-ignore',
    '--hidden',
]);
const RG_ADMITTED_PREFIXES = Object.freeze(['--regexp=', '--glob=']);
/** The per-program argv contract for `rg` (called only after the name check). */
function rgArgvRefusal(program, argv) {
    const refusal = (detail) => Object.freeze({ code: 'IO_READ_DENIED', detail: `argv[0] rg ${detail}`, target: program });
    // B2 (review round 3): the token must be the FIRST argument, before any `--`.
    // `argv.includes('--no-config')` was position-insensitive: a lane file named
    // `--no-config` placed after `--` satisfied it while rg never received the
    // flag, so `RIPGREP_CONFIG_PATH` could inject `--pre` and execute a program.
    if (argv[1] !== '--no-config') {
        return refusal('must pass --no-config as its FIRST argument (immediately after the program, before the first --): a --no-config after -- is an OPERAND, not a flag, and a ripgrep config file could otherwise inject --pre');
    }
    const separator = argv.indexOf('--');
    const flags = argv.slice(1, separator === -1 ? argv.length : separator);
    for (const token of flags.slice(1)) {
        if (RG_ADMITTED_FLAGS.includes(token) || RG_ADMITTED_PREFIXES.some((prefix) => token.startsWith(prefix)))
            continue;
        if (token === '--pre' || token.startsWith('--pre=')) {
            return refusal(`passes ${JSON.stringify(token)}, which executes another program whose reads are not in the declared operands`);
        }
        if (token === '--search-zip' || token === '-z'
            || (token.length > 1 && token.startsWith('-') && !token.startsWith('--') && token.slice(1).includes('z'))) {
            return refusal(`passes ${JSON.stringify(token)}, which runs a decompressor (search-zip) whose reads are not in the declared operands`);
        }
        if (token === '-f' || token === '--file' || token.startsWith('--file=')
            || token === '--ignore-file' || token.startsWith('--ignore-file=')) {
            return refusal(`passes ${JSON.stringify(token)}, which reads a pattern/ignore FILE that is not a declared operand; only the shipped search argv shapes are admitted`);
        }
        return refusal(`passes ${JSON.stringify(token)}, which is not one of the argv shapes the shipped grep/glob module emits (${[...RG_ADMITTED_FLAGS, '--regexp=…', '--glob=…'].join(', ')}); every other flag fails closed`);
    }
    return undefined;
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
export async function programWriteLaneRefusal(program, writeLane, resolver = NODE_PATH_IDENTITY_RESOLVER) {
    if (typeof program !== 'string' || program.length === 0)
        return undefined;
    let decision;
    try {
        decision = await evaluateLocatorAccess({ lane: writeLane, locator: program, access: 'write', resolver });
    }
    catch (error) {
        return Object.freeze({
            code: 'IO_READ_DENIED',
            detail: `argv[0] ${JSON.stringify(program)} could not be resolved against the Member write lane (${error instanceof Error ? error.message : String(error)}); an unresolvable program is refused fail-closed`,
            target: program,
        });
    }
    if (decision.decision === 'allow') {
        return Object.freeze({
            code: 'IO_READ_DENIED',
            detail: `argv[0] ${JSON.stringify(program)} resolves inside the Member's effective WRITE lane ('${decision.resolved}'); a program the caller can write is not statically attributable (the caller could replace its bytes), so the spawn is refused before any process`,
            target: program,
        });
    }
    if (decision.decision === 'unsupported') {
        return Object.freeze({
            code: 'IO_READ_DENIED',
            detail: `argv[0] ${JSON.stringify(program)} could not be resolved by the path identity Provider (${decision.detail}); an unresolvable program is refused fail-closed`,
            target: program,
        });
    }
    return undefined;
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
export function readIntentsOf(spec, deps = {}) {
    const exists = deps.exists ?? existsSync;
    const cwd = resolvePath(spec.cwd);
    const separator = spec.argv.indexOf('--');
    if (separator !== -1) {
        const operands = spec.argv.slice(separator + 1).map((token) => (isAbsolute(token) ? resolvePath(token) : resolvePath(cwd, token)));
        return operands.length === 0 ? Object.freeze([cwd]) : Object.freeze(operands);
    }
    const shellClass = spec.argv.length > 1 && typeof spec.argv[0] === 'string' && isShellClassProgram(basename(spec.argv[0]));
    const operands = [];
    for (let index = 1; index < spec.argv.length; index += 1) {
        const token = spec.argv[index];
        if (token === '-c' && shellClass) {
            index += 1; // the command string is not a path; the shell is refused anyway
            continue;
        }
        if (token.startsWith('-'))
            continue;
        if (isAbsolute(token)) {
            operands.push(resolvePath(token));
            continue;
        }
        const candidate = resolvePath(cwd, token);
        if (exists(candidate))
            operands.push(candidate);
    }
    return operands.length === 0 ? Object.freeze([cwd]) : Object.freeze(operands);
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
export const SEARCH_IGNORE_DISCOVERY_FLAGS = Object.freeze(['--no-ignore-parent', '--no-ignore-vcs']);
/**
 * The disclosure recorded ON THE ALLOW FACT (never as an extra fact) when the
 * flags are added. The second line says exactly what `--no-ignore-vcs` removed:
 * `.gitignore` semantics are OFF for this invocation, so files a `.gitignore`
 * would hide ARE searched — the recorded answer to "why did my grep not honour
 * .gitignore". `.git` itself is never read.
 */
export const SEARCH_IGNORE_DISCOVERY_NOTES = Object.freeze([
    'search-ignore-discovery=disabled: rg ran with --no-ignore-parent --no-ignore-vcs because an ancestor of the search root is outside the effective read lane, so ancestor/VCS ignore discovery would leave the lane and the kernel would deny it',
    'search-ignore-semantics: .gitignore and .git/info/exclude are NOT applied (rg --no-ignore-vcs) and parent ignore files are NOT read (--no-ignore-parent); files they would ignore under this search root ARE searched. .git was not read',
]);
const unchangedSearchArgv = (argv) => Object.freeze({
    argv: Object.freeze([...argv]),
    addedFlags: Object.freeze([]),
    annotations: Object.freeze([]),
    annotatedRoots: Object.freeze([]),
});
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
async function ancestorsStayInLane(root, readLane, resolver, deps) {
    if (!deps.isDirectory(root))
        return true;
    let dir = root;
    for (;;) {
        const decision = await evaluateLocatorAccess({ lane: readLane, locator: dir, access: 'read', resolver });
        if (decision.decision !== 'allow')
            return false;
        const git = join(dir, '.git');
        if (deps.exists(git)) {
            const gitDecision = await evaluateLocatorAccess({ lane: readLane, locator: git, access: 'read', resolver });
            return gitDecision.decision === 'allow';
        }
        const parent = dirname(dir);
        // Reaching `/` through an allowed path means there is no ancestor left to
        // read; `/.git` was just checked.
        if (parent === dir)
            return true;
        dir = parent;
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
export async function laneSafeSearchArgv(spec, readLane, resolver = NODE_PATH_IDENTITY_RESOLVER, deps = {}) {
    const program = spec.argv[0];
    if (typeof program !== 'string' || basename(program).toLowerCase() !== 'rg')
        return unchangedSearchArgv(spec.argv);
    if (readLane.mode === 'all')
        return unchangedSearchArgv(spec.argv);
    const separator = spec.argv.indexOf('--');
    const flags = spec.argv.slice(1, separator === -1 ? spec.argv.length : separator);
    // `--no-ignore` disables ALL ignore files (and, measured, the `.git` walk),
    // so the shipped glob argv needs nothing added.
    if (flags.includes('--no-ignore'))
        return unchangedSearchArgv(spec.argv);
    const missing = SEARCH_IGNORE_DISCOVERY_FLAGS.filter((flag) => !flags.includes(flag));
    if (missing.length === 0)
        return unchangedSearchArgv(spec.argv);
    const exists = deps.exists ?? existsSync;
    const isDirectory = deps.isDirectory ?? ((path) => {
        try {
            return statSync(path).isDirectory();
        }
        catch {
            return false;
        }
    });
    const roots = readIntentsOf({ argv: spec.argv, cwd: spec.cwd }, { exists });
    const outside = [];
    for (const root of roots) {
        if (await ancestorsStayInLane(root, readLane, resolver, { exists, isDirectory }))
            continue;
        outside.push(root);
    }
    if (outside.length === 0)
        return unchangedSearchArgv(spec.argv);
    // Insert AFTER `--no-config` when it is the first argument (the admitted
    // shape), otherwise immediately before the first `--`. Both positions keep
    // the flags out of the operand list.
    const insertAt = spec.argv[1] === '--no-config'
        ? 2
        : (separator === -1 ? spec.argv.length : separator);
    const argv = [
        ...spec.argv.slice(0, insertAt),
        ...missing,
        ...spec.argv.slice(insertAt),
    ];
    return Object.freeze({
        argv: Object.freeze(argv),
        addedFlags: Object.freeze(missing),
        annotations: SEARCH_IGNORE_DISCOVERY_NOTES,
        annotatedRoots: Object.freeze(outside),
    });
}
/**
 * Build the admission function for one Member's subprocess face. It is the
 * SAME `FsGuard` shape the confined `fs` Provider uses, so one
 * `observeGuard` wrapper serves both and no second decision vocabulary exists:
 * the read lane decides, and the refusal is the existing `IO_READ_DENIED` /
 * `IO_POLICY_UNSUPPORTED` / `IO_ASK_REQUIRES_APPROVAL` (the `ask` lane has no
 * approval consumer here either — A5-DUAL-PLANE-01).
 */
export function createMemberSubprocessGuard(policy, resolver = NODE_PATH_IDENTITY_RESOLVER) {
    return async function subprocessGuard(method, hostPath) {
        const lane = policy.read;
        const decision = await evaluateLocatorAccess({ lane, locator: hostPath, access: 'read', resolver });
        if (decision.decision !== 'allow') {
            throw new TeamIoDenial(decision.decision === 'deny'
                ? 'IO_READ_DENIED'
                : decision.decision === 'ask' ? 'IO_ASK_REQUIRES_APPROVAL' : 'IO_POLICY_UNSUPPORTED', decision.detail, { memberIdentity: policy.memberIdentity, method, target: hostPath });
        }
    };
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
function systemRuntimeAllowPaths() {
    const rx = (path) => ({ path, accessBits: { execute: true, readFile: true, readDir: true } });
    const entries = [rx('/bin'), rx('/usr'), rx('/lib')];
    if (existsSync('/lib64'))
        entries.push(rx('/lib64'));
    return entries;
}
/**
 * Merge the compiled profile with the runtime allowance (lane wins on overlap).
 *
 * Exported so an OS-layer arm can build the SAME request the product builds
 * WITHOUT re-deriving the allowance in the test (a test-local copy could drift
 * from the shipped one). It is a construction helper, not a policy decision.
 */
export function confinedSpawnAllowPaths(profile, program, extra = []) {
    const byPath = new Map();
    for (const entry of [...systemRuntimeAllowPaths(), ...extra])
        byPath.set(entry.path, entry);
    for (const entry of profile) {
        const prior = byPath.get(entry.path);
        byPath.set(entry.path, prior === undefined ? entry : { path: entry.path, accessBits: { ...prior.accessBits, ...entry.accessBits } });
    }
    const programDir = dirname(program);
    const priorProgram = byPath.get(programDir);
    byPath.set(programDir, priorProgram === undefined
        ? { path: programDir, accessBits: { execute: true, readFile: true, readDir: true } }
        : { path: programDir, accessBits: { execute: true, readFile: true, readDir: true, ...priorProgram.accessBits } });
    return [...byPath.values()];
}
// ---------------------------------------------------------------------------
// The env law (the published scrub, implemented locally)
// ---------------------------------------------------------------------------
const SENSITIVE_ENV_PATTERN = /KEY|PASSWORD|SECRET|TOKEN/i;
/**
 * The child environment: the ambient parent environment minus credential-shaped
 * names and minus every `DSH_*` name, then the spec's explicit entries (a
 * string is a deliberate opt-in; `undefined` is a tombstone). This mirrors the
 * native provider's documented scrub — implemented here because the Team lane
 * has no dependency on the upstream subprocess package (lockfile untouched).
 */
export function confinedChildEnvironment(overrides) {
    const env = {};
    for (const [key, value] of Object.entries(ambientProcess().env ?? {})) {
        if (value === undefined)
            continue;
        if (SENSITIVE_ENV_PATTERN.test(key) || key.toUpperCase().startsWith('DSH_'))
            continue;
        env[key] = value;
    }
    for (const [key, value] of Object.entries(overrides ?? {})) {
        if (value === undefined)
            Reflect.deleteProperty(env, key);
        else
            env[key] = value;
    }
    return env;
}
/** The ambient process face as this lane can rely on it (see node-min.d.ts). */
function ambientProcess() {
    return globalThis.process ?? {};
}
function envPairs(env) {
    return Object.entries(env).map(([key, value]) => [key, value]);
}
/** The closed refusal vocabulary of THIS provider (never a bare `Error`). */
export const CONFINED_SUBPROCESS_REFUSAL_CODES = [
    'SUBPROCESS_PROGRAM_NOT_ABSOLUTE',
    'SUBPROCESS_STDIO_UNSUPPORTED',
    'SUBPROCESS_PROFILE_REFUSED',
    'SUBPROCESS_PROVIDER_REFUSED',
    'SUBPROCESS_TERMINAL_UNSUPPORTED',
    'SUBPROCESS_EXIT_UNRECORDABLE',
];
/** A typed refusal from the confined subprocess face. */
export class ConfinedSubprocessRefusal extends Error {
    code;
    detail;
    constructor(code, detail) {
        super(`${code}: ${detail}`);
        this.name = 'ConfinedSubprocessRefusal';
        this.code = code;
        this.detail = detail;
    }
}
/** Map a negative waitpid status to the signal NAME the native outcome uses. */
function signalNameOf(signalNumber) {
    const table = osConstants.signals;
    for (const [name, number] of Object.entries(table)) {
        if (number === signalNumber)
            return name;
    }
    return `SIG${String(signalNumber)}`;
}
function isCollectMode(mode) {
    return typeof mode === 'object' && mode !== null;
}
/** Refuse the stdio shapes this provider cannot honour (fail closed). */
function assertStdio(spec) {
    if (spec.stdio === undefined || spec.stdio === null || typeof spec.stdio !== 'object') {
        throw new ConfinedSubprocessRefusal('SUBPROCESS_STDIO_UNSUPPORTED', 'every stream disposition must be explicit');
    }
    if (spec.stdio.control !== undefined) {
        throw new ConfinedSubprocessRefusal('SUBPROCESS_STDIO_UNSUPPORTED', 'a control channel is not available on the confined face (fd 3 is the launcher handshake, not a caller channel)');
    }
    for (const [stream, mode] of [['stdout', spec.stdio.stdout], ['stderr', spec.stdio.stderr]]) {
        if (mode === 'inherit') {
            throw new ConfinedSubprocessRefusal('SUBPROCESS_STDIO_UNSUPPORTED', `${stream}: 'inherit' cannot be honoured — the confined launcher owns fd 1/2 and never passes them to the harness`);
        }
        if (isCollectMode(mode)) {
            if (!Number.isFinite(mode.maxBytes) || mode.maxBytes < 1) {
                throw new ConfinedSubprocessRefusal('SUBPROCESS_STDIO_UNSUPPORTED', `${stream}: maxBytes must be a positive finite number`);
            }
            if (mode.spill !== undefined) {
                throw new ConfinedSubprocessRefusal('SUBPROCESS_STDIO_UNSUPPORTED', `${stream}: a spill file is not produced by this provider; refusing instead of silently returning a lossy tail with no recovery path`);
            }
        }
    }
    const stdin = spec.stdio.stdin;
    if (stdin !== 'ignore' && stdin !== 'pipe' && !(typeof stdin === 'object' && stdin !== null && typeof stdin.data === 'string')) {
        throw new ConfinedSubprocessRefusal('SUBPROCESS_STDIO_UNSUPPORTED', 'stdin must be \'ignore\', \'pipe\' or { data }');
    }
}
function assertSpawnSpec(spec) {
    if (spec === null || typeof spec !== 'object')
        throw new ConfinedSubprocessRefusal('SUBPROCESS_PROGRAM_NOT_ABSOLUTE', 'a spawn spec is required');
    const [program] = Array.isArray(spec.argv) ? spec.argv : [];
    if (typeof program !== 'string' || program.length === 0) {
        throw new ConfinedSubprocessRefusal('SUBPROCESS_PROGRAM_NOT_ABSOLUTE', 'argv must be a non-empty array whose [0] is the program');
    }
    if (!isAbsolute(program)) {
        // The runtime allowance is granted on the program's OWN directory, so the
        // program must name that directory unambiguously. A bare PATH name would
        // make the grant a PATH-wide one — refused instead of widened.
        throw new ConfinedSubprocessRefusal('SUBPROCESS_PROGRAM_NOT_ABSOLUTE', `argv[0] must be an absolute executable path; ${JSON.stringify(program)} would make the executable allowance a PATH-wide grant`);
    }
    if (typeof spec.cwd !== 'string' || !isAbsolute(spec.cwd)) {
        throw new ConfinedSubprocessRefusal('SUBPROCESS_PROFILE_REFUSED', 'cwd must be an absolute directory');
    }
    if (!Number.isFinite(spec.graceMs) || spec.graceMs <= 0) {
        throw new ConfinedSubprocessRefusal('SUBPROCESS_PROFILE_REFUSED', 'graceMs must be a positive finite number');
    }
    assertStdio(spec);
}
function waitForStreamEnd(stream, boundMs) {
    if (stream.readableEnded || stream.destroyed)
        return Promise.resolve();
    return new Promise((resolve) => {
        let settled = false;
        const finish = () => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            stream.off('end', finish);
            stream.off('close', finish);
            stream.off('error', finish);
            resolve();
        };
        const timer = setTimeout(finish, boundMs);
        stream.once('end', finish);
        stream.once('close', finish);
        stream.once('error', finish);
    });
}
/**
 * Create the confined `subprocess` Provider class for one Member: the live
 * Provider class is the service identity, and `spawn` is REPLACED by the
 * confined path (there is no bare-spawn fallback to inherit).
 */
/** Monotonic per-process spawn counter (grant identity, never a decision). */
let spawnSequence = 0;
export function createConfinedSubprocessClass(Base, options) {
    const { effective, provider } = options;
    if (effective === undefined || effective === null) {
        throw new TypeError('createConfinedSubprocessClass needs the compiled EffectiveIo policy');
    }
    if (provider === undefined || provider === null || typeof provider.spawnStreaming !== 'function') {
        throw new TypeError('createConfinedSubprocessClass needs the OS-confined process provider');
    }
    // The profile is compiled ONCE per realm. A refusal is REMEMBERED and turns
    // every spawn into a typed refusal — never into an unconfined run, and never
    // into an install-time failure that would take the Member's `fs` lane down.
    const profile = compileExecutionProfile(effective);
    const laneGuard = options.guard ?? createMemberSubprocessGuard(effective);
    // The attribution refusal is a DECISION of this face, not a lane lookup, but
    // it must travel through the SAME observed guard so it is recorded as one
    // fact with the same schema. The queue is consumed synchronously by the
    // guard call below (spawn runs to that first `await` before returning), so a
    // concurrent spawn can never pick up another spawn's refusal.
    const pendingAttribution = [];
    const admissionGuard = async (method, hostPath) => {
        const at = pendingAttribution.findIndex((refusal) => refusal.target === hostPath);
        if (at !== -1) {
            const [refusal] = pendingAttribution.splice(at, 1);
            if (refusal === undefined)
                throw new TypeError('subprocess admission: attribution queue lost its head');
            throw new TeamIoDenial(refusal.code, refusal.detail, {
                memberIdentity: effective.memberIdentity,
                method,
                target: hostPath,
            });
        }
        await laneGuard(method, hostPath);
    };
    const guard = options.onGuardConsult === undefined
        ? admissionGuard
        : observeGuard(admissionGuard, options.onGuardConsult, {
            realm: options.realm ?? 'member',
            memberIdentity: effective.memberIdentity,
            toolBindingIdentity: options.toolBindingIdentity ?? null,
            policyRevision: effective.policyRevision,
        });
    class ConfinedSubprocess extends Base {
        spawn(spec) {
            assertSpawnSpec(spec);
            if (!profile.ok) {
                throw new ConfinedSubprocessRefusal('SUBPROCESS_PROFILE_REFUSED', `the effective policy cannot be expressed as an OS profile (${profile.code}: ${profile.detail}); refusing instead of spawning an unconfined child`);
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
            const attribution = programAttributionRefusal(spec);
            const intents = attribution === undefined ? readIntentsOf(spec) : Object.freeze([]);
            const started = (async () => {
                // B3 (review round 3): the name allow-list cannot tell a shipped `rg`
                // from a Member-writable script that happens to be named `rg`. A
                // program whose realpath is inside the effective WRITE lane is refused
                // through the SAME guard/evaluator, before any provider call.
                const refusal = attribution ?? await programWriteLaneRefusal(spec.argv[0], effective.write);
                if (refusal !== undefined) {
                    pendingAttribution.push(refusal);
                    await guard(SUBPROCESS_GUARD_METHOD, refusal.target);
                    // The guard rethrows the typed denial above; this line is defence
                    // against an admission invariant breaking silently.
                    throw new TeamIoDenial(refusal.code, refusal.detail, {
                        memberIdentity: effective.memberIdentity,
                        method: SUBPROCESS_GUARD_METHOD,
                        target: refusal.target,
                    });
                }
                // BL-16 live row 1: a confined `rg` whose search root sits inside a
                // git worktree used to walk ABOVE the lane for VCS/ancestor ignore
                // discovery, read the lane-denied `.git`, and treat that kernel refusal
                // as fatal (exit 2) even though the answer was on stdout. The lane is
                // NOT widened: the INVOCATION is made self-contained (or, for a root
                // whose discovery already stays in the lane, left exactly as shipped).
                // The rewrite is disclosed on the allow fact, never as an extra fact.
                const searchArgv = attribution === undefined
                    ? await laneSafeSearchArgv(spec, effective.read)
                    : unchangedSearchArgv(spec.argv);
                for (const intent of intents) {
                    const annotations = searchArgv.annotatedRoots.includes(intent) && searchArgv.annotations.length > 0
                        ? searchArgv.annotations
                        : undefined;
                    await guard(SUBPROCESS_GUARD_METHOD, intent, annotations);
                }
                const allowPaths = confinedSpawnAllowPaths(profile.value.allowPaths, spec.argv[0], options.runtimeAllowPaths ?? []);
                const request = {
                    grantFingerprint: `bl16:${options.realmId ?? effective.memberIdentity}:${effective.policyRevision}:${String(Date.now())}:${String(++spawnSequence)}`,
                    realmId: options.realmId ?? effective.memberIdentity,
                    bindingId: options.bindingId ?? (effective.toolBindingIdentity ?? 'member'),
                    memberScope: options.memberScope ?? effective.memberIdentity,
                    argv: [...searchArgv.argv],
                    cwd: resolvePath(spec.cwd),
                    env: envPairs({ ...confinedChildEnvironment(spec.env), ...options.env }),
                    allowPaths,
                    // The payload's OWN completion state MUST reach the handle: `grep`
                    // distinguishes exit 0 (matches) from 1 (no matches) and treats 2+
                    // as a search failure. The B2 passthrough is this lane's only user
                    // of that additive arm, and it changes no rule.
                    exitPassthrough: true,
                };
                const spawned = await provider.spawnStreaming(request, { graceMs: spec.graceMs });
                if (!spawned.ok) {
                    throw new ConfinedSubprocessRefusal('SUBPROCESS_PROVIDER_REFUSED', `the confined provider refused the spawn (${spawned.error.code}: ${spawned.error.message})`);
                }
                return spawned.value;
            })();
            // A refused admission must not become an unhandled rejection when the
            // caller only observes `done`; the rejection is still delivered there.
            started.catch(() => undefined);
            const readers = {};
            const collectFrom = (mode, live) => {
                if (!isCollectMode(mode))
                    return undefined;
                const reader = createConfinedOutputReader(mode.maxBytes);
                live.on('data', (chunk) => {
                    reader.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                });
                return reader;
            };
            let terminated = false;
            let live;
            let stdinForCaller;
            let stdoutForCaller;
            let stderrForCaller;
            let abortListener;
            started.then((handle) => {
                live = handle;
                readers.stdout = collectFrom(spec.stdio.stdout, handle.stdout);
                readers.stderr = collectFrom(spec.stdio.stderr, handle.stderr);
                stdoutForCaller = spec.stdio.stdout === 'pipe' ? handle.stdout : undefined;
                stderrForCaller = spec.stdio.stderr === 'pipe' ? handle.stderr : undefined;
                if (spec.stdio.stdin === 'pipe') {
                    stdinForCaller = handle.stdin;
                }
                else if (spec.stdio.stdin === 'ignore') {
                    handle.stdin.end();
                }
                else {
                    handle.stdin.end(spec.stdio.stdin.data);
                }
                if (terminated)
                    void handle.terminate({ graceMs: spec.graceMs }).catch(() => undefined);
                if (spec.signal !== undefined) {
                    abortListener = () => {
                        terminated = true;
                        void handle.terminate({ graceMs: spec.graceMs }).catch(() => undefined);
                    };
                    if (spec.signal.aborted)
                        abortListener();
                    else
                        spec.signal.addEventListener('abort', abortListener, { once: true });
                }
            }, () => undefined);
            const done = (async () => {
                const handle = await started;
                const record = await handle.payloadExit;
                // Wait for the collected pipes to drain BEFORE reporting the outcome:
                // a caller that reads `collected.stdout` right after `done` must see
                // every byte the child wrote (the native seam's pipe-drain law).
                await Promise.all([
                    spec.stdio.stdin === 'pipe' ? Promise.resolve() : waitForStreamEnd(handle.stdout, spec.graceMs),
                    waitForStreamEnd(handle.stderr, spec.graceMs),
                ]);
                if (abortListener !== undefined && spec.signal !== undefined)
                    spec.signal.removeEventListener('abort', abortListener);
                if (record.form !== 'recorded') {
                    throw new ConfinedSubprocessRefusal('SUBPROCESS_EXIT_UNRECORDABLE', `the payload's exit state was not recorded (${record.form}); the confined arm never guesses a success code`);
                }
                if (record.rc >= 0)
                    return { exitCode: record.rc, signal: null };
                return { exitCode: null, signal: signalNameOf(-record.rc) };
            })();
            // The handle's rejection is the caller's to read; this keeps an
            // unobserved failure from becoming a process-level unhandled rejection.
            done.catch(() => undefined);
            return Object.freeze({
                get stdin() {
                    return stdinForCaller;
                },
                get stdout() {
                    return stdoutForCaller;
                },
                get stderr() {
                    return stderrForCaller;
                },
                collected: {
                    get stdout() {
                        return readers.stdout;
                    },
                    get stderr() {
                        return readers.stderr;
                    },
                },
                done,
                terminate() {
                    terminated = true;
                    if (live !== undefined)
                        void live.terminate({ graceMs: spec.graceMs }).catch(() => undefined);
                },
                async waitForExit(signal) {
                    if (signal?.aborted === true)
                        return false;
                    try {
                        await done;
                        return true;
                    }
                    catch {
                        return false;
                    }
                },
            });
        }
        /** This face owns no terminal: a PTY cannot be confined by the OS profile. */
        async spawnTerminal() {
            throw new ConfinedSubprocessRefusal('SUBPROCESS_TERMINAL_UNSUPPORTED', 'the confined subprocess face owns no terminal process (a PTY cannot ride the Landlock profile); use the Member terminal lane');
        }
    }
    return ConfinedSubprocess;
}
//# sourceMappingURL=subprocess.js.map