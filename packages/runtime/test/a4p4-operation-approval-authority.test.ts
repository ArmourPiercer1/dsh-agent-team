/**
 * a4p4-operation-approval-authority.test.ts — A4-PR4 lane A (plan Task 4,
 * spec §7.2-§7.4, §10.1, §12, acceptance §21.4).
 *
 * THE LAW UNDER TEST: an operation `ask` routes to the MINIMUM AUTHORITY that
 * can sign it, derived from the authority documents — not from the role of
 * whoever happens to be holding the keyboard. Concretely:
 *
 *  A1  a Member's ask answers at LEADER on the ladder default, and an absent
 *      document does NOT cause a rise (spec §7.4.1's first case; ADR A5-16:
 *      "no rule" is not "no authority");
 *  A2  the rise to HUMAN USER happens exactly when the effect exceeds the
 *      LEADER's `grantCeiling` (the carrier document caps this scope below
 *      `allow`) — never because a rule is missing;
 *  A3  a hard ceiling that caps the scope below `allow` rises past Human User
 *      too (the Human User is bound by the SAME hard document), landing on
 *      HUMAN ADMIN;
 *  A4  a LEADER's own ask starts at HUMAN USER (the rung above the
 *      beneficiary, never the beneficiary's own);
 *  A5  an ask with no rung above it (Human Admin) is a REFUSAL to name a
 *      reviewer, not a routing answer;
 *  A6/A7 an undetermined narrowing carries NO POSITION. No `requiredAuthority`
 *      field exists on that arm — a caller that reads it unconditionally gets a
 *      compile error, and a routing instruction minted from an unevaluable
 *      document is the defect ADR A1-7 exists to prevent;
 *  A8  the pre-v3 answer (the plane had nothing to say) is the FROZEN legacy
 *      routing, byte-identically;
 *  A9  `direct` — the acting rung already holds the required rung over its own
 *      beneficiary, so no case is opened (and §21.4's "no self/same-level
 *      allow" is why a case is the WRONG answer, not merely an unnecessary one);
 *  A10-A13 the durable consequences: the case leg records the DERIVED rung and
 *      the legacy kind rides as a carrier; an undetermined routing writes
 *      NOTHING durable; an authority with no resolver closes at creation
 *      instead of leaving a pending leg (ADR A1-12); and with no port wired
 *      the pre-existing v1/v2 row is unchanged down to its absent leg fields;
 *  A14-A16 the production facts READER (the adapter that feeds this lane its
 *      documents): the plane's pair passes through BY IDENTITY and a pre-v3
 *      read is `undefined` = the legacy arm; a Leader install is never routed
 *      off a member-beneficiary document set (that would UNDER-ask — the one
 *      forbidden direction) and does not even read the documents; and the
 *      port's `actor` argument stays plumbing, never routing input.
 *
 * RED-EVIDENCE NOTE (honest, not implied): the adapter-level cases (A10-A13)
 * are the lane's RED — they fail on the base commit because the v3 arm did not
 * exist. The pure-routing cases (A1-A9) were authored with the module in the
 * same step, so their falsifiability comes from the MUTATION PROOFS recorded
 * in `dev/agent-workflow/evidence/a4-pr4/red-captures/` (each one flips
 * production only and reddens the case that names it), not from a RED run.
 *
 * RUNNER CONSTRAINTS (this repo's plain-node shim — see the a5a header): every
 * async scenario runs at module level with top-level await and captures its
 * results; the `it` bodies are synchronous assertions.
 *
 * SELF-CLEANLINESS: inside the P4-T6 whole-tree scanner's scope
 * (`packages/**`); no legacy Team SessionEvent denylist token appears.
 *
 * @module @dsh-agent-team/runtime/test/a4p4-operation-approval-authority
 */
