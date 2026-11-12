/**
 * Alpha.5 NATIVE-PRESERVATION (2026-11-11) — the governed PERSISTENT PTY face.
 *
 * WHY THIS EXISTS. PD-13's confined terminal face (`terminal.ts`) is NOT a PTY:
 * every command is a fresh confined child, so `cd`/`export` do not survive a
 * call, and the product's `bash` had to be a Team-owned ToolDefinition that
 * re-implemented the model-visible tool. A5-NATIVE-01/02 forbid that. The
 * native path (`@deepseek-ai/dsh-tool-bash-persistent` → `ctx.terminals` →
 * `@deepseek-ai/dsh-terminal-bash` → a real `/dev/pts/N`) already exists and
 * already keeps state; what it lacks is a Member ceiling. This module supplies
 * exactly that missing half and nothing else:
 *
 *  - the ToolDefinition is untouched (this module registers no tool);
 *  - the PTY mechanics are untouched (it mounts the PINNED `terminal-bash`
 *    backend through its own public `apply`, and the pinned
 *    `TerminalSessionService`);
 *  - the ceiling enters where the pinned backend already reads it:
 *    `sandboxPolicy.resolve({ session })` → `sandbox.confine(argv, policy)`,
 *    the exact seam `DELTA-POC-AFTER-B2R.md` §0 measured (write inside the
 *    root succeeded, outside failed) and `A5SF-PTY-CONTRACT` pinned.
 *
 * WHAT IT ENFORCES AT EVERY CALL BOUNDARY:
 *  1. EXACT identity: the owner's session id must equal the Member session this
 *     face was installed for. No `includes`, no prefix, no label — a missing or
 *     different identity is a typed refusal BEFORE any PTY is created.
 *  2. The Member ceiling: the resolved `SandboxExecutionPolicy` is the member's
 *     write root, never wider. `danger-full-access` is clamped to at most
 *     `workspace-write`; a Member ceiling can narrow a session mode but never
 *     widen it (subset law).
 *  3. Policy generations: every session records the revision it was opened
 *     under; a send in a session whose revision is no longer current is a typed
 *     `PTY_POLICY_STALE` refusal and the session is killed, so no stale
 *     permission domain keeps working. Disposal kills every session this face
 *     opened.
 *  4. Fail closed: no ceiling, no writable root, no enforcement provider or no
 *     bound session identity is a typed refusal — never the inherited host PTY.
 *
 * WHAT IT DOES NOT DO (stated so the record cannot be read as more):
 *  - it claims no READ axis. The OS profile is the boundary for what a command
 *    reads; bwrap masks are not a complete read allowlist (IOAXIS finding,
 *    `DELTA-POC-AFTER-B2R.md` §4). Lexical read admission is PD-13's face and
 *    is NOT preserved on this path (a PTY cannot ride it);
 *  - it claims no network isolation beyond what the deployment's `sandbox`
 *    provider actually enforces;
 *  - it does not parse the command body; the argv it confines is the shell.
 *
 * CORE PATCH BUDGET = 0: the pinned host tree is imported, never modified.
 *
 * @module @dsh-agent-team/runtime/team-services/terminal-pty
 */
import type { Context } from '@deepseek-ai/cordis';
import type { PathRuleSet } from '../../member-io-policy/src/types.js';
/** The closed refusal vocabulary of THIS face (never a bare `Error`). */
export declare const PTY_FACE_REFUSAL_CODES: readonly ["PTY_OWNER_UNBOUND", "PTY_OWNER_MISMATCH", "PTY_CEILING_UNAVAILABLE", "PTY_CEILING_STALE", "PTY_POLICY_STALE", "PTY_WRITE_ROOT_UNAVAILABLE", "ENFORCEMENT_UNAVAILABLE", "PTY_BACKEND_UNAVAILABLE"];
export type PtyFaceRefusalCode = (typeof PTY_FACE_REFUSAL_CODES)[number];
/** The typed refusal this face raises. Carries the code a consumer compares. */
export declare class PtyFaceRefusal extends Error {
    readonly code: PtyFaceRefusalCode;
    constructor(code: PtyFaceRefusalCode, detail: string);
}
/**
 * STRUCTURAL MIRRORS of the pinned host's sandbox types.
 *
 * `team-services` does NOT depend on `@deepseek-ai/dsh-sandbox` /
 * `@deepseek-ai/dsh-sandbox-policy`: they are host packages the consumer
 * supplies at runtime, and they are not in this package's install graph (a
 * `import type` from them resolves in a developer worktree that happens to have
 * the host linked, and fails in a clean install — the CI `TS2307` this
 * replaced). The convention in this package is a structural subset with the
 * narrowest shape the face actually touches (`PtyBaseSubprocessSurface` below,
 * `sandboxPolicy as never` in `install.ts`): a policy VALUE crosses the boundary,
 * never a host type, so a mirror loses nothing and stays honest about the
 * contract. Keep these in sync with the pinned `SandboxExecutionPolicy` /
 * `SandboxPolicyRequest` (`0.2.0-rc.2 @ 639ed01539`); a wider host policy is
 * still assignable to them.
 */
