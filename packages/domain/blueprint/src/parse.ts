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

// `yaml` (v2) ships a CommonJS entry under NodeNext type stripping; Node's
// CJS named-export detection only surfaces part of `module.exports`, so
// bind through the default import, which is the full `module.exports`
// object. yaml v2 has no `YAMLException` (a v1 name): `parse()` throws
// `YAMLParseError` (extends `YAMLError`) on syntax and duplicate-key errors.
import yamlModule from 'yaml'

const { parse: yamlParse, YAMLError } = yamlModule

import { teamContractError } from '../../../contracts/src/index.js'
import { FRONTMATTER_DELIMITER } from './schema.js'
import type { ParsedBlueprintDocument } from './types.js'

const BOM = '\uFEFF'

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
export function splitFrontmatter(source: string): ParsedBlueprintDocument {
  if (typeof source !== 'string') {
    throw teamContractError(
      'MALFORMED_DTO',
      'blueprint source must be a string',
      { reason: 'source-not-string' },
    )
  }

  let text = source
  if (text.startsWith(BOM)) text = text.slice(BOM.length)
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  const lines = text.split('\n')
  const firstLine = lines[0] ?? ''
  if (firstLine.trimEnd() !== FRONTMATTER_DELIMITER) {
    throw teamContractError(
      'MALFORMED_DTO',
      'blueprint document must start with a --- frontmatter delimiter line',
      { reason: 'frontmatter-missing' },
    )
  }

  let closingIndex = -1
  for (let i = 1; i < lines.length; i++) {
    if ((lines[i] ?? '').trimEnd() === FRONTMATTER_DELIMITER) {
      closingIndex = i
      break
    }
  }
  if (closingIndex < 0) {
    throw teamContractError(
      'MALFORMED_DTO',
      'blueprint frontmatter is not closed by a --- delimiter line',
      { reason: 'frontmatter-unclosed' },
    )
  }

  const frontmatterText = lines.slice(1, closingIndex).join('\n')
  const body = lines.slice(closingIndex + 1).join('\n')
  if (body.trim().length > 0) {
    throw teamContractError(
      'MALFORMED_DTO',
      'vNext blueprint documents have no markdown body: all blueprint semantics, including every persona, are structured frontmatter fields',
      { reason: 'markdown-body-not-allowed' },
    )
  }

  return { frontmatterText, body }
}

/**
 * Decode the YAML frontmatter text into a raw unknown value.
 *
 * @param frontmatterText - the text between the `---` delimiters.
 * @returns the decoded value (the caller validates its shape).
 * @throws `MALFORMED_DTO` when the YAML is syntactically invalid, has
 *   duplicate keys, or is not a single document.
 */
export function decodeYamlFrontmatter(frontmatterText: string): unknown {
  let value: unknown
  try {
    value = yamlParse(frontmatterText)
  } catch (err) {
    if (err instanceof YAMLError) {
      const line = err.linePos?.[0]
      throw teamContractError(
        'MALFORMED_DTO',
        `blueprint frontmatter is not valid YAML${line !== undefined ? ` (line ${line.line})` : ''}: ${err.message.split('\n')[0] ?? ''}`,
        { reason: 'yaml-invalid' },
      )
    }
    throw teamContractError(
      'MALFORMED_DTO',
      'blueprint frontmatter could not be decoded',
      { reason: 'yaml-invalid' },
    )
  }
  return value
}
