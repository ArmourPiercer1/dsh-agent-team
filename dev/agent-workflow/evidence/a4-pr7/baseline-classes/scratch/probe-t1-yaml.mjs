/**
 * probe-t1-yaml.mjs — evidence-only probe for BASELINE-CLASSES.
 *
 * Re-implements NOTHING in the product: it copies the test file's own fixture serializer
 * (packages/domain/test/t1-capability-schema.test.ts:113-140, verbatim) and runs the real
 * `yaml` parser (the same package `decodeYamlFrontmatter` uses) over the documents each leg
 * builds, to answer one question mechanically: which t1 legs ever reach the capability
 * validator at all?
 *
 * Result shape per leg: the generated frontmatter, whether it is valid YAML, and if it is,
 * the schemaVersion the document declares (which is what the v3-only fence then refuses).
 */
import { parse as yamlParse } from '/home/user/dsh-plugins/dsh-agent-team/.worktrees/a4-baseline-classes/node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/index.js';

function toYamlFrontmatter(obj, indent = 0) {
  const pad = '  '.repeat(indent)
  if (typeof obj !== 'object' || obj === null) {
    if (typeof obj === 'string') {
      if (obj.includes(':') || obj.includes('#') || obj.includes("'") || obj === 'true' || obj === 'false' || obj === 'null') {
        return `"${obj.replace(/"/g, '\\"')}"`
      }
      return obj
    }
    return String(obj)
  }
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]'
    return obj.map((item) => {
      const val = toYamlFrontmatter(item, indent + 1)
      return `${pad}- ${val}`
    }).join('\n')
  }
  const entries = Object.entries(obj)
  return entries.map(([key, value]) => {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const sub = toYamlFrontmatter(value, indent + 1)
      return `${pad}${key}:\n${sub}`
    }
    return `${pad}${key}: ${toYamlFrontmatter(value, indent + 1)}`
  }).join('\n')
}

function legacyBlueprintSource(overrides = {}) {
  const base = {
    schemaVersion: 1,
    blueprintId: 'test-blueprint',
    revision: 'v1',
    leader: { templateId: 'leader', persona: 'I am the team leader.' },
    members: [],
    requirements: [],
    memberEnvelopes: [],
    policyStates: [],
    metadata: {},
    ...overrides,
  }
  return `---\n${toYamlFrontmatter(base)}\n---`
}
function leaderCapabilitiesSource(capabilities, overrides = {}) {
  return legacyBlueprintSource({
    leader: { templateId: 'leader', persona: 'I am the team leader.', capabilities },
    ...overrides,
  })
}
function twoMemberCapabilitiesSource(a, b) {
  return legacyBlueprintSource({
    members: [
      { templateId: 'member-a', persona: 'I am member A.', capabilities: a },
      { templateId: 'member-b', persona: 'I am member B.', capabilities: b },
    ],
  })
}
const fullCapabilities = () => ({
  teamTools: { kind: 'allow', items: ['read', 'write'] },
  builtinToolDeny: ['fs.write'],
  skills: { kind: 'allow', items: ['skill-a', 'skill-b'] },
  mcp: { kind: 'allow', items: ['mcp-server-1'] },
})
const denyCapabilities = () => ({
  teamTools: { kind: 'deny' },
  builtinToolDeny: [],
  skills: { kind: 'deny' },
  mcp: { kind: 'deny' },
})

const cases = [
  ['1  (RED)  legacy fixture', () => legacyBlueprintSource()],
  ['2  (RED)  leader full caps', () => leaderCapabilitiesSource(fullCapabilities())],
  ['3  (RED)  two members', () => twoMemberCapabilitiesSource(fullCapabilities(), denyCapabilities())],
  ['4  (GREEN) malformed allow', () => leaderCapabilitiesSource({
    teamTools: { kind: 'allow' }, builtinToolDeny: [],
    skills: { kind: 'allow', items: ['skill-a'] }, mcp: { kind: 'allow', items: [] },
  })],
  ['4b (GREEN) non-string item', () => leaderCapabilitiesSource({
    teamTools: { kind: 'allow', items: [123] }, builtinToolDeny: [],
    skills: { kind: 'allow', items: [] }, mcp: { kind: 'allow', items: [] },
  })],
  ['5  (GREEN) deny with items', () => leaderCapabilitiesSource({
    teamTools: { kind: 'deny', items: ['read'] }, builtinToolDeny: [],
    skills: { kind: 'allow', items: [] }, mcp: { kind: 'allow', items: [] },
  })],
  ['6a (GREEN) unknown field', () => leaderCapabilitiesSource({
    ...fullCapabilities(), unknownField: 'oops',
  })],
  ['6b (GREEN) unknown top field', () => leaderCapabilitiesSource(fullCapabilities(), { unknownTopLevel: true })],
  ['7  (RED)  hash: caps A', () => leaderCapabilitiesSource(fullCapabilities())],
  ['10 (RED)  legacy static', () => legacyBlueprintSource()],
  ['11 (RED)  selective map', () => leaderCapabilitiesSource(fullCapabilities())],
  ['11b(RED)  deny map', () => leaderCapabilitiesSource(denyCapabilities())],
]

for (const [label, build] of cases) {
  const src = build()
  const fm = src.split('---')[1] ?? ''
  let verdict
  try {
    const doc = yamlParse(fm)
    verdict = `YAML OK  -> reaches the version fence: schemaVersion=${doc?.schemaVersion} (supported [3]) ` +
      `-> capabilities key present: ${doc?.leader?.capabilities !== undefined}`
  } catch (e) {
    verdict = `YAML REFUSED before any schema check: ${String(e.message).split('\n')[0]}`
  }
  console.log(`${label.padEnd(28)} ${verdict}`)
}
