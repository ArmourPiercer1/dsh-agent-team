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
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
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
// the drift the hygiene walk hunts.
import { TEST_USE_BASELINE_SHA } from '../../../tests/paths.mjs'
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

interface RealHostCapture {
  readonly kit: string
  readonly runStamp: string
  readonly laneHead: string
  readonly hostHead: string
  readonly hostBaselineSha: string
  readonly hostPorcelainBefore: number
  readonly hostPorcelainAfter: number
  readonly resolvePathOrder: { readonly ok: boolean; readonly closureLine: number | null; readonly envelopeLine: number | null; readonly measured: string }
  readonly rootSessionId: string
  readonly rowConfigFields: readonly string[]
  readonly unknownCaller: { readonly code: string; readonly message: string }
  readonly memberAttempt: { readonly ingress: string; readonly as: string; readonly status: number; readonly error: string }
  readonly answers: Record<string, RealHostCell>
  readonly durableCensus: { readonly entries: number; readonly factTypes: readonly string[] }
  readonly enableCensus: { readonly entries: number; readonly factTypes: readonly string[] }
  readonly checks: readonly { readonly id: string; readonly ok: boolean; readonly measured: string }[]
}

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
 * live HEAD and porcelain must equal what the capture recorded, the stamped evidence directory it names must
 * exist with its `verdict.json` and `MEASURED-LINES.txt`, and its `laneHead` must be a real ancestor commit
 * of this repository. A whole-file fabrication (right shape, no host behind it) reddens here by name.
 */
function readRealHostCapture(): RealHostCapture | null {
  expect(REAL_HOST_REFUSED, 'a real-host capture leg ran with no pristine runtime — the refusal gate is broken').toBe(false)
  expect(
    hostEnvironment.capture,
    'the pristine runtime IS materialized at '
      + `${PRISTINE_HOST} but no real-host capture exists — run \`node tests/kits/pr-i1b-real-host/pr-i1b-real-host.mjs\` `
      + 'and commit the capture it writes. A runtime with no capture is an unrun instrument, not a refused leg.',
  ).toBe(true)
  const capture = JSON.parse(readFileSync(CAPTURE_PATH, 'utf8')) as RealHostCapture
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
  expect(gitOkIn(REPO_ROOT, ['cat-file', '-e', `${capture.laneHead}^{commit}`]),
    `capture.laneHead (${capture.laneHead}) is not a commit in this repository — a capture must name a lane head that existed`).toBe(true)
  expect(gitOkIn(REPO_ROOT, ['merge-base', '--is-ancestor', capture.laneHead, 'HEAD']),
    `capture.laneHead (${capture.laneHead}) is not an ancestor of this checkout — the capture claims a commit outside this branch's history`).toBe(true)
  // The kit measured the gate order in the row's source; a cell recorded as agreed-then-envelope-refused
  // carries the envelope gate's code, whatever else a fabrication might write into it (F-I1b2-1's C12).
  expect(capture.resolvePathOrder?.ok, 'the capture did not measure the gate order — the agreement reading in the legs below would rest on prose').toBe(true)
  for (const [key, cell] of Object.entries(capture.answers)) {
    if (cell.closure === 'agreed-then-envelope-refused') {
      expect(cell.code, `cell ${key} is recorded as envelope-refused but carries ${cell.code}`).toBe('TEAM_RUNTIME_ENVELOPE_OUT_OF_BOUNDS')
    }
  }
  return capture
}

/** Counted by the refusal line the block prints when the runtime is absent — the count is measured, not typed. */
let realHostCaptureLegs = 0
const itRealHost = (title: string, fn: () => void | Promise<void>): void => {
  realHostCaptureLegs += 1
  it.skipIf(REAL_HOST_REFUSED)(title, fn)
}

describe(`REAL-HOST (${REAL_HOST_STATE}): the resolve path answers the closure the way this lane mirrors it`, () => {
  afterAll(() => {
    if (REAL_HOST_REFUSED) {
      console.info(`real-host: ${realHostCaptureLegs} refused — pristine runtime absent; run the TEST_METHODS §2 recipe `
        + `(clone tests/deepseek-harness-test-use --local --no-hardlinks, detach ${TEST_USE_BASELINE_SHA}, install, build) to materialize it. `
        + 'Refused is not passed; this line is the refusal, printed and counted.')
    }
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
