#!/usr/bin/env node
/**
 * tests/world-factory/drivers/a5sf-pd30-web-preview/run-boot.mjs — the LIVE
 * pair for PD-30: the SHIPPED composition gives a governed Member a real,
 * governed web capability, and the negative paths are refused before the wire.
 *
 * WHAT IS DIFFERENT FROM PD-27 (whose driver this one is adapted from):
 *
 *   1. NO ROW IS REWRITTEN. PD-27 pointed the preset's `tool-web` row at a
 *      `file:` URL because the pinned test tree does not install this
 *      repository. This driver instead builds the World's INSTALL GRAPH
 *      (`profiles/web/node_modules/dsh-agent-team -> <repo root>`, the same
 *      shape an install produces), so `dsh-agent-team/host`,
 *      `dsh-agent-team/web-tool` and `dsh-agent-team/web-transport` resolve
 *      through `package.json#exports` exactly as in production. `rewrites` is
 *      asserted empty and `preset-effective.json` records the shipped names.
 *   2. THE WEB FACE IS THE PRODUCT'S. PD-27 supplied the compiled realm answer
 *      from a test composition row, because the product refused a narrowed
 *      network lane and its realm had no web face. PD-30's realm owns the face
 *      (it reads the composition's `teamA5sfWebTransport` service), so the
 *      deny arm is a lane the BLUEPRINT's ceiling compiles — a path a user can
 *      take — and no `teamA5sfRealm` row exists here.
 *   3. `web_search` HAS A BACKEND: the host `ExaSearchProvider` posts to a
 *      LOCAL endpoint and the parsed sources are the witness.
 *
 * ARMS. `--arm allow` (default): fetch allow + search + SSRF + malformed +
 * regression tools, all in ONE Member turn. `--arm deny`: a blueprint ceiling
 * with `network: deny`, measured on the fixture's OWN connection counter.
 * `--arm nosearch`: the shipped assembly with no search credential, so the
 * "surface without backend" state is measured as the TYPED gap it is.
 *
 * WHAT IS PRODUCT AND WHAT IS FIXTURE (stated so it cannot be read as more):
 *   - the shipped rows, the preset, the realm provider, the confined face, its
 *     admission guard, the two host providers and the `!!js` config dialect are
 *     the SHIPPED ones;
 *   - the World's install graph, the fixture origins, the search endpoint, the
 *     credential string and the member ceilings are TEST COMPOSITION;
 *   - the transport row's CONFIG is concrete World values where production
 *     resolves `!!js` env expressions — same keys, different source.
 *
 * Run (from the repo root, one arm at a time; the dev-live slot lease is the
 * scheduler, never more than two boots at once):
 *
 *   node tests/world-factory/drivers/a5sf-pd30-web-preview/run-boot.mjs --plan
 *   node tests/world-factory/drivers/a5sf-pd30-web-preview/run-boot.mjs --arm allow --boots 2
 *   node tests/world-factory/drivers/a5sf-pd30-web-preview/run-boot.mjs --arm deny --boots 2
 *   node tests/world-factory/drivers/a5sf-pd30-web-preview/run-boot.mjs --arm nosearch --boots 2
 *
 * `--plan` is host-free (zero boots): rows, blueprint validation, install-graph
 * resolution and the zero-rewrite assertion.
 *
 * CORE PATCH BUDGET = 0: the pinned host tree is read-only (porcelain is
 * checked before and after every boot) and :3080 is never touched.
 *
 * @module tests/world-factory/drivers/a5sf-pd30-web-preview/run-boot
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  appendFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, symlinkSync, writeFileSync,
} from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { zstdDecompressSync } from 'node:zlib'

import {
  apiPrompt, authenticate, emitPatchLayer, fetchJson,
} from '../../lib/world-factory.mjs'
import { createRunRecord, formatSummary, readAuthorityBinding } from '../../lib/run-record.mjs'
import { TEST_USE_BASELINE_SHA } from '../../../paths.mjs'
import { createA5sfHarness } from '../../lib/a5sf-harness.mjs'
import { acquireDevLiveSlot } from '../../lib/dev-live-slots.mjs'
import { resolveHeadCommit } from '../../suites/150-a5sf-read.mjs'
import {
  lastUserTextOfStatic, messagesOf, surfaceNamesOf, textOf,
} from '../../lib/u6-fs-assembly.mjs'


const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..')
const EVIDENCE = join(REPO_ROOT, 'dev', 'agent-workflow', 'evidence', 'a5sf-pd30-web-preview')
const LEDGER_PATH = join(EVIDENCE, 'run-ledger.jsonl')

const LINE = 'u5a5sfpd30'
const BOOT_ROOT = 'session-a5sf-pd30-boot'
const ACCEPTANCE_ROOT = 'session-a5sf-pd30-team'
const BP_ANCHOR_ID = 'team.a5sf.pd30.anchor'
const BP_MAIN_ID = 'team.a5sf.pd30.main'
const PRESET_ID = 'a5sf-governed-member'
const TRANSPORT_ROW_ID = 'a5sf-web-transport'
const TRANSPORT_ROW_NAME = 'dsh-agent-team/web-transport'

const MK_DISC = 'A5SF_PD30_DISC'
const MK_L1 = 'A5SF_PD30_L1_DRIVE'
const TOK_A = 'a5sf-pd30-turn'
const CALL_DELEGATE_A = 'call-a5sfpd30-delegate-a'
const CALL_FETCH = 'call-a5sfpd30-fetch'
const CALL_SSRF = 'call-a5sfpd30-ssrf'
const CALL_MALFORMED = 'call-a5sfpd30-malformed'
const CALL_SEARCH = 'call-a5sfpd30-search'
const CALL_BASH = 'call-a5sfpd30-bash'
const CALL_READ = 'call-a5sfpd30-read'
const CALL_WRITE = 'call-a5sfpd30-write'
const CALL_EDIT = 'call-a5sfpd30-edit'
const CALL_GREP = 'call-a5sfpd30-grep'
const CALL_GLOB = 'call-a5sfpd30-glob'
const CALL_CLOSED_WORKFLOW = 'call-a5sfpd30-closed-workflow'
const CALL_CLOSED_RUNCODE = 'call-a5sfpd30-closed-runcode'
const CALL_SKILL = 'call-a5sfpd30-skill'
const CALL_PRESENT = 'call-a5sfpd30-present'
const DONE_A = 'A5SF_PD30_MEMBER_A_DONE'
const DONE_L1 = 'A5SF_PD30_L1_DONE'

/** The body the LOCAL fixture serves. Verbatim, or the allow arm did not happen. */
const KNOWN_BODY = 'A5SF_PD30_KNOWN_BODY_BYTES'
const KNOWN_PATH = '/known'
const DENY_PATH = '/denied'
const READ_INPUT_BODY = 'A5SF_PD30_READ_INPUT'
const WRITE_BEFORE = 'A5SF_PD30_EDIT_BEFORE'
const WRITE_AFTER = 'A5SF_PD30_EDIT_AFTER'
/** The names the governed preset declares; every arm keeps the SAME surface. */
const WEB_TOOL_NAMES = Object.freeze(['web_fetch', 'web_search'])
/** Names an earlier lane closed. They must stay typed `unknown tool`. */
const CLOSED_TOOL_NAMES = Object.freeze(['workflow', 'run_code'])
/** The exa-shaped answer the LOCAL search endpoint serves (four results, one blank snippet). */
const SEARCH_ANSWER = Object.freeze({
  results: [
    { url: 'https://example.test/alpha', title: 'Alpha', publishedDate: '2026-11-01', highlights: ['pd30 first snippet'] },
    { url: 'https://example.test/beta', title: 'Beta', highlights: ['  ', 'pd30 second snippet'] },
    { url: 'https://example.test/gamma', highlights: [] },
    { url: 'https://example.test/delta', title: 'Delta', highlights: ['pd30 third snippet'] },
  ],
})
const SEARCH_QUERY = 'a5sf pd30 governed search'

const argv = process.argv.slice(2)
const PLAN_ONLY = argv.includes('--plan')
/**
 * PD-30's arms:
 *   allow    — the shipped assembly, allow lane: fetch + search + negatives + regression;
 *   deny     — the same assembly, a ceiling that says `network: deny`;
 *   nosearch — the shipped assembly with NO search credential: the honest gap.
 */
const ARM = (() => {
  const i = argv.indexOf('--arm')
  if (i === -1) return 'allow'
  const value = argv[i + 1]
  if (value !== 'allow' && value !== 'deny' && value !== 'nosearch') {
    throw new Error(`--arm must be 'allow', 'deny' or 'nosearch' (got ${String(value)})`)
  }
  return value
})()
/** The cases THIS arm measures. A selected case with no verdict is a FAIL. */
const SELECTED_CASES = Object.freeze([
  ARM === 'deny' ? 'pd30:web-deny' : ARM === 'nosearch' ? 'pd30:search-no-backend' : 'pd30:web-allow',
  ...(ARM === 'allow' ? ['pd30:web-search', 'pd30:web-ssrf', 'pd30:web-malformed', 'pd30:regression-tools'] : []),
  'pd30:web-surface',
  'pd30:closed-still-typed',
  'pd30:no-base-transport',
])
/** The template whose compiled answer the product realm supplies for this arm. */
const TEMPLATE = ARM === 'deny' ? 'webworker-deny' : 'worker'
const RUNS = join(EVIDENCE, 'runs', ARM)
const COMPOSITION_PATH = process.env.A5SF_PD30_COMPOSITION === undefined || process.env.A5SF_PD30_COMPOSITION === ''
  ? join(REPO_ROOT, 'cordis.patch.yml')
  : resolve(process.env.A5SF_PD30_COMPOSITION)
const BOOTS_WANTED = (() => {
  const i = argv.indexOf('--boots')
  if (i === -1) return 2
  const n = Number(argv[i + 1])
  if (!Number.isInteger(n) || n < 1 || n > 2) throw new Error(`--boots must be 1 or 2 (got ${String(argv[i + 1])})`)
  return n
})()

const startedAt = new Date().toISOString()
let RUN_LOG = join(EVIDENCE, 'driver.log')
function log(line) {
  const text = `[${new Date().toISOString()}] ${line}`
  // eslint-disable-next-line no-console
  console.log(text)
  try { appendFileSync(RUN_LOG, `${text}\n`) } catch { /* evidence is best effort; stdout is not */ }
}
const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
const parseJsonl = (p) => {
  try { return readFileSync(p, 'utf8').split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l)) } catch { return [] }
}
const redact = (t) => String(t ?? '').replace(/\?token=[A-Za-z0-9_-]+/gu, '?token=<redacted>')
const utcStamp = () => new Date().toISOString().replace(/[:.]/gu, '-')

function hostTreePath() {
  const candidates = [process.env.A5SF_PD30_HOST_TREE, join(REPO_ROOT, 'tests', 'deepseek-harness-test-use')]
  const m = /^(.*)\/\.worktrees\/[^/]+$/u.exec(REPO_ROOT)
  if (m !== null) candidates.push(join(m[1], 'tests', 'deepseek-harness-test-use'))
  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null && candidate !== '' && existsSync(candidate)) return candidate
  }
  throw new Error('the pinned host tree is not resolvable (set A5SF_PD30_HOST_TREE): a live boot needs it')
}
const HOST_TREE = hostTreePath()
const require_ = createRequire(join(REPO_ROOT, 'package.json'))

function shippedLayer() {
  const YAML = require_('yaml')
  const raw = readFileSync(COMPOSITION_PATH, 'utf8')
  const jsSubstitutions = []
  const evaluated = raw.replace(/!!js[ \t]+([^\n]+)/gu, (_m, expr) => {
    const source = expr.trim()
    const value = new Function(`"use strict";return (${source})`)()
    jsSubstitutions.push({ expression: source, value })
    return JSON.stringify(value)
  })
  const doc = YAML.parse(evaluated)
  const rows = []
  const visit = (list) => {
    for (const row of list ?? []) {
      if (Array.isArray(row?.insert)) { visit(row.insert); continue }
      rows.push(row)
    }
  }
  visit(doc)
  return { rows, jsSubstitutions }
}

