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
import { BLUEPRINT_V4_AUTHORIZATIONS, parseBlueprint, parseBlueprintV4, } from '../../../domain/blueprint/src/index.js';
import { compileEffectiveIo, compileMemberPolicy, laneWithinLane, projectToolIoRestriction, toPathRuleSet, } from '../../member-io-policy/src/index.js';
import { TeamServiceInstallError } from './types.js';
/**
 * The row-config key that carries the product declaration.
 *
 * KEPT IN THIS MODULE (not only in the plain-JS row) so the product type
 * surface, the parser and the tests all name the SAME token: a key that only
 * lived in an `.mjs` row would be re-typed by every reader.
 */
export const A5SF_MEMBER_POLICIES_KEY = 'a5sfMemberPolicies';
/** The declaration schema token, versioned like every other seam in this lane. */
export const A5SF_PRODUCT_REALM_SCHEMA = 'a5sf-product-member-policies/1';
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
export const A5SF_MEMBER_AUTHORITY_KEY = 'a5sfMemberAuthority';
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
export const A5SF_GOVERNED_REALM_KEY = 'a5sfGovernedRealm';
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
export const A5SF_PRODUCT_ASSEMBLY_RESIDUALS = [
    'instance-generation-declared-not-bound',
    'declaration-narrows-bound-blueprint',
    'blueprint-tool-bindings-not-member-scoped',
];
/** The reserved scaffold leader template id (never a declared Member template). */
const SCAFFOLD_LEADER_TEMPLATE = 'a5sf-product-scaffold-leader';
const DECLARATION_KEYS = ['schema', 'teamId', 'blueprintRevision', 'authority', 'members'];
const AUTHORITY_KEYS = ['revision', 'admitted'];
const MEMBER_KEYS = ['templateId', 'instanceGeneration', 'ceiling', 'toolRestrictions'];
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function refuse(code, detail, path) {
    throw new TeamServiceInstallError(code, detail, path);
}
/** Unknown-key / missing-key gate for the closed declaration shapes. */
function closedRecord(raw, allowed, where, required = allowed) {
    if (!isRecord(raw))
        refuse('REALM_DECLARATION_INVALID', `${where} must be a record`, where);
    const unknown = Object.keys(raw).filter((key) => !allowed.includes(key));
    if (unknown.length > 0) {
        refuse('REALM_DECLARATION_INVALID', `${where} carries field(s) ${JSON.stringify(unknown)} outside the closed shape ${JSON.stringify(allowed)}; a typo must never silently declare nothing`, where);
    }
    const missing = required.filter((key) => !Object.hasOwn(raw, key));
    if (missing.length > 0) {
        refuse('REALM_DECLARATION_INVALID', `${where} is missing required field(s) ${JSON.stringify(missing)}`, where);
    }
    return raw;
}
/**
 * The synthetic v4 document SOURCE the ONE parser accepts.
 *
 * WHY SYNTHETIC: the declaration is a per-Member SUBSET of a Team blueprint
 * (identity + the ceiling family + the binding family). The compiler consumes a
 * real `TeamBlueprintV4`, and the lane's law is "never a second validator", so
 * the declaration is expanded into a minimal, VALID v4 document — one scaffold
 * leader template plus one Member template per declaration — and handed to
 * `parseBlueprintV4`. Every lane/grammar problem is therefore found by the
 * SHIPPED v4 validator at its own path, and the resulting `contentHash` is the
 * real content identity of exactly the declared ceilings AND bindings.
 *
 * WHY THE BINDINGS ARE IN THE DOCUMENT (review findings B4 + B8, 2026-11-05):
 * before this, only the ceiling family passed through `parseBlueprintV4`, so a
 * restriction's `authorization`/`implementationOrigin` enums and locator shapes
 * were never validated by the shipped grammar (a bogus origin was accepted, an
 * object-shaped `allow` silently projected to deny-all), and the content hash
 * — which is an input to the Member policy `revision` — did not cover the
 * restrictions at all, so editing a restriction changed no revision. Emitting
 * them as the real `toolBindings` family fixes both with the SAME tables the
 * blueprint grammar uses: a bogus enum / malformed lane is refused by the
 * shipped validator, and two declarations differing only in a restriction hash
 * differently (hence a different `MemberPolicy.revision`, hence a different
 * effective policy generation).
 *
 * The scaffold leader is NOT a managed Member: the row never mounts a realm for
 * the leader session (`sessionId !== teamRoot`), and a declaration may not use
 * the reserved id.
 */
