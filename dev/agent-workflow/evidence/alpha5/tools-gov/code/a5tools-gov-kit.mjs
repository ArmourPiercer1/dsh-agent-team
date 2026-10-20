#!/usr/bin/env node
/**
 * a5tools-gov-kit.mjs — native-tool governance on the REAL installed face (A route).
 *
 * WHAT THIS KIT IS: per-tool governance acceptance for the native (built-in)
 * tool surface — ① the governance face (closed sets + lanes), ② the REAL
 * install positive acceptance (host public package face → plugin boot →
 * member really EXECUTES the tool → the return shape reaches the wire),
 * ③ the negative acceptance (deny lane, builtinToolDeny cut-off, strict-mode
 * coverage-gate FATAL, default-deny with zero effect, member-shell refusal).
 * Method precedent: a5glob-off / a5ie-r5 (#337/#343 chain) — same install
 * face, three-zero law, public seams only, mock ONLY at the LLM position.
 *
 * MODES (sequential, host port 3187, mock 3495, homes a5tools-gov-<mode>-<stamp>):
 *  wide       — LEGACY member (no capabilities): positive ladder over
 *               write / edit / read / read_image / str_replace_editor / glob /
 *               grep / bash. Receipt = real execution: fs side effects +
 *               verbatim tool results on the wire.
 *  lanes      — STRICT member, permissions default deny + allow subtree rules
 *               over the governed root. Ladder: write inside (allow → runs),
 *               read of forbidden.txt (deny-lane rule → refused, marker never
 *               on wire), write outside subtree (default deny → refused, file
 *               absent), read_image inside (allow → runs), bash (member: no
 *               possible allow → refused, no side effect), grep + str_replace_editor
 *               (builtinToolDeny cut-off: ABSENT from the member wire catalog —
 *               deny-effective-chain — and the call lands a refusal).
 *  ask        — STRICT member, default ask, no rules: write#1 ask → durable
 *               control request → human resolve allow (production remote
 *               team.resolveControl, contract v4) → operation EXECUTES after
 *               approval; write#2 ask → deny → refused, file absent.
 *               Receipt: durable ledger rows request/decision/allow-consumed.
 *  unmanaged  — STRICT member WITHOUT the deny cut-off while the preset
 *               mounts str_replace_editor + glob + grep: member setup FAILS
 *               LOUDLY with the typed error
 *               alpha2-permission-coverage-unmanaged-tools (UNKNOWN_UNMANAGED
 *               for str_replace_editor, KNOWN_SENSITIVE for glob/grep);
 *               sibling member wa2 WITH the auto-derived builtinToolDeny
 *               sets up and reads for real (positive control: the deny is
 *               the sanctioned remediation, per the error's own remediation
 *               text).
 *
 * KIT_EXIT: 0 GREEN · 2 RED (criteria at full height, landings quoted) · 1 FATAL.
 * BOOK = recorded observation, never counted.
 *
 * @module evidence/alpha5/tools-gov/a5tools-gov-kit
 */
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { deflateSync } from 'node:zlib'
import { existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createServer as netServer } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const args = process.argv.slice(2)
const argValue = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1] }
const flag = (n) => args.includes(`--${n}`)
const HERE = dirname(new URL(import.meta.url).pathname)

/** The commit this kit grades: default = the frozen product-frozen candidate. */
const EXPECTED_SHA = argValue('sha', 'd5de74974b0320b191b310ead82407d478477ed7')
const SRC = resolve(argValue('src-root', ''))
if (!existsSync(join(SRC, 'tests/paths.mjs'))) throw new Error(`--src-root must be a checkout of the team repo: ${SRC}`)
const HOMES_ROOT = resolve(argValue('homes-root', join(SRC, 'tests', 'homes')))
const MAIN_CHECKOUT = resolve(argValue('main-checkout', SRC))
const RUN_STAMP = new Date().toISOString().slice(0, 19).replace(/:/g, '-') + 'Z'
const EVIDENCE_DIR = resolve(argValue('evidence-dir', join(HERE, '..', 'runs', RUN_STAMP)))
mkdirSync(EVIDENCE_DIR, { recursive: true })
const STORE_DIR = resolve(argValue('store-dir', join(HOMES_ROOT, '.a5tools-gov-store')))
const KEEP = flag('keep')

const SRC_IMPORT = (rel) => import(pathToFileURL(join(SRC, rel)).href)
const { startMockModel } = await SRC_IMPORT('packages/tools/harness/mock-deepseek.mjs')
const { presetDeclarationRow, smokePresetPlugins } = await SRC_IMPORT('tests/kits/_shared/preset-seam.mjs')
const pathsMod = await SRC_IMPORT('tests/paths.mjs')
const { TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH, testUseTree } = pathsMod

const WORLD_PREFIX = 'a5tools-gov'
const PRESET_ID = 'a5tools-gov-base'
const ROOT = 'a5tools-gov-root'
const MODEL_ID = 'deepseek-flash' // official-catalog id: inputModalities ['text','image'] (llm-deepseek/src/models.ts) — the read_image route gate reads this; the mock answers any model name
const HOST_PORT = 3187
const MOCK_PORT = 3495

const MANAGED_TOOL_NAMES = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh']
const SAFE_UNMANAGED_TOOL_NAMES = ['todo_write']
const COVERAGE_FATAL_CODE = 'alpha2-permission-coverage-unmanaged-tools'

/** Tokens planted in world files / tool arguments (unique per fixture). */
const TOK_WRITE = 'A5TOOLS-WRITE-TOK'
const TOK_EDITED = 'A5TOOLS-EDITED-TOK'
const TOK_SRE = 'A5TOOLS-SRE-TOK'
const TOK_GREP = 'A5TOOLS-GREP-TOK'
const TOK_BASH = 'A5TOOLS-BASH-TOK'
const FORBIDDEN_MARKER = 'A5TOOLS-FORBIDDEN-ONLY-7331'
const OUTSIDE_MARKER = 'A5TOOLS-OUTSIDE-ONLY-7332'

const MODES = ['wide', 'lanes', 'ask', 'unmanaged']
const MODE_RUN = (() => {
  const only = argValue('only', '')
  if (only === '') return MODES
  const picked = only.split(',').map((x) => x.trim()).filter((x) => MODES.includes(x))
  return picked.length > 0 ? picked : MODES
})()

