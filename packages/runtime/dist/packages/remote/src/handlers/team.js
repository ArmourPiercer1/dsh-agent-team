/**
 * The `team` category handler (design note §3): TeamSession creation,
 * whole-projection observation, ledger pages, the v4-only human control
 * resolution (`team.resolveControl`, F3/F11/F9/T1.4 repair round r1 F9),
 * and the v5-only one-shot ordinary-activation permit
 * (`team.prepareOrdinaryOpen`, C1 restart-0.1.7-rc.1 recovery — guide
 * §10.2). Backed by nine ports:
 * {@link RemoteTeamCreateEmbeddedWorkPort} (root binding, P5-T5),
 * {@link RemoteTeamCreateWorkspacePort} (the workspace-aware creation
 * variant, TCM vNext §15.6), {@link RemoteTeamAdmitInitialWorkPort}
 * (the creation-time initial work command, TCM vNext §15.6),
 * {@link RemoteTeamRootsPort} (the durable root ownership list, D1),
 * {@link RemoteTeamEnsureRootLivePort} (the Team-mode ensure, D2-wired),
 * {@link RemoteTeamResolveControlPort} (the human control resolution
 * command, F9),
 * {@link RemoteTeamPrepareOrdinaryOpenPort} (the one-shot
 * ordinary-activation permit, C1), {@link RemoteProjectionPort}
 * (ProjectionService, P8-T2), and {@link RemoteLedgerPort} (storage
 * ledger behind a slicing adapter, D-5).
 *
 * Semantic routing (pre-alpha3 PR-F, plan §F.3): the dispatcher passes
 * the request's contract version through (the transport adapter's
 * concern), but this handler routes on the SEMANTIC decisions from the
 * contracts semantic adapter — the `team.create` flavor
 * ({@link teamCreateFlavorOf}) and the `team.getProjection` shape
 * ({@link projectionShapeOf}) — and never on a literal version number.
 *
 * The projection is validated at the TOP LEVEL only (D-4): the nine frozen
 * `TeamProjectionDto` fields must be present with the right structural
 * kinds; the nested values pass through. The whole-projection `generation`
 * rides in the reply's provenance (G8 staleness detection).
 *
 * Pure module: no I/O, no node: builtins, no runtime environment
 * assumptions.
 * @module @dsh-agent-team/remote/handlers/team
 */
