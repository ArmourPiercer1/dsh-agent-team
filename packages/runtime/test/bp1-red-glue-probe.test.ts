/**
 * bp1-red-glue-probe.test.ts — BP0 / BP-A characterization (RED) probe
 * RED-4 for the issue #2 blueprint-loading parallel repair (plan §4):
 * the per-Team Blueprint authority split in the live glue.
 *
 * Two team roots share ONE host row (the glue instance). Team A (the boot
 * root) is bound to the row's anchor Blueprint (the bridge default
 * `team.t12a`); Team B is bound to a DIFFERENT snapshot (`BP1-B`) that
 * declares the SAME member template id (`tpl-t12a`) with a DELIBERATELY
 * different persona.
 *
 * The probe drives a FRESH member setup under Team B and asserts the
 * DESIRED behavior: the member's scoped persona comes from Team B's bound
 * snapshot. The CURRENT glue resolves EVERY team against the row-global
 * `config.blueprintSource` (`getBoundBlueprint()` — alpha.1 block,
 * agent-bindings.mjs), so the member gets Team A's (the row's) persona —
 * this probe fails on the base and turns green with BP-F
 * (the host-injected per-root resolver + the team-root-aware
 * `getBoundBlueprint(teamRootSid)`).
 *
 * The full architecture gate (dual-Team capability/permission isolation +
 * cold-resume consistency, plan §11.3) is the BP-F GREEN test; this probe
 * pins the single sharpest observable of the split: the persona.
 *
 * Runner note: the plain-node vitest shim forbids async `it()` bodies —
 * the world boots at module load (top-level await), the `it` bodies
 * assert synchronously (the t12a pattern).
 *
 * @module @dsh-agent-team/runtime/test/bp1-red-glue-probe
 */
import { describe, expect, it } from 'vitest'
import { parseBlueprint } from '../../domain/blueprint/src/index.js'
import type { AgentCtxDouble, AssembledPromptSection } from './t12a-live-bridge.mjs'
import { createLiveWorld } from './t12a-live-bridge.mjs'

const ROOT_A = 'session-bp1gluea'
const ROOT_B = 'session-bp1glueb'
const MEMBER_B = 'inst-bp1glue1'
const CHILD_B = 'session-child-bp1glue1'

/**
 * The row anchor's member persona (the bridge default blueprint
 * `team.t12a`, member template `tpl-t12a`): what the CURRENT row-global
 * glue hands to a Team B member (the defect).
 */
const ROW_WORKER_PERSONA = 'You are member tpl-t12a of the t12a test team.'
/**
 * Team B's bound snapshot (`BP1-B`) declares the SAME template id with a
 * deliberately different persona: the DESIRED source for a Team B member
 * (plan §11.2 — the bound snapshot, never the row anchor).
 */
const BP1_B_WORKER_PERSONA = 'You are member tpl-t12a of the BP1-B team.'

/**
 * Team B's bound snapshot document (the world's blueprint store entry,
 * plan §11.1: the row's bound snapshot ref resolves through the saved
 * source, hash equality verified). A valid closed-v1 document carrying
 * the SAME member template id (`tpl-t12a`) with the deliberately
 * different persona — the DESIRED source for a Team B member.
 */
const BP1_B_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: BP1-B',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: "You are the leader of the BP1-B team."',
  'members:',
  '  - templateId: tpl-t12a',
  '    persona: "You are member tpl-t12a of the BP1-B team."',
  'requirements: []',
  'memberEnvelopes: []',
  'policyStates: []',
  'metadata: {}',
  '---',
  '',
].join('\n')

/** The bound snapshot ref's contentHash (the real parse hash — the bridge's default resolver verifies it). */
const BP1_B_REF_HASH = parseBlueprint(BP1_B_SOURCE).contentHash

// The multi-root world: the boot root A (row anchor) + Team B bound to a
// different snapshot. The domain double carries both durable TeamSession
// rows; B's row carries the FULL bound snapshot (the shape the
// host-injected `resolveBoundBlueprint` consumes after BP-F).
const world = await createLiveWorld({
  rootSessionId: ROOT_A,
  members: [],
  membersByRoot: {
    [ROOT_B]: [
      { childSessionId: CHILD_B, instanceId: MEMBER_B, templateId: 'tpl-t12a' },
    ],
  },
  teamSessions: [
    { rootSessionId: ROOT_A, sessionId: ROOT_A, blueprintId: 'team.t12a', generation: 1 },
    {
      rootSessionId: ROOT_B,
      sessionId: ROOT_B,
      blueprintId: 'BP1-B',
      generation: 1,
      blueprint: {
        blueprintId: 'BP1-B',
        revision: '1',
        contentHash: BP1_B_REF_HASH,
      },
    },
  ],
  // BP-F: the world's blueprint store (the bridge's default per-root
  // resolver strong-parses Team B's bound snapshot from here — hash
  // equality verified against the row's ref).
  blueprintSources: [{ blueprintId: 'BP1-B', revision: '1', source: BP1_B_SOURCE }],
  configOverrides: { mcpServer: null, seedMembers: [] },
})

await world.binding.boot()
await world.binding.createRootAgent(ROOT_B)
const childB = await world.binding.childFactory.createChildSession({
  rootSessionId: ROOT_B,
  instanceId: MEMBER_B,
  templateId: 'tpl-t12a',
  label: 'bp1-red-member',
})
const handleB = world.agents.handles.get(childB.childSessionId)
const bCtx = handleB !== undefined ? (handleB.agent.ctx as unknown as AgentCtxDouble) : undefined
const personaB: AssembledPromptSection | undefined =
  bCtx === undefined
    ? undefined
    : bCtx.systemPrompt.assemble().find(
      (section) => section.name === 'deployment:persona' && section.scope === 'scoped',
    )
// The scoped persona text is the bound blueprint's persona verbatim,
// FOLLOWED by the TCM-D4/B2 member identity context block (the glue
// appends it) — the assertions compare the persona PREFIX, never the
// whole text.
const personaBText = personaB !== undefined ? personaB.text : ''

await world.binding.close()

describe('BP1 RED-4: per-Team Blueprint authority (the row-global split)', () => {
  it('a member under Team B resolves the persona from B bound snapshot, never the row anchor', () => {
    // The committed member row maps to a DETERMINISTICALLY MINTED live
    // child session (the t12a bridge pattern: the handle is keyed by the
    // minted id, not the committed childSessionId).
    expect(handleB !== undefined).toBe(true)
    expect(personaBText.length > 0).toBe(true)
    // Desired (post BP-F): Team B's bound-snapshot persona prefix.
    // Current (the defect): the row anchor's persona prefix — every team
    // on this row resolves against config.blueprintSource.
    expect(personaBText.indexOf(BP1_B_WORKER_PERSONA) === 0).toBe(true)
  })

  it('characterization: the defect is the row anchor leaking into Team B (current behavior, inverted after BP-F)', () => {
    // Evidence pin: on the base the persona prefix IS the row anchor's
    // (this assertion fails = the RED state); after BP-F it must hold
    // (the guard against a regression to row-global resolution).
    expect(personaBText.indexOf(ROW_WORKER_PERSONA) === 0).toBe(false)
  })
})
