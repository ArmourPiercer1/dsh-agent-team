#!/usr/bin/env node
/**
 * a5g7-live-kit.mjs — GLUE-7 LIVE assembly runner: the production Team row,
 * booted from the STRICT public install face (files:["dist"] + declared deps,
 * NOTHING backfilled — the face GLUE-6 made bootable), drives a REAL governed
 * Team on the pinned pristine host, and measures the effect face BEFORE and
 * AFTER the backend assembly rows.
 *
 * THREE WORLDS, ONE COMMIT (`018d40bf` plane rows), ONE RUN:
 *   preassembly  teamToolPlane = { realmId } ONLY — the pre-GLUE-7 posture:
 *                read lands the VERBATIM `cannot be verified at dispatch
 *                time (no fallback to the native body)` (int-a5b T5), and
 *                team_grep/team_bash land the VERBATIM IO_POLICY_UNSUPPORTED.
 *                Three RED-posture legs, captured live, on the wire.
 *   assembled    teamToolPlane = { realmId, fsInstance, confinedProvider } —
 *                the production assembly rows this round wires. THREE LIVE
 *                POSITIVES (real host, production backends, mock ONLY at the
 *                LLM position):
 *                  read  → real bytes of the governed file ride the wire;
 *                  grep  → the anchored REAL grep hits the token line;
 *                  bash  → REAL Landlock confined run: stdout token,
 *                          exit=0, a write INSIDE the governed root lands on
 *                          disk (fs-probed before sweep), and a read of a
 *                          file OUTSIDE every allowPath is refused BY THE
 *                          KERNEL inside the child (Permission denied, the
 *                          secret never appears on the wire).
 *                + the DENY negative, same round, production backends: the
 *                  bash-DENYING member's team_bash touch-<sentinel> answers
 *                  template-deny-lane BEFORE any backend — the sentinel is
 *                  fs-probed ABSENT (zero side effects on the fs).
 *   baseline     same artifact, NO teamToolPlane — control-of-controls: the
 *                governed plane mounts NOTHING (and the non-team preset
 *                sessions show registry Δ=[] ∧ wire Δ=[], zero team_* names).
 *
 * Honesty rules: criteria computed from LIVE wire captures + fs probes + the
 * redacted instance log at observation time; a missing leg FAILS; the launch
 * token is redacted at capture; the launcher byte-pin points at the SOURCE
 * TREE launcher — the one disclosed deployment input (tsc never emits .py,
 * so the launcher is not part of the published face; the assembly names it
 * explicitly and the provider double-gates every probe/exec on its bytes).
 *
 * EXIT: 0 all criteria pass (GREEN) · 2 a criterion failed (RED) · 1 fatal.
 */
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, writeFileSync, symlinkSync } from 'node:fs'
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
const TESTUSE_CANDIDATES = [
  argValue('testuse', ''),
  join(WORKTREE, 'tests', 'deepseek-harness-test-use'),
  '/srv/workspace/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use',
].filter((p) => p !== '' && existsSync(p))
const TESTUSE = resolve(TESTUSE_CANDIDATES[0] ?? '')
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const DEPS_CANDIDATES = [
  argValue('deps-src', ''),
  join(WORKTREE, 'packages', 'runtime', 'node_modules'),
  '/srv/workspace/dsh-plugins/dsh-agent-team/packages/runtime/node_modules',
].filter((p) => p !== '' && existsSync(p))
const DEPS_SRC = DEPS_CANDIDATES[0] ?? ''
const DEPS_STORE = resolve(argValue('deps-store', join(DEPS_SRC, '..', '..', '..', 'node_modules', '.pnpm')))
const EXP = resolve(argValue('expansion', join(WORKTREE, '..', '.a5g7-expansion', RUN_STAMP)))
const DIST_REL = join('packages', 'runtime', 'dist', 'packages', 'runtime')
const PRODUCTION_ROW_NAME = pathToFileURL(join(EXP, DIST_REL, 'src', 'plugin', 'host.js')).href
const OBSERVER_ROW_NAME = pathToFileURL(join(HERE, '..', 'install-entry', 'a5ie-observer-row.mjs')).href
const LAUNCHER = join(WORKTREE, 'packages', 'runtime', 'sandbox-provider', 'launcher', 'landlock-prelauncher.py')
const LAUNCHER_SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
const WORLD_PREFIX = 'a5g7'
const PRESET_ID = 'a5g7-base'
const MODES = ['assembled', 'preassembly', 'baseline']
const PRESETS = ['standard']
const ALIASES = ['team_grep', 'team_glob', 'team_bash']
const WATCH_NAMES = [...ALIASES, 'read']
const MANAGED_TOOL_NAMES = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh']
const SAFE_UNMANAGED_TOOL_NAMES = ['todo_write']
const ROOT = 'a5g7-root'
// The team's root session is its OWN session id (a5ie-proven pattern): the
// observer row binds ROOT to the ANCHOR blueprint, and team.create refuses a
// main blueprint on a root session whose bound TeamSession carries another
// (TEAM_REMOTE_TEAM_CREATE_BLUEPRINT_MISMATCH — measured on run-4).
const CREATE_ROOT = `session-a5g7-team-${RUN_STAMP}`
const BP_MAIN_ID = 'a5g7-main-bp'
const BP_ANCHOR_ID = 'a5g7-anchor-bp'
const TK_D1 = 'a5g7-tok-d1'
const TK_D2 = 'a5g7-tok-d2'

const CRITERIA = []
function check(id, claim, cond, observed) {
  CRITERIA.push({ id, claim, pass: cond === true, observed })
  console.log(`${cond === true ? 'PASS' : 'FAIL'} ${id} — ${claim}${observed === undefined ? '' : ` [${observed}]`}`)
}
const die = (msg) => { throw new Error(`FATAL: ${msg}`) }

