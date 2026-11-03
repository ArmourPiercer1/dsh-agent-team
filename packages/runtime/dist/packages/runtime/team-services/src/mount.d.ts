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
import type { Context } from '@deepseek-ai/cordis';
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
export interface MountA5sfRealmInput {
    readonly root: Context;
    readonly members: readonly A5sfRealmMember[];
    /** Binding realms are optional: a Member may mount only its ceiling realm. */
    readonly bindings?: readonly A5sfRealmBinding[];
    readonly providerClass?: FsProviderConstructor;
    /** Observe every guard consultation in every realm this call mounts. */
    readonly onGuardConsult?: GuardConsultObserver;
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