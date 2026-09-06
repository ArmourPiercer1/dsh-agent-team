/**
 * d3-member-identity-context.test.ts — Team D1-D6 repair v2 (B2 / D3):
 * the MEMBER persona branch appends the machine-readable Team identity
 * context block to the member's scoped persona section.
 *
 * The field report (D3, docs/local-issues/team-member-context-missing-root-
 * session.md): a member child agent's system prompt carries the blueprint
 * member persona but NO machine-readable Team identity — no canonical
 * owning rootSessionId, no own instanceId, no role, no requestToken rule —
 * so a member that registers the ten team_* tools cannot construct a
 * legal call (the closed layer rejects the guessed envelope).
 *
 * The fix under test is the member branch of
 * `getPersonaSlot().promptSurface.installScopedPersona` (agent-bindings.
 * mjs) — the SAME install seam the root branch uses (both fresh-member
 * create and cold-member resume flow through installPersonaForSetup),
 * which appends:
 *
 *   [team-member-context rootSessionId="<root>" instanceId="<instance>" role="member"]
 *   Every team_* tool call must include rootSessionId="<root>" and a fresh unique requestToken; do not use another team's rootSessionId or another member's instanceId.
 *
 * Contract (asserted at the REAL glue boundary through the t12a-live-
 * bridge doubles — the real agent-bindings.mjs — with the REAL ten-tool
 * createTeamTools stack over the P6-T2 durable world, wired with the glue's
 * OWN resolveCaller exactly as the production root wires it):
 *   D3-1 FRESH member create: the boot-seeded member, a fresh member under
 *        the second root N (the committed-row path), and a fresh member
 *        under N in the pre-commit window (the instanceIdHint path) all
 *        carry the block with the OWNING root + the member's own
 *        instanceId + role=member, appended to the verbatim template
 *        persona;
 *   D3-2 COLD RESUME: the booted member is dropped (host restart), the
 *        durable session is on disk, the first input cold-resumes it —
 *        the resumed scoped persona is BYTE-IDENTICAL to the create-time
 *        one (fresh/resume consistency through the shared setup);
 *   D3-3 CROSS-ROOT: a member of the non-boot root N (row committed under
 *        N) gets the block with N — never the boot root — on BOTH the
 *        fresh create and the cold resume (teamRootOfSession resolves the
 *        owning root); the N root agent itself keeps the ROOT block only
 *        (no member-block leak into the root branch);
 *   D3-4 FAIL CLOSED: a member team_* call with an unknown rootSessionId
 *        is rejected TEAM_RUNTIME_TEAM_SESSION_NOT_FOUND, with a root the
 *        member does not belong to rejected TEAM_RUNTIME_CALLER_NOT_FOUND,
 *        with a missing rootSessionId rejected TEAM_TOOL_BAD_ARGUMENTS —
 *        the block never bypasses the closed layer (status is never
 *        'executed'); a committed member whose setup is attempted under a
 *        foreign root (no row there, no hint) has the setup REJECT — no
 *        block with the foreign root is ever installed;
 *   D3-5 repeated setup for the same agent converges to exactly ONE
 *        scoped deployment:persona section with unchanged text (the
 *        re-install disposes the previous entry first).
 */
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  WORKTREE_ROOT,
  createAgentPresetsDouble,
  createLiveWorld,
  removeFixtureHome,
  withDshHome,
  writeDurableFixture,
} from './t12a-live-bridge.mjs'
import { destroyP6T1World } from './p6t1-helpers.js'
import { destroyDir, scratchDir } from '../../testkit/fault-injection/file-seam.mjs'
import { P6T2_NOW, P6T2_ROOT, P6T2_SEEDS } from './p6t2-helpers.js'
import { createP6T6World, execFor } from '../../tools/test/p6t6-helpers.js'
import { createTeamTools } from '../../tools/src/index.js'
import type { TeamToolsResult } from '../../tools/src/index.js'
import { TEAM_TOOL_BAD_ARGUMENTS } from '../../tools/src/tokens.js'
import {
  createBlueprintSnapshotRef,
  parseBlueprintContentHash,
  parseBlueprintId,
  parseBlueprintRevision,
  parseRootSessionId,
} from '../../contracts/src/index.js'

