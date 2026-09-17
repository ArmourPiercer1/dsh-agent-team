/**
 * bound-blueprint-persona-live.test.ts — A2 (RC2 repair, plan §5/§6): the
 * persona TEXT installed into the REAL DSH Agent prompt resolves from the
 * TeamSession's BOUND blueprint snapshot — never from the row-level
 * `config.blueprintSource` anchor.
 *
 * Proven through the T12 lane-A live bridge (`t12a-live-bridge.mjs`): the
 * REAL live glue in-chain over the DSH service doubles, one DIVERGED world
 * (the TCM-D4 multi-root row shape — the bridge plays the host stand-in and
 * ALWAYS injects the per-Team bound-blueprint resolver, exactly like the
 * production host):
 *
 *   row anchor A (config.blueprintSource) — members: worker-a ONLY.
 *   Team 1 (the boot root, ROOT_B) — bound snapshot B — members:
 *   worker-b + worker; leader persona B.
 *   Team 2 (ROOT_C, a second bound team on the SAME row) — bound snapshot
 *   C — member: worker (the SAME templateId as Team 1's, DIFFERENT
 *   persona text); leader persona C.
 *
 *   A2-T1  the `worker-b` member (seeded at boot — the durable-create
 *          shape) gets B's `worker-b` persona at its agent-ctx prompt —
 *          the template is ABSENT from anchor A, so a row-anchor persona
 *          source cannot install it at all.
 *   A2-T2  the boot root's LEADER persona is B's (A and B leader texts
 *          differ; the installed section is B's — the leader resolves
 *          from the bound snapshot too, not the anchor).
 *   A2-T3  Team 1's `worker` member gets B's `worker` persona, Team 2's
 *          `worker` member (created through the glue childFactory — the
 *          production create path) gets C's `worker` persona: one plugin
 *          row, two bound teams, the same templateId carrying different
 *          personas — the runtime persona lookup is ROOT-SCOPED.
 *
 * The same diverged world's BINDER-side behavior (the post-commit install
 * success, the root-scoped installs, the unresolvable-snapshot fail-closed,
 * the missing-row typed throw, the factory-world pin) is asserted by the
 * companion `bound-blueprint-persona-root.test.ts` through the production
 * host entry.
 *
 * Runner note: the plain-node vitest shim forbids async `it()` bodies —
 * the world is booted at module load (top-level await), the `it` bodies
 * assert synchronously (the t12a-m2 pattern).
 * @module @dsh-agent-team/runtime/test/bound-blueprint-persona-live
 */

import { describe, expect, it } from 'vitest'
import type { AgentCtxDouble, AssembledPromptSection } from './t12a-live-bridge.mjs'
import { createLiveWorld } from './t12a-live-bridge.mjs'
import {
  CHILD_B1,
  CHILD_B2,
  DOC_A,
  DOC_B,
  DOC_C,
  INST_B1,
  INST_B2,
  INST_C1,
  LEADER_PERSONA_A,
  LEADER_PERSONA_B,
  MEMBER_PERSONA_B_WORKER,
  MEMBER_PERSONA_B_WORKER_B,
  MEMBER_PERSONA_C_WORKER,
  REF_B,
  REF_C,
  ROOT_B,
  ROOT_C,
  memberContextBlock,
  rootContextBlock,
} from './bound-blueprint-persona-helpers.js'

// The one deployment:persona entry that is the AGENT-SCOPED one
// (t12a-m2's `scopedPersona`).
function scopedPersona(ctx: AgentCtxDouble): AssembledPromptSection | undefined {
  return ctx.systemPrompt.assemble().find(
    (section) => section.name === 'deployment:persona' && section.scope === 'scoped',
  )
}

// ── the diverged world (row anchor A; Team 1 bound B; Team 2 bound C) ──────
const world = await createLiveWorld({
  rootSessionId: ROOT_B,
  // The TCM-D4 multi-root row list: the boot root's OWN row carries Team 1's
  // bound snapshot ref (B); the second row is Team 2's bound ref (C). Every
  // ref contentHash is the document's actual parse hash (the bridge's
  // strict resolver verifies the hash equality — the plan §11.1 chain).
  teamSessions: [
    {
      rootSessionId: ROOT_B,
      sessionId: ROOT_B,
      blueprintId: 'a2bpp.b',
      generation: 1,
      blueprint: {
        blueprintId: 'a2bpp.b',
        revision: '1',
        contentHash: String(REF_B.contentHash),
      },
    },
    {
      rootSessionId: ROOT_C,
      sessionId: ROOT_C,
      blueprintId: 'a2bpp.c',
      generation: 1,
      blueprint: {
        blueprintId: 'a2bpp.c',
        revision: '1',
        contentHash: String(REF_C.contentHash),
      },
    },
  ],
  blueprintSources: [
    { blueprintId: 'a2bpp.b', revision: '1', source: DOC_B },
    { blueprintId: 'a2bpp.c', revision: '1', source: DOC_C },
  ],
  // The boot root's committed member rows (the durable-create truth the
  // persona install reads).
  members: [
    { childSessionId: CHILD_B1, instanceId: INST_B1, templateId: 'worker-b' },
    { childSessionId: CHILD_B2, instanceId: INST_B2, templateId: 'worker' },
  ],
  configOverrides: {
    // THE DIVERGENCE: the row anchor is A (no worker-b / worker templates,
    // a different leader persona) — the bound snapshots are B and C.
    blueprintSource: DOC_A,
    seedMembers: [
      { instanceId: INST_B1, templateId: 'worker-b', label: 'a2 worker-b', childSessionId: CHILD_B1 },
      { instanceId: INST_B2, templateId: 'worker', label: 'a2 worker', childSessionId: CHILD_B2 },
    ],
  },
})
await world.binding.boot()

