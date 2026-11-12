/**
 * Alpha.5 PD-13 — the confined TERMINAL face.
 *
 * WHY THIS EXISTS. The product debt register's PD-13 is the measured fact that
 * a Member's shell had **no read axis**: its `bash` was the preset's inherited
 * persistent PTY, the governed realm was never on the path, and a `cat` of a
 * file the compiled read lane denies returned the file's bytes with exit 0 and
 * ZERO guard facts. The confined `subprocess` face refuses that read on the
 * read axis (`IO_READ_DENIED`, 0 provider calls, 0 bytes) — the machinery
 * worked; it was simply not on the terminal path.
 *
 * WHAT THIS FACE IS. A `terminals` service, mounted on the SAME isolated Member
 * scope as the confined `fs`/`subprocess` faces, whose sessions execute each
 * command as a CONFINED CHILD of the confined `subprocess` face on that scope
 * (never a PTY: a PTY cannot ride the Landlock execution profile — see
 * `subprocess.ts#spawnTerminal`). Because the service answers the pinned
 * `terminals` shape (`spawn`/`startSend`/`read`/`signal`/`kill`/`list`), a
 * routed native shell module that injects `terminals` resolves THIS face
 * instead of the inherited host service.
 *
 * THE READ AXIS (the point of the face). Before a command runs, its body is
 * lexically attributed: every path-shaped token the command names (an absolute
 * path, or a token that already exists relative to the session cwd) is a
 * DECLARED READ and is consulted against the Member's effective read lane
 * through the SAME guard the `fs` face uses. A denied read therefore:
 *   - produces exactly ONE guard-consult fact (`method: 'shellRead'`,
 *     `decision: 'deny'`, `decidedBy: 'IO_READ_DENIED'`) naming the locator;
 *   - returns ZERO bytes (the command never runs);
 *   - fails with the typed `TeamIoDenied` code `IO_READ_DENIED` on the send's
 *     `done` promise (the caller sees a typed refusal, not an empty success).
 * The admission runs BEFORE the confined `subprocess` face is called, so the
 * provider is called zero times for a denied command.
 *
 * WHAT THIS FACE DOES NOT DO (stated so the fix cannot be read as more):
 *   - it is not an OS-level claim. A command that IS admitted runs under the
 *     confined `subprocess` face's execution profile; the kernel is the
 *     boundary for everything the admission did not name;
 *   - a DYNAMIC read (`$(...)`, backticks, a path assembled from variables) is
 *     not lexically attributable and is NOT refused at admission. That is a
 *     disclosed weakness (see the evidence README) and the reason the OS
 *     profile stays load-bearing;
 *   - the body's WRITE axis is not lexically attributed here: a redirection
 *     target is deliberately not a read intent, so the read axis is the only
 *     axis this face adds;
 *   - there is no persistent shell STATE: every command is a fresh confined
 *     child, so `cd`/`export` do not carry across commands and there is no
 *     interactive stdin. That is the capability cost of a governed terminal on
 *     a host whose PTY cannot be confined (disclosed, not hidden).
 *
 * CORE PATCH BUDGET = 0: this is our package's module, mounted through the
 * existing public seam. No upstream source is touched.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * RETIRED FROM THE PRODUCT PATH (NATIVE-BASH-PRESERVATION, 2026-11-11).
 * This face is a per-command confined child, NOT a PTY: `cd`/`export` cannot
 * survive a call, so serving the model-visible `bash` through it required a
 * Team-authored ToolDefinition — the shape A5-NATIVE-01/02 forbid. The shipped
 * composition now declares `terminal: { mode: 'pty' }` and `install.ts` mounts
 * `terminal-pty.ts` instead; this face stays for compositions that still
 * declare it and for its own contract suites.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * @module @dsh-agent-team/runtime/team-services/terminal
 */
