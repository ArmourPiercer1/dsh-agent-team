/**
 * pre-alpha3 PR-A — the GOVERNANCE MUTATION AUTHORITY unit tests: slot
 * closure by authority, the write-time envelope (agent origins), the
 * write-time external hard facts (EVERY origin — the ADR-04 absolute
 * ceiling), and the fail-closed boundaries (member cross-instance,
 * leader instance scope).
 *
 * Plan coverage: item 6 (External Hard blocks Human/Leader/Member),
 * item 7 (invalid envelope fails BEFORE the durable write), item 10
 * (member cross-instance mutation fails closed).
 *
 * The service is pure over its ports: the test world uses in-memory
 * fakes (the overrides port with the storage-faithful idempotency /
 * RECORD_DUPLICATE semantics, a policy reader whose declared envelope +
 * external facts are the test variables) and the production
 * TeamOperationCoordinator chain.
 *
 * The runner executes these files under plain Node: all async work runs
 * in the top-level block, the `it` bodies assert synchronously.
 *
 * @module @dsh-agent-team/runtime/test/governance-mutation-authority
 */

import { describe, expect, it } from 'vitest'
import { createTeamOperationCoordinator } from '../coordination/index.js'
import {
  createGovernanceMutationService,
  isMutationError,
  MUTATION_ERROR_CODES,
  selectSlotWinner,
  slotIdentityOf,
  type GovernanceChainPort,
  type GovernanceMutationService,
  type GovernanceTransitionCache,
  type GovernanceTransitionCommit,
} from '../governance/index.js'
import type {
  OverrideRecordView,
  OverrideStorePort,
  PolicyReader,
  PolicyStateTransitionRecord,
} from '../mutation/index.js'
import { createMemberIdentity } from '../../domain/policy/src/index.js'
import type { ExternalPolicyFacts, MemberIdentity, PolicyEntry } from '../../domain/policy/src/index.js'
import type { MutationError } from '../mutation/index.js'

const ROOT = 'session-gov-authority'
const NOW = '2026-09-29T00:00:00.000Z'

// ---------------------------------------------------------------------------
// The in-memory world (storage-faithful overrides port; faked policy facts)
// ---------------------------------------------------------------------------

/** Canonical (sorted-key) JSON — the storage key/bytes discipline. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((item) => canonical(item)).join(',')}]`
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`
}

class DuplicateStoreError extends Error {
  readonly code = 'RECORD_DUPLICATE'
  constructor() {
    super('a different record already occupies the key')
    this.name = 'DuplicateStoreError'
  }
}

/** The overrides port with the storage idempotency/duplicate rules. */
class MemOverrides implements OverrideStorePort {
  readonly all: OverrideRecordView[] = []
  private readonly bytesByKey = new Map<string, string>()

  private identityKey(record: OverrideRecordView): string {
    const identity: Record<string, unknown> = {
      kind: record.kind,
      recordId: record.recordId,
      rootSessionId: record.rootSessionId,
      scope: record.scope,
    }
    if (record.instanceId !== undefined) identity['instanceId'] = record.instanceId
    return canonical(identity)
  }

  async list(rootSessionId: string): Promise<readonly OverrideRecordView[]> {
    return this.all.filter((record) => record.rootSessionId === rootSessionId)
  }

  async put(record: unknown): Promise<unknown> {
    const row = record as OverrideRecordView
    const key = this.identityKey(row)
    const bytes = canonical(record)
    const existing = this.bytesByKey.get(key)
    if (existing !== undefined) {
      if (existing === bytes) return this.all.find((candidate) => this.identityKey(candidate) === key)
      throw new DuplicateStoreError()
    }
    this.bytesByKey.set(key, bytes)
    this.all.push(row)
    return row
  }
}

