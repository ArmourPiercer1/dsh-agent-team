/**
 * bp1-dual-team-gate.test.ts — BP-F GREEN architecture gate (issue #2
 * blueprint-loading parallel repair, plan §11.3): the per-Team Blueprint
 * authority isolation in the live glue, over a PRODUCTION-SHAPED chain.
 *
 * The gate wires the REAL glue (loadGlueModule — the same module the host
 * loads) with a host-shaped per-Team resolver:
 *
 *   domain.repositories.teamSessions.get(root)
 *     -> the row's bound snapshot ref
 *       -> the live BlueprintAuthority.resolveSnapshot(ref)
 *         -> the FROZEN registry row's stored source text (the real
 *            TeamDomain blueprint_registry over a FileStorageSeam)
 *           -> the hash equality
 *
 * Two team roots share one glue instance (one host row):
 *
 *   Team A (the boot root)  -> Blueprint A (the row's anchor, FROZEN)
 *   Team B (a handoff root) -> Blueprint B (a saved source, FROZEN)
 *
 * A and B intentionally differ in EVERY field the glue consumes off the
 * bound snapshot (plan §11.3):
 *
 *   - leader persona
 *   - member persona (the SAME member template id 'tpl-gate' on both)
 *   - the template's teamTools allowlist
 *   - the template's builtinToolDeny
 *   - the template's permissions rules (a tools/pre-execute listener is
 *     installed on BOTH members; the policies differ)
 *
 * Assertions (the architecture gate — never `catalog.get` alone):
 *
 *   1. the A agents get ONLY A (persona / team tools / deny);
 *   2. the B agents get ONLY B;
 *   3. COLD RESUME (a FRESH glue instance over the same domain + authority,
 *      after the saved sources are DELETED — the frozen registry row's
 *      source text is the runtime authority, the plan's DoD "frozen source
 *      file deletion / mis-edit does not break the old Team's resolve /
 *      cold resume") re-resolves each agent to the SAME bound snapshot.
 *
 * The freeze (both snapshots) is the BP6 barrier's production effect
 * simulated at team-create time — the barrier itself is pinned in
 * bp1-freeze-barrier.test.ts.
 *
 * Runner note: the plain-node vitest shim forbids async `it()` bodies —
 * the world boots at module load (top-level await), the `it` bodies
 * assert synchronously (the t12a / t12b1 pattern).
 *
 * @module @dsh-agent-team/runtime/test/bp1-dual-team-gate
 */
import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import {
  destroyDir,
  FileStorageSeam,
  scratchDir,
  writeText,
} from '../../testkit/fault-injection/file-seam.mjs'
import { parseBlueprint, toBlueprintSnapshotRef } from '../../domain/blueprint/src/index.js'
import type { BlueprintSnapshotRef } from '../../contracts/src/index.js'
import { createTeamDomain } from '../../storage/repositories/index.js'
import { createBlueprintAuthority } from '../src/plugin/blueprint-authority.js'
import { createBlueprintSourceIndex } from '../src/plugin/blueprint-source-index.js'
import {
  createAgentPresetsDouble,
  createAgentsDouble,
  createDomainDouble,
  createSessionPersistenceDouble,
  loadGlueModule,
  removeFixtureHome,
  WORKTREE_ROOT,
  withDshHome,
  writeDurableFixture,
} from './t12a-live-bridge.mjs'
import type { AgentCtxDouble, AssembledPromptSection } from './t12a-live-bridge.mjs'

// --- the fixture identities -------------------------------------------------------

const ROOT_A = 'session-gatea'
const ROOT_B = 'session-gateb'
const MEMBER_A_ID = 'inst-gateamem'
const MEMBER_B_ID = 'inst-gatebmem'

/** The glue's stateless child-id derivation (T12-B2: sha256 of the NUL-joined root/instance pair, first 32 hex) — the member row must carry the SAME id the factory mints. */
function childSessionIdFor(rootSessionId: string, instanceId: string): string {
  const digest = createHash('sha256')
    .update(`${String(rootSessionId)}\u0000${String(instanceId)}`, 'utf8')
    .digest('hex')
  return `session-team-child-${digest.slice(0, 32)}`
}

// --- the deliberately different Blueprints (plan §11.3) ---------------------------

