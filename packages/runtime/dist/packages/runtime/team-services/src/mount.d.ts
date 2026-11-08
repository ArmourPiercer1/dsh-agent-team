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
 * COVERAGE, NOT JUST NAMES: a module may register from a DEFERRED
 * `ctx.inject(...)` child after `apply` returns (the pinned `dsh-tool-fs`
 * registers `read_image` that way). A mount therefore SETTLES a bounded window,
 * lets the child run THROUGH THE SAME ROUTER (its deferred inject carries the
 * router's two services, see `routedModuleContext`), and then INSPECTS the
 * result: a FAILED child, a child that never settles, or a name no fiber of the
 * attach forwards is refused (typed `SERVICE_MOUNT_FAILED`) — while a child that
 * forwards a covered name is accepted, identity-tracked and verified exactly
 * like a synchronous registration. An optional dependency absent everywhere
 * stays benign (the child never runs and registers nothing). Refusing disposes
 * every fiber this mount created, so the preset surface is restored.
 *
 * @module @dsh-agent-team/runtime/team-services/mount
 */
import type { Context, Fiber, Plugin } from '@deepseek-ai/cordis';
import type { CompileResult, EffectiveIoPolicy, MemberPolicy, TrustedMemberIdentity } from '../../member-io-policy/src/types.js';
import type { FsProviderConstructor } from './fs.js';
import type { GuardConsultObserver } from './guard-observability.js';
import { type MemberServiceSpec, type ToolBindingRealm } from './install.js';
import type { ConfinedSubprocessRealmSpec, ConfinedTerminalRealmSpec, ConfinedWebRealmSpec } from './install.js';
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
    /**
     * PD-29 (2026-11-14) — mount the module DIRECTLY on the Member's isolated
     * scope, with NO registration router.
     *
     * Needed by a module that registers a `tools/result` listener: Cordis filters
     * service-scoped events by the `tools` isolation label, and the router
     * isolates `tools`, so a routed module never receives the dispatch (measured).
     * A direct mount keeps the realm's real `tools` label and its confined `fs`
     * label, registers into the AGENT's tool layer, and is verified by DEFINITION
     * IDENTITY instead of the router's forwarding receipt (see
     * `mountDirectNativeModule`). Refused with a binding identity, without
     * non-empty `expectedTools`, on a deferred registration, or for a name a
     * mounted ToolBinding owns.
     */
    readonly direct?: boolean;
    /**
     * ASSEMBLY GAP 1 (2026-11-03) — OBSERVATION-ONLY mount.
     *
     * A binding may only be assigned to the native module that actually OWNS the
     * tool its identity names, and a module does not declare its tools: the only
     * honest source is what its `apply` registers. This flag mounts the module in
     * the CEILING partition behind a router that FORWARDS NOTHING and records the
     * names it would have registered (`a5sfRegistrationRouting.observed`). The
     * live registry is untouched (no tool/section is registered), the fibers are
     * NOT tracked by the realm (the caller disposes them), and the mount performs
     * no post-settle verification because it creates no shadow.
     *
     * Observe-only and normal mounts cannot be mixed in one call, and an
     * observe-only mount cannot name a binding identity (ownership is what the
     * observation is for).
     */
    readonly observeOnly?: boolean;
    /**
     * E8 (2026-11-03) — the composition's EXPECTED tool names for this module
     * (the row's `expectedTools` declaration, forwarded verbatim). The seam does
     * not enforce it (the row refuses an unshadowed declaration); it is carried
     * here only so an ACKNOWLEDGED empty frontier can record the declared names
     * (`NativeAttachRecord.acknowledgedNames`) instead of dropping them.
     */
    readonly expectedTools?: readonly string[];
    /**
     * E8 (2026-11-03) — the composition's EXPLICIT opt-out of the empty-frontier
     * refusal (the row's `allowEmpty`, forwarded verbatim). When such an entry
     * forwards NOTHING, the attach records `emptyFrontierAcknowledged: true`:
     * a DECLARED HAZARD, never a verification.
     */
    readonly allowEmpty?: boolean;
    /**
     * E8 (2026-11-03) — the ROW-CONFIG specifier this mount came from
     * (`a5sfNativeToolModules[].url`), forwarded verbatim so an accepted-empty
     * frontier can be traced to the configuration entry. Optional: a direct seam
     * caller may omit it.
     */
    readonly specifier?: string;
}
/**
 * Post-settle INVALIDATION event (assembly gap 2, 2026-11-03).
 *
 * A routed tool was found on a definition this attach did not create AFTER the
 * mount settled — a late service arrival, a hot update, or a fiber teardown
 * left it on the unshadowed preset path. The realm disposes every router fiber
 * it created (restoring the preset surface VISIBLY) and records this event.
 *
 * P0 (2026-11-03) — WHY DISPOSAL ALONE WAS A LEAK: once the shadow was gone the
 * already-running Member's next call resolved the PRESET definition and
 * executed with zero guard facts, i.e. a managed Member silently fell back to
 * unconstrained execution. `NoStaleShadow ≠ NoUnconfinedExecution`. While this
 * record is non-null the realm therefore DENIES every tool name the attach
 * covered at the existing `tools/pre-execute` admission stage (typed refusal,
 * naming the Member/realm/reason), and re-mounting is refused. Eligibility only
 * returns through a FULL re-assembly (a new realm mount + a new native attach)
 * that passes verification again.
 */
