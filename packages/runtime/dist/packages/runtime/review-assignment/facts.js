/**
 * Alpha.6 PR2′ (Lane 2) — the durable shape of the assignment family: encode, decode, fold.
 *
 * This module is the only place in the lane that knows what an assignment ROW looks like on the ledger,
 * and it is written to be the narrowest possible gate for three reasons that are all histories in this
 * repository:
 *
 *  1. The ledger is append-only and the projection fold THROWS on any `factType` it cannot map, so the
 *     three names below must be booked in `FACT_TYPE_CATEGORY` in the same PR that introduces them —
 *     that is what `a6-pr2-assignment-kernel.test.ts`'s mirror leg enforces, in the same way
 *     `a4pr0a-fact-type-closed-set.test.ts` polices every other writer (the `control-request-abandoned`
 *     bug made `team.getProjection` fail permanently for a Team; `artifact-read-granted` did it first).
 *  2. A payload with a stray field is the shape a later "just add a hint" change takes. The field set
 *     here is CLOSED, and an unknown key is a refusal rather than something to ignore.
 *  3. The law "an assignment never grants authority" (A-1) is worth nothing if it only lives in a
 *     comment, so it is a machine check: a key whose name claims authority, a rung, a permission, a
 *     grant, a decision or a mandate is refused LOUDLY with
 *     `REVIEW_ASSIGNMENT_AUTHORITY_FIELD_PRESENT`. A writer that tries to smuggle authority into an
 *     assignment fact gets a red test, not a row that looks fine on a dashboard.
 *
 * No I/O, no host, no clock: `recordedAt` is deliberately absent from the payload because the ledger
 * entry already owns `createdAt`, and a fact that carries its own timestamp is two facts.
 */
import { LEADER_INSTANCE_ID } from '../../contracts/src/index.js';
import { REVIEW_ASSIGNMENT_FACT_TYPES, REVIEW_ASSIGNMENT_FACT_TYPE_VALUES, } from './types.js';
// --- hygiene ----------------------------------------------------------------------------------------
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/;
const REASON_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;
const FACT_TYPE_PATTERN = /^[a-z0-9][a-z0-9-]{0,127}$/;
/** The payload's closed field set. Anything outside it is a refusal (see the module doc, reason 2). */
export const REVIEW_ASSIGNMENT_PAYLOAD_FIELDS = [
    'rootSessionId',
    'approvalCaseId',
    'currentLegRequestId',
    'targetKind',
    'targetInstanceId',
    'assignmentEpoch',
    'previousEpoch',
    'reasonCode',
    'basedOnCaseVersion',
    'actorCallerRef',
];
/**
 * Substrings that may never appear in a payload key. Deliberately wider than the field set: the point
 * is not to re-validate the closed set twice, it is to make the *attempt* visible. `mandate` is in here
 * even though a ReviewMandate is real and lives in PR0, because a MANDATE is checked at the write path
 * and an ASSIGNMENT that mentions one is a row claiming a reason it was not allowed to carry.
 */
