/**
 * d1-member-base-tools.test.ts — D1 (v2 → v3): the team-CREATED agents —
 * the MEMBER agents (v2) AND the ROOT (leader) agent (v3) — get the
 * ordinary base tools (the ordinary AgentPreset substrate — file/shell)
 * IN ADDITION to the ten team_* tools.
 *
 * Defect (v2, docs/local-issues/team-member-missing-base-tools.md): the
 * member setup registered only the Team tools; every `read`/`exec`/`pwd`
 * call on a member died with `unknown tool` and the member could not do
 * basic work.
 * Extension (v3 — the V1 live-matrix verification finding, ruled a
 * product fix citing D1 v2 + plan §13-L4/§12.3): a plugin-CREATED root
 * (team.create / the p6t6 worlds) likewise carried ONLY the ten team
 * tools — the leader's file lanes (allow read executes; ask write →
 * user-approval) were unreachable and every leader file op died with
 * `unknown tool`.
 * The fix composes the public `agentPresets.mount(agentCtx, id?)` seam
 * (the exact composition the upstream session-controller uses for
 * ordinary sessions — A1 seam characterization: public path, no upstream
 * change) inside the shared agent-setup closure, on ALL FOUR bind paths
 * (fresh-member / cold-member — v2; fresh-root / cold-root — v3), gated
 * on bindPath ONLY (never on the permissions-policy presence or the
 * capabilities mode), with a fail-closed typed error per role when the
 * service is absent (an agent must never silently run without its base
 * tools).
 *
 * Contract (asserted at the REAL glue boundary through the t12a-live-
 * bridge doubles — the real agent-bindings.mjs — with the REAL ten-tool
 * createTeamTools stack over the P6-T2 durable world):
 *   D1-1 create (fresh-root + fresh-member): agentPresets.mount is called
 *        EXACTLY TWICE — once for the root's agent ctx with the configured
 *        config.rootPresetId, once for the member's agent ctx with the
 *        configured config.memberPresetId;
 *   D1-2 both preset ids UNDEFINED: both mounts are called with NO id
 *        (the service resolves the deployment default itself — the glue
 *        never invents an id);
 *   D1-3 every ROOT lifecycle calls mount EXACTLY ONCE: the fresh-root
 *        create (world A) records the root mount; the cold-root boot
 *        (world C) records it; the root's cold re-attach (a second root
 *        lifecycle) adds exactly ONE more;
 *   D1-4 cold-member resume mounts EXACTLY ONCE per agent lifecycle: the
 *        boot resume phase records one mount; a drop + cold re-resume
 *        mints a FRESH agent ctx and records exactly one MORE mount
 *        (one per lifecycle, never two on one agent — no double
 *        registration);
 *   D1-5 absent service (the glue dep omitted entirely) FAILS CLOSED on
 *        the FIRST setup — the root path — with the typed error (code
 *        root-base-tools-unavailable) and ZERO partial state (no live
 *        residency; the member is never even created);
 *   D1-6 the ten team_* tools are STILL registered on the member row AND
 *        the root row (the doubles' mount registers no tools — no
 *        regression; the preset substrate is a tool-table ADDITION);
 *   D1-7 the already-joined guard: an agent that already holds a preset
 *        composition (the optional composedPreset probe reports a preset)
 *        keeps it — the mount is SKIPPED with an observation, never a
 *        double bind (the roster's mount is the one bind and refuses a
 *        second).
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

/** The stable typed error codes of the D1 fail-closed agent setups. */
const MEMBER_BASE_TOOLS_UNAVAILABLE = 'member-base-tools-unavailable'
const ROOT_BASE_TOOLS_UNAVAILABLE = 'root-base-tools-unavailable'

function names(ctx: AgentCtxDouble): string[] {
  return ctx.registeredTools.map((def) => String((def as { name?: string }).name ?? ''))
}

// The REAL ten-tool stack (createTeamTools over the P6-T2 durable world) —
// the same factory the production root fills teamToolsRef.current with.
const p6t6 = await createP6T6World('d1-member-base-tools')

