/**
 * A4-PR0 — the durable governance proposal substrate (plan Task 0 / A4-PR0;
 * ADR A5-13, A4-2, A4-3, A4-5, A4-6, A4-7; spec §8.4, §24.5, §25.2).
 *
 * WHAT THIS MODULE IS. A record of "someone proposes that this Member's
 * permission overlay move to this effect, from THIS overlay position, and this
 * is the authority that has to agree". It is a durable FACT and nothing else:
 * it approves nothing, authorizes nothing, ranks nothing and mutates nothing.
 * The durable permission chain is still written only by the permission
 * mutation path (ADR §1); this module's output is an input to the decision
 * that eventually reaches it, which is why it holds no overlay reference at
 * all (ADR A4-3).
 *
 * NO PRODUCT SURFACE (ADR A4-6). Nothing in `src/plugin/**` imports this file,
 * it is not re-exported from `governance/index.ts`, and the governance service
 * factory gains no method — the fact type is registered in the two category
 * maps because an UNREGISTERED type makes every projection read of that Team throw forever (the PR0a defect), not because any product path writes one yet.
 *
 * WHY THE PORTS ARE STRUCTURAL (ADR A4-6). The lane may not import a ledger
 * repository TYPE from storage: storage's `LedgerRepository` is a class over a
 * storage seam, and depending on it here would make the substrate untestable
 * outside a storage domain and would put the proposal lane on the storage
 * import list that `a3p3-governance-lane-hygiene.test.ts` exists to keep small.
 * So the writer and reader ports below declare the ROW and the two or three
 * MEMBERS this module actually touches. The adapter is named, not hidden:
 * `packages/storage/repositories/ledger.ts`'s `LedgerRepository` satisfies
 * both ports as it stands — `allocateSequence()`, `put()` and `list()` are
 * already exactly these members over a structurally compatible row, and
 * `a4pr0-proposal-store.test.ts` passes the real repository object with no
 * shim, which is what makes "structural" a checked property rather than a
 * claim. (`src/plugin/root.ts` wires the production ledger the same way for
 * the override store, at `:2481`.)
 *
 * THE THREE GENERATIONS, AND WHICH ONE THIS RECORD CARRIES (ADR A4-2/A4-3).
 * `baseGeneration` is the OVERLAY SNAPSHOT generation — the head of the chain
 * the proposal was written against — and `baseSnapshotId` is that snapshot's
 * derived identity beside it. It is NOT `team_sessions.generation` (the
 * per-team stamp every ledger fact advances, so it would be stale before the
 * record was read back) and NOT the override slot winner (a different plane).
 * The pair is the proposal's claim about the world, so the pair must agree
 * with itself: `null` stands only with `0` (spec §24.5's empty overlay
 * history), and a non-null id must be the derived identity of that generation
 * for that member. A pair that disagrees is CORRUPT, not stale — staleness is
 * a comparison against the CURRENT head, which this module cannot perform
 * because it holds no overlay; the revalidation that turns a stale pair into
 * `mutation-stale` is PR5's, inside the mutation path that owns the overlay
 * (ADR A4-3, spec §24.5).
 *
 * APPEND-ONLY STANDING. A row's `status` is `'pending'`, always, and the
 * STORE stamps it — a caller cannot append a row claiming a different
 * standing. Nothing ever rewrites a row, so a proposal's standing changes only
 * through a NEWER fact (ADR A3-6, spec §26.4), and the answer to it is a
 * Control decision with its own vocabulary (`allow | deny | stale-denied`,
 * spec §11.3). A richer status vocabulary here would duplicate one of those
 * two laws, which is why the set is closed at one value at PR0 and widening it
 * is a plan-level change (ADR A5-13, A3-14 on dead names).
 *
 * @module @dsh-agent-team/runtime/governance/proposal-store
 */