export interface NativeToolInvalidation {
    readonly schema: 'a5sf-native-invalidation/1';
    readonly reason: string;
    /** The managed (routed) tool names that are no longer shadowed by this attach. */
    readonly uncovered: readonly string[];
    /**
     * Tool names that APPEARED on the Member's model-visible surface after the
     * mount settled (S-1's measured `+30 ms new name escapes the surface gate`
     * hole). Non-empty even when no managed definition was lost: an unmanaged new
     * name is itself the surface change this seam must not accept silently.
     */
    readonly surfaceAdded: readonly string[];
    /** Tool names that DISAPPEARED from the Member surface after the mount settled. */
    readonly surfaceRemoved: readonly string[];
    /**
     * Managed tool names that were registered by a still-ACTIVE router fiber AFTER
     * the bounded settle window (a late `setTimeout`/IO callback), i.e. after the
     * attach had already accepted and accounted its shadow. They are folded into
     * the managed set first, so the admission deny covers them, and then the realm
     * invalidates: a post-settle registration is a surface this attach did not
     * verify, and accepting it silently was the `a5sf-s1` §3.2 time escape.
     */
    readonly lateRegistrations: readonly string[];
    readonly observedAt: string;
}
/**
 * P0 (2026-11-03): the stable machine-readable code carried by the admission
 * refusal's `error.info.code` while a realm's native shadow is invalidated AND
 * the dispatched tool name is one this attach covered.
 *
 * NAME-KEYED PRECEDENCE (E8, 2026-11-03): when the name is in the managed set
 * this SPECIFIC code wins over {@link A5SF_MEMBER_REALM_INVALIDATED}; it names
 * the tool, the Member and the realm that lost its shadow. The blanket code is
 * for every OTHER invocation while the realm is frozen.
 */
export declare const A5SF_NATIVE_SHADOW_INVALIDATED = "A5SF_NATIVE_SHADOW_INVALIDATED";
/**
 * E8 (2026-11-03): the stable machine-readable code carried by the admission
 * refusal when a Member's managed realm is INVALIDATED and the dispatched tool
 * name is NOT one this attach covered (including names the attach never saw).
 *
 * WHY A SEPARATE CODE: an invalidated realm refuses EVERY new tool invocation —
 * the boundary has failed, so nothing further executes until a full verified
 * re-assembly. That is a different fact from "this particular managed shadow is
 * gone" ({@link A5SF_NATIVE_SHADOW_INVALIDATED}), and a caller must be able to
 * tell them apart. The generic code says: the Member's realm is invalidated,
 * ALL calls are refused until re-assembly.
 */
export declare const A5SF_MEMBER_REALM_INVALIDATED = "A5SF_MEMBER_REALM_INVALIDATED";
/**
 * BL-17 (2026-11-04) — the refusal code for a `subprocess`-consuming native
 * module targeted at a realm that owns NO confined `subprocess` face.
 *
 * WHY IT EXISTS (the external review of Alpha.5): the confined process face is
 * mounted on the MEMBER realm only (`installMemberIoProviders`). The binding
 * realm installs a confined `fs` and NO `subprocess`; a binding-targeted module
 * that injects `subprocess` would therefore resolve the INHERITED, unconfined
 * base service with zero guard facts. That is the class of failure where a
 * proof obtained on one realm is silently wrong on another, so it is refused
 * HERE, at composition time, before any tool definition exists — never
 * documented as a known limitation.
 *
 * The string is the `TeamServiceInstallError.code` (the closed install
 * vocabulary's `SUBPROCESS_UNCONFINED_REALM`); the exported name is the token a
 * caller and a test compare against, so the refusal is typed rather than read
 * out of a message.
 */
