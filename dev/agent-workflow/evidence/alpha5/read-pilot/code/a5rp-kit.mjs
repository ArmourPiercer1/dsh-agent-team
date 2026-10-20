// a5rp — read-pilot pinnedHost LIVE verification kit (ROOT RELEASE, isolated
// pinnedHost READ verification ONLY; not a production enable; fixture-only).
// Four evidence pieces, all real-run real-recorded (no fixture substitution):
//   1) original native body = 0        (loader-hook count + structural PID law)
//   2) native schema + output parity   (world wire bytes vs pilot render, strict)
//   3) allow / deny / ask three forms  (pilot control faces + FD/read witnesses)
//   4) cancellation                    (pilot pre/mid typed + world session.cancel)
// Gates: RP-PIN (immutable pinned tree @ the exact approved SHA) + H/I/T.
// Discipline: redact-BEFORE-write (no raw token ever touches disk here), no
// cleanup (worlds retained), :3080 probe-only, launcher never executed,
// per-step response-shape verification with fail-fast (900s = setup budget only).
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, createWriteStream } from 'node:fs'
import { createServer as netServer } from 'node:net'
import { Writable } from 'node:stream'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const args = process.argv.slice(2)
const argValue = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1] }
const HERE = dirname(new URL(import.meta.url).pathname)
const SRC = resolve(argValue('src-root', ''))
// the exact head the root approved for this verification (publication push):
const EXPECTED_SHA = argValue('sha', 'c515b064cbbe3e97a8c66babc39aaa316953d766')
const MAIN_CHECKOUT = resolve(argValue('main-checkout', SRC))
const HOMES_ROOT = resolve(argValue('homes-root', join(SRC, 'tests', 'homes')))
const RUN_STAMP = new Date().toISOString().slice(0, 19).replace(/:/g, '-') + 'Z'
const EVIDENCE_DIR = resolve(argValue('evidence-dir', join(HERE, '..', 'runs', RUN_STAMP)))
mkdirSync(EVIDENCE_DIR, { recursive: true })

const SRC_IMPORT = (rel) => import(pathToFileURL(join(SRC, rel)).href)
const { startMockModel } = await SRC_IMPORT('packages/tools/harness/mock-deepseek.mjs')
const { presetDeclarationRow, smokePresetPlugins } = await SRC_IMPORT('tests/kits/_shared/preset-seam.mjs')
const pathsMod = await SRC_IMPORT('tests/paths.mjs')
const { TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH, testUseTree } = pathsMod

const WORLD_PREFIX = 'a5rp'
const PRESET_ID = 'a5rp-base'
const ROOT = 'a5rp-root'
const MODEL_ID = 'deepseek-flash'
const HOST_PORT = 3188
const MOCK_PORT = 3496
const MK = 'A5RP'

const CRITERIA = []
function check (id, claim, cond, observed) {
  CRITERIA.push({ id, claim, pass: cond, observed })
  console.log(`${cond ? 'PASS' : 'FAIL'} ${id} — ${claim}${observed === undefined ? '' : ` [${observed}]`}`)
}
const note = (id, claim, observed) => { CRITERIA.push({ id, claim, pass: null, observed }); console.log(`BOOK ${id} — ${claim}${observed === undefined ? '' : ` [${observed}]`}`) }
const die = (msg) => { throw new Error(`FATAL: ${msg}`) }
const gitAt = (dir, ...a) => spawnSync('git', ['-C', dir, ...a], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).stdout.trim()
const sha256File = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
const hex8 = (s) => createHash('sha256').update(s).digest('hex').slice(0, 8)
async function portFree (port) {
  const srv = netServer()
  await new Promise((res, rej) => { srv.once('error', rej); srv.listen(port, '127.0.0.1', res) }).catch(() => false)
    .then((x) => { srv.close(); return x === undefined })
  return true
}
async function waitQuiet (deadlineMs, fn) { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > deadlineMs) return null; await new Promise((r) => setTimeout(r, 500)) } }
async function waitFor (deadlineMs, fn, what) { const v = await waitQuiet(deadlineMs, fn); if (!v) die(`timeout waiting for ${what}`); return v }
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
// redact-BEFORE-write: the ONLY evidence writer; token material never lands.
function writeEvidence (name, value) { writeFileSync(join(EVIDENCE_DIR, name), redact(typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n')) }
async function fetchJson (url, init, timeoutMs = 30_000) {
  const res = await fetch(url, { ...(init ?? {}), signal: AbortSignal.timeout(timeoutMs) })
  const text = await res.text()
  try { return { status: res.status, body: JSON.parse(text) } } catch { return { status: res.status, body: text } }
}
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/
let TESTUSE = ''
let HOST_BIN = ''

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
        // PAIRING LAW (run9): results carry their tool_use_id — per-turn capture
        // rides the id, never positional history counting (run8/9 stale-capture law).
        toolResults.push({ id: String(b.tool_use_id ?? ''), text: rep })
        text += '\u0001tool_result:' + rep
      }
    }
  }
  return { msgCount: msgs.length, toolCount: toolNames === null ? 0 : toolNames.length, toolNames, assistantToolNames, toolResults, markerHits: [], _text: text }
}
function yamlQuoted (s) { return JSON.stringify(s) }
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
const rnd = () => Math.random().toString(36).slice(2, 10)
const toolCall = (id, name, argsObj) => ({ kind: 'tool-call', toolCalls: [{ id, name, arguments: argsObj }] })

