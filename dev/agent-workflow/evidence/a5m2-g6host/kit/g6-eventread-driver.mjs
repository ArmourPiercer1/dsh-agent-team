#!/usr/bin/env node
/**
 * g6-eventread-driver.mjs — A5M2-G6 session_event_read verification PREPARATION driver.
 *
 * ROOT CARD (2026-10-24, root via UI): G6 session-query line resumed; prep
 * only — NO Host GO, NO port occupancy beyond the borrow law, NO new
 * copies/env supply/store/Host clone, NO long-lived world. Chosen real wired
 * query: `session_event_read` (kit case C2b positive control — business
 * assertions on returned rows, never NO_PLAN / a typed supply refusal
 * counted as positive).
 *
 * REUSE (no re-implementation): the proven G6 kit in THIS directory
 * (g6-host-kit.mjs: Messages protocol over POST /api/session/prompt, the
 * MOUNTED barrier, the full schemaVersion-3 blueprint, the real PA
 * allow/deny lanes through the leader's team_resolve_control, the durable
 * ledger decision=1/consume=1 pairing law) is MECHANICALLY RE-DERIVED here:
 * a fixed PIN-PATCH table re-pins it to the 2fb delivered pack. Every patch
 * anchor must appear EXACTLY ONCE (drift = hard refusal; the old kit file is
 * never edited — the old scene stands).
 *
 * WINDOW LAW (root 2026-10-24 concentrated cards):
 *  - ports: A-slot 3183/3498 BORROWED, only while A is NOT running (main
 *    scheduler confirms A idle + ports free before GO; before-spawn probe
 *    is the mechanical law). B (3184/3499) and stable stay reserved.
 *  - HOME: a FRESH stamped empty HOME for THIS window (driver mkdirs it,
 *    driver removes it after evidence); HOME ≤64MiB is MONITORED DURING the
 *    run (old kit 5GiB/250MiB/200MiB budgets do NOT substitute).
 *  - one-window-one-GO: the GO env token is CONSUMED on first run — a second
 *    run with the same token refuses (marker file, real, not a comment).
 *  - supervision: TERM at 300s, KILL only if the SAME PGID still lives 20s
 *    later; KILL is CANCELLED when the runner exits first. Postflight
 *    enforces: our PGID gone + ports free + fixture bytes unchanged +
 *    HOME ≤64MiB — any violation FAILS the RC (cleanup can never
 *    self-report green from a comment).
 *
 * USAGE (standard --flags):
 *   node g6-eventread-driver.mjs preflight [--world-name <basename>] [--port N] [--mock-port M]
 *   node g6-eventread-driver.mjs run --go     # GO window: ALSO requires env G6_EVENTREAD_GO=<token>
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import net from 'node:net'

const DRIVE_DIR = dirname(realpathSync(new URL(import.meta.url).pathname))
const KIT = join(DRIVE_DIR, 'g6-host-kit.mjs')
const REPO_ROOT = resolve(DRIVE_DIR, '../../../../..')
const PACK_INT = '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/pack-int'
const EVIDENCE_BASE = join(REPO_ROOT, 'dev/agent-workflow/evidence/a5m2-g6host')

// ── fixed delivery pins (root card + center finals 2026-10-24) ────────────
const PINS = {
  packGit: '2fb129cfa23e138248fecc834a42c92238af95fe',
  packTipEquiv: '18c3327e6eb0cbb2b147df32aad2c5653ccb5928 (test-only tip; dist subtree equal — center-verified)',
  tgz: join(PACK_INT, 'out-2fb129cf-20261024T135732Z/dsh-agent-team-0.1.1-alpha.2.tgz'),
  tgzSha: '8077defca120247f3f73dc61867c0b85d4fedfbf84a145284b2a165a2ee8958a',
  install: join(PACK_INT, 'install-8077defc'),
  lockSha: '5dffdafaebfc691b26d6e3c2d1124c8a11d0bb919b784738ddbfb0d962e90088',
  // center's "pkg" pin measured on the INSTALL FIXTURE ROOT package.json
  // (the package.json INSIDE the tgz hashes 08402014… — recorded, distinct).
  pkgSha: '4ef112fb43f058bc5d75293b7c2a0ec37ad8da8691383314c28683355ef5b722',
  hostGit: '639ed015397290b3745d163aafe02ffee4aa3f84',
  hostTree: '/srv/workspace/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use',
  dfFloor: 6_442_450_944, // this window's 6GiB floor
  homeCap: 64 * 1024 * 1024, // fresh HOME this window
}
// 3183/3498 = A槽口 (root 2026-10-24): borrowable ONLY while A is not
// running — the free-probe before spawn is the mechanical law. B + stable reserved.
const RESERVED_PORTS = new Set([3080, 3180, 3181, 3182, 3184, 3497, 3499])
const A_SLOT_PORTS = new Set([3183, 3498])

const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
// STANDARD --flag parsing (root argv card 2026-10-24): value flags read
// '--name <value>'; boolean flags test exact '--name' presence.
const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : dflt }
const flag = (name) => process.argv.includes(`--${name}`)

// ── the PIN-PATCH table (label, from, to): every anchor exactly once ─────
const PATCHES = [
  ['pin-fixture-install',
    '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5m2-wire-g6/tests/homes/.a5m2-g6rc874-fixture-20261023T22-06-00Z/install',
    PINS.install],
  ['pin-lock-sha', '26bf7e77050090eaf194e4a06904ce26c6eb9972c4e260f807e8d2e48cd659bc', PINS.lockSha],
  ['pin-tgz-path', 'out-874f3ae0d-20261023T213601Z', 'out-2fb129cf-20261024T135732Z'],
  ['pin-tgz-sha', 'eda06b4a78bba180c0acef1b25237f3f741917385cd0728ee66adc737b1cd09d', PINS.tgzSha],
  ['law-world-const',
    "const WORLD = join(REPO_ROOT, 'tests/homes', `.a5m2-g6host-${RUN_STAMP}Z`)",
    "const WORLD = join(REPO_ROOT, 'tests/homes', argValue('--world-name', `.a5m2-g6host-${RUN_STAMP}Z`))"],
  ['law-world-name-clean',
    'const WORLD_NAME_CLEAN = `.a5m2-g6host-${RUN_STAMP}Z`.replace(/^\\./, \'\')',
    "const WORLD_NAME_CLEAN = String(argValue('--world-name', `.a5m2-g6host-${RUN_STAMP}Z`)).replace(/^\\./, '')"],
  ['law-world-borrow',
    "ck('world-absent', !existsSync(WORLD), WORLD)",
    "ck('world-law', argValue('--world-name', null) !== null ? (existsSync(WORLD) && readdirSync(WORLD).length === 0) : !existsSync(WORLD), WORLD)"],
  ['law-ports-blacklist',
    'new Set([3080, 3180, 3181, 3182, 3183, 3184, 3497])',
    'new Set([3080, 3180, 3181, 3182, 3184, 3497, 3499])'],
  ['law-default-port', "'--port', 3186", "'--port', 3183"],
  ['law-default-mock', "'--mock-port', 3187", "'--mock-port', 3498"],
  // C2b strict content (root evidence card 2026-10-24, closing): the
  // SAME-correlated tool_result face (kit law :701) must carry the OWN root
  // session, the EXACT seq AND the self-planted marker event content — the
  // bare seq digits alone never judge green; unknown refusal text fails the
  // expect:'ok' law unchanged.
  ['case-c2b-strict-content',
    "{ id: 'C2b', tool: 'session_event_read', input: () => ({ session_id: ROOT_G6, seq: S.eventSeq }), expect: 'ok', mustInclude: () => [String(S.eventSeq)] },",
    "{ id: 'C2b', tool: 'session_event_read', input: () => ({ session_id: ROOT_G6, seq: S.eventSeq }), expect: 'ok', mustInclude: () => [ROOT_G6, String(S.eventSeq), `G6_MARKER_${NONCE}`] },"],
]

function deriveKit () {
  const src = readFileSync(KIT, 'utf8')
  const applied = []
  let out = src
  for (const [label, from, to] of PATCHES) {
    const n = out.split(from).length - 1
    if (n !== 1) throw new Error(`PATCH ANCHOR DRIFT [${label}]: found ${n} occurrences, law says EXACTLY 1 — derived runner NOT produced`)
    out = out.replace(from, to)
    applied.push(label)
  }
  return { source: out, applied }
}

const portFree = (port) => new Promise((res) => {
  const s = net.createServer()
  s.once('error', () => res(false))
  s.once('listening', () => { s.close(() => res(true)) })
  s.listen(port, '127.0.0.1')
})

const dirBytes = (p) => {
  let total = 0
  for (const e of readdirSync(p, { withFileTypes: true })) {
    const ep = join(p, e.name)
    if (e.isDirectory()) total += dirBytes(ep)
    else { try { total += statSync(ep).size } catch { /* mid-walk races: counted 0, monitored again next tick */ } }
  }
  return total
}

