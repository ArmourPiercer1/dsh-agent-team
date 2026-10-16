/**
 * Alpha.5 PR1 (plan §4, design §4.1) — the CLOSED-WORLD MONOTONIC GUARD.
 *
 * THE PROBLEM THIS CLOSES (design §0 权威表 "Coverage" row, PoC H6):
 * a Setup Coverage Gate sees the surface ONCE, at assembly time. A tool that
 * appears AFTER setup — an own-layer `tools.register` of an undeclared name,
 * a late MCP registration, a hot re-registration by any same-scope plugin —
 * was never seen by it, and on the PoC host such a tool's body RAN
 * (`hc-dyn-observation.dynRan = true`). A coverage check can never be the
 * safety gate; only a decision made AT DISPATCH TIME, on every call, for as
 * long as the Agent lives, can be.
 *
 * THE LAW THIS MODULE ENFORCES (design §1 invariant 1, "完整分发治理"):
 *
 *     T_dispatchable(agent)  ⊆  T_governed(agent)
 *
 * expressed as a closed world: a name is executable for this Team Agent ONLY
 * if a trusted Binding was installed for it by the Team assembly. Everything
 * else is refused with a typed §5 error — never "unmanaged ⇒ abstain":
 *
 *   - unknown `exec.name` (no Binding, ever)      → `TEAM_TOOL_UNGOVERNED`
 *   - a Binding whose identity/revision cannot be
 *     verified at call time                        → `TOOL_BINDING_UNVERIFIED`
 *   - a foreign Agent identity on the exec          → `TOOL_BINDING_UNVERIFIED`
 *   - anything while the Dispatcher is not ACTIVE   → `ADAPTER_DRAINING`
 *     (DRAINING / TOMBSTONED / RELEASED keep refusing: the mask and the
 *      Guard outlive the in-flight work, never the other way round)
 *
 * MONOTONIC in two directions, both pinned by `a5p1-closed-world-guard`:
 *   1. the Guard can only ever refuse or abstain — it has NO allow result
 *      (same law as the alpha.2 end-cap guard it composes with, plan §4
 *      "PTC 内层重复 Admission"); a `tools/change` event, a pre-execute
 *      listener, or a re-registration can never turn a refusal back into
 *      permission;
 *   2. the governed set only grows through {@link GovernedSurface.bind},
 *      which the trusted assembly calls; a Binding is never removed and
 *      never mutated — a policy/binding CHANGE installs an immutable new
 *      REVISION (design §4.1 ACTIVE row), so `tools/change` revalidation and
 *      `tools.restrict` remain diagnostics/re-routing, never the enforcement.
 *
 * AGENTLESS (NEG-2, design §4.1): an execution that carries NO Agent
 * identity at all is a Host-lane execution, not a Team Agent execution. The
 * Guard is installed on ONE Team Agent's scope, so such an exec can only be
 * a foreign/global dispatch that reached this scope's seam: the identity is
 * unverifiable, which is a typed `TOOL_BINDING_UNVERIFIED` — while a call
 * that carries THIS Agent's identity verifies normally. Ordinary Host
 * Sessions get ZERO of this: the install is agent-scoped and non-Team
 * Agents never have one (pinned by the real-Host control-session criterion).
 *
 * Purity: no `node:*`, no I/O, no DSH import, no clock. It reuses the PR0
 * frozen vocabulary (`GovernanceError`/`GovernanceResult`, the §5 codes) and
 * the PR0 binding record — REUSE, not a second algebra.
 *
 * @module @dsh-agent-team/runtime/tool-dispatch/closed-world-guard
 */
import { ASSURANCE_DIMENSIONS, GOVERNANCE_ERROR_CODES, } from '../../domain/tool-governance/src/index.js';
/**
 * The NAMED Realm every PR1 assurance claim holds in — and travels to no
 * other (design §2.1: Realm 不可混淆). PR1's governance lives in the Host
 * process at the Team trusted assembly point, so that is the realm it names;
 * it is NOT the per-Agent ACL scope, and no other realm's evidence may be
 * pasted into it.
 */
