/**
 * d1-member-base-tools.test.ts — D1 (v2): a Team MEMBER agent gets the
 * ordinary base tools (the ordinary AgentPreset substrate — file/shell)
 * IN ADDITION to the ten team_* tools.
 *
 * Defect (docs/local-issues/team-member-missing-base-tools.md): the member
 * setup registered only the Team tools; every `read`/`exec`/`pwd` call on a
 * member died with `unknown tool` and the member could not do basic work.
 * The fix composes the public `agentPresets.mount(agentCtx, id?)` seam (the
 * exact composition the upstream session-controller uses for ordinary
 * sessions — A1 seam characterization: public path, no upstream change)
 * inside the shared agent-setup closure, on the MEMBER bind paths only
 * (fresh-member / cold-member; v2 scope — the root/leader paths stay
 * unchanged), with a fail-closed typed error when the service is absent
 * (a member must never silently run without its base tools).
 *
 * Contract (asserted at the REAL glue boundary through the t12a-live-bridge
 * doubles — the real agent-bindings.mjs — with the REAL ten-tool
 * createTeamTools stack over the P6-T2 durable world):
 *   D1-1 member create (fresh-member): agentPresets.mount is called EXACTLY
 *        ONCE, for the member's agent ctx, with the configured
 *        config.memberPresetId; the root (fresh-root) never mounts;
 *   D1-2 member create with memberPresetId UNDEFINED: mount is called with
 *        NO id (the service resolves the deployment default itself — the
 *        glue never invents an id);
 *   D1-3 root create/resume NEVER call mount: the fresh-root create (world A)
 *        and the cold-root resume (world C boot) record zero mounts, and the
 *        root's cold re-attach (a second root lifecycle) adds none;
 *   D1-4 cold-member resume mounts EXACTLY ONCE per agent lifecycle: the
 *        boot resume phase records one mount; a drop + cold re-resume mints
 *        a FRESH agent ctx and records exactly one MORE mount (one per
 *        lifecycle, never two on one agent — no double registration);
 *   D1-5 absent service on the member path FAILS CLOSED with the typed
 *        error (code member-base-tools-unavailable): the member agent never
 *        runs (no live residency), never silently base-tool-less;
 *   D1-6 the ten team_* tools are STILL registered on the member row (no
 *        regression — the same real def objects, stack order), and the
 *        root's tool table is unchanged (v2 scope: members only).
 */
import { describe, expect, it } from 'vitest'
import type { AgentCtxDouble, RecordedPresetMount } from './t12a-live-bridge.mjs'
import {
  WORKTREE_ROOT,
  createAgentPresetsDouble,
  createLiveWorld,
  removeFixtureHome,
  withDshHome,
  writeDurableFixture,
} from './t12a-live-bridge.mjs'
import { destroyP6T1World } from './p6t1-helpers.js'
import { createP6T6World } from '../../tools/test/p6t6-helpers.js'

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

/** The stable typed error code of the D1 fail-closed member setup. */
const MEMBER_BASE_TOOLS_UNAVAILABLE = 'member-base-tools-unavailable'

function names(ctx: AgentCtxDouble): string[] {
  return ctx.registeredTools.map((def) => String((def as { name?: string }).name ?? ''))
}

// The REAL ten-tool stack (createTeamTools over the P6-T2 durable world) —
// the same factory the production root fills teamToolsRef.current with.
const p6t6 = await createP6T6World('d1-member-base-tools')

// ── world A: the create phase, memberPresetId configured ──────────────────
const ROOT_A = 'session-d1-root-a'
const CHILD_A = 'session-d1-child-a'
const presetsA = createAgentPresetsDouble()
const worldA = await createLiveWorld({
  rootSessionId: ROOT_A,
  teamTools: { tools: p6t6.tools },
  agentPresets: presetsA,
  configOverrides: {
    memberPresetId: 'd1-member-preset',
    seedMembers: [
      { instanceId: 'inst-d1a', templateId: 'tpl-t12a', label: 'Member A', childSessionId: CHILD_A },
    ],
  },
})
await worldA.binding.boot()
const rootCtxA = worldA.agents.handles.get(ROOT_A)!.agent.ctx
const memberCtxA = worldA.agents.handles.get(CHILD_A)!.agent.ctx
const rootToolsA = names(rootCtxA)
const memberToolsA = names(memberCtxA)
const mountsA: readonly RecordedPresetMount[] = [...presetsA.mounts]
await worldA.binding.close()

