/**
 * Characterization harness — host version fixture.
 *
 * `fixtures/host-version.json` pins the upstream commit the whole
 * characterization Phase runs against, plus a fingerprint of the public
 * exports surface observed at that pin (per package: version, exports form,
 * sorted exports key list, and the root entry target). The self-test
 * re-derives the live surface from the test-use tree and fails on any
 * divergence (pin drift protection, per task card P2-T1 "host version
 * fixture").
 *
 * Regeneration is a deliberate, reviewed act: `node tests/characterization/
 * run.mjs --fixture-write` (only after the upstream pin has been moved on
 * purpose; the new fixture content then goes in with the pin change).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { buildPublicSurface } from './public-surface.mjs'

export const FIXTURE_SCHEMA = 'p2t1-host-version/1'

/** Derive the fixture document from the live tree + observed HEAD sha. */
export function buildFixture({ upstreamSha, hostTree }) {
  const surface = buildPublicSurface(hostTree)
  const packages = {}
  for (const [name, entry] of [...surface].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    packages[name] = {
      version: entry.version ?? null,
      form: entry.form,
      exportsKeys: entry.exportsKeys,
      rootTarget: entry.rootTarget ?? null,
    }
  }
  return {
    schema: FIXTURE_SCHEMA,
    upstreamSha,
    tree: 'references/deepseek-harness-test-use (pristine upstream checkout)',
    note:
      'Fingerprint of the upstream public exports surface at the pinned commit. ' +
      'Regenerate only on a deliberate pin move: node tests/characterization/run.mjs --fixture-write',
    packageCount: packages && Object.keys(packages).length,
    packages,
  }
}

/** Load the committed fixture. */
export function loadFixture(fixturePath) {
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
  if (fixture.schema !== FIXTURE_SCHEMA) {
    throw new Error(`unsupported fixture schema ${JSON.stringify(fixture.schema)} (want ${FIXTURE_SCHEMA})`)
  }
  return fixture
}

/** Write a fixture (used by --fixture-write). */
export function writeFixture(fixturePath, fixture) {
  mkdirSync(dirname(fixturePath), { recursive: true })
  writeFileSync(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`)
}

/**
 * Compare the live surface against the fixture.
 * @returns {Array<string>} human-readable drift lines (empty = consistent).
 */
export function diffSurface(fixture, liveSurface) {
  const drift = []
  const fixtureNames = Object.keys(fixture.packages)
  const liveNames = [...liveSurface.keys()]
  const liveSet = new Set(liveNames)
  for (const name of fixtureNames) {
    if (!liveSet.has(name)) {
      drift.push(`package removed: ${name}`)
      continue
    }
    const expected = fixture.packages[name]
    const live = liveSurface.get(name)
    if ((expected.version ?? null) !== (live.version ?? null)) {
      drift.push(`${name}: version ${expected.version ?? null} -> ${live.version ?? null}`)
    }
    if (expected.form !== live.form) {
      drift.push(`${name}: exports form ${expected.form} -> ${live.form}`)
    }
    const expectedKeys = [...(expected.exportsKeys ?? [])]
    const liveKeys = live.exportsKeys
    if (expectedKeys.length !== liveKeys.length || expectedKeys.some((key, i) => key !== liveKeys[i])) {
      const added = liveKeys.filter((key) => !expectedKeys.includes(key))
      const removed = expectedKeys.filter((key) => !liveKeys.includes(key))
      drift.push(
        `${name}: exports keys drifted (added: ${added.length ? added.join(', ') : '-'}; removed: ${removed.length ? removed.join(', ') : '-'})`,
      )
    }
    if ((expected.rootTarget ?? null) !== (live.rootTarget ?? null)) {
      drift.push(`${name}: root target ${expected.rootTarget ?? null} -> ${live.rootTarget ?? null}`)
    }
  }
  for (const name of liveNames) {
    if (!fixtureNames.includes(name)) drift.push(`package added: ${name}`)
  }
  return drift
}

export const fixturePathFor = (harnessRoot) => join(harnessRoot, 'fixtures', 'host-version.json')
