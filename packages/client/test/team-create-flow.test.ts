/**
 * The two-stage v2 Team creation flow (TCM M4, plan §7 / §15.6) — the pure
 * orchestrator behind the panel's Create sequence:
 *
 *   team.create v2 (workspace-aware, CREATE-ONLY)
 *   → open the real Root
 *   → team.admitInitialWork v2 (only when the attempt carries work)
 *
 * The sandbox-runnable ordering/retry coverage (plan §7 必须测试, the parts
 * that are flow-logic rather than DOM): the workspace PATH (never the id)
 * enters the create request; the create request carries NO initialWork;
 * the open happens BEFORE the admit; the admit reuses the SAME root +
 * stable token + prompt; a stage-`work` failure resumes ONLY the admit
 * (the real Root stays open — no re-create, no re-open); a stage
 * create/open failure re-runs from the top; typed failures are preserved
 * verbatim (G5) and the only rejection kind maps onto the local
 * `native-error` marker; empty initial work performs create + open only
 * (no admit RPC at all); a `work` resume of an empty prompt is a no-op
 * success (never an empty-prompt RPC).
 *
 * The React panel (TeamCreationPanel) is the sole production caller; this
 * test drives the same function with spy faces. The DOM-level behaviors
 * (error lane, retry button, overlay retention) are covered by the jsdom
 * client specs (typechecked here; run on the real machine).
 *
 * Runner note (scripts/run-tests.mjs): the plain-node shim supports
 * SYNCHRONOUS `it` only — every async scenario runs at the module top
 * level (the team-remote-client.test.ts pattern) and its `it` asserts on
 * the captured result.
 */
import { describe, expect, it } from 'vitest'
import type {
  RemoteResponse,
  RemoteTeamAdmitInitialWorkParams,
  RemoteTeamCreateParamsV2,
} from '../../remote/src/index.js'
import type { TeamCreateAttempt } from '../src/model/team-intent-model.js'
import { runTeamCreateFlow, type TeamCreateFlowFaces, type TeamCreateFlowOutcome } from '../src/model/team-create-flow.js'

/** One provenance-bearing success envelope (the wire shape, verbatim). */
function okResponse(data: unknown, method: string): RemoteResponse {
  return {
    ok: true,
    value: {
      data: data as never,
      provenance: {
        origin: 'team-remote', method, endpoint: method, contractVersion: 2,
        requestToken: null, projectionGeneration: null, effectSequence: null,
      },
    },
  }
}

/** One typed failure envelope (the closed code + wire message verbatim). */
function errorResponse(code: string, message: string, method: string): RemoteResponse {
  return {
    ok: false,
    error: {
      code, message,
      details: { method, endpoint: method, contractVersion: 2, requestToken: null },
    },
  }
}

/** The frozen attempt used across the scenarios (the panel's snapshot). */
const ATTEMPT: TeamCreateAttempt = {
  rootSessionId: 'session-1',
  blueprintId: 'bp-1',
  blueprintRevision: 2,
  workspacePath: 'D:/work/side',
  prompt: 'scout the harbor',
  requestToken: 'team-work-t1',
}

interface SpyFaces extends TeamCreateFlowFaces {
  readonly calls: string[]
  readonly createParams: RemoteTeamCreateParamsV2[]
  readonly admitParams: RemoteTeamAdmitInitialWorkParams[]
  readonly opened: string[]
}

/** Spy faces (the default is the happy path); `calls` records the order. */
function makeFaces(overrides: Partial<Pick<TeamCreateFlowFaces, 'createV2' | 'openCreatedSession' | 'admitInitialWorkV2'>> = {}): SpyFaces {
  const calls: string[] = []
  const createParams: RemoteTeamCreateParamsV2[] = []
  const admitParams: RemoteTeamAdmitInitialWorkParams[] = []
  const opened: string[] = []
  // The bookkeeping ALWAYS records the call (overrides replace only the
  // behavior, never the spy).
  return {
    calls,
    createParams,
    admitParams,
    opened,
    createV2: (params) => {
      calls.push('create')
      createParams.push(params)
      return overrides.createV2 !== undefined
        ? overrides.createV2(params)
        : Promise.resolve(okResponse({ path: ATTEMPT.rootSessionId, durable: true, bind: {} }, 'team.create'))
    },
    openCreatedSession: (sessionId) => {
      calls.push('open')
      opened.push(sessionId)
      return overrides.openCreatedSession !== undefined
        ? overrides.openCreatedSession(sessionId)
        : Promise.resolve()
    },
    admitInitialWorkV2: (params) => {
      calls.push('admit')
      admitParams.push(params)
      return overrides.admitInitialWorkV2 !== undefined
        ? overrides.admitInitialWorkV2(params)
        : Promise.resolve(okResponse({ workOutcome: 'delivered' }, 'team.admitInitialWork'))
    },
  }
}

