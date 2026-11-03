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
import type { Context, Plugin } from '@deepseek-ai/cordis';
import type { CompileResult, EffectiveIoPolicy, MemberPolicy, TrustedMemberIdentity } from '../../member-io-policy/src/types.js';
import type { FsProviderConstructor } from './fs.js';
import type { GuardConsultObserver } from './guard-observability.js';
import { type MemberServiceSpec, type ToolBindingRealm } from './install.js';
import type { MemberIoInstallation } from './types.js';
/** One Member to mount: identity + the ceiling compiled for that generation. */
export interface A5sfRealmMember {
    readonly identity: TrustedMemberIdentity;
    readonly policy: CompileResult<MemberPolicy>;
    readonly config?: Record<string, unknown>;
}
/** One admitted (Member × tool binding) realm to mount under the ceiling. */
export interface A5sfRealmBinding {
    readonly identity: TrustedMemberIdentity;
    readonly toolBindingIdentity: string;
    readonly effective: EffectiveIoPolicy;
    readonly config?: Record<string, unknown>;
}
/**
 * One NATIVE tool module to re-mount INSIDE the Member's isolated `fs` scope.
 *
 * WHY THIS EXISTS (route C, 2026-11-03): the Agent preset registry mounts its
 * tool rows under the preset's STANDING scope, which is an ANCESTOR of the
 * agent scope; the definition a preset registers therefore resolves the preset
 * scope's `fs` (the base Provider). A registration made from the Member's own
 * isolated scope — `root.isolate('fs', label)`, whose DSH scope key is still the
 * agent's (`cordinate extend` inherits the scope tag) — SHADOWS that definition
 * for this agent only, and its body resolves the confined Provider. Mounting
 * the native module here is what makes the MODEL-VISIBLE native `read`/`write`/
 * `edit` execute on the confined lane. No Core patch, no copied tool body, no
 * second mount path: the module is the SAME package the preset mounted.
 *
 * The module is imported by the CALLER (row composition), never resolved here:
 * this seam must not own module-resolution policy (the same discipline that
 * keeps policy compilation out).
 */
export interface NativeToolModuleMount {
    /** A Cordis plugin module (already imported): the native tool package's module object. */
    readonly module: Plugin;
    /** Plugin config forwarded verbatim to `ctx.plugin`. */
    readonly config?: unknown;
}
export interface MountA5sfRealmInput {
    readonly root: Context;
    readonly members: readonly A5sfRealmMember[];
    /** Binding realms are optional: a Member may mount only its ceiling realm. */
    readonly bindings?: readonly A5sfRealmBinding[];
    readonly providerClass?: FsProviderConstructor;
    /** Observe every guard consultation in every realm this call mounts. */
    readonly onGuardConsult?: GuardConsultObserver;
    /**
     * Native tool modules to re-mount inside the Member's isolated scope (route
     * C). Absent/empty = the pre-route-C mount, byte-identical. A non-empty list
     * requires EXACTLY ONE Member ceiling: every Member realm inherits the SAME
     * agent scope key, so a second re-mount of the same tool names would collide
     * in one scope layer.
     */
    readonly nativeToolModules?: readonly NativeToolModuleMount[];
}
export interface MountedA5sfRealm {
    readonly members: readonly MemberServiceSpec[];
    readonly installation: MemberIoInstallation;
    readonly bindings: readonly ToolBindingRealm[];
    dispose(): Promise<void>;
}
/**
 * Mount one Member's compiled realm (ceiling + zero or more binding realms).
 * Consumes compiled objects only; refuses nothing of its own — every refusal
 * is the owning installer's typed `TeamServiceInstallError`.
 */
export declare function mountA5sfRealm(input: MountA5sfRealmInput): Promise<MountedA5sfRealm>;
//# sourceMappingURL=mount.d.ts.map