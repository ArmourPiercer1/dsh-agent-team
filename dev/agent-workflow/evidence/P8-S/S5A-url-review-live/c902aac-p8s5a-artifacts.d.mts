/**
 * p8s5a-artifacts.d.mts — the tsc type surface of `p8s5a-artifacts.mjs`
 * (ruling R22, same pattern as testkit's file-seam pair).
 * @module @dsh-agent-team/runtime/test/p8s5a-artifacts
 */

/**
 * Fail loudly with the sanctioned build recipe when a required S5-PRE
 * artifact (built host entry / built legacy entry / yaml link) is missing.
 */
export declare function assertArtifactsBuilt(): void
/** The file URL of the built production entry (`dist/.../plugin/host.js`). */
export declare function builtHostUrl(): string
/** The file URL of the test-owned stub glue bundle. */
export declare function stubGlueUrl(): string
/** The file URL of the built seams module (the fail-closed proxy probe). */
export declare function builtSeamsUrl(): string