interface Scenario {
  readonly faces: SpyFaces
  readonly outcome: TeamCreateFlowOutcome
}

// --- the scenarios (top-level: the plain-node shim is synchronous) ------------

const freshWithWork = await (async (): Promise<Scenario> => {
  const faces = makeFaces()
  const outcome = await runTeamCreateFlow(faces, ATTEMPT)
  return { faces, outcome }
})()

const emptyWork = await (async (): Promise<Scenario> => {
  const faces = makeFaces()
  const outcome = await runTeamCreateFlow(faces, { ...ATTEMPT, prompt: '' })
  return { faces, outcome }
})()

const emptyWorkWorkResume = await (async (): Promise<Scenario> => {
  const faces = makeFaces()
  const outcome = await runTeamCreateFlow(faces, { ...ATTEMPT, prompt: '' }, 'work')
  return { faces, outcome }
})()

const omittedOptionals = await (async (): Promise<Scenario> => {
  const faces = makeFaces()
  const outcome = await runTeamCreateFlow(faces, {
    ...ATTEMPT,
    blueprintRevision: undefined,
    workspacePath: undefined,
    prompt: '',
  })
  return { faces, outcome }
})()

const typedCreateFailure = await (async (): Promise<Scenario> => {
  const faces = makeFaces({
    createV2: () => Promise.resolve(
      errorResponse('TEAM_CREATE_WORKSPACE_NOT_FOUND', "no workspace 'D:/ghost'", 'team.create'),
    ),
  })
  const outcome = await runTeamCreateFlow(faces, ATTEMPT)
  return { faces, outcome }
})()

const rejectedCreate = await (async (): Promise<Scenario> => {
  const faces = makeFaces({
    createV2: () => Promise.reject(new Error('channel lost')),
  })
  const outcome = await runTeamCreateFlow(faces, ATTEMPT)
  return { faces, outcome }
})()

const failedOpen = await (async (): Promise<Scenario> => {
  const faces = makeFaces({
    openCreatedSession: () => Promise.reject(new Error('unknown after re-pull')),
  })
  const outcome = await runTeamCreateFlow(faces, ATTEMPT)
  return { faces, outcome }
})()

const typedWorkFailure = await (async (): Promise<Scenario> => {
  const faces = makeFaces({
    admitInitialWorkV2: () => Promise.resolve(
      errorResponse('TEAM_CREATE_ROOT_WORK_DELIVERY_FAILED', 'the glue refused delivery', 'team.admitInitialWork'),
    ),
  })
  const outcome = await runTeamCreateFlow(faces, ATTEMPT)
  return { faces, outcome }
})()

const rejectedWork = await (async (): Promise<Scenario> => {
  const faces = makeFaces({
    admitInitialWorkV2: () => Promise.reject(new Error('channel lost')),
  })
  const outcome = await runTeamCreateFlow(faces, ATTEMPT)
  return { faces, outcome }
})()

const workRetry = await (async () => {
  const first = makeFaces({
    admitInitialWorkV2: () => Promise.resolve(
      errorResponse('TEAM_CREATE_ROOT_WORK_DELIVERY_FAILED', 'the glue refused delivery', 'team.admitInitialWork'),
    ),
  })
  const failed = await runTeamCreateFlow(first, ATTEMPT)
  const retry = makeFaces()
  const outcome = await runTeamCreateFlow(retry, ATTEMPT, 'work')
  return { first, failed, retry, outcome }
})()

// --- the assertions (synchronous, on the captured scenarios) -------------------

