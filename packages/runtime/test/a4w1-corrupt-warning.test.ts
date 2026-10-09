/**
 * a4w1-corrupt-warning.test.ts — A4-PR7 W1 acceptance: a corrupt control
 * record reaches the HUMAN READ PLANE (fixed warning bar data) while the
 * EXECUTION semantics stay exactly as they were (RULING 5-B,
 * warning-first).
 *
 * THE LEGS (one durable world each; every scenario runs at module level
 * with top-level await — this repo's plain-node shim pins synchronous
 * `it` bodies):
 *
 *  W1  the brief's acceptance, minimally: ONE UNATTRIBUTABLE damaged row
 *      (every compared member absent-or-unreadable — the W13-i shape from
 *      `a4-corrupt-leg-guard.test.ts`). Asserted on ONE world:
 *      (a) the WARNING DATA: the REAL production dispatcher
 *          (`createS6RemotePorts` + `createS6RemoteDispatcher`, the
 *          `corruptControlLegs` closure over the real
 *          `ControlService.listControlState()` — the exact production
 *          wiring of `root.ts`) serves contract v9
 *          `team.listCorruptControlLegs` = corruptCount 1, the row's
 *          Ledger sequence, `disclosesMember: false` (the service's own
 *          flag: Team-level wording, no Member identity is claimed);
 *      (b) EXECUTION UNCHANGED: the same call the row could be about
 *          reaches the runtime facade exactly as before — verdict
 *          `no-request`, tool executed, zero allow consumptions; the
 *          warning is a report, never a gate;
 *      (c) the version gate + closed params: v8 refuses typed
 *          `method-version-unsupported`; a param smuggle is
 *          `malformed-params` before any read;
 *      (d) REBUILD SURVIVAL (cheap durable proxy): a SECOND control
 *          service over the SAME world — a plugin rebuild re-reading the
 *          ledger — serves the byte-identical corruption cell. The bar
 *          cannot be cleared by Member destroy/rebuild because the fact
 *          lives in the ledger, not in any member;
 *      (e) a principal derivation NEVER runs for this read (trip-wired).
 *
 *  W2  the guardrails around the read: a FOREIGN teamSessionId fails
 *      closed `TEAM_REMOTE_FOREIGN_TEAM` BEFORE any control read (the
 *      same bound-root law every team-scoped method runs); an UNWIRED
 *      seam is a typed `internal-error` (`port-unwired`) — never a
 *      silently empty "nothing is corrupt" report.
 *
 *  W3  the flag is the SERVICE's, not the client's: a damaged row that
 *      DOES disclose members (W13-a shape: `correlation` missing, the
 *      rest readable) serves `disclosesMember: true` on the same wire,
 *      while a call it does not name proceeds (an unrelated damaged row
 *      never freezes the Team).
 *
 * SELF-CLEANLINESS: inside the P4-T6 whole-tree scanner's scope; no
 * legacy Team SessionEvent denylist token appears.
 *
 * @module @dsh-agent-team/runtime/test/a4w1-corrupt-warning
 */
import { describe, expect, it } from 'vitest'
import { CONTROL_GUARD_BLOCK_REASONS, createControlService } from '../control/index.js'
import {
  createS6RemoteDispatcher,
  createS6RemotePorts,
} from '../src/plugin/s6-remote.js'
import type { S6RemoteOptions } from '../src/plugin/s6-remote.js'
import type { ServerPrincipalDerivation } from '../src/plugin/types.js'
import { destroyP6T1World } from './p6t1-helpers.js'
import { P6T2_NOW, P6T2_ROOT, P6T2_SEEDS } from './p6t2-helpers.js'
import { REMOTE_CORRUPT_CONTROL_LEGS_CAP } from '../../remote/src/index.js'
import type { RemoteResponse } from '../../remote/src/index.js'
import { createTeamTools } from '../../tools/src/index.js'
import type { ResolvedTeamToolCaller } from '../../tools/src/index.js'
import { createP6T6World, execFor } from '../../tools/test/p6t6-helpers.js'

const WORKER_ID = String(P6T2_SEEDS.worker.instanceId)
const OTHER_WORKER_ID = String(P6T2_SEEDS.worker2.instanceId)
const FOREIGN_ROOT = 'root-session-a4w1-foreign'
const W1_TOKEN = 'tok-a4w1-w1'

