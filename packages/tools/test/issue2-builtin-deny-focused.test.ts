/**
 * issue2-builtin-deny-focused.test.ts — I2-P2 (plan §11) FOCUSED contract
 * tests for the built-in tool deny adapter (`applyBuiltInToolDeny` from
 * @dsh-agent-team/tools/builtin-deny), the capability-side half of the
 * alpha.2 Issue #2 permission repair.
 *
 * The adapter is a thin seam adapter: one `agentCtx.tools.restrict({ deny })`
 * call with a deduped deny list, capturing the EXACT upstream disposer the
 * seam returns. The contracts pinned here (plan §11):
 *
 *   1. empty deny → NO-OP: zero calls to `restrict()`, a safe disposer.
 *   2. duplicates → deduplicated BEFORE the call, first-seen order kept,
 *      EXACTLY ONE `restrict()` call (one mask per agent, never stacked).
 *   3. exact disposer: `dispose()` invokes the lift function the seam
 *      returned for THIS restriction (captured by identity, not by
 *      reconstruction) — the restriction is explicitly unwound at agent
 *      close (the B2-adjacent class of defect: a no-op disposer leaves
 *      the mask standing).
 *   4. idempotent: a double `dispose()` invokes the lift exactly once.
 *   5. RESTRICTION CANNOT BE APPLIED → SETUP FAILS CLOSED (plan §11,
 *      NEW): when the seam rejects the deny list (the B2 production
 *      error: `tools.restrict() names unknown global tool "pwsh"` — a
 *      deny name the agent's surface does not contain), the adapter
 *      PROPAGATES the typed throw — the glue's setup rejects, the agent
 *      creation rolls back (pinned at the real seam by
 *      issue2-real-preset-restriction.test.ts S2). The FORBIDDEN shape
 *      (plan §11): silent continuation — the adapter must never swallow
 *      the seam failure and hand back a disposer as if the mask were in
 *      place.
 *
 * A FAKE agentCtx is the correct seam level for THIS file (the adapter's
 * contract is about the seam call, not the composition); the real
 * COMPOSITION is pinned by the real-seam test (I2-P1) and the live-world
 * evidence.
 *
 * RUNNER CONSTRAINTS (this repo's plain-node shim): every `it` body is
 * pure synchronous (the adapter is synchronous). Shim matchers used:
 * toBe / toEqual / toThrow (function form) (+.not) only.
 *
 * SELF-CLEANLINESS: this file is inside the P4-T6 whole-tree scanner's
 * scope (`packages/**`), so no legacy Team SessionEvent denylist token
 * may appear in this source — none does.
 *
 * @module @dsh-agent-team/tools/test/issue2-builtin-deny-focused
 */
import { describe, expect, it } from 'vitest'

import { applyBuiltInToolDeny } from '../src/builtin-deny.js'

// ---------------------------------------------------------------------------
// The counting fake agentCtx (records every restrict() call + returns a
// lift function whose identity the test can track).
// ---------------------------------------------------------------------------

interface FakeCtx {
  readonly ctx: { tools: { restrict: (opts: { deny: string[] }) => () => void } }
  /** The deny lists passed to restrict(), in call order (copies). */
  readonly denyCalls: string[][]
  /** The lift functions the fake returned, in call order (identity). */
  readonly returnedLifts: (() => void)[]
  /** The lifts actually invoked, in call order (identity). */
  readonly invokedLifts: (() => void)[]
  /** When set, restrict() throws this error instead of masking. */
  restrictError: Error | null
}

function makeFakeCtx(): FakeCtx {
  const denyCalls: string[][] = []
  const returnedLifts: (() => void)[] = []
  const invokedLifts: (() => void)[] = []
  const fake: FakeCtx = {
    ctx: {
      tools: {
        restrict: (opts: { deny: string[] }): (() => void) => {
          if (fake.restrictError !== null) throw fake.restrictError
          denyCalls.push([...opts.deny])
          const lift = (): void => {
            invokedLifts.push(lift)
          }
          returnedLifts.push(lift)
          return lift
        },
      },
    },
    denyCalls,
    returnedLifts,
    invokedLifts,
    restrictError: null,
  }
  return fake
}

// ---------------------------------------------------------------------------
// Contracts.
// ---------------------------------------------------------------------------