// VERBATIM-proven recipe from the a5fleg/a5tools-gov kits (same host, same day):
// a workspace-scoped pnpm-workspace.yaml (hoisted linker + workspace storeDir)
// BEFORE plugin add; anything else dies on the global store / prepare block.
const STORE_DIR = join(HOMES_ROOT, '.a5rp-store')
function profileWorkspaceYaml () {
  return `packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\nstoreDir: ${STORE_DIR}\n`
}
function realInstall ({ world, logName }) {
  const spec = `github:ArmourPiercer1/dsh-agent-team#${EXPECTED_SHA}`
  const profileDir = join(world, 'profiles', 'web')
  mkdirSync(profileDir, { recursive: true })
  writeFileSync(join(profileDir, 'pnpm-workspace.yaml'), profileWorkspaceYaml())
  mkdirSync(join(world, 'workspace'), { recursive: true })
  const r = spawnSync(process.execPath, [HOST_BIN, 'plugin', '--profile', 'web', 'add', spec], {
    cwd: join(world, 'workspace'), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 900_000,
    env: { ...process.env, DSH_HOME: world },
  })
  writeEvidence(logName, redact(`$ node ${HOST_BIN} plugin --profile web add ${spec}\nexit=${String(r.status)}\n${String(r.stdout ?? '')}\n${String(r.stderr ?? '')}`))
  return { exit: r.status, stdout: String(r.stdout ?? ''), stderr: String(r.stderr ?? '') }
}

// ─── parity vectors (identical bytes on BOTH mounts) ─────────────────────────
const RPDATA_REL = join('workspace', 'rpdata')
const VECTORS = [
  { id: 'v1-plain', rel: 'plain.txt' },
  { id: 'v2-window', rel: 'plain.txt', offset: 2, limit: 2 },
  { id: 'v3-empty', rel: 'empty.txt' },
  { id: 'v4-longline', rel: 'long.txt' },
  { id: 'v5-tail', rel: 'many.txt', offset: 295, limit: 10 },
  { id: 'v6-unicode', rel: 'unicode.txt' },
  { id: 'v7-notrailing', rel: 'notrailing.txt' },
  { id: 'v8-pastEOF', rel: 'plain.txt', offset: 9999 },
  { id: 'v9-crlf', rel: 'crlf.txt' },
]
function writeFixtures (dir) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'plain.txt'), 'one\ntwo\nthree\n')
  writeFileSync(join(dir, 'empty.txt'), '')
  writeFileSync(join(dir, 'long.txt'), `${'x'.repeat(4990)}TAILMARK\nshort2\n`)
  writeFileSync(join(dir, 'many.txt'), Array.from({ length: 300 }, (_, i) => `line-${String(i + 1)}`).join('\n') + '\n')
  writeFileSync(join(dir, 'unicode.txt'), '行一\ttab\n中文内容 β\n')
  writeFileSync(join(dir, 'notrailing.txt'), 'no-trailing-newline')
  writeFileSync(join(dir, 'crlf.txt'), 'cr1\r\ncr2\r\n')
}

