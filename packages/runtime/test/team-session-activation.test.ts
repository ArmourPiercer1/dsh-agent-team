/**
 * team-session-activation.test.ts — C1 (restart-recovery 0.1.7-rc.1,
 * guide §13.1): the Team session-activation fence PURE unit tests
 * (A1–A8). The fence is the process-local ownership guard of the
 * restart-recovery repair: the awaited-serial `agent/created` veto
 * (guide §8.1), the exact-generation `agent/disposed` rollback barrier
 * (guide §8.2), the ref-counted Team activation guard (guide §3.1), and
 * the one-shot ordinary activation permit (guide §3.1/§10.1).
 *
 * Cases (guide §13.1, verbatim):
 *  - A1 ordinary unmanaged — an ownership-unmanaged session's
 *    agent/created PASSES (the fence only guards Team-managed sessions);
 *  - A2 Team foreign resume — a managed root, ownedDepth 0, no permit →
 *    agent/created REJECTS (the typed TeamSessionActivationInterceptedError,
 *    never a SessionAlreadyOwnedError) and the rollback record exists
 *    (awaitRollback stays pending until the exact agent is disposed);
 *  - A3 Team-owned resume — under runOwned the same activation PASSES,
 *    and the guard returns to 0 in `finally` (a later foreign activation
 *    is intercepted again);
 *  - A4 nested ownership — runOwned(sid, runOwned(sid, ...)): the INNER
 *    completion must NOT clear the OUTER guard (a foreign activation is
 *    still intercepted between the inner settle and the outer settle);
 *  - A5 exact-generation disposal — a STALE/other-generation disposer
 *    (a different Agent object, same session id) must NOT resolve the
 *    barrier; the EXACT vetoed Agent resolves it (guide §8.2 strict
 *    generation);
 *  - A6 one-shot ordinary permit — the permit lets the FIRST foreign
 *    activation pass (consumed at agent/created, never at the permit
 *    call) and the SECOND foreign activation is rejected;
 *  - A7 permit expiry — an EXPIRED permit no longer bypasses (the
 *    one-shot TTL, guide §3.1 — injected clock, 100 ms window);
 *  - A8 close — after close(): a new runOwned REJECTS, every in-flight
 *    waiter settles (the pending rollback barrier resolves, the bounded
 *    writer-conflict wait resolves false), and no dangling promise is
 *    left (every started await settles within a bounded window).
 *
 * @module @dsh-agent-team/runtime/test/team-session-activation
 */

import { describe, expect, it } from 'vitest'

import {
  createTeamSessionActivationFence,
  TeamSessionActivationClosedError,
  TeamSessionActivationInterceptedError,
} from '../src/plugin/team-session-activation.js'
import type {
  TeamActivationAgent,
  TeamSessionActivationFence,
} from '../src/plugin/team-session-activation.js'

const ROOT = 'session-team-root-a'

/** A fresh fence whose ownership resolver manages exactly ROOT. */
function makeFence(fence: TeamSessionActivationFence, managed: readonly string[] = [ROOT]): void {
  fence.bindOwnershipResolver((sessionId) =>
    managed.includes(sessionId) ? sessionId : undefined,
  )
}

/** Mint a distinct Agent identity (the exact-generation key). */
function agent(id: string): TeamActivationAgent {
  return { id }
}

/** Await one promise, reporting whether it settled within the window. */
async function settles<T>(
  p: Promise<T>,
  windowMs = 60,
): Promise<{ settled: boolean; value?: T; error?: unknown }> {
  return await new Promise<{ settled: boolean; value?: T; error?: unknown }>((resolve) => {
    let done = false
    const timer = setTimeout(() => {
      if (!done) {
        done = true
        resolve({ settled: false })
      }
    }, windowMs)
    void p.then(
      (value) => {
        if (!done) {
          done = true
          clearTimeout(timer)
          resolve({ settled: true, value })
        }
      },
      (error: unknown) => {
        if (!done) {
          done = true
          clearTimeout(timer)
          resolve({ settled: true, error })
        }
      },
    )
  })
}

/** Expect the veto rejection (asserts the stable typed error shape). */
async function expectIntercepted(
  fence: TeamSessionActivationFence,
  input: { agent: TeamActivationAgent; source: 'startup' | 'resume' | 'clear' | 'compact' },
): Promise<TeamSessionActivationInterceptedError> {
  const error = await fence.beforeAgentCreated(input).then(
    () => {
      throw new Error('A-test guard: expected the foreign activation to be intercepted')
    },
    (e: unknown) => e,
  )
  if (!(error instanceof TeamSessionActivationInterceptedError)) {
    throw new Error(
      `A-test guard: expected TeamSessionActivationInterceptedError, got ${
        error instanceof Error ? `${error.name}: ${error.message}` : String(error)
      }`,
    )
  }
  return error
}

