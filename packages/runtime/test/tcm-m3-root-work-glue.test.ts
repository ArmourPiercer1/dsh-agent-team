/**
 * tcm-m3-root-work-glue.test.ts — TCM-M3: the live glue's new
 * `deliverRootWork` port (the creation-time Root initial work's
 * model-visible delivery adapter, plan §15.7/§15.8) over the REAL glue
 * bundle through the t12a live bridge (the DSH service doubles).
 *
 * The port is a PRIVATE extraction: `deliverRootContext` (the B6 handoff
 * seam) now delegates its body to the shared private `deliverRootInput`
 * path, and `deliverRootWork` is the thin token-leading adapter over the
 * SAME path. This file pins:
 *   RW-1 the handoff seam is UNCHANGED: createRootAgent +
 *        deliverRootContext still deliver the exact token-leading text as
 *        a real model-visible user turn and materialize before settling;
 *   RW-2 deliverRootWork puts the EXACT token-leading text in —
 *        `[team-root-work requestToken=<token>] <prompt>` — as a real
 *        model-visible user turn on the same input path (the requestToken
 *        is the model-visible dedupe identity of the at-least-once
 *        redelivery the Root initial-work strategy owns durably);
 *   RW-3 the same text carries the `[attached-context]` block when the
 *        input has a non-empty attachedContext (the member work delivery's
 *        block shape);
 *   RW-4 the delivered turn is materialized through the public persistence
 *        seam before the port settles;
 *   RW-5 NO dedupe in the glue: a second delivery of the same requestToken
 *        goes out again (at-least-once; the strategy's durable side
 *        replay/retry decides, the glue only submits);
 *   RW-6 validation fails loud (a missing requestToken / prompt rejects
 *        before any agent interaction — no turn recorded);
 *   RW-7 a rejected delivery (whenIdle) PROPAGATES to the caller: the turn
 *        was submitted, the post-turn materialization never ran (the
 *        strategy maps the rejection to WORK_DELIVERY_FAILED with the
 *        durable admission retained);
 *   RW-8 delivering to a session that is neither live nor durable rejects
 *        (no agent to run on);
 *   RW-9 deliverRootWork works on a root the SAME createRootAgent started
 *        (G1's actual sequence: the handoff starts the target root, then
 *        the Root initial-work closure delivers into it).
 */
import { describe, expect, it } from 'vitest'
import { createLiveWorld } from './t12a-live-bridge.mjs'

const BOOT_RW = 'session-tcm-m3-rw-boot'
const ROOT_RW = 'session-tcm-m3-rw-root'
const BOOT_HANDOFF = 'session-tcm-m3-rw-handoff'
const ROOT_HANDOFF = 'session-tcm-m3-rw-handoff-root'
const BOOT_FAIL = 'session-tcm-m3-rw-fail'
const ROOT_FAIL = 'session-tcm-m3-rw-fail-root'
const ROOT_DEAD = 'session-tcm-m3-rw-dead'

const TOKEN_RW = 'tok-tcm-m3-rw-1'
const PROMPT_RW = 'kick off the project plan'
const CONTEXT_RW = 'the durable bootstrap receipt'
const HANDOFF_TOKEN = 'tok-tcm-m3-rw-handoff'
const HANDOFF_TEXT = `handoff-context ${HANDOFF_TOKEN}\n{"note":"frozen context"}`

/** The text of the i-th recorded followup turn (test failure otherwise). */
function followupText(world: { readonly records: { readonly followups: readonly { readonly sessionId: string; readonly message: unknown }[] } }, index: number): string {
  const entry = world.records.followups[index]
  if (entry === undefined) {
    throw new Error(`followupText(${index}): only ${world.records.followups.length} followups recorded`)
  }
  const content = (entry.message as { content?: readonly { text?: string }[] }).content
  return content?.[0]?.text ?? '(no text part)'
}

// ── world RW: the new port over a handoff-created root ─────────────────────

const worldRW = await createLiveWorld({
  rootSessionId: BOOT_RW,
  teamSession: {
    rootSessionId: ROOT_RW,
    sessionId: ROOT_RW,
    blueprintId: 'team.t12a',
    generation: 1,
    defaultWorkspace: '/ws/tcm-m3-rw',
  },
  configOverrides: { defaultWorkspace: '/cfg/default' },
})

