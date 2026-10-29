// Independent detection battery for pr-settlement-gate.mjs — authored by
// review seat qiyuan-self/qwen3.8-flash-next (cross-family), 2026-10-30.
// Each case writes a fixture JSON and spawns `--input`, asserting exit code
// and the DSH-SETTLEMENT-VERDICT token on the LAST stdout line.
import { spawnSync } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const GATE = process.env.GATE ?? new URL('../../../.worktrees/rr-459/scripts/pr-settlement-gate.mjs', import.meta.url).pathname
const A = 'a'.repeat(40)
const B = 'b'.repeat(40)
const settleBody = (sha) => `**[dated settlement, 2026-10-30T12:3xZ — R459 battery]** Independent review APPROVE; head covered: ${sha}`

const cases = [
  // --- task-specified battery (a)-(j) ---
  { id: 'a', name: 'raw ASCII DO-NOT-MERGE title prefix -> BLOCKED',
    in: { title: 'DO-NOT-MERGE — awaiting review', body: 'normal body', head_sha: A, comments: [] },
    wantExit: 1, wantTok: /DSH-SETTLEMENT-VERDICT BLOCKED-BY-MARKER marker=title-prefix/ },
  { id: 'b', name: 'same token as FIRST BODY LINE -> BLOCKED',
    in: { title: 'ci(x): y', body: 'DO-NOT-MERGE\nsecond line', head_sha: A, comments: [] },
    wantExit: 1, wantTok: /DSH-SETTLEMENT-VERDICT BLOCKED-BY-MARKER marker=body-first-line/ },
  { id: 'c1', name: 'mid-body sentence mention + valid settlement -> PASS (prose, #455 L1)',
    in: { title: 'ci(x): y', body: 'This gate detects when DO-NOT-MERGE prefixes the first line.', head_sha: A, comments: [{ body: settleBody(A) }] },
    wantExit: 0, wantTok: /DSH-SETTLEMENT-VERDICT PASS marker=none/ },
  { id: 'c2', name: 'mid-body standalone mention, no settlement -> FAIL not BLOCKED',
    in: { title: 'ci(x): y', body: 'para one\npara two\nDO-NOT-MERGE was mentioned here as prose\n', head_sha: A, comments: [] },
    wantExit: 1, wantTok: /DSH-SETTLEMENT-VERDICT FAIL marker=none/ },
  { id: 'd1', name: 'ASCII token corner-bracketed ON FIRST LINE -> prose (L2)',
    in: { title: 'ci(x): y', body: '「DO-NOT-MERGE」 is mentioned on line 1 as prose\nrest', head_sha: A, comments: [{ body: settleBody(A) }] },
    wantExit: 0, wantTok: /DSH-SETTLEMENT-VERDICT PASS marker=none/ },
  { id: 'd2', name: 'fullwidth brackets fullwidth hyphens mid-body -> prose (L2/L3)',
    in: { title: 'x', body: 'line1\n讨论 【DO－NOT－MERGE】 状态\nline3', head_sha: A, comments: [{ body: settleBody(A) }] },
    wantExit: 0, wantTok: /PASS/ },
  { id: 'e', name: 'U+FF0D fullwidth hyphen as body first line -> prose (L3)',
    in: { title: 'x', body: 'DO－NOT－MERGE\nsecond line', head_sha: A, comments: [{ body: settleBody(A) }] },
    wantExit: 0, wantTok: /PASS marker=none/ },
  { id: 'e2', name: 'U+FF0D variant as title prefix -> prose (L3)',
    in: { title: 'DO－NOT－MERGE 全角', body: 'x', head_sha: A, comments: [{ body: settleBody(A) }] },
    wantExit: 0, wantTok: /PASS/ },
  { id: 'f', name: 'CASE VARIANT Do-Not-Merge first body line + settlement -> per law prose -> PASS (flag as observation)',
    in: { title: 'x', body: 'Do-Not-Merge\nreal marker intended?', head_sha: A, comments: [{ body: settleBody(A) }] },
    wantExit: 0, wantTok: /PASS/ },
  { id: 'f2', name: 'lowercase do-not-merge title prefix, no settlement -> FAIL (not BLOCKED)',
    in: { title: 'do-not-merge wip', body: 'x', head_sha: A, comments: [] },
    wantExit: 1, wantTok: /FAIL marker=none/ },
  { id: 'g', name: 'no marker + valid dated settlement 40-hex=head -> PASS',
    in: { title: 'ci(x): y', body: 'ready-ish', head_sha: A, comments: [{ id: 9, body: settleBody(A) }] },
    wantExit: 0, wantTok: /DSH-SETTLEMENT-VERDICT PASS marker=none matches=1/ },
  { id: 'h', name: 'settlement with 9-hex SHORT sha -> FAIL (needs full 40)',
    in: { title: 'x', body: 'y', head_sha: A, comments: [{ body: settleBody(A.slice(0, 9)) }] },
    wantExit: 1, wantTok: /FAIL .*?reasons=NO_40HEX_SHA/ },
  { id: 'i', name: 'settlement sha != head -> FAIL SHA_NOT_CURRENT_HEAD',
    in: { title: 'x', body: 'y', head_sha: A, comments: [{ body: settleBody(B) }] },
    wantExit: 1, wantTok: /FAIL .*?reasons=SHA_NOT_CURRENT_HEAD/ },
  { id: 'j', name: 'non-closed-set opener settlement-linkage -> diagnostic only, FAIL',
    in: { title: 'x', body: 'y', head_sha: A, comments: [{ body: `**[dated settlement-linkage, 2026-10-29T16:2xZ]** head ${A}` }] },
    wantExit: 1, wantTok: /FAIL .*?reasons=NO_DATED_OPENER_FIRST_LINE/ },

  // --- self-authored adversarial edges ---
  { id: 'k', name: 'opener first line, sha LATER in comment body -> still settles',
    in: { title: 'x', body: 'y', head_sha: A, comments: [{ body: `**[dated settlement, 2026-10-30T09:1xZ]**\n\nseat: fl\nbody\ncovered head: ${A}` }] },
    wantExit: 0, wantTok: /PASS .*matches=1/ },
  { id: 'l', name: 'head_sha UPPERCASE hex -> ERROR exit 2 (refusal, no laundered pass)',
    in: { title: 'x', body: 'y', head_sha: A.toUpperCase(), comments: [{ body: settleBody(A) }] },
    wantExit: 2, wantTok: /ERROR .*reasons=HEAD_SHA_INVALID/ },
  { id: 'm', name: 'DO-NOT-MERGED title (different word) -> prose',
    in: { title: 'DO-NOT-MERGED already shipped', body: 'y', head_sha: A, comments: [{ body: settleBody(A) }] },
    wantExit: 0, wantTok: /PASS/ },
  { id: 'n', name: 'bare DO-NOT-MERGE title, nothing after -> BLOCKED',
    in: { title: 'DO-NOT-MERGE', body: 'y', head_sha: A, comments: [] },
    wantExit: 1, wantTok: /BLOCKED-BY-MARKER/ },
  { id: 'o', name: 'CRLF first body line marker -> BLOCKED',
    in: { title: 'x', body: 'DO-NOT-MERGE\r\nbody', head_sha: A, comments: [] },
    wantExit: 1, wantTok: /BLOCKED-BY-MARKER marker=body-first-line/ },
  { id: 'p', name: 'indented marker on body line 1 -> BLOCKED',
    in: { title: 'x', body: '   DO-NOT-MERGE\nb', head_sha: A, comments: [] },
    wantExit: 1, wantTok: /BLOCKED-BY-MARKER/ },
  { id: 'q', name: 'PR with null body + valid settlement -> PASS',
    in: { title: 'x', body: null, head_sha: A, comments: [{ body: settleBody(A) }] },
    wantExit: 0, wantTok: /PASS/ },
  { id: 'r', name: 'settlement opener NOT on first line -> FAIL',
    in: { title: 'x', body: 'y', head_sha: A, comments: [{ body: `context first line\n${settleBody(A)}` }] },
    wantExit: 1, wantTok: /FAIL/ },
  { id: 's', name: '41-hex string containing head as prefix -> NOT covered (word boundary)',
    in: { title: 'x', body: 'y', head_sha: A, comments: [{ body: `**[dated settlement, 2026-10-30T10:0xZ]** head ${A}f` }] },
    wantExit: 1, wantTok: /FAIL .*?reasons=NO_40HEX_SHA/ },
  { id: 't', name: 'marker + valid settlement -> still BLOCKED (§8.5.1/8.5.4)',
    in: { title: 'x', body: 'DO-NOT-MERGE\ny', head_sha: A, comments: [{ body: settleBody(A) }] },
    wantExit: 1, wantTok: /BLOCKED-BY-MARKER/ },
  { id: 'u', name: 'settlement-shaped TITLE/BODY, no comments -> FAIL (settlement is comments-only)',
    in: { title: 'x', body: `**[dated settlement, 2026-10-30T12:0xZ]** head ${A}`, head_sha: A, comments: [] },
    wantExit: 1, wantTok: /FAIL .*?reasons=NO_SETTLEMENT_CANDIDATE/ },
  { id: 'v', name: 'marker in body line 2 while body line 1 clean, no settlement -> FAIL not BLOCKED',
    in: { title: 'x', body: 'clean first line\nDO-NOT-MERGE\ny', head_sha: A, comments: [] },
    wantExit: 1, wantTok: /FAIL marker=none/ },
  { id: 'w', name: 'two comments: stale settles nothing, current settles -> PASS',
    in: { title: 'x', body: 'y', head_sha: A, comments: [{ body: settleBody(B) }, { body: settleBody(A) }] },
    wantExit: 0, wantTok: /PASS .*matches=1/ },
  { id: 'x1', name: 'missing head_sha in input -> ERROR exit 2',
    in: { title: 'x', body: 'y', comments: [] },
    wantExit: 2, wantTok: /ERROR .*reasons=HEAD_SHA_INVALID/ },
  { id: 'x2', name: 'UPPERCASE hex sha inside settlement (git prints lowercase) -> FAIL',
    in: { title: 'x', body: 'y', head_sha: A, comments: [{ body: settleBody(A.toUpperCase()) }] },
    wantExit: 1, wantTok: /FAIL .*?reasons=NO_40HEX_SHA/ },
]

