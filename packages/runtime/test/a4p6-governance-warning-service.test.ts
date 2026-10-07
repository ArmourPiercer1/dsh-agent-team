/**
 * A4-PR6 stage 6.A — the GovernanceWarning service, the Team-start gate,
 * and the acknowledgement plane.
 *
 * Law under test (plan §6.A, spec §15, ADR A5-10):
 *
 * 1. the consistency diagnostic folds `consistent | mismatch | undetermined`;
 *    only the last two mint warnings; `undetermined` ABSORBS;
 * 2. warnings are fingerprint-bound and deduplicated (repeat observations
 *    fold into count/time, never a second warning);
 * 3. the start gate returns the closed outcome union and blocks ONLY the
 *    two `team.create` sites (post-bind, pre-`startRootAgent`) and the
 *    `ensureRootLive` path — the durable root EXISTS and stays NOT LIVE;
 * 4. a warning is NEVER a ControlRequest / approval case, and the gate NEVER
 *    returns `wait-for-response` semantics;
 * 5. acknowledgement binds the FINGERPRINT, re-enters the SAME gate through
 *    `ensureRootLive`, never bypasses it, and never affects the authority
 *    evaluator's output;
 * 6. `migration-required` is ack-IMMUNE — no acknowledgement clears it, in
 *    PR6 or after (plan:594);
 * 7. corrupt/unreadable authority documents fail closed and are NOT
 *    acknowledgeable;
 * 8. the v1/v2 BRIDGE window keeps today's behaviour (open) — the gate never
 *    infers the document version from the wire version (A5-12 orthogonality).
 */

import { describe, expect, it } from 'vitest'

import { createGovernanceWarningService } from '../governance-warning/service.js'
import {
  GOVERNANCE_START_CORRUPT_REASONS,
  GOVERNANCE_WARNING_ACTIONS,
  type EnvelopeContains,
  type GovernanceEnvelopeView,
} from '../governance-warning/index.js'

// ---------------------------------------------------------------------------
// fixtures: an in-memory durable ledger + a synthetic blueprint/provider plane
// ---------------------------------------------------------------------------

interface FactRow {
  readonly factType: string
  readonly payload: Readonly<Record<string, unknown>>
  readonly at: string
}

class FakeLedger {
  private readonly rows: FactRow[] = []
  private n = 0
  now(): string {
    this.n += 1
    return new Date(Date.UTC(2026, 9, 20, 12, 0, this.n)).toISOString()
  }
  async append(_rootSessionId: string, factType: string, payload: Record<string, unknown>): Promise<void> {
    this.rows.push({ factType, payload, at: this.now() })
  }
  async list(
    _rootSessionId: string,
    factTypes: readonly string[],
  ): Promise<readonly { factType: string; payload: Readonly<Record<string, unknown>>; createdAt: string }[]> {
    return this.rows.filter((r) => factTypes.includes(r.factType)).map((r) => ({ factType: r.factType, payload: r.payload, createdAt: r.at }))
  }
  /** Raw durable history for write-shape assertions. */
  all(): readonly FactRow[] {
    return this.rows
  }
}

const envelope = (
  rules: ReadonlyArray<readonly [string, 'deny' | 'ask' | 'allow', 'exact' | 'subtree' | 'fingerprint', string]>,
): GovernanceEnvelopeView => ({
  rules: rules.map(([operationClass, effect, matcherKind, matcherKey]) => ({
    operationClass,
    effect,
    matcherKind,
    matcherKey,
  })),
})

/** Canonical containment: `a/b` contains `a/b/c`; `shell` contains `shell:x`. */
const pathContains: EnvelopeContains = (parent, point) =>
  point === parent || point.startsWith(`${parent}/`) || point.startsWith(`${parent}:`)

/**
 * Blueprint fixture factory. `docs` is the bound-document view the gate
 * reads through the injected document port:
 * - v3 documents: leader envelope + team hard envelope as VIEWS;
 * - v1/v2: `bridge: true` (no v3 documents exist — today's bridge).
 */
