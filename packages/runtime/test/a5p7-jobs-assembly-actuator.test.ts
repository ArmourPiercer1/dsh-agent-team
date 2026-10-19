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
import { afterAll, describe, expect, it } from 'vitest'

// ROOT-close(3) (root 10:0xZ risk order): PROCESS-LEVEL collection - returning
// green text is NOT the bar; an unconsumed rejected promise (early-return
// paths of the abort race) must not exist at all. Registered at import time,
// before any test body runs; asserted zero-hit by the LAST test of this file
// and removed in afterAll so nothing leaks to sibling suites in the worker.
const processSmell: string[] = []
const onUnhandled = (reason: unknown) => processSmell.push(`unhandledRejection: ${String((reason as Error)?.message ?? reason)}`)
const onUncaught = (error: Error) => processSmell.push(`uncaughtException: ${String(error?.message ?? error)}`)
// the node-min ambient 'process' const is a typed shim (cwd/stderr only);
// the REAL runner process object lives on globalThis - typed locally here,
// zero new ambient vocabulary.
const proc = (globalThis as unknown as {
  process: { on: (event: string, listener: (arg: never) => void) => void; off: (event: string, listener: (arg: never) => void) => void }
}).process
proc.on('unhandledRejection', onUnhandled as (arg: never) => void)
proc.on('uncaughtException', onUncaught as (arg: never) => void)
afterAll(() => {
  proc.off('unhandledRejection', onUnhandled as (arg: never) => void)
  proc.off('uncaughtException', onUncaught as (arg: never) => void)
})
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
  const jobs = new Map<string, { ownerSession: string; killed: boolean; finished: boolean }>()
  const calls: string[] = []
  const waiters = new Map<string, () => void>()
  const listeners = new Map<string, () => void>()
  return {
    calls,
    seed: (jobId: string, ownerSession: string) => jobs.set(jobId, { ownerSession, killed: false, finished: false }),
    /** The SETTLING EDGE standing in for async process death after a kill
     *  request (host law: wait resolves at the terminal state, never at the
     *  request). ROOT④ boundary construction. */
    settleWait: (jobId: string) => {
      const w = waiters.get(jobId)
      if (w === undefined) return
      waiters.delete(jobId)
      listeners.delete(jobId)
      const j = jobs.get(jobId)
      if (j !== undefined) j.finished = true
      w()
    },
    list: (caller?: string) => {
      calls.push(`list:${caller ?? '*'}`)
      return [...jobs.entries()]
        .filter(([, j]) => caller === undefined || j.ownerSession === caller)
        .map(([id, j]) => ({ id, kind: 'bash', status: j.finished ? (j.killed ? 'killed' : 'completed') : 'running', label: 'background command' }))
    },
    /** The host's OWN public signature `wait(id, timeoutMs, caller?, signal?)`
     *  @639ed01539 (ROOT④b): settles at the timeout, early-resolves via
     *  settleWait, and HONOURS the signal (the service-side arm; the bridge
     *  races it too - belt AND braces, both arms measured). */
    wait: (id: string, timeoutMs: number, caller?: string, signal?: AbortSignal) => {
      calls.push(`wait:${id}:${caller ?? '*'}`)
      const j = jobs.get(id)
      if (j === undefined) throw new Error('unknown job')
      if (caller !== undefined && j.ownerSession !== caller) throw new Error('job belongs to another session')
      return new Promise<void>((resolve, reject) => {
        if (signal?.aborted === true) { reject(new Error('wait aborted (service arm, pre)')); return }
        const timer = setTimeout(() => { waiters.delete(id); listeners.delete(id); resolve() }, timeoutMs)
        waiters.set(id, () => { clearTimeout(timer); resolve() })
        if (signal !== undefined && signal !== null) {
          const onAbort = () => {
            clearTimeout(timer)
            waiters.delete(id)
            listeners.delete(id)
            reject(new Error('wait aborted (service arm)'))
          }
          listeners.set(id, onAbort)
          signal.addEventListener('abort', onAbort, { once: true })
        }
      })
    },
    readAt: (id: string, caller?: string) => {
      calls.push(`readAt:${id}:${caller ?? '*'}`)
      const j = jobs.get(id)
      if (j === undefined) throw new Error('unknown job')
      if (caller !== undefined && j.ownerSession !== caller) throw new Error('job belongs to another session')
      return 'output-bytes'
    },
    read: (id: string, caller?: string) => {
      calls.push(`read:${id}:${caller ?? '*'}`)
      const j = jobs.get(id)
      if (j === undefined) throw new Error('unknown job')
      if (caller !== undefined && j.ownerSession !== caller) throw new Error('job belongs to another session')
      return {
        chunks: [{ at: 0, text: 'output-bytes' }],
        lossy: false,
        ...(j.finished ? { result: j.killed ? '(job cancelled by request)' : '(job completed)' } : {}),
      }
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

  it('the ASSEMBLY row for list stays a pure per-job owner read (review ROOT① re-home: the per-ROW list law lives at the BRIDGE — see the C2 shared-caller negative control; the former pin of this line predated the review and is superseded)', () => {
    // This pin now covers what the assembly level can honestly say: the
    // owner fence answers PER jobId; it names no job it cannot see. The
    // bridge APPLIES it per row over the host's caller-scoped list.
    const asm = world()
    const host = fakeJobRegistry()
    host.seed('jb1', 'session-of-A')
    host.seed('jb2', 'session-of-B')
    expect(host.list('session-of-A').map((j: { id: string }) => j.id)).toEqual(['jb1'])
    expect(host.list('session-of-B').map((j: { id: string }) => j.id)).toEqual(['jb2'])
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

// ── C2: the plane row + the governed bridge (the mount-level proof) ──────
const planeRow = (await import(
  new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href
)) as {
  createTeamToolPlaneAssembly: (input: Record<string, unknown>) =>
    | { ok: true; value: {
        ownNames: readonly string[]
        placementNames: readonly string[]
        placementFeed: (name: string) => { definitionIdentity: string; realmId: string } | undefined
        definitions: ReadonlyArray<{ name: string; execute?: (args: unknown, exec?: { agent?: { id?: string }; signal?: AbortSignal }) => Promise<{ text: string }> }>
      } }
    | { ok: false; code: string; message: string }
}
const backendsRow = (await import(
  new URL('../src/plugin/live/plane-effect-backends.mjs', import.meta.url).href
)) as { createGovernedJobsBridge: (input: Record<string, unknown>) => unknown }

const PLANE_POLICY = Object.freeze({ default: 'ask', allow: [], ask: [], deny: [] })
const planeBase = { permissionPolicy: PLANE_POLICY, realmId: 'realm-jobs', templateId: 'tpl-1', role: 'member', instanceId: 'inst-1' }

describe('a5p7 C2 plane row — the fixed jobs trio behind the closed key', () => {
  it('key ABSENT mounts no job row at all (the zero-flip law by absence)', () => {
    const built = planeRow.createTeamToolPlaneAssembly({ ...planeBase })
    expect(built.ok).toBe(true)
    if (built.ok) expect(built.value.ownNames.filter((n) => n.startsWith('job_'))).toEqual([])
  })

  it('a non-boolean key is a config defect: the mount refuses typed, never defaults', () => {
    const built = planeRow.createTeamToolPlaneAssembly({ ...planeBase, plane: { jobsEnabled: 'yes' } })
    expect(!built.ok && built.code).toBe('PLANE_CONFIG_INCOMPLETE')
  })

  it('enabled WITHOUT a bridge lands the trio on the honest typed shut face (config is law, not wiring)', async () => {
    const built = planeRow.createTeamToolPlaneAssembly({ ...planeBase, plane: { jobsEnabled: true } })
    expect(built.ok).toBe(true)
    if (!built.ok) return
    const trio = ['job_output', 'job_list', 'job_kill']
    expect(built.value.ownNames.filter((n) => n.startsWith('job_')).sort()).toEqual([...trio].sort())
    const def = built.value.definitions.find((d) => d.name === 'job_kill')
    const r = await def!.execute!({ job_id: 'x' }, { agent: { id: 'agent-1' } })
    expect(r.text).toContain('IO_POLICY_UNSUPPORTED')
  })

  it('enabled WITH the real bridge: placement feed covers the trio and the dispatch caller (exec.agent.id) flows to the fence', async () => {
    const asm = world()
    const host = fakeJobRegistry()
    host.seed('jb1', 'agent-of-A')
    const plane = {
      placementFeed: (name: string) => ({ definitionIdentity: `${name}@v1`, realmId: 'realm-jobs' }),
    }
    const mkBridge = (viewer: JobOwner) => backendsRow.createGovernedJobsBridge({
      scopeKey: 'realm-jobs',
      viewer,
      gatewayRow: () => asm,
      planeRow: () => plane,
      jobsService: () => host,
    })
    const built = planeRow.createTeamToolPlaneAssembly({ ...planeBase, plane: { jobsEnabled: true }, backends: { jobs: mkBridge(OWNER_A) } })
    expect(built.ok).toBe(true)
    if (!built.ok) return
    // Member B's mount carries its OWN bridge with its OWN durable viewer —
    // one bridge, one member; the viewer is never taken from the call args.
    const builtB = planeRow.createTeamToolPlaneAssembly({ ...planeBase, plane: { jobsEnabled: true }, backends: { jobs: mkBridge(OWNER_B) } })
    expect(builtB.ok).toBe(true)
    if (!builtB.ok) return
    for (const n of ['job_output', 'job_list', 'job_kill']) expect(built.value.placementNames).toContain(n)
    // Creation attribution, then the mount-level owner fence END TO END.
    // The creating-lane pin rides the SAME store the bridge feeds lazily
    // (a future attribution producer calls bridge.ensureRegistered() first;
    // here the registration stands in for that hook having run — same
    // store, same law, no privileged path).
    asm.definitions.register('realm-jobs', 'bash', 'bash@v1')
    expect(asm.attributeBackgroundJob({ hostJobId: 'jb1', owner: OWNER_A, scopeKey: 'realm-jobs' }).ok).toBe(true)
    const outputDef = built.value.definitions.find((d) => d.name === 'job_output')!
    const outputDefB = builtB.value.definitions.find((d) => d.name === 'job_output')!
    const denied = await outputDefB.execute!({ job_id: 'jb1' }, { agent: { id: 'agent-of-B' } })
    expect(denied.text).toContain('owner-mismatch')
    expect(host.calls).toEqual([]) // the team refusal never touched the host
    expect(denied.text).not.toContain('inst-1') // static detail, no owner echo
    const granted = await outputDef.execute!({ job_id: 'jb1' }, { agent: { id: 'agent-of-A' } })
    expect(granted.text).toBe('output-bytes')
    expect(host.calls).toEqual(['read:jb1:agent-of-A']) // the caller the DISPATCH named
    const killDef = built.value.definitions.find((d) => d.name === 'job_kill')!
    const killed = await killDef.execute!({ job_id: 'jb1', reason: 'done' }, { agent: { id: 'agent-of-A' } })
    expect(killed.text).toBe('requested cancellation of job jb1')
    expect(asm.gateway.job('jb1')[0]!.cancelRequested).toBe(true) // requested, NOT settled
    const listDef = built.value.definitions.find((d) => d.name === 'job_list')!
    const listed = await listDef.execute!({}, { agent: { id: 'agent-of-A' } })
    expect(listed.text).toContain('jb1')
  })

  it('an unnamed caller is refused — the bridge never queries the host unfiltered', async () => {
    const asm = world()
    const host = fakeJobRegistry()
    const bridge = backendsRow.createGovernedJobsBridge({
      scopeKey: 'realm-jobs', viewer: OWNER_A, gatewayRow: () => asm, planeRow: () => null, jobsService: () => host,
    }) as { jobList: (caller: unknown) => Promise<{ text: string }> }
    const r = await bridge.jobList(undefined)
    expect(r.text).toContain('caller-unresolved')
    expect(host.calls).toEqual([])
  })

  it('no gateway row mounted = typed refusal, the host face untouched', async () => {
    const host = fakeJobRegistry()
    host.seed('legacy', 'agent-x')
    const bridge = backendsRow.createGovernedJobsBridge({
      scopeKey: 'realm-jobs', viewer: OWNER_A, gatewayRow: () => null, planeRow: () => null, jobsService: () => host,
    }) as { jobOutput: (a: unknown, c: unknown) => Promise<{ text: string }> }
    const r = await bridge.jobOutput({ job_id: 'legacy' }, 'agent-x')
    expect(r.text).toContain('gateway-not-active')
    expect(host.calls).toEqual([])
  })

  // ── review ROOT① ③ ④ (round B): the measured answers, not assertions ────

  type BridgeFace = {
    jobList: (caller: string) => Promise<{ text: string }>
    jobOutput: (a: Record<string, unknown>, c: string, s?: AbortSignal) => Promise<{ text: string }>
    jobKill: (a: Record<string, unknown>, c: string) => Promise<{ text: string }>
    ensureRegistered: () => void
  }
  const mkRawBridge = (asm: ActuatorAssembly, host: ReturnType<typeof fakeJobRegistry>, viewer: JobOwner, plane: unknown = null): BridgeFace =>
    backendsRow.createGovernedJobsBridge({
      scopeKey: 'realm-jobs', viewer, gatewayRow: () => asm, planeRow: () => plane, jobsService: () => host,
    }) as BridgeFace

  it('ROOT① NEGATIVE CONTROL (same caller, two members): job_list hides a row attributed to the FOREIGN member and shows the unattributed ones — the Team layer speaks per row even where the host caller fence cannot tell members apart', async () => {
    const asm = world()
    const host = fakeJobRegistry()
    host.seed('jb-team', 'caller-shared') // host-owned by the SHARED caller, team-attributed to A
    host.seed('jb-legacy', 'caller-shared') // no team record at all
    asm.definitions.register('realm-jobs', 'bash', 'bash@v1')
    expect(asm.attributeBackgroundJob({ hostJobId: 'jb-team', owner: OWNER_A, scopeKey: 'realm-jobs' }).ok).toBe(true)
    const a = await mkRawBridge(asm, host, OWNER_A).jobList('caller-shared')
    const b = await mkRawBridge(asm, host, OWNER_B).jobList('caller-shared')
    expect(a.text).toContain('jb-team')
    expect(a.text).toContain('jb-legacy')
    expect(b.text).not.toContain('jb-team') // HIDDEN, not echoed: the row is not named at all
    expect(b.text).not.toContain('owner-mismatch') // silent decline, no owner identity leak (C-GW)
    expect(b.text).toContain('jb-legacy') // corded:false host jurisdiction passes, disclosed
    expect(host.calls).toEqual(['list:caller-shared', 'list:caller-shared']) // ONE host query per bridge
  })

  it('ROOT③ REPLACEMENT SHAPE: a MOVED lane definition re-registers (no stale pin) and the next admit pins the MOVED identity; the management path consumed no definition gate before or after', async () => {
    const asm = world()
    const host = fakeJobRegistry()
    let bashIdentity = 'bash@v1'
    const plane = { placementFeed: (name: string) => ({ definitionIdentity: name === 'bash' ? bashIdentity : `${name}@v1`, realmId: 'realm-jobs' }) }
    const bridge = mkRawBridge(asm, host, OWNER_A, plane)
    host.seed('jb1', 'caller-1')
    await bridge.jobList('caller-1') // the lazy first-use registration
    const t1 = asm.attributeBackgroundJob({ hostJobId: 'jb1', owner: OWNER_A, scopeKey: 'realm-jobs' })
    expect(t1.ok === true && t1.job.pinnedIdentity).toBe('bash@v1')
    // A REPLACED lane (definition swap / remount): the feed now mints a NEW identity.
    bashIdentity = 'bash@v2-replacement'
    bridge.ensureRegistered()
    host.seed('jb2', 'caller-1')
    const t2 = asm.attributeBackgroundJob({ hostJobId: 'jb2', owner: OWNER_A, scopeKey: 'realm-jobs' })
    expect(t2.ok === true && t2.job.pinnedIdentity).toBe('bash@v2-replacement') // the stale pin is GONE
    // The honest half of the answer: checkManagementAccess consults ONLY the
    // owner law (assembly code: records + jobOwnerKey), never the definition
    // store — a stale pin could only ever mislead ADMISSIONS, and admissions
    // now track the moved definition (the C-BIND re-read law).
    const read = await bridge.jobOutput({ job_id: 'jb2' }, 'caller-1')
    expect(read.text).toBe('output-bytes')
  })

  it('ROOT④ wait boundary: kill DURING a pending wait — the wait resolves at the SETTLING edge, the read answers the TERMINAL shape, and the kill request stays a request (lease token outstanding)', async () => {
    const asm = world()
    const host = fakeJobRegistry()
    host.seed('jb1', 'agent-of-A')
    asm.definitions.register('realm-jobs', 'bash', 'bash@v1')
    expect(asm.attributeBackgroundJob({ hostJobId: 'jb1', owner: OWNER_A, scopeKey: 'realm-jobs' }).ok).toBe(true)
    const bridge = mkRawBridge(asm, host, OWNER_A)
    const pending = bridge.jobOutput({ job_id: 'jb1', wait: true }, 'agent-of-A')
    await Promise.resolve()
    expect(host.calls).toEqual(['wait:jb1:agent-of-A']) // parked in the wait, read NOT reached
    const killed = await bridge.jobKill({ job_id: 'jb1' }, 'agent-of-A')
    expect(killed.text).toBe('requested cancellation of job jb1')
    expect(asm.gateway.job('jb1')[0]!.cancelRequested).toBe(true)
    // The SETTLING EDGE (async process death AFTER the request) resolves the wait:
    host.settleWait('jb1')
    const read = await pending
    expect(read.text).toContain('output-bytes')
    expect(read.text).toContain('(job cancelled by request)') // TERMINAL shape visible, not invented pre-edge
    expect(host.calls).toEqual(['wait:jb1:agent-of-A', 'kill:jb1:agent-of-A', 'read:jb1:agent-of-A'])
    // Request ≠ settlement (PR1 Gate R4): the token stands until the plane's settle event.
    expect(asm.gateway.lease.outstanding().map((t) => t.callId)).toEqual(['jb1'])
  })

  // ── ROOT④b (root ruling option a): the abort-forward matrix. Driven through
  // the PLANE ROW definition (exec?.signal forwarding proven at :774, not
  // just the bridge), every leg asserts the ③ pair: svc.read call count 0
  // and zero output bytes in the returned text.
  function abortWorld(viewer: JobOwner) {
    const asm = world()
    const host = fakeJobRegistry()
    host.seed('jb1', 'agent-of-A')
    asm.definitions.register('realm-jobs', 'bash', 'bash@v1')
    expect(asm.attributeBackgroundJob({ hostJobId: 'jb1', owner: viewer, scopeKey: 'realm-jobs' }).ok).toBe(true)
    const bridge = mkRawBridge(asm, host, viewer)
    const built = planeRow.createTeamToolPlaneAssembly({ ...planeBase, plane: { jobsEnabled: true }, backends: { jobs: bridge } })
    expect(built.ok).toBe(true)
    if (!built.ok) throw new Error('unreachable')
    const def = built.value.definitions.find((d) => d.name === 'job_output')!
    return { asm, host, def }
  }
  const noRead = (host: ReturnType<typeof fakeJobRegistry>) =>
    expect(host.calls.filter((c) => c.startsWith('read:'))).toEqual([])

  it('ROOT④b-②a PRE-CANCELLED: a signal already aborted at execute entry never touches svc.wait (host calls ZERO), typed wait-aborted carries a BOUNDED slice of the string reason (200-char envelope cap)', async () => {
    const { host, def } = abortWorld(OWNER_A)
    const ac = new AbortController()
    ac.abort('caller-cancel-pre')
    const r = await def.execute!({ job_id: 'jb1', wait: true }, { agent: { id: 'agent-of-A' }, signal: ac.signal })
    expect(r.text).toContain('wait-aborted')
    expect(r.text).toContain('caller-cancel-pre') // ⑤ reason fidelity, bounded (string form)
    expect(host.calls).toEqual([]) // svc.wait NEVER entered, read ③ zero
    expect(r.text).not.toContain('output-bytes') // ③ no leak
  })

  it('ROOT④b-②b MID-SUSPENSION: abort while the wait is parked → typed wait-aborted with the reason; wait entered ONCE, svc.read call count 0, zero bytes', async () => {
    const { host, def } = abortWorld(OWNER_A)
    const ac = new AbortController()
    const pending = def.execute!({ job_id: 'jb1', wait: true, timeout_ms: 5000 }, { agent: { id: 'agent-of-A' }, signal: ac.signal })
    await Promise.resolve()
    expect(host.calls).toEqual(['wait:jb1:agent-of-A']) // parked
    ac.abort('caller-cancel-mid')
    const r = await pending
    expect(r.text).toContain('wait-aborted')
    expect(r.text).toContain('caller-cancel-mid') // ⑤
    noRead(host) // ③
    expect(r.text).not.toContain('output-bytes')
  })

  it('ROOT④b-②c RACE AT SETTLE: the settling edge fires and the abort lands before the re-check → the read leg is NEVER reached (re-check BEFORE read is the arm that holds)', async () => {
    const { host, def } = abortWorld(OWNER_A)
    const ac = new AbortController()
    const pending = def.execute!({ job_id: 'jb1', wait: true, timeout_ms: 5000 }, { agent: { id: 'agent-of-A' }, signal: ac.signal })
    await Promise.resolve()
    host.settleWait('jb1') // wait resolves (job now terminal)...
    ac.abort('race-at-settle') // ...and the abort lands in the same tick, before any read
    const r = await pending
    expect(r.text).toContain('wait-aborted')
    expect(r.text).toContain('race-at-settle') // ⑤
    noRead(host) // ③ even though the job IS terminal now, the aborted call never reads
    expect(r.text).not.toContain('output-bytes')
  })

  it('ROOT④b-② DEFINITION-REPLACEMENT/UNLOAD abort shape: an Error-reason abort (what the plane mints when the lane definition moves under the call) answers typed with a BOUNDED slice of the CAUSE message (no full-object fidelity claimed), read ③ zero', async () => {
    const { host, def } = abortWorld(OWNER_A)
    const ac = new AbortController()
    const pending = def.execute!({ job_id: 'jb1', wait: true, timeout_ms: 5000 }, { agent: { id: 'agent-of-A' }, signal: ac.signal })
    await Promise.resolve()
    ac.abort(new Error('definition-moved: replaced under this call'))
    const r = await pending
    expect(r.text).toContain('wait-aborted')
    expect(r.text).toContain('definition-moved: replaced under this call') // ⑤ Error.message form, bounded slice (wording narrowed per root: no verbatim/identity claim)
    noRead(host)
    expect(r.text).not.toContain('output-bytes')
  })

  it('ROOT④b-④ POSITIVE CONTROLS, no regression: an UN-aborted timed-out wait still READS (the old timed-out→read law, host semantics untouched)', async () => {
    const { host, def } = abortWorld(OWNER_A)
    const r = await def.execute!({ job_id: 'jb1', wait: true, timeout_ms: 5 }, { agent: { id: 'agent-of-A' }, signal: new AbortController().signal })
    expect(r.text).toBe('output-bytes') // timeout expired, job still running: bytes, no result tail
    expect(host.calls).toEqual(['wait:jb1:agent-of-A', 'read:jb1:agent-of-A'])
    // and the killed-then-readable host law (pinned at ROOT④ above) rides the SAME un-aborted path — the
    // ROOT④ test IS that control and must stay green with this suite.
  })

  it('ROOT-close(1) NO-LOST-EVENT race: an abort fired SYNCHRONOUSLY inside the svc.wait call (service returns a NEVER-SETTLING promise) cannot outrun the listener nor hang the race — listener goes in FIRST, post-call re-check answers typed; svc.read count 0', async () => {
    const asm = world()
    const host = fakeJobRegistry()
    host.seed('jb1', 'caller-1')
    asm.definitions.register('realm-jobs', 'bash', 'bash@v1')
    expect(asm.attributeBackgroundJob({ hostJobId: 'jb1', owner: OWNER_A, scopeKey: 'realm-jobs' }).ok).toBe(true)
    const ac = new AbortController()
    const svc = {
      ...host,
      wait: (id: string, _ms: number, caller?: string) => {
        host.calls.push(`wait:${id}:${caller ?? '*'}`)
        ac.abort('sync-abort-inside-wait') // the hostile shape: abort DURING the call, before any listener could be armed after it
        return new Promise<void>(() => {}) // and a promise that NEVER settles
      },
    }
    const bridge = backendsRow.createGovernedJobsBridge({
      scopeKey: 'realm-jobs', viewer: OWNER_A, gatewayRow: () => asm, planeRow: () => null, jobsService: () => svc,
    }) as BridgeFace
    const r = await bridge.jobOutput({ job_id: 'jb1', wait: true, timeout_ms: 5000 }, 'caller-1', ac.signal)
    expect(r.text).toContain('wait-aborted')
    expect(r.text).toContain('sync-abort-inside-wait') // bounded reason slice
    expect(host.calls).toEqual(['wait:jb1:caller-1']) // never settled, NEVER read — and the test itself PROVES non-hang by returning
  })

  it('ROOT-close(2) SAME CANCELLATION CONTRACT ON THE NO-WAIT ARM: a pre-cancelled no-wait call never reaches svc.read (typed, bounded reason, zero bytes); the un-aborted no-wait read stays as before (positive control, same world)', async () => {
    const { host, def } = abortWorld(OWNER_A)
    const ac = new AbortController()
    ac.abort('pre-cancel-no-wait')
    const r = await def.execute!({ job_id: 'jb1' }, { agent: { id: 'agent-of-A' }, signal: ac.signal })
    expect(r.text).toContain('wait-aborted') // one contract, both arms (typed code stays stable vocabulary)
    expect(r.text).toContain('pre-cancel-no-wait')
    expect(r.text).not.toContain('output-bytes')
    expect(host.calls).toEqual([]) // read count ZERO on the no-wait arm too
    const fresh = await def.execute!({ job_id: 'jb1' }, { agent: { id: 'agent-of-A' }, signal: new AbortController().signal })
    expect(fresh.text).toBe('output-bytes') // un-aborted no-wait reads exactly as before
    expect(host.calls).toEqual(['read:jb1:agent-of-A'])
  })
})


describe('a5p7 process hygiene (ROOT④b-close(3), root risk order)', () => {
  it('zero process-level unhandledRejection/uncaughtException across EVERY leg of this file (the unconsumed-rejection shape must not exist)', async () => {
    // one macrotask of settle so any late-reporting rejection surfaces first
    await new Promise((r) => setTimeout(r, 50))
    expect(processSmell).toEqual([])
  })
})
