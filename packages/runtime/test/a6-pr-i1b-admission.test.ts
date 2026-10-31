/**
 * Alpha.6 PR-I1b (Lane 2) — the entry admission for `ReviewAssignment` decisions, per the memo
 * `docs/plans/memo/alpha6-review-separation/pri1b-admission-design-20261031.md` (§9 amendments binding). The
 * describes are the memo's S-1…S-10 attack plan, in its order, because the plan is the contract.
 *
 * WHAT RUNS AGAINST REAL CODE (the house answer to a leg that agrees to be a leg):
 *  - the caller resolver is the REAL `resolveCaller` (`packages/runtime/admission/resolve.ts:230`) over REAL
 *    `TeamDomainRepositories` — the module never re-implements it and this file never double-substitutes it,
 *    because §9's binding triple IS that function's leader branch and pinning a paraphrase would pin nothing;
 *  - the role-closure pin imports the REAL `CONTROL_RESOLVER_ROLES` and compares the lane's frozen mirror against
 *    it in both directions (the mirror itself is BLOCKED-WIRING 1: the lane's hygiene law forbids the import, so
 *    the pin lives here, the way PR0's `CONTROL_ROLE_CLOSURE_MIRROR` leg lives here for the same reason);
 *  - S-6 and S-8 drive the REAL `applyReviewAssignment` over the REAL `LedgerRepository` via `p4-helpers`'
 *    contract-exact `InMemoryStorageSeam`, and S-1's "no durable work happened" is measured on the seam's own
 *    write log, not on a port that agreed not to write;
 *  - the D-9 pass-through list is driven the same way since round 1 of #522 (F-I1b1-1/F-I1b1-4, 2026-10-31): one
 *    leg per declared code, each moving the real family through the real writer and reading the answer through
 *    `admit`, and a closing census that compares the list with what those call sites were SEEN to produce and
 *    with the codes `checkAssignmentMutation` refuses, in both directions. Before that round the list was backed
 *    by a subset pin and a containment census, and NEITHER could fail — a sixth member the pre-flight cannot
 *    emit stayed green, which is the finding those legs exist to make impossible;
 *  - the cross-team, mixed-ledger and other-team-member rows are REAL repository writes in a REAL second team.
 *
 * WHAT A REAL HOST MEASURED (added after round 1 of #522; the legs read the capture, they do not quote it):
 *  - the real-Host execution loop RAN on this machine. `tests/kits/pr-i1b-real-host/pr-i1b-real-host.mjs` boots the
 *    pinned pristine host (`tests/deepseek-harness-test-use`, detached at the pin, porcelain 0 before AND after —
 *    CORE PATCH BUDGET = 0) with THIS worktree's built row mounted through the public profile-patch seam, asks it
 *    who may resolve each kind over public seams only, and lands the answers in
 *    `dev/agent-workflow/evidence/alpha6-pr-i1b-real-host/capture.json`. Measured on that host: the leader ingress
 *    — a caller its own `resolveCaller` read off durable rows — got
 *    `ControlService: role 'leader' is not a resolver for kind 'user-approval' (allowed: [human])`; the human
 *    ingress (frozen v4 wire, no identity on the wire) resolved all three kinds; an unknown instance got
 *    `TeamRuntime: no member instance 'inst-nobody' in team '<root>' — the caller is unknown`; and the ledger that
 *    those six durable writes landed in holds fact types [control-decision-recorded, control-request-recorded] and
 *    no review-assignment row. The REAL-HOST block below compares the allowed list the host PRINTED against both
 *    tables — `CONTROL_RESOLVER_ROLES` and this lane's mirror — so round 1's two-instrument sentence (VALUES plus
 *    the presence of two strings in `service.ts`, F-I1b1-3) is no longer the size of this file.
 *  - what the run proved about the TWO GATES on the resolve path, corrected 2026-10-31 by round 2 of #522
 *    (F-I1b2-2 — the sentence this one replaces claimed the envelope answered first and the two leader cells
 *    "never arrived at the closure", which the module's own cited source refutes): the role closure runs
 *    BEFORE the envelope inside `resolveControl` — `control/service.ts:2619` says "Role closure (BEFORE the
 *    envelope — invariant 37 …)", the closure check is :2622-2635, `enforceEnvelope(RESOLVE_CONTROL_SPEC, …)`
 *    is :2654 — so the two leader cells `leader-approval|leader` and `envelope-mutation|leader` DID reach the
 *    closure and the closure AGREED with them: their visible refusal (`TEAM_RUNTIME_ENVELOPE_OUT_OF_BOUNDS`
 *    on `resolve-control`) is thrown after the closure, and the kit measures that order on every run
 *    (check `role-closure-precedes-envelope-on-resolve-path`); the capture records those cells as
 *    `closure: agreed-then-envelope-refused` and the leg reads them as the positive evidence they are;
 *  - the capture is READ-TIME BOUND, not trusted as a file (round 3 of #522): the stamped `verdict.json` of
 *    the run it names must be BYTE-IDENTICAL to `capture.json` — an honest run writes both from one object,
 *    so the evidence-set pin is an identity pin, and pointing the capture at a stale stamped directory
 *    reddens (F-I1b3-2); the kit's gate-order function (`tests/kits/pr-i1b-real-host/gate-order.mjs`, ONE
 *    implementation, imported not copied) re-runs at read time against this tree's `control/service.ts` and
 *    must equal the recorded `resolvePathOrder` field for field, dead line numbers included (F-I1b3-3/-4);
 *    and the recorded ports must sit inside the imported `TEST_PORT_RANGES` — the pre-fix instrument booted
 *    its enable world at `port + 100`, outside the sanctioned bands, which is why the round-1/2 captures
 *    read [3292, 3392]; an off-band capture is refused as evidence (F-I1b3-1/-4). The counted refusal line
 *    prints vitest's OWN skip count, asserted equal to the tally before printing (F-I1b3-6);
 *  - the MEMBER row has no ingress that reaches the closure — and that is measured, not asserted (round 2,
 *    F-I1b2-3): the kit presents a member session through the only identity-expressing carrier the host has
 *    (the session-addressed `/__p6t6/tool`) and records the host's `no live agent` refusal verbatim; no model
 *    on this machine means no live member agent (PR-I2's report says the same); and the door's own kind is
 *    fixed to `leader-approval` by `ASSIGNMENT_DECISION_CONTROL_KIND`, so the cell where the host proved the
 *    closure BITES (`user-approval|leader`) is pinned host↔table, never host↔door. The D-10 mutation of the
 *    closure VALUES is measured here by running the mirror mutation (it reddens both the VALUES leg and the
 *    host-comparison leg) rather than by a file-mutation loop the memo assigns to the reviewer.
 *  - S-7's non-enabling half is on the same capture, including its enable surface — stated at the size of the
 *    surface probed, not beyond it (round 2, F-I1b2-8): the probe put exactly two plausible names (`feature`,
 *    `assignmentFeature`) into the row config, and this file's regex sweeps the 14 fields the row reports
 *    reading; the host accepted both keys, wrote durable rows, and produced the same fact types as the control
 *    world. A field named otherwise that gated only assignment writes would be invisible to that probe. The
 *    conclusion does not rest on the probe: it is structural and census-backed — `openAssignmentAdmission`
 *    has ZERO callers in source and built dist (S-7's confirmed negative), so no host surface reaches this
 *    gate, the enabled arm S-7 asks about has no host surface to be measured on, and the dormancy legs are
 *    the binding evidence for the disabled arm.
 *  - still refused, and refused by name below: anything that needs the shared read-only baseline
 *    `/srv/workspace/dsh-stable-3-0.2.0-rc.2`, which is absent on this machine (the pristine runtime and
 *    `tests/homes/` are NOT absent — the ENV-REFUSED leg measures each path separately, because asserting the old
 *    three absences together would hide the legs that now run).
 *  - the D-10 "swap every refusal code for its neighbour and watch a leg redden" mutation is executed here as
 *    exact-code assertions plus a produced-vs-declared census; the file-mutation loop itself is the reviewer
 *    step named in the memo (加补编 3 第 2 条), not something a leg on this tree can run against its own source.
 *
 * Refusal assertions compare the code with `toBe` against the literal, never with a substring match: a leg that
 * passes for any `ADMISSION_*` code is a leg about a prefix, not about a refusal.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { afterAll, describe, expect, it } from 'vitest'

import { LEADER_INSTANCE_ID, parseRootSessionId } from '../../contracts/src/index.js'
import { TEAM_DOMAIN_SCHEMA_VERSION } from '../../storage/schema/stores.js'
import { createTeamDomain } from '../../storage/repositories/team-domain.js'
import type { TeamDomain } from '../../storage/repositories/team-domain.js'
import { InMemoryStorageSeam, P4_FIXTURE, ledgerEntryRecord, memberInstanceInput, teamRootBinding, teamMemberBinding, teamSessionInput } from '../../storage/test/p4-helpers.js'
import { CALLER_ROLE_VALUES } from '../admission/types.js'
import { resolveCaller } from '../admission/resolve.js'
import { CONTROL_RESOLVER_ROLES } from '../control/types.js'
import { REMOTE_MUTATION_ACTOR_KINDS } from '../../remote/src/contracts/params.js'
import { REVIEW_ASSIGNMENT_WRITE_REFUSALS, applyReviewAssignment } from '../review-assignment/writer.js'
import type { ReviewAssignmentCommand, ReviewAssignmentLedgerRow, ReviewAssignmentLockPort, ReviewAssignmentRowDraft } from '../review-assignment/writer.js'
import { REVIEW_ASSIGNMENT_FACT_TYPES, REVIEW_ASSIGNMENT_FACT_TYPE_VALUES, REVIEW_ASSIGNMENT_REFUSALS } from '../review-assignment/types.js'
// The baseline pin, read where every kit and spec in this repo reads it. Imported, never copied: a copied SHA is
// the drift the hygiene walk hunts. Same law for the port policy: TEST_PORT_RANGES is imported, so this spec
// checks the SAME bands the instrument must obey (round 3 of #522, F-I1b3-1/-4) — a copied band list would
// drift the moment the user widened the real one. `measureResolvePathGateOrder` is the kit's own gate-order
// measurement (ONE implementation in the repo, F-I1b3-3): the kit runs it at capture time, this file re-runs
// it at read time against the same bytes.
import { TEST_PORT_RANGES, TEST_USE_BASELINE_SHA } from '../../../tests/paths.mjs'
import { measureResolvePathGateOrder } from '../../../tests/kits/pr-i1b-real-host/gate-order.mjs'
import {
  ASSIGNMENT_ADMISSION_CALLER_ROLES,
  ASSIGNMENT_ADMISSION_CLAIMABLE_ACTOR_KINDS,
  ASSIGNMENT_ADMISSION_FEATURE_VALUES,
  ASSIGNMENT_ADMISSION_PASSTHROUGH_CODES,
  ASSIGNMENT_ADMISSION_REFUSAL_CODES,
  ASSIGNMENT_ADMISSION_REQUEST_FIELDS,
  ASSIGNMENT_ADMISSION_ROLE_CLOSURE,
  ASSIGNMENT_DECISION_CONTROL_KIND,
  openAssignmentAdmission,
} from '../review-assignment/assignment-admission.js'
import type {
  AssignmentAdmissionOutcome,
  AssignmentAdmissionPorts,
  AssignmentAdmissionRequest,
  AssignmentCallerAuthority,
} from '../review-assignment/assignment-admission.js'
// P-2 (the A5↔A6 cross-project prohibitions, 2026-11-01) measures the mandate gate beside the assignment door:
// the same ruling binds both verdict shapes. The green fixture is RE-ESTABLISHED below from the pr0 shapes,
// not imported from the pr0 spec — a fixture a leg cannot see is a fixture a leg cannot grade.
import {
  REVIEW_ADMISSION_REFUSALS,
  evaluateReviewAdmission,
  parseReviewPlan,
  planCoversEffectScope,
} from '../review-mandate/index.js'
import type { ReviewAdmission, ReviewCaseView, ReviewMandate, ReviewPlan, ReviewerIdentity } from '../review-mandate/index.js'

const RUNTIME_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MODULE_PATH = join(RUNTIME_ROOT, 'review-assignment', 'assignment-admission.ts')
const HYGIENE_PATH = join(RUNTIME_ROOT, 'test', 'a6-pr2-lane-hygiene.test.ts')
const CONTROL_SERVICE_PATH = join(RUNTIME_ROOT, 'control', 'service.ts')

const ROOT_A = P4_FIXTURE.rootSessionId as string
const ROOT_B = P4_FIXTURE.otherRootSessionId as string
const CASE_ID = 'approval-case-1'

/** Every refusal code this file produced, collected rather than assumed — the census below reads this. */
const observedRefusals = new Set<string>()

/**
 * Every refusal that came out of `admit` itself, with the detail string it travelled in.
 *
 * This map is deliberately NARROWER than `observedRefusals` above, and the difference is the point: S-4 drives
 * the real writer next to the admission as second-door evidence and records the writer's own refusals into the
 * wide set, so a pass-through census that read the wide set could be satisfied by a refusal that never passed
 * through this door. The D-9 census reads this one — code AND words, because D-9 promises the kernel's answer
 * arrives "structurally verbatim", and a code observed with the wrong words is a code this module rewrote.
 */
const refusalsThroughAdmit = new Map<string, string[]>()

// --- the harness ---------------------------------------------------------------------------------------------

function ledgerRows(domain: TeamDomain): readonly ReviewAssignmentLedgerRow[] {
  return domain.repositories.ledger.list().map((entry) => ({
    sequence: entry.sequence,
    rootSessionId: entry.rootSessionId,
    factType: entry.factType,
    payload: entry.payload as Record<string, unknown>,
  }))
}

function writerDeps(domain: TeamDomain) {
  const lockTails = new Map<string, Promise<void>>()
  const lock: ReviewAssignmentLockPort = {
    withLock<T>(root: string, critical: () => Promise<T>): Promise<T> {
      const previous = lockTails.get(root) ?? Promise.resolve()
      let release!: () => void
      lockTails.set(root, new Promise<void>((resolve) => (release = resolve)))
      return previous.then(async () => {
        try {
          return await critical()
        } finally {
          release()
        }
      })
    },
  }
  return {
    ledger: {
      allocateSequence: (): Promise<number> => domain.repositories.ledger.allocateSequence(),
      put: (draft: ReviewAssignmentRowDraft): Promise<unknown> =>
        domain.repositories.ledger.put({
          schemaVersion: TEAM_DOMAIN_SCHEMA_VERSION,
          sequence: draft.sequence,
          rootSessionId: parseRootSessionId(draft.rootSessionId),
          factType: draft.factType,
          payload: draft.payload as unknown as Record<string, string | number | null>,
          createdAt: draft.createdAt,
        }),
      list: ledgerRows.bind(null, domain),
    },
    lock,
    now: () => '2026-10-31T10:00:00Z',
  }
}

interface World {
  readonly seam: InMemoryStorageSeam
  readonly domain: TeamDomain
  /** Ports built from the REAL repositories; counters record whether the predicate even reached each one. */
  readonly ports: (this: void) => AssignmentAdmissionPorts & { readonly calls: { readonly team: () => number; readonly ledger: () => number } }
  readonly resolveCalls: () => number
  readonly request: (overrides: Partial<AssignmentAdmissionRequest>) => AssignmentAdmissionRequest
  readonly admit: (
    request: AssignmentAdmissionRequest,
    caller: Parameters<AssignmentAdmissionPorts['resolveCaller']>[1],
    portsOverride?: AssignmentAdmissionPorts,
  ) => Promise<AssignmentAdmissionOutcome>
}

async function world(options: { readonly seedMember?: boolean; readonly seedRootB?: boolean } = {}): Promise<World> {
  const seam = new InMemoryStorageSeam()
  const domain = await createTeamDomain(seam)
  await domain.repositories.teamSessions.put(teamSessionInput(parseRootSessionId(ROOT_A)))
  await domain.repositories.sessionBindings.put(teamRootBinding(ROOT_A))
  if (options.seedMember !== false) {
    await domain.repositories.memberInstances.put(memberInstanceInput())
    await domain.repositories.sessionBindings.put(teamMemberBinding(ROOT_A, 'inst-alpha', 'session-child-1'))
  }
  if (options.seedRootB === true) {
    await domain.repositories.teamSessions.put(teamSessionInput(parseRootSessionId(ROOT_B), 1))
    await domain.repositories.memberInstances.put(memberInstanceInput(P4_FIXTURE.otherRootSessionId, P4_FIXTURE.secondInstanceId, P4_FIXTURE.secondChildSessionId))
    await domain.repositories.sessionBindings.put(teamMemberBinding(ROOT_B, 'inst-beta', 'session-child-2'))
  }
  let resolveCount = 0
  let teamCount = 0
  let ledgerCount = 0
  const ports = () => {
    teamCount = 0
    ledgerCount = 0
    const base: AssignmentAdmissionPorts = {
      teamRootExists: (root) => {
        teamCount += 1
        return domain.repositories.teamSessions.get(parseRootSessionId(root)) !== undefined
      },
      resolveCaller: (root, caller) => {
        resolveCount += 1
        // THE wiring §9 demands: the closure hands the existing entry point exactly the repositories, root and
        // caller, and adds nothing — no cached answer, no reconstruction, no member-row role derivation.
        return resolveCaller(domain.repositories, root, caller)
      },
      ledger: { list: () => { ledgerCount += 1; return ledgerRows(domain) } },
    }
    return Object.assign(base, { calls: { team: () => teamCount, ledger: () => ledgerCount } })
  }
  const request = (overrides: Partial<AssignmentAdmissionRequest>): AssignmentAdmissionRequest => ({
    rootSessionId: ROOT_A,
    approvalCaseId: CASE_ID,
    currentLegRequestId: 'leg-request-1',
    decisionKind: 'created',
    targetKind: 'instance',
    targetInstanceId: 'inst-alpha',
    reasonCode: 'ROUTER_PLAN_COVERS_ACTION',
    basedOnCaseVersion: 'case-version-1',
    ...overrides,
  })
  const admit: World['admit'] = async (req, caller, portsOverride) => {
    const opened = openAssignmentAdmission({ feature: 'on' }, portsOverride ?? ports())
    if (!opened.ok) return opened
    const outcome = await opened.gate.admit(req, caller)
    if (!outcome.ok) {
      observedRefusals.add(outcome.refusal)
      const seen = refusalsThroughAdmit.get(outcome.refusal) ?? []
      refusalsThroughAdmit.set(outcome.refusal, [...seen, outcome.detail])
    }
    return outcome
  }
  return { seam, domain, ports, resolveCalls: () => resolveCount, request, admit }
}

/** The caller shapes: a human, the Leader instance (the §9 triple resolves it with or without a member row),
 *  and the plain member. Identity carries no role — that is the whole subject of S-1 and S-2. */
const HUMAN_CALLER = { kind: 'human', humanId: 'human-1' } as const
const LEADER_CALLER = { kind: 'instance', instanceId: LEADER_INSTANCE_ID } as const
const MEMBER_CALLER = { kind: 'instance', instanceId: 'inst-alpha' } as const

/** A ports stand-in for the legs that must NOT need a team: everything counted, nothing seeded. */
function barePorts(): AssignmentAdmissionPorts & { readonly calls: { team: number; resolve: number; ledger: number } } {
  const calls = { team: 0, resolve: 0, ledger: 0 }
  return {
    calls,
    teamRootExists: () => { calls.team += 1; return false },
    resolveCaller: () => { calls.resolve += 1; throw new Error('must not be reached') },
    ledger: { list: () => { calls.ledger += 1; return [] } },
  }
}

// --- S-1 ------------------------------------------------------------------------------------------

describe('S-1: a member-role caller submitting an assignment decision is refused', () => {
  it('refuses the member with ADMISSION_ROLE_NOT_RESOLVER, naming role, kind and the allowed set', async () => {
    const w = await world()
    const outcome = await w.admit(w.request({}), MEMBER_CALLER)
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.refusal).toBe('ADMISSION_ROLE_NOT_RESOLVER')
    // The message shape follows `service.ts:2629`: the three facts a reader needs are all in the string.
    expect(outcome.detail).toContain("role 'member'")
    expect(outcome.detail).toContain("'leader-approval'")
    expect(outcome.detail).toContain('leader')
    expect(outcome.detail).toContain('human')
  })

  it('does no durable work for the refused member: not one write on the real seam', async () => {
    const w = await world()
    const writesBefore = w.seam.writeLog.length
    const rowsBefore = ledgerRows(w.domain).length
    const ports = w.ports()
    const outcome = await w.admit(w.request({}), MEMBER_CALLER, ports)
    expect(outcome.ok).toBe(false)
    // `allocateSequence` was not even reachable: the admission ports carry no sequence handle and no put, so the
    // memo's "序号分配前拒绝" is structural here, and the seam's write log is the measurement of it.
    expect(w.seam.writeLog.slice(writesBefore)).toEqual([])
    expect(ledgerRows(w.domain)).toHaveLength(rowsBefore)
    expect(ports.calls.ledger(), 'role refusal must not spend a ledger read on a caller it already rejected').toBe(0)
  })

  it('accepts the human caller, because the refusal above is about the role and not about the harness', async () => {
    // The control leg for S-1: `CONTROL_RESOLVER_ROLES['leader-approval']` is ['leader','human'], so a member
    // refused while a human passes is the closed set discriminating, not the wiring being broken.
    const w = await world()
    const outcome = await w.admit(w.request({ targetInstanceId: 'inst-alpha' }), HUMAN_CALLER)
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.resolvedRole).toBe('human')
    expect(outcome.controlRequestKind).toBe('leader-approval')
  })

  it('accepts the Leader through the REAL resolveCaller triple, with no Leader member row in existence', async () => {
    // V-1 as §9 settled it: the Leader resolves from TeamSession + team-root binding + the sentinel instance id;
    // the member row may be absent, and a check that demanded it would refuse the real Leader.
    const w = await world({ seedMember: false })
    const outcome = await w.admit(w.request({ targetInstanceId: 'inst-alpha' }), LEADER_CALLER)
    expect(outcome.ok, 'the §9 triple must be exactly what the injected real resolveCaller resolves').toBe(true)
    if (!outcome.ok) return
    expect(outcome.resolvedRole).toBe('leader')
  })

  it('refuses the stale member through the REAL resolver, carrying CALLER_ROLE_STALE verbatim', async () => {
    const w = await world()
    // Move the member out of the live lifecycles — the real resolver's `CALLER_ROLE_STALE` branch (`resolve.ts:279`).
    await w.domain.repositories.memberInstances.commitTransition({
      rootSessionId: ROOT_A,
      instanceId: 'inst-alpha',
      expectedActivityVersion: 1,
      from: 'CREATED',
      operation: 'a6-pr-i1b-stale-caller',
      to: 'ARCHIVED',
    })
    const outcome = await w.admit(w.request({}), MEMBER_CALLER)
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.refusal).toBe('ADMISSION_CALLER_UNRESOLVED')
    expect(outcome.detail).toContain('CALLER_ROLE_STALE')
  })
})

// --- S-2 ------------------------------------------------------------------------------------------

describe('S-2: identity smuggled through the request is refused by the closed field set', () => {
  it('refuses an injected role key by name and says identity is not a request field at all', async () => {
    const w = await world()
    const smuggled = { ...w.request({}), role: 'leader' } as unknown as AssignmentAdmissionRequest
    const outcome = await w.admit(smuggled, MEMBER_CALLER)
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.refusal).toBe('ADMISSION_REQUEST_MALFORMED')
    expect(outcome.detail).toContain('role')
    expect(outcome.detail).toContain('identity or role is not a request field')
  })

  it('refuses resolverRole too — a second door with a more honest name is still a second door', async () => {
    const w = await world()
    const smuggled = { ...w.request({}), resolverRole: 'leader' } as unknown as AssignmentAdmissionRequest
    const outcome = await w.admit(smuggled, MEMBER_CALLER)
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.refusal).toBe('ADMISSION_REQUEST_MALFORMED')
    expect(outcome.detail).toContain('resolverRole')
  })

  it('refuses every unknown field, named, and every malformed known field, named', async () => {
    const w = await world()
    const cases: ReadonlyArray<readonly [string, Partial<AssignmentAdmissionRequest> & Record<string, unknown>, string]> = [
      ['innocent extra field', { note: 'x' }, 'note'],
      ['missing case id', { approvalCaseId: '' }, 'approvalCaseId'],
      ['team target the kernel does not speak', { targetKind: 'team' }, 'targetKind'],
      ['fractional epoch claim', { expectedPreviousEpoch: 1.5 }, 'expectedPreviousEpoch'],
      ['negative epoch claim', { expectedPreviousEpoch: -3 }, 'expectedPreviousEpoch'],
      ['claim outside the actor vocabulary', { claimedActorKind: 'ghost' }, 'claimedActorKind'],
    ]
    for (const [label, overrides, expectedNamed] of cases) {
      const outcome = await w.admit(w.request(overrides), HUMAN_CALLER)
      expect(outcome.ok, label).toBe(false)
      if (outcome.ok) continue
      expect(outcome.refusal, label).toBe('ADMISSION_REQUEST_MALFORMED')
      expect(outcome.detail, `${label} refused without naming the field`).toContain(expectedNamed)
    }
  })

  it('the leader target follows the kernel target law through the door: no id demanded, no id tolerated', async () => {
    // The kernel writes leader-targeted rows (`facts.ts:255` refuses a leader row that NAMES an instance), so
    // admission that demanded an instance id would refuse a legal decision and call it malformed. Both sides
    // of that law are legs: leader-without-id passes the shape screen, leader-with-id is refused by name.
    const w = await world()
    const legal: Record<string, unknown> = { ...w.request({ decisionKind: 'retired', targetKind: 'leader' }) }
    delete legal['targetInstanceId']
    const passed = await w.admit(legal as unknown as AssignmentAdmissionRequest, LEADER_CALLER)
    // The kernel's answer, not the door's: an empty state has nothing to retire. Reaching THAT code is the
    // proof the shape screen let a legal leader-target through — an ADMISSION_REQUEST_MALFORMED here would
    // mean the door invented a target law the kernel does not have.
    expect(passed.ok).toBe(false)
    if (passed.ok) return
    expect(passed.refusal).toBe('REVIEW_ASSIGNMENT_NO_ACTIVE_ASSIGNMENT')
    observedRefusals.add(passed.refusal)
    const smuggled = await w.admit(
      w.request({ decisionKind: 'retired', targetKind: 'leader', targetInstanceId: 'inst-alpha' }),
      LEADER_CALLER,
    )
    expect(smuggled.ok).toBe(false)
    if (smuggled.ok) return
    expect(smuggled.refusal).toBe('ADMISSION_REQUEST_MALFORMED')
    expect(smuggled.detail).toContain('targetInstanceId')
  })

  it('the declared field set contains no identity or role name, in either spelling the attacks tried', () => {
    // The independent schema-census half of S-2 ("键名普查腿独立钉 schema"): the runtime refusal above is paired
    // with the DATA — the list written out here, and the interface in the module source, read rather than trusted.
    expect([...ASSIGNMENT_ADMISSION_REQUEST_FIELDS].sort()).toEqual([
      'approvalCaseId',
      'basedOnCaseVersion',
      'claimedActorKind',
      'controlRequestKind',
      'currentLegRequestId',
      'decisionKind',
      'expectedPreviousEpoch',
      'reasonCode',
      'rootSessionId',
      'targetInstanceId',
      'targetKind',
    ].sort())
    for (const forbidden of ['role', 'resolverRole', 'actor', 'identity']) {
      expect(ASSIGNMENT_ADMISSION_REQUEST_FIELDS).not.toContain(forbidden)
    }
    // The interface in the module source must carry EXACTLY these fields — the list above cannot drift from the
    // type, because this reads the type.
    const source = readFileSync(MODULE_PATH, 'utf8')
    const block = /export interface AssignmentAdmissionRequest \{([\s\S]*?)\n\}/.exec(source)
    expect(block, 'the request interface moved or was renamed — re-read it, do not guess').not.toBeNull()
    const declared = [...(block?.[1] ?? '').matchAll(/^\s*readonly (\w+)(?:\?)?:/gm)].map((m) => m[1] as string).sort()
    expect(declared).toEqual([...ASSIGNMENT_ADMISSION_REQUEST_FIELDS].sort())
    // Anti-vacuity for the parser: a field list captured empty would satisfy every assertion above.
    expect(declared.length).toBeGreaterThanOrEqual(9)
  })
})

// --- S-3 ------------------------------------------------------------------------------------------

describe('S-3: a decision kind outside the frozen mapping is refused, never default-allowed', () => {
  it('refuses a control kind used as a decision kind, and a row value used as a decision kind', async () => {
    const w = await world()
    for (const bad of ['envelope-mutation', 'review-assignment-created', 'user-approval']) {
      const outcome = await w.admit(w.request({ decisionKind: bad }), HUMAN_CALLER)
      expect(outcome.ok, bad).toBe(false)
      if (outcome.ok) continue
      expect(outcome.refusal, bad).toBe('ADMISSION_KIND_UNSUPPORTED')
      expect(outcome.detail, bad).toContain('created')
    }
    // The empty string is a different crime with a different scene: it never reaches the map at all, because
    // `decisionKind` is a required non-empty string — the shape screen answers first, and that ordering is law.
    const empty = await w.admit(w.request({ decisionKind: '' }), HUMAN_CALLER)
    expect(empty.ok).toBe(false)
    if (empty.ok) return
    expect(empty.refusal).toBe('ADMISSION_REQUEST_MALFORMED')
    expect(empty.detail).toContain('decisionKind')
  })

  it('the decision map and the kernel decision keys are set-equal, both directions', () => {
    // Not a one-way "every map key is legal" check: a new kernel decision kind must appear in the map (the
    // compile face guards that) AND the map must not invent kinds the kernel does not have (only this leg does).
    expect(Object.keys(ASSIGNMENT_DECISION_CONTROL_KIND).sort()).toEqual(Object.keys(REVIEW_ASSIGNMENT_FACT_TYPES).sort())
    for (const kind of Object.keys(REVIEW_ASSIGNMENT_FACT_TYPES)) {
      expect(ASSIGNMENT_DECISION_CONTROL_KIND[kind as keyof typeof ASSIGNMENT_DECISION_CONTROL_KIND]).toBe('leader-approval')
    }
    // No assignment decision maps to `user-approval`: the closed set keeps the row, the mapping never points at it.
    expect(Object.values(ASSIGNMENT_DECISION_CONTROL_KIND)).not.toContain('user-approval')
  })

  it('refuses a truthful-looking controlRequestKind claim that contradicts the mapping, naming both sides', async () => {
    const w = await world()
    const outcome = await w.admit(
      w.request({ controlRequestKind: 'user-approval', claimedActorKind: 'human' }),
      HUMAN_CALLER,
    )
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.refusal).toBe('ADMISSION_CLAIM_CONTRADICTION')
    // The §9 round-2 lesson: a contradiction refusal that does not name BOTH compared terms is a dead end.
    expect(outcome.detail).toContain('user-approval')
    expect(outcome.detail).toContain('leader-approval')
  })
})

// --- S-4 ------------------------------------------------------------------------------------------

