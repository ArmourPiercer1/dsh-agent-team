/**
 * Alpha.5 PRODUCT ASSEMBLY — the product-visible declaration that gives a
 * Member its compiled realm.
 *
 * THE GAP THIS CLOSES (external Alpha.5 review, 2026-11-05): the confined
 * Member realm (`installMemberIoProviders` / `mountA5sfRealm` /
 * `installToolBindingRealm`) was exercised by EVIDENCE ROWS and test presets,
 * but a product-configured Member never got it. The only enablement the
 * product row understood was `config.a5sfEvidencePath` (an evidence SINK) plus
 * a `teamA5sfRealm` service that no product code provided, so a World composed
 * from the acceptance preset alone gave no agent a confined face. This module
 * is the missing product half: a DECLARATION in the product row config that a
 * Member's configuration declares a Member ceiling and/or ToolBindings, and
 * the SAME seams the evidence row uses are driven from it.
 *
 * WHAT IS A DECLARATION, AND WHAT IS NOT.
 *   - It is authored in the CLOSED v4 vocabulary already in the product:
 *     `memberIoCeilings[].io` (the Member ceiling) and a `toolBindings[]`
 *     entry's `io` + `execution` block (the ToolRestriction). No new grammar,
 *     no new lane shape, no second validator: the declaration is turned into a
 *     v4 Blueprint SOURCE and parsed by the ONE shipped parser
 *     (`parseBlueprintV4`), then compiled by the ONE shipped compiler
 *     (`compileMemberPolicy` / `projectToolIoRestriction` /
 *     `compileEffectiveIo`).
 *   - It is NOT an approval authority and NOT a grant. `authority` is the
 *     composition's REFERENCE to the Alpha.4 effective authority already
 *     computed by the ONE approval authority (ControlService): this module
 *     never evaluates an approval, never mints a case and never widens a lane.
 *     `approvedOnce` is passed as `false` at binding compile time — approval is
 *     irrelevant to a hard ceiling.
 *   - It is NOT a hidden switch. A Member is managed iff its TEMPLATE has a
 *     declaration here; a template without one answers `undefined` from
 *     `compiledFor` and the product row mounts nothing (byte-identical legacy
 *     path — no provider mount, no fact, no tool-plane change).
 *
 * FAIL CLOSED — the faces this realm does NOT own refuse at composition time
 * with the SAME `TeamServiceInstallError` idiom the seams already use:
 *   - a ToolBinding whose `execution.executionBoundary` is
 *     `confined-subprocess` asks for a binding-scoped PROCESS face; the
 *     binding realm owns `fs` only (measured `UNSUPPORTED` by the search live
 *     round) -> `SUBPROCESS_UNCONFINED_REALM` (BL-17's code, reused verbatim);
 *   - `delegated-remote` asks for a remote face this realm does not own ->
 *     `NETWORK_UNCONFINED_REALM`;
 *   - a ceiling or restriction that NARROWS the network axis (`deny`) cannot be
 *     enforced because no web face is installed on the realm -> the same
 *     `NETWORK_UNCONFINED_REALM`; `network: restricted` is refused by the
 *     compiler (`IO_POLICY_UNSUPPORTED`) and surfaces as
 *     `MEMBER_POLICY_UNAVAILABLE` with the compiler's own code in the detail;
 *   - a malformed/ambiguous declaration -> `REALM_DECLARATION_INVALID`;
 *   - a ToolBinding authorization outside the closed v4 vocabulary, or an
 *     `authorization: deny` the realm cannot honour -> `REALM_DECLARATION_INVALID`
 *     (B3: `deny` is refused, never mounted as decoration, because dropping the
 *     binding would leave the tool on the wider base/ceiling surface);
 *   - a declared ceiling that exceeds the row's OWN bound blueprint ->
 *     `REALM_DECLARATION_EXCEEDS_BLUEPRINT` (B2: a row-config edit may not widen
 *     the ceiling without a new blueprint/authority revision).
 * A declaration that cannot be expressed is REFUSED, never silently mounted
 * as a narrower answer.
 *
 * ONE COMPUTATION, DECLARED IS THE EXCEPTION (policy-source fix, 2026-11-05).
 *   The external review's remaining finding was that `a5sfMemberPolicies` let a
 *   row-config author write permission facts that should be DERIVED, and the
 *   blueprint anchor was OPTIONAL — so a product row could assemble a Member
 *   ceiling no blueprint ever saw. Now:
 *     - DERIVATION IS THE PRODUCT PATH. {@link deriveProductRealmDeclaration} /
 *       {@link deriveProductRealmPlan} read the resolved `memberIoCeilings`
 *       family out of the row's own `config.blueprintSource` and produce the
 *       SAME declaration shape; a row may set `a5sfMemberAuthority`
 *       ({@link A5SF_MEMBER_AUTHORITY_KEY}) and carry NO `a5sfMemberPolicies`
 *       at all.
 *     - DECLARATION IS THE EXCEPTION. `config.blueprintSource` is now REQUIRED
 *       whenever `a5sfMemberPolicies` is present; it must parse, resolve to the
 *       declared team AND revision, and declare a ceiling for every declared
 *       template. Otherwise assembly refuses `MEMBER_POLICY_WITHOUT_BLUEPRINT`.
 *     - THE DECLARED CEILINGS ARE CHECKED AGAINST THE DERIVED ONES (not against
 *       a re-implementation): the reconciliation feeds the bound blueprint
 *       through the SAME `deriveProductRealmDeclaration`, then requires every
 *       declared lane to be inside the derived lane. Wider ⇒
 *       `REALM_DECLARATION_EXCEEDS_BLUEPRINT`; strictly narrower is accepted as
 *       an explicitly typed residual (`declaration-narrows-bound-blueprint`),
 *       never as a silent second truth.
 *   `instanceGeneration` is still a caller-supplied number (no TeamDomain row is
 *   read at assembly), so every plan carries the typed residual
 *   `instance-generation-declared-not-bound` instead of pretending it is bound.
 *
 * WHAT IS DELIBERATELY NOT REACHABLE FROM PRODUCT CONFIG (stated, not faked):
 * the confined `subprocess` face needs a `ConfinedProcessProvider` built by
 * the composition that owns the P1-07 launcher pin. Product CONFIG cannot name
 * a launcher/binary assembly, so the product declaration cannot request a
 * process face — that half stays evidence-only until a product composition
 * ships the provider. `REALM_DECLARATION_INVALID`/`SUBPROCESS_UNCONFINED_REALM`
 * name the absence instead of pretending.
 *
 * @module @dsh-agent-team/runtime/team-services/product-assembly
 */
