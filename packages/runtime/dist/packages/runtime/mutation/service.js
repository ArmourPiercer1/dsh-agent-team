/**
 * P7-T2 — the runtime mutation service (TaskDoc §11.8 P7-T2; Development
 * Plan §20.2).
 *
 * The service implements the frozen "Runtime mutation" contract as a PURE
 * state machine over its injected ports (clock / store / reader — see
 * {@link ./types.js}):
 *
 * - **Future-boundary mutation** (DevPlan §20.2, Architecture
 *   §21.3–§21.5): every admitted mutation — capability value, state
 *   transition, pre-first-RUNNING workspace change — takes effect from
 *   `effectiveFromStep = requestedAtStep + 1`. Already-captured in-flight
 *   work (`beginStep` captures) holds its step's frozen resolution and is
 *   NEVER re-pointed at a concurrent mutation.
 * - **Escalation intake** (Architecture §19.3, invariants 36/37): agent
 *   origins (leader / member) are checked against the frozen team autonomy
 *   envelope (blueprint ∩ template mutationEnvelope, via the P3-T4
 *   validator — never re-implemented); violations are REJECTED at the
 *   boundary with the frozen code strings (`MEMBER_SELF_ESCALATION` /
 *   `LEADER_OUT_OF_ENVELOPE`). Human origin is not envelope-bounded
 *   (invariant 34).
 * - **External hard facts** (Architecture §19.2, invariant 35): checked
 *   for EVERY origin (human included) — `capabilityExists === false`
 *   rejects an allow grant, an external hard `deny` rejects it, and a
 *   hard allow-list restricts the grantable items. No Team actor can
 *   bypass them.
 * - **PolicyState** (Architecture §20.4, invariant 40): transitions are
 *   admitted ONLY for explicit human / authorized-leader actors
 *   (`UNAUTHORIZED_TRANSITION` otherwise); they are future-boundary
 *   mutations; the suppression of stored allow overlays under a locked
 *   cell is recorded LAZELY at resolution time (non-destructive, §19.4 —
 *   the durable overlay record is never deleted and becomes effective
 *   again when the state relaxes).
 * - **Creation fields** (Architecture §21.2/§21.6): `contextPolicy` is
 *   immutable from registration (`IMMUTABLE_CREATION_FIELD` always);
 *   `workspace` is mutable until the instance's first RUNNING (the
 *   `beginStep` call marks it), immutable after.
 * - **Resolution** (DevPlan §20.2 "所有 effective config 都必须可解释
 *   provenance"): `resolveEffective` reuses the FROZEN P3-T4 resolver
 *   verbatim (the runtime never re-implements resolution); the
 *   `EffectiveConfiguration` output carries, beside the frozen
 *   per-cell provenance, the module's source chain — every provenance
 *   ledger entry in force at the step (`contributions`) — so every
 *   effective item resolves to an explainable source.
 *
 * Pure module: no I/O, no DSH imports, no ambient state.
 *
 * @module @dsh-agent-team/runtime/mutation/service
 */
import { assertMemberIdentityInTeam, CAPABILITY_NAME_VALUES, createMemberIdentity, deepFreeze, parseInstanceId, parseRootSessionId, parseTeamSessionId, PolicyResolutionError, POLICY_ERROR_CODES, resolveEffectivePolicy, } from '../../domain/policy/src/index.js';
import { assembleEffectivePolicyInput, activePolicyState, } from '../policy-adapter.js';
import { MutationError, MUTATION_ERROR_CODES } from './errors.js';
import { MUTATION_RECORD_KINDS } from './types.js';
import { checkAgainstEnvelope, memberEnvelopeItems, teamEnvelopeItems, } from './envelope.js';
/**
 * The runtime mutation service of one TeamSession group. Stateless with
 * respect to the ports (all durable state lives in the store); the only
 * service-local state is the in-flight capture set (diagnostic) and the
 * default id counter.
 */