import { describe, expect, it } from 'vitest'
import { createControlService } from '../control/index.js'
import type { ControlRequestRecord, ControlService } from '../control/index.js'
import {
  installParameterPermissionListener,
  routeOperationApproval,
} from '../operation-permission/index.js'
import {
  OPERATION_APPROVAL_REFUSAL_REASONS,
  createOperationApprovalFactsReader,
} from '../operation-permission/index.js'
import type {
  OperationApprovalFacts,
  PreExecuteExec,
  PreToolDecisionLike,
} from '../operation-permission/index.js'
import type { AuthorityEnvelope } from '../../domain/authority-envelope/src/index.js'
// The document-PAIR shape is the runtime lane's (one slot per document, each
// declared/absent/unavailable) — `governance/index.js`, not the domain module.
import type { AuthorityEnvelopeDocuments } from '../governance/index.js'
import type { TemplatePermissionPolicy } from '../../domain/blueprint/src/index.js'
import type { P6T1World } from './p6t1-helpers.js'
import {
  P6T4_NOW,
  P6T4_ROOT,
  P6T4_SEEDS,
  createP6T4World,
  destroyP6T1World,
  memberCaller,
} from './p6t4-helpers.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)

/** The canonical key the fake resolver produces for `fileA.txt`. */
const FILE_A_KEY = 'file:///fileA.txt'

// ---------------------------------------------------------------------------
// The document fixtures (canonical RUNTIME shape — the plane's output form).
// ---------------------------------------------------------------------------

/** A declared document that narrows nothing. */
const PERMISSIVE: AuthorityEnvelope = { rules: [] }

/** A declared document that caps one operation class+resource at `ask`. */
function cappedAtAsk(operationClass: string, resource: string): AuthorityEnvelope {
  return {
    rules: [
      {
        operationClass,
        matcher: { kind: 'exact', resource },
        maximumEffect: 'ask',
      },
    ],
  }
}

/** A declared hard document that caps a SUBTREE containing the resource. */
function subtreeCappedAtAsk(operationClass: string, root: string): AuthorityEnvelope {
  return {
    rules: [
      {
        operationClass,
        matcher: { kind: 'subtree', resource: root },
        maximumEffect: 'ask',
      },
    ],
  }
}

const ABSENT_PAIR: AuthorityEnvelopeDocuments = {
  teamHardEnvelope: { status: 'absent' },
  permissionMutationEnvelope: { status: 'absent' },
}

function docs(
  hard: AuthorityEnvelopeDocuments['teamHardEnvelope'],
  carrier: AuthorityEnvelopeDocuments['permissionMutationEnvelope'],
): AuthorityEnvelopeDocuments {
  return { teamHardEnvelope: hard, permissionMutationEnvelope: carrier }
}

// ---------------------------------------------------------------------------
// A1-A9 — the pure routing (same facts, same answer; no I/O).
// ---------------------------------------------------------------------------

const a1 = routeOperationApproval({
  operationClass: 'read',
  resourceKey: FILE_A_KEY,
  initiatorAuthority: 'member',
  facts: { beneficiaryAuthority: 'member', documents: ABSENT_PAIR },
})

const a2 = routeOperationApproval({
  operationClass: 'read',
  resourceKey: FILE_A_KEY,
  initiatorAuthority: 'member',
  facts: {
    beneficiaryAuthority: 'member',
    documents: docs(
      { status: 'declared', document: PERMISSIVE },
      { status: 'declared', document: cappedAtAsk('read', FILE_A_KEY) },
    ),
  },
})

const a3 = routeOperationApproval({
  operationClass: 'read',
  resourceKey: FILE_A_KEY,
  initiatorAuthority: 'member',
  facts: {
    beneficiaryAuthority: 'member',
    documents: docs(
      { status: 'declared', document: cappedAtAsk('read', FILE_A_KEY) },
      { status: 'declared', document: cappedAtAsk('read', FILE_A_KEY) },
    ),
  },
})

const a4 = routeOperationApproval({
  operationClass: 'read',
  resourceKey: FILE_A_KEY,
  initiatorAuthority: 'leader',
  facts: { beneficiaryAuthority: 'leader', documents: ABSENT_PAIR },
})

