/**
 * world-factory.mjs — the ONE TestWorldFactory (U5 / gate G3).
 *
 * WHAT THIS IS: the single creation/reclamation point for test Worlds on the
 * pinned pristine Host. It REUSES the existing machinery instead of growing a
 * second copy of it (plan U5: "不建立第二套 Host launcher"):
 *   - tests/paths.mjs                       — paths, port ranges, baseline pin
 *   - tests/characterization/lib/instance.mjs — the ONLY Host launcher used
 *     here (DshInstance: file-fd spawn, boot-marker wait, stop, mountRows).
 *     Everything beyond DshInstance (ownership ledger, leases, guardrails) is
 *     a THIN WRAPPER composed around it, never a fork of its launch chain.
 *   - tests/characterization/lib/util.mjs   — port probes, log tails
 *   - tests/kits/rc2-real-host-smoke/run-control.mjs (+ run-budget.mjs) —
 *     ownership/budget contract for the child (imported by the runner, which
 *     binds the child; this file exposes what it needs via World.child).
 *
 * PER-WORLD EXCLUSIVITY (plan U5 bullet 2):
 *   DSH_HOME     tests/homes/<line>-<UTC>  (TEST_METHODS §7 naming; refuses
 *                an existing path or symlink; <home>.lock honoured)
 *   workspace    <home>/workspace          (the session cwd; canary effects)
 *   logs         <evidenceRoot>/logs/<id>  (raw logs live OUTSIDE git)
 *   provider     an in-process mock model with a LEASED port (3491-3500)
 *   host port    LEASED (3180-3186), lease = pid+startedAt file, stale-lease
 *                reclaim = crash recovery (see port-lease.mjs)
 *   PIDs         <home>/.u5-ownership.json records {runnerPid, hostPid};
 *                teardown/reclaim kills ONLY pids listed there AND verified
 *                (Linux: /proc/<pid>/environ carries DSH_HOME == this home).
 *   cleanup      <home>/.u5-created.json marks what this World created;
 *                deletion happens ONLY when the marker matches the World id
 *                — a path the World did not create is never removed.
 *
 * READ-ONLY HOST BASE: assertHostBase() runs `git -C <hostTree>
 * rev-parse HEAD` + `status --porcelain` and requires HEAD ==
 * TEST_USE_BASELINE_SHA with an empty porcelain. The runner calls it BEFORE
 * and AFTER every boot; any drift fails the run (never a silent pass).
 *
 * :3080 is never touched beyond a read-only status probe recorded before and
 * after the suite (leak evidence).
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFileSync, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createConnection } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CLIENT_COMMIT_HASH, homeDir, STABLE_INSTANCE_PORT, TEST_USE_BASELINE_SHA, testUseTree } from '../../paths.mjs'
import { DshInstance, redactLaunchToken } from '../../characterization/lib/instance.mjs'
import { logTail, portInUse, waitForPortFree } from '../../characterization/lib/util.mjs'
import { startMockModel } from '../../../packages/tools/harness/mock-deepseek.mjs'
import { acquireFirstFreeLease, pidAlive, releasePortLease } from './port-lease.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
/** The canary plugin fixture that gets mounted into every World. */
export const CANARY_PLUGIN_SRC = resolve(HERE, '..', 'canary', 'u5-canary-plugin.mjs')
export const CANARY_ROW_ID = 'u5-canary'
export const CANARY_TOOL_NAME = 'u5_canary'
export const WORLD_PREFIX = 'u5'
/**
 * PROFILE DISCLOSURE (s1-h0-m1 noext precedent, root-sanctioned differential
 * probe): on a FRESH unauthenticated DSH_HOME the two base-bundle
 * deepseekLlmApiExtensions metadata contributors (session-log-deepseek,
 * plugin-package-inventory-deepseek) make every model request die in
 * `prepareRequestExtensions` with REQUEST_EXTENSION BEFORE any HTTP dispatch
 * (measured u5dbg-20261025T13-35-42Z session.v4 transcript: every turn ended
 * `DeepSeek request extension preparation failed`, mock saw 0 requests). They
 * are METADATA contributors — disabling them through their OWN public config
 * flag (goal-snapshot.patch.yml syntax precedent) leaves registry rows, all
 * tools, Guard, dispatch and request.signal intact, and is what the proven
 * s1-h0-m1 green run used. The product-side finding is reported, not hidden.
 */
