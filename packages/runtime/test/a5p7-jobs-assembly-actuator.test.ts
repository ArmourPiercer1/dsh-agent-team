/**
 * a5p7-jobs-assembly-actuator.test.ts — the actuator-shape legs of the live
 * row (B-ACT-1-PR C1): creation attribution, the management-path owner fence,
 * and the host's `kill → 'requested'` shape landing as CANCEL REQUESTED, never
 * as a settlement. Semantics unchanged (PR7 row verbatim: job_output/list/kill
 * 的执行身份、Job Owner、创建时 Grant/ExecutionLease、Cancel requested vs
 * terminated、跨 Member 输出隔离；两层 fence 各自独立):
 *
 *  - creation attribution pins the CREATING lane's definition (bash) — the
 *    C-BIND re-read tracks the definition the job was born under;
 *  - a management call against NO team record is a disclosed pass-through to
 *    the host's caller-session fence (`corded:false`): Team never invents
 *    ownership after the fact;
 *  - the Team-layer owner-mismatch stands on its own — the host layer is not
 *    consulted, not emulated, not credited (the fake registry below counts
 *    every touched call so the non-reach is MEASURED, not asserted);
 *  - `noteKillRequested` marks the request; the lease token stands until the
 *    plane's settlement edge (cancel ≠ terminated, PR1 Gate R4 shape).
 *
 * @module test/a5p7-jobs-assembly-actuator
 */
import { describe, expect, it } from 'vitest'
import { jobOwnerKey } from '../jobs-gateway/index.js'
import type { GatewayJobRecord, JobOwner } from '../jobs-gateway/index.js'

type ActuatorAssembly = {
  gateway: {
    job: (jobId: string) => readonly GatewayJobRecord[]
    lease: { outstanding: () => readonly { callId: string }[]; state: () => string }
    observeDispatchEvent: (event: { event: string; callId: string }) => { ok: boolean }
  }
  admitTeamJob: (input: { jobId: string; owner: JobOwner; scopeKey: string; toolName: string }) => { ok: boolean }
  attributeBackgroundJob: (input: { hostJobId: string; owner: JobOwner; scopeKey: string; toolName?: string }) =>
    { ok: true; job: GatewayJobRecord } | { ok: false; code: string; detail: string }
  checkManagementAccess: (input: { jobId: string; viewer: JobOwner }) =>
    | { ok: true; corded: true; record: GatewayJobRecord }
    | { ok: true; corded: false; record: null }
    | { ok: false; code: string; detail: string }
  noteKillRequested: (jobId: string) => { ok: true } | { ok: false; code: string }
  definitions: { register: (scopeKey: string, name: string, identity: string) => void }
  drain: () => { ok: boolean }
  release: () => { ok: boolean }
}

const row = (await import(
  new URL('../src/plugin/live/jobs-gateway-assembly.mjs', import.meta.url).href
)) as { createLiveJobsGatewayAssembly: (opts: { teamRoot: unknown; rootSessionId: string }) => ActuatorAssembly }

const ROOT = 'root-act'
const OWNER_A: JobOwner = { rootSessionId: ROOT, instanceId: 'inst-1' }
const OWNER_B: JobOwner = { rootSessionId: ROOT, instanceId: 'inst-2' }

function world() {
  const domain = {
    repositories: {
      memberInstances: {
        list: (rootKey: string) =>
          rootKey === ROOT ? [{ instanceId: 'inst-1' }, { instanceId: 'inst-2' }] : [],
      },
    },
  }
  const asm = row.createLiveJobsGatewayAssembly({ teamRoot: domain, rootSessionId: ROOT })
  // The mount-time registration the C2 glue will do from the placement feed:
  // the creating lane's definition identity is readable ⇒ attribution admits.
  asm.definitions.register('agent:wa', 'bash', 'bash@v1')
  asm.definitions.register('agent:wb', 'bash', 'bash@v1')
  return asm
}

/** A minimal stand-in for the host public face (`ctx.get('jobs')`,
 *  JobRegistry @639ed01539): caller-scoped list/read/kill, kill answers the
 *  two native forms, and EVERY touched call is counted so the non-reach of
 *  the host layer under a team refusal is measured. */