import { deepFreeze, parseInstanceId, parseRootSessionId, } from '../../contracts/src/index.js';
import { ISO_8601_TIMESTAMP_PATTERN } from '../../contracts/src/dto/common.js';
// THE LANE'S ONE STORAGE EDGE, AND WHY. `proposal-store.ts` is the only file in
// this directory that imports a runtime value from `packages/storage`, and it is
// allow-listed by name in `test/a3p3-governance-lane-hygiene.test.ts`. The rule
// this lane follows is: **derive an identity through the module that owns it,
// and mirror everything that is merely a constraint.** The base pair of a
// proposal record IS an overlay snapshot identity, so the derivation and the
// bound that is derived from the same components come from its owner: a mirrored
// copy of either drifts silently, and the drift is not a tightening but a row
// that is durable and unreadable (the reviewer's SF-1: a hand-picked bound below
// `PERMISSION_OVERLAY_MAX_SNAPSHOT_ID_LENGTH` refuses a legal max-length
// identity). The neighbouring `permission-governance` lane already imports values
// from this same module (`permission-governance/types.ts:29,38`), so this is not
// a new kind of edge in the runtime tree — only a new first one in this
// directory, which is why it is now named. Mirrors that stay mirrored, each
// pinned against its owner by a test: the ledger row schema version, the id /
// fingerprint field bounds, and `GOVERNANCE_PROPOSAL_OPERATION_ID_PATTERN`.
import { PERMISSION_OVERLAY_EFFECT_VALUES, PERMISSION_OVERLAY_MAX_SNAPSHOT_ID_LENGTH, isPermissionOverlayEffect, permissionOverlaySnapshotKey, } from '../../storage/schema/permission-overlay.js';
// The A3-9 envelope path is the Blueprint/config grammar, and A3-9 makes THAT
// shape authoritative (it is the one bound into the Blueprint `contentHash`), so
// the path bound is read from its owner rather than mirrored: if the Blueprint
// grammar widens, a proposal record must not become unable to name a path the
// Blueprint accepts. Imported from the narrow module, not the package index, so
// the lane does not pull the validator graph for one number.
import { PERMISSION_PATH_MAX_LENGTH } from '../../domain/blueprint/src/schema.js';
import { GOVERNANCE_PROPOSAL_ERROR_CODES, GovernanceProposalError, } from './proposal-codes.js';
// --- the durable identity of the fact ----------------------------------------
/**
 * The fact type this lane writes. It lives in THIS lane because the writer
 * lives here; the two category maps (`src/plugin/projection-source.ts` and the
 * client's `model/ledger-adapter.ts`, ADR A5-22) name the same string, and
 * `a4pr0a-fact-type-closed-set.test.ts` C1 fails if this one ever drifts from
 * the map. The name carries `FACT_TYPE` on purpose: the guard's constant
 * registry harvests constants named `*_FACT_TYPE*`, and a name outside that
 * convention would make the guard blind to this writer.
 */
export const GOVERNANCE_PROPOSAL_FACT_TYPE = 'governance-proposal-recorded';
/**
 * The `schemaVersion` of the ledger ROW this writer builds, MIRRORED rather
 * than imported. `LedgerRepository.put` re-validates it against storage's
 * `TEAM_DOMAIN_SCHEMA_VERSION`, and `a4pr0-proposal-store.test.ts` pins the
 * mirror against that constant — the same discipline as the permission
 * kernel's mirrored rule-set bound, so the lane keeps no runtime edge to a
 * storage repository module.
 */
export const GOVERNANCE_PROPOSAL_LEDGER_SCHEMA_VERSION = 2;
// --- the record's closed vocabularies ----------------------------------------
/**
 * The authority POSITIONS the `requiredAuthority` field may carry: the four
 * positions ADR A5-1's ladder names (ADR execution-round correction X2).
 *
 * PR0 declares this structurally because the ladder does not exist yet:
 * `RuntimeAuthority` with its `authorityRank()` / `isHigherAuthority()` /
 * ceiling evaluator is PR2's product, and there is nothing on the tree to
 * import today. TWO NAMED OBLIGATIONS follow, and they are PR2's, not
 * suggestions:
 *
 *  1. PR2's `RuntimeAuthority` must be DEFINITIONALLY identical to this union
 *     — assignable in both directions with no cast anywhere. Declaring a
 *     second, divergent ladder type is a plan change.
 *  2. PR2 must either import this union or alias its own name to it, so the
 *     durable vocabulary and the runtime vocabulary stay one set.
 *
 * PR0 PERSISTS the position and INTERPRETS it not at all: no rank, no
 * comparison, no ceiling, no "is this authority enough" helper lives in this
 * file or in PR0. A comparator here would mean PR2's authority algebra ships
 * with no RED of its own to prove it was written before the code it protects.
 */
