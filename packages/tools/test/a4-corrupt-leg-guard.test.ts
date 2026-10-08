/**
 * a4-corrupt-leg-guard.test.ts — a control leg the strict reader refuses must
 * never REDUCE what the last-mile guard can see.
 *
 * THE FINDING UNDER TEST (independent external review of `master`, confirmed
 * behaviourally here). A `control-request-recorded` row whose `authorityScope`
 * is PRESENT AND MALFORMED fails `parseRequestPayload`
 * (`packages/runtime/control/service.ts:663-664`: `value['authorityScope'] !==
 * undefined && parseAuthorityScopeField(...) === undefined` ⇒ the WHOLE row is
 * refused). A refused row that still names an `approvalCaseId` is filed in
 * `ControlState.corruptLegs` (`:1331-1345`) — a bucket `guardOperation` never
 * consults. So the row matches nothing, the verdict is `no-request`, and the
 * real entry point `packages/tools/src/guard.ts:80-82` maps `no-request` to
 * `{ proceed: true }`. The stored constraint has silently vanished from the
 * guard's view, and the operation runs.
 *
 * WHY THE ENTRY POINT IS `consultGuard` AND NOT `guardOperation`. Every claim
 * in this file is made through `consultGuard` — the function the tool layer
 * actually calls (`packages/tools/src/tools.ts:343`) — because the service's
 * `allowed: false` is NOT the answer the pipeline acts on: `no-request` is one
 * of the two verdicts `consultGuard` proceeds on. `a4p3-approval-case.test.ts`
 * asserted `reason === 'no-request'` for a corrupt leg and read that as a
 * refusal; at the seam that decides whether the operation runs, that same
 * verdict is a pass. A unit-level reimplementation of the verdict would have
 * reproduced the mistake, so there is none here.
 *
 * WHAT IS NOT CLAIMED. No privilege escalation is asserted anywhere in this
 * file. What follows from the code — and what the legs below MEASURE rather
 * than argue — is that a stored approval constraint disappears from the guard's
 * view when the row carrying it cannot be parsed, and that the operation is
 * then handed to the runtime facade like any unapproved-but-un-gated call.
 * Whether anything downstream still stops it is a separate question with its
 * own answer in W2: a durable DENY that the guard cannot see does not stop it.
 *
 * THE EXPOSURE IS A DAMAGED LEDGER, NOT A SMUGGLED REQUEST. The production
 * request path validates `authorityScope` at the write boundary
 * (`service.ts:1798-1806`) and is the ONLY production writer of this fact type
 * (`grep -rn "control-request-recorded" packages/**` excluding dist, tests and
 * the client/projection READERS returns `service.ts:288` as the writer), so no
 * agent can put such a row in through the API. This is the fail-closed-on-damage
 * law: after storage damage, a hand-edited or imported home, or a reader older
 * than the writer, the guard must see LESS of what it may allow, not more.
 *
 * LEGS (one durable world each; the `it` bodies are synchronous per this repo's
 * plain-node shim, every scenario runs at module level with top-level await):
 *
 *  W1  the finding, minimally: the corrupt leg is the case's only row, no
 *      decision exists. The guard must refuse with a typed reason — never
 *      `no-request`, which the tool layer reads as "proceed";
 *  W2  the same row carrying a durable `deny`: the human's recorded refusal
 *      must survive the corruption of the leg it refuses. This is the leg that
 *      answers "does the operation then complete?" with a measurement: before
 *      the fix the call is handed to the runtime with the refusal on disk
 *      unread;
 *  W3  the same row carrying a durable `allow`: still refused (the point the
 *      allow covers is unreadable, so it cannot be re-confirmed), and the
 *      one-shot is not burned — zero `control-allow-consumed` rows;
 *  W4  a leg whose corruption is NOT the authority point (no `legOrdinal`) —
 *      the A2-9 shape `a4p3-approval-case.test.ts` already files as corrupt —
 *      refused too, with the reason that names what the guard actually knows;
 *  W5  a corrupt CURRENT leg (ordinal 2) above a readable, allowed leg 1: the
 *      readable leg must not be promoted to current by the unreadability of
 *      the one above it, and its allow must not be consumed;
 *  W6  THE OTHER DIRECTION, which is the regression this fix is most likely to
 *      cause: a genuinely un-requested call in a team that has NO control rows
 *      at all proceeds — byte-identically to the pre-fix tree;
 *  W7  a genuinely un-requested call in a team that DOES hold a corrupt leg,
 *      for a DIFFERENT scope (different correlation, different action, and a
 *      different `toolName` at the same correlation): an unrelated damaged row
 *      must not freeze the Team. A fix that refuses everything is as useless as
 *      one that refuses nothing;
 *  W8  REVISED BY RULING 5-A (behaviour change, not a silent edit). A corrupt
 *      row that names NO case used to be invisible: filing depended on
 *      `approvalCaseId`, the one field the candidacy test refuses to trust, so
 *      the row never entered `corruptLegs` and the guard answered `no-request`
 *      — the one verdict that means "proceed". RULING 5-A files EVERY refused
 *      row whose payload is an inspectable plain object, which splits this leg
 *      in two (the way D3-4 split its masked leg):
 *        W8-a the row NAMES this call → it is filed, it is a candidate, and the
 *             guard refuses it. This is the new execution effect;
 *        W8-b the row discloses NO comparable member → it is UNATTRIBUTABLE: it
 *             keeps today's `no-request`, loudly labelled as a boundary awaiting
 *             RULING 5-B (blocking on it is a human safety-vs-availability call,
 *             not this lane's to make).
 *      `a4a-control-exact-scope.test.ts` carries the same boundary for the
 *      direct-consult lane and is corrected in the same commit;
 *  W9  the two routes that DO read `corruptLegs` (`readApprovalCaseState`,
 *      which reports the typed problem, and `findApprovalCaseByIdentity`, the
 *      only frozen route from a fingerprint back to a case id) keep answering as
 *      they did. They already cover the reporting half; neither is on the
 *      execution path, which is why the guard was still proceeding;
 *  W12 RULING 5-A at the REAL tool entry (its own `describe`, its own harness
 *      under `w12Leg`): the same refused row with and without a case id, driven
 *      through `team_follow_up.execute` against a live seeded member. A row that
 *      names the call blocks it (W12-a, the counterexample — pre-5-A the facade
 *      ran); the same row at a call it does not name still proceeds (W12-b); a
 *      row that discloses no comparable member is REPORTED and still does not
 *      block (W12-c, the boundary RULING 5-B owns); and the new read surface
 *      counts the whole refused set without gating anything (W12-d);
 *  W11 THE IDENTITY MEMBER OF A ROW THAT DISCLOSES TWO. `parseRequestPayload`
 *      refuses a leg whose explicit `subject` disagrees with its legacy
 *      `targetInstanceId` — an ambiguous identity fails closed — so a row whose
 *      TWO identity fields name two instances is not an exotic shape: it is the
 *      mainstream member of `corruptLegs`. W11 drives ONE such row (with a
 *      durable DENY under it) at each of the three instances the row can be read
 *      as addressing: the one its `subject` names, the one its legacy projection
 *      names, and one neither field names. The first two must refuse; the third
 *      must proceed. Reading only the first field — which is what the code did —
 *      ruled the row out for the second and answered `no-request`, i.e. proceed.
 *
 * SELF-CLEANLINESS: inside the P4-T6 whole-tree scanner's scope; no legacy Team
 * SessionEvent denylist token appears.
 *
 * @module @dsh-agent-team/tools/test/a4-corrupt-leg-guard
 */
import { describe, expect, it } from 'vitest'
import {
  CONTROL_DECISION_VALUES,
  CONTROL_GUARD_BLOCK_REASONS,
  CONTROL_REQUEST_KINDS,
  createControlService,
} from '../../runtime/control/index.js'
import type { ControlService } from '../../runtime/control/index.js'
import type { TeamRuntime } from '../../runtime/admission/index.js'
import type { P6T1World } from '../../runtime/test/p6t1-helpers.js'
import { destroyP6T1World } from '../../runtime/test/p6t1-helpers.js'
import {
  P6T4_NOW,
  P6T4_ROOT,
  P6T4_SEEDS,
  createP6T4World,
  writeRawControlFact,
} from '../../runtime/test/p6t4-helpers.js'
import {
  P6T2_NOW,
  P6T2_ROOT,
  P6T2_SEEDS,
} from '../../runtime/test/p6t2-helpers.js'
import { createTeamTools } from '../src/index.js'
import { consultGuard } from '../src/index.js'
import type { ResolvedTeamToolCaller } from '../src/index.js'
import type { GuardConsultDecision } from '../src/guard.js'
import { createP6T6World, execFor } from './p6t6-helpers.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)
const LEADER_ID = String(P6T4_SEEDS.leader.instanceId)
const SUBJECT = { kind: 'instance', instanceId: WORKER_ID } as const
const ACTION_NAME = 'team.action.execute'
const TOOL_NAME = 'read'
const RESOURCE = 'file:///a4-corrupt-leg.txt'
const FINGERPRINT = 'fp-a4-corrupt-leg'
const CORRELATION = 'corr-a4-corrupt-leg'
const CASE_ID = 'case-a4-corrupt-leg'

