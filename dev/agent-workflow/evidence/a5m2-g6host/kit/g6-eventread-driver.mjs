#!/usr/bin/env node
/**
 * g6-eventread-driver.mjs — A5M2-G6 session_event_read verification PREPARATION driver.
 *
 * ROOT CARD (2026-10-24, root via UI): G6 session-query line resumed; prep
 * only — NO Host GO, NO port occupancy, NO new world/install/tree/store, the
 * two existing worlds are off-peak BORROWED under the main scheduler. Chosen
 * real wired query: `session_event_read` (kit case C2b positive control —
 * business-success assertions on returned rows, never NO_PLAN / a typed
 * supply refusal counted as positive).
 *
 * REUSE (no re-implementation): the proven G6 kit in THIS directory
 * (g6-host-kit.mjs: Messages protocol over POST /api/session/prompt, the
 * MOUNTED barrier, the full schemaVersion-3 blueprint, the real PA
 * allow/deny lanes through the leader's team_resolve_control, the durable
 * ledger decision=1/consume=1 pairing law) is MECHANICALLY RE-DERIVED here:
 * a fixed PIN-PATCH table re-pins it to the 2fb delivered pack and to the
 * borrow-a-pre-allocated-empty-world law. Every patch anchor must appear
 * EXACTLY ONCE (a drift = hard preflight refusal — the old kit file is
 * never edited; the old scene stands).
 *
 * SIX A/B LESSONS carried in this driver's 判据/采集层:
 *  ① collection dual-protocol lives in the derived kit; the postflight
 *     collector here writes the minimal toolcalls.jsonl + a receipt;
 *  ② positive control = business assertions in the kit's C2b (lossless);
 *  ③ refusal formats unknown to the kit verdict law FAIL (kit law, kept);
 *  ④ spawn-receipt written BEFORE any wait; TERM@300/KILL@320; ports
 *     probed before AND after; cleanup reports only our PGID + ports;
 *  ⑤ fixture lock/pkg byte-equality recorded pre/post into the receipt;
 *  ⑥ one window one GO (the run gate refuses twice), halt-first.
 *
 * Borrow law (root 2026-10-24 clarification): NO copies of dirs/deps, NO new
 * store, NO Host clone, NO long-lived world — but a FRESH stamped small HOME
 * for THIS window (≤64MiB, asserted post-run from the kit footprint.json) is
 * the DEFAULT; ports default to the A-slot 3183/3498 and are usable ONLY
 * while A is not running (the before-probe is the law); an explicit
 * --world-name must pre-exist EMPTY.
 *
 * USAGE:
 *   node g6-eventread-driver.mjs preflight [--world-name <basename>] [--port N] [--mock-port M]
 *   node g6-eventread-driver.mjs run --go            # GO-window only: also requires env G6_EVENTREAD_GO=1
 * The run mode spawns: node <derived-kit> --boot --port 3183 --mock-port 3498 [fresh HOME this window]
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import net from 'node:net'

const DRIVE_DIR = dirname(realpathSync(new URL(import.meta.url).pathname))
const KIT = join(DRIVE_DIR, 'g6-host-kit.mjs')
const REPO_ROOT = resolve(DRIVE_DIR, '../../../../..')
const PACK_INT = '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/pack-int'

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
  dfFloor: 6_442_450_944,
}
// 3183/3498 = A槽口，root 2026-10-24 裁定可借——LAW: 仅当 A 未运行（free-probe 即法）；
// 3184/3499 (B) 与 stable/3182/3497 保持 reserved。
const RESERVED_PORTS = new Set([3080, 3180, 3181, 3182, 3184, 3497, 3499])
const A_SLOT_PORTS = new Set([3183, 3498])

const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')

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
]

const arg = (name, dflt) => { const i = process.argv.indexOf(name); return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : dflt }

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

async function preflight () {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outDir = join(REPO_ROOT, 'dev/agent-workflow/evidence/a5m2-g6host', `driver-preflight-${stamp}Z`)
  mkdirSync(outDir, { recursive: true })
  const checks = []
  const ck = (name, ok, detail) => { checks.push({ name, verdict: ok === true ? 'PASS' : 'FAIL', detail: String(detail).slice(0, 400) }) }

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
  const hostJs = join(packRoot, 'packages/runtime/dist/packages/runtime/src/plugin/host.js')
  const hostJsSrc = readFileSync(hostJs, 'utf8')
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
    const kitAfter = readFileSync(KIT, 'utf8')
    ck('old-kit-unmodified', kitAfter === readFileSync(KIT, 'utf8'), KIT)
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

  // 6. HOME law (root 2026-10-24 clarification): a FRESH stamped HOME for THIS
  // window is legal (≤64MiB — asserted post-run from the kit footprint.json);
  // an explicitly named world must PRE-EXIST EMPTY (no long-lived world reuse,
  // no directory/dependency copies either way — the mount is the INSTALL
  // realpath, never a copy).
  const worldName = arg('world-name', null)
  if (worldName !== null) {
    const w = join(REPO_ROOT, 'tests/homes', worldName)
    ck('world-borrowed-empty', existsSync(w) && readdirSync(w).length === 0, w)
    ck('world-lockfile-absent', !existsSync(join(REPO_ROOT, 'tests/homes', `${worldName.replace(/^\./, '')}.lock`)), `${worldName}.lock`)
  } else {
    checks.push({ name: 'home-law', verdict: 'PASS', detail: 'no --world-name: a FRESH stamped HOME this window is the default law (≤64MiB asserted post-run); driver never copies dirs/deps' })
  }
  for (const p of [Number(arg('port', 3183)), Number(arg('mock-port', 3498))]) {
    const free = await portFree(p)
    if (RESERVED_PORTS.has(p)) ck(`port-free:${p}`, false, 'RESERVED (B-slot or stable family)')
    else if (A_SLOT_PORTS.has(p)) ck(`port-A-slot-borrow:${p}`, free, free ? 'A-slot BORROWED-OK — A is not running on this port right now' : 'A IS RUNNING here — refusal (borrow law: only while A idle)')
    else ck(`port-free:${p}`, free, 'probe')
  }
  const df = execFileSync('df', ['-B1', REPO_ROOT], { encoding: 'utf8' }).trim().split('\n').pop().split(/\s+/)[3]
  ck('df-floor', Number(df) >= PINS.dfFloor, `avail=${df} floor=${PINS.dfFloor}`)

  const fails = checks.filter((c) => c.verdict === 'FAIL')
  writeFileSync(join(outDir, 'preflight.json'), JSON.stringify({ pins: PINS, fiveNames639: lines639, takeover, checks }, null, 2))
  if (derived !== undefined) writeFileSync(join(outDir, 'derived-kit.source'), derived.source)
  for (const c of checks) console.log(`${c.verdict.padEnd(14)} ${c.name} — ${c.detail.slice(0, 120)}`)
  console.log(`PREFLIGHT ${fails.length === 0 ? 'GREEN' : 'RED'} (${checks.length} checks, ${fails.length} fail) → ${outDir}`)
  process.exit(fails.length === 0 ? 0 : 2)
}

async function run () {
  // ⑥ one window one GO: refuse without BOTH the flag and the env token, and
  // refuse a second time once a run-receipt exists for this world.
  if (arg('go', null) !== 'go' || process.env.G6_EVENTREAD_GO !== '1') {
    console.error('run REFUSED: no Host GO. Requires --go AND env G6_EVENTREAD_GO=1 issued by the main scheduler for this exact window.')
    process.exit(20)
  }
  const worldName = arg('world-name', null) // absent = FRESH stamped HOME this window (root law 2026-10-24; ≤64MiB asserted post-run)
  const { source } = deriveKit()
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outDir = join(REPO_ROOT, 'dev/agent-workflow/evidence/a5m2-g6host', `driver-run-${stamp}Z`)
  mkdirSync(outDir, { recursive: true })
  const runnerPath = join(outDir, 'g6-er-derived-kit.mjs')
  writeFileSync(runnerPath, source)
  const ports = { host: Number(arg('port', 3183)), mock: Number(arg('mock-port', 3498)) }
  const receiptPath = join(outDir, 'spawn-receipt.json')
  // ④ ports before; fixture bytes before (⑤)
  const before = { portsFree: await Promise.all([portFree(ports.host), portFree(ports.mock)]), lockSha: sha256(join(PINS.install, 'pnpm-lock.yaml')), pkgSha: sha256(join(PINS.install, 'package.json')) }
  if (before.portsFree.includes(false)) { console.error(`run REFUSED: port not free before-spawn — if ${ports.host}/${ports.mock} is the A-slot, A IS RUNNING; borrow law allows it ONLY while A is idle`); process.exit(20) }
  writeFileSync(receiptPath, JSON.stringify({ stamped: stamp, runnerPath, ports, aSlotBorrow: A_SLOT_PORTS.has(ports.host) || A_SLOT_PORTS.has(ports.mock), world: worldName === null ? 'FRESH stamped HOME (kit default)' : join(REPO_ROOT, 'tests/homes', worldName), before, note: 'receipt written BEFORE any wait (A/B lesson ④)' }, null, 2))
  const { spawn } = await import('node:child_process')
  const child = spawn(process.execPath, [runnerPath, '--boot', '--port', String(ports.host), '--mock-port', String(ports.mock), ...(worldName === null ? [] : ['--world-name', worldName]), '--evidence-dir', join(outDir, 'kit')], { detached: true, stdio: ['ignore', 'join', 'join'].map((x) => x === 'join' ? 'inherit' : 'ignore') })
  const TERM_AT = 300_000
  const KILL_AT = 320_000
  const t1 = setTimeout(() => { try { process.kill(-child.pid, 'SIGTERM') } catch {} }, TERM_AT)
  const t2 = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL') } catch {} }, KILL_AT)
  const code = await new Promise((res) => child.once('exit', (c) => res(c)))
  clearTimeout(t1); clearTimeout(t2)
  const after = { portsFree: await Promise.all([portFree(ports.host), portFree(ports.mock)]) }
  // fresh-HOME ≤64MiB law (root 2026-10-24): read the kit footprint evidence.
  const findFootprint = (dir, depth = 0) => {
    if (depth > 3) return null
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name)
      if (e.isFile() && e.name === 'footprint.json') return p
      if (e.isDirectory()) { const hit = findFootprint(p, depth + 1); if (hit !== null) return hit }
    }
    return null
  }
  let homeBytes = null
  try {
    const fpPath = findFootprint(join(outDir, 'kit'))
    if (fpPath !== null) { const fp = JSON.parse(readFileSync(fpPath, 'utf8')); homeBytes = Number(fp.ownExclusiveAllocated ?? 0) + Number(fp.dirBytes ?? 0) }
  } catch { /* reported as unknown below — never silently green */ }
  const homeVerdict = homeBytes !== null && homeBytes <= 64 * 1024 * 1024 ? 'PASS' : 'FAIL'
  writeFileSync(join(outDir, 'postflight.json'), JSON.stringify({ code, before, after, homeBytes, freshHomeCap64MiB: homeVerdict, pgidNote: `cleanup reports ONLY pgid ${child.pid} and ports ${ports.host}/${ports.mock} (A/B lesson ④)` }, null, 2))
  console.log(`driver run exit=${code}; freshHOME=${String(homeBytes)}B cap64MiB=${homeVerdict}; evidence ${outDir}`)
  process.exit(homeVerdict === 'FAIL' ? 2 : (code ?? 1))
}

if (process.argv[2] === 'run') { await run() } else { await preflight() }