// RW-9: the G1 sequence — the handoff starts the target root FIRST.
await worldRW.binding.createRootAgent(ROOT_RW)
const rwCreatesAfterCreate = worldRW.records.creates.length
const rwResumesAfterCreate = worldRW.records.resumes.length

// RW-6a: validation fails loud BEFORE any agent interaction.
let rwTokenError: unknown
try {
  await worldRW.binding.deliverRootWork({
    rootSessionId: ROOT_RW,
    prompt: PROMPT_RW,
  } as { rootSessionId: string; requestToken: string; prompt: string })
} catch (error) {
  rwTokenError = error
}
const rwFollowupsAfterTokenError = worldRW.records.followups.length
let rwPromptError: unknown
try {
  await worldRW.binding.deliverRootWork({
    rootSessionId: ROOT_RW,
    requestToken: TOKEN_RW,
    prompt: '',
  })
} catch (error) {
  rwPromptError = error
}
const rwFollowupsAfterPromptError = worldRW.records.followups.length

// RW-2: the real delivery without attached context — the exact text.
await worldRW.binding.deliverRootWork({
  rootSessionId: ROOT_RW,
  requestToken: TOKEN_RW,
  prompt: PROMPT_RW,
})
const rwFollowupsAfterDeliver1 = worldRW.records.followups.length
const rwMsg1Session = worldRW.records.followups[0]?.sessionId
const rwMsg1Role = (worldRW.records.followups[0]?.message as { role?: string })?.role
const rwText1 = rwFollowupsAfterDeliver1 > 0 ? followupText(worldRW, 0) : '(none)'
// The fresh start materialized the root (createRootAgent's seam); the
// delivered turn materializes it AGAIN before the port settles.
const rwMaterializedAfterDeliver1 = worldRW.records.materialized.length
const rwMaterializedLast = worldRW.records.materialized[worldRW.records.materialized.length - 1]

// RW-3: the same delivery WITH a non-empty attached-context block.
await worldRW.binding.deliverRootWork({
  rootSessionId: ROOT_RW,
  requestToken: TOKEN_RW,
  prompt: PROMPT_RW,
  attachedContext: CONTEXT_RW,
})
const rwFollowupsAfterDeliver2 = worldRW.records.followups.length
const rwText2 = rwFollowupsAfterDeliver2 > 1 ? followupText(worldRW, 1) : '(none)'

// RW-4: an empty attachedContext is equivalent to absent (no block).
await worldRW.binding.deliverRootWork({
  rootSessionId: ROOT_RW,
  requestToken: TOKEN_RW,
  prompt: PROMPT_RW,
  attachedContext: '',
})
const rwText3 = followupText(worldRW, 2)

// RW-5: NO dedupe — the SAME token goes out again (at-least-once).
await worldRW.binding.deliverRootWork({
  rootSessionId: ROOT_RW,
  requestToken: TOKEN_RW,
  prompt: PROMPT_RW,
})
const rwFollowupsTotal = worldRW.records.followups.length
const rwText4 = followupText(worldRW, 3)

// RW-8: a dead target (neither live nor durable) rejects.
let rwDeadError: unknown
try {
  await worldRW.binding.deliverRootWork({
    rootSessionId: ROOT_DEAD,
    requestToken: TOKEN_RW,
    prompt: PROMPT_RW,
  })
} catch (error) {
  rwDeadError = error
}
const rwFollowupsAfterDead = worldRW.records.followups.length

// ── world HANDOFF: the handoff seam is unchanged ────────────────────────────

const worldHandoff = await createLiveWorld({
  rootSessionId: BOOT_HANDOFF,
  teamSession: {
    rootSessionId: ROOT_HANDOFF,
    sessionId: ROOT_HANDOFF,
    blueprintId: 'team.t12a',
    generation: 1,
    defaultWorkspace: '/ws/tcm-m3-handoff',
  },
})
await worldHandoff.binding.createRootAgent(ROOT_HANDOFF)
const hCreates = worldHandoff.records.creates.length
await worldHandoff.binding.deliverRootContext({
  rootSessionId: ROOT_HANDOFF,
  contextToken: HANDOFF_TOKEN,
  text: HANDOFF_TEXT,
})
const hFollowups = worldHandoff.records.followups.length
const hText = hFollowups > 0 ? followupText(worldHandoff, 0) : '(none)'
// The fresh start materializes the root (createRootAgent's seam), and the
// delivered turn materializes it AGAIN before the port settles.
const hMaterialized = worldHandoff.records.materialized.length
const hMaterializedLast = worldHandoff.records.materialized[worldHandoff.records.materialized.length - 1]

