/**
 * The v4 authoring grammar — DORMANT fourth parser (VNEXT-SCHEMA-ADR M-1
 * reversible half).
 *
 * WHY THIS FILE IS NOT WIRED: `SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS` stays
 * `[3]` this round — the production entry refuses `schemaVersion: 4` with
 * `SCHEMA_VERSION_MISMATCH` exactly as before (pinned by a5sr2), so NOTHING
 * shipped reaches the functions below. The flip (adding 4 to SUPPORTED) is
 * the IRREVERSIBLE last step (翻档); it awaits the A-4 window ruling and is
 * prepared by `scripts/prepare-blueprint-v4-flip.mjs` as a dry-run only.
 *
 * STRUCTURE = zero drift by construction:
 *  - the v4 document face is the v3 face PLUS the optional top-level
 *    `toolBindings` field family; the CORE is parsed by the FROZEN v3
 *    validator itself (strip `toolBindings`, restamp version 3, delegate),
 *    so the frozen v3 branch cannot fork and cannot soften;
 *  - the `toolBindings` grammar is validated here against CLOSED local
 *    tables. This layer must not import the tool-governance lane (the A5
 *    layer audit pins the consumer allow-list); the IDENTITY between the v4
 *    vocabularies and the frozen tool-governance sets is pinned by the test
 *    suite (a5sr3), which IS allowed to read both lanes.
 *
 * Grammar law (ADR §1 B1–B6, D-02/D-03/D-05/D-08/D-09):
 *  - optional field family: absence = NO governance declared, never an
 *    expansion (the reversible A-1 interim stance);
 *  - every value in a declared entry is explicitly written — omissions are
 *    `ambiguous-omission` refusals, not defaults; a key belonging to the
 *    other mode variant is a contradiction, not a silent pick;
 *  - unknown keys are `unknown-field` refusals at their FULL path; v2-
 *    proposal fields (`kind`/`adapterId`/`runnerId`/`shadowExecute`) are
 *    `removed-field` refusals BY NAME;
 *  - closed enums refuse `unknown-enum` with the legal set in the detail —
 *    never a case fold, never an alias;
 *  - `..` is refused in any path segment (`path-unresolvable`) even when
 *    folding keeps it inside; legal whitespace inside a locator survives
 *    VERBATIM (zero normalization — the NRM-1 lesson);
 *  - problems are COLLECTED (one throw carries every defect at its path),
 *    mirroring the tool-governance parse law.
 *
 * Purity: no `node:*`, no I/O, no clock (the whole domain law).
 *
 * @module @dsh-agent-team/domain/blueprint-v4
 */
import { deepFreeze, teamContractError } from '../../../contracts/src/index.js';
import { decodeYamlFrontmatter, splitFrontmatter } from './parse.js';
import { BLUEPRINT_TOP_LEVEL_FIELDS_V3 } from './schema.js';
import { deriveContentHash } from './hash.js';
import { toHashableBlueprint, validateBlueprintDocument } from './validate.js';
// --- closed tables (local; identity to the frozen tool-governance sets is
// --- pinned by test a5sr3, which may read both lanes) ------------------------
/** The v4 document version this dormant grammar owns. */
export const BLUEPRINT_V4_SCHEMA_VERSION = 4;
/** v4 top-level face = the frozen v3 face plus the optional field family. */
export const BLUEPRINT_V4_TOOL_BINDING_FAMILY = 'toolBindings';
/**
 * The SECOND v4-only family: the per-Member global I/O ceiling (Alpha.5
 * P1-01, the ONE missing author carrier).
 *
 * WHY IT EXISTS: `toolBindings[].io` is PER-TOOL; `toolBindings[].owner` is
 * the tool's authoring source, NOT a MemberIdentity (pinned by a5sr2 and
 * re-pinned by a5sf-v4-member-ceiling-projection); a4 `memberEnvelopes`
 * carry mutation-operation tokens, not file/network I/O.  The plan's
 * `EffectiveIO(member, tool, call) ⊆ MemberCeiling(member) ∩
 * ToolRestriction(member, tool)` therefore needs exactly one authoring
 * carrier for the LEFT factor, and this family is it.
 *
 * REUSE, NOT A SECOND LANGUAGE: an entry's `io` block has the SAME closed
 * three-lane shape, SAME mode variants, SAME locator law and SAME
 * zero-normalization as `toolBindings[].io` (the lane validators are
 * literally shared).  The only new fact is the `templateId` reference,
 * which is CLOSED over this blueprint's templates (leader included) — an
 * authoring-time reference the trusted compiler later resolves to a real
 * MemberIdentity; it is never a free-form name and never inferred from
 * argv/cwd.
 *
 * OPTIONAL and present-only in the hash, exactly like `toolBindings`: an
 * absent family declares NOTHING (a member without a row has no ceiling —
 * never a synthesized `read: all`).
 */