import { remoteContractError } from '../contracts/errors.js';
import { REMOTE_LEDGER_ENTRY_FIELDS, REMOTE_PROJECTION_FIELDS, } from '../contracts/types.js';
import { PROJECTION_SHAPES, TEAM_CREATE_FLAVORS, projectionShapeOf, teamCreateFlavorOf, withLiveProjectionFreshness, } from '../contracts/semantic.js';
/** Is `value` a plain (non-array) object? */
function isPlainRecord(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
        return false;
    const proto = Object.getPrototypeOf(value);
    return proto === null || proto === Object.prototype;
}
/** A port returned a structurally wrong value: a boundary failure. */
function portContractError(field, problem) {
    return remoteContractError('internal-error', `remote backing port returned a malformed value at '${field}': ${problem}`, { field, reason: 'port-contract' });
}
/** Normalize one projection to the closed top-level shape (D-4). */
function normalizeProjection(raw) {
    if (!isPlainRecord(raw)) {
        throw portContractError('projection', `expected an object, got ${String(raw)}`);
    }
    for (const field of REMOTE_PROJECTION_FIELDS) {
        if (!(field in raw)) {
            throw portContractError(`projection.${field}`, 'missing field');
        }
    }
    const schemaVersion = raw['schemaVersion'];
    const generation = raw['generation'];
    if (typeof schemaVersion !== 'number' || !Number.isSafeInteger(schemaVersion)) {
        throw portContractError('projection.schemaVersion', 'must be a safe integer');
    }
    if (typeof generation !== 'number' || !Number.isSafeInteger(generation) || generation < 1) {
        throw portContractError('projection.generation', 'must be a safe integer >= 1');
    }
    return raw;
}
/** Normalize one ledger entry to the closed wire shape. */
function normalizeLedgerEntry(raw) {
    if (!isPlainRecord(raw)) {
        throw portContractError('ledger entry', `expected an object, got ${String(raw)}`);
    }
    for (const field of REMOTE_LEDGER_ENTRY_FIELDS) {
        if (field === 'operationId')
            continue; // optional on the storage row
        if (!(field in raw)) {
            throw portContractError(`ledger entry.${field}`, 'missing field');
        }
    }
    const schemaVersion = raw['schemaVersion'];
    if (typeof schemaVersion !== 'number' || !Number.isSafeInteger(schemaVersion)) {
        throw portContractError('ledger entry.schemaVersion', 'must be a safe integer');
    }
    const sequence = raw['sequence'];
    if (typeof sequence !== 'number' || !Number.isSafeInteger(sequence) || sequence < 1) {
        throw portContractError('ledger entry.sequence', 'must be a safe integer >= 1');
    }
    const rootSessionId = raw['rootSessionId'];
    if (typeof rootSessionId !== 'string' || rootSessionId.length === 0) {
        throw portContractError('ledger entry.rootSessionId', 'must be a non-empty string');
    }
    const factType = raw['factType'];
    if (typeof factType !== 'string' || factType.length === 0) {
        throw portContractError('ledger entry.factType', 'must be a non-empty string');
    }
    const payload = raw['payload'];
    if (!isPlainRecord(payload)) {
        throw portContractError('ledger entry.payload', 'must be an object');
    }
    const createdAt = raw['createdAt'];
    if (typeof createdAt !== 'string' || createdAt.length === 0) {
        throw portContractError('ledger entry.createdAt', 'must be a non-empty string');
    }
    const operationId = raw['operationId'];
    if (operationId !== undefined && typeof operationId !== 'string') {
        throw portContractError('ledger entry.operationId', 'must be a string when present');
    }
    return {
        schemaVersion,
        sequence,
        rootSessionId,
        factType,
        // The port contract guarantees a lossless-JSON-safe record; the plain
        // record check above is the structural half of that guarantee.
        payload: payload,
        operationId: operationId === undefined ? null : operationId,
        createdAt,
    };
}
/**
 * Validate a `team.create` port return value (v1 and v2 share the exact
 * wire shape: `{ path: 'fresh-root' | 'cold-root', durable, bind }`).
 */
function normalizeTeamCreateValue(portName, created) {
    if (!isPlainRecord(created)) {
        throw portContractError(portName, `expected an object, got ${String(created)}`);
    }
    const path = created['path'];
    if (path !== 'fresh-root' && path !== 'cold-root') {
        throw portContractError(`${portName}.path`, `must be 'fresh-root' or 'cold-root', got ${String(path)}`);
    }
    const durable = created['durable'];
    if (durable !== undefined &&
        durable !== null &&
        (typeof durable !== 'object' || Array.isArray(durable))) {
        throw portContractError(`${portName}.durable`, 'must be an object or null');
    }
    const bind = created['bind'];
    if (!isPlainRecord(bind)) {
        throw portContractError(`${portName}.bind`, 'must be an object');
    }
    return {
        data: {
            path,
            durable: durable === undefined ? null : durable,
            bind,
        },
    };
}
/**
 * Validate one `team.listRoots` root row against the closed v3 wire
 * shape (D-4 discipline: the top-level fields are checked, the nested
 * values pass through): `{ rootSessionId, blueprintId, revision,
 * defaultWorkspace?, createdAt, generation, memberCount }`.
 */
function normalizeTeamRootRow(raw, index) {
    if (!isPlainRecord(raw)) {
        throw portContractError(`listRoots.root[${index}]`, `expected an object, got ${String(raw)}`);
    }
    for (const field of ['rootSessionId', 'blueprintId', 'revision', 'createdAt']) {
        const value = raw[field];
        if (typeof value !== 'string' || value.length === 0) {
            throw portContractError(`listRoots.root[${index}].${field}`, 'must be a non-empty string');
        }
    }
    const generation = raw['generation'];
    if (typeof generation !== 'number' || !Number.isSafeInteger(generation) || generation < 1) {
        throw portContractError(`listRoots.root[${index}].generation`, 'must be a safe integer >= 1');
    }
    const memberCount = raw['memberCount'];
    if (typeof memberCount !== 'number' || !Number.isSafeInteger(memberCount) || memberCount < 0) {
        throw portContractError(`listRoots.root[${index}].memberCount`, 'must be a safe integer >= 0');
    }
    const defaultWorkspace = raw['defaultWorkspace'];
    if (defaultWorkspace !== undefined && typeof defaultWorkspace !== 'string') {
        throw portContractError(`listRoots.root[${index}].defaultWorkspace`, 'must be a string when present');
    }
    // The port contract guarantees a lossless-JSON-safe record; the field
    // checks above are the structural half of that guarantee.
    return raw;
}
/**
 * Validate the `team.ensureRootLive` success value against the closed
 * v3 response shape: `{ rootSessionId, mode: "team", live: true }`.
 */