export const PROPOSAL_AUTHORITY_POSITIONS = ['member', 'leader', 'human-user', 'human-admin'];
/**
 * The append-time standing of a proposal row. One value, on purpose: a row is
 * never rewritten, so the standing of a proposal changes only through a newer
 * fact (ADR A3-6, spec §26.4) and the ANSWER to it is a Control decision with
 * its own closed vocabulary (spec §11.3). Any second value here would be a
 * name nothing can ever write (ADR A3-14) or a duplicate of one of those two
 * laws; widening the set is a plan-level change (ADR A5-13).
 */
export const GOVERNANCE_PROPOSAL_STATUSES = ['pending'];
/** The AST kinds the shared grammar admits (closed; iteration is the audit). */
export const PROPOSAL_ENVELOPE_AST_KINDS = ['exact', 'subtree', 'fingerprint'];
/** The structural bound on an id-shaped field (mirrored from
 *  `storage/schema/field-rules.ts:21`, pinned by test — same reason as the
 *  row schema version above: no runtime edge to a storage module). */
const ID_FIELD_MAX_LENGTH = 128;
/** The structural bound on a fingerprint-shaped field (mirrored from
 *  `storage/schema/field-rules.ts:23`; `a4pr0-proposal-store.test.ts` pins it
 *  against the storage rule). A digest, so the id grammar fits it exactly. */
const FINGERPRINT_FIELD_MAX_LENGTH = 256;
/**
 * The durable `operationId` shape, MIRRORED and pinned (the same discipline as
 * {@link GOVERNANCE_PROPOSAL_LEDGER_SCHEMA_VERSION}): the owner is
 * `storage/schema/operation.ts:45`, which validates it in `parseLedgerEntry`
 * (`storage/schema/ledger.ts:189-195`) — i.e. AFTER a sequence has been
 * allocated. Without this check here, a caller's typo in an operation id would
 * burn a ledger sequence and surface a storage `TeamDomainError` where this
 * lane's contract promises a `MALFORMED_PROPOSAL` refusal with zero allocation.
 */
export const GOVERNANCE_PROPOSAL_OPERATION_ID_PATTERN = /^op-[a-z0-9]{1,32}$/;
/** Control characters, the only character class the Blueprint path grammar
 *  rejects (mirroring `domain/blueprint/src/validate.ts:739-762`, which rejects
 *  control characters, then a blank-after-trim, then the length bound — and
 *  otherwise accepts spaces and any printable text). */
// eslint-disable-next-line no-control-regex -- the grammar this lane mirrors is defined by control-character rejection
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
/**
 * A legal A3-9 / Blueprint envelope path. NOT the id grammar: an envelope path is
 * a resource path, and `fs.write:/My Documents/x` is a legal one. Rejecting
 * internal whitespace here would make the record unable to express a path the
 * Blueprint accepts — the same class of defect as a too-small bound (SF-2).
 *
 * The value is stored UNTRIMMED: trimming here would silently rewrite a durable
 * value, and normalization belongs to the writer that owns the matcher
 * (PR1's adapter), not to a record of what was proposed.
 */
function isPathShaped(value) {
    return (typeof value === 'string' &&
        !CONTROL_CHARACTERS.test(value) &&
        value.trim().length > 0 &&
        value.length <= PERMISSION_PATH_MAX_LENGTH);
}
/**
 * Render an off-contract value inside a REPORT, TOTALLY. A corrupt-record path
 * must never fail by exception (ADR A4-7): `JSON.stringify` throws on a BigInt
 * and on a circular structure, and a report that throws is a corruption that
 * cannot be reported. Reached only through the structural reader port (a durable
 * JSON row cannot carry a BigInt), which is exactly the port PR5 will wire.
 */
