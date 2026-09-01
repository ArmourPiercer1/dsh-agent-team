/**
 * p8s3-work-request — P8-S3 R2: the work-request minimum semantics
 * (closure plan §16.3). A delegate/follow-up work request MUST explicitly
 * carry:
 *
 * - the model-visible `payload.prompt` (a non-empty string) — there is NO
 *   default transcript inheritance (Leader/sibling/group transcripts are
 *   never pulled into the request);
 * - optionally the explicit context channel `payload.attachedContext`
 *   (a non-empty string when present).
 *
 * Missing/empty prompt and empty attachedContext are REQUEST_MALFORMED
 * with ZERO durable writes. A conforming follow-up on the seeded RUNNING
 * worker executes (RUNNING skips the lifecycle commit, so no commit port
 * is required for this positive control).
 *
 * House pattern of the runtime package: async world construction at the
 * top level; every `it` asserts the captured constants synchronously.
 *
 * @module @dsh-agent-team/runtime/test/p8s3-work-request
 */

import { describe, expect, it } from 'vitest'

import { TEAM_RUNTIME_ERROR_CODES } from '../admission/index.js'
import type { TeamRuntimeActionRequest } from '../admission/index.js'
import { destroyP6T1World } from './p6t1-helpers.js'
import {
  P6T2_ROOT,
  P6T2_SEEDS,
  createP6T2Runtime,
  createP6T2World,
  expectRejection,
  leaderCaller,
  makeActionRequest,
} from './p6t2-helpers.js'

/** One captured rejection with the durable-write delta. */
interface WrCase {
  readonly code: string
  readonly newWrites: number
}

let wrCases: {
  readonly missingPrompt: WrCase
  readonly emptyPrompt: WrCase
  readonly delegateMissingPrompt: WrCase
  readonly emptyAttachedContext: WrCase
  readonly positive: {
    readonly effectKind: string
    readonly targetInstanceId: string | undefined
    readonly fromLifecycle: string | undefined
    readonly lifecycleCommitted: boolean | undefined
    readonly newWrites: number
  }
}

{
  const world = await createP6T2World('p8s3x-wr', ['leader', 'worker'])
  try {
    const runtime = createP6T2Runtime(world)
    const reject = async (request: ReturnType<typeof makeActionRequest>, code: string): Promise<WrCase> => {
      const before = world.seam.writeCount
      const rejection = await expectRejection(runtime, request, code)
      return { code: rejection.code, newWrites: world.seam.writeCount - before }
    }
    const workerId = P6T2_SEEDS.worker.instanceId // seeded lifecycle RUNNING

    // The R2 negative cases build the requests EXPLICITLY (no helper
    // default payload): the production API has no implicit prompt.
    const missingPrompt = await reject(
      {
        rootSessionId: P6T2_ROOT,
        action: 'follow-up',
        caller: leaderCaller(),
        targetInstanceId: workerId,
        requestToken: 'tok-p8s3-wr1',
      } satisfies TeamRuntimeActionRequest,
      TEAM_RUNTIME_ERROR_CODES.REQUEST_MALFORMED,
    )
    const emptyPrompt = await reject(
      {
        rootSessionId: P6T2_ROOT,
        action: 'follow-up',
        caller: leaderCaller(),
        targetInstanceId: workerId,
        requestToken: 'tok-p8s3-wr2',
        payload: { prompt: '' },
      } satisfies TeamRuntimeActionRequest,
      TEAM_RUNTIME_ERROR_CODES.REQUEST_MALFORMED,
    )
    const delegateMissingPrompt = await reject(
      {
        rootSessionId: P6T2_ROOT,
        action: 'delegate',
        caller: leaderCaller(),
        delegationTemplateId: 'worker',
        payload: { label: 'p8s3-no-prompt' },
        requestToken: 'tok-p8s3-wr3',
      } satisfies TeamRuntimeActionRequest,
      TEAM_RUNTIME_ERROR_CODES.REQUEST_MALFORMED,
    )
    const emptyAttachedContext = await reject(
      {
        rootSessionId: P6T2_ROOT,
        action: 'follow-up',
        caller: leaderCaller(),
        targetInstanceId: workerId,
        requestToken: 'tok-p8s3-wr4',
        payload: { prompt: 'do the thing', attachedContext: '' },
      } satisfies TeamRuntimeActionRequest,
      TEAM_RUNTIME_ERROR_CODES.REQUEST_MALFORMED,
    )

    const beforePositive = world.seam.writeCount
    const positiveOutcome = await runtime.performAction(
      makeActionRequest({
        targetInstanceId: workerId,
        requestToken: 'tok-p8s3-wr5',
        payload: { prompt: 'do the thing', attachedContext: 'context: the earlier findings' },
      }),
    )
    const effect = positiveOutcome.effect
    wrCases = {
      missingPrompt,
      emptyPrompt,
      delegateMissingPrompt,
      emptyAttachedContext,
      positive: {
        effectKind: effect.kind,
        ...(effect.kind === 'work-admitted'
          ? {
              targetInstanceId: positiveOutcome.targetInstanceId,
              fromLifecycle: effect.fromLifecycle,
              lifecycleCommitted: effect.lifecycleCommitted,
            }
          : { targetInstanceId: undefined, fromLifecycle: undefined, lifecycleCommitted: undefined }),
        newWrites: world.seam.writeCount - beforePositive,
      },
    }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('p8s3-work-request R2 payload contract', () => {
  it('a follow-up without payload.prompt is REQUEST_MALFORMED, zero writes', () => {
    expect(wrCases.missingPrompt.code).toBe(TEAM_RUNTIME_ERROR_CODES.REQUEST_MALFORMED)
    expect(wrCases.missingPrompt.newWrites).toBe(0)
  })

  it('a follow-up with an empty prompt is REQUEST_MALFORMED, zero writes', () => {
    expect(wrCases.emptyPrompt.code).toBe(TEAM_RUNTIME_ERROR_CODES.REQUEST_MALFORMED)
    expect(wrCases.emptyPrompt.newWrites).toBe(0)
  })

  it('a delegate without payload.prompt is REQUEST_MALFORMED, zero writes', () => {
    expect(wrCases.delegateMissingPrompt.code).toBe(TEAM_RUNTIME_ERROR_CODES.REQUEST_MALFORMED)
    expect(wrCases.delegateMissingPrompt.newWrites).toBe(0)
  })

  it('an empty attachedContext (when present) is REQUEST_MALFORMED, zero writes', () => {
    expect(wrCases.emptyAttachedContext.code).toBe(TEAM_RUNTIME_ERROR_CODES.REQUEST_MALFORMED)
    expect(wrCases.emptyAttachedContext.newWrites).toBe(0)
  })

  it('a conforming follow-up on a RUNNING target executes (explicit prompt + attachedContext)', () => {
    expect(wrCases.positive.effectKind).toBe('work-admitted')
    expect(wrCases.positive.targetInstanceId).toBe(P6T2_SEEDS.worker.instanceId)
    expect(wrCases.positive.fromLifecycle).toBe('RUNNING')
    expect(wrCases.positive.lifecycleCommitted).toBe(false)
    expect(wrCases.positive.newWrites).toBeGreaterThan(0)
  })
})
