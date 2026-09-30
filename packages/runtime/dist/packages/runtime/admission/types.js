/**
 * P6-T2 — TeamRuntime types: the unified authority facade for
 * runtime/control actions against EXISTING members.
 *
 * The facade is the single entry every later Team tool (P6-T6) and UI
 * Remote (P8) must call: one `performAction(request)` that enforces the
 * documented order — (1) instanceId-first target resolution, (2) caller
 * identity+role from the TeamDomain, (3) caller authority + mutation
 * envelope, (4) compatibility/admission, (5) quota, (6) durable effects —
 * and returns a lossless-JSON result (no live objects cross the boundary).
 *
 * Reuse, not duplication:
 * - creation (delegate-create / explicit create) is delegated to the
 *   P6-T1 ActivationProvider — the router calls it, never re-implements it
 *   (invariant 26: every new creation via the ActivationProvider);
 * - the mutation-envelope arithmetic reuses the P6-T1 pure seam
 *   (`computeOverlayBounds` semantics: intersection, fail closed);
 * - the compatibility gate reuses the domain/compatibility engine through
 *   the P6-T1 bridge (`evaluateActivationCompatibility`);
 * - the effective-config read reuses the domain/policy two-stage resolver
 *   through the P6-T1 seam (`resolveActivationPolicy`);
 * - durable writes go ONLY through the injected TeamDomain repositories
 *   (invariant 41).
 */
import { CAPABILITY_NAMES, CAPABILITY_NAME_VALUES, } from '../../domain/policy/src/index.js';
import { PERMISSION_RESOURCE_KINDS, PERMISSION_TOOL_NAMES, } from '../../domain/blueprint/src/index.js';
import { committedPolicyState } from '../effective-policy/index.js';
import { OPTIONAL_REQUIREMENT_ACCEPTED_FACT_TYPE, parseOptionalRequirementAccepted, parseRecoveryIncidentClosed, parseRecoveryIncidentOpened, parseTemplateAvailabilitySet, RECOVERY_INCIDENT_CLOSED_FACT_TYPE, RECOVERY_INCIDENT_OPENED_FACT_TYPE, TEMPLATE_AVAILABILITY_SET_FACT_TYPE, } from '../requirements/index.js';
// --- caller roles ----------------------------------------------------------------
/** The closed caller roles the facade resolves from the TeamDomain. */
export const CALLER_ROLES = {
    /** A non-instance principal: the team owner (never envelope-bound; may
     *  exceed team autonomy but not the External Hard Policy, invariant 34). */
    HUMAN: 'human',
    /** The LeaderInstance (inv 36: bounded by the team autonomy envelope). */
    LEADER: 'leader',
    /** An ordinary member instance (bounded by team ∩ template ∩ instance
     *  overlay; cannot self-escalate, invariant 37). */
    MEMBER: 'member',
};
/** Every caller role value, for membership checks. */
export const CALLER_ROLE_VALUES = Object.values(CALLER_ROLES);
// --- actions ---------------------------------------------------------------------
/**
 * The execution modes of WORK actions (issue #1; frozen-contract
 * addendum CCR-1/CCR-2): the closed set.
 *
 * - `sync` — the alpha.2 default (CCR-1: an ABSENT `execution` resolves
 *   to this; `performAction` blocks through the full work chain and the
 *   effect carries the `memberResult`);
 * - `async` — CCR-2: once the Phase A durable admission is committed,
 *   Phase B/C detach into the Team runtime (CCR-4: the caller's signal is
 *   honored through the admission only) and `performAction` returns the
 *   durable admission receipt (`workStatus: 'admitted'`); the terminal
 *   state is read back through the `work-status` action / `team_collect`
 *   tool (CCR-3).
 *
 * 2026-09-27 user ruling (model surface only): the model-facing tools
 * `team_delegate` / `team_follow_up` are now ASYNCHRONOUS BY DEFAULT
 * (absent `async` argument → `execution: 'async'`; only an explicit
 * `async: false` sends `execution: 'sync'`). The FACADE field semantics
 * are UNCHANGED — an ABSENT `execution` still resolves to `sync`
 * (CCR-1) for direct `performAction` callers — but the tool layer always
 * sets the field explicitly, so the facade default is no longer reachable
 * through the model surface.
 *
 * Accepted ONLY on the work actions (`delegate` / `follow-up`); rejected
 * on every other action (REQUEST_MALFORMED — CCR-2's closed scope).
 */
