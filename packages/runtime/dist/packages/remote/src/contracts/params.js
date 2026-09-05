/**
 * Per-method closed param schemas of the Remote contract v1.
 *
 * Every catalog method declares a CLOSED set of param fields (design note
 * §3 table, "Input params (closed)"). Parsing one request's `params`
 * object:
 *
 * 1. rejects any unknown field (`malformed-params`, reason
 *    `unknown-field`, the offending field in `details.field`);
 * 2. requires every required field (`missing-required`);
 * 3. validates each value — structural ID fields throw the mirrored frozen
 *    P3 codes from `ids.ts` (e.g. a malformed TeamSessionId surfaces as
 *    `INVALID_ROOT_SESSION_ID`, invariant 9), everything else throws
 *    `malformed-params` with a machine-readable `reason`;
 * 4. returns the typed param object the handler layer consumes.
 *
 * Free-form content fields (the message `body`, the compatibility `note`)
 * are exempt from the no-control-char / no-whitespace ID rule — newlines
 * are legal content — but bound by a length cap (design note §3).
 *
 * Pure module: no I/O, no node: builtins, no runtime environment
 * assumptions.
 * @module @dsh-agent-team/remote/contracts/params
 */
import { remoteContractError, } from './errors.js';
import { parseRemoteBlueprintId, parseRemoteBlueprintRevision, parseRemoteInstanceId, parseRemoteRootSessionId, parseRemoteSessionId, parseRemoteTeamSessionId, parseRemoteTemplateId, REMOTE_ID_MAX_LENGTH, } from './ids.js';
import { assertRemoteSafeJsonValue, } from './remote-safe.js';
// ---------------------------------------------------------------------------
// Shared closed vocabularies (value-level mirrors of the frozen contracts)
// ---------------------------------------------------------------------------
/** The closed capability set (`packages/domain/policy` `CAPABILITY_NAMES`). */
export const REMOTE_CAPABILITY_VALUES = [
    'model',
    'tools',
    'permissions',
    'skills',
    'mcp',
];
/** The five frozen probe triggers (`packages/runtime/compatibility`). */
export const REMOTE_PROBE_TRIGGER_VALUES = [
    'ROOT_COLD_RESUME',
    'MEMBER_COLD_RESUME',
    'NEW_ACTIVATION',
    'CAPABILITY_GENERATION_CHANGE',
    'STALE_GENERATION_BEFORE_NEW_WORK',
];
/** The closed mutation actor kinds (`packages/runtime/mutation`). */
export const REMOTE_MUTATION_ACTOR_KINDS = ['human', 'leader', 'member'];
/** The closed mutation scopes. */
export const REMOTE_MUTATION_SCOPES = ['team', 'instance'];
/** The closed admission actions the remote surface exposes (P6-T2). */
export const REMOTE_ADMISSION_ACTIONS = [
    'create-member',
    'send-message',
    'follow-up',
];
// ---------------------------------------------------------------------------
// Closed field sets (one per method — the "closed" part of the schemas)
// ---------------------------------------------------------------------------
export const REMOTE_CATALOG_LIST_FIELDS = [];
export const REMOTE_CATALOG_GET_FIELDS = ['blueprintId', 'blueprintRevision'];
export const REMOTE_INTENT_PROBE_FIELDS = [
    'blueprintId',
    'blueprintRevision',
    'environmentFacts',
];
export const REMOTE_TEAM_CREATE_FIELDS = [
    'blueprintId',
    'blueprintRevision',
    'initialWork',
    'rootSessionId',
];
export const REMOTE_TEAM_GET_PROJECTION_FIELDS = ['teamSessionId'];
export const REMOTE_TEAM_GET_LEDGER_PAGE_FIELDS = [
    'afterSequence',
    'limit',
    'teamSessionId',
];
export const REMOTE_MEMBER_CREATE_FIELDS = [
    'caller',
    'delegationInstanceId',
    'delegationTemplateId',
    'payload',
    'requestToken',
    'teamSessionId',
];
export const REMOTE_MEMBER_SEND_FIELDS = [
    'body',
    'caller',
    'payload',
    'recipientInstanceId',
    'requestToken',
    'subject',
    'teamSessionId',
];
export const REMOTE_MEMBER_FOLLOWUP_FIELDS = [
    'caller',
    'payload',
    'requestToken',
    'targetInstanceId',
    'teamSessionId',
];
export const REMOTE_MEMBER_LIFECYCLE_FIELDS = [
    'instanceId',
    'teamSessionId',
];
export const REMOTE_OVERRIDE_GET_FIELDS = [
    'capability',
    'scope',
    'targetInstanceId',
    'teamSessionId',
];
export const REMOTE_OVERRIDE_SET_FIELDS = [
    'actor',
    'capability',
    'scope',
    'targetInstanceId',
    'teamSessionId',
    'value',
];
export const REMOTE_OVERRIDE_RESET_FIELDS = [
    'actor',
    'capability',
    'scope',
    'targetInstanceId',
    'teamSessionId',
];
export const REMOTE_POLICY_STATE_GET_FIELDS = ['teamSessionId'];
export const REMOTE_POLICY_STATE_SET_FIELDS = [
    'actor',
    'target',
    'teamSessionId',
];
export const REMOTE_COMPATIBILITY_GET_FIELDS = ['teamSessionId'];
export const REMOTE_COMPATIBILITY_ACK_FIELDS = [
    'acknowledgedBy',
    'note',
    'requirementId',
    'teamSessionId',
];
export const REMOTE_COMPATIBILITY_REPROBE_FIELDS = [
    'teamSessionId',
    'trigger',
];
export const REMOTE_HANDOFF_PREPARE_FIELDS = ['sourceSessionId'];
export const REMOTE_HANDOFF_CREATE_FIELDS = [
    'requestToken',
    'sourceSessionId',
    'staged',
];
export const REMOTE_LEGACY_INSPECT_FIELDS = [
    'dshHome',
    'projectDir',
    'workspaceCwd',
];
// ---------------------------------------------------------------------------
// Shared parsing helpers (module-private)
// ---------------------------------------------------------------------------
/** Is `value` a plain (non-array) object? */
function isPlainRecord(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
        return false;
    const proto = Object.getPrototypeOf(value);
    return proto === null || proto === Object.prototype;
}
/** Build a `malformed-params` boundary error with the standard details. */
function paramMalformed(method, field, reason, message) {
    return remoteContractError('malformed-params', message, { method, field, reason });
}
/** Reject any field of `params` outside the method's closed field set. */
function assertNoUnknownFields(method, params, allowed) {
    for (const key of Object.keys(params)) {
        if (!allowed.includes(key)) {
            throw paramMalformed(method, key, 'unknown-field', `method '${method}' has unknown param field '${key}' (closed fields: ${allowed.length > 0 ? allowed.join(', ') : 'none'})`);
        }
    }
}
/** Reject any key of `object` outside `allowed` (sub-object closed check). */
function assertNoUnknownKeys(method, fieldPath, object, allowed) {
    for (const key of Object.keys(object)) {
        if (!allowed.includes(key)) {
            throw paramMalformed(method, `${fieldPath}.${key}`, 'unknown-field', `${fieldPath} has unknown field '${key}' (closed fields: ${allowed.join(', ')})`);
        }
    }
}
/** Read a required field (throws `missing-required` when absent). */
function requiredField(method, params, field) {
    if (!(field in params) || params[field] === undefined) {
        throw paramMalformed(method, field, 'missing-required', `method '${method}' requires param field '${field}'`);
    }
    return params[field];
}
/** Read an optional field (`undefined` when absent). */
function optionalField(method, params, field) {
    if (!(field in params) || params[field] === undefined)
        return undefined;
    return params[field];
}
/** Rejects ASCII control characters and DEL (0x00–0x1F, 0x7F). */
function hasControlChars(value) {
    for (let i = 0; i < value.length; i++) {
        const code = value.charCodeAt(i);
        if (code < 0x20 || code === 0x7f)
            return true;
    }
    return false;
}
/** Rejects any whitespace character (Unicode `\s`). */
function hasWhitespace(value) {
    return /\s/.test(value);
}
/**
 * A structural opaque token (request tokens, human ids, requirement ids,
 * state ids, subjects): string, 1..255 chars, no control chars, no
 * whitespace. (The ID rule of `ids.ts` minus the frozen P3 code.)
 */
