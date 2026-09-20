/**
 * Strict-read + Core-spill — the `artifact-read-granted` fact family
 * (D4): the durable-entry builder (writer side) and the strict parser
 * (reader side) for the EXISTING TeamLedger (no new store, no schema
 * bump — a new factType string is the sanctioned family mechanism).
 *
 * Both directions are PURE and DETERMINISTIC (the activity-fact
 * convention): the builder always emits the closed payload shape, and
 * the parser re-validates every field against the SAME bounds the
 * writer enforced, so a corrupted or foreign row can never poison the
 * cold-restart rebuild — it is simply skipped.
 *
 * The payload never carries a raw fs token or a raw path in any
 * decision-relevant position: the identity travels as the two
 * domain-separated digests, the model-visible locator as an exact
 * string (the grant's own binding, re-checked verbatim at use).
 *
 * Pure module: no I/O.
 * @module @dsh-agent-team/runtime/artifact-read/fact
 */
import { isDigest } from './digest.js';
/** The closed factType of the grant family. */
export const ARTIFACT_READ_GRANTED_FACT_TYPE = 'artifact-read-granted';
/** The fact-family payload version (self-describing; writer + reader agree). */
export const ARTIFACT_READ_PAYLOAD_VERSION = 1;
// --- payload field bounds (writer and reader enforce the SAME values) ----------
/** Max length of the producing instanceId (contract: `inst-` + 32 = 37; headroom). */
export const ARTIFACT_INSTANCE_ID_MAX_LENGTH = 64;
/** Max length of the model-visible locator (spilled paths are long; 2 KiB ceiling). */
export const ARTIFACT_LOCATOR_MAX_LENGTH = 2048;
/** Max length of a structured source field (tool name / call id / label). */
export const ARTIFACT_SOURCE_FIELD_MAX_LENGTH = 256;
/** Max length of a structured source session id. */
export const ARTIFACT_SOURCE_SESSION_ID_MAX_LENGTH = 255;
/** The closed stream values of a shell-source grant. */
export const ARTIFACT_SHELL_STREAMS = ['stdout', 'stderr'];
// --- strict field predicates (shared by the parser) ----------------------------
function isBoundedString(value, max) {
    return typeof value === 'string' && value.length >= 1 && value.length <= max;
}
/** Parse the closed `ArtifactSource` payload shape (strict; undefined when malformed). */
function parseSource(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
        return undefined;
    const rec = value;
    const kind = rec['kind'];
    if (kind === 'spill-store') {
        const keys = Object.keys(rec).sort();
        if (keys.length !== 2 || keys[0] !== 'kind' || keys[1] !== 'spillSource')
            return undefined;
        const spill = rec['spillSource'];
        if (spill === null || typeof spill !== 'object' || Array.isArray(spill))
            return undefined;
        const s = spill;
        if (s['kind'] === 'tool') {
            const sKeys = Object.keys(s).sort();
            if (sKeys.length !== 4 ||
                sKeys[0] !== 'callId' ||
                sKeys[1] !== 'kind' ||
                sKeys[2] !== 'label' ||
                sKeys[3] !== 'toolName')
                return undefined;
            if (!isBoundedString(s['toolName'], ARTIFACT_SOURCE_FIELD_MAX_LENGTH))
                return undefined;
            if (!isBoundedString(s['callId'], ARTIFACT_SOURCE_FIELD_MAX_LENGTH))
                return undefined;
            if (!isBoundedString(s['label'], ARTIFACT_SOURCE_FIELD_MAX_LENGTH))
                return undefined;
            return {
                kind: 'spill-store',
                spillSource: {
                    kind: 'tool',
                    toolName: s['toolName'],
                    callId: s['callId'],
                    label: s['label'],
                },
            };
        }
        if (s['kind'] === 'session-reference') {
            const sKeys = Object.keys(s).sort();
            if (sKeys.length !== 3 ||
                sKeys[0] !== 'kind' ||
                sKeys[1] !== 'label' ||
                sKeys[2] !== 'sessionId')
                return undefined;
            if (!isBoundedString(s['sessionId'], ARTIFACT_SOURCE_SESSION_ID_MAX_LENGTH))
                return undefined;
            if (!isBoundedString(s['label'], ARTIFACT_SOURCE_FIELD_MAX_LENGTH))
                return undefined;
            return {
                kind: 'spill-store',
                spillSource: {
                    kind: 'session-reference',
                    sessionId: s['sessionId'],
                    label: s['label'],
                },
            };
        }
        return undefined;
    }
    if (kind === 'shell-foreground') {
        const keys = Object.keys(rec).sort();
        if (keys.length !== 4 ||
            keys[0] !== 'callId' ||
            keys[1] !== 'kind' ||
            keys[2] !== 'stream' ||
            keys[3] !== 'toolName')
            return undefined;
        if (!isBoundedString(rec['toolName'], ARTIFACT_SOURCE_FIELD_MAX_LENGTH))
            return undefined;
        if (!isBoundedString(rec['callId'], ARTIFACT_SOURCE_FIELD_MAX_LENGTH))
            return undefined;
        if (!ARTIFACT_SHELL_STREAMS.includes(rec['stream']))
            return undefined;
        return {
            kind: 'shell-foreground',
            toolName: rec['toolName'],
            callId: rec['callId'],
            stream: rec['stream'],
        };
    }
    if (kind === 'shell-background') {
        const keys = Object.keys(rec).sort();
        if (keys.length !== 4 ||
            keys[0] !== 'jobId' ||
            keys[1] !== 'kind' ||
            keys[2] !== 'stream' ||
            keys[3] !== 'toolName')
            return undefined;
        if (!isBoundedString(rec['toolName'], ARTIFACT_SOURCE_FIELD_MAX_LENGTH))
            return undefined;
        if (!isBoundedString(rec['jobId'], ARTIFACT_SOURCE_FIELD_MAX_LENGTH))
            return undefined;
        if (!ARTIFACT_SHELL_STREAMS.includes(rec['stream']))
            return undefined;
        return {
            kind: 'shell-background',
            toolName: rec['toolName'],
            jobId: rec['jobId'],
            stream: rec['stream'],
        };
    }
    return undefined;
}
/** Encode the closed `ArtifactSource` into its lossless-JSON payload shape. */
export function encodeArtifactSource(source) {
    if (source.kind === 'spill-store') {
        const spill = source.spillSource;
        return {
            kind: 'spill-store',
            spillSource: spill.kind === 'tool'
                ? { kind: 'tool', toolName: spill.toolName, callId: spill.callId, label: spill.label }
                : { kind: 'session-reference', sessionId: spill.sessionId, label: spill.label },
        };
    }
    if (source.kind === 'shell-foreground') {
        return { kind: 'shell-foreground', toolName: source.toolName, callId: source.callId, stream: source.stream };
    }
    return { kind: 'shell-background', toolName: source.toolName, jobId: source.jobId, stream: source.stream };
}
/**
 * Build the closed payload of one `artifact-read-granted` fact.
 *
 * @param input - the validated build input.
 * @returns the lossless-JSON payload ready to wrap in a `LedgerEntry`.
 */
