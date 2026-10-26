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
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { CLIENT_COMMIT_HASH, homeDir, STABLE_INSTANCE_PORT, TEST_USE_BASELINE_SHA, testUseTree } from '../../paths.mjs'
import { DshInstance, redactLaunchToken } from '../../characterization/lib/instance.mjs'
import { logTail, portInUse, waitForPortFree } from '../../characterization/lib/util.mjs'
import { startMockModel } from '../../../packages/tools/harness/mock-deepseek.mjs'
import { acquireFirstFreeLease, pidAlive, reclaimStaleLease, sweepLegacyLease } from './port-lease.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
/** The canary plugin fixture that gets mounted into every World. */
export const CANARY_PLUGIN_SRC = resolve(HERE, '..', 'canary', 'u5-canary-plugin.mjs')
/** Byte-capped ledger appender shipped beside every mounted World row (FIX-T T3). */
export const LEDGER_CAP_SRC = resolve(HERE, '..', 'canary', 'ledger-cap.mjs')
export const CANARY_ROW_ID = 'u5-canary'
export const CANARY_TOOL_NAME = 'u5_canary'
export const WORLD_PREFIX = 'u5'
/**
 * U6 PR1 shadow-parity support: the test-only row that mounts the PRODUCT
 * shadow row (`packages/runtime/src/plugin/live/center-shadow-row.mjs`, from
 * its DIST face) over the plugin-fiber context — the same public-seam shape
 * the sealed sup-a `g1fa-center` fixture proved on this Host. Mounted ONLY
 * when a World is created with `centerAssembly: 'off' | 'shadow'`; both
 * worlds of the parity run mount the SAME row (the OFF world's row installs
 * nothing and records `center-skipped`), so the only delta between the two
 * Worlds is the shadow assembly itself.
 */
export const U6_SHADOW_HOST_SRC = resolve(HERE, '..', 'canary', 'u6-shadow-host.mjs')
export const U6_SHADOW_ROW_ID = 'u6-shadow-host'
/**
 * U6 PR2 C2 (`u6-fs` suite): the probe row the factory mounts when a World is
 * created with `u6Fs` set. It observes the governed `read` lane and performs
 * the identity-swap / re-registration-window PLANTS on command (never
 * spontaneously); its ledger/markers are evidence channels independent of the
 * model transcript. See the file's header for the measured mount law.
 */
export const U6FS_PROBE_SRC = resolve(HERE, '..', 'canary', 'u6-fs-probe-host.mjs')
export const U6FS_PROBE_ROW_ID = 'u6-fs-probe-host'
/**
 * U6 PR3 C2 (`u6-proc` suite): the mirror of the PR2 probe for the governed
 * SHELL lane (`team_bash`) — same measured mount law, same public seam, its
 * own ledger/markers. Observes team_bash calls/results and performs the
 * swap/restore plants plus the guard-off positive CHANNEL on command.
 */
export const U6PROC_PROBE_SRC = resolve(HERE, '..', 'canary', 'u6-proc-probe-host.mjs')
export const U6PROC_PROBE_ROW_ID = 'u6-proc-probe-host'
/** U6 PR5 ARC-A: the probe-family row + the lane's public assembly module
 *  (the HOST resolves it through this file URL; the lane resolves ITS two
 *  public seams at the dist faces via U6ARC_CENTER_URL / U6ARC_CONTRACTS_URL
 *  — set below, the exact files the shipped glue imports). */
export const U6ARCA_PROBE_SRC = resolve(HERE, '..', 'canary', 'u6-arc-a-probe-host.mjs')
export const U6ARCA_PROBE_ROW_ID = 'u6-arc-a-probe-host'
/** U6 PR6 ARC-D: the ADVERSARIAL probe row. It mounts the PR5 probe FAMILY
 *  unchanged (zero new family code is the claim) through the same lane
 *  assembly URL; the row bridges U6ARCD_CENTER_URL / U6ARCD_CONTRACTS_URL
 *  onto the U6ARC_* names the family actually reads — the same shipped dist
 *  faces the u6ArcA block below pins. */