const AUTHORITY_BEARING_KEY_MARKERS = [
    'authority',
    'rung',
    'permission',
    'grant',
    'allow',
    'deny',
    'decision',
    'mandate',
    'effect',
    // Added on review (F-11). The nine above were the words the lane's author thought of first; the
    // reviewer pointed out that the lane promises authority attempts are named AS SUCH, and `approvedBy`,
    // `escalatedTo`, `canPermit`, `signoffInstance`, `scope` or `role` were being refused with the generic
    // `FIELD_UNKNOWN` instead. Nothing was smuggled either way — the closed field set refuses every
    // undeclared key — so this widens a NAME, not a permission.
    'approv',
    'escalat',
    'authoriz',
    'permit',
    'veto',
    'signoff',
    'scope',
    'role',
];
function isId(value) {
    return typeof value === 'string' && ID_PATTERN.test(value);
}
function isEpoch(value) {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
function accept(value) {
    return { ok: true, value };
}
function refuse(refusal, detail) {
    return { ok: false, refusal, detail };
}
/**
 * Encode one fact. `expectedPreviousEpoch` is the CAS token of A-2: the writer passes the epoch it
 * read, the fold accepts the row only if that is still the epoch it stands at.
 */
export function encodeAssignmentFact(kind, assignment, expectedPreviousEpoch) {
    if (typeof assignment !== 'object' || assignment === null) {
        return refuse('REVIEW_ASSIGNMENT_INPUT_MALFORMED', 'assignment must be a record');
    }
    if (!isId(assignment.rootSessionId) || !isId(assignment.approvalCaseId)) {
        return refuse('REVIEW_ASSIGNMENT_INPUT_MALFORMED', 'rootSessionId/approvalCaseId must be hygienic ids');
    }
    if (!isId(assignment.currentLegRequestId) || !isId(assignment.basedOnCaseVersion)) {
        return refuse('REVIEW_ASSIGNMENT_INPUT_MALFORMED', 'leg request id and case version must be hygienic ids');
    }
    if (!REF_PATTERN.test(assignment.actorCallerRef)) {
        return refuse('REVIEW_ASSIGNMENT_INPUT_MALFORMED', 'actorCallerRef must be a hygienic ref');
    }
    if (typeof assignment.reasonCode !== 'string' || !REASON_PATTERN.test(assignment.reasonCode)) {
        return refuse('REVIEW_ASSIGNMENT_REASON_CODE_INVALID', `reasonCode ${JSON.stringify(assignment.reasonCode)}`);
    }
    if (!isEpoch(expectedPreviousEpoch) || !isEpoch(assignment.assignmentEpoch)) {
        return refuse('REVIEW_ASSIGNMENT_SEQUENCE_INVALID', 'epochs must be safe non-negative integers');
    }
    if (assignment.assignmentEpoch !== expectedPreviousEpoch + 1) {
        return refuse('REVIEW_ASSIGNMENT_SEQUENCE_INVALID', `assignmentEpoch ${assignment.assignmentEpoch} must be previousEpoch ${expectedPreviousEpoch} + 1`);
    }
    if (kind === 'created' && expectedPreviousEpoch !== 0) {
        return refuse('REVIEW_ASSIGNMENT_SEQUENCE_INVALID', `a created fact must replace epoch 0, got ${expectedPreviousEpoch}`);
    }
    if (kind !== 'created' && expectedPreviousEpoch < 1) {
        return refuse('REVIEW_ASSIGNMENT_SEQUENCE_INVALID', `a ${kind} fact must replace a live epoch, got ${expectedPreviousEpoch}`);
    }
    const targetKind = assignment.target.kind;
    if (targetKind !== 'instance' && targetKind !== 'leader') {
        return refuse('REVIEW_ASSIGNMENT_INPUT_MALFORMED', `unknown target kind ${JSON.stringify(targetKind)}`);
    }
    if (targetKind === 'instance' && !isId(assignment.target.instanceId)) {
        return refuse('REVIEW_ASSIGNMENT_INPUT_MALFORMED', 'an instance target needs a hygienic instanceId');
    }
    return accept({
        rootSessionId: assignment.rootSessionId,
        approvalCaseId: assignment.approvalCaseId,
        currentLegRequestId: assignment.currentLegRequestId,
        targetKind,
        targetInstanceId: targetKind === 'instance' ? assignment.target.instanceId : null,
        assignmentEpoch: assignment.assignmentEpoch,
        previousEpoch: expectedPreviousEpoch,
        reasonCode: assignment.reasonCode,
        basedOnCaseVersion: assignment.basedOnCaseVersion,
        actorCallerRef: assignment.actorCallerRef,
    });
}
// --- decode ------------------------------------------------------------------------------------------
/**
 * Decode one row's payload. Every failure is typed and every failure is a DIAGNOSTIC in the fold, never
 * a silent skip: the ledger cannot be repaired, so the only honest response to an unreadable row is to
 * say so on every read afterwards (A-7).
 */
export function decodeAssignmentPayload(factType, payload) {
    if (typeof factType !== 'string' || !FACT_TYPE_PATTERN.test(factType)) {
        return refuse('REVIEW_ASSIGNMENT_ROW_UNPARSEABLE', `factType ${JSON.stringify(factType)}`);
    }
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
        return refuse('REVIEW_ASSIGNMENT_ROW_UNPARSEABLE', 'payload must be a plain record');
    }
    const record = payload;
    const keys = Object.keys(record);
    // A-1 as a machine check. Runs BEFORE the closed-set check so an authority-bearing key is reported
    // as what it is — someone trying to make an assignment grant something — instead of the generic
    // "unknown field" the writer would otherwise get.
    //
    // The declared fields are exempt, and one of them is why the exemption is not a hole:
    // `approvalCaseId` contains the marker `approv`. It is a declared, closed, typed field naming the case
    // the assignment is ABOUT — an identifier, not a capability — and the marker pass exists to catch
    // UNDECLARED keys. Widening the exemption is impossible: `keys` outside
    // `REVIEW_ASSIGNMENT_PAYLOAD_FIELDS` are refused below whatever they are called, so the marker pass can
    // only ever change WHICH refusal an undeclared key gets, never whether one is refused at all.
    for (const key of keys) {
        if (REVIEW_ASSIGNMENT_PAYLOAD_FIELDS.includes(key))
            continue;
        const lowered = key.toLowerCase();
        if (AUTHORITY_BEARING_KEY_MARKERS.some((marker) => lowered.includes(marker))) {
            return refuse('REVIEW_ASSIGNMENT_AUTHORITY_FIELD_PRESENT', `key ${JSON.stringify(key)} claims authority an assignment may never carry`);
        }
    }
    for (const key of keys) {
        if (!REVIEW_ASSIGNMENT_PAYLOAD_FIELDS.includes(key)) {
            return refuse('REVIEW_ASSIGNMENT_FIELD_UNKNOWN', `key ${JSON.stringify(key)}`);
        }
    }
    for (const key of REVIEW_ASSIGNMENT_PAYLOAD_FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(record, key)) {
            return refuse('REVIEW_ASSIGNMENT_INPUT_MALFORMED', `missing field ${key}`);
        }
    }
    const targetKind = record['targetKind'];
    if (targetKind !== 'instance' && targetKind !== 'leader') {
        return refuse('REVIEW_ASSIGNMENT_ROW_UNPARSEABLE', `targetKind ${JSON.stringify(targetKind)}`);
    }
    const targetInstanceId = record['targetInstanceId'];
    if (targetKind === 'instance' && !isId(targetInstanceId)) {
        return refuse('REVIEW_ASSIGNMENT_ROW_UNPARSEABLE', 'an instance target needs a hygienic instanceId');
    }
    if (targetKind === 'leader' && targetInstanceId !== null) {
        return refuse('REVIEW_ASSIGNMENT_ROW_UNPARSEABLE', 'a leader target must carry a null instanceId');
    }
    // Narrowed into locals on purpose: `record['x']` is `unknown` every time it is read, so validating
    // the indexed read and then returning the indexed read again would hand the caller an `unknown` that
    // the compiler cannot see has been proved a string.
    const rootSessionId = record['rootSessionId'];
    const approvalCaseId = record['approvalCaseId'];
    const currentLegRequestId = record['currentLegRequestId'];
    const basedOnCaseVersion = record['basedOnCaseVersion'];
    const actorCallerRef = record['actorCallerRef'];
    const reasonCode = record['reasonCode'];
    if (!isId(rootSessionId) || !isId(approvalCaseId)) {
        return refuse('REVIEW_ASSIGNMENT_ROW_UNPARSEABLE', 'root/case ids failed hygiene');
    }
    if (!isId(currentLegRequestId) || !isId(basedOnCaseVersion)) {
        return refuse('REVIEW_ASSIGNMENT_ROW_UNPARSEABLE', 'leg request id / case version failed hygiene');
    }
    if (typeof actorCallerRef !== 'string' || !REF_PATTERN.test(actorCallerRef)) {
        return refuse('REVIEW_ASSIGNMENT_ROW_UNPARSEABLE', 'actorCallerRef failed hygiene');
    }
    if (typeof reasonCode !== 'string' || !REASON_PATTERN.test(reasonCode)) {
        return refuse('REVIEW_ASSIGNMENT_ROW_UNPARSEABLE', 'reasonCode failed hygiene');
    }
    const assignmentEpoch = record['assignmentEpoch'];
    const previousEpoch = record['previousEpoch'];
    if (!isEpoch(assignmentEpoch) || !isEpoch(previousEpoch)) {
        return refuse('REVIEW_ASSIGNMENT_SEQUENCE_INVALID', 'epochs failed validation');
    }
    if (assignmentEpoch !== previousEpoch + 1) {
        return refuse('REVIEW_ASSIGNMENT_SEQUENCE_INVALID', `assignmentEpoch ${String(assignmentEpoch)} is not previousEpoch ${String(previousEpoch)} + 1`);
    }
    const expectedForKind = factType === REVIEW_ASSIGNMENT_FACT_TYPES.created ? 0 : previousEpoch;
    if (factType === REVIEW_ASSIGNMENT_FACT_TYPES.created && previousEpoch !== expectedForKind) {
        return refuse('REVIEW_ASSIGNMENT_SEQUENCE_INVALID', 'a created row must replace epoch 0');
    }
    if (factType !== REVIEW_ASSIGNMENT_FACT_TYPES.created && previousEpoch < 1) {
        return refuse('REVIEW_ASSIGNMENT_SEQUENCE_INVALID', `a ${factType} row must replace a live epoch`);
    }
    return accept({
        rootSessionId,
        approvalCaseId,
        currentLegRequestId,
        targetKind,
        targetInstanceId: targetKind === 'instance' ? targetInstanceId : null,
        assignmentEpoch,
        previousEpoch,
        reasonCode,
        basedOnCaseVersion,
        actorCallerRef,
    });
}
function targetOf(payload) {
    return payload.targetKind === 'leader'
        ? { kind: 'leader' }
        : { kind: 'instance', instanceId: payload.targetInstanceId };
}
function assignmentOf(payload) {
    return {
        rootSessionId: payload.rootSessionId,
        approvalCaseId: payload.approvalCaseId,
        currentLegRequestId: payload.currentLegRequestId,
        target: targetOf(payload),
        assignmentEpoch: payload.assignmentEpoch,
        reasonCode: payload.reasonCode,
        basedOnCaseVersion: payload.basedOnCaseVersion,
        actorCallerRef: payload.actorCallerRef,
    };
}
// --- fold ---------------------------------------------------------------------------------------------
/** Is `factType` one of this family's three? */
export function isReviewAssignmentFactType(factType) {
    return REVIEW_ASSIGNMENT_FACT_TYPE_VALUES.includes(factType);
}
/**
 * Fold one case's assignment rows into a state view.
 *
 * INPUT CONTRACT, rewritten after review (F-3) because the previous wording was false in both of its
 * halves and the false half was the dangerous one. The fold is scoped by `(rootSessionId, approvalCaseId)`
 * and it owns ONE fact family, so:
 *
 *  - Rows of OTHER FAMILIES are ignored without a diagnostic and do not participate in sequence ordering.
 *    The ledger interleaves every family; a fold that reported the shape of the ledger it was handed
 *    would report noise instead of its own state.
 *  - Rows of THIS family belonging to ANOTHER CASE are also ignored without a diagnostic, and they do not
 *    advance the sequence watermark either — order is a property of the rows a view is made of. Their epoch
 *    chain is a different chain — `assignmentEpoch`/`previousEpoch` are per case — so they cannot corrupt
 *    this view, and refusing them made the obvious reader fail closed: the natural durable reader is
 *    "read `repositories.ledger.list()` for this opened team once, then fold per case", and the old
 *    behaviour diagnosed a mismatch on every one of those rows, marking EVERY case's view
 *    `unreconciled` and therefore refusing every wake and every submit, everywhere, forever. A contract
 *    that punishes the correct caller is not a safety property.
 *  - Rows of THIS family belonging to ANOTHER TEAM are a diagnostic (`CROSS_TEAM_ROW`). This one cannot
 *    happen by writing the reader correctly: `repositories.ledger` is the opened team's own ledger, so a
 *    foreign root inside it means the caller folded a team's rows under another team's id — a scoping bug
 *    that is worth a loud noise, not silence.
 *  - Any row of THIS family for THIS case that cannot be applied is a diagnostic, and any diagnostic
 *    marks the view `unreconciled`, which every consumer refuses (A-7). A malformed `ledgerSequence` on a
 *    row of this family counts: it is diagnosed, not dropped (F-2 — the previous code `continue`d on a
 *    broken sequence BEFORE the family check, so exactly the rows A-7 exists to protect were the ones that
 *    vanished quietly).
 */