function makeService(opts: {
  bridge?: boolean
  leader?: GovernanceEnvelopeView
  hard?: GovernanceEnvelopeView
  hardStatus?: 'declared' | 'absent' | 'unreadable' | 'corrupt'
  contains?: EnvelopeContains
} = {}) {
  const ledger = new FakeLedger()
  const service = createGovernanceWarningService({
    writer: {
        writeObserved: (root, payload) => ledger.append(root, 'governance-warning-observed', payload),
        writeAcknowledged: (root, payload) => ledger.append(root, 'governance-warning-acknowledged', payload),
      },
    reader: { list: (root, factTypes) => ledger.list(root, factTypes) },
    now: () => ledger.now(),
    contains: opts.contains ?? pathContains,
    docs: {
      async read(_teamSessionId: string) {
        if (opts.bridge) return { stage: 'pre-v3', schemaVersion: 2 } as const
        if (opts.hardStatus === 'unreadable') return { stage: 'unreadable' } as const
        if (opts.hardStatus === 'corrupt') return { stage: 'corrupt' } as const
        return {
          stage: 'v3',
          blueprintContentHash: 'sha256:bp-hash-1',
          leader: opts.leader ?? envelope([]),
          hard: opts.hard ?? envelope([]),
          hardStatus: opts.hardStatus ?? 'declared',
        } as const
      },
    },
  })
  return { service, ledger }
}

// ---------------------------------------------------------------------------
// 1. the consistency diagnostic
// ---------------------------------------------------------------------------

