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
/**
 * The minimal identity of a blueprint source document (plan §5): the
 * three fields that identify one immutable revision of one blueprint —
 * enough to index it, deduplicate it, and address it in a snapshot ref
 * (the ref's `contentHash` is only knowable after a STRONG parse).
 */
export interface BlueprintSourceIdentity {
    /** The document's declared schema version (a supported positive integer). */
    readonly schemaVersion: number;
    /** The parsed (grammar-valid) blueprint id. */
    readonly blueprintId: string;
    /** The parsed (grammar-valid) revision. */
    readonly revision: string;
}
/**
 * One closed diagnostic of an unusable source (the `reason` is a closed
 * machine set; the `message` carries the parser's verbatim wording and,
 * for a YAML failure, the offending line).
 */
export interface BlueprintInspectionDiagnostic {
    /**
     * Closed reason set: `frontmatter-missing` / `frontmatter-unclosed` /
     * `markdown-body-not-allowed` / `yaml-invalid` (the four structural
     * reasons splitFrontmatter/decodeYamlFrontmatter already emit) +
     * `not-a-plain-record` / `schemaVersion-missing` /
     * `schemaVersion-unsupported` / `blueprintId-invalid` /
     * `revision-invalid` (the identity-level checks).
     */
    readonly reason: string;
    /** The parser's verbatim message (human-readable; never branch on it). */
    readonly message: string;
}
/** The total inspection outcome (never throws for content issues). */
export type BlueprintInspectionResult = {
    readonly status: 'ok';
    readonly identity: BlueprintSourceIdentity;
} | {
    readonly status: 'rejected';
    readonly diagnostics: readonly BlueprintInspectionDiagnostic[];
};
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
export declare function inspectBlueprintSource(source: string): BlueprintInspectionResult;
//# sourceMappingURL=inspect.d.ts.map