export const U6ARCD_PROBE_SRC = resolve(HERE, '..', 'canary', 'u6-arc-d-probe-host.mjs')
/** U7-0 (EB2-A): the ObservedRuntimeInventory census row + its seam faces. */
export const U7C_PROBE_SRC = resolve(HERE, '..', 'canary', 'u7-census-probe-host.mjs')
export const U7C_PROBE_ROW_ID = 'u7-census-probe'
export const U6ARCD_PROBE_ROW_ID = 'u6-arc-d-probe-host'
export const U6_CENTER_SHADOW_ROW_REL = 'packages/runtime/dist/packages/runtime/src/plugin/live/center-shadow-row.mjs'
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
   * @param {'off'|'shadow'|null} [spec.centerAssembly] U6 PR1 shadow-parity:
   *        mount the `u6-shadow-host` row (identically in BOTH modes; only
   *        'shadow' installs the center-assembly row) and pass the U6_* env
   * @param {{rows: Array<{id: string, name: string, config?: object}>}} [spec.u6Fs]
   *        U6 PR2 C2: mount the `u6-fs-probe-host` row and compose the extra
   *        patch rows (production Team row + presets — rows carrying
   *        `config:`, which the plain mountRows cannot express) into the SAME
   *        `- insert:` layer; sets U6FS_* env for the probe before spawn.
   */
  /**
   * @param {{rows: Array<{id: string, name: string, config?: object}>}} [spec.u6Proc]
   *        U6 PR3 C2: mount the `u6-proc-probe-host` row and compose the
   *        extra patch rows into the SAME `- insert:` layer; sets U6PROC_*
   *        env for the probe before spawn. Mutually exclusive with u6Fs.
   * @param {{rows: Array<{id: string, name: string, config?: object}>}} [spec.u6Jobs]
   *        U6 PR4 C2: compose the jobs-World rows (production Team row with
   *        the closed jobsEnabled key ON) into the SAME `- insert:` layer.
   *        No probe row: the production bridge IS the subject. Mutually
   *        exclusive with u6Fs and u6Proc.
   * @param {{rows: Array<{id: string, name: string, config?: object}>}} [spec.u6ArcD]
   *        U6 PR6 C2: mount the `u6-arc-d-probe-host` row (the PR5 probe
   *        FAMILY attacked as shipped — zero new family code) and compose
   *        the extra patch rows into the SAME `- insert:` layer; sets
   *        U6ARCD_* env for the probe before spawn. Mutually exclusive with
   *        u6Fs / u6Proc / u6Jobs / u6ArcA.
   * @param {{rows: Array<{id: string, name: string, config?: object}>}} [spec.u7FsMut]
   *        U7-9a C2: NO probe row — the governed FS-family mutation rows
   *        live on the PRODUCTION kernel; verdicts ride the runner's own
   *        disk reads + host-log witnesses. Mutually exclusive with the
   *        other suite specs.
   */
  async createWorld({ line, visible = true, badMount = false, restartIndex = null, extContributors = 'disable', centerAssembly = null, u6Fs = null, u6Proc = null, u6Jobs = null, u6ArcA = null, u6ArcD = null, u7Census = null, u7FsMut = null }) {
    if (typeof line !== 'string' || !/^[a-z0-9-]{1,24}$/.test(line)) throw new Error(`invalid world line: ${JSON.stringify(line)}`)
    if (centerAssembly !== null && centerAssembly !== 'off' && centerAssembly !== 'shadow') {
      throw new Error(`invalid centerAssembly: ${JSON.stringify(centerAssembly)} (expected 'off' | 'shadow' | null)`)
    }
    if (u6Fs !== null && !(typeof u6Fs === 'object' && Array.isArray(u6Fs.rows))) {
      throw new Error('invalid u6Fs (expected {rows: [...]} | null)')
    }
    if (u6Proc !== null && !(typeof u6Proc === 'object' && Array.isArray(u6Proc.rows))) {
      throw new Error('invalid u6Proc (expected {rows: [...]} | null)')
    }
    if (u6Jobs !== null && !(typeof u6Jobs === 'object' && Array.isArray(u6Jobs.rows))) {
      throw new Error('invalid u6Jobs (expected {rows: [...]} | null)')
    }
    if (u6ArcA !== null && !(typeof u6ArcA === 'object' && Array.isArray(u6ArcA.rows))) {
      throw new Error('invalid u6ArcA (expected {rows: [...]} | null)')
    }
    if (u6ArcD !== null && !(typeof u6ArcD === 'object' && Array.isArray(u6ArcD.rows))) {
      throw new Error('invalid u6ArcD (expected {rows: [...]} | null)')
    }
    if (u7Census !== null && !(typeof u7Census === 'object' && Array.isArray(u7Census.rows))) {
      throw new Error('invalid u7Census (expected {rows: [...]} | null)')
    }
    if (u7FsMut !== null && !(typeof u7FsMut === 'object' && Array.isArray(u7FsMut.rows))) {
      throw new Error('invalid u7FsMut (expected {rows: [...]} | null)')
    }
    if ([u6Fs, u6Proc, u6Jobs, u6ArcA, u6ArcD, u7Census, u7FsMut].filter((x) => x !== null).length > 1) {
      // both patch-layer owners would race for the SAME profile patch file;
      // the suites are disjoint by law — one World belongs to one suite.
      throw new Error('invalid world spec: u6Fs / u6Proc / u6Jobs / u6ArcA / u6ArcD / u7Census / u7FsMut are mutually exclusive Worlds')
    }
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

    const world = new TestWorld(this, { id, name, home, workspaceDir, logDir, visible, badMount, restartIndex, extContributors, centerAssembly, u6Fs, u6Proc, u6Jobs, u6ArcA, u6ArcD, u7Census, u7FsMut })
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

/** JSONL reader for in-home ledger files (null = file absent: mounted-but-
 *  never-loaded is itself evidence). */
/**
 * Minimal YAML emitter for the profile-patch layer: one `- insert:` list item
 * carrying rows {id, name, config?}. Scalars are JSON scalars (valid YAML
 * flow scalars for the string/number/boolean/null shapes the patch uses);
 * nesting covers the Team row `config` object (maps, string lists, empty
 * map/list). The a5p1 kit emits the identical shape through the same seam.
 */
function yamlScalar(v) { return v === null ? 'null' : typeof v === 'string' ? JSON.stringify(v) : String(v) }
function yamlEmit(key, value, indent) {
  const pad = '  '.repeat(indent)
  if (value !== null && typeof value === 'object') {
    const empty = Array.isArray(value) ? value.length === 0 : Object.keys(value).length === 0
    if (empty) return [`${pad}${key}: ${Array.isArray(value) ? '[]' : '{}'}`]
    if (Array.isArray(value)) {
      const lines = [`${pad}${key}:`]
      for (const item of value) {
        if (item !== null && typeof item === 'object') {
          const inner = Object.entries(item).flatMap(([k, v]) => yamlEmit(k, v, indent + 2))
          lines.push(`${pad}  - ${inner[0].trimStart()}`, ...inner.slice(1))
        } else {
          lines.push(`${pad}  - ${yamlScalar(item)}`)
        }
      }
      return lines
    }
    return [`${pad}${key}:`, ...Object.entries(value).flatMap(([k, v]) => yamlEmit(k, v, indent + 1))]
  }
  return [`${pad}${key}: ${yamlScalar(value)}`]
}
export function emitPatchLayer(headerLines, rows) {
  const lines = [...(headerLines ?? []).map((l) => `# ${l}`), '- insert:']
  for (const row of rows) {
    // item keys align at column 6 (the '- ' sits at column 4) — indent 3.
    const inner = Object.entries(row).flatMap(([k, v]) => yamlEmit(k, v, 3))
    lines.push(`    - ${inner[0].trimStart()}`, ...inner.slice(1))
  }
  return lines.join('\n')
}

function rowsFrom(path) {
  try {
    return readFileSync(path, 'utf8')
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
    this.centerAssembly = spec.centerAssembly ?? null
    this.u6Fs = spec.u6Fs ?? null
    this.u6Proc = spec.u6Proc ?? null
    this.u6Jobs = spec.u6Jobs ?? null
    this.u6ArcA = spec.u6ArcA ?? null
    this.u6ArcD = spec.u6ArcD ?? null
    this.u7Census = spec.u7Census ?? null
    this.u7cLedgerPath = join(spec.home, 'u7c-census-ledger.jsonl')
    this.u7FsMut = spec.u7FsMut ?? null
    this.restartIndex = spec.restartIndex
    this.markerDir = join(spec.workspaceDir, 'markers')
    this.ledgerPath = join(spec.home, 'canary-ledger.jsonl')
    this.shadowLedgerPath = join(spec.home, 'center-shadow-ledger.jsonl')
    this.u6fsLedgerPath = join(spec.home, 'u6fs-probe-ledger.jsonl')
    this.u6fsMarkerDir = join(spec.workspaceDir, 'u6fs-markers')
    this.u6procLedgerPath = join(spec.home, 'u6proc-probe-ledger.jsonl')
    this.u6procMarkerDir = join(spec.workspaceDir, 'u6proc-markers')
    this.u6arcaLedgerPath = join(spec.home, 'u6arca-probe-ledger.jsonl')
    this.u6arcaMarkerDir = join(spec.workspaceDir, 'u6arca-markers')
    this.u6arcdLedgerPath = join(spec.home, 'u6arcd-probe-ledger.jsonl')
    this.u6arcdMarkerDir = join(spec.workspaceDir, 'u6arcd-markers')
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
    return rowsFrom(this.ledgerPath)
  }

  /** U6 PR1 shadow-parity: the audit-only shadow ledger of this World. */
  shadowLedgerRows() {
    return rowsFrom(this.shadowLedgerPath)
  }

  /** U6 PR2 C2: the probe row's ledger (null = the probe never recorded). */
  u6fsLedgerRows() {
    return rowsFrom(this.u6fsLedgerPath)
  }
  u6procLedgerRows() {
    return rowsFrom(this.u6procLedgerPath)
  }

  u6arcaLedgerRows() {
    return rowsFrom(this.u6arcaLedgerPath)
  }

  u6arcdLedgerRows() {
    return rowsFrom(this.u6arcdLedgerPath)
  }

  /**
   * Boot the Host for this World through the SHARED launcher (DshInstance).
   * The caller binds world.child into its run-control BEFORE awaiting (same
   * proven capture pattern as s1-h0-m1: start() spawns before its first await).
   */
  async startHost({ bootTimeoutMs = 90_000 } = {}) {
    // FIX-T T3 (owned paths only): every ledger/marker the canary or the
    // shadow row appends to INSIDE the host process must sit inside this
    // World's owned home — a future edit that re-points one of these paths
    // fails HERE instead of silently writing outside the World's ownership.
    // (The instance log under <evidenceRoot>/logs is launcher stdout kept as
    // RUN evidence — a disclosed, runner-owned path, byte-capped at the
    // supervisor; it is not a World ledger and is not env-reachable.)
    for (const [what, p] of [['ledgerPath', this.ledgerPath], ['markerDir', this.markerDir], ['shadowLedgerPath', this.shadowLedgerPath ?? null]]) {
      if (p === null || p === undefined) continue
      if (p !== this.home && !p.startsWith(this.home + sep)) {
        throw new Error(`World ${this.id}: ${what} escapes the owned home (${this.home}): ${p}`)
      }
    }
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
    // U6 PR1 shadow-parity env (set on EVERY boot of a centerAssembly World;
    // DshInstance spreads process.env into the child).
    const shadowWorld = this.centerAssembly === 'off' || this.centerAssembly === 'shadow'
    if (shadowWorld) {
      process.env.U6_CENTER_ASSEMBLY = this.centerAssembly
      process.env.U6_CENTER_ROW_URL = pathToFileURL(join(this.factory.repoRoot, U6_CENTER_SHADOW_ROW_REL)).href
      process.env.U6_CENTER_SHADOW_LEDGER = this.shadowLedgerPath
    } else {
      delete process.env.U6_CENTER_ASSEMBLY
      delete process.env.U6_CENTER_ROW_URL
      delete process.env.U6_CENTER_SHADOW_LEDGER
    }
    // U6 PR2 C2 probe env (only on u6Fs Worlds; the probe row is mounted by
    // the patch composition below — env names the ledger/markers it writes).
    if (this.u6Fs !== null) {
      process.env.U6FS_LEDGER = this.u6fsLedgerPath
      process.env.U6FS_MARKER_DIR = this.u6fsMarkerDir
      process.env.U6FS_WORLD = this.id
    } else {
      delete process.env.U6FS_LEDGER
      delete process.env.U6FS_MARKER_DIR
      delete process.env.U6FS_WORLD
    }
    // U6 PR3 C2 probe env (mirror of the U6FS_* block above).
    if (this.u6Proc !== null) {
      process.env.U6PROC_LEDGER = this.u6procLedgerPath
      process.env.U6PROC_MARKER_DIR = this.u6procMarkerDir
      process.env.U6PROC_WORLD = this.id
    } else {
      delete process.env.U6PROC_LEDGER
      delete process.env.U6PROC_MARKER_DIR
      delete process.env.U6PROC_WORLD
    }
    // U6 PR5 ARC-A C2 env (mirror of the U6FS/U6PROC blocks). The three
    // *_URL names are the lane's seam-override law: on the HOST they point
    // at the SHIPPED dist faces; the vitest world leaves them unset and the
    // lane resolves the repo TS sources.
    if (this.u6ArcA !== null) {
      process.env.U6ARC_LEDGER = this.u6arcaLedgerPath
      process.env.U6ARC_MARKER_DIR = this.u6arcaMarkerDir
      process.env.U6ARC_WORLD = this.id
      process.env.U6ARC_ASSEMBLY_URL = pathToFileURL(join(this.factory.repoRoot, 'tests', 'u6-arc-a-probe-family', 'src', 'probe-assembly.mjs')).href
      process.env.U6ARC_CENTER_URL = pathToFileURL(join(this.factory.repoRoot, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'governance-center', 'index.js')).href
      process.env.U6ARC_CONTRACTS_URL = pathToFileURL(join(this.factory.repoRoot, 'packages', 'runtime', 'dist', 'packages', 'contracts', 'src', 'index.js')).href
    } else {
      for (const k of ['U6ARC_LEDGER', 'U6ARC_MARKER_DIR', 'U6ARC_WORLD', 'U6ARC_ASSEMBLY_URL', 'U6ARC_CENTER_URL', 'U6ARC_CONTRACTS_URL']) delete process.env[k]
    }
    // U6 PR6 ARC-D C2 env (mirror of the U6ARC block). The row reads its own
    // U6ARCD_* names; the PR5 FAMILY it mounts resolves its two public seams
    // under U6ARC_CENTER_URL / U6ARC_CONTRACTS_URL — the u6ArcA block above
    // just cleared those when this is not an ARC-A World (the two are
    // mutually exclusive), so this block re-pins them to the SAME shipped
    // dist faces the production glue imports. Both spellings, one truth.
    if (this.u6ArcD !== null) {
      process.env.U6ARCD_LEDGER = this.u6arcdLedgerPath
      process.env.U6ARCD_MARKER_DIR = this.u6arcdMarkerDir
      process.env.U6ARCD_WORLD = this.id
      process.env.U6ARCD_ASSEMBLY_URL = pathToFileURL(join(this.factory.repoRoot, 'tests', 'u6-arc-a-probe-family', 'src', 'probe-assembly.mjs')).href
      process.env.U6ARCD_CENTER_URL = pathToFileURL(join(this.factory.repoRoot, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'governance-center', 'index.js')).href
      process.env.U6ARCD_CONTRACTS_URL = pathToFileURL(join(this.factory.repoRoot, 'packages', 'runtime', 'dist', 'packages', 'contracts', 'src', 'index.js')).href
      process.env.U6ARC_CENTER_URL = process.env.U6ARCD_CENTER_URL
      process.env.U6ARC_CONTRACTS_URL = process.env.U6ARCD_CONTRACTS_URL
    } else {
      for (const k of ['U6ARCD_LEDGER', 'U6ARCD_MARKER_DIR', 'U6ARCD_WORLD', 'U6ARCD_ASSEMBLY_URL', 'U6ARCD_CENTER_URL', 'U6ARCD_CONTRACTS_URL']) delete process.env[k]
    }
    // U7-0 (EB2-A) census env: the row resolves the ONE identity minter at
    // its DIST face (the same file the production glue imports) and the ONE
    // canonical-digest module the offline reconciler uses — probe and
    // reconciler can never disagree by drifting implementations.
    if (this.u7Census !== null) {
      process.env.U7C_LEDGER = this.u7cLedgerPath
      process.env.U7C_WORLD = this.id
      process.env.U7C_BOOT_ID = this.restartIndex === null ? 'boot-1' : `boot-r${String(this.restartIndex)}`
      process.env.U7C_TD_URL = pathToFileURL(join(this.factory.repoRoot, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'tool-dispatch', 'index.js')).href
      process.env.U7C_CANON_URL = pathToFileURL(join(this.factory.repoRoot, 'packages', 'testkit', 'census', 'json-canonical.mjs')).href
      process.env.U7C_AUTO_SNAPSHOT_MS = (this.u7Census.autoSnapshotMs ?? []).map((n) => String(Math.trunc(Number(n)))).filter((s) => /^-?\d+$/.test(s)).join(',')
    } else {
      for (const k of ['U7C_LEDGER', 'U7C_WORLD', 'U7C_BOOT_ID', 'U7C_TD_URL', 'U7C_CANON_URL', 'U7C_AUTO_SNAPSHOT_MS']) delete process.env[k]
    }

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
    // FIX-T T3: both World-side rows append through the byte-capped ledger
    // helper — copy it beside them so './ledger-cap.mjs' resolves in the
    // mounted profile exactly as it does in the repo tree.
    copyFileSync(LEDGER_CAP_SRC, join(this.instance.profileDir, 'ledger-cap.mjs'))
    const rows = [{ id: CANARY_ROW_ID, name: './u5-canary-plugin.mjs' }]
    if (shadowWorld) {
      // U6 PR1 shadow-parity: the SAME test row mounts in BOTH worlds; the
      // row itself installs the product shadow assembly only when
      // U6_CENTER_ASSEMBLY='shadow' (the OFF world records `center-skipped`
      // and installs nothing). The product row is imported from the DIST
      // face — the exact file the shipped glue's dynamic import resolves to.
      copyFileSync(U6_SHADOW_HOST_SRC, join(this.instance.profileDir, 'u6-shadow-host.mjs'))
      rows.push({ id: U6_SHADOW_ROW_ID, name: './u6-shadow-host.mjs' })
    }
    if (this.u6Fs !== null) {
      // U6 PR2 C2: the probe row mounts beside the canary (same measured
      // shape); the CALLER-provided rows (production Team row, p6t6 observer,
      // preset declarations — rows carrying `config:`) join the SAME insert
      // layer through the emitter below, which writes the whole patch file.
      copyFileSync(U6FS_PROBE_SRC, join(this.instance.profileDir, 'u6-fs-probe-host.mjs'))
      rows.push({ id: U6FS_PROBE_ROW_ID, name: './u6-fs-probe-host.mjs' })
      for (const row of this.u6Fs.rows) rows.push(row)
      mkdirSync(this.instance.profileDir, { recursive: true })
      writeFileSync(
        this.instance.patchFile,
        emitPatchLayer(
          ['U6-fs World: canary + probe rows + the production Team row, p6t6',
           'observer and preset declarations, one public profile-patch layer.'],
          rows,
        ) + '\n',
      )
    } else if (this.u6Proc !== null) {
      // U6 PR3 C2: mirror of the u6Fs block for the governed shell lane.
      copyFileSync(U6PROC_PROBE_SRC, join(this.instance.profileDir, 'u6-proc-probe-host.mjs'))
      rows.push({ id: U6PROC_PROBE_ROW_ID, name: './u6-proc-probe-host.mjs' })
      for (const row of this.u6Proc.rows) rows.push(row)
      mkdirSync(this.instance.profileDir, { recursive: true })
      writeFileSync(
        this.instance.patchFile,
        emitPatchLayer(
          ['U6-proc World: canary + shell-probe rows + the production Team row,',
           'p6t6 observer and preset declarations, one public profile-patch layer.'],
          rows,
        ) + '\n',
      )
    } else if (this.u6ArcA !== null) {
      // U6 PR5 ARC-A C2: mirror of the u6Fs/u6Proc blocks — the probe-family
      // row beside the production Team row, the p6t6 observer and the
      // preset declarations, one public profile-patch layer.
      copyFileSync(U6ARCA_PROBE_SRC, join(this.instance.profileDir, 'u6-arc-a-probe-host.mjs'))
      rows.push({ id: U6ARCA_PROBE_ROW_ID, name: './u6-arc-a-probe-host.mjs' })
      for (const row of this.u6ArcA.rows) rows.push(row)
      mkdirSync(this.instance.profileDir, { recursive: true })
      writeFileSync(
        this.instance.patchFile,
        emitPatchLayer(
          ['U6-arc-a World: canary + probe-FAMILY row (the ARC-A lane, zero',
           'center diff) + the production Team row, p6t6 observer and preset',
           'declarations, one public profile-patch layer.'],
          rows,
        ) + '\n',
      )
    } else if (this.u6ArcD !== null) {
      // U6 PR6 ARC-D C2: mirror of the u6ArcA block — the adversarial probe
      // row mounts the PR5 probe FAMILY as shipped (zero new family code),
      // beside the production Team row, the p6t6 observer and the preset
      // declarations, one public profile-patch layer.
      copyFileSync(U6ARCD_PROBE_SRC, join(this.instance.profileDir, 'u6-arc-d-probe-host.mjs'))
      rows.push({ id: U6ARCD_PROBE_ROW_ID, name: './u6-arc-d-probe-host.mjs' })
      for (const row of this.u6ArcD.rows) rows.push(row)
      mkdirSync(this.instance.profileDir, { recursive: true })
      writeFileSync(
        this.instance.patchFile,
        emitPatchLayer(
          ['U6-arc-d World: canary + adversarial probe row (mounts the PR5',
           'probe FAMILY unchanged — zero new family code is the claim) +',
           'the production Team row, p6t6 observer and preset declarations,',
           'one public profile-patch layer.'],
          rows,
        ) + '\n',
      )
    } else if (this.u6Jobs !== null) {
      // U6 PR4 C2: the jobs World needs NO probe row — the trio answers
      // through the PRODUCTION bridge on the production Team row, and every
      // observation this suite judges is public (host log, p6t6 state
      // observer, mock corpus, disk markers). The caller rows (production
      // Team row with jobsEnabled ON, p6t6 observer, preset declaration)
      // compose into the SAME public patch layer.
      for (const row of this.u6Jobs.rows) rows.push(row)
      mkdirSync(this.instance.profileDir, { recursive: true })
      writeFileSync(
        this.instance.patchFile,
        emitPatchLayer(
          ['U6-jobs World: canary row + the production Team row (jobsEnabled ON),',
           'p6t6 observer and preset declarations, one public profile-patch layer.'],
          rows,
        ) + '\n',
      )
    } else if (this.u7Census !== null) {
      // U7-0 census World: the collector row mounts beside the canary; the
      // caller rows (production Team row + preset declarations for a
      // governed-Team World; empty for the non-Team World) compose into the
      // SAME public patch layer. The row only READS public tools seams.
      copyFileSync(U7C_PROBE_SRC, join(this.instance.profileDir, 'u7-census-probe-host.mjs'))
      rows.push({ id: U7C_PROBE_ROW_ID, name: './u7-census-probe-host.mjs' })
      for (const row of this.u7Census.rows) rows.push(row)
      mkdirSync(this.instance.profileDir, { recursive: true })
      writeFileSync(
        this.instance.patchFile,
        emitPatchLayer(
          ['U7-0 census World: canary + the read-only census row',
           '(+ the production Team row and preset declarations when the',
           'caller composes a governed-Team World), one public patch layer.'],
          rows,
        ) + '\n',
      )
    } else if (this.u7FsMut !== null) {
      // U7-9a C2: the fs-MUTATION World needs NO probe row either — the
      // governed write/edit/read_image rows answer through the PRODUCTION
      // kernel on the production Team row, and every verdict is public:
      // the runner's OWN disk reads (the independent Oracle), host-log
      // witnesses of the family's observe lines, p6t6 state, mock corpus.
      for (const row of this.u7FsMut.rows) rows.push(row)
      mkdirSync(this.instance.profileDir, { recursive: true })
      writeFileSync(
        this.instance.patchFile,
        emitPatchLayer(
          ['U7-fs-mut World: canary row + the production Team row (FS family',
           'mutation members governed on the same kernel), p6t6 observer and',
           'preset declarations, one public profile-patch layer.'],
          rows,
        ) + '\n',
      )
    } else {
      this.instance.mountRows(
        rows,
        ['U5 canary World — one test-only plugin row via the public profile-patch seam.'],
      )
    }
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
      try {
        this.mockLease.release() // token-guarded: deletes only the lease still naming US
        this.receipts.releasedPorts.push(this.mockLease.port)
      } catch (error) {
        this.receipts.notes.push(`mock lease release refused: ${String(error?.message ?? error)}`)
      }
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
      try {
        this.hostLease.release() // token-guarded: deletes only the lease still naming US
        this.receipts.releasedPorts.push(this.hostLease.port)
      } catch (error) {
        this.receipts.notes.push(`host lease release refused: ${String(error?.message ?? error)}`)
      }
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
 *  - reclaim the dead holder's leases (pid in lease file is dead) through the
 *    rename-claim protocol, recording `reclaimedFrom` provenance per port;
 *  - delete the home through the ownership marker.
 * Windows: process-TREE cleanup beyond the recorded direct pid is NOT
 * implemented — the caller must record ENV_BLOCK for descendant cleanup
 * (TEST_METHODS / plan U5: 需要 Windows 的完整子进程树清理时单独 ENV_BLOCK).
 * @param {{path:string, port:number, by?:object, legacy?:boolean}[]} leasePaths
 *        leases naming this World; `by` is the dead holder the reclaim scan
 *        observed; `legacy: true` marks a pre-FIX-T bare-file slot (its path
 *        IS the slot path — reclaimed through the link-identity sweep).
 * @returns {Promise<{killed:number[], refused:number[], leasesReleased:number[], leaseProvenance:object[], leaseNotes:object[], homeDeleted:string|null}>}
 */
export async function reclaimWorld({ home, worldId, leasePaths = [] }) {
  const out = { killed: [], refused: [], leasesReleased: [], leaseProvenance: [], leaseNotes: [], homeDeleted: null }
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
  // Leases: reclaimed through the rename-claim protocol (port-lease.mjs),
  // keyed on the dead holder the scan OBSERVED (`by`, from scanStaleLeases) —
  // a plain unlink acting on a stale observation could delete a freshly
  // created lease (the FIX-T T1 race) and is no longer expressible here.
  // Every successful release carries provenance into the receipt:
  //   {port, reclaimedFrom:{pid, startedAt, world, purpose}}.
  for (const { path, port, by, legacy } of leasePaths) {
    const expected = by ?? safeReadLeaseContent(path)
    if (expected === null) {
      out.leaseNotes.push({ port, note: 'lease content unreadable at reclaim time (never delete blind)' })
      continue
    }
    const outcome = legacy === true ? sweepLegacyLease(path, expected) : reclaimStaleLease(path, expected)
    if (outcome.ok) {
      out.leasesReleased.push(port)
      out.leaseProvenance.push({ port, reclaimedFrom: outcome.reclaimedFrom })
    } else {
      // somebody re-leased it live mid-flight — never force
      out.leaseNotes.push({ port, note: `not reclaimed: ${outcome.reason}` })
    }
  }
  // Ports proven-free check (bounded): a reclaimed host port should idle.
  for (const port of out.leasesReleased) {
    if (await portInUse(port)) out.refused.push(`port:${port}`)
  }
  if (deleteWorldHomeIfMarked(home, worldId)) out.homeDeleted = home
  return out
}

/** Parse a lease file for the reclaim precondition; null when unreadable. */
function safeReadLeaseContent(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
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
