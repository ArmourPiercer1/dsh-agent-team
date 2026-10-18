#!/usr/bin/env node
/**
 * a5ie-r2b-kit.mjs — FINAL-INSTALL ACCEPTANCE REHEARSAL on the CURRENT master form.
 *
 * What is under test here is NOT an expansion mirror and NOT a worktree dist:
 * every live leg boots a host whose Team row comes from a package that the
 * pinned pristine host ITSELF installed through its public package face —
 *
 *   dsh plugin --profile web add github:ArmourPiercer1/dsh-agent-team#<master-sha>
 *
 * into a NEW install directory (a fresh DSH_HOME's `profiles/web`, with the
 * profile's pnpm store pinned to a workspace-local `.pnpm-store-*` through the
 * profile's own `pnpm-workspace.yaml` `storeDir:` setting — the only channel
 * that works on this host: a repo `.npmrc` and `PNPM_STORE_PATH` are NOT read
 * by pnpm 11 for this, recorded in the earlier install-entry round).
 *
 * PHASES
 *  H  environment pins: pinned pristine test-use runtime (porcelain 0 before
 *     AND after), 318x ports self-proved free before / released after, the
 *     stable :3080 instance probed read-only before and after (never touched).
 *  I  the real install, into a NEW install dir, strict-manifest form:
 *     I1 the CLI add exits 0; I2 the profile declares EXACTLY this repo's one
 *     plugin (dependencies == {dsh-agent-team}) and the reconciler appended its
 *     bundle row; I3 the installed tree equals the declared `files:` face with
 *     THREE ZEROS (missing 0 / extra 0 / sha-mismatch 0) plus count equality;
 *     I4 the installed bundle layer is machine-agnostic (no file:/abs paths);
 *     I5 `--dump-config` on the installed profile composes the Team row
 *     (`dsh-agent-team/host`) with this round's config — public seam only;
 *     I6 the repo drift gate grades the committed dist at HEAD (exit 0);
 *     I8 DISCLOSED FACE GAP: the confined provider's Landlock pre-launcher is
 *     NOT on the published face (tsc never emits `.py`), so the installer must
 *     supply it — this round materializes it from the SAME commit into the
 *     world and byte-pins it, exactly as INSTALL §3.5 documents it as a
 *     deployment input.
 *     I9 the supplied deployment bytes are PROVEN right before any host exists
 *     (commit-blob equality + worktree equality + `#!` + a direct ABI answer),
 *     because pinning wrongly-extracted bytes still passes a self-consistent
 *     byte-pin and only shows up later as an opaque SANDBOX_UNAVAILABLE.
 *  L  the ordinary Team entry, three worlds, one run, mock ONLY at the LLM
 *     position (a real governed Team: team.create + Leader delegation + members):
 *       installed    teamToolPlane = {realmId, fsInstance, confinedProvider}
 *                    (the public row-config seam, same row id as the installed
 *                    bundle layer — zero hand-written assembly, zero private API):
 *                    A1 read POSITIVE (real governed bytes on the wire)
 *                    A2 read CROSS-ROOT NEGATIVE (verbatim anchor refusal, zero bytes)
 *                    A3 grep POSITIVE (anchored search hits the token over the wire)
 *                    A4 grep ABSOLUTE NEGATIVE (absent pattern → honest zero-hit
 *                       answer, never a refusal, never a fabricated hit)
 *                    A5 grep ANCHORED NEGATIVE (a marker that exists only OUTSIDE
 *                       the root never surfaces; zero hits inside)
 *                    A6 bash POSITIVE confined (REAL Landlock: token + exit=0 and
 *                       a write inside the governed root lands on disk)
 *                    A7 bash OUT-OF-BOUNDS kernel refusal (reading outside every
 *                       allowPath = `Permission denied` from the kernel; the
 *                       outside marker bytes NEVER appear anywhere on the wire)
 *                    A8 glob row CURRENT FORM, booked VERBATIM: on this commit
 *                       the row is TYPED-SHUT, and the refusal lands verbatim
 *                    A9 the assembly's own witness rows in the host log
 *                    D1 deny lane before any backend + sentinel NEVER created
 *       preassembly  teamToolPlane = {realmId} ONLY — the three verbatim
 *                    RED postures live (P1 read BINDING_UNVERIFIED, P2/P3 the
 *                    typed IO_POLICY_UNSUPPORTED shut landings)
 *       baseline     NO teamToolPlane — control of controls: zero plane aliases,
 *                    zero plane observations; and the non-team preset session
 *                    shows registry Δ=[] ∧ wire Δ=[] (Z1/Z2).
 *     G1 books the glob situation honestly: the flip (#333) is NOT on this
 *     commit, so the post-flip glob positive/negative controls are recorded as
 *     PENDING-#333 RE-RUN and are never counted green here.
 *  C  teardown: no world or install dir remains, ports released, launch tokens
 *     redacted at capture and the raw logs deleted.
 *
 * Honesty rules: every criterion is computed from LIVE wire captures, fs probes,
 * the redacted instance log and the installed bytes AT OBSERVATION TIME; a
 * missing leg FAILS; nothing is inferred from the source tree when the wire can
 * be read. EXIT: 0 GREEN · 2 a criterion failed (RED) · 1 fatal.
 *
 * @module evidence/alpha5/a5ie-r2b/a5ie-r2b-kit
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
const ONLY = argValue('only', '')
const HERE = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(argValue('worktree', resolve(HERE, '..', '..', '..', '..', '..')))
const RUN_STAMP = new Date().toISOString().slice(0, 19).replace(/:/g, '-') + 'Z'
const EVIDENCE_DIR = resolve(argValue('evidence-dir', join(HERE, 'runs', RUN_STAMP)))
mkdirSync(EVIDENCE_DIR, { recursive: true })

const HOST_PORT = Number(argValue('port', 3183))
const BASELINE_PORT = Number(argValue('baseline-port', 3184))
const INSTALL_SPEC = `github:ArmourPiercer1/dsh-agent-team#${gitAt(resolve(argValue('install-src', WORKTREE)), 'rev-parse', 'HEAD')}`
const INSTALL_SHA = INSTALL_SPEC.split('#')[1]
const STORE_DIR = resolve(argValue('store-dir', join(WORKTREE, '..', '..', '.pnpm-store-a5ie-r2b')))
const TESTUSE = resolve(argValue('testuse', '') !== '' ? resolve(argValue('testuse', '')) : testUseTree(WORKTREE))
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const OBSERVER_ROW_NAME = pathToFileURL(join(HERE, '..', 'install-entry', 'a5ie-observer-row.mjs')).href
const WORLD_PREFIX = 'a5ie-r2b'
const PRESET_ID = 'a5ie-r2b-base'
const MODES = ['installed', 'preassembly', 'baseline']
const PRESETS = ['standard']
const ALIASES = ['team_grep', 'team_glob', 'team_bash']
const WATCH_NAMES = [...ALIASES, 'read']
const MANAGED_TOOL_NAMES = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh']
const SAFE_UNMANAGED_TOOL_NAMES = ['todo_write']
const ROOT = 'a5ie-r2b-root'
const CREATE_ROOT = `session-a5ie-r2b-team-${RUN_STAMP}`
const BP_MAIN_ID = 'a5ie-r2b-main-bp'
const BP_ANCHOR_ID = 'a5ie-r2b-anchor-bp'
const TK_D1 = 'a5ie-r2b-tok-d1'
const TK_D2 = 'a5ie-r2b-tok-d2'
// Fixture literals. The OUTSIDE marker is deliberately NOT equal to any pattern
// the script searches for: the anchored-negative leg then stays falsifiable —
// a leaked hit would print the full marker, while the searched prefix alone is
// legitimately visible in the transcript as the model's own tool argument.
const TOK_READ = 'A5IE-R2B-READ-TOKEN-77'
const TOK_GREP = 'A5IE-R2B-GREP-TOK'
const TOK_GREP_ABSENT = 'A5IE-R2B-PATTERN-NOWHERE-4242'
const OUTSIDE_PREFIX = 'A5IE-R2B-OUTSIDE-ONLY'
const OUTSIDE_MARKER = 'A5IE-R2B-OUTSIDE-ONLY-MARKER-9182'
const TOK_BASH = 'A5IE-R2B-BASH-TOK'
const BASH_WRITE_MARKER = 'A5IE-R2B-WROTE-9'
const SENTINEL = 'sentinel-wd-must-not-exist'

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
    srv.once('listening', () => srv.close(() => res(true)))
    srv.listen(port, '127.0.0.1')
  })
}
async function portFreeWait (port, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    if (await portFree(port)) return true
    if (Date.now() >= deadline) return false
    await new Promise((r) => setTimeout(r, 500))
  }
}
async function waitQuiet (deadlineMs, fn) {
  const deadline = Date.now() + deadlineMs
  for (;;) {
    const v = await fn()
    if (v !== null && v !== undefined && v !== false) return v
    if (Date.now() >= deadline) return null
    await new Promise((r) => setTimeout(r, 400))
  }
}
async function waitFor (deadlineMs, fn, what) {
  const deadline = Date.now() + deadlineMs
  for (;;) {
    const v = await fn()
    if (v !== null && v !== undefined && v !== false) return v
    if (Date.now() >= deadline) die(`timeout waiting for ${what}`)
    await new Promise((r) => setTimeout(r, 250))
  }
}
async function waitQuietTolerant (deadlineMs, fn) {
  return await waitQuiet(deadlineMs, fn)
}
const sha256File = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
const sha256Text = (s) => createHash('sha256').update(s).digest('hex')
function walkFiles (dir, base = dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walkFiles(p, base, out)
    else if (e.isFile()) out.push(p.slice(base.length + 1))
    else out.push(`NOT-A-FILE:${p.slice(base.length + 1)}`)
  }
  return out.map((p) => p.split('\\').join('/'))
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
/** The declared install face of a commit: root `files:` + the pack rules that
 *  always add the manifest and top-level document files. Nothing else. */