import { parseBlueprint, type TeamBlueprintV4, type V4MemberIoCeilingAuthoring, type V4ToolBindingAuthoring } from '../../../domain/blueprint/src/index.js';
import type { ToolIoRestriction } from '../../member-io-policy/src/types.js';
import type { A5sfRealmBinding, A5sfRealmMember } from './mount.js';
/**
 * The row-config key that carries the product declaration.
 *
 * KEPT IN THIS MODULE (not only in the plain-JS row) so the product type
 * surface, the parser and the tests all name the SAME token: a key that only
 * lived in an `.mjs` row would be re-typed by every reader.
 */
export declare const A5SF_MEMBER_POLICIES_KEY = "a5sfMemberPolicies";
/** The declaration schema token, versioned like every other seam in this lane. */
export declare const A5SF_PRODUCT_REALM_SCHEMA: "a5sf-product-member-policies/1";
/**
 * The row-config key that carries the authority REFERENCE for the DERIVED
 * product path (policy-source fix, 2026-11-05).
 *
 * A row may carry this key and NO `a5sfMemberPolicies`: the Member ceilings are
 * then derived from `config.blueprintSource`'s `memberIoCeilings` family and
 * this key supplies only the Alpha.4 authority reference the compiler consumes
 * verbatim. Shape: `{ revision: <non-blank string>, admitted: <boolean> }`.
 *
 * It is NOT a permission fact: it cannot widen, narrow or replace a derived
 * ceiling. Supplying it together with `a5sfMemberPolicies` is allowed (the
 * declaration is then checked against the derived policy and its own authority
 * reference must agree with this one).
 */
