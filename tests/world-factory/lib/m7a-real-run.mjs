/**
 * m7a-real-run.mjs — the M7-A real-host slice harness.
 *
 * WHAT THIS IS: the thinnest path that puts the Contract Oracle in front of a
 * REAL DSH execution chain, using only public seams:
 *
 *   scripted model (agent-script/1 replayed at the model WIRE)
 *     -> real `dsh web` process (pinned 0.2.0-rc.2 Host, World Factory lifecycle)
 *       -> real Agent Session (public /api/session/* RPC)
 *         -> real tool resolution (`write` / `bash` from the shipped preset)
 *           -> real execution (the Host's own fs provider + sandbox)
 *             -> independent observation (parent-process FS snapshot)
 *               -> judgeContract() verdict
 *
 * WHY THE MODEL IS ON THE WIRE, NOT IN-PROCESS: `ScriptedModelAdapter` is an
 * `LlmAdapter` object; injecting it into a separate `dsh web` child is a
 * different composition than the one that ships. The public seam that exists is
 * the provider endpoint: the World Factory sets `DEEPSEEK_BASE_URL` +
 * `DEEPSEEK_API_KEY` (`tests/world-factory/lib/world-factory.mjs`, `startHost`)
 * and the shipped DeepSeek adapter reads them from the trusted env layer
 * (`packages/llm/llm-deepseek/src/config.ts` in the pinned host tree). The
 * mock provider (`packages/tools/harness/mock-deepseek.mjs`) is that endpoint;
 * `createWireScriptDriver` (packages/testkit/src/wire-script.ts) is its script.
 *
 * WHAT THE TRACE IS: the Host's own durable session log
 * (`<DSH_HOME>/sessions/**\/session*.jsonl.zstd`) — the system under test's
 * account of what it did. It is NOT independent evidence; the oracle treats it
 * as a claim and corroborates it against the witness. The mapping is explicit:
 *   tool/call             -> DISPATCHED (no authority_ref: this lane computes none)
 *   tool/result  isError  -> DENIED     (+ error_code, e.g. FS_SANDBOX_DENIED)
 *   tool/result  ok       -> COMPLETED
 *
 * WHAT THE WITNESS IS: a parent-process snapshot of a dedicated, world-owned
 * "watch" directory that is deliberately OUTSIDE the session workspace but
 * inside the Host's own temp area (TMPDIR is re-pointed at `<home>/tmp`, so a
 * temp-area write lands there and nowhere shared). The witness rows are
 * produced by `createFsWitness` and carry its provenance seal; the caller never
 * writes `instrumented`.
 *
 * HONEST LIMITS (also reported by the oracle): process and network are NOT
 * instrumented. A green verdict says nothing about either.
 *
 * @module tests/world-factory/lib/m7a-real-run
 */
import { register } from 'node:module'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { zstdDecompressSync } from 'node:zlib'
import {
  apiPrompt,
  apiSessionCreate,
  authenticate,
  scrubProviderEnv,
  stableInstanceProbe,
} from './world-factory.mjs'

const HERE = new URL('.', import.meta.url).pathname
/** Repo root of the worktree that owns this module (tests/world-factory/lib -> ../../..). */
export const M7A_REPO_ROOT = resolve(HERE, '..', '..', '..')