describe('I2-P2 builtin-deny adapter contract (plan §11)', () => {
  it('1: an EMPTY deny list is a no-op — zero calls to restrict(), and the returned disposer is safe to call', () => {
    const fake = makeFakeCtx()
    const disposer = applyBuiltInToolDeny(fake.ctx, [])
    expect(fake.denyCalls.length).toBe(0)
    // The no-op disposer must not throw, even twice:
    disposer.dispose()
    disposer.dispose()
    expect(fake.invokedLifts.length).toBe(0)
  })

  it('2: duplicates are deduplicated BEFORE the call, first-seen order kept, with EXACTLY ONE restrict() call (one mask, never stacked)', () => {
    const fake = makeFakeCtx()
    applyBuiltInToolDeny(fake.ctx, ['pwsh', 'read', 'pwsh', 'write', 'read', 'bash'])
    expect(fake.denyCalls.length).toBe(1)
    expect(fake.denyCalls[0]).toEqual(['pwsh', 'read', 'write', 'bash'])
  })

  it('3: dispose() invokes the EXACT lift the seam returned for this restriction (captured by identity)', () => {
    const fake = makeFakeCtx()
    const disposer = applyBuiltInToolDeny(fake.ctx, ['pwsh'])
    expect(fake.returnedLifts.length).toBe(1)
    expect(fake.invokedLifts.length).toBe(0)
    disposer.dispose()
    expect(fake.invokedLifts.length).toBe(1)
    // Identity: the invoked lift IS the function the seam returned —
    // not a reconstruction, not a stale one from another restriction:
    expect(fake.invokedLifts[0] === fake.returnedLifts[0]).toBe(true)
  })

  it('4: dispose() is idempotent — a double dispose invokes the lift exactly once', () => {
    const fake = makeFakeCtx()
    const disposer = applyBuiltInToolDeny(fake.ctx, ['pwsh', 'read'])
    disposer.dispose()
    disposer.dispose()
    disposer.dispose()
    expect(fake.invokedLifts.length).toBe(1)
  })

  it('5: an unrestrictable deny list FAILS CLOSED — the seam rejection propagates as a typed throw (the B2 production error shape)', () => {
    const fake = makeFakeCtx()
    fake.restrictError = new Error('tools.restrict() names unknown global tool "no-such-tool"')
    expect(() => applyBuiltInToolDeny(fake.ctx, ['no-such-tool'])).toThrow()
    // The restriction was NOT partially applied: nothing was recorded,
    // no lift was returned or invoked, and there is nothing to dispose
    // (the setup rejects before a disposer exists — the glue fails the
    // agent creation and the creation rolls back; pinned at the real
    // seam by S2).
    expect(fake.denyCalls.length).toBe(0)
    expect(fake.returnedLifts.length).toBe(0)
    expect(fake.invokedLifts.length).toBe(0)
  })

  it('6: the throw carries the seam\'s message intact (diagnostics survive the adapter — no re-wrapping, no swallowing)', () => {
    const fake = makeFakeCtx()
    const seamMessage = 'tools.restrict() names unknown global tool "pwsh"'
    fake.restrictError = new Error(seamMessage)
    let captured: unknown
    try {
      applyBuiltInToolDeny(fake.ctx, ['pwsh'])
    } catch (error) {
      captured = error
    }
    expect(captured instanceof Error).toBe(true)
    expect((captured as Error).message).toBe(seamMessage)
  })

  it('7: no silent continuation — after a seam rejection the adapter returns NOTHING (a caller holding a disposer would be lying)', () => {
    const fake = makeFakeCtx()
    fake.restrictError = new Error('seam unavailable')
    let returned: unknown = 'sentinel'
    try {
      returned = applyBuiltInToolDeny(fake.ctx, ['pwsh'])
    } catch {
      returned = undefined
    }
    expect(returned).toBe(undefined)
  })

  it('8: an empty-after-dedupe list is impossible (dedupe never removes ALL entries) — a non-empty input always masks exactly once', () => {
    const fake = makeFakeCtx()
    const disposer = applyBuiltInToolDeny(fake.ctx, ['read', 'read', 'read'])
    expect(fake.denyCalls.length).toBe(1)
    expect(fake.denyCalls[0]).toEqual(['read'])
    disposer.dispose()
    expect(fake.invokedLifts.length).toBe(1)
  })
})