/** The transitions read cache (empty lane in this suite). */
class MemTransitions implements GovernanceTransitionCache {
  private readonly rows: PolicyStateTransitionRecord[] = []
  appendTransition(_teamSessionId: string, transition: PolicyStateTransitionRecord): void {
    this.rows.push(transition)
  }
  listTransitions(_teamSessionId: string): readonly PolicyStateTransitionRecord[] {
    return this.rows
  }
}

/** The durable commit port (records; never faults in this suite). */
class MemCommit implements GovernanceTransitionCommit {
  readonly committed: PolicyStateTransitionRecord[] = []
  /** The addressed root each commit was stamped with (the port threads it). */
  readonly committedRoots: string[] = []
  async commit(
    rootSessionId: string,
    transition: PolicyStateTransitionRecord,
  ): Promise<void> {
    this.committedRoots.push(rootSessionId)
    this.committed.push(transition)
  }
}

interface World {
  readonly service: GovernanceMutationService
  readonly overrides: MemOverrides
  readonly policy: {
    blueprint: { values?: Record<string, PolicyEntry>; autonomyEnvelope?: Record<string, PolicyEntry> }
    templates: Record<string, { values?: Record<string, PolicyEntry>; mutationEnvelope?: Record<string, PolicyEntry> }>
    external: ExternalPolicyFacts
  }
  readonly members: () => MemberIdentity[]
}

function makeWorld(options: {
  blueprint?: World['policy']['blueprint']
  templates?: World['policy']['templates']
  external?: ExternalPolicyFacts
  members?: MemberIdentity[]
  states?: string[]
}): World {
  const overrides = new MemOverrides()
  const transitions = new MemTransitions()
  const commit = new MemCommit()
  const policy: World['policy'] = {
    blueprint: options.blueprint ?? {},
    templates: options.templates ?? {},
    external: options.external ?? { hard: {}, capabilityExists: {} },
  }
  const policyReader: PolicyReader = {
    readBlueprintEnvelope: () => policy.blueprint,
    readTemplatePolicy: (_teamSessionId, member) => policy.templates[member.instanceId] ?? {},
    readExternalFacts: () => policy.external,
  }
  const members = (): MemberIdentity[] => options.members ?? []
  const chain: GovernanceChainPort = createTeamOperationCoordinator()
  const service = createGovernanceMutationService({
    chain,
    overrides,
    transitions,
    transitionCommit: commit,
    policy: policyReader,
    registeredMembers: (root) => Promise.resolve(members().filter((member) => member.rootSessionId === root)),
    policyStates: (root) => [DEFAULT_STATE, ...(options.states ?? [])],
    now: () => NOW,
  })
  return { service, overrides, policy, members }
}

const DEFAULT_STATE = 'default'
const alpha = createMemberIdentity(ROOT, 'inst-alpha')
const beta = createMemberIdentity(ROOT, 'inst-beta')

/** One admitted cell set (the in-envelope allow). */
const modelAllow = (items: string[]): Record<string, PolicyEntry> => ({
  model: { kind: 'allow', items },
})
const mcpDeny: Record<string, PolicyEntry> = { mcp: { kind: 'deny' } }

/** The declared envelope world: model allows m-a/m-b; the member shares it. */
function envelopeWorld(extra?: Parameters<typeof makeWorld>[0]): World {
  const memberEnvelope = { model: { kind: 'allow', items: ['m-a', 'm-b'] } } as Record<string, PolicyEntry>
  return makeWorld({
    blueprint: { autonomyEnvelope: { model: { kind: 'allow', items: ['m-a', 'm-b'] } } },
    // EVERY registered member must carry the template envelope: a member
    // whose template declares none collapses the leader intersection to
    // empty (the frozen "absent = empty boundary" rule — pinned by the
    // e5 case below with a beta-only gap).
    templates: { 'inst-alpha': { mutationEnvelope: memberEnvelope }, 'inst-beta': { mutationEnvelope: memberEnvelope } },
    members: [alpha, beta],
    ...extra,
  })
}

async function capture<T>(world: World, attempt: () => Promise<T>): Promise<T | MutationError> {
  try {
    return await attempt()
  } catch (error) {
    return error as MutationError
  }
}