const a5 = routeOperationApproval({
  operationClass: 'read',
  resourceKey: FILE_A_KEY,
  initiatorAuthority: 'human-admin',
  facts: { beneficiaryAuthority: 'human-admin', documents: ABSENT_PAIR },
})

const a6 = routeOperationApproval({
  operationClass: 'read',
  resourceKey: FILE_A_KEY,
  initiatorAuthority: 'member',
  facts: {
    beneficiaryAuthority: 'member',
    // A subtree rule covers the resource, and NO containment predicate was
    // supplied: the narrowing cannot be decided, so nothing may be decided.
    documents: docs(
      { status: 'declared', document: subtreeCappedAtAsk('read', 'file:///') },
      { status: 'absent' },
    ),
  },
})

const a8 = routeOperationApproval({
  operationClass: 'read',
  resourceKey: FILE_A_KEY,
  initiatorAuthority: 'member',
  facts: undefined,
})

const a9 = routeOperationApproval({
  operationClass: 'read',
  resourceKey: FILE_A_KEY,
  // The LEADER acting on a member's operation: the required rung is Leader
  // and the acting rung IS Leader.
  initiatorAuthority: 'leader',
  facts: { beneficiaryAuthority: 'member', documents: ABSENT_PAIR },
})

// ---------------------------------------------------------------------------
// A14-A16 — the production facts READER (`createOperationApprovalFactsReader`),
// the adapter that hands this lane its documents. It is the only place in the
// lane that touches a port, and the rules it carries are governance, not
// plumbing: it is what decides whether the operation lane has ONE document
// source or two, and whether a Leader's ask can be routed off a
// member-beneficiary document set.
// ---------------------------------------------------------------------------

/** Every call the fake ceiling port received, in order (identity passthrough). */
const ceilingCalls: Array<{
  teamSessionId: string
  memberInstanceId: string
  actor: string
}> = []

/** Whether the fake port answers as a v3 Team or as a pre-v3/unknown one. */
let ceilingAnswersV3 = true

/** The pair the port hands over — asserted BY IDENTITY, never reconstructed. */
const READER_PAIR = docs(
  { status: 'declared', document: PERMISSIVE },
  { status: 'declared', document: PERMISSIVE },
)

const factsReader = createOperationApprovalFactsReader({
  ceiling: async (teamSessionId, memberInstanceId, actor) => {
    ceilingCalls.push({ teamSessionId, memberInstanceId, actor })
    // The shape `createAuthorityCeilingReader` produces (it also carries
    // `initiatorAuthority`, which this adapter must NOT consume).
    return ceilingAnswersV3
      ? { beneficiaryAuthority: 'member', initiatorAuthority: 'human-user', documents: READER_PAIR }
      : undefined
  },
})

const a14v3 = await factsReader({
  teamSessionId: P6T4_ROOT,
  memberInstanceId: WORKER_ID,
  actingAsLeader: false,
})
ceilingAnswersV3 = false
const a14pre = await factsReader({
  teamSessionId: P6T4_ROOT,
  memberInstanceId: WORKER_ID,
  actingAsLeader: false,
})
ceilingAnswersV3 = true
const callsBeforeLeaderProbe = ceilingCalls.length
const a15 = await factsReader({
  teamSessionId: P6T4_ROOT,
  memberInstanceId: WORKER_ID,
  actingAsLeader: true,
})
const leaderProbeReadDocuments = ceilingCalls.length > callsBeforeLeaderProbe

// ---------------------------------------------------------------------------
// The adapter harness (the a5a pattern + the v3 authority-facts port).
// ---------------------------------------------------------------------------

interface FakeAgentCtx {
  on: (event: string, listener: (exec: PreExecuteExec, next: () => Promise<PreToolDecisionLike>) => Promise<PreToolDecisionLike>) => () => void
  tools: { guard: (guard: (exec: { name: string }) => string | undefined) => () => void }
  trigger: (exec: PreExecuteExec, next: () => Promise<PreToolDecisionLike>) => Promise<PreToolDecisionLike>
}