/** A v9 wire envelope. */
function v9(params: Record<string, unknown>): Record<string, unknown> {
  return { version: 9, params }
}

/** Success data of a response (fails the leg loudly otherwise). */
function dataOf(response: RemoteResponse): Record<string, unknown> {
  if (!response.ok) throw new Error(`A4W1 guard: expected success, got ${response.error.code}`)
  return response.value.data as unknown as Record<string, unknown>
}

/** The typed error code of a failed response. */
function codeOf(response: RemoteResponse): string {
  if (response.ok) throw new Error(`A4W1 guard: expected a typed failure, got success`)
  return String(response.error.code)
}

/** The `corruption` cell of a success response. */
function corruptionOf(response: RemoteResponse): Record<string, unknown> {
  return dataOf(response)['corruption'] as Record<string, unknown>
}

/** Principal derivation for the legs below: reads must NEVER touch it. */
const noPrincipal: ServerPrincipalDerivation = () => {
  throw new Error('A4W1 guard: principal derivation must not run for the v9 corrupt-leg read')
}

/** The production surface over one control service (the `root.ts` shape:
 *  the closure is EXACTLY `listControlState().corruptLegs`). */
function dispatcherOver(control: {
  listControlState: (root: string) => Promise<{ readonly corruptLegs: readonly unknown[] }>
}) {
  const ports = createS6RemotePorts({
    rootSessionId: P6T2_ROOT,
    repositories: {},
    corruptControlLegs: (root: string) =>
      control.listControlState(root).then((state) => state.corruptLegs),
  } as unknown as S6RemoteOptions)
  return createS6RemoteDispatcher(ports, noPrincipal)
}

/** The surface WITHOUT the v9 seam (the unwired host). */
function unwiredDispatcher() {
  const ports = createS6RemotePorts({
    rootSessionId: P6T2_ROOT,
    repositories: {},
  } as unknown as S6RemoteOptions)
  return createS6RemoteDispatcher(ports, noPrincipal)
}

/**
 * The UNATTRIBUTABLE damaged row (the W13-i shape, own instance): every
 * member the candidacy test compares is absent-or-unreadable, so the
 * strict reader files it and NOTHING can attribute it to a call.
 */
function unattributableRow(): Record<string, unknown> {
  return {
    requestId: 'req-a4w1-w1-noise',
    kind: 'leader-approval',
    requester: { kind: 'instance', instanceId: WORKER_ID, role: 'member' },
    subject: 42,
    targetInstanceId: '',
    actionName: '',
    toolName: 42,
    correlation: '',
    operationFingerprint: 42,
    executionCoupling: 'guarded',
  }
}

/** A damaged row that DISCLOSES members: only `correlation` is missing. */
function memberDisclosingRow(): Record<string, unknown> {
  return {
    requestId: 'req-a4w1-w3-damage',
    kind: 'leader-approval',
    requester: { kind: 'instance', instanceId: WORKER_ID, role: 'member' },
    subject: { kind: 'instance', instanceId: WORKER_ID },
    targetInstanceId: WORKER_ID,
    actionName: 'follow-up',
    toolName: 'team_follow_up',
    executionCoupling: 'guarded',
  }
}

