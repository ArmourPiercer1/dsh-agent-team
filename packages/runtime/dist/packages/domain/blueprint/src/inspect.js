/**
 * Blueprint SOURCE inspection: the IDENTITY-LEVEL read of a saved blueprint
 * document, deliberately WEAKER than the strong parser.
 *
 * Why this exists (issue #2 blueprint-loading parallel repair, plan BP1):
 * the host's saved-source index must list a DIRECTORY of blueprints
 * without making the whole catalog hostage to one logically broken file.
 * `parseBlueprint()` (validate.ts) is the strong all-or-nothing
 * validation entry and STAYS the only strong entry — a directory scan
 * must NOT strong-parse every source (plan §7.4: one logically invalid
 * saved Blueprint must not take down the catalog). The inspector answers
 * exactly one question: "does this document carry a well-formed blueprint
 * IDENTITY — `{ schemaVersion, blueprintId, revision }`?"
 *
 * The inspection pipeline is the FIRST TWO stages of `parseBlueprint`
 * (splitFrontmatter → decodeYamlFrontmatter — the same functions, the
 * same fail-loud structural rules: BOM strip, CRLF normalization, the
 * `---` delimiters, the empty-body rule, the YAML decode with location)
 * plus the identity field checks:
 *
 *   - the decoded frontmatter is a single plain record;
 *   - `schemaVersion` is present, a positive integer, and SUPPORTED
 *     (`SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS` — the same closed set the
 *     strong validator enforces);
 *   - `blueprintId` parses (contracts `parseBlueprintId` — the same
 *     grammar the strong validator uses);
 *   - `revision` parses (contracts `parseBlueprintRevision`).
 *
 * What the inspector NEVER checks (the strong parser's territory, kept
 * intact — plan §5 "不要检查"): template reference closure,
 * member/template duplicate semantics, requirement conflicts, capability
 * compatibility, mutation envelope conflicts, quota relations, permission
 * rule logic. A document can be `ok` here and still be rejected by
 * `parseBlueprint()` — that split is the point (the catalog lists it;
 * resolving it fails closed with the strong parser's exact diagnosis).
 *
 * The result is TOTAL over content: every content-level violation is a
 * classified `rejected` outcome (a closed `reason` set + the parser's
 * verbatim message — the line location when the YAML decode reports
 * one), never a throw. The only throw is the programming-error case the
 * strong split already owns (a non-string source).
 *
 * Pure module: no I/O (the source text is passed in), no `node:`
 * builtins, no live Agent — only contracts v1 + the sibling parse module.
 * @module @dsh-agent-team/domain/blueprint/inspect
 */
import { isTeamContractError, parseBlueprintId, parseBlueprintRevision, } from '../../../contracts/src/index.js';
import { decodeYamlFrontmatter, splitFrontmatter } from './parse.js';
import { SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS } from './schema.js';
/** True for a single plain record (neither null, nor an array, an object). */
function isPlainRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
/**
 * Inspect one blueprint source document at the IDENTITY level.
 *
 * @param source - the raw UTF-8 blueprint document text.
 * @returns `ok` + the minimal identity when the document is a well-formed
 *   blueprint identity (regardless of its deeper semantics), or `rejected`
 *   with the closed diagnostics when it is not indexable at all.
 * @throws `MALFORMED_DTO` ONLY for a non-string source (the programming-
 *   error case the strong split already owns).
 */
export function inspectBlueprintSource(source) {
    // Stage 1-2: the strong parser's own structural stages (same rules,
    // same verbatim messages, same reasons — the strong parser is NOT
    // weakened: this module reuses its functions).
    let doc;
    try {
        doc = splitFrontmatter(source);
    }
    catch (err) {
        return { status: 'rejected', diagnostics: [diagnosticOf(err, 'structure-invalid')] };
    }
    let raw;
    try {
        raw = decodeYamlFrontmatter(doc.frontmatterText);
    }
    catch (err) {
        return { status: 'rejected', diagnostics: [diagnosticOf(err, 'yaml-invalid')] };
    }
    // Identity level only — the strong parser's whole-document validation
    // deliberately does NOT run here (plan §7.4: no whole-catalog strong
    // parse; a logically broken saved source must not break the catalog).
    if (!isPlainRecord(raw)) {
        return {
            status: 'rejected',
            diagnostics: [
                {
                    reason: 'not-a-plain-record',
                    message: 'blueprint frontmatter must decode to a single plain record',
                },
            ],
        };
    }
    const schemaVersionRaw = raw.schemaVersion;
    if (schemaVersionRaw === undefined) {
        return {
            status: 'rejected',
            diagnostics: [
                { reason: 'schemaVersion-missing', message: 'blueprint schemaVersion is missing' },
            ],
        };
    }
    if (typeof schemaVersionRaw !== 'number' ||
        !Number.isInteger(schemaVersionRaw) ||
        schemaVersionRaw < 1) {
        return {
            status: 'rejected',
            diagnostics: [
                {
                    reason: 'schemaVersion-unsupported',
                    message: `blueprint schemaVersion must be a positive integer, got ${JSON.stringify(schemaVersionRaw)}`,
                },
            ],
        };
    }
    if (!SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS.includes(schemaVersionRaw)) {
        return {
            status: 'rejected',
            diagnostics: [
                {
                    reason: 'schemaVersion-unsupported',
                    message: `unsupported blueprint schema version ${schemaVersionRaw}; this build supports [${SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS.join(', ')}]`,
                },
            ],
        };
    }
    let blueprintId;
    try {
        blueprintId = parseBlueprintId(raw.blueprintId);
    }
    catch (err) {
        return {
            status: 'rejected',
            diagnostics: [diagnosticOf(err, 'blueprintId-invalid')],
        };
    }
    let revision;
    try {
        revision = parseBlueprintRevision(raw.revision);
    }
    catch (err) {
        return {
            status: 'rejected',
            diagnostics: [diagnosticOf(err, 'revision-invalid')],
        };
    }
    return {
        status: 'ok',
        identity: {
            schemaVersion: schemaVersionRaw,
            blueprintId: String(blueprintId),
            revision: String(revision),
        },
    };
}
/**
 * Lift a thrown rejection into a closed diagnostic: the contracts
 * `TeamContractError`'s `details.reason` wins (the parser's own closed
 * reason), the error message is kept verbatim, and `fallbackReason`
 * covers the non-contract throw (defensive: both parsers only throw
 * `TeamContractError`).
 */
function diagnosticOf(err, fallbackReason) {
    if (isTeamContractError(err)) {
        const reason = err.details?.reason;
        return {
            reason: typeof reason === 'string' && reason.length > 0 ? reason : fallbackReason,
            message: err.message,
        };
    }
    return {
        reason: fallbackReason,
        message: err instanceof Error ? err.message : String(err),
    };
}
//# sourceMappingURL=inspect.js.map