function describeValue(value) {
    try {
        const json = JSON.stringify(value);
        if (json !== undefined)
            return json;
    }
    catch {
        /* fall through to the lossy render */
    }
    try {
        return `${typeof value} ${String(value)}`;
    }
    catch {
        return '<unprintable>';
    }
}
// --- the strict parser --------------------------------------------------------
/** The nine payload keys, in the record's declaration order (a missing-field
 *  report names the FIRST one absent in this order). */
const RECORD_FIELDS = [
    'targetMemberInstanceId',
    'baseGeneration',
    'baseSnapshotId',
    'desiredEffect',
    'authorityEnvelopeAst',
    'requiredAuthority',
    'caseFingerprint',
    'status',
    'recordedAt',
];
/** A hygienic id-shaped string: non-empty, bounded, no whitespace/control. */
function isIdShaped(value, maxLength) {
    if (typeof value !== 'string' || value.length === 0 || value.length > maxLength)
        return false;
    // eslint-disable-next-line no-control-regex -- the structural bound this lane mirrors from storage/schema/field-rules.ts
    return !/[\s\u0000-\u001f\u007f]/.test(value);
}
function problem(field, path, kind, message) {
    return { ok: false, field, path, problem: kind, message };
}
/** The AST node, strictly: one of the three A3-9 shapes, exact key set. */
function parseAst(raw) {
    const nodePath = 'payload.authorityEnvelopeAst';
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        return problem('authorityEnvelopeAst', nodePath, 'not-a-plain-record', 'authorityEnvelopeAst must be a plain record carrying one A3-9 matcher node');
    }
    const node = raw;
    const kind = node['kind'];
    if (kind !== 'exact' && kind !== 'subtree' && kind !== 'fingerprint') {
        return problem('authorityEnvelopeAst', `${nodePath}.kind`, 'bad-ast-kind', `authorityEnvelopeAst.kind must be one of ${PROPOSAL_ENVELOPE_AST_KINDS.join(' | ')}, got ${describeValue(kind)}`);
    }
    const expected = kind === 'fingerprint' ? ['kind', 'fingerprint'] : ['kind', 'path'];
    const keys = Object.keys(node);
    const unknown = keys.filter((key) => !expected.includes(key));
    if (unknown.length > 0) {
        return problem('authorityEnvelopeAst', `${nodePath}.${unknown[0] ?? 'kind'}`, 'unknown-field', `authorityEnvelopeAst of kind ${String(kind)} carries ${unknown.join(', ')}`);
    }
    const missing = expected.filter((key) => !keys.includes(key));
    if (missing.length > 0) {
        return problem('authorityEnvelopeAst', `${nodePath}.${missing[0] ?? 'kind'}`, 'missing-field', `authorityEnvelopeAst of kind ${String(kind)} is missing ${missing.join(', ')}`);
    }
    if (kind === 'fingerprint') {
        const fingerprint = node['fingerprint'];
        if (!isIdShaped(fingerprint, FINGERPRINT_FIELD_MAX_LENGTH)) {
            return problem('authorityEnvelopeAst', `${nodePath}.fingerprint`, 'bad-string', 'authorityEnvelopeAst.fingerprint must be a non-empty id-shaped string');
        }
        return { ok: true, ast: { kind, fingerprint } };
    }
    const path = node['path'];
    if (!isPathShaped(path)) {
        return problem('authorityEnvelopeAst', `${nodePath}.path`, 'bad-path', `authorityEnvelopeAst.path must be a non-blank Blueprint path without control characters and of at most ${String(PERMISSION_PATH_MAX_LENGTH)} chars, got ${describeValue(path)}`);
    }
    return { ok: true, ast: { kind, path } };
}
/**
 * Parse one payload STRICTLY (spec §25.2: a strict parser with a typed corrupt
 * outcome, never a lenient read). `teamSessionId` is the LEDGER ROW's root —
 * the base-pair check derives the snapshot identity from it and the target,
 * which is why the payload carries no team field of its own.
 */