// The testkit sources are TypeScript, run under plain node via the repo's
// EXISTING resolution hook (scripts/run-tests-hooks.mjs) — no new loader, no
// build step. Registered here so every importer gets the same instrument
// implementations the unit tests use.
let testkitPromise = null
async function testkit() {
  if (testkitPromise === null) {
    register(pathToFileURL(join(M7A_REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)
    testkitPromise = import(pathToFileURL(join(M7A_REPO_ROOT, 'packages', 'testkit', 'src', 'effect-witness.ts')).href)
  }
  return testkitPromise
}
let oraclePromise = null
async function oracle() {
  if (oraclePromise === null) {
    await testkit()
    oraclePromise = import(pathToFileURL(join(M7A_REPO_ROOT, 'packages', 'testkit', 'src', 'contract-oracle.ts')).href)
  }
  return oraclePromise
}
let wirePromise = null
async function wire() {
  if (wirePromise === null) {
    await testkit()
    wirePromise = import(pathToFileURL(join(M7A_REPO_ROOT, 'packages', 'testkit', 'src', 'wire-script.ts')).href)
  }
  return wirePromise
}

/** The world-owned directory the Host's TMPDIR points at. */
export const M7A_TMP_DIRNAME = 'm7a-tmp'
/** The quiet sub-directory the FS witness watches (never written by the Host itself). */
export const M7A_WATCH_DIRNAME = 'm7a-watch'

/**
 * Create the World plus the two world-owned directories this slice needs:
 * `<home>/m7a-tmp` (the Host's TMPDIR, so temp-area writes stay inside the
 * World) and `<home>/m7a-tmp/m7a-watch` (the quiet watched directory).
 *
 * @param {{factory: import('./world-factory.mjs').TestWorldFactory, line: string}} args
 */
export async function createRealRunWorld({ factory, line }) {
  const world = await factory.createWorld({ line })
  try {
    const tmpDir = join(world.home, M7A_TMP_DIRNAME)
    const watchDir = join(tmpDir, M7A_WATCH_DIRNAME)
    mkdirSync(watchDir, { recursive: true })
    return { world, tmpDir, watchDir }
  } catch (error) {
    // A half-created World owns a home; leaving it behind on the failure path is
    // how a red run turns into a leaking one. Tear down what we made, then fail.
    await world.teardown({ keepHome: false }).catch((teardownError) => {
      console.error('[M7A] teardown after createRealRunWorld failed:', teardownError?.stack ?? teardownError)
    })
    throw error
  }
}

// ── session log: the Host's own durable trace ────────────────────────────────

const ZSTD_MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])

/**
 * Decompress a DSH session log: a sequence of CONCATENATED zstd frames (one per
 * append), which `zstdDecompressSync` alone only decodes the first frame of.
 * Frame boundaries are found by the zstd magic; a candidate that fails to
 * decode is treated as a partial tail (the Host may still be flushing) and
 * dropped, never guessed.
 *
 * @param {Buffer} buf
 * @returns {Buffer}
 */
export function decompressSessionLog(buf) {
  const starts = []
  let off = 0
  for (;;) {
    const i = buf.indexOf(ZSTD_MAGIC, off)
    if (i === -1) break
    starts.push(i)
    off = i + 4
  }
  if (starts.length === 0) throw new Error('M7A_SESSION_LOG_NO_ZSTD_FRAME')
  const bounds = [...starts, buf.length]
  const parts = []
  let pending
  for (let k = 0; k < bounds.length - 1; k += 1) {
    const chunk = buf.subarray(bounds[k], bounds[k + 1])
    const candidate = pending === undefined ? chunk : Buffer.concat([pending, chunk])
    try {
      parts.push(zstdDecompressSync(candidate))
      pending = undefined
    } catch {
      pending = candidate
    }
  }
  if (pending !== undefined) {
    try {
      parts.push(zstdDecompressSync(pending))
    } catch {
      /* partial tail frame while the Host flushes */
    }
  }
  return Buffer.concat(parts)
}

function walkFiles(root, out = []) {
  let entries = []
  try {
    entries = readdirSync(root, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) walkFiles(path, out)
    else if (entry.isFile()) out.push(path)
  }
  return out
}

/**
 * Locate a session log by the session id in its HEADER row (the file name is
 * keyed by cwd, not by session id).
 *
 * @param {string} home - DSH_HOME
 * @param {string} sessionId
 */
export function findSessionLog(home, sessionId) {
  for (const path of walkFiles(join(home, 'sessions'))) {
    if (!/^session(\..+)?\.jsonl\.zstd$/u.test(path.split('/').pop() ?? '')) continue
    let rows
    try {
      rows = readSessionRows(path)
    } catch {
      continue
    }
    if (rows[0]?.type === 'session' && rows[0]?.id === sessionId) return { path, rows }
  }
  return null
}

/**
 * Read the JSONL rows of one session log.
 *
 * @param {string} path
 */
