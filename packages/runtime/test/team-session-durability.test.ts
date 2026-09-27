/**
 * team-session-durability.test.ts — C1 (restart-recovery 0.1.7-rc.1,
 * guide §13.2): the DURABILITY SEAM unit tests (D1–D4). The pre-C1
 * glue read `<DSH_HOME>/sessions/<profile>/<sessionId>/` on disk
 * (the `sessionIsDurable` physical layout probe — env-dependent,
 * backend-layout-dependent, blind to the backend's own view). C1
 * deletes that probe from the production glue: the cold-resume
 * eligibility is now the PUBLIC session-persistence seam
 * (`sessionPersistence.exists` — the host wrapper's
 * `stat(id) !== undefined`, guide §5.1/§5.2).
 *
 * Cases (guide §13.2, verbatim):
 *  - D1 `DSH_HOME` completely UNSET + `exists()` returns true →
 *    `ensureLiveAgent` RESUMES — the cold-resume eligibility may no
 *    longer be false because of the environment variable;
 *  - D2 the test provides NO filesystem tree at all (the V4 filename
 *    is completely invisible; an empty home with no `sessions/`
 *    subtree) + `exists = true` → the resume SUCCEEDS (the backend
 *    seam is the single authority, the layout is invisible);
 *  - D3 `exists = false` → the EXISTING `p6t6: ... neither live nor
 *    durable` error is preserved (the S6 mapping onto
 *    NO_DURABLE_ARTIFACT is pinned by the d2-s6 ensureRootLive suite);
 *  - D4 the persistence seam FAULTS (`stat` throws) → the fault
 *    PROPAGATES unchanged — it must never be misread as "not durable"
 *    (a backend fault masquerading as a nonexistent session is the
 *    exact failure class the seam exists to eliminate).
 *
 * World shape: `createLiveWorld` WITHOUT a boot (the root session is
 * not live — the ensureLiveAgent RESUME path is the one under test);
 * the sessionPersistence double's `exists` is overridden per case
 * (the bridge's default — the fixture-home analogue of the upstream
 * stat() truth — is intentionally bypassed: these cases test the seam
 * CONTRACT, not the fixture model).
 *
 * @module @dsh-agent-team/runtime/test/team-session-durability
 */

import { describe, expect, it } from 'vitest'

import {
  createLiveWorld,
  WORKTREE_ROOT,
} from './t12a-live-bridge.mjs'

const HOME = `${WORKTREE_ROOT}/.tmp-team-c1-home`

async function captureReject(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    await fn()
    throw new Error('D-test guard: expected the call to reject')
  } catch (error) {
    if (error instanceof Error && error.message === 'D-test guard: expected the call to reject') {
      throw error
    }
    return error
  }
}

/** Drive one case: a world without a boot + ensureLiveAgent on the root. */
async function driveCase(exists: (sessionId: string) => boolean | Promise<boolean> | never): Promise<{
  resumed: readonly string[]
  created: readonly string[]
  rejection: unknown
}> {
  const world = await createLiveWorld({
    rootSessionId: 'session-team-c1-durability',
    persistence: { exists },
  })
  let rejection: unknown
  try {
    await world.binding.ensureLiveAgent('session-team-c1-durability')
  } catch (error) {
    rejection = error
  }
  await world.binding.close().catch(() => undefined)
  return {
    resumed: world.agents.resumes.map((r) => r.sessionId),
    created: world.agents.creates.map((c) => c.sessionId),
    rejection,
  }
}

const DSH_HOME_KEY = 'DSH_HOME'

// The runtime package's minimal ambient Node shim (src/plugin/
// node-min.d.ts) declares only what the PRODUCTION code reads
// (process.cwd — the pre-C1 sessionIsDurable's process.env.DSH_HOME read
// is deleted, so `env` is not part of the shim). This test drives the
// environment variable directly, so it casts the process global once.
const processEnv = (process as unknown as { env: Record<string, string | undefined> }).env

const D = await (async () => {
  const previousHome = processEnv[DSH_HOME_KEY]
  try {
    // D1 — DSH_HOME completely UNSET: the eligibility comes from the
    // seam, not the environment.
    delete processEnv[DSH_HOME_KEY]
    const d1 = await driveCase(() => true)

    // D2 — NO filesystem tree at all: DSH_HOME points at a home directory
    // with no sessions/ subtree whatsoever (even a V4-era filename would
    // be invisible under it) — and the seam alone decides.
    const { mkdirSync, rmSync } = await import('node:fs')
    mkdirSync(HOME, { recursive: true })
    processEnv[DSH_HOME_KEY] = HOME
    const d2 = await driveCase(() => true)
    rmSync(HOME, { recursive: true, force: true })

    // D3 — nonexistent: the existing "neither live nor durable" error.
    const d3 = await driveCase(() => false)

    // D4 — the persistence seam FAULTS: the fault propagates verbatim.
    const fault = new Error('backend stat fault: the durable backend is unreachable')
    const d4 = await driveCase(() => {
      throw fault
    })

    return {
      d1,
      d2,
      d3,
      d4,
      d4Fault: fault,
    }
  } finally {
    if (previousHome === undefined) delete processEnv[DSH_HOME_KEY]
    else processEnv[DSH_HOME_KEY] = previousHome
  }
})()

describe('C1 (guide §13.2): the durability seam (sessionPersistence.exists)', () => {
  it('D1 DSH_HOME completely unset + exists() = true: ensureLiveAgent RESUMES (no env-var false)', () => {
    expect(D.d1.rejection).toBeUndefined()
    expect(D.d1.resumed).toEqual(['session-team-c1-durability'])
    expect(D.d1.created).toEqual([])
  })

  it('D2 no filesystem tree at all + exists = true: the resume SUCCEEDS (the layout is invisible)', () => {
    expect(D.d2.rejection).toBeUndefined()
    expect(D.d2.resumed).toEqual(['session-team-c1-durability'])
    expect(D.d2.created).toEqual([])
  })

  it('D3 exists = false: the EXISTING "neither live nor durable" error is preserved (no resume)', () => {
    expect(D.d3.resumed).toEqual([])
    expect(D.d3.created).toEqual([])
    const rejection = D.d3.rejection
    expect(rejection instanceof Error).toBe(true)
    if (rejection instanceof Error) {
      expect(rejection.message).toBe(
        `p6t6: session 'session-team-c1-durability' is neither live nor durable — no agent to execute a tool on`,
      )
    }
  })

  it('D4 the persistence seam faults: the fault PROPAGATES (never misread as "not durable")', () => {
    expect(D.d4.resumed).toEqual([])
    expect(D.d4.created).toEqual([])
    // the EXACT fault object propagates (not a re-wrapped "not durable").
    expect(D.d4.rejection).toBe(D.d4Fault)
  })
})