export class MutationService {
    deps;
    idCounter;
    inflight;
    constructor(deps) {
        this.deps = deps;
        this.idCounter = 0;
        this.inflight = new Set();
    }
    /** The number of in-flight (unreleased) step captures (diagnostic). */
    inflightCount() {
        return this.inflight.size;
    }
    // -------------------------------------------------------------------------
    // Capability mutations (model / tools / permissions / skills / mcp)
    // -------------------------------------------------------------------------
    /**
     * Admit one capability mutation request (future-boundary). See the
     * module doc for the intake pipeline. Returns the durable record.
     *
     * @throws {@link MutationError} — `MALFORMED_MUTATION_INPUT` (request
     *   shape / stored facts), `IDENTITY_SCOPE_MISMATCH` (cross-team
     *   member), `EXTERNAL_HARD_REJECTED` (beyond the external hard facts,
     *   every origin), `MEMBER_SELF_ESCALATION` /
     *   `LEADER_OUT_OF_ENVELOPE` (agent origin beyond the autonomy
     *   envelope).
     */
    requestMutation(request) {
        const teamSessionId = assertTeamSessionId(request.teamSessionId);
        const capability = assertCapability(request.capability);
        const value = normalizePolicyEntry(request.value, 'value');
        const actor = assertActorKind(request.actor.kind);
        // Scope / target selection (closed by actor kind — see the types doc).
        let scope;
        let recordMember;
        if (actor === 'human') {
            scope = request.scope ?? 'team';
            if (scope !== 'team' && scope !== 'instance') {
                throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, `malformed mutation input at actor.scope: must be 'team' or 'instance' (got '${String(request.scope)}')`, { field: 'actor.scope' });
            }
            if (scope === 'instance') {
                recordMember = assertMemberInTeam(request.targetMember, teamSessionId, 'targetMember');
            }
            else if (request.targetMember !== undefined) {
                throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, "malformed mutation input at targetMember: team-scoped human overrides carry no target", { field: 'targetMember' });
            }
        }
        else {
            scope = actor === 'leader' ? 'team' : 'instance';
            if (request.scope !== undefined) {
                throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, `malformed mutation input at actor.scope: scope is fixed by the actor kind for origin '${actor}'`, { field: 'actor.scope', origin: actor });
            }
            if (request.targetMember !== undefined) {
                throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, 'malformed mutation input at targetMember: only instance-scoped human overrides carry a target', { field: 'targetMember', origin: actor });
            }
            if (actor === 'member') {
                recordMember = assertMemberInTeam(request.actor.member, teamSessionId, 'actor.member');
            }
        }
        // External hard facts: EVERY origin (invariant 35; §19.5 — the human
        // override cannot bypass them either).
        this.checkExternalHard(teamSessionId, capability, value);
        // Team autonomy envelope: AGENT origins only (invariants 36/37).
        if (actor !== 'human') {
            const blueprint = this.deps.policy.readBlueprintEnvelope(teamSessionId);
            const origin = actor;
            if (actor === 'member') {
                const recordIdentity = recordMember;
                if (recordIdentity === undefined) {
                    // Unreachable (assigned above for member origin) 鈥?defensive invariant.
                    throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, 'malformed mutation input: member origin requires a validated member identity', { field: 'actor.member' });
                }
                const template = this.deps.policy.readTemplatePolicy(teamSessionId, recordIdentity);
                const envelope = memberEnvelopeItems(teamSessionId, recordIdentity, blueprint, template);
                checkAgainstEnvelope(capability, value, envelope, origin);
            }
            else {
                const members = this.registeredMembers(teamSessionId);
                const envelope = teamEnvelopeItems(teamSessionId, members, blueprint, (team, member) => this.deps.policy.readTemplatePolicy(team, member));
                checkAgainstEnvelope(capability, value, envelope, origin);
            }
        }
        const kind = actor === 'leader'
            ? MUTATION_RECORD_KINDS.TEMPLATE_OVERLAY
            : actor === 'member'
                ? MUTATION_RECORD_KINDS.INSTANCE_OVERLAY
                : MUTATION_RECORD_KINDS.HUMAN_OVERRIDE;
        const requestedAtStep = this.deps.clock.currentStep();
        const values = {};
        values[capability] = value;
        const record = deepFreeze({
            recordId: this.mintId('mutation'),
            kind,
            scope,
            // null — never undefined: the record is deep-frozen (lossless JSON).
            member: recordMember ?? null,
            origin: actor,
            values,
            requestedAtStep,
            effectiveFromStep: requestedAtStep + 1,
        });
        this.deps.store.appendRecord(teamSessionId, record);
        this.appendLedger({
            teamSessionId,
            capability,
            recordKind: kind,
            origin: actor,
            value,
            recordId: record.recordId,
            requestedAtStep,
            effectiveFromStep: record.effectiveFromStep,
        });
        return record;
    }
    // -------------------------------------------------------------------------
    // PolicyState transitions (§20.4, invariant 40)
    // -------------------------------------------------------------------------
    /**
     * Admit one explicit PolicyState transition (future-boundary). Only
     * explicit human / authorized-leader actors are authorized
     * (`UNAUTHORIZED_TRANSITION` otherwise). The target state is validated
     * with the same structural rules the frozen resolver applies (closed
     * capability keys; cell = `{locked?, value?}` only).
     */
    switchPolicyState(request) {
        const teamSessionId = assertTeamSessionId(request.teamSessionId);
        const actor = assertActorKind(request.actor.kind);
        if (actor === 'member') {
            throw new MutationError(MUTATION_ERROR_CODES.UNAUTHORIZED_TRANSITION, 'a PolicyState transition by an ordinary member is unauthorized (only explicit human / authorized-leader transitions exist, invariant 40)', { allowedActors: ['human', 'leader'] });
        }
        if (request.actor.member !== undefined) {
            throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, 'malformed transition request: transition actors are TeamSession-level (no member)', { field: 'actor.member' });
        }
        const state = normalizeStateView(request.target, 'target');
        const requestedAtStep = this.deps.clock.currentStep();
        const entryId = this.mintId('ledger');
        const transition = deepFreeze({
            entryId,
            origin: actor,
            state,
            requestedAtStep,
            effectiveFromStep: requestedAtStep + 1,
        });
        this.deps.store.appendTransition(teamSessionId, transition);
        this.appendLedger({
            teamSessionId,
            recordKind: 'policyStateTransition',
            origin: actor,
            stateId: state.stateId,
            requestedAtStep,
            effectiveFromStep: transition.effectiveFromStep,
        });
        return transition;
    }
    // -------------------------------------------------------------------------
    // Creation fields (§21.2 / §21.6)
    // -------------------------------------------------------------------------
    /**
     * Register the creation fields of a MemberInstance (once). Records the
     * `workspace` (mutable until first RUNNING, §21.2) and the
     * `contextPolicy` (immutable from this moment, §21.6), and starts their
     * provenance ledger entries.
     */
    registerInstance(teamSessionId, member, fields) {
        const team = assertTeamSessionId(teamSessionId);
        const identity = assertMemberInTeam(member, team, 'member');
        const workspace = assertCreationFieldValue(fields.workspace, 'workspace');
        const contextPolicy = assertCreationFieldValue(fields.contextPolicy, 'contextPolicy');
        if (this.deps.store.getCreationFields(team, identity.instanceId) !== undefined) {
            throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, `malformed registration: instance '${identity.instanceId}' already has registered creation fields`, { field: 'instance', instanceId: identity.instanceId });
        }
        this.deps.store.registerCreationFields(team, identity, { workspace, contextPolicy });
        const step = this.deps.clock.currentStep();
        for (const [field, fieldValue] of [
            ['workspace', workspace],
            ['contextPolicy', contextPolicy],
        ]) {
            this.appendLedger({
                teamSessionId: team,
                recordKind: 'creationField',
                origin: 'static',
                field,
                instanceId: identity.instanceId,
                fieldValue,
                requestedAtStep: step,
                effectiveFromStep: step + 1,
            });
        }
    }
    /**
     * Request a post-creation change of a creation field. `contextPolicy`
     * is ALWAYS rejected (`IMMUTABLE_CREATION_FIELD`, §21.6); `workspace`
     * is admitted only BEFORE the instance's first RUNNING (§21.2) and
     * rejected after. An unregistered instance is `UNKNOWN_INSTANCE`.
     */
    requestCreationFieldMutation(request) {
        const team = assertTeamSessionId(request.teamSessionId);
        const identity = assertMemberInTeam(request.member, team, 'member');
        const field = assertCreationField(request.field);
        const value = assertCreationFieldValue(request.value, 'value');
        if (this.deps.store.getCreationFields(team, identity.instanceId) === undefined) {
            throw new MutationError(MUTATION_ERROR_CODES.UNKNOWN_INSTANCE, `instance '${identity.instanceId}' has no registered creation fields in TeamSession '${team}'`, { instanceId: identity.instanceId });
        }
        if (field === 'contextPolicy') {
            throw new MutationError(MUTATION_ERROR_CODES.IMMUTABLE_CREATION_FIELD, 'contextPolicy is immutable from MemberInstance creation (§21.6)', { field, rule: 'immutableAfterCreation', instanceId: identity.instanceId });
        }
        if (this.deps.store.isRunning(team, identity.instanceId)) {
            throw new MutationError(MUTATION_ERROR_CODES.IMMUTABLE_CREATION_FIELD, 'workspace is immutable after the instance first reached RUNNING (§21.2)', { field, rule: 'immutableAfterFirstRunning', instanceId: identity.instanceId });
        }
        this.deps.store.setWorkspace(team, identity.instanceId, value);
        const step = this.deps.clock.currentStep();
        this.appendLedger({
            teamSessionId: team,
            recordKind: 'creationField',
            origin: 'static',
            field,
            instanceId: identity.instanceId,
            fieldValue: value,
            requestedAtStep: step,
            effectiveFromStep: step + 1,
        });
    }
    // -------------------------------------------------------------------------
    // Step boundary: in-flight capture + resolution
    // -------------------------------------------------------------------------
    /**
     * Begin one step of one member: mark first RUNNING (locks the
     * workspace, §21.2) and capture the effective configuration at the
     * step boundary. The capture is a frozen value — later mutations never
     * reach in-flight work (the DevPlan §20.2 future-boundary contract);
     * `release()` settles the step.
     *
     * @throws {@link MutationError} `UNKNOWN_INSTANCE` when the instance
     *   has no registered creation fields.
     */
    beginStep(member) {
        const identity = assertMemberIdentity(member, 'member');
        const team = identity.rootSessionId;
        if (this.deps.store.getCreationFields(team, identity.instanceId) === undefined) {
            throw new MutationError(MUTATION_ERROR_CODES.UNKNOWN_INSTANCE, `instance '${identity.instanceId}' has no registered creation fields (register the instance before its first step)`, { instanceId: identity.instanceId });
        }
        this.deps.store.markRunning(team, identity.instanceId);
        const step = this.deps.clock.currentStep();
        const config = this.resolveEffective(team, identity, step);
        const inflight = this.inflight;
        const capture = {
            teamSessionId: team,
            member: identity,
            step,
            policy: config.policy,
            contributions: config.contributions,
            release: () => {
                inflight.delete(capture);
            },
        };
        inflight.add(capture);
        return capture;
    }
    /**
     * Resolve the EFFECTIVE CONFIGURATION of one member at one step (the
     * current step by default): the frozen resolver's fully-explained
     * `EffectivePolicy` + this module's source chain (every provenance
     * ledger entry effective at the step) + the stored-but-suppressed
     * overlays (new suppressions are recorded in the store here, lazily —
     * non-destructive, §19.4).
     *
     * @throws {@link MutationError} — the frozen resolver's typed errors
     *   mapped onto this module's closed surface (escalation / identity /
     *   malformed), plus the intake codes above.
     */
    resolveEffective(teamSessionId, member, atStep) {
        const team = assertTeamSessionId(teamSessionId);
        const identity = assertMemberInTeam(member, team, 'member');
        if (atStep !== undefined && (!Number.isInteger(atStep) || atStep < 0)) {
            throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, `malformed resolve input at atStep: must be a non-negative integer (got ${String(atStep)})`, { field: 'atStep' });
        }
        const step = atStep ?? this.deps.clock.currentStep();
        const input = assembleEffectivePolicyInput({
            teamSessionId: team,
            member: identity,
            atStep: step,
            store: this.deps.store,
            policy: this.deps.policy,
        });
        let policy;
        try {
            policy = resolveEffectivePolicy(input);
        }
        catch (error) {
            throw mapFrozenError(error, 'resolve');
        }
        this.recordSuppressions(team, step, policy.suppressed);
        const contributions = this.deps.store
            .listLedger(team)
            .filter((entry) => entry.effectiveFromStep <= step);
        return deepFreeze({
            teamSessionId: team,
            member: identity,
            step,
            policy,
            contributions,
            suppressed: policy.suppressed,
        });
    }
    // -------------------------------------------------------------------------
    // Internals
    // -------------------------------------------------------------------------
    mintId(kind) {
        const custom = this.deps.newRecordId;
        if (custom !== undefined)
            return custom(kind);
        this.idCounter += 1;
        return `p7t2-${kind}-${this.idCounter}`;
    }
    appendLedger(fields) {
        const entry = deepFreeze({
            entryId: this.mintId('ledger'),
            ...fields,
        });
        this.deps.store.appendLedger(entry.teamSessionId, entry);
        return entry;
    }
    registeredMembers(teamSessionId) {
        const members = [];
        for (const rawId of this.deps.store.listInstances(teamSessionId)) {
            try {
                const instanceId = parseInstanceId(rawId);
                members.push(createMemberIdentity(teamSessionId, instanceId));
            }
            catch (error) {
                throw mapFrozenError(error, 'envelope');
            }
        }
        return members;
    }
    /** The external hard facts check (every origin; see the module doc). */
    checkExternalHard(teamSessionId, capability, value) {
        if (value.kind === 'deny')
            return; // tightening never escapes the hard facts
        const external = this.deps.policy.readExternalFacts(teamSessionId);
        if (typeof external !== 'object' ||
            external === null ||
            typeof external.hard !== 'object' ||
            external.hard === null ||
            typeof external.capabilityExists !== 'object' ||
            external.capabilityExists === null) {
            throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, `malformed external hard facts from the policy reader for TeamSession '${teamSessionId}'`, { stage: 'external', source: 'reader' });
        }
        if (external.capabilityExists[capability] === false) {
            throw new MutationError(MUTATION_ERROR_CODES.EXTERNAL_HARD_REJECTED, `capability '${capability}' does not exist in the substrate; no origin may grant it (invariant 35)`, { capability, hardReason: 'capabilityMissing' });
        }
        const hardEntry = external.hard[capability];
        if (hardEntry === undefined)
            return;
        const hard = normalizePolicyEntry(hardEntry, `external.hard.${capability}`);
        if (hard.kind === 'deny') {
            throw new MutationError(MUTATION_ERROR_CODES.EXTERNAL_HARD_REJECTED, `capability '${capability}' is hard-denied by the external policy; no origin may grant it (§19.2/§25.4)`, { capability, hardReason: 'hardDeny' });
        }
        const allowed = new Set(hard.items);
        const missing = [];
        for (const item of value.items) {
            if (!allowed.has(item))
                missing.push(item);
        }
        if (missing.length > 0) {
            throw new MutationError(MUTATION_ERROR_CODES.EXTERNAL_HARD_REJECTED, `capability '${capability}' allow items exceed the external hard allow-list`, { capability, hardReason: 'outsideHardAllowList', items: missing });
        }
    }
    /**
     * Record the fresh suppressions of one resolution (lazy, §19.4):
     * deduplicated on (capability, layer, policyStateId) against the store's
     * existing suppression trail; `recordedAtStep` = this step. The key is
     * the overlay LAYER (not the slot's `overlayId`) because a slot's id is
     * the latest contributing durable record overall and therefore changes
     * whenever a new record joins the slot — deduping on the slot id would
     * re-record the same logical suppression once per id drift. The
     * recorded record keeps the slot id it had at first recording.
     */
    recordSuppressions(teamSessionId, step, suppressed) {
        const seen = new Set();
        for (const existing of this.deps.store.listSuppressions(teamSessionId)) {
            seen.add(`${existing.capability}|${existing.layer}|${existing.policyStateId}`);
        }
        for (const record of suppressed) {
            const key = `${record.capability}|${record.layer}|${record.policyStateId}`;
            if (seen.has(key))
                continue;
            seen.add(key);
            this.deps.store.appendSuppression(teamSessionId, deepFreeze({ ...record, recordedAtStep: step }));
        }
    }
}
// ---------------------------------------------------------------------------
// Structural validation (the intake boundary; mirrors the frozen domain's
// rules — closed sets, exact field shapes — under this module's error code)
// ---------------------------------------------------------------------------
/** Assert `raw` is a valid TeamSessionId (invariant 9: = RootSessionId). */
function assertTeamSessionId(raw) {
    try {
        return parseTeamSessionId(raw);
    }
    catch (error) {
        return mapToMalformed(error, 'teamSessionId');
    }
}
/** Assert `raw` is one of the CLOSED five capability domains. */
function assertCapability(raw) {
    if (typeof raw !== 'string' || !CAPABILITY_NAME_VALUES.includes(raw)) {
        throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, `malformed mutation input at capability: unknown capability '${String(raw)}' (closed set: ${CAPABILITY_NAME_VALUES.join(', ')})`, { field: 'capability', value: raw });
    }
    return raw;
}
/** Assert `raw` is a closed mutation-actor kind. */
function assertActorKind(raw) {
    if (raw !== 'human' && raw !== 'leader' && raw !== 'member') {
        throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, `malformed mutation input at actor.kind: unknown actor kind '${String(raw)}' (closed set: human, leader, member)`, { field: 'actor.kind', value: raw });
    }
    return raw;
}
/** Assert `raw` is a valid in-team member identity (invariant 18). */
function assertMemberInTeam(raw, teamSessionId, field) {
    const identity = assertMemberIdentity(raw, field);
    try {
        assertMemberIdentityInTeam(identity, teamSessionId);
    }
    catch (error) {
        throw mapFrozenError(error, field);
    }
    return identity;
}
/** Assert `raw` is a structurally valid member identity (no team check). */
function assertMemberIdentity(raw, field) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, `malformed mutation input at ${field}: must be a member identity {rootSessionId, instanceId}`, { field, problem: 'not a record' });
    }
    const record = raw;
    let rootSessionId;
    let instanceId;
    try {
        rootSessionId = parseRootSessionId(record['rootSessionId']);
        instanceId = parseInstanceId(record['instanceId']);
    }
    catch (error) {
        throw mapToMalformed(error, field);
    }
    return createMemberIdentity(rootSessionId, instanceId);
}
/** Assert `raw` is a closed creation-field name. */
function assertCreationField(raw) {
    if (raw !== 'workspace' && raw !== 'contextPolicy') {
        throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, `malformed mutation input at field: unknown creation field '${String(raw)}' (closed set: workspace, contextPolicy)`, { field: 'field', value: raw });
    }
    return raw;
}
/** Assert a creation-field string value (non-empty, ≤ 255, no control chars). */
function assertCreationFieldValue(raw, field) {
    if (typeof raw !== 'string' || raw.length === 0 || raw.length > 255) {
        throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, `malformed mutation input at ${field}: must be a non-empty string of at most 255 characters`, { field });
    }
    for (let i = 0; i < raw.length; i++) {
        const code = raw.charCodeAt(i);
        if (code < 0x20 || code === 0x7f) {
            throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, `malformed mutation input at ${field}: must not contain control characters`, { field });
        }
    }
    return raw;
}
/**
 * Validate + normalize one policy entry — the EXACT structural rules of
 * the frozen domain validator (a `deny` entry carries no extra fields; an
 * `allow` entry carries only kind+items, a non-empty array of unique
 * non-empty strings), normalized to a fresh deep-freezable copy under
 * this module's error code.
 */