export declare const A5SF_MEMBER_AUTHORITY_KEY = "a5sfMemberAuthority";
/**
 * The NEUTRAL enablement key of the governed Member realm (2026-11-11,
 * owner-ruled governed preset).
 *
 * WHAT IT IS: a boolean marker that says "the COMPOSITION'S `teamA5sfRealm`
 * provider is this row's compiled-realm source; the row config compiles
 * nothing". It carries NO policy, NO blueprint path, NO authority reference and
 * NO machine path, so the machine-agnostic shipped layer can carry it — and it
 * cannot fork the compiler: the row has no `memberPolicies` to fork WITH.
 *
 * WHY IT EXISTS (measured, `a5sf-face-decl-impact` §6.3): before this key the
 * only enablement that did not set `config.memberPolicies` was
 * `a5sfEvidencePath` — an evidence FILE PATH, which the shipped layer's own
 * header forbids. `a5sfMemberPolicies` and `a5sfMemberAuthority` both set
 * `memberPolicies`, and a row carrying a declaration AND a provided
 * `teamA5sfRealm` service is the "two compiled-realm sources" fork the mount
 * refuses. This key is the third, non-forking option.
 *
 * WHAT IT IS NOT: it is not a permission grant and not an authority reference.
 * The provider behind it is responsible for compiling from the REAL Team facts
 * (bound blueprint + Alpha.4 authority + the actual Member identity/generation)
 * through the ONE product compiler; this module never sees those values. A row
 * that sets this key and combines it with `a5sfMemberPolicies` or
 * `a5sfMemberAuthority` is refused as the same two-source fork, because the row
 * would then compile a plan the provider also claims.
 *
 * The key is `true` or absent. `false` is refused rather than read as "absent",
 * so a half-written opt-out can never look like a clean default.
 */
export declare const A5SF_GOVERNED_REALM_KEY = "a5sfGovernedRealm";
/**
 * The residual facts an assembly plan states about what it could NOT bind
 * (policy-source fix, 2026-11-05).
 *
 * A plan that silently carried a field it did not reconcile would "look bound".
 * These tokens say which parts are declared/caller-supplied instead:
 *   - `instance-generation-declared-not-bound`: the generation on every Member
 *     comes from config/caller, never from a live MemberInstance row (no
 *     TeamDomain is read at assembly time).
 *   - `declaration-narrows-bound-blueprint`: the explicit declaration is
 *     STRICTLY narrower than the blueprint-derived ceiling on at least one
 *     axis. Allowed (narrowing cannot widen authority) but named, so a
 *     declaration can never pass as "the blueprint" without saying so.
 *   - `blueprint-tool-bindings-not-member-scoped`: the bound blueprint declares
 *     a Team-scoped `toolBindings` family, which v4 gives NO MemberTemplate
 *     association; the derived declaration therefore derives CEILINGS only and
 *     does not invent a per-Member binding. A composition that needs per-Member
 *     tool-binding realms still declares `a5sfMemberPolicies` (then reconciled).
 */
