/**
 * tcm-d4-root-context.test.ts — TCM-D4: a second root in a boot-root world
 * (a newly created TeamSession / team-root binding) is recognized as its
 * OWN leader by the live glue, every request boundary resolves the OWNING
 * root, and the root agent's model-visible scoped context carries the
 * canonical team facts.
 *
 * Field report (2026-09-06, user test round on the real machine): after
 * `team.create` with initial work the Root model could not call team_*
 * ("not a registered team caller") — the glue's caller map only knew the
 * BOOT root (inst-leader) and the boot root's bound members, so the newly
 * created team root's leader session was rejected at the tool layer with
 * TEAM_TOOL_CALLER_UNRESOLVED; after `team.create` with EMPTY initial work,
 * the first chat surfaced the model reporting "rootSessionId is absent" —
 * the root agent's prompt carried no canonical rootSessionId / requestToken
 * contract, so its team_* calls died at the closed argument validation.
 *
 * Contract (asserted at the REAL glue boundary through the t12a-live-bridge
 * doubles — the real agent-bindings.mjs — with the REAL ten-tool
 * createTeamTools stack over the P6-T2 durable world, wired with the glue's
 * OWN resolveCaller exactly as the production root wires it (root.ts A04)):
 *   D4-1 create setup: the boot root, the seeded boot-root member, AND the
 *        second root N all receive exactly the ten team tools — the same
 *        def objects from the real stack, in stack order;
 *   D4-2 resolveCaller: N resolves to ITS OWN leader (inst-leader — N is a
 *        team root of this row's domain via its durable TeamSession row),
 *        the boot root stays inst-leader, the boot-root member stays its
 *        member instance, an unknown session fails closed with the p6t6
 *        caller-map error (the boot root is NOT a fallback);
 *   D4-3 executeTool(N, team_list_members with rootSessionId N) succeeds
 *        end-to-end: the glue route (the request boundary under N's own
 *        root) + the real tool stack + the real runtime over N's durable
 *        row (executed, callerRole leader, members-listed); a missing
 *        rootSessionId is still rejected as bad arguments (closed layer);
 *   D4-4 model-visible scoped context: N's scoped persona = the leader
 *        persona + the concise machine-readable root Team context block
 *        (canonical rootSessionId N, the leader instanceId, and the
 *        rootSessionId + unique-requestToken contract); the boot root
 *        carries its OWN id; the member keeps the template persona
 *        verbatim, prefixed by the D3/B2 machine-readable member identity
 *        block (owning boot root + the member's own instanceId,
 *        role=member) — and the root block does NOT leak into the member
 *        branch (B2 superseded the v1 "no block for non-root agents"
 *        assertion);
 *   D4-5 request boundaries: deliverRootWork reaches the N root
 *        (token-leading); the attributed input + the delegate work reach
 *        the boot-root member (the boot-root behavior is unchanged —
 *        resolved under the boot root);
 *   D4-6 the COLD RESUME (host-restart window: dropResidency + durable
 *        session + the first chat on N) re-registers the ten tools on the
 *        resumed N through the agents.resume setup under its OWN root and
 *        keeps the context block; the followup lands on N;
 *   D4-7 close disposes every registration (HMR safety).
 */
import { describe, expect, it } from 'vitest'
import type { AgentCtxDouble, AssembledPromptSection } from './t12a-live-bridge.mjs'
import {
  WORKTREE_ROOT,
  createAgentPresetsDouble,
  createLiveWorld,
  removeFixtureHome,
  withDshHome,
  writeDurableFixture,
} from './t12a-live-bridge.mjs'
import { destroyP6T1World } from './p6t1-helpers.js'
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

/** The frozen ten-tool team vocabulary (the closed set — name drift fails). */
const EXPECTED_TOOL_NAMES = [
  'team_list_members',
  'team_list_templates',
  'team_inspect_config',
  'team_create_member',
  'team_delegate',
  'team_follow_up',
  'team_send_message',
  'team_report_progress',
  'team_request_control',
  'team_resolve_control',
]

/** The world's BOOT root = the P6-T2 durable team root (the pre-existing team). */
const BOOT = P6T2_ROOT
/** The second root: a freshly created TeamSession / team-root binding of the same row. */
const N = 'session-tcm-d4-root-n'
/** The boot root's seeded member (its bound child session in the P6-T2 world). */
const WORKER = {
  instanceId: P6T2_SEEDS.worker.instanceId,
  templateId: 't12a-worker',
  label: P6T2_SEEDS.worker.label,
  childSessionId: P6T2_SEEDS.worker.childSessionId,
}

