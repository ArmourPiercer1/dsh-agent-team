/**
 * a5sf-pd20-admission-close.test.ts — PD20-B1: the lifecycle admission close is
 * enforced at the MEMBER'S NEXT TOOL BOUNDARY, not only on the Team dispatch
 * route.
 *
 * WHY THIS FILE EXISTS. `dev/agent-workflow/evidence/a5sf-recon-shell` measured
 * that `team_archive_member` promised "its current work is interrupted" while a
 * RUNNING Member's own turn kept obtaining NEW confined terminal sessions during
 * the quiesce window (8.56 s / 8.72 s across two boots; a second `bash` 290/427
 * ms before the durable commit). The cause was narrow: the procedure's
 * close-admission step had exactly one consumer — the Team tool-dispatch route —
 * and a Member's own turn never passes through it.
 *
 * THE LAW PINNED HERE:
 *   1. while the close stamp is in force, the lane guard — the ONE boundary in
 *      front of every Member execution face (fs / subprocess / terminals /
 *      search / web) — refuses the call with the typed
 *      `LIFECYCLE_ADMISSION_CLOSED`, BEFORE the lane decision (so an
 *      out-of-lane target answers the close, not `IO_READ_DENIED`) and with no
 *      base-Provider call;
 *   2. reopening (the procedure's exit, committed or not) restores normal lane
 *      admission — the durable row is the authority from there on;
 *   3. the close is keyed by the Member's instance id (the guard's key) AND its
 *      child session id (the bindings' key), and a repeated close keeps the
 *      first stamp;
 *   4. the QUIESCE PROCEDURE publishes the stamp itself right after step 1 and
 *      drops it on every exit (`reopenAdmission`), so the lifetime belongs to
 *      the procedure — not to a root's port wiring — and the protected center
 *      (`agent-bindings.mjs`, digest-locked) needs no diff.
 *
 * Host-free (C1): no live Host, no Agent, no process. The DEV-LIVE arm (a real
 * boot with a second `bash` after the archive request) lives in
 * `dev/agent-workflow/evidence/pd20-lifecycle/`.
 *
 * @module @dsh-agent-team/runtime/test/a5sf-pd20-admission-close
 */
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  LIFECYCLE_ADMISSION_CLOSED,
  LifecycleAdmissionClosedError,
  clearMemberAdmissionClosed,
  markMemberAdmissionClosed,
  memberAdmissionCloseOf,
  memberAdmissionCloseOfSession,
  resetMemberAdmissionStateForTest,
} from '../lifecycle/admission-state.js'
import type { MemberPolicy, PathRuleSet } from '../member-io-policy/src/types.js'
import { createMemberFsGuard } from '../team-services/src/fs.js'
import { quiesceMember, reopenAdmission } from '../lifecycle/quiesce.js'
import type { LifecyclePorts, LifecycleTarget } from '../lifecycle/types.js'

const INSTANCE = 'inst-pd20b1'
const CHILD_SESSION = 'session-team-child-pd20b1'
const ROOT_SESSION = 'root-pd20b1'

const BASE = join(process.cwd(), '.artifacts', 'tmp', 'a5sf-pd20-admission-close')
const IN_LANE = join(BASE, 'lane')
const OUT_OF_LANE = join(BASE, 'out-of-lane')

beforeAll(async () => {
  await mkdir(IN_LANE, { recursive: true })
  await mkdir(OUT_OF_LANE, { recursive: true })
  // The provider resolver refuses a target it cannot resolve, so the control
  // arm needs a real in-lane file to be admitted.
  await writeFile(join(IN_LANE, 'x.txt'), 'in-lane\n')
  await writeFile(join(OUT_OF_LANE, 'secret.txt'), 'out-of-lane\n')
})
afterAll(async () => {
  await rm(BASE, { recursive: true, force: true })
})
afterEach(() => {
  // The production lifetime is the lifecycle procedure's; a suite that leaked a
  // stamp would close another member's lane in the same process.
  resetMemberAdmissionStateForTest()
})

function lane(allow: readonly string[]): PathRuleSet {
  return Object.freeze({ mode: 'restricted', allow: Object.freeze([...allow]), ask: Object.freeze([]), deny: Object.freeze([]) })
}

