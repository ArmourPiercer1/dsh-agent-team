#!/usr/bin/env node
/**
 * run-boot.mjs — D-face (Web) DEV-LIVE recon: ONE governed Member calls
 * `web_fetch` and `web_search`, twice (allow lane) and twice (deny lane),
 * against a CONTROLLED LOCAL ENDPOINT.
 *
 * THE QUESTION IS ATTRIBUTION, NOT GRADE. For each lane:
 *   - is the model-visible pair reachable on a real governed Member turn?
 *   - is the product guard actually EVALUATED for each call (one fact per call)?
 *   - does the deny lane refuse at the GUARD, and what is the typed code?
 *   - did the endpoint see the request or not (server-side observation)?
 *   - after the Member is archived, is the model path still reachable?
 *
 * HARD LIMIT, repeated because it is the point of this lane: a refusal here is a
 * SERVICE-LEVEL admission refusal of our own code, made before any provider
 * call. It is NOT OS network isolation. BL-42's subprocess netns proof is not
 * evidence about this in-process face (PD-15: `NETWORK_PROOF_FACE_MISMATCH`),
 * and this driver stamps `osLevelNetworkIsolationClaimed: false` on every
 * artefact it writes. The ALLOW lane is ordinary in-process loopback egress.
 *
 * MODES
 *   --plan                 host-free composition; writes the preflight bundle
 *                          and runs the SHARED zero-boot preflight; spends 0 starts.
 *   --evidence <run-dir>   the boot (exactly ONE Host start).
 *
 * @module dev/agent-workflow/evidence/a5sf-recon-web/run-boot
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
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
} from '../../../../tests/world-factory/lib/world-factory.mjs'
import {
  createRunRecord,
  formatSummary,
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
import { RECON_MARKERS, makeReconDecide, routeKindOf } from './recon-marker-mock.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..')

function hostTreePath() {
  const local = join(REPO_ROOT, 'tests', 'deepseek-harness-test-use')
  if (existsSync(join(local, 'packages', 'web', 'tool-web', 'lib', 'index.js'))) return local
  return resolve(REPO_ROOT, '..', '..', 'tests', 'deepseek-harness-test-use')
}
const HOST_TREE = hostTreePath()
const HOST_TOOL_WEB = join(HOST_TREE, 'packages', 'web', 'tool-web', 'lib', 'index.js')

/** The frozen recon base. A boot at any other SHA is refused. */
const RECON_BASE_SHA = '235e1af8b'
const LINE = 'a5sfreconweb'
const FACE = 'Web'
const BOOT_TIMEOUT_MS = 240_000

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
const OFFER_ROW = join(HERE, 'recon-web-offer-row.mjs')
const MARKER_MOCK = join(HERE, 'recon-marker-mock.mjs')

const ROOT = 'session-a5sf-recon-web-anchor'
const CREATE_ROOT = 'session-a5sf-recon-web-team'
const BP_ANCHOR_ID = 'team.a5sf.recon.web.anchor'
const BP_MAIN_ID = 'team.a5sf.recon.web.main'
const PRESET_LEADER = 'a5sf-recon-web-leader'
const PRESET_MEMBER = 'a5sf-recon-web-member'
const TEMPLATE_ALLOW = 'weballow'
const TEMPLATE_DENY = 'webdeny'
const BINDING = 'team/web'
const LIMIT_SENTENCE = 'Refusing to fetch is **not** evidence of network isolation: it is a statement about our own admission code, made before the OS was asked.'

const CASES = ['web-allow-fetch', 'web-allow-search', 'web-deny-fetch', 'web-deny-search']
const CASE_IDS = Object.freeze([...CASES])
const PLAN_CASES = Object.freeze([
  { id: 'web-allow-fetch', lane: 'allow', tool: 'web_fetch', method: 'web:fetch', template: TEMPLATE_ALLOW, marker: RECON_MARKERS.allow },
  { id: 'web-allow-search', lane: 'allow', tool: 'web_search', method: 'web:search', template: TEMPLATE_ALLOW, marker: RECON_MARKERS.allow },
  { id: 'web-deny-fetch', lane: 'deny', tool: 'web_fetch', method: 'web:fetch', template: TEMPLATE_DENY, marker: RECON_MARKERS.deny },
  { id: 'web-deny-search', lane: 'deny', tool: 'web_search', method: 'web:search', template: TEMPLATE_DENY, marker: RECON_MARKERS.deny },
])
const ALLOW_CASE_IDS = new Set(['web-allow-fetch', 'web-allow-search'])
const SUITE = 'a5sf-recon-web'
const PLAN_ONLY = process.argv.includes('--plan')

// ── the controlled local endpoint ───────────────────────────────────────────
const ALLOW_BYTES = 'A5SF_RECON_WEB_ALLOW_BYTES'
const SEARCH_BYTES = 'A5SF_RECON_WEB_SEARCH_BYTES'
const endpoint = { origin: null, port: null, requests: [] }

function startEndpoint() {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    endpoint.requests.push({
      at: new Date().toISOString(),
      method: req.method,
      path: url.pathname,
      query: url.search,
      host: req.headers.host ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    })
    if (url.pathname === '/page') {
      res.writeHead(200, { 'content-type': 'text/plain', 'x-a5sf-recon': 'allow' })
      res.end(ALLOW_BYTES)
      return
    }
    if (url.pathname === '/search') {
      res.writeHead(200, { 'content-type': 'text/plain' })
      res.end(SEARCH_BYTES)
      return
    }
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end('A5SF_RECON_WEB_ENDPOINT_NOT_FOUND')
  })
  return new Promise((done) => {
    server.listen(0, '127.0.0.1', () => {
      endpoint.port = server.address().port
      endpoint.origin = `http://127.0.0.1:${endpoint.port}`
      done(server)
    })
  })
}

// ── utilities ───────────────────────────────────────────────────────────────
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

// ── authority / bundle ──────────────────────────────────────────────────────
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

