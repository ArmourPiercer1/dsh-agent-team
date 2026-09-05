/**
 * P8-S4B — governance override admission: the backend authority that
 * WRITES the durable governance overrides the frozen policy layer re-reads
 * at every future Agent request boundary.
 *
 * Plan §18.1/§18.2 (mutation -> actual Agent closure): a Team durable
 * mutation is not projection state — the next real request must observe
 * it. This module is the sole Runtime/Team authority for creating
 * `GovernanceOverride` records (plan §20.3/§20.4: "Remote handlers must
 * call Runtime/Team service authority"; "Remote direct repository
 * mutation" is forbidden). It validates the acting authority, re-issues
 * the full slot value set (the frozen v1 one-record-per-slot ruling),
 * and persists through an injected store port; the storage layer remains
 * the final SHAPE arbiter (closed record, cross-field rules).
 *
 * Authority -> record mapping (§20.3/§20.4, Architecture §19.4/§19.5):
 *
 * - `leader`  -> `autonomy-overlay` with `origin: 'leader'`, team or
 *   instance scope;
 * - `member`  -> `autonomy-overlay` with `origin: 'member'`, INSTANCE
 *   scope targeting the member's OWN instance only (v1);
 * - `operator`-> `human-override` (never `origin`; the authenticated /
 *   host-known client principal channel), team or instance scope.
 *
 * Slot ruling (frozen `selectPolicyOverrides`, P8-S3): exactly ONE record
 * wins per policy slot — team-scope `autonomy-overlay` (templateOverlay),
 * instance-scope `autonomy-overlay` (instanceOverlay), `human-override`
 * (instance beats team at read time) — winner = highest `generation`,
 * ties -> lexicographically smallest `recordId`; multi-overlay composition
 * is owned by later governance work. Consequence: a cumulative mutation
 * must RE-ISSUE the full slot value set. Admission merges the current
 * slot winner's `values` with the requested cell changes and persists a
 * NEW record (new `recordId`, `generation = winner + 1`). The store key
 * carries no generation, so the same `recordId` can never be re-put:
 * every mutation needs a fresh identity.
 *
 * Cell semantics are NOT decided here: `values` are lossless JSON per
 * the storage contract; the frozen resolver fails closed on any value it
 * cannot interpret (P8-S3 stage-2 semantics). Admission validates only
 * the closed capability vocabulary and the `PolicyEntry` value shape.
 *
 * @module @dsh-agent-team/runtime/mutation/override-admission
 */
import { CAPABILITY_NAME_VALUES, } from '../../domain/policy/src/index.js';
import { TEAM_DOMAIN_SCHEMA_VERSION } from '../../storage/schema/index.js';
import { MUTATION_ERROR_CODES, MutationError } from './errors.js';
/** The storage duplicate code string (mirrors TEAM_DOMAIN_ERROR_CODES). */
const STORAGE_RECORD_DUPLICATE = 'RECORD_DUPLICATE';
/** The storage id length cap (mirrors FIELD_ID_MAX_LENGTH). */
const ID_MAX_LENGTH = 128;
function isPlainRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function malformed(field, problem, extra) {
    return new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, `Malformed governance override mutation: ${problem}`, { field, problem, ...extra });
}
/** Assert a clean id: non-empty, <= 128 chars, no whitespace. */
function assertCleanId(value, field) {
    if (typeof value !== 'string' || value.length === 0 || value.length > ID_MAX_LENGTH || /\s/.test(value)) {
        throw malformed(field, `must be a non-empty whitespace-free string of at most ${ID_MAX_LENGTH} characters`);
    }
    return value;
}
/** Validate one PolicyEntry (closed shape; deny carries nothing else). */
function assertPolicyEntry(capability, value) {
    if (!isPlainRecord(value)) {
        throw malformed(capability, 'value must be a plain record', { capability });
    }
    if (value['kind'] === 'deny') {
        if (Object.keys(value).length !== 1) {
            throw malformed(capability, "a 'deny' entry carries no other fields", { capability });
        }
        return { kind: 'deny' };
    }
    if (value['kind'] === 'allow') {
        const items = value['items'];
        if (!Array.isArray(items) || items.length === 0) {
            throw malformed(capability, "an 'allow' entry requires a non-empty items array", { capability });
        }
        for (const item of items) {
            if (typeof item !== 'string' || item.length === 0) {
                throw malformed(capability, 'every allow item must be a non-empty string', { capability });
            }
        }
        return { kind: 'allow', items: [...items] };
    }
    throw malformed(capability, "kind must be 'allow' or 'deny'", { capability, kind: value['kind'] });
}
function inSlot(record, slot) {
    if (record.kind !== slot.kind || record.scope !== slot.scope || record.rootSessionId !== slot.rootSessionId) {
        return false;
    }
    if (slot.scope === 'instance')
        return record.instanceId === slot.instanceId;
    return record.instanceId === undefined;
}
/**
 * Select the frozen slot winner: the record of the slot with the
 * HIGHEST generation; ties -> lexicographically smallest recordId.
 * Mirrors the frozen `selectPolicyOverrides` slot rule exactly.
 * @param overrides - every durable override of the TeamSession.
 * @param slot - the slot identity.
 * @returns the winning record, or null when the slot is empty.
 */
