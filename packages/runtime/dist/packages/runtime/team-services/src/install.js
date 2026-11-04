/**
 * Alpha.5 P1-05 — install the per-Member Service realm.
 *
 * ONE root Context (the Host), N isolated `fs` scopes (one per Member). The
 * isolated scope is `root.isolate('fs', label)`: below it, reads and writes of
 * `ctx.fs` resolve against that Member's confined Provider, while the root's
 * provider and every other Member keep their own. The same tool name registered
 * in two Member scopes therefore resolves its OWN provider at call time — the
 * property that makes per-Member I/O governance real instead of cosmetic.
 *
 * INSTALL IS ALL-OR-NOTHING. Every Member's policy is validated and the live
 * Provider's managed surface is inspected BEFORE the first scope is created; a
 * refusal (uncompiled policy, duplicate identity, missing/incompatible
 * Provider, a mount that throws) disposes anything already mounted and rejects
 * with a typed {@link TeamServiceInstallError}. A partially installed realm
 * would run some tools against the host Provider, which is exactly the failure
 * mode this gate exists to prevent, so the Team refuses as a whole.
 *
 * NOT IN THIS MODULE: policy compilation (P1-02), invocation binding (P1-04),
 * web/subprocess providers (P1-06/P2), and any approval logic.
 *
 * @module @dsh-agent-team/runtime/team-services/install
 */
import { requireProviderCapabilities } from '../../member-io-policy/src/provider-capabilities.js';
import { createConfinedFileSystemClass, createMemberFsGuard, } from './fs.js';
import { createConfinedSubprocessClass, } from './subprocess.js';
import { observeGuard } from './guard-observability.js';
import { TeamServiceInstallError, } from './types.js';
/** Member id → installed, per root Context. Guards double installation. */
const INSTALLED = new WeakMap();
function assertSpec(spec) {
    const { identity, policy } = spec;
    if (!identity.teamId || !identity.memberInstanceId || !identity.templateId) {
        throw new TeamServiceInstallError('MEMBER_IDENTITY_INVALID', 'a Member identity needs teamId, memberInstanceId and templateId');
    }
    if (!Number.isFinite(identity.instanceGeneration) || identity.instanceGeneration < 0) {
        throw new TeamServiceInstallError('MEMBER_IDENTITY_INVALID', `Member '${identity.memberInstanceId}' has an invalid instance generation`);
    }
    if (!policy.ok) {
        throw new TeamServiceInstallError('MEMBER_POLICY_UNAVAILABLE', `Member '${identity.memberInstanceId}' has no compiled policy (${policy.code}: ${policy.detail}); a Member never runs on an uncompiled ceiling`, policy.path);
    }
    const compiled = policy.value;
    if (compiled.memberIdentity !== identity.memberInstanceId) {
        throw new TeamServiceInstallError('MEMBER_IDENTITY_INVALID', `policy was compiled for '${compiled.memberIdentity}', not '${identity.memberInstanceId}'`);
    }
    if (!compiled.revision) {
        throw new TeamServiceInstallError('MEMBER_POLICY_UNAVAILABLE', 'a compiled policy must carry its revision');
    }
    // A policy compiled for generation N must never be mounted for N+1: the
    // revision would claim a generation the ceiling was not derived from.
    if (compiled.instanceGeneration !== identity.instanceGeneration) {
        throw new TeamServiceInstallError('MEMBER_POLICY_STALE', `Member '${identity.memberInstanceId}' policy was compiled for generation ${String(compiled.instanceGeneration)}, but the instance is at generation ${String(identity.instanceGeneration)}`);
    }
    return compiled;
}
/** Sample the live `subprocess` service class (BL-16), if the host has one. */
function sampleSubprocessClass(root) {
    const live = root.get('subprocess');
    if (live === undefined || live === null)
        return undefined;
    const prototype = Object.getPrototypeOf(live);
    const ctor = prototype?.constructor;
    return typeof ctor === 'function' ? ctor : undefined;
}
/** Sample the live Provider class from the root service, if any. */
function sampleProviderClass(root) {
    const live = root.get('fs');
    if (live === undefined || live === null)
        return undefined;
    const prototype = Object.getPrototypeOf(live);
    const ctor = prototype?.constructor;
    return typeof ctor === 'function' ? ctor : undefined;
}
/**
 * Install one confined Provider per Member into its own isolated `fs` scope.
 * Resolves only when every Member is installed; rejects (typed) otherwise.
 */
