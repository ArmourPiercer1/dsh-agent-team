/**
 * pre-alpha3 PR-E (plan §E.4/§E.7/§E.8/§E.10) — the LIVE requirement gate:
 * the NEW WORK admission gate of the requirement/recovery model that
 * REPLACES the P6-T2 compatibility gate at the router's step 5 (the old
 * `enforceCompatibilityGate` is superseded — the `requirements/` module is
 * authoritative, not dormant).
 *
 * What changed versus the old gate (the product-semantics switch):
 *
 * - The gate evaluates EVERY scope the bound blueprint declares (the Team
 *   scope through the SAME single compatibility authority chain — fresh
 *   facts → fingerprint → freshness re-probe → durable state → ack
 *   validity — and each v2 template scope with a FRESH engine evaluation:
 *   template-scope readiness has no durable generation of its own and
 *   resets on restart, exactly like the derived recovery state);
 * - FATAL (a required requirement down) = a BLOCKED scope. Normal work
 *   that depends on it is BLOCKED — but recovery work (the
 *   human-reviewed dispatch, plan §E.9) is ALLOWED on the reduced original
 *   authority (the gate returns `recoveryAllowed` + the recovery scopes;
 *   the router performs the Control coupling);
 * - WARNING (an optional requirement down) = a DEGRADED scope. Normal
 *   work CONTINUES (auto-degraded — the old gate's
 *   `COMPATIBILITY_BLOCKED_WARNING` throw is gone; the durable consent
 *   records the human's acknowledgement but is not a gate precondition);
 * - a chain failure (facts-unavailable / reprobe-failed / no-state /
 *   state-mismatch) still fails CLOSED — invariant 50 is unchanged: a
 *   compatibility failure is never an admission;
 * - the closed error code stays `COMPATIBILITY_BLOCKED` (the frozen router
 *   vocabulary; the FATAL path's observable contract is preserved —
 *   `details.status: 'BLOCKED_FATAL'` + the blocking requirement ids),
 *   only the DECISION semantics moved (warning → auto-degraded) and the
 *   typed details gained the recovery-model fields.
 *
 * Durable requirement facts (the frozen `compatibility` ledger category):
 *
 * - `recovery-incident-opened` — written when the gate ALLOWS recovery work
 *   for a blocked scope that has no OPEN incident (open = an opened fact
 *   without a subsequent closed fact for the same scope);
 * - `recovery-incident-closed` — written when a scope with an OPEN
 *   incident is no longer blocked on the fresh evaluation (the plan §E.10
 *   exit record — the exit itself is the derived state flipping; NO
 *   durable recovery flag is ever written);
 * - `optional-requirement-accepted` / `template-availability-set` — READ
 *   here (they are written by the creation preflight, plan §E.6, and the
 *   compatibility-ack channel; both survive restart — authority negative
 *   #10).
 *
 * I/O only through the injected TeamDomain repositories + the
 * environment-facts port; no `node:` builtins, no upstream imports.
 * @module @dsh-agent-team/runtime/admission/requirement-gate
 */
import { evaluateCompatibility } from '../../domain/compatibility/src/index.js';
import { classifyScope, deriveRecovery, evaluateScopes, gateAction, } from '../requirements/evaluator.js';
import { actionImpactClassOf } from './actions.js';
import { controlImpact, coordinationImpact, crossAgentTriggerImpact, diagnosticImpact, lifecycleImpact, normalWorkImpact, recoveryWorkImpact, } from '../requirements/action-impact.js';
import { OPTIONAL_REQUIREMENT_ACCEPTED_FACT_TYPE, RECOVERY_INCIDENT_CLOSED_FACT_TYPE, RECOVERY_INCIDENT_OPENED_FACT_TYPE, TEMPLATE_AVAILABILITY_SET_FACT_TYPE, parseOptionalRequirementAccepted, parseRecoveryIncidentClosed, parseRecoveryIncidentOpened, parseTemplateAvailabilitySet, recoveryIncidentClosedPayload, recoveryIncidentOpenedPayload, writeRequirementFact, } from '../requirements/facts.js';
import { projectVerdicts, scopeRequirementInputsOf, } from '../requirements/scope-requirements.js';
import { classifyScopeReadiness, } from '../requirement-facts/index.js';
import { ACTION_IMPACT_CLASSES, PENDING_BLOCK, SCOPE_STATES, scopeKey, teamScope, templateScope, } from '../requirements/types.js';
import { recoveryExitReady } from '../requirements/recovery.js';
import { createCompatibilityAuthority } from '../compatibility/index.js';
import { TEAM_RUNTIME_ERROR_CODES, TeamRuntimeError } from './errors.js';
// D-3 (2026-09-30) — the closed typed-code family of the PENDING outcome
// (the full documented-judgment JSDoc lives at the definition in
// `../requirements/types.js` — the closed-vocabulary home, shared with
// the creation preflight and the production root).
export { PENDING_BLOCK };
/**
 * Read the durable requirement facts of one team from the ledger (the
 * frozen `compatibility` category): the degradation consents, the template
 * availability set (latest wins per template), and the OPEN recovery
 * incidents (an opened fact without a subsequent closed fact for the same
 * scope — the append-only ledger has no delete primitive).
 *
 * A malformed durable row is a state anomaly — the read fails CLOSED (the
 * consumer must not admit on an unverifiable fact line).
 */