export function readSessionRows(path) {
  const buf = readFileSync(path)
  return decompressSessionLog(buf)
    .toString('utf8')
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => {
      try {
        return JSON.parse(line)
      } catch {
        return { type: 'M7A_UNPARSEABLE_SESSION_ROW', raw: line.slice(0, 200) }
      }
    })
}

/**
 * Map the Host's durable rows for ONE tool call onto the oracle's trace
 * vocabulary. Honest about what each row is: the Host's claim.
 *
 * @param {Array<object>} rows - session log rows
 * @param {{ sessionId: string, callId?: string, turn?: number }} filter
 * @returns {Array<import('../../../packages/testkit/src/contract-oracle.ts').TraceEvent>}
 */
export function traceEventsFromSessionRows(rows, { sessionId, callId, turn }) {
  const events = []
  const wants = (id) => callId === undefined || id === callId
  const inTurn = (data) => turn === undefined || data?.turn === turn
  for (const row of rows) {
    const data = row?.data ?? {}
    if (row?.type === 'tool/call' && wants(data.callId) && inTurn(data)) {
      events.push({
        event_seq: row.seq,
        event_type: 'tool/call',
        actor_id: sessionId,
        execution_id: data.callId,
        tool_name: data.name,
        // This lane computes no per-call authority decision; saying otherwise
        // would be a fabricated provenance for the oracle's identity rules.
        authority_ref: null,
        outcome: 'DISPATCHED',
      })
      continue
    }
    if (row?.type === 'tool/result' && inTurn(data)) {
      // The Host nests the call id in the message envelope (`message.toolCallId`,
      // or `message.source.callId`); a top-level `toolCallId` is tolerated for
      // older shapes. Reading only one of them would silently drop the pairing.
      const resultCallId = data.toolCallId ?? data.message?.toolCallId ?? data.message?.source?.callId
      if (!wants(resultCallId)) continue
      const denied = data?.message?.isError === true || data?.error !== undefined
      // The rendered result body is the Host's CLAIM (a nonzero shell exit still
      // arrives as isError:false), so it is kept as evidence text and never as a
      // verdict input.
      const body = Array.isArray(data?.message?.content)
        ? data.message.content.map((part) => (typeof part?.text === 'string' ? part.text : '')).join('')
        : typeof data?.message?.content === 'string' ? data.message.content : ''
      events.push({
        event_seq: row.seq,
        event_type: 'tool/result',
        actor_id: sessionId,
        execution_id: resultCallId,
        authority_ref: null,
        outcome: denied ? 'DENIED' : 'COMPLETED',
        result_text: body.slice(0, 600),
        // Extra evidence fields (the oracle ignores unknown fields).
        ...(data?.error?.code === undefined ? {} : { error_code: String(data.error.code) }),
        ...(data?.error?.name === undefined ? {} : { error_name: String(data.error.name) }),
        denial_kind: denied ? 'tool-error' : null,
      })
    }
  }
  return events
}

// ── observer: the independent channel, armed by the observer object ──────────

/**
 * Create the World's independent observer.
 *
 * The witness is armed by THIS object (`arm()`), and its rows carry the
 * effect-witness provenance seal. The test caller receives rows; it never
 * constructs one and never writes `instrumented`.
 *
 * SCOPE (M7-A correction): the instrument watches the WHOLE owned home
 * (`home`), not one quiet sub-directory. The previous version watched only
 * `<home>/m7a-tmp/m7a-watch`, so a real write to the workspace was reported as
 * "no effect in filesystem" — the false green the reviewer reproduced. The
 * watch set is `home`, which already covers the workspace
 * (`<home>/workspace`) and the World temp area (`<home>/m7a-tmp`); roots are
 * pruned by the witness. Effects are then classified by path: the workspace and
 * the Host's own session log are authorized, everything else (including the
 * watched temp area) is not.
 *
 * @param {{ home: string, watchDir: string, authorized?: string[] }} args
 */