async function leg(
  basename: string,
  row: Record<string, unknown>,
  call: { readonly targetInstanceId: string; readonly correlation: string },
): Promise<{
  readonly error: string
  readonly verdict: string
  readonly toolStatus: string
  readonly facadeReached: number
  readonly consumptions: number
  readonly ledgerSequence: number
  readonly v9corruption: Record<string, unknown> | string
  readonly v8code: string
  readonly smuggleCode: string
  readonly smuggleReason: string
  readonly rebuildCorruption: Record<string, unknown> | string
  readonly foreignCode: string
  readonly unwiredCode: string
  readonly unwiredReason: string
}> {
  const env = await createP6T6World(basename, ['leader', 'worker', 'worker2', 'scout'])
  try {
    const performed: string[] = []
    const runtimeSpy = {
      ...env.runtime,
      performAction: (request: Parameters<typeof env.runtime.performAction>[0]) => {
        performed.push(String(request.action))
        return env.runtime.performAction(request)
      },
    }
    const { tools } = createTeamTools({
      teamRuntime: runtimeSpy,
      controlService: env.control,
      messaging: env.messaging,
      activity: env.activity,
      resolveCaller: (sessionId: string): Promise<ResolvedTeamToolCaller> => {
        const caller = env.callerMap.bySession.get(sessionId)
        if (caller === undefined) {
          return Promise.reject(new Error(`a4w1: no caller for '${sessionId}'`))
        }
        return Promise.resolve({ caller, rootSessionId: P6T2_ROOT })
      },
    })
    const followUp = tools.find((tool) => tool.name === 'team_follow_up')
    if (followUp === undefined) throw new Error('a4w1: team_follow_up is not registered')
    const ledger = env.world.domain.repositories.ledger
    const sequence = await ledger.allocateSequence()
    await ledger.put({
      schemaVersion: 2,
      sequence,
      rootSessionId: P6T2_ROOT,
      factType: 'control-request-recorded',
      payload: row,
      createdAt: P6T2_NOW,
    })
    // (b) EXECUTION, at the real entry: the guard's verdict, the tool's
    // status, the facade spy, the consumption count — all BEFORE the
    // warning read is ever dispatched, so the read cannot have changed
    // anything it observes.
    const guardScope = {
      rootSessionId: P6T2_ROOT,
      targetInstanceId: call.targetInstanceId,
      actionName: 'follow-up',
      toolName: 'team_follow_up',
      correlation: call.correlation,
    } as const
    const verdict = await env.control.guardOperation(guardScope)
    const result = await followUp.execute(
      {
        rootSessionId: P6T2_ROOT,
        targetInstanceId: call.targetInstanceId,
        requestToken: call.correlation,
        prompt: 'a4w1 scenario',
        taskSummary: 'a4w1 scenario',
      },
      execFor(P6T2_ROOT),
    )
    const listed = await env.control.listControlState(P6T2_ROOT)
    // (a) the warning data through the PRODUCTION dispatcher, v9.
    const dispatch = dispatcherOver(env.control)
    const v9ok = await dispatch('team.listCorruptControlLegs', v9({ teamSessionId: P6T2_ROOT }))
    // (c) the version gate + the closed params.
    const v8 = await dispatch('team.listCorruptControlLegs', {
      version: 8,
      params: { teamSessionId: P6T2_ROOT },
    })
    const smuggle = await dispatch('team.listCorruptControlLegs', v9({
      teamSessionId: P6T2_ROOT,
      limit: 5,
    }))
    const smuggleDetails = smuggle.ok
      ? 'SUCCESS'
      : String((smuggle.error.details as unknown as Record<string, unknown> | undefined)?.['reason'] ?? 'none')
    // (d) rebuild survival: a SECOND service over the SAME durable world
    // (a plugin rebuild re-reads the ledger) serves the same cell.
    const control2 = createControlService({
      teamDomain: env.world.domain,
      blueprintCatalog: env.world.catalog,
      externalPolicyFacts: env.world.ports.externalPolicyFacts,
      now: () => P6T2_NOW,
    })
    const rebuild = await dispatcherOver(control2)(
      'team.listCorruptControlLegs',
      v9({ teamSessionId: P6T2_ROOT }),
    )
    // W2: the guardrails.
    const foreign = await dispatch('team.listCorruptControlLegs', v9({ teamSessionId: FOREIGN_ROOT }))
    const unwired = await unwiredDispatcher()(
      'team.listCorruptControlLegs',
      v9({ teamSessionId: P6T2_ROOT }),
    )
    return {
      error: 'none',
      verdict: verdict.allowed ? 'ALLOWED' : verdict.reason,
      toolStatus: String(result.status),
      facadeReached: performed.filter((action) => action === 'follow-up').length,
      consumptions: listed.consumptions.length,
      ledgerSequence: sequence,
      v9corruption: v9ok.ok ? corruptionOf(v9ok) : `ERROR:${v9ok.error.code}`,
      v8code: codeOf(v8),
      smuggleCode: codeOf(smuggle),
      smuggleReason: smuggleDetails,
      rebuildCorruption: rebuild.ok ? corruptionOf(rebuild) : `ERROR:${rebuild.error.code}`,
      foreignCode: codeOf(foreign),
      unwiredCode: codeOf(unwired),
      unwiredReason: unwired.ok
        ? 'SUCCESS'
        : String((unwired.error.details as unknown as Record<string, unknown> | undefined)?.['reason'] ?? 'none'),
    }
  } catch (error: unknown) {
    return {
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      verdict: 'threw',
      toolStatus: 'threw',
      facadeReached: 0,
      consumptions: 0,
      ledgerSequence: 0,
      v9corruption: 'threw',
      v8code: 'threw',
      smuggleCode: 'threw',
      smuggleReason: 'threw',
      rebuildCorruption: 'threw',
      foreignCode: 'threw',
      unwiredCode: 'threw',
      unwiredReason: 'threw',
    }
  } finally {
    await destroyP6T1World(env.world)
  }
}