// Minimal structural types for the t12a-live-bridge doubles (the .mjs bridge
// does not export its types; import type from it would be erased at runtime,
// but this keeps the assertions checked without the dependency).
interface AssembledPromptSection {
  name: string
  order: number
  text: string
  scope: 'global' | 'scoped'
}
interface AgentCtxDouble {
  registeredTools: unknown[]
  systemPrompt: { assemble(): AssembledPromptSection[] }
}
/** The glue's public agentSetup factory signature (agent-bindings.mjs). */
type AgentSetupFn = (
  sessionId: string,
  instanceIdHint: string | undefined,
  templateIdHint: string | undefined,
  bindPath: string,
  teamRootSid: string,
) => (ctx: unknown) => Promise<void>

const LEADER_PERSONA = 'You are the leader of the t12a test team.'
const MEMBER_PERSONA = 'You are member t12a-worker of the t12a test team.'

/** The world's BOOT root = the P6-T2 durable team root (the pre-existing team). */
const BOOT = P6T2_ROOT
/** The second root: a freshly created TeamSession / team-root binding of the same row. */
const N = 'session-d3-member-ctx-n'
/** The boot root's seeded member (its bound child session in the P6-T2 world). */
const WORKER = {
  instanceId: P6T2_SEEDS.worker.instanceId,
  templateId: 't12a-worker',
  label: P6T2_SEEDS.worker.label,
  childSessionId: P6T2_SEEDS.worker.childSessionId,
}
/** A member of the second root N (its row IS committed under N). */
const CROSS = { instanceId: 'inst-d3crossroot', templateId: 't12a-worker' }
/** A member of N in the fresh-create window (NO committed row: the hint path). */
const HINT = { instanceId: 'inst-d3hint', templateId: 't12a-worker' }
/** An unknown root (no durable TeamSession row anywhere). */
const UNKNOWN_ROOT = 'session-d3-unknown-root'

/**
 * Mirror of the glue's childSessionIdFor (T12-B2 deterministic derivation,
 * agent-bindings.mjs): `${root}\u0000${instance}` -> SHA-256 -> first 32
 * hex chars. The D3-3 world needs the N member's child id BEFORE the
 * bridge world is built (its membersByRoot carries it); the derivation
 * guard below pins that this mirror still matches the glue's own
 * `childSessionIdFor` (a drift fails loudly).
 */
const childId = (root: string, instanceId: string): string =>
  `session-team-child-${createHash('sha256').update(`${root}\u0000${instanceId}`, 'utf8').digest('hex').slice(0, 32)}`
const CROSS_CHILD = childId(N, CROSS.instanceId)

/**
 * The concise machine-readable Team identity context the glue appends to
 * the MEMBER agent's scoped persona section (must stay byte-identical to
 * agent-bindings.mjs `memberTeamContextBlock`).
 */
const memberContext = (root: string, instanceId: string): string =>
  `[team-member-context rootSessionId="${root}" instanceId="${instanceId}" role="member"]\n` +
  `Every team_* tool call must include rootSessionId="${root}" and a fresh unique requestToken; do not use another team's rootSessionId or another member's instanceId.`

/** The root context block (the pre-existing TCM-D4 shape — the control). */
const rootContext = (sid: string): string =>
  `[team-root-context rootSessionId=${sid} leaderInstanceId=inst-leader]\n` +
  `Every team_* tool call must include rootSessionId="${sid}" and a unique requestToken.`

function scopedPersona(ctx: AgentCtxDouble): AssembledPromptSection | undefined {
  return ctx.systemPrompt.assemble().find(
    (section) => section.name === 'deployment:persona' && section.scope === 'scoped',
  )
}

function scopedPersonaEntries(ctx: AgentCtxDouble): AssembledPromptSection[] {
  return ctx.systemPrompt.assemble().filter(
    (section) => section.name === 'deployment:persona' && section.scope === 'scoped',
  )
}

