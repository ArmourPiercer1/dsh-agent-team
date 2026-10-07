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
 * one), never a throw — and that includes a non-string source, which the strong
 * split would reject: `readDeclaredVersion` catches it and classifies it, so no
 * entry point here documents a `@throws`.
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
/** The total inspection outcome (never throws for content issues).
 *
 * THREE states, because a directory scan can learn three different facts about a
 * saved source (A4-PR7 Task 7.1, ADR A1-21):
 *
 *  - `ok` — a well-formed identity on a version this build RUNS;
 *  - `migration-required` — a well-formed identity on a version this build
 *    DEFINED and no longer runs (`RETIRED_BLUEPRINT_DOCUMENT_VERSIONS`). The
 *    document is the operator's, its identity is readable, and the only fact
 *    missing is the migration. It therefore STAYS on the listing surface: the
 *    whole reason the state exists is that "migrate everything that is left" is
 *    a runbook an operator can only write when what is left is VISIBLE;
 *  - `rejected` — no identity is owed. Bad YAML, a missing id, an invalid
 *    revision, or a version nobody ever defined all say the same thing: there is
 *    nothing to list and nothing to migrate.
 *
 * `migration-required` is not a softer `rejected`, and `rejected` is not a
 * `migration-required` with the fields hidden. Collapsing the first into the
 * second is the bug this state closes (an unmigrated Blueprint that vanishes
 * from `listIdentities` cannot be migrated); collapsing the second into the
 * first would put an unparseable file on a migration surface.
 */
export type BlueprintInspectionResult = {
    readonly status: 'ok';
    readonly identity: BlueprintSourceIdentity;
} | {
    readonly status: 'migration-required';
    readonly identity: BlueprintSourceIdentity;
} | {
    readonly status: 'rejected';
    readonly diagnostics: readonly BlueprintInspectionDiagnostic[];
};
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
 *   be read. A non-string source is classified like any other unreadable input
 *   and returns `undefined`; this function documents no `@throws`.
 */
export declare function declaredBlueprintSchemaVersion(source: string): number | undefined;
/**
 * Inspect one blueprint source document at the IDENTITY level.
 *
 * @param source - the raw UTF-8 blueprint document text.
 * @returns `ok` + the minimal identity when the document is a well-formed
 *   blueprint identity (regardless of its deeper semantics), or `rejected`
 *   with the closed diagnostics when it is not indexable at all. A non-string
 *   source is one of those classified rejections, not a throw; this function
 *   documents no `@throws`.
 */
export declare function inspectBlueprintSource(source: string): BlueprintInspectionResult;
//# sourceMappingURL=inspect.d.ts.map