/** A readable authority point: class `read` on the exact resource. */
const SCOPE_OK = {
  operationClass: TOOL_NAME,
  matcher: { kind: 'exact', resource: RESOURCE },
} as const

/**
 * THE MALFORMED POINT (W1-W3). `subtree` is a real matcher kind in the
 * permission-document vocabulary and a legal shape on the wire — it is
 * precisely what must NEVER be persisted in a Control row (a subtree there
 * silently widens a single-shot grant into a standing ceiling), so the strict
 * reader refuses the row that carries it. That is the whole finding: the reader
 * is right to refuse the row, and the guard is wrong to treat the refusal as
 * the absence of a constraint.
 */
const SCOPE_SUBTREE = {
  operationClass: TOOL_NAME,
  matcher: { kind: 'subtree', resource: RESOURCE },
} as const

/** The guard scope of the call under test: the EXACT scope the row covers. */
function callScope(overrides: { readonly correlation?: string; readonly toolName?: string; readonly actionName?: string } = {}) {
  return {
    rootSessionId: P6T4_ROOT,
    subject: SUBJECT,
    targetInstanceId: WORKER_ID,
    actionName: overrides.actionName ?? ACTION_NAME,
    toolName: overrides.toolName ?? TOOL_NAME,
    correlation: overrides.correlation ?? CORRELATION,
    operationFingerprint: FINGERPRINT,
    authorityScope: SCOPE_OK,
  }
}

/**
 * One corrupt `control-request-recorded` row: every member the strict reader
 * needs is VALID except the authority point, so the row's fate here is decided
 * by `parseAuthorityScopeField` alone and nothing else can explain the verdict.
 *
 * @param authorityScope - the value written under the `authorityScope` key.
 *   Pass `undefined` to omit the key entirely (the shape the A1-14 A4 leg
 *   already covers — that one parses, and is NOT this file's subject).
 */
function corruptRequestRow(overrides: {
  readonly requestId: string
  readonly correlation: string
  readonly toolName?: string
  readonly actionName?: string
  readonly authorityScope?: unknown
  readonly includeAuthorityKey: boolean
  readonly legOrdinal?: number | string
  readonly instanceId?: string
  readonly includeFingerprint?: boolean
}): Record<string, unknown> {
  const instanceId = overrides.instanceId ?? WORKER_ID
  const row: Record<string, unknown> = {
    requestId: overrides.requestId,
    kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
    requester: { kind: 'instance', instanceId, role: 'member' },
    subject: { kind: 'instance', instanceId },
    targetInstanceId: instanceId,
    actionName: overrides.actionName ?? ACTION_NAME,
    toolName: overrides.toolName ?? TOOL_NAME,
    correlation: overrides.correlation,
    executionCoupling: 'guarded',
    approvalCaseId: CASE_ID,
    legOrdinal: overrides.legOrdinal ?? 1,
    reviewAuthority: 'leader',
    requiredAuthorityAtCreation: 'leader',
    beneficiaryAuthority: 'member',
    requestedEffect: 'allow',
  }
  // `packages/tools/src/tools.ts` builds its guard scope WITHOUT an operation
  // fingerprint, so a row that carries one is not that lane's gate under the
  // scope-key law (W10 seeds the lane-shaped row; the direct-consult legs carry
  // the fingerprint, which is the shape the pre-execute adapter lane sends).
  if (overrides.includeFingerprint !== false) row['operationFingerprint'] = FINGERPRINT
  if (overrides.includeAuthorityKey) row['authorityScope'] = overrides.authorityScope
  return row
}

/** The durable decision row over one corrupt leg (W2 deny / W3 allow). */
function decisionRow(requestId: string, decision: string, requestSequence: number) {
  return {
    requestId,
    decision,
    decider: { kind: 'instance', instanceId: LEADER_ID, role: 'leader' },
    requestSequence,
    scope: {
      rootSessionId: P6T4_ROOT,
      subject: SUBJECT,
      targetInstanceId: WORKER_ID,
      actionName: ACTION_NAME,
      toolName: TOOL_NAME,
      correlation: CORRELATION,
      operationFingerprint: FINGERPRINT,
    },
  }
}

function serviceOver(world: P6T1World): ControlService {
  return createControlService({
    teamDomain: world.domain,
    blueprintCatalog: world.catalog,
    externalPolicyFacts: world.ports.externalPolicyFacts,
    now: () => P6T4_NOW,
    // A port that always confirms: nothing in this file may be refused by the
    // A1-14 recheck, so every refusal recorded here is attributable to the
    // corrupt leg and to nothing else.
    authorityRevalidation: async () => ({ kind: 'still-sufficient' }),
  })
}

function consumptionRows(world: P6T1World): number {
  return world.domain.repositories.ledger
    .list()
    .filter((entry) => String(entry.factType) === 'control-allow-consumed').length
}

/** Run one scenario: seed the row, consult the REAL guard, keep the evidence. */
/** What one scenario observed at the seam: either the decision the real
 *  `consultGuard` returned, or the fact that the call THREW (kept as data, so a
 *  throw is a reported outcome the leg asserts on — never a swallowed error and
 *  never a value smuggled into the frozen reason vocabulary). */
type ScenarioConsult =
  | GuardConsultDecision
  | { readonly proceed: false; readonly reason: 'threw' }