// ─── criteria engine + tiny utils ────────────────────────────────────────────
const CRITERIA = []
function check (id, claim, cond, observed) {
  CRITERIA.push({ id, claim, pass: cond === true, observed })
  console.log(`${cond === true ? 'PASS' : 'FAIL'} ${id} — ${claim}${observed === undefined ? '' : ` [${observed}]`}`)
}
const note = (id, claim, observed) => { CRITERIA.push({ id, claim, pass: null, observed }); console.log(`BOOK ${id} — ${claim}${observed === undefined ? '' : ` [${observed}]`}`) }
const die = (msg) => { throw new Error(`FATAL: ${msg}`) }
const gitAt = (dir, ...a) => spawnSync('git', ['-C', dir, ...a], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).stdout.trim()
const sha256File = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
const sha256Text = (s) => createHash('sha256').update(s).digest('hex')
const hex8 = (s) => createHash('sha256').update(s).digest('hex').slice(0, 8)
function walkFiles (dir, base = dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walkFiles(p, base, out)
    else if (e.isFile()) out.push(p.slice(base.length + 1).split(/[\\/]/).join('/'))
  }
  return out
}
async function portFree (port) {
  return await new Promise((res) => {
    const srv = netServer()
    srv.once('error', () => res(false))
    srv.once('listening', () => { srv.close(() => res(true)) })
    srv.listen(port, '127.0.0.1')
  })
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
const stableProbe = async () => {
  try { const r = await fetch('http://127.0.0.1:3080/', { redirect: 'manual', signal: AbortSignal.timeout(5000) }); return r.status } catch { return 'unreachable' }
}
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
async function remoteCall (origin, cookie, method, params, tag = 'a5t', version = 1) {
  return fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
    body: JSON.stringify({ type: 'client-request', rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`, method, payload: { version, params } }),
  }, 240_000)
}

// ─── install-face measurement (declared files: face, same law as a5ie-r5) ────
function declaredFace (sha) {
  const pkg = JSON.parse(spawnSync('git', ['-C', SRC, 'show', `${sha}:package.json`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).stdout)
  const files = (pkg.files ?? []).map((f) => f.replace(/^\.\//, '').replace(/\/$/, ''))
  const ls = spawnSync('git', ['-C', SRC, 'ls-tree', '-r', '--name-only', '-z', sha], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 })
  if (ls.status !== 0) die(`git ls-tree at ${sha} failed`)
  const tree = ls.stdout.split('\0').filter((s) => s !== '')
  const under = (p) => files.some((f) => p === f || p.startsWith(`${f}/`))
  const docish = (p) => !p.includes('/') && /^(readme|license|licence|changelog|changes|history|notice)(\..*)?$/i.test(p)
  const declared = tree.filter(under)
  const packAdditions = tree.filter((p) => !under(p) && (p === 'package.json' || docish(p)))
  return { files, declared, packAdditions, expected: [...declared, ...packAdditions] }
}
function materializeDeclaredFace (sha, face) {
  const mirror = join(EVIDENCE_DIR, 'declared-face-mirror')
  mkdirSync(mirror, { recursive: true })
  const arch = spawnSync('git', ['-C', SRC, 'archive', sha, '--', ...face.expected], { maxBuffer: 512 * 1024 * 1024 })
  if (arch.status !== 0) die(`git archive of the declared face failed: ${String(arch.stderr).slice(0, 200)}`)
  const tar = spawnSync('tar', ['-x', '-C', mirror], { input: arch.stdout })
  if (tar.status !== 0) die(`tar expand of the declared face failed: ${String(tar.stderr).slice(0, 200)}`)
  return mirror
}
function measureInstalledFace (installedDir, face, mirror) {
  if (!existsSync(installedDir)) die(`installed package directory missing: ${installedDir}`)
  const actual = walkFiles(installedDir)
  const expected = [...face.expected].sort()
  const setE = new Set(expected); const setA = new Set(actual)
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
    expectedCount: expected.length, actualCount: actual.length, declaredCount: face.declared.length,
    packAdditions: face.packAdditions, missing, extra, shaMismatch,
    rootSha: sha256Text(manifest.map((x) => `${x.path} ${x.sha256}`).join('\n')), manifest,
  }
}
function profileWorkspaceYaml () {
  return `packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\nstoreDir: ${STORE_DIR}\n`
}
let INSTALL_SPEC = ''
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
  const nmDir = join(profileDir, 'node_modules')
  return {
    exit: r.status, seconds: Math.round((Date.now() - t0) / 1000), profileDir,
    manifest: existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null,
    nodeModulesTop: existsSync(nmDir) ? readdirSync(nmDir).filter((n) => !n.startsWith('.')).sort() : [],
    installedDir: join(profileDir, 'node_modules', 'dsh-agent-team'),
    outputTail: redact(out).split('\n').filter((l) => l.trim() !== '').slice(-8).join(' | ').slice(0, 600),
  }
}
function materializeLauncher (sha, destPath) {
  const rel = 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py'
  const blob = spawnSync('git', ['-C', SRC, 'show', `${sha}:${rel}`], { maxBuffer: 64 * 1024 * 1024 })
  if (blob.status !== 0) die(`git show of the launcher blob failed: ${String(blob.stderr).slice(0, 200)}`)
  mkdirSync(dirname(destPath), { recursive: true })
  writeFileSync(destPath, blob.stdout)
  const blobSha = sha256Text(blob.stdout)
  return {
    rel, path: destPath, sha: blobSha, bytes: blob.stdout.length,
    worktreeSha: sha256File(join(SRC, rel)), bytesMatchCommitAndWorktree: blobSha === sha256File(join(SRC, rel)),
    isScript: blob.stdout.slice(0, 2).toString('utf8') === '#!',
  }
}

// ─── a 1x1 PNG seed for read_image (built with node zlib, no network) ────────
function crc32 (buf) {
  let c, table = crc32.table ?? (crc32.table = (() => {
    const t = new Int32Array(256)
    for (let n = 0; n < 256; n++) { let x = n; for (let k = 0; k < 8; k++) x = x & 1 ? 0xedb88320 ^ (x >>> 1) : x >>> 1; t[n] = x }
    return t
  })())
  c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function pngChunk (type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
function png1x1 () {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 2
  const row = Buffer.from([0x00, 0xff, 0x00, 0x00]) // filter 0 + RGB red
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(row)), pngChunk('IEND', Buffer.alloc(0))])
}

// ─── blueprints ──────────────────────────────────────────────────────────────
const ANCHOR_YAML = [
  '---', 'schemaVersion: 3', 'blueprintId: a5tools-gov-anchor-bp', 'revision: "1"',
  'leader:', '  templateId: leader', '  persona: "You are the leader of the a5tools-gov team."',
  'members:', '  - templateId: wa', '    persona: "You are a worker of the a5tools-gov team."',
  'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
  'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
].join('\n')

function yamlQuoted (s) { return JSON.stringify(s) }

/**
 * Ladder definitions. Each step = { marker, tool, args, why }.
 * The marker MUST appear in the step's tool-call arguments (the mock advances
 * the ladder by finding the first marker not yet visible in the transcript).
 */
function stepsFor (mode, W) {
  const P = (n) => join(W.governedRoot, n)
  if (mode === 'wide') {
    return [
      { marker: `${TOK_WRITE}-A1`, tool: 'write', args: { file_path: P('a5tools_write.txt'), content: `line one\n${TOK_WRITE}-A1 lives here\nline three\n` } },
      { marker: `${TOK_EDITED}-B2`, tool: 'edit', args: { file_path: P('a5tools_write.txt'), old_string: `${TOK_WRITE}-A1 lives here`, new_string: `${TOK_EDITED}-B2 replaced it` } },
      { marker: 'READC3', tool: 'read', args: { file_path: P('a5tools_write.txt') } },
      { marker: 'IMGD4', tool: 'read_image', args: { file_path: P('seed.png') } },
      { marker: `${TOK_SRE}-E5`, tool: 'str_replace_editor', args: { command: 'create', path: P('a5tools_sre.txt'), file_text: `sre create\n${TOK_SRE}-E5\n` } },
      { marker: 'GLOBF6', tool: 'glob', args: { pattern: 'a5tools_*.txt', path: W.governedRoot } },
      { marker: 'GREPG7', tool: 'grep', args: { pattern: TOK_GREP, path: W.governedRoot, output_mode: 'content' } },
      { marker: `${TOK_BASH}-H8`, tool: 'bash', args: { command: `echo ${TOK_BASH}-H8 && echo ${TOK_BASH}-H8 > ${join(W.governedRoot, 'bashw.txt')} && cat ${join(W.governedRoot, 'bashw.txt')}` } },
      // layer-3 probes (BOOKED findings, not lane verdicts): which body path
      // serves a read OUTSIDE the governed root, and does a legacy-form write
      // land outside (absence of an I/O execution mediator in legacy form).
      { marker: 'OUTREAD-X9', tool: 'read', args: { file_path: join(W.outsideDir, 'secret.txt') } },
      { marker: 'OUTWRITE-Y10', tool: 'write', args: { file_path: join(W.outsideDir, 'a5tools_wide_outside.txt'), content: `${TOK_WRITE}-OUTSIDE\n` } },
    ]
  }
  if (mode === 'lanes') {
    return [
      { marker: `${TOK_WRITE}-L1`, tool: 'write', args: { file_path: P('allowed.txt'), content: `${TOK_WRITE}-L1\n` } },
      { marker: 'FORBIDL2', tool: 'read', args: { file_path: P('forbidden.txt') } },
      { marker: `${TOK_WRITE}-L3`, tool: 'write', args: { file_path: join(W.outsideDir, 'gov-write.txt'), content: `${OUTSIDE_MARKER}\n` } },
      { marker: 'IMGL4', tool: 'read_image', args: { file_path: P('seed.png') } },
      { marker: `${TOK_BASH}-L5`, tool: 'bash', args: { command: `echo ${TOK_BASH}-L5` } },
      { marker: 'SREL6', tool: 'str_replace_editor', args: { command: 'create', path: P('a5tools_sre_denied.txt'), file_text: 'must not exist\n' } },
      // layer-3 check→execute object-fixing attack: the CHECKED path is
      // inside the allow subtree; the symlink's TARGET is outside. A
      // canonicalizer that follows the link denies; one that does not (or a
      // body that re-resolves) mutates the victim outside — zero-victim-
      // mutation is the criterion, the refusal shape is booked verbatim.
      { marker: 'SYMTGT-A7', tool: 'write', args: { file_path: P('link-victim.txt'), content: `${OUTSIDE_MARKER}-ATTACK\n` } },
      { marker: 'SYMTGT-A8', tool: 'read', args: { file_path: P('link-victim.txt') } },
    ]
  }
  if (mode === 'ask') {
    return [
      { marker: `${TOK_WRITE}-Q1`, tool: 'write', args: { file_path: P('ask-allowed.txt'), content: `${TOK_WRITE}-Q1\n` } },
      { marker: `${TOK_WRITE}-Q2`, tool: 'write', args: { file_path: P('ask-denied.txt'), content: `${TOK_WRITE}-Q2\n` } },
    ]
  }
  // unmanaged: one trivial read for wa2 (wa never gets to run: its setup FATALs)
  return [
    { marker: 'READU9', tool: 'read', args: { file_path: P('notes.txt') } },
  ]
}

function memberPersona (mode, W) {
  const steps = stepsFor(mode, W)
  const enumerated = steps.map((s, i) => `(${String(i + 1)}) tool ${s.tool} with ${yamlQuoted(s.args)}`).join('; ')
  return `You are worker A of the a5tools-gov ${mode} team. On your delegated directive you MUST work EXACTLY in this order, one tool call per turn: ${enumerated}; then (final) answer with ONE line starting A5TOOLS_MEMBER_RESULT quoting each of the ${String(steps.length)} tool results you received, verbatim. Never invent a tool result; always wait for the real one.`
}

function mainBlueprintYaml ({ mode, BP_MAIN_ID, CREATE_ROOT, TK_A1, W, denyList, leaderDeny = null, strictMember, extraTemplates = '' }) {
  const steps = stepsFor(mode, W)
  const enumerated = steps.map((s, i) => `(${String(i + 1)}) tool ${s.tool} with ${yamlQuoted(s.args)}`).join('; ')
  const taskA = mode === 'unmanaged'
    ? 'Work EXACTLY in this order, one tool call per turn: (1) tool read with {"file_path":' + yamlQuoted(join(W.governedRoot, 'notes.txt')) + '}; then (final) answer with ONE line starting A5TOOLS_MEMBER_RESULT quoting the tool result verbatim.'
    : `Work EXACTLY in this order, one tool call per turn: ${enumerated}; then (final) answer with ONE line starting A5TOOLS_MEMBER_RESULT quoting each of the ${String(steps.length)} tool results you received, verbatim.`
  const leaderDelegation = mode === 'unmanaged'
    ? `FIRST call team_delegate exactly once with rootSessionId ${CREATE_ROOT}, requestToken ${TK_A1}-no, delegationTemplateId "wa", label "gov-no", async false, and the prompt ${yamlQuoted(taskA)}; SECOND call team_delegate exactly once with rootSessionId ${CREATE_ROOT}, requestToken ${TK_A1}-ok, delegationTemplateId "wa2", label "gov-ok", async false, and the SAME prompt; THIRD call team_collect with rootSessionId ${CREATE_ROOT} and requestTokens ["${TK_A1}-no","${TK_A1}-ok"]; FOURTH answer with ONE line starting A5TOOLS_LEADER_RESULT quoting both delegation results verbatim; then finish.`
    : `FIRST call team_delegate exactly once with rootSessionId ${CREATE_ROOT}, requestToken ${TK_A1}, delegationTemplateId "wa", label "gov-a", async false, and the prompt ${yamlQuoted(taskA)}; SECOND call team_collect with rootSessionId ${CREATE_ROOT} and requestTokens ["${TK_A1}"]; THIRD answer with ONE line starting A5TOOLS_LEADER_RESULT quoting the member result verbatim; then finish.`
  const leaderPersona = `You are the leader of the a5tools-gov ${mode} team. On your directive: ${leaderDelegation}`
  const denyBlock = (pad, list = denyList) => list.length === 0 ? [`${pad}builtinToolDeny: []`] : [`${pad}builtinToolDeny:`, ...list.map((n) => `${pad}  - ${n}`)]
  const lines = [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
    `displayName: "a5tools-gov ${mode} team"`,
    `description: "A-route native-tool governance acceptance (${mode}) on the REAL installed face. Mock only at the LLM position."`,
    'leader:', '  templateId: leader', `  persona: ${yamlQuoted(leaderPersona)}`,
    '  capabilities:', '    teamTools:', '      kind: allow', '      items:', '        - team_delegate', '        - team_collect', '        - team_list_pending_control', '        - team_resolve_control',
    ...denyBlock('    ', leaderDeny ?? denyList),
    '    skills:', '      kind: allow', '      items: []',
    '    mcp:', '      kind: allow', '      items: []',
    '    permissions:', '      default: ask', '      allow: []', '      ask: []', '      deny: []',
    'teamEnvelope:', '  allow:', '    - assign-task', '    - create-member', '    - send-message', '    - report-progress', '    - request-control', '    - resolve-control', '  deny: []',
    'members:',
    '  - templateId: wa', `    displayName: "a5tools-gov ${mode} worker A"`,
    `    persona: ${yamlQuoted(memberPersona(mode, W))}`,
    ...(strictMember
      ? (mode === 'lanes'
        ? [
            '    capabilities:', '      teamTools:', '        kind: allow', '        items: []',
            ...denyBlock('      '),
            '      skills:', '        kind: allow', '        items: []',
            '      mcp:', '        kind: allow', '        items: []',
            '      permissions:', '        default: deny',
            '        allow:',
            ...['read', 'write', 'edit', 'read_image'].flatMap((t) => [`          - tool: ${t}`, '            resource:', '              kind: subtree', `              path: ${W.governedRoot}`]),
            '        ask: []',
            '        deny:', '          - tool: read', '            resource:', '              kind: exact', `              path: ${join(W.governedRoot, 'forbidden.txt')}`,
          ]
        : mode === 'ask'
          ? [
              '    capabilities:', '      teamTools:', '        kind: allow', '        items: []',
              ...denyBlock('      '),
              '      skills:', '        kind: allow', '        items: []',
              '      mcp:', '        kind: allow', '        items: []',
              '      permissions:', '        default: ask', '        allow: []', '        ask: []', '        deny: []',
            ]
          : mode === 'unmanaged'
            ? [
                '    capabilities:', '      teamTools:', '        kind: allow', '        items: []',
                ...denyBlock('      '),
                '      skills:', '        kind: allow', '        items: []',
                '      mcp:', '        kind: allow', '        items: []',
                '      permissions:', '        default: deny',
                '        allow:', '          - tool: read', '            resource:', '              kind: subtree', `              path: ${W.governedRoot}`,
                '        ask: []', '        deny: []',
              ]
            : [])
      : []),
    extraTemplates,
    'memberEnvelopes:', '  - templateId: wa', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '        - request-control', '      deny: []',
    ...(mode === 'unmanaged'
      ? ['  - templateId: wa2', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '        - request-control', '      deny: []']
      : []),
    'permissionMutationEnvelope:', '  rules: []', 'teamHardEnvelope:', '  rules: []',
    'requirements:', '  - domain: persona', '    name: standard',
    'policyStates: []', 'metadata: {}', '---', '',
  ].filter((l) => l !== '')
  return lines.join('\n')
}

/** wa2 for the unmanaged mode: same strict shape as wa but WITH the deny. */
function wa2Template (denyList, W) {
  const denyBlock = denyList.length === 0 ? ['      builtinToolDeny: []'] : ['      builtinToolDeny:', ...denyList.map((n) => `        - ${n}`)]
  return [
    '  - templateId: wa2', '    displayName: "a5tools-gov unmanaged worker B (deny applied)"',
    '    persona: "You are worker B of the a5tools-gov unmanaged team. Follow the delegated directive exactly, one tool call per turn, and quote the real result verbatim on a final line starting A5TOOLS_MEMBER_RESULT."',
    '    capabilities:', '      teamTools:', '        kind: allow', '        items: []',
    ...denyBlock,
    '      skills:', '        kind: allow', '        items: []',
    '      mcp:', '        kind: allow', '        items: []',
    '      permissions:', '        default: deny',
    '        allow:', '          - tool: read', '            resource:', '              kind: subtree', `              path: ${W.governedRoot}`,
    '        ask: []', '        deny: []',
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
    staticModel: { provider: 'deepseek-official', model: MODEL_ID },
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
  cfg.teamToolPlane = {
    realmId: `a5tools-gov-${mode}-realm`,
    fsInstance: { fs: `a5tools-gov-${mode}-ctl`, rootDir: world.governedRoot, realmId: `a5tools-gov-${mode}-realm`, kind: 'absolute-path' },
    confinedProvider: {
      trustRoot: `sha256:${launcher.sha.slice(0, 16)}#${launcher.path}`,
      assembly: { launcherPath: launcher.path, launcherSha256: launcher.sha, minAbiVersion: 3 },
    },
  }
  return cfg
}

// ─── wire digest ─────────────────────────────────────────────────────────────
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
  return { msgCount: msgs.length, toolCount: toolNames === null ? 0 : toolNames.length, toolNames, assistantToolNames, toolResults, markerHits: [], _text: text }
}