export async function createWorldObserver({ home, watchDir }) {
  const { createFsWitness, createBlindWitness } = await testkit()
  let active = null
  let blinded = false
  return {
    watchDir,
    /** Start a fresh observation window (point-in-time baseline). */
    arm() {
      active = createFsWitness({ root: home, watch: [home] })
      blinded = false
      return this
    },
    /**
     * Negative control: the observation is DISABLED for the filesystem domain.
     * A run judged through this observer must not be able to go green.
     */
    disable() {
      if (active === null) throw new Error('M7A_OBSERVER_NOT_ARMED')
      active = createBlindWitness(active, ['filesystem'])
      blinded = true
      return this
    },
    /** Whether observation is disabled (evidence, not logic). */
    get disabled() {
      return blinded
    },
    /** The rows for the current window, private-sealed by the instrument. */
    async observe() {
      if (active === null) throw new Error('M7A_OBSERVER_NOT_ARMED')
      return {
        observations: await active.observe(),
        blindDomains: [...active.blindDomains],
        watchedPaths: [...active.watchedPaths],
      }
    },
  }
}

// ── the run ──────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Boot one real Host for this script and open one real Agent Session.
 *
 * @param {object} args
 * @param {object} args.world - a World from {@link createRealRunWorld}
 * @param {string} args.tmpDir - the World's TMPDIR
 * @param {unknown} args.script - an `agent-script/1` document
 * @param {number} [args.bootTimeoutMs]
 * @param {string} [args.callIdPrefix] - synthesized call-id prefix. M7-A uses
 *   `m7a`; M7-B1 passes its own so the contract can BIND the execution id before
 *   the turn runs and then assert the Host actually used it.
 */
export async function startRealRun({ world, tmpDir, script, bootTimeoutMs = 180_000, signal = null, callIdPrefix = 'm7a' }) {
  const { createWireScriptDriver } = await wire()
  const driver = createWireScriptDriver(script, { callIdPrefix })
  scrubProviderEnv()
  // The Host's temp area becomes world-owned: a temp-area write can then only
  // land where this slice can see it (and the World deletes it at teardown).
  process.env.TMPDIR = tmpDir
  // The mock provider is an IN-PROCESS HTTP SERVER: once it is listening it owns
  // a handle, so a throw from anything below (the sandbox pre-flight, a dead
  // host, a refused session) would leave the event loop alive and the test
  // process unable to exit — measured on the hosted runner as a 41-minute hang
  // until the job's own timeout. Every failure path therefore stops what this
  // function started before it rethrows, and an abort signal does the same.
  const onAbort = () => {
    world.stopHost({ graceMs: 2_000 }).catch(() => {})
  }
  signal?.addEventListener('abort', onAbort, { once: true })
  try {
    const mock = await world.startMock({ decide: (input) => driver.decide(input) })
    const booted = await world.startHost({ bootTimeoutMs })
    const origin = `http://127.0.0.1:${booted.port}`
    const cookie = await authenticate(origin, world.token)
    const created = await apiSessionCreate(origin, cookie, world.workspaceDir, 'm7a')
    const sessionId = created.body?.result?.value?.sessionId
    if (typeof sessionId !== 'string' || sessionId.length === 0) {
      throw new Error(`M7A_SESSION_CREATE_REFUSED status=${String(created.status)} body=${JSON.stringify(created.body)?.slice(0, 400)}`)
    }
    return {
      origin,
      cookie,
      sessionId,
      port: booted.port,
      driver,
      mock,
      token: world.token,
      worldHome: world.home,
      workspaceDir: world.workspaceDir,
      agentPreset: created.body?.result?.value?.agentPreset ?? null,
    }
  } catch (error) {
    await world.stopHost({ graceMs: 2_000 }).catch(() => {})
    await world.stopMock().catch(() => {})
    throw error
  } finally {
    signal?.removeEventListener('abort', onAbort)
  }
}

/**
 * Send one prompt and wait until the Host durably records the END of that turn.
 *
 * Waiting on the Host's own `turn/end` row (not on the mock, not on a timer)
 * is what makes the arm deterministic: the tool call and its result exist on
 * disk before anything is judged.
 *
 * @param {object} run - from {@link startRealRun}
 * @param {object} args
 * @param {string} args.prompt
 * @param {number} args.turn - 1-based turn number (one prompt == one turn)
 * @param {number} [args.timeoutMs]
 */
