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
import type { Context } from '@deepseek-ai/cordis';
import type { CompileResult, EffectiveIoPolicy, MemberPolicy, TrustedMemberIdentity } from '../../member-io-policy/src/types.js';
import { type FsProviderConstructor, type FsProviderSurface } from './fs.js';
import { createConfinedSubprocessClass, type ConfinedProcessProvider, type SubprocessProviderConstructor } from './subprocess.js';
import { type GuardConsultObserver } from './guard-observability.js';
import { type MemberIoInstallation, type RealmServiceFaces } from './types.js';
/** One Member to install: identity + its compiled policy (or the refusal). */
export interface MemberServiceSpec {
    readonly identity: TrustedMemberIdentity;
    readonly policy: CompileResult<MemberPolicy>;
    /** Provider config (e.g. the session workspace cwd). Never policy. */
    readonly config?: Record<string, unknown>;
}
export interface InstallMemberIoProvidersInput {
    readonly root: Context;
    readonly members: readonly MemberServiceSpec[];
    /**
     * Explicit base Provider class. Omitted = sample the LIVE provider mounted at
     * the root (`Object.getPrototypeOf(root.get('fs')).constructor`), which is
     * how a real Host installs `fs-local` / `fs-sandbox` semantics.
     */
    readonly providerClass?: FsProviderConstructor;
    /**
     * P2 seam (additive, default-preserving): observe every consultation of the
     * Member-ceiling guard this install builds. Omitted = the exact original
     * guard object and confined class are used, with no wrapper and no extra
     * call of any kind. Supplied = each consultation is reported exactly once,
     * BEFORE the Provider delegates, and a report failure REFUSES the call
     * (`GUARD_OBSERVATION_FAILED`) instead of letting an unrecorded decision
     * become an effect. Never a second policy evaluation — see
     * `guard-observability.ts`.
     */
    readonly onGuardConsult?: GuardConsultObserver;
    /**
     * BL-16 (additive, default-preserving): mount a CONFINED `subprocess`
     * Provider on the SAME isolated Member scope, so a routed native module that
     * injects `subprocess` (the pinned `grep`/`glob` module does) executes on the
     * Member's lane instead of the inherited host service. Omitted = nothing is
     * mounted and the inherited service is untouched (the historical behavior).
     */
    readonly subprocess?: ConfinedSubprocessRealmSpec;
}
/**
 * The confined `subprocess` face of ONE Member realm.
 *
 * `effective` is the compiled `EffectiveIo` the ceiling-routed tools enforce —
 * for `grep`/`glob` that is `ceiling ∩ tool restriction`, produced by the ONE
 * compiler (`compileEffectiveIo`); this lane never re-derives an intersection.
 * `provider` is P1-07's OS-confined process provider, created by the
 * composition that owns the launcher pin (the realm must not guess an assembly).
 */
export interface ConfinedSubprocessRealmSpec {
    readonly effective: EffectiveIoPolicy;
    readonly provider: ConfinedProcessProvider;
    readonly realmId?: string;
    readonly bindingId?: string;
    readonly memberScope?: string;
    readonly env?: Readonly<Record<string, string>>;
    readonly runtimeAllowPaths?: Parameters<typeof createConfinedSubprocessClass>[1]['runtimeAllowPaths'];
    /** Explicit base class; omitted = sample the live `subprocess` service. */
    readonly providerClass?: SubprocessProviderConstructor;
    /**
     * BL-17 — the COMPOSITION's declared shell class for this realm, forwarded
     * verbatim to the confined face's admission. Omitted = no shell program is
     * admitted (the BL-16 refusal). The Member cannot supply or widen it: the
     * field is part of the install spec the composition builds, next to the
     * launcher pin and the process provider.
     */
    readonly shellClass?: Parameters<typeof createConfinedSubprocessClass>[1]['shellClass'];
}
/** The mounted confined `subprocess` service (structural, provider-private). */
export interface ConfinedSubprocessSurface {
    spawn(spec: unknown): unknown;
    spawnTerminal?(spec: unknown): Promise<unknown>;
}
/**
 * Install one confined Provider per Member into its own isolated `fs` scope.
 * Resolves only when every Member is installed; rejects (typed) otherwise.
 */
export declare function installMemberIoProviders(input: InstallMemberIoProvidersInput): Promise<MemberIoInstallation>;
/** One (Member × tool binding) realm: the effective policy, not the ceiling. */
export interface ToolBindingRealmSpec {
    readonly identity: TrustedMemberIdentity;
    readonly toolBindingIdentity: string;
    /** The compiled `EffectiveIo` for this binding (P1-02 intersection). */
    readonly effective: EffectiveIoPolicy;
    readonly config?: Record<string, unknown>;
}
export interface ToolBindingRealm {
    readonly identity: TrustedMemberIdentity;
    readonly toolBindingIdentity: string;
    readonly policyRevision: string;
    readonly ctx: Context;
    readonly fs: FsProviderSurface;
    /**
     * BL-17 (2026-11-04): the confined faces this BINDING realm owns.
     *
     * Today `installToolBindingRealm` isolates `fs` only, so `subprocess` is
     * `null` — an EXPLICIT answer, not an omission. `mountNativeToolModules`
     * refuses a `subprocess`-consuming module targeted at this realm instead of
     * letting it resolve the inherited base service. A future binding-scoped
     * process lane must mount its confined `subprocess` provider on THIS realm's
     * isolated scope and report it here; until then, refusal is the contract.
     */
    readonly faces: RealmServiceFaces;
    dispose(): Promise<void>;
}
/**
 * Mount a confined Provider for ONE tool binding under its OWN isolate. The
 * Member realm (above) enforces the ceiling; this realm enforces the narrower
 * per-binding intersection. Installing only the Member realm would leave
 * `EffectiveIo` decorative at runtime, which is exactly the defect G1 review
 * found.
 */
export declare function installToolBindingRealm(input: {
    readonly root: Context;
    readonly spec: ToolBindingRealmSpec;
    readonly providerClass?: FsProviderConstructor;
    /**
     * P2 seam (additive, default-preserving): observe every consultation of THIS
     * binding's guard. Same contract as {@link InstallMemberIoProvidersInput.onGuardConsult}:
     * omitted = the original guard object, supplied = one report per
     * consultation before delegation, and a report failure refuses the call.
     */
    readonly onGuardConsult?: GuardConsultObserver;
}): Promise<ToolBindingRealm>;
//# sourceMappingURL=install.d.ts.map