const LEADER_PERSONA = 'You are the leader of the t12a test team.'
const MEMBER_PERSONA = 'You are member t12a-worker of the t12a test team.'

/**
 * The concise machine-readable root Team context the glue appends to the
 * ROOT agent's scoped persona section (must stay byte-identical to
 * agent-bindings.mjs `rootTeamContextBlock`).
 */
const rootContext = (sid: string): string =>
  `[team-root-context rootSessionId=${sid} leaderInstanceId=inst-leader]\n` +
  `Every team_* tool call must include rootSessionId="${sid}" and a unique requestToken.`

/**
 * The concise machine-readable member Team identity context the glue
 * appends to the MEMBER agent's scoped persona section (D3, B2; must stay
 * byte-identical to agent-bindings.mjs `memberTeamContextBlock`).
 */
const memberContext = (root: string, instanceId: string): string =>
  `[team-member-context rootSessionId="${root}" instanceId="${instanceId}" role="member"]\n` +
  `Every team_* tool call must include rootSessionId="${root}" and a fresh unique requestToken; do not use another teams rootSessionId or another members instanceId.`

function names(ctx: AgentCtxDouble): string[] {
  return ctx.registeredTools.map((def) => String((def as { name?: string }).name ?? ''))
}

function scopedPersona(ctx: AgentCtxDouble): AssembledPromptSection | undefined {
  return ctx.systemPrompt.assemble().find(
    (section) => section.name === 'deployment:persona' && section.scope === 'scoped',
  )
}

function followupText(index: number, followups: readonly { sessionId: string; message: unknown }[]): string {
  const content = (followups[index]!.message as { content: readonly { type: string; text: string }[] }).content
  return content[0]!.text
}

// ── the REAL durable team world (P6-T2) + satellites ──────────────────────
const p6t6 = await createP6T6World('tcm-d4-root-ctx')

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
    defaultWorkspace: 'C:/agent-team/work/tcm-d4',
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
// carries BOTH durable TeamSession rows (the multi-root world TCM-D4 fixes)
// and the boot root's member row; N has no members.
const world = await createLiveWorld({
  rootSessionId: BOOT,
  // D1 (v2): the member base-tool substrate (the member bind paths fail
  // closed without it — this world drives the boot root's seeded worker;
  // the D4 assertions about the ten team tools are unchanged: the mount
  // composes IN ADDITION to the team registration, it never replaces it).
  agentPresets: createAgentPresetsDouble(),
  members: [{ childSessionId: WORKER.childSessionId, instanceId: WORKER.instanceId, templateId: WORKER.templateId }],
  membersByRoot: { [N]: [] },
  teamSessions: [
    { rootSessionId: BOOT, sessionId: BOOT, blueprintId: 'P6T2-BP', generation: 1 },
    { rootSessionId: N, sessionId: N, blueprintId: 'P6T2-BP', generation: 1 },
  ],
  configOverrides: {
    mcpServer: null,
    seedMembers: [WORKER],
  },
})

// The production wiring (root.ts A04): the REAL ten-tool stack over the
// P6-T2 runtime + satellites, with the GLUE's OWN resolveCaller as the
// caller port — filled into teamToolsRef BEFORE boot, so the shared setup
// registers it on every agent ctx.
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

const bootCtx = world.agents.handles.get(BOOT)!.agent.ctx
const nCtx = world.agents.handles.get(N)!.agent.ctx
const workerCtx = world.agents.handles.get(WORKER.childSessionId)!.agent.ctx
// Snapshot EVERY live-read BEFORE the top-level close() runs (the it()
// bodies execute after the setup: a live ctx read there would see the
// disposed registrations).
const bootDefsAfterCreate = [...bootCtx.registeredTools]
const bootToolsAfterCreate = names(bootCtx)
const nToolsAfterCreate = names(nCtx)
const workerToolsAfterCreate = names(workerCtx)
const bootPersonaAfterCreate = scopedPersona(bootCtx)
const nPersonaAfterCreate = scopedPersona(nCtx)
const workerPersonaAfterCreate = scopedPersona(workerCtx)
const bootPersonaEntries = bootCtx.systemPrompt.assemble().filter((section) => section.name === 'deployment:persona')

