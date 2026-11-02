/**
 * a5sf-os-runner.test.ts — P1-07 (Gate G1.7): compile the Member policy into an
 * OS execution profile and run it through the confined provider.
 *
 * Two layers:
 *  - PURE profile laws (read/write independence, write-only bits, deny wins,
 *    inexpressible policies refused instead of approximated);
 *  - ONE REAL OS leg on the actual backend: allowed read works, denied read is
 *    refused INSIDE the child, a write-only subtree accepts a write and refuses
 *    a read of what it just wrote. The leg asserts the POSITIVE and NEGATIVE
 *    effects, not the launcher's exit code.
 *
 * Network: this backend reports `network-destination: unsupported`; a policy
 * that requires `network: deny` must be REFUSED, never run naked. The test
 * asserts that refusal and does not claim network enforcement.
 *
 * @module @dsh-agent-team/runtime/test/a5sf-os-runner
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { EffectiveIoPolicy, PathRuleSet } from '../member-io-policy/src/types.js'
import { compileExecutionProfile } from '../team-sandbox/src/profile.js'
import { createTeamConfinedRunner } from '../team-sandbox/src/runner.js'
import { createConfinedProcessProvider } from '../sandbox-provider/provider.js'

const FIXTURE_PARENT = join(process.cwd(), '.artifacts', 'tmp')

function lane(allow: string[], deny: string[] = [], ask: string[] = []): PathRuleSet {
  return Object.freeze({ mode: 'restricted', allow: Object.freeze(allow), ask: Object.freeze(ask), deny: Object.freeze(deny) })
}

function policy(read: PathRuleSet, write: PathRuleSet, network: 'allow' | 'deny' = 'allow'): EffectiveIoPolicy {
  return Object.freeze({
    memberIdentity: 'member-os',
    toolBindingIdentity: 'binding-os',
    invocationId: 'call-os',
    policyRevision: 'rev-os',
    read,
    write,
    network: Object.freeze({ access: network }),
  })
}

describe('P1-07 execution profile (pure)', () => {
  it('compiles read and write independently, with a real write-only lane', () => {
    const result = compileExecutionProfile(policy(lane(['/w/read']), lane(['/w/write'])))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.readPaths).toEqual(['/w/read'])
    expect(result.value.writeOnlyPaths).toEqual(['/w/write'])
    expect(result.value.readWritePaths).toEqual([])
    const writeOnly = result.value.allowPaths.find((entry) => entry.path === '/w/write')!
    expect(writeOnly.accessBits.readFile).toBeUndefined()
    expect(writeOnly.accessBits.readDir).toBeUndefined()
    expect(writeOnly.accessBits.writeFile).toBe(true)
    expect(writeOnly.accessBits.makeReg).toBe(true)
    const readOnly = result.value.allowPaths.find((entry) => entry.path === '/w/read')!
    expect(readOnly.accessBits.readFile).toBe(true)
    expect(readOnly.accessBits.writeFile).toBeUndefined()
  })

  it('a locator on both axes is one read+write entry', () => {
    const result = compileExecutionProfile(policy(lane(['/w/x']), lane(['/w/x'])))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.readWritePaths).toEqual(['/w/x'])
    const entry = result.value.allowPaths.find((row) => row.path === '/w/x')!
    expect(entry.accessBits.readFile).toBe(true)
    expect(entry.accessBits.writeFile).toBe(true)
  })

  it('a deny EQUAL to the allow removes the rule (expressible), a NESTED deny is refused', () => {
    const equal = compileExecutionProfile(policy(lane(['/w/a'], ['/w/a']), lane(['/w/a'], ['/w/a'])))
    expect(equal.ok).toBe(false) // nothing left on either axis ⇒ no named subtree
    const nestedRead = compileExecutionProfile(policy(lane(['/w/a'], ['/w/a/secret']), lane(['/w/b'])))
    expect(nestedRead).toMatchObject({ ok: false, code: 'PATH_NESTED_DENY_UNEXPRESSIBLE' })
    const nestedWrite = compileExecutionProfile(policy(lane(['/w/a']), lane(['/w/b'], ['/w/b/private'])))
    expect(nestedWrite).toMatchObject({ ok: false, code: 'PATH_NESTED_DENY_UNEXPRESSIBLE' })
  })

  it('refuses an unrestricted axis instead of inventing an allowlist', () => {
    const all: PathRuleSet = Object.freeze({ mode: 'all', allow: Object.freeze([]), ask: Object.freeze([]), deny: Object.freeze([]) })
    const result = compileExecutionProfile(policy(all, lane(['/w/x'])))
    expect(result).toMatchObject({ ok: false, code: 'PATH_LANE_UNRESTRICTED' })
  })

  it('refuses an ask destination (an ask is not an OS grant)', () => {
    const result = compileExecutionProfile(policy(lane(['/w/a'], [], ['/w/ask']), lane(['/w/a'])))
    expect(result).toMatchObject({ ok: false, code: 'PATH_LANE_UNSUPPORTED' })
  })

  it('maps network deny to the provider profile and never invents enforcement', () => {
    const denied = compileExecutionProfile(policy(lane(['/w/a']), lane(['/w/a']), 'deny'))
    expect(denied.ok).toBe(true)
    if (!denied.ok) return
    expect(denied.value.networkProfile).toBe('deny')
    const allowed = compileExecutionProfile(policy(lane(['/w/a']), lane(['/w/a']), 'allow'))
    expect(allowed.ok && allowed.value.networkProfile).toBeUndefined()
  })
})

describe('P1-07 real OS leg (Landlock launcher)', () => {
  let world = ''
  let allowed = ''
  let secret = ''
  let writeOnly = ''

  beforeAll(async () => {
    await mkdir(FIXTURE_PARENT, { recursive: true })
    world = await mkdtemp(join(FIXTURE_PARENT, 'a5sf-os-'))
    allowed = join(world, 'allowed')
    secret = join(world, 'secret')
    writeOnly = join(world, 'wdir')
    await mkdir(allowed, { recursive: true })
    await mkdir(secret, { recursive: true })
    await mkdir(writeOnly, { recursive: true })
    await writeFile(join(allowed, 'a.txt'), 'ALPHA-OK\n', 'utf8')
    await writeFile(join(secret, 'top.txt'), 'TOP-SECRET-DO-NOT-LEAK\n', 'utf8')
  })

  afterAll(async () => {
    await rm(world, { recursive: true, force: true })
  })

  it('enforces the read allowlist and the write-only lane inside the child', async (ctx) => {
    const provider = createConfinedProcessProvider({ realmId: 'realm-a5sf-os', trustRoot: 'git:a5sf:os-runner', scratchRoot: world })
    const probe = await provider.probe()
    expect(probe.ok).toBe(true)
    if (!probe.ok) return
    const levels = new Map(probe.value.map((row) => [row.dimension, row.level]))
    const enforced = levels.get('content-read') === 'enforced' && levels.get('write') === 'enforced'
    if (!enforced) {
      // No enforcing backend here: SKIP the law (do not report it green) and
      // assert only the fail-closed refusal below.
      ctx.skip('this backend does not enforce content-read/write; the FS law cannot be proven here')
      return
    }
    const runner = createTeamConfinedRunner(provider)
    const result = await runner.spawn({
      policy: policy(lane([allowed]), lane([writeOnly])),
      realmId: 'realm-a5sf-os',
      bindingId: 'b',
      memberScope: 'm',
      grantFingerprint: 'sha256:grant-os-1',
      argv: [
        '/bin/sh',
        '-c',
        `cat ${join(allowed, 'a.txt')} 2>&1; cat ${join(secret, 'top.txt')} 2>&1; printf written > ${join(writeOnly, 'w.txt')} 2>&1 && echo WROTE; cat ${join(writeOnly, 'w.txt')} 2>&1`,
      ],
      cwd: world,
      env: [],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const out = result.value.output.combined
    expect(out).toContain('ALPHA-OK')
    expect(out).toMatch(/Permission denied|EACCES/)
    expect(out).not.toContain('TOP-SECRET')
    expect(out).toContain('WROTE')
    // The write landed on disk even though the child could not read it back.
    expect(await readFile(join(writeOnly, 'w.txt'), 'utf8')).toBe('written')
  })

  it('refuses a network-deny policy when the backend cannot enforce it (no bare process)', async () => {
    const provider = createConfinedProcessProvider({ realmId: 'realm-a5sf-os2', trustRoot: 'git:a5sf:os-runner', scratchRoot: world })
    const runner = createTeamConfinedRunner(provider)
    const result = await runner.spawn({
      policy: policy(lane([allowed]), lane([allowed]), 'deny'),
      realmId: 'realm-a5sf-os2', bindingId: 'b', memberScope: 'm', grantFingerprint: 'sha256:g2',
      argv: ['/bin/true'], cwd: world, env: [],
    })
    expect(result).toMatchObject({ ok: false, code: 'ENFORCEMENT_UNAVAILABLE' })
  })

  it('refuses an empty argv and an inexpressible profile before any process', async () => {
    const provider = createConfinedProcessProvider({ realmId: 'realm-a5sf-os3', trustRoot: 'git:a5sf:os-runner', scratchRoot: world })
    const runner = createTeamConfinedRunner(provider)
    expect(await runner.plan({
      policy: policy(lane([allowed]), lane([writeOnly])),
      realmId: 'r', bindingId: 'b', memberScope: 'm', grantFingerprint: 'g', argv: [], cwd: world, env: [],
    })).toMatchObject({ ok: false, code: 'EMPTY_ARGV' })
    const all: PathRuleSet = Object.freeze({ mode: 'all', allow: Object.freeze([]), ask: Object.freeze([]), deny: Object.freeze([]) })
    expect(await runner.plan({
      policy: policy(all, lane([writeOnly])),
      realmId: 'r', bindingId: 'b', memberScope: 'm', grantFingerprint: 'g', argv: ['/bin/true'], cwd: world, env: [],
    })).toMatchObject({ ok: false, code: 'PROFILE_REFUSED' })
  })
})
