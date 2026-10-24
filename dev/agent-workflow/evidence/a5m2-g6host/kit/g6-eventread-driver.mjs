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
 *    RETAINED after the run per root ruling — deletion forbidden, never a
 *    gate); HOME ≤64MiB is MONITORED DURING the
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
    checks.push({ name: 'home-law', verdict: 'PASS', detail: 'default law: FRESH stamped empty HOME this window (driver mkdirs+monitors <=64MiB; RETAINED after run — no self-deletion, deletion never a gate); no copies of dirs/deps/store' })
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

  // FRESH stamped HOME this window: driver mkdirs + monitors; RETAINED after the run.
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
  // parent exit ≠ group empty (root ruling 2026-10-24): KEEP DRAINING our own
  // PGID until it is EMPTY, bounded at 20s. Group still non-empty at 20s =
  // violation — a non-empty group can never PASS.
  let pgidGone = false
  let pgidDrainMs = 0
  while (pgidDrainMs <= 20_000) {
    try { process.kill(-child.pid, 0); pgidGone = false } catch { pgidGone = true; break }
    // sustained wind-down on OUR PGID only: re-TERM every 2s while it lives.
    if (pgidDrainMs % 2000 === 0) { try { process.kill(-child.pid, 'SIGTERM') } catch {} }
    await new Promise((r) => setTimeout(r, 500))
    pgidDrainMs += 500
  }
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
      const doc = JSON.parse(readFileSync(resultsPath, 'utf8'))
      const verdictById = new Map((doc.verdicts ?? []).map((v) => [v?.id, v?.verdict]))
      for (const r of (doc.results ?? []).filter((x) => ['C2', 'C2b', 'C3'].includes(x?.id))) {
        minimalLines.push(JSON.stringify({ case: r.id, tool: CASE_TOOL[r.id] ?? null, toolUseId: r.toolUseId ?? null, faceFound: r.faceFound ?? null, isError: r.isError ?? null, verdict: verdictById.get(r.id) ?? null }))
      }
    }
  } catch { /* absence recorded below, never faked */ }
  try { writeFileSync(join(outDir, 'toolcalls.jsonl'), minimalLines.join('\n') + (minimalLines.length > 0 ? '\n' : '')) } catch {}
  const toolcallsWritten = minimalLines.length > 0
  if (toolcallsWritten !== true) violations.push('toolcalls.jsonl not produced (kit evidence missing? no fake green)')
  // RAW/HOME RETENTION (root ruling 2026-10-24, binding): the window's raw
  // HOME and evidence are RETAINED — deletion is FORBIDDEN here and can
  // NEVER be a success gate. Nothing below removes anything.
  writeFileSync(join(outDir, 'postflight.json'), JSON.stringify({ code, before, after, post, pgid: child.pid, pgidGone, pgidDrainMs, homeBytes, homeCapBytes: PINS.homeCap, toolcallsWritten, homeRetained: true, retentionNote: 'raw HOME/evidence retained per root ruling; no self-deletion, deletion is not a gate', violations }, null, 2))
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

// ── REAL kit evidence shape (root review 2026-10-24): results.json =
// { results, verdicts, transcript }. results rows are
// { id, status, faceFound, isError, toolResult, toolUseId, expect, ... };
// verdicts rows are { id, verdict, why?, expect?, observed? }. Correlation
// by STABLE case id + toolUseId; tool names come from the STABLE case table
// (never a fabricated field). The business oracle PARSES the readEvent JSON
// payload — same session id / EXACT seq (expected seq taken from the C3 row's
// parsed marker hit) / self-planted marker INSIDE the parsed row content.
// Unparseable shapes FAIL; no substring-of-blob green. ─────────────────────
const CASE_TOOL = { C1: 'session_trace', C2: 'session_event_trace', C2b: 'session_event_read', C3: 'session_event_search', C4: 'session_event_search', C5: 'session_trace', C6: 'session_trace', C7: 'session_trace', C8: 'session_event_search', C10: 'session_trace', C11: 'session_search' }