describe('S-4: one team is not another team', () => {
  it("refuses team B's member acting on team A's root, through the real resolver's own CALLER_NOT_FOUND", async () => {
    const w = await world({ seedRootB: true })
    const outcome = await w.admit(
      w.request({ targetInstanceId: 'inst-beta' }),
      { kind: 'instance', instanceId: 'inst-beta' },
    )
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.refusal).toBe('ADMISSION_CALLER_UNRESOLVED')
    // Verbatim transport: the resolver's own code travels inside the admission's detail — this layer neither
    // swallows it (that would be laundering) nor relabels it (that would be the same crime with better manners).
    expect(outcome.detail).toContain('CALLER_NOT_FOUND')
    expect(outcome.detail).toContain('inst-beta')
  })

  it('refuses a resolver answer whose member record names a different team than the decision addresses', async () => {
    // Defensive screen for a dishonest/buggy port: the real resolver cannot produce this shape (it queries by
    // (root, instanceId)), so the port is the only way to drive it, and the leg is about what the MODULE does.
    const w = await world()
    const lying: AssignmentAdmissionPorts = {
      teamRootExists: () => true,
      resolveCaller: () => ({ role: 'member', callerMember: { instanceId: 'inst-beta', rootSessionId: ROOT_B } }),
      ledger: { list: () => [] },
    }
    const outcome = await w.admit(w.request({}), MEMBER_CALLER, lying)
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.refusal).toBe('ADMISSION_CALLER_UNRESOLVED')
    expect(outcome.detail).toContain(ROOT_B)
    expect(outcome.detail).toContain(ROOT_A)
  })

  it('the module NEVER accepts a raw identity without a resolved role: the resolver never ran, the decision stops', async () => {
    const w = await world()
    // The shape D-3 forbids by construction: a hand-written authority (`ActionCaller` has no role field at all)
    // laundered through the port. A raw caller is an identity; this module acts on a RESOLVED caller only.
    const raw: AssignmentAdmissionPorts = {
      teamRootExists: () => true,
      resolveCaller: () => ({}) as unknown as ReturnType<AssignmentAdmissionPorts['resolveCaller']>,
      ledger: { list: () => [] },
    }
    const outcome = await w.admit(w.request({}), MEMBER_CALLER, raw)
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.refusal).toBe('ADMISSION_CALLER_UNRESOLVED')
    const rawShape: AssignmentAdmissionPorts = {
      teamRootExists: () => true,
      resolveCaller: () => ({ kind: 'instance', instanceId: 'inst-alpha' }) as unknown as ReturnType<AssignmentAdmissionPorts['resolveCaller']>,
      ledger: { list: () => [] },
    }
    const second = await w.admit(w.request({}), MEMBER_CALLER, rawShape)
    expect(second.ok).toBe(false)
    if (second.ok) return
    expect(second.refusal).toBe('ADMISSION_CALLER_UNRESOLVED')
  })

  it('a foreign row under this root reaches BOTH doors as THEIR OWN codes — admission does not relabel the kernel', async () => {
    // The second half of S-4: the same corrupt world, admitted and executed. The writer refuses it with ITS code
    // (`REVIEW_ASSIGNMENT_WRITE_CROSS_TEAM_ROW`, a write-domain fact); admission answers with the FOLD's code
    // (`REVIEW_ASSIGNMENT_ROW_UNPARSEABLE`, a read-domain fact) — neither door renames the other's answer, and
    // neither invents an ADMISSION_ code for a state the kernel already names. That is 不被重贴标签 read from
    // both ends, and it is why this module pre-checks foreign rows NOT at all: the fold owns that diagnosis.
    const w = await world()
    const foreignPayload = {
      rootSessionId: ROOT_B,
      approvalCaseId: CASE_ID,
      currentLegRequestId: 'leg-request-1',
      targetKind: 'instance',
      targetInstanceId: 'inst-alpha',
      assignmentEpoch: 1,
      previousEpoch: 0,
      reasonCode: 'ROUTER_PLAN_COVERS_ACTION',
      basedOnCaseVersion: 'case-version-1',
      actorCallerRef: 'caller:leader',
    }
    const sequence = await w.domain.repositories.ledger.allocateSequence()
    await w.domain.repositories.ledger.put(
      ledgerEntryRecord(sequence, ROOT_A, { factType: REVIEW_ASSIGNMENT_FACT_TYPES.created, payload: foreignPayload }) as
        Parameters<TeamDomain['repositories']['ledger']['put']>[0],
    )
    const outcome = await w.admit(w.request({}), LEADER_CALLER)
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.refusal).toBe('REVIEW_ASSIGNMENT_ROW_UNPARSEABLE')
    expect(REVIEW_ASSIGNMENT_REFUSALS as readonly string[]).toContain(outcome.refusal)
    expect(outcome.detail).toContain('REVIEW_ASSIGNMENT_CROSS_TEAM_ROW') // the diagnosis it came from, named
    const command: ReviewAssignmentCommand = {
      kind: 'created',
      rootSessionId: ROOT_A,
      approvalCaseId: CASE_ID,
      currentLegRequestId: 'leg-request-1',
      target: { kind: 'instance', instanceId: 'inst-alpha' },
      reasonCode: 'ROUTER_PLAN_COVERS_ACTION',
      basedOnCaseVersion: 'case-version-1',
      actorCallerRef: 'caller:leader',
    }
    const executed = await applyReviewAssignment(writerDeps(w.domain), command)
    expect(executed.ok).toBe(false)
    if (executed.ok) return
    observedRefusals.add(executed.refusal)
    expect(executed.refusal).toBe('REVIEW_ASSIGNMENT_WRITE_CROSS_TEAM_ROW')
  })
})

// --- S-5 ------------------------------------------------------------------------------------------

describe('S-5: a decision addressed to no team is refused before anyone is asked who is calling', () => {
  it('refuses with ADMISSION_TEAM_UNKNOWN, before the resolver and before the ledger', async () => {
    const ports = barePorts()
    const opened = openAssignmentAdmission({ feature: 'on' }, ports)
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    const outcome = await opened.gate.admit(
      {
        rootSessionId: ROOT_B, // mintable, never minted: this is V-3's second screen, and only that screen
        approvalCaseId: CASE_ID,
        currentLegRequestId: 'leg-request-1',
        decisionKind: 'created',
        targetKind: 'instance',
        targetInstanceId: 'inst-alpha',
        reasonCode: 'ROUTER_PLAN_COVERS_ACTION',
        basedOnCaseVersion: 'case-version-1',
      },
      MEMBER_CALLER,
    )
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    observedRefusals.add(outcome.refusal)
    expect(outcome.refusal).toBe('ADMISSION_TEAM_UNKNOWN')
    expect(ports.calls.resolve).toBe(0)
    expect(ports.calls.ledger).toBe(0)
  })

  it('an id that cannot even be a root gets its OWN code, and does not reach the existence check', async () => {
    const ports = barePorts()
    const opened = openAssignmentAdmission({ feature: 'on' }, ports)
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    const outcome = await opened.gate.admit(
      {
        rootSessionId: 'root session', // fails the contract grammar itself
        approvalCaseId: CASE_ID,
        currentLegRequestId: 'leg-request-1',
        decisionKind: 'created',
        targetKind: 'instance',
        targetInstanceId: 'inst-alpha',
        reasonCode: 'ROUTER_PLAN_COVERS_ACTION',
        basedOnCaseVersion: 'case-version-1',
      },
      MEMBER_CALLER,
    )
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    observedRefusals.add(outcome.refusal)
    // R-5: three screens, three codes — "not an id", "no team", "not a resolver" must not collapse into one word.
    expect(outcome.refusal).toBe('ADMISSION_ROOT_UNMINTABLE')
    expect(ports.calls.team).toBe(0)
    expect(ports.calls.resolve).toBe(0)
  })

  it('a team-existence read that THROWS answers with ADMISSION_TEAM_UNKNOWN and the thrown words — the branch is driven, not just enumerated (F-I1b6-4)', async () => {
    // Round 6 named this as a refusal path the AST census graded but NO leg drove: the census proves the
    // literal's field set, and this proves the branch is reachable and answers the way the literal says it
    // does. Test-side only — the ports are the door's own injection seam, so production source is untouched.
    const calls = { team: 0, resolve: 0, ledger: 0 }
    const thrown = 'R6BRANCH the existence read exploded'
    const ports: AssignmentAdmissionPorts & { readonly calls: typeof calls } = {
      calls,
      teamRootExists: () => {
        calls.team += 1
        throw new Error(thrown)
      },
      resolveCaller: () => {
        calls.resolve += 1
        throw new Error('must not be reached')
      },
      ledger: { list: () => { calls.ledger += 1; return [] } },
    }
    const opened = openAssignmentAdmission({ feature: 'on' }, ports)
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    const outcome = await opened.gate.admit(
      {
        rootSessionId: ROOT_A,
        approvalCaseId: CASE_ID,
        currentLegRequestId: 'leg-request-1',
        decisionKind: 'created',
        targetKind: 'instance',
        targetInstanceId: 'inst-alpha',
        reasonCode: 'ROUTER_PLAN_COVERS_ACTION',
        basedOnCaseVersion: 'case-version-1',
      },
      MEMBER_CALLER,
    )
    expect(outcome.ok, 'a throwing existence read must refuse, not sail on to the resolver with an assumed answer').toBe(false)
    if (outcome.ok) return
    observedRefusals.add(outcome.refusal)
    expect(outcome.refusal).toBe('ADMISSION_TEAM_UNKNOWN')
    expect(outcome.detail, 'the thrown words travel — an answer this module cannot get is named with the reason it could not get (F-I1b1-5 transport law)').toContain(thrown)
    // F-I1b7-1 — what this leg graded BEFORE is exactly what the round-7 V7 plant walked past: it read
    // `ok`, `refusal` and `detail` off the live verdict and asserted nothing about the rest of the object,
    // so the plant's fourth field rode out with the answer (`Object.keys` of the live rejection measured
    // ok, refusal, detail, widenedEffectScopes — spec still 80/80 over it). The door's contract on this
    // branch is the CLOSED SHAPE of the object it returns, so the leg now pins that shape: Object.keys
    // EXACT against ASSIGNMENT_REFUSAL_KEYS, test-side, no production byte moved. Coverage stated plainly
    // so no sentence leans on more than is graded: exact live key sets are asserted HERE, on the branch
    // this leg drives, and the first live leg of P-2 grades its admitted/refused verdicts against extra
    // fields via fieldSetViolations — every OTHER path's live shape is graded statically by the census, per
    // literal, but NOT asserted at runtime on its own path. Grading the exact closed shape on EVERY path
    // is the door's runtime contract in the #502 interface — it belongs there, once a consumer exists.
    expect(Object.keys(outcome).sort()).toEqual([...ASSIGNMENT_REFUSAL_KEYS].sort())
    expect(calls.resolve, 'the throw must stop the door before the resolver, exactly as the false answer does').toBe(0)
    expect(calls.ledger, 'and before the ledger').toBe(0)
  })

  it('the existence port is boolean because the TeamSession record has no lifecycle column, and says so', () => {
    // V-3, measured rather than remembered: `missing` vs `corrupt` vs `archived` cannot be separated because the
    // record has no such field; the module discloses the merged state in the port doc instead of pretending.
    const dto = readFileSync(join(RUNTIME_ROOT, '..', 'contracts', 'src', 'dto', 'team-session-record.ts'), 'utf8')
    expect(dto).not.toMatch(/^\s*(lifecycle|status)\s*:/m)
    const moduleSource = readFileSync(MODULE_PATH, 'utf8')
    expect(moduleSource).toContain('no lifecycle')
    expect(moduleSource).toMatch(/boolean/)
  })
})

// --- S-6 ------------------------------------------------------------------------------------------

describe('S-6: the admission answer is not a credential', () => {
  it('admits, the state moves through the REAL writer, and re-admission answers with the kernel code, unrenamed', async () => {
    const w = await world()
    const command: ReviewAssignmentCommand = {
      kind: 'created',
      rootSessionId: ROOT_A,
      approvalCaseId: CASE_ID,
      currentLegRequestId: 'leg-request-1',
      target: { kind: 'instance', instanceId: 'inst-alpha' },
      reasonCode: 'ROUTER_PLAN_COVERS_ACTION',
      basedOnCaseVersion: 'case-version-1',
      actorCallerRef: 'caller:leader',
    }
    const before = await w.admit(w.request({}), LEADER_CALLER)
    expect(before.ok).toBe(true)
    if (!before.ok) return
    expect(before.nextAssignmentEpoch, 'admission and execution must agree about the epoch, or admission lies').toBe(1)
    const executed = await applyReviewAssignment(writerDeps(w.domain), command)
    expect(executed.ok).toBe(true)
    // The state moved. The same request, re-admitted now, is refused — and the code is the kernel's own
    // (`REVIEW_ASSIGNMENT_ALREADY_ACTIVE`), not an admission-shaped restatement of it (D-9).
    const after = await w.admit(w.request({}), LEADER_CALLER)
    expect(after.ok).toBe(false)
    if (after.ok) return
    expect(after.refusal).toBe('REVIEW_ASSIGNMENT_ALREADY_ACTIVE')
    expect(REVIEW_ASSIGNMENT_REFUSALS as readonly string[]).toContain(after.refusal)
  })

  it('re-admission after the assignment is RETIRED answers with the kernel retirement vocabulary, unrenamed', async () => {
    const w = await world()
    const deps = writerDeps(w.domain)
    expect((await applyReviewAssignment(deps, {
      kind: 'created', rootSessionId: ROOT_A, approvalCaseId: CASE_ID, currentLegRequestId: 'leg-request-1',
      target: { kind: 'instance', instanceId: 'inst-alpha' }, reasonCode: 'ROUTER_PLAN_COVERS_ACTION',
      basedOnCaseVersion: 'case-version-1', actorCallerRef: 'caller:leader',
    })).ok).toBe(true)
    expect((await applyReviewAssignment(deps, {
      kind: 'retired', rootSessionId: ROOT_A, approvalCaseId: CASE_ID, currentLegRequestId: 'leg-request-1',
      target: { kind: 'instance', instanceId: 'inst-alpha' }, reasonCode: 'HANDOFF_COMPLETED',
      basedOnCaseVersion: 'case-version-2', actorCallerRef: 'caller:leader',
    })).ok).toBe(true)
    // A decision drafted against the live assignment, admitted after the retirement: the fold stands terminal,
    // and the answer is the kernel's retirement-vocabulary code, verbatim.
    const outcome = await w.admit(w.request({ decisionKind: 'transferred', targetInstanceId: 'inst-beta' }), LEADER_CALLER)
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.refusal).toBe('REVIEW_ASSIGNMENT_NO_ACTIVE_ASSIGNMENT')
    observedRefusals.add(outcome.refusal)
  })

  it('a claimed expectedPreviousEpoch that the fold disagrees with is refused, naming both numbers', async () => {
    const w = await world()
    const outcome = await w.admit(w.request({ expectedPreviousEpoch: 7 }), LEADER_CALLER)
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.refusal).toBe('ADMISSION_STALE_INTENT')
    expect(outcome.detail).toContain('7')
    expect(outcome.detail).toContain('0')
    // And the honest claim passes: the refusal above is the comparison working, not a blanket ban.
    expect((await w.admit(w.request({ expectedPreviousEpoch: 0 }), LEADER_CALLER)).ok).toBe(true)
  })

  it('every admit re-runs the whole predicate: the resolver is reached on EVERY call, never once', async () => {
    const w = await world()
    const ports = w.ports()
    await w.admit(w.request({}), HUMAN_CALLER, ports)
    await w.admit(w.request({}), HUMAN_CALLER, ports)
    expect(w.resolveCalls()).toBe(2)
    expect(ports.calls.ledger()).toBe(2)
  })
})

// --- D-9, observed: every code the pass-through list declares is seen coming out of `admit`, code AND words ----------

describe('D-9 pass-through: each declared code is observed through admit, with the kernel sentence unedited', () => {
  /**
   * Round 1 of #522 (F-I1b1-1 and F-I1b1-4, 2026-10-31). Until this round the list was backed by a SUBSET pin
   * only: every member must be a kernel code. That is true of a list which also carries a code the pre-flight can
   * never return — and the module header claimed the census had "proved this line by red on the draft's sixth
   * entry". Re-measured at head 4e9b20a62: adding `REVIEW_ASSIGNMENT_INPUT_MALFORMED` (a real kernel code that
   * `checkAssignmentMutation` does not emit) as a sixth member stays GREEN, `Tests 158 passed (158)`. The subset
   * pin accepts it, and the census only asks that OBSERVED codes belong to a declared vocabulary — declaring a
   * code adds no obligation to produce one. So the instrument never proved the line it was cited for.
   *
   * These legs are the obligation: one leg per member, each seeding the REAL family through the REAL writer and
   * reading the answer through `admit`, pinned on the code with `toBe` and on the kernel's own sentence as the
   * tail of the detail. The closing leg of the file then compares this list against what those call sites
   * actually observed, in both directions, so a seventh member with no leg is red and a member whose producer
   * stops emitting it is red on its own leg, naming the code.
   */
  async function worldWithOneActiveAssignment(): Promise<World> {
    const w = await world()
    const seeded = await applyReviewAssignment(writerDeps(w.domain), {
      kind: 'created', rootSessionId: ROOT_A, approvalCaseId: CASE_ID, currentLegRequestId: 'leg-request-1',
      target: { kind: 'instance', instanceId: 'inst-alpha' }, reasonCode: 'ROUTER_PLAN_COVERS_ACTION',
      basedOnCaseVersion: 'case-version-1', actorCallerRef: 'caller:leader',
    })
    // The seed goes through the real writer, and the leg says out loud when the seed itself fails: a leg that
    // asserts a refusal against a family it never managed to move is the vacuity this file keeps hunting.
    expect(seeded.ok, 'the real writer refused to seed the family — every leg below would be measuring nothing').toBe(true)
    return w
  }

  function expectPassedThrough(outcome: AssignmentAdmissionOutcome, code: string, kernelWords: string): void {
    expect(outcome.ok, `${code} was expected as a refusal, and admit answered ok`).toBe(false)
    if (outcome.ok) return
    expect(outcome.refusal, `${code} must arrive under the kernel's name — an ADMISSION_ code here is the relabelling D-9 forbids`).toBe(code)
    expect(
      (ASSIGNMENT_ADMISSION_PASSTHROUGH_CODES as readonly string[]).includes(outcome.refusal),
      `${code} is no longer declared pass-through while a leg still observes it: the list and its evidence moved apart`,
    ).toBe(true)
    expect(outcome.detail, 'the wrapper that says WHICH rule refused is part of the answer').toContain(
      'the kernel pre-flight (the same rule the writer applies inside its lock) refused',
    )
    // The kernel's sentence as the TAIL, unedited: `endsWith` rather than `toContain` so a rewrite that keeps the
    // words inside a paraphrase is still red. This is what "structurally verbatim" pays for.
    expect(outcome.detail.endsWith(`: ${kernelWords}`), `the kernel's words were rewritten — detail was: ${outcome.detail}`).toBe(true)
  }

  it('an unreconciled family passes ROW_UNPARSEABLE through with the fold row count in the kernel\u2019s own words', async () => {
    const w = await world()
    const foreignPayload = {
      rootSessionId: ROOT_B, approvalCaseId: CASE_ID, currentLegRequestId: 'leg-request-1', targetKind: 'instance',
      targetInstanceId: 'inst-alpha', assignmentEpoch: 1, previousEpoch: 0, reasonCode: 'ROUTER_PLAN_COVERS_ACTION',
      basedOnCaseVersion: 'case-version-1', actorCallerRef: 'caller:leader',
    }
    const sequence = await w.domain.repositories.ledger.allocateSequence()
    await w.domain.repositories.ledger.put(
      ledgerEntryRecord(sequence, ROOT_A, { factType: REVIEW_ASSIGNMENT_FACT_TYPES.created, payload: foreignPayload }) as
        Parameters<TeamDomain['repositories']['ledger']['put']>[0],
    )
    expectPassedThrough(
      await w.admit(w.request({}), LEADER_CALLER),
      'REVIEW_ASSIGNMENT_ROW_UNPARSEABLE',
      '1 row(s) of this family could not be applied; re-read before writing',
    )
  })

  it('a second create on a live family passes ALREADY_ACTIVE through with the epoch the kernel named', async () => {
    const w = await worldWithOneActiveAssignment()
    expectPassedThrough(
      await w.admit(w.request({}), LEADER_CALLER),
      'REVIEW_ASSIGNMENT_ALREADY_ACTIVE',
      'epoch 1 already exists',
    )
  })

  it('a transfer onto a retired family passes NO_ACTIVE_ASSIGNMENT through, naming the fact kind', async () => {
    const w = await worldWithOneActiveAssignment()
    const deps = writerDeps(w.domain)
    const retired = await applyReviewAssignment(deps, {
      kind: 'retired', rootSessionId: ROOT_A, approvalCaseId: CASE_ID, currentLegRequestId: 'leg-request-1',
      target: { kind: 'instance', instanceId: 'inst-alpha' }, reasonCode: 'HANDOFF_COMPLETED',
      basedOnCaseVersion: 'case-version-2', actorCallerRef: 'caller:leader',
    })
    expect(retired.ok, 'the retirement seed failed — this leg would then be asserting a refusal against a live family').toBe(true)
    expectPassedThrough(
      await w.admit(w.request({ decisionKind: 'transferred', targetInstanceId: 'inst-beta' }), LEADER_CALLER),
      'REVIEW_ASSIGNMENT_NO_ACTIVE_ASSIGNMENT',
      'a transferred fact needs a live assignment',
    )
  })

  it('a transfer naming a leg the family does not stand on passes LEG_MISMATCH through, naming BOTH legs', async () => {
    // The code this file had never produced: the fold stands at `leg-request-1`, the decision names another, and
    // the refusal is the kernel's sentence with both terms in it. A pass-through list member nobody drives is
    // how this list acquired a code it could not pass, so each member now carries its own producer.
    const w = await worldWithOneActiveAssignment()
    expectPassedThrough(
      await w.admit(w.request({ decisionKind: 'transferred', currentLegRequestId: 'leg-request-9', targetInstanceId: 'inst-beta' }), LEADER_CALLER),
      'REVIEW_ASSIGNMENT_LEG_MISMATCH',
      'the family stands at leg leg-request-1, the request names leg-request-9',
    )
  })

  it('a transfer to the target the family already stands on passes TARGET_UNCHANGED through, unreworded', async () => {
    const w = await worldWithOneActiveAssignment()
    expectPassedThrough(
      await w.admit(w.request({ decisionKind: 'transferred', targetInstanceId: 'inst-alpha' }), LEADER_CALLER),
      'REVIEW_ASSIGNMENT_TARGET_UNCHANGED',
      'the case is already assigned to that target',
    )
  })
})

// --- S-7 ------------------------------------------------------------------------------------------

describe('S-7: the feature switch refuses assembly; it never defaults', () => {
  it('off for the team means NO GATE OBJECT and no port reached — there is nothing to short-circuit', async () => {
    const ports = barePorts()
    const opened = openAssignmentAdmission({ feature: 'off' }, ports)
    expect(opened.ok).toBe(false)
    if (opened.ok) return
    observedRefusals.add(opened.refusal)
    expect(opened.refusal).toBe('ADMISSION_DISABLED_FOR_TEAM')
    expect(ports.calls.team).toBe(0)
    expect(ports.calls.resolve).toBe(0)
    expect(ports.calls.ledger).toBe(0)
  })

  it('every value outside the closed two fails assembly, so a typo is a defect and not a silently-off team', async () => {
    for (const bad of ['ON', 'true', '', 'yes', 1, true, null, undefined, { on: true }, 'disabled']) {
      const opened = openAssignmentAdmission({ feature: bad as unknown }, barePorts())
      expect(opened.ok, JSON.stringify(bad)).toBe(false)
      if (opened.ok) continue
      observedRefusals.add(opened.refusal)
      expect(opened.refusal, JSON.stringify(bad)).toBe('ADMISSION_FEATURE_VALUE_UNKNOWN')
    }
    // A config with the field absent refuses too: absence is not a default, in either direction (D-8).
    const absent = openAssignmentAdmission({} as { feature: unknown }, barePorts())
    expect(absent.ok).toBe(false)
    expect([...ASSIGNMENT_ADMISSION_FEATURE_VALUES].sort()).toEqual(['off', 'on'])
  })

  it('on opens a gate whose feature is the literal on — which config opened it is assertable, not commented', async () => {
    const opened = openAssignmentAdmission({ feature: 'on' }, barePorts())
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    expect(opened.gate.feature).toBe('on')
  })
})

// --- S-8 ------------------------------------------------------------------------------------------

describe('S-8: the full unfiltered ledger law, bound by the blindness of the dishonest reader', () => {
  it('a mixed real ledger (foreign fact types, other cases, other teams) admits the real decision through', async () => {
    const w = await world({ seedRootB: true })
    const deps = writerDeps(w.domain)
    // Real rows from every direction the D-6 law refuses to filter: a foreign fact type, another case of this
    // team, a full assignment of ANOTHER team, and then this case's created row written by the real writer.
    const foreignSequence = await w.domain.repositories.ledger.allocateSequence()
    await w.domain.repositories.ledger.put(
      ledgerEntryRecord(foreignSequence, ROOT_A, { factType: 'member-created', payload: { note: 'not this fold' } }) as
        Parameters<TeamDomain['repositories']['ledger']['put']>[0],
    )
    await applyReviewAssignment(deps, {
      kind: 'created', rootSessionId: ROOT_B, approvalCaseId: CASE_ID, currentLegRequestId: 'leg-request-1',
      target: { kind: 'instance', instanceId: 'inst-beta' }, reasonCode: 'ROUTER_PLAN_COVERS_ACTION',
      basedOnCaseVersion: 'case-version-1', actorCallerRef: 'caller:leader',
    })
    await applyReviewAssignment(deps, {
      kind: 'created', rootSessionId: ROOT_A, approvalCaseId: 'approval-case-2', currentLegRequestId: 'leg-2',
      target: { kind: 'instance', instanceId: 'inst-alpha' }, reasonCode: 'ROUTER_PLAN_COVERS_ACTION',
      basedOnCaseVersion: 'case-version-1', actorCallerRef: 'caller:leader',
    })
    await applyReviewAssignment(deps, {
      kind: 'created', rootSessionId: ROOT_A, approvalCaseId: CASE_ID, currentLegRequestId: 'leg-request-1',
      target: { kind: 'instance', instanceId: 'inst-alpha' }, reasonCode: 'ROUTER_PLAN_COVERS_ACTION',
      basedOnCaseVersion: 'case-version-1', actorCallerRef: 'caller:leader',
    })
    // The decision under admission is a transfer on case 1 of team A, same leg, new target — legal, and the
    // honest reader ADMITS it at epoch 2: the foreign fact type, the other case, and the other team's whole
    // assignment all crossed the same unfiltered list and were identified as not-this-fold, silently, exactly
    // as the fold's contract says. The proof the fold really saw them (and was not fed a filtered world) is the
    // discriminator below: re-admitting `created` for this case answers ALREADY_ACTIVE, a fact only a fold
    // that saw case 1's real history can state.
    const outcome = await w.admit(w.request({ decisionKind: 'transferred', targetInstanceId: 'inst-beta' }), LEADER_CALLER)
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.nextAssignmentEpoch).toBe(2)
    const discriminator = await w.admit(w.request({}), LEADER_CALLER)
    expect(discriminator.ok).toBe(false)
    if (discriminator.ok) return
    expect(discriminator.refusal).toBe('REVIEW_ASSIGNMENT_ALREADY_ACTIVE')
    observedRefusals.add(discriminator.refusal)
  })

  it('the same ledger through a reader that hides one row turns the refusal into acceptance — the contract is the only shield', async () => {
    // D-6's disclosure, made observable instead of stated: with the foreign-under-my-root row seeded (S-4's
    // world), the honest full-list reader refuses with the kernel code, and the root-filtering "optimisation"
    // — the exact lie the port contract forbids — answers ok. No defensive check inside admission can tell
    // these apart, which is precisely why the port demands the full, unfiltered list.
    const w = await world()
    const foreignPayload = {
      rootSessionId: ROOT_B, approvalCaseId: CASE_ID, currentLegRequestId: 'leg-request-1',
      targetKind: 'instance', targetInstanceId: 'inst-alpha', assignmentEpoch: 1, previousEpoch: 0,
      reasonCode: 'ROUTER_PLAN_COVERS_ACTION', basedOnCaseVersion: 'case-version-1', actorCallerRef: 'caller:leader',
    }
    const sequence = await w.domain.repositories.ledger.allocateSequence()
    await w.domain.repositories.ledger.put(
      ledgerEntryRecord(sequence, ROOT_A, { factType: REVIEW_ASSIGNMENT_FACT_TYPES.created, payload: foreignPayload }) as
        Parameters<TeamDomain['repositories']['ledger']['put']>[0],
    )
    const honest = await w.admit(w.request({}), LEADER_CALLER)
    expect(honest.ok).toBe(false)
    if (honest.ok) return
    expect(honest.refusal).toBe('REVIEW_ASSIGNMENT_ROW_UNPARSEABLE')
    const lier: AssignmentAdmissionPorts = {
      teamRootExists: () => true,
      resolveCaller: (root, caller) => resolveCaller(w.domain.repositories, root, caller),
      // The forbidden "helpful" adapter: same real rows, one predicate added.
      ledger: { list: () => ledgerRows(w.domain).filter((row) => !(row.rootSessionId === ROOT_A && (row.payload as Record<string, unknown>)['rootSessionId'] === ROOT_B)) },
    }
    const lied = await w.admit(w.request({}), LEADER_CALLER, lier)
    expect(lied.ok, 'if this flips to false, admission grew a defence the port contract promised it would not need').toBe(true)
  })
})

// --- S-9 ------------------------------------------------------------------------------------------

