/**
 * t12a-m2-persona.test.ts — T12-M2: the blueprint persona is installed into
 * the REAL DSH Agent prompt at create/setup.
 *
 * The live glue reuses the READ-ONLY persona resolver (agent-setup/persona)
 * as the S5A-frozen authority: preset substrate fact + blueprint persona
 * fields -> the scoped identity (PASS) or a FATAL TeamPersonaOverlayError
 * (a complete preset is never downgraded). This glue is the LAST layer the
 * resolver installs onto: the agent-scoped 'deployment:persona'
 * system-prompt section on the session's live agent ctx (the DSH
 * systemPrompt builtin the agent loop always injects).
 *
 * Contract (asserted at the REAL agent-ctx prompt surface — the bridge
 * agents double carries a working systemPrompt.section/assemble pair per
 * ctx, with a shared global layer per world — NOT via projection fields):
 *   M2-1 setup installs the blueprint persona as a scoped
 *        deployment:persona section on the root (leader persona) and the
 *        seeded member (template persona) BEFORE any work on the session;
 *   M2-2 the scoped section SHADOWS the same-named global section: exactly
 *        one deployment:persona entry assembles, and it is the scoped one;
 *   M2-3 the request boundary (submitAttributedInput) re-applies the
 *        durable truth and leaves the persona in place;
 *   M2-4 restoreScopedPersona disposes EXACTLY the scoped entry: the
 *        global section falls back into view, the global layer is
 *        untouched, and the root agent is unaffected;
 *   M2-5 restoring an already-restored session is a no-op (idempotent);
 *   M2-6 a complete preset is FATAL: boot rejects with the frozen
 *        TEAM_PERSONA_COMPLETE_PRESET_CONFLICT code BEFORE any install
 *        (one create attempt recorded, zero scoped sections);
 *   M2-7 the resume phase (cold root) installs the leader persona on the
 *        resumed agent;
 *   M2-8 a pre-boot personaSurface.installScopedPersona (the pending
 *        window — the agent ctx is not captured yet) flushes at setup,
 *        still before any work.
 */
import { describe, expect, it } from 'vitest'
import type { AgentCtxDouble, AssembledPromptSection } from './t12a-live-bridge.mjs'
import {
  WORKTREE_ROOT,
  createLiveWorld,
  removeFixtureHome,
  withDshHome,
  writeDurableFixture,
} from './t12a-live-bridge.mjs'
import type { TeamPersonaOverlayError } from '../agent-setup/persona/index.js'
import { isTeamPersonaOverlayError } from '../agent-setup/persona/index.js'

const ROOT = 'session-t12a-m2-root'
const INSTANCE = 'inst-t12am2member'
const CHILD = 'session-t12a-m2-child'

// The default bridge blueprint (team.t12a) persona texts.
const LEADER_PERSONA = 'You are the leader of the t12a test team.'
const MEMBER_PERSONA = 'You are member tpl-t12a of the t12a test team.'
// The world's GLOBAL deployment:persona text (the DSH service layer) —
// distinguishable from the blueprint personas so shadowing is observable.
const GLOBAL_PERSONA = 'You are the global deployment persona (the DSH service layer).'

/** The bundle's session input port (structural; the glue reads id + text). */
interface SessionInputBinding {
  readonly sessionInput: {
    submitAttributedInput(input: { sessionId: string; text: string; attribution: unknown }): Promise<void>
  }
}

/** The one deployment:persona entry (any scope) in the assembled layer. */
function personaSection(ctx: AgentCtxDouble): AssembledPromptSection | undefined {
  return ctx.systemPrompt.assemble().find((section) => section.name === 'deployment:persona')
}

/** The deployment:persona entry only when it is the AGENT-SCOPED one. */
function scopedPersona(ctx: AgentCtxDouble): AssembledPromptSection | undefined {
  return ctx.systemPrompt.assemble().find(
    (section) => section.name === 'deployment:persona' && section.scope === 'scoped',
  )
}