export const EXT_CONTRIBUTOR_DISABLE = [
  '# U5 disclosure: disable ONLY the two deepseekLlmApiExtensions metadata',
  '# contributors through their own public config flag (s1-h0-m1 noext',
  '# precedent; schemas session-log-deepseek/src/index.ts:51-52).',
  '- id: session-log-deepseek',
  '  config:',
  '    enabled: false',
  '- id: plugin-package-inventory-deepseek',
  '  config:',
  '    enabled: false',
  '',
].join('\n')
const HOME_RE = new RegExp(`^${WORLD_PREFIX}[a-z0-9-]*-\\d{8}T\\d{2}-\\d{2}-\\d{2}Z(?:-r\\d+)?$`)

/** Real provider credential keys removed from the child env before spawn
 *  (names only are ever logged; s1-h0-m1 precedent). */
export const SCRUBBED_ENV_KEYS = Object.freeze([
  'DEEPSEEK_API_KEY', 'DEEPSEEK_SEARCH_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY',
  'GOOGLE_API_KEY', 'GEMINI_API_KEY', 'XAI_API_KEY', 'MISTRAL_API_KEY', 'AZURE_OPENAI_API_KEY',
])

/** TEST_METHODS §7 UTC stamp shape: 20260912T03-00-00Z */
export const utcStamp = (d = new Date()) => {
  const iso = d.toISOString()
  return `${iso.slice(0, 10).replace(/-/g, '')}T${iso.slice(11, 19).replace(/:/g, '-')}Z`
}
export const sha256Text = (s) => createHash('sha256').update(s).digest('hex')
export const sha256File = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')

/** Refuse anything that is not a bare, U5-prefixed, timestamped basename. */
export function validateWorldName(name) {
  if (typeof name !== 'string' || !HOME_RE.test(name) || name.includes('/') || name.includes('\\') || name.includes('..')) {
    throw new Error(`world name must match <${WORLD_PREFIX}<line>-<UTC>> per TEST_METHODS §7 (got ${JSON.stringify(name)})`)
  }
  return name
}

/**
 * A read-only GET of the stable instance — used ONLY to record that it was
 * unaffected (same status before/after). Binds nothing, POSTs nothing.
 */
export async function stableInstanceProbe(timeoutMs = 5000) {
  const url = `http://127.0.0.1:${STABLE_INSTANCE_PORT}/`
  try {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) })
    return { reachable: true, status: res.status }
  } catch (error) {
    return { reachable: false, error: String(error?.name ?? error?.message ?? error) }
  }
}

/** Names + mtimes of sibling worlds under tests/homes (leak-evidence census). */
export function homesCensus(homesRoot) {
  const out = {}
  let names = []
  try {
    names = readdirSync(homesRoot)
  } catch {
    return out
  }
  for (const name of names) {
    try {
      out[name] = Math.trunc(statSync(join(homesRoot, name)).mtimeMs)
    } catch {
      out[name] = 'unreadable'
    }
  }
  return out
}

/** Linux-only owned-pid verification: the pid's environ must carry our DSH_HOME. */
export function ownedPidMatchesHome(pid, home) {
  try {
    const raw = readFileSync(`/proc/${pid}/environ`, 'utf8')
    return raw.split('\0').includes(`DSH_HOME=${home}`)
  } catch {
    return false
  }
}

/**
 * The runner's own spawn-time environment scrub: delete real credential keys
 * so the inherited-env spawn can never forward them (DshInstance.start
 * spawns with {...process.env}). Returns the removed NAMES.
 */
export function scrubProviderEnv() {
  const removed = []
  for (const key of SCRUBBED_ENV_KEYS) {
    if (process.env[key] !== undefined) {
      delete process.env[key]
      removed.push(key)
    }
  }
  return removed
}

export class HostBaseError extends Error {
  constructor(detail) {
    super(`host base guard: ${detail}`)
    this.name = 'HostBaseError'
  }
}

