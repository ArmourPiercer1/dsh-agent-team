/**
 * u7-astore — the AGENT-STATE PRODUCTION-STORE World: the production Team
 * row with `agentStateEnabled: true` and NO injected store port, so the
 * family's descriptor builds its durable fs store under the host's DSH_HOME
 * (= this World's home, under tests/homes/). NO probe row: every verdict is
 * the runner's own disk read of that store, the governed Control ledger,
 * the mock transcripts and host-log witnesses.
 *
 * @module tests/world-factory/world-kinds/090-u7-astore
 */
export default {
  option: 'u7AStore',
  probe: null,
  paths: {},
  ledgerRows: {},
  envKeys: [],
  env: () => ({}),
  patchHeader: [
    'U7-astore World: canary row + the production Team row (the',
    'AGENT-STATE family with its PRODUCTION durable store under DSH_HOME,',
    'plane key agentStateEnabled), p6t6 observer and preset declarations,',
    'one public profile-patch layer.',
  ],
}
