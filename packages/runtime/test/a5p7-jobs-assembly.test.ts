/**
 * a5p7-jobs-assembly.test.ts — the GLUE-5 LIVE ROW as behavior, not as an
 * import edge. Until this file the live row `jobs-gateway-assembly.mjs` was
 * pinned only by `a5p7-lane-hygiene` (its import edges and placement); the
 * row's own acceptance forms — the three injected sources running over a
 * TWO-MEMBER world through the production class — land here.
 *
 * Semantic source (UNCHANGED, restated): pc-CONTRACT.md §0/§1.1 + the R2b
 * line (`unreadable = a refusal, never an assumption of no change`):
 *  - identity: durable `MemberInstance` rows of THIS root are the authority;
 *    an unconfirmed claim is refused `owner-not-durable` BEFORE the lease
 *    (zero registration), and a claim naming another root is unknown
 *    attribution ⇒ not confirmed here (the row speaks for ONE root);
 *  - lease: the assembly owns the window; teardown (drain/release/giveUp)
 *    acts on the SAME object the gateway drives; a re-assembly after
 *    teardown gets a NEW window;
 *  - definition: the row-local store starts EMPTY — a pin-less admit against
 *    an unreadable definition is refused `mapping-rejected` with zero lease;
 *    the C-BIND re-read cancels exactly the jobs whose OWN definition moved
 *    (an unreadable read counts as moved), never a friendly-fire sweep.
 *
 * Positive forms: durable admit (authority copy), same-ID same-owner pin,
 * teardown release at self-counted zero, moved-definition preempt = its own
 * job. Negative forms: same-ID cross-member contention (owner-mismatch +
 * alarm), non-owner projection (no identity echo), cross-root claim, non-
 * durable claim (zero delta), drained-window admit refusal, giveUp release
 * refusal, unreadable-definition re-read preempts (never "assume unchanged").
 *
 * @module test/a5p7-jobs-assembly
 */
import { describe, expect, it } from 'vitest'
import { jobOwnerKey } from '../jobs-gateway/index.js'
import type { GatewayJobRecord, JobOwner } from '../jobs-gateway/index.js'

type IdentitySource = { resolve: (claimed: JobOwner) => JobOwner | null }
type Assembly = {
  gateway: {
    lease: {
      state: () => string
      outstanding: () => readonly { callId: string; jobKey: string }[]
    }
    job: (jobId: string) => readonly GatewayJobRecord[]
    projectFor: (
      viewer: JobOwner,
      jobId: string,
    ) => { readonly ok: true } | { readonly ok: false; readonly code: string; readonly detail: string }
    onRegistryChange: (
      probe?: (scopeKey: string, name: string) => { readonly ok: boolean; readonly identity: string },
    ) => readonly { jobId: string; pinnedIdentity: string; currentIdentity: string }[]
    observeDispatchEvent: (event: { event: string; callId: string; [rest: string]: unknown }) => { ok: boolean }
  }
  lease: {
    state: () => string
    outstanding: () => readonly { callId: string; jobKey: string }[]
  }
  drain: () => { ok: boolean }
  release: () => { ok: boolean }
  giveUp: (why: string) => { ok: boolean }
  admitTeamJob: (input: {
    jobId: string
    owner: JobOwner
    scopeKey: string
    toolName: string
    pinnedIdentity?: string
  }) => { ok: true; job: GatewayJobRecord } | { ok: false; code: string; detail: string }
  definitions: {
    register: (scopeKey: string, name: string, identity: string) => void
    resolveDefinition: (scopeKey: string, name: string) => { ok: boolean; identity: string }
  }
  observations: () => readonly { event: string; [rest: string]: unknown }[]
}

const assemblyRow = (await import(
  new URL('../src/plugin/live/jobs-gateway-assembly.mjs', import.meta.url).href
)) as {
  createLiveJobsGatewayAssembly: (opts: {
    teamRoot: unknown
    rootSessionId: string
    onObserve?: (o: { event: string }) => void
  }) => Assembly
  durableMemberIdentitySource: (domain: unknown, rootSessionId: string) => IdentitySource
}