function portFree(port) {
  return new Promise((res) => {
    const srv = netServer()
    srv.once('error', () => res(false))
    srv.once('listening', () => srv.close(() => res(true)))
    srv.listen(port, '127.0.0.1')
  })
}
async function portFreeWait(port, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    if (await portFree(port)) return true
    if (Date.now() >= deadline) return false
    await new Promise((r) => setTimeout(r, 500))
  }
}
async function waitQuiet(deadlineMs, fn) {
  const deadline = Date.now() + deadlineMs
  for (;;) {
    const v = await fn()
    if (v !== null && v !== undefined && v !== false) return v
    if (Date.now() >= deadline) return null
    await new Promise((r) => setTimeout(r, 400))
  }
}
async function waitForLogLine(logPath, regex, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    try { const m = regex.exec(readFileSync(logPath, 'utf8')); if (m !== null) return m[0] } catch { /* not yet */ }
    if (Date.now() >= deadline) return null
    await new Promise((r) => setTimeout(r, 400))
  }
}
function gitAt(dir, ...a) { return spawnSync('git', ['-C', dir, ...a], { encoding: 'utf8' }).stdout.trim() }
const sha256File = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
function walkFiles(dir, base = dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walkFiles(p, base, out)
    else out.push(relativeTo(base, p))
  }
  return out
}
function relativeTo(base, p) { return p.slice(base.length + 1) }
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
function writeEvidence(name, value) {
  writeFileSync(join(EVIDENCE_DIR, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n')
}
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/
async function waitFor(deadlineMs, fn, what) {
  const deadline = Date.now() + deadlineMs
  for (;;) {
    const v = await fn()
    if (v !== null && v !== undefined && v !== false) return v
    if (Date.now() >= deadline) die(`timeout waiting for ${what}`)
    await new Promise((r) => setTimeout(r, 250))
  }
}
async function fetchJson(url, init, timeoutMs = 30_000) {
  const res = await fetch(url, { ...(init ?? {}), signal: AbortSignal.timeout(timeoutMs) })
  const text = await res.text()
  try { return { status: res.status, body: JSON.parse(text) } } catch { return { status: res.status, body: text } }
}

// ═══════════════════════ STRICT INSTALL-FACE UNFOLDING (public manifest) ═════
function phaseE() {
  const facts = { runStamp: RUN_STAMP, head: gitAt(WORKTREE, 'rev-parse', 'HEAD'), exp: EXP, face: 'STRICT (files:["dist"] + declared deps; root acceptance: 严格发布清单新目录)' }
  if (existsSync(EXP)) rmSync(EXP, { recursive: true, force: true })
  mkdirSync(EXP, { recursive: true })
  const arch = spawnSync('git', ['-C', WORKTREE, 'archive', 'HEAD', '--', 'packages/runtime/dist', 'packages/runtime/package.json', '.agents/skills'], { maxBuffer: 512 * 1024 * 1024 })
  if (arch.status !== 0) die(`git archive failed: ${String(arch.stderr).slice(0, 200)}`)
  const tar = spawnSync('tar', ['-x', '-C', EXP], { input: arch.stdout })
  if (tar.status !== 0) die(`tar expand failed: ${String(tar.stderr).slice(0, 200)}`)
  const rel = walkFiles(EXP).sort()
  facts.fileCount = rel.length
  facts.a5p5Files = rel.filter((r) => r.replace(/\\/g, '/').includes('packages/tools/a5p5-tools/')).length
  facts.gluePlacements = ['agent-bindings.mjs', 'team-tool-plane.mjs', 'jobs-gateway-assembly.mjs', 'plane-effect-backends.mjs', join('..', 'upstream-resolver.mjs'), join('..', '..', 'root-binding', 'harness', 'seam.mjs')].map((n) => {
    const p = join(EXP, DIST_REL, 'src', 'plugin', 'live', n)
    return { file: n.replace(/\\/g, '/'), present: existsSync(p), sha256: existsSync(p) ? sha256File(p) : null }
  })
  facts.keyEntries = {
    host: existsSync(join(EXP, DIST_REL, 'src', 'plugin', 'host.js')),
    packageJson: existsSync(join(EXP, 'packages', 'runtime', 'package.json')),
    resolverInMirror: existsSync(join(EXP, DIST_REL, 'src', 'plugin', 'upstream-resolver.mjs')),
    seamInMirror: existsSync(join(EXP, DIST_REL, 'root-binding', 'harness', 'seam.mjs')),
    backendsRow: existsSync(join(EXP, DIST_REL, 'src', 'plugin', 'live', 'plane-effect-backends.mjs')),
  }
  facts.manifest = rel.map((r) => ({ path: r.replace(/\\/g, '/'), sha256: sha256File(join(EXP, r)) }))
  writeEvidence('expansion-manifest.json', { head: facts.head, face: facts.face, fileCount: facts.fileCount, gluePlacements: facts.gluePlacements, keyEntries: facts.keyEntries, manifest: facts.manifest })
  check('E1', 'STRICT public-manifest face: git archive HEAD of dist + package.json ONLY (GLUE-6 shipped the entry runtime .mjs INSIDE the mirror; the 4th glue placement plane-effect-backends.mjs present); nothing backfilled from the source tree',
    facts.keyEntries.host && facts.keyEntries.packageJson && facts.keyEntries.resolverInMirror && facts.keyEntries.seamInMirror && facts.keyEntries.backendsRow && facts.gluePlacements.slice(0, 4).every((g) => g.present),
    `files=${facts.fileCount} a5p5=${facts.a5p5Files} key=${JSON.stringify(facts.keyEntries)}`)
  const gate = spawnSync(process.execPath, [join(WORKTREE, 'scripts', 'check-artifacts-committed.mjs')], { cwd: WORKTREE, encoding: 'utf8', timeout: 180_000 })
  const gateOut = `${gate.stdout ?? ''}${gate.stderr ?? ''}`
  check('E2', 'the repo drift gate grades the committed dist at HEAD: exit 0 (this face is what the commit carries)',
    gate.status === 0, `status=${String(gate.status)}`)
  const nm = join(EXP, 'node_modules')
  mkdirSync(nm, { recursive: true })
  const pkgJson = JSON.parse(readFileSync(join(EXP, 'packages', 'runtime', 'package.json'), 'utf8'))
  const declared = ['dependencies', 'peerDependencies', 'optionalDependencies'].flatMap((k) => Object.keys(pkgJson[k] ?? {}))
  const storeDirs = existsSync(DEPS_STORE) ? readdirSync(DEPS_STORE) : []
  const findSource = (name) => {
    const direct = join(DEPS_SRC, ...name.split('/'))
    if (existsSync(direct)) return { dir: direct, from: 'runtime-node-modules' }
    const flat = name.replace('/', '+')
    const plain = name.startsWith('@') ? name.split('/')[1] ?? name : name
    const cands = storeDirs.filter((d) => d.startsWith(`${flat}@`) || d.startsWith(`${plain}@`) || d.includes(`+${plain}@`))
    const withInner = cands.find((d) => existsSync(join(DEPS_STORE, d, 'node_modules', name)))
    return withInner === undefined ? null : { dir: join(DEPS_STORE, withInner, 'node_modules', name), from: `pnpm-store:${withInner}` }
  }
  facts.closureMiss = null
  {
    const queue = [...declared]
    const OPTIONAL_ONLY = new Set(Object.keys(pkgJson.optionalDependencies ?? {}))
    const seen = new Set()
    for (let guard = 0; guard < 240 && queue.length > 0; guard += 1) {
      const name = queue.shift()
      if (seen.has(name)) continue
      seen.add(name)
      const src = findSource(name)
      if (src === null) {
        // an optionalDependency that this platform does not ship (e.g. a
        // darwin addon on linux) is NOT a face defect: skip it, like pnpm
        // does. A miss in dependencies/peerDependencies stays fatal.
        if (OPTIONAL_ONLY.has(name)) continue
        facts.closureMiss = `no source for ${name}`; break
      }
      const dst = join(nm, ...name.split('/'))
      mkdirSync(dirname(dst), { recursive: true })
      const cp = spawnSync('cp', ['-aL', src.dir, dst], { timeout: 120_000 })
      if (cp.status !== 0) { facts.closureMiss = `cp -aL ${name}`; break }
      const pjPath = join(dst, 'package.json')
      if (existsSync(pjPath)) {
        try {
          const pj = JSON.parse(readFileSync(pjPath, 'utf8'))
          for (const dep of Object.keys(pj.optionalDependencies ?? {})) OPTIONAL_ONLY.add(dep)
          for (const dep of Object.keys(pj.dependencies ?? {})) OPTIONAL_ONLY.delete(dep)
          for (const dep of Object.keys(pj.peerDependencies ?? {})) OPTIONAL_ONLY.delete(dep)
          for (const key of ['dependencies', 'peerDependencies', 'optionalDependencies']) for (const dep of Object.keys(pj[key] ?? {})) if (!seen.has(dep)) queue.push(dep)
        } catch { /* loud via probe */ }
      }
    }
  }
  const probeRows = [
    join(EXP, DIST_REL, 'src', 'plugin', 'live', 'team-tool-plane.mjs'),
    join(EXP, DIST_REL, 'src', 'plugin', 'live', 'plane-effect-backends.mjs'),
    join(EXP, DIST_REL, 'src', 'plugin', 'live', 'agent-bindings.mjs'),
    join(EXP, DIST_REL, 'src', 'plugin', 'host.js'),
  ]
  let probeOk = false
  facts.probeOut = null
  for (let attempt = 0; attempt < 32 && !probeOk; attempt += 1) {
    const probe = spawnSync(process.execPath, ['-e', `
const rows = ${JSON.stringify(probeRows.map((p) => pathToFileURL(p).href))}
const missing = []
let hard = null
for (const r of rows) {
  try { await import(r) } catch (error) {
    const m = /Cannot find (?:package|module) '([^']+)'/.exec(String(error?.message ?? error))
    if (m !== null) { const pkg = m[1].startsWith('@') ? m[1].split('/').slice(0, 2).join('/') : m[1].split('/')[0]; if (!missing.includes(pkg)) missing.push(pkg); continue }
    hard = String(error?.message ?? error).slice(0, 300); break
  }
}
if (hard !== null) { console.log('HARD ' + hard); process.exit(2) }
if (missing.length > 0) { console.log('MISSING ' + missing.join(',')); process.exit(3) }
console.log('OK')
`], { encoding: 'utf8', timeout: 120_000 })
    const out = `${probe.stdout ?? ''}`.trim()
    facts.probeOut = out.slice(0, 300)
    if (out.startsWith('OK')) { probeOk = true; break }
    if (!out.startsWith('MISSING')) break
    for (const miss of out.slice(8).split(',').filter((s) => s !== '')) {
      const src = findSource(miss)
      if (src === null) { probeOk = false; facts.closureMiss = `probe: no source for ${miss}`; break }
      const dst = join(nm, ...miss.split('/'))
      mkdirSync(dirname(dst), { recursive: true })
      spawnSync('cp', ['-aL', src.dir, dst], { timeout: 120_000 })
    }
  }
  check('E3', 'the STRICT face + declared dependency closure imports the production rows clean (plane row, GLUE-7 backends row, bindings row, host entry) — the shipped face carries its own runtime',
    probeOk && facts.closureMiss === null, `probe=${facts.probeOut ?? 'n/a'} miss=${facts.closureMiss ?? 'none'}`)
  return facts
}

// ═══════════════════════════ BLUEPRINTS ═══════════════════════════════════
function yamlScalar(value) {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (/^[A-Za-z0-9_./-]+$/.test(String(value))) return String(value)
  return JSON.stringify(String(value))
}
function yamlEmit(key, value, indent) {
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
function yamlEmitItem(item, indent) {
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
  'leader:', '  templateId: leader',
  '  persona: "You are the leader of the a5g7 assembly team."',
  'members:', '  - templateId: wa', '    persona: "You are a worker of the a5g7 assembly team."',
  'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
  'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
].join('\n')

/**
 * The governed blueprint: member `wa` (ask-default, read allowed, NO bash rule
 * — the shell reaches the backend through the ASK default exactly as shipped
 * governed worlds do) and member `wd` (bash DENIED by rule — the deny
 * negative). Leader scripts two sync delegations, one per member template.
 */
function mainBlueprintYaml(denyList, mkTaskA, mkTaskD, governedRoot, outsideSecret, sentinelPath, mode) {
  const denyBlock = (pad) => denyList.length === 0 ? [`${pad}builtinToolDeny: []`] : [`${pad}builtinToolDeny:`, ...denyList.map((n) => `${pad}  - ${n}`)]
  const assembled = mode === 'assembled'
  const readArgs = assembled ? `{"path":"notes.txt"}` : `{"file_path":${JSON.stringify(join(governedRoot, 'notes.txt'))}}`
  const taskA = assembled
    ? `${mkTaskA} Work EXACTLY in this order: (1) call the tool read with arguments ${readArgs}; (2) call team_grep with {"pattern":"A5G7-GREP-TOK","path":".","output_mode":"content"}; (3) call team_bash with {"command":"echo A5G7-BASH-TOK; echo A5G7-WROTE-9 > ./bash-wrote.txt; cat ./bash-wrote.txt"}; (4) call team_bash with {"command":"cat ../outside/secret.txt"}; (5) finish with ONE line starting A5G7_MEMBER_RESULT quoting each of the four tool results you received.`
    : `${mkTaskA} Work EXACTLY in this order: (1) call the tool read with arguments ${readArgs}; (2) call team_grep with {"pattern":"A5G7","path":".","output_mode":"content"}; (3) call team_bash with {"command":"echo a5g7"}; (4) finish with ONE line starting A5G7_MEMBER_RESULT quoting each of the three tool results you received.`
  // The sentinel is touched RELATIVE (the confined cwd IS the governed root),
  // so the scripted call needs no world paths at all; the fs probe checks the
  // absolute location (${''}sentinelPath is kept only for the evidence field).
  const taskD = `${mkTaskD} Work EXACTLY in this order: (1) call the tool team_bash with arguments {"command":"touch ./sentinel-wd-must-not-exist"}; (2) finish with ONE line starting A5G7_DENY_RESULT quoting the tool result you received.`
  void sentinelPath
  const leaderPersona = `You are the leader of the a5g7 assembly team. On your directive: FIRST call team_delegate exactly once with rootSessionId ${CREATE_ROOT}, requestToken ${TK_D1}, delegationTemplateId "wa", label "g7-a", async false, and the prompt ${JSON.stringify(taskA)}; SECOND call team_collect with rootSessionId ${CREATE_ROOT} and requestTokens ["${TK_D1}"]; THIRD call team_delegate exactly once with rootSessionId ${CREATE_ROOT}, requestToken ${TK_D2}, delegationTemplateId "wd", label "g7-d", async false, and the prompt ${JSON.stringify(taskD)}; FOURTH call team_collect with rootSessionId ${CREATE_ROOT} and requestTokens ["${TK_D2}"]; FIFTH finish with one line starting A5G7_LEADER_DONE.`
  const benign = 'You are the leader of the a5g7 assembly team. Your only directive is to reply with the single word OK. Do not call any tool.'
  return [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
    'displayName: "a5g7 GLUE-7 assembly team"',
    'description: "GLUE-7: real effect backends (confined-exec shell, anchored grep, governed read) on the production plane mount, driven through the strict install face."',
    'leader:', '  templateId: leader',
    `  persona: ${JSON.stringify(mode === 'baseline' ? benign : leaderPersona)}`,
    '  capabilities:', '    teamTools:', '      kind: allow', '      items:', '        - team_delegate', '        - team_collect',
    ...denyBlock('    '),
    '    skills:', '      kind: allow', '      items: []',
    '    mcp:', '      kind: allow', '      items: []',
    '    permissions:', '      default: ask', '      allow: []', '      ask: []', '      deny: []',
    'teamEnvelope:', '  allow:', '    - assign-task', '    - create-member', '    - send-message', '    - report-progress', '  deny: []',
    'members:',
    '  - templateId: wa', '    displayName: "a5g7 worker A (ask-default shell)"',
    `    persona: ${JSON.stringify('You are worker A of the a5g7 assembly team. Follow delegated work exactly, tool by tool, in order.')}`,
    '    capabilities:', '      teamTools:', '        kind: allow', '        items: []',
    ...denyBlock('      '),
    '      skills:', '        kind: allow', '        items: []',
    '      mcp:', '        kind: allow', '        items: []',
    '      permissions:', '        default: ask',
    '        allow:', '          - tool: read', '            resource:', '              kind: any',
    '        ask: []', '        deny: []',
    '  - templateId: wd', '    displayName: "a5g7 worker D (bash denied)"',
    `    persona: ${JSON.stringify('You are worker D of the a5g7 assembly team. Follow delegated work exactly, tool by tool, in order.')}`,
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

function rowConfig(mode, blueprintDir, world) {
  const cfg = {
    rootSessionId: ROOT,
    bootPhase: 'create',
    blueprintSource: ANCHOR_YAML,
    blueprintDir,
    rootPresetId: PRESET_ID,
    memberPresetId: PRESET_ID,
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'a5g7-model' },
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
  if (mode === 'preassembly') cfg.teamToolPlane = { realmId: `a5g7-realm-${mode}` }
  if (mode === 'assembled') {
    cfg.teamToolPlane = {
      realmId: 'a5g7-realm',
      fsInstance: { fs: 'a5g7-ctl', rootDir: world.governedRoot, realmId: 'a5g7-realm', kind: 'absolute-path' },
      confinedProvider: {
        trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
        assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
      },
    }
  }
  return cfg
}

// ═══════════════════════════ WORLD DRIVER ═══════════════════════════════════
function digestRequest(parsed) {
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
  return {
    msgCount: msgs.length,
    toolCount: toolNames === null ? 0 : toolNames.length,
    toolNames,
    assistantToolNames,
    toolResults,
    lastUserHead,
    systemHead: sys.slice(0, 260),
    markerHits: [],
    _text: text,
  }
}

async function runWorld({ mode, mock, MK, blueprintBaseDir, markers, stormLimit }) {
  const HOME = homeDir(WORKTREE, `${WORLD_PREFIX}-${mode}-${RUN_STAMP}`)
  const BLUEPRINT_DIR = join(blueprintBaseDir, mode)
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  const INSTANCE_RAW = join(EVIDENCE_DIR, `instance-${mode}.raw.log`)
  const INSTANCE_LOG = join(EVIDENCE_DIR, `instance-${mode}.log`)
  const world = {
    governedRoot: join(HOME, 'workspace', 'governed'),
    outsideSecret: join(HOME, 'workspace', 'outside', 'secret.txt'),
    sentinel: join(HOME, 'workspace', 'governed', 'sentinel-wd-must-not-exist'),
  }
  const facts = { mode, home: HOME, ok: false, face: 'strict (files:["dist"] + declared deps)' }
  let host = null
  let hostExit = null
  let reqBase = 0
  const port = mode === 'baseline' ? BASELINE_PORT : HOST_PORT
  try {
    if (!(await portFreeWait(port))) die(`port ${port} not free before ${mode} world`)
    mkdirSync(join(HOME, 'workspace'), { recursive: true })
    mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
    mkdirSync(world.governedRoot, { recursive: true })
    mkdirSync(join(HOME, 'workspace', 'outside'), { recursive: true })
    writeFileSync(join(world.governedRoot, 'notes.txt'), `line one\nA5G7-READ-TOKEN-77\nline three\nA5G7-GREP-TOK lives here\n`)
    writeFileSync(world.outsideSecret, `A5G7-OUTSIDE-SECRET-42\n`)
    const MK_DISC = `${MK}_${mode.toUpperCase()}_DISC`
    const MK_L0 = `${MK}_${mode.toUpperCase()}_L0`
    const MK_A = `${MK}_${mode.toUpperCase()}_TASK_A`
    const MK_D = `${MK}_${mode.toUpperCase()}_TASK_D`
    const basePlugins = smokePresetPlugins({
      personaText: 'You are a coding agent powered by the {{model}} model.',
      cwdSuffix: 'Your working directory is {{cwd}}.',
      bashDescription: 'Run commands in a bash shell. State is persistent across calls.',
    })
    const lines = [
      `# a5g7 GLUE-7 live patch (run ${RUN_STAMP}, mode ${mode}): STRICT install artifact (EXP: ${EXP}) + observer row + preset — public profile-patch seam only.`,
      '- insert:',
      ...yamlEmitItem({ id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: rowConfig(mode, BLUEPRINT_DIR, world) }, 2),
      ...yamlEmitItem({ id: 'a5g7-observer', name: OBSERVER_ROW_NAME, config: {} }, 2),
      ...yamlEmitItem(presetDeclarationRow({
        id: PRESET_ID, displayName: 'a5g7 base',
        description: `a5g7 base preset (run ${RUN_STAMP}) = smoke preset`,
        plugins: basePlugins,
      }), 2),
      '',
    ]
    writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), lines.join('\n'))

    const reqBaseNow = mock.requests.length
    reqBase = reqBaseNow
    const stormCheck = (where) => {
      const mine = mock.requests.length - reqBaseNow
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
        DEEPSEEK_API_KEY: 'a5g7-mock-key',
      },
    })
    host.on('exit', (code, signal) => { hostExit = { code, signal }; console.log(`[${mode}] host exited code=${String(code)} signal=${String(signal)}`) })
    const boot = await waitFor(150_000, () => {
      try { const m = BOOT_MARKER.exec(readFileSync(INSTANCE_RAW, 'utf8')); return m === null ? false : m } catch { return false }
    }, `${mode} boot marker`)
    facts.bootLine = redact(String(boot[0])).slice(0, 200)
    const origin = `http://127.0.0.1:${boot[1]}`
    const auth = await fetch(`${origin}/?token=${boot[2]}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
    const cookie = auth.headers.get('set-cookie')
    if (!(auth.status === 303 && cookie !== null)) die(`${mode} token gate ${String(auth.status)}`)
    await waitFor(30_000, async () => {
      const h = await fetchJson(`${origin}/__a5ie/health`).catch(() => null)
      return h?.status === 200 && h.body?.applied === true ? h : false
    }, `${mode} observer applied`)
    stormCheck('post-boot (NO prompt sent yet)')

    const wireHit = (needle) => (mock.requests ?? []).find((r) => r.digest !== undefined && r.digest.markerHits.includes(needle) && r.digest.toolCount > 0)
    async function promptBarrier({ sessionId, textBase, rpcTag, attempts = 10, perAttemptMs = 25_000 }) {
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

    const disc = await promptBarrier({ sessionId: ROOT, textBase: MK_DISC, rpcTag: `a5g7-${mode}-d` })
    facts.discPrompt = { attempts: disc.attempts, status: disc.lastStatus }
    const surface = [...new Set(disc.hit.digest.toolNames ?? [])].sort()
    const denyList = surface.filter((n) => !n.startsWith('team_') && !MANAGED_TOOL_NAMES.includes(n) && !SAFE_UNMANAGED_TOOL_NAMES.includes(n))
    facts.discoverySurface = surface
    facts.denyList = denyList
    writeFileSync(join(BLUEPRINT_DIR, 'main.yaml'), mainBlueprintYaml(denyList, MK_A, MK_D, world.governedRoot, world.outsideSecret, world.sentinel, mode))

    const cl = await fetchJson(`${origin}/team-remote/catalog.list`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
      body: JSON.stringify({ type: 'client-request', rpcId: 'a5g7-pre-1', method: 'catalog.list', payload: { version: 4, params: {} } }),
    }, 30_000)
    const listed = JSON.stringify(cl.body ?? '').includes(BP_MAIN_ID)
    const cg = await fetchJson(`${origin}/team-remote/catalog.get`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
      body: JSON.stringify({ type: 'client-request', rpcId: 'a5g7-pre-2', method: 'catalog.get', payload: { version: 4, params: { blueprintId: BP_MAIN_ID, blueprintRevision: 1 } } }),
    }, 30_000)
    facts.catalogPreflight = { listStatus: cl.status, listed, getStatus: cg.status }
    facts.catalogPreflightOk = listed && cg.status === 200

    const created = await fetchJson(`${origin}/team-remote/team.create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
      body: JSON.stringify({ type: 'client-request', rpcId: `a5g7-${mode}-tc`, method: 'team.create', payload: { version: 1, params: { rootSessionId: CREATE_ROOT, blueprintId: BP_MAIN_ID, initialWork: { prompt: `${MK_L0} Begin your directive.` } } } }),
    }, 90_000)
    facts.teamCreate = { status: created.status, body: redact(JSON.stringify(created.body ?? null)).slice(0, 1200) }

    await waitFor(180_000, async () => { const hit = wireHit(MK_L0); return hit ?? false }, `${mode} leader turn at the mock`)
    if (mode === 'baseline') {
      const reqs = (mock.requests ?? []).filter((r) => r.digest?.markerHits.includes(MK_L0) && r.digest.toolCount > 0)
      facts.leaderWireCatalog = reqs[0]?.digest.toolNames ?? null
    } else {
      const chain = await waitFor(420_000, async () => {
        stormCheck('leader chain')
        const reqs = (mock.requests ?? []).filter((r) => r.digest?.markerHits.includes(MK_L0) && r.digest.toolCount > 0)
        if (reqs.length === 0) return false
        const doneReplied = reqs.some((r) => JSON.stringify(r.reply ?? '').includes('A5G7_LEADER_DONE'))
        if (!doneReplied) return false
        const last = reqs[reqs.length - 1]
        return { toolCalls: last.digest.assistantToolNames, backToLeader: last.digest._text.includes('A5G7_MEMBER_RESULT') && last.digest._text.includes('A5G7_DENY_RESULT') }
      }, `${mode} leader chain (two delegations + collects + final)`)
      facts.leaderToolCalls = chain.toolCalls
      facts.memberResultsBackToLeader = chain.backToLeader
      facts.leaderFinalSeen = true
      const memberAReqs = (mock.requests ?? []).filter((r) => r.digest?.markerHits.includes(MK_A) && !r.digest.markerHits.includes(MK_L0) && r.digest.toolCount > 0)
      const memberDReqs = (mock.requests ?? []).filter((r) => r.digest?.markerHits.includes(MK_D) && !r.digest.markerHits.includes(MK_L0) && r.digest.toolCount > 0)
      facts.memberARequestCount = memberAReqs.length
      facts.memberDRequestCount = memberDReqs.length
      facts.memberAWireCatalog = memberAReqs[0]?.digest.toolNames ?? null
      const l0reqs = (mock.requests ?? []).filter((r) => r.digest?.markerHits.includes(MK_L0) && r.digest.toolCount > 0)
      facts.leaderWireCatalog = l0reqs[0]?.digest.toolNames ?? null
      const lastA = memberAReqs[memberAReqs.length - 1]
      facts.memberAToolResults = lastA?.digest.toolResults ?? []
      facts.memberAFinal = (memberAReqs.find((r) => JSON.stringify(r.reply ?? '').includes('A5G7_MEMBER_RESULT'))?.reply ?? null)
      const lastD = memberDReqs[memberDReqs.length - 1]
      facts.memberDToolResults = lastD?.digest.toolResults ?? []
      facts.memberDFinal = (memberDReqs.find((r) => JSON.stringify(r.reply ?? '').includes('A5G7_DENY_RESULT'))?.reply ?? null)
      facts.sentinelExists = existsSync(world.sentinel)
      facts.bashWroteExists = existsSync(join(world.governedRoot, 'bash-wrote.txt'))
    }
    for (const preset of PRESETS) {
      const MKP = `${MK}_${mode.toUpperCase()}_${preset.toUpperCase()}_SETUP`
      const c = await fetchJson(`${origin}/api/session/create`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
        body: JSON.stringify({ type: 'client-request', rpcId: `a5g7-${mode}-${preset}-c`, method: 'session/create', payload: { args: { request: { agentPreset: preset } } } }),
      }, 60_000)
      const sessionId = c.body?.result?.value?.sessionId ?? c.body?.value?.sessionId ?? null
      facts[preset] = { sessionId, createStatus: c.status }
      if (typeof sessionId !== 'string' || sessionId === '') { facts[preset].failed = true; continue }
      const presHit = await promptBarrier({ sessionId, textBase: MKP, rpcTag: `a5g7-${mode}-${preset}-p`, attempts: 10 })
      facts[preset].promptAttempts = presHit.attempts
      facts[preset].wireCatalog = [...new Set(presHit.hit.digest.toolNames ?? [])].sort()
    }

    const observed = await waitFor(120_000, async () => {
      const f = await fetchJson(`${origin}/__a5ie/facts?names=${encodeURIComponent(WATCH_NAMES.join(','))}&roots=${encodeURIComponent(CREATE_ROOT)}`).catch(() => null)
      if (f?.status !== 200) return false
      const live = (f.body.agents ?? []).filter((a) => Array.isArray(a.scopedNames))
      return live.length >= PRESETS.length ? f.body : false
    }, `${mode} observer facts`)
    facts.globalNames = observed.globalNames
    facts.planeObservations = observed.planeObservations
    facts.ownLayerCarrierCount = (observed.agents ?? []).filter((a) => ALIASES.every((n) => a.perName?.[n]?.scopedPresent === true && a.perName?.[n]?.globalPresent === false)).length
    const byId = {}
    for (const a of observed.agents ?? []) byId[a.session] = a
    facts.leader = byId[CREATE_ROOT] ?? null
    for (const preset of PRESETS) {
      const sid = facts[preset]?.sessionId
      facts[preset].scopedNames = byId[sid]?.scopedNames ?? null
    }
    facts.sessions = await waitFor(120_000, async () => {
      const sl = await fetchJson(`${origin}/api/session/list`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' }, body: JSON.stringify({ type: 'client-request', rpcId: 'a5g7-sessions', method: 'session/list', payload: { args: { _request: {} } } }) }, 15_000)
      const items = sl.body?.result?.value?.items ?? []
      return items.length > 0 && items.every((i) => i.running !== true) ? items.map((i) => ({ s: String(i.sessionId ?? '').slice(-14), run: i.running === true })) : false
    }, `${mode} all sessions quiet`).catch(() => null)
    facts.ok = true
    return facts
  } finally {
    writeEvidence(`world-${mode}.partial.json`, facts)
    try { if (host !== null) host.kill() } catch { /* gone */ }
    await new Promise((r) => setTimeout(r, 3000))
    facts.hostExit = hostExit
    try {
      const lines = mock.requests.slice(reqBase).map((r) => JSON.stringify({
        seq: r.seq, path: r.path, status: r.status, reply: r.reply === undefined ? null : redact(JSON.stringify(r.reply)).slice(0, 300),
        digest: r.digest === undefined ? null : { ...r.digest, markerHits: r.digest.markerHits.filter((x) => x.startsWith('A5G7')), systemHead: redact(r.digest.systemHead), lastUserHead: redact(r.digest.lastUserHead), toolResults: r.digest.toolResults.map((x) => redact(x)), _text: `${r.digest._text.length} chars` },
      }))
      writeFileSync(join(EVIDENCE_DIR, `wire-digests-${mode}.jsonl`), lines.join('\n') + '\n')
    } catch { /* best effort */ }
    try {
      const raw = readFileSync(INSTANCE_RAW, 'utf8')
      facts.logObservations = raw.split('\n').filter((l) => /a5g7|a5-plane|confined-shell|governed-read|anchored-search|placement-feed/.test(l)).slice(0, 80).map((l) => redact(l).slice(0, 260))
      facts.hostErrors = raw.split('\n').filter((l) => /ERR_MODULE_NOT_FOUND|bootstrap FAILED|TRUST_ROOT|placement-REFUSED|mount-REFUSED|guard-refusal|BINDING_UNVERIFIED/i.test(l)).slice(0, 20).map((l) => redact(l).slice(0, 260))
      writeFileSync(INSTANCE_LOG, redact(raw))
      rmSync(INSTANCE_RAW)
    } catch { /* no log */ }
    if (!KEEP) { try { rmSync(HOME, { recursive: true, force: true }) } catch { /* best effort */ } }
    facts.swept = !existsSync(HOME)
  }
}

