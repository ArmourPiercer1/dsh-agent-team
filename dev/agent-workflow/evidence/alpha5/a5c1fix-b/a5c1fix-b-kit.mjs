#!/usr/bin/env node
/**
 * c1sw-kit.mjs — assembly-level reproduction for the a5ie-r5 C1 red.
 *
 * RED FACT (reproduced here, one world, real installed face @5885e46e):
 *   the public session/cancel RPC hits the member's in-flight sleep leg,
 *   the wire lands `Error: tool call aborted` (scheduler death form), and the
 *   lane witness carries `cancelled=false` — the pair this kit measures with:
 *   M-probes (c1sw-probe-row.mjs): the signal/cause the row receives on the
 *   REAL RPC path; settle watcher: TRUE first-seen times (r5's scan started
 *   only after the 5s nudge — its +5.02s was a bound, not a measurement);
 *   scratch forensics: launcher exit.json {pid, rc} + mtimes = the payload's
 *   actual death cause and time; direct-route control: the SAME registered
 *   team_bash definition, called lane-direct with {kind:'user'} = green.
 *
 * One world, one member, three steps (true / sleep 90 [cancelled] /
 * kill -9 $$) + final quote; then the MIT phase re-arms ONE more sleep leg
 * with the post-execute accept-replacement probe enabled (grades whether the
 * public seam can carry the cancelled form to the wire AFTER the host's
 * aborted-replacement — mitigation feasibility, live).
 *
 * Discipline: no product/host byte touched; :3080 probe-only; homes
 * exact-name swept (c1sw-diag-*); raw logs redacted then deleted; test-use
 * porcelain 0 after; KIT_EXIT 0 = the C1 red reproduced + green control green.
 *
 * Usage: node a5c1fix-kit.mjs [--keep] [--port 3188] [--install-sha <sha>]
 * REVERIFICATION fork (root 22:16Z): install face = a5-abort-cause@a1bf18fa (the FIX),
 * real RPC session/cancel user-arm full chain, four conditions + witness flip.
 * @module evidence/alpha5/c1-swallow-diag/c1sw-kit
 */
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startMockModel } from './mock-deepseek.copy.mjs'

const args = process.argv.slice(2)
const argValue = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1] }
const KEEP = args.includes('--keep')
const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..', '..', '..', '..')
const RUN_STAMP = new Date().toISOString().slice(0, 19).replace(/:/g, '-') + 'Z'
const EVIDENCE_DIR = join(HERE, 'runs', RUN_STAMP)
mkdirSync(EVIDENCE_DIR, { recursive: true })

const HOST_PORT = Number(argValue('port', 3189))
const INSTALL_PIN = String(argValue('install-sha', 'a1bf18fa995fd61f5168b19bdc49600c934b1d46'))
const INSTALL_SPEC = `github:ArmourPiercer1/dsh-agent-team#${INSTALL_PIN}`
const STORE_DIR = join(REPO, '.pnpm-store-c1sw-diag')
const TESTUSE = join(REPO, 'tests', 'deepseek-harness-test-use')
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
// alpha5-lineage host pin (tests/paths.mjs on the alpha5 branches; the root
// paths.mjs still carries the 0.1.7-rc.1-era pair — disclosed, not silently mixed)
const CLIENT_COMMIT_HASH = '639ed01539'
const WORLD_PREFIX = 'a5c1fix-b'
const HOME_ROOT = join(REPO, 'tests', 'homes')
const homeDir = (name) => join(HOME_ROOT, name)
const PRESET_ID = 'c1sw-base'
const ROOT = 'c1sw-root'
const CREATE_ROOT = `session-c1sw-team-${RUN_STAMP}`
const BP_MAIN_ID = 'c1sw-main-bp'
const BP_ANCHOR_ID = 'c1sw-anchor-bp'
const TK_A1 = 'c1sw-tok-a1'
const PROBE_ROW_URL = new URL('./c1sw-probe-row/c1sw-probe-row.mjs', import.meta.url).href