export async function installMemberIoProviders(input) {
    const { root, members } = input;
    if (members.length === 0) {
        throw new TeamServiceInstallError('MEMBER_IDENTITY_INVALID', 'install requires at least one Member');
    }
    // 1. Validate EVERY Member before touching the Context (atomic install).
    const compiled = members.map((spec) => ({ spec, policy: assertSpec(spec) }));
    const seen = new Set();
    for (const { spec } of compiled) {
        if (seen.has(spec.identity.memberInstanceId)) {
            throw new TeamServiceInstallError('MEMBER_DUPLICATE', `Member '${spec.identity.memberInstanceId}' is listed twice`);
        }
        seen.add(spec.identity.memberInstanceId);
        if (INSTALLED.get(root)?.has(spec.identity.memberInstanceId)) {
            throw new TeamServiceInstallError('SERVICE_ALREADY_INSTALLED', `Member '${spec.identity.memberInstanceId}' already has an installed service realm in this Context`);
        }
    }
    // 2. Resolve and inspect the base Provider (before any scope exists).
    const Base = input.providerClass ?? sampleProviderClass(root);
    if (Base === undefined) {
        throw new TeamServiceInstallError('PROVIDER_UNAVAILABLE', 'no live fs Provider at the root and no providerClass supplied; a Member never falls back to the raw host filesystem');
    }
    // ONE closed vocabulary owns "what a confinable Provider must expose". The
    // gate is the tested `requireProviderCapabilities` (a missing method never
    // degrades to all-read, an unknown one is never a managed capability).
    const capability = requireProviderCapabilities(Base.prototype);
    if (!capability.ok) {
        throw new TeamServiceInstallError('PROVIDER_INCOMPATIBLE', capability.detail);
    }
    // 2b. BL-16: a DECLARED confined subprocess face needs a live base class to
    // shadow. A host with no `subprocess` service cannot mount one, and silently
    // skipping it would leave `grep`/`glob` on the inherited unconfined service —
    // exactly the hole this face exists to close. Refuse before any scope exists.
    const SubprocessBase = input.subprocess === undefined
        ? undefined
        : input.subprocess.providerClass ?? sampleSubprocessClass(root);
    if (input.subprocess !== undefined && SubprocessBase === undefined) {
        throw new TeamServiceInstallError('PROVIDER_UNAVAILABLE', 'a confined subprocess face was declared but the root Context carries no `subprocess` service to confine; a Member never falls back to the host subprocess service');
    }
    // 3. Mount, tracking every fiber so a later failure can roll back.
    const installed = [];
    const rollback = async () => {
        for (const member of [...installed].reverse()) {
            try {
                await member.dispose();
            }
            catch {
                // Best-effort rollback: the original failure is the one reported.
            }
        }
    };
    for (const { spec, policy } of compiled) {
        const label = Symbol(`member:${spec.identity.memberInstanceId}`);
        const isolated = root.isolate('fs', label);
        // BL-16: the subprocess face must live in the SAME isolated chain as the
        // Member's `fs`, and Cordis isolates ONE service per call. Nesting keeps
        // the `fs` scope identity intact while giving `subprocess` its own shadow
        // (a sibling isolate would not be visible to the native modules, which are
        // mounted on THIS ctx).
        const scoped = input.subprocess === undefined
            ? isolated
            : isolated.isolate('subprocess', Symbol(`member-subprocess:${spec.identity.memberInstanceId}`));
        const guard = createMemberFsGuard(policy);
        // DEFAULT PATH = the original guard object (no wrapper, no extra call).
        const observed = input.onGuardConsult === undefined
            ? guard
            : observeGuard(guard, input.onGuardConsult, {
                realm: 'member',
                memberIdentity: spec.identity.memberInstanceId,
                toolBindingIdentity: null,
                policyRevision: policy.revision,
            });
        const Confined = createConfinedFileSystemClass(Base, observed);
        let disposeMount;
        try {
            const fiber = await scoped.plugin(Confined, spec.config ?? {});
            disposeMount = async () => {
                await fiber.dispose();
            };
        }
        catch (error) {
            await rollback();
            throw new TeamServiceInstallError('SERVICE_MOUNT_FAILED', `Member '${spec.identity.memberInstanceId}' service mount failed: ${error instanceof Error ? error.message : String(error)}`);
        }
        const fs = scoped.get('fs');
        if (fs === undefined) {
            await disposeMount();
            await rollback();
            throw new TeamServiceInstallError('SERVICE_MOUNT_FAILED', `Member '${spec.identity.memberInstanceId}' mounted no fs service`);
        }
        // BL-16: the confined subprocess face rides the SAME isolated Member scope,
        // so a native module mounted by route C resolves it as `ctx.subprocess`.
        let disposeSubprocess;
        let subprocess;
        if (input.subprocess !== undefined && SubprocessBase !== undefined) {
            const ConfinedSubprocess = createConfinedSubprocessClass(SubprocessBase, {
                ...input.subprocess,
                onGuardConsult: input.onGuardConsult,
            });
            try {
                // Cordis' `plugin` overloads are keyed on the plugin's literal shape;
                // this lane mounts a class created at runtime, exactly as the confined
                // `fs` class above is mounted through the same call.
                const mountPlugin = scoped.plugin;
                const fiber = await mountPlugin(ConfinedSubprocess, {});
                disposeSubprocess = async () => {
                    await fiber.dispose();
                };
            }
            catch (error) {
                await disposeMount();
                await rollback();
                throw new TeamServiceInstallError('SERVICE_MOUNT_FAILED', `Member '${spec.identity.memberInstanceId}' confined subprocess mount failed: ${error instanceof Error ? error.message : String(error)}`);
            }
            const mounted = scoped.get('subprocess');
            if (mounted === undefined) {
                await disposeSubprocess();
                await disposeMount();
                await rollback();
                throw new TeamServiceInstallError('SERVICE_MOUNT_FAILED', `Member '${spec.identity.memberInstanceId}' mounted no confined subprocess service`);
            }
            subprocess = mounted;
        }
        let disposed = false;
        const installation = Object.freeze({
            identity: spec.identity,
            serviceIdentity: Object.freeze({
                teamId: spec.identity.teamId,
                memberInstanceId: spec.identity.memberInstanceId,
                policyRevision: policy.revision,
                instanceGeneration: spec.identity.instanceGeneration,
            }),
            ctx: scoped,
            fs,
            ...(subprocess === undefined ? {} : { subprocess }),
            dispose: async () => {
                if (disposed)
                    return;
                disposed = true;
                INSTALLED.get(root)?.delete(spec.identity.memberInstanceId);
                if (disposeSubprocess !== undefined)
                    await disposeSubprocess();
                await disposeMount();
            },
        });
        installed.push(installation);
        const registry = INSTALLED.get(root) ?? new Map();
        registry.set(spec.identity.memberInstanceId, installation);
        INSTALLED.set(root, registry);
    }
    let allDisposed = false;
    return Object.freeze({
        members: Object.freeze([...installed]),
        dispose: async () => {
            if (allDisposed)
                return;
            allDisposed = true;
            await rollback();
        },
    });
}
const BINDING_REALMS = new WeakMap();
/**
 * Mount a confined Provider for ONE tool binding under its OWN isolate. The
 * Member realm (above) enforces the ceiling; this realm enforces the narrower
 * per-binding intersection. Installing only the Member realm would leave
 * `EffectiveIo` decorative at runtime, which is exactly the defect G1 review
 * found.
 */