function normalizeTeamEnsureRootLiveValue(raw) {
    if (!isPlainRecord(raw)) {
        throw portContractError('teamEnsureRootLive', `expected an object, got ${String(raw)}`);
    }
    const rootSessionId = raw['rootSessionId'];
    if (typeof rootSessionId !== 'string' || rootSessionId.length === 0) {
        throw portContractError('teamEnsureRootLive.rootSessionId', 'must be a non-empty string');
    }
    if (raw['mode'] !== 'team') {
        throw portContractError('teamEnsureRootLive.mode', `must be 'team', got ${String(raw['mode'])}`);
    }
    if (raw['live'] !== true) {
        throw portContractError('teamEnsureRootLive.live', `must be true, got ${String(raw['live'])}`);
    }
    // The port contract guarantees a lossless-JSON-safe record.
    return raw;
}
/** The closed decision values the durable control plane records. */
const TEAM_RESOLVE_CONTROL_DECISION_VALUES = ['allow', 'deny', 'stale-denied'];
/**
 * Validate the `team.resolveControl` success value against the closed v4
 * response shape (D-4 discipline: the top-level fields are checked, the
 * nested `decider` / `scope` values pass through): the durable
 * ControlDecision record — `{ requestId, decision, decider, reason?,
 * note?, scope, requestSequence, decisionSequence, createdAt }`. The
 * scope's OPTIONAL `operationFingerprint` (alpha.2 exact-scope
 * extension, A4) passes through too, validated only as "a non-empty
 * string when present" — the fingerprint itself is opaque to the
 * remote layer (its semantics live in the runtime control plane).
 */
function normalizeTeamResolveControlValue(raw) {
    if (!isPlainRecord(raw)) {
        throw portContractError('teamResolveControl.decision', `expected an object, got ${String(raw)}`);
    }
    const requestId = raw['requestId'];
    if (typeof requestId !== 'string' || requestId.length === 0) {
        throw portContractError('teamResolveControl.decision.requestId', 'must be a non-empty string');
    }
    const decision = raw['decision'];
    if (typeof decision !== 'string' ||
        !TEAM_RESOLVE_CONTROL_DECISION_VALUES.includes(decision)) {
        throw portContractError('teamResolveControl.decision.decision', `must be one of ${JSON.stringify([...TEAM_RESOLVE_CONTROL_DECISION_VALUES])}, got ${String(decision)}`);
    }
    const decider = raw['decider'];
    if (!isPlainRecord(decider)) {
        throw portContractError('teamResolveControl.decision.decider', 'must be an object');
    }
    const scope = raw['scope'];
    if (!isPlainRecord(scope)) {
        throw portContractError('teamResolveControl.decision.scope', 'must be an object');
    }
    // Alpha.2 exact-scope extension (A4): the scope is still pass-through
    // (D-4), but the OPTIONAL operation fingerprint is validated when
    // present — a fingerprint that is present but empty/non-string would
    // be a corrupted durable scope (fail closed at the wire boundary; the
    // runtime control service itself treats present-but-malformed
    // fingerprints as malformed input at its own boundaries).
    const scopeFingerprint = scope['operationFingerprint'];
    if (scopeFingerprint !== undefined &&
        (typeof scopeFingerprint !== 'string' || scopeFingerprint.length === 0)) {
        throw portContractError('teamResolveControl.decision.scope.operationFingerprint', 'must be a non-empty string when present');
    }
    for (const field of ['requestSequence', 'decisionSequence']) {
        const value = raw[field];
        if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
            throw portContractError(`teamResolveControl.decision.${field}`, 'must be a safe integer >= 1');
        }
    }
    const createdAt = raw['createdAt'];
    if (typeof createdAt !== 'string' || createdAt.length === 0) {
        throw portContractError('teamResolveControl.decision.createdAt', 'must be a non-empty string');
    }
    for (const field of ['reason', 'note']) {
        const value = raw[field];
        if (value !== undefined && typeof value !== 'string') {
            throw portContractError(`teamResolveControl.decision.${field}`, 'must be a string when present');
        }
    }
    // The port contract guarantees a lossless-JSON-safe record.
    return raw;
}
/**
 * Validate the `team.prepareOrdinaryOpen` success value against the
 * closed v5 response shape (D-4 discipline: the top-level REQUIRED
 * fields are checked — `{ rootSessionId, permitted: true }` — the
 * response may carry MORE fields ("at least", guide §10.2) and any extra
 * passes through): the armed one-shot ordinary-activation permit fact.
 */
