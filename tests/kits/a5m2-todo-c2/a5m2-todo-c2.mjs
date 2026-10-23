#!/usr/bin/env node
/**
 * A5M2 todo C2 — REAL-HOGATE (single bounded run, root ruling 2026-10-23).
 *
 * Verifies the governed todo_write plane row on a REAL DSH 0.2.0-rc.2 host
 * (@639ed01539 pristine test-use runtime) with the plugin mounted EXCLUSIVELY
 * from the frozen install surface extracted from the pinned tgz
 * (root 10:30 GO: packages-pins/495aeb23…/dsh-agent-team-0.1.1-alpha.2.tgz —
 * ROOT-level package, extracted into the WORLD at install-495/ and chmod a-w) plus the pinned tools/harness
 * plugin.mjs. NOTHING mounts from .worktrees/ (the worktree supplies ONLY the
 * tests/paths.mjs constants and the harness scripts — kit public interfaces).
 *
 * FIVE CRITERIA (exactly this scope, no C3 extras):
 *  C1  REAL todo_write registration: the member model-facing surface carries
 *      todo_write with the CAPTURED NATIVE description bytes (== the boot
 *      leader's native surface text) and calling it runs the GOVERNED row:
 *      a durable Control row exists whose correlation carries the callId
 *      grammar `plane-todo:<realm>-N` (row bytes captured).
 *  C2  Ask PENDING with ZERO append: while the row is pending the member
 *      session log (session.v4*, read back from the world storage) contains
 *      ZERO `todo/write` entries.
 *  C3  PUBLIC ALLOW -> UNIQUE consumption -> EXACTLY ONE native append:
 *      allow over the public remote v4 team.resolveControl; the durable
 *      ledger shows exactly ONE control-allow-consumed for that requestId
 *      and the session log carries EXACTLY ONE todo/write entry whose todos
 *      list equals the model's submitted list field-for-field.
 *  C4  REAL DENY with ZERO append: a second todo_write call (fresh registry
 *      exec token), DENIED over the same public wire: zero appends for it
 *      (session log total stays at 1), zero consumptions, the refusal is
 *      surfaced to the member (tool result carries refused-todo).
 *  C5  cancel/owner via the EXISTING p6t6 abandon fixture (the exemplar kit's
 *      production-abandonControlRequest thin route): a third pending row is
 *      abandoned; exactly one abandon fact, zero consumptions, session log
 *      total stays 1, member-visible refusal.
 *
 * FIRST FAILURE STOPS: the first failed criterion (or setup fatal) exits with
 * the full state (run.log, host log copy, ledger dump, session-log dump).
 * World + install-495 are NEVER deleted (evidence retention is mandatory).
 *
 * EXIT: 0 = all criteria pass; 2 = a criterion failed; 1 = fatal (env/boot).
 *
 * USAGE:
 *   node tests/kits/a5m2-todo-c2/a5m2-todo-c2.mjs --world <tests/homes/a5m2-todo-c2-STAMP> \
 *     [--worktree <path>] [--testuse <path>] [--host-port N] [--mock-port N] \
 *     [--evidence-dir <path>]
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, chmodSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { zstdDecompressSync } from 'node:zlib'
import { createHash } from 'node:crypto'

// ── harness imports: the M1 kit PUBLIC interfaces, taken from the worktree
// checkout (per root clause 2: the worktree supplies ONLY provenance + these
// scripts; the executed PLUGIN never comes from there) ─────────────────────
const KIT_DIR = dirname(new URL(import.meta.url).pathname)
const REPO = resolve(KIT_DIR, '..', '..', '..')
const args = process.argv.slice(2)
function argValue(name, dflt) {
  const i = args.indexOf(`--${name}`)
  if (i === -1) return dflt
  const v = args[i + 1]
  if (v === undefined || v.startsWith('--')) throw new Error(`--${name} requires a value`)
  return v
}
// ENTRY-SAFETY LAW: harness dependency loading is DEFERRED to main() (direct
// entry only). An import of this module never loads worktree CLI-dependency
// modules (root 1805 BLOCK item 3: no pre-positioned CLI/dependency effects).
const WORKTREE = resolve(argValue('worktree', join(REPO, '.worktrees', 'a5-m2-int')))
let CLIENT_COMMIT_HASH, TEST_USE_BASELINE_SHA, startMockModel, DshInstance, logTail, portInUse, waitForPortFree, captureGitState
async function loadHarness() {
  ;({ CLIENT_COMMIT_HASH, TEST_USE_BASELINE_SHA } = await import(pathToFileURL(join(WORKTREE, 'tests', 'paths.mjs')).href))
  ;({ startMockModel } = await import(pathToFileURL(join(WORKTREE, 'packages', 'tools', 'harness', 'mock-deepseek.mjs')).href))
  ;({ DshInstance } = await import(pathToFileURL(join(WORKTREE, 'tests', 'characterization', 'lib', 'instance.mjs')).href))
  ;({ logTail, portInUse, waitForPortFree } = await import(pathToFileURL(join(WORKTREE, 'tests', 'characterization', 'lib', 'util.mjs')).href))
  ;({ captureGitState } = await import(pathToFileURL(join(WORKTREE, 'tests', 'characterization', 'lib', 'tree-clean.mjs')).href))
}

// ── pins (root 14:57 ruling — ROOT-level product package @ source-HEAD 249eb65ec (SYMMETRIC paImageHandoff third port, root 14:44); supersedes 19d54bd72 as the MOUNT SURFACE; 19d54/8b94/31f7 pins KEPT) ──
const SOURCE_PIN_SHA = '249eb65ec1789ab8bfcf02268d14d3d7060b8c2a'
const PIN_SHA = '34c6680d33c52ba50a16a1171b6f1c38e02ddae4' // helper plugin.mjs provenance (bytes identical at 495/3def/a23d/31f7; re-verified)
const PIN_DIR = join(WORKTREE, 'packages-pins', SOURCE_PIN_SHA)
const PIN_TGZ = join(PIN_DIR, 'dsh-agent-team-0.1.1-alpha.2.tgz')
const PIN_PLUGIN = join(REPO, 'packages-pins', PIN_SHA, 'plugin.mjs') // helper bytes (== 495 blob, verified)
const EXPECT_TGZ_SHA = 'ca0f4b253fd3e9075e86d772f33ccb21c42c165ff7de3dee5949faf5c780d4b7'
const EXPECT_PLUGIN_SHA = '471475b96e70f05a178f6006cf7b256765533313092b7c4689553c7c8d0ee784'
const EXPECT_TREE_SHA = 'f8d5622a272450ee84f8eab0ba5fef0e2bb6e35f34cc121167e726fbc7840d76' // MANIFEST@249eb tree-sha256: LC_ALL=C sorted per-file hash+path lines (same recipe the kit prints side by side; non-gating INFO)
const EXPECT_ENTRIES = 1813
const INSTALL_DIR = 'install-249eb65ec' // root 14:57: mount surface = the 249eb pin (PATHSET-EQUAL-1813 vs 19d54; content delta EXACTLY SIX files)

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

// ── world / install surface / evidence ─────────────────────────────────────
// ENTRY-SAFETY LAW (2026-10-23 ruling, test-infra owner; incident class: import
// executed main + missing --world defaulted HOME to REPO + recursive teardown):
// the world is a REQUIRED, validated, single-safe-basename-under-tests/homes path
// (tests/kits/lib/world-safety.mjs). Missing/illegal --world NEVER derives a
// default and NOTHING is created, mounted or removed. An IMPORT of this module
// never runs main() and never derives a world from the importer's argv — it
// resolves against an inert placeholder only.
import { parseWorldArg, isDirectEntry, WorldSafetyError } from '../lib/world-safety.mjs'
const HOMES_ROOT = join(REPO, 'tests', 'homes')
const ENTRY_DIRECT = isDirectEntry(import.meta.url, process.argv[1])
const WORLD_REL = ENTRY_DIRECT ? argValue('world', null) : null
let HOME
if (ENTRY_DIRECT) {
  try {
    HOME = parseWorldArg({ repoRoot: REPO, homesRoot: HOMES_ROOT, worldArg: WORLD_REL }).home
  } catch (e) {
    console.error(`FATAL: ${e instanceof WorldSafetyError ? e.message : `--world invalid: ${String(e?.message ?? e)}`}`)
    console.error('a5m2-todo-c2: NOTHING created, mounted or removed (entry-safety law). Usage: --world <tests/homes/a5m2-todo-c2-STAMP>')
    process.exit(1)
  }
} else {
  HOME = join(HOMES_ROOT, '__module-import-no-world__') // inert: main() is entry-gated at the file end
}
const FIXTURE = argValue('fixture', 'todo')
if (FIXTURE !== 'todo' && FIXTURE !== 'write' && FIXTURE !== 'image') {
  // direct entry only: an import must NEVER exit the importing process
  if (ENTRY_DIRECT) {
    console.error('FATAL: --fixture must be todo|write|image')
    process.exit(1)
  }
}
const ROW_TOOL = FIXTURE === 'image' ? 'read_image' : FIXTURE === 'write' ? 'write' : 'todo_write'
const REFUSAL_MARK = FIXTURE === 'write' ? 'refused-write' : FIXTURE === 'todo' ? 'refused-todo' : 'STRUCTURAL:image-denial-protocol' // image mode NEVER uses a marker word (root 14:29/14:57 law: structural callId-paired protocol only)
const INSTALL_PKG = join(HOME, INSTALL_DIR, 'package')
const INSTALL = join(INSTALL_PKG, 'packages', 'runtime', 'dist')
const LOCK_FILE = `${HOME}.lock`
const EVIDENCE_DIR = resolve(argValue('evidence-dir', join(REPO, 'dev', 'agent-workflow', 'evidence', 'a5m2-todo-c2')))

function utcStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
}
const RUN_STAMP = `a5m2c2-${utcStamp()}`
const RUN_DIR = join(EVIDENCE_DIR, `run-${RUN_STAMP.slice('a5m2c2-'.length)}`)

// The DESIGNATED host runtime (root ruling 10:03 item 2): the test-use
// checkout INSIDE the worktree tree (the runtime host, distinct from the
// plugin surface; reading/running it is in-scope). Its git identity is
// verified in preflight (HEAD == the paths.mjs baseline + porcelain EMPTY).
const TESTUSE = resolve(argValue('testuse', join(WORKTREE, 'tests', 'deepseek-harness-test-use')))
const HOST_TREE = TESTUSE
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
let HOST_BASELINE_SHA = null // set by loadHarness() in main(); generation lives ONLY in tests/paths.mjs

// THE MOUNT SURFACE — ROOT-level package at install-495/package (root 10:30 GO)
// + the pinned helper at mount-helper/packages/tools/harness/plugin.mjs, laid
// out so its RELATIVE leg ../../runtime/dist/packages/runtime/mutation/index.js
// resolves (packages/runtime -> symlink into the extracted package). Nearest
// package.json for every mounted entry = the root manifest (dsh-agent-team, 9
// exact peers). Never a .worktrees path (guard below).
const PRODUCTION_ROW_PATH = join(INSTALL, 'packages', 'runtime', 'src', 'plugin', 'host.js')
const GLUE_PATH = join(INSTALL, 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs')
const SEAM_PATH = join(INSTALL, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')
const P6T6_PLUGIN_PATH = join(HOME, 'mount-helper-root', 'package', 'packages', 'tools', 'harness', 'plugin.mjs')
const PRODUCTION_ROW_NAME = pathToFileURL(PRODUCTION_ROW_PATH).href
const GLUE_URL = pathToFileURL(GLUE_PATH).href
const SEAM_URL = pathToFileURL(SEAM_PATH).href
const P6T6_ROW_NAME = pathToFileURL(P6T6_PLUGIN_PATH).href

// Ports: 3180 family ONLY (3182-3186 host, 3497-3498 mock). NEVER 3080/3180/3181.
const HOST_PORT_CANDIDATES = [3182, 3183, 3184, 3185, 3186]
const MOCK_PORT_CANDIDATES = [3497, 3498]

const ROOT = `session-a5m2c2-boot-${RUN_STAMP}`
const ROOT_P = `session-a5m2c2-p-${RUN_STAMP}`
const BP_ANCHOR_ID = 'team.a5m2c2-anchor'
const BP_TODO_ID = 'team.a5m2c2-todo'
const BLUEPRINT_DIR = join(HOME, 'blueprints')

// ── markers ────────────────────────────────────────────────────────────────
const NONCE = RUN_STAMP.replace(/[^a-zA-Z0-9-]/g, '')
const MK = (p) => `${p}_${NONCE}`
const MK_CREATE = MK('CREATE')
const MK_WORK1 = MK('W1')
const MK_W3L = MK('W3L')
const MK_WORK3 = MK('W3')
const MK_DISC = MK('DISC')
const DONE_DISC = 'A5M2C2_DISC_DONE'
const DONE_CREATE = 'A5M2C2_CREATE_DONE'
const DONE_WORK1 = 'A5M2C2_W1_DONE'
const DONE_W3L = 'A5M2C2_W3L_DONE'
const DONE_WORK3 = 'A5M2C2_W3_DONE'
const NOTIF_PREFIX = '[team-control requestId='

// The submitted todo lists (trimmed, non-duplicated, single-active-safe).
const LIST1 = [
  { content: `a5m2c2-alpha-${NONCE}`, status: 'in_progress' },
  { content: `a5m2c2-beta-${NONCE}`, status: 'pending' },
]
const LIST2 = [{ content: `a5m2c2-deny-${NONCE}`, status: 'pending' }]
const LIST3 = [{ content: `a5m2c2-cancel-${NONCE}`, status: 'pending' }]
// write fixture (root 13:01Z): task-synthesized EXISTING file under the anchored
// governed root; gitignored pattern examples/*/*.jsonl (porcelain-neutral, probed
// 2026-10-23). Leg baselines: pending/deny/abandon compare zero-change against the
// ACTUAL bytes AT EACH LEG START (post-allow that baseline is TGT, not INIT).
const WF_REL = `examples/minimal/a5m2c2-wf-${RUN_STAMP}.jsonl`
const WF_ABS = join(TESTUSE, WF_REL)
const WF_INIT = `{"phase":"initial","stamp":"${RUN_STAMP}"}\n`
const WF_TGT = `{"phase":"written","stamp":"${RUN_STAMP}","marker":"a5m2c2-write-allow"}\n`
const WF_DENY = `{"phase":"deny-should-not-land","stamp":"${RUN_STAMP}"}\n`
const WF_CANCEL = `{"phase":"cancel-should-not-land","stamp":"${RUN_STAMP}"}\n`
const WF_TGT_SHA = createHash('sha256').update(Buffer.from(WF_TGT)).digest('hex')
// ── A5M2 IMAGE fixture (root 14:57): synthetic 2048x1536 PNG under the ANCHORED root,
// under the gitignored `examples/*/.sessions/` pattern (L15 of the test-use .gitignore —
// Host .gitignore untouched, H1 porcelain law intact). Deterministic bytes: filter-0
// RGB scanlines, zlib level 9, single IDAT. maxImageDimension=1024 (profile override)
// makes the store NORMALIZE: 1024x768 preview, originalDimensions 2048x1536 rides the receipt.
const IMG_W = 2048
const IMG_H = 1536
const IMG_NAME = `a5m2c2-im-${RUN_STAMP}.png`
const IMG_REL = `examples/minimal/.sessions/${IMG_NAME}`
const IMG_ABS = join(TESTUSE, 'examples', 'minimal', '.sessions', IMG_NAME)
const IMG_NORM_W = 1024
const IMG_NORM_H = 768
function crc32(buf) {
  let c, table = crc32.table
  if (table === undefined) {
    table = crc32.table = new Int32Array(256)
    for (let n = 0; n < 256; n += 1) { c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; table[n] = c }
  }
  c = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i += 1) c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
function synthPng(width, height) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0 // 8-bit truecolor RGB
  const rowLen = 1 + width * 3
  const raw = Buffer.alloc(rowLen * height)
  for (let y = 0; y < height; y += 1) {
    const off = y * rowLen
    raw[off] = 0 // filter: None
    for (let x = 0; x < width; x += 1) {
      const o = off + 1 + x * 3
      raw[o] = (x * 256 / width) | 0
      raw[o + 1] = (y * 256 / height) | 0
      raw[o + 2] = ((x + y) % 256)
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}
/** Committed attachment objects: <dshHome>/attachments/v1/objects/<sha[0:2]>/<sha> (store law: the file name IS the sha256 of its bytes). */
function storeCensus() {
  const base = join(HOME, 'attachments', 'v1', 'objects')
  const out = []
  const walk = (d) => {
    for (const e of existsSync(d) ? readdirSync(d, { withFileTypes: true }) : []) {
      const p = join(d, e.name)
      if (e.isDirectory()) walk(p)
      else out.push({ rel: p.slice(base.length + 1), size: statSync(p).size })
    }
  }
  walk(base)
  return out.sort((a, b) => a.rel < b.rel ? -1 : 1)
}
let IMG_SRC_SHA = null
let storeBaseline = []
let allowStoreRel = null
function wfState() {
  try {
    const b = readFileSync(WF_ABS)
    return { sha: createHash('sha256').update(b).digest('hex'), size: b.length }
  } catch { return { sha: null, size: -1 } }
}

// ── logging / criteria ─────────────────────────────────────────────────────
let RUN_LOG = null
function log(line) {
  const stamped = `[${new Date().toISOString()}] ${line}`
  console.log(stamped)
  if (RUN_LOG !== null) {
    try { writeFileSync(RUN_LOG, stamped + '\n', { flag: 'a' }) } catch { /* best-effort */ }
  }
}

const CRITERIA = [
  { id: 'C1', name: 'REAL todo_write registration (captured native description bytes) + governed durable row with plane-todo callId grammar' },
  { id: 'C2', name: 'Ask PENDING with ZERO append (member session log has zero todo/write entries while pending)' },
  { id: 'C3', name: 'PUBLIC ALLOW -> exactly ONE control-allow-consumed + EXACTLY ONE todo/write append, field-for-field equal' },
  { id: 'C4', name: 'REAL DENY with ZERO append (log total stays 1, zero consumption, refusal surfaced to member)' },
  { id: 'C5', name: 'cancel via the existing p6t6 abandon fixture (one abandon fact, zero consumption, zero append)' },
  { id: 'H1', name: 'test-use porcelain EMPTY + HEAD baseline before and after; :3080 zero-touch BY CONSTRUCTION' },
  { id: 'H2', name: 'every allocated port released + no surviving host/mock process (ps proof)' },
]
const results = {}
for (const c of CRITERIA) results[c.id] = { id: c.id, name: c.name, status: 'not-run', checks: [] }

function check(critId, name, ok, detail) {
  results[critId].status = 'run'
  results[critId].checks.push({ name, ok: ok === true, detail: detail === undefined ? undefined : String(detail).slice(0, 2000) })
  log(`${critId} ${ok ? 'PASS' : 'FAIL'} — ${name}${detail !== undefined && detail !== null ? ` :: ${String(detail).slice(0, 300)}` : ''}`)
}
function finishCriterion(critId) {
  const r = results[critId]
  r.pass = r.status === 'run' && r.checks.length > 0 && r.checks.every((c) => c.ok === true)
  log(`${critId}: ${r.pass ? 'PASS' : 'FAIL'} (${r.checks.filter((c) => c.ok).length}/${r.checks.length} checks)`)
  if (!r.pass) throw new FirstFailureStop(`${critId} FAILED — first-failure stop (full state in ${RUN_DIR})`)
}
class FirstFailureStop extends Error {}

async function dieFatal(msg, isCriterionFailure = false) {
  log(`${isCriterionFailure ? 'FIRST-FAILURE-STOP' : 'FATAL'} ${msg}`)
  try {
    mkdirSync(RUN_DIR, { recursive: true })
    for (const h of EVID.hostLogs) {
      const dest = join(RUN_DIR, `host-${h.phase}-port${h.port}.log`)
      try { writeFileSync(dest, readFileSync(h.logPath, 'utf8')) } catch { /* gone */ }
    }
    try { if (mockRef !== null) writeFileSync(join(RUN_DIR, 'mock.log'), mockRef.requestLogText ? mockRef.requestLogText() : JSON.stringify(mockRef.requests, null, 2)) } catch { /* ok */ }
    try { writeFileSync(join(RUN_DIR, 'api-transcript.json'), JSON.stringify(TRANSCRIPT, null, 2)) } catch { /* ok */ }
    dumpSessionLogs('on-stop')
    dumpPaEdgeEvidence()
    writeFileSync(join(RUN_DIR, 'ledger-dump.json'), JSON.stringify(LEDGER_CACHE, null, 2))
  } catch { /* best-effort */ }
  const backstop = setTimeout(() => process.exit(isCriterionFailure ? 2 : 1), 75_000)
  try { await sweepLiveHosts() } catch { /* ok */ }
  try { if (mockRef !== null) await mockRef.close() } catch { /* ok */ }
  clearTimeout(backstop)
  try {
    writeFileSync(join(RUN_DIR, 'summary.json'), JSON.stringify({
      task: 'A5M2 todo C2 single bounded real-host run',
      runStamp: RUN_STAMP,
      fatal: String(msg).slice(0, 4000),
      world: HOME,
      worldRetained: true,
      criteria: Object.values(results),
      pass: false,
      exitCode: isCriterionFailure ? 2 : 1,
    }, null, 2))
    scrubDir(RUN_DIR)
  } catch { /* ok */ }
  process.exit(isCriterionFailure ? 2 : 1)
}

const TRANSCRIPT = []
const EVID = { hostLogs: [] }
const LEDGER_CACHE = {}
let mockRef = null
function noteTranscript(entry) { TRANSCRIPT.push({ at: new Date().toISOString(), ...entry }) }

// ── port selection + stable-instance discipline ────────────────────────────
async function pickPort(candidates, label) {
  for (const p of candidates) {
    if (!(await portInUse(p, 1500))) { log(`${label}: port ${p} free`); return p }
    log(`${label}: port ${p} busy, next`)
  }
  await dieFatal(`${label}: no free port in [${candidates.join(', ')}]`)
}

async function fetchJson(url, init, timeoutMs) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  const text = await res.text()
  let body = null
  try { body = text === '' ? null : JSON.parse(text) } catch { body = { nonJsonBody: text.slice(0, 800) } }
  return { status: res.status, body }
}

async function authenticate(origin, token) {
  const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const setCookie = res.headers.get('set-cookie')
  if (res.status !== 303 || setCookie === null) throw new Error(`auth returned HTTP ${res.status} (expected 303 + set-cookie)`)
  return setCookie.split(';', 1)[0]
}

function scrubTokens(text) {
  return String(text ?? '').replace(/\/\?token=([A-Za-z0-9_-]+)/g, '/?token=<SCRUBBED>')
    .replace(/("token"\s*:\s*")[A-Za-z0-9_-]+(")/g, '$1<SCRUBBED>$2')
}
function scrubDir(dir) {
  if (!existsSync(dir)) return 0
  let changed = 0
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) { changed += scrubDir(p); continue }
    if (!st.isFile()) continue
    let raw
    try { raw = readFileSync(p, 'utf8') } catch { continue }
    const scrubbed = scrubTokens(raw)
    if (scrubbed !== raw) { writeFileSync(p, scrubbed); changed++ }
  }
  return changed
}