function codeOf(value: unknown): string | undefined {
  return isMutationError(value) ? value.code : undefined
}

// ---------------------------------------------------------------------------
// Slot closure by authority
// ---------------------------------------------------------------------------

const w1 = envelopeWorld()
const a1 = await capture(w1, () => w1.service.setOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'team',
  cells: modelAllow(['m-a']),
}))
const a2 = await capture(w1, () => w1.service.setOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'instance',
  instanceId: 'inst-alpha',
  cells: mcpDeny,
}))
const a3 = await capture(w1, () => w1.service.setOverride({
  authority: { kind: 'leader' },
  rootSessionId: ROOT,
  scope: 'team',
  cells: modelAllow(['m-b']),
}))
const a4 = await capture(w1, () => w1.service.setOverride({
  authority: { kind: 'leader' },
  rootSessionId: ROOT,
  scope: 'instance',
  instanceId: 'inst-alpha',
  cells: modelAllow(['m-a']),
}))
const a5 = await capture(w1, () => w1.service.setOverride({
  authority: { kind: 'member', instanceId: 'inst-alpha' },
  rootSessionId: ROOT,
  scope: 'instance',
  instanceId: 'inst-alpha',
  cells: modelAllow(['m-a']),
}))
const a6 = await capture(w1, () => w1.service.setOverride({
  authority: { kind: 'member', instanceId: 'inst-alpha' },
  rootSessionId: ROOT,
  scope: 'team',
  cells: modelAllow(['m-a']),
}))
const a7 = await capture(w1, () => w1.service.setOverride({
  authority: { kind: 'member', instanceId: 'inst-alpha' },
  rootSessionId: ROOT,
  scope: 'instance',
  instanceId: 'inst-beta',
  cells: modelAllow(['m-a']),
}))

// ---------------------------------------------------------------------------
// Write-time envelope (agent origins only; deny always passes; human unbounded)
// ---------------------------------------------------------------------------

const w2 = envelopeWorld()
const e1 = await capture(w2, () => w2.service.setOverride({
  authority: { kind: 'leader' },
  rootSessionId: ROOT,
  scope: 'team',
  cells: modelAllow(['m-c']),
}))
const e1StoreCount = w2.overrides.all.length
const e2 = await capture(w2, () => w2.service.setOverride({
  authority: { kind: 'member', instanceId: 'inst-alpha' },
  rootSessionId: ROOT,
  scope: 'instance',
  instanceId: 'inst-alpha',
  cells: modelAllow(['m-z']),
}))
const e2StoreCount = w2.overrides.all.length
const e3 = await capture(w2, () => w2.service.setOverride({
  authority: { kind: 'leader' },
  rootSessionId: ROOT,
  scope: 'team',
  cells: mcpDeny,
}))
const e4 = await capture(w2, () => w2.service.setOverride({
  authority: { kind: 'member', instanceId: 'inst-alpha' },
  rootSessionId: ROOT,
  scope: 'instance',
  instanceId: 'inst-alpha',
  cells: mcpDeny,
}))
// beta has NO template envelope entry: the intersection with beta's (absent)
// envelope is empty — the leader grant of model m-b is out-of-envelope for beta.
const w2b = envelopeWorld({
  templates: { 'inst-alpha': { mutationEnvelope: { model: { kind: 'allow', items: ['m-a', 'm-b'] } } } },
  members: [alpha, beta],
})
const e5 = await capture(w2b, () => w2b.service.setOverride({
  authority: { kind: 'leader' },
  rootSessionId: ROOT,
  scope: 'team',
  cells: modelAllow(['m-b']),
}))
// The no-registered-members ruling: the leader envelope check is SKIPPED.
const w2c = envelopeWorld({ members: [] })
const e6 = await capture(w2c, () => w2c.service.setOverride({
  authority: { kind: 'leader' },
  rootSessionId: ROOT,
  scope: 'team',
  cells: modelAllow(['m-c']),
}))
// Human overrides are NOT envelope-bounded (invariant 34).
const e7 = await capture(w2, () => w2.service.setOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'team',
  cells: modelAllow(['m-z']),
}))