// ── world B: the create phase, memberPresetId UNDEFINED ───────────────────
const ROOT_B = 'session-d1-root-b'
const CHILD_B = 'session-d1-child-b'
const presetsB = createAgentPresetsDouble()
const worldB = await createLiveWorld({
  rootSessionId: ROOT_B,
  teamTools: { tools: p6t6.tools },
  agentPresets: presetsB,
  configOverrides: {
    seedMembers: [
      { instanceId: 'inst-d1b', templateId: 'tpl-t12a', label: 'Member B', childSessionId: CHILD_B },
    ],
  },
})
await worldB.binding.boot()
const mountsB: readonly RecordedPresetMount[] = [...presetsB.mounts]
await worldB.binding.close()

// ── world C: the resume phase (cold-root + cold-member), two member
// ── lifecycles (boot resume, then drop + cold re-resume) + one root
// ── re-attach (cold-root, must never mount) ─────────────────────────────────
const ROOT_C = 'session-d1-root-c'
const CHILD_C = 'session-d1-child-c'
const presetsC = createAgentPresetsDouble()
const worldC = await createLiveWorld({
  rootSessionId: ROOT_C,
  teamTools: { tools: p6t6.tools },
  agentPresets: presetsC,
  configOverrides: {
    bootPhase: 'resume',
    mcpServer: null,
  },
  members: [{ childSessionId: CHILD_C, instanceId: 'inst-d1c', templateId: 'tpl-t12a' }],
})
await worldC.binding.boot()
const rootCtxC = worldC.agents.handles.get(ROOT_C)!.agent.ctx
const memberHandleC1 = worldC.agents.handles.get(CHILD_C)
const memberCtxC1 = memberHandleC1 === undefined ? undefined : memberHandleC1.agent.ctx
const memberToolsC1 = memberCtxC1 === undefined ? [] : names(memberCtxC1)
const mountsC1: readonly RecordedPresetMount[] = [...presetsC.mounts]

// Second member lifecycle: drop the residency (the durable session stays),
// then the first use cold-resumes the member through agents.resume.
const droppedC = await worldC.binding.dropResidency(CHILD_C)
const resumeHomeC = `${WORKTREE_ROOT}/.tmp-d1-c-home`
await withDshHome(resumeHomeC, async () => {
  writeDurableFixture(resumeHomeC, CHILD_C)
  await worldC.binding.ensureLiveAgent(CHILD_C)
})
removeFixtureHome(resumeHomeC)
const memberHandleC2 = worldC.agents.handles.get(CHILD_C)
const memberCtxC2 = memberHandleC2 === undefined ? undefined : memberHandleC2.agent.ctx
const memberToolsC2 = memberCtxC2 === undefined ? [] : names(memberCtxC2)
const mountsC2: readonly RecordedPresetMount[] = [...presetsC.mounts]

// The root's cold re-attach (a second ROOT lifecycle — must never mount).
await worldC.binding.dropResidency(ROOT_C)
const resumeHomeRootC = `${WORKTREE_ROOT}/.tmp-d1-c-root-home`
await withDshHome(resumeHomeRootC, async () => {
  writeDurableFixture(resumeHomeRootC, ROOT_C)
  await worldC.binding.ensureLiveAgent(ROOT_C)
})
removeFixtureHome(resumeHomeRootC)
const mountsC3: readonly RecordedPresetMount[] = [...presetsC.mounts]
await worldC.binding.close()

// ── world E: the create phase WITHOUT the agentPresets service ────────────
// (the production host seam not wired): the member setup must fail closed
// with the typed error — never a silently base-tool-less member.
const ROOT_E = 'session-d1-root-e'
const CHILD_E = 'session-d1-child-e'
const worldE = await createLiveWorld({
  rootSessionId: ROOT_E,
  teamTools: { tools: p6t6.tools },
  configOverrides: {
    seedMembers: [
      { instanceId: 'inst-d1e', templateId: 'tpl-t12a', label: 'Member E', childSessionId: CHILD_E },
    ],
  },
})
const bootEResult: { ok: boolean; error?: unknown } = await (async () => {
  try {
    await worldE.binding.boot()
    return { ok: true }
  } catch (error) {
    return { ok: false, error }
  }
})()
const memberLiveAfterE = worldE.binding.hasLive(CHILD_E)
const rootLiveAfterE = worldE.binding.hasLive(ROOT_E)
const createsE = [...worldE.records.creates]
await worldE.binding.close()

// Destroy the P6-T6 durable world (scratch dir cleanup — the p6t6 pattern).
await destroyP6T1World(p6t6.world)

