/**
 * The v5 authoring grammar — DORMANT fifth parser for Alpha.6 review routing.
 *
 * WHY DORMANT: `SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS` remains `[3, 4]` in
 * PR1. The production entry therefore still refuses `schemaVersion: 5` with
 * `SCHEMA_VERSION_MISMATCH`; the flip is a later, explicit step (PR6), so this
 * PR cannot change existing Alpha.5 blueprint behaviour. Direct callers can
 * exercise the grammar through `parseBlueprintV5` / `validateBlueprintV5Document`.
 *
 * STRUCTURE = zero drift by construction:
 *  - the v5 core face is the v4 face plus exactly one optional top-level
 *    `reviewRouting` family; the core is parsed by the frozen v4 bridge with
 *    `reviewRouting` stripped and the version restamped to 4, so the frozen
 *    v3/v4 branches cannot fork;
 *  - only the review-routing family is validated here, against CLOSED local
 *    tables. This module imports no runtime, no ControlService and no PA;
 *    the policy object is a pure authoring fact that a runtime router may
 *    consume later.
 *
 * Grammar law:
 *  - an absent `reviewRouting` = Alpha.6 routing off (no implicit default);
 *  - a present family is explicitly enabled and must carry every field;
 *  - unknown keys, wrong types, duplicate leader exceptions, an Officer that
 *    is not a MemberTemplate, and a non-`officer` default are refusals at
 *    their full path;
 *  - all problems are collected into one `MALFORMED_DTO` throw.
 *
 * @module @dsh-agent-team/domain/blueprint-v5
 */