// ── the REAL durable team world (P6-T2) + the second root N ─────────────────
// Pre-create cleanup: the fixed scratch basename (see p6t1-helpers
// scratchDir) survives a failed prior run (module-level world creation
// throws before afterAll can destroy it), which would fail every
// subsequent run with "team_domain already exists". Destroying first
// keeps this suite re-runnable on a dirty checkout.
destroyDir(scratchDir('d3-member-identity'))
const p6t6 = await createP6T6World('d3-member-identity')

// Seed the second root N into the durable domain exactly the way the
// production create path persists it: the TeamSession row (bound to this
// world's blueprint snapshot) + the team-root binding.
{
  const bp = p6t6.world.blueprint
  await p6t6.world.domain.repositories.teamSessions.put({
    rootSessionId: parseRootSessionId(N),
    blueprint: createBlueprintSnapshotRef({
      blueprintId: parseBlueprintId(String(bp.blueprintId)),
      revision: parseBlueprintRevision(String(bp.revision)),
      contentHash: parseBlueprintContentHash(String(bp.contentHash)),
    }),
    defaultWorkspace: 'C:/agent-team/work/d3',
    createdAt: P6T2_NOW,
    generation: 1,
  })
  await p6t6.world.domain.repositories.sessionBindings.put({
    kind: 'team-root',
    schemaVersion: 1,
    sessionId: parseRootSessionId(N),
  })
}

// The live world: the boot root is the P6-T2 team root; the domain double
// carries BOTH durable TeamSession rows (the multi-root world) + the boot
// root's member row + the N root's committed member row (CROSS_CHILD).
const world = await createLiveWorld({
  rootSessionId: BOOT,
  agentPresets: createAgentPresetsDouble(),
  members: [{ childSessionId: WORKER.childSessionId, instanceId: WORKER.instanceId, templateId: WORKER.templateId }],
  membersByRoot: {
    [N]: [{ childSessionId: CROSS_CHILD, instanceId: CROSS.instanceId, templateId: CROSS.templateId }],
  },
  teamSessions: [
    { rootSessionId: BOOT, sessionId: BOOT, blueprintId: 'P6T2-BP', generation: 1 },
    { rootSessionId: N, sessionId: N, blueprintId: 'P6T2-BP', generation: 1 },
  ],
  configOverrides: {
    mcpServer: null,
    seedMembers: [WORKER],
  },
})

// The bridge .d.mts declares `binding` as `object & {...}` without agentSetup
// (the D3-5 / D3-4 probes reach the public factory directly); structural
// cast to the glue's public signature keeps the calls checked.
const agentSetup: AgentSetupFn = (world.binding as unknown as { agentSetup: AgentSetupFn }).agentSetup

// The production wiring (root.ts A04): the REAL ten-tool stack over the
// P6-T2 runtime + satellites, with the GLUE's OWN resolveCaller as the
// caller port — filled into teamToolsRef BEFORE boot.
const toolStack = createTeamTools({
  teamRuntime: p6t6.runtime,
  controlService: p6t6.control,
  messaging: p6t6.messaging,
  activity: p6t6.activity,
  resolveCaller: world.binding.resolveCaller,
})
world.teamToolsRef.current = toolStack

await world.binding.boot()
await world.binding.createRootAgent(N)

// D3-1: the FRESH member creates under N — the committed-row path (CROSS:
// its row is under N) and the fresh-create window (HINT: no row yet; the
// instanceIdHint bridges the pre-commit window). Both resolve under the
// request's owning root N (childFactory TCM-D4 threading).
const freshCross = await world.binding.childFactory.createChildSession({
  rootSessionId: N,
  instanceId: CROSS.instanceId,
  templateId: CROSS.templateId,
  label: 'd3-cross',
})
const freshHint = await world.binding.childFactory.createChildSession({
  rootSessionId: N,
  instanceId: HINT.instanceId,
  templateId: HINT.templateId,
  label: 'd3-hint',
})

const workerCtx = world.agents.handles.get(WORKER.childSessionId)!.agent.ctx as unknown as AgentCtxDouble
const nCtx = world.agents.handles.get(N)!.agent.ctx as unknown as AgentCtxDouble
const crossCtx = world.agents.handles.get(freshCross.childSessionId)!.agent.ctx as unknown as AgentCtxDouble
const hintCtx = world.agents.handles.get(freshHint.childSessionId)!.agent.ctx as unknown as AgentCtxDouble