export class TestWorldFactory {
  /**
   * @param {object} opts
   * @param {string} opts.repoRoot   team-repo root (worktree) holding tests/
   * @param {string} opts.evidenceRoot  gitignored dir for raw logs/RUN records
   * @param {string} [opts.leaseRoot]   shared port-lease dir (cross-worktree)
   * @param {string} [opts.hostTree]    defaults to <repoRoot>/tests/deepseek-harness-test-use
   */
  constructor({ repoRoot, evidenceRoot, leaseRoot, hostTree }) {
    this.repoRoot = resolve(repoRoot)
    this.evidenceRoot = resolve(evidenceRoot)
    this.homeRoot = join(this.repoRoot, 'tests', 'homes')
    this.hostTree = resolve(hostTree ?? testUseTree(this.repoRoot))
    // Default lease root: the MAIN checkout's .artifacts/tmp so Worlds
    // created from sibling worktrees contend on the SAME lease files.
    this.leaseRoot = resolve(leaseRoot ?? this.#defaultLeaseRoot())
    this.worlds = []
  }

  #defaultLeaseRoot() {
    // .worktrees/<task> checkouts sit two levels under the main checkout.
    const parent = dirname(this.repoRoot)
    const main = parent.endsWith('.worktrees') ? dirname(parent) : this.repoRoot
    return join(main, '.artifacts', 'tmp', 'port-leases')
  }

  /** git HEAD + porcelain of the pristine host base. Throws on drift. */
  assertHostBase(phase = 'check') {
    const head = spawnSync('git', ['-C', this.hostTree, 'rev-parse', 'HEAD'], { encoding: 'utf8' })
    if (head.status !== 0) throw new HostBaseError(`${phase}: git rev-parse failed (exit ${String(head.status)})`)
    const headSha = String(head.stdout ?? '').trim()
    if (headSha !== TEST_USE_BASELINE_SHA) {
      throw new HostBaseError(`${phase}: HEAD ${headSha} != TEST_USE_BASELINE_SHA ${TEST_USE_BASELINE_SHA}`)
    }
    const st = spawnSync('git', ['-C', this.hostTree, 'status', '--porcelain'], { encoding: 'utf8' })
    if (st.status !== 0) throw new HostBaseError(`${phase}: git status failed (exit ${String(st.status)})`)
    if (String(st.stdout ?? '').trim() !== '') {
      throw new HostBaseError(`${phase}: porcelain not empty:\n${String(st.stdout).split('\n').slice(0, 8).join('\n')}`)
    }
    return { head: headSha, porcelainEmpty: true, phase }
  }

  /**
   * Create (but do not boot) one exclusive World.
   * @param {object} spec
   * @param {string} spec.line     line tag, e.g. 'core1' -> world 'u5core1-<UTC>'
   * @param {boolean} [spec.visible] canary registration visibility (wrong-scope control)
   * @param {boolean} [spec.badMount] start-failure control: mount the row but
   *                                  do NOT copy the plugin file -> boot fails
   */
  async createWorld({ line, visible = true, badMount = false, restartIndex = null, extContributors = 'disable' }) {
    if (typeof line !== 'string' || !/^[a-z0-9-]{1,24}$/.test(line)) throw new Error(`invalid world line: ${JSON.stringify(line)}`)
    const suffix = restartIndex === null ? '' : `-r${restartIndex}`
    const name = validateWorldName(`${WORLD_PREFIX}${line}-${utcStamp()}${suffix}`)
    const home = homeDir(this.repoRoot, name)
    if (existsSync(home) || lstatSafe(home) !== null) {
      throw new Error(`world home path already exists or is a symlink: ${home}`)
    }
    const lockPath = `${home}.lock`
    if (lstatSafe(lockPath) !== null) throw new Error(`world lock exists (TEST_METHODS §7): ${lockPath}`)
    const id = name
    const workspaceDir = join(home, 'workspace')
    const logDir = join(this.evidenceRoot, 'logs', id)
    mkdirSync(this.evidenceRoot, { recursive: true })
    mkdirSync(logDir, { recursive: true })
    mkdirSync(join(home, 'profiles', 'web'), { recursive: true })
    mkdirSync(workspaceDir, { recursive: true })
    // Ownership marker FIRST: everything deletable below this World's cleanup
    // must be listed here. Only the home tree is auto-deleted; evidence logs
    // are deliberately KEPT (they are the run record).
    writeFileSync(join(home, '.u5-created.json'), JSON.stringify({
      worldId: id,
      createdBy: process.pid,
      createdAt: new Date().toISOString(),
      paths: { home, workspaceDir, logDir: 'kept-as-evidence (never auto-deleted)' },
    }, null, 2) + '\n')

    const world = new TestWorld(this, { id, name, home, workspaceDir, logDir, visible, badMount, restartIndex, extContributors })
    this.worlds.push(world)
    return world
  }
}