export const ASSURANCE_REALM_TRUSTED_ASSEMBLY = 'dsh-host-realm:team-trusted-assembly';
/**
 * The honest assurance record of a Binding whose I/O enforcement PR1 does NOT
 * claim: every dimension is `untested`, and — per PR0 review M-2 — an
 * `untested` dimension still states the FULL §2.1 record: no mechanism, no
 * trust root, no evidence (each written as an explicit `null`, the honest way
 * of saying "none exists"), inside a named realm. A bare level would be the
 * overclaim §1.4 refuses, and PR0's parser refuses a missing dimension
 * precisely so this claim cannot drift silent. PR3/PR4 fill these rows with
 * real mechanism/realm/evidence; they do not redefine them.
 */
export function untestedAssurance(implementationOrigin, executionBoundary, realmId = ASSURANCE_REALM_TRUSTED_ASSEMBLY) {
    // A blank realm is not a weaker claim, it is no claim: fall back to the
    // named assembly realm rather than emitting a realm id the parser rejects.
    const realm = typeof realmId === 'string' && realmId.trim().length > 0 ? realmId : ASSURANCE_REALM_TRUSTED_ASSEMBLY;
    const assurance = {};
    for (const dimension of ASSURANCE_DIMENSIONS) {
        assurance[dimension] = Object.freeze({ level: 'untested', mechanism: null, realmId: realm, trustRoot: null, evidence: null });
    }
    return Object.freeze({ implementationOrigin, executionBoundary, assurance: Object.freeze(assurance) });
}
/** Which trusted assembly step established one governed name (design §3 table). */
export const GOVERNED_ORIGINS = ['inherited-native', 'team-own', 'team-mcp'];
/**
 * WHY one governed name is not verified — a fact the assembly records when it
 * binds, not a guess the Guard makes later. Each member is a distinct measured
 * condition, and each one maps onto its own dispatch-time message, because
 * "unverified" alone tells the operator nothing about what to fix.
 *
 *  - `unattributed`      observed on the surface, not on the trusted native list;
 *  - `native-shadowed`   on the trusted native list, but THIS Agent resolves the
 *                        name to a different Definition than the trusted global
 *                        read (the residual R-a case: a name is not a definition);
 *  - `native-unreadable` on the trusted native list, but the trusted side of the
 *                        comparison could not be read at the public seam;
 *  - `definition-drift`  it was verified and the definition moved underneath it;
 *  - `definition-unreadable` the current definition cannot be read at all.
 */