function makeFakeAgentCtx(): FakeAgentCtx {
  const listeners: Array<(exec: PreExecuteExec, next: () => Promise<PreToolDecisionLike>) => Promise<PreToolDecisionLike>> = []
  const on = (
    event: string,
    listener: (exec: PreExecuteExec, next: () => Promise<PreToolDecisionLike>) => Promise<PreToolDecisionLike>,
  ): (() => void) => {
    listeners.push(listener)
    return () => {
      const index = listeners.indexOf(listener)
      if (index >= 0) listeners.splice(index, 1)
    }
  }
  return {
    on,
    tools: { guard: () => () => undefined },
    trigger: async (exec, next) => {
      const listener = listeners[0]
      if (listener === undefined) throw new Error('fake ctx: no listener registered')
      return listener(exec, next)
    },
  }
}

async function fakeResolve(path: string): Promise<{ readonly key: string; readonly display: string }> {
  const normalized = path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/{2,}/g, '/')
  return { key: `file:///${normalized}`, display: path }
}

function makeExec(args: {
  readonly name: string
  readonly arguments?: unknown
  readonly callId: string
  readonly signal?: AbortSignal
}): PreExecuteExec {
  return {
    callId: args.callId,
    name: args.name,
    arguments: args.arguments ?? {},
    signal: args.signal ?? new AbortController().signal,
  }
}

function makeNext(): { readonly fn: () => Promise<PreToolDecisionLike>; calls: () => number } {
  let count = 0
  return {
    fn: async (): Promise<PreToolDecisionLike> => {
      count += 1
      return { kind: 'allow' }
    },
    calls: () => count,
  }
}

const ASK_POLICY: TemplatePermissionPolicy = {
  default: 'deny',
  allow: [],
  ask: [{ tool: 'read', resource: { kind: 'any' } }],
  deny: [],
}

interface Env {
  readonly world: P6T1World
  readonly service: ControlService
  readonly ctx: FakeAgentCtx
  readonly observations: Record<string, unknown>[]
  readonly disposer: () => void
}

async function createEnv(
  basename: string,
  options: { readonly facts?: OperationApprovalFacts | undefined },
): Promise<Env> {
  const world = await createP6T4World(basename, ['leader', 'worker'])
  const service = createControlService({
    teamDomain: world.domain,
    blueprintCatalog: world.catalog,
    externalPolicyFacts: world.ports.externalPolicyFacts,
    now: () => P6T4_NOW,
    waitPollIntervalMs: 10,
  })
  const ctx = makeFakeAgentCtx()
  const observations: Record<string, unknown>[] = []
  const facts = options.facts
  const disposer = installParameterPermissionListener(ctx, {
    policy: ASK_POLICY,
    resolveTarget: fakeResolve,
    controlService: service,
    rootSessionId: P6T4_ROOT,
    caller: memberCaller(WORKER_ID),
    targetInstanceId: WORKER_ID,
    isLeader: false,
    ...(facts === undefined
      ? {}
      : {
          operationApprovalRouting: async (): Promise<OperationApprovalFacts | undefined> => facts,
        }),
    onObserve: (observation) => {
      observations.push(observation)
    },
  })
  return { world, service, ctx, observations, disposer }
}

/** Drive one ask and capture the caller outcome + the durable rows. */
async function driveAsk(
  env: Env,
  basename: string,
): Promise<{
  readonly decision: PreToolDecisionLike
  readonly reason: string
  readonly executed: number
  readonly requests: readonly ControlRequestRecord[]
  readonly decisionRows: number
  readonly pending: number
}> {
  // The wait is bounded: a case that stays pending surfaces as the abort
  // denial, so a scenario that must NOT wait fails loudly instead of hanging.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 40)
  const next = makeNext()
  const decision = await env.ctx.trigger(
    makeExec({ name: 'read', arguments: { file_path: 'fileA.txt' }, callId: `a4p4-${basename}`, signal: controller.signal }),
    next.fn,
  )
  clearTimeout(timer)
  const state = await env.service.listControlState(P6T4_ROOT)
  return {
    decision,
    reason: decision.kind === 'deny' ? decision.reason : '',
    executed: next.calls(),
    requests: state.requests,
    decisionRows: state.decisions.length,
    pending: state.requests.filter((r) => r.status === 'pending').length,
  }
}