function policyOf(): MemberPolicy {
  return Object.freeze({
    memberIdentity: INSTANCE,
    templateId: 'worker',
    instanceGeneration: 1,
    revision: 'rev-pd20b1',
    read: lane([IN_LANE]),
    write: lane([IN_LANE]),
    network: Object.freeze({ access: 'allow' as const }),
  })
}

describe('PD20-B1 — the admission close refuses the next tool boundary', () => {
  it('admits the call while the Member is open (control arm)', async () => {
    const guard = createMemberFsGuard(policyOf())
    await expect(guard('spawn', IN_LANE)).resolves.toBeUndefined()
    await expect(guard('readText', join(IN_LANE, 'x.txt'))).resolves.toBeUndefined()
  })

  it('refuses spawn/read/write with the typed code once the archive was requested', async () => {
    const guard = createMemberFsGuard(policyOf())
    markMemberAdmissionClosed({ childSessionId: CHILD_SESSION, instanceId: INSTANCE, rootSessionId: ROOT_SESSION })

    for (const [method, target] of [
      ['spawn', IN_LANE],
      ['spawn:write', IN_LANE],
      ['readText', join(IN_LANE, 'x.txt')],
      ['writeText', join(IN_LANE, 'y.txt')],
    ] as const) {
      const failure = await guard(method, target).then(() => null, (error: unknown) => error)
      expect(failure, `${method} must be refused while admission is closed`).toBeInstanceOf(LifecycleAdmissionClosedError)
      const refusal = failure as LifecycleAdmissionClosedError
      expect(refusal.code).toBe(LIFECYCLE_ADMISSION_CLOSED)
      expect(refusal.instanceId).toBe(INSTANCE)
      expect(refusal.rootSessionId).toBe(ROOT_SESSION)
      expect(refusal.method).toBe(method)
      expect(refusal.message).toContain(LIFECYCLE_ADMISSION_CLOSED)
      // The truncation is stated, not implied: the running turn is not cancelled.
      expect(refusal.message).toContain('in-flight turn is not cancelled')
    }
  })

  it('answers the CLOSE, not the lane, for an out-of-lane target (the close comes first)', async () => {
    const guard = createMemberFsGuard(policyOf())
    markMemberAdmissionClosed({ childSessionId: CHILD_SESSION, instanceId: INSTANCE, rootSessionId: ROOT_SESSION })
    const failure = await guard('readText', join(OUT_OF_LANE, 'secret.txt')).then(() => null, (error: unknown) => error)
    expect(failure).toBeInstanceOf(LifecycleAdmissionClosedError)
    expect((failure as LifecycleAdmissionClosedError).code).toBe(LIFECYCLE_ADMISSION_CLOSED)
    // …and with the close gone the lane decision is the one that answers.
    clearMemberAdmissionClosed(CHILD_SESSION)
    const laneFailure = await guard('readText', join(OUT_OF_LANE, 'secret.txt')).then(() => null, (error: unknown) => error)
    expect(laneFailure).not.toBeInstanceOf(LifecycleAdmissionClosedError)
    expect((laneFailure as { code?: string }).code).toBe('IO_READ_DENIED')
  })

  it('reopening on the procedure exit restores lane admission', async () => {
    const guard = createMemberFsGuard(policyOf())
    markMemberAdmissionClosed({ childSessionId: CHILD_SESSION, instanceId: INSTANCE, rootSessionId: ROOT_SESSION })
    expect(clearMemberAdmissionClosed(CHILD_SESSION)).toBe(true)
    await expect(guard('spawn', IN_LANE)).resolves.toBeUndefined()
    // idempotent: an unknown/never-closed session is a no-op
    expect(clearMemberAdmissionClosed(CHILD_SESSION)).toBe(false)
  })

  it('keys the close by instance AND child session, and keeps the first stamp', async () => {
    const first = markMemberAdmissionClosed({ childSessionId: CHILD_SESSION, instanceId: INSTANCE, rootSessionId: ROOT_SESSION })
    const second = markMemberAdmissionClosed({ childSessionId: CHILD_SESSION, instanceId: INSTANCE, rootSessionId: 'root-other' })
    expect(second).toBe(first)
    expect(memberAdmissionCloseOf(INSTANCE)).toBe(first)
    expect(memberAdmissionCloseOfSession(CHILD_SESSION)).toBe(first)
    expect(memberAdmissionCloseOf('inst-other-member')).toBeUndefined()
    expect(memberAdmissionCloseOf(undefined)).toBeUndefined()
    expect(memberAdmissionCloseOfSession('')).toBeUndefined()
  })

  it('refuses an empty identity instead of silently keying on ""', () => {
    expect(() => markMemberAdmissionClosed({ childSessionId: '', instanceId: INSTANCE, rootSessionId: ROOT_SESSION }))
      .toThrow(/childSessionId/)
  })
})