export function readRequirementFacts(repositories, rootSessionId) {
    const entries = repositories.ledger.list();
    const rows = [];
    for (const entry of entries) {
        if (entry.rootSessionId !== rootSessionId)
            continue;
        const record = entry;
        const factType = record.factType;
        if (factType !== OPTIONAL_REQUIREMENT_ACCEPTED_FACT_TYPE &&
            factType !== TEMPLATE_AVAILABILITY_SET_FACT_TYPE &&
            factType !== RECOVERY_INCIDENT_OPENED_FACT_TYPE &&
            factType !== RECOVERY_INCIDENT_CLOSED_FACT_TYPE) {
            continue;
        }
        rows.push({
            sequence: typeof record.sequence === 'number' ? record.sequence : Number.MAX_SAFE_INTEGER,
            factType: String(factType),
            payload: record.payload,
        });
    }
    rows.sort((a, b) => a.sequence - b.sequence);
    const consents = [];
    const availabilityByTemplate = new Map();
    const incidentLog = [];
    for (const row of rows) {
        try {
            if (row.factType === OPTIONAL_REQUIREMENT_ACCEPTED_FACT_TYPE) {
                const payload = parseOptionalRequirementAccepted(row.payload, `ledger/${row.sequence}`);
                // Finding J (2026-10-01): the consent key (scope + bound blueprint
                // content hash) rides through the durable read — a legacy row
                // carries neither (absent = the fail-closed legacy match semantics).
                consents.push({
                    requirementId: payload.requirementId,
                    generation: payload.generation,
                    consentedAt: payload.consentedAt,
                    consentedBy: payload.consentedBy,
                    ...(payload.scopeKey !== undefined ? { scopeKey: payload.scopeKey } : {}),
                    ...(payload.contentHash !== undefined ? { contentHash: payload.contentHash } : {}),
                });
            }
            else if (row.factType === TEMPLATE_AVAILABILITY_SET_FACT_TYPE) {
                const payload = parseTemplateAvailabilitySet(row.payload, `ledger/${row.sequence}`);
                // Latest wins per template (the append-only history is a log; the
                // CURRENT availability is the last set for the template).
                availabilityByTemplate.set(payload.templateId, {
                    templateId: payload.templateId,
                    available: payload.available,
                });
            }
            else if (row.factType === RECOVERY_INCIDENT_OPENED_FACT_TYPE) {
                const payload = parseRecoveryIncidentOpened(row.payload, `ledger/${row.sequence}`);
                incidentLog.push({
                    scopeKey: payload.scope,
                    requirementIds: payload.requirementIds,
                    at: payload.openedAt,
                    opened: true,
                });
            }
            else {
                const payload = parseRecoveryIncidentClosed(row.payload, `ledger/${row.sequence}`);
                incidentLog.push({
                    scopeKey: payload.scope,
                    requirementIds: payload.requirementIds,
                    at: payload.closedAt,
                    opened: false,
                });
            }
        }
        catch (error) {
            throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED, `TeamRuntime: a durable requirement fact is malformed (sequence ${row.sequence}) — admission fails closed (invariant 50)`, {
                rootSessionId,
                source: 'requirement-gate',
                reason: 'durable-fact-malformed',
                sequence: row.sequence,
                cause: error instanceof Error ? error.message : undefined,
            });
        }
    }
    // OPEN incidents: walk the per-scope log in sequence order; a scope is
    // open iff the LAST incident entry for it is an `opened` entry.
    const openByScope = new Map();
    for (const entry of incidentLog) {
        if (entry.opened) {
            openByScope.set(entry.scopeKey, {
                scopeKey: entry.scopeKey,
                requirementIds: entry.requirementIds,
                openedAt: entry.at,
            });
        }
        else {
            openByScope.delete(entry.scopeKey);
        }
    }
    return {
        consents,
        availability: [...availabilityByTemplate.values()],
        openIncidents: [...openByScope.values()],
    };
}
/**
 * Evaluate EVERY scope of the bound blueprint against ONE fresh environment
 * facts read (plan §E.4): the Team scope through the single compatibility
 * authority chain (durable, fresh, re-probed as needed) and each v2
 * template scope with a fresh engine evaluation (no durable generation —
 * template-scope readiness resets on restart).
 *
 * pre-alpha3 W3-A (review fix F1, guide §2.3): when the `templateEnvironmentFacts`
 * port is present (the production live source), each template scope is
 * evaluated against ITS OWN fresh feed (supply + readiness + materialization
 * at the template boundary) instead of the team scope's array — see
 * {@link RequirementGateOptions.templateEnvironmentFacts} for why the feeds
 * must not be unioned. Absent (factory worlds) → every scope evaluates
 * against the same fresh team-scope facts read (the legacy behavior).
 *
 * @throws {@link TeamRuntimeError} COMPATIBILITY_BLOCKED (fail-closed) when
 *   the facts port fails or the authority chain cannot produce a verdict.
 */
