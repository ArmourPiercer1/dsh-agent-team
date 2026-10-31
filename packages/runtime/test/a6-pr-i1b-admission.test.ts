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
 *  - the cross-team, mixed-ledger and other-team-member rows are REAL repository writes in a REAL second team.
 *
 * WHAT IS ENV-REFUSED ON THIS MACHINE (recorded as refused, never as passed):
 *  - the real-Host ControlService execution loop: `tests/deepseek-harness-test-use` and `tests/homes/` are absent
 *    and `/srv/workspace/dsh-stable-3-0.2.0-rc.2` is absent (the ENV-REFUSED describe below measures all three).
 *    The equivalence between this lane's closure check and the control resolve path is therefore pinned to
 *    SOURCE TEXT (`service.ts`'s use of the constant and its refusal message shape), and the real-world
 *    byte-identity of a non-enabling team (S-7's first half) has no world to diff — its structural stand-in
 *    (dormancy: no gate object, no importer, `ALLOWED_CONSUMERS` empty) is what binds here;
 *  - the D-10 "swap every refusal code for its neighbour and watch a leg redden" mutation is executed here as
 *    exact-code assertions plus a produced-vs-declared census; the file-mutation loop itself is the reviewer
 *    step named in the memo (加补编 3 第 2 条), not something a leg on this tree can run against its own source.
 *
 * Refusal assertions compare the code with `toBe` against the literal, never with a substring match: a leg that
 * passes for any `ADMISSION_*` code is a leg about a prefix, not about a refusal.
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

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
import { REVIEW_ASSIGNMENT_FACT_TYPES, REVIEW_ASSIGNMENT_REFUSALS } from '../review-assignment/types.js'
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
    if (!outcome.ok) observedRefusals.add(outcome.refusal)
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
    // The source-text stand-in for the ENV-REFUSED Host leg: the equivalence with control is asserted against
    // the resolve path's own source — if `service.ts` stops consulting the constant, or renames its refusal,
    // this lane's claim of "same rule, same words" is stale and this leg says so.
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

// --- ENV-REFUSED (measured absences; nothing below is offered as a pass) ------------------------------------------

describe('ENV-REFUSED: the host-side legs this machine cannot run, recorded as refused', () => {
  it('the pristine host checkout, the test homes, and the shared baseline are all absent — measured', () => {
    // The three environment facts the report must carry: they are WHY the legs below stay refused. If this
    // ever runs on a machine that HAS them, this leg going red is the prompt to run the real-host pair
    // (ControlService resolve execution against this predicate, and the non-enabling-team byte diff of S-7),
    // which are the only legs not standing anywhere else in this file.
    const repoRoot = join(RUNTIME_ROOT, '..', '..')
    expect(existsSync(join(repoRoot, 'tests', 'deepseek-harness-test-use'))).toBe(false)
    expect(existsSync(join(repoRoot, 'tests', 'homes'))).toBe(false)
    expect(existsSync('/srv/workspace/dsh-stable-3-0.2.0-rc.2')).toBe(false)
  })
})

// --- the census, LAST: it reads what the legs above actually produced --------------------------------------

describe('S-10 / census: the refusal vocabulary is closed, produced, and never collides', () => {
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