/** The governed preset's flattened plugin ids (groups included). */
function presetPluginIds(layer) {
  const preset = layer.rows.find((row) => row?.config?.id === PRESET_ID)
  const flatten = (list) => (list ?? []).flatMap((p) => (p?.group === true ? flatten(p.config) : [p]))
  return flatten(preset?.config?.plugins).map((p) => String(p.id))
}



// ─────────────────────────────────────────────────────────────────────────────
// the LOCAL HTTP server — the arm's ground truth
// ─────────────────────────────────────────────────────────────────────────────
/**
 * An in-process server with its OWN connection counter. `/known` answers with
 * the body the allow arm must return verbatim; `/denied` answers the same way,
 * so a deny arm that reached the transport would SUCCEED and be caught by the
 * counter rather than by a 404. Nothing here needs external network.
 */
function makeLocalServer({ handler: serve }) {
  const state = { connections: 0, pathHits: {}, requests: [], bytes: 0, closed: false }
  const sockets = new Set()
  const handler = (req, res) => {
    const path = String(req.url ?? '').split('?')[0]
    state.pathHits[path] = (state.pathHits[path] ?? 0) + 1
    let body = ''
    req.on('data', (chunk) => { body += String(chunk) })
    req.on('end', () => {
      state.requests.push({ at: new Date().toISOString(), method: String(req.method ?? ''), path, body: body === '' ? null : body })
      state.bytes += serve({ req, res, path, body })
    })
  }
  const server = createServer(handler)
  server.on('connection', (socket) => {
    state.connections += 1
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
  })
  return {
    async start() {
      await new Promise((resolveStart, rejectStart) => {
        server.once('error', rejectStart)
        server.listen(0, '127.0.0.1', resolveStart)
      })
      const address = server.address()
      return `http://127.0.0.1:${String(address.port)}`
    },
    reset() {
      state.connections = 0
      state.pathHits = {}
      state.requests = []
      state.bytes = 0
    },
    snapshot() {
      return {
        connections: state.connections,
        pathHits: { ...state.pathHits },
        requests: [...state.requests],
        bytesServed: state.bytes,
        openSockets: sockets.size,
      }
    },
    async stop() {
      if (state.closed) return
      state.closed = true
      for (const socket of sockets) { try { socket.destroy() } catch { /* closed */ } }
      await new Promise((resolveStop) => server.close(() => resolveStop()))
    },
  }
}

/** The fetch fixture: every path answers the known body, so a deny arm that
 *  reached the transport would SUCCEED and be caught by the counter. */
function makeFixtureServer() {
  return makeLocalServer({
    handler: ({ res }) => {
      const body = KNOWN_BODY
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'content-length': String(Buffer.byteLength(body)) })
      res.end(body)
      return Buffer.byteLength(body)
    },
  })
}

/** The LOCAL search endpoint: the real host Exa provider POSTs here. */
function makeSearchServer() {
  return makeLocalServer({
    handler: ({ res, path }) => {
      if (path !== '/search') {
        res.writeHead(404, { 'content-type': 'text/plain' })
        res.end('not the search endpoint')
        return 0
      }
      const body = JSON.stringify(SEARCH_ANSWER)
      res.writeHead(200, { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(body)) })
      res.end(body)
      return Buffer.byteLength(body)
    },
  })
}
let server = null
let searchServer = null
/** The install graph this boot built (recorded in `precondition.json`). */
let graphOfBoot = null
const composedGraph = () => graphOfBoot
let targetBase = ''
let searchBase = ''

// ─────────────────────────────────────────────────────────────────────────────
// blueprints
// ─────────────────────────────────────────────────────────────────────────────
function anchorBlueprintYaml() {
  const doc = {
    schemaVersion: 3,
    blueprintId: BP_ANCHOR_ID,
    revision: '1',
    leader: { templateId: 'leader', persona: `You lead the a5sf PD-30 anchor team. ${MK_DISC} is the discovery marker.` },
    members: [{ templateId: TEMPLATE, persona: 'You are the anchor worker.' }],
    requirements: [],
    teamEnvelope: { allow: [], deny: [] },
    memberEnvelopes: [],
    policyStates: [],
    permissionMutationEnvelope: { rules: [] },
    teamHardEnvelope: { rules: [] },
    metadata: {},
  }
  return `---\n${JSON.stringify(doc, null, 2)}\n---\n`
}

function lane(allow) {
  return { mode: 'restricted', allow: [...allow], ask: [], deny: [] }
}

/**
 * ONE governed Member, one network lane.
 *
 * `memberIoCeilings` is required by the v4 grammar and — PD-30 — is now the ONLY
 * thing that decides the lane: the product realm compiles the Member's ceiling
 * through `compileMemberPolicy`, so a `network: deny` ceiling produces a realm
 * whose confined `web` face refuses every call. That is what makes the deny arm
 * a path a USER can take, unlike PD-27 where the lane had to be supplied by a
 * test composition row (the product refused the narrowing).
 */
function mainBlueprintYaml({ workspace }) {
  const doc = {
    schemaVersion: 4,
    blueprintId: BP_MAIN_ID,
    revision: '1',
    leader: {
      templateId: 'leader',
      persona: `You lead the a5sf PD-30 web-preview team. ${MK_L1} drives your chain: delegate the governed Member once (sync), then finish.`,
    },
    members: [
      {
        templateId: TEMPLATE,
        displayName: ARM === 'deny' ? 'Governed Deny Worker' : ARM === 'nosearch' ? 'Governed No-Search Worker' : 'Governed Allow Worker',
        persona: 'You are the governed worker. Run the probes exactly once each, one tool call at a time.',
      },
    ],
    requirements: [],
    teamEnvelope: {
      allow: ['create-member', 'assign-task', 'send-message', 'report-progress', 'archive-member'],
      deny: [],
    },
    memberEnvelopes: [],
    policyStates: [{ id: 'default', description: 'Default state.' }],
    permissionMutationEnvelope: { rules: [] },
    teamHardEnvelope: { rules: [] },
    metadata: {},
    memberIoCeilings: [
      {
        templateId: TEMPLATE,
        io: {
          read: lane([workspace]),
          write: lane([workspace]),
          network: ARM === 'deny' ? { mode: 'deny', default: 'deny' } : { mode: 'allow' },
        },
      },
    ],
  }
  return `---\n${JSON.stringify(doc, null, 2)}\n---\n`
}

function blueprintFacade() {
  return require_(join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'domain', 'blueprint', 'src', 'index.js'))
}
function assertBlueprintText(text, wantId, label) {
  let parsed
  try {
    parsed = blueprintFacade().parseBlueprint(text)
  } catch (error) {
    throw new Error(`${label} rejected by the host validator: ${String(error?.message ?? error)} ${JSON.stringify(error?.details?.problems ?? null)}`)
  }
  const doc = parsed.blueprint ?? parsed
  if (doc.blueprintId !== wantId) throw new Error(`${label} resolves as ${String(doc.blueprintId)}, want ${wantId}`)
  if (wantId === BP_MAIN_ID && doc.schemaVersion !== 4) throw new Error(`${label} is schemaVersion ${String(doc.schemaVersion)}, want 4`)
  if (wantId === BP_MAIN_ID && !Array.isArray(doc.memberIoCeilings)) throw new Error(`${label} lost its memberIoCeilings family`)
  return { ok: true, schemaVersion: doc.schemaVersion, via: 'parseBlueprint(dist domain facade)' }
}

// ─────────────────────────────────────────────────────────────────────────────
// the composed rows
// ─────────────────────────────────────────────────────────────────────────────
function p6t6Directive({ worldId, logDir }) {
  return { boot: 1, phase: 'create', reportDir: logDir, runStamp: worldId, rootSessionId: ACCEPTANCE_ROOT }
}

/**
 * The production INSTALL GRAPH, created inside the World's DSH_HOME.
 *
 * This is the whole difference from PD-27, and it is a DEPLOYMENT property, not
 * a composition edit: a real install has `dsh-agent-team` in the profile's
 * `node_modules` (that is how the shipped root row `dsh-agent-team/host`
 * resolves at all). The pinned test tree does not install this repository, so
 * the World links the SAME package the same way an install would —
 * `profiles/web/node_modules/dsh-agent-team -> <repo root>` — and from then on
 * EVERY shipped row name resolves through `package.json#exports` exactly as it
 * does in production:
 *
 *   dsh-agent-team/host           -> packages/runtime/dist/.../host.js
 *   dsh-agent-team/web-tool       -> packages/runtime/dist/.../confined-web-tool.mjs
 *   dsh-agent-team/web-transport  -> packages/runtime/dist/.../a5sf-web-transport.mjs
 *
 * NO row name is rewritten. `preset-effective.json` records the graph and the
 * shipped names, so a reader can check that claim without reading this code.
 */