const A_LEADER_PERSONA = 'You lead the GATE-A team.'
const A_MEMBER_PERSONA = 'You are member tpl-gate of the GATE-A team.'
const B_LEADER_PERSONA = 'You lead the GATE-B team.'
const B_MEMBER_PERSONA = 'You are member tpl-gate of the GATE-B team.'

/** Blueprint A (the row anchor): the member template allows A's tools, denies fs.write, and carries A's permission rules. */
const A_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: team.gate.a',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  `  persona: "${A_LEADER_PERSONA}"`,
  'members:',
  '  - templateId: tpl-gate',
  `    persona: "${A_MEMBER_PERSONA}"`,
  '    capabilities:',
  '      teamTools:',
  '        kind: allow',
  '        items:',
  '          - assign-task',
  '          - send-message',
  '      builtinToolDeny:',
  '        - fs.write',
  '      skills:',
  '        kind: allow',
  '        items: []',
  '      mcp:',
  '        kind: allow',
  '        items: []',
  '      permissions:',
  '        default: ask',
  '        allow:',
  '          - tool: read',
  '            resource:',
  '              kind: exact',
  '              path: "/data/gate-a.md"',
  '        ask: []',
  '        deny: []',
  'requirements: []',
  'memberEnvelopes: []',
  'policyStates: []',
  'metadata: {}',
  '---',
  '',
].join('\n')

/** Blueprint B (the saved source): the SAME member template id with B's tools, B's deny, B's rules. */
const B_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: team.gate.b',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  `  persona: "${B_LEADER_PERSONA}"`,
  'members:',
  '  - templateId: tpl-gate',
  `    persona: "${B_MEMBER_PERSONA}"`,
  '    capabilities:',
  '      teamTools:',
  '        kind: allow',
  '        items:',
  '          - create-member',
  '          - report-progress',
  '      builtinToolDeny:',
  '        - fs.read',
  '      skills:',
  '        kind: allow',
  '        items: []',
  '      mcp:',
  '        kind: allow',
  '        items: []',
  '      permissions:',
  '        default: ask',
  '        allow: []',
  '        ask:',
  '          - tool: write',
  '            resource:',
  '              kind: exact',
  '              path: "/data/gate-b.md"',
  '        deny: []',
  'requirements: []',
  'memberEnvelopes: []',
  'policyStates: []',
  'metadata: {}',
  '---',
  '',
].join('\n')

/** The host teamTools catalog (four tools — each blueprint allows a different pair). */
const TEAM_TOOLS = {
  tools: [
    { name: 'assign-task' },
    { name: 'send-message' },
    { name: 'create-member' },
    { name: 'report-progress' },
  ],
}

/** The control-service stub (the A5 adapter installs its listener at setup; the gate never executes a tool, so the methods are install-shape only). */
const CONTROL_STUB = {
  requestControl: async () => ({ controlId: 'ctl-gate' }),
  awaitControlDecision: async () => 'allow',
  guardOperation: async () => ({ allowed: true, controlId: 'ctl-gate' }),
}

// --- the world (top-level await — the shim's sync-it contract) --------------------

const sourcesDir = scratchDir('bp1-gate-sources')
destroyDir(sourcesDir)
writeText(`${sourcesDir}/gate-a.yaml`, A_SOURCE)
writeText(`${sourcesDir}/gate-b.yaml`, B_SOURCE)

const dir = scratchDir('bp1-gate-domain')
destroyDir(dir)
const seam = new FileStorageSeam(dir)
const domain = await createTeamDomain(seam)

const A_REF = toBlueprintSnapshotRef(parseBlueprint(A_SOURCE))
const B_REF = toBlueprintSnapshotRef(parseBlueprint(B_SOURCE))

// The REAL live authority: the saved-source index + the REAL registry
// repository (the TeamDomain v2 blueprint_registry).
const authority = createBlueprintAuthority({
  bootstrapSource: A_SOURCE,
  sourceIndex: createBlueprintSourceIndex({ blueprintDir: sourcesDir }),
  registry: domain.repositories.blueprintRegistry,
})

// The BP6 barrier's production effect at team-create time: BOTH snapshots
// are frozen before any agent setup resolves them.
await authority.freezeSnapshot(A_REF)
await authority.freezeSnapshot(B_REF)