function blueprintSourceOf(declaration) {
    const bindings = [];
    for (const member of declaration.members) {
        bindings.push(...(member.toolRestrictions ?? []));
    }
    const document = {
        schemaVersion: 4,
        blueprintId: declaration.teamId,
        revision: declaration.blueprintRevision,
        leader: { templateId: SCAFFOLD_LEADER_TEMPLATE, persona: 'Product assembly scaffold (not a managed Member).' },
        members: declaration.members.map((member) => ({
            templateId: member.templateId,
            persona: `Product-declared managed Member template '${member.templateId}'.`,
        })),
        requirements: [],
        memberEnvelopes: [],
        policyStates: [],
        permissionMutationEnvelope: { rules: [] },
        teamHardEnvelope: { rules: [] },
        metadata: {},
        memberIoCeilings: declaration.members.map((member) => ({
            templateId: member.templateId,
            io: member.ceiling,
        })),
        // Absent (never `[]`) when the declaration declares no restriction: the
        // family is present-only, exactly like a real blueprint, so a
        // restriction-less declaration keeps the byte-identical content hash.
        ...(bindings.length === 0 ? {} : { toolBindings: bindings }),
    };
    // JSON is valid YAML: the frontmatter pipeline stays the ONE parse path.
    return `---\n${JSON.stringify(document, null, 2)}\n---\n`;
}
/**
 * Validate ONE ToolBinding declaration and refuse the faces this realm does not
 * own BEFORE projecting any lane.
 *
 * ORDER IS LOAD-BEARING: the face check runs first, so a
 * `confined-subprocess` binding refuses with the BL-17 code instead of first
 * failing (or worse, succeeding) a lane projection and looking like a generic
 * policy problem.
 */
function projectedRestrictionOf(raw, where, faces = undefined) {
    const binding = closedRecord(raw, ['owner', 'name', 'authorization', 'io', 'execution'], where);
    const execution = closedRecord(binding['execution'], ['implementationOrigin', 'executionBoundary'], `${where}.execution`);
    const boundary = execution['executionBoundary'];
    if (boundary === 'confined-subprocess') {
        refuse('SUBPROCESS_UNCONFINED_REALM', `${where} declares a binding-scoped PROCESS face (executionBoundary=confined-subprocess);`
            + ' a tool-binding realm owns a confined `fs` and NO confined `subprocess` face, so the search/CLI'
            + ' two-axis restriction is UNSUPPORTED — the declaration is refused instead of mounting a narrower answer', where);
    }
    if (boundary === 'delegated-remote') {
        refuse('NETWORK_UNCONFINED_REALM', `${where} declares a delegated-remote execution boundary; the Member realm owns no remote/web face,`
            + ' so the restriction cannot be enforced locally', where);
    }
    if (boundary !== 'trusted-host') {
        refuse('REALM_DECLARATION_INVALID', `${where}.execution.executionBoundary=${JSON.stringify(boundary)} has no realm face in this lane`, where);
    }
    // B3 (review finding, 2026-11-05): `authorization` was ACCEPTED but neither
    // validated nor enforced — `authorization: 'deny'` still served an in-io read,
    // and any bogus string was accepted. Validate against the SHIPPED v4 table
    // (one table, not a copy) and then decide the only fail-closed way this
    // assembler can honour `deny`: a realm that owns the tool's IO face cannot
    // also be the layer that refuses the tool, and NOT mounting the binding would
    // leave the tool on the wider (base/ceiling) surface — a widening. So a
    // `deny` declaration is REFUSED, typed, instead of being mounted as if the
    // word were decoration. Call-time allow/ask stays Alpha.4's decision; this
    // realm only ever compiles the hard IO intersection.
    const authorization = binding['authorization'];
    if (typeof authorization !== 'string' || !BLUEPRINT_V4_AUTHORIZATIONS.includes(authorization)) {
        refuse('REALM_DECLARATION_INVALID', `${where}.authorization=${JSON.stringify(authorization)} is outside the closed v4 vocabulary `
            + `${JSON.stringify(BLUEPRINT_V4_AUTHORIZATIONS)}`, `${where}.authorization`);
    }
    if (authorization === 'deny') {
        refuse('REALM_DECLARATION_INVALID', `${where}.authorization is "deny": this realm mounts an enforced IO face for an authorized tool and owns no `
            + 'call-time authorization decision, so it cannot both serve and deny the same binding. The declaration is '
            + 'refused instead of being mounted as if "deny" were decoration; dropping the binding instead would leave '
            + 'the tool on the wider base/ceiling surface, i.e. WIDEN it. Express a tool the Team must not run as absent '
            + 'from this declaration (or as a deny the Alpha.4 permission lane owns), not as a mounted realm.', `${where}.authorization`);
    }
    const projected = projectToolIoRestriction(binding);
    if (!projected.ok) {
        refuse('MEMBER_POLICY_UNAVAILABLE', `${where} could not be projected (${projected.code}: ${projected.detail}); a restriction that cannot compile never mounts`, where);
    }
    const restriction = projected.value;
    // PD-30: the premise of this refusal is "no web face is installed". A
    // composition that owns a web transport installs one, so the narrowing is
    // enforceable at the service level and the SAME canonical lane is accepted.
    if (restriction.network !== 'allow' && faces?.web !== true) {
        refuse('NETWORK_UNCONFINED_REALM', `${where} narrows the network axis (${restriction.network}); the Member realm installs no web face,`
            + ' so a network narrowing would be a claim with no enforcement', `${where}.io.network`);
    }
    return restriction;
}
/**
 * Resolve the row's bound blueprint — every declared-policy path needs one.
 *
 * A source that is not a non-blank string, does not parse, is a different team
 * or a different revision is `MEMBER_POLICY_WITHOUT_BLUEPRINT`: the declaration
 * would be permission facts no blueprint for THIS team/revision ever saw.
 */
