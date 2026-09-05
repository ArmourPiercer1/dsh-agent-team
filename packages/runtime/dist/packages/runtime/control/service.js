/**
 * P6-T4 — the durable control plane service: ControlRequest /
 * ControlDecision in the TeamDomain + the tool-pipeline last-mile guard.
 *
 * ```
 * ControlRequest durable in TeamDomain
 * ControlDecision durable in TeamDomain
 * actual tool operation still goes through DSH tool pipeline
 * ```
 * (Development Plan 19.4 — the control module NEVER executes tool
 * operations; it only durably authorizes and refuses them.)
 *
 * Composition over the P6-T2 facade (integration, not a second authority
 * path):
 * - team + target resolution reuses `resolveTeamAndTarget` (instanceId-
 *   first, invariant 19; the facade's typed TeamRuntimeError codes);
 * - caller identity/role reuses `resolveCaller` (DISPOSED/ARCHIVED
 *   callers are stale — a stale caller cannot request or decide);
 * - envelope bounds reuse `callerEnvelope` + `enforceEnvelope` over the
 *   closed `request-control` / `resolve-control` mutation ops;
 * - per-team serialization reuses `withTeamLock` (the P6-T1/P6-T2 lock
 *   pattern);
 * - durable writes go ONLY through the injected TeamDomain repositories
 *   (invariant 41: TeamDomain is the Team control-plane durable authority).
 *
 * Durable fact rows (append-only ledger facts; kebab vocabulary — the
 * p4t6 scanner's legacy denylist is slash-prefixed Team SessionEvent
 * names, so these are structurally disjoint):
 * - `control-request-recorded`  — one ControlRequest row;
 * - `control-decision-recorded` — one ControlDecision row per request
 *   (at most one; the first decision is authoritative);
 * - `control-allow-consumed`    — the exactly-once consumption of an
 *   allow by the last-mile guard.
 *
 * Scope model (types.ts): an allow authorizes EXACTLY
 * `(rootSessionId, targetInstanceId, actionName, toolName?,
 * capabilityDomain?, correlation)` and is CONSUMED EXACTLY ONCE.
 *
 * Request idempotency: the scope key `(root, targetInstanceId, actionName,
 * toolName|absent, correlation)` identifies the logical request; a retried
 * request returns the EXISTING row (regardless of requester); a NEW
 * attempt after an allow was consumed (or after a deny) must carry a NEW
 * correlation and creates a NEW request (no reuse).
 *
 * Stale semantics (fail closed; the append-only ledger has no "mark"
 * primitive, so the decision row IS the mark):
 * - request time: a DISPOSED target → CONTROL_TARGET_STALE (zero rows; a
 *   missing target is the facade's INSTANCE_NOT_FOUND); an ARCHIVED
 *   target is tolerated (it can be restored);
 * - resolve time: a target that is missing or DISPOSED when the decision
 *   is recorded → a durable `stale-denied` decision row FIRST, then
 *   CONTROL_REQUEST_STALE (the request is closed and can never become an
 *   allow);
 * - guard time: a target that is missing, ARCHIVED or DISPOSED → block
 *   verdict `target-stale` (an allow only authorizes execution on a
 *   live, work-accepting target).
 *
 * External hard policy (Architecture 25.4 / invariant 34): an `allow`
 * decision probes the LIVE external facts before the decision row is
 * written; a hard deny, an allow-list that excludes the named item, or an
 * explicit `capabilityExists:false` → a durable `deny` decision with
 * `reason: 'external-policy'` FIRST, then
 * CONTROL_EXTERNAL_POLICY_DENIED — even a human/leader allow fails
 * closed. A `deny` decision needs no probe (refusing is always
 * externally lawful). When BOTH a stale target and an external deny
 * apply, the stale check runs first (the request is closed as
 * stale-denied — the external probe is moot for an operation that can
 * never execute).
 *
 * Resolver authority (invariant 37 / Architecture 25.1): the closed
 * resolver role set per kind (CONTROL_RESOLVER_ROLES) is checked BEFORE
 * the envelope — a MEMBER is never a resolver for any kind, even when
 * its template envelope allows the `resolve-control` op (no
 * self-approval); `user-approval` may only be resolved by the human (the
 * leader cannot stand in for the user); a leader resolver still needs
 * the `resolve-control` op in its effective envelope.
 *
 * The last-mile guard (`guardOperation`): the exported public seam the
 * P6-T6 tool layer consults BEFORE the DSH tool pipeline executes the
 * operation (the characterized `pre-execute` / TOOL_GUARD seam,
 * Development Plan 15 — no upstream PRIVATE seam is required, so there
 * is no CORE_SEAM_BLOCKER). It verifies (a) the team still exists, (b)
 * the target is durably live (CREATED/RUNNING/SETTLED), (c) a durable
 * allow decision exists for the EXACT scope and is unconsumed — then
 * atomically (under the per-team lock) appends the consumption fact and
 * returns `allowed:true`. Policy outcomes are VERDICTS, never throws;
 * throws are reserved for malformed guard input (CONTROL_GUARD_MALFORMED)
 * and an ambiguous durable state (CONTROL_GUARD_AMBIGUOUS: two distinct
 * unconsumed allows for one scope — the guard refuses to guess).
 *
 * Invariant 45: the in-process holds NO cached authority state — every
 * operation re-reads the durable repositories fresh (the service-owned
 * `teamLocks` map is a concurrency chain, not authority).
 *
 * @module @dsh-agent-team/runtime/control/service
 */