// ─── control ledger (read-only scan of the durable domain store) ─────────────
function readControlLedger (HOME, root) {
  const out = { requests: [], decisions: [], consumptions: [], error: null }
  try {
    const parsed = JSON.parse(readFileSync(join(HOME, 'storages', 'team_domain.json'), 'utf8'))
    const ledger = parsed?.tables?.ledger
    if (ledger === null || typeof ledger !== 'object') { out.error = 'no ledger table'; return out }
    for (const [k, v] of Object.entries(ledger)) {
      if (k === '__ledger_sequence_counter' || typeof v !== 'string') continue
      let entry
      try { entry = JSON.parse(v) } catch { continue }
      if (String(entry?.rootSessionId) !== root) continue
      const payload = entry?.payload ?? {}
      if (entry.factType === 'control-request-recorded') {
        out.requests.push({ sequence: Number(k), requestId: payload.requestId, kind: payload.kind, toolName: payload.toolName, actionName: payload.actionName, targetInstanceId: payload.targetInstanceId, status: payload.status })
      } else if (entry.factType === 'control-decision-recorded') {
        out.decisions.push({ sequence: Number(k), requestId: payload.requestId, decision: payload.decision, resolver: payload.resolver ?? payload.resolvedBy })
      } else if (entry.factType === 'control-allow-consumed') {
        out.consumptions.push({ sequence: Number(k), requestId: payload.requestId })
      }
    }
  } catch (error) { out.error = String(error?.message ?? error) }
  return out
}

// ─── the world driver ────────────────────────────────────────────────────────
let HOST_BIN = ''
let TESTUSE = ''
let faceReference = null
let face = null
let faceMirror = ''
let MK = ''