let MOCK_REQUESTS = []
const NATIVE = {}
const ISSUED = {} // vecId -> issued tool_use id (per-turn capture anchor)
const CAPTURED_BY = {} // vecId -> {callId, resultId, len} — the pairing ledger (root ③)
async function startWorld () {
  const handle = await startMockModel({
    port: MOCK_PORT,
    decide: ({ req }) => {
      const digest = digestRequest(req)
      digest.markerHits = [`${MK}_DISC`, `${MK}_VECTURN`, `${MK}_BIGC`].filter((m) => digest._text.includes(m))
      const rec = MOCK_REQUESTS[MOCK_REQUESTS.length - 1]
      if (rec !== undefined) rec.digest = digest
      const text = digest._text
      // SPECIFICITY-FIRST dispatch: the root session accumulates history, so a
      // later turn's request still carries the DISC text — the DISC branch must
      // be LAST (run5 law: earlier order short-circuited every tool turn).
      // HISTORY LAW (run8): one root session accumulates ALL prior turn
      // markers — the CURRENT turn is identified by the LAST marker occurrence,
      // never the first (run8 died answering v1 forever on v2's turn).
      const all = [...text.matchAll(/A5RP_VECTURN#(v[\w-]+)/g)]
      const vm0 = all.length > 0 ? all[all.length - 1] : null
      if (vm0 !== null) {
        const id = vm0[1]
        if (ISSUED[id] === undefined) {
          const v = VECTORS.find((x) => x.id === id)
          const a = { file_path: join(TESTUSE_PARENT_RPDATA, v.rel), ...(v.offset !== undefined ? { offset: v.offset } : {}), ...(v.limit !== undefined ? { limit: v.limit } : {}) }
          const cid = `rd-${id}-${rnd()}`
          ISSUED[id] = cid
          return toolCall(cid, 'read', a)
        }
        const hit = digest.toolResults.find((r) => r.id === ISSUED[id])
        if (hit !== undefined && NATIVE[id] === undefined) {
          NATIVE[id] = hit.text
          CAPTURED_BY[id] = { callId: ISSUED[id], resultId: hit.id, bytes: hit.text.length }
        }
        return { kind: 'text', content: `A5RP_DONE_${id}` }
      }
      if (text.includes(`${MK}_BIGC`) && !text.includes('A5RP_BIGC_DONE')) {
        if (ISSUED['bigc'] === undefined) {
          const cid = `bigc-${rnd()}`
          ISSUED['bigc'] = cid
          return toolCall(cid, 'read', { file_path: join(TESTUSE_PARENT_RPDATA, 'many.txt'), offset: 1, limit: 2000 })
        }
        return { kind: 'text', content: 'A5RP_BIGC_DONE' }
      }
      if (text.includes(`${MK}_DISC`)) return { kind: 'text', content: 'A5RP_DISC_OK' }
      return { kind: 'text', content: 'A5RP_IDLE_OK' }
    },
    log: () => {},
  })
  MOCK_REQUESTS = handle.requests
  return handle
}
let TESTUSE_PARENT_RPDATA = ''

// ── proven world plumbing (VERBATIM shape from the a5fleg kit, same host/day):
// the plugin row's bootPhase-create is what ESTABLISHES the root session the
// DISC barrier prompts ride (run4 typed proof: session/not-found without it).
const BP_ID = `a5rp-bp-${RUN_STAMP.replace(/[^0-9a-zA-Z]/g, '')}`
const BLUEPRINT_DIR = join(HOMES_ROOT, `${WORLD_PREFIX}-${RUN_STAMP}`, 'blueprints')
const ANCHOR_YAML = [
  '---', 'schemaVersion: 3', 'blueprintId: a5rp-anchor-bp', 'revision: "1"',
  'leader:', '  templateId: leader', '  persona: "You are the leader of the a5rp team."',
  'members:', '  - templateId: wa', '    persona: "You are a worker of the a5rp team."',
  'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
  'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
].join('\n')
function mainBlueprintYaml () {
  return [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_ID}`, 'revision: "1"',
    'displayName: "a5rp read-verification world"',
    'leader:', '  templateId: leader', '  persona: "You are the leader of the a5rp read-verification world. You will be driven turn by turn; on each turn make exactly the single tool call you are told to make, nothing else."', '  builtinToolDeny: []',
    'members:', '  - templateId: wa', '    persona: "You are a worker of the a5rp world."', '    builtinToolDeny: []',
    'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
    'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')
}
function rowConfig (launcher, rpdata) {
  return {
    rootSessionId: ROOT, bootPhase: 'create', blueprintSource: ANCHOR_YAML, blueprintDir: BLUEPRINT_DIR,
    rootPresetId: PRESET_ID, memberPresetId: PRESET_ID, seedMembers: [], generation: 1,
    staticModel: { provider: 'deepseek-official', model: MODEL_ID }, deniedSelection: null,
    mcpServers: [], mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
      { domain: 'persona', subject: 'standard', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    teamToolPlane: {
      realmId: 'a5rp-realm',
      fsInstance: { fs: 'a5rp-ctl', rootDir: rpdata, realmId: 'a5rp-realm', kind: 'absolute-path' },
      confinedProvider: {
        trustRoot: `sha256:${launcher.sha.slice(0, 16)}#${launcher.path}`,
        assembly: { launcherPath: launcher.path, launcherSha256: launcher.sha, minAbiVersion: 3 },
      },
    },
  }
}
function profileLayerYaml (cfg) {
  const basePlugins = [
    ...smokePresetPlugins({ personaText: 'You are a coding agent powered by the {{model}} model.', cwdSuffix: 'Your working directory is {{cwd}}.', bashDescription: 'Run commands in a bash shell.' }),
    { id: 'tool-fs-search', name: '@deepseek-ai/dsh-tool-fs-search', config: { sampleOverCapGlobResults: false } },
    { id: 'tool-str-replace-editor', name: '@deepseek-ai/dsh-tool-str-replace-editor' },
  ]
  return [
    `# a5rp live layer (run ${RUN_STAMP}): pinnedHost READ verification — public profile seams only.`,
    '- id: dsh-agent-team', '  name: dsh-agent-team/host', '  config:',
    ...Object.entries(cfg).flatMap(([k, v]) => yamlEmit(k, v, 2)),
    ...['- insert:', ...yamlEmitItem(presetDeclarationRow({
      id: PRESET_ID, displayName: 'a5rp base',
      description: `a5rp base preset (run ${RUN_STAMP})`, plugins: basePlugins,
    }), 1)],
    '',
  ].join('\n')
}

