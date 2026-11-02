#!/usr/bin/env node
/**
 * a5sf-diag.test.mjs — R4 / BL-12 coverage for `scripts/a5sf-diag.mjs`.
 *
 * No Host, no network, no port, no DSH_HOME: the tool reads JSONL rows from
 * disk and delegates classification to `scripts/diag-call-chain.mjs` (PR #394).
 * Fixtures live next to this file and are read as FILES so the `file:line`
 * citations the report prints are exercised, not simulated.
 *
 * Run: node --test tests/a5sf-diag/a5sf-diag.test.mjs
 *
 * The four required legs (BL-12):
 *   L1 a clean run reports no finding and does not flag a LEGITIMATE narrowed
 *      allow (compiled `ask` + durable consumed row — the R1 reference model);
 *   L2 a synthetic bypass (allow with no durable approval row) IS a finding;
 *   L3 a mis-scoped allow (tool absent from the compiled ceiling / locator
 *      outside it) IS a finding;
 *   L4 a failure classification passes through UNCHANGED — the string printed
 *      is the one the PR #394 table produces, compared against that table
 *      imported directly (a copy would drift and fail).
 *
 * Single-source laws:
 *   S1 the tool imports (does not restate) `scripts/diag-call-chain.mjs` and the
 *      P1 locator algebra; its source must not embed a classification row.
 *   S2 the tool refuses an input with no call rows (exit 2) instead of printing
 *      a clean report — an empty answer is never "nothing wrong".
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import test, { after } from 'node:test'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const TOOL = resolve(HERE, '..', '..', 'scripts', 'a5sf-diag.mjs')
const FIXTURES = join(HERE, 'fixtures')
const scratch = mkdtempSync(join(tmpdir(), 'a5sf-diag-'))
after(() => rmSync(scratch, { recursive: true, force: true }))

const { attribute } = await import(resolve(HERE, '..', '..', 'scripts', 'diag-call-chain.mjs'))

const run = (args) => spawnSync(process.execPath, [TOOL, ...args], { encoding: 'utf8', timeout: 30_000 })
const line = (out, token) => out.split(/\r?\n/).find((l) => l.startsWith(token))

test('L1 clean run: no APPROVAL_BYPASS, and a durable-approval narrowed allow stays clean', () => {
  const r = run([join(FIXTURES, 'clean.jsonl')])
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.equal(line(r.stdout, 'APPROVAL_BYPASS'), undefined, r.stdout)
  const legit = line(r.stdout, 'ALLOW_LEGITIMATE')
  assert.ok(legit, r.stdout)
  assert.match(legit, /callId=c2\b/)
  assert.match(legit, /requestId=req-clean-1\b/)
  assert.match(r.stdout, /SUMMARY calls=3 .*findings=0\b/)
  assert.match(r.stdout, /legitimate_narrowed=1\b/)
})

test('L2 synthetic bypass: allow in the compiled ask lane with NO durable row is a finding', () => {
  const r = run([join(FIXTURES, 'bypass.jsonl')])
  assert.equal(r.status, 1, r.stdout + r.stderr)
  const f1 = line(r.stdout, 'APPROVAL_BYPASS')
  assert.ok(f1, r.stdout)
  assert.match(f1, /code=ALLOW_WITHOUT_DURABLE_APPROVAL\b/)
  assert.match(f1, /callId=c1\b/)
  assert.match(f1, /compiled=ask\b/)
  assert.match(f1, /bypass\.jsonl:2\b/)
  // a durable row that exists but names another tool does NOT authorize this call
  const f2 = r.stdout.split(/\r?\n/).filter((l) => l.startsWith('APPROVAL_BYPASS'))[1]
  assert.ok(f2, r.stdout)
  assert.match(f2, /code=APPROVAL_SCOPE_MISMATCH\b/)
  assert.match(f2, /callId=c2\b/)
  assert.match(r.stdout, /findings=2\b/)
})

test('L3 mis-scoped allow: locator outside the ceiling and tool absent from it are findings', () => {
  const r = run([join(FIXTURES, 'miscope.jsonl')])
  assert.equal(r.status, 1, r.stdout + r.stderr)
  const all = r.stdout.split(/\r?\n/).filter((l) => l.startsWith('APPROVAL_BYPASS'))
  assert.equal(all.length, 2, r.stdout)
  const outside = all.find((l) => l.includes('code=ALLOW_OUTSIDE_COMPILED_CEILING'))
  assert.ok(outside, r.stdout)
  assert.match(outside, /miscope\.jsonl:2\b/)
  assert.match(outside, /compiled=deny\b/)
  const noTool = all.find((l) => l.includes('code=TOOL_NOT_IN_COMPILED_CEILING'))
  assert.ok(noTool, r.stdout)
  assert.match(noTool, /miscope\.jsonl:3\b/)
  assert.match(noTool, /tool=bash\b/)
})

test('L4 failure classification passes the PR #394 class string through unchanged', () => {
  const r = run([join(FIXTURES, 'failure.jsonl')])
  assert.equal(r.status, 0, r.stdout + r.stderr)
  const lines = r.stdout.split(/\r?\n/).filter((l) => l.startsWith('FAILURE_CLASS '))
  assert.equal(lines.length, 2, r.stdout)
  const expected = attribute('refused-admission', 'APPROVAL_DENIED')
  assert.match(lines[0], /code=APPROVAL_DENIED\b/)
  assert.match(lines[0], new RegExp(`attribution=${expected.verdict}\\b`))
  assert.match(lines[1], /code=GRANT_STALE\b/)
  assert.equal(line(r.stdout, 'FAILURE_CLASS_GAP'), undefined, r.stdout)
  assert.match(r.stdout, /SUMMARY .*gaps=0\b/)
})

test('L4b a Sandbox-First compiler refusal the table cannot express is DISCLOSED, not extended', () => {
  const r = run([join(FIXTURES, 'gap.jsonl')])
  assert.equal(r.status, 1, r.stdout + r.stderr)
  const gaps = r.stdout.split(/\r?\n/).filter((l) => l.startsWith('FAILURE_CLASS_GAP'))
  assert.equal(gaps.length, 2, r.stdout)
  assert.match(gaps[0], /code=MEMBER_GENERATION_STALE\b/)
  assert.match(gaps[0], /source=a5sf-compiler\b/)
  assert.match(gaps[1], /code=IO_POLICY_UNSUPPORTED\b/)
  assert.match(gaps[1], /overlappingAlpha5String=true\b/)
  assert.match(r.stdout, /SUMMARY .*gaps=2\b/)
  // the pass-through arm still works in the same report
  assert.ok(line(r.stdout, 'FAILURE_CLASS '), r.stdout)
})

test('S1 single source: imports the PR #394 table and the P1 locator algebra; embeds no row', () => {
  const src = readFileSync(TOOL, 'utf8')
  assert.match(src, /from '\.\/diag-call-chain\.mjs'/)
  assert.match(src, /path-rules\.ts/)
  assert.match(src, /matchLocator/)
  // a copied vocabulary would show a code-to-face row shape in this file
  assert.doesNotMatch(src, /APPROVAL_DENIED\s*:\s*\[/)
  assert.doesNotMatch(src, /UNKNOWN_CODE\s*=\s*'UNKNOWN_CODE'/)
})

test('S2 a directory with no call rows is REFUSED (exit 2), never a clean report', () => {
  const empty = join(scratch, 'empty')
  mkdirSync(empty, { recursive: true })
  writeFileSync(join(empty, 'only-ceiling.jsonl'), '{"kind":"ceiling","member":"alpha","tools":[]}\n')
  const r = run([empty])
  assert.equal(r.status, 2, r.stdout + r.stderr)
  assert.match(r.stdout, /REFUSED NO_CALL_ROWS/)
})

test('S3 a malformed row is reported ROW_INVALID and never crashes the report', () => {
  const dir = join(scratch, 'malformed')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'rows.jsonl'), [
    '{"kind":"call","callId":"c1","member":"alpha"}',
    '{"kind":"failure","callId":"c2"}',
    '{"kind":"ceiling","member":"alpha","tools":[{"tool":"read","read":{"mode":"restricted","allow":[],"ask":[],"deny":[]}}]}',
    '{"kind":"call","callId":"c3","member":"alpha","tool":"read","axis":"read","locator":"/work/alpha/f","lane":"allow"}',
    '{"kind":"diag-note","text":"ignored by contract"}',
  ].join('\n'))
  const r = run([dir])
  assert.equal(r.status, 1, r.stdout + r.stderr)
  const invalid = r.stdout.split(/\r?\n/).filter((l) => l.startsWith('ROW_INVALID'))
  assert.equal(invalid.length, 2, r.stdout)
  assert.match(r.stdout, /SUMMARY .*undecidable=2\b/)
})