// D4-2: the caller map (the tool layer's ONLY identity source).
const callerN = await world.binding.resolveCaller(N)
const callerBoot = await world.binding.resolveCaller(BOOT)
const callerWorker = await world.binding.resolveCaller(WORKER.childSessionId)
const callerUnknownError = await (async () => {
  try {
    await world.binding.resolveCaller('session-tcm-d4-unknown')
    return undefined
  } catch (error) {
    return error
  }
})()

// D4-3: the glue route on N (the request boundary runs under N's own root)
// + the REAL tool stack executed against N through the production caller
// port.
const routeN = await world.binding.executeTool(N, {
  name: 'team_list_members',
  args: { rootSessionId: N, requestToken: 'tok-d4-lm-n' },
  callId: 'd4-route-n',
})

async function runGlueTool(name: string, args: Record<string, unknown>, sessionId: string): Promise<TeamToolsResult> {
  const tool = toolStack.tools.find((candidate) => candidate.name === name)
  if (tool === undefined) throw new Error(`tcm-d4: no registered tool named ${name}`)
  return (await tool.execute(args, execFor(sessionId))) as TeamToolsResult
}

const listN = await runGlueTool('team_list_members', { rootSessionId: N, requestToken: 'tok-d4-lm-n' }, N)
// The control case: the model's "rootSessionId absent" call shape is still
// rejected by the closed argument validation (the context block tells the
// model what to include; the layer stays closed).
const listNMissingRoot = await runGlueTool('team_list_members', { requestToken: 'tok-d4-bad' }, N)

// D4-5: the request boundaries.
await world.binding.deliverRootWork({
  rootSessionId: N,
  requestToken: 'tok-d4-rw',
  prompt: 'kick off the plan',
})
await world.binding.sessionInput.submitAttributedInput({
  sessionId: WORKER.childSessionId,
  text: 'relay text for the worker',
  attribution: {
    kind: 'team-relay',
    intendedForInstanceId: WORKER.instanceId,
    correlation: { requestToken: 'tok-d4-relay', factSequence: 1 },
  },
})
await world.binding.workDelivery.deliver({
  childSessionId: WORKER.childSessionId,
  requestToken: 'tok-d4-wd',
  prompt: 'do the delegated work',
})
const followupsAfterBoundaries = [...world.records.followups]

// D4-6: the cold-resume window on N (the host restart between the create
// and the first chat): the resident handle is dropped, the durable session
// is on disk, the FIRST CHAT cold-resumes N through agents.resume.
const droppedN = await world.binding.dropResidency(N)
const resumeHome = `${WORKTREE_ROOT}/.tmp-tcm-d4-home`
await withDshHome(resumeHome, async () => {
  writeDurableFixture(resumeHome, N)
  await world.binding.sessionInput.submitAttributedInput({
    sessionId: N,
    text: 'first chat after the restart',
    attribution: {
      kind: 'team-relay',
      intendedForInstanceId: 'inst-leader',
      correlation: { requestToken: 'tok-d4-resume', factSequence: 1 },
    },
  })
})
removeFixtureHome(resumeHome)
const nHandleAfterResume = world.agents.handles.get(N)
const nCtxAfterResume = nHandleAfterResume === undefined ? undefined : nHandleAfterResume.agent.ctx
const nToolsAfterResume = nCtxAfterResume === undefined ? [] : names(nCtxAfterResume)
const nPersonaAfterResume = nCtxAfterResume === undefined ? undefined : scopedPersona(nCtxAfterResume)
const resumesAfterResume = [...world.records.resumes]
const followupsAfterResume = [...world.records.followups]

// D4-7: close disposes every registration (the ctx references stay live).
await world.binding.close()
const bootToolsAfterClose = names(bootCtx)
const workerToolsAfterClose = names(workerCtx)
const nToolsAfterClose = nCtxAfterResume === undefined ? [] : names(nCtxAfterResume)

await destroyP6T1World(p6t6.world)