export const WORK_EXECUTION_MODES = ['sync', 'async'];
// --- member work result (v2 D2; FROZEN by task C1) ---------------------------------
/**
 * The closed status vocabulary of the minimal member result (frozen, v2
 * task C1; plan §1.3 / §10-C1).
 *
 * - `succeeded`: the member turn genuinely completed AND a readable
 *   non-empty business body exists (`body` present);
 * - `failed`: the delivery/turn failed explicitly (turn reason
 *   error / aborted / max-tokens / blocked) — `error` carries a stable
 *   code + a user-visible message;
 * - `unavailable`: the turn completed but no readable business body is
 *   available, or the seam cannot determine the outcome — `error` carries
 *   the reason code.
 *
 * The control-plane settlement is SEPARATE: a settled work unit is not a
 * succeeded one. `settled: true` alone must NEVER be mapped to
 * `succeeded` anywhere in the Team surface.
 */
export const WORK_DELIVERY_STATUSES = ['succeeded', 'failed', 'unavailable'];
// --- shared helpers -----------------------------------------------------------------
/**
 * The per-capability effective values of a resolved policy, in canonical
 * capability order (lossless-JSON view for `config-inspected`).
 *
 * Reuses the P6-T1 seam semantics: every closed capability appears exactly
 * once.
 */
export function effectivePolicyView(values, capabilities) {
    const view = {};
    for (const name of capabilities) {
        const entry = values[name];
        if (entry !== undefined) {
            view[name] = entry;
        }
    }
    return view;
}
/** A stable, lossless-JSON summary of one member record (list view). */
export function memberSummary(member) {
    return {
        instanceId: member.instanceId,
        templateId: member.templateId,
        label: member.label,
        ...(member.lifecycle !== undefined ? { lifecycle: member.lifecycle } : {}),
        ...(member.childSessionId !== undefined ? { childSessionId: member.childSessionId } : {}),
    };
}
// --- pre-alpha3 PR-F (plan §F.4): the config-inspected same-source fact views ----
/**
 * The closed capability set of the `config-inspected` `effective` view
 * (pre-alpha3 PR-F, plan §F.4): the five closed capability domains MINUS
 * the generic `permissions` cell — the FAKE legacy cell that was the
 * five-domain "dynamic" authority. The ACTUAL alpha.2 operation-permission
 * authority is the independent `operationPermissions` field
 * ({@link OperationPermissionView}), so the generic cell is no longer
 * surfaced at all (neither displayed nor conflated).
 */
export const CONFIG_INSPECTED_EFFECTIVE_CAPABILITIES = CAPABILITY_NAME_VALUES.filter((name) => name !== CAPABILITY_NAMES.PERMISSIONS);
/**
 * Build the `policyState` view from the durable transition rows — the
 * SAME `committedPolicyState` fold the production root uses for the
 * projection's `policyState` cell (one read, one authority; no re-probe).
 *
 * @param transitions - the durable PolicyState transitions of the
 *   inspected root (COMMIT order; empty = never transitioned).
 */
export function configInspectedPolicyStateView(transitions) {
    const { state, transition } = committedPolicyState(transitions);
    return {
        stateId: state.stateId,
        source: transition === null ? 'blueprint-default' : 'durable-transition',
        cells: { ...(state.cells ?? {}) },
        ...(transition === null
            ? {}
            : { transition: { entryId: transition.entryId, origin: transition.origin } }),
    };
}
/**
 * Build the `requirement` view from the durable compatibility record and
 * the PR-E requirement facts (ledger rows, SEQUENCE order — the latest
 * fact per key wins; the fail-closed parsers reject a corrupted row).
 *
 * @param compatibility - the durable compatibility state of the root
 *   (`undefined` = never probed).
 * @param ledgerEntries - the root's durable ledger entries (sequence
 *   order; the PR-E fact types are the only ones consumed).
 */
export function configInspectedRequirementView(compatibility, ledgerEntries) {
    const latestConsentByRequirement = new Map();
    const latestAvailabilityByTemplate = new Map();
    for (const entry of ledgerEntries) {
        if (entry.factType === OPTIONAL_REQUIREMENT_ACCEPTED_FACT_TYPE) {
            const fact = parseOptionalRequirementAccepted(entry.payload, `ledger[${entry.sequence}].payload`);
            latestConsentByRequirement.set(fact.requirementId, fact);
        }
        else if (entry.factType === TEMPLATE_AVAILABILITY_SET_FACT_TYPE) {
            const fact = parseTemplateAvailabilitySet(entry.payload, `ledger[${entry.sequence}].payload`);
            latestAvailabilityByTemplate.set(fact.templateId, fact);
        }
    }
    const consents = [...latestConsentByRequirement.values()]
        .sort((a, b) => a.requirementId.localeCompare(b.requirementId))
        .map((fact) => ({
        requirementId: fact.requirementId,
        consentedBy: fact.consentedBy,
        consentedAt: fact.consentedAt,
    }));
    const templateAvailability = [...latestAvailabilityByTemplate.values()]
        .sort((a, b) => a.templateId.localeCompare(b.templateId))
        .map((fact) => ({ templateId: fact.templateId, available: fact.available, at: fact.at }));
    return {
        ...(compatibility === undefined
            ? {}
            : {
                compatibility: {
                    status: compatibility.status,
                    fingerprint: compatibility.fingerprint,
                    generation: compatibility.generation,
                    outcomes: { ...compatibility.outcomes },
                    acknowledgements: [...compatibility.acknowledgements],
                    computedAt: compatibility.computedAt,
                },
            }),
        consents,
        templateAvailability,
    };
}
/**
 * Build the `recovery` view from the durable PR-E incident facts (ledger
 * rows, SEQUENCE order — the latest incident fact per scope decides; the
 * fail-closed parsers reject a corrupted row).
 *
 * @param ledgerEntries - the root's durable ledger entries (sequence
 *   order; the two incident fact types are the only ones consumed).
 */