const parseRows = (text) => {
  if (typeof text !== 'string') return null
  const attempts = [text, (text.match(/\[[\s\S]*\]/) ?? [null])[0], (text.match(/\{[\s\S]*\}/) ?? [null])[0]]
  for (const a of attempts) {
    if (a === null) continue
    try {
      const v = JSON.parse(a)
      const rows = Array.isArray(v) ? v : Array.isArray(v?.rows) ? v.rows : Array.isArray(v?.events) ? v.events : Array.isArray(v?.data) ? v.data : null
      if (Array.isArray(rows)) return rows
    } catch { /* next attempt */ }
  }
  return null
}
const rowField = (row, names) => { for (const n of names) { if (row?.[n] !== undefined) return row[n] } return undefined }

function evaluateErEvidence (kitDir) {
  const p = findFirstFile(kitDir, 'results.json', 3)
  if (p === null) return { verdict: 'FAIL', why: 'kit results.json absent — the positive control cannot be evidenced (never silently green)', positive: null, familyNegatives: [] }
  const doc = JSON.parse(readFileSync(p, 'utf8'))
  const results = Array.isArray(doc.results) ? doc.results : []
  const verdicts = Array.isArray(doc.verdicts) ? doc.verdicts : []
  const row = (id) => results.find((r) => r?.id === id) ?? null
  const verdictOfId = (id) => verdicts.find((v) => v?.id === id)?.verdict ?? 'MISSING'
  const c2b = row('C2b')
  const c3 = row('C3')
  let positive = null
  let why = null
  if (c2b === null) {
    why = 'C2b result row missing'
  } else if (verdictOfId('C2b') !== 'PASS') {
    why = `verdicts[C2b]=${verdictOfId('C2b')}`
  } else if (c2b.status !== 'DONE' || c2b.faceFound !== true || c2b.isError === true || typeof c2b.toolUseId !== 'string') {
    why = 'C2b row not DONE/faceFound/correlated-by-toolUseId'
  } else {
    const readRows = parseRows(c2b.toolResult)
    if (readRows === null) {
      why = 'readEvent payload NOT parseable JSON — structured oracle refuses (no substring green)'
    } else {
      const c3rows = c3 !== null ? parseRows(c3.toolResult) : null
      const expectedSeq = c3rows?.map((r) => Number(rowField(r, ['seq', 'eventSeq', 'sequence']))).find((n) => Number.isFinite(n)) ?? null
      const markerRe = /G6_MARKER_[a-z0-9]+/i
      const hits = readRows.filter((r) => markerRe.test(String(rowField(r, ['content', 'text', 'payload']) ?? '')))
      const sameSeq = expectedSeq === null ? [] : hits.filter((r) => Number(rowField(r, ['seq', 'eventSeq', 'sequence'])) === expectedSeq)
      const sessions = [...new Set(sameSeq.map((r) => String(rowField(r, ['sessionId', 'session_id', 'session']) ?? '')))].filter((s) => s !== '')
      const ownOnly = sessions.length === 1 && sessions[0].startsWith('session-team-g6-')
      const pass = expectedSeq !== null && sameSeq.length > 0 && ownOnly
      if (pass) {
        positive = {
          tool: CASE_TOOL.C2b,
          toolUseId: c2b.toolUseId,
          kitVerdict: 'PASS',
          structured: { parsedRows: readRows.length, expectedSeq, markerHits: hits.length, exactSeqHits: sameSeq.length, session: sessions[0] },
        }
      } else {
        why = `structured oracle: expectedSeq=${String(expectedSeq)} exactSeqHits=${String(sameSeq.length)} sessions=${JSON.stringify(sessions)}`
      }
    }
  }
  const familyNegatives = ['C6', 'C7', 'C10'].map((id) => ({ id, tool: CASE_TOOL[id], toolUseId: row(id)?.toolUseId ?? null, verdict: verdictOfId(id), role: 'FAMILY negative (session_trace lane) — NOT event_read-specific negative-control coverage (root clarification 2026-10-24)' }))
  return { verdict: positive !== null ? 'PASS' : 'FAIL', why, positive, familyNegatives }
}