export function buildPreflightBundle({ head, rowIds }) {
  const authority = authorityBlock()
  const rel = (p) => p.slice(REPO_ROOT.length + 1)
  const locatorOf = (c) => (c.tool === 'web_fetch'
    ? `${endpoint.origin}/page?lane=${c.lane}`
    : (c.lane === 'allow' ? 'queries:1' : 'queries:2'))
  const baseCollector = (c) => ({
    id: c.id,
    face: 'web',
    axis: 'network',
    locator: locatorOf(c),
    guardFactKey: c.id,
    method: c.tool === 'web_fetch' ? 'fetch' : 'search',
    collector: 'guard-fact',
    returnShape: ['call', 'result', 'claim'],
    terminate: true,
    archiveBeforeStart: true,
    corpus: [c.id],
    claimsConfinement: false,
  })
  const cases = PLAN_CASES.map((c) => (c.lane === 'deny'
    ? {
      ...baseCollector(c),
      expected: 'deny',
      observable: 'pre-provider-refusal',
      expectedCode: 'NETWORK_UNCONFINED_REALM',
      expectedFact: { method: c.method, decision: 'deny', decidedBy: 'NETWORK_UNCONFINED_REALM' },
      providerEntries: { fetch: 0, search: 0, transport: 0, dns: 0, connect: 0 },
      caseClass: 'admission-refusal',
      guardFacts: 1,
      refusalNaming: 'capability',
      note: 'the Member model turn calls the tool on the local endpoint; the confined web face refuses at admission, before the composition provider is entered',
    }
    : {
      ...baseCollector(c),
      expected: 'allow',
      observable: 'admitted-egress',
      note: 'the ALLOW lane: the guard admits and the composition provider reaches the local endpoint. Declared honestly; the shared preflight\'s closed vocabulary has no admitted-network case (see the recorded findings)',
    }))
  return {
    schema: 'a5sf-zero-boot-preflight/1',
    label: 'Web face DEV-LIVE RECON — same governed Member, allow + deny lanes, controlled local endpoint',
    sources: {
      note: 'Derived from this driver at the frozen recon SHA. NOT a candidate bundle and NOT a grade: it exists to run the SHARED preflight over this plan so its verdict (including its own vocabulary limits) is recorded before a start.',
      driver: rel(join(HERE, 'run-boot.mjs')),
      providerRow: rel(OFFER_ROW),
      markerMock: rel(MARKER_MOCK),
      limit: LIMIT_SENTENCE,
    },
    candidate: { head, baseline: authority.baseline, pin: TEST_USE_BASELINE_SHA, productTreeProof: [] },
    authority: {
      pointerPath: authority.pointerPath,
      snapshotVersion: authority.snapshotVersion,
      contentDigest: authority.contentDigest,
      baseline: authority.baseline,
      pointerSha256: authority.pointerSha256,
    },
    grant: {
      grantId: 'devlive-web-recon-1',
      scope: 'DEV-LIVE',
      grantedBy: 'owner 2026-11-09 ruling (docs/DEV-LIVE-OPERATOR-GUIDE.md), Web face scope; recon use',
      face: FACE,
      world: LINE,
      allocationItem: 'D-face (Web) recon — attribution of allow/deny lanes on a governed Member',
      boundCommit: head,
      priorRows: 0,
      plannedStarts: 1,
      maxStarts: 2,
      aborts: 0,
      note: 'scope=DEV-LIVE: reusable authorisation, no cumulative cap; one fresh lease per run',
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
      distFaces: { web: true, fs: false, subprocess: false },
      hostModules: [
        { path: 'tests/deepseek-harness-test-use/packages/web/tool-web/lib/index.js', exists: true, role: 'the pinned @deepseek-ai/dsh-tool-web module route-C re-mounts on the realm scope' },
        { path: rel(OFFER_ROW), exists: true, role: 'the teamA5sfRealm provider: one compiled Member + the confined web face + the local-endpoint transport' },
        { path: rel(join(HERE, 'run-boot.mjs')), exists: true, role: 'this driver' },
        { path: rel(MARKER_MOCK), exists: true, role: 'the marker routing table' },
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
      'web-allow-fetch': { url: `${endpoint.origin}/page`, tool: 'web_fetch' },
      'web-allow-search': { queries: ['a5sf recon web allow'], tool: 'web_search' },
      'web-deny-fetch': { url: `${endpoint.origin}/page`, tool: 'web_fetch' },
      'web-deny-search': { queries: ['a5sf recon web deny'], tool: 'web_search' },
      workspace: 'tests/homes/<world>/workspace',
      endpoint: endpoint.origin,
    },
    policy: {
      kind: 'two-lane-composition',
      network: 'deny',
      networkAccess: 'deny',
      networkProbeEnforced: false,
      effectiveReadAllow: ['tests/homes/<world>/workspace'],
      effectiveWriteAllow: ['tests/homes/<world>/workspace'],
      effectiveNetwork: ['allow', 'deny'],
      note: 'two lanes, two Members: the allow Member and the deny Member are separate templates; each lane is compiled by the ONE compiler (compileEffectiveIo) in the composition row. The deny lane is composition-only: a product blueprint that declares network=deny is refused at ASSEMBLY (see arms-hostfree A11).',
      osLevelNetworkIsolationClaimed: false,
    },
    cases,
    driver: {
      steps: [
        { id: 'pre-boot-refusals', canFail: false },
        { id: 'compose-rows', produces: ['rows'], canFail: false },
        { id: 'boot-host', produces: ['host'], canFail: false },
        { id: 'health-gate', requires: ['host'], canFail: true, gate: true, captures: ['status', 'body'], captureLimits: { body: { maxChars: null } } },
        { id: 'discover-leader-surface', requires: ['host'], produces: ['leader-surface'], canFail: true, captures: ['status', 'body', 'mock-requests'], captureLimits: { body: { maxChars: null } } },
        { id: 'write-main-blueprint', requires: ['leader-surface'], produces: ['blueprint'], canFail: true, captures: ['status', 'body'], captureLimits: { body: { maxChars: null } } },
        { id: 'create-team', requires: ['blueprint'], produces: ['team-session'], canFail: true, captures: ['status', 'body'], captureLimits: { body: { maxChars: null } } },
        { id: 'state-gate', requires: ['team-session'], canFail: true, gate: true, captures: ['status', 'body'], captureLimits: { body: { maxChars: null } } },
        { id: 'allow-member-turn', requires: ['team-session'], produces: ['member'], canFail: true, captures: ['status', 'body', 'guard-facts', 'provider-entries', 'endpoint-requests'] },
        { id: 'deny-member-turn', requires: ['team-session'], produces: ['member'], canFail: true, captures: ['status', 'body', 'guard-facts', 'provider-entries', 'endpoint-requests'] },
        { id: 'lifecycle-archive-followup', requires: ['member'], canFail: true, captures: ['status', 'body'] },
        { id: 'teardown', canFail: false },
      ],
      plannedCases: [...CASE_IDS],
      caseManifest: { source: rel(join(HERE, 'run-boot.mjs')), cases: [...CASE_IDS] },
      blueprint: {
        leader: {
          teamTools: ['team_delegate', 'team_archive_member', 'team_follow_up', 'team_collect'],
          managed: [...MANAGED_TOOL_NAMES],
          safeUnmanaged: [...SAFE_UNMANAGED_TOOL_NAMES],
          builtinToolDeny: 'discovery-first',
        },
      },
      caller: {
        kind: 'member',
        strict: false,
        templates: [TEMPLATE_ALLOW, TEMPLATE_DENY],
        preset: { module: '@deepseek-ai/dsh-tool-web', tools: ['web_fetch', 'web_search'] },
        note: 'legacy (non-strict) Members: neither template declares a capabilities block, so permissionPolicy is absent; the MEMBER preset surfaces the pair, which route-C re-mounts on the governed realm scope',
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
      memberBindings: PLAN_CASES.map((c, index) => ({
        caseId: c.id,
        memberIdentity: `inst-recon-web-${c.lane}-${index}`,
        toolBindingIdentity: BINDING,
      })),
      blueprints: [
        { blueprintId: BP_ANCHOR_ID, members: 1 },
        { blueprintId: BP_MAIN_ID, members: 2 },
      ],
    },
    nativeModules: [
      {
        name: '@deepseek-ai/dsh-tool-web',
        path: 'tests/deepseek-harness-test-use/packages/web/tool-web/lib/index.js',
        inject: ['tools', 'web', 'systemPrompt'],
        config: { fetch: true, search: true, searchTimeoutMs: 60000 },
        expectedTools: ['web_fetch', 'web_search'],
        role: 'the pinned native module route-C re-mounts on the governed realm scope (its ctx.web resolves the confined face)',
      },
    ],
    osLevelNetworkIsolationClaimed: false,
    limits: {
      wording: LIMIT_SENTENCE,
      detail: 'The allow lane is ordinary in-process loopback egress through the composition provider. The deny lane refuses before the provider. The OS was never asked to deny anything.',
      osLevelNetworkIsolationClaimed: false,
    },
  }
}

// ── rows / blueprints ───────────────────────────────────────────────────────
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
    staticModel: { provider: 'deepseek-official', model: 'a5sf-recon-web-model' },
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
    a5sfEvidencePath: join(home, 'a5sf-consult.jsonl'),
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
        id: 'a5sf-recon-web-offer',
        name: pathToFileURL(OFFER_ROW).href,
        config: {
          allowRoot: workspace,
          readAllow: [workspace],
          writeAllow: [workspace],
          counterPath: join(home, 'web-provider.jsonl'),
          hostWebCounterPath: join(home, 'host-web.jsonl'),
          endpoint: endpoint.origin,
          networkAllowTemplates: [TEMPLATE_ALLOW],
          networkDenyTemplates: [TEMPLATE_DENY],
          bindingIdentity: BINDING,
        },
      },
      { id: 'dsh-agent-team', name: PRODUCTION_ROW, config: teamRowConfig({ home }) },
      { id: 'p6t6-team-tools', name: P6T6_ROW },
      presetDeclarationRow({
        id: PRESET_LEADER,
        displayName: 'a5sf recon-web leader base',
        description: 'the LEADER preset: persona + tool-fs + persistent shell. It deliberately does NOT surface web_fetch/web_search.',
        plugins: smokePresetPlugins({
          personaText,
          cwdSuffix: 'Your working directory is {{cwd}}.',
          bashDescription: 'Run commands in a bash shell. State is persistent across calls.',
        }),
      }),
      presetDeclarationRow({
        id: PRESET_MEMBER,
        displayName: 'a5sf recon-web member base',
        description: 'the MEMBER preset: the smoke preset plus the pinned @deepseek-ai/dsh-tool-web (both tools). This is the pair route-C re-mounts on the realm scope.',
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
  `  persona: ${JSON.stringify(`You are the leader of the a5sf recon-web anchor team. The driver measures your model-facing tool surface. ${RECON_MARKERS.discovery}. Reply with one short line and stop; call no tool.`)}`,
  'members:',
  '  - templateId: weballow',
  `    persona: ${JSON.stringify('You are an a5sf recon web worker.')}`,
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
    `  persona: ${JSON.stringify('You are the leader of the a5sf recon-web team. The driver delegates the recon probes; do not call tools on your own.')}`,
    '  capabilities:', '    teamTools:', '      kind: allow', '      items:',
    '        - team_delegate',
    '        - team_archive_member',
    '        - team_follow_up',
    '        - team_collect',
    ...denyLines,
    '    skills:', '      kind: allow', '      items: []',
    '    mcp:', '      kind: allow', '      items: []',
    '    permissions:', '      default: deny', '      allow: []', '      ask: []', '      deny: []',
    'teamEnvelope:', '  allow:', '    - create-member', '    - assign-task', '    - send-message', '    - report-progress', '    - archive-member', '  deny: []',
    'members:',
    '  - templateId: weballow',
    '    displayName: "a5sf recon web allow worker"',
    `    persona: ${JSON.stringify('You are an a5sf recon web worker on the ALLOW lane. On your first turn call web_fetch exactly once on the URL in the instruction; on your next turn call web_search exactly once; then report the exact bytes you received. Call nothing else.')}`,
    '  - templateId: webdeny',
    '    displayName: "a5sf recon web deny worker"',
    `    persona: ${JSON.stringify('You are an a5sf recon web worker on the DENY lane. On your first turn call web_fetch exactly once on the URL in the instruction; on your next turn call web_search exactly once; then report the exact error text you received. Call nothing else.')}`,
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

// ── preflight (shared, recorded, and NOT a vocabulary waiver) ───────────────
function runSharedPreflight() {
  try {
    const stdout = execFileSync('node', [
      join(REPO_ROOT, 'scripts', 'a5sf-preflight.mjs'),
      '--bundle', PREFLIGHT_BUNDLE_PATH,
      '--repo', REPO_ROOT,
      '--host-root', HOST_TREE,
      '--pretty',
    ], { encoding: 'utf8', cwd: REPO_ROOT, maxBuffer: 16 * 1024 * 1024 })
    writeFileSync(PREFLIGHT_LOG_PATH, stdout)
    return JSON.parse(stdout)
  } catch (error) {
    const text = String(error?.stdout ?? '') + String(error?.stderr ?? '')
    writeFileSync(PREFLIGHT_LOG_PATH, text)
    try { return JSON.parse(String(error?.stdout ?? '')) } catch { return { verdict: 'UNREADABLE', raw: text.slice(0, 4000) } }
  }
}

/**
 * The boot gate. The shared preflight CANNOT certify an admitted-network case
 * (its closed case-class vocabulary is `connection-denial | admission-refusal`),
 * so the only findings this gate tolerates are exactly that vocabulary gap on
 * the declared ALLOW cases. Any other finding blocks the start.
 */
function preflightGate(preflight) {
  const findings = Array.isArray(preflight?.findings) ? preflight.findings : []
  // The two codes the closed network-policy rule emits for an ALLOW case:
  //   POLICY_EXPECTATION_CONTRADICTS_LANE  "network=restricted is UNSUPPORTED this round"
  //   POLICY_NETWORK_PROBE_NOT_ENFORCED    emitted unconditionally on the network axis
  // Both are statements about the INSTRUMENT's closed vocabulary, not about this
  // plan; they are recorded verbatim and never waived for anything else.
  const TOLERATED_CODES = new Set(['POLICY_EXPECTATION_CONTRADICTS_LANE', 'POLICY_NETWORK_PROBE_NOT_ENFORCED'])
  const namesAllowCase = (f) => {
    const text = `${String(f?.caseId ?? '')} ${String(f?.detail ?? '')}`
    return [...ALLOW_CASE_IDS].some((id) => text.includes(id))
  }
  const tolerated = (f) => TOLERATED_CODES.has(String(f?.code ?? '')) && namesAllowCase(f)
  const blocking = findings.filter((f) => !tolerated(f))
  return {
    verdict: String(preflight?.verdict ?? 'MISSING'),
    findings,
    toleratedFindings: findings.filter(tolerated),
    blockingFindings: blocking,
    ok: blocking.length === 0 && String(preflight?.verdict ?? '') !== 'UNREADABLE',
    note: 'the shared preflight grades the DENY half as PASS-contract cases; the ALLOW half is outside its closed vocabulary and is recorded rather than hidden. This gate blocks on anything outside that known gap.',
  }
}

// ── plan ────────────────────────────────────────────────────────────────────
async function plan() {
  log(`PLAN MODE — host-free composition. repo=${REPO_ROOT}`)
  log(`pinned host=${TEST_USE_BASELINE_SHA} tree=${HOST_TREE}`)
  for (const [label, path] of [['tool-web', HOST_TOOL_WEB]]) {
    if (!existsSync(path)) throw new Error(`the pinned ${label} module is missing: ${path}`)
    log(`pinned module present: ${label} -> ${path}`)
  }
  const offer = await import(pathToFileURL(OFFER_ROW).href)
  if (typeof offer.apply !== 'function' || offer.name !== 'a5sf-recon-web-offer') {
    throw new Error(`the offer row does not export apply/name as expected: ${JSON.stringify({ name: offer.name, apply: typeof offer.apply })}`)
  }
  log('offer row imports; exports apply + name')
  if (!existsSync(MARKER_MOCK)) throw new Error(`the marker mock is missing: ${MARKER_MOCK}`)
  log('marker routing table present')
  const head = resolveHeadCommit(REPO_ROOT)
  if (head === null) throw new Error('git rev-parse HEAD failed')
  log(`HEAD=${head}`)
  if (!head.startsWith(RECON_BASE_SHA)) throw new Error(`RECON_BASE_SHA_MISMATCH: HEAD=${head}, the recon lane is bound to ${RECON_BASE_SHA}`)
  assertBlueprintText(BP_ANCHOR_YAML, BP_ANCHOR_ID, 1, 'anchor.yaml')
  log('anchor blueprint parses (leader legacy, one member template)')
  const mainExpected = assertBlueprintText(mainBlueprintYaml(DEFAULT_DENY), BP_MAIN_ID, 2, 'main.yaml')
  log(`main blueprint template parses; expected deny=${JSON.stringify(mainExpected.builtinToolDeny)}`)

  // The endpoint is started for the PLAN too: the bundle names the real origin
  // the boot will use, and the preflight's fixtures must not be a placeholder.
  const server = await startEndpoint()
  log(`controlled local endpoint listening at ${endpoint.origin}`)
  const bundle = buildPreflightBundle({ head, rowIds: ['a5sf-recon-web-offer', 'dsh-agent-team', 'p6t6-team-tools', `preset-${PRESET_LEADER}`, `preset-${PRESET_MEMBER}`] })
  writeJson(PREFLIGHT_BUNDLE_PATH, bundle)
  const preflight = runSharedPreflight()
  const gate = preflightGate(preflight)
  writeJson(join(HERE, 'plan-preflight.json'), { at: new Date().toISOString(), preflight, gate, osLevelNetworkIsolationClaimed: false })
  log(`shared preflight verdict=${gate.verdict} findings=${gate.findings.length} tolerated=${gate.toleratedFindings.length} blocking=${gate.blockingFindings.length}`)
  if (!gate.ok) {
    log(`preflight blocking findings: ${redact(JSON.stringify(gate.blockingFindings)).slice(0, 1600)}`)
    throw new Error('PREFLIGHT_BLOCKING_FINDINGS: the shared preflight refused the plan for a reason outside the recorded ALLOW-vocabulary gap')
  }
  writeJson(join(HERE, 'plan-rows.json'), {
    world: 'plan-only',
    head,
    presets: [PRESET_LEADER, PRESET_MEMBER],
    templates: [TEMPLATE_ALLOW, TEMPLATE_DENY],
    endpoint: endpoint.origin,
    osLevelNetworkIsolationClaimed: false,
  })
  await new Promise((done) => server.close(done))
  log('PLAN OK — zero Host starts spent')
}

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
    ['recon-web-offer-row.mjs', OFFER_ROW],
    ['recon-marker-mock.mjs', MARKER_MOCK],
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

// ── boot ────────────────────────────────────────────────────────────────────
async function boot() {
  log(`BOOT MODE — exactly ONE Host start. repo=${REPO_ROOT}`)
  log(`pinned host=${TEST_USE_BASELINE_SHA} tree=${HOST_TREE}`)
  if (!existsSync(HOST_TOOL_WEB)) throw new Error(`the pinned tool-web module is missing: ${HOST_TOOL_WEB}`)

  const head = resolveHeadCommit(REPO_ROOT)
  if (head === null) throw new Error('git rev-parse HEAD failed: the grant cannot be bound')
  if (!head.startsWith(RECON_BASE_SHA)) throw new Error(`RECON_BASE_SHA_MISMATCH: HEAD=${head}, the recon lane is bound to ${RECON_BASE_SHA}`)
  log(`HEAD=${head}`)
  const bundle = readJson(PREFLIGHT_BUNDLE_PATH)
  if (bundle === null) throw new Error(`NO PREFLIGHT BUNDLE at ${PREFLIGHT_BUNDLE_PATH}: run --plan first`)
  if (String(bundle.candidate?.head ?? '') !== head) {
    throw new Error(`GRANT_FOREIGN_COMMIT: the preflight bundle is bound to ${String(bundle.candidate?.head)}, but HEAD is ${head}`)
  }
  if (!existsSync(PREFLIGHT_LOG_PATH)) throw new Error(`NO PREFLIGHT LOG at ${PREFLIGHT_LOG_PATH}`)
  const preflight = readJson(PREFLIGHT_LOG_PATH) ?? JSON.parse(readFileSync(PREFLIGHT_LOG_PATH, 'utf8'))
  const gate = preflightGate(preflight)
  if (!gate.ok) throw new Error(`PREFLIGHT_BLOCKING_FINDINGS at boot: ${redact(JSON.stringify(gate.blockingFindings)).slice(0, 1200)}`)
  const authorityNow = authorityBlock()
  if (authorityNow.pointerSha256 !== bundle.authority?.pointerSha256) {
    throw new Error(`AUTHORITY_POINTER_MOVED: measured ${authorityNow.pointerSha256}, bundle names ${String(bundle.authority?.pointerSha256)}`)
  }
  log(`preflight verdict=${gate.verdict} (tolerated ALLOW-vocabulary findings=${gate.toleratedFindings.length}); authority pointer sha256=${authorityNow.pointerSha256}`)

  if (OUT === HERE) throw new Error('BOOT_DIR_REQUIRED: pass --evidence <run dir>')
  const grant = readJson(GRANT_PATH)
  if (grant === null) throw new Error(`NO DEV-LIVE GRANT at ${GRANT_PATH}`)
  if (grant.scope !== 'DEV-LIVE') throw new Error(`GRANT_SCOPE_MISMATCH: ${GRANT_PATH} is scope=${String(grant.scope)}`)
  if (grant.face !== FACE || grant.world !== LINE) throw new Error(`GRANT_FACE_MISMATCH: ${JSON.stringify({ face: grant.face, world: grant.world })}`)
  if (parseJsonl(LEDGER_PATH).length !== 0) throw new Error(`LEDGER_NOT_FRESH: ${LEDGER_PATH} already holds rows`)

  // the controlled endpoint lives for the whole run
  const server = await startEndpoint()
  log(`controlled local endpoint listening at ${endpoint.origin} (127.0.0.1:${endpoint.port})`)

  const runId = `a5sf-recon-web-${new Date().toISOString().replace(/[:.]/gu, '-')}`
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
      sink: 'world-home a5sf-consult.jsonl (copy: guard-facts.json)',
      authority: {
        pointer: { snapshot_version: authority.snapshotVersion, content_digest: authority.contentDigest },
        baseline: authority.baseline,
        pointerSha256: authority.pointerSha256,
      },
      providerComposition: 'test row recon-web-offer-row.mjs (composition compiles the lane with the ONE compiler compileEffectiveIo); the confined web face, the guard, the capability probe and PD-15 are the shipped dist modules',
      providerSelection: 'the in-process composition transport to the controlled 127.0.0.1 endpoint; the inherited host web service is wrapped read-only as a tripwire',
      transport: 'REAL in-process loopback HTTP to the driver-owned local endpoint (127.0.0.1:ephemeral); no external egress',
      endpoint: endpoint.origin,
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
    if (JSON.stringify(handed) !== JSON.stringify(rows.map((r) => r.id))) throw new Error('row handoff identity/order mismatch')
    const identity = rowIdentityCheck(rows)
    if (identity.ok !== true) throw new Error(`row composition refused: ${identity.reason}: ${identity.detail}`)
    log(`row handoff: ${JSON.stringify(handed)}`)

    mkdirSync(config.blueprintDir, { recursive: true })
    writeFileSync(join(config.blueprintDir, 'anchor.yaml'), BP_ANCHOR_YAML)
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
      endpoint: { origin: endpoint.origin, port: endpoint.port },
      authority,
      grant,
      preflight: { verdict: gate.verdict, toleratedFindings: gate.toleratedFindings, blockingFindings: gate.blockingFindings },
      osLevelNetworkIsolationClaimed: false,
    })

    stage = 'mock-start'
    const decide = makeReconDecide({
      endpoint: endpoint.origin,
      routingLog,
      onDecision: (decision) => {
        try {
          appendFileSync(join(OUT, 'marker-routing.jsonl'), `${JSON.stringify(decision)}\n`)
        } catch { /* diagnostics never break the turn */ }
      },
    })
    await world.startMock({ decide })
    log(`mock started on port ${String(world.mock?.port)}`)

    stage = 'boot-host'
    bootInfo = await lease.boot(() => harness.boot({ world, phase: `${SUITE}-boot1`, bootTimeoutMs: 240_000 }))
    record.record.boots = [{ phase: `${SUITE}-boot1`, world: world.id, port: bootInfo.port, logPath: bootInfo.logPath }]
    log(`BOOTED port=${bootInfo.port} (lease bootsSpent=${lease.bootsSpent()})`)

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
    const health = await pollHealth(origin, { timeoutMs: BOOT_TIMEOUT_MS })
    writeJson(join(OUT, 'health.json'), {
      gate: 'poll', timeoutMs: health.timeoutMs, elapsedMs: health.elapsedMs,
      probeCount: health.probes.length, kind: health.kind, final: health.final, probes: health.probes,
      osLevelNetworkIsolationClaimed: false,
    })
    if (health.kind === 'failed') throw new Error(`health gate: settled failure ${JSON.stringify(health.final?.body?.setupError ?? null)}`)
    if (health.kind === 'timeout') throw new Error(`health gate timed out after ${String(health.timeoutMs)}ms`)
    log(`health 200 ready=${String(health.final.body.ready)} after ${String(health.elapsedMs)}ms (${String(health.probes.length)} probe(s))`)

    stage = 'discover-leader-surface'
    const discPrompt = await waitFor(async () => {
      const res = await apiPrompt(origin, cookie, ROOT, `${RECON_MARKERS.discovery}: reply with one short line. Call no tool.`, 'recon-web-disc')
      return res.status === 200 ? res : null
    }, 60_000, 2000)
    if (!discPrompt.hit) throw new Error('the discovery prompt was never accepted on the anchor session')
    const discW = await waitFor(() => (world.mock?.requests ?? []).some((r) => hasMarker(r, RECON_MARKERS.discovery) && surfaceNamesOf(r).length > 0), 90_000)
    if (!discW.hit) throw new Error('the discovery model request never carried a tool surface')
    const discRequest = [...world.mock.requests]
      .filter((r) => hasMarker(r, RECON_MARKERS.discovery))
      .sort((a, b) => surfaceNamesOf(b).length - surfaceNamesOf(a).length)[0]
    const surface = [...new Set(surfaceNamesOf(discRequest))].sort()
    const denyList = surface.filter((name) => !name.startsWith('team_') && !MANAGED_TOOL_NAMES.includes(name) && !SAFE_UNMANAGED_TOOL_NAMES.includes(name)).sort()
    writeJson(join(OUT, 'surface.json'), {
      discovery: { marker: RECON_MARKERS.discovery, tools: surface, toolsCount: surface.length },
      denyList,
      provenance: 'the tool list the mock recorded on the ANCHOR leader\'s own model request',
      osLevelNetworkIsolationClaimed: false,
    })
    log(`discovery surface (${surface.length}); deny list=${JSON.stringify(denyList)}`)

    stage = 'write-main-blueprint'
    const mainText = mainBlueprintYaml(denyList)
    writeFileSync(join(config.blueprintDir, 'main.yaml'), mainText)
    const parsedMain = assertBlueprintText(readFileSync(join(config.blueprintDir, 'main.yaml'), 'utf8'), BP_MAIN_ID, 2, 'main.yaml')
    writeJson(join(OUT, 'main-blueprint.json'), { yaml: mainText, parsed: parsedMain, osLevelNetworkIsolationClaimed: false })
    log(`main blueprint parsed; builtinToolDeny=${JSON.stringify(parsedMain.builtinToolDeny)}`)

    stage = 'create-team'
    const created = await remoteCall(fetchJson, origin, cookie, 'team.create', {
      rootSessionId: CREATE_ROOT,
      blueprintId: BP_MAIN_ID,
      initialWork: { prompt: `${RECON_MARKERS.create}: reply with one short line. Call no tool.` },
    }, 'recon-web-create', 1)
    writeJson(join(OUT, 'create-team.json'), { status: created.status, body: created.body, osLevelNetworkIsolationClaimed: false })
    if (created.status !== 200 || created.body?.result?.ok !== true) {
      throw new Error(`team.create refused: status=${created.status} body=${JSON.stringify(created.body).slice(0, 1200)}`)
    }
    log(`team.create ok on ${CREATE_ROOT}`)

    stage = 'state-gate'
    const stateW = await waitFor(async () => {
      const st = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
      if (st.status !== 200) return null
      if (st.body?.rootSessionId !== CREATE_ROOT) return null
      if (String(st.body?.teamSession?.blueprintId ?? '') !== BP_MAIN_ID) return null
      return { status: st.status, body: st.body }
    }, 90_000)
    if (!stateW.hit) throw new Error('the created team never appeared on the directive root state route')
    writeJson(join(OUT, 'state.json'), { ...stateW.value, osLevelNetworkIsolationClaimed: false })
    log('state-gate open')

    stage = 'live-leader-gate'
    const liveW = await waitFor(async () => {
      const h = await fetchJson(`${origin}/__p6t6/health`, undefined, 30_000)
      const list = Array.isArray(h.body?.liveSessions) ? h.body.liveSessions : []
      return list.includes(CREATE_ROOT) ? list : null
    }, 90_000)
    if (!liveW.hit) throw new Error(`the created team root ${CREATE_ROOT} never became a live agent`)
    log(`live leader gate open: ${JSON.stringify(liveW.value)}`)

    const factsOf = (memberIdentity) => parseJsonl(paths.sink).filter((fact) => fact?.memberIdentity === String(memberIdentity))
    const counterRows = () => parseJsonl(paths.counter)
    const entryRowsOf = (memberIdentity) => counterRows().filter((row) => row?.leg === 'provider-entry' && row?.realm === `member:${String(memberIdentity)}`)
    const probeRowsOf = (memberIdentity) => counterRows().filter((row) => row?.leg === 'capability-probe' && row?.realm === `member:${String(memberIdentity)}`)
    const hostWebRows = () => parseJsonl(paths.hostWebCounter).filter((row) => row?.leg === 'host-web-call')

    const waitMember = async (label) => {
      const found = await waitFor(async () => {
        const st = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
        if (st.status !== 200) return null
        const member = (st.body?.members ?? []).find((m) => String(m.label) === label && String(m.childSessionId ?? '') !== '')
        return member === undefined ? null : member
      }, 150_000)
      if (!found.hit) throw new Error(`member ${label} never became live`)
      return found.value
    }

    const runMember = async ({ label, template, marker, laneName }) => {
      const before = {
        endpointRequests: endpoint.requests.length,
        factCount: parseJsonl(paths.sink).length,
        entryCount: counterRows().filter((row) => row?.leg === 'provider-entry').length,
        probeCount: counterRows().filter((row) => row?.leg === 'capability-probe').length,
        hostWebCount: hostWebRows().length,
      }
      const callId = `recon-web-delegate-${laneName}`
      const queries = laneName === 'allow' ? ['a5sf recon web allow'] : ['a5sf recon web deny a', 'a5sf recon web deny b']
      const prompt = `${marker}: you are the ${laneName} recon Member. First call web_fetch exactly once with {"url":"${endpoint.origin}/page?lane=${laneName}"}. After its result, call web_search exactly once with ${JSON.stringify({ queries })}. Then report the exact bytes or the exact error text. Call no other tool.`
      const delegated = await toolRoute('team_delegate', {
        rootSessionId: CREATE_ROOT,
        requestToken: callId,
        delegationTemplateId: template,
        label,
        prompt,
      }, CREATE_ROOT, callId)
      writeJson(join(OUT, `delegate-${laneName}.json`), { status: delegated.status, body: delegated.body, osLevelNetworkIsolationClaimed: false })
      log(`delegate ${label}: status=${delegated.status}`)
      if (delegated.status !== 200 || delegated.body?.ok !== true) {
        throw new Error(`team_delegate refused for ${label}: status=${delegated.status} body=${JSON.stringify(delegated.body).slice(0, 900)}`)
      }
      const member = await waitMember(label)
      const instanceId = String(member.instanceId)
      const expected = laneName === 'allow'
        ? (fact) => String(fact?.decision ?? '') === 'allow'
        : (fact) => String(fact?.decision ?? '') === 'deny' && String(fact?.decidedBy ?? '') === 'NETWORK_UNCONFINED_REALM'
      const twoFacts = await waitFor(() => {
        const facts = factsOf(instanceId)
        const fetchFact = facts.find((f) => f?.method === 'web:fetch' && expected(f))
        const searchFact = facts.find((f) => f?.method === 'web:search' && expected(f))
        return fetchFact !== undefined && searchFact !== undefined ? facts : null
      }, 150_000)
      if (!twoFacts.hit) log(`only ${factsOf(instanceId).length} qualifying fact(s) for ${instanceId} after ${twoFacts.elapsedMs}ms`)

      const memberRequests = () => (world.mock?.requests ?? []).filter((r) => hasMarker(r, marker))
      const requests = memberRequests()
      const withTools = requests.filter((r) => surfaceNamesOf(r).length > 0)
      const memberSurface = withTools.length > 0 ? [...new Set(surfaceNamesOf(withTools[withTools.length - 1]))].sort() : []
      // The LAST request carries the complete history; flattening every request
      // double-counts a tool result once per later turn (measured in run-02).
      const lastRequest = requests.length === 0 ? null : requests[requests.length - 1]
      const toolResults = lastRequest === null ? [] : toolMsgsOf(lastRequest)
      const errorResults = toolResults.filter((m) => m.isError === true)
      const facts = factsOf(instanceId)
      const fetchFact = facts.find((f) => f?.method === 'web:fetch') ?? null
      const searchFact = facts.find((f) => f?.method === 'web:search') ?? null
      const newEndpoint = endpoint.requests.slice(before.endpointRequests)
      const newEntries = entryRowsOf(instanceId)
      const newProbes = probeRowsOf(instanceId)
      const newHostWeb = hostWebRows().length - before.hostWebCount
      const fetchBytes = toolResults.some((m) => m.text.includes(ALLOW_BYTES))
      const searchBytes = toolResults.some((m) => m.text.includes(SEARCH_BYTES))
      const refusalTexts = errorResults.map((m) => m.text).filter((text) => text.includes('NETWORK_UNCONFINED_REALM'))
      const expectedFactTotal = laneName === 'allow' ? 2 : 3
      const expectedSearchFacts = laneName === 'allow' ? 1 : 2
      const checks = {
        memberSurfaceHasPair: memberSurface.includes('web_fetch') && memberSurface.includes('web_search'),
        modelTurnRan: withTools.length > 0,
        expectedFactTotal: facts.length === expectedFactTotal,
        expectedSearchFacts: facts.filter((f) => f?.method === 'web:search').length === expectedSearchFacts,
        fetchFactMethod: String(fetchFact?.method ?? '') === 'web:fetch',
        searchFactMethod: String(searchFact?.method ?? '') === 'web:search',
        decisionsMatchLane: facts.every((f) => expected(f)),
        endpointObservedExpected: laneName === 'allow' ? newEndpoint.length === 2 : newEndpoint.length === 0,
        providerEntriesMatchLane: laneName === 'allow' ? newEntries.length === 2 : newEntries.length === 0,
        noHostWebFallback: newHostWeb === 0,
        ...(laneName === 'allow'
          ? { fetchBytesReturned: fetchBytes, searchBytesReturned: searchBytes }
          : { typedRefusalText: refusalTexts.length === expectedFactTotal, noProviderEntry: newEntries.length === 0 }),
      }
      const verdict = Object.values(checks).every((v) => v === true) ? 'PROVEN' : 'REFUTED'
      const artifact = {
        schema: 'a5sf-recon-web/item/1',
        at: new Date().toISOString(),
        lane: laneName,
        caseIds: laneName === 'allow' ? ['web-allow-fetch', 'web-allow-search'] : ['web-deny-fetch', 'web-deny-search'],
        member: {
          instanceId,
          childSessionId: String(member.childSessionId),
          templateId: String(member.templateId),
          label,
          legacy: true,
          note: 'the template declares NO capabilities block -> permissionPolicy absent -> the legacy (non-strict) caller path',
        },
        preset: { member: PRESET_MEMBER, module: '@deepseek-ai/dsh-tool-web', tools: ['web_fetch', 'web_search'] },
        surface: { memberToolsFromModelRequest: memberSurface, hasWebFetch: memberSurface.includes('web_fetch'), hasWebSearch: memberSurface.includes('web_search') },
        model: {
          requests: requests.length,
          toolResults: toolResults.map((m) => ({ isError: m.isError === true, text: redact(m.text).slice(0, 600) })),
        },
        guardFacts: facts,
        guardFactCount: facts.length,
        endpoint: {
          origin: endpoint.origin,
          requestsDuringTurn: newEndpoint,
          countDuringTurn: newEndpoint.length,
          totalAfterTurn: endpoint.requests.length,
        },
        providerEntries: { rows: newEntries, count: newEntries.length, counterFile: paths.counter },
        capabilityProbes: { rows: newProbes, count: newProbes.length, note: 'the guard\'s own question to the backend; it enters no fetch/search/transport/dns/connect channel' },
        hostWebEntries: newHostWeb,
        checks,
        verdict,
        limits: {
          wording: LIMIT_SENTENCE,
          detail: laneName === 'allow'
            ? 'The bytes came back over an ordinary in-process loopback connection made by the composition transport. This is not confinement of anything.'
            : 'The refusal is our admission code, made before the provider was entered; the endpoint saw no request. Zero provider entries is a counter of our own code, not an OS observation. This does NOT prove network isolation.',
          osLevelNetworkIsolationClaimed: false,
        },
        osLevelNetworkIsolationClaimed: false,
      }
      writeJson(join(OUT, `item-web-${laneName}.json`), artifact)
      return artifact
    }

    stage = 'allow-member-turn'
    const allowItem = await runMember({ label: 'recon-web-allow', template: TEMPLATE_ALLOW, marker: RECON_MARKERS.allow, laneName: 'allow' })
    add('web-allow-fetch', allowItem.checks.fetchBytesReturned === true ? 'PASS' : 'FAIL', {
      decidedBy: allowItem.guardFacts.find((f) => f.method === 'web:fetch')?.decidedBy ?? null,
      endpointRequests: allowItem.endpoint.countDuringTurn,
      providerEntries: allowItem.providerEntries.count,
      locator: allowItem.guardFacts.find((f) => f.method === 'web:fetch')?.locator ?? null,
      artifact: 'item-web-allow.json',
    })
    add('web-allow-search', allowItem.checks.searchBytesReturned === true ? 'PASS' : 'FAIL', {
      decidedBy: allowItem.guardFacts.find((f) => f.method === 'web:search')?.decidedBy ?? null,
      locator: allowItem.guardFacts.find((f) => f.method === 'web:search')?.locator ?? null,
      artifact: 'item-web-allow.json',
    })

    stage = 'deny-member-turn'
    const denyItem = await runMember({ label: 'recon-web-deny', template: TEMPLATE_DENY, marker: RECON_MARKERS.deny, laneName: 'deny' })
    for (const [caseId, method] of [['web-deny-fetch', 'web:fetch'], ['web-deny-search', 'web:search']]) {
      const fact = denyItem.guardFacts.find((f) => f.method === method) ?? null
      add(caseId, String(fact?.decidedBy ?? '') === 'NETWORK_UNCONFINED_REALM' && denyItem.endpoint.countDuringTurn === 0 ? 'PASS' : 'FAIL', {
        decidedBy: fact?.decidedBy ?? null,
        decision: fact?.decision ?? null,
        locator: fact?.locator ?? null,
        endpointRequests: denyItem.endpoint.countDuringTurn,
        providerEntries: denyItem.providerEntries.count,
        artifact: 'item-web-deny.json',
      })
    }

    // ── LIFECYCLE: after archive, is the model path still reachable? ────────
    stage = 'lifecycle-archive-followup'
    const allowInstance = allowItem.member.instanceId
    const archiveCall = await toolRoute('team_archive_member', {
      rootSessionId: CREATE_ROOT,
      requestToken: 'recon-web-lifecycle-archive',
      targetInstanceId: allowInstance,
    }, CREATE_ROOT, 'recon-web-lifecycle-archive')
    const archived = await waitFor(async () => {
      const st = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
      if (st.status !== 200) return null
      const member = (st.body?.members ?? []).find((m) => String(m.instanceId) === allowInstance)
      return member === undefined ? null : member
    }, 60_000)
    const archivedLifecycle = archived.hit ? String(archived.value.lifecycle ?? '') : null
    const followUp = await toolRoute('team_follow_up', {
      rootSessionId: CREATE_ROOT,
      requestToken: 'recon-web-lifecycle-followup',
      targetInstanceId: allowInstance,
      prompt: `${RECON_MARKERS.allow}: call web_fetch once more with {"url":"${endpoint.origin}/page"} and report the bytes.`,
      async: false,
    }, CREATE_ROOT, 'recon-web-lifecycle-followup')
    const endpointBeforeLifecycle = endpoint.requests.length
    const lifecycle = {
      schema: 'a5sf-recon-web/lifecycle/1',
      at: new Date().toISOString(),
      question: 'After the governed Member is ARCHIVED, is the model path still reachable (and did the endpoint see anything)?',
      member: { instanceId: allowInstance },
      archive: { status: archiveCall.status, body: archiveCall.body },
      archivedLifecycle,
      followUp: {
        status: followUp.status,
        body: redact(JSON.stringify(followUp.body ?? null)).slice(0, 4000),
        // The tool envelope is `{ok:true, value:{status:'blocked',reason:'target-stale'}}`
        // for a refusal that the PRODUCT makes without an error envelope: the
        // verdict must read `value.status`, not the transport `ok`.
        refused: followUp.status !== 200
          || followUp.body?.ok !== true
          || String(followUp.body?.value?.status ?? '') === 'blocked',
        productReason: String(followUp.body?.value?.reason ?? ''),
      },
      endpointRequestsAfterArchive: endpoint.requests.length - endpointBeforeLifecycle,
      endpointTotalAtLifecycle: endpoint.requests.length,
      note: 'the ENDPOINT observations here cover the whole lifecycle window: the follow-up attempt is the model-facing path. A retained in-process face reference is a different question and is measured host-free (arms-hostfree A12).',
      osLevelNetworkIsolationClaimed: false,
    }
    writeJson(join(OUT, 'lifecycle.json'), lifecycle)
    log(`lifecycle: archiveStatus=${archiveCall.status} archivedLifecycle=${String(archivedLifecycle)} followUpStatus=${followUp.status} followUpOk=${String(followUp.body?.ok)}`)

    stage = 'member-state-readback'
    const finalState = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
    writeJson(join(OUT, 'state-final.json'), { status: finalState.status, body: finalState.body, osLevelNetworkIsolationClaimed: false })

    // ── non-per-case artefacts ─────────────────────────────────────────────
    writeJson(join(OUT, 'guard-facts.json'), { sink: paths.sink, facts: parseJsonl(paths.sink), osLevelNetworkIsolationClaimed: false })
    writeJson(join(OUT, 'counter-rows.json'), {
      all: counterRows(),
      providerEntries: counterRows().filter((row) => row?.leg === 'provider-entry'),
      capabilityProbes: counterRows().filter((row) => row?.leg === 'capability-probe'),
      compiledLanes: counterRows().filter((row) => row?.leg === 'compiled-lane'),
      hostWebRows: hostWebRows(),
      note: 'provider entries = the composition transport was entered. capability probes = the guard\'s own question to the backend. compiled-lane = the lane the ONE compiler produced for that realm.',
      osLevelNetworkIsolationClaimed: false,
    })
    writeJson(join(OUT, 'endpoint-observations.json'), {
      origin: endpoint.origin,
      port: endpoint.port,
      totalRequests: endpoint.requests.length,
      requests: endpoint.requests,
      note: 'SERVER-SIDE observation: the controlled endpoint\'s own request log. For the deny lane this list must contain no request attributable to the deny window; for the allow lane exactly the fetch + search requests.',
      osLevelNetworkIsolationClaimed: false,
    })
    const routed = (world.mock?.requests ?? []).map((request, index) => ({
      seq: index + 1,
      tools: surfaceNamesOf(request),
      markers: Object.values(RECON_MARKERS).filter((marker) => hasMarker(request, marker)),
      wholeTurnKind: routeKindOf(request),
      routed: routingLog[index] ?? null,
    }))
    writeJson(join(OUT, 'marker-routing.json'), {
      markers: RECON_MARKERS,
      requests: routed,
      routingLog,
      routingHeld: {
        allowServedFetchThenSearch: routingLog.filter((r) => r.kind === 'allow').map((r) => r.disposition).join(',') === 'tool-call-fetch,tool-call-search,final-text',
        denyServedFetchThenSearch: routingLog.filter((r) => r.kind === 'deny').map((r) => r.disposition).join(',') === 'tool-call-fetch,tool-call-search,final-text',
        noWrongLane: routingLog.every((r) => r.kind !== 'allow' || r.disposition.startsWith('tool-call') || r.disposition === 'final-text'),
      },
      osLevelNetworkIsolationClaimed: false,
    })
    writeJson(join(OUT, 'mock-requests.json'), { count: (world.mock?.requests ?? []).length, requests: world.mock?.requests ?? [], osLevelNetworkIsolationClaimed: false })

    stage = 'teardown'
    const port = bootInfo.port
    teardown = await world.teardown()
    const closed = !(await portOpen(port))
    writeJson(join(OUT, 'teardown.json'), {
      at: new Date().toISOString(),
      teardown,
      port,
      portClosedAfterTeardown: closed,
      homeRemoved: existsSync(world.home) === false,
      homePath: world.home,
      hostAliveAtEnd: hostAlive(),
      endpointStillListening: endpoint.port !== null,
      osLevelNetworkIsolationClaimed: false,
    })
    log(`teardown: portClosed=${String(closed)} homeRemoved=${String(existsSync(world.home) === false)}`)
    if (!closed) throw new Error(`the host port ${port} is still open after teardown`)
  } catch (error) {
    record.markAborted({ stage, detail: null, error: String(error?.stack ?? error?.message ?? error) })
    log(`ABORT at ${stage}: ${String(error?.stack ?? error?.message ?? error)}`)
    if (world !== null) {
      try {
        const requests = world.mock?.requests ?? []
        writeJson(join(OUT, 'mock-requests.json'), { count: requests.length, requests, abortedAt: stage, osLevelNetworkIsolationClaimed: false })
        if (runPaths !== null) {
          writeJson(join(OUT, 'guard-facts.json'), { sink: runPaths.sink, facts: parseJsonl(runPaths.sink), abortedAt: stage, osLevelNetworkIsolationClaimed: false })
          writeJson(join(OUT, 'counter-rows.json'), { all: parseJsonl(runPaths.counter), abortedAt: stage, osLevelNetworkIsolationClaimed: false })
        }
        writeJson(join(OUT, 'endpoint-observations.json'), { origin: endpoint.origin, port: endpoint.port, requests: endpoint.requests, abortedAt: stage, osLevelNetworkIsolationClaimed: false })
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
    await new Promise((done) => server.close(done))
    const finalized = record.finalize()
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
    writeJson(join(OUT, 'ledger.json'), {
      recordClass: 'DEV-LIVE',
      ledgerPath: 'run-ledger.jsonl',
      plannedStarts: 1,
      boots: bootRows.length,
      rows,
      intentRow: intentRows[0] ?? null,
      bootRow: bootRows[0] ?? null,
      outcomeRow: outcomeRows[0] ?? null,
      devLiveOutcomeRecorded: outcomeRows.length === 1,
      osLevelNetworkIsolationClaimed: false,
    })
    record.record.osLevelNetworkIsolationClaimed = false
    record.write(RUN_RECORD_PATH)
    log(formatSummary(finalized))
    writeJson(join(OUT, 'verdict.json'), {
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
      endpoint: { origin: endpoint.origin, port: endpoint.port, totalRequests: endpoint.requests.length },
      limit: LIMIT_SENTENCE,
      osLevelNetworkIsolationClaimed: false,
    })
    log(`OVERALL=${finalized.overall}`)
  }
}

// ── entry ───────────────────────────────────────────────────────────────────
const isMain = process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url
if (isMain) {
  const run = PLAN_ONLY ? plan : boot
  run().then(() => {
    if (PLAN_ONLY) process.exit(0)
    const verdict = readJson(join(OUT, 'verdict.json'))
    process.exit(verdict?.overall === 'PASS' ? 0 : 1)
  }).catch((error) => {
    log(`FATAL: ${String(error?.stack ?? error?.message ?? error)}`)
    process.exit(2)
  })
}

export { LIMIT_SENTENCE, plan, boot }