describe('TCM-D4 the second root in a boot-root world (the freshly created team)', () => {
  it('D4-1 create/resume setup registers exactly the ten team tools on boot root, boot-root member, and second root N', () => {
    // The real factory emits the frozen vocabulary (guards the stack input).
    expect(toolStack.tools.map((tool) => tool.name)).toEqual(EXPECTED_TOOL_NAMES)
    // The boot root (leader) carries the full stack — the same def objects,
    // in stack order.
    expect(bootToolsAfterCreate).toEqual(EXPECTED_TOOL_NAMES)
    for (let i = 0; i < EXPECTED_TOOL_NAMES.length; i++) {
      expect(bootDefsAfterCreate[i]).toBe(toolStack.tools[i])
    }
    // The seeded boot-root member carries the same shared stack.
    expect(workerToolsAfterCreate).toEqual(EXPECTED_TOOL_NAMES)
    // The second root N — created AFTER boot (createRootAgent) — receives
    // the full stack through the SAME shared setup.
    expect(nToolsAfterCreate).toEqual(EXPECTED_TOOL_NAMES)
    // Every agent was created with the setup (boot root + member + N).
    expect(world.records.creates.length).toBe(3)
    expect(world.records.creates.every((create) => create.setupProvided)).toBe(true)
  })

  it('D4-2 resolveCaller: N is its OWN leader; the boot root and its member keep the pre-existing resolution; unknown fails closed', () => {
    // The freshly created team root resolves to its own leader instance —
    // the field-report failure ("not a registered team caller") is fixed.
    expect(callerN).toEqual({ kind: 'instance', instanceId: 'inst-leader' })
    // The boot root stays the leader of its own team (unchanged).
    expect(callerBoot).toEqual({ kind: 'instance', instanceId: 'inst-leader' })
    // The boot root's member stays its member instance (unchanged).
    expect(callerWorker).toEqual({ kind: 'instance', instanceId: WORKER.instanceId })
    // Unknown sessions fail closed with the p6t6 caller-map error — the
    // boot root is NOT a fallback for sessions it does not own.
    expect(callerUnknownError instanceof Error).toBe(true)
    expect((callerUnknownError as Error).message).toBe(
      'p6t6 caller map: no caller for session session-tcm-d4-unknown',
    )
  })

  it('D4-3 executeTool(N, team_list_members with rootSessionId N) succeeds end-to-end; a missing rootSessionId stays rejected', () => {
    // The glue route settles on the live N agent (the request boundary ran
    // under N's own root, not the boot root).
    expect(routeN).toEqual({ ok: true, callId: 'd4-route-n' })
    // The REAL tool stack + REAL runtime over N's durable row: the leader
    // caller resolves, the action executes against N.
    expect(listN.status).toBe('executed')
    if (listN.status !== 'executed') throw new Error('unreachable')
    expect(listN.action).toBe('list-members')
    expect(listN.rootSessionId).toBe(N)
    expect(listN.callerRole).toBe('leader')
    expect(listN.requestToken).toBe('tok-d4-lm-n')
    expect(listN.effect.kind).toBe('members-listed')
    if (listN.effect.kind === 'members-listed') {
      // N has no members yet — the fresh team is empty.
      expect(listN.effect.members.length).toBe(0)
    }
    // The closed layer still rejects the absent-rootSessionId shape (the
    // model is told by the context block what to include; the layer stays
    // closed either way).
    expect(listNMissingRoot.status).toBe('rejected')
    if (listNMissingRoot.status === 'rejected') {
      expect(listNMissingRoot.code).toBe(TEAM_TOOL_BAD_ARGUMENTS)
    }
  })

  it('D4-4 the model-visible scoped context: N carries the canonical rootSessionId N + leader id + call contract', () => {
    // N's scoped persona = the leader persona (verbatim) + the concise
    // machine-readable root Team context block with N's OWN canonical id.
    expect(nPersonaAfterCreate !== undefined).toBe(true)
    expect(nPersonaAfterCreate!.text).toBe(`${LEADER_PERSONA}\n\n${rootContext(N)}`)
    expect(nPersonaAfterCreate!.order).toBe(0)
    // The block carries the three facts the root model cannot guess:
    // the canonical rootSessionId, the leader instanceId, and the
    // rootSessionId + unique requestToken contract for every team_* call.
    expect(nPersonaAfterCreate!.text.includes(`rootSessionId=${N}`)).toBe(true)
    expect(nPersonaAfterCreate!.text.includes('leaderInstanceId=inst-leader')).toBe(true)
    expect(nPersonaAfterCreate!.text.includes('Every team_* tool call must include rootSessionId')).toBe(true)
    expect(nPersonaAfterCreate!.text.includes('a unique requestToken.')).toBe(true)
    // The boot root's section carries ITS OWN canonical id (never N's).
    expect(bootPersonaAfterCreate !== undefined).toBe(true)
    expect(bootPersonaAfterCreate!.text).toBe(`${LEADER_PERSONA}\n\n${rootContext(BOOT)}`)
    // Exactly one deployment:persona entry assembles on the boot root
    // (the scoped section shadows the global).
    expect(bootPersonaEntries.length).toBe(1)
    expect(bootPersonaEntries[0]!.scope).toBe('scoped')
    // D3 (B2): the member keeps the template persona verbatim, prefixed
    // by the machine-readable member identity context block — the OWNING
    // boot root + the member's own instanceId, role=member — and the ROOT
    // context block does NOT leak into the member branch.
    expect(workerPersonaAfterCreate !== undefined).toBe(true)
    expect(workerPersonaAfterCreate!.text).toBe(`${MEMBER_PERSONA}\n\n${memberContext(BOOT, WORKER.instanceId)}`)
    expect(workerPersonaAfterCreate!.text.includes(`rootSessionId="${BOOT}"`)).toBe(true)
    expect(workerPersonaAfterCreate!.text.includes(`instanceId="${WORKER.instanceId}"`)).toBe(true)
    expect(workerPersonaAfterCreate!.text.includes('role="member"')).toBe(true)
    expect(workerPersonaAfterCreate!.text.includes('[team-root-context')).toBe(false)
    expect(workerPersonaAfterCreate!.text.includes('leaderInstanceId=')).toBe(false)
  })

  it('D4-5 request boundaries: deliverRootWork reaches N; the boot-root member boundaries are unchanged', () => {
    // Initial work into the freshly created root N (the field-report
    // scenario 1, at the glue boundary): the token-leading text lands on N.
    expect(followupsAfterBoundaries.length).toBe(3)
    expect(followupsAfterBoundaries[0]!.sessionId).toBe(N)
    expect(followupText(0, followupsAfterBoundaries)).toBe('[team-root-work requestToken=tok-d4-rw] kick off the plan')
    // The attributed input + the delegate work reach the BOOT root's member
    // (the boot-root boundaries resolve under the boot root, as before).
    expect(followupsAfterBoundaries[1]!.sessionId).toBe(WORKER.childSessionId)
    expect(followupText(1, followupsAfterBoundaries)).toBe('relay text for the worker')
    expect(followupsAfterBoundaries[2]!.sessionId).toBe(WORKER.childSessionId)
    expect(followupText(2, followupsAfterBoundaries)).toBe('[team-work requestToken=tok-d4-wd] do the delegated work')
  })

  it('D4-6 the cold resume re-registers the ten tools on N under its own root and keeps the context block', () => {
    // The resident handle was dropped (the durable session stays on disk).
    expect(droppedN).toEqual({ dropped: true })
    // The first chat after the restart cold-resumes N through
    // agents.resume — with the shared setup.
    expect(resumesAfterResume.length).toBe(1)
    expect(resumesAfterResume[0]!.sessionId).toBe(N)
    expect(resumesAfterResume[0]!.setupProvided).toBe(true)
    // The resumed N re-lands the full real stack (the restart between the
    // create and the first work never loses the tools).
    expect(nToolsAfterResume).toEqual(EXPECTED_TOOL_NAMES)
    // The resumed root re-attaches under ITSELF (cold-root) and keeps the
    // canonical context block with N's own id.
    expect(nPersonaAfterResume !== undefined).toBe(true)
    expect(nPersonaAfterResume!.text).toBe(`${LEADER_PERSONA}\n\n${rootContext(N)}`)
    // The chat landed on the resumed N.
    expect(followupsAfterResume.length).toBe(4)
    expect(followupsAfterResume[3]!.sessionId).toBe(N)
    expect(followupText(3, followupsAfterResume)).toBe('first chat after the restart')
  })

  it('D4-7 close disposes every registration (boot root, member, second root)', () => {
    expect(bootToolsAfterClose).toEqual([])
    expect(workerToolsAfterClose).toEqual([])
    expect(nToolsAfterClose).toEqual([])
  })
})