import type { EffectiveIoPolicy } from '../../member-io-policy/src/types.js';
import type { FsGuard } from './fs.js';
import type { ConfinedShellClassAdmission } from './subprocess.js';
/** The guard method this face consults its lane under (the fact's `method`). */
export declare const TERMINAL_GUARD_METHOD = "shellRead";
/** The backend types this face answers (the preset's `shell` alias included). */
export declare const CONFINED_TERMINAL_BACKENDS: readonly string[];
/** The closed refusal vocabulary of THIS face (never a bare `Error`). */
export declare const CONFINED_TERMINAL_REFUSAL_CODES: readonly ["TERMINALS_OWNER_UNTRUSTED", "TERMINALS_NO_BACKEND", "TERMINALS_NO_SESSION", "TERMINALS_FOREIGN_SESSION", "TERMINALS_SESSION_CLOSED", "TERMINALS_SEND_ACTIVE", "TERMINALS_CWD_UNRESOLVED", "TERMINALS_PROGRAM_NOT_ADMITTED", "TERMINALS_COMMAND_CANCELLED"];
export type ConfinedTerminalRefusalCode = (typeof CONFINED_TERMINAL_REFUSAL_CODES)[number];
/** A typed refusal from the confined terminal face. */
export declare class ConfinedTerminalRefusal extends Error {
    readonly code: ConfinedTerminalRefusalCode;
    readonly detail: string;
    constructor(code: ConfinedTerminalRefusalCode, detail: string);
}
/** The status shape the pinned terminal contract reports. */
export type ConfinedTerminalStatus = {
    readonly kind: 'running';
} | {
    readonly kind: 'exited';
    readonly exitCode: number | null;
    readonly signal: string | null;
};
/** One owner-visible session snapshot (the pinned `list`/`spawn` answer). */
export interface ConfinedTerminalSnapshot {
    readonly sessionId: string;
    readonly type: string;
    readonly pid?: number;
    readonly status: ConfinedTerminalStatus;
    readonly motd?: string;
}
/** What a caller asks the face to run. */
export interface ConfinedTerminalSendRequest {
    readonly text: string;
    readonly signal?: AbortSignal | undefined;
}
/** The additive exit information this face reports on a settled send. */
export interface ConfinedTerminalSendOutcome {
    readonly viewport: string;
    readonly waitReason: 'inferred_idle';
    readonly sessionStatus: ConfinedTerminalStatus;
    readonly truncated: boolean;
    /** ADDITIVE (this face): the confined child's exit code (`null` on a signal). */
    readonly exitCode: number | null;
    /** ADDITIVE (this face): the terminating signal name, if any. */
    readonly signal: string | null;
    /** Whether the caller's `cancel()` terminated the command. */
    readonly cancelled: boolean;
    /** ADDITIVE (this face): the confined child's stdout (bounded). */
    readonly stdout: string;
    /** ADDITIVE (this face): the confined child's stderr (bounded). */
    readonly stderr: string;
}
/** The operation handle `startSend` returns (pinned contract + additive fields). */
export interface ConfinedTerminalOperation {
    readonly done: Promise<ConfinedTerminalSendOutcome>;
    readOutput(): {
        readonly delta: string;
        readonly truncated: boolean;
    };
    cancel(): boolean;
}
/** The `terminals` service surface this face provides (structural). */
export interface ConfinedTerminalSurface {
    listBackends(): readonly string[];
    spawn(owner: unknown, request: {
        readonly type?: string;
        readonly cwd?: string;
        readonly name?: string;
    }, signal?: AbortSignal): Promise<ConfinedTerminalSnapshot>;
    startSend(owner: unknown, sessionId: string, request: ConfinedTerminalSendRequest): ConfinedTerminalOperation;
    read(owner: unknown, sessionId: string, request?: {
        readonly offset?: number;
        readonly lines?: number;
    }): {
        readonly text: string;
        readonly totalLines: number;
        readonly lineBegin: number;
        readonly lineEnd: number;
        readonly truncated: boolean;
    };
    signal(owner: unknown, sessionId: string, signal: string): Promise<{
        readonly delivered: boolean;
        readonly targetPgid: number | null;
    }>;
    kill(owner: unknown, sessionId: string, reason?: string): Promise<boolean>;
    list(owner: unknown): readonly ConfinedTerminalSnapshot[];
    /** Teardown of every session this face owns (the mount's disposal path). */
    disposeAll(): Promise<void>;
}
/**
 * The confined process surface this face executes through — a structural
 * subset of the confined `subprocess` service mounted on the SAME Member
 * scope. The face never resolves that service itself: the install passes the
 * surface it just mounted, so a "missing face" becomes an install-time refusal
 * instead of a late, silent inheritance.
 */
