/**
 * plugin.mjs — the P7-T7 real-instance harness row (p7t7-legacy-session-reader).
 *
 * Mounted into a REAL DSH web instance through the public cordis.patch.yml
 * profile seam, this row:
 *
 * 1. registers the ts-loader resolve hook (before its first dynamic TS
 *    import) and imports the WORKTREE's session-reader TypeScript sources
 *    directly (native type-stripping; no bundling, no prebuild);
 * 2. builds the real-FS read-only home port over the host process's
 *    DSH_HOME (fs-seam.mjs);
 * 3. starts the mini MCP endpoint (mini-mcp.mjs, 127.0.0.1, ports
 *    3491-3495 first free) exposing the ONE public reader tool
 *    `p7t7_legacy_read`;
 * 4. registers two host web routes (public webServer seam, effect-cleanup
 *    on row stop): GET `/__p7t7/health` (readiness) and POST
 *    `/__p7t7/run` (drive one scenario L1/L2/L3 over the mini-MCP tool,
 *    with assertion-based reports).
 *
 * The scenarios exercise the reader end to end against the real home
 * tree the harness plants under DSH_HOME:
 *
 * - L1 — a valid legacy-team view (roster overlay, leader from team
 *   events, member child sessions, per-session evidence counts);
 * - L2 — mutation rejection: `resume` / `restore` / `mutate` actions
 *   return the typed LEGACY_READER_MUTATION_REJECTED error and the home
 *   snapshot is byte-identical afterwards (read-only proof);
 * - L3 — native fallback: with no roster and no team events the view
 *   degrades to the native Chat/Trajectory view (required behavior).
 *
 * Cordis row identity (function-plugin protocol: named exports, no
 * default). The row is READ-ONLY by construction: it never writes to the
 * inspected home (only to its own reportDir), and its only reader entry
 * is the dispatch surface whose non-`inspect` actions are rejected.
 *
 * @module @dsh-agent-team/legacy/session-reader/e2e/plugin
 */
import { register } from 'node:module'
import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

// The ts-loader resolve hook MUST be registered before the first dynamic
// TS import (see ts-loader.mjs): it rewrites the worktree's NodeNext
// `.js` specifiers to their `.ts` siblings so this row consumes the
// worktree's session-reader TypeScript sources directly.
register(pathToFileURL(join(HERE, 'ts-loader.mjs')).href, import.meta.url)

/** Cordis row identity (function-plugin protocol: named exports, no default). */
export const name = 'p7t7-legacy-session-reader'
/**
 * Hard service dependency: the web host route seam (the Loader defers this
 * row's apply until it exists). No other service is needed — the reader
 * works purely on the DSH_HOME file tree through the injected port.
 */
export const inject = ['webServer']

const DIRECTIVE_NAME = 'p7t7-directive.json'
const SCENARIOS = ['L1', 'L2', 'L3']
const MCP_PORT_CANDIDATES = [3491, 3492, 3493, 3494, 3495]
const TOOL_NAME = 'p7t7_legacy_read'
/** The fixture subtree roots the harness plants (the snapshot scope). */
const FIXTURE_ROOTS = [
  'teammates',
  'ws',
  'sessions/--C-p7t7-legacy-team--',
  'sessions/--C-p7t7-native--',
]

/** @type {object|undefined} the validated run directive. */
let directive
/** @type {string|null} the row setup failure (reported by /health). */
let setupError = null
/** @type {(value?: unknown) => void} resolves the readiness gate. */
let resolveReady
/** @type {Promise<unknown>} the readiness gate (resolves once setup settles). */
let readyGate = Promise.resolve()
/** @type {{port: number, server: object}|undefined} the live mini MCP server. */
let mini
/** @type {number} the bound mini MCP port. */
let miniPort = 0
/** @type {object} the worktree session-reader module (hook-resolved TS). */
let readerModule
/** @type {object} the real-FS read-only home port. */
let homePort

/**
 * Read the run directive (written by run.mjs before the boot).
 * @returns {object} the validated directive.
 */
function readDirective() {
  const home = process.env.DSH_HOME
  if (typeof home !== 'string' || home.length === 0) {
    throw new Error('p7t7: DSH_HOME is not set in the host process environment')
  }
  const parsed = JSON.parse(readFileSync(join(home, DIRECTIVE_NAME), 'utf8'))
  if (typeof parsed.reportDir !== 'string' || parsed.reportDir.length === 0) {
    throw new Error('p7t7: directive.reportDir is required')
  }
  return parsed
}

/**
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {unknown} body
 */
function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @returns {Promise<string>} the full request body (UTF-8).
 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/**
 * One JSON-RPC POST to the mini MCP endpoint (plain JSON, no SSE).
 * @param {string} url
 * @param {object} msg
 * @returns {Promise<{status: number, body: unknown}>}
 */