import { parseInstanceId, parseRootSessionId, } from '../../contracts/src/index.js';
import { CAPABILITY_NAME_VALUES, } from '../../domain/policy/src/index.js';
import { TEAM_RUNTIME_ERROR_CODES, TeamRuntimeError, ACTION_NAMES, actionSpecOf, callerEnvelope, enforceEnvelope, resolveCaller, resolveTeamAndTarget, } from '../admission/index.js';
import { withTeamLock } from '../action-router/index.js';
import { deterministicToken } from '../../storage/provisioning/index.js';
import { CONTROL_ERROR_CODES, ControlError, } from './errors.js';
import { CONTROL_DECISION_REASON_VALUES, CONTROL_DECISION_VALUES, CONTROL_DECISION_VALUE_VALUES, CONTROL_GUARD_BLOCK_REASONS, CONTROL_REQUEST_KIND_VALUES, CONTROL_RESOLVER_ROLES, } from './types.js';
// --- closed fact vocabulary (kebab; p4t6-scanner safe by construction) -------------
/** The durable ControlRequest fact family. */
const FACT_REQUEST = 'control-request-recorded';
/** The durable ControlDecision fact family. */
const FACT_DECISION = 'control-decision-recorded';
/** The durable allow-consumption fact family (the exactly-once evidence). */
const FACT_CONSUMPTION = 'control-allow-consumed';
/** The reused closed specs of the facade action registry (module
 *  invariant: the closed registry always carries both). */
function closedActionSpecOf(name) {
    const spec = actionSpecOf(name);
    if (spec === undefined) {
        // A closed-registry regression (a programming error, never caller-reachable).
        throw new Error(`control: the closed action registry is missing ${name}`);
    }
    return spec;
}
const REQUEST_CONTROL_SPEC = closedActionSpecOf(ACTION_NAMES.REQUEST_CONTROL);
const RESOLVE_CONTROL_SPEC = closedActionSpecOf(ACTION_NAMES.RESOLVE_CONTROL);
/** The lifecycle states in which a target may EXECUTE a guarded operation
 *  (the work-accepting set; a SETTLED target is quiescent, not gone). */
const GUARD_LIVE_LIFECYCLES = ['CREATED', 'RUNNING', 'SETTLED'];
/** The terminal lifecycle (invariant 56: DISPOSED is terminal). */
const TERMINAL_LIFECYCLE = 'DISPOSED';
// --- pure helpers ---------------------------------------------------------------------
function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
/** Parse a durable caller ref (malformed rows are treated as ABSENT —
 *  fail closed: a corrupted row can never grant an allow). */
