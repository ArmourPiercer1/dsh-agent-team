/**
 * `packages/tools/inspect-family` — the INSPECT family lane (U7-F).
 *
 * WHAT LIVES HERE: the governed read-only introspection rows the Family-
 * Assembly seam mounts for a Team member —
 *   - `row-names.mjs`                the alias mount spellings and the natexe
 *                                    law that chose them (NO reserved-native
 *                                    claim: the plane's takeover ledger is
 *                                    the complete truth of native pairs this
 *                                    surface assembles, and a lane with zero
 *                                    plane lines never edits it);
 *   - `skill-mechanics.mjs`          the name grammar (host-pin mirror), the
 *                                    sanctioned-root config law, the
 *                                    SKILL.md frontmatter/body law;
 *   - `skill-executor.mjs`           the governed skill loader: pure front →
 *                                    lane → default-deny → PA edge → the
 *                                    fs-family anchor law BY REFERENCE
 *                                    (`lexicalAnchor` / `resolveAnchoredPath`
 *                                    — the sibling-face "referenced, never
 *                                    copied" precedent), bounded read;
 *   - `inspect-mechanics.mjs`        provider-directory + closed-subset
 *                                    input-schema pre-checks (unknown =
 *                                    typed refusal LISTING what exists; an
 *                                    unverifiable contract is refused);
 *   - `inspect-executor.mjs`         the two inspect bodies over the host
 *                                    PUBLIC `cordisInspect` face (lazy
 *                                    per-call, `attachments`-pattern), the
 *                                    bounded settle race with the cancel
 *                                    law `exited > timedOut > aborted`
 *                                    (raceConfinedSettle referenced not
 *                                    copied), and the NO-LATE-RESULT law:
 *                                    timeout and abort answer final typed
 *                                    refusals; a value that lands later is
 *                                    never published;
 *   - `skill-row.mjs` / `inspect-rows.mjs`  the row Definitions (plain
 *                                    Definition transport, the fs fixed-
 *                                    native precedent — not the a5p5 trio
 *                                    face);
 *   - `inspect-family-contribution.mjs` the ONE contribution descriptor
 *                                    (admission/grantMint/grantConsume
 *                                    declared `kernel` — CI-06).
 *
 * READ-ONLY FAMILY: the vocabulary of every per-call PA request set this
 * lane can ever produce is {tool-invoke, read, meta}. No write, no connect,
 * no domain-ref, no fs mutation, no host mutation seam. The lane owns NO
 * authority: it never admits, mints, consumes, or decides.
 *
 * DIST MIRROR: every file here is a plain .mjs tracked as a BYTE COPY under
 * `packages/runtime/dist/packages/tools/inspect-family/src/` via
 * `scripts/dist-placements/070-inspect-family.json` (tsc never emits .mjs);
 * relative import depths resolve identically from src and from the mirror.
 *
 * @module inspect-family
 */
export { SKILL_ROW_NAME, INSPECT_LIST_ROW_NAME, INSPECT_QUERY_ROW_NAME } from './row-names.mjs'
export {
  SKILL_FILE_NAME,
  SKILL_MAX_BYTES,
  SKILL_NAME_MAX_LENGTH,
  isSkillNameGrammar,
  validateSkillRoots,
  parseSkillMarkdown,
} from './skill-mechanics.mjs'
export { createGovernedSkillExecutor } from './skill-executor.mjs'
export { buildSkillRowDefinition, SKILL_ROW_PRESENTATION_FACE } from './skill-row.mjs'
export {
  INSPECT_QUERY_BUDGET_MS,
  INSPECT_DIRECTORY_LOCATOR,
  findProvider,
  findMethod,
  inspectMethodLocator,
  isSafeLocatorSegment,
  validateInputSubset,
} from './inspect-mechanics.mjs'
export {
  createGovernedInspectListExecutor,
  createGovernedInspectQueryExecutor,
} from './inspect-executor.mjs'
export { buildInspectRowDefinitions } from './inspect-rows.mjs'
export { buildInspectFamilyContribution } from './inspect-family-contribution.mjs'
