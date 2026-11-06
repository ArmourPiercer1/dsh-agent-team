#!/usr/bin/env node
/**
 * run-boot.mjs — the Web face's DEV-LIVE iteration driver (a5sf-web-devlive).
 *
 * DERIVED FROM `a5sf-bl18-live2/run-boot.mjs` (the fixed driver of PR #627),
 * with exactly two substantive changes:
 *
 *   1. THE HEALTH GATE POLLS. Boot #5 aborted on a single `GET
 *      /__p6t6/health` that answered 404 while the product boot was still
 *      PENDING; the teardown then disposed the shared storage domain and the
 *      still-running bootstrap reported the disposal as
 *      `TeamDomain is closed` (PD-11 masking). A 404 before the p6t6 row is
 *      ready means PENDING, not failed: a settled failure answers
 *      `200 {ok:false, setupError}`. This driver polls up to the declared boot
 *      timeout, records EVERY probe (status + body + elapsed), and aborts only
 *      on (a) a settled 200 {ok:false} or (b) the timeout.
 *   2. THE AUTHORISATION IS DEV-LIVE. `recordClass: "DEV-LIVE"`, a reusable
 *      `scope: "DEV-LIVE"` grant, a fresh lease per run (no cumulative cap),
 *      one machine slot from `DEV_LIVE_SLOT_LIMIT = 2`, and a
 *      `dev-live-outcome` ledger row. The classes and labels of #626/#627 are
 *      unchanged: both cases stay `caseClass: "admission-refusal"`,
 *      `collector: "guard-fact"`, `observable: "pre-provider-refusal"`,
 *      `expectedCode: "NETWORK_UNCONFINED_REALM"`, `claimsConfinement: false`.
 *
 * THE QUESTION (wiring, not confinement): does the product seam deliver a
 * governed realm to a LEGACY (non-strict) Member whose preset surfaces
 * `web_fetch`/`web_search`, and does the deny lane refuse AT THAT FACE —
 * before the provider — when the model itself calls the tool?
 *
 * IT DOES NOT ASK, AND MUST NEVER CLAIM, NETWORK CONFINEMENT OR ISOLATION.
 * The verified wording lives in
 * `dev/agent-workflow/evidence/a5sf-subprocess-face/README.md` §7:
 *
 *   "Refusing to spawn is **not** evidence of network isolation: it is a
 *    statement about our own admission code, made before the OS was asked."
 *
 * For a fetch the same limit holds word for word. The provider is a FAKE
 * boundary that refuses every entry; zero provider entries is a counter, not
 * an OS fact. `osLevelNetworkIsolationClaimed: false` is stamped on every
 * artefact this driver writes.
 *
 * MODES
 *   --plan              host-free composition; writes the preflight bundle and
 *                       spends ZERO host starts.
 *   --evidence <dir>    the boot. Writes every run artefact into <dir>; refuses
 *                       before any ledger row unless the bundle is bound to the
 *                       current HEAD, the authority pointer matches, and
 *                       `preflight.log` carries a PASS.
 *
 * @module dev/agent-workflow/evidence/a5sf-web-devlive/run-boot
 */
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs'
import { createConnection } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  apiPrompt,
  authenticate,
  emitPatchLayer,
  fetchJson,
  readLedger,
} from '../../../../tests/world-factory/lib/world-factory.mjs'
import {
  createRunRecord,
  formatSummary,
  overallVerdict,
  readAuthorityBinding,
} from '../../../../tests/world-factory/lib/run-record.mjs'
import { createA5sfHarness } from '../../../../tests/world-factory/lib/a5sf-harness.mjs'
import {
  MANAGED_TOOL_NAMES,
  SAFE_UNMANAGED_TOOL_NAMES,
  hasMarker,
  remoteCall,
  surfaceNamesOf,
  toolMsgsOf,
} from '../../../../tests/world-factory/lib/u6-fs-assembly.mjs'
import {
  preRegisterBudget,
  resolveHeadCommit,
} from '../../../../tests/world-factory/suites/150-a5sf-read.mjs'
import { presetDeclarationRow, smokePresetPlugins } from '../../../../tests/kits/_shared/preset-seam.mjs'
import { TEST_USE_BASELINE_SHA } from '../../../../tests/paths.mjs'
import {
  BL18_MARKERS,
  DECLARED_SEARCH,
  DECLARED_URL,
  routeKindOf,
} from '../a5sf-bl18-live/bl18-marker-mock.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..')

/** The pristine pinned host tree (gitignored): this worktree's own if present,
 *  else the main checkout's. Never written. */
function hostTreePath() {
  const local = join(REPO_ROOT, 'tests', 'deepseek-harness-test-use')
  if (existsSync(join(local, 'packages', 'web', 'tool-web', 'lib', 'index.js'))) return local
  return resolve(REPO_ROOT, '..', '..', 'tests', 'deepseek-harness-test-use')
}
const HOST_TREE = hostTreePath()
const HOST_TOOL_WEB = join(HOST_TREE, 'packages', 'web', 'tool-web', 'lib', 'index.js')
const HOST_TOOL_FS = join(HOST_TREE, 'packages', 'fs', 'tool-fs', 'lib', 'index.js')
const HOST_TOOL_BASH_PERSISTENT = join(HOST_TREE, 'packages', 'shell', 'tool-bash-persistent', 'lib', 'index.js')

const LINE = 'a5sfwebdv'
/** The Web face this dev-live authorisation covers. */
const FACE = 'Web'
/** The declared product boot timeout; the health gate may not outlive it. */
const BOOT_TIMEOUT_MS = 240_000

/** The per-run evidence directory. `--plan` writes the shared plan artefacts
 *  into HERE; a boot writes every run artefact into `--evidence <dir>` so a
 *  later run can never overwrite an earlier one. */
function evidenceDir() {
  const i = process.argv.indexOf('--evidence')
  if (i === -1 || process.argv[i + 1] === undefined) return null
  return resolve(process.argv[i + 1])
}
const OUT = evidenceDir() ?? HERE
const RUN_LOG = join(OUT, 'boot.log')
const PLAN_LOG = join(HERE, 'plan.log')
const GRANT_PATH = join(HERE, 'dev-live-grant.json')
const LEDGER_PATH = join(OUT, 'run-ledger.jsonl')
const PREFLIGHT_BUNDLE_PATH = join(HERE, 'preflight-bundle.json')
const PREFLIGHT_LOG_PATH = join(HERE, 'preflight.log')
const RUN_RECORD_PATH = join(OUT, 'run-record.json')
const OFFER_ROW = join(HERE, 'a5sf-web-offer-row.mjs')
const MARKER_MOCK = join(HERE, '..', 'a5sf-bl18-live', 'bl18-marker-mock.mjs')

const ROOT = 'session-a5sf-web-devlive-anchor'
const CREATE_ROOT = 'session-a5sf-web-devlive-team'
const BP_ANCHOR_ID = 'team.a5sf.web.devlive.anchor'
const BP_MAIN_ID = 'team.a5sf.web.devlive.main'
const PRESET_LEADER = 'a5sf-web-devlive-leader'
const PRESET_MEMBER = 'a5sf-web-devlive-webworker'
const MEMBER_TEMPLATE = 'webworker'
const BINDING = 'team/web'
const LIMIT_SENTENCE = 'Refusing to spawn is **not** evidence of network isolation: it is a statement about our own admission code, made before the OS was asked.'

/** The driver's OWN case manifest — the preflight parses THIS literal. */
const CASES = ['web-deny-fetch', 'web-deny-search']

const CASE_IDS = Object.freeze([...CASES])
const PLAN_CASES = Object.freeze(CASES.map((id) => (id === 'web-deny-fetch'
  ? { id, method: 'web:fetch', tool: 'web_fetch', args: { url: DECLARED_URL }, marker: BL18_MARKERS.fetch, memberTemplate: 'webworker-fetch' }
  : { id, method: 'web:search', tool: 'web_search', args: { queries: [...DECLARED_SEARCH.queries] }, marker: BL18_MARKERS.search, memberTemplate: 'webworker-search' })))

const SUITE = 'a5sf-web-devlive'
const PLAN_ONLY = process.argv.includes('--plan')

/** The exact row set/order handed to the World (one source for plan + bundle). */
export const ROW_IDS = Object.freeze([
  'a5sf-bl18-web-offer',
  'dsh-agent-team',
  'p6t6-team-tools',
  `preset-${PRESET_LEADER}`,
  `preset-${PRESET_MEMBER}`,
])

// ─────────────────────────────────────────────────────────────────────────────
// small utilities
// ─────────────────────────────────────────────────────────────────────────────

function logTo(path, line) {
  const text = `[${new Date().toISOString()}] ${line}`
  // eslint-disable-next-line no-console
  console.log(text)
  try {
    appendFileSync(path, `${text}\n`)
  } catch {
    /* the console is the live channel */
  }
}
const log = (line) => logTo(PLAN_ONLY ? PLAN_LOG : RUN_LOG, line)

const sha256File = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')
const redact = (text) => String(text ?? '').replace(/\?token=[A-Za-z0-9_-]+/gu, '?token=<redacted>')
const readJson = (path) => {
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return null }
}
const parseJsonl = (path) => {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8').split('\n').filter((line) => line.trim() !== '').map((line) => {
    try { return JSON.parse(line) } catch { return { unparseable: line.slice(0, 200) } }
  })
}
const writeJson = (path, value) => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

async function waitFor(predicate, timeoutMs, everyMs = 400) {
  const t0 = Date.now()
  for (;;) {
    let value = null
    try { value = await predicate() } catch { value = null }
    if (value !== null && value !== undefined && value !== false) return { hit: true, value, elapsedMs: Date.now() - t0 }
    if (Date.now() >= t0 + timeoutMs) return { hit: false, value, elapsedMs: Date.now() - t0 }
    await sleep(everyMs)
  }
}