const dir = mkdtempSync(join(tmpdir(), 'rr459-bat-'))
let pass = 0; let fail = 0
for (const c of cases) {
  const f = join(dir, `${c.id}.json`)
  writeFileSync(f, JSON.stringify(c.in))
  const r = spawnSync(process.execPath, [GATE, '--input', f], { encoding: 'utf8' })
  const out = (r.stdout ?? '') + (r.stderr ?? '')
  const last = (r.stdout ?? '').trimEnd().split('\n').pop() ?? ''
  const okExit = r.status === c.wantExit
  const okTok = c.wantTok.test(last)
  const okLastLine = last.startsWith('DSH-SETTLEMENT-VERDICT')
  if (okExit && okTok && okLastLine) { pass += 1; console.log(`ok   [${c.id}] ${c.name}`) }
  else {
    fail += 1
    console.log(`FAIL [${c.id}] ${c.name}`)
    console.log(`      want exit=${c.wantExit} tok=${c.wantTok}`)
    console.log(`      got  exit=${r.status} lastLine=${JSON.stringify(last)}`)
    if (!okLastLine) console.log(`      note: last stdout line is not the verdict token`)
    console.log(`      stdout:\n${(r.stdout ?? '').split('\n').map((l) => '        ' + l).join('\n')}`)
  }
}
console.log(`battery: pass=${pass} fail=${fail}`)
process.exit(fail === 0 ? 0 : 1)
