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
import { isAbsolute, resolve as resolvePath } from 'node:path';
import { TerminalSessionService } from '@deepseek-ai/dsh-terminal';
import { Config as BashTerminalConfig, apply as applyBashTerminalBackend } from '@deepseek-ai/dsh-terminal-bash';
/** The closed refusal vocabulary of THIS face (never a bare `Error`). */
export const PTY_FACE_REFUSAL_CODES = [
    /** The caller presented no owner session identity at all. */
    'PTY_OWNER_UNBOUND',
    /** The owner session is not the ONE Member this face was installed for. */
    'PTY_OWNER_MISMATCH',
    /** No compiled ceiling was supplied for the bound Member. */
    'PTY_CEILING_UNAVAILABLE',
    /** The compiled ceiling's revision is not the one this face installed. */
    'PTY_CEILING_STALE',
    /** The session was opened under a policy revision that is no longer current. */
    'PTY_POLICY_STALE',
    /** The lane cannot be expressed as one OS write root (no writable root). */
    'PTY_WRITE_ROOT_UNAVAILABLE',
    /** No `sandbox` provider exists, so no enforcement can be claimed. */
    'ENFORCEMENT_UNAVAILABLE',
    /** The pinned PTY backend refused to register or the service is not live. */
    'PTY_BACKEND_UNAVAILABLE',
];
/** The typed refusal this face raises. Carries the code a consumer compares. */
export class PtyFaceRefusal extends Error {
    code;
    constructor(code, detail) {
        super(`${code}: ${detail}`);
        this.name = 'PtyFaceRefusal';
        this.code = code;
    }
}
/**
 * The total ordering of the three modes. Declared as a LITERAL object (not a
 * `Record`): with `noUncheckedIndexedAccess` an index signature makes every
 * lookup `number | undefined`, and the clamp below compares two lookups
 * (`TS2532`). A literal type has all three keys, so a lookup is `0 | 1 | 2`.
 */
