#!/usr/bin/env node
/**
 * a5sf-web-face mutations — ONE mutation control per layer-B property (P3 carries
 * one per named residual, because the property is two independent positions).
 *
 * Each control makes a literal single-occurrence edit in the REAL product source
 * (`packages/runtime/team-services/src/web.ts`, and for P5 the row's
 * `a5sf-realm-row.mjs`), runs the SAME suite, records exactly which arms red,
 * restores the file in a `finally`, and re-asserts the sha256 of the restored
 * file. No control is a second implementation and nothing is committed:
 * `CORE PATCH BUDGET = 0` — the product source is byte-identical before and
 * after this script (asserted, not promised).
 *
 * EXPECTED-RED DISCIPLINE: every control declares its target arms. A control
 * that escapes its declaration is a FAIL. One control inevitably reds MORE than
 * one arm because the mechanism it removes is the shared guard/provider line:
 *
 *   M1 moves the provider call BEFORE the guard. It reds the P1 order arm AND
 *      both P2 deny arms, because "the guard runs before the provider" IS the
 *      deny lane's zero-call position — the same line, so it cannot be
 *      separated. Declared, as the subprocess lane declared M4/M6.
 *
 * Every other control reds exactly one arm.
 *
 * Run: node dev/agent-workflow/evidence/a5sf-web-face/mutations.mjs
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..', '..', '..')
const WEB = join(REPO, 'packages', 'runtime', 'team-services', 'src', 'web.ts')
const ROW = join(REPO, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs')
const SUITE = join(REPO, 'tests', 'world-factory', 'a5sf-web-contract.test.mjs')

const sha256 = (text) => createHash('sha256').update(text).digest('hex')

/** Arms named by the suite title prefix; a mutation is scored by these only. */
const ARM_LABELS = [
  'P1-GUARD-BEFORE-PROVIDER',
  'P1-DECLARED-URL-UNMUTATED',
  'P2-DENY-CAPABILITY-REFUSAL',
  'P2-DENY-SEARCH-ALSO-CAPABILITY',
  'P3-REDIRECT-POSITION',
  'P3-PROXY-POSITION',
  'P4-NO-PER-METHOD-LANE',
  'P4-SHARED-GUARD-BOTH-PATHS',
  'P5-AMBIGUOUS-FAIL-CLOSED',
  'P5-EXACTLY-ONE-SOURCE',
]

/** The shared guard/provider edge — the M1 anchor, also used by M3a/M3b. */
const GUARD_THEN_PROVIDER = `      await guard(WEB_FETCH_GUARD_METHOD, url, WEB_NETWORK_RESIDUALS)
      return provider.fetch(request, signal)`

const MUTATIONS = [
  {
    id: 'M1-provider-before-guard',
    property: 'P1 (declared multi-arm: the deny position is the same line)',
    file: WEB,
    old: GUARD_THEN_PROVIDER,
    new: `      const early = await provider.fetch(request, signal)
      await guard(WEB_FETCH_GUARD_METHOD, url, WEB_NETWORK_RESIDUALS)
      return early`,
    expected: ['P1-GUARD-BEFORE-PROVIDER', 'P2-DENY-CAPABILITY-REFUSAL'],
    why: 'the provider is entered before the guard: the fact no longer exists at provider entry and the deny lane fetches once',
  },
  {
    id: 'M2-refusal-claims-an-observation',
    property: 'P2',
    file: WEB,
    old: `'instead of fetching under a deny claim this host cannot enforce. A backend that proves '`,
    new: `'instead of fetching under a deny claim this host cannot enforce; observed zero connections and no traffic. A backend that proves '`,
    expected: ['P2-DENY-CAPABILITY-REFUSAL', 'P2-DENY-SEARCH-ALSO-CAPABILITY'],
    why: 'the refusal now claims a measurement the face never made (the wording discipline is the property)',
  },
  {
    id: 'M3a-redirect-target-re-guarded',
    property: 'P3 / WEB_REDIRECT_UNMEDIATED_ON_ALLOW',
    file: WEB,
    old: GUARD_THEN_PROVIDER,
    new: `      await guard(WEB_FETCH_GUARD_METHOD, url, WEB_NETWORK_RESIDUALS)
      const answered = await provider.fetch(request, signal)
      const landed = answered !== null && typeof answered === 'object' ? answered.url : undefined
      if (typeof landed === 'string' && landed !== url) {
        await guard(WEB_FETCH_GUARD_METHOD, landed, WEB_NETWORK_RESIDUALS)
      }
      return answered`,
    expected: ['P3-REDIRECT-POSITION'],
    why: 'a redirect hop is re-mediated: a second fact appears and the redirect target enters the guard',
  },
  {
    id: 'M3b-proxy-handled-by-the-face',
    property: 'P3 / WEB_PROXY_ENV_UNMEDIATED_ON_ALLOW',
    file: WEB,
    old: `      return provider.fetch(request, signal)`,
    new: `      return provider.fetch(request, signal, process.env.HTTP_PROXY)`,
    expected: ['P3-PROXY-POSITION'],
    why: 'the face hands the provider a proxy decision of its own (a third argument), so the provider no longer inherits the environment unmediated',
  },
  {
    id: 'M4-search-gets-its-own-guard-instance',
    property: 'P4',
    file: WEB,
    old: `      await guard(WEB_SEARCH_GUARD_METHOD, target, WEB_NETWORK_RESIDUALS)`,
    new: `      const ownGuard = options.onGuardConsult === undefined
        ? laneGuard
        : observeGuard(laneGuard, options.onGuardConsult, {
          realm: options.realm ?? 'member',
          memberIdentity: effective.memberIdentity,
          toolBindingIdentity: options.toolBindingIdentity ?? null,
          policyRevision: effective.policyRevision,
        })
      await ownGuard(WEB_SEARCH_GUARD_METHOD, target, WEB_NETWORK_RESIDUALS)`,
    expected: ['P4-SHARED-GUARD-BOTH-PATHS'],
    why: 'search gets a SECOND observed guard, so its fact sequence restarts at 1: the two paths no longer share one guard instance',
  },
  {
    id: 'M5-two-web-face-sources-tolerated',
    property: 'P5',
    file: ROW,
    old: `    if (web !== undefined) {
      throw new TeamServiceInstallError(
        'REALM_DECLARATION_INVALID',`,
    new: `    if (false) {
      throw new TeamServiceInstallError(
        'REALM_DECLARATION_INVALID',`,
    expected: ['P5-AMBIGUOUS-FAIL-CLOSED'],
    why: 'the compiled and configured sources are no longer a fork: the config factory silently overwrites the compiled face',
  },
]