describe('S-9: the decision mechanism exists in source, and the closed consumer set is pinned', () => {
  it('the module imports nothing outside the lane allow-list — the BLOCKED-WIRING claim is measured, not narrated', () => {
    const source = readFileSync(MODULE_PATH, 'utf8')
    const specifiers = [...source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['"`]([^'"`\n]+)['"`]/g)]
      .map((m) => m[1] as string)
    expect([...new Set(specifiers)].sort()).toEqual([
      '../../contracts/src/index.js',
      './facts.js',
      './types.js',
      './writer.js',
    ])
    expect(source).not.toMatch(/node:/)
    // The two refusals this PR made (§9's rule: refuse the wiring, name the reason) are leg-bound here: a later
    // edit that quietly imports `../control/...` or `../admission/...` turns this red, not just the hygiene spec.
    expect(specifiers.some((s) => s.includes('control') || s.includes('admission/'))).toBe(false)
    expect(source).toContain('BLOCKED-WIRING')
    expect(source).toContain('resolveCaller')
    expect(source).toContain('CONTROL_RESOLVER_ROLES')
  })

  it('the mechanism is present: the resolver result, the closure table, and the kernel pre-flight are all consulted', () => {
    // Deleting any of these needles from the module turns a behavior leg above red (each needle is what the
    // named leg's refusal depends on); this leg's job is only to refuse a refactor that relocates the needles
    // into dead code while the behavior legs keep their wiring through something else.
    const source = readFileSync(MODULE_PATH, 'utf8')
    expect(source).toMatch(/ports\.resolveCaller\(/)
    expect(source).toMatch(/ASSIGNMENT_ADMISSION_ROLE_CLOSURE\[/)
    expect(source).toMatch(/checkAssignmentMutation\(/)
    expect(source).toMatch(/foldReviewAssignmentRows\(/)
    expect(source).toMatch(/expectedPreviousEpoch !== preflight|!== preflight\.value\.expectedPreviousEpoch/)
  })

  it('ALLOWED_CONSUMERS is still empty, read out of the hygiene spec rather than remembered', () => {
    // S-9(b): "forgot to update ALLOWED_CONSUMERS" must be red. The hygiene spec itself fails if a production
    // importer appears while the list says none; this leg fails if the LIST is widened without the hygiene
    // walk noticing, so both directions of forgetting have an owner.
    const hygiene = readFileSync(HYGIENE_PATH, 'utf8')
    const block = /const ALLOWED_CONSUMERS(?::[^=]+)?\s*=\s*\[([\s\S]*?)\]/.exec(hygiene)
    expect(block, 'ALLOWED_CONSUMERS moved out of the hygiene spec — re-read it, do not guess').not.toBeNull()
    const consumers = [...(block?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1] as string)
    expect(consumers).toEqual([])
  })
})

// --- pins: the tables this module borrows, read from their real owners -----------------------------------------

describe('the borrowed tables, pinned to their real owners', () => {
  it('the role-closure mirror equals CONTROL_RESOLVER_ROLES, both directions, every kind', () => {
    // BLOCKED-WIRING 1's other half: the lane keeps a frozen mirror because its hygiene law forbids the import;
    // this leg is the reason a mirror is allowed to exist. Drift in either direction is red: a mirror that
    // drops a kind would default-allow it, one that adds one would invent authority nobody granted.
    expect(Object.keys(ASSIGNMENT_ADMISSION_ROLE_CLOSURE).sort()).toEqual(Object.keys(CONTROL_RESOLVER_ROLES).sort())
    for (const kind of Object.keys(CONTROL_RESOLVER_ROLES)) {
      expect([...(ASSIGNMENT_ADMISSION_ROLE_CLOSURE[kind] ?? [])].sort()).toEqual([...((CONTROL_RESOLVER_ROLES as Record<string, readonly string[]>)[kind] ?? [])].sort())
    }
  })

  it('the resolve path the pin is pinned AGAINST still reads the constant it is supposed to, and its refusal still has the message shape', () => {
    // The source-text stand-in for the ENV-REFUSED Host leg, with its size stated (round 1 of #522, F-I1b1-3,
    // 2026-10-31): BOTH assertions below are FILE-scoped, which is the most a plugin may ask of a host file it is
    // forbidden to import. Measured consequence, so the sentence is not optimism: replacing the resolve path's own
    // read at `service.ts:2622` with a hand-copied list leaves this leg GREEN (three other sites still match the
    // pattern), and rewording that site's refusal leaves it GREEN (the phrase survives at the escalate twins). So
    // the honest job here is "the owner still consults the constant somewhere, and still uses these words
    // somewhere"; drift of the SPECIFIC site is the host's, and the module header says that where a reader meets
    // the line-number citation.
    const service = readFileSync(CONTROL_SERVICE_PATH, 'utf8')
    expect(service).toMatch(/CONTROL_RESOLVER_ROLES\s*\[/)
    expect(service).toContain('is not a resolver for kind')
  })

  it('the caller-role and claim vocabularies are the owners sets, not copies that feel right', () => {
    expect([...ASSIGNMENT_ADMISSION_CALLER_ROLES].sort()).toEqual([...CALLER_ROLE_VALUES].sort())
    expect([...ASSIGNMENT_ADMISSION_CLAIMABLE_ACTOR_KINDS].sort()).toEqual([...REMOTE_MUTATION_ACTOR_KINDS].sort())
    // Claim == resolvable, today — and if the owner grows a kind admission does not claim, that is fine here:
    // admission SCREENS claims against its own list and refuses contradictions, so a wider owner can only
    // produce ADMISSION_REQUEST_MALFORMED for the new claim, never a silent pass.
    expect(new Set(ASSIGNMENT_ADMISSION_CLAIMABLE_ACTOR_KINDS).size).toBe(ASSIGNMENT_ADMISSION_CLAIMABLE_ACTOR_KINDS.length)
  })

  it('the pass-through list is a subset of the kernel vocabulary — a code you cannot pass is a code you will invent', () => {
    for (const code of ASSIGNMENT_ADMISSION_PASSTHROUGH_CODES) {
      expect(REVIEW_ASSIGNMENT_REFUSALS as readonly string[], `${code} is not the kernel's to pass through`).toContain(code)
    }
  })
})

// --- S-10 (as far as this tree can take it): the last producing legs; the census itself is the file's final leg ----

describe('S-10 / producer legs the census needs, driven where their codes live', () => {
  it('a ledger that cannot be walked refuses in the read domain, with its own code and no fold', async () => {
    const w = await world()
    const broken: AssignmentAdmissionPorts = {
      teamRootExists: () => true,
      resolveCaller: (root, caller) => resolveCaller(w.domain.repositories, root, caller),
      ledger: { list: () => { throw new Error('medium offline') } },
    }
    const outcome = await w.admit(w.request({}), LEADER_CALLER, broken)
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.refusal).toBe('ADMISSION_LEDGER_UNREADABLE')
    expect(outcome.detail).toContain('medium offline')
    // Same domain, non-array answer: the refusal is the code, not an exception escaping the predicate.
    const nonArray: AssignmentAdmissionPorts = {
      teamRootExists: () => true,
      resolveCaller: (root, caller) => resolveCaller(w.domain.repositories, root, caller),
      ledger: { list: () => ({ not: 'an array' }) as unknown as readonly ReviewAssignmentLedgerRow[] },
    }
    const second = await w.admit(w.request({}), LEADER_CALLER, nonArray)
    expect(second.ok).toBe(false)
    if (second.ok) return
    expect(second.refusal).toBe('ADMISSION_LEDGER_UNREADABLE')
  })

  it('a throwing resolver answers with a refusal carrying its words, never with an exception through the gate', async () => {
    const w = await world()
    const thrower: AssignmentAdmissionPorts = {
      teamRootExists: () => true,
      resolveCaller: () => { throw new Error('resolver exploded') },
      ledger: { list: () => [] },
    }
    const outcome = await w.admit(w.request({}), MEMBER_CALLER, thrower)
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.refusal).toBe('ADMISSION_CALLER_UNRESOLVED')
    expect(outcome.detail).toContain('resolver exploded')
  })
})

// --- the floors this module stands on and does not sell as walls (round 1 of #522: F-I1b1-5, F-I1b1-6, F-I1b1-7) -----

describe('the disclosed floors of the injected ports, pinned as they ARE and not as the wiring will be', () => {
  /**
   * Three findings of round 1 of #522 (2026-10-31) have the same shape: the module's prose said more than the
   * code does. F-I1b1-5 — the detail sentence promises "its words travel verbatim", and for a resolver that
   * throws a PRIMITIVE there are no words to travel: `describeFailure` falls through to `typeof error`. F-I1b1-6 —
   * the door reads the resolver's answer for a role and for a member row's ROOT, and compares nothing else, so a
   * member row naming a different instance, or a `humanId` echo that contradicts the caller, passes. F-I1b1-7 —
   * the identity object handed in by the wiring is never shape-checked by this module; the validator that would
   * check it (`isActionCaller` at `packages/runtime/control/service.ts:1033`) is upstream, module-private, and
   * not on this path at all.
   *
   * Each of those is now written into the module header's STATED-ONLY block and the `resolveCaller` port doc.
   * They are ALSO pinned here, as behaviour, because prose without a leg drifts: the leg that pins a floor makes
   * the next person who "hardens" the door explain why the floor moved, and the leg that pins what IS checked
   * makes the next person who removes a check explain that instead. Neither floor is an aspiration, and the
   * messages below say which way each of them is allowed to change.
   */
  function resolverReturning(authority: unknown): AssignmentAdmissionPorts {
    return {
      teamRootExists: () => true,
      resolveCaller: () => authority as AssignmentCallerAuthority,
      ledger: { list: () => [] },
    }
  }

  function resolverThrowing(thrown: unknown): AssignmentAdmissionPorts {
    return {
      teamRootExists: () => true,
      resolveCaller: () => { throw thrown },
      ledger: { list: () => [] },
    }
  }

  it('the verbatim transport carries the words a throw CAN carry, and only those: a primitive throw arrives as its type name (F-I1b1-5)', async () => {
    const w = await world()
    // What survives, measured first, so the floor below is a boundary and not a complaint.
    const message = await w.admit(w.request({}), MEMBER_CALLER, resolverThrowing(new Error('resolver exploded')))
    expect(message.ok).toBe(false)
    if (!message.ok) expect(message.detail).toContain('resolver exploded')

    const coded = Object.assign(new Error('no route to the resolver'), { code: 'CALLER_NOT_FOUND' })
    const codedOutcome = await w.admit(w.request({}), MEMBER_CALLER, resolverThrowing(coded))
    expect(codedOutcome.ok).toBe(false)
    if (!codedOutcome.ok) {
      // The lawful provider of this port (`resolveCaller`) throws exactly this shape: `TeamRuntimeError` carries
      // its diagnosis in a closed `code` property, so the transport takes the code as well as the message.
      expect(codedOutcome.detail).toContain('CALLER_NOT_FOUND')
      expect(codedOutcome.detail).toContain('no route to the resolver')
    }

    const shaped = await w.admit(w.request({}), MEMBER_CALLER, resolverThrowing({ code: 'RESOLVER_DOWN', problem: 'no route to the resolver' }))
    expect(shaped.ok).toBe(false)
    if (!shaped.ok) expect(shaped.detail).toContain('RESOLVER_DOWN — no route to the resolver')

    // And the floor. A primitive has no message, no code, no problem — `describeFailure` says what it is
    // (`typeof error`) and the string the resolver threw is GONE from the answer.
    for (const [thrown, typeName] of [['no route to the resolver', 'string'], [4_711, 'number'], [null, 'object']] as const) {
      const outcome = await w.admit(w.request({}), MEMBER_CALLER, resolverThrowing(thrown))
      expect(outcome.ok).toBe(false)
      if (outcome.ok) continue
      expect(outcome.refusal).toBe('ADMISSION_CALLER_UNRESOLVED')
      expect(outcome.detail.endsWith(`: ${typeName}`), `a primitive throw must degrade to its type name, detail was: ${outcome.detail}`).toBe(true)
      // The words are not merely absent from the front of the sentence, they are absent FROM THE ANSWER. Pinned
      // because the sentence the module writes is "its words travel verbatim", and this leg is the honest scope
      // of that sentence: the words a thrown value CARRIES, in one of the three shapes above.
      expect(outcome.detail).not.toContain('no route to the resolver')
      expect(outcome.detail).not.toContain('4711')
    }
    // A null throw is the sharpest case, so it is said out loud rather than left inside the loop: `typeof null`
    // is 'object', which is a worse answer than a stack trace would have been. The disclosure in the port doc is
    // the fix this lane is allowed to make — the door does not get to invent words for somebody else's throw.
    const nul = await w.admit(w.request({}), MEMBER_CALLER, resolverThrowing(null))
    expect(nul.ok).toBe(false)
    if (!nul.ok) expect(nul.detail).toBe('the caller-resolution entry point refused this caller, and its words travel verbatim: object')
  })

  it('the door reads a role and a member row\u2019s root out of the resolver\u2019s answer, and compares nothing else (F-I1b1-6)', async () => {
    const w = await world()
    // The shape the real `resolveCaller` returns for a Leader with no member row: a bare role. It admits — and
    // it is supposed to, or the honest provider of the port would be refused by its own consumer.
    const bare = await w.admit(w.request({ claimedActorKind: 'leader' }), LEADER_CALLER, resolverReturning({ role: 'leader' }))
    expect(bare.ok, 'a bare { role: \'leader\' } is what the lawful provider answers for a Leader, so this must stay true').toBe(true)

    // The floor: a member row WITHOUT a rootSessionId is not cross-checked against anything, and a member row
    // naming a DIFFERENT instance than the caller is not compared either. If this flips to false, the door grew
    // a check the port contract assigns to the wiring — say so in the port doc when you flip it, do not just
    // flip it, because the wiring owner is the party that knows what a callerMember means on this host.
    const noRoot = await w.admit(w.request({ claimedActorKind: 'leader' }), LEADER_CALLER, resolverReturning({ role: 'leader', callerMember: { instanceId: 'inst-forged-by-the-adapter' } }))
    expect(noRoot.ok, 'the door compares a member row ONLY when it carries a rootSessionId — the disclosed boundary').toBe(true)
    const wrongInstance = await w.admit(w.request({ claimedActorKind: 'leader' }), LEADER_CALLER, resolverReturning({ role: 'leader', callerMember: { rootSessionId: ROOT_A, instanceId: 'inst-another-member' } }))
    expect(wrongInstance.ok, 'the caller named the Leader; a member row naming another instance in the SAME team is not a contradiction this door reads').toBe(true)
    // A `humanId` echo that contradicts an instance caller is the same floor: the door has no opinion about it.
    const contradicted = await w.admit(w.request({ claimedActorKind: 'leader' }), LEADER_CALLER, resolverReturning({ role: 'leader', humanId: 'a-human-who-never-asked' }))
    expect(contradicted.ok, 'no layer below the wiring compares the humanId echo against the caller — stated, now pinned').toBe(true)

    // What IS checked, checked hard: a member row that names ANOTHER TEAM's root refuses, and the refusal names
    // both roots (S-4). This is the one cross-object comparison the door performs, so its words are pinned.
    const crossTeam = await w.admit(w.request({ claimedActorKind: 'leader' }), LEADER_CALLER, resolverReturning({ role: 'leader', callerMember: { rootSessionId: ROOT_B } }))
    expect(crossTeam.ok).toBe(false)
    if (crossTeam.ok) return
    expect(crossTeam.refusal).toBe('ADMISSION_CALLER_UNRESOLVED')
    expect(crossTeam.detail).toContain(ROOT_B)
    expect(crossTeam.detail).toContain(ROOT_A)
  })

  it('the identity object is taken as given: a caller the transport would refuse still resolves to a role here (F-I1b1-7)', async () => {
    const w = await world()
    const asCaller = (value: unknown): Parameters<AssignmentAdmissionPorts['resolveCaller']>[1] => value as Parameters<AssignmentAdmissionPorts['resolveCaller']>[1]
    // `{ kind: 'alien' }` is not an ActionCaller. The transport's screen (`isActionCaller`, control/service.ts)
    // returns false for it; `resolveCaller` never calls that screen, sees the Leader instance id, and answers
    // 'leader'. So an adapter that skips the transport's screen reaches this door with an identity no caller
    // grammar describes — and the door, by design, admits the ROLE the resolver gave.
    const alien = await w.admit(w.request({ claimedActorKind: 'leader' }), asCaller({ kind: 'alien', instanceId: LEADER_INSTANCE_ID }))
    expect(alien.ok, 'the door shape-checks nothing about the caller it forwards: the resolver\'s role is the whole answer').toBe(true)
    // `{ kind: 'human' }` with no humanId is the second one, and it is the one worth stating because a missing
    // field is the ordinary mistake, not an attack: it resolves 'human' with `humanId: undefined`.
    const bareHuman = await w.admit(w.request({ claimedActorKind: 'human' }), asCaller({ kind: 'human' }))
    expect(bareHuman.ok, 'a human caller with no humanId resolves — the screen that refuses it lives upstream and is not on this path').toBe(true)
    // And the upstream screen is measured, not remembered: it exists, it is the thing that would refuse both,
    // and it is module-private — so "the wiring owns it" is a statement about a file this lane may not edit.
    const service = readFileSync(CONTROL_SERVICE_PATH, 'utf8')
    expect(service).toMatch(/function isActionCaller\(caller: unknown\): caller is ActionCaller \{/)
    expect(/export function isActionCaller/.test(service), 'if the screen became importable, the BLOCKED-WIRING note in the module header would have to be re-read').toBe(false)
  })
})

// --- ENV-REFUSED (measured absences; nothing below is offered as a pass) ------------------------------------------

// --- REAL-HOST EVIDENCE: the legs round 1 left ENV-REFUSED, now measured on a booted host -----------------------

/**
 * `tests/kits/pr-i1b-real-host/pr-i1b-real-host.mjs` boots the pinned pristine host (`tests/deepseek-harness-test-use`
 * @ `TEST_USE_BASELINE_SHA`) with THIS worktree's built row mounted through the public profile-patch seam —
 * CORE PATCH BUDGET = 0, nothing writes into the host tree, and the run asserts that tree's `git status
 * --porcelain` is empty before and after — and asks the live host, over public seams only, who may resolve each
 * kind of control request. Its answer lands in `capture.json` beside this file's package. Round-1 finding
 * F-I1b1-3 said the lane pinned its closure against the production resolve path by VALUES and by two strings in
 * `service.ts`, "not what the resolve path returns when a host actually runs it". These legs are that missing
 * sentence, read off a host that ran.
 *
 * Degradation is part of the design, and round 2 of #522 (F-I1b2-4) put each arm on its own footing:
 *  - runtime materialized, capture absent → every capture-reading leg is RED and names the command to run: a
 *    runnable instrument that was not run is a lane failure, not an absence (this arm was always right);
 *  - runtime absent, capture present or not → a NAMED REFUSAL: the capture-reading legs SKIP, the block title
 *    carries the refused state (a reader of the report never sees "measured" beside a leg that measured
 *    nothing), and the run prints `real-host: N refused — pristine runtime absent; run … to materialize`.
 *    A refusal is neither red nor green — this lane's law is ENV-REFUSED ≠ PASS — and a fresh clone without
 *    the materialized runtime must not read as a failure either: round 1 had this arm right (a named, counted
 *    refusal), the round-1 fix redened it, and round 2 put it back.
 * The environment paths themselves stay measured per path, never assumed.
 */
const REPO_ROOT = join(RUNTIME_ROOT, '..', '..')
const EVIDENCE_ROOT = join(REPO_ROOT, 'dev', 'agent-workflow', 'evidence', 'alpha6-pr-i1b-real-host')
const CAPTURE_PATH = join(EVIDENCE_ROOT, 'capture.json')
const PRISTINE_HOST = join(REPO_ROOT, 'tests', 'deepseek-harness-test-use')
const TEST_HOMES = join(REPO_ROOT, 'tests', 'homes')
const SHARED_BASELINE = '/srv/workspace/dsh-stable-3-0.2.0-rc.2'

interface RealHostCell {
  readonly ingress: string
  readonly code: string
  readonly message: string
  readonly reachedClosure: boolean
  /**
   * Which gate spoke: `refused-by-closure` (the closure's own words), `allowed` (durable decision written),
   * `agreed-then-envelope-refused` (the closure ran first and agreed — the kit measured that order in the
   * row's own source — and the envelope gate behind it threw the visible refusal), or `unclassified`.
   */
  readonly closure: string
}

/**
 * The capture's shape AS THIS FILE READS IT — and the file is honest about being narrower than the record.
 * The kit writes MORE than this interface declares: `clientCommitHash`, `row`, `p6t6Row`, `worlds` and
 * `created` are recorded and read by nobody here, and inside the stamped directory `verdict.json` is pinned by
 * bytes and `MEASURED-LINES.txt` by existence only — the CONTENT of `host.log` and of `MEASURED-LINES.txt` is
 * read by nobody either (F-I1b4-3, 2026-10-31, re-inventoried after round 3 asked for exactly that). None of
 * them carries a published claim; `created`'s substance is independently re-derived by the live in-process
 * legs. `CAPTURE_FIELDS_UNREAD` is that inventory as a machine check, so the disclosure refreshes itself:
 * a field the kit starts recording and this file neither reads nor lists reddens inside `readRealHostCapture`.
 */
interface RealHostCapture {
  readonly kit: string
  readonly runStamp: string
  readonly laneHead: string
  readonly hostHead: string
  readonly hostBaselineSha: string
  readonly hostPorcelainBefore: number
  readonly hostPorcelainAfter: number
  readonly resolvePathOrder: { readonly ok: boolean; readonly closureLine: number | null; readonly envelopeLine: number | null; readonly measured: string }
  /** The two ports the run booted (matrix, enable) — re-checked against TEST_PORT_RANGES at read time. */
  readonly ports: readonly number[]
  readonly markers: readonly string[]
  readonly rootSessionId: string
  readonly rowConfigFields: readonly string[]
  readonly unknownCaller: { readonly code: string; readonly message: string }
  readonly memberAttempt: { readonly ingress: string; readonly as: string; readonly status: number; readonly error: string }
  readonly answers: Record<string, RealHostCell>
  readonly durableCensus: { readonly entries: number; readonly factTypes: readonly string[] }
  readonly enableCensus: { readonly entries: number; readonly factTypes: readonly string[] }
  readonly checks: readonly { readonly id: string; readonly ok: boolean; readonly measured: string }[]
}

/** Every field of the capture this file actually reads, in the record's own order. F-I1b4-3, other half. */
const CAPTURE_FIELDS_READ = [
  'kit', 'runStamp', 'laneHead', 'hostHead', 'hostBaselineSha', 'hostPorcelainBefore', 'hostPorcelainAfter',
  'resolvePathOrder', 'ports', 'markers', 'rootSessionId', 'rowConfigFields', 'unknownCaller', 'memberAttempt',
  'answers', 'durableCensus', 'enableCensus', 'checks',
] as const

/**
 * F-I1b4-3: recorded by the kit, unread here — the inventory, as a census rather than a sentence. Anything the
 * kit adds that is not in one of the two lists reddens the read, by name, until it is either read or disclosed
 * with the claim it does not carry. (The stamped directory's `host.log` content and `MEASURED-LINES.txt`
 * content belong to the same class and are named in the interface comment above; they are not object keys, so
 * the census cannot enumerate them.)
 */
const CAPTURE_FIELDS_UNREAD = ['clientCommitHash', 'row', 'p6t6Row', 'worlds', 'created'] as const

const hostEnvironment = {
  pristineRuntime: existsSync(join(PRISTINE_HOST, 'apps', 'cli', 'lib', 'bin.js')),
  testHomes: existsSync(TEST_HOMES),
  sharedBaseline: existsSync(SHARED_BASELINE),
  capture: existsSync(CAPTURE_PATH),
}

// The three arms (F-I1b2-4): refused (no runtime — capture or not), unrun instrument (runtime, no capture),
// measured. The block title carries the state so a leg that measures nothing can never read as a measurement.
const REAL_HOST_REFUSED = !hostEnvironment.pristineRuntime
const REAL_HOST_STATE = !hostEnvironment.pristineRuntime
  ? 'REFUSED — pristine runtime absent; the capture legs below are SKIPPED, not passed'
  : !hostEnvironment.capture
    ? 'UNRUN INSTRUMENT — runtime materialized, capture missing; every capture leg is RED'
    : 'measured'

const gitIn = (dir: string, args: readonly string[]): string => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).trim()
const gitOkIn = (dir: string, args: readonly string[]): boolean => {
  try {
    gitIn(dir, args)
    return true
  } catch {
    return false
  }
}
const porcelainCount = (tree: string): number => gitIn(tree, ['status', '--porcelain']).split('\n').filter((line) => line !== '').length

/**
 * Read the capture and bind it to the host that produced it, or return null AFTER the leg has stated its
 * refusal. The arms: (a) no pristine runtime — unreachable from here, the capture legs skip and the block
 * prints its counted refusal (a capture sitting in a clone with no runtime proves nothing and measures
 * nothing — F-I1b2-1 refuses to read it as evidence); (b) runtime present, no capture — RED naming the kit
 * command; (c) runtime + capture — the legs measure it, and reading it RE-MEASURES the machine: the runtime's
 * live HEAD and porcelain must equal what the capture recorded; the stamped evidence directory it names must
 * exist AND its `verdict.json` must be byte-identical to this file (F-I1b3-2 — an identity pin, not an
 * existence pin); the recorded ports must sit inside the imported `TEST_PORT_RANGES` and agree with the
 * process markers (F-I1b3-1/-4); the kit's gate-order measurement must re-run HERE against this tree's
 * `control/service.ts` and equal `resolvePathOrder` field for field (F-I1b3-3/-4); and `laneHead` must be a
 * real ancestor commit of this repository.
 *
 * WHAT THAT BINDS, at its exact size (round 4 of #522, F-I1b4-2 — the sentence this replaced claimed a red the
 * instrument cannot produce). The pins bind the capture to its own stamped evidence set (byte identity), and
 * bind both of them to the tree that exists now: gate order re-derived from THIS `service.ts`, the runtime's
 * live HEAD and porcelain, `laneHead` ancestry, the code each envelope cell carries. So a fabrication of
 * `capture.json` ALONE reddens here by name — one edited file cannot satisfy an identity pin over two — and
 * every drift of the tree under a still-committed capture reddens, seven legs deep. What no pin below can do
 * is bind the pair to "a host actually booted": a `capture.json` and a `<runStamp>/verdict.json` written
 * TOGETHER, with the live-re-measured fields kept honest and the ports merely in band, passes every assertion
 * here while naming a run that never happened on ports nothing ever bound (round 4's M-PAIR, reproduced again
 * at this commit: exit 0 with every leg of this file green — the counts are in memo §10.10). Only re-running
 * the kit turns this read into a measurement of a host; against a pair fabricated together the defence is git
 * review in front of the evidence files, and that is stated here rather than claimed away.
 */
function readRealHostCapture(): RealHostCapture | null {
  expect(REAL_HOST_REFUSED, 'a real-host capture leg ran with no pristine runtime — the refusal gate is broken').toBe(false)
  expect(
    hostEnvironment.capture,
    'the pristine runtime IS materialized at '
      + `${PRISTINE_HOST} but no real-host capture exists — run \`node tests/kits/pr-i1b-real-host/pr-i1b-real-host.mjs\` `
      + 'and commit the capture it writes. A runtime with no capture is an unrun instrument, not a refused leg.',
  ).toBe(true)
  const captureBytes = readFileSync(CAPTURE_PATH)
  const capture = JSON.parse(captureBytes.toString('utf8')) as RealHostCapture
  // F-I1b4-3: the unread-field disclosure is a census, not a paragraph. Everything the kit records must be
  // either read by this file or named in CAPTURE_FIELDS_UNREAD; a third state — recorded, unread, and
  // undisclosed — is how a capture quietly becomes prose again. Both directions, so a field that LEaves the
  // capture reddens this too: a stale list is the same rot on the other side.
  const captureKeys: readonly string[] = Object.keys(capture).sort()
  const disclosedKeys: readonly string[] = [...CAPTURE_FIELDS_READ, ...CAPTURE_FIELDS_UNREAD].sort()
  expect(captureKeys.filter((key) => !disclosedKeys.includes(key)),
    'the capture records fields this file neither reads nor discloses (F-I1b4-3): read them, or add them to CAPTURE_FIELDS_UNREAD with the claim they do not carry').toEqual([])
  expect(disclosedKeys.filter((key) => !captureKeys.includes(key)),
    'a field this file says it reads or leaves unread is no longer recorded by the kit — the two lists are stale on the other side, refresh them (F-I1b4-3)').toEqual([])
  expect(capture.kit, 'the capture next to this file was not written by the PR-I1b real-host instrument').toBe('pr-i1b-real-host')
  // A capture off the pinned baseline measures a different host; the comparison below would be a lie.
  expect(capture.hostBaselineSha, 'the capture was taken against a host baseline other than the pin this lane tests').toBe(TEST_USE_BASELINE_SHA)
  expect(capture.hostPorcelainBefore, 'the capture was taken with a dirty pristine host tree — CORE PATCH BUDGET = 0').toBe(0)
  expect(capture.hostPorcelainAfter, 'the real-host run left bytes in the pristine host tree').toBe(0)
  expect(capture.checks.filter((c) => !c.ok).map((c) => c.id), 'the capture records failed checks').toEqual([])
  // F-I1b2-1: the runtime is HERE, so bind the capture to it instead of trusting a file. Re-measure HEAD and
  // porcelain of the very tree the kit booted; require the stamped evidence directory the capture names to
  // exist with the two files that make the verdict; and bind `laneHead` to this repository's real history.
  expect(gitIn(PRISTINE_HOST, ['rev-parse', 'HEAD']),
    'the pristine runtime is no longer at the HEAD this capture recorded — the capture describes a different tree than the one that exists').toBe(capture.hostHead)
  expect(porcelainCount(PRISTINE_HOST),
    'the pristine runtime tree is dirty NOW — whatever this capture measured, the tree it measured has been written to since').toBe(capture.hostPorcelainBefore)
  expect(existsSync(join(EVIDENCE_ROOT, capture.runStamp, 'verdict.json')),
    `the stamped evidence directory the capture names (${EVIDENCE_ROOT}/${capture.runStamp}) has no verdict.json — this capture is not bound to an evidence set that exists`).toBe(true)
  expect(existsSync(join(EVIDENCE_ROOT, capture.runStamp, 'MEASURED-LINES.txt')),
    `the stamped evidence directory the capture names (${capture.runStamp}) has no MEASURED-LINES.txt — the verdict has no measured lines behind it`).toBe(true)
  // F-I1b3-2: existence was never agreement. The kit writes `capture.json` and `<runStamp>/verdict.json`
  // from ONE object in ONE run, so an honest pair is BYTE-IDENTICAL; a capture repointed at some other
  // real evidence set (round 3's MUT M1: the stale round-2 directory, whose verdict says 22 checks and
  // knows neither resolvePathOrder nor memberAttempt) survives an existence pin and dies here. This turns
  // the existence pin into an identity pin — the capture and the evidence set it names must be the same
  // bytes, or the run names two runs at once.
  const stampedVerdict = readFileSync(join(EVIDENCE_ROOT, capture.runStamp, 'verdict.json'))
  expect(stampedVerdict.equals(captureBytes),
    `capture.json and ${capture.runStamp}/verdict.json are not byte-identical — the capture names an evidence set that CONTRADICTS it `
    + '(an honest run writes both files from one object; a stamped verdict.json that differs is a different run, and this capture is pointing at it)').toBe(true)
  expect(gitOkIn(REPO_ROOT, ['cat-file', '-e', `${capture.laneHead}^{commit}`]),
    `capture.laneHead (${capture.laneHead}) is not a commit in this repository — a capture must name a lane head that existed`).toBe(true)
  expect(gitOkIn(REPO_ROOT, ['merge-base', '--is-ancestor', capture.laneHead, 'HEAD']),
    `capture.laneHead (${capture.laneHead}) is not an ancestor of this checkout — the capture claims a commit outside this branch's history`).toBe(true)
  // F-I1b3-1 / F-I1b3-4: the recorded ports stop being prose. The kit booted BOTH worlds inside the bands
  // it reads from tests/paths.mjs and recorded its own `ports-inside-test-port-ranges` measurement; this
  // leg re-derives the band membership from the SAME imported constant, binds the kit's check to exist,
  // and cross-reads each port against the process marker that names it (markers end `host<port>`). A
  // capture recording the old off-band shape — [3292, 3392], or any port + 100 — reddens here.
  const portChecks = capture.checks.filter((c) => c.id === 'ports-inside-test-port-ranges')
  expect(portChecks.length, 'the instrument stopped recording the in-band port measurement as a check — the ports would be an assertion again, not a measurement').toBe(1)
  expect(portChecks[0]?.ok, `the kit's own in-band port measurement failed in the recorded run: ${portChecks[0]?.measured ?? ''}`).toBe(true)
  expect(capture.ports?.length, `the capture must record exactly two boot ports (matrix, enable), got ${JSON.stringify(capture.ports)}`).toBe(2)
  expect(new Set(capture.ports).size, `both worlds cannot have booted on one port — captured ports ${JSON.stringify(capture.ports)}`).toBe(2)
  const bandLabel = TEST_PORT_RANGES.map(([lo, hi]) => `${lo}-${hi}`).join(' / ')
  const outOfBand = capture.ports.filter((p) => !TEST_PORT_RANGES.some(([lo, hi]) => p >= lo && p <= hi) || p === 3080 || p === 3180)
  expect(outOfBand,
    `the capture records boot port(s) ${JSON.stringify(outOfBand)} outside TEST_PORT_RANGES [${bandLabel}] (tests/paths.mjs) — `
    + 'only an in-band run is evidence; re-run `node tests/kits/pr-i1b-real-host/pr-i1b-real-host.mjs`, which since F-I1b3-1 boots both worlds in band and refuses out-of-band ports').toEqual([])
  expect(capture.markers?.[0]?.endsWith(`matrixhost${capture.ports[0]}`) === true && capture.markers?.[1]?.endsWith(`enablehost${capture.ports[1]}`) === true,
    `the recorded ports ${JSON.stringify(capture.ports)} do not agree with the process markers ${JSON.stringify(capture.markers)} — each marker ends host<port>, so ports and markers must tell the same story`).toBe(true)
  // The kit measured the gate order in the row's source; a cell recorded as agreed-then-envelope-refused
  // carries the envelope gate's code, whatever else a fabrication might write into it (F-I1b2-1's C12).
  expect(capture.resolvePathOrder?.ok, 'the capture did not measure the gate order — the agreement reading in the legs below would rest on prose').toBe(true)
  // F-I1b3-3 / F-I1b3-4: the order is no longer only asserted FROM the capture at read time — the kit's own
  // measurement function (`gate-order.mjs`, the repo's single implementation, imported not copied) re-runs
  // HERE against the very `control/service.ts` this file already opens for its other pins, and the result
  // must equal the capture field for field — ok, BOTH line numbers, and the measured sentence. A reorder of
  // the closure/envelope statements that skips a kit re-run reddens every capture-reading leg (round 3's
  // order-stale repro shipped 58 green; here it reddens seven), and `closureLine`/`envelopeLine` stop being
  // dead fields: they are compared, not just stored.
  const liveOrder = measureResolvePathGateOrder(readFileSync(CONTROL_SERVICE_PATH, 'utf8'))
  assertGateOrderAgreesWithCapture(liveOrder, capture.resolvePathOrder, 'this tree\'s packages/runtime/control/service.ts')
  for (const [key, cell] of Object.entries(capture.answers)) {
    if (cell.closure === 'agreed-then-envelope-refused') {
      expect(cell.code, `cell ${key} is recorded as envelope-refused but carries ${cell.code}`).toBe('TEAM_RUNTIME_ENVELOPE_OUT_OF_BOUNDS')
    }
  }
  return capture
}

