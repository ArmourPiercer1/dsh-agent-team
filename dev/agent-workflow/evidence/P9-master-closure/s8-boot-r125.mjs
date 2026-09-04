#!/usr/bin/env node
/**
 * S8 boot kit — production-host vertical browser smoke (plan L1684–1733).
 * R125 VARIANT (derived from the R122-verified kit; audited replacements only):
 *   S8_WT   — tree under test (default .worktrees/RC1 = R122 behavior)
 *   S8_SHIM — client shim source dir (default <EV>/shim; R125 = product composition-shim)
 *   S8_FARM — "1" re-enables the R122 junction-farm reconciliation (default: disabled;
 *             fresh-machine mode relies on declared runtime deps instead).
 * Everything else (row config, gates, state, mock, teardown) is byte-identical.
 *
 * Boots a REAL production DSH instance (references/deepseek-harness-test-use
 * @ 76fda72979 (0.1.2-rc.1), pristine) on a fresh workspace-internal DSH_HOME with the
 * P9 production composition mounted through the public profile-patch seam:
 *
 *   row 1  dsh-agent-team         — the built packages/runtime production
 *                                   host (T12 recipe verbatim: fresh root
 *                                   team boot, seedMembers=[], mcpServer=null,
 *                                   dist glue file URL, source seam URL);
 *   row 2  dsh-agent-team-client  — the S8 home-local shim package
 *                                   (relative row name → <home>/s8-client-row/
 *                                   client-bundle.js, nearest package.json
 *                                   carries dsh.client + ./client export);
 *   row 3  p6t6-team-tools        — the T12 observability row (reused, not
 *                                   reinvented): its /__p6t6/health gate
 *                                   awaits the production row's `ready`.
 *
 * Model turns run keyless and deterministic: a standalone mock DeepSeek
 * process (s8-mock.mjs) + DEEPSEEK_BASE_URL/DEEPSEEK_API_KEY exported to
 * the instance launch (the deepseek-official adapter resolves the launch
 * environment — the T12 honesty pattern).
 *
 * Subcommands:
 *   node s8-boot.mjs boot    — fresh-home assert + shim placement + profile
 *                              + patch + in-process mock + instance start +
 *                              gates (boot line, 401, dump rows, health
 *                              ready, bundle byte-identical serve, live
 *                              catalog.list) + state.json; then STAYS
 *                              ALIVE (background job) holding the instance
 *                              child + the in-process mock — the harness
 *                              job kill tears the whole tree down.
 *   node s8-boot.mjs status  — re-probe health/serve/catalog from state.json.
 *   node s8-boot.mjs stop    — verify teardown (ports free) + stamp state.
 *
 * Usage env: S8_STAMP (optional; default derived from now).
 */
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  DshInstance,
  ensureProfile,
  ensureProbeResolution,
} from '../../../../../../.worktrees/RC1/tests/characterization/lib/instance.mjs'
import {
  logTail,
  portInUse,
  waitForLogLine,
  waitForPortFree,
} from '../../../../../../.worktrees/RC1/tests/characterization/lib/util.mjs'
import { startMockModel } from '../../../../../../.worktrees/RC1/packages/tools/harness/mock-deepseek.mjs'

// ── paths & constants ──────────────────────────────────────────────────────

const EV = dirname(fileURLToPath(import.meta.url))
function findRepoRoot(start) {
  let dir = start
  for (;;) {
    if (existsSync(join(dir, 'references', 'deepseek-harness-test-use'))) return dir
    const parent = dirname(dir)
    if (parent === dir) throw new Error(`no ancestor of ${start} contains references/deepseek-harness-test-use`)
    dir = parent
  }
}
const REPO = findRepoRoot(EV)
const WT = process.env.S8_WT ?? join(REPO, '.worktrees', 'RC1') // R125: S8_WT override = tree under test; default keeps R122 behavior
const HOST_TREE = join(REPO, 'references', 'deepseek-harness-test-use')
const SHIM_SRC = process.env.S8_SHIM ?? join(EV, 'shim') // R125: S8_SHIM override = product composition-shim under test

