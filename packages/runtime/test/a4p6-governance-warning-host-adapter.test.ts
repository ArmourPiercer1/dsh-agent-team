/**
 * a4p6-governance-warning-host-adapter.test.ts — A4-PR6 review round 1
 * (fixes 2 + 3/6): tests over the HOST ADAPTER ITSELF, not the fake-port
 * suites that could not see the blockers.
 *
 * BLOCKER 2 (leader-read abstention → open): the pre-fix `docs.read`
 * consumed `permissionFacts.permissionEnvelope`, whose abstention value
 * is the zero-authority document `{ rules: [] }` with the `ok` flag
 * dropped. On an UNKNOWN binding, a canonicalization fault, or binding
 * drift across the canonicalization await, `compareEnvelopes` saw a
 * leader with no claims, answered `consistent`, and the gate OPENED —
 * an unreadable authority document passing the start gate. The fix: the
 * three-state `permissionEnvelopeState` (the lane-facing zero-authority
 * polarity stays — on the expansion plane abstention must mean zero
 * authority; only the COMPARATOR gets the third state), and the adapter
 * maps `unavailable` to `{ stage: 'unreadable' }` → the closed
 * `authority-document-unreadable` corrupt arm.
 *
 * BLOCKER 3 (production `contains` could never answer `undefined`): the
 * warning lane inherited the PLANE-shaped `fsContainsKeys` — absent
 * `contains` THREW (escaping `runGate`/`governanceStartGate` unmapped as
 * `internal-error`), and the `=== true` coercion collapsed every
 * non-`true` provider answer to a fabricated `false`, making the
 * comparator's `undetermined` verdict UNREACHABLE in production. The
 * fix: `buildGovernanceWarningContains` — never throws, answers
 * `undefined` for absent/faulting/non-boolean, `true`/`false` only for
 * real answers. The PLANE's throw law is untouched (different
 * consumption site, different documented law).
 *
 * The composition legs run the REAL `createGovernanceWarningService`
 * over the REAL host adapters: faulted leader read → `corrupt` (was:
 * `open`); containment-undeterminable world → `undetermined` mints a
 * warning → `warning-required` with an intervention pointer (was: raw
 * throw out of `checkStart`).
 *
 * Runner: plain-node shim — module-level driving, synchronous `it`
 * assertions.
 *
 * @module @dsh-agent-team/runtime/test/a4p6-governance-warning-host-adapter
 */

import { describe, expect, it } from 'vitest'

import { buildGovernanceWarningContains, buildGovernanceWarningDocs } from '../src/plugin/host.js'
import type { AuthorityEnvelopeDocument } from '../src/plugin/host.js'
import { createGovernanceWarningService } from '../governance-warning/index.js'
import type { GovernanceEnvelopeView } from '../governance-warning/index.js'
import type { PermissionEnvelopeStateRead } from '../src/plugin/permission-plane.js'

const ROOT = 'root-a4p6-host-adapter'

const viewOf = (document: AuthorityEnvelopeDocument): GovernanceEnvelopeView => ({
  rules: document.rules.map((rule) => ({
    operationClass: rule.operationClass,
    effect: rule.maximumEffect,
    matcherKind: rule.matcher.kind,
    matcherKey: rule.matcher.resource,
  })),
})

const ENVELOPE_NONE: AuthorityEnvelopeDocument = { rules: [] }
const ENVELOPE_WRITE_LEAD: AuthorityEnvelopeDocument = {
  rules: [
    {
      operationClass: 'write',
      matcher: { kind: 'subtree', resource: '/work/m1/src/**' },
      maximumEffect: 'allow',
    },
  ],
}
/** A DIFFERENT (broader) subtree key — identical keys are decided by the
 *  comparator without consulting `contains`; distinct keys force the
 *  containment question the fix is about. */
const ENVELOPE_WRITE_HARD: AuthorityEnvelopeDocument = {
  rules: [
    {
      operationClass: 'write',
      matcher: { kind: 'subtree', resource: '/work/**' },
      maximumEffect: 'allow',
    },
  ],
}

type DocsDeps = Parameters<typeof buildGovernanceWarningDocs>[0]