// A2-T3: Team 2's `worker` member — created through the glue childFactory
// (the production create path: the setup runs in the fresh-create window
// under the OWNING root ROOT_C).
const createdC = await world.binding.childFactory.createChildSession({
  rootSessionId: ROOT_C,
  instanceId: INST_C1,
  label: 'a2 worker C',
  templateId: 'worker',
})
const CHILD_C1 = String(createdC.childSessionId)

const rootCtx = world.agents.handles.get(ROOT_B)!.agent.ctx
const memberB1Ctx = world.agents.handles.get(CHILD_B1)!.agent.ctx
const memberB2Ctx = world.agents.handles.get(CHILD_B2)!.agent.ctx
const memberC1Ctx = world.agents.handles.get(CHILD_C1)!.agent.ctx

// Snapshots at the moment the state holds (the shim runs every it AFTER
// all top-level code — the t12a-m2 snapshot discipline).
const rootPersona = scopedPersona(rootCtx)
const memberB1Persona = scopedPersona(memberB1Ctx)
const memberB2Persona = scopedPersona(memberB2Ctx)
const memberC1Persona = scopedPersona(memberC1Ctx)
const createsCount = world.records.creates.length

describe('A2-T1 the installed member persona is the bound snapshot\'s (worker-b exists only in B)', () => {
  it('the worker-b agent prompt carries B\'s worker-b persona + the member identity block', () => {
    expect(memberB1Persona !== undefined).toBe(true)
    expect(memberB1Persona!.text).toBe(
      `${MEMBER_PERSONA_B_WORKER_B}\n\n${memberContextBlock(ROOT_B, INST_B1)}`,
    )
    // The row anchor A carries NO worker-b template (and none of the
    // bound personas): a row-anchor persona source could not have
    // installed this text.
    expect(memberB1Persona!.text).not.toContain('A2 anchor team')
  })
})

describe('A2-T2 the leader persona installs from the bound snapshot (B), not the row anchor (A)', () => {
  it('the A/B leader texts differ and the installed section is B\'s', () => {
    expect(LEADER_PERSONA_A).not.toBe(LEADER_PERSONA_B)
    expect(rootPersona !== undefined).toBe(true)
    expect(rootPersona!.text).toBe(`${LEADER_PERSONA_B}\n\n${rootContextBlock(ROOT_B)}`)
    expect(rootPersona!.text).not.toContain(LEADER_PERSONA_A)
  })
})

describe('A2-T3 one row, multiple teams: the same templateId carries per-team personas', () => {
  it('Team 1\'s worker gets B\'s persona; Team 2\'s worker gets C\'s persona', () => {
    expect(memberB2Persona !== undefined).toBe(true)
    expect(memberB2Persona!.text).toBe(
      `${MEMBER_PERSONA_B_WORKER}\n\n${memberContextBlock(ROOT_B, INST_B2)}`,
    )
    expect(memberC1Persona !== undefined).toBe(true)
    expect(memberC1Persona!.text).toBe(
      `${MEMBER_PERSONA_C_WORKER}\n\n${memberContextBlock(ROOT_C, INST_C1)}`,
    )
    // The same templateId, the same plugin row, DIFFERENT personas: the
    // lookup is root-scoped (a row-global anchor lookup would have failed
    // both — anchor A has no `worker` template at all).
    expect(MEMBER_PERSONA_B_WORKER).not.toBe(MEMBER_PERSONA_C_WORKER)
    expect(memberB2Persona!.text).not.toBe(memberC1Persona!.text)
    expect(memberB2Persona!.text).not.toContain(MEMBER_PERSONA_C_WORKER)
    expect(memberC1Persona!.text).not.toContain(MEMBER_PERSONA_B_WORKER)
  })

  it('the create path recorded the root + both seeded members + the created Team 2 member', () => {
    expect(createsCount).toBe(4)
  })
})
