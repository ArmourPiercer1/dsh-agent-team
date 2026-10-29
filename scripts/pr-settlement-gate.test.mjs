/**
 * pr-settlement-gate.test.mjs — external-consumer unit tests for
 * scripts/pr-settlement-gate.mjs (audit P1-1, ROUTER_RULES §8.5.6).
 *
 * Convention (disclosed in the PR): this follows the existing `scripts/`
 * test-file precedent — eb3-tool-acceptance.test.mjs imports the exported
 * pure function; sanitize-evidence.regression.test.mjs additionally spawns
 * the tool for exit-code evidence. These files run under `node --test` and
 * are NOT collected by the vitest root includes (packages/<pkg>/test) or the
 * census, so no new scannable runtime test surface is added. The workflow-
 * level fixture algebra lives inside the script as `--self-test`.
 *
 * Host-free except the three spawned `--input` end-to-end runs, which read a
 * synthetic JSON in a temp dir — no network, no real PRs.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MARKER_TOKEN, detectMarker, evaluate, findSettlement, firstLine, verdictToken } from './pr-settlement-gate.mjs'

const script = fileURLToPath(new URL('./pr-settlement-gate.mjs', import.meta.url))
const SHA_A = 'a'.repeat(40)
const SHA_B = 'b'.repeat(40)
const settleComment = (sha) => ({
  id: 900,
  body: `**[dated settlement, 2026-10-30T12:0xZ — P1-1 unit fixture]** Independent review APPROVE, seat qiyuan-self/qwen3.8-27b; head covered: ${sha}`,
})

// ------------------------------------------------------------ firstLine law

test('firstLine splits on the FIRST raw newline only, CRLF-safe', () => {
  assert.equal(firstLine('a\r\nb'), 'a')
  assert.equal(firstLine('a\nb\nc'), 'a')
  assert.equal(firstLine(''), '')
  assert.equal(firstLine(undefined), '')
  assert.equal(firstLine('\nDO-NOT-MERGE'), '', 'a leading blank line means line 1 is blank — token on line 2 is NOT the canonical marker')
})

// ------------------------------------------------------------- marker rules

test('marker token is the raw ASCII DO-NOT-MERGE', () => {
  assert.equal(MARKER_TOKEN, 'DO-NOT-MERGE')
})

test('title prefix is a marker; mid-title mention is not', () => {
  assert.equal(detectMarker({ title: 'DO-NOT-MERGE ci(pr-gate): x', body: 'b' }).present, true)
  assert.equal(detectMarker({ title: 'ci(pr-gate): DO-NOT-MERGE handling', body: 'b' }).onTitle, false)
})

test('#455 lesson 1: a body mention outside line 1 is prose', () => {
  const r = detectMarker({ title: 'docs(protocol): settle-before-merge', body: 'The rule: DO-NOT-MERGE means blocked.\n\nMore prose.' })
  assert.equal(r.present, false)
})

test('#455 lesson 2: corner brackets still contain the substring — still prose, never a marker', () => {
  assert.equal(detectMarker({ title: 't', body: '「DO-NOT-MERGE」 mid-body' }).present, false)
})

test('#455 lesson 3: fullwidth hyphen variants are prose on any line', () => {
  assert.equal(detectMarker({ title: 'DO－NOT－MERGE fullwidth title', body: 'DO－NOT－MERGE\nline2' }).present, false)
})

test('marker is case-sensitive and word-bounded', () => {
  assert.equal(detectMarker({ title: 't', body: 'do-not-merge' }).present, false)
  assert.equal(detectMarker({ title: 'DO-NOT-MERGED', body: 'x' }).onTitle, false)
  assert.equal(detectMarker({ title: 't', body: '  DO-NOT-MERGE — leading space tolerated' }).onBodyFirstLine, true)
})

// --------------------------------------------------------- settlement rules

test('settlement needs the closed-set opener on the comment FIRST line', () => {
  const good = settleComment(SHA_A)
  assert.equal(findSettlement([good], SHA_A).settled, true)
  assert.equal(findSettlement([{ ...good, body: `context\n${good.body}` }], SHA_A).settled, false)
  assert.equal(findSettlement([{ ...good, body: good.body.replace('[dated settlement,', '[dated settlement-linkage,') }], SHA_A).settled, false)
})

test('dated label settlement opener also settles', () => {
  const body = settleComment(SHA_A).body.replace('[dated settlement,', '[dated label settlement,')
  assert.equal(findSettlement([{ id: 1, body }], SHA_A).settled, true)
})

test('covered sha must be 40-hex and equal to the CURRENT head; short or stale shas fail', () => {
  assert.equal(findSettlement([settleComment(SHA_B)], SHA_A).settled, false)
  const short = { id: 2, body: settleComment(SHA_A).body.replace(SHA_A, SHA_A.slice(0, 9)) }
  assert.equal(findSettlement([short], SHA_A).settled, false)
  const noSha = { id: 3, body: settleComment(SHA_A).body.replace(SHA_A, '') }
  assert.equal(findSettlement([noSha], SHA_A).settled, false)
  assert.equal(findSettlement([settleComment(SHA_B), settleComment(SHA_A)], SHA_A).settled, true, 'any one settling comment is enough')
})

test('rejected candidates report machine-readable reasons but never settle', () => {
  const r = findSettlement([{ id: 7, body: `**[dated settlement, 2026-10-30T12:0xZ]** covers ${SHA_B}` }], SHA_A)
  assert.equal(r.settled, false)
  assert.equal(r.candidates, 1)
  assert.deepEqual(r.invalid, [{ id: 7, reason: 'SHA_NOT_CURRENT_HEAD' }])
})

// ------------------------------------------------------------- verdict laws

test('marker wins over settlement — §8.5.4: deleting the marker text is the trigger to HAVE settled, not to unblock silently', () => {
  const v = evaluate({ title: 't', body: `DO-NOT-MERGE\nbody`, comments: [settleComment(SHA_A)], headSha: SHA_A })
  assert.equal(v.verdict, 'BLOCKED-BY-MARKER')
  assert.equal(v.exit, 1)
  assert.ok(v.notes.includes('settlement-observed-but-marker-present'))
})

test('no marker + covering settlement passes; no marker + none fails', () => {
  assert.equal(evaluate({ title: 't', body: 'b', comments: [settleComment(SHA_A)], headSha: SHA_A }).verdict, 'PASS')
  const f = evaluate({ title: 't', body: 'b', comments: [], headSha: SHA_A })
  assert.equal(f.verdict, 'FAIL')
  assert.ok(f.reasons.includes('NO_SETTLEMENT_CANDIDATE'))
})

test('invalid head sha is a refusal (ERROR exit 2), never a laundered verdict', () => {
  const v = evaluate({ title: 't', body: 'b', comments: [settleComment(SHA_A)], headSha: 'not-a-sha' })
  assert.equal(v.verdict, 'ERROR')
  assert.equal(v.exit, 2)
})

test('verdictToken is single-line and starts with the token', () => {
  const tok = verdictToken(evaluate({ title: 't', body: 'b', comments: [settleComment(SHA_A)], headSha: SHA_A }))
  assert.doesNotMatch(tok, /\n/)
  assert.match(tok, /^DSH-SETTLEMENT-VERDICT PASS marker=none matches=1/)
})

// -------------------------------------------------- CLI end-to-end (spawned)

function runInput(payload) {
  const dir = mkdtempSync(join(tmpdir(), 'prsg-e2e-'))
  try {
    const file = join(dir, 'pr.json')
    writeFileSync(file, JSON.stringify(payload))
    const res = spawnSync(process.execPath, [script, '--input', file], { encoding: 'utf8', timeout: 15_000 })
    return res
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('CLI --input: marker → exit 1 with BLOCKED token as last line', () => {
  const res = runInput({ title: 't', body: 'DO-NOT-MERGE\nb', comments: [], head_sha: SHA_A })
  assert.equal(res.status, 1)
  const lines = res.stdout.trimEnd().split('\n')
  assert.match(lines.at(-1), /^DSH-SETTLEMENT-VERDICT BLOCKED-BY-MARKER marker=body-first-line/)
})

test('CLI --input: valid settlement → exit 0 with PASS token', () => {
  const res = runInput({ title: 'ci(x): y', body: 'Settled per comment.', comments: [settleComment(SHA_A)], head_sha: SHA_A })
  assert.equal(res.status, 0, res.stdout + res.stderr)
  assert.match(res.stdout, /^DSH-SETTLEMENT-VERDICT PASS/m)
})

test('CLI --input: ungradeable head → exit 2 with ERROR token', () => {
  const res = runInput({ title: 't', body: 'b', comments: [], head_sha: 'zzz' })
  assert.equal(res.status, 2)
  assert.match(res.stdout, /^DSH-SETTLEMENT-VERDICT ERROR /m)
  assert.match(res.stdout, /reasons=HEAD_SHA_INVALID/)
})