async function main () {
  const facts = { ok: false, stamp: RUN_STAMP, expectedSha: EXPECTED_SHA }
  TESTUSE = testUseTree(SRC)
  if (!existsSync(join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js'))) TESTUSE = testUseTree(MAIN_CHECKOUT)
  HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
  const HOME0 = join(HOMES_ROOT, `${WORLD_PREFIX}-${RUN_STAMP}`)
  const PIN_TREE = join(HOMES_ROOT, `${WORLD_PREFIX}-pin-${RUN_STAMP}`, 'pinned-tree')
  const RPDATA = join(HOME0, RPDATA_REL)
  TESTUSE_PARENT_RPDATA = RPDATA
  mkdirSync(HOME0, { recursive: true })

  // ── RP-PIN: immutable pinned tree clone at the exact approved head ────────
  mkdirSync(dirname(PIN_TREE), { recursive: true })
  const clone = spawnSync('git', ['clone', '--local', '--no-hardlinks', MAIN_CHECKOUT, PIN_TREE], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  const co = gitAt(PIN_TREE, 'checkout', '-q', '--detach', EXPECTED_SHA)
  const pinHead = gitAt(PIN_TREE, 'rev-parse', 'HEAD')
  const pinPorc = gitAt(PIN_TREE, 'status', '--porcelain')
  const pilotFiles = ['errors.ts', 'read-body.ts', 'index.ts', 'README.md'].map((f) => join(PIN_TREE, 'packages', 'tools', 'src', 'governed-fs', f))
  facts.pin = { head: pinHead, porcelain: pinPorc, node: process.version, files: pilotFiles.map((f) => ({ f: f.replace(PIN_TREE, ''), sha256: sha256File(f) })) }
  writeEvidence('pin.json', facts.pin)
  check('RP-PIN', `the pinned pilot tree is a dedicated clone detached at the exact approved SHA ${EXPECTED_SHA.slice(0, 10)} with porcelain clean (immutable profile form; the clone is NEVER a work branch)`,
    pinHead === EXPECTED_SHA && pinPorc === '', `head=${pinHead.slice(0, 10)} porcelain=${String(pinPorc === '')} cloneStatus=${String(clone.status)}`)
  void co

  // gates H1/H1b/H0 before any boot
  const uh = gitAt(TESTUSE, 'rev-parse', 'HEAD'), up = gitAt(TESTUSE, 'status', '--porcelain')
  check('H1', `the test-use host is the pinned pristine runtime @${TEST_USE_BASELINE_SHA.slice(0, 10)} with porcelain clean before`, uh.startsWith(TEST_USE_BASELINE_SHA) && up === '', `head=${uh.slice(0, 10)}`)
  const exists = spawnSync('git', ['-C', MAIN_CHECKOUT, 'cat-file', '-e', `${EXPECTED_SHA}^{commit}`], { encoding: 'utf8' }).status === 0
  check('H1b', `the graded SHA ${EXPECTED_SHA} exists in the repository and the approved push equals it`, exists, `exists=${String(exists)}`)
  facts.probeBefore = await stableProbe()
  check('H0', 'the stable :3080 instance answers read-only before this run (probe only)', facts.probeBefore === 401 || facts.probeBefore === 200, `status=${String(facts.probeBefore)}`)

  // world fixture dir (the SHARED bytes both mounts read; written once, immutable after boot)
  writeFixtures(RPDATA)
  facts.fixtures = readdirSync(RPDATA).sort()
  const rpIdentity = (() => { const st = statSync(RPDATA); return { dev: st.dev, ino: st.ino } })()

  // install (real public package face at the exact SHA)
  const t0 = Date.now()
  const inst = realInstall({ world: HOME0, logName: 'install.log' })
  check('I1', 'REAL install through the host public package face exits 0', inst.exit === 0, `exit=${String(inst.exit)} in ${String(Math.round((Date.now() - t0) / 1000))}s`)
  const depsRaw = (() => { try { return readFileSync(join(HOME0, 'profiles', 'web', 'package.json'), 'utf8') } catch { return '' } })()
  const pj = (() => { try { return JSON.parse(depsRaw) } catch { return {} } })()
  const deps = Object.keys(pj.dependencies ?? {})
  check('I2', 'the profile face is strict-single-plugin', deps.length === 1 && deps[0] === 'dsh-agent-team', `deps=${JSON.stringify(deps)}`)
  const faceDir = join(HOME0, 'profiles', 'web', 'node_modules', 'dsh-agent-team')
  const faceCount = (() => { let n = 0; const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { if (e.name === '.git' || e.name === 'node_modules') continue; if (e.isDirectory()) walk(join(d, e.name)); else n += 1 } }; try { walk(faceDir) } catch { /* none */ }; return n })()
  check('I3-lite', 'the installed plugin face carries >1500 files (face probe)', faceCount > 1500, `files=${String(faceCount)}`)

  // launcher blob: written to the world path + sha-pinned into the layer config,
  // NEVER EXECUTED by this kit (root order stands; disclosure stays: this
  // verification's clangd-free world does not ride landlock confinement).
  const launcherRel = 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py'
  const blob = spawnSync('git', ['-C', PIN_TREE, 'show', `${EXPECTED_SHA}:${launcherRel}`], { maxBuffer: 64 * 1024 * 1024 })
  if (blob.status !== 0) die('launcher blob missing on the pinned sha')
  const launcherPath = join(HOME0, 'deployment', 'landlock-prelauncher.py')
  mkdirSync(dirname(launcherPath), { recursive: true })
  writeFileSync(launcherPath, blob.stdout)
  const launcher = { path: launcherPath, sha: createHash('sha256').update(blob.stdout).digest('hex') }
  note('RP-LAUNCHER', 'launcher blob placed + sha-pinned into the layer config; the kit NEVER executes it (root order); this world is clangd-free and does not ride landlock confinement (disclosed form)', `sha=${launcher.sha.slice(0, 16)}`)

  // profile layer: plugin row (bootPhase create ESTABLISHES the root session;
  // run4 typed proof: session/not-found without the plugin row) + preset row.
  // The pilot itself is mounted PINNED (separate node process), NEVER through
  // production assembly.
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  writeFileSync(join(BLUEPRINT_DIR, 'main.yaml'), mainBlueprintYaml())
  const layerDir = join(HOME0, 'profiles', 'web')
  mkdirSync(layerDir, { recursive: true })
  writeFileSync(join(HOME0, 'profiles', 'web', 'cordis.patch.yml'), profileLayerYaml(rowConfig(launcher, RPDATA)))

  const mock = await startWorld()
  // ── REDACT-BEFORE-WRITE host log: line-buffered transform, raw never lands ─
  const INSTANCE_LOG = join(EVIDENCE_DIR, 'instance.log')
  const logStream = createWriteStream(INSTANCE_LOG)
  let lineBuf = ''
  let memLog = ''   // RAW in MEMORY ONLY (boot-marker parse; never written)
  const host = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(HOST_PORT), '--no-open'], {
    cwd: join(HOME0, 'workspace'), stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, DSH_HOME: HOME0, DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH, DEEPSEEK_BASE_URL: `http://127.0.0.1:${mock.port}`, DEEPSEEK_API_KEY: 'a5rp-mock-key' },
  })
  let hostExit = null
  host.on('exit', (code, signal) => { hostExit = { code, signal }; console.log(`[a5rp] host exited code=${String(code)} signal=${String(signal)}`) })
  const onChunk = (chunk) => {
    lineBuf += String(chunk)
    const lines = lineBuf.split('\n')
    lineBuf = lines.pop() ?? ''
    for (const line of lines) {
      memLog += line + '\n'        // memory-side raw: ONLY consumer is the
                                    // boot-marker parse; token -> tokenHash,
                                    // raw text never leaves this process
      logStream.write(redact(line) + '\n') // redact-BEFORE-WRITE: disk sees redacted only
    }
  }
  host.stdout.on('data', onChunk)
  host.stderr.on('data', onChunk)

  try {
    const boot = await waitFor(180_000, () => { const mm = BOOT_MARKER.exec(memLog); return mm === null ? false : mm }, 'boot marker (memory side; disk side is redacted)')
    const origin = `http://127.0.0.1:${boot[1]}`
    facts.tokenHash = hex8(boot[2]) // NEVER the token itself, NEVER on disk
    const auth = await fetch(`${origin}/?token=${boot[2]}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
    const cookie = auth.headers.get('set-cookie')
    if (!(auth.status === 303 && cookie !== null)) die(`token gate ${String(auth.status)}`)
    const post = async (path, method, payload, timeoutMs = 120_000) => {
      const r = await fetchJson(`${origin}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' }, body: JSON.stringify({ type: 'client-request', rpcId: `${method}-${rnd()}`, method, payload }) }, timeoutMs)
      return r
    }
    const verifyStep = (r, what) => {
      const body = JSON.stringify(r.body ?? '')
      if (r.status !== 200 || /"ok"\s*:\s*false|"error"\s*:/.test(body)) { writeEvidence('world.partial.json', facts); die(`step ${what} refused (status=${String(r.status)}): ${body.slice(0, 200)}`) }
      return body
    }

    // DISC: surface must carry the builtin read tool
    let surface = null
    for (let k = 1; k <= 12 && surface === null; k += 1) {
      const disc = await post('/api/session/prompt', 'session/prompt', { args: { request: { requestId: `disc-${k}-r`, sessionId: ROOT, mode: 'queue', content: [{ type: 'text', text: `${MK}_DISC barrier ${String(k)}: setup turn, do not call tools, reply OK.` }] } } }, 240_000)
      verifyStep(disc, 'session/prompt DISC')
      const hit = await waitQuiet(30_000, async () => MOCK_REQUESTS.find((r) => r.digest !== undefined && r.digest.markerHits.includes(`${MK}_DISC`) && r.digest.toolCount > 0))
      if (hit) surface = [...new Set(hit.digest.toolNames ?? [])].sort()
    }
    if (surface === null) die('DISC barrier never hit the wire')
    facts.surface = surface
    check('RP-MOUNT', 'the NATIVE side of the parity pair is the REAL host surface (read tool present on the live world surface; host booted from pristine runtime with the installed face)',
      surface.includes('read'), `surfaceHasRead=${String(surface.includes('read'))} surface=${JSON.stringify(surface)}`)

    // native parity vectors (sequential turns; each result captured from the wire)
    for (const v of VECTORS) {
      const r = await post('/api/session/prompt', 'session/prompt', { args: { request: { requestId: `vec-${v.id}`, sessionId: ROOT, mode: 'queue', content: [{ type: 'text', text: `${MK}_VECTURN#${v.id} tool turn for ${v.id}` }] } } }, 240_000)
      verifyStep(r, `vector ${v.id}`)
      // WIRE-LAW (run7): prompt ok:true is QUEUE ADMITTANCE, not completion —
      // the turn runs async; poll the mock side for the captured result
      // (proven DISC pattern), fail fast past the bound.
      await waitQuiet(120_000, async () => NATIVE[v.id] !== undefined)
      if (NATIVE[v.id] === undefined) {
        // BOUNDED one-shot diagnostic (root order: no wrapper loops): dump what
        // the mock actually observed for the last turns, then fail fast.
        facts.mockProbe = MOCK_REQUESTS.slice(-5).map((r) => ({
          hasDigest: r.digest !== undefined,
          markers: r.digest?.markerHits ?? [],
          toolCount: r.digest?.toolCount ?? -1,
          assistantToolNames: r.digest?.assistantToolNames ?? [],
          nToolResults: r.digest?.toolResults?.length ?? -1,
          tailText: redact(String(r.digest?._text ?? '').slice(-260)),
        }))
        writeEvidence('mock-probe.json', { failedVector: v.id, probe: facts.mockProbe })
        die(`vector ${v.id} produced no tool_result on the wire (see mock-probe.json)`)
      }
    }
    facts.nativeCaptured = Object.keys(NATIVE).length
    const nativeEnvelope = (id) => {
      const raw = NATIVE[id]
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) return parsed.map((b) => String(b?.text ?? '')).join('')
        return String(raw)
      } catch { return String(raw) }
    }
    const nativeOut = {}
    for (const v of VECTORS) nativeOut[v.id] = nativeEnvelope(v.id)
    writeEvidence('native-wire.json', nativeOut)
    const nativeOkCount = VECTORS.filter((v) => v.id !== 'v8-pastEOF' && !/^Error:/i.test(nativeEnvelope(v.id)) && nativeEnvelope(v.id).length > 0).length
    check('RP-NATIVE', 'the NATIVE mount produced real envelopes for the 8 content vectors on the wire (v8 past-EOF is the typed-error control)',
      nativeOkCount === 8 && !/^<path>/i.test(nativeEnvelope('v8-pastEOF')) && /out of range|Error|offset/i.test(nativeEnvelope('v8-pastEOF')), `contentOk=${String(nativeOkCount)} v8=${nativeEnvelope('v8-pastEOF').slice(0, 60)}`)

    // world-side CANCELLATION witness (typed session.cancel receipt)
    const bigPrompt = post('/api/session/prompt', 'session/prompt', { args: { request: { requestId: 'bigc-1', sessionId: ROOT, mode: 'queue', content: [{ type: 'text', text: `${MK}_BIGC big read turn` }] } } }, 240_000)
    await waitFor(60_000, async () => MOCK_REQUESTS.find((r) => r.digest !== undefined && r.digest.markerHits.includes(`${MK}_BIGC`)), 'BIGC turn start')
    const cancel = await post('/api/session/cancel', 'session/cancel', { args: { request: { sessionId: ROOT } } }, 30_000)
    const cancelBody = JSON.stringify(cancel.body ?? '')
    facts.worldCancel = { status: cancel.status, body: cancelBody.slice(0, 300) }
    const bigSettled = await Promise.race([bigPrompt.then((r) => ({ settled: true, status: r.status })), new Promise((res) => setTimeout(() => res({ settled: false }), 90_000))]).catch((e) => ({ settled: true, error: String(e).slice(0, 120) }))
    facts.bigSettled = bigSettled
    check('RP-CANCEL-WORLD', 'the live host admits a typed session.cancel while the turn is in flight (accepted:true receipt) and the turn terminates (no half-open state)',
      cancel.status === 200 && /"accepted"\s*:\s*true/.test(cancelBody) && bigSettled.settled === true, `receipt=${cancelBody.slice(0, 80)} settled=${String(bigSettled.settled)}`)

    // ── PILOT MOUNT (pinned tree, node type-stripping, hooks counting native touches)
    const HOOKS_LOG = join(EVIDENCE_DIR, 'native-body-hooks.log')
    writeFileSync(HOOKS_LOG, '')
    const REG = `data:text/javascript,import%20%7B%20register%20%7D%20from%20'node:module'%3Bregister(${JSON.stringify(pathToFileURL(join(HERE, 'a5rp-hooks.mjs')).href)})`
    const runPilot = (phase) => {
      const r = spawnSync(process.execPath, ['--import', REG, join(HERE, 'a5rp-pilot.mjs'), '--phase', phase, '--fixtures', RPDATA, '--out', join(EVIDENCE_DIR, `pilot-${phase}.json`)], {
        encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
        env: { ...process.env, A5RP_TREE: PIN_TREE, A5RP_HOOKS: HOOKS_LOG, A5RP_VECTORS: JSON.stringify(VECTORS) },
      })
      if (r.status !== 0) die(`pilot phase ${phase} exited ${String(r.status)}: ${String(r.stderr).slice(0, 300)}`)
      return JSON.parse(readFileSync(join(EVIDENCE_DIR, `pilot-${phase}.json`), 'utf8')).records
    }
    const serve = runPilot('serve')
    const forms = runPilot('forms')
    const cancelP = runPilot('cancel')

    const byId = Object.fromEntries(serve.map((r) => [r.id, r]))
    const pilotOk = VECTORS.filter((v) => v.id !== 'v8-pastEOF').filter((v) => byId[v.id]?.ok === true).length
    const v8 = byId['v8-pastEOF']
    check('RP-PILOT', 'the PINNED pilot mount served 8/8 content vectors through the verified fd-chain (schema-validated outcomes) and v8 past-EOF is a typed refusal',
      pilotOk === 8 && v8?.ok === false && String(v8?.code).startsWith('GOV_'), `pilotOk=${String(pilotOk)} v8code=${String(v8?.code)}`)
    check('RP-FD-LAW', 'every pilot serve has NET fd delta 0 (chain closed, no leak, no fixture substitution); bytes read for content vectors (the empty-file vector legitimately reads 0 bytes — native law, not a violation)',
      VECTORS.every((v) => (byId[v.id]?.fdDelta ?? -1) === 0) && VECTORS.filter((v) => byId[v.id]?.ok === true && (byId[v.id]?.totalLines ?? 0) > 0).every((v) => byId[v.id].reads > 0), 'per-record fdDelta/reads/totalLines in pilot-serve.json')

    // PARITY: strict bytes, both mounts, same files, same caps
    const parity = []
    for (const v of VECTORS) {
      const nat = nativeEnvelope(v.id)
      const pil = v.id === 'v8-pastEOF' ? null : (byId[v.id]?.envelope ?? null)
      // error vectors: fill pilot-side machine fields with the typed message (the
      // 7-byte delta to native is exactly the host adapter's "Error: " prefix).
      const pilotErr = pil === null ? `Error: ${String(byId[v.id]?.message ?? '')}` : null
      const pilotText = pil ?? pilotErr
      const rec = { id: v.id, nativeLen: nat.length, pilotLen: pilotText === null ? null : pilotText.length, strictEqual: pil !== null && pil === nat, nativeHead: nat.slice(0, 80), pilotHead: pilotText === null ? null : pilotText.slice(0, 80), nativeIsError: /^Error|out of range/i.test(nat), pilotIsError: pil === null, errorFormNote: pil === null ? 'pilotLen = "Error: " + typed message; delta to native is the host-adapter prefix (VERDICTS A2)' : undefined }
      parity.push(rec)
    }
    writeEvidence('parity-diff.json', parity)
    const parityFails = parity.filter((p) => !p.strictEqual)
    const contentParityOk = parity.filter((p) => p.id !== 'v8-pastEOF').every((p) => p.strictEqual)
    const errControlOk = (() => { const p = parity.find((x) => x.id === 'v8-pastEOF'); return p.nativeIsError === true && p.pilotIsError === true })()
    check('RP-PARITY', 'STRICT byte equality 8/9 vectors (DENOMINATOR INCLUDES v8 as a recorded mismatch — no red hidden by exclusion; root ①): the 8 content vectors are byte-equal native-wire vs pilot-render (same files/caps/host law, zero normalization); v8 keeps its full item entry (expected/observed/error/path/support-status table in VERDICTS)',
      contentParityOk && errControlOk, `mismatches=${JSON.stringify(parityFails.map((p) => p.id))}`)
    if (parityFails.length > 0) note('RP-PARITY.delta', 'per-vector heads recorded for honest delta analysis', JSON.stringify(parityFails.map((p) => ({ id: p.id, nativeHead: p.nativeHead, pilotHead: p.pilotHead }))).slice(0, 900))

    // NATIVE BODY = 0: hook-count + structural law
    const hookHits = readFileSync(HOOKS_LOG, 'utf8').split('\n').filter((l) => l.startsWith('NATIVE-HIT')).length
    note('RP-NO-NATIVE-BODY.structural', 'structural law: the pilot mount is a SEPARATE node process from the host world; it imports ONLY the pinned pilot tree (loader-hook-monitored); the host world serves native reads in its own PID', 'separate PIDs; hook file is the witness')
    check('RP-NO-NATIVE-BODY', 'ZERO resolutions touching the native read implementation (tool-fs / read-render) occurred in the pilot mount process during all three phases (loader-hook count = 0)',
      hookHits === 0, `hookHits=${String(hookHits)} witness=native-body-hooks.log`)

    // THREE FORMS on pilot control faces, with FD/read witnesses
    const fm = Object.fromEntries(forms.map((r) => [r.id, r]))
    check('RP-ALLOW', 'ALLOW form: valid admission binding serves bytes; net fd delta 0; opens>0; reads>0',
      fm['form-allow']?.ok === true && fm['form-allow'].fdDelta === 0 && fm['form-allow'].opens > 0 && fm['form-allow'].reads > 0, JSON.stringify(fm['form-allow'] ?? null))
    check('RP-DENY', 'DENY form: revoked live state refuses with a typed code and reads=0 (bytes NEVER cross the effect boundary)',
      fm['form-deny']?.code === 'GOV_ABANDONED_REVOKED' && fm['form-deny'].reads === 0, JSON.stringify(fm['form-deny'] ?? null))
    check('RP-ASK', 'ASK form: pending (no admission binding) refuses BEFORE any open (opens=0, reads=0); RESOLVED (binding rides) serves with net fd delta 0',
      fm['form-ask-pending']?.code === 'GOV_ADMISSION_MISSING' && fm['form-ask-pending'].opens === 0 && fm['form-ask-pending'].reads === 0 && fm['form-ask-resolved']?.ok === true, JSON.stringify([fm['form-ask-pending'] ?? null, fm['form-ask-resolved'] ?? null]))

    // CANCELLATION on pilot control faces
    const cm = Object.fromEntries(cancelP.map((r) => [r.id, r]))
    check('RP-CANCEL-PILOT', 'cancellation on the pilot face is typed at BOTH points: pre-abort refuses before any open; mid-abort at the effect boundary refuses with reads=0 and net fd delta 0 (descriptors closed)',
      cm['cancel-pre']?.code === 'GOV_ABORTED' && cm['cancel-pre'].opens === 0 && cm['cancel-mid']?.code === 'GOV_ABORTED' && cm['cancel-mid'].reads === 0 && cm['cancel-mid'].fdDelta === 0, JSON.stringify([cm['cancel-pre'] ?? null, cm['cancel-mid'] ?? null]))

    // ④ READ-ONLY ladder: every tool call the ladder made across the world is
    // 'read' (no write/edit ever invoked; write enable stays forbidden).
    const nonReadTools = [...new Set(MOCK_REQUESTS.flatMap((r) => (r.digest?.assistantToolNames ?? []).filter((n) => n !== 'read')))]
    check('RP-READ-ONLY', 'the verification ladder invoked NO write/edit/other tool on the world — every assistant tool call on the wire is read (read-only shape, write enable forbidden and unexercised)',
      nonReadTools.length === 0, `nonReadTools=${JSON.stringify(nonReadTools)}`)

    // ③ callId ledger + src/dist hashes into the evidence package
    writeEvidence('callid-ledger.json', { issued: ISSUED, capturedBy: CAPTURED_BY })
    const distHashes = (() => {
      const acc = createHash('sha256')
      let n = 0
      const walk = (d, rel) => {
        for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
          if (e.name === '.git' || e.name === 'node_modules') continue
          if (e.isDirectory()) walk(join(d, e.name), `${rel}${e.name}/`)
          else { acc.update(`${rel}${e.name} ${sha256File(join(d, e.name))}\n`); n += 1 }
        }
      }
      walk(faceDir, '')
      return { faceFiles: n, aggregateSha256: acc.digest('hex') }
    })()
    writeEvidence('src-dist-hashes.json', { pinSrcFiles: facts.pin.files, distFace: distHashes, testedSha: EXPECTED_SHA })

    facts.ok = true
    return 0
  } finally {
    writeEvidence('world-fleg.partial.json', facts)
    try { host.kill() } catch { /* gone */ }
    await new Promise((r) => setTimeout(r, 3000))
    facts.hostExit = hostExit
    const upAfter = gitAt(TESTUSE, 'status', '--porcelain')
    check('T1', 'the pristine test-use tree is STILL byte-clean at the pinned baseline', upAfter === '', `porcelain=${String(upAfter === '')}`)
    const released = await waitQuiet(20_000, async () => !(await portFreeBusy(HOST_PORT)))
    const leftovers = readdirSync(HOMES_ROOT).filter((d) => d.startsWith(`${WORLD_PREFIX}-`))
    check('T2 (HOLD form)', 'host port released; a5rp-* worlds RETAINED per root cleanup HOLD (retention is law, not a failure)', released === true, `released=${String(released)} retained=${JSON.stringify(leftovers)}`)
    facts.probeAfter = await stableProbe()
    check('T3', 'the stable :3080 probe answers the SAME as before', facts.probeAfter === facts.probeBefore, `before=${String(facts.probeBefore)} after=${String(facts.probeAfter)}`)
    // evidence self-scan: NO token material landed anywhere on the evidence side
    const tokRe = /token=[A-Za-z0-9_-]{8,}|dsh-auth-[A-Za-z0-9_-]{6,}|Bearer\s+[A-Za-z0-9._-]{6,}/
    const scanned = []
    for (const f of readdirSync(EVIDENCE_DIR)) {
      try { const t = readFileSync(join(EVIDENCE_DIR, f), 'utf8'); if (tokRe.test(t)) scanned.push(f) } catch { /* binary/skip */ }
    }
    check('RP-EVID-CLEAN', 'redact-before-write self-proof: ZERO token-shaped strings in ANY evidence file written by this run', scanned.length === 0, `hits=${JSON.stringify(scanned)}`)
    writeEvidence('criteria.json', CRITERIA)
    writeFileSync(join(EVIDENCE_DIR, 'KIT_SUMMARY'), redact(JSON.stringify({ total: CRITERIA.filter((c) => c.pass !== null).length, pass: CRITERIA.filter((c) => c.pass === true).length, fail: CRITERIA.filter((c) => c.pass === false).length })) + '\n')
    try { await mock.close() } catch { /* ignore */ }
  }
}
async function portFreeBusy (port) {
  const srv = netServer()
  try { await new Promise((res, rej) => { srv.once('error', rej); srv.listen(port, '127.0.0.1', res) }); return false } catch { return true } finally { srv.close() }
}
process.exitCode = await main().catch(async (e) => { console.error(String((e && e.stack) ?? e)); return 1 })