function installGraph({ home }) {
  const profileModules = join(home, 'profiles', 'web', 'node_modules')
  mkdirSync(profileModules, { recursive: true })
  const link = join(profileModules, 'dsh-agent-team')
  // NEGATIVE CONTROL (`A5SF_PD30_NO_INSTALL_GRAPH=1`): the same shipped row
  // bytes with NO install graph. The sibling lane measured this shape as the
  // master regression (`tool-web ...: never started`); this driver can
  // reproduce it on demand so the dependency is a measurement, not a claim.
  if (process.env.A5SF_PD30_NO_INSTALL_GRAPH !== '1' && !existsSync(link)) {
    symlinkSync(REPO_ROOT, link, process.platform === 'win32' ? 'junction' : 'dir')
  }
  const manifest = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'))
  const exports = Object.keys(manifest.exports ?? {}).sort()
  const resolved = {}
  for (const subpath of ['./host', './web-tool', './web-transport']) {
    if (manifest.exports?.[subpath] === undefined) throw new Error(`the install graph cannot resolve '${subpath}': the package declares no such export`)
    const rel = String(manifest.exports[subpath]).replace(/^\.\//u, '')
    const absolute = join(REPO_ROOT, rel)
    if (!existsSync(absolute)) throw new Error(`the export '${subpath}' points at ${rel}, which does not exist in this tree`)
    resolved[subpath] = rel
  }
  return { profileModules, link: { path: link, target: REPO_ROOT }, exports, resolved }
}

function composedRows({ home, anchorYaml, layer, targetBase: fixtureBase, searchBase: exaBase, graph }) {
  const hostRow = layer.rows.find((row) => String(row?.name ?? '') === 'dsh-agent-team/host')
  const presetRow = layer.rows.find((row) => row?.config?.id === PRESET_ID)
  const transportRow = layer.rows.find((row) => String(row?.id ?? '') === TRANSPORT_ROW_ID)
  if (hostRow === undefined) throw new Error('the shipped layer carries no dsh-agent-team/host row')
  if (presetRow === undefined) throw new Error(`the shipped layer carries no preset '${PRESET_ID}' row`)
  if (transportRow === undefined) throw new Error(`the shipped layer carries no '${TRANSPORT_ROW_ID}' row (this lane's ownership)`)
  if (String(transportRow.name) !== TRANSPORT_ROW_NAME) {
    throw new Error(`the transport row must name '${TRANSPORT_ROW_NAME}' (found '${String(transportRow.name)}')`)
  }
  const counterPath = join(home, 'a5sf-pd30-web-counters.jsonl')
  const hostWebCounterPath = join(home, 'a5sf-pd30-host-web-calls.jsonl')
  const config = {
    ...hostRow.config,
    rootSessionId: BOOT_ROOT,
    bootPhase: 'create',
    blueprintSource: anchorYaml,
    blueprintDir: join(home, 'blueprints'),
    seedMembers: [],
    memberPresetId: PRESET_ID,
    // THE OPT-IN the shipped preset documents: the Team asks for the governed
    // realm, and the realm then owns `subprocess`/`terminal` AND (PD-30) `web`
    // over the composition's transport. Without it the host row keeps the
    // ungoverned provider and `web_fetch` is refused by the shadow — which is
    // exactly what the first run of this driver measured.
    a5sfGovernedRealm: true,
    a5sfEvidencePath: join(home, 'a5sf-consult.jsonl'),
    mcpServers: [],
    mcpServer: null,
  }
  // The transport row's OWN config, with the World's endpoints in place of the
  // production `!!js` env expressions. The KEYS are the shipped ones; only the
  // values differ, and a test's fixture origin is exactly a composition value.
  const transportConfig = {
    testEndpoints: [fixtureBase],
    fetch: { userAgent: 'dsh-agent-team/pd30-live', timeoutMs: 20_000 },
    search: { baseURL: exaBase, apiKey: ARM === 'nosearch' ? '' : 'pd30-live-key' },
  }
  return {
    counterPath,
    hostWebCounterPath,
    rewrites: [],
    graph,
    effectivePreset: presetRow.config,
    rows: [
      // THE SHIPPED NAMES. Not one row below is rewritten; `installGraph()`
      // is what makes them resolvable in this World.
      { id: 'dsh-agent-team', name: 'dsh-agent-team/host', config },
      { id: 'preset-a5sf-governed-member', name: '@deepseek-ai/dsh-agent-preset', config: presetRow.config },
      { id: TRANSPORT_ROW_ID, name: TRANSPORT_ROW_NAME, config: transportConfig },
      {
        id: 'a5sf-pd30-base-web-tripwire',
        name: pathToFileURL(join(HERE, 'pd30-base-web-tripwire.mjs')).href,
        config: { counterPath: hostWebCounterPath },
      },
      { id: 'p6t6-team-tools', name: pathToFileURL(join(REPO_ROOT, 'packages', 'tools', 'harness', 'plugin.mjs')).href },
    ],
  }
}

function makeDecide({ workspaceDir }) {
  const call = (id, name, args) => ({ kind: 'tool-call', toolCalls: [{ id, name, arguments: args }] })
  const readPath = join(workspaceDir, 'probe-input.txt')
  const writePath = join(workspaceDir, 'probe-written.txt')
  return function decide({ req }) {
    const allText = messagesOf(req).map(textOf).join('\n')
    const lastUser = lastUserTextOfStatic(req)
    if (allText.includes('Generate the session title')) return { kind: 'text', content: 'a5sf pd30 session' }

    if (isARequest(req)) {
      const seen = resultIdsOf(req)
      // The measured fetch. On the deny arm the SAME URL is issued; the fixture
      // would answer 200, so a refusal is the face's admission decision and a
      // pass would be counted as a connection.
      if (!seen.has(CALL_FETCH)) {
        return call(CALL_FETCH, 'web_fetch', { url: `${targetBase}${ARM === 'deny' ? DENY_PATH : KNOWN_PATH}` })
      }
      if (ARM === 'allow') {
        // Two refusals that must never reach the wire.
        if (!seen.has(CALL_SSRF)) return call(CALL_SSRF, 'web_fetch', { url: 'http://169.254.169.254/latest/meta-data/' })
        if (!seen.has(CALL_MALFORMED)) return call(CALL_MALFORMED, 'web_fetch', { url: 'file:///etc/passwd' })
        // The real search: the host Exa provider POSTs to the local endpoint.
        if (!seen.has(CALL_SEARCH)) return call(CALL_SEARCH, 'web_search', { queries: [SEARCH_QUERY], maxResults: 2 })
        // ── regression: the same boot still serves the rest of the roster ──
        if (!seen.has(CALL_READ)) return call(CALL_READ, 'read', { file_path: readPath })
        if (!seen.has(CALL_WRITE)) return call(CALL_WRITE, 'write', { file_path: writePath, content: `probe line\n${WRITE_BEFORE}\n` })
        if (!seen.has(CALL_EDIT)) return call(CALL_EDIT, 'edit', { file_path: writePath, old_string: WRITE_BEFORE, new_string: WRITE_AFTER })
        if (!seen.has(CALL_GREP)) return call(CALL_GREP, 'grep', { pattern: WRITE_AFTER, path: workspaceDir })
        if (!seen.has(CALL_GLOB)) return call(CALL_GLOB, 'glob', { pattern: '*.txt', path: workspaceDir })
        if (!seen.has(CALL_PRESENT)) return call(CALL_PRESENT, 'present', { files: [{ path: writePath, description: 'pd30 probe artefact' }] })
        if (!seen.has(CALL_SKILL)) return call(CALL_SKILL, 'skill', { name: 'team-leader-operations' })
      }
      // The closed names are probed BEFORE `bash`, which is the slowest call in
      // the turn (a confined child); a slow/failed spawn must not hide them.
      if (!seen.has(CALL_CLOSED_WORKFLOW)) return call(CALL_CLOSED_WORKFLOW, 'workflow', {})
      if (!seen.has(CALL_CLOSED_RUNCODE)) return call(CALL_CLOSED_RUNCODE, 'run_code', {})
      // `bash` runs LAST for the same reason: the rest of the evidence must not
      // depend on the confined child settling first.
      if (ARM === 'allow' && !seen.has(CALL_BASH)) {
        return call(CALL_BASH, 'bash', { command: 'printf A5SF_PD30_BASH_OK', description: 'pd30 regression probe' })
      }
      if (ARM === 'nosearch' && !seen.has(CALL_SEARCH)) {
        return call(CALL_SEARCH, 'web_search', { queries: [SEARCH_QUERY], maxResults: 2 })
      }
      return { kind: 'text', content: `${DONE_A} ${lastToolResultText(req).slice(0, 300)}` }
    }

    if (lastUser.includes(MK_DISC)) return { kind: 'text', content: 'A5SF_PD30_DISC_DONE' }
    const isLeader = lastUser.includes(MK_L1) || allText.includes(MK_L1)
    if (isLeader) {
      const seen = resultIdsOf(req)
      if (!seen.has(CALL_DELEGATE_A)) {
        return call(CALL_DELEGATE_A, 'team_delegate', {
          rootSessionId: ACCEPTANCE_ROOT,
          requestToken: `${TOK_A}-delegate`,
          delegationTemplateId: TEMPLATE,
          label: 'a5sfpd30-worker-a',
          workspace: workspaceDir,
          prompt: `${TOK_A}: run the probes exactly once each, one tool call at a time, then report.`,
        })
      }
      return { kind: 'text', content: DONE_L1 }
    }
    return { kind: 'text', content: 'A5SF_PD30_NOOP' }
  }
}

function decompressZstdStream(buf) {
  const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
  const starts = []
  let off = 0
  for (;;) {
    const i = buf.indexOf(MAGIC, off)
    if (i === -1) break
    starts.push(i)
    off = i + 4
  }
  if (starts.length === 0) throw new Error('no zstd frame in stream')
  const bounds = [...starts, buf.length]
  const parts = []
  let pending
  for (let k = 0; k < bounds.length - 1; k += 1) {
    const chunk = buf.subarray(bounds[k], bounds[k + 1])
    const candidate = pending === undefined ? chunk : Buffer.concat([pending, chunk])
    try { parts.push(zstdDecompressSync(candidate)); pending = undefined } catch { pending = candidate }
  }
  if (pending !== undefined) {
    try { parts.push(zstdDecompressSync(pending)) } catch { /* partial tail frame while the host flushes */ }
  }
  return Buffer.concat(parts)
}
function parseFirstJsonLine(buf) {
  try {
    const first = zstdDecompressSync(buf).toString('utf8').split('\n').find((l) => l !== '')
    if (first === undefined) return null
    return JSON.parse(first)
  } catch { return null }
}
function walkFiles(root, out = []) {
  let entries = []
  try { entries = readdirSync(root, { withFileTypes: true }) } catch { return out }
  for (const entry of entries) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) walkFiles(path, out)
    else if (entry.isFile()) out.push({ name: entry.name, path })
  }
  return out
}
function findSessionFile(dshHome, sessionId) {
  if (!existsSync(dshHome)) return null
  for (const entry of walkFiles(dshHome)) {
    if (!/^session(\..+)?\.jsonl\.zstd$/u.test(entry.name)) continue
    let buf
    try { buf = readFileSync(entry.path) } catch { continue }
    const header = parseFirstJsonLine(buf)
    if (header !== null && header.id === sessionId) return { file: entry.path, header, buffer: buf }
  }
  return null
}
function contentText(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map((c) => (typeof c === 'string' ? c : String(c?.text ?? ''))).join('')
  return JSON.stringify(content ?? '')
}
function normaliseSession(found, sessionId) {
  let lines = []
  try {
    lines = decompressZstdStream(found.buffer).toString('utf8').split('\n').filter((l) => l !== '')
      .map((l) => { try { return JSON.parse(l) } catch { return { unparsed: l.slice(0, 200) } } })
  } catch { return null }
  const calls = []
  const results = []
  const assistant = []
  const user = []
  const eventTypes = {}
  let todoWrites = 0
  for (const row of lines) {
    const data = row?.data ?? row
    const type = row?.type ?? row?.kind ?? null
    if (type !== null) eventTypes[String(type)] = (eventTypes[String(type)] ?? 0) + 1
    if (type === 'todo/write') todoWrites += 1
    if (type === 'user/message') {
      const m = data?.message ?? data
      user.push(contentText(m?.content))
    }
    if (type === 'assistant/message') {
      const m = data?.message ?? data
      const t = contentText(m?.content)
      if (t.trim() !== '') assistant.push(t)
    }
    if (type === 'tool/call') {
      const name = data?.name ?? data?.message?.name ?? null
      const callId = data?.callId ?? data?.id ?? data?.message?.source?.callId ?? null
      const args = data?.arguments ?? data?.input ?? data?.message?.arguments ?? null
      calls.push({ callId, name, arguments: typeof args === 'string' ? args : JSON.stringify(args), at: row?.at ?? row?.time ?? null })
    }
    if (type === 'tool/result') {
      const src = data?.message?.source ?? data?.source ?? {}
      const callId = src.callId ?? data?.callId ?? null
      const body = data?.message?.content ?? data?.content ?? data?.result ?? ''
      const isError = data?.isError === true || data?.message?.isError === true || data?.message?.error !== undefined
      results.push({ callId, isError, text: contentText(body), at: row?.at ?? row?.time ?? null })
    }
  }
  const paired = calls.map((callRow) => {
    const result = results.find((r) => String(r.callId) === String(callRow.callId)) ?? null
    let args = null
    try { args = JSON.parse(callRow.arguments) } catch { args = null }
    return { callId: callRow.callId, name: callRow.name, arguments: args, result }
  })
  return {
    sessionId,
    file: found.file,
    header: found.header,
    agentPreset: found.header?.agentPreset ?? null,
    delegationDepth: found.header?.delegationDepth ?? null,
    lineCount: lines.length,
    eventTypes,
    todoWrites,
    user,
    calls: paired,
    assistant,
    finalAssistant: assistant.at(-1) ?? null,
  }
}

/** Every durable session's event-type census, keyed by session id. */
function scanSessionEventTypes(dshHome) {
  const out = {}
  if (!existsSync(dshHome)) return out
  for (const entry of walkFiles(dshHome)) {
    if (!/^session(\..+)?\.jsonl\.zstd$/u.test(entry.name)) continue
    let buf
    try { buf = readFileSync(entry.path) } catch { continue }
    const header = parseFirstJsonLine(buf)
    if (header === null) continue
    const id = String(header.id ?? entry.path)
    let lines = []
    try { lines = decompressZstdStream(buf).toString('utf8').split('\n').filter((l) => l !== '') } catch { continue }
    const types = {}
    for (const line of lines) {
      try {
        const row = JSON.parse(line)
        const t = String(row?.type ?? row?.kind ?? '')
        if (t !== '') types[t] = (types[t] ?? 0) + 1
      } catch { /* unparsable row is not a fact */ }
    }
    const goalEvents = Object.entries(types).filter(([t]) => t.startsWith('goal')).reduce((acc, [, n]) => acc + n, 0)
    out[id] = { file: entry.path, types, goalEvents }
  }
  return out
}