// Snapshot EVERY live read BEFORE the close() below (the it() bodies run
// after the top-level setup; disposed registrations would empty the sections).
const workerPersonaBefore = scopedPersona(workerCtx)
const nPersonaBefore = scopedPersona(nCtx)
const crossPersonaBefore = scopedPersona(crossCtx)
const hintPersonaBefore = scopedPersona(hintCtx)
const workerPersonaTextBefore = workerPersonaBefore?.text

// D3-5: repeated setup for the same agent (the public agentSetup factory re-
// run on the SAME live ctx): the re-install disposes the previous scoped
// entry first, so exactly one section remains with unchanged text.
{
  await agentSetup(WORKER.childSessionId, WORKER.instanceId, WORKER.templateId, 'fresh-member', BOOT)(
    workerCtx,
  )
}
const workerPersonaEntriesAfterRepeat = scopedPersonaEntries(workerCtx)

// D3-4: the closed tool layer — the REAL ten-tool stack executed as the
// boot worker with wrong/missing root claims.
async function runGlueTool(name: string, args: Record<string, unknown>, sessionId: string): Promise<TeamToolsResult> {
  const tool = toolStack.tools.find((candidate) => candidate.name === name)
  if (tool === undefined) throw new Error(`d3-member-identity: no registered tool named ${name}`)
  return (await tool.execute(args, execFor(sessionId))) as TeamToolsResult
}

const listUnknownRoot = await runGlueTool(
  'team_list_members',
  { rootSessionId: UNKNOWN_ROOT, requestToken: 'tok-d3-unknown-root' },
  WORKER.childSessionId,
)
const listForeignRoot = await runGlueTool(
  'team_list_members',
  { rootSessionId: N, requestToken: 'tok-d3-foreign-root' },
  WORKER.childSessionId,
)
const listMissingRoot = await runGlueTool('team_list_members', { requestToken: 'tok-d3-missing-root' }, WORKER.childSessionId)

// D3-4 (setup level): a committed member whose setup is attempted under a
// FOREIGN root (its row is under the boot root, not N; no hint in the cold
// shape) must fail closed — the setup rejects and no block with the foreign
// root is ever installed. A throwaway ctx keeps the probe off the real
// handles (all snapshots above are already taken).
const foreignProbe = (await world.agents.create({ sessionId: 'session-d3-foreign-probe' })) as unknown as {
  agent: { ctx: unknown }
}
const foreignCtx = foreignProbe.agent.ctx as unknown as AgentCtxDouble
const foreignSetupError = await (async () => {
  try {
    await agentSetup(WORKER.childSessionId, undefined, undefined, 'cold-member', N)(foreignCtx)
    return undefined
  } catch (error) {
    return error
  }
})()
const foreignCtxPersonaEntries = scopedPersonaEntries(foreignCtx)

// D3-2 / D3-3: the COLD RESUME window (host restart): the resident handles
// are dropped, the durable sessions are on disk, the FIRST INPUT
// cold-resumes each member through agents.resume under its OWNING root
// (the shared setup — the same install seam as the create paths).
const droppedWorker = await world.binding.dropResidency(WORKER.childSessionId)
const droppedCross = await world.binding.dropResidency(freshCross.childSessionId)
const resumeHome = `${WORKTREE_ROOT}/.tmp-d3-home`
await withDshHome(resumeHome, async () => {
  writeDurableFixture(resumeHome, WORKER.childSessionId)
  writeDurableFixture(resumeHome, freshCross.childSessionId)
  await world.binding.sessionInput.submitAttributedInput({
    sessionId: WORKER.childSessionId,
    text: 'worker first chat after the restart',
    attribution: {
      kind: 'team-relay',
      intendedForInstanceId: WORKER.instanceId,
      correlation: { requestToken: 'tok-d3-resume-worker', factSequence: 1 },
    },
  })
  await world.binding.sessionInput.submitAttributedInput({
    sessionId: freshCross.childSessionId,
    text: 'cross-root member first chat after the restart',
    attribution: {
      kind: 'team-relay',
      intendedForInstanceId: CROSS.instanceId,
      correlation: { requestToken: 'tok-d3-resume-cross', factSequence: 1 },
    },
  })
})
removeFixtureHome(resumeHome)