function normalizeTeamPrepareOrdinaryOpenValue(raw) {
    if (!isPlainRecord(raw)) {
        throw portContractError('teamPrepareOrdinaryOpen', `expected an object, got ${String(raw)}`);
    }
    const rootSessionId = raw['rootSessionId'];
    if (typeof rootSessionId !== 'string' || rootSessionId.length === 0) {
        throw portContractError('teamPrepareOrdinaryOpen.rootSessionId', 'must be a non-empty string');
    }
    if (raw['permitted'] !== true) {
        throw portContractError('teamPrepareOrdinaryOpen.permitted', `must be true, got ${String(raw['permitted'])}`);
    }
    // The port contract guarantees a lossless-JSON-safe record; the extra
    // fields ("at least" — guide §10.2) pass through (D-4).
    return raw;
}
/**
 * The CLOSED v6 `team.getReadState` wire value fields (frozen by
 * team-view-sync-complete Phase 2): every field is REQUIRED on the wire
 * (`null` cells are typed, never absent) and no extra field is allowed
 * (this is a fully closed value, not an "at least" shape).
 */
const REMOTE_TEAM_GET_READ_STATE_VALUE_FIELDS = [
    'disposed',
    'durableGeneration',
    'liveToken',
    'memberInstanceId',
    'relation',
    'teamSessionId',
];
const REMOTE_TEAM_GET_READ_STATE_RELATIONS = [
    'team-root',
    'team-member',
    'none',
];
/**
 * Validate the `team.getReadState` port value against the closed v6 wire
 * shape: the relation is the frozen three-value vocabulary; the
 * `teamSessionId` / `durableGeneration` cells are `string` / `number` or
 * `null` (never absent); a `none` answer carries `null` cells (including
 * `liveToken`); a `team-member` answer carries its instance id;
 * `disposed` is a boolean true only for a member whose durable lifecycle
 * is `DISPOSED`; the `liveToken` cell is a non-empty `lt-v1-*` string for
 * a team relation (PR #35 follow-up — the lightweight probe must carry
 * the token) and `null` for `none`.
 */