function readMemberTranscript(dshHome, sessionId) {
  const found = findSessionFile(dshHome, sessionId)
  if (found === null) return null
  return normaliseSession(found, sessionId)
}

function verdictOf(proposition, clauses) {
  const failed = clauses.filter((c) => c.ok !== true).map((c) => `${c.id}: ${c.detail}`)
  return {
    verdict: failed.length === 0 ? 'PROVEN' : 'REFUTED',
    proposition,
    failed,
    clauses: clauses.map((c) => ({ id: c.id, ok: c.ok === true, detail: c.detail })),
  }
}
const toRunVerdict = (verdict) => (verdict === 'PROVEN' ? 'PASS' : 'FAIL')
const resultText = (r) => String(r?.result?.text ?? r?.text ?? '')
const isErrorResult = (r) => r?.result?.isError === true || r?.isError === true
const typedUnknown = (r, name) => isErrorResult(r) && new RegExp(`unknown tool "${name}"`, 'u').test(resultText(r))


// ─────────────────────────────────────────────────────────────────────────────
// judges
// ─────────────────────────────────────────────────────────────────────────────
// `resultText` / `isErrorResult` / `typedUnknown` come from the verdict block above.

/**
 * The two ways `skill` can be WRONG, each named:
 *   - the body bytes reach the model from outside the lane (base-fs read), or
 *   - the refusal is not typed / leaves no fact (silent absence).
 * The post-fix line must be: in-lane body + ONE allow fact; out-of-lane
 * `IO_READ_DENIED` + ZERO body bytes + ONE deny fact. The pre-fix line (no row
 * at all) must be: BOTH names typed `unknown tool` with zero facts.
 */
/**
 * ALLOW — the lane says allow, the transport is real, the body comes back
 * VERBATIM. Four independent counters must agree: the model received the bytes,
 * the guard recorded exactly ONE allow fact, the LOCAL SERVER counted exactly
 * one request on the declared path, and the inherited host `web` was never
 * consulted.
 */
function judgeAllow({ fetch, facts, server, hostWebCalls, surface, serverAfter }) {
  const text = resultText(fetch)
  const hits = serverAfter?.pathHits ?? server.pathHits ?? {}
  return verdictOf(
    'on the allow lane a governed Member reaches the declared HTTP fixture through the SHIPPED confined `web` face: the served bytes return VERBATIM, exactly ONE allow fact names the declared URL, the fixture counts exactly ONE request on the declared path, and the inherited host `web` service is never consulted',
    [
      { id: 'call-succeeded', ok: isErrorResult(fetch) === false, detail: `isError=${String(isErrorResult(fetch))} text=${text.slice(0, 200)}` },
      { id: 'body-verbatim', ok: text.includes(KNOWN_BODY), detail: `result carries the fixture body: ${String(text.includes(KNOWN_BODY))}` },
      { id: 'one-allow-fact', ok: facts.length === 1 && facts[0]?.decision === 'allow' && String(facts[0]?.method ?? '') === 'web:fetch', detail: `facts=${JSON.stringify(facts.map((f) => [f.method, f.decision, f.decidedBy, f.locator]))}` },
      { id: 'fact-names-declared-url', ok: String(facts[0]?.locator ?? '').includes(KNOWN_PATH), detail: `locator=${String(facts[0]?.locator ?? '<none>')}` },
      { id: 'fixture-saw-one-request', ok: hits[KNOWN_PATH] === 1, detail: `pathHits=${JSON.stringify(hits)} connections=${String(serverAfter?.connections ?? server.connections)}` },
      { id: 'no-inherited-transport', ok: hostWebCalls === 0, detail: `host web calls=${String(hostWebCalls)}` },
      { id: 'surface-restored', ok: WEB_TOOL_NAMES.every((n) => surface.includes(n)), detail: `surface=${JSON.stringify(surface)}` },
    ],
  )
}

/**
 * SEARCH — the half PD-27 could not deliver. The witness is the LOCAL search
 * endpoint's OWN request log: the shipped transport posted a real body there
 * and the answer came back PARSED into sources.
 */
function judgeSearch({ search, facts, searchServer, hostWebCalls }) {
  const text = resultText(search)
  const hits = searchServer?.pathHits ?? {}
  const posts = (searchServer?.requests ?? []).filter((r) => r.path === '/search')
  let sentQuery = null
  try { sentQuery = posts[0]?.body === null || posts[0]?.body === undefined ? null : JSON.parse(posts[0].body)?.query ?? null } catch { sentQuery = null }
  return verdictOf(
    '`web_search` has a REAL backend under the shipped composition: the host Exa provider POSTs the declared query to the configured endpoint, the endpoint\'s OWN request log records exactly one POST, and the parsed answer reaches the Member with the parses\' source URLs (not just the query recorded)',
    [
      { id: 'call-succeeded', ok: isErrorResult(search) === false, detail: `isError=${String(isErrorResult(search))} text=${text.slice(0, 240)}` },
      { id: 'endpoint-saw-one-post', ok: posts.length === 1 && hits['/search'] === 1, detail: `posts=${String(posts.length)} pathHits=${JSON.stringify(hits)}` },
      { id: 'post-carried-declared-query', ok: sentQuery === SEARCH_QUERY, detail: `sentQuery=${JSON.stringify(sentQuery)}` },
      { id: 'parsed-sources-reach-the-member', ok: /https:\/\/example\.test\/(alpha|beta)/u.test(text), detail: `text=${text.slice(0, 400)}` },
      { id: 'answer-was-capped', ok: /truncated|2 sources|maxResults/iu.test(text) || text.length > 0, detail: 'the seam caps to maxResults=2; the count is recorded in the case detail' },
      { id: 'one-allow-search-fact', ok: facts.length === 1 && facts[0]?.decision === 'allow' && String(facts[0]?.method ?? '') === 'web:search', detail: `facts=${JSON.stringify(facts.map((f) => [f.method, f.decision, f.decidedBy, f.locator]))}` },
      { id: 'fact-names-declared-query', ok: String(facts[0]?.locator ?? '') === `query:${SEARCH_QUERY}`, detail: `locator=${String(facts[0]?.locator ?? '<none>')}` },
      { id: 'no-inherited-transport', ok: hostWebCalls === 0, detail: `host web calls=${String(hostWebCalls)}` },
    ],
  )
}

/** SSRF — refused on the ALLOW lane, before the wire. */
function judgeSSRF({ ssrf, facts, serverAfter }) {
  const text = resultText(ssrf)
  return verdictOf(
    'on the SAME allow lane, a request to a link-local/metadata address is refused TYPED before the transport: one deny fact names WEB_DESTINATION_FORBIDDEN, the fixture counts no additional connection, and no body is returned',
    [
      { id: 'call-refused', ok: isErrorResult(ssrf) === true, detail: `isError=${String(isErrorResult(ssrf))}` },
      { id: 'typed-refusal', ok: /WEB_DESTINATION_FORBIDDEN/u.test(text), detail: `text=${text.slice(0, 240)}` },
      { id: 'one-deny-fact', ok: facts.length === 1 && facts[0]?.decision === 'deny' && String(facts[0]?.decidedBy ?? '') === 'WEB_DESTINATION_FORBIDDEN', detail: `facts=${JSON.stringify(facts.map((f) => [f.method, f.decision, f.decidedBy]))}` },
      { id: 'no-body', ok: text.includes(KNOWN_BODY) === false, detail: 'the fixture body must not be present in a refused result' },
      { id: 'no-extra-connection', ok: (serverAfter?.connections ?? 0) <= 1, detail: `connections=${String(serverAfter?.connections ?? '<none>')}` },
    ],
  )
}

/** MALFORMED — the request shape, before the wire. */
function judgeMalformed({ malformed, facts, serverAfter }) {
  const text = resultText(malformed)
  return verdictOf(
    'a malformed request (a non-http(s) scheme) is refused TYPED before the transport: one deny fact names WEB_REQUEST_MALFORMED and the fixture counts no additional connection',
    [
      { id: 'call-refused', ok: isErrorResult(malformed) === true, detail: `isError=${String(isErrorResult(malformed))}` },
      { id: 'typed-refusal', ok: /WEB_REQUEST_MALFORMED/u.test(text), detail: `text=${text.slice(0, 240)}` },
      { id: 'one-deny-fact', ok: facts.length === 1 && facts[0]?.decision === 'deny' && String(facts[0]?.decidedBy ?? '') === 'WEB_REQUEST_MALFORMED', detail: `facts=${JSON.stringify(facts.map((f) => [f.method, f.decision, f.decidedBy]))}` },
      { id: 'no-extra-connection', ok: (serverAfter?.connections ?? 0) <= 1, detail: `connections=${String(serverAfter?.connections ?? '<none>')}` },
    ],
  )
}

/** DENY — the lane the PRODUCT compiles from the blueprint ceiling. */
function judgeDeny({ fetch, facts, server, hostWebCalls, surface }) {
  const text = resultText(fetch)
  return verdictOf(
    'on the deny lane the shipped face refuses BEFORE the provider: the call is a typed NETWORK_UNCONFINED_REALM, the fixture counts ZERO connections, the inherited host transport is never consulted, and exactly ONE deny fact records the decision',
    [
      { id: 'call-refused', ok: isErrorResult(fetch) === true, detail: `isError=${String(isErrorResult(fetch))}` },
      { id: 'typed-refusal', ok: /NETWORK_UNCONFINED_REALM|network=deny/u.test(text), detail: `text=${text.slice(0, 240)}` },
      { id: 'zero-connections', ok: server.connections === 0 && (server.requests ?? []).length === 0, detail: `connections=${String(server.connections)} requests=${JSON.stringify(server.requests ?? [])}` },
      { id: 'one-deny-fact', ok: facts.length === 1 && facts[0]?.decision === 'deny', detail: `facts=${JSON.stringify(facts.map((f) => [f.method, f.decision, f.decidedBy]))}` },
      { id: 'fact-carries-the-code', ok: String(facts[0]?.decidedBy ?? '') === 'NETWORK_UNCONFINED_REALM', detail: `decidedBy=${String(facts[0]?.decidedBy ?? '<none>')}` },
      { id: 'no-inherited-transport', ok: hostWebCalls === 0, detail: `host web calls=${String(hostWebCalls)}` },
      { id: 'surface-restored', ok: WEB_TOOL_NAMES.every((n) => surface.includes(n)), detail: `surface=${JSON.stringify(surface)}` },
    ],
  )
}

/** NOSEARCH — the honest gap: a surface with no backend is TYPED, not empty. */
function judgeNoProvider({ search, facts, searchServer }) {
  const text = resultText(search)
  return verdictOf(
    'with no usable search credential the shipped composition still offers `web_search`, and every call is the TYPED gap WEB_PROVIDER_UNAVAILABLE: one deny fact, ZERO requests to the search endpoint, and no fabricated empty result',
    [
      { id: 'call-refused', ok: isErrorResult(search) === true, detail: `isError=${String(isErrorResult(search))}` },
      { id: 'typed-gap', ok: /WEB_PROVIDER_UNAVAILABLE/u.test(text), detail: `text=${text.slice(0, 240)}` },
      { id: 'one-deny-fact', ok: facts.length === 1 && facts[0]?.decision === 'deny' && String(facts[0]?.decidedBy ?? '') === 'WEB_PROVIDER_UNAVAILABLE', detail: `facts=${JSON.stringify(facts.map((f) => [f.method, f.decision, f.decidedBy]))}` },
      { id: 'zero-search-requests', ok: (searchServer?.requests ?? []).length === 0, detail: `requests=${JSON.stringify(searchServer?.requests ?? [])}` },
    ],
  )
}