function fakeJobRegistry() {
  const jobs = new Map<string, { ownerSession: string; killed: boolean }>()
  const calls: string[] = []
  return {
    calls,
    seed: (jobId: string, ownerSession: string) => jobs.set(jobId, { ownerSession, killed: false }),
    list: (caller?: string) => {
      calls.push(`list:${caller ?? '*'}`)
      return [...jobs.entries()].filter(([, j]) => caller === undefined || j.ownerSession === caller).map(([id]) => id)
    },
    readAt: (id: string, caller?: string) => {
      calls.push(`readAt:${id}:${caller ?? '*'}`)
      const j = jobs.get(id)
      if (j === undefined) throw new Error('unknown job')
      if (caller !== undefined && j.ownerSession !== caller) throw new Error('job belongs to another session')
      return 'output-bytes'
    },
    kill: (id: string, caller?: string): 'requested' | 'already-finished' => {
      calls.push(`kill:${id}:${caller ?? '*'}`)
      const j = jobs.get(id)
      if (j === undefined) throw new Error('unknown job')
      if (caller !== undefined && j.ownerSession !== caller) throw new Error('job belongs to another session')
      if (j.killed) return 'already-finished'
      j.killed = true
      return 'requested'
    },
  }
}

describe('a5p7 actuator — creation attribution (bash-lane pin)', () => {
  it('a bash-background receipt lands as a durable-attributed record pinned to the CREATING lane definition', () => {
    const asm = world()
    const took = asm.attributeBackgroundJob({ hostJobId: 'jb1', owner: OWNER_A, scopeKey: 'agent:wa' })
    expect(took.ok).toBe(true)
    if (took.ok) {
      expect(took.job.ownerKey).toBe(jobOwnerKey(OWNER_A))
      expect(took.job.toolName).toBe('bash')
      expect(took.job.pinnedIdentity).toBe('bash@v1')
    }
    expect(asm.gateway.lease.outstanding().map((t) => t.callId)).toEqual(['jb1'])
  })

  it('a cross-member attribution attempt on the SAME host jobId is the owner-mismatch alarm (never a swap)', () => {
    const asm = world()
    expect(asm.attributeBackgroundJob({ hostJobId: 'jb1', owner: OWNER_A, scopeKey: 'agent:wa' }).ok).toBe(true)
    const clash = asm.attributeBackgroundJob({ hostJobId: 'jb1', owner: OWNER_B, scopeKey: 'agent:wb' })
    expect(!clash.ok && clash.code === 'owner-mismatch').toBe(true)
    expect(asm.gateway.job('jb1')[0]!.ownerKey).toBe(jobOwnerKey(OWNER_A))
    expect(asm.gateway.lease.outstanding()).toHaveLength(1)
  })

  it('an unreadable creating-lane definition refuses attribution (closed world, zero delta)', () => {
    const asm = world()
    const refused = asm.attributeBackgroundJob({ hostJobId: 'jb2', owner: OWNER_A, scopeKey: 'agent:no-def' })
    expect(!refused.ok && refused.code === 'mapping-rejected').toBe(true)
    expect(asm.gateway.job('jb2')).toHaveLength(0)
    expect(asm.gateway.lease.outstanding()).toHaveLength(0)
  })
})

