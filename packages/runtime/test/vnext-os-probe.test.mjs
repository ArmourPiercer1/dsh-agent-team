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
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'
import { register } from 'node:module'

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url))
register(pathToFileURL(join(REPO_ROOT, 'scripts/run-tests-hooks.mjs')).href)

const sandbox = await import(join(REPO_ROOT, 'packages/runtime/sandbox-provider/index.ts'))

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

const providerFor = (dir) => sandbox.createConfinedProcessProvider({
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

test('OS-2 — NEGATIVE CONTROL: a confined payload CANNOT read outside its allow set', async () => {
  const w = world()
  const provider = providerFor(w.dir)
  const plan = await provider.prepare(request({ dir: w.dir, argv: ['/bin/cat', join(w.outside, 'outside.txt')] }))
  assert.equal(plan.ok, true, `prepare must succeed for a well-formed request: ${JSON.stringify(plan)}`)
  const run = await provider.execute(plan.value)
  assert.equal(run.ok, true, `the payload runs to completion: ${JSON.stringify(run).slice(0, 400)}`)
  const text = String(run.value.output.stdout ?? '')
  assert.equal(text.includes('OUTSIDE-SECRET'), false, `the kernel must deny the read; stdout was ${JSON.stringify(text)}`)
  // The denial is the KERNEL's, and the payload says so: an empty stdout from a silent success
  // would look identical to a denial, so the negative control needs the failure text too.
  assert.notEqual(String(run.value.output.stderr ?? '').trim(), '', 'the denial must be visible to the payload')
})

test('OS-3 — POSITIVE CONTROL: the same payload CAN read inside its allow set', async () => {
  const w = world()
  const provider = providerFor(w.dir)
  const plan = await provider.prepare(request({ dir: w.dir, argv: ['/bin/cat', join(w.inside, 'inside.txt')] }))
  assert.equal(plan.ok, true)
  const run = await provider.execute(plan.value)
  assert.equal(run.ok, true)
  assert.equal(String(run.value.output.stdout ?? '').trim(), 'INSIDE-CONTENT', 'a read inside the allow set must succeed, or the negative control proves nothing')
})