/**
 * THE POLLING HEALTH GATE (PD-11 fix).
 *
 * `GET /__p6t6/health` answers 404 until the p6t6 row has finished its setup:
 * before that the route is simply not registered, which means PENDING, not
 * failed. A settled failure is different by construction — the failure path
 * registers the same route and answers `200 {ok:false, setupError}`. So:
 *
 *   - 200 {ok:true}         -> READY, return immediately;
 *   - 200 {ok:false}        -> SETTLED FAILURE, return it with its body (the
 *                              caller aborts with the product's own error);
 *   - 404 (or any non-200,
 *     or a transport error) -> PENDING, keep polling until the timeout.
 *
 * EVERY probe is retained with its timestamp, status, body and elapsed time,
 * so the record shows what the gate actually saw rather than its last reading.
 * Aborting while pending is what produced boot #5's masked
 * `TeamDomain is closed`; this gate may only abort on a settled failure or on
 * the declared timeout.
 *
 * @param {string} origin
 * @param {{timeoutMs?: number, everyMs?: number, requestTimeoutMs?: number}} [options]
 * @returns {Promise<{kind: 'ready'|'failed'|'timeout', probes: object[], final: object|null, elapsedMs: number, timeoutMs: number}>}
 */
async function pollHealth(origin, { timeoutMs = BOOT_TIMEOUT_MS, everyMs = 500, requestTimeoutMs = 30_000 } = {}) {
  const t0 = Date.now()
  const probes = []
  for (;;) {
    let probe = null
    let error = null
    try {
      probe = await fetchJson(`${origin}/__p6t6/health`, undefined, requestTimeoutMs)
    } catch (caught) {
      error = String(caught?.message ?? caught)
    }
    const entry = {
      seq: probes.length + 1,
      at: new Date().toISOString(),
      elapsedMs: Date.now() - t0,
      status: probe?.status ?? null,
      body: probe?.body ?? null,
      ...(error === null ? {} : { error }),
    }
    probes.push(entry)
    const kind = entry.status === 200 && entry.body?.ok === true
      ? 'ready'
      : entry.status === 200 && entry.body?.ok === false
        ? 'failed'
        : 'pending'
    if (kind !== 'pending') return { kind, probes, final: entry, elapsedMs: Date.now() - t0, timeoutMs }
    if (Date.now() - t0 >= timeoutMs) return { kind: 'timeout', probes, final: probes[probes.length - 1] ?? null, elapsedMs: Date.now() - t0, timeoutMs }
    await sleep(everyMs)
  }
}