function normalizeTeamGetReadStateValue(raw) {
    if (!isPlainRecord(raw)) {
        throw portContractError('readState', `expected an object, got ${String(raw)}`);
    }
    for (const field of REMOTE_TEAM_GET_READ_STATE_VALUE_FIELDS) {
        if (!(field in raw)) {
            throw portContractError(`readState.${field}`, 'missing field');
        }
    }
    for (const key of Object.keys(raw)) {
        if (!REMOTE_TEAM_GET_READ_STATE_VALUE_FIELDS.includes(key)) {
            throw portContractError(`readState.${key}`, 'unknown field');
        }
    }
    const relation = raw['relation'];
    if (typeof relation !== 'string' || !REMOTE_TEAM_GET_READ_STATE_RELATIONS.includes(relation)) {
        throw portContractError('readState.relation', `must be one of ${REMOTE_TEAM_GET_READ_STATE_RELATIONS.join(' | ')}, got ${String(relation)}`);
    }
    const teamSessionId = raw['teamSessionId'];
    if (teamSessionId !== null && (typeof teamSessionId !== 'string' || teamSessionId.length === 0)) {
        throw portContractError('readState.teamSessionId', `must be a non-empty string or null, got ${String(teamSessionId)}`);
    }
    const memberInstanceId = raw['memberInstanceId'];
    if (memberInstanceId !== null &&
        (typeof memberInstanceId !== 'string' || memberInstanceId.length === 0)) {
        throw portContractError('readState.memberInstanceId', `must be a non-empty string or null, got ${String(memberInstanceId)}`);
    }
    if (typeof raw['disposed'] !== 'boolean') {
        throw portContractError('readState.disposed', `must be a boolean, got ${String(raw['disposed'])}`);
    }
    const durableGeneration = raw['durableGeneration'];
    if (durableGeneration !== null &&
        (typeof durableGeneration !== 'number' ||
            !Number.isSafeInteger(durableGeneration) ||
            durableGeneration < 1)) {
        throw portContractError('readState.durableGeneration', `must be a safe integer >= 1 or null, got ${String(durableGeneration)}`);
    }
    // PR #35 follow-up (frozen decision: the read-state is the LIGHTWEIGHT
    // probe): the liveToken cell mirrors the v6 projection's token — a
    // team relation must carry the non-empty `lt-v1-*` token (a host that
    // cannot compute it fails the read typed); a `none` answer carries
    // null (there is no owning TeamSession whose live state to token).
    const liveToken = raw['liveToken'];
    const liveTokenIsNull = liveToken === null;
    if (!liveTokenIsNull &&
        (typeof liveToken !== 'string' ||
            liveToken.length < 'lt-v1-'.length ||
            !liveToken.startsWith('lt-v1-'))) {
        throw portContractError('readState.liveToken', `must be a non-empty lt-v1-* string or null, got ${String(liveToken)}`);
    }
    // Frozen cross-field invariants (fail closed on any contradiction):
    if (relation === 'none') {
        if (teamSessionId !== null ||
            memberInstanceId !== null ||
            durableGeneration !== null ||
            liveToken !== null) {
            throw portContractError('readState.none', 'a none answer must carry null teamSessionId / memberInstanceId / durableGeneration / liveToken');
        }
        if (raw['disposed'] !== false) {
            throw portContractError('readState.none', 'a none answer is never disposed');
        }
    }
    else if (relation === 'team-member') {
        if (teamSessionId === null || memberInstanceId === null || durableGeneration === null) {
            throw portContractError('readState.team-member', 'a team-member answer must carry its teamSessionId, memberInstanceId and durableGeneration');
        }
        if (liveTokenIsNull) {
            throw portContractError('readState.team-member', 'a team-member answer must carry its liveToken (a team relation with a null token is impossible)');
        }
    }
    else {
        // team-root
        if (teamSessionId === null || durableGeneration === null) {
            throw portContractError('readState.team-root', 'a team-root answer must carry its teamSessionId and durableGeneration');
        }
        if (memberInstanceId !== null || raw['disposed'] !== false) {
            throw portContractError('readState.team-root', 'a team-root answer carries no member instance and is never disposed');
        }
        if (liveTokenIsNull) {
            throw portContractError('readState.team-root', 'a team-root answer must carry its liveToken (a team relation with a null token is impossible)');
        }
    }
    // Every cell + cross-field invariant was verified above (fail closed)
    // — the construction below is a verified-cell narrowing to the
    // discriminated union member (no data re-read, no casts of unchecked
    // values).
    if (relation === 'none') {
        return {
            relation: 'none',
            teamSessionId: null,
            memberInstanceId: null,
            disposed: false,
            durableGeneration: null,
            liveToken: null,
        };
    }
    if (relation === 'team-member') {
        return {
            relation: 'team-member',
            teamSessionId: teamSessionId,
            memberInstanceId: memberInstanceId,
            disposed: raw['disposed'],
            durableGeneration: durableGeneration,
            liveToken: liveToken,
        };
    }
    return {
        relation: 'team-root',
        teamSessionId: teamSessionId,
        memberInstanceId: null,
        disposed: false,
        durableGeneration: durableGeneration,
        liveToken: liveToken,
    };
}
/**
 * The team category handler (`team.create` [the two create flavors],
 * `team.admitInitialWork` [v2-only], `team.listRoots` [v3-only],
 * `team.ensureRootLive` [v3-only], `team.resolveControl` [v4-only],
 * `team.prepareOrdinaryOpen` [v5-only], `team.getReadState` [v6-only],
 * `team.getProjection` [the `base` shape for v1-v5; the `live` shape for
 * v6 adds `durableGeneration` + `liveToken`], `team.getLedgerPage`).
 *
 * Semantic routing (pre-alpha3 PR-F, plan §F.3): the dispatcher passes
 * the request's contract version (the transport adapter's concern); this
 * handler translates it to the SEMANTIC create flavor / projection shape
 * through the contracts semantic adapter and branches on those — no
 * literal version comparison in the handler body. The version-specific
 * parsed param object is already the matching typed shape (the shared
 * version-aware param parser validated the closed field set per wire
 * version before dispatch).
 */
