#!/usr/bin/env node
/**
 * Deterministic check for the launch-token LOG redaction
 * (tests/characterization/lib/instance.mjs — redactLaunchToken).
 *
 * Plain node, zero spawns, zero network:
 *   node dev/agent-workflow/evidence/test-infra-fixture-param/redaction-check.mjs
 * Exit 0 = every assertion holds; 1 = any assertion failed.
 *
 * Covers BOTH shapes the coordinator named (a URL WITH a token query and one
 * WITHOUT), the exact log line ensureProfile prints, and the readiness
 * matcher: BOOT_MARKER (instance.mjs:23, copied here verbatim because the
 * constant is module-private) must still match a redacted line — the
 * placeholder is token-SHAPED (`REDACTED` ⊂ [A-Za-z0-9_-]) for exactly that
 * reason.
 *
 * FAKE / FAKE_SHORT are assembled at runtime from fragments so that NO
 * credential-shaped literal exists in this file: the branch credential scan is
 * zero-tolerance and an evidence file must stay trivially scannable.
 */
import { strict as assert } from 'node:assert'
import { redactLaunchToken } from '../../../../tests/characterization/lib/instance.mjs'

// Verbatim copy of the module-private BOOT_MARKER (instance.mjs:23).
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=[A-Za-z0-9_-]+/

const FAKE = ['SYN', 'THE', 'TIC', 'NOT', 'A', 'TOKEN', '01', '23', '45', '67', '89', 'ab', 'cd', 'ef'].join('-')
const FAKE_SHORT = ['SYN', 'THE', 'TIC', 'VAL', 'UE', '98', '76'].join('-')

const results = []
function t(label, fn) {
  try { fn(); results.push({ label, ok: true }) } catch (e) { results.push({ label, ok: false, detail: String(e?.message ?? e) }) }
}

t('URL WITH a token query: the token VALUE is replaced, nothing else moves', () => {
  const url = `http://127.0.0.1:3181/?token=${FAKE}`
  assert.equal(redactLaunchToken(url), 'http://127.0.0.1:3181/?token=REDACTED')
  assert.ok(url.includes(FAKE), 'fixture lost its token (the test would prove nothing)')
})

t('URL WITHOUT a token query: byte-for-byte unchanged', () => {
  for (const url of ['http://127.0.0.1:3181/', 'http://127.0.0.1:3181/?tab=teams', '']) {
    assert.equal(redactLaunchToken(url), url, `changed: ${JSON.stringify(url)}`)
  }
})

t('the exact ensureProfile LOG line keeps its readiness prefix', () => {
  const line = `throwaway boot OK: ${redactLaunchToken(`http://127.0.0.1:3184/?token=${FAKE}`)}`
  assert.equal(line, 'throwaway boot OK: http://127.0.0.1:3184/?token=REDACTED')
  assert.ok(line.startsWith('throwaway boot OK: http://127.0.0.1:'), 'readiness prefix lost')
  assert.ok(!line.includes(FAKE), 'the raw token survived the redaction')
})

t('BOOT_MARKER (instance.mjs:23) still matches the redacted host boot line', () => {
  const real = `dsh web: http://127.0.0.1:3181/?token=${FAKE}`
  const redacted = `dsh web: ${redactLaunchToken(real.replace('dsh web: ', ''))}`
  assert.ok(BOOT_MARKER.test(real), 'BOOT_MARKER must match the real boot line (unchanged behavior)')
  assert.ok(BOOT_MARKER.test(redacted), `BOOT_MARKER no longer matches: ${redacted}`)
  assert.equal(redacted, 'dsh web: http://127.0.0.1:3181/?token=REDACTED')
})

t("the kits' boot-line parser shape survives (port + token capture)", () => {
  const parser = /^http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)$/
  const m = parser.exec(redactLaunchToken(`http://127.0.0.1:3182/?token=${FAKE}`))
  assert.ok(m !== null, 'shape no longer parses')
  assert.equal(m[1], '3182')
  assert.equal(m[2], 'REDACTED')
})

t('only the token VALUE is redacted (other params, fragment, empty value)', () => {
  assert.equal(
    redactLaunchToken(`http://127.0.0.1:3181/?tab=teams&token=${FAKE_SHORT}#frag`),
    'http://127.0.0.1:3181/?tab=teams&token=REDACTED#frag',
  )
  assert.equal(redactLaunchToken('http://127.0.0.1:3181/?token='), 'http://127.0.0.1:3181/?token=REDACTED')
})

t("the internal (request) URL is NOT this helper's business — verbatim in, out", () => {
  // The repair rule: the value start()/ensureProfile RETURN stays verbatim;
  // only the LOGGED string passes through the formatter. The helper is a pure
  // string function — it never mutates its input — so a caller that keeps the
  // original value keeps the working token (proved by the real run: the kit
  // authenticates with the token cookie after the redacted line is printed).
  const url = `http://127.0.0.1:3181/?token=${FAKE_SHORT}`
  assert.equal(url, `http://127.0.0.1:3181/?token=${FAKE_SHORT}`)
  assert.notEqual(redactLaunchToken(url), url)
  assert.equal(url.includes(FAKE_SHORT), true)
})

let failed = 0
for (const r of results) {
  process.stdout.write(`  ${r.ok ? 'PASS' : 'FAIL'} — ${r.label}${r.detail ? ` | ${r.detail}` : ''}\n`)
  if (!r.ok) failed += 1
}
process.stdout.write(`redaction-check: ${results.length - failed}/${results.length} assertions green, exit=${failed === 0 ? 0 : 1}\n`)
process.exit(failed === 0 ? 0 : 1)