function portOpen(port, timeoutMs = 2500) {
  return new Promise((done) => {
    const socket = createConnection({ port, host: '127.0.0.1' })
    let settled = false
    const finish = (open) => {
      if (settled) return
      settled = true
      socket.destroy()
      done(open)
    }
    socket.once('connect', () => finish(true))
    socket.once('error', () => finish(false))
    setTimeout(() => finish(false), timeoutMs)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// authority / preflight bundle
// ─────────────────────────────────────────────────────────────────────────────

export function authorityBlock() {
  const pointerPath = 'dev/engineering/current-authority.json'
  const pointer = readJson(join(REPO_ROOT, pointerPath)) ?? {}
  const snapshot = readJson(join(REPO_ROOT, 'dev', 'engineering', 'authority-snapshots', `${String(pointer.snapshot_version)}.json`)) ?? {}
  const contract = snapshot.current_contract ?? {}
  return {
    pointerPath,
    snapshotVersion: String(pointer.snapshot_version ?? ''),
    contentDigest: String(pointer.content_digest ?? ''),
    baseline: String(contract.baseline ?? ''),
    pointerSha256: sha256File(join(REPO_ROOT, pointerPath)),
  }
}

export function buildPreflightBundle({ head, rowIds, workspaceLabel = 'tests/homes/<world>/workspace' }) {
  const authority = authorityBlock()
  const rel = (p) => p.slice(REPO_ROOT.length + 1)
  const priorRows = 0
  const cases = PLAN_CASES.map((c) => ({
    id: c.id,
    face: 'web',
    axis: 'network',
    locator: c.tool === 'web_fetch' ? DECLARED_URL : `queries=${JSON.stringify([...DECLARED_SEARCH.queries])}`,
    guardFactKey: c.id,
    expected: 'deny',
    method: 'fetch',
    collector: 'guard-fact',
    returnShape: ['call', 'result', 'claim'],
    terminate: true,
    archiveBeforeStart: true,
    corpus: [c.id],
    observable: 'pre-provider-refusal',
    expectedCode: 'NETWORK_UNCONFINED_REALM',
    expectedFact: { method: c.method, decision: 'deny', decidedBy: 'NETWORK_UNCONFINED_REALM' },
    providerEntries: { fetch: 0, search: 0, transport: 0, dns: 0, connect: 0 },
    caseClass: 'admission-refusal',
    guardFacts: 1,
    refusalNaming: 'capability',
    claimsConfinement: false,
    note: c.tool === 'web_fetch'
      ? 'the Member model turn calls web_fetch on the declared URL; the confined web face refuses at admission, before the fake boundary is entered'
      : 'the Member model turn calls web_search with the declared queries; the confined web face refuses at admission, before the fake boundary is entered',
  }))
  return {
    schema: 'a5sf-zero-boot-preflight/1',
    label: 'Web face DEV-LIVE — legacy-Member web deny lane (face WIRING; no confinement claim)',
    sources: {
      note: 'Derived from this driver at the exact HEAD the run executes on. The declared leader surface is the LEADER preset surface (persona + tool-fs + persistent shell; NO tool-web) plus the two World rows minus the discovery-first deny list; the web pair is surfaced on the MEMBER preset (tool-web) and is what route-C shadows. Every case is class admission-refusal: one guard fact, zero provider entries, claimsConfinement=false. The refusal is pre-provider and pre-OS; this bundle makes no network-isolation claim.',
      driver: rel(join(HERE, 'run-boot.mjs')),
      providerRow: rel(OFFER_ROW),
      markerMock: rel(MARKER_MOCK),
      assemblyProof: 'dev/agent-workflow/evidence/a5sf-bl18-live/README.md',
      limit: LIMIT_SENTENCE,
    },
    candidate: {
      head,
      baseline: authority.baseline,
      pin: TEST_USE_BASELINE_SHA,
      productTreeProof: [],
    },
    authority: {
      pointerPath: authority.pointerPath,
      snapshotVersion: authority.snapshotVersion,
      contentDigest: authority.contentDigest,
      baseline: authority.baseline,
      pointerSha256: authority.pointerSha256,
    },
    grant: {
      grantId: 'devlive-web-1',
      scope: 'DEV-LIVE',
      grantedBy: 'owner 2026-11-09 ruling (docs/DEV-LIVE-OPERATOR-GUIDE.md), relayed by the Web-face implementer: dev-live scope authorisation for the Web face',
      face: FACE,
      world: LINE,
      allocationItem: 'Web face development loop — live wiring of the confined web face and the NETWORK_UNCONFINED_REALM deny lane',
      boundCommit: head,
      priorRows,
      // DEV-LIVE has no cumulative cap: these two numbers describe THIS plan
      // (one intent row + one boot on a fresh per-run ledger), not a budget.
      plannedStarts: 1,
      maxStarts: priorRows + 1 + 1,
      aborts: 0,
      note: 'scope=DEV-LIVE: reusable authorisation, no cumulative cap; one fresh lease per run; maxStarts here only bounds this single planned start for the zero-boot preflight',
    },
    runRecord: {
      teamSha: head,
      hostSha: TEST_USE_BASELINE_SHA,
      recordClass: 'DEV-LIVE',
      ledger: { bootRows: 1, plannedStarts: 1, aborts: 0 },
      bindings: {
        authority: {
          pointer: { snapshot_version: authority.snapshotVersion, content_digest: authority.contentDigest },
          baseline: authority.baseline,
          pointerSha256: authority.pointerSha256,
        },
        osLevelNetworkIsolationClaimed: false,
      },
    },
    assembly: {
      requiredDistFaces: ['web'],
      distFaces: { web: true, fs: true, subprocess: false },
      hostModules: [
        { path: 'tests/deepseek-harness-test-use/packages/web/tool-web/lib/index.js', exists: true, role: 'the pinned @deepseek-ai/dsh-tool-web module route-C re-mounts on the realm scope' },
        { path: 'dev/agent-workflow/evidence/a5sf-web-devlive/a5sf-web-offer-row.mjs', exists: true, role: 'the teamA5sfRealm provider: one compiled Member + the confined web face' },
        { path: 'dev/agent-workflow/evidence/a5sf-web-devlive/run-boot.mjs', exists: true, role: 'this driver' },
        { path: 'dev/agent-workflow/evidence/a5sf-bl18-live/bl18-marker-mock.mjs', exists: true, role: 'the marker routing table' },
      ],
      rowHandoff: {
        usesHandOverRows: true,
        beforeBoot: true,
        emittedRowIds: rowIds,
        worldRowIds: rowIds,
        healthProbeRowPresent: true,
      },
    },
    fixtures: {
      'web-deny-fetch': { url: DECLARED_URL, tool: 'web_fetch' },
      'web-deny-search': { queries: [...DECLARED_SEARCH.queries], tool: 'web_search' },
      workspace: workspaceLabel,
    },
    policy: {
      kind: 'capability-lane',
      network: 'deny',
      networkAccess: 'deny',
      networkProbeEnforced: false,
      effectiveReadAllow: [workspaceLabel],
      effectiveWriteAllow: [workspaceLabel],
      effectiveNetwork: ['deny'],
      note: 'the ceiling is deny; the tool restriction is deny; the ONE compiler (compileEffectiveIo) intersects them. The provider probe reports network-destination=unsupported, so the shipped guard admits the refusal at the face. Refusing to fetch is not network isolation: it is a statement about our admission code, made before the OS was asked.',
      osLevelNetworkIsolationClaimed: false,
    },
    cases,
    driver: {
      note: 'Discovery-first: the anchor leader is prompted and the mock records its model-facing surface; the main blueprint denies every non-managed, non-team, non-safe unmanaged name from that surface. Members are delegated from the SAME template (legacy, no capabilities) two times so each item marker rides a turn whose whole history contains that one item marker. `captures` are full bodies; `captureLimits.body.maxChars=null` declares unbounded retention.',
      steps: [
        { id: 'pre-boot-refusals', canFail: false },
        { id: 'compose-rows', produces: ['rows'], canFail: false },
        { id: 'boot-host', produces: ['host'], canFail: false },
        { id: 'health-gate', requires: ['host'], canFail: true, gate: true, captures: ['status', 'body'], captureLimits: { body: { maxChars: null } } },
        { id: 'discover-leader-surface', requires: ['host'], produces: ['leader-surface'], canFail: true, captures: ['status', 'body', 'mock-requests'], captureLimits: { body: { maxChars: null } } },
        { id: 'write-main-blueprint', requires: ['leader-surface'], produces: ['blueprint'], canFail: true, captures: ['status', 'body'], captureLimits: { body: { maxChars: null } } },
        { id: 'create-team', requires: ['blueprint'], produces: ['team-session'], canFail: true, captures: ['status', 'body'], captureLimits: { body: { maxChars: null } } },
        { id: 'state-gate', requires: ['team-session'], canFail: true, gate: true, captures: ['status', 'body'], captureLimits: { body: { maxChars: null } } },
        { id: 'delegate-fetch-member', requires: ['team-session'], produces: ['member'], canFail: true, captures: ['status', 'body'], captureLimits: { body: { maxChars: null } } },
        { id: 'item1-fetch-deny', requires: ['member'], canFail: true, captures: ['status', 'body', 'guard-facts', 'provider-entries'], captureLimits: { body: { maxChars: null } } },
        { id: 'delegate-search-member', requires: ['team-session'], produces: ['member'], canFail: true, captures: ['status', 'body'], captureLimits: { body: { maxChars: null } } },
        { id: 'item2-search-deny', requires: ['member'], canFail: true, captures: ['status', 'body', 'guard-facts', 'provider-entries'], captureLimits: { body: { maxChars: null } } },
        { id: 'member-state-readback', requires: ['member'], canFail: true, captures: ['status', 'body'], captureLimits: { body: { maxChars: null } } },
        { id: 'teardown', canFail: false },
      ],
      plannedCases: [...CASE_IDS],
      caseManifest: { source: rel(join(HERE, 'run-boot.mjs')), cases: [...CASE_IDS] },
      blueprint: {
        leader: {
          tools: [
            'bash',
            'edit',
            'read',
            'read_image',
            'team_archive_member',
            'team_delegate',
            'u5_canary',
            'u6fs_probe',
            'write',
          ],
          builtinToolDeny: 'discovery-first',
          teamTools: ['team_archive_member', 'team_delegate'],
          managed: [...MANAGED_TOOL_NAMES],
          safeUnmanaged: [...SAFE_UNMANAGED_TOOL_NAMES],
          worldRows: { 'u5-canary': ['u5_canary'], 'u6-fs-probe-host': ['u6fs_probe'] },
          presetTools: ['bash', 'edit', 'read', 'read_image', 'write'],
        },
      },
      caller: {
        kind: 'member',
        strict: false,
        templateId: 'webworker-fetch',
        templates: ['webworker-fetch', 'webworker-search'],
        preset: { module: '@deepseek-ai/dsh-tool-web', tools: ['web_fetch', 'web_search'] },
        note: 'legacy (non-strict) Member: each of the two Member templates declares NO capabilities block, so permissionPolicy is absent and A2C-2 does not run; the MEMBER preset surfaces the pair so route-C can shadow it (route-C refuses to ADD a name). One template per case so each case owns a distinct Member instance (a second delegation on the same template reuses the settled Member).',
      },
    },
    identity: {
      bootRoot: ROOT,
      teamRoot: CREATE_ROOT,
      createRoot: CREATE_ROOT,
      stateQueryRoot: CREATE_ROOT,
      toolRouteRoot: CREATE_ROOT,
      archiveRoot: CREATE_ROOT,
      oracleRoot: CREATE_ROOT,
      directiveRoot: CREATE_ROOT,
      blueprints: [
        { blueprintId: BP_ANCHOR_ID, members: 1 },
        { blueprintId: BP_MAIN_ID, members: 2 },
      ],
      memberBindings: CASE_IDS.map((caseId, index) => ({
        caseId,
        memberIdentity: `inst-bl18-web-${index === 0 ? 'fetch' : 'search'}`,
        toolBindingIdentity: BINDING,
      })),
    },
    nativeModules: [
      {
        name: '@deepseek-ai/dsh-tool-web',
        path: 'tests/deepseek-harness-test-use/packages/web/tool-web/lib/index.js',
        inject: ['tools', 'web', 'systemPrompt'],
        requiredConfig: [],
        config: { fetch: true, search: true, searchTimeoutMs: 60000 },
        expectedTools: ['web_fetch', 'web_search'],
        role: 'the pinned native module route-C re-mounts on the governed realm scope (its ctx.web resolves the confined face)',
      },
    ],
    osLevelNetworkIsolationClaimed: false,
    limits: {
      wording: LIMIT_SENTENCE,
      detail: 'The refusal is a pre-provider admission fact. The provider is a fake boundary with no socket, no DNS, no proxy; zero provider entries is a counter. The OS was never asked, so nothing here proves, and nothing here may claim, network confinement or isolation.',
      osLevelNetworkIsolationClaimed: false,
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// rows / paths / blueprints
// ─────────────────────────────────────────────────────────────────────────────

function lane(allow) {
  return Object.freeze({ mode: 'restricted', allow: Object.freeze([...allow]), ask: Object.freeze([]), deny: Object.freeze([]) })
}

function teamRowConfig({ home }) {
  const dist = join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime')
  return {
    rootSessionId: ROOT,
    bootPhase: 'create',
    blueprintSource: BP_ANCHOR_YAML,
    blueprintDir: join(home, 'blueprints'),
    rootPresetId: PRESET_LEADER,
    memberPresetId: PRESET_MEMBER,
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'a5sf-web-devlive-model' },
    deniedSelection: null,
    mcpServers: [],
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
      { domain: 'persona', subject: 'standard', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    glueUrl: pathToFileURL(join(dist, 'src', 'plugin', 'live', 'agent-bindings.mjs')).href,
    seamUrl: pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href,
    // The guard-fact sink: ONE line per consultation, in call order.
    a5sfEvidencePath: join(home, 'a5sf-consult.jsonl'),
    // Route C: the pinned native module the realm re-mounts on its own scope.
    a5sfNativeToolModules: [{
      url: pathToFileURL(HOST_TOOL_WEB).href,
      config: { fetch: true, search: true, searchTimeoutMs: 60000 },
    }],
  }
}

function rowsFor({ home, workspaceDir }) {
  const workspace = realpathSync(workspaceDir)
  const dist = join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime')
  const PRODUCTION_ROW = pathToFileURL(join(dist, 'src', 'plugin', 'host.js')).href
  const P6T6_ROW = pathToFileURL(join(REPO_ROOT, 'packages', 'tools', 'harness', 'plugin.mjs')).href
  const personaText = 'You are a coding agent powered by the {{model}} model.'
  return {
    workspace,
    paths: {
      workspace,
      sink: join(home, 'a5sf-consult.jsonl'),
      counter: join(home, 'web-provider.jsonl'),
      hostWebCounter: join(home, 'host-web.jsonl'),
    },
    config: teamRowConfig({ home }),
    rows: [
      {
        id: 'a5sf-bl18-web-offer',
        name: pathToFileURL(OFFER_ROW).href,
        config: {
          allowRoot: workspace,
          readAllow: [workspace],
          writeAllow: [workspace],
          counterPath: join(home, 'web-provider.jsonl'),
          hostWebCounterPath: join(home, 'host-web.jsonl'),
          networkDenyTemplates: ['webworker', 'webworker-fetch', 'webworker-search'],
          bindingIdentity: BINDING,
        },
      },
      { id: 'dsh-agent-team', name: PRODUCTION_ROW, config: teamRowConfig({ home }) },
      { id: 'p6t6-team-tools', name: P6T6_ROW },
      presetDeclarationRow({
        id: PRESET_LEADER,
        displayName: 'a5sf Web dev-live leader base',
        description: 'the LEADER preset: persona + tool-fs + persistent shell. It deliberately does NOT surface web_fetch/web_search — the pair belongs to the Member preset under test.',
        plugins: smokePresetPlugins({
          personaText,
          cwdSuffix: 'Your working directory is {{cwd}}.',
          bashDescription: 'Run commands in a bash shell. State is persistent across calls.',
        }),
      }),
      presetDeclarationRow({
        id: PRESET_MEMBER,
        displayName: 'a5sf Web dev-live web worker',
        description: 'the MEMBER preset: the smoke preset plus the pinned @deepseek-ai/dsh-tool-web (both tools). This is the pair route-C must find on the surface before it shadows it.',
        plugins: [
          ...smokePresetPlugins({
            personaText,
            cwdSuffix: 'Your working directory is {{cwd}}.',
            bashDescription: 'Run commands in a bash shell. State is persistent across calls.',
          }),
          { id: 'tool-web', name: '@deepseek-ai/dsh-tool-web', config: { fetch: true, search: true, searchTimeoutMs: 60000 } },
        ],
      }),
    ],
  }
}

function handOverRows(world, rows) {
  if (world?.u6Fs === undefined || !Array.isArray(world.u6Fs.rows)) {
    throw new Error('World contract changed: world.u6Fs.rows is not an array')
  }
  world.u6Fs.rows.push(...rows)
  return world.u6Fs.rows.map((row) => String(row.id))
}

function rowIdentityCheck(rows) {
  for (const row of rows) {
    const spec = String(row?.name ?? '')
    if (!spec.startsWith('file://')) continue
    const modulePath = fileURLToPath(spec)
    if (!existsSync(modulePath)) return { ok: false, reason: 'ROW_MODULE_MISSING', detail: `${String(row.id)} -> ${modulePath} does not exist` }
  }
  return { ok: true }
}

const BP_ANCHOR_YAML = [
  '---', 'schemaVersion: 3', `blueprintId: ${BP_ANCHOR_ID}`, 'revision: "1"',
  'leader:', '  templateId: leader',
  `  persona: ${JSON.stringify(`You are the leader of the a5sf BL-18 anchor team. The driver measures your model-facing tool surface. ${BL18_MARKERS.discovery}. Reply with one short line and stop; call no tool.`)}`,
  'members:',
  '  - templateId: webworker',
  `    persona: ${JSON.stringify('You are an a5sf BL-18 web worker. When the leader asks you to call a web tool, call it exactly once and report the exact error text.')}`,
  'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
  'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
].join('\n')

function mainBlueprintYaml(denyList) {
  const denyLines = denyList.length === 0
    ? ['    builtinToolDeny: []']
    : ['    builtinToolDeny:', ...denyList.map((name) => `        - ${name}`)]
  return [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
    'leader:', '  templateId: leader',
    `  persona: ${JSON.stringify('You are the leader of the a5sf BL-18 live team. The driver delegates the deny-lane probes; do not call tools on your own.')}`,
    '  capabilities:', '    teamTools:', '      kind: allow', '      items:',
    '        - team_delegate', '        - team_archive_member',
    ...denyLines,
    '    skills:', '      kind: allow', '      items: []',
    '    mcp:', '      kind: allow', '      items: []',
    '    permissions:', '      default: deny', '      allow: []', '      ask: []', '      deny: []',
    'teamEnvelope:', '  allow:', '    - create-member', '    - assign-task', '    - send-message', '    - report-progress', '    - archive-member', '  deny: []',
    'members:',
    '  - templateId: webworker-fetch',
    '    displayName: "a5sf web dev-live fetch worker"',
    `    persona: ${JSON.stringify('You are an a5sf web worker. When the leader asks you to call web_fetch, call it exactly once and report the exact error text. Do not call anything else.')}`,
    '  - templateId: webworker-search',
    '    displayName: "a5sf web dev-live search worker"',
    `    persona: ${JSON.stringify('You are an a5sf web worker. When the leader asks you to call web_search, call it exactly once and report the exact error text. Do not call anything else.')}`,
    'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
    'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')
}

const DEFAULT_DENY = ['u5_canary', 'u6fs_probe']

function blueprintFacade() {
  const req = createRequire(join(REPO_ROOT, 'noop.cjs'))
  return req(join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'domain', 'blueprint', 'src', 'index.js'))
}

function assertBlueprintText(text, wantId, wantMembers, label) {
  const facade = blueprintFacade()
  let parsed
  try {
    parsed = facade.parseBlueprint(text)
  } catch (error) {
    throw new Error(`${label} rejected by the host validator: ${String(error?.message ?? error)}`)
  }
  const doc = parsed.blueprint ?? parsed
  if (doc.blueprintId !== wantId) throw new Error(`${label} resolves as ${String(doc.blueprintId)}, want ${wantId}`)
  if (!Array.isArray(doc.members) || doc.members.length !== wantMembers) {
    throw new Error(`${label} members=${String(doc.members?.length)}, want ${wantMembers}`)
  }
  const leaderTools = doc.leader?.capabilities?.builtinToolDeny
  return { ok: true, via: 'parseBlueprint(dist domain facade = the host own import)', builtinToolDeny: Array.isArray(leaderTools) ? leaderTools : null }
}

// ─────────────────────────────────────────────────────────────────────────────
// the mock script (marker-routed; LAST-user-message precedence for items)
// ─────────────────────────────────────────────────────────────────────────────

function makeDecide(routingLog) {
  const served = new Map()
  // The shipped mock calls `decide({ seq, req })` where `req` is the parsed
  // body (packages/tools/harness/mock-deepseek.mjs:265). The inherited driver
  // read its FIRST argument as the body, so every turn fell through to the
  // harmless 'fallback' branch: boot #5 aborted at the health gate before this
  // line was ever exercised. `req` is the request; the wrapper only carries
  // the sequence number.
  return function decide({ seq, req }) {
    const kind = routeKindOf(req)
    const messages = Array.isArray(req?.messages) ? req.messages : []
    let lastUser = ''
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role !== 'user') continue
      const content = messages[i]?.content
      lastUser = typeof content === 'string' ? content : Array.isArray(content) ? content.map((p) => p?.text ?? '').join('\n') : ''
      break
    }
    const items = [BL18_MARKERS.fetch, BL18_MARKERS.search, BL18_MARKERS.create, BL18_MARKERS.collect]
    const lastItem = items.find((marker) => lastUser.includes(marker))
    // The whole-turn classifier can prefer FETCH over SEARCH on a history that
    // carries both; with two Members that cannot happen, but the routing
    // artifact records both answers so the driver never hides the difference.
    // A title/compaction request carries the conversation history INCLUDING
    // the delegation marker; it must never consume an item script (BL-17's
    // title-turn lesson). Only a real agent turn may be re-keyed by the LAST
    // user message, and only to disambiguate a history that carries several
    // item markers.
    const itemKind = lastItem === undefined
      ? null
      : (lastItem === BL18_MARKERS.fetch ? 'fetch' : lastItem === BL18_MARKERS.search ? 'search' : lastItem === BL18_MARKERS.create ? 'create' : 'collect')
    const effective = kind === 'title' || kind === 'discovery'
      ? kind
      : (itemKind ?? kind)
    const count = (served.get(effective) ?? 0) + 1
    served.set(effective, count)
    const markers = items.filter((marker) => messages.some((m) => {
      const content = m?.content
      const text = typeof content === 'string' ? content : Array.isArray(content) ? content.map((p) => p?.text ?? '').join('\n') : ''
      return text.includes(marker)
    }))
    let reply
    let disposition = 'harmless-text'
    if (effective === 'title') {
      reply = { kind: 'text', text: 'a5sf Web dev-live run' }
    } else if (effective === 'discovery') {
      reply = { kind: 'text', text: 'Surface discovery acknowledged. No tool call.' }
    } else if (effective === 'fallback') {
      reply = { kind: 'text', text: 'Acknowledged. No tool call.' }
    } else if (count > 1) {
      reply = { kind: 'text', text: 'That marker was already answered once; no further tool call.' }
      disposition = 'exhausted'
    } else if (effective === 'fetch') {
      reply = { kind: 'tool-call', toolCalls: [{ name: 'web_fetch', arguments: { url: DECLARED_URL } }] }
      disposition = 'tool-call'
    } else if (effective === 'search') {
      reply = { kind: 'tool-call', toolCalls: [{ name: 'web_search', arguments: { queries: [...DECLARED_SEARCH.queries] } }] }
      disposition = 'tool-call'
    } else {
      // create / collect: the shipped mock's team_create/team_collect are not
      // this product's tools; answering a harmless no-tool line keeps the turn
      // out of the deny lane (these markers are not cases).
      reply = { kind: 'text', text: 'Acknowledged. No tool call.' }
    }
    const decision = {
      seq: routingLog.length + 1,
      mockSeq: seq ?? null,
      at: new Date().toISOString(),
      wholeTurnKind: kind,
      lastUserKind: lastItem === undefined ? null : effective,
      effectiveKind: effective,
      markers,
      servedCount: count,
      disposition,
      replyKind: reply.kind,
      toolName: reply.kind === 'tool-call' ? reply.toolCalls[0].name : null,
    }
    routingLog.push(decision)
    // Persist each decision AS IT HAPPENS: an abort later in the run must not
    // destroy the routing record that explains an empty guard-fact set.
    try {
      writeJson(join(OUT, 'marker-routing.json'), {
        decidedBy: 'the driver\'s own decide() log, appended per model request',
        markers: BL18_MARKERS,
        routingLog,
        requests: [],
        osLevelNetworkIsolationClaimed: false,
      })
      appendFileSync(join(OUT, 'marker-routing.jsonl'), `${JSON.stringify(decision)}\n`)
    } catch {
      /* diagnostics never break the turn */
    }
    return reply
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAN
// ─────────────────────────────────────────────────────────────────────────────

async function plan() {
  log(`PLAN MODE — host-free composition. repo=${REPO_ROOT}`)
  log(`pinned host=${TEST_USE_BASELINE_SHA} tree=${HOST_TREE}`)
  for (const [label, path] of [['tool-web', HOST_TOOL_WEB], ['tool-fs', HOST_TOOL_FS], ['persistent-bash', HOST_TOOL_BASH_PERSISTENT]]) {
    if (!existsSync(path)) throw new Error(`the pinned ${label} module is missing: ${path}`)
    log(`pinned module present: ${label} -> ${path}`)
  }
  const offer = await import(pathToFileURL(OFFER_ROW).href)
  if (typeof offer.apply !== 'function' || offer.name !== 'a5sf-bl18-web-offer') {
    throw new Error(`the offer row does not export apply/name as expected: ${JSON.stringify({ name: offer.name, apply: typeof offer.apply })}`)
  }
  log('offer row imports; exports apply + name')
  if (!existsSync(MARKER_MOCK)) throw new Error(`the marker mock is missing: ${MARKER_MOCK}`)
  log('marker routing table present')

  const head = resolveHeadCommit(REPO_ROOT)
  if (head === null) throw new Error('git rev-parse HEAD failed')
  log(`HEAD=${head}`)

  // The anchor parse is unconditional; the main parse uses the declared deny
  // list (the boot rewrites it from discovery and re-parses).
  assertBlueprintText(BP_ANCHOR_YAML, BP_ANCHOR_ID, 1, 'anchor.yaml')
  log('anchor blueprint parses (leader legacy, one member template)')
  const mainExpected = assertBlueprintText(mainBlueprintYaml(DEFAULT_DENY), BP_MAIN_ID, 2, 'main.yaml')
  log(`main blueprint template parses; expected deny=${JSON.stringify(mainExpected.builtinToolDeny)}`)

  const harness = createA5sfHarness({
    repoRoot: REPO_ROOT,
    evidenceRoot: HERE,
    suite: SUITE,
    line: LINE,
    runRecord: { record: { hostStarts: { ledgerPath: join(HERE, 'plan-only-never-written.jsonl') } }, logHostStart() {}, ledgerStartCount() { return 0 } },
    maxHostStarts: 2,
    hostTree: HOST_TREE,
  })
  log(`candidate: ${JSON.stringify(harness.assertCandidate())}`)

  let world = null
  try {
    world = await harness.createWorld({ line: LINE, u6Fs: { rows: [] } })
    const { rows, config } = rowsFor({ home: world.home, workspaceDir: world.workspaceDir })
    const handed = handOverRows(world, rows)
    log(`row handoff: emitted=${JSON.stringify(rows.map((r) => r.id))} world=${JSON.stringify(handed)}`)
    if (JSON.stringify(handed) !== JSON.stringify([...ROW_IDS])) throw new Error(`row handoff order/identity mismatch: ${JSON.stringify(handed)} vs ${JSON.stringify([...ROW_IDS])}`)
    const patch = emitPatchLayer([
      'a5sf Web dev-live plan: teamA5sfRealm offer row + production row + p6t6 + two presets',
    ], rows)
    writeFileSync(join(HERE, 'plan-patch.yml'), `${patch}\n`)
    mkdirSync(config.blueprintDir, { recursive: true })
    writeFileSync(join(config.blueprintDir, 'anchor.yaml'), BP_ANCHOR_YAML)
    const mainText = mainBlueprintYaml(DEFAULT_DENY)
    writeFileSync(join(config.blueprintDir, 'main.yaml'), mainText)
    // Re-parse the BYTES that will be catalogued, from the world's own dir.
    assertBlueprintText(readFileSync(join(config.blueprintDir, 'main.yaml'), 'utf8'), BP_MAIN_ID, 2, 'world/main.yaml')
    log('blueprints written into the World blueprintDir and re-parsed from disk')

    const identity = rowIdentityCheck(rows)
    if (identity.ok !== true) throw new Error(`row composition refused: ${identity.reason}: ${identity.detail}`)
    log(`row identity check: ${JSON.stringify(identity)}`)

    writeJson(join(HERE, 'plan-rows.json'), {
      world: world.id,
      handed,
      rows: rows.map((row) => ({ id: row.id, name: String(row.name), hasConfig: row.config !== undefined })),
      presets: [PRESET_LEADER, PRESET_MEMBER],
      rootPresetId: PRESET_LEADER,
      memberPresetId: PRESET_MEMBER,
      candidate: harness.assertCandidate(),
      osLevelNetworkIsolationClaimed: false,
    })
    const bundle = buildPreflightBundle({ head, rowIds: handed })
    writeJson(PREFLIGHT_BUNDLE_PATH, bundle)
    log(`preflight bundle written: ${PREFLIGHT_BUNDLE_PATH} cases=${bundle.cases.length} head=${head} pointerSha256=${bundle.authority.pointerSha256}`)
  } finally {
    if (world !== null) {
      const td = await world.teardown()
      log(`plan world torn down: ${JSON.stringify(td).slice(0, 600)}`)
    }
  }
  log('PLAN OK — zero Host starts spent')
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────────────────────────────────────

function archivePreBoot({ head, authority }) {
  const dir = join(OUT, 'archive')
  mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/gu, '-')
  const copied = []
  for (const [name, path] of [
    ['preflight-bundle.json', PREFLIGHT_BUNDLE_PATH],
    ['preflight.log', PREFLIGHT_LOG_PATH],
    ['plan.log', PLAN_LOG],
    ['grant.json', GRANT_PATH],
    ['run-boot.mjs', join(HERE, 'run-boot.mjs')],
    ['a5sf-bl18-web-offer-row.mjs', OFFER_ROW],
  ]) {
    if (!existsSync(path)) continue
    const target = join(dir, `pre-boot-${stamp}-${name}`)
    copyFileSync(path, target)
    copied.push({ name, bytes: readFileSync(target).length, sha256: sha256File(target) })
  }
  const manifest = {
    archivedAt: new Date().toISOString(),
    reason: 'archive-before-start: a second run must never overwrite the first run\'s evidence',
    head,
    authorityPointerSha256: authority.pointerSha256,
    files: copied,
    osLevelNetworkIsolationClaimed: false,
  }
  writeJson(join(dir, 'pre-boot-manifest.json'), manifest)
  return manifest
}

async function boot() {
  log(`BOOT MODE — exactly ONE Host start. repo=${REPO_ROOT}`)
  log(`pinned host=${TEST_USE_BASELINE_SHA} tree=${HOST_TREE}`)
  for (const [label, path] of [['tool-web', HOST_TOOL_WEB], ['tool-fs', HOST_TOOL_FS], ['persistent-bash', HOST_TOOL_BASH_PERSISTENT]]) {
    if (!existsSync(path)) throw new Error(`the pinned ${label} module is missing: ${path}`)
  }

  // ── pre-boot refusals: nothing is written to the shared ledger before these
  //    pass, so a refusal here spends nothing.
  const head = resolveHeadCommit(REPO_ROOT)
  if (head === null) throw new Error('git rev-parse HEAD failed: the grant cannot be bound')
  log(`HEAD=${head}`)
  const bundle = readJson(PREFLIGHT_BUNDLE_PATH)
  if (bundle === null) throw new Error(`NO PREFLIGHT BUNDLE at ${PREFLIGHT_BUNDLE_PATH}: run --plan and the shared preflight first`)
  if (String(bundle.candidate?.head ?? '') !== head) {
    throw new Error(`GRANT_FOREIGN_COMMIT: the preflight bundle is bound to ${String(bundle.candidate?.head)}, but HEAD is ${head}; regenerate the bundle on this HEAD`)
  }
  if (!existsSync(PREFLIGHT_LOG_PATH)) throw new Error(`NO PREFLIGHT LOG at ${PREFLIGHT_LOG_PATH}`)
  const preflightText = readFileSync(PREFLIGHT_LOG_PATH, 'utf8')
  if (!/PASS 18\/18/u.test(preflightText) || /"verdict":\s*"(?:FAIL|UNKNOWN)"/u.test(preflightText)) {
    throw new Error('the preflight log does not carry an unqualified PASS 18/18; a start is not authorised')
  }
  const authorityNow = authorityBlock()
  if (authorityNow.pointerSha256 !== bundle.authority?.pointerSha256) {
    throw new Error(`AUTHORITY_POINTER_MOVED: measured ${authorityNow.pointerSha256}, bundle names ${String(bundle.authority?.pointerSha256)}`)
  }
  log(`preflight PASS 18/18; authority pointer sha256=${authorityNow.pointerSha256}`)

  // ── DEV-LIVE authorisation (owner ruling 2026-11-09) ────────────────────
  // One run directory per start: a later run may never overwrite an earlier
  // run's artefacts. The authorisation file is reusable; the LEASE is not.
  if (OUT === HERE) {
    throw new Error('BOOT_DIR_REQUIRED: pass --evidence <run dir>. Each start owns its own evidence directory so a later run cannot overwrite an earlier run\'s raw record.')
  }
  const grant = readJson(GRANT_PATH)
  if (grant === null) throw new Error(`NO DEV-LIVE GRANT at ${GRANT_PATH}: the face scope authorisation is missing`)
  if (grant.scope !== 'DEV-LIVE') throw new Error(`GRANT_SCOPE_MISMATCH: ${GRANT_PATH} is scope=${String(grant.scope)}; this driver only performs development boots`)
  if (bundle.grant?.scope !== 'DEV-LIVE' || String(bundle.grant?.grantId ?? '') !== String(grant.grantId)) {
    throw new Error(`GRANT_BUNDLE_MISMATCH: the preflight bundle names grant ${String(bundle.grant?.grantId)} scope=${String(bundle.grant?.scope)}, the recorded authorisation is ${String(grant.grantId)} scope=${String(grant.scope)}; regenerate the bundle from this driver`)
  }
  if (parseJsonl(LEDGER_PATH).length !== 0) {
    throw new Error(`LEDGER_NOT_FRESH: ${LEDGER_PATH} already holds rows; a run directory is per start`)
  }
  log(`dev-live authorisation: grantId=${grant.grantId} face=${grant.face} world=${String(grant.world)}`)

  const runId = `a5sf-web-devlive-${new Date().toISOString().replace(/[:.]/gu, '-')}`
  const authority = authorityNow
  const record = createRunRecord({
    runId,
    suite: SUITE,
    selectedCases: CASE_IDS,
    recordClass: 'DEV-LIVE',
    bindings: {
      teamSha: head,
      hostSha: TEST_USE_BASELINE_SHA,
      hostTree: HOST_TREE,
      line: LINE,
      recordClass: 'DEV-LIVE',
      candidateClaimEligibility: 'DEV-LIVE record: never eligible for a V@B=yes or any frozen-candidate claim (enforced by run-record.mjs#finalize)',
      face: FACE,
      worldLine: LINE,
      grantScope: 'DEV-LIVE',
      grantId: grant.grantId,
      grantedBy: grant.grantedBy,
      allocationItem: grant.allocationItem ?? null,
      sink: 'world-home a5sf-consult.jsonl (copy: guard-facts.json)',
      authority: {
        pointer: { snapshot_version: authority.snapshotVersion, content_digest: authority.contentDigest },
        baseline: authority.baseline,
        pointerSha256: authority.pointerSha256,
      },
      providerComposition: 'test row a5sf-web-offer-row.mjs (the product has no v3-blueprint -> compiled-lane bridge at this base); the intersection is the ONE compiler compileEffectiveIo',
      laneAlgebra: 'packages/runtime/dist/packages/runtime/member-io-policy/src/path-rules.js # intersectPathRuleSets',
      transport: 'FAKE boundary: records then refuses every entry; probe reports network-destination=unsupported; no socket, no DNS, no proxy',
      osLevelNetworkIsolationClaimed: false,
    },
    ledgerPath: LEDGER_PATH,
  })
  const harness = createA5sfHarness({
    repoRoot: REPO_ROOT,
    evidenceRoot: OUT,
    suite: SUITE,
    line: LINE,
    runRecord: record,
    maxHostStarts: 1,
    hostTree: HOST_TREE,
  })

  // The dev-live gate: one fresh lease per run, one intent row, one machine
  // slot (DEV_LIVE_SLOT_LIMIT = 2). There is NO cumulative cap.
  const lease = await preRegisterBudget({
    grantPath: GRANT_PATH,
    headCommit: head,
    runRecord: record,
    requiredBoots: 1,
    face: FACE,
    world: LINE,
    leaseRoot: harness.factory.leaseRoot,
  })
  log(`dev-live lease open: intent row written; grant=${lease.grant.grantId} face=${lease.face} world=${lease.world} slotHeld=${String(lease.holdsSlot())}`)
  const archive = archivePreBoot({ head, authority })
  log(`archive-before-start: ${archive.files.length} file(s) under archive/`)

  const add = (id, verdict, detail = {}) => {
    record.addCase(id, verdict, detail)
    log(`case ${id}: ${verdict} ${redact(JSON.stringify(detail)).slice(0, 700)}`)
  }

  let world = null
  let bootInfo = null
  let teardown = null
  let stage = 'boot'
  let runPaths = null
  const routingLog = []

  try {
    world = await harness.createWorld({ line: LINE, u6Fs: { rows: [] } })
    const { rows, config, paths } = rowsFor({ home: world.home, workspaceDir: world.workspaceDir })
    runPaths = paths
    const handed = handOverRows(world, rows)
    log(`row handoff: ${JSON.stringify(handed)}`)
    if (JSON.stringify(handed) !== JSON.stringify(rows.map((r) => r.id))) throw new Error('row handoff identity/order mismatch')
    const identity = rowIdentityCheck(rows)
    if (identity.ok !== true) throw new Error(`row composition refused: ${identity.reason}: ${identity.detail}`)

    mkdirSync(config.blueprintDir, { recursive: true })
    writeFileSync(join(config.blueprintDir, 'anchor.yaml'), BP_ANCHOR_YAML)
    assertBlueprintText(BP_ANCHOR_YAML, BP_ANCHOR_ID, 1, 'anchor.yaml')
    writeFileSync(join(config.blueprintDir, 'main.yaml'), mainBlueprintYaml(DEFAULT_DENY))
    writeFileSync(join(world.home, 'p6t6-directive.json'), `${JSON.stringify({
      boot: 1,
      phase: 'create',
      reportDir: world.logDir,
      runStamp: world.id,
      rootSessionId: CREATE_ROOT,
    }, null, 2)}\n`)
    writeJson(join(OUT, 'pre-boot.json'), {
      at: new Date().toISOString(),
      head,
      hostTree: HOST_TREE,
      worldId: world.id,
      rows: handed,
      paths,
      authority,
      grant,
      osLevelNetworkIsolationClaimed: false,
    })

    stage = 'mock-start'
    const decide = makeDecide(routingLog)
    await world.startMock({ decide })
    log(`mock started on port ${String(world.mock?.port)}`)

    stage = 'boot-host'
    bootInfo = await lease.boot(() => harness.boot({ world, phase: `${SUITE}-boot1`, bootTimeoutMs: 240_000 }))
    record.record.boots = [{ phase: `${SUITE}-boot1`, world: world.id, port: bootInfo.port, logPath: bootInfo.logPath }]
    log(`BOOTED port=${bootInfo.port} (lease bootsSpent=${lease.bootsSpent()}) log=${bootInfo.logPath}`)

    const origin = `http://127.0.0.1:${bootInfo.port}`
    const hostAlive = () => world.instance?.child !== null && world.instance?.child !== undefined && world.instance?.child.exitCode === null
    const cookie = await authenticate(origin, world.token)
    log('authenticated (token never recorded)')
    const toolRoute = async (name, args, as, callId) => fetchJson(`${origin}/__p6t6/tool`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ name, args, as, callId }),
    }, 180_000)

    stage = 'health-gate'
    // THE POLLING GATE, bounded by the declared boot timeout. A 404 is PENDING
    // (the p6t6 row is not ready yet); a settled failure answers 200 {ok:false}.
    const health = await pollHealth(origin, { timeoutMs: BOOT_TIMEOUT_MS })
    writeJson(join(OUT, 'health.json'), {
      gate: 'poll',
      fixedDefect: 'boot #5 single-probe 404-while-pending aborted the world and the teardown was reported as `TeamDomain is closed` (PD-11 masking); this gate polls and keeps every body',
      timeoutMs: health.timeoutMs,
      elapsedMs: health.elapsedMs,
      probeCount: health.probes.length,
      kind: health.kind,
      final: health.final,
      status: health.final?.status ?? null,
      body: health.final?.body ?? null,
      probes: health.probes,
      osLevelNetworkIsolationClaimed: false,
    })
    if (health.kind === 'failed') {
      throw new Error(`health gate: settled failure status=200 ok=false setupError=${JSON.stringify(health.final?.body?.setupError ?? null)} after ${String(health.elapsedMs)}ms`)
    }
    if (health.kind === 'timeout') {
      throw new Error(`health gate timed out after ${String(health.timeoutMs)}ms (${String(health.probes.length)} probes); last status=${JSON.stringify(health.final?.status ?? null)} body=${JSON.stringify(health.final?.body ?? null).slice(0, 400)}`)
    }
    log(`health 200 ready=${String(health.final.body.ready)} liveSessions=${JSON.stringify(health.final.body.liveSessions ?? [])} after ${String(health.elapsedMs)}ms (${String(health.probes.length)} probe(s))`)

    stage = 'discover-leader-surface'
    const discPromptW = await waitFor(async () => {
      const res = await apiPrompt(origin, cookie, ROOT, `${BL18_MARKERS.discovery}: reply with one short line. Call no tool.`, 'webdev-disc')
      if (res.status === 200) return res
      return null
    }, 60_000, 2000)
    if (!discPromptW.hit) throw new Error('the discovery prompt was never accepted on the anchor session')
    const discPrompt = discPromptW.value
    log(`discovery prompt status=${discPrompt.status} (accepted after ${discPromptW.elapsedMs}ms)`)
    const discW = await waitFor(() => (world.mock?.requests ?? []).some((r) => hasMarker(r, BL18_MARKERS.discovery) && surfaceNamesOf(r).length > 0), 90_000)
    if (!discW.hit) throw new Error('the discovery model request never carried a tool surface')
    const discRequest = [...world.mock.requests]
      .filter((r) => hasMarker(r, BL18_MARKERS.discovery))
      .sort((a, b) => surfaceNamesOf(b).length - surfaceNamesOf(a).length)[0]
    const surface = [...new Set(surfaceNamesOf(discRequest))].sort()
    const denyList = surface.filter((name) => !name.startsWith('team_') && !MANAGED_TOOL_NAMES.includes(name) && !SAFE_UNMANAGED_TOOL_NAMES.includes(name)).sort()
    writeJson(join(OUT, 'surface.json'), {
      discovery: { marker: BL18_MARKERS.discovery, tools: surface, toolsCount: surface.length },
      leaderFinalExpectation: surface.filter((name) => !denyList.includes(name)).sort(),
      denyList,
      provenance: 'the tool list the mock recorded on the ANCHOR leader\'s own model request',
      member: null,
      osLevelNetworkIsolationClaimed: false,
    })
    log(`discovery surface (${surface.length}): ${JSON.stringify(surface)}`)
    log(`discovery-first deny list: ${JSON.stringify(denyList)}`)

    stage = 'write-main-blueprint'
    const mainText = mainBlueprintYaml(denyList)
    writeFileSync(join(config.blueprintDir, 'main.yaml'), mainText)
    const parsedMain = assertBlueprintText(readFileSync(join(config.blueprintDir, 'main.yaml'), 'utf8'), BP_MAIN_ID, 2, 'main.yaml')
    log(`main blueprint parsed; builtinToolDeny=${JSON.stringify(parsedMain.builtinToolDeny)}`)

    stage = 'create-team'
    const created = await remoteCall(fetchJson, origin, cookie, 'team.create', {
      rootSessionId: CREATE_ROOT,
      blueprintId: BP_MAIN_ID,
      initialWork: { prompt: `${BL18_MARKERS.create}: reply with one short line. Call no tool.` },
    }, 'webdev-create', 1)
    writeJson(join(OUT, 'create-team.json'), { status: created.status, body: created.body })
    if (created.status !== 200 || created.body?.result?.ok !== true) {
      throw new Error(`team.create refused: status=${created.status} body=${JSON.stringify(created.body).slice(0, 1200)}`)
    }
    log(`team.create ok on ${CREATE_ROOT}`)

    stage = 'state-gate'
    const stateW = await waitFor(async () => {
      const st = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
      if (st.status !== 200) return null
      if (st.body?.rootSessionId !== CREATE_ROOT) return null
      if (st.body?.teamSession?.rootSessionId !== CREATE_ROOT) return null
      if (String(st.body?.teamSession?.blueprintId ?? '') !== BP_MAIN_ID) return null
      return { status: st.status, body: st.body }
    }, 90_000)
    if (!stateW.hit) throw new Error('the created team never appeared on the directive root state route')
    writeJson(join(OUT, 'state.json'), stateW.value)
    log(`state-gate open: blueprint=${String(stateW.value.body.teamSession.blueprintId)} members=${(stateW.value.body.members ?? []).length}`)

    stage = 'live-leader-gate'
    const liveW = await waitFor(async () => {
      const h = await fetchJson(`${origin}/__p6t6/health`, undefined, 30_000)
      const list = Array.isArray(h.body?.liveSessions) ? h.body.liveSessions : []
      return list.includes(CREATE_ROOT) ? list : null
    }, 90_000)
    if (!liveW.hit) throw new Error(`the created team root ${CREATE_ROOT} never became a live agent`)
    log(`live leader gate open: liveSessions=${JSON.stringify(liveW.value)}`)

    stage = 'create-team-turn'
    const createTurn = await waitFor(() => (world.mock?.requests ?? []).some((r) => hasMarker(r, BL18_MARKERS.create)), 60_000)
    log(`leader create turn observed=${String(createTurn.hit)} (harmless no-tool reply by design)`)

    // ── the two deny-lane items ─────────────────────────────────────────────
    const factsOf = (memberIdentity, method) => parseJsonl(paths.sink).filter((fact) => fact?.memberIdentity === String(memberIdentity) && fact?.method === method)
    // A PROVIDER ENTRY is `leg === 'provider-entry'`: the fake boundary's
    // fetch/search methods were entered. The capability probe is a separate
    // leg (`leg === 'capability-probe'`) — the guard's own question to the
    // backend, answered without any transport. The inherited driver counted
    // every row as an entry, so run-02's otherwise-clean search refusal read
    // as one provider entry. The two legs are counted separately here.
    const entriesOf = (memberIdentity) => parseJsonl(paths.counter).filter((entry) => entry?.leg === 'provider-entry' && entry?.realm === `member:${String(memberIdentity)}`)
    const probesOf = (memberIdentity) => parseJsonl(paths.counter).filter((entry) => entry?.leg === 'capability-probe' && entry?.realm === `member:${String(memberIdentity)}`)
    const providerEntryRows = () => parseJsonl(paths.counter).filter((entry) => entry?.leg === 'provider-entry')
    const hostWebRows = () => parseJsonl(paths.hostWebCounter).filter((row) => row?.leg === 'host-web-call')

    const waitMember = async (label) => {
      const found = await waitFor(async () => {
        const st = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
        if (st.status !== 200) return null
        const member = (st.body?.members ?? []).find((m) => String(m.label) === label && String(m.childSessionId ?? '') !== '')
        return member === undefined ? null : member
      }, 120_000)
      if (!found.hit) throw new Error(`member ${label} never became live`)
      return found.value
    }

    const runItem = async (planCase) => {
      const before = {
        facts: parseJsonl(paths.sink).length,
        entries: providerEntryRows().length,
        probes: parseJsonl(paths.counter).filter((entry) => entry?.leg === 'capability-probe').length,
        hostWeb: hostWebRows().length,
      }
      const label = `webdev-${planCase.tool === 'web_fetch' ? 'fetch' : 'search'}`
      const callId = `webdev-delegate-${label}`
      const delegated = await toolRoute('team_delegate', {
        rootSessionId: CREATE_ROOT,
        requestToken: callId,
        delegationTemplateId: planCase.memberTemplate,
        label,
        prompt: `${planCase.marker}: call the ${planCase.tool} tool exactly once with ${JSON.stringify(planCase.args)} and then report the exact error text. Call no other tool.`,
      }, CREATE_ROOT, callId)
      writeJson(join(OUT, `delegate-${planCase.id}.json`), { status: delegated.status, body: delegated.body })
      log(`delegate ${label}: status=${delegated.status} body=${redact(JSON.stringify(delegated.body ?? null)).slice(0, 700)}`)
      if (delegated.status !== 200 || delegated.body?.ok !== true) {
        throw new Error(`team_delegate refused for ${label}: status=${delegated.status} body=${JSON.stringify(delegated.body).slice(0, 800)}`)
      }
      const member = await waitMember(label)
      const instanceId = String(member.instanceId)
      const session = String(member.childSessionId)
      log(`member ${label}: instanceId=${instanceId} childSessionId=${session} lifecycle=${String(member.lifecycle)}`)

      const initiation = 'model-tool-call'
      const sawFact = await waitFor(() => factsOf(instanceId, planCase.method).length > 0, 120_000)
      // NO DRIVER-SIDE FALLBACK: the question is whether the MODEL's own call
      // reaches the face. A direct tool-route call would (a) weaken the datum and
      // (b) if route-C had failed to attach, resolve the preset's inherited host
      // web tool and attempt real egress. A missing fact is recorded as REFUTED.
      if (!sawFact.hit) log(`no ${planCase.method} guard fact after ${sawFact.elapsedMs}ms (no fallback by design)`)
      const memberRequests = () => (world.mock?.requests ?? []).filter((r) => hasMarker(r, planCase.marker))

      const facts = factsOf(instanceId, planCase.method)
      const entries = entriesOf(instanceId)
      const probes = probesOf(instanceId)
      const hostCalls = hostWebRows()
      const newEntryCount = providerEntryRows().length - before.entries
      const newProbeCount = parseJsonl(paths.counter).filter((entry) => entry?.leg === 'capability-probe').length - before.probes
      const newHostCount = hostCalls.length - before.hostWeb

      const requests = memberRequests()
      const withTools = requests.filter((r) => surfaceNamesOf(r).length > 0)
      const memberSurface = withTools.length > 0 ? [...new Set(surfaceNamesOf(withTools[withTools.length - 1]))].sort() : []
      const toolResults = requests.flatMap((r) => toolMsgsOf(r))
      const errorResults = toolResults.filter((m) => m.isError === true)
      const fact = facts.length === 1 ? facts[0] : null
      const errorText = errorResults.find((m) => m.text.includes('NETWORK_UNCONFINED_REALM'))?.text
        ?? errorResults[errorResults.length - 1]?.text
        ?? null
      const refusalText = errorText ?? (fact?.decidedBy === 'NETWORK_UNCONFINED_REALM' ? `typed guard fact: ${String(fact?.decidedBy)}` : null)
      const refusalTextSource = errorText !== null ? 'the member turn\'s recorded tool_result text' : (refusalText !== null ? 'the typed guard fact (no second model request was recorded)' : null)
      const checks = {
        memberIsLegacy: true, // template declares no capabilities block; recorded from the authored YAML
        memberSurfaceHasPair: memberSurface.includes('web_fetch') && memberSurface.includes('web_search'),
        modelTurnRan: withTools.length > 0,
        initiationIsModelCall: initiation === 'model-tool-call',
        memberTurnObserved: withTools.length > 0,
        exactlyOneFact: facts.length === 1,
        typedCode: String(fact?.decidedBy ?? '') === 'NETWORK_UNCONFINED_REALM',
        decisionDeny: String(fact?.decision ?? '') === 'deny',
        zeroProviderEntries: newEntryCount === 0 && entries.length === 0,
        zeroHostWebEntries: newHostCount === 0,
        refusalNamesCapability: typeof refusalText === 'string' && /network/iu.test(refusalText),
        refusalNamesTypedCode: typeof refusalText === 'string' && refusalText.includes('NETWORK_UNCONFINED_REALM'),
        typedRefusalFact: String(fact?.decidedBy ?? '') === 'NETWORK_UNCONFINED_REALM',
      }
      const verdict = Object.values(checks).every((v) => v === true) ? 'PROVEN' : 'REFUTED'
      const artifact = {
        schema: 'a5sf-web-devlive/deny-face/1',
        at: new Date().toISOString(),
        caseId: planCase.id,
        question: 'Does the governed realm deliver a confined `web` face to this legacy Member, and does the deny lane refuse at the FACE — one typed guard fact, zero provider entries — when the model calls the tool?',
        caseClass: 'admission-refusal',
        member: {
          instanceId,
          childSessionId: session,
          templateId: String(member.templateId),
          label,
          legacy: true,
          capabilitiesAbsent: true,
          note: 'the webworker template in the authored main blueprint carries NO capabilities block -> permissionPolicy absent -> A2C-2 does not run',
        },
        preset: { member: PRESET_MEMBER, module: '@deepseek-ai/dsh-tool-web', tools: ['web_fetch', 'web_search'], leader: PRESET_LEADER },
        surface: {
          memberToolsFromModelRequest: memberSurface,
          hasWebFetch: memberSurface.includes('web_fetch'),
          hasWebSearch: memberSurface.includes('web_search'),
          source: 'the `tools` array the mock recorded on this Member turn\'s own model request',
        },
        initiation,
        call: {
          tool: planCase.tool,
          arguments: planCase.args,
          status: null,
          isError: errorResults.length > 0,
          refusalText,
          refusalTextSource,
        },
        result: {
          guardFacts: facts,
          guardFactCount: facts.length,
          expectedMethod: planCase.method,
          providerEntries: {
            fetch: planCase.tool === 'web_fetch' ? newEntryCount : 0,
            search: planCase.tool === 'web_search' ? newEntryCount : 0,
            transport: newEntryCount,
            dns: newEntryCount,
            connect: newEntryCount,
            total: newEntryCount,
            rows: entries,
          },
          capabilityProbes: {
            count: newProbeCount,
            rows: probes,
            note: 'the guard\'s own capability question to the backend (leg=capability-probe). It enters no fetch/search/transport/dns/connect channel and is NOT a provider entry; the inherited driver counted it as one.',
          },
          hostWebEntries: newHostCount,
          hostWebRows: hostCalls,
          before,
        },
        claim: {
          caseClass: 'admission-refusal',
          claimsConfinement: false,
          osLevelNetworkIsolationClaimed: false,
          wording: 'The refusal is a pre-provider admission fact: the shipped guard refused before the provider was entered, so zero provider entries is a counter of our own admission code, not an OS observation. This does NOT prove network confinement or isolation.',
        },
        checks,
        verdict,
        limits: {
          wording: LIMIT_SENTENCE,
          detail: 'Refusing to fetch is a statement about our own admission code, made before the OS was asked. The provider is a fake boundary; the OS was never asked to deny anything.',
          osLevelNetworkIsolationClaimed: false,
        },
      }
      writeJson(join(OUT, `item-${planCase.id}.json`), artifact)
      add(planCase.id, verdict === 'PROVEN' ? 'PASS' : 'FAIL', {
        initiation,
        guardFactCount: facts.length,
        decidedBy: fact?.decidedBy ?? null,
        providerEntries: newEntryCount,
        hostWebEntries: newHostCount,
        memberSurfaceHasPair: checks.memberSurfaceHasPair,
        refusalNamesCapability: checks.refusalNamesCapability,
        artifact: `item-${planCase.id}.json`,
      })
      return artifact
    }

    stage = 'item1-fetch-deny'
    const item1 = await runItem(PLAN_CASES[0])
    stage = 'item2-search-deny'
    const item2 = await runItem(PLAN_CASES[1])

    stage = 'member-state-readback'
    const finalState = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
    writeJson(join(OUT, 'state-final.json'), { status: finalState.status, body: finalState.body })
    const members = finalState.status === 200 ? (finalState.body?.members ?? []) : []
    log(`member state readback: ${JSON.stringify(members.map((m) => ({ label: m.label, lifecycle: m.lifecycle, childSessionId: m.childSessionId })))}`)

    // ── artefacts that are not per-case ────────────────────────────────────
    writeJson(join(OUT, 'guard-facts.json'), { sink: paths.sink, facts: parseJsonl(paths.sink), osLevelNetworkIsolationClaimed: false })
    writeJson(join(OUT, 'counter-rows.json'), {
      providerEntries: providerEntryRows(),
      capabilityProbes: parseJsonl(paths.counter).filter((entry) => entry?.leg === 'capability-probe'),
      allCounterRows: parseJsonl(paths.counter),
      hostWebRows: hostWebRows(),
      note: 'provider entries (leg=provider-entry: an actual fetch/search/transport/dns/connect entry) must be empty for a pre-provider refusal; capability probes (leg=capability-probe) are the guard\'s own question to the backend and are not entries; hostWebRows empty proves the inherited host web service was never consulted',
      osLevelNetworkIsolationClaimed: false,
    })
    const routed = (world.mock?.requests ?? []).map((request, index) => {
      const entry = routingLog[index] ?? null
      return {
        seq: index + 1,
        tools: surfaceNamesOf(request),
        markers: CASE_IDS.length === 0 ? [] : Object.values(BL18_MARKERS).filter((marker) => hasMarker(request, marker)),
        wholeTurnKind: routeKindOf(request),
        routed: entry,
      }
    })
    writeJson(join(OUT, 'marker-routing.json'), {
      decidedBy: 'the driver\'s own decide() log, aligned 1:1 with the mock request order',
      markers: BL18_MARKERS,
      requests: routed,
      routingHeld: {
        discoveryBeforeCreate: routed.findIndex((r) => r.routed?.effectiveKind === 'discovery') !== -1
          && routed.findIndex((r) => r.routed?.effectiveKind === 'create') !== -1
          && routed.findIndex((r) => r.routed?.effectiveKind === 'discovery') < routed.findIndex((r) => r.routed?.effectiveKind === 'create'),
        fetchServedOnce: routingLog.filter((r) => r.effectiveKind === 'fetch' && r.disposition === 'tool-call').length === 1,
        searchServedOnce: routingLog.filter((r) => r.effectiveKind === 'search' && r.disposition === 'tool-call').length === 1,
        noWrongLane: routingLog.filter((r) => r.effectiveKind === 'fetch' || r.effectiveKind === 'search').every((r) => r.disposition === 'tool-call' || r.disposition === 'exhausted'),
      },
      osLevelNetworkIsolationClaimed: false,
    })
    writeJson(join(OUT, 'mock-requests.json'), {
      count: (world.mock?.requests ?? []).length,
      requests: world.mock?.requests ?? [],
    })

    stage = 'teardown'
    const port = bootInfo.port
    teardown = await world.teardown()
    const closed = !(await portOpen(port))
    const homeAfter = existsSync(world.home)
    writeJson(join(OUT, 'teardown.json'), {
      at: new Date().toISOString(),
      teardown,
      port,
      portClosedAfterTeardown: closed,
      homeRemoved: homeAfter === false,
      homePath: world.home,
      hostAliveAtEnd: hostAlive(),
      osLevelNetworkIsolationClaimed: false,
    })
    log(`teardown: portClosed=${String(closed)} homeRemoved=${String(homeAfter === false)}`)
    if (!closed) throw new Error(`the host port ${port} is still open after teardown`)
  } catch (error) {
    record.markAborted({ stage, detail: null, error: String(error?.stack ?? error?.message ?? error) })
    log(`ABORT at ${stage}: ${String(error?.stack ?? error?.message ?? error)}`)
    // PERSIST THE OBSERVATIONS BEFORE TEARDOWN: an abort must not destroy the
    // model requests / guard facts that explain it (the end-of-run block below
    // is never reached on this path).
    if (world !== null) {
      try {
        const requests = world.mock?.requests ?? []
        writeJson(join(OUT, 'mock-requests.json'), { count: requests.length, requests, abortedAt: stage, osLevelNetworkIsolationClaimed: false })
        if (runPaths !== null) {
          writeJson(join(OUT, 'guard-facts.json'), { sink: runPaths.sink, facts: parseJsonl(runPaths.sink), abortedAt: stage, osLevelNetworkIsolationClaimed: false })
          const counterRows = parseJsonl(runPaths.counter)
          writeJson(join(OUT, 'counter-rows.json'), {
            providerEntries: counterRows.filter((entry) => entry?.leg === 'provider-entry'),
            capabilityProbes: counterRows.filter((entry) => entry?.leg === 'capability-probe'),
            allCounterRows: counterRows,
            hostWebRows: parseJsonl(runPaths.hostWebCounter).filter((row) => row?.leg === 'host-web-call'),
            abortedAt: stage,
            osLevelNetworkIsolationClaimed: false,
          })
        }
      } catch (diagnosticError) {
        log(`abort diagnostics failed: ${String(diagnosticError?.message ?? diagnosticError)}`)
      }
    }
    if (world !== null && teardown === null) {
      try {
        teardown = await world.teardown()
        writeJson(join(OUT, 'teardown.json'), {
          at: new Date().toISOString(),
          teardown,
          abortedDuring: stage,
          port: bootInfo?.port ?? null,
          portClosedAfterTeardown: bootInfo?.port === undefined ? null : !(await portOpen(bootInfo.port)),
          homeRemoved: existsSync(world.home) === false,
          homePath: world.home,
          osLevelNetworkIsolationClaimed: false,
        })
      } catch (teardownError) {
        log(`teardown after abort failed: ${String(teardownError?.message ?? teardownError)}`)
      }
    }
  } finally {
    if (bootInfo !== null && teardown === null && world !== null) {
      try { teardown = await world.teardown() } catch { /* recorded above */ }
    }
    const finalized = record.finalize()
    // The dev-live OUTCOME row (owner ruling 2026-11-09 §4.3) — written after
    // the run and after teardown; it also releases the machine slot.
    let outcomeRow = null
    try {
      outcomeRow = lease.finish({
        overall: finalized.overall,
        cases: finalized.cases.map((c) => ({ id: c.id, verdict: c.verdict })),
        teardown,
      })
    } catch (finishError) {
      log(`dev-live outcome row failed: ${String(finishError?.message ?? finishError)}`)
    }
    const rows = parseJsonl(LEDGER_PATH)
    const intentRows = rows.filter((row) => row?.kind === 'budget-intent')
    const bootRows = rows.filter((row) => row?.kind === undefined)
    const outcomeRows = rows.filter((row) => row?.kind === 'dev-live-outcome')
    const aborts = bootRows.length === 0 ? 1 : 0
    writeJson(join(OUT, 'ledger.json'), {
      schema: 'a5sf-web-devlive/ledger/1',
      recordClass: 'DEV-LIVE',
      ledgerPath: 'run-ledger.jsonl',
      plannedStarts: 1,
      aborts,
      boots: bootRows.length,
      arithmetic: 'boots === plannedStarts - aborts',
      holds: bootRows.length === 1 - aborts,
      rows,
      intentRow: intentRows[0] ?? null,
      intentRows,
      bootRow: bootRows[0] ?? null,
      outcomeRow: outcomeRows[0] ?? null,
      devLiveOutcomeRecorded: outcomeRows.length === 1,
      note: aborts === 0
        ? 'one fresh dev-live lease: intent row + start row written before the spawn, outcome row written after teardown; no cumulative cap is claimed or consumed'
        : 'the one planned start was refused BEFORE any ledger row was written; the arithmetic records it as an abort, not a boot',
      osLevelNetworkIsolationClaimed: false,
    })
    record.write(RUN_RECORD_PATH)
    log(`ledger: boots=${String(bootRows.length)} planned=1 aborts=${String(aborts)} outcome=${String(outcomeRows.length)}`)
    log(formatSummary(finalized))
    log(`run record: ${RUN_RECORD_PATH}`)
    writeJson(join(OUT, 'verdict.json'), {
      schema: 'a5sf-web-devlive/verdict/1',
      at: new Date().toISOString(),
      recordClass: finalized.recordClass,
      candidateClaimEligibility: finalized.candidateClaimEligibility ?? null,
      grantId: grant.grantId,
      face: FACE,
      world: LINE,
      overall: finalized.overall,
      abortedAt: finalized.abortedAt ?? null,
      partial: finalized.partial === true,
      cases: finalized.cases.map((c) => ({ id: c.id, verdict: c.verdict })),
      devLiveOutcomeRecorded: outcomeRows.length === 1,
      limit: LIMIT_SENTENCE,
      osLevelNetworkIsolationClaimed: false,
    })
    log(`OVERALL=${finalized.overall}`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// entry
// ─────────────────────────────────────────────────────────────────────────────

const isMain = process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url
if (isMain) {
  const run = PLAN_ONLY ? plan : boot
  run().then(() => {
    const verdict = readJson(join(OUT, 'verdict.json'))
    if (PLAN_ONLY) process.exit(0)
    process.exit(verdict?.overall === 'PASS' ? 0 : 1)
  }).catch((error) => {
    log(`FATAL: ${String(error?.stack ?? error?.message ?? error)}`)
    process.exit(2)
  })
}

export { LIMIT_SENTENCE, plan, boot }