function runSuite() {
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', SUITE], {
    cwd: REPO,
    encoding: 'utf8',
    env: { ...process.env, A5SF_REQUIRE_PINNED_HOST: '1' },
    timeout: 240_000,
  })
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
  const red = []
  for (const line of output.split('\n')) {
    if (!line.startsWith('not ok ')) continue
    for (const label of ARM_LABELS) {
      if (line.includes(label) && !red.includes(label)) red.push(label)
    }
  }
  return { status: result.status, output, red: red.sort() }
}

const originals = new Map()
let failures = 0

function restoreAll() {
  for (const [path, original] of originals) {
    writeFileSync(path, original, 'utf8')
    assert.equal(sha256(readFileSync(path, 'utf8')), sha256(original), `${path}: the source was not restored byte-for-byte`)
  }
}

try {
  for (const path of [WEB, ROW]) originals.set(path, readFileSync(path, 'utf8'))
  const shas = new Map([...originals].map(([path, text]) => [path, sha256(text)]))

  const baseline = runSuite()
  if (baseline.status !== 0 || baseline.red.length !== 0) {
    failures += 1
    console.log(`FAIL baseline: status=${baseline.status} red=${JSON.stringify(baseline.red)} expected=[]`)
  } else {
    console.log('PASS baseline: red=[] expected=[]')
  }

  const mutated = new Map()
  for (const mutation of MUTATIONS) {
    const original = originals.get(mutation.file)
    const occurrences = original.split(mutation.old).length - 1
    if (occurrences !== 1) {
      failures += 1
      console.log(`FAIL ${mutation.id}: mutant anchor occurs ${occurrences} times in ${mutation.file} (expected exactly 1)`)
      continue
    }
    writeFileSync(mutation.file, original.replace(mutation.old, mutation.new), 'utf8')
    mutated.set(mutation.file, mutated.get(mutation.file) ?? [])
    mutated.get(mutation.file).push(mutation.id)
    let measured
    try {
      measured = runSuite()
    } finally {
      writeFileSync(mutation.file, original, 'utf8')
      assert.equal(
        sha256(readFileSync(mutation.file, 'utf8')),
        shas.get(mutation.file),
        `${mutation.id}: the source was not restored byte-for-byte`,
      )
    }
    const expected = [...mutation.expected].sort()
    const same = measured.red.length === expected.length && measured.red.every((label, index) => label === expected[index])
    if (same) {
      console.log(`PASS ${mutation.id}: red=${JSON.stringify(measured.red)} expected=${JSON.stringify(expected)}`)
    } else {
      failures += 1
      console.log(`FAIL ${mutation.id}: red=${JSON.stringify(measured.red)} expected=${JSON.stringify(expected)}`)
      const firstError = measured.output.split('\n').find((line) => /AssertionError|Error:|expected|actual/.test(line))
      if (firstError !== undefined) console.log(`       first: ${firstError.trim()}`)
    }
    console.log(`       property: ${mutation.property}`)
    console.log(`       ${mutation.why}`)
  }

  // The budget assertion: the product tree is unchanged outside this process.
  const dirty = spawnSync('git', ['-C', REPO, 'status', '--porcelain', '--', 'packages/'], { encoding: 'utf8' })
  const dirtyLines = String(dirty.stdout ?? '').split('\n').filter((line) => line.trim() !== '')
  if (dirtyLines.length === 0) {
    console.log('PASS core-patch-budget: `git status --porcelain -- packages/` is empty')
  } else {
    failures += 1
    console.log(`FAIL core-patch-budget: packages/ is dirty after the run: ${JSON.stringify(dirtyLines)}`)
  }
} finally {
  restoreAll()
}

console.log(failures === 0 ? 'MUTATION-CONTROLS-PASS' : `MUTATION-CONTROLS-FAIL (${failures})`)
process.exit(failures === 0 ? 0 : 1)