async function runWorld ({ mode, mock }) {
  const HOME = join(HOMES_ROOT, `${WORLD_PREFIX}-${mode}-${RUN_STAMP}`)
  const BLUEPRINT_DIR = join(EVIDENCE_DIR, 'blueprints', mode)
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  const INSTANCE_RAW = join(EVIDENCE_DIR, `instance-${mode}.raw.log`)
  const INSTANCE_LOG = join(EVIDENCE_DIR, `instance-${mode}.log`)
  const CREATE_ROOT = `session-a5tools-gov-team-${mode}-${RUN_STAMP}`
  const BP_MAIN_ID = `a5tools-gov-${mode}-bp`
  const TK_A1 = `a5tools-gov-tok-${mode}`
  const W = {
    governedRoot: join(HOME, 'workspace', 'governed'),
    outsideDir: join(HOME, 'workspace', 'outside'),
  }
  const facts = { mode, home: HOME, ok: false, createRoot: CREATE_ROOT }
  const steps = stepsFor(mode, W)
  let host = null
  let hostExit = null
  let reqBase = 0
  try {
    if (!(await portFree(HOST_PORT))) die(`port ${HOST_PORT} not free before the ${mode} world`)
    mkdirSync(join(HOME, 'workspace'), { recursive: true })
    mkdirSync(W.governedRoot, { recursive: true })
    mkdirSync(W.outsideDir, { recursive: true })
    writeFileSync(join(W.governedRoot, 'notes.txt'), `line one\n${TOK_GREP} lives here\n`)
    writeFileSync(join(W.governedRoot, 'forbidden.txt'), `${FORBIDDEN_MARKER}\n`)
    writeFileSync(join(W.outsideDir, 'secret.txt'), `${OUTSIDE_MARKER}\n`)
    writeFileSync(join(W.governedRoot, 'seed.png'), png1x1())
    // layer-3 fixtures: victim OUTSIDE + a symlink INSIDE pointing at it.
    writeFileSync(join(W.outsideDir, 'victim.txt'), `A5TOOLS-VICTIM-ORIGINAL-${RUN_STAMP}\n`)
    try { symlinkSync(join(W.outsideDir, 'victim.txt'), join(W.governedRoot, 'link-victim.txt')) } catch { /* exists */ }
    const treeFp = () => walkFiles(HOME).filter((r) => !r.startsWith('node_modules/') && !r.includes('/node_modules/') && !r.endsWith('.sock')).map((r) => `${r}:${sha256File(join(HOME, r))}`)

    const install = realInstall({ world: HOME, logName: `install-${mode}.log` })
    if (install.exit !== 0) die(`${mode} real install failed (exit=${String(install.exit)}): ${install.outputTail}`)
    const m = measureInstalledFace(install.installedDir, face, faceMirror)
    check(`W.${mode}.install`, `the ${mode} world boots on a REAL installed face with three zeros and the probe rootSha`,
      install.exit === 0 && m.missing.length === 0 && m.extra.length === 0 && m.shaMismatch.length === 0 && m.rootSha === faceReference.rootSha,
      `exit=${String(install.exit)} n=${String(m.actualCount)}/${String(m.expectedCount)} rootSha=${m.rootSha.slice(0, 16)}${m.rootSha === faceReference.rootSha ? '==probe' : '!=probe'}`)

    const launcher = materializeLauncher(EXPECTED_SHA, join(HOME, 'deployment', 'landlock-prelauncher.py'))
    facts.launcher = { sha: launcher.sha.slice(0, 16), match: launcher.bytesMatchCommitAndWorktree }

    const basePlugins = [
      ...smokePresetPlugins({
        personaText: 'You are a coding agent powered by the {{model}} model.',
        cwdSuffix: 'Your working directory is {{cwd}}.',
        bashDescription: 'Run commands in a bash shell.',
      }),
      { id: 'tool-fs-search', name: '@deepseek-ai/dsh-tool-fs-search', config: { sampleOverCapGlobResults: false } },
      { id: 'tool-str-replace-editor', name: '@deepseek-ai/dsh-tool-str-replace-editor' },
    ]
    const cfg = rowConfig(mode, BLUEPRINT_DIR, W, launcher)
    const lines = [
      `# a5tools-gov live layer (run ${RUN_STAMP}, mode ${mode}): config override on the INSTALLED bundle row + preset — public profile-patch seam only.`,
      '- id: dsh-agent-team',
      '  name: dsh-agent-team/host',
      '  config:',
      ...Object.entries(cfg).flatMap(([k, v]) => yamlEmit(k, v, 2)),
      ...['- insert:', ...yamlEmitItem(presetDeclarationRow({
        id: PRESET_ID, displayName: 'a5tools-gov base',
        description: `a5tools-gov base preset (run ${RUN_STAMP}) = smoke preset + tool-fs-search + tool-str-replace-editor`, plugins: basePlugins,
      }), 1)],
      '',
    ].join('\n').split('\n')
    writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), lines.join('\n'))
    writeFileSync(join(EVIDENCE_DIR, `profile-layer-${mode}.yml`), redact(lines.join('\n')))

    facts.treeFingerprintBefore = treeFp()
    facts.victimBefore = readFileSync(join(W.outsideDir, 'victim.txt'), 'utf8')
    reqBase = mock.requests.length
    let stormBase = reqBase
    const stormCheck = (where) => {
      const mine = mock.requests.length - stormBase
      if (mine > 300) {
        writeEvidence(`storm-diagnostic-${mode}.json`, { where, worldRequests: mine })
        die(`MODEL-CALL STORM (${mode}): ${String(mine)} requests at "${where}"`)
      }
    }

    const outFd = openSync(INSTANCE_RAW, 'a')
    host = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(HOST_PORT), '--no-open'], {
      cwd: join(HOME, 'workspace'),
      stdio: ['ignore', outFd, outFd],
      env: {
        ...process.env, DSH_HOME: HOME, DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH,
        DEEPSEEK_BASE_URL: `http://127.0.0.1:${mock.port}`, DEEPSEEK_API_KEY: 'a5tools-gov-mock-key',
      },
    })
    host.on('exit', (code, signal) => { hostExit = { code, signal }; console.log(`[${mode}] host exited code=${String(code)} signal=${String(signal)}`) })
    const boot = await waitFor(180_000, () => {
      try { const mm = BOOT_MARKER.exec(readFileSync(INSTANCE_RAW, 'utf8')); return mm === null ? false : mm } catch { return false }
    }, `${mode} boot marker`)
    facts.bootLine = redact(String(boot[0])).slice(0, 200)
    const origin = `http://127.0.0.1:${boot[1]}`
    const auth = await fetch(`${origin}/?token=${boot[2]}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
    const cookie = auth.headers.get('set-cookie')
    if (!(auth.status === 303 && cookie !== null)) die(`${mode} token gate ${String(auth.status)}`)

    const wireHit = (needle) => (mock.requests ?? []).slice(reqBase).find((r) => r.digest !== undefined && r.digest.markerHits.includes(needle) && r.digest.toolCount > 0)
    async function promptBarrier ({ sessionId, textBase, rpcTag, attempts = 12, perAttemptMs = 30_000 }) {
      let lastStatus = 0
      for (let k = 1; k <= attempts; k += 1) {
        stormCheck(`barrier ${textBase.slice(0, 30)} attempt ${String(k)}`)
        const res = await fetchJson(`${origin}/api/session/prompt`, {
          method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
          body: JSON.stringify({ type: 'client-request', rpcId: `${rpcTag}-a${k}`, method: 'session/prompt', payload: { args: { request: { requestId: `${rpcTag}-a${k}-r`, sessionId, mode: 'queue', content: [{ type: 'text', text: `${textBase} (barrier probe ${k}) This is a setup turn. Do not call any tools. Reply OK.` }] } } } }),
        }, 240_000)
        lastStatus = res.status
        const hit = await waitQuiet(perAttemptMs, async () => wireHit(textBase))
        if (hit) return { hit, attempts: k, lastStatus }
      }
      die(`barrier: no wire request for "${textBase.slice(0, 40)}…" after ${attempts} attempts (last HTTP ${lastStatus})`)
    }

    // Surface discovery on the root agent (same preset as the members).
    const MKD = `${MK}_${mode.toUpperCase()}_DISC`
    const disc = await promptBarrier({ sessionId: ROOT, textBase: MKD, rpcTag: `a5t-${mode}-d` })
    const surface = [...new Set(disc.hit.digest.toolNames ?? [])].sort()
    const denyList = surface.filter((n) => !n.startsWith('team_') && !MANAGED_TOOL_NAMES.includes(n) && !SAFE_UNMANAGED_TOOL_NAMES.includes(n))
    facts.discoverySurface = surface
    facts.derivedDenyList = denyList
    check(`S.${mode}.surface`, `the ${mode} root-agent wire surface really carries the preset-native tools under test (read/write/edit/read_image/glob/grep/bash/str_replace_editor — governance reaches the REAL surface)`,
      ['read', 'write', 'edit', 'read_image', 'glob', 'grep', 'bash', 'str_replace_editor'].every((n) => surface.includes(n)),
      `surface=${JSON.stringify(surface)}`)

    const MKT = `${MK}_${mode.toUpperCase()}_TASK_A`
    const blueprint = mainBlueprintYaml({
      mode, BP_MAIN_ID, CREATE_ROOT, TK_A1, W,
      denyList: mode === 'unmanaged' ? [] : denyList,
      leaderDeny: mode === 'unmanaged' ? denyList : null,
      strictMember: mode === 'lanes' || mode === 'ask' || mode === 'unmanaged',
      extraTemplates: mode === 'unmanaged' ? wa2Template(denyList, W) : '',
    })
    writeFileSync(join(BLUEPRINT_DIR, 'main.yaml'), blueprint)

    const cl = await fetchJson(`${origin}/team-remote/catalog.list`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
      body: JSON.stringify({ type: 'client-request', rpcId: 'a5t-pre-1', method: 'catalog.list', payload: { version: 4, params: {} } }),
    }, 30_000)
    facts.catalogPreflight = { listStatus: cl.status, listed: JSON.stringify(cl.body ?? '').includes(BP_MAIN_ID) }

    const created = await fetchJson(`${origin}/team-remote/team.create`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
      body: JSON.stringify({ type: 'client-request', rpcId: `a5t-${mode}-tc`, method: 'team.create', payload: { version: 1, params: { rootSessionId: CREATE_ROOT, blueprintId: BP_MAIN_ID, initialWork: { prompt: `${MK}_${mode.toUpperCase()}_L0 Begin your directive.` } } } }),
    }, 90_000)
    facts.teamCreate = { status: created.status, body: redact(JSON.stringify(created.body ?? null)).slice(0, 800) }

    // ask mode: the durable approvals are resolved by the LEADER through
    // the shipped leader-lane tools (team_list_pending_control →
    // team_resolve_control; resolver roles 'leader-approval -> leader|human',
    // tools.ts:1019). The earlier 'human v4 lane HANGS' reading was a
    // MISATTRIBUTION (a5-r5-probe ROOT-CAUSE.md: resolve answers in 11-25ms;
    // the 240s wait was the v1 create RPC's Phase-B response coupling — R-5
    // 改判 in TOOLS.md, semantics HOLD). Acceptance rides the product lane.
    const askActions = []
    if (mode === 'ask') A5T_ASK_STATE.ask = { resolved: [], polls: 0 }

    const chain = await waitFor(1_200_000, async () => {
      stormCheck(`${mode} chain`)
      const memberFinal = (mock.requests ?? []).slice(reqBase).find((r) => r.digest?.markerHits.includes(MKT) && !r.digest.markerHits.includes(`${MK}_${mode.toUpperCase()}_L0`) && JSON.stringify(r.reply ?? '').includes('A5TOOLS_MEMBER_RESULT'))
      if (memberFinal === undefined) return false
      const lastMember = [...(mock.requests ?? []).slice(reqBase)].reverse().find((r) => r.digest?.markerHits.includes(MKT) && !r.digest.markerHits.includes(`${MK}_${mode.toUpperCase()}_L0`) && r.digest.toolCount > 0)
      const leaderFinal = (mock.requests ?? []).slice(reqBase).find((r) => r.digest?.markerHits.includes(`${MK}_${mode.toUpperCase()}_L0`) && JSON.stringify(r.reply ?? '').includes('A5TOOLS_LEADER_RESULT'))
      return { member: lastMember, leaderFinal }
    }, `${mode} member completed its ladder`)

    const memberReqs = (mock.requests ?? []).slice(reqBase).filter((r) => r.digest?.markerHits.includes(MKT) && !r.digest.markerHits.includes(`${MK}_${mode.toUpperCase()}_L0`) && r.digest.toolCount > 0)
    const lastMember = chain.member
    facts.memberAWireCatalog = [...new Set(lastMember?.digest.toolNames ?? [])].sort()
    facts.memberToolCallOrder = lastMember?.digest.assistantToolNames ?? []
    facts.memberToolResults = (lastMember?.digest.toolResults ?? []).map((x) => redact(x))
    facts.memberFinal = redact(JSON.stringify(lastMember?.reply ?? null)).slice(0, 1600)
    if (mode === 'unmanaged') {
      const leaderFinalReq = chain.leaderFinal
      facts.leaderFinalText = leaderFinalReq === undefined ? null : redact(String(leaderFinalReq.digest._text).slice(-6000))
    }

    // fs side effects (the execution receipts)
    facts.fs = {
      writeTxt: existsSync(join(W.governedRoot, 'a5tools_write.txt')) ? readFileSync(join(W.governedRoot, 'a5tools_write.txt'), 'utf8') : null,
      sreTxt: existsSync(join(W.governedRoot, 'a5tools_sre.txt')) ? readFileSync(join(W.governedRoot, 'a5tools_sre.txt'), 'utf8') : null,
      bashWrote: existsSync(join(W.governedRoot, 'bashw.txt')) ? readFileSync(join(W.governedRoot, 'bashw.txt'), 'utf8') : null,
      allowedTxt: existsSync(join(W.governedRoot, 'allowed.txt')) ? readFileSync(join(W.governedRoot, 'allowed.txt'), 'utf8') : null,
      outsideGovWrite: existsSync(join(W.outsideDir, 'gov-write.txt')),
      sreDeniedTxt: existsSync(join(W.governedRoot, 'a5tools_sre_denied.txt')),
      bashDeniedSide: existsSync(join(W.governedRoot, 'bashw.txt')),
      askAllowedTxt: existsSync(join(W.governedRoot, 'ask-allowed.txt')) ? readFileSync(join(W.governedRoot, 'ask-allowed.txt'), 'utf8') : null,
      askDeniedTxt: existsSync(join(W.governedRoot, 'ask-denied.txt')),
    }
    const wireAll = (mock.requests ?? []).slice(reqBase).map((r) => JSON.stringify({ reply: r.reply ?? null, digest: r.digest === undefined ? null : { toolResults: r.digest.toolResults.map((x) => redact(x)) } }))
    facts.forbiddenMarkerOnWire = wireAll.filter((s) => s.includes(FORBIDDEN_MARKER)).length
    facts.wideOutsideWrite = existsSync(join(W.outsideDir, 'a5tools_wide_outside.txt')) ? readFileSync(join(W.outsideDir, 'a5tools_wide_outside.txt'), 'utf8') : null
    facts.factsControlLedger = readControlLedger(HOME, CREATE_ROOT)
    if (mode === 'ask') facts.askActions = askActions
    facts.ok = true
    return facts
  } finally {
    writeEvidence(`world-${mode}.partial.json`, facts)
    try { if (host !== null) host.kill() } catch { /* gone */ }
    await new Promise((r) => setTimeout(r, 3000))
    facts.hostExit = hostExit
    try {
      const lineList = (mock.requests ?? []).slice(reqBase).map((r) => JSON.stringify({
        seq: r.seq, status: r.status,
        digest: r.digest === undefined ? null : { toolCount: r.digest.toolCount, markerHits: r.digest.markerHits.filter((x) => x.startsWith('A5TOOLS')), assistantToolNames: r.digest.assistantToolNames, toolResults: r.digest.toolResults.map((x) => redact(x)), _text: `${String(r.digest._text.length)} chars` },
      }))
      writeFileSync(join(EVIDENCE_DIR, `wire-digests-${mode}.jsonl`), lineList.join('\n') + '\n')
    } catch { /* best effort */ }
    try {
      const raw = readFileSync(INSTANCE_RAW, 'utf8')
      facts.hostErrors = raw.split('\n').filter((l) => /ERR_MODULE_NOT_FOUND|bootstrap FAILED|TRUST_ROOT|placement-REFUSED|mount-REFUSED|BINDING_UNVERIFIED|TEAM_PLUGIN_CONFIG_INVALID|PLANE_CONFIG|coverage-unmanaged|permission-coverage|unmanaged-tools|unhandled/i.test(l)).slice(0, 30).map((l) => redact(l).slice(0, 400))
      writeFileSync(INSTANCE_LOG, redact(raw))
      rmSync(INSTANCE_RAW)
    } catch { /* no log */ }
    try {
      facts.treeFingerprintAfter = treeFp()
    } catch { /* the after-fingerprint is best effort (large installed tree); never masks the capture below */ }
    try {
      facts.secretAfter = existsSync(join(W.outsideDir, 'secret.txt')) ? readFileSync(join(W.outsideDir, 'secret.txt'), 'utf8') : null
      facts.victimAfter = existsSync(join(W.outsideDir, 'victim.txt')) ? readFileSync(join(W.outsideDir, 'victim.txt'), 'utf8') : null
      facts.victimMarkerOnWire = (mock.requests ?? []).slice(reqBase)
        .map((r) => JSON.stringify(r.digest === undefined ? {} : { toolResults: (r.digest.toolResults ?? []).map((x) => redact(x)), text: r.digest._text ?? '' }))
        .filter((x) => x.includes('A5TOOLS-VICTIM-ORIGINAL')).length
    } catch { /* the failure path keeps its partial facts; never mask the original error */ }
    if (!KEEP) { try { rmSync(HOME, { recursive: true, force: true }) } catch { /* best effort */ } }
    facts.swept = !existsSync(HOME)
  }
}

// ─── tiny YAML emitter (VERBATIM from the a5glob-off precedent kit) ─────────
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

// ─── main ────────────────────────────────────────────────────────────────────
const rnd = () => Math.random().toString(36).slice(2, 10)
const toolCall = (id, name, argsObj) => ({ kind: 'tool-call', toolCalls: [{ id, name, arguments: argsObj }] })

async function main () {
  // --dry: emit every mode's blueprint + profile layer and exit (shape check
  // only — NOT an acceptance run; the real deny list is derived from the live
  // surface at boot, here a stub stands in).
  if (flag('dry')) {
    const stubDeny = ['str_replace_editor', 'glob', 'grep']
    for (const mode of MODES) {
      const W = L0_W[mode]
      const blueprint = mainBlueprintYaml({
        mode, BP_MAIN_ID: `a5tools-gov-${mode}-bp`, CREATE_ROOT: L0_CREATE_ROOTS[mode], TK_A1: `a5tools-gov-tok-${mode}`, W,
        denyList: mode === 'unmanaged' ? [] : stubDeny,
        leaderDeny: mode === 'unmanaged' ? stubDeny : null,
        strictMember: mode === 'lanes' || mode === 'ask' || mode === 'unmanaged',
        extraTemplates: mode === 'unmanaged' ? wa2Template(stubDeny, W) : '',
      })
      writeFileSync(join(EVIDENCE_DIR, `dry-blueprint-${mode}.yaml`), blueprint)
      const launcher = { path: '/dry/launcher.py', sha: '0'.repeat(64) }
      const cfg = rowConfig(mode, '/dry/bp', W, launcher)
      const layer = [
        '- id: dsh-agent-team', '  name: dsh-agent-team/host', '  config:',
        ...Object.entries(cfg).flatMap(([k, v]) => yamlEmit(k, v, 2)),
        ...['- insert:', ...yamlEmitItem(presetDeclarationRow({
          id: PRESET_ID, displayName: 'a5tools-gov base', description: 'dry',
          plugins: [...smokePresetPlugins({ personaText: 'p', cwdSuffix: 'c', bashDescription: 'b' }),
            { id: 'tool-fs-search', name: '@deepseek-ai/dsh-tool-fs-search', config: { sampleOverCapGlobResults: false } },
            { id: 'tool-str-replace-editor', name: '@deepseek-ai/dsh-tool-str-replace-editor' }],
        }), 1)],
        '',
      ].join('\n')
      writeFileSync(join(EVIDENCE_DIR, `dry-layer-${mode}.yml`), layer)
    }
    console.log(`DRY written at ${EVIDENCE_DIR}`)
    return 0
  }
  const stale = existsSync(HOMES_ROOT) ? readdirSync(HOMES_ROOT).filter((d) => d.startsWith(`${WORLD_PREFIX}-`)) : []
  for (const d of stale) { try { rmSync(join(HOMES_ROOT, d), { recursive: true, force: true }) } catch { /* best effort */ } }
  writeEvidence('start-sweep.json', { staleHomes: stale, homesRoot: HOMES_ROOT, storeDir: STORE_DIR, srcRoot: SRC })
  TESTUSE = testUseTree(SRC)
  if (!existsSync(join(TESTUSE, 'apps/cli/lib/bin.js'))) TESTUSE = testUseTree(MAIN_CHECKOUT)
  HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
  console.log(`a5tools-gov kit stamp=${RUN_STAMP} src=${SRC} testuse=${TESTUSE} sha=${EXPECTED_SHA}`)

  const head = gitAt(TESTUSE, 'rev-parse', 'HEAD')
  const porcelainBefore = gitAt(TESTUSE, 'status', '--porcelain')
  check('H1', `the test-use host is the pinned pristine runtime @${TEST_USE_BASELINE_SHA.slice(0, 10)} with porcelain clean before`,
    head === TEST_USE_BASELINE_SHA && porcelainBefore === '', `head=${head.slice(0, 10)} porcelain=${porcelainBefore === '' ? 0 : 'DIRTY'}`)

  const lsSrc = spawnSync('git', ['-C', SRC, 'ls-remote', 'origin', `refs/heads/a5-tools-gov`, 'refs/heads/master'], { encoding: 'utf8', timeout: 180_000 }).stdout
  writeEvidence('sha-pin.json', {
    expected: EXPECTED_SHA, lsRemoteRaw: lsSrc.split('\n').slice(0, 4), srcWorktreeHead: gitAt(SRC, 'rev-parse', 'HEAD'),
    note: 'the graded SHA is either origin/master (the frozen candidate) or the a5-tools-gov branch tip; install spec references it directly',
  })
  const reachable = spawnSync('git', ['-C', SRC, 'cat-file', '-e', `${EXPECTED_SHA}^{commit}`], { encoding: 'utf8' }).status === 0
  check('H1b', `the graded SHA ${EXPECTED_SHA} exists in the pinned source repo and the source worktree is on branch a5-tools-gov`,
    reachable && gitAt(SRC, 'branch', '--show-current') === 'a5-tools-gov',
    `exists=${String(reachable)} branch=${gitAt(SRC, 'branch', '--show-current')}`)
  INSTALL_SPEC = `github:ArmourPiercer1/dsh-agent-team#${EXPECTED_SHA}`

  if (!(await portFree(MOCK_PORT))) die(`mock port ${MOCK_PORT} busy`)
  const stableBefore = await stableProbe()
  check('H0', 'the stable :3080 instance answers read-only before this run (probe only, never touched)', stableBefore !== 'unreachable', `status=${String(stableBefore)}`)

  // ── PHASE I: the real install probe ────────────────────────────────────────
  const INSTALL_HOME = join(HOMES_ROOT, `${WORLD_PREFIX}-probe-${RUN_STAMP}`)
  mkdirSync(join(INSTALL_HOME, 'workspace'), { recursive: true })
  face = declaredFace(EXPECTED_SHA)
  faceMirror = materializeDeclaredFace(EXPECTED_SHA, face)
  const probe = realInstall({ world: INSTALL_HOME, logName: 'install-probe.log' })
  if (probe.exit !== 0) die(`install probe failed (exit=${String(probe.exit)}): ${probe.outputTail}`)
  const m = measureInstalledFace(probe.installedDir, face, faceMirror)
  const deps = Object.keys(probe.manifest?.dependencies ?? {})
  const bundles = probe.manifest?.dsh?.profile?.bundles ?? []
  writeEvidence('install-manifest.json', {
    spec: INSTALL_SPEC, sha: EXPECTED_SHA, exit: probe.exit, seconds: probe.seconds,
    dependencies: probe.manifest?.dependencies ?? null, bundles, nodeModulesTop: probe.nodeModulesTop,
    fileCount: m.actualCount, expectedCount: m.expectedCount, missing: m.missing, extra: m.extra, shaMismatch: m.shaMismatch, rootSha: m.rootSha,
  })
  check('I1', 'REAL install through the host public package face — `dsh plugin --profile web add github:…#<sha>` — exits 0',
    probe.exit === 0, `exit=${String(probe.exit)} in ${String(probe.seconds)}s tail=${probe.outputTail.slice(0, 160)}`)
  check('I2', 'the profile face is strict-single-plugin and the reconciler appended the dsh-agent-team bundle row',
    deps.length === 1 && deps[0] === 'dsh-agent-team' && bundles.includes('dsh-agent-team'),
    `deps=${JSON.stringify(deps)} bundles=${JSON.stringify(bundles)}`)
  check('I3', 'INSTALL THREE-ZEROS: missing=0, extra=0, sha≠=0 against the commit mirror; rootSha recorded',
    m.missing.length === 0 && m.extra.length === 0 && m.shaMismatch.length === 0,
    `n=${String(m.actualCount)}/${String(m.expectedCount)} miss=${String(m.missing.length)} extra=${String(m.extra.length)} sha≠=${String(m.shaMismatch.length)} rootSha=${m.rootSha}`)
  faceReference = { rootSha: m.rootSha, fromProbe: true }
  try { rmSync(INSTALL_HOME, { recursive: true, force: true }) } catch { /* best effort */ }

  // ── mock at the LLM slot ──────────────────────────────────────────────────
  MK = `A5TOOLS_${RUN_STAMP.replace(/[^A-Za-z0-9]/g, '')}`
  const mock = await startMockModelWithDecide()

  // ── worlds ────────────────────────────────────────────────────────────────
  const worldFacts = {}
  for (const mode of MODE_RUN) {
    worldFacts[mode] = await runWorld({ mode, mock })
  }

  // ── per-mode criteria from the collected facts ────────────────────────────
  for (const mode of MODE_RUN) {
    const f = worldFacts[mode]
    const resultsText = JSON.stringify(f.memberToolResults ?? [])
    if (mode === 'wide') {
      check('P1.write', 'write REALLY EXECUTED: create-confirm envelope on the wire + the exact planted bytes existed for step-2 (the edit old_string match below proves the write bytes landed verbatim)',
        typeof f.fs?.writeTxt === 'string' && String(f.memberToolResults?.[0] ?? '').includes('Created file') && String(f.memberToolResults?.[0] ?? '').includes('a5tools_write.txt'), `r0=${String(f.memberToolResults?.[0] ?? '').slice(0, 120)}`)
      check('P2.edit', 'edit REALLY EXECUTED: the old line is replaced by the edited line (fs bytes prove the mutation)',
        typeof f.fs?.writeTxt === 'string' && f.fs.writeTxt.includes(TOK_EDITED) && !f.fs.writeTxt.includes(`${TOK_WRITE}-A1 lives here`), 'fs diff asserted')
      check('P3.read', 'read REALLY EXECUTED: its wire result carries the edited line',
        resultsText.includes(TOK_EDITED), `results-mention=${String(resultsText.includes(TOK_EDITED))}`)
      check('P4.read_image', 'read_image REALLY EXECUTED: its wire result is a non-empty image-shaped payload (PNG magic / image part recorded)',
        resultsText.includes('image') || resultsText.includes('iVBOR') || resultsText.includes('89504e47') || resultsText.includes('.png'), `result-head=${resultsText.slice(0, 160)}`)
      note('P4.read_image.shape', 'read_image raw result head (shape evidence, booked)', resultsText.slice(0, 300))
      check('P5.str_replace_editor', 'str_replace_editor create REALLY EXECUTED: the created file exists with the planted bytes',
        typeof f.fs?.sreTxt === 'string' && f.fs.sreTxt.includes(TOK_SRE), `sre=${JSON.stringify(f.fs?.sreTxt)?.slice(0, 60)}`)
      check('P6.glob', 'glob REALLY EXECUTED: the wire result lists the planted a5tools_*.txt names',
        resultsText.includes('a5tools_write.txt') && resultsText.includes('a5tools_sre.txt'), `hits=${String(resultsText.includes('a5tools_write.txt'))}/${String(resultsText.includes('a5tools_sre.txt'))}`)
      check('P7.grep', 'grep REALLY EXECUTED: the wire result carries the seed token line',
        resultsText.includes(TOK_GREP), 'seed token asserted')
      check('P8.bash', 'bash REALLY EXECUTED: token echoed (wire) AND file side effect on fs',
        resultsText.includes(TOK_BASH) && typeof f.fs?.bashWrote === 'string' && f.fs.bashWrote.includes(TOK_BASH), `bashw=${JSON.stringify(f.fs?.bashWrote)?.slice(0, 60)}`)
      check('P9.order', 'the member really issued the ten scripted calls in order (eight tools + two layer-3 probes)',
        JSON.stringify(f.memberToolCallOrder) === JSON.stringify(['write', 'edit', 'read', 'read_image', 'str_replace_editor', 'glob', 'grep', 'bash', 'read', 'write']),
        `order=${JSON.stringify(f.memberToolCallOrder)}`)
      const outReadRes = String(f.memberToolResults?.[8] ?? '')
      const outsideReadHandled = outReadRes.includes(OUTSIDE_MARKER) ? 'HOST-NATIVE-BODY-SERVED-CONTENT' : (/refus|denied|OUTSIDE_OF|not (inside|under)/i.test(outReadRes) ? 'REFUSED' : 'OTHER')
      note('X9.read-outside.body-path', 'which read body served a read OUTSIDE the governed root (layer-3: is a Controlled-FS mediator on this path?)', `verdict=${outsideReadHandled} landing=${outReadRes.slice(0, 220)}`)
      note('X10.write-outside.landing', 'legacy-form write OUTSIDE the governed root landed? (layer-3: absence/presence of an execution mediator in legacy form)', `landed=${String(f.wideOutsideWrite !== null)} content=${JSON.stringify(f.wideOutsideWrite)?.slice(0, 80)}`)
      check('X11.world-hygiene', 'the ten-step ladder left the planted world otherwise intact (outside secret bytes byte-identical at teardown; captured before teardown)',
        f.secretAfter === `${OUTSIDE_MARKER}\n`, `secretAfter=${JSON.stringify(f.secretAfter)?.slice(0, 60)}`)
    }
    if (mode === 'lanes') {
      check('L1.allow-subtree-write', 'allow-lane (subtree) write EXECUTED inside the governed root',
        typeof f.fs?.allowedTxt === 'string' && f.fs.allowedTxt.includes(TOK_WRITE), `allowed=${JSON.stringify(f.fs?.allowedTxt)?.slice(0, 60)}`)
      check('L2.deny-lane-read', 'deny-lane exact read is REFUSED and the forbidden marker NEVER appears on any wire byte of this world',
        f.forbiddenMarkerOnWire === 0 && /refus|denied|a5p5-refused|permission/i.test(resultsText), `markerWireHits=${String(f.forbiddenMarkerOnWire)}`)
      note('L2.deny-lane.text', 'deny landing verbatim (booked)', String(f.memberToolResults?.[1] ?? '').slice(0, 300))
      check('L3.default-deny-write-outside', 'default-deny: the write outside the subtree is REFUSED with ZERO effect (file absent on fs)',
        f.fs?.outsideGovWrite === false && f.forbiddenMarkerOnWire === 0, `outsideGovWrite=${String(f.fs?.outsideGovWrite)}`)
      // EXECUTED = a real payload: any Error: answer (including the
      // BINDING_UNVERIFIED guard law) FAILS this expectation honestly - the
      // shipped governed form has no executable read_image; booking the law in
      // TOOLS.md 4b does not soften the user-facing expectation here.
      check('L4.allow-read_image', 'allow-lane read_image EXECUTED inside the subtree (real payload; any Error:/guard refusal FAILS)',
        (f.memberToolResults?.[3] ?? '').length > 0 && !/Error:|refus|denied|cannot be verified/i.test(String(f.memberToolResults?.[3] ?? '')), `res-head=${String(f.memberToolResults?.[3] ?? '').slice(0, 80)}`)
      check('L5.member-shell-refused', 'member bash (no lane can allow it) is REFUSED with NO side effect',
        /refus|denied|permission/i.test(String(f.memberToolResults?.[4] ?? '')) && f.fs?.bashDeniedSide === false, `bashRes=${String(f.memberToolResults?.[4] ?? '').slice(0, 120)} sideEffect=${String(f.fs?.bashDeniedSide)}`)
      check('L6.denylist-cut-off', 'builtinToolDeny cut-off: str_replace_editor and glob/grep are ABSENT from the member wire catalog AND the call lands a refusal (deny chain effective)',
        !f.memberAWireCatalog.includes('str_replace_editor') && !f.memberAWireCatalog.includes('glob') && !f.memberAWireCatalog.includes('grep') && (f.memberAWireCatalog.includes('read') && f.memberAWireCatalog.includes('write')),
        `catalog=${JSON.stringify(f.memberAWireCatalog)}`)
      check('L7.setup-passed', 'the strict lanes member SET UP (no coverage-gate FATAL: the deny list removed the unmanaged tools)',
        (f.hostErrors ?? []).filter((l) => l.includes('coverage-unmanaged')).length === 0, `coverageErrors=${String((f.hostErrors ?? []).filter((l) => l.includes('coverage-unmanaged')).length)}`)
      check('L8.symlink-zero-victim-mutation', 'layer-3 check→execute object-fixing: the write THROUGH the inside symlink never mutated the outside victim (bytes byte-identical before/after)',
        typeof f.victimBefore === 'string' && f.victimAfter === f.victimBefore, `before=${JSON.stringify(f.victimBefore)?.slice(0, 60)} after=${JSON.stringify(f.victimAfter)?.slice(0, 60)}`)
      check('L9.symlink-read-no-leak', 'layer-3: the read THROUGH the symlink never put the victim marker on any wire byte',
        f.victimMarkerOnWire === 0, `victimWireHits=${String(f.victimMarkerOnWire)} writeRes=${String(f.memberToolResults?.[6] ?? '').slice(0, 140)} readRes=${String(f.memberToolResults?.[7] ?? '').slice(0, 140)}`)
      note('L9.landing.verbatim', 'symlink legs raw refusals/lands (booked — which layer answered: canonicalizer vs body)', `write=${String(f.memberToolResults?.[6] ?? '').slice(0, 300)} || read=${String(f.memberToolResults?.[7] ?? '').slice(0, 300)}`)
    }
    if (mode === 'ask') {
      check('A1.pending-ask', 'ask lane: the member write parked as a DURABLE control request (ledger row control-request-recorded exists)',
        (f.factsControlLedger?.requests?.length ?? 0) >= 2, `requests=${String(f.factsControlLedger?.requests?.length ?? 0)}`)
      // The ask world is a STRICT member (guarded, same shape as lanes): the
      // leader-lane allow parks → decides → the ONE-SHOT grant is consumed at
      // the last-mile guard, and the native write STILL refuses at dispatch
      // with the closed-world binding law (§4b: un-bound native file tool =
      // refusal, never a native-body fallback, never a silent pass). Honest
      // face: ask lane fully works (request/allow/consume); EXECUTION is
      // gated by the binding gap this route books, NOT by the ask lane.
      check('A2.allow-consumed-binding-refusal', 'ask→allow: durable allow decision + the one-shot grant CONSUMED at the guard; the un-bound native write then refuses at dispatch (closed-world binding law, no native fallback, no silent execute)',
        (f.factsControlLedger?.consumptions?.length ?? 0) >= 1
        && String(f.memberToolResults?.[0] ?? '').includes('cannot be verified at dispatch time')
        && f.fs?.askAllowedTxt === null,
        `consumed=${String(f.factsControlLedger?.consumptions?.length ?? 0)} res0=${String(f.memberToolResults?.[0] ?? '').slice(0, 90)}`)
      check('A3.deny-refuses-zero-effect', 'ask→deny: the second write is REFUSED after the human deny and NEVER executes (file absent)',
        f.fs?.askDeniedTxt === false && (f.factsControlLedger?.decisions?.length ?? 0) >= 2, `askDeniedExists=${String(f.fs?.askDeniedTxt)}`)
      check('A4.resolutions-recorded', 'both resolutions are durable decision rows (allow + deny) against the same requestIds',
        (f.factsControlLedger?.decisions ?? []).length >= 2, JSON.stringify((f.factsControlLedger?.decisions ?? []).map((d) => d.decision)))
    }
    if (mode === 'unmanaged') {
      const errText = String(f.leaderFinalText ?? '') + JSON.stringify(f.memberToolResults ?? '') + JSON.stringify(f.hostErrors ?? [])
      check('U1.coverage-gate-fatal', `the strict member WITHOUT the deny Fails setup LOUDLY with the typed ${COVERAGE_FATAL_CODE} error (loud, deterministic, no auto-hide)`,
        errText.includes(COVERAGE_FATAL_CODE), `hits=${String((errText.match(/alpha2-permission-coverage-unmanaged-tools/g) ?? []).length)}`)
      check('U2.classification-unknown', 'the typed detail classifies str_replace_editor as unknown-unmanaged (no reviewed authority owner) and glob/grep as known-sensitive-unmanaged',
        /str_replace_editor/.test(errText) && /unknown/i.test(errText) && /known-sensitive|known_sensitive/i.test(errText), `head=${errText.slice(0, 300)}`)
      note('U2.verbatim', 'coverage FATAL verbatim landing (booked, red-archive)', errText.slice(0, 1200))
      check('U3.deny-remediation-works', 'POSITIVE CONTROL: the sibling member WITH builtinToolDeny (the error\'s own remediation) sets up and READS for real (wire result carries the seed token)',
        JSON.stringify(f.memberToolResults ?? []).includes(TOK_GREP), `wa2-read=${JSON.stringify(f.memberToolResults ?? []).slice(0, 120)}`)
    }
  }

  // ── teardown checks ───────────────────────────────────────────────────────
  const porcelainAfter = gitAt(TESTUSE, 'status', '--porcelain')
  const headAfter = gitAt(TESTUSE, 'rev-parse', 'HEAD')
  check('T1', 'the pristine test-use tree is STILL byte-clean and at the pinned baseline after every world',
    porcelainAfter === '' && headAfter === TEST_USE_BASELINE_SHA, `head=${headAfter.slice(0, 10)} porcelain=${porcelainAfter === '' ? 0 : 'DIRTY'}`)
  const portReleased = await portFree(HOST_PORT)
  const leftovers = existsSync(HOMES_ROOT) ? readdirSync(HOMES_ROOT).filter((d) => d.startsWith(`${WORLD_PREFIX}-`)) : []
  check('T2', 'host port 3187 released after teardown and no a5tools-gov-* home survives (unless --keep); :3080 never touched',
    portReleased && (KEEP || leftovers.length === 0), `released=${String(portReleased)} leftovers=${JSON.stringify(leftovers)}`)
  const stableAfter = await stableProbe()
  check('T3', 'the stable :3080 probe answers the SAME as before (read-only before/after, never touched)', stableAfter === stableBefore, `before=${String(stableBefore)} after=${String(stableAfter)}`)

  const reds = CRITERIA.filter((c) => c.pass === false)
  writeEvidence('criteria.json', {
    stamp: RUN_STAMP, sha: EXPECTED_SHA, modes: MODE_RUN,
    install: { rootSha: faceReference.rootSha, files: m.actualCount },
    summary: { total: CRITERIA.length, pass: CRITERIA.filter((c) => c.pass === true).length, fail: reds.length, booked: CRITERIA.filter((c) => c.pass === null).length },
    criteria: CRITERIA,
  })
  console.log(`\nKIT_SUMMARY ${JSON.stringify({ total: CRITERIA.length, pass: CRITERIA.filter((c) => c.pass === true).length, fail: reds.length })}`)
  return reds.length === 0 ? 0 : 2
}