function parseCallerRef(value) {
    if (!isPlainObject(value))
        return undefined;
    if (value['kind'] === 'human') {
        const humanId = value['humanId'];
        return typeof humanId === 'string' && humanId.length > 0
            ? { kind: 'human', humanId }
            : undefined;
    }
    if (value['kind'] === 'instance') {
        const instanceId = value['instanceId'];
        const role = value['role'];
        return (typeof instanceId === 'string' &&
            instanceId.length > 0 &&
            (role === 'leader' || role === 'member')
            ? { kind: 'instance', instanceId, role }
            : undefined);
    }
    return undefined;
}
/** Parse a durable operation scope. */
function parseScope(value) {
    if (!isPlainObject(value))
        return undefined;
    const rootSessionId = value['rootSessionId'];
    const targetInstanceId = value['targetInstanceId'];
    const actionName = value['actionName'];
    const correlation = value['correlation'];
    if (typeof rootSessionId !== 'string' || rootSessionId.length === 0)
        return undefined;
    if (typeof targetInstanceId !== 'string' || targetInstanceId.length === 0)
        return undefined;
    if (typeof actionName !== 'string' || actionName.length === 0)
        return undefined;
    if (typeof correlation !== 'string' || correlation.length === 0)
        return undefined;
    const toolName = value['toolName'];
    if (toolName !== undefined && typeof toolName !== 'string')
        return undefined;
    const capabilityDomain = value['capabilityDomain'];
    if (capabilityDomain !== undefined &&
        !CAPABILITY_NAME_VALUES.includes(capabilityDomain)) {
        return undefined;
    }
    return {
        rootSessionId,
        targetInstanceId,
        actionName,
        correlation,
        ...(toolName !== undefined ? { toolName } : {}),
        ...(capabilityDomain !== undefined
            ? { capabilityDomain: capabilityDomain }
            : {}),
    };
}
/** Parse a request payload (malformed rows are treated as ABSENT). */
function parseRequestPayload(value) {
    if (!isPlainObject(value))
        return undefined;
    const requestId = value['requestId'];
    const kind = value['kind'];
    const targetInstanceId = value['targetInstanceId'];
    const actionName = value['actionName'];
    const correlation = value['correlation'];
    const requester = parseCallerRef(value['requester']);
    if (typeof requestId !== 'string' || requestId.length === 0)
        return undefined;
    if (typeof kind !== 'string' || !CONTROL_REQUEST_KIND_VALUES.includes(kind))
        return undefined;
    if (typeof targetInstanceId !== 'string' || targetInstanceId.length === 0)
        return undefined;
    if (typeof actionName !== 'string' || actionName.length === 0)
        return undefined;
    if (typeof correlation !== 'string' || correlation.length === 0)
        return undefined;
    if (requester === undefined)
        return undefined;
    const toolName = value['toolName'];
    if (toolName !== undefined && typeof toolName !== 'string')
        return undefined;
    const capabilityDomain = value['capabilityDomain'];
    if (capabilityDomain !== undefined &&
        !CAPABILITY_NAME_VALUES.includes(capabilityDomain)) {
        return undefined;
    }
    const summary = value['summary'];
    if (summary !== undefined && typeof summary !== 'string')
        return undefined;
    return {
        requestId,
        kind: kind,
        requester,
        targetInstanceId,
        actionName,
        correlation,
        ...(toolName !== undefined ? { toolName } : {}),
        ...(capabilityDomain !== undefined
            ? { capabilityDomain: capabilityDomain }
            : {}),
        ...(summary !== undefined ? { summary } : {}),
    };
}
/** Parse a decision payload (malformed rows are treated as ABSENT). */
function parseDecisionPayload(value) {
    if (!isPlainObject(value))
        return undefined;
    const requestId = value['requestId'];
    const decision = value['decision'];
    const decider = parseCallerRef(value['decider']);
    const scope = parseScope(value['scope']);
    const requestSequence = value['requestSequence'];
    if (typeof requestId !== 'string' || requestId.length === 0)
        return undefined;
    if (typeof decision !== 'string' || !CONTROL_DECISION_VALUE_VALUES.includes(decision)) {
        return undefined;
    }
    if (decider === undefined)
        return undefined;
    if (scope === undefined)
        return undefined;
    if (typeof requestSequence !== 'number' || !Number.isInteger(requestSequence) || requestSequence < 1) {
        return undefined;
    }
    const reason = value['reason'];
    if (reason !== undefined && !CONTROL_DECISION_REASON_VALUES.includes(reason)) {
        return undefined;
    }
    const note = value['note'];
    if (note !== undefined && typeof note !== 'string')
        return undefined;
    return {
        requestId,
        decision: decision,
        decider,
        scope,
        requestSequence,
        ...(reason !== undefined ? { reason: reason } : {}),
        ...(note !== undefined ? { note } : {}),
    };
}
/** Parse a consumption payload (malformed rows are treated as ABSENT). */
function parseConsumptionPayload(value) {
    if (!isPlainObject(value))
        return undefined;
    const requestId = value['requestId'];
    const decisionSequence = value['decisionSequence'];
    const scope = parseScope(value['scope']);
    const consumedAt = value['consumedAt'];
    if (typeof requestId !== 'string' || requestId.length === 0)
        return undefined;
    if (typeof decisionSequence !== 'number' ||
        !Number.isInteger(decisionSequence) ||
        decisionSequence < 1) {
        return undefined;
    }
    if (scope === undefined)
        return undefined;
    if (typeof consumedAt !== 'string' || consumedAt.length === 0)
        return undefined;
    return { requestId, decisionSequence, scope, consumedAt };
}
/** Is `caller` a well-formed facade ActionCaller? */
function isActionCaller(caller) {
    if (!isPlainObject(caller))
        return false;
    if (caller['kind'] === 'human') {
        return typeof caller['humanId'] === 'string' && caller['humanId'].length > 0;
    }
    if (caller['kind'] === 'instance') {
        return typeof caller['instanceId'] === 'string' && caller['instanceId'].length > 0;
    }
    return false;
}
/** The stable logical-request key (the request idempotency identity;
 *  NUL-separated per the provisioning identity convention). */
function scopeKey(rootSessionId, targetInstanceId, actionName, toolName, correlation) {
    return [rootSessionId, targetInstanceId, actionName, toolName ?? '', correlation].join('\u0000');
}
/** The durable requestId derived from the scope key (stable across
 *  retries; distinct per logical request). */
function requestIdOf(key) {
    return `ctrl-${deterministicToken(key, 24)}`;
}
/** Does the durable scope snapshot match the guarded scope EXACTLY? */
function scopeSnapshotMatches(recorded, guarded) {
    if (recorded.rootSessionId !== guarded.rootSessionId)
        return false;
    if (recorded.targetInstanceId !== guarded.targetInstanceId)
        return false;
    if (recorded.actionName !== guarded.actionName)
        return false;
    if (recorded.correlation !== guarded.correlation)
        return false;
    if ((recorded.toolName ?? '') !== (guarded.toolName ?? ''))
        return false;
    if ((recorded.capabilityDomain ?? '') !== (guarded.capabilityDomain ?? ''))
        return false;
    return true;
}
/**
 * Does the external hard cell allow the operation? Fail closed: an ABSENT
 * cell means "no host restriction"; a hard `deny` refuses; a hard
 * allow-list must NAME the operation's tool (an operation with no named
 * tool matches no item — refused).
 */