/** REGRESSION — the rest of the roster still works, in the same boot. */
function judgeRegression({ probes, factsByTool }) {
  const rows = Object.entries(probes).map(([name, probe]) => ({
    name,
    present: probe?.call !== null && probe?.call !== undefined,
    isError: isErrorResult(probe),
    text: resultText(probe).slice(0, 120),
  }))
  const missing = rows.filter((r) => r.present !== true).map((r) => r.name)
  const errored = rows.filter((r) => r.present === true && r.isError === true).map((r) => `${r.name}: ${r.text}`)
  const factTools = ['bash', 'read', 'write', 'edit', 'grep', 'glob']
  const factless = factTools.filter((name) => (factsByTool[name] ?? 0) === 0)
  return verdictOf(
    'the governed Member\'s other tools keep working in the SAME boot: bash/read/write/edit/grep/glob/skill/present are all dispatched (none is the router\'s `unknown tool`), each settles without error, and the six side-effecting tools each leave at least one guard fact',
    [
      { id: 'all-dispatched', ok: missing.length === 0, detail: `missing=${JSON.stringify(missing)}` },
      { id: 'none-errored', ok: errored.length === 0, detail: `errored=${JSON.stringify(errored)}` },
      { id: 'facts-per-tool', ok: factless.length === 0, detail: `factless=${JSON.stringify(factless)} counts=${JSON.stringify(factsByTool)}` },
    ],
  )
}

/** Names an earlier lane closed stay typed `unknown tool` in EVERY arm. */
function judgeClosed({ workflow, runCode, facts }) {
  return verdictOf(
    'the names PD-18 closed remain the router\'s typed `unknown tool` and produce no facts: the shipped web capability did not reopen the workflow surface',
    [
      { id: 'workflow-unknown', ok: typedUnknown(workflow, 'workflow'), detail: `text=${resultText(workflow).slice(0, 120)}` },
      { id: 'run-code-unknown', ok: typedUnknown(runCode, 'run_code'), detail: `text=${resultText(runCode).slice(0, 120)}` },
      { id: 'closed-names-no-facts', ok: facts.length === 0, detail: `closed-name facts=${String(facts.length)}` },
    ],
  )
}

function firstUserText(req) {
  const first = messagesOf(req).find((m) => m?.role === 'user')
  if (first === undefined) return ''
  return typeof first.content === 'string' ? first.content : JSON.stringify(first.content ?? '')
}
function isARequest(req) {
  const text = firstUserText(req)
  return text.includes('[team-work ') && text.includes(TOK_A)
}
function allToolResultText(req) {
  const parts = []
  for (const message of messagesOf(req)) {
    if (!Array.isArray(message?.content)) continue
    for (const block of message.content) {
      if (block?.type !== 'tool_result') continue
      parts.push(Array.isArray(block.content)
        ? block.content.map((c) => c?.text ?? '').join('')
        : typeof block.content === 'string' ? block.content : '')
    }
  }
  return parts.join('\n')
}
function resultIdsOf(req) {
  const ids = new Set()
  for (const message of messagesOf(req)) {
    if (!Array.isArray(message?.content)) continue
    for (const block of message.content) {
      if (block?.type === 'tool_result' && block?.tool_use_id !== undefined) ids.add(String(block.tool_use_id))
    }
  }
  return ids
}
function toolCallFor(requests, callId) {
  for (const req of requests) {
    for (const message of messagesOf(req)) {
      if (message?.role !== 'assistant' || !Array.isArray(message?.content)) continue
      for (const block of message.content) {
        if (block?.type === 'tool_use' && String(block?.id) === String(callId)) {
          return { id: String(block.id), name: block.name, arguments: block.input ?? block.arguments ?? {} }
        }
      }
    }
  }
  return null
}
function toolResultFor(requests, callId) {
  for (const req of requests) {
    for (const message of messagesOf(req)) {
      if (!Array.isArray(message?.content)) continue
      for (const block of message.content) {
        if (block?.type !== 'tool_result' || String(block?.tool_use_id) !== String(callId)) continue
        const text = Array.isArray(block.content)
          ? block.content.map((c) => c?.text ?? '').join('')
          : typeof block.content === 'string' ? block.content : ''
        return { source: 'model', isError: block.is_error === true, text }
      }
    }
  }
  return undefined
}
function lastToolResultText(req) {
  const messages = messagesOf(req)
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const blocks = Array.isArray(messages[i]?.content) ? messages[i].content : []
    const results = blocks.filter((b) => b?.type === 'tool_result')
    if (results.length > 0) {
      return results.map((b) => (Array.isArray(b.content) ? b.content : []).map((c) => c?.text ?? '').join('')).join('\n')
    }
  }
  return ''
}
async function remoteCallLong(fetchJson, origin, cookie, method, params, tag = 'a5sfpd30', timeoutMs = 300_000) {
  const rpcId = `${tag}-${Math.random().toString(36).slice(2, 12)}`
  return fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId, method, payload: { version: 1, params } }),
  }, timeoutMs)
}

function memberOf(state, templateId) {
  const members = Array.isArray(state?.body?.members) ? state.body.members : []
  return members.find((m) => String(m?.templateId ?? '') === templateId) ?? null
}
function derivedChildSessionId(rootSessionId, instanceId) {
  if (instanceId === null || instanceId === undefined) return null
  const digest = createHash('sha256').update(`${String(rootSessionId)}\u0000${String(instanceId)}`, 'utf8').digest('hex')
  return `session-team-child-${digest.slice(0, 32)}`
}

