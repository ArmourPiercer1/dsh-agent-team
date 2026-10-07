/**
 * composition-smoke-targets.mjs — the plugin-entry arm list of
 * `scripts/composition-smoke.mjs`, in a module with no side effects.
 *
 * WHY THIS IS A MODULE AND NOT AN ARRAY IN THE SCRIPT. The gate's own test
 * (`packages/testkit/test/a4p75-composition-smoke-classification.test.ts`) has
 * to know how many step lines a complete run owes, and the only honest source
 * for that is the list the gate iterates. Importing the script to read it would
 * RUN it — every top-level `await import()` and every `console.log` — so a
 * derived count was impossible while the array lived in the entry point, and the
 * alternative was a test that hard-codes "11". Plan rule A5-16 makes a guard's
 * DERIVATION part of its specification, and X10's lesson is that a remembered
 * number is wrong the day the set changes: the bundle arms are already counted
 * by derivation (`REQUIRED_CHECK_IDS`), and this closes the other half of the
 * same list.
 *
 * Nothing here is a knob: importing this module decides nothing and prints
 * nothing, and `scripts/composition-smoke.mjs` iterates this exact frozen array.
 * Adding an arm here adds a step line to the gate and a required leg to the
 * test's derivation in the same commit; deleting one is a visible edit to the
 * gate, not to a count somewhere else.
 */

/**
 * The built plugin entries the gate loads with plain Node and holds to the
 * public Cordis plugin shape (name / apply / optional inject) plus the entry's
 * own documented fail-loud contract on a degenerate context.
 */
export const PLUGIN_TARGETS = Object.freeze([
  Object.freeze({
    label: 'host plugin (packages/runtime)',
    rel: 'packages/runtime/dist/packages/runtime/src/plugin/host.js',
    expectedName: 'dsh-agent-team',
    contract: 'ready-rejection',
    // The documented fail-loud contract of validateTeamPluginConfig:
    // a degenerate (config-less) bootstrap rejects `ready` with this
    // typed code.
    expectCode: 'TEAM_PLUGIN_CONFIG_INVALID',
  }),
  Object.freeze({
    label: 'client plugin (packages/client)',
    rel: 'packages/client/dist/packages/client/src/plugin/client.js',
    expectedName: 'dsh-agent-team-client',
    contract: 'throw',
    // Closure-gated: this entry links upstream UI packages this workspace
    // cannot install (see the gate's header). Its checks run whenever the
    // closure is available; otherwise the step says so by name — and the run
    // FAILS, because an unrun step is not a passing gate.
    closureGate: true,
  }),
])