function lstatSafe(path) {
  try {
    return lstatSync(path)
  } catch {
    return null
  }
}

/**
 * One exclusive World. Boot phases are explicit methods; the runner (which
 * owns the run-control binding) sequences them.
 */
export class TestWorld {
  /** @param {TestWorldFactory} factory @param {object} spec */
  constructor(factory, spec) {
    this.factory = factory
    this.id = spec.id
    this.name = spec.name
    this.home = spec.home
    this.workspaceDir = spec.workspaceDir
    this.logDir = spec.logDir
    this.visible = spec.visible
    this.badMount = spec.badMount
    this.extContributors = spec.extContributors ?? 'disable'
    this.restartIndex = spec.restartIndex
    this.markerDir = join(spec.workspaceDir, 'markers')
    this.ledgerPath = join(spec.home, 'canary-ledger.jsonl')
    this.instance = null
    this.mock = null
    this.hostLease = null
    this.mockLease = null
    this.token = undefined
    this.tornDown = null
    this.receipts = { booted: [], killedPids: [], releasedPorts: [], homeDeleted: null, notes: [] }
  }

  /** Write/refresh the ownership ledger (runner + host pids, ports). */
  #writeOwnership(extra = {}) {
    const path = join(this.home, '.u5-ownership.json')
    let prev = {}
    try {
      prev = JSON.parse(readFileSync(path, 'utf8'))
    } catch {
      prev = {}
    }
    writeFileSync(path, JSON.stringify({
      ...prev,
      worldId: this.id,
      runnerPid: process.pid,
      runnerStartedAt: prev.runnerStartedAt ?? new Date().toISOString(),
      ...extra,
    }, null, 2) + '\n')
    return path
  }

  /** Lease the mock-provider port (3491-3500 block) and start the in-proc mock. */
  async startMock({ decide }) {
    const lease = await acquireFirstFreeLease({
      leaseRoot: this.factory.leaseRoot,
      world: this.id,
      purpose: 'mock-provider',
      include: range(3491, 3500),
      preferred: [],
    })
    this.mockLease = lease
    this.mock = await startMockModel({ port: lease.port, decide, log: () => {} })
    lease.note({ mockListeningOn: this.mock.port })
    return { port: this.mock.port }
  }

  /**
   * What the mock provider has actually SEEN (every request, even unrouted
   * ones). The single most useful diagnostic: did the host contact its
   * injected provider at all, on which route, and which tools were visible?
   */
  mockRequestDigest() {
    if (this.mock === null) return []
    return this.mock.requests.map((r) => ({
      seq: r.seq,
      path: r.path,
      status: r.status,
      mockError: r.error ?? null,
      model: r.body?.model ?? null,
      stream: r.body?.stream ?? null,
      toolNames: Array.isArray(r.body?.tools) ? r.body.tools.map((t) => t?.function?.name ?? t?.name ?? '?') : null,
      nMessages: Array.isArray(r.body?.messages) ? r.body.messages.length : Array.isArray(r.body?.input) ? r.body.input.length : null,
      replyKind: r.reply?.kind ?? null,
    }))
  }

  /** The canary ledger as seen on disk (register evidence after boot). */
  ledgerRows() {
    try {
      return readFileSync(this.ledgerPath, 'utf8')
        .split('\n')
        .filter((l) => l.trim() !== '')
        .map((l) => {
          try {
            return JSON.parse(l)
          } catch {
            return { leg: 'UNPARSEABLE', raw: l.slice(0, 120) }
          }
        })
    } catch {
      return null // file absent: mounted-but-never-loaded is itself evidence
    }
  }

  /**
   * Boot the Host for this World through the SHARED launcher (DshInstance).
   * The caller binds world.child into its run-control BEFORE awaiting (same
   * proven capture pattern as s1-h0-m1: start() spawns before its first await).
   */
  async startHost({ bootTimeoutMs = 90_000 } = {}) {
    let lease = this.hostLease
    if (lease === null) {
      lease = await acquireFirstFreeLease({
        leaseRoot: this.factory.leaseRoot,
        world: this.id,
        purpose: 'host',
        include: range(3180, 3186),
        preferred: [],
      })
      this.hostLease = lease
    }
    // Reboot on a held lease: the holder is us (restart leg keeps the port).
    // Provider env: injected into process.env (DshInstance spreads it).
    if (this.mock === null) throw new Error('startMock before startHost (provider env)')
    process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${this.mock.port}`
    process.env.DEEPSEEK_API_KEY = 'u5-fake-key'
    process.env.U5_CANARY_LEDGER = this.ledgerPath
    process.env.U5_CANARY_MARKER_DIR = this.markerDir
    process.env.U5_CANARY_VISIBLE = this.visible ? '1' : '0'
    process.env.U5_CANARY_WORLD = this.id

    this.instance = new DshInstance({
      hostTree: this.factory.hostTree,
      dshHome: this.home,
      port: lease.port,
      clientCommitHash: CLIENT_COMMIT_HASH,
      logDir: this.logDir,
    })
    // Public seam mount: one plugin row beside the patch file (never the
    // pristine tree). badMount variants = start-failure controls:
    //   true/'missing-file' — row whose plugin file does not exist.
    //     (MEASURED n1: rc2 BOOTS ANYWAY — a missing file is a soft mount
    //      error; that control was demoted to an observation.)
    //   'corrupt-patch' — the patch layer itself is unparseable YAML: the
    //     profile cannot compose, the boot must fail (hard config error).
    if (this.badMount === true || this.badMount === 'missing-file') {
      // deliberately DO NOT copy the plugin file
    } else {
      copyFileSync(CANARY_PLUGIN_SRC, join(this.instance.profileDir, 'u5-canary-plugin.mjs'))
    }
    this.instance.mountRows(
      [{ id: CANARY_ROW_ID, name: './u5-canary-plugin.mjs' }],
      ['U5 canary World — one test-only plugin row via the public profile-patch seam.'],
    )
    if (this.extContributors !== 'keep') {
      // Public profile-patch composition (see EXT_CONTRIBUTOR_DISABLE header).
      appendFileSync(this.instance.patchFile, EXT_CONTRIBUTOR_DISABLE)
    }
    if (this.badMount === 'corrupt-patch') {
      appendFileSync(this.instance.patchFile, '\n- insert: [[{unparseable\n  :::\n\t- "broken\n')
    }
    const startPromise = this.instance.start({ timeoutMs: bootTimeoutMs })
    const child = this.instance.child // captured BEFORE the first await
    this.#writeOwnership({ hostPid: child?.pid ?? null, hostPort: lease.port, mockPort: this.mock?.port ?? null })
    lease.note({ hostPid: child?.pid ?? null })
    const booted = await startPromise
    this.token = new URL(booted.url).searchParams.get('token') ?? undefined
    this.receipts.booted.push({ at: new Date().toISOString(), port: lease.port, tokenFingerprint: this.token === undefined ? 'absent' : sha256Text(this.token).slice(0, 8) })
    return { url: booted.url, redacted: redactLaunchToken(booted.url), port: lease.port, logPath: booted.logPath, child }
  }

  /**
   * Stop the host: SIGTERM the OWNED child, escalate, wait for the port.
   * DshInstance.stop() kills exactly the child we spawned — never a pattern
   * or a port scan. The caller (runner) may prefer run-control.stopChild; both
   * act on the same single owned child, stopChild taking precedence when bound.
   */
  async stopHost({ graceMs = 15_000 } = {}) {
    const pid = this.instance?.child?.pid ?? null
    if (this.instance === null) return { wasRunning: false }
    const stop = this.instance.stop({ timeoutMs: graceMs })
    const result = await stop
    if (pid !== null) this.receipts.killedPids.push({ pid, at: new Date().toISOString(), ...result })
    if (!result.portFree) {
      // One bounded SIGKILL of the SAME owned pid (never another), then re-probe.
      try {
        this.instance.child?.kill('SIGKILL')
      } catch {
        /* already gone */
      }
    }
    const portFree = await waitForPortFree(this.hostLease?.port ?? 0, 15_000)
    if (!portFree) this.receipts.notes.push(`host port ${String(this.hostLease?.port)} still busy after owned-pid kill`)
    else this.receipts.releasedPorts.push(this.hostLease?.port)
    this.instance = null
    return { wasRunning: true, pid, ...result, portFree }
  }

  /** Stop the mock + release its lease. */
  async stopMock() {
    if (this.mock !== null) {
      const m = this.mock
      this.mock = null
      try {
        await Promise.race([m.close(), new Promise((_, rej) => setTimeout(() => rej(new Error(`TIMEOUT mock.close`)), 10_000))])
      } catch (error) {
        this.receipts.notes.push(`mock.close: ${String(error?.message ?? error)} (in-proc mock dies with the runner)`)
      }
    }
    if (this.mockLease !== null) {
      releasePortLease(this.mockLease.leasePath, process.pid)
      this.receipts.releasedPorts.push(this.mockLease.port)
      this.mockLease = null
    }
  }

  /**
   * Full teardown: stop everything owned, release leases, delete ONLY the
   * home we created (ownership-marker checked). Never touches:
   *   - any pid not recorded in .u5-ownership.json (and verified on Linux),
   *   - any path not under `home` / not created by this World,
   *   - the evidence logs (kept), the Host base (read-only), :3080.
   */
  async teardown({ keepHome = false } = {}) {
    if (this.tornDown !== null) return this.tornDown // idempotent: per-case + suite-finally both call
    const host = await this.stopHost()
    await this.stopMock()
    if (this.hostLease !== null) {
      releasePortLease(this.hostLease.leasePath, process.pid)
      this.receipts.releasedPorts.push(this.hostLease.port)
      this.hostLease = null
    }
    let homeDeleted = null
    if (keepHome) {
      this.receipts.notes.push(`home kept as evidence: ${this.home}`)
    } else if (deleteWorldHomeIfMarked(this.home, this.id)) {
      homeDeleted = this.home
    } else {
      this.receipts.notes.push(`home NOT deleted (ownership marker missing/mismatched — refusing): ${this.home}`)
    }
    this.receipts.homeDeleted = homeDeleted
    this.tornDown = { host, homeDeleted, releasedPorts: [...this.receipts.releasedPorts], killedPids: this.receipts.killedPids.map((k) => k.pid), notes: this.receipts.notes }
    return this.tornDown
  }
}

/**
 * Delete a World home iff `.u5-created.json` inside it exists, parses, and
 * names exactly this world id. Anything else REFUSES (returns false) — a path
 * this World did not create is never removed.
 */
export function deleteWorldHomeIfMarked(home, worldId) {
  try {
    const marker = JSON.parse(readFileSync(join(home, '.u5-created.json'), 'utf8'))
    if (marker?.worldId !== worldId) return false
  } catch {
    return false
  }
  try {
    rmSync(home, { recursive: true, force: true })
    return true
  } catch {
    return false
  }
}

/**
 * Crash recovery for a World whose RUNNER died (SIGKILLed mid-run):
 *  - kill the recorded host pid ONLY if (a) it is listed in the home's
 *    .u5-ownership.json, (b) it is alive, and (c) Linux /proc verification
 *    shows it carries DSH_HOME == this home (pid-recycling guard);
 *  - release the dead holder's leases (pid in lease file is dead);
 *  - delete the home through the ownership marker.
 * Windows: process-TREE cleanup beyond the recorded direct pid is NOT
 * implemented — the caller must record ENV_BLOCK for descendant cleanup
 * (TEST_METHODS / plan U5: 需要 Windows 的完整子进程树清理时单独 ENV_BLOCK).
 * @returns {Promise<{killed:number[], refused:number[], leasesReleased:number[], homeDeleted:string|null}>}
 */
export async function reclaimWorld({ home, worldId, leasePaths = [] }) {
  const out = { killed: [], refused: [], leasesReleased: [], homeDeleted: null }
  let ownership = null
  try {
    ownership = JSON.parse(readFileSync(join(home, '.u5-ownership.json'), 'utf8'))
  } catch {
    ownership = null
  }
  if (ownership !== null) {
    for (const pid of [ownership.hostPid, ownership.runnerPid]) {
      if (!Number.isInteger(pid) || pid === process.pid) continue
      if (!pidAlive(pid)) continue
      if (ownedPidMatchesHome(pid, home)) {
        try {
          process.kill(pid, 'SIGKILL')
          out.killed.push(pid)
        } catch {
          out.refused.push(pid)
        }
      } else {
        // Recorded but NOT verifiable as ours (pid recycled / foreign): never kill.
        out.refused.push(pid)
      }
    }
  }
  for (const { path, port } of leasePaths) {
    try {
      releasePortLease(path, Number.POSITIVE_INFINITY) // owner-mismatch guard inside; stale already proven
      out.leasesReleased.push(port)
    } catch {
      /* still-held: somebody re-leased it live */
    }
  }
  // Ports proven-free check (bounded): a reclaimed host port should idle.
  for (const port of out.leasesReleased) {
    if (await portInUse(port)) out.refused.push(`port:${port}`)
  }
  if (deleteWorldHomeIfMarked(home, worldId)) out.homeDeleted = home
  return out
}

function range(lo, hi) {
  const out = []
  for (let p = lo; p <= hi; p += 1) out.push(p)
  return out
}

/** Raw-log tail helper re-export (keeps the runner imports in one place). */
export { logTail }

/**
 * Minimal fetch helpers for the public HTTP session surface (same shapes the
 * a5p1/s1-h0-m1 clients use — public /api/session/* remotes only).
 */
export async function fetchJson(url, init, timeoutMs = 60_000, signal = undefined) {
  const local = AbortSignal.timeout(timeoutMs)
  const combined = signal === undefined ? local : AbortSignal.any([signal, local])
  const res = await fetch(url, { ...init, signal: combined }).catch((e) => ({ status: 0, error: e?.message }))
  const body = res.status === 0 ? null : await res.json().catch(() => null)
  return { status: res.status, body, error: res.error }
}

export async function authenticate(origin, token, signal = undefined) {
  const local = AbortSignal.timeout(30_000)
  const combined = signal === undefined ? local : AbortSignal.any([signal, local])
  const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: combined })
  const setCookie = res.headers.get('set-cookie')
  if (res.status !== 303 || setCookie === null) throw new Error(`authentication returned ${String(res.status)} (expected 303 + set-cookie)`)
  return setCookie.split(';', 1)[0]
}

function rpcEnvelope(method, request, tag) {
  return {
    type: 'client-request',
    rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
    method,
    payload: { args: { request } },
  }
}

export function apiSessionCreate(origin, cookie, cwd, tag = 'u5', signal = undefined) {
  return fetchJson(`${origin}/api/session/create`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(rpcEnvelope('session/create', { cwd }, tag)),
  }, 60_000, signal)
}

export function apiPrompt(origin, cookie, sessionId, text, tag = 'u5', signal = undefined) {
  return fetchJson(`${origin}/api/session/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(rpcEnvelope('session/prompt', {
      requestId: `${tag}-r-${Math.random().toString(36).slice(2, 10)}`,
      sessionId,
      mode: 'queue',
      content: [{ type: 'text', text }],
    }, tag)),
  }, 60_000, signal)
}

export function apiSessionCancel(origin, cookie, sessionId, tag = 'u5', signal = undefined) {
  return fetchJson(`${origin}/api/session/cancel`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(rpcEnvelope('session/cancel', { sessionId }, tag)),
  }, 30_000, signal)
}

/** One-shot TCP probe re-export for leak checks. */
export function tcpConnectProbe(port, timeoutMs = 1200) {
  return new Promise((done) => {
    const socket = createConnection({ port, host: '127.0.0.1' })
    let settled = false
    const finish = (v) => {
      if (settled) return
      settled = true
      socket.destroy()
      done(v)
    }
    socket.once('connect', () => finish(true))
    socket.once('error', () => finish(false))
    setTimeout(() => finish(true), timeoutMs)
  })
}

/** Read the canary ledger rows (written by the plugin inside the HOST process — an independent observation channel from the tool RESULT). */
export function readLedger(path) {
  if (!existsSync(path)) return []
  const rows = []
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (line.trim() === '') continue
    try {
      rows.push(JSON.parse(line))
    } catch {
      rows.push({ leg: 'UNPARSEABLE', raw: line.slice(0, 200) })
    }
  }
  return rows
}
