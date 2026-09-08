// run-04-filter-backcompat.mjs — deterministic check of the new toolName filter.
//
// Two parts:
//   1. SOURCE VERBATIM: the committed f9-check.mjs must contain exactly the
//      intended filter lines (kind/target/action/toolName), the header doc
//      line, and the updated no-match message — nothing else in phasePending
//      changed.
//   2. SYNTHETIC BEHAVIOR: the pre-fix (3-term) and post-fix (4-term) filter
//      expressions, duplicated verbatim here, are applied to a pending list
//      mirroring the residual world (seq 5/6/14, all toolName-less) plus the
//      expected new request (toolName=write, corr dtest-v2-hard-req-2):
//        a. backward compatibility — with NO toolName key in opts (the G3
//           pending calls), old and new expressions select the identical set;
//        b. selection — with toolName=write, the new expression matches
//           EXACTLY the new request, while the legacy expression matches all
//           four (ambiguous, first = the wrong request);
//        c. exact match — toolName is compared with ===, not substring:
//           'writ' and any other tool name match nothing.
//
// f9-check.mjs is deliberately NOT imported: its top-level main block runs
// on import and process.exit()s. The verbatim source check above is what
// binds this synthetic test to the committed code.
//
// Expected: all PASS, exit 0.

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const WORKTREE = resolve(HERE, '..', '..', '..', '..', '..')
const F9 = join(WORKTREE, 'tests', 'mock', 'scripts', 'f9-check.mjs')

const src = readFileSync(F9, 'utf8')
const lines = []
let fails = 0
const check = (name, ok, detail = '') => {
  lines.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : '  — ' + detail}`)
  if (!ok) fails++
}

// ── 1. source verbatim ─────────────────────────────────────────────────────
const VERBATIM = [
  '  const { kind, target, action, toolName, out } = opts',
  '    (kind === undefined || f.payload.kind === kind)',
  '    && (target === undefined || f.payload.targetInstanceId === target)',
  '    && (action === undefined || String(f.payload.actionName).includes(action))',
  '    && (toolName === undefined || f.payload.toolName === toolName))',
  '//   toolName  exact toolName filter (pending): selects the request that carries the named',
  '//             DSH tool (the frozen external-policy discriminator — a present toolName',
  '//             derives capabilityDomain \'tools\'); requests without a toolName never match',
  '{ kind, target, action, toolName }',
  'deliver the request prompt (b4-requests.md / b6-req.md) first, then re-run',
]
for (const needle of VERBATIM) check(`source contains: ${needle.slice(0, 70)}${needle.length > 70 ? '…' : ''}`, src.includes(needle))
check('source no longer names t41-deny-req.md in the no-match message', !src.includes('t41-deny-req.md'))
check('selftest still defines 23 checks', (src.match(/check\('selftest /g) ?? []).length === 23, `got ${(src.match(/check\('selftest /g) ?? []).length}`)

// ── 2. synthetic behavior ──────────────────────────────────────────────────
// Mirrors the residual world (root session-dtestmts69xkr6b54, W1 = inst-0fi1an617bjs):
// the three toolName-less pendings + the expected new hard-tools request.
const pending = [
  { sequence: 5, payload: { kind: 'leader-approval', targetInstanceId: 'inst-0fi1an617bjs', actionName: 'write', correlation: 'dtest-v2-req-la-2' } },
  { sequence: 6, payload: { kind: 'leader-approval', targetInstanceId: 'inst-0fi1an617bjs', actionName: 'write', correlation: 'dtest-v2-req-self-1' } },
  { sequence: 14, payload: { kind: 'leader-approval', targetInstanceId: 'inst-0fi1an617bjs', actionName: 'write', correlation: 'dtest-v2-hard-req-1' } },
  { sequence: 16, payload: { kind: 'leader-approval', targetInstanceId: 'inst-0fi1an617bjs', actionName: 'write', toolName: 'write', correlation: 'dtest-v2-hard-req-2' } },
]
// Verbatim duplication of the PRE-FIX expression (base 9555aa0):
const oldFilter = (f, o) =>
  (o.kind === undefined || f.payload.kind === o.kind)
  && (o.target === undefined || f.payload.targetInstanceId === o.target)
  && (o.action === undefined || String(f.payload.actionName).includes(o.action))
// Verbatim duplication of the POST-FIX expression (this commit):
const newFilter = (f, o) =>
  (o.kind === undefined || f.payload.kind === o.kind)
  && (o.target === undefined || f.payload.targetInstanceId === o.target)
  && (o.action === undefined || String(f.payload.actionName).includes(o.action))
  && (o.toolName === undefined || f.payload.toolName === o.toolName)
const corrs = (rows) => rows.map((f) => f.payload.correlation).sort()

const g3a = {} // G3-style call: no filters at all (no toolName key)
const g3b = { kind: 'leader-approval', target: 'inst-0fi1an617bjs', action: 'write' }
for (const [label, opts] of [['empty opts', g3a], ['G3-style kind+target+action', g3b]]) {
  const a = corrs(pending.filter((f) => oldFilter(f, opts)))
  const b = corrs(pending.filter((f) => newFilter(f, opts)))
  check(`backward compat (${label}): old and new match sets identical`, JSON.stringify(a) === JSON.stringify(b), `old=${JSON.stringify(a)} new=${JSON.stringify(b)}`)
}

const legacy = pending.filter((f) => oldFilter(f, g3b))
const fixed = pending.filter((f) => newFilter(f, { ...g3b, toolName: 'write' }))
check('legacy filter still ambiguous (matches all 4, first = seq 5, no toolName)', legacy.length === 4 && legacy[0].sequence === 5, `got ${legacy.length} matches, first seq ${legacy[0]?.sequence}`)
check('new toolName filter selects EXACTLY the new request (seq 16, corr dtest-v2-hard-req-2)', fixed.length === 1 && fixed[0].sequence === 16 && fixed[0].payload.correlation === 'dtest-v2-hard-req-2', `got ${fixed.map((f) => f.sequence)}`)
check('exact match: a substring toolName prefix (writ) matches nothing', pending.filter((f) => newFilter(f, { ...g3b, toolName: 'writ' })).length === 0)
check('exact match: a different toolName matches nothing', pending.filter((f) => newFilter(f, { ...g3b, toolName: 'mcp__dtest-mini__write-file' })).length === 0)

console.log(lines.join('\n'))
console.log(`\n[filter-backcompat] ${lines.length - fails} PASS, ${fails} FAIL — ${fails === 0 ? 'OK' : 'FAIL'}`)
process.exit(fails === 0 ? 0 : 1)