// ── remote / prompt wires (exemplar-verbatim shapes) ───────────────────────
async function remoteCall(origin, cookie, method, params, tag = 'a5c2', version = 1, timeoutMs = 180_000) {
  const res = await fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`, method, payload: { version, params } }),
  }, timeoutMs)
  noteTranscript({ method, params: scrubTokens(JSON.stringify(params)), status: res.status, body: scrubTokens(JSON.stringify(res.body)) })
  return res
}
async function remoteCallReady(host, method, params, tag, version = 1, retries = 20) {
  let last = null
  for (let i = 0; i < retries; i += 1) {
    last = await remoteCall(host.origin, host.cookie, method, params, tag, version)
    if (last.status !== 429) return last
    await new Promise((r) => setTimeout(r, 1500))
  }
  return last
}
function resultError(body) {
  const r = body?.result
  if (r === undefined) return { code: 'NO_RESULT', message: String(body).slice(0, 200) }
  if (r.ok !== true) return r.error ?? { code: 'UNKNOWN', message: JSON.stringify(r).slice(0, 200) }
  return null
}
function resultData(body) {
  const r = body?.result
  if (r === undefined || r.ok !== true) return null
  const v = r.value
  if (v && typeof v === 'object' && 'data' in v) return v.data
  return v
}
async function apiPrompt(origin, cookie, sessionId, text, tag = 'a5c2') {
  const res = await fetchJson(`${origin}/api/session/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
      method: 'session/prompt',
      payload: { args: { request: { requestId: `${tag}-${Math.random().toString(36).slice(2, 12)}`, sessionId, mode: 'queue', content: [{ type: 'text', text }] } } },
    }),
  }, 240_000)
  noteTranscript({ method: 'session/prompt', sessionId, text: String(text).slice(0, 200), status: res.status, body: scrubTokens(JSON.stringify(res.body)) })
  return res
}
async function p6t6Health(port) { return fetchJson(`http://127.0.0.1:${port}/__p6t6/health`, undefined, 10_000) }
async function p6t6Control(port, body, timeoutMs = 60_000) {
  const res = await fetchJson(`http://127.0.0.1:${port}/__p6t6/control/mutate`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }, timeoutMs)
  noteTranscript({ method: '__p6t6/control/mutate', action: body?.action, status: res.status, body: scrubTokens(JSON.stringify(res.body)) })
  return res
}

// ── durable control ledger (exemplar recipe, team_domain.json read-only) ───
function safeParse(v) {
  if (v === null || v === undefined) return {}
  if (typeof v === 'object') return v
  try { return JSON.parse(v) } catch { return { raw: String(v).slice(0, 400) } }
}
function jstr(x, n = 400) { const s = JSON.stringify(x); return (s === undefined ? 'undefined' : s).slice(0, n) }

function readLedger() {
  const out = { recorded: [], decisions: [], consumptions: [], abandonments: [], error: null }
  try {
    const parsed = JSON.parse(readFileSync(join(HOME, 'storages', 'team_domain.json'), 'utf8'))
    for (const e of Object.values(parsed?.tables?.ledger ?? {})) {
      const row = safeParse(e)
      if (row.rootSessionId !== ROOT_P) continue
      const payload = safeParse(row.payload)
      if (row.factType === 'control-request-recorded') out.recorded.push({ sequence: row.sequence, payload })
      else if (row.factType === 'control-decision-recorded') out.decisions.push({ sequence: row.sequence, payload })
      else if (row.factType === 'control-allow-consumed') out.consumptions.push({ sequence: row.sequence, payload })
      else if (row.factType === 'control-request-abandoned') out.abandonments.push({ sequence: row.sequence, payload })
    }
  } catch (error) { out.error = String(error?.message ?? error) }
  LEDGER_CACHE.last = { recorded: out.recorded, decisions: out.decisions, consumptions: out.consumptions, abandonments: out.abandonments, error: out.error }
  return out
}
const TODO_CORR_RE = () => new RegExp(`plane-todo:${REALM_ESC}-\\d+`)
let REALM_ESC = 'a-realm'

/** The FULL durable control history over the REMOTE wire (exemplar-verbatim
 *  read plane: pages team.getLedgerPage; FAIL LOUD on an error page — an
 *  error page is a contract/host problem, never an "empty ledger"). */
async function remoteControlFacts(host) {
  const byType = {
    'control-request-recorded': [],
    'control-decision-recorded': [],
    'control-allow-consumed': [],
    'control-request-abandoned': [],
  }
  let afterSequence = 0
  for (let pageNo = 0; pageNo < 50; pageNo++) {
    const page = await remoteCallReady(host, 'team.getLedgerPage', { teamSessionId: ROOT_P, afterSequence, limit: 500 }, `a5c2-ledger-${pageNo + 1}`, 1)
    const pageErr = resultError(page.body)
    if (pageErr !== null) {
      throw new Error(`team.getLedgerPage failed (page ${pageNo + 1}, afterSequence=${afterSequence}): ${pageErr.code} ${String(pageErr.message).slice(0, 300)}`)
    }
    const data = resultData(page.body)
    const entries = Array.isArray(data?.entries) ? data.entries : []
    for (const e of entries) {
      if (byType[e?.factType] !== undefined) byType[e.factType].push({ sequence: e.sequence, payload: safeParse(e.payload) })
    }
    const next = data?.nextAfterSequence
    if (next === null || next === undefined || entries.length === 0) break
    afterSequence = next
  }
  return byType
}

async function waitForTodoRow(host, pred, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const byType = await remoteControlFacts(host)
    const hit = byType['control-request-recorded'].find((f) => pred(f.payload))
    if (hit !== undefined) return hit
    if (Date.now() >= deadline) { log(`todo-row wait timed out: ${label}`); return null }
    await new Promise((r) => setTimeout(r, 500))
  }
}
async function waitForLedgerFact(host, factType, requestId, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const byType = await remoteControlFacts(host)
    const hit = byType[factType].filter((f) => f.payload.requestId === requestId)
    if (hit.length > 0) return hit
    if (Date.now() >= deadline) { log(`ledger wait timed out: ${label}`); return null }
    await new Promise((r) => setTimeout(r, 500))
  }
}

// ── member session log reader (zstd-framed session.v4*, restart-kit recipe) ─
function decodeSessionFile(file) {
  const raw = readFileSync(file)
  let text
  if (file.endsWith('.zstd')) {
    const ZSTD_MAGIC = 0xfd2fb528
    const frames = []
    let offset = 0
    while (offset < raw.length) {
      const start = offset
      if (raw.length - offset < 4) break
      if (raw.readUInt32LE(offset) !== ZSTD_MAGIC) break
      offset += 4
      if (offset === raw.length) break
      const descriptor = raw.readUInt8(offset)
      offset += 1
      if ((descriptor & 0x18) !== 0) break
      const contentSizeFlag = descriptor >>> 6
      const singleSegment = (descriptor & 0x20) !== 0
      const checksum = (descriptor & 0x04) !== 0
      const dictionaryFlag = descriptor & 0x03
      const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag
      const contentSizeBytes = contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : 1 << contentSizeFlag
      const remainingHeaderBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes
      if (raw.length - offset < remainingHeaderBytes) break
      offset += remainingHeaderBytes
      let complete = false
      for (;;) {
        if (raw.length - offset < 3) break
        const blockHeader = raw.readUIntLE(offset, 3)
        offset += 3
        const lastBlock = (blockHeader & 1) !== 0
        const blockType = (blockHeader >>> 1) & 0x03
        const blockSize = blockHeader >>> 3
        if (blockType === 0x03) break
        const payloadBytes = blockType === 0x01 ? 1 : blockSize
        if (raw.length - offset < payloadBytes) break
        offset += payloadBytes
        if (lastBlock) { complete = true; break }
      }
      if (!complete) break
      if (checksum) { if (raw.length - offset < 4) break; offset += 4 }
      frames.push([start, offset])
    }
    const parts = []
    for (const [s, e] of frames) { try { parts.push(zstdDecompressSync(raw.subarray(s, e)).toString('utf8')) } catch { /* torn */ } }
    text = parts.join('')
  } else {
    text = raw.toString('utf8')
  }
  return text
}
function walkSessionFiles(dir, depth, out) {
  if (depth > 5) return
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walkSessionFiles(p, depth + 1, out)
    else if (e.isFile() && /^session\.v\d+(\.jsonl)?(\.zstd)?$/.test(e.name)) out.push(p)
  }
}
/** All todo/write rows of one child session (member). Returns rows + files. */
function readMemberTodoLog(childSessionId) {
  const sessRoot = join(HOME, 'sessions')
  const files = []
  if (existsSync(sessRoot)) walkSessionFiles(sessRoot, 0, files)
  const mine = files.filter((f) => f.includes(childSessionId))
  const rows = []
  const fileTexts = {}
  for (const f of mine) {
    let text = ''
    try { text = decodeSessionFile(f) } catch { continue }
    fileTexts[f] = text
    for (const line of text.split('\n')) {
      if (line === '' || !line.includes('todo/write')) continue
      try {
        const row = JSON.parse(line)
        const t = row.type ?? row.kind ?? row.t ?? null
        if (t === 'todo/write') rows.push(row)
      } catch { /* torn tail */ }
    }
  }
  return { rows, files: mine, fileTexts }
}
function dumpSessionLogs(phase) {
  try {
    const sessRoot = join(HOME, 'sessions')
    if (!existsSync(sessRoot)) return
    const files = []
    walkSessionFiles(sessRoot, 0, files)
    const outDir = join(RUN_DIR, 'session-logs')
    mkdirSync(outDir, { recursive: true })
    for (const f of files) {
      const rel = f.slice(sessRoot.length + 1).replace(/[\/]/g, '__')
      try { writeFileSync(join(outDir, `${phase}__${rel}.txt`), decodeSessionFile(f)) } catch { /* best-effort */ }
    }
  } catch { /* best-effort */ }
}
/** EVIDENCE LAW (root ruling 3): the PA-edge consumed-witness evidence as a
 *  SEPARATE artifact from the CONTROL consumption facts: the plane/PA
 *  observation rows in the host log + the durable session tool/result row of
 *  the governed todo_write call (only reachable THROUGH the edge). */