// The host-shaped per-Team resolver (plan §11.1 — the SAME chain host.ts
// builds; the domain is the glue's domain double, the authority is the
// real one over the FileStorageSeam registry).
const domainDouble = await createDomainDouble({
  teamSessions: [
    { rootSessionId: ROOT_A, sessionId: ROOT_A, blueprintId: A_REF.blueprintId, generation: 1, blueprint: A_REF },
    { rootSessionId: ROOT_B, sessionId: ROOT_B, blueprintId: B_REF.blueprintId, generation: 1, blueprint: B_REF },
  ],
  membersByRoot: {
    [ROOT_A]: [
      { childSessionId: childSessionIdFor(ROOT_A, MEMBER_A_ID), instanceId: MEMBER_A_ID, templateId: 'tpl-gate' },
    ],
    [ROOT_B]: [
      { childSessionId: childSessionIdFor(ROOT_B, MEMBER_B_ID), instanceId: MEMBER_B_ID, templateId: 'tpl-gate' },
    ],
  },
})

const resolveBoundBlueprint = (teamRootSid: string): unknown => {
  const row = domainDouble.repositories.teamSessions.get(teamRootSid)
  if (row === undefined) {
    throw new Error(`resolveBoundBlueprint(${teamRootSid}): no durable TeamSession row (the gate's resolver is strict, like the host)`)
  }
  const ref = (row as { blueprint?: BlueprintSnapshotRef }).blueprint
  if (ref === undefined) {
    return parseBlueprint(A_SOURCE)
  }
  return authority.resolveSnapshot(ref)
}

const glue = await loadGlueModule()
const agents = createAgentsDouble()
const config = {
  bootPhase: 'create',
  rootSessionId: ROOT_A,
  blueprintSource: A_SOURCE,
  generation: 1,
  defaultWorkspace: join(WORKTREE_ROOT, 'default-workspace'),
  seedMembers: [],
  staticModel: { provider: 'gate-baseline', model: 'gate-model' },
  deniedSelection: { provider: 'gate-denied', model: 'gate-denied-model' },
  mcpServer: null,
  environmentFacts: [],
  externalPolicyFacts: { hard: {}, capabilityExists: {} },
}

/** The live-binding surface the gate consumes (the glue returns `object` per the bridge's declaration). */
interface GateBinding {
  boot(): Promise<void>
  close(): Promise<void>
  createRootAgent(rootSessionId: string): Promise<unknown>
  ensureLiveAgent(sessionId: string): Promise<unknown>
  childFactory: {
    createChildSession(input: {
      rootSessionId: string
      instanceId: string
      templateId: string
      label?: string
    }): Promise<{ childSessionId: string }>
  }
}

function makeBindings(): GateBinding {
  return glue.createAgentBindings({
    agents,
    sessionPersistence: createSessionPersistenceDouble(),
    domain: domainDouble,
    config,
    teamToolsRef: { current: TEAM_TOOLS },
    controlServiceRef: { current: CONTROL_STUB },
    now: () => '2026-08-29T12:00:00Z',
    agentPresets: createAgentPresetsDouble(),
    fsBackend: (agentCtx: unknown) => (agentCtx as { fs: unknown }).fs,
    resolveBoundBlueprint,
  }) as unknown as GateBinding
}

const binding = makeBindings()
await binding.boot()
await binding.createRootAgent(ROOT_A)
await binding.createRootAgent(ROOT_B)
const childA = await binding.childFactory.createChildSession({
  rootSessionId: ROOT_A,
  instanceId: MEMBER_A_ID,
  templateId: 'tpl-gate',
  label: 'gate-a-member',
})
const childB = await binding.childFactory.createChildSession({
  rootSessionId: ROOT_B,
  instanceId: MEMBER_B_ID,
  templateId: 'tpl-gate',
  label: 'gate-b-member',
})

// --- the live-state captures -------------------------------------------------------