import { deepFreeze, teamContractError } from '../../../contracts/src/index.js';
import { decodeYamlFrontmatter, splitFrontmatter } from './parse.js';
import { BLUEPRINT_V4_TOP_LEVEL_FIELDS, toHashableBlueprintV4, validateBlueprintV4Document } from './blueprint-v4.js';
import { deriveContentHash } from './hash.js';
/** The v5 document version this dormant grammar owns. */
export const BLUEPRINT_V5_SCHEMA_VERSION = 5;
/** The one additive v5 top-level family. */
export const BLUEPRINT_V5_REVIEW_ROUTING_FAMILY = 'reviewRouting';
/** The closed v5 top-level key set: the v4 face plus the ONE family. */
export const BLUEPRINT_V5_TOP_LEVEL_FIELDS = Object.freeze([
    ...BLUEPRINT_V4_TOP_LEVEL_FIELDS,
    BLUEPRINT_V5_REVIEW_ROUTING_FAMILY,
]);
/** The closed fields of the reviewRouting block. */
export const BLUEPRINT_V5_REVIEW_ROUTING_FIELDS = [
    'enabled',
    'officerTemplateId',
    'ordinaryToolApprovals',
    'whenOfficerUnavailable',
];
/** The closed fields of ordinaryToolApprovals. */
export const BLUEPRINT_V5_ORDINARY_TOOL_APPROVAL_FIELDS = ['default', 'leaderExceptions'];
/** The closed fields of one leader exception. */
export const BLUEPRINT_V5_LEADER_EXCEPTION_FIELDS = ['memberTemplateId', 'tool'];
/** The closed fields of a trusted tool coordinate. */
export const BLUEPRINT_V5_TOOL_COORDINATE_FIELDS = ['owner', 'name'];
/** The only legal ordinary default: the dedicated Officer. */
export const BLUEPRINT_V5_ORDINARY_DEFAULTS = ['officer'];
/** The only legal unavailable policies. */
export const BLUEPRINT_V5_WHEN_OFFICER_UNAVAILABLE = ['hold', 'leader'];
function isRec(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function stringField(record, key, path, sink) {
    const value = record[key];
    if (typeof value !== 'string') {
        sink.push({ code: 'field-type', path, detail: `${key} must be a non-empty string` });
        return null;
    }
    const normalized = value.trim();
    if (normalized.length === 0) {
        sink.push({ code: 'field-empty', path, detail: `${key} must not be empty` });
        return null;
    }
    if (normalized !== value) {
        sink.push({ code: 'field-untrimmed', path, detail: `${key} must not carry leading/trailing whitespace` });
        return null;
    }
    return normalized;
}
function unknownFields(record, allowed, path, sink) {
    for (const key of Object.keys(record).sort()) {
        if (!allowed.includes(key)) {
            sink.push({ code: 'unknown-field', path: `${path}.${key}`, detail: `${key} is not part of the closed v5 ${path} grammar` });
        }
    }
}
function validateToolCoordinate(raw, path, sink) {
    if (!isRec(raw)) {
        sink.push({ code: 'field-type', path, detail: 'tool must be a record with owner and name' });
        return null;
    }
    unknownFields(raw, BLUEPRINT_V5_TOOL_COORDINATE_FIELDS, path, sink);
    const owner = stringField(raw, 'owner', `${path}.owner`, sink);
    const name = stringField(raw, 'name', `${path}.name`, sink);
    return owner !== null && name !== null ? { owner, name } : null;
}
function validateLeaderException(raw, path, memberIds, sink) {
    if (!isRec(raw)) {
        sink.push({ code: 'field-type', path, detail: 'a leader exception must be a record' });
        return null;
    }
    unknownFields(raw, BLUEPRINT_V5_LEADER_EXCEPTION_FIELDS, path, sink);
    const memberTemplateId = stringField(raw, 'memberTemplateId', `${path}.memberTemplateId`, sink);
    if (memberTemplateId !== null && !memberIds.has(memberTemplateId)) {
        sink.push({
            code: 'member-template-not-found',
            path: `${path}.memberTemplateId`,
            detail: `leader exception memberTemplateId '${memberTemplateId}' does not name a MemberTemplate in this document`,
        });
    }
    const tool = validateToolCoordinate(raw['tool'], `${path}.tool`, sink);
    return memberTemplateId !== null && tool !== null ? { memberTemplateId, tool } : null;
}
function validateReviewRouting(raw, memberIds, leaderTemplateId) {
    const sink = [];
    if (!isRec(raw)) {
        throw teamContractError('MALFORMED_DTO', 'reviewRouting must be a record', { path: '$.reviewRouting' });
    }
    unknownFields(raw, BLUEPRINT_V5_REVIEW_ROUTING_FIELDS, '$.reviewRouting', sink);
    if (raw['enabled'] !== true) {
        sink.push({
            code: 'review-routing-disabled',
            path: '$.reviewRouting.enabled',
            detail: 'a present reviewRouting block must be explicitly enabled: true; omit the whole block to keep Alpha.6 routing off',
            legalValues: ['true'],
        });
    }
    const officerTemplateId = stringField(raw, 'officerTemplateId', '$.reviewRouting.officerTemplateId', sink);
    if (officerTemplateId !== null) {
        if (officerTemplateId === leaderTemplateId) {
            sink.push({
                code: 'officer-not-member',
                path: '$.reviewRouting.officerTemplateId',
                detail: `officerTemplateId '${officerTemplateId}' names the LeaderTemplate; the Officer must be a MemberTemplate`,
            });
        }
        else if (!memberIds.has(officerTemplateId)) {
            sink.push({
                code: 'member-template-not-found',
                path: '$.reviewRouting.officerTemplateId',
                detail: `officerTemplateId '${officerTemplateId}' does not name a MemberTemplate in this document`,
            });
        }
    }
    const ordinaryRaw = raw['ordinaryToolApprovals'];
    let ordinaryToolApprovals = null;
    if (!isRec(ordinaryRaw)) {
        sink.push({ code: 'field-type', path: '$.reviewRouting.ordinaryToolApprovals', detail: 'ordinaryToolApprovals must be a record' });
    }
    else {
        unknownFields(ordinaryRaw, BLUEPRINT_V5_ORDINARY_TOOL_APPROVAL_FIELDS, '$.reviewRouting.ordinaryToolApprovals', sink);
        if (ordinaryRaw['default'] !== 'officer') {
            sink.push({
                code: 'invalid-ordinary-default',
                path: '$.reviewRouting.ordinaryToolApprovals.default',
                detail: "the ordinary default must be 'officer'; a Leader default would silently bypass the dedicated Officer",
                legalValues: [...BLUEPRINT_V5_ORDINARY_DEFAULTS],
            });
        }
        const exceptionsRaw = ordinaryRaw['leaderExceptions'];
        const exceptions = [];
        if (!Array.isArray(exceptionsRaw)) {
            sink.push({ code: 'field-type', path: '$.reviewRouting.ordinaryToolApprovals.leaderExceptions', detail: 'leaderExceptions must be an array (empty is explicit)' });
        }
        else {
            const seen = new Set();
            exceptionsRaw.forEach((entry, index) => {
                const parsed = validateLeaderException(entry, `$.reviewRouting.ordinaryToolApprovals.leaderExceptions[${String(index)}]`, memberIds, sink);
                if (parsed !== null) {
                    const key = `${parsed.memberTemplateId}\u0000${parsed.tool.owner}\u0000${parsed.tool.name}`;
                    if (seen.has(key)) {
                        sink.push({
                            code: 'duplicate-leader-exception',
                            path: `$.reviewRouting.ordinaryToolApprovals.leaderExceptions[${String(index)}]`,
                            detail: `duplicate leader exception for '${parsed.memberTemplateId}' × '${parsed.tool.owner}/${parsed.tool.name}'`,
                        });
                    }
                    else {
                        seen.add(key);
                        exceptions.push(parsed);
                    }
                }
            });
        }
        ordinaryToolApprovals = { default: 'officer', leaderExceptions: exceptions };
    }
    const whenOfficerUnavailable = raw['whenOfficerUnavailable'];
    if (typeof whenOfficerUnavailable !== 'string' || !BLUEPRINT_V5_WHEN_OFFICER_UNAVAILABLE.includes(whenOfficerUnavailable)) {
        sink.push({
            code: 'invalid-when-officer-unavailable',
            path: '$.reviewRouting.whenOfficerUnavailable',
            detail: "whenOfficerUnavailable must be 'hold' or 'leader'",
            legalValues: [...BLUEPRINT_V5_WHEN_OFFICER_UNAVAILABLE],
        });
    }
    if (sink.length > 0 || ordinaryToolApprovals === null || officerTemplateId === null || whenOfficerUnavailable === undefined) {
        throw teamContractError('MALFORMED_DTO', 'the v5 reviewRouting family was refused; every problem is listed at its full path', {
            problems: sink.map((p) => ({
                code: p.code,
                path: p.path,
                detail: p.detail,
                ...(p.legalValues === undefined ? {} : { legalValues: [...p.legalValues] }),
            })),
        });
    }
    return deepFreeze({
        enabled: true,
        officerTemplateId,
        ordinaryToolApprovals,
        whenOfficerUnavailable: whenOfficerUnavailable,
    });
}
/**
 * Validate a v5 authoring document. The v4 core face is delegated to the
 * FROZEN v4 parser (restamped), and only `reviewRouting` is parsed here.
 */
export function validateBlueprintV5Document(raw) {
    if (!isRec(raw)) {
        throw teamContractError('MALFORMED_DTO', 'a v5 blueprint document must be a record', { path: '$' });
    }
    const version = raw['schemaVersion'];
    if (typeof version !== 'number' || !Number.isInteger(version)) {
        throw teamContractError('SCHEMA_VERSION_UNSUPPORTED', `v5 grammar requires an integer schemaVersion, got ${typeof version}`, { path: '$.schemaVersion' });
    }
    if (version !== BLUEPRINT_V5_SCHEMA_VERSION) {
        throw teamContractError('SCHEMA_VERSION_MISMATCH', `the v5 authoring grammar accepts only ${String(BLUEPRINT_V5_SCHEMA_VERSION)}, got ${String(version)}`, { path: '$.schemaVersion' });
    }
    const hasFamily = Object.hasOwn(raw, BLUEPRINT_V5_REVIEW_ROUTING_FAMILY) && raw[BLUEPRINT_V5_REVIEW_ROUTING_FAMILY] !== undefined;
    const rest = { ...raw };
    delete rest[BLUEPRINT_V5_REVIEW_ROUTING_FAMILY];
    const core4 = validateBlueprintV4Document({ ...rest, schemaVersion: 4 });
    if (!hasFamily) {
        return deepFreeze({ ...core4, schemaVersion: 5 });
    }
    const memberIds = new Set(core4.members.map((member) => member.templateId));
    const reviewRouting = validateReviewRouting(raw[BLUEPRINT_V5_REVIEW_ROUTING_FAMILY], memberIds, core4.leader.templateId);
    return deepFreeze({ ...core4, schemaVersion: 5, reviewRouting });
}
/** The hashable projection: the frozen v4 projection (restamped) plus the declared family. */
export function toHashableBlueprintV5(core) {
    const { schemaVersion: _v5, reviewRouting, ...rest } = core;
    const hashable4 = toHashableBlueprintV4({ ...rest, schemaVersion: 4 });
    return {
        ...hashable4,
        schemaVersion: BLUEPRINT_V5_SCHEMA_VERSION,
        ...(reviewRouting !== undefined
            ? { reviewRouting: JSON.parse(JSON.stringify(reviewRouting)) }
            : {}),
    };
}
/** Source pipeline mirror of `parseBlueprint` for the v5 grammar (dormant). */
export function parseBlueprintV5(source) {
    const doc = splitFrontmatter(source);
    const raw = decodeYamlFrontmatter(doc.frontmatterText);
    const core = validateBlueprintV5Document(raw);
    const contentHash = deriveContentHash(toHashableBlueprintV5(core));
    return deepFreeze({ ...core, contentHash });
}
//# sourceMappingURL=blueprint-v5.js.map