function hardCellAllows(entry, toolName) {
    if (entry === undefined)
        return true;
    if (entry.kind === 'deny')
        return false;
    if (toolName === undefined)
        return false;
    return entry.items.includes(toolName);
}
// --- the service ------------------------------------------------------------------------
/**
 * Create the durable control plane service over one open TeamDomain.
 *
 * @param options - the injected ports (see {@link ControlServiceOptions}).
 * @returns the ControlService (requestControl / resolveControl /
 *   listControlState / guardOperation).
 */
export function createControlService(options) {
    const repositories = options.teamDomain.repositories;
    /** The per-team promise chain (a concurrency device, NOT authority —
     *  invariant 45). */
    const teamLocks = new Map();
    // --- small closed-code helpers -----------------------------------------------------
    function malformed(stage, field, message) {
        return new ControlError(CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED, `ControlService: ${message} (field: '${field}')`, { stage, field });
    }
    function guardMalformed(field, message) {
        return new ControlError(CONTROL_ERROR_CODES.CONTROL_GUARD_MALFORMED, `ControlService: ${message} (field: '${field}')`, { stage: 'guard', field });
    }
    function parseRoot(raw, code, stage) {
        try {
            return String(parseRootSessionId(raw));
        }
        catch {
            throw new ControlError(code, `ControlService: malformed rootSessionId in ${stage} input: ${JSON.stringify(raw)}`, { stage, field: 'rootSessionId' });
        }
    }
    /** Map a durable-store failure to the facade's closed effect-phase code
     *  (the bounded durable-write fault — the same vocabulary the P6-T2
     *  router uses; a store failure is infrastructure, not a control-plane
     *  rejection). */
    function durableFailure(stage, error) {
        return new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.DURABLE_WRITE_FAILED, `ControlService: ${stage} failed: ${error instanceof Error ? error.message : String(error)}`, { stage });
    }
    async function allocateSequence() {
        try {
            return await repositories.ledger.allocateSequence();
        }
        catch (error) {
            throw durableFailure('ledger sequence allocation', error);
        }
    }
    async function putEntry(entry) {
        try {
            await repositories.ledger.put(entry);
        }
        catch (error) {
            throw durableFailure(`ledger put (${entry.factType})`, error);
        }
        return entry.sequence;
    }
    // --- durable state reads (fresh every call — invariant 45) --------------------------
    function loadControlState(root) {
        const requests = [];
        const decisions = [];
        const consumptions = [];
        for (const entry of repositories.ledger.list()) {
            if (String(entry.rootSessionId) !== root)
                continue;
            if (entry.factType === FACT_REQUEST) {
                const payload = parseRequestPayload(entry.payload);
                if (payload !== undefined)
                    requests.push({ entry, payload });
            }
            else if (entry.factType === FACT_DECISION) {
                const payload = parseDecisionPayload(entry.payload);
                if (payload !== undefined)
                    decisions.push({ entry, payload });
            }
            else if (entry.factType === FACT_CONSUMPTION) {
                const payload = parseConsumptionPayload(entry.payload);
                if (payload !== undefined)
                    consumptions.push({ entry, payload });
            }
        }
        const bySequence = (a, b) => a.entry.sequence - b.entry.sequence;
        requests.sort(bySequence);
        decisions.sort(bySequence);
        consumptions.sort(bySequence);
        return { requests, decisions, consumptions };
    }
    function scopeOf(entry, payload) {
        return {
            rootSessionId: String(entry.rootSessionId),
            targetInstanceId: payload.targetInstanceId,
            actionName: payload.actionName,
            correlation: payload.correlation,
            ...(payload.toolName !== undefined ? { toolName: payload.toolName } : {}),
            ...(payload.capabilityDomain !== undefined
                ? { capabilityDomain: payload.capabilityDomain }
                : {}),
        };
    }
    function toRequestRecord(entry, payload, state) {
        const decided = state.decisions.some((d) => d.payload.requestId === payload.requestId);
        return {
            requestId: payload.requestId,
            rootSessionId: String(entry.rootSessionId),
            kind: payload.kind,
            requester: payload.requester,
            targetInstanceId: payload.targetInstanceId,
            actionName: payload.actionName,
            correlation: payload.correlation,
            status: decided ? 'decided' : 'pending',
            createdAt: entry.createdAt,
            requestSequence: entry.sequence,
            ...(payload.toolName !== undefined ? { toolName: payload.toolName } : {}),
            ...(payload.capabilityDomain !== undefined
                ? { capabilityDomain: payload.capabilityDomain }
                : {}),
            ...(payload.summary !== undefined ? { summary: payload.summary } : {}),
        };
    }
    function toDecisionRecord(entry, payload) {
        return {
            requestId: payload.requestId,
            decision: payload.decision,
            decider: payload.decider,
            scope: payload.scope,
            requestSequence: payload.requestSequence,
            decisionSequence: entry.sequence,
            createdAt: entry.createdAt,
            ...(payload.reason !== undefined ? { reason: payload.reason } : {}),
            ...(payload.note !== undefined ? { note: payload.note } : {}),
        };
    }
    function toConsumptionRecord(entry, payload) {
        return {
            requestId: payload.requestId,
            decisionSequence: payload.decisionSequence,
            scope: payload.scope,
            consumedAt: payload.consumedAt,
        };
    }
    /** The durable ref of a resolved caller (lossless JSON). */
    function callerRefOf(caller) {
        if (caller.role === 'human') {
            return { kind: 'human', humanId: caller.humanId ?? '' };
        }
        const member = caller.callerMember;
        if (member === undefined) {
            // An internal invariant (a programming error, never caller-reachable):
            // an instance caller always resolves WITH its member record.
            throw new Error('control: an instance caller without a member record (internal invariant)');
        }
        return { kind: 'instance', instanceId: String(member.instanceId), role: caller.role };
    }
    /** Record one durable decision row (BEFORE any effect; the row IS the
     *  durable decision). */
    async function commitDecision(args) {
        const payload = {
            requestId: args.requestId,
            decision: args.value,
            decider: args.decider,
            scope: {
                rootSessionId: args.scope.rootSessionId,
                targetInstanceId: args.scope.targetInstanceId,
                actionName: args.scope.actionName,
                correlation: args.scope.correlation,
                ...(args.scope.toolName !== undefined ? { toolName: args.scope.toolName } : {}),
                ...(args.scope.capabilityDomain !== undefined
                    ? { capabilityDomain: args.scope.capabilityDomain }
                    : {}),
            },
            requestSequence: args.requestSequence,
            ...(args.reason !== undefined ? { reason: args.reason } : {}),
            ...(args.note !== undefined ? { note: args.note } : {}),
        };
        const sequence = await putEntry({
            schemaVersion: 1,
            sequence: await allocateSequence(),
            rootSessionId: args.scope.rootSessionId,
            factType: FACT_DECISION,
            payload,
            createdAt: options.now(),
        });
        const record = {
            requestId: args.requestId,
            decision: args.value,
            decider: args.decider,
            scope: args.scope,
            requestSequence: args.requestSequence,
            decisionSequence: sequence,
            createdAt: options.now(),
            ...(args.reason !== undefined ? { reason: args.reason } : {}),
            ...(args.note !== undefined ? { note: args.note } : {}),
        };
        return record;
    }
    // --- requestControl ------------------------------------------------------------------
    async function requestControl(args) {
        const root = parseRoot(args.rootSessionId, CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED, 'request');
        if (!isActionCaller(args.caller)) {
            throw malformed('request', 'caller', 'caller must be {kind:human,humanId} or {kind:instance,instanceId}');
        }
        if (!CONTROL_REQUEST_KIND_VALUES.includes(args.kind)) {
            throw malformed('request', 'kind', `unknown control request kind ${JSON.stringify(args.kind)}`);
        }
        if (typeof args.actionName !== 'string' || args.actionName.length === 0) {
            throw malformed('request', 'actionName', 'actionName must be a non-empty string');
        }
        if (typeof args.correlation !== 'string' || args.correlation.length === 0) {
            throw malformed('request', 'correlation', 'correlation must be a non-empty string');
        }
        if (args.toolName !== undefined && (typeof args.toolName !== 'string' || args.toolName.length === 0)) {
            throw malformed('request', 'toolName', 'toolName must be a non-empty string when present');
        }
        if (args.capabilityDomain !== undefined &&
            !CAPABILITY_NAME_VALUES.includes(args.capabilityDomain)) {
            throw malformed('request', 'capabilityDomain', `capabilityDomain outside the closed set: ${JSON.stringify(args.capabilityDomain)}`);
        }
        if (args.summary !== undefined && typeof args.summary !== 'string') {
            throw malformed('request', 'summary', 'summary must be a string when present');
        }
        // Reused authority steps (the facade's typed codes surface as-is):
        // (1) caller identity/role; (2) team + target resolution; (3)
        // request-time staleness; (4) envelope.
        const caller = resolveCaller(repositories, root, args.caller);
        const resolved = resolveTeamAndTarget(repositories, options.blueprintCatalog, {
            rootSessionId: root,
            action: ACTION_NAMES.REQUEST_CONTROL,
            caller: args.caller,
            targetInstanceId: args.targetInstanceId,
            requestToken: args.correlation,
        }, REQUEST_CONTROL_SPEC);
        const target = resolved.target;
        const targetLifecycle = target !== undefined ? String(target.lifecycle) : undefined;
        if (targetLifecycle === TERMINAL_LIFECYCLE) {
            throw new ControlError(CONTROL_ERROR_CODES.CONTROL_TARGET_STALE, `ControlService: target instance is ${targetLifecycle} (terminal) — a control request can never become valid (no row written)`, { rootSessionId: root, targetInstanceId: args.targetInstanceId, lifecycle: targetLifecycle });
        }
        enforceEnvelope(REQUEST_CONTROL_SPEC, callerEnvelope(resolved.bound.blueprint, caller, repositories.overrides.list(root)));
        return withTeamLock(teamLocks, root, async () => {
            const state = loadControlState(root);
            const key = scopeKey(root, args.targetInstanceId, args.actionName, args.toolName, args.correlation);
            const existing = state.requests.find((r) => scopeKey(String(r.entry.rootSessionId), r.payload.targetInstanceId, r.payload.actionName, r.payload.toolName, r.payload.correlation) === key);
            if (existing !== undefined) {
                // Idempotent: the same logical request returns its EXISTING row
                // (regardless of requester; a decided row says `decided` — a new
                // attempt needs a new correlation).
                return toRequestRecord(existing.entry, existing.payload, state);
            }
            const requestId = requestIdOf(key);
            const requester = callerRefOf(caller);
            const payload = {
                requestId,
                kind: args.kind,
                requester,
                targetInstanceId: args.targetInstanceId,
                actionName: args.actionName,
                correlation: args.correlation,
                ...(args.toolName !== undefined ? { toolName: args.toolName } : {}),
                ...(args.capabilityDomain !== undefined
                    ? { capabilityDomain: args.capabilityDomain }
                    : {}),
                ...(args.summary !== undefined ? { summary: args.summary } : {}),
            };
            const sequence = await putEntry({
                schemaVersion: 1,
                sequence: await allocateSequence(),
                rootSessionId: root,
                factType: FACT_REQUEST,
                payload,
                createdAt: options.now(),
            });
            return {
                requestId,
                rootSessionId: root,
                kind: args.kind,
                requester,
                targetInstanceId: args.targetInstanceId,
                actionName: args.actionName,
                correlation: args.correlation,
                status: 'pending',
                createdAt: options.now(),
                requestSequence: sequence,
                ...(args.toolName !== undefined ? { toolName: args.toolName } : {}),
                ...(args.capabilityDomain !== undefined
                    ? { capabilityDomain: args.capabilityDomain }
                    : {}),
                ...(args.summary !== undefined ? { summary: args.summary } : {}),
            };
        });
    }
    // --- resolveControl ------------------------------------------------------------------
    async function resolveControl(args) {
        const root = parseRoot(args.rootSessionId, CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED, 'resolve');
        if (!isActionCaller(args.caller)) {
            throw malformed('resolve', 'caller', 'caller must be {kind:human,humanId} or {kind:instance,instanceId}');
        }
        if (typeof args.requestId !== 'string' || args.requestId.length === 0) {
            throw malformed('resolve', 'requestId', 'requestId must be a non-empty string');
        }
        if (args.decision !== 'allow' && args.decision !== 'deny') {
            throw malformed('resolve', 'decision', `decision must be 'allow' or 'deny' (got ${JSON.stringify(args.decision)})`);
        }
        if (args.note !== undefined && typeof args.note !== 'string') {
            throw malformed('resolve', 'note', 'note must be a string when present');
        }
        // Reused authority steps: (1) caller; (2) team + blueprint resolution
        // (the decision is addressed to the REQUEST — no target token).
        const caller = resolveCaller(repositories, root, args.caller);
        const resolved = resolveTeamAndTarget(repositories, options.blueprintCatalog, {
            rootSessionId: root,
            action: ACTION_NAMES.RESOLVE_CONTROL,
            caller: args.caller,
            requestToken: args.requestId,
        }, RESOLVE_CONTROL_SPEC);
        return withTeamLock(teamLocks, root, async () => {
            const state = loadControlState(root);
            const request = state.requests.find((r) => r.payload.requestId === args.requestId);
            if (request === undefined) {
                throw new ControlError(CONTROL_ERROR_CODES.CONTROL_REQUEST_NOT_FOUND, `ControlService: no durable control request '${args.requestId}' in team '${root}' (a decision without a request)`, { rootSessionId: root, requestId: args.requestId });
            }
            if (state.decisions.some((d) => d.payload.requestId === args.requestId)) {
                throw new ControlError(CONTROL_ERROR_CODES.CONTROL_REQUEST_DECIDED, `ControlService: request '${args.requestId}' already carries a durable decision (the first decision is authoritative)`, { rootSessionId: root, requestId: args.requestId });
            }
            // Role closure (BEFORE the envelope — invariant 37: a member is
            // never a resolver, even with the resolve-control op; the
            // user-approval kind admits only the human).
            const allowedRoles = CONTROL_RESOLVER_ROLES[request.payload.kind];
            if (!allowedRoles.includes(caller.role)) {
                throw new ControlError(CONTROL_ERROR_CODES.CONTROL_RESOLVER_NOT_AUTHORIZED, `ControlService: role '${caller.role}' is not a resolver for kind '${request.payload.kind}' (allowed: [${allowedRoles.join(', ')}])`, {
                    rootSessionId: root,
                    requestId: args.requestId,
                    kind: request.payload.kind,
                    role: caller.role,
                    allowedRoles: [...allowedRoles],
                });
            }
            // Envelope (the resolve-control op; a human is not envelope-bound).
            enforceEnvelope(RESOLVE_CONTROL_SPEC, callerEnvelope(resolved.bound.blueprint, caller, repositories.overrides.list(root)));
            // Resolve-time staleness (durable stale-denied FIRST, then throw).
            const target = repositories.memberInstances.get(root, request.payload.targetInstanceId);
            const targetLifecycle = target !== undefined ? String(target.lifecycle) : undefined;
            if (target === undefined || targetLifecycle === TERMINAL_LIFECYCLE) {
                const scope = scopeOf(request.entry, request.payload);
                await commitDecision({
                    requestId: request.payload.requestId,
                    value: CONTROL_DECISION_VALUES.STALE_DENIED,
                    decider: callerRefOf(caller),
                    scope,
                    requestSequence: request.entry.sequence,
                });
                throw new ControlError(CONTROL_ERROR_CODES.CONTROL_REQUEST_STALE, `ControlService: request '${request.payload.requestId}' is stale — the target instance is ${target === undefined ? 'missing' : targetLifecycle} (recorded as stale-denied; it can never become an allow)`, {
                    rootSessionId: root,
                    requestId: request.payload.requestId,
                    targetInstanceId: request.payload.targetInstanceId,
                    lifecycle: targetLifecycle ?? 'missing',
                });
            }
            // External hard policy (allow only — Architecture 25.4 / invariant
            // 34: no Team decision, human included, bypasses it).
            if (args.decision === 'allow') {
                const capabilityDomain = request.payload.capabilityDomain ??
                    (request.payload.toolName !== undefined ? 'tools' : undefined);
                if (capabilityDomain !== undefined) {
                    const facts = await options.externalPolicyFacts();
                    if (facts.capabilityExists[capabilityDomain] === false ||
                        !hardCellAllows(facts.hard[capabilityDomain], request.payload.toolName)) {
                        const scope = scopeOf(request.entry, request.payload);
                        await commitDecision({
                            requestId: request.payload.requestId,
                            value: CONTROL_DECISION_VALUES.DENY,
                            decider: callerRefOf(caller),
                            reason: 'external-policy',
                            scope,
                            requestSequence: request.entry.sequence,
                        });
                        throw new ControlError(CONTROL_ERROR_CODES.CONTROL_EXTERNAL_POLICY_DENIED, `ControlService: allow impossible — the external hard policy denies capability '${capabilityDomain}' (recorded as deny with reason external-policy)`, {
                            rootSessionId: root,
                            requestId: request.payload.requestId,
                            capabilityDomain,
                            toolName: request.payload.toolName,
                        });
                    }
                }
            }
            return await commitDecision({
                requestId: request.payload.requestId,
                value: args.decision === 'allow' ? CONTROL_DECISION_VALUES.ALLOW : CONTROL_DECISION_VALUES.DENY,
                decider: callerRefOf(caller),
                scope: scopeOf(request.entry, request.payload),
                requestSequence: request.entry.sequence,
                ...(args.note !== undefined ? { note: args.note } : {}),
            });
        });
    }
    // --- listControlState ----------------------------------------------------------------
    async function listControlState(rootSessionId) {
        const root = parseRoot(rootSessionId, CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED, 'list');
        return withTeamLock(teamLocks, root, async () => {
            if (repositories.teamSessions.get(root) === undefined) {
                throw new TeamRuntimeError(TEAM_RUNTIME_ERROR_CODES.TEAM_SESSION_NOT_FOUND, `ControlService: no TeamSession record for root session '${root}'`, { rootSessionId: root });
            }
            const state = loadControlState(root);
            return {
                requests: state.requests.map((r) => toRequestRecord(r.entry, r.payload, state)),
                decisions: state.decisions.map((d) => toDecisionRecord(d.entry, d.payload)),
                consumptions: state.consumptions.map((c) => toConsumptionRecord(c.entry, c.payload)),
            };
        });
    }
    // --- guardOperation (the tool-pipeline last-mile seam) -------------------------------
    async function guardOperation(scope) {
        const root = parseRoot(scope.rootSessionId, CONTROL_ERROR_CODES.CONTROL_GUARD_MALFORMED, 'guard');
        let target;
        try {
            target = String(parseInstanceId(scope.targetInstanceId));
        }
        catch {
            throw guardMalformed('targetInstanceId', `targetInstanceId is not a valid instance id: ${JSON.stringify(scope.targetInstanceId)}`);
        }
        if (typeof scope.actionName !== 'string' || scope.actionName.length === 0) {
            throw guardMalformed('actionName', 'actionName must be a non-empty string');
        }
        if (typeof scope.correlation !== 'string' || scope.correlation.length === 0) {
            throw guardMalformed('correlation', 'correlation must be a non-empty string');
        }
        if (scope.toolName !== undefined && (typeof scope.toolName !== 'string' || scope.toolName.length === 0)) {
            throw guardMalformed('toolName', 'toolName must be a non-empty string when present');
        }
        if (scope.capabilityDomain !== undefined && !CAPABILITY_NAME_VALUES.includes(scope.capabilityDomain)) {
            throw guardMalformed('capabilityDomain', `capabilityDomain outside the closed set: ${JSON.stringify(scope.capabilityDomain)}`);
        }
        return withTeamLock(teamLocks, root, async () => {
            // (a) the team must still exist; (b) the target must be durably
            // live and work-accepting (an allow only authorizes execution on a
            // live target — missing/ARCHIVED/DISPOSED all block).
            const member = repositories.memberInstances.get(root, target);
            if (repositories.teamSessions.get(root) === undefined ||
                member === undefined ||
                !GUARD_LIVE_LIFECYCLES.includes(String(member.lifecycle))) {
                return { allowed: false, reason: CONTROL_GUARD_BLOCK_REASONS.TARGET_STALE };
            }
            const state = loadControlState(root);
            const key = scopeKey(root, target, scope.actionName, scope.toolName, scope.correlation);
            const matching = state.requests.filter((r) => {
                const rowKey = scopeKey(String(r.entry.rootSessionId), r.payload.targetInstanceId, r.payload.actionName, r.payload.toolName, r.payload.correlation);
                return rowKey === key;
            });
            if (matching.length === 0) {
                return { allowed: false, reason: CONTROL_GUARD_BLOCK_REASONS.NO_REQUEST };
            }
            const unconsumedAllows = [];
            let fallback = {
                allowed: false,
                reason: CONTROL_GUARD_BLOCK_REASONS.NO_REQUEST,
            };
            for (const request of matching) {
                const decision = state.decisions.find((d) => d.payload.requestId === request.payload.requestId);
                if (decision === undefined) {
                    fallback = {
                        allowed: false,
                        reason: CONTROL_GUARD_BLOCK_REASONS.REQUEST_PENDING,
                        requestId: request.payload.requestId,
                    };
                    continue;
                }
                if (decision.payload.decision === CONTROL_DECISION_VALUES.STALE_DENIED) {
                    return {
                        allowed: false,
                        reason: CONTROL_GUARD_BLOCK_REASONS.REQUEST_STALE,
                        requestId: request.payload.requestId,
                        decisionSequence: decision.entry.sequence,
                    };
                }
                if (decision.payload.decision === CONTROL_DECISION_VALUES.DENY) {
                    return {
                        allowed: false,
                        reason: CONTROL_GUARD_BLOCK_REASONS.DECISION_DENY,
                        requestId: request.payload.requestId,
                        decisionSequence: decision.entry.sequence,
                    };
                }
                // decision === 'allow'
                const consumed = state.consumptions.some((c) => c.payload.requestId === request.payload.requestId);
                if (consumed) {
                    fallback = {
                        allowed: false,
                        reason: CONTROL_GUARD_BLOCK_REASONS.ALLOW_CONSUMED,
                        requestId: request.payload.requestId,
                        decisionSequence: decision.entry.sequence,
                    };
                    continue;
                }
                if (!scopeSnapshotMatches(decision.payload.scope, scope)) {
                    return {
                        allowed: false,
                        reason: CONTROL_GUARD_BLOCK_REASONS.SCOPE_MISMATCH,
                        requestId: request.payload.requestId,
                        decisionSequence: decision.entry.sequence,
                    };
                }
                unconsumedAllows.push({ request, decision });
            }
            if (unconsumedAllows.length > 1) {
                throw new ControlError(CONTROL_ERROR_CODES.CONTROL_GUARD_AMBIGUOUS, `ControlService: ${unconsumedAllows.length} distinct unconsumed durable allows for one scope — refusing to guess which authorizes the operation`, {
                    rootSessionId: root,
                    requestIds: unconsumedAllows.map((a) => a.request.payload.requestId),
                });
            }
            if (unconsumedAllows.length === 1) {
                const winner = unconsumedAllows[0];
                if (winner === undefined) {
                    // Unreachable: the length check above guarantees the single element.
                    throw new Error('control: invariant violation — one unconsumed allow but no element');
                }
                const { request, decision } = winner;
                await putEntry({
                    schemaVersion: 1,
                    sequence: await allocateSequence(),
                    rootSessionId: root,
                    factType: FACT_CONSUMPTION,
                    payload: {
                        requestId: request.payload.requestId,
                        decisionSequence: decision.entry.sequence,
                        scope: scopeOf(request.entry, request.payload),
                        consumedAt: options.now(),
                    },
                    createdAt: options.now(),
                });
                return {
                    allowed: true,
                    requestId: request.payload.requestId,
                    decisionSequence: decision.entry.sequence,
                };
            }
            return fallback;
        });
    }
    return {
        requestControl,
        resolveControl,
        listControlState,
        guardOperation,
    };
}
//# sourceMappingURL=service.js.map