function dumpPaEdgeEvidence() {
  try {
    const lines = []
    for (const h of EVID.hostLogs) {
      let text = ''
      try { text = readFileSync(h.logPath, 'utf8') } catch { continue }
      for (const line of text.split('\n')) {
        if (/a5-pa-bridge|a5m2-todo|plane-todo|pa-edge|consumed|consume/i.test(line)) lines.push(line.slice(0, 500))
      }
    }
    const sessRoot = join(HOME, 'sessions')
    const files = []
    if (existsSync(sessRoot)) walkSessionFiles(sessRoot, 0, files)
    const toolResultRows = []
    for (const f of files) {
      let text = ''
      try { text = decodeSessionFile(f) } catch { continue }
      for (const l of text.split('\n')) {
        if (!l.includes('todo')) continue
        if (l.includes('todo/write') || l.includes('tool/result') || l.includes('tool/call')) toolResultRows.push({ file: f, row: l.slice(0, 800) })
      }
    }
    writeFileSync(join(RUN_DIR, 'pa-edge-witness-evidence.json'), JSON.stringify({ hostLogObservationLines: lines.slice(0, 400), sessionTodoToolRows: toolResultRows }, null, 2))
  } catch { /* best-effort */ }
}

/** instanceId -> childSessionId from the durable operations table (fallback:
 *  the single child session dir when exactly one member exists). */
function childSessionOf(instanceId) {
  try {
    const parsed = JSON.parse(readFileSync(join(HOME, 'storages', 'team_domain.json'), 'utf8'))
    const hits = []
    for (const e of Object.values(parsed?.tables?.operations ?? {})) {
      const row = safeParse(e)
      const child = row.childSessionId
      const iid = safeParse(row.intent ?? {}).payload?.instanceId ?? row.payload?.instanceId
      if (typeof child === 'string' && iid === instanceId) hits.push(child)
    }
    if (hits.length > 0) return hits[hits.length - 1]
  } catch { /* fall through */ }
  return null
}

// ── mock oracle ────────────────────────────────────────────────────────────
function toolCall(name, argumentsObj) {
  return { kind: 'tool-call', toolCalls: [{ id: `call-a5c2-${Math.random().toString(36).slice(2, 10)}`, name, arguments: argumentsObj }] }
}
function userTextOf(m) {
  if (m === null || typeof m !== 'object') return ''
  if (typeof m.content === 'string') return m.content
  if (Array.isArray(m.content)) return m.content.map((b) => (b !== null && typeof b === 'object' && typeof b.text === 'string' ? b.text : '')).join('\n')
  return ''
}
const ALL_MARKERS = [MK_CREATE, MK_WORK1, MK_W3L, MK_WORK3, MK_DISC]
function lastTriggerIndex(msgs) {
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    const m = msgs[i]
    if (m?.role !== 'user') continue
    const t = userTextOf(m)
    if (t.startsWith(NOTIF_PREFIX) || ALL_MARKERS.some((mk) => t.includes(mk))) return i
  }
  for (let i = msgs.length - 1; i >= 0; i -= 1) if (msgs[i]?.role === 'user') return i
  return -1
}
function lastUserTextOf(msgs) { const i = lastTriggerIndex(msgs); return i === -1 ? '' : userTextOf(msgs[i]) }
/**
 * root 14:22/14:29 law: refusal visibility is a STRUCTURAL protocol check, not
 * a fuzzy prefix word. Find, inside ONE model-visible request, the PAIR:
 * assistant tool_use {name:'write', input.file_path=WF_REL, input.content=want}
 * (binding the callId) and a tool result for THAT callId carrying
 * is_error===true (or the wire 'Error:' prefix on tool-role strings) whose text
 * satisfies the requestId-bound protocol predicate. Returns {text, callId} or null.
 */
function denialPairSeen(msgs, want, textPred) {
  const uses = new Set()
  const match = (b) => b?.type === 'tool_use' && b?.name === want?.tool
    && (want?.content === undefined || b?.input?.content === want.content)
    && (want?.file === undefined || b?.input?.file_path === want.file)
  for (const m of msgs ?? []) {
    if (m?.role !== 'assistant' || !Array.isArray(m.content)) continue
    for (const b of m.content) {
      if (match(b)) uses.add(b.id)
    }
  }
  if (uses.size === 0) return null
  for (const m of msgs ?? []) {
    if (m?.role === 'tool' && uses.has(m.tool_call_id ?? '')) {
      const t = toolResultText(m.content ?? '')
      if ((m.is_error === true || t.startsWith('Error:')) && textPred(t)) return { text: t, callId: m.tool_call_id }
    }
    if (Array.isArray(m?.content)) {
      for (const b of m.content) {
        if (b?.type === 'tool_result' && uses.has(b.tool_use_id ?? '') && b.is_error === true) {
          const t = toolResultText(b.content ?? '')
          if (textPred(t)) return { text: t, callId: b.tool_use_id }
        }
      }
    }
  }
  return null
}

/** Model-visible ALLOWED image result: callId-paired tool_use(read_image, IMG_REL) ->
 * tool_result whose text is the native two-block envelope with the ORIGINAL-frame clause
 * (plane render 249eb:3076-3114 — text names BOTH frames; the image part carries the
 * store-normalized attachment ref). Root 14:57 wording proof, structural. */
function imageVisiblePair(msgs) {
  const uses = new Set()
  for (const m of msgs ?? []) {
    if (m?.role !== 'assistant' || !Array.isArray(m.content)) continue
    for (const b of m.content) {
      if (b?.type === 'tool_use' && b?.name === 'read_image' && b?.input?.file_path === IMG_REL) uses.add(b.id)
    }
  }
  if (uses.size === 0) return null
  for (const m of msgs ?? []) {
    if (!Array.isArray(m?.content)) continue
    for (const b of m.content) {
      if (b?.type === 'tool_result' && uses.has(b.tool_use_id ?? '') && b.is_error !== true) {
        const t = toolResultText(b.content ?? '')
        if (t.includes('<type>image</type>') && t.includes(`downscaled from ${IMG_W}x${IMG_H} px`)) return { callId: b.tool_use_id, text: t }
      }
    }
  }
  return null
}

function toolResultText(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map((b) => (b !== null && typeof b === 'object' && typeof b.text === 'string' ? b.text : JSON.stringify(b ?? ''))).join('\n')
  return JSON.stringify(content ?? '')
}
function allToolResults(msgs) {
  const out = []
  for (const m of msgs) {
    if (m?.role === 'tool') { out.push({ id: m.tool_call_id ?? null, content: toolResultText(m.content) }); continue }
    const blocks = Array.isArray(m?.content) ? m.content : []
    for (const b of blocks) if (b?.type === 'tool_result') out.push({ id: b.tool_use_id ?? null, content: toolResultText(b.content) })
  }
  return out
}
function toolMsgsOf(msgs) { const i = lastTriggerIndex(msgs); return allToolResults(msgs.slice(i + 1)) }
function extractInstanceId(content) {
  const m = /"targetInstanceId"\s*:\s*"([^"]+)"/.exec(String(content)) ?? /"instanceId"\s*:\s*"([^"]+)"/.exec(String(content)) ?? /inst-[A-Za-z0-9][A-Za-z0-9-]{3,64}/.exec(String(content))
  return m === null ? null : (m[1] ?? m[0])
}
function makeDecide() {
  const LOOP_BREAK_CAP = 2
  const issued = new Map()
  function decideInner({ req }) {
    const msgs = Array.isArray(req?.messages) ? req.messages : []
    const first = msgs[0]
    const firstText = Array.isArray(first?.content) ? first.content.map((b) => (b !== null && typeof b === 'object' && typeof b.text === 'string' ? b.text : '')).join('') : (typeof first?.content === 'string' ? first.content : '')
    if (firstText.startsWith('Create a concise title') || firstText.startsWith('Generate the session title')) return { kind: 'text', content: 'a5m2c2 todo gate session' }
    const lastUser = lastUserTextOf(msgs)
    const tools = toolMsgsOf(msgs).length
    if (lastUser.includes(MK_DISC)) return { kind: 'text', content: DONE_DISC }
    if (lastUser.startsWith(NOTIF_PREFIX)) return { kind: 'text', content: 'A5M2C2_NOTIF_REMOTE_DRIVEN' }
    if (lastUser.includes(MK_WORK1)) {
      switch (tools) {
        case 0: return FIXTURE === 'image' ? toolCall('read_image', { file_path: IMG_REL }) : FIXTURE === 'write' ? toolCall('write', { file_path: WF_REL, content: WF_TGT }) : toolCall('todo_write', { todos: LIST1 })
        case 1: return FIXTURE === 'image' ? { kind: 'text', content: DONE_WORK1 } : FIXTURE === 'write' ? toolCall('write', { file_path: WF_REL, content: WF_DENY }) : toolCall('todo_write', { todos: LIST2 })
        case 2: return { kind: 'text', content: DONE_WORK1 }
        default: return { kind: 'text', content: `A5M2C2_W1_FALLTHROUGH tools=${tools}` }
      }
    }
    if (lastUser.includes(MK_WORK3)) {
      switch (tools) {
        case 0: return FIXTURE === 'image' ? toolCall('read_image', { file_path: IMG_REL }) : FIXTURE === 'write' ? toolCall('write', { file_path: WF_REL, content: WF_CANCEL }) : toolCall('todo_write', { todos: LIST3 })
        case 1: return { kind: 'text', content: DONE_WORK3 }
        default: return { kind: 'text', content: `A5M2C2_W3_FALLTHROUGH tools=${tools}` }
      }
    }
    if (lastUser.includes(MK_CREATE)) {
      switch (tools) {
        case 0: return toolCall('team_create_member', { rootSessionId: ROOT_P, requestToken: `a5c2-create-${NONCE}`, delegationTemplateId: 'worker', label: 'w1' })
        case 1: {
          const id = extractInstanceId(toolMsgsOf(msgs)[0]?.content)
          if (id === null || id === undefined || id === '') return { kind: 'text', content: `A5M2C2_CREATE_EXTRACT_FAIL :: ${String(toolMsgsOf(msgs)[0]?.content).slice(0, 300)}` }
          return toolCall('team_delegate', { rootSessionId: ROOT_P, requestToken: `a5c2-delegate-${NONCE}`, delegationInstanceId: id, label: 'w1', prompt: MK_WORK1, async: true })
        }
        case 2: return { kind: 'text', content: DONE_CREATE }
        default: return { kind: 'text', content: `A5M2C2_CREATE_FALLTHROUGH tools=${tools}` }
      }
    }
    if (lastUser.includes(MK_W3L)) {
      const memberId = allToolResults(msgs).map((m) => extractInstanceId(m.content)).find((v) => v !== null) ?? null
      if (memberId === null) return { kind: 'text', content: 'A5M2C2_W3L_MEMBERID_FAIL' }
      switch (tools) {
        case 0: return toolCall('team_delegate', { rootSessionId: ROOT_P, requestToken: `a5c2-w3-delegate-${NONCE}`, delegationInstanceId: memberId, label: 'w1', prompt: MK_WORK3, async: true })
        case 1: return { kind: 'text', content: DONE_W3L }
        default: return { kind: 'text', content: `A5M2C2_W3L_FALLTHROUGH tools=${tools}` }
      }
    }
    return { kind: 'text', content: 'A5M2C2_ORACLE_FALLTHROUGH (no marker)' }
  }
  return function decide({ req }) {
    const reply = decideInner({ req })
    if (reply.kind === 'tool-call') {
      const names = (Array.isArray(reply.toolCalls) ? reply.toolCalls : [reply.toolCalls]).map((c) => String(c.name)).join(',')
      const trigger = lastUserTextOf(Array.isArray(req?.messages) ? req.messages : []).slice(0, 80)
      const key = `${trigger}|${names}`
      const n = (issued.get(key) ?? 0) + 1
      issued.set(key, n)
      if (n > LOOP_BREAK_CAP) { log(`oracle: LOOP BREAK ${names} for ${JSON.stringify(trigger)}`); return { kind: 'text', content: `A5M2C2_LOOP_BREAK ${names}` } }
    }
    return reply
  }
}
async function waitForMock(mock, pred, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const hit = mock.requests.find(pred)
    if (hit !== undefined) return hit
    if (Date.now() >= deadline) { log(`mock wait timed out: ${label} (requests=${mock.requests.length})`); return null }
    await new Promise((r) => setTimeout(r, 400))
  }
}

// ── row config + blueprint (exemplar schema, todo-scoped) ──────────────────
const REALM = `a5m2c2-realm-${NONCE.slice(-12)}`