export function selectSlotWinner(overrides, slot) {
    let winner = null;
    for (const record of overrides) {
        if (!inSlot(record, slot))
            continue;
        if (winner === null ||
            record.generation > winner.generation ||
            (record.generation === winner.generation && record.recordId < winner.recordId)) {
            winner = record;
        }
    }
    return winner;
}
function storageErrorCode(error) {
    if (error instanceof Error) {
        const code = error.code;
        if (typeof code === 'string')
            return code;
    }
    return undefined;
}
/**
 * Admit one durable governance override mutation.
 *
 * Order: authority -> scope/identity shape -> closed cell vocabulary +
 * PolicyEntry shapes -> load durable state -> identity conflict ->
 * optimistic generation -> full slot re-issue (merge winner + cells) ->
 * persist through the store port.
 *
 * @param args - the mutation request (see {@link AdmitGovernanceOverrideArgs}).
 * @param store - the persistence port (team_domain overrides store).
 * @returns the admitted record view (full slot values, new generation).
 * @throws {@link MutationError} `UNAUTHORIZED_MUTATION` (authority/scope
 *   mismatch), `MALFORMED_MUTATION_INPUT` (bad id/scope/cell shapes),
 *   `OVERRIDE_IDENTITY_CONFLICT` (identity already occupied, including
 *   the storage `RECORD_DUPLICATE` race), `OVERRIDE_GENERATION_CONFLICT`
 *   (stale expectedGeneration).
 */
export async function admitGovernanceOverride(args, store) {
    // 1. Authority -> record kind + traceability origin (§20.3/§20.4).
    let kind;
    let origin;
    if (args.authority.kind === 'operator') {
        kind = 'human-override';
        origin = undefined;
    }
    else {
        kind = 'autonomy-overlay';
        origin = args.authority.kind;
    }
    // 2. Identity + scope shape.
    const rootSessionId = assertCleanId(args.rootSessionId, 'rootSessionId');
    const recordId = assertCleanId(args.recordId, 'recordId');
    const scope = args.scope;
    if (scope !== 'team' && scope !== 'instance') {
        throw malformed('scope', `must be 'team' or 'instance'`, { scope: args.scope });
    }
    let instanceId;
    if (scope === 'instance') {
        instanceId = assertCleanId(args.instanceId, 'instanceId');
    }
    else if (args.instanceId !== undefined) {
        throw malformed('instanceId', "team scope must not carry instanceId");
    }
    // 3. Authority scope rules (member: own instance only; no team scope).
    if (args.authority.kind === 'member') {
        if (scope === 'team') {
            throw new MutationError(MUTATION_ERROR_CODES.UNAUTHORIZED_MUTATION, 'member authority may only issue instance-scoped autonomy overlays', { actor: 'member', scope });
        }
        if (instanceId !== args.authority.instanceId) {
            throw new MutationError(MUTATION_ERROR_CODES.UNAUTHORIZED_MUTATION, 'member authority may only target its own instance', { actor: 'member', instanceId, requestedInstance: instanceId });
        }
    }
    // 4. Closed capability vocabulary + PolicyEntry shapes.
    if (!isPlainRecord(args.cells) || Object.keys(args.cells).length === 0) {
        throw malformed('cells', 'cells must be a non-empty record of capability entries');
    }
    const cells = {};
    for (const [capability, entry] of Object.entries(args.cells)) {
        if (!CAPABILITY_NAME_VALUES.includes(capability)) {
            throw malformed('cells', `unknown capability (closed vocabulary: ${CAPABILITY_NAME_VALUES.join(', ')})`, {
                capability,
            });
        }
        cells[capability] = assertPolicyEntry(capability, entry);
    }
    // 5. Load the durable truth, check identity conflict, find the slot winner.
    const existing = await store.list(rootSessionId);
    const slot = { kind, scope, rootSessionId, ...(instanceId !== undefined ? { instanceId } : {}) };
    const conflict = existing.find((record) => inSlot(record, slot) && record.recordId === recordId);
    if (conflict !== undefined) {
        throw new MutationError(MUTATION_ERROR_CODES.OVERRIDE_IDENTITY_CONFLICT, `a governance override already exists at recordId ${recordId} (generation ${conflict.generation})`, { recordId, existingGeneration: conflict.generation });
    }
    const winner = selectSlotWinner(existing, slot);
    // 6. Optimistic generation guard (stale readers must not clobber).
    const actualGeneration = winner === null ? 0 : winner.generation;
    if (args.expectedGeneration !== undefined && args.expectedGeneration !== actualGeneration) {
        throw new MutationError(MUTATION_ERROR_CODES.OVERRIDE_GENERATION_CONFLICT, 'the slot winner moved since the caller read it', { expectedGeneration: args.expectedGeneration, actualGeneration });
    }
    // 7. Re-issue the FULL slot value set (v1 one-record-per-slot ruling).
    const winnerValues = winner === null ? {} : winner.values;
    const values = { ...winnerValues, ...cells };
    // 8. Build the storage record (the storage layer re-validates the shape).
    const updatedAt = args.now();
    const record = {
        schemaVersion: TEAM_DOMAIN_SCHEMA_VERSION,
        kind,
        recordId,
        scope,
        rootSessionId,
        values,
        generation: actualGeneration + 1,
        updatedAt,
    };
    if (instanceId !== undefined)
        record['instanceId'] = instanceId;
    if (origin !== undefined)
        record['origin'] = origin;
    // 9. Persist (storage is the final shape arbiter + idempotency gate).
    try {
        await store.put(record);
    }
    catch (error) {
        if (storageErrorCode(error) === STORAGE_RECORD_DUPLICATE) {
            throw new MutationError(MUTATION_ERROR_CODES.OVERRIDE_IDENTITY_CONFLICT, `the governance override identity ${recordId} is already occupied`, { recordId, problem: 'duplicate-override' });
        }
        throw error;
    }
    return {
        recordId,
        kind,
        scope,
        rootSessionId,
        ...(instanceId !== undefined ? { instanceId } : {}),
        ...(origin !== undefined ? { origin } : {}),
        values,
        generation: actualGeneration + 1,
        updatedAt,
        supersededRecordId: winner === null ? null : winner.recordId,
    };
}
//# sourceMappingURL=override-admission.js.map