export declare const A5SF_PRODUCT_ASSEMBLY_RESIDUALS: readonly ["instance-generation-declared-not-bound", "declaration-narrows-bound-blueprint", "blueprint-tool-bindings-not-member-scoped"];
export type A5sfProductAssemblyResidual = (typeof A5SF_PRODUCT_ASSEMBLY_RESIDUALS)[number];
/** Which input produced the plan: the declared EXCEPTION or the derived path. */
export type A5sfProductRealmSource = 'declared' | 'derived';
/**
 * ONE product-declared Member template.
 *
 * `ceiling` is the EXACT v4 `memberIoCeilings[].io` block (read/write/network
 * lanes, same closed shape) and `toolRestrictions` entries are the EXACT v4
 * `toolBindings[]` entry shape. Nothing here is a Team-Team-local dialect.
 */
export interface A5sfProductMemberDeclaration {
    /** The template this declaration manages (the MemberInstance's template). */
    readonly templateId: string;
    /**
     * The instance generation this ceiling is compiled for.
     *
     * DECLARED-NOT-BOUND (B5): it is a row-config number, not a generation read
     * from the live MemberInstance row, so `MEMBER_GENERATION_STALE` can only
     * compare it with what the caller passes — never with the host's truth.
     */
    readonly instanceGeneration: number;
    /** The Member ceiling, in the v4 `memberIoCeilings[].io` shape. */
    readonly ceiling: V4MemberIoCeilingAuthoring['io'];
    /**
     * Zero or more per-tool restrictions (the RIGHT factor of the invariant),
     * in the v4 `toolBindings[]` entry shape — INCLUDING `execution`, whose
     * `executionBoundary` tells this assembler which face must serve the tool.
     */
    readonly toolRestrictions?: readonly V4ToolBindingAuthoring[];
}
/**
 * The product declaration a composition puts in the Team row config:
 *
 * ```yaml
 * a5sfMemberPolicies:
 *   schema: a5sf-product-member-policies/1
 *   teamId: team.a5sf.product
 *   blueprintRevision: '1'
 *   authority: { revision: 'a4:42', admitted: true }
 *   members:
 *     - templateId: worker
 *       instanceGeneration: 1
 *       ceiling:
 *         read:  { mode: restricted, allow: ['/work'], ask: [], deny: [] }
 *         write: { mode: restricted, allow: ['/work'], ask: [], deny: [] }
 *         network: { mode: allow }
 *       toolRestrictions:
 *         - owner: dsh.fs
 *           name: read
 *           authorization: ask
 *           io:
 *             read:  { mode: restricted, allow: ['/work/docs'], ask: [], deny: [] }
 *             write: { mode: all, deny: [] }
 *             network: { mode: allow }
 *           execution: { implementationOrigin: dsh-native, executionBoundary: trusted-host }
 * ```
 *
 * A template absent from `members` is UNMANAGED: no realm, no facts, no tool
 * surface change.
 */
export interface A5sfProductRealmDeclaration {
    readonly schema: typeof A5SF_PRODUCT_REALM_SCHEMA;
    /**
     * The Team this declaration manages.
     *
     * RECONCILED, NOT MERELY DECLARED (policy-source fix, 2026-11-05): the
     * declaration may only exist when `config.blueprintSource` resolves to the
     * SAME `blueprintId`, so a wrong team id is now a typed refusal
     * (`MEMBER_POLICY_WITHOUT_BLUEPRINT`) instead of an unchecked claim.
     */
    readonly teamId: string;
    /**
     * The bound blueprint's human revision.
     *
     * RECONCILED (policy-source fix, 2026-11-05): this string must equal the
     * resolved blueprint's `revision`; a mismatch means the declaration is not a
     * statement ABOUT that blueprint and assembly refuses
     * `MEMBER_POLICY_WITHOUT_BLUEPRINT`. The derived path sets it from the
     * blueprint itself, so a product config omitting `a5sfMemberPolicies` cannot
     * get this wrong.
     */
    readonly blueprintRevision: string;
    /**
     * The composition's REFERENCE to the Alpha.4 effective authority. Consumed
     * verbatim as the compiler's `effectiveAuthority`; this module never
     * evaluates an approval and cannot widen a ceiling from it.
     */
    readonly authority: Readonly<{
        readonly revision: string;
        readonly admitted: boolean;
    }>;
    readonly members: readonly A5sfProductMemberDeclaration[];
}
/**
 * Parse context: the row's bound blueprint, which is now REQUIRED.
 *
 * WHY IT IS REQUIRED (policy-source fix, 2026-11-05): the declaration embeds a
 * ceiling family, and `config.blueprintSource` is the Team's authority-bearing
 * blueprint. When the anchor was OPTIONAL, a product row could assemble a
 * Member ceiling no blueprint ever saw — two independently editable statements
 * of the same truth. The declaration is now the EXCEPTION path: it may only
 * narrow the ceiling the blueprint declares, so assembly refuses
 * `MEMBER_POLICY_WITHOUT_BLUEPRINT` when the source is absent, blank,
 * unparseable, a different team, a different revision, or declares no
 * `memberIoCeilings` family.
 *
 * The declared ceilings are reconciled against the SAME derived declaration the
 * derived path produces ({@link deriveProductRealmDeclaration}) — one
 * computation, not two. Wider ⇒ `REALM_DECLARATION_EXCEEDS_BLUEPRINT`;
 * strictly narrower is accepted and named as a residual.
 */