// ═══════════════════════════ MAIN ═══════════════════════════════════════════
const rnd = () => Math.random().toString(36).slice(2, 10)
const toolCall = (id, name, argsObj) => ({ kind: 'tool-call', toolCalls: [{ id, name, arguments: argsObj }] })
const IO_TEXT = 'IO_POLICY_UNSUPPORTED'
const BIND_TEXT = 'cannot be verified at dispatch time (no fallback to the native body)'

async function main() {
  // START SWEEP (disclosed): a previous invocation killed mid-run leaves its
  // own-name world/expansion behind; C1 grades the FINAL state, so leftovers
  // from OUR OWN earlier runs (never anything else's) are swept before the
  // round starts, with the list logged into the run evidence.
  {
    const homesRootS = join(WORKTREE, 'tests', 'homes')
    const stale = existsSync(homesRootS) ? readdirSync(homesRootS).filter((d) => d.startsWith('a5g7-')) : []
    for (const d of stale) { try { rmSync(join(homesRootS, d), { recursive: true, force: true }) } catch { /* best effort */ } }
    const expParent = join(WORKTREE, '..', '.a5g7-expansion')
    const staleExp = existsSync(expParent) ? readdirSync(expParent) : []
    for (const d of staleExp) { try { rmSync(join(expParent, d), { recursive: true, force: true }) } catch { /* best effort */ } }
    writeEvidence('start-sweep.json', { staleHomes: stale, staleExpansions: staleExp })
  }
  console.log(`a5g7 live runner stamp=${RUN_STAMP} ports=${HOST_PORT}/${BASELINE_PORT} exp=${EXP}`)
  const head = gitAt(TESTUSE, 'rev-parse', 'HEAD')
  const porcelainBefore = gitAt(TESTUSE, 'status', '--porcelain')
  check('H1', `the test-use host is the pinned pristine 0.2.0-rc.2 runtime @${TEST_USE_BASELINE_SHA.slice(0, 10)}, porcelain clean before`,
    head === TEST_USE_BASELINE_SHA && porcelainBefore === '', `head=${head.slice(0, 10)} porcelain=${porcelainBefore === '' ? 0 : 'DIRTY'}`)
  let mockPort = 0
  for (const p of [3491, 3492, 3493, 3494, 3495]) { if (await portFree(p)) { mockPort = p; break } }
  check('H2', `ports ${HOST_PORT} AND ${BASELINE_PORT} self-proved free before the run + a mock port from the 349x family free`, (await portFree(HOST_PORT)) && (await portFree(BASELINE_PORT)) && mockPort > 0, `mock=${mockPort}`)
  const stableBefore = await stableProbe()
  check('H0', 'the stable :3080 instance answers read-only before this run (probe only, never touched)', stableBefore !== 'unreachable', `status=${String(stableBefore)}`)

  const eFacts = phaseE()

  const MK = `A5G7_${RUN_STAMP.replace(/[^A-Za-z0-9]/g, '')}`
  const markers = []
  for (const mode of MODES) {
    const MU = mode.toUpperCase()
    markers.push(`${MK}_${MU}_DISC`, `${MK}_${MU}_L0`)
    if (mode !== 'baseline') markers.push(`${MK}_${MU}_TASK_A`, `${MK}_${MU}_TASK_D`)
    for (const preset of PRESETS) markers.push(`${MK}_${MU}_${preset.toUpperCase()}_SETUP`)
  }
  markers.push('A5G7_MEMBER_RESULT', 'A5G7_DENY_RESULT', 'A5G7_LEADER_DONE')

  const mock = await startMockModel({
    port: mockPort,
    log: () => {},
    decide: ({ req }) => {
      main.mockReqs = (main.mockReqs ?? 0) + 1
      const digest = digestRequest(req)
      digest.markerHits = markers.filter((mk) => digest._text.includes(mk))
      const rec = mock.requests[mock.requests.length - 1]
      if (rec !== undefined) {
        rec.digest = digest
        if (rec.seq > 6 && mock.requests[rec.seq - 6]?.body !== null) {
          const old = mock.requests[rec.seq - 6]
          if (old !== undefined && old.body !== null) old.body = { __pruned: true, msgCount: old.digest?.msgCount, toolCount: old.digest?.toolCount }
        }
      }
      const text = digest._text
      for (const mode of MODES) {
        const MU = mode.toUpperCase()
        if (text.includes(`${MK}_${MU}_DISC`)) return { kind: 'text', content: 'A5G7_DISC_OK' }
        for (const preset of PRESETS) {
          if (text.includes(`${MK}_${MU}_${preset.toUpperCase()}_SETUP`)) return { kind: 'text', content: 'A5G7_PRESET_OK' }
        }
        if (mode !== 'baseline' && text.includes(`${MK}_${MU}_L0`)) {
          const calls = digest.assistantToolNames
          if (calls.length === 0) return toolCall(`call-g7-delegate-a-${rnd()}`, 'team_delegate', {
            rootSessionId: CREATE_ROOT, requestToken: TK_D1, delegationTemplateId: 'wa', label: 'g7-a',
            taskSummary: 'GLUE-7 live effect legs (member A)',
            prompt: `${MK}_${MU}_TASK_A Do the delegated work exactly as instructed.`, async: false,
          })
          if (calls.length === 1) return toolCall(`call-g7-collect-a-${rnd()}`, 'team_collect', { rootSessionId: CREATE_ROOT, requestToken: `a5g7-collect-a-${RUN_STAMP}`, requestTokens: [TK_D1] })
          if (calls.length === 2) return toolCall(`call-g7-delegate-d-${rnd()}`, 'team_delegate', {
            rootSessionId: CREATE_ROOT, requestToken: TK_D2, delegationTemplateId: 'wd', label: 'g7-d',
            taskSummary: 'GLUE-7 deny negative (member D)',
            prompt: `${MK}_${MU}_TASK_D Do the delegated work exactly as instructed.`, async: false,
          })
          if (calls.length === 3) return toolCall(`call-g7-collect-d-${rnd()}`, 'team_collect', { rootSessionId: CREATE_ROOT, requestToken: `a5g7-collect-d-${RUN_STAMP}`, requestTokens: [TK_D2] })
          return { kind: 'text', content: 'A5G7_LEADER_DONE' }
        }
        if (mode !== 'baseline' && text.includes(`${MK}_${MU}_TASK_A`)) {
          const calls = digest.assistantToolNames
          if (calls.length === 0) return toolCall(`call-g7-read-${rnd()}`, 'read', { file_path: 'notes.txt' })
          if (calls.length === 1) return toolCall(`call-g7-grep-${rnd()}`, 'team_grep', { pattern: mode === 'assembled' ? 'A5G7-GREP-TOK' : 'A5G7', path: '.', output_mode: 'content' })
          if (calls.length === 2) return toolCall(`call-g7-bash-${rnd()}`, 'team_bash', { command: mode === 'assembled' ? 'echo A5G7-BASH-TOK; echo A5G7-WROTE-9 > ./bash-wrote.txt; cat ./bash-wrote.txt' : 'echo a5g7' })
          if (calls.length === 3 && mode === 'assembled') return toolCall(`call-g7-cat-${rnd()}`, 'team_bash', { command: 'cat ../outside/secret.txt' })
          if (calls.length === 4 && mode === 'assembled') return toolCall(`call-g7-glob-${rnd()}`, 'team_glob', { pattern: '*' })
          const results = digest.toolResults
          const quote = results.map((r, i) => `r${i}=${r.slice(0, 140).replace(/\s+/g, ' ')}`).join(' | ')
          return { kind: 'text', content: `A5G7_MEMBER_RESULT ${quote}` }
        }
        if (mode !== 'baseline' && text.includes(`${MK}_${MU}_TASK_D`)) {
          const calls = digest.assistantToolNames
          if (calls.length === 0) return toolCall(`call-g7-dbash-${rnd()}`, 'team_bash', { command: 'touch SENTINEL_PLACEHOLDER' })
          const results = digest.toolResults
          return { kind: 'text', content: `A5G7_DENY_RESULT ${String(results[0] ?? '').slice(0, 200).replace(/\s+/g, ' ')}` }
        }
        if (text.includes(`${MK}_${MU}_L0`)) return { kind: 'text', content: 'A5G7_L0_OK' }
      }
      return { kind: 'text', content: 'a5g7-mock: unscripted request, completing quietly.' }
    },
  })

  const worlds = {}
  try {
    for (const mode of MODES) worlds[mode] = await runWorld({ mode, mock, MK, blueprintBaseDir: join(EVIDENCE_DIR, 'blueprints'), markers, stormLimit: Number(argValue('storm-limit', 300)) })
  } finally {
    try { await mock.close() } catch { /* gone */ }
  }
  const porcelainAfter = gitAt(TESTUSE, 'status', '--porcelain')
  const stableAfter = await stableProbe()
  check('H3', ':3080 stable instance untouched (read-only probe before/after) and the test-use host porcelain 0 after',
    String(stableBefore) === String(stableAfter) && porcelainAfter === '', `${String(stableBefore)} -> ${String(stableAfter)}; porcelain=${porcelainAfter === '' ? 0 : 'DIRTY'}`)

  for (const mode of MODES) writeEvidence(`world-${mode}.json`, worlds[mode] ?? { missing: true })
  check('W1', 'all worlds booted from the STRICT face row name and swept', MODES.every((m) => worlds[m]?.ok === true), MODES.map((m) => `${m}:${worlds[m]?.ok === true ? 'ok' : 'FAIL'}${worlds[m]?.swept ? '/swept' : '/UNSWEPT'}`).join(' '))

  const a = worlds.assembled ?? {}
  const p = worlds.preassembly ?? {}
  const b = worlds.baseline ?? {}
  const aResults = a.memberAToolResults ?? []
  const dResults = a.memberDToolResults ?? []
  const pResults = p.memberAToolResults ?? []

  // ① RED posture of the PRE-assembly production row (verbatim pins, live):
  check('P1', 'RED POSTURE (pre-assembly row, teamToolPlane WITHOUT fsInstance/confinedProvider): the member read dispatch answers the VERBATIM int-a5b T5 refusal — no fallback to the native body',
    pResults[0]?.includes(BIND_TEXT) === true, `r0=${JSON.stringify(pResults[0] ?? '').slice(0, 200)}`)
  check('P2', 'RED POSTURE: team_grep lands the VERBATIM IO_POLICY_UNSUPPORTED typed shut face (a landing, never a capability)',
    pResults[1]?.includes(IO_TEXT) === true, `r1=${JSON.stringify(pResults[1] ?? '').slice(0, 160)}`)
  check('P3', 'RED POSTURE: team_bash lands the VERBATIM IO_POLICY_UNSUPPORTED (the same typed shut for the shell class)',
    pResults[2]?.includes(IO_TEXT) === true, `r2=${JSON.stringify(pResults[2] ?? '').slice(0, 160)}`)

  // ② THREE LIVE POSITIVES on the assembled production row (real host):
  check('L1', 'POSITIVE 1 (read): the takeover-placed governed read RAN through the production mount — the member tool result carries the REAL governed file bytes (A5G7-READ-TOKEN-77) over the wire; the int-a5b T5 refusal is GONE on this row',
    aResults[0]?.includes('A5G7-READ-TOKEN-77') === true && !(aResults[0] ?? '').includes(BIND_TEXT), `r0=${JSON.stringify(aResults[0] ?? '').slice(0, 200)}`)
  check('L2', 'POSITIVE 2 (search): team_grep ran the REAL anchored read-only search — the hit line with the token rides the wire result (grep:file:line form), no IO_POLICY anywhere near it',
    aResults[1]?.includes('A5G7-GREP-TOK') === true && !(aResults[1] ?? '').includes(IO_TEXT), `r1=${JSON.stringify(aResults[1] ?? '').slice(0, 200)}`)
  check('L3', 'POSITIVE 3 (shell, REAL Landlock): team_bash RAN CONFINED — the echo token + exit=0 render AND a write inside the governed root landed on disk (fs-probed pre-sweep bash-wrote.txt)',
    aResults[2]?.includes('A5G7-BASH-TOK') === true && aResults[2]?.includes('exit=0') === true && a.bashWroteExists === true, `r2=${JSON.stringify(aResults[2] ?? '').slice(0, 200)} wrote=${String(a.bashWroteExists)}`)
  check('L4', 'CONFINEMENT WITNESS: the confined child reading a file OUTSIDE every allowPath answers the kernel refusal (Permission denied) and the secret bytes NEVER appear on the wire',
    aResults[3] !== undefined && aResults[3].includes('Permission denied') === true && !aResults[3].includes('A5G7-OUTSIDE-SECRET-42'),
    `r3=${JSON.stringify(aResults[3] ?? 'LEG-MISSING').slice(0, 220)}`)
  check('L6', 'GLOB ROW RUNS REAL ON THE WIRE (int-mnt INTEGRATION ROUND: the #322 FINAL a5glb anchored backend is mounted where fsInstance+confinedProvider are both configured; CANDIDATE-A stays archived — the mounted face is the anchored one, request allowPaths anchor.rootReal READ-ONLY, internalLog never passed [round-7 integration conditions, pinned INT-a/INT-b/INT-c in alpha5-glue7-plane-backends.test.ts]; the pre-mount behavior table lives in the glue7 README §6-era face)', aResults[4]?.includes('notes.txt') === true && !(aResults[4] ?? '').includes('secret.txt'), `r4=${JSON.stringify(aResults[4] ?? 'LEG-MISSING').slice(0, 220)}`)
  check('L5', 'the assembled world logged the assembly rows in the host log: the placement feed row list (team_grep,team_glob,team_bash,read), the confined capability OK probe, ≥1 confined-shell RAN line and a governed-read RAN line',
    (a.logObservations ?? []).some((l) => l.includes('placement-feed rows=[team_grep,team_glob,team_bash,read]'))
      && (a.logObservations ?? []).some((l) => l.includes('confined-shell capability OK'))
      && (a.logObservations ?? []).some((l) => l.includes('confined-shell ran'))
      && (a.logObservations ?? []).some((l) => l.includes('governed-read RAN')),
    `rows=${JSON.stringify((a.logObservations ?? []).filter((l) => l.includes('placement-feed') || l.includes('confined-shell ran') || l.includes('governed-read RAN')).slice(0, 4))}`)

  // ③ deny negative, same round, production backends:
  check('N1', 'DENY-BEFORE-BACKEND with the PRODUCTION shell backend: the bash-DENYING member answered template-deny-lane and the sentinel was NEVER created (zero side effects on the fs; backend execCount stays 0 by the lane order)',
    dResults[0]?.includes('template-deny-lane') === true && a.sentinelExists === false, `r0=${JSON.stringify(dResults[0] ?? '').slice(0, 180)} sentinel=${String(a.sentinelExists)}`)

  // ④ closed-world + zero-expansion:
  const baselineClean = (b.planeObservations ?? []).every((o) => !String(o).startsWith('a5-plane: placed') && !String(o).includes('a5g7'))
    && !(b.leader?.scopedNames ?? []).some((n) => ALIASES.includes(n))
  check('Z1', 'control-of-controls: the BASELINE governed leader (same STRICT artifact, NO teamToolPlane config) shows zero plane aliases and zero plane/a5g7 observations — the assembly is config-scoped, not ambient',
    baselineClean, `aliases=${JSON.stringify((b.leader?.scopedNames ?? []).filter((n) => ALIASES.includes(n)))} obs=${JSON.stringify((b.planeObservations ?? []).slice(0, 2))}`)
  const setDiff = (x, y) => (Array.isArray(x) ? x : []).filter((n) => !(Array.isArray(y) ? y : []).includes(n))
  {
    const preset = PRESETS[0]
    const regDelta = setDiff(a[preset]?.scopedNames, b[preset]?.scopedNames)
    const wireDelta = setDiff(a[preset]?.wireCatalog, b[preset]?.wireCatalog)
    const clean = (a[preset]?.scopedNames ?? []).filter((n) => n.startsWith('team_')).length === 0 && (a[preset]?.wireCatalog ?? []).filter((n) => n.startsWith('team_')).length === 0
    check('Z2', `ZERO EXPANSION (same round): the ${preset} NON-team session registry-vs-baseline Δ=[] AND wire-vs-baseline Δ=[] AND zero team_ aliases — while the SAME assembled boot carries three live production backends`,
      regDelta.length === 0 && wireDelta.length === 0 && clean, `regΔ=${JSON.stringify(regDelta)} wireΔ=${JSON.stringify(wireDelta)}`)
  }
  const globLanded = JSON.stringify(a.memberAWireCatalog ?? []).length > 0
  const noIoOnAssembled = !(aResults[0] ?? '').includes(IO_TEXT) && !(aResults[1] ?? '').includes(IO_TEXT) && !(aResults[2] ?? '').includes(IO_TEXT)
  check('Z3', 'the assembled world shows NO IO_POLICY_UNSUPPORTED landing anywhere on the driven legs (the shut face was truly replaced) and host log shows NO module/bootstrap failure',
    globLanded && noIoOnAssembled && (a.hostErrors ?? []).length === 0,
    `noIo=${String(noIoOnAssembled)} hostErrors=${JSON.stringify((a.hostErrors ?? []).slice(0, 2))}`)

  check('Z4', 'leader wire on the assembled world still speaks the team tools (placement reached the model-facing wire on BOTH governed agents incl. the read takeover)',
    (a.leaderWireCatalog ?? JSON.stringify(a)).length > 0 && ALIASES.every((n) => (a.memberAWireCatalog ?? []).includes(n)),
    `member team_*=${JSON.stringify([...new Set((a.memberAWireCatalog ?? []).filter((n) => n.startsWith('team_') || n === 'read'))])}`)

  if (!KEEP) { try { rmSync(EXP, { recursive: true, force: true }) } catch { /* best effort */ } }
  const homesRoot = join(WORKTREE, 'tests', 'homes')
  const a5g7Homes = existsSync(homesRoot) ? readdirSync(homesRoot).filter((d) => d.startsWith('a5g7-')) : []
  check('C1', 'world cleanup: no a5g7-* DSH_HOME remains under tests/homes and the strict expansion is swept (its per-file sha256 manifest is the retained evidence)',
    !existsSync(EXP) && a5g7Homes.length === 0, `exp=${String(!existsSync(EXP))} homes=${JSON.stringify(a5g7Homes)}`)
  const rawLeft = MODES.filter((m) => existsSync(join(EVIDENCE_DIR, `instance-${m}.raw.log`)))
  check('C2', 'launch-token hygiene: raw instance logs deleted after redaction at capture', rawLeft.length === 0, `rawLeft=${JSON.stringify(rawLeft)}`)

  writeEvidence('criteria.json', { runStamp: RUN_STAMP, ports: [HOST_PORT, BASELINE_PORT], expansion: EXP, head: gitAt(WORKTREE, 'rev-parse', 'HEAD'), files: eFacts?.fileCount, launcherSha: LAUNCHER_SHA.slice(0, 16), criteria: CRITERIA })
  const red = CRITERIA.filter((c) => !c.pass)
  console.log(`VERDICT ${red.length === 0 ? 'GREEN' : `RED (${red.map((c) => c.id).join(',')})`} (${CRITERIA.length - red.length}/${CRITERIA.length})`)
  process.exit(red.length === 0 ? 0 : 2)
}

main().then(
  () => process.exit(0),
  async (error) => {
    console.log(`FATAL ${redact(String(error?.stack ?? error)).split('\n').slice(0, 8).join(' | ')}`)
    writeEvidence('fatal.json', { error: redact(String(error?.message ?? error)), criteriaSoFar: CRITERIA })
    process.exit(1)
  },
)
