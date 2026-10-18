#!/usr/bin/env node
/**
 * a5ie-r5-kit.mjs — PTC + CANCEL FAMILY, ON THE REAL INSTALLED FACE. (PREPARED, NOT RUN.)
 *
 * r4-b2 (a5ie-r4-b2) closed the B2 book on the installed face: the kernel-refused
 * shell leg inverts from `bash · exit=0` (the r3 verbatim record) to `bash ·
 * exit=1`. r5 extends that face to the two channels that landed after it:
 *
 *   #334  PTC fs half-arm production row — one-shot grant adjudication on the
 *         approval waterfall. Its shipped face is the 9th place-dist-glue
 *         placement: `live/ptc-escalation-row.mjs` (isAdmissible adjudicator).
 *   #340  race-aware shell settle — user cancel is cancelled, launch death stays
 *         cancelled:false. Its shipped bytes carry `raceShellSettle` /
 *         `shellCancelled` and give the shell row a REAL path to
 *         `bash · cancelled` (pre-#340 that branch had no path through the row).
 *
 * PREP STATE (this file, at branch time): master = b6d7c48a (#334 IS in;
 * `isAdmissible` measured ×3 in src and the dist mirror). #340 is NOT yet on
 * master (measured: 0 hits for its tokens). This kit is therefore PREPARED AND
 * NOT RUN: it will be run when the merge order lands with BOTH PRs on master,
 * and the spec says the install spec is re-derived LIVE at run time
 * (`git ls-remote origin refs/heads/master` inside the kit — never from docs),
 * so the kit does not need re-authoring as master advances. If master at run
 * time still lacks #340, `H1c`/`I12` fail loudly — that IS the honest report.
 *
 * WHAT IS CLAIMED, AND ONLY WHAT IS MEASURED
 *  H  pins: LIVE ls-remote = install spec; the merged worktree CARRIES it;
 *     NEW H1c: the install SHA's OWN subject lineage contains #334 and #340
 *     (the two PRs this round grades); pristine host porcelain 0; ports;
 *     :3080 read-only before/after.
 *  I  the real network install into a NEW dir (strict face, THREE ZEROS +
 *     rootSha, drift gate, --dump-config, deployment blob carries
 *     --exit-passthrough and answers ABI) — plus:
 *       I11 NEW: the durable oracle IS SHIPPED — ptc-escalation-row.mjs is in
 *            the installed manifest and its installed bytes carry isAdmissible.
 *       I12 NEW: the cancel channel IS SHIPPED — raceShellSettle and
 *            shellCancelled appear in the INSTALLED bytes under plugin/live
 *            (which files carry them is reported, placement is not assumed).
 *       I10  constancy: #336's shell-arm flag still on the installed bytes.
 *  W  every live world re-installs byte-identical to the probe face.
 *  A/X the r4-b2 shell set again on the new bytes (regression is a claim too):
 *     A7 stays `bash · exit=1` (B2X grades the r3→r4→r5 history file), X1 true
 *     → exit=0, X2 exit 7 → exit=7, A6 confined positive write, X4s/X4g the
 *     glob/search rows keep their stream-completion law (no exit=/exitCode),
 *     A9 the provider's own per-leg witnesses.
 *  C  NEW, the cancel family end-to-end on the installed face (this is what
 *     #340 was for):
 *       C1  USER CANCEL mid-flight: member A runs `sleep 90`; the kit fires the
 *            host's public `session/cancel` RPC (SessionCancelRequest
 *            {sessionId}, the same client-request seam the prompt uses) against
 *            the MEMBER session — resolved from the observer row's agents list,
 *            no private API — then RESUME-nudges the member. The cancelled leg's
 *            landing must read `bash · cancelled` with meta `"cancelled":true`.
 *            The cancel attempt itself (HTTP status/body/timing) is its own
 *            receipt in cancel-leg.json.
 *       C2  LAUNCH DEATH STAYS DEATH: member A runs `kill -9 $$` — a payload
 *            killed by SIGKILL (no cancel involved). The row must report the
 *            death form (`bash · exit=137`, the launcher's waitpid mapping
 *            #336 shipped) with meta `"cancelled":false`. #338's honesty holds:
 *            128+signum names no cause of death; this leg claims the SHAPE,
 *            not a diagnosis.
 *       C3  GLOB WALKER REGRESSION: the race settle is NOT mounted on the glob
 *            row (收流未装 = the current face). A normal nested walk must still
 *            answer with its entries and grow NO refusal, NO cancelled, NO
 *             exit= — a baseline that catches a future mis-mount.
 *  Z  zero expansion (non-team Δ=[]), no IO_POLICY on any leg, no bootstrap
 *     errors, plane reached the member wire.
 *  T  teardown (renamed from C* to free C1–C3 for the cancel family): worlds
 *     swept, token hygiene, ports released.
 *
 * LEG LEDGER: every criterion is also written as one JSON line to
 * runs/<stamp>/leg-ledger.jsonl — {leg, verdict, receipts[], wire} — the
 * checklist template `LEG-LEDGER-TEMPLATE.md` documents the row shape;
 * KIT_EXIT semantics are unchanged (0 GREEN · 2 RED · 1 fatal; booked =
 * verdict BOOK = pass:null, never counted either way).
 *
 * DISCLOSED PREP RISKS (decided by the REAL bytes at run time, not by me now):
 *  R1  If #340's cancel settles the row but the agent loop is torn down so the
 *      cancelled tool_result never rides a LATER model request, the wire read
 *      point loses C1's landing; the fallback read point is the session's own
 *      persisted event stream (host session API), decided at run time from the
 *      observed behavior. The kit reports which read point graded C1.
 *  R2  After the user cancel the member needs a turn to continue; this kit
 *      RESUME-nudges once (a queue-mode prompt on the member session — the
 *      shape of a human typing "continue" after pressing stop). If #340's
 *      cancel leaves the member un-nudgeable, C1's landing is graded from the
 *      interrupted turn's own request and the nudge receipt is booked.
 *  R3  The 137 for C2 is #336's shipped mapping; if the merged bytes changed
 *      the death mapping, C2 goes RED with the landing quoted — report, no fix.
 *
 * @module evidence/alpha5/a5ie-r5/a5ie-r5-kit
 */
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createServer as netServer } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { startMockModel } from '../../../../../packages/tools/harness/mock-deepseek.mjs'
import { presetDeclarationRow, smokePresetPlugins } from '../../../../../tests/kits/_shared/preset-seam.mjs'
import { CLIENT_COMMIT_HASH, TEST_USE_BASELINE_SHA, testUseTree, homeDir } from '../../../../../tests/paths.mjs'

const args = process.argv.slice(2)
const argValue = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1] }
const KEEP = args.includes('--keep')
const HERE = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(argValue('worktree', resolve(HERE, '..', '..', '..', '..', '..')))
const RUN_STAMP = new Date().toISOString().slice(0, 19).replace(/:/g, '-') + 'Z'
const EVIDENCE_DIR = resolve(argValue('evidence-dir', join(HERE, 'runs', RUN_STAMP)))
mkdirSync(EVIDENCE_DIR, { recursive: true })

const HOST_PORT = Number(argValue('port', 3183))
const BASELINE_PORT = Number(argValue('baseline-port', 3184))

// The install spec is measured LIVE inside this kit (never quoted from docs).
const REMOTE_MASTER = (() => {
  const r = spawnSync('git', ['-C', WORKTREE, 'ls-remote', 'origin', 'refs/heads/master'], { encoding: 'utf8', timeout: 180_000 })
  const sha = String(r.stdout ?? '').trim().split(/\s/)[0] ?? ''
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`git ls-remote origin refs/heads/master did not answer a SHA: ${String(r.stdout ?? '').slice(0, 80)}`)
  return sha
})()
const INSTALL_SHA = REMOTE_MASTER
const INSTALL_SPEC = `github:ArmourPiercer1/dsh-agent-team#${INSTALL_SHA}`
const STORE_DIR = resolve(argValue('store-dir', join(WORKTREE, '..', '..', '.pnpm-store-a5ie-r5')))
const TESTUSE = resolve(argValue('testuse', '') !== '' ? resolve(argValue('testuse', '')) : testUseTree(WORKTREE))
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const OBSERVER_ROW_NAME = pathToFileURL(join(HERE, '..', 'install-entry', 'a5ie-observer-row.mjs')).href
const WORLD_PREFIX = 'a5ie-r5'
const PRESET_ID = 'a5ie-r5-base'
const MODES = ['installed', 'baseline']
const PRESETS = ['standard']
const ALIASES = ['team_grep', 'team_glob', 'team_bash']
const WATCH_NAMES = [...ALIASES, 'read']
const MANAGED_TOOL_NAMES = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh']
const SAFE_UNMANAGED_TOOL_NAMES = ['todo_write']
const ROOT = 'a5ie-r5-root'
const CREATE_ROOT = `session-a5ie-r5-team-${RUN_STAMP}`
const BP_MAIN_ID = 'a5ie-r5-main-bp'
const BP_ANCHOR_ID = 'a5ie-r5-anchor-bp'
const TK_A1 = 'a5ie-r5-tok-a1'

const TOK_GREP = 'A5IE-R5-GREP-TOK'
const OUTSIDE_MARKER = 'A5IE-R5-OUTSIDE-ONLY-MARKER-9182'
const TOK_BASH = 'A5IE-R5-BASH-TOK'
const BASH_WRITE_MARKER = 'A5IE-R5-WROTE-9'
const GPOS_SEEDS = ['alpha.txt', 'beta.txt']
const GDEEP_SEEDS = ['x.txt', 'a/b/deep.txt']

const IO_TEXT = 'IO_POLICY_UNSUPPORTED'

// The member's one-tool-per-turn ladder. It is CONTENT-KEYED (each planned
// call is identified by the exact `tool_use:<name><arguments>` substring the
// digest sees in history), NOT positional: #340's cancel may interrupt a turn,
// and a positional counter would re-issue completed legs after the RESUME
// nudge. If a cancelled step vanishes from history entirely, its marker is
// absent and the call is re-issued once — disclosed as R1/R2, the cancel
// timer is single-shot so a re-issued sleep runs uncancelled and C1 reads RED
// with the scene quoted rather than silently passing.
const STEP_BASH = (command) => ['team_bash', { command }]
const STEPS = [
  STEP_BASH('true'),
  STEP_BASH('exit 7'),
  STEP_BASH(`echo ${TOK_BASH}; echo ${BASH_WRITE_MARKER} > ./bash-wrote.txt; cat ./bash-wrote.txt`),
  STEP_BASH('cat ../outside/secret.txt'),
  ['team_grep', { pattern: TOK_GREP, path: '.', output_mode: 'content' }],
  ['team_glob', { pattern: '*.txt', path: './gpos' }],
  STEP_BASH('sleep 90'),
  STEP_BASH('kill -9 $$'),
  ['team_glob', { pattern: '*', path: './gdeep' }],
]
const stepMarker = ([name, a]) => `tool_use:${name}${JSON.stringify(a)}`

const CRITERIA = []
function check (id, claim, cond, observed) {
  CRITERIA.push({ id, claim, pass: cond === true, observed })
  console.log(`${cond === true ? 'PASS' : 'FAIL'} ${id} — ${claim}${observed === undefined ? '' : ` [${observed}]`}`)
}
const note = (id, claim, observed) => { CRITERIA.push({ id, claim, pass: null, observed }); console.log(`BOOK ${id} — ${claim}${observed === undefined ? '' : ` [${observed}]`}`) }
const die = (msg) => { throw new Error(`FATAL: ${msg}`) }

function gitAt (dir, ...a) { return spawnSync('git', ['-C', dir, ...a], { encoding: 'utf8' }).stdout.trim() }