const workerCtxAfterResume = world.agents.handles.get(WORKER.childSessionId)!.agent.ctx as unknown as AgentCtxDouble
const crossCtxAfterResume = world.agents.handles.get(freshCross.childSessionId)!.agent.ctx as unknown as AgentCtxDouble
const workerPersonaAfterResume = scopedPersona(workerCtxAfterResume)
const crossPersonaAfterResume = scopedPersona(crossCtxAfterResume)
const resumesAfterResume = [...world.records.resumes]

// Close disposes every registration; the world is torn down.
await world.binding.close()
await destroyP6T1World(p6t6.world)

describe('D3 the member identity context block (Team D1-D6 repair v2, B2)', () => {
  it('D3-1 FRESH member create: the scoped persona carries the identity block (owning root + own instanceId + role=member) on the verbatim template persona', () => {
    // Derivation guard: the mirrored child-id helper still matches the
    // glue's own deterministic derivation (a drift would break the D3-3
    // world wiring silently).
    expect(world.binding.childSessionIdFor(N, CROSS.instanceId)).toBe(freshCross.childSessionId)
    expect(freshCross.childSessionId).toBe(CROSS_CHILD)
    // The boot-seeded member (fresh create under the boot root): the block
    // is appended to the verbatim template persona, with the OWNING boot
    // root and the member's own instanceId.
    expect(workerPersonaBefore !== undefined).toBe(true)
    expect(workerPersonaBefore!.text).toBe(`${MEMBER_PERSONA}\n\n${memberContext(BOOT, WORKER.instanceId)}`)
    expect(workerPersonaBefore!.order).toBe(0)
    // A fresh member under the non-boot root N (committed-row path): the
    // block carries N, never the boot root.
    expect(crossPersonaBefore !== undefined).toBe(true)
    expect(crossPersonaBefore!.text).toBe(`${MEMBER_PERSONA}\n\n${memberContext(N, CROSS.instanceId)}`)
    expect(crossPersonaBefore!.text.includes(`rootSessionId="${N}"`)).toBe(true)
    expect(crossPersonaBefore!.text.includes(BOOT)).toBe(false)
    // A fresh member under N in the pre-commit window (the instanceIdHint
    // path — the row commits AFTER the setup): the SAME block shape, the
    // hint's instanceId, the owning root N.
    expect(hintPersonaBefore !== undefined).toBe(true)
    expect(hintPersonaBefore!.text).toBe(`${MEMBER_PERSONA}\n\n${memberContext(N, HINT.instanceId)}`)
    // The block carries the three facts the member model cannot guess:
    // the canonical owning rootSessionId, the own instanceId, the member
    // role, and the per-call fresh-unique-requestToken rule.
    expect(workerPersonaBefore!.text.includes(`rootSessionId="${BOOT}"`)).toBe(true)
    expect(workerPersonaBefore!.text.includes(`instanceId="${WORKER.instanceId}"`)).toBe(true)
    expect(workerPersonaBefore!.text.includes('role="member"')).toBe(true)
    expect(workerPersonaBefore!.text.includes('a fresh unique requestToken')).toBe(true)
  })

  it("D3-2 COLD RESUME: the resumed member's scoped persona is byte-identical to the create-time one (shared install seam)", () => {
    // The resident handle was dropped (the durable session stays on disk).
    expect(droppedWorker).toEqual({ dropped: true })
    // The first input after the restart cold-resumes the member through
    // agents.resume — with the shared setup.
    const resume = resumesAfterResume.find((entry) => entry.sessionId === WORKER.childSessionId)
    expect(resume !== undefined).toBe(true)
    expect(resume!.setupProvided).toBe(true)
    // The resumed scoped persona carries the SAME identity block — byte
    // identical to the create-time text (fresh/resume consistency: the
    // same owning root + the same durable instanceId).
    expect(workerPersonaAfterResume !== undefined).toBe(true)
    expect(workerPersonaAfterResume!.text).toBe(workerPersonaTextBefore)
    expect(workerPersonaAfterResume!.text).toBe(`${MEMBER_PERSONA}\n\n${memberContext(BOOT, WORKER.instanceId)}`)
  })

  it('D3-3 CROSS-ROOT: the N member gets the owning root N — never the boot root — on fresh create AND cold resume; the N root keeps only the root block', () => {
    // Fresh create under N: the block carries N (asserted in D3-1); here
    // the COLD RESUME — teamRootOfSession resolves the owning root from
    // the durable rows (the boot root is NOT a fallback).
    expect(droppedCross).toEqual({ dropped: true })
    const resume = resumesAfterResume.find((entry) => entry.sessionId === freshCross.childSessionId)
    expect(resume !== undefined).toBe(true)
    expect(resume!.setupProvided).toBe(true)
    expect(crossPersonaAfterResume !== undefined).toBe(true)
    expect(crossPersonaAfterResume!.text).toBe(`${MEMBER_PERSONA}\n\n${memberContext(N, CROSS.instanceId)}`)
    // Byte-identical across the restart, and the boot root's id never
    // appears in the member's context.
    expect(crossPersonaAfterResume!.text).toBe(crossPersonaBefore!.text)
    expect(crossPersonaAfterResume!.text.includes(`rootSessionId="${N}"`)).toBe(true)
    expect(crossPersonaAfterResume!.text.includes(BOOT)).toBe(false)
    // Control — the N ROOT agent keeps the pre-existing ROOT block (with
    // N's own canonical id) and the member block does NOT leak into the
    // root branch.
    expect(nPersonaBefore !== undefined).toBe(true)
    expect(nPersonaBefore!.text).toBe(`${LEADER_PERSONA}\n\n${rootContext(N)}`)
    expect(nPersonaBefore!.text.includes('[team-member-context')).toBe(false)
  })

  it('D3-4 FAIL CLOSED: wrong/missing rootSessionId stays rejected at the closed tool layer; a foreign-root setup rejects without installing a block', () => {
    // The block tells the model what to include; the closed layer stays
    // closed either way — no status 'executed' for any wrong claim.
    expect(listUnknownRoot.status).toBe('rejected')
    if (listUnknownRoot.status === 'rejected') {
      expect(listUnknownRoot.code).toBe('TEAM_RUNTIME_TEAM_SESSION_NOT_FOUND')
    }
    expect(listForeignRoot.status).toBe('rejected')
    if (listForeignRoot.status === 'rejected') {
      expect(listForeignRoot.code).toBe('TEAM_RUNTIME_CALLER_NOT_FOUND')
    }
    expect(listMissingRoot.status).toBe('rejected')
    if (listMissingRoot.status === 'rejected') {
      expect(listMissingRoot.code).toBe(TEAM_TOOL_BAD_ARGUMENTS)
    }
    expect(listUnknownRoot.status === 'executed').toBe(false)
    expect(listForeignRoot.status === 'executed').toBe(false)
    expect(listMissingRoot.status === 'executed').toBe(false)
    // The setup-level fail-closed: the committed boot member attempted
    // under the foreign root N (no row there, no hint) rejects the setup —
    // no block with the foreign root is ever installed.
    expect(foreignSetupError instanceof Error).toBe(true)
    expect((foreignSetupError as Error).message).toContain('fail closed')
    expect(foreignCtxPersonaEntries.length).toBe(0)
  })

  it('D3-5 repeated setup converges: exactly ONE scoped deployment:persona section, unchanged text', () => {
    expect(workerPersonaEntriesAfterRepeat.length).toBe(1)
    expect(workerPersonaEntriesAfterRepeat[0]!.text).toBe(workerPersonaTextBefore)
    expect(workerPersonaEntriesAfterRepeat[0]!.scope).toBe('scoped')
    expect(workerPersonaEntriesAfterRepeat[0]!.order).toBe(0)
  })
})