// ── TARGETED OFFLINE SHAPE CONTROL: REAL minimal kit shapes only (results
// rows {id,status,faceFound,isError,toolResult,toolUseId,expect}; verdicts
// rows {id,verdict}) — no invented fields. ─────────────────────────────────
async function selftest () {
  const out = []
  const t = (name, ok) => out.push(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  const tmp = join(EVIDENCE_BASE, `selftest-${new Date().toISOString().replace(/[:.]/g, '-')}Z`)
  const mk = (dir, c2bToolResult, c2bVerdict) => {
    mkdirSync(join(tmp, dir, 'kit'), { recursive: true })
    const results = [
      { id: 'C3', status: 'DONE', faceFound: true, isError: false, toolUseId: 'tu-c3', expect: 'ok', toolResult: JSON.stringify([{ sessionId: 'session-team-g6-abc', seq: 7, content: 'delegated G6_MARKER_xyz123 task' }]) },
      { id: 'C2b', status: 'DONE', faceFound: true, isError: false, toolUseId: 'tu-c2b', expect: 'ok', toolResult: c2bToolResult },
      { id: 'C6', status: 'DONE', faceFound: true, isError: false, toolUseId: 'tu-c6', expect: 'deny', toolResult: 'CEILING denied' },
      { id: 'C7', status: 'DONE', faceFound: true, isError: false, toolUseId: 'tu-c7', expect: 'deny', toolResult: 'CEILING denied' },
      { id: 'C10', status: 'DONE', faceFound: true, isError: false, toolUseId: 'tu-c10', expect: 'deny', toolResult: 'CEILING denied' },
    ]
    const verdicts = [{ id: 'C3', verdict: 'PASS' }, { id: 'C2b', verdict: c2bVerdict }, { id: 'C6', verdict: 'PASS' }, { id: 'C7', verdict: 'PASS' }, { id: 'C10', verdict: 'PASS' }]
    writeFileSync(join(tmp, dir, 'kit', 'results.json'), JSON.stringify({ results, verdicts, transcript: [] }))
  }
  mk('good', JSON.stringify([{ sessionId: 'session-team-g6-abc', seq: 7, content: 'event with G6_MARKER_xyz123' }]), 'PASS')
  const g = evaluateErEvidence(join(tmp, 'good'))
  t('shape: parsed rows, exact seq 7 (from C3), marker, own session -> green', g.verdict === 'PASS' && g.positive?.structured?.exactSeqHits === 1 && g.positive?.toolUseId === 'tu-c2b' && g.familyNegatives.every((x) => x.role.includes('FAMILY negative')))
  mk('bad1', 'CEILING denied (unknown refusal text)', 'PASS')
  t('shape: unparseable/refusal payload -> NOT green', evaluateErEvidence(join(tmp, 'bad1')).verdict === 'FAIL')
  mk('bad2', JSON.stringify([{ sessionId: 'session-team-g6-abc', seq: 8, content: 'event with G6_MARKER_xyz123' }]), 'PASS')
  t('shape: marker at WRONG seq (8!=7) -> NOT green', evaluateErEvidence(join(tmp, 'bad2')).verdict === 'FAIL')
  mk('bad3', JSON.stringify([{ sessionId: 'session-other-9999', seq: 7, content: 'G6_MARKER_xyz123' }]), 'PASS')
  t('shape: foreign session rows -> NOT green', evaluateErEvidence(join(tmp, 'bad3')).verdict === 'FAIL')
  mk('bad4', JSON.stringify([{ sessionId: 'session-team-g6-abc', seq: 7, content: 'G6_MARKER_xyz123' }]), 'FAIL')
  t('shape: verdicts[C2b]=FAIL -> NOT green', evaluateErEvidence(join(tmp, 'bad4')).verdict === 'FAIL')
  t('shape: absent evidence -> NOT green', evaluateErEvidence(join(tmp, 'none')).verdict === 'FAIL')
  const { source } = deriveKit()
  const line = source.split('\n').find((l) => l.includes("id: 'C2b'")) ?? ''
  t('shape: derived C2b row demands ROOT_G6+seq+marker in the same face', line.includes('ROOT_G6') && line.includes('G6_MARKER_') && line.includes('S.eventSeq'))
  t('shape: --flag parsing matches argv exactly', flag('go') === process.argv.includes('--go') && arg('port', 'D') === (process.argv.includes('--port') ? process.argv[process.argv.indexOf('--port') + 1] : 'D'))
  rmSync(tmp, { recursive: true, force: true })
  for (const l of out) console.log(l)
  process.exit(out.some((l) => l.startsWith('FAIL')) ? 2 : 0)
}

if (process.argv[2] === 'run') { await run() } else if (process.argv[2] === 'selftest') { await selftest() } else { await preflightCli() }