// ── world FAIL: a rejected delivery propagates ──────────────────────────────

const worldFail = await createLiveWorld({
  rootSessionId: BOOT_FAIL,
  teamSession: {
    rootSessionId: ROOT_FAIL,
    sessionId: ROOT_FAIL,
    blueprintId: 'team.t12a',
    generation: 1,
  },
  agents: { whenIdleBehavior: () => Promise.reject(new Error('root delivery seam down')) },
})
await worldFail.binding.createRootAgent(ROOT_FAIL)
const fCreates = worldFail.records.creates.length
let fDeliverError: unknown
try {
  await worldFail.binding.deliverRootWork({
    rootSessionId: ROOT_FAIL,
    requestToken: TOKEN_RW,
    prompt: PROMPT_RW,
  })
} catch (error) {
  fDeliverError = error
}
const fFollowups = worldFail.records.followups.length
// Exactly the createRootAgent seam materialization — the FAILED delivery
// never reached its post-turn materialization.
const fMaterialized = worldFail.records.materialized.length

// ── assertions ──────────────────────────────────────────────────────────────

describe('TCM-M3: the glue deliverRootWork port (plan §15.7/§15.8)', () => {
  it('RW-1/RW-9: the handoff seam is unchanged and starts the target root the port delivers into', () => {
    expect(rwCreatesAfterCreate).toBe(1)
    expect(rwResumesAfterCreate).toBe(0)
    expect(hCreates).toBe(1)
    expect(hFollowups).toBe(1)
    expect(hText).toBe(HANDOFF_TEXT)
    // create (1) + the delivered turn (1) — the last materialization is the delivery.
    expect(hMaterialized).toBe(2)
    expect(hMaterializedLast).toBe(ROOT_HANDOFF)
  })
  it('RW-2: delivers the EXACT token-leading text as a real user turn (no attached-context block)', () => {
    expect(rwFollowupsAfterDeliver1).toBe(1)
    expect(rwMsg1Session).toBe(ROOT_RW)
    expect(rwMsg1Role).toBe('user')
    expect(rwText1).toBe(`[team-root-work requestToken=${TOKEN_RW}] ${PROMPT_RW}`)
  })
  it('RW-3: carries the [attached-context] block for a non-empty attachedContext', () => {
    expect(rwFollowupsAfterDeliver2).toBe(2)
    expect(rwText2).toBe(
      `[team-root-work requestToken=${TOKEN_RW}] ${PROMPT_RW}\n\n[attached-context]\n${CONTEXT_RW}`,
    )
  })
  it('RW-4: an empty attachedContext is equivalent to absent (no block)', () => {
    expect(rwText3).toBe(`[team-root-work requestToken=${TOKEN_RW}] ${PROMPT_RW}`)
  })
  it('RW-4: the turn is materialized through the public persistence seam before the port settles', () => {
    // create (1) + the delivered turn (1) — the last materialization is the delivery.
    expect(rwMaterializedAfterDeliver1).toBe(2)
    expect(rwMaterializedLast).toBe(ROOT_RW)
  })
  it('RW-5: no dedupe in the glue — the same token goes out again (at-least-once)', () => {
    expect(rwFollowupsTotal).toBe(4)
    expect(rwText4).toBe(`[team-root-work requestToken=${TOKEN_RW}] ${PROMPT_RW}`)
  })
  it('RW-6: validation fails loud before any agent interaction (no turn recorded)', () => {
    expect(rwTokenError instanceof Error).toBe(true)
    expect(rwPromptError instanceof Error).toBe(true)
    expect(rwFollowupsAfterTokenError).toBe(0)
    expect(rwFollowupsAfterPromptError).toBe(0)
  })
  it('RW-7: a rejected delivery propagates (turn submitted, materialization never ran)', () => {
    expect(fCreates).toBe(1)
    expect(fDeliverError instanceof Error).toBe(true)
    expect((fDeliverError as Error).message).toBe('root delivery seam down')
    expect(fFollowups).toBe(1)
    // only the createRootAgent seam materialization — the failed delivery never materialized
    expect(fMaterialized).toBe(1)
  })
  it('RW-8: a session that is neither live nor durable rejects (no agent to run on)', () => {
    expect(rwDeadError instanceof Error).toBe(true)
    expect(rwFollowupsAfterDead).toBe(rwFollowupsTotal)
  })
})