// ── world A: the create phase, both preset ids configured ────────────────
const ROOT_A = 'session-d1-root-a'
const CHILD_A = 'session-d1-child-a'
const presetsA = createAgentPresetsDouble()
const worldA = await createLiveWorld({
  rootSessionId: ROOT_A,
  teamTools: { tools: p6t6.tools },
  agentPresets: presetsA,
  configOverrides: {
    memberPresetId: 'd1-member-preset',
    rootPresetId: 'd1-root-preset',
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

// ── world B: the create phase, both preset ids UNDEFINED ─────────────────
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
// ── re-attach (cold-root, a second root lifecycle — one mount) ──────────
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

// The root's cold re-attach (a SECOND ROOT lifecycle — exactly one mount).
await worldC.binding.dropResidency(ROOT_C)
const resumeHomeRootC = `${WORKTREE_ROOT}/.tmp-d1-c-root-home`
await withDshHome(resumeHomeRootC, async () => {
  writeDurableFixture(resumeHomeRootC, ROOT_C)
  await worldC.binding.ensureLiveAgent(ROOT_C)
})
removeFixtureHome(resumeHomeRootC)
const rootCtxC2 = worldC.agents.handles.get(ROOT_C)!.agent.ctx
const mountsC3: readonly RecordedPresetMount[] = [...presetsC.mounts]
await worldC.binding.close()

// ── world E: the create phase WITHOUT the agentPresets service (the glue
// ── dep omitted — the production host seam not wired): the FIRST setup
// ── (the root) must fail closed with the typed error — never a silently
// ── base-tool-less agent, never partial state (the ruling's fail-closed
// ── leg for the root path).
const ROOT_E = 'session-d1-root-e'
const CHILD_E = 'session-d1-child-e'
const worldE = await createLiveWorld({
  rootSessionId: ROOT_E,
  teamTools: { tools: p6t6.tools },
  agentPresets: null,
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

// ── world G: the already-joined guard (v3) — the composedPreset probe
// ── reports a preset on EVERY ctx: the mount is SKIPPED with an
// ── observation (the roster's mount is the one bind; a second would
// ── throw). The production host-session root (composed by the web setup)
// ── takes exactly this path.
const ROOT_G = 'session-d1-root-g'
const CHILD_G = 'session-d1-child-g'
const presetsG = {
  mounts: [] as RecordedPresetMount[],
  composedPreset(): string {
    return 'host-standard'
  },
  async mount(agentCtx: unknown, presetId?: string) {
    this.mounts.push({ agentCtx, presetId })
    return {}
  },
}
const worldG = await createLiveWorld({
  rootSessionId: ROOT_G,
  teamTools: { tools: p6t6.tools },
  agentPresets: presetsG,
  configOverrides: {
    seedMembers: [
      { instanceId: 'inst-d1g', templateId: 'tpl-t12a', label: 'Member G', childSessionId: CHILD_G },
    ],
  },
})
await worldG.binding.boot()
const mountsG: readonly RecordedPresetMount[] = [...presetsG.mounts]
const skipObservationsG = worldG.binding.observations.filter((o) =>
  String(o).includes('base-tool preset mount skipped'),
)
// Capture the live state BEFORE close (close disposes every agent — the
// assertions must read the pre-close residency).
const rootLiveAfterG = worldG.binding.hasLive(ROOT_G)
const memberLiveAfterG = worldG.binding.hasLive(CHILD_G)
await worldG.binding.close()

// Destroy the P6-T6 durable world (scratch dir cleanup — the p6t6 pattern).
await destroyP6T1World(p6t6.world)

describe('D1 (v2 → v3) agent base tools: the ordinary preset mounts on member AND root paths', () => {
  it('D1-1 create: mount exactly once for the ROOT (configured rootPresetId) and once for the MEMBER (configured memberPresetId)', () => {
    // The real factory emits the frozen vocabulary (guards the stack input).
    expect(p6t6.tools.map((tool) => tool.name)).toEqual(EXPECTED_TOOL_NAMES)
    // Exactly TWO mounts in the whole create-phase world — the root first
    // (the boot creates the root before the seed members), each on its own
    // agent ctx, each carrying its OWN configured preset id.
    expect(mountsA.length).toBe(2)
    expect(mountsA[0]!.agentCtx).toBe(rootCtxA)
    expect(mountsA[0]!.presetId).toBe('d1-root-preset')
    expect(mountsA[1]!.agentCtx).toBe(memberCtxA)
    expect(mountsA[1]!.presetId).toBe('d1-member-preset')
    // Both agents were created with the shared setup.
    expect(worldA.records.creates.length).toBe(2)
    expect(worldA.records.creates.every((create) => create.setupProvided)).toBe(true)
  })

  it('D1-2 both preset ids undefined: both mounts are called with NO id (the deployment default)', () => {
    // Two mounts (root + member), exactly as world A — but the glue passes
    // no id for either, so the service resolves the deployment default
    // (never a glue-invented id).
    expect(mountsB.length).toBe(2)
    expect(mountsB.every((mount) => mount.presetId === undefined)).toBe(true)
  })

  it('D1-3 every root lifecycle calls mount exactly once (fresh-root world A; cold-root boot + cold re-attach world C)', () => {
    // World A: the fresh-root create recorded EXACTLY ONE mount — on the
    // root's agent ctx (the v2 asymmetry is extended: the root now mounts
    // too).
    expect(mountsA.filter((mount) => mount.agentCtx === rootCtxA).length).toBe(1)
    // World C boot (resume phase): exactly TWO mounts — the cold-root AND
    // the cold-member, one each.
    expect(mountsC1.length).toBe(2)
    expect(mountsC1.some((mount) => mount.agentCtx === rootCtxC)).toBe(true)
    expect(mountsC1.some((mount) => mount.agentCtx === memberCtxC1)).toBe(true)
    // The root's cold re-attach (a second root lifecycle): exactly ONE
    // more mount — on the FRESH root agent ctx.
    expect(mountsC3.length).toBe(mountsC2.length + 1)
    expect(mountsC3[mountsC3.length - 1]!.agentCtx).toBe(rootCtxC2)
    expect(mountsC3[mountsC3.length - 1]!.agentCtx).not.toBe(rootCtxC)
  })

  it('D1-4 cold-member resume mounts exactly once per agent lifecycle (no double registration)', () => {
    // First lifecycle (the boot resume phase): the member's mount is in
    // the boot's two mounts (root + member).
    expect(mountsC1.filter((mount) => mount.agentCtx === memberCtxC1).length).toBe(1)
    // Second lifecycle (drop + cold re-resume): a FRESH agent ctx (a new
    // agent scope per lifecycle) and exactly one MORE member mount — one
    // per lifecycle, never two on one agent.
    expect(droppedC).toEqual({ dropped: true })
    expect(memberCtxC2 !== undefined).toBe(true)
    expect(memberCtxC2).not.toBe(memberCtxC1)
    expect(mountsC2.length).toBe(3)
    expect(mountsC2[2]!.agentCtx).toBe(memberCtxC2)
    // World C carries no preset ids — all mounts use the deployment
    // default (no id passed).
    expect(mountsC2.every((mount) => mount.presetId === undefined)).toBe(true)
  })

  it('D1-5 absent service fails closed on the FIRST setup (the root path) with the typed error and zero partial state', () => {
    // The boot rejects (the root create's setup rejection propagates — the
    // boot creates the root before any seed member).
    expect(bootEResult.ok).toBe(false)
    const error = bootEResult.error as Error & { code?: string }
    expect(error instanceof Error).toBe(true)
    // The stable typed code for the ROOT path — not a TypeError, not a
    // silent skip.
    expect(error.code).toBe(ROOT_BASE_TOOLS_UNAVAILABLE)
    // (shim-compatible includes: the plain-node runner lacks toContain —
    // the same gap that pins the legacy suites' message asserts)
    expect(String(error.message).includes(ROOT_E)).toBe(true)
    // Zero partial state: the root never runs (no live residency) and the
    // member is never even created (only the root's create was recorded).
    expect(rootLiveAfterE).toBe(false)
    expect(memberLiveAfterE).toBe(false)
    expect(createsE.length).toBe(1)
    expect(createsE.every((create) => create.sessionId === ROOT_E)).toBe(true)
    // The member's error code is never emitted on the root path (the two
    // codes are role-specific — the ruling's new typed error).
    expect(String(error.message).includes(ROOT_BASE_TOOLS_UNAVAILABLE)).toBe(true)
    expect(String(error.message).includes(MEMBER_BASE_TOOLS_UNAVAILABLE)).toBe(false)
  })

  it('D1-6 the ten team_* tools are still registered on the member AND root rows (no regression; the mount adds no tools)', () => {
    // The member row carries the full real stack — every lifecycle.
    expect(memberToolsA).toEqual(EXPECTED_TOOL_NAMES)
    expect(memberToolsC1).toEqual(EXPECTED_TOOL_NAMES)
    expect(memberToolsC2).toEqual(EXPECTED_TOOL_NAMES)
    // The root row carries the full real stack too (the doubles' mount
    // records but registers nothing — the preset substrate is a tool-table
    // ADDITION served by the real service, not by the team stack).
    expect(rootToolsA).toEqual(EXPECTED_TOOL_NAMES)
  })

  it('D1-7 the already-joined guard: a composed agent keeps its preset — the mount is skipped with an observation, never a double bind', () => {
    // The probe reports a preset on every ctx (the host-session root
    // pattern) — NO mount runs for the root OR the member — and both
    // agents come up live (the guard is a skip, not a failure).
    expect(rootLiveAfterG).toBe(true)
    expect(memberLiveAfterG).toBe(true)
    expect(mountsG.length).toBe(0)
    // Each skip is an observation (the ruling's guard leg: detection, not
    // a second bind).
    expect(skipObservationsG.length).toBe(2)
    expect(skipObservationsG.some((o) => String(o).includes(ROOT_G) && String(o).includes('fresh-root'))).toBe(true)
    expect(skipObservationsG.some((o) => String(o).includes(CHILD_G) && String(o).includes('fresh-member'))).toBe(true)
  })
})
