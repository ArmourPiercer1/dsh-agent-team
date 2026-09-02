/**
 * t12a-glue-handoff-ports.test.ts — T12-GLUE: the production live glue for
 * the B6 handoff ports (createRootAgent / deliverRootContext).
 *
 * The with-context handoff drives the ONE formal createAndStartTeam
 * primitive in the production root; after the canonical fresh-root binding
 * (durable TeamSession + team-root binding + leader mint) the primitive
 * calls the glue's two ports on the SAME real live binding the boot path
 * uses. This file drives the REAL glue bundle through the t12a live bridge
 * (the DSH service doubles) and pins the port contract:
 *   GLUE-1 createRootAgent on a freshly-minted handoff root (durable TEAM
 *         rows only, no DSH session artifact) goes through agents.create —
 *         the same factory the boot path uses — the root session id, the
 *         handle registered live;
 *   GLUE-2 the created agent's cwd is the root's EFFECTIVE workspace: the
 *         durable TeamSession row's defaultWorkspace (the value bindFresh
 *         persisted), with the row config only as fallback — never the
 *         config value and never DSH_HOME (T12-M1);
 *   GLUE-3 the shared setup installs the leader persona (M2) under the
 *         target's OWN root identity before any work — the handoff root
 *         is a team root of the row's domain, not this row's boot root;
 *   GLUE-4 the scoped persona shadows the global deployment:persona
 *         (exactly one entry assembles, the scoped one);
 *   GLUE-5 createRootAgent is create-or-ensure: a second start for an
 *         already-live root is a no-op (no second create/resume, same
 *         handle);
 *   GLUE-6 deliverRootContext puts the EXACT token-leading text in as a
 *         real model-visible user turn on the same input path the delegate
 *         work uses (createUserMessage + followup);
 *   GLUE-7 the delivered turn is materialized through the public
 *         persistence seam before the port settles (durable at once);
 *   GLUE-8 NO dedupe in the glue: a second delivery of the same
 *         contextToken goes out again (at-least-once; B6's durable side
 *         dedupes by contextToken — the glue only submits and propagates);
 *   GLUE-9 validation fails loud (a missing contextToken rejects before
 *         any agent interaction — no turn recorded);
 *   GLUE-10 a rejected delivery (whenIdle) PROPAGATES to the caller (B6
 *         maps the rejection to creation-failed and retries): the turn was
 *         submitted, the post-turn materialization never ran;
 *   GLUE-11 a root with no effective persona (empty blueprint) starts
 *         clean (no scoped section); delivering to a session that is
 *         neither live nor durable rejects (no agent to run on);
 *   GLUE-12 a root whose session artifact IS durable (the restart window
 *         between a failed start and the B6 retry) re-attaches through
 *         agents.resume with the same setup — the leader persona present.
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

const BOOT_A = 'session-t12a-glue-boot-a'
const HANDOFF_A = 'session-t12a-glue-handoff-a'
const BOOT_B = 'session-t12a-glue-boot-b'
const HANDOFF_B = 'session-t12a-glue-handoff-b'
const BOOT_C = 'session-t12a-glue-boot-c'
const HANDOFF_C = 'session-t12a-glue-handoff-c'
const HANDOFF_C_DEAD = 'session-t12a-glue-handoff-c-dead'
const BOOT_D = 'session-t12a-glue-boot-d'
const HANDOFF_D = 'session-t12a-glue-handoff-d'

const TOKEN_A = 'tok-t12a-glue-1'
// The B6 handoff text shape: the contextToken LEADS (the target side
// dedupes on it), the canonical context follows.
const TEXT_A = `handoff-context ${TOKEN_A}\n{"contextToken":"tok-t12a-glue-1","note":"frozen context"}`
const LEADER_PERSONA = 'You are the leader of the t12a test team.'

function scopedPersona(ctx: AgentCtxDouble): AssembledPromptSection | undefined {
  return ctx.systemPrompt.assemble().find(
    (section) => section.name === 'deployment:persona' && section.scope === 'scoped',
  )
}

// ── world A: the fresh handoff root — create, deliver, at-least-once ──────
// The durable TeamSession row for the HANDOFF root (bindFresh's product):
// its own defaultWorkspace is the effective workspace the created agent's
// cwd must carry — the row config defaultWorkspace is a DISTRACTING
// different value, proving the row (not the config, not DSH_HOME) wins.
const worldA = await createLiveWorld({
  rootSessionId: BOOT_A,
  teamSession: {
    rootSessionId: HANDOFF_A,
    sessionId: HANDOFF_A,
    blueprintId: 'team.t12a',
    generation: 1,
    defaultWorkspace: '/ws/handoff-team',
  },
  configOverrides: { defaultWorkspace: '/cfg/default' },
})

// GLUE-1..4: the fresh start (no DSH session artifact yet — bindFresh
// wrote the durable TEAM rows, not the session log).
await worldA.binding.createRootAgent(HANDOFF_A)
const aCreatesAfterCreate = worldA.records.creates.length
const aResumesAfterCreate = worldA.records.resumes.length
const aCreateEntry = worldA.records.creates[0]!
const aCreateCwd = aCreateEntry.meta === undefined ? undefined : aCreateEntry.meta.cwd
const aCreateSetupProvided = aCreateEntry.setupProvided
const aHandleAfterCreate = worldA.agents.handles.get(HANDOFF_A)
const aCtx = aHandleAfterCreate!.agent.ctx
const aPersonaAfterCreate = scopedPersona(aCtx)
const aAssembledAfterCreate = aCtx.systemPrompt.assemble().map((section) => ({ ...section }))
const aMaterializedAfterCreate = worldA.records.materialized.length

// GLUE-5: create-or-ensure — the second start is a no-op.
await worldA.binding.createRootAgent(HANDOFF_A)
const aCreatesAfterSecond = worldA.records.creates.length
const aResumesAfterSecond = worldA.records.resumes.length
const aHandleAfterSecond = worldA.agents.handles.get(HANDOFF_A)

// GLUE-9: validation fails loud BEFORE any agent interaction. (The port's
// declared input type requires contextToken; this call deliberately omits
// it to exercise the runtime validation — the cast is the type-level stand
// for the malformed input.)
let aTokenError: unknown
try {
  await worldA.binding.deliverRootContext({
    rootSessionId: HANDOFF_A,
    text: TEXT_A,
  } as { rootSessionId: string; contextToken: string; text: string })
} catch (error) {
  aTokenError = error
}
const aFollowupsAfterTokenError = worldA.records.followups.length

// GLUE-6..7: the real delivery (the exact token-leading text).
await worldA.binding.deliverRootContext({
  rootSessionId: HANDOFF_A,
  contextToken: TOKEN_A,
  text: TEXT_A,
})
const aFollowupsAfterDeliver1 = worldA.records.followups.length
const aDeliver1Entry = worldA.records.followups[0]!
const aMsg1Role = (aDeliver1Entry.message as unknown as { readonly role: string }).role
const aMsg1Type = (
  aDeliver1Entry.message as unknown as { readonly content: readonly { readonly type: string }[] }
).content[0]!.type
const aMsg1Text = (
  aDeliver1Entry.message as unknown as { readonly content: readonly { readonly text: string }[] }
).content[0]!.text
const aMaterializedAfterDeliver1 = worldA.records.materialized.length

// GLUE-8: the SAME token again — the glue does NOT dedupe (B6's durable
// side does).
await worldA.binding.deliverRootContext({
  rootSessionId: HANDOFF_A,
  contextToken: TOKEN_A,
  text: TEXT_A,
})
const aFollowupsAfterDeliver2 = worldA.records.followups.length
const aMsg2Text = (
  worldA.records.followups[1]!.message as unknown as { readonly content: readonly { readonly text: string }[] }
).content[0]!.text

// ── world B: a rejected delivery propagates ───────────────────────────────
const worldB = await createLiveWorld({
  rootSessionId: BOOT_B,
  teamSession: {
    rootSessionId: HANDOFF_B,
    sessionId: HANDOFF_B,
    blueprintId: 'team.t12a',
    generation: 1,
  },
  agents: { whenIdleBehavior: () => Promise.reject(new Error('delivery seam down')) },
})
await worldB.binding.createRootAgent(HANDOFF_B)
const bCreates = worldB.records.creates.length
const bResumes = worldB.records.resumes.length
let bDeliverError: unknown
try {
  await worldB.binding.deliverRootContext({
    rootSessionId: HANDOFF_B,
    contextToken: TOKEN_A,
    text: TEXT_A,
  })
} catch (error) {
  bDeliverError = error
}
const bFollowups = worldB.records.followups.length
const bMaterialized = worldB.records.materialized.length

// ── world C: no effective persona + a dead delivery target ────────────────
const worldC = await createLiveWorld({
  rootSessionId: BOOT_C,
  teamSession: {
    rootSessionId: HANDOFF_C,
    sessionId: HANDOFF_C,
    blueprintId: 'team.t12a',
    generation: 1,
  },
  configOverrides: { blueprintSource: '' },
})
await worldC.binding.createRootAgent(HANDOFF_C)
const cCreates = worldC.records.creates.length
const cPersona = scopedPersona(worldC.agents.handles.get(HANDOFF_C)!.agent.ctx)
let cDeadError: unknown
try {
  await worldC.binding.deliverRootContext({
    rootSessionId: HANDOFF_C_DEAD,
    contextToken: TOKEN_A,
    text: TEXT_A,
  })
} catch (error) {
  cDeadError = error
}

// ── world D: the restart window — a durable root resumes ──────────────────
const worldD = await createLiveWorld({
  rootSessionId: BOOT_D,
  teamSession: {
    rootSessionId: HANDOFF_D,
    sessionId: HANDOFF_D,
    blueprintId: 'team.t12a',
    generation: 1,
  },
})
const glueHome = `${WORKTREE_ROOT}/.tmp-t12a-glue-home`
await withDshHome(glueHome, async () => {
  writeDurableFixture(glueHome, HANDOFF_D)
  await worldD.binding.createRootAgent(HANDOFF_D)
})
removeFixtureHome(glueHome)
const dCreates = worldD.records.creates.length
const dResumes = worldD.records.resumes.length
const dResumeEntry = worldD.records.resumes[0]!
const dHandle = worldD.agents.handles.get(HANDOFF_D)
const dPersona = dHandle === undefined ? undefined : scopedPersona(dHandle.agent.ctx)

describe('T12-GLUE the production live glue for the handoff ports', () => {
  it('GLUE-1 a freshly-minted handoff root starts through agents.create (the boot path factory)', () => {
    expect(aCreatesAfterCreate).toBe(1)
    expect(aResumesAfterCreate).toBe(0)
    expect(aCreateEntry.sessionId).toBe(HANDOFF_A)
    expect(aHandleAfterCreate !== undefined).toBe(true)
    expect(aHandleAfterCreate!.agent.session.id).toBe(HANDOFF_A)
    // The fresh start materializes the session through the public seam.
    expect(aMaterializedAfterCreate).toBe(1)
  })

  it('GLUE-2 the created root cwd is the durable row defaultWorkspace (never the config, never DSH_HOME)', () => {
    expect(aCreateCwd).toBe('/ws/handoff-team')
    // The row config carries a different value — the row won.
    expect(worldA.config.defaultWorkspace).toBe('/cfg/default')
  })

  it('GLUE-3 the setup installs the leader persona under the target root identity', () => {
    expect(aCreateSetupProvided).toBe(true)
    expect(aPersonaAfterCreate !== undefined).toBe(true)
    expect(aPersonaAfterCreate!.text).toBe(LEADER_PERSONA)
    expect(aPersonaAfterCreate!.order).toBe(0)
  })

  it('GLUE-4 the scoped persona shadows the global deployment:persona (exactly one entry)', () => {
    const entries = aAssembledAfterCreate.filter((section) => section.name === 'deployment:persona')
    expect(entries.length).toBe(1)
    expect(entries[0]!.scope).toBe('scoped')
    expect(entries[0]!.text).toBe(LEADER_PERSONA)
  })

  it('GLUE-5 createRootAgent is create-or-ensure: a second start for the live root is a no-op', () => {
    expect(aCreatesAfterSecond).toBe(1)
    expect(aResumesAfterSecond).toBe(0)
    expect(aHandleAfterSecond === aHandleAfterCreate).toBe(true)
  })

  it('GLUE-6 deliverRootContext puts the exact token-leading text in as a real user turn', () => {
    expect(aFollowupsAfterDeliver1).toBe(1)
    expect(aDeliver1Entry.sessionId).toBe(HANDOFF_A)
    expect(aMsg1Role).toBe('user')
    expect(aMsg1Type).toBe('text')
    expect(aMsg1Text).toBe(TEXT_A)
  })

  it('GLUE-7 the delivered turn is materialized through the persistence seam before the port settles', () => {
    expect(aMaterializedAfterDeliver1).toBe(2)
    expect(worldA.records.materialized[1]!).toBe(HANDOFF_A)
  })

  it('GLUE-8 no dedupe in the glue: the same contextToken goes out again (at-least-once, B6 dedupes)', () => {
    expect(aFollowupsAfterDeliver2).toBe(2)
    expect(aMsg2Text).toBe(TEXT_A)
  })

  it('GLUE-9 a missing contextToken rejects loud before any agent interaction', () => {
    expect(aTokenError instanceof Error).toBe(true)
    expect((aTokenError as Error).message.includes('requires a non-empty contextToken')).toBe(true)
    expect(aFollowupsAfterTokenError).toBe(0)
  })

  it('GLUE-10 a rejected delivery propagates: the turn was submitted, the post-turn materialization never ran', () => {
    expect(bCreates).toBe(1)
    expect(bResumes).toBe(0)
    expect(bDeliverError instanceof Error).toBe(true)
    expect((bDeliverError as Error).message).toBe('delivery seam down')
    expect(bFollowups).toBe(1)
    expect(bMaterialized).toBe(1)
  })

  it('GLUE-11 no effective persona starts clean; a dead target (neither live nor durable) rejects', () => {
    expect(cCreates).toBe(1)
    expect(cPersona === undefined).toBe(true)
    expect(cDeadError instanceof Error).toBe(true)
    expect((cDeadError as Error).message.includes('neither live nor durable')).toBe(true)
  })

  it('GLUE-12 a durable root (the restart window) re-attaches through agents.resume with the same setup', () => {
    expect(dCreates).toBe(0)
    expect(dResumes).toBe(1)
    expect(dResumeEntry.sessionId).toBe(HANDOFF_D)
    expect(dResumeEntry.setupProvided).toBe(true)
    expect(dHandle !== undefined).toBe(true)
    expect(dPersona !== undefined).toBe(true)
    expect(dPersona!.text).toBe(LEADER_PERSONA)
  })
})