function parseRemoteOpaqueToken(value, method, field) {
    if (typeof value !== 'string' || value.length === 0 || value.length > REMOTE_ID_MAX_LENGTH) {
        throw paramMalformed(method, field, 'invalid-value', `${field} must be a string of 1..${REMOTE_ID_MAX_LENGTH} characters`);
    }
    if (hasControlChars(value)) {
        throw paramMalformed(method, field, 'invalid-value', `${field} must not contain control characters`);
    }
    if (hasWhitespace(value)) {
        throw paramMalformed(method, field, 'invalid-value', `${field} must not contain whitespace`);
    }
    return value;
}
/**
 * A filesystem path (legacy.inspect fields): string, 1..4096 chars, no
 * control characters (whitespace allowed — Windows paths carry spaces).
 */
function parseRemotePath(value, method, field) {
    if (typeof value !== 'string' || value.length === 0 || value.length > 4096) {
        throw paramMalformed(method, field, 'invalid-value', `${field} must be a string of 1..4096 characters`);
    }
    if (hasControlChars(value)) {
        throw paramMalformed(method, field, 'invalid-value', `${field} must not contain control characters`);
    }
    return value;
}
/** A free-form content string (message body): 1..200000 chars, any content. */
function parseRemoteBody(value, method, field) {
    if (typeof value !== 'string' || value.length === 0 || value.length > 200000) {
        throw paramMalformed(method, field, 'invalid-value', `${field} must be a non-empty string of at most 200000 characters`);
    }
    return value;
}
/** A free-form note (compatibility.ack): 1..2048 chars, any content. */
function parseRemoteNote(value, method, field) {
    if (typeof value !== 'string' || value.length === 0 || value.length > 2048) {
        throw paramMalformed(method, field, 'invalid-value', `${field} must be a non-empty string of at most 2048 characters`);
    }
    return value;
}
/** A non-negative safe integer (ledger `afterSequence`). */
function parseRemoteNonNegativeInt(value, method, field) {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || !Number.isSafeInteger(value)) {
        throw paramMalformed(method, field, 'invalid-value', `${field} must be a non-negative integer, got ${String(value)}`);
    }
    return value;
}
/** A bounded positive safe integer (ledger `limit`: 1..500). */
function parseRemoteBoundedInt(value, method, field, max) {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > max) {
        throw paramMalformed(method, field, 'invalid-value', `${field} must be an integer in 1..${max}, got ${String(value)}`);
    }
    return value;
}
/** A closed-enum string field. */
function parseRemoteEnum(value, method, field, allowed) {
    if (typeof value !== 'string' || !allowed.includes(value)) {
        throw paramMalformed(method, field, 'invalid-value', `${field} must be one of: ${allowed.join(' | ')}`);
    }
    return value;
}
/** A plain-record field (lossless safety already guaranteed by the envelope). */
function parseRemoteLosslessRecord(value, method, field) {
    if (!isPlainRecord(value)) {
        throw paramMalformed(method, field, 'invalid-value', `${field} must be an object, got ${value === null ? 'null' : typeof value}`);
    }
    return assertRemoteSafeJsonValue(value, field);
}
/** The admission caller object (closed per `kind`). */
function parseRemoteCaller(value, method, field) {
    if (!isPlainRecord(value)) {
        throw paramMalformed(method, field, 'invalid-value', `${field} must be an object with kind 'human' or 'instance'`);
    }
    const kind = value['kind'];
    if (kind === 'human') {
        assertNoUnknownKeys(method, field, value, ['humanId', 'kind']);
        const humanId = requiredField(method, value, 'humanId');
        return { kind: 'human', humanId: parseRemoteOpaqueToken(humanId, method, `${field}.humanId`) };
    }
    if (kind === 'instance') {
        assertNoUnknownKeys(method, field, value, ['instanceId', 'kind']);
        const instanceId = requiredField(method, value, 'instanceId');
        return {
            kind: 'instance',
            instanceId: parseRemoteInstanceId(instanceId, `${field}.instanceId`),
        };
    }
    throw paramMalformed(method, `${field}.kind`, 'invalid-value', `${field}.kind must be 'human' or 'instance'`);
}
/** The mutation actor object (closed per `kind`; `member` requires its identity). */
function parseRemoteMutationActor(value, method, field) {
    if (!isPlainRecord(value)) {
        throw paramMalformed(method, field, 'invalid-value', `${field} must be an object with kind 'human', 'leader', or 'member'`);
    }
    const kind = value['kind'];
    if (kind === 'human' || kind === 'leader') {
        assertNoUnknownKeys(method, field, value, ['kind']);
        return { kind };
    }
    if (kind === 'member') {
        assertNoUnknownKeys(method, field, value, ['kind', 'member']);
        const rawMember = requiredField(method, value, 'member');
        if (!isPlainRecord(rawMember)) {
            throw paramMalformed(method, `${field}.member`, 'invalid-value', `${field}.member must be an object { rootSessionId, instanceId }`);
        }
        assertNoUnknownKeys(method, `${field}.member`, rawMember, ['instanceId', 'rootSessionId']);
        return {
            kind: 'member',
            member: {
                rootSessionId: parseRemoteRootSessionId(requiredField(method, rawMember, 'rootSessionId'), `${field}.member.rootSessionId`),
                instanceId: parseRemoteInstanceId(requiredField(method, rawMember, 'instanceId'), `${field}.member.instanceId`),
            },
        };
    }
    throw paramMalformed(method, `${field}.kind`, 'invalid-value', `${field}.kind must be 'human', 'leader', or 'member'`);
}
/** The frozen PolicyEntry value (closed per `kind`). */
function parseRemotePolicyEntry(value, method, field) {
    if (!isPlainRecord(value)) {
        throw paramMalformed(method, field, 'invalid-value', `${field} must be an object with kind 'allow' or 'deny'`);
    }
    const kind = value['kind'];
    if (kind === 'allow') {
        assertNoUnknownKeys(method, field, value, ['items', 'kind']);
        const rawItems = requiredField(method, value, 'items');
        if (!Array.isArray(rawItems)) {
            throw paramMalformed(method, `${field}.items`, 'invalid-value', `${field}.items must be an array of strings`);
        }
        const items = [];
        for (let i = 0; i < rawItems.length; i++) {
            const item = rawItems[i];
            if (typeof item !== 'string' ||
                item.length === 0 ||
                item.length > REMOTE_ID_MAX_LENGTH ||
                hasControlChars(item)) {
                throw paramMalformed(method, `${field}.items[${i}]`, 'invalid-value', `${field}.items entries must be non-empty strings of at most ${REMOTE_ID_MAX_LENGTH} characters without control characters`);
            }
            items.push(item);
        }
        return { kind: 'allow', items };
    }
    if (kind === 'deny') {
        assertNoUnknownKeys(method, field, value, ['kind']);
        return { kind: 'deny' };
    }
    throw paramMalformed(method, `${field}.kind`, 'invalid-value', `${field}.kind must be 'allow' or 'deny'`);
}
/** The frozen PolicyStateView object (cells keyed by closed capability). */
function parseRemotePolicyStateView(value, method, field) {
    if (!isPlainRecord(value)) {
        throw paramMalformed(method, field, 'invalid-value', `${field} must be an object { stateId, cells? }`);
    }
    assertNoUnknownKeys(method, field, value, ['cells', 'stateId']);
    const stateId = parseRemoteOpaqueToken(requiredField(method, value, 'stateId'), method, `${field}.stateId`);
    const rawCells = optionalField(method, value, 'cells');
    if (rawCells === undefined)
        return { stateId };
    if (!isPlainRecord(rawCells)) {
        throw paramMalformed(method, `${field}.cells`, 'invalid-value', `${field}.cells must be an object keyed by capability name`);
    }
    const cells = {};
    for (const capability of Object.keys(rawCells)) {
        if (!REMOTE_CAPABILITY_VALUES.includes(capability)) {
            throw paramMalformed(method, `${field}.cells.${capability}`, 'invalid-value', `${field}.cells keys must be capability names: ${REMOTE_CAPABILITY_VALUES.join(' | ')}`);
        }
        const rawCell = rawCells[capability];
        if (!isPlainRecord(rawCell)) {
            throw paramMalformed(method, `${field}.cells.${capability}`, 'invalid-value', `${field}.cells.${capability} must be an object { locked?, value? }`);
        }
        assertNoUnknownKeys(method, `${field}.cells.${capability}`, rawCell, ['locked', 'value']);
        const rawLocked = optionalField(method, rawCell, 'locked');
        if (rawLocked !== undefined && typeof rawLocked !== 'boolean') {
            throw paramMalformed(method, `${field}.cells.${capability}.locked`, 'invalid-value', `${field}.cells.${capability}.locked must be a boolean`);
        }
        const rawCellValue = optionalField(method, rawCell, 'value');
        const cellValue = {
            ...(rawLocked !== undefined ? { locked: rawLocked } : {}),
            ...(rawCellValue !== undefined
                ? {
                    value: parseRemotePolicyEntry(rawCellValue, method, `${field}.cells.${capability}.value`),
                }
                : {}),
        };
        cells[capability] = cellValue;
    }
    return { stateId, cells };
}
/**
 * The `environmentFacts` array: plain records only (lossless safety is
 * guaranteed by the envelope), capped at 10000 entries.
 */