export const BLUEPRINT_V4_MEMBER_CEILING_FAMILY = 'memberIoCeilings';
/** The closed entry shape of one `memberIoCeilings` item. */
export const BLUEPRINT_V4_MEMBER_CEILING_FIELDS = ['templateId', 'io'];
/** The closed v4 top-level key set: the frozen v3 table plus the TWO v4-only families. */
export const BLUEPRINT_V4_TOP_LEVEL_FIELDS = Object.freeze([
    ...BLUEPRINT_TOP_LEVEL_FIELDS_V3,
    BLUEPRINT_V4_TOOL_BINDING_FAMILY,
    BLUEPRINT_V4_MEMBER_CEILING_FAMILY,
]);
/** The closed entry shape of one `toolBindings` item. */
export const BLUEPRINT_V4_TOOL_BINDING_FIELDS = ['owner', 'name', 'authorization', 'io', 'execution'];
export const BLUEPRINT_V4_AUTHORIZATIONS = ['allow', 'ask', 'deny'];
export const BLUEPRINT_V4_IO_FIELDS = ['read', 'write', 'network'];
/** rw-lane modes and their REQUIRED-and-ALLOWED key sets (D-03, no defaults). */
export const BLUEPRINT_V4_IO_RW_MODES = ['all', 'restricted'];
export const BLUEPRINT_V4_IO_RW_FIELDS_BY_MODE = Object.freeze({
    all: Object.freeze(['mode', 'deny']),
    restricted: Object.freeze(['mode', 'allow', 'ask', 'deny']),
});
export const BLUEPRINT_V4_NETWORK_MODES = ['allow', 'restricted', 'deny'];
export const BLUEPRINT_V4_NETWORK_DEFAULTS = ['ask', 'deny'];
export const BLUEPRINT_V4_NETWORK_FIELDS_BY_MODE = Object.freeze({
    allow: Object.freeze(['mode']),
    restricted: Object.freeze(['mode', 'allow', 'ask', 'deny', 'default']),
    deny: Object.freeze(['mode', 'default']),
});
/** The authoring execution block = the three frozen axes (kind/adapterId/runnerId REMOVED). */
export const BLUEPRINT_V4_EXECUTION_FIELDS = ['implementationOrigin', 'executionBoundary'];
export const BLUEPRINT_V4_IMPLEMENTATION_ORIGINS = ['dsh-native', 'team-trusted-extension', 'standalone-runner', 'remote-provider'];
export const BLUEPRINT_V4_EXECUTION_BOUNDARIES = ['trusted-host', 'confined-subprocess', 'delegated-remote'];
/** v2-proposal fields refused BY NAME (D-05; the refusal names the removal). */
export const BLUEPRINT_V4_REMOVED_FIELDS = Object.freeze({
    entry: Object.freeze(['shadowExecute']),
    execution: Object.freeze(['kind', 'adapterId', 'runnerId']),
});
// --- problem vocabulary (v4 grammar surface; candidate→shipped mapping in
// --- test a5sr5) --------------------------------------------------------------
export const V4_PROBLEM_CODES = [
    'not-a-record',
    'field-type',
    'unknown-field',
    'removed-field',
    'ambiguous-omission',
    'unknown-enum',
    'path-unresolvable',
    /**
     * A `memberIoCeilings` family binds one templateId TWICE.  A second row is
     * never merged or resolved by declaration order: two ceilings for one
     * member have no single meaning, so the whole document is refused.
     */
    'duplicate-member-ceiling',
];
function isRec(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}
// eslint-disable-next-line no-control-regex -- intentional scanner: mirrors validate.ts:157, identifiers and locators carry no control characters
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;
function hasDotDotSegment(locator) {
    return locator.split(/[/\\]/).some((segment) => segment === '..');
}
function pushMissing(sink, path, what) {
    sink.push({ code: 'ambiguous-omission', path, detail: `${what} is required inside a declared toolBindings entry — v4 declares no implicit defaults (D-03)` });
}
function validateNameLike(value, path, sink) {
    if (typeof value !== 'string' || value.trim() === '' || CONTROL_CHARS.test(value) || value.length > 128) {
        sink.push({ code: 'field-type', path, detail: 'expected a non-empty identifier string without control characters' });
        return null;
    }
    return value;
}
function validateLocatorList(value, path, key, sink) {
    if (!Array.isArray(value)) {
        sink.push({ code: 'field-type', path: `${path}.${key}`, detail: `'${key}' must be an explicit (possibly empty) list of locator strings` });
        return null;
    }
    const out = [];
    value.forEach((item, index) => {
        const itemPath = `${path}.${key}[${String(index)}]`;
        if (typeof item !== 'string' || item.trim() === '' || CONTROL_CHARS.test(item)) {
            sink.push({ code: 'field-type', path: itemPath, detail: 'a locator must be a non-empty string without control characters (legal whitespace survives verbatim — zero normalization)' });
            return;
        }
        if (hasDotDotSegment(item)) {
            sink.push({ code: 'path-unresolvable', path: itemPath, detail: `'..' segments are refused in any position, even when folding would keep the path inside (D-09)` });
            return;
        }
        out.push(item);
    });
    return out;
}
/** One mode-variant lane: closed keys FOR THE DECLARED MODE; other-variant keys are contradictions. */
function validateLane(lane, path, modes, fieldsByMode, enumDetail, sink, scalarKeys = []) {
    if (!isRec(lane)) {
        sink.push({ code: 'not-a-record', path, detail: enumDetail });
        return null;
    }
    const modeRaw = lane['mode'];
    let mode = null;
    if (!Object.hasOwn(lane, 'mode') || modeRaw === undefined) {
        pushMissing(sink, `${path}.mode`, 'mode');
    }
    else if (typeof modeRaw !== 'string' || !modes.includes(modeRaw)) {
        sink.push({
            code: 'unknown-enum',
            path: `${path}.mode`,
            detail: `mode must be one of ${modes.join(' | ')} (no aliases, no case folding)`,
            legalValues: modes.slice(),
        });
    }
    else {
        mode = modeRaw;
    }
    const knownRaw = mode === null ? undefined : fieldsByMode[mode];
    const known = knownRaw === undefined ? null : knownRaw;
    for (const key of Object.keys(lane)) {
        if (key === 'mode')
            continue;
        if (known !== null && known.includes(key))
            continue;
        if (known === null) {
            // mode unusable: report the key as unacceptable, but the PATH law
            // (D-09) is context-free — a `..` in a list the author wrote stays a
            // defect the review must see even when the lane's mode is refused.
            sink.push({ code: 'unknown-field', path: `${path}.${key}`, detail: `field '${key}' cannot be accepted while mode is refused` });
            if (Array.isArray(lane[key]))
                validateLocatorList(lane[key], path, key, sink);
            continue;
        }
        const owner = Object.values(fieldsByMode).find((fields) => fields.includes(key));
        if (owner !== undefined) {
            sink.push({
                code: 'ambiguous-omission',
                path: `${path}.${key}`,
                detail: `field '${key}' is only meaningful under mode '${Object.entries(fieldsByMode).find(([, fields]) => fields.includes(key))?.[0] ?? '?'}', but mode is '${mode}' — a mode contradiction is refused, never resolved silently (D-03)`,
            });
        }
        else {
            sink.push({ code: 'unknown-field', path: `${path}.${key}`, detail: `field '${key}' is outside the closed v4 lane shape` });
        }
    }
    if (mode === null || known === null)
        return null;
    const out = { mode };
    for (const key of known) {
        if (key === 'mode')
            continue;
        if (!Object.hasOwn(lane, key)) {
            pushMissing(sink, `${path}.${key}`, key);
            continue;
        }
        if (scalarKeys.includes(key))
            continue; // validated by the caller (enum scalar, not a locator list)
        const lists = validateLocatorList(lane[key], path, key, sink);
        if (lists !== null)
            out[key] = lists;
    }
    return out;
}
function validateNetworkLane(lane, path, sink) {
    const out = validateLane(lane, path, BLUEPRINT_V4_NETWORK_MODES, BLUEPRINT_V4_NETWORK_FIELDS_BY_MODE, 'the network lane must be a record with an explicit mode', sink, ['default']);
    const mode = isRec(lane) ? lane['mode'] : undefined;
    if (mode === 'restricted' || mode === 'deny') {
        const def = isRec(lane) ? lane['default'] : undefined;
        if (Object.hasOwn(lane, 'default') && def !== undefined) {
            if (typeof def !== 'string' || !BLUEPRINT_V4_NETWORK_DEFAULTS.includes(def)) {
                sink.push({
                    code: 'unknown-enum',
                    path: `${path}.default`,
                    detail: 'the network default disposition must be one of ask | deny',
                    legalValues: [...BLUEPRINT_V4_NETWORK_DEFAULTS],
                });
            }
            else {
                if (out !== null)
                    out['default'] = def;
            }
        }
    }
    return out;
}
function validateExecution(exec, path, sink) {
    if (!isRec(exec)) {
        sink.push({ code: 'not-a-record', path, detail: 'the execution block must be a record declaring the three-axis axes' });
        return null;
    }
    for (const key of Object.keys(exec)) {
        if (BLUEPRINT_V4_REMOVED_FIELDS.execution.includes(key)) {
            sink.push({ code: 'removed-field', path: `${path}.${key}`, detail: `'${key}' is a REMOVED v2-proposal field: v4 records the three axes (implementationOrigin / executionBoundary / assurance), not kind/adapter/runner (D-05)` });
        }
    }
    const out = {};
    const origin = exec['implementationOrigin'];
    if (!Object.hasOwn(exec, 'implementationOrigin') || origin === undefined) {
        pushMissing(sink, `${path}.implementationOrigin`, 'implementationOrigin');
    }
    else if (typeof origin !== 'string' || !BLUEPRINT_V4_IMPLEMENTATION_ORIGINS.includes(origin)) {
        sink.push({
            code: 'unknown-enum',
            path: `${path}.implementationOrigin`,
            detail: 'implementationOrigin is closed against the frozen governance vocabulary',
            legalValues: [...BLUEPRINT_V4_IMPLEMENTATION_ORIGINS],
        });
    }
    else {
        out['implementationOrigin'] = origin;
    }
    const boundary = exec['executionBoundary'];
    if (!Object.hasOwn(exec, 'executionBoundary') || boundary === undefined) {
        pushMissing(sink, `${path}.executionBoundary`, 'executionBoundary');
    }
    else if (typeof boundary !== 'string' || !BLUEPRINT_V4_EXECUTION_BOUNDARIES.includes(boundary)) {
        sink.push({
            code: 'unknown-enum',
            path: `${path}.executionBoundary`,
            detail: 'executionBoundary is closed against the frozen governance vocabulary',
            legalValues: [...BLUEPRINT_V4_EXECUTION_BOUNDARIES],
        });
    }
    else {
        out['executionBoundary'] = boundary;
    }
    for (const key of Object.keys(exec)) {
        if (key === 'implementationOrigin' || key === 'executionBoundary')
            continue;
        if (BLUEPRINT_V4_REMOVED_FIELDS.execution.includes(key))
            continue;
        sink.push({ code: 'unknown-field', path: `${path}.${key}`, detail: `field '${key}' is outside the closed execution block` });
    }
    return out;
}
/**
 * The ONE closed three-lane I/O block, shared by `toolBindings[].io` and
 * `memberIoCeilings[].io` (Alpha.5 P1-01: reuse, never a second vocabulary).
 * Every lane is REQUIRED and every declared lane is fully explicit (D-03);
 * an unknown lane key is refused at its full path and never dropped.
 */
