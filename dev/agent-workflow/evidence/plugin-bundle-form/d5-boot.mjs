#!/usr/bin/env node
/**
 * d5-boot.mjs — plugin-bundle-form D5 step 3 (task brief §D5): boot the
 * INSTALLED bundle form on the real production DSH host and run the
 * S8-READY-equivalent gates.
 *
 * Derived from s8-boot-r125.mjs (R125 audited kit; the same RC1
 * characterization lib + in-process mock + gate set). Audited
 * replacements only:
 *
 *   D5_HOME   — world root (default: the newest references/.dsh-test-pbf-*
 *               carrying d5-assertions-<stamp>.json from d5-setup.mjs;
 *               override with D5_HOME).
 *   No shim placement: the client row comes from the BUNDLE layer —
 *               the installed package's own composition-shim (bundle
 *               row name = bare `dsh-agent-team`; module registry key =
 *               the ROOT package name, not the shim's @dsh-agent-team/client).
 *   Patch layer: ONLY the test-harness rows (p6t6 observability health
 *               gate + the headless directory-picker pin). The two PRODUCT
 *               rows (dsh-agent-team host + dsh-agent-team-client) come
 *               exclusively from the bundle layer (the installed root
 *               cordis.patch.yml) — no hand-written product row anywhere.
 *   Root session id = `team-root` (the shipped bundle config), blueprint =
 *               `my-team-bp-1` (the shipped default blueprint).
 *   Added gate: 4-artifact byte identity (install vs the task tree under
 *               test, S8_WT, default .worktrees/PBF).
 *
 * The profile was created + populated by d5-setup.mjs (CLI plugin add +
 * allowBuilds + prepare); this kit boots it and never writes product rows.
 *
 * Subcommands:
 *   node d5-boot.mjs boot   — instance start + gates (boot line, 401, dump
 *                             rows, health ready, bundle serve, live
 *                             catalog.list, 4-artifact byte identity) +
 *                             state.json; then STAYS ALIVE (background
 *                             job) holding the instance child + mock.
 *   node d5-boot.mjs status — re-probe health/serve/catalog from state.json.
 *   node d5-boot.mjs stop   — verify teardown (ports free) + stamp state.
 *
 * Usage env: D5_HOME (optional), S8_WT (tree under test; default
 * .worktrees/PBF), D5_STAMP (optional; default = newest world).
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// The RC1 characterization lib + mock live in the MAIN repository's
// .worktrees/RC1 — a sibling of THIS worktree. This evidence dir may sit in
// the task worktree (4 ups = worktree root, which lacks .worktrees) or in
// the main repo (4 ups = repo root) — walk up until an ancestor carries
// BOTH the RC1 lib and the test-use checkout (only the main repo root does).
function findMainRepoRoot(start) {
  let dir = start
  for (;;) {
    if (existsSync(join(dir, '.worktrees', 'RC1', 'tests', 'characterization', 'lib', 'instance.mjs'))
      && existsSync(join(dir, 'references', 'deepseek-harness-test-use'))) {
      return dir
    }
    const parent = dirname(dir)
    if (parent === dir) throw new Error(`no ancestor of ${start} carries .worktrees/RC1 + references/deepseek-harness-test-use`)
    dir = parent
  }
}
const MAIN_REPO = findMainRepoRoot(dirname(fileURLToPath(import.meta.url)))
const { DshInstance, ensureProfile } = await import(
  pathToFileURL(join(MAIN_REPO, '.worktrees', 'RC1', 'tests', 'characterization', 'lib', 'instance.mjs')).href
)
const { logTail, portInUse, waitForLogLine, waitForPortFree } = await import(
  pathToFileURL(join(MAIN_REPO, '.worktrees', 'RC1', 'tests', 'characterization', 'lib', 'util.mjs')).href
)
const { startMockModel } = await import(
  pathToFileURL(join(MAIN_REPO, '.worktrees', 'RC1', 'packages', 'tools', 'harness', 'mock-deepseek.mjs')).href
)

// ── paths & constants ──────────────────────────────────────────────────────

const EV = dirname(fileURLToPath(import.meta.url))
const REPO = MAIN_REPO
const WT = process.env.S8_WT ?? join(REPO, '.worktrees', 'PBF') // tree under test (task tree)
const HOST_TREE = join(REPO, 'references', 'deepseek-harness-test-use')

// World resolution: explicit D5_HOME, else the NEWEST .dsh-test-pbf-* under
// the main repo's references (d5-setup's world; boot() matches the
// d5-assertions file in EV by worldHome as the real gate).
function resolveHome() {
  if (process.env.D5_HOME) return resolve(process.env.D5_HOME)
  const stamp = process.env.D5_STAMP
  if (stamp) return join(REPO, 'references', `.dsh-test-pbf-${stamp}`)
  const dirs = readdirSync(join(REPO, 'references'))
    .filter((n) => n.startsWith('.dsh-test-pbf-') && existsSync(join(REPO, 'references', n)))
    .sort()
  if (dirs.length === 0) throw new Error('no .dsh-test-pbf-* world under references — run d5-setup.mjs first')
  return join(REPO, 'references', dirs[dirs.length - 1])
}
const HOME = resolveHome()
const PROFILE_DIR = join(HOME, 'profiles', 'web')
const PKG_DIR = join(PROFILE_DIR, 'node_modules', 'dsh-agent-team')

const PORT = 3180
const MOCK_PORT = 3493
const CLIENT_COMMIT_HASH = '76fda72979' // upstream 0.1.2-rc.1 HEAD (test-use)
const D5_ROOT_SESSION_ID = 'team-root' // the SHIPPED bundle config's rootSessionId
const D5_BLUEPRINT_ID = 'my-team-bp-1' // the SHIPPED default blueprint
// The bundle's client row (bare `dsh-agent-team`) resolves to the installed
// package root, whose `name` field IS the module-registry key (unlike the
// R122 shim world's @dsh-agent-team/client).
const CLIENT_PKG_NAME = 'dsh-agent-team'
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=[A-Za-z0-9_-]+/

// The BUNDLE layer's product rows (as the installed root cordis.patch.yml
// declares them — machine-agnostic specifiers; dump-config preserves row
// name as written).
const BUNDLE_HOST_ROW_NAME = 'dsh-agent-team/host'
const BUNDLE_CLIENT_ROW_NAME = 'dsh-agent-team'
// Test-harness rows (user layer): p6t6 observability + headless picker pin.
// The p6t6 row points at the TASK TREE's tools harness (S8_WT) — a test
// device, not a product surface: pnpm materializes only the root `files`
// list into the git-dep install, which deliberately does NOT include
// packages/tools (probe finding, D5 first boot preflight). Its
// @deepseek-ai/* imports resolve from the task tree's own node_modules —
// the same dual-instance world the R122/125 verticals proved fine.
const P6T6_URL = pathToFileURL(join(WT, 'packages', 'tools', 'harness', 'plugin.mjs')).href

const BOOT_LOG = join(EV, `d5-boot-${d5Stamp()}.log`)
const STATE_FILE = join(EV, `d5-state-${d5Stamp()}.json`)
function d5Stamp() {
  return process.env.D5_STAMP ?? resolveHome().match(/\.dsh-test-pbf-([^.]+)$/)?.[1] ?? 'unknown'
}
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')
const log = (line) => {
  const stamped = `[${new Date().toISOString()}] ${line}`
  appendFileSync(BOOT_LOG, stamped + '\n')
  console.log(stamped)
}
function die(msg) {
  log(`FAIL — ${msg}`)
  if (_instancePid !== null) {
    try {
      process.kill(_instancePid)
      log(`FAIL teardown: killed instance pid ${_instancePid}`)
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2500)
    } catch (e) {
      log(`FAIL teardown: kill pid ${_instancePid}: ${e.code ?? e.message}`)
    }
  }
  process.exit(1)
}
let _instancePid = null

// ── test-harness user-layer patch (NO product rows) ─────────────────────────

/**
 * The user layer carries ONLY the test-harness rows: the p6t6 observability
 * health gate (its /__p6t6/health awaits the production row's `ready`) and
 * the headless directory-picker pin. The two PRODUCT rows are the bundle
 * layer's (installed root cordis.patch.yml) — writing them here would defeat
 * the vertical's purpose.
 *
 * Picker pin dialect (mirrors the upstream's own
 * apps/web/tests/pin-browse-picker.overlay.yml "disable+insert pair"): the
 * dsh-web-app BUNDLE layer ships the `directory-picker` auto-chooser row, so
 * the user layer must OVERRIDE it with a BARE row (`- id: …, disabled: true`
 * = whole-row replace/disable), NOT `- insert:` (a second insert of the same
 * id throws `duplicate loader entry id`). On win32 + loopback bind the auto
 * chooser resolves to the native OS dialog, which headless automation cannot
 * drive — the browse pair below replaces it (the S8 kit's verbatim
 * rationale; the S8 kit emitted the bare row via indent-0 yamlEmitItem).
 */
