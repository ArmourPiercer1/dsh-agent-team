/**
 * u7-agent-control — U7-F C2: the AGENT-CONTROL World (the seven governed
 * rows — subagent, subagent_fork, send_message, interrupt_agent,
 * list_agents, list_subagent_models, workflow — mounted as ONE family over
 * the FamilyAssembly seam on the production Team row, ZERO center diff).
 * NO probe row: the governed rows answer through the PRODUCTION kernel, and
 * every verdict is public — the mock transcripts (the rows' own tool
 * results), the governed session ledger (team.getLedgerPage v1), and host-log
 * witnesses of the plane's own lines.
 *
 * @module tests/world-factory/world-kinds/080-u7-agent-control
 */
export default {
  option: 'u7AgentControl',
  probe: null,
  paths: {},
  ledgerRows: {},
  envKeys: [],
  env: () => ({}),
  patchHeader: [
    'U7-agent-control World: canary row + the production Team row (the',
    'AGENT-CONTROL family mounted via the FamilyAssembly seam, plane key',
    'agentControlEnabled), p6t6 observer and preset declarations, one',
    'public profile-patch layer.',
  ],
}
