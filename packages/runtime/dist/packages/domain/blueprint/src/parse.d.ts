/**
 * Blueprint source document parsing: frontmatter split + YAML decode.
 *
 * The frontmatter MECHANISM (a document that opens with a `---` line, whose
 * YAML frontmatter runs to the next `---` line, followed by a body) is
 * borrowed algorithmically from the legacy team-local parser (Development
 * Plan §4.3: "parser mechanics → candidate MIGRATE/REFACTOR"). The PRODUCT
 * OBJECT is vNext: one document is one complete TeamBlueprint, not one
 * legacy TeamMemberDefinition.
 *
 * Two vNext hardening rules beyond the legacy mechanism:
 *
 * 1. The markdown body MUST be empty (after trimming). The legacy body was
 *    the single member's persona; a vNext blueprint is a closed structured
 *    document where every persona is a structured field. Freeform body prose
 *    is legacy vocabulary and fails loudly.
 * 2. The YAML decode is delegated to the standard `yaml` parser (an allowed
 *    dependency), which throws on syntax errors and duplicate mapping keys;
 *    both are converted to `MALFORMED_DTO` with the offending source
 *    location when the parser reports one.
 *
 * This module does NO schema validation — that is validate.ts. It only
 * produces the raw decoded frontmatter value.
 *
 * Pure module: no I/O (the source text is passed in), no live Agent.
 * @module @dsh-agent-team/domain/blueprint/parse
 */
import type { ParsedBlueprintDocument } from './types.js';
/**
 * Split a blueprint source document into its YAML frontmatter and markdown
 * body.
 *
 * Rules (fail loudly, no partial results):
 * - a leading UTF-8 BOM is stripped;
 * - line endings are normalized to `\n`;
 * - the first line must be exactly `---`;
 * - a later line must be exactly `---` (the closing delimiter);
 * - the body after the closing delimiter must be empty after trimming
 *   (vNext blueprints carry no freeform prose section).
 *
 * @param source - the raw UTF-8 blueprint document text.
 * @returns the split document (frontmatter text + empty body).
 * @throws `MALFORMED_DTO` with a `reason` detail for every structural
 *   violation.
 */
export declare function splitFrontmatter(source: string): ParsedBlueprintDocument;
/**
 * Decode the YAML frontmatter text into a raw unknown value.
 *
 * @param frontmatterText - the text between the `---` delimiters.
 * @returns the decoded value (the caller validates its shape).
 * @throws `MALFORMED_DTO` when the YAML is syntactically invalid, has
 *   duplicate keys, or is not a single document.
 */
export declare function decodeYamlFrontmatter(frontmatterText: string): unknown;
//# sourceMappingURL=parse.d.ts.map