function teamRowConfig({ bootPhase }) {
  return {
    rootSessionId: ROOT,
    bootPhase,
    blueprintSource: BP_ANCHOR_YAML,
    blueprintDir: BLUEPRINT_DIR,
    seedMembers: [],
    generation: 1,
    // image mode rides the SHIPPED catalog model that DECLARES image input (llm-deepseek
    // src/models.ts:8-14 inputModalities ['text','image']) — assertImageCapableRoute
    // (host tool-fs/src/read-image.ts:117-130) requires the RESOLVED route to include 'image'
    // before any resolve/read/store; todo/write keep the gate-model spelling untouched.
    staticModel: { provider: 'deepseek-official', model: FIXTURE === 'image' ? 'deepseek-flash' : 'a5m2c2-gate-model' },
    deniedSelection: null,
    mcpServers: [],
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
      { domain: 'persona', subject: 'standard', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    glueUrl: GLUE_URL,
    seamUrl: SEAM_URL,
    teamToolPlane: {
      realmId: REALM,
      todoEnabled: true,
      todoAllowParallelInProgress: false,
      ...(FIXTURE === 'write' ? { writeEnabled: true } : {}),
      ...(FIXTURE === 'image' ? { imageEnabled: true } : {}), // closed boolean gate (team-tool-plane.mjs:930; pairing law both directions)
      // root ruling 12:20Z (r9): governed fs instance = the world's NATIVE
      // session workspace root — recorded r8 byte-evidence: projcache
      // record.identity.cwd === TESTUSE (single-project host launch; members
      // inherit it). Public a5ie row shape; a23d consumers read rootDir ONLY
      // (agent-bindings.mjs:3045 seam, :2815 write, :2902 image anchors).
      // NO mkdir, NO new root, NO cwd change; relative team/runtime lanes and
      // the 19 global denies UNTOUCHED. team_grep becoming reachable is the
      // existing assembled read-only anchored backend's consequence —
      // disclosed as a surface delta and NEVER called by this kit;
      // team_bash/team_glob stay typed-refused (no confinedProvider).
      fsInstance: {
        fs: 'a5m2c2-governed',
        rootDir: TESTUSE,
        realmId: REALM,
        kind: 'absolute-path',
      },
    },
  }
}

const BP_ANCHOR_YAML = [
  '---',
  'schemaVersion: 3',
  `blueprintId: ${BP_ANCHOR_ID}`,
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: "You are the leader of the A5M2 todo gate boot team."',
  'members:',
  '  - templateId: worker',
  '    persona: "You are a worker of the A5M2 todo gate boot team."',
  'memberEnvelopes: []',
  'requirements: []',
  'permissionMutationEnvelope:',
  '  rules: []',
  'teamHardEnvelope:',
  '  rules: []',
  'policyStates: []',
  'metadata: {}',
  '---',
  '',
].join('\n')

const LEADER_TEAM_TOOLS_ALLOW = [
  'team_list_members', 'team_list_templates', 'team_inspect_config', 'team_create_member',
  'team_delegate', 'team_collect', 'team_list_pending_control', 'team_resolve_control',
]
const MANAGED_TOOL_NAMES = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh']
const SAFE_UNMANAGED_TOOL_NAMES = ['todo_write']
const OWN_LAYER_SPAWN_TOOLS = ['subagent']
const TEAM_TOOL_CATALOG = [
  'team_list_members', 'team_list_templates', 'team_inspect_config', 'team_create_member',
  'team_delegate', 'team_follow_up', 'team_collect', 'team_send_message', 'team_report_progress',
  'team_request_control', 'team_resolve_control', 'team_list_pending_control', 'team_archive_member',
  // PR4 round 5 governance pair — 495-generation closed team set is 15 (proven by
  // the 495-tracked exemplar tests/kits/rc2-real-host-smoke/fixture-invariants.mjs;
  // run-2026-10-23T10-42-00 died because the old 13-name catalog let these two
  // leak into builtinToolDeny, which the host lawfully rejects as team-tool names).
  'team_grant_permission', 'team_revoke_permission',
]

function savedBlueprintYaml(bpId, denyList) {
  const denyLines = (list, baseIndent) => {
    const pad = '  '.repeat(baseIndent)
    return list.length === 0 ? [`${pad}builtinToolDeny: []`] : [`${pad}builtinToolDeny:`, ...list.map((n) => `${pad}  - ${n}`)]
  }
  const leaderBlock = [
    'leader:',
    '  templateId: leader',
    '  persona: "You are the leader of the A5M2 todo gate team. Keep answers brief."',
    '  capabilities:',
    '    teamTools:',
    '      kind: allow',
    '      items:',
    ...LEADER_TEAM_TOOLS_ALLOW.map((t) => `        - ${t}`),
    ...denyLines(denyList, 2),
    '    skills:',
    '      kind: allow',
    '      items: []',
    '    mcp:',
    '      kind: allow',
    '      items: []',
    '    permissions:',
    '      default: ask',
    '      allow:',
    '        - tool: read',
    '          resource:',
    '            kind: subtree',
    '            path: team',
    '      ask:',
    '        - tool: bash',
    '          resource:',
    '            kind: any',
    '      deny:',
    '        - tool: read',
    '          resource:',
    '            kind: subtree',
    '            path: runtime',
  ]
  const workerBlock = [
    'members:',
    '  - templateId: worker',
    '    persona: "You are a worker of the A5M2 todo gate team. Follow the delegated instruction exactly with the tools you have; keep answers brief."',
    '    capabilities:',
    '      teamTools:',
    '        kind: deny',
    ...denyLines(denyList, 3),
    '      skills:',
    '        kind: allow',
    '        items: []',
    '      mcp:',
    '        kind: allow',
    '        items: []',
    '      permissions:',
    '        default: ask',
    '        allow:',
    '          - tool: read',
    '            resource:',
    '              kind: subtree',
    '              path: team',
    '        ask:',
    '          - tool: bash',
    '            resource:',
    '              kind: any',
    '        deny:',
    '          - tool: read',
    '            resource:',
    '              kind: subtree',
    '              path: runtime',
  ]
  return [
    '---',
    'schemaVersion: 3',
    `blueprintId: ${bpId}`,
    'revision: "1"',
    ...leaderBlock,
    ...workerBlock,
    'teamEnvelope:',
    '  allow:',
    '    - assign-task',
    '    - create-member',
    '    - send-message',
    '    - report-progress',
    '    - request-control',
    '    - resolve-control',
    '  deny: []',
    'memberEnvelopes:',
    '  - templateId: worker',
    '    envelope:',
    '      allow:',
    '        - send-message',
    '        - report-progress',
    '        - request-control',
    '      deny: []',
    'requirements: []',
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n')
}

// yaml emitter (exemplar-verbatim)
function yamlScalar(v) { if (v === null) return 'null'; if (typeof v === 'string') return JSON.stringify(v); return String(v) }
function yamlValueLines(value, indent) {
  if (Array.isArray(value)) return value.flatMap((item) => yamlEmitItem(item, indent))
  return Object.entries(value).flatMap(([k, v]) => yamlEmit(k, v, indent))
}
function yamlEmit(key, value, indent) {
  const pad = '  '.repeat(indent)
  if (value !== null && typeof value === 'object') {
    const empty = Array.isArray(value) ? value.length === 0 : Object.keys(value).length === 0
    if (empty) return [`${pad}${key}: ${Array.isArray(value) ? '[]' : '{}'}`]
    return [`${pad}${key}:`, ...yamlValueLines(value, indent + 1)]
  }
  return [`${pad}${key}: ${yamlScalar(value)}`]
}
function yamlEmitItem(item, indent) {
  const pad = '  '.repeat(indent)
  if (item === null || typeof item !== 'object') return [`${pad}- ${yamlScalar(item)}`]
  if (Array.isArray(item)) { if (item.length === 0) return [`${pad}- []`]; return [`${pad}-`, ...yamlValueLines(item, indent + 1)] }
  const entries = Object.entries(item)
  const [firstKey, firstValue] = entries[0]
  const firstLines = yamlEmit(firstKey, firstValue, indent + 1)
  const rest = entries.slice(1).flatMap(([k, v]) => yamlEmit(k, v, indent + 1))
  return [`${pad}- ${firstLines[0].slice((indent + 1) * 2)}`, ...firstLines.slice(1), ...rest]
}
function writeTeamPatchFile(patchPath, bootPhase) {
  mkdirSync(dirname(patchPath), { recursive: true })
  const lines = [
    `# A5M2 todo C2 gate patch layer (world ${RUN_STAMP}): production row from the FROZEN ${INSTALL_DIR} ROOT-level surface (pin 249eb65ec tgz ca0f4b25) + p6t6 observability row from the PINNED plugin.mjs — public profile-patch seam only (CORE PATCH BUDGET = 0).`,
    '- insert:',
    ...yamlEmitItem({ id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: teamRowConfig({ bootPhase }) }, 2),
    ...yamlEmitItem({ id: 'p6t6-team-tools', name: P6T6_ROW_NAME }, 2),
    // image mode (root 14:57): REAL normalization via the public profile seam — override
    // the base-bundle attachment-local row (base cordis.patch.yml:138, NO config there, so
    // the wholesale config replacement restates nothing else) to maxImageDimension=1024.
    // 2048x1536 -> store downscales to 1024x768; originalDimensions rides the receipt.
    ...(FIXTURE === 'image' ? ['- id: attachment-local', "  name: '@deepseek-ai/dsh-attachment-local'", '  config:', '    maxImageDimension: 1024'] : []),
    '',
  ]
  writeFileSync(patchPath, lines.join('\n'))
}

// ── world boot / stop ──────────────────────────────────────────────────────
const liveHosts = new Set()
let WORLD_IDENTITY = null // {dev,ino} registered at use time (L2): any future cleanup must re-assert via assertCleanupTarget
async function assertWorld() {
  // L3 defense-in-depth: re-validate the REGISTERED world against the same law at
  // use time (symlink swap / TOCTOU). Any mismatch dies BEFORE any mkdir/write.
  // This kit performs NO recursive deletes; every write below is under HOME only.
  try {
    const recheck = parseWorldArg({ repoRoot: REPO, homesRoot: HOMES_ROOT, worldArg: WORLD_REL })
    if (recheck.home !== HOME) await dieFatal(`world identity drift: parsed ${recheck.home} != registered ${HOME}`)
    WORLD_IDENTITY = recheck.identity
  } catch (e) {
    await dieFatal(`world-safety re-validation failed: ${String(e?.message ?? e)}`)
  }
  if (!existsSync(HOME)) { await dieFatal(`world missing: ${HOME}`) }
  for (const stale of ['storages', 'sessions']) {
    if (existsSync(join(HOME, stale))) await dieFatal(`world not fresh: ${HOME}/${stale} exists`)
  }
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  writeFileSync(LOCK_FILE, JSON.stringify({ world: HOME, identity: WORLD_IDENTITY, pid: process.pid, kit: 'a5m2-todo-c2.mjs', runStamp: RUN_STAMP, at: new Date().toISOString() }, null, 2))
}
async function bootHost({ label, port, boot, phase }) {
  const instLogDir = join(RUN_DIR, 'instances', label)
  mkdirSync(instLogDir, { recursive: true })
  const instance = new DshInstance({ hostTree: HOST_TREE, dshHome: HOME, port, clientCommitHash: CLIENT_COMMIT_HASH, logDir: instLogDir })
  const rec = { label, port, instance, logPath: null, token: null, cookie: null, origin: null, pid: null }
  writeTeamPatchFile(instance.patchFile, phase)
  writeFileSync(join(HOME, 'p6t6-directive.json'), JSON.stringify({ boot, phase, reportDir: RUN_DIR, runStamp: RUN_STAMP, rootSessionId: ROOT }, null, 2))
  const started = await instance.start({ timeoutMs: 240_000 })
  rec.logPath = started.logPath
  rec.pid = instance.child?.pid ?? null
  liveHosts.add(rec)
  const m = /^http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)$/.exec(started.url)
  if (m === null) await dieFatal(`${label}: unexpected boot url: ${scrubTokens(started.url)}`)
  rec.token = m[2]
  rec.origin = `http://127.0.0.1:${m[1]}`
  rec.cookie = await authenticate(rec.origin, rec.token)
  log(`${label}: booted at ${rec.origin} pid=${rec.pid}; cookie exchanged`)
  const dump = await instance.dumpConfig({ timeoutMs: 60_000 })
  writeFileSync(join(RUN_DIR, 'instances', label, 'dump-config.txt'), dump.text)
  if (!DshInstance.rowInDump(dump.text, { id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME })) await dieFatal(`${label}: production row (${INSTALL_DIR}) not in composed profile dump`)
  if (!DshInstance.rowInDump(dump.text, { id: 'p6t6-team-tools', name: P6T6_ROW_NAME })) await dieFatal(`${label}: p6t6 row (pinned plugin.mjs) not in composed profile dump`)
  const deadline = Date.now() + 240_000
  let hb = null
  for (;;) {
    hb = await p6t6Health(port)
    if (hb.status === 200 && hb.body?.ok === true) break
    if (hb.status === 200 && hb.body?.ok === false && hb.body?.setupError !== undefined) {
      await dieFatal(`${label}: row setup failed — ${String(hb.body.setupError).slice(0, 600)}; log tail:\n${logTail(rec.logPath, 30)}`)
    }
    if (Date.now() >= deadline) await dieFatal(`${label}: row health not ready in 240s; log tail:\n${logTail(rec.logPath, 30)}`)
    await new Promise((r) => setTimeout(r, 1000))
  }
  log(`${label}: row ready (health=${jstr(hb.body, 200)})`)
  return rec
}
async function stopHost(rec) {
  try {
    const res = await rec.instance.stop({ timeoutMs: 30_000 })
    log(`${rec.label}: stopped (killed=${res.killed} portFree=${res.portFree})`)
  } finally { liveHosts.delete(rec) }
}
async function sweepLiveHosts() {
  for (const rec of [...liveHosts]) { try { await stopHost(rec) } catch { /* ok */ } }
}
/** ps proof: /proc scan for surviving host processes launched on OUR port. */
function survivingPids(port) {
  const out = []
  for (const pid of readdirSync('/proc').filter((n) => /^\d+$/.test(n))) {
    try {
      const cmd = readFileSync(`/proc/${pid}/cmdline`, 'utf8').replace(/\0/g, ' ')
      if (cmd.includes('apps/cli/lib/bin.js') && cmd.includes(`--port ${String(port)}`)) out.push({ pid: Number(pid), cmd: cmd.slice(0, 160) })
    } catch { /* gone */ }
  }
  return out
}

// ── preflight ──────────────────────────────────────────────────────────────
async function preflight() {
  // Pins (root 10:30 GO: ROOT-level package @ source-HEAD 495aeb23)
  const tgzHash = sha256File(PIN_TGZ)
  const pluginHash = sha256File(PIN_PLUGIN)
  // PIN-DIR GATE LAW (root 10:37Z supplement + root 11:24 GO):
  // gate on (1) tgz sha256; (2) FULL path-set equality vs manifest-tgz-entries-C.txt
  // (extra AND missing both fail); (3) deterministic C-order (code-unit) digest vs
  // c…. NO locale-aggregation gates. The center's recorded per-file-recipe
  // tree-sha256 is printed INFO-only for cross-check (@a23d: 78349a43…).
  // FORMAT NOTE (root 11:24 pin): 3def was packed with git archive, which adds 102
  // DIRECTORY records to tar listings; the gate law is the 1811 FILE set (MANIFEST:
  // "extraction file-set unchanged"). Both sides are FILE-ONLY filtered (dir records
  // carry a trailing '/'; manifest lines never do — removing those lines removes
  // exactly the dir records). Equal-strength on both sides; not a fixture change.
  const EXPECT_C_DIGEST = '5263586e8eee5ea645d3764dd90917c5ec5d500d9ee27649412b7c5f81704569'
  const rawEntries = execFileSync('tar', ['-tzf', PIN_TGZ], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim().split('\n')
  const dirRecords = rawEntries.filter((p) => p.endsWith('/')).length
  const entries = rawEntries.filter((p) => !p.endsWith('/'))
  const manifestC = readFileSync(join(PIN_DIR, 'manifest-tgz-entries-C.txt'), 'utf8').trim().split('\n').sort()
  const entriesC = [...entries].sort() // JS default = UTF-16 code-unit == LC_ALL=C for these paths
  const missing = manifestC.filter((p) => !entriesC.includes(p))
  const extra = entriesC.filter((p) => !manifestC.includes(p))
  const cDigest = createHash('sha256').update(`${entriesC.join('\n')}\n`).digest('hex')
  const shellSortDigest = execFileSync('bash', ['-c', `tar -tzf ${JSON.stringify(PIN_TGZ)} | grep -v '/$' | sort | sha256sum`], { encoding: 'utf8' }).trim().split(/\s+/)[0]
  log(`PIN tgz sha256 = ${tgzHash} (${tgzHash === EXPECT_TGZ_SHA ? 'MATCH' : 'MISMATCH'}); raw tar records=${rawEntries.length} (dir-records=${dirRecords}); file-entries=${entries.length} (${entries.length === EXPECT_ENTRIES ? 'MATCH' : 'MISMATCH'}); pathset vs C-manifest: missing=${missing.length} extra=${extra.length}; C-order digest = ${cDigest} (${cDigest === EXPECT_C_DIGEST ? 'MATCH' : 'MISMATCH'}); locale-sorted INFO = ${shellSortDigest} (list-sort INFO ${shellSortDigest}; center @19d54 per-file-recipe INFO=d8269843… (different recipe — non-gating))`)
  log(`PIN helper plugin.mjs sha256 = ${pluginHash} (${pluginHash === EXPECT_PLUGIN_SHA ? 'MATCH' : 'MISMATCH'})`)
  if (tgzHash !== EXPECT_TGZ_SHA) await dieFatal(`pinned tgz hash mismatch: ${tgzHash}`)
  if (entries.length !== EXPECT_ENTRIES) await dieFatal(`pinned tgz entries ${entries.length} != ${EXPECT_ENTRIES}`)
  if (missing.length !== 0 || extra.length !== 0) await dieFatal(`path-set vs manifest-tgz-entries-C.txt: missing=${missing.slice(0, 5).join(',')} extra=${extra.slice(0, 5).join(',')}`)
  if (cDigest !== EXPECT_C_DIGEST) await dieFatal(`C-order entry-list digest ${cDigest} != ${EXPECT_C_DIGEST}`)
  if (pluginHash !== EXPECT_PLUGIN_SHA) await dieFatal(`pinned plugin.mjs hash mismatch: ${pluginHash}`)
  // helper bytes must equal the 495 source blob (root 10:30: "pin 471475b9…" at 495)
  const blob495 = createHash('sha256').update(execFileSync('git', ['-C', WORKTREE, 'show', `${SOURCE_PIN_SHA}:packages/tools/harness/plugin.mjs`], { maxBuffer: 16 * 1024 * 1024 })).digest('hex')
  log(`pin-blob packages/tools/harness/plugin.mjs sha256 = ${blob495} (${blob495 === EXPECT_PLUGIN_SHA ? 'MATCH' : 'MISMATCH'} vs pin)`)
  if (blob495 !== EXPECT_PLUGIN_SHA) await dieFatal(`pin helper blob ${blob495} != pinned ${EXPECT_PLUGIN_SHA}`)
  // Worktree provenance: INFO ONLY (the center may advance HEAD; authoritative
  // identity = verified pin tgz + verified install surface + helper pin).
  const head = execFileSync('git', ['-C', WORKTREE, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  const porcelain = execFileSync('git', ['-C', WORKTREE, 'status', '--porcelain'], { encoding: 'utf8' }).trim()
  log(`worktree (interfaces only, INFO) HEAD=${head} porcelainEmpty=${porcelain === ''} sourcePin=${SOURCE_PIN_SHA}`)
  // Frozen install surface: extract-if-missing + per-file verify vs center
  // manifest (471 install-surface hashes) + a-w.
  if (!existsSync(PRODUCTION_ROW_PATH)) {
    mkdirSync(join(HOME, INSTALL_DIR), { recursive: true })
    execFileSync('tar', ['-xzf', PIN_TGZ, '-C', join(HOME, INSTALL_DIR)])
    execFileSync('chmod', ['-R', 'a-w', join(HOME, INSTALL_DIR, 'package')])
    log('install-19d54bd72 extracted from the pinned tgz (chmod a-w applied)')
  }
  const surfaceManifest = readFileSync(join(PIN_DIR, 'manifest-installsurface-hashes.txt'), 'utf8').trim().split('\n')
  for (const [rootLabel, rootPkg] of [[INSTALL_DIR, INSTALL_PKG], ['mount-helper-root', join(HOME, 'mount-helper-root', 'package')]]) {
    const treeHashes = execFileSync('bash', ['-c', `cd ${JSON.stringify(rootPkg)} && find -type f | sort | xargs sha256sum`], { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 })
    writeFileSync(join(RUN_DIR, `install-surface-hashes-${rootLabel}.txt`), treeHashes)
    // FORMAT TOLERANCE (a23d pin): the manifest paths carry the tar 'package/'
    // prefix (hashed with the git-archive prefix); the tree walk says './x'.
    // No legitimate file lives under a top-level 'package/' dir inside the
    // extraction, so stripping one leading 'package/' or './' from each side
    // is unambiguous and equal-strength — the per-path hash gate is unchanged.
    const normSurf = (p) => p.replace(/^\.\//, '').replace(/^package\//, '')
    const byFile = new Map(treeHashes.trim().split('\n').map((l) => [normSurf(l.slice(66)), l.slice(0, 64)]))
    let bad = 0, checked = 0
    for (const line of surfaceManifest) {
      const h = line.slice(0, 64), p = normSurf(line.slice(66))
      checked += 1
      if (byFile.get(p) !== h) bad += 1
    }
    log(`${rootLabel} install-surface re-hash: checked=${checked} bad=${bad} (${bad === 0 ? 'MATCHES-PIN' : 'DRIFT'})`)
    if (bad !== 0) await dieFatal(`${rootLabel} install-surface drift vs pin manifest (${bad}/${checked})`)
  }
  for (const [rootLabel, rootDir] of [[`${INSTALL_DIR}/package`, INSTALL_PKG], ['mount-helper-root/package', join(HOME, 'mount-helper-root', 'package')]]) {
    const writable = execFileSync('bash', ['-c', `find ${JSON.stringify(rootDir)} \\( -type f -perm -u+w \\) | wc -l`], { encoding: 'utf8' }).trim()
    log(`${rootLabel} writable files = ${writable}`)
    if (writable !== '0') await dieFatal(`${rootLabel} not fully a-w (writable=${writable})`)
  }
  // Mount surface existence + NEVER-a-worktree guard + helper placement + nearest manifests
  for (const [label, p] of [['host.js', PRODUCTION_ROW_PATH], ['agent-bindings.mjs', GLUE_PATH], ['seam.mjs', SEAM_PATH], ['mounted helper plugin.mjs', P6T6_PLUGIN_PATH]]) {
    if (!existsSync(p)) await dieFatal(`mount surface missing: ${label} ${p}`)
    if (p.includes('.worktrees')) await dieFatal(`mount path under .worktrees — forbidden: ${p}`)
  }
  const mountedHelperHash = sha256File(P6T6_PLUGIN_PATH)
  log(`mounted helper sha256 = ${mountedHelperHash} (${mountedHelperHash === EXPECT_PLUGIN_SHA ? 'MATCH' : 'MISMATCH'} vs pin)`)
  if (mountedHelperHash !== EXPECT_PLUGIN_SHA) await dieFatal(`mounted helper hash ${mountedHelperHash} != pin`)
  {
    const pkgMeta = JSON.parse(readFileSync(join(INSTALL_PKG, 'package.json'), 'utf8'))
    const helperMeta = JSON.parse(readFileSync(join(HOME, 'mount-helper-root', 'package', 'package.json'), 'utf8'))
    for (const [label, meta] of [['install-19d54bd72/package/package.json', pkgMeta], ['mount-helper-root/package/package.json', helperMeta]]) {
      const peers = Object.entries(meta.peerDependencies ?? {})
      const ok = meta.name === 'dsh-agent-team' && meta.version === '0.1.1-alpha.2' && peers.length === 9 && peers.every(([, v]) => v === '0.2.0-rc.2') && (meta.exports?.['./host'] ?? '').endsWith('/plugin/host.js')
      log(`nearest manifest (${label}): ${meta.name}@${meta.version} peers=${peers.length}x${[...new Set(peers.map(([, v]) => v))].join(',')} (${ok ? 'IDENTITY-OK' : 'IDENTITY-BAD'})`)
      if (!ok) await dieFatal(`root identity manifest bad at ${label}`)
    }
  }
  // Skills: root package ships its own .agents/skills — the plugin's parent
  // locator (7-up from the host.js entry dir) lands INSIDE install-495/package.
  for (const rootPkg of [INSTALL_PKG, join(HOME, 'mount-helper-root', 'package')]) {
    for (const s of ['team-blueprint-authoring', 'team-leader-operations']) {
      if (!existsSync(join(rootPkg, '.agents', 'skills', s, 'SKILL.md'))) await dieFatal(`bundled skills missing under ${rootPkg}: ${s}`)
    }
  }
  log('skills attribution: bundled .agents/skills resolves from the production entry (auxiliary locator, disclosed)')
  // OFFLINE FULL-DECLARATION AUDIT (root 10:39 item 4): every manifest claim
  // must be TRUE under BOTH mount roots — including the client-composition face
  // that killed run-2026-10-23T10-37-02. Replicates the host's own derivation
  // (test-use packages/client/modules/lib/index.js: nearest package.json of the
  // row entry + exports["./client"] string, joined under the package dir).
  {
    const auditLines = []
    const audit = (ok, line) => { auditLines.push(`${ok ? 'OK  ' : 'FAIL'} ${line}`); if (!ok) return false; return true }
    let auditOk = true
    const registrySrc = readFileSync(join(TESTUSE, 'packages', 'client', 'modules', 'lib', 'index.js'), 'utf8').split('\n')
    const clientRelLine = registrySrc.findIndex((l) => l.includes('const clientRel = clientExportOf')) + 1
    const joinLine = registrySrc.findIndex((l) => l.includes('clientPath: join(dirname(pkgPath), clientRel)')) + 1
    auditOk = audit(clientRelLine > 0 && joinLine > 0, `host registry derivation located: clientExportOf@L${clientRelLine}, join(dirname(pkgPath), clientRel)@L${joinLine}`) && auditOk
    for (const [rootLabel, rootPkg] of [[INSTALL_DIR, INSTALL_PKG], ['mount-helper-root', join(HOME, 'mount-helper-root', 'package')]]) {
      const meta = JSON.parse(readFileSync(join(rootPkg, 'package.json'), 'utf8'))
      for (const f of meta.files ?? []) auditOk = audit(existsSync(join(rootPkg, f)), `${rootLabel}: files entry ${f}`) && auditOk
      for (const [ex, target] of Object.entries(meta.exports ?? {})) {
        const t = typeof target === 'string' ? target : (target?.import ?? target?.default)
        if (typeof t === 'string') auditOk = audit(existsSync(join(rootPkg, t)), `${rootLabel}: exports["${ex}"] -> ${t}`) && auditOk
      }
      const patchRel = meta.dsh?.bundle?.patch
      if (typeof patchRel === 'string') auditOk = audit(existsSync(join(rootPkg, patchRel)), `${rootLabel}: dsh.bundle.patch -> ${patchRel}`) && auditOk
      if (meta.dsh?.client?.platform === 'web') {
        // registry formula, verbatim:
        const cExp = meta.exports?.['./client']
        const clientRel = typeof cExp === 'string' ? cExp : cExp?.default
        const clientPath = join(rootPkg, clientRel ?? '__missing__')
        let st = null
        try { st = statSync(clientPath) } catch { /* ENOENT -> FAIL below */ }
        auditOk = audit(st !== null && st.isFile(), `${rootLabel}: ClientModuleRegistry clientPath = ${clientPath} stat=${st ? 'FILE' : 'MISSING'}`) && auditOk
      }
      // helper relative leg target (../../runtime/dist/... from tools/harness):
      if (rootLabel === 'mount-helper-root') {
        const leg = join(rootPkg, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'mutation', 'index.js')
        auditOk = audit(existsSync(leg), `${rootLabel}: helper dynamic leg target ${leg.replace(HOME + '/', '')}`) && auditOk
        auditOk = audit(sha256File(join(rootPkg, 'packages', 'tools', 'harness', 'plugin.mjs')) === EXPECT_PLUGIN_SHA, `${rootLabel}: helper bytes == pin 471475b9…`) && auditOk
      }
    }
    writeFileSync(join(RUN_DIR, 'declaration-audit.txt'), auditLines.join('\n') + '\n')
    log(`declaration audit: ${auditLines.length} checks (${auditOk ? 'PASS' : 'FAIL'}), written to RUN_DIR/declaration-audit.txt`)
    if (!auditOk) await dieFatal('OFFLINE FULL-DECLARATION AUDIT FAILED (see declaration-audit.txt)')
  }
  // RESOLUTION PROBE (pre-boot): real import of the three production entries +
  // helper + bare-import census from the REAL world layout, child process.
  const probeScript = `
import { pathToFileURL } from 'node:url'
import { readFileSync } from 'node:fs'
const targets = ${JSON.stringify({ host: PRODUCTION_ROW_PATH, glue: GLUE_PATH, seam: SEAM_PATH, helper: P6T6_PLUGIN_PATH, 'helper-leg': join(HOME, 'mount-helper-root', 'package', 'packages', 'runtime', 'dist', 'packages', 'runtime', 'mutation', 'index.js') })}
const bare = ['@deepseek-ai/dsh-agent','@deepseek-ai/dsh-llm','@deepseek-ai/dsh-mcp-client','@deepseek-ai/dsh-scope','@deepseek-ai/dsh-session','@deepseek-ai/dsh-spill','@deepseek-ai/dsh-spill-local','@deepseek-ai/dsh-storage-domain','@deepseek-ai/dsh-system-prompt','@deepseek-ai/dsh-tool-fs-search','@deepseek-ai/cordis','zod','yaml']
let fail = 0
for (const s of bare) {
  try { await import(s); console.log('DEP-OK ' + s) } catch (e) { fail += 1; console.log('DEP-FAIL ' + s + ' :: ' + (e?.code ?? e?.name) + ' :: ' + String(e?.message).slice(0, 160)) }
}
// @deepseek-ai/dsh = host virtual kernel: no root export, nothing on the mount
// surface imports it bare (census). Presence + exact-version proof instead:
try {
  const m = JSON.parse(readFileSync(process.cwd() + '/../node_modules/@deepseek-ai/dsh/package.json', 'utf8'))
  console.log('DEP-PRESENT @deepseek-ai/dsh version=' + m.version + ' ' + (m.version === '0.2.0-rc.2' ? 'OK' : 'VERSION-BAD'))
  if (m.version !== '0.2.0-rc.2') fail += 1
} catch (e) { fail += 1; console.log('DEP-FAIL @deepseek-ai/dsh :: ' + (e?.code ?? e?.name)) }
for (const [k, p] of Object.entries(targets)) {
  try { await import(pathToFileURL(p).href); console.log('IMPORT-OK ' + k) } catch (e) { fail += 1; console.log('IMPORT-FAIL ' + k + ' :: ' + (e?.code ?? e?.name) + ' :: ' + String(e?.message).slice(0, 200)) }
}
console.log(fail === 0 ? 'PROBE PASS' : 'PROBE FAIL ' + fail)
process.exit(fail === 0 ? 0 : 1)
`
  try {
    const out = execFileSync(process.execPath, ['--input-type=module', '-e', probeScript], { cwd: INSTALL_PKG, encoding: 'utf8', timeout: 180_000, maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
    writeFileSync(join(RUN_DIR, 'resolution-probe.txt'), out)
    log(`resolution probe: PASS (${out.trim().split('\n').length - 1} checks)`)
    if (!existsSync(TESTUSE)) await dieFatal(`fsInstance.rootDir (the world-native session workspace root) does not exist: ${TESTUSE}`)
    log(`fsInstance preflight (root 12:20Z): rootDir=${TESTUSE} exists=true; realm-bound (realmId === teamToolPlane.realmId); kind=absolute-path (a5ie public shape; a23d consumers read rootDir ONLY — agent-bindings.mjs:3045/:2815/:2902); no mkdir, no new root, no cwd change`)
  if (FIXTURE === 'write') {
    mkdirSync(join(TESTUSE, 'examples', 'minimal'), { recursive: true })
    writeFileSync(WF_ABS, WF_INIT)
    const st0 = wfState()
    if (st0.sha !== createHash('sha256').update(Buffer.from(WF_INIT)).digest('hex') || st0.size !== Buffer.byteLength(WF_INIT)) await dieFatal('WRITE-FIXTURE preflight: INIT bytes did not land exactly')
    log(`WRITE-FIXTURE (root 13:01Z): file=${WF_REL} synthesized-EXISTS pre-boot (pre-creation is NOT a product newfile pass); INIT sha=${st0.sha} size=${st0.size}; TGT sha=${WF_TGT_SHA} size=${Buffer.byteLength(WF_TGT)}; deny/cancel attempts=${'WF_DENY/WF_CANCEL never-land'}; gitignored pattern examples/*/*.jsonl; leg zero-change baselines = ACTUAL bytes at each leg start (post-allow = TGT)`)
    writeFileSync(join(RUN_DIR, 'fixture-evidence.json'), JSON.stringify({
      relPath: WF_REL, absPath: WF_ABS, mode: FIXTURE,
      init: { bytes: WF_INIT, sha256: st0.sha, size: st0.size },
      target: { bytes: WF_TGT, sha256: WF_TGT_SHA, size: Buffer.byteLength(WF_TGT) },
      denyAttempt: WF_DENY, cancelAttempt: WF_CANCEL,
    }, null, 2))
  }
  if (FIXTURE === 'image') {
    mkdirSync(join(TESTUSE, 'examples', 'minimal', '.sessions'), { recursive: true })
    const png = synthPng(IMG_W, IMG_H)
    writeFileSync(IMG_ABS, png)
    const sha = createHash('sha256').update(png).digest('hex')
    if (statSync(IMG_ABS).size !== png.length) await dieFatal('IMAGE-FIXTURE preflight: PNG size did not land exactly')
    IMG_SRC_SHA = sha
    storeBaseline = storeCensus()
    log(`IMAGE-FIXTURE (root 14:57): synthetic ${IMG_W}x${IMG_H} PNG file=${IMG_REL} sha256=${sha} size=${png.length} pre-boot (gitignored pattern examples/*/.sessions/ — Host .gitignore untouched); store cap override maxImageDimension=1024 via profile patch layer -> EXPECTED store normalization: 1024x${IMG_NORM_H} preview + originalDimensions ${IMG_W}x${IMG_H} on the receipt; attachment-store census baseline = ${storeBaseline.length} objects (pre-run)`)
    writeFileSync(join(RUN_DIR, 'fixture-evidence.json'), JSON.stringify({
      relPath: IMG_REL, absPath: IMG_ABS, mode: FIXTURE,
      synthetic: { width: IMG_W, height: IMG_H, generator: 'kit synthPng (filter-0 RGB scanlines, zlib level 9, single IDAT, deterministic)', sha256: sha, size: png.length },
      storeCapOverride: { maxImageDimension: 1024, seam: 'profile patch override id=attachment-local (base row carries NO config; wholesale replace restates nothing)' },
      expectedNormalization: { width: IMG_NORM_W, height: IMG_NORM_H, originalDimensions: { width: IMG_W, height: IMG_H } },
      storeCensusBaseline: storeBaseline,
    }, null, 2))
  }
  } catch (e) {
    writeFileSync(join(RUN_DIR, 'resolution-probe.txt'), `${e.stdout ?? ''}\n--stderr--\n${e.stderr ?? ''}\n${e.message}`)
    await dieFatal(`RESOLUTION PROBE FAILED pre-boot (see ${join(RUN_DIR, 'resolution-probe.txt')})\n${String(e.stdout ?? '').slice(0, 1200)}`)
  }
  if (!existsSync(HOST_BIN)) await dieFatal(`host bin missing: ${HOST_BIN} (host not built)`)
  // AUTHORIZED probe fix (root ruling 10:03 item 2): the REAL entry check on
  // the designated built checkout (replaces the faulty <testuse>/lib probe).
  const tuHead = execFileSync('git', ['-C', TESTUSE, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  const tuPorcelain = execFileSync('git', ['-C', TESTUSE, 'status', '--porcelain'], { encoding: 'utf8' }).trim()
  log(`host runtime ${TESTUSE}: HEAD=${tuHead} porcelainEmpty=${tuPorcelain === ''} bin=${existsSync(HOST_BIN)}`)
  if (tuHead !== HOST_BASELINE_SHA) await dieFatal(`host runtime HEAD ${tuHead} != baseline ${HOST_BASELINE_SHA}`)
  if (tuPorcelain !== '') await dieFatal(`host runtime porcelain not empty:\n${tuPorcelain.slice(0, 500)}`)
}

// ── main ───────────────────────────────────────────────────────────────────
async function main() {
  // direct entry only (main is entry-gated): NOW load harness deps + re-validate CLI
  await loadHarness()
  HOST_BASELINE_SHA = TEST_USE_BASELINE_SHA
  if (FIXTURE !== 'todo' && FIXTURE !== 'write' && FIXTURE !== 'image') await dieFatal(`--fixture invalid: ${FIXTURE}`)
  mkdirSync(RUN_DIR, { recursive: true })
  RUN_LOG = join(RUN_DIR, 'run.log')
  log(`RUN IDENTITY (root 14:57 ruling — IMAGE C2 window): ROOT package pin 249eb65ec1789ab8bfcf02268d14d3d7060b8c2a tgz ca0f4b253fd3e9075e86d772f33ccb21c42c165ff7de3dee5949faf5c780d4b7 (3251993B; SYMMETRIC paImageHandoff third port @root 14:44: adapter third-port lines + plane image hand-off face/redemption + glue presence forwarding + booked 11-leg spec + census round-13 + same-commit dist mirrors; build-at-head ok compared=1788 drift=0; source==dist plane 03b2eb95/glue 1bda93d3 cmp clean; PATHSET-EQUAL-1813 vs 19d54, content delta EXACTLY SIX files; G1/G2/G3 owner files NOT on this commit, cannot ride git-archive BY CONSTRUCTION); install-surface gate 473 lines digest cc3d4b1b…; tree INFO f8d5622a… (MANIFEST@249eb LC_ALL=C per-file recipe); layout REUSED: dual root (${INSTALL_DIR} + mount-helper-root, helper == pin 471475b9); IMAGE fixture invariants (root 14:57): synthetic 2048x1536 PNG under examples/*/.sessions/ (gitignored L15; Host .gitignore UNTOUCHED), store override maxImageDimension=1024 via profile-patch override of id=attachment-local (base row carries no config) -> REAL normalization 1024x768 + originalDimensions on the receipt; image-capable route = shipped catalog model deepseek-flash (inputModalities text+image; assertImageCapableRoute tool-fs/src/read-image.ts:117-130 same position on the governed row); default ask KEPT, original fsroot/15-Team exclusions/19 global denies KEPT, NO user images; PASS BAR: old parameter-permission rows = 0 for read_image (the hand-off EMPIRICALLY opens the old front door at zero), PA PENDING ZERO store objects (direct census; reads only at the audited execution edge = control-flow INFERENCE — never 'independent read 0'), public allow ONE Control consumption + REAL normalized ref + model-visible text ORIGINAL dimensions + image part with byte-identity to the stored object, deny/public-abandon ZERO commits; abandon via p6t6 abandonControlRequest authority (NOT nativeAbort); PA independent evidence ABSENT => audited control-flow INFERENCE wording stays; grep never called; 19d54/8b94 pins + r11-r16 evidence KEPT byte-for-byte; ONE run, first-error-stop`)
  REALM_ESC = REALM.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  await preflight()

  // ss -ltn proof before launch
  try {
    const ss = execFileSync('ss', ['-ltn'], { encoding: 'utf8' })
    writeFileSync(join(RUN_DIR, 'ss-ltn-before-launch.txt'), ss)
    log('ss -ltn snapshot written (pre-launch)')
  } catch (e) { log(`ss snapshot failed: ${e.message}`) }

  const HOST_PORT = Number(argValue('host-port', 0)) || await pickPort(HOST_PORT_CANDIDATES, 'host')
  const MOCK_PORT = Number(argValue('mock-port', 0)) || await pickPort(MOCK_PORT_CANDIDATES, 'mock')
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${MOCK_PORT}`
  process.env.DEEPSEEK_API_KEY = `a5m2c2-mock-${NONCE}`
  log(`RUN_STAMP=${RUN_STAMP} hostPort=${HOST_PORT} mockPort=${MOCK_PORT} realm=${REALM}`)
  log(`world=${HOME} install=${INSTALL} testuse=${TESTUSE}`)

  mkdirSync(join(RUN_DIR, 'git-pre'), { recursive: true })
  const testUsePre = await captureGitState(TESTUSE, join(RUN_DIR, 'git-pre'))
  writeFileSync(join(RUN_DIR, 'testuse-pre.json'), JSON.stringify(testUsePre, null, 2))
  log(`H1 pre: testuse head=${testUsePre.head} statusEmpty=${testUsePre.statusEmpty}`)

  await assertWorld()
  writeFileSync(join(BLUEPRINT_DIR, 'a5m2c2-anchor.yaml'), BP_ANCHOR_YAML)

  const mock = await startMockModel({ port: MOCK_PORT, decide: makeDecide(), log: (line) => log(`mock: ${line}`) })
  if (mock.port !== MOCK_PORT) await dieFatal(`mock landed on ${mock.port}`)
  mockRef = mock

  let host = null
  try {
    host = await bootHost({ label: 'HOST1', port: HOST_PORT, boot: 1, phase: 'create' })
    EVID.hostLogs.push({ phase: 'create', port: HOST_PORT, logPath: host.logPath })

    // L0: boot-leader surface (native todo_write description bytes + deny list)
    const pDisc = await apiPrompt(host.origin, host.cookie, ROOT, `${MK_DISC} Report your tool inventory, then finish.`, 'l0')
    if (!(pDisc.status === 200 && pDisc.body?.result?.ok === true)) await dieFatal(`L0 prompt not admitted: ${pDisc.status} ${jstr(pDisc.body, 200)}`)
    const discReq = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r.body.messages ?? []).includes(MK_DISC) && Array.isArray(r.body?.tools) && r.body.tools.length > 0, 180_000, 'L0 model request')
    if (discReq === null) await dieFatal('L0 model request not observed')
    const surface = (discReq.body.tools ?? []).map((t) => ({ name: t.function?.name ?? t.name ?? String(t), description: t.function?.description ?? t.description ?? '' }))
    const nativeTodo = surface.find((t) => t.name === 'todo_write')
    if (nativeTodo === undefined) await dieFatal(`native surface missing todo_write (${surface.length} tools)`)
    const denyList = surface.map((t) => t.name).filter((n) => !MANAGED_TOOL_NAMES.includes(n) && !SAFE_UNMANAGED_TOOL_NAMES.includes(n) && !TEAM_TOOL_CATALOG.includes(n) && !OWN_LAYER_SPAWN_TOOLS.includes(n))
    // Fixture invariant (per 495 exemplar law: the deny is NEVER a team-tool
    // deny): a team_* name on the denyList means the catalog drifted from the
    // mounted product generation — fail loud HERE, not at team.create.
    const teamLeak = denyList.filter((n) => n.startsWith('team_'))
    if (teamLeak.length !== 0) await dieFatal(`L0 denyList carries team-tool names (catalog drift): ${teamLeak.join(', ')}`)
    // RULING 10:52 item 3(a): per-name audit denyList ⊆ ACTUAL global surface.
    // The 25-name global vocabulary is the host's own bytes (run-2026-10-23T10-42-00
    // api-transcript restrict error "known global tools:", host 639ed015).
    const HOST_GLOBAL_25 = ['ask_user_question', 'bash', 'create_goal', 'edit', 'exit_plan_mode', 'get_goal', 'glob', 'grep', 'interrupt_agent', 'job_kill', 'job_list', 'job_output', 'list_agents', 'present', 'read', 'read_image', 'send_message', 'skill', 'subagent_fork', 'todo_write', 'update_goal', 'web_fetch', 'web_search', 'workflow', 'write']
    const surfaceNames = surface.map((t) => t.name)
    const missingGlobal = HOST_GLOBAL_25.filter((n) => !surfaceNames.includes(n))
    const outsideGlobal = denyList.filter((n) => !HOST_GLOBAL_25.includes(n))
    const catalogVsGlobal = TEAM_TOOL_CATALOG.filter((n) => HOST_GLOBAL_25.includes(n))
    const denyAuditLines = [
      `host actual global vocabulary (25, provenance: run-2026-10-23T10-42-00/api-transcript.json restrict-error bytes, host 639ed015):`,
      ...HOST_GLOBAL_25.map((n) => `  ${n}`),
      `surface contains all 25 globals: ${missingGlobal.length === 0 ? 'YES' : 'MISSING ' + missingGlobal.join(',')}`,
      ...denyList.map((n) => `deny-name ${n} :: in-actual-globals = ${HOST_GLOBAL_25.includes(n) ? 'YES' : 'NO'}`),
      `denyList outside actual globals: ${outsideGlobal.length === 0 ? 'NONE' : outsideGlobal.join(',')}`,
      `team catalog vs globals (must be disjoint): ${catalogVsGlobal.length === 0 ? 'DISJOINT' : 'OVERLAP ' + catalogVsGlobal.join(',')}`,
    ]
    // 3(b): the 15-name catalog provenance — derived AT RUNTIME from the 495
    // tracked exemplar source + the captured rc.2 live fixture, then compared
    // name-for-name with the kit's by-name catalog (no prefix rules anywhere).
    const fiSrc = execFileSync('git', ['-C', WORKTREE, 'show', `${SOURCE_PIN_SHA}:tests/kits/rc2-real-host-smoke/fixture-invariants.mjs`], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
    const fiBlock = fiSrc.slice(fiSrc.indexOf('TEAM_TOOL_CATALOG = Object.freeze(['))
    const fiNames = [...fiBlock.slice(0, fiBlock.indexOf('])')).matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
    const fiFixture = execFileSync('git', ['-C', WORKTREE, 'show', `${SOURCE_PIN_SHA}:tests/kits/rc2-real-host-smoke/fixtures/captured-0.2.0-rc.2/model-request-0.2.0-rc.2-agent-first-turn-0001.json`], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
    const fxTeamNames = [...new Set([...fiFixture.matchAll(/"name":\s*"(team_[a-z_]+)"/g)].map((m) => m[1]))]
    const fiEq = fiNames.length === 15 && fiNames.every((n) => TEAM_TOOL_CATALOG.includes(n)) && TEAM_TOOL_CATALOG.every((n) => fiNames.includes(n))
    const fxCover = TEAM_TOOL_CATALOG.every((n) => fxTeamNames.includes(n))
    denyAuditLines.push(
      `catalog provenance: exemplar fixture-invariants.mjs@${SOURCE_PIN_SHA.slice(0, 7)} L52-68 names=${fiNames.length} equal-to-kit-catalog=${fiEq ? 'YES' : 'NO'}; captured rc.2 fixture model-request-...-0001.json team names=${fxTeamNames.length} covers-all-15=${fxCover ? 'YES' : 'NO (' + TEAM_TOOL_CATALOG.filter((n) => !fxTeamNames.includes(n)).join(',') + ')'}`,
    )
    writeFileSync(join(RUN_DIR, 'preflight-deny-audit.txt'), denyAuditLines.join('\n') + '\n')
    log(`deny audit: globals-on-surface=${missingGlobal.length === 0} deny-subset-globals=${outsideGlobal.length === 0} disjoint=${catalogVsGlobal.length === 0} provenance exemplar=${fiEq} fixture=${fxCover} (RUN_DIR/preflight-deny-audit.txt)`)
    if (missingGlobal.length !== 0) await dieFatal(`actual host global vocabulary drifted from the 25-name capture: missing ${missingGlobal.join(', ')}`)
    if (outsideGlobal.length !== 0) await dieFatal(`denyList names outside actual globals: ${outsideGlobal.join(', ')}`)
    if (catalogVsGlobal.length !== 0) await dieFatal(`team catalog overlaps the global vocabulary: ${catalogVsGlobal.join(', ')}`)
    if (!fiEq || !fxCover) await dieFatal(`team catalog provenance check FAILED (exemplar-equal=${fiEq} fixture-covers=${fxCover})`)
    let nativeImage = null
    if (FIXTURE === 'image') {
      nativeImage = surface.find((t) => t.name === 'read_image')
      if (nativeImage === undefined) await dieFatal(`native surface missing read_image (${surface.length} tools) — the image fixture has nothing to bind`)
    }
    let nativeWrite = null
    if (FIXTURE === 'write') {
      nativeWrite = surface.find((t) => t.name === 'write')
      if (nativeWrite === undefined) await dieFatal(`native surface missing write (${surface.length} tools) — the write fixture has nothing to bind`)
      log(`L0 native write description ${nativeWrite.description.length} bytes (write fixture)`)
    }
    writeFileSync(join(RUN_DIR, 'l0-surface.json'), JSON.stringify({ count: surface.length, names: surface.map((t) => t.name), nativeTodoDescription: nativeTodo.description, ...(nativeWrite === null ? {} : { nativeWriteDescription: nativeWrite.description }), ...(nativeImage === null ? {} : { nativeImageDescription: nativeImage.description, nativeImageParameters: nativeImage.parameters }), denyList }, null, 2))
    log(`L0 surface ${surface.length} tools; native todo_write description ${nativeTodo.description.length} bytes`)
    {
      // root 12:20Z ruling: instance-binding/session consistency — the mount's
      // governed root must BE the session workspace root (same cwd, no second
      // root). Boot session's durable projcache identity.cwd is that evidence.
      const pcPath = join(HOME, 'storages', 'session_projcache', 'sessions', `${ROOT}.json`)
      let pcCwd = null
      try { pcCwd = JSON.parse(readFileSync(pcPath, 'utf8'))?.record?.identity?.cwd ?? null } catch { pcCwd = null }
      log(`fsInstance<->session consistency: boot-session projcache identity.cwd = ${jstr(pcCwd, 120)} (${pcCwd === TESTUSE ? 'EQUALS mount rootDir' : 'MISMATCH'})`)
      if (pcCwd !== TESTUSE) await dieFatal(`fsInstance root/session binding mismatch: projcache cwd ${jstr(pcCwd, 120)} != ${TESTUSE}`)
    }
    writeFileSync(join(BLUEPRINT_DIR, 'a5m2c2-todo.yaml'), savedBlueprintYaml(BP_TODO_ID, denyList))
    if ((await waitForMock(mock, (r) => r.reply?.content === DONE_DISC, 120_000, 'L0 turn')) === null) await dieFatal('L0 turn did not complete')

    // Create the gated team
    const createP = await remoteCallReady(host, 'team.create', { rootSessionId: ROOT_P, blueprintId: BP_TODO_ID }, 'create', 1)
    if (resultError(createP.body) !== null) await dieFatal(`team.create failed: ${jstr(resultError(createP.body), 400)}`)
    log(`team created at ${ROOT_P}`)

    // ── C1/C2/C3/C4 driver: leader creates w1 + async delegates WORK1 ─────
    const p1 = await apiPrompt(host.origin, host.cookie, ROOT_P, `${MK_CREATE} Create worker w1 from template worker, then delegate task W1 asynchronously.`, 'c1')
    if (!(p1.status === 200 && p1.body?.result?.ok === true)) await dieFatal(`C1 leader prompt not admitted: ${p1.status}`)
    if ((await waitForMock(mock, (r) => r.reply?.content === DONE_CREATE, 240_000, 'leader create+delegate')) === null) await dieFatal('leader create+delegate did not complete')

    const row1 = await waitForTodoRow(host, (p) => FIXTURE === 'image' ? p.toolName === 'read_image' : FIXTURE === 'write' ? p.toolName === 'write' : (TODO_CORR_RE().test(String(p.correlation ?? '')) && p.toolName === 'todo_write'), 180_000, `C1 governed ${ROW_TOOL} row`)
    if (row1 === null) {
      check('C1', `a durable governed Control row was created for the member ${ROW_TOOL} call`, false, `recorded rows: ${jstr(readLedger().recorded.map((f) => ({ rid: f.payload.requestId, corr: f.payload.correlation, tool: f.payload.toolName })), 1500)}`)
      finishCriterion('C1') // throws FirstFailureStop
    }
    const W1 = row1.payload.targetInstanceId
    const childSid = childSessionOf(W1)
    if (childSid === null) await dieFatal(`childSessionId for member ${W1} not found in the durable operations table`)
    log(`governed todo row: requestId=${row1.payload.requestId} correlation=${row1.payload.correlation} target=${W1} child=${childSid}`)

    // member model surface: captured native description bytes
    const memberReq = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r.body.messages ?? []).includes(MK_WORK1) && Array.isArray(r.body?.tools) && r.body.tools.some((t) => (t.function?.name ?? t.name) === ROW_TOOL), 180_000, `member model request with ${ROW_TOOL}`)
    if (memberReq === null) {
      check('C1', 'the member model-facing surface carries todo_write', false, 'no member model request with todo_write observed')
      finishCriterion('C1')
    }
    const memberTodo = (memberReq.body.tools ?? []).map((t) => t.function ?? t).find((t) => t.name === ROW_TOOL)
    const nativeRef = FIXTURE === 'image' ? nativeImage : FIXTURE === 'write' ? nativeWrite : nativeTodo
    check('C1', `the member surface carries ${ROW_TOOL} with the CAPTURED NATIVE description bytes (== boot-leader native surface text)`,
      typeof memberTodo?.description === 'string' && memberTodo.description === nativeRef.description,
      `member ${String(memberTodo?.description).length}B vs native ${nativeRef.description.length}B; identical=${memberTodo?.description === nativeRef.description}`)
    const rpW = row1.payload.reviewPayload ?? {}
    const tmW = rpW.targetManifest ?? {}
    const memberW = rpW.member ?? {}
    const corrSegs = String(row1.payload.correlation ?? '').split(':')
    const oldGateRows = readLedger().recorded.filter((f) => (f.payload ?? {}).actionName === 'parameter-permission').length
    // root 14:22 ruling: NO write.r internal plan-name matching. Verify THIS live
    // call's real Control requestId, toolName=write, PA-bridge correlation bound to
    // root/member/realm, the COMPLETE manifest target, and the content-bound
    // parametersFingerprint — not a bare includes('plane-write').
    const writeRowBound = row1.payload.toolName === 'write'
      && row1.payload.actionName === 'team-tool-execute'
      && row1.payload.kind === 'leader-approval'
      && /^ctrl-[a-z0-9]+$/.test(String(row1.payload.requestId ?? ''))
      && String(row1.payload.correlation ?? '').startsWith(`pa:tadm:${ROOT_P}:`)
      && corrSegs[3] === row1.payload.targetInstanceId && /^inst-[a-z0-9]+$/.test(String(corrSegs[3]))
      && /:g\d+:plane-write:/.test(String(row1.payload.correlation ?? ''))
      && String(row1.payload.correlation ?? '').endsWith(`${REALM}-1`)
      && memberW.instanceId === row1.payload.targetInstanceId
      && memberW.teamSessionId === ROOT_P
      && rpW.realmId === REALM
      && tmW.familyId === 'B-WRITE' && tmW.operation === 'write-existing-file' && tmW.adapterRevision === 1
      && tmW.existingFileOnly === true
      && tmW.canonicalTarget === WF_ABS
      && tmW.contentFingerprint === `sha256:${WF_TGT_SHA}`
      && (rpW.effects ?? []).some((e) => e.kind === 'write' && e.resource?.canonicalLocator === WF_ABS && e.resource?.realmId === REALM && String(e.resource?.rights) === 'write')
      && /^sha256:[0-9a-f]{64}$/.test(String(rpW.parametersFingerprint ?? ''))
      && oldGateRows === 0
    // root 14:57 image row: the SAME same-call binding law, image fields (plane-image lane,
    // B-IMAGE/read-exact-file/adapterRevision 2, pure-lexical canonicalTarget, declared mediaType,
    // store-min byteCap, read effect locator). No fuzzy lane word.
    const imageRowBound = row1.payload.toolName === 'read_image'
      && row1.payload.actionName === 'team-tool-execute'
      && row1.payload.kind === 'leader-approval'
      && /^ctrl-[a-z0-9]+$/.test(String(row1.payload.requestId ?? ''))
      && String(row1.payload.correlation ?? '').startsWith(`pa:tadm:${ROOT_P}:`)
      && corrSegs[3] === row1.payload.targetInstanceId && /^inst-[a-z0-9]+$/.test(String(corrSegs[3]))
      && /:g\d+:plane-image:/.test(String(row1.payload.correlation ?? ''))
      && String(row1.payload.correlation ?? '').endsWith(`${REALM}-1`)
      && memberW.instanceId === row1.payload.targetInstanceId
      && memberW.teamSessionId === ROOT_P
      && rpW.realmId === REALM
      && tmW.familyId === 'B-IMAGE' && tmW.operation === 'read-exact-file' && tmW.adapterRevision === 2
      && tmW.canonicalTarget === IMG_ABS
      && tmW.declaredMediaType === 'image/png'
      && Number.isInteger(tmW.byteCap) && tmW.byteCap > 0
      && (rpW.effects ?? []).some((e) => e.kind === 'tool-invoke' && e.toolName === 'read_image')
      && (rpW.effects ?? []).some((e) => e.kind === 'read' && e.resource?.canonicalLocator === IMG_ABS && e.resource?.realmId === REALM && String(e.resource?.rights) === 'read')
      && /^sha256:[0-9a-f]{64}$/.test(String(rpW.parametersFingerprint ?? ''))
      && oldGateRows === 0
    check('C1', FIXTURE === 'image'
      ? 'the call ran the GOVERNED row: SAME live call verified end-to-end — real requestId (ctrl-*), toolName=read_image, PA-bridge correlation binding root + member + realm (plane-image lane), complete pure-lexical manifest (B-IMAGE/read-exact-file/rev2/canonicalTarget=fixture/image+png declaredMediaType/store-min byteCap) + read-effect locator, parametersFingerprint (sha256:64hex), and ZERO old parameter-permission rows for read_image (root 14:57: the hand-off EMPIRICALLY opens the old front door at zero)'
      : `the call ran the GOVERNED row: SAME live call verified end-to-end — real requestId (ctrl-*), toolName=write, PA-bridge correlation binding root ${'+'} member ${'+'} realm (plane-write lane), complete manifest target (B-WRITE/write-existing-file/existingFileOnly/canonicalTarget=fixture/contentFingerprint=sha256(WF_TGT)) ${'+'} write-effect locator, content-bound parametersFingerprint (sha256:64hex), and ZERO old parameter-permission rows (root 14:22 criterion; no write.r plan-name matching)`,
      FIXTURE === 'image'
        ? imageRowBound
        : FIXTURE === 'write'
          ? writeRowBound
          : (TODO_CORR_RE().test(String(row1.payload.correlation ?? '')) && row1.payload.toolName === 'todo_write' && String(row1.payload.correlation ?? '').includes(`plane-todo:${REALM}-`)),
      `oldGateRows=${oldGateRows} row=${jstr(row1, 1900)}`)
    finishCriterion('C1')

    // C2: zero todo/write while pending (first ensure the member's session
    // log file exists at all — bounded poll; an absent file would make the
    // zero-check vacuous)
    let memberLog = readMemberTodoLog(childSid)
    const fileDeadline = Date.now() + 45_000
    for (;;) {
      memberLog = readMemberTodoLog(childSid)
      if (memberLog.files.length > 0) break
      if (Date.now() >= fileDeadline) break
      await new Promise((r) => setTimeout(r, 1000))
    }
    const leg1Start = FIXTURE === 'write' ? wfState() : null
    if (FIXTURE === 'write') {
      const nowS = wfState()
      check('C2', `while row ${row1.payload.requestId} is PENDING, the fixture file is UNCHANGED vs its bytes at leg start (zero modification; sha+size)`,
        leg1Start.sha !== null && nowS.sha === leg1Start.sha && nowS.size === leg1Start.size && memberLog.files.length > 0,
        `legStart=${JSON.stringify(leg1Start)} now=${JSON.stringify(nowS)} sessionFiles=${memberLog.files.length}`)
    }
    if (FIXTURE === 'image') {
      const pendStore = storeCensus()
      const imgNow = (() => { try { const b = readFileSync(IMG_ABS); return { sha: createHash('sha256').update(b).digest('hex'), size: b.length } } catch { return { sha: null, size: -1 } } })()
      check('C2', `while row ${row1.payload.requestId} is PENDING: ZERO committed attachment objects (store census == pre-run baseline ${storeBaseline.length}) and the source PNG bytes UNCHANGED — DIRECT facts: the store census and the file bytes; reads occur only on the audited execution edge (pre-consumption read = control-flow INFERENCE at the classified edge, never an independent read-counter claim; root 14:57 law)`,
        pendStore.length === storeBaseline.length && imgNow.sha === IMG_SRC_SHA && imgNow.size === statSync(IMG_ABS).size && memberLog.files.length > 0,
        `census=${pendStore.length} baseline=${storeBaseline.length} png=${JSON.stringify(imgNow)} expectedSha=${IMG_SRC_SHA} sessionFiles=${memberLog.files.length}`)
    } else {
      check('C2', `while row ${row1.payload.requestId} is PENDING, the member session log has ZERO todo/write entries`,
        memberLog.rows.length === 0 && memberLog.files.length > 0,
        `todo/write rows=${memberLog.rows.length}; session files=${memberLog.files.length} (${memberLog.files.join(', ').slice(0, 300)})`)
    }
    finishCriterion('C2')

    // C3: public ALLOW over remote v4 -> unique consumption -> exactly one append
    const resA = await remoteCallReady(host, 'team.resolveControl', { teamSessionId: ROOT_P, requestId: row1.payload.requestId, decision: 'allow', note: 'a5m2c2 C3 public allow' }, 'res-c3', 4)
    const dataA = resultData(resA.body)
    check('C3', 'PUBLIC allow over the remote v4 team.resolveControl wire (closed success envelope, host-derived HUMAN decider)',
      resultError(resA.body) === null && dataA?.decision?.requestId === row1.payload.requestId && dataA?.decision?.decision === 'allow' && dataA?.decision?.decider?.kind === 'human',
      `status=${resA.status} data=${jstr(dataA, 500)}`)
    // Root 15:27 (post-r17, no new run authorized): HTTP 200 on the resolve
    // wire is NOT an approval. When the DURABLE decision answers this row
    // TERMINALLY with anything other than 'allow' (r17: an allow REQUEST
    // answered decision=deny), no consumption can ever arrive and no
    // append/model-visible step can follow — stop this criterion NOW and go
    // straight to the first-failure teardown instead of waiting out the
    // 90s ledger wait, the 120s append wait and the model-visible wait for
    // an impossible fact. r17's raw (which waited them out in full, ~6m31s
    // after the first failing judgement) is evidence and is NOT rewritten.
    const terminalA = resultError(resA.body) === null
      && dataA?.decision?.requestId === row1.payload.requestId
      && dataA?.decision?.decision !== 'allow'
    if (terminalA) {
      log(`C3: TERMINAL durable decision ${jstr(dataA?.decision?.decision, 40)} (reason=${jstr(dataA?.decision?.reason ?? null, 120)}) answered on requestId ${row1.payload.requestId} — HTTP ${resA.status} is NOT approval; deliberately NOT running the consumption/append/model-visible waits (root 15:27); stopping now`)
      writeFileSync(join(RUN_DIR, 'control-consumption-evidence.json'), JSON.stringify({
        requestId: row1.payload.requestId,
        requestRow: row1,
        terminalDecisionFromWire: dataA?.decision ?? null,
        note: 'terminal guard (root 15:27): non-allow durable decision observed on the allow leg; consumption/append/model-visible waits deliberately NOT run — this file is the wire raw of that stop',
      }, null, 2))
      finishCriterion('C3')
    }
    const consumed = await waitForLedgerFact(host, 'control-allow-consumed', row1.payload.requestId, 90_000, 'C3 consumption fact')
    const ledA = await remoteControlFacts(host)
    const fileCrossA = readLedger()
    // EVIDENCE LAW artifact (root ruling 3): the CONTROL consumption evidence
    // — the durable ledger facts for row 1 (remote wire + durable-file
    // cross-check), captured separately from the PA-edge witness.
    writeFileSync(join(RUN_DIR, 'control-consumption-evidence.json'), JSON.stringify({
      requestId: row1.payload.requestId,
      requestRow: row1,
      wire: {
        decisions: ledA['control-decision-recorded'].filter((f) => f.payload.requestId === row1.payload.requestId),
        consumptions: ledA['control-allow-consumed'].filter((f) => f.payload.requestId === row1.payload.requestId),
      },
      durableFileCrossCheck: {
        decisions: fileCrossA.decisions.filter((f) => f.payload.requestId === row1.payload.requestId),
        consumptions: fileCrossA.consumptions.filter((f) => f.payload.requestId === row1.payload.requestId),
      },
    }, null, 2))
    check('C3', 'exactly ONE control-allow-consumed durable fact for that requestId',
      consumed !== null && ledA['control-allow-consumed'].filter((f) => f.payload.requestId === row1.payload.requestId).length === 1,
      `consumptions=${jstr(ledA['control-allow-consumed'].filter((f) => f.payload.requestId === row1.payload.requestId), 400)}`)
    // wait for the effect to surface (todo: session append; write: file bytes)
    const appendDeadline = Date.now() + 120_000
    if (FIXTURE === 'write') {
      for (;;) {
        if (wfState().sha === WF_TGT_SHA) break
        if (Date.now() >= appendDeadline) break
        await new Promise((r) => setTimeout(r, 1000))
      }
    } else {
      for (;;) {
        memberLog = readMemberTodoLog(childSid)
        if (memberLog.rows.length >= 1) break
        if (Date.now() >= appendDeadline) break
        await new Promise((r) => setTimeout(r, 1000))
      }
    }
    if (FIXTURE === 'write') {
      const nowB = readFileSync(WF_ABS)
      check('C3', 'the fixture file bytes equal the model-submitted TARGET content EXACTLY (one correct content write)',
        nowB.equals(Buffer.from(WF_TGT)), `sha=${wfState().sha} size=${nowB.length} expected sha=${WF_TGT_SHA} size=${Buffer.byteLength(WF_TGT)} actual-head=${JSON.stringify(nowB.subarray(0, 80).toString('utf8'))}`)
      let fxPrev = {}
      try { fxPrev = JSON.parse(readFileSync(join(RUN_DIR, 'fixture-evidence.json'), 'utf8')) } catch { /* keep */ }
      writeFileSync(join(RUN_DIR, 'fixture-evidence.json'), JSON.stringify({ ...fxPrev, afterAllow: { bytes: nowB.toString('utf8'), sha256: wfState().sha, size: nowB.length } }, null, 2))
    } else if (FIXTURE === 'image') {
      let imgPair = null
      let imgReq = null
      await waitForMock(mock, (r) => {
        const pair = imageVisiblePair(r.body?.messages ?? [])
        if (pair !== null) { imgPair = pair; imgReq = r }
        return pair !== null
      }, 180_000, 'C3 model-visible image result (native two-block envelope with the ORIGINAL-frame clause)')
      if (imgPair === null) {
        check('C3', 'the allowed read_image surfaced to the model: callId-paired tool_result text carries <type>image</type> + "downscaled from 2048x1536 px" (the model-visible text names the ORIGINAL frame)', false, 'no model-visible image tool_result observed')
        finishCriterion('C3')
      }
      const bodyStr = JSON.stringify(imgReq?.body ?? {})
      const wireForm = bodyStr.includes('image_url') ? 'openai image_url' : bodyStr.includes('"type":"image"') ? 'anthropic image block' : bodyStr.includes('data:image') ? 'data-url' : null
      const afterAllowStore = storeCensus()
      const added = afterAllowStore.filter((o) => !storeBaseline.some((b) => b.rel === o.rel))
      const objRel = added.length === 1 ? added[0].rel : null
      const objAbs = objRel === null ? null : join(HOME, 'attachments', 'v1', 'objects', objRel)
      const objBytes = objAbs === null ? null : readFileSync(objAbs)
      const objSha = objBytes === null ? null : createHash('sha256').update(objBytes).digest('hex')
      const nameSha = objRel === null ? null : objRel.split('/').pop()
      const b64InBody = objBytes === null ? false : bodyStr.includes(objBytes.toString('base64'))
      allowStoreRel = objRel
      check('C3', 'the NORMALIZED raster is real and identity-bound (root 14:57 真实normalized ref): exactly ONE new attachment-store object; file-name sha256 == stored-bytes sha256 (store law); the model-visible request carries an image part whose base64 is EXACTLY those stored bytes (the model sees the normalized object, not the source)',
        wireForm !== null && added.length === 1 && objSha !== null && objSha === nameSha && b64InBody,
        `wireForm=${wireForm} added=${jstr(added, 400)} nameSha=${nameSha} objSha=${objSha} objSize=${objBytes?.length ?? -1} b64IdentityInModelRequest=${b64InBody}`)
      check('C3', 'the model-visible text carries BOTH frames (模型text原尺寸): normalized "1024x768 px" AND original clause "downscaled from 2048x1536 px" (store receipt originalDimensions rides the envelope verbatim)',
        imgPair.text.includes(`${IMG_NORM_W}x${IMG_NORM_H} px`) && imgPair.text.includes(`downscaled from ${IMG_W}x${IMG_H} px`) && imgPair.text.includes('<type>image</type>'),
        `callId=${imgPair.callId} text=${jstr(imgPair.text, 600)}`)
      let fxPrevI = {}
      try { fxPrevI = JSON.parse(readFileSync(join(RUN_DIR, 'fixture-evidence.json'), 'utf8')) } catch { /* keep */ }
      writeFileSync(join(RUN_DIR, 'fixture-evidence.json'), JSON.stringify({ ...fxPrevI, afterAllow: { storeCensus: afterAllowStore, addedObject: objRel, objectSha256: objSha, objectSize: objBytes?.length ?? -1, selfConsistent: objSha === nameSha, wireForm, b64IdentityInModelRequest: b64InBody, modelVisibleText: imgPair.text, modelVisibleCallId: imgPair.callId } }, null, 2))
    } else {
      const row1todos = memberLog.rows.length > 0 ? (memberLog.rows[0].data?.todos ?? memberLog.rows[0].payload?.todos ?? memberLog.rows[0].todos ?? null) : null
      check('C3', 'EXACTLY ONE todo/write entry in the member session log',
        memberLog.rows.length === 1, `rows=${memberLog.rows.length} files=${memberLog.files.join(', ')}`)
      check('C3', 'the appended todos list equals the model-submitted list FIELD-FOR-FIELD',
        row1todos !== null && JSON.stringify(row1todos) === JSON.stringify(LIST1),
        `appended=${jstr(row1todos, 600)} submitted=${jstr(LIST1, 600)}`)
    }
    // EVIDENCE LAW artifact (root ruling 3): the native append proof = the
    // ACTUAL session record bytes read back from the world storage file.
    writeFileSync(join(RUN_DIR, 'native-append-evidence.json'), JSON.stringify({
      sessionFiles: memberLog.files,
      todoWriteRows: memberLog.rows,
      submitted: LIST1,
    }, null, 2))
    finishCriterion('C3')
    const leg2Start = FIXTURE === 'write' ? wfState() : null

    // C4: second call (fresh exec token) -> public DENY -> zero append
    const row2 = await waitForTodoRow(host, (p) => FIXTURE === 'image' ? (p.toolName === 'read_image' && p.requestId !== row1.payload.requestId) : FIXTURE === 'write' ? (p.toolName === 'write' && p.requestId !== row1.payload.requestId) : (p.toolName === 'todo_write' && p.requestId !== row1.payload.requestId && TODO_CORR_RE().test(String(p.correlation ?? ''))), 180_000, `C4 second ${ROW_TOOL} row`)
    if (row2 === null) {
      check('C4', 'a second governed row appeared for the second call', false, jstr(readLedger().recorded.map((f) => ({ rid: f.payload.requestId, corr: f.payload.correlation })), 1200))
      finishCriterion('C4')
    }
    if (FIXTURE === 'write' && (row2.payload.reviewPayload ?? {}).parametersFingerprint === (row1.payload.reviewPayload ?? {}).parametersFingerprint) {
      check('C4', 'the second row parametersFingerprint DIFFERS from the first (content-bound plan: WF_DENY payload never reuses the allowed plan grant)', false, `fp1=${(row1.payload.reviewPayload ?? {}).parametersFingerprint} fp2=${(row2.payload.reviewPayload ?? {}).parametersFingerprint}`)
      finishCriterion('C4')
    }
    const resD = await remoteCallReady(host, 'team.resolveControl', { teamSessionId: ROOT_P, requestId: row2.payload.requestId, decision: 'deny', note: 'a5m2c2 C4 public deny' }, 'res-c4', 4)
    check('C4', 'PUBLIC deny over the remote v4 wire (decision=deny durable)',
      resultError(resD.body) === null && resultData(resD.body)?.decision?.decision === 'deny',
      `status=${resD.status} data=${jstr(resultData(resD.body), 400)}`)
    const denyFact = await waitForLedgerFact(host, 'control-decision-recorded', row2.payload.requestId, 60_000, 'C4 deny decision fact')
    const refusalPair = (FIXTURE === 'write' || FIXTURE === 'image')
      ? null
      : await waitForMock(mock, (r) => {
          const msgs = r.body?.messages ?? []
          return msgs.some((m) => ['tool', 'user'].includes(m?.role ?? '') && toolResultText(m?.content ?? '').includes(REFUSAL_MARK))
        }, 180_000, 'C4 member-visible refusal (refusal marker in tool result)')
    let denialSeen = refusalPair !== null ? { text: '(todo-marker leg)', callId: 'n/a' } : null
    if ((FIXTURE === 'write' || FIXTURE === 'image') && denialSeen === null) {
      const hit = await waitForMock(mock, (r) => {
        const want = FIXTURE === 'image' ? { tool: 'read_image', file: IMG_REL } : { tool: 'write', content: WF_DENY }
        const pair = denialPairSeen(r.body?.messages ?? [], want, (t) => t.includes('APPROVAL_DENIED') && t.includes(`durable Control request ${row2.payload.requestId} answered deny`))
        if (pair !== null) denialSeen = pair
        return pair !== null
      }, 180_000, 'C4 member-visible denial (callId-paired is_error tool_result bound to row2 requestId)')
      void hit
    }
    memberLog = readMemberTodoLog(childSid)
    const ledB = await remoteControlFacts(host)
    check('C4', FIXTURE === 'image'
      ? 'the denial surfaced to the member as a tool result for THIS call: callId-paired tool_use(read_image, source PNG)->tool_result is_error=true, text carries APPROVAL_DENIED + the exact row2 requestId "answered deny" (structural protocol; no fuzzy word)'
      : FIXTURE === 'write'
        ? 'the denial surfaced to the member as a tool result for THIS call: callId-paired tool_use(WF_DENY)->tool_result is_error=true, text carries APPROVAL_DENIED + the exact row2 requestId "answered deny" (root 14:29 protocol; no fuzzy prefix word)'
        : 'the refusal surfaced to the member (tool result carries refused-todo)',
      (FIXTURE === 'write' || FIXTURE === 'image') ? denialSeen !== null : refusalPair !== null,
      (FIXTURE === 'write' || FIXTURE === 'image')
        ? (denialSeen === null ? 'no callId-paired is_error tool_result bound to row2 requestId observed' : `callId=${denialSeen.callId} text=${jstr(denialSeen.text, 400)}`)
        : (refusalPair !== null ? 'refusal observed in model-visible tool result' : 'no tool result with refused-todo observed'))
    check('C4', 'ZERO effect for the denied call (session append / fixture bytes unchanged vs leg start), zero consumptions for row 2',
      (FIXTURE === 'image' ? (storeCensus().length === storeBaseline.length + 1 && storeCensus().some((o) => o.rel === allowStoreRel))
        : FIXTURE === 'write' ? (leg2Start.sha === WF_TGT_SHA && wfState().sha === leg2Start.sha && wfState().size === leg2Start.size)
        : memberLog.rows.length === 1)
      && ledB['control-allow-consumed'].filter((f) => f.payload.requestId === row2.payload.requestId).length === 0
      && denyFact !== null,
      `fixture=${FIXTURE === 'image' ? `store=${storeCensus().length}(baseline ${storeBaseline.length}+allow-leg 1; only-leg=${storeCensus().every((o) => o.rel === allowStoreRel)}` : FIXTURE === 'write' ? JSON.stringify(wfState()) : 'n/a'} rows=${memberLog.rows.length} row2consumptions=${ledB['control-allow-consumed'].filter((f) => f.payload.requestId === row2.payload.requestId).length} denyFact=${denyFact !== null}`)
    finishCriterion('C4')
    if ((await waitForMock(mock, (r) => r.reply?.content === DONE_WORK1, 120_000, 'WORK1 turn done')) === null) log('WARN: WORK1 turn did not reach DONE (criterion checks above already captured)')

    // C5: third call pending -> abandon via the EXISTING p6t6 fixture
    const p3 = await apiPrompt(host.origin, host.cookie, ROOT_P, `${MK_W3L} Delegate task W3 to w1 asynchronously.`, 'c5')
    if (!(p3.status === 200 && p3.body?.result?.ok === true)) await dieFatal(`C5 delegate prompt not admitted: ${p3.status}`)
    const row3 = await waitForTodoRow(host, (p) => FIXTURE === 'image' ? (p.toolName === 'read_image' && ![row1.payload.requestId, row2.payload.requestId].includes(p.requestId)) : FIXTURE === 'write' ? (p.toolName === 'write' && ![row1.payload.requestId, row2.payload.requestId].includes(p.requestId)) : (p.toolName === 'todo_write' && ![row1.payload.requestId, row2.payload.requestId].includes(p.requestId) && TODO_CORR_RE().test(String(p.correlation ?? ''))), 180_000, 'C5 third row (pending)')
    const leg3Start = FIXTURE === 'write' ? wfState() : null
    if (row3 !== null && FIXTURE === 'write' && [(row1.payload.reviewPayload ?? {}).parametersFingerprint, (row2.payload.reviewPayload ?? {}).parametersFingerprint].includes((row3.payload.reviewPayload ?? {}).parametersFingerprint)) {
      check('C5', 'the third row parametersFingerprint DIFFERS from rows 1-2 (WF_CANCEL payload bound to its own plan)', false, `fp3=${(row3.payload.reviewPayload ?? {}).parametersFingerprint}`)
      finishCriterion('C5')
    }
    if (row3 === null) {
      check('C5', 'a third governed row appeared (pending) to exercise the existing abandon fixture', false, 'no third row')
      finishCriterion('C5')
    }
    const ab = await p6t6Control(HOST_PORT, { action: 'abandon', rootSessionId: ROOT_P, requestId: row3.payload.requestId, reason: 'a5m2c2-c5 cancel-via-existing-fixture' })
    check('C5', 'cancel via the EXISTING p6t6 abandon fixture (production abandonControlRequest authority) answered ok',
      ab.status === 200 && ab.body?.ok === true && ab.body?.value?.requestId === row3.payload.requestId,
      `status=${ab.status} value=${jstr(ab.body?.value, 400)} err=${jstr(ab.body?.code ?? null, 120)}`)
    const abandonFact = await waitForLedgerFact(host, 'control-request-abandoned', row3.payload.requestId, 60_000, 'C5 abandon fact')
    let cancelSeen = null
    const refusal3 = await waitForMock(mock, (r) => {
      const msgs = r.body?.messages ?? []
      if (FIXTURE === 'write' || FIXTURE === 'image') {
        const wantC = FIXTURE === 'image' ? { tool: 'read_image', file: IMG_REL } : { tool: 'write', content: WF_CANCEL }
        const pair = denialPairSeen(msgs, wantC, (t) => t.includes(row3.payload.requestId) && /answered (?:abandoned|unsettled)|APPROVAL_NOT_RESOLVED|PA walk|PA edge|cancelled/i.test(t))
        if (pair !== null) cancelSeen = pair
        return pair !== null
      }
      return msgs.filter((m) => toolResultText(m?.content ?? '').includes(REFUSAL_MARK)).length >= 2
    }, 180_000, (FIXTURE === 'write' || FIXTURE === 'image') ? 'C5 member-visible cancel settle (callId-paired is_error tool_result bound to row3 requestId)' : 'C5 member-visible refusal for row 3')
    memberLog = readMemberTodoLog(childSid)
    const ledC = await remoteControlFacts(host)
    const fileCrossC = readLedger()
    check('C5', 'exactly ONE durable abandon fact for row 3, ZERO consumptions, and the fixture/session effect UNCHANGED vs leg-3 start bytes',
      ledC['control-request-abandoned'].filter((f) => f.payload.requestId === row3.payload.requestId).length === 1
      && ledC['control-allow-consumed'].filter((f) => f.payload.requestId === row3.payload.requestId).length === 0
      && (FIXTURE === 'image' ? (storeCensus().length === storeBaseline.length + 1 && storeCensus().every((o) => o.rel === allowStoreRel))
        : FIXTURE === 'write' ? (leg3Start.sha === WF_TGT_SHA && wfState().sha === leg3Start.sha && wfState().size === leg3Start.size)
        : memberLog.rows.length === 1) && abandonFact !== null,
      `fixture=${FIXTURE === 'write' ? JSON.stringify(wfState()) : 'n/a'} abandonFacts=${ledC['control-request-abandoned'].filter((f) => f.payload.requestId === row3.payload.requestId).length} consumptions=${ledC['control-allow-consumed'].filter((f) => f.payload.requestId === row3.payload.requestId).length} rows=${memberLog.rows.length} durableFileAbandonFacts=${fileCrossC.abandonments.filter((f) => f.payload.requestId === row3.payload.requestId).length}`)
    check('C5', FIXTURE === 'image'
      ? 'the abandoned call surfaced its settle to the member as a tool result for THIS call: callId-paired tool_use(read_image, source PNG)->tool_result is_error=true bound to the exact row3 requestId with the arm-settle protocol wording (abandon via p6t6 abandonControlRequest authority — NOT nativeAbort; layered separately from the durable abandon fact)'
      : FIXTURE === 'write'
        ? 'the abandoned call surfaced its settle to the member as a tool result for THIS call: callId-paired tool_use(WF_CANCEL)->tool_result is_error=true bound to the exact row3 requestId with the arm-settle protocol wording (abandon via p6t6 abandonControlRequest authority — NOT nativeAbort; layered separately from the durable abandon fact)'
        : 'the cancelled call surfaced a refusal to the member (second refused-todo tool result)',
      (FIXTURE === 'write' || FIXTURE === 'image') ? cancelSeen !== null : refusal3 !== null,
      (FIXTURE === 'write' || FIXTURE === 'image')
        ? (cancelSeen === null ? 'no callId-paired is_error tool_result bound to row3 requestId observed' : `callId=${cancelSeen.callId} text=${jstr(cancelSeen.text, 400)}`)
        : (refusal3 !== null ? 'observed' : 'no second refused-todo observed'))
    finishCriterion('C5')

    // ── H1 / H2 ────────────────────────────────────────────────────────────
    await stopHost(host)
    host = null
    mkdirSync(join(RUN_DIR, 'git-post'), { recursive: true })
    const testUsePost = await captureGitState(TESTUSE, join(RUN_DIR, 'git-post'))
    writeFileSync(join(RUN_DIR, 'testuse-post.json'), JSON.stringify(testUsePost, null, 2))
    check('H1', 'test-use repo HEAD == baseline 639ed01539… + porcelain EMPTY before AND after (the run never wrote to the host source tree); :3080 zero-touch BY CONSTRUCTION (no request was ever sent to :3080)',
      testUsePre.head === HOST_BASELINE_SHA && testUsePre.statusEmpty === true && testUsePost.head === HOST_BASELINE_SHA && testUsePost.statusEmpty === true,
      `pre head=${testUsePre.head} empty=${testUsePre.statusEmpty}; post head=${testUsePost.head} empty=${testUsePost.statusEmpty}`)
    finishCriterion('H1')

    const hostFree = await waitForPortFree(HOST_PORT, 15_000)
    await mock.close()
    const mockFree = await waitForPortFree(MOCK_PORT, 15_000)
    await new Promise((r) => setTimeout(r, 2000))
    const survivors = survivingPids(HOST_PORT)
    writeFileSync(join(RUN_DIR, 'ps-proof.json'), JSON.stringify({ hostPort: HOST_PORT, hostFree, mockPort: MOCK_PORT, mockFree, survivingHostPids: survivors }, null, 2))
    check('H2', 'all ports released and NO surviving host/mock process (/proc scan empty)',
      hostFree === true && mockFree === true && survivors.length === 0,
      `hostFree=${hostFree} mockFree=${mockFree} survivors=${JSON.stringify(survivors)}`)
    finishCriterion('H2')
  } catch (error) {
    if (error instanceof FirstFailureStop) {
      await dieFatal(error.message, true)
    }
    await dieFatal(`unhandled: ${String(error?.message ?? error)}\nhost tail:\n${host !== null ? logTail(host.logPath, 30) : '<no host>'}`)
  } finally {
    await sweepLiveHosts().catch(() => { /* best-effort */ })
    try { await mock.close() } catch { /* already */ }
    try {
      for (const h of EVID.hostLogs) {
        try { writeFileSync(join(RUN_DIR, `host-${h.phase}-port${h.port}.log`), readFileSync(h.logPath, 'utf8')) } catch { /* gone */ }
      }
      writeFileSync(join(RUN_DIR, 'mock.log'), mock.requestLogText?.() ?? JSON.stringify(mock.requests, null, 2))
    } catch { /* best-effort */ }
    try { writeFileSync(join(RUN_DIR, 'api-transcript.json'), JSON.stringify(TRANSCRIPT, null, 2)) } catch { /* best-effort */ }
    if (FIXTURE === 'write') {
      try {
        let fxPrevF = {}
        try { fxPrevF = JSON.parse(readFileSync(join(RUN_DIR, 'fixture-evidence.json'), 'utf8')) } catch { /* keep */ }
        const fb = readFileSync(WF_ABS)
        writeFileSync(join(RUN_DIR, 'fixture-evidence.json'), JSON.stringify({ ...fxPrevF, finalBytesRetained: true, final: { bytes: fb.toString('utf8'), sha256: wfState().sha, size: fb.length }, expectedFinalSha: WF_TGT_SHA }, null, 2))
      } catch { /* best-effort */ }
    }
    dumpSessionLogs('final')
    dumpPaEdgeEvidence()
    scrubDir(RUN_DIR)
    const criteria = Object.values(results)
    const pass = criteria.every((c) => c.pass === true)
    writeFileSync(join(RUN_DIR, 'summary.json'), JSON.stringify({
      kit: 'a5m2-todo-c2', stamp: RUN_STAMP, world: HOME, worldRetained: true, fixture: FIXTURE, ...(FIXTURE === 'write' ? { writeFixture: WF_REL, expectedFinalSha: WF_TGT_SHA } : {}),
      install: INSTALL, pinnedPlugin: P6T6_PLUGIN_PATH,
      worktree: WORKTREE, hostTree: TESTUSE, baseline: HOST_BASELINE_SHA, clientCommit: CLIENT_COMMIT_HASH,
      realm: REALM, ports: { host: HOST_PORT, mock: MOCK_PORT },
      criteria, pass, exitCode: pass ? 0 : 2,
    }, null, 2))
    log(`RESULT: ${pass ? 'PASS' : 'FAIL'} — evidence ${RUN_DIR}`)
    if (!pass) process.exitCode = 2
  }
}

// ENTRY-SAFETY LAW: main() runs ONLY when this file is the direct entry.
// Importing the module must never execute the run (2026-10-23 incident class).
if (ENTRY_DIRECT) {
  main().catch((error) => {
    console.error(`a5m2-todo-c2: uncaught ${String(error?.stack ?? error)}`)
    process.exitCode = 1
  })
} else {
  console.error('a5m2-todo-c2: imported as a module — main() NOT executed (entry-safety law); no world, no writes, no mounts.')
}
