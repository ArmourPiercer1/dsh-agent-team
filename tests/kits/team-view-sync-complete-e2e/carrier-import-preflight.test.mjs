/**
 * carrier-import-preflight.test.mjs — focused regression for the carrier import preflight.
 *
 * What it pins (all offline, no host, no browser, no network):
 *   1. the exact failure the UI run died behind — a plugin entry whose graph imports a bare
 *      specifier that the carrier cannot resolve — must exit non-zero and NAME the real code and
 *      specifier, instead of leaving a 405 to be read as the cause;
 *   2. a resolvable entry that exports the cordis plugin contract must pass and list export NAMES;
 *   3. an entry that imports fine but is NOT the expected plugin (no `apply`) must fail;
 *   4. the preflight must not echo environment values (a sentinel secret is injected and must not
 *      appear in its output).
 *
 * Run: node --test tests/kits/team-view-sync-complete-e2e/carrier-import-preflight.test.mjs
 *
 * @module tests/kits/team-view-sync-complete-e2e/carrier-import-preflight.test
 */
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PREFLIGHT = join(HERE, 'carrier-import-preflight.mjs')
const ROOT = mkdtempSync(join(tmpdir(), 'dod20-preflight-'))
after(() => rmSync(ROOT, { recursive: true, force: true }))

const SENTINEL = 'DSH020-SENTINEL-NEVER-PRINT-4f2b9c'

/** Run the preflight as the wrapper does: one bounded child, output captured. */
function run(...args) {
  const r = spawnSync(process.execPath, [PREFLIGHT, ...args], {
    encoding: 'utf8',
    timeout: 60_000,
    env: { ...process.env, DSH020_SENTINEL_SECRET: SENTINEL },
  })
  return { status: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}

function fixture(rel, text) {
  const p = join(ROOT, rel)
  writeFileSync(p, text)
  return pathToFileURL(p).href
}

const CONTRACT = (extra = '') => [
  extra,
  "export const name = 'dsh-agent-team'",
  "export const inject = ['agents']",
  'export async function apply() { return {} }',
  'export function validateTeamPluginConfig() { return null }',
  '',
].join('\n')

test('a carrier whose graph cannot resolve a bare specifier fails with the real code + specifier', () => {
  const url = fixture('missing-dep-entry.mjs',
    CONTRACT("import { parse } from 'dod20-preflight-absent-dep-9c1f'\n"))
  const r = run(url)
  assert.equal(r.status, 1, r.out)
  assert.match(r.out, /PREFLIGHT_FAIL/)
  assert.match(r.out, /code=ERR_MODULE_NOT_FOUND/)
  // The point of the gate: the specifier, not a downstream 405, is what gets reported.
  assert.match(r.out, /dod20-preflight-absent-dep-9c1f/)
  assert.match(r.out, /PREFLIGHT_SUMMARY targets=1 failed=1/)
})

test('a resolvable entry exporting the plugin contract passes and lists names only', () => {
  fixture('dep.mjs', 'export const dep = 1\n')
  const good = fixture('good-entry.mjs', CONTRACT("import { dep } from './dep.mjs'\n"))
  const r = run(good)
  assert.equal(r.status, 0, r.out)
  assert.match(r.out, /PREFLIGHT_OK/)
  assert.match(r.out, /exports=[^\n]*\bapply\b[^\n]*\binject\b/)
  assert.doesNotMatch(r.out, /PREFLIGHT_FAIL/)
})

test('an entry that imports fine but is not the team plugin (no apply) fails', () => {
  const url = fixture('not-a-plugin.mjs', "export const name = 'not-team'\nexport const inject = []\n")
  const r = run(url)
  assert.equal(r.status, 1, r.out)
  assert.match(r.out, /code=MISSING_PLUGIN_EXPORTS/)
  assert.match(r.out, /missing_exports=apply,validateTeamPluginConfig/)
})

test('a hung import is bounded by --timeout-ms instead of hanging the caller', () => {
  const url = fixture('slow-entry.mjs', CONTRACT('await new Promise(() => {})\n'))
  const t0 = Date.now()
  const r = run('--timeout-ms', '1500', url)
  assert.ok(Date.now() - t0 < 30_000, 'the preflight must not block indefinitely')
  assert.equal(r.status, 1, r.out)
  assert.match(r.out, /code=PREFLIGHT_TIMEOUT/)
})

test('usage error without a file target', () => {
  assert.equal(run().status, 2)
})

test('the preflight never echoes environment values', () => {
  const url = fixture('env-probe-entry.mjs', CONTRACT("import process from 'node:process'\nvoid process.argv\n"))
  const r = run(url)
  assert.equal(r.status, 0, r.out)
  assert.ok(!r.out.includes(SENTINEL), 'output must not contain an injected env value')
  assert.ok(!r.out.includes('DSH020_SENTINEL_SECRET'), 'output must not name env keys either')
})