export async function evaluateAllScopes(repositories, blueprint, rootSessionId, environmentFacts, now, templateEnvironmentFacts) {
    const inputs = scopeRequirementInputsOf(blueprint);
    // 1. Fresh facts read (a failure is a chain failure — never an admission).
    let facts;
    try {
        facts = await environmentFacts();
    }
    catch (error) {
        throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED, 'TeamRuntime: the environment-facts port failed — new work admission fails closed (invariant 50)', {
            rootSessionId,
            source: 'requirement-gate',
            reason: 'facts-unavailable',
            cause: error instanceof Error ? error.message : undefined,
        });
    }
    // 2. Team scope: the SINGLE compatibility authority chain (the P8-S4A
    //    exact chain; the v2 structured teamRequirements ride the same
    //    durable generation through the extended bridge).
    const authority = createCompatibilityAuthority({
        repositories,
        rootSessionId,
        blueprint,
        environmentFacts,
        ...(now !== undefined ? { now } : {}),
    });
    const evaluation = await authority.evaluate();
    if (!evaluation.chainOk) {
        throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED, `TeamRuntime: compatibility could not be established (${evaluation.reprobeReason}) — new work admission fails closed (invariant 50)`, {
            rootSessionId,
            source: 'compatibility-authority',
            reason: evaluation.reprobeReason,
        });
    }
    const teamResult = evaluation.result;
    const rawScopeVerdicts = {
        team: projectVerdicts(teamResult),
    };
    // 3. Template scopes: FRESH engine evaluations (v2 only — v1 documents
    //    carry no per-template requirements; no durable state, readiness
    //    resets on restart). pre-alpha3 W3-A (review fix F1, guide §2.3):
    //    with the per-template feed port present, each template scope reads
    //    ITS OWN live feed (the template boundary: supply + fresh readiness +
    //    materialization) — a read failure is a chain failure (fail-closed,
    //    the same contract as the team-scope facts read); without it (factory
    //    worlds) the same team-scope facts array is used (legacy).
    // A4-PR7 §7.3 Option A (decision record: dev/agent-workflow/evidence/a4-pr7/7-3-decision/Dossier.md):
    // the §E.2 grammar is a property of the blueprint SHAPE, not of its version digit — the scope list
    // `inputs.templates` is the shape (empty for a document that declares nothing), so no version test.
    {
        for (const [templateId, requirementInputs] of Object.entries(inputs.templates)) {
            let templateFacts;
            if (templateEnvironmentFacts === undefined) {
                templateFacts = facts;
            }
            else {
                try {
                    templateFacts = await templateEnvironmentFacts(templateId);
                }
                catch (error) {
                    throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED, `TeamRuntime: the template-environment-facts port failed for template '${templateId}' — new work admission fails closed (invariant 50)`, {
                        rootSessionId,
                        source: 'requirement-gate',
                        reason: 'facts-unavailable',
                        templateId,
                        cause: error instanceof Error ? error.message : undefined,
                    });
                }
            }
            // The engine re-validates (parses) its inputs itself.
            const templateResult = evaluateCompatibility({
                requirements: requirementInputs,
                environmentFacts: templateFacts,
            });
            rawScopeVerdicts[scopeKey({ level: 'template', templateId })] = projectVerdicts(templateResult);
        }
    }
    const scopeStates = evaluateScopes({ scopeVerdicts: rawScopeVerdicts });
    return { scopeVerdicts: rawScopeVerdicts, scopeStates, teamResult, facts };
}
/**
 * D-3 (2026-09-30) — the live 3-state readiness analysis across the
 * action's impact scopes (pure over the captured full-resolution reads).
 *
 * For each scope in `impact.scopeRefs` (the Team scope when the action's
 * work depends on it; a template scope only when the action names it —
 * applicability gates BEFORE readiness: an impact never references a scope
 * the work does not depend on, E.11 negative #1), it delegates to the
 * shared {@link classifyScopeReadiness} (the COLD-member `not-applicable`
 * mcpServer exemption lives there, guide §2.5.4) and aggregates:
 *
 * - `downRequired` — a required requirement observed `unreachable` (a
 *   confirmed down; takes precedence over pending);
 * - `pendingRequired` — a required requirement observed `unknown` and
 *   IN-FLIGHT (a pending materialization slot exists on a live session —
 *   the B5 transient window; the PF-2 tri-state, 2026-09-30 option A: a
 *   NEVER-OBSERVED unknown is seed-satisfied — the seed's truth decides)
 *   that is NOT also down.
 *
 * The 2-state engine verdict is deliberately NOT consulted: the seed can
 * satisfy an unknown required fact (a false PASS), and a no-seed unknown
 * reads as a missing FATAL — both are reclassified from the 3-state truth
 * (the feed contract: an unknown observation never yields a live verdict).
 * Returns empty sets when no read was captured (legacy / factory worlds —
 * the PENDING rule is off).
 */