describe('runTeamCreateFlow', () => {
  it('runs create → open → admit in order with the workspace PATH (never the id) and NO initialWork in the v2 create request', () => {
    expect(freshWithWork.outcome).toEqual({ ok: true })
    expect(freshWithWork.faces.calls).toEqual(['create', 'open', 'admit'])
    // The workspace travels as the resolved PATH of the selected option.
    expect(freshWithWork.faces.createParams[0]).toEqual({
      rootSessionId: 'session-1',
      blueprintId: 'bp-1',
      blueprintRevision: 2,
      workspace: 'D:/work/side',
    })
    // CREATE-ONLY: the closed v2 field set has no initialWork at all.
    expect('initialWork' in (freshWithWork.faces.createParams[0] as unknown as Record<string, unknown>)).toBe(false)
    expect(freshWithWork.faces.opened).toEqual(['session-1'])
  })

  it('the admit reuses the SAME root + stable token + prompt as the frozen attempt (open BEFORE admit)', () => {
    expect(freshWithWork.outcome).toEqual({ ok: true })
    expect(freshWithWork.faces.admitParams).toEqual([
      { rootSessionId: 'session-1', requestToken: 'team-work-t1', prompt: 'scout the harbor' },
    ])
    // The open happens BEFORE the admit (the frozen §1.1 order).
    expect(freshWithWork.faces.calls.indexOf('admit')).toBeGreaterThan(freshWithWork.faces.calls.indexOf('open'))
  })

  it('empty initial work performs create + open ONLY (no admit RPC at all)', () => {
    expect(emptyWork.outcome).toEqual({ ok: true })
    expect(emptyWork.faces.calls).toEqual(['create', 'open'])
    expect(emptyWork.faces.admitParams).toEqual([])
    // And a `work` resume of an empty prompt is a no-op success (never an
    // empty-prompt RPC — the defensive total).
    expect(emptyWorkWorkResume.outcome).toEqual({ ok: true })
    expect(emptyWorkWorkResume.faces.calls).toEqual([])
  })

  it('omits the optional v2 fields (workspace / revision) when the attempt carries none', () => {
    expect(omittedOptionals.outcome).toEqual({ ok: true })
    expect(omittedOptionals.faces.createParams[0]).toEqual({ rootSessionId: 'session-1', blueprintId: 'bp-1' })
  })

  it('a typed create failure is preserved verbatim (stage create) — no open, no admit', () => {
    expect(typedCreateFailure.outcome).toEqual({
      ok: false,
      stage: 'create',
      code: 'TEAM_CREATE_WORKSPACE_NOT_FOUND',
      message: "no workspace 'D:/ghost'",
    })
    expect(typedCreateFailure.faces.calls).toEqual(['create'])
  })

  it('a create rejection (channel loss) maps onto the local native-error marker', () => {
    expect(rejectedCreate.outcome).toEqual({
      ok: false,
      stage: 'create',
      code: 'native-error',
      message: 'channel lost',
    })
    expect(rejectedCreate.faces.calls).toEqual(['create'])
  })

  it('a failed creation-path open stops BEFORE the admit (stage open, the real root stays real)', () => {
    expect(failedOpen.outcome).toEqual({
      ok: false,
      stage: 'open',
      code: 'native-error',
      message: 'unknown after re-pull',
    })
    expect(failedOpen.faces.calls).toEqual(['create', 'open'])
    expect(failedOpen.faces.admitParams).toEqual([])
  })

  it('a typed work failure is preserved verbatim (stage work) after create + open', () => {
    expect(typedWorkFailure.outcome).toEqual({
      ok: false,
      stage: 'work',
      code: 'TEAM_CREATE_ROOT_WORK_DELIVERY_FAILED',
      message: 'the glue refused delivery',
    })
    expect(typedWorkFailure.faces.calls).toEqual(['create', 'open', 'admit'])
  })

  it('a work rejection (channel loss) maps onto the local native-error marker (stage work)', () => {
    expect(rejectedWork.outcome).toEqual({
      ok: false,
      stage: 'work',
      code: 'native-error',
      message: 'channel lost',
    })
  })

  it('a stage-`work` retry resumes ONLY the admit — the SAME token + prompt, no re-create, no re-open (the real Root stays open)', () => {
    expect(workRetry.failed.ok).toBe(false)
    if (workRetry.failed.ok) throw new Error('unreachable')
    expect(workRetry.failed.stage).toBe('work')
    expect(workRetry.outcome).toEqual({ ok: true })
    // ONLY the admit re-ran (the real Root is already open — it is NOT
    // re-created and NOT re-opened).
    expect(workRetry.retry.calls).toEqual(['admit'])
    expect(workRetry.retry.createParams).toEqual([])
    expect(workRetry.retry.opened).toEqual([])
    // The SAME stable token + prompt (a fresh token would be a different
    // work intent — the host's at-most-one slot is per-root).
    expect(workRetry.retry.admitParams).toEqual(workRetry.first.admitParams)
  })
})