// --- THE INSTRUMENT ITSELF (round 4 of #522, F-I1b4-1): the shared measurement, measured -------------------

/**
 * The four fields the read-time agreement is about, spelled from the CAPTURE's own type on purpose: the shape
 * `gate-order.d.mts` declares has to stay assignable to it, so drift between the module's declared output and
 * the field the capture records became a TYPE error here in addition to a red leg.
 */
type GateOrderRecord = RealHostCapture['resolvePathOrder']

/**
 * THE read-time agreement check, as ONE named function (F-I1b4-1). `readRealHostCapture` calls it for every
 * capture-reading leg and the fixture block below calls it directly, so the fixtures grade the check that
 * actually runs rather than a copy of it — a second copy is the round-2 drift class this file has spent three
 * rounds removing. `subject` is the only variable: it names what `live` was measured against, so the message
 * a synthetic-source leg prints cannot be mistaken for the message the real tree prints.
 */
function assertGateOrderAgreesWithCapture(live: GateOrderRecord, recorded: GateOrderRecord, subject: string): void {
  expect(live,
    `the kit's gate-order measurement, re-run at read time against ${subject}, disagrees with what the capture recorded — `
    + 'the resolve path was reordered (or edited) since the kit ran, or the capture was fabricated: re-run `node tests/kits/pr-i1b-real-host/pr-i1b-real-host.mjs` and commit the capture it writes').toEqual(recorded)
}

const GATE_ORDER_CLOSURE_MARKER = 'const allowedRoles = CONTROL_RESOLVER_ROLES[request.payload.kind]'
const GATE_ORDER_ENVELOPE_CALL = 'enforceEnvelope(RESOLVE_CONTROL_SPEC, request, caller)'

/**
 * A SYNTHETIC `packages/runtime/control/service.ts` for the legs below — no host, no runtime, no capture, so
 * these legs run in every arm, the runtime-absent one included. It carries the two anchors the measurement
 * scopes by, the body the caller hands in, and three decoy occurrences of the envelope marker OUTSIDE that
 * body: one in a comment above the function, one inside a string in another function, one in the sibling path
 * below it. That is the shape the real file has — measured at this commit: 4 whole-file matches of
 * `enforceEnvelope(` + whitespace + `RESOLVE_CONTROL_SPEC`, exactly 1 inside `resolveControl` — and it is the
 * shape that aborted round 4's own mutation attempt, because a whole-file count reads 4 and calls a clean tree
 * reordered. The expected line numbers are derived from the LINES by `findIndex`, a different route than the
 * module's `src.slice(0, fnStart + idx).split('\n').length`, so an expectation here is not the module's own
 * arithmetic quoted back to it.
 */
function synthControlSource(body: readonly string[]): { readonly src: string; readonly closureLine: number | null; readonly envelopeLine: number | null } {
  const lines = [
    '// Decoy 1 of 3, outside the body — a whole-file count sees it; the measurement must not.',
    '//   The resolve path calls enforceEnvelope(RESOLVE_CONTROL_SPEC, …) AFTER the role closure.',
    'function describeResolvePath(): string {',
    '  // Decoy 2: the same words inside a string, in a function that resolves nothing.',
    '  return \'resolveControl: enforceEnvelope(RESOLVE_CONTROL_SPEC, …) is the second gate\'',
    '}',
    'async function resolveControl(request: ResolveControlCommand, caller: Caller) {',
    ...body,
    '}',
    '',
    'async function commitAbandonmentFact(fact: AbandonmentFactCommand) {',
    '  // Decoy 3: the sibling path has its own envelope call, below the body the measurement scopes to.',
    '  enforceEnvelope(RESOLVE_CONTROL_SPEC, fact, caller)',
    '}',
    '',
  ]
  const at = (marker: string): number | null => {
    const index = lines.findIndex((line) => line.includes(marker))
    return index >= 0 ? index + 1 : null
  }
  return { src: lines.join('\n'), closureLine: at(GATE_ORDER_CLOSURE_MARKER), envelopeLine: at(GATE_ORDER_ENVELOPE_CALL) }
}

// The body, line by line under names: the two fixtures are then two literal orderings of the SAME eight
// lines, and the permutation assertion below proves it — "pure move" is an assertion, not a description.
const LINE_READ_TARGET = '  const target = await readTarget(request)'
const LINE_CLOSURE_COMMENT = '  // Role closure (BEFORE the envelope — invariant 37).'
const LINE_CLOSURE_CHECK = `  ${GATE_ORDER_CLOSURE_MARKER}`
const LINE_GUARD_OPEN = '  if (!allowedRoles.includes(caller.role)) {'
const LINE_GUARD_THROW = '    throw new ControlError(CONTROL_ERROR_CODES.CONTROL_RESOLVER_NOT_AUTHORIZED, \'role is not a resolver\')'
const LINE_GUARD_CLOSE = '  }'
const LINE_ENVELOPE_CALL = `  ${GATE_ORDER_ENVELOPE_CALL}`
const LINE_RECORD = '  return record(target)'

/** The honest order: read the target, close the roles, then the envelope, then record. */
const GATE_ORDER_BODY_HONEST: readonly string[] = [
  LINE_READ_TARGET, LINE_CLOSURE_COMMENT, LINE_CLOSURE_CHECK, LINE_GUARD_OPEN, LINE_GUARD_THROW, LINE_GUARD_CLOSE,
  LINE_ENVELOPE_CALL, LINE_RECORD,
]
/** The SAME eight lines with the envelope call moved above the closure — a pure move, nothing added or lost. */
const GATE_ORDER_BODY_MOVED: readonly string[] = [
  LINE_READ_TARGET, LINE_ENVELOPE_CALL, LINE_CLOSURE_COMMENT, LINE_CLOSURE_CHECK, LINE_GUARD_OPEN, LINE_GUARD_THROW,
  LINE_GUARD_CLOSE, LINE_RECORD,
]
const GATE_ORDER_HONEST = synthControlSource(GATE_ORDER_BODY_HONEST)
const GATE_ORDER_MOVED = synthControlSource(GATE_ORDER_BODY_MOVED)

describe('THE INSTRUMENT ITSELF (F-I1b4-1): the gate-order measurement is measured, on sources this file writes', () => {
  // Round 3 put ONE function behind BOTH instruments — the kit measures the gate order when it captures, this
  // file re-measures it when it reads. Sharing killed round 2's drift bug (two texts that could disagree) and
  // concentrated everything that remained into one 23-line body with no test of its own (round 4, F-I1b4-1).
  // Two mutations produced that body in minutes: `const ok = true` printed `Tests 58 passed (58)` and exit 0,
  // and `return CAPTURED` — the committed capture's four fields, returned for every source — did the same even
  // with the resolve path actually reordered. Both are reproduced in this session's report. They die here
  // because a constant cannot produce the line numbers of a source that has twenty of them, and cannot produce
  // `false` for a source the constant was never read from.
  //
  // THE LIMIT, stated where a reader meets it rather than three files away: the module is TEXTUAL. It scopes
  // to the `resolveControl` body, and the legs below GRADE that scoping instead of assuming it — three markers
  // outside the body do not count, and a body with no closure marker is refused even when the file is full of
  // the words. INSIDE the body it counts text, so a marker inside a comment counts too; the direction of that
  // error is refusal (`ok:false`), never a green this file would publish, and the thing a comment cannot forge
  // is the host's own answers in `capture.answers`, which the real-host legs read independently.

  it('measures a synthetic closure-before-envelope source as ok, at the lines THAT source has', () => {
    // The structure of the fixture is asserted before the module's answer is trusted — the same method law the
    // mutations follow: prove the input is the input you think you built.
    expect(GATE_ORDER_HONEST.src.split('enforceEnvelope(').length - 1,
      'the synthetic source stopped carrying the decoys that make this a body-scoping test').toBe(4)
    expect(GATE_ORDER_HONEST.closureLine, 'the synthetic honest source has no closure marker — the fixture broke').not.toBeNull()
    expect(GATE_ORDER_HONEST.envelopeLine, 'the synthetic honest source has no envelope call — the fixture broke').not.toBeNull()
    const order = measureResolvePathGateOrder(GATE_ORDER_HONEST.src)
    expect(order.ok, `the honest source did not measure honest: ${order.measured}`).toBe(true)
    expect(order.closureLine, `the module put the closure on the wrong line: ${order.measured}`).toBe(GATE_ORDER_HONEST.closureLine)
    expect(order.envelopeLine, `the module put the envelope on the wrong line: ${order.measured}`).toBe(GATE_ORDER_HONEST.envelopeLine)
    expect((order.envelopeLine ?? 0) > (order.closureLine ?? 0), 'the fixture built an envelope call BEFORE its closure — re-read the body').toBe(true)
    // The whole point for G3: a module that returns the committed capture's fields cannot answer 10 and 14.
    expect([order.closureLine, order.envelopeLine],
      'the module reported the COMMITTED CAPTURE’s line numbers for a synthetic twenty-line source — it is returning a constant, not measuring').toEqual([GATE_ORDER_HONEST.closureLine, GATE_ORDER_HONEST.envelopeLine])
    expect(order.measured, `the measured sentence stopped naming what it counted: ${order.measured}`).toContain('(closure markers=1, envelope calls=1)')
  })

  it('measures the SAME statements moved the other way as not ok — the reorder the instrument exists to catch', () => {
    // A pure move: same statements, same bytes, only the order swapped. Asserted, not asserted-about.
    expect([...GATE_ORDER_BODY_MOVED].sort(), 'the moved body is not the honest body permuted — this is an edit, not a move').toEqual([...GATE_ORDER_BODY_HONEST].sort())
    expect([...GATE_ORDER_MOVED.src].sort().join(''), 'the moved source is not a permutation of the honest source').toEqual([...GATE_ORDER_HONEST.src].sort().join(''))
    const order = measureResolvePathGateOrder(GATE_ORDER_MOVED.src)
    expect(order.ok, 'the envelope call sits BEFORE the role closure in this source and the module still certified it — the conjunction is gone').toBe(false)
    // Both line numbers are still reported, and still reported WHERE THEY ARE: the disagreement the read-time
    // leg publishes is field-for-field, not a bare boolean that could be faked by an `ok` alone.
    expect([order.closureLine, order.envelopeLine], `the module stopped reporting the moved lines: ${order.measured}`).toEqual([GATE_ORDER_MOVED.closureLine, GATE_ORDER_MOVED.envelopeLine])
    expect((order.envelopeLine ?? 0) < (order.closureLine ?? 0), 'the moved source does not actually have the envelope first — the fixture broke').toBe(true)
  })

  it('refuses a source with no role-closure marker at all, and says why in the sentence it returns', () => {
    const source = synthControlSource([LINE_READ_TARGET, LINE_ENVELOPE_CALL, LINE_RECORD])
    expect(source.closureLine, 'the fixture lost its own negative: the closure marker is still in the body').toBeNull()
    const order = measureResolvePathGateOrder(source.src)
    expect(order.ok, 'a resolveControl with no role closure at all measured as a closed resolve path').toBe(false)
    expect(order.closureLine, 'the module invented a closure line for a source that has none').toBeNull()
    expect(order.envelopeLine, `the envelope call is in this source at line ${source.envelopeLine}; the module lost it`).toBe(source.envelopeLine)
    expect(order.measured, `the measured sentence does not name the missing marker: ${order.measured}`).toContain('closure markers=0')
  })

  it('scopes to the resolveControl body: three markers outside it do not count, and a body with none is refused', () => {
    // The reviewer's own mutation attempt died on exactly this count — `enforceEnvelope(RESOLVE_CONTROL_SPEC`
    // appears 4 times in the real 5602-line file and once inside `resolveControl`. Here that shape is graded:
    // the honest body plus three out-of-body decoys must still read as ONE envelope call at ONE line.
    const wholeFile = GATE_ORDER_HONEST.src.split('enforceEnvelope(RESOLVE_CONTROL_SPEC').length - 1
    expect(wholeFile, 'the synthetic source no longer has the decoy shape of the real file (whole-file 4, body 1)').toBe(4)
    const honest = measureResolvePathGateOrder(GATE_ORDER_HONEST.src)
    expect(honest.measured, 'out-of-body decoys leaked into the count — the measurement is file-scoped again').toContain('(closure markers=1, envelope calls=1)')
    expect(honest.envelopeLine, 'a decoy outside the body was taken for the envelope call').toBe(GATE_ORDER_HONEST.envelopeLine)
    // And the other half: strip the markers from the BODY and the same file must be refused, whole-file noise
    // and all. A whole-file count would have found three of them and certified a resolve path with no gates.
    const bare = synthControlSource(['  return record(request)'])
    expect(bare.src.split('enforceEnvelope(RESOLVE_CONTROL_SPEC').length - 1, 'the decoys vanished with the body — the fixture no longer tests scoping').toBe(3)
    const refused = measureResolvePathGateOrder(bare.src)
    expect(refused.ok, 'a resolveControl with neither gate inside it measured as a closed resolve path because the words appear elsewhere in the file').toBe(false)
    expect([refused.closureLine, refused.envelopeLine], 'the module reported lines outside the body it claims to scope to').toEqual([null, null])
  })

  it('counts what is inside the body as written: a second envelope-shaped line in the body refuses to certify', () => {
    // The disclosed textual limit, graded rather than waved at. The module reads text, so a marker inside a
    // comment inside the body counts as if it were code. What matters is the DIRECTION: counting text can only
    // ever make this refuse, and a refusal sends the envelope cells to `unclassified` in the kit and turns the
    // read-time legs RED — it cannot make a wrong order read as a right one.
    const commented = synthControlSource([
      LINE_READ_TARGET,
      '  // The envelope (the resolve-control op) is written down here before it is called:',
      `  //   ${GATE_ORDER_ENVELOPE_CALL}`,
      LINE_CLOSURE_COMMENT, LINE_CLOSURE_CHECK, LINE_GUARD_OPEN, LINE_GUARD_THROW, LINE_GUARD_CLOSE,
      LINE_ENVELOPE_CALL, LINE_RECORD,
    ])
    const order = measureResolvePathGateOrder(commented.src)
    expect(order.ok, 'two envelope-shaped lines inside the body and the module still certified one').toBe(false)
    expect(order.measured, `the measured sentence hid the second call: ${order.measured}`).toContain('envelope calls=2')
    expect(order.envelopeLine, 'the module reports the FIRST envelope-shaped line, which here is the comment — the line it publishes is the line it read').toBe(commented.envelopeLine)
  })

  it('grades the comparison too: agreement passes, and a disagreement in any ONE field reddens', () => {
    // The module and the comparison are two instruments and round 4 found the second ungraded as well. This
    // leg calls the SAME function the capture legs call, so "the spec reddens when the measurement disagrees
    // with the capture" is a measured claim about this file, not a description of `toEqual`.
    const honest = measureResolvePathGateOrder(GATE_ORDER_HONEST.src)
    const moved = measureResolvePathGateOrder(GATE_ORDER_MOVED.src)
    expect(() => assertGateOrderAgreesWithCapture(honest, honest, 'the honest synthetic source')).not.toThrow()
    expect(moved, 'a pure move left the measurement untouched — the module is not reading the order, so nothing downstream of it is').not.toEqual(honest)
    const drifts: readonly (readonly [string, GateOrderRecord])[] = [
      ['ok', { ...honest, ok: !honest.ok }],
      ['closureLine', { ...honest, closureLine: (honest.closureLine ?? 0) + 5 }],
      ['envelopeLine', { ...honest, envelopeLine: moved.envelopeLine }],
      ['measured', { ...honest, measured: `${honest.measured} — words no run wrote` }],
    ]
    for (const [field, drifted] of drifts) {
      expect(() => assertGateOrderAgreesWithCapture(drifted, honest, `the synthetic source with ${field} replaced`),
        `a disagreement in ${field} alone passed the read-time agreement — the comparison is not field-for-field any more`).toThrow()
    }
  })

  it('is ONE implementation: the kit and this spec import gate-order.mjs and neither carries a copy', () => {
    // The sharing is what makes the read-time leg a measurement, and it is also the thing F-I1b4-1 indicts as an
    // ungraded single point. The grade is above; this leg keeps the premise true — round 2's bug was two copies
    // that could drift, and the day someone pastes the body back into a reader, agreement stops being evidence.
    const kitSource = readFileSync(join(REPO_ROOT, 'tests', 'kits', 'pr-i1b-real-host', 'pr-i1b-real-host.mjs'), 'utf8')
    const moduleSource = readFileSync(join(REPO_ROOT, 'tests', 'kits', 'pr-i1b-real-host', 'gate-order.mjs'), 'utf8')
    const selfSource = readFileSync(fileURLToPath(import.meta.url), 'utf8')
    expect(kitSource, 'the kit no longer imports the shared measurement — the two instruments are reading by different rules again').toContain('./gate-order.mjs')
    expect(selfSource, 'this spec no longer imports the shared measurement — the read-time leg is prose again').toContain('pr-i1b-real-host/gate-order.mjs')
    // The needle is assembled, not written out: spelled inline, this very line would be the second
    // definition the leg is hunting for, and a self-referential assertion is the shape F-I1b4-1 is about.
    const definition = ['function', 'measureResolve' + 'PathGateOrder'].join(' ')
    expect(kitSource.split(definition).length - 1, 'the kit carries a second definition of the measurement; agreement between copies proves nothing').toBe(0)
    expect(selfSource.split(definition).length - 1, 'this spec carries a second definition of the measurement; agreement between copies proves nothing').toBe(0)
    expect(moduleSource.split(['export', definition].join(' ')).length - 1,
      'the repo now has more than one definition of the gate-order measurement').toBe(1)
  })
})

/** Counted by the refusal line the block prints when the runtime is absent — the count is measured, not typed. */
let realHostCaptureLegs = 0
const itRealHost = (title: string, fn: () => void | Promise<void>): void => {
  realHostCaptureLegs += 1
  it.skipIf(REAL_HOST_REFUSED)(title, fn)
}

describe(`REAL-HOST (${REAL_HOST_STATE}): the resolve path answers the closure the way this lane mirrors it`, () => {
  // vitest 4 requires the first hook argument to be an object destructure (a named param throws
  // FixtureParseError); the SUITE task tree — the runner's own skip view that F-I1b3-6 reads — arrives as
  // the second argument, so the empty pattern binds nothing on purpose.
  // eslint-disable-next-line no-empty-pattern -- the empty destructure is required by vitest 4, not avoidance
  afterAll(({}, suite) => {
    if (!REAL_HOST_REFUSED) return
    // F-I1b3-6: the counter used to be self-tallied and decorative — `realHostCaptureLegs += 0` changed the
    // printed sentence and reddened nothing. The fix keeps the number but binds it to vitest's OWN view of
    // this suite: under REFUSED every capture leg is skipped, so the skipped-test count of this suite IS the
    // refusal count, read off the runner's task tree at teardown. A tampered tally (or a leg registered
    // without itRealHost) fails this expect — the refusal line may only print a count the runner confirms.
    const vitestSkipped = suite.tasks.filter((t) => t.type === 'test' && (t.mode === 'skip' || t.mode === 'todo')).length
    expect(vitestSkipped,
      `the block is about to print "${realHostCaptureLegs} refused" but vitest itself recorded ${vitestSkipped} skipped legs in this suite — the refusal count must be the runner's count (F-I1b3-6)`).toBe(realHostCaptureLegs)
    console.info(`real-host: ${realHostCaptureLegs} refused — pristine runtime absent; run the TEST_METHODS §2 recipe `
      + `(clone tests/deepseek-harness-test-use --local --no-hardlinks, detach ${TEST_USE_BASELINE_SHA}, install, build) to materialize it. `
      + 'Refused is not passed; this line is the refusal, printed and counted.')
  })

  it('the environment each real-host leg needs is measured per path, not assumed', () => {
    // The block above this one used to assert all three absences as the reason the legs could not run. Two of
    // them are false on this machine and asserting them would launder the arms into each other, so each path
    // is measured on its own and printed; the arm (refused / unrun / measured) is in the block title.
    console.info(`real-host environment: pristineRuntime=${hostEnvironment.pristineRuntime} testHomes=${hostEnvironment.testHomes} `
      + `capture=${hostEnvironment.capture} sharedBaseline=${hostEnvironment.sharedBaseline}`)
    // F-I1b2-5: the homes path is COMPUTED and CHECKED here — where the runtime exists, the kit's worlds live
    // in tests/homes (workspace-internal, TEST_METHODS §7); where it does not, the path is reported above.
    expect(!hostEnvironment.pristineRuntime || hostEnvironment.testHomes,
      'the pristine runtime is materialized but tests/homes/ is not — every kit world is workspace-internal (TEST_METHODS §7); re-read the recipe before trusting a capture').toBe(true)
    // The shared read-only baseline is still absent here — recorded because the §2 recipe clones from it when
    // present and from the local checkout when not, and the capture does not care which.
    expect(hostEnvironment.sharedBaseline, '/srv/workspace/dsh-stable-3-0.2.0-rc.2 reappeared: re-read TEST_METHODS §2 before trusting the clone recipe').toBe(false)
  })

  itRealHost('the host refused an unknown caller through the real resolver, and the SAME function says the SAME sentence in-process', async () => {
    const capture = readRealHostCapture()
    if (capture === null) return
    expect(capture.unknownCaller.code, `the host answered the unknown caller with ${capture.unknownCaller.code}`).toBe('TEAM_RUNTIME_CALLER_NOT_FOUND')
    // The port this lane injects is `resolveCaller(repositories, root, caller)` — the same exported function the
    // host calls. Feed it the caller shape the host was fed and compare the sentences with only the team root
    // substituted: same function, same refusal, same words. If either side's wording moves, this is red.
    const w = await world({ seedMember: false })
    let inProcess = ''
    try {
      resolveCaller(w.domain.repositories, parseRootSessionId(ROOT_A), { kind: 'instance', instanceId: 'inst-nobody' })
    } catch (error) {
      inProcess = (error as Error).message
    }
    expect(inProcess, 'the in-process resolver accepted the caller the host refused').not.toBe('')
    expect(capture.unknownCaller.message.replace(capture.rootSessionId, ROOT_A),
      'the host\'s refusal sentence and the sentence the injected port\'s own function produces are no longer the same sentence').toBe(inProcess)
  })

  itRealHost('every cell that reached the closure speaks for it — refusals print the allowed list, agreements prove the role is in it', () => {
    const capture = readRealHostCapture()
    if (capture === null) return
    const refusedCells = Object.entries(capture.answers).filter(([, cell]) => cell.closure === 'refused-by-closure')
    const allowedCells = Object.entries(capture.answers).filter(([, cell]) => cell.closure === 'allowed')
    const agreedCells = Object.entries(capture.answers).filter(([, cell]) => cell.closure === 'agreed-then-envelope-refused')
    // Anti-vacuity first: a comparison over zero cells would pass and mean nothing. Round 1's weak pin was weak
    // precisely because it could not fail, so the count is part of the assertion.
    expect(refusedCells.length, 'no captured cell shows the closure refusing — this comparison would be vacuous').toBeGreaterThan(0)
    expect(allowedCells.length, 'no captured cell shows a role the host let resolve — the mirror\'s positive half is unmeasured').toBeGreaterThan(0)
    for (const [key, cell] of refusedCells) {
      const kind = key.split('|')[0] as string
      const role = key.split('|')[1] as string
      const printed = /allowed: \[([^\]]*)\]/.exec(cell.message)?.[1] ?? null
      expect(printed, `the refusal for ${key} does not print its allowed list: ${cell.message}`).not.toBeNull()
      // The triangle, closed in ONE leg: what the host printed, what the center's table says, and what THIS lane
      // mirrors. Checking only the first two would leave the lane's own table free to drift while the live
      // comparison stayed green — which is the exact shape of the weak pin round 1 found.
      const control = [...((CONTROL_RESOLVER_ROLES as Record<string, readonly string[]>)[kind] ?? [])].sort()
      const mirror = [...(ASSIGNMENT_ADMISSION_ROLE_CLOSURE[kind] ?? [])].sort()
      const seen = (printed as string).split(',').map((r) => r.trim()).sort()
      expect(seen, `the live host and CONTROL_RESOLVER_ROLES disagree about who resolves '${kind}'`).toEqual(control)
      expect(seen, `the live host and this lane's ASSIGNMENT_ADMISSION_ROLE_CLOSURE disagree about who resolves '${kind}'`).toEqual(mirror)
      expect(mirror, `the host refused role '${role}' for '${kind}' while this lane lists it as a resolver`).not.toContain(role)
    }
    for (const [key, cell] of allowedCells) {
      const kind = key.split('|')[0] as string
      const role = key.split('|')[1] as string
      const control = (CONTROL_RESOLVER_ROLES as Record<string, readonly string[]>)[kind] ?? []
      const mirror = ASSIGNMENT_ADMISSION_ROLE_CLOSURE[kind] ?? []
      expect(control, `the live host let role '${role}' resolve '${kind}', which CONTROL_RESOLVER_ROLES does not name`).toContain(role)
      expect(mirror, `the live host let role '${role}' resolve '${kind}', which this lane's mirror does not name`).toContain(role)
      expect(cell.code).toBe('CONTROL_RESOLVED')
    }
    // The agreement half, MEASURED (F-I1b2-2, 2026-10-31). These cells show the closure AGREEING with a leader
    // caller: the kit measured (check `role-closure-precedes-envelope-on-resolve-path`, recorded in
    // `resolvePathOrder`) that inside `resolveControl` the closure check runs before
    // `enforceEnvelope(RESOLVE_CONTROL_SPEC, …)`, so a visible envelope refusal — thrown at the envelope gate,
    // the ONLY envelope call in the function — is only reachable if the closure let that caller through. If a
    // table dropped this role the closure would have refused in its own words and this cell would read
    // `refused-by-closure`; the tables and the live agreement therefore pin each other from both sides.
    expect(capture.resolvePathOrder?.measured, 'the capture did not record the measured gate order').toBeTruthy()
    for (const [key, cell] of agreedCells) {
      const kind = key.split('|')[0] as string
      const role = key.split('|')[1] as string
      expect(cell.code, `cell ${key} is recorded as envelope-refused but carries ${cell.code}`).toBe('TEAM_RUNTIME_ENVELOPE_OUT_OF_BOUNDS')
      expect(cell.message, `cell ${key}'s envelope refusal does not name the resolve-control action: ${cell.message}`).toContain('resolve-control')
      const control = (CONTROL_RESOLVER_ROLES as Record<string, readonly string[]>)[kind] ?? []
      const mirror = ASSIGNMENT_ADMISSION_ROLE_CLOSURE[kind] ?? []
      expect(control, `the live closure agreed with role '${role}' for '${kind}' while CONTROL_RESOLVER_ROLES does not name it — the table contradicts the host's agreement`).toContain(role)
      expect(mirror, `the live closure agreed with role '${role}' for '${kind}' while this lane's mirror does not name it — the mirror contradicts the host's agreement`).toContain(role)
    }
    expect(agreedCells.map(([key]) => key).sort(), 'which leader cells the closure AGREED with is part of the record').toEqual(['envelope-mutation|leader', 'leader-approval|leader'])
    // No cell may hide outside the three shapes: the resolve path runs the closure first for every caller, so
    // a cell recorded as never reaching it means the capture predates the F-I1b2-2 fix — or was fabricated.
    const unclassified = Object.entries(capture.answers).filter(([, cell]) => !cell.reachedClosure)
    expect(unclassified.map(([key]) => key).sort(), 'a captured cell is recorded as never reaching the closure — the resolve path runs the closure first, so this capture is stale or fabricated').toEqual([])
  })

  itRealHost('the member row of the matrix has no ingress on this host — the kit attempted it and the host refused, verbatim', () => {
    const capture = readRealHostCapture()
    if (capture === null) return
    const roles = new Set(Object.keys(capture.answers).map((key) => key.split('|')[1] as string))
    expect([...roles].sort(), 'a caller role appeared that this instrument cannot present — re-read its header before trusting the matrix').toEqual(['human', 'leader'])
    expect(Object.keys(capture.answers).filter((key) => key.endsWith('|member')),
      'a member caller appeared on a host with no model — re-read what this instrument can present').toEqual([])
    // F-I1b2-3: the check this leg reads is a measurement now, not a literal. The kit PRESENTED a member
    // session through the only carrier on this host that expresses an identity (session-addressed
    // `/__p6t6/tool`) and recorded the refusal; if the carrier ever honours a session with no live agent, or
    // the capture stops recording the attempt, this leg reddens.
    const attempt = capture.memberAttempt
    expect(attempt, 'the capture stopped recording the member attempt — the member row would be an assertion again, not a measurement').not.toBeNull()
    expect(attempt.as, `the member attempt addressed ${attempt.as}, not a never-created member session`).toMatch(/^session-a6pri1b-member-never/)
    expect(attempt.status, `the session-addressed carrier did not refuse the member session (${attempt.status} ${attempt.error})`).toBe(422)
    expect(attempt.error, `the member refusal is no longer the carrier's own "no live agent" sentence: ${attempt.error}`).toContain('no live agent for')
    const memberCheck = capture.checks.filter((c) => c.id === 'member-role-has-no-ingress')
    expect(memberCheck.length, 'the instrument stopped recording the member attempt as a check').toBe(1)
    expect(memberCheck[0]?.ok, `the member attempt itself failed: ${memberCheck[0]?.measured ?? ''}`).toBe(true)
  })

  itRealHost('the host\'s own refusal sentence, thrown through the injected port, arrives verbatim at the door', async () => {
    const capture = readRealHostCapture()
    if (capture === null) return
    const w = await world()
    // F-I1b1-5 is the law that the door never rewrites a resolver's words. Round 1 proved it with a sentence
    // this file invented. Here the sentence is one a running host produced, which is the version a reader of the
    // ledger will actually meet.
    const ports: AssignmentAdmissionPorts = {
      teamRootExists: () => true,
      resolveCaller: () => {
        const error = new Error(capture.unknownCaller.message) as Error & { code: string }
        error.code = capture.unknownCaller.code
        throw error
      },
      ledger: { list: () => [] },
    }
    const outcome = await w.admit(w.request({}), LEADER_CALLER, ports)
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.refusal).toBe('ADMISSION_CALLER_UNRESOLVED')
    expect(outcome.detail, 'the door reworded the host\'s refusal').toContain(capture.unknownCaller.message)
    expect(outcome.detail, 'the door dropped the host\'s own code from the words it carries').toContain(capture.unknownCaller.code)
  })

  itRealHost('the door and the live host answer the cell both of them can reach the same way', async () => {
    const capture = readRealHostCapture()
    if (capture === null) return
    const w = await world()
    // Every assignment decision resolves under `leader-approval` (ASSIGNMENT_DECISION_CONTROL_KIND), and the
    // human cell is one both systems answer end-to-end: the host wrote a durable decision, the door admits.
    // The leader cell of the same kind is comparable at the CLOSURE and not beyond it — the host's envelope
    // gate runs AFTER the closure (invariant 37, order measured by the kit) and refuses the visible answer,
    // and the door owns no envelope; the closure halves agree, which is what this leg reads.
    const hostCell = capture.answers['leader-approval|human']
    expect(hostCell?.code, `the host answered leader-approval|human with ${hostCell?.code}`).toBe('CONTROL_RESOLVED')
    const door = await w.admit(w.request({}), HUMAN_CALLER)
    expect(door.ok, `the door refused the caller the live host accepted: ${door.ok ? '' : `${door.refusal} ${door.detail}`}`).toBe(true)
    const leaderCell = capture.answers['leader-approval|leader']
    expect(leaderCell?.reachedClosure, 'the leader cell did NOT reach the closure on this host — the resolve path runs the closure first; re-read the capture and the kit').toBe(true)
    expect(leaderCell?.closure, 'the leader cell is no longer recorded as agreed-then-envelope-refused — re-read this leg and the kit\'s classification before trusting the door↔host story').toBe('agreed-then-envelope-refused')
  })

  itRealHost('S-7 on a real host: a real Team with real durable writes carries zero review-assignment bytes', () => {
    const capture = readRealHostCapture()
    if (capture === null) return
    // The census is taken AFTER six durable control writes landed, so "zero" is a measurement over a populated
    // ledger and not the silence of a store nothing touched.
    expect(capture.durableCensus.entries, 'the real-host ledger was empty — the census below would be vacuous').toBeGreaterThan(0)
    expect(capture.durableCensus.factTypes.length).toBeGreaterThan(0)
    const assignmentBytes = capture.durableCensus.factTypes.filter((factType) => REVIEW_ASSIGNMENT_FACT_TYPE_VALUES.includes(factType))
    expect(assignmentBytes, 'a non-enabling Team on a real host wrote review-assignment rows').toEqual([])
    expect(capture.enableCensus.factTypes.filter((factType) => REVIEW_ASSIGNMENT_FACT_TYPE_VALUES.includes(factType)),
      'the enable-probe world wrote review-assignment rows').toEqual([])
  })

  itRealHost('the enable arm of S-7 has no surface on the probed channel: the row config names no such field and the host ignored the two the probe sent', () => {
    const capture = readRealHostCapture()
    if (capture === null) return
    // F-I1b2-8 at its size: this leg sweeps the 14 fields the row reports reading with /feature|admission|
    // assignment/i and re-boots with exactly the two names `feature` and `assignmentFeature`. The load-
    // bearing fact is elsewhere and it is census-backed: `openAssignmentAdmission` has zero callers in source
    // and built dist, so there is no route from any host surface to this gate (S-7's confirmed negative).
    const named = capture.rowConfigFields.filter((field) => /feature|admission|assignment/i.test(field))
    expect(named, `the row config now carries a field that could enable this lane's gate: ${named.join(', ')}`).toEqual([])
    // The probe put `feature: 'on'` and `assignmentFeature: 'on'` into the config anyway. The row booted, took a
    // durable write, and produced the same fact types as the control world — the field is not a switch.
    expect(capture.enableCensus.entries, 'the enable-probe world produced no durable rows — the probe did not run').toBeGreaterThan(0)
    const enableCheck = capture.checks.find((c) => c.id === 'enable-surface-is-not-a-switch')
    expect(enableCheck?.ok, `the enable probe's own verdict changed: ${enableCheck?.measured ?? 'check missing'}`).toBe(true)
  })
})

