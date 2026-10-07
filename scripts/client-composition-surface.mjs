/**
 * The client composition surface — the single home for the values the
 * composition builder WRITES and the composition smoke CHECKS (A4-PR7 7.5).
 *
 * Why a module instead of a constant in each script: the smoke's whole job is
 * to detect drift between the shipped artifact and the code that produced it.
 * If the smoke restated `react`, `@deepseek-ai/dsh-client-store`, the row ids
 * or the bundle filename, the check could only ever agree with itself — a
 * builder change that forgot `pnpm build:composition` would stay green, which
 * is exactly the `A5-19` / dist-co-commit failure this repo has been bitten by.
 * Importing the builder's own constants makes the assertion one-directional:
 * the artifact must match the code, never the other way round.
 *
 * `build-client-composition.mjs` imports these values and emits them into
 * `packages/client/composition-shim/`; `composition-smoke-bundle.mjs` asserts
 * the committed artifact against them.
 */

/**
 * The row id of the manual-shim form: the client module system lands on the
 * SHIM package manifest (`packages/client/composition-shim/package.json`), so
 * that world claims the row by the shim package name.
 */
export const CLIENT_SHIM_ROW_ID = '@dsh-agent-team/client'

/**
 * The row id of the git-install bundle form: the nearest package walk from the
 * row's module lands on the ROOT manifest, so that world claims the row by the
 * root package name. The emitted facade registers the same factory under both
 * ids and each world claims exactly one (see the builder's plugin-bundle-form
 * note); the unclaimed registration stays inert.
 */
export const ROOT_BUNDLE_ROW_ID = 'dsh-agent-team'

/**
 * Both row ids the built bundle must register, in emission order. The smoke
 * asserts the registration set equals this list exactly: one row id silently
 * dropped means one install world with no Team client half at all.
 */
export const CLIENT_ROW_IDS = Object.freeze([ROOT_BUNDLE_ROW_ID, CLIENT_SHIM_ROW_ID])

/**
 * The baseline client module table: the ONLY bare specifiers the composed
 * bundle may `require`, because these are the only ones the host's client
 * module system supplies (the S8 adapter externalizes this set and the
 * builder dies on any other bare import). Drift in either direction is a
 * defect: a new specifier means a browser-side `require` of something no host
 * serves, and a stale entry means the builder externalizes a specifier the
 * artifact no longer uses (so the reviewed baseline is no longer the truth).
 */
export const CLIENT_MODULE_TABLE_EXTERNALS = Object.freeze([
  'react',
  'react/jsx-runtime',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-primitives',
])

/** The bundle filename the builder writes into the composition directory. */
export const CLIENT_BUNDLE_FILENAME = 'client-bundle.js'

/** The Node-half module the builder writes next to the bundle. */
export const CLIENT_NODE_HALF_FILENAME = 'index.js'

/** The composition directory, repo-root relative. */
export const CLIENT_COMPOSITION_DIR = 'packages/client/composition-shim'

/**
 * The composed bundle's path inside an install surface
 * (`check-artifacts-committed.mjs` compares that surface against the git
 * index, so a bundle written OUTSIDE a surface would ship nothing).
 *
 * Recorded here for the builder and for humans. Do NOT build a gate arm out of
 * comparing this against `INSTALL_SURFACES`: both come from this module, so the
 * comparison is true for every artifact state and cannot fail — that is exactly
 * how `composition-bundle-is-install-surface` was written and what the A4-PR7
 * review round replaced it with. The arm now reads the paths the built shim
 * manifest actually advertises; see `advertisedShimPaths` in
 * `composition-smoke-bundle.mjs`.
 */
export const CLIENT_BUNDLE_INSTALL_PATH = `${CLIENT_COMPOSITION_DIR}/${CLIENT_BUNDLE_FILENAME}`

/**
 * The plugin name the composed client row must export. Same pinned value the
 * load step pins for the tsc-ESM entry: the bundle and the dist entry are two
 * renderings of one plugin, and a divergence means the facade inlined a
 * different module than the row registers.
 */
export const CLIENT_PLUGIN_NAME = 'dsh-agent-team-client'

/**
 * The install surfaces the git-install whitelist ships (root package.json
 * `files`) and that `check-artifacts-committed.mjs` compares against the git
 * index. Single-homed here so the smoke can ask "is the bundle I just checked
 * inside a surface that actually ships?" without restating the list — a
 * composed artifact written outside a surface is invisible to `check:artifacts`
 * and to every git-install consumer.
 */
export const INSTALL_SURFACES = Object.freeze(['packages/runtime/dist', CLIENT_COMPOSITION_DIR])