export type PtySandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access';
export interface PtySandboxExecutionPolicy {
    readonly mode: PtySandboxMode;
    readonly workspaceRoot: string;
    readonly sessionId?: string;
}
export interface PtySandboxPolicyRequest {
    readonly session?: {
        readonly id?: string;
    };
}
/** The sandbox-policy service surface this face needs (a structural subset). */
export interface PtySandboxPolicyService {
    resolve(request: PtySandboxPolicyRequest): PtySandboxExecutionPolicy;
    readonly defaultMode: PtySandboxMode;
    readonly workspaceRoot: string;
}
/** The base subprocess surface the pinned PTY backend allocates the PTY on. */
export interface PtyBaseSubprocessSurface {
    spawnTerminal(spec: {
        readonly argv: readonly string[];
        readonly cwd: string;
        readonly env: Record<string, string>;
        readonly rows: number;
        readonly cols: number;
        readonly terminalType: string;
        readonly graceMs: number;
        readonly signal?: AbortSignal;
    }): Promise<unknown>;
}
/**
 * The ceiling a PTY domain is bound to. A shell is not a ToolBinding, so there
 * is no `ToolRestriction` term to intersect: the compiled Member ceiling IS the
 * lane (the same reading `a5sf-governed-realm.mjs` states for its shell face).
 */
export interface PtyCeilingLane {
    readonly memberIdentity: string;
    readonly read: PathRuleSet;
    readonly write: PathRuleSet;
}
/** What the install hands the face. Everything policy-shaped is COMPILED input. */
export interface GovernedPtyTerminalFaceOptions {
    /** The Member's compiled ceiling lane. */
    readonly effective: PtyCeilingLane;
    /** The MemberInstance id this PTY is bound to (audit identity). */
    readonly memberIdentity: string;
    /**
     * The EXACT agent session id this face serves. Child sessions, resumed
     * sessions and a sibling Member's session are all a mismatch, not a prefix
     * match. `undefined` means the composition never bound one → every spawn is
     * refused (fail closed).
     */
    readonly memberSessionId: string | undefined;
    /** The policy revision this face was installed for. */
    readonly policyRevision: string;
    /**
     * Reads the CURRENT revision at a call boundary. Omitted = the install
     * revision is treated as current for the face's lifetime (the realm is
     * rebuilt on every rebind, so that is the same fact).
     */
    readonly revisionNow?: () => string;
    /** The absolute shell program the PTY runs (never a PATH name). */
    readonly program: string;
    /** Registry type this face registers the PTY backend under. */
    readonly backendType: string;
    /** The deployment's sandbox policy service (the host's own). */
    readonly sandboxPolicy: PtySandboxPolicyService;
    /** The BASE subprocess service (a PTY cannot ride the confined child face). */
    readonly baseSubprocess: PtyBaseSubprocessSurface;
    /** Base `sandbox` provider lookup; `undefined` = no enforcement available. */
    readonly sandboxProvider?: () => {
        confine(argv: readonly string[], policy: PtySandboxExecutionPolicy, signal?: AbortSignal): Promise<{
            argv: readonly string[];
        }>;
    } | undefined;
    /** Extra pinned-backend config (rows/cols/timeouts); never policy. */
    readonly backendConfig?: Record<string, unknown>;
}
/**
 * Intersect the deployment's resolved policy with the Member ceiling.
 *
 * The result is the policy the pinned backend will hand to `sandbox.confine`.
 * It is ALWAYS a narrowing of `base`:
 *  - mode: `min(base.mode, ceiling.mode)`; the ceiling's mode is at most
 *    `workspace-write` (a realm never grants `danger-full-access`), and
 *    `read-only` stays `read-only`;
 *  - workspaceRoot: the DEEPEST declared ceiling write root that contains the
 *    session cwd, so the OS binding covers the shell's own directory. A cwd
 *    outside every declared root leaves no writable root → `read-only` (the
 *    shell still starts, it just cannot write).
 *
 * @param base - the deployment's resolved policy for this session.
 * @param effective - the Member's compiled lane.
 * @returns the narrowed policy the PTY backend must confine with.
 */
export declare function narrowSandboxPolicy(base: PtySandboxExecutionPolicy, effective: PtyCeilingLane): {
    policy: PtySandboxExecutionPolicy;
    writeRoot: string | null;
    reason: 'ceiling-root' | 'no-writable-root' | 'unrestricted-ceiling';
};
/**
 * Create the governed persistent-PTY `terminals` face for ONE Member.
 *
 * The returned plugin provides `terminals` on the Context it is mounted on and
 * is the ONLY `terminals` a routed native shell module in that scope resolves.
 * It never falls back to an inherited service: every refusal below is raised
 * before the raw service is asked to do anything.
 *
 * @param options - the compiled ceiling, the bound identities and the pinned seams.
 * @returns the Cordis plugin object the realm mounts on its isolated scope.
 */
export declare function createGovernedPtyTerminalFace(options: GovernedPtyTerminalFaceOptions): {
    readonly name: string;
    apply(ctx: Context): void;
};
//# sourceMappingURL=terminal-pty.d.ts.map