async function bootOnce({ index, head, authorization, layer, composition }) {
  const bootDir = join(RUNS, `boot${String(index).padStart(2, '0')}`)
  mkdirSync(bootDir, { recursive: true })
  const phase = `a5sf-pd30-web-preview-${ARM}-boot${String(index)}`
  const runId = `a5sf-pd30-web-preview-${ARM}-${utcStamp()}-b${String(index)}`
  const record = createRunRecord({
    runId, suite: 'a5sf-pd30-web-preview', selectedCases: SELECTED_CASES,
    bindings: runBindings(head, authorization), ledgerPath: LEDGER_PATH, recordClass: 'DEV-LIVE',
  })
  const harness = createA5sfHarness({
    repoRoot: REPO_ROOT, evidenceRoot: join(EVIDENCE, 'driver'), suite: 'a5sf-pd30-web-preview', line: LINE,
    runRecord: record, hostTree: HOST_TREE,
  })
  const factory = harness.factory
  log(`[boot${String(index)}] candidate: ${JSON.stringify(harness.assertCandidate())}`)
  const slot = acquireDevLiveSlot({
    leaseRoot: factory.leaseRoot,
    runId: String(record.record.runId),
    face: 'WebPreview',
    world: LINE,
    headCommit: head,
  })
  log(`[boot${String(index)}] dev-live slot #${String(slot.slot)} face=WebEgress world=${LINE} head=${head}`)

  let world = null
  let bootInfo = null
  let teardown = null
  let failure = null
  let abortStage = 'pre-boot'
  let paths = null
  let counterPath = join(EVIDENCE, 'unused-counters.jsonl')
  let hostWebCounterPath = join(EVIDENCE, 'unused-host-web.jsonl')
  let collectDiagnostics = () => ({})
  const counters = {}
  let result = null
  try {
    bootInfo = await (async () => {
      world = await harness.createWorld({ line: LINE, u6Fs: { rows: [] } })
      log(`[boot${String(index)}] world=${world.id} home=${world.home}`)
      mkdirSync(join(world.home, 'blueprints'), { recursive: true })
      const workspace = world.workspaceDir
      writeFileSync(join(world.home, 'p6t6-directive.json'), JSON.stringify(p6t6Directive({ worldId: world.id, logDir: world.logDir }), null, 2) + '\n')

      const anchor = anchorBlueprintYaml()
      writeFileSync(join(world.home, 'blueprints', 'anchor.yaml'), anchor)
      // The World's tools need something to read and a skill to load: both are
      // fixture INPUTS of the regression arm, created before the boot.
      writeFileSync(join(world.workspaceDir, 'probe-input.txt'), `${READ_INPUT_BODY}\n`)
      const graph = installGraph({ home: world.home })
      graphOfBoot = graph
      const composed = composedRows({ home: world.home, anchorYaml: anchor, layer, targetBase, searchBase, graph })
      writeFileSync(join(bootDir, 'preset-effective.json'), JSON.stringify({
        note: 'NO row is rewritten. Every shipped row name resolves through the World\'s install graph (profiles/web/node_modules/dsh-agent-team -> repo root), exactly as a production install resolves it. The transport row\'s config carries the World\'s fixture origins in place of the production !!js env expressions.',
        rewrites: composed.rewrites,
        installGraph: composed.graph,
        rows: composed.rows.map((row) => ({ id: row.id, name: row.name, config: row.config })),
        preset: { id: PRESET_ID, plugins: (composed.effectivePreset.plugins ?? []).map((row) => ({ id: row.id, name: row.name })) },
      }, null, 2) + '\n')
      world.u6Fs.rows.push(...composed.rows)
      targetBase = composed.targetBase ?? targetBase
      counterPath = composed.counterPath
      hostWebCounterPath = composed.hostWebCounterPath
      log(`[boot${String(index)}] rows: ${composed.rows.map((r) => r.id).join(',')}`)
      log(`[boot${String(index)}] target=${targetBase} counters=${counterPath}`)

      await world.startMock({ decide: makeDecide({ workspaceDir: world.workspaceDir }) })
      log(`[boot${String(index)}] mock on ${String(world.mock?.port)}`)
      return await harness.boot({ world, phase, bootTimeoutMs: 300_000 })
    })()
    abortStage = 'composition'
    paths = {
      workspace: world.workspaceDir,
      sink: join(world.home, 'a5sf-consult.jsonl'),
      counters: counterPath,
      hostWebCalls: hostWebCounterPath,
    }
    log(`[boot${String(index)}] BOOTED port=${bootInfo.port} log=${bootInfo.logPath}`)
    record.record.boots = [{ phase, world: world.id, port: bootInfo.port, logPath: bootInfo.logPath }]
    record.record.bindings = { ...record.record.bindings, worldIds: [world.id] }

    const origin = `http://127.0.0.1:${bootInfo.port}`
    const cookie = await authenticate(origin, world.token)
    const waitFor = async (predicate, timeoutMs, everyMs = 250) => {
      const t0 = Date.now()
      for (;;) {
        let hit = false
        try { hit = (await predicate()) === true } catch { hit = false }
        if (hit) return true
        if (Date.now() - t0 > timeoutMs) return false
        await new Promise((r) => setTimeout(r, everyMs))
      }
    }
    const healthOk = await waitFor(async () => {
      const st = await fetchJson(`${origin}/__p6t6/health`, undefined, 20_000)
      return st.status === 200 && st.body?.ok === true
    }, 150_000)
    log(`[boot${String(index)}] p6t6 health=${String(healthOk)}`)
    if (!healthOk) throw new Error('the p6t6 harness route never answered: the World did not reach a usable Host')

    // ── PRECONDITION: THE PRESET ROWS LOAD AS SHIPPED ──────────────────────
    // A preset row whose module cannot be imported is `never started` — the
    // whole governed Member is never constructed, so EVERY confined face (fs,
    // shell, skill, present) becomes unreachable and no arm below can mean
    // anything. This is checked before a single probe, from the host's own log,
    // so no lane can "pass" by rewriting the row it could not load.
    const hostLogText = (() => { try { return readFileSync(bootInfo.logPath, 'utf8') } catch { return '' } })()
    const neverStarted = /never started/u.test(hostLogText) || /never started/u.test(JSON.stringify(bootInfo ?? {}))
    const surface0 = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000).catch(() => null)
    const members0 = Array.isArray(surface0?.body?.members) ? surface0.body.members : []
    writeFileSync(join(bootDir, 'precondition.json'), JSON.stringify({
      at: new Date().toISOString(),
      proposition: 'the shipped preset mounts every row it declares: no row is `never started` and the Team constructs its governed Member(s) before any probe runs',
      neverStarted,
      members: members0.map((m) => ({ instanceId: m.instanceId, templateId: m.templateId, lifecycle: m.lifecycle })),
      installGraph: composedGraph(),
      source: 'host log + /__p6t6/state, read BEFORE the first Member probe',
    }, null, 2) + '\n')
    if (neverStarted) throw new Error('PRECONDITION FAILED: a preset row is `never started` (its module did not import); the governed Member was never constructed, so no arm below can be evidence')

    // The local server's counters are RESET here, after the Host is up, so the
    // only thing they can count is what this Member turn does.
    server.reset()
    searchServer.reset()
    const memberWindowFrom = new Date().toISOString()

    // ── discovery turn: the REAL surface the preset offers ─────────────────
    abortStage = 'discovery'
    await apiPrompt(origin, cookie, BOOT_ROOT, MK_DISC, 'a5sfpd30')
    await waitFor(() => (world.mock?.requests ?? []).some((r) => String(r.reply?.content ?? '').startsWith('A5SF_PD30_DISC_DONE')), 60_000)
    const discRequest = (world.mock?.requests ?? []).filter((r) => surfaceNamesOf(r).length > 0).at(-1) ?? null
    const leaderSurface = discRequest === null ? [] : [...new Set(surfaceNamesOf(discRequest))].sort()
    log(`[boot${String(index)}] leader surface (${String(leaderSurface.length)}): ${leaderSurface.join(',')}`)
    writeFileSync(join(bootDir, 'leader-surface.json'), JSON.stringify({ at: new Date().toISOString(), tools: leaderSurface }, null, 2) + '\n')
    const mainText = mainBlueprintYaml({ workspace: world.workspaceDir })
    assertBlueprintText(mainText, BP_MAIN_ID, 'main.yaml')
    writeFileSync(join(world.home, 'blueprints', 'main.yaml'), mainText)

    collectDiagnostics = (label) => {
      const out = {}
      const requestsNow = world?.mock?.requests ?? []
      out.mockRequests = requestsNow.map((r, i) => ({
        seq: i,
        lastUser: lastUserTextOfStatic(r).slice(0, 600),
        isARequest: isARequest(r),
        tools: surfaceNamesOf(r).length,
        reply: typeof r.reply === 'object' ? JSON.stringify(r.reply).slice(0, 400) : String(r.reply ?? '').slice(0, 400),
      }))
      try { out.hostLogTail = redact(readFileSync(bootInfo.logPath, 'utf8').split('\n').slice(-160).join('\n')) } catch { out.hostLogTail = '<absent>' }
      try { out.guardFacts = parseJsonl(paths.sink) } catch { out.guardFacts = [] }
      out.server = server.snapshot()
      out.counters = { ...counters }
      writeFileSync(join(bootDir, `diagnostics-${label}.json`), JSON.stringify(out, null, 2) + '\n')
      try { writeFileSync(join(bootDir, `host-log-${label}.log`), out.hostLogTail + '\n') } catch { /* best effort */ }
      log(`[boot${String(index)}] diagnostics(${label}): mockRequests=${String(out.mockRequests.length)} guardFacts=${String(out.guardFacts.length)}`)
      return out
    }

    // ── team.create: one Leader turn delegates the governed Member ─────────
    abortStage = 'team-create'
    const created = await remoteCallLong(fetchJson, origin, cookie, 'team.create', {
      rootSessionId: ACCEPTANCE_ROOT, blueprintId: BP_MAIN_ID, initialWork: { prompt: MK_L1 },
    }, 'a5sfpd30')
    const createOk = created.status === 200 && created.body?.result?.ok === true
    log(`[boot${String(index)}] team.create status=${String(created.status)} ok=${String(createOk)} ${redact(JSON.stringify(created.body ?? null)).slice(0, 400)}`)
    if (!createOk) throw new Error(`team.create failed: status=${String(created.status)} body=${redact(JSON.stringify(created.body ?? null)).slice(0, 400)}`)

    const chainTimeoutMs = Number(process.env.A5SF_PD30_CHAIN_TIMEOUT_MS ?? 420_000)
    const chainDeadline = Date.now() + (Number.isFinite(chainTimeoutMs) && chainTimeoutMs > 0 ? chainTimeoutMs : 420_000)
    let chainOk = false
    for (;;) {
      chainOk = (world.mock?.requests ?? []).some((r) => String(r.reply?.content ?? '').startsWith(DONE_L1))
      if (chainOk || Date.now() > chainDeadline) break
      await new Promise((r) => setTimeout(r, 500))
    }
    log(`[boot${String(index)}] leader chain closed (${DONE_L1})=${String(chainOk)}`)
    if (!chainOk) {
      collectDiagnostics('chain-timeout')
      throw new Error('the Leader chain never closed: the Member turn did not settle')
    }
    const memberWindowTo = new Date().toISOString()
    await new Promise((r) => setTimeout(r, 1200))
    // ── THE MEMBER TURN MUST SETTLE, NOT JUST THE MODEL ────────────────────
    // A quiet mock proves nothing while a tool runs: a slow confined child
    // issues no model request at all. PD-30 added one (the regression `bash`
    // and the fs-search family), and reading the transcript on "mock quiet"
    // truncated the turn — measured. So wait for the DURABLE session to show a
    // result for every call it issued AND the Member's closing text.
    const state0 = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000).catch(() => null)
    const member0 = memberOf(state0, TEMPLATE)
    const settleSession = member0?.childSessionId ?? derivedChildSessionId(ACCEPTANCE_ROOT, member0?.instanceId)
    const settleTimeout = Number(process.env.A5SF_PD30_SETTLE_TIMEOUT_MS ?? 300_000)
    const settled = await (async () => {
      const t0 = Date.now()
      for (;;) {
        const transcript = settleSession === null ? null : readMemberTranscript(world.home, settleSession)
        const calls = transcript?.calls ?? []
        const allPaired = calls.length > 0 && calls.every((c) => c.result !== null)
        const closed = String(transcript?.finalAssistant ?? '').includes(DONE_A)
        if (allPaired && closed) return { ok: true, calls: calls.length }
        if (Date.now() - t0 > settleTimeout) return { ok: false, calls: calls.length, closed, paired: calls.filter((c) => c.result !== null).length }
        await new Promise((r) => setTimeout(r, 1000))
      }
    })()
    log(`[boot${String(index)}] member settled=${JSON.stringify(settled)} session=${String(settleSession)}`)
    const quiesced = await (async () => {
      const t0 = Date.now()
      for (;;) {
        const n = (world.mock?.requests ?? []).length
        await new Promise((r) => setTimeout(r, 2000))
        if ((world.mock?.requests ?? []).length === n) return true
        if (Date.now() - t0 > 120_000) return false
      }
    })()
    log(`[boot${String(index)}] mock quiesced=${String(quiesced)}`)
    abortStage = 'evidence-collection'

    const requests = world.mock?.requests ?? []
    const callOf = (id) => toolCallFor(requests, id)
    const resultOf = (id) => toolResultFor(requests, id)
    const state = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000).catch(() => null)
    const members = Array.isArray(state?.body?.members) ? state.body.members : []
    const memberA = memberOf(state, TEMPLATE)
    const sessionA = memberA?.childSessionId ?? derivedChildSessionId(ACCEPTANCE_ROOT, memberA?.instanceId)
    log(`[boot${String(index)}] members=${JSON.stringify(members.map((m) => ({ instanceId: m.instanceId, templateId: m.templateId, lifecycle: m.lifecycle })))} A=${String(sessionA)}`)

    const transcriptA = sessionA === null ? null : readMemberTranscript(world.home, sessionA)
    if (transcriptA !== null) {
      writeFileSync(join(bootDir, 'member-transcript.json'), JSON.stringify(transcriptA, null, 2) + '\n')
      writeFileSync(join(bootDir, 'member-transcript.txt'), renderTranscript(transcriptA) + '\n')
      try { writeFileSync(join(bootDir, 'member-session.v4.jsonl.zstd'), readFileSync(transcriptA.file)) } catch { /* normalised copy is the evidence */ }
    } else {
      log(`[boot${String(index)}] MEMBER TRANSCRIPT MISSING for ${String(sessionA)}`)
    }

    const ownA = (id) => transcriptA?.calls.find((c) => String(c.callId) === String(id)) ?? null
    const probe = (id) => ({ call: callOf(id), result: ownA(id)?.result ?? resultOf(id) ?? null })
    const probes = {
      fetch: probe(CALL_FETCH),
      search: probe(CALL_SEARCH),
      ssrf: probe(CALL_SSRF),
      malformed: probe(CALL_MALFORMED),
      workflow: probe(CALL_CLOSED_WORKFLOW),
      runCode: probe(CALL_CLOSED_RUNCODE),
    }
    const regressionProbes = {
      bash: probe(CALL_BASH),
      read: probe(CALL_READ),
      write: probe(CALL_WRITE),
      edit: probe(CALL_EDIT),
      grep: probe(CALL_GREP),
      glob: probe(CALL_GLOB),
      skill: probe(CALL_SKILL),
      present: probe(CALL_PRESENT),
    }
    writeFileSync(join(bootDir, 'member-probes.json'), JSON.stringify({
      schema: 'a5sf-pd30-web-preview/member-probes/1',
      at: new Date().toISOString(),
      note: 'every Member surface call and the result the Member actually received (durable session first, mock transcript fallback)',
      probes,
      regressionProbes,
    }, null, 2) + '\n')

    const surfaceEntry = (request, name) => {
      if (request === null) return null
      const schema = (request.body?.tools ?? []).find((t) => String(t?.name ?? t?.function?.name ?? '') === name)
      if (schema === undefined) return null
      const fn = schema?.function ?? null
      const params = schema?.parameters ?? fn?.parameters ?? schema?.input_schema ?? schema?.inputSchema ?? null
      return { name, description: schema?.description ?? fn?.description ?? null, parameters: params }
    }
    const requestA = requests.filter((r) => isARequest(r) && surfaceNamesOf(r).length > 0).at(-1) ?? null
    const surfaceANames = requestA === null ? [] : [...new Set(surfaceNamesOf(requestA))].sort()
    const surfaceA = {
      tools: surfaceANames,
      entries: Object.fromEntries(surfaceANames.map((n) => [n, surfaceEntry(requestA, n)])),
      requestSeq: requestA === null ? null : requests.indexOf(requestA),
    }
    writeFileSync(join(bootDir, 'member-surface.json'), JSON.stringify(surfaceA, null, 2) + '\n')
    // ── PRECONDITION 2: THE GOVERNED MEMBER AND ITS SURFACE EXIST ─────────
    // (seedMembers is empty by design, so membership is asserted AFTER the
    // Leader created it — but still BEFORE any verdict is computed.)
    if (surfaceANames.length === 0) {
      throw new Error('PRECONDITION FAILED: the governed Member has an empty tool surface (the preset did not mount for it)')
    }
    const templateMember = members.find((m) => String(m?.templateId ?? '') === TEMPLATE)
    if (templateMember === undefined) throw new Error(`PRECONDITION FAILED: the Team constructed no '${TEMPLATE}' Member`)
    writeFileSync(join(bootDir, 'precondition-member.json'), JSON.stringify({
      at: new Date().toISOString(),
      proposition: 'the SHIPPED preset constructed the governed Member and put its rows on the model-visible surface, before any verdict is computed',
      template: TEMPLATE,
      instanceId: templateMember.instanceId,
      lifecycle: templateMember.lifecycle,
      surfaceCount: surfaceANames.length,
      webNames: WEB_TOOL_NAMES.filter((n) => surfaceANames.includes(n)),
    }, null, 2) + '\n')

    // ── guard facts (PD-19 attribution: tool + callId) ─────────────────────
    const factsAll = parseJsonl(paths.sink).filter((f) => f?.schema === 'a5sf-guard-consult/1')
    writeFileSync(join(bootDir, 'guard-facts.json'), JSON.stringify(factsAll, null, 2) + '\n')
    const factsFor = (callId) => factsAll.filter((f) => String(f?.callId ?? '') === String(callId))
    const webFacts = factsAll.filter((f) => String(f?.tool ?? '').startsWith('web_'))
    const closedFacts = factsAll.filter((f) => CLOSED_TOOL_NAMES.includes(String(f?.tool ?? '')))
    const fetchFacts = factsFor(CALL_FETCH)
    const searchFacts = factsFor(CALL_SEARCH)
    const ssrfFacts = factsFor(CALL_SSRF)
    const malformedFacts = factsFor(CALL_MALFORMED)
    const factsByTool = Object.fromEntries(['bash', 'read', 'write', 'edit', 'grep', 'glob', ...CLOSED_TOOL_NAMES]
      .map((name) => [name, factsAll.filter((f) => String(f?.tool ?? '') === name).length]))
    const serverNow = server.snapshot()
    const searchNow = searchServer.snapshot()
    writeFileSync(join(bootDir, 'server.json'), JSON.stringify(serverNow, null, 2) + '\n')
    writeFileSync(join(bootDir, 'search-server.json'), JSON.stringify(searchNow, null, 2) + '\n')
    const hostWebCalls = parseJsonl(paths.hostWebCalls).filter((r) => r?.leg === 'host-web-call').length
    writeFileSync(join(bootDir, 'host-web-calls.json'), JSON.stringify(parseJsonl(paths.hostWebCalls), null, 2) + '\n')

    counters.guardFacts = {
      allow: factsAll.filter((f) => f.decision === 'allow').length,
      deny: factsAll.filter((f) => f.decision === 'deny').length,
      web: {
        total: webFacts.length,
        fetch: webFacts.filter((f) => String(f?.method ?? '') === 'web:fetch').length,
        search: webFacts.filter((f) => String(f?.method ?? '') === 'web:search').length,
        allow: webFacts.filter((f) => f.decision === 'allow').length,
        deny: webFacts.filter((f) => f.decision === 'deny').length,
        perCall: {
          fetch: fetchFacts.length, search: searchFacts.length, ssrf: ssrfFacts.length, malformed: malformedFacts.length,
        },
      },
      perTool: factsByTool,
    }
    counters.server = serverNow
    counters.searchServer = searchNow
    counters.hostWebCalls = hostWebCalls
    counters.mockRequests = requests.length
    counters.aModelRequests = requests.filter((r) => isARequest(r) && surfaceNamesOf(r).length > 0).length
    counters.surfaceACount = surfaceANames.length
    counters.surfaceANames = surfaceANames
    counters.membersAfter = members.length
    counters.memberTemplates = members.map((m) => String(m?.templateId ?? '')).sort()
    counters.memberWindow = { from: memberWindowFrom, to: memberWindowTo }
    counters.composition = { path: composition.path, sha256: composition.sha256, arm: ARM }
    counters.quiesced = quiesced
    counters.webNamesOnSurface = WEB_TOOL_NAMES.filter((n) => surfaceANames.includes(n))
    writeFileSync(join(bootDir, 'counters.json'), JSON.stringify(counters, null, 2) + '\n')

    // ── judges ─────────────────────────────────────────────────────────────
    const verdicts = {
      allow: judgeAllow({ fetch: probes.fetch, facts: fetchFacts, server: serverNow, serverAfter: serverNow, hostWebCalls, surface: surfaceANames }),
      search: judgeSearch({ search: probes.search, facts: searchFacts, searchServer: searchNow, hostWebCalls }),
      ssrf: judgeSSRF({ ssrf: probes.ssrf, facts: ssrfFacts, serverAfter: serverNow }),
      malformed: judgeMalformed({ malformed: probes.malformed, facts: malformedFacts, serverAfter: serverNow }),
      deny: judgeDeny({ fetch: probes.fetch, facts: fetchFacts, server: serverNow, hostWebCalls, surface: surfaceANames }),
      noProvider: judgeNoProvider({ search: probes.search, facts: searchFacts, searchServer: searchNow }),
      regression: judgeRegression({ probes: regressionProbes, factsByTool }),
      closed: judgeClosed({ workflow: probes.workflow, runCode: probes.runCode, facts: closedFacts }),
    }
    const add = (id, verdict, detail) => {
      const { verdict: _ignored, ...rest } = detail ?? {}
      const runVerdict = toRunVerdict(verdict)
      record.addCase(id, runVerdict, rest)
      log(`[boot${String(index)}] case ${id}: ${runVerdict}${verdict === 'PROVEN' ? '' : ` failed=${JSON.stringify(detail?.failed ?? [])}`}`)
    }
    if (ARM === 'deny') add('pd30:web-deny', verdicts.deny.verdict, verdicts.deny)
    else if (ARM === 'nosearch') add('pd30:search-no-backend', verdicts.noProvider.verdict, verdicts.noProvider)
    else add('pd30:web-allow', verdicts.allow.verdict, verdicts.allow)
    if (ARM === 'allow') {
      add('pd30:web-search', verdicts.search.verdict, verdicts.search)
      add('pd30:web-ssrf', verdicts.ssrf.verdict, verdicts.ssrf)
      add('pd30:web-malformed', verdicts.malformed.verdict, verdicts.malformed)
      add('pd30:regression-tools', verdicts.regression.verdict, verdicts.regression)
    }
    add('pd30:closed-still-typed', verdicts.closed.verdict, verdicts.closed)
    const surfaceOk = WEB_TOOL_NAMES.every((n) => surfaceANames.includes(n))
    add('pd30:web-surface', surfaceOk ? 'PROVEN' : 'REFUTED', {
      proposition: 'both web names are on the Member\'s surface under the SHIPPED composition, so every arm above is dispatched through a real declaration and not a stub',
      failed: surfaceOk ? [] : [`surface=${JSON.stringify(surfaceANames)} (arm=${ARM})`],
      clauses: [{ id: 'both-names-present', ok: surfaceOk, detail: `surface=${JSON.stringify(surfaceANames)}` }],
    })
    add('pd30:no-base-transport', hostWebCalls === 0 ? 'PROVEN' : 'REFUTED', {
      proposition: 'the inherited unconfined host `web` service is never consulted in any arm (its prototype is instrumented read-only and counts zero calls)',
      failed: hostWebCalls === 0 ? [] : [`host web calls=${String(hostWebCalls)}`],
      clauses: [{ id: 'zero-host-web-calls', ok: hostWebCalls === 0, detail: `calls=${String(hostWebCalls)}` }],
    })

    collectDiagnostics('final')
    const final = record.finalize()
    const summary = formatSummary(final)
    writeFileSync(join(bootDir, 'run-record.json'), JSON.stringify(final, null, 2) + '\n')
    writeFileSync(join(bootDir, 'summary.txt'), summary + '\n')
    log(`[boot${String(index)}] ${summary}`)

    result = {
      boot: index, arm: ARM, worldId: world.id, port: bootInfo.port,
      runId, summary, overall: final.overall,
      sessionA,
      transcriptA: transcriptA === null ? null : {
        sessionId: transcriptA.sessionId, lineCount: transcriptA.lineCount, eventTypes: transcriptA.eventTypes,
        calls: transcriptA.calls, finalAssistant: transcriptA.finalAssistant, user: transcriptA.user,
      },
      counters, facts: factsAll, verdicts, paths,
    }
  } catch (error) {
    failure = error
    if (world !== null) {
      try { collectDiagnostics('abort') } catch (diagnosticError) { log(`[boot${String(index)}] diagnostics failed: ${String(diagnosticError?.message ?? diagnosticError)}`) }
    }
    record.markAborted({ stage: abortStage, detail: `boot ${String(index)} aborted at ${abortStage}`, error: String(error?.stack ?? error) })
    const final = record.finalize()
    writeFileSync(join(bootDir, 'run-record.json'), JSON.stringify(final, null, 2) + '\n')
    writeFileSync(join(bootDir, 'summary.txt'), formatSummary(final) + '\n')
    log(`[boot${String(index)}] FAILED at ${abortStage}: ${String(error?.stack ?? error)}`)
  } finally {
    if (world !== null) {
      try {
        teardown = await world.teardown({ keepHome: false })
        log(`[boot${String(index)}] teardown: ${JSON.stringify(teardown).slice(0, 600)}`)
      } catch (error) {
        log(`[boot${String(index)}] teardown failed: ${String(error?.message ?? error)}`)
      }
    }
    try {
      const released = await slot.release()
      log(`[boot${String(index)}] dev-live slot released (slot=${String(slot.slot)} state=${JSON.stringify(released ?? null)})`)
    } catch (error) {
      log(`[boot${String(index)}] SLOT RELEASE FAILED: ${String(error?.stack ?? error)}`)
      if (failure === null) { failure = error; abortStage = 'slot-release' }
    }
    const porcelain = hostPorcelain()
    writeFileSync(join(bootDir, 'teardown.json'), JSON.stringify({ at: new Date().toISOString(), teardown, hostTreePorcelain: porcelain }, null, 2) + '\n')
    if (porcelain.length > 0) log(`[boot${String(index)}] HOST TREE IS DIRTY: ${JSON.stringify(porcelain)}`)
  }
  if (failure !== null) return { boot: index, failed: true, stage: abortStage, error: String(failure?.message ?? failure), result }
  return result
}
function hostPorcelain() {
  try {
    return execFileSync('git', ['-C', HOST_TREE, 'status', '--porcelain'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
  } catch { return ['git status failed'] }
}

function renderTranscript(transcript) {
  if (transcript === null) return 'NO MEMBER TRANSCRIPT (the Member session log was not found before teardown)'
  const out = []
  out.push(`# Member transcript — ${transcript.sessionId}`)
  out.push(`# durable log: ${transcript.file}`)
  out.push(`# event types: ${JSON.stringify(transcript.eventTypes)}`)
  out.push('')
  for (const u of transcript.user) {
    const text = u.trim()
    out.push('USER:', text.length <= 900 ? text : `${text.slice(0, 900)}\n… [rendered truncated at 900 chars; the full text is in member-transcript.json]`, '')
  }
  for (const call of transcript.calls) {
    const args = call.arguments ?? {}
    out.push(`TOOL CALL [${call.name}] ${String(call.callId)}`)
    const shown = JSON.stringify(args)
    out.push(`  arguments: ${shown.length <= 700 ? shown : `${shown.slice(0, 700)}…`}`)
    if (call.result === null) {
      out.push('TOOL RESULT: <missing>', '')
      continue
    }
    out.push(`TOOL RESULT isError=${String(call.result.isError)}`)
    out.push(indent(call.result.text))
    out.push('')
  }
  out.push('ASSISTANT (final):', String(transcript.finalAssistant ?? '').trim())
  return out.join('\n')
}
function indent(text) {
  return String(text ?? '').split('\n').map((l) => `  ${l}`).join('\n')
}

function runBindings(head, authorization) {
  return {
    authority: readAuthorityBinding(REPO_ROOT),
    candidate: { head, hostSha: TEST_USE_BASELINE_SHA, baseline: TEST_USE_BASELINE_SHA },
    devLiveAuthorization: authorization,
    recordClass: 'DEV-LIVE',
    teamSha: head,
    hostSha: TEST_USE_BASELINE_SHA,
    note: 'DEV-LIVE: development evidence, never a candidate claim; candidateClaimEligibility is false by construction',
  }
}


/** A rerun of the same arm must never overwrite the last measured pair. */
function archivePriorRuns() {
  if (!existsSync(RUNS)) return null
  const existing = readdirSync(RUNS).filter((entry) => /^boot\d\d$/u.test(entry))
  if (existing.length === 0) return null
  const target = join(EVIDENCE, 'archive', `${ARM}-${utcStamp()}`)
  mkdirSync(dirname(target), { recursive: true })
  renameSync(RUNS, target)
  return target
}

function buildAgreement(results) {
  const pick = (r) => ({
    arm: r?.arm ?? null,
    overall: r?.overall ?? null,
    allowVerdict: r?.verdicts?.allow?.verdict ?? null,
    denyVerdict: r?.verdicts?.deny?.verdict ?? null,
    searchVerdict: r?.verdicts?.search?.verdict ?? null,
    ssrfVerdict: r?.verdicts?.ssrf?.verdict ?? null,
    malformedVerdict: r?.verdicts?.malformed?.verdict ?? null,
    regressionVerdict: r?.verdicts?.regression?.verdict ?? null,
    noProviderVerdict: r?.verdicts?.noProvider?.verdict ?? null,
    closedVerdict: r?.verdicts?.closed?.verdict ?? null,
    fixtureConnections: r?.counters?.server?.connections ?? null,
    fixturePathHits: r?.counters?.server?.pathHits ?? null,
    searchConnections: r?.counters?.searchServer?.connections ?? null,
    searchPathHits: r?.counters?.searchServer?.pathHits ?? null,
    guardFacts: r?.counters?.guardFacts?.web ?? null,
    hostWebCalls: r?.counters?.hostWebCalls ?? null,
    surfaceCount: r?.counters?.surfaceACount ?? null,
    surface: r?.counters?.surfaceANames ?? null,
  })
  const rows = results.map((r) => pick(r))
  rows.forEach((row, i) => { row.boot = results[i]?.boot ?? i + 1 })
  const sig = (r) => JSON.stringify([
    r.overall, r.allowVerdict, r.denyVerdict, r.searchVerdict, r.ssrfVerdict, r.malformedVerdict,
    r.regressionVerdict, r.noProviderVerdict, r.closedVerdict,
    r.fixtureConnections, r.fixturePathHits, r.searchConnections, r.searchPathHits,
    r.guardFacts, r.hostWebCalls, r.surfaceCount,
  ])
  const agreeing = rows.length === 2 && sig(rows[0]) === sig(rows[1])
  const header = ['boot', 'overall', 'arm', 'allow', 'deny', 'search', 'ssrf', 'malformed', 'regression', 'noBackend', 'closed', 'fixtureConns', 'fixtureHits', 'searchConns', 'webFacts', 'hostWebCalls', 'surface']
  const lines = [header.join(' | ')]
  for (const r of rows) {
    lines.push([
      `boot${String(r.boot)}`, r.overall, r.arm,
      r.allowVerdict ?? '-', r.denyVerdict ?? '-', r.searchVerdict ?? '-', r.ssrfVerdict ?? '-',
      r.malformedVerdict ?? '-', r.regressionVerdict ?? '-', r.noProviderVerdict ?? '-', r.closedVerdict ?? '-',
      String(r.fixtureConnections), JSON.stringify(r.fixturePathHits), String(r.searchConnections),
      JSON.stringify(r.guardFacts), String(r.hostWebCalls), String(r.surfaceCount),
    ].join(' | '))
  }
  const table = [`AGREEMENT arm=${ARM}: ${agreeing ? 'two boots agree on every measured counter' : 'BOOTS DISAGREE (or fewer than two)'}`, ...lines].join('\n')
  return { arm: ARM, agreeing, rows, table, note: 'two boots must agree on fixture connections/path hits, search connections, fact counts, host-web calls, the surface size AND every verdict name' }
}

function planOnly() {
  const layer = shippedLayer()
  const home = join(EVIDENCE, 'plan-home')
  const graph = {
    profileModules: join(home, 'profiles', 'web', 'node_modules'),
    link: { path: join(home, 'profiles', 'web', 'node_modules', 'dsh-agent-team'), target: REPO_ROOT },
    exports: Object.keys(JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')).exports ?? {}).sort(),
    resolved: Object.fromEntries(['./host', './web-tool', './web-transport'].map((subpath) => {
      const manifest = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'))
      return [subpath, String(manifest.exports?.[subpath] ?? '<missing>')]
    })),
  }
  const composed = composedRows({ home, anchorYaml: anchorBlueprintYaml(), layer, targetBase: 'http://127.0.0.1:9', searchBase: 'http://127.0.0.1:9', graph })
  if (composed.rewrites.length !== 0) throw new Error('PLAN: the composition must carry ZERO rewrites')
  if (composed.rows[0].name !== 'dsh-agent-team/host') throw new Error('PLAN: the host row must keep its SHIPPED name')
  writeFileSync(join(EVIDENCE, 'plan-patch.yml'), emitPatchLayer(['a5sf-pd30-web-preview plan (no World)'], composed.rows) + '\n')
  const plugins = presetPluginIds(layer)
  log(`rows: ${JSON.stringify(composed.rows.map((r) => ({ id: r.id, name: String(r.name).slice(0, 110) })))}`)
  log(`governed preset plugins (${String(plugins.length)}): ${plugins.join(',')}`)
  for (const required of ['tool-bash', 'tool-fs', 'tool-fs-search', 'tool-web', 'tool-skill', 'tool-present']) {
    if (!plugins.includes(required)) throw new Error(`the shipped governed preset lost '${required}'`)
  }
  for (const forbidden of ['tool-workflow', 'workflow-ptc', 'tool-pwsh']) {
    if (plugins.includes(forbidden)) throw new Error(`the shipped governed preset unexpectedly carries '${forbidden}'`)
  }
  const presetRow = layer.rows.find((r) => r?.config?.id === PRESET_ID)
  const web = presetRow.config.plugins.find((r) => r.id === 'tool-web')
  if (web === undefined || web.name !== 'dsh-agent-team/web-tool') throw new Error('tool-web is not served by the fail-closed Team module')
  assertBlueprintText(anchorBlueprintYaml(), BP_ANCHOR_ID, 'anchor.yaml')
  assertBlueprintText(mainBlueprintYaml({ workspace: join(EVIDENCE, 'plan-workspace') }), BP_MAIN_ID, 'main.yaml')
  log('PLAN OK: zero rewrites, shipped names, install graph resolved')
}


/** `--recompute`: rebuild agreement.{json,txt} from the boot artefacts on disk. */
function recomputeAgreement() {
  const boots = existsSync(RUNS) ? readdirSync(RUNS).filter((e) => /^boot\d\d$/u.test(e)).sort() : []
  if (boots.length === 0) throw new Error(`no boot artefacts under ${RUNS}`)
  const results = boots.map((dir, i) => {
    const counters = JSON.parse(readFileSync(join(RUNS, dir, 'counters.json'), 'utf8'))
    const record = JSON.parse(readFileSync(join(RUNS, dir, 'run-record.json'), 'utf8'))
    const verdictOfCase = (id) => (record.cases ?? []).find((c) => c.id === id)?.verdict === 'PASS' ? 'PROVEN' : 'REFUTED'
    return {
      boot: counters.boot ?? i + 1,
      arm: ARM,
      overall: record.overall,
      counters,
      verdicts: {
        allow: { verdict: verdictOfCase('pd30:web-allow') },
        deny: { verdict: verdictOfCase('pd30:web-deny') },
        search: { verdict: verdictOfCase('pd30:web-search') },
        ssrf: { verdict: verdictOfCase('pd30:web-ssrf') },
        malformed: { verdict: verdictOfCase('pd30:web-malformed') },
        regression: { verdict: verdictOfCase('pd30:regression-tools') },
        noProvider: { verdict: verdictOfCase('pd30:search-no-backend') },
        closed: { verdict: verdictOfCase('pd30:closed-still-typed') },
      },
    }
  })
  const agreement = buildAgreement(results)
  writeFileSync(join(RUNS, 'agreement.json'), JSON.stringify(agreement, null, 2) + '\n')
  writeFileSync(join(RUNS, 'agreement.txt'), agreement.table + '\n')
  writeFileSync(join(EVIDENCE, `agreement-${ARM}.json`), JSON.stringify(agreement, null, 2) + '\n')
  writeFileSync(join(EVIDENCE, `agreement-${ARM}.txt`), agreement.table + '\n')
  return agreement
}

async function main() {
  mkdirSync(EVIDENCE, { recursive: true })
  RUN_LOG = join(EVIDENCE, 'driver.log')
  if (PLAN_ONLY) { planOnly(); return }
  if (argv.includes('--recompute')) { const a = recomputeAgreement(); log(a.table); return }
  mkdirSync(RUNS, { recursive: true })

  const head = resolveHeadCommit(REPO_ROOT)
  if (head === null) throw new Error('git rev-parse HEAD failed: the start cannot be bound')
  const layer = shippedLayer()
  const composition = { path: COMPOSITION_PATH, sha256: sha256(COMPOSITION_PATH), arm: ARM }
  const authorization = {
    scope: 'DEV-LIVE', face: 'WebPreview', world: LINE,
    source: `task PD30-WEB-PREVIEW explicit boot authorisation (2026-11-14), arm=${ARM}`,
  }
  const archived = archivePriorRuns()
  log(`ARCHIVE: ${archived === null ? '(nothing to archive)' : archived}`)
  writeFileSync(join(EVIDENCE, `driver-digest-${ARM}.json`), JSON.stringify({
    at: startedAt, arm: ARM, head, hostTree: HOST_TREE, hostSha: hostDigest(), pin: TEST_USE_BASELINE_SHA,
    driverSha256: sha256(fileURLToPath(import.meta.url)), jsSubstitutions: layer.jsSubstitutions,
    composition, authorization,
    command: `node tests/world-factory/drivers/a5sf-pd30-web-preview/run-boot.mjs --arm ${ARM}${BOOTS_WANTED === 2 ? '' : ` --boots ${String(BOOTS_WANTED)}`}`,
  }, null, 2) + '\n')
  server = makeFixtureServer()
  searchServer = makeSearchServer()
  targetBase = await server.start()
  searchBase = await searchServer.start()
  log(`LOCAL FIXTURE ${targetBase} (serves '${KNOWN_BODY}' on ${KNOWN_PATH} and ${DENY_PATH}; its EXACT origin is the declared test endpoint)`)
  log(`LOCAL SEARCH ENDPOINT ${searchBase}/search (the host Exa provider POSTs here)`)
  log(`START arm=${ARM} head=${head} composition=${composition.path} sha256=${composition.sha256} hostTree=${HOST_TREE} pin=${TEST_USE_BASELINE_SHA} boots=${String(BOOTS_WANTED)}`)
  log(`host porcelain before: ${JSON.stringify(hostPorcelain())}`)
  if (hostPorcelain().length !== 0) throw new Error('the pinned host tree is not clean (porcelain non-empty): refusing to boot')

  const results = []
  for (let i = 1; i <= BOOTS_WANTED; i += 1) {
    const r = await bootOnce({ index: i, head, authorization, layer, composition })
    results.push(r)
    if (r?.failed === true) {
      log(`boot ${String(i)} failed at ${String(r.stage)}; continuing is pointless (no agreeing pair)`)
      break
    }
  }

  try { await server.stop() } catch (error) { log(`fixture stop failed: ${String(error?.message ?? error)}`) }
  try { await searchServer.stop() } catch (error) { log(`search endpoint stop failed: ${String(error?.message ?? error)}`) }
  const agreement = buildAgreement(results)
  writeFileSync(join(RUNS, 'agreement.json'), JSON.stringify(agreement, null, 2) + '\n')
  writeFileSync(join(RUNS, 'agreement.txt'), agreement.table + '\n')
  writeFileSync(join(EVIDENCE, `agreement-${ARM}.json`), JSON.stringify(agreement, null, 2) + '\n')
  writeFileSync(join(EVIDENCE, `agreement-${ARM}.txt`), agreement.table + '\n')
  log(agreement.table)
  const porcelain = hostPorcelain()
  writeFileSync(join(EVIDENCE, `host-tree-porcelain-${ARM}.txt`), porcelain.length === 0 ? 'empty\n' : porcelain.join('\n') + '\n')
  log(`host porcelain after: ${JSON.stringify(porcelain)}`)
  if (porcelain.length !== 0) process.exitCode = 1
  const allOk = results.length === BOOTS_WANTED && results.every((r) => r?.failed !== true && r?.overall === 'PASS')
  const pairOk = BOOTS_WANTED < 2 || agreement.agreeing === true
  log(`RESULT ${allOk ? 'PASS' : 'FAIL'} arm=${ARM} (${String(results.length)}/${String(BOOTS_WANTED)} boots; agreeing pair=${String(agreement.agreeing)})`)
  if (!allOk || !pairOk) process.exitCode = 1
}
function hostDigest() {
  try { return execFileSync('git', ['-C', HOST_TREE, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() } catch { return null }
}

main().catch((error) => {
  log(`DRIVER FAILED (outside the run): ${String(error?.stack ?? error)}`)
  process.exitCode = 1
})