function parseRemoteEnvironmentFacts(value, method, field) {
    if (!Array.isArray(value)) {
        throw paramMalformed(method, field, 'invalid-value', `${field} must be an array of objects`);
    }
    if (value.length > 10000) {
        throw paramMalformed(method, field, 'too-large', `${field} must contain at most 10000 entries, got ${value.length}`);
    }
    const facts = [];
    for (let i = 0; i < value.length; i++) {
        const fact = value[i];
        if (!isPlainRecord(fact)) {
            throw paramMalformed(method, `${field}[${i}]`, 'invalid-value', `${field} entries must be objects`);
        }
        facts.push(assertRemoteSafeJsonValue(fact, `${field}[${i}]`));
    }
    return facts;
}
/**
 * Cross-field rule for the mutation-addressed override methods:
 * `targetInstanceId` is present iff `scope === 'instance'` (a team-scope
 * address has no target; an instance-scope address names exactly one).
 */
function assertOverrideTargetConsistency(method, scope, targetInstanceId) {
    if (targetInstanceId !== undefined && scope !== 'instance') {
        throw paramMalformed(method, 'targetInstanceId', 'conflicting-fields', `${method}: targetInstanceId requires scope 'instance'`);
    }
    if (scope === 'instance' && targetInstanceId === undefined) {
        throw paramMalformed(method, 'targetInstanceId', 'missing-required', `${method}: scope 'instance' requires targetInstanceId`);
    }
}
/**
 * Cross-field rule for the mutation-addressed override methods (deviation
 * D-7 / P7-T2): agent-origin actors (leader/member) may only address the
 * team scope — `scope`/`targetInstanceId` are rejected for them.
 */
