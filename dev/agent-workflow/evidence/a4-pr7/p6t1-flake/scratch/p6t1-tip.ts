/**
 * P6-T1 S-parallel — same-template parallel activations (TaskDoc §11.7 P6-T1
 * MUST-TEST "same template parallel"; G6 gate preview: "same template N
 * simultaneous instances" and "quota race does not over-create"):
 *
 *  - P1 N=2 same-template parallel activations: both succeed, distinct
 *    instance ids / child Sessions, two COMMITTED operations;
 *  - P2 N=5 same-template parallel activations under a raised quota
 *    blueprint: all five succeed with five distinct instance ids /
 *    operation ids / child Sessions and five COMMITTED operations;
 *  - P3 the quota race under the fixture quotas (worker maxInstances = 2):
 *    N=5 parallel activations → EXACTLY two succeed, three fail
 *    QUOTA_MEMBER_MAX_INSTANCES, the final durable state holds EXACTLY two
 *    members (no over-create: the per-team lock serializes the durable
 *    section and every admission reads a fresh in-flight-aware view);
 *  - P4 uniqueness assertions over the P2 snapshot (pairwise distinct
 *    instance ids, operation ids, child Sessions).
 *
 * Mock-first (ruling R28); top-level-await snapshot pattern.
 *
 * WHAT EACH LEG ACTUALLY WAITS ON (A4-PR7 p6t1-flake audit, evidence
 * `dev/agent-workflow/evidence/a4-pr7/p6t1-flake/FINDINGS.md`). Three lanes
 * dismissed a red in this family as "the known load flake" off ONE re-run, so
 * the wait structure is now written down per leg:
 *
 *  - P1/P2/P3 read a snapshot taken once at module load. The only await in the
 *    snapshot is `Promise.all(N × provider.activate(...))`, and every durable
 *    read (`operations.list()`, `memberInstances.list()`, the child-factory
 *    tally) happens strictly AFTER that await settles. So nothing here sleeps,
 *    nothing polls, and no durable state is read early.
 *  - No expectation depends on `Promise.all` ARRIVAL ORDER: every one of them
 *    is a count, a set cardinality or a pairwise-distinctness check, all of
 *    which are order-free. The `replayed === false` check is not an ordering —
 *    five distinct requestTokens are five distinct logical operations, so no
 *    leg may converge an already-durable one.
 *  - P4 waits on nothing: it re-reads the P2 snapshot, so a P2 fault reports a
 *    second time under P4 names. One product fault therefore reads as up to
 *    EIGHT red legs — which is how one ~25% event got misread as "5 of 9 roots
 *    are red, must be the machine".
 *  - What WAS load-sensitive was inside the product, not in these legs: step 6
 *    consulted the compatibility authority OUTSIDE the provider's per-team
 *    chain, and that consultation durably re-probes a cold generation. The
 *    lost write was visible only when the two probes' `computedAt` stamps fell
 *    in different wall-clock milliseconds, because the repository treats
 *    byte-IDENTICAL rows as an idempotent no-op and byte-DIFFERENT rows as
 *    `RECORD_DUPLICATE`. Green was a clock coincidence, not a property.
 *
 * P5 is the pin for that race: the same quota law, fired against the same cold
 * team, with the millisecond coincidence REMOVED by a monotonic clock port. At
 * the base commit P5 is red on every run (measured 6/6 batches, the law
 * undisturbed in none of them); it does not depend on load, and it is
 * unfixable by re-running.
 *
 * @module @dsh-agent-team/runtime/test/p6t1-parallel
 */

import { describe, expect, it } from 'vitest'
import { ACTIVATION_ERROR_CODES, createActivationProvider } from '../activation/index.js'
import type {
  ActivationProvider,
  ActivationResult,
  MemberActivationRequest,
} from '../activation/index.js'
import { OPERATION_PHASES } from '../../storage/schema/index.js'
import {
  P6T1_FIXTURE,
  assertActivationCode,
  createP6T1World,
  destroyP6T1World,
  makeRequest,
} from './p6t1-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'

const ROOT = String(P6T1_FIXTURE.rootSessionId)