// ── the preflight battery (shared: CLI mode AND the mandatory run gate) ──
async function collectPreflight (outDir) {
  mkdirSync(outDir, { recursive: true })
  const checks = []
  const ck = (name, ok, detail, verdict = null) => { checks.push({ name, verdict: verdict ?? (ok === true ? 'PASS' : 'FAIL'), detail: String(detail).slice(0, 400) }) }

  // 1. identity chain (⑤: byte-equality recorded into the receipt)
  ck('tgz-present-and-sha', existsSync(PINS.tgz) && sha256(PINS.tgz) === PINS.tgzSha, PINS.tgz)
  const lockPath = join(PINS.install, 'pnpm-lock.yaml')
  ck('install-lock-sha', existsSync(lockPath) && sha256(lockPath) === PINS.lockSha, lockPath)
  const pkgPath = join(PINS.install, 'package.json')
  ck('install-fixture-pkg-sha (center pkg pin)', existsSync(pkgPath) && sha256(pkgPath) === PINS.pkgSha, pkgPath)
  const head = execFileSync('git', ['-C', PINS.hostTree, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  const dirty = execFileSync('git', ['-C', PINS.hostTree, 'status', '--porcelain'], { encoding: 'utf8' }).trim()
  ck('host639-head', head === PINS.hostGit && dirty === '', `HEAD=${head.slice(0, 10)} dirty=${dirty === '' ? 'clean' : 'DIRTY'}`)

  // 2. the five names, BOTH sides (center's cross-verification ask)
  const libPath = join(PINS.hostTree, 'packages/session-query/tool-session-query/lib/index.js')
  const libSrc = readFileSync(libPath, 'utf8').split('\n')
  const five = ['session_search', 'session_event_search', 'session_trace', 'session_event_trace', 'session_event_read']
  const lines639 = five.map((n) => { const i = libSrc.findIndex((l) => l.includes(`name: "${n}"`)); return { name: n, lib: i >= 0 ? `lib/index.js:${i + 1}` : 'MISSING' } })
  ck('639-five-names', lines639.every((x) => x.lib !== 'MISSING'), JSON.stringify(lines639))
  const packRoot = realpathSync(join(PINS.install, 'node_modules/dsh-agent-team'))
  const g6dist = join(packRoot, 'packages/runtime/dist/packages/runtime/src/plugin/live/governed-families/g6-session-query.mjs')
  const g6src = readFileSync(g6dist, 'utf8')
  ck('2fb-five-names (g6-session-query.mjs A5_G6_TOOL_NAMES)', five.every((n) => g6src.includes(`'${n}',`)), g6dist)
  const hostJsSrc = readFileSync(join(packRoot, 'packages/runtime/dist/packages/runtime/src/plugin/host.js'), 'utf8')
  const takeover = hostJsSrc.split('\n').map((l, i) => l.includes('A5M2-G6 B-SESSION-QUERY') ? i + 1 : 0).filter(Boolean)
  ck('2fb-takeover-lines (host.js LAZY supply)', takeover.length >= 2, `host.js:${takeover.join(',host.js:')}`)

  // 3. production row / glue / seam realpaths (the kit mounts exactly these)
  for (const [label, rel] of [['row-host.js', 'packages/runtime/dist/packages/runtime/src/plugin/host.js'], ['glue-agent-bindings.mjs', 'packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs'], ['seam.mjs', 'packages/runtime/root-binding/harness/seam.mjs'], ['blueprint-validate.js', 'packages/runtime/dist/packages/domain/blueprint/src/validate.js']]) {
    const p = join(packRoot, rel)
    ck(`row-present:${label}`, existsSync(p) && statSync(p).isFile(), realpathSync(p))
  }

  // 4. PIN-PATCH derivation — anchors exactly once, old kit bytes untouched
  let derived
  try {
    derived = deriveKit()
    ck('pinpatch-all-anchors-exact-once', derived.applied.length === PATCHES.length, derived.applied.join(','))
  } catch (e) {
    ck('pinpatch-all-anchors-exact-once', false, String(e?.message ?? e))
  }

  // 5. full blueprint dry-validated by the DELIVERED parser (no boot)
  try {
    const kitSrc = readFileSync(KIT, 'utf8')
    const m = kitSrc.match(/const BLUEPRINT_YAML = `([\s\S]*?)\n`\n/)
    const yaml = m[1].replaceAll('${BLUEPRINT_ID}', 'g6-query-bp')
    const bpMod = await import(pathToFileURL(join(packRoot, 'packages/runtime/dist/packages/domain/blueprint/src/validate.js')).href)
    const core = bpMod.parseBlueprint(yaml)
    ck('blueprint-parser-replay-on-real-source', core?.schemaVersion === 3 && typeof core?.contentHash === 'string', `schemaVersion=${String(core?.schemaVersion)} contentHash=${String(core?.contentHash).slice(0, 16)}…`)
  } catch (e) {
    ck('blueprint-parser-replay-on-real-source', false, String(e?.message ?? e))
  }

  // 6. HOME / ports / df — this window's numbers (6GiB df floor, HOME 64MiB)
  const worldName = arg('world-name', null)
  if (worldName !== null) {
    const w = join(REPO_ROOT, 'tests/homes', worldName)
    ck('world-borrowed-empty', existsSync(w) && readdirSync(w).length === 0, w)
    ck('world-lockfile-absent', !existsSync(join(REPO_ROOT, 'tests/homes', `${worldName.replace(/^\./, '')}.lock`)), `${worldName}.lock`)
  } else {
    checks.push({ name: 'home-law', verdict: 'PASS', detail: 'default law: FRESH stamped empty HOME this window (driver mkdirs+monitors <=64MiB+removes after evidence); no copies of dirs/deps/store' })
  }
  for (const p of [Number(arg('port', 3183)), Number(arg('mock-port', 3498))]) {
    const free = await portFree(p)
    if (RESERVED_PORTS.has(p)) ck(`port-free:${p}`, false, 'RESERVED (B-slot or stable family)')
    else if (A_SLOT_PORTS.has(p)) ck(`port-A-slot-borrow:${p}`, free, free ? 'A-slot borrowable — A NOT running on this port right now' : 'A IS RUNNING here — refusal (borrow law: only while A idle)')
    else ck(`port-free:${p}`, free, 'probe')
  }
  const df = execFileSync('df', ['-B1', REPO_ROOT], { encoding: 'utf8' }).trim().split('\n').pop().split(/\s+/)[3]
  ck('df-floor-6GiB', Number(df) >= PINS.dfFloor, `avail=${df} floor=${PINS.dfFloor}`)
  // root evidence card: the tool defs AS PRESENTED to the model on the live
  // wire cannot be verified offline — independent NOT_VERIFIED, deliberately
  // NOT a halt-gate for the other behavior legs.
  ck('er-model-input-schema-wire', null, 'NOT_VERIFIED offline by design (wire-side tool defs unobservable without boot); not a first-stop gate', 'NOT_VERIFIED')

  const fails = checks.filter((c) => c.verdict === 'FAIL')
  writeFileSync(join(outDir, 'preflight.json'), JSON.stringify({ pins: PINS, fiveNames639: lines639, takeover, checks }, null, 2))
  if (derived !== undefined) writeFileSync(join(outDir, 'derived-kit.source'), derived.source)
  return { checks, fails, derived }
}

async function preflightCli () {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outDir = join(EVIDENCE_BASE, `driver-preflight-${stamp}Z`)
  const { checks, fails } = await collectPreflight(outDir)
  for (const c of checks) console.log(`${c.verdict.padEnd(14)} ${c.name} — ${c.detail.slice(0, 120)}`)
  const count = (v) => checks.filter((c) => c.verdict === v).length
  console.log(`PREFLIGHT ${fails.length === 0 ? 'GREEN' : 'RED'} (PASS=${count('PASS')} FAIL=${count('FAIL')} NOT_VERIFIED=${count('NOT_VERIFIED')} NOT_ATTEMPTED=${count('NOT_ATTEMPTED')}) → ${outDir}`)
  process.exit(fails.length === 0 ? 0 : 2)
}

// one-window-one-GO, REAL: the GO token is consumed on first use.
const goMarker = (token) => join(EVIDENCE_BASE, `go-consumed-${createHash('sha256').update(token).digest('hex').slice(0, 16)}.json`)

async function run () {
  if (!flag('go')) { console.error('run REFUSED: missing --go flag (--go parses as a boolean flag; env token alone is not enough).'); process.exit(20) }
  const token = process.env.G6_EVENTREAD_GO ?? null
  if (token === null) { console.error('run REFUSED: --go seen, but env G6_EVENTREAD_GO=<window token> is missing (double GO law, neither half weakenable).'); process.exit(20) }
  if (existsSync(goMarker(token))) { console.error(`run REFUSED: this GO token was already CONSUMED (${goMarker(token)}). one window = one GO (mechanical).`); process.exit(20) }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outDir = join(EVIDENCE_BASE, `driver-run-${stamp}Z`)
  // THE RUN GATE IS THE FULL PREFLIGHT (safety card 2026-10-24): pins, hashes,
  // fixture bytes, takeover evidence, patch anchors, blueprint, df 6GiB, ports.
  const { fails, derived, checks } = await collectPreflight(join(outDir, 'preflight'))
  if (fails.length > 0) { console.error(`run REFUSED: preflight RED (${fails.map((f) => f.name).join(', ')})`); process.exit(2) }
  writeFileSync(goMarker(token), JSON.stringify({ consumedAt: stamp, runDir: outDir }, null, 2))

  const ports = { host: Number(arg('port', 3183)), mock: Number(arg('mock-port', 3498)) }
  for (const p of [ports.host, ports.mock]) {
    if (RESERVED_PORTS.has(p)) { console.error(`run REFUSED: port ${p} reserved`); process.exit(20) }
  }
  // A-slot borrow: before-probe is the law (A idle NOW); main scheduler confirms before GO.
  const before = { portsFree: await Promise.all([portFree(ports.host), portFree(ports.mock)]), lockSha: sha256(join(PINS.install, 'pnpm-lock.yaml')), pkgSha: sha256(join(PINS.install, 'package.json')) }
  if (before.portsFree.includes(false)) { console.error(`run REFUSED: port not free before-spawn — if A-slot, A IS RUNNING; borrow allowed ONLY while A idle`); process.exit(20) }

  // FRESH stamped HOME this window: driver mkdirs, monitors, removes after.
  const worldName = arg('world-name', `.g6er-${stamp}Z`)
  const worldPath = join(REPO_ROOT, 'tests/homes', worldName)
  if (existsSync(worldPath) && readdirSync(worldPath).length > 0) { console.error('run REFUSED: world exists non-empty (no long-lived reuse)'); process.exit(20) }
  mkdirSync(worldPath, { recursive: true })

  const runnerPath = join(outDir, 'g6-er-derived-kit.mjs')
  writeFileSync(runnerPath, derived.source)
  const receiptPath = join(outDir, 'spawn-receipt.json')
  writeFileSync(receiptPath, JSON.stringify({ stamped: stamp, runnerPath, ports, aSlotBorrow: A_SLOT_PORTS.has(ports.host) || A_SLOT_PORTS.has(ports.mock), world: worldPath, preflightChecks: checks.length, before, note: 'receipt written BEFORE any wait (A/B lesson ④)' }, null, 2))

  const { spawn } = await import('node:child_process')
  const child = spawn(process.execPath, [runnerPath, '--boot', '--port', String(ports.host), '--mock-port', String(ports.mock), '--world-name', worldName, '--evidence-dir', join(outDir, 'kit')], { detached: true, stdio: ['ignore', 'inherit', 'inherit'] })

  // supervision on OUR PGID: TERM@300s; KILL only if the group still lives
  // 20s later; both timers CANCELLED when the runner exits first.
  let killTimer = null
  const termTimer = setTimeout(() => {
    try { process.kill(-child.pid, 'SIGTERM') } catch {}
    killTimer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) { try { process.kill(-child.pid, 'SIGKILL') } catch {} }
    }, 20_000)
  }, 300_000)
  // HOME monitor: fresh HOME ≤64MiB DURING the run (this window's law).
  let homeViolation = null
  const homeTimer = setInterval(() => {
    if (child.exitCode !== null || child.signalCode !== null) return
    try {
      if (existsSync(worldPath) && dirBytes(worldPath) > PINS.homeCap) {
        homeViolation = dirBytes(worldPath)
        process.kill(-child.pid, 'SIGKILL')
      }
    } catch {}
  }, 5_000)
  const code = await new Promise((res) => child.once('exit', (c) => res(c)))
  clearTimeout(termTimer); if (killTimer !== null) clearTimeout(killTimer); clearInterval(homeTimer)

  // postflight: REAL enforcement facts (any violation fails the RC).
  const after = { portsFree: await Promise.all([portFree(ports.host), portFree(ports.mock)]) }
  let pgidGone = false
  try { process.kill(-child.pid, 0); pgidGone = false } catch { pgidGone = true }
  const post = { lockSha: sha256(join(PINS.install, 'pnpm-lock.yaml')), pkgSha: sha256(join(PINS.install, 'package.json')) }
  let homeBytes = null
  try { if (existsSync(worldPath)) homeBytes = dirBytes(worldPath) } catch {}
  const violations = []
  if (pgidGone !== true) violations.push(`own PGID ${child.pid} still alive post-run (descendants not cleaned)`)
  if (after.portsFree.includes(false)) violations.push(`ports ${ports.host}/${ports.mock} not free post-run (our cleanup incomplete)`)
  if (post.lockSha !== before.lockSha || post.pkgSha !== before.pkgSha) violations.push('fixture lock/pkg bytes CHANGED during run (install-freeze violated)')
  if (homeViolation !== null) violations.push(`HOME exceeded 64MiB mid-run (${String(homeViolation)}B) — killed`)
  else if (homeBytes !== null && homeBytes > PINS.homeCap) violations.push(`HOME ${String(homeBytes)}B > 64MiB at close`)
  else if (homeBytes === null) violations.push('HOME bytes UNKNOWN at close (never silently green)')
  // ER evidence: POSITIVE column (C2b, session_event_read, own session only,
  // same-tool_use_id correlated face carrying ROOT session + exact seq +
  // self-planted marker via the patched kit law) and FAMILY NEGATIVES column
  // (C6/C7/C10 ride session_trace — family negatives ONLY, never counted as
  // event_read negative-control coverage; root clarification 2026-10-24).
  const er = evaluateErEvidence(join(outDir, 'kit'))
  writeFileSync(join(outDir, 'er-verdict.json'), JSON.stringify(er, null, 2))
  if (er.verdict !== 'PASS') violations.push(`eventread POSITIVE column not green: ${er.why ?? JSON.stringify(er.positive)}`)
  // toolcalls.jsonl — MINIMAL per root: session/seq/marker/result CORRELATION
  // references only, not full payloads.
  const minimalLines = []
  try {
    const resultsPath = findFirstFile(join(outDir, 'kit'), 'results.json', 3)
    if (resultsPath !== null) {
      const results = JSON.parse(readFileSync(resultsPath, 'utf8')).results ?? []
      for (const r of results.filter((x) => ['session_event_read', 'session_event_trace', 'session_event_search'].includes(x?.tool))) {
        minimalLines.push(JSON.stringify({ step: r.id ?? null, tool: r.tool, callId: r.callId ?? null, sessionId: r.sessionId ?? 'own(ROOT_G6)', seq: r.seq ?? 'S.eventSeq (runtime)', marker: 'G6_MARKER_<NONCE> (same correlated face)', resultCorrelated: r.faceFound ?? null, verdict: r.verdict ?? null }))
      }
    }
  } catch { /* absence recorded below, never faked */ }
  try { writeFileSync(join(outDir, 'toolcalls.jsonl'), minimalLines.join('\n') + (minimalLines.length > 0 ? '\n' : '')) } catch {}
  const toolcallsWritten = minimalLines.length > 0
  if (toolcallsWritten !== true) violations.push('toolcalls.jsonl not produced (kit evidence missing? no fake green)')
  // own fresh HOME cleanup AFTER evidence closed (no long-lived world)
  let worldRemoved = false
  try { rmSync(worldPath, { recursive: true, force: true }); worldRemoved = !existsSync(worldPath) } catch {}
  if (worldRemoved !== true) violations.push(`own world ${worldPath} not removed at close (fresh-HOME law)`)
  writeFileSync(join(outDir, 'postflight.json'), JSON.stringify({ code, before, after, post, pgid: child.pid, pgidGone, homeBytes, homeCapBytes: PINS.homeCap, toolcallsWritten, worldRemoved, violations }, null, 2))
  console.log(`driver run exit=${code}; violations=${violations.length === 0 ? 'NONE' : violations.join(' | ')}; evidence ${outDir}`)
  process.exit(violations.length === 0 ? (code ?? 1) : 2)
}