const ROOT = 'root-a5jobs'
const OWNER_A: JobOwner = { rootSessionId: ROOT, instanceId: 'inst-1' }
const OWNER_B: JobOwner = { rootSessionId: ROOT, instanceId: 'inst-2' }
const FOREIGN_ROOT = 'root-other-team'

/** The shape the glue holds: an OPENED TeamDomain with the memberInstances
 *  repository. `list` answers rows per root; `explode` makes it unreadable. */
function fakeDomain(
  rowsByRoot: Record<string, readonly { instanceId: string }[]>,
  opts: { explode?: boolean } = {},
): { repositories: { memberInstances: { list: (rootKey: string) => readonly { instanceId: string }[] } } } {
  return {
    repositories: {
      memberInstances: {
        list: (rootKey: string) => {
          if (opts.explode === true) throw new Error('repository unreadable (fixture)')
          return rowsByRoot[rootKey] ?? []
        },
      },
    },
  }
}

function twoMemberWorld(extra: { explode?: boolean } = {}) {
  const domain = fakeDomain({ [ROOT]: [{ instanceId: 'inst-1' }, { instanceId: 'inst-2' }], [FOREIGN_ROOT]: [{ instanceId: 'inst-9' }] }, extra)
  const ledger: string[] = []
  const asm = assemblyRow.createLiveJobsGatewayAssembly({
    teamRoot: domain,
    rootSessionId: ROOT,
    onObserve: (o) => ledger.push(o.event),
  })
  return { asm, ledger, domain }
}

describe('a5p7 live row — durableMemberIdentitySource (the identity authority)', () => {
  it('a row hit answers the AUTHORITY COPY (row/root values, two fields only)', () => {
    const src = assemblyRow.durableMemberIdentitySource(fakeDomain({ [ROOT]: [{ instanceId: 'inst-1' }] }), ROOT)
    const claim = { rootSessionId: ROOT, instanceId: 'inst-1', smuggled: 'caller side-channel' } as JobOwner & { smuggled: string }
    const confirmed = src.resolve(claim)
    expect(confirmed).not.toBeNull()
    expect(confirmed).toEqual({ rootSessionId: ROOT, instanceId: 'inst-1' })
    // The claim object's extra fields are NOT carried into the authority copy.
    expect(JSON.stringify(confirmed)).not.toContain('side-channel')
  })

  it('a claim naming ANOTHER root is not confirmed even when that root would hold the row', () => {
    const src = assemblyRow.durableMemberIdentitySource(
      fakeDomain({ [ROOT]: [], [FOREIGN_ROOT]: [{ instanceId: 'inst-9' }] }),
      ROOT,
    )
    // The row exists under the FOREIGN root; this assembly speaks for ROOT only.
    expect(src.resolve({ rootSessionId: FOREIGN_ROOT, instanceId: 'inst-9' })).toBeNull()
  })

  it('no row ⇒ null; an unreadable repository ⇒ null (the closed world credits no read it cannot make)', () => {
    const src = assemblyRow.durableMemberIdentitySource(fakeDomain({ [ROOT]: [] }), ROOT)
    expect(src.resolve(OWNER_A)).toBeNull()
    const broken = assemblyRow.durableMemberIdentitySource(
      fakeDomain({ [ROOT]: [{ instanceId: 'inst-1' }] }, { explode: true }),
      ROOT,
    )
    expect(broken.resolve(OWNER_A)).toBeNull()
  })
})