async function scenario(
  name: string,
  rows: ReadonlyArray<{
    readonly requestId: string
    readonly correlation?: string
    readonly toolName?: string
    readonly actionName?: string
    readonly includeAuthorityKey: boolean
    readonly authorityScope?: unknown
    readonly legOrdinal?: number | string
    readonly decision?: string
  }>,
  consult: (service: ControlService) => Promise<GuardConsultDecision>,
): Promise<{
  readonly consult: ScenarioConsult
  readonly consumptions: number
  readonly ledgerRows: number
  readonly error: string
}> {
  const world = await createP6T4World(name, ['leader', 'worker'])
  try {
    const service = serviceOver(world)
    for (const row of rows) {
      const sequence = await writeRawControlFact(
        world,
        'control-request-recorded',
        corruptRequestRow({
          requestId: row.requestId,
          correlation: row.correlation ?? CORRELATION,
          ...(row.toolName !== undefined ? { toolName: row.toolName } : {}),
          ...(row.actionName !== undefined ? { actionName: row.actionName } : {}),
          includeAuthorityKey: row.includeAuthorityKey,
          ...(row.authorityScope !== undefined ? { authorityScope: row.authorityScope } : {}),
          ...(row.legOrdinal !== undefined ? { legOrdinal: row.legOrdinal } : {}),
        }),
      )
      if (row.decision !== undefined) {
        await writeRawControlFact(
          world,
          'control-decision-recorded',
          decisionRow(row.requestId, row.decision, sequence),
        )
      }
    }
    const before = world.domain.repositories.ledger.list().length
    const consultResult = await consult(service)
    return {
      consult: consultResult,
      consumptions: consumptionRows(world),
      ledgerRows: world.domain.repositories.ledger.list().length - before,
      error: 'none',
    }
  } catch (error: unknown) {
    return {
      consult: { proceed: false, reason: 'threw' },
      consumptions: 0,
      ledgerRows: 0,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// ---------------------------------------------------------------------------
// W1 — the finding: present-and-malformed authority point, no decision.
// ---------------------------------------------------------------------------

const w1 = await scenario(
  'a4cl-w1-malformed-pending',
  [{ requestId: 'req-a4cl-w1', includeAuthorityKey: true, authorityScope: SCOPE_SUBTREE }],
  (service) => consultGuard(service, callScope()),
)

// ---------------------------------------------------------------------------
// W2 — the same corrupt leg carrying a durable DENY.
// ---------------------------------------------------------------------------

const w2 = await scenario(
  'a4cl-w2-malformed-denied',
  [
    {
      requestId: 'req-a4cl-w2',
      includeAuthorityKey: true,
      authorityScope: SCOPE_SUBTREE,
      decision: CONTROL_DECISION_VALUES.DENY,
    },
  ],
  (service) => consultGuard(service, callScope()),
)

// ---------------------------------------------------------------------------
// W3 — the same corrupt leg carrying a durable ALLOW.
// ---------------------------------------------------------------------------

const w3 = await scenario(
  'a4cl-w3-malformed-allowed',
  [
    {
      requestId: 'req-a4cl-w3',
      includeAuthorityKey: true,
      authorityScope: SCOPE_SUBTREE,
      decision: CONTROL_DECISION_VALUES.ALLOW,
    },
  ],
  (service) => consultGuard(service, callScope()),
)

// ---------------------------------------------------------------------------
// W4 — a corrupt leg whose broken member is NOT the authority point.
// ---------------------------------------------------------------------------

const w4 = await scenario(
  'a4cl-w4-no-ordinal',
  [{ requestId: 'req-a4cl-w4', includeAuthorityKey: false, legOrdinal: 'second' }],
  (service) => consultGuard(service, callScope()),
)

const w4b = await scenario(
  'a4cl-w4b-point-readable',
  [
    {
      requestId: 'req-a4cl-w4b',
      includeAuthorityKey: true,
      authorityScope: SCOPE_OK,
      legOrdinal: 'second',
    },
  ],
  (service) => consultGuard(service, callScope()),
)

/** The same seeds as `scenario`, but reading the VERDICT THIS FILE PRODUCES
 *  rather than the tool plane's translation of it — W5 polices the producer. */
async function verdictOf(
  name: string,
  payloads: readonly Record<string, unknown>[],
): Promise<{ readonly allowed: boolean; readonly reason: string; readonly error: string }> {
  const world = await createP6T4World(name, ['leader', 'worker'])
  try {
    const service = serviceOver(world)
    for (const payload of payloads) {
      await writeRawControlFact(world, 'control-request-recorded', payload)
    }
    const verdict = await service.guardOperation(callScope())
    return {
      allowed: verdict.allowed,
      reason: verdict.allowed ? 'allowed' : String(verdict.reason),
      error: 'none',
    }
  } catch (error: unknown) {
    return {
      allowed: false,
      reason: 'threw',
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    }
  } finally {
    await destroyP6T1World(world)
  }
}

const w5CorruptPoint = await verdictOf('a4cl-w5-point', [
  corruptRequestRow({
    requestId: 'req-a4cl-w5a',
    correlation: CORRELATION,
    includeAuthorityKey: true,
    authorityScope: SCOPE_SUBTREE,
  }),
])
const w5CorruptElsewhere = await verdictOf('a4cl-w5-elsewhere', [
  corruptRequestRow({
    requestId: 'req-a4cl-w5b',
    correlation: CORRELATION,
    includeAuthorityKey: true,
    authorityScope: SCOPE_OK,
    legOrdinal: 'second',
  }),
])
const w5Clean = await verdictOf('a4cl-w5-clean', [])

// ---------------------------------------------------------------------------
// W6 — the legitimate no-request path (no control rows at all).
// ---------------------------------------------------------------------------

const w6 = await scenario('a4cl-w6-no-rows', [], (service) =>
  consultGuard(service, callScope()),
)

// ---------------------------------------------------------------------------
// W7 — a corrupt leg elsewhere in the Team must not freeze it. Three
// genuinely-un-governed calls, each in a world that also holds W1's row.
// ---------------------------------------------------------------------------

const w7Correlation = await scenario(
  'a4cl-w7-other-correlation',
  [{ requestId: 'req-a4cl-w7', includeAuthorityKey: true, authorityScope: SCOPE_SUBTREE }],
  (service) => consultGuard(service, callScope({ correlation: 'corr-a4cl-unrelated' })),
)

const w7Action = await scenario(
  'a4cl-w7-other-action',
  [{ requestId: 'req-a4cl-w7b', includeAuthorityKey: true, authorityScope: SCOPE_SUBTREE }],
  (service) => consultGuard(service, callScope({ actionName: 'team.action.other' })),
)

const w7Tool = await scenario(
  'a4cl-w7-other-tool',
  [{ requestId: 'req-a4cl-w7c', includeAuthorityKey: true, authorityScope: SCOPE_SUBTREE }],
  (service) => consultGuard(service, callScope({ toolName: 'write' })),
)

// ---------------------------------------------------------------------------
// W8 — REVISED BY RULING 5-A: the row that names no case. What was one leg
// pinned as a boundary is now two, one per outcome, so the direction that moved
// is visible (the `D3-4b` split precedent). The damage is W1's — a present-and-
// malformed authority point — and the ONLY difference from W1's row is that
// these rows name no case.
// ---------------------------------------------------------------------------

/**
 * One W8 world: seed ONE refused row that names no case, consult the real tool
 * plane, and read the ledger back through the read plane.
 *
 * @param scope - the guard scope of the call. The TOOL lane sends no operation
 *   fingerprint (`packages/tools/src/tools.ts`), which is what makes a legacy
 *   row's ABSENT fingerprint an agreement rather than a disagreement.
 */
async function w8Leg(
  basename: string,
  row: Record<string, unknown>,
  scope: ReturnType<typeof callScope>,
): Promise<{
  readonly error: string
  readonly consult: ScenarioConsult
  readonly producerReason: string
  readonly corruptLegs: readonly CorruptLegView[]
}> {
  const world = await createP6T4World(basename, ['leader', 'worker'])
  try {
    const service = serviceOver(world)
    await writeRawControlFact(world, 'control-request-recorded', row)
    const verdict = await service.guardOperation(scope)
    return {
      error: 'none',
      consult: await consultGuard(service, scope),
      producerReason: verdict.allowed ? 'ALLOWED' : verdict.reason,
      corruptLegs: corruptLegsOf(await service.listControlState(P6T4_ROOT)),
    }
  } catch (error: unknown) {
    return {
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      consult: { proceed: false, reason: 'threw' },
      producerReason: 'threw',
      corruptLegs: [],
    }
  } finally {
    await destroyP6T1World(world)
  }
}

/** W1's damage on a row that names NO case: refused, and (pre-5-A) unfound. */
function w8NamedRow(): Record<string, unknown> {
  return {
    requestId: 'req-a4cl-w8',
    kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
    requester: { kind: 'instance', instanceId: WORKER_ID, role: 'member' },
    subject: SUBJECT,
    targetInstanceId: WORKER_ID,
    actionName: ACTION_NAME,
    toolName: TOOL_NAME,
    correlation: CORRELATION,
    operationFingerprint: FINGERPRINT,
    executionCoupling: 'guarded',
    authorityScope: SCOPE_SUBTREE,
  }
}

/** The same row with every member the guard compares present-and-unreadable. */
function w8NoMemberRow(): Record<string, unknown> {
  return { ...w8NamedRow(), requestId: 'req-a4cl-w8b', subject: 42, targetInstanceId: 42, actionName: 42, toolName: 42, correlation: 42, operationFingerprint: 42 }
}

const w8NamedCall = await w8Leg('a4cl-w8-legacy-row', w8NamedRow(), callScope())
const w8NoMember = await w8Leg('a4cl-w8-no-member', w8NoMemberRow(), callScope())


// ---------------------------------------------------------------------------
// W10 — WHICH PLANE IS OBSERVED, measured rather than described.
//
// W1-W4 answer "did the tool-plane guard stop this call?" and nothing more.
// That is the whole of what `packages/tools` can answer: on proceed the tool
// plane defers to the runtime facade. So this leg drives the REAL facade path —
// a registered guarded work tool over the real P6-T2 `TeamRuntime`, with a
// runtime spy that counts whether the facade was reached — and records what the
// deeper plane did with a call whose governing leg is corrupt AND whose durable
// decision is a DENY. It is reported as depth-in-defence or its absence, never
// as a redefinition of W2.
// ---------------------------------------------------------------------------

const W10_TOKEN = 'tok-a4cl-w10'
const W10_WORKER = String(P6T2_SEEDS.worker.instanceId)

const w10 = await (async () => {
  const env = await createP6T6World('a4cl-w10-runtime-plane', ['leader', 'worker'])
  try {
    const performed: string[] = []
    const runtimeSpy: TeamRuntime = {
      ...env.runtime,
      performAction: (request) => {
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
          return Promise.reject(new Error(`a4cl-w10: no caller for '${sessionId}'`))
        }
        return Promise.resolve({ caller, rootSessionId: P6T2_ROOT })
      },
    })
    const followUp = tools.find((tool) => tool.name === 'team_follow_up')
    if (followUp === undefined) throw new Error('a4cl-w10: team_follow_up is not registered')
    // The same corrupt leg as W2 — present-and-malformed authority point, with a
    // durable DENY under it — at the EXACT scope of the tool call below
    // (correlation = the tool's request token).
    const ledger = env.world.domain.repositories.ledger
    const sequence = await ledger.allocateSequence()
    await ledger.put({
      schemaVersion: 2,
      sequence,
      rootSessionId: P6T2_ROOT,
      factType: 'control-request-recorded',
      payload: corruptRequestRow({
        requestId: 'req-a4cl-w10',
        correlation: W10_TOKEN,
        actionName: 'follow-up',
        toolName: 'team_follow_up',
        instanceId: W10_WORKER,
        includeAuthorityKey: true,
        includeFingerprint: false,
        authorityScope: SCOPE_SUBTREE,
      }),
      createdAt: P6T2_NOW,
    })
    await ledger.put({
      schemaVersion: 2,
      sequence: await ledger.allocateSequence(),
      rootSessionId: P6T2_ROOT,
      factType: 'control-decision-recorded',
      payload: {
        requestId: 'req-a4cl-w10',
        decision: CONTROL_DECISION_VALUES.DENY,
        decider: { kind: 'instance', instanceId: LEADER_ID, role: 'leader' },
        requestSequence: sequence,
        scope: {
          rootSessionId: P6T2_ROOT,
          subject: { kind: 'instance', instanceId: W10_WORKER },
          targetInstanceId: W10_WORKER,
          actionName: 'follow-up',
          toolName: 'team_follow_up',
          correlation: W10_TOKEN,
        },
      },
      createdAt: P6T2_NOW,
    })
    const result = await followUp.execute(
      {
        rootSessionId: P6T2_ROOT,
        targetInstanceId: W10_WORKER,
        requestToken: W10_TOKEN,
        prompt: 'a4cl-w10 prompt',
        taskSummary: 'a4cl-w10 scenario',
      },
      execFor(P6T2_ROOT),
    )
    const reasonField = (result as { readonly reason?: unknown }).reason
    return {
      error: 'none' as string,
      /** The TOOL-PLANE answer — the claim W10 is entitled to make. */
      status: result.status,
      reason: typeof reasonField === 'string' ? reasonField : 'none',
      /** The RUNTIME-PLANE answer — depth-in-defence, or the lack of it. */
      facadeReached: performed.filter((action) => action === 'follow-up').length,
      facadeOutcome: JSON.stringify(result),
      consumptions: (await env.control.listControlState(P6T2_ROOT)).consumptions.length,
    }
  } catch (error: unknown) {
    return {
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      status: 'threw',
      reason: 'threw',
      facadeReached: 0,
      facadeOutcome: 'threw',
      consumptions: 0,
    }
  } finally {
    await destroyP6T1World(env.world)
  }
})()

// ---------------------------------------------------------------------------
// W9 — the two routes that already read `corruptLegs` still answer.
// ---------------------------------------------------------------------------

const w9 = await (async () => {
  const world = await createP6T4World('a4cl-w9-reporting-routes', ['leader', 'worker'])
  try {
    const service = serviceOver(world)
    await writeRawControlFact(
      world,
      'control-request-recorded',
      corruptRequestRow({
        requestId: 'req-a4cl-w9',
        correlation: CORRELATION,
        includeAuthorityKey: true,
        authorityScope: SCOPE_SUBTREE,
      }),
    )
    const caseRead = await service.readApprovalCaseState({
      rootSessionId: P6T4_ROOT,
      approvalCaseId: CASE_ID,
    })
    const open = await service.listOpenApprovalCases({ rootSessionId: P6T4_ROOT })
    return {
      caseReadKind: caseRead.kind,
      caseReadProblem: caseRead.kind === 'problem' ? caseRead.problem : 'none',
      caseReadSequence: caseRead.kind === 'problem' ? (caseRead.sequence ?? -1) : -1,
      openCases: open.length,
    }
  } finally {
    await destroyP6T1World(world)
  }
})()

// ---------------------------------------------------------------------------
// W11 — THE IDENTITY MEMBER OF A CORRUPT ROW DISCLOSES TWO INSTANCES.
//
// `parseRequestPayload` refuses a leg whose explicit `subject` disagrees with
// its legacy `targetInstanceId` (`control/service.ts:712-719`, "an ambiguous
// identity — fail closed, never a guess"), and a refused row that names a case
// is filed in `corruptLegs`. So a row whose TWO identity fields name two
// instances is not an exotic shape: it is the MAIN PATH into the bucket this
// guard reads. And the guard read exactly ONE of the two fields:
//
//     if (payload['subject'] !== undefined) { …compare subject… }
//     const legacyTarget = payload['targetInstanceId']   // only if subject ABSENT
//
// For a call targeting the instance named by `targetInstanceId`, the comparison
// was made against the OTHER field, returned `false`, and a `false` is the one
// answer that rules the row out — so the row's recorded constraint vanished for
// that call exactly as it did before this file existed, and it vanished for the
// reason the law most rejects: one damaged row was treated as positive evidence
// that it governs a different call, when the row's own two members contradict
// each other about which call that is.
//
// ONE ROW, THREE CALLS. Each leg below is its own durable world holding the
// SAME hand-written row plus a durable DENY, and a call that differs only in
// the instance it targets — so the only variable is which identity field the
// call agrees with:
//
//   W11-a the instance named by `subject`        (agree + disagree  → candidate)
//   W11-b the instance named by `targetInstanceId` (disagree + agree → candidate)
//   W11-c an instance NEITHER field names          (disagree + disagree → ruled out)
//
// a and b must refuse: a self-contradictory identity member is evidence about
// NOTHING, and evidence about nothing never rules a durable constraint out.
// c must proceed: both disclosures positively disagree, which is the one
// reading that says "this row governs some other call" — the direction that
// keeps one damaged row from freezing the Team.
// ---------------------------------------------------------------------------

const W11_TOKEN = 'tok-a4cl-w11'
/** Instance A: named by the row's explicit `subject`. */
const W11_SUBJECT_INSTANCE = String(P6T2_SEEDS.worker.instanceId)
/** Instance B: named by the row's legacy `targetInstanceId` projection. */
const W11_LEGACY_INSTANCE = String(P6T2_SEEDS.worker2.instanceId)
/** Instance C: named by neither field. */
const W11_OTHER_INSTANCE = String(P6T2_SEEDS.scout.instanceId)

/**
 * THE ROW: one corrupt approval leg that asserts two identities at once.
 *
 * The contradiction IS the damage: every other member is what the strict reader
 * wants, and the row names a case, so it is refused for ambiguity and filed in
 * `corruptLegs`. It carries no operation fingerprint (the `tools.ts` guard-scope
 * shape, as in W10), which is why the honest refusal name is the one that says
 * "the governing leg could not be reconstructed".
 */
function w11ContradictoryRow(): Record<string, unknown> {
  return {
    requestId: 'req-a4cl-w11',
    kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
    requester: { kind: 'instance', instanceId: W11_SUBJECT_INSTANCE, role: 'member' },
    // Assertion 1 of 2: "this leg governs a call on instance A".
    subject: { kind: 'instance', instanceId: W11_SUBJECT_INSTANCE },
    // Assertion 2 of 2: "this leg governs a call on instance B". Nothing else
    // on the row is damaged — this pair alone is what the reader refuses.
    targetInstanceId: W11_LEGACY_INSTANCE,
    actionName: 'follow-up',
    toolName: 'team_follow_up',
    correlation: W11_TOKEN,
    executionCoupling: 'guarded',
    approvalCaseId: CASE_ID,
    legOrdinal: 1,
    reviewAuthority: 'leader',
    requiredAuthorityAtCreation: 'leader',
    beneficiaryAuthority: 'member',
    requestedEffect: 'allow',
  }
}

/** The durable DENY the human recorded under that leg (a readable row: its OWN
 *  identity is self-consistent, so the denial survives — only the leg is
 *  damaged). It is what "the constraint vanished" is measured against. */
function w11DenyRow(requestSequence: number): Record<string, unknown> {
  return {
    requestId: 'req-a4cl-w11',
    decision: CONTROL_DECISION_VALUES.DENY,
    decider: { kind: 'instance', instanceId: LEADER_ID, role: 'leader' },
    requestSequence,
    scope: {
      rootSessionId: P6T2_ROOT,
      subject: { kind: 'instance', instanceId: W11_SUBJECT_INSTANCE },
      targetInstanceId: W11_SUBJECT_INSTANCE,
      actionName: 'follow-up',
      toolName: 'team_follow_up',
      correlation: W11_TOKEN,
    },
  }
}

/**
 * One W11 world, driven through the REAL entry point.
 *
 * @param basename - the scratch world name.
 * @param targetInstanceId - the instance the call targets (A, B or C).
 * @returns the guard-plane decision, the tool-plane result, whether the runtime
 *   facade was reached, and whether the durable row really is a corrupt leg.
 */
async function w11Leg(
  basename: string,
  targetInstanceId: string,
): Promise<{
  readonly error: string
  readonly reason: string
  readonly requestId: string
  readonly toolStatus: string
  readonly toolReason: string
  readonly facadeReached: number
  readonly consumptions: number
  readonly caseRead: string
  readonly problem: string
}> {
  const env = await createP6T6World(basename, ['leader', 'worker', 'worker2', 'scout'])
  try {
    const performed: string[] = []
    const runtimeSpy: TeamRuntime = {
      ...env.runtime,
      performAction: (request) => {
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
          return Promise.reject(new Error(`a4cl-w11: no caller for '${sessionId}'`))
        }
        return Promise.resolve({ caller, rootSessionId: P6T2_ROOT })
      },
    })
    const followUp = tools.find((tool) => tool.name === 'team_follow_up')
    if (followUp === undefined) throw new Error('a4cl-w11: team_follow_up is not registered')
    const ledger = env.world.domain.repositories.ledger
    const sequence = await ledger.allocateSequence()
    await ledger.put({
      schemaVersion: 2,
      sequence,
      rootSessionId: P6T2_ROOT,
      factType: 'control-request-recorded',
      payload: w11ContradictoryRow(),
      createdAt: P6T2_NOW,
    })
    await ledger.put({
      schemaVersion: 2,
      sequence: await ledger.allocateSequence(),
      rootSessionId: P6T2_ROOT,
      factType: 'control-decision-recorded',
      payload: w11DenyRow(sequence),
      createdAt: P6T2_NOW,
    })
    // The premise, measured in the same world: the strict reader refused the
    // row and the reporting route files it as a corrupt leg. Without this the
    // refusal below could be attributed to a readable row instead.
    const caseRead = await env.control.readApprovalCaseState({
      rootSessionId: P6T2_ROOT,
      approvalCaseId: CASE_ID,
    })
    const guardScope = {
      rootSessionId: P6T2_ROOT,
      targetInstanceId,
      actionName: 'follow-up',
      toolName: 'team_follow_up',
      correlation: W11_TOKEN,
    } as const
    // PLANE 1 — the producer's own verdict. `no-request` exists ONLY here; it is
    // the one reason the tool plane proceeds on, which is the whole hazard this
    // file exists for.
    const verdict = await env.control.guardOperation(guardScope)
    // PLANE 2 — the real tool entry: `executeGuarded` calls the REAL
    // `consultGuard` with this scope, and on proceed it calls the runtime
    // facade (the spy below is what "proceeded" MEANS, not a status string).
    const result = await followUp.execute(
      {
        rootSessionId: P6T2_ROOT,
        targetInstanceId,
        requestToken: W11_TOKEN,
        prompt: 'a4cl-w11 prompt',
        taskSummary: 'a4cl-w11 scenario',
      },
      execFor(P6T2_ROOT),
    )
    const reasonField = (result as { readonly reason?: unknown }).reason
    return {
      error: 'none',
      reason: verdict.allowed ? 'ALLOWED' : verdict.reason,
      // The refusal must point at the row the operator has to read — and it may
      // only ever name an identity the damaged payload actually disclosed.
      requestId:
        !verdict.allowed && verdict.requestId !== undefined ? verdict.requestId : 'none',
      toolStatus: String(result.status),
      toolReason: typeof reasonField === 'string' ? reasonField : 'none',
      facadeReached: performed.filter((action) => action === 'follow-up').length,
      consumptions: (await env.control.listControlState(P6T2_ROOT)).consumptions.length,
      caseRead: caseRead.kind,
      problem: caseRead.kind === 'problem' ? caseRead.problem : 'none',
    }
  } catch (error: unknown) {
    return {
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      reason: 'threw',
      requestId: 'threw',
      toolStatus: 'threw',
      toolReason: 'threw',
      facadeReached: 0,
      consumptions: 0,
      caseRead: 'threw',
      problem: 'threw',
    }
  } finally {
    await destroyP6T1World(env.world)
  }
}