function findFirstFile (dir, name, depth) {
  if (!existsSync(dir) || depth < 0) return null
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isFile() && e.name === name) return p
    if (e.isDirectory()) { const hit = findFirstFile(p, name, depth - 1); if (hit !== null) return hit }
  }
  return null
}

function evaluateErEvidence (kitDir) {
  const p = findFirstFile(kitDir, 'results.json', 3)
  if (p === null) return { verdict: 'FAIL', why: 'kit results.json absent — the positive control cannot be evidenced (never silently green)', positive: null, familyNegatives: [] }
  const results = (JSON.parse(readFileSync(p, 'utf8')).results ?? [])
  const byId = (id) => results.find((r) => r?.id === id) ?? null
  const c2b = byId('C2b')
  const positive = c2b === null
    ? null
    : {
        tool: c2b.tool ?? null,
        verdict: c2b.verdict ?? null,
        sameToolUseIdCorrelated: c2b.faceFound ?? null,
        strictContent: 'ROOT_G6 + exact runtime seq + self-planted G6_MARKER content, all in the SAME correlated tool_result face (patched kit law); unknown refusal text fails expect:ok',
      }
  const positiveGreen = positive !== null && positive.verdict === 'PASS' && positive.sameToolUseIdCorrelated !== false
  const familyNegatives = ['C6', 'C7', 'C10'].map((id) => {
    const r = byId(id)
    return { id, tool: r?.tool ?? 'session_trace', verdict: r?.verdict ?? 'MISSING', role: 'FAMILY negative (session_trace lane) — NOT event_read-specific negative-control coverage (root clarification 2026-10-24)' }
  })
  return { verdict: positiveGreen ? 'PASS' : 'FAIL', why: positiveGreen ? null : (c2b?.why ?? 'C2b missing or not PASS'), positive, familyNegatives }
}