// A4-PR7 §7.4 (lane B-runtime-semantics-A): this fixture document rides the
// supported version, and the two envelope documents that version REQUIRES are
// declared — in their zero form `rules: []`, which is a POSITION: on the
// expansion plane a no-match answers `no-authority` (the document claims no
// expansion authority for its Leader), on the approval plane a no-match is
// identity (it removes no rung). The zeros are honest here rather than
// convenient: this world is built root-direct, and the only production producer
// of `permissionAuthorityCeiling` is the plugin host, so no ceiling reader ever
// consults these documents. (The same disposition covers every document below.)
/** The fixture blueprint with the quotas raised so N=5 may all admit. */
const P6T1_BLUEPRINT_SOURCE_RAISED_QUOTAS = [
  '---',
  'schemaVersion: 3',
  'blueprintId: P6T1-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the P6T1 team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the P6T1 work.',
  '  - templateId: scout',
  '    displayName: Scout',
  '    persona: You scout for the P6T1 team.',
  '    contextPolicy: fresh_per_delegation',
  'requirements:',
  '  - domain: tool',
  '    name: web',
  '    optional: true',
  '  - domain: skill',
  '    name: base',
  'teamEnvelope:',
  '  allow:',
  '    - create-member',
  '    - assign-task',
  '  deny:',
  '    - delete-team',
  'memberEnvelopes:',
  '  - templateId: worker',
  '    envelope:',
  '      allow:',
  '        - web.search',
  '      deny: []',
  '  - templateId: scout',
  '    envelope:',
  '      allow: []',
  '      deny: []',
  'policyStates:',
  '  - id: default',
  '    description: The P6T1 default state.',
  'quotas:',
  '  team:',
  '    maxInstances: 6',
  '    maxConcurrent: 5',
  '  members:',
  '    maxInstances: 5',
  'metadata: {}',
  'permissionMutationEnvelope:',
  '  rules: []',
  'teamHardEnvelope:',
  '  rules: []',
  '---',
  '',
].join('\n')

async function runActivate(
  world: P6T1World,
  request: MemberActivationRequest,
  provider: ActivationProvider = world.provider,
): Promise<{ result: ActivationResult | undefined; error: unknown }> {
  try {
    return { result: await provider.activate(request), error: undefined }
  } catch (error) {
    return { result: undefined, error }
  }
}

/**
 * The identity of one rejection as `<ErrorName>/<typed code>`.
 *
 * WHY THIS IS IN THE SNAPSHOT: until A4-PR7 this family recorded only HOW MANY
 * activations were refused. A refusal for a reason outside the admission
 * vocabulary was therefore indistinguishable from a quota refusal in every
 * failure message the census prints — the red read `expected 4 to be 3` and
 * three lanes could only guess. Naming each rejection makes a foreign fault
 * identify itself on the first sample.
 */
function rejectionIdentity(error: unknown): string {
  const record = (error ?? {}) as { name?: unknown; code?: unknown }
  return `${String(record.name ?? 'unthrown')}/${String(record.code ?? 'no-code')}`
}

interface ParallelOutcome {
  readonly results: Extract<ActivationResult, { kind: 'activated' }>[]
  readonly errors: unknown[]
  /** One `name/code` identity per rejection, in settle order. */
  readonly rejections: string[]
  readonly committedOps: number
  readonly memberCount: number
  readonly distinctChildren: number
}

async function runParallel(
  world: P6T1World,
  tokens: string[],
  provider: ActivationProvider = world.provider,
): Promise<ParallelOutcome> {
  const runs = await Promise.all(
    tokens.map((token) => runActivate(world, makeRequest({ requestToken: token }), provider)),
  )
  const results: Extract<ActivationResult, { kind: 'activated' }>[] = []
  const errors: unknown[] = []
  for (const run of runs) {
    if (run.error !== undefined) {
      errors.push(run.error)
    } else if (run.result?.kind === 'activated') {
      results.push(run.result)
    }
  }
  // All three durable reads below happen after every activation has settled.
  const committedOps = world.domain
    .repositories.operations.list()
    .filter((op) => op.phase === OPERATION_PHASES.COMMITTED).length
  return {
    results,
    errors,
    rejections: errors.map(rejectionIdentity),
    committedOps,
    memberCount: world.domain.repositories.memberInstances.list(ROOT).length,
    distinctChildren: world.childFactory.distinctChildren,
  }
}

/**
 * The ONE refusal this family's laws admit, as a rejection identity. A refusal
 * carrying anything else (`ACTIVATION_COMPATIBILITY_BLOCKED_FATAL`, a domain
 * code, `unthrown/no-code`) is not a quota refusal: it is a fault that has
 * escaped the admission vocabulary, and the legs below name it as such.
 */
const QUOTA_REFUSAL = `ActivationError/${ACTIVATION_ERROR_CODES.QUOTA_MEMBER_MAX_INSTANCES}`

// ---------------------------------------------------------------------------
// P1 — N=2 same-template parallel
// ---------------------------------------------------------------------------
let p1: ParallelOutcome | undefined
{
  const world = await createP6T1World('p6t1x-p1')
  try {
    p1 = await runParallel(world, ['tok-p6t1-par-a', 'tok-p6t1-par-b'])
  } finally {
    await destroyP6T1World(world)
  }
}