// A10 — the leg records the DERIVED rung; the legacy kind is its carrier.
const a10 = await (async () => {
  const env = await createEnv('a4p4-a10', {
    facts: {
      beneficiaryAuthority: 'member',
      documents: docs(
        { status: 'declared', document: PERMISSIVE },
        { status: 'declared', document: cappedAtAsk('read', FILE_A_KEY) },
      ),
    },
  })
  try {
    return await driveAsk(env, 'a10')
  } finally {
    env.disposer()
    await destroyP6T1World(env.world)
  }
})()

// A11 — undetermined: zero durable rows, zero execution, no wait.
const a11 = await (async () => {
  const env = await createEnv('a4p4-a11', {
    facts: {
      beneficiaryAuthority: 'member',
      documents: docs(
        { status: 'declared', document: subtreeCappedAtAsk('read', 'file:///') },
        { status: 'absent' },
      ),
    },
  })
  try {
    return await driveAsk(env, 'a11')
  } finally {
    env.disposer()
    await destroyP6T1World(env.world)
  }
})()

// A12 — the required rung has no resolver: the case closes AT CREATION.
const a12 = await (async () => {
  const env = await createEnv('a4p4-a12', {
    facts: {
      beneficiaryAuthority: 'member',
      documents: docs(
        { status: 'declared', document: cappedAtAsk('read', FILE_A_KEY) },
        { status: 'declared', document: cappedAtAsk('read', FILE_A_KEY) },
      ),
    },
  })
  try {
    return await driveAsk(env, 'a12')
  } finally {
    env.disposer()
    await destroyP6T1World(env.world)
  }
})()

// A13 — no port wired: the frozen v1/v2 row, leg fields absent.
const a13 = await (async () => {
  const env = await createEnv('a4p4-a13', {})
  try {
    return await driveAsk(env, 'a13')
  } finally {
    env.disposer()
    await destroyP6T1World(env.world)
  }
})()

