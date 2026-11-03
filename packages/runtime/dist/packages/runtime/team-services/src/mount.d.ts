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
import type { Context, Fiber, Plugin } from '@deepseek-ai/cordis';
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
 *
 * ORDER IS LOAD-BEARING (review fix, 2026-11-03): the shadow must be created
 * AFTER the Member capability deny lane (`applyBuiltInToolDeny`). An OWN-scope
 * registration sits outside the inherited `tools.restrict` filter, so a deny
 * applied to the inherited surface BEFORE the shadow hides the preset row and
 * lets the shadow take its place; a deny applied AFTER the shadow cannot hide
 * it. The production glue therefore calls `mountNativeToolModules` after the
 * deny block, and the surface-neutrality check compares against the POST-DENY
 * surface.
 */
export interface NativeToolModuleMount {
    /** A Cordis plugin module (already imported): the native tool package's module object. */
    readonly module: Plugin;
    /** Plugin config forwarded verbatim to `ctx.plugin`. */
    readonly config?: unknown;
    /**
     * S-1 (2026-11-03) — the ToolBinding whose realm this mount's tools execute on.
     *
     * A native tool PACKAGE registers a whole suite from one `apply`
     * (`@deepseek-ai/dsh-tool-fs` registers `read`/`write`/`edit`/`read_image`),
     * so mounting the module into a binding realm applies THAT binding's lane to
     * every sibling tool. A binding-targeted mount therefore installs a
     * REGISTRATION ROUTER over `realm.bindings[i].ctx` (already isolated for
     * `fs`) that forwards only the definition/prompt-section whose tool name is
     * the binding's own tool (`<owner>/<tool>` -> `<tool>`) and drops the rest to
     * their own fibers. A mount WITHOUT a binding identity keeps the ceiling
     * realm and forwards every definition whose tool has NO mounted binding, so
     * the union of the fibers reproduces the module's surface exactly once.
     *
     * The router evaluates NO lane and reads no blueprint: it dispatches to the
     * already-installed realm, whose guard was built from the compiled
     * intersection. A binding identity with no mounted binding realm, or a
     * binding-targeted module that never registers that tool, is a typed refusal
     * (fail closed) — never a silent fallback onto the wider ceiling.
     */
    readonly toolBindingIdentity?: string;
}
/**
 * S-1 routing receipt: what ONE router fiber forwarded and dropped, by name.
 * Attached (non-enumerable) to the fiber this mount returned, so a caller can
 * prove the partition per fiber without a second registry.
 */
export interface NativeRegistrationRouting {
    /** Which realm this fiber's forwarded tools execute on. */
    readonly realm: 'ceiling' | 'binding';
    /** The binding identity of a `'binding'` fiber; `null` for the ceiling fiber. */
    readonly toolBindingIdentity: string | null;
    /** Tool names this fiber registered on the real `tools` service. */
    readonly forwarded: readonly string[];
    /** Tool names this fiber dropped (they belong to another fiber). */
    readonly dropped: readonly string[];
    /** Prompt-section names (`tool:<name>`) this fiber registered. */
    readonly forwardedSections: readonly string[];
}
/** The property name a router fiber carries its {@link NativeRegistrationRouting} under. */
export declare const NATIVE_REGISTRATION_ROUTING = "a5sfRegistrationRouting";
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
    /**
     * ROUTE C — re-mount NATIVE tool modules into the Member's isolated scope NOW
     * (the caller MUST have applied its capability deny lane first: see the
     * `NativeToolModuleMount` ordering note). The returned fibers are the ones
     * this call created; they are ALREADY tracked for disposal by this realm, and
     * the caller may dispose them individually if its surface-neutrality check
     * fails. Refuses (typed) unless this realm carries exactly ONE Member
     * ceiling: every Member realm inherits the SAME agent scope key, so a second
     * re-mount of the same tool names collides in one scope layer.
     *
     * S-1 (2026-11-03): every mount is installed behind a REGISTRATION ROUTER.
     * A mount carrying `toolBindingIdentity` is mounted on that binding's realm
     * and forwards ONLY the binding's own tool; a mount without one stays on the
     * Member ceiling realm and forwards every tool that has no mounted binding.
     * The union is the module's surface, exactly once, so this remains
     * surface-neutral per fiber.
     */
    mountNativeToolModules(modules: readonly NativeToolModuleMount[]): Promise<readonly Fiber[]>;
    dispose(): Promise<void>;
}
/**
 * Mount one Member's compiled realm (ceiling + zero or more binding realms).
 * Consumes compiled objects only; refuses nothing of its own — every refusal
 * is the owning installer's typed `TeamServiceInstallError`.
 */
export declare function mountA5sfRealm(input: MountA5sfRealmInput): Promise<MountedA5sfRealm>;
//# sourceMappingURL=mount.d.ts.map