export interface A5sfProductRealmParseContext {
    /**
     * The row's `config.blueprintSource` (a non-blank string; required unless
     * `boundBlueprint` supplies the ALREADY-RESOLVED blueprint).
     */
    readonly blueprintSource?: string;
    /**
     * The Team's ALREADY-RESOLVED bound blueprint (2026-11-11, governed preset).
     *
     * WHY: a booted Host resolves the Team's bound blueprint through the BP-F
     * three-case resolver (`resolveBoundBlueprint(teamRootSessionId)`), which is
     * the ONE authority-bearing read (a bound ref resolves through the live
     * authority and never the row anchor). Re-parsing `config.blueprintSource`
     * would be a SECOND resolution of the same fact and could disagree with the
     * blueprint the Team is actually bound to. Supplying the resolved object here
     * keeps resolution single-source while the VALIDATION and COMPILATION below
     * stay the same ONE parser/compiler — this is not a second path, it is the
     * same path with its input handed in.
     *
     * A caller that supplies neither refuses `MEMBER_POLICY_WITHOUT_BLUEPRINT`
     * exactly as before.
     */
    readonly boundBlueprint?: ReturnType<typeof parseBlueprint>;
    /**
     * Provenance marker, INTERNAL to the assembly: `derived` is set only by
     * {@link deriveProductRealmPlan}. It changes no permission fact — the same
     * parser, validator and reconciliation run either way.
     */
    readonly source?: A5sfProductRealmSource;
}
/** One managed template, already validated and projected by the ONE lane. */
export interface A5sfProductManagedMember {
    readonly templateId: string;
    readonly instanceGeneration: number;
    /** Already projected by `projectToolIoRestriction` (never re-derived here). */
    readonly restrictions: readonly ToolIoRestriction[];
}
/**
 * The VALIDATED composition plan: a real v4 blueprint (ceiling family included)
 * plus the projected restrictions. Produced once by
 * {@link parseProductRealmDeclaration} at row-assembly time, so a malformed or
 * unexpressible declaration refuses BEFORE any Member is set up.
 */
export interface A5sfProductRealmPlan {
    readonly schema: typeof A5SF_PRODUCT_REALM_SCHEMA;
    readonly teamId: string;
    readonly authority: Readonly<{
        readonly revision: string;
        readonly admitted: boolean;
    }>;
    readonly blueprint: TeamBlueprintV4;
    readonly members: readonly A5sfProductManagedMember[];
    /**
     * What produced this plan and what it could NOT bind. Always present, so a
     * caller can never mistake a caller-supplied generation (or a narrowing
     * declaration) for a fact read from the live Team.
     */
    readonly provenance: Readonly<{
        readonly source: A5sfProductRealmSource;
        readonly residuals: readonly A5sfProductAssemblyResidual[];
    }>;
}
/**
 * Input of the DERIVED product path: the resolved blueprint + the authority
 * reference, plus the caller-supplied instance generations (there is no
 * TeamDomain read at assembly time).
 */