function scopedPersona(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic test-double surface
  handle: any,
): AssembledPromptSection | undefined {
  const ctx = handle?.agent?.ctx as unknown as AgentCtxDouble | undefined
  if (ctx === undefined) return undefined
  return ctx.systemPrompt.assemble().find(
    (section) => section.name === 'deployment:persona' && section.scope === 'scoped',
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic test-double surface
function toolNames(handle: any): string[] {
  const ctx = handle?.agent?.ctx as unknown as AgentCtxDouble | undefined
  return (ctx?.registeredTools ?? []).map((t) => (t as { name: string }).name)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic test-double surface
function denyUnion(handle: any): string[] {
  const ctx = handle?.agent?.ctx as unknown as AgentCtxDouble | undefined
  return (ctx?.toolRestrictions ?? []).flatMap((r) => r.deny ?? [])
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic test-double surface
function hasPermissionListener(handle: any): boolean {
  const ctx = handle?.agent?.ctx as unknown as AgentCtxDouble | undefined
  return (ctx?.listeners ?? []).some((l) => l.event === 'tools/pre-execute' && l.active)
}

const rootAHandle = agents.handles.get(ROOT_A)
const rootBHandle = agents.handles.get(ROOT_B)
const memberAHandle = agents.handles.get(childA.childSessionId)
const memberBHandle = agents.handles.get(childB.childSessionId)

const liveRootAPersona = scopedPersona(rootAHandle)?.text ?? ''
const liveRootBPersona = scopedPersona(rootBHandle)?.text ?? ''
const liveMemberAPersona = scopedPersona(memberAHandle)?.text ?? ''
const liveMemberBPersona = scopedPersona(memberBHandle)?.text ?? ''
const liveMemberATools = toolNames(memberAHandle)
const liveMemberBTools = toolNames(memberBHandle)
const liveMemberADeny = denyUnion(memberAHandle)
const liveMemberBDeny = denyUnion(memberBHandle)
const liveMemberAPerms = hasPermissionListener(memberAHandle)
const liveMemberBPerms = hasPermissionListener(memberBHandle)

const registryRows = domain.repositories.blueprintRegistry.list()

// --- the COLD RESUME (a fresh glue instance — a process restart) --------------------
//
// The saved sources are DELETED first: a frozen revision replays the
// registry row's stored source text (the plan's DoD — source deletion /
// mis-edit never breaks the old Team's resolve / cold resume). The fresh
// bindings instance starts with an EMPTY per-root blueprint cache, so
// every assertion below proves the durable chain (row ref -> authority ->
// registry -> hash), never a warm cache.

destroyDir(sourcesDir)

const home = scratchDir('bp1-gate-home')
writeDurableFixture(home, ROOT_A)
writeDurableFixture(home, ROOT_B)
writeDurableFixture(home, childA.childSessionId)
writeDurableFixture(home, childB.childSessionId)

let resumedRootAPersona = ''
let resumedRootBPersona = ''
let resumedMemberAPersona = ''
let resumedMemberBPersona = ''
let resumedMemberATools: string[] = []
let resumedMemberBTools: string[] = []
let resumedMemberADeny: string[] = []
let resumedMemberBDeny: string[] = []

const binding2 = makeBindings()
await withDshHome(home, async () => {
  // cold-root resumes (the fresh binding's live table is empty)
  await binding2.ensureLiveAgent(ROOT_A)
  await binding2.ensureLiveAgent(ROOT_B)
  // cold-member resumes under their OWNING roots
  await binding2.ensureLiveAgent(childA.childSessionId)
  await binding2.ensureLiveAgent(childB.childSessionId)
})
const resRootAHandle = agents.handles.get(ROOT_A)
const resRootBHandle = agents.handles.get(ROOT_B)
const resMemberAHandle = agents.handles.get(childA.childSessionId)
const resMemberBHandle = agents.handles.get(childB.childSessionId)
resumedRootAPersona = scopedPersona(resRootAHandle)?.text ?? ''
resumedRootBPersona = scopedPersona(resRootBHandle)?.text ?? ''
resumedMemberAPersona = scopedPersona(resMemberAHandle)?.text ?? ''
resumedMemberBPersona = scopedPersona(resMemberBHandle)?.text ?? ''
resumedMemberATools = toolNames(resMemberAHandle)
resumedMemberBTools = toolNames(resMemberBHandle)
resumedMemberADeny = denyUnion(resMemberAHandle)
resumedMemberBDeny = denyUnion(resMemberBHandle)

await binding2.close()
await binding.close()
removeFixtureHome(home)
destroyDir(dir)

// --- the assertions (sync it() bodies) ----------------------------------------------

describe('BP-F dual-Team architecture gate (plan §11.3): per-Team Blueprint authority isolation', () => {
  it('the freeze barrier (BP6 production effect) froze BOTH snapshots in the real registry', () => {
    expect(registryRows.length).toBe(2)
    const a = registryRows.find((r) => r.blueprintId === A_REF.blueprintId && r.revision === A_REF.revision)
    const b = registryRows.find((r) => r.blueprintId === B_REF.blueprintId && r.revision === B_REF.revision)
    expect(a?.contentHash).toBe(A_REF.contentHash)
    expect(b?.contentHash).toBe(B_REF.contentHash)
    // the registry stores the SOURCE TEXT (not just the hash) — the replay basis
    expect(a?.source).toBe(A_SOURCE)
    expect(b?.source).toBe(B_SOURCE)
  })

  it('the A root agent gets ONLY A: the leader persona is A bound snapshot text, never B and never a leak of B', () => {
    expect(liveRootAPersona.startsWith(A_LEADER_PERSONA)).toBe(true)
    expect(liveRootAPersona.indexOf(B_LEADER_PERSONA) === -1).toBe(true)
  })

  it('the B root agent gets ONLY B: the leader persona is B bound snapshot text', () => {
    expect(liveRootBPersona.startsWith(B_LEADER_PERSONA)).toBe(true)
    expect(liveRootBPersona.indexOf(A_LEADER_PERSONA) === -1).toBe(true)
  })

  it('the A member gets ONLY A: persona + the A teamTools allowlist + the A builtinToolDeny + a permission listener', () => {
    expect(liveMemberAPersona.startsWith(A_MEMBER_PERSONA)).toBe(true)
    expect(liveMemberATools.sort()).toEqual(['assign-task', 'send-message'])
    expect(liveMemberADeny).toEqual(['fs.write'])
    expect(liveMemberAPerms).toBe(true)
  })

  it('the B member gets ONLY B: persona + the B teamTools allowlist + the B builtinToolDeny + a permission listener', () => {
    expect(liveMemberBPersona.startsWith(B_MEMBER_PERSONA)).toBe(true)
    expect(liveMemberBTools.sort()).toEqual(['create-member', 'report-progress'])
    expect(liveMemberBDeny).toEqual(['fs.read'])
    expect(liveMemberBPerms).toBe(true)
  })

  it('A-only-A / B-only-B: the two members share the template id but never the other team tools or the other deny', () => {
    for (const bTool of ['create-member', 'report-progress']) {
      expect(liveMemberATools.indexOf(bTool)).toBe(-1)
    }
    for (const aTool of ['assign-task', 'send-message']) {
      expect(liveMemberBTools.indexOf(aTool)).toBe(-1)
    }
    expect(liveMemberADeny.indexOf('fs.read')).toBe(-1)
    expect(liveMemberBDeny.indexOf('fs.write')).toBe(-1)
  })

  it('cold resume (a FRESH glue instance) re-resolves each agent to the SAME bound snapshot — even after the saved sources are DELETED (the frozen registry row replays)', () => {
    expect(resumedRootAPersona.startsWith(A_LEADER_PERSONA)).toBe(true)
    expect(resumedRootBPersona.startsWith(B_LEADER_PERSONA)).toBe(true)
    expect(resumedMemberAPersona.startsWith(A_MEMBER_PERSONA)).toBe(true)
    expect(resumedMemberBPersona.startsWith(B_MEMBER_PERSONA)).toBe(true)
    expect(resumedMemberATools.sort()).toEqual(['assign-task', 'send-message'])
    expect(resumedMemberBTools.sort()).toEqual(['create-member', 'report-progress'])
    expect(resumedMemberADeny).toEqual(['fs.write'])
    expect(resumedMemberBDeny).toEqual(['fs.read'])
  })

  it('the cold-resume re-resolution is STABLE against the live state (A stays A, B stays B — no convergence to the row anchor)', () => {
    expect(resumedMemberAPersona.startsWith(B_MEMBER_PERSONA)).toBe(false)
    expect(resumedMemberBPersona.startsWith(A_MEMBER_PERSONA)).toBe(false)
    // the row anchor (A) must not leak into Team B after the restart
    expect(resumedMemberBPersona.indexOf(A_MEMBER_PERSONA) === -1).toBe(true)
    expect(resumedRootBPersona.indexOf(A_LEADER_PERSONA) === -1).toBe(true)
  })
})