function validateIoBlock(ioRaw, path, sink) {
    if (!isRec(ioRaw)) {
        sink.push({ code: 'not-a-record', path, detail: 'io must be a record with all three lanes declared' });
        return null;
    }
    for (const key of Object.keys(ioRaw)) {
        if (!BLUEPRINT_V4_IO_FIELDS.includes(key)) {
            sink.push({ code: 'unknown-field', path: `${path}.${key}`, detail: `field '${key}' is outside the closed io shape (read | write | network)` });
        }
    }
    const read = Object.hasOwn(ioRaw, 'read')
        ? validateLane(ioRaw['read'], `${path}.read`, BLUEPRINT_V4_IO_RW_MODES, BLUEPRINT_V4_IO_RW_FIELDS_BY_MODE, 'the read lane must be a record with an explicit mode', sink)
        : (pushMissing(sink, `${path}.read`, 'read'), null);
    const write = Object.hasOwn(ioRaw, 'write')
        ? validateLane(ioRaw['write'], `${path}.write`, BLUEPRINT_V4_IO_RW_MODES, BLUEPRINT_V4_IO_RW_FIELDS_BY_MODE, 'the write lane must be a record with an explicit mode', sink)
        : (pushMissing(sink, `${path}.write`, 'write'), null);
    const network = Object.hasOwn(ioRaw, 'network')
        ? validateNetworkLane(ioRaw['network'], `${path}.network`, sink)
        : (pushMissing(sink, `${path}.network`, 'network'), null);
    if (read === null || write === null || network === null)
        return null;
    return { read, write, network };
}
function validateEntry(entry, path, sink) {
    if (!isRec(entry)) {
        sink.push({ code: 'not-a-record', path, detail: 'a toolBindings entry must be a record' });
        return null;
    }
    for (const key of Object.keys(entry)) {
        if (BLUEPRINT_V4_REMOVED_FIELDS.entry.includes(key)) {
            sink.push({ code: 'removed-field', path: `${path}.${key}`, detail: `'${key}' is a REMOVED v2-proposal field with no v4 successor (D-05)` });
        }
        else if (!BLUEPRINT_V4_TOOL_BINDING_FIELDS.includes(key)) {
            sink.push({ code: 'unknown-field', path: `${path}.${key}`, detail: `field '${key}' is outside the closed toolBindings entry shape` });
        }
    }
    let ok = true;
    const owner = validateNameLike(entry['owner'], `${path}.owner`, sink);
    const name = validateNameLike(entry['name'], `${path}.name`, sink);
    if (owner === null || name === null)
        ok = false;
    let authorization = null;
    const auth = entry['authorization'];
    if (!Object.hasOwn(entry, 'authorization') || auth === undefined) {
        pushMissing(sink, `${path}.authorization`, 'authorization');
    }
    else if (typeof auth !== 'string' || !BLUEPRINT_V4_AUTHORIZATIONS.includes(auth)) {
        sink.push({
            code: 'unknown-enum',
            path: `${path}.authorization`,
            detail: 'authorization is closed and case-sensitive (allow | ask | deny)',
            legalValues: [...BLUEPRINT_V4_AUTHORIZATIONS],
        });
    }
    else {
        authorization = auth;
    }
    let io = null;
    if (!Object.hasOwn(entry, 'io') || entry['io'] === undefined) {
        pushMissing(sink, `${path}.io`, 'io');
    }
    else {
        io = validateIoBlock(entry['io'], `${path}.io`, sink);
        if (io === null)
            ok = false;
    }
    let execution = null;
    if (!Object.hasOwn(entry, 'execution') || entry['execution'] === undefined) {
        pushMissing(sink, `${path}.execution`, 'execution');
    }
    else {
        execution = validateExecution(entry['execution'], `${path}.execution`, sink);
        if (execution === null)
            ok = false;
    }
    if (!ok || owner === null || name === null || authorization === null || io === null || execution === null)
        return null;
    return {
        owner,
        name,
        authorization,
        io: io,
        execution: execution,
    };
}
/** One `memberIoCeilings` entry: a closed templateId reference + the shared io block. */
function validateMemberCeiling(entry, path, templateIds, seen, sink) {
    if (!isRec(entry)) {
        sink.push({ code: 'not-a-record', path, detail: 'a memberIoCeilings entry must be a record' });
        return null;
    }
    for (const key of Object.keys(entry)) {
        if (!BLUEPRINT_V4_MEMBER_CEILING_FIELDS.includes(key)) {
            sink.push({ code: 'unknown-field', path: `${path}.${key}`, detail: `field '${key}' is outside the closed memberIoCeilings entry shape (templateId | io)` });
        }
    }
    let ok = true;
    let templateId = null;
    if (!Object.hasOwn(entry, 'templateId') || entry['templateId'] === undefined) {
        pushMissing(sink, `${path}.templateId`, 'templateId');
        ok = false;
    }
    else {
        templateId = validateNameLike(entry['templateId'], `${path}.templateId`, sink);
        if (templateId === null) {
            ok = false;
        }
        else if (!templateIds.has(templateId)) {
            // Identity is CLOSED over this blueprint's templates (leader included):
            // a ceiling may never name a member the document does not declare, and
            // it may never be inferred from a tool owner or an argv/cwd value.
            sink.push({
                code: 'path-unresolvable',
                path: `${path}.templateId`,
                detail: `templateId '${templateId}' does not resolve to any template of this blueprint (leader template included) — a Member ceiling is bound to a declared template, never a free-form name`,
            });
            ok = false;
        }
        else if (seen.has(templateId)) {
            sink.push({
                code: 'duplicate-member-ceiling',
                path: `${path}.templateId`,
                detail: `templateId '${templateId}' already has a Member ceiling; two ceilings for one member have no single meaning and are never merged by declaration order`,
            });
            ok = false;
        }
        else {
            seen.add(templateId);
        }
    }
    let io = null;
    if (!Object.hasOwn(entry, 'io') || entry['io'] === undefined) {
        pushMissing(sink, `${path}.io`, 'io');
        ok = false;
    }
    else {
        io = validateIoBlock(entry['io'], `${path}.io`, sink);
        if (io === null)
            ok = false;
    }
    if (!ok || templateId === null || io === null)
        return null;
    return { templateId, io: io };
}
/**
 * Validate the `memberIoCeilings` family. The template reference set is the
 * document's OWN closed template set (leader + members), read from the
 * already-validated frozen v3 core — never a free-standing list.
 */
