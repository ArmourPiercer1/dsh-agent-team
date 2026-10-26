/**
 * `packages/tools/search-family` — the SEARCH Family lane (U6 PR5 of the
 * U6 slice plan; center-assembly-architecture §4 "six boundaries" owned by
 * a Family; the slice plan's PR5 "real family moved: search (grep/glob)").
 *
 * WHAT LIVES HERE: the governed grep/glob rows' FAMILY-owned halves, moved
 * VERBATIM out of the center files at master 5c03f7240 —
 *   - `search-mechanics.mjs`     the grep(1) port, the anchored rg
 *                                delegation, and the ARCHIVED CANDIDATE-A
 *                                glob row (ships NOTHING — moved with its
 *                                disclosures, never deleted, never
 *                                re-wired; exported under the honest
 *                                `…Candidate` name at this barrel);
 *   - `search-backend.mjs`       the PR5 fixed-ripgrep SEARCH row (a5srgp);
 *   - `glob-backend.mjs`         the anchored confined-rg GLOB row (a5glb,
 *                                the PRODUCTION glob row of the plane);
 *   - `cancel-leg.mjs`           the cancellation leg the two async
 *                                confined-rg rows share (and only they);
 *   - `stream-drain.mjs`         the stream drain law the same two rows
 *                                share (u7 grep-drain: one implementation);
 *   - `search-row.mjs`           the two row Definitions the trusted
 *                                assembly places under the Gate 0b-
 *                                validated mount spellings;
 *   - `search-contribution.mjs`  the §4/§10.3 contribution descriptor
 *                                (admission/grantMint/grantConsume declared
 *                                `kernel` — § CI-06).
 *
 * OWNER ROLE: the Family owns the row Definitions, the argument contract,
 * the effect BODIES (anchored walks, argv builders, confined spawns) and
 * the result SHAPES. It owns NO authority: it never admits, never mints a
 * grant, never consumes one, never decides (the contribution's
 * `obligations` block states that as data and the Kernel's closed schema
 * refuses any other value). Authority forces are injected at the trusted
 * assembly point (`src/plugin/live/*` plane — the a5p5 transport face rides
 * the plane's form-pinned barrel edge INTO `search-row.mjs`, the PR3
 * dormancy law); nothing under this directory may import the plane, the
 * Kernel lane, or Host internals. Outward edges: `node:*` builtins, the
 * host PUBLIC package `@deepseek-ai/dsh-tool-fs-search`, the reviewed
 * confined-process provider's public face (CI-07 named provider — the
 * named-mount booking lives on the three rows that carry the edge), the controlled-fs
 * verified-handle seam, and the SIBLING FAMILY public faces (fs-family's
 * anchor law `resolveAnchored`, process-family's grant-entry builder
 * `SYSTEM_RX` — referenced, never copied; the center's own one-home
 * precedents, PR2/PR3).
 *
 * THE NATIVE-BEHAVIOR CONTRACT (slice plan §10.5-5): the rg vocabulary,
 * argv baking and output parsing ride the host's PUBLIC package at the
 * pin — the "real native behavior contract" the fitness gate pins with the
 * golden-vector corpus (`packages/runtime/test/
 * u6-pr5-search-golden-vectors.test.ts`, byte-identical canonicalization
 * vs the master recording).
 *
 * DIST MIRROR: every file here is a plain .mjs tracked as a BYTE COPY under
 * `packages/runtime/dist/packages/tools/search-family/src/` via the
 * PLACEMENTS list in `scripts/place-dist-glue.mjs` (tsc never emits .mjs).
 * The relative import depths resolve identically from `src` and from the
 * dist mirror.
 *
 * @module search-family
 */
export {
  grepArgv,
  createAnchoredSearchBackend,
  // The ARCHIVED CANDIDATE-A glob row (ships NOTHING), aliased honestly at
  // this barrel — the PRODUCTION glob row is `createAnchoredGlobBackend`
  // from `glob-backend.mjs` below.
  createAnchoredGlobBackend as createAnchoredGlobBackendCandidate,
} from './search-mechanics.mjs'
export * from './search-backend.mjs'
export * from './cancel-leg.mjs'
export * from './stream-drain.mjs'
export * from './glob-backend.mjs'
export { buildSearchRowDefinitions } from './search-row.mjs'
export { buildSearchContribution } from './search-contribution.mjs'