function normalizePolicyEntry(raw, field) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, `malformed mutation input at ${field}: policy entry must be a record {kind:'allow'|'deny', ...}`, { field, problem: 'not a record' });
    }
    const record = raw;
    const kind = record['kind'];
    const keys = Object.keys(record);
    if (kind === 'deny') {
        if (keys.some((key) => key !== 'kind')) {
            throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, `malformed mutation input at ${field}: a 'deny' entry must not carry extra fields (got ${keys.join(', ')})`, { field });
        }
        return { kind: 'deny' };
    }
    if (kind === 'allow') {
        if (keys.some((key) => key !== 'kind' && key !== 'items')) {
            throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, `malformed mutation input at ${field}: an 'allow' entry may only carry 'kind' and 'items'`, { field });
        }
        const items = record['items'];
        if (!Array.isArray(items) || items.length === 0) {
            throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, `malformed mutation input at ${field}: 'allow' items must be a non-empty array (use kind:'deny' for no items)`, { field });
        }
        const seen = new Set();
        for (const item of items) {
            if (typeof item !== 'string' || item.length === 0) {
                throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, `malformed mutation input at ${field}.items: every item must be a non-empty string`, { field: `${field}.items` });
            }
            if (seen.has(item)) {
                throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, `malformed mutation input at ${field}.items: duplicate item '${item}'`, { field: `${field}.items`, item });
            }
            seen.add(item);
        }
        return { kind: 'allow', items: [...items] };
    }
    throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, `malformed mutation input at ${field}: kind must be 'allow' or 'deny' (got ${String(kind)})`, { field });
}
/**
 * Validate + normalize one PolicyState target — the EXACT structural
 * rules of the frozen domain validator (id-like `stateId`; closed
 * capability keys; a cell may only carry `locked` (boolean) and `value`
 * (policy entry)), normalized to a fresh deep-freezable copy.
 */