// ── world A: boot (create phase) + request boundary + restore ─────────────
const world = await createLiveWorld({
  rootSessionId: ROOT,
  members: [{ childSessionId: CHILD, instanceId: INSTANCE, templateId: 'tpl-t12a' }],
  configOverrides: {
    seedMembers: [
      { instanceId: INSTANCE, templateId: 'tpl-t12a', label: 'member M2', childSessionId: CHILD },
    ],
  },
  systemPromptGlobals: [
    { name: 'harness:identity', order: -1000, text: 'You are an AI agent powered by DeepSeek Harness.' },
    { name: 'deployment:persona', order: 0, text: GLOBAL_PERSONA },
  ],
})
await world.binding.boot()

const rootCtx = world.agents.handles.get(ROOT)!.agent.ctx
const memberCtx = world.agents.handles.get(CHILD)!.agent.ctx
// The shim runs every it AFTER all top-level code — so the pre-restore
// state must be snapshotted at the moment it holds (the restore below
// disposes the member's scoped entry; the its assert the snapshots).
// M2-1 / M2-2: the snapshots are taken IMMEDIATELY after boot — no work
// has run.
const followupsAfterBoot = world.records.followups.length
const rootPersonaAfterBoot = scopedPersona(rootCtx)
const memberPersonaAfterBoot = scopedPersona(memberCtx)
const rootAssembledAfterBoot = rootCtx.systemPrompt.assemble().map((section) => ({ ...section }))
const globalsSnapshot = world.agents.globalSections.map((section) => ({ ...section }))

// M2-3: the request boundary (the real SessionInputPort seam) — the persona
// must survive the durable-truth re-application.
await (world.binding as unknown as SessionInputBinding).sessionInput.submitAttributedInput({
  sessionId: CHILD,
  text: 'ping',
  attribution: {},
})
const memberPersonaAfterRequest = scopedPersona(memberCtx)

// M2-4 / M2-5: restore the member's scoped entry — then restore AGAIN
// (idempotency: the second call must be a no-op over the same result).
world.binding.personaSurface.restoreScopedPersona(CHILD)
const assembledAfterFirst = memberCtx.systemPrompt.assemble().map((section) => ({ ...section }))
world.binding.personaSurface.restoreScopedPersona(CHILD)
const assembledAfterSecond = memberCtx.systemPrompt.assemble().map((section) => ({ ...section }))

// ── world D: the complete preset — FATAL before any install ───────────────
const ROOT_D = 'session-t12a-m2-root-complete'
const worldD = await createLiveWorld({
  rootSessionId: ROOT_D,
  configOverrides: {
    presetSubstrate: { presetId: 't12a-complete-preset', personaKind: 'complete' },
  },
})
let completeError: unknown = undefined
try {
  await worldD.binding.boot()
} catch (error) {
  completeError = error
}
const rootCtxD = worldD.agents.handles.get(ROOT_D)?.agent.ctx

// ── world E: the resume phase (cold root, durable fixture under DSH_HOME) ──
const ROOT_E = 'session-t12a-m2-root-resume'
const worldE = await createLiveWorld({
  rootSessionId: ROOT_E,
  configOverrides: { bootPhase: 'resume' },
})
const restartHome = `${WORKTREE_ROOT}/.tmp-t12a-m2-home`
await withDshHome(restartHome, async () => {
  writeDurableFixture(restartHome, ROOT_E)
  await worldE.binding.boot()
})
removeFixtureHome(restartHome)
const rootCtxE = worldE.agents.handles.get(ROOT_E)!.agent.ctx

// ── world F: the pending window (install before the ctx exists) ────────────
const ROOT_F = 'session-t12a-m2-root-pending'
const worldF = await createLiveWorld({
  rootSessionId: ROOT_F,
  configOverrides: {
    presetSubstrate: { presetId: 't12a-absent-preset', personaKind: 'absent' },
  },
})
worldF.binding.personaSurface.installScopedPersona(ROOT_F, { personaText: 'EARLY PERSONA' })
await worldF.binding.boot()
const rootCtxF = worldF.agents.handles.get(ROOT_F)!.agent.ctx

