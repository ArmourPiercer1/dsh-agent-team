#!/usr/bin/env node
/**
 * try-candidate-kit.mjs — candidate-package TRIAL DRIVER (prepared, full chain
 * runs at FINAL assembly together with the final receipt; pre-assembly rounds
 * run only --dry-run and the fastest leg (--legs=probe), per the root 22:39Z
 * order).
 *
 * Derived from evidence/alpha5/release-candidate-r1/rc-trial-kit.mjs (master
 * bytes, 28/0 GREEN at 5885e46e; helpers/ = byte copies of the same law). Same
 * install face, same three-zero law, public seams only, mock ONLY at the LLM
 * position, named teardown (NO glob deletes), :3080 probe-only.
 *
 * THE THREE MINIMAL TRIAL CHAINS (README §试用):
 *   LEG A (pos):     team.create -> Leader team_create_member -> team_list_members
 *                    -> team_delegate(instance, async:false) -> member team_bash
 *                    positive (token + real write under the governed root)
 *                    -> team_collect read-back to the Leader.
 *   LEG B (glob-off): a SECOND world whose row carries teamToolPlane
 *                    .globEnabled:false; team_glob lands the EXISTING typed shut
 *                    face verbatim (a5p5-refused / IO_POLICY_UNSUPPORTED, detail
 *                    sentence read OUT OF THE INSTALLED bytes) and the fixture
 *                    seed names reach NO wire byte (no fallback).
 *   LEG C (bash-b2): in the pos world, the out-of-bounds leg `cat
 *                    ../outside/secret.txt` lands `bash · exit=1` + kernel
 *                    `Permission denied` verbatim + meta exitCode=1, marker off
 *                    the wire, cancelled:false absent a cancel.
 * Plus the fastest leg for pre-assembly smoke:
 *   LEG P (probe):   boot the ALREADY-INSTALLED world from INSTALLED.json on
 *                    the installed face: boot marker + token gate (401/303) +
 *                    host --dump-config composes the team row; then stop.
 *
 * Every world re-installs through the public package face and MUST come out
 * byte-identical to INSTALLED.json rootSha (W legs) — a drifting face fails.
 *
 * KIT_EXIT: 0 GREEN · 2 RED (criteria at full height, landings quoted) · 1 FATAL.
 *
 * @module evidence/alpha5/candidate-package/try-candidate-kit
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
const argValue = (n, d) => { const eq = args.find((x) => x.startsWith(`--${n}=`)); if (eq !== undefined) return eq.slice(n.length + 3); const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1] }
const KEEP = args.includes('--keep')
const DRY = args.includes('--dry-run')
const HERE = dirname(new URL(import.meta.url).pathname)
const REPO = resolve(argValue('repo', resolve(HERE, '..', '..', '..', '..', '..')))
const TESTUSE = resolve(argValue('testuse', join(REPO, 'tests', 'deepseek-harness-test-use')))
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const HOMES_ROOT = resolve(argValue('homes-root', join(REPO, 'tests', 'homes')))
const STORE_DIR = resolve(argValue('store-dir', join(REPO, '.pnpm-store-candidate')))
const STATE = resolve(argValue('state', join(HOMES_ROOT, 'candidate-INSTALLED.json')))
const RUN_STAMP = new Date().toISOString().slice(0, 19).replace(/:/g, '-') + 'Z'
const EVIDENCE_DIR = resolve(argValue('evidence-dir', join(HERE, 'runs', RUN_STAMP)))
const LEGS = (() => {
  let l = (argValue('legs', 'pos,bash-b2,glob-off')).split(',').map((x) => x.trim()).filter((x) => ['probe', 'pos', 'bash-b2', 'glob-off', 'pin-table'].includes(x))
  if (l.includes('bash-b2') && !l.includes('pos')) l = ['pos', ...l] // LEG C is graded from the pos world's second bash step
  const seen = new Set(); l = l.filter((x) => (seen.has(x) ? false : seen.add(x)))
  return l
})()
const CANDIDATE_SHA = (argValue('sha', '') || process.env.CANDIDATE_SHA || '').trim()

const WORLD_PREFIX = 'candidate'
const PRESET_ID = 'cand-base'
const MODEL_ID = 'cand-model'
const TOK_BASH = 'CAND-BASH-TOK'
const WRITE_TOK = 'CAND-WROTE-9'
const OUTSIDE_MARKER = 'CAND-OUTSIDE-ONLY-MARKER-4417'
const GPOS_SEEDS = ['zzcand-alpha.txt', 'zzcand-beta.txt']
const PIN_CLAIMS = [['pincodex', 'subagent_codex'], ['pincc', 'subagent_claude_code'], ['pinfork', 'subagent_fork']]
const PIN_CONTROL = 'zglobcand'
const modeFor = (leg) => leg === 'glob-off' ? 'globoff' : leg
const IO_TEXT = 'IO_POLICY_UNSUPPORTED'
const REFUSAL_PREFIX = 'a5p5-refused'
const MK = `CAND_${RUN_STAMP.replace(/[^A-Za-z0-9]/g, '')}`

// ─── plumbing (identical law to rc-trial-kit) ────────────────────────────────
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
const writeEvidence = (name, value) => { mkdirSync(EVIDENCE_DIR, { recursive: true }); writeFileSync(join(EVIDENCE_DIR, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n') }
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
async function pickFreePort (candidates, taken) {
  for (const p of candidates) {
    if (taken.includes(p)) continue
    if (await portFree(p)) { taken.push(p); return p }
  }
  return 0
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
    else if (e.isFile()) out.push(p.slice(base.length + 1).split('\\').join('/'))
    else out.push(`NOT-A-FILE:${p.slice(base.length + 1)}`)
  }
  return out
}

// ─── declared install face (same law as rc-trial-kit I3) ─────────────────────
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
    expectedCount: expected.length, actualCount: actual.length, declaredCount: face.declared.length,
    packAdditions: face.packAdditions, missing, extra, shaMismatch,
    rootSha: sha256Text(manifest.map((x) => `${x.path} ${x.sha256}`).join('\n')), manifest,
  }
}

// ─── YAML emitter (from rc-trial-kit) ────────────────────────────────────────
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

// ─── blueprints (schema v3; per-world step scripts) ──────────────────────────
function anchorYaml (bpId) {
  return [
    '---', 'schemaVersion: 3', `blueprintId: ${bpId}`, 'revision: "1"',
    'leader:', '  templateId: leader', '  persona: "You are the leader of the candidate trial team."',
    'members:', '  - templateId: wa', '    persona: "You are a worker of the candidate trial team."',
    'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
    'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')
}
function stepsFor (mode) {
  if (mode === 'globoff') return [['team_glob', { pattern: '*.txt', path: './gpos' }]]
  return [
    ['team_bash', { command: `echo ${TOK_BASH}; echo ${WRITE_TOK} > ./cand-wrote.txt; cat ./cand-wrote.txt` }],
    ['team_bash', { command: 'cat ../outside/secret.txt' }],
  ]
}
const stepMarker = ([name, a]) => `tool_use:${name}${JSON.stringify(a)}`
function mainBlueprintYaml (mode, denyList, mkTask, rootIds) {
  const denyBlock = (pad) => denyList.length === 0 ? [`${pad}builtinToolDeny: []`] : [`${pad}builtinToolDeny:`, ...denyList.map((n) => `${pad}  - ${n}`)]
  const steps = stepsFor(mode)
  const enumerated = steps.map(([n, a], i) => `(${String(i + 1)}) tool ${n} with ${JSON.stringify(a)}`).join('; ')
  const task = `${mkTask} Work EXACTLY in this order, one tool call per turn: ${enumerated}; then (final) answer with ONE line starting CAND_MEMBER_RESULT quoting each of the ${String(steps.length)} tool results you received, verbatim.`
  const leaderPersona = `You are the leader of the candidate trial team. On your directive: FIRST call team_create_member exactly once with rootSessionId ${rootIds.createRoot}, requestToken ${rootIds.tkCm}, delegationTemplateId "wa", label "cand-a". SECOND call team_list_members with rootSessionId ${rootIds.createRoot} and requestToken ${rootIds.tkLm}. THIRD call team_delegate exactly once with rootSessionId ${rootIds.createRoot}, requestToken ${rootIds.tkD1}, the delegationInstanceId returned by team_list_members for instance cand-a, async false, and the prompt ${JSON.stringify(task)}. FOURTH call team_collect with rootSessionId ${rootIds.createRoot} and requestTokens ["${rootIds.tkD1}"]. FIFTH finish with one line starting CAND_LEADER_DONE.`
  return [
    '---', 'schemaVersion: 3', `blueprintId: ${rootIds.bpId}`, 'revision: "1"',
    `displayName: "candidate trial team (${mode})"`,
    'description: "candidate-package trial: the ordinary governed Team entry through the REAL installed plugin face, mock only at the LLM position."',
    'leader:', '  templateId: leader', `  persona: ${JSON.stringify(leaderPersona)}`,
    '  capabilities:', '    teamTools:', '      kind: allow', '      items:', '        - team_create_member', '        - team_list_members', '        - team_delegate', '        - team_collect',
    ...denyBlock('    '),
    '    skills:', '      kind: allow', '      items: []',
    '    mcp:', '      kind: allow', '      items: []',
    '    permissions:', '      default: ask', '      allow: []', '      ask: []', '      deny: []',
    'teamEnvelope:', '  allow:', '    - assign-task', '    - create-member', '    - send-message', '    - report-progress', '  deny: []',
    'members:',
    '  - templateId: wa', '    displayName: "candidate worker A"',
    '    persona: "You are worker A of the candidate trial team. Follow delegated work exactly, tool by tool, in order. Never invent a tool result; always wait for the real one."',
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
function rowConfig (mode, rootIds, world, launcher) {
  const cfg = {
    rootSessionId: rootIds.root,
    // fresh trial worlds: 'create'; the probe re-enters the installed world:
    // 'create-or-open' (INSTALL §3.2 — strict 'create' on an existing stamp
    // fails closed with TEAM_DOMAIN_EXISTS)
    bootPhase: mode === 'probe' ? 'create-or-open' : 'create',
    blueprintSource: anchorYaml(rootIds.anchorId),
    blueprintDir: world.blueprintDir,
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
    teamToolPlane: {
      realmId: `cand-${mode}-realm`,
      fsInstance: { fs: `cand-${mode}-ctl`, rootDir: world.governedRoot, realmId: `cand-${mode}-realm`, kind: 'absolute-path' },
      confinedProvider: {
        trustRoot: `sha256:${launcher.sha.slice(0, 16)}#${launcher.path}`,
        assembly: { launcherPath: launcher.path, launcherSha256: launcher.sha, minAbiVersion: 3 },
      },
    },
  }
  if (mode === 'globoff') cfg.teamToolPlane.globEnabled = false
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
        toolResults.push(rep.slice(0, 2400))
        text += '\u0001tool_result:' + rep
      }
    }
  }
  return { msgCount: msgs.length, toolCount: toolNames === null ? 0 : toolNames.length, toolNames, assistantToolNames, toolResults, markerHits: [], _text: text }
}

// ─── the world driver (fresh world: install → layer → boot → ladder) ─────────
let faceRef = null
const worldsSwept = []
async function runWorld ({ mode, state, srcHome, mock, port }) {
  const HOME = join(HOMES_ROOT, `${WORLD_PREFIX}-${mode}-${RUN_STAMP}`)
  const rootIds = {
    root: `cand-${mode}-root`,
    createRoot: `session-cand-${mode}-team-${RUN_STAMP}`,
    bpId: `cand-${mode}-main-bp`,
    anchorId: `cand-${mode}-anchor-bp`,
    tkCm: `cand-${mode}-tok-cm`, tkLm: `cand-${mode}-tok-lm`, tkD1: `cand-${mode}-tok-d1`,
  }
  const world = {
    governedRoot: join(HOME, 'workspace', 'governed'),
    outsideSecret: join(HOME, 'workspace', 'outside', 'secret.txt'),
    bashWrote: join(HOME, 'workspace', 'governed', 'cand-wrote.txt'),
    blueprintDir: join(HOME, 'blueprints'),
    deployment: join(HOME, 'deployment'),
  }
  const facts = { mode, home: HOME, ok: false }
  const steps = stepsFor(mode)
  let host = null
  let hostExit = null
  let reqBase = 0
  try {
    if (existsSync(HOME)) die(`world ${HOME} already exists — trial worlds must be FRESH`)
    mkdirSync(join(HOME, 'workspace', 'governed'), { recursive: true })
    mkdirSync(join(HOME, 'workspace', 'outside'), { recursive: true })
    mkdirSync(world.blueprintDir, { recursive: true })
    writeFileSync(join(world.governedRoot, 'notes.txt'), `line one\n${TOK_BASH} grep line\n`)
    writeFileSync(world.outsideSecret, `${OUTSIDE_MARKER}\n`)
    mkdirSync(join(world.governedRoot, 'gpos'), { recursive: true })
    for (const n of GPOS_SEEDS) writeFileSync(join(world.governedRoot, 'gpos', n), `seed ${n}\n`)

    // W leg: reinstall on THIS world, byte-identical to the recorded face
    const profileDir = join(HOME, 'profiles', 'web')
    mkdirSync(profileDir, { recursive: true })
    writeFileSync(join(profileDir, 'pnpm-workspace.yaml'), `packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\nstoreDir: ${STORE_DIR}\n`)
    const spec = `github:ArmourPiercer1/dsh-agent-team#${state.sha}`
    const t0 = Date.now()
    const install = spawnSync(process.execPath, [HOST_BIN, 'plugin', '--profile', 'web', 'add', spec], {
      cwd: join(HOME, 'workspace'), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 900_000,
      env: { ...process.env, DSH_HOME: HOME },
    })
    writeEvidence(`install-${mode}.log`, redact(`$ node ${HOST_BIN} plugin --profile web add ${spec}\n(DSH_HOME=${HOME})\nexit=${String(install.status)} in ${String(Math.round((Date.now() - t0) / 1000))}s\n${String(install.stdout ?? '')}${String(install.stderr ?? '')}`))
    const installedDir = join(profileDir, 'node_modules', 'dsh-agent-team')
    const m = measureInstalledFace(installedDir, faceRef.face, faceRef.mirror)
    facts.install = { exit: install.status, seconds: Math.round((Date.now() - t0) / 1000), expectedCount: m.expectedCount, actualCount: m.actualCount, missing: m.missing.length, extra: m.extra.length, shaMismatch: m.shaMismatch.length, rootSha: m.rootSha }
    check(`W.${mode}`, `the ${mode} world re-installed the recorded face through the public package face with THREE ZEROS and rootSha == INSTALLED.json rootSha (no drift)`,
      install.status === 0 && m.missing.length === 0 && m.extra.length === 0 && m.shaMismatch.length === 0 && m.rootSha === state.rootSha,
      `exit=${String(install.status)} n=${String(m.actualCount)}/${String(m.expectedCount)} miss=${String(m.missing.length)} extra=${String(m.extra.length)} sha≠=${String(m.shaMismatch.length)} rootSha=${m.rootSha.slice(0, 16)}${m.rootSha === state.rootSha ? '==installed' : '!=installed'}`)

    // launcher deployment input (same commit; from the candidate src clone recorded by the installer)
    const launcherRel = 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py'
    const blob = spawnSync('git', ['-C', srcHome, 'show', `${state.sha}:${launcherRel}`], { maxBuffer: 64 * 1024 * 1024 })
    if (blob.status !== 0) die(`git show of the launcher blob failed in ${srcHome}`)
    const launcherPath = join(world.deployment, 'landlock-prelauncher.py')
    mkdirSync(world.deployment, { recursive: true })
    writeFileSync(launcherPath, blob.stdout)
    const launcher = { path: launcherPath, sha: sha256Text(blob.stdout) }
    facts.launcher = launcher
    const abi = spawnSync('python3', [launcherPath, '--abi-probe'], { encoding: 'utf8', timeout: 30_000 })
    let abiJson = null; try { abiJson = JSON.parse(String(abi.stdout ?? '').trim().split('\n').filter((l) => l !== '').pop() ?? '') } catch { /* keep */ }
    facts.abi = abiJson
    if (mode !== 'probe') check(`W.${mode}.abi`, `the host's Landlock ABI is available (>=3) for the confined shell/glob rows in the ${mode} world`, abiJson?.kind === 'abi-available' && Number(abiJson?.abi_version) >= 3, `abi=${String(abiJson?.kind)}/${String(abiJson?.abi_version)}`)

    // I-SHIP (glob-off worlds): the shut gate lives in the INSTALLED bytes
    let EXPECTED_REFUSAL = ''
    if (mode === 'globoff') {
      const distPlaneRel = 'packages/runtime/dist/packages/runtime/src/plugin/live/team-tool-plane.mjs'
      const distPlane = existsSync(join(installedDir, distPlaneRel)) ? readFileSync(join(installedDir, distPlaneRel), 'utf8') : ''
      const shutDetail = /function createShutBackend[\s\S]*?detail: '([^']+)'/.exec(distPlane)
      EXPECTED_REFUSAL = `${REFUSAL_PREFIX} kind=backend-failed code=${IO_TEXT} detail=${shutDetail === null ? '(detail not found in installed bytes)' : shutDetail[1]}`
      facts.expectedRefusalVerbatim = EXPECTED_REFUSAL
      check('G0', 'THE SHUT-OFF GATE IS ON THE FACE THAT RUNS: the INSTALLED dist bytes consume planeCfg.globEnabled and carry the honest disabled backendId',
        distPlane.includes('globEnabled === false') && distPlane.includes('a5-glob-config-disabled'),
        `globEnabledHits=${String(distPlane.split('globEnabled').length - 1)} shutIdHits=${String(distPlane.split('a5-glob-config-disabled').length - 1)}`)
    }

    // profile layer on the INSTALLED bundle row id (public seam only)
    const cfg = rowConfig(mode, rootIds, world, launcher)
    const basePlugins = smokePresetPlugins({
      personaText: 'You are a coding agent powered by the {{model}} model.',
      cwdSuffix: 'Your working directory is {{cwd}}.',
      bashDescription: 'Run commands in a bash shell. State is persistent across calls.',
    })
    const layerLines = [
      `# candidate trial layer (run ${RUN_STAMP}, mode ${mode}): config override on the INSTALLED bundle row + preset — public profile-patch seam only (INSTALL §3.2/§3.5).`,
      '- id: dsh-agent-team',
      '  name: dsh-agent-team/host',
      '  config:',
      ...Object.entries(cfg).flatMap(([k, v]) => yamlEmit(k, v, 2)),
      ...['- insert:', ...yamlEmitItem(presetDeclarationRow({
        id: PRESET_ID, displayName: 'candidate base',
        description: `candidate base preset (run ${RUN_STAMP}) = trial preset`,
        plugins: basePlugins,
      }), 1)],
      '',
    ].join('\n')
    writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), layerLines)
    writeEvidence(`profile-layer-${mode}.yml`, redact(layerLines))
    if (mode === 'globoff') check('G3', 'the written profile layer carries teamToolPlane.globEnabled: false verbatim (the shut is a config fact, kit bytes aside)',
      /^\s+globEnabled: false$/m.test(layerLines) && /teamToolPlane:/.test(layerLines), `layerHasGlobEnabledFalse=${String(/^\s+globEnabled: false$/m.test(layerLines))}`)

    reqBase = mock.requests.length
    const INSTANCE_RAW = join(EVIDENCE_DIR, `instance-${mode}.raw.log`)
    const INSTANCE_LOG = join(EVIDENCE_DIR, `instance-${mode}.log`)
    const outFd = openSync(INSTANCE_RAW, 'a')
    host = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(port), '--no-open'], {
      cwd: join(HOME, 'workspace'), stdio: ['ignore', outFd, outFd],
      env: { ...process.env, DSH_HOME: HOME, DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH, DEEPSEEK_BASE_URL: `http://127.0.0.1:${mock.port}`, DEEPSEEK_API_KEY: 'cand-mock-key' },
    })
    host.on('exit', (code, signal) => { hostExit = { code, signal }; console.log(`[${mode}] host exited code=${String(code)} signal=${String(signal)}`) })
    const boot = await waitFor(180_000, () => {
      try { const mm = BOOT_MARKER.exec(readFileSync(INSTANCE_RAW, 'utf8')); return mm === null ? false : mm } catch { return false }
    }, `${mode} boot marker`)
    facts.bootLine = redact(String(boot[0])).slice(0, 200)
    const origin = `http://127.0.0.1:${boot[1]}`
    const noTok = await fetch(`${origin}/`, { redirect: 'manual', signal: AbortSignal.timeout(10_000) })
    const auth = await fetch(`${origin}/?token=${boot[2]}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
    const cookie = auth.headers.get('set-cookie')
    check(`B.${mode}`, `the installed face boots (mode ${mode}): boot marker + GET / without token = 401 + token gate 303 with set-cookie`,
      noTok.status === 401 && auth.status === 303 && cookie !== null,
      `noToken=${String(noTok.status)} auth=${String(auth.status)}`)

    if (mode === 'probe') {
      facts.ok = true
      return facts
    }

    // discovery turn -> denyList
    const MKD = `${MK}_${mode.toUpperCase()}_DISC`
    let discHit = null
    for (let k = 1; k <= 8 && discHit === null; k += 1) {
      await fetchJson(`${origin}/api/session/prompt`, {
        method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
        body: JSON.stringify({ type: 'client-request', rpcId: `cand-${mode}-d${k}`, method: 'session/prompt', payload: { args: { request: { requestId: `cand-${mode}-d${k}-r`, sessionId: rootIds.root, mode: 'queue', content: [{ type: 'text', text: `${MKD} (barrier probe ${k}) This is a setup turn. Do not call any tools. Reply OK.` }] } } } }),
      }, 240_000)
      const deadline = Date.now() + 30_000
      for (;;) {
        discHit = (mock.requests ?? []).find((r) => r.digest?.markerHits.includes(MKD) && r.digest.toolCount > 0) ?? null
        if (discHit !== null || Date.now() >= deadline) break
        await new Promise((r) => setTimeout(r, 400))
      }
    }
    if (discHit === null) die('discovery turn never reached the mock')
    const surface = [...new Set(discHit.digest.toolNames ?? [])].sort()
    const MANAGED = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh']
    const SAFE = ['todo_write']
    const denyList = surface.filter((n) => !n.startsWith('team_') && !MANAGED.includes(n) && !SAFE.includes(n))
    facts.discoverySurface = surface
    const MKT = `${MK}_${mode.toUpperCase()}_TASK`
    writeFileSync(join(world.blueprintDir, 'main.yaml'), mainBlueprintYaml(mode, denyList, MKT, rootIds))

    const cl = await waitFor(60_000, async () => {
      const r = await fetchJson(`${origin}/team-remote/catalog.list`, {
        method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
        body: JSON.stringify({ type: 'client-request', rpcId: `cand-${mode}-pre`, method: 'catalog.list', payload: { version: 4, params: {} } }),
      }, 30_000)
      return JSON.stringify(r.body ?? '').includes(rootIds.bpId) ? r : false
    }, 'catalog.list to carry the main blueprint')
    facts.catalogPreflight = cl.status

    const created = await fetchJson(`${origin}/team-remote/team.create`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
      body: JSON.stringify({ type: 'client-request', rpcId: `cand-${mode}-tc`, method: 'team.create', payload: { version: 1, params: { rootSessionId: rootIds.createRoot, blueprintId: rootIds.bpId, initialWork: { prompt: `${MK}_${mode.toUpperCase()}_L0 Begin your directive.` } } } }),
    }, 90_000)
    facts.teamCreate = { status: created.status, body: redact(JSON.stringify(created.body ?? null)).slice(0, 800) }
    check(`B2.${mode}`, `team.create is accepted on the installed face (mode ${mode})`, created.status === 200, `status=${String(created.status)}`)

    const chain = await waitFor(900_000, async () => {
      const reqs = (mock.requests ?? []).filter((r) => r.digest?.markerHits.includes(`${MK}_${mode.toUpperCase()}_L0`) && r.digest.toolCount > 0)
      if (reqs.length === 0) return false
      const doneReplied = reqs.some((r) => JSON.stringify(r.reply ?? '').includes('CAND_LEADER_DONE'))
      if (!doneReplied) return false
      const last = reqs[reqs.length - 1]
      return { toolCalls: last.digest.assistantToolNames, backToLeader: last.digest._text.includes('CAND_MEMBER_RESULT'), reqCount: reqs.length }
    }, `${mode} leader chain (create member -> list -> delegate -> collect -> final)`)
    facts.leaderToolCalls = chain.toolCalls
    facts.memberResultsBackToLeader = chain.backToLeader

    const leaderReqs = (mock.requests ?? []).filter((r) => r.digest?.markerHits.includes(`${MK}_${mode.toUpperCase()}_L0`) && r.digest.toolCount > 0)
    const listResult = leaderReqs.map((r) => (r.digest?.toolResults ?? [])).flat().find((t) => t.includes('members-listed') || t.includes('"members"')) ?? null
    facts.listMembersResult = listResult === null ? null : listResult.slice(0, 900)

    const memberReqs = (mock.requests ?? []).filter((r) => r.digest?.markerHits.includes(MKT) && !r.digest.markerHits.includes(`${MK}_${mode.toUpperCase()}_L0`) && r.digest.toolCount > 0)
    const lastM = memberReqs[memberReqs.length - 1]
    facts.memberRequestCount = memberReqs.length
    facts.memberWireCatalog = [...new Set(lastM?.digest.toolNames ?? [])].sort()
    facts.memberToolCallOrder = lastM?.digest.assistantToolNames ?? []
    facts.memberToolResults = (lastM?.digest.toolResults ?? []).map((t) => t.slice(0, 800))
    facts.memberFinal = JSON.stringify(lastM?.reply ?? null).slice(0, 1200)
    const wireAll = mock.requests.slice(reqBase).map((r) => JSON.stringify({ reply: r.reply ?? null, digest: r.digest === undefined ? null : { toolResults: r.digest.toolResults, text: r.digest._text } }))
    facts.outsideMarkerOnWire = wireAll.filter((s) => s.includes(OUTSIDE_MARKER)).length
    facts.seedNamesOnWire = GPOS_SEEDS.map((n) => ({ name: n, hits: wireAll.filter((s) => s.includes(n)).length }))
    facts.bashWroteExists = existsSync(world.bashWrote)
    facts.bashWroteBytes = facts.bashWroteExists ? readFileSync(world.bashWrote, 'utf8') : null
    facts.results = (lastM?.digest.toolResults ?? []).map(String)
    facts.names = lastM?.digest.assistantToolNames ?? []
    facts.expectedRefusalVerbatim = EXPECTED_REFUSAL
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
        digest: r.digest === undefined ? null : { ...r.digest, markerHits: r.digest.markerHits.filter((x) => x.startsWith(MK.split('_')[0])), toolResults: r.digest.toolResults.map((x) => redact(x)), _text: `${r.digest._text.length} chars` },
      }))
      writeFileSync(join(EVIDENCE_DIR, `wire-digests-${mode}.jsonl`), lines.join('\n') + '\n')
    } catch { /* best effort */ }
    try {
      const raw = readFileSync(join(EVIDENCE_DIR, `instance-${mode}.raw.log`), 'utf8')
      facts.witnessShell = raw.split('\n').filter((l) => /confined-shell ran/.test(l)).slice(-6).map((l) => redact(l).slice(0, 260))
      facts.hostErrors = raw.split('\n').filter((l) => /ERR_MODULE_NOT_FOUND|bootstrap FAILED|TRUST_ROOT|placement-REFUSED|mount-REFUSED|BINDING_UNVERIFIED|TEAM_PLUGIN_CONFIG_INVALID|unhandled/i.test(l)).slice(0, 10).map((l) => redact(l).slice(0, 300))
      writeFileSync(join(EVIDENCE_DIR, `instance-${mode}.log`), redact(raw))
      rmSync(join(EVIDENCE_DIR, `instance-${mode}.raw.log`))
      facts.logTokenResidue = (redact(raw).match(/token=[A-Za-z0-9_-]{8,}/g) ?? []).length
    } catch { /* no log */ }
    if (!KEEP) { if (existsSync(join(HOME, '.CANDIDATE-HUMAN-USE'))) { facts.swept = 'REFUSED-HUMAN-SENTINEL (never swept by the kit)'; } else { try { rmSync(HOME, { recursive: true, force: true }) } catch { /* best effort */ } } }
    facts.swept = !existsSync(HOME)
    worldsSwept.push({ mode, home: HOME, swept: facts.swept })
  }
}

// ─── PIN-TABLE leg: reserved native names must refuse to mount ──────────────
// Three impersonation claims (subagent_codex / subagent_claude_code / subagent_fork
// mounted via teamToolPlane.names) must land the EXISTING typed refusal
// (PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED, agent-bindings mount REFUSED) with the
// claim never reaching a mount or a wire turn; the control world renames the
// glob row to an unclaimed spelling and MUST mount normally (claim-specific,
// not a names-config-wide outage). The registry itself is graded statically from
// the INSTALLED bytes (PT0) — live claims only prove the refusal face.
async function runPinWorld ({ mode, claim, state, srcHome, mock, port }) {
  const HOME = join(HOMES_ROOT, `${WORLD_PREFIX}-${mode}-${RUN_STAMP}`)
  const rootIds = { root: `cand-${mode}-root`, createRoot: `session-cand-${mode}-team-${RUN_STAMP}`, bpId: `cand-${mode}-main-bp`, anchorId: `cand-${mode}-anchor-bp`, tkCm: 'x', tkLm: 'x', tkD1: 'x' }
  const world = { governedRoot: join(HOME, 'workspace', 'governed'), blueprintDir: join(HOME, 'blueprints'), deployment: join(HOME, 'deployment') }
  const facts = { mode, home: HOME, claim, ok: false }
  let host = null
  let hostExit = null
  try {
    if (existsSync(HOME)) die(`world ${HOME} already exists — trial worlds must be FRESH`)
    mkdirSync(join(HOME, 'workspace', 'governed'), { recursive: true })
    mkdirSync(world.blueprintDir, { recursive: true })
    const profileDir = join(HOME, 'profiles', 'web')
    mkdirSync(profileDir, { recursive: true })
    writeFileSync(join(profileDir, 'pnpm-workspace.yaml'), `packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\nstoreDir: ${STORE_DIR}\n`)
    const spec = `github:ArmourPiercer1/dsh-agent-team#${state.sha}`
    const t0 = Date.now()
    const install = spawnSync(process.execPath, [HOST_BIN, 'plugin', '--profile', 'web', 'add', spec], { cwd: join(HOME, 'workspace'), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 900_000, env: { ...process.env, DSH_HOME: HOME } })
    const installedDir = join(profileDir, 'node_modules', 'dsh-agent-team')
    const m = measureInstalledFace(installedDir, faceRef.face, faceRef.mirror)
    facts.install = { exit: install.status, seconds: Math.round((Date.now() - t0) / 1000), actualCount: m.actualCount, missing: m.missing.length, extra: m.extra.length, shaMismatch: m.shaMismatch.length, rootSha: m.rootSha }
    check(`W.${mode}`, `the ${mode} (pin-table) world re-installed the recorded face through the public package face with THREE ZEROS and rootSha == INSTALLED.json rootSha`,
      install.status === 0 && m.missing.length === 0 && m.extra.length === 0 && m.shaMismatch.length === 0 && m.rootSha === state.rootSha,
      `exit=${String(install.status)} n=${String(m.actualCount)}/${String(m.expectedCount)} rootSha=${m.rootSha.slice(0, 16)}${m.rootSha === state.rootSha ? '==installed' : '!=installed'}`)
    const launcherRel = 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py'
    const blob = spawnSync('git', ['-C', srcHome, 'show', `${state.sha}:${launcherRel}`], { maxBuffer: 64 * 1024 * 1024 })
    if (blob.status !== 0) die(`git show of the launcher blob failed in ${srcHome}`)
    mkdirSync(world.deployment, { recursive: true })
    const launcherPath = join(world.deployment, 'landlock-prelauncher.py')
    writeFileSync(launcherPath, blob.stdout)
    const launcher = { path: launcherPath, sha: sha256Text(blob.stdout) }
    const cfg = rowConfig(mode, rootIds, world, launcher)
    cfg.teamToolPlane.names = { glob: claim } // the CLAIM under test (or the control rename)
    const basePlugins = smokePresetPlugins({ personaText: 'You are a coding agent powered by the {{model}} model.', cwdSuffix: 'Your working directory is {{cwd}}.', bashDescription: 'Run commands in a bash shell.' })
    const layerLines = [
      `# candidate pin-table layer (run ${RUN_STAMP}, mode ${mode}): plane mount-name claim '${claim}' — a reserved-native claim must refuse at mount (public profile-patch seam only).`,
      '- id: dsh-agent-team', '  name: dsh-agent-team/host', '  config:',
      ...Object.entries(cfg).flatMap(([k, v]) => yamlEmit(k, v, 2)),
      ...['- insert:', ...yamlEmitItem(presetDeclarationRow({ id: PRESET_ID, displayName: 'candidate base', description: 'pin-table preset', plugins: basePlugins }), 1)],
      '',
    ].join('\n')
    writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), layerLines)
    writeEvidence(`profile-layer-${mode}.yml`, redact(layerLines))
    // governed blueprint: capabilities.permissions present = governed template = plane binds at the
    // TEAM session (the mount point under test). Leader persona calls NO tools — the mount either
    // REFUSES (claim worlds) or FEEDS (control) at bind time, before any dispatch.
    const pinBp = [
      '---', 'schemaVersion: 3', `blueprintId: ${rootIds.bpId}`, 'revision: "1"',
      `displayName: "candidate pin-table probe (${mode})"`,
      'description: "pin-table: reserved-native mount-name claim refuses at the team-session bind (public seam install face)."',
      'leader:', '  templateId: leader', '  persona: "You are the leader of a probe team. Reply with one line: CAND_PIN_OK. Never call any tool."',
      '  capabilities:', '    teamTools:', '      kind: allow', '      items: []', '    builtinToolDeny: []',
      '    skills:', '      kind: allow', '      items: []', '    mcp:', '      kind: allow', '      items: []',
      '    permissions:', '      default: ask', '      allow: []', '      ask: []', '      deny: []',
      'members:', '  - templateId: wa', '    persona: "Probe member. Never called."',
      '    capabilities:', '      teamTools:', '        kind: allow', '        items: []', '      builtinToolDeny: []',
      '      skills:', '        kind: allow', '        items: []', '      mcp:', '        kind: allow', '        items: []',
      '      permissions:', '        default: ask', '        allow: []', '        ask: []', '        deny: []',
      'memberEnvelopes: []', 'permissionMutationEnvelope:', '  rules: []', 'teamHardEnvelope:', '  rules: []',
      'requirements: []', 'policyStates: []', 'metadata: {}', '---', '',
    ].join('\n')
    writeFileSync(join(world.blueprintDir, 'main.yaml'), pinBp)
    writeEvidence(`blueprint-${mode}.yaml`, pinBp)
    const INSTANCE_RAW = join(EVIDENCE_DIR, `instance-${mode}.raw.log`)
    const outFd = openSync(INSTANCE_RAW, 'a')
    host = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(port), '--no-open'], {
      cwd: join(HOME, 'workspace'), stdio: ['ignore', outFd, outFd],
      env: { ...process.env, DSH_HOME: HOME, DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH, DEEPSEEK_BASE_URL: `http://127.0.0.1:${mock.port}`, DEEPSEEK_API_KEY: 'cand-mock-key' },
    })
    host.on('exit', (code, signal) => { hostExit = { code, signal }; console.log(`[${mode}] host exited code=${String(code)} signal=${String(signal)}`) })
    const boot = await waitFor(180_000, () => {
      try { const mm = BOOT_MARKER.exec(readFileSync(INSTANCE_RAW, 'utf8')); return mm === null ? false : mm } catch { return false }
    }, `${mode} boot marker`)
    const origin = `http://127.0.0.1:${boot[1]}`
    const auth = await fetch(`${origin}/?token=${boot[2]}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
    const cookie = auth.headers.get('set-cookie')
    const MKD = `${MK}_${mode.toUpperCase()}_DISC`
    const RAWP = () => { try { return readFileSync(join(EVIDENCE_DIR, `instance-${mode}.raw.log`), 'utf8') } catch { return '' } }
    const refusalInLog = () => /NATIVE_CLAIM|refused the mount|mount-REFUSED|team tool plane refused/i.test(RAWP())
    // catalog must carry the blueprint, then team.create binds the TEAM leader session —
    // THE mount point (agent-bindings a5-plane block). The refusal (claims) or the feed
    // (control) must appear on this face.
    let createRes = null
    for (let k = 1; k <= 10; k += 1) {
      const cl = await fetchJson(`${origin}/team-remote/catalog.list`, {
        method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
        body: JSON.stringify({ type: 'client-request', rpcId: `cand-${mode}-pre${String(k)}`, method: 'catalog.list', payload: { version: 4, params: {} } }),
      }, 30_000)
      if (JSON.stringify(cl.body ?? '').includes(rootIds.bpId)) break
      await new Promise((r) => setTimeout(r, 2000))
    }
    // the live boot readies the team runtime asynchronously ("state: starting" refuses in the
    // window; runWorld gets past it via its discovery ladder's elapsed time) — retry until ready
    for (let k = 1; k <= 30; k += 1) {
      try {
        createRes = await fetchJson(`${origin}/team-remote/team.create`, {
          method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
          body: JSON.stringify({ type: 'client-request', rpcId: `cand-${mode}-tc${String(k)}`, method: 'team.create', payload: { version: 1, params: { rootSessionId: rootIds.createRoot, blueprintId: rootIds.bpId, initialWork: { prompt: `${MKD} mount-claim probe: begin.` } } } }),
        }, 120_000)
      } catch (error) {
        facts.promptError = redact(String(error?.message ?? error)).slice(0, 300)
      }
      if (!JSON.stringify(createRes?.body ?? '').includes('team runtime is not ready')) break
      if (refusalInLog()) break // refusal during the runtime's own bind attempts is decisive
      await new Promise((r) => setTimeout(r, 3000))
    }
    facts.prompt = { status: createRes?.status ?? null, body: redact(JSON.stringify(createRes?.body ?? null)).slice(0, 700), error: facts.promptError ?? null }
    // grace poll: the mount attempt (refusal or placement) lands in the host log
    try {
      await waitFor(mode === 'pinok' ? 90_000 : 45_000, () => (mode === 'pinok'
        ? (/a5g7: placement-feed rows=/.test(RAWP()) && (mock.requests ?? []).some((r) => r.digest?.markerHits.includes(MKD)))
        : (refusalInLog() || /a5g7: placement-feed rows=/.test(RAWP()))), `${mode} mount face`)
    } catch { /* graded below from log + facts */ }
    facts.discHits = (mock.requests ?? []).filter((r) => r.digest?.markerHits.includes(MKD)).length
    facts.ok = true
    return facts
  } finally {
    writeEvidence(`pin-${mode}.partial.json`, facts)
    try { if (host !== null) host.kill() } catch { /* gone */ }
    await new Promise((r) => setTimeout(r, 3000))
    facts.hostExit = hostExit
    try {
      const raw = readFileSync(join(EVIDENCE_DIR, `instance-${mode}.raw.log`), 'utf8')
      facts.refuseLines = raw.split('\n').filter((l) => /mount-REFUSED|refused the mount|NATIVE_CLAIM/i.test(l)).slice(0, 8).map((l) => redact(l).slice(0, 400))
      facts.placementLines = raw.split('\n').filter((l) => /a5g7: placement-feed rows=/.test(l)).slice(-4).map((l) => redact(l).slice(0, 300))
      writeFileSync(join(EVIDENCE_DIR, `instance-${mode}.log`), redact(raw))
      rmSync(join(EVIDENCE_DIR, `instance-${mode}.raw.log`))
      facts.logTokenResidue = (redact(raw).match(/token=[A-Za-z0-9_-]{8,}/g) ?? []).length
    } catch { /* no log */ }
    if (!KEEP) { if (existsSync(join(HOME, '.CANDIDATE-HUMAN-USE'))) { facts.swept = 'REFUSED-HUMAN-SENTINEL (never swept by the kit)'; } else { try { rmSync(HOME, { recursive: true, force: true }) } catch { /* best effort */ } } }
    facts.swept = !existsSync(HOME)
    worldsSwept.push({ mode, home: HOME, swept: facts.swept })
  }
}

// ═══════════════════════════════════ MAIN ════════════════════════════════════
let exitCode = 0
try {
  // ---- state gate: the trial runs ONLY against a recorded install ----
  if (!/^[0-9a-f]{40}$/.test(CANDIDATE_SHA)) die('CANDIDATE_SHA is required (env CANDIDATE_SHA or --sha); NO default — the trial never guesses what to run')
  if (!existsSync(STATE)) die(`no INSTALLED.json at ${STATE} — run install-candidate.sh first (the trial never installs by itself)`)
  const state = JSON.parse(readFileSync(STATE, 'utf8'))
  if (state.sha !== CANDIDATE_SHA) die(`CANDIDATE_SHA (${CANDIDATE_SHA}) != INSTALLED.json sha (${state.sha}) — refuse to trial a different thing than what was installed`)
  if (!/^[0-9a-f]{64}$/.test(String(state.rootSha))) die('INSTALLED.json carries no rootSha — the recorded install predates this package law')
  const srcHome = String(state.srcHome ?? '')
  if (!existsSync(srcHome)) die(`recorded candidate src clone missing (${srcHome}) — rollback/reinstall it before trialling`)

  if (DRY) {
    // Dry-run: syntax + wiring + plan only. NO ports, NO network, NO worlds.
    console.log(`DRY-RUN plan (stamp ${RUN_STAMP}) legs=${JSON.stringify(LEGS)}`)
    console.log(`  state sha=${state.sha.slice(0, 12)}… rootSha=${String(state.rootSha).slice(0, 12)}… installHome=${state.installHome}`)
    const taken0 = []
    const planHost = await pickFreePort([3180, 3181, 3182, 3183, 3184, 3185, 3186], taken0)
    const planMock = await pickFreePort([3491, 3492, 3493, 3494, 3495, 3496, 3497, 3498, 3499, 3500], taken0)
    console.log(`  planned host/mock ports (free-probed): ${String(planHost)}/${String(planMock)} (3080 excluded; family per TEST_METHODS §1)`)
    const planned = LEGS.flatMap((l) => l === 'pin-table' ? ['pincodex', 'pincc', 'pinfork', 'pinok'] : (l === 'probe' || l === 'bash-b2' ? [] : [modeFor(l)])).map((m) => `${WORLD_PREFIX}-${m}-${RUN_STAMP}`)
    console.log(`  worlds planned: ${planned.join(', ') || '(probe reuses the installed world)'} (LEG bash-b2 grades inside the pos world; LEG pin-table = 3 impersonation claims + control rename); teardown by EXACT names only`)
    check('D1', 'dry-run wiring: state sha matches CANDIDATE_SHA; src clone present; helpers importable (this line runs after all top-level imports succeeded)', true, `sha=${state.sha.slice(0, 10)} host-bin=${String(existsSync(HOST_BIN))}`)
    check('D2', 'dry-run: a host port and a mock port from the 3180/349x families are free right now', planHost > 0 && planMock > 0, `host=${String(planHost)} mock=${String(planMock)}`)
    throw { __dryDone: true }
  }

  mkdirSync(EVIDENCE_DIR, { recursive: true })
  const stale = existsSync(HOMES_ROOT) ? readdirSync(HOMES_ROOT).filter((d) => d.startsWith(`${WORLD_PREFIX}-${RUN_STAMP}`)) : []
  writeEvidence('start.json', { legs: LEGS, candidateSha: state.sha, rootSha: state.rootSha, homesRoot: HOMES_ROOT, staleFromThisStamp: stale })

  // H pins
  const tuHead = spawnSync('git', ['-C', TESTUSE, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim()
  const porcelainBefore = spawnSync('git', ['-C', TESTUSE, 'status', '--porcelain'], { encoding: 'utf8' }).stdout.trim()
  check('H1', `the test-use host is the pinned pristine runtime @${TEST_USE_BASELINE_SHA.slice(0, 10)} with porcelain clean before`, tuHead === TEST_USE_BASELINE_SHA && porcelainBefore === '', `head=${tuHead.slice(0, 10)} porcelain=${porcelainBefore === '' ? 0 : 'DIRTY'}`)
  check('H1b', 'the trial runs EXACTLY the SHA the installer recorded (no drift between install and trial)', state.sha === CANDIDATE_SHA, `sha=${state.sha}`)
  const stableBefore = await stableProbe()
  check('H0', 'the stable :3080 instance answers read-only before the run (probe only, never touched)', true, `status=${String(stableBefore)}`)

  // face reference (for W legs)
  faceRef = { face: declaredFace(srcHome, state.sha) }
  faceRef.mirror = materializeDeclaredFace(srcHome, state.sha, faceRef.face)

  // ports self-proved free + auto-picked
  const taken = []
  // ports: one per world actually booted (bash-b2 grades inside pos; pin-table = 3 claims + control)
  const need = LEGS.reduce((a, l) => a + (l === 'bash-b2' ? 0 : l === 'pin-table' ? PIN_CLAIMS.length + 1 : 1), 0)
  const hostPorts = []
  for (let i = 0; i < need; i += 1) {
    const p = await pickFreePort([3180, 3181, 3182, 3183, 3184, 3185, 3186], taken)
    if (p === 0) break
    hostPorts.push(p)
  }
  const mockPort = await pickFreePort([3491, 3492, 3493, 3494, 3495, 3496, 3497, 3498, 3499, 3500], taken)
  check('H2', `host ports ${JSON.stringify(hostPorts)} + mock ${String(mockPort)} from the 3180/349x families self-proved free before the run (3080 excluded)`, hostPorts.length === need && mockPort > 0, `hostPorts=${JSON.stringify(hostPorts)} mock=${String(mockPort)}`)

  // mock at the LLM slot (scripted per world)
  const markers = []
  for (const leg of LEGS) {
    const modes = leg === 'pin-table' ? PIN_CLAIMS.map((x) => x[0]).concat(['pinok']) : [modeFor(leg)]
    for (const m of modes) { const mu = m.toUpperCase(); markers.push(`${MK}_${mu}_DISC`, `${MK}_${mu}_L0`, `${MK}_${mu}_TASK`) }
  }
  markers.push('CAND_MEMBER_RESULT', 'CAND_LEADER_DONE')
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
    for (const pm of ['PINCODEX', 'PINCC', 'PINFORK', 'PINOK']) if (text.includes(`${MK}_${pm}_DISC`)) return { kind: 'text', content: 'CAND_DISC_OK' }
    for (const leg of LEGS) {
      if (leg === 'probe') continue
      const mode = leg === 'glob-off' ? 'globoff' : 'pos'
      const mu = leg === 'glob-off' ? 'GLOBOFF' : 'POS'
      const rootIds = {
        root: `cand-${mode}-root`,
        createRoot: `session-cand-${mode}-team-${RUN_STAMP}`,
        tkCm: `cand-${mode}-tok-cm`, tkLm: `cand-${mode}-tok-lm`, tkD1: `cand-${mode}-tok-d1`,
      }
      if (text.includes(`${MK}_${mu}_DISC`)) return { kind: 'text', content: 'CAND_DISC_OK' }
      if (text.includes(`${MK}_${mu}_L0`)) {
        const calls = digest.assistantToolNames
        const lastResult = digest.toolResults[digest.toolResults.length - 1] ?? ''
        if (calls.length === 0) return toolCall(`call-cand-create-${rnd()}`, 'team_create_member', {
          rootSessionId: rootIds.createRoot, requestToken: rootIds.tkCm, delegationTemplateId: 'wa', label: 'cand-a',
          taskSummary: 'candidate trial explicit member creation',
        })
        if (calls.length === 1) return toolCall(`call-cand-list-${rnd()}`, 'team_list_members', { rootSessionId: rootIds.createRoot, requestToken: rootIds.tkLm })
        if (calls.length === 2) {
          const inst = /(inst-[A-Za-z0-9_-]+)/.exec(digest.toolResults[digest.toolResults.length - 1] ?? '')
          if (inst === null) return { kind: 'text', content: 'CAND_MEMBER_ID_UNPARSEABLE ' + String(digest.toolResults[digest.toolResults.length - 1] ?? '').slice(0, 120) }
          return toolCall(`call-cand-delegate-${rnd()}`, 'team_delegate', {
            rootSessionId: rootIds.createRoot, requestToken: rootIds.tkD1, delegationInstanceId: inst[1],
            label: 'cand-a1', // tool schema requires label in the instance form too (finding ②§C-15)
            taskSummary: 'candidate trial delegated legs',
            prompt: `${MK}_${mu}_TASK Do the delegated work exactly as instructed.`, async: false,
          })
        }
        if (calls.length === 3) return toolCall(`call-cand-collect-${rnd()}`, 'team_collect', { rootSessionId: rootIds.createRoot, requestToken: `cand-collect-${RUN_STAMP}`, requestTokens: [rootIds.tkD1] })
        return { kind: 'text', content: `CAND_LEADER_DONE collect=${String(lastResult.slice(0, 100).replace(/\s+/g, ' '))}` }
      }
      if (text.includes(`${MK}_${mu}_TASK`)) {
        const steps = stepsFor(mode)
        const idx = steps.findIndex((s) => !text.includes(stepMarker(s)))
        if (idx === -1) {
          const results = digest.toolResults
          return { kind: 'text', content: `CAND_MEMBER_RESULT ${results.map((r, i) => `r${String(i)}=${r.slice(0, 220).replace(/\s+/g, ' ')}`).join(' | ')}` }
        }
        const [name, a] = steps[idx]
        return toolCall(`call-cand-${mode}-${String(idx)}-${rnd()}`, name, a)
      }
    }
    return { kind: 'text', content: 'cand-mock: unscripted request, completing quietly.' }
  }
  let mock = null
  for (const candidate of [mockPort, 3491, 3492, 3493, 3494, 3495, 3496, 3497, 3498, 3499, 3500]) {
    if (candidate === 0 || !(await portFree(candidate))) continue
    try { mock = await startMockModel({ port: candidate, log: () => { }, decide: mockDecide }); break } catch (error) {
      if (String(error?.code ?? '') !== 'EADDRINUSE') throw error
    }
  }
  if (mock === null) die('no 349x mock port could be bound')

  const worldResults = {}
  try {
    let portIdx = 0
    for (const leg of LEGS) {
      const mode = leg === 'glob-off' ? 'globoff' : leg
      if (leg === 'probe') {
        // FASTEST LEG: boot the already-installed world, token gate, dump-config.
        const HOME = String(state.installHome)
        if (!existsSync(HOME)) die(`installed world missing: ${HOME}`)
        const launcherPath = join(HOME, 'deployment', 'landlock-prelauncher.py')
        if (!existsSync(launcherPath)) die(`launcher deployment input missing: ${launcherPath} (run install-candidate.sh)`)
        const launcher = { path: launcherPath, sha: sha256File(launcherPath) }
        if (launcher.sha !== String(state.launcher?.sha256 ?? '')) die('launcher bytes drifted from INSTALLED.json — refuse to boot')
        const rootIds = { root: 'cand-probe-root', createRoot: `session-cand-probe-${RUN_STAMP}`, bpId: 'x', anchorId: 'cand-probe-anchor', tkCm: 'x', tkLm: 'x', tkD1: 'x' }
        const world = { governedRoot: join(HOME, 'workspace', 'governed'), blueprintDir: join(HOME, 'blueprints'), deployment: join(HOME, 'deployment') }
        mkdirSync(world.governedRoot, { recursive: true })
        mkdirSync(world.blueprintDir, { recursive: true })
        const cfg = rowConfig('probe', rootIds, world, launcher)
        const basePlugins = smokePresetPlugins({ personaText: 'You are a coding agent powered by the {{model}} model.', cwdSuffix: 'Your working directory is {{cwd}}.', bashDescription: 'Run commands in a bash shell.' })
        const layerLines = [
          `# candidate probe layer (run ${RUN_STAMP}): the installed bundle row + preset (fastest leg — boot only, no prompts).`,
          '- id: dsh-agent-team', '  name: dsh-agent-team/host', '  config:',
          ...Object.entries(cfg).flatMap(([k, v]) => yamlEmit(k, v, 2)),
          ...['- insert:', ...yamlEmitItem(presetDeclarationRow({ id: PRESET_ID, displayName: 'candidate base', description: 'probe preset', plugins: basePlugins }), 1)],
          '',
        ].join('\n')
        writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), layerLines)
        const port = hostPorts[portIdx] ?? 0
        if (port === 0) die('no free host port for the probe leg')
        portIdx += 1
        const INSTANCE_RAW = join(EVIDENCE_DIR, 'instance-probe.raw.log')
        const outFd = openSync(INSTANCE_RAW, 'a')
        const host = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(port), '--no-open'], {
          cwd: join(HOME, 'workspace'), stdio: ['ignore', outFd, outFd],
          env: { ...process.env, DSH_HOME: HOME, DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH },
        })
        let bootLine = null
        try {
          const boot = await waitFor(180_000, () => {
            try { const mm = BOOT_MARKER.exec(readFileSync(INSTANCE_RAW, 'utf8')); return mm === null ? false : mm } catch { return false }
          }, 'probe boot marker')
          bootLine = boot
          const origin = `http://127.0.0.1:${boot[1]}`
          const noTok = await fetch(`${origin}/`, { redirect: 'manual', signal: AbortSignal.timeout(10_000) })
          const auth = await fetch(`${origin}/?token=${boot[2]}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
          check('P1', 'FASTEST LEG: the installed face boots (boot marker + 401 without token + 303 with token) — no prompts, no model', noTok.status === 401 && auth.status === 303 && auth.headers.get('set-cookie') !== null, `noToken=${String(noTok.status)} auth=${String(auth.status)} boot=${redact(String(boot[0])).slice(0, 90)}`)
          const dump = spawnSync(process.execPath, [HOST_BIN, '--profile', 'web', '--dump-config'], {
            cwd: join(HOME, 'workspace'), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 180_000,
            env: { ...process.env, DSH_HOME: HOME },
          })
          const dumpText = dump.stdout ?? ''
          writeEvidence('dump-config-probe.txt', redact(dumpText))
          check('P2', 'the public seam composes the installed team row + spill/client rows while the probe world is the SAME bytes INSTALLED.json recorded', /^- id: dsh-agent-team\n {2}name: dsh-agent-team\/host$/m.test(dumpText) && /name: dsh-agent-team\/spill-local/.test(dumpText) && /^- id: dsh-agent-team-client$/m.test(dumpText), `exit=${String(dump.status)}`)
        } finally {
          try { host.kill() } catch { /* gone */ }
          await new Promise((r) => setTimeout(r, 2000))
          try {
            const raw = readFileSync(INSTANCE_RAW, 'utf8')
            writeFileSync(join(EVIDENCE_DIR, 'instance-probe.log'), redact(raw))
            rmSync(INSTANCE_RAW)
            worldResults.probe = { bootLine: redact(String(bootLine?.[0] ?? '')), hostErrors: raw.split('\n').filter((l) => /ERR_MODULE_NOT_FOUND|bootstrap FAILED|TRUST_ROOT|mount-REFUSED|TEAM_PLUGIN_CONFIG_INVALID|unhandled/i.test(l)).slice(0, 10).map((l) => redact(l)) }
            check('P3', 'the probe boot left no bootstrap/module/config errors in the host log', worldResults.probe.hostErrors.length === 0, JSON.stringify(worldResults.probe.hostErrors).slice(0, 300))
          } catch { /* no log */ }
        }
        continue
      }
      if (leg === 'pin-table') {
        for (const [pm, claim] of PIN_CLAIMS.concat([['pinok', PIN_CONTROL]])) {
          const hostPort = hostPorts[portIdx]
          if (hostPort === undefined) die(`no free host port left for pin-table leg ${pm}`)
          portIdx += 1
          worldResults[pm] = await runPinWorld({ mode: pm, claim, state, srcHome, mock, port: hostPort })
        }
        continue
      }
      if (leg === 'bash-b2') continue // graded from the pos world below
      const hostPort = hostPorts[portIdx]
      if (hostPort === undefined) { die(`no free host port left for leg ${leg}`) }
      worldResults[mode] = await runWorld({ mode, state, srcHome, mock, port: hostPort })
      portIdx += 1
    }

    // ─── LEG A grading (pos world) ───
    if (LEGS.includes('pos') && worldResults.pos?.ok === true) {
      const w = worldResults.pos
      check('L2a', 'LEG A/1 create-member: team_create_member + team_list_members rode the Leader wire and an instance id came back', w.leaderToolCalls?.slice(0, 2)?.includes('team_create_member') === true && w.leaderToolCalls?.slice(0, 2)?.includes('team_list_members') === true && String(w.listMembersResult ?? '').includes('cand-a'), `leaderTools=${JSON.stringify(w.leaderToolCalls ?? [])}`)
      check('L2b', 'LEG A/2 delegate+collect: team_delegate ran on the created INSTANCE (async:false) and team_collect read the member result back to the Leader', w.leaderToolCalls?.includes('team_delegate') === true && w.leaderToolCalls?.includes('team_collect') === true && w.memberResultsBackToLeader === true, `leaderTools=${JSON.stringify(w.leaderToolCalls ?? [])}`)
      const rPos = (w.results ?? [])[0] ?? 'LEG-MISSING'
      check('L2c', 'LEG A/3 delegated work landed: team_bash positive inside the governed root rendered bash · exit=0 with the token, and the write exists on disk', rPos.includes('bash · exit=0') && rPos.includes(TOK_BASH) && w.bashWroteExists === true && String(w.bashWroteBytes ?? '').includes(WRITE_TOK), `landing=${JSON.stringify(rPos.slice(0, 220))} wrote=${String(w.bashWroteExists)}`)
    }
    // ─── LEG C grading (bash-b2: same pos world, out-of-bounds leg) ───
    if (LEGS.includes('bash-b2') && worldResults.pos?.ok === true) {
      const w = worldResults.pos
      const rOut = (w.results ?? [])[1] ?? 'LEG-MISSING'
      check('L3a', 'LEG C out-of-bounds negative control: the leg lands bash · exit=1 over the kernel Permission denied stderr, meta exitCode=1 (real code, #336 face)', rOut.includes('bash · exit=1') && /Permission denied/.test(rOut) && /exitCode[\\"]*\s*:\s*1/.test(rOut), `landing=${JSON.stringify(rOut.slice(0, 300))}`)
      check('L3b', 'zero disclosure + honest render: the outside marker never rides the wire in ANY request of this world; cancelled renders false absent a cancel (post-#340 semantics)', w.outsideMarkerOnWire === 0 && !rOut.includes('bash · cancelled') && /cancelled[\\"]*\s*:\s*false/.test(rOut), `markerOnWire=${String(w.outsideMarkerOnWire)}`)
    }
    // ─── LEG B grading (glob-off world) ───
    if (LEGS.includes('glob-off') && worldResults.globoff?.ok === true) {
      const w = worldResults.globoff
      check('G1', 'LEG B mount unchanged: with globEnabled:false the team_glob name STILL reaches the member wire (the EFFECT face refuses; nothing disappears)', (w.memberWireCatalog ?? []).includes('team_glob'), `memberPlaneNames=${JSON.stringify((w.memberWireCatalog ?? []).filter((n) => n.startsWith('team_') || n === 'read'))}`)
      const rGlob = (w.results ?? [])[0] ?? 'LEG-MISSING'
      check('G2', 'LEG B typed shut: team_glob lands the EXISTING refusal face verbatim (a5p5-refused / IO_POLICY_UNSUPPORTED, detail sentence taken from the INSTALLED bytes) — and the refusal is a refusal, not a truncated answer', rGlob.includes(String(w.expectedRefusalVerbatim ?? ' ')) && rGlob.includes(IO_TEXT) && !/^> .*zzcand-/m.test(rGlob), `landing=${JSON.stringify(rGlob.slice(0, 320))}`)
      const seedWire = (w.seedNamesOnWire ?? []).reduce((a, x) => a + x.hits, 0)
      check('G4', 'LEG B no fallback: the glob fixture seed names (zzcand-*) appear in NO wire byte of the off world — after the refusal nothing listed out', seedWire === 0, `perSeed=${JSON.stringify(w.seedNamesOnWire)}`)
    }
    // ─── LEG D grading (pin-table: reserved-name impersonation refuses; control mounts) ───
    if (LEGS.includes('pin-table')) {
      const distPlaneRel = 'packages/runtime/dist/packages/runtime/src/plugin/live/team-tool-plane.mjs'
      const distPath = join(String(state.installHome), 'profiles', 'web', 'node_modules', 'dsh-agent-team', distPlaneRel)
      const distPlane = existsSync(distPath) ? readFileSync(distPath, 'utf8') : ''
      const regM = /PLANE_RESERVED_NATIVE = Object\.freeze\(\[([\s\S]*?)\]\)/.exec(distPlane)
      const names = regM === null ? [] : [...regM[1].matchAll(/'([a-z_0-9]+)'/g)].map((x) => x[1])
      const uniq = [...new Set(names)]
      const dups = names.filter((n, i) => names.indexOf(n) !== i)
      check('PT0', 'PIN-TABLE/0 the INSTALLED bytes carry the reserved-native registry at full height: 69 literal entries (68 unique — the single source-internal duplicate "subagent" is DISCLOSED not hidden), the host pin string is present, and all three claim names are IN the registry',
        names.length === 69 && uniq.length === 68 && dups.length === 1 && dups[0] === 'subagent' && distPlane.includes("PLANE_RESERVED_NATIVE_HOST_PIN = '0.2.0-rc.2@639ed01539'") && ['subagent_codex', 'subagent_claude_code', 'subagent_fork'].every((n) => uniq.includes(n)),
        `count=${String(names.length)} unique=${String(uniq.length)} dups=${JSON.stringify(dups)} pin0rc2=${String(distPlane.includes('0.2.0-rc.2@639ed01539'))}`)
      for (const [pm, claim] of PIN_CLAIMS) {
        const w = worldResults[pm]
        const joined = (w?.refuseLines ?? []).join(' | ')
        const refusalSeen = joined.includes('NATIVE_CLAIM') && joined.includes(claim)
        const viaHttp = String(w?.prompt?.body ?? '').includes(claim) && String(w?.prompt?.body ?? '').toUpperCase().includes('NATIVE_CLAIM')
        const neverMounted = !(w?.placementLines ?? []).some((l) => l.includes(claim))
        check(`PT.${pm}`, `PIN-TABLE impersonation claim refuses at mount: the plane row claiming reserved native '${claim}' lands the typed PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED refusal (host log or prompt face), the claim NEVER reaches a mount, and no wire turn runs for this world`,
          w?.ok === true && (refusalSeen === true || viaHttp === true) && neverMounted === true && w.discHits === 0,
          `refusal=${JSON.stringify(joined.slice(0, 320))} prompt=${String(w?.prompt?.status)} placementLines=${String((w?.placementLines ?? []).length)} discHits=${String(w?.discHits)}`)
      }
      const wok = worldResults.pinok
      check('PT.control', 'PIN-TABLE control rename leg: an UNCLAIMED glob spelling (zglobcand) mounts normally through the SAME seam and reaches the mock — the refusal is claim-specific, not a names-config-wide outage',
        wok?.ok === true && (wok.placementLines ?? []).some((l) => l.includes(PIN_CONTROL)) && (wok.refuseLines ?? []).length === 0 && wok.discHits > 0,
        `placement=${JSON.stringify((wok?.placementLines ?? []).slice(0, 1)).slice(0, 240)} refuse=${String((wok?.refuseLines ?? []).length)} discHits=${String(wok?.discHits)}`)
    }
  } finally {
    try { await mock.close() } catch { /* gone */ }
  }

  // C teardown + hygiene
  try { rmSync(faceRef.mirror, { recursive: true, force: true }) } catch { /* best effort */ }
  const porcelainAfter = spawnSync('git', ['-C', TESTUSE, 'status', '--porcelain'], { encoding: 'utf8' }).stdout.trim()
  const stableAfter = await stableProbe()
  const left = existsSync(HOMES_ROOT) ? readdirSync(HOMES_ROOT).filter((n) => n.startsWith(`${WORLD_PREFIX}-`) && n.includes(RUN_STAMP)) : []
  const ranWorlds = LEGS.some((l) => l !== 'probe' && l !== 'bash-b2')
  check('C1', 'named teardown: every world this run created (exact names in sweep-list.json) is gone; launch-token residue 0 (probe-only runs create NO world: the INSTALLED world is kept for rollback-candidate.sh by design)',
    !ranWorlds || (left.length === 0 && worldSweptAll()), `left=${JSON.stringify(left)} swept=${JSON.stringify(worldsSwept.map((w) => `${w.mode}:${w.swept ? 'swept' : 'UNSWEPT'}`))} residue=${JSON.stringify(Object.values(worldResults).map((w) => w?.logTokenResidue ?? 'n/a'))}`)
  writeEvidence('sweep-list.json', { worlds: worldsSwept, policy: 'exact names only — NO glob deletes; the INSTALLED world stays until rollback-candidate.sh' })
  check('C2', 'the stable :3080 instance is untouched (read-only probe before/after) and the test-use host porcelain stayed 0',
    String(stableBefore) === String(stableAfter) && porcelainAfter === '', `${String(stableBefore)} -> ${String(stableAfter)}; porcelain=${porcelainAfter === '' ? 0 : 'DIRTY'}`)
} catch (error) {
  if (error?.__dryDone === true) {
    // dry-run completed: fall through to summary
  } else {
    exitCode = 1
    console.log(`FATAL — ${String(error?.message ?? error)}`)
    writeEvidence('fatal.json', { message: String(error?.message ?? error), stack: String(error?.stack ?? '').slice(0, 2000) })
  }
}
function worldSweptAll () {
  return worldsSwept.length > 0 && worldsSwept.every((w) => w.swept === true)
}
const pass = CRITERIA.filter((c) => c.pass === true).length
const fail = CRITERIA.filter((c) => c.pass === false).length
const book = CRITERIA.filter((c) => c.pass === null).length
writeEvidence('criteria.json', { runStamp: RUN_STAMP, candidateSha: CANDIDATE_SHA, legs: LEGS, dryRun: DRY, pass, fail, book, exitCode: fail > 0 ? 2 : exitCode, criteria: CRITERIA })
console.log(`SUMMARY pass=${String(pass)} fail=${String(fail)} booked=${String(book)}`)
const finalExit = fail > 0 ? 2 : exitCode
try { writeFileSync(join(EVIDENCE_DIR, 'KIT_EXIT'), String(finalExit) + '\n') } catch { /* dry-run may not create it */ }
process.exit(finalExit)