export interface A5sfDerivedRealmInput {
    /** The row's own `config.blueprintSource` (the authority-bearing blueprint). */
    readonly blueprintSource: string;
    /** The Alpha.4 authority reference, consumed verbatim (never evaluated here). */
    readonly authority: Readonly<{
        readonly revision: string;
        readonly admitted: boolean;
    }>;
    /**
     * Member instance generation per templateId. OPTIONAL: an absent entry is
     * `0` and the plan always carries
     * `instance-generation-declared-not-bound`, so the value never pretends to be
     * read from the live MemberInstance row.
     */
    readonly instanceGenerations?: Readonly<Record<string, number>>;
    /**
     * Optional subset of blueprint templates to derive for. Absent = every
     * `memberIoCeilings` entry except the blueprint's own leader template (the
     * leader is not a Member and is never given a Member ceiling).
     */
    readonly templateIds?: readonly string[];
}
/** The lazy provider answer the product row consumes (`compiledFor`). */
export interface A5sfProductRealmProvider {
    compiledFor(member: unknown): A5sfProductCompiledAnswer | undefined;
}
export interface A5sfProductCompiledAnswer {
    readonly members: readonly A5sfRealmMember[];
    readonly bindings?: readonly A5sfRealmBinding[];
    readonly providerClass?: unknown;
}
/**
 * DERIVE the assembly declaration from a resolved blueprint source.
 *
 * THE PRODUCT PATH (policy-source fix, 2026-11-05): a row that sets
 * `a5sfMemberAuthority` and omits `a5sfMemberPolicies` gets its Member ceilings
 * from the blueprint's own `memberIoCeilings` family, so there is exactly ONE
 * editable statement of the permission facts. `teamId`/`blueprintRevision` are
 * read from the blueprint itself, never re-typed by an author.
 *
 * What it does NOT derive, stated instead of invented: v4 `toolBindings` are
 * Team-scoped and carry no MemberTemplate association, so the derived
 * declaration derives CEILINGS only; `A5SF_PRODUCT_ASSEMBLY_RESIDUALS` names
 * that when the bound blueprint declares such a family. `instanceGeneration`
 * has no blueprint/TeamDomain source at assembly time, so it is the
 * caller-supplied `instanceGenerations` map (default `0`) and the plan carries
 * the typed `instance-generation-declared-not-bound` residual.
 */
export declare function deriveProductRealmDeclaration(input: A5sfDerivedRealmInput): A5sfProductRealmDeclaration;
/**
 * Parse + validate a product declaration into a composition plan.
 *
 * THE BLUEPRINT IS REQUIRED (policy-source fix, 2026-11-05): a declaration is
 * only the EXCEPTION path, so `context.blueprintSource` must resolve to a
 * blueprint for the SAME team and revision with a `memberIoCeilings` family.
 * Absent/blank/unparseable/other-team/other-revision ⇒
 * `MEMBER_POLICY_WITHOUT_BLUEPRINT`.
 *
 * REFUSES (typed, before any Member is set up):
 *   - no resolvable blueprint (`MEMBER_POLICY_WITHOUT_BLUEPRINT`);
 *   - a non-record / wrong schema / unknown or missing field;
 *   - a blank team id or blueprint revision, a bad authority reference;
 *   - an empty Member list, a duplicate template, the reserved scaffold id;
 *   - any ceiling the shipped v4 validator refuses, and any restriction entry
 *     the shipped v4 `toolBindings` grammar refuses (B4) plus a `deny`
 *     authorization the realm cannot honour (B3);
 *   - any ToolBinding whose face this realm does not own
 *     (`SUBPROCESS_UNCONFINED_REALM` / `NETWORK_UNCONFINED_REALM`) or whose
 *     lanes cannot project (`MEMBER_POLICY_UNAVAILABLE`);
 *   - a ceiling that exceeds the DERIVED ceiling from the row's own bound
 *     blueprint (`REALM_DECLARATION_EXCEEDS_BLUEPRINT`).
 */