function portFree (port) {
  return new Promise((res) => {
    const srv = netServer()
    srv.once('error', () => res(false))
    srv.once('listening', () => { srv.close(() => res(true)) })
    srv.listen(port, '127.0.0.1')
  })
}
async function portFreeWait (port, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    if (await portFree(port)) return true
    if (Date.now() > deadline) return false
    await new Promise((r) => setTimeout(r, 500))
  }
}
async function waitQuiet (deadlineMs, fn) {
  const deadline = Date.now() + deadlineMs
  for (;;) {
    const v = await fn()
    if (v) return v
    if (Date.now() > deadline) return null
    await new Promise((r) => setTimeout(r, 400))
  }
}
async function waitFor (deadlineMs, fn, what) {
  const v = await waitQuiet(deadlineMs, fn)
  if (!v) die(`timeout waiting for: ${what}`)
  return v
}
async function waitQuietTolerant (deadlineMs, fn) { return await waitQuiet(deadlineMs, fn) ?? null }
const sha256File = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
const sha256Text = (s) => createHash('sha256').update(s).digest('hex')
function walkFiles (dir, base = dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walkFiles(p, base, out)
    else if (e.isFile()) out.push(p.slice(base.length + 1).split(/[\\/]/).join('/'))
  }
  return out
}
const stableProbe = async () => {
  try { const r = await fetch('http://127.0.0.1:3080/', { redirect: 'manual', signal: AbortSignal.timeout(5000) }); return r.status } catch { return 'unreachable' }
}
const hex8 = (s) => createHash('sha256').update(s).digest('hex').slice(0, 8)
const REDACTIONS = [
  [/(https?:\/\/[^\s"'`]+?\?token=)([A-Za-z0-9_-]{8,})/g, (_m, head, tok) => head + `<REDACTED-${hex8(tok)}>`],
  [/\b(token|api_key|apikey|access_token)=["']?[A-Za-z0-9_\-.=]{8,}/gi, (m0) => m0.split('=')[0] + '=<REDACTED>'],
  [/dsh-auth-[A-Za-z0-9_-]{6,}/g, 'dsh-auth-<REDACTED>'],
  [/\bBearer\s+[A-Za-z0-9._-]{6,}/gi, 'Bearer <REDACTED>'],
]
const redact = (text) => REDACTIONS.reduce((t, [re, r]) => t.replace(re, r), text)
function writeEvidence (name, value) {
  writeFileSync(join(EVIDENCE_DIR, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n')
}
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/
async function fetchJson (url, init, timeoutMs = 30_000) {
  const res = await fetch(url, { ...(init ?? {}), signal: AbortSignal.timeout(timeoutMs) })
  const text = await res.text()
  try { return { status: res.status, body: JSON.parse(text) } } catch { return { status: res.status, body: text } }
}

// ═════════════════════════ INSTALL-FACE MEASUREMENT (declared files: face) ═══
function declaredFace (srcWorktree, sha) {
  const pkg = JSON.parse(spawnSync('git', ['-C', srcWorktree, 'show', `${sha}:package.json`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).stdout)
  const files = (pkg.files ?? []).map((f) => f.replace(/^\.\//, '').replace(/\/$/, ''))
  const ls = spawnSync('git', ['-C', srcWorktree, 'ls-tree', '-r', '--name-only', '-z', sha], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 })
  if (ls.status !== 0) die(`git ls-tree at ${sha} failed`)
  const tree = ls.stdout.split('\0').filter((s) => s !== '')
  const under = (p) => files.some((f) => p === f || p.startsWith(`${f}/`))
  const docish = (p) => !p.includes('/') && /^(readme|license|licence|changelog|changes|history|notice)(\..*)?$/i.test(p)
  const declared = tree.filter(under)
  const packAdditions = tree.filter((p) => !under(p) && (p === 'package.json' || docish(p)))
  return { files, declared, packAdditions, expected: [...declared, ...packAdditions] }
}
function materializeDeclaredFace (srcWorktree, sha, face) {
  const mirror = join(EVIDENCE_DIR, 'declared-face-mirror')
  mkdirSync(mirror, { recursive: true })
  const arch = spawnSync('git', ['-C', srcWorktree, 'archive', sha, '--', ...face.expected], { maxBuffer: 512 * 1024 * 1024 })
  if (arch.status !== 0) die(`git archive of the declared face failed: ${String(arch.stderr).slice(0, 200)}`)
  const tar = spawnSync('tar', ['-x', '-C', mirror], { input: arch.stdout })
  if (tar.status !== 0) die(`tar expand of the declared face failed: ${String(tar.stderr).slice(0, 200)}`)
  return mirror
}
function measureInstalledFace (installedDir, face, mirror) {
  if (!existsSync(installedDir)) die(`installed package directory missing: ${installedDir}`)
  const actual = walkFiles(installedDir)
  const expected = [...face.expected].sort()
  const setE = new Set(expected)
  const setA = new Set(actual)
  const missing = expected.filter((p) => !setA.has(p))
  const extra = actual.filter((p) => !setE.has(p))
  const shaMismatch = []
  const manifest = []
  for (const p of expected) {
    if (!setA.has(p)) continue
    const refPath = join(mirror, p)
    const want = existsSync(refPath) ? sha256File(refPath) : 'MISSING-IN-COMMIT-MIRROR'
    const have = sha256File(join(installedDir, p))
    manifest.push({ path: p, sha256: have })
    if (have !== want) shaMismatch.push({ path: p, installed: have, atCommit: want })
  }
  manifest.sort((x, y) => (x.path < y.path ? -1 : 1))
  return {
    expectedCount: expected.length,
    actualCount: actual.length,
    declaredCount: face.declared.length,
    packAdditions: face.packAdditions,
    missing, extra, shaMismatch,
    rootSha: sha256Text(manifest.map((x) => `${x.path} ${x.sha256}`).join('\n')),
    manifest,
  }
}

// ═════════════════════════════ THE REAL INSTALL (public package face) ════════
function profileWorkspaceYaml () {
  // pnpm 11 reads its settings from pnpm-workspace.yaml (NOT .npmrc); the
  // profile's own `storeDir:` keeps the store workspace-local (sandbox law;
  // recorded in the install-entry round).
  return `packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\nstoreDir: ${STORE_DIR}\n`
}
function realInstall ({ world, logName }) {
  const profileDir = join(world, 'profiles', 'web')
  mkdirSync(profileDir, { recursive: true })
  writeFileSync(join(profileDir, 'pnpm-workspace.yaml'), profileWorkspaceYaml())
  const t0 = Date.now()
  const r = spawnSync(process.execPath, [HOST_BIN, 'plugin', '--profile', 'web', 'add', INSTALL_SPEC], {
    cwd: join(world, 'workspace'), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 900_000,
    env: { ...process.env, DSH_HOME: world },
  })
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
  writeEvidence(logName, redact(`$ node ${HOST_BIN} plugin --profile web add ${INSTALL_SPEC}\n(cwd ${join(world, 'workspace')}, DSH_HOME=${world})\nexit=${String(r.status)} in ${String(Math.round((Date.now() - t0) / 1000))}s\n\n${out}`))
  const manifestPath = join(profileDir, 'package.json')
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null
  const nmDir = join(profileDir, 'node_modules')
  return {
    exit: r.status,
    seconds: Math.round((Date.now() - t0) / 1000),
    profileDir, manifest,
    nodeModulesTop: existsSync(nmDir) ? readdirSync(nmDir).filter((n) => !n.startsWith('.')).sort() : [],
    installedDir: join(profileDir, 'node_modules', 'dsh-agent-team'),
    outputTail: redact(out).split('\n').filter((l) => l.trim() !== '').slice(-8).join(' | ').slice(0, 600),
  }
}
function materializeLauncher (srcWorktree, sha, destPath) {
  const rel = 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py'
  const blob = spawnSync('git', ['-C', srcWorktree, 'show', `${sha}:${rel}`], { maxBuffer: 64 * 1024 * 1024 })
  if (blob.status !== 0) die(`git show of the launcher blob failed: ${String(blob.stderr).slice(0, 200)}`)
  mkdirSync(dirname(destPath), { recursive: true })
  writeFileSync(destPath, blob.stdout)
  const blobSha = sha256Text(blob.stdout)
  const worktreeSha = sha256File(join(srcWorktree, rel))
  return {
    rel, path: destPath, sha: blobSha, worktreeSha,
    bytesMatchCommitAndWorktree: blobSha === worktreeSha,
    isScript: blob.stdout.slice(0, 2).toString('utf8') === '#!',
    carriesExitPassthrough: blob.stdout.toString('utf8').includes('--exit-passthrough'),
    bytes: blob.stdout.length,
  }
}
function launcherAbiPreflight (launcherPath) {
  const r = spawnSync('python3', [launcherPath, '--abi-probe'], { encoding: 'utf8', timeout: 30_000 })
  const line = String(r.stdout ?? '').trim().split('\n').filter((l) => l !== '').pop() ?? ''
  let parsed = null
  try { parsed = JSON.parse(line) } catch { parsed = null }
  return { rc: r.status, error: r.error === undefined ? null : String(r.error.message ?? r.error).slice(0, 160), answer: line.slice(0, 240), kind: parsed?.kind ?? null, abiVersion: typeof parsed?.abi_version === 'number' ? parsed.abi_version : null }
}
function rgPreflight () {
  try {
    const pnpmDir = join(TESTUSE, 'node_modules', '.pnpm')
    const hit = readdirSync(pnpmDir).filter((d) => d.startsWith('@vscode+ripgrep-linux-x64@'))[0]
    if (hit === undefined) return { resolved: false }
    const bin = join(pnpmDir, hit, 'node_modules', '@vscode', 'ripgrep-linux-x64', 'bin', 'rg')
    if (!existsSync(bin)) return { resolved: false }
    const v = spawnSync(bin, ['--version'], { encoding: 'utf8', timeout: 15_000 })
    return { resolved: true, answer: String(v.stdout ?? '').split('\n')[0]?.slice(0, 80) ?? '' }
  } catch { return { resolved: false } }
}

// ═══════════════════════════════════ BLUEPRINTS ═════════════════════════════
function yamlScalar (value) {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (/^[A-Za-z0-9_./-]+$/.test(String(value))) return String(value)
  return JSON.stringify(String(value))
}
function yamlEmit (key, value, indent) {
  const pad = '  '.repeat(indent)
  if (Array.isArray(value)) {
    if (value.length === 0) return [`${pad}${key}: []`]
    return [`${pad}${key}:`, ...value.flatMap((item) => yamlEmitItem(item, indent + 1))]
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value)
    if (entries.length === 0) return [`${pad}${key}: {}`]
    return [`${pad}${key}:`, ...entries.flatMap(([k, v]) => yamlEmit(k, v, indent + 1))]
  }
  return [`${pad}${key}: ${yamlScalar(value)}`]
}
function yamlEmitItem (item, indent) {
  const pad = '  '.repeat(indent)
  if (item === null || typeof item !== 'object') return [`${pad}- ${yamlScalar(item)}`]
  const entries = Object.entries(item)
  const [firstKey, firstValue] = entries[0]
  const firstLines = yamlEmit(firstKey, firstValue, indent + 1)
  const rest = entries.slice(1).flatMap(([k, v]) => yamlEmit(k, v, indent + 1))
  return [`${pad}- ${firstLines[0].slice((indent + 1) * 2)}`, ...firstLines.slice(1), ...rest]
}

const ANCHOR_YAML = [
  '---', 'schemaVersion: 3', `blueprintId: ${BP_ANCHOR_ID}`, 'revision: "1"',
  'leader:', '  templateId: leader', '  persona: "You are the leader of the a5ie-r5 install team."',
  'members:', '  - templateId: wa', '    persona: "You are a worker of the a5ie-r5 install team."',
  'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
  'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
].join('\n')

function mainBlueprintYaml (denyList, mkTaskA, mode) {
  const denyBlock = (pad) => denyList.length === 0 ? [`${pad}builtinToolDeny: []`] : [`${pad}builtinToolDeny:`, ...denyList.map((n) => `${pad}  - ${n}`)]
  const taskA = `${mkTaskA} Work EXACTLY in this order, one tool call per turn: (1) tool team_bash with {"command":"true"}; (2) tool team_bash with {"command":"exit 7"}; (3) tool team_bash with {"command":"echo ${TOK_BASH}; echo ${BASH_WRITE_MARKER} > ./bash-wrote.txt; cat ./bash-wrote.txt"}; (4) tool team_bash with {"command":"cat ../outside/secret.txt"}; (5) tool team_grep with {"pattern":"${TOK_GREP}","path":".","output_mode":"content"}; (6) tool team_glob with {"pattern":"*.txt","path":"./gpos"}; (7) tool team_bash with {"command":"sleep 90"}; (8) tool team_bash with {"command":"kill -9 $$"}; (9) tool team_glob with {"pattern":"*","path":"./gdeep"}; then (10) finish with ONE line starting A5IE_R5_MEMBER_RESULT quoting each of the nine tool results you received. If your work was interrupted and you are asked to continue, resume at the first call you have not completed; never repeat a completed call.`
  const benign = 'You are the leader of the a5ie-r5 install team. Your only directive is to reply with the single word OK. Do not call any tool.'
  const leaderPersona = `You are the leader of the a5ie-r5 install team. On your directive: FIRST call team_delegate exactly once with rootSessionId ${CREATE_ROOT}, requestToken ${TK_A1}, delegationTemplateId "wa", label "ie-a", async false, and the prompt ${JSON.stringify(taskA)}; SECOND call team_collect with rootSessionId ${CREATE_ROOT} and requestTokens ["${TK_A1}"]; THIRD finish with one line starting A5IE_R5_LEADER_DONE.`
  return [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
    'displayName: "a5ie-r5 install-acceptance team"',
    'description: "a5ie-r5: the ordinary governed Team entry on the REAL installed face carrying #334 (PTC row) and #340 (race-aware shell settle); mock only at the LLM position. Grades the user-cancel channel end-to-end plus the r4-b2 shell set as regression."',
    'leader:', '  templateId: leader',
    `  persona: ${JSON.stringify(mode === 'baseline' ? benign : leaderPersona)}`,
    '  capabilities:', '    teamTools:', '      kind: allow', '      items:', '        - team_delegate', '        - team_collect',
    ...denyBlock('    '),
    '    skills:', '      kind: allow', '      items: []',
    '    mcp:', '      kind: allow', '      items: []',
    '    permissions:', '      default: ask', '      allow: []', '      ask: []', '      deny: []',
    'teamEnvelope:', '  allow:', '    - assign-task', '    - create-member', '    - send-message', '    - report-progress', '  deny: []',
    'members:',
    '  - templateId: wa', '    displayName: "a5ie-r5 worker A (ask-default shell)"',
    '    persona: "You are worker A of the a5ie-r5 install team. Follow delegated work exactly, tool by tool, in order. If interrupted, continue at the first unfinished call."',
    '    capabilities:', '      teamTools:', '        kind: allow', '        items: []',
    ...denyBlock('      '),
    '      skills:', '        kind: allow', '        items: []',
    '      mcp:', '        kind: allow', '        items: []',
    '      permissions:', '        default: ask',
    '        allow:', '          - tool: read', '            resource:', '              kind: any',
    '        ask: []', '        deny: []',
    'memberEnvelopes:',
    '  - templateId: wa', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
    'permissionMutationEnvelope:', '  rules: []', 'teamHardEnvelope:', '  rules: []',
    'requirements:', '  - domain: persona', '    name: standard',
    'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')
}

function rowConfig (mode, blueprintDir, world, launcher) {
  const cfg = {
    rootSessionId: ROOT,
    bootPhase: 'create',
    blueprintSource: ANCHOR_YAML,
    blueprintDir,
    rootPresetId: PRESET_ID,
    memberPresetId: PRESET_ID,
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'a5ie-r5-model' },
    deniedSelection: null,
    mcpServers: [],
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
      { domain: 'persona', subject: 'standard', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
  }
  if (mode === 'installed') {
    cfg.teamToolPlane = {
      realmId: 'a5ie-r5-realm',
      fsInstance: { fs: 'a5ie-r5-ctl', rootDir: world.governedRoot, realmId: 'a5ie-r5-realm', kind: 'absolute-path' },
      confinedProvider: {
        trustRoot: `sha256:${launcher.sha.slice(0, 16)}#${launcher.path}`,
        assembly: { launcherPath: launcher.path, launcherSha256: launcher.sha, minAbiVersion: 3 },
      },
    }
  }
  return cfg
}

// ═══════════════════════════ WIRE DIGEST (mock at the LLM slot) ══════════════
function digestRequest (parsed) {
  const msgs = Array.isArray(parsed?.messages) ? parsed.messages : []
  const sys = typeof parsed?.system === 'string' ? parsed.system : Array.isArray(parsed?.system) ? JSON.stringify(parsed.system) : ''
  const toolNames = Array.isArray(parsed?.tools) ? parsed.tools.map((t) => String(t?.name ?? '')).filter((n) => n !== '') : null
  let text = sys
  const assistantToolNames = []
  const toolResults = []
  for (const m of msgs) {
    if (typeof m?.content === 'string') { text += '\u0001' + m.content; continue }
    if (!Array.isArray(m?.content)) continue
    for (const b of m.content) {
      if (b?.type === 'text') text += '\u0001' + String(b.text ?? '')
      else if (b?.type === 'tool_use') { assistantToolNames.push(String(b.name ?? '')); text += '\u0001tool_use:' + String(b.name ?? '') + JSON.stringify(b.input ?? {}) }
      else if (b?.type === 'tool_result') {
        const rep = typeof b.content === 'string' ? b.content : JSON.stringify(b.content ?? '')
        toolResults.push(rep.slice(0, 6000))
        text += '\u0001tool_result:' + rep
      }
    }
  }
  const users = msgs.filter((m) => m?.role === 'user')
  const lastUser = users.length > 0 ? users[users.length - 1] : null
  const lastUserHead = String(typeof lastUser?.content === 'string' ? lastUser.content : JSON.stringify(lastUser?.content ?? '')).slice(0, 260)
  return { msgCount: msgs.length, toolCount: toolNames === null ? 0 : toolNames.length, toolNames, assistantToolNames, toolResults, lastUserHead, systemHead: sys.slice(0, 260), markerHits: [], _text: text }
}

// ═══════════════════════════════════ WORLD DRIVER ════════════════════════════
async function runWorld ({ mode, mock, MK, blueprintBaseDir, markers, stormLimit, faceReference, face, faceMirror, cancelState, memberSessionRef }) {
  const HOME = homeDir(WORKTREE, `${WORLD_PREFIX}-${mode}-${RUN_STAMP}`)
  const BLUEPRINT_DIR = join(blueprintBaseDir, mode)
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  const INSTANCE_RAW = join(EVIDENCE_DIR, `instance-${mode}.raw.log`)
  const INSTANCE_LOG = join(EVIDENCE_DIR, `instance-${mode}.log`)
  const world = {
    governedRoot: join(HOME, 'workspace', 'governed'),
    outsideSecret: join(HOME, 'workspace', 'outside', 'secret.txt'),
    bashWrote: join(HOME, 'workspace', 'governed', 'bash-wrote.txt'),
    deployment: join(HOME, 'deployment'),
  }
  const facts = { mode, home: HOME, ok: false, face: 'REAL INSTALL (dsh plugin --profile web add github:…#<sha>)' }
  let host = null
  let hostExit = null
  let reqBase = 0
  const port = mode === 'baseline' ? BASELINE_PORT : HOST_PORT
  try {
    if (!(await portFreeWait(port))) die(`port ${port} not free before ${mode} world`)
    mkdirSync(join(HOME, 'workspace'), { recursive: true })
    mkdirSync(world.governedRoot, { recursive: true })
    mkdirSync(join(HOME, 'workspace', 'outside'), { recursive: true })
    writeFileSync(join(world.governedRoot, 'notes.txt'), `line one\n${TOK_GREP} lives here\n`)
    writeFileSync(world.outsideSecret, `${OUTSIDE_MARKER}\n`)
    mkdirSync(join(world.governedRoot, 'gpos'), { recursive: true })
    for (const n of GPOS_SEEDS) writeFileSync(join(world.governedRoot, 'gpos', n), `seed ${n}\n`)
    writeFileSync(join(world.governedRoot, 'gpos', 'gamma.md'), 'not a txt file\n')
    // gdeep is a NESTED walk-friendly fixture (C3's normal walk; no hostile
    // modes anywhere — the a5ie-r3 dev1 walker-pollution lesson stays learned)
    mkdirSync(join(world.governedRoot, 'gdeep', 'a', 'b'), { recursive: true })
    for (const n of GDEEP_SEEDS) writeFileSync(join(world.governedRoot, 'gdeep', n), `seed ${n}\n`)
    writeFileSync(join(HOME, 'workspace', 'outside', 'plain-outside-note.txt'), 'nothing governed lives out here\n')

    const install = realInstall({ world: HOME, logName: `install-${mode}.log` })
    facts.install = { exit: install.exit, seconds: install.seconds, nodeModulesTop: install.nodeModulesTop, dependencies: Object.keys(install.manifest?.dependencies ?? {}), bundles: install.manifest?.dsh?.profile?.bundles ?? [] }
    const m = measureInstalledFace(install.installedDir, face, faceMirror)
    facts.installedFace = { expectedCount: m.expectedCount, actualCount: m.actualCount, missing: m.missing.length, extra: m.extra.length, shaMismatch: m.shaMismatch.length, rootSha: m.rootSha }
    check(`W.${mode}.install`, `the ${mode} world booted on a REAL installed face with three zeros (missing/extra/sha) and the same bytes as the measured install probe`,
      install.exit === 0 && m.missing.length === 0 && m.extra.length === 0 && m.shaMismatch.length === 0 && m.rootSha === faceReference.rootSha,
      `exit=${String(install.exit)} n=${String(m.actualCount)}/${String(m.expectedCount)} miss=${String(m.missing.length)} extra=${String(m.extra.length)} sha≠=${String(m.shaMismatch.length)} rootSha=${m.rootSha.slice(0, 12)}${m.rootSha === faceReference.rootSha ? '==probe' : '!=probe'}`)

    const launcherPath = join(world.deployment, 'landlock-prelauncher.py')
    const launcher = materializeLauncher(WORKTREE, INSTALL_SHA, launcherPath)
    const preflight = launcherAbiPreflight(launcherPath)
    facts.launcher = launcher
    facts.launcherAbiPreflight = preflight

    const basePlugins = smokePresetPlugins({
      personaText: 'You are a coding agent powered by the {{model}} model.',
      cwdSuffix: 'Your working directory is {{cwd}}.',
      bashDescription: 'Run commands in a bash shell. State is persistent across calls.',
    })
    const cfg = rowConfig(mode, BLUEPRINT_DIR, world, launcher)
    const lines = [
      `# a5ie-r5 live layer (run ${RUN_STAMP}, mode ${mode}): config override on the INSTALLED bundle row id "dsh-agent-team" + observer row + preset — public profile-patch seam only (INSTALL §3.2/§3.5).`,
      '- id: dsh-agent-team',
      '  name: dsh-agent-team/host',
      '  config:',
      ...Object.entries(cfg).flatMap(([k, v]) => yamlEmit(k, v, 2)),
      ...['- insert:', ...yamlEmitItem({ id: 'a5ie-r5-observer', name: OBSERVER_ROW_NAME, config: {} }, 1)],
      ...['- insert:', ...yamlEmitItem(presetDeclarationRow({
        id: PRESET_ID, displayName: 'a5ie-r5 base',
        description: `a5ie-r5 base preset (run ${RUN_STAMP}) = smoke preset`,
        plugins: basePlugins,
      }), 1)],
      '',
    ].join('\n').split('\n')
    writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), lines.join('\n'))
    writeFileSync(join(EVIDENCE_DIR, `profile-layer-${mode}.yml`), redact(lines.join('\n')))

    reqBase = mock.requests.length
    const stormCheck = (where) => {
      const mine = mock.requests.length - reqBase
      if (mine > stormLimit) {
        writeEvidence(`storm-diagnostic-${mode}.json`, { where, worldRequests: mine, limit: stormLimit })
        die(`MODEL-CALL STORM (${mode}): ${String(mine)} requests at "${where}" (> ${String(stormLimit)})`)
      }
    }

    const outFd = openSync(INSTANCE_RAW, 'a')
    host = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(port), '--no-open'], {
      cwd: join(HOME, 'workspace'),
      stdio: ['ignore', outFd, outFd],
      env: {
        ...process.env,
        DSH_HOME: HOME,
        DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH,
        DEEPSEEK_BASE_URL: `http://127.0.0.1:${mock.port}`,
        DEEPSEEK_API_KEY: 'a5ie-r5-mock-key',
      },
    })
    host.on('exit', (code, signal) => { hostExit = { code, signal }; console.log(`[${mode}] host exited code=${String(code)} signal=${String(signal)}`) })
    const boot = await waitFor(180_000, () => {
      try { const m = BOOT_MARKER.exec(readFileSync(INSTANCE_RAW, 'utf8')); return m === null ? false : m } catch { return false }
    }, `${mode} boot marker`)
    facts.bootLine = redact(String(boot[0])).slice(0, 200)
    const origin = `http://127.0.0.1:${boot[1]}`
    const auth = await fetch(`${origin}/?token=${boot[2]}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
    const cookie = auth.headers.get('set-cookie')
    if (!(auth.status === 303 && cookie !== null)) die(`${mode} token gate ${String(auth.status)}`)
    await waitFor(60_000, async () => {
      const h = await fetchJson(`${origin}/__a5ie/health`).catch(() => null)
      return h?.status === 200 && h.body?.applied === true ? h : false
    }, `${mode} observer applied`)
    stormCheck('post-boot (NO prompt sent yet)')

    // C1 handle resolution (installed world only): the member session to
    // cancel. TWO public read sources, first hit wins: (a) the READ-ONLY
    // observer row's agents list (`session-team-child*`, or any non-root
    // agent whose scopedNames carry team_bash); (b) the host session/list
    // API — child sessions are `session-team-child-…`. Red C1 at run
    // 2026-10-18T20-19-22Z drove (b): the observer row never surfaced the
    // child mid-chain while session/list showed it all along (resolverSeen
    // is retained in cancel-leg.json for the post-mortem).
    if (mode !== 'baseline') {
      memberSessionRef.promise = (async () => {
        const id = await waitQuiet(600_000, async () => {
          const f = await fetchJson(`${origin}/__a5ie/facts?names=team_bash`).catch(() => null)
          if (f?.status === 200) {
            const agents = f.body.agents ?? []
            cancelState.resolverSeen = agents.map((x) => `${String(x.session).slice(-18)}:${Array.isArray(x.scopedNames) && x.scopedNames.includes('team_bash') ? 'tb' : '-'}`)
            const cand = agents.find((x) => String(x.session).startsWith('session-team-child') || (x.session !== CREATE_ROOT && Array.isArray(x.scopedNames) && x.scopedNames.includes('team_bash')))
            if (cand !== undefined) { cancelState.resolverSource = 'observer'; return cand.session }
          }
          const sl = await fetchJson(`${origin}/api/session/list`, {
            method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
            body: JSON.stringify({ type: 'client-request', rpcId: 'a5ie-r5-children', method: 'session/list', payload: { args: { _request: {} } } }),
          }, 15_000).catch(() => null)
          const items = sl?.body?.result?.value?.items ?? []
          const child = items.map((i) => String(i.sessionId ?? '')).filter((s) => s.startsWith('session-team-child'))
          if (child.length > 0) { cancelState.resolverSource = 'session-list'; return child[0] }
          return false
        })
        memberSessionRef.resolved = id ?? null
        if (id != null) cancelState.resolvedAt = Date.now()
        return id
      })()
      // The fire driver. At run 2026-10-18T20-23-56Z the cancel RPC was
      // accepted (200 {accepted:true}) but landed 26.8s LATE: the chain-loop
      // poll was starved while the member slept. Fix: the fire hangs on a
      // direct in-process setTimeout armed by mockDecide the moment the
      // sleep-30 toolCall is scripted (fireHook below); the chain poll keeps
      // a backstop plus a heartbeat/tick trace for the post-mortem.
      cancelState.fireHook = async () => {
        if ((cancelState.fireCount ?? 0) >= 2) return
        const msid = memberSessionRef.resolved
        if (msid === null) return
        cancelState.fireCount = (cancelState.fireCount ?? 0) + 1
        if (cancelState.fireCount === 1) cancelState.firedAt = Date.now()
        else cancelState.firedAt2 = Date.now()
        try {
          const cr = await fetchJson(`${origin}/api/session/cancel`, {
            method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
            body: JSON.stringify({ type: 'client-request', rpcId: `a5ie-r5-cancel-${String(cancelState.fireCount)}`, method: 'session/cancel', payload: { args: { request: { sessionId: msid } } } }),
          }, 30_000)
          cancelState.httpStatus = cr.status
          cancelState.httpBody = redact(JSON.stringify(cr.body ?? null)).slice(0, 400)
        } catch (error) { cancelState.httpError = redact(String(error?.message ?? error)).slice(0, 200) }
        await new Promise((r) => setTimeout(r, 5_000))
        try {
          const nu = await fetchJson(`${origin}/api/session/prompt`, {
            method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
            body: JSON.stringify({ type: 'client-request', rpcId: `a5ie-r5-resume-${String(cancelState.fireCount)}`, method: 'session/prompt', payload: { args: { request: { requestId: `a5ie-r5-resume-${String(cancelState.fireCount)}-r`, sessionId: msid, mode: 'queue', content: [{ type: 'text', text: `${MK}_${mode.toUpperCase()}_RESUME Continue your delegated work EXACTLY where it stopped: run the first tool call you have not completed yet. Do not repeat completed calls. Reply OK only if you will continue silently.` }] } } } }),
          }, 60_000)
          cancelState.nudgeStatus = nu.status
        } catch (error) { cancelState.nudgeError = redact(String(error?.message ?? error)).slice(0, 200) }
        cancelState.nudgedAt = Date.now()
        writeEvidence('cancel-leg.json', { ...cancelState, memberSession: msid })
        // E1-vs-E2 discriminator (run 2026-10-18T20-29-14Z: RPC accepted:true
        // yet the row settled cancelled:false not-observed — E1: the lane WAS
        // aborted at cancel time but the cause was not the user/parent arm;
        // E2: the lane was never aborted and only torn down at sweep). The
        // lane's own settle line for the sleep leg (bash-7: legs true/exit7/
        // pos/oob take bash-1..4, grep/glob take 5/6 in the shared call
        // counter) is timestamped from the LIVE raw log.
        if (cancelState.logSettleAt === 0 || cancelState.logSettleAt === null) {
          const settle = await waitQuiet(110_000, () => {
            try {
              const m = /\ba5g7-shell: confined-shell ran [^\n]*bash-7\b[^\n]*/.exec(readFileSync(INSTANCE_RAW, 'utf8'))
              return m === null ? false : m[0]
            } catch { return false }
          })
          cancelState.logSettleAt = settle === null ? null : Date.now()
          cancelState.logSettleLine = settle ?? null
          writeEvidence('cancel-leg.json', { ...cancelState, memberSession: msid })
        }
      }
    }

    const wireHit = (needle) => (mock.requests ?? []).find((r) => r.digest !== undefined && r.digest.markerHits.includes(needle) && r.digest.toolCount > 0)
    async function promptBarrier ({ sessionId, textBase, rpcTag, attempts = 12, perAttemptMs = 30_000 }) {
      let lastStatus = 0
      for (let k = 1; k <= attempts; k += 1) {
        stormCheck(`barrier ${textBase.slice(0, 30)} attempt ${String(k)}`)
        const res = await fetchJson(`${origin}/api/session/prompt`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
          body: JSON.stringify({ type: 'client-request', rpcId: `${rpcTag}-a${k}`, method: 'session/prompt', payload: { args: { request: { requestId: `${rpcTag}-a${k}-r`, sessionId, mode: 'queue', content: [{ type: 'text', text: `${textBase} (barrier probe ${k}) This is a setup turn. Do not call any tools. Reply OK.` }] } } } }),
        }, 240_000)
        lastStatus = res.status
        const hit = await waitQuiet(perAttemptMs, async () => wireHit(textBase))
        if (hit) return { hit, attempts: k, lastStatus }
      }
      die(`barrier: no wire request for "${textBase.slice(0, 40)}…" after ${attempts} prompt attempts on ${sessionId} (last HTTP ${lastStatus})`)
    }

    const disc = await promptBarrier({ sessionId: ROOT, textBase: MK_DISC(mode, MK), rpcTag: `a5ie-${mode}-d` })
    facts.discPrompt = { attempts: disc.attempts, status: disc.lastStatus }
    const surface = [...new Set(disc.hit.digest.toolNames ?? [])].sort()
    const denyList = surface.filter((n) => !n.startsWith('team_') && !MANAGED_TOOL_NAMES.includes(n) && !SAFE_UNMANAGED_TOOL_NAMES.includes(n))
    facts.discoverySurface = surface
    facts.denyList = denyList
    const bpText = mainBlueprintYaml(denyList, `${MK}_${mode.toUpperCase()}_TASK_A`, mode)
    writeFileSync(join(BLUEPRINT_DIR, 'main.yaml'), bpText)

    const cl = await fetchJson(`${origin}/team-remote/catalog.list`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
      body: JSON.stringify({ type: 'client-request', rpcId: 'a5ie-pre-1', method: 'catalog.list', payload: { version: 4, params: {} } }),
    }, 30_000)
    const listed = JSON.stringify(cl.body ?? '').includes(BP_MAIN_ID)
    const cg = await fetchJson(`${origin}/team-remote/catalog.get`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
      body: JSON.stringify({ type: 'client-request', rpcId: 'a5ie-pre-2', method: 'catalog.get', payload: { version: 4, params: { blueprintId: BP_MAIN_ID, blueprintRevision: 1 } } }),
    }, 30_000)
    facts.catalogPreflight = { listStatus: cl.status, listed, getStatus: cg.status }

    const created = await fetchJson(`${origin}/team-remote/team.create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
      body: JSON.stringify({ type: 'client-request', rpcId: `a5ie-${mode}-tc`, method: 'team.create', payload: { version: 1, params: { rootSessionId: CREATE_ROOT, blueprintId: BP_MAIN_ID, initialWork: { prompt: `${MK}_${mode.toUpperCase()}_L0 Begin your directive.` } } } }),
    }, 90_000)
    facts.teamCreate = { status: created.status, body: redact(JSON.stringify(created.body ?? null)).slice(0, 1200) }

    await waitFor(240_000, async () => { const hit = wireHit(`${MK}_${mode.toUpperCase()}_L0`); return hit ?? false }, `${mode} leader turn at the mock`)
    if (mode === 'baseline') {
      const reqs = (mock.requests ?? []).filter((r) => r.digest?.markerHits.includes(`${MK}_${mode.toUpperCase()}_L0`) && r.digest.toolCount > 0)
      facts.leaderWireCatalog = reqs[0]?.digest.toolNames ?? null
    } else {
      // (member-session resolver started early, right after boot — see above)
      const chain = await waitFor(900_000, async () => {
        stormCheck('leader chain')
        // C1 driver: PRIMARY fire is the setTimeout in mockDecide (fireHook);
        // here only the backstop + the tick trace (the starvation post-mortem
        // of run 2026-10-18T20-23-56Z needs per-tick evidence).
        cancelState.pollTicks = (cancelState.pollTicks ?? 0) + 1
        if (cancelState.armedAt !== 0 && cancelState.firedAt === 0) {
          (cancelState.fireWaits ??= []).push(Date.now() - cancelState.armedAt)
          if (cancelState.fireWaits.length > 100) cancelState.fireWaits.shift()
          void cancelState.fireHook?.()
        }
        const reqs = (mock.requests ?? []).filter((r) => r.digest?.markerHits.includes(`${MK}_${mode.toUpperCase()}_L0`) && r.digest.toolCount > 0)
        if (reqs.length === 0) return false
        const doneReplied = reqs.some((r) => JSON.stringify(r.reply ?? '').includes('A5IE_R5_LEADER_DONE'))
        // run 2026-10-18T20-29-14Z: leader reached DONE EARLY (its delegation
        // resolved when the cancel interrupted the member's turn) and the
        // teardown then killed the RESUME-nudged member mid-continuation. The
        // chain is done when the MEMBER quotes its results; leader DONE alone
        // does not close it (grace: 240s after DONE, then grade what exists).
        const memberFinal = (mock.requests ?? []).find((r) => r.digest?.markerHits.includes(`${MK}_${mode.toUpperCase()}_TASK_A`) && !r.digest.markerHits.includes(`${MK}_${mode.toUpperCase()}_L0`) && JSON.stringify(r.reply ?? '').includes('A5IE_R5_MEMBER_RESULT'))
        if (doneReplied && cancelState.chainDoneAt === undefined) cancelState.chainDoneAt = Date.now()
        if (!memberFinal && !(doneReplied && cancelState.chainDoneAt !== undefined && Date.now() - cancelState.chainDoneAt > 240_000)) return false
        const last = reqs[reqs.length - 1]
        return { toolCalls: last.digest.assistantToolNames, backToLeader: Boolean(memberFinal) || String(memberFinal === undefined ? '' : '').includes('A5IE_R5_MEMBER_RESULT') || (last.digest._text ?? '').includes('A5IE_R5_MEMBER_RESULT') }
      }, `${mode} leader chain (one delegation + collect + final)`)
      facts.leaderToolCalls = chain.toolCalls
      facts.memberResultsBackToLeader = chain.backToLeader
      const memberAReqs = (mock.requests ?? []).filter((r) => r.digest?.markerHits.includes(`${MK}_${mode.toUpperCase()}_TASK_A`) && !r.digest.markerHits.includes(`${MK}_${mode.toUpperCase()}_L0`) && r.digest.toolCount > 0)
      facts.memberARequestCount = memberAReqs.length
      facts.memberAWireCatalog = memberAReqs[0]?.digest.toolNames ?? null
      const lastA = memberAReqs[memberAReqs.length - 1]
      facts.memberAToolResults = lastA?.digest.toolResults ?? []
      facts.memberAToolCallOrder = lastA?.digest.assistantToolNames ?? []
      facts.cancelledShapeLanding = (facts.memberAToolResults ?? []).map((r, i) => ({ i, cancel: /cancel/i.test(String(r)) }))
      facts.memberAFinal = memberAReqs.find((r) => JSON.stringify(r.reply ?? '').includes('A5IE_R5_MEMBER_RESULT'))?.reply ?? null
      facts.bashWroteExists = existsSync(world.bashWrote)
      facts.bashWroteBytes = facts.bashWroteExists ? readFileSync(world.bashWrote, 'utf8') : null
      const wireAll = (mock.requests ?? []).slice(reqBase).map((r) => JSON.stringify({ reply: r.reply ?? null, digest: r.digest === undefined ? null : { toolResults: r.digest.toolResults, text: r.digest._text } }))
      facts.outsideMarkerOnWire = wireAll.filter((s) => s.includes(OUTSIDE_MARKER)).length
      writeEvidence('cancel-leg.json', { ...cancelState, memberSession: memberSessionRef.resolved })
    }
    for (const preset of PRESETS) {
      const MKP = `${MK}_${mode.toUpperCase()}_${preset.toUpperCase()}_SETUP`
      const c = await fetchJson(`${origin}/api/session/create`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
        body: JSON.stringify({ type: 'client-request', rpcId: `a5ie-${mode}-${preset}-c`, method: 'session/create', payload: { args: { request: { agentPreset: preset } } } }),
      }, 60_000)
      const sessionId = c.body?.result?.value?.sessionId ?? c.body?.value?.sessionId ?? null
      facts[preset] = { sessionId, createStatus: c.status }
      if (typeof sessionId !== 'string' || sessionId === '') { facts[preset].failed = true; continue }
      const presHit = await promptBarrier({ sessionId, textBase: MKP, rpcTag: `a5ie-${mode}-${preset}-p`, attempts: 12 })
      facts[preset].promptAttempts = presHit.attempts
      facts[preset].wireCatalog = [...new Set(presHit.hit.digest.toolNames ?? [])].sort()
    }

    const observed = await waitFor(180_000, async () => {
      const f = await fetchJson(`${origin}/__a5ie/facts?names=${encodeURIComponent(WATCH_NAMES.join(','))}&roots=${encodeURIComponent(CREATE_ROOT)}`).catch(() => null)
      if (f?.status !== 200) return false
      const live = (f.body.agents ?? []).filter((a) => Array.isArray(a.scopedNames))
      return live.length >= PRESETS.length ? f.body : false
    }, `${mode} observer facts`)
    facts.globalNames = observed.globalNames
    facts.planeObservations = observed.planeObservations
    facts.agentRegistry = (observed.agents ?? []).map((x) => ({ session: x.session, scopedNames: x.scopedNames }))
    const byId = {}
    for (const a of observed.agents ?? []) byId[a.session] = a
    facts.leader = byId[CREATE_ROOT] ?? null
    for (const preset of PRESETS) {
      const sid = facts[preset]?.sessionId
      facts[preset].scopedNames = byId[sid]?.scopedNames ?? null
    }
    facts.sessions = await waitQuietTolerant(180_000, async () => {
      const sl = await fetchJson(`${origin}/api/session/list`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' }, body: JSON.stringify({ type: 'client-request', rpcId: 'a5ie-sessions', method: 'session/list', payload: { args: { _request: {} } } }) }, 20_000)
      const items = sl.body?.result?.value?.items ?? []
      return items.length > 0 && items.every((i) => i.running !== true) ? items.map((i) => ({ s: String(i.sessionId ?? '').slice(-14), run: i.running === true })) : false
    })
    facts.ok = true
    return facts
  } finally {
    writeEvidence(`world-${mode}.partial.json`, facts)
    try { if (host !== null) host.kill() } catch { /* gone */ }
    await new Promise((r) => setTimeout(r, 3000))
    facts.hostExit = hostExit
    try {
      const lines = mock.requests.slice(reqBase).map((r) => JSON.stringify({
        seq: r.seq, path: r.path, status: r.status, reply: r.reply === undefined ? null : redact(JSON.stringify(r.reply)).slice(0, 400),
        digest: r.digest === undefined ? null : { ...r.digest, markerHits: r.digest.markerHits.filter((x) => x.startsWith('A5IE')), systemHead: redact(r.digest.systemHead), lastUserHead: redact(r.digest.lastUserHead), toolResults: r.digest.toolResults.map((x) => redact(x)), _text: `${r.digest._text.length} chars` },
      }))
      writeFileSync(join(EVIDENCE_DIR, `wire-digests-${mode}.jsonl`), lines.join('\n') + '\n')
    } catch { /* best effort */ }
    try {
      const raw = readFileSync(INSTANCE_RAW, 'utf8')
      facts.logObservations = raw.split('\n').filter((l) => /a5ie|a5-plane|a5g7-search|a5g7-shell|a5g7-read|placement-feed|confined-shell|governed-read|anchored-search|anchored-glob|cancel|settle/i.test(l)).slice(0, 200).map((l) => redact(l).slice(0, 300))
      facts.hostErrors = raw.split('\n').filter((l) => /ERR_MODULE_NOT_FOUND|bootstrap FAILED|TRUST_ROOT|placement-REFUSED|mount-REFUSED|guard-refusal|BINDING_UNVERIFIED|TEAM_PLUGIN_CONFIG_INVALID|unhandled/i.test(l)).slice(0, 20).map((l) => redact(l).slice(0, 300))
      writeFileSync(INSTANCE_LOG, redact(raw))
      rmSync(INSTANCE_RAW)
    } catch { /* no log */ }
    if (!KEEP) { try { rmSync(HOME, { recursive: true, force: true }) } catch { /* best effort */ } }
    facts.swept = !existsSync(HOME)
  }
}
const MK_DISC = (mode, MK) => `${MK}_${mode.toUpperCase()}_DISC`

// ═══════════════════════════════════ MAIN ════════════════════════════════════
const rnd = () => Math.random().toString(36).slice(2, 10)
const toolCall = (id, name, argsObj) => ({ kind: 'tool-call', toolCalls: [{ id, name, arguments: argsObj }] })

async function main () {
  {
    const homesRoot = join(WORKTREE, 'tests', 'homes')
    const stale = existsSync(homesRoot) ? readdirSync(homesRoot).filter((d) => d.startsWith(`${WORLD_PREFIX}-`)) : []
    for (const d of stale) { try { rmSync(join(homesRoot, d), { recursive: true, force: true }) } catch { /* best effort */ } }
    writeEvidence('start-sweep.json', { staleHomes: stale })
  }
  console.log(`a5ie-r5 kit stamp=${RUN_STAMP} ports=${HOST_PORT}/${BASELINE_PORT} spec=${INSTALL_SPEC}`)
  const head = gitAt(TESTUSE, 'rev-parse', 'HEAD')
  const porcelainBefore = gitAt(TESTUSE, 'status', '--porcelain')
  check('H1', `the test-use host is the pinned pristine runtime @${TEST_USE_BASELINE_SHA.slice(0, 10)}, porcelain clean before`,
    head === TEST_USE_BASELINE_SHA && porcelainBefore === '', `head=${head.slice(0, 10)} porcelain=${porcelainBefore === '' ? 0 : 'DIRTY'}`)
  const worktreeHead = gitAt(WORKTREE, 'rev-parse', 'HEAD')
  const masterIsAncestor = spawnSync('git', ['-C', WORKTREE, 'merge-base', '--is-ancestor', INSTALL_SHA, 'HEAD'], { encoding: 'utf8' }).status === 0
  const b2Row = spawnSync('git', ['-C', WORKTREE, 'log', '--format=%h %s', '-1', INSTALL_SHA], { encoding: 'utf8' }).stdout.trim()
  check('H1b', 'the install spec pins the LIVE master SHA the kit itself measured with git ls-remote, and the worktree CARRIES it (merged, not spliced)',
    masterIsAncestor, `ls-remote=${INSTALL_SHA} merged-HEAD=${worktreeHead.slice(0, 12)} ancestor=${String(masterIsAncestor)} row=${b2Row.slice(0, 70)}`)
  const lineage = spawnSync('git', ['-C', WORKTREE, 'log', '--format=%s', INSTALL_SHA], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).stdout ?? ''
  const has334 = /#334/.test(lineage)
  const has340 = /#340/.test(lineage)
  check('H1c', 'the install SHA carries BOTH PRs this round grades: its own subject lineage contains #334 (PTC fs half-arm row) AND #340 (race-aware shell settle) — the cancel family and the oracle have bytes on this face at all',
    has334 && has340, `lineage-#334=${String(has334)} lineage-#340=${String(has340)}`)
  let mockPort = 0
  for (const p of [3491, 3492, 3493, 3494, 3495]) { if (await portFree(p)) { mockPort = p; break } }
  check('H2', `ports ${HOST_PORT} AND ${BASELINE_PORT} self-proved free before the run + a mock port from the 349x family free`, (await portFree(HOST_PORT)) && (await portFree(BASELINE_PORT)) && mockPort > 0, `mock=${mockPort}`)
  const stableBefore = await stableProbe()
  check('H0', 'the stable :3080 instance answers read-only before this run (probe only, never touched)', stableBefore !== 'unreachable', `status=${String(stableBefore)}`)
  const rg0 = rgPreflight()
  note('RG', 'rg deployment precondition (booked): the glob/search rows spawn the packaged ripgrep through the host resolver; when it cannot resolve, those rows land rg-unavailable',
    `resolved=${String(rg0.resolved)} answer=${JSON.stringify(rg0.answer ?? '')}`)

  // ══ PHASE I — the real install into a NEW install directory ══════════════
  const INSTALL_HOME = homeDir(WORKTREE, `${WORLD_PREFIX}-install-${RUN_STAMP}`)
  mkdirSync(join(INSTALL_HOME, 'workspace'), { recursive: true })
  const face = declaredFace(WORKTREE, INSTALL_SHA)
  const faceMirror = materializeDeclaredFace(WORKTREE, INSTALL_SHA, face)
  let probe = null
  probe = realInstall({ world: INSTALL_HOME, logName: 'install-probe.log' })
  const m = measureInstalledFace(probe.installedDir, face, faceMirror)
  const deps = Object.keys(probe.manifest?.dependencies ?? {})
  const bundles = probe.manifest?.dsh?.profile?.bundles ?? []
  writeEvidence('install-manifest.json', {
    spec: INSTALL_SPEC, sha: INSTALL_SHA, storeDir: STORE_DIR, profileDir: probe.profileDir,
    exit: probe.exit, seconds: probe.seconds, dependencies: probe.manifest?.dependencies ?? null, bundles,
    nodeModulesTop: probe.nodeModulesTop, fileCount: m.actualCount, expectedCount: m.expectedCount,
    declaredFiles: face.files, declaredCount: face.declared.length, packAdditions: m.packAdditions,
    missing: m.missing, extra: m.extra, shaMismatch: m.shaMismatch, rootSha: m.rootSha, manifest: m.manifest,
  })
  check('I1', 'REAL install through the host\'s own public package face — `dsh plugin --profile web add github:ArmourPiercer1/dsh-agent-team#<master-sha>` into a NEW install dir, store kept workspace-local by the profile\'s own pnpm-workspace.yaml storeDir: — exits 0',
    probe.exit === 0, `exit=${String(probe.exit)} in ${String(probe.seconds)}s; tail=${probe.outputTail.slice(0, 220)}`)
  check('I2', 'STRICT profile face: the profile declares EXACTLY this repo\'s one plugin, its node_modules top level holds nothing else, and the reconciler appended the dsh-agent-team bundle row',
    deps.length === 1 && deps[0] === 'dsh-agent-team' && probe.manifest?.dependencies?.['dsh-agent-team'] === INSTALL_SPEC && probe.nodeModulesTop.length === 1 && probe.nodeModulesTop[0] === 'dsh-agent-team' && bundles.includes('dsh-agent-team'),
    `deps=${JSON.stringify(deps)} nm=${JSON.stringify(probe.nodeModulesTop)} bundles=${JSON.stringify(bundles)}`)
  check('I3a', 'INSTALL THREE-ZEROS (1/4 count): the installed tree holds exactly the declared face — one file per declared entry',
    m.actualCount === m.expectedCount, `installed=${String(m.actualCount)} declared-files-face=${String(m.expectedCount)} (files: entries=${String(face.declared.length)} + pack-always=${String(m.packAdditions.length)})`)
  check('I3b', 'INSTALL THREE-ZEROS (2/4 missing = 0): every declared file materialized in the install dir',
    m.missing.length === 0, `missing=${String(m.missing.length)} ${JSON.stringify(m.missing.slice(0, 6))}`)
  check('I3c', 'INSTALL THREE-ZEROS (3/4 extra = 0): nothing outside the declared face landed',
    m.extra.length === 0, `extra=${String(m.extra.length)} ${JSON.stringify(m.extra.slice(0, 6))}`)
  check('I3d', 'INSTALL THREE-ZEROS (4/4 sha ≠ 0): every installed file is BYTE-IDENTICAL to that path at the installed commit',
    m.shaMismatch.length === 0, `mismatch=${String(m.shaMismatch.length)} ${JSON.stringify(m.shaMismatch.slice(0, 3))} rootSha=${m.rootSha.slice(0, 16)}`)
  check('I3e', 'the two bytes beyond the declared `files:` list are exactly the pack rules\' always-included manifest/document pair (disclosed, not hidden inside the count)',
    m.packAdditions.length === 2 && m.packAdditions.includes('package.json') && m.packAdditions.includes('README.md'),
    `alwaysIncluded=${JSON.stringify(m.packAdditions)}`)
  const layerText = readFileSync(join(probe.installedDir, 'cordis.patch.yml'), 'utf8')
  const machineAgnostic = !/file:\/\/|[A-Za-z]:\\|\/srv\/|\/home\/|\/Users\//.test(layerText)
  check('I4', 'the installed bundle layer is machine-agnostic (rows reference the package by name — no file: URL, no absolute path)',
    machineAgnostic && layerText.includes('dsh-agent-team/host'), `fileUrlOrAbsPath=${String(!machineAgnostic)} hostRow=${String(layerText.includes('dsh-agent-team/host'))}`)
  const probeWorld = { governedRoot: join(INSTALL_HOME, 'workspace', 'governed') }
  mkdirSync(probeWorld.governedRoot, { recursive: true })
  mkdirSync(join(INSTALL_HOME, 'blueprints'), { recursive: true })
  const probeLauncher = materializeLauncher(WORKTREE, INSTALL_SHA, join(INSTALL_HOME, 'deployment', 'landlock-prelauncher.py'))
  const probePreflight = launcherAbiPreflight(probeLauncher.path)
  writeEvidence('launcher-deployment.json', { launcher: probeLauncher, abiPreflight: probePreflight, note: 'deployment input for the confined provider: git-show blob (NEVER git archive — tar bytes fail the provider closed-loop, booked as B1); must carry the B2 --exit-passthrough stream arm' })
  check('I9', 'the deployment input the installer supplies for the confined provider is the RIGHT BYTES: git-show blob byte-identical to the installed commit and the worktree, `#!` script, carries the B2 --exit-passthrough stream arm, and --abi-probe measures a real landlock ABI',
    probeLauncher.bytesMatchCommitAndWorktree && probeLauncher.isScript && probeLauncher.carriesExitPassthrough && probePreflight.kind === 'abi-available' && typeof probePreflight.abiVersion === 'number',
    `sha=${probeLauncher.sha.slice(0, 16)}… commit==worktree=${String(probeLauncher.bytesMatchCommitAndWorktree)} script=${String(probeLauncher.isScript)} b2token=${String(probeLauncher.carriesExitPassthrough)} abi=${String(probePreflight.kind)}/${String(probePreflight.abiVersion)}`)
  const probeCfg = rowConfig('installed', join(INSTALL_HOME, 'blueprints'), probeWorld, probeLauncher)
  const basePluginsProbe = smokePresetPlugins({
    personaText: 'You are a coding agent powered by the {{model}} model.',
    cwdSuffix: 'Your working directory is {{cwd}}.',
    bashDescription: 'Run commands in a bash shell. State is persistent across calls.',
  })
  const probeLayer = [
    `# a5ie-r5 INSTALL-PROBE layer (run ${RUN_STAMP}): the same id-targeted config override the live worlds use, on the installed bundle row.`,
    '- id: dsh-agent-team',
    '  name: dsh-agent-team/host',
    '  config:',
    ...Object.entries(probeCfg).flatMap(([k, v]) => yamlEmit(k, v, 2)),
    ...['- insert:', ...yamlEmitItem(presetDeclarationRow({
      id: PRESET_ID, displayName: 'a5ie-r5 base', description: `a5ie-r5 base preset (run ${RUN_STAMP}) = smoke preset`, plugins: basePluginsProbe,
    }), 1)],
    '',
  ].join('\n')
  writeFileSync(join(INSTALL_HOME, 'profiles', 'web', 'cordis.patch.yml'), probeLayer)
  const dump = spawnSync(process.execPath, [HOST_BIN, '--profile', 'web', '--dump-config'], {
    cwd: join(INSTALL_HOME, 'workspace'), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 180_000,
    env: { ...process.env, DSH_HOME: INSTALL_HOME },
  })
  const dumpText = dump.stdout ?? ''
  writeEvidence('dump-config-install-probe.txt', redact(dumpText))
  const hasTeamRow = /^- id: dsh-agent-team\n {2}name: dsh-agent-team\/host$/m.test(dumpText)
  const hasPlane = /teamToolPlane:/.test(dumpText)
  const hasSubRows = /name: dsh-agent-team\/spill-local/.test(dumpText) && /^- id: dsh-agent-team-client$/m.test(dumpText)
  const skipped = /skipped bundle|declares no dsh\.bundle/i.test(dumpText)
  check('I5', 'the pinned host composes the INSTALLED bundle row through the public profile seam (--dump-config carries the host row + this round\'s plane + spill/client rows, no skipped bundle)',
    dump.status === 0 && hasTeamRow && hasPlane && hasSubRows && !skipped,
    `exit=${String(dump.status)} teamRow=${String(hasTeamRow)} plane=${String(hasPlane)} subRows=${String(hasSubRows)} skipped=${String(skipped)}`)
  const gate = spawnSync(process.execPath, [join(WORKTREE, 'scripts', 'check-artifacts-committed.mjs')], { cwd: WORKTREE, encoding: 'utf8', timeout: 300_000 })
  check('I6', 'the repo drift gate grades the COMMITTED dist at HEAD with exit 0 (bytes that installed are the bytes the commit carries)',
    gate.status === 0, `status=${String(gate.status)} ${(String(gate.stdout ?? '') + String(gate.stderr ?? '')).split('\n').filter((l) => l.trim() !== '').slice(-1)[0]?.slice(0, 160) ?? ''}`)
  const launcherRel = 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py'
  const sourceLauncher = sha256File(join(WORKTREE, launcherRel))
  check('I8', `DISCLOSED FACE GAP (honest, not worked around): the Landlock pre-launcher is NOT on the published face (tsc never emits .py), so the installer supplies it as a deployment input (byte-pinned sha256=${sourceLauncher.slice(0, 16)}…, INSTALL §3.5)`,
    !face.expected.includes(launcherRel) && existsSync(join(WORKTREE, launcherRel)),
    `launcherInFace=${String(face.expected.includes(launcherRel))} launcherSha=${sourceLauncher.slice(0, 16)}…`)
  {
    const planePath = join(probe.installedDir, 'packages/runtime/dist/packages/runtime/src/plugin/live/plane-effect-backends.mjs')
    const providerPath = join(probe.installedDir, 'packages/runtime/dist/packages/runtime/sandbox-provider/provider.js')
    const installedNames = new Set(m.manifest.map((x) => x.path))
    const planeBytes = existsSync(planePath) ? readFileSync(planePath, 'utf8') : ''
    const providerBytes = existsSync(providerPath) ? readFileSync(providerPath, 'utf8') : ''
    check('I10', 'CONSTANCY (r4-b2): the #336 shell-arm flag is still on the installed bytes (plane row exitPassthrough: true, provider argv token), and both files are in the installed manifest',
      installedNames.has('packages/runtime/dist/packages/runtime/src/plugin/live/plane-effect-backends.mjs') && installedNames.has('packages/runtime/dist/packages/runtime/sandbox-provider/provider.js') && planeBytes.includes('exitPassthrough: true') && providerBytes.includes('--exit-passthrough'),
      `planeFlag=${String(planeBytes.includes('exitPassthrough: true'))} providerFlag=${String(providerBytes.includes('--exit-passthrough'))}`)
  }
  {
    const ptcRel = 'packages/runtime/dist/packages/runtime/src/plugin/live/ptc-escalation-row.mjs'
    const ptcPath = join(probe.installedDir, ptcRel)
    const inManifest = new Set(m.manifest.map((x) => x.path)).has(ptcRel)
    const bytes = existsSync(ptcPath) ? readFileSync(ptcPath, 'utf8') : ''
    check('I11', 'THE DURABLE ORACLE IS SHIPPED (#334): the PTC escalation row is in the installed manifest (the 9th place-dist-glue placement) and its INSTALLED bytes carry isAdmissible — the one-shot grant adjudicator is on the face that runs, not only in git',
      inManifest && bytes.includes('isAdmissible'),
      `ptcInManifest=${String(inManifest)} isAdmissibleHits=${String(bytes.split('isAdmissible').length - 1)}`)
  }
  {
    const liveDir = 'packages/runtime/dist/packages/runtime/src/plugin/live/'
    const carriers = { raceShellSettle: [], shellCancelled: [] }
    for (const entry of m.manifest) {
      if (!entry.path.startsWith(liveDir) || !/\.(mjs|js)$/.test(entry.path)) continue
      const bytes = readFileSync(join(probe.installedDir, entry.path), 'utf8')
      if (bytes.includes('raceShellSettle')) carriers.raceShellSettle.push(entry.path.slice(liveDir.length))
      if (bytes.includes('shellCancelled')) carriers.shellCancelled.push(entry.path.slice(liveDir.length))
    }
    check('I12', 'THE CANCEL CHANNEL IS SHIPPED (#340): raceShellSettle AND shellCancelled appear in the INSTALLED bytes under plugin/live (which files carry them is REPORTED, placement is not assumed) — the row the C family grades below really has the settle code on this face',
      carriers.raceShellSettle.length > 0 && carriers.shellCancelled.length > 0,
      `raceShellSettle=${JSON.stringify(carriers.raceShellSettle)} shellCancelled=${JSON.stringify(carriers.shellCancelled)}`)
    writeEvidence('installed-token-carriers.json', carriers)
  }
  const faceReference = { rootSha: m.rootSha, fromProbe: true }

  const MK = `A5IE_R5_${RUN_STAMP.replace(/[^A-Za-z0-9]/g, '')}`
  const markers = []
  for (const mode of MODES) {
    const MU = mode.toUpperCase()
    markers.push(`${MK}_${MU}_DISC`, `${MK}_${MU}_L0`)
    if (mode !== 'baseline') markers.push(`${MK}_${MU}_TASK_A`, `${MK}_${MU}_RESUME`)
    for (const preset of PRESETS) markers.push(`${MK}_${MU}_${preset.toUpperCase()}_SETUP`)
  }
  markers.push('A5IE_R5_MEMBER_RESULT', 'A5IE_R5_LEADER_DONE')

  // The C1 cancel state, shared between the mock (arms when the sleep-30
  // toolCall is scripted) and the installed world's chain loop (fires + nudges).
  const cancelState = { armedAt: 0, armedCount: 0, firedAt: 0, firedAt2: 0, fireCount: 0, resolvedAt: 0, resolverSource: null, resolverSeen: [], logSettleAt: 0, logSettleLine: null, chainDoneAt: undefined, httpStatus: 0, httpBody: null, httpError: null, nudgeStatus: 0, nudgeError: null, nudgedAt: 0 }
  const memberSessionRef = { promise: undefined, resolved: null }
  const mockDecide = ({ req }) => {
      const digest = digestRequest(req)
      digest.markerHits = markers.filter((mk) => digest._text.includes(mk))
      const rec = mock.requests[mock.requests.length - 1]
      if (rec !== undefined) {
        rec.digest = digest
        if (rec.seq > 8 && mock.requests[rec.seq - 8]?.body !== null) {
          const old = mock.requests[rec.seq - 8]
          if (old !== undefined && old.body !== null) old.body = { __pruned: true, msgCount: old.digest?.msgCount, toolCount: old.digest?.toolCount }
        }
      }
      const text = digest._text
      for (const mode of MODES) {
        const MU = mode.toUpperCase()
        if (text.includes(`${MK}_${MU}_DISC`)) return { kind: 'text', content: 'A5IE_DISC_OK' }
        for (const preset of PRESETS) {
          if (text.includes(`${MK}_${MU}_${preset.toUpperCase()}_SETUP`)) return { kind: 'text', content: 'A5IE_PRESET_OK' }
        }
        if (mode !== 'baseline' && text.includes(`${MK}_${MU}_L0`)) {
          const calls = digest.assistantToolNames
          if (calls.length === 0) return toolCall(`call-r5-delegate-a-${rnd()}`, 'team_delegate', {
            rootSessionId: CREATE_ROOT, requestToken: TK_A1, delegationTemplateId: 'wa', label: 'ie-a',
            taskSummary: 'a5ie-r5 exit/cancel legs (member A)',
            prompt: `${MK}_${MU}_TASK_A Do the delegated work exactly as instructed.`, async: false,
          })
          if (calls.length === 1) return toolCall(`call-r5-collect-a-${rnd()}`, 'team_collect', { rootSessionId: CREATE_ROOT, requestToken: `a5ie-collect-a-${RUN_STAMP}`, requestTokens: [TK_A1] })
          return { kind: 'text', content: 'A5IE_R5_LEADER_DONE' }
        }
        if (mode !== 'baseline' && (text.includes(`${MK}_${MU}_TASK_A`) || text.includes(`${MK}_${MU}_RESUME`))) {
          // content-keyed ladder: the first planned step whose tool_use marker
          // is NOT yet in history is the one to script now.
          const idx = STEPS.findIndex((s) => !text.includes(stepMarker(s)))
          if (idx === -1) {
            const results = digest.toolResults
            const quote = results.map((r, i) => `r${i}=${r.slice(0, 200).replace(/\s+/g, ' ')}`).join(' | ')
            return { kind: 'text', content: `A5IE_R5_MEMBER_RESULT ${quote}` }
          }
          const [name, a] = STEPS[idx]
          if (idx === 6 && (cancelState.armedCount ?? 0) < 2) {
            cancelState.armedCount = (cancelState.armedCount ?? 0) + 1
            if (cancelState.armedAt === 0) {
              cancelState.armedAt = Date.now() + 4_000 // fire the user cancel 4s into the sleep-90
              cancelState.armedNote = `armed when step ${String(idx)} (sleep 90) was scripted`
            }
            // PRIMARY fire: in-process timer at arm time — must not wait for
            // the chain poll (starved ~27s at run 2026-10-18T20-23-56Z). A
            // second arm exists for the R1 shape: if the cancelled step is
            // dropped from history the content-ladder reissues it once, and
            // the reissued sleep deserves its own cancel window too.
            setTimeout(() => { void cancelState.fireHook?.() }, 4_000)
          }
          return toolCall(`call-r5-${String(idx)}-${rnd()}`, name, a)
        }
        if (text.includes(`${MK}_${MU}_RESUME`)) return { kind: 'text', content: 'A5IE_RESUME_OK' }
        if (text.includes(`${MK}_${MU}_L0`)) return { kind: 'text', content: 'A5IE_L0_OK' }
      }
      return { kind: 'text', content: 'a5ie-r5-mock: unscripted request, completing quietly.' }
  }
  let mock = null
  let mockPortUsed = 0
  for (const candidate of [mockPort, 3492, 3493, 3494, 3495, 3496, 3497, 3498, 3499]) {
    if (candidate === 0 || !(await portFree(candidate))) continue
    try {
      mock = await startMockModel({ port: candidate, log: () => { }, decide: mockDecide })
      mockPortUsed = candidate
      break
    } catch (error) {
      if (String(error?.code ?? '') !== 'EADDRINUSE') throw error
    }
  }
  if (mock === null) die(`no 349x mock port could be bound for the LLM stand-in (preflight picked ${String(mockPort)})`)
  memberSessionRef.promise = undefined

  const worlds = {}
  try {
    for (const mode of MODES) worlds[mode] = await runWorld({ mode, mock, MK, blueprintBaseDir: join(EVIDENCE_DIR, 'blueprints'), markers, stormLimit: Number(argValue('storm-limit', 400)), faceReference, face, faceMirror, cancelState, memberSessionRef })
  } finally {
    try { await mock.close() } catch { /* gone */ }
  }
  const porcelainAfter = gitAt(TESTUSE, 'status', '--porcelain')
  const stableAfter = await stableProbe()
  check('H3', ':3080 stable instance untouched (read-only probe before/after) and the test-use host porcelain 0 after',
    String(stableBefore) === String(stableAfter) && porcelainAfter === '', `${String(stableBefore)} -> ${String(stableAfter)}; porcelain=${porcelainAfter === '' ? 0 : 'DIRTY'}`)

  for (const mode of MODES) writeEvidence(`world-${mode}.json`, worlds[mode] ?? { missing: true })
  check('W1', 'both worlds ran on the REAL installed face and were swept',
    MODES.every((w) => worlds[w]?.ok === true), MODES.map((w) => `${w}:${worlds[w]?.ok === true ? 'ok' : 'FAIL'}${worlds[w]?.swept ? '/swept' : '/UNSWEPT'}`).join(' '))

  const a = worlds.installed ?? {}
  const b = worlds.baseline ?? {}
  const aR = a.memberAToolResults ?? []
  const resOf = (w, tool, occ = 1) => {
    const names = w?.memberAToolCallOrder ?? []
    const results = w?.memberAToolResults ?? []
    let seen = 0
    for (let i = 0; i < names.length; i += 1) {
      if (String(names[i]) === tool) { seen += 1; if (seen === occ) return String(results[i] ?? 'LEG-MISSING') }
    }
    return 'LEG-MISSING'
  }
  const wireText = (txt) => {
    try {
      const parsed = JSON.parse(String(txt))
      return Array.isArray(parsed) ? parsed.map((c) => String(c?.text ?? '')).join('\n') : String(txt)
    } catch { return String(txt) }
  }
  const namedFiles = (txt) => wireText(txt).split('\n')
    .filter((l) => l.startsWith('> ') && !l.includes('truncated'))
    .map((l) => l.slice(2).trim())
  const at = (tool, occ = 1) => wireText(resOf(a, tool, occ))

  // ── the r4-b2 shell set, graded again on the new bytes (regression is a claim) ──
  const x1 = at('team_bash', 1)
  const x2 = at('team_bash', 2)
  const a6 = at('team_bash', 3)
  const a7 = at('team_bash', 4)
  const x4s = at('team_grep', 1)
  const x4g = at('team_glob', 1)
  const c1 = at('team_bash', 5) // sleep 90 — cancelled mid-flight by the user
  const c2 = at('team_bash', 6) // kill -9 $$ — launch death, no cancel involved
  const c3 = at('team_glob', 2) // gdeep normal nested walk (glob row has NO settle mounted)
  // R1 read-point hardening (disclosed in the header, NOT a criteria change):
  // the C legs are ALSO located by landing content anywhere in the member's
  // tool-result array — if the interrupted turn reorders/drops entries, the
  // positional read misses a landing that demonstrably exists. readPoint says
  // which read graded each leg. Criteria text above is unchanged.
  const contentPick = (needle, fallback) => {
    const i = aR.findIndex((r) => wireText(r).includes(needle))
    return i === -1 ? { t: fallback, at: 'positional' } : { t: wireText(aR[i]), at: `content@${String(i)}` }
  }
  const c1Pick = contentPick('bash · cancelled', c1)
  const c2Pick = contentPick('bash · exit=137', c2)
  const c3Pick = contentPick('deep.txt', c3)

  check('X1', 'POSITIVE CONTROL `true` (r4-b2 regression): `bash · exit=0` and meta exitCode 0 on the #340 face',
    x1.includes('bash · exit=0') && x1.includes('"exitCode":0'), `landing=${JSON.stringify(x1).slice(0, 220)}`)
  check('X2', 'POSITIVE CONTROL `exit 7` (r4-b2 regression): `bash · exit=7` and meta exitCode 7 on the #340 face',
    x2.includes('bash · exit=7') && x2.includes('"exitCode":7'), `landing=${JSON.stringify(x2).slice(0, 220)}`)
  check('A6', 'team_bash POSITIVE (REAL Landlock): confined run RAN (token on stdout, exit=0) and the inside-root write landed on disk (fs-probed before the sweep)',
    a6.includes(TOK_BASH) && a6.includes('bash · exit=0') && a.bashWroteExists === true && String(a.bashWroteBytes ?? '').includes(BASH_WRITE_MARKER),
    `bash#3=${JSON.stringify(a6).slice(0, 200)} wrote=${String(a.bashWroteExists)} abi=${String(a.launcherAbiPreflight?.kind)}/${String(a.launcherAbiPreflight?.abiVersion)}`)
  check('A7', 'B2 REGRESSION — the out-of-bounds leg STILL carries its real code on the #340 face: `bash · exit=1` + meta exitCode 1 + the kernel-refusal stderr verbatim + the zero-disclosure law (outside marker in neither the result nor the whole world wire)',
    a7.includes('bash · exit=1') && a7.includes('"exitCode":1') && a7.includes('Permission denied') && a7.includes('cat: ../outside/secret.txt') && !a7.includes(OUTSIDE_MARKER) && a.outsideMarkerOnWire === 0,
    `landing=${JSON.stringify(a7).slice(0, 300)} markerOnWire=${String(a.outsideMarkerOnWire)}`)
  check('X4s', 'COMPLETION LAW UNCHANGED (search row): hit answers on the governed meta face, NO exit= / exitCode anywhere — still stream-proven after #340',
    x4s.includes(TOK_GREP) && x4s.includes('a5p5-meta') && x4s.includes('"kind":"search"') && !x4s.includes('exit=') && !x4s.includes('exitCode') && !x4s.includes(IO_TEXT),
    `landing=${JSON.stringify(x4s).slice(0, 240)}`)
  check('X4g', 'COMPLETION LAW UNCHANGED (glob row): the gpos walk still lists its entries, NO exit= / exitCode anywhere',
    x4g.includes('a5p5-meta') && x4g.includes('files_with_matches') && GPOS_SEEDS.every((n) => namedFiles(x4g).some((x) => x.endsWith(n))) && !x4g.includes('exit=') && !x4g.includes('exitCode') && !x4g.includes(IO_TEXT),
    `names=${JSON.stringify(namedFiles(x4g)).slice(0, 160)}`)

  // ── the C family: #340's cancel channel, end-to-end on the installed face ──
  check('C1', 'USER CANCEL END-TO-ON-THE-INSTALLED-FACE (#340): member A ran `sleep 90`; the kit fired the host\'s PUBLIC session/cancel RPC at the member session (resolver handle; receipt in cancel-leg.json); the leg\'s landing must be `bash · cancelled` with meta "cancelled":true — the branch #336 disclosed had no path now has one, on the install, through the governed Team entry',
    cancelState.firedAt > 0 && cancelState.httpStatus >= 200 && cancelState.httpStatus < 300 && c1Pick.t.includes('bash · cancelled') && c1Pick.t.includes('"cancelled":true'),
    `cancelFired=${String(cancelState.firedAt > 0)} http=${String(cancelState.httpStatus)} nudge=${String(cancelState.nudgeStatus)} readPoint=${c1Pick.at} resolver=${String(cancelState.resolverSource)} landing=${JSON.stringify(c1Pick.t).slice(0, 260)}`)
  check('C2', 'LAUNCH DEATH STAYS DEATH (cancelled:false): `kill -9 $$` is a SIGKILL payload death with NO cancel — the row must report the death form (`bash · exit=137`, the shipped waitpid mapping) with meta "cancelled":false; per #338 this claims the SHAPE, not a diagnosis of cause',
    c2Pick.t.includes('bash · exit=137') && c2Pick.t.includes('"cancelled":false'),
    `readPoint=${c2Pick.at} landing=${JSON.stringify(c2Pick.t).slice(0, 240)}`)
  check('C3', 'GLOB WALKER REGRESSION (收流未装 IS the face): a normal nested walk (./gdeep) still answers with its entries and grows NO refusal, NO IO_POLICY, NO cancelled, NO exit= — the race settle is NOT mounted on the glob row, and this leg catches a future mis-mount',
    c3Pick.t.includes('a5p5-meta') && GDEEP_SEEDS.every((n) => namedFiles(c3Pick.t).some((x) => x.endsWith(n.split('/').pop()))) && !c3Pick.t.includes('a5p5-refused') && !c3Pick.t.includes(IO_TEXT) && !c3Pick.t.includes('cancelled') && !c3Pick.t.includes('exit='),
    `readPoint=${c3Pick.at} names=${JSON.stringify(namedFiles(c3Pick.t)).slice(0, 200)}`)
  {
    const ranLines = (a.logObservations ?? []).filter((l) => /confined-shell ran\b/i.test(l))
    const sawExit = (n) => ranLines.some((l) => new RegExp(`confined-shell ran\\b.*exit=${String(n)}\\b`).test(l))
    const anchoredGlobRan = (a.logObservations ?? []).filter((l) => /anchored-glob ran\b/.test(l)).length
    const anchoredSearchOk = (a.logObservations ?? []).filter((l) => /anchored-search OK\b/.test(l)).length
    check('A9', 'host-log witnesses (provider\'s own lines): placement-feed + confined capability + one "confined-shell ran … exit=<n>" per completed shell leg with the non-zero legs witnessed NON-ZERO (exit=7 and exit=1 lines), plus the glob/search per-call rows. The cancelled leg\'s observation shape is #340 semantics — recorded in instance-installed.log, NOT asserted here (disclosed).',
      (a.logObservations ?? []).some((l) => /placement-feed rows=\[/.test(l))
      && (a.logObservations ?? []).some((l) => /confined-shell capability/.test(l))
      && ranLines.length >= 5 && sawExit(7) && sawExit(1)
      && anchoredGlobRan >= 2 && anchoredSearchOk >= 1,
      `confinedShellRan=${String(ranLines.length)} saw7=${String(sawExit(7))} saw1=${String(sawExit(1))} anchoredGlobRan=${String(anchoredGlobRan)} anchoredSearchOk=${String(anchoredSearchOk)}`)
  }

  // ── zero expansion / closed world ─────────────────────────────────────────
  const setDiff = (x, y) => (Array.isArray(x) ? x : []).filter((n) => !(Array.isArray(y) ? y : []).includes(n))
  {
    const preset = PRESETS[0]
    const regDelta = setDiff(a[preset]?.scopedNames, b[preset]?.scopedNames)
    const wireDelta = setDiff(a[preset]?.wireCatalog, b[preset]?.wireCatalog)
    const clean = (a[preset]?.scopedNames ?? []).filter((n) => n.startsWith('team_')).length === 0 && (a[preset]?.wireCatalog ?? []).filter((n) => n.startsWith('team_')).length === 0
    check('Z2', `ZERO EXPANSION: the ${preset} NON-team session on the assembled installed boot shows registry-vs-baseline Δ=[] AND wire-vs-baseline Δ=[] AND zero team_ aliases — while the SAME boot runs live governed backends`,
      regDelta.length === 0 && wireDelta.length === 0 && clean && Array.isArray(a[preset]?.scopedNames) && Array.isArray(b[preset]?.scopedNames), `regΔ=${JSON.stringify(regDelta)} wireΔ=${JSON.stringify(wireDelta)}`)
  }
  check('Z3', `no IO_POLICY_UNSUPPORTED landing on ANY of the ${String(STEPS.length)} driven legs, and no module/bootstrap error in the installed world log`,
    aR.length === STEPS.length && aR.filter((r) => String(r).includes(IO_TEXT)).length === 0 && (a.hostErrors ?? []).length === 0,
    `legs=${String(aR.length)} ioPolicyLegs=${String(aR.filter((r) => String(r).includes(IO_TEXT)).length)} hostErrors=${JSON.stringify((a.hostErrors ?? []).slice(0, 2)).slice(0, 200)}`)
  check('Z4', 'the plane reached the model-facing wire on the governed member (catalog carries the three aliases plus the read takeover)',
    ALIASES.every((n) => (a.memberAWireCatalog ?? []).includes(n)) && (a.memberAWireCatalog ?? []).includes('read'),
    `member plane names=${JSON.stringify([...new Set((a.memberAWireCatalog ?? []).filter((n) => n.startsWith('team_') || n === 'read'))])}`)

  // ── the cross-record: r3 exit=0 → r4 exit=1 → r5 still exit=1 ─────────────
  {
    const histPath = join(HERE, 'b2-history-a5ie-r3-r4.txt')
    const hist = existsSync(histPath) ? readFileSync(histPath, 'utf8') : '(missing)'
    writeEvidence('b2-exit-cross.json', {
      runStamp: RUN_STAMP, installedSha: INSTALL_SHA,
      historicalVerbatim: hist,
      r5Landings: { 'X1': x1.slice(0, 300), 'X2': x2.slice(0, 300), 'A6': a6.slice(0, 300), 'A7': a7.slice(0, 300), 'C1': c1.slice(0, 300), 'C2': c2.slice(0, 300), 'X4s': x4s.slice(0, 300), 'X4g': x4g.slice(0, 300), 'C3': c3.slice(0, 300) },
    })
    check('B2X', 'the B2 chain holds on the #340 face: the r3 (exit=0 defect) and r4 (exit=1 fix) records sit VERBATIM in b2-history-a5ie-r3-r4.txt, and this round\'s out-of-bounds leg still lands exit=1 — the fix survives the cancel-round merge',
      hist.includes('bash · exit=0') && hist.includes('bash · exit=1') && a7.includes('bash · exit=1'),
      `histBytes=${String(hist.length)} r5A7exit1=${String(a7.includes('bash · exit=1'))}`)
  }
  note('C1-SHAPE', 'the cancelled leg\'s full landing + the cancel RPC receipt (cancel-leg.json: armed/fired/http/nudge + the observer-resolved member session) are recorded whatever C1 grades — the settle shape on the wire, the host log, and the post-cancel turn are all retained for reading', `fired=${String(cancelState.firedAt > 0)}`)
  note('B1', 'carried: the fail-closed lane was exercised once (a5ie-r2b dev3, wrong deployment bytes); I9 + confined-shell witnesses are this round\'s counter-evidence', `abi=${String(a.launcherAbiPreflight?.kind)}/${String(a.launcherAbiPreflight?.abiVersion)}`)

  // ── teardown (T family) ───────────────────────────────────────────────────
  if (!KEEP) { try { rmSync(faceMirror, { recursive: true, force: true }) } catch { /* best effort */ } }
  if (!KEEP) { try { rmSync(INSTALL_HOME, { recursive: true, force: true }) } catch { /* best effort */ } }
  const homesRoot = join(WORKTREE, 'tests', 'homes')
  const leftHomes = existsSync(homesRoot) ? readdirSync(homesRoot).filter((d) => d.startsWith(`${WORLD_PREFIX}-`)) : []
  check('T1', `world + install-dir cleanup: no ${WORLD_PREFIX}-* DSH_HOME (or lock) remains under tests/homes; the byte manifest is the retained evidence`,
    leftHomes.length === 0 && !existsSync(INSTALL_HOME), `homes=${JSON.stringify(leftHomes)} installHome=${String(!existsSync(INSTALL_HOME))}`)
  const rawLeft = MODES.filter((w) => existsSync(join(EVIDENCE_DIR, `instance-${w}.raw.log`)))
  check('T2', 'launch-token hygiene: raw instance logs deleted after redaction at capture', rawLeft.length === 0, `rawLeft=${JSON.stringify(rawLeft)}`)
  const portsReleased = (await portFree(HOST_PORT)) && (await portFree(BASELINE_PORT)) && (await portFree(mockPortUsed))
  check('T3', 'ports released after the run (host 318x pair + the 349x mock port self-prove free again)', portsReleased, `ports=${String(HOST_PORT)}/${String(BASELINE_PORT)}/${String(mockPortUsed)} free=${String(portsReleased)}`)

  writeEvidence('criteria.json', {
    runStamp: RUN_STAMP, ports: [HOST_PORT, BASELINE_PORT, mockPortUsed], installSpec: INSTALL_SPEC, installedSha: INSTALL_SHA,
    worktreeHead, testuse: { dir: TESTUSE, head, porcelainAfter }, storeDir: STORE_DIR,
    installedFileCount: face.expected.length, criteria: CRITERIA,
  })
  // The leg ledger: one line per criterion — {leg, verdict, receipts[], wire}.
  {
    const receiptMap = {
      I9: ['launcher-deployment.json'], I8: ['launcher-deployment.json'],
      I11: ['install-manifest.json', 'installed-token-carriers.json'], I12: ['installed-token-carriers.json', 'install-manifest.json'],
      I10: ['install-manifest.json'],
      'W.installed.install': ['install-installed.log'], 'W.baseline.install': ['install-baseline.log'],
      X1: ['wire-digests-installed.jsonl'], X2: ['wire-digests-installed.jsonl'], A6: ['wire-digests-installed.jsonl', 'world-installed.json'],
      A7: ['wire-digests-installed.jsonl'], X4s: ['wire-digests-installed.jsonl'], X4g: ['wire-digests-installed.jsonl'],
      C1: ['wire-digests-installed.jsonl', 'cancel-leg.json'], C2: ['wire-digests-installed.jsonl'], C3: ['wire-digests-installed.jsonl'],
      A9: ['instance-installed.log'], B2X: ['b2-exit-cross.json', 'b2-history-a5ie-r3-r4.txt'],
      Z2: ['world-installed.json', 'world-baseline.json'], Z3: ['world-installed.json'], Z4: ['wire-digests-installed.jsonl'],
    }
    const lines = CRITERIA.map((x) => JSON.stringify({
      leg: x.id,
      verdict: x.pass === true ? 'PASS' : (x.pass === null || x.pass === undefined ? 'BOOK' : 'FAIL'),
      receipts: ['criteria.json', ...(receiptMap[x.id] ?? [])],
      wire: String(x.observed ?? '').replace(/\s+/g, ' ').slice(0, 160),
    }))
    writeFileSync(join(EVIDENCE_DIR, 'leg-ledger.jsonl'), lines.join('\n') + '\n')
  }
  const red = CRITERIA.filter((c) => c.pass === false)
  console.log(`VERDICT ${red.length === 0 ? 'GREEN' : `RED (${red.map((c) => c.id).join(',')})`} (${CRITERIA.filter((c) => c.pass === true).length}/${CRITERIA.filter((c) => c.pass !== null).length}${CRITERIA.some((c) => c.pass === null) ? ` +${String(CRITERIA.filter((c) => c.pass === null).length)} booked` : ''})`)
  process.exit(red.length === 0 ? 0 : 2)
}

main().then(
  () => process.exit(0),
  async (error) => {
    console.log(`FATAL ${redact(String(error?.stack ?? error)).split('\n').slice(0, 10).join(' | ')}`)
    writeEvidence('fatal.json', { error: redact(String(error?.message ?? error)), criteriaSoFar: CRITERIA })
    process.exit(1)
  },
)
