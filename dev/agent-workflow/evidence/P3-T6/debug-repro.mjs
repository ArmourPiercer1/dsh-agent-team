// Debug-only reproduction of the t6-9 module-scope failure (leaf worker P3-T6).
// Lives in the owned evidence path on purpose; scripts/** is read-only. Delete after use.
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const worktree = 'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/P3-T6'
const hookUrl = pathToFileURL(path.join(worktree, 'scripts/run-tests-hooks.mjs')).href
register(hookUrl)

// Check Object.isFrozen for all 9 direct bundle dependencies (t6-1 L94).
const direct = [
  'packages/contracts/src/index.ts',
  'packages/domain/blueprint/src/index.ts',
  'packages/domain/member/src/index.ts',
  'packages/domain/lifecycle/src/index.ts',
  'packages/domain/policy/src/index.ts',
  'packages/domain/compatibility/src/index.ts',
  'packages/domain/blueprint/testdata/fixtures.ts',
  'packages/domain/compatibility/fixtures/requirements.ts',
  'packages/domain/compatibility/fixtures/environment-facts.ts',
]
for (const rel of direct) {
  const mod = await import(pathToFileURL(path.join(worktree, rel)).href)
  console.log(rel, 'frozen:', Object.isFrozen(mod), 'type:', typeof mod, 'extensible:', Object.isExtensible(mod))
}

const compatDir = path.join(worktree, 'packages/domain/compatibility')
const compat = await import(pathToFileURL(path.join(compatDir, 'src/index.ts')).href)
const reqs = await import(pathToFileURL(path.join(compatDir, 'fixtures/requirements.ts')).href)
const facts = await import(pathToFileURL(path.join(compatDir, 'fixtures/environment-facts.ts')).href)

console.log('BLUEPRINT_REQUIREMENTS is array:', Array.isArray(reqs.BLUEPRINT_REQUIREMENTS), 'len:', reqs.BLUEPRINT_REQUIREMENTS?.length)
console.log('MCP_UNAVAILABLE_FACTS is array:', Array.isArray(facts.MCP_UNAVAILABLE_FACTS), 'len:', facts.MCP_UNAVAILABLE_FACTS?.length)

try {
  const r = compat.evaluateCompatibility({
    requirements: reqs.BLUEPRINT_REQUIREMENTS,
    environmentFacts: facts.MCP_UNAVAILABLE_FACTS,
  })
  console.log('result keys:', Object.keys(r))
  console.log('status:', r.status)
  console.log('requirements isArray:', Array.isArray(r.requirements))
  if (Array.isArray(r.requirements)) {
    const mcp = r.requirements.find((e) => e.requirementId === 'req-mcp-abtem')
    console.log('mcp entry:', mcp && mcp.outcome, mcp && mcp.reasonCode, mcp && mcp.mismatchFingerprint)
  }
  // Also check the fingerprint signature (two args per engine L282).
  const fp = compat.computeEnvironmentFingerprint(reqs.BLUEPRINT_REQUIREMENTS, facts.MCP_UNAVAILABLE_FACTS)
  console.log('fingerprint(requirements, facts):', fp)
  console.log('matches result:', fp === r.environmentFingerprint)

  // absent-mode vs explicit-false-mode byte equality with mode-independent ids
  const unmet = [{ domain: 'tool', subject: 'subj-x', available: false, generation: 1 }]
  const absentIn = { requirementId: 'req-tool-n', type: 'tool', subjects: ['subj-x'] }
  const falseIn = { requirementId: 'req-tool-n', type: 'tool', subjects: ['subj-x'], complete: false }
  const absentOut = compat.serializeCompatibilityResult(compat.evaluateCompatibility({ requirements: [absentIn], environmentFacts: unmet }))
  const falseOut = compat.serializeCompatibilityResult(compat.evaluateCompatibility({ requirements: [falseIn], environmentFacts: unmet }))
  console.log('absent==false byte-equal:', absentOut === falseOut)
  if (absentOut !== falseOut) {
    console.log('absent:', absentOut)
    console.log('false :', falseOut)
  }
} catch (error) {
  console.log('EVAL ERROR:', error && error.stack ? error.stack.split('\n').slice(0, 6).join(' | ') : String(error))
}
