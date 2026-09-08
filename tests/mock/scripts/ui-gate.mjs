// ui-gate.mjs — V2 plan §2.4: one-pass UI gate via playwright-cli.
//
// usage: node ui-gate.mjs <config.json>
//
// Config (JSON):
// {
//   "session": "mocktest",        // playwright-cli session name (default mocktest)
//   "url": null,                  // default: boot-state BOOT_URL (token exchange in-browser)
//   "loadWaitMs": 8000,           // wait after goto before interacting
//   "rootGroup": "未分组",          // optional: collapsed sidebar group to expand first
//   "rootText": "请初始化团队",     // sidebar treeitem text (prefix match via find)
//   "teamTab": "团队",             // tab label; clicked via exact role=tab match (find is
//                                  // ambiguous — sidebar 新建团队 matches the substring too)
//   "varsFile": "state/f9-pending.json",  // optional: JSON object produced by a companion
//                                  // script (f9-check.mjs); its values are interpolated
//                                  // into find/eval/clickEval strings as {{key}} before use
//   "asserts": [
//     { "find": "W1", "expect": "present" },
//     { "find": "已归档", "expect": "absent" },
//     { "eval": "document.querySelectorAll('[data-decision]').length > 0", "expect": "truthy" },
//     { "clickEval": "(() => { const b = document.querySelector('button[data-x]'); if (!b) return 'false'; b.click(); return 'clicked' })()",
//       "expect": "truthy", "settleMs": 6000 }
//   ],
//   "snapshot": "g1"              // -> state/teamtab-<snapshot>.yml + evidence/screenshots/<snapshot>.png
// }
//
// clickEval (F9 repair-r1 assets): an in-page expression that performs a
// deterministic DOM action by data-attribute selector (no text matching —
// the zh button label 允许 collides with the decision badge label). The
// gate PASSES when the returned value is not one of the falsy tokens
// ('' / 'false' / '0' / 'null' / 'undefined') — return the literal string
// 'false' when the action precondition is not met. Optional settleMs waits
// afterwards (catch-up / re-render settle).
//
// Steps: goto (open on first fail) -> wait -> click root treeitem -> click
// team tab -> wait -> run asserts -> snapshot + screenshot -> summary.
// Exit 0 = all asserts pass. The raw find/eval outputs land in
// state/ui-gate-<snapshot>-raw.txt for NOTES citation.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { MOCK_ROOT, STATE_DIR, readBootState, sleep } from './common.mjs'

const configPath = process.argv[2]
if (!configPath) { console.error('usage: node ui-gate.mjs <config.json>'); process.exit(2) }
const cfg = JSON.parse(readFileSync(configPath, 'utf8'))
const session = cfg.session ?? 'mocktest'
const state = readBootState()
const url = cfg.url ?? state.url
const loadWaitMs = cfg.loadWaitMs ?? 8_000
const snapshot = cfg.snapshot ?? 'gate'

// varsFile (optional): a JSON object produced by a companion script
// (f9-check.mjs writes state/f9-pending.json / f9-deny-pending.json /
// f9-policy-pending.json). Its values are interpolated into the
// find/eval/clickEval strings as {{key}} before they reach the page —
// this wires the DUREABLE scan output (the stable ctrl-* requestId) into
// the Playwright asserts without any text matching.
let vars = {}
if (cfg.varsFile) {
  const vp = join(MOCK_ROOT, cfg.varsFile)
  if (!existsSync(vp)) {
    console.error(`[ui-gate] varsFile missing: ${cfg.varsFile} (run the producing script first — f9-check.mjs pending)`);
    process.exit(2)
  }
  vars = JSON.parse(readFileSync(vp, 'utf8'))
}
const interpolate = (s) => String(s).replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? String(vars[k]) : `{{${k}}}`))

process.chdir(MOCK_ROOT) // relative snapshot/screenshot filenames resolve here

// playwright-cli installs as .ps1/.cmd shims that need a shell — resolve the
// real JS entry (@playwright/cli/playwright-cli.js) and spawn node directly
// so array args (find text, eval expressions) survive verbatim.
const CLI_CANDIDATES = [
  process.env.PLAYWRIGHT_CLI_JS,
  join(dirname(process.execPath), 'node_modules', '@playwright', 'cli', 'playwright-cli.js'),
  'C:\\nvm4w\\nodejs\\node_modules\\@playwright\\cli\\playwright-cli.js',
].filter(Boolean)
const cliJs = CLI_CANDIDATES.find((p) => existsSync(p))
if (!cliJs) { console.error(`[ui-gate] playwright-cli JS entry not found (tried: ${CLI_CANDIDATES.join(', ')})`); process.exit(2) }

const pw = (args, { raw = false, timeoutMs = 90_000 } = {}) => {
  const a = raw ? ['--raw', '-s', session, ...args] : ['-s', session, ...args]
  const r = spawnSync(process.execPath, [cliJs, ...a], { encoding: 'utf8', timeout: timeoutMs, cwd: MOCK_ROOT })
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}

const rawLog = []
const note = (s) => { rawLog.push(s); console.log(s.slice(0, 300)) }

// 0 — entry sanity check
const ver = spawnSync(process.execPath, [cliJs, '--version'], { encoding: 'utf8', timeout: 30_000 })
if (ver.status !== 0) { console.error('[ui-gate] playwright-cli failed to run:', (ver.stderr ?? '').slice(0, 200)); process.exit(2) }
console.log(`[ui-gate] playwright-cli ${(ver.stdout ?? '').trim()} (${cliJs})`)