async function fetchJsonRpc(url, msg) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(msg),
    signal: AbortSignal.timeout(30_000),
  })
  const text = await res.text()
  let body = null
  if (text !== '') {
    try {
      body = JSON.parse(text)
    } catch {
      body = { nonJsonBody: text.slice(0, 400) }
    }
  }
  return { status: res.status, body }
}

/**
 * The MCP client round-trip: initialize -> notifications/initialized ->
 * tools/call, all against the row's own mini endpoint (the public
 * surface story: the reader is reachable exactly as an external MCP
 * client would reach it).
 * @param {object} args - the tool arguments.
 * @returns {Promise<{status: number, isError: boolean, payload: unknown, rawText: string|null, initStatus: number}>}
 */
async function callTool(args) {
  const base = `http://127.0.0.1:${miniPort}/mcp`
  const init = await fetchJsonRpc(base, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'p7t7-harness-row', version: '0.0.1' },
    },
  })
  await fetchJsonRpc(base, { jsonrpc: '2.0', method: 'notifications/initialized' })
  const call = await fetchJsonRpc(base, {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name: TOOL_NAME, arguments: args },
  })
  const result = call.body?.result
  const content = result?.content?.[0]
  let rawText = null
  let payload = null
  if (typeof content?.text === 'string') {
    rawText = content.text
    try {
      payload = JSON.parse(content.text)
    } catch {
      payload = { nonJsonText: content.text.slice(0, 400) }
    }
  }
  return {
    status: call.status,
    isError: result?.isError === true,
    payload,
    rawText,
    initStatus: init.status,
  }
}

/**
 * A READ-ONLY snapshot of the harness-planted fixture subtree:
 * relPath -> sha256(content). Scoped to FIXTURE_ROOTS so the host's own
 * files (profiles/, its native sessions under other project keys, logs)
 * never pollute the comparison.
 * @returns {Record<string, string>}
 */