export const GOVERNED_UNVERIFIED_REASONS = [
    'unattributed',
    'native-shadowed',
    'native-unreadable',
    'definition-drift',
    'definition-unreadable',
];
/** Why one call was refused, in Guard terms (mapped onto the §5 codes). */
export const GUARD_DENIAL_REASONS = {
    UNGOVERNED: 'ungoverned-name',
    BINDING_UNVERIFIED: 'binding-unverified',
    IDENTITY_FOREIGN: 'agent-identity-foreign',
    IDENTITY_ABSENT: 'agent-identity-absent',
    NOT_ACTIVE: 'dispatcher-not-active',
    REVISION_DRIFT: 'binding-revision-drift',
    /** The name resolved to a DIFFERENT definition than the Binding pinned (the
     *  same Scope and name, a new body). R2: verification is of a definition,
     *  never of a name. */
    DEFINITION_DRIFT: 'definition-drift',
    /** The current definition could not be read at the public seam. Assuming
     *  "nothing changed" is exactly the failure this reason exists to refuse. */
    DEFINITION_UNREADABLE: 'definition-unreadable',
    /** The name is on the assembly's trusted native list, but the definition THIS
     *  Agent resolves is not the definition the trusted (global) view resolves:
     *  a same-name contribution shadows it. R-a: a trusted NAME never transfers
     *  its standing to somebody else's DEFINITION. */
    NATIVE_SHADOWED: 'native-shadowed',
    /** The name is on the trusted native list but the trusted side of that
     *  comparison could not be read at the public seam, so the comparison the
     *  rule needs does not exist. Unreadable is a refusal, never a pass. */
    NATIVE_UNREADABLE: 'native-unreadable',
};
/** The stable, model-visible reason text of each §5 code (never a stack). */
export function guardDenialMessage(name, reason) {
    switch (reason) {
        case GUARD_DENIAL_REASONS.UNGOVERNED:
            return `team tool guard: "${name}" has no Team Tool Binding on this Agent (closed world: an un-governed tool never executes; declare it or bind it)`;
        case GUARD_DENIAL_REASONS.BINDING_UNVERIFIED:
            return `team tool guard: the Tool Binding for "${name}" cannot be verified at dispatch time (no fallback to the native body)`;
        case GUARD_DENIAL_REASONS.IDENTITY_FOREIGN:
            return `team tool guard: "${name}" was dispatched under an Agent identity other than the one this Binding is scoped to (Team identity is not transferable)`;
        case GUARD_DENIAL_REASONS.IDENTITY_ABSENT:
            return `team tool guard: "${name}" reached a Team Agent scope without any Agent identity (a Team-origin nested dispatch must carry its trusted Agent; refusing)`;
        case GUARD_DENIAL_REASONS.NOT_ACTIVE:
            return `team tool guard: "${name}" is refused because this Agent's Tool Dispatcher is not ACTIVE (assembly-in-progress, draining or tombstoned: new calls are refused; the mask stays)`;
        case GUARD_DENIAL_REASONS.REVISION_DRIFT:
            return `team tool guard: the Tool Binding for "${name}" changed generation after this Dispatcher validated it (stale binding: re-assembly required)`;
        case GUARD_DENIAL_REASONS.DEFINITION_DRIFT:
            return `team tool guard: "${name}" now resolves to a different ToolDefinition than the one its Binding pinned (definition drift: an old verification never transfers to a new body; re-bind required)`;
        case GUARD_DENIAL_REASONS.DEFINITION_UNREADABLE:
            return `team tool guard: the current definition of "${name}" is unreadable at the public seam, so its Binding cannot be re-verified at dispatch (unreadable definition: refusing rather than assuming nothing changed)`;
        case GUARD_DENIAL_REASONS.NATIVE_SHADOWED:
            return `team tool guard: "${name}" is on the trusted native list, but this Agent resolves that name to a DIFFERENT ToolDefinition than the trusted global view does — a same-name contribution shadows it, and the Team assembly never bound this Body (a trusted name is not a trusted definition: refusing rather than inheriting a verification it was never given)`;
        case GUARD_DENIAL_REASONS.NATIVE_UNREADABLE:
            return `team tool guard: the trusted global definition of "${name}" is unreadable at the public seam, so the name-vs-definition comparison the native rule needs cannot be made (refusing rather than crediting a name nobody could pin)`;
    }
}
const NATIVE_PROVIDER = 'dsh-native-host';
/** Create one Agent's closed world (per-agent closure, zero module state). */
export function createGovernedSurface(options) {
    const entries = new Map();
    const providerId = options.nativeProviderId ?? NATIVE_PROVIDER;
    const agentScopeKey = options.agentScopeKey;
    const policyGeneration = options.policyGeneration ?? 0;
    const authorityGeneration = options.authorityGeneration ?? 0;
    const nativeNames = new Set(options.nativeNames ?? []);
    const bind = ({ name, origin, binding, verified, unverifiedReason }) => {
        const previous = entries.get(name);
        if (previous !== undefined) {
            // A stable ToolDefinition identity: the same name keeps the same
            // bindingId family and a strictly higher revision (design §4.1).
            if (previous.binding.bindingId !== binding.bindingId) {
                return {
                    ok: false,
                    error: {
                        code: 'TOOL_BINDING_UNVERIFIED',
                        message: `re-binding "${name}" would replace Binding ${previous.binding.bindingId} with ${binding.bindingId}: at ACTIVE a name keeps ONE stable Definition identity and flips immutable revisions`,
                    },
                };
            }
            if (binding.revision <= previous.revision) {
                return {
                    ok: false,
                    error: {
                        code: 'TOOL_BINDING_UNVERIFIED',
                        message: `re-binding "${name}" must carry a strictly higher revision (${previous.revision} in force, got ${binding.revision})`,
                    },
                };
            }
        }
        const entry = Object.freeze({
            name,
            origin,
            binding: Object.freeze({ ...binding }),
            verified,
            // A verified entry has no "why not" to state; an unverified one always
            // states the fact that made it so, defaulting to the plainest reading.
            unverifiedReason: verified ? null : (unverifiedReason ?? 'unattributed'),
            revision: binding.revision,
        });
        entries.set(name, entry);
        return { ok: true, value: entry };
    };
    return {
        names: () => [...entries.keys()].sort(),
        entryOf: (name) => entries.get(name),
        bind,
        markUnverified: (name, bindingId, reason) => {
            const current = entries.get(name);
            if (current === undefined) {
                return {
                    ok: false,
                    error: { code: 'TEAM_TOOL_UNGOVERNED', message: `markUnverified("${name}"): the name is not governed` },
                };
            }
            if (current.binding.bindingId !== bindingId) {
                return {
                    ok: false,
                    error: {
                        code: 'TOOL_BINDING_UNVERIFIED',
                        message: `markUnverified("${name}"): bindingId drift (${current.binding.bindingId} in force, asked for ${bindingId})`,
                    },
                };
            }
            const entry = Object.freeze({
                ...current,
                verified: false,
                unverifiedReason: reason ?? 'definition-drift',
            });
            entries.set(name, entry);
            return { ok: true, value: entry };
        },
        bindInheritedSurface: (names, resolved, trusted) => {
            let verifiedBound = 0;
            const unverified = [];
            const shadowed = [];
            const nativeUnreadable = [];
            for (const name of names) {
                if (entries.has(name))
                    continue;
                const pinned = resolved[name];
                const trustedIdentity = trusted[name];
                const hasPinnedIdentity = typeof pinned === 'string' && pinned.length > 0;
                const hasTrustedIdentity = typeof trustedIdentity === 'string';
                // THE FOUR CASES (see `bindInheritedSurface` above). Trusted-native
                // standing is earned by the COMPARISON, never by the name.
                const claimsNative = nativeNames.has(name);
                const isNative = claimsNative && hasPinnedIdentity && hasTrustedIdentity && trustedIdentity === pinned;
                const unverifiedReason = !claimsNative
                    ? 'unattributed'
                    : !hasPinnedIdentity
                        ? 'definition-unreadable'
                        : !hasTrustedIdentity
                            ? 'native-unreadable'
                            : 'native-shadowed';
                if (claimsNative && hasPinnedIdentity && hasTrustedIdentity && trustedIdentity !== pinned) {
                    shadowed.push({ name, trusted: String(trustedIdentity), resolved: String(pinned) });
                }
                if (claimsNative && hasPinnedIdentity && !hasTrustedIdentity)
                    nativeUnreadable.push(name);
                const binding = isNative
                    ? {
                        bindingId: `native:${name}`,
                        agentScopeKey,
                        toolName: name,
                        // The identity read from `tools.get(name, scope)` — the body the
                        // assembly actually saw, not a name-shaped guess. R-a pins that
                        // this is ALSO what the trusted global view resolves, or the name
                        // does not get here at all.
                        definitionIdentity: String(pinned),
                        providerId,
                        implementationOrigin: 'dsh-native',
                        executionBoundary: 'trusted-host',
                        assurance: untestedAssurance('dsh-native', 'trusted-host'),
                        policyGeneration,
                        authorityGeneration,
                        revision: 1,
                        status: 'ACTIVE',
                    }
                    : {
                        // Observed, not attributed. The closed assurance vocabulary has no
                        // "unattributed" member, so the honest claim lives in the
                        // bindingId family, the UNVERIFIED flag and the untested
                        // assurance — and in the dispatch-time refusal this entry always
                        // produces until the trusted assembly binds it for real.
                        bindingId: `unbound-observed:${agentScopeKey}:${name}`,
                        agentScopeKey,
                        toolName: name,
                        definitionIdentity: hasPinnedIdentity ? String(pinned) : `unpinned:${name}`,
                        providerId: typeof trustedIdentity === 'string' ? 'shadowed-same-name' : 'unattributed',
                        implementationOrigin: 'team-trusted-extension',
                        executionBoundary: 'trusted-host',
                        assurance: untestedAssurance('team-trusted-extension', 'trusted-host'),
                        policyGeneration,
                        authorityGeneration,
                        revision: 1,
                        status: 'ACTIVE',
                    };
                const outcome = bind({
                    name,
                    origin: 'inherited-native',
                    binding,
                    verified: isNative,
                    unverifiedReason: isNative ? undefined : unverifiedReason,
                });
                if (!outcome.ok)
                    continue;
                if (isNative)
                    verifiedBound += 1;
                else
                    unverified.push(name);
            }
            return Object.freeze({
                verifiedBound,
                unverifiedBound: unverified.length,
                unverified: Object.freeze(unverified.slice().sort()),
                shadowed: Object.freeze(shadowed.slice().sort((a, b) => a.name.localeCompare(b.name))),
                nativeUnreadable: Object.freeze(nativeUnreadable.slice().sort()),
            });
        },
        snapshot: () => [...entries.values()],
    };
}
/**
 * The per-call decision. PURE and total: it never throws, never allows, and
 * re-reads the surface and the state at the moment of the call (an assembly
 * that bound a name at setup and then changed it cannot be raced).
 */