function analyzeLiveReadiness(blueprint, impact, teamRead, templateReads) {
    const inputs = scopeRequirementInputsOf(blueprint);
    const pendingRequired = [];
    const downRequired = [];
    for (const scope of impact.scopeRefs) {
        let scopeInputs;
        let observations;
        if (scope.level === 'team') {
            scopeInputs = inputs.team;
            observations = teamRead?.observations;
        }
        else {
            const templateId = scope.templateId;
            if (templateId === undefined)
                continue;
            scopeInputs = inputs.templates[templateId] ?? [];
            observations = templateReads.get(templateId)?.observations;
        }
        if (observations === undefined || observations.length === 0)
            continue;
        const classification = classifyScopeReadiness({
            scopeKey: scopeKey(scope),
            inputs: scopeInputs,
            observations,
        });
        pendingRequired.push(...classification.pending);
        downRequired.push(...classification.down);
    }
    return { pendingRequired, downRequired };
}
/**
 * Finding F (target-specific close) — whether the SCOPE's OWN
 * materialization is satisfied on the scope's captured conservative
 * (template-only) read: every mcpServer observation `mounted` or
 * `not-applicable` (the converged / never-applicable truth). A `failed`
 * or `pending` live instance — or the omitted mixed worst case (the host
 * port withholds the axis when the live instances have not ALL
 * converged) — keeps the scope's materialization UNSATISFIED: the
 * incident stays open until the scope's own instances converge
 * (plan §E.10 + Finding F: a healthy sibling's fresh verdict is not the
 * scope's truth). Observations without a materialization axis
 * (non-mcpServer types) are unconstrained.
 *
 * @returns `true` (the legacy verdict-only exit) when no scope read was
 *   captured for the scope (legacy / factory worlds, the team scope).
 */