// 1 — navigate (open the session if it does not exist yet)
let g = pw(['goto', url])
if (g.code !== 0) {
  note(`goto failed (first run?) — opening session: ${g.out.slice(0, 160)}`)
  g = pw(['open', url])
  if (g.code !== 0) { console.error(`[ui-gate] open failed: ${g.out.slice(0, 300)}`); process.exit(2) }
}
note(`goto ${url.replace(/token=[^&]*/, 'token=[redacted]')} -> code=${g.code}`)
await sleep(loadWaitMs)

// 2 — click the root treeitem (sidebar). find output leads with CONTEXT
// lines (outer containers) — the matched node is the line whose QUOTED NAME
// matches the search text; refs carry a per-browser-session prefix (f1e49).
function pickRef(out, text, exact = false) {
  let contains = null
  for (const line of out.split('\n')) {
    const m = line.match(/"([^"]+)"[\s\S]*?ref=([A-Za-z0-9]+)/)
    if (!m) continue
    const name = m[1]
    if (exact ? name === text : name.startsWith(text)) return m[2]
    if (!exact && contains === null && name.includes(text)) contains = m[2]
  }
  return contains
}
const clickByText = async (text, what, exact = false) => {
  const f = pw(['find', text], { raw: true })
  const ref = pickRef(f.out, text, exact)
  if (!ref) { note(`find ${what} "${text}": NO REF (out: ${f.out.slice(0, 200)})`); return false }
  const c = pw(['click', ref])
  note(`click ${what} "${text}" ref=${ref} -> code=${c.code}`)
  return c.code === 0
}
if (cfg.rootGroup) {
  const ok = await clickByText(cfg.rootGroup, 'rootGroup', true)
  if (!ok) note(`rootGroup "${cfg.rootGroup}" not found — continuing`)
  await sleep(1_500)
}
if (cfg.rootText) {
  const ok = await clickByText(cfg.rootText, 'root')
  if (!ok) console.error('[ui-gate] root click failed — continuing to asserts for diagnostics')
  await sleep(2_500)
}
if (cfg.teamTab) {
  // exact role=tab text match via eval (snapshot find is document-order and
  // the sidebar's 新建团队 button wins the substring match)
  const e = pw(['eval', `(() => { const t = [...document.querySelectorAll('[role=tab]')].find(x => x.textContent.trim() === ${JSON.stringify(cfg.teamTab)}); if (!t) return 'not-found'; t.click(); return 'clicked' })()`], { raw: true })
  const tabOk = e.out.trim() !== 'not-found'
  note(`teamTab "${cfg.teamTab}" via role=tab eval -> ${e.out.trim() || 'clicked'}`)
  if (!tabOk) console.error('[ui-gate] team tab not found — continuing to asserts for diagnostics')
  await sleep(2_500)
}

// 3 — asserts
let fails = 0
for (const a of cfg.asserts ?? []) {
  if (a.find !== undefined) {
    const text = interpolate(a.find)
    const f = pw(['find', text], { raw: true })
    const present = /ref=[A-Za-z0-9]+/.test(f.out)
    const ok = a.expect === 'absent' ? !present : present
    if (!ok) fails += 1
    note(`${ok ? 'PASS' : 'FAIL'} find "${text}" expect=${a.expect} present=${present}`)
  } else if (a.eval !== undefined) {
    const expr = interpolate(a.eval)
    const e = pw(['eval', expr], { raw: true })
    const v = e.out.trim()
    const falsy = v === '' || v === 'false' || v === '0' || v === 'null' || v === 'undefined'
    const ok = a.expect === 'falsy' ? falsy : !falsy
    if (!ok) fails += 1
    note(`${ok ? 'PASS' : 'FAIL'} eval ${expr.slice(0, 60)}… expect=${a.expect ?? 'truthy'} value=${v.slice(0, 80)}`)
  } else if (a.clickEval !== undefined) {
    // Deterministic in-page DOM action (F9 repair-r1 assets). PASS = the
    // expression's returned value is not a falsy token; the expression is
    // responsible for returning 'false' when its precondition is unmet.
    const expr = interpolate(a.clickEval)
    const e = pw(['eval', expr], { raw: true })
    const v = e.out.trim()
    const falsy = v === '' || v === 'false' || v === '0' || v === 'null' || v === 'undefined'
    const ok = a.expect === 'falsy' ? falsy : !falsy
    if (!ok) fails += 1
    note(`${ok ? 'PASS' : 'FAIL'} clickEval ${expr.slice(0, 60)}… expect=${a.expect ?? 'truthy'} value=${v.slice(0, 80)}`)
    if (a.settleMs) await sleep(a.settleMs)
  } else {
    note(`WARN assert entry has none of find/eval/clickEval — skipped: ${JSON.stringify(a).slice(0, 120)}`)
  }
}

// 4 — snapshot + screenshot (evidence artifacts)
const snap = pw(['snapshot', `--filename=state/teamtab-${snapshot}.yml`])
note(`snapshot -> state/teamtab-${snapshot}.yml code=${snap.code}`)
mkdirSync(join(MOCK_ROOT, 'evidence', 'screenshots'), { recursive: true })
const shot = pw(['screenshot', `--filename=evidence/screenshots/${snapshot}.png`])
note(`screenshot -> evidence/screenshots/${snapshot}.png code=${shot.code}`)

writeFileSync(join(STATE_DIR, `ui-gate-${snapshot}-raw.txt`), rawLog.join('\n---\n'))
console.log(`\n[ui-gate] ${snapshot}: ${fails === 0 ? 'PASS' : `FAIL (${fails})`} — raw log: state/ui-gate-${snapshot}-raw.txt`)
process.exit(fails === 0 ? 0 : 1)