function declaredFace (srcWorktree, sha) {
  const pkg = JSON.parse(spawnSync('git', ['-C', srcWorktree, 'show', `${sha}:package.json`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).stdout)
  const files = (pkg.files ?? []).map((f) => f.replace(/^\.\//, '').replace(/\/$/, ''))
  const ls = spawnSync('git', ['-C', srcWorktree, 'ls-tree', '-r', '--name-only', '-z', sha], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 })
  if (ls.status !== 0) die(`git ls-tree failed: ${String(ls.stderr).slice(0, 200)}`)
  const tree = ls.stdout.split('\0').filter((s) => s !== '')
  const under = (p) => files.some((f) => p === f || p.startsWith(`${f}/`))
  const docish = (p) => !p.includes('/') && /^(readme|license|licence|changelog|changes|history|notice)(\..*)?$/i.test(p)
  const declared = tree.filter(under)
  const packAdditions = tree.filter((p) => !under(p) && (p === 'package.json' || docish(p)))
  return { files, declared, packAdditions, expected: [...declared, ...packAdditions] }
}
/** The declared face materialized from the commit itself (git archive — the
 *  same content the package manager had to ship), as a local byte reference. */
function materializeDeclaredFace (srcWorktree, sha, face) {
  const mirror = join(EVIDENCE_DIR, 'declared-face-mirror')
  mkdirSync(mirror, { recursive: true })
  const arch = spawnSync('git', ['-C', srcWorktree, 'archive', sha, '--', ...face.expected], { maxBuffer: 512 * 1024 * 1024 })
  if (arch.status !== 0) die(`git archive of the declared face failed: ${String(arch.stderr).slice(0, 200)}`)
  const tar = spawnSync('tar', ['-x', '-C', mirror], { input: arch.stdout })
  if (tar.status !== 0) die(`tar expand of the declared face failed: ${String(tar.stderr).slice(0, 200)}`)
  return mirror
}

/** Compare an installed package directory against the declared face, byte-exact. */
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
    missing,
    extra,
    shaMismatch,
    rootSha: sha256Text(manifest.map((m) => `${m.path} ${m.sha256}`).join('\n')),
    manifest,
  }
}

