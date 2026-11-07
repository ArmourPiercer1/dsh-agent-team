/**
 * a5sf-capability-defaults.test.mjs — E1: what does a Member template that
 * declares NO `capabilities` actually compile to?
 *
 * ZERO Host boots, ZERO ports, ZERO DSH_HOME, ZERO network. It runs the REAL
 * product modules from the committed glue:
 *   - `parseBlueprint` (packages/domain/blueprint) — the strong parser;
 *   - `staticCapabilitiesOf` / `initialMcpGrantOf` (packages/domain/policy) —
 *     the SAME projection `agent-bindings.mjs` uses (`staticCapabilitiesOf`,
 *     imported at agent-bindings.mjs:360 and called at :2471);
 *   - `createTeamTools` / `selectTeamTools` (packages/tools) — the real 15-tool
 *     catalog and the SAME selector `agent-bindings.mjs` uses at :3024.
 *
 * THE E1 QUESTION. An undeclared template was observed to receive all fifteen
 * `team_*` tools, including `team_delegate` and `team_grant_permission`. Is that
 * a defect (a permissive default that should be fail-closed) or a documented
 * compatibility contract?
 *
 * THE EVIDENCE SAYS CONTRACT:
 *   - `packages/domain/blueprint/src/types.ts` — `capabilities`: "absent =
 *     legacy mode, no restrictions";
 *   - `packages/domain/blueprint/src/validate.ts` — "Optional capabilities
 *     block (absent = legacy mode)";
 *   - `packages/domain/policy/src/static-capability-source.ts` —
 *     `staticCapabilitiesOf` returns `{ mode: 'legacy' }` for an absent block,
 *     and the runtime's team-tool selector falls back to `[...catalog]`
 *     (agent-bindings.mjs:3024);
 *   - `docs/blueprint-authoring.md` §5 — "Absent `capabilities` = legacy mode
 *     (rc.1 behavior, everything inherited)".
 *
 * So this file PINS the semantic instead of "fixing" it: the undocumented
 * surprise is fixed by documenting it (blueprint-authoring §5 + the product
 * debt register's deliberate non-row), and the executable check below reds if
 * anyone changes the semantics without changing the contract text.
 *
 * Print the measured surface:
 *   node --test tests/world-factory/a5sf-capability-defaults.test.mjs
 *
 * CORE PATCH BUDGET = 0. This suite reads product artefacts; it changes no
 * package source and no dist glue.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const DIST = join(ROOT, 'packages', 'runtime', 'dist', 'packages')

const blueprint = await import(pathToFileURL(join(DIST, 'domain', 'blueprint', 'src', 'index.js')).href)
const policy = await import(pathToFileURL(join(DIST, 'domain', 'policy', 'src', 'index.js')).href)
const tools = await import(pathToFileURL(join(DIST, 'tools', 'src', 'index.js')).href)

const { parseBlueprint } = blueprint
const { staticCapabilitiesOf, initialMcpGrantOf } = policy
const { createTeamTools, selectTeamTools } = tools

/** The real catalog the Team row mounts (15 definitions). */
const CATALOG = createTeamTools({}).tools

/** The compile step, verbatim from agent-bindings.mjs:3024. */
function compileTeamToolSurface(capabilities, catalog = CATALOG) {
  return capabilities.mode === 'selective' ? selectTeamTools(catalog, capabilities.teamTools) : [...catalog]
}

function blueprintYaml({ memberCapabilities } = {}) {
  const member = { templateId: 'worker', persona: 'You are the governed worker.' }
  if (memberCapabilities !== undefined) member.capabilities = memberCapabilities
  const doc = {
    schemaVersion: 3,
    blueprintId: 'team.e1.capability-defaults',
    revision: '1',
    leader: { templateId: 'leader', persona: 'You lead the E1 capability-defaults team.' },
    members: [member],
    requirements: [],
    teamEnvelope: { allow: [], deny: [] },
    memberEnvelopes: [],
    policyStates: [],
    permissionMutationEnvelope: { rules: [] },
    teamHardEnvelope: { rules: [] },
    metadata: {},
  }
  return `---\n${JSON.stringify(doc, null, 2)}\n---\n`
}