describe('D1 (v2) member base tools: the ordinary preset mounts on member paths only', () => {
  it('D1-1 member create: mount exactly once for the member with the configured memberPresetId; the root never mounts', () => {
    // The real factory emits the frozen vocabulary (guards the stack input).
    expect(p6t6.tools.map((tool) => tool.name)).toEqual(EXPECTED_TOOL_NAMES)
    // Exactly ONE mount in the whole create-phase world — on the MEMBER's
    // agent ctx, carrying the configured preset id.
    expect(mountsA.length).toBe(1)
    expect(mountsA[0]!.agentCtx).toBe(memberCtxA)
    expect(mountsA[0]!.presetId).toBe('d1-member-preset')
    // The root (fresh-root create) never mounted.
    expect(mountsA.every((mount) => mount.agentCtx !== rootCtxA)).toBe(true)
    // Both agents were created with the shared setup.
    expect(worldA.records.creates.length).toBe(2)
    expect(worldA.records.creates.every((create) => create.setupProvided)).toBe(true)
  })

  it('D1-2 memberPresetId undefined: mount is called with NO id (the deployment default)', () => {
    // One mount, exactly as before — but the glue passes no id, so the
    // service resolves the deployment default (never a glue-invented id).
    expect(mountsB.length).toBe(1)
    expect(mountsB[0]!.presetId).toBeUndefined()
  })

  it('D1-3 root create/resume never call mount (fresh-root world A; cold-root boot + cold re-attach world C)', () => {
    // World A: the fresh-root create recorded no mount (only the member did).
    expect(mountsA.every((mount) => mount.agentCtx !== rootCtxA)).toBe(true)
    // World C boot (resume phase): exactly ONE mount — the cold-member; the
    // cold-root did not mount.
    expect(mountsC1.length).toBe(1)
    expect(mountsC1[0]!.agentCtx).toBe(memberCtxC1)
    expect(mountsC1.every((mount) => mount.agentCtx !== rootCtxC)).toBe(true)
    // The root's cold re-attach (a second root lifecycle) adds NO mount.
    expect(mountsC3.length).toBe(mountsC2.length)
  })

  it('D1-4 cold-member resume mounts exactly once per agent lifecycle (no double registration)', () => {
    // First lifecycle (the boot resume phase): exactly one mount.
    expect(mountsC1.length).toBe(1)
    // Second lifecycle (drop + cold re-resume): a FRESH agent ctx (a new
    // agent scope per lifecycle) and exactly one MORE mount — one per
    // lifecycle, never two on one agent.
    expect(droppedC).toEqual({ dropped: true })
    expect(memberCtxC2 !== undefined).toBe(true)
    expect(memberCtxC2).not.toBe(memberCtxC1)
    expect(mountsC2.length).toBe(2)
    expect(mountsC2[1]!.agentCtx).toBe(memberCtxC2)
    // World C carries no memberPresetId — both mounts use the default.
    expect(mountsC2[0]!.presetId).toBeUndefined()
    expect(mountsC2[1]!.presetId).toBeUndefined()
  })

  it('D1-5 absent service on the member path fails closed with the typed error (no base-tool-less member)', () => {
    // The boot rejects (the member create's setup rejection propagates).
    expect(bootEResult.ok).toBe(false)
    const error = bootEResult.error as Error & { code?: string }
    expect(error instanceof Error).toBe(true)
    // The stable typed code — not a TypeError, not a silent skip.
    expect(error.code).toBe(MEMBER_BASE_TOOLS_UNAVAILABLE)
    expect(error.message).toContain(CHILD_E)
    // The member never runs: no live residency for it.
    expect(memberLiveAfterE).toBe(false)
    // The root (out of v2 scope) is unaffected by the member failure.
    expect(rootLiveAfterE).toBe(true)
    expect(createsE.length).toBe(2)
  })

  it('D1-6 the ten team_* tools are still registered on the member row (no regression; root unchanged)', () => {
    // The member row carries the full real stack — every lifecycle.
    expect(memberToolsA).toEqual(EXPECTED_TOOL_NAMES)
    expect(memberToolsC1).toEqual(EXPECTED_TOOL_NAMES)
    expect(memberToolsC2).toEqual(EXPECTED_TOOL_NAMES)
    // The root's tool table is unchanged (v2 scope: members only — the root
    // still gets exactly the ten team tools, no preset substrate).
    expect(rootToolsA).toEqual(EXPECTED_TOOL_NAMES)
  })
})
