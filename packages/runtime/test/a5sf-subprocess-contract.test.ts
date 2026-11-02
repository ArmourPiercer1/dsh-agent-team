/**
 * a5sf-subprocess-contract.test.ts — P1-07: the confined streaming arm exposes
 * a native-compatible `SubprocessHandle` (stdin/stdout/stderr/collected/done/
 * waitForExit/terminate) without degrading the provider's lease.
 *
 * The shape is pinned field-by-field, the live repository root is the cwd, and
 * one REAL stream proves `collected`/`done`/`terminate` behavior end to end on
 * the actual backend. When the backend cannot enforce, the runner refuses — the
 * contract test does not run a naked process to keep the shape green.
 *
 * @module @dsh-agent-team/runtime/test/a5sf-subprocess-contract
 */
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { EffectiveIoPolicy, PathRuleSet } from '../member-io-policy/src/types.js'
import { createTeamConfinedRunner } from '../team-sandbox/src/runner.js'
import { toSubprocessHandle } from '../team-sandbox/src/subprocess.js'
import { createConfinedProcessProvider } from '../sandbox-provider/provider.js'

const FIXTURE_PARENT = join(process.cwd(), '.artifacts', 'tmp')

function lane(allow: string[]): PathRuleSet {
  return Object.freeze({ mode: 'restricted', allow: Object.freeze(allow), ask: Object.freeze([]), deny: Object.freeze([]) })
}

const POLICY: EffectiveIoPolicy = Object.freeze({
  memberIdentity: 'member-sub',
  toolBindingIdentity: 'binding-sub',
  invocationId: 'call-sub',
  policyRevision: 'rev-sub',
  read: lane(['/usr', '/bin', '/lib', '/lib64', '/etc', '/proc', '/dev']),
  write: lane(['/usr']),
  network: Object.freeze({ access: 'allow' }),
})

describe('P1-07 subprocess contract', () => {
  let world = ''
  let workdir = ''

  beforeAll(async () => {
    await mkdir(FIXTURE_PARENT, { recursive: true })
    world = await mkdtemp(join(FIXTURE_PARENT, 'a5sf-sub-'))
    workdir = join(world, 'work')
    await mkdir(workdir, { recursive: true })
  })
  afterAll(async () => {
    await rm(world, { recursive: true, force: true })
  })

  it('exposes the native SubprocessHandle shape and accumulates output', async () => {
    const provider = createConfinedProcessProvider({ realmId: 'realm-sub', trustRoot: 'git:a5sf:subprocess', scratchRoot: world })
    const runner = createTeamConfinedRunner(provider)
    const planned = await runner.plan({
      policy: { ...POLICY, read: lane(['/usr', '/bin', '/lib', '/lib64', workdir]) },
      realmId: 'realm-sub', bindingId: 'b', memberScope: 'm', grantFingerprint: 'sha256:sub-1',
      argv: ['/bin/sh', '-c', 'printf hello; printf err >&2'],
      cwd: workdir, env: [],
    })
    expect(planned.ok).toBe(true)
    if (!planned.ok) return
    const live = await provider.spawnStreaming(planned.request)
    expect(live.ok).toBe(true)
    if (!live.ok) return
    const handle = toSubprocessHandle(live.value)
    expect(typeof handle.pid).toBe('number')
    expect(handle.stdin).toBeDefined()
    expect(handle.stdout).toBeDefined()
    expect(handle.stderr).toBeDefined()
    expect(handle.collected).toEqual({ stdout: '', stderr: '' })
    const exit = await handle.waitForExit()
    expect(exit.code).toBe(0)
    expect(handle.collected.stdout).toBe('hello')
    expect(handle.collected.stderr).toBe('err')
    expect(await handle.done).toEqual(exit)
    // terminate after exit is idempotent and settles the same lease.
    const settled = await handle.terminate()
    expect(settled.ok).toBe(true)
  }, 30_000)

  it('refuses when the backend cannot enforce the profile (no naked process)', async () => {
    const provider = createConfinedProcessProvider({ realmId: 'realm-sub2', trustRoot: 'git:a5sf:subprocess', scratchRoot: world })
    const runner = createTeamConfinedRunner(provider)
    const refused = await runner.plan({
      policy: { ...POLICY, read: lane([workdir]), write: lane([workdir]), network: Object.freeze({ access: 'deny' }) },
      realmId: 'realm-sub2', bindingId: 'b', memberScope: 'm', grantFingerprint: 'sha256:sub-2',
      argv: ['/bin/true'], cwd: workdir, env: [],
    })
    expect(refused).toMatchObject({ ok: false, code: 'ENFORCEMENT_UNAVAILABLE' })
  })
})