test('(e1-undeclared) a template with no `capabilities` compiles to the FULL team tool catalog', () => {
  const parsed = parseBlueprint(blueprintYaml())
  const member = parsed.members[0]
  assert.equal(member.capabilities, undefined, 'the parser keeps "absent" absent (it does not synthesize an empty block)')

  const capabilities = staticCapabilitiesOf(parsed, member)
  assert.deepEqual(capabilities, { mode: 'legacy' }, 'the product projection calls this LEGACY, not "deny everything"')

  const surface = compileTeamToolSurface(capabilities)
  const names = surface.map((tool) => tool.name)

  // This is the evidence the E1 finding asked for: print the compiled surface.
  process.stdout.write(`E1-UNDECLARED-CAPABILITIES mode=${capabilities.mode} teamTools=${String(names.length)}\n`)
  process.stdout.write(`E1-TEAM-TOOL-SURFACE ${names.join(',')}\n`)

  assert.equal(CATALOG.length, 15, 'the shipped Team tool catalog is the fifteen team_* tools')
  assert.deepEqual(names, CATALOG.map((tool) => tool.name), 'legacy mode inherits the WHOLE catalog, in catalog order')
  for (const name of ['team_delegate', 'team_grant_permission', 'team_revoke_permission']) {
    assert.ok(names.includes(name), `the undeclared template receives ${name}`)
  }

  // The one part of the "legacy = everything" sentence that is NOT true: MCP
  // stays fail-closed with no initial grant. Recorded so nobody "simplifies"
  // the legacy default by assuming it is uniformly permissive.
  assert.equal(initialMcpGrantOf(capabilities), undefined, 'legacy mode grants NO initial MCP server (fail-closed, docs/INSTALL.md)')
})

test('(e1-contrast) declaring `capabilities` is what narrows the surface', () => {
  const denied = parseBlueprint(blueprintYaml({
    memberCapabilities: { teamTools: { kind: 'deny' }, builtinToolDeny: [], skills: { kind: 'deny' }, mcp: { kind: 'deny' } },
  }))
  const deniedCaps = staticCapabilitiesOf(denied, denied.members[0])
  assert.equal(deniedCaps.mode, 'selective')
  assert.deepEqual(compileTeamToolSurface(deniedCaps).map((t) => t.name), [], 'an explicit deny yields zero team tools')

  const narrowed = parseBlueprint(blueprintYaml({
    memberCapabilities: {
      teamTools: { kind: 'allow', items: ['team_collect', 'team_delegate'] },
      builtinToolDeny: [],
      skills: { kind: 'deny' },
      mcp: { kind: 'deny' },
    },
  }))
  const narrowedCaps = staticCapabilitiesOf(narrowed, narrowed.members[0])
  assert.deepEqual(
    compileTeamToolSurface(narrowedCaps).map((t) => t.name),
    ['team_delegate', 'team_collect'],
    'an explicit allow list is honoured in catalog order (team_delegate precedes team_collect)',
  )
})

test('(e1-contract) the documented contract states the legacy default the code implements', () => {
  const skill = readFileSync(join(ROOT, '.agents', 'skills', 'team-blueprint-authoring', 'SKILL.md'), 'utf8')
  assert.match(skill, /Absent `capabilities` = legacy mode \(rc\.1 behavior, everything inherited\)/, 'the authoring contract still states the legacy default')
  assert.match(skill, /full team tool catalog/, 'and it now spells out what "everything inherited" means at the team-tool layer')
  assert.match(skill, /fifteen `team_\*` tools/, 'the count is stated, not implicit')

  // The type-level contract the runtime implementation points at.
  const types = readFileSync(join(ROOT, 'packages', 'domain', 'blueprint', 'src', 'types.ts'), 'utf8')
  assert.match(types, /absent = legacy mode, no restrictions/, 'the domain type still documents legacy mode as unrestricted')
})
