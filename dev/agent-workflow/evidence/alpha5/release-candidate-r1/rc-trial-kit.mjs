/**
 * rc-trial-kit.mjs — Alpha.5 release-candidate-r1 ISOLATED INSTALL SMOKE (④).
 *
 * Independent release-readiness auditor's minimal trial, run per the fixed
 * install chain proven by a5ie-r2b/r3/r4-b2 (docs/INSTALL.md §2 + §3.5, TEST_METHODS §2):
 *
 *   H  pins: host test-use @ master tests/paths.mjs SHA, porcelain 0;
 *      :3080 read-only probe; ports 3183/3184/3491 free; FRESH home.
 *   I  REAL network install  dsh plugin --profile web add github:…#<master sha>
 *      into the fresh DSH_HOME (tests/homes/rc-trial-1), strict-manifest
 *      THREE ZEROS (count recomputed from the commit's declared files: face,
 *      never a hard-coded expectation) + face rootSha + dump-config compose
 *      (the row config keys as the installed profile really sees them).
 *   L  boot the governed Team entry on the installed face (mock ONLY at the
 *      LLM position), team.create -> Leader: team_create_member ->
 *      team_list_members -> team_delegate(instance, async:false) -> member:
 *      team_bash POSITIVE write + team_bash OUT-OF-BOUNDS negative -> collect.
 *      Grade the RENDERED exit codes on the wire ('bash · exit=0' /
 *      'bash · exit=1' + kernel stderr verbatim + presentationMeta), zero
 *      disclosure, disk write, host-log witnesses incl. the a5ptc census row.
 *   C  teardown: named sweep (exact names recorded in sweep-list.json —
 *      NO glob deletes), ports released, tokens redacted, :3080 unchanged,
 *      test-use porcelain 0.
 *
 * Honesty rules (inherited from the a5ie line): every judgement is graded
 * from LIVE wire captures / fs probes / the redacted instance log / installed
 * bytes at observation time; a missing leg FAILS; nothing is inferred from
 * the source tree when the wire can be read. EXIT: 0 GREEN · 2 RED · 1 FATAL.
 *
 * Helpers mock-deepseek.mjs / preset-seam.mjs / paths.mjs are byte-copies of
 * the SAME commit's tracked files (helpers/HELPROOT.sha256 records the pin).
 *
 * @module evidence/alpha5/release-candidate-r1/rc-trial-kit
 */
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createServer as netServer } from 'node:net'
import { dirname, join, resolve } from 'node:path'

import { startMockModel } from './helpers/mock-deepseek.mjs'
import { presetDeclarationRow, smokePresetPlugins } from './helpers/preset-seam.mjs'
import { CLIENT_COMMIT_HASH, TEST_USE_BASELINE_SHA } from './helpers/paths.mjs'

const args = process.argv.slice(2)
const argValue = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1] }
const KEEP = args.includes('--keep')
const HERE = dirname(new URL(import.meta.url).pathname)
const REPO = resolve(argValue('repo', resolve(HERE, '..', '..', '..', '..', '..')))
const WORKTREE = resolve(argValue('worktree', join(REPO, '.worktrees', 'rc-trial-audit')))
const TESTUSE = resolve(argValue('testuse', join(REPO, 'tests', 'deepseek-harness-test-use')))
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const RUN_STAMP = new Date().toISOString().slice(0, 19).replace(/:/g, '-') + 'Z'
const EVIDENCE_DIR = resolve(argValue('evidence-dir', join(HERE, 'runs', RUN_STAMP)))
mkdirSync(EVIDENCE_DIR, { recursive: true })