// ---------------------------------------------------------------------------
// Write-time external hard facts (EVERY origin — the absolute ceiling)
// ---------------------------------------------------------------------------

const hardDeny = (capability: string): ExternalPolicyFacts => ({
  hard: { [capability]: { kind: 'deny' } },
  capabilityExists: { [capability]: true },
})
const absentCapability = { hard: {} as ExternalPolicyFacts['hard'], capabilityExists: { model: false } }
const hardAllowList: ExternalPolicyFacts = {
  hard: { model: { kind: 'allow', items: ['m-a'] } },
  capabilityExists: { model: true },
}

const h1 = makeWorld({ external: hardDeny('model') })
const x1 = await capture(h1, () => h1.service.setOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'team',
  cells: modelAllow(['m-a']),
}))
const x2 = await capture(h1, () => h1.service.setOverride({
  authority: { kind: 'leader' },
  rootSessionId: ROOT,
  scope: 'team',
  cells: modelAllow(['m-a']),
}))
const x3 = await capture(h1, () => h1.service.setOverride({
  authority: { kind: 'member', instanceId: 'inst-alpha' },
  rootSessionId: ROOT,
  scope: 'instance',
  instanceId: 'inst-alpha',
  cells: modelAllow(['m-a']),
}))
const h2 = makeWorld({ external: absentCapability })
const x4 = await capture(h2, () => h2.service.setOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'team',
  cells: modelAllow(['m-a']),
}))
const h3 = makeWorld({ external: hardAllowList })
const x5 = await capture(h3, () => h3.service.setOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'team',
  cells: modelAllow(['m-b']),
}))
const x6 = await capture(h3, () => h3.service.setOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'team',
  cells: modelAllow(['m-a']),
}))

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

describe('PR-A governance mutation authority — slot closure by authority', () => {
  it('operator: team-scope human override admitted (no origin)', () => {
    expect(isMutationError(a1)).toBe(false)
    if (!isMutationError(a1) && a1.changed) {
      expect(a1.record.kind).toBe('human-override')
      expect(a1.record.origin).toBe(undefined)
      expect(a1.record.generation).toBe(1)
      expect(a1.record.recordId).toBe('ovr-model-team-g0')
    } else {
      throw new Error('the operator team-scope set was not admitted')
    }
  })

  it('operator: instance-scope human override admitted', () => {
    expect(isMutationError(a2)).toBe(false)
    if (!isMutationError(a2) && a2.changed) {
      expect(a2.record.kind).toBe('human-override')
      expect(a2.record.instanceId).toBe('inst-alpha')
      expect(a2.record.recordId).toBe('ovr-mcp-inst-alpha-g0')
    } else {
      throw new Error('the operator instance-scope set was not admitted')
    }
  })

  it('leader: team-scope autonomy overlay (origin leader) admitted in-envelope', () => {
    expect(isMutationError(a3)).toBe(false)
    if (!isMutationError(a3) && a3.changed) {
      expect(a3.record.kind).toBe('autonomy-overlay')
      expect(a3.record.origin).toBe('leader')
      // The slot already holds the operator human-override slot? NO — the
      // human slot (human-override) is a DIFFERENT slot from the leader
      // autonomy slot (autonomy-overlay): the overlay is generation 1 of
      // its own slot.
      expect(a3.record.generation).toBe(1)
      expect(a3.record.recordId).toBe('ovr-model-team-g0')
    } else {
      throw new Error('the leader team-scope set was not admitted')
    }
  })

  it('leader: instance-scope overlay is typed-rejected (the P7-T2 frozen rule)', () => {
    expect(codeOf(a4)).toBe(MUTATION_ERROR_CODES.UNAUTHORIZED_MUTATION)
  })

  it('member: own-instance overlay (origin member) admitted in-envelope', () => {
    expect(isMutationError(a5)).toBe(false)
    if (!isMutationError(a5) && a5.changed) {
      expect(a5.record.kind).toBe('autonomy-overlay')
      expect(a5.record.origin).toBe('member')
      expect(a5.record.instanceId).toBe('inst-alpha')
    } else {
      throw new Error('the member own-instance set was not admitted')
    }
  })

  it('member: team scope is typed-rejected (the reset-hole authority closure)', () => {
    expect(codeOf(a6)).toBe(MUTATION_ERROR_CODES.UNAUTHORIZED_MUTATION)
  })

  it('member: another instance is typed-rejected (fail closed)', () => {
    expect(codeOf(a7)).toBe(MUTATION_ERROR_CODES.UNAUTHORIZED_MUTATION)
  })
})