export function foldReviewAssignmentRows(rows, rootSessionId, approvalCaseId) {
    const diagnostics = [];
    let assignment = null;
    let live = false;
    let epochApplied = 0;
    let lastSequence = -1;
    const note = (row, refusal, detail) => {
        diagnostics.push({ ledgerSequence: row.ledgerSequence, factType: row.factType, refusal, detail });
    };
    for (const row of rows) {
        // Family first, ALWAYS (review F-2). The two checks below used to run before this one, which meant a
        // row of this family carrying a broken `ledgerSequence` disappeared with `diagnostics = []` and
        // `unreconciled = false` — a silent loss of exactly the rows whose loss A-7 forbids, while foreign
        // rows that are none of this fold's business were diagnosed instead. Ownership decides who gets a
        // noise: this fold answers for its own family and stays quiet about everybody else's.
        if (!isReviewAssignmentFactType(row.factType))
            continue;
        if (typeof row.ledgerSequence !== 'number' || !Number.isSafeInteger(row.ledgerSequence)) {
            note(row, 'REVIEW_ASSIGNMENT_SEQUENCE_MALFORMED', `a ${row.factType} row names sequence ${String(row.ledgerSequence)}, which is not a safe integer`);
            continue;
        }
        // NOT yet the sequence watermark: it advances only on rows this fold actually considers, i.e. rows of
        // this family AND this case. Advancing it on another case's row was the first draft's shape, and it is
        // the same F-3 mistake one level down — one out-of-order row of an unrelated case would then diagnose
        // every row of the case being folded. Order is a property of the rows a view is made of.
        const decoded = decodeAssignmentPayload(row.factType, row.payload);
        if (!decoded.ok) {
            note(row, decoded.refusal, decoded.detail);
            continue;
        }
        const payload = decoded.value;
        if (payload.rootSessionId !== rootSessionId) {
            note(row, 'REVIEW_ASSIGNMENT_CROSS_TEAM_ROW', `row belongs to ${payload.rootSessionId}`);
            continue;
        }
        if (payload.approvalCaseId !== approvalCaseId) {
            // Another case's row: skip in silence, by the input contract above. Nothing can leak across — the
            // epoch chain, the target and the leg all come from rows of THIS case — and the caller has no
            // cheaper way to read the ledger than one pass per team.
            continue;
        }
        if (row.ledgerSequence < lastSequence) {
            // Out-of-order input is a broken caller, not a broken ledger. Say so once per row rather than
            // folding a family in the wrong order and calling the result a state.
            note(row, 'REVIEW_ASSIGNMENT_SEQUENCE_INVALID', `sequence ${String(row.ledgerSequence)} follows ${String(lastSequence)}`);
            continue;
        }
        lastSequence = row.ledgerSequence;
        // Check ordering, stated because the order of refusal checks IS part of the law: a `created` row that
        // arrives while a handler is live is reported as `ALREADY_ACTIVE` even when its epoch is also wrong.
        // "there is already a current handler" is the fact the operator needs, it is what makes the row
        // illegal at all, and it is the order the writer's pre-flight uses — if the fold answered
        // `EPOCH_CONFLICT` here, the same row would get two different codes depending on which door you came
        // in through, and A-2's agreement leg exists to catch exactly that. The epoch check below still
        // guards APPLICATION, so a corrupt created row naming a predecessor it could never have had cannot
        // install an assignment either way.
        if (row.factType === REVIEW_ASSIGNMENT_FACT_TYPES.created && assignment !== null) {
            note(row, 'REVIEW_ASSIGNMENT_ALREADY_ACTIVE', `epoch ${String(epochApplied)} is already live`);
            continue;
        }
        if (payload.previousEpoch !== epochApplied) {
            note(row, 'REVIEW_ASSIGNMENT_EPOCH_CONFLICT', `row replaces ${String(payload.previousEpoch)}, state stands at ${String(epochApplied)}`);
            continue;
        }
        if (row.factType === REVIEW_ASSIGNMENT_FACT_TYPES.created) {
            // `assignment` is null here: the guard above refused every created row that found one.
            assignment = assignmentOf(payload);
            live = true;
            epochApplied = payload.assignmentEpoch;
            continue;
        }
        if (assignment === null || !live) {
            note(row, 'REVIEW_ASSIGNMENT_NO_ACTIVE_ASSIGNMENT', `a ${row.factType} row has nothing to replace`);
            continue;
        }
        if (payload.currentLegRequestId !== assignment.currentLegRequestId) {
            note(row, 'REVIEW_ASSIGNMENT_LEG_MISMATCH', `row is under leg ${payload.currentLegRequestId}, family stands at ${assignment.currentLegRequestId}`);
            continue;
        }
        if (row.factType === REVIEW_ASSIGNMENT_FACT_TYPES.transferred) {
            if (sameTarget(assignment.target, targetOf(payload))) {
                note(row, 'REVIEW_ASSIGNMENT_TARGET_UNCHANGED', 'a transfer to the same target changes nothing');
                continue;
            }
            assignment = assignmentOf(payload);
            live = true;
            epochApplied = payload.assignmentEpoch;
            continue;
        }
        // retired: the record stays visible with live=false, because A-3 needs the superseded target to be
        // nameable after the fact — "who may no longer submit" is exactly what a reviewer asks.
        assignment = assignmentOf(payload);
        live = false;
        epochApplied = payload.assignmentEpoch;
    }
    return {
        rootSessionId,
        approvalCaseId,
        assignment,
        live,
        epochApplied,
        diagnostics,
        unreconciled: diagnostics.length > 0,
    };
}
function sameTarget(left, right) {
    if (left.kind !== right.kind)
        return false;
    return left.kind === 'leader' || (right.kind === 'instance' && left.instanceId === right.instanceId);
}
/**
 * The staleness gate of A-3: may this caller act as the current handler of this case, at the epoch it
 * read?
 *
 * Every branch fails closed, including the one a caller would rather not have: an `unreconciled` fold
 * cannot confirm a current target, so it confirms nothing. A reviewer that reads a broken view and
 * proceeds anyway is exactly the "无法解析所以没待办" inversion PR #319 §6 forbids, with the polarity
 * flipped.
 */
