/**
 * t12a-team-tools-registration.test.ts — D-2: the team tool registration
 * boundary on the REAL agent ctx (the glue's agent-setup loop), driven with
 * the REAL ten-tool stack.
 *
 * Field context (2026-09-05, user test round 2 on the real machine): the
 * user reported the leader "cannot see the team tools". Session-log evidence
 * (the `request/header` epoch of the session the user actually chatted in,
 * plus the zero-turn team-root log) showed the report came from an ORDINARY
 * web session — which never carries the team tools — not from the team-root
 * agent. The real gap the incident exposed: no test ever drove the glue's
 * registration loop with a FILLED teamToolsRef (every T12A bridge world
 * left teamToolsRef.current undefined — the skip path only), and P8-S5A's
 * "10 tools" assertion covers the root-surface stack, not the agent-context
 * registration the model's tool list is built from.
 *
 * Contract (asserted at the REAL glue boundary through the t12a-live-bridge
 * doubles — the real agent-bindings.mjs, the real createTeamTools stack
 * over the P6-T2 world):
 *   D2-1 create phase: the root (leader) AND the seeded member agent ctxs
 *        receive EXACTLY the ten team tool definitions — the same objects
 *        from the real stack, in stack order;
 *   D2-2 resume phase: a cold-root RESTART re-registers the ten tools on
 *        the resumed leader (agents.resume with the shared setup — the
 *        user's exact restart scenario; the tools re-land on every boot);
 *   D2-3 close: binding.close() disposes EVERY registration (HMR safety —
 *        the disposed ctx keeps zero live registrations).
 *
 * The DSH core side of the chain (an agent-scoped tools.register entry
 * flows into that agent's model-visible assembly) is upstream behavior
 * pinned by the harness's own tools/system-prompt suites; this file pins
 * the plugin-side half: the glue registers the full real stack, on both
 * boot phases, and disposes it.
 */
import { describe, expect, it } from 'vitest'
import type { AgentCtxDouble } from './t12a-live-bridge.mjs'
import {
  WORKTREE_ROOT,
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

function names(ctx: AgentCtxDouble): string[] {
  return ctx.registeredTools.map((def) => String((def as { name?: string }).name ?? ''))
}

// The REAL ten-tool stack (createTeamTools over the P6-T2 durable world) —
// the same factory the production root fills teamToolsRef.current with.
const p6t6 = await createP6T6World('t12a-team-tools-reg')

// ── world A: the create phase (root + one seeded member) ──────────────────
const ROOT_A = 'session-d2-root-create'
const CHILD_A = 'session-d2-child-create'
const worldA = await createLiveWorld({
  rootSessionId: ROOT_A,
  teamTools: { tools: p6t6.tools },
  configOverrides: {
    seedMembers: [
      { instanceId: 'inst-d2a', templateId: 'tpl-t12a', label: 'Member A', childSessionId: CHILD_A },
    ],
  },
})
await worldA.binding.boot()
const rootCtxA = worldA.agents.handles.get(ROOT_A)!.agent.ctx
const memberCtxA = worldA.agents.handles.get(CHILD_A)!.agent.ctx
const rootDefsAfterBoot = [...rootCtxA.registeredTools]
const rootToolsAfterBoot = names(rootCtxA)
const memberToolsAfterBoot = names(memberCtxA)

// ── world B: the resume phase (cold-root restart — the field scenario) ────
const ROOT_B = 'session-d2-root-resume'
const worldB = await createLiveWorld({
  rootSessionId: ROOT_B,
  teamTools: { tools: p6t6.tools },
  configOverrides: { bootPhase: 'resume' },
})
const restartHome = `${WORKTREE_ROOT}/.tmp-t12a-d2-home`
await withDshHome(restartHome, async () => {
  writeDurableFixture(restartHome, ROOT_B)
  await worldB.binding.boot()
})
removeFixtureHome(restartHome)
const rootCtxB = worldB.agents.handles.get(ROOT_B)!.agent.ctx
const rootToolsAfterResume = names(rootCtxB)

// Cleanup: dispose every live handle + registration, then snapshot the
// disposal (the ctx references stay live for the assertions).
await worldA.binding.close()
await worldB.binding.close()
const rootToolsAfterClose = names(rootCtxA)
const memberToolsAfterClose = names(memberCtxA)
const rootToolsAfterCloseB = names(rootCtxB)
// Destroy the P6-T6 durable world (scratch dir cleanup — the p6t6 pattern).
await destroyP6T1World(p6t6.world)

describe('D-2 the team tools registered on the leader (and member) agent ctx', () => {
  it('D2-1 create phase: root + seeded member receive exactly the ten real team tools (same objects, stack order)', () => {
    // The real factory emits the frozen vocabulary (guards the stack input).
    expect(p6t6.tools.map((tool) => tool.name)).toEqual(EXPECTED_TOOL_NAMES)
    // The leader's ctx carries the full stack — the same def objects.
    expect(rootToolsAfterBoot).toEqual(EXPECTED_TOOL_NAMES)
    for (let i = 0; i < EXPECTED_TOOL_NAMES.length; i++) {
      expect(rootDefsAfterBoot[i]).toBe(p6t6.tools[i])
    }
    // The seeded member's ctx carries the same stack (one shared setup).
    expect(memberToolsAfterBoot).toEqual(EXPECTED_TOOL_NAMES)
    // Both agents were created (root + member), each with the shared setup.
    expect(worldA.records.creates.length).toBe(2)
    expect(worldA.records.creates.every((create) => create.setupProvided)).toBe(true)
  })

  it('D2-2 resume phase: a cold-root restart re-registers the ten tools on the resumed leader', () => {
    expect(rootToolsAfterResume).toEqual(EXPECTED_TOOL_NAMES)
    // A restart resumes the root (never re-creates it) — with the setup.
    expect(worldB.records.creates.length).toBe(0)
    expect(worldB.records.resumes.length).toBe(1)
    expect(worldB.records.resumes[0]!.sessionId).toBe(ROOT_B)
    expect(worldB.records.resumes[0]!.setupProvided).toBe(true)
  })

  it('D2-3 close: every registration is disposed (root + member, both worlds)', () => {
    expect(rootToolsAfterClose).toEqual([])
    expect(memberToolsAfterClose).toEqual([])
    expect(rootToolsAfterCloseB).toEqual([])
  })
})