describe('T12-M2 the blueprint persona installed into the real DSH Agent prompt', () => {
  it('M2-1 setup installs the blueprint persona (root + member) before any work', () => {
    expect(world.records.creates.length).toBe(2)
    expect(followupsAfterBoot).toBe(0)
    expect(rootPersonaAfterBoot !== undefined).toBe(true)
    expect(rootPersonaAfterBoot!.text).toBe(LEADER_PERSONA)
    expect(rootPersonaAfterBoot!.order).toBe(0)
    expect(memberPersonaAfterBoot !== undefined).toBe(true)
    expect(memberPersonaAfterBoot!.text).toBe(MEMBER_PERSONA)
  })

  it('M2-2 the scoped section shadows the global deployment:persona (exactly one entry)', () => {
    const entries = rootAssembledAfterBoot.filter((section) => section.name === 'deployment:persona')
    expect(entries.length).toBe(1)
    expect(entries[0]!.scope).toBe('scoped')
    expect(entries[0]!.text).toBe(LEADER_PERSONA)
  })

  it('M2-3 the request boundary (attributed input) leaves the persona in place', () => {
    expect(world.records.followups.length).toBe(1)
    expect(world.records.followups[0]!.sessionId).toBe(CHILD)
    expect(memberPersonaAfterRequest !== undefined).toBe(true)
    expect(memberPersonaAfterRequest!.text).toBe(MEMBER_PERSONA)
  })

  it('M2-4 restore disposes exactly the scoped entry (global falls back, root unaffected)', () => {
    const memberPersona = personaSection(memberCtx)
    expect(memberPersona !== undefined).toBe(true)
    expect(memberPersona!.scope).toBe('global')
    expect(memberPersona!.text).toBe(GLOBAL_PERSONA)
    expect(world.agents.globalSections).toEqual(globalsSnapshot)
    const rootPersona = scopedPersona(rootCtx)
    expect(rootPersona !== undefined).toBe(true)
    expect(rootPersona!.text).toBe(LEADER_PERSONA)
  })

  it('M2-5 a second restore for the same session is a no-op (idempotent)', () => {
    expect(assembledAfterSecond).toEqual(assembledAfterFirst)
  })

  it('M2-6 a complete preset is FATAL: boot rejects with the frozen conflict code, before any install', () => {
    expect(completeError !== undefined).toBe(true)
    expect(isTeamPersonaOverlayError(completeError)).toBe(true)
    expect((completeError as TeamPersonaOverlayError).code).toBe('TEAM_PERSONA_COMPLETE_PRESET_CONFLICT')
    // The create attempt is recorded BEFORE the FATAL setup runs; the setup
    // throws before any scoped section is registered.
    expect(worldD.records.creates.length).toBe(1)
    expect(rootCtxD !== undefined).toBe(true)
    expect(scopedPersona(rootCtxD!)).toBe(undefined)
  })

  it('M2-7 the resume phase (cold root) installs the leader persona on the resumed agent', () => {
    expect(worldE.records.resumes.length).toBe(1)
    expect(worldE.records.resumes[0]!.sessionId).toBe(ROOT_E)
    expect(worldE.records.creates.length).toBe(0)
    const persona = scopedPersona(rootCtxE)
    expect(persona !== undefined).toBe(true)
    expect(persona!.text).toBe(LEADER_PERSONA)
  })

  it('M2-8 a pre-boot installScopedPersona (the pending window) flushes at setup, before any work', () => {
    expect(worldF.records.creates.length).toBe(1)
    expect(worldF.records.followups.length).toBe(0)
    const persona = scopedPersona(rootCtxF)
    expect(persona !== undefined).toBe(true)
    expect(persona!.text).toBe('EARLY PERSONA')
  })
})
