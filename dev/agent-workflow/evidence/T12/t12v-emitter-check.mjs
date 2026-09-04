// Throwaway: validate the t12v patch YAML emitter output (imports nothing from the runner).
function yamlScalar(v) {
  if (v === null) return 'null'
  if (typeof v === 'string') return JSON.stringify(v)
  return String(v)
}
function yamlValueLines(value, indent) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => yamlEmitItem(item, indent))
  }
  return Object.entries(value).flatMap(([k, v]) => yamlEmit(k, v, indent))
}
function yamlEmit(key, value, indent) {
  const pad = '  '.repeat(indent)
  if (value !== null && typeof value === 'object') {
    const empty = Array.isArray(value) ? value.length === 0 : Object.keys(value).length === 0
    if (empty) return [`${pad}${key}: ${Array.isArray(value) ? '[]' : '{}'}`]
    return [`${pad}${key}:`, ...yamlValueLines(value, indent + 1)]
  }
  return [`${pad}${key}: ${yamlScalar(value)}`]
}
function yamlEmitItem(item, indent) {
  const pad = '  '.repeat(indent)
  if (item === null || typeof item !== 'object') {
    return [`${pad}- ${yamlScalar(item)}`]
  }
  if (Array.isArray(item)) {
    if (item.length === 0) return [`${pad}- []`]
    return [`${pad}-`, ...yamlValueLines(item, indent + 1)]
  }
  const entries = Object.entries(item)
  const [firstKey, firstValue] = entries[0]
  const firstLines = yamlEmit(firstKey, firstValue, indent + 1)
  const rest = entries.slice(1).flatMap(([k, v]) => yamlEmit(k, v, indent + 1))
  return [`${pad}- ${firstLines[0].slice((indent + 1) * 2)}`, ...firstLines.slice(1), ...rest]
}

const config = {
  rootSessionId: 'session-t12v-a-root-test',
  bootPhase: 'create',
  blueprintSource: '---\nschemaVersion: 1\nblueprintId: "t12v-bp-a"\n---\n',
  seedMembers: [],
  defaultWorkspace: 'C:/agent-team/work/t12v/a',
  generation: 1,
  staticModel: { provider: 'deepseek-official', model: 't12v-model-a' },
  deniedSelection: { provider: 't12v-denied', model: 't12v-denied' },
  mcpServer: { name: 't12vmini', port: 3492 },
  environmentFacts: [
    { domain: 'tool', subject: 'web', available: true, generation: 1 },
    { domain: 'skill', subject: 'base', available: true, generation: 1 },
  ],
  externalPolicyFacts: { hard: { mcp: { kind: 'deny' } }, capabilityExists: { mcp: true, model: true } },
  glueUrl: 'file:///D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/T12-V/packages/runtime/src/plugin/live/agent-bindings.mjs',
  seamUrl: 'file:///D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/T12-V/packages/runtime/root-binding/harness/seam.mjs',
}
const lines = [
  '# comment',
  '- insert:',
  ...yamlEmitItem({ id: 'dsh-agent-team', name: 'file:///D:/x/host.js', config }, 2),
  ...yamlEmitItem({ id: 'p6t6-team-tools', name: 'file:///D:/y/plugin.mjs' }, 2),
  '',
]
const text = lines.join('\n')
console.log(text)