const die = (m) => {
  console.error(`FATAL: ${m}`)
  writeEvidence('fatal.json', { fatal: m, stamp: RUN_STAMP })
  try { writeEvidence('leg-ledger.jsonl', LEDGER.map((r) => JSON.stringify(r)).join('\n')) } catch { /* best effort */ }
  if (CURRENT_HOST !== null && CURRENT_HOST.exitCode === null) { try { killTree(CURRENT_HOST.pid) } catch { /* gone */ } }
  try { const RAWP = join(EVIDENCE_DIR, 'instance.raw.log'); const raw = readFileSync(RAWP, 'utf8'); writeFileSync(join(EVIDENCE_DIR, 'instance.log'), redact(raw)); rmSync(RAWP) } catch { /* best effort */ }
  if (!KEEP) { try { sweepHomes() } catch { /* best effort */ } }
  process.exit(1)
}
let CURRENT_HOST = null
function sweepHomes () {
  for (const d of readdirSync(HOME_ROOT).filter((x) => x.startsWith(`${WORLD_PREFIX}-`))) rmSync(join(HOME_ROOT, d), { recursive: true, force: true })
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
const sha256Text = (buf) => createHash('sha256').update(buf).digest('hex')
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/

const LEDGER = []
function check (id, claim, cond, observed) {
  LEDGER.push({ id, claim, pass: Boolean(cond), observed: String(observed).slice(0, 400) })
  console.log(`${cond ? 'PASS' : 'FAIL'} ${id} — ${claim} [${String(observed).slice(0, 200)}]`)
}
function note (id, claim, observed) {
  LEDGER.push({ id, claim, pass: null, observed: String(observed).slice(0, 400) })
  console.log(`BOOK ${id} — ${claim} [${String(observed).slice(0, 200)}]`)
}

async function portFree (port) {
  const { createServer } = await import('node:net')
  return await new Promise((res) => {
    const s = createServer()
    s.once('error', () => res(false))
    s.listen(port, '127.0.0.1', () => { s.close(() => res(true)) })
  })
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function waitFor (deadlineMs, fn, what) {
  const t0 = Date.now()
  for (;;) {
    const v = await fn()
    if (v !== false && v !== null && v !== undefined) return v
    if (Date.now() - t0 > deadlineMs) die(`timeout waiting for ${what}`)
    await sleep(200)
  }
}
async function fetchJson (url, init, timeoutMs = 30_000) {
  const res = await fetch(url, { ...(init ?? {}), signal: AbortSignal.timeout(timeoutMs) })
  const text = await res.text()
  try { return { status: res.status, body: JSON.parse(text) } } catch { return { status: res.status, body: text } }
}
const stableProbe = async () => {
  try { const r = await fetch('http://127.0.0.1:3080/', { redirect: 'manual', signal: AbortSignal.timeout(5000) }); return r.status } catch { return 'unreachable' }
}

// ── install (public face, warm-store retry for the r5 TLS-flake precedent) ──
function profileWorkspaceYaml () {
  return `packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\nstoreDir: ${STORE_DIR}\n`
}
function realInstall (world) {
  const profileDir = join(world, 'profiles', 'web')
  mkdirSync(profileDir, { recursive: true })
  writeFileSync(join(profileDir, 'pnpm-workspace.yaml'), profileWorkspaceYaml())
  const t0 = Date.now()
  let r = null
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    r = spawnSync(process.execPath, [HOST_BIN, 'plugin', '--profile', 'web', 'add', INSTALL_SPEC], {
      cwd: join(world, 'workspace'), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 900_000,
      env: { ...process.env, DSH_HOME: world },
    })
    if (r.status === 0) break
    if (attempt < 3) { writeEvidence(`install-attempt-${String(attempt)}.log`, redact(`${r.stdout ?? ''}${r.stderr ?? ''}`)); console.log(`install attempt ${String(attempt)} failed (TLS-flake precedent: bounded retry)`); }
  }
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? `\nSPAWN-ERROR: ${String(r.error.message ?? r.error)}` : ''}`
  writeEvidence('install.log', redact(`$ node ${HOST_BIN} plugin --profile web add ${INSTALL_SPEC}\n(cwd ${join(world, 'workspace')}, DSH_HOME=${world})\nexit=${String(r.status)} in ${String(Math.round((Date.now() - t0) / 1000))}s\n\n${out}`))
  const manifestPath = join(profileDir, 'package.json')
  return {
    exit: r.status, profileDir,
    manifest: existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null,
    installedDir: join(profileDir, 'node_modules', 'dsh-agent-team'),
    tail: redact(out).split('\n').filter((l) => l.trim() !== '').slice(-6).join(' | ').slice(0, 500),
  }
}
function materializeLauncher (destPath) {
  const rel = 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py'
  const blob = spawnSync('git', ['-C', REPO, 'show', `${INSTALL_PIN}:${rel}`], { maxBuffer: 64 * 1024 * 1024 })
  if (blob.status !== 0) die(`git show launcher blob failed: ${String(blob.stderr).slice(0, 160)}`)
  mkdirSync(dirname(destPath), { recursive: true })
  writeFileSync(destPath, blob.stdout)
  return { path: destPath, sha: sha256Text(blob.stdout), bytes: blob.stdout.length }
}
function abiPreflight (launcherPath) {
  const r = spawnSync('python3', [launcherPath, '--abi-probe'], { encoding: 'utf8', timeout: 30_000 })
  const line = String(r.stdout ?? '').trim().split('\n').filter((l) => l !== '').pop() ?? ''
  let parsed = null; try { parsed = JSON.parse(line) } catch { /* noop */ }
  return { rc: r.status, answer: line.slice(0, 200), abiVersion: typeof parsed?.abi_version === 'number' ? parsed.abi_version : null }
}

// ── YAML emit (flat, the r5 shape) ──
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
  'leader:', '  templateId: leader', '  persona: "You are the leader of the c1sw team."',
  'members:', '  - templateId: wa', '    persona: "You are a worker of the c1sw team."',
  'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
  'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
].join('\n')

const STEPS = [
  ['team_bash', { command: 'true' }],
  ['team_bash', { command: 'i=0; while [ $i -lt 90 ]; do echo tick-$i >> a5c1fixb-seed.log; sleep 1; i=$((i+1)); done' }],
  ['team_bash', { command: 'kill -9 $$' }],
]
const stepMarker = ([name, a]) => `tool_use:${name}${JSON.stringify(a)}`
const MIT_STEP = ['team_bash', { command: 'sleep 20' }]
const MIT_MARKER = stepMarker(MIT_STEP)
function mainBlueprintYaml (denyList, mkTaskA) {
  const denyBlock = (pad) => denyList.length === 0 ? [`${pad}builtinToolDeny: []`] : [`${pad}builtinToolDeny:`, ...denyList.map((n) => `${pad}  - ${n}`)]
  const taskA = TASK_A_TEXT
  const leaderPersona = `You are the leader of the c1sw team. On your directive: FIRST call team_delegate exactly once with rootSessionId ${CREATE_ROOT}, requestToken ${TK_A1}, delegationTemplateId "wa", label "sw-a", async false, and the prompt ${JSON.stringify(taskA)}; SECOND call team_collect with rootSessionId ${CREATE_ROOT} and requestTokens ["${TK_A1}"]; THIRD finish with one line starting A5C1FIXB_LEADER_DONE.`
  return [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
    'displayName: "c1sw-diag cancel team"',
    'description: "c1sw-diag: minimal three-leg cancel repro on the REAL installed face @5885e46e (#340); mock only at the LLM position; probe row measures the signal/cause the row receives."',
    'leader:', '  templateId: leader', `  persona: ${JSON.stringify(leaderPersona)}`,
    '  capabilities:', '    teamTools:', '      kind: allow', '      items:', '        - team_delegate', '        - team_collect',
    ...denyBlock('    '),
    '    skills:', '      kind: allow', '      items: []', '    mcp:', '      kind: allow', '      items: []',
    '    permissions:', '      default: ask', '      allow: []', '      ask: []', '      deny: []',
    'teamEnvelope:', '  allow:', '    - assign-task', '    - create-member', '    - send-message', '    - report-progress', '  deny: []',
    'members:', '  - templateId: wa', '    displayName: "c1sw worker A"',
    '    persona: "You are worker A of the c1sw team. Follow delegated work exactly, tool by tool, in order. If interrupted, continue at the first unfinished call."',
    '    capabilities:', '      teamTools:', '        kind: allow', '        items: []', '      builtinToolDeny: []',
    '      skills:', '        kind: allow', '        items: []', '      mcp:', '        kind: allow', '        items: []',
    '      permissions:', '        default: ask', '        allow:', '          - tool: read', '            resource:', '              kind: any', '        ask: []', '        deny: []',
    'memberEnvelopes:', '  - templateId: wa', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
    'permissionMutationEnvelope:', '  rules: []', 'teamHardEnvelope:', '  rules: []',
    'requirements:', '  - domain: persona', '    name: standard', 'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')
}

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
  return { toolCount: toolNames === null ? 0 : toolNames.length, toolNames, assistantToolNames, toolResults, markerHits: [], _text: text }
}

// ═══════════════════════════════════ MAIN ═══════════════════════════════════
const MK = `A5C1FIXB_${RUN_STAMP.replace(/[^A-Za-z0-9]/g, '')}`
// the member's ladder prompt, hoisted: the blueprint persona AND the mock's
// scripted team_delegate call carry the identical text (the leader's system
// prompt always contains the TASK_A marker — the mock disambiguates leader vs
// member by the L0 marker, the r5 law).
const TASK_A_TEXT = `${MK}_INSTALLED_TASK_A Work EXACTLY in this order, one tool call per turn: (1) tool team_bash with {"command":"true"}; (2) tool team_bash with {"command":"i=0; while [ $i -lt 90 ]; do echo tick-$i >> a5c1fixb-seed.log; sleep 1; i=$((i+1)); done"}; (3) tool team_bash with {"command":"kill -9 $$"}; then (4) finish with ONE line starting A5C1FIXB_MEMBER_RESULT quoting each of the three tool results you received. If your work was interrupted and you are asked to continue, resume at the first call you have not completed; never repeat a completed call.`
const cancelState = {
  armedAt: 0, firedAt: 0, fireCount: 0, nudgedAt: 0, httpStatus: 0, httpBody: null, nudgeStatus: 0,
  mitArmedAt: 0, mitFiredAt: 0, mitNudgedAt: 0, mitHttp: 0,
}
const memberRef = { resolved: null }
const settleWatch = { legs: {}, probeAborts: [], probeEnters: [], startedAt: 0 }

async function main () {
  // ── preflight ──
  const gitStatus = spawnSync('git', ['-C', TESTUSE, 'status', '--porcelain'], { encoding: 'utf8' }).stdout.trim()
  const hostHead = spawnSync('git', ['-C', TESTUSE, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim()
  check('H1', `test-use host @639ed01539 porcelain clean before`, gitStatus === '' && hostHead.startsWith('639ed01539'), `head=${hostHead.slice(0, 10)} porcelain=${String(gitStatus === '')}`)
  const remote = spawnSync('git', ['-C', REPO, 'ls-remote', 'origin', 'refs/heads/a5-abort-cause'], { encoding: 'utf8', timeout: 180_000 }).stdout.trim().split(/\s/)[0] ?? ''
  if (remote === INSTALL_PIN) { check('H1b', `live a5-abort-cause ls-remote == the pinned fix SHA ${INSTALL_PIN.slice(0, 12)} (the fix under reverification)`, true, `ls-remote=${remote}`) }
  else { note('H1b', `master drift observed (informational): live ls-remote=${remote} != pinned ${INSTALL_PIN.slice(0, 12)} — measurement face UNCHANGED because the install spec pins the exact commit; verify red-bytes at the new tip out-of-band (measured 2026-10-18: install.ts diff empty, plane-effect-backends md5 identical)`) }
  const mockCandidates = [3495, 3496, 3497, 3498, 3499]
  let mockPort = 0
  for (const p of mockCandidates) if (await portFree(p)) { mockPort = p; break }
  check('H2', `port ${HOST_PORT} self-proved free + a mock port free`, (await portFree(HOST_PORT)) && mockPort > 0, `mock=${String(mockPort)}`)
  const stableBefore = await stableProbe()
  check('H0', 'stable :3080 answers read-only before the run (probe only, never touched)', stableBefore !== 'unreachable', `status=${String(stableBefore)}`)

  const worldFacts = { runStamp: RUN_STAMP, installSpec: INSTALL_SPEC, hostBin: HOST_BIN, clientCommitHash: CLIENT_COMMIT_HASH, ports: { host: HOST_PORT, mock: mockPort } }

  // ── install + launcher ──
  const INSTALL_HOME = homeDir(`${WORLD_PREFIX}-install-${RUN_STAMP}`)
  mkdirSync(join(INSTALL_HOME, 'workspace'), { recursive: true })
  const install = realInstall(INSTALL_HOME)
  check('I1', 'REAL install of the pinned face (public plugin face, bounded retry per r5 TLS-flake precedent)', install.exit === 0, `exit=${String(install.exit)} tail=${install.tail.slice(0, 200)}`)
  if (install.exit !== 0) { teardown(null, worldFacts); writeEvidence('leg-ledger.jsonl', LEDGER.map((r) => JSON.stringify(r)).join('\n')); process.exit(1) }
  const HOME = homeDir(`${WORLD_PREFIX}-${RUN_STAMP}`)
  let seedPromise = null
  // r5 law: the BOOT world must itself carry the real install — a bare home
  // lets the host resolve a stale cached plugin (0.1.1-alpha.2 with the old
  // 0.1.7-rc.1 peer) and version-pin-disable the row at boot (run
  // 2026-10-18T21-06-16Z — the row never mounted, probe health never came up).
  mkdirSync(join(HOME, 'workspace'), { recursive: true })
  const mainInstall = realInstall(HOME)
  check('I1b', 'the BOOT world carries the REAL installed face (install into the boot home before layer+boot)', mainInstall.exit === 0 && Object.keys(mainInstall.manifest?.dependencies ?? {}).length === 1 && mainInstall.manifest?.dependencies?.['dsh-agent-team'] === INSTALL_SPEC, `exit=${String(mainInstall.exit)} deps=${JSON.stringify(Object.keys(mainInstall.manifest?.dependencies ?? {}))}`)
  if (mainInstall.exit !== 0) die('boot-world install failed (see install.log) — booting without it re-triggers the stale-plugin version-pin disable')
  const governedRoot = join(HOME, 'workspace', 'governed')
  mkdirSync(governedRoot, { recursive: true })
  mkdirSync(join(HOME, 'workspace', 'outside'), { recursive: true })
  writeFileSync(join(governedRoot, 'notes.txt'), 'c1sw seed\n')
  const launcher = materializeLauncher(join(HOME, 'deployment', 'landlock-prelauncher.py'))
  const abi = abiPreflight(launcher.path)
  check('I9', 'launcher blob materialized (git-show bytes) + --abi-probe measures a real landlock ABI', abi.abiVersion !== null && abi.abiVersion >= 3, `sha=${launcher.sha.slice(0, 16)} abi=${String(abi.abiVersion)}`)
  worldFacts.launcher = launcher; worldFacts.abi = abi

  // ── profile layer: installed row + probe row + preset (public seams) ──
  const BLUEPRINT_DIR = join(HOME, 'blueprints')
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  const cfg = {
    rootSessionId: ROOT, bootPhase: 'create', blueprintSource: ANCHOR_YAML, blueprintDir: BLUEPRINT_DIR,
    rootPresetId: PRESET_ID, memberPresetId: PRESET_ID, seedMembers: [], generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'c1sw-model' },
    deniedSelection: null, mcpServers: [], mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
      { domain: 'persona', subject: 'standard', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    teamToolPlane: {
      realmId: 'c1sw-realm',
      fsInstance: { fs: 'c1sw-ctl', rootDir: governedRoot, realmId: 'c1sw-realm', kind: 'absolute-path' },
      confinedProvider: {
        trustRoot: `sha256:${launcher.sha.slice(0, 16)}#${launcher.path}`,
        assembly: { launcherPath: launcher.path, launcherSha256: launcher.sha, minAbiVersion: 3 },
      },
    },
  }
  const lines = [
    `# c1sw-diag layer (${RUN_STAMP}): installed row override + PROBE insert + preset — public profile-patch seam only.`,
    '- id: dsh-agent-team', '  name: dsh-agent-team/host', '  config:',
    ...Object.entries(cfg).flatMap(([k, v]) => yamlEmit(k, v, 2)),
    ...['- insert:', ...yamlEmitItem({ id: 'c1sw-probe', name: PROBE_ROW_URL, config: {} }, 1)],
    ...['- insert:', ...yamlEmitItem({
      id: 'preset-c1sw-base', name: '@deepseek-ai/dsh-agent-preset',
      config: {
        id: PRESET_ID, name: 'c1sw base', description: 'c1sw-diag base preset (smoke shape)', order: 900,
        plugins: [
          { id: 'persona', name: '@deepseek-ai/dsh-persona', config: { prefix: 'You are a coding agent powered by the {{model}} model.', suffix: 'Your working directory is {{cwd}}.' } },
          { id: 'tool-fs', name: '@deepseek-ai/dsh-tool-fs' },
          { id: 'persistent-shell', name: 'cordis:group', group: true, isolate: { terminals: true }, config: [
            { id: 'pty', name: '@deepseek-ai/dsh-terminal' },
            { id: 'terminal-bash', name: '@deepseek-ai/dsh-terminal-bash', config: { timeoutMs: 300000 } },
            { id: 'persistent-bash', name: '@deepseek-ai/dsh-tool-bash-persistent', config: { timeoutMs: 300000 } },
          ] },
        ],
      },
    }, 1)],
    '',
  ].join('\n')
  mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
  writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), lines)
  writeFileSync(join(EVIDENCE_DIR, 'profile-layer.yml'), redact(lines))

  // ── mock model ──
  let mock = null
  let mockRequests = []
  let origin = ''
  let cookie = ''
  const rnd = () => Math.random().toString(36).slice(2, 8)
  const toolCall = (id, name, a) => ({ kind: 'tool-call', toolCalls: [{ id, name, arguments: a }] })
  const fireCancel = async (tag, sessionId) => {
    cancelState[`${tag}FireCount`] = (cancelState[`${tag}FireCount`] ?? 0) + 1
    cancelState[`${tag}FiredAt`] = Date.now()
    try {
      const cr = await fetchJson(`${origin}/api/session/cancel`, {
        method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
        body: JSON.stringify({ type: 'client-request', rpcId: `c1sw-${tag}-${String(Date.now())}`, method: 'session/cancel', payload: { args: { request: { sessionId } } } }),
      }, 30_000)
      cancelState[`${tag}HttpStatus`] = cr.status
      cancelState[`${tag}HttpBody`] = redact(JSON.stringify(cr.body ?? null)).slice(0, 300)
    } catch (e) { cancelState[`${tag}HttpError`] = String(e?.message ?? e).slice(0, 200) }
    if (tag === '') {
      // the r5 shape: RESUME nudge 5s after the cancel, inside the fire path
      // (the member loop ENDED with the abort — nobody else wakes it).
      await sleep(5_000)
      const nudgeStatuses = []
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          const nu = await fetchJson(`${origin}/api/session/prompt`, {
            method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
            body: JSON.stringify({ type: 'client-request', rpcId: `c1sw-resume-${String(Date.now())}`, method: 'session/prompt', payload: { args: { request: { requestId: `c1sw-resume-${String(Date.now())}-r`, sessionId, mode: 'queue', content: [{ type: 'text', text: `${MK}_INSTALLED_RESUME Continue your delegated work EXACTLY where it stopped: run the first tool call you have not completed yet. Do not repeat completed calls. Reply OK only if you will continue silently.` }] } } } }),
          }, 60_000)
          nudgeStatuses.push(nu.status)
          if (nu.status === 200) break
        } catch (e) { nudgeStatuses.push(0); cancelState.nudgeError = String(e?.message ?? e).slice(0, 200) }
        await sleep(3_000)
      }
      cancelState.nudgeStatuses = nudgeStatuses
      cancelState.nudgeStatus = nudgeStatuses.includes(200) ? 200 : (nudgeStatuses[nudgeStatuses.length - 1] ?? 0)
      cancelState.nudgedAt = Date.now()
    }
  }
  const mockDecide = ({ req }) => {
    const digest = digestRequest(req)
    const rec = mock?.requests?.[mock.requests.length - 1]
    if (rec !== undefined) rec.digest = digest
    const text = digest._text
    const MU = 'INSTALLED'
    if (text.includes(`${MK}_${MU}_DISC`)) return { kind: 'text', content: 'A5C1FIXB_DISC_OK' }
    if (text.includes('team_delegate') && text.includes('C1SW_COLLECT_PROBE')) return { kind: 'text', content: 'A5C1FIXB_LEADER_DONE' }
    if (text.includes(`${MK}_${MU}_L0`)) {
      // the LEADER lane (the r5 shape): its persona always carries the TASK_A
      // marker, so L0 gates it and it must be tested BEFORE the ladder.
      const calls = digest.assistantToolNames
      if (calls.includes('team_collect')) return { kind: 'text', content: 'A5C1FIXB_LEADER_DONE' }
      if (calls.includes('team_delegate')) return toolCall(`call-c1sw-collect-${rnd()}`, 'team_collect', { rootSessionId: CREATE_ROOT, requestToken: `c1sw-collect-${RUN_STAMP}`, requestTokens: [TK_A1] })
      return toolCall(`call-c1sw-delegate-${rnd()}`, 'team_delegate', {
        rootSessionId: CREATE_ROOT, requestToken: TK_A1, delegationTemplateId: 'wa', label: 'sw-a',
        taskSummary: 'c1sw cancel legs (member A)', prompt: TASK_A_TEXT, async: false,
      })
    }
    if (text.includes(`${MK}_MITRESUME`)) return { kind: 'text', content: 'A5C1FIX_MITRESUME_OK' }
    if (text.includes(`${MK}_MIT`)) {
      if (!text.includes(MIT_MARKER)) {
        if (cancelState.mitArmedAt === 0) {
          cancelState.mitArmedAt = Date.now() + 3_000
          setTimeout(() => { void fireCancel('mit', memberRef.resolved ?? '') }, 3_000)
        }
        return toolCall(`call-c1sw-mit-${rnd()}`, MIT_STEP[0], MIT_STEP[1])
      }
      return { kind: 'text', content: 'A5C1FIXB_MIT_DONE' }
    }
    if (text.includes(`${MK}_${MU}_TASK_A`) || text.includes(`${MK}_${MU}_RESUME`)) {
      const idx = STEPS.findIndex((s) => !text.includes(stepMarker(s)))
      if (idx === -1) {
        const results = digest.toolResults
        return { kind: 'text', content: `A5C1FIXB_MEMBER_RESULT ${results.map((r, i) => `r${i}=${r.slice(0, 220).replace(/\s+/g, ' ')}`).join(' | ')}` }
      }
      const [name, a] = STEPS[idx]
      if (idx === 1 && cancelState.armedAt === 0) {
        cancelState.armedAt = Date.now() + 4_000
        cancelState.armedNote = 'armed when the sleep-90 tool_call was scripted (fires 4s in)'
        setTimeout(() => { void fireCancel('', memberRef.resolved ?? ''); seedPromise = startSeedWatch(HOME) }, 4_000)
      }
      return toolCall(`call-c1sw-${String(idx)}-${rnd()}`, name, a)
    }
    return { kind: 'text', content: 'c1sw-mock: unscripted, completing quietly.' }
  }
  mock = await startMockModel({ port: mockPort, log: () => {}, decide: mockDecide })
  mockRequests = mock.requests ?? []

  // ── boot ──
  const INSTANCE_RAW = join(EVIDENCE_DIR, 'instance.raw.log')
  const INSTANCE_LOG = join(EVIDENCE_DIR, 'instance.log')
  const outFd = openSync(INSTANCE_RAW, 'a')
  const host = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(HOST_PORT), '--no-open'], {
    cwd: join(HOME, 'workspace'), stdio: ['ignore', outFd, outFd],
    env: { ...process.env, DSH_HOME: HOME, DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH, DEEPSEEK_BASE_URL: `http://127.0.0.1:${mockPort}`, DEEPSEEK_API_KEY: 'c1sw-mock-key' },
  })
  let hostExit = null
  CURRENT_HOST = host
  host.on('exit', (code, signal) => { hostExit = { code, signal } })
  try {
    const boot = await waitFor(180_000, () => {
      try { const m = BOOT_MARKER.exec(readFileSync(INSTANCE_RAW, 'utf8')); return m === null ? false : m } catch { return false }
    }, 'boot marker')
    origin = `http://127.0.0.1:${boot[1]}`
    const auth = await fetch(`${origin}/?token=${boot[2]}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
    cookie = auth.headers.get('set-cookie') ?? ''
    if (auth.status !== 303) die(`token gate answered ${String(auth.status)}`)
    await waitFor(60_000, async () => { const h = await fetchJson(`${origin}/__c1sw/health`).catch(() => null); return h?.status === 200 && h.body?.applied === true ? h : false }, 'probe row applied')

    // bootstrap watch (FAILURE-ONLY): `bootstrap FAILED` is terminal-by-law
    // (no auto-retry). Success has no boot-time marker — census-boot and
    // capability-OK print at TEAM ASSEMBLY (team.create), not at boot (the
    // first distribution run caught a success-marker gate deadlocking).
    // r5 shape: the prompt barrier absorbs boot latency.
    await sleep(8_000)
    {
      let t = ''
      try { t = readFileSync(INSTANCE_RAW, 'utf8') } catch { /* empty */ }
      if (t.includes('bootstrap FAILED')) die(`plugin bootstrap FAILED at boot - log tail: ${redact(t.split('\n').slice(-6).join(' | ')).slice(0, 300)}`)
    }

    // settle watcher from t0 — TRUE first-seen times (r5 measured only after its 5s nudge)
    settleWatch.startedAt = Date.now()
    const watcher = setInterval(() => {
      let text = ''
      try { text = readFileSync(INSTANCE_RAW, 'utf8') } catch { return }
      for (const m of text.matchAll(/confined-shell ran [^\n]*call=(\S+)[^\n]*/g)) {
        const call = m[1]
        if (settleWatch.legs[call] === undefined) settleWatch.legs[call] = { firstSeenAt: Date.now(), line: m[0].slice(0, 240) }
      }
      for (const m of text.matchAll(/\[c1sw-probe\] ABORT call=(\S+) [^\n]*/g)) {
        if (!settleWatch.probeAborts.some((x) => x.call === m[1])) settleWatch.probeAborts.push({ call: m[1], firstSeenAt: Date.now(), line: m[0].slice(0, 300) })
      }
      for (const m of text.matchAll(/\[c1sw-probe\] enter call=(\S+) [^\n]*/g)) {
        if (!settleWatch.probeEnters.some((x) => x.call === m[1])) settleWatch.probeEnters.push({ call: m[1], firstSeenAt: Date.now(), line: m[0].slice(0, 240) })
      }
    }, 100)

    // member resolver (public session/list, from t0)
    void (async () => {
      memberRef.resolved = await waitFor(600_000, async () => {
        const sl = await fetchJson(`${origin}/api/session/list`, {
          method: 'POST', headers: { 'content-type': 'application/json', cookie },
          body: JSON.stringify({ type: 'client-request', rpcId: 'c1sw-children', method: 'session/list', payload: { args: { _request: {} } } }),
        }, 15_000).catch(() => null)
        const items = sl?.body?.result?.value?.items ?? []
        const child = items.map((i) => String(i.sessionId ?? '')).filter((s) => s.startsWith('session-team-child'))
        return child.length > 0 ? child[0] : false
      }, 'member child session').catch(() => null)
    })()

    // ── discovery barrier (denyList shape, the r5 law) ──
    // r5 law: the boot root is the PLUGIN's bootstrap's to create — an RPC
    // session/create on ROOT races it (measured run 2026-10-18T21-13-57Z:
    // boot create threw SessionAlreadyExistsError, stack column :42 = the
    // no-signal createAgent branch). The barrier PROMPTS only, with retries,
    // until the root agent is live and the mock answers.
    const promptBarrier = async (sessionId, text, hitTest, tag) => {
      for (let attempt = 1; attempt <= 40; attempt += 1) {
        const hit = mockRequests.find(hitTest)
        if (hit !== undefined) return { attempts: attempt, hit }
        await fetchJson(`${origin}/api/session/prompt`, {
          method: 'POST', headers: { 'content-type': 'application/json', cookie },
          body: JSON.stringify({ type: 'client-request', rpcId: `${tag}-${String(attempt)}`, method: 'session/prompt', payload: { args: { request: { requestId: `${tag}-${String(attempt)}-r`, sessionId, mode: 'queue', content: [{ type: 'text', text }] } } } }),
        }, 30_000).catch(() => null)
        await sleep(1_500)
      }
      die(`prompt barrier ${tag} never landed (root/member agent not live or mock never answered)`)
      return { attempts: 40, hit: undefined }
    }
    const disc = await promptBarrier(ROOT, `${MK}_INSTALLED_DISC setup turn, no tools, reply OK`, (r) => r.digest?._text?.includes(`${MK}_INSTALLED_DISC`) && JSON.stringify(r.reply ?? '').includes('A5C1FIXB_DISC_OK'), 'c1sw-disc')
    worldFacts.rootDisc = { attempts: disc.attempts }
    const discHit = disc.hit
    const surface = [...new Set(discHit.digest.toolNames ?? [])]
    const denyList = surface.filter((n) => !n.startsWith('team_') && !['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh', 'todo_write'].includes(n))
    worldFacts.discoverySurface = surface
    writeFileSync(join(BLUEPRINT_DIR, 'main.yaml'), mainBlueprintYaml(denyList, `${MK}_INSTALLED_TASK_A`))

    await fetchJson(`${origin}/team-remote/catalog.list`, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ type: 'client-request', rpcId: 'c1sw-cl', method: 'catalog.list', payload: { version: 4, params: {} } }) }, 30_000)
    const created = await fetchJson(`${origin}/team-remote/team.create`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ type: 'client-request', rpcId: 'c1sw-tc', method: 'team.create', payload: { version: 1, params: { rootSessionId: CREATE_ROOT, blueprintId: BP_MAIN_ID, initialWork: { prompt: `${MK}_INSTALLED_L0 Begin your directive.` } } } }),
    }, 90_000)
    worldFacts.teamCreate = { status: created.status, body: redact(JSON.stringify(created.body ?? '')).slice(0, 600) }

    // ── chain wait: MEMBER final quote (leader DONE alone never closes, r5 law).
    // The RESUME nudge rides INSIDE fireCancel (the r5 shape), so the ladder
    // completes on its own once the cancel+nudge pair has run. ──
    // batch-3: the close fact is the FOLLOW-UP member request whose history
    // already carries the cancelled leg's result (the old reply-based predicate
    // matched a non-member turn and closed the wait early in run 21-34-31Z).
    // Die-free: the measurement must always be captured, even on timeout.
    const memberQuoteSeen = () => mockRequests.some((r) => r.digest?._text?.includes(`${MK}_INSTALLED_TASK_A`)
      && !r.digest?._text?.includes(`${MK}_INSTALLED_L0`)
      && JSON.stringify(r.digest?.toolResults ?? []).includes('tool call aborted'))
    const quoteT0 = Date.now()
    let quoteWait = 'timeout-continued'
    while (Date.now() - quoteT0 < 240_000) { if (memberQuoteSeen()) { quoteWait = 'ok'; break } await sleep(1_000) }
    worldFacts.quoteWait = quoteWait

    // ── main measurements ──
    const memberReqs = mockRequests.filter((r) => r.digest?._text?.includes(`${MK}_INSTALLED_TASK_A`) && !r.digest?._text?.includes(`${MK}_INSTALLED_L0`))
    writeEvidence('mock-member-requests.json', memberReqs.map((r) => ({ digest: r.digest, reply: r.reply })))
    const lastA = [...memberReqs].reverse().find((r) => JSON.stringify(r.digest?.toolResults ?? []).includes('tool call aborted')) ?? memberReqs[memberReqs.length - 1]
    worldFacts.memberSession = memberRef.resolved
    worldFacts.memberAToolResults = lastA?.digest?.toolResults ?? []
    worldFacts.memberAToolCallOrder = lastA?.digest?.assistantToolNames ?? []
    const cancelNorm = { ...cancelState, firedAt: cancelState.FiredAt ?? 0, fireCount: cancelState.FireCount ?? 0, httpStatus: cancelState.HttpStatus ?? 0, httpBody: cancelState.HttpBody ?? null }
    worldFacts.cancel = cancelNorm
    writeEvidence('cancel-leg.json', { ...cancelNorm, memberSession: memberRef.resolved, settleWatch })

    // scratch forensics (before sweep): exit.json {pid, rc} + mtimes
    const collectForensics = async (firedAtKey) => {
    const forensics = []
    const walk = (dir, depth = 0) => {
      if (depth > 6 || !existsSync(dir)) return
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name)
        if (e.isDirectory()) walk(p, depth + 1)
        else if (e.name === 'exit.json') {
          try {
            const st = statSync(p)
            forensics.push({ path: p.slice(HOME.length), mtimeMs: st.mtimeMs, size: st.size, content: readFileSync(p, 'utf8').slice(0, 400), deltaVsFiredMs: (cancelState[firedAtKey] ?? 0) > 0 ? st.mtimeMs - (cancelState[firedAtKey] ?? 0) : null })
          } catch { /* noop */ }
        }
      }
    }
    await walk(governedRoot)
    return forensics
    }
    const forensics = await collectForensics('FiredAt')
    writeEvidence('scratch-forensics.json', forensics)
    spawnSync('tar', ['czf', join(EVIDENCE_DIR, 'scratch-capture.tgz'), '-C', HOME, 'workspace/governed'])

    // ── GREEN control: lane-direct execute on the registered definition ──
    const direct = await fetchJson(`${origin}/__c1sw/direct`, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ command: 'sleep 12', kind: 'user', delayMs: 400 }) }, 90_000)
    worldFacts.directControl = direct.body ?? null
    writeEvidence('direct-control.json', direct.body ?? null)

    // ── MIT phase: post-execute accept-replacement demo (AFTER the red is graded) ──
    await fetchJson(`${origin}/__c1sw/mitigate`, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ on: true }) }, 15_000)
    const mitReqBase = mockRequests.length
    const mitStatuses = []
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      try {
        const mp = await fetchJson(`${origin}/api/session/prompt`, {
          method: 'POST', headers: { 'content-type': 'application/json', cookie },
          body: JSON.stringify({ type: 'client-request', rpcId: `c1sw-mit-${String(attempt)}`, method: 'session/prompt', payload: { args: { request: { requestId: `c1sw-mit-r${String(attempt)}`, sessionId: memberRef.resolved, mode: 'queue', content: [{ type: 'text', text: `${MK}_MIT Call tool team_bash with {"command":"sleep 20"} exactly once now; then wait for its result and reply A5C1FIXB_MIT_DONE.` }] } } } }),
        }, 60_000)
        mitStatuses.push(mp.status)
        if (mp.status === 200) break
      } catch { mitStatuses.push(0) }
      await sleep(5_000)
    }
    worldFacts.mitPromptStatuses = mitStatuses
    // batch-3 timing law (measured run 21-40-43Z): a queued member turn starts
    // ~35s after the previous settle — the MIT turn rides behind kill-9 + quote
    // turns, so the window must cover ~3 turn latencies + the 20s leg.
    const mitDoneSeen = () => mockRequests.slice(mitReqBase).some((r) => JSON.stringify(r.reply ?? '').includes('A5C1FIXB_MIT_DONE'))
    const mitT0 = Date.now()
    let mitWait = 'timeout-continued'
    while (Date.now() - mitT0 < 240_000) { if (mitDoneSeen()) { mitWait = 'ok'; break } await sleep(1_500) }
    worldFacts.mitWait = mitWait
    if (cancelState.mitFiredAt !== 0 && cancelState.mitNudgedAt === 0) {
      await fetchJson(`${origin}/api/session/prompt`, {
        method: 'POST', headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ type: 'client-request', rpcId: 'c1sw-mitres', method: 'session/prompt', payload: { args: { request: { requestId: 'c1sw-mitres-r', sessionId: memberRef.resolved, mode: 'queue', content: [{ type: 'text', text: `${MK}_MITRESUME Quote the team_bash result you received, then reply A5C1FIXB_MIT_DONE.` }] } } } }),
      }, 60_000).catch(() => null)
      cancelState.mitNudgedAt = Date.now()
      const mitResT0 = Date.now()
      let mitResWait = 'timeout-continued'
      while (Date.now() - mitResT0 < 150_000) { if (mitDoneSeen()) { mitResWait = 'ok'; break } await sleep(1_500) }
      worldFacts.mitResWait = mitResWait
    }
    const mitReqs = mockRequests.slice(mitReqBase).filter((r) => r.digest?._text?.includes(MIT_MARKER) && (r.digest?.toolResults?.length ?? 0) > 0)
    worldFacts.mit = { cancel: { armedAt: cancelState.mitArmedAt, firedAt: cancelState.mitFiredAt, http: cancelState.mitHttpStatus, body: cancelState.mitHttpBody, nudgedAt: cancelState.mitNudgedAt }, lastToolResults: mitReqs[mitReqs.length - 1]?.digest?.toolResults ?? [] }
    await fetchJson(`${origin}/__c1sw/mitigate`, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ on: false }) }, 15_000)

    // probe facts + watcher
    worldFacts.probe = (await fetchJson(`${origin}/__c1sw/facts`, undefined, 15_000).catch(() => null))?.body ?? null
    worldFacts.settleWatch = settleWatch
    try { worldFacts.seedWatch = await seedPromise } catch { /* passive */ }
    clearInterval(watcher)
    // batch-3: second forensics pass — the MIT leg's exit.json lands only now.
    try {
      writeEvidence('scratch-forensics-mit.json', await collectForensics('mitFiredAt'))
      spawnSync('tar', ['czf', join(EVIDENCE_DIR, 'scratch-capture2.tgz'), '-C', HOME, 'workspace/governed'])
    } catch { /* passive */ }
    teardown(host, worldFacts, hostExit)
  } catch (e) {
    writeEvidence('kit-error.json', { error: String(e?.stack ?? e).slice(0, 2000), cancelState, settleWatch })
    teardown(host, worldFacts, hostExit)
    process.exit(1)
  }
}

const SEED_NAME = 'a5c1fixb-seed.log'
function walkFiles (dir, depth, out) {
  if (depth < 0) return
  let ents = []
  try { ents = readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const e of ents) {
    if (e.isDirectory()) walkFiles(join(dir, e.name), depth - 1, out)
    else out.push(join(dir, e.name))
  }
}
async function startSeedWatch (homeRoot) {
  // OUT-OF-BAND witness for cond-3, v3 (attribution law). All legs of a member
  // instance share ONE realm write-domain, so path-scoping alone cannot
  // attribute a post-cancel write to the CANCELLED payload. Attribution laws:
  //   (a) seedFrozen — the payload's designated channel (seed.log) must not be
  //       written later than FiredAt+2s;
  //   (b) preExistingUntouched — every file present at watch start (i.e. the
  //       cancelled leg's own artifacts among others) must never gain an mtime
  //       later than FiredAt+2s, except launcher exit.json (supervisor book);
  //   (c) gapClean — a NEW file counts as cancelled-payload continuation only
  //       if it appears before the next leg's dispatch boundary (first new
  //       probe-*/plan- dir); nothing may appear in (FiredAt+2s, boundary).
  const firedAtRef = Date.now()
  let seedPath = null
  for (let i = 0; i < 12 && seedPath === null; i += 1) {
    const files = []
    walkFiles(join(homeRoot, 'workspace'), 8, files)
    seedPath = files.find((f) => f.endsWith(SEED_NAME)) ?? null
    if (!seedPath) await sleep(250)
  }
  if (seedPath === null) return { seedFound: false }
  const preMax = new Map()
  const post = new Map()
  let sampleCount = 0
  let seedMtime = null
  let seedSize = null
  let base = null
  while (Date.now() - firedAtRef < 25_000) {
    const files = []
    walkFiles(join(homeRoot, 'workspace'), 8, files)
    let st = null
    try { st = statSync(seedPath) } catch { /* gone */ }
    if (st) { seedSize = st.size; seedMtime = Math.max(seedMtime ?? 0, st.mtimeMs) }
    for (const f of files) {
      if (f.endsWith('exit.json')) continue
      let m = null
      try { m = statSync(f) } catch { continue }
      if (base === null) { preMax.set(f, m.mtimeMs); continue }
      if (!base.has(f)) post.set(f, Math.max(post.get(f) ?? 0, Math.max(m.mtimeMs, Date.now())))
      else preMax.set(f, Math.max(preMax.get(f) ?? 0, m.mtimeMs))
    }
    if (base === null) base = new Set(files)
    sampleCount += 1
    await sleep(300)
  }
  const relOf = (f) => f.slice(homeRoot.length)
  const boundaryRel = [...post.keys()].map(relOf).filter((r) => /(\/|^)probe-|\/plans\/plan-/.test(r))
  const boundaryDelta = boundaryRel.length === 0 ? 25_000 : 25_000 // conservative: no boundary seen -> full window counts against us
  let violationNew = 0
  for (const f of post.keys()) {
    const r = relOf(f)
    const isBoundaryKind = /(\/|^)probe-|\/plans\/plan-/.test(r)
    if (isBoundaryKind) continue
    violationNew += 1
  }
  const preViolators = []
  for (const [f, mt] of preMax) if (mt - firedAtRef > 2000) preViolators.push(`${relOf(f)}@${Math.round(mt - firedAtRef)}ms`)
  return {
    seedFound: true,
    sampleCount,
    seedSize,
    seedMtimeDeltaMs: seedMtime === null ? null : Math.round(seedMtime - firedAtRef),
    preExistingCount: preMax.size,
    preViolators: preViolators.slice(0, 10),
    newNonBoundary: [...post.keys()].map(relOf).filter((r) => !/(\/|^)probe-|\/plans\/plan-/.test(r)).slice(0, 10),
    boundarySeen: boundaryRel.length,
    _boundaryDelta: boundaryDelta, _viol: violationNew,
  }
}

function killTree (pid) {
  // sweep-kill follow-through (red5 precedent: the member/provider children
  // must die with the world, not run on after teardown).
  const victims = new Set([pid])
  for (let pass = 0; pass < 4; pass += 1) {
    let added = false
    try {
      for (const d of readdirSync('/proc')) {
        if (!/^\d+$/.test(d)) continue
        const p = Number(d)
        if (victims.has(p)) continue
        try {
          const stat = readFileSync(`/proc/${d}/stat`, 'utf8')
          const ppid = Number(/^[^(]*\([^)]*\)\s+\S\s+(\d+)/.exec(stat)?.[1] ?? -1)
          if (victims.has(ppid)) { victims.add(p); added = true }
        } catch { /* raced */ }
      }
    } catch { /* noop */ }
    if (!added) break
  }
  for (const p of victims) { try { process.kill(p, 'SIGKILL') } catch { /* gone */ } }
  return victims.size
}

function teardown (host, worldFacts, hostExit) {
  if (host !== null && host?.exitCode === null && !KEEP) { try { killTree(host.pid) } catch { /* gone */ } ; try { host.kill('SIGKILL') } catch { /* gone */ } }
  try {
    const raw = readFileSync(join(EVIDENCE_DIR, 'instance.raw.log'), 'utf8')
    writeFileSync(join(EVIDENCE_DIR, 'instance.log'), redact(raw))
    rmSync(join(EVIDENCE_DIR, 'instance.raw.log'))
  } catch { /* noop */ }
  if (!KEEP) {
    for (const d of readdirSync(HOME_ROOT).filter((x) => x.startsWith(`${WORLD_PREFIX}-`))) rmSync(join(HOME_ROOT, d), { recursive: true, force: true })
  }
  writeEvidence('world.json', { ...(worldFacts ?? {}), hostExit: hostExit ?? null, keep: KEEP })
  writeEvidence('leg-ledger.jsonl', LEDGER.map((r) => JSON.stringify(r)).join('\n'))
  void hostExit
}

main().then(() => {
  const a = (LEDGER.length && true)
  const w = (() => { try { return JSON.parse(readFileSync(join(EVIDENCE_DIR, 'world.json'), 'utf8')) } catch { return {} } })()
  const wire = JSON.stringify(w?.memberAToolResults ?? [])
  const direct = String(w?.directControl?.landing ?? '')
  check('R1', 'RED reproduces: the cancelled sleep leg lands the scheduler death form on the model wire (verbatim "Error: tool call aborted")', wire.includes('Error: tool call aborted'), `wire=${wire.slice(0, 160)}`)
  check('R3', 'GREEN control reproduces: the SAME team_bash definition, lane-direct with cause {kind:user}, lands `bash · cancelled` + "cancelled":true', direct.includes('bash · cancelled') && direct.includes('"cancelled":true'), `landing=${direct.slice(0, 200)}`)
  const mitWire = JSON.stringify(w?.mit?.lastToolResults ?? [])
  note('R6', 'MIT phase: post-execute accept-decision (public seam, content-only) on a fresh cancelled leg — does the cancelled form reach the wire after the host replacement?', `mit-wire=${mitWire.slice(0, 200)}`)
  // ── a5c1fix reverify verdicts: four conditions (root 22:16Z) + witness flip ──
  const forensicsAll = (() => { try { return JSON.parse(readFileSync(join(EVIDENCE_DIR, 'scratch-forensics.json'), 'utf8')) } catch { return [] } })()
  const near = forensicsAll.filter((f) => typeof f.deltaVsFiredMs === 'number' && f.deltaVsFiredMs > 0 && f.deltaVsFiredMs < 5000)
  const nearRc = near.map((f) => { try { return JSON.parse(f.content).rc } catch { return null } })
  check('F1', 'cond-1 abort-hit: cancel RPC accepted AND probe saw gen-entry abort kind=user', (w?.cancel?.firedAt ?? 0) > 0 && w?.cancel?.httpStatus === 200 && (w?.probe?.abort ?? []).some((a) => a.gen === 'entry' && a.kind === 'user'), `fired=${String(w?.cancel?.firedAt)} http=${String(w?.cancel?.httpStatus)}`)
  check('F2', 'cond-2 process-terminated: exit.json rc in {-15,-9} within 5s after FiredAt', nearRc.length > 0 && nearRc.every((rc) => rc === -15 || rc === -9), `rc=${JSON.stringify(nearRc)} deltas=${JSON.stringify(near.map((f) => Math.round(f.deltaVsFiredMs)))}`)
  const naturalNear = forensicsAll.filter((f) => { try { return JSON.parse(f.content).rc === 0 } catch { return false } }).filter((f) => typeof f.deltaVsFiredMs === 'number' && f.deltaVsFiredMs > 0 && f.deltaVsFiredMs < 5000)
  check('F3', 'cond-3 no-continuation-side-effect: no natural (rc=0) completion of a cancelled plan near the cancel', naturalNear.length === 0, `naturalNearCancel=${JSON.stringify(naturalNear.map((f) => f.path))}`)
  const lastRes = w?.memberAToolResults ?? []
  check('F4', 'cond-4 model-history-sees-interruption-not-success: final member history carries the death form', lastRes.some((r) => String(r).includes('Error: tool call aborted')), `tail=${JSON.stringify(lastRes).slice(0, 160)}`)
  const sw = w?.seedWatch
  check('F3b', 'cond-3b out-of-band attributed seed watch v3: seed frozen <=+2s AND pre-existing files never touched after +2s AND zero new files other than next-leg boundary kinds (probe-/plan-)', !!sw && sw.seedFound === true && (sw.seedMtimeDeltaMs ?? 9e9) <= 2000 && sw.preViolators.length === 0 && sw.newNonBoundary.length === 0, `seedΔ=${String(sw?.seedMtimeDeltaMs)}ms preViol=${JSON.stringify(sw?.preViolators ?? []).slice(0, 120)} newNonBoundary=${JSON.stringify(sw?.newNonBoundary ?? []).slice(0, 120)} samples=${String(sw?.sampleCount)}`)
  const relayed = (w?.probe?.abort ?? []).filter((a) => a.gen !== 'entry')
  check('F5', 'fix-witness: row-held (gen1) signal now aborts with the RELAYED user cause (kind=user)', relayed.length > 0 && relayed.some((a) => a.kind === 'user'), `gen-aborts=${JSON.stringify(relayed.map((a) => a.json)).slice(0, 200)}`)
  {
    let logt = ''
    try { logt = readFileSync(join(EVIDENCE_DIR, 'instance.log'), 'utf8') } catch { /* noop */ }
    const memberBash2 = logt.split('\n').filter((l) => l.includes('confined-shell ran') && l.includes('bash-2 ') && !l.includes('leader'))
    check('F-W', 'KEY FLIP: member-lane witness prints cancelled=true (pre-fix 5/5 false on 5885e46e)', memberBash2.some((l) => l.includes('cancelled=true')), `witness=${memberBash2.slice(-1)[0]?.slice(0, 200) ?? 'none'}`)
    note('F-N', 'host-law negative assertion stays: the cancelled leg STILL lands the unified death form on the model wire (R1 above must remain PASS)', `r1=${JSON.stringify(LEDGER.find((r) => r.id === 'R1')?.pass)}`)
  }
  const porcelain = spawnSync('git', ['-C', TESTUSE, 'status', '--porcelain'], { encoding: 'utf8' }).stdout.trim()
  void a
  check('T1', 'exact-name home sweep (no c1sw-diag-* world remains unless --keep)', KEEP || readdirSync(HOME_ROOT).filter((x) => x.startsWith(`${WORLD_PREFIX}-`)).length === 0, `left=${String(readdirSync(HOME_ROOT).filter((x) => x.startsWith(`${WORLD_PREFIX}-`)).length)}`)
  check('T2', 'raw instance log deleted after redaction (token hygiene)', !existsSync(join(EVIDENCE_DIR, 'instance.raw.log')) && existsSync(join(EVIDENCE_DIR, 'instance.log')), 'redacted copy kept, raw gone')
  check('H3', `test-use porcelain 0 after`, porcelain === '', `porcelain=${porcelain === '' ? '0' : 'DIRTY'}`)
  void stableProbe().then((s) => { LEDGER.push({ id: 'H3b', claim: 'stable :3080 unchanged (probe only)', pass: null, observed: `after=${String(s)}` }); writeFileSync(join(EVIDENCE_DIR, 'leg-ledger.jsonl'), LEDGER.map((r) => JSON.stringify(r)).join('\n')) })
  writeFileSync(join(EVIDENCE_DIR, 'KIT_EXIT'), String((LEDGER.some((r) => r.pass === false && ['R1', 'R3', 'I1', 'I9', 'H1', 'H1b', 'H2', 'T1', 'T2', 'F1', 'F2', 'F3', 'F4', 'F5', 'F-W'].includes(r.id))) ? 2 : 0))
  console.log(`KIT_DONE evidence=${join(EVIDENCE_DIR, '')}`)
}).catch((e) => { console.error(`KIT_FATAL ${String(e?.stack ?? e).slice(0, 500)}`); try { writeFileSync(join(EVIDENCE_DIR, 'KIT_EXIT'), '1') } catch { /* noop */ } process.exit(1) })
