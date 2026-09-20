/**
 * Async work completion (wake-up) — the PURE notification module tests
 * (work-completion-wakeup plan §22, N1–N5):
 *
 *   N1. deterministic render — the same input renders byte-identical
 *       output (a best-effort redelivery is recognizable);
 *   N2. required fields — the text leads with the machine-dedup token,
 *       names the requestToken (the `team_collect` argument) and the
 *       instanceId, and points at `team_collect` for the durable result;
 *   N3. optional taskSummary — present when given, and a BLANK or
 *       ABSENT summary produces no `taskSummary:` line (never
 *       `taskSummary: undefined`);
 *   N4. no member result — the text never carries the member body, a
 *       member error, or a transcript (minimal metadata only);
 *   N5. targets array — the factory iterates the target set
 *       (`[{ kind: 'leader' }]` today) and delegates every target's
 *       delivery to the seam with the rendered text; a delivery
 *       REJECTION propagates to the notifier layer (the router
 *       observer swallows it — the R5/R6 suites prove the observer
 *       side; the module itself never retries and never swallows).
 *
 * Pure: no world, no ports, no clock — the module is renderer + factory
 * only (plan §4: no TeamDomain scan, no retry, no ledger, no terminal
 * judgment, no member-result read).
 *
 * @module @dsh-agent-team/runtime/test/work-completion-notification
 */

import { describe, expect, it } from 'vitest'

import {
  createWorkCompletionNotifier,
  renderWorkCompletionNotification,
} from '../work-completion-notification/index.js'
import type {
  WorkCompletionNotification,
  WorkCompletionNotificationDeliveryPort,
} from '../work-completion-notification/index.js'

const TOKEN = 'wcn-token-1'
const INSTANCE = 'inst-wcnworker'

const NOTIFICATION: WorkCompletionNotification = {
  rootSessionId: 'session-wcn-root',
  requestToken: TOKEN,
  instanceId: INSTANCE,
  taskSummary: 'probe the deployment',
  targets: [{ kind: 'leader' }],
}

// --- N1–N4 the renderer -----------------------------------------------------------

describe('renderWorkCompletionNotification (work-completion-wakeup N1–N4)', () => {
  it('N1: the render is deterministic — the same input renders byte-identical output', () => {
    const a = renderWorkCompletionNotification(NOTIFICATION)
    const b = renderWorkCompletionNotification({ ...NOTIFICATION })
    expect(a).toBe(b)
  })

  it('N2: the text leads with the stable token and carries the required fields', () => {
    const text = renderWorkCompletionNotification(NOTIFICATION)
    // the machine-dedup token leads the text
    expect(text.startsWith(`[team-work-settled requestToken=${TOKEN}]\n`)).toBe(true)
    // the identity fields (the team_collect argument is named twice:
    // the prefix + the explicit field)
    expect(text).toContain(`instanceId: ${INSTANCE}`)
    expect(text).toContain(`requestToken: ${TOKEN}`)
    // the durable-result guidance (the notification is metadata only)
    expect(text).toContain('team_collect')
  })

  it('N3: the optional taskSummary appears when present and NO line when absent or blank', () => {
    const withSummary = renderWorkCompletionNotification(NOTIFICATION)
    expect(withSummary).toContain('taskSummary: probe the deployment')

    const noSummary = renderWorkCompletionNotification({
      requestToken: TOKEN,
      instanceId: INSTANCE,
    })
    expect(noSummary).not.toContain('taskSummary')

    const blankSummary = renderWorkCompletionNotification({
      requestToken: TOKEN,
      instanceId: INSTANCE,
      taskSummary: '   ',
    })
    expect(blankSummary).not.toContain('taskSummary')
    expect(blankSummary).not.toContain('undefined')
  })

  it('N4: the text never carries member results, errors, or a transcript (minimal metadata only)', () => {
    // The renderer's input surface is exactly
    // { requestToken, instanceId, taskSummary } — there is NO member
    // result / error / transcript field to render (the DTO itself has
    // no such slot, and the module never reads one). Negative control:
    // none of the member-result vocabulary appears in the output.
    const memberBody = 'RESULT-BODY-SECRET'
    const text = renderWorkCompletionNotification({
      requestToken: TOKEN,
      instanceId: INSTANCE,
      taskSummary: 'probe the deployment',
    })
    expect(text).not.toContain(memberBody)
    expect(text).not.toContain('memberResult')
    expect(text).not.toContain('body:')
    expect(text).not.toContain('transcript')
    expect(text).not.toContain('error:')
    // and the full durable result is explicitly deferred to the
    // read-back tool (the notification is a liveness hint, not a result)
    expect(text).toContain('read the durable result')
  })

  it('N4b: an over-bound taskSummary is truncated at the existing 512-char bound (no complex scheme)', () => {
    const over = 'x'.repeat(600)
    const text = renderWorkCompletionNotification({
      requestToken: TOKEN,
      instanceId: INSTANCE,
      taskSummary: over,
    })
    const line = text.split('\n').find((candidate) => candidate.startsWith('taskSummary: '))
    expect(line).toBe(`taskSummary: ${'x'.repeat(512)}`)
  })
})

// --- N5 the factory over the delivery seam ---------------------------------------

describe('createWorkCompletionNotifier (work-completion-wakeup N5)', () => {
  it('N5: the factory iterates the target set and delegates each target to the seam (leader-only today)', async () => {
    const delivered: Array<{
      readonly rootSessionId: string
      readonly target: { readonly kind: string }
      readonly text: string
    }> = []
    const deliveryPort: WorkCompletionNotificationDeliveryPort = {
      deliver: async (args) => {
        delivered.push({ ...args })
      },
    }
    const notifier = createWorkCompletionNotifier({ deliver: deliveryPort })
    await notifier.notifyWorkCompletion(NOTIFICATION)

    expect(delivered).toHaveLength(1)
    expect(delivered[0]!.rootSessionId).toBe('session-wcn-root')
    expect(delivered[0]!.target).toEqual({ kind: 'leader' })
    expect(delivered[0]!.text).toBe(renderWorkCompletionNotification(NOTIFICATION))
  })

  it('N5b: a delivery rejection PROPAGATES to the notifier layer (no retry, no swallow here)', async () => {
    const calls: number[] = []
    const failingPort: WorkCompletionNotificationDeliveryPort = {
      deliver: async () => {
        calls.push(1)
        throw new Error('glue: leader agent unavailable')
      },
    }
    const notifier = createWorkCompletionNotifier({ deliver: failingPort })
    await expect(notifier.notifyWorkCompletion(NOTIFICATION)).rejects.toThrow(
      'glue: leader agent unavailable',
    )
    // no retry inside the module: exactly one delivery attempt
    expect(calls).toHaveLength(1)
  })
})