function docsDeps(overrides: {
  schemaVersion?: number | undefined
  contentHash?: string | undefined
  leader?: PermissionEnvelopeStateRead
  hard?: { status: 'declared'; document: AuthorityEnvelopeDocument } | { status: 'absent' } | { status: 'unavailable' }
}): DocsDeps {
  return {
    blueprintSchemaVersion: () => ('schemaVersion' in overrides ? overrides.schemaVersion : 3),
    blueprintContentHash: () => ('contentHash' in overrides ? overrides.contentHash : 'sha256:bp-hash'),
    permissionEnvelopeState: async () =>
      overrides.leader ?? { status: 'declared', document: ENVELOPE_NONE },
    // The builder only touches `.status` / `.document` of the hard read —
    // the structural envelope subset is the whole contract it uses.
    teamHardEnvelope: (async () =>
      overrides.hard ?? { status: 'absent' }) as DocsDeps['teamHardEnvelope'],
    envelopeView: viewOf,
    leaderInstanceId: 'inst-team-leader',
  }
}

// --- docs adapter: the stage decisions ----------------------------------------------

const DOCS = {
  schemaUnknown: await buildGovernanceWarningDocs(docsDeps({ schemaVersion: undefined })).read(ROOT),
  preV3: await buildGovernanceWarningDocs(docsDeps({ schemaVersion: 2 })).read(ROOT),
  hardUnavailable: await buildGovernanceWarningDocs(docsDeps({ hard: { status: 'unavailable' } })).read(ROOT),
  hashUnknown: await buildGovernanceWarningDocs(docsDeps({ contentHash: undefined })).read(ROOT),
  // THE fix-2 case: a FAULTED leader read must be `unreadable`, never a
  // v3 stage carrying a zero-claim leader document.
  leaderUnavailable: await buildGovernanceWarningDocs(
    docsDeps({ leader: { status: 'unavailable' } }),
  ).read(ROOT),
  declaredConsistent: await buildGovernanceWarningDocs(
    docsDeps({
      leader: { status: 'declared', document: ENVELOPE_WRITE_LEAD },
      hard: { status: 'declared', document: ENVELOPE_WRITE_LEAD },
    }),
  ).read(ROOT),
  hardAbsent: await buildGovernanceWarningDocs(
    docsDeps({ leader: { status: 'declared', document: ENVELOPE_NONE } }),
  ).read(ROOT),
}

// --- contains adapter: the three states ----------------------------------------------

const CONTAINS = {
  seamAbsent: buildGovernanceWarningContains(() => ({}))('parent', 'child'),
  providerThrows: buildGovernanceWarningContains(() => ({
    contains: () => {
      throw new Error('provider exploded')
    },
  }))('parent', 'child'),
  backendLookupThrows: buildGovernanceWarningContains(() => {
    throw new Error('ctx.get failed')
  })('parent', 'child'),
  truthy: buildGovernanceWarningContains(() => ({ contains: () => true }))('parent', 'child'),
  falsy: buildGovernanceWarningContains(() => ({ contains: () => false }))('parent', 'child'),
  nonBoolean: buildGovernanceWarningContains(() => ({ contains: () => 'covered' as unknown as boolean }))(
    'parent',
    'child',
  ),
}

// --- composition: the REAL service over the REAL adapters ----------------------------

function serviceOver(
  docs: DocsDeps,
  fsProvider: () => { contains?: (p: { targetKey: string }, c: { targetKey: string }) => unknown },
) {
  const observed: Array<{ rootSessionId: string; payload: Record<string, unknown> }> = []
  const service = createGovernanceWarningService({
    writer: {
      writeObserved: async (rootSessionId, payload) => {
        observed.push({ rootSessionId, payload })
      },
      writeAcknowledged: async () => undefined,
    },
    reader: {
      list: async () => [],
    },
    docs: buildGovernanceWarningDocs(docs),
    contains: buildGovernanceWarningContains(fsProvider),
    now: () => '2026-10-12T00:00:00.000Z',
  })
  return { service, observed }
}