export declare const A5SF_SUBPROCESS_UNCONFINED_REALM = "SUBPROCESS_UNCONFINED_REALM";
/**
 * BL-17 (2026-11-05) — 旧代 PTY 拒用: the refusal code for a
 * `terminals`-consuming native module targeted at a GOVERNED Member realm.
 *
 * WHY IT EXISTS: the native persistent `bash` module declares
 * `inject: ["tools","terminals"]` and opens its shell through
 * `ctx.terminals.spawn(owner, { type: backendType })`. No realm installs a
 * confined terminal face (P1-08's PTY port is still a test double), so such a
 * module mounted on a governed realm would resolve the INHERITED,
 * legacy-generation host `terminals` service: a persistent shell created
 * OUTSIDE the Member lane, with the policy consumed only at spawn time and a
 * domain that can outlive the revision it was opened under. That is refused
 * HERE, at composition time, before any fiber or tool definition exists — the
 * path is refused, not documented as unused.
 *
 * The string is the `TeamServiceInstallError.code` (the closed install
 * vocabulary's `TERMINALS_LEGACY_PTY_REFUSED`); the exported name is the token
 * a caller and a test compare against.
 */
export declare const A5SF_TERMINALS_LEGACY_PTY_REFUSED = "TERMINALS_LEGACY_PTY_REFUSED";
/**
 * BL-18 (P2-05) — the refusal code for a `web`-consuming native module targeted
 * at a realm that owns NO confined `web` face.
 *
 * WHY IT EXISTS: the native `web_fetch`/`web_search` row at the host pin is
 * upstream's `@deepseek-ai/dsh-tool-web`, whose `inject` is
 * `["tools","web","systemPrompt"]` and whose body is
 * `await ctx.web.fetch({ url }, signal)`. The confined `web` face is mounted on
 * the MEMBER realm only and only when the composition supplies one; a realm
 * with no web face would resolve the INHERITED host `ctx.web` (the real HTTP
 * provider, the process-wide proxy dispatcher) with zero guard facts — the same
 * silent widening BL-16/BL-17 refuse on the `subprocess`/`terminals` axes.
 * Refused HERE, at composition time, before any tool definition exists.
 *
 * The string is the `TeamServiceInstallError.code` (the closed install
 * vocabulary's `NETWORK_UNCONFINED_REALM`, already used by product-assembly for
 * the same concept at assembly time); the exported name is the token a caller
 * and a test compare against.
 */
export declare const A5SF_NETWORK_UNCONFINED_REALM = "NETWORK_UNCONFINED_REALM";
/**
 * E8 (2026-11-03): the ATTACH RECORD of a successful managed native attach.
 *
 * `allowEmpty: true` must never read as "verified safe". When a composition
 * accepts a module whose routed frontier is empty, the attach records that fact
 * here explicitly — it is a DECLARED HAZARD, not a verification: the row cannot
 * see what the preset plane serves for the name, so an acknowledged-empty entry
 * is a statement by the composition, not evidence from the seam.
 *
 * The record is published on the mounted realm (`nativeAttachRecord`) by the
 * successful `mountNativeToolModules` call and is `null` before any attach,
 * after a caller refusal (`disposeNativeToolModules`) and after `dispose()`.
 */