export async function installToolBindingRealm(input) {
    const { root, spec } = input;
    if (!spec.toolBindingIdentity.trim()) {
        throw new TeamServiceInstallError('MEMBER_IDENTITY_INVALID', 'a tool-binding realm needs a non-blank binding identity');
    }
    if (spec.effective.memberIdentity !== spec.identity.memberInstanceId) {
        throw new TeamServiceInstallError('MEMBER_IDENTITY_INVALID', `effective policy was compiled for '${spec.effective.memberIdentity}', not '${spec.identity.memberInstanceId}'`);
    }
    if (spec.effective.toolBindingIdentity !== spec.toolBindingIdentity) {
        throw new TeamServiceInstallError('MEMBER_IDENTITY_INVALID', `effective policy was compiled for binding '${spec.effective.toolBindingIdentity}', not '${spec.toolBindingIdentity}'`);
    }
    const key = `${spec.identity.memberInstanceId}#${spec.toolBindingIdentity}`;
    if (BINDING_REALMS.get(root)?.has(key)) {
        throw new TeamServiceInstallError('SERVICE_ALREADY_INSTALLED', `binding realm '${key}' is already installed`);
    }
    const Base = input.providerClass ?? sampleProviderClass(root);
    if (Base === undefined) {
        throw new TeamServiceInstallError('PROVIDER_UNAVAILABLE', 'no base fs Provider for a tool-binding realm');
    }
    const capability = requireProviderCapabilities(Base.prototype);
    if (!capability.ok) {
        throw new TeamServiceInstallError('PROVIDER_INCOMPATIBLE', capability.detail);
    }
    const guard = createMemberFsGuard(spec.effective);
    // DEFAULT PATH = the original guard object (no wrapper, no extra call).
    const observed = input.onGuardConsult === undefined
        ? guard
        : observeGuard(guard, input.onGuardConsult, {
            realm: 'binding',
            memberIdentity: spec.identity.memberInstanceId,
            toolBindingIdentity: spec.toolBindingIdentity,
            policyRevision: spec.effective.policyRevision,
        });
    const Confined = createConfinedFileSystemClass(Base, observed);
    const scoped = root.isolate('fs', Symbol(`binding:${key}`));
    let fiber;
    try {
        fiber = await scoped.plugin(Confined, spec.config ?? {});
        if (scoped.get('fs') === undefined) {
            throw new Error('the binding realm mounted no fs service');
        }
    }
    catch (error) {
        await fiber?.dispose().catch(() => undefined);
        throw new TeamServiceInstallError('SERVICE_MOUNT_FAILED', `binding realm '${key}' mount failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    let disposed = false;
    const realm = Object.freeze({
        identity: spec.identity,
        toolBindingIdentity: spec.toolBindingIdentity,
        policyRevision: spec.effective.policyRevision,
        ctx: scoped,
        fs: scoped.get('fs'),
        dispose: async () => {
            if (disposed)
                return;
            disposed = true;
            BINDING_REALMS.get(root)?.delete(key);
            await fiber?.dispose();
        },
    });
    const registry = BINDING_REALMS.get(root) ?? new Map();
    registry.set(key, realm);
    BINDING_REALMS.set(root, registry);
    return realm;
}
//# sourceMappingURL=install.js.map