function writeD5Patch(patchPath) {
  mkdirSync(dirname(patchPath), { recursive: true })
  const lines = [
    `# D5 user-layer patch (world ${d5Stamp()}): TEST-HARNESS rows only.`,
    '# The product rows (dsh-agent-team host + dsh-agent-team-client) come from',
    '# the BUNDLE layer — the installed package root cordis.patch.yml (bundle',
    '# row names: dsh-agent-team/host + dsh-agent-team — machine-agnostic).',
    '#',
    '# The p6t6 row name points at the TASK TREE tools harness (a test',
    '# device — the git-dep install materializes only the root `files` list,',
    '# which excludes packages/tools).',
    '#',
    '# The directory-picker row is a BARE row (disable override of the',
    '# web-app bundle auto-chooser) — insert would duplicate the id.',
    '- insert:',
    `    - id: "p6t6-team-tools"`,
    `      name: "${P6T6_URL}"`,
    '- id: "directory-picker"',
    '  disabled: true',
    '- insert:',
    `    - id: "directory-picker-browse"`,
    `      name: "@deepseek-ai/dsh-host-directory-picker-browse"`,
    `    - id: "directory-picker-browse-client"`,
    `      name: "@deepseek-ai/dsh-client-ui-directory-picker-browse"`,
    '',
  ]
  writeFileSync(patchPath, lines.join('\n'))
}