describe('a5p7 actuator — management-path owner fence (job_output/job_list/job_kill shape)', () => {
  it('owner check passes with the record; the cross-member check refuses WITHOUT any host touch', () => {
    const asm = world()
    const host = fakeJobRegistry()
    host.seed('jb1', 'session-of-A')
    asm.attributeBackgroundJob({ hostJobId: 'jb1', owner: OWNER_A, scopeKey: 'agent:wa' })
    const mine = asm.checkManagementAccess({ jobId: 'jb1', viewer: OWNER_A })
    expect(mine.ok === true && mine.corded === true && mine.record?.jobId).toBe('jb1')
    const theirs = asm.checkManagementAccess({ jobId: 'jb1', viewer: OWNER_B })
    expect(theirs.ok === false && theirs.code === 'owner-mismatch').toBe(true)
    if (!theirs.ok) expect(theirs.detail).not.toContain('inst-1')
    // The refusal stands alone: nothing below the fence was consulted.
    expect(host.calls).toHaveLength(0)
  })

  it('a job with NO team record passes corded:false — disclosed host-layer jurisdiction, no invented ownership', () => {
    const asm = world()
    const host = fakeJobRegistry()
    host.seed('legacy1', 'session-x')
    const pre = asm.checkManagementAccess({ jobId: 'legacy1', viewer: OWNER_A })
    expect(pre.ok === true && pre.corded === false && pre.record).toBe(null)
    // The host layer then does its OWN caller fence (both layers stay honest):
    expect(() => host.readAt('legacy1', 'session-of-A')).toThrow('belongs to another session')
    expect(host.readAt('legacy1', 'session-x')).toBe('output-bytes')
    expect(host.calls.length).toBeGreaterThan(0)
  })

  it('job_list stays a pure identity read: it consults no record and refuses nobody it cannot see', () => {
    // LIST has no jobId: the Team layer contributes only the caller identity
    // it hands the host (`list(caller)`); this pin keeps the fence from
    // inventing a per-job gate where no job is named.
    const asm = world()
    const host = fakeJobRegistry()
    host.seed('jb1', 'session-of-A')
    host.seed('jb2', 'session-of-B')
    expect(host.list('session-of-A')).toEqual(['jb1'])
    expect(host.list('session-of-B')).toEqual(['jb2'])
    // Team-layer records are visible to their owner only, exactly as above.
    asm.attributeBackgroundJob({ hostJobId: 'jb1', owner: OWNER_A, scopeKey: 'agent:wa' })
    const okA = asm.checkManagementAccess({ jobId: 'jb1', viewer: OWNER_A })
    const noB = asm.checkManagementAccess({ jobId: 'jb1', viewer: OWNER_B })
    expect(okA.ok === true && okA.corded === true).toBe(true)
    expect(noB.ok === false).toBe(true)
  })
})

describe('a5p7 actuator — kill is a REQUEST (the two native forms never collapse)', () => {
  it('kill → requested marks cancelRequested and keeps the lease token outstanding', () => {
    const asm = world()
    const host = fakeJobRegistry()
    host.seed('jb1', 'session-of-A')
    asm.attributeBackgroundJob({ hostJobId: 'jb1', owner: OWNER_A, scopeKey: 'agent:wa' })
    const gate = asm.checkManagementAccess({ jobId: 'jb1', viewer: OWNER_A })
    expect(gate.ok === true && gate.corded === true).toBe(true)
    expect(host.kill('jb1', 'session-of-A')).toBe('requested')
    expect(asm.noteKillRequested('jb1').ok).toBe(true)
    expect(asm.gateway.job('jb1')[0]!.cancelRequested).toBe(true)
    // Cancel requested ≠ terminated: the token stands until the settle edge.
    expect(asm.gateway.lease.outstanding().map((t) => t.callId)).toEqual(['jb1'])
    // The settle edge (the plane says the body died) releases it.
    asm.gateway.observeDispatchEvent({ event: 'dispatcher-call-terminated-after-body-start', callId: 'jb1' })
    expect(asm.gateway.lease.outstanding()).toHaveLength(0)
    // Release needs the completed drain AND the self-counted zero (the window's
    // own law — the kill request alone never opens the release door).
    expect(asm.drain().ok).toBe(true)
    expect(asm.release().ok).toBe(true)
  })

  it('kill → already-finished settles nothing new; an unknown job is typed, not invented', () => {
    const asm = world()
    const host = fakeJobRegistry()
    host.seed('jb1', 'session-of-A')
    asm.attributeBackgroundJob({ hostJobId: 'jb1', owner: OWNER_A, scopeKey: 'agent:wa' })
    host.kill('jb1', 'session-of-A')
    expect(host.kill('jb1', 'session-of-A')).toBe('already-finished')
    const unknown = asm.noteKillRequested('never-admitted')
    expect(unknown.ok === false && unknown.code === 'unknown-job').toBe(true)
    expect(asm.checkManagementAccess({ jobId: 'never-admitted', viewer: OWNER_A }).ok).toBe(true) // corded pass-through
  })
})