export function configInspectedRecoveryView(ledgerEntries) {
    const latestByScope = new Map();
    for (const entry of ledgerEntries) {
        if (entry.factType === RECOVERY_INCIDENT_OPENED_FACT_TYPE) {
            const fact = parseRecoveryIncidentOpened(entry.payload, `ledger[${entry.sequence}].payload`);
            latestByScope.set(fact.scope, { kind: 'opened', fact });
        }
        else if (entry.factType === RECOVERY_INCIDENT_CLOSED_FACT_TYPE) {
            const fact = parseRecoveryIncidentClosed(entry.payload, `ledger[${entry.sequence}].payload`);
            latestByScope.set(fact.scope, { kind: 'closed', fact });
        }
    }
    const openIncidents = [];
    const lastClosed = [];
    for (const incident of latestByScope.values()) {
        if (incident.kind === 'opened') {
            openIncidents.push({
                scope: incident.fact.scope,
                requirementIds: [...incident.fact.requirementIds],
                openedAt: incident.fact.openedAt,
            });
        }
        else {
            lastClosed.push({
                scope: incident.fact.scope,
                requirementIds: [...incident.fact.requirementIds],
                closedAt: incident.fact.closedAt,
            });
        }
    }
    openIncidents.sort((a, b) => a.scope.localeCompare(b.scope));
    lastClosed.sort((a, b) => a.scope.localeCompare(b.scope));
    return {
        openIncidents,
        lastClosed,
        active: openIncidents.length > 0,
    };
}
// --- A2C-3 (plan §10): the real operation-permission view ------------------------
/**
 * One rule of a stored static permission policy, served as a lossless-JSON
 * view in its stored shape (A2C-3, plan §10.2).
 */
function operationPermissionRuleView(rule) {
    const resource = rule.resource;
    if (resource.kind === 'any') {
        return { tool: rule.tool, resource: { kind: 'any' } };
    }
    if (resource.kind === 'subtree') {
        return { tool: rule.tool, resource: { kind: 'subtree', path: resource.path } };
    }
    return { tool: rule.tool, resource: { kind: 'exact', path: resource.path } };
}
/**
 * The lossless-JSON view of the BOUND template's static parameter-aware
 * operation permission policy (A2C-3, plan §10.2/§10.3) — the ACTUAL
 * alpha.2 operation-permission authority
 * (`boundTemplate.capabilities.permissions` → TemplatePermissionPolicy →
 * pre-execute adapter), independent from the legacy generic
 * `effective.permissions` cell.
 *
 * Deterministic: the lanes are served in the policy's STORED (declaration)
 * order — the A1 normalization pin — never re-sorted, duplicates
 * preserved. `managedTools` / `resourceKinds` are the FINAL closed
 * vocabularies from the domain blueprint constants
 * (`PERMISSION_TOOL_NAMES` / `PERMISSION_RESOURCE_KINDS`), so the view
 * cannot drift from the enforced vocabulary. alpha.2 has no dynamic
 * permission mutation: the static policy IS the current operation policy
 * (no alpha.3 grants/overlays are invented).
 *
 * @param template - the bound blueprint template entry of the inspected
 *   target (LeaderTemplate or MemberTemplate; the capabilities block is
 *   optional — absent = legacy mode, `mode: 'absent'`).
 */
export function operationPermissionView(template) {
    const permissions = template.capabilities?.permissions;
    if (permissions === undefined) {
        return { mode: 'absent' };
    }
    return {
        mode: 'static',
        default: permissions.default,
        allow: permissions.allow.map(operationPermissionRuleView),
        ask: permissions.ask.map(operationPermissionRuleView),
        deny: permissions.deny.map(operationPermissionRuleView),
        managedTools: [...PERMISSION_TOOL_NAMES],
        resourceKinds: [...PERMISSION_RESOURCE_KINDS],
    };
}
//# sourceMappingURL=types.js.map