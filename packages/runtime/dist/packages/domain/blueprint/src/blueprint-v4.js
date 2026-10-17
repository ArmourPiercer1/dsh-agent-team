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
/** The closed v4 top-level key set: the frozen v3 table plus the ONE family. */
export const BLUEPRINT_V4_TOP_LEVEL_FIELDS = Object.freeze([
    ...BLUEPRINT_TOP_LEVEL_FIELDS_V3,
    BLUEPRINT_V4_TOOL_BINDING_FAMILY,
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
    else if (!isRec(entry['io'])) {
        sink.push({ code: 'not-a-record', path: `${path}.io`, detail: 'io must be a record with all three lanes declared' });
    }
    else {
        io = {};
        for (const key of Object.keys(entry['io'])) {
            if (!BLUEPRINT_V4_IO_FIELDS.includes(key)) {
                sink.push({ code: 'unknown-field', path: `${path}.io.${key}`, detail: `field '${key}' is outside the closed io shape (read | write | network)` });
            }
        }
        const read = Object.hasOwn(entry['io'], 'read')
            ? validateLane(entry['io']['read'], `${path}.io.read`, BLUEPRINT_V4_IO_RW_MODES, BLUEPRINT_V4_IO_RW_FIELDS_BY_MODE, 'the read lane must be a record with an explicit mode', sink)
            : (pushMissing(sink, `${path}.io.read`, 'read'), null);
        const write = Object.hasOwn(entry['io'], 'write')
            ? validateLane(entry['io']['write'], `${path}.io.write`, BLUEPRINT_V4_IO_RW_MODES, BLUEPRINT_V4_IO_RW_FIELDS_BY_MODE, 'the write lane must be a record with an explicit mode', sink)
            : (pushMissing(sink, `${path}.io.write`, 'write'), null);
        const network = Object.hasOwn(entry['io'], 'network')
            ? validateNetworkLane(entry['io']['network'], `${path}.io.network`, sink)
            : (pushMissing(sink, `${path}.io.network`, 'network'), null);
        if (read !== null)
            io['read'] = read;
        if (write !== null)
            io['write'] = write;
        if (network !== null)
            io['network'] = network;
        if (read === null || write === null || network === null)
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
    const rest = { ...raw };
    delete rest[BLUEPRINT_V4_TOOL_BINDING_FAMILY];
    // The delegation: the frozen v3 validator owns every other field — v4
    // adds NO core-face freedom, so the frozen branch stays structurally true.
    const core3 = validateBlueprintDocument({ ...rest, schemaVersion: 3 });
    if (!hasFamily) {
        return deepFreeze({ ...core3, schemaVersion: 4 });
    }
    const familyRaw = raw[BLUEPRINT_V4_TOOL_BINDING_FAMILY];
    const sink = [];
    if (!Array.isArray(familyRaw)) {
        sink.push({ code: 'field-type', path: '$.toolBindings', detail: 'toolBindings must be an array of entries (an absent family declares nothing; an empty array declares nothing — but a non-array is a defect)' });
    }
    else {
        const entries = [];
        familyRaw.forEach((entry, index) => {
            const parsed = validateEntry(entry, `$.toolBindings[${String(index)}]`, sink);
            if (parsed !== null)
                entries.push(parsed);
        });
        if (sink.length === 0) {
            return deepFreeze({ ...core3, schemaVersion: 4, toolBindings: entries });
        }
    }
    throw teamContractError('MALFORMED_DTO', 'the v4 toolBindings family was refused; every problem is listed at its full path', {
        problems: sink.map((p) => ({ code: p.code, path: p.path, detail: p.detail, ...(p.legalValues === undefined ? {} : { legalValues: [...p.legalValues] }) })),
    });
}
/** The hashable projection: the frozen v3 projection (restamped) plus the declared family. */
export function toHashableBlueprintV4(core) {
    const { schemaVersion: _v4, toolBindings, ...rest } = core;
    const hashable3 = toHashableBlueprint({ ...rest, schemaVersion: 3 });
    return {
        ...hashable3,
        schemaVersion: BLUEPRINT_V4_SCHEMA_VERSION,
        ...(toolBindings !== undefined ? { toolBindings: JSON.parse(JSON.stringify(toolBindings)) } : {}),
    };
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