function resolveBoundBlueprint(blueprintSource) {
    if (typeof blueprintSource !== 'string' || blueprintSource.trim() === '') {
        refuse('MEMBER_POLICY_WITHOUT_BLUEPRINT', `${A5SF_MEMBER_POLICIES_KEY} declares Member permission facts, but config.blueprintSource is absent or blank. `
            + 'The declaration is the EXCEPTION path and may only narrow a blueprint ceiling; derivation '
            + `(\`${A5SF_MEMBER_AUTHORITY_KEY}\`) is the product path that needs no declaration at all`, 'config.blueprintSource');
    }
    try {
        return parseBlueprint(blueprintSource);
    }
    catch (error) {
        refuse('MEMBER_POLICY_WITHOUT_BLUEPRINT', `config.blueprintSource does not resolve to a blueprint (${error instanceof Error ? error.message : String(error)}), `
            + 'so the declared Member permission facts cannot be reconciled with the Team\'s authority-bearing blueprint', 'config.blueprintSource');
    }
}
/**
 * Resolve the blueprint a declaration is reconciled against.
 *
 * ONE resolution rule: an ALREADY-RESOLVED bound blueprint is authoritative
 * when supplied (the booted Host's BP-F resolver produced it); otherwise the
 * source string is parsed here. A supplied value that is not a parsed blueprint
 * object refuses instead of being re-parsed or guessed — a caller that thinks
 * it handed in an authority and handed in `undefined` must not get "no
 * constraints".
 */
function resolveBoundBlueprintFor(context) {
    if (context.boundBlueprint !== undefined && context.boundBlueprint !== null) {
        const bound = context.boundBlueprint;
        if (typeof bound !== 'object'
            || typeof bound.blueprintId !== 'string'
            || typeof bound.revision !== 'string'
            || typeof bound.schemaVersion !== 'number') {
            refuse('MEMBER_POLICY_WITHOUT_BLUEPRINT', 'the supplied `boundBlueprint` is not a PARSED TeamBlueprint (blueprintId / revision / schemaVersion); '
                + 'a realm never compiles against an object it cannot identify', 'context.boundBlueprint');
        }
        return bound;
    }
    return resolveBoundBlueprint(context.blueprintSource);
}
/**
 * Validate the closed authority reference (`{ revision, admitted }`).
 */