describe('PR-A governance mutation authority — the write-time envelope', () => {
  it('leader grant beyond the declared envelope is rejected BEFORE any durable write', () => {
    expect(codeOf(e1)).toBe(MUTATION_ERROR_CODES.LEADER_OUT_OF_ENVELOPE)
    expect(e1StoreCount).toBe(0)
  })

  it('member self-escalation beyond its own envelope is rejected BEFORE any durable write', () => {
    expect(codeOf(e2)).toBe(MUTATION_ERROR_CODES.MEMBER_SELF_ESCALATION)
    expect(e2StoreCount).toBe(0)
  })

  it('leader deny always passes (tightening never escalates)', () => {
    expect(isMutationError(e3)).toBe(false)
    if (!isMutationError(e3) && e3.changed) expect(e3.record.values).toEqual(mcpDeny)
  })

  it('member deny always passes', () => {
    expect(isMutationError(e4)).toBe(false)
  })

  it('leader grant is bounded by EVERY registered member envelope (the intersection)', () => {
    // beta has no mutationEnvelope entry -> the intersection with beta is
    // empty -> the model allow is out-of-envelope even though alpha would
    // admit it.
    expect(codeOf(e5)).toBe(MUTATION_ERROR_CODES.LEADER_OUT_OF_ENVELOPE)
  })

  it('no registered member: the leader envelope check is skipped', () => {
    expect(isMutationError(e6)).toBe(false)
    if (!isMutationError(e6) && e6.changed) expect(e6.record.values).toEqual(modelAllow(['m-c']))
  })

  it('human overrides are NOT envelope-bounded (invariant 34)', () => {
    expect(isMutationError(e7)).toBe(false)
    if (!isMutationError(e7) && e7.changed) expect(e7.record.values).toEqual(modelAllow(['m-z']))
  })
})

describe('PR-A governance mutation authority — the write-time external hard facts', () => {
  it('a hard-denied capability blocks the HUMAN origin (the absolute ceiling)', () => {
    expect(codeOf(x1)).toBe(MUTATION_ERROR_CODES.EXTERNAL_HARD_REJECTED)
  })

  it('a hard-denied capability blocks the LEADER origin', () => {
    expect(codeOf(x2)).toBe(MUTATION_ERROR_CODES.EXTERNAL_HARD_REJECTED)
  })

  it('a hard-denied capability blocks the MEMBER origin', () => {
    expect(codeOf(x3)).toBe(MUTATION_ERROR_CODES.EXTERNAL_HARD_REJECTED)
  })

  it('an absent capability blocks a grant (human origin)', () => {
    expect(codeOf(x4)).toBe(MUTATION_ERROR_CODES.EXTERNAL_HARD_REJECTED)
  })

  it('items beyond the hard allow-list are blocked', () => {
    expect(codeOf(x5)).toBe(MUTATION_ERROR_CODES.EXTERNAL_HARD_REJECTED)
  })

  it('items within the hard allow-list are admitted', () => {
    expect(isMutationError(x6)).toBe(false)
  })
})