// ── HTTP helpers (verbatim from the S8 kit) ─────────────────────────────────

async function fetchJson(url, init, timeoutMs = 30_000) {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
    const text = await res.text()
    let body
    try { body = JSON.parse(text) } catch { body = text }
    return { status: res.status, body, text }
  } catch (e) {
    return { status: null, body: { readError: String(e?.message ?? e) } }
  }
}

/** Exchange the printed process token for the auth cookie (303 + set-cookie). */
async function authenticate(origin, token) {
  const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const setCookie = res.headers.get('set-cookie')
  if (res.status !== 303 || setCookie === null) {
    throw new Error(`dsh web authentication returned HTTP ${res.status} (expected 303 + set-cookie)`)
  }
  return setCookie.split(';', 1)[0]
}

async function remoteCall(origin, cookie, method, params) {
  return fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie === null ? {} : { cookie }) },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `d5-${Date.now().toString(16)}${Math.floor(Math.random() * 1e6).toString(16)}`,
      method,
      payload: { version: 1, params },
    }),
  }, 60_000)
}

async function p6t6Health(port) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/health`, undefined, 10_000)
}

async function healthReady(origin) {
  const deadline = Date.now() + 240_000
  let last = null
  for (;;) {
    const hb = await p6t6Health(PORT)
    last = { status: hb.status, body: hb.body }
    if (hb.status === 200 && hb.body?.ok === true && hb.body?.toolCount === 10) return last
    if (hb.status === 200 && hb.body?.ok === false && hb.body?.setupError !== undefined) {
      throw new Error(`row setup failed (definitive): ${JSON.stringify(hb.body).slice(0, 600)}`)
    }
    if (Date.now() >= deadline) throw new Error(`row health not ready in 240s — ${JSON.stringify(hb.body).slice(0, 400)}`)
    await new Promise((r) => setTimeout(r, 1000))
  }
}

// ── boot ────────────────────────────────────────────────────────────────────

async function boot() {
  log(`world: ${HOME}`)
  log(`install dir: ${PKG_DIR}`)
  if (!existsSync(PKG_DIR)) die(`installed package missing: ${PKG_DIR} (run d5-setup.mjs first)`)
  // The setup assertions (allowBuilds key, spec, install artifact SHAs).
  const setupAssertFile = readdirSync(EV).filter((f) => f.startsWith('d5-assertions-') && f.endsWith('.json'))
    .map((f) => join(EV, f))
    .find((f) => JSON.parse(readFileSync(f, 'utf8')).worldHome === HOME)
  if (!setupAssertFile) die(`no d5-assertions file for this world (${HOME}) — run d5-setup.mjs first`)
  const setup = JSON.parse(readFileSync(setupAssertFile, 'utf8'))
  log(`setup assertions: ${setupAssertFile} (allowBuilds key=${setup.allowBuildsKey})`)

  // Pre-flight: the install surface must be complete (prepare-built).
  for (const [label, p] of [
    ['host.js (dist entry)', join(PKG_DIR, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js')],
    ['agent-bindings.mjs (dist glue mirror)', join(PKG_DIR, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs')],
    ['seam.mjs (root-binding)', join(PKG_DIR, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')],
    ['client-bundle.js (composition shim)', join(PKG_DIR, 'packages', 'client', 'composition-shim', 'client-bundle.js')],
    ['p6t6 harness (task tree)', join(WT, 'packages', 'tools', 'harness', 'plugin.mjs')],
    ['root cordis.patch.yml (bundle layer)', join(PKG_DIR, 'cordis.patch.yml')],
  ]) {
    if (!existsSync(p)) die(`missing install artifact ${label}: ${p}`)
  }
  if (await portInUse(PORT)) die(`port ${PORT} is in use`)
  if (await portInUse(MOCK_PORT)) die(`port ${MOCK_PORT} is in use`)

  // Workspace (fresh home: composer inert until one exists).
  const workspaceDir = join(HOME, 'workspace-d5')
  mkdirSync(workspaceDir, { recursive: true })

  // Profile (created by d5-setup's CLI runs) + TEST-HARNESS-only patch.
  const logDir = join(EV, 'instances')
  mkdirSync(logDir, { recursive: true })
  const instance = new DshInstance({ hostTree: HOST_TREE, dshHome: HOME, port: PORT, clientCommitHash: CLIENT_COMMIT_HASH, logDir })
  const profile = await ensureProfile({ instance, log, timeoutMs: 90_000 })
  log(`profile ${profile.created ? 'created via throwaway boot' : 'already initialized (d5-setup)'}`)
  if (profile.created) die('profile was NOT pre-created by d5-setup — the world is not the git-install world (abort)')
  writeD5Patch(instance.patchFile)
  log(`test-harness patch layer written to ${instance.patchFile} (product rows stay in the bundle layer)`)

  // p6t6 directive (its health gate awaits the production row's ready).
  const directive = {
    boot: 1,
    phase: 'create',
    reportDir: EV,
    runStamp: d5Stamp(),
    rootSessionId: D5_ROOT_SESSION_ID,
  }
  writeFileSync(join(HOME, 'p6t6-directive.json'), JSON.stringify(directive, null, 2))
  log(`p6t6 directive written (boot=1 phase=create rootSessionId=${D5_ROOT_SESSION_ID})`)

  // Mock model (in-process; the deepseek-official adapter resolves the
  // launch environment — the T12 honesty pattern; the model NAME is opaque
  // to the mock, so the shipped deepseek-v4-flash config works as-is).
  const mockLogPath = join(EV, `mock-model-${d5Stamp()}.log`)
  const mock = await startMockModel({
    port: MOCK_PORT,
    decide: ({ seq: s, req }) => {
      appendFileSync(mockLogPath, `[${new Date().toISOString()}] mock: req ${s} model=${JSON.stringify(req?.model ?? null)}\n`)
      return { kind: 'text', content: `D5-M${s} ok (${req?.model ?? 'unknown-model'}).` }
    },
    log: (l) => appendFileSync(mockLogPath, `[${new Date().toISOString()}] ${l}\n`),
  })
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${mock.port}`
  process.env.DEEPSEEK_API_KEY = 'd5-mock-key'
  log(`mock DeepSeek endpoint up at 127.0.0.1:${mock.port} (in-process)`)

  // Boot the production instance.
  const started = await instance.start({ timeoutMs: 240_000 })
  _instancePid = instance.child?.pid ?? null
  const markerLine = await waitForLogLine(started.logPath, BOOT_MARKER, 60_000)
  if (markerLine === null) throw new Error(`boot marker not found in ${started.logPath}`)
  const token = markerLine.slice(markerLine.indexOf('token=') + 6).trim()
  const origin = `http://127.0.0.1:${PORT}`
  log(`booted at ${origin}; boot line: ${markerLine.trim()}`)
  const cookie = await authenticate(origin, token)
  log(`auth cookie exchanged (${cookie.slice(0, 12)}…); instance pid ${instance.child?.pid ?? 'unknown'}`)

  // Evidence: the rendered index page (the composed boot graph).
  const idxRes = await fetch(origin, { headers: { cookie }, signal: AbortSignal.timeout(30_000) })
  const idxText = await idxRes.text()
  writeFileSync(join(EV, `index-d5-${d5Stamp()}.html`), idxText)
  const idxPluginUrls = [...new Set(
    (idxText.match(/\/plugins\/[^"'\s\\]+/g) ?? []).map((u) => u
      .replaceAll('&amp;', '&')
      .replaceAll('&quot;', '"')
      .replaceAll('&#39;', "'")
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')),
  )]
  log(`index captured (status=${idxRes.status}, ${idxText.length} B); injected plugin URLs: ${JSON.stringify(idxPluginUrls)}`)

  // Gate 1 — row health (the production row's `ready` via the p6t6 gate).
  const health = await healthReady(origin)
  log(`row ready — health=${JSON.stringify(health.body).slice(0, 300)}`)

  // Gate 2 — the 401 gate.
  let unauth = null
  for (let i = 0; i < 20; i++) {
    unauth = await remoteCall(origin, null, 'catalog.list', {})
    if (unauth.status === 401 || unauth.status === 403) break
    await new Promise((r) => setTimeout(r, 500))
  }
  if (!(unauth.status === 401 || unauth.status === 403)) {
    die(`401 gate failed: unauthenticated catalog.list returned ${unauth.status} after 10s grace (expected 401/403): ${JSON.stringify(unauth.body).slice(0, 200)}`)
  }
  log(`401 gate: unauthenticated catalog.list → HTTP ${unauth.status}`)

  // Gate 3 — dump-config: the BUNDLE-LAYER product rows present. The dump
  // preserves row `name` AS WRITTEN (package specifiers stay specifiers;
  // file rows keep their file URL) — the bundle layer section is keyed by
  // bundle name (`# == dsh-agent-team`), and the product rows carry the
  // machine-agnostic specifiers from the installed root cordis.patch.yml.
  const dump = await instance.dumpConfig({ timeoutMs: 60_000 })
  const dumpPath = join(EV, `dump-config-d5-${d5Stamp()}.txt`)
  writeFileSync(dumpPath, dump.text)
  const rows = {
    'dsh-agent-team (bundle host row, specifier as written)': DshInstance.rowInDump(dump.text, { id: 'dsh-agent-team', name: BUNDLE_HOST_ROW_NAME }),
    'dsh-agent-team-client (bundle client row, specifier as written)': DshInstance.rowInDump(dump.text, { id: 'dsh-agent-team-client', name: BUNDLE_CLIENT_ROW_NAME }),
    'p6t6-team-tools (harness row, file URL)': DshInstance.rowInDump(dump.text, { id: 'p6t6-team-tools', name: P6T6_URL }),
  }
  log(`dump-config → ${dumpPath}; rows=${JSON.stringify(rows)}`)
  if (Object.values(rows).some((v) => !v)) die(`dump-config row check failed: ${JSON.stringify(rows)}`)
  // The product rows must sit in the bundle section (keyed by bundle name),
  // NOT the user-patch section — the bundle layer is their origin.
  const userPatchSectionIdx = dump.text.indexOf(`# == ${instance.patchFile}`)
  if (userPatchSectionIdx === -1) die('user-patch section not found in dump-config (unexpected dump shape)')
  const hostIdx = dump.text.indexOf('name: dsh-agent-team/host')
  const clientIdx = dump.text.indexOf('\n  name: dsh-agent-team\n')
  if (hostIdx === -1 || clientIdx === -1) die('bundle product rows not found at all in dump-config')
  if (hostIdx > userPatchSectionIdx || clientIdx > userPatchSectionIdx) {
    die(`product rows appear in/after the user-patch section (not bundle-layer origin): hostIdx=${hostIdx} clientIdx=${clientIdx} userSection=${userPatchSectionIdx}`)
  }

  // Gate 4 — bundle served (byte-identity vs the installed shim).
  const bundleSrc = readFileSync(join(PKG_DIR, 'packages', 'client', 'composition-shim', 'client-bundle.js'))
  const bundleShasrc = sha256(bundleSrc)
  const singleUrl = idxPluginUrls.find((u) => u.includes(CLIENT_PKG_NAME) && u.endsWith('/client.js'))
  const comboUrl = idxPluginUrls.find((u) => u.includes(CLIENT_PKG_NAME) && u.includes('/client.js') && !u.endsWith('/client.js'))
  if (singleUrl === undefined && comboUrl === undefined) {
    die(`client row not in the composed boot graph — no /plugins/ URL for ${CLIENT_PKG_NAME}; injected=${JSON.stringify(idxPluginUrls)}`)
  }
  const servePath = singleUrl ?? comboUrl
  const servedRes = await fetch(`${origin}${servePath}`, { headers: { cookie }, signal: AbortSignal.timeout(30_000) })
  const servedBuf = Buffer.from(await servedRes.arrayBuffer())
  const servedSha = sha256(servedBuf)
  const unauthServed = await fetch(`${origin}${servePath}`, { signal: AbortSignal.timeout(30_000) })
  const isCombo = singleUrl === undefined
  const containsBundle = !isCombo ? servedSha === bundleShasrc : servedBuf.includes(bundleSrc)
  const serveCheck = {
    mode: isCombo ? 'combo' : 'standalone',
    url: servePath,
    status: servedRes.status,
    contentType: servedRes.headers.get('content-type'),
    bytes: servedBuf.length,
    sha256: servedSha,
    sha256MatchesInstall: servedSha === bundleShasrc,
    bundleBytesContained: servedBuf.includes(bundleSrc),
    unauthenticatedStatus: unauthServed.status,
  }
  writeFileSync(join(EV, `serve-check-d5-${d5Stamp()}.json`), JSON.stringify(serveCheck, null, 2))
  log(`serve check: ${JSON.stringify(serveCheck)}`)
  if (servedRes.status !== 200 || !containsBundle) die(`bundle serve check failed: ${JSON.stringify(serveCheck)}`)

  // Gate 5 — live remote channel: catalog.list carries the SHIPPED default
  // blueprint (proof the bundle layer doc, not a hand-written config, is
  // in force).
  const catalog = await remoteCall(origin, cookie, 'catalog.list', {})
  writeFileSync(join(EV, `catalog-list-d5-${d5Stamp()}.json`), JSON.stringify({ status: catalog.status, body: catalog.body }, null, 2))
  log(`catalog.list with cookie: HTTP ${catalog.status}`)
  if (catalog.status !== 200) die(`catalog.list with cookie returned ${catalog.status}`)
  const catalogText = JSON.stringify(catalog.body)
  if (!catalogText.includes(D5_BLUEPRINT_ID)) {
    die(`catalog.list does not carry the shipped default blueprint ${D5_BLUEPRINT_ID} — bundle layer doc not in force: ${catalogText.slice(0, 400)}`)
  }
  log(`catalog.list carries the shipped blueprint ${D5_BLUEPRINT_ID} (bundle layer doc in force)`)

  // Gate 6 — 4-artifact byte identity (install vs the task tree under test).
  const artifactPairs = [
    ['client-bundle.js', join(PKG_DIR, 'packages', 'client', 'composition-shim', 'client-bundle.js'), join(WT, 'packages', 'client', 'composition-shim', 'client-bundle.js')],
    ['shim index.js', join(PKG_DIR, 'packages', 'client', 'composition-shim', 'index.js'), join(WT, 'packages', 'client', 'composition-shim', 'index.js')],
    ['shim package.json', join(PKG_DIR, 'packages', 'client', 'composition-shim', 'package.json'), join(WT, 'packages', 'client', 'composition-shim', 'package.json')],
    ['dist glue agent-bindings.mjs', join(PKG_DIR, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs'), join(WT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs')],
  ]
  const byteIdentity = []
  for (const [label, installPath, treePath] of artifactPairs) {
    const a = sha256(readFileSync(installPath))
    const b = sha256(readFileSync(treePath))
    byteIdentity.push({ label, installSha256: a, treeSha256: b, identical: a === b })
    if (a !== b) die(`4-artifact byte identity FAILED for ${label}: install=${a} tree=${b}`)
    log(`byte-identical: ${label} (${a.slice(0, 16)}…)`)
  }
  writeFileSync(join(EV, `byte-identity-d5-${d5Stamp()}.json`), JSON.stringify(byteIdentity, null, 2))

  const state = {
    stamp: d5Stamp(), home: HOME, workspaceDir, port: PORT, mockPort: mock.port,
    origin, token, cookie,
    instancePid: instance.child?.pid ?? null,
    bootJobPid: process.pid,
    logPath: started.logPath,
    dumpPath,
    installDir: PKG_DIR,
    spec: setup.spec,
    allowBuildsKey: setup.allowBuildsKey,
    installShas: setup.artifacts,
    byteIdentity,
    rows, serveCheck,
    startedAt: new Date().toISOString(),
  }
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
  log(`state.json → ${STATE_FILE}`)
  log('D5-READY')
  console.log('D5-READY')

  // Stay alive (the S8 kit's verbatim lifecycle): the boot job holds the
  // instance child + the in-process mock; harness job kill tears the tree
  // down; clean exit when the instance child dies.
  let shuttingDown = false
  const shutdown = async (label) => {
    if (shuttingDown) return
    shuttingDown = true
    log(`shutdown: ${label}`)
    try {
      await instance.stop({ timeoutMs: 20_000 })
    } catch (e) {
      log(`shutdown: instance.stop note: ${String(e?.message ?? e).slice(0, 200)}`)
    }
    try {
      await mock.close()
    } catch { /* already closed */ }
    const p1 = await waitForPortFree(PORT, 20_000)
    const p2 = await waitForPortFree(mock.port, 20_000)
    log(`shutdown: ports free — ${PORT}:${p1} ${mock.port}:${p2}`)
    if (existsSync(STATE_FILE)) {
      const st = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
      st.stoppedAt = new Date().toISOString()
      writeFileSync(STATE_FILE, JSON.stringify(st, null, 2))
    }
    process.exit(0)
  }
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
  instance.child?.on('exit', (code) => {
    log(`instance child exited (code=${code}) — boot job shutting down`)
    void shutdown('instance child exit')
  })
  await new Promise(() => {}) // idle until exit
}

// ── status ──────────────────────────────────────────────────────────────────

async function status() {
  if (!existsSync(STATE_FILE)) die(`no state.json at ${STATE_FILE}`)
  const state = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
  const hb = await p6t6Health(state.port)
  const catalog = await remoteCall(state.origin, state.cookie, 'catalog.list', {})
  log(`status: health=${JSON.stringify(hb.body).slice(0, 200)}; catalog.list HTTP ${catalog.status}`)
}

// ── stop ────────────────────────────────────────────────────────────────────

async function stop() {
  if (!existsSync(STATE_FILE)) die(`no state.json at ${STATE_FILE}`)
  const state = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
  if (state.instancePid !== null && state.instancePid !== undefined) {
    try {
      process.kill(state.instancePid)
      log(`stop: instance pid ${state.instancePid} signaled`)
    } catch (e) {
      log(`stop: instance pid ${state.instancePid} kill note: ${String(e?.message ?? e).slice(0, 200)}`)
    }
  } else {
    log('stop: no instancePid in state.json (already stopped?)')
  }
  const p1 = await waitForPortFree(PORT, 60_000)
  const p2 = await waitForPortFree(state.mockPort ?? MOCK_PORT, 60_000)
  log(`stop: ports free — ${PORT}:${p1} ${state.mockPort ?? MOCK_PORT}:${p2}`)
  if (!p1 || !p2) die('ports not free after stop — manual cleanup required')
  const tail = logTail(state.logPath, 15)
  appendFileSync(BOOT_LOG, `stop: instance log tail:\n${tail}\n`)
  if (state.stoppedAt === undefined) {
    state.stoppedAt = new Date().toISOString()
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
  }
  log('D5-STOPPED')
}

const [, , cmd] = process.argv
if (cmd === 'boot') await boot()
else if (cmd === 'status') await status()
else if (cmd === 'stop') await stop()
else die(`unknown command ${JSON.stringify(cmd)} (expected boot|status|stop)`)