// --- ENV-REFUSED (measured absences; nothing below is offered as a pass) ------------------------------------------

describe('ENV-REFUSED: the host-side legs still refused on this machine, recorded as refused', () => {
  it('the shared read-only baseline is absent — measured; the runtime, the homes and the capture are printed per path, not assumed', () => {
    // Round 1 refused the real-host pair on three absences. Two of the three became false on this machine
    // (the kit ran here), and round 2 (F-I1b2-4) found that asserting "runtime present, capture present"
    // here made the FRESH-CLONE state — where refusing is the correct behaviour — read as a failure. So this
    // leg keeps the one true machine-wide absence and PRINTS the per-path state; the REAL-HOST block's own
    // arm (refused / unrun / measured) decides what those paths mean, and this leg says the same sentence in
    // every arm.
    console.info(`env paths: pristineRuntime=${hostEnvironment.pristineRuntime} testHomes=${hostEnvironment.testHomes} `
      + `capture=${hostEnvironment.capture} sharedBaseline=${hostEnvironment.sharedBaseline}`)
    expect(hostEnvironment.sharedBaseline, '/srv/workspace/dsh-stable-3-0.2.0-rc.2 appeared on this machine').toBe(false)
  })

  it('the legs no host on this machine can evidence stay refused, by name', () => {
    // The member row of `CONTROL_RESOLVER_ROLES`: acting as a MEMBER caller needs a live member agent, i.e. a
    // model turn (PR-I2's feasibility report says the same: "needs a member ask-lane tool use under a model").
    // The instrument attempts the presentation and the session-addressed carrier refuses it — that measured
    // twin lives in the REAL-HOST member leg (`member-role-has-no-ingress` + the recorded 422), so this
    // sentence stays true in every arm: hidden runtime, present runtime, or unrun instrument.
    // The second one: the door's own kind is fixed by ASSIGNMENT_DECISION_CONTROL_KIND to `leader-approval` for
    // every decision, so the door can never be asked about `user-approval` — the cell where the host proved the
    // closure bites is a cell the door cannot be walked to on purpose. It is pinned mirror↔host, not door↔host.
    expect(Object.values(ASSIGNMENT_DECISION_CONTROL_KIND).sort()).toEqual(['leader-approval', 'leader-approval', 'leader-approval'])
  })
})



// --- A5↔A6 P-1 / P-2 (2026-11-01): the two frozen cross-project prohibitions, measured at static/unit level ------
//
// THE RULING THESE LEGS ENCODE. The Alpha.5 Sandbox-First redesign review (PR #531) froze the invariant
// `EffectivePermission = OperationAuthorization ∩ Enforced I/O Authority` — BOTH terms must hold. An approval
// decision that can reach the policy/sandbox configuration plane collapses the intersection to its first term;
// an approval that widens the enforced I/O set collapses it to the second. The lane law on the Alpha.5↔Alpha.6
// register (Issue #502; memo `docs/plans/memo/alpha6-review-separation/pri1b-admission-design-20261031.md` §6):
// a prohibition stated only in prose is a prohibition nobody can break. So both halves are legs here, not
// sentences: P-1 measures the import graph, P-2 measures the result shapes and the coverage oracle.
//
// SCOPE OF THESE LEGS, stated so nobody mistakes their size — rewritten round 5 of #522 (F-I1b5-1) because the
// previous sentence claimed a completeness a lexical scan cannot deliver. They are static/unit-level only — no
// boot, no kit run, no campaign. What P-1 now does, exactly:
//  • PARSES each scanned file with the workspace TypeScript compiler API (`ts.createSourceFile`, the same
//    `typescript` dependency the runtime typecheck runs on) and walks the AST for the real module edges:
//    ImportDeclaration, ExportDeclaration (`export * from`, named re-exports), `import(...)` /
//    `require(...)` / `createRequire(...)` call expressions, string-literal and no-substitution-template
//    specifiers only. A specifier that is not a literal — computed, conditional, or assembled — is a
//    REFUSAL naming file and node, never a silent skip, and any `import.meta` / `createRequire` use is
//    refused the same way: a runtime-built loader is not something a static closure may claim to complete.
//  • BLANKS comments with the compiler's own scanner (`ts.createScanner`, skipTrivia=false), so string
//    literals containing `/*` or `//` cannot blind a stripper around live code — the exact region the
//    round-5 reviewer hid a real `node:fs` import behind (F-I1b5-1, plant S2). Line numbers survive blanking.
//  • ENFORCES ALLOW-LISTS, not deny-lists: the only module specifier the plane may name is `node:crypto`;
//    every reference to a closed set of intrinsic escape hatches (`Function`, `eval`, `globalThis`,
//    `Reflect`, `process` — INTRINSIC_ESCAPE_HATCH_NAMES) is refused: in callee and `new` position, BY VALUE
//    (F-I1b6-1's E2 plant handed `Function` to a const and every gate stayed green), as a member head, and
//    through the global object — a member of `globalThis` is refused whether the key folds statically
//    (`globalThis['proc' + 'ess']`, E1/E8's spelling) or not. The `process` member allow-list is EMPTY
//    (measured, see PROCESS_MEMBER_ALLOW_LIST), so `process.binding`, `process.dlopen`, `process.mainModule`,
//    `process.chdir` are refused for being OFF the list, not because anyone thought to name them. THE SIZE
//    OF THIS RULE, said once and meant: it convicts NAMES in the scanned text; a determined author can still
//    route around a name-based rule (one binding hop further, a member carried by value), and no AST walk of
//    source text is a capability boundary. It is a review-time tripwire over the lane's own source; the
//    boundary's real backing is that the module has ZERO callers (`ALLOWED_CONSUMERS = []`, S-9), ships no
//    entry point, and sits behind code review.
//  • COVERS CONTENT, not extensions (F-I1b6-3): every file carried under the two lane source directories and
//    their dist outputs is enumerated by directory listing — a `.cts` lane file (which `tsconfig.build.json`
//    compiles into the build program, `tsc --listFiles` measured) and a `.cjs` orphan in lane dist are ON a
//    surface, not between extension filters. Each enumerated file is CLASSIFIED: script (parsed by the AST
//    scanner + vocabulary net), explicitly excluded data (`.map` only, justified at the exclusion), or
//    unclassified — and unclassified is itself a red. Reachability and surface stay SEPARATE claims in
//    SEPARATE legs.
// What remains OUT of reach of any static scan, stated rather than claimed away: what an ALLOWED builtin
// does (node:crypto's own behaviour is graded by what it is, not by scanning); loader hooks, import maps or
// any runtime resolution that rewrites specifiers between parse and load; bytes outside the enumerated
// directories (this lane does not re-run `tsc` here — a build that emitted to a path outside the lane dist
// directories would have to be caught by the next rebuild + these legs, and F-I1b5-7's symlink-into-dist
// question is recorded OPEN, unmeasured, with symlinks inside either surface refused outright); the
// semantics of names the vocabulary never heard of — which is precisely why the vocabulary net is the
// SECOND net and the allow-lists are the rule; and, conceded by round 6's F-I1b6-1 in plain words: a
// capability reached under a name this scan does not know. A name-based tripwire fires when review misses;
// it is not a wall review can stand behind. House note (F-I1b6-10): any scratch file dropped under
// `packages/**` reddens five family legs because `p4t6-session-event-scan.test.ts` counts every scannable
// file there — keep scratch outside `packages/**`.
// P-2 measures the verdict objects the live gates actually produce (measured, not remembered) and grades the
// closed-set check itself with a planted widening field, so a closed list that can no longer fail is caught
// in the same file that carries it; since round 5 it enumerates the refusal literals of both doors from the
// AST, and since round 6 it grades them WHEREVER THEY SIT (F-I1b6-4: a refusal routed through a binding is
// graded by its `refusal:` key; round 7, F-I1b7-1: a computed `refusal` key counts too when it statically
// folds — the key grammar actually graded, and the gaps that grammar leaves, are said at the leg), pins the
// graded count to a second key-count pass and to the measured floor (what that guard can and cannot prove
// is said at the leg, not here), drives the throwing existence branch live — since round 7 pinning that
// verdict's EXACT live key set, the one path where a live shape is closed against widening — and pins
// parsed plans to their input's effect scopes (F-I1b5-5).
//
// WHAT THESE LEGS DO NOT DO (register discipline, #502): they change no closed scope form, they add no
// adapter, they invent no behaviour the interface does not already freeze. Where the interface carries an
// OPEN question — the fingerprint semantics of `by-action-name` (plan.ts:333-343) — the leg grades the CURRENT
// behaviour exactly, so that any silent change of that semantics reddens a leg instead of sliding through.

// REPO_ROOT is declared above by the REAL-HOST block — same value (`join(RUNTIME_ROOT, '..', '..')`), reused, not redeclared.
const relToRepo = (file: string): string => (file.startsWith(REPO_ROOT + '/') ? file.slice(REPO_ROOT.length + 1) : file)

/** Blank comments out but keep every line number, so a refusal names the line a reader finds in the file —
 *  using the COMPILER's scanner (`ts.createScanner`, trivia on), not a regex over the text. A regex cannot
 *  tell a real block-comment pair from the same two-character sequences inside string literals, and round 5
 *  of #522 proved what that buys: an open-marker string on one line and a close-marker string on another
 *  erased a live `node:fs` import between them (F-I1b5-1, plant S2 — and this very comment had to dodge
 *  writing the marker pair literally, because inside a block comment the close pair ENDS the comment, which
 *  is parser knowledge no line-anchored regex has). The lexer knows strings, templates and regexes, so the
 *  set of comment ranges it returns is the set of comments the module actually has — nothing more is
 *  blanked, nothing real is hidden.
 *  Comments are blanked because the module headers of THIS lane cite the protected paths they must not
 *  import (`control/service.ts:2622` as evidence); prose that names a path is documentation, code that
 *  imports one is the prohibition. */
function blankModuleComments(text: string): string {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, text)
  const out = text.split('')
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    if (token === ts.SyntaxKind.SingleLineCommentTrivia || token === ts.SyntaxKind.MultiLineCommentTrivia) {
      for (let i = scanner.getTokenPos(); i < scanner.getTextPos() && i < out.length; i++) if (out[i] !== '\n') out[i] = ' '
    }
  }
  return out.join('')
}

/** One module edge the AST walk found: the literal specifier (or null when the specifier exists but is not
 *  a literal — then the edge is recorded in `nonStatic` too and the leg refuses on it by name). */
interface ModuleEdge {
  readonly specifier: string
  readonly kind: string
  readonly line: number
}

interface SourceScan {
  readonly label: string
  /** Parse failures are refusals: a file the compiler cannot read cannot be claimed clean. */
  readonly parseErrors: readonly string[]
  readonly edges: readonly ModuleEdge[]
  /** Edges and loader-shaped constructs the walk may not silently pass over: computed/conditional/
   *  non-literal specifiers, `import.meta`, `createRequire`. A walk whose set of these is empty is the only
   *  walk allowed to claim the closure is complete — the refusal names file, line and the node text. */
  readonly nonStatic: readonly string[]
  /** Allow-list breaches: any module specifier outside the closed list, any touch of `process` outside the
   *  closed member list, any use of a closed global-capability name. */
  readonly capabilityViolations: readonly string[]
}

/** The CLOSED global-capability names. This one stays a list, and its limit is stated: a list cannot prove
 *  that no other name exists — which is exactly why it is the third net behind the two allow-lists, not the
 *  rule itself. Module capabilities are refused by NOT being on `ALLOWED_EXTERNAL_MODULES`; process
 *  capabilities by NOT being on `PROCESS_MEMBER_ALLOW_LIST`; this net only catches ambient globals, whose
 *  closed set (an ES module's globals are the platform's) cannot be enumerated per-project. Names bound in
 *  the file itself (`const fetch = …`) are not ambient and are not convicted — shadowing is a readability
 *  problem the lint owns, not a capability. */
const GLOBAL_CAPABILITY_NAMES = ['fetch', 'eval', 'WebSocket', 'XMLHttpRequest', 'EventSource', 'Worker', 'SharedWorker', 'navigator', 'WebAssembly'] as const

/** The CLOSED set of intrinsic escape hatches — values from which every other capability is one property
 *  lookup away: `Function('return process')()` builds the process object from a string, `globalThis` IS the
 *  global object, `Reflect.get` reads any property of any object, `process` carries the OS surface. The rule
 *  convicts any reference to these names — identifier, by-value alias (round 6's E2: `export const r6Compile
 *  = Function` passed every gate at `f773d1603`), callee, `new`, member head — plus member access on the
 *  global object whose key folds statically (`globalThis['proc' + 'ess']`, E1/E8's spelling) and computed
 *  global-object access that does NOT fold (the scan may not certify what it cannot name). Names bound in
 *  the file are not the ambient intrinsic (same shadowing law as GLOBAL_CAPABILITY_NAMES). THE HONEST SIZE,
 *  in the one sentence the round-6 ruling demands: this is a NAME-based tripwire over the lane's own source,
 *  and a determined author can route around a name-based rule — the module's real backing is that it has
 *  zero callers (`ALLOWED_CONSUMERS = []`), ships no entry point, and sits behind code review. */
const INTRINSIC_ESCAPE_HATCH_NAMES = ['Function', 'eval', 'globalThis', 'Reflect', 'process'] as const

/** Fold a string-valued expression to its literal value when the compiler can see it statically: string
 *  literals, no-substitution templates, parenthesised and `as`/`satisfies`-wrapped expressions, `+`
 *  concatenation of foldables, and template expressions whose substitutions all fold. E8's `'proc' + 'ess'`
 *  is this function's reason to exist (F-I1b6-1); anything else returns null — and a null at a computed
 *  global-object member is a REFUSAL, never a silent pass. */
function staticallyFoldedString(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) return staticallyFoldedString(node.expression)
  if (ts.isTemplateExpression(node)) {
    let folded = node.head.text
    for (const span of node.templateSpans) {
      const part = staticallyFoldedString(span.expression)
      if (part === null) return null
      folded += part + span.literal.text
    }
    return folded
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = staticallyFoldedString(node.left)
    const right = staticallyFoldedString(node.right)
    return left === null || right === null ? null : left + right
  }
  return null
}

/** The global-object identifier at the head of a possibly parenthesised / `as`- / `satisfies`-wrapped
 *  expression — E8 reached the global object as `(globalThis as unknown as Record<…>)[…]`, and a cast
 *  around a name does not un-name it. Null when the head is anything else. */
function globalObjectHead(expression: ts.Expression): ts.Identifier | null {
  let node: ts.Expression = expression
  for (;;) {
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) { node = node.expression; continue }
    break
  }
  return ts.isIdentifier(node) && node.text === 'globalThis' ? node : null
}

/** Parse one source TEXT (the bytes a file or a planted fixture carries) and answer with its edges, its
 *  non-static refusals and its allow-list violations. This is THE scanner — real files and synthetic
 *  fixtures go through the same function, so the instrument-self leg below grades exactly what the P-1 legs
 *  run. `ts.isDynamicImport` is not public API in typescript@6, so `import(...)` is matched as the CallExpression
 *  whose expression is the `import` keyword — the shape the parser actually produces. */
function analyzeSource(label: string, text: string, scriptKind: ts.ScriptKind): SourceScan {
  const sourceFile = ts.createSourceFile(label, text, ts.ScriptTarget.Latest, true, scriptKind)
  const rawDiagnostics = (sourceFile as unknown as { parseDiagnostics?: readonly ts.DiagnosticWithLocation[] }).parseDiagnostics ?? []
  const parseErrors = rawDiagnostics.map((diagnostic) => `${label}:${sourceFile.getLineAndCharacterOfPosition(diagnostic.start).line + 1} parse: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`)
  const edges: ModuleEdge[] = []
  const nonStatic: string[] = []
  const capabilityViolations: string[] = []
  const lineOf = (position: number): number => sourceFile.getLineAndCharacterOfPosition(position).line + 1
  const cut = (node: ts.Node): string => node.getText(sourceFile).replace(/\s+/g, ' ').slice(0, 120)
  // Names the file itself binds. Used ONLY to tell an ambient global from a local of the same name; an
  // imported name is bound too, and its module specifier is separately held to the allow-list.
  const boundNames = new Set<string>()
  const collectBindings = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) || ts.isBindingElement(node) || ts.isParameter(node)) {
      if (ts.isIdentifier(node.name)) boundNames.add(node.name.text)
    } else if (ts.isCatchClause(node) && node.variableDeclaration !== undefined && ts.isIdentifier(node.variableDeclaration.name)) boundNames.add(node.variableDeclaration.name.text)
    else if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isFunctionExpression(node) || ts.isClassExpression(node)) && node.name !== undefined) boundNames.add(node.name.text)
    else if (ts.isImportClause(node) || ts.isNamespaceImport(node) || ts.isImportSpecifier(node)) {
      const nameNode = node.name
      if (nameNode !== undefined && ts.isIdentifier(nameNode)) boundNames.add(nameNode.text)
    }
    ts.forEachChild(node, collectBindings)
  }
  collectBindings(sourceFile)
  const addEdge = (kind: string, specifierNode: ts.Node | undefined, context: ts.Node | undefined): void => {
    if (specifierNode === undefined) return
    if (ts.isStringLiteral(specifierNode) || ts.isNoSubstitutionTemplateLiteral(specifierNode)) {
      edges.push({ specifier: specifierNode.text, kind, line: lineOf(specifierNode.pos) })
      return
    }
    nonStatic.push(`${label}:${lineOf(specifierNode.pos)} ${kind} with a NON-LITERAL specifier — cannot be resolved statically: ${cut(context ?? specifierNode)}`)
  }
  const scan = (node: ts.Node): void => {
    // Type-position `import('node:fs')` (F-I1b6-6): an ImportTypeNode NAMES a module the same way a static
    // import does — `type R6Fs = import('node:fs')` walked blind at `f773d1603` while the statement form
    // `import type … from 'node:fs'` was convicted. It is recorded as an edge, so the external allow-list
    // grades it; the closure walk does not FOLLOW import-type edges (declarations do not ship as load edges),
    // which is stated at walkStaticClosure, not hidden here.
    if (ts.isImportTypeNode(node)) {
      // TS 6 keeps the specifier as a LiteralTypeNode wrapping the StringLiteral — unwrap to grade the
      // string, anything else stays non-static and is refused.
      const specifierNode = ts.isLiteralTypeNode(node.argument) ? node.argument.literal : node.argument
      addEdge('import-type', specifierNode, node)
      return
    }
    // Identifiers in type positions name types, not runtime values; capability cannot execute from there —
    // except the module reference just handled above, which names a module even in type position.
    if (ts.isTypeNode(node) || ts.isJSDoc(node)) return
    if (ts.isImportDeclaration(node)) addEdge('import-declaration', node.moduleSpecifier, node)
    if (ts.isExportDeclaration(node)) addEdge(node.exportClause === undefined ? 'export-star' : 'named-reexport', node.moduleSpecifier, node)
    // `import x = require('node:fs')` (F-I1b6-2): an ImportEqualsDeclaration over an ExternalModuleReference
    // is a module edge the compiler emits a real require() for. At `f773d1603` this file had no case for it
    // at all, so with the vocabulary net emptied the plant added ZERO tree-facing reds — the demoted deny-
    // list was still load-bearing for exactly this shape. It is an edge now; the allow-list convicts it.
    // (TS 6 keeps the specifier at `moduleReference.expression`; the `require` keyword is a token, not an
    // identifier node, which is why the aliased-require rule below does not fire on this form.)
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      addEdge('import-equals', node.moduleReference.expression, node.moduleReference)
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression
      if (callee.kind === ts.SyntaxKind.ImportKeyword) addEdge('dynamic-import', node.arguments[0], node)
      else if (ts.isIdentifier(callee) && callee.text === 'require') addEdge('require', node.arguments[0], node)
      else if (ts.isIdentifier(callee) && callee.text === 'createRequire') nonStatic.push(`${label}:${lineOf(node.pos)} createRequire builds a loader at runtime — the closure may not claim what it will reach: ${cut(node)}`)
      else if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && callee.expression.text === 'require' && callee.name.text === 'resolve') nonStatic.push(`${label}:${lineOf(node.pos)} require.resolve locates a module without loading it — no edge is recorded for what that path becomes, so the closure may not pass it silently (F-I1b6-5): ${cut(node)}`)
      // `module.require(…)` / `anything.require(…)`: a member-call loader. The rule is that a call whose
      // CALLEE IS A MEMBER NAMED `require` loads a module, whoever the receiver is — measured zero hits on
      // existing lane bytes, so this closes the last require spelling the residual probe found blind rather
      // than pinning it as a known gap.
      else if (ts.isPropertyAccessExpression(callee) && callee.name.text === 'require') addEdge('member-require', node.arguments[0], node)
      else if (ts.isPropertyAccessExpression(callee) && callee.name.text === 'constructor') capabilityViolations.push(`${label}:${lineOf(node.pos)} calls .constructor(...) — the route round 6's E9 plant used (Error.prepareStackTrace → CallSite.getFunction() → .constructor('return process')) to reach the Function constructor off a live object without ever spelling the name: ${cut(node)}`)
      else if (ts.isIdentifier(callee) && (callee.text === 'Function' || callee.text === 'eval')) capabilityViolations.push(`${label}:${lineOf(node.pos)} ${callee.text} executes a string as code — a capability surface the decision plane must not hold: ${cut(node)}`)
    }
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'Function') capabilityViolations.push(`${label}:${lineOf(node.pos)} Function constructor executes a string as code: ${cut(node)}`)
    if (node.kind === ts.SyntaxKind.MetaProperty) nonStatic.push(`${label}:${lineOf(node.pos)} import.meta carries runtime resolution — refused outright: ${cut(node.parent ?? node)}`)
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'process' && !PROCESS_MEMBER_ALLOW_LIST.includes(node.name.text)) capabilityViolations.push(`${label}:${lineOf(node.pos)} touches process.${node.name.text}, which is not on PROCESS_MEMBER_ALLOW_LIST [${PROCESS_MEMBER_ALLOW_LIST.join(', ') || '(empty)'}] — absence FROM the list is the refusal, so process.binding/process.dlopen/process.mainModule/process.chdir need no entry and no new review: ${cut(node)}`)
    if (ts.isElementAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'process' && !(ts.isStringLiteral(node.argumentExpression) && PROCESS_MEMBER_ALLOW_LIST.includes(node.argumentExpression.text))) capabilityViolations.push(`${label}:${lineOf(node.pos)} indexes the process object at a member outside the allow-list — computed or not, the rule is the list: ${cut(node)}`)
    if (ts.isIdentifier(node)) {
      const parent = node.parent
      const isMemberHead = parent !== undefined && ((ts.isPropertyAccessExpression(parent) && parent.expression === node) || (ts.isElementAccessExpression(parent) && parent.expression === node))
      // Every identifier named `process` is refused unless it is the head of an allow-listed member access —
      // and the allow-list is empty, so: every identifier named process, including a binding named process.
      if (node.text === 'process' && !isMemberHead) capabilityViolations.push(`${label}:${lineOf(node.pos)} references the process object by value — a handle to it is the whole capability surface: ${cut(parent ?? node)}`)
      // Not every identifier in a tree is a reference: the name after a dot, a property/method/import/export
      // key, or a declaration site is a NAME, not a use of whatever global shares the spelling.
      const isNotAReference = parent !== undefined && (
        (ts.isPropertyAccessExpression(parent) && parent.name === node)
        || (ts.isPropertyAssignment(parent) && parent.name === node)
        || (ts.isMethodDeclaration(parent) && parent.name === node)
        || (ts.isShorthandPropertyAssignment(parent) && parent.name === node)
        || (ts.isImportSpecifier(parent) && parent.name === node)
        || (ts.isExportSpecifier(parent) && parent.name === node)
        || (ts.isMethodSignature(parent) && parent.name === node)
        || (ts.isPropertySignature(parent) && parent.name === node)
        || ts.isImportAttribute(parent)
      )
      // The by-value hatch rule (F-I1b6-1): convict a REFERENCE to an intrinsic escape hatch wherever it
      // sits, not only in callee/`new` position — E2 convicted nothing because `export const r6Compile =
      // Function` puts `Function` in initializer position, and `globalThis` was never convicted at all.
      // `process` keeps its dedicated rule above (its message names the member allow-list); as a member
      // head it is convicted by the two process-member rules. A name bound in this file is not the ambient
      // intrinsic — same shadowing law, same reason (X8 proves the scanner is not always-red theatre).
      const isHatchReference = !isNotAReference && !boundNames.has(node.text)
        && (INTRINSIC_ESCAPE_HATCH_NAMES as readonly string[]).includes(node.text)
        && !(node.text === 'process' && isMemberHead)
      if (isHatchReference) capabilityViolations.push(`${label}:${lineOf(node.pos)} references the intrinsic escape hatch '${node.text}' by value — a handle to it is every capability one lookup away (Function('return process')() needs no other name spelled), and name-based tripwire or not, the decision plane may not hold it: ${cut(parent ?? node)}`)
      // A require that is not the callee is a require that can be called under any name (F-I1b6-5): the
      // closure records no edges for `const r = require; r('./x.js')`, so the alias itself is refused as
      // non-static rather than walked past. The `require` INSIDE `import x = require('…')` is the syntax
      // form, recorded as an import-equals edge above — not an alias.
      if (node.text === 'require' && !isNotAReference && !boundNames.has('require') && !isMemberHead && parent !== undefined && parent.kind !== ts.SyntaxKind.ExternalModuleReference && !(ts.isCallExpression(parent) && parent.expression === node)) {
        nonStatic.push(`${label}:${lineOf(node.pos)} require is referenced by value, not called — any name it is assigned to can load a module the closure never records (F-I1b6-5): ${cut(parent)}`)
      }
      if (!isNotAReference && GLOBAL_CAPABILITY_NAMES.includes(node.text as (typeof GLOBAL_CAPABILITY_NAMES)[number]) && !boundNames.has(node.text)) {
        capabilityViolations.push(`${label}:${lineOf(node.pos)} uses the ambient capability name '${node.text}' (it is neither declared nor imported in this file): ${cut(parent ?? node)}`)
      }
    }
    // Any member access on the global object is refused (round 6, F-I1b6-1/E1/E8): if the key folds
    // statically — literal, no-substitution template, or concatenation like 'proc' + 'ess' — the refusal
    // NAMES the capability it reaches; if it does not fold, the refusal says the scan cannot name what it
    // reaches. Either way, `globalThis` is not a door the decision plane walks through; the head may hide
    // behind parentheses and `as` casts, so the unwrap goes through those.
    if ((ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) && globalObjectHead(node.expression) !== null) {
      const folded = ts.isPropertyAccessExpression(node) ? node.name.text : staticallyFoldedString(node.argumentExpression)
      if (folded !== null) capabilityViolations.push(`${label}:${lineOf(node.pos)} reaches '${folded}' through globalThis${(GLOBAL_CAPABILITY_NAMES as readonly string[]).includes(folded) || (INTRINSIC_ESCAPE_HATCH_NAMES as readonly string[]).includes(folded) ? ` — a convicted capability name${ts.isPropertyAccessExpression(node) ? '' : ' assembled from a folded non-literal key'}` : ''}; the global object may not be indexed at all in the decision plane: ${cut(node)}`)
      else capabilityViolations.push(`${label}:${lineOf(node.pos)} computed member access on the global object — the scan cannot fold the key, so it cannot clear it; refusal, not silent pass: ${cut(node)}`)
    }
    ts.forEachChild(node, (child) => {
      scan(child)
    })
  }
  scan(sourceFile)
  return { label, parseErrors, edges, nonStatic, capabilityViolations }
}

/** Apply the two CLOSED allow-lists to the edges a scan found. Kept out of `analyzeSource` because the
 *  walk also needs the raw specifiers to follow, and the install-surface leg needs them listed. */
function allowListViolations(scan: SourceScan): string[] {
  return scan.edges
    .filter((edge) => !edge.specifier.startsWith('.'))
    .filter((edge) => !(ALLOWED_EXTERNAL_MODULES as readonly string[]).includes(edge.specifier))
    .map((edge) => `${scan.label}:${edge.line} ${edge.kind} names external module '${edge.specifier}' — the closed allow-list is [${ALLOWED_EXTERNAL_MODULES.join(', ')}], and anything outside it is refused BY DEFAULT, which is the entire point of an allow-list`)
}

function scriptKindFor(file: string): ts.ScriptKind {
  // Parsed as WHAT IT IS (F-I1b6-3): `.cjs`/`.cts` were once unlistable by any filter, so the question of
  // how they parse had never come up; the CJS forms in a `.cjs` orphan must not be mis-parsed, and `.cts`
  // is TypeScript with CommonJS emit — TS parse is correct for it. `.map` never reaches here: the surface
  // classifier routes data files to the vocabulary net, not the analyzer.
  return /\.(?:js|mjs|cjs)$/.test(file) ? ts.ScriptKind.JS : ts.ScriptKind.TS
}