function authorityRefOf(raw, where) {
    const authority = closedRecord(raw, AUTHORITY_KEYS, where);
    const revision = authority['revision'];
    if (typeof revision !== 'string' || revision.trim() === '') {
        refuse('REALM_DECLARATION_INVALID', `${where}.revision must be a non-blank string: the Alpha.4 authority reference is consumed verbatim and is never invented here`, `${where}.revision`);
    }
    if (typeof authority['admitted'] !== 'boolean') {
        refuse('REALM_DECLARATION_INVALID', `${where}.admitted must be a boolean (the Alpha.4 admission fact, referenced not decided)`, `${where}.admitted`);
    }
    return Object.freeze({ revision, admitted: authority['admitted'] });
}
/**
 * Read the v4 `memberIoCeilings` family out of an already-parsed blueprint.
 *
 * The ONLY derivation step: no lane is recomputed, no default is invented. The
 * leader template is excluded (it is not a Member and never gets a Member
 * ceiling); an optional `templateIds` subset lets a caller derive for exactly
 * the templates it manages.
 */
function derivedMembersOf(bound, instanceGenerations, templateIds) {
    if (bound.schemaVersion !== 4) {
        refuse('MEMBER_POLICY_WITHOUT_BLUEPRINT', `the bound blueprint for team '${bound.blueprintId}' is schemaVersion ${String(bound.schemaVersion)} and declares `
            + `no v4 memberIoCeilings family; there is no Member ceiling to derive, so a declaration has no blueprint to narrow`, `${A5SF_MEMBER_POLICIES_KEY}.members`);
    }
    const core = bound;
    const family = core.memberIoCeilings ?? [];
    if (family.length === 0) {
        refuse('MEMBER_POLICY_WITHOUT_BLUEPRINT', `the bound blueprint for team '${bound.blueprintId}' declares an empty memberIoCeilings family; `
            + 'there is no Member ceiling to derive, so a declaration has no blueprint to narrow', `${A5SF_MEMBER_POLICIES_KEY}.members`);
    }
    const wanted = templateIds === undefined ? undefined : new Set(templateIds);
    const leaderTemplateId = bound.leader.templateId;
    const selected = family.filter((entry) => entry.templateId !== leaderTemplateId
        && (wanted === undefined || wanted.has(entry.templateId)));
    if (selected.length === 0) {
        refuse('REALM_DECLARATION_INVALID', `the bound blueprint for team '${bound.blueprintId}' declares no memberIoCeilings entry for the requested `
            + `template(s) ${JSON.stringify(templateIds ?? [])} (the leader template is never a Member)`, `${A5SF_MEMBER_POLICIES_KEY}.members`);
    }
    return selected.map((entry) => Object.freeze({
        templateId: entry.templateId,
        instanceGeneration: instanceGenerations?.[entry.templateId] ?? 0,
        ceiling: entry.io,
    }));
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
export function deriveProductRealmDeclaration(input) {
    const bound = resolveBoundBlueprint(input.blueprintSource);
    const authority = authorityRefOf(input.authority, A5SF_MEMBER_AUTHORITY_KEY);
    return declarationFromBoundBlueprint(bound, authority, input.instanceGenerations, input.templateIds);
}
/** Shared derivation used by BOTH the public helper and the reconciliation. */
function declarationFromBoundBlueprint(bound, authority, instanceGenerations, templateIds) {
    return Object.freeze({
        schema: A5SF_PRODUCT_REALM_SCHEMA,
        teamId: bound.blueprintId,
        blueprintRevision: String(bound.revision),
        authority,
        members: derivedMembersOf(bound, instanceGenerations, templateIds),
    });
}
/**
 * Reconcile a DECLARED ceiling family against the DERIVED one.
 *
 * One computation: the comparison input is the declaration that
 * {@link deriveProductRealmDeclaration} produces from the bound blueprint, not a
 * parallel re-implementation. Every declared lane must be inside the derived
 * lane (wider ⇒ `REALM_DECLARATION_EXCEEDS_BLUEPRINT`). A strictly narrower
 * declaration is accepted — narrowing cannot widen the authority — but returns
 * `true` so the plan records `declaration-narrows-bound-blueprint`.
 *
 * Network: a declaration had to be `allow` already (else
 * `NETWORK_UNCONFINED_REALM`), so it is a narrowing only when the derived lane
 * is also `allow`; an allow declaration over a narrowed blueprint ceiling is a
 * widening and refuses.
 */
function reconcileWithDerived(declaration, derived) {
    let narrowed = false;
    declaration.members.forEach((member, index) => {
        const where = `${A5SF_MEMBER_POLICIES_KEY}.members[${String(index)}]`;
        const derivedMember = derived.members.find((entry) => entry.templateId === member.templateId);
        if (derivedMember === undefined) {
            refuse('REALM_DECLARATION_EXCEEDS_BLUEPRINT', `${where}: the bound blueprint for team '${declaration.teamId}' declares no memberIoCeilings entry for `
                + `template '${member.templateId}'; a declared ceiling for an undeclared template is wider than the `
                + 'authority the blueprint grants', `${where}.ceiling`);
        }
        for (const axis of ['read', 'write']) {
            const declaredLane = toPathRuleSet(member.ceiling[axis]);
            const derivedLane = toPathRuleSet(derivedMember.ceiling[axis]);
            if (!laneWithinLane(declaredLane, derivedLane)) {
                refuse('REALM_DECLARATION_EXCEEDS_BLUEPRINT', `${where}.ceiling.${axis} is not a narrowing of the ceiling DERIVED from the bound blueprint's `
                    + `memberIoCeilings['${member.templateId}'].io.${axis}: the declaration permits a locator the blueprint `
                    + 'does not. A ceiling can only be widened by a new blueprint/authority revision, never by a row-config edit', `${where}.ceiling.${axis}`);
            }
            if (!laneWithinLane(derivedLane, declaredLane))
                narrowed = true;
        }
        // The network axis is boolean this round: `toPathRuleSet` maps a non-`all`
        // mode to `restricted`, so this comparison is on the AUTHORED modeword.
        const declaredNetworkMode = member.ceiling['network'].mode;
        const derivedNetworkMode = derivedMember.ceiling['network'].mode;
        if (declaredNetworkMode === 'allow' && derivedNetworkMode !== 'allow') {
            refuse('REALM_DECLARATION_EXCEEDS_BLUEPRINT', `${where}.ceiling.network is 'allow' but the ceiling DERIVED from the bound blueprint for template `
                + `'${member.templateId}' is '${String(derivedNetworkMode)}'; an allow declaration over a narrowed ceiling `
                + 'is a widening', `${where}.ceiling.network`);
        }
        if (declaredNetworkMode !== derivedNetworkMode)
            narrowed = true;
    });
    return narrowed;
}
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
export function parseProductRealmDeclaration(raw, context) {
    // PRESENCE GATE FIRST: no declaration may be read at all without a blueprint
    // it can be reconciled against. Removing this check would recreate the
    // "two places to write permission facts" hole (see mutation control (a)).
    const bound = resolveBoundBlueprintFor(context);
    const declaration = closedRecord(raw, DECLARATION_KEYS, `${A5SF_MEMBER_POLICIES_KEY}`);
    if (declaration['schema'] !== A5SF_PRODUCT_REALM_SCHEMA) {
        refuse('REALM_DECLARATION_INVALID', `${A5SF_MEMBER_POLICIES_KEY}.schema must be ${JSON.stringify(A5SF_PRODUCT_REALM_SCHEMA)}`, `${A5SF_MEMBER_POLICIES_KEY}.schema`);
    }
    const teamId = declaration['teamId'];
    if (typeof teamId !== 'string' || teamId.trim() === '') {
        refuse('REALM_DECLARATION_INVALID', `${A5SF_MEMBER_POLICIES_KEY}.teamId must be a non-blank string`, `${A5SF_MEMBER_POLICIES_KEY}.teamId`);
    }
    const blueprintRevision = declaration['blueprintRevision'];
    if (typeof blueprintRevision !== 'string' || blueprintRevision.trim() === '') {
        refuse('REALM_DECLARATION_INVALID', `${A5SF_MEMBER_POLICIES_KEY}.blueprintRevision must be a non-blank string`, `${A5SF_MEMBER_POLICIES_KEY}.blueprintRevision`);
    }
    const authority = authorityRefOf(declaration['authority'], `${A5SF_MEMBER_POLICIES_KEY}.authority`);
    const membersRaw = declaration['members'];
    if (!Array.isArray(membersRaw) || membersRaw.length === 0) {
        refuse('REALM_DECLARATION_INVALID', `${A5SF_MEMBER_POLICIES_KEY}.members must be a non-empty array (an empty declaration declares no managed Member and must be omitted, never present-and-empty)`, `${A5SF_MEMBER_POLICIES_KEY}.members`);
    }
    const seen = new Set();
    const members = [];
    const normalised = [];
    membersRaw.forEach((entry, index) => {
        const where = `${A5SF_MEMBER_POLICIES_KEY}.members[${String(index)}]`;
        const member = closedRecord(entry, MEMBER_KEYS, where, ['templateId', 'instanceGeneration', 'ceiling']);
        const templateId = member['templateId'];
        if (typeof templateId !== 'string' || templateId.trim() === '') {
            refuse('REALM_DECLARATION_INVALID', `${where}.templateId must be a non-blank template id`, `${where}.templateId`);
        }
        if (templateId === SCAFFOLD_LEADER_TEMPLATE) {
            refuse('REALM_DECLARATION_INVALID', `${where}.templateId ${JSON.stringify(templateId)} is the assembler's RESERVED scaffold identity and can never name a managed Member`, `${where}.templateId`);
        }
        if (seen.has(templateId)) {
            refuse('REALM_DECLARATION_INVALID', `${where}.templateId ${JSON.stringify(templateId)} is declared twice; two ceilings for one Member have no single meaning`, `${where}.templateId`);
        }
        seen.add(templateId);
        const instanceGeneration = member['instanceGeneration'];
        if (typeof instanceGeneration !== 'number' || !Number.isInteger(instanceGeneration) || instanceGeneration < 0) {
            refuse('REALM_DECLARATION_INVALID', `${where}.instanceGeneration must be a non-negative integer`, `${where}.instanceGeneration`);
        }
        if (!isRecord(member['ceiling'])) {
            refuse('REALM_DECLARATION_INVALID', `${where}.ceiling must be the v4 io block`, `${where}.ceiling`);
        }
        // The NETWORK axis is refused HERE, before the v4 parse: this realm installs
        // no web face, so a narrowed network lane is a claim with no enforcement.
        // Refusing early keeps the answer specific (`NETWORK_UNCONFINED_REALM`)
        // instead of letting the compiler report a generic unsupported projection.
        const networkLane = member['ceiling']['network'];
        if (isRecord(networkLane) && networkLane['mode'] !== 'allow' && context.availableFaces?.web !== true) {
            refuse('NETWORK_UNCONFINED_REALM', `${where}.ceiling.network narrows the network axis (mode=${JSON.stringify(networkLane['mode'])});`
                + ' the Member realm installs no web face, so the narrowing could not be enforced', `${where}.ceiling.network`);
        }
        const restrictionsRaw = member['toolRestrictions'];
        if (restrictionsRaw !== undefined && !Array.isArray(restrictionsRaw)) {
            refuse('REALM_DECLARATION_INVALID', `${where}.toolRestrictions must be an array of v4 toolBindings entries when present`, `${where}.toolRestrictions`);
        }
        const restrictions = (restrictionsRaw ?? []).map((restriction, restrictionIndex) => projectedRestrictionOf(restriction, `${where}.toolRestrictions[${String(restrictionIndex)}]`, context.availableFaces));
        const identities = new Set();
        for (const restriction of restrictions) {
            if (identities.has(restriction.bindingIdentity)) {
                refuse('REALM_DECLARATION_INVALID', `${where} declares ToolBinding ${JSON.stringify(restriction.bindingIdentity)} twice; one Member x one tool has one restriction`, `${where}.toolRestrictions`);
            }
            identities.add(restriction.bindingIdentity);
        }
        normalised.push({
            templateId,
            instanceGeneration,
            ceiling: member['ceiling'],
            ...(restrictionsRaw === undefined ? {} : { toolRestrictions: restrictionsRaw }),
        });
        members.push(Object.freeze({ templateId, instanceGeneration, restrictions: Object.freeze(restrictions) }));
    });
    // ONE parse of the synthetic v4 document: the shipped validator owns every
    // lane + binding grammar check and the content hash, so this module adds no
    // grammar. The BINDINGS ride the document as the real `toolBindings` family
    // (B4 validation + B8 content identity), not as a side-channel.
    let blueprint;
    try {
        blueprint = parseBlueprintV4(blueprintSourceOf({
            schema: A5SF_PRODUCT_REALM_SCHEMA,
            teamId,
            blueprintRevision,
            authority,
            members: normalised,
        }));
    }
    catch (error) {
        // The shipped v4 validator COLLECTS problems and reports them at their full
        // paths in `details.problems` (the message is only a summary). Carry them
        // into the refusal detail so B4's grammar refusal NAMES the defect instead
        // of saying "somewhere in the binding family".
        const problems = error.details?.problems;
        throw new TeamServiceInstallError('REALM_DECLARATION_INVALID', `${A5SF_MEMBER_POLICIES_KEY}: the v4 validator refused the declared ceiling/binding family: `
            + `${error instanceof Error ? error.message : String(error)}`
            + `${problems === undefined ? '' : ` — problems: ${JSON.stringify(problems)}`}`, A5SF_MEMBER_POLICIES_KEY);
    }
    // THE DECLARATION MUST BE ABOUT THIS BLUEPRINT. A different team or revision
    // means the bound source is not the authority the declaration claims, so the
    // declaration would be permission facts that blueprint never saw.
    if (bound.blueprintId !== teamId) {
        refuse('MEMBER_POLICY_WITHOUT_BLUEPRINT', `config.blueprintSource resolves to team '${bound.blueprintId}', but ${A5SF_MEMBER_POLICIES_KEY} manages `
            + `'${teamId}'. A blueprint for another team is not this Team's authority and is not reconciled by scope: `
            + 'the declaration is refused rather than assembled from itself', 'config.blueprintSource');
    }
    if (String(bound.revision) !== blueprintRevision) {
        refuse('MEMBER_POLICY_WITHOUT_BLUEPRINT', `config.blueprintSource resolves to revision '${String(bound.revision)}', but ${A5SF_MEMBER_POLICIES_KEY} `
            + `claims blueprintRevision '${blueprintRevision}'. The declaration is not a statement about the bound `
            + 'blueprint and cannot be reconciled against it', `${A5SF_MEMBER_POLICIES_KEY}.blueprintRevision`);
    }
    // ONE COMPUTATION: derive the declaration the product path would produce from
    // this SAME blueprint, then require every declared lane to be inside it. The
    // comparison is against the derived declaration, never a parallel reading.
    const declaredDeclaration = {
        schema: A5SF_PRODUCT_REALM_SCHEMA,
        teamId,
        blueprintRevision,
        authority,
        members: normalised,
    };
    const generations = {};
    for (const member of normalised)
        generations[member.templateId] = member.instanceGeneration;
    const derived = declarationFromBoundBlueprint(bound, authority, generations);
    const narrowed = reconcileWithDerived(declaredDeclaration, derived);
    const residuals = ['instance-generation-declared-not-bound'];
    if (narrowed)
        residuals.push('declaration-narrows-bound-blueprint');
    if ((bound.toolBindings?.length ?? 0) > 0)
        residuals.push('blueprint-tool-bindings-not-member-scoped');
    return Object.freeze({
        schema: A5SF_PRODUCT_REALM_SCHEMA,
        teamId,
        authority,
        blueprint,
        members: Object.freeze(members),
        provenance: Object.freeze({
            source: context.source ?? 'declared',
            residuals: Object.freeze(residuals),
        }),
    });
}
/**
 * DERIVED plan: the row path that carries NO `a5sfMemberPolicies`.
 *
 * The derived declaration is handed to {@link parseProductRealmDeclaration}, so
 * validation, reconciliation and compilation are the SAME computation the
 * declared path runs; `source: 'derived'` only records where the input came
 * from and changes no permission fact.
 */
export function deriveProductRealmPlan(input) {
    const declaration = deriveProductRealmDeclaration(input);
    return parseProductRealmDeclaration(declaration, {
        blueprintSource: input.blueprintSource,
        source: 'derived',
        ...(input.availableFaces === undefined ? {} : { availableFaces: input.availableFaces }),
    });
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
export function deriveProductRealmPlanFromBlueprint(input) {
    const authority = authorityRefOf(input.authority, A5SF_MEMBER_AUTHORITY_KEY);
    const declaration = declarationFromBoundBlueprint(input.blueprint, authority, input.instanceGenerations, input.templateIds);
    return parseProductRealmDeclaration(declaration, {
        boundBlueprint: input.blueprint,
        source: 'derived',
        ...(input.availableFaces === undefined ? {} : { availableFaces: input.availableFaces }),
    });
}
function descriptorOf(raw) {
    if (!isRecord(raw)) {
        refuse('MEMBER_IDENTITY_INVALID', 'the row handed compiledFor a non-record Member descriptor; a ceiling cannot bind an unknown identity', 'member');
    }
    const instanceId = raw['instanceId'];
    const templateId = raw['templateId'];
    if (typeof instanceId !== 'string' || instanceId.trim() === '') {
        refuse('MEMBER_IDENTITY_INVALID', 'the row handed compiledFor a Member descriptor with no instanceId; a ceiling cannot bind an unknown identity', 'member.instanceId');
    }
    if (typeof templateId !== 'string' || templateId.trim() === '') {
        refuse('MEMBER_IDENTITY_INVALID', `Member '${instanceId}' has no templateId; a declared ceiling is a TEMPLATE fact and cannot be guessed from argv/cwd/UI`, 'member.templateId');
    }
    return { instanceId, templateId };
}
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
export function createProductRealmProvider(plan) {
    const byTemplate = new Map(plan.members.map((member) => [member.templateId, member]));
    return Object.freeze({
        compiledFor(rawMember) {
            const descriptor = descriptorOf(rawMember);
            const managed = byTemplate.get(descriptor.templateId);
            if (managed === undefined)
                return undefined;
            // DECLARED-NOT-BOUND (review finding B5, 2026-11-05). Only `instanceId`
            // and `templateId` are read from the row's Member descriptor. `teamId`
            // and `instanceGeneration` come from the ROW-CONFIG declaration, not from
            // a live TeamDomain row or a host generation stamp, so they are consumed
            // as DECLARED values: `compileMemberPolicy` treats the identity as trusted
            // because it is not inferred from argv/cwd/UI, NOT because this module
            // verified it against the live Team. A stale declared generation is
            // therefore not detectable here; the type name `TrustedMemberIdentity`
            // means "consumed verbatim by the compiler", not "bound to the live Team".
            const identity = Object.freeze({
                teamId: plan.teamId,
                memberInstanceId: descriptor.instanceId,
                templateId: descriptor.templateId,
                instanceGeneration: managed.instanceGeneration,
            });
            const policy = compileMemberPolicy({
                trustedMember: identity,
                boundBlueprint: { teamId: plan.teamId, blueprint: plan.blueprint },
                effectiveAuthority: {
                    revision: plan.authority.revision,
                    memberInstanceId: descriptor.instanceId,
                    instanceGeneration: managed.instanceGeneration,
                    admitted: plan.authority.admitted,
                },
            });
            if (!policy.ok) {
                refuse('MEMBER_POLICY_UNAVAILABLE', `Member '${descriptor.instanceId}' (template '${descriptor.templateId}') could not compile its ceiling`
                    + ` (${policy.code}: ${policy.detail}); a declared realm never mounts on an uncompiled policy`, policy.path);
            }
            const compiledPolicy = policy.value;
            const bindings = managed.restrictions.map((restriction) => {
                const effective = compileEffectiveIo(compiledPolicy, restriction, {
                    memberIdentity: identity.memberInstanceId,
                    callId: `a5sf-product-realm:${identity.memberInstanceId}:${restriction.bindingIdentity}`,
                    policyRevision: compiledPolicy.revision,
                    toolBindingIdentity: restriction.bindingIdentity,
                    // Approval never widens a hard ceiling, so the realm compiles the
                    // intersection with the UN-approved input. The approval authority is
                    // Alpha.4, at call time, and stays there.
                    approvedOnce: false,
                });
                if (!effective.ok) {
                    refuse('MEMBER_POLICY_UNAVAILABLE', `ToolBinding '${restriction.bindingIdentity}' of Member '${identity.memberInstanceId}' could not compile`
                        + ` its effective lane (${effective.code}: ${effective.detail})`, effective.path);
                }
                return Object.freeze({
                    identity,
                    toolBindingIdentity: restriction.bindingIdentity,
                    effective: effective.value,
                });
            });
            return Object.freeze({
                members: Object.freeze([{ identity, policy }]),
                ...(managed.restrictions.length === 0 ? {} : { bindings: Object.freeze(bindings) }),
            });
        },
    });
}
//# sourceMappingURL=product-assembly.js.map