const PORT = 3180
const MOCK_PORT = 3493
const CLIENT_COMMIT_HASH = '76fda72979' // R122: upstream 0.1.2-rc.1 HEAD (was cd5ef814 @ 0.1.2-alpha.1)
const S8_ROOT_SESSION_ID = 's8v-root'
// Bundle serving is keyed by the shim package's `name` field (the modules
// registry table key), NOT by the loader row id.
const CLIENT_PKG_NAME = '@dsh-agent-team/client'
const CLIENT_SERVE_PATH = `/plugins/${CLIENT_PKG_NAME}/client.js`
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=[A-Za-z0-9_-]+/

const HOST_URL = pathToFileURL(join(WT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js')).href
const GLUE_URL = pathToFileURL(join(WT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs')).href
const SEAM_URL = pathToFileURL(join(WT, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href
const P6T6_URL = pathToFileURL(join(WT, 'packages', 'tools', 'harness', 'plugin.mjs')).href
// The Loader imports every row entry on the Node side: point the row at the
// shim's inert Node half (index.js). The browser half is served separately
// by the client module system from the `./client` export of the same
// package. Relative names resolve against the patch file's directory
// (profiles/web) — two levels up reach the DSH_HOME root.
const CLIENT_ROW_NAME = '../../s8-client-row/index.js'

const BOOT_LOG = join(EV, 's8-boot.log')
const STATE_FILE = join(EV, 'state.json')
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')
const log = (line) => {
  const stamped = `[${new Date().toISOString()}] ${line}`
  appendFileSync(BOOT_LOG, stamped + '\n')
  console.log(stamped)
}
function die(msg) {
  log(`FAIL — ${msg}`)
  // Gate failures used to orphan the instance on PORT; kill it (TerminateProcess
  // on Windows) and give the OS a moment to release the socket before exiting.
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

// ── S8 production row config (T12 values, S8 ids) ──────────────────────────

/**
 * The S8 blueprint document (T12 known-good structure; s8v ids).
 *
 * Requirements are PROBE-DRIVEN: the New Team UI probe can only assert
 * persona-domain facts (one per selected preset — the client never sends
 * tool/skill facts), and a REQUIRED (non-optional) requirement maps to
 * `complete: true` (unmet => structural FATAL, not downgradeable). The
 * T12-era `tool: web` (optional => unacked WARNING) and `skill: base`
 * (required => FATAL) entries therefore dead-end the UI create gate
 * (the compat-ack wire gap stays UI-disabled on the T8 surface). The
 * single persona requirement below is satisfied by the roster's
 * isDefault preset (`standard`), which the panel preselects — the probe
 * settles OPEN and the create gate enables.
 *
 * Durable side (bug #6, attempt-24): the persistent prober classifies
 * the team's compatibility ONLY from the row-config `environmentFacts`
 * port (root.ts) — it never sees what the UI client sent. The UI panel
 * probe passed only because the client sends the persona fact itself;
 * the durable row (which lacked it) persisted as BLOCKED_FATAL
 * (`req-persona-standard` unavailable) and `admitNewWork` then blocked
 * `member.create`. The row config below therefore carries the
 * `persona/standard` fact too: both probe paths must observe the same
 * environment.
 */
function s8BlueprintDoc() {
  return [
    '---',
    'schemaVersion: 1',
    'blueprintId: s8v-bp-1',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: "S8 leader persona: you lead the s8v browser-vertical team."',
    'members:',
    '  - templateId: worker',
    '    displayName: "S8 Worker A"',
    '    persona: "S8 worker persona: you are the deterministic s8v worker."',
    'requirements:',
    '  - domain: persona',
    '    name: standard',
    'teamEnvelope:',
    '  allow:',
    '    - assign-task',
    '    - create-member',
    '    - send-message',
    '    - report-progress',
    '    - archive-member',
    '    - restore-member',
    '  deny:',
    '    - delete-team',
    'memberEnvelopes:',
    '  - templateId: worker',
    '    envelope:',
    '      allow:',
    '        - send-message',
    '        - report-progress',
    '      deny: []',
    'policyStates:',
    '  - id: default',
    '    description: "The s8v default state."',
    'quotas:',
    '  team:',
    '    maxInstances: 12',
    '    maxConcurrent: 12',
    '  members:',
    '    maxInstances: 4',
    '    maxConcurrent: 4',
    'metadata: {}',
    '---',
  ].join('\n')
}

function s8RowConfig() {
  return {
    bootPhase: 'create',
    rootSessionId: S8_ROOT_SESSION_ID,
    blueprintSource: s8BlueprintDoc(),
    seedMembers: [],
    defaultWorkspace: join(EV, 'workspace'),
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 's8v-model' },
    deniedSelection: null,
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
      // bug #6 (attempt-24): the durable prober reads ONLY this array.
      // The blueprint's single required requirement `persona/standard`
      // must be satisfiable here or every team persists BLOCKED_FATAL
      // and `admitNewWork` blocks `member.create` (see comment above).
      { domain: 'persona', subject: 'standard', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    glueUrl: GLUE_URL,
    seamUrl: SEAM_URL,
  }
}

// ── profile-patch YAML emitter (the DSH patch dialect; T12 verbatim) ────────

function yamlScalar(v) {
  if (v === null) return 'null'
  if (typeof v === 'string') return JSON.stringify(v)
  return String(v)
}
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
  if (Array.isArray(item)) {
    if (item.length === 0) return [`${pad}- []`]
    return [`${pad}-`, ...yamlValueLines(item, indent + 1)]
  }
  const entries = Object.entries(item)
  const [firstKey, firstValue] = entries[0]
  const firstLines = yamlEmit(firstKey, firstValue, indent + 1)
  const rest = entries.slice(1).flatMap(([k, v]) => yamlEmit(k, v, indent + 1))
  return [`${pad}- ${firstLines[0].slice((indent + 1) * 2)}`, ...firstLines.slice(1), ...rest]
}

function writeS8Patch(patchPath, comment) {
  mkdirSync(dirname(patchPath), { recursive: true })
  const lines = [
    `# S8 boot patch layer (${comment}): production dsh-agent-team row (built packages/runtime host) + dsh-agent-team-client shim row (S8 home-local browser half) + p6t6 observability row (reused T12 health gate).`,
    '# Pins the in-app directory picker (-browse): on win32 + loopback bind the',
    '# auto chooser resolves to -native (renderless OS dialog), which headless',
    '# automation cannot drive; the web-app bundle documents overlay-pinning the',
    '# backend pair directly.',
    '- insert:',
    ...yamlEmitItem({ id: 'dsh-agent-team', name: HOST_URL, config: s8RowConfig() }, 2),
    ...yamlEmitItem({ id: 'dsh-agent-team-client', name: CLIENT_ROW_NAME }, 2),
    ...yamlEmitItem({ id: 'p6t6-team-tools', name: P6T6_URL }, 2),
    ...yamlEmitItem({ id: 'directory-picker', disabled: true }, 0),
    '- insert:',
    ...yamlEmitItem({ id: 'directory-picker-browse', name: '@deepseek-ai/dsh-host-directory-picker-browse' }, 2),
    ...yamlEmitItem({ id: 'directory-picker-browse-client', name: '@deepseek-ai/dsh-client-ui-directory-picker-browse' }, 2),
    '',
  ]
  writeFileSync(patchPath, lines.join('\n'))
}

// ── HTTP helpers ────────────────────────────────────────────────────────────

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
      rpcId: `s8v-${Date.now().toString(16)}${Math.floor(Math.random() * 1e6).toString(16)}`,
      method,
      payload: { version: 1, params },
    }),
  }, 60_000)
}

async function p6t6Health(port) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/health`, undefined, 10_000)
}

async function healthReady(origin, log) {
  const deadline = Date.now() + 180_000
  let last = null
  for (;;) {
    const hb = await p6t6Health(PORT)
    last = { status: hb.status, body: hb.body }
    if (hb.status === 200 && hb.body?.ok === true && hb.body?.toolCount === 10) return last
    if (hb.status === 200 && hb.body?.ok === false && hb.body?.setupError !== undefined) {
      throw new Error(`row setup failed (definitive): ${JSON.stringify(hb.body).slice(0, 600)}`)
    }
    if (Date.now() >= deadline) throw new Error(`row health not ready in 180s — ${JSON.stringify(hb.body).slice(0, 400)}`)
    await new Promise((r) => setTimeout(r, 1000))
  }
}

// ── worktree node_modules link reconciliation (R122 / upstream rc.1) ──────
// The instance-loaded files (runtime dist host.js, agent-bindings.mjs, the
// harness .mjs seams) live in the RC1 worktree and import bare specifiers
// (`@deepseek-ai/*` workspace packages, plus npm `zod` and `yaml`). The
// e2e harnesses create a gitignored "junction farm" for these via
// ensureProbeResolution (tests/characterization/lib/instance.mjs) — but a
// fresh task worktree never ran those e2es, so the farm is absent. The
// shipped upstream-resolver.mjs hook would not help either: its checkout
// discovery miscounts path segments (pre-existing, latent) and has never
// actually redirected. Reconcile the s8 boot the same way the harnesses
// do: scan the instance-loaded surface for bare import specifiers, classify
// (@deepseek-ai/* -> TU workspace package dir; npm -> pnpm virtual store,
// worktree first then TU; bare builtin names skipped), and create the
// missing junctions at <WT>/node_modules via ensureProbeResolution. Only
// the worktree's gitignored node_modules is touched (TU untouched); created
// links are recorded in state.json and removed by `stop`.

function walkJsFiles(dir, out) {
  if (!existsSync(dir)) return
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walkJsFiles(p, out)
    else if (e.name.endsWith('.js') || e.name.endsWith('.mjs') || e.name.endsWith('.cjs')) out.push(p)
  }
}

/** Node builtins imported in legacy form (no `node:` prefix). */
const BUILTIN_BARE = new Set(['module'])

/** Locate the TU workspace package dir by exact package name. */
function findTuWorkspaceDir(name) {
  const groups = readdirSync(join(HOST_TREE, 'packages'), { withFileTypes: true })
    .filter((e) => e.isDirectory())
  for (const g of groups) {
    const gpath = join(HOST_TREE, 'packages', g.name)
    const candidates = [gpath, ...readdirSync(gpath, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => join(gpath, e.name))]
    for (const c of candidates) {
      const pj = join(c, 'package.json')
      if (existsSync(pj) && JSON.parse(readFileSync(pj, 'utf8')).name === name) return c
    }
  }
  return null
}

/** Locate an npm package inside a pnpm virtual store (worktree, then TU). */
function findPnpmStoreDir(name) {
  const flat = name.replace('/', '+')
  const esc = flat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  for (const store of [join(WT, 'node_modules', '.pnpm'), join(HOST_TREE, 'node_modules', '.pnpm')]) {
    if (!existsSync(store)) continue
    const hits = readdirSync(store)
      .filter((n) => new RegExp('^' + esc + '@\\d').test(n))
      .sort()
    for (let i = hits.length - 1; i >= 0; i--) {
      const dir = join(store, hits[i], 'node_modules', ...name.split('/'))
      if (existsSync(join(dir, 'package.json'))) return dir
    }
  }
  return null
}

function reconcileTuLinks() {
  const scanRoots = [
    join(WT, 'packages', 'runtime', 'dist'),
    join(WT, 'packages', 'runtime', 'root-binding', 'harness'),
    join(WT, 'packages', 'runtime', 'member-residency', 'harness'),
    join(WT, 'packages', 'tools', 'harness'),
  ]
  const files = []
  for (const r of scanRoots) walkJsFiles(r, files)
  const specifiers = new Set()
  const re = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g
  for (const f of files) {
    const src = readFileSync(f, 'utf8')
    let m
    while ((m = re.exec(src)) !== null) {
      const sp = m[1]
      // Skip template interpolations, whitespace, URLs/typed specifiers,
      // and relative paths (relative resolves inside the worktree anyway).
      if (sp.includes(':') || sp.includes('$') || sp.startsWith('.') || /\s/.test(sp)) continue
      const name = sp.startsWith('@') ? sp.split('/').slice(0, 2).join('/') : sp.split('/')[0]
      specifiers.add(name)
    }
  }
  const created = []
  const preexisting = []
  const skipped = []
  const unresolved = []
  for (const name of [...specifiers].sort()) {
    if (BUILTIN_BARE.has(name)) {
      skipped.push(name)
      continue
    }
    const link = join(WT, 'node_modules', ...name.split('/'))
    if (existsSync(join(link, 'package.json'))) {
      preexisting.push(name)
      continue
    }
    const dir = name.startsWith('@deepseek-ai/') ? findTuWorkspaceDir(name) : findPnpmStoreDir(name)
    if (dir === null) {
      unresolved.push(name)
      continue
    }
    created.push({ name, dir, link })
  }
  if (created.length > 0) {
    ensureProbeResolution({ probesDir: WT, packages: created, log })
  }
  return { specifiers: [...specifiers].sort(), created, preexisting, skipped, unresolved }
}

// ── boot ────────────────────────────────────────────────────────────────────

async function boot() {
  const stamp = process.env.S8_STAMP ?? new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const home = join(REPO, 'references', `.dsh-test-s8-${stamp}`)
  if (existsSync(home)) {
    // Home lifecycle: a stopped/aborted earlier attempt (no live state.json
    // for this home) is cleaned and retried in place; a completed, still
    // live home is refused.
    let live = false
    if (existsSync(STATE_FILE)) {
      const st = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
      live = st.home === home && st.stoppedAt === undefined
    }
    if (live) die(`S8 home already booted (state.json live): ${home} — run 'stop' first`)
    rmSync(home, { recursive: true, force: true })
    log(`inert S8 home removed for retry: ${home}`)
  }
  mkdirSync(home, { recursive: true })
  log(`S8 home: ${home}`)
  // The instance starts with no workspaces; the GUI composer stays inert
  // until one exists. Pre-create a dedicated workspace directory the vertical
  // scenario adopts through the in-app (-browse) directory picker.
  const workspaceDir = join(home, 'workspace-s8v')
  mkdirSync(workspaceDir, { recursive: true })

  // The frozen legacy reader is a hand-written .mjs in src; tsc (no allowJs)
  // never copies .mjs into dist, so the host glue URL needs a dist mirror
  // (P9 boot prep did this ad hoc). Sync it here so a freshly built worktree
  // is bootable without a manual step.
  const glueSrc = join(WT, 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs')
  const glueDst = join(WT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs')
  if (existsSync(glueSrc) && !existsSync(glueDst)) {
    mkdirSync(dirname(glueDst), { recursive: true })
    copyFileSync(glueSrc, glueDst)
    log('dist mirror synced: agent-bindings.mjs (src -> dist; tsc does not copy .mjs)')
  }

  // Worktree link reconciliation: ensure every @deepseek-ai/* specifier the
  // instance-loaded surface imports is resolvable from the worktree's
  // ordinary node_modules walk. Creates recorded junctions (targets = TU
  // workspace dirs) for the ones the worktree install left unlinked.
  const tuLinks = process.env.S8_FARM === '1' ? reconcileTuLinks() : { specifiers: [], created: [], preexisting: [], skipped: ['farm-disabled: declared-deps fresh-machine mode (R125)'], unresolved: [] }
  log(`worktree link reconciliation: ${tuLinks.specifiers.length} specifiers, ${tuLinks.created.length} created, ${tuLinks.preexisting.length} preexisting, ${tuLinks.skipped.length} builtin-skipped, ${tuLinks.unresolved.length} unresolved`)
  if (tuLinks.unresolved.length > 0) die(`bare specifier not linkable for: ${tuLinks.unresolved.join(', ')}`)

  // Pre-flight: the built production artifacts must exist (S8-A build).
  for (const [label, p] of [
    ['host.js', join(WT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js')],
    ['agent-bindings.mjs', join(WT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs')],
    ['seam.mjs', join(WT, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')],
  ]) {
    if (!existsSync(p)) die(`missing built artifact ${label}: ${p}`)
  }
  if (await portInUse(PORT)) die(`port ${PORT} is in use`)
  if (await portInUse(MOCK_PORT)) die(`port ${MOCK_PORT} is in use`)
  mkdirSync(join(EV, 'workspace'), { recursive: true })

  // Shim placement (the home-local client row package: node half + manifest
  // + browser bundle).
  const shimDir = join(home, 's8-client-row')
  mkdirSync(shimDir, { recursive: true })
  const bundleSrc = readFileSync(join(SHIM_SRC, 'client-bundle.js'))
  const bundleShasrc = sha256(bundleSrc)
  for (const f of ['client-bundle.js', 'index.js', 'package.json']) {
    copyFileSync(join(SHIM_SRC, f), join(shimDir, f))
  }
  const bundleShadst = sha256(readFileSync(join(shimDir, 'client-bundle.js')))
  if (bundleShasrc !== bundleShadst) die('shim bundle copy sha256 mismatch')
  log(`shim placed at ${shimDir} (client-bundle.js sha256=${bundleShasrc.slice(0, 16)}…, ${bundleSrc.length} B)`)

  // Profile (throwaway boot if needed) + patch layer.
  const logDir = join(EV, 'instances')
  mkdirSync(logDir, { recursive: true })
  const instance = new DshInstance({ hostTree: HOST_TREE, dshHome: home, port: PORT, clientCommitHash: CLIENT_COMMIT_HASH, logDir })
  const profile = await ensureProfile({ instance, log, timeoutMs: 90_000 })
  log(`profile ${profile.created ? 'created via throwaway boot' : 'already initialized'}`)
  writeS8Patch(instance.patchFile, `stamp ${stamp}`)
  log(`patch layer written to ${instance.patchFile}`)

  // The p6t6-team-tools row reads its run directive from the DSH_HOME root
  // (T12 bootWorld writes the same file; without it the row latches
  // setupError ENOENT and /__p6t6/health fast-fails).
  const directive = {
    boot: 1,
    phase: 'create',
    reportDir: EV,
    runStamp: stamp,
    rootSessionId: S8_ROOT_SESSION_ID,
  }
  writeFileSync(join(home, 'p6t6-directive.json'), JSON.stringify(directive, null, 2))
  log(`p6t6 directive written to ${join(home, 'p6t6-directive.json')} (boot=1 phase=create)`)

  // Mock model (IN-PROCESS HTTP server — it must live as long as the boot
  // job, because the harness job kill tears the whole process tree down;
  // detached children do not survive it). Launch environment exported.
  const mockLogPath = join(EV, 'mock-model.log')
  const mock = await startMockModel({
    port: MOCK_PORT,
    decide: ({ seq: s, req }) => {
      appendFileSync(mockLogPath, `[${new Date().toISOString()}] mock: req ${s} model=${JSON.stringify(req?.model ?? null)}\n`)
      // Deterministic per-sequence text reply; content is opaque to the
      // team flow — the vertical asserts on structure, not model prose.
      return { kind: 'text', content: `S8-M${s} ok (${req?.model ?? 'unknown-model'}).` }
    },
    log: (l) => appendFileSync(mockLogPath, `[${new Date().toISOString()}] ${l}\n`),
  })
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${mock.port}`
  process.env.DEEPSEEK_API_KEY = 's8v-mock-key'
  log(`mock DeepSeek endpoint up at 127.0.0.1:${mock.port} (in-process); DEEPSEEK_BASE_URL/DEEPSEEK_API_KEY exported to instance launches`)

  // Boot the production instance.
  const started = await instance.start({ timeoutMs: 180_000 })
  _instancePid = instance.child?.pid ?? null
  const markerLine = await waitForLogLine(started.logPath, BOOT_MARKER, 30_000)
  if (markerLine === null) throw new Error(`boot marker not found in ${started.logPath}`)
  const token = markerLine.slice(markerLine.indexOf('token=') + 6).trim()
  const origin = `http://127.0.0.1:${PORT}`
  log(`booted at ${origin}; boot line: ${markerLine.trim()}`)
  const cookie = await authenticate(origin, token)
  log(`auth cookie exchanged (${cookie.slice(0, 12)}…); instance pid ${instance.child?.pid ?? 'unknown'}`)

  // Evidence: the rendered index page — its injected /plugins/ URLs are the
  // composed boot graph (the definitive list of client rows the module
  // registry recognized).
  const idxRes = await fetch(origin, { headers: { cookie }, signal: AbortSignal.timeout(30_000) })
  const idxText = await idxRes.text()
  writeFileSync(join(EV, 'index-s8.html'), idxText)
  // The rendered HTML entity-encodes the combo URL's '&' as '&amp;'; decode
  // before re-fetching — the served table is keyed by the raw URL.
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
  // Runs FIRST: the boot marker only means the HTTP server listens; the
  // plugin fibers (incl. the `/team-remote` RPC channel registration) may
  // still be activating, and the channel's route does not exist until the
  // host row's apply completes (unmatched POSTs fall through to
  // frontend-static, which answers 405).
  const health = await healthReady(origin, log)
  log(`row ready — health=${JSON.stringify(health.body).slice(0, 300)}`)

  // Gate 2 — the 401 gate: the public remote channel must reject unauthenticated.
  // 401/403 = the channel route exists and its trust fence answered;
  // 404/405 = the route is not registered (fiber still pending or failed).
  // Sibling-row activation race: p6t6 ready does not strictly order the
  // dsh-agent-team row's channel registration, so allow a short grace period.
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

  // Gate 3 — dump-config: all three rows present.
  const dump = await instance.dumpConfig({ timeoutMs: 60_000 })
  const dumpPath = join(EV, 'dump-config-s8.txt')
  writeFileSync(dumpPath, dump.text)
  const rows = {
    'dsh-agent-team': DshInstance.rowInDump(dump.text, { id: 'dsh-agent-team', name: HOST_URL }),
    // The dump normalizes row names to resolved absolute file URLs, so check
    // the resolved shim URL (the patch file keeps the relative name).
    'dsh-agent-team-client': DshInstance.rowInDump(dump.text, { id: 'dsh-agent-team-client', name: pathToFileURL(join(home, 's8-client-row', 'index.js')).href }),
    'p6t6-team-tools': DshInstance.rowInDump(dump.text, { id: 'p6t6-team-tools', name: P6T6_URL }),
  }
  log(`dump-config → ${dumpPath}; rows=${JSON.stringify(rows)}`)
  if (Object.values(rows).some((v) => !v)) die(`dump-config row check failed: ${JSON.stringify(rows)}`)

  // Gate 4 — bundle served byte-identical (the D2-style pre-check).
  // The composed boot graph (index-s8.html) is authoritative for the served
  // URL: either the standalone entry or a combo containing our package.
  const singleUrl = idxPluginUrls.find((u) => u.includes(CLIENT_PKG_NAME) && u.endsWith('/client.js'))
  const comboUrl = idxPluginUrls.find((u) => u.includes(CLIENT_PKG_NAME) && u.includes('/client.js') && !u.endsWith('/client.js'))
  if (singleUrl === undefined && comboUrl === undefined) {
    die(`client row not in the composed boot graph — no /plugins/ URL for ${CLIENT_PKG_NAME}; injected=${JSON.stringify(idxPluginUrls)}`)
  }
  const servePath = singleUrl ?? comboUrl
  const servedRes = await fetch(`${origin}${servePath}`, {
    headers: { cookie }, signal: AbortSignal.timeout(30_000),
  })
  const servedBuf = Buffer.from(await servedRes.arrayBuffer())
  const servedSha = sha256(servedBuf)
  const servedContentType = servedRes.headers.get('content-type')
  const unauthServed = await fetch(`${origin}${servePath}`, { signal: AbortSignal.timeout(30_000) })
  // Standalone entry: exact byte identity. Combo: our bundle bytes must be a
  // contiguous substring of the assembled combo body.
  const isCombo = singleUrl === undefined
  const bundleBytes = bundleSrc
  const containsBundle = !isCombo ? servedSha === bundleShasrc : servedBuf.includes(bundleBytes)
  const serveCheck = {
    mode: isCombo ? 'combo' : 'standalone',
    url: servePath,
    status: servedRes.status,
    contentType: servedContentType,
    bytes: servedBuf.length,
    sha256: servedSha,
    sha256MatchesShim: servedSha === bundleShasrc,
    bundleBytesContained: servedBuf.includes(bundleBytes),
    unauthenticatedStatus: unauthServed.status,
  }
  writeFileSync(join(EV, 'serve-check.json'), JSON.stringify(serveCheck, null, 2))
  log(`serve check: ${JSON.stringify(serveCheck)}`)
  if (servedRes.status !== 200 || !containsBundle) {
    die(`bundle serve check failed: ${JSON.stringify(serveCheck)}`)
  }

  // Gate 5 — live remote channel (catalog.list with the auth cookie).
  const catalog = await remoteCall(origin, cookie, 'catalog.list', {})
  const catalogCheck = { status: catalog.status, bodyExcerpt: JSON.stringify(catalog.body).slice(0, 1200) }
  writeFileSync(join(EV, 'catalog-list-s8.json'), JSON.stringify({ status: catalog.status, body: catalog.body }, null, 2))
  log(`catalog.list with cookie: HTTP ${catalog.status}; ${catalogCheck.bodyExcerpt.slice(0, 300)}`)
  if (catalog.status !== 200) die(`catalog.list with cookie returned ${catalog.status}: ${catalogCheck.bodyExcerpt}`)

  const state = {
    stamp, home, workspaceDir, port: PORT, mockPort: mock.port,
    origin, token, cookie,
    instancePid: instance.child?.pid ?? null,
    bootJobPid: process.pid,
    logPath: started.logPath,
    dumpPath,
    shim: { dir: shimDir, bundleSha256: bundleShasrc, bytes: bundleSrc.length },
    wtLinks: {
      created: tuLinks.created.map((c) => ({ name: c.name, link: c.link, target: c.dir })),
      preexisting: tuLinks.preexisting,
    },
    rows, serveCheck,
    startedAt: new Date().toISOString(),
  }
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
  log(`state.json written to ${STATE_FILE}`)
  log('S8-READY')
  console.log('S8-READY')

  // Stay alive: the boot job holds the instance child + the in-process mock
  // (the harness job kill tears the whole tree down). Exit cleanly when the
  // instance child dies (stop) or on SIGTERM.
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
  const served = await fetch(`${state.origin}${CLIENT_SERVE_PATH}`, {
    headers: { cookie: state.cookie }, signal: AbortSignal.timeout(15_000),
  })
  const servedBuf = Buffer.from(await served.arrayBuffer())
  const catalog = await remoteCall(state.origin, state.cookie, 'catalog.list', {})
  log(`status: health=${JSON.stringify(hb.body).slice(0, 200)}; serve HTTP ${served.status} sha256=${sha256(servedBuf).slice(0, 16)}… (shim ${state.shim.bundleSha256.slice(0, 16)}…); catalog.list HTTP ${catalog.status}`)
}

// ── stop ────────────────────────────────────────────────────────────────────

async function stop() {
  if (!existsSync(STATE_FILE)) die(`no state.json at ${STATE_FILE}`)
  const state = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
  // taskkill is sandbox-denied here; node process.kill works (verified).
  // Killing the instance child triggers the boot job's clean shutdown
  // (instance.stop + mock.close + port waits) via its child-exit handler.
  if (state.instancePid === null || state.instancePid === undefined) {
    log('stop: no instancePid in state.json (already stopped?)')
  } else {
    try {
      process.kill(state.instancePid)
      log(`stop: instance pid ${state.instancePid} signaled`)
    } catch (e) {
      log(`stop: instance pid ${state.instancePid} kill note: ${String(e?.message ?? e).slice(0, 200)}`)
    }
  }
  const p1 = await waitForPortFree(PORT, 60_000)
  const p2 = await waitForPortFree(state.mockPort ?? MOCK_PORT, 60_000)
  log(`stop: ports free — ${PORT}:${p1} ${state.mockPort ?? MOCK_PORT}:${p2}`)
  if (!p1 || !p2) die('ports not free after stop — manual cleanup required')
  const tail = logTail(state.logPath, 15)
  appendFileSync(BOOT_LOG, `stop: instance log tail:\n${tail}\n`)
  // Remove the worktree node_modules junctions this boot created
  // (reversibility; `stop` restores the worktree install state to exactly
  // what the boot found).
  if (state.wtLinks && Array.isArray(state.wtLinks.created) && state.wtLinks.created.length > 0) {
    for (const c of state.wtLinks.created) {
      try {
        rmSync(c.link)
        log(`worktree link removed: ${c.name}`)
      } catch (e) {
        log(`worktree link removal note: ${c.name}: ${String(e?.message ?? e).slice(0, 200)}`)
      }
    }
    state.wtLinks.removedAt = new Date().toISOString()
  }
  if (state.stoppedAt === undefined) {
    state.stoppedAt = new Date().toISOString()
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
  }
  log('S8-STOPPED')
}

const [, , cmd] = process.argv
if (cmd === 'boot') await boot()
else if (cmd === 'status') await status()
else if (cmd === 'stop') await stop()
else die(`unknown command ${JSON.stringify(cmd)} (expected boot|status|stop)`)