describe('6.A consistency diagnostic: consistent | mismatch | undetermined', () => {
  it('consistent: leader envelope inside the hard envelope writes NOTHING durable', async () => {
    const { service, ledger } = makeService({
      // hard: deny everything under `shell`
      hard: envelope([['tool.shell', 'deny', 'subtree', 'shell']]),
      // leader: ask on the narrower exact matcher (still inside the deny subtree? no —
      // leader must be INSIDE: use a non-shell class the hard envelope leaves free)
      leader: envelope([['file.read', 'ask', 'exact', 'file:src/a']]),
    })
    const outcome = await service.checkStart('team-1')
    expect(outcome).toEqual({ status: 'open' })
    expect(ledger.all()).toEqual([]) // `consistent` writes NOTHING (plan §6.A)
  })

  it('mismatch: a leader effect the hard envelope forbids mints a durable warning and blocks start', async () => {
    const { service, ledger } = makeService({
      hard: envelope([['tool.shell', 'deny', 'subtree', 'shell'], ['file.read', 'allow', 'subtree', 'file']]),
      // leader ALLOWS a point the hard envelope DENIES → mismatch witness
      leader: envelope([['tool.shell', 'allow', 'exact', 'shell:rm:-rf:/']]),
    })
    const outcome = await service.checkStart('team-1')
    expect(outcome.status).toBe('warning-required')
    const rows = ledger.all().filter((r) => r.factType === 'governance-warning-observed')
    expect(rows).toHaveLength(1)
    const row = rows[0]!
    expect(row.payload.kind).toBe('envelope-consistency')
    expect(row.payload.verdict).toBe('mismatch')
    expect(typeof row.payload.fingerprint).toBe('string')
    expect(String(row.payload.fingerprint).length).toBeGreaterThanOrEqual(16)
    expect(typeof (outcome as { interventionId: string }).interventionId).toBe('string')
  })

  it('undetermined ABSORBS: an undecidable containment compares as undetermined, never consistent', async () => {
    const { service } = makeService({
      hard: envelope([['tool.shell', 'deny', 'subtree', 'shell']]),
      leader: envelope([['tool.shell', 'allow', 'subtree', 'weird/root']]),
      // containment says nothing about this pair → undetermined (mutation flip:
      // returning `true` here would make the comparison decided, and `false`
      // would make it a decided consistent/mismatch — the absorber must be
      // able to fire ALONE)
      contains: (parent, point) =>
        parent === 'shell' && point === 'weird/root' ? undefined : pathContains(parent, point),
    })
    const outcome = await service.checkStart('team-1')
    expect(outcome.status).toBe('warning-required')
  })

  it('fingerprint dedup: a repeat observation folds count/time, never a second warning', async () => {
    const { service } = makeService({
      hard: envelope([['tool.shell', 'deny', 'subtree', 'shell']]),
      leader: envelope([['tool.shell', 'allow', 'exact', 'shell:rm:-rf:/']]),
    })
    const first = await service.checkStart('team-1')
    const second = await service.checkStart('team-1')
    expect(second).toEqual(first) // same interventionId — dedup by fingerprint
    const open = await service.listWarnings('team-1')
    expect(open).toHaveLength(1)
    expect(open[0]!.observationCount).toBe(2)
    expect(open[0]!.firstObservedAt < open[0]!.lastObservedAt).toBe(true)
  })

  it('fingerprint drift (envelope edit) mints a NEW unacknowledged warning', async () => {
    // Same service, changed documents: the fingerprint binds the normalized
    // envelopes, so the post-edit warning is a different fingerprint.
    const ledger = new FakeLedger()
    let leader = envelope([['tool.shell', 'allow', 'exact', 'shell:rm:-rf:/']])
    const service = createGovernanceWarningService({
      writer: {
        writeObserved: (root, payload) => ledger.append(root, 'governance-warning-observed', payload),
        writeAcknowledged: (root, payload) => ledger.append(root, 'governance-warning-acknowledged', payload),
      },
      reader: { list: (root, factTypes) => ledger.list(root, factTypes) },
      now: () => ledger.now(),
      contains: pathContains,
      docs: {
        async read() {
          return {
            stage: 'v3' as const,
            blueprintContentHash: 'sha256:bp-hash-1',
            leader,
            hard: envelope([['tool.shell', 'deny', 'subtree', 'shell']]),
            hardStatus: 'declared' as const,
          }
        },
      },
    })
    await service.checkStart('team-1')
    leader = envelope([['tool.shell', 'allow', 'exact', 'shell:rm:-rf:/tmp/x']])
    const drifted = await service.checkStart('team-1') // re-observation at the drifted docs
    expect(drifted.status).toBe('warning-required')
    const after = await service.listWarnings('team-1')
    expect(after).toHaveLength(2) // drifted fingerprint = new warning
    expect(new Set(after.map((w) => w.fingerprint)).size).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// 2. acknowledgement: fingerprint-bound, reminder-only, same-gate re-entry
// ---------------------------------------------------------------------------

describe('6.A acknowledgement plane', () => {
  it('acknowledging binds the fingerprint and re-opens the SAME gate (ensureRootLive re-entry)', async () => {
    const { service } = makeService({
      hard: envelope([['tool.shell', 'deny', 'subtree', 'shell']]),
      leader: envelope([['tool.shell', 'allow', 'exact', 'shell:rm:-rf:/']]),
    })
    const blocked = await service.checkStart('team-1')
    expect(blocked.status).toBe('warning-required')
    const warnings = await service.listWarnings('team-1')
    const ack = await service.acknowledge({
      teamSessionId: 'team-1',
      interventionId: warnings[0]!.interventionId,
      callerPrincipalId: 'host-operator',
      note: 'reviewed',
    })
    expect(ack.kind).toBe('acknowledged')
    // Re-entry through the SAME gate: acknowledged fingerprint => start may proceed.
    const reentered = await service.checkEnsureRootLive('team-1')
    expect(reentered).toEqual({ status: 'open' })
  })

  it('a re-observation AFTER acknowledgement on the SAME fingerprint does not re-block (reminder-only)', async () => {
    const { service } = makeService({
      hard: envelope([['tool.shell', 'deny', 'subtree', 'shell']]),
      leader: envelope([['tool.shell', 'allow', 'exact', 'shell:rm:-rf:/']]),
    })
    await service.checkStart('team-1')
    const [w] = await service.listWarnings('team-1')
    await service.acknowledge({
      teamSessionId: 'team-1',
      interventionId: w!.interventionId,
      callerPrincipalId: 'host-operator',
    })
    await service.observeRuntime('team-1') // boundary observation re-runs the check
    const again = await service.checkEnsureRootLive('team-1')
    expect(again).toEqual({ status: 'open' }) // reminder state only — no re-block
    const list = await service.listWarnings('team-1')
    expect(list[0]!.acknowledged).toBe(true)
    expect(list[0]!.acknowledgedBy).toBe('host-operator')
  })

  it('drift after acknowledgement produces an UNACKNOWLEDGED warning and blocks again', async () => {
    const ledger = new FakeLedger()
    let leader = envelope([['tool.shell', 'allow', 'exact', 'shell:rm:-rf:/']])
    const service = createGovernanceWarningService({
      writer: {
        writeObserved: (root, payload) => ledger.append(root, 'governance-warning-observed', payload),
        writeAcknowledged: (root, payload) => ledger.append(root, 'governance-warning-acknowledged', payload),
      },
      reader: { list: (root, factTypes) => ledger.list(root, factTypes) },
      now: () => ledger.now(),
      contains: pathContains,
      docs: {
        async read() {
          return {
            stage: 'v3' as const,
            blueprintContentHash: 'sha256:bp-hash-1',
            leader,
            hard: envelope([['tool.shell', 'deny', 'subtree', 'shell']]),
            hardStatus: 'declared' as const,
          }
        },
      },
    })
    await service.checkStart('team-1')
    const [w] = await service.listWarnings('team-1')
    await service.acknowledge({
      teamSessionId: 'team-1',
      interventionId: w!.interventionId,
      callerPrincipalId: 'host-operator',
    })
    leader = envelope([['tool.shell', 'allow', 'exact', 'shell:rm:-rf:/etc']])
    const blocked = await service.checkEnsureRootLive('team-1')
    expect(blocked.status).toBe('warning-required')
  })

  it('acknowledging a warning-id that does not exist is a typed not-found, never a write', async () => {
    const { service, ledger } = makeService()
    const ack = await service.acknowledge({
      teamSessionId: 'team-1',
      interventionId: 'int-warn-does-not-exist',
      callerPrincipalId: 'host-operator',
    })
    expect(ack.kind).toBe('not-found')
    expect(ledger.all().filter((r) => r.factType === 'governance-warning-acknowledged')).toHaveLength(0)
  })

  it('the ack action vocabulary is the WARNING plane only', async () => {
    // The service surface has NO allow/deny/escalate on warnings and no
    // warning entry on the decision vocabulary (the plane split, part 2).
    const { service } = makeService()
    expect(typeof service.acknowledge).toBe('function')
    expect(GOVERNANCE_WARNING_ACTIONS.ACKNOWLEDGE).toBe('acknowledge')
    // structural: the service exposes no decision-writing surface at all
    const keys = Object.keys(service).sort()
    expect(keys).not.toContain('resolveControl')
    expect(keys).not.toContain('decide')
    expect(keys).not.toContain('escalate')
  })
})

// ---------------------------------------------------------------------------
// 3. fail-closed arms and the bridge
// ---------------------------------------------------------------------------

describe('6.A fail-closed arms + bridge window', () => {
  it('corrupt authority document: blocked, NOT acknowledgeable', async () => {
    const { service } = makeService({ hardStatus: 'corrupt' })
    const outcome = await service.checkStart('team-1')
    expect(outcome).toEqual({ status: 'corrupt', reason: GOVERNANCE_START_CORRUPT_REASONS.AUTHORITY_DOCUMENT_CORRUPT })
  })

  it('unreadable authority document: blocked, NOT acknowledgeable', async () => {
    const { service } = makeService({ hardStatus: 'unreadable' })
    const outcome = await service.checkStart('team-1')
    expect(outcome).toEqual({
      status: 'corrupt',
      reason: GOVERNANCE_START_CORRUPT_REASONS.AUTHORITY_DOCUMENT_UNREADABLE,
    })
  })

  it('migration-required is ack-IMMUNE: no acknowledgement clears it, ever', async () => {
    // Unit-pinned arm (UNREACHABLE through the bridge in PR6 — disclosed):
    // a service configured in the PR7 posture refuses v1/v2 START and the
    // ack plane refuses to produce any outcome that turns it into `open`.
    const ledger = new FakeLedger()
    const service = createGovernanceWarningService({
      writer: {
        writeObserved: (root, payload) => ledger.append(root, 'governance-warning-observed', payload),
        writeAcknowledged: (root, payload) => ledger.append(root, 'governance-warning-acknowledged', payload),
      },
      reader: { list: (root, factTypes) => ledger.list(root, factTypes) },
      now: () => ledger.now(),
      contains: pathContains,
      bridge: false, // PR7 posture: the bridge is gone
      docs: { async read() { return { stage: 'pre-v3', schemaVersion: 2 } as const } },
    })
    const outcome = await service.checkStart('team-2')
    expect(outcome).toEqual({ status: 'migration-required' })
    const after = await service.checkEnsureRootLive('team-2')
    expect(after).toEqual({ status: 'migration-required' })
    // The ack plane has nothing to acknowledge (no warning was minted) and
    // fabricating an ack for a migration-required team still cannot open it:
    const ack = await service.acknowledge({
      teamSessionId: 'team-2',
      interventionId: 'int-warn-anything',
      callerPrincipalId: 'host-operator',
    })
    expect(ack.kind).toBe('not-found')
    expect(await service.checkEnsureRootLive('team-2')).toEqual({ status: 'migration-required' })
  })

  it('BRIDGE (plan:603): v1/v2 bound documents keep today behaviour through PR6 — start stays open', async () => {
    const { service, ledger } = makeService({ bridge: true })
    expect(await service.checkStart('team-old')).toEqual({ status: 'open' })
    expect(await service.checkEnsureRootLive('team-old')).toEqual({ status: 'open' })
    expect(ledger.all()).toEqual([]) // bridge teams mint ZERO warnings
  })
})

// ---------------------------------------------------------------------------
// 4. never a ControlRequest; never wait-for-response
// ---------------------------------------------------------------------------

describe('6.A a warning is not an approval case', () => {
  it('a minted warning produces no ControlRequest row and no approval-case entry (the lane split)', async () => {
    const { service, ledger } = makeService({
      hard: envelope([['tool.shell', 'deny', 'subtree', 'shell']]),
      leader: envelope([['tool.shell', 'allow', 'exact', 'shell:rm:-rf:/']]),
    })
    await service.checkStart('team-1')
    await service.observeRuntime('team-1')
    // The ONLY facts written are warning facts — no `control-request-*`, no
    // approval-case identity, no decision vocabulary involvement.
    for (const row of ledger.all()) {
      expect(row.factType.startsWith('control-')).toBe(false)
      expect(row.factType.startsWith('governance-proposal')).toBe(false)
      expect(row.payload.decision).toBeUndefined()
    }
    expect(ledger.all().length).toBeGreaterThan(0)
  })

  it('the gate NEVER returns wait-for-response semantics (non-blocking stage)', async () => {
    const { service } = makeService({
      hard: envelope([['tool.shell', 'deny', 'subtree', 'shell']]),
      leader: envelope([['tool.shell', 'allow', 'exact', 'shell:rm:-rf:/']]),
    })
    for (const outcome of [await service.checkStart('team-1'), await service.checkEnsureRootLive('team-1')]) {
      expect(outcome.status).not.toBe('wait-for-response')
      // The frozen outcome union has exactly the four arms (GOVERNANCE_START_STATUSES).
      expect(['open', 'warning-required', 'corrupt', 'migration-required']).toContain(outcome.status)
    }
  })
})
