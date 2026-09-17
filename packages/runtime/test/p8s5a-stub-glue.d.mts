/**
 * p8s5a-stub-glue.d.mts — the tsc type surface of `p8s5a-stub-glue.mjs`
 * (ruling R22, same `.mjs` + adjacent `.d.mts` pattern as
 * `p8s5a-artifacts`). The bundle is the test-owned stand-in for the live
 * glue with the 26-key `TeamAgentBindings` shape; the structural typing
 * here covers what the A2 factory world consumes (the bundle object plus
 * the `__t1` diagnostics).
 * @module @dsh-agent-team/runtime/test/p8s5a-stub-glue
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double surface, untyped by design
export declare function createAgentBindings(deps: Record<string, any>): Record<string, any>