export async function runTurn(run, { prompt, turn, timeoutMs = 120_000 }) {
  const startedAt = Date.now()
  const sent = await apiPrompt(run.origin, run.cookie, run.sessionId, prompt, `m7a-t${turn}`)
  if (sent.status !== 200 || sent.body?.result?.ok !== true) {
    throw new Error(`M7A_PROMPT_REFUSED turn=${turn} status=${String(sent.status)} body=${JSON.stringify(sent.body)?.slice(0, 400)}`)
  }
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const found = findSessionLog(run.worldHome, run.sessionId)
    if (found !== null) {
      const ended = found.rows.some((row) => row?.type === 'turn/end' && row?.data?.turn === turn)
      if (ended) {
        const events = traceEventsFromSessionRows(found.rows, { sessionId: run.sessionId, turn })
        return { turn, elapsedMs: Date.now() - startedAt, events, sessionLog: found.path, rows: found.rows }
      }
    }
    if (Date.now() > deadline) {
      throw new Error(`M7A_TURN_TIMEOUT turn=${turn} after ${String(timeoutMs)}ms (script consumed ${String(run.driver.consumedTurns)}/${String(run.driver.script.turns.length)})`)
    }
    await sleep(250)
  }
}

// ── judging ─────────────────────────────────────────────────────────────────

/**
 * Build the oracle input from REAL artifacts and judge it.
 *
 * @param {object} args
 * @param {string} args.contractId
 * @param {Array<object>} args.events - real trace rows (see traceEventsFromSessionRows)
 * @param {Array<object>} args.observations - sealed rows from the observer
 * @param {Array<string>} args.blindDomains
 * @param {Array<string>} [args.requiredEffectDomains]
 * @param {'declared'|'witnessed'} [args.witnessProvenance]
 * @param {boolean} [args.expectDeny]
 */
export async function judgeRealRun({
  contractId,
  events,
  observations,
  blindDomains,
  requiredEffectDomains = ['filesystem'],
  requiredEffectScope = [],
  authorizedEffectPaths = [],
  forbiddenEffectPaths = [],
  witnessProvenance = 'witnessed',
  expectDeny = true,
}) {
  const { judgeContract } = await oracle()
  const input = {
    contractId,
    events,
    witness: observations,
    blindDomains,
    requiredEffectDomains,
    // M7-A correction: the contract states which paths it is about (and which
    // effects it authorizes) instead of implying "the whole filesystem" from a
    // witness that watched one directory.
    requiredEffectScope,
    authorizedEffectPaths,
    forbiddenEffectPaths,
    witnessProvenance,
    expectDeny,
  }
  return { input, judgement: judgeContract(input) }
}

/**
 * Census of what the REAL Host asked the model endpoint for: how many requests
 * arrived, and the tool names advertised on the agent requests. This is read
 * from the World's own mock (the endpoint the Host was pointed at), so it is a
 * fact about the run, not a claim about the source tree.
 *
 * @param {object} world
 */
export function mockRequestCensus(world) {
  const requests = world?.mock?.requests ?? []
  const toolNames = new Set()
  let agentRequests = 0
  for (const record of requests) {
    const tools = record?.body?.tools
    if (Array.isArray(tools) && tools.length > 0) {
      agentRequests += 1
      for (const tool of tools) {
        const name = tool?.function?.name ?? tool?.name
        if (typeof name === 'string' && name.length > 0) toolNames.add(name)
      }
    }
  }
  return {
    requests: requests.length,
    agentRequests,
    toolNames: [...toolNames].sort(),
    // A shape assertion for the report: the shipped preset's full tool list.
    toolCount: toolNames.size,
  }
}

/** Content digest of a file, or null when absent (independent disk check). */
export function fileDigest(path) {
  if (!existsSync(path)) return null
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

/** Real size/stat of a path, or null when absent. */
export function statOf(path) {
  try {
    const s = statSync(path)
    return { size: s.size, mtimeMs: s.mtimeMs, isFile: s.isFile() }
  } catch {
    return null
  }
}

/** Read-only stable-instance probe, recorded before/after the slice. */
export { stableInstanceProbe }
