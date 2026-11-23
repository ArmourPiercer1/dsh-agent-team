/**
 * vnext-os-probe.test.mjs — the OS boundary, measured on THIS host.
 *
 * The provider is the product's own (`sandbox-provider`, P1-07): a trusted launcher
 * self-locks with Landlock and then execs the payload. Nothing here re-implements
 * confinement; the arms prove that the enforcement the centre *claims* is the one the
 * kernel actually applies.
 *
 * Run: node --test packages/runtime/test/vnext-os-probe.test.mjs
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'
import { register } from 'node:module'

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url))
register(pathToFileURL(join(REPO_ROOT, 'scripts/run-tests-hooks.mjs')).href)

const sandbox = await import(join(REPO_ROOT, 'packages/runtime/sandbox-provider/index.ts'))
const { createConfinedProvider, probeEnvCapabilities, capabilityProbeLine, envLimited } = await import(
  pathToFileURL(join(REPO_ROOT, 'tests/world-factory/lib/a5sf-env-capability.mjs')).href
)

// THE PROBE, ONCE. The product's own `runNetworkLeg` answers whether this host offers the
// network-deny profile the requests below carry. When it does not (a runner whose kernel/container
// refuses the unprivileged user+net namespace the launcher needs), the two arms become the
// product's FAIL-CLOSED CONTROL and are reported ENV-LIMITED, never counted as a pass.
const CAPABILITY = await probeEnvCapabilities()
process.stdout.write(`${capabilityProbeLine(CAPABILITY)}\n`)

const world = () => {
  const dir = mkdtempSync(join(tmpdir(), 'vnext-os-probe-'))
  const inside = join(dir, 'inside')
  const outside = join(dir, 'outside')
  mkdirSync(inside, { recursive: true })
  mkdirSync(outside, { recursive: true })
  writeFileSync(join(inside, 'inside.txt'), 'INSIDE-CONTENT\n')
  writeFileSync(join(outside, 'outside.txt'), 'OUTSIDE-SECRET\n')
  return { dir, inside, outside }
}

const providerFor = async (dir) => createConfinedProvider({
  realmId: 'os-probe-realm',
  trustRoot: dir,
  scratchRoot: join(dir, 'scratch'),
  assembly: { minAbiVersion: 1 },
})

const request = ({ dir, argv }) => ({
  grantFingerprint: 'grant-os-probe',
  realmId: 'os-probe-realm',
  bindingId: 'binding-os-probe',
  memberScope: 'member-os-probe',
  argv,
  cwd: dir,
  env: [['PATH', '/usr/bin:/bin']],
  networkProfile: 'deny',
  allowPaths: [{ path: join(dir, 'inside'), accessBits: { readFile: true, readDir: true, execute: true } }],
})

test('OS-1 — the host answers the Landlock ABI the provider requires', () => {
  const launcherPath = join(REPO_ROOT, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
  const abi = sandbox.runAbiProbe({
    pythonPath: 'python3',
    launcherPath,
    run: (argv) => {
      try {
        // The launcher's real invocation is `python3 <launcher> --abi-probe`; running the script
        // directly depends on its shebang bits, which is a property of the checkout, not the host.
        const stdout = execFileSync('python3', [argv[0], ...argv.slice(1)], { encoding: 'utf8' })
        return { rc: 0, stdout, stderr: '' }
      } catch (error) {
        return { rc: error?.status ?? 1, stdout: String(error?.stdout ?? ''), stderr: String(error?.stderr ?? '') }
      }
    },
  })
  assert.equal(abi.kind, 'abi-available', `this host must answer the ABI: ${JSON.stringify(abi)}`)
  assert.equal(abi.abiVersion >= 1, true, 'the measured ABI must be at least the floor')
  console.log(`OS-1 measured landlock abiVersion=${abi.abiVersion}`)
})

test('OS-2 — NEGATIVE CONTROL: a confined payload CANNOT read outside its allow set', async (t) => {
  const w = world()
  const provider = await providerFor(w.dir)
  const req = request({ dir: w.dir, argv: ['/bin/cat', join(w.outside, 'outside.txt')] })
  if (!CAPABILITY.networkDeny.present) {
    // ENV-LIMITED (FAIL-CLOSED CONTROL). The request asks for `networkProfile: 'deny'`; this host
    // cannot prove that profile, so the product must REFUSE before any process exists. Proving that
    // refusal is the truthful control here — and it is NOT the kernel-denial guarantee OS-2 names.
    const plan = await provider.prepare(req)
    assert.equal(plan.ok, false, `with no network-deny capability the product MUST refuse, not spawn: ${JSON.stringify(plan)}`)
    assert.equal(plan.error.code, 'IO_POLICY_UNSUPPORTED', `the refusal must be the lane's typed absence: ${JSON.stringify(plan.error)}`)
    assert.match(String(plan.error.message), /network profile 'deny' is not offered/u, 'the refusal must name the profile this host cannot offer')
    assert.match(String(plan.error.message), /PoC-4b|not count|not a mechanism/u, 'the refusal must say WHY an ABI number is not a network guarantee')
    assert.equal(existsSync(join(w.dir, 'scratch', 'plans')), false, 'a refused prepare must leave no plan')
    assert.equal(existsSync(join(w.dir, 'scratch', 'out')), false, 'a refused prepare must leave no output dir for a payload')
    envLimited({
      arm: 'OS-2',
      disposition: 'FAIL-CLOSED-CONTROL',
      code: CAPABILITY.networkDeny.code,
      probe: CAPABILITY.networkDeny.detail,
      reason: 'the kernel-denial negative control was not run because this host cannot prove network=deny; the product refused before any process, which is the fail-closed behaviour, NOT the OS-2 guarantee',
    })
    t.skip(`ENV-LIMITED ${CAPABILITY.networkDeny.code}: network-deny capability absent (see A5SF-CAPABILITY line); the fail-closed refusal IS proven, the kernel denial is NOT`)
    return
  }
  const plan = await provider.prepare(req)
  assert.equal(plan.ok, true, `prepare must succeed for a well-formed request: ${JSON.stringify(plan)}`)
  const run = await provider.execute(plan.value)
  assert.equal(run.ok, true, `the payload runs to completion: ${JSON.stringify(run).slice(0, 400)}`)
  const text = String(run.value.output.stdout ?? '')
  assert.equal(text.includes('OUTSIDE-SECRET'), false, `the kernel must deny the read; stdout was ${JSON.stringify(text)}`)
  // The denial is the KERNEL's, and the payload says so: an empty stdout from a silent success
  // would look identical to a denial, so the negative control needs the failure text too.
  assert.notEqual(String(run.value.output.stderr ?? '').trim(), '', 'the denial must be visible to the payload')
})

test('OS-3 — POSITIVE CONTROL: the same payload CAN read inside its allow set', async (t) => {
  const w = world()
  const provider = await providerFor(w.dir)
  const req = request({ dir: w.dir, argv: ['/bin/cat', join(w.inside, 'inside.txt')] })
  if (!CAPABILITY.networkDeny.present) {
    // Same fail-closed control as OS-2: the POSITIVE half cannot run without the deny proof, so the
    // truthful assertion is that the provider refuses rather than running under an unprovable claim.
    const plan = await provider.prepare(req)
    assert.equal(plan.ok, false, `with no network-deny capability the positive payload must also be refused: ${JSON.stringify(plan)}`)
    assert.equal(plan.error.code, 'IO_POLICY_UNSUPPORTED')
    assert.match(String(plan.error.message), /network profile 'deny' is not offered/u)
    assert.equal(existsSync(join(w.dir, 'scratch', 'plans')), false, 'a refused prepare must leave no plan')
    envLimited({
      arm: 'OS-3',
      disposition: 'FAIL-CLOSED-CONTROL',
      code: CAPABILITY.networkDeny.code,
      probe: CAPABILITY.networkDeny.detail,
      reason: 'the positive FS control cannot run because the same request carries networkProfile=deny, which this host cannot prove; the product refused before any process (fail-closed), so the in-allow-set read is NOT proven here',
    })
    t.skip(`ENV-LIMITED ${CAPABILITY.networkDeny.code}: network-deny capability absent (see A5SF-CAPABILITY line); the fail-closed refusal IS proven, the in-allow-set read is NOT`)
    return
  }
  const plan = await provider.prepare(req)
  assert.equal(plan.ok, true)
  const run = await provider.execute(plan.value)
  assert.equal(run.ok, true)
  assert.equal(String(run.value.output.stdout ?? '').trim(), 'INSIDE-CONTENT', 'a read inside the allow set must succeed, or the negative control proves nothing')
})