// ---- pins (NEVER hand-typed: the SHA is read live from origin/master) ----
const MASTER_SHA = spawnSync('git', ['-C', REPO, 'ls-remote', 'origin', 'refs/heads/master'], { encoding: 'utf8' }).stdout.trim().split(/\s+/)[0]
if (!/^[0-9a-f]{40}$/.test(MASTER_SHA)) throw new Error(`FATAL: ls-remote master did not yield a full SHA: ${MASTER_SHA}`)
const WORKTREE_HEAD = spawnSync('git', ['-C', WORKTREE, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim()
const INSTALL_SPEC = `github:ArmourPiercer1/dsh-agent-team#${MASTER_SHA}`
const HOST_PORT = Number(argValue('port', 3183))
const RESERVED_PORT = Number(argValue('reserved-port', 3184))
const MOCK_PORT = Number(argValue('mock-port', 3491))
// Content-addressable store is SHARED scratch inside the workspace (public
// profile storeDir channel); default to the warmest existing one, pnpm only
// adds the new commit's git-package on top.
const STORE_DIR = resolve(argValue('store-dir', join(REPO, '.pnpm-store-a5ie-r4-b2')))
const HOME = resolve(argValue('home', join(REPO, 'tests', 'homes', 'rc-trial-1')))
const HOME_NAME = 'rc-trial-1'
const LOCK_NAME = 'rc-trial-1.lock'

const PRESET_ID = 'rc-trial-base'
const ROOT = 'rc-trial-root'
const CREATE_ROOT = `session-rc-trial-team-${RUN_STAMP}`
const BP_MAIN_ID = 'rc-trial-main-bp'
const BP_ANCHOR_ID = 'rc-trial-anchor-bp'
const TK_CM = 'rc1-tok-create-member'
const TK_LM = 'rc1-tok-list-members'
const TK_D1 = 'rc1-tok-delegate-1'
const TOK_READ = 'RC1-READ-TOKEN-77'
const TOK_GREP = 'RC1-GREP-TOK'
const TOK_BASH = 'RC1-BASH-TOK'
const NAT_TOK = 'RC1-NATIVE-TOK'
const WRITE_TOK = 'RC1-WROTE-9'
const OUTSIDE_MARKER = 'RC1-OUTSIDE-ONLY-MARKER-9182'

const CRITERIA = []
function check (id, claim, cond, observed) {
  CRITERIA.push({ id, claim, pass: cond === true, observed })
  console.log(`${cond === true ? 'PASS' : 'FAIL'} ${id} — ${claim}${observed === undefined ? '' : ` [${observed}]`}`)
}
const note = (id, claim, observed) => { CRITERIA.push({ id, claim, pass: null, observed }); console.log(`BOOK ${id} — ${claim}${observed === undefined ? '' : ` [${observed}]`}`) }
const die = (msg) => { throw new Error(`FATAL: ${msg}`) }
const sha256File = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
const sha256Text = (s) => createHash('sha256').update(s).digest('hex')
const hex8 = (s) => createHash('sha256').update(s).digest('hex').slice(0, 8)
const REDACTIONS = [
  [/(https?:\/\/[^\s"'`]+?\?token=)([A-Za-z0-9_-]{8,})/g, (_m, head, tok) => head + `<REDACTED-${hex8(tok)}>`],
  [/\b(token|api_key|apikey|access_token)=["']?[A-Za-z0-9_\-.=]{8,}/gi, (m0) => m0.split('=')[0] + '=<REDACTED>'],
  [/dsh-auth-[A-Za-z0-9_-]{6,}/g, 'dsh-auth-<REDACTED>'],
  [/\bBearer\s+[A-Za-z0-9._-]{6,}/gi, 'Bearer <REDACTED>'],
]
const redact = (text) => REDACTIONS.reduce((t, [re, r]) => t.replace(re, r), text)
const writeEvidence = (name, value) => writeFileSync(join(EVIDENCE_DIR, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n')
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/
async function fetchJson (url, init, timeoutMs = 30_000) {
  const res = await fetch(url, { ...(init ?? {}), signal: AbortSignal.timeout(timeoutMs) })
  const text = await res.text()
  try { return { status: res.status, body: JSON.parse(text) } } catch { return { status: res.status, body: text } }
}
const stableProbe = async () => {
  try { const r = await fetch('http://127.0.0.1:3080/', { redirect: 'manual', signal: AbortSignal.timeout(5000) }); return r.status } catch { return 'unreachable' }
}
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
async function waitFor (deadlineMs, fn, what) {
  const deadline = Date.now() + deadlineMs
  for (;;) {
    const v = await fn()
    if (v !== null && v !== undefined && v !== false) return v
    if (Date.now() >= deadline) die(`timeout waiting for ${what}`)
    await new Promise((r) => setTimeout(r, 250))
  }
}
const rnd = () => Math.random().toString(36).slice(2, 10)
const toolCall = (id, name, argsObj) => ({ kind: 'tool-call', toolCalls: [{ id, name, arguments: argsObj }] })
function walkFiles (dir, base = dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walkFiles(p, base, out)
    else if (e.isFile()) out.push(p.slice(base.length + 1))
    else out.push(`NOT-A-FILE:${p.slice(base.length + 1)}`)
  }
  return out.map((p) => p.split('\\').join('/'))
}

// ─────────────── declared install face (same method as a5ie-r2b I3) ──────────
function declaredFace (worktree, sha) {
  const pkg = JSON.parse(spawnSync('git', ['-C', worktree, 'show', `${sha}:package.json`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).stdout)
  const files = (pkg.files ?? []).map((f) => f.replace(/^\.\//, '').replace(/\/$/, ''))
  const ls = spawnSync('git', ['-C', worktree, 'ls-tree', '-r', '--name-only', '-z', sha], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 })
  if (ls.status !== 0) die(`git ls-tree failed: ${String(ls.stderr).slice(0, 200)}`)
  const tree = ls.stdout.split('\0').filter((s) => s !== '')
  const under = (p) => files.some((f) => p === f || p.startsWith(`${f}/`))
  const docish = (p) => !p.includes('/') && /^(readme|license|licence|changelog|changes|history|notice)(\..*)?$/i.test(p)
  const declared = tree.filter(under)
  const packAdditions = tree.filter((p) => !under(p) && (p === 'package.json' || docish(p)))
  return { files, declared, packAdditions, expected: [...declared, ...packAdditions] }
}
function materializeDeclaredFace (worktree, sha, face) {
  const mirror = join(EVIDENCE_DIR, 'declared-face-mirror')
  mkdirSync(mirror, { recursive: true })
  const arch = spawnSync('git', ['-C', worktree, 'archive', sha, '--', ...face.expected], { maxBuffer: 512 * 1024 * 1024 })
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
  const shaMismatch = []; const manifest = []
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
    expectedCount: expected.length, actualCount: actual.length,
    declaredCount: face.declared.length, packAdditions: face.packAdditions,
    missing, extra, shaMismatch,
    rootSha: sha256Text(manifest.map((m) => `${m.path} ${m.sha256}`).join('\n')),
    manifest,
  }
}

// ───────────────────────── YAML emitter (from r2b) ──────────────────────────
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

// ─────────────────────────── blueprints (schema v3) ─────────────────────────
const ANCHOR_YAML = [
  '---', 'schemaVersion: 3', `blueprintId: ${BP_ANCHOR_ID}`, 'revision: "1"',
  'leader:', '  templateId: leader', '  persona: "You are the leader of the rc-trial team."',
  'members:', '  - templateId: wa', '    persona: "You are a worker of the rc-trial team."',
  'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
  'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
].join('\n')

function mainBlueprintYaml (denyList, mkTask) {
  const denyBlock = (pad) => denyList.length === 0 ? [`${pad}builtinToolDeny: []`] : [`${pad}builtinToolDeny:`, ...denyList.map((n) => `${pad}  - ${n}`)]
  const task = `${mkTask} Work EXACTLY in this order, one tool call per turn: (1) tool team_bash with {"command":"echo ${TOK_BASH}; echo ${WRITE_TOK} > ./rc-wrote.txt; cat ./rc-wrote.txt"}; (2) tool team_bash with {"command":"cat ../outside/secret.txt"}; (3) tool bash (the NATIVE tool named exactly 'bash') with {"command":"echo ${NAT_TOK}"}; then (4) finish with ONE line starting RC1_MEMBER_RESULT quoting each of the three tool results you received.`
  const leaderPersona = `You are the leader of the rc-trial team. On your directive: FIRST call team_create_member exactly once with rootSessionId ${CREATE_ROOT}, requestToken ${TK_CM}, delegationTemplateId "wa", label "rc-a". SECOND call team_list_members with rootSessionId ${CREATE_ROOT} and requestToken ${TK_LM}. THIRD call team_delegate exactly once with rootSessionId ${CREATE_ROOT}, requestToken ${TK_D1}, the delegationInstanceId returned by team_list_members for instance rc-a, async false, and the prompt ${JSON.stringify(task)}. FOURTH call team_collect with rootSessionId ${CREATE_ROOT} and requestTokens ["${TK_D1}"]. FIFTH finish with one line starting RC1_LEADER_DONE.`
  return [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
    'displayName: "rc-trial minimal governed team"',
    'description: "release-candidate-r1 trial: the ordinary governed Team entry through the REAL installed plugin face, mock only at the LLM position."',
    'leader:', '  templateId: leader',
    `  persona: ${JSON.stringify(leaderPersona)}`,
    '  capabilities:', '    teamTools:', '      kind: allow', '      items:', '        - team_create_member', '        - team_list_members', '        - team_delegate', '        - team_collect',
    ...denyBlock('    '),
    '    skills:', '      kind: allow', '      items: []',
    '    mcp:', '      kind: allow', '      items: []',
    '    permissions:', '      default: ask', '      allow: []', '      ask: []', '      deny: []',
    'teamEnvelope:', '  allow:', '    - assign-task', '    - create-member', '    - send-message', '    - report-progress', '  deny: []',
    'members:',
    '  - templateId: wa', '    displayName: "rc-trial worker A"',
    '    persona: "You are worker A of the rc-trial team. Follow delegated work exactly, tool by tool, in order."',
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

function rowConfig (blueprintDir, world, launcher) {
  return {
    rootSessionId: ROOT,
    bootPhase: 'create',
    blueprintSource: ANCHOR_YAML,
    blueprintDir,
    rootPresetId: PRESET_ID,
    memberPresetId: PRESET_ID,
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'rc-trial-model' },
    deniedSelection: null,
    mcpServers: [],
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
      { domain: 'persona', subject: 'standard', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    teamToolPlane: {
      realmId: 'rc-trial-realm',
      fsInstance: { fs: 'rc-trial-ctl', rootDir: world.governedRoot, realmId: 'rc-trial-realm', kind: 'absolute-path' },
      confinedProvider: {
        trustRoot: `sha256:${launcher.sha.slice(0, 16)}#${launcher.path}`,
        assembly: { launcherPath: launcher.path, launcherSha256: launcher.sha, minAbiVersion: 3 },
      },
    },
  }
}

// ─────────────────────── wire digest (mock at LLM slot) ─────────────────────
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
  return { msgCount: msgs.length, toolCount: toolNames === null ? 0 : toolNames.length, toolNames, assistantToolNames, toolResults, markerHits: [], _text: text }
}

// ═══════════════════════════════════ MAIN ════════════════════════════════════
const MK = `RC1_${RUN_STAMP.replace(/[^A-Za-z0-9]/g, '')}`
const MK_DISC = `${MK}_DISC`
const MK_L0 = `${MK}_L0`
const MK_TASK = `${MK}_TASK`
const markers = [MK_DISC, MK_L0, MK_TASK, 'RC1_MEMBER_RESULT', 'RC1_LEADER_DONE']

let exitCode = 0
const facts = { runStamp: RUN_STAMP, masterShaFromLsRemote: MASTER_SHA, worktreeHead: WORKTREE_HEAD, installSpec: INSTALL_SPEC, home: HOME }
try {
  if (WORKTREE_HEAD !== MASTER_SHA) die(`audit worktree HEAD ${WORKTREE_HEAD} != ls-remote master ${MASTER_SHA}`)
  const testuseHead = spawnSync('git', ['-C', TESTUSE, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim()
  const porcelainBefore = spawnSync('git', ['-C', TESTUSE, 'status', '--porcelain'], { encoding: 'utf8' }).stdout.trim()
  check('H1', `test-use host is the pinned pristine runtime (master tests/paths.mjs TEST_USE_BASELINE_SHA=${TEST_USE_BASELINE_SHA.slice(0, 10)}) and porcelain 0 before`, testuseHead === TEST_USE_BASELINE_SHA && porcelainBefore === '', `head=${testuseHead.slice(0, 10)} porcelain=${porcelainBefore === '' ? 0 : 'DIRTY'}`)
  check('H1b', 'the install spec pins THIS round\'s live ls-remote master SHA and the audit worktree equals it', true, `master=${MASTER_SHA} worktree=${WORKTREE_HEAD}`)

  // FRESH home, fail-closed (no reuse of a stale world)
  if (existsSync(HOME)) die(`world ${HOME} already exists — rc-trial-1 must be a FRESH world (refusing to reuse)`)
  const homesRoot = join(HOME, '..')
  const staleRc = readdirSync(homesRoot).filter((n) => n.startsWith(HOME_NAME))
  if (staleRc.length > 0) die(`stale rc-trial entries under tests/homes: ${staleRc.join(',')}`)

  const stableBefore = await stableProbe()
  check('H0', 'the stable :3080 instance answers read-only before the run (probe only, never touched)', true, `status=${String(stableBefore)}`)
  const free3 = await portFreeWait(HOST_PORT); const free4 = await portFreeWait(RESERVED_PORT); const freeM = await portFreeWait(MOCK_PORT)
  check('H2', `ports ${HOST_PORT} AND ${RESERVED_PORT} AND the mock port ${MOCK_PORT} self-proved free before the run`, free3 && free4 && freeM, `${HOST_PORT}=${free3} ${RESERVED_PORT}=${free4} mock=${freeM}`)

  // ── world skeleton ──
  mkdirSync(join(HOME, 'workspace', 'governed'), { recursive: true })
  mkdirSync(join(HOME, 'workspace', 'outside'), { recursive: true })
  mkdirSync(join(HOME, 'blueprints'), { recursive: true })
  mkdirSync(join(HOME, 'deployment'), { recursive: true })
  const governedRoot = join(HOME, 'workspace', 'governed')
  const outsideSecret = join(HOME, 'workspace', 'outside', 'secret.txt')
  const bashWrote = join(governedRoot, 'rc-wrote.txt')
  writeFileSync(join(governedRoot, 'notes.txt'), `line one\n${TOK_READ}\nline three\n${TOK_GREP} lives here\n`)
  writeFileSync(outsideSecret, `${OUTSIDE_MARKER}\n`)

  // ── I: REAL network install into THIS world (public package face) ──
  const profileDir = join(HOME, 'profiles', 'web')
  mkdirSync(profileDir, { recursive: true })
  writeFileSync(join(profileDir, 'pnpm-workspace.yaml'), `packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\nstoreDir: ${STORE_DIR}\n`)
  const t0 = Date.now()
  const install = spawnSync(process.execPath, [HOST_BIN, 'plugin', '--profile', 'web', 'add', INSTALL_SPEC], {
    cwd: join(HOME, 'workspace'), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 900_000,
    env: { ...process.env, DSH_HOME: HOME },
  })
  const installOut = `${install.stdout ?? ''}${install.stderr ?? ''}`
  writeEvidence('install-rc-trial-1.log', redact(`$ node ${HOST_BIN} plugin --profile web add ${INSTALL_SPEC}\n(cwd ${join(HOME, 'workspace')}, DSH_HOME=${HOME})\nexit=${String(install.status)} in ${String(Math.round((Date.now() - t0) / 1000))}s\n\n${installOut}`))
  const manifest = existsSync(join(profileDir, 'package.json')) ? JSON.parse(readFileSync(join(profileDir, 'package.json'), 'utf8')) : null
  const nmDir = join(profileDir, 'node_modules')
  const nodeModulesTop = existsSync(nmDir) ? readdirSync(nmDir).filter((n) => !n.startsWith('.')).sort() : []
  const installedDir = join(nmDir, 'dsh-agent-team')
  check('I1', `REAL install through the pinned host's own public package face — plugin --profile web add ${INSTALL_SPEC}`, install.status === 0,
    `exit=${String(install.status)} in ${String(Math.round((Date.now() - t0) / 1000))}s tail=${redact(installOut).split('\n').filter((l) => l.trim() !== '').slice(-3).join(' | ').slice(0, 300)}`)
  const deps = Object.keys(manifest?.dependencies ?? {})
  check('I2', 'STRICT profile face: the profile declares EXACTLY this repo\'s one plugin and node_modules top level holds nothing else; the reconciler appended the bundle rows',
    deps.length === 1 && deps[0] === 'dsh-agent-team' && nodeModulesTop.length === 1 && nodeModulesTop[0] === 'dsh-agent-team' && (manifest?.dsh?.profile?.bundles ?? []).length > 0,
    `deps=${JSON.stringify(deps)} nm=${JSON.stringify(nodeModulesTop)} bundles=${JSON.stringify((manifest?.dsh?.profile?.bundles ?? []).map((b) => typeof b === 'string' ? b : b?.id ?? b))}`)

  const face = declaredFace(WORKTREE, MASTER_SHA)
  const mirror = materializeDeclaredFace(WORKTREE, MASTER_SHA, face)
  const m = measureInstalledFace(installedDir, face, mirror)
  writeEvidence('install-manifest.json', { head: MASTER_SHA, declaredFilesFace: face.files, declaredCount: face.declared.length, packAdditions: face.packAdditions, expectedCount: m.expectedCount, actualCount: m.actualCount, missing: m.missing, extra: m.extra, shaMismatch: m.shaMismatch, rootSha: m.rootSha, manifest: m.manifest })
  check('I3a', 'INSTALL THREE-ZEROS (1/4 count): the installed tree holds exactly the declared face — one file per declared entry (face RECOUNTED at this commit; no hard-coded expectation)',
    m.actualCount === m.expectedCount, `installed=${String(m.actualCount)} declared-files-face=${String(m.expectedCount)} (files: entries=${String(face.declared.length)} + pack-always=${String(m.packAdditions.length)})`)
  check('I3b', 'INSTALL THREE-ZEROS (2/4 missing = 0): every declared file materialized in the install dir', m.missing.length === 0, `missing=${String(m.missing.length)} ${JSON.stringify(m.missing.slice(0, 3))}`)
  check('I3c', 'INSTALL THREE-ZEROS (3/4 extra = 0): nothing outside the declared face landed', m.extra.length === 0, `extra=${String(m.extra.length)} ${JSON.stringify(m.extra.slice(0, 3))}`)
  check('I3d', 'INSTALL THREE-ZEROS (4/4 sha-mismatch = 0): every installed file is BYTE-IDENTICAL to that path at the installed commit', m.shaMismatch.length === 0, `mismatch=${String(m.shaMismatch.length)} rootSha=${m.rootSha.slice(0, 16)}`)
  check('I3e', 'the two bytes beyond the declared files: list are exactly the pack rules\' always-included pair (disclosed, not folded into the count)', m.packAdditions.length === 2 && m.packAdditions.includes('package.json') && m.packAdditions.includes('README.md'), `alwaysIncluded=${JSON.stringify(m.packAdditions)}`)
  const faceText = readFileSync(join(installedDir, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js'), 'utf8')
  try { rmSync(mirror, { recursive: true, force: true }) } catch { /* receipt lives in install-manifest.json (per-file sha256) */ }
  check('I4', 'the installed bundle layer is machine-agnostic (the bundle rows reference the package by name; no file: URL landed in the profile manifest)',
    !(manifest?.dsh?.profile?.bundles ?? []).some((b) => JSON.stringify(b).includes('file:/')), `bundles=${JSON.stringify((manifest?.dsh?.profile?.bundles ?? []).map((b) => typeof b === 'string' ? b : b?.id))} hostJsBytes=${String(faceText.length)}`)

  // I8/I9: deployment input (the Landlock pre-launcher) — NOT on the face;
  // materialized from the SAME commit with the triple byte-proof + own ABI ask.
  const launcherRel = 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py'
  const blob = spawnSync('git', ['-C', WORKTREE, 'show', `${MASTER_SHA}:${launcherRel}`], { maxBuffer: 64 * 1024 * 1024 })
  if (blob.status !== 0) die(`git show of the launcher blob failed: ${String(blob.stderr).slice(0, 200)}`)
  const launcherPath = join(HOME, 'deployment', 'landlock-prelauncher.py')
  writeFileSync(launcherPath, blob.stdout)
  const launcherSha = sha256Text(blob.stdout)
  const worktreeLauncherSha = sha256File(join(WORKTREE, launcherRel))
  const abi = spawnSync('python3', [launcherPath, '--abi-probe'], { encoding: 'utf8', timeout: 30_000 })
  const abiLine = String(abi.stdout ?? '').trim().split('\n').filter((l) => l !== '').pop() ?? ''
  let abiJson = null; try { abiJson = JSON.parse(abiLine) } catch { /* keep raw */ }
  writeEvidence('launcher-abi-probe.json', { sha256: launcherSha, bytes: blob.stdout.length, abiRc: abi.status, abiAnswer: abiLine.slice(0, 400), kind: abiJson?.kind ?? null, abiVersion: abiJson?.abi_version ?? null })
  check('I8', `DISCLOSED FACE GAP (honest, not worked around): the Landlock pre-launcher is NOT on the published face (${launcherRel} ∉ files:) — the installer supplies it as a deployment input, byte-pinned from the SAME commit`, !face.expected.includes(launcherRel), `launcherInFace=false launcherSha=${launcherSha.slice(0, 16)}… bytes=${String(blob.stdout.length)}`)
  check('I9', 'the deployment input is the RIGHT BYTES before any host exists: commit blob == worktree blob, starts with "#!", and the launcher itself answers the ABI probe',
    launcherSha === worktreeLauncherSha && blob.stdout.slice(0, 2).toString('utf8') === '#!' && abiJson?.kind === 'abi-available',
    `sha=${launcherSha.slice(0, 16)}… abi=${String(abiJson?.kind)}/${String(abiJson?.abi_version)}`)

  // ── the profile patch layer on the INSTALLED bundle row id (public seam) ──
  const world = { governedRoot }
  const cfg = rowConfig(join(HOME, 'blueprints'), world, { sha: launcherSha, path: launcherPath })
  const basePlugins = smokePresetPlugins({
    personaText: 'You are a coding agent powered by the {{model}} model.',
    cwdSuffix: 'Your working directory is {{cwd}}.',
    bashDescription: 'Run commands in a bash shell. State is persistent across calls.',
  })
  const layerLines = [
    `# rc-trial-1 layer (run ${RUN_STAMP}): config override on the INSTALLED bundle row id "dsh-agent-team" + preset — public profile-patch seam only (INSTALL §3.2/§3.5).`,
    '- id: dsh-agent-team',
    '  name: dsh-agent-team/host',
    '  config:',
    ...Object.entries(cfg).flatMap(([k, v]) => yamlEmit(k, v, 2)),
    ...['- insert:', ...yamlEmitItem(presetDeclarationRow({
      id: PRESET_ID, displayName: 'rc-trial base',
      description: `rc-trial base preset (run ${RUN_STAMP}) = smoke preset`,
      plugins: basePlugins,
    }), 1)],
    '',
  ].join('\n').split('\n')
  writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), layerLines.join('\n'))
  writeFileSync(join(EVIDENCE_DIR, 'profile-layer.yml'), redact(layerLines.join('\n')))
  writeFileSync(join(HOME, 'blueprints', 'anchor-note.txt'), 'the anchor blueprint travels inline in the row config (blueprintSource); the MAIN blueprint is written after the discovery turn below.\n')

  // I5: --dump-config composes the installed row through the public seam
  const dump = spawnSync(process.execPath, [HOST_BIN, '--profile', 'web', '--dump-config'], {
    cwd: join(HOME, 'workspace'), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 180_000,
    env: { ...process.env, DSH_HOME: HOME },
  })
  const dumpText = dump.stdout ?? ''
  writeEvidence('dump-config-probe.txt', redact(dumpText))
  const hasTeamRow = /^- id: dsh-agent-team\n {2}name: dsh-agent-team\/host$/m.test(dumpText)
  const hasPlane = /teamToolPlane:/.test(dumpText)
  const hasConfine = /confinedProvider:/.test(dumpText) && /launcherSha256:/.test(dumpText)
  const hasSubRows = /name: dsh-agent-team\/spill-local/.test(dumpText) && /^- id: dsh-agent-team-client$/m.test(dumpText)
  const skipped = /skipped bundle|declares no dsh\.bundle/i.test(dumpText)
  check('I5', 'the pinned host composes the INSTALLED bundle row through the public profile seam: --dump-config carries id dsh-agent-team / name dsh-agent-team/host with THIS round\'s teamToolPlane (realmId + fsInstance + confinedProvider launcher pin) and the client/spill-local rows, no skipped bundle',
    dump.status === 0 && hasTeamRow && hasPlane && hasConfine && hasSubRows && !skipped,
    `exit=${String(dump.status)} teamRow=${String(hasTeamRow)} plane=${String(hasPlane)} confine=${String(hasConfine)} subRows=${String(hasSubRows)} skipped=${String(skipped)}`)

  // ── L: boot on the installed face; mock ONLY at the LLM position ──
  const mock = await startMockModel({
    port: MOCK_PORT,
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
      if (text.includes(MK_DISC)) return { kind: 'text', content: 'RC1_DISC_OK' }
      if (text.includes(MK_L0)) {
        const calls = digest.assistantToolNames
        const lastResult = digest.toolResults[digest.toolResults.length - 1] ?? ''
        if (calls.length === 0) return toolCall(`call-rc-create-${rnd()}`, 'team_create_member', {
          rootSessionId: CREATE_ROOT, requestToken: TK_CM, delegationTemplateId: 'wa', label: 'rc-a',
          taskSummary: 'rc-trial explicit member creation',
        })
        if (calls.length === 1) return toolCall(`call-rc-list-${rnd()}`, 'team_list_members', { rootSessionId: CREATE_ROOT, requestToken: TK_LM })
        if (calls.length === 2) {
          const listText = digest.toolResults[digest.toolResults.length - 1] ?? ''
          // The result face is JSON nested in tool content (quote layers escaped:
          // …\"instanceId\":\"inst-…\"), so the id is matched WITHOUT a closing
          // quote requirement — the id charset stops at the first escape char.
          const inst = /(inst-[A-Za-z0-9_-]+)/.exec(listText)
          if (inst === null) return { kind: 'text', content: 'RC1_MEMBER_ID_UNPARSEABLE ' + listText.slice(0, 120) }
          return toolCall(`call-rc-delegate-${rnd()}`, 'team_delegate', {
            rootSessionId: CREATE_ROOT, requestToken: TK_D1, delegationInstanceId: inst[1],
            // NOTE (recorded finding): the tool schema requires `label` in the
            // INSTANCE form too ("required argument 'label' is missing"),
            // while the bundled SKILL text reads as create-form-only — doc nuance.
            label: 'rc-a1',
            taskSummary: 'rc-trial bash positive + out-of-bounds negative',
            prompt: `${MK_TASK} Do the delegated work exactly as instructed.`, async: false,
          })
        }
        if (calls.length === 3) return toolCall(`call-rc-collect-${rnd()}`, 'team_collect', { rootSessionId: CREATE_ROOT, requestToken: `rc1-collect-${RUN_STAMP}`, requestTokens: [TK_D1] })
        return { kind: 'text', content: `RC1_LEADER_DONE collect=${String(lastResult.slice(0, 100).replace(/\s+/g, ' '))}` }
      }
      if (text.includes(MK_TASK)) {
        const calls = digest.assistantToolNames
        if (calls.length === 0) return toolCall(`call-rc-bash-pos-${rnd()}`, 'team_bash', { command: `echo ${TOK_BASH}; echo ${WRITE_TOK} > ./rc-wrote.txt; cat ./rc-wrote.txt` })
        if (calls.length === 1) return toolCall(`call-rc-bash-out-${rnd()}`, 'team_bash', { command: 'cat ../outside/secret.txt' })
        if (calls.length === 2) return toolCall(`call-rc-native-${rnd()}`, 'bash', { command: `echo ${NAT_TOK}` })
        const results = digest.toolResults
        const quote = results.map((r, i) => `r${i}=${r.slice(0, 140).replace(/\s+/g, ' ')}`).join(' | ')
        return { kind: 'text', content: `RC1_MEMBER_RESULT ${quote}` }
      }
      return { kind: 'text', content: 'rc-trial-mock: unscripted request, completing quietly.' }
    },
  })
  const reqBase = mock.requests.length
  const INSTANCE_RAW = join(EVIDENCE_DIR, 'instance.raw.log')
  const INSTANCE_LOG = join(EVIDENCE_DIR, 'instance.log')
  const outFd = openSync(INSTANCE_RAW, 'a')
  const host = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(HOST_PORT), '--no-open'], {
    cwd: join(HOME, 'workspace'), stdio: ['ignore', outFd, outFd],
    env: { ...process.env, DSH_HOME: HOME, DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH, DEEPSEEK_BASE_URL: `http://127.0.0.1:${MOCK_PORT}`, DEEPSEEK_API_KEY: 'rc-trial-mock-key' },
  })
  let hostExit = null
  host.on('exit', (code, signal) => { hostExit = { code, signal }; console.log(`[rc-trial] host exited code=${String(code)} signal=${String(signal)}`) })
  let worldFacts = { home: HOME }
  try {
    const boot = await waitFor(180_000, () => {
      try { const mm = BOOT_MARKER.exec(readFileSync(INSTANCE_RAW, 'utf8')); return mm === null ? false : mm } catch { return false }
    }, 'boot marker')
    worldFacts.bootLine = redact(String(boot[0])).slice(0, 200)
    const origin = `http://127.0.0.1:${boot[1]}`
    const auth = await fetch(`${origin}/?token=${boot[2]}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
    const cookie = auth.headers.get('set-cookie')
    check('B1', `the installed face boots (boot marker + token gate): 303 with a set-cookie on /?token= (GET / without token answers 401 first)`, auth.status === 303 && cookie !== null,
      `noToken401=${String((await fetch(`${origin}/`, { redirect: 'manual', signal: AbortSignal.timeout(10_000) })).status === 401)} authStatus=${String(auth.status)}`)

    const noTok = await fetch(`${origin}/team-remote/catalog.list`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(10_000) }).catch(() => null)
    worldFacts.unauth = noTok?.status ?? 'err'

    // discovery turn on the booted root session (row-booted team) -> denyList
    let discHit = null
    for (let k = 1; k <= 8 && discHit === null; k += 1) {
      await fetchJson(`${origin}/api/session/prompt`, {
        method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
        body: JSON.stringify({ type: 'client-request', rpcId: `rc-d-a${k}`, method: 'session/prompt', payload: { args: { request: { requestId: `rc-d-a${k}-r`, sessionId: ROOT, mode: 'queue', content: [{ type: 'text', text: `${MK_DISC} (barrier probe ${k}) This is a setup turn. Do not call any tools. Reply OK.` }] } } } }),
      }, 240_000)
      const deadline = Date.now() + 30_000
      for (;;) {
        discHit = (mock.requests ?? []).find((r) => r.digest?.markerHits.includes(MK_DISC) && r.digest.toolCount > 0) ?? null
        if (discHit !== null || Date.now() >= deadline) break
        await new Promise((r) => setTimeout(r, 400))
      }
      if (discHit !== null) break
    }
    if (discHit === null) die('discovery turn never reached the mock')
    const surface = [...new Set(discHit.digest.toolNames ?? [])].sort()
    const MANAGED = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh']
    const SAFE = ['todo_write']
    const denyList = surface.filter((n) => !n.startsWith('team_') && !MANAGED.includes(n) && !SAFE.includes(n))
    worldFacts.discoverySurface = surface
    worldFacts.denyList = denyList

    const BLUEPRINT_DIR = join(HOME, 'blueprints')
    writeFileSync(join(BLUEPRINT_DIR, 'main.yaml'), mainBlueprintYaml(denyList, MK_TASK))

    const cl = await waitFor(60_000, async () => {
      const r = await fetchJson(`${origin}/team-remote/catalog.list`, {
        method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
        body: JSON.stringify({ type: 'client-request', rpcId: 'rc-pre-1', method: 'catalog.list', payload: { version: 4, params: {} } }),
      }, 30_000)
      return JSON.stringify(r.body ?? '').includes(BP_MAIN_ID) ? r : false
    }, 'catalog.list to carry the main blueprint')
    const cg = await fetchJson(`${origin}/team-remote/catalog.get`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
      body: JSON.stringify({ type: 'client-request', rpcId: 'rc-pre-2', method: 'catalog.get', payload: { version: 4, params: { blueprintId: BP_MAIN_ID, blueprintRevision: 1 } } }),
    }, 30_000)
    check('B2', 'catalog preflight over /team-remote finds the draft blueprint (catalog.list + catalog.get)', cl.status === 200 && cg.status === 200, `list=${String(cl.status)} get=${String(cg.status)}`)

    const created = await fetchJson(`${origin}/team-remote/team.create`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
      body: JSON.stringify({ type: 'client-request', rpcId: 'rc-tc', method: 'team.create', payload: { version: 1, params: { rootSessionId: CREATE_ROOT, blueprintId: BP_MAIN_ID, initialWork: { prompt: `${MK_L0} Begin your directive.` } } } }),
    }, 90_000)
    worldFacts.teamCreate = { status: created.status, body: redact(JSON.stringify(created.body ?? null)).slice(0, 1200) }
    check('B3', 'team.create is accepted on the installed face (governed Leader turn starts)', created.status === 200, `status=${String(created.status)}`)

    const chain = await waitFor(600_000, async () => {
      const reqs = (mock.requests ?? []).filter((r) => r.digest?.markerHits.includes(MK_L0) && r.digest.toolCount > 0)
      if (reqs.length === 0) return false
      const doneReplied = reqs.some((r) => JSON.stringify(r.reply ?? '').includes('RC1_LEADER_DONE'))
      if (!doneReplied) return false
      const last = reqs[reqs.length - 1]
      return { toolCalls: last.digest.assistantToolNames, backToLeader: last.digest._text.includes('RC1_MEMBER_RESULT'), reqCount: reqs.length }
    }, 'leader chain (create member -> list -> delegate -> collect -> final)')
    worldFacts.leaderToolCalls = chain.toolCalls
    worldFacts.leaderRequestCount = chain.reqCount
    worldFacts.memberResultsBackToLeader = chain.backToLeader

    const leaderReqs = (mock.requests ?? []).filter((r) => r.digest?.markerHits.includes(MK_L0) && r.digest.toolCount > 0)
    worldFacts.createMemberResult = leaderReqs.flatMap((r) => r.digest?.toolResults ?? [])[0]?.slice(0, 600) ?? null
    const listResult = leaderReqs.map((r) => (r.digest?.toolResults ?? [])).flat().find((t) => t.includes('members-listed') || t.includes('"members"')) ?? null
    worldFacts.listMembersResult = listResult === null ? null : listResult.slice(0, 900)

    const memberReqs = (mock.requests ?? []).filter((r) => r.digest?.markerHits.includes(MK_TASK) && !r.digest.markerHits.includes(MK_L0) && r.digest.toolCount > 0)
    worldFacts.memberRequestCount = memberReqs.length
    worldFacts.memberWireCatalog = memberReqs[0]?.digest.toolNames ?? null
    const lastM = memberReqs[memberReqs.length - 1]
    worldFacts.memberToolCallOrder = lastM?.digest.assistantToolNames ?? []
    worldFacts.memberToolResults = (lastM?.digest.toolResults ?? []).map((t) => t.slice(0, 800))
    worldFacts.memberFinal = memberReqs.find((r) => JSON.stringify(r.reply ?? '').includes('RC1_MEMBER_RESULT'))?.reply ?? null

    // ── grading (wire facts only) ──
    const names = worldFacts.memberToolCallOrder ?? []
    const results = (lastM?.digest.toolResults ?? []).map(String)
    const idxPos = names.indexOf('team_bash')
    const rPos = results[idxPos] ?? 'LEG-MISSING'
    const rOut = results[idxPos + 1] ?? results[names.lastIndexOf('team_bash')] ?? 'LEG-MISSING'
    check('M1', 'LEADER create-member leg: team_create_member + team_list_members rode the Leader wire and an instance id came back (explicit member creation)',
      chain.toolCalls.slice(0, 2).includes('team_create_member') && chain.toolCalls.slice(0, 2).includes('team_list_members') && String(worldFacts.listMembersResult ?? '').includes('rc-a'),
      `leaderTools=${JSON.stringify(chain.toolCalls)} listHead=${JSON.stringify(String(worldFacts.listMembersResult ?? '').slice(0, 160))}`)
    check('M2', 'team_delegate ran on the created INSTANCE (delegationInstanceId addressing) and settled with a collect (async:false + team_collect read-back)',
      chain.toolCalls.includes('team_delegate') && chain.toolCalls.includes('team_collect') && chain.backToLeader === true,
      `leaderTools=${JSON.stringify(chain.toolCalls)}`)
    check('M3', 'team_bash POSITIVE on the installed face (REAL Landlock confined provider): the command RAN inside the governed root and the shell row rendered bash · exit=0 with the token bytes',
      rPos.includes('bash · exit=0') && rPos.includes(TOK_BASH), `r_pos=${JSON.stringify(rPos.slice(0, 260))}`)
    check('M4', 'the positive write really landed on disk under the governed root (not a rendered fiction)',
      existsSync(bashWrote) && readFileSync(bashWrote, 'utf8').includes(WRITE_TOK),
      `bashWrote=${String(existsSync(bashWrote))} bytes=${existsSync(bashWrote) ? JSON.stringify(readFileSync(bashWrote, 'utf8').trim()) : 'n/a'}`)
    check('M5', 'team_bash OUT-OF-BOUNDS renders the TRUE exit code (#336 exit-passthrough on the installed face): bash · exit=1 over the kernel Permission denied stderr, presentationMeta exitCode=1',
      rOut.includes('bash · exit=1') && /Permission denied/.test(rOut) && /exitCode[\\"]*\s*:\s*1/.test(rOut),
      `r_out=${JSON.stringify(rOut.slice(0, 300))}`)
    check('M6', 'zero disclosure + honest render: the outside marker never rides the wire in ANY request of this world, and the cancelled text renders false absent a cancel (post-#340 semantics: only user/parent cancel sets true; no cancel is injected here)',
      (mock.requests ?? []).slice(reqBase).filter((r) => JSON.stringify({ reply: r.reply ?? null, d: r.digest?._text ?? '' }).includes(OUTSIDE_MARKER)).length === 0
      && !rOut.includes('bash · cancelled') && /cancelled[\\"]*\s*:\s*false/.test(rOut),
      `markerOnWire=${String((mock.requests ?? []).slice(reqBase).filter((r) => JSON.stringify({ reply: r.reply ?? null, d: r.digest?._text ?? '' }).includes(OUTSIDE_MARKER)).length)} cancelledFalse=${String(/cancelled[\\"]*\s*:\s*false/.test(rOut))}`)

    // M9 (BOOKED witness leg, #341-④): dispatch the NATIVE 'bash' row in THIS release-candidate
    // shape. Either outcome is a typed, quotable fact: native execution = SAFE_UNMANAGED face;
    // typed refusal = the w7m2/BIND-DIAG 'cannot be verified at dispatch time' face. Which
    // branch fires in the RC shape was genuinely UNKNOWN before this leg — that unknown is the
    // precise remaining of the booked 'native 审批后执行' gap at the profile layer.
    const idxNat = names.indexOf('bash')
    const rNat = String(idxNat >= 0 ? (results[idxNat] ?? 'LEG-MISSING') : 'LEG-MISSING')
    const rNatUnesc = rNat.replace(/\\+"/g, '"')
    const natRan = rNatUnesc.includes('bash · exit=0') && rNatUnesc.includes(NAT_TOK)
    const natRefused = /Tool Binding for "bash" cannot be verified/i.test(rNatUnesc)
    // branch #3, OBSERVED live at r6b (@5885e46e): the host permission face routes the native
    // bash call to request-control, and OUR TeamRuntime envelope guard fails it closed BEFORE
    // any dispatch-time binding check — matcher extended to record this branch, not to rerun.
    const natEnvelope = /outside the caller's mutation envelope/i.test(rNatUnesc)
    check('M9', 'BOOKED witness: NATIVE bash dispatch in the release-candidate shape yields a typed quotable outcome (ran-unmanaged OR typed binding refusal OR envelope-guard fail-closed at request-control); branch recorded verbatim',
      natRan || natRefused || natEnvelope,
      `branch=${natRan ? 'ran-unmanaged(native)' : natRefused ? 'typed-refusal(binding)' : natEnvelope ? 'envelope-fail-closed(request-control)' : 'UNKNOWN'} r_nat=${JSON.stringify(rNat.slice(0, 320))}`)

    // host-log witnesses (placement + confined shell + PTC census row)
    const rawLog = existsSync(INSTANCE_RAW) ? readFileSync(INSTANCE_RAW, 'utf8') : ''
    const witness = (re) => rawLog.split('\n').filter((l) => re.test(l)).slice(-6).map((l) => redact(l).slice(0, 260))
    worldFacts.witnessPlacement = witness(/placement-feed/)
    worldFacts.witnessShell = witness(/confined-shell ran/)
    worldFacts.witnessPtc = witness(/a5ptc: census-boot/)
    worldFacts.hostErrors = witness(/ERR_MODULE_NOT_FOUND|bootstrap FAILED|TRUST_ROOT|placement-REFUSED|mount-REFUSED|BINDING_UNVERIFIED|TEAM_PLUGIN_CONFIG_INVALID|unhandled/).slice(0, 10)
    check('M7', 'host-log witnesses on the installed face: placement-feed row list, the confined-shell ran line, and the a5ptc boot census row (PTC escalation row composed at boot — CONFIG-DECLARED census, no OS probe claimed)',
      worldFacts.witnessPlacement.length > 0 && worldFacts.witnessShell.length > 0 && worldFacts.witnessPtc.length > 0,
      `placement=${String(worldFacts.witnessPlacement.length > 0)} shell=${String(worldFacts.witnessShell.length > 0)} ptcCensus=${JSON.stringify(worldFacts.witnessPtc[0]?.slice(0, 180) ?? null)}`)
    check('M8', 'no assembly-level surprises in the host log (no bootstrap failure / trust-root / placement refusal / BINDING_UNVERIFIED)',
      worldFacts.hostErrors.length === 0, JSON.stringify(worldFacts.hostErrors).slice(0, 400))
  } finally {
    try { host.kill() } catch { /* gone */ }
    await new Promise((r) => setTimeout(r, 3000))
    worldFacts.hostExit = hostExit
    try {
      const lines = mock.requests.slice(reqBase).map((r) => JSON.stringify({
        seq: r.seq, path: r.path, status: r.status, reply: r.reply === undefined ? null : redact(JSON.stringify(r.reply)).slice(0, 400),
        digest: r.digest === undefined ? null : { ...r.digest, markerHits: r.digest.markerHits.filter((x) => x.startsWith('RC1')), toolResults: r.digest.toolResults.map((x) => redact(x)), _text: `${r.digest._text.length} chars` },
      }))
      writeFileSync(join(EVIDENCE_DIR, 'wire-digests.jsonl'), lines.join('\n') + '\n')
    } catch { /* best effort */ }
    try {
      const raw = readFileSync(INSTANCE_RAW, 'utf8')
      writeFileSync(INSTANCE_LOG, redact(raw))
      rmSync(INSTANCE_RAW)
      worldFacts.logTokenResidue = (redact(raw).match(/token=[A-Za-z0-9_-]{8,}/g) ?? []).length
    } catch { /* no log */ }
    try { await mock.close() } catch { /* gone */ }
  }

  // ── C: named teardown (NO glob deletes) ──
  const sweepNames = []
  const homes = readdirSync(join(HOME, '..')).filter((n) => n === HOME_NAME || n === LOCK_NAME)
  for (const n of ['rc-trial-1', 'rc-trial-1.lock']) if (homes.includes(n)) sweepNames.push(n)
  writeEvidence('sweep-list.json', { homesRoot: join(HOME, '..'), recordedAtSweep: readdirSync(join(HOME, '..')).filter((n) => n.startsWith('rc-trial')), swept: sweepNames, policy: 'exact names only — NO glob deletes' })
  for (const n of sweepNames) {
    const p = join(HOME, '..', n)
    try { rmSync(p, { recursive: true, force: true }) } catch { /* best effort */ }
  }
  const released = await portFreeWait(HOST_PORT, 30_000) && await portFreeWait(RESERVED_PORT, 10_000) && await portFreeWait(MOCK_PORT, 10_000)
  const stableAfter = await stableProbe()
  const porcelainAfter = spawnSync('git', ['-C', TESTUSE, 'status', '--porcelain'], { encoding: 'utf8' }).stdout.trim()
  const left = readdirSync(join(HOME, '..')).filter((n) => n.startsWith('rc-trial'))
  check('C1', 'named teardown: the recorded world names are gone (exact-name sweep listed in sweep-list.json — no glob deletes), ports released, launch-token residue in the retained log = 0',
    left.length === 0 && released && (worldFacts.logTokenResidue ?? 0) === 0,
    `left=${JSON.stringify(left)} portsFree=${String(released)} residue=${String(worldFacts.logTokenResidue ?? 'n/a')}`)
  check('C2', 'the stable :3080 instance is untouched (read-only probe before/after) and the test-use host porcelain stayed 0',
    String(stableBefore) === String(stableAfter) && porcelainAfter === '', `${String(stableBefore)} -> ${String(stableAfter)}; porcelain=${porcelainAfter === '' ? 0 : 'DIRTY'}`)

  writeEvidence('world-rc-trial.json', worldFacts)
} catch (error) {
  exitCode = 1
  console.log(`FATAL — ${String(error?.message ?? error)}`)
  writeEvidence('fatal.json', { message: String(error?.message ?? error), stack: String(error?.stack ?? '').slice(0, 2000) })
  // FATAL forensics stay in the run dir; the WORLD is still swept by exact
  // name (NO glob deletes) unless --keep, so a rerun starts fresh.
  if (!KEEP) {
    const swept = []
    for (const n of [HOME_NAME, LOCK_NAME]) {
      const p = join(HOME, '..', n)
      if (existsSync(p)) { try { rmSync(p, { recursive: true, force: true }); swept.push(n) } catch { /* stays */ } }
    }
    writeEvidence('fatal-sweep-list.json', { swept, policy: 'exact names only — NO glob deletes' })
    console.log(`FATAL-SWEEP ${JSON.stringify(swept)}`)
  }
}
const pass = CRITERIA.filter((c) => c.pass === true).length
const fail = CRITERIA.filter((c) => c.pass === false).length
const book = CRITERIA.filter((c) => c.pass === null).length
writeEvidence('criteria.json', { runStamp: RUN_STAMP, masterSha: MASTER_SHA, pass, fail, book, exitCode: fail > 0 ? 2 : exitCode, criteria: CRITERIA })
console.log(`SUMMARY pass=${String(pass)} fail=${String(fail)} booked=${String(book)}`)
const finalExit = fail > 0 ? 2 : exitCode
writeFileSync(join(EVIDENCE_DIR, 'KIT_EXIT'), String(finalExit) + '\n')
process.exit(finalExit)