function parseProposalPayload(raw, teamSessionId) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        return problem('payload', 'payload', 'not-a-plain-record', 'a governance-proposal-recorded payload must be a plain record');
    }
    const payload = raw;
    const keys = Object.keys(payload);
    const unknown = keys.filter((key) => !RECORD_FIELDS.includes(key));
    if (unknown.length > 0) {
        const field = unknown[0] ?? 'payload';
        return problem(field, `payload.${field}`, 'unknown-field', `the proposal record set is closed; ${field} is not one of its fields (ADR A5-13)`);
    }
    const missing = RECORD_FIELDS.filter((field) => !(field in payload));
    if (missing.length > 0) {
        const field = missing[0] ?? 'payload';
        return problem(field, `payload.${field}`, 'missing-field', `proposal record is missing ${field}`);
    }
    const target = payload['targetMemberInstanceId'];
    if (!isIdShaped(target, ID_FIELD_MAX_LENGTH)) {
        return problem('targetMemberInstanceId', 'payload.targetMemberInstanceId', 'bad-string', 'targetMemberInstanceId must be a non-empty id-shaped string');
    }
    try {
        parseInstanceId(target);
    }
    catch {
        return problem('targetMemberInstanceId', 'payload.targetMemberInstanceId', 'bad-instance-id', `targetMemberInstanceId is not a well-formed instance id: ${String(target)}`);
    }
    const baseGeneration = payload['baseGeneration'];
    if (typeof baseGeneration !== 'number' || !Number.isInteger(baseGeneration) || baseGeneration < 0 || !Number.isSafeInteger(baseGeneration)) {
        return problem('baseGeneration', 'payload.baseGeneration', 'not-a-non-negative-integer', `baseGeneration must be a non-negative safe integer, got ${describeValue(baseGeneration)}`);
    }
    const baseSnapshotId = payload['baseSnapshotId'];
    // The bound is the owner's DERIVED sum (session id + separator + instance id +
    // separator + generation digits), not a hand-picked number: anything below it
    // refuses a legal max-length identity and reports a durable row as corrupt.
    if (baseSnapshotId !== null && !isIdShaped(baseSnapshotId, PERMISSION_OVERLAY_MAX_SNAPSHOT_ID_LENGTH)) {
        return problem('baseSnapshotId', 'payload.baseSnapshotId', 'bad-string', `baseSnapshotId must be null or a non-empty id-shaped string of at most ${String(PERMISSION_OVERLAY_MAX_SNAPSHOT_ID_LENGTH)} chars`);
    }
    // A4-3: the pair is authoritative TOGETHER. `null` stands only with 0 (the
    // empty-history case of spec §24.5); a non-null id stands only with a
    // generation >= 1 AND only as that generation's derived identity for THIS
    // member in THIS team. A pair that disagrees is corrupt — never "stale",
    // which is a comparison against the current head this module cannot make.
    if (baseSnapshotId === null) {
        if (baseGeneration !== 0) {
            return problem('baseSnapshotId', 'payload.baseSnapshotId', 'base-pair-disagreement', `baseSnapshotId null stands only with baseGeneration 0 (the empty overlay history), got ${String(baseGeneration)}`);
        }
    }
    else {
        const derived = baseGeneration === 0 ? null : deriveSnapshotId(teamSessionId, target, baseGeneration);
        if (derived === null || derived !== baseSnapshotId) {
            return problem('baseSnapshotId', 'payload.baseSnapshotId', 'base-pair-disagreement', `baseSnapshotId does not identify generation ${String(baseGeneration)} of this member's overlay chain (ADR A4-3: a pair that disagrees is corrupt, not stale)`);
        }
    }
    const desiredEffect = payload['desiredEffect'];
    if (!isPermissionOverlayEffect(desiredEffect)) {
        return problem('desiredEffect', 'payload.desiredEffect', 'value-not-in-closed-set', `desiredEffect must be one of ${PERMISSION_OVERLAY_EFFECT_VALUES.join(' | ')}, got ${describeValue(desiredEffect)}`);
    }
    const ast = parseAst(payload['authorityEnvelopeAst']);
    if (!ast.ok) {
        // Both failure shapes are the same located-problem record, so the AST's
        // verdict is reported as this payload's verdict unchanged.
        return ast;
    }
    const requiredAuthority = payload['requiredAuthority'];
    if (!PROPOSAL_AUTHORITY_POSITIONS.includes(requiredAuthority)) {
        return problem('requiredAuthority', 'payload.requiredAuthority', 'value-not-in-closed-set', `requiredAuthority must be one of ${PROPOSAL_AUTHORITY_POSITIONS.join(' | ')}, got ${describeValue(requiredAuthority)}`);
    }
    const caseFingerprint = payload['caseFingerprint'];
    if (!isIdShaped(caseFingerprint, FINGERPRINT_FIELD_MAX_LENGTH)) {
        return problem('caseFingerprint', 'payload.caseFingerprint', 'bad-string', 'caseFingerprint must be a non-empty string of at most 256 chars, without whitespace or control characters');
    }
    const status = payload['status'];
    if (!GOVERNANCE_PROPOSAL_STATUSES.includes(status)) {
        return problem('status', 'payload.status', 'value-not-in-closed-set', `status must be one of ${GOVERNANCE_PROPOSAL_STATUSES.join(' | ')} (a row is never rewritten; its standing changes only through newer facts), got ${describeValue(status)}`);
    }
    const recordedAt = payload['recordedAt'];
    if (typeof recordedAt !== 'string' || !ISO_8601_TIMESTAMP_PATTERN.test(recordedAt) || Number.isNaN(Date.parse(recordedAt))) {
        return problem('recordedAt', 'payload.recordedAt', 'bad-timestamp', `recordedAt must be an ISO-8601 timestamp, got ${describeValue(recordedAt)}`);
    }
    return {
        ok: true,
        record: deepFreeze({
            targetMemberInstanceId: target,
            baseGeneration,
            baseSnapshotId: baseSnapshotId,
            desiredEffect,
            authorityEnvelopeAst: ast.ast,
            requiredAuthority: requiredAuthority,
            caseFingerprint,
            status: status,
            recordedAt,
        }),
    };
}
/** The derived overlay snapshot identity of one generation, or `null` when the
 *  identities make the derivation impossible (an embedded key separator) —
 *  which is exactly the case the pair rule must refuse, never guess about. */
