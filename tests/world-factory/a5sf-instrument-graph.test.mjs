/**
 * a5sf-instrument-graph.test.mjs — PD-32: a World cannot substitute its subject.
 *
 * ZERO Host boots, ZERO ports bound. These are the pins on the SHARED
 * instrument (lib/profile-module-graph.mjs + createWorld), i.e. the things that
 * must be true for every lane, not just for the lane that wrote them:
 *
 *   1. every World gets the profile module graph, provisioned the way an install
 *      would (one link of the tree's OWN package, so EVERY declared subpath
 *      resolves — not a hardcoded `./web-tool`);
 *   2. the graph is VERIFIED at World creation: each declared subpath resolves
 *      from a file inside the profile, and an unresolvable one throws a named
 *      error instead of becoming `never started` later;
 *   3. the negative control (`A5SF_WF_NO_INSTALL_GRAPH=1`) still disables it, so
 *      "the graph is what makes the shipped rows load" stays measurable;
 *   4. the preconditions are named and loud: `never started` (the whole Agent
 *      went down), no Member, no surface — each its own code, because "no goal"
 *      and "0 Members" are downstream symptoms of the same dead preset and a
 *      reader must be able to tell them apart;
 *   5. leaked links are NOT overwritten (a real installed directory is refused).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TestWorldFactory } from './lib/world-factory.mjs'
import {
  PROFILE_GRAPH_CODES,
  ShippedPresetAuditError,
  assertShippedPresetMounted,
  installGraphDisabled,
  presetAuditOf,
  profilePackageOf,
  provisionProfileModuleGraph,
  verifyProfileModuleGraph,
} from './lib/profile-module-graph.mjs'

const REPO_ROOT = new URL('../../', import.meta.url).pathname

function tmp(label) {
  return mkdtempSync(join(tmpdir(), `a5sf-graph-${label}-`))
}

test('PD32-GRAPH: a World provisions the tree\'s own package into its profile module graph', async () => {
  const root = tmp('world')
  try {
    const factory = new TestWorldFactory({ repoRoot: REPO_ROOT, evidenceRoot: join(root, 'ev'), leaseRoot: join(root, 'leases') })
    const world = await factory.createWorld({ line: 'graph' })
    const graph = world.profileGraph
    assert.equal(graph.provisioned, true, 'createWorld must provision by default')
    assert.equal(graph.package.name, 'dsh-agent-team')
    // One link serves EVERY declared subpath; the record names what resolved.
    for (const subpath of profilePackageOf(REPO_ROOT).subpaths) {
      assert.ok(graph.verified[subpath], `subpath ${subpath} is not recorded as resolved`)
    }
    assert.ok(graph.verified['./web-tool'].includes('confined-web-tool.mjs'))
    assert.ok(graph.verified['./web-transport'].includes('a5sf-web-transport.mjs'))
    assert.ok(graph.verified['./host'].includes('host.js') || graph.verified['./host'].includes('host.mjs'))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('PD32-GRAPH: verification is per-subpath and names the one that fails', () => {
  const root = tmp('verify')
  try {
    const home = join(root, 'home')
    mkdirSync(join(home, 'profiles', 'web'), { recursive: true })
    // A package whose exports map promises a file that does not exist: the
    // graph "exists" (the link is there) but cannot serve the composition.
    const pkgRoot = join(root, 'pkg')
    mkdirSync(join(pkgRoot, 'dist'), { recursive: true })
    writeFileSync(join(pkgRoot, 'package.json'), JSON.stringify({
      name: 'dsh-broken-fixture',
      exports: { './good': './dist/good.mjs', './missing': './dist/missing.mjs' },
    }, null, 2))
    writeFileSync(join(pkgRoot, 'dist', 'good.mjs'), 'export const ok = 1\n')
    const provisioned = provisionProfileModuleGraph({ home, repoRoot: pkgRoot })
    assert.equal(provisioned.provisioned, true)
    assert.throws(
      () => verifyProfileModuleGraph({ home, repoRoot: pkgRoot }),
      (error) => error instanceof ShippedPresetAuditError
        && error.code === PROFILE_GRAPH_CODES.UNRESOLVED
        && /\.\/missing/u.test(error.message)
        && !/\.\/good/u.test(error.message),
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('PD32-GRAPH: the negative control disables provisioning, and is the only thing that does', () => {
  const root = tmp('control')
  const saved = { ...process.env }
  try {
    const home = join(root, 'home')
    mkdirSync(join(home, 'profiles', 'web'), { recursive: true })
    process.env.A5SF_WF_NO_INSTALL_GRAPH = '1'
    assert.equal(installGraphDisabled(), true)
    const skipped = provisionProfileModuleGraph({ home, repoRoot: REPO_ROOT })
    assert.equal(skipped.provisioned, false)
    assert.match(skipped.reason, /negative control/u)
    assert.equal(skipped.link, null)
    delete process.env.A5SF_WF_NO_INSTALL_GRAPH
    process.env.A5SF_PD30_NO_INSTALL_GRAPH = '1'
    assert.equal(installGraphDisabled(), true, 'the older PD-30 spelling stays an alias')
    assert.equal(provisionProfileModuleGraph({ home, repoRoot: REPO_ROOT }).provisioned, false)
    delete process.env.A5SF_PD30_NO_INSTALL_GRAPH
    assert.equal(installGraphDisabled(), false)
    assert.equal(provisionProfileModuleGraph({ home, repoRoot: REPO_ROOT }).provisioned, true)
  } finally {
    process.env = saved
    rmSync(root, { recursive: true, force: true })
  }
})

test('PD32-GRAPH: an installed directory is never written over', () => {
  const root = tmp('leak')
  try {
    const home = join(root, 'home')
    mkdirSync(join(home, 'profiles', 'web', 'node_modules', 'dsh-agent-team'), { recursive: true })
    assert.throws(
      () => provisionProfileModuleGraph({ home, repoRoot: REPO_ROOT }),
      /refusing to write over an installed package/u,
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('PD32-PRECONDITION: `never started` throws a named error carrying the audit line', () => {
  const log = [
    '2026-11-15 host started',
    'loader: tool-web (dsh-agent-team/web-tool): never started',
    'loader: preset-a5sf-governed-member: never started',
  ].join('\n')
  const audit = presetAuditOf(log)
  assert.equal(audit.neverStarted, true)
  assert.equal(audit.lines.length, 2)
  assert.throws(
    () => assertShippedPresetMounted({ hostLogText: log, members: [{ templateId: 'worker' }], surfaceCount: 33 }),
    (error) => error instanceof ShippedPresetAuditError
      && error.code === PROFILE_GRAPH_CODES.PRESET_NEVER_STARTED
      && /never started/u.test(error.message)
      && /dsh-agent-team\/web-tool/u.test(error.message),
  )
})

test('PD32-PRECONDITION: a healthy boot passes; no Member and no surface are DIFFERENT codes', () => {
  const clean = 'host started\nmember worker created\nsurface 33\n'
  assert.equal(presetAuditOf(clean).neverStarted, false)
  assert.deepEqual(
    assertShippedPresetMounted({ hostLogText: clean, members: [{ templateId: 'worker' }], template: 'worker', surfaceCount: 33 }),
    { neverStarted: false, members: 1, surfaceCount: 33 },
  )
  assert.throws(
    () => assertShippedPresetMounted({ hostLogText: clean, members: [], surfaceCount: 0 }),
    (error) => error.code === PROFILE_GRAPH_CODES.PRESET_NO_MEMBER,
  )
  assert.throws(
    () => assertShippedPresetMounted({ hostLogText: clean, members: [{ templateId: 'worker' }], surfaceCount: 0 }),
    (error) => error.code === PROFILE_GRAPH_CODES.PRESET_NO_SURFACE && /floor 1/u.test(error.message),
  )
})

test('PD32-PRECONDITION: the preconditions run BEFORE any arm — a dead preset cannot yield green arms', () => {
  // The contract in one line: the throw happens at precondition time, so a
  // caller that catches it has no verdict to report. Guard the ORDER, not just
  // the message: a driver must call this before it reads any arm result.
  const driver = readFileSync(join(REPO_ROOT, 'tests/world-factory/drivers/a5sf-pd30-web-preview/run-boot.mjs'), 'utf8')
  const pre = driver.indexOf('PRECONDITION: THE PRESET ROWS LOAD AS SHIPPED')
  // The first thing after the precondition that measures an ARM is the probe
  // sequence; the settle wait between them belongs to the precondition phase.
  const firstArm = driver.indexOf('const fetchFacts = factsFor(CALL_FETCH)')
  const secondPre = driver.indexOf('PRECONDITION 2')
  assert.ok(pre > 0 && firstArm > 0 && secondPre > 0, 'the driver must contain both preconditions and a probe')
  assert.ok(pre < firstArm, 'precondition 1 must appear before the first arm')
  assert.ok(secondPre < firstArm, 'precondition 2 (Member + surface) must also precede the first arm')
})