function scopeMaterializationSatisfied(scopeKey, templateReads) {
    const prefix = 'template:';
    if (!scopeKey.startsWith(prefix))
        return true;
    const read = templateReads.get(scopeKey.slice(prefix.length));
    if (read === undefined)
        return true;
    return read.observations.every((observation) => observation.type !== 'mcpServer' ||
        observation.materialization === 'mounted' ||
        observation.materialization === 'not-applicable');
}
/**
 * Step 4a (PR-E) — the requirement gate for NEW WORK (invariant 50).
 *
 * Consumes the full scope evaluation (every declared scope, one fresh facts
 * read) + the durable requirement facts, gates the action on its
 * requirement IMPACT (never the coarse category alone), performs the
 * incident bookkeeping (open on the first allowed recovery passage; close
 * on the blocked→ready transition — the §E.10 exit record), and throws
 * `COMPATIBILITY_BLOCKED` (fail-closed) when the action is blocked.
 *
 * @param options - the injected repositories / blueprint / facts port.
 * @param impact - the action's requirement-impact metadata (the closed
 *   impact class + the scopes the action's work depends on).
 * @returns the allowed outcome (the recovery scopes when allowed AS
 *   recovery work).
 * @throws {@link TeamRuntimeError} COMPATIBILITY_BLOCKED (blocked /
 *   fail-closed).
 */