let MOCK_LATE = { requests: [] }
async function startMockModelWithDecide () {
  const handle = await startMockModel({
    port: MOCK_PORT,
    decide: ({ req }) => {
      const digest = digestRequest(req)
      const markers = []
      for (const mode of MODE_RUN) {
        const MU = mode.toUpperCase()
        markers.push(`${MK}_${MU}_DISC`, `${MK}_${MU}_L0`, `${MK}_${MU}_TASK_A`)
      }
      digest.markerHits = markers.filter((mk) => digest._text.includes(mk))
      const rec = MOCK_LATE.requests[MOCK_LATE.requests.length - 1]
      if (rec !== undefined) rec.digest = digest
      const text = digest._text
      for (const mode of MODE_RUN) {
        const MU = mode.toUpperCase()
        if (text.includes(`${MK}_${MU}_DISC`)) return { kind: 'text', content: 'A5T_DISC_OK' }
        if (text.includes(`${MK}_${MU}_L0`)) {
          const calls = digest.assistantToolNames
          if (mode === 'ask') {
            // Leader-lane approvals: delegate ASYNC (the member blocks in
            // its own ask-lane wait; the leader keeps taking turns), then
            // poll the pending list and resolve allow→deny by PARSED real
            // requestIds from the tool results (never invented).
            const st = (A5T_ASK_STATE.ask ??= { resolved: [], polls: 0 })
            if (calls.length === 0) return toolCall(`a5t-del-${rnd()}`, 'team_delegate', { rootSessionId: L0_CREATE_ROOTS.ask, requestToken: 'a5tools-gov-tok-ask', delegationTemplateId: 'wa', label: 'gov-a', taskSummary: 'native tool ladder (ask)', prompt: taskPromptFor('ask'), async: true })
            const last = String(digest.toolResults[digest.toolResults.length - 1] ?? '')
            if (calls[calls.length - 1] === 'team_collect') return { kind: 'text', content: 'A5TOOLS_LEADER_RESULT collected.' }
            const pending = [...new Set([...last.matchAll(/ctrl-[0-9a-z]+/g)].map((m) => m[0]))].filter((id) => !st.resolved.some((r) => r.id === id))
            if (st.resolved.length === 2) return toolCall(`a5t-col-${rnd()}`, 'team_collect', { rootSessionId: L0_CREATE_ROOTS.ask, requestToken: `a5t-col-${RUN_STAMP}`, requestTokens: ['a5tools-gov-tok-ask'] })
            if (pending.length === 0) {
              st.polls += 1
              if (st.polls > 90) return { kind: 'text', content: 'A5T_ASK_FAIL no pending control request surfaced' }
              return toolCall(`a5t-lp-${st.polls}-${rnd()}`, 'team_list_pending_control', { rootSessionId: L0_CREATE_ROOTS.ask, requestToken: `a5t-lp-${st.polls}` })
            }
            const leg = st.resolved.length + 1
            const decision = leg === 1 ? 'allow' : 'deny'
            st.resolved.push({ id: pending[0], decision })
            return toolCall(`a5t-rq-${leg}-${rnd()}`, 'team_resolve_control', { rootSessionId: L0_CREATE_ROOTS.ask, requestToken: `a5t-rq-${leg}`, requestId: pending[0], decision, note: `a5tools-gov ask#${String(leg)} scripted leader-lane ${decision}` })
          }
          if (mode === 'unmanaged') {
            if (calls.length === 0) return toolCall(`a5t-del-${rnd()}`, 'team_delegate', { rootSessionId: L0_CREATE_ROOTS[mode], requestToken: 'a5tools-gov-tok-unmanaged-no', delegationTemplateId: 'wa', label: 'gov-no', taskSummary: 'governed read (no deny)', prompt: taskPromptFor('unmanaged'), async: false })
            if (calls.length === 1) return toolCall(`a5t-del2-${rnd()}`, 'team_delegate', { rootSessionId: L0_CREATE_ROOTS[mode], requestToken: 'a5tools-gov-tok-unmanaged-ok', delegationTemplateId: 'wa2', label: 'gov-ok', taskSummary: 'governed read (deny applied)', prompt: taskPromptFor('unmanaged'), async: false })
            if (calls.length === 2) return toolCall(`a5t-col-${rnd()}`, 'team_collect', { rootSessionId: L0_CREATE_ROOTS[mode], requestToken: `a5t-col-${RUN_STAMP}`, requestTokens: ['a5tools-gov-tok-unmanaged-no', 'a5tools-gov-tok-unmanaged-ok'] })
            return { kind: 'text', content: 'A5TOOLS_LEADER_RESULT collected.' }
          }
          if (calls.length === 0) return toolCall(`a5t-del-${rnd()}`, 'team_delegate', { rootSessionId: L0_CREATE_ROOTS[mode], requestToken: `a5tools-gov-tok-${mode}`, delegationTemplateId: 'wa', label: 'gov-a', taskSummary: `native tool ladder (${mode})`, prompt: taskPromptFor(mode), async: false })
          if (calls.length === 1) return toolCall(`a5t-col-${rnd()}`, 'team_collect', { rootSessionId: L0_CREATE_ROOTS[mode], requestToken: `a5t-col-${RUN_STAMP}`, requestTokens: [`a5tools-gov-tok-${mode}`] })
          return { kind: 'text', content: 'A5TOOLS_LEADER_RESULT collected.' }
        }
        if (text.includes(`${MK}_${MU}_TASK_A`)) {
          const steps = stepsFor(mode, L0_W[mode])
          // The member session is fresh per delegation: every tool result in
          // its history is exactly one ladder step. Counting results (not
          // grepping markers) advances the ladder even when a step lands a
          // REFUSAL (refusals are results too — the lanes/ask legs need this).
          const idx = digest.toolResults.length
          if (idx >= steps.length) {
            const results = digest.toolResults
            return { kind: 'text', content: `A5TOOLS_MEMBER_RESULT ${results.map((r, i) => `r${String(i)}=${r.slice(0, 260).replace(/\s+/g, ' ')}`).join(' | ')}` }
          }
          return toolCall(`a5t-step-${String(idx)}-${rnd()}`, steps[idx].tool, steps[idx].args)
        }
      }
      return { kind: 'text', content: 'A5T_IDLE_OK' }
    },
    log: () => {},
  })
  MOCK_LATE = handle
  return handle
}

