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
 *    left (every started await settles within a bounded window);
 *  - A9 real-host shape — the guard spans the operation AWAITED lifetime
 *    (agent/created announced after several awaited hops, not in the
 *    sync prefix; the Commit-4 World-A boot-gate defect regression).
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

  it('A3 Team-owned resume: the EXACT claimed generation passes under the guard and the guard returns to 0 in finally', async () => {
    const fence = createTeamSessionActivationFence()
    makeFence(fence)
    const own = agent(ROOT)
    // the Team's own activation (supplement INV-3): the glue's setup
    // wrapper claims the EXACT Agent object while the runOwned guard is
    // held — the announced object IS the claimed one → PASS, NO rollback
    // record is created for it.
    await fence.runOwned(ROOT, async () => {
      fence.claimOwnedGeneration(ROOT, own)
      await fence.beforeAgentCreated({ agent: own, source: 'resume' })
    })
    // the guard returned to 0 (the finally decrement): the NEXT foreign
    // activation of the same session is intercepted again.
    await expectIntercepted(fence, { agent: agent(ROOT), source: 'resume' })
  })

  it('A4 nested ownership: the inner completion never clears the outer guard (a claim minted under the surviving outer is still accepted)', async () => {
    const fence = createTeamSessionActivationFence()
    makeFence(fence)
    await fence.runOwned(ROOT, async () => {
      // the inner activation completes here (its finally decrements 2→1 —
      // NOT to 0).
      await fence.runOwned(ROOT, async () => {
        const inner = agent(ROOT)
        fence.claimOwnedGeneration(ROOT, inner)
        await fence.beforeAgentCreated({ agent: inner, source: 'startup' })
      })
      // BETWEEN the inner settle and the outer settle the OUTER guard
      // still holds (guide §13.1 A4: the inner end must not clear it
      // early) — a further claimed activation of the same session still
      // PASSES: the claim is only ACCEPTED while a guard is held (the
      // claim-acceptance gate reads the ref-count — depth 1 from the
      // outer alone). NOTE (attribution): under the Commit-4 defect
      // (the sync `return operation()` released the outer guard after its
      // sync prefix) this claim would be IGNORED (no guard) and the
      // activation vetoed — A4 now pins the guard-lifetime semantics
      // through the causal claim.
      const outer = agent(ROOT)
      fence.claimOwnedGeneration(ROOT, outer)
      await fence.beforeAgentCreated({ agent: outer, source: 'resume' })
    })
    // and only after the OUTER settle is the guard gone: a fresh claim
    // is now IGNORED (no guard to accept it) and the activation — even
    // for the Team's own session — is a plain foreign activation:
    // intercepted (the guard was never held outside the owned window).
    const after = agent(ROOT)
    fence.claimOwnedGeneration(ROOT, after) // no guard held → ignored
    await expectIntercepted(fence, { agent: after, source: 'resume' })
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

  it('A9 real-host shape: the guard spans the operation AWAITED lifetime — a claim minted after awaited hops is accepted (Commit-4 defect regression, causal-claim form)', async () => {
    const fence = createTeamSessionActivationFence()
    makeFence(fence)
    // The 0.1.7 create chain ANNOUNCES agent/created several AWAITED hops
    // after the create promise is returned (in-host verified, World A
    // boot: createAgent → setupAndPublish → initializeAgent →
    // runMaintenance → publish → announce → ctx.serial — every hop
    // awaited). The operation models EXACTLY that shape: several awaited
    // hops, THEN the glue setup (which claims the EXACT Agent object),
    // THEN the AWAITED-serial agent/created decision point. A synchronous
    // `return operation()` in runOwned releases the guard after the
    // operation's sync prefix only → the claim minted after the awaited
    // hops is NOT accepted (the claim-acceptance gate reads ownedDepth =
    // 0) → the Team's OWN activation is vetoed → bootstrap FATAL on
    // every fresh home (the Commit-4 kit defect, now expressed through
    // the causal claim — unit tests A3/A4 missed it because their
    // operations put the fence decision in the sync prefix).
    const owned = agent(ROOT)
    const ownedOutcome = await fence.runOwned(ROOT, async () => {
      // the awaited hops of the real create chain (each an await
      // boundary — model selection install, maintenance, publish).
      await Promise.resolve()
      await Promise.resolve()
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
      // setup runs here (the awaited hops above = the create chain's
      // pre-announce phase): the EXACT claim, minted INSIDE the guarded
      // awaited lifetime.
      fence.claimOwnedGeneration(ROOT, owned)
      // the AWAITED-serial agent/created decision point (the seam): the
      // Team's OWN startup activation must PASS (the claimed object IS
      // the announced one; the guard is still held across the full
      // awaited lifetime, which is what made the claim accept).
      await fence.beforeAgentCreated({ agent: owned, source: 'startup' })
      return 'live-handle'
    })
    expect(ownedOutcome).toBe('live-handle')
    // CONTROL (the claim-acceptance gate): a claim minted OUTSIDE any
    // guard is IGNORED — the activation is a plain foreign one → veto.
    // (The too-early release of the fixed defect has the same observable
    // signature: guard gone → claim ignored → veto. Both directions
    // pinned.)
    const foreign = agent(ROOT)
    fence.claimOwnedGeneration(ROOT, foreign) // no guard held → ignored
    await expectIntercepted(fence, { agent: foreign, source: 'resume' })
    fence.close()
  })

  it('A10 ownership resolver pending + Team session: agent/created AWAITs the bind (classification pending — never "unmanaged"), then vetoes', async () => {
    const fence = createTeamSessionActivationFence()
    // NO resolver bound yet: classification PENDING (supplement INV-4) —
    // the ordinary SessionController cannot steal the Team writer in the
    // startup window.
    const p = fence.beforeAgentCreated({ agent: agent(ROOT), source: 'resume' })
    // the activation is PENDING — neither PASS nor veto before the bind
    // (a PASS would have been the ownership-steal; a veto before
    // classification would have broken the unmanaged world).
    const pending = await settles(p, 50)
    expect(pending.settled).toBe(false)
    // the domain opens / the resolver binds: the root is Team-managed →
    // the pending activation is VETOED (exact wording).
    fence.bindOwnershipResolver((sid) => (sid === ROOT ? ROOT : undefined))
    const error = await p.then(
      () => null,
      (e: unknown) => e,
    )
    expect(error).toBeInstanceOf(TeamSessionActivationInterceptedError)
  })

  it('A11 ownership resolver pending + ordinary session: agent/created AWAITs the bind, then passes unmanaged (upstream-equivalent)', async () => {
    const fence = createTeamSessionActivationFence()
    const p = fence.beforeAgentCreated({ agent: agent('session-ordinary'), source: 'resume' })
    const pending = await settles(p, 50)
    expect(pending.settled).toBe(false)
    // the bind lands: the session classifies UNMANAGED → PASS (the
    // ordinary session continues — the wait was bounded to the startup
    // window, and the fence kept no state for it).
    fence.bindOwnershipResolver(() => undefined)
    await p
    // no rollback record was kept for the unmanaged pass.
    await fence.awaitRollback('session-ordinary')
  })

  it('A12 exact Team generation claim: the claimed object passes, a DIFFERENT object for the same sid is vetoed inside the SAME activation window (the temporal authority is gone)', async () => {
    const fence = createTeamSessionActivationFence()
    makeFence(fence)
    const teamGen = agent(ROOT)
    // a DIFFERENT Agent object, same session id (the ordinary
    // SessionController's own generation).
    const foreignGen = agent(ROOT)
    await fence.runOwned(ROOT, async () => {
      // the Team's own activation: claim + announce → PASS (the claim is
      // consumed at the PASS).
      fence.claimOwnedGeneration(ROOT, teamGen)
      await fence.beforeAgentCreated({ agent: teamGen, source: 'resume' })
      // the foreign activation arrives INSIDE the Team activation's
      // window (the guard is still held — the pre-supplement temporal
      // model would have PASSED it via ownedDepth > 0): the EXACT object
      // does not match the consumed claim → VETO (supplement INV-3 — the
      // key discriminator of this round).
      await expectIntercepted(fence, { agent: foreignGen, source: 'resume' })
    })
    // the vetoed generation's barrier is settled by close (no dangling
    // wait).
    fence.close()
  })

  it('A13 completed rollback is observable after the record is deleted (the epoch tombstone) — recovery returns IMMEDIATELY, no timeout', async () => {
    const fence = createTeamSessionActivationFence()
    makeFence(fence)
    const foreign = agent(ROOT)
    await expectIntercepted(fence, { agent: foreign, source: 'resume' })
    // the exact generation is disposed: `current` is CLEARED (the record
    // is gone — the pre-supplement model deleted the same way) but the
    // TOMBSTONE survives (completedEpoch = 1, the Agent object is NOT
    // retained).
    fence.onAgentDisposed(foreign)
    expect(fence.getRollbackEpoch(ROOT)).toBe(1)
    // the TOCTOU: a Team resume whose writer-held catch runs AFTER the
    // completion — the pre-supplement glue read "no pending record →
    // unrecoverable" and propagated the error; the tombstone answers the
    // recovery from the pre-attempt baseline (0) IMMEDIATELY.
    const t0 = Date.now()
    const recoverable = await fence.recoverWriterConflict(ROOT, {
      afterEpoch: 0,
      deadlineMs: Date.now() + 60_000,
    })
    expect(recoverable).toBe(true)
    expect(Date.now() - t0).toBeLessThan(200) // immediate — no bounded-window wait
  })

  it('A14 a stale completed epoch cannot unlock a NEW conflict (afterEpoch is the attempt baseline)', async () => {
    const fence = createTeamSessionActivationFence()
    makeFence(fence)
    // a rollback from BEFORE this attempt completes (epoch 1).
    const oldForeign = agent(ROOT)
    await expectIntercepted(fence, { agent: oldForeign, source: 'resume' })
    fence.onAgentDisposed(oldForeign)
    // the attempt's baseline = 1. No NEW rollback appears after it.
    const baseline = fence.getRollbackEpoch(ROOT)
    expect(baseline).toBe(1)
    const recoverable = await fence.recoverWriterConflict(ROOT, {
      afterEpoch: baseline,
      deadlineMs: Date.now() + 150,
    })
    expect(recoverable).toBe(false) // the stale completion never unlocks
  })

  it('A15 one absolute deadline: record-then-dispose never stretches to two full windows (≈ timeout, not 2× timeout)', async () => {
    const fence = createTeamSessionActivationFence({ writerConflictTimeoutMs: 250 })
    makeFence(fence)
    const t0 = Date.now()
    const deadline = t0 + 250
    // the recovery starts with NO record; the foreign activation (the
    // record appearance) lands well BEFORE the deadline; the exact
    // disposal NEVER comes — stage (b) must consume only the REMAINING
    // budget of the SAME absolute deadline (supplement INV-6).
    const p = fence.recoverWriterConflict(ROOT, { afterEpoch: 0, deadlineMs: deadline })
    await new Promise<void>((resolve) => setTimeout(resolve, 120))
    // the veto is synchronous once the resolver is bound (no awaits in
    // the decision path) — the record exists the moment this settles.
    fence.beforeAgentCreated({ agent: agent(ROOT), source: 'resume' }).catch(() => undefined)
    const result = await p
    const elapsed = Date.now() - t0
    expect(result).toBe(false) // the exact disposal never came
    // ≈ 250 ms total (the absolute deadline), NOT ≈ 370–500 ms (a fresh
    // window per stage: 120 + 250).
    expect(elapsed).toBeGreaterThanOrEqual(230)
    expect(elapsed).toBeLessThan(350)
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