describe('P6-T1 P1: N=2 same-template parallel activations both succeed', () => {
  it('two activated results with distinct instance ids and child Sessions', () => {
    expect(p1?.errors.length).toBe(0)
    expect(p1?.rejections).toEqual([])
    expect(p1?.results.length).toBe(2)
    if (p1 === undefined) throw new Error('P1: missing snapshot')
    const a = p1.results[0]
    const b = p1.results[1]
    if (a === undefined || b === undefined) throw new Error('P1: expected two results')
    expect(a.instanceId).not.toBe(b.instanceId)
    expect(a.childSessionId).not.toBe(b.childSessionId)
    expect(a.templateId).toBe('worker')
    expect(b.templateId).toBe('worker')
  })

  it('two COMMITTED operations, two members, two distinct child Sessions', () => {
    expect(p1?.committedOps).toBe(2)
    expect(p1?.memberCount).toBe(2)
    expect(p1?.distinctChildren).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// P2 — N=5 same-template parallel under raised quotas (all succeed)
// ---------------------------------------------------------------------------
let p2: ParallelOutcome | undefined
{
  const world = await createP6T1World('p6t1x-p2', {
    blueprintSource: P6T1_BLUEPRINT_SOURCE_RAISED_QUOTAS,
  })
  try {
    p2 = await runParallel(
      world,
      ['tok-p6t1-p2-1', 'tok-p6t1-p2-2', 'tok-p6t1-p2-3', 'tok-p6t1-p2-4', 'tok-p6t1-p2-5'],
    )
  } finally {
    await destroyP6T1World(world)
  }
}

describe('P6-T1 P2: N=5 same-template parallel activations all succeed (raised quotas)', () => {
  it('five activated results, five COMMITTED operations, five members, five child Sessions', () => {
    expect(p2?.errors.length).toBe(0)
    expect(p2?.rejections).toEqual([])
    expect(p2?.results.length).toBe(5)
    if (p2 === undefined) throw new Error('P2: missing snapshot')
    expect(p2.committedOps).toBe(5)
    expect(p2.memberCount).toBe(5)
    expect(p2.distinctChildren).toBe(5)
    for (const result of p2.results) {
      expect(result.replayed).toBe(false)
      expect(result.templateId).toBe('worker')
    }
  })
})

// ---------------------------------------------------------------------------
// P3 — the quota race (fixture quotas: worker maxInstances = 2)
// ---------------------------------------------------------------------------
let p3: ParallelOutcome | undefined
{
  const world = await createP6T1World('p6t1x-p3')
  try {
    p3 = await runParallel(
      world,
      ['tok-p6t1-p3-1', 'tok-p6t1-p3-2', 'tok-p6t1-p3-3', 'tok-p6t1-p3-4', 'tok-p6t1-p3-5'],
    )
  } finally {
    await destroyP6T1World(world)
  }
}

describe('P6-T1 P3: the quota race — five parallel, two may admit (no over-create)', () => {
  it('exactly two activations succeed', () => {
    expect(p3?.results.length).toBe(2)
  })

  it('exactly three fail QUOTA_MEMBER_MAX_INSTANCES (the binding fixture quota)', () => {
    expect(p3?.errors.length).toBe(3)
    if (p3 === undefined) throw new Error('P3: missing snapshot')
    for (const error of p3.errors) {
      assertActivationCode(error, ACTIVATION_ERROR_CODES.QUOTA_MEMBER_MAX_INSTANCES)
    }
  })

  it('the three refusals are QUOTA_MEMBER_MAX_INSTANCES identities and nothing else', () => {
    // The count above says a leg went missing; this says WHO refused it. Added
    // by the A4-PR7 p6t1-flake audit, where a parallel batch was being refused
    // by the compatibility chain and every message on offer was a bare number.
    expect(p3?.rejections).toEqual([QUOTA_REFUSAL, QUOTA_REFUSAL, QUOTA_REFUSAL])
  })

  it('the final durable state holds EXACTLY two members and two COMMITTED operations', () => {
    expect(p3?.memberCount).toBe(2)
    expect(p3?.committedOps).toBe(2)
    expect(p3?.distinctChildren).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// P4 — uniqueness over the P2 snapshot
// ---------------------------------------------------------------------------
describe('P6-T1 P4: every parallel instance is uniquely addressed (invariants 17/18)', () => {
  it('the five P2 instance ids are pairwise distinct', () => {
    if (p2 === undefined) throw new Error('P4: missing P2 snapshot')
    const ids = p2.results.map((r) => r.instanceId)
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        expect(ids[i]).not.toBe(ids[j])
      }
    }
  })

  it('the five P2 operation ids are pairwise distinct', () => {
    if (p2 === undefined) throw new Error('P4: missing P2 snapshot')
    const ops = p2.results.map((r) => r.operationId)
    for (let i = 0; i < ops.length; i += 1) {
      for (let j = i + 1; j < ops.length; j += 1) {
        expect(ops[i]).not.toBe(ops[j])
      }
    }
  })

  it('the five P2 child Sessions are pairwise distinct', () => {
    if (p2 === undefined) throw new Error('P4: missing P2 snapshot')
    const children = p2.results.map((r) => r.childSessionId)
    for (let i = 0; i < children.length; i += 1) {
      for (let j = i + 1; j < children.length; j += 1) {
        expect(children[i]).not.toBe(children[j])
      }
    }
  })
})

// ---------------------------------------------------------------------------
// P5 — the same laws with the millisecond coincidence removed
// ---------------------------------------------------------------------------
//
// WHY THIS BLOCK EXISTS. The A4-PR7 measurement of this file at `ac54ffb8` was
// 4 reds in 20 solo runs, and each red was one admission refusing itself with
// `ACTIVATION_COMPATIBILITY_BLOCKED_FATAL` after two activations of the same
// cold team interleaved the compatibility generation's read-modify-write (see
// the module header). The race was intermittent for ONE reason: the losing
// `put` is a no-op when the two records serialize byte-identically, and the
// only field that varies between them is `computedAt`, stamped at millisecond
// resolution by the wall clock. Same millisecond ⇒ green. Next millisecond ⇒
// `RECORD_DUPLICATE` ⇒ a fail-closed refusal of work that the quota law permits.
//
// P5 fires the SAME law at the SAME cold team through a provider wired with a
// monotonic `now`, so every re-probe in the burst is stamped distinctly and the
// coincidence cannot rescue the race. On the pre-fix provider this is red on
// EVERY run (measured: 6/6 two-activation batches threw the compatibility
// fault; the authority-level inventory is 12/12 with distinct stamps), which is
// what makes it a pin rather than another sample. It asserts the quota law and
// nothing about scheduling.
const P5_BURSTS = 3
const P5_TOKENS = ['tok-p6t1-p5-1', 'tok-p6t1-p5-2', 'tok-p6t1-p5-3', 'tok-p6t1-p5-4', 'tok-p6t1-p5-5']

interface P5Burst {
  readonly label: string
  readonly outcome: ParallelOutcome
}

const p5: P5Burst[] = []
for (let burst = 0; burst < P5_BURSTS; burst += 1) {
  const world = await createP6T1World(`p6t1x-p5-${String(burst)}`)
  try {
    let tick = 0
    // The world's own ports, the world's own durable domain, and one added
    // port: a clock that cannot hand two probes the same millisecond.
    const stampedProvider = createActivationProvider({
      teamDomain: world.domain,
      blueprintCatalog: world.catalog,
      environmentFacts: world.ports.environmentFacts,
      externalPolicyFacts: world.ports.externalPolicyFacts,
      staticModel: world.ports.staticModel,
      childSessionFactory: world.childFactory,
      sessionDurability: world.durability,
      surface: world.surface,
      ...(world.ports.slots !== undefined ? { slots: world.ports.slots } : {}),
      ...(world.ports.admissionGuard !== undefined ? { admissionGuard: world.ports.admissionGuard } : {}),
      now: () => new Date(Date.UTC(2026, 7, 30, 8, 0, 0, (tick += 1))).toISOString(),
    })
    p5.push({
      label: `burst-${String(burst)}`,
      outcome: await runParallel(world, P5_TOKENS, stampedProvider),
    })
  } finally {
    await destroyP6T1World(world)
  }
}

describe('P6-T1 P5: the same law under distinct re-probe stamps (A4-PR7 p6t1-flake pin)', () => {
  it('every burst admits EXACTLY two of five, with no refusal outside the quota vocabulary', () => {
    const observed = p5.map((b) => ({ [b.label]: b.outcome.rejections }))
    expect(observed).toEqual(
      p5.map((b) => ({
        [b.label]: [QUOTA_REFUSAL, QUOTA_REFUSAL, QUOTA_REFUSAL],
      })),
    )
    for (const burst of p5) {
      expect(burst.outcome.results.length).toBe(2)
    }
  })

  it('every burst ends with exactly two members, two COMMITTED operations, two child Sessions', () => {
    const durable = p5.map((b) => ({
      [b.label]: {
        members: b.outcome.memberCount,
        committedOperations: b.outcome.committedOps,
        childSessions: b.outcome.distinctChildren,
      },
    }))
    expect(durable).toEqual(
      p5.map((b) => ({
        [b.label]: { members: 2, committedOperations: 2, childSessions: 2 },
      })),
    )
  })
})