describe('C1 (guide §13.1): the Team session-activation fence', () => {
  it('A1 ordinary unmanaged: an ownership-unmanaged session passes agent/created', async () => {
    const fence = createTeamSessionActivationFence()
    makeFence(fence) // ROOT is managed; 'session-ordinary' is not
    // the unmanaged session's activation (any source) is the upstream's
    // own business — the fence passes it.
    await fence.beforeAgentCreated({ agent: agent('session-ordinary'), source: 'resume' })
    // and the fence kept no rollback record for it (a later awaitRollback
    // returns immediately — nothing to wait for).
    await fence.awaitRollback('session-ordinary')
  })

  it('A2 Team foreign resume: a managed root at ownedDepth 0 with no permit is intercepted; the rollback record exists', async () => {
    const fence = createTeamSessionActivationFence()
    makeFence(fence)
    const foreign = agent(ROOT)
    const error = await expectIntercepted(fence, { agent: foreign, source: 'resume' })
    // the stable, greppable message (guide §8.1 — never a masqueraded
    // SessionAlreadyOwnedError).
    expect(error.name).toBe('TeamSessionActivationInterceptedError')
    expect(error.message).toBe(
      `dsh-agent-team: intercepted foreign Agent activation for Team-managed session "${ROOT}"`,
    )
    // the rollback record EXISTS: the barrier is pending until the exact
    // foreign agent is disposed.
    const pending = await settles(fence.awaitRollback(ROOT))
    expect(pending.settled).toBe(false)
    // and the exact disposal settles it.
    fence.onAgentDisposed(foreign)
    const after = await settles(fence.awaitRollback(ROOT))
    expect(after.settled).toBe(true)
  })

  it('A3 Team-owned resume: under runOwned the activation passes and the guard returns to 0 in finally', async () => {
    const fence = createTeamSessionActivationFence()
    makeFence(fence)
    const own = agent(ROOT)
    // the Team's own activation (the runOwned guard held) passes —
    // NO rollback record is created for it.
    await fence.runOwned(ROOT, async () => {
      await fence.beforeAgentCreated({ agent: own, source: 'resume' })
    })
    // the guard returned to 0 (the finally decrement): the NEXT foreign
    // activation of the same session is intercepted again.
    await expectIntercepted(fence, { agent: agent(ROOT), source: 'resume' })
  })

  it('A4 nested ownership: the inner completion never clears the outer guard', async () => {
    const fence = createTeamSessionActivationFence()
    makeFence(fence)
    await fence.runOwned(ROOT, async () => {
      // the inner activation completes here (its finally decrements 2→1 —
      // NOT to 0).
      await fence.runOwned(ROOT, async () => {
        await fence.beforeAgentCreated({ agent: agent(ROOT), source: 'startup' })
      })
      // BETWEEN the inner settle and the outer settle a foreign
      // activation must STILL be intercepted (the outer guard holds).
      await expectIntercepted(fence, { agent: agent(ROOT), source: 'resume' })
    })
    // and only after the OUTER settle is the guard gone: the foreign
    // activation is intercepted again (the same condition — the guard was
    // always absent outside the owned window).
    await expectIntercepted(fence, { agent: agent(ROOT), source: 'resume' })
  })

  it('A5 exact-generation disposal: a stale/other-generation disposer does not resolve the barrier; the exact agent does', async () => {
    const fence = createTeamSessionActivationFence()
    makeFence(fence)
    const generationA = agent(ROOT)
    await expectIntercepted(fence, { agent: generationA, source: 'resume' })
    // a DIFFERENT Agent object (the same session id — a stale or later
    // generation) is disposed: the strict-generation barrier must NOT
    // resolve (guide §8.2).
    fence.onAgentDisposed(agent(ROOT))
    const stale = await settles(fence.awaitRollback(ROOT))
    expect(stale.settled).toBe(false)
    // the EXACT vetoed generation is disposed: the barrier resolves.
    fence.onAgentDisposed(generationA)
    const exact = await settles(fence.awaitRollback(ROOT))
    expect(exact.settled).toBe(true)
  })

  it('A6 one-shot ordinary permit: the first foreign activation passes, the second is rejected', async () => {
    const fence = createTeamSessionActivationFence()
    makeFence(fence)
    fence.permitOrdinaryOnce(ROOT)
    // the FIRST foreign activation consumes the permit (at agent/created
    // — the permit call itself armed nothing consumable yet) and passes.
    const first = agent(ROOT)
    await fence.beforeAgentCreated({ agent: first, source: 'resume' })
    // the permit was consumed: NO rollback record exists (a pass left
    // nothing to wait for).
    await fence.awaitRollback(ROOT)
    // the SECOND foreign activation finds no permit — intercepted.
    await expectIntercepted(fence, { agent: agent(ROOT), source: 'resume' })
  })

  it('A7 permit expiry: an expired permit no longer bypasses (one-shot + TTL)', async () => {
    let clock = 0
    const fence = createTeamSessionActivationFence({
      now: () => clock,
      ordinaryPermitTtlMs: 100,
    })
    makeFence(fence)
    clock = 0
    fence.permitOrdinaryOnce(ROOT)
    clock = 150 // the TTL (100 ms) has passed
    // the expired permit is DROPPED and the activation falls through to
    // the foreign branch — intercepted, not bypassed.
    await expectIntercepted(fence, { agent: agent(ROOT), source: 'resume' })
    // a FRESH permit (the re-arm replaces the expired one) passes again
    // within its own TTL.
    clock = 200
    fence.permitOrdinaryOnce(ROOT)
    clock = 250
    await fence.beforeAgentCreated({ agent: agent(ROOT), source: 'resume' })
  })

  it('A8 close: a new runOwned rejects, every waiter settles, no dangling promise', async () => {
    const fence = createTeamSessionActivationFence({ writerConflictTimeoutMs: 30_000 })
    makeFence(fence)
    const foreign = agent(ROOT)
    // a PENDING rollback barrier (the vetoed foreign activation is not
    // disposed yet).
    await expectIntercepted(fence, { agent: foreign, source: 'resume' })
    const rollbackWait = fence.awaitRollback(ROOT)
    // a BOUNDED writer-conflict wait with NO record that will ever
    // appear (the 30 s window would outlive the test — close must cut it
    // short, resolving false).
    const conflictWait = fence.recoverWriterConflict(ROOT)

    fence.close()

    // (1) a NEW runOwned after close REJECTS (async rejection — the
    // caller's await sees it in its own catch).
    const ownedAfterClose = await fence.runOwned(ROOT, async () => 'never').then(
      () => {
        throw new Error('A-test guard: runOwned after close must reject')
      },
      (e: unknown) => e,
    )
    expect(ownedAfterClose).toBeInstanceOf(TeamSessionActivationClosedError)

    // (2) the in-flight rollback barrier SETTLES (the close resolves the
    // dangling exact-generation disposal — no wait outlives the row).
    const rollbackSettle = await settles(rollbackWait)
    expect(rollbackSettle.settled).toBe(true)

    // (3) the in-flight writer-conflict wait SETTLES FALSE (the close
    // wins the bounded race — no 30 s hang).
    const conflictSettle = await settles(conflictWait)
    expect(conflictSettle.settled).toBe(true)
    if (conflictSettle.settled) {
      expect(conflictSettle.value).toBe(false)
    }

    // (4) no dangling promise: a FRESH bounded wait after close settles
    // immediately (false — the row is stopping), and the disposed event
    // of the (already settled) generation is a no-op, not a fault.
    const freshConflict = await fence.recoverWriterConflict(ROOT)
    expect(freshConflict).toBe(false)
    fence.onAgentDisposed(foreign) // no-op after the barrier settled
    // the fence keeps no state past the row: a late agent/created is a
    // no-op pass-through (the row teardown is the upstream's own).
    await fence.beforeAgentCreated({ agent: agent(ROOT), source: 'resume' })
    // and a late permit is dead (no throw, no state).
    fence.permitOrdinaryOnce(ROOT)
    // idempotent close (the row-stop backstop may call it more than once
    // across the dispose paths).
    fence.close()
  })

  it('A2/A5 complement: the intercepted error never masquerades as SessionAlreadyOwnedError (guide §8.1)', async () => {
    const fence = createTeamSessionActivationFence()
    makeFence(fence)
    const error = await expectIntercepted(fence, { agent: agent(ROOT), source: 'resume' })
    expect(error.name).not.toBe('SessionAlreadyOwnedError')
    // the two failures are different failures (a writer conflict vs. a
    // fenced activation) — the message must not carry the writer-held
    // compatibility string either.
    expect(error.message.includes('already owned by an active write handle')).toBe(false)
  })
})
