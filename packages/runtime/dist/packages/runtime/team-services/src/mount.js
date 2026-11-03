/**
 * Alpha.5 P2 — the ONE mount entry point for a Member's compiled a5sf realm.
 *
 * WHY A SEPARATE ENTRY POINT: at the base of this package the two installers
 * (`installMemberIoProviders`, `installToolBindingRealm`) had NO production
 * caller — only the barrel re-export, the P1-05 suite and the R2 harness — so
 * the compiled realm was provable in-process and INERT in a Host. A P2 live
 * run's central facts ("the tool read through the Member's Provider", "the
 * guard was consulted") could therefore only be driver self-reports. This
 * module is the named seam a booted Host would call, in one place, for one
 * admitted Member: it mounts the Member ceiling realm and each admitted
 * tool-binding realm, and — when the caller supplies an observer — makes every
 * guard consultation observable and transportable (`guard-observability.ts`).
 *
 * WHAT THIS IS NOT: not a second launcher (the caller owns the root Context),
 * not a policy compiler (it consumes the SAME `CompileResult<MemberPolicy>` /
 * `EffectiveIoPolicy` objects P1-02 produced; it never re-evaluates a lane),
 * not a budget ledger, not an oracle, and not a decision. It composes the two
 * existing installers and adds rollback across them.
 *
 * ATOMICITY: if a binding realm fails to mount after the Member realm(s)
 * mounted, every binding mounted so far and the Member installation are
 * disposed before the typed install error propagates. `dispose()` is
 * idempotent and disposes bindings before Member ceilings.
 *
 * @module @dsh-agent-team/runtime/team-services/mount
 */
import { installMemberIoProviders, installToolBindingRealm, } from './install.js';
import { TeamServiceInstallError } from './types.js';
/**
 * Mount one Member's compiled realm (ceiling + zero or more binding realms).
 * Consumes compiled objects only; refuses nothing of its own — every refusal
 * is the owning installer's typed `TeamServiceInstallError`.
 */
export async function mountA5sfRealm(input) {
    const { root } = input;
    const nativeModules = input.nativeToolModules ?? [];
    // Refuse BEFORE touching the Context: every Member realm shares the agent's
    // DSH scope key, so two re-mounts of the same native names would collide
    // inside one scope layer. One Member ceiling per agent tool plane.
    if (nativeModules.length > 0 && input.members.length !== 1) {
        throw new TeamServiceInstallError('SERVICE_MOUNT_FAILED', `native tool re-mount requires exactly one Member ceiling (got ${input.members.length}): every Member realm inherits the same agent scope key, so a second re-mount of the same tool names collides in one scope layer`);
    }
    // The Member ceiling first: a binding realm without its ceiling would enforce
    // the narrower lane while the Member-wide lane stayed decorative.
    const installation = await installMemberIoProviders({
        root,
        members: input.members,
        ...(input.providerClass === undefined ? {} : { providerClass: input.providerClass }),
        ...(input.onGuardConsult === undefined ? {} : { onGuardConsult: input.onGuardConsult }),
    });
    // ROUTE C (2026-11-03): re-mount the native tool modules INSIDE the Member's
    // isolated scope. One parent fiber per module; disposal rides the realm's own
    // dispose (before the confined Provider fiber), so the shadow can never
    // outlive the confined `fs` it resolves.
    const nativeFibers = [];
    const disposeNative = async () => {
        for (const fiber of [...nativeFibers].reverse()) {
            try {
                await fiber.dispose();
            }
            catch {
                // Best-effort rollback: the original failure is the one reported.
            }
        }
        nativeFibers.length = 0;
    };
    const mounted = [];
    const disposeMounted = async () => {
        for (const realm of [...mounted].reverse()) {
            try {
                await realm.dispose();
            }
            catch {
                // Best-effort rollback: the original failure is the one reported.
            }
        }
        mounted.length = 0;
    };
    try {
        if (nativeModules.length > 0) {
            // Exactly one Member (asserted above); its `ctx` IS the isolated scope the
            // confined Provider was installed on (`install.ts:182`).
            const target = installation.members[0]?.ctx;
            if (target === undefined) {
                throw new TeamServiceInstallError('SERVICE_MOUNT_FAILED', 'native tool re-mount found no installed Member realm to mount into');
            }
            for (const mount of nativeModules) {
                nativeFibers.push(await target.plugin(mount.module, mount.config));
            }
        }
    }
    catch (error) {
        await disposeNative();
        await installation.dispose();
        throw new TeamServiceInstallError('SERVICE_MOUNT_FAILED', `native tool module re-mount failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
        for (const binding of input.bindings ?? []) {
            const spec = {
                identity: binding.identity,
                toolBindingIdentity: binding.toolBindingIdentity,
                effective: binding.effective,
                ...(binding.config === undefined ? {} : { config: binding.config }),
            };
            mounted.push(await installToolBindingRealm({
                root,
                spec,
                ...(input.providerClass === undefined ? {} : { providerClass: input.providerClass }),
                ...(input.onGuardConsult === undefined ? {} : { onGuardConsult: input.onGuardConsult }),
            }));
        }
    }
    catch (error) {
        await disposeMounted();
        await disposeNative();
        await installation.dispose();
        throw error;
    }
    let disposed = false;
    return Object.freeze({
        members: Object.freeze([...input.members]),
        installation,
        bindings: Object.freeze([...mounted]),
        dispose: async () => {
            if (disposed)
                return;
            disposed = true;
            // The native shadow is disposed FIRST: once the confined Provider fiber is
            // gone, a surviving shadow would resolve a missing `fs` service (fail
            // closed, but reported as a service fault) instead of the guard's refusal.
            await disposeNative();
            await disposeMounted();
            await installation.dispose();
        },
    });
}
//# sourceMappingURL=mount.js.map