// ═════════════════════════ THE REAL INSTALL (public package face) ════════════
function profileWorkspaceYaml () {
  // pnpm 11 reads its settings from pnpm-workspace.yaml (NOT .npmrc), and the
  // DSH plugin CLI forwards our arguments verbatim to pnpm without a channel
  // for --store-dir, so the profile's own `storeDir:` setting is the one
  // public way to keep the content-addressable store inside the workspace
  // (workspace-write sandbox; the earlier install-entry round recorded that
  // `.npmrc` and PNPM_STORE_PATH do not take effect).
  return `packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\nstoreDir: ${STORE_DIR}\n`
}
function realInstall ({ world, logName }) {
  const profileDir = join(world, 'profiles', 'web')
  mkdirSync(profileDir, { recursive: true })
  writeFileSync(join(profileDir, 'pnpm-workspace.yaml'), profileWorkspaceYaml())
  const t0 = Date.now()
  const r = spawnSync(process.execPath, [HOST_BIN, 'plugin', '--profile', 'web', 'add', INSTALL_SPEC], {
    cwd: join(world, 'workspace'),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: 900_000,
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
    profileDir,
    manifest,
    nodeModulesTop: existsSync(nmDir) ? readdirSync(nmDir).filter((n) => !n.startsWith('.')).sort() : [],
    installedDir: join(profileDir, 'node_modules', 'dsh-agent-team'),
    outputTail: redact(out).split('\n').filter((l) => l.trim() !== '').slice(-8).join(' | ').slice(0, 600),
  }
}

/**
 * Materialize the confined provider's deployment input (the trusted
 * pre-launcher) from the INSTALLED COMMIT, at the given destination.
 *
 * `git show <sha>:<path>` streams the BLOB; `git archive` would stream a tar
 * container (a header + payload), whose bytes are NOT the script — pinning the
 * provider to those bytes makes its own ABI probe answer "no landlock ABI" and
 * the provider fail closed. This round hit exactly that (recorded in the run
 * log), so the extraction goes through `git show` and the result is asserted
 * byte-identical to the commit blob, to the working tree at HEAD, and to a
 * `#!`-leading script.
 */
function materializeLauncher (srcWorktree, sha, destPath) {
  const rel = 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py'
  const blob = spawnSync('git', ['-C', srcWorktree, 'show', `${sha}:${rel}`], { maxBuffer: 64 * 1024 * 1024 })
  if (blob.status !== 0) die(`git show of the launcher blob failed: ${String(blob.stderr).slice(0, 200)}`)
  mkdirSync(dirname(destPath), { recursive: true })
  writeFileSync(destPath, blob.stdout)
  const blobSha = sha256Text(blob.stdout)
  const worktreeSha = sha256File(join(srcWorktree, rel))
  return {
    rel,
    path: destPath,
    sha: blobSha,
    worktreeSha,
    bytesMatchCommitAndWorktree: blobSha === worktreeSha,
    isScript: blob.stdout.slice(0, 2).toString('utf8') === '#!',
    bytes: blob.stdout.length,
  }
}

/** The kit's own witness that the deployment bytes really are a runnable
 *  pre-launcher: ask IT for its ABI verdict before any host exists. */
function launcherAbiPreflight (launcherPath) {
  const r = spawnSync('python3', [launcherPath, '--abi-probe'], { encoding: 'utf8', timeout: 30_000 })
  const line = String(r.stdout ?? '').trim().split('\n').filter((l) => l !== '').pop() ?? ''
  let parsed = null
  try { parsed = JSON.parse(line) } catch { parsed = null }
  return {
    rc: r.status,
    error: r.error === undefined ? null : String(r.error.message ?? r.error).slice(0, 160),
    answer: line.slice(0, 240),
    kind: parsed?.kind ?? null,
    abiVersion: typeof parsed?.abi_version === 'number' ? parsed.abi_version : null,
  }
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
  'leader:', '  templateId: leader', '  persona: "You are the leader of the a5ie-r2b install team."',
  'members:', '  - templateId: wa', '    persona: "You are a worker of the a5ie-r2b install team."',
  'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
  'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
].join('\n')

/**
 * The governed blueprint: member `wa` (ask-default, read allowed, NO shell rule
 * — the shell reaches the backend through the ASK default exactly as shipped
 * governed worlds do) and member `wd` (shell DENIED by rule — the deny leg).
 */
function mainBlueprintYaml (denyList, mkTaskA, mkTaskD, mode) {
  const denyBlock = (pad) => denyList.length === 0 ? [`${pad}builtinToolDeny: []`] : [`${pad}builtinToolDeny:`, ...denyList.map((n) => `${pad}  - ${n}`)]
  const taskA = `${mkTaskA} Work EXACTLY in this order, one tool call per turn: (1) tool read with {"file_path":"notes.txt"}; (2) tool read with {"file_path":"../outside/secret.txt"}; (3) tool team_grep with {"pattern":"${TOK_GREP}","path":".","output_mode":"content"}; (4) tool team_grep with {"pattern":"${TOK_GREP_ABSENT}","path":".","output_mode":"content"}; (5) tool team_grep with {"pattern":"${OUTSIDE_PREFIX}","path":".","output_mode":"content"}; (6) tool team_bash with {"command":"echo ${TOK_BASH}; echo ${BASH_WRITE_MARKER} > ./bash-wrote.txt; cat ./bash-wrote.txt"}; (7) tool team_bash with {"command":"cat ../outside/secret.txt"}; (8) tool team_glob with {"pattern":"*"}; then (9) finish with ONE line starting A5IE_R2B_MEMBER_RESULT quoting each of the eight tool results you received.`
  const taskD = `${mkTaskD} Work EXACTLY in this order: (1) call the tool team_bash with arguments {"command":"touch ./${SENTINEL}"}; (2) finish with ONE line starting A5IE_R2B_DENY_RESULT quoting the tool result you received.`
  const benign = 'You are the leader of the a5ie-r2b install team. Your only directive is to reply with the single word OK. Do not call any tool.'
  const leaderPersona = `You are the leader of the a5ie-r2b install team. On your directive: FIRST call team_delegate exactly once with rootSessionId ${CREATE_ROOT}, requestToken ${TK_D1}, delegationTemplateId "wa", label "ie-a", async false, and the prompt ${JSON.stringify(taskA)}; SECOND call team_collect with rootSessionId ${CREATE_ROOT} and requestTokens ["${TK_D1}"]; THIRD call team_delegate exactly once with rootSessionId ${CREATE_ROOT}, requestToken ${TK_D2}, delegationTemplateId "wd", label "ie-d", async false, and the prompt ${JSON.stringify(taskD)}; FOURTH call team_collect with rootSessionId ${CREATE_ROOT} and requestTokens ["${TK_D2}"]; FIFTH finish with one line starting A5IE_R2B_LEADER_DONE.`
  void mode
  return [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
    'displayName: "a5ie-r2b install-acceptance team"',
    'description: "a5ie-r2b: the ordinary governed Team entry driven through the REAL installed plugin face (dsh plugin add github:…), mock only at the LLM position."',
    'leader:', '  templateId: leader',
    `  persona: ${JSON.stringify(mode === 'baseline' ? benign : leaderPersona)}`,
    '  capabilities:', '    teamTools:', '      kind: allow', '      items:', '        - team_delegate', '        - team_collect',
    ...denyBlock('    '),
    '    skills:', '      kind: allow', '      items: []',
    '    mcp:', '      kind: allow', '      items: []',
    '    permissions:', '      default: ask', '      allow: []', '      ask: []', '      deny: []',
    'teamEnvelope:', '  allow:', '    - assign-task', '    - create-member', '    - send-message', '    - report-progress', '  deny: []',
    'members:',
    '  - templateId: wa', '    displayName: "a5ie-r2b worker A (ask-default shell)"',
    '    persona: "You are worker A of the a5ie-r2b install team. Follow delegated work exactly, tool by tool, in order."',
    '    capabilities:', '      teamTools:', '        kind: allow', '        items: []',
    ...denyBlock('      '),
    '      skills:', '        kind: allow', '        items: []',
    '      mcp:', '        kind: allow', '        items: []',
    '      permissions:', '        default: ask',
    '        allow:', '          - tool: read', '            resource:', '              kind: any',
    '        ask: []', '        deny: []',
    '  - templateId: wd', '    displayName: "a5ie-r2b worker D (shell denied)"',
    '    persona: "You are worker D of the a5ie-r2b install team. Follow delegated work exactly, tool by tool, in order."',
    '    capabilities:', '      teamTools:', '        kind: allow', '        items: []',
    ...denyBlock('      '),
    '      skills:', '        kind: allow', '        items: []',
    '      mcp:', '        kind: allow', '        items: []',
    '      permissions:', '        default: ask',
    '        allow:', '          - tool: read', '            resource:', '              kind: any',
    '        ask: []',
    '        deny:', '          - tool: bash', '            resource:', '              kind: any',
    'memberEnvelopes:',
    '  - templateId: wa', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
    '  - templateId: wd', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
    'permissionMutationEnvelope:', '  rules: []', 'teamHardEnvelope:', '  rules: []',
    'requirements:', '  - domain: persona', '    name: standard',
    'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')
}

/** The row config, mounted as an id-targeted override of the INSTALLED bundle
 *  row through the profile's own cordis.patch.yml (public seam; INSTALL §3.2 +
 *  §3.5). No file: URL, no hand-written assembly, no private API. */
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
    staticModel: { provider: 'deepseek-official', model: 'a5ie-r2b-model' },
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
  if (mode === 'preassembly') cfg.teamToolPlane = { realmId: `a5ie-r2b-realm-${mode}` }
  if (mode === 'installed') {
    cfg.teamToolPlane = {
      realmId: 'a5ie-r2b-realm',
      fsInstance: { fs: 'a5ie-r2b-ctl', rootDir: world.governedRoot, realmId: 'a5ie-r2b-realm', kind: 'absolute-path' },
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
        toolResults.push(rep.slice(0, 2400))
        text += '\u0001tool_result:' + rep
      }
    }
  }
  const users = msgs.filter((m) => m?.role === 'user')
  const lastUser = users.length > 0 ? users[users.length - 1] : null
  const lastUserHead = String(typeof lastUser?.content === 'string' ? lastUser.content : JSON.stringify(lastUser?.content ?? '')).slice(0, 260)
  return { msgCount: msgs.length, toolCount: toolNames === null ? 0 : toolNames.length, toolNames, assistantToolNames, toolResults, lastUserHead, systemHead: sys.slice(0, 260), markerHits: [], _text: text }
}