/**
 * The procedure-level arms: step 1 of the quiesce publishes the stamp, and the
 * exit path drops it. The ports are stubs — this is a law about WHERE the state
 * is published and cleared, not about the live Host.
 */
function fakePorts(): LifecyclePorts {
  return {
    teamDomain: { id: 'domain-pd20b1' },
    commit: async () => undefined,
    admission: { closeNewWork: async () => undefined, reopenNewWork: async () => undefined },
    activity: { interrupt: async () => undefined },
    descendants: { drainDescendants: async () => ({ quiescent: true, drained: 0 }) },
    residency: { dropResidency: async () => true },
  } as unknown as LifecyclePorts
}

const TARGET: LifecycleTarget = Object.freeze({ rootSessionId: ROOT_SESSION, instanceId: INSTANCE })
const MEMBER = Object.freeze({ childSessionId: CHILD_SESSION }) as unknown as Parameters<typeof quiesceMember>[2]

describe('PD20-B1 — the quiesce procedure owns the publish/clear lifetime', () => {
  it('publishes at step 1 and leaves the guard refusing while the procedure runs', async () => {
    const guard = createMemberFsGuard(policyOf())
    await expect(guard('spawn', IN_LANE)).resolves.toBeUndefined()

    let duringProcedure: unknown = null
    const ports = fakePorts()
    // The port hook is where the live route is closed; the stamp must exist by
    // the time this returns (i.e. step 1 published it, not a later step).
    ports.admission.closeNewWork = async () => {
      duringProcedure = null
    }
    const outcome = await quiesceMember(ports, TARGET, MEMBER)
    expect(outcome.steps[0]).toBe('close-admission')
    expect(memberAdmissionCloseOf(INSTANCE)?.childSessionId).toBe(CHILD_SESSION)

    const failure = await guard('spawn', IN_LANE).then(() => null, (error: unknown) => error)
    expect(failure).toBeInstanceOf(LifecycleAdmissionClosedError)
    expect((failure as LifecycleAdmissionClosedError).code).toBe(LIFECYCLE_ADMISSION_CLOSED)
    expect(duringProcedure).toBeNull()
  })

  it('drops the stamp on the exit path (reopenAdmission) so the member is operable again', async () => {
    await quiesceMember(fakePorts(), TARGET, MEMBER)
    expect(memberAdmissionCloseOf(INSTANCE)).toBeDefined()
    await reopenAdmission(fakePorts(), TARGET)
    expect(memberAdmissionCloseOf(INSTANCE)).toBeUndefined()
    const guard = createMemberFsGuard(policyOf())
    await expect(guard('spawn', IN_LANE)).resolves.toBeUndefined()
    // Idempotent: a second exit is a no-op, never an error.
    await expect(reopenAdmission(fakePorts(), TARGET)).resolves.toBeUndefined()
  })

  it('drops the stamp even when the reopen port faults (the member must not stay shut)', async () => {
    await quiesceMember(fakePorts(), TARGET, MEMBER)
    const faulty = fakePorts()
    faulty.admission.reopenNewWork = async () => { throw new Error('port gone') }
    await expect(reopenAdmission(faulty, TARGET)).resolves.toBeUndefined()
    expect(memberAdmissionCloseOf(INSTANCE)).toBeUndefined()
  })

  it('publishes nothing when step 1 itself faults (the procedure aborted)', async () => {
    const faulty = fakePorts()
    faulty.admission.closeNewWork = async () => { throw new Error('port gone') }
    const failure = await quiesceMember(faulty, TARGET, MEMBER).then(() => null, (error: unknown) => error)
    expect((failure as { code?: string } | null)?.code).toBe('LIFECYCLE_LIVE_EFFECT_FAILED')
    expect((failure as { message: string }).message).toContain('close-admission')
    expect(memberAdmissionCloseOf(INSTANCE)).toBeUndefined()
  })
})