export async function enforceRequirementGate(options, impact) {
    const { repositories, blueprint, rootSessionId } = options;
    // D-3 (2026-09-30) — the ATOMIC facts + observations pair: when the
    // full-resolution read port is present, the team-scope facts thunk is a
    // CAPTURING wrapper over it — the authority's inline re-probe re-reads
    // through the SAME thunk, so `teamRead` always holds the observations
    // of the last call, i.e. the observations of the facts the verdict was
    // computed from (no cross-call staleness between the verdict and the
    // PENDING rule). Template scopes capture per template. Absent → the
    // legacy facts-only ports stand byte-identically (no PENDING rule).
    let teamRead;
    const teamFacts = options.environmentFactsRead !== undefined
        ? async () => {
            teamRead = await options.environmentFactsRead();
            return teamRead.environmentFacts;
        }
        : options.environmentFacts;
    const templateReads = new Map();
    const templateFacts = options.templateEnvironmentFactsRead !== undefined
        ? async (templateId) => {
            // Finding F (scoped identity): the scope read is the TEMPLATE-
            // ONLY conservative read, scoped to the action's OWNING root
            // (the multi-root host shape: the port lists THIS root's
            // instances — never the entry's boot root, the cross-root
            // conflation Finding F reports). This read feeds the scope
            // verdicts (the incident/recovery bookkeeping's own truth).
            const resolution = await options.templateEnvironmentFactsRead(templateId, { rootSessionId });
            templateReads.set(templateId, resolution);
            return resolution.environmentFacts;
        }
        : options.templateEnvironmentFacts;
    const { scopeVerdicts, scopeStates } = await evaluateAllScopes(repositories, blueprint, rootSessionId, teamFacts, options.now, templateFacts);
    const { consents, availability, openIncidents } = readRequirementFacts(repositories, rootSessionId);
    // Finding F (target-specific decision) — the TARGET instance's OWN
    // boundary read (the decision read). Performed only when the action
    // names a target instance AND the full-resolution read port is present
    // (the production host world — the legacy facts-only worlds have no
    // instance axis and stay byte-identical). The action's impact names at
    // most ONE template scope, and the router passes `targetInstanceId`
    // only for an instance of that named template (the router resolved the
    // row), so the target template is the impact's single template ref.
    // The DECISION reads the target's own boundary (a failed target gates
    // the action — the masked failure Finding F reports — while a healthy
    // target passes under a failed sibling); the scope verdicts above keep
    // the conservative worst case (the incident bookkeeping's truth). A
    // read failure is a chain failure (fail-closed, the same contract as
    // the scope read, invariant 50).
    const targetInstanceId = options.targetInstanceId;
    const targetTemplateId = targetInstanceId !== undefined
        ? impact.scopeRefs.find((ref) => ref.level === 'template')?.templateId
        : undefined;
    let targetRead;
    const decisionScopeVerdicts = { ...scopeVerdicts };
    if (targetInstanceId !== undefined && targetTemplateId !== undefined && options.templateEnvironmentFactsRead !== undefined) {
        let resolution;
        try {
            resolution = await options.templateEnvironmentFactsRead(targetTemplateId, {
                rootSessionId,
                instanceId: targetInstanceId,
            });
        }
        catch (error) {
            throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED, `TeamRuntime: the target-instance environment-facts read failed for template '${targetTemplateId}' instance '${targetInstanceId}' — new work admission fails closed (invariant 50)`, {
                rootSessionId,
                source: 'requirement-gate',
                reason: 'facts-unavailable',
                templateId: targetTemplateId,
                cause: error instanceof Error ? error.message : undefined,
            });
        }
        targetRead = resolution;
        // The decision's view of the target template: the target instance's
        // OWN 2-state feed (the engine re-validates its inputs itself).
        decisionScopeVerdicts[scopeKey({ level: 'template', templateId: targetTemplateId })] = projectVerdicts(evaluateCompatibility({
            requirements: scopeRequirementInputsOf(blueprint).templates[targetTemplateId] ?? [],
            environmentFacts: resolution.environmentFacts,
        }));
    }
    // The decision reads the TARGET boundary (the merged view); the scope
    // states + recovery keep the conservative worst case (the bookkeeping
    // truth — the incident closes only on the scope's own convergence).
    const decision = gateAction(impact, {
        scopeVerdicts: decisionScopeVerdicts,
        consents,
        availability,
    });
    const recovery = deriveRecovery(scopeStates);
    // D-3 (2026-09-30, adjudicated product semantics — fail-closed PENDING;
    // the product fix for the seed-filled false OPEN) — the LIVE 3-state
    // readiness rule. It reads the observations DIRECTLY (never the
    // seed-satisfied 2-state engine verdict, which the bootstrap seed can
    // satisfy: static available:true + live unknown → the engine PASS is
    // NOT the runtime truth, guide §2.5), scoped to the action's impact
    // (a COLD / not-applicable member template is never in the refs — its
    // requirements never PENDING-block; E.11 negative #1 "cold member
    // required MCP + mounted false ≠ blocked" stays green: applicability
    // gates before readiness).
    //
    // Precedence (documented judgment on the closed typed-code family —
    // see {@link PENDING_BLOCK}):
    //   1. a required capability observed DOWN (live unreachable) → the
    //      existing FATAL-down block stands (the actionable one — the
    //      recovery dispatch is offered; a pending observation alongside a
    //      confirmed down is subsumed);
    //   2. otherwise, a required capability live-UNKNOWN and IN-FLIGHT (a
    //      pending materialization slot exists on a live session — the B5
    //      transient window) → the typed PENDING block:
    //        a. the decision would ALLOW (the engine PASS is a seed-filled
    //           false OPEN — the exact D-3 defect) → block PENDING;
    //        b. the decision is blocked as `requiredScopeDown` (a no-seed
    //           unknown the engine reported as a missing FATAL) →
    //           RECLASSIFY to PENDING (it is not a confirmed down — it is
    //           recheckable; the block stands, the category is honest);
    //        c. the decision is blocked for a deterministic non-readiness
    //           reason (`templateDisabled`) → that block stands (it is
    //           more deterministic than the live-readiness state);
    //   3. otherwise → the existing decision proceeds.
    //
    // PF-2 tri-state (2026-09-30 — parent adjudication option A): an UNKNOWN
    // that is NEVER-OBSERVED (no fiber / pending slot / failed slot on ANY
    // live session — the first-create bootstrap window) is NOT in the
    // pending partition — the seed-satisfied 2-state decides there (seed
    // truth, C.2/E.6; not a blanket OPEN). The gate reads the ONE shared
    // classifier predicate — the probe, the preflight and the activation
    // step classify identically (probe == gate, INV-9.4).
    //
    // The PENDING block is a VERDICT, not a write (zero durable effect — no
    // incident bookkeeping runs); it is RECHECKABLE by construction: PENDING
    // now means IN-FLIGHT ONLY (the PF-2 product-message correction — the
    // never-observed state that only the blocked action could settle no
    // longer PENDINGs), so it clears on the next boundary (any later
    // passage re-evaluates on a fresh read) or via the manual
    // `compatibility.reprobe` seam — a stuck slot is honest, not a
    // deadlock. Absent read ports (legacy / factory worlds) → no
    // observations → the rule is off (byte-identical).
    // Finding F (target-specific decision) — the live-readiness analysis
    // consumes the DECISION's read view: the target template's observations
    // come from the target instance's OWN read (no spurious PENDING/down for
    // a healthy target under a failed sibling; the target's own failed
    // materialization is the down signal the mask hides from the aggregate
    // probe). Non-target templates keep their own scope reads.
    const decisionReads = new Map(templateReads);
    if (targetRead !== undefined && targetTemplateId !== undefined) {
        decisionReads.set(targetTemplateId, targetRead);
    }
    const liveReadiness = analyzeLiveReadiness(blueprint, impact, teamRead, decisionReads);
    const hasLiveDown = liveReadiness.downRequired.length > 0;
    const hasLivePending = liveReadiness.pendingRequired.length > 0;
    const noSeedFatalReclassify = !decision.allowed && decision.reason === 'requiredScopeDown';
    if (!hasLiveDown && hasLivePending && (decision.allowed || noSeedFatalReclassify)) {
        throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED, 'TeamRuntime: a required capability is not yet observed (materialization pending) — new work admission is blocked with the typed PENDING outcome (fail-closed; recheck at the next boundary or via the compatibility reprobe)', {
            rootSessionId,
            status: PENDING_BLOCK.status,
            gateReason: PENDING_BLOCK.gateReason,
            blockedScopes: [...new Set(liveReadiness.pendingRequired.map((entry) => entry.scopeKey))],
            pendingRequirements: liveReadiness.pendingRequired.map((entry) => ({
                requirementId: entry.requirementId,
                subject: entry.subject,
            })),
            recheck: PENDING_BLOCK.recheck,
            source: 'requirement-gate',
            // No recovery dispatch for a pending scope: the reduced authority
            // computation needs a KNOWN-DOWN set (plan §E.9) — a pending
            // observation offers nothing to reduce against (fail-closed).
            recoveryDispatchAvailable: false,
        });
    }
    if (!decision.allowed) {
        throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED, decision.reason === 'templateDisabled'
            ? 'TeamRuntime: the targeted template is disabled — its work cannot start (availability, not a policy denial; re-enable the template or fix + recheck its requirements)'
            : `TeamRuntime: a required scope is down (${(decision.blockedScopes ?? [])
                .map((scope) => scopeKey(scope))
                .join(', ')}) — new work admission is blocked (invariant 50)`, {
            rootSessionId,
            status: 'BLOCKED_FATAL',
            gateReason: decision.reason,
            blockedScopes: (decision.blockedScopes ?? []).map((scope) => scopeKey(scope)),
            blockingRequirementIds: (decision.blockedScopes ?? []).flatMap((scope) => {
                const verdict = scopeStates.find((v) => scopeKey(v.scope) === scopeKey(scope));
                return (verdict?.fatal ?? []).map((requirement) => requirement.requirementId);
            }),
            // The downed capability subjects across the blocked scopes' fatal
            // verdicts (the reduced authority excludes exactly these — plan
            // §E.9; the router carries them into the recovery marker).
            unavailableSubjects: [
                ...new Set((decision.blockedScopes ?? []).flatMap((scope) => {
                    const verdict = scopeStates.find((v) => scopeKey(v.scope) === scopeKey(scope));
                    return (verdict?.fatal ?? []).flatMap((requirement) => requirement.unavailableSubjects);
                })),
            ],
            source: 'requirement-gate',
            // Recovery dispatch availability (plan §E.9): the caller (the
            // router) may offer the human-reviewed recovery Control coupling
            // for the blocked scopes — ONLY when a required scope is down.
            recoveryDispatchAvailable: decision.reason === 'requiredScopeDown' && recovery.open,
        });
    }
    // Allowed — the incident bookkeeping (the caller runs this under the
    // team lock, so the fact line is serialized with every other durable
    // team write).
    const nowMs = options.nowMs ?? Date.now;
    const isoNow = options.now ?? (() => new Date(nowMs()).toISOString());
    if (decision.reason === 'recoveryAllowed') {
        for (const scope of decision.recoveryScopes ?? []) {
            const key = scopeKey(scope);
            if (openIncidents.some((incident) => incident.scopeKey === key))
                continue;
            const verdict = scopeStates.find((v) => scopeKey(v.scope) === key);
            await writeRequirementFact(repositories.ledger, rootSessionId, RECOVERY_INCIDENT_OPENED_FACT_TYPE, recoveryIncidentOpenedPayload({
                scope: key,
                requirementIds: (verdict?.fatal ?? []).map((requirement) => requirement.requirementId),
                openedAt: nowMs(),
            }), isoNow);
        }
    }
    // Exit record (plan §E.10): an open incident whose scope is no longer
    // blocked on the fresh evaluation is CLOSED (the exit is the derived
    // state flipping; the record is the durable history, never a flag).
    // Finding F (target-specific close): the exit reads the SCOPE's OWN
    // materialization (the conservative worst-case scope read — every
    // mcpServer observation `mounted` or `not-applicable`): fixing a
    // healthy sibling must NOT close the incident of a scope that still
    // carries a failed or in-flight instance. The pure exit check is the
    // shared {@link recoveryExitReady} (verdict PASS + materialization).
    // No captured scope read (legacy / factory worlds, the team scope) →
    // `materializationSatisfied: true` → the legacy verdict-only exit
    // stands byte-identically.
    for (const incident of openIncidents) {
        const verdict = scopeStates.find((v) => scopeKey(v.scope) === incident.scopeKey);
        if (verdict === undefined)
            continue;
        if (verdict.state === SCOPE_STATES.blocked)
            continue;
        if (!recoveryExitReady({
            scopeVerdicts: [verdict],
            materializationSatisfied: scopeMaterializationSatisfied(incident.scopeKey, templateReads),
        }).canExit) {
            continue;
        }
        await writeRequirementFact(repositories.ledger, rootSessionId, RECOVERY_INCIDENT_CLOSED_FACT_TYPE, recoveryIncidentClosedPayload({
            scope: incident.scopeKey,
            requirementIds: incident.requirementIds,
            closedAt: nowMs(),
        }), isoNow);
    }
    return {
        reason: decision.reason,
        ...(decision.recoveryScopes !== undefined ? { recoveryScopes: decision.recoveryScopes } : {}),
        scopeVerdicts: scopeStates,
        recovery,
    };
}
/**
 * Build the requirement IMPACT of one named action for the gate (plan §E.7):
 * the closed impact class of the action (the static `ACTION_REQUIREMENT_IMPACT`
 * map) + the scopes the action's work depends on (the Team scope always,
 * plus the targeted template scope when the action names one). The
 * `recoveryWork` / `control` classes are never static: a recovery operation
 * is the caller-context choice (the human-reviewed dispatch — `recovery`
 * true) and a control operation is the Control surface itself.
 *
 * @param actionName - the closed action name.
 * @param targetTemplateId - the template the action's work targets (the
 *   follow-up/delegate/create-member addressing), or `undefined` when the
 *   action names no template (the Team scope only).
 * @param recovery - whether this attempt is the reviewed recovery dispatch
 *   (the normal-work actions become `recoveryWork` for the blocked scopes).
 * @returns the frozen {@link ActionImpact}.
 */