const w11SubjectTarget = await w11Leg('a4cl-w11-target-subject', W11_SUBJECT_INSTANCE)
const w11LegacyTarget = await w11Leg('a4cl-w11-target-legacy', W11_LEGACY_INSTANCE)
const w11OtherTarget = await w11Leg('a4cl-w11-target-other', W11_OTHER_INSTANCE)

describe('A4 corrupt control leg — the guard must never see LESS than the ledger holds', () => {

  it('W1: a leg whose authority point is present-but-malformed is refused by name, never as no-request', () => {
    expect(w1.error).toBe('none')
    expect(w1.consult).toEqual({
      proceed: false,
      reason: CONTROL_GUARD_BLOCK_REASONS.AUTHORITY_SCOPE_UNBOUND,
      // The refusal names the row the operator has to look at — read from the
      // damaged payload, never invented.
      requestId: 'req-a4cl-w1',
    })
    expect(w1.consumptions).toBe(0)
  })

  it('W2: a durable DENY survives the corruption of the leg it refuses (zero side effects)', () => {
    expect(w2.error).toBe('none')
    expect(w2.consult).toEqual({
      proceed: false,
      reason: CONTROL_GUARD_BLOCK_REASONS.AUTHORITY_SCOPE_UNBOUND,
      requestId: 'req-a4cl-w2',
    })
    expect(w2.consumptions).toBe(0)
    // A refusal must write NOTHING: no consumption, no terminal fact, no repair.
    expect(w2.ledgerRows).toBe(0)
  })

  it('W3: an allow over an unreadable point cannot be spent and is not burned', () => {
    expect(w3.error).toBe('none')
    expect(w3.consult).toEqual({
      proceed: false,
      reason: CONTROL_GUARD_BLOCK_REASONS.AUTHORITY_SCOPE_UNBOUND,
      requestId: 'req-a4cl-w3',
    })
    expect(w3.consumptions).toBe(0)
  })

  it('W4: a leg broken in some OTHER member, with NO authority point to read, is refused by the same name', () => {
    expect(w4.error).toBe('none')
    // The row is an operation case (readable fingerprint) whose `legOrdinal` is
    // junk, and it discloses no authority point. The guard cannot attribute the
    // damage to a member — parse stopped somewhere it cannot retrace — so what
    // it can say is the one thing it verified: the allow over this leg has no
    // point to bind to. That is the SAME fact, and therefore the SAME name, that
    // the readable-row path gives (`a4p7-a1-14-consumption-revalidation` A4).
    expect(w4.consult).toEqual({
      proceed: false,
      reason: CONTROL_GUARD_BLOCK_REASONS.AUTHORITY_SCOPE_UNBOUND,
      requestId: 'req-a4cl-w4',
    })
    expect(w4.consumptions).toBe(0)
  })

  it('W4b: a leg broken elsewhere whose authority point IS readable is refused as undetermined', () => {
    expect(w4b.error).toBe('none')
    // The other cell of the table: nothing is wrong with the point here, so the
    // honest statement is not "no authority" but "the governing leg could not be
    // reconstructed" — `authority-undetermined`, whose law is that an unreadable
    // document is never an empty one.
    expect(w4b.consult).toEqual({
      proceed: false,
      reason: CONTROL_GUARD_BLOCK_REASONS.AUTHORITY_UNDETERMINED,
      requestId: 'req-a4cl-w4b',
    })
    expect(w4b.consumptions).toBe(0)
  })

  it('W5: the PRODUCER never answers no-request for a leg it could not read, and still does for an empty ledger', () => {
    // The polarity law, pinned where it is produced. `no-request` is the single
    // reason `packages/tools/src/guard.ts` proceeds on; it must mean "there is
    // nothing to guard" and never "I could not read what guards this call".
    expect(w5CorruptPoint.reason, 'unreadable point').not.toBe(
      CONTROL_GUARD_BLOCK_REASONS.NO_REQUEST,
    )
    expect(w5CorruptElsewhere.reason, 'damage in another member').not.toBe(
      CONTROL_GUARD_BLOCK_REASONS.NO_REQUEST,
    )
    expect(w5CorruptPoint.allowed).toBe(false)
    expect(w5CorruptElsewhere.allowed).toBe(false)
    // The legitimate side of the same verdict: with no control rows at all,
    // `no-request` is still the right answer — the fix must not eat it.
    expect(w5Clean.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.NO_REQUEST)
    expect(w5Clean.allowed).toBe(false)
  })

  it('W6: a genuinely un-requested call in a clean Team proceeds, exactly as before', () => {
    expect(w6.error).toBe('none')
    expect(w6.consult).toEqual({ proceed: true })
    expect(w6.consumptions).toBe(0)
    expect(w6.ledgerRows).toBe(0)
  })

  it('W7: a corrupt leg at a DIFFERENT scope does not freeze the Team', () => {
    expect(w7Correlation.error).toBe('none')
    expect(w7Action.error).toBe('none')
    expect(w7Tool.error).toBe('none')
    expect(w7Correlation.consult, 'a different correlation is a different request').toEqual({
      proceed: true,
    })
    expect(w7Action.consult, 'a different action is a different request').toEqual({ proceed: true })
    expect(w7Tool.consult, 'a different toolName is a different request').toEqual({ proceed: true })
  })

  it('W8-a (RULING 5-A behaviour change): a refused row that names no case but NAMES this call is filed, and is refused by name — never as no-request', () => {
    // This is the leg that was, until RULING 5-A, `{ proceed: true }`: the same
    // damage W1 files when a row names a case, on a row that names none, was not
    // filed at all — so the one verdict that means "proceed" answered for a call
    // its own durable leg governs. The row is an operation case whose authority
    // point is present-and-refused, which is the SAME fact W1 reports.
    expect(w8NamedCall.error).toBe('none')
    expect(w8NamedCall.consult).toEqual({
      proceed: false,
      reason: CONTROL_GUARD_BLOCK_REASONS.AUTHORITY_SCOPE_UNBOUND,
      requestId: 'req-a4cl-w8',
    })
    expect(w8NamedCall.producerReason).not.toBe(CONTROL_GUARD_BLOCK_REASONS.NO_REQUEST)
    // And it is on the record whether or not the guard acts on it.
    expect(w8NamedCall.corruptLegs).toEqual([
      { sequence: expect.any(Number), requestId: 'req-a4cl-w8', disclosesMember: true },
    ])
  })

  it('W8-b (DISCLOSED BOUNDARY, execution effect pending RULING 5-B): a refused row that names no case and discloses NO comparable member keeps today\'s no-request — and is named on the read plane', () => {
    // Split out of the old W8 so the two halves of the ruling cannot be confused:
    // filing changed this row's VISIBILITY and deliberately not its execution
    // effect. Blocking a row that cannot be attributed to any call is RULING 5-B,
    // a human safety-vs-availability decision; what this lane owes instead is
    // that the case is recognised — counted, named, and pinned by a name that
    // says which way the effect is expected to move.
    expect(w8NoMember.error).toBe('none')
    expect(w8NoMember.consult).toEqual({ proceed: true })
    expect(w8NoMember.producerReason).toBe(CONTROL_GUARD_BLOCK_REASONS.NO_REQUEST)
    expect(w8NoMember.corruptLegs).toEqual([
      { sequence: expect.any(Number), requestId: 'req-a4cl-w8b', disclosesMember: false },
    ])
  })

  it('W9: the reporting routes still name the corrupt leg, and neither one gates execution', () => {
    expect(w9.caseReadKind).toBe('problem')
    expect(w9.caseReadProblem).toBe('chain-broken')
    expect(w9.caseReadSequence).toBeGreaterThan(0)
    // The open list skips the corrupt case (documented behaviour of the read
    // plane) — which is exactly WHY the guard route needed its own refusal.
    expect(w9.openCases).toBe(0)
  })

  it('W10: the TOOL-plane claim, named — a corrupt leg plus a durable DENY never reaches the facade', () => {
    // The plane distinction this file exists to keep honest. `executeGuarded`
    // consults the guard ONLY for an instance-shaped target and, on proceed,
    // does nothing but call the runtime facade — so "the guard did not stop it"
    // (base) and "the operation succeeded" are different claims. What this leg
    // pins is the seam this lane owns: with the fix, the call is refused by the
    // guard and the facade is never reached.
    expect(w10.error ?? 'none').toBe('none')
    expect(w10.status, `facade said: ${w10.facadeOutcome}`).toBe('blocked')
    // A row with no operation fingerprint is not an OPERATION CASE (the identity
    // law this file already applies), so the honest name is `undetermined`.
    expect(w10.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.AUTHORITY_UNDETERMINED)
    expect(w10.facadeReached).toBe(0)
    expect(w10.consumptions).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// W11 — the assertions.
// ---------------------------------------------------------------------------

/** Everything one W11 leg observed, in ONE object: the producer's verdict, the
 *  row it named, and what the tool plane actually did with the call. Asserted
 *  as a unit so a failure shows the whole consequence (vanishing constraint →
 *  facade reached), not just the first field that moved. */
function w11Observed(leg: Awaited<ReturnType<typeof w11Leg>>) {
  return {
    verdict: leg.reason,
    namesRow: leg.requestId,
    toolStatus: leg.toolStatus,
    facadeReached: leg.facadeReached,
    allowConsumptions: leg.consumptions,
  }
}

describe('W11 a corrupt leg that names TWO instances rules out NEITHER of them', () => {
  // The premise, shared by all three legs and measured in the world that
  // answers: the row is a CORRUPT LEG (the reader refused it and the reporting
  // route files it), and the human's DENY under it is durable and readable. If
  // any of these were false, the refusals below would be about something
  // other than the identity contradiction.
  it('W11-premise: the row is refused by the reader, filed as a corrupt leg, and its DENY survives', () => {
    expect(w11SubjectTarget.error).toBe('none')
    expect(w11LegacyTarget.error, 'the same row at instance B').toBe('none')
    expect(w11OtherTarget.error, 'the same row at instance C').toBe('none')
    // `found` would mean the STRICT READER accepted the row — then this file
    // would be testing the readable-row path, not the corrupt-leg guard.
    expect(w11SubjectTarget.caseRead, 'the ambiguous-identity row must not read as a case').toBe(
      'problem',
    )
    expect(w11SubjectTarget.problem).not.toBe('none')
  })

  it('W11-a: a call on the instance named by `subject` is refused by name, not ruled out', () => {
    // Green before the fix and after it: this is the one identity field the old
    // code read. The leg stays so the fix's two-sidedness is visible — the law
    // cannot be satisfied by making the row govern NOTHING.
    expect(w11Observed(w11SubjectTarget), `the tool said: ${w11SubjectTarget.toolReason}`).toEqual(
      {
        verdict: CONTROL_GUARD_BLOCK_REASONS.AUTHORITY_UNDETERMINED,
        namesRow: 'req-a4cl-w11',
        toolStatus: 'blocked',
        facadeReached: 0,
        allowConsumptions: 0,
      },
    )
  })

  it('W11-b: a call on the instance named by the legacy `targetInstanceId` is refused TOO (the counterexample)', () => {
    // THE REPRODUCTION. On the pre-fix code this call is GREEN-LIT: the only
    // identity read was `subject` (= A), which disagrees with this call (B),
    // and a disagreement is the answer that RULES THE ROW OUT — so the producer
    // answered `no-request`, `consultGuard` mapped that to "proceed", the
    // runtime facade ran, and the recorded DENY vanished for exactly the other
    // call its own row names.
    expect(w11Observed(w11LegacyTarget), `the tool said: ${w11LegacyTarget.toolReason}`).toEqual({
      verdict: CONTROL_GUARD_BLOCK_REASONS.AUTHORITY_UNDETERMINED,
      namesRow: 'req-a4cl-w11',
      toolStatus: 'blocked',
      facadeReached: 0,
      allowConsumptions: 0,
    })
  })

  it('W11-c: a call on an instance NEITHER field names proceeds (the anti-freeze half)', () => {
    // Both disclosures DISAGREE, and that is positive evidence the row governs
    // some OTHER call. A fix that refuses here has not narrowed anything: it
    // has let one damaged row freeze the Team, which is the failure mode this
    // guard's own law rules out. This leg is green BEFORE the fix and must be
    // green after it — it is the leg that proves which direction moved.
    expect(w11Observed(w11OtherTarget), `the tool said: ${w11OtherTarget.toolReason}`).toEqual({
      // `no-request` is the producer's honest answer here, and the ONE reason
      // the tool plane proceeds on: this row is ruled out, nothing else exists.
      verdict: CONTROL_GUARD_BLOCK_REASONS.NO_REQUEST,
      namesRow: 'none',
      toolStatus: 'executed',
      facadeReached: 1,
      allowConsumptions: 0,
    })
  })
})

// ---------------------------------------------------------------------------
// W12 — RULING 5-A (external review W8): FILING may not depend on the case id.
//
// `loadControlState` filed a refused `control-request-recorded` row into
// `corruptLegs` ONLY when the damaged payload still carried a readable
// `approvalCaseId`. Candidacy (`corruptLegCouldGovern`) deliberately refuses to
// trust that field — it compares the five MEMBERS a row discloses — so the
// guard's state space was narrower than reality's, one level above W11: a
// refused row that named its scope but not its case was invisible to the read
// plane and invisible to the guard, and the call its OWN row governs was
// answered `no-request`, which `packages/tools/src/guard.ts` maps to "proceed".
//
// RULING 5-A: file EVERY refused row whose payload is an inspectable plain
// object, regardless of `approvalCaseId`; candidacy stays exactly where it is,
// in the member algebra. The three outcomes stay distinct:
//
//   some member positively DISAGREES  -> ruled out       -> `no-request` (legit);
//   >=1 member, none disagrees        -> candidate       -> BLOCKED (new here);
//   no comparable member disclosed    -> unattributable  -> reported, NOT blocked.
//
// The third line is the boundary RULING 5-B reserves to a human (blocking there
// is a safety-vs-availability call), so it is kept, counted and NAMED — never
// merely invisible. Every leg below drives the REAL `team_follow_up.execute`
// with a runtime spy, as W11 does: `no-request` exists only on the producer's
// plane, and the claim under test is what the tool plane DID.
// ---------------------------------------------------------------------------

const W12_TOKEN = 'tok-a4cl-w12'
/** A token no row on these ledgers names: the genuinely ungoverned call. */
const W12_OTHER_TOKEN = 'tok-a4cl-w12-ungoverned'
const W12_INSTANCE = String(P6T2_SEEDS.worker.instanceId)

/**
 * THE ROW: refused by the strict reader, names NO case, and names this call.
 *
 * Its damage is `authorityScope` present-and-malformed — the very damage W1
 * files whenever a row happens to carry a case id — and the only thing it omits
 * is `approvalCaseId`. Under the pre-5-A filing rule that omission erased the
 * row: the reader refused it, the filing rule did not want it, and nothing
 * downstream ever knew a leg was on the ledger. It carries no operation
 * fingerprint because that is the scope `packages/tools/src/tools.ts` sends
 * (W10's note), so the honest refusal name is the one that says the governing
 * leg could not be reconstructed.
 */
function w12RefusedRow(overrides: { readonly correlation?: string } = {}): Record<string, unknown> {
  return {
    requestId: 'req-a4cl-w12',
    kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
    requester: { kind: 'instance', instanceId: W12_INSTANCE, role: 'member' },
    subject: { kind: 'instance', instanceId: W12_INSTANCE },
    targetInstanceId: W12_INSTANCE,
    actionName: 'follow-up',
    toolName: 'team_follow_up',
    correlation: overrides.correlation ?? W12_TOKEN,
    executionCoupling: 'guarded',
    authorityScope: SCOPE_SUBTREE,
  }
}

/** The same refused row that DOES name a case — the population the old filing
 *  rule accepted, kept here as the other half of the reported set (W12-d). */
function w12CaseNamedRow(): Record<string, unknown> {
  return {
    ...w12RefusedRow(),
    approvalCaseId: CASE_ID,
    legOrdinal: 1,
    reviewAuthority: 'leader',
    requiredAuthorityAtCreation: 'leader',
    beneficiaryAuthority: 'member',
    requestedEffect: 'allow',
  }
}

/**
 * THE ROW THAT DISCLOSES NOTHING: every field the candidacy algebra reads is
 * PRESENT AND UNREADABLE. That is the only way a row can say nothing about all
 * five members at once — an ABSENT member is a positive disagreement against a
 * non-empty call, and a disagreement is what rules a row OUT (the anti-freeze
 * rule W7/W11-c pin). So this row cannot be attributed to any call by anyone,
 * and blocking on it is RULING 5-B's decision, not this lane's.
 */
function w12UnattributableRow(): Record<string, unknown> {
  return {
    requestId: 'req-a4cl-w12-noise',
    kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
    requester: { kind: 'instance', instanceId: W12_INSTANCE, role: 'member' },
    subject: { kind: 'instance' },
    targetInstanceId: 42,
    actionName: 42,
    toolName: 42,
    correlation: 42,
    operationFingerprint: 42,
    executionCoupling: 'guarded',
  }
}

/**
 * One entry of the RULING 5-A read surface, as DATA.
 *
 * Deliberately a LOCAL structural type, not an import of the service's record
 * type: importing a type the pre-5-A service does not export would kill the
 * whole module at import time, and the RED run would report a load failure
 * instead of the assertion diff that IS the finding.
 */
type CorruptLegView = {
  readonly sequence: number
  readonly requestId?: string
  readonly approvalCaseId?: string
  readonly disclosesMember: boolean
}

/** The reported corrupt legs of one control read, projected and defaulted.
 *  Defaulting to `[]` is what lets a PRE-5-A build answer "the read plane
 *  reported nothing" — the finding — rather than crash inside the harness. */
function corruptLegsOf(listed: unknown): readonly CorruptLegView[] {
  const legs = (listed as { readonly corruptLegs?: readonly CorruptLegView[] }).corruptLegs ?? []
  return legs.map((leg) => ({
    sequence: leg.sequence,
    ...(leg.requestId !== undefined ? { requestId: leg.requestId } : {}),
    ...(leg.approvalCaseId !== undefined ? { approvalCaseId: leg.approvalCaseId } : {}),
    disclosesMember: leg.disclosesMember,
  }))
}

/**
 * One W12 world: seed the rows, consult BOTH planes of one real call, read the
 * ledger back through the read plane. Mirrors `w11Leg` so the two groups are
 * comparable leg for leg; the difference is only ever the row.
 */
async function w12Leg(
  basename: string,
  rows: readonly Record<string, unknown>[],
  call: { readonly targetInstanceId: string; readonly correlation: string },
): Promise<{
  readonly error: string
  readonly verdict: string
  readonly namesRow: string
  readonly toolStatus: string
  readonly toolReason: string
  readonly facadeReached: number
  readonly consumptions: number
  readonly readableRequestRows: number
  readonly durableRequestRows: number
  readonly corruptLegs: readonly CorruptLegView[]
}> {
  const env = await createP6T6World(basename, ['leader', 'worker', 'worker2', 'scout'])
  try {
    const performed: string[] = []
    const runtimeSpy: TeamRuntime = {
      ...env.runtime,
      performAction: (request) => {
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
          return Promise.reject(new Error(`a4cl-w12: no caller for '${sessionId}'`))
        }
        return Promise.resolve({ caller, rootSessionId: P6T2_ROOT })
      },
    })
    const followUp = tools.find((tool) => tool.name === 'team_follow_up')
    if (followUp === undefined) throw new Error('a4cl-w12: team_follow_up is not registered')
    const ledger = env.world.domain.repositories.ledger
    for (const payload of rows) {
      await ledger.put({
        schemaVersion: 2,
        sequence: await ledger.allocateSequence(),
        rootSessionId: P6T2_ROOT,
        factType: 'control-request-recorded',
        payload,
        createdAt: P6T2_NOW,
      })
    }
    const guardScope = {
      rootSessionId: P6T2_ROOT,
      targetInstanceId: call.targetInstanceId,
      actionName: 'follow-up',
      toolName: 'team_follow_up',
      correlation: call.correlation,
    } as const
    // PLANE 1 — the producer's verdict (the only plane where `no-request`
    // exists); PLANE 2 — the real tool entry, whose proceed path is the spy.
    const verdict = await env.control.guardOperation(guardScope)
    const result = await followUp.execute(
      {
        rootSessionId: P6T2_ROOT,
        targetInstanceId: call.targetInstanceId,
        requestToken: call.correlation,
        prompt: 'a4cl-w12 prompt',
        taskSummary: 'a4cl-w12 scenario',
      },
      execFor(P6T2_ROOT),
    )
    const listed = await env.control.listControlState(P6T2_ROOT)
    const reasonField = (result as { readonly reason?: unknown }).reason
    return {
      error: 'none',
      verdict: verdict.allowed ? 'ALLOWED' : verdict.reason,
      namesRow: !verdict.allowed && verdict.requestId !== undefined ? verdict.requestId : 'none',
      toolStatus: String(result.status),
      toolReason: typeof reasonField === 'string' ? reasonField : 'none',
      facadeReached: performed.filter((action) => action === 'follow-up').length,
      consumptions: listed.consumptions.length,
      readableRequestRows: listed.requests.length,
      durableRequestRows: ledger
        .list()
        .filter((entry) => String(entry.factType) === 'control-request-recorded').length,
      corruptLegs: corruptLegsOf(listed),
    }
  } catch (error: unknown) {
    return {
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      verdict: 'threw',
      namesRow: 'threw',
      toolStatus: 'threw',
      toolReason: 'threw',
      facadeReached: 0,
      consumptions: 0,
      readableRequestRows: 0,
      durableRequestRows: 0,
      corruptLegs: [],
    }
  } finally {
    await destroyP6T1World(env.world)
  }
}

/** What one W12 leg observed, asserted as ONE object so a failure shows the
 *  whole consequence (vanished constraint -> facade reached), not one field. */
function w12Observed(leg: Awaited<ReturnType<typeof w12Leg>>) {
  return {
    verdict: leg.verdict,
    namesRow: leg.namesRow,
    toolStatus: leg.toolStatus,
    facadeReached: leg.facadeReached,
    allowConsumptions: leg.consumptions,
  }
}

/** The call under test names W12_TOKEN; the row names it too (the counterexample). */
const w12NamedCall = await w12Leg('a4cl-w12-caseless-named', [w12RefusedRow()], {
  targetInstanceId: W12_INSTANCE,
  correlation: W12_TOKEN,
})
/** The same refused row for a call it does NOT name (the anti-freeze control). */
const w12OtherCall = await w12Leg(
  'a4cl-w12-caseless-other-call',
  [w12RefusedRow({ correlation: 'tok-a4cl-w12-some-other-call' })],
  { targetInstanceId: W12_INSTANCE, correlation: W12_TOKEN },
)
/** A refused row that discloses no comparable member at all. */
const w12Unattributable = await w12Leg('a4cl-w12-caseless-noise', [w12UnattributableRow()], {
  targetInstanceId: W12_INSTANCE,
  correlation: W12_TOKEN,
})
/** Both reported classes on one ledger, and a call neither row governs. */
const w12BothClasses = await w12Leg(
  'a4cl-w12-both-classes',
  [w12CaseNamedRow(), w12UnattributableRow()],
  { targetInstanceId: W12_INSTANCE, correlation: W12_OTHER_TOKEN },
)

describe('W12 a refused row that names NO case is a leg on the ledger too (RULING 5-A)', () => {
  it('W12-premise: every row below is durable, refused by the strict reader, and read as no request at all', () => {
    expect(w12NamedCall.error).toBe('none')
    expect(w12OtherCall.error, 'the anti-freeze world').toBe('none')
    expect(w12Unattributable.error, 'the unattributable world').toBe('none')
    expect(w12BothClasses.error, 'the both-classes world').toBe('none')
    // The rows are ON the ledger and NONE of them is a readable request row: if
    // any of these were false, the verdicts below would be about a readable row
    // and not about filing.
    expect(w12NamedCall.durableRequestRows).toBe(1)
    expect(w12NamedCall.readableRequestRows, 'refused, so never a request').toBe(0)
    expect(w12Unattributable.durableRequestRows).toBe(1)
    expect(w12Unattributable.readableRequestRows).toBe(0)
    expect(w12BothClasses.durableRequestRows).toBe(2)
    expect(w12BothClasses.readableRequestRows).toBe(0)
  })

  it('W12-a (RULING 5-A, the counterexample): a refused row that names no case but NAMES this call blocks the call its own row governs', () => {
    // THE REPRODUCTION. Pre-5-A this call is GREEN-LIT on the real tool entry:
    // the row was refused by the reader, the filing rule wanted a case id the
    // row does not have, so the row was in neither `requests` nor `corruptLegs`,
    // the producer answered `no-request`, `consultGuard` mapped that to
    // "proceed", and the runtime facade ran. Post-5-A the row is filed, every
    // member it discloses agrees with this call, and candidacy fails closed.
    expect(w12Observed(w12NamedCall), `the tool said: ${w12NamedCall.toolReason}`).toEqual({
      verdict: CONTROL_GUARD_BLOCK_REASONS.AUTHORITY_UNDETERMINED,
      namesRow: 'req-a4cl-w12',
      toolStatus: 'blocked',
      facadeReached: 0,
      allowConsumptions: 0,
    })
  })

  it('W12-b: the same refused row at a call it does NOT name still proceeds (the anti-freeze half)', () => {
    // The correlation member positively DISAGREES: that is evidence the row
    // governs some OTHER call, which is the only reading that keeps one damaged
    // row from freezing the Team. Green before 5-A and green after — the leg
    // that proves which direction moved.
    expect(w12Observed(w12OtherCall), `the tool said: ${w12OtherCall.toolReason}`).toEqual({
      verdict: CONTROL_GUARD_BLOCK_REASONS.NO_REQUEST,
      namesRow: 'none',
      toolStatus: 'executed',
      facadeReached: 1,
      allowConsumptions: 0,
    })
  })

  it('W12-c (DISCLOSED BOUNDARY, execution effect pending RULING 5-B): a refused row that discloses NO comparable member is counted and named on the read plane, and does not block', () => {
    // The third outcome, kept distinct on purpose. This row states all five
    // members and discloses none of them, so no ruling of this lane may make it
    // block — that is the safety-vs-availability call RULING 5-B reserves to a
    // human. What 5-A DOES require is that the case is recognised rather than
    // accidental: the call proceeds AND the fault is on the read plane, with
    // this leg's name recording which way the execution effect is expected to
    // move when 5-B lands.
    expect(w12Observed(w12Unattributable), `the tool said: ${w12Unattributable.toolReason}`).toEqual(
      {
        verdict: CONTROL_GUARD_BLOCK_REASONS.NO_REQUEST,
        namesRow: 'none',
        toolStatus: 'executed',
        facadeReached: 1,
        allowConsumptions: 0,
      },
    )
    // The loudness half: RED before 5-A because nothing reported it at all.
    expect(w12Unattributable.corruptLegs).toEqual([
      {
        sequence: expect.any(Number),
        requestId: 'req-a4cl-w12-noise',
        disclosesMember: false,
      },
    ])
  })

  it('W12-d: the read plane counts the WHOLE refused set, case-naming and case-less alike, and the count gates nothing', () => {
    // The shape W9 pinned, extended: a report, ordered by durable sequence,
    // never a gate. The call here is named by neither row (its correlation
    // appears nowhere), so it proceeds while BOTH faults stay on the record.
    expect(w12BothClasses.corruptLegs).toEqual([
      {
        sequence: expect.any(Number),
        requestId: 'req-a4cl-w12',
        approvalCaseId: CASE_ID,
        disclosesMember: true,
      },
      {
        sequence: expect.any(Number),
        requestId: 'req-a4cl-w12-noise',
        disclosesMember: false,
      },
    ])
    expect(w12Observed(w12BothClasses), `the tool said: ${w12BothClasses.toolReason}`).toEqual({
      verdict: CONTROL_GUARD_BLOCK_REASONS.NO_REQUEST,
      namesRow: 'none',
      toolStatus: 'executed',
      facadeReached: 1,
      allowConsumptions: 0,
    })
  })
})