function scanFile(file: string): SourceScan {
  return analyzeSource(relToRepo(file), readFileSync(file, 'utf8'), scriptKindFor(file))
}

/** The four buckets a list of scans must all answer empty in, named so each leg's message says which. */
function scanBucket(scans: readonly SourceScan[], bucket: 'parseErrors' | 'nonStatic' | 'capabilityViolations'): string[] {
  return scans.flatMap((scan) => [...scan[bucket], ...bucket === 'capabilityViolations' ? allowListViolations(scan) : []])
}

interface ClosureWalk {
  readonly files: readonly string[]
  /** `${file}:${line} …` for every relative edge the walk could not follow — a walk with an unfollowed edge
   *  has no right to claim "nothing reachable", so completeness is asserted, not assumed. */
  readonly unresolved: readonly string[]
  readonly external: readonly string[]
  /** `${file}:${line} …` for every non-literal specifier, `import.meta` or `createRequire` the AST found —
   *  the walk's completeness precondition, now read from the parse tree, not from a per-line regex
   *  (round 5, F-I1b5-1/S1: `import\n  ('./hidden/index.js')` split the line and the regex never saw it). */
  readonly nonStatic: readonly string[]
}

/** BFS over the REAL module edges (the `scanModuleClosure` idiom from `scripts/composition-smoke-closure.mjs`,
 *  re-established on the test side, parsed not pattern-matched): nothing here is a hand-maintained file list
 *  — the reachable set is derived from the edges the compiler itself would follow, including edges that cross
 *  a line break, sit in a subdirectory, or hide next to string literals that look like comments. */
function walkStaticClosure(entries: readonly string[], extensions: readonly string[]): ClosureWalk {
  const seen = new Set<string>()
  const unresolved: string[] = []
  const external = new Set<string>()
  const nonStatic: string[] = []
  const queue = [...entries]
  while (queue.length > 0) {
    const file = queue.shift() as string
    if (seen.has(file)) continue
    seen.add(file)
    const scan = scanFile(file)
    unresolved.push(...scan.parseErrors)
    nonStatic.push(...scan.nonStatic)
    for (const edge of scan.edges) {
      if (!edge.specifier.startsWith('.')) {
        external.add(edge.specifier)
        continue
      }
      // A type-position `import('./x.js')` NAMES a module (and its external cousins are graded by the
      // allow-list above) but it is not a LOAD edge: nothing the shipped graph executes travels it. The
      // closure is a claim about what runs, so the edge is recorded and not followed — stated here because
      // the alternative (following it) would let a declaration drag a file into "what the runtime reaches".
      if (edge.kind === 'import-type') continue
      const [bareSpecifier = edge.specifier] = edge.specifier.split(/[?#]/)
      const base = resolve(dirname(file), bareSpecifier)
      const candidates = [...extensions.map((ext) => base.replace(/\.js$/, ext)), ...extensions.map((ext) => join(base, `index${ext}`))]
      const hit = candidates.find((candidate) => existsSync(candidate))
      if (hit !== undefined) queue.push(hit)
      else unresolved.push(`${scan.label}:${edge.line} ${edge.kind} imports '${edge.specifier}', which resolves to no file`)
    }
  }
  return { files: [...seen].sort(), unresolved, external: [...external].sort(), nonStatic }
}

/** Enumerate the CONTENT of a directory recursively — every file, unfiltered (F-I1b6-3). The previous
 *  version took an extension list, and that list WAS the boundary: a `.cts` lane source (which
 *  `tsc -p tsconfig.build.json --listFiles` proves the build program compiles) and a `.cjs` orphan in lane
 *  dist were scanned by nothing while identical bytes named `.ts`/`.js` reddened — the extension had become
 *  the variable the instrument graded. Now the listing is the filesystem's, and the categories below decide
 *  what analysis a byte gets, with a red for anything that fits no category. Symlinks are REFUSED outright
 *  (listed, then convicted): a symlinked file is not a file of this directory, and what it points at is
 *  outside the listing's claim — round 5's R3 plant showed a symlink alias passing text scans when its
 *  target is clean, and F-I1b5-7's `tsc` symlink behaviour is still unmeasured, so neither surface tolerates
 *  aliases inside itself. */
function listDirectoryContentRecursively(dir: string): { files: string[]; symlinks: string[] } {
  const files: string[] = []
  const symlinks: string[] = []
  const step = (at: string): void => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const full = join(at, entry.name)
      if (entry.isSymbolicLink()) symlinks.push(relToRepo(full))
      else if (entry.isDirectory()) step(full)
      else files.push(relToRepo(full))
    }
  }
  step(dir)
  return { files: files.sort(), symlinks: symlinks.sort() }
}

/** The two CLOSED content categories a lane-surface file may fall in, plus the red category. Script bytes
 *  go through the AST analyzer and the vocabulary net; excluded-data bytes are JSON build artifacts that
 *  carry no module code and are graded by the embedded-source check below; anything else is unclassified
 *  and is a red, because "we did not think of that file kind" must never again be the same colour as
 *  "nothing needs to look at this". */
const LANE_SCRIPT_SUFFIXES = ['.ts', '.mts', '.cts', '.js', '.mjs', '.cjs'] as const
const LANE_EXCLUDED_DATA_SUFFIXES = ['.map'] as const
type LaneSurfaceCategory = 'script' | 'excluded-data' | 'unclassified'
function laneSurfaceCategory(file: string): LaneSurfaceCategory {
  if (LANE_SCRIPT_SUFFIXES.some((suffix) => file.endsWith(suffix))) return 'script'
  if (LANE_EXCLUDED_DATA_SUFFIXES.some((suffix) => file.endsWith(suffix))) return 'excluded-data'
  return 'unclassified'
}
/** Source maps are the one excluded category, and the exclusion is separately justified and MEASURED, not
 *  assumed (F-I1b6-3): `tsconfig.base.json` turns on `sourceMap` + `declarationMap`, so 22 of the 44
 *  tracked files in the two lane dist directories are `.map` files. They are base-64 mapping tables the
 *  platform's debugger consumes — not module bytes, never loaded by any graph — but they CAN carry the
 *  lane's source text inside `sourcesContent`, and source text is exactly what the prohibition grades. So
 *  the exclusion holds only while that field is empty, and the leg measures the field: at `f773d1603` 0 of
 *  the 22 maps embed source text, and a map that ever starts to is a red leg, not a silent hole. */
function embeddedSourceTextInMap(file: string): string | null {
  const raw = readFileSync(join(REPO_ROOT, file), 'utf8')
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return `${file} is not parseable JSON — a .map file the scan cannot read cannot be cleared either`
  }
  const sourcesContent = (parsed as { sourcesContent?: unknown }).sourcesContent
  if (Array.isArray(sourcesContent) && sourcesContent.some((entry) => typeof entry === 'string' && entry.trim().length > 0)) {
    return `${file} embeds source text in sourcesContent — a source-carrying artifact is source to this scan, and the exclusion is void for it`
  }
  return null
}

/** The CLOSED forbidden vocabulary for the decision plane (P-1). Every token names an API or a configuration
 *  surface that WRITES policy/sandbox configuration or names an OS-confinement mechanism — measured
 *  zero-hit, code text only (comments blanked by the compiler's scanner), over the whole reachable closure
 *  at HEAD (src and dist). This is a WORD LIST, and a word list cannot prove that no other name exists —
 *  which is why it is the SECOND net, not the rule: the rule is the two allow-lists below, which refuse
 *  capabilities for NOT being on a list. The bare word "blueprint" or "policy" is deliberately NOT in this
 *  list: the frozen contracts vocabulary carries read-only blueprint/policy DTOs the lane must keep
 *  importing, and a prohibition that convicts the frozen contract it stands on is a prohibition against
 *  the wrong thing. */
const FORBIDDEN_DECISION_PLANE_VOCABULARY = [
  // OS-confinement providers and mechanisms (names a sandbox API, whether imported or constructed)
  'sandbox-provider', 'sandboxConfig', 'SandboxConfig', 'sandbox_config', 'bypassSandbox',
  'seatbelt', 'bubblewrap', 'bwrap', 'seccomp', 'landlock', 'unshare', 'chroot', 'setrlimit',
  // OS I/O, process and network primitives (the door an approval must never hold)
  'node:fs', 'fs/promises', 'node:child_process', 'child_process', 'node:net', 'node:http', 'node:https',
  'node:http2', 'node:dgram', 'node:worker_threads', 'node:vm', 'node:inspector', 'node:sqlite',
  'writeFileSync', 'appendFileSync', 'createWriteStream', 'execSync', 'execFileSync', 'spawnSync',
  // configuration-WRITING verbs (Blueprint / policy / config / permission mutation surfaces)
  'writeBlueprint', 'saveBlueprint', 'updateBlueprint', 'patchBlueprint', 'commitBlueprint',
  'writePolicy', 'setPolicy', 'updatePolicy', 'patchPolicy',
  'writeConfig', 'setConfig', 'updateConfig', 'patchConfig',
  'grantPermission', 'revokePermission', 'setPermission',
  // the policy-plane subtrees themselves (convicted even behind an aliased re-export)
  'runtime/control', 'governance-center', 'operation-permission', 'effective-policy', 'permission-governance',
  'tool-admission', 'tool-dispatch', 'controlled-fs', 'domain/blueprint', 'domain/policy',
] as const

/** A hit names `file:line token` — a refusal that cannot be located is a refusal that cannot be fixed. */
function vocabularyHitsOfText(codeText: string, label: string, vocabulary: readonly string[]): string[] {
  const hits: string[] = []
  codeText.split('\n').forEach((line, index) => {
    for (const token of vocabulary) {
      if (line.includes(token)) hits.push(`${label}:${index + 1} names '${token}' in code — ${line.trim().slice(0, 120)}`)
    }
  })
  return hits
}

function vocabularyHitsOfFiles(files: readonly string[], vocabulary: readonly string[]): string[] {
  return files.flatMap((file) => vocabularyHitsOfText(blankModuleComments(readFileSync(file, 'utf8')), relToRepo(file), vocabulary))
}

/** The planes the decision path may reach: its two lane directories and the frozen contracts vocabulary
 *  (read-only DTOs and parsers). `packages/runtime/dist/` is the built mirror, normalised away below so the
 *  same claim is checked over source and over what actually ships. */
const REACHABLE_PLANES = ['packages/runtime/review-assignment/', 'packages/runtime/review-mandate/', 'packages/contracts/'] as const
function outsideReachablePlanes(files: readonly string[]): string[] {
  return files.map(relToRepo).map((rel) => (rel.startsWith('packages/runtime/dist/') ? rel.slice('packages/runtime/dist/'.length) : rel)).filter((rel) => !REACHABLE_PLANES.some((plane) => rel.startsWith(plane)))
}
/** The first allow-list (P-1, F-I1b5-2 done as a rule, not as tokens): the CLOSED set of module specifiers
 *  the decision plane may name — every edge of every scanned file, whatever its syntax (static, re-export,
 *  dynamic, require), is held to it. Today the only external module the plane imports is entropy for
 *  digests. The rule is an ALLOW-LIST precisely so new capabilities are refused by DEFAULT: `node:fs`,
 *  `node:child_process`, `node:worker_threads`, unprefixed builtins, packages, and anything Node or the
 *  loader invents next are all refused for NOT being here — no round of review ever needs to think of
 *  their name. The same law S-9 pins for assignment-admission.ts, now over the whole closure AND the whole
 *  install surface. */
const ALLOWED_EXTERNAL_MODULES = ['node:crypto'] as const

/** The second allow-list: the members of the `process` object the plane may touch. Derived by MEASUREMENT,
 *  not invention: the closure of 2026-11-01 (src barrels, dist barrels, and the full recursive dist
 *  listing — 42 source files, 41 built files, 22 emitted lane files) references `process` ZERO times, so
 *  the measured non-capability set is EMPTY and the list below is empty. That is the strongest form the
 *  rule can take: any `process.<member>`, any computed `process[…]`, any binding or by-value reference
 *  named `process` reddens by name. `process.binding`, `process.dlopen`, `process.mainModule`,
 *  `process.chdir` are not special — they are simply not on the list, and neither is any future member:
 *  a capability that must be ADDED to an allow-list to exist is a capability this rule refuses until a
 *  reviewer adds it on purpose — PROVIDED the capability spells one of the convicted names; a handle
 *  obtained under a name the scan does not know sits outside this rule's reach, which is spelled out at
 *  INTRINSIC_ESCAPE_HATCH_NAMES and in the scope block above. If the lane ever genuinely needs
 *  `process.env`-class non-capability data, the member joins this list through review and this comment says
 *  where it was measured. */
const PROCESS_MEMBER_ALLOW_LIST: readonly string[] = []

const DECISION_ENTRIES_SRC = [join(RUNTIME_ROOT, 'review-assignment', 'index.ts'), join(RUNTIME_ROOT, 'review-mandate', 'index.ts')]
const DECISION_ENTRIES_DIST = [
  join(RUNTIME_ROOT, 'dist', 'packages', 'runtime', 'review-assignment', 'index.js'),
  join(RUNTIME_ROOT, 'dist', 'packages', 'runtime', 'review-mandate', 'index.js'),
]
// Resolution candidate lists for the closure walk — the extensions a `./x.js` specifier may RESOLVE to, a
// different question from which files sit on a surface (that question belongs to the directory content,
// listDirectoryContentRecursively). `.cts`/`.cjs` are in (F-I1b6-3): a lane module written in either flavour
// must resolve when the barrel names it, exactly as its `.ts`/`.js` twin does.
const LANE_SRC_CLOSURE_EXTENSIONS = ['.ts', '.mts', '.cts']
const LANE_DIST_CLOSURE_EXTENSIONS = ['.js', '.mjs', '.cjs']