export function buildArtifactReadGrantedPayload(input) {
    return {
        schemaVersion: ARTIFACT_READ_PAYLOAD_VERSION,
        instanceId: input.instanceId,
        locator: input.locator,
        targetKeyDigest: input.targetKeyDigest,
        versionDigest: input.versionDigest,
        source: encodeArtifactSource(input.source),
    };
}
// --- the strict parser (reader side) -------------------------------------------
/**
 * Type guard: the entry's factType is the grant family.
 * @param factType - the entry's factType discriminator.
 */
export function isArtifactReadGrantedFact(factType) {
    return factType === ARTIFACT_READ_GRANTED_FACT_TYPE;
}
/**
 * Parse ONE durable ledger entry into a grant (or `undefined` when the
 * entry is not a well-formed grant fact).
 *
 * Fail-safe: every field is re-validated (closed shapes, exact bounds,
 * digest format, payload version). A corrupted or foreign row is
 * skipped, never guessed. `rootSessionId` comes from the ENTRY (the
 * ledger owns it), not the payload.
 *
 * @param entry - the durable ledger entry (the repository's row shape).
 * @returns the parsed grant, or `undefined` for non-grant/corrupt rows.
 */
export function parseArtifactReadGranted(entry) {
    if (!isArtifactReadGrantedFact(entry.factType))
        return undefined;
    const p = entry.payload;
    if (p === null || typeof p !== 'object' || Array.isArray(p))
        return undefined;
    const rec = p;
    if (rec['schemaVersion'] !== ARTIFACT_READ_PAYLOAD_VERSION)
        return undefined;
    const keys = Object.keys(rec).sort();
    if (keys.length !== 6 ||
        keys[0] !== 'instanceId' ||
        keys[1] !== 'locator' ||
        keys[2] !== 'schemaVersion' ||
        keys[3] !== 'source' ||
        keys[4] !== 'targetKeyDigest' ||
        keys[5] !== 'versionDigest')
        return undefined;
    if (!isBoundedString(rec['instanceId'], ARTIFACT_INSTANCE_ID_MAX_LENGTH))
        return undefined;
    if (!isBoundedString(rec['locator'], ARTIFACT_LOCATOR_MAX_LENGTH))
        return undefined;
    if (!isDigest(rec['targetKeyDigest']))
        return undefined;
    if (!isDigest(rec['versionDigest']))
        return undefined;
    const source = parseSource(rec['source']);
    if (source === undefined)
        return undefined;
    return {
        rootSessionId: entry.rootSessionId,
        instanceId: rec['instanceId'],
        locator: rec['locator'],
        targetKeyDigest: rec['targetKeyDigest'],
        versionDigest: rec['versionDigest'],
        source,
    };
}
//# sourceMappingURL=fact.js.map