const MODE_RANK = Object.freeze({
    'read-only': 0,
    'workspace-write': 1,
    'danger-full-access': 2,
});
/** True when `child` is `parent` or lives under it (path-segment exact). */
function containsPath(parent, child) {
    if (parent === child)
        return true;
    const base = parent.endsWith('/') ? parent : `${parent}/`;
    return child.startsWith(base);
}
/** Replace a path rule set's effect with its roots (locators survive verbatim). */
function absoluteRoots(locators) {
    const roots = [];
    for (const locator of locators) {
        if (typeof locator !== 'string')
            continue;
        // A locator that is not an absolute path names no OS write root; a relative
        // one is relative to the workspace and is NOT silently rebased here.
        if (!isAbsolute(locator))
            continue;
        roots.push(resolvePath(locator));
    }
    return roots;
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
export function narrowSandboxPolicy(base, effective) {
    const cwd = resolvePath(base.workspaceRoot);
    const ceilingRestricted = effective.write.mode === 'restricted';
    const declared = ceilingRestricted ? absoluteRoots(effective.write.allow) : [cwd];
    const denied = ceilingRestricted ? absoluteRoots(effective.write.deny) : [];
    const candidate = declared
        .filter((root) => containsPath(root, cwd))
        .filter((root) => !denied.some((deny) => containsPath(deny, root) || containsPath(root, deny)))
        .sort((a, b) => b.length - a.length)[0];
    // The ceiling can never lift the deployment mode: `danger-full-access` is
    // clamped, `read-only` stays read-only.
    const ceilingMode = candidate === undefined
        ? 'read-only'
        : (base.mode === 'read-only' ? 'read-only' : 'workspace-write');
    const mode = MODE_RANK[base.mode] <= MODE_RANK[ceilingMode] ? base.mode : ceilingMode;
    const policy = {
        mode,
        workspaceRoot: candidate ?? cwd,
        ...base.sessionId === undefined ? {} : { sessionId: base.sessionId },
    };
    return {
        policy,
        writeRoot: candidate ?? null,
        reason: candidate === undefined
            ? 'no-writable-root'
            : (ceilingRestricted ? 'ceiling-root' : 'unrestricted-ceiling'),
    };
}
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
export function createGovernedPtyTerminalFace(options) {
    if (options === undefined || options === null || typeof options !== 'object') {
        throw new TypeError('createGovernedPtyTerminalFace needs its options');
    }
    const { effective, memberIdentity, memberSessionId, policyRevision, program, backendType } = options;
    if (effective === undefined || effective === null || typeof effective.memberIdentity !== 'string') {
        throw new TypeError('createGovernedPtyTerminalFace needs the compiled EffectiveIo policy');
    }
    if (effective.memberIdentity !== memberIdentity) {
        throw new TypeError(`createGovernedPtyTerminalFace was handed a lane compiled for '${effective.memberIdentity}', not '${memberIdentity}'`);
    }
    if (typeof memberIdentity !== 'string' || memberIdentity.trim() === '') {
        throw new TypeError('createGovernedPtyTerminalFace needs a non-blank Member identity');
    }
    if (typeof policyRevision !== 'string' || policyRevision.trim() === '') {
        throw new TypeError('createGovernedPtyTerminalFace needs a non-blank policy revision');
    }
    if (typeof program !== 'string' || !isAbsolute(program)) {
        throw new TypeError('createGovernedPtyTerminalFace needs an ABSOLUTE shell program (the OS profile runs it)');
    }
    if (typeof backendType !== 'string' || backendType.trim() === '') {
        throw new TypeError('createGovernedPtyTerminalFace needs a non-blank backend type');
    }
    if (options.sandboxPolicy === undefined || typeof options.sandboxPolicy.resolve !== 'function') {
        throw new TypeError('createGovernedPtyTerminalFace needs the deployment sandbox policy service');
    }
    if (options.baseSubprocess === undefined || typeof options.baseSubprocess.spawnTerminal !== 'function') {
        throw new TypeError('createGovernedPtyTerminalFace needs the BASE subprocess service (a PTY cannot ride the confined child face)');
    }
    const currentRevision = typeof options.revisionNow === 'function' ? options.revisionNow : () => policyRevision;
    const domains = new Map();
    /** Every owner this face admitted; disposal kills their sessions. */
    const admitted = new Set();
    const ownerSessionIdOf = (owner) => {
        const id = owner?.id;
        return typeof id === 'string' ? id : '';
    };
    const expectBoundOwner = (owner) => {
        const sessionId = ownerSessionIdOf(owner);
        if (sessionId === '') {
            throw new PtyFaceRefusal('PTY_OWNER_UNBOUND', 'the caller presented no owner session identity (an owner with a non-empty `id` is required)');
        }
        if (typeof memberSessionId !== 'string' || memberSessionId === '') {
            throw new PtyFaceRefusal('PTY_OWNER_UNBOUND', `this governed PTY face has no bound Member session id for Member '${memberIdentity}'; a shell is never opened for an unbound owner`);
        }
        if (sessionId !== memberSessionId) {
            throw new PtyFaceRefusal('PTY_OWNER_MISMATCH', `owner session ${JSON.stringify(sessionId)} is not the Member session ${JSON.stringify(memberSessionId)} this PTY face is bound to`);
        }
        return sessionId;
    };
    const assertRevisionCurrent = () => {
        const now = currentRevision();
        if (now !== policyRevision) {
            throw new PtyFaceRefusal('PTY_CEILING_STALE', `this PTY face serves policy revision ${JSON.stringify(policyRevision)}, but the live revision is ${JSON.stringify(now)}; a fresh face is required`);
        }
        return now;
    };
    return {
        name: 'a5sf-governed-pty-terminals',
        apply(ctx) {
            // The raw registry lives on a NESTED isolate so the outer scope can
            // provide the governed surface under the same service name without a
            // double provide. Its sessions are this Member's alone.
            const inner = ctx.isolate('terminals', Symbol(`a5sf-pty-raw:${memberIdentity}`));
            const raw = new TerminalSessionService(inner);
            // The narrowed policy is what the pinned backend resolves per spawn.
            const narrowed = {
                defaultMode: options.sandboxPolicy.defaultMode,
                workspaceRoot: options.sandboxPolicy.workspaceRoot,
                resolve(request) {
                    const base = options.sandboxPolicy.resolve(request);
                    const result = narrowSandboxPolicy(base, effective);
                    if (result.writeRoot === null && base.mode !== 'read-only') {
                        // A live enforcement provider is REQUIRED for a writable policy. No
                        // provider = no claim: the pinned backend would throw a bare Error;
                        // this face refuses first, with a code a consumer can branch on.
                        if (options.sandboxProvider?.() === undefined) {
                            throw new PtyFaceRefusal('ENFORCEMENT_UNAVAILABLE', 'the Member lane needs a writable OS root, but this deployment mounts no `sandbox` provider; refusing instead of running the shell unconfined');
                        }
                    }
                    return result.policy;
                },
            };
            // The facade the pinned backend binds: its OWN service reads and the base
            // process surface. `get('sandbox')` is delegated so the pinned backend's
            // `sandbox.confine` uses the deployment provider, exactly as shipped.
            const backendCtx = {
                terminals: raw,
                sandboxPolicy: narrowed,
                sessionProjections: ctx.get('sessionProjections'),
                subprocess: options.baseSubprocess,
                get: (name) => (name === 'sandbox' ? options.sandboxProvider?.() : ctx.get(name)),
            };
            try {
                // The pinned module's OWN config schema fills every default (rows,
                // cols, timeouts); this face supplies only what is a policy/identity
                // decision. Calling `apply` directly bypasses the Loader's schema
                // resolution, so the same schema is applied here.
                const resolvedConfig = BashTerminalConfig({
                    ...options.backendConfig,
                    backendType,
                    shellDialect: 'bash',
                    shellPath: program,
                });
                applyBashTerminalBackend(backendCtx, resolvedConfig);
            }
            catch (error) {
                throw new PtyFaceRefusal('PTY_BACKEND_UNAVAILABLE', `the pinned terminal-bash backend refused to register on this realm: ${error instanceof Error ? error.message : String(error)}`);
            }
            const surface = {
                /**
                 * The ADOPTION MARKER. Route C selects the pinned native `bash`
                 * definition only for a face that carries it, so a PD-13-style confined
                 * (non-PTY) face can never be mistaken for this one.
                 */
                governedPty: Object.freeze({
                    memberIdentity,
                    memberSessionId: memberSessionId ?? null,
                    policyRevision,
                    backendType,
                    program,
                    writeRoot: 'per-spawn',
                }),
                registerBackend: (backend) => raw.registerBackend(backend),
                listBackends: () => raw.listBackends(),
                async spawn(owner, request, signal) {
                    expectBoundOwner(owner);
                    assertRevisionCurrent();
                    admitted.add(owner);
                    const result = await raw.spawn(owner, request, signal);
                    const base = options.sandboxPolicy.resolve({ session: owner?.session });
                    const { policy, writeRoot, reason } = narrowSandboxPolicy(base, effective);
                    domains.set(result.sessionId, {
                        policyRevision,
                        writeRoot: writeRoot ?? policy.workspaceRoot,
                        mode: policy.mode,
                        createdAt: Date.now(),
                    });
                    // The mode/root the PTY actually runs under rides the spawn result's
                    // own `motd`-adjacent path: nothing model-visible is added, the fact
                    // is recorded here for the receipt.
                    void reason;
                    return result;
                },
                hasOwnerActivity: (owner) => raw.hasOwnerActivity(owner),
                startSend(owner, id, request) {
                    expectBoundOwner(owner);
                    const domain = domains.get(id);
                    if (domain !== undefined && domain.policyRevision !== currentRevision()) {
                        // 旧代 PTY: kill the old permission domain and refuse the command.
                        domains.delete(id);
                        void raw.kill(owner, id, 'policy revision changed').catch(() => undefined);
                        throw new PtyFaceRefusal('PTY_POLICY_STALE', `PTY session ${JSON.stringify(id)} was opened under policy revision ${JSON.stringify(domain.policyRevision)}, which is no longer current; the session was terminated and the next call opens a fresh domain`);
                    }
                    return raw.startSend(owner, id, request);
                },
                read: (owner, id, request) => raw.read(owner, id, request),
                signal: (owner, id, signal) => raw.signal(owner, id, signal),
                async kill(owner, id, reason) {
                    domains.delete(id);
                    return await raw.kill(owner, id, reason);
                },
                list: (owner) => raw.list(owner),
                /** Teardown of every session this face opened (the realm's disposal path). */
                async disposeAll() {
                    domains.clear();
                    for (const agent of admitted) {
                        for (const snapshot of raw.list(agent)) {
                            await raw.kill(agent, snapshot.sessionId, 'governed PTY face disposed').catch(() => false);
                        }
                    }
                    admitted.clear();
                },
            };
            const host = ctx;
            if (typeof host.provide !== 'function') {
                throw new TypeError('the governed PTY terminal face needs a Cordis Context that can provide a service');
            }
            host.provide('terminals', surface);
            ctx.effect(() => () => surface.disposeAll(), 'a5sf governed PTY teardown');
        },
    };
}
//# sourceMappingURL=terminal-pty.js.map