describe('P-1 (A5↔A6, PR #531 invariant): an approval decision cannot reach policy or sandbox configuration', () => {
  it('the reachable set is DERIVED from real import edges by an AST walk — no unfollowable edge, no unresolved edge, and the walk is checked against the directories it must cover', () => {
    // No hand-maintained file list: BFS follows the specifiers the compiler itself would follow, from the two
    // lane barrels (which re-export the whole lane surface, `export * from './assignment-admission.js'`), by
    // PARSING each file — an edge split across a line break, a `from` behind string-literal comment markers,
    // or a module in a subdirectory is an edge (F-I1b5-1, plants S1/S2, are fixtures in the instrument-self
    // leg below). Completeness is asserted before anything is claimed over the set: an unfollowable relative
    // edge, a parse error, or a specifier that is not a literal (`import(x)`, `require(cond ? … )`,
    // `import.meta`, `createRequire`) means the walk cannot know what it reaches — so both buckets are
    // required empty, from the parse tree, and the refusal names file, line and node text. The lane-coverage
    // lines then prove the walk actually walked: every module of each lane directory — listed RECURSIVELY by
    // an independent filesystem walk, subdirectories included — is in the set, and nothing the walk found in
    // a lane directory is outside the listing. The expectation is the listing's arithmetic, never the
    // walker's: a walker that stopped at a subdirectory cannot make the expectation stop there too.
    const walk = walkStaticClosure(DECISION_ENTRIES_SRC, LANE_SRC_CLOSURE_EXTENSIONS)
    expect(walk.nonStatic, `the decision plane grew an edge the walk cannot resolve to a literal specifier, so a static closure can no longer name what it reaches:\n${walk.nonStatic.join('\n')}`).toEqual([])
    expect(walk.unresolved, `a relative import resolves to no file (or a file no longer parses) — the closure would silently stop short:\n${walk.unresolved.join('\n')}`).toEqual([])
    for (const laneDir of ['review-assignment', 'review-mandate']) {
      // The expectation is directory CONTENT, unfiltered (F-I1b6-3): a `.cts` module dropped next to the
      // others must be reached by the walk or this leg reddens — under the old `['.ts','.mts']` filter it
      // was invisible to both measurements at once, which is the exact pair-blindness round 6 planted.
      const listing = listDirectoryContentRecursively(join(RUNTIME_ROOT, laneDir))
      expect(listing.symlinks, `${laneDir} carries symlinks — an aliased module is not a file of this directory, and its target is outside what a listing can attest to (F-I1b5-7 leaves tsc's symlink behaviour unmeasured, so the surface refuses aliases rather than trusting them):\n${listing.symlinks.join('\n')}`).toEqual([])
      const scripts = listing.files.filter((rel) => laneSurfaceCategory(rel) === 'script')
      const nonScripts = listing.files.filter((rel) => laneSurfaceCategory(rel) !== 'script')
      expect(nonScripts, `${laneDir} (a SOURCE directory) carries files that are not lane modules — a source lane holds scripts; anything else is either a build artifact in the wrong place or a file kind this instrument has not been told about, and neither may be skipped silently:\n${nonScripts.join('\n')}`).toEqual([])
      expect(scripts.length, `${laneDir} has no modules — the walk is measuring an empty lane`).toBeGreaterThan(0)
      const laneInWalk = walk.files.map(relToRepo).filter((rel) => rel.startsWith(`packages/runtime/${laneDir}/`)).sort()
      expect(laneInWalk, `the closure and the unfiltered listing disagree about what ${laneDir} holds — every module the directory carries must be reachable from the barrel, and nothing the walk found may sit outside the listing:\nonly-in-walk: ${laneInWalk.filter((rel) => !scripts.includes(rel)).join('\n')}\nonly-on-disk: ${scripts.filter((rel) => !laneInWalk.includes(rel)).join('\n')}`).toEqual(scripts)
    }
    expect(walk.files.map(relToRepo).some((rel) => rel.startsWith('packages/contracts/')), 'the closure never crossed into the frozen contracts vocabulary — the walk stopped inside the lane').toBe(true)
  })

  it('everything the walk reaches sits in the decision lanes or the frozen vocabulary, and every module edge it records names the closed allow-list', () => {
    // This is the closure form of the prohibition: not "we hope no one imports the control center", but the
    // statement "every file the decision path can transitively touch is one of these planes, and no edge in
    // any of them names a module outside the allow-list or the process object outside its allow-list".
    // Scope of the sentence, stated: the edges are the ones THIS analyzer records — import/export forms,
    // dynamic import, require, import-equals (F-I1b6-2), type-position import() (F-I1b6-6) — and a construct
    // the analyzer has never heard of is not an edge it can grade. That residual is the one the header
    // concedes in one sentence: names the scan does not know are review's to catch, not this leg's.
    // The edge check runs PER FILE, over the parse tree — not over a string set assembled from the text —
    // so `import\n  ('node:fs')` and `require('node:fs')` and a re-export are the same kind of named edge.
    // A future import of any other plane — sandbox-provider, control, blueprint/policy writers, or a builtin
    // with I/O — reddens THIS leg by name, which is the point of freezing it now.
    const walk = walkStaticClosure(DECISION_ENTRIES_SRC, LANE_SRC_CLOSURE_EXTENSIONS)
    expect(outsideReachablePlanes(walk.files), `the decision path now reaches outside the lanes + frozen contracts:\n${outsideReachablePlanes(walk.files).join('\n')}`).toEqual([])
    expect(walk.external, `the decision plane imports external modules beyond the closed allow-list ${ALLOWED_EXTERNAL_MODULES.join(', ')}:\n${walk.external.join(', ')}`).toEqual([...ALLOWED_EXTERNAL_MODULES])
    const scans = walk.files.map(scanFile)
    expect(scanBucket(scans, 'capabilityViolations'), `a file in the reachable decision set breaches an allow-list (module specifier, process member, or ambient capability name):\n${scanBucket(scans, 'capabilityViolations').join('\n')}`).toEqual([])
  })

  it('the forbidden vocabulary appears nowhere in the reachable source — refusal names file and line', () => {
    // The second, independent net. Its claim is exactly its reach: it NAMES forbidden tokens that appear in
    // code text (comments blanked by the compiler's scanner, so string-quoted `/*` cannot shield a region —
    // round 5, plant S2 — and line numbers are the real ones, so a hit is locatable with one `cd`). A word
    // list cannot prove that no other name exists, and this leg does not claim it: the constructive rules
    // are the allow-list legs above — a module edge outside `node:crypto`, a `process` member off the empty
    // list, or a convicted global/hatch name reddens there whether or not this net knows the token — and
    // what both instruments share as their limit is the tripwire sentence in the scope block: names they do
    // not know are not caught by either. What this net independently catches is
    // a forbidden surface spelled in code WITHOUT being imported as an edge: a call, a string, an alias.
    const walk = walkStaticClosure(DECISION_ENTRIES_SRC, LANE_SRC_CLOSURE_EXTENSIONS)
    const hits = vocabularyHitsOfFiles(walk.files, FORBIDDEN_DECISION_PLANE_VOCABULARY)
    expect(hits, `the reachable decision-plane source names policy-writing or confinement surfaces:\n${hits.join('\n')}`).toEqual([])
  })

  it('the BUILT barrels reach the same planes and the same closed sets — the graph the shipped code loads', () => {
    // Reachability claim over the built mirror, kept as ITS OWN claim (F-I1b5-3: the old title called the
    // install surface "the same graph", and an orphan module disproved the sentence; the surface is graded
    // by the next leg, over every emitted file, reachability or not). Here: the graph from the built
    // barrels is walked the same AST way and satisfies the same closed claims — completeness buckets empty,
    // planes closed, external set equal, capability allow-lists held per file, vocabulary clean.
    for (const entry of DECISION_ENTRIES_DIST) {
      expect(existsSync(entry), `the built counterpart ${relToRepo(entry)} is missing — this leg measures the SHIPPED graph, so a missing mirror is a red leg, not a skipped one`).toBe(true)
    }
    const walk = walkStaticClosure(DECISION_ENTRIES_DIST, LANE_DIST_CLOSURE_EXTENSIONS)
    expect(walk.nonStatic, `the built decision plane grew an edge no static walk can resolve:\n${walk.nonStatic.join('\n')}`).toEqual([])
    expect(walk.unresolved, `a built relative import resolves to no built file (or a built file no longer parses) — the dist closure would stop short:\n${walk.unresolved.join('\n')}`).toEqual([])
    expect(outsideReachablePlanes(walk.files), `the BUILT decision path reaches outside the lanes + frozen contracts:\n${outsideReachablePlanes(walk.files).join('\n')}`).toEqual([])
    expect(walk.external, `the BUILT decision plane imports beyond the closed allow-list:\n${walk.external.join(', ')}`).toEqual([...ALLOWED_EXTERNAL_MODULES])
    const scans = walk.files.map(scanFile)
    expect(scanBucket(scans, 'capabilityViolations'), `a file in the BUILT reachable set breaches an allow-list:\n${scanBucket(scans, 'capabilityViolations').join('\n')}`).toEqual([])
    const hits = vocabularyHitsOfFiles(walk.files, FORBIDDEN_DECISION_PLANE_VOCABULARY)
    expect(hits, `the built decision-plane source names policy-writing or confinement surfaces:\n${hits.join('\n')}`).toEqual([])
  })

  it('the install surface enumerates the lane dist directories by CONTENT and classifies every file: scripts scanned, the one exclusion held to its measured condition, unclassified is a red', () => {
    // F-I1b5-3, plant S5: an orphan module in `dist` — emitted, shipped, never reached by the barrel graph —
    // sat outside every P-1 leg while carrying `require('node:fs')`. F-I1b6-3, plants E5/E5b: the listing this
    // leg compares against used to be an EXTENSION FILTER, so the same bytes named `.cjs` instead of `.js`
    // were scanned by nothing while the `.js` twin reddened. The listing is now the directory's content and
    // every file is classified: script bytes get the analyzer + the vocabulary net; `.map` bytes are the one
    // excluded category, held to the measured condition in embeddedSourceTextInMap (a map that ever embeds
    // source text is source to this scan and reddens); an unclassifiable file is a red, because a gap in the
    // instrument's imagination must not be the same colour as a pass. Reachability (barrel graph vs listing)
    // stays its own assertion with its own message — two claims, two messages, so a future red says which
    // one broke.
    for (const laneDir of ['review-assignment', 'review-mandate']) {
      const distDir = join(RUNTIME_ROOT, 'dist', 'packages', 'runtime', laneDir)
      expect(existsSync(distDir), `the built lane directory ${relToRepo(distDir)} is missing — there is no install surface to scan`).toBe(true)
      const listing = listDirectoryContentRecursively(distDir)
      expect(listing.symlinks, `${relToRepo(distDir)} carries symlinks — tsc's symlink behaviour is an OPEN unmeasured question (F-I1b5-7), so the install surface refuses aliases instead of scanning through them:\n${listing.symlinks.join('\n')}`).toEqual([])
      expect(listing.files.length, `${relToRepo(distDir)} lists no files at all — this leg would be scanning nothing`).toBeGreaterThan(0)
      const scripts = listing.files.filter((rel) => laneSurfaceCategory(rel) === 'script')
      const maps = listing.files.filter((rel) => laneSurfaceCategory(rel) === 'excluded-data')
      const unclassified = listing.files.filter((rel) => laneSurfaceCategory(rel) === 'unclassified')
      expect(unclassified, `${relToRepo(distDir)} holds files in no category — add the category with a justification, or remove the bytes; do not let the surface quietly stop covering them (F-I1b6-3):\n${unclassified.join('\n')}`).toEqual([])
      // The exclusion earns its keep by measurement every run: an embedded-source map is a shipped copy of
      // the source, and source is what the prohibition grades.
      const embedding = maps.map(embeddedSourceTextInMap).filter((note): note is string => note !== null)
      expect(embedding, `a .map in the install surface breaks the only condition its exclusion rests on:\n${embedding.join('\n')}`).toEqual([])
      const scans = scripts.map((rel) => scanFile(join(REPO_ROOT, rel)))
      expect(scanBucket(scans, 'parseErrors'), `a file the build emitted does not parse — nothing may be claimed clean about bytes no compiler can read:\n${scanBucket(scans, 'parseErrors').join('\n')}`).toEqual([])
      expect(scanBucket(scans, 'nonStatic'), `a file the build emitted carries a loader construct the closure cannot complete:\n${scanBucket(scans, 'nonStatic').join('\n')}`).toEqual([])
      expect(scanBucket(scans, 'capabilityViolations'), `a file the build emitted breaches an allow-list — it SHIPS, reachability or not (F-I1b5-3):\n${scanBucket(scans, 'capabilityViolations').join('\n')}`).toEqual([])
      const hits = vocabularyHitsOfFiles(scripts.map((rel) => join(REPO_ROOT, rel)), FORBIDDEN_DECISION_PLANE_VOCABULARY)
      expect(hits, `a file the build emitted names policy-writing or confinement surfaces:\n${hits.join('\n')}`).toEqual([])
      // The separate reachability claim: the graph the built barrels reach and the code bytes on disk agree
      // file-for-file. When they diverge, something shipped that no barrel loads — which is exactly how S5's
      // orphan escaped the graph legs; the scan above already covers it either way.
      const walk = walkStaticClosure(DECISION_ENTRIES_DIST, LANE_DIST_CLOSURE_EXTENSIONS)
      const laneBuilt = new Set(walk.files.map(relToRepo).filter((rel) => rel.startsWith(`packages/runtime/dist/packages/runtime/${laneDir}/`)))
      const listedCode = scripts.filter((rel) => /\.(?:js|mjs|cjs)$/.test(rel))
      expect([...laneBuilt].sort(), `the barrel graph and the unfiltered listing of ${relToRepo(distDir)} disagree file-for-file — either a module shipped that no barrel loads (S5's escape; scanned above either way) or the graph loads what the listing does not carry:\nreceived=[graph reaches] expected=[listing holds], diff: ${JSON.stringify({ onlyInGraph: [...laneBuilt].filter((rel) => !listedCode.includes(rel)), onlyInListing: listedCode.filter((rel) => !laneBuilt.has(rel)) })}`).toEqual(listedCode)
    }
  })

  it('the instrument bites: planted violating lines are convicted by name, and clean code is cleared', () => {
    // THE INSTRUMENT ITSELF, in the F-I1b4-1 tradition: a scan that convicts nothing is a scan that prohibits
    // nothing. Each planted snippet is the exact byte string a future diff could carry; the scan must name
    // the token AND the line, including when the violation sits on line 2. The clean snippet proves the scan
    // is not just always-red theatre.
    const convictions: ReadonlyArray<readonly [string, string]> = [
      ["import { compileFdPlan } from '../sandbox-provider/index.js'", 'sandbox-provider'],
      ["import { readFileSync } from 'node:fs'", 'node:fs'],
      ["const proc = require('child_process')", 'child_process'],
      ["export const touch = (): void => { writeFileSync('/tmp/x', 'x') }", 'writeFileSync'],
      ["export const raise = (): void => { setPolicy({ ceiling: 99 }) }", 'setPolicy'],
    ]
    for (const [planted, token] of convictions) {
      const hits = vocabularyHitsOfText(planted, 'PLANTED.ts', FORBIDDEN_DECISION_PLANE_VOCABULARY)
      const [first] = hits
      expect(first, `the scanner cleared planted code that names '${token}': ${planted}`).toBeDefined()
      expect(first, `the hit for '${token}' must name the token and the line it was found on`).toContain(`names '${token}' in code`)
      expect(first).toContain('PLANTED.ts:1')
    }
    const deepLine = vocabularyHitsOfText("export const fine = 1\nexport const bad = () => grantPermission('everything')", 'PLANTED.ts', FORBIDDEN_DECISION_PLANE_VOCABULARY)
    expect(deepLine.some((hit) => hit.includes('PLANTED.ts:2') && hit.includes("'grantPermission'")), 'a violation on line 2 was not reported on line 2').toBe(true)
    expect(vocabularyHitsOfText("import { createHash } from 'node:crypto'\nexport const digest = (input: string): string => createHash('sha256').update(input).digest('hex')", 'CLEAN.ts', FORBIDDEN_DECISION_PLANE_VOCABULARY)).toEqual([])
  })

  it('THE SCANNER ITSELF (F-I1b5-1): the shapes that blinded the old regex are convicted on sight, and clean code is cleared', () => {
    // The F-I1b4-1 tradition applied to this describe's own instrument: the P-1 legs above are only as good
    // as `analyzeSource` + `blankModuleComments`, and those are code — code that a future edit could replace
    // with "just a regex" because it is shorter. So every round-5 plant shape and several new edge classes
    // are graded HERE as fixtures, through the SAME functions the legs run: if someone reintroduces a
    // per-line regex, or the parse loses an edge class, a leg in THIS file goes red instead of the closure
    // claim quietly becoming false. The CLEAN fixture (real lane bytes) proves the scanner is not theatre.
    const scanText = (name: string, text: string, scriptKind: ts.ScriptKind = ts.ScriptKind.TS): SourceScan => analyzeSource(name, text, scriptKind)
    const violationTexts = (scan: SourceScan): string => [...scan.nonStatic, ...scanBucket([scan], 'capabilityViolations')].join('\n')

    // S1 (round 5): a dynamic import split across a line break, aimed at a subdirectory module the old
    // non-recursive listing never saw. The AST sees one edge; the hidden module's own text breaches the
    // module allow-list by name.
    const s1 = scanText('S1.ts', "export const lazyEscape = (): Promise<unknown> => import\n  ('./hidden/index.js')\n")
    expect(s1.edges.map((edge) => `${edge.kind}:${edge.specifier}`), 'the split-line dynamic import was not seen as an edge (F-I1b5-1/S1)').toEqual(['dynamic-import:./hidden/index.js'])
    expect(s1.nonStatic, 'a literal dynamic import must be FOLLOWED, not refused — only non-literal specifiers are non-static').toEqual([])
    const hidden = scanText('hidden/index.ts', "import { readFileSync } from 'node:fs'\nexport const peek = (p: string): string => readFileSync(p, 'utf8')\n")
    expect(violationTexts(hidden), 'the subdirectory module the S1 edge reaches must breach the module allow-list by name').toContain("names external module 'node:fs'")

    // S2 (round 5): string-quoted comment markers around a LIVE static import. The lexer-scanner cannot be
    // blinded by `'/*'`/`'*/'`, and real comments still blank — both halves are asserted, or the leg could
    // pass by never blanking anything.
    const s2Source = [
      "export const BLINDER_OPEN = '/*'",
      "import { writeFileSync as blindedWrite } from 'node:fs'",
      "export const BLINDER_CLOSE = '*/'",
      '// a real comment that mentions writeFileSync and node:fs as prose',
      '/* a real block comment naming node:fs too */',
      'export const edgeUser = blindedWrite',
    ].join('\n')
    const s2 = scanText('S2.ts', s2Source)
    expect(s2.edges.map((edge) => edge.specifier), 'the import between string-quoted comment markers was lost (F-I1b5-1/S2)').toEqual(['node:fs'])
    expect(violationTexts(s2), 'the blinded import must breach the module allow-list by name').toContain("names external module 'node:fs'")
    const s2VocabularyHits = vocabularyHitsOfText(blankModuleComments(s2Source), 'S2.ts', FORBIDDEN_DECISION_PLANE_VOCABULARY)
    expect(s2VocabularyHits.filter((hit) => hit.includes("'writeFileSync'")).length, 'the live import line names writeFileSync exactly once — the real comments (lines 4-5) must be blanked, so two or more hits mean blanking stopped working and zero means the scanner lost the live line').toBe(1)

    // S3/S4 (round 5): OS capability with no vocabulary token. Neither name is in FORBIDDEN_*_VOCABULARY —
    // the allow-list convicts them for NOT being on it.
    expect(violationTexts(scanText('S3.ts', "export const handle = (): unknown => process.binding('spawn_sync')\n")), 'process.binding must be refused by the allow-list (F-I1b5-2/S3)').toContain('process.binding')
    expect(violationTexts(scanText('S4.ts', "export const load = (m: { exports: unknown }, p: string): boolean => process.dlopen(m, p, 0)\n")), 'process.dlopen must be refused by the allow-list (F-I1b5-2/S4)').toContain('process.dlopen')
    expect(violationTexts(scanText('PROC.ts', "const p = process\nexport default p.cwd()\n")), 'a by-value handle to process must be refused').toContain("references the process object by value")
    expect(violationTexts(scanText('PROC2.ts', "const { cwd } = process\nexport default cwd\n")), 'process destructuring must be refused').toContain('references the process object by value')
    expect(violationTexts(scanText('CHDIR.ts', "export const go = (): void => { process.chdir('/tmp') }\n"))).toContain('process.chdir')
    expect(violationTexts(scanText('MAINMOD.ts', 'export const m = process.mainModule\n'))).toContain('process.mainModule')

    // S5 (round 5): a dist orphan's CONTENT. Whether it is in the listing is the install-surface leg's
    // claim; this half proves the content scan convicts it once the listing includes it.
    const s5 = scanText('r5_orphan.js', "const fs = require('node:fs')\nconst cp = require('node:child_process')\nmodule.exports = { fs, cp }\n", ts.ScriptKind.JS)
    expect(s5.edges.map((edge) => edge.specifier), 'a require() edge in a .js file must be seen').toEqual(['node:fs', 'node:child_process'])
    expect(violationTexts(s5), 'the orphan module content must breach the module allow-list twice, by name').toContain("names external module 'node:fs'")
    expect(violationTexts(s5)).toContain("names external module 'node:child_process'")

    // NEW edge classes beyond the five plants — the tripwire for any future rewrite of the scanner:
    // `export * from` and named re-exports are edges, in subdirectories too.
    expect(scanText('X1.ts', "export * from './sub/hidden.js'\nexport { y } from '../y.js'\n").edges.map((edge) => `${edge.kind}:${edge.specifier}`)).toEqual(['export-star:./sub/hidden.js', 'named-reexport:../y.js'])
    // template-literal specifiers with no substitution are literal specifiers; a substitution is NOT.
    expect(scanText('X2.ts', 'const m = await import(`./tpl/thing.js`)\nconst r = require(`./tpl/req.js`)\nexport default [m, r]\n').edges.map((edge) => edge.specifier)).toEqual(['./tpl/thing.js', './tpl/req.js'])
    expect(violationTexts(scanText('X3.ts', 'const m = await import(`./tpl/${name}.js`)\nexport default m\n'))).toContain('NON-LITERAL specifier')
    // computed and conditional specifiers are refusals naming the node, never silent skips.
    const x4 = scanText('X4.ts', "const name = './' + user + '.js'\nconst dyn = await import(name)\nconst r2 = require(cond ? './a.js' : './b.js')\nexport default [dyn, r2]\n")
    expect(x4.nonStatic.length, 'both non-literal edges must be refused by name').toBe(2)
    expect(x4.nonStatic.join('\n')).toContain('import(name)')
    expect(x4.edges.length, 'a non-literal edge must never be followed as if it were known').toBe(0)
    // createRequire / import.meta: loader construction is refused as non-static, and the builtin behind it
    // (`node:module`) is outside the allow-list anyway.
    const x5 = scanText('X5.ts', "import { createRequire } from 'node:module'\nconst req = createRequire(import.meta.url)\nexport default req\n")
    expect(x5.nonStatic.length, 'createRequire and import.meta are both refused').toBe(2)
    expect(violationTexts(x5)).toContain("names external module 'node:module'")
    // the ambient-global net, and the one thing it must NOT convict: a name the file binds itself.
    expect(violationTexts(scanText('X6.ts', "const p = await fetch('https://example.com')\nconst w = new Worker('./x.js')\nconst bad = eval('1+1')\nconst f = new Function('return 1')\nexport default [p, w, bad, f]\n"))).toContain("ambient capability name 'fetch'")
    expect(violationTexts(scanText('X7.ts', "export const probe = globalThis['fetch']\n"))).toContain('through globalThis')
    expect(scanText('X8.ts', "const fetch = (u: string): string => u\nexport default fetch('x')\n").capabilityViolations, 'a local named fetch is not the global fetch — the scanner must not be always-red theatre').toEqual([])
    // unprefixed builtins and bare packages are outside the allow-list — the closed set is the rule.
    expect(violationTexts(scanText('X9.ts', "import fs from 'fs'\nimport { z } from 'zod'\nexport default [fs, z]\n"))).toContain("names external module 'fs'")

    // ROUND 6 (F-I1b6-1) — the exact planted bytes, every spelling the reviewer landed with. Each redds on
    // its own rule: by-value hatch reference, global-object member access folded out of a concatenation,
    // and the `.constructor(...)` member call that never spells a name at all.
    const r6e2 = scanText('E2.ts', "export const r6Compile = Function\nexport const r6Leak = (): unknown => r6Compile('return process')()\n")
    expect(violationTexts(r6e2), 'F-I1b6-1/E2: Function handed out as a VALUE must convict — at `f773d1603` these two lines reached live process with every gate green').toContain("intrinsic escape hatch 'Function'")
    const r6e1 = scanText('E1.ts', "export const r6E1ProcessViaGlobalObject = (): unknown => globalThis['process'].chdir\n")
    expect(violationTexts(r6e1), 'F-I1b6-1/E1: the global object indexed by a literal must convict').toContain("reaches 'process' through globalThis")
    const r6e8 = scanText('E8.ts', "export const r6E8Binding = (): unknown => (globalThis as unknown as Record<string, Record<string, (...a: unknown[]) => unknown>>)['proc' + 'ess'].binding('spawn_sync')\n")
    expect(violationTexts(r6e8), "F-I1b6-1/E8: 'proc' + 'ess' folds statically — the scanner folds it too, and names what it reaches").toContain("reaches 'process' through globalThis")
    expect(violationTexts(r6e8)).toContain("intrinsic escape hatch 'globalThis'")
    const r6e9 = scanText('E9.ts', "type R6Site = { readonly getFunction: () => R6Ctor | undefined }\ntype R6Ctor = (...args: string[]) => unknown\nexport const r6E9Process = (): unknown => { const prior = Error.prepareStackTrace; let found: unknown; Error.prepareStackTrace = (_error, sites) => { found = sites[1]; return 'r6' }; void new Error().stack; Error.prepareStackTrace = prior; const ctor = found === undefined ? undefined : (found as R6Site).getFunction(); return ctor === undefined ? undefined : ctor.constructor('return process')() }\n")
    expect(violationTexts(r6e9), 'F-I1b6-1/E9: a call to .constructor(...) convicts by shape — this plant spells none of Function/eval/globalThis/Reflect/process as a reference').toContain('calls .constructor(...)')
    // The E9 honesty discipline, kept because it is the reviewer's own: the fixture above proves the SHAPE
    // is convicted, and NOTHING more. Measured at `f773d1603` (round-6 report + logs/E9-live.log), the live
    // payload of this exact expression returned `undefined` under vitest — this file does not claim it
    // landed `process`, and after the fix it does not need to: the shape is refused at review time, which
    // is all a tripwire ever promised.
    expect(violationTexts(scanText('E9b.ts', "export const r6CallSiteRead = (sites: unknown): unknown => (sites as { 1: { getFunction: () => unknown } })[1].getFunction\n"))).not.toContain('.constructor')
    // F-I1b6-2 — `import x = require('node:fs')`: an edge the AST walk now records, so the ALLOW-LIST
    // convicts it and the conviction does not depend on the vocabulary net being alive.
    const eq = scanText('EQ.ts', "import fsx = require('node:fs')\nexport const r6rd = (): unknown => fsx.readFileSync\n")
    expect(eq.edges.map((edge) => `${edge.kind}:${edge.specifier}`), 'F-I1b6-2: ImportEqualsDeclaration over an ExternalModuleReference is a module edge').toEqual(['import-equals:node:fs'])
    expect(violationTexts(eq)).toContain("names external module 'node:fs'")
    // F-I1b6-5 — a require that locates without loading, and a require handed around by value: neither may
    // pass unrecorded, because the closure cannot name the bytes either one can pull in.
    const p4a = scanText('P4a.ts', "const where = require.resolve('./hidden/index.js')\nexport default where\n")
    expect(p4a.nonStatic.join('\n'), 'F-I1b6-5: require.resolve must be refused as a non-static locational construct').toContain('require.resolve locates a module without loading it')
    const p4b = scanText('P4b.ts', "const r = require\nconst m = r('./x.js')\nexport default m\n")
    expect([...p4b.nonStatic, ...p4b.capabilityViolations].join('\n'), 'F-I1b6-5: require by value escapes edge recording and must convict on the alias itself').toContain('require is referenced by value')
    expect(scanText('P4c.ts', "import fsx = require('node:fs')\nexport const r6rd = (): unknown => fsx.readFileSync\n").nonStatic.join('\n'), 'the require INSIDE an import-equals is syntax, not an aliased require — the edge records it').not.toContain('referenced by value')
    // F-I1b6-6 — the type-position import(): invisible at `f773d1603` while the statement form convicted.
    const p8 = scanText('P8.ts', "type R6Fs = import('node:fs')\nexport type R6Maybe = R6Fs | undefined\n")
    expect(p8.edges.map((edge) => `${edge.kind}:${edge.specifier}`), 'F-I1b6-6: import(...) in type position names a module and must be recorded').toEqual(['import-type:node:fs'])
    expect(violationTexts(p8)).toContain("names external module 'node:fs'")

    // A few more shapes in the same family, asserted because "it would convict" is not a measurement:
    // the plain member form of the global object, the reflector used as a door to it, and a destructure
    // through it. All three carry a hatch name as a reference, so the by-value rule fires regardless of
    // what the author does with the value next.
    for (const [name, planted] of [
      ['GLOBAL-MEMBER.ts', 'export const r6 = globalThis.process.chdir'],
      ['GLOBAL-REFLECT.ts', "export const r6 = Reflect.get(globalThis, 'process')"],
      ['GLOBAL-DESTRUCTURE.ts', 'const { process: r6p } = globalThis as unknown as { process: unknown }\nexport default r6p'],
    ] as const) {
      expect(violationTexts(scanText(name, planted)), `${name}: a hatch name reached as a value must convict even when nothing is called`).toContain('intrinsic escape hatch')
    }

    // RESIDUAL MEASUREMENT, not a claim: the spellings a name-based AST rule plausibly does NOT see. Each is
    // run through the analyzer and PRINTED, and the leg pins the set that comes back empty — so the blind
    // spots are a measured list in the repo, not a paragraph of optimism. What the pin MECHANICALLY delivers,
    // stated at its size (round 7, F-I1b7-3 — the sentence this replaces claimed more): the two pins below
    // break when one of THESE enumerated spellings starts or stops being seen by the analyzer. A blind spot
    // that is not on this list breaks NOTHING here — round 7's constructor value-read family is exactly
    // that: unlisted, every gate green around it. So this block encodes a human discipline, not a
    // mechanism: when a plant or a review turns up a new blind spot, someone adds the spelling to the list
    // below, re-runs the probe, and moves the two pins in the same edit — HERE, in the file that has to
    // stay honest — before the finding is written up as closed.
    const residualSpellings: ReadonlyArray<readonly [string, string]> = [
      ['RES-module-require.ts', "const r6 = module.require('node:fs')\nexport default r6\n"],
      ['RES-comma-require.ts', "const r6 = (0, require)('node:fs')\nexport default r6\n"],
      ['RES-optional-require.ts', "const r6 = require?.('node:fs')\nexport default r6\n"],
      ['RES-eval-string.ts', "const r6 = eval('require(\\'node:fs\\')')\nexport default r6\n"],
      ['RES-ctypes.ts', "const r6 = (globalThis as Record<string, any>).require\nexport default r6\n"],
      ['RES-worker-data.ts', "export const r6 = new Worker('./w.js', { workerData: 1 })\n"],
      ['RES-descriptor-read.ts', "export const r6 = Object.getOwnPropertyDescriptor(globalThis, 'process')\n"],
      ['RES-meta-resolve.ts', "export const r6 = import.meta.resolve('node:fs')\n"],
    ]
    const residualSeen: string[] = []
    const residualBlind: string[] = []
    for (const [name, planted] of residualSpellings) {
      const scan = scanText(name, planted)
      const seen = scan.edges.length + scan.nonStatic.length + scan.capabilityViolations.length
      ;(seen > 0 ? residualSeen : residualBlind).push(name)
      console.info(`residual probe ${name}: seen=${seen} edges=${scan.edges.map((e) => e.specifier).join('|')} nonStatic=${scan.nonStatic.length} capability=${scan.capabilityViolations.length}`)
    }
    // Measured at this commit: all EIGHT spellings come back with something recorded — `(0, require)`
    // lands as nonStatic (the comma expression defeats the callee test, and the argument's string is not an
    // edge on its own), `require?.()` records the edge, `module.require(…)` records a member-require edge,
    // and the eval string / member-read require / Worker / descriptor-read / `import.meta.resolve` trip a
    // capability or loader rule. The one CONCEPTUAL blindness sits inside a seen entry: `eval('require(...)')`
    // convicts the `eval` reference, but nothing in an AST can read a module name out of a string the engine
    // will execute — that is the name-based rule's real boundary, and it is written here instead of argued
    // away. (The pin below lists what is blind by RECORDING an edge; the eval case is in the seen list
    // because `eval` itself convicts — which is exactly the distinction this probe exists to keep honest.)
    expect(residualSeen.sort(), 'the analyzer sees a different set of these spellings than it did at this commit — if a rule got stronger, shrink the blind pin below to match; do not delete the leg').toEqual(['RES-comma-require.ts', 'RES-ctypes.ts', 'RES-descriptor-read.ts', 'RES-eval-string.ts', 'RES-meta-resolve.ts', 'RES-module-require.ts', 'RES-optional-require.ts', 'RES-worker-data.ts'])
    expect(residualBlind.sort(), 'the blind set is not what this commit measured — either a rule lost a case or a spelling joined the blind list from outside; re-measure and update BOTH pins in the same edit, never one of them').toEqual([])

    // F-I1b6-3 — the extension may never again be the variable: identical bytes, every spelling the surface
    // classifies as a script, convicted identically through the script-kind the classifier routes them to.
    expect(scriptKindFor('r6orphan.cjs'), 'a .cjs orphan parses as JavaScript, not as TypeScript').toBe(ts.ScriptKind.JS)
    expect(scriptKindFor('r6evil.cts'), 'a .cts lane module parses as TypeScript').toBe(ts.ScriptKind.TS)
    const cjsBytes = "'use strict'\nconst r6fs = require('node:fs')\nmodule.exports.r6Read = (p) => r6fs.readFileSync(p, 'utf8')\n"
    for (const twin of ['r6orphan.js', 'r6orphan.cjs', 'r6orphan.mjs']) {
      const scan = analyzeSource(twin, cjsBytes, scriptKindFor(twin))
      expect(violationTexts(scan), `F-I1b6-3: identical CJS bytes named ${twin} must convict identically — at head the .cjs twin was scanned by nothing`).toContain("names external module 'node:fs'")
    }
    const ctsBytes = "import fsx = require('node:fs')\nconst r6ReadEvil = (p: string): string => fsx.readFileSync(p, 'utf8')\nexport = { r6ReadEvil }\n"
    for (const twin of ['r6evil.ts', 'r6evil.cts', 'r6evil.mts']) {
      const scan = analyzeSource(twin, ctsBytes, scriptKindFor(twin))
      expect(scan.edges.map((edge) => edge.specifier), `${twin}: the import-equals edge survives the extension`).toEqual(['node:fs'])
      expect(violationTexts(scan), `F-I1b6-3: identical import-equals bytes named ${twin} must convict identically`).toContain("names external module 'node:fs'")
    }

    // clean lane bytes must come out clean through the full analyzer, or every red above is theatre.
    // F-I1b6-7: the control used to run on 2 of the 22 scanned files, and round 6 rightly called the title
    // bigger than the fixture. WIDENED, not retitled: every script file the two lane surfaces enumerate —
    // source dirs and dist dirs, every extension the classifier knows — runs the control now. The count
    // floor keeps the control from silently narrowing to nothing.
    const cleanScripts = ['review-assignment', 'review-mandate'].flatMap((laneDir) => [
      ...listDirectoryContentRecursively(join(RUNTIME_ROOT, laneDir)).files.filter((rel) => laneSurfaceCategory(rel) === 'script'),
      ...listDirectoryContentRecursively(join(RUNTIME_ROOT, 'dist', 'packages', 'runtime', laneDir)).files.filter((rel) => laneSurfaceCategory(rel) === 'script'),
    ])
    expect(cleanScripts.length, 'the widened clean control would scan nothing — the surfaces enumerated no scripts').toBeGreaterThanOrEqual(33)
    for (const relFile of cleanScripts) {
      const clean = scanFile(join(REPO_ROOT, relFile))
      expect([...clean.parseErrors, ...clean.nonStatic, ...scanBucket([clean], 'capabilityViolations')], `real lane bytes ${relFile} must analyze clean — if this is red, every conviction above is meaningless`).toEqual([])
    }
  })
})

// --- P-2 harness: the verdict shapes, measured live, with the pr0 green fixture re-established here -------------
// The shapes below are copied field-for-field from the PR0 positive fixture (a6-pr0-mandate-admission.test.ts)
// and RE-ESTABLISHED in this file rather than imported from another spec — a fixture a leg cannot see is a
// fixture a leg cannot grade.

const P2_ROOT = 'team-root-01'
const P2_DIGEST = 'd4e5f6a7b8c90123456789abcdef0123456789abcdef0123456789abcdef0123'
const P2_FP_COVERED = 'ab12cd34ef560718293a4b5c6d7e8f90'
const P2_FP_UNCOVERED = '0f9e8d7c6b5a43210fedcba987654321'

function p2Plan(overrides: Record<string, unknown> = {}): ReviewPlan {
  // Overrides go into the RAW DOCUMENT and through the parser (the pr0 law): a spread copy never met the
  // parser, and admission refuses an unbranded plan — a fixture that spread would grade the wrong door.
  const result = parseReviewPlan({
    rootSessionId: P2_ROOT,
    blueprintDigest: P2_DIGEST,
    epoch: 7,
    reviewerInstanceId: 'inst-officer-1',
    delegatedRung: 'leader',
    actions: [{ actionName: 'fs:write', decisions: ['allow', 'deny'] }],
    effectScopes: [{ form: 'exact-fingerprint', value: P2_FP_COVERED }],
    expiresAtIso: null,
    ...overrides,
  })
  if (!result.ok) throw new Error(`P-2 fixture plan refused at parse: ${result.failure.code} ${result.failure.field ?? ''}`)
  return result.plan
}

function p2Verdict(overrides: {
  readonly caller?: Partial<ReviewerIdentity>
  readonly attempt?: Partial<{ decision: 'allow' | 'deny'; actionName: string; effectScopeFingerprint: string }>
  readonly caseView?: Partial<ReviewCaseView>
  readonly mandate?: Partial<ReviewMandate> | null
  readonly plan?: ReviewPlan | null
} = {}): ReviewAdmission {
  const caller: ReviewerIdentity = { role: 'member', instanceId: 'inst-officer-1', callerRef: 'instance:inst-officer-1', rootSessionId: P2_ROOT, isLeaderInstance: false, ...overrides.caller }
  const caseView: ReviewCaseView = {
    approvalCaseId: 'case-1f2e3d4c',
    requestKind: 'leader-approval',
    legReviewAuthority: 'leader',
    legOrdinal: 1,
    currentLegOrdinal: 1,
    actedCallerRefs: [],
    requesterCallerRef: 'instance:inst-worker-9',
    beneficiaryCallerRef: null,
    subjectCallerRef: null,
    actionName: 'fs:write',
    effectScopeFingerprint: P2_FP_COVERED,
    ...overrides.caseView,
  }
  const mandate: ReviewMandate | undefined = overrides.mandate === null ? undefined : {
    approvalCaseId: 'case-1f2e3d4c',
    legOrdinal: 1,
    reviewerInstanceId: 'inst-officer-1',
    planEpoch: 7,
    actionName: 'fs:write',
    decisions: ['allow', 'deny'],
    effectScopeFingerprint: P2_FP_COVERED,
    revoked: false,
    generation: 1,
    ...overrides.mandate,
  }
  return evaluateReviewAdmission({
    caller,
    attempt: { decision: 'allow', actionName: 'fs:write', effectScopeFingerprint: P2_FP_COVERED, ...overrides.attempt },
    caseView,
    plan: overrides.plan === null ? undefined : (overrides.plan ?? p2Plan()),
    mandate,
    currentEpoch: 7,
    nowIso: '2026-10-30T12:00:00Z',
    planRevoked: false,
  })
}

/** The closed result field sets. `measured, not remembered` means BOTH directions are graded at run time: the
 *  live object's keys must equal the closed list (extra or missing reddens), and the equality check itself is
 *  proved to bite with a planted widening field inside each leg. */
const ASSIGNMENT_ANSWER_KEYS = ['controlRequestKind', 'nextAssignmentEpoch', 'ok', 'resolvedRole'] as const
const ASSIGNMENT_REFUSAL_KEYS = ['detail', 'ok', 'refusal'] as const
const REVIEW_VERDICT_KEYS = ['admitted', 'basis', 'refusal'] as const
const REVIEW_PLAN_KEYS = ['actions', 'blueprintDigest', 'delegatedRung', 'effectScopes', 'epoch', 'expiresAtIso', 'rootSessionId', 'reviewerInstanceId'] as const
const REVIEW_PLAN_ACTION_KEYS = ['actionName', 'decisions'] as const
const REVIEW_PLAN_SCOPE_KEYS = ['form', 'value'] as const
/** A widening would have to ride a FIELD. No admitted key of either door may even be NAMEABLE as a scope,
 *  ceiling, or plan handle — the names are checked because a field renamed to `note` that carries an effect
 *  set is exactly the kind of move a closed key-set check alone is made to catch. */
const WIDENING_FIELD_PATTERN = /(scope|effect|fingerprint|polic|ceiling|blueprint|sandbox|mutat|widen|grant|delegat|plan)/i

function fieldSetViolations(actual: readonly string[], closed: readonly string[]): string[] {
  const extra = actual.filter((key) => !(closed as readonly string[]).includes(key)).map((key) => `field '${key}' is not in the closed result vocabulary`)
  const missing = closed.filter((key) => !actual.includes(key)).map((key) => `closed field '${key}' left the result shape`)
  return [...extra, ...missing]
}

function collectObjectGraph(value: unknown, into: unknown[] = []): unknown[] {
  if (value !== null && typeof value === 'object') {
    into.push(value)
    for (const key of Object.keys(value)) collectObjectGraph((value as Record<string, unknown>)[key], into)
  }
  return into
}

/**
 * Every object literal in a door module that carries `requireKey` — enumerated from the AST, never
 * hand-listed (F-I1b5-4). For each: the property keys as written, the verdict's scalar-field check
 * (structures are channels), and the refusal codes written as string literals. `onlyReturns` narrows to
 * `return { … }` sites (the assignment door refuses by returning); the mandate door's literals are graded
 * wherever they sit, because its refusal shape is structurally ONE choke (`refuse()`) plus two frozen
 * admit constants, and a field planted in ANY of them must redden. `as` casts are unwrapped before the
 * scalar check so the plant can stay type-valid — `['*'] as readonly string[]` is still an array.
 */