describe('a5p7 live row — admit over a TWO-MEMBER durable world (same-ID contention)', () => {
  it('member A admits with the SOURCE copy as ownerKey; the lease holds exactly one token', () => {
    const { asm, ledger } = twoMemberWorld()
    asm.definitions.register('agent:wa', 'tool-x', 'tool-x@v1')
    const took = asm.admitTeamJob({ jobId: 'j1', owner: OWNER_A, scopeKey: 'agent:wa', toolName: 'tool-x' })
    expect(took.ok).toBe(true)
    if (took.ok) expect(took.job.ownerKey).toBe(jobOwnerKey(OWNER_A))
    expect(asm.lease.outstanding().map((t) => t.callId)).toEqual(['j1'])
    expect(ledger).toContain('gateway-job-admitted')
    expect(ledger).not.toContain('gateway-admit-identity-unconfirmed')
  })

  it('same jobId, second member ⇒ owner-mismatch + alarm; the first job stands untouched', () => {
    const { asm, ledger } = twoMemberWorld()
    asm.definitions.register('agent:wa', 'tool-x', 'tool-x@v1')
    asm.definitions.register('agent:wb', 'tool-x', 'tool-x@v1')
    expect(asm.admitTeamJob({ jobId: 'j1', owner: OWNER_A, scopeKey: 'agent:wa', toolName: 'tool-x' }).ok).toBe(true)
    const clash = asm.admitTeamJob({ jobId: 'j1', owner: OWNER_B, scopeKey: 'agent:wb', toolName: 'tool-x' })
    expect(!clash.ok && clash.code === 'owner-mismatch').toBe(true)
    expect(ledger).toContain('gateway-admit-owner-claim-conflict')
    // VETO-SIDE ZERO DISTURBANCE: A's record, token count and owner are unmoved.
    expect(asm.gateway.job('j1')).toHaveLength(1)
    expect(asm.gateway.job('j1')[0]!.ownerKey).toBe(jobOwnerKey(OWNER_A))
    expect(asm.gateway.job('j1')[0]!.state).toBe('leased')
    expect(asm.lease.outstanding()).toHaveLength(1)
    // Same member re-admitting is just a duplicate — never a conflict alarm.
    const dup = asm.admitTeamJob({ jobId: 'j1', owner: OWNER_A, scopeKey: 'agent:wa', toolName: 'tool-x' })
    expect(!dup.ok && dup.code === 'duplicate-job').toBe(true)
  })

  it('member B cannot read A\'s job: typed refusal, no owner-identity echo', () => {
    const { asm } = twoMemberWorld()
    asm.definitions.register('agent:wa', 'tool-x', 'tool-x@v1')
    asm.admitTeamJob({ jobId: 'j1', owner: OWNER_A, scopeKey: 'agent:wa', toolName: 'tool-x' })
    const denied = asm.gateway.projectFor(OWNER_B, 'j1')
    expect(denied.ok).toBe(false)
    if (!denied.ok) {
      expect(denied.code).toBe('owner-mismatch')
      expect(denied.detail).not.toContain('inst-1')
      expect(denied.detail).not.toContain(jobOwnerKey(OWNER_A))
    }
    expect(asm.gateway.projectFor(OWNER_A, 'j1').ok).toBe(true)
  })

  it('a non-durable claim and a cross-root claim both refuse owner-not-durable with ZERO delta', () => {
    const { asm, ledger } = twoMemberWorld()
    asm.definitions.register('agent:wa', 'tool-x', 'tool-x@v1')
    const ghost = asm.admitTeamJob({ jobId: 'j-ghost', owner: { rootSessionId: ROOT, instanceId: 'inst-ghost' }, scopeKey: 'agent:wa', toolName: 'tool-x' })
    expect(!ghost.ok && ghost.code === 'owner-not-durable').toBe(true)
    const crossRoot = asm.admitTeamJob({ jobId: 'j-foreign', owner: { rootSessionId: FOREIGN_ROOT, instanceId: 'inst-9' }, scopeKey: 'agent:wa', toolName: 'tool-x' })
    expect(!crossRoot.ok && crossRoot.code === 'owner-not-durable').toBe(true)
    expect(asm.gateway.job('j-ghost')).toHaveLength(0)
    expect(asm.gateway.job('j-foreign')).toHaveLength(0)
    expect(asm.lease.outstanding()).toHaveLength(0)
    // Both refusals happened BEFORE the lease: the window never moved.
    expect(asm.lease.state()).toBe('ACTIVE')
    expect(ledger.filter((e) => e === 'gateway-admit-identity-unconfirmed')).toHaveLength(2)
  })

  it('an unreadable repository vetoes every claim (row unreadable = not confirmed)', () => {
    const { asm } = twoMemberWorld({ explode: true })
    asm.definitions.register('agent:wa', 'tool-x', 'tool-x@v1')
    const refused = asm.admitTeamJob({ jobId: 'j1', owner: OWNER_A, scopeKey: 'agent:wa', toolName: 'tool-x' })
    expect(!refused.ok && refused.code === 'owner-not-durable').toBe(true)
    expect(asm.lease.outstanding()).toHaveLength(0)
  })
})