function assertActorScopeConsistency(method, actor, scope, targetInstanceId) {
    if (actor.kind !== 'human' && (scope !== undefined || targetInstanceId !== undefined)) {
        throw paramMalformed(method, 'scope', 'invalid-value', `${method}: actor kind '${actor.kind}' may not use instance scope`);
    }
}
// ---------------------------------------------------------------------------
// Per-method param parsers (exported — one per catalog method)
// ---------------------------------------------------------------------------
/** Parse `catalog.list` params (no fields). */
export function parseRemoteCatalogListParams(method, params) {
    assertNoUnknownFields(method, params, REMOTE_CATALOG_LIST_FIELDS);
    return {};
}
/** Parse `catalog.get` params. */
export function parseRemoteCatalogGetParams(method, params) {
    assertNoUnknownFields(method, params, REMOTE_CATALOG_GET_FIELDS);
    const blueprintId = parseRemoteBlueprintId(requiredField(method, params, 'blueprintId'), 'blueprintId');
    const rawRevision = optionalField(method, params, 'blueprintRevision');
    return {
        blueprintId,
        ...(rawRevision === undefined
            ? {}
            : { blueprintRevision: parseRemoteBlueprintRevision(rawRevision, 'blueprintRevision') }),
    };
}
/** Parse `intent.probe` params (`environmentFacts` required, may be empty). */
export function parseRemoteIntentProbeParams(method, params) {
    assertNoUnknownFields(method, params, REMOTE_INTENT_PROBE_FIELDS);
    const blueprintId = parseRemoteBlueprintId(requiredField(method, params, 'blueprintId'), 'blueprintId');
    const rawRevision = optionalField(method, params, 'blueprintRevision');
    return {
        blueprintId,
        ...(rawRevision === undefined
            ? {}
            : { blueprintRevision: parseRemoteBlueprintRevision(rawRevision, 'blueprintRevision') }),
        environmentFacts: parseRemoteEnvironmentFacts(requiredField(method, params, 'environmentFacts'), method, 'environmentFacts'),
    };
}
/** Parse `team.create` params. */
export function parseRemoteTeamCreateParams(method, params) {
    assertNoUnknownFields(method, params, REMOTE_TEAM_CREATE_FIELDS);
    const rawRevision = optionalField(method, params, 'blueprintRevision');
    const rawInitialWork = optionalField(method, params, 'initialWork');
    return {
        rootSessionId: parseRemoteRootSessionId(requiredField(method, params, 'rootSessionId'), 'rootSessionId'),
        blueprintId: parseRemoteBlueprintId(requiredField(method, params, 'blueprintId'), 'blueprintId'),
        ...(rawRevision === undefined
            ? {}
            : { blueprintRevision: parseRemoteBlueprintRevision(rawRevision, 'blueprintRevision') }),
        ...(rawInitialWork === undefined
            ? {}
            : { initialWork: parseRemoteLosslessRecord(rawInitialWork, method, 'initialWork') }),
    };
}
/** Parse `team.getProjection` params. */
export function parseRemoteTeamGetProjectionParams(method, params) {
    assertNoUnknownFields(method, params, REMOTE_TEAM_GET_PROJECTION_FIELDS);
    return {
        teamSessionId: parseRemoteTeamSessionId(requiredField(method, params, 'teamSessionId'), 'teamSessionId'),
    };
}
/** Parse `team.getLedgerPage` params (defaults: afterSequence 0, limit 50). */
export function parseRemoteTeamGetLedgerPageParams(method, params) {
    assertNoUnknownFields(method, params, REMOTE_TEAM_GET_LEDGER_PAGE_FIELDS);
    const rawAfter = optionalField(method, params, 'afterSequence');
    const rawLimit = optionalField(method, params, 'limit');
    return {
        teamSessionId: parseRemoteTeamSessionId(requiredField(method, params, 'teamSessionId'), 'teamSessionId'),
        afterSequence: rawAfter === undefined ? 0 : parseRemoteNonNegativeInt(rawAfter, method, 'afterSequence'),
        limit: rawLimit === undefined ? 50 : parseRemoteBoundedInt(rawLimit, method, 'limit', 500),
    };
}
/** Parse `member.create` params (at most one delegation field). */
export function parseRemoteMemberCreateParams(method, params) {
    assertNoUnknownFields(method, params, REMOTE_MEMBER_CREATE_FIELDS);
    const rawTemplateId = optionalField(method, params, 'delegationTemplateId');
    const rawInstanceId = optionalField(method, params, 'delegationInstanceId');
    if (rawTemplateId !== undefined && rawInstanceId !== undefined) {
        throw paramMalformed(method, 'delegationInstanceId', 'conflicting-fields', `${method}: delegationTemplateId and delegationInstanceId are mutually exclusive`);
    }
    const rawPayload = optionalField(method, params, 'payload');
    return {
        teamSessionId: parseRemoteTeamSessionId(requiredField(method, params, 'teamSessionId'), 'teamSessionId'),
        caller: parseRemoteCaller(requiredField(method, params, 'caller'), method, 'caller'),
        requestToken: parseRemoteOpaqueToken(requiredField(method, params, 'requestToken'), method, 'requestToken'),
        ...(rawTemplateId === undefined
            ? {}
            : { delegationTemplateId: parseRemoteTemplateId(rawTemplateId, 'delegationTemplateId') }),
        ...(rawInstanceId === undefined
            ? {}
            : { delegationInstanceId: parseRemoteInstanceId(rawInstanceId, 'delegationInstanceId') }),
        ...(rawPayload === undefined
            ? {}
            : { payload: parseRemoteLosslessRecord(rawPayload, method, 'payload') }),
    };
}
/** Parse `member.send` params. */
export function parseRemoteMemberSendParams(method, params) {
    assertNoUnknownFields(method, params, REMOTE_MEMBER_SEND_FIELDS);
    const rawSubject = optionalField(method, params, 'subject');
    const rawPayload = optionalField(method, params, 'payload');
    return {
        teamSessionId: parseRemoteTeamSessionId(requiredField(method, params, 'teamSessionId'), 'teamSessionId'),
        caller: parseRemoteCaller(requiredField(method, params, 'caller'), method, 'caller'),
        recipientInstanceId: parseRemoteInstanceId(requiredField(method, params, 'recipientInstanceId'), 'recipientInstanceId'),
        body: parseRemoteBody(requiredField(method, params, 'body'), method, 'body'),
        ...(rawSubject === undefined
            ? {}
            : { subject: parseRemoteOpaqueToken(rawSubject, method, 'subject') }),
        requestToken: parseRemoteOpaqueToken(requiredField(method, params, 'requestToken'), method, 'requestToken'),
        ...(rawPayload === undefined
            ? {}
            : { payload: parseRemoteLosslessRecord(rawPayload, method, 'payload') }),
    };
}
/** Parse `member.followup` params. */
export function parseRemoteMemberFollowupParams(method, params) {
    assertNoUnknownFields(method, params, REMOTE_MEMBER_FOLLOWUP_FIELDS);
    const rawPayload = optionalField(method, params, 'payload');
    return {
        teamSessionId: parseRemoteTeamSessionId(requiredField(method, params, 'teamSessionId'), 'teamSessionId'),
        caller: parseRemoteCaller(requiredField(method, params, 'caller'), method, 'caller'),
        targetInstanceId: parseRemoteInstanceId(requiredField(method, params, 'targetInstanceId'), 'targetInstanceId'),
        requestToken: parseRemoteOpaqueToken(requiredField(method, params, 'requestToken'), method, 'requestToken'),
        ...(rawPayload === undefined
            ? {}
            : { payload: parseRemoteLosslessRecord(rawPayload, method, 'payload') }),
    };
}
/** Parse `member.archive` params. */
export function parseRemoteMemberArchiveParams(method, params) {
    return parseMemberLifecycleParams(method, params);
}
/** Parse `member.restore` params. */
export function parseRemoteMemberRestoreParams(method, params) {
    return parseMemberLifecycleParams(method, params);
}
/** Parse `member.dispose` params. */
export function parseRemoteMemberDisposeParams(method, params) {
    return parseMemberLifecycleParams(method, params);
}
/** The shared member-lifecycle param schema. */
function parseMemberLifecycleParams(method, params) {
    assertNoUnknownFields(method, params, REMOTE_MEMBER_LIFECYCLE_FIELDS);
    return {
        teamSessionId: parseRemoteTeamSessionId(requiredField(method, params, 'teamSessionId'), 'teamSessionId'),
        instanceId: parseRemoteInstanceId(requiredField(method, params, 'instanceId'), 'instanceId'),
    };
}
/** Parse `override.get` params. */
export function parseRemoteOverrideGetParams(method, params) {
    assertNoUnknownFields(method, params, REMOTE_OVERRIDE_GET_FIELDS);
    const rawScope = optionalField(method, params, 'scope');
    const rawTarget = optionalField(method, params, 'targetInstanceId');
    const scope = rawScope === undefined
        ? undefined
        : parseRemoteEnum(rawScope, method, 'scope', REMOTE_MUTATION_SCOPES);
    const targetInstanceId = rawTarget === undefined
        ? undefined
        : parseRemoteInstanceId(rawTarget, 'targetInstanceId');
    assertOverrideTargetConsistency(method, scope, targetInstanceId);
    return {
        teamSessionId: parseRemoteTeamSessionId(requiredField(method, params, 'teamSessionId'), 'teamSessionId'),
        capability: parseRemoteEnum(requiredField(method, params, 'capability'), method, 'capability', REMOTE_CAPABILITY_VALUES),
        ...(scope === undefined ? {} : { scope }),
        ...(targetInstanceId === undefined ? {} : { targetInstanceId }),
    };
}
/** Parse `override.set` params. */
export function parseRemoteOverrideSetParams(method, params) {
    assertNoUnknownFields(method, params, REMOTE_OVERRIDE_SET_FIELDS);
    const rawScope = optionalField(method, params, 'scope');
    const rawTarget = optionalField(method, params, 'targetInstanceId');
    const scope = rawScope === undefined
        ? undefined
        : parseRemoteEnum(rawScope, method, 'scope', REMOTE_MUTATION_SCOPES);
    const targetInstanceId = rawTarget === undefined
        ? undefined
        : parseRemoteInstanceId(rawTarget, 'targetInstanceId');
    const actor = parseRemoteMutationActor(requiredField(method, params, 'actor'), method, 'actor');
    assertOverrideTargetConsistency(method, scope, targetInstanceId);
    assertActorScopeConsistency(method, actor, scope, targetInstanceId);
    return {
        teamSessionId: parseRemoteTeamSessionId(requiredField(method, params, 'teamSessionId'), 'teamSessionId'),
        capability: parseRemoteEnum(requiredField(method, params, 'capability'), method, 'capability', REMOTE_CAPABILITY_VALUES),
        value: parseRemotePolicyEntry(requiredField(method, params, 'value'), method, 'value'),
        actor,
        ...(scope === undefined ? {} : { scope }),
        ...(targetInstanceId === undefined ? {} : { targetInstanceId }),
    };
}
/** Parse `override.reset` params. */
export function parseRemoteOverrideResetParams(method, params) {
    assertNoUnknownFields(method, params, REMOTE_OVERRIDE_RESET_FIELDS);
    const rawScope = optionalField(method, params, 'scope');
    const rawTarget = optionalField(method, params, 'targetInstanceId');
    const scope = rawScope === undefined
        ? undefined
        : parseRemoteEnum(rawScope, method, 'scope', REMOTE_MUTATION_SCOPES);
    const targetInstanceId = rawTarget === undefined
        ? undefined
        : parseRemoteInstanceId(rawTarget, 'targetInstanceId');
    const actor = parseRemoteMutationActor(requiredField(method, params, 'actor'), method, 'actor');
    assertOverrideTargetConsistency(method, scope, targetInstanceId);
    assertActorScopeConsistency(method, actor, scope, targetInstanceId);
    return {
        teamSessionId: parseRemoteTeamSessionId(requiredField(method, params, 'teamSessionId'), 'teamSessionId'),
        capability: parseRemoteEnum(requiredField(method, params, 'capability'), method, 'capability', REMOTE_CAPABILITY_VALUES),
        actor,
        ...(scope === undefined ? {} : { scope }),
        ...(targetInstanceId === undefined ? {} : { targetInstanceId }),
    };
}
/** Parse `policyState.get` params. */
export function parseRemotePolicyStateGetParams(method, params) {
    assertNoUnknownFields(method, params, REMOTE_POLICY_STATE_GET_FIELDS);
    return {
        teamSessionId: parseRemoteTeamSessionId(requiredField(method, params, 'teamSessionId'), 'teamSessionId'),
    };
}
/** Parse `policyState.set` params. */
export function parseRemotePolicyStateSetParams(method, params) {
    assertNoUnknownFields(method, params, REMOTE_POLICY_STATE_SET_FIELDS);
    return {
        teamSessionId: parseRemoteTeamSessionId(requiredField(method, params, 'teamSessionId'), 'teamSessionId'),
        target: parseRemotePolicyStateView(requiredField(method, params, 'target'), method, 'target'),
        actor: parseRemoteMutationActor(requiredField(method, params, 'actor'), method, 'actor'),
    };
}
/** Parse `compatibility.get` params. */
export function parseRemoteCompatibilityGetParams(method, params) {
    assertNoUnknownFields(method, params, REMOTE_COMPATIBILITY_GET_FIELDS);
    return {
        teamSessionId: parseRemoteTeamSessionId(requiredField(method, params, 'teamSessionId'), 'teamSessionId'),
    };
}
/** Parse `compatibility.ack` params. */
export function parseRemoteCompatibilityAckParams(method, params) {
    assertNoUnknownFields(method, params, REMOTE_COMPATIBILITY_ACK_FIELDS);
    const rawNote = optionalField(method, params, 'note');
    return {
        teamSessionId: parseRemoteTeamSessionId(requiredField(method, params, 'teamSessionId'), 'teamSessionId'),
        requirementId: parseRemoteOpaqueToken(requiredField(method, params, 'requirementId'), method, 'requirementId'),
        acknowledgedBy: parseRemoteOpaqueToken(requiredField(method, params, 'acknowledgedBy'), method, 'acknowledgedBy'),
        ...(rawNote === undefined ? {} : { note: parseRemoteNote(rawNote, method, 'note') }),
    };
}
/** Parse `compatibility.reprobe` params. */
export function parseRemoteCompatibilityReprobeParams(method, params) {
    assertNoUnknownFields(method, params, REMOTE_COMPATIBILITY_REPROBE_FIELDS);
    return {
        teamSessionId: parseRemoteTeamSessionId(requiredField(method, params, 'teamSessionId'), 'teamSessionId'),
        trigger: parseRemoteEnum(requiredField(method, params, 'trigger'), method, 'trigger', REMOTE_PROBE_TRIGGER_VALUES),
    };
}
/** Parse `handoff.prepare` params. */
export function parseRemoteHandoffPrepareParams(method, params) {
    assertNoUnknownFields(method, params, REMOTE_HANDOFF_PREPARE_FIELDS);
    return {
        sourceSessionId: parseRemoteSessionId(requiredField(method, params, 'sourceSessionId'), 'sourceSessionId'),
    };
}
/** Parse `handoff.create` params. */
export function parseRemoteHandoffCreateParams(method, params) {
    assertNoUnknownFields(method, params, REMOTE_HANDOFF_CREATE_FIELDS);
    const rawStaged = optionalField(method, params, 'staged');
    return {
        sourceSessionId: parseRemoteSessionId(requiredField(method, params, 'sourceSessionId'), 'sourceSessionId'),
        requestToken: parseRemoteOpaqueToken(requiredField(method, params, 'requestToken'), method, 'requestToken'),
        ...(rawStaged === undefined
            ? {}
            : { staged: parseRemoteLosslessRecord(rawStaged, method, 'staged') }),
    };
}
/** Parse `legacy.inspect` params. */
export function parseRemoteLegacyInspectParams(method, params) {
    assertNoUnknownFields(method, params, REMOTE_LEGACY_INSPECT_FIELDS);
    const rawWorkspaceCwd = optionalField(method, params, 'workspaceCwd');
    const rawProjectDir = optionalField(method, params, 'projectDir');
    return {
        dshHome: parseRemotePath(requiredField(method, params, 'dshHome'), method, 'dshHome'),
        ...(rawWorkspaceCwd === undefined
            ? {}
            : { workspaceCwd: parseRemotePath(rawWorkspaceCwd, method, 'workspaceCwd') }),
        ...(rawProjectDir === undefined
            ? {}
            : { projectDir: parseRemotePath(rawProjectDir, method, 'projectDir') }),
    };
}
// ---------------------------------------------------------------------------
// Generic entry point (used by the dispatcher)
// ---------------------------------------------------------------------------
/**
 * Parse `params` for the given catalog method.
 * @param method - a catalog method name (dotted `<category>.<action>`).
 * @param params - the request envelope's `params` object.
 * @returns the typed param object plus the request token echo.
 * @throws {RemoteContractError} `unknown-method` (defensive — the dispatcher
 *   checks membership first), `malformed-params`, or the mirrored frozen P3
 *   ID codes on structural ID violations.
 */