// ═══════════════════════════════ WORLD DRIVER ════════════════════════════════
async function runWorld ({ mode, mock, MK, blueprintBaseDir, markers, stormLimit, faceReference, face, faceMirror }) {
  const HOME = homeDir(WORKTREE, `${WORLD_PREFIX}-${mode}-${RUN_STAMP}`)
  const BLUEPRINT_DIR = join(blueprintBaseDir, mode)
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  const INSTANCE_RAW = join(EVIDENCE_DIR, `instance-${mode}.raw.log`)
  const INSTANCE_LOG = join(EVIDENCE_DIR, `instance-${mode}.log`)
  const world = {
    governedRoot: join(HOME, 'workspace', 'governed'),
    outsideSecret: join(HOME, 'workspace', 'outside', 'secret.txt'),
    sentinel: join(HOME, 'workspace', 'governed', SENTINEL),
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
    writeFileSync(join(world.governedRoot, 'notes.txt'), `line one\n${TOK_READ}\nline three\n${TOK_GREP} lives here\n`)
    writeFileSync(world.outsideSecret, `${OUTSIDE_MARKER}\n`)

    // ── the real install into THIS world's own profile (new install dir) ──
    const install = realInstall({ world: HOME, logName: `install-${mode}.log` })
    facts.install = { exit: install.exit, seconds: install.seconds, nodeModulesTop: install.nodeModulesTop, dependencies: Object.keys(install.manifest?.dependencies ?? {}), bundles: install.manifest?.dsh?.profile?.bundles ?? [] }
    const m = measureInstalledFace(install.installedDir, face, faceMirror)
    const sameBytes = faceReference.fromProbe === false ? true : m.rootSha === faceReference.rootSha
    facts.installedFace = { expectedCount: m.expectedCount, actualCount: m.actualCount, missing: m.missing.length, extra: m.extra.length, shaMismatch: m.shaMismatch.length, rootSha: m.rootSha }
    check(`W.${mode}.install`, `the ${mode} world booted on a REAL installed face with three zeros (missing/extra/sha)${faceReference.fromProbe === false ? '' : ' and the same bytes as the measured install probe'}`,
      install.exit === 0 && m.missing.length === 0 && m.extra.length === 0 && m.shaMismatch.length === 0 && sameBytes,
      `exit=${String(install.exit)} n=${String(m.actualCount)}/${String(m.expectedCount)} miss=${String(m.missing.length)} extra=${String(m.extra.length)} sha≠=${String(m.shaMismatch.length)} rootSha=${m.rootSha.slice(0, 12)}${faceReference.fromProbe === false ? '' : m.rootSha === faceReference.rootSha ? '==probe' : '!=probe'}`)

    // ── the confined provider's launcher, as a deployment input (I8/I9) ──
    const launcherPath = join(world.deployment, 'landlock-prelauncher.py')
    const launcher = materializeLauncher(WORKTREE, INSTALL_SHA, launcherPath)
    const preflight = launcherAbiPreflight(launcherPath)
    facts.launcher = launcher
    facts.launcherAbiPreflight = preflight

    // ── the profile's own patch layer: SAME row id as the installed bundle,
    //    plus the kit observer row and the preset declaration row ──
    const basePlugins = smokePresetPlugins({
      personaText: 'You are a coding agent powered by the {{model}} model.',
      cwdSuffix: 'Your working directory is {{cwd}}.',
      bashDescription: 'Run commands in a bash shell. State is persistent across calls.',
    })
    const cfg = rowConfig(mode, BLUEPRINT_DIR, world, launcher)
    const lines = [
      `# a5ie-r2b live layer (run ${RUN_STAMP}, mode ${mode}): config override on the INSTALLED bundle row id "dsh-agent-team" + observer row + preset — public profile-patch seam only (INSTALL §3.2/§3.5).`,
      '- id: dsh-agent-team',
      '  name: dsh-agent-team/host',
      '  config:',
      ...Object.entries(cfg).flatMap(([k, v]) => yamlEmit(k, v, 2)),
      ...['- insert:', ...yamlEmitItem({ id: 'a5ie-r2b-observer', name: OBSERVER_ROW_NAME, config: {} }, 1)],
      ...['- insert:', ...yamlEmitItem(presetDeclarationRow({
        id: PRESET_ID, displayName: 'a5ie-r2b base',
        description: `a5ie-r2b base preset (run ${RUN_STAMP}) = smoke preset`,
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
        DEEPSEEK_API_KEY: 'a5ie-r2b-mock-key',
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
    const bpText = mainBlueprintYaml(denyList, `${MK}_${mode.toUpperCase()}_TASK_A`, `${MK}_${mode.toUpperCase()}_TASK_D`, mode)
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
      const chain = await waitFor(600_000, async () => {
        stormCheck('leader chain')
        const reqs = (mock.requests ?? []).filter((r) => r.digest?.markerHits.includes(`${MK}_${mode.toUpperCase()}_L0`) && r.digest.toolCount > 0)
        if (reqs.length === 0) return false
        const doneReplied = reqs.some((r) => JSON.stringify(r.reply ?? '').includes('A5IE_R2B_LEADER_DONE'))
        if (!doneReplied) return false
        const last = reqs[reqs.length - 1]
        return { toolCalls: last.digest.assistantToolNames, backToLeader: last.digest._text.includes('A5IE_R2B_MEMBER_RESULT') && last.digest._text.includes('A5IE_R2B_DENY_RESULT') }
      }, `${mode} leader chain (two delegations + collects + final)`)
      facts.leaderToolCalls = chain.toolCalls
      facts.memberResultsBackToLeader = chain.backToLeader
      const memberAReqs = (mock.requests ?? []).filter((r) => r.digest?.markerHits.includes(`${MK}_${mode.toUpperCase()}_TASK_A`) && !r.digest.markerHits.includes(`${MK}_${mode.toUpperCase()}_L0`) && r.digest.toolCount > 0)
      const memberDReqs = (mock.requests ?? []).filter((r) => r.digest?.markerHits.includes(`${MK}_${mode.toUpperCase()}_TASK_D`) && !r.digest.markerHits.includes(`${MK}_${mode.toUpperCase()}_L0`) && r.digest.toolCount > 0)
      facts.memberARequestCount = memberAReqs.length
      facts.memberDRequestCount = memberDReqs.length
      facts.memberAWireCatalog = memberAReqs[0]?.digest.toolNames ?? null
      const l0reqs = (mock.requests ?? []).filter((r) => r.digest?.markerHits.includes(`${MK}_${mode.toUpperCase()}_L0`) && r.digest.toolCount > 0)
      facts.leaderWireCatalog = l0reqs[0]?.digest.toolNames ?? null
      const lastA = memberAReqs[memberAReqs.length - 1]
      facts.memberAToolResults = lastA?.digest.toolResults ?? []
      facts.memberAToolCallOrder = lastA?.digest.assistantToolNames ?? []
      facts.memberAFinal = memberAReqs.find((r) => JSON.stringify(r.reply ?? '').includes('A5IE_R2B_MEMBER_RESULT'))?.reply ?? null
      const lastD = memberDReqs[memberDReqs.length - 1]
      facts.memberDToolResults = lastD?.digest.toolResults ?? []
      facts.memberDFinal = memberDReqs.find((r) => JSON.stringify(r.reply ?? '').includes('A5IE_R2B_DENY_RESULT'))?.reply ?? null
      facts.sentinelExists = existsSync(world.sentinel)
      facts.bashWroteExists = existsSync(world.bashWrote)
      facts.bashWroteBytes = facts.bashWroteExists ? readFileSync(world.bashWrote, 'utf8') : null
      // Whole-world confidentiality sweep: the outside marker bytes must never
      // ride the wire in ANY request of this world.
      const wireAll = (mock.requests ?? []).slice(reqBase).map((r) => JSON.stringify({ reply: r.reply ?? null, digest: r.digest === undefined ? null : { toolResults: r.digest.toolResults, text: r.digest._text } }))
      facts.outsideMarkerOnWire = wireAll.filter((s) => s.includes(OUTSIDE_MARKER)).length
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
      facts.logObservations = raw.split('\n').filter((l) => /a5ie|a5-plane|a5g7-search|a5g7-shell|a5g7-read|placement-feed|confined-shell|governed-read|anchored-search/.test(l)).slice(0, 120).map((l) => redact(l).slice(0, 300))
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
const IO_TEXT = 'IO_POLICY_UNSUPPORTED'
const BIND_TEXT = 'cannot be verified at dispatch time (no fallback to the native body)'
const READ_ESCAPE_CODE = 'target-outside-governed-root'

async function main () {
  // START SWEEP (disclosed): leftovers from OUR OWN earlier runs of this kit
  // (never anything else's) are swept before the round starts, listed in the
  // run evidence, because C1 grades the FINAL state.
  {
    const homesRoot = join(WORKTREE, 'tests', 'homes')
    const stale = existsSync(homesRoot) ? readdirSync(homesRoot).filter((d) => d.startsWith(`${WORLD_PREFIX}-`)) : []
    for (const d of stale) { try { rmSync(join(homesRoot, d), { recursive: true, force: true }) } catch { /* best effort */ } }
    writeEvidence('start-sweep.json', { staleHomes: stale })
  }
  console.log(`a5ie-r2b kit stamp=${RUN_STAMP} ports=${HOST_PORT}/${BASELINE_PORT} spec=${INSTALL_SPEC}`)
  const head = gitAt(TESTUSE, 'rev-parse', 'HEAD')
  const porcelainBefore = gitAt(TESTUSE, 'status', '--porcelain')
  check('H1', `the test-use host is the pinned pristine runtime @${TEST_USE_BASELINE_SHA.slice(0, 10)}, porcelain clean before`,
    head === TEST_USE_BASELINE_SHA && porcelainBefore === '', `head=${head.slice(0, 10)} porcelain=${porcelainBefore === '' ? 0 : 'DIRTY'}`)
  const worktreeHead = gitAt(WORKTREE, 'rev-parse', 'HEAD')
  check('H1b', 'the install spec pins THIS round\'s verified master SHA (the install face under test is that exact commit, no branch drift)',
    worktreeHead === INSTALL_SHA, `worktree=${worktreeHead.slice(0, 12)} spec sha=${INSTALL_SHA.slice(0, 12)}`)
  let mockPort = 0
  for (const p of [3491, 3492, 3493, 3494, 3495]) { if (await portFree(p)) { mockPort = p; break } }
  check('H2', `ports ${HOST_PORT} AND ${BASELINE_PORT} self-proved free before the run + a mock port from the 349x family free`, (await portFree(HOST_PORT)) && (await portFree(BASELINE_PORT)) && mockPort > 0, `mock=${mockPort}`)
  const stableBefore = await stableProbe()
  check('H0', 'the stable :3080 instance answers read-only before this run (probe only, never touched)', stableBefore !== 'unreachable', `status=${String(stableBefore)}`)

  // ══ PHASE I — the real install into a NEW install directory ══════════════
  const INSTALL_HOME = homeDir(WORKTREE, `${WORLD_PREFIX}-install-${RUN_STAMP}`)
  mkdirSync(join(INSTALL_HOME, 'workspace'), { recursive: true })
  const face = declaredFace(WORKTREE, INSTALL_SHA)
  const faceMirror = materializeDeclaredFace(WORKTREE, INSTALL_SHA, face)
  let probe = null
  if (ONLY !== 'live') {
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
    check('I2', 'STRICT profile face: the profile declares EXACTLY this repo\'s one plugin (dependencies == {dsh-agent-team: <the pinned spec>}), its node_modules top level holds nothing else, and the reconciler appended the dsh-agent-team bundle row',
      deps.length === 1 && deps[0] === 'dsh-agent-team' && probe.manifest?.dependencies?.['dsh-agent-team'] === INSTALL_SPEC && probe.nodeModulesTop.length === 1 && probe.nodeModulesTop[0] === 'dsh-agent-team' && bundles.includes('dsh-agent-team'),
      `deps=${JSON.stringify(deps)} nm=${JSON.stringify(probe.nodeModulesTop)} bundles=${JSON.stringify(bundles)}`)
    check('I3a', 'INSTALL THREE-ZEROS (1/4 count): the installed tree holds exactly the declared face — one file per declared entry',
      m.actualCount === m.expectedCount, `installed=${String(m.actualCount)} declared-files-face=${String(m.expectedCount)} (files: entries=${String(face.declared.length)} + pack-always=${String(m.packAdditions.length)})`)
    check('I3b', 'INSTALL THREE-ZEROS (2/4 missing = 0): every declared file materialized in the install dir',
      m.missing.length === 0, `missing=${String(m.missing.length)} ${JSON.stringify(m.missing.slice(0, 6))}`)
    check('I3c', 'INSTALL THREE-ZEROS (3/4 extra = 0): nothing outside the declared face landed (no repo history, no source tree, no dot dirs)',
      m.extra.length === 0, `extra=${String(m.extra.length)} ${JSON.stringify(m.extra.slice(0, 6))}`)
    check('I3d', 'INSTALL THREE-ZEROS (4/4 sha ≠ 0): every installed file is BYTE-IDENTICAL to that path at the installed commit',
      m.shaMismatch.length === 0, `mismatch=${String(m.shaMismatch.length)} ${JSON.stringify(m.shaMismatch.slice(0, 3))} rootSha=${m.rootSha.slice(0, 16)}`)
    check('I3e', 'the two bytes beyond the declared `files:` list are exactly the pack rules\' always-included manifest/document pair (disclosed, not hidden inside the count)',
      m.packAdditions.length === 2 && m.packAdditions.includes('package.json') && m.packAdditions.includes('README.md'),
      `alwaysIncluded=${JSON.stringify(m.packAdditions)}`)
    const layerText = readFileSync(join(probe.installedDir, 'cordis.patch.yml'), 'utf8')
    const machineAgnostic = !/file:\/\/|[A-Za-z]:\\|\/srv\/|\/home\/|\/Users\//.test(layerText)
    check('I4', 'the installed bundle layer is machine-agnostic (rows reference the package by name — no file: URL, no absolute path), i.e. the same layer doc installs on any machine',
      machineAgnostic && layerText.includes('dsh-agent-team/host'), `fileUrlOrAbsPath=${String(!machineAgnostic)} hostRow=${String(layerText.includes('dsh-agent-team/host'))}`)
    // ── the composed tree as the pinned host itself computes it (public face) ──
    const probeWorld = { governedRoot: join(INSTALL_HOME, 'workspace', 'governed') }
    mkdirSync(probeWorld.governedRoot, { recursive: true })
    mkdirSync(join(INSTALL_HOME, 'blueprints'), { recursive: true })
    const probeLauncher = materializeLauncher(WORKTREE, INSTALL_SHA, join(INSTALL_HOME, 'deployment', 'landlock-prelauncher.py'))
    const probePreflight = launcherAbiPreflight(probeLauncher.path)
    writeEvidence('launcher-deployment.json', { launcher: probeLauncher, abiPreflight: probePreflight, note: 'the confined provider is NOT on the published face (no .py in files:), so the installer supplies this deployment input; extracting it with `git archive` would produce tar bytes, not the script — the provider then fail-closes with "no landlock ABI", which is why the extraction is asserted byte-identical to the commit blob and probed here before any host exists' })
    check('I9', 'the deployment input the installer supplies for the confined provider is the RIGHT BYTES: the materialized pre-launcher is byte-identical to that path at the installed commit and at the working tree, is a script (`#!`), and answering it directly measures a real landlock ABI (so an opaque later SANDBOX_UNAVAILABLE can never be blamed on the deployment bytes)',
      probeLauncher.bytesMatchCommitAndWorktree && probeLauncher.isScript && probePreflight.kind === 'abi-available' && typeof probePreflight.abiVersion === 'number',
      `sha=${probeLauncher.sha.slice(0, 16)}… commit==worktree=${String(probeLauncher.bytesMatchCommitAndWorktree)} script=${String(probeLauncher.isScript)} abi=${String(probePreflight.kind)}/${String(probePreflight.abiVersion)} answer=${probePreflight.answer.slice(0, 90)}`)
    const probeCfg = rowConfig('installed', join(INSTALL_HOME, 'blueprints'), probeWorld, probeLauncher)
    const basePluginsProbe = smokePresetPlugins({
      personaText: 'You are a coding agent powered by the {{model}} model.',
      cwdSuffix: 'Your working directory is {{cwd}}.',
      bashDescription: 'Run commands in a bash shell. State is persistent across calls.',
    })
    const probeLayer = [
      `# a5ie-r2b INSTALL-PROBE layer (run ${RUN_STAMP}): the same id-targeted config override the live worlds use, on the installed bundle row.`,
      '- id: dsh-agent-team',
      '  name: dsh-agent-team/host',
      '  config:',
      ...Object.entries(probeCfg).flatMap(([k, v]) => yamlEmit(k, v, 2)),
      ...['- insert:', ...yamlEmitItem(presetDeclarationRow({
        id: PRESET_ID, displayName: 'a5ie-r2b base', description: `a5ie-r2b base preset (run ${RUN_STAMP}) = smoke preset`, plugins: basePluginsProbe,
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
    check('I5', 'the pinned host composes the INSTALLED bundle row through the public profile seam: --dump-config carries id dsh-agent-team / name dsh-agent-team/host with this round\'s teamToolPlane config (plus the spill-local + client rows of the same installed layer), no skipped bundle',
      dump.status === 0 && hasTeamRow && hasPlane && hasSubRows && !skipped,
      `exit=${String(dump.status)} teamRow=${String(hasTeamRow)} plane=${String(hasPlane)} subRows=${String(hasSubRows)} skipped=${String(skipped)}`)
    const gate = spawnSync(process.execPath, [join(WORKTREE, 'scripts', 'check-artifacts-committed.mjs')], { cwd: WORKTREE, encoding: 'utf8', timeout: 300_000 })
    check('I6', 'the repo drift gate grades the COMMITTED dist at HEAD with exit 0 — the bytes that installed are the bytes the commit carries (no build-on-install on this face)',
      gate.status === 0, `status=${String(gate.status)} ${(String(gate.stdout ?? '') + String(gate.stderr ?? '')).split('\n').filter((l) => l.trim() !== '').slice(-1)[0]?.slice(0, 160) ?? ''}`)
    const launcherRel = 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py'
    const sourceLauncher = sha256File(join(WORKTREE, launcherRel))
    check('I8', `DISCLOSED FACE GAP (honest, not worked around): the confined provider's Landlock pre-launcher is NOT on the published face (tsc never emits .py), so the installer must supply it as a deployment input (${launcherRel} ∉ installed set; this round materializes it from the SAME commit and byte-pins sha256=${sourceLauncher.slice(0, 16)}…, exactly the shape INSTALL §3.5 documents)`,
      !face.expected.includes(launcherRel) && existsSync(join(WORKTREE, launcherRel)),
      `launcherInFace=${String(face.expected.includes(launcherRel))} launcherSha=${sourceLauncher.slice(0, 16)}…`)
  }
  const faceReference = probe !== null ? { rootSha: measureInstalledFace(probe.installedDir, face, faceMirror).rootSha, fromProbe: true } : { rootSha: 'install-phase-skipped', fromProbe: false }

  const MK = `A5IE_R2B_${RUN_STAMP.replace(/[^A-Za-z0-9]/g, '')}`
  const markers = []
  for (const mode of MODES) {
    const MU = mode.toUpperCase()
    markers.push(`${MK}_${MU}_DISC`, `${MK}_${MU}_L0`)
    if (mode !== 'baseline') markers.push(`${MK}_${MU}_TASK_A`, `${MK}_${MU}_TASK_D`)
    for (const preset of PRESETS) markers.push(`${MK}_${MU}_${preset.toUpperCase()}_SETUP`)
  }
  markers.push('A5IE_R2B_MEMBER_RESULT', 'A5IE_R2B_DENY_RESULT', 'A5IE_R2B_LEADER_DONE')

  const mock = await startMockModel({
    port: mockPort,
    log: () => { },
    decide: ({ req }) => {
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
          if (calls.length === 0) return toolCall(`call-ie-delegate-a-${rnd()}`, 'team_delegate', {
            rootSessionId: CREATE_ROOT, requestToken: TK_D1, delegationTemplateId: 'wa', label: 'ie-a',
            taskSummary: 'a5ie-r2b install-acceptance effect legs (member A)',
            prompt: `${MK}_${MU}_TASK_A Do the delegated work exactly as instructed.`, async: false,
          })
          if (calls.length === 1) return toolCall(`call-ie-collect-a-${rnd()}`, 'team_collect', { rootSessionId: CREATE_ROOT, requestToken: `a5ie-collect-a-${RUN_STAMP}`, requestTokens: [TK_D1] })
          if (calls.length === 2) return toolCall(`call-ie-delegate-d-${rnd()}`, 'team_delegate', {
            rootSessionId: CREATE_ROOT, requestToken: TK_D2, delegationTemplateId: 'wd', label: 'ie-d',
            taskSummary: 'a5ie-r2b deny-lane negative (member D)',
            prompt: `${MK}_${MU}_TASK_D Do the delegated work exactly as instructed.`, async: false,
          })
          if (calls.length === 3) return toolCall(`call-ie-collect-d-${rnd()}`, 'team_collect', { rootSessionId: CREATE_ROOT, requestToken: `a5ie-collect-d-${RUN_STAMP}`, requestTokens: [TK_D2] })
          return { kind: 'text', content: 'A5IE_R2B_LEADER_DONE' }
        }
        if (mode !== 'baseline' && text.includes(`${MK}_${MU}_TASK_A`)) {
          const calls = digest.assistantToolNames
          if (calls.length === 0) return toolCall(`call-ie-read-pos-${rnd()}`, 'read', { file_path: 'notes.txt' })
          if (calls.length === 1) return toolCall(`call-ie-read-neg-${rnd()}`, 'read', { file_path: '../outside/secret.txt' })
          if (calls.length === 2) return toolCall(`call-ie-grep-pos-${rnd()}`, 'team_grep', { pattern: TOK_GREP, path: '.', output_mode: 'content' })
          if (calls.length === 3) return toolCall(`call-ie-grep-absent-${rnd()}`, 'team_grep', { pattern: TOK_GREP_ABSENT, path: '.', output_mode: 'content' })
          if (calls.length === 4) return toolCall(`call-ie-grep-outside-${rnd()}`, 'team_grep', { pattern: OUTSIDE_PREFIX, path: '.', output_mode: 'content' })
          if (calls.length === 5) return toolCall(`call-ie-bash-pos-${rnd()}`, 'team_bash', { command: `echo ${TOK_BASH}; echo ${BASH_WRITE_MARKER} > ./bash-wrote.txt; cat ./bash-wrote.txt` })
          if (calls.length === 6) return toolCall(`call-ie-bash-outside-${rnd()}`, 'team_bash', { command: 'cat ../outside/secret.txt' })
          if (calls.length === 7) return toolCall(`call-ie-glob-${rnd()}`, 'team_glob', { pattern: '*' })
          const results = digest.toolResults
          const quote = results.map((r, i) => `r${i}=${r.slice(0, 140).replace(/\s+/g, ' ')}`).join(' | ')
          return { kind: 'text', content: `A5IE_R2B_MEMBER_RESULT ${quote}` }
        }
        if (mode !== 'baseline' && text.includes(`${MK}_${MU}_TASK_D`)) {
          const calls = digest.assistantToolNames
          if (calls.length === 0) return toolCall(`call-ie-dbash-${rnd()}`, 'team_bash', { command: `touch ./${SENTINEL}` })
          const results = digest.toolResults
          return { kind: 'text', content: `A5IE_R2B_DENY_RESULT ${String(results[0] ?? '').slice(0, 240).replace(/\s+/g, ' ')}` }
        }
        if (text.includes(`${MK}_${MU}_L0`)) return { kind: 'text', content: 'A5IE_L0_OK' }
      }
      return { kind: 'text', content: 'a5ie-r2b-mock: unscripted request, completing quietly.' }
    },
  })

  const worlds = {}
  try {
    if (ONLY !== 'install') {
      for (const mode of MODES) worlds[mode] = await runWorld({ mode, mock, MK, blueprintBaseDir: join(EVIDENCE_DIR, 'blueprints'), markers, stormLimit: Number(argValue('storm-limit', 400)), faceReference, face, faceMirror })
    }
  } finally {
    try { await mock.close() } catch { /* gone */ }
  }
  const porcelainAfter = gitAt(TESTUSE, 'status', '--porcelain')
  const stableAfter = await stableProbe()
  check('H3', ':3080 stable instance untouched (read-only probe before/after) and the test-use host porcelain 0 after',
    String(stableBefore) === String(stableAfter) && porcelainAfter === '', `${String(stableBefore)} -> ${String(stableAfter)}; porcelain=${porcelainAfter === '' ? 0 : 'DIRTY'}`)

  for (const mode of MODES) writeEvidence(`world-${mode}.json`, worlds[mode] ?? { missing: true })
  check('W1', 'all three worlds ran on the REAL installed face (row composed from the installed bundle layer, not a file: URL) and were swept',
    MODES.every((m) => worlds[m]?.ok === true), MODES.map((m) => `${m}:${worlds[m]?.ok === true ? 'ok' : 'FAIL'}${worlds[m]?.swept ? '/swept' : '/UNSWEPT'}`).join(' '))

  const a = worlds.installed ?? {}
  const p = worlds.preassembly ?? {}
  const b = worlds.baseline ?? {}
  const aR = a.memberAToolResults ?? []
  const dR = a.memberDToolResults ?? []
  const pR = p.memberAToolResults ?? []
  // Legs are addressed by the ACTUAL tool-call order of the member transcript
  // (one result per call, in order), never by a hard-coded index: a row that
  // answers a call with a refusal still consumes its slot, and the order is
  // what the transcript proves.
  const resOf = (w, tool, occ = 1) => {
    const names = w?.memberAToolCallOrder ?? []
    const results = w?.memberAToolResults ?? []
    let seen = 0
    for (let i = 0; i < names.length; i += 1) {
      if (String(names[i]) === tool) { seen += 1; if (seen === occ) return String(results[i] ?? 'LEG-MISSING') }
    }
    return 'LEG-MISSING'
  }
  const at = (tool, occ = 1) => resOf(a, tool, occ)
  const pt = (tool, occ = 1) => resOf(p, tool, occ)

  // ── ② assembled legs (real governed Team, mock only at the LLM slot) ──────
  check('A1', 'read POSITIVE on the installed face: the takeover-placed governed read RAN and the member result carries the REAL governed bytes over the wire',
    at('read', 1).includes(TOK_READ) && !at('read', 1).includes(BIND_TEXT), `read#1=${JSON.stringify(at('read', 1)).slice(0, 220)}`)
  check('A2', 'read CROSS-ROOT NEGATIVE: the same row refuses a target that escapes the governed root with the typed anchor code, and ZERO bytes of the outside file are disclosed',
    at('read', 2).includes(READ_ESCAPE_CODE) && !at('read', 2).includes(OUTSIDE_MARKER), `read#2=${JSON.stringify(at('read', 2)).slice(0, 260)}`)
  check('A3', 'team_grep POSITIVE: the anchored read-only search row RAN (real search over the governed root) and the hit line carrying the token rides the wire — the shut landing is gone on this row',
    at('team_grep', 1).includes(TOK_GREP) && !at('team_grep', 1).includes(IO_TEXT), `grep#1=${JSON.stringify(at('team_grep', 1)).slice(0, 260)}`)
  check('A4', 'team_grep ABSOLUTE NEGATIVE: a pattern that exists nowhere answers an honest ZERO-HIT result (never a refusal, never a fabricated hit, never IO_POLICY)',
    at('team_grep', 2).includes('0 matches') && !at('team_grep', 2).includes(TOK_GREP_ABSENT + ':') && !at('team_grep', 2).includes(IO_TEXT) && !at('team_grep', 2).includes('a5p5-refused'),
    `grep#2=${JSON.stringify(at('team_grep', 2)).slice(0, 220)}`)
  check('A5', 'team_grep ANCHORED NEGATIVE: searching with a prefix that exists ONLY outside the root answers zero hits inside, and the outside marker bytes appear NOWHERE in the result',
    /0 matches/.test(at('team_grep', 3)) && !at('team_grep', 3).includes(OUTSIDE_MARKER), `grep#3=${JSON.stringify(at('team_grep', 3)).slice(0, 220)}`)
  check('A6', 'team_bash POSITIVE (REAL Landlock on this host, ABI-gated launcher): the confined run RAN — token on stdout, exit=0 — and a write INSIDE the governed root landed on disk (fs-probed before the sweep)',
    at('team_bash', 1).includes(TOK_BASH) && at('team_bash', 1).includes('exit=0') && a.bashWroteExists === true && String(a.bashWroteBytes ?? '').includes(BASH_WRITE_MARKER),
    `bash#1=${JSON.stringify(at('team_bash', 1)).slice(0, 220)} wrote=${String(a.bashWroteExists)} abi=${String(a.launcherAbiPreflight?.kind)}/${String(a.launcherAbiPreflight?.abiVersion)}`)
  check('A7', 'team_bash OUT-OF-BOUNDS = KERNEL refusal: reading a file outside every allowPath answers `Permission denied` from inside the confined child (not a lane guess), and the outside marker never appears in the result nor anywhere on this world\'s wire',
    at('team_bash', 2).includes('Permission denied') && !at('team_bash', 2).includes(OUTSIDE_MARKER) && a.outsideMarkerOnWire === 0,
    `bash#2=${JSON.stringify(at('team_bash', 2)).slice(0, 240)} markerOnWire=${String(a.outsideMarkerOnWire)}`)
  const globVerbatim = at('team_glob', 1)
  writeEvidence('glob-row-verbatim.txt', `${globVerbatim}\n`)
  check('A8', `GLOB ROW CURRENT FORM, booked VERBATIM (current master, #333 NOT merged): team_glob lands the typed shut face and the refusal text is captured byte-for-byte into glob-row-verbatim.txt [${IO_TEXT}]`,
    globVerbatim.includes(IO_TEXT) && !globVerbatim.includes('matches'), `r7=${JSON.stringify(globVerbatim).slice(0, 240)}`)
  const ranLines = (a.logObservations ?? []).filter((l) => /confined-shell ran\b/i.test(l)).length
  check('A9', 'the installed world\'s host log carries the assembly\'s own witness rows: the placement-feed row list for this realm, the confined capability probe row, a governed-read RAN line, and one "confined-shell ran" line per driven shell leg (2) — the mount and the real confined runs are attributable to the assembly, not inferred',
    (a.logObservations ?? []).some((l) => /placement-feed rows=\[/.test(l))
    && (a.logObservations ?? []).some((l) => /confined-shell capability/.test(l))
    && ranLines >= 2
    && (a.logObservations ?? []).some((l) => /governed-read RAN/.test(l)),
    `placement=${String((a.logObservations ?? []).some((l) => /placement-feed rows=\[/.test(l)))} capability=${String((a.logObservations ?? []).some((l) => /confined-shell capability/.test(l)))} confinedShellRan=${String(ranLines)} governedRead=${String((a.logObservations ?? []).some((l) => /governed-read RAN/.test(l)))}`)
  const governedRootAbs = `${String(a.home ?? '')}/workspace/governed`
  const searchSource = spawnSync('git', ['-C', WORKTREE, 'show', `${INSTALL_SHA}:packages/runtime/src/plugin/live/team-tool-plane.mjs`], { encoding: 'utf8' }).stdout
  const mountCall = /createAnchoredSearchBackend\(\{[\s\S]{0,400}?\}\)/.exec(searchSource)?.[0] ?? ''
  const mountPassesNoConfined = mountCall.includes('createAnchoredSearchBackend') && !mountCall.includes('confined')
  check('A10', 'which search body answered is attributable (no silent substitution): the hit line carries the ANCHORED ABSOLUTE path of this world\'s governed root (the anchored search port\'s own anchoring, not a cwd-relative native grep), the answer arrives on the governed renderer\'s meta face, the host log carries no confined-rg/anchored-glob claim, and the installed commit\'s mount passes NO confined handle to the search backend — so the answering body is the anchored search row, not the rg row',
    at('team_grep', 1).includes(governedRootAbs) && at('team_grep', 1).includes('a5p5-meta')
    && mountPassesNoConfined
    && !(a.logObservations ?? []).some((l) => /anchored-glob|confined-search|rg-parity/.test(l)),
    `anchoredPathInResult=${String(at('team_grep', 1).includes(governedRootAbs))} metaFace=${String(at('team_grep', 1).includes('a5p5-meta'))} mountConfined=${String(!mountPassesNoConfined)}`)

  // ── deny lane ─────────────────────────────────────────────────────────────
  check('D1', 'DENY LANE BEFORE ANY BACKEND: the shell-DENYING member answered template-deny-lane and the sentinel was NEVER created (zero side effect on the fs)',
    dR[0]?.includes('template-deny-lane') === true && a.sentinelExists === false,
    `r0=${JSON.stringify(dR[0] ?? 'LEG-MISSING').slice(0, 220)} sentinel=${String(a.sentinelExists)}`)

  // ── preassembly verbatim RED postures (a5g7 shape, current master form) ───
  check('P1', 'RED POSTURE (preassembly row: teamToolPlane WITHOUT fsInstance/confinedProvider): the member read dispatch answers the VERBATIM guard refusal — no fallback to the native body',
    pt('read', 1).includes(BIND_TEXT) === true, `read#1=${JSON.stringify(pt('read', 1)).slice(0, 240)}`)
  check('P2', 'RED POSTURE: team_grep lands the VERBATIM typed shut face (a landing, never a capability)',
    pt('team_grep', 1).includes(IO_TEXT) === true, `grep#1=${JSON.stringify(pt('team_grep', 1)).slice(0, 200)}`)
  check('P3', 'RED POSTURE: team_bash lands the same VERBATIM typed shut face for the shell class',
    pt('team_bash', 1).includes(IO_TEXT) === true, `bash#1=${JSON.stringify(pt('team_bash', 1)).slice(0, 200)}`)

  // ── closed world / zero expansion ─────────────────────────────────────────
  const baselineClean = (b.planeObservations ?? []).every((o) => !String(o).startsWith('a5-plane: placed') && !String(o).includes('a5ie'))
    && !(b.leader?.scopedNames ?? []).some((n) => ALIASES.includes(n))
  check('Z1', 'control of controls: the BASELINE governed leader (same installed artifact, NO teamToolPlane config) shows zero plane aliases and zero plane/kit observations — the mount is config-scoped, never ambient',
    baselineClean, `aliases=${JSON.stringify((b.leader?.scopedNames ?? []).filter((n) => ALIASES.includes(n)))} obs=${JSON.stringify((b.planeObservations ?? []).slice(0, 2)).slice(0, 200)}`)
  const setDiff = (x, y) => (Array.isArray(x) ? x : []).filter((n) => !(Array.isArray(y) ? y : []).includes(n))
  {
    const preset = PRESETS[0]
    const regDelta = setDiff(a[preset]?.scopedNames, b[preset]?.scopedNames)
    const wireDelta = setDiff(a[preset]?.wireCatalog, b[preset]?.wireCatalog)
    const clean = (a[preset]?.scopedNames ?? []).filter((n) => n.startsWith('team_')).length === 0 && (a[preset]?.wireCatalog ?? []).filter((n) => n.startsWith('team_')).length === 0
    check('Z2', `ZERO EXPANSION (same round): the ${preset} NON-team session shows registry-vs-baseline Δ=[] AND wire-vs-baseline Δ=[] AND zero team_ aliases — while the SAME installed boot runs live governed backends`,
      regDelta.length === 0 && wireDelta.length === 0 && clean && Array.isArray(a[preset]?.scopedNames) && Array.isArray(b[preset]?.scopedNames), `regΔ=${JSON.stringify(regDelta)} wireΔ=${JSON.stringify(wireDelta)}`)
  }
  check('Z3', 'the installed world shows NO IO_POLICY_UNSUPPORTED landing on any driven leg except the glob row, and its host log carries NO module/bootstrap error',
    aR.length === 8 && aR.filter((r) => String(r).includes(IO_TEXT)).length === 1 && (a.hostErrors ?? []).length === 0,
    `legs=${String(aR.length)} ioPolicyLegs=${String(aR.filter((r) => String(r).includes(IO_TEXT)).length)} hostErrors=${JSON.stringify((a.hostErrors ?? []).slice(0, 2)).slice(0, 240)}`)
  check('Z4', 'the plane reached the model-facing wire on the governed agents (member catalog carries the three aliases plus the read takeover) while the non-team surface stayed untouched',
    ALIASES.every((n) => (a.memberAWireCatalog ?? []).includes(n)) && (a.memberAWireCatalog ?? []).includes('read'),
    `member plane names=${JSON.stringify([...new Set((a.memberAWireCatalog ?? []).filter((n) => n.startsWith('team_') || n === 'read'))])}`)

  // ── glob: honest booking of what this commit does and does not prove ──────
  const globSourceShut = spawnSync('git', ['-C', WORKTREE, 'show', `${INSTALL_SHA}:packages/runtime/src/plugin/live/team-tool-plane.mjs`], { encoding: 'utf8' }).stdout
  const sourceSaysShut = /glob: shut,/.test(globSourceShut)
  writeEvidence('pending-333.json', {
    bookedAt: RUN_STAMP,
    installedSha: INSTALL_SHA,
    currentForm: 'team_glob lands the typed shut face verbatim (A8); the plane source at the installed commit keeps glob: shut',
    notCountedGreen: [
      'GLOB-POS after the flip: the anchored rg walk answers a real match set over the wire',
      'GLOB-BOUND after the flip: GLOB_MAX_RESULTS bound with the honest truncated marker over >limit seeds',
      'GLOB-WALKER-ERROR after the flip: typed rg walker-error shape (never a silent zero)',
      'GLOB-SYMLINK after the flip: a final-component symlink refused with ZERO secret bytes disclosed',
      'GLOB-OUTSIDE-ANCHOR after the flip: no outside name and no outside byte may surface through the row',
    ],
    rerunTrigger: 'merge of the glob mount (#333) — these five controls are to be re-run then; on THIS commit they are NOT green and NOT attempted',
  })
  check('G1', 'the flip is honestly NOT claimed here: the installed commit\'s plane source still says `glob: shut`, the wire landed the shut face, and the post-flip positive/negative controls are booked in pending-333.json for a #333 re-run (never counted green on this round)',
    sourceSaysShut && globVerbatim.includes(IO_TEXT), `sourceShut=${String(sourceSaysShut)} wireShut=${String(globVerbatim.includes(IO_TEXT))}`)

  // ── cross-round disclosure: the fail-closed lane was really exercised ─────
  // An earlier run of THIS round (dev-runs/dev3) supplied the confined
  // provider's deployment input as wrongly-extracted bytes (`git archive`
  // streams a tar container, not the script). The provider's own byte-pin
  // passed — the pin is self-consistent — and its authoritative ABI probe then
  // measured no landlock ABI, so both shell legs were REFUSED with
  // SANDBOX_UNAVAILABLE and the kernel was never reached. That is the
  // fail-closed law working (no unconfined fallback), and it is why I9 exists.
  // Booked here from the retained earlier evidence, never presented as this
  // run's behaviour.
  {
    const earlierLog = join(HERE, 'dev-runs', 'dev3.log')
    const earlierWorld = join(HERE, 'dev-runs', 'dev3', 'world-installed.json')
    const text = existsSync(earlierLog) ? readFileSync(earlierLog, 'utf8') : ''
    const worldText = existsSync(earlierWorld) ? readFileSync(earlierWorld, 'utf8') : ''
    const occurrences = (String(worldText).match(/SANDBOX_UNAVAILABLE/g) ?? []).length
    const failClosedLine = text.split('\n').find((l) => l.includes('SANDBOX_UNAVAILABLE')) ?? ''
    note('B1', 'CROSS-ROUND DISCLOSURE (booked, not graded): the confined provider\'s fail-closed lane was exercised for real in an earlier run of this round — a wrongly-extracted deployment input (tar bytes instead of the pre-launcher) passed the self-consistent byte-pin, the authoritative ABI probe then measured NO landlock ABI, and BOTH shell legs were refused with SANDBOX_UNAVAILABLE instead of falling back unconfined (retained at dev-runs/dev3; the recorded run\'s I9 + 2 confined-shell ran lines are the counter-evidence)',
      `refusalsInEarlierWorld=${String(occurrences)} earlierLine=${failClosedLine.slice(0, 150)}`)
  }

  // ── booked, not claimed green: payload exit-code fidelity on the shell row ─
  // The out-of-bounds leg's payload DID fail in the kernel (`cat: …: Permission
  // denied` on stderr), but the rendered result carries `exit=0`. So on this
  // commit the confined shell row's exit-code channel does not carry the
  // payload's status for that path. A7 claims exactly what it verified (kernel
  // refusal + zero disclosure); exit-status fidelity is booked here instead of
  // being quietly folded into the pass.
  {
    const oob = at('team_bash', 2)
    const kernelRefused = oob.includes('Permission denied')
    const reportedZero = /exit=0|"exitCode":0/.test(oob)
    note('B2', 'BOOKED, NOT CLAIMED (exit-code fidelity): the out-of-bounds payload failed in the kernel yet the shell row rendered exit=0 — this round claims the KERNEL REFUSAL and ZERO DISCLOSURE (A7) and explicitly does NOT claim that the confined shell row carries the payload exit status on this commit',
      `kernelRefused=${String(kernelRefused)} reportedExitZero=${String(reportedZero)} landing=${JSON.stringify(oob).slice(0, 150)}`)
  }

  // ── teardown ──────────────────────────────────────────────────────────────
  // The byte-reference mirror is a byte-for-byte COPY of the declared face
  // (~17 MB); the retained evidence is its per-file sha256 manifest, so the
  // copy itself is removed unless --keep asks for it.
  if (!KEEP) { try { rmSync(faceMirror, { recursive: true, force: true }) } catch { /* best effort */ } }
  if (!KEEP) { try { rmSync(INSTALL_HOME, { recursive: true, force: true }) } catch { /* best effort */ } }
  const homesRoot = join(WORKTREE, 'tests', 'homes')
  const leftHomes = existsSync(homesRoot) ? readdirSync(homesRoot).filter((d) => d.startsWith(`${WORLD_PREFIX}-`)) : []
  const lockLeft = existsSync(homesRoot) ? readdirSync(homesRoot).filter((d) => d.startsWith(`${WORLD_PREFIX}-`) && d.endsWith('.lock')) : []
  check('C1', `world + install-dir cleanup: no ${WORLD_PREFIX}-* DSH_HOME (and no lock) remains under tests/homes; the installed byte manifest is the retained evidence`,
    leftHomes.length === 0 && lockLeft.length === 0 && !existsSync(INSTALL_HOME), `homes=${JSON.stringify(leftHomes)} locks=${JSON.stringify(lockLeft)} installHome=${String(!existsSync(INSTALL_HOME))}`)
  const rawLeft = MODES.filter((m) => existsSync(join(EVIDENCE_DIR, `instance-${m}.raw.log`)))
  check('C2', 'launch-token hygiene: raw instance logs deleted after redaction at capture', rawLeft.length === 0, `rawLeft=${JSON.stringify(rawLeft)}`)
  const portsReleased = (await portFree(HOST_PORT)) && (await portFree(BASELINE_PORT)) && (await portFree(mockPort))
  check('C3', 'ports released after the run (host 318x pair + the 349x mock port all self-prove free again)', portsReleased, `ports=${String(HOST_PORT)}/${String(BASELINE_PORT)}/${String(mockPort)} free=${String(portsReleased)}`)

  writeEvidence('criteria.json', {
    runStamp: RUN_STAMP, ports: [HOST_PORT, BASELINE_PORT, mockPort], installSpec: INSTALL_SPEC, installedSha: INSTALL_SHA,
    worktreeHead, testuse: { dir: TESTUSE, head, porcelainAfter }, storeDir: STORE_DIR,
    installedFileCount: face.expected.length, criteria: CRITERIA,
  })
  if (!KEEP) { try { rmSync(INSTALL_HOME, { recursive: true, force: true }) } catch { /* best effort */ } }
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