function snapshotFixtureTree() {
  const home = (process.env.DSH_HOME ?? '').replace(/[\\/]+$/, '')
  const out = {}
  const walk = (abs, relPrefix) => {
    let entries
    try {
      entries = readdirSync(abs, { withFileTypes: true })
    } catch {
      return
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    for (const entry of entries) {
      const absPath = join(abs, entry.name)
      const relPath = relPrefix === '' ? entry.name : `${relPrefix}/${entry.name}`
      if (entry.isDirectory()) {
        walk(absPath, relPath)
      } else {
        try {
          out[relPath] = createHash('sha256').update(readFileSync(absPath)).digest('hex')
        } catch {
          out[relPath] = '<unreadable>'
        }
      }
    }
  }
  for (const root of FIXTURE_ROOTS) {
    walk(join(home, ...root.split('/')), root)
  }
  return out
}

/** One assertion row of a scenario report. */
function makeCheck(name, pass, expected, actual) {
  return { name, pass: pass === true, ...(expected !== undefined ? { expected } : {}), ...(actual !== undefined ? { actual } : {}) }
}

/**
 * L1 — the valid legacy-team view over the planted fixture home.
 * @returns {Promise<object>} the scenario report.
 */
async function runL1() {
  const home = (process.env.DSH_HOME ?? '').replace(/[\\/]+$/, '')
  const before = snapshotFixtureTree()
  const call = await callTool({ action: 'inspect', workspaceCwd: join(home, 'ws') })
  const view = call.payload
  const assertions = []
  assertions.push(makeCheck('mini-MCP initialize handshake (http 200)', call.initStatus === 200, 200, call.initStatus))
  assertions.push(makeCheck('tool call succeeded (isError=false)', call.isError === false && call.status === 200, false, call.isError))
  assertions.push(makeCheck('view status is legacy-team', view?.status === 'legacy-team', 'legacy-team', view?.status))
  assertions.push(makeCheck('leader selected from team events', view?.team?.leaderSelection === 'team-events', 'team-events', view?.team?.leaderSelection))
  assertions.push(makeCheck('leader session (and teamId) is sess-leader', view?.team?.leaderSessionId === 'sess-leader' && view?.team?.teamId === 'sess-leader', 'sess-leader', view?.team?.leaderSessionId))
  const roster = Array.isArray(view?.team?.roster) ? view.team.roster : []
  const alpha = roster.find((m) => m?.id === 'p7t7-alpha')
  const leader = roster.find((m) => m?.id === 'p7t7-leader')
  assertions.push(makeCheck('roster has exactly the 2 planted members', roster.length === 2, 2, roster.length))
  assertions.push(makeCheck('workspace overlay wins per id (alpha name)', alpha?.name === 'Alpha WS', 'Alpha WS', alpha?.name))
  assertions.push(makeCheck('workspace overlay source recorded', alpha?.source === 'workspace', 'workspace', alpha?.source))
  assertions.push(makeCheck('leader roster role is leader', leader?.role === 'leader', 'leader', leader?.role))
  const children = Array.isArray(view?.team?.memberChildSessionIds) ? view.team.memberChildSessionIds : []
  assertions.push(makeCheck('member child sessions include sess-alpha', children.includes('sess-alpha'), true, children))
  const sessions = Array.isArray(view?.team?.sessions) ? view.team.sessions : []
  const leaderEv = sessions.find((s) => s?.directoryId === 'sess-leader')
  const alphaEv = sessions.find((s) => s?.directoryId === 'sess-alpha')
  assertions.push(makeCheck('sess-leader header recognized', leaderEv?.headerPresent === true, true, leaderEv?.headerPresent))
  assertions.push(makeCheck('sess-leader eventCount is 3', leaderEv?.eventCount === 3, 3, leaderEv?.eventCount))
  assertions.push(makeCheck('sess-leader teamEventTotal is 2', leaderEv?.teamEventTotal === 2, 2, leaderEv?.teamEventTotal))
  assertions.push(makeCheck('sess-alpha origin is subagent', alphaEv?.origin === 'subagent', 'subagent', alphaEv?.origin))
  assertions.push(makeCheck('sess-alpha parentSession is sess-leader', alphaEv?.parentSession === 'sess-leader', 'sess-leader', alphaEv?.parentSession))
  assertions.push(makeCheck('sess-alpha teamEventTotal is 1 (member-bound)', alphaEv?.teamEventTotal === 1, 1, alphaEv?.teamEventTotal))
  const after = snapshotFixtureTree()
  const l1SnapshotSame = JSON.stringify(after) === JSON.stringify(before)
  assertions.push(makeCheck('home fixture snapshot identical after inspect (read-only)', l1SnapshotSame, true, l1SnapshotSame))
  return { scenario: 'L1', pass: assertions.every((a) => a.pass), assertions, viewStatus: view?.status ?? null, mcpPort: miniPort }
}

/**
 * L2 — mutation rejection: every non-inspect action returns the typed
 * error, the inspect control still works, and the home is untouched.
 * @returns {Promise<object>} the scenario report.
 */
async function runL2() {
  const before = snapshotFixtureTree()
  const assertions = []
  for (const verb of ['resume', 'restore', 'mutate']) {
    const call = await callTool({ action: verb })
    const payload = call.payload
    assertions.push(makeCheck(`${verb}: tool reports isError`, call.isError === true, true, call.isError))
    assertions.push(makeCheck(`${verb}: typed error code`, payload?.code === 'LEGACY_READER_MUTATION_REJECTED', 'LEGACY_READER_MUTATION_REJECTED', payload?.code))
    assertions.push(makeCheck(`${verb}: the action is echoed in details`, payload?.details?.action === verb, verb, payload?.details?.action))
  }
  const control = await callTool({ action: 'inspect', workspaceCwd: join((process.env.DSH_HOME ?? '').replace(/[\\/]+$/, ''), 'ws') })
  assertions.push(makeCheck('inspect control still succeeds', control.isError === false && control.payload?.status === 'legacy-team', true, control.isError || control.payload?.status))
  const after = snapshotFixtureTree()
  const l2SnapshotSame = JSON.stringify(after) === JSON.stringify(before)
  assertions.push(makeCheck('home fixture snapshot identical after rejected actions (read-only)', l2SnapshotSame, true, l2SnapshotSame))
  return { scenario: 'L2', pass: assertions.every((a) => a.pass), assertions, rejected: ['resume', 'restore', 'mutate'], mcpPort: miniPort }
}

/**
 * L3 — the native fallback: no roster and no team events anywhere ->
 * the view degrades to native Chat/Trajectory (required behavior).
 * @returns {Promise<object>} the scenario report.
 */
async function runL3() {
  const before = snapshotFixtureTree()
  const call = await callTool({ action: 'inspect', workspaceCwd: join((process.env.DSH_HOME ?? '').replace(/[\\/]+$/, ''), 'ws') })
  const view = call.payload
  const assertions = []
  assertions.push(makeCheck('tool call succeeded (isError=false)', call.isError === false && call.status === 200, false, call.isError))
  assertions.push(makeCheck('view status is native-fallback', view?.status === 'native-fallback', 'native-fallback', view?.status))
  assertions.push(makeCheck('fallback reason is no-legacy-metadata', view?.reason === 'no-legacy-metadata', 'no-legacy-metadata', view?.reason))
  assertions.push(makeCheck('degraded to native-chat-trajectory', view?.degradedTo === 'native-chat-trajectory', 'native-chat-trajectory', view?.degradedTo))
  const native = Array.isArray(view?.native) ? view.native : []
  const sessNative = native.find((s) => s?.directoryId === 'sess-native')
  assertions.push(makeCheck('native list carries the planted native session', sessNative?.directoryId === 'sess-native' && sessNative?.headerPresent === true, true, sessNative ? `${sessNative.directoryId}/header=${sessNative.headerPresent}` : 'absent'))
  assertions.push(makeCheck('native session has no team events', (sessNative?.teamEventTotal ?? -1) === 0, 0, sessNative?.teamEventTotal))
  const after = snapshotFixtureTree()
  const l3SnapshotSame = JSON.stringify(after) === JSON.stringify(before)
  assertions.push(makeCheck('home fixture snapshot identical after inspect (read-only)', l3SnapshotSame, true, l3SnapshotSame))
  return { scenario: 'L3', pass: assertions.every((a) => a.pass), assertions, viewStatus: view?.status ?? null, mcpPort: miniPort }
}

/**
 * The row entry point (fire-and-forget async setup, the P2-proven form):
 * the Loader only needs the named exports; the HTTP handlers gate on
 * `readyGate`, so no scenario request can race the setup.
 * @param {object} ctx - the Cordis plugin context.
 */
export function apply(ctx) {
  let resolveReadyLocal
  readyGate = new Promise((r) => { resolveReadyLocal = r })
  resolveReady = resolveReadyLocal
  run(ctx).catch((error) => {
    setupError = error instanceof Error ? error.message : String(error)
    try {
      if (directive !== undefined) {
        mkdirSync(join(directive.reportDir, 'harness-output'), { recursive: true })
        writeFileSync(
          join(directive.reportDir, 'harness-output', 'setup-failure.json'),
          JSON.stringify({ error: setupError, stack: error?.stack ?? null }, null, 2),
        )
      }
    } catch {
      /* the health route still reports the failure */
    }
    resolveReadyLocal()
  })
}

/**
 * The async row setup: read the directive, import the worktree reader
 * (hook-resolved TS), build the real-FS port, start the mini MCP
 * endpoint, and register the two host routes.
 * @param {object} ctx
 * @returns {Promise<void>}
 */
async function run(ctx) {
  const { webServer } = ctx
  directive = readDirective()
  mkdirSync(join(directive.reportDir, 'harness-output'), { recursive: true })

  readerModule = await import('../index.js')
  const fsSeamMod = await import('./fs-seam.mjs')
  const mcpMod = await import('./mini-mcp.mjs')
  homePort = fsSeamMod.createRealFsHomePort()

  mini = await mcpMod.startMiniMcpServer(MCP_PORT_CANDIDATES, { readerModule, homePort })
  miniPort = mini.port
  ctx.effect(() => () => {
    if (mini !== undefined) {
      void mcpMod.closeMiniServer(mini)
      mini = undefined
    }
  }, 'p7t7 mini-mcp close')

  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/__p7t7/health',
    handler: (req, res) => {
      sendJson(res, 200, {
        ok: setupError === null,
        ready: setupError === null,
        mcpPort: miniPort,
        ...(setupError !== null ? { setupError } : {}),
      })
    },
  }), 'p7t7 health route')

  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/__p7t7/run',
    handler: async (req, res) => {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'POST only' })
        return
      }
      let body
      try {
        body = JSON.parse((await readBody(req)) || '{}')
      } catch (error) {
        sendJson(res, 400, { error: `bad JSON body: ${String(error?.message ?? error)}` })
        return
      }
      const scenario = body?.scenario
      if (!SCENARIOS.includes(scenario)) {
        sendJson(res, 400, { error: `unknown scenario '${String(scenario)}' (expected one of ${SCENARIOS.join(',')})` })
        return
      }
      await readyGate
      if (setupError !== null) {
        sendJson(res, 503, { scenario, error: 'row setup failed', setupError })
        return
      }
      try {
        const report = scenario === 'L1' ? await runL1() : scenario === 'L2' ? await runL2() : await runL3()
        writeFileSync(join(directive.reportDir, 'harness-output', `${scenario}.json`), JSON.stringify(report, null, 2))
        sendJson(res, 200, report)
      } catch (error) {
        const failed = { scenario, pass: false, error: error instanceof Error ? error.message : String(error) }
        try {
          writeFileSync(join(directive.reportDir, 'harness-output', `${scenario}.error.json`), JSON.stringify(failed, null, 2))
        } catch {
          /* the HTTP response still carries the error */
        }
        sendJson(res, 200, failed)
      }
    },
  }), 'p7t7 run route')

  resolveReady()
}