function objectLiteralFieldShapes(sourceText: string, label: string, requireKey: string, onlyReturns: boolean): Array<{ line: number; keys: string[]; violations: string[]; refusalLiterals: string[] }> {
  const sourceFile = ts.createSourceFile(label, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const unwrapAsExpr = (node: ts.Expression): ts.Expression => (ts.isAsExpression(node) ? unwrapAsExpr(node.expression) : node)
  const isScalarValue = (node: ts.Expression): boolean => {
    const inner = unwrapAsExpr(node)
    return ts.isStringLiteral(inner) || ts.isNoSubstitutionTemplateLiteral(inner) || ts.isTemplateExpression(inner) || ts.isNumericLiteral(inner) || ts.isIdentifier(inner) || ts.isPropertyAccessExpression(inner) || ts.isCallExpression(inner) || inner.kind === ts.SyntaxKind.TrueKeyword || inner.kind === ts.SyntaxKind.FalseKeyword || inner.kind === ts.SyntaxKind.NullKeyword || (ts.isBinaryExpression(inner) && inner.operatorToken.kind === ts.SyntaxKind.PlusToken)
  }
  const shapes: Array<{ line: number; keys: string[]; violations: string[]; refusalLiterals: string[] }> = []
  const grade = (literal: ts.ObjectLiteralExpression): void => {
    const keys: string[] = []
    const violations: string[] = []
    const refusalLiterals: string[] = []
    const line = sourceFile.getLineAndCharacterOfPosition(literal.pos).line + 1
    for (const property of literal.properties) {
      if (ts.isSpreadAssignment(property)) {
        violations.push(`${label}:${line} spreads into a verdict literal — a spread hides the field set from every static reader and from this census`)
        continue
      }
      if (ts.isShorthandPropertyAssignment(property)) {
        keys.push(property.name.text)
        continue
      }
      // F-I1b7-1: a computed key whose expression statically folds to a string IS that key — round 7's V7
      // plant wrote `['refusal']: 'ADMISSION_TEAM_UNKNOWN' as const` and this census, which called EVERY
      // computed key '<computed>', graded nothing there while the widened field rode through green. A key
      // that does NOT fold stays '<computed>': no enumeration can name it — the gap is disclosed at the leg.
      const keyText = ts.isComputedPropertyName(property.name) ? staticallyFoldedString(property.name.expression) ?? '<computed>' : property.name.getText(sourceFile).replace(/^['"]|['"]$/g, '')
      keys.push(keyText)
      if (ts.isPropertyAssignment(property)) {
        if (!isScalarValue(property.initializer)) violations.push(`${label}:${line} field '${keyText}' carries a ${ts.SyntaxKind[unwrapAsExpr(property.initializer).kind]} — a structure in a verdict field is a channel`)
        if (keyText === 'refusal' && ts.isStringLiteral(property.initializer)) refusalLiterals.push(property.initializer.text)
        if (keyText === 'refusal' && !(ts.isStringLiteral(property.initializer) || ts.isPropertyAccessExpression(unwrapAsExpr(property.initializer)) || unwrapAsExpr(property.initializer).kind === ts.SyntaxKind.NullKeyword)) violations.push(`${label}:${line} 'refusal' must be a literal code or a named pass-through, not a ${ts.SyntaxKind[property.initializer.kind]}`)
      } else if (!ts.isShorthandPropertyAssignment(property)) {
        violations.push(`${label}:${line} field '${keyText}' is a ${ts.SyntaxKind[property.kind]} — a getter, setter or method on a verdict literal is behaviour in a data field`)
      }
    }
    if (keys.includes(requireKey)) shapes.push({ line, keys, violations, refusalLiterals })
  }
  const visit = (node: ts.Node): void => {
    if (onlyReturns) {
      if (ts.isReturnStatement(node) && node.expression !== undefined && ts.isObjectLiteralExpression(node.expression)) grade(node.expression)
    } else if (ts.isObjectLiteralExpression(node)) grade(node)
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return shapes
}

/** The second enumeration for the F-I1b6-4 census: how many `key:` fields the file's object literals carry
 *  in total, from a pass that asks NOTHING about return statements, bindings or control flow. The key
 *  grammar is said exactly, because round 7 (F-I1b7-1) found this pair blind to a fourth spelling: it
 *  counts an identifier (`refusal:`), a string literal (`'refusal':`) and a computed key that statically
 *  folds to a string (`['refusal']:`, `['ref' + 'usal']:` — folded by the SAME `staticallyFoldedString`
 *  the capability scanner folds with). What the two enumerations jointly prove is bounded by that grammar:
 *  a refusal literal cannot leave the census by MOVING (into a `const`, a ternary, a nested position) or by
 *  RE-SPELLING its key inside the grammar — the literal stays, both passes count it, and the graded count
 *  must equal the file's count or the leg reddens naming both numbers. What they jointly miss — a computed
 *  key that does not fold, and a verdict assembled at runtime that holds no literal at all — is disclosed
 *  at the leg, not claimed away. */
function countObjectLiteralKeys(sourceText: string, label: string, key: string): number {
  const sourceFile = ts.createSourceFile(label, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  let count = 0
  const visit = (node: ts.Node): void => {
    if (ts.isObjectLiteralExpression(node)) {
      for (const property of node.properties) {
        if (ts.isPropertyAssignment(property)) {
          // F-I1b7-1: the census and this count must fold computed keys IDENTICALLY — V7 passed precisely
          // because both passes skipped every computed key identically, so the equality survived V7's
          // shrinkage. Folded-to-string counts here exactly as in the census; null (unfoldable) counts nowhere.
          const keyText = ts.isComputedPropertyName(property.name) ? staticallyFoldedString(property.name.expression) : property.name.getText(sourceFile).replace(/^['"]|['"]$/g, '')
          if (keyText === key) count += 1
        } else if (ts.isShorthandPropertyAssignment(property) && property.name.text === key) count += 1
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return count
}

describe('P-2 (A5↔A6, PR #531 invariant): an approval never widens I/O scope — closed verdict shapes, graded coverage', () => {
  it('the assignment door answers in closed field sets, measured on live results, and the check convicts a planted widening field', async () => {
    // The keys are read off the objects the gate ACTUALLY returned — not off the interface, which a future
    // edit can change while this leg still passes only if the objects changed with it. A value may also never
    // BE a structure: every admitted field is scalar, because an object or array field is a handle, and a
    // handle is a channel.
    const w = await world()
    const admitted = await w.admit(w.request({}), HUMAN_CALLER)
    expect(admitted.ok).toBe(true)
    if (!admitted.ok) return
    expect(fieldSetViolations(Object.keys(admitted), ASSIGNMENT_ANSWER_KEYS)).toEqual([])
    for (const [key, value] of Object.entries(admitted)) {
      expect(typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean', `admitted field '${key}' carries a ${typeof value === 'object' ? 'structure' : typeof value} — a non-scalar field is a channel`).toBe(true)
    }
    const refused = await w.admit(w.request({}), MEMBER_CALLER)
    expect(refused.ok).toBe(false)
    if (refused.ok) return
    expect(fieldSetViolations(Object.keys(refused), ASSIGNMENT_REFUSAL_KEYS)).toEqual([])
    // Not one admitted or refused field name is widening-shaped…
    for (const key of [...ASSIGNMENT_ANSWER_KEYS, ...ASSIGNMENT_REFUSAL_KEYS]) {
      expect(WIDENING_FIELD_PATTERN.test(key), `field '${key}' names a scope/ceiling/plan surface — an approval answer must not own a word like that`).toBe(false)
    }
    // …and the closed-set check is proved to bite: the SAME answer plus one hypothetical widening field must
    // fail the SAME check. A closed list that cannot fail is the theatre this leg exists to refuse.
    const widened: Record<string, unknown> = { ...(admitted as unknown as Record<string, unknown>), widenEffectScope: ['*'] }
    expect(fieldSetViolations(Object.keys(widened), ASSIGNMENT_ANSWER_KEYS)).toEqual([expect.stringContaining('widenEffectScope')])
    expect(WIDENING_FIELD_PATTERN.test('widenEffectScope')).toBe(true)
  })

  it('the mandate coverage verdict is three fields and one boolean oracle — no field, and no return, can carry scope', () => {
    // Three live verdicts, three shapes: role-table admit, case-mandate admit, scope refusal. All must be
    // exactly {admitted, basis, refusal}; `basis` values are MEASURED across them against the closed trio;
    // the coverage oracle's return must be a boolean at every grid point — a boolean cannot smuggle a scope.
    const roleTable = p2Verdict({ caller: { role: 'human', instanceId: null, callerRef: 'human:h-1', isLeaderInstance: false }, mandate: null })
    expect(roleTable.admitted).toBe(true)
    const caseMandate = p2Verdict()
    expect(caseMandate.admitted).toBe(true)
    const refused = p2Verdict({
      attempt: { effectScopeFingerprint: P2_FP_UNCOVERED },
      caseView: { effectScopeFingerprint: P2_FP_UNCOVERED },
      mandate: { effectScopeFingerprint: P2_FP_UNCOVERED },
    })
    expect(refused.admitted).toBe(false)
    for (const verdict of [roleTable, caseMandate, refused]) {
      expect(fieldSetViolations(Object.keys(verdict), REVIEW_VERDICT_KEYS)).toEqual([])
    }
    expect([roleTable.basis, caseMandate.basis, refused.basis]).toEqual(['role-table', 'case-mandate', null])
    expect((REVIEW_ADMISSION_REFUSALS as readonly string[]).includes(refused.refusal as string)).toBe(true)
    const widened: Record<string, unknown> = { ...(caseMandate as unknown as Record<string, unknown>), raisePolicyCeiling: 9001 }
    expect(fieldSetViolations(Object.keys(widened), REVIEW_VERDICT_KEYS)).toEqual([expect.stringContaining('raisePolicyCeiling')])
    // The oracle answers in booleans at every grid point (listed/unlisted action × exact/by-name × match/no
    // match). `planCoversEffectScope` returning anything else would be a verdict with a payload.
    const plan = p2Plan({ actions: [{ actionName: 'fs:write', decisions: ['allow', 'deny'] }, { actionName: 'net:fetch', decisions: ['allow', 'deny'] }], effectScopes: [{ form: 'by-action-name', value: 'fs:write' }] })
    for (const actionName of ['fs:write', 'net:fetch', 'unlisted:action']) {
      for (const fingerprint of [P2_FP_COVERED, P2_FP_UNCOVERED]) {
        expect(typeof planCoversEffectScope(plan, actionName, fingerprint), `coverage for '${actionName}' did not answer in a boolean`).toBe('boolean')
      }
    }
  })

  it('the plan is immutable at every node and closed at every level — a verdict cannot mutate it, nor carry it', () => {
    // "No field through which a decision could mutate a plan" has a structural second half: the plan the
    // check consults is frozen down the whole object graph (measured: every node of the parsed plan is
    // frozen, arrays included), and its key sets are closed at all three levels. The verdict's own closed
    // field set (previous leg) is what keeps it from carrying a plan or scope out the back.
    const plan = p2Plan()
    const graph = collectObjectGraph(plan)
    expect(graph.length, 'the parsed plan graph is empty — the walk is not measuring the plan').toBeGreaterThan(3)
    for (const node of graph) {
      expect(Object.isFrozen(node), 'a node of the parsed plan is mutable — an approval-adjacent value could edit the trusted plan in place').toBe(true)
    }
    expect(fieldSetViolations(Object.keys(plan), REVIEW_PLAN_KEYS)).toEqual([])
    expect(fieldSetViolations(Object.keys(plan.actions[0] as unknown as object), REVIEW_PLAN_ACTION_KEYS)).toEqual([])
    expect(fieldSetViolations(Object.keys(plan.effectScopes[0] as unknown as object), REVIEW_PLAN_SCOPE_KEYS)).toEqual([])
    // Graded: an extra scope-carrying field on the plan shape fails the same closed check.
    const widened: Record<string, unknown> = { ...(plan as unknown as Record<string, unknown>), extraEffectScopes: [{ form: 'exact-fingerprint', value: P2_FP_UNCOVERED }] }
    expect(fieldSetViolations(Object.keys(widened), REVIEW_PLAN_KEYS)).toEqual([expect.stringContaining('extraEffectScopes')])
  })

  it('an approval whose effect-scope fingerprint matches no plan-covered scope is refused — by scope, proved with its positive control', () => {
    // attempt, caseView and grant all carry the SAME foreign fingerprint, so the agreement checks pass and
    // the only gate that can fire is plan coverage — the refusal is about the scope, not about broken wiring.
    // The positive control is the same fixture with the covered fingerprint and must ADMIT, otherwise the
    // refusal leg would pass on a fixture that admits nothing.
    const refused = p2Verdict({
      attempt: { effectScopeFingerprint: P2_FP_UNCOVERED },
      caseView: { effectScopeFingerprint: P2_FP_UNCOVERED },
      mandate: { effectScopeFingerprint: P2_FP_UNCOVERED },
    })
    expect(refused.refusal).toBe('REVIEW_MANDATE_SCOPE_NOT_DELEGATED')
    const control = p2Verdict()
    expect(control.admitted, 'the positive control of the scope-refusal fixture does not admit — the refusal leg above would be vacuous').toBe(true)
  })

  it('by-action-name covers EVERY fingerprint of the named action and nothing beside it — graded exactly as it stands (issue #502)', () => {
    // THE RECORDED OPEN CONTRACT, Alpha.5↔Alpha.6 register (Issue #502; see the #502 加补编 obligations cited
    // in `docs/plans/memo/alpha6-review-separation/pri1b-admission-design-20261031.md` §6): the fingerprint
    // semantics of `by-action-name` are an OPEN question, and this leg exists to make any silent change to
    // them impossible, not to solve it. What the interface freezes TODAY (`plan.ts:333-343`): the action must
    // be LISTED, and a `by-action-name` scope then covers EVERY fingerprint of that named action — it is
    // never authority over any policy object the plan does not name. Exactly that, and only that, is graded:
    // every-fingerprint of the named action (two synthetic fingerprints and a third never written anywhere in
    // the plan text), false for a listed-but-unnamed action, false for an unlisted action even with the
    // covered fingerprint; end-to-end an approval with a fingerprint the plan text never mentions ADMITS
    // under by-action-name (today's semantics, pinned) and the sibling exact-fingerprint plan refuses the
    // same fingerprint. The parse-time doors the semantics lean on are graded too: a by-action-name scope
    // naming an unlisted action, and any third form, refuse. Narrow or widen the semantics later — through
    // the interface, with a leg rewritten — not silently.
    const plan = p2Plan({
      actions: [{ actionName: 'fs:write', decisions: ['allow', 'deny'] }, { actionName: 'net:fetch', decisions: ['allow', 'deny'] }],
      effectScopes: [{ form: 'by-action-name', value: 'fs:write' }],
    })
    const THIRD_FP = '5f4e3d2c1b0a99887766554433221100'
    expect(planCoversEffectScope(plan, 'fs:write', P2_FP_COVERED)).toBe(true)
    expect(planCoversEffectScope(plan, 'fs:write', P2_FP_UNCOVERED)).toBe(true)
    expect(planCoversEffectScope(plan, 'fs:write', THIRD_FP)).toBe(true)
    expect(planCoversEffectScope(plan, 'net:fetch', P2_FP_COVERED)).toBe(false)
    expect(planCoversEffectScope(plan, 'net:fetch', THIRD_FP)).toBe(false)
    expect(planCoversEffectScope(plan, 'unlisted:action', P2_FP_COVERED)).toBe(false)
    // End-to-end, both readings pinned: by-action-name admits a fingerprint the plan text never mentions…
    const byName = p2Verdict({
      plan,
      attempt: { effectScopeFingerprint: THIRD_FP },
      caseView: { effectScopeFingerprint: THIRD_FP },
      mandate: { effectScopeFingerprint: THIRD_FP },
    })
    expect(byName.admitted, 'a by-action-name plan refused a fingerprint of its named action — the frozen semantics changed; this is the leg that says so').toBe(true)
    // …while the exact-fingerprint sibling plan refuses the same approval. The pair pins both halves, so a
    // change to the fingerprint semantics reddens one of them no matter which direction it moves.
    const exactOnly = p2Verdict({
      attempt: { effectScopeFingerprint: THIRD_FP },
      caseView: { effectScopeFingerprint: THIRD_FP },
      mandate: { effectScopeFingerprint: THIRD_FP },
    })
    expect(exactOnly.refusal).toBe('REVIEW_MANDATE_SCOPE_NOT_DELEGATED')
    // The parse-time doors the by-action-name semantics lean on, graded at this file's own level too:
    const unlistedScope = parseReviewPlan({
      rootSessionId: P2_ROOT, blueprintDigest: P2_DIGEST, epoch: 7, reviewerInstanceId: 'inst-officer-1', delegatedRung: 'leader',
      actions: [{ actionName: 'fs:write', decisions: ['allow', 'deny'] }],
      effectScopes: [{ form: 'by-action-name', value: 'net:delete' }],
      expiresAtIso: null,
    })
    expect(unlistedScope.ok).toBe(false)
    if (!unlistedScope.ok) expect(unlistedScope.failure.code).toBe('SCOPE_NAMES_UNLISTED_ACTION')
    for (const form of ['any', 'exact-fingerprint-prefix', 'prefix', '*']) {
      const wild = parseReviewPlan({
        rootSessionId: P2_ROOT, blueprintDigest: P2_DIGEST, epoch: 7, reviewerInstanceId: 'inst-officer-1', delegatedRung: 'leader',
        actions: [{ actionName: 'fs:write', decisions: ['allow', 'deny'] }],
        effectScopes: [{ form, value: 'fs:write' }],
        expiresAtIso: null,
      })
      expect(wild.ok, `scope form '${form}' parsed — there is no wildcard door`).toBe(false)
      if (!wild.ok) expect(wild.failure.code, `scope form '${form}' refused with a code other than SCOPE_FORM_UNKNOWN`).toBe('SCOPE_FORM_UNKNOWN')
    }
  })

  it('both doors answer in closed field sets at every refusal literal the key grammar names — identifier, string, folded computed (F-I1b5-4, F-I1b6-4, F-I1b7-1)', () => {
    // Round 5 (F-I1b5-4) put the census here; round 6 (F-I1b6-4) escaped it twice over; round 7 (F-I1b7-1)
    // escaped it once more. Round 5 walked `return { … }` statements, and a refusal routed through a binding
    // — `const answer = { ok: false, refusal: 'ADMISSION_REQUEST_MALFORMED', …, widenedEffectScopes: ['*'] };
    // return answer` — is not a return-literal: 19 graded sites became 18, the widened field rode through
    // spec, family, typecheck and eslint, and the anti-vacuity floor of 12 left seven sites of slack. Round
    // 6's rule — grade every object literal that CARRIES a refusal, whatever returns it (the helper's
    // `onlyReturns=false` mode, which round 5 shipped and left switched off) — then escaped through the KEY,
    // not the site: `['refusal']: 'ADMISSION_TEAM_UNKNOWN' as const` on a const-routed verdict carrying
    // `widenedEffectScopes: ['*']`, with one identifier-keyed decoy holding both counts at 19, passed every
    // gate, because BOTH enumerations skipped every computed key identically and the equality survived the
    // shrinkage (plant V7: spec 80/80, family 471/471, typecheck and eslint rc=0, widened field live on the
    // branch the S-5 leg drives). The rule now: a computed key whose expression statically folds to a
    // string IS a `refusal:` key in BOTH enumerations, so re-spelling the key inside the foldable grammar
    // moves nothing. WHAT THE TWO ENUMERATIONS JOINTLY PROVE, sized to the mechanism, over the key grammar
    // both read — identifier, string literal, statically-foldable computed key: a refusal literal cannot
    // leave the census by MOVING (binding, ternary, nested position) or by RE-SPELLING its key inside that
    // grammar — the literal stays, both passes count it, and the graded count must equal the file's count
    // or this leg reddens naming both numbers; and it cannot be erased quietly, because the floor below is
    // the MEASURED count, not a round number with slack. WHAT THEY JOINTLY MISS, written here instead of
    // hidden: a computed key that does NOT fold (`[k]:` for a mutable `k`, `[f()]:`) is nobody's `refusal:`
    // key to either pass — such a site is in neither count, so equality and floor survive while it goes
    // ungraded, and holding the floor while doing it costs a REAL extra refusal literal, itself graded into
    // the closed set; and a verdict assembled at runtime by a call carries no literal to count at all.
    // Both sit inside this file's published limit — a review-time tripwire over the lane's own source, not
    // a capability boundary — and both belong to the door's RUNTIME contract in the #502 interface, where
    // verdict shapes are graded on every path; what is graded LIVE today is stated at the S-5 leg.
    const assignmentSource = readFileSync(join(RUNTIME_ROOT, 'review-assignment', 'assignment-admission.ts'), 'utf8')
    const assignmentShapes = objectLiteralFieldShapes(assignmentSource, 'review-assignment/assignment-admission.ts', 'refusal', false)
    // The second enumeration: every `refusal:` KEY the file holds, from a pass that asks nothing about
    // returns, bindings or control flow. What this guard IS, stated plainly instead of oversold: it walks the
    // same AST with the same predicate, so it is NOT an independent witness over the source — it is the guard
    // that stops the CENSUS from narrowing later. If `grade` ever learns to skip nested literals, or
    // `onlyReturns` comes back, or a duplicate-key literal appears, the two counts split and this reddens.
    // The anti-erasure weight rests on the next line: the floor is the MEASURED count, so a site that leaves
    // the census takes the count with it and this floor reddens — unless the author pays for the hole with
    // another refusal literal, and every real refusal literal is graded into the closed set (round 7's V7
    // decoy is exactly that payment, now pinned as the fixture at the bottom of this leg).
    const refusalKeysInFile = countObjectLiteralKeys(assignmentSource, 'review-assignment/assignment-admission.ts', 'refusal')
    expect(assignmentShapes.length, `the graded refusal sites (${assignmentShapes.length}) do not equal the refusal-carrying literals the file holds (${refusalKeysInFile}) — a verdict routed through a helper, a ternary branch or a named const is the F-I1b6-4 escape, and it must redden HERE rather than shrink a count somewhere a floor can absorb it`).toBe(refusalKeysInFile)
    expect(refusalKeysInFile, 'the assignment door no longer holds the 19 refusal literals measured at f773d1603 — the census and the door have drifted apart and this floor must be re-measured on purpose, never slid under').toBeGreaterThanOrEqual(19)
    const assignmentViolations = assignmentShapes.flatMap((shape) => shape.violations)
    for (const shape of assignmentShapes) {
      if (JSON.stringify([...shape.keys].sort()) !== JSON.stringify([...ASSIGNMENT_REFUSAL_KEYS].sort())) assignmentViolations.push(`line ${shape.line}: a refusal-carrying literal carries fields [${shape.keys.join(', ')}] — the closed set is [${ASSIGNMENT_REFUSAL_KEYS.join(', ')}], and EVERY branch must answer in it, not just the branch a test reached`)
    }
    expect(assignmentViolations, `a refusal-carrying literal of the assignment door leaves the closed field set or carries a non-scalar value:\n${assignmentViolations.join('\n')}`).toEqual([])
    // The census cross-check: every declared own code must still be a literal on some graded refusal site
    // (the pass-through site is the only non-literal `refusal:` in the file, graded above as a named pass-through).
    const emittedLiterals = assignmentShapes.flatMap((shape) => shape.refusalLiterals)
    for (const code of ASSIGNMENT_ADMISSION_REFUSAL_CODES) {
      expect(emittedLiterals, `${code} no longer appears as a literal on any graded refusal site — either the door stopped emitting it (then the declared list must lose the line, F-I1b1-1's law) or the census stopped seeing its producer`).toContain(code)
    }
    const mandateSource = readFileSync(join(RUNTIME_ROOT, 'review-mandate', 'mandate.ts'), 'utf8')
    const mandateShapes = objectLiteralFieldShapes(mandateSource, 'review-mandate/mandate.ts', 'admitted', false)
    expect(mandateShapes.length, 'the mandate door no longer carries the verdict literals this census grades — re-establish the census against the new shape, do not let it go vacuous').toBeGreaterThanOrEqual(2)
    expect(mandateShapes.length, `the graded mandate verdicts (${mandateShapes.length}) do not equal the admitted-carrying literals the file holds (${countObjectLiteralKeys(mandateSource, 'review-mandate/mandate.ts', 'admitted')}) — same escape, same door (F-I1b6-4)`).toBe(countObjectLiteralKeys(mandateSource, 'review-mandate/mandate.ts', 'admitted'))
    const mandateViolations = mandateShapes.flatMap((shape) => shape.violations)
    for (const shape of mandateShapes) {
      if (JSON.stringify([...shape.keys].sort()) !== JSON.stringify([...REVIEW_VERDICT_KEYS].sort())) mandateViolations.push(`line ${shape.line}: a verdict literal carries fields [${shape.keys.join(', ')}] — the closed triple is [${REVIEW_VERDICT_KEYS.join(', ')}]`)
    }
    expect(mandateViolations, `a verdict literal of the mandate door leaves the closed triple or carries a non-scalar value:\n${mandateViolations.join('\n')}`).toEqual([])
    // F-I1b7-1 — the round-7 V7 plant, as a standing fixture (the plant's bytes, wrapped so they parse on
    // their own): the computed refusal key must count in BOTH enumerations and the widened field must
    // convict for the stated reason. At afc17dd63 both passes skipped this literal identically, the counts
    // stayed 19/19 around a decoy, and every gate passed over the widened field; the door holds no computed
    // key today, and this fixture keeps the escape pinned if one ever appears or a helper edit unlearns
    // the fold.
    const v7Bytes = [
      'function r7catch(error: unknown) {',
      '  const r7answer = {',
      '    ok: false as const,',
      "    ['refusal']: 'ADMISSION_TEAM_UNKNOWN' as const,",
      '    detail: `the team-existence read refused, and an answer this module cannot get is not an answer it may assume: ${String(error)}`,',
      "    widenedEffectScopes: ['*'],",
      '  }',
      '  return r7answer',
      '}',
      "const r7decoy: { readonly ok: false; readonly refusal: 'ADMISSION_TEAM_UNKNOWN'; readonly detail: string } = { ok: false, refusal: 'ADMISSION_TEAM_UNKNOWN', detail: 'R7 plant decoy keeps the identifier-key count stable (fixture)' }",
      'void r7catch; void r7decoy',
    ].join('\n')
    const v7Label = 'V7-census-computed-key.fixture.ts'
    const v7Shapes = objectLiteralFieldShapes(v7Bytes, v7Label, 'refusal', false)
    const v7Count = countObjectLiteralKeys(v7Bytes, v7Label, 'refusal')
    expect(v7Shapes.length, 'F-I1b7-1: the computed-key verdict and the identifier decoy are TWO refusal-carrying literals; a pass that skips computed keys sees one or none').toBe(2)
    expect(v7Count, 'F-I1b7-1: the second enumeration must fold `[' + "refusal']` to the key `refusal` and count it too — both enumerations fold identically or the pair proves nothing").toBe(2)
    const v7Widened = v7Shapes.find((shape) => shape.keys.includes('widenedEffectScopes'))
    expect(v7Widened, 'F-I1b7-1: the widened site is not in the census at all — the round-7 escape is back').toBeDefined()
    expect(v7Widened?.keys, 'the folded computed key must be graded as `refusal`, not `<computed>`').toEqual(['ok', 'refusal', 'detail', 'widenedEffectScopes'])
    expect(v7Widened?.violations.join('\n'), 'the widened field must convict: a structure in a verdict field is a channel, and the field is outside the closed set').toContain('widenedEffectScopes')
    // The DISCLOSED gap, pinned as a measurement so no future sentence can claim more than the rule does:
    // a computed key that does not fold is nobody's `refusal:` key — in neither enumeration. The census
    // misses such a site; that blindness is the tripwire's published size (header + this leg), not a
    // check that was passed, and it belongs to the #502 runtime contract, not to a name-based rule.
    const v7Unfoldable = "let r7key = 'refusal'\nconst r7answer = { ok: false as const, [r7key]: 'ADMISSION_TEAM_UNKNOWN' as const, detail: 'x' }\nexport default r7answer\n"
    expect(objectLiteralFieldShapes(v7Unfoldable, 'V7b-unfoldable-key.fixture.ts', 'refusal', false).length, 'a non-folding computed key is NOT a refusal key to the census — disclosed blind spot; if a rule ever learns to fold this, update this pin AND the sentence above in the same edit').toBe(0)
    expect(countObjectLiteralKeys(v7Unfoldable, 'V7b-unfoldable-key.fixture.ts', 'refusal'), 'a non-folding computed key is NOT a refusal key to the count either — same disclosed blind spot, same rule: pin and sentence move together').toBe(0)
  })

  it('a parsed plan carries EXACTLY the effect scopes its input declared — parse↔input fidelity (F-I1b5-5)', () => {
    // Round 5 plant P-2b: an `exact-fingerprint` scope injected into the frozen assembly AFTER validation,
    // BEFORE the freeze, sailed through this spec AND the 466-leg family — every leg graded the shape of
    // whatever the parser handed back, and NO leg compared that answer to the input. This leg is that
    // comparison, over a grid of inputs: the plan's effectScopes must equal the input's scopes entry for
    // entry and in order, so a parser (or a post-validation mutator) that injects, drops, reorders or
    // rewrites a scope cannot ship.
    const grid: ReadonlyArray<ReadonlyArray<{ readonly form: string; readonly value: string }>> = [
      [{ form: 'exact-fingerprint', value: P2_FP_COVERED }],
      [{ form: 'by-action-name', value: 'fs:write' }],
      [{ form: 'exact-fingerprint', value: P2_FP_COVERED }, { form: 'by-action-name', value: 'fs:write' }],
      [{ form: 'exact-fingerprint', value: P2_FP_UNCOVERED }, { form: 'exact-fingerprint', value: P2_FP_COVERED }],
    ]
    for (const effectScopes of grid) {
      const parsed = parseReviewPlan({
        rootSessionId: P2_ROOT, blueprintDigest: P2_DIGEST, epoch: 7, reviewerInstanceId: 'inst-officer-1', delegatedRung: 'leader',
        actions: [{ actionName: 'fs:write', decisions: ['allow', 'deny'] }],
        effectScopes,
        expiresAtIso: null,
      })
      expect(parsed.ok, `fixture refused at parse: ${parsed.ok ? '' : parsed.failure.code}`).toBe(true)
      if (!parsed.ok) continue
      expect(parsed.plan.effectScopes.map((scope) => ({ form: scope.form, value: scope.value })), `the parsed plan's effectScopes must be exactly the input's, entry for entry and in order — a plan that carries a scope no input declared is an approval for an effect set nobody approved (F-I1b5-5)`).toEqual(effectScopes)
    }
  })
})

// --- the census, LAST: it reads what the legs above actually produced --------------------------------------

/**
 * The codes a function in a source file refuses with, read out of the text of its body. Round-1 review of #522
 * (F-I1b1-1, 2026-10-31) is why this exists: a list of pass-through codes was pinned to the vocabulary it draws
 * from (a subset pin) and to what tests happened to observe, and NOTHING pinned it to the function that actually
 * emits those codes — so a member the producer cannot emit, or a producer code the list forgot, was invisible.
 *
 * The extraction is textual and its limit is stated, not hidden: it sees `refuse('LITERAL'…)` calls in the body
 * between the declaration and the first top-level closing brace. A code assembled from a variable, or reached
 * through another helper, is not visible to it — which is exactly why the five behavioural legs above are the
 * evidence and this is the cross-check. The anti-vacuity assertions below make "found nothing" impossible to
 * mistake for "found the same nothing the list declares".
 */
function refusalCodesEmittedBy(source: string, functionName: string): string[] {
  const declaration = `export function ${functionName}(`
  const start = source.indexOf(declaration)
  expect(start, `${declaration} is not in this source any more — the pin has stopped measuring the producer`).toBeGreaterThan(-1)
  const rest = source.slice(start)
  const bodyEnd = rest.search(/^\}/m)
  const body = bodyEnd === -1 ? rest : rest.slice(0, bodyEnd)
  expect(body.length, `the body of ${functionName} was not found — the extraction is reading a fragment`).toBeGreaterThan(100)
  expect(body, `${functionName} no longer has the shape this extraction assumes (no accept path found)`).toContain('accept(')
  return [...body.matchAll(/refuse\(\s*'(REVIEW_ASSIGNMENT_[A-Z_]+)'/g)].map((match) => match[1] as string)
}

describe('S-10 / census: the refusal vocabulary is closed, produced, and never collides', () => {
  it('the pass-through list is exactly what admit has been SEEN to pass, and exactly what the pre-flight emits', () => {
    // Round 1 of #522, F-I1b1-1 + F-I1b1-4 (2026-10-31). Three vocabularies meet in this leg, and the two the
    // file used to compare are the two that could not fail:
    //   declared (the module's list) ⊆ kernel (REVIEW_ASSIGNMENT_REFUSALS)   — a subset pin: accepts a code the
    //                                                                          pre-flight can never return, which
    //                                                                          is the defect that was found
    //   observed ∈ declared ∪ kernel ∪ writer                                — a containment: declaring a code
    //                                                                          adds no obligation to produce one
    // What was never compared is what this leg compares, in both directions: the list against what `admit` was
    // actually seen to answer with (`refusalsThroughAdmit`, filled only by the harness call sites), and the list
    // against what `checkAssignmentMutation` is written to emit. A seventh member with no leg is red on the first
    // loop; a member the kernel stops emitting is red on the last line; a code the door passes that the list does
    // not declare is red on the second loop. Every message names the code and the two possible causes, because a
    // census that says "mismatch" leaves the next reader guessing which side lied.
    const kernelVocabulary = REVIEW_ASSIGNMENT_REFUSALS as readonly string[]
    const observedPassThrough = [...refusalsThroughAdmit.keys()]
      .filter((code) => kernelVocabulary.includes(code))
      .sort()
    for (const code of [...ASSIGNMENT_ADMISSION_PASSTHROUGH_CODES].sort()) {
      expect(
        observedPassThrough,
        `${code} is declared pass-through but no leg of this file ever saw admit answer with it: either the pre-flight cannot emit it (then the list must lose the line, because a code you cannot pass is a code you will invent) or the leg that produces it is missing. The subset pin is not evidence for this line — it accepted a sixth member at head 4e9b20a62 without a sound.`,
      ).toContain(code)
    }
    for (const code of observedPassThrough) {
      expect(
        ASSIGNMENT_ADMISSION_PASSTHROUGH_CODES as readonly string[],
        `${code} came out of admit and the list does not declare it — the list is now narrower than the door's own behaviour`,
      ).toContain(code)
    }
    expect(observedPassThrough).toEqual([...ASSIGNMENT_ADMISSION_PASSTHROUGH_CODES].sort())

    // The producer side, read from the kernel's source: the list is the pre-flight's emitted set, not a
    // sub-culture of the vocabulary it is allowed to draw from.
    const produced = refusalCodesEmittedBy(readFileSync(join(RUNTIME_ROOT, 'review-assignment', 'facts.ts'), 'utf8'), 'checkAssignmentMutation')
    expect(new Set(produced).size, 'the extraction counted a code twice — re-read it before trusting the comparison').toBe(produced.length)
    expect(
      produced.sort(),
      'ASSIGNMENT_ADMISSION_PASSTHROUGH_CODES and the codes checkAssignmentMutation refuses with are no longer the same set',
    ).toEqual([...ASSIGNMENT_ADMISSION_PASSTHROUGH_CODES].sort())
    // And the words travelled, not just the codes: every observed pass-through refusal carries a detail, and a
    // code arriving with an empty detail is a code whose explanation was laundered away at the door.
    for (const [code, details] of refusalsThroughAdmit) {
      if (!kernelVocabulary.includes(code)) continue
      for (const detail of details) {
        expect(detail.length, `${code} passed through with no diagnostic detail`).toBeGreaterThan(0)
      }
    }
  })


  it('produces every declared own code, declares nothing it cannot produce, and shares no name with the kernel', () => {
    // The D-10 census: the literal written out here (a set compared to itself passes for any content — PR-I1a
    // round 1 caught exactly that shape), then compared to what this file actually observed, collected at the
    // call sites. The neighbour-code mutation half of S-10 (swap each code, watch a leg redden) is the
    // reviewer-side run named in the memo header; on this tree the legs compare codes with toBe, so every leg
    // named above already reddens under any swap of the code it asserts.
    expect([...ASSIGNMENT_ADMISSION_REFUSAL_CODES].sort()).toEqual([
      'ADMISSION_CALLER_UNRESOLVED',
      'ADMISSION_CLAIM_CONTRADICTION',
      'ADMISSION_DISABLED_FOR_TEAM',
      'ADMISSION_FEATURE_VALUE_UNKNOWN',
      'ADMISSION_KIND_UNSUPPORTED',
      'ADMISSION_LEDGER_UNREADABLE',
      'ADMISSION_REQUEST_MALFORMED',
      'ADMISSION_ROLE_NOT_RESOLVER',
      'ADMISSION_ROOT_UNMINTABLE',
      'ADMISSION_STALE_INTENT',
      'ADMISSION_TEAM_UNKNOWN',
    ])
    expect(new Set(ASSIGNMENT_ADMISSION_REFUSAL_CODES).size).toBe(ASSIGNMENT_ADMISSION_REFUSAL_CODES.length)
    for (const code of ASSIGNMENT_ADMISSION_REFUSAL_CODES) {
      expect(REVIEW_ASSIGNMENT_REFUSALS as readonly string[], `${code} collides with the kernel vocabulary`).not.toContain(code)
    }
    const ownObserved = [...observedRefusals].filter((code) => (ASSIGNMENT_ADMISSION_REFUSAL_CODES as readonly string[]).includes(code))
    expect(ownObserved.sort()).toEqual([...ASSIGNMENT_ADMISSION_REFUSAL_CODES].sort())
    // And every observed code belongs to one of the THREE declared vocabularies: this module's own, the
    // kernel's (pass-through), or the writer's — the third appears because S-4 drives the real writer beside
    // the admission as the second-door evidence, and its refusal is recorded, not laundered into the census
    // as if admission had produced it. A code outside all three means someone invented a code or wrapped
    // somebody else's, which is the same crime wearing a hat.
    for (const code of observedRefusals) {
      expect(
        (ASSIGNMENT_ADMISSION_REFUSAL_CODES as readonly string[]).includes(code) ||
        (REVIEW_ASSIGNMENT_REFUSALS as readonly string[]).includes(code) ||
        (REVIEW_ASSIGNMENT_WRITE_REFUSALS as readonly string[]).includes(code),
        `${code} belongs to no declared vocabulary`,
      ).toBe(true)
    }
  })
})
