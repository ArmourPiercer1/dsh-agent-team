// Scratch (NOT committed): pure-level reproduction of the s1-probe FATAL.
// Feeds the REAL dist provider + engine the exact inputs of the fatal
// moment: 3 configured servers, a live probe answering UNKNOWN (no fiber,
// no failed slot — as the diagnostic state dumps show), seed = row
// environmentFacts (factsAll), scope team, reqs = the 2 team mcp reqs.
const R = '/home/user/dsh-plugins/dsh-agent-team/.worktrees/pre-alpha3-pre-e-requirement-recovery/packages/runtime/dist/packages'
const { createRuntimeRequirementFactsProvider } = await import(`${R}/runtime/requirement-facts/index.js`)
const { evaluateCompatibility } = await import(`${R}/domain/compatibility/src/engine.js`)

const seedFacts = [
  { domain: 'mcpServer', subject: 'mcp_repo', available: true, generation: 1 },
  { domain: 'mcpServer', subject: 'mcp_leaderreq', available: true, generation: 1 },
  { domain: 'mcpServer', subject: 'mcp_web', available: true, generation: 1 },
  { domain: 'mcpServer', subject: 'mcp_signal', available: true, generation: 1 },
]

let probeCalls = []
const provider = createRuntimeRequirementFactsProvider({
  configuredMcpServers: ['mcp_repo', 'mcp_leaderreq', 'mcp_web'],
  readiness: {
    probe: (type, subject) => {
      probeCalls.push([type, subject])
      return { verdict: 'unknown', source: 'mcpFiber', observedAt: '2026-09-29T20:00:00Z' }
    },
  },
  seedFacts,
  substratePlan: () => ({ root: { presetId: 'p', persona: 'standard' }, member: { presetId: 'p', persona: 'standard' } }),
  now: () => '2026-09-29T20:00:00Z',
})

const teamReqs = [
  { requirementId: 'team.mcp.repo', type: 'mcpServer', subjects: ['mcp_repo'], complete: true },
  { requirementId: 'team.mcp.leaderreq', type: 'mcpServer', subjects: ['mcp_leaderreq'], complete: true },
]

const resolution = await provider.resolveFacts({ requirements: teamReqs, scope: { kind: 'team' } })
console.log('probe calls:', JSON.stringify(probeCalls))
console.log('=== observations ===')
for (const o of resolution.observations) console.log(JSON.stringify(o))
console.log('=== feed (environmentFacts) ===')
console.log(JSON.stringify(resolution.environmentFacts, null, 1))

const result = evaluateCompatibility({ requirements: teamReqs, environmentFacts: resolution.environmentFacts })
console.log('=== engine result ===')
console.log('status:', result.status)
for (const r of result.requirements) console.log(r.requirementId, '->', r.outcome, r.reasonCode)