export interface ConfinedTerminalProcessSurface {
    spawn(spec: {
        readonly argv: readonly string[];
        readonly cwd: string;
        readonly stdio: {
            readonly stdin: 'ignore';
            readonly stdout: {
                readonly maxBytes: number;
            };
            readonly stderr: {
                readonly maxBytes: number;
            };
        };
        readonly graceMs: number;
        readonly signal?: AbortSignal | undefined;
        readonly shell: {
            readonly program: string;
            readonly reads: readonly string[];
            readonly writes: readonly string[];
        };
    }): {
        readonly collected: {
            readonly stdout?: {
                readFrom(fromByte: number): {
                    readonly text: string;
                };
            } | undefined;
            readonly stderr?: {
                readFrom(fromByte: number): {
                    readonly text: string;
                };
            } | undefined;
        };
        readonly done: Promise<{
            readonly exitCode: number | null;
            readonly signal: string | null;
        }>;
        terminate(): void;
    };
}
/** What the install hands the face. */
export interface ConfinedTerminalFaceOptions {
    readonly effective: EffectiveIoPolicy;
    /** The admitted shell program (absolute; the realm's declared shell class covers it). */
    readonly program: string;
    /** The realm's declared shell class — the composition's, never the Member's. */
    readonly shellClass: ConfinedShellClassAdmission;
    /** The SAME observed guard the confined `fs` face consults. */
    readonly guard: FsGuard;
    /** The confined process surface mounted on this realm (never the base service). */
    readonly subprocess: ConfinedTerminalProcessSurface;
    readonly maxOutputBytes?: number;
    readonly graceMs?: number;
    readonly motd?: string;
}
/**
 * Tokenise a command body WITHOUT executing it: quotes are honoured (a quoted
 * path with spaces stays one token), backslash escapes the next character, and
 * unquoted control operators end a token. Redirect operators are reported so
 * their target can be skipped (a redirection target is a WRITE, not a read).
 *
 * @param {string} command - the command body.
 * @returns {readonly { token: string, redirect: boolean }[]} in source order.
 */
export declare function tokenizeShellCommand(command: string): readonly {
    readonly token: string;
    readonly redirect: boolean;
}[];
/**
 * The DECLARED read intents of one command body.
 *
 * The rule is deliberately narrow and auditable, and it fails toward REFUSAL,
 * never toward a silent allow:
 *   - a token is a read intent when it is an absolute path, or when it already
 *     exists relative to the session cwd (the same "operand, not a pattern"
 *     rule `readIntentsOf` applies to argv tokens);
 *   - a token that is a redirection TARGET is a write, not a read, and is
 *     skipped (a shell's `> /dev/null` is not a read of `/dev/null`);
 *   - a token that is dynamic (`$…`, a backtick, `$(…)`) is NOT attributable
 *     and is skipped — the disclosed dynamic-read weakness. The command still
 *     runs under the confined process face's OS profile.
 *
 * @param {string} command - the command body.
 * @param {string} cwd - the session's absolute working directory.
 * @param {{ exists?: (path: string) => boolean }} [deps] - existence probe (tests).
 * @returns {readonly string[]} resolved read intents, de-duplicated, in order.
 */
export declare function shellReadIntentsOf(command: string, cwd: string, deps?: {
    readonly exists?: (path: string) => boolean;
}): readonly string[];
/**
 * Create the confined terminal face: a Cordis plugin providing the `terminals`
 * service on the context it is mounted on (the Member's isolated scope).
 *
 * @param {ConfinedTerminalFaceOptions} options - the realm's compiled lane, the
 *   admitted program, the realm's shell class, the SAME observed guard the
 *   confined `fs` face uses, and the confined process surface to execute on.
 * @returns {object} the plugin object `mount` passes to `ctx.plugin`.
 */
export declare function createConfinedTerminalFace(options: ConfinedTerminalFaceOptions): {
    readonly name: string;
    apply(ctx: unknown): void;
};
//# sourceMappingURL=terminal.d.ts.map