export function parseRemoteMethodParams(method, params) {
    switch (method) {
        case 'catalog.list':
            return wrapParsed(method, parseRemoteCatalogListParams(method, params));
        case 'catalog.get':
            return wrapParsed(method, parseRemoteCatalogGetParams(method, params));
        case 'intent.probe':
            return wrapParsed(method, parseRemoteIntentProbeParams(method, params));
        case 'team.create':
            return wrapParsed(method, parseRemoteTeamCreateParams(method, params));
        case 'team.getProjection':
            return wrapParsed(method, parseRemoteTeamGetProjectionParams(method, params));
        case 'team.getLedgerPage':
            return wrapParsed(method, parseRemoteTeamGetLedgerPageParams(method, params));
        case 'member.create':
            return wrapParsed(method, parseRemoteMemberCreateParams(method, params));
        case 'member.send':
            return wrapParsed(method, parseRemoteMemberSendParams(method, params));
        case 'member.followup':
            return wrapParsed(method, parseRemoteMemberFollowupParams(method, params));
        case 'member.archive':
            return wrapParsed(method, parseRemoteMemberArchiveParams(method, params));
        case 'member.restore':
            return wrapParsed(method, parseRemoteMemberRestoreParams(method, params));
        case 'member.dispose':
            return wrapParsed(method, parseRemoteMemberDisposeParams(method, params));
        case 'override.get':
            return wrapParsed(method, parseRemoteOverrideGetParams(method, params));
        case 'override.set':
            return wrapParsed(method, parseRemoteOverrideSetParams(method, params));
        case 'override.reset':
            return wrapParsed(method, parseRemoteOverrideResetParams(method, params));
        case 'policyState.get':
            return wrapParsed(method, parseRemotePolicyStateGetParams(method, params));
        case 'policyState.set':
            return wrapParsed(method, parseRemotePolicyStateSetParams(method, params));
        case 'compatibility.get':
            return wrapParsed(method, parseRemoteCompatibilityGetParams(method, params));
        case 'compatibility.ack':
            return wrapParsed(method, parseRemoteCompatibilityAckParams(method, params));
        case 'compatibility.reprobe':
            return wrapParsed(method, parseRemoteCompatibilityReprobeParams(method, params));
        case 'handoff.prepare':
            return wrapParsed(method, parseRemoteHandoffPrepareParams(method, params));
        case 'handoff.create':
            return wrapParsed(method, parseRemoteHandoffCreateParams(method, params));
        case 'legacy.inspect':
            return wrapParsed(method, parseRemoteLegacyInspectParams(method, params));
        default:
            throw remoteContractError('unknown-method', `method '${String(method)}' is not part of the closed Remote contract v1 catalog`, { field: 'method' });
    }
}
/** Attach the method + request-token echo to a parsed param object. */
function wrapParsed(method, params) {
    const token = params.requestToken;
    return {
        method,
        params,
        requestToken: typeof token === 'string' ? token : null,
    };
}
//# sourceMappingURL=params.js.map