describe('a4p4 lane A — an ask routes to the minimum authority the documents require', () => {
  it('A1: a Member ask answers at Leader, and an absent document never causes a rise', () => {
    expect(a1.kind).toBe('approval-required')
    if (a1.kind !== 'approval-required') return
    expect(a1.requiredAuthority).toBe('leader')
    expect(a1.carrierKind).toBe('leader-approval')
    // The ladder default: nothing above it was consulted, because nothing rose.
    expect(a1.evidence.roseBecauseInsufficient).toEqual([])
    expect(a1.evidence.consideredRoles).toEqual(['leader'])
  })

  it('A2: the rise to Human User happens because the LEADER ceiling is exceeded, not because a rule is missing', () => {
    expect(a2.kind).toBe('approval-required')
    if (a2.kind !== 'approval-required') return
    expect(a2.requiredAuthority).toBe('human-user')
    expect(a2.carrierKind).toBe('user-approval')
    // The audit trail states the reason: Leader was consulted and was below.
    expect(a2.evidence.consideredRoles).toEqual(['leader', 'human-user'])
    expect(a2.evidence.roseBecauseInsufficient).toEqual(['leader'])
    // Positional binding: the Human User row never names the carrier document
    // (spec §7.4.1, ADR A5-1) — the row a beneficiary-keyed matrix cannot show.
    expect(a2.evidence.boundDocumentsByRole['human-user']).toEqual(['teamHardEnvelope'])
    expect(a2.evidence.boundDocumentsByRole['leader']).toEqual([
      'teamHardEnvelope',
      'permissionMutationEnvelope',
    ])
  })

  it('A3: a hard ceiling below the effect rises past Human User (bound by the SAME document) to Human Admin', () => {
    expect(a3.kind).toBe('approval-required')
    if (a3.kind !== 'approval-required') return
    expect(a3.requiredAuthority).toBe('human-admin')
    // The carrier is the human carrier of the legacy vocabulary — a carrier.
    expect(a3.carrierKind).toBe('user-approval')
    expect(a3.evidence.roseBecauseInsufficient).toEqual(['leader', 'human-user'])
  })

  it('A4: a Leader ask starts at Human User (the rung above the beneficiary)', () => {
    expect(a4.kind).toBe('approval-required')
    if (a4.kind !== 'approval-required') return
    expect(a4.requiredAuthority).toBe('human-user')
    expect(a4.evidence.consideredRoles).toEqual(['human-user'])
  })

  it('A5: an ask with no rung above it refuses to name a reviewer', () => {
    expect(a5.kind).toBe('authority-undetermined')
    if (a5.kind !== 'authority-undetermined') return
    expect(a5.reason).toBe(OPERATION_APPROVAL_REFUSAL_REASONS.DOCUMENT_BINDING_DEFECT)
    expect('requiredAuthority' in a5).toBe(false)
  })

  it('A6: an undecidable narrowing (a subtree rule, no containment predicate) is undetermined', () => {
    expect(a6.kind).toBe('authority-undetermined')
    if (a6.kind !== 'authority-undetermined') return
    expect(a6.reason).toBe(OPERATION_APPROVAL_REFUSAL_REASONS.CEILING_UNDETERMINED)
  })

  it('A7: no undetermined arm carries a position (a routing instruction cannot be minted from it)', () => {
    for (const arm of [a5, a6]) {
      expect('requiredAuthority' in arm).toBe(false)
      expect('carrierKind' in arm).toBe(false)
    }
  })

  it('A8: the plane having nothing to say is the FROZEN legacy routing, not a computed one', () => {
    expect(a8.kind).toBe('legacy')
    if (a8.kind !== 'legacy') return
    expect(a8.reason).toBe('not-authority-v3')
    expect('requiredAuthority' in a8).toBe(false)
  })

  it('A9: `direct` — the acting rung already holds the required rung, so no case exists to open', () => {
    expect(a9.kind).toBe('direct')
    if (a9.kind !== 'direct') return
    expect(a9.requiredAuthority).toBe('leader')
    expect(a9.beneficiaryAuthority).toBe('member')
    expect('carrierKind' in a9).toBe(false)
  })

  it('A10: the durable leg records the DERIVED rung and the legacy kind rides as carrier', () => {
    expect(a10.executed).toBe(0)
    expect(a10.requests).toHaveLength(1)
    const leg = a10.requests[0]
    if (leg === undefined) return
    // The carrier: the legacy kind that can CARRY a human review.
    expect(leg.kind).toBe('user-approval')
    // The authority: what the documents derived, recorded on the case.
    expect(leg.reviewAuthority).toBe('human-user')
    expect(leg.requiredAuthorityAtCreation).toBe('human-user')
    expect(leg.beneficiaryAuthority).toBe('member')
    expect(leg.requestedEffect).toBe('allow')
    expect(typeof leg.approvalCaseId).toBe('string')
    // The first leg of a case is ordinal 1 (`control/service.ts:3745`,
    // A4-PR3) — stated, not assumed from the output.
    expect(leg.legOrdinal).toBe(1)
    // A carrier that disagrees with the derived rung would show up here as a
    // second row (the leader-approval the old routing would have opened).
    expect(a10.requests.map((r) => r.kind)).toEqual(['user-approval'])
  })

  it('A11: an undetermined authority writes NOTHING durable and answers without waiting', () => {
    expect(a11.executed).toBe(0)
    expect(a11.requests).toHaveLength(0)
    expect(a11.decisionRows).toBe(0)
    expect(a11.pending).toBe(0)
    expect(a11.reason.includes(OPERATION_APPROVAL_REFUSAL_REASONS.CEILING_UNDETERMINED)).toBe(true)
    expect(a11.reason.includes('no approval case was created')).toBe(true)
    // Not the capability family: this is the Team authority plane, not the host.
    expect(a11.reason.startsWith('execution unavailable:')).toBe(false)
  })

  it('A12: a required rung with no resolver closes the case AT CREATION (never a pending leg)', () => {
    expect(a12.executed).toBe(0)
    expect(a12.pending).toBe(0)
    expect(a12.requests).toHaveLength(1)
    const leg = a12.requests[0]
    if (leg === undefined) return
    expect(leg.reviewAuthority).toBe('human-admin')
    expect(leg.status).not.toBe('pending')
    // The terminal deny is durable (the case did arrive and did close).
    expect(a12.decisionRows).toBe(1)
    expect(a12.reason.includes('human-admin')).toBe(true)
    expect(a12.reason.includes('no resolver')).toBe(true)
  })

  it('A13: with no authority port wired the v1/v2 row is unchanged (frozen kind, no invented leg fields)', () => {
    expect(a13.requests).toHaveLength(1)
    const row = a13.requests[0]
    if (row === undefined) return
    expect(row.kind).toBe('leader-approval')
    // Nothing v3 is invented onto a pre-v3 row.
    expect(row.reviewAuthority).toBe(undefined)
    expect(row.requiredAuthorityAtCreation).toBe(undefined)
    expect(row.approvalCaseId).toBe(undefined)
    // And the outcome is the frozen one: the approval wait, cancelled by the
    // bounded timer — never a capability denial.
    expect(a13.reason).toBe('the approval wait was cancelled')
  })

  it('A14: the facts reader hands over the plane’s OWN documents, and a pre-v3 read is `undefined` (the legacy arm)', () => {
    // v3: the pair passes through BY IDENTITY. A reconstruction would be a
    // second answer, and the ceiling walk would be reading the adapter's
    // memory instead of the plane (the A5-12 shape).
    expect(a14v3).not.toBe(undefined)
    expect(a14v3?.documents).toBe(READER_PAIR)
    expect(a14v3?.beneficiaryAuthority).toBe('member')
    // No subtree predicate is invented here: `subtreeContains` is supplied by
    // the caller that owns a containment seam (the glue's public
    // `FileSystem.contains`), never fabricated by a reader that has none —
    // an absent predicate makes a subtree rule answer `undetermined`.
    expect(a14v3?.subtreeContains).toBe(undefined)
    // Pre-v3 / unknown binding: `undefined`, which is the legacy routing
    // downstream. An unknown binding never becomes a v3 answer here.
    expect(a14pre).toBe(undefined)
    // Identity passthrough: the reader forwarded the Team and the instance it
    // was given — it mints no identity of its own.
    const first = ceilingCalls[0]
    expect(first?.teamSessionId).toBe(P6T4_ROOT)
    expect(first?.memberInstanceId).toBe(WORKER_ID)
  })

  it('A15: a Leader install is never routed off a member-beneficiary document set (no under-ask)', () => {
    // The only production reader fixes the beneficiary to `member`
    // (`permission-plane.ts:821`). Running the Leader's OWN ask against it
    // would start the walk at rungAbove('member') and could answer "Leader is
    // enough" — an UNDER-ASK, the one direction this lane may not move in. So
    // the Leader install gets `undefined` = the frozen v1/v2 routing...
    expect(a15).toBe(undefined)
    // ...and it gets it WITHOUT reading the documents, so no path can drift
    // into using them for a leader-beneficiary evaluation later.
    expect(leaderProbeReadDocuments).toBe(false)
  })

  it('A16: the reader takes the actor argument as plumbing, not as authority', () => {
    // The port's `actor` selects the context's `initiatorAuthority`, which the
    // adapter discards (the adapter routes with the initiator the pre-execute
    // pipeline verified from the durable identity). Pinned so a future edit
    // cannot quietly start routing off the keyboard role again.
    const call = ceilingCalls[0]
    expect(call?.actor).toBe('leader')
    expect(a14v3).not.toBe(undefined)
    // And the mapped facts carry NO initiator field at all — there is nowhere
    // for a second initiator to live.
    expect(Object.keys(a14v3 ?? {}).sort()).toEqual(['beneficiaryAuthority', 'documents'])
  })
})