export interface NativeAttachRecord {
    readonly schema: 'a5sf-native-attach/1';
    /** Some accepted module had `allowEmpty: true` AND forwarded nothing. */
    readonly emptyFrontierAcknowledged: boolean;
    /** The module names whose empty frontier was acknowledged. */
    readonly emptyFrontierModules: readonly string[];
    /**
     * The ROW-CONFIG specifiers (`a5sfNativeToolModules[].url`) of the
     * acknowledged-empty entries. This is what an operator needs to trace the
     * acceptance back to the configuration line; a boolean alone cannot be
     * followed. Empty when the caller did not supply a specifier (a direct seam
     * call, not the product row).
     */
    readonly emptyFrontierSpecifiers: readonly string[];
    /**
     * The names the acknowledged-empty entries DECLARED through `expectedTools`.
     * They are recorded as ACKNOWLEDGED (unshadowed, unverified), never as
     * verified coverage. Empty when the acknowledged entries declared nothing —
     * which is the ordinary case, because a declared name that no fiber shadows
     * is refused unless the same entry also carries `allowEmpty: true`.
     */
    readonly acknowledgedNames: readonly string[];
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
    /**
     * EVERY tool name the module attempted to register through this fiber — the
     * union of `forwarded` and `dropped`. An observe-only mount reports its
     * ownership answer here (`forwarded` is empty: nothing was registered).
     */
    readonly observed: readonly string[];
    /**
     * Registration keys this fiber dropped because they belong to another fiber:
     * tool names, and `section:<name>` for the prompt sections it declined.
     */
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
    /**
     * BL-16: the confined `subprocess` face for this Member's isolated scope.
     * Omitted = none is mounted (default-preserving). Mounted on the SAME scope
     * the native route re-mounts into, so a `grep`/`glob` definition resolving
     * `ctx.subprocess` gets the confined provider.
     */
    readonly subprocess?: ConfinedSubprocessRealmSpec;
    /**
     * BL-18: the confined `web` face for this Member's isolated scope.
     * Omitted = none is mounted (default-preserving), and a `web`-consuming
     * native module is then refused at composition time — never silently served
     * by the inherited host `ctx.web`.
     */
    readonly web?: ConfinedWebRealmSpec;
    /**
     * PD-13: the confined `terminals` face for this Member's isolated scope.
     * Omitted = none is mounted (default-preserving), and a `terminals`-consuming
     * native module is then refused at composition time — never silently served
     * by the inherited, legacy-generation PTY service.
     */
    readonly terminal?: ConfinedTerminalRealmSpec;
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
     *
     * ASSEMBLY GAP 1 (2026-11-03): `options.scope` is the RESOLVED agent scope
     * key the caller already uses for its surface reads. It is REQUIRED to make
     * the post-settle re-verification able to ask `tools.get(name, scope)` which
     * definition the agent now resolves; without it the mount still works, but no
     * definition-identity verification can be scheduled (the caller must then
     * cover that itself — the product row always passes it).
     */
    mountNativeToolModules(modules: readonly NativeToolModuleMount[], options?: NativeToolModuleMountOptions): Promise<readonly Fiber[]>;
    /**
     * ASSEMBLY GAP 2 — the invalidation event recorded when a post-settle
     * re-verification found a routed tool back on an unshadowed definition.
     * `null` while the mount is healthy (or before anything was mounted).
     */
    readonly nativeInvalidation: NativeToolInvalidation | null;
    /**
     * E8 (2026-11-03) — the record of the LAST successful managed attach.
     *
     * LIFECYCLE (corrected 2026-11-04, review #1 C1 — the previous text described
     * a field the code does not produce):
     * - `null` before any attach, and after an attach that was ROLLED BACK
     *   (refused at verification) or abandoned by the caller's own refusal while
     *   the realm was HEALTHY (`disposeNativeToolModules`).
     * - NON-NULL while the realm is invalidated, INCLUDING after
     *   `disposeNativeToolModules()` on that path: that method does not clear it,
     *   because the record describes the attach that WAS verified and then
     *   invalidated, and `nativeInvalidation` is the live signal beside it.
     * - `dispose()` does not clear it either. The realm object is unassembled
     *   after that call; a reader still holding the object gets the last attach's
     *   record and the invalidation record.
     *
     * It exists so an acknowledged empty frontier (`allowEmpty: true`) is an
     * EXPLICIT fact on the assembly record instead of a silence that reads like
     * a verification.
     */
    readonly nativeAttachRecord: NativeAttachRecord | null;
    /**
     * Resolves once the bounded post-settle re-verification rounds have run (or
     * an invalidation fired and its teardown settled). Diagnostics/tests only.
     */
    whenNativeVerificationSettled(): Promise<void>;
    /**
     * The caller's OWN refusal/abandonment of a successful attach (surface or
     * coverage gate): detach verification, dispose every router fiber, clear the
     * tracked set, and do NOT record an invalidation (the caller reports the
     * refusal). Unlike an invalidation this leaves a later attach possible.
     */
    disposeNativeToolModules(): Promise<void>;
    dispose(): Promise<void>;
}
/** Options for {@link MountedA5sfRealm.mountNativeToolModules}. */
export interface NativeToolModuleMountOptions {
    /** The resolved agent scope key (`runtimeAgent ?? scopeOf(root)`). */
    readonly scope?: unknown;
}
/**
 * Mount one Member's compiled realm (ceiling + zero or more binding realms).
 * Consumes compiled objects only; refuses nothing of its own — every refusal
 * is the owning installer's typed `TeamServiceInstallError`.
 */
export declare function mountA5sfRealm(input: MountA5sfRealmInput): Promise<MountedA5sfRealm>;
//# sourceMappingURL=mount.d.ts.map