export function maySubmitFor(state, caller, atEpoch) {
    if (state.unreconciled) {
        return refuse('REVIEW_ASSIGNMENT_ROW_UNPARSEABLE', `${String(state.diagnostics.length)} row(s) could not be applied; the current target is unknown`);
    }
    if (!state.live || state.assignment === null) {
        return refuse('REVIEW_ASSIGNMENT_NO_ACTIVE_ASSIGNMENT', 'this case has no current handler');
    }
    if (atEpoch !== state.epochApplied) {
        return refuse('REVIEW_ASSIGNMENT_STALE_TARGET', `caller presented epoch ${String(atEpoch)}, the family stands at ${String(state.epochApplied)}`);
    }
    const target = state.assignment.target;
    // The Leader branch demands BOTH halves of the Leader identity: the host's `isLeaderInstance` fact and
    // the frozen `LEADER_INSTANCE_ID` that belongs to that Leader instance and to nothing else. A boolean
    // alone would be satisfiable by any caller that built this input out of a field it did not own, and
    // the whole point of this check is that the shape of a wrong answer is loud: a Member can fake a flag,
    // it cannot fake the reserved identity as well. Neither half is an AUTHORITY check — the ControlService
    // re-derives the leg's rung on its own write path, and this lane never authorizes (A-1).
    const matches = target.kind === 'leader'
        ? caller.isLeaderInstance && caller.instanceId === LEADER_INSTANCE_ID
        : caller.instanceId === target.instanceId && !caller.isLeaderInstance;
    if (!matches) {
        return refuse('REVIEW_ASSIGNMENT_STALE_TARGET', `the current target is ${target.kind === 'leader' ? 'the Leader' : target.instanceId}, not this caller`);
    }
    return accept({ assignmentEpoch: state.epochApplied });
}
/** The targets that may no longer submit, newest superseded target first. Empty on a healthy fold. */
export function supersededTargetsOf(state) {
    // The fold keeps only the current record, so a superseded target is recoverable from the rows that
    // produced it. This helper exists for the diagnostic path a reviewer reads, and it is honest about
    // its own scope: it names the CURRENT target when the family is dead, which is the one case the
    // caller can act on without a new fact.
    if (state.assignment === null || state.live)
        return [];
    return [state.assignment.target];
}
/**
 * The writer's pre-flight check: may a fact of `kind` for `target` be appended on top of this folded
 * state, replacing `expectedPreviousEpoch`?
 *
 * The fold enforces the same rules when it reads rows, so this is not the safety mechanism — the durable
 * write path inside the team lock is, and PR-I1 owns it. This exists so a caller gets a typed "no" with
 * the family's own vocabulary BEFORE it allocates a sequence number, instead of an append that the fold
 * later reports as an epoch conflict. Both sides of the check agree because both are this file's.
 */