function validateMemberCeilingFamily(familyRaw, core, sink) {
    if (!Array.isArray(familyRaw)) {
        sink.push({ code: 'field-type', path: '$.memberIoCeilings', detail: 'memberIoCeilings must be an array of entries (an absent family declares nothing; an empty array declares nothing — but a non-array is a defect)' });
        return null;
    }
    const templateIds = new Set([core.leader.templateId, ...core.members.map((member) => member.templateId)]);
    const seen = new Set();
    const entries = [];
    familyRaw.forEach((entry, index) => {
        const parsed = validateMemberCeiling(entry, `$.memberIoCeilings[${String(index)}]`, templateIds, seen, sink);
        if (parsed !== null)
            entries.push(parsed);
    });
    return entries;
}
/**
 * Validate a v4 authoring document. The v3 core face is delegated to the
 * FROZEN v3 validator (restamped); `toolBindings` is parsed here. All
 * grammar problems are COLLECTED into one `MALFORMED_DTO` throw whose
 * `details.problems` name every defect at its full path.
 */
export function validateBlueprintV4Document(raw) {
    if (!isRec(raw)) {
        throw teamContractError('MALFORMED_DTO', 'a v4 blueprint document must be a record', { path: '$' });
    }
    if (!Object.hasOwn(raw, 'schemaVersion') || raw['schemaVersion'] === undefined) {
        throw teamContractError('MALFORMED_DTO', "blueprint is missing required field 'schemaVersion' at $", { path: '$.schemaVersion' });
    }
    const version = raw['schemaVersion'];
    if (typeof version !== 'number' || !Number.isInteger(version)) {
        throw teamContractError('SCHEMA_VERSION_UNSUPPORTED', `v4 grammar requires an integer schemaVersion, got ${typeof version}`, { path: '$.schemaVersion' });
    }
    if (version !== BLUEPRINT_V4_SCHEMA_VERSION) {
        throw teamContractError('SCHEMA_VERSION_MISMATCH', `the v4 authoring grammar accepts only ${String(BLUEPRINT_V4_SCHEMA_VERSION)}, got ${String(version)}`, { path: '$.schemaVersion' });
    }
    const hasFamily = Object.hasOwn(raw, BLUEPRINT_V4_TOOL_BINDING_FAMILY) && raw[BLUEPRINT_V4_TOOL_BINDING_FAMILY] !== undefined;
    const hasCeilingFamily = Object.hasOwn(raw, BLUEPRINT_V4_MEMBER_CEILING_FAMILY) && raw[BLUEPRINT_V4_MEMBER_CEILING_FAMILY] !== undefined;
    const rest = { ...raw };
    delete rest[BLUEPRINT_V4_TOOL_BINDING_FAMILY];
    delete rest[BLUEPRINT_V4_MEMBER_CEILING_FAMILY];
    // The delegation: the frozen v3 validator owns every other field — v4
    // adds NO core-face freedom, so the frozen branch stays structurally true.
    const core3 = validateBlueprintDocument({ ...rest, schemaVersion: 3 });
    if (!hasFamily && !hasCeilingFamily) {
        return deepFreeze({ ...core3, schemaVersion: 4 });
    }
    const sink = [];
    let bindings;
    let ceilings;
    if (hasFamily) {
        const familyRaw = raw[BLUEPRINT_V4_TOOL_BINDING_FAMILY];
        if (!Array.isArray(familyRaw)) {
            sink.push({ code: 'field-type', path: '$.toolBindings', detail: 'toolBindings must be an array of entries (an absent family declares nothing; an empty array declares nothing — but a non-array is a defect)' });
        }
        else {
            bindings = [];
            familyRaw.forEach((entry, index) => {
                const parsed = validateEntry(entry, `$.toolBindings[${String(index)}]`, sink);
                if (parsed !== null)
                    bindings.push(parsed);
            });
        }
    }
    if (hasCeilingFamily) {
        const parsedFamily = validateMemberCeilingFamily(raw[BLUEPRINT_V4_MEMBER_CEILING_FAMILY], core3, sink);
        if (parsedFamily !== null)
            ceilings = parsedFamily;
    }
    if (sink.length === 0) {
        return deepFreeze({
            ...core3,
            schemaVersion: 4,
            ...(bindings === undefined ? {} : { toolBindings: bindings }),
            ...(ceilings === undefined ? {} : { memberIoCeilings: ceilings }),
        });
    }
    throw teamContractError('MALFORMED_DTO', 'the v4 effect-governance families were refused; every problem is listed at its full path', {
        problems: sink.map((p) => ({ code: p.code, path: p.path, detail: p.detail, ...(p.legalValues === undefined ? {} : { legalValues: [...p.legalValues] }) })),
    });
}
/** The hashable projection: the frozen v3 projection (restamped) plus the declared family. */
export function toHashableBlueprintV4(core) {
    const { schemaVersion: _v4, toolBindings, memberIoCeilings, ...rest } = core;
    const hashable3 = toHashableBlueprint({ ...rest, schemaVersion: 3 });
    return {
        ...hashable3,
        schemaVersion: BLUEPRINT_V4_SCHEMA_VERSION,
        ...(toolBindings !== undefined ? { toolBindings: JSON.parse(JSON.stringify(toolBindings)) } : {}),
        ...(memberIoCeilings !== undefined ? { memberIoCeilings: JSON.parse(JSON.stringify(memberIoCeilings)) } : {}),
    };
}
/**
 * Look up the Member ceiling of one template, or `null` when the document
 * declares none.  `null` is the ONLY honest answer for an undeclared
 * ceiling: callers must fail closed, never synthesize `read: all`.
 */
export function findMemberIoCeiling(core, templateId) {
    for (const entry of core.memberIoCeilings ?? []) {
        if (entry.templateId === templateId)
            return entry;
    }
    return null;
}
/** Source pipeline mirror of `parseBlueprint` for the v4 grammar (dormant). */
export function parseBlueprintV4(source) {
    const doc = splitFrontmatter(source);
    const raw = decodeYamlFrontmatter(doc.frontmatterText);
    const core = validateBlueprintV4Document(raw);
    const contentHash = deriveContentHash(toHashableBlueprintV4(core));
    return deepFreeze({ ...core, contentHash });
}
//# sourceMappingURL=blueprint-v4.js.map