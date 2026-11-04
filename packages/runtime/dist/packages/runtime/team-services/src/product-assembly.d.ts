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
import { type TeamBlueprintV4, type V4MemberIoCeilingAuthoring, type V4ToolBindingAuthoring } from '../../../domain/blueprint/src/index.js';
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
     * DECLARED, NOT BOUND (review finding B5, 2026-11-05): the compiler's
     * `trustedMember.teamId` is this row-config value. It is NOT read back from
     * the live TeamDomain, so a stale/wrong team id is not detected here — the
     * one thing the row CAN check is the bound blueprint (see
     * {@link A5sfProductRealmParseContext}); when `config.blueprintSource`
     * parses to a different team, reconciliation is skipped by the owner ruling
     * and this value stays purely declared.
     */
    readonly teamId: string;
    /** The human revision stamped into the synthetic v4 document's identity. */
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
 * Optional parse context: the row's OWN boot anchor, when it has one.
 *
 * WHY IT EXISTS (review finding B2, coordinator ruling 2026-11-05): the
 * declaration embeds a ceiling family, but `config.blueprintSource` is the
 * Team's authority-bearing blueprint and the Alpha.4 authority revision is
 * keyed to it. Without a reconciliation, a row-config edit could widen a
 * ceiling the blueprint declares WITHOUT an authority revision. This guard
 * makes that disagreement unrepresentable: when `blueprintSource` parses to the
 * SAME team as the declaration, every declared ceiling must be a NARROWING of
 * `memberIoCeilings[template]` on all three axes, or assembly refuses
 * `REALM_DECLARATION_EXCEEDS_BLUEPRINT`.
 *
 * BOTH FORMS KEEP WORKING: no `blueprintSource` (host-free tests, a row that
 * only carries the declaration) skips the guard; a `blueprintSource` for a
 * DIFFERENT team is not the same Team's authority and is skipped (the ruling's
 * scope). The guard is a static pre-mount check, not a second evaluator: it
 * reads the shipped v4 document through the shipped `parseBlueprint` and the
 * shipped locator algebra.
 */
export interface A5sfProductRealmParseContext {
    /** The row's `config.blueprintSource`, when present (a non-blank string). */
    readonly blueprintSource?: string;
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
 * Parse + validate a product declaration into a composition plan.
 *
 * REFUSES (typed, before any Member is set up):
 *   - a non-record / wrong schema / unknown or missing field;
 *   - a blank team id or blueprint revision, a bad authority reference;
 *   - an empty Member list, a duplicate template, the reserved scaffold id;
 *   - any ceiling the shipped v4 validator refuses, and any restriction entry
 *     the shipped v4 `toolBindings` grammar refuses (B4) plus a `deny`
 *     authorization the realm cannot honour (B3);
 *   - any ToolBinding whose face this realm does not own
 *     (`SUBPROCESS_UNCONFINED_REALM` / `NETWORK_UNCONFINED_REALM`) or whose
 *     lanes cannot project (`MEMBER_POLICY_UNAVAILABLE`);
 *   - a ceiling that exceeds the row's own bound blueprint
 *     (`REALM_DECLARATION_EXCEEDS_BLUEPRINT`, B2).
 */
export declare function parseProductRealmDeclaration(raw: unknown, context?: A5sfProductRealmParseContext): A5sfProductRealmPlan;
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