// Scratch: old vs fixed emitter, fed through the real `yaml` parser.
// Run: node dev/agent-workflow/evidence/a4-pr7/capability-negatives/scratch/emitter-shape.mjs
import { createRequire } from 'node:module'
const require = createRequire('/home/user/dsh-plugins/dsh-agent-team/packages/domain/package.json')
const yaml = require('yaml')

// ---- emitter as it stands at base 1d706917 (verbatim from the test file) ----
function oldToYaml(obj, indent = 0) {
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
      const val = oldToYaml(item, indent + 1)
      return `${pad}- ${val}`
    }).join('\n')
  }
  const entries = Object.entries(obj)
  return entries.map(([key, value]) => {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const sub = oldToYaml(value, indent + 1)
      return `${pad}${key}:\n${sub}`
    }
    return `${pad}${key}: ${oldToYaml(value, indent + 1)}`
  }).join('\n')
}

// ---- fixed emitter (prototype of the one that goes into the test file) ----
function needsQuoting(s) {
  return (
    s.length === 0 ||
    /[:#\n"']/.test(s) ||
    /^\s|\s$/.test(s) ||
    ['-','?','*','&','%','@','`','!','|','>','[','{',','].includes(s[0]) ||
    ['true','false','null','~','yes','no','on','off','nan','inf','-inf','.inf'].includes(s.toLowerCase()) ||
    !Number.isNaN(Number(s))
  )
}
function scalar(v) {
  if (v === null) return 'null'
  if (typeof v === 'boolean') return String(v)
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error('fixture emitter: non-finite number')
    return String(v)
  }
  if (typeof v !== 'string') throw new Error(`fixture emitter: unsupported scalar ${typeof v}`)
  return needsQuoting(v) ? JSON.stringify(v) : v
}
function emit(obj, indent = 0) {
  const pad = '  '.repeat(indent)
  if (Array.isArray(obj)) {
    if (obj.length === 0) return `${pad}[]`
    return obj.map((item) => {
      if (Array.isArray(item)) throw new Error('fixture emitter: nested sequences unsupported')
      if (item === null || typeof item !== 'object') return `${pad}- ${scalar(item)}`
      const lines = emit(item, indent + 1).split('\n')
      const first = `${pad}- ${lines[0].slice('  '.repeat(indent + 1).length)}`
      return [first, ...lines.slice(1)].join('\n')
    }).join('\n')
  }
  if (obj === null || typeof obj !== 'object') return `${pad}${scalar(obj)}`
  const entries = Object.entries(obj).filter(([, v]) => v !== undefined)
  if (entries.length === 0) return `${pad}{}`
  return entries.map(([key, value]) => {
    if (value === null || typeof value !== 'object') return `${pad}${key}: ${scalar(value)}`
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) {
      return `${pad}${key}: {}`
    }
    if (Array.isArray(value) && value.length === 0) return `${pad}${key}: []`
    return `${pad}${key}:\n${emit(value, indent + 1)}`
  }).join('\n')
}

const fixture = {
  schemaVersion: 3,
  blueprintId: 'test-blueprint',
  revision: 'v1',
  leader: {
    templateId: 'leader',
    persona: 'I am the team leader.',
    capabilities: {
      teamTools: { kind: 'allow', items: ['read', 'write'] },
      builtinToolDeny: ['fs.write'],
      skills: { kind: 'allow', items: ['skill-a', 'skill-b'] },
      mcp: { kind: 'allow', items: ['mcp-server-1'] },
    },
  },
  members: [
    { templateId: 'member-a', persona: 'I am member A.', capabilities: { teamTools: { kind: 'allow', items: ['read'] }, builtinToolDeny: [], skills: { kind: 'deny' }, mcp: { kind: 'deny' } } },
    { templateId: 'member-b', persona: 'I am member B.', capabilities: { teamTools: { kind: 'deny' }, builtinToolDeny: [], skills: { kind: 'deny' }, mcp: { kind: 'deny' } } },
  ],
  requirements: [],
  memberEnvelopes: [],
  policyStates: [],
  permissionMutationEnvelope: { rules: [] },
  teamHardEnvelope: { rules: [] },
  metadata: {},
}

const tricky = {
  plain: 'hello',
  colon: 'a: b',
  hash: 'a # comment',
  dquote: 'say "hi"',
  squote: "it's",
  trueish: 'true',
  falseish: 'false',
  numeric: '007',
  empty: '',
  dash: '- leading dash',
  yes: 'yes',
}

function tryParse(label, text) {
  try {
    const v = yaml.parse(text)
    return { label, ok: true, value: v }
  } catch (e) {
    return { label, ok: false, message: String(e.message).split('\n')[0] }
  }
}

console.log('=== OLD emitter on the v3 fixture ===')
const oldText = `---\n${oldToYaml(fixture)}\n---`
console.log(oldText.split('\n').slice(0, 14).join('\n'))
console.log('...', JSON.stringify(tryParse('old', oldText)).slice(0, 200))

console.log('\n=== OLD emitter on the tricky scalars ===')
console.log(JSON.stringify(tryParse('old-tricky', oldToYaml(tricky))))

console.log('\n=== FIXED emitter on the v3 fixture ===')
const newText = `---\n${emit(fixture)}\n---`
console.log(newText)
const parsed = tryParse('fixed', newText)
console.log(JSON.stringify(parsed, null, 1).slice(0, 400))
console.log('ROUNDTRIP EQUALS INPUT:', JSON.stringify(parsed.value) === JSON.stringify(fixture))

console.log('\n=== FIXED emitter on the tricky scalars ===')
const t = emit(tricky)
console.log(t)
const tp = tryParse('fixed-tricky', t)
console.log(JSON.stringify(tp))
console.log('ROUNDTRIP EQUALS INPUT:', JSON.stringify(tp.value) === JSON.stringify(tricky))