function normalizeStateView(raw, field) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, `malformed mutation input at ${field}: policy state must be a record {stateId, cells?}`, { field, problem: 'not a record' });
    }
    const record = raw;
    const stateId = record['stateId'];
    if (typeof stateId !== 'string' ||
        stateId.length === 0 ||
        /\s/.test(stateId) ||
        // eslint-disable-next-line no-control-regex -- intentional scanner: rejects control characters in state ids
        /[\u0000-\u001f\u007f]/.test(stateId)) {
        throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, `malformed mutation input at ${field}.stateId: must be a non-empty id-like string (no whitespace/control characters)`, { field: `${field}.stateId` });
    }
    const state = { stateId };
    const cellsRaw = record['cells'];
    if (cellsRaw === undefined)
        return state;
    if (typeof cellsRaw !== 'object' || cellsRaw === null || Array.isArray(cellsRaw)) {
        throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, `malformed mutation input at ${field}.cells: must be a record keyed by capability name (or absent)`, { field: `${field}.cells` });
    }
    const cells = {};
    for (const [key, cellRaw] of Object.entries(cellsRaw)) {
        if (!CAPABILITY_NAME_VALUES.includes(key)) {
            throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, `malformed mutation input at ${field}.cells: unknown capability '${key}' (closed set: ${CAPABILITY_NAME_VALUES.join(', ')})`, { field: `${field}.cells`, capability: key });
        }
        const capability = key;
        if (typeof cellRaw !== 'object' || cellRaw === null || Array.isArray(cellRaw)) {
            throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, `malformed mutation input at ${field}.cells.${capability}: state cell must be a record {locked?, value?}`, { field: `${field}.cells.${capability}` });
        }
        const cell = cellRaw;
        if (Object.keys(cell).some((k) => k !== 'locked' && k !== 'value')) {
            throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, `malformed mutation input at ${field}.cells.${capability}: a state cell may only carry 'locked' and 'value'`, { field: `${field}.cells.${capability}` });
        }
        const normalized = {};
        if (cell['locked'] === true)
            normalized.locked = true;
        if (cell['value'] !== undefined) {
            normalized.value = normalizePolicyEntry(cell['value'], `${field}.cells.${capability}.value`);
        }
        cells[capability] = normalized;
    }
    state.cells = cells;
    return state;
}
// ---------------------------------------------------------------------------
// Frozen-error mapping (the closed error surface)
// ---------------------------------------------------------------------------
/**
 * Map a frozen-domain {@link PolicyResolutionError} onto this module's
 * closed surface, preserving the code strings that belong to both
 * vocabularies (identity / escalation) verbatim and translating the
 * structural code. Non-policy errors become `MALFORMED_MUTATION_INPUT`.
 */