export function guardDecision(input) {
    const { exec, scope, surface } = input;
    const deny = (code, reason) => ({
        kind: 'deny',
        reason,
        error: { code, message: guardDenialMessage(exec.name, reason) },
    });
    // STATE FIRST (NEG-1 family): before the mask, before any Binding lookup,
    // a Dispatcher that is not ACTIVE refuses everything on this scope.
    if (!input.active)
        return deny('ADAPTER_DRAINING', GUARD_DENIAL_REASONS.NOT_ACTIVE);
    const identity = typeof exec.agentIdentity === 'string' && exec.agentIdentity.length > 0 ? exec.agentIdentity : null;
    if (identity === null) {
        // NEG-2: a Team-origin dispatch that lost its Agent identity must not be
        // laundered into the global native lane.
        return deny('TOOL_BINDING_UNVERIFIED', GUARD_DENIAL_REASONS.IDENTITY_ABSENT);
    }
    if (!scope.trustedIdentities.includes(identity)) {
        return deny('TOOL_BINDING_UNVERIFIED', GUARD_DENIAL_REASONS.IDENTITY_FOREIGN);
    }
    const entry = surface.entryOf(exec.name);
    if (entry === undefined)
        return deny('TEAM_TOOL_UNGOVERNED', GUARD_DENIAL_REASONS.UNGOVERNED);
    if (!entry.verified) {
        // WHY it is unverified is a fact the assembly or the drift detector already
        // recorded; the Guard states it instead of flattening every case into
        // "cannot be verified", because a shadowed name, an unreadable trusted view
        // and a body that moved are three different things to fix.
        const reason = entry.unverifiedReason === 'native-shadowed'
            ? GUARD_DENIAL_REASONS.NATIVE_SHADOWED
            : entry.unverifiedReason === 'native-unreadable'
                ? GUARD_DENIAL_REASONS.NATIVE_UNREADABLE
                : entry.unverifiedReason === 'definition-drift'
                    ? GUARD_DENIAL_REASONS.DEFINITION_DRIFT
                    : entry.unverifiedReason === 'definition-unreadable'
                        ? GUARD_DENIAL_REASONS.DEFINITION_UNREADABLE
                        : GUARD_DENIAL_REASONS.BINDING_UNVERIFIED;
        return deny('TOOL_BINDING_UNVERIFIED', reason);
    }
    if (entry.binding.policyGeneration !== input.policyGeneration ||
        entry.binding.authorityGeneration !== input.authorityGeneration) {
        return deny('TOOL_BINDING_UNVERIFIED', GUARD_DENIAL_REASONS.REVISION_DRIFT);
    }
    if (entry.revision !== entry.binding.revision) {
        return deny('TOOL_BINDING_UNVERIFIED', GUARD_DENIAL_REASONS.REVISION_DRIFT);
    }
    // THE DEFINITION, NOT THE NAME (PR1 Gate R2): a verified Binding attests to
    // the body it pinned, so a same-Scope, same-name resolution to a different
    // ToolDefinition is a new body and the old verification does not reach it.
    if (!input.definition.ok) {
        return deny('TOOL_BINDING_UNVERIFIED', GUARD_DENIAL_REASONS.DEFINITION_UNREADABLE);
    }
    if (input.definition.fingerprint !== entry.binding.definitionIdentity) {
        return deny('TOOL_BINDING_UNVERIFIED', GUARD_DENIAL_REASONS.DEFINITION_DRIFT);
    }
    return { kind: 'abstain', reason: 'governed-and-verified' };
}
/** The §5 codes this Guard is allowed to surface (pinned by test). */
export const GUARD_ERROR_CODES = Object.freeze(GOVERNANCE_ERROR_CODES.filter((c) => c === 'TEAM_TOOL_UNGOVERNED' || c === 'TOOL_BINDING_UNVERIFIED' || c === 'ADAPTER_DRAINING'));
//# sourceMappingURL=closed-world-guard.js.map