export function createRemoteTeamHandler(ports) {
    return (method, params, version) => {
        switch (method) {
            case 'team.create': {
                // pre-alpha3 PR-F (plan §F.3) — the version is translated to the
                // SEMANTIC create flavor by the contracts semantic adapter (the
                // only version branch in the wire surface); the handler routes on
                // the flavor. The version-aware param parser already validated the
                // matching closed field set (embedded-work: the optional
                // `initialWork`; workspace: the optional `workspace`, CREATE-ONLY).
                const flavor = teamCreateFlavorOf(version);
                if (flavor === TEAM_CREATE_FLAVORS.workspace) {
                    const createParams = params;
                    const created = ports.teamCreateWorkspace.create(createParams.rootSessionId, createParams.blueprintId, createParams.blueprintRevision, createParams.workspace);
                    return normalizeTeamCreateValue('teamCreateWorkspace', created);
                }
                const createParams = params;
                const teamCreate = ports.teamCreateEmbeddedWork;
                const created = teamCreate.create(createParams.rootSessionId, createParams.blueprintId, createParams.blueprintRevision, createParams.initialWork);
                return normalizeTeamCreateValue('teamCreateEmbeddedWork', created);
            }
            case 'team.admitInitialWork': {
                // v2-only: the version-aware param parser guarantees the request
                // version is 2 (a v1 request is typed-rejected before dispatch).
                const admitParams = params;
                const admitted = ports.teamAdmitInitialWork.admit(admitParams.rootSessionId, admitParams.requestToken, admitParams.prompt, admitParams.attachedContext);
                if (!isPlainRecord(admitted)) {
                    throw portContractError('teamAdmitInitialWork', `expected an object, got ${String(admitted)}`);
                }
                return { data: admitted };
            }
            case 'team.listRoots': {
                // v3-only: the version-aware param parser guarantees the request
                // version is 3 (an older-version request is typed-rejected before
                // dispatch). READ-ONLY: the port performs no repository writes and
                // no agent effects.
                const roots = ports.teamRoots.listRoots();
                const rows = [];
                for (let i = 0; i < roots.length; i++) {
                    rows.push(normalizeTeamRootRow(roots[i], i));
                }
                return { data: { roots: rows } };
            }
            case 'team.ensureRootLive': {
                // v3-only (the availability check guarantees version === 3). The
                // production S6 handler is wired by D2 over the live glue's
                // ensureLiveAgent; until then it answers the method with the
                // typed TEAM_REMOTE_TEAM_ROOT_LIVE_NOT_IMPLEMENTED failure (never
                // a silent success). The port value is validated against the
                // closed v3 success shape when a real handler is present.
                const ensureParams = params;
                const ensured = ports.teamEnsureRootLive.ensureRootLive(ensureParams.teamSessionId);
                return { data: normalizeTeamEnsureRootLiveValue(ensured) };
            }
            case 'team.resolveControl': {
                // v4-only (the availability check guarantees version === 4). The
                // human ingress of the durable control plane (F3/F11/F9/T1.4
                // repair round r1 F9): the wire params carry NO caller field
                // (adjudication U3) — the production host (the S6 plugin)
                // derives the human principal from the T12-B4 connection-gate
                // authority basis and stamps it on the service call; the frozen
                // CONTROL_RESOLVER_ROLES + durable exactly-once semantics stay
                // the only resolver authority (the port's typed CONTROL_* /
                // TEAM_RUNTIME_* failures pass through invariant 4b).
                const resolveParams = params;
                const decision = ports.teamResolveControl.resolveControl(resolveParams.teamSessionId, resolveParams.requestId, resolveParams.decision, resolveParams.note);
                return { data: { decision: normalizeTeamResolveControlValue(decision) } };
            }
            case 'team.prepareOrdinaryOpen': {
                // v5-only (the availability check guarantees version === 5). C1
                // restart-0.1.7-rc.1 recovery (guide §10.2): the narrow one-shot
                // ordinary-activation PERMIT of the Team fence — a Team
                // CONTROL-PLANE RPC (no Team ensure, no Team Agent side effect,
                // no TeamDomain mutation beyond the one-shot activation-allow
                // fact). The wire params carry ONLY the root id (the host
                // authority is the connection gate — no caller claim, no token).
                // The production S6 handler (s6-remote, A33/A34) raises the
                // typed failures TEAM_REMOTE_FOREIGN_TEAM (a root outside the
                // caller's team — assertBoundRoot) and
                // TEAM_REMOTE_TEAM_ORDINARY_OPEN_PORT_UNAVAILABLE (the permit
                // port is absent from the host wiring — fail closed, never a
                // silent success); both pass through the dispatcher unchanged
                // (invariant 4b).
                const prepareParams = params;
                const permitted = ports.teamPrepareOrdinaryOpen.prepareOrdinaryOpen(prepareParams.teamSessionId);
                return { data: normalizeTeamPrepareOrdinaryOpenValue(permitted) };
            }
            case 'team.getProjection': {
                const projectionParams = params;
                // pre-alpha3 PR-F (plan §F.3) — the version is translated to the
                // SEMANTIC projection shape by the contracts semantic adapter; the
                // handler branches on the shape (the shared wire application of the
                // `live` shape is withLiveProjectionFreshness — defined in exactly
                // one place).
                const shape = projectionShapeOf(version);
                if (shape === PROJECTION_SHAPES.live) {
                    // The `live` shape: the frozen base shape PLUS the two additive
                    // freshness cells (team-view-sync-complete Phase 2 frozen
                    // decision 4) — `durableGeneration` (always === `generation`,
                    // named for the client freshness PAIR) and `liveToken` (the
                    // deterministic opaque semantic-live-state token). Every other
                    // wire version serves the EXACT frozen `base` shape
                    // (byte-identical passthrough — the v6 cells are absent, not
                    // null).
                    //
                    // PR #35 second follow-up P0-2 (same-snapshot): the `live` read
                    // goes through the ATOMIC `projectLive` port — the projection
                    // plus a token computed FROM THE SAME PROJECTION RESULT (the
                    // adapter materializes the live overlay once and derives the
                    // token from the already-materialized
                    // `members[].liveActivity` cells). The frame and the token can
                    // never come from two different live snapshots, and the
                    // lightweight `liveToken` port is NOT consulted on the `live`
                    // projection path (it serves the getReadState probe).
                    const live = ports.projection.projectLive(projectionParams.teamSessionId);
                    const projection = normalizeProjection(live.projection);
                    const liveToken = live.liveToken;
                    if (typeof liveToken !== 'string' || liveToken.length === 0) {
                        throw portContractError('projectLive.liveToken', 'must be a non-empty string');
                    }
                    return {
                        data: {
                            projection: withLiveProjectionFreshness(projection, liveToken),
                        },
                        projectionGeneration: projection.generation,
                    };
                }
                const raw = ports.projection.project(projectionParams.teamSessionId);
                const projection = normalizeProjection(raw);
                return {
                    data: { projection },
                    projectionGeneration: projection.generation,
                };
            }
            case 'team.getReadState': {
                // v6-only (the availability check in parseRemoteMethodParams
                // guarantees version === 6). The durable TeamDomain rows are the
                // sole authority; a storage/integrity failure throws through and
                // the dispatcher answers with the typed pass-through error
                // (invariant 4b) — never a silent `none` (fail closed).
                const readStateParams = params;
                const value = normalizeTeamGetReadStateValue(ports.teamReadState.readState(readStateParams.sessionId));
                return { data: value };
            }
            case 'team.getLedgerPage': {
                const pageParams = params;
                const allEntries = ports.ledger.listEntries(pageParams.teamSessionId);
                const entriesAfter = [];
                for (const rawEntry of allEntries) {
                    const entry = normalizeLedgerEntry(rawEntry);
                    if (entry.sequence > pageParams.afterSequence)
                        entriesAfter.push(entry);
                }
                const page = entriesAfter.slice(0, pageParams.limit);
                let nextAfterSequence = null;
                if (entriesAfter.length > pageParams.limit) {
                    const last = page[page.length - 1];
                    if (last === undefined) {
                        throw portContractError('ledger page', 'internal slicing error');
                    }
                    nextAfterSequence = last.sequence;
                }
                return {
                    data: {
                        entries: page,
                        nextAfterSequence,
                        total: ports.ledger.countEntries(pageParams.teamSessionId),
                    },
                };
            }
            default:
                throw new Error(`team handler routed an unknown method: ${method}`);
        }
    };
}
//# sourceMappingURL=team.js.map