/** W1: the unattributable row; the call it could be about proceeds. */
const w1 = await leg('a4w1-w1-unattributable', unattributableRow(), {
  targetInstanceId: WORKER_ID,
  correlation: W1_TOKEN,
})
/** W3: a member-disclosing damaged row; a call it does NOT name proceeds. */
const w3 = await leg('a4w1-w3-member-damage', memberDisclosingRow(), {
  targetInstanceId: OTHER_WORKER_ID,
  correlation: W1_TOKEN,
})

describe('A4-PR7 W1 acceptance: corrupt-record visibility without execution change', () => {
  it('W1 legs ran clean (no scenario threw)', () => {
    expect(w1.error).toBe('none')
    expect(w3.error).toBe('none')
  })

  it('W1(a) the warning data: count + Ledger sequence + attributable=false, served by the production dispatcher at v9', () => {
    expect(w1.v9corruption).toEqual({
      teamSessionId: P6T2_ROOT,
      corruptCount: 1,
      truncated: false,
      legs: [
        {
          sequence: w1.ledgerSequence,
          disclosesMember: false,
          requestId: 'req-a4w1-w1-noise',
        },
      ],
    })
  })

  it('W1(b) execution unchanged (RULING 5-B): the call proceeds — no-request, executed, zero consumptions', () => {
    expect(w1.verdict).toBe(CONTROL_GUARD_BLOCK_REASONS.NO_REQUEST)
    expect(w1.toolStatus).toBe('executed')
    expect(w1.facadeReached).toBe(1)
    expect(w1.consumptions).toBe(0)
  })

  it('W1(c) the version gate + closed params: v8 refuses typed, a param smuggle is refused before any read', () => {
    expect(w1.v8code).toBe('method-version-unsupported')
    expect(w1.smuggleCode).toBe('malformed-params')
    expect(w1.smuggleReason).toBe('unknown-field')
  })

  it('W1(d) rebuild survival: a second control service over the same durable world serves the byte-identical corruption cell', () => {
    expect(w1.rebuildCorruption).toEqual(w1.v9corruption)
  })

  it('W2 the guardrails: a foreign teamSessionId fails closed BEFORE any read; an unwired seam refuses typed, never reports empty', () => {
    expect(w1.foreignCode).toBe('TEAM_REMOTE_FOREIGN_TEAM')
    expect(w1.unwiredCode).toBe('internal-error')
    expect(w1.unwiredReason).toBe('port-unwired')
  })

  it('W3 the flag is the service\'s: a member-disclosing damaged row serves disclosesMember=true, and an unrelated call still proceeds', () => {
    const corruption = w3.v9corruption as Record<string, unknown>
    expect(corruption['corruptCount']).toBe(1)
    const legs = corruption['legs'] as Record<string, unknown>[]
    expect(legs.length).toBe(1)
    expect(legs[0]?.['disclosesMember']).toBe(true)
    expect(legs[0]?.['requestId']).toBe('req-a4w1-w3-damage')
    // the call the row does NOT name (different instance) still runs:
    // the damaged row is a REPORT, never a gate on unrelated work.
    expect(w3.toolStatus).toBe('executed')
    expect(w3.consumptions).toBe(0)
  })

  it('the bounded list is a bounded list: the cap constant is the law both dispatchers share', () => {
    // The cap lives in the remote contract (measured here so a silent
    // widening of the wire is a test failure, not a surprise).
    expect(REMOTE_CORRUPT_CONTROL_LEGS_CAP).toBe(20)
  })
})