export function actionImpactOf(actionName, targetTemplateId, recovery) {
    const scopeRefs = targetTemplateId !== undefined && targetTemplateId.length > 0
        ? [teamScope(), templateScope(targetTemplateId)]
        : [teamScope()];
    if (recovery) {
        // A reviewed recovery attempt of a normal-work action (plan §E.9).
        return recoveryWorkImpact(scopeRefs);
    }
    const cls = actionImpactClassOf(actionName);
    switch (cls) {
        case ACTION_IMPACT_CLASSES.normalWork:
            return normalWorkImpact(scopeRefs);
        case ACTION_IMPACT_CLASSES.diagnostic:
            return diagnosticImpact(scopeRefs);
        case ACTION_IMPACT_CLASSES.coordination:
            return coordinationImpact(scopeRefs);
        case ACTION_IMPACT_CLASSES.lifecycle:
            return lifecycleImpact(scopeRefs);
        case ACTION_IMPACT_CLASSES.control:
            return controlImpact(scopeRefs);
        case ACTION_IMPACT_CLASSES.crossAgentTrigger:
            // pre-alpha3 W3-D (review fix F9, guide §8): the cross-agent execution
            // trigger (send-message) gates on the SAME scopes the action was
            // admitted with (Team + the recipient's template when named); the
            // `gateAction` blocks it if ANY is down. A recovery re-run of the
            // trigger (the `recovery` marker) is handled above (recoveryWorkImpact)
            // and escalates the wake to synchronous Human Review at the router.
            return crossAgentTriggerImpact(scopeRefs);
        case ACTION_IMPACT_CLASSES.recoveryWork:
            // Not reachable from a static map (the recovery class is a caller
            // choice); treat as normal work (the safe direction).
            return normalWorkImpact(scopeRefs);
        default:
            // Unknown name: the conservative default — gate it as normal work on
            // the Team scope (never an un-gated pass-through for a new-work
            // admission; invariant 50).
            return normalWorkImpact(scopeRefs);
    }
}
//# sourceMappingURL=requirement-gate.js.map