function deriveSnapshotId(teamSessionId, memberInstanceId, generation) {
    try {
        return permissionOverlaySnapshotKey(teamSessionId, memberInstanceId, generation);
    }
    catch {
        return null;
    }
}
// --- the store ----------------------------------------------------------------
/**
 * Build one proposal store over one durable ledger.
 *
 * @param deps - the ledger ports and the store's clock (see
 *   {@link GovernanceProposalStoreDeps}).
 * @returns the store surface ({@link GovernanceProposalStore}).
 */
export function createGovernanceProposalStore(deps) {
    const ledger = deps.ledger;
    const assertTeamSessionId = (raw) => {
        try {
            return String(parseRootSessionId(raw));
        }
        catch {
            throw new GovernanceProposalError(GOVERNANCE_PROPOSAL_ERROR_CODES.MALFORMED_PROPOSAL, `teamSessionId is not a well-formed TeamSession id: ${String(raw)}`, { problem: 'bad-team-session-id', field: 'teamSessionId', path: 'teamSessionId' });
        }
    };
    const appendProposal = async (args) => {
        const teamSessionId = assertTeamSessionId(args.teamSessionId);
        // Validated HERE, not by `parseLedgerEntry` later: the ledger validator runs
        // after `allocateSequence()`, so leaving it there would burn a sequence and
        // answer a caller's typo with a storage error instead of this lane's code.
        if (args.operationId !== undefined && !GOVERNANCE_PROPOSAL_OPERATION_ID_PATTERN.test(args.operationId)) {
            throw new GovernanceProposalError(GOVERNANCE_PROPOSAL_ERROR_CODES.MALFORMED_PROPOSAL, `operationId must match ${String(GOVERNANCE_PROPOSAL_OPERATION_ID_PATTERN)}, got ${describeValue(args.operationId)}`, { problem: 'bad-operation-id', field: 'operationId', path: 'operationId' });
        }
        const recordedAt = deps.now();
        // The payload is built first and parsed with the SAME parser the reader
        // uses: what this store can write is exactly what its reader promises to
        // read back, so the two can never drift apart by construction.
        const payload = {
            targetMemberInstanceId: args.proposal.targetMemberInstanceId,
            baseGeneration: args.proposal.baseGeneration,
            baseSnapshotId: args.proposal.baseSnapshotId,
            desiredEffect: args.proposal.desiredEffect,
            authorityEnvelopeAst: args.proposal.authorityEnvelopeAst,
            requiredAuthority: args.proposal.requiredAuthority,
            caseFingerprint: args.proposal.caseFingerprint,
            status: 'pending',
            recordedAt,
        };
        const parsed = parseProposalPayload(payload, teamSessionId);
        if (!parsed.ok) {
            throw new GovernanceProposalError(GOVERNANCE_PROPOSAL_ERROR_CODES.MALFORMED_PROPOSAL, parsed.message, { problem: parsed.problem, field: parsed.field, path: parsed.path });
        }
        // Only now — after every check — is a sequence taken. A refusal must not
        // burn an allocation.
        const sequence = await ledger.allocateSequence();
        const row = {
            schemaVersion: GOVERNANCE_PROPOSAL_LEDGER_SCHEMA_VERSION,
            sequence,
            rootSessionId: teamSessionId,
            factType: GOVERNANCE_PROPOSAL_FACT_TYPE,
            // A fresh object literal, not the parsed interface: an interface has no
            // index signature, and the durable row carries a plain map (the parser
            // accepts exactly these nine keys back, so nothing is widened silently).
            payload: { ...parsed.record },
            createdAt: recordedAt,
            // KEY-OMITTED optionality (ADR A5-13): `undefined` is not a
            // `RemoteSafeJsonValue`, and the durable validator re-checks the
            // DESERIALIZED row too (`packages/storage/schema/ledger.ts:202,206`), so
            // an explicit-`undefined` key would read back silently ABSENT rather
            // than loudly wrong. The key is therefore simply not present.
            ...(args.operationId !== undefined ? { operationId: args.operationId } : {}),
        };
        await ledger.put(row);
        return deepFreeze({ sequence, record: parsed.record });
    };
    const listProposals = (query) => {
        const teamSessionId = assertTeamSessionId(query.teamSessionId);
        // NEVER wrapped in try/catch: a row that is not a valid ledger entry
        // throws out of `list()` — see the interface doc (ADR A4-7 leg 2).
        const outcomes = [];
        for (const row of ledger.list()) {
            if (row.factType !== GOVERNANCE_PROPOSAL_FACT_TYPE)
                continue;
            if (String(row.rootSessionId) !== teamSessionId)
                continue;
            const parsed = parseProposalPayload(row.payload, String(row.rootSessionId));
            if (parsed.ok) {
                outcomes.push(deepFreeze({
                    kind: 'record',
                    sequence: row.sequence,
                    teamSessionId,
                    ...(row.operationId !== undefined ? { operationId: row.operationId } : {}),
                    proposal: parsed.record,
                }));
                continue;
            }
            outcomes.push(deepFreeze({
                kind: 'corrupt-record',
                code: GOVERNANCE_PROPOSAL_ERROR_CODES.CORRUPT_RECORD,
                sequence: row.sequence,
                // The filter above makes this statically equal to the row's own
                // fact type, and naming the constant (rather than passing the row's
                // value through) is both exact and legible to the closed-set guard.
                factType: GOVERNANCE_PROPOSAL_FACT_TYPE,
                path: parsed.path,
                field: parsed.field,
                problem: parsed.problem,
                message: parsed.message,
            }));
        }
        return deepFreeze(outcomes);
    };
    // The surface is a plain object, NOT deep-frozen: `deepFreeze` asserts
    // lossless JSON and a method is a function (the same reason the control and
    // governance services return a literal). The DATA this store hands back —
    // records and read outcomes — is frozen where it is built.
    return { appendProposal, listProposals };
}
//# sourceMappingURL=proposal-store.js.map