export declare function parseProductRealmDeclaration(raw: unknown, context: A5sfProductRealmParseContext): A5sfProductRealmPlan;
/**
 * DERIVED plan: the row path that carries NO `a5sfMemberPolicies`.
 *
 * The derived declaration is handed to {@link parseProductRealmDeclaration}, so
 * validation, reconciliation and compilation are the SAME computation the
 * declared path runs; `source: 'derived'` only records where the input came
 * from and changes no permission fact.
 */
export declare function deriveProductRealmPlan(input: A5sfDerivedRealmInput): A5sfProductRealmPlan;
/** Input of the governed product path: an ALREADY-RESOLVED bound blueprint. */
export interface A5sfBoundBlueprintRealmInput {
    /**
     * The Team's bound blueprint, resolved by the Host's ONE resolver
     * (`resolveBoundBlueprint(teamRootSessionId)`) — never re-parsed from a row
     * source and never re-typed by a config author.
     */
    readonly blueprint: ReturnType<typeof parseBlueprint>;
    /**
     * The Alpha.4 authority reference the provider read from the LIVE authority
     * (durable generation + durable admission), consumed verbatim. This module
     * never evaluates an approval and cannot widen a ceiling from it.
     */
    readonly authority: Readonly<{
        readonly revision: string;
        readonly admitted: boolean;
    }>;
    /**
     * Member instance generation per templateId, read from the SAME live
     * authority the reference came from. Absent => `0`, and the plan keeps the
     * `instance-generation-declared-not-bound` residual (the assembly itself
     * still reads no TeamDomain row).
     */
    readonly instanceGenerations?: Readonly<Record<string, number>>;
    /** Optional subset of blueprint templates; absent = every ceiling but the leader's. */
    readonly templateIds?: readonly string[];
}
/**
 * The GOVERNED product path: derive + compile from an ALREADY-RESOLVED bound
 * blueprint (2026-11-11 owner-ruled governed preset).
 *
 * WHY IT EXISTS: the shipped governed provider is built by a booted Host, which
 * resolves the Team's bound blueprint through its ONE resolver and reads the
 * live Alpha.4 authority per Member. Re-parsing a config `blueprintSource` in
 * the provider would either duplicate that fact (a second statement of the
 * Team's blueprint) or silently replace a bound ref with a row anchor. This
 * entry point hands the resolved object in and runs the SAME computation
 * `deriveProductRealmPlan` runs: `declarationFromBoundBlueprint` ->
 * `parseProductRealmDeclaration` (ONE parser, ONE compiler, ONE reconciliation).
 * It composes no lane of its own.
 */
export declare function deriveProductRealmPlanFromBlueprint(input: A5sfBoundBlueprintRealmInput): A5sfProductRealmPlan;
/**
 * Build the lazy `{ compiledFor }` provider from a validated plan.
 *
 * The provider is the SAME shape the evidence row supplies to
 * `teamA5sfRealm`; the only difference is its SOURCE (product config instead of
 * a fixture). Every returned object is compiled by the ONE compiler; nothing
 * here decides a lane.
 *
 * A template with no declaration answers `undefined` — that Member is
 * UNMANAGED and the row mounts nothing (requirement: unmanaged Members stay
 * byte-identical).
 */
export declare function createProductRealmProvider(plan: A5sfProductRealmPlan): A5sfProductRealmProvider;
//# sourceMappingURL=product-assembly.d.ts.map