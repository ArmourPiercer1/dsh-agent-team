/**
 * t12a-b2-child-identity.test.ts — T12-B2: root-aware deterministic child
 * Session identity.
 *
 * The factory idempotency contract keys on the (rootSessionId, instanceId)
 * PAIR. The old derivation (`session-child-p6t6-<instance suffix>`) was
 * blind to the root: the same instance id under two different team roots
 * derived the SAME child session id (cross-root collision). T12-B2 changes
 * the identity input to the pair: canonical tuple
 * `${root}\u0000${instance}` -> SHA-256 -> fixed-length stable suffix
 * (`session-team-child-<32 hex>`) — no random UUID, restart-stable.
 *
 * Acceptance (asserted at the REAL glue boundary through the
 * t12a-live-bridge doubles — the real agent-bindings.mjs with the real DSH
 * installModelSelection seam and the real durable-consumption resolvers):
 *   B2-1 the same (root, instance) pair derives the same child id;
 *   B2-2 the same instance under a different root derives a DIFFERENT child;
 *   B2-3 a RESTART (a fresh bindings instance over the same root) re-derives
 *        the same child id, and the factory's durable branch RESUMES that
 *        same child (agents.resume — never a second create);
 *   B2-4 the factory boundary: request.rootSessionId drives the derivation,
 *        the row's own root is the fallback, and a re-drive is idempotent
 *        (one create, same id).
 *
 * The async world setup is TOP LEVEL (the plain-node shim runs `it()`
 * bodies synchronously at registration — the p5t3-restart / p6t1-delegate
 * precedent). The bridge self-provisions the @deepseek-ai/* junction links
 * (gitignored local environment); see t12a-live-bridge.mjs.
 */
import { describe, expect, it } from 'vitest'
import {
  WORKTREE_ROOT,
  createLiveWorld,
  removeFixtureHome,
  withDshHome,
  writeDurableFixture,
} from './t12a-live-bridge.mjs'

const ROOT_A = 'session-t12a-b2-root-a'
const ROOT_B = 'session-t12a-b2-root-b'
const INSTANCE = 'inst-t12ab2member'
const PREFIX = 'session-team-child-'

const requestA = {
  rootSessionId: ROOT_A,
  instanceId: INSTANCE,
  templateId: 'tpl-t12a',
  label: 'member A',
}
const requestB = {
  rootSessionId: ROOT_B,
  instanceId: INSTANCE,
  templateId: 'tpl-t12a',
  label: 'member B',
}

// ── the worlds (two team roots, one bindings instance each) ──────────────
const worldA = await createLiveWorld({ rootSessionId: ROOT_A })
const worldB = await createLiveWorld({ rootSessionId: ROOT_B })

// B2-1 / B2-2: the derivation exposed on the bundle (pure over the pair).
const idA = worldA.binding.childSessionIdFor(ROOT_A, INSTANCE)
const idAAgain = worldA.binding.childSessionIdFor(ROOT_A, INSTANCE)
const idB = worldB.binding.childSessionIdFor(ROOT_B, INSTANCE)

// B2-4: the real factory boundary (fresh child -> the create branch),
// incl. the fallback (a request without rootSessionId uses the row root).
const createdA = await worldA.binding.childFactory.createChildSession(requestA)
const reDrivenA = await worldA.binding.childFactory.createChildSession(requestA)
const createdBExplicit = await worldB.binding.childFactory.createChildSession(requestB)
const createdBFallback = await worldB.binding.childFactory.createChildSession({
  instanceId: INSTANCE,
  templateId: 'tpl-t12a',
  label: 'member B fallback',
})

// B2-3: the restart — a FRESH bindings instance over the SAME root A
// re-derives the same child id; the child is durable on disk (the fixture
// under a fake DSH_HOME), so the factory takes the RESUME branch and
// returns that same id instead of creating a second child.
const restartHome = `${WORKTREE_ROOT}/.tmp-t12a-b2-home`
const worldA2 = await createLiveWorld({ rootSessionId: ROOT_A })
const idA2 = worldA2.binding.childSessionIdFor(ROOT_A, INSTANCE)
const resumedOnRestart = await withDshHome(restartHome, async () => {
  writeDurableFixture(restartHome, idA2)
  return worldA2.binding.childFactory.createChildSession(requestA)
})
removeFixtureHome(restartHome)

// Cleanup: dispose every live handle (the records survive for the its).
await worldA.binding.close()
await worldB.binding.close()
await worldA2.binding.close()

describe('T12-B2 root-aware child session identity', () => {
  it('B2-1 the same (root, instance) pair derives the same child id (fixed-length, no UUID)', () => {
    expect(idA).toBe(idAAgain)
    expect(idA.startsWith(PREFIX)).toBe(true)
    const suffix = idA.slice(PREFIX.length)
    expect(suffix.length).toBe(32)
    expect(/^[0-9a-f]{32}$/.test(suffix)).toBe(true)
  })

  it('B2-2 the same instance under a different root derives a different child id', () => {
    expect(worldA.rootSessionId).not.toBe(worldB.rootSessionId)
    expect(idA).not.toBe(idB)
  })

  it('B2-3 a restart re-derives the same child id and resumes it (never a second create)', () => {
    expect(idA2).toBe(idA)
    expect(resumedOnRestart.childSessionId).toBe(idA)
    expect(worldA2.records.creates.length).toBe(0)
    expect(worldA2.records.resumes.length).toBe(1)
    expect(worldA2.records.resumes[0]!.sessionId).toBe(idA)
  })

  it('B2-4 the factory returns the derived id; the request root drives it; a re-drive is idempotent', () => {
    expect(createdA.childSessionId).toBe(idA)
    expect(createdBExplicit.childSessionId).toBe(idB)
    expect(createdBFallback.childSessionId).toBe(idB)
    expect(reDrivenA.childSessionId).toBe(idA)
    expect(worldA.records.creates.filter((c) => c.sessionId === idA).length).toBe(1)
    expect(worldB.records.creates.filter((c) => c.sessionId === idB).length).toBe(1)
  })
})
