/**
 * a5p7-cproc-fixture.ts — the C-PROC-shaped execution fixture for the PR7
 * lane (INTERFACES-v1 §C-PROC: stage closed set probe→prepare→execute→
 * terminate; terminate ≠ cancel). The REAL stdio provider is PR4's; this
 * fixture is the documented stand-in the lane develops against, and the
 * stage order it reproduces is the measured one from the PR1r double
 * (pre-execute → guard → execute → Body resolved at the innermost step).
 *
 * The fixture answers with the pinned Host's TWO canonical cancellation
 * shapes and maps each onto the plane's event names exactly as the PR1r
 * `classifyOutcome` does — that mapping is the contract this lane consumes:
 *
 *   cancel raised BEFORE the Body is resolved  ⇒ ABORTED_BEFORE_DISPATCH,
 *       bodyInvoked false  ⇒ `dispatcher-call-cancelled-before-body`
 *   cancel raised AFTER the Body started       ⇒ ABORTED, value preserved
 *       ⇒ `dispatcher-call-terminated-after-body-start`
 *   cancel lost the race entirely              ⇒ ordinary outcome
 *       ⇒ `dispatcher-call-completed-after-abort`
 *   cancel issued but the result shape is dead ⇒ `dispatcher-call-outcome-unreadable`
 *
 * @module test/a5p7-cproc-fixture
 */
import type { DispatchEvent } from '../jobs-gateway/index.js'

export type CprocStage = 'probe' | 'prepare' | 'execute' | 'terminate'

export type CprocScenario =
  | 'cancel-before-exec'
  | 'terminate-after-body-start'
  | 'abort-lost-race'
  | 'cancel-outcome-unreadable'

export interface CprocRun {
  readonly stages: readonly CprocStage[]
  readonly bodyInvoked: boolean
  readonly sideEffectCount: number
  readonly events: readonly DispatchEvent[]
  readonly hostCode: 'ABORTED_BEFORE_DISPATCH' | 'ABORTED' | 'OK' | 'GARBAGE'
}

export function runCprocFixture(
  callId: string,
  name: string,
  scenario: CprocScenario,
  options: { readonly abortIssuedBy?: string } = {},
): CprocRun {
  const abortIssuedBy = options.abortIssuedBy ?? 'lane-definition-move'
  const stages: CprocStage[] = []
  let sideEffectCount = 0
  const base = { callId, tool: name }

  // probe + prepare always run: they are the door-side stages, no side effects.
  stages.push('probe', 'prepare')

  switch (scenario) {
    case 'cancel-before-exec': {
      // The signal was raised before the innermost step resolved the Body:
      // the Host refuses ahead of `resolveExecution` — the Body never exists.
      stages.push('terminate')
      return {
        stages,
        bodyInvoked: false,
        sideEffectCount,
        hostCode: 'ABORTED_BEFORE_DISPATCH',
        events: [
          { ...base, event: 'dispatcher-call-cancelled-before-body', sideEffectPossible: false, abortIssuedBy },
        ],
      }
    }
    case 'terminate-after-body-start': {
      // The Body was resolved and invoked; the signal supersedes its success
      // AFTERWARD. The Body's own value is preserved, side effects are real.
      stages.push('execute', 'terminate')
      sideEffectCount += 1
      return {
        stages,
        bodyInvoked: true,
        sideEffectCount,
        hostCode: 'ABORTED',
        events: [
          {
            ...base,
            event: 'dispatcher-call-terminated-after-body-start',
            sideEffectPossible: true,
            abortIssuedBy,
            // the Body's preserved own value (the Host keeps it in its own
            // additional contexts; the plane forwards it; the lane never drops it)
            preservedValue: 'partial-body-result-42',
          },
        ],
      }
    }
    case 'abort-lost-race': {
      // The cancel arrived too late for the Host to see it at any check:
      // the Body ran to an ordinary outcome and the lane says so out loud.
      stages.push('execute', 'terminate')
      sideEffectCount += 1
      return {
        stages,
        bodyInvoked: true,
        sideEffectCount,
        hostCode: 'OK',
        events: [
          { ...base, event: 'dispatcher-call-completed-after-abort', sideEffectPossible: true, abortIssuedBy },
        ],
      }
    }
    case 'cancel-outcome-unreadable': {
      // A cancel was issued and what came back carries no readable outcome
      // code. Neither "it ran" nor "it never ran" may be claimed.
      stages.push('execute')
      return {
        stages,
        bodyInvoked: true, // the fixture knows; the LANE may not — and must not say
        sideEffectCount,
        hostCode: 'GARBAGE',
        events: [
          { ...base, event: 'dispatcher-call-outcome-unreadable', severity: 'alarm', abortIssuedBy, observedCode: 'TypeError' },
        ],
      }
    }
  }
}