export function checkAssignmentMutation(state, kind, target, currentLegRequestId) {
    if (state.unreconciled) {
        return refuse('REVIEW_ASSIGNMENT_ROW_UNPARSEABLE', `${String(state.diagnostics.length)} row(s) of this family could not be applied; re-read before writing`);
    }
    const expectedPreviousEpoch = state.epochApplied;
    if (kind === 'created') {
        if (state.assignment !== null) {
            return refuse('REVIEW_ASSIGNMENT_ALREADY_ACTIVE', `epoch ${String(state.epochApplied)} already exists`);
        }
        return accept({ expectedPreviousEpoch, assignmentEpoch: 1 });
    }
    if (state.assignment === null || !state.live) {
        return refuse('REVIEW_ASSIGNMENT_NO_ACTIVE_ASSIGNMENT', `a ${kind} fact needs a live assignment`);
    }
    if (state.assignment.currentLegRequestId !== currentLegRequestId) {
        return refuse('REVIEW_ASSIGNMENT_LEG_MISMATCH', `the family stands at leg ${state.assignment.currentLegRequestId}, the request names ${currentLegRequestId}`);
    }
    if (kind === 'transferred' && sameTarget(state.assignment.target, target)) {
        return refuse('REVIEW_ASSIGNMENT_TARGET_UNCHANGED', 'the case is already assigned to that target');
    }
    return accept({ expectedPreviousEpoch, assignmentEpoch: expectedPreviousEpoch + 1 });
}
//# sourceMappingURL=facts.js.map