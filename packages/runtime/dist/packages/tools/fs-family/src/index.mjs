/**
 * `packages/tools/fs-family` — the FS Family lane (U6 PR2 of the U6 slice
 * plan; center-assembly-architecture §4 "six boundaries" owned by a Family).
 *
 * WHAT LIVES HERE: the governed `read` row's FAMILY-owned halves, moved
 * VERBATIM out of the center files at master 2db321f63 —
 *   - `fs-mechanics.mjs`      the anchor/window law (shared with the
 *                             search/glob rows through the center's
 *                             re-export — one home, no copy);
 *   - `read-presentation.mjs` the Result-boundary presentation face;
 *   - `read-normalizer.mjs`   the PURE operation-projection normalizer the
 *                             center's canonicalizer consumes (the Kernel
 *                             computes the fingerprint from what it returns;
 *                             condition 7: the family part is pure);
 *   - `read-executor.mjs`     the effect body (every authority force —
 *                             decide/PA/policy/containment — arrives
 *                             injected; § Execution boundary);
 *   - `read-row.mjs`          the row Definition the trusted assembly places
 *                             under the validated native name (§ CI-04);
 *   - `fs-read-contribution.mjs` the §4/§10.3 contribution descriptor
 *                             (admission/grantMint/grantConsume declared
 *                             `kernel` — § CI-06).
 *
 * OWNER ROLE: the Family owns the Definition, the argument/window contract,
 * the effect BODY and the result SHAPE. It owns NO authority: it never
 * admits, never mints a grant, never consumes one, never decides (the
 * contribution's `obligations` block states that as data and the Kernel's
 * closed schema refuses any other value). Authority forces are injected at
 * the trusted assembly point (`src/plugin/live/*` plane); nothing under this
 * directory may import the plane, the Kernel lane, or Host internals — the
 * only outward edges are repo lanes (contracts, controlled-fs, the frozen
 * tool-governance vocabulary face, read by reviewed consumer registration).
 *
 * THE FINGERPRINT GOLDEN LAW: `read-normalizer` + the center's fingerprint
 * computation must reproduce master's `canonicalizeOperation('read', …)`
 * fingerprint BYTE-IDENTICALLY (the pinned-corpus gate in
 * `packages/runtime/test/u6-pr2-read-golden-vectors.test.ts`). Durable
 * grants/rules keyed by that fingerprint survive the move unchanged.
 *
 * DIST MIRROR: every file here is a plain .mjs tracked as a BYTE COPY under
 * `packages/runtime/dist/packages/tools/fs-family/src/` via the PLACEMENTS
 * list in `scripts/place-dist-glue.mjs` (tsc never emits .mjs). The relative
 * import depths resolve identically from `src` and from the dist mirror.
 *
 * @module fs-family
 */
export {
  buildGovernedReadWindow,
  lexicalAnchor,
  MAX_READ_BYTES,
  parseGovernedReadWindow,
  READ_ROW_CHUNK_BYTES,
  READ_ROW_LINE_CAP,
  READ_ROW_MAX_LINE_LENGTH,
  READ_ROW_MAX_OUTPUT_BYTES,
  resolveAnchored,
  resolveAnchoredPath,
} from './fs-mechanics.mjs'
export { READ_ROW_PRESENTATION_FACE, readRowPresentResult } from './read-presentation.mjs'
// U7-F review round 1 (finding H-1): the governed skill loader needs the
// exec-time handle-identity law (`verifyOpenedHandle`) to read through an
// fd-pinned, O_NOFOLLOW-opened handle instead of re-resolving a path string.
// That primitive lives in the reviewed controlled-fs lane, which THIS barrel
// already imports (fs-mechanics' `isBeneath`, read-executor's post-consume
// closures). The inspect family books ONLY this public face in its
// LANE_EDGES, so the law is re-exported here — a minimal additive surface,
// the same primitive the fs read/write/edit/image rows already run, never a
// second copy. Consumers reach it as `fs-family` → `verifyOpenedHandle`.
export { verifyOpenedHandle } from '../../../runtime/controlled-fs/src/index.js'
export { normalizeReadProjection } from './read-normalizer.js'
export { createGovernedReadExecutor } from './read-executor.mjs'
export { buildReadRowDefinition } from './read-row.mjs'
export { buildFsReadContribution } from './fs-read-contribution.mjs'
// U7-9a (the first per-family delivery, CA-01): the governed `write`,
// `edit` and `read_image` rows join the SAME lane under the SAME law —
// pure argument contract, effect declaration, injected authority, and the
// FS effect itself executed ONLY by the controlled-fs provider's
// post-consume closures / verified-handle boundary (CI-07). One family,
// one candidate: `buildFsFamilyContribution` carries all four native names
// through the closed schema (Registry law: one live candidate per family).
export {
  MAX_GOVERNED_WRITE_BYTES,
  IMAGE_EXTENSIONS,
  imageExtensionOf,
  imageMediaTypeForPath,
  parseGovernedWriteArgs,
  parseGovernedEditArgs,
  parseGovernedImageArgs,
  sniffImageMediaType,
} from './fs-mutation-mechanics.mjs'
export { createGovernedWriteExecutor } from './write-executor.mjs'
export { buildWriteRowDefinition, WRITE_ROW_PRESENTATION_FACE } from './write-row.mjs'
export { createGovernedEditExecutor } from './edit-executor.mjs'
export { buildEditRowDefinition, EDIT_ROW_PRESENTATION_FACE } from './edit-row.mjs'
export { createGovernedReadImageExecutor } from './image-executor.mjs'
export { createBoundedImageReadPort } from './image-read-port.mjs'
export { buildImageRowDefinition, IMAGE_ROW_PRESENTATION_FACE } from './image-row.mjs'
export { buildFsFamilyContribution } from './fs-family-contribution.mjs'
