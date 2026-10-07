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
 *   - `schemaVersion` is present and a positive integer;
 *   - `blueprintId` parses (contracts `parseBlueprintId` — the same
 *     grammar the strong validator uses);
 *   - `revision` parses (contracts `parseBlueprintRevision`);
 *   - ONLY THEN the version is classified: a version in
 *     `SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS` is `ok`, a version in
 *     `RETIRED_BLUEPRINT_DOCUMENT_VERSIONS` (defined once, no longer run) is
 *     `migration-required` AND CARRIES THE IDENTITY PARSED ABOVE, and anything
 *     else is `rejected`. The order is not cosmetic — see the comment at that
 *     check.
 *
 * What the inspector NEVER checks (the strong parser's territory, kept
 * intact — plan §5 "不要检查"): template reference closure,
 * member/template duplicate semantics, requirement conflicts, capability
 * compatibility, mutation envelope conflicts, quota relations, permission
 * rule logic. A document can be `ok` here and still be rejected by
 * `parseBlueprint()` — that split is the point (the catalog lists it;
 * resolving it fails closed with the strong parser's exact diagnosis).
 *
 * The structural + `schemaVersion` stages are ONE read (`readDeclaredVersion`)
 * shared by two entry points: `inspectBlueprintSource` (identity + the three-
 * state version verdict) and `declaredBlueprintSchemaVersion` (the narrower
 * "what version does this document SAY" question, for a caller that must report
 * a document it will not name — a frozen registry row's stored text). One read,
 * two questions: a second chain that reads the version differently is how two
 * surfaces start disagreeing about one document.
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
import { RETIRED_BLUEPRINT_DOCUMENT_VERSIONS, SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS, } from './schema.js';
/** True for a single plain record (neither null, nor an array, an object). */
function isPlainRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
/**
 * THE ONE READ of the version a blueprint document DECLARES: the strong
 * parser's own structural stages (`splitFrontmatter` → `decodeYamlFrontmatter`,
 * same rules, same verbatim messages, same reasons — the strong parser is NOT
 * weakened: this module reuses its functions), the plain-record rule, then the
 * `schemaVersion` field rule (present, positive integer).
 *
 * One implementation, TWO questions asked of it: {@link inspectBlueprintSource}
 * turns a failed read into closed diagnostics, and
 * {@link declaredBlueprintSchemaVersion} answers the narrower operator question
 * "what version does this document say it is?". A second copy of this chain is
 * how a version would end up being read differently in two places — which is the
 * defect class F1 is about (a number answering two questions).
 *
 * Nothing else is checked: no identity fields, no version classification, and
 * deliberately no whole-document validation (plan §7.4: a logically broken
 * source must not break a catalog).
 */
function readDeclaredVersion(source) {
    let doc;
    try {
        doc = splitFrontmatter(source);
    }
    catch (err) {
        return { ok: false, diagnostic: diagnosticOf(err, 'structure-invalid') };
    }
    let raw;
    try {
        raw = decodeYamlFrontmatter(doc.frontmatterText);
    }
    catch (err) {
        return { ok: false, diagnostic: diagnosticOf(err, 'yaml-invalid') };
    }
    // Identity level only — the strong parser's whole-document validation
    // deliberately does NOT run here (plan §7.4: no whole-catalog strong
    // parse; a logically broken saved source must not break the catalog).
    if (!isPlainRecord(raw)) {
        return {
            ok: false,
            diagnostic: {
                reason: 'not-a-plain-record',
                message: 'blueprint frontmatter must decode to a single plain record',
            },
        };
    }
    // The `schemaVersion` field rule: present, and a positive integer.
    const schemaVersionRaw = raw['schemaVersion'];
    if (schemaVersionRaw === undefined) {
        return {
            ok: false,
            diagnostic: {
                reason: 'schemaVersion-missing',
                message: 'blueprint schemaVersion is missing',
            },
        };
    }
    if (typeof schemaVersionRaw !== 'number' ||
        !Number.isInteger(schemaVersionRaw) ||
        schemaVersionRaw < 1) {
        return {
            ok: false,
            diagnostic: {
                reason: 'schemaVersion-unsupported',
                message: `blueprint schemaVersion must be a positive integer, got ${JSON.stringify(schemaVersionRaw)}`,
            },
        };
    }
    return { ok: true, schemaVersion: schemaVersionRaw, frontmatter: raw };
}
/**
 * The version a blueprint document DECLARES, read at identity level — or
 * `undefined` when the document is not readable enough to declare one (no
 * frontmatter, undecodable YAML, a non-record frontmatter, a missing or
 * non-integer `schemaVersion`).
 *
 * This is the ONLY lawful way to learn a Blueprint's document version from
 * bytes that are not being strong-parsed, and it exists because the alternative
 * is worse: a caller that needs the number and has no honest source for it
 * reaches for whatever number is lying next to the identity — which is precisely
 * how a storage row's L3 stamp came to be rendered as a document version (finding
 * F1). Note what this function does NOT say: it does not say the version is
 * runnable (`SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS`), retired
 * (`RETIRED_BLUEPRINT_DOCUMENT_VERSIONS`), or that the document is valid. A
 * declared version nobody defined is still a declared version — the operator
 * needs exactly that number to see WHICH version the catalog refused.
 *
 * @param source - the raw UTF-8 blueprint document text.
 * @returns the declared positive integer version, or `undefined` when none can
 *   be read.
 * @throws `MALFORMED_DTO` ONLY for a non-string source (the programming-error
 *   case the strong split already owns).
 */
export function declaredBlueprintSchemaVersion(source) {
    const read = readDeclaredVersion(source);
    return read.ok ? read.schemaVersion : undefined;
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
    const declared = readDeclaredVersion(source);
    if (!declared.ok) {
        return { status: 'rejected', diagnostics: [declared.diagnostic] };
    }
    const schemaVersionRaw = declared.schemaVersion;
    const raw = declared.frontmatter;
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
    const identity = {
        schemaVersion: schemaVersionRaw,
        blueprintId: String(blueprintId),
        revision: String(revision),
    };
    // The version question is asked LAST, and that order is the whole of Task 7.1.
    // Answering it first — which is how this function used to read — means a
    // document on a retired version never reaches the identity checks, so it comes
    // back `rejected` and the catalog drops it: the one Blueprint the operator
    // still has to migrate is precisely the one the migration runbook cannot see.
    // Reading the identity first costs nothing (two contracts parsers over two
    // scalars) and buys the difference between "unreadable" and "not yet
    // migrated" — the difference between a file and a task.
    if (!SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS.includes(schemaVersionRaw)) {
        if (RETIRED_BLUEPRINT_DOCUMENT_VERSIONS.includes(schemaVersionRaw)) {
            return { status: 'migration-required', identity };
        }
        // A version this product never defined. There is no migration for a document
        // whose shape nobody knows, so this stays a refusal to identify it — and it
        // is the refusal the plugin layer names `BLUEPRINT_SCHEMA_VERSION_UNSUPPORTED`,
        // never `BLUEPRINT_MIGRATION_REQUIRED` (ADR A1-21: a document the reader
        // cannot parse and a document it will not run ask the operator for different
        // actions).
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
    return { status: 'ok', identity };
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