export function mapFrozenError(error, stage) {
    if (error instanceof PolicyResolutionError) {
        const details = { stage, ...error.details };
        switch (error.code) {
            case POLICY_ERROR_CODES.IDENTITY_SCOPE_MISMATCH:
                return new MutationError(MUTATION_ERROR_CODES.IDENTITY_SCOPE_MISMATCH, error.message, details);
            case POLICY_ERROR_CODES.MEMBER_SELF_ESCALATION:
                return new MutationError(MUTATION_ERROR_CODES.MEMBER_SELF_ESCALATION, error.message, details);
            case POLICY_ERROR_CODES.LEADER_OUT_OF_ENVELOPE:
                return new MutationError(MUTATION_ERROR_CODES.LEADER_OUT_OF_ENVELOPE, error.message, details);
            case POLICY_ERROR_CODES.MALFORMED_POLICY_INPUT:
                return new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, error.message, details);
        }
    }
    return new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, error instanceof Error ? error.message : String(error), { stage, problem: 'unexpected non-policy error' });
}
/** Map a frozen identity-parse failure to this module's structural code. */
function mapToMalformed(error, field) {
    if (error instanceof PolicyResolutionError && error.code === POLICY_ERROR_CODES.IDENTITY_SCOPE_MISMATCH) {
        throw new MutationError(MUTATION_ERROR_CODES.IDENTITY_SCOPE_MISMATCH, error.message, { field, ...error.details });
    }
    throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, error instanceof Error ? error.message : String(error), { field, problem: 'identity parse failure' });
}
// Re-export the ports' active-state helper for consumers/tests.
export { activePolicyState };
//# sourceMappingURL=service.js.map