// TARGETED OFFLINE SHAPE CONTROL (no boot, no spawn, no world): synthetic kit
// evidence drives evaluateErEvidence + the patched C2b row's presence.
async function selftest () {
  const out = []
  const t = (name, ok) => out.push(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  const tmp = join(EVIDENCE_BASE, `selftest-${new Date().toISOString().replace(/[:.]/g, '-')}Z`)
  mkdirSync(join(tmp, 'good/kit'), { recursive: true })
  writeFileSync(join(tmp, 'good/kit/results.json'), JSON.stringify({ results: [
    { id: 'C2b', tool: 'session_event_read', verdict: 'PASS', faceFound: true },
    { id: 'C6', tool: 'session_trace', verdict: 'PASS' },
    { id: 'C7', tool: 'session_trace', verdict: 'PASS' },
    { id: 'C10', tool: 'session_trace', verdict: 'PASS' },
  ] }))
  const g = evaluateErEvidence(join(tmp, 'good'))
  t('shape: structured PASS face -> positive column green + negatives labeled FAMILY', g.verdict === 'PASS' && g.familyNegatives.every((x) => x.role.includes('FAMILY negative')))
  mkdirSync(join(tmp, 'bad/kit'), { recursive: true })
  writeFileSync(join(tmp, 'bad/kit/results.json'), JSON.stringify({ results: [{ id: 'C2b', tool: 'session_event_read', verdict: 'FAIL', why: 'no tool_result face correlated to the case tool_use_id' }] }))
  t('shape: uncorrelated/refusal text face -> NOT green', evaluateErEvidence(join(tmp, 'bad')).verdict === 'FAIL')
  t('shape: absent evidence -> NOT green', evaluateErEvidence(join(tmp, 'none')).verdict === 'FAIL')
  const { source } = deriveKit()
  const line = source.split('\n').find((l) => l.includes("id: 'C2b'")) ?? ''
  t('shape: derived C2b row demands ROOT_G6+seq+marker in the same face', line.includes('ROOT_G6') && line.includes('G6_MARKER_') && line.includes('S.eventSeq'))
  // argv shape law
  t('shape: --flag parsing matches argv exactly', flag('go') === process.argv.includes('--go') && arg('port', 'D') === (process.argv.includes('--port') ? process.argv[process.argv.indexOf('--port') + 1] : 'D'))
  rmSync(tmp, { recursive: true, force: true })
  for (const l of out) console.log(l)
  process.exit(out.some((l) => l.startsWith('FAIL')) ? 2 : 0)
}

if (process.argv[2] === 'run') { await run() } else if (process.argv[2] === 'selftest') { await selftest() } else { await preflightCli() }
