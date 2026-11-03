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
    // The Member ceiling first: a binding realm without its ceiling would enforce
    // the narrower lane while the Member-wide lane stayed decorative.
    const installation = await installMemberIoProviders({
        root,
        members: input.members,
        ...(input.providerClass === undefined ? {} : { providerClass: input.providerClass }),
        ...(input.onGuardConsult === undefined ? {} : { onGuardConsult: input.onGuardConsult }),
    });
    // ROUTE C (2026-11-03): the native tool modules are re-mounted INSIDE the
    // Member's isolated scope by the CALLER, through this realm's
    // `mountNativeToolModules` (the production glue calls it AFTER its capability
    // deny lane — see the ordering note on `NativeToolModuleMount`). One parent
    // fiber per module; disposal rides this realm's own dispose (before the
    // confined Provider fiber), so the shadow can never outlive the confined `fs`
    // it resolves. Teardown failures are COLLECTED and re-thrown after every
    // disposal ran: a swallowed teardown error is the failure mode this replaces.
    const nativeFibers = [];
    const disposeNative = async () => {
        const errors = [];
        for (const fiber of [...nativeFibers].reverse()) {
            try {
                await fiber.dispose();
            }
            catch (error) {
                errors.push(error);
            }
        }
        nativeFibers.length = 0;
        if (errors.length > 0)
            throw errors[0];
    };
    const disposeNativeQuietly = async () => {
        try {
            await disposeNative();
        }
        catch {
            // Rollback path: the ORIGINAL failure is the one reported.
        }
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
        await disposeNativeQuietly();
        await installation.dispose();
        throw error;
    }
    let disposed = false;
    return Object.freeze({
        members: Object.freeze([...input.members]),
        installation,
        bindings: Object.freeze([...mounted]),
        mountNativeToolModules: async (modules) => {
            // Refuse BEFORE registering anything: every Member realm shares the
            // agent's DSH scope key, so two re-mounts of the same native names would
            // collide inside one scope layer. One Member ceiling per agent tool plane.
            if (input.members.length !== 1) {
                throw new TeamServiceInstallError('SERVICE_MOUNT_FAILED', `native tool re-mount requires exactly one Member ceiling (got ${input.members.length}): every Member realm inherits the same agent scope key, so a second re-mount of the same tool names collides in one scope layer`);
            }
            if (disposed) {
                throw new TeamServiceInstallError('SERVICE_MOUNT_FAILED', 'native tool re-mount refused: the realm is already disposed');
            }
            // Its `ctx` IS the isolated scope the confined Provider was installed on
            // (`install.ts:182`).
            const target = installation.members[0]?.ctx;
            if (target === undefined) {
                throw new TeamServiceInstallError('SERVICE_MOUNT_FAILED', 'native tool re-mount found no installed Member realm to mount into');
            }
            const created = [];
            for (const mount of modules) {
                try {
                    const fiber = await target.plugin(mount.module, mount.config);
                    created.push(fiber);
                    nativeFibers.push(fiber);
                }
                catch (error) {
                    // Roll back only what THIS call created; the realm stays mounted (the
                    // caller may still run without the native shadow).
                    for (const fiber of [...created].reverse()) {
                        try {
                            await fiber.dispose();
                        }
                        catch {
                            // Rollback path: the mount failure is the one reported.
                        }
                    }
                    for (const fiber of created) {
                        const at = nativeFibers.indexOf(fiber);
                        if (at !== -1)
                            nativeFibers.splice(at, 1);
                    }
                    throw new TeamServiceInstallError('SERVICE_MOUNT_FAILED', `native tool module re-mount failed: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
            return Object.freeze([...created]);
        },
        dispose: async () => {
            if (disposed)
                return;
            disposed = true;
            // The native shadow is disposed FIRST: once the confined Provider fiber is
            // gone, a surviving shadow would resolve a missing `fs` service (fail
            // closed, but reported as a service fault) instead of the guard's refusal.
            // A teardown failure is REPORTED (never swallowed) and never shortens the
            // rest of the teardown.
            let nativeError;
            try {
                await disposeNative();
            }
            catch (error) {
                nativeError = error;
            }
            await disposeMounted();
            await installation.dispose();
            if (nativeError !== undefined)
                throw nativeError;
        },
    });
}
//# sourceMappingURL=mount.js.map