describe('a5p7 live row — row-local definition store (closed world) and teardown', () => {
  it('empty store: a pin-less admit refuses mapping-rejected with zero registration', () => {
    const { asm, ledger } = twoMemberWorld()
    const refused = asm.admitTeamJob({ jobId: 'j1', owner: OWNER_A, scopeKey: 'agent:wa', toolName: 'never-registered' })
    expect(!refused.ok && refused.code === 'mapping-rejected').toBe(true)
    expect(refused.ok ? '' : refused.detail).toContain('never-registered')
    expect(asm.gateway.job('j1')).toHaveLength(0)
    expect(asm.lease.outstanding()).toHaveLength(0)
    expect(ledger).toContain('gateway-admit-definition-unreadable')
  })

  it('drain refuses new admits from the first instant; release needs the self-counted zero; giveUp ends release forever', () => {
    const { asm } = twoMemberWorld()
    asm.definitions.register('agent:wa', 'tool-x', 'tool-x@v1')
    asm.definitions.register('agent:wb', 'tool-x', 'tool-x@v1')
    asm.admitTeamJob({ jobId: 'j1', owner: OWNER_A, scopeKey: 'agent:wa', toolName: 'tool-x' })
    expect(asm.drain().ok).toBe(true)
    // B's claim is legitimate up to the door: identity confirmed, definition
    // readable — the DRAIN itself is what refuses it at the lease door.
    const late = asm.admitTeamJob({ jobId: 'j2', owner: OWNER_B, scopeKey: 'agent:wb', toolName: 'tool-x' })
    expect(!late.ok && late.code === 'gateway-not-active').toBe(true)
    expect(asm.gateway.job('j2')).toHaveLength(0)
    // Outstanding token blocks release: a promise returning is not evidence.
    const early = asm.release()
    expect(early.ok).toBe(false)
    // The plane settles j1 — but the settle CROSSes the drain edge, so the
    // token STANDS (PR1 Gate R4: a crossing settle is refused, not evidence).
    asm.gateway.observeDispatchEvent({ event: 'dispatcher-call-cancelled-before-body', callId: 'j1' })
    expect(asm.lease.outstanding().map((t) => t.callId)).toEqual(['j1'])
    expect(asm.release().ok).toBe(false)
    // Giving up is terminal: release refuses forever after it.
    expect(asm.giveUp('assembly teardown decided externally').ok).toBe(true)
    expect(asm.release().ok).toBe(false)
    expect(asm.lease.state()).toBe('GIVEN_UP')
  })

  it('a re-assembly after teardown gets a NEW window (the generation law)', () => {
    const { asm } = twoMemberWorld()
    expect(asm.drain().ok).toBe(true)
    expect(asm.release().ok).toBe(true)
    expect(asm.lease.state()).toBe('RELEASED')
    const { asm: second } = twoMemberWorld()
    expect(second.lease.state()).toBe('ACTIVE')
    expect(second.lease).not.toBe(asm.lease)
    // The old window stays closed to new leases; the second assembly drives its own.
    expect(asm.lease.state()).toBe('RELEASED')
  })
})

describe('a5p7 live row — C-BIND preemption through the row store (only its own job moves)', () => {
  it('a moved definition cancels exactly the jobs whose own identity moved', () => {
    const { asm, ledger } = twoMemberWorld()
    asm.definitions.register('agent:wa', 'tool-x', 'tool-x@v1')
    asm.definitions.register('agent:wb', 'tool-y', 'tool-y@v1')
    asm.admitTeamJob({ jobId: 'jx', owner: OWNER_A, scopeKey: 'agent:wa', toolName: 'tool-x' })
    asm.admitTeamJob({ jobId: 'jy', owner: OWNER_B, scopeKey: 'agent:wb', toolName: 'tool-y' })
    // Only tool-x moves (same scope/name, new identity).
    asm.definitions.register('agent:wa', 'tool-x', 'tool-x@v2')
    const cancelled = asm.gateway.onRegistryChange()
    expect(cancelled.map((c) => c.jobId)).toEqual(['jx'])
    expect(asm.gateway.job('jx')[0]!.cancelRequested).toBe(true)
    expect(asm.gateway.job('jy')[0]!.cancelRequested).toBe(false)
    expect(ledger).toContain('gateway-cancel-requested')
    // Attribution honesty: jx cancelled FOR its own moved definition (v1→v2).
    expect(cancelled[0]!.pinnedIdentity).toBe('tool-x@v1')
    expect(cancelled[0]!.currentIdentity).toBe('tool-x@v2')
  })

  it('an unreadable re-read is MOVED, never assumed unchanged (the R2b law on the jobs face)', () => {
    const { asm, ledger } = twoMemberWorld()
    asm.definitions.register('agent:wa', 'tool-x', 'tool-x@v1')
    asm.admitTeamJob({ jobId: 'jx', owner: OWNER_A, scopeKey: 'agent:wa', toolName: 'tool-x' })
    // A `tools/change` whose source cannot be read for THIS job: closed world.
    const cancelled = asm.gateway.onRegistryChange(() => ({ ok: false, identity: 'unreadable:withdrawn' }))
    expect(cancelled.map((c) => c.jobId)).toEqual(['jx'])
    expect(asm.gateway.job('jx')[0]!.cancelRequested).toBe(true)
    const alarm = asm.observations().find((o) => o.event === 'gateway-cancel-requested')
    expect(alarm).toBeDefined()
    expect(alarm!.reason).toBe('definition-unreadable')
    // The lease token stands: cancel is a REQUEST; only the plane settles it.
    expect(asm.lease.outstanding().map((t) => t.callId)).toEqual(['jx'])
    expect(ledger).toContain('gateway-cancel-requested')
  })

  it('explicit caller pins stay the fixture shape — recorded, not silently widened', () => {
    // Disclosure pin for the matrix: the row-local empty store refuses
    // PIN-LESS admits, while an explicit `pinnedIdentity` passes through
    // verbatim (gateway fixture shape, pc-CONTRACT §1 row 3). This test
    // exists so the shape cannot silently change into either direction —
    // production today has no caller that could use it (the actuator leg is
    // the disclosed gap); when the host seam lands, this pin forces an
    // explicit decision instead of a drift.
    const { asm } = twoMemberWorld()
    const took = asm.admitTeamJob({ jobId: 'j-pin', owner: OWNER_A, scopeKey: 'agent:wa', toolName: 'tool-x', pinnedIdentity: 'caller-declared@v1' })
    expect(took.ok).toBe(true)
    if (took.ok) expect(took.job.pinnedIdentity).toBe('caller-declared@v1')
    // The C-BIND re-read still runs through the row store: an unreadable
    // re-read treats this job's definition as moved ⇒ it is cancelled.
    const cancelled = asm.gateway.onRegistryChange(() => ({ ok: false, identity: 'unreadable:x' }))
    expect(cancelled.map((c) => c.jobId)).toEqual(['j-pin'])
  })
})
