/**
 * The type surface for `client-composition-surface.mjs` (A4-PR7 Task 7.5).
 *
 * The constants are the point of this module — the composition builder emits
 * them and the composition smoke asserts the artifact against them — so the
 * test imports them typed rather than as `any`, to keep "the artifact matches
 * the builder" from degrading into "the test agrees with itself".
 */

export const CLIENT_SHIM_ROW_ID: string
export const ROOT_BUNDLE_ROW_ID: string
export const CLIENT_ROW_IDS: readonly string[]
export const CLIENT_MODULE_TABLE_EXTERNALS: readonly string[]
export const CLIENT_BUNDLE_FILENAME: string
export const CLIENT_NODE_HALF_FILENAME: string
export const CLIENT_COMPOSITION_DIR: string
export const CLIENT_BUNDLE_INSTALL_PATH: string
export const CLIENT_PLUGIN_NAME: string
export const INSTALL_SURFACES: readonly string[]
