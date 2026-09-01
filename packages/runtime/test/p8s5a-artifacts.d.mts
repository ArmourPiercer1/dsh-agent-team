/**
 * p8s5a-artifacts.d.mts — the tsc type surface of `p8s5a-artifacts.mjs`
 * (ruling R22, same pattern as testkit's file-seam pair).
 *
 * S5A-URL: the former build-artifact guard + built-entry URL declarations
 * are gone with the repurpose (the chain no longer requires `dist/` — see
 * the `.mjs` header); only the stub-glue file-URL helper remains.
 * @module @dsh-agent-team/runtime/test/p8s5a-artifacts
 */

/** The file URL of the test-owned stub glue bundle. */
export declare function stubGlueUrl(): string