const COMPOSE = await (async () => {
  // The review's exact fault world: v3, hard ceiling readable, the LEADER
  // read abstains (binding drift / canonicalization fault / unknown
  // binding). Pre-fix: `consistent` → OPEN. Post-fix: corrupt,
  // authority-document-unreadable.
  const leaderFault = serviceOver(docsDeps({ leader: { status: 'unavailable' } }), () => ({}))
  const leaderFaultOutcome = await leaderFault.service
    .checkStart(ROOT)
    .then(
      (outcome) => ({ kind: 'resolved' as const, outcome }),
      (error: unknown) => ({
        kind: 'rejected' as const,
        message: error instanceof Error ? error.message : String(error),
      }),
    )
  // The review's second fault world: containment UNDETERMINABLE (no
  // public `contains` seam). Pre-fix: raw throw out of `checkStart`
  // (→ `internal-error` on the wire). Post-fix: the comparator absorbs
  // `undefined` into `undetermined`, a warning is minted, the outcome is
  // `warning-required` with an intervention pointer.
  const containmentUnknown = serviceOver(
    docsDeps({
      leader: { status: 'declared', document: ENVELOPE_WRITE_LEAD },
      hard: { status: 'declared', document: ENVELOPE_WRITE_HARD },
    }),
    () => ({}),
  )
  const containmentOutcome = await containmentUnknown.service
    .checkStart(ROOT)
    .then(
      (outcome) => ({ kind: 'resolved' as const, outcome }),
      (error: unknown) => ({
        kind: 'rejected' as const,
        message: error instanceof Error ? error.message : String(error),
      }),
    )
  return { leaderFaultOutcome, leaderFaultObserved: leaderFault.observed, containmentOutcome, containmentObserved: containmentUnknown.observed }
})()

// --- assertions ------------------------------------------------------------------------

describe('A4-PR6 review round 1 (fix 2/6) — the docs adapter is three-state', () => {
  it('a FAULTED leader read maps to `unreadable` (never a zero-claim v3 document)', () => {
    expect(DOCS.leaderUnavailable).toEqual({ stage: 'unreadable' })
  })

  it('the pre-existing fail-closed legs keep their exact arms', () => {
    expect(DOCS.schemaUnknown).toEqual({ stage: 'unreadable' })
    expect(DOCS.preV3).toEqual({ stage: 'pre-v3', schemaVersion: 2 })
    expect(DOCS.hardUnavailable).toEqual({ stage: 'unreadable' })
    expect(DOCS.hashUnknown).toEqual({ stage: 'unreadable' })
  })

  it('a DECLARED leader (including legally empty) still reads through as v3', () => {
    expect(DOCS.declaredConsistent).toEqual({
      stage: 'v3',
      hardStatus: 'declared',
      blueprintContentHash: 'sha256:bp-hash',
      leader: viewOf(ENVELOPE_WRITE_LEAD),
      hard: viewOf(ENVELOPE_WRITE_LEAD),
    })
    expect(DOCS.hardAbsent).toEqual({
      stage: 'v3',
      hardStatus: 'absent',
      blueprintContentHash: 'sha256:bp-hash',
      leader: viewOf(ENVELOPE_NONE),
      hard: { rules: [] },
    })
  })

  it('composition: the fault world now CORRUPTS the gate (pre-fix it opened) and writes nothing mint-worthy', () => {
    expect(COMPOSE.leaderFaultOutcome.kind).toBe('resolved')
    expect(JSON.stringify(COMPOSE.leaderFaultOutcome)).toContain('corrupt')
    expect(JSON.stringify(COMPOSE.leaderFaultOutcome)).toContain('authority-document-unreadable')
    // corrupt does NOT mint a warning (only mismatch/undetermined mint).
    expect(COMPOSE.leaderFaultObserved.length).toBe(0)
  })
})

describe('A4-PR6 review round 1 (fix 3/6) — production `contains` reaches `undefined`', () => {
  it('absent seam, throwing seam, throwing provider, and non-boolean answers are ALL `undefined`', () => {
    expect(CONTAINS.seamAbsent === undefined).toBe(true)
    expect(CONTAINS.providerThrows === undefined).toBe(true)
    expect(CONTAINS.backendLookupThrows === undefined).toBe(true)
    expect(CONTAINS.nonBoolean === undefined).toBe(true)
  })

  it('only real boolean answers decide', () => {
    expect(CONTAINS.truthy).toBe(true)
    expect(CONTAINS.falsy).toBe(false)
  })

  it('composition: an undeterminable containment world MINTS a warning and refuses with an intervention pointer (pre-fix: raw throw)', () => {
    expect(COMPOSE.containmentOutcome.kind).toBe('resolved')
    expect(JSON.stringify(COMPOSE.containmentOutcome)).toContain('warning-required')
    expect(COMPOSE.containmentObserved.length).toBe(1) // undetermined mints, exactly once
    expect(JSON.stringify(COMPOSE.containmentObserved[0])).toContain('undetermined')
  })
})