/** The mock needs the per-mode world paths + create roots BEFORE booting;
 *  runWorld registers them here (single-run sequential, no aliasing). */
const L0_CREATE_ROOTS = {}
const L0_W = {}
const A5T_ASK_STATE = {}
function taskPromptFor (mode) {
  const W = L0_W[mode]
  const steps = stepsFor(mode, W)
  const enumerated = steps.map((s, i) => `(${String(i + 1)}) tool ${s.tool} with ${yamlQuoted(s.args)}`).join('; ')
  return `${MK}_${mode.toUpperCase()}_TASK_A Work EXACTLY in this order, one tool call per turn: ${enumerated}; then (final) answer with ONE line starting A5TOOLS_MEMBER_RESULT quoting each of the ${String(steps.length)} tool results you received, verbatim.`
}

let KIT_EXIT = 1
try {
  for (const mode of MODE_RUN) {
    L0_CREATE_ROOTS[mode] = `session-a5tools-gov-team-${mode}-${RUN_STAMP}`
    L0_W[mode] = {
      governedRoot: join(HOMES_ROOT, `${WORLD_PREFIX}-${mode}-${RUN_STAMP}`, 'workspace', 'governed'),
      outsideDir: join(HOMES_ROOT, `${WORLD_PREFIX}-${mode}-${RUN_STAMP}`, 'workspace', 'outside'),
    }
  }
  KIT_EXIT = await main()
} catch (err) {
  writeEvidence('fatal.json', { fatal: String(err?.stack ?? err), stamp: RUN_STAMP })
  console.log(`FATAL: ${String(err?.message ?? err)}`)
  KIT_EXIT = 1
}
process.exit(KIT_EXIT)
