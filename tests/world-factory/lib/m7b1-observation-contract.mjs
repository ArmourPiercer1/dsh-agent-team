/**
 * m7b1-observation-contract.mjs — M7-B1: the World Factory owns the filesystem
 * observation window the Contract Oracle grades against.
 *
 * WHY THIS FILE EXISTS. M7-A proved one real tool chain can be graded, but the
 * observation scope was nailed shut by hand in the suite: the suite decided what
 * the witness watched, which paths were authorized, and when the window opened
 * and closed. That is the observation making its own rules, and it is exactly how
 * a partial watch corroborates a whole-domain claim. M7-B1 moves those decisions
 * into the World Factory — the component that already owns the World/Agent/
 * Execution lifecycle — and makes every missing precondition a NAMED, fail-closed
 * verdict instead of a green run:
 *
 *   HOST_ABSENT            the pinned runtime checkout is not there
 *   HOST_TREE_UNPINNED     it is there, but its HEAD is not the pinned SHA
 *   HOST_ASSETS_UNPROVEN   the native sandbox assets are missing or not the pins
 *   SCOPE_NOT_ABSOLUTE     a declared watch root is not an absolute path
 *   SCOPE_SYMLINK          a declared watch root resolves elsewhere (refused, NOT followed)
 *   SCOPE_UNRESOLVABLE     a declared watch root is absent / not a directory
 *   SCOPE_EMPTY            the contract declares nothing to watch
 *   SCOPE_DOES_NOT_COVER   an authorized/forbidden path is outside the watch set
 *   SCOPE_PARTIAL_FOR_DOMAIN  a whole-filesystem claim with a partial watch
 *   IDENTITY_INVALID       world/agent/execution identity is missing or blank
 *   IDENTITY_MISMATCH      the window is bound to a DIFFERENT world/agent/execution
 *                          than the contract names (M7-B1b; a caller-supplied id is
 *                          never accepted just because it is well formed)
 *   EXECUTION_ID_NOT_IN_TRACE  the contract names an execution the host's durable
 *                          trace never carried (M7-B1b; the id must be OBSERVED)
 *   WINDOW_NOT_CLOSED      the window is still `pre` / has no `closedAt`: a verdict
 *                          needs the post snapshot, so an armed window cannot pass
 *   WITNESS_NOT_SEALED     a row OR WINDOW was not produced by the testkit module
 *                          (identity, not shape: a copy of a sealed record fails)
 *   WINDOW_MISMATCH        a row/envelope belongs to a different observation window
 *   WITNESS_NOT_WINDOWED   the instrument carries no window (cannot be graded)
 *   WITNESS_NOT_ARMED      no open window this module produced
 *
 * WHAT THE CONTRACT BINDS (all five fields are required, none is inferred):
 *   1. identity   — `world_id` (the World this factory created), `agent_id` (the
 *                   real session), `execution_id` (the real tool call under grade)
 *   2. scope      — the absolute, symlink-RESOLVED directories the witness watches
 *   3. window     — a pre/post pair produced by ONE instrument (same window_id)
 *   4. provenance — who produced the rows (the testkit module, by identity not by
 *                   shape), and the window's lifecycle (armedAt → closedAt)
 *   5. verdict    — a `judgeContract` call that is only reachable through the
 *                   window above, with `witnessProvenance: 'witnessed'` and the
 *                   window id pinned
 *
 * PROVENANCE IS EXTENDED, NOT DUPLICATED. The testkit already keeps row identity
 * in a private `WeakMap` (`isSealedWitnessObservation`). This module adds the
 * WINDOW half of the same idea in the same place (`createFsWitness({window})`,
 * `observationWindowOf`, `isSealedObservationWindow`, `closeObservationWindow`)
 * and consumes it; it never re-implements a seal and never accepts a row it did
 * not get from the instrument it armed.
 *
 * HONEST LIMITS: process and network are NOT instrumented (the witness reports
 * them blind, and the oracle refuses to grade them). The window is a pair of
 * point-in-time snapshots, so a file created AND deleted inside it is invisible,
 * and a file above the digest limit is compared by size+mtime only. Those limits
 * are reported by the oracle, never read as clean.
 *
 * @module tests/world-factory/lib/m7b1-observation-contract
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { register } from 'node:module'
import { isAbsolute, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { TEST_USE_BASELINE_SHA, testUseTree } from '../../paths.mjs'

/** Version tag of the contract this module owns. */
export const OBSERVATION_CONTRACT_SCHEMA = 'm7b1-observation-contract/1'

/** Repo root of the worktree that owns this module (tests/world-factory/lib -> ../../..). */
export const M7B1_REPO_ROOT = resolve(new URL('.', import.meta.url).pathname, '..', '..', '..')

/** The only accepted claims. */
export const CLAIMS = Object.freeze(['path-scope', 'filesystem-domain'])

/**
 * A typed refusal. `code` is the machine-readable name the verdict quotes; the
 * message is the human one. Both are part of the evidence, never a parsed string.
 */
export class ObservationContractRefusal extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`)
    this.name = 'ObservationContractRefusal'
    this.code = code
    this.detail = detail
  }
}

/** The Operator-visible refusal codes. Frozen: a new one is a decision, not a typo. */
export const REFUSAL_CODES = Object.freeze([
  'HOST_ABSENT',
  'HOST_TREE_UNPINNED',
  'HOST_ASSETS_UNPROVEN',
  'SCOPE_NOT_ABSOLUTE',
  'SCOPE_SYMLINK',
  'SCOPE_UNRESOLVABLE',
  'SCOPE_EMPTY',
  'SCOPE_DOES_NOT_COVER',
  'SCOPE_PARTIAL_FOR_DOMAIN',
  'IDENTITY_INVALID',
  'IDENTITY_MISMATCH',
  'EXECUTION_ID_NOT_IN_TRACE',
  'WINDOW_NOT_CLOSED',
  'WITNESS_NOT_SEALED',
  'WINDOW_MISMATCH',
  'WITNESS_NOT_WINDOWED',
  'WITNESS_NOT_ARMED',
])

const refuse = (code, detail) => {
  if (!REFUSAL_CODES.includes(code)) throw new TypeError(`m7b1: unknown refusal code ${JSON.stringify(code)}`)
  throw new ObservationContractRefusal(code, detail)
}

// ── the testkit sources (TypeScript, through the repo's EXISTING resolution hook)
let testkitPromise = null
async function testkit() {
  if (testkitPromise === null) {
    register(pathToFileURL(join(M7B1_REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)
    testkitPromise = import(pathToFileURL(join(M7B1_REPO_ROOT, 'packages', 'testkit', 'src', 'effect-witness.ts')).href)
  }
  return testkitPromise
}
let oraclePromise = null
async function oracle() {
  if (oraclePromise === null) {
    await testkit()
    oraclePromise = import(pathToFileURL(join(M7B1_REPO_ROOT, 'packages', 'testkit', 'src', 'contract-oracle.ts')).href)
  }
  return oraclePromise
}

// ── path algebra ─────────────────────────────────────────────────────────────

/** Whether `path` is `root` or lies inside it (both absolute, resolved). */
function coveredBy(path, root) {
  const rel = resolve(root)
  const abs = resolve(path)
  if (abs === rel) return true
  return abs.startsWith(rel.endsWith('/') ? rel : `${rel}/`)
}

/**
 * Resolve ONE declared watch root, or refuse with the exact reason.
 *
 * A symlinked root is REFUSED, not followed: `watch:[/link]` (→ /elsewhere) would
 * let the contract claim one path while the effects happen at another. This is
 * the same rule the testkit applies; doing it here as well means the refusal is
 * named in the contract's vocabulary before an instrument is built.
 */
function resolveScopeRoot(declared) {
  if (typeof declared !== 'string' || declared.trim() === '') refuse('SCOPE_NOT_ABSOLUTE', `a watch root must be a non-empty path (got ${JSON.stringify(declared)})`)
  if (!isAbsolute(declared)) refuse('SCOPE_NOT_ABSOLUTE', `the watch root ${JSON.stringify(declared)} is not absolute; an observation scope is never relative to the caller's cwd`)
  const absolute = resolve(declared)
  // `/` is never itself watched: no instrument in this repo enumerates the whole
  // filesystem, so a contract that declares it would make the watch look total
  // while in fact nothing is enumerated. Refused as a partial-for-domain claim
  // rather than followed into a false "we watched everything" (M7-B1b).
  if (absolute === '/') {
    refuse('SCOPE_PARTIAL_FOR_DOMAIN', 'the watch root "/" is never itself watched: no instrument here enumerates the whole filesystem, so declaring it would make a partial observation look total')
  }
  let real
  try {
    real = realpathSync(absolute)
  } catch (error) {
    refuse('SCOPE_UNRESOLVABLE', `the watch root ${absolute} cannot be resolved (${error?.code ?? String(error)})`)
  }
  if (real !== absolute) {
    refuse('SCOPE_SYMLINK', `the watch root ${absolute} resolves to ${real}; a witness cannot claim a scope it reaches indirectly — declare the real path`)
  }
  let stats
  try {
    stats = statSync(absolute)
  } catch (error) {
    refuse('SCOPE_UNRESOLVABLE', `the watch root ${absolute} cannot be stat'ed (${error?.code ?? String(error)})`)
  }
  if (!stats.isDirectory()) refuse('SCOPE_UNRESOLVABLE', `the watch root ${absolute} is not a directory`)
  return real
}

/** Drop roots another root already covers, so the watch set never claims two scopes. */
function pruneScopes(roots) {
  const sorted = [...roots].sort((a, b) => a.length - b.length)
  const out = []
  for (const root of sorted) if (!out.some((kept) => coveredBy(root, kept))) out.push(root)
  return out
}

const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== ''

// ── the contract ─────────────────────────────────────────────────────────────

/**
 * Declare the observation contract a World's execution is graded against.
 *
 * Every field is required and validated HERE, before any instrument exists:
 * a contract that cannot name what it observes is refused, not repaired.
 *
 * @param {object} p
 * @param {object} p.world - a World created by `TestWorldFactory` (identity + owned home)
 * @param {string} p.agentId - the real Agent Session id the window is bound to
 * @param {string} p.executionId - the real tool-call id under grade
 * @param {string[]} p.scope - absolute, symlink-resolved directories the witness watches
 * @param {string[]} [p.authorizedPaths] - where an effect is expected (reported, not graded)
 * @param {string[]} [p.forbiddenPaths] - where an effect violates even inside an authorized root
 * @param {'path-scope'|'filesystem-domain'} [p.claim]
 */
export function declareObservationContract({
  world,
  agentId,
  executionId,
  scope,
  authorizedPaths = [],
  forbiddenPaths = [],
  claim = 'path-scope',
} = {}) {
  if (typeof world !== 'object' || world === null) refuse('IDENTITY_INVALID', 'world is required: the observation is bound to a World this factory created')
  if (!isNonEmptyString(world.id)) refuse('IDENTITY_INVALID', 'world.id is blank: the contract cannot name which World it observes')
  if (!isNonEmptyString(world.home)) refuse('IDENTITY_INVALID', 'world.home is blank: the contract has no owned root')
  if (!isNonEmptyString(agentId)) refuse('IDENTITY_INVALID', 'agentId is blank: the window must be bound to the real Agent Session')
  if (!isNonEmptyString(executionId)) refuse('IDENTITY_INVALID', 'executionId is blank: the window must be bound to the real execution under grade')
  if (!CLAIMS.includes(claim)) refuse('IDENTITY_INVALID', `claim must be one of ${CLAIMS.join('|')} (got ${JSON.stringify(String(claim))})`)

  const declared = Array.isArray(scope) ? scope : []
  if (declared.length === 0) refuse('SCOPE_EMPTY', 'the contract declares no watch root; an empty watch could only ever report "no effect"')
  const roots = pruneScopes(declared.map(resolveScopeRoot))

  const authorized = (Array.isArray(authorizedPaths) ? authorizedPaths : []).map((p) => {
    if (!isAbsolute(String(p))) refuse('SCOPE_NOT_ABSOLUTE', `authorized path ${JSON.stringify(p)} is not absolute`)
    return resolve(String(p))
  })
  const forbidden = (Array.isArray(forbiddenPaths) ? forbiddenPaths : []).map((p) => {
    if (!isAbsolute(String(p))) refuse('SCOPE_NOT_ABSOLUTE', `forbidden path ${JSON.stringify(p)} is not absolute`)
    return resolve(String(p))
  })

  // The scope must contain what the contract grades. A path outside the watch set
  // could change without the witness seeing it — that is a partial watch making a
  // whole-claim, and it is refused here rather than discovered by a green run.
  for (const [kind, paths] of [['authorized', authorized], ['forbidden', forbidden]]) {
    for (const path of paths) {
      if (!roots.some((root) => coveredBy(path, root))) {
        refuse('SCOPE_DOES_NOT_COVER', `the ${kind} path ${path} is outside every declared watch root (${roots.join(', ')}); an effect there would be graded on an observation that never saw it`)
      }
    }
  }

  // A claim about the WHOLE filesystem domain needs a watch that covers it. `/`
  // is refused as a watch root (above) because no instrument here enumerates the
  // whole filesystem, so NO scope can establish a domain claim today — the honest
  // answer for every domain claim is therefore SCOPE_PARTIAL_FOR_DOMAIN, including
  // the `scope:['/']` shape that used to slip through this check (M7-B1b).
  if (claim === 'filesystem-domain') {
    refuse('SCOPE_PARTIAL_FOR_DOMAIN', `the contract claims the whole filesystem domain but watches ${roots.join(', ')}; "/" is not a watchable root here, so no declared scope covers the domain and a partial watch cannot corroborate it`)
  }

  const body = {
    schema: OBSERVATION_CONTRACT_SCHEMA,
    claim,
    world_id: world.id,
    agent_id: agentId,
    execution_id: executionId,
    world_home: world.home,
    workspace: isNonEmptyString(world.workspaceDir) ? resolve(world.workspaceDir) : null,
    scope: Object.freeze(roots),
    authorizedPaths: Object.freeze(authorized),
    forbiddenPaths: Object.freeze(forbidden),
  }
  const contract_id = `obs-${createHash('sha256')
    .update(JSON.stringify({ ...body, scope: roots, authorizedPaths: authorized, forbiddenPaths: forbidden }))
    .digest('hex')
    .slice(0, 16)}`
  return Object.freeze({ ...body, contract_id })
}

// ── the window ───────────────────────────────────────────────────────────────

/**
 * The `opened`/`closed` envelopes THIS MODULE produced, by object identity.
 *
 * Same law as the testkit's row seal, one level up: a window is not provenance
 * because it has the right fields — it is provenance because it is the object
 * this module returned for an instrument it armed. A spread copy, an
 * `Object.create`d child inheriting the fields, a `structuredClone`, or a record
 * from a second module instance is a DIFFERENT object and fails here (M7-B1b).
 */
const OPENED = new WeakSet()
const CLOSED = new WeakSet()

/** The one place a window failure becomes a verdict shape. */
function instrumentError(reason, detail, extra = {}) {
  return {
    verdict: 'INSTRUMENT_ERROR',
    reasons: [`the observation window cannot corroborate this contract: ${reason} — ${detail}`],
    limitations: ['limitations not computed: there was no gradeable window'],
    reason,
    detail,
    observedEffectPaths: [],
    ...extra,
  }
}

/**
 * Whether a window may corroborate THIS contract (M7-B1b). Pure: it reads the
 * window, the contract and the trace, and returns `null` when the binding holds
 * or `{reason, detail}` when it does not. The SEAL it cannot check (it has no
 * access to the module registries by design) is checked by the caller first.
 *
 * Three separate questions, because they fail differently:
 *   1. lifecycle — is the window CLOSED (post snapshot with a real `closedAt`)?
 *   2. identity  — is the window bound to the contract's world/agent/execution?
 *   3. trace     — did the host's durable trace actually carry that execution id?
 */
export function checkWindowBinding({ contract, window, events = [] } = {}) {
  if (typeof contract !== 'object' || contract === null || contract.schema !== OBSERVATION_CONTRACT_SCHEMA) {
    return { reason: 'IDENTITY_INVALID', detail: 'a verdict needs a contract declared by declareObservationContract' }
  }
  if (typeof window !== 'object' || window === null) {
    return { reason: 'WITNESS_NOT_SEALED', detail: 'there is no window record to bind the verdict to' }
  }
  if (window.phase !== 'post' || typeof window.closedAt !== 'string' || window.closedAt.trim() === '') {
    return {
      reason: 'WINDOW_NOT_CLOSED',
      detail: `window ${String(window.window_id)} is phase=${String(window.phase)} closedAt=${String(window.closedAt)}; a verdict needs the POST snapshot taken after the execution, so an armed-but-unclosed window can never corroborate one`,
    }
  }
  for (const field of ['world_id', 'agent_id', 'execution_id']) {
    if (window[field] !== contract[field]) {
      return {
        reason: 'IDENTITY_MISMATCH',
        detail: `the window is bound to ${field}=${JSON.stringify(window[field])} but the contract declares ${JSON.stringify(contract[field])}; an observation of one identity cannot corroborate a contract about another`,
      }
    }
  }
  const list = Array.isArray(events) ? events : []
  const carriers = list.filter(
    (event) =>
      typeof event === 'object' &&
      event !== null &&
      (event.event_type === 'tool/call' || event.event_type === 'tool/result') &&
      event.execution_id === contract.execution_id,
  )
  if (carriers.length === 0) {
    const seen = [...new Set(list.filter((event) => typeof event === 'object' && event !== null).map((event) => String(event.execution_id)))].join(', ')
    return {
      reason: 'EXECUTION_ID_NOT_IN_TRACE',
      detail: `the contract declares execution_id=${JSON.stringify(contract.execution_id)} but no tool/call or tool/result event in the host's durable trace carries it (ids present: ${seen === '' ? 'none' : seen}); the execution under grade is not the execution this trace observed`,
    }
  }
  return null
}



/** Read the host HEAD without trusting the directory name. */
function hostHead(hostTree) {
  try {
    return execFileSync('git', ['-C', hostTree, 'rev-parse', 'HEAD'], { encoding: 'utf8', timeout: 30_000 }).trim()
  } catch (error) {
    refuse('HOST_TREE_UNPINNED', `${hostTree} is not a git checkout this process can read (${error?.code ?? String(error)})`)
  }
}

/**
 * Where the pinned manifest's relative file names live in a runtime tree. The
 * manifest keys are paths inside the platform package (`bin/glibc/system.node`),
 * which is the same base `scripts/provision-host-assets.mjs` installs into.
 */
const PLATFORM_PACKAGE_DIR = 'native/system/packages/linux-x64'

function sha256Of(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

/** Verify the pinned asset bytes against the committed manifest, or refuse by name. */
function assertPinnedAssets(hostTree) {
  const manifest = JSON.parse(readFileSync(join(M7B1_REPO_ROOT, 'tests', 'world-factory', 'lib', 'host-sandbox-assets-manifest.json'), 'utf8'))
  const key = `0.2.0-rc.2@${TEST_USE_BASELINE_SHA}`
  const pinned = manifest?.entries?.[key]?.platforms?.['linux-x64']?.files
  if (pinned === undefined) refuse('HOST_ASSETS_UNPROVEN', `the manifest pins no assets for ${key}`)
  for (const relative of Object.keys(pinned)) {
    const expected = pinned[relative]?.sha256
    const path = join(hostTree, PLATFORM_PACKAGE_DIR, relative)
    if (!existsSync(path)) refuse('HOST_ASSETS_UNPROVEN', `${path} is absent; the pinned sandbox backend cannot be exercised, so a denial would be explained by the environment instead of the product`)
    const actual = sha256Of(path)
    if (actual !== expected) refuse('HOST_ASSETS_UNPROVEN', `${relative} sha256=${actual} != the pinned ${expected}`)
  }
}

/**
 * Establish a window (the `pre` half): verify the host state the observation is
 * only meaningful on, then arm the instrument over the contract's scope.
 *
 * Returns `{ok: true, witness, window}` or `{ok: false, verdict, reason, detail}`.
 * It NEVER throws for a precondition: a caller must be able to turn the refusal
 * into a verdict, and a thrown error would let a suite report "red" without ever
 * saying what could not be established.
 */
export async function openObservationWindow({ contract, hostTree = null, phase = 'pre' } = {}) {
  if (typeof contract !== 'object' || contract === null || contract.schema !== OBSERVATION_CONTRACT_SCHEMA) {
    return { ok: false, verdict: 'INSTRUMENT_ERROR', reason: 'IDENTITY_INVALID', detail: 'openObservationWindow needs a contract declared by declareObservationContract' }
  }
  const tree = resolve(hostTree ?? testUseTree(M7B1_REPO_ROOT))
  if (!existsSync(join(tree, 'apps', 'cli', 'lib', 'bin.js'))) {
    return { ok: false, verdict: 'INSTRUMENT_ERROR', reason: 'HOST_ABSENT', detail: `${join(tree, 'apps', 'cli', 'lib', 'bin.js')} is absent: the pinned runtime checkout is missing, so no window can be established` }
  }
  try {
    const head = hostHead(tree)
    if (head !== TEST_USE_BASELINE_SHA) {
      return { ok: false, verdict: 'INSTRUMENT_ERROR', reason: 'HOST_TREE_UNPINNED', detail: `${tree} HEAD=${head} but tests/paths.mjs pins ${TEST_USE_BASELINE_SHA}; an observation of an unpinned host is not an observation of the product` }
    }
    assertPinnedAssets(tree)
    // Re-resolve at OPEN time: the scope was valid when declared, and the window
    // must still be watching the same real directories now.
    for (const root of contract.scope) resolveScopeRoot(root)
    const { createFsWitness, observationWindowOf } = await testkit()
    const witness = createFsWitness({
      root: contract.world_home,
      watch: [...contract.scope],
      window: {
        world_id: contract.world_id,
        agent_id: contract.agent_id,
        execution_id: contract.execution_id,
        phase,
      },
    })
    const window = observationWindowOf(witness)
    if (window === null) {
      return { ok: false, verdict: 'INSTRUMENT_ERROR', reason: 'WITNESS_NOT_WINDOWED', detail: 'the instrument returned by the testkit carries no window record, so no row it produces can be bound to this contract' }
    }
    const opened = Object.freeze({ ok: true, witness, window, hostTree: tree, hostSha: TEST_USE_BASELINE_SHA })
    OPENED.add(opened)
    return opened
  } catch (error) {
    if (error instanceof ObservationContractRefusal) {
      return { ok: false, verdict: 'INSTRUMENT_ERROR', reason: error.code, detail: error.detail }
    }
    throw error
  }
}

/**
 * Close the window (the `post` half) and return the rows, SEALED AND BOUND.
 *
 * The rows are checked here, not by the caller: every one must be an object the
 * testkit's private `WeakMap` knows, and every one must carry this window's id.
 * A caller cannot forge either property, and it cannot "re-seal" a row by copying
 * one — a copy is a different object identity and fails the seal.
 */
export async function closeObservationWindow({ opened, witness = null } = {}) {
  const { isSealedObservationWindow, areSealedWitnessObservations, closeObservationWindow: closeInstrument } = await testkit()
  // (1) the envelope must be the one THIS module returned for an instrument it
  // armed. A caller can build `{ok:true, witness, window}` with the right fields;
  // it cannot make that object the one we handed out (M7-B1b).
  if (typeof opened !== 'object' || opened === null || !OPENED.has(opened)) {
    return { ok: false, verdict: 'INSTRUMENT_ERROR', reason: 'WITNESS_NOT_ARMED', detail: 'the `opened` value was not returned by openObservationWindow: a caller-assembled window is not an armed window' }
  }
  // (2) the window record must be the sealed object the testkit built, not a copy.
  if (!isSealedObservationWindow(opened.window)) {
    return { ok: false, verdict: 'INSTRUMENT_ERROR', reason: 'WITNESS_NOT_SEALED', detail: 'the opened window record is not the frozen object the testkit sealed: a copied/derived record is not provenance' }
  }
  // (3) closing a window through a DIFFERENT instrument than the one it armed is
  // the substitution that would let one observation answer for another.
  const active = witness === null || witness === undefined ? opened.witness : witness
  if (active !== opened.witness) {
    return { ok: false, verdict: 'INSTRUMENT_ERROR', reason: 'WITNESS_NOT_SEALED', detail: 'the witness handed to closeObservationWindow is not the instrument this window armed; an observation cannot be closed by a different instrument' }
  }
  if (active === null || active === undefined) {
    return { ok: false, verdict: 'INSTRUMENT_ERROR', reason: 'WITNESS_NOT_ARMED', detail: 'no open window: the observation never began, so there is nothing to close' }
  }
  const rows = await active.observe()
  let closed
  try {
    closed = closeInstrument(active)
  } catch (error) {
    return { ok: false, verdict: 'INSTRUMENT_ERROR', reason: 'WITNESS_NOT_SEALED', detail: `the testkit refused to close this instrument: ${error?.message ?? String(error)}` }
  }
  if (!isSealedObservationWindow(closed) || closed.phase !== 'post' || typeof closed.closedAt !== 'string') {
    return { ok: false, verdict: 'INSTRUMENT_ERROR', reason: 'WINDOW_NOT_CLOSED', detail: `the closed record is not a sealed POST window (phase=${String(closed?.phase)} closedAt=${String(closed?.closedAt)}); a pre snapshot cannot be graded as a completed observation` }
  }
  if (closed.window_id !== opened.window.window_id) {
    return { ok: false, verdict: 'INSTRUMENT_ERROR', reason: 'WINDOW_MISMATCH', detail: `the closed window is ${String(closed.window_id)} but the armed window was ${String(opened.window.window_id)}; one instrument, one window` }
  }
  if (!areSealedWitnessObservations(rows)) {
    return {
      ok: false,
      verdict: 'INSTRUMENT_ERROR',
      reason: 'WITNESS_NOT_SEALED',
      detail: 'at least one row was not produced by a testkit witness instrument (no provenance seal); a hand-built or copied observation cannot corroborate a verdict',
      window: closed,
      rows: [],
    }
  }
  const foreign = rows.filter((row) => row.window_id !== closed.window_id)
  if (foreign.length > 0) {
    return {
      ok: false,
      verdict: 'INSTRUMENT_ERROR',
      reason: 'WINDOW_MISMATCH',
      detail: `${foreign.length} row(s) carry window_id=${foreign.map((row) => String(row.window_id)).join(',')} but this window is ${closed.window_id}`,
      window: closed,
      rows: [],
    }
  }
  const envelope = Object.freeze({ ok: true, window: closed, rows: [...rows] })
  CLOSED.add(envelope)
  return envelope
}

/**
 * Judge the contract against the closed window.
 *
 * This is the ONLY path to a verdict in M7-B1: it takes the contract (scope,
 * authorized/forbidden paths, identity), the closed window (rows + window id) and
 * the trace, and it delegates to `judgeContract` with `witnessProvenance:
 * 'witnessed'` and the window id pinned. A window that failed to open/close is
 * returned as ITS verdict (`INSTRUMENT_ERROR`/`INCONCLUSIVE`) with the reason
 * named — never as `SATISFIED`.
 */
export async function judgeObservationWindow({ contract, opened, closed, events = [], expectDeny = true } = {}) {
  const failure = opened?.ok !== true ? opened : closed !== null && closed !== undefined && closed.ok !== true ? closed : null
  if (failure !== null && failure !== undefined) {
    return {
      verdict: failure.verdict === 'SATISFIED' ? 'INSTRUMENT_ERROR' : failure.verdict,
      reasons: [`the observation window could not be established: ${failure.reason} — ${failure.detail}`],
      limitations: ['limitations not computed: there was no window to compute them from'],
      reason: failure.reason,
      detail: failure.detail,
      observedEffectPaths: [],
    }
  }
  // (1) BOTH envelopes must be objects this module produced. Field-shaped copies
  // (`{...opened}`, `Object.create(closed)`, a JSON round-trip, another module
  // instance's record) are different identities and are refused (M7-B1b).
  if (typeof opened !== 'object' || opened === null || !OPENED.has(opened)) {
    return instrumentError('WITNESS_NOT_SEALED', 'the `opened` value was not returned by openObservationWindow for an instrument it armed; a caller-assembled window cannot be graded')
  }
  if (typeof closed !== 'object' || closed === null || !CLOSED.has(closed)) {
    return instrumentError('WITNESS_NOT_SEALED', 'the `closed` value was not returned by closeObservationWindow; a caller-assembled post snapshot cannot be graded')
  }
  const { isSealedObservationWindow, areSealedWitnessObservations } = await testkit()
  const window = closed.window
  // (2) the window RECORD must be the frozen object the testkit sealed — the
  // predicate existed since M7-B1 and is now actually consulted, so the window
  // half of the WeakMap discipline is live rather than decorative.
  if (!isSealedObservationWindow(window) || !isSealedObservationWindow(opened.window)) {
    return instrumentError('WITNESS_NOT_SEALED', 'the window record is not the frozen object the testkit sealed: copied or derived window records are not provenance')
  }
  if (window.window_id !== opened.window.window_id) {
    return instrumentError('WINDOW_MISMATCH', `the closed window is ${String(window.window_id)} but the armed window was ${String(opened.window.window_id)}; an observation from another window cannot corroborate this contract`)
  }
  // (3) lifecycle, identity and the durable trace (M7-B1b).
  const binding = checkWindowBinding({ contract, window, events })
  if (binding !== null) return instrumentError(binding.reason, binding.detail)
  // (4) every row must still belong to this window (defence in depth: close
  // already enforces it, judge is a public entry point).
  const stray = (Array.isArray(closed.rows) ? closed.rows : []).filter((row) => row.window_id !== window.window_id)
  if (stray.length > 0) {
    return instrumentError('WINDOW_MISMATCH', `${stray.length} row(s) belong to another window (${stray.map((row) => String(row.window_id)).join(', ')}) than the judged one (${window.window_id})`)
  }
  if (!areSealedWitnessObservations(closed.rows ?? [])) {
    return instrumentError('WITNESS_NOT_SEALED', 'a row in the closed window is not the object a testkit instrument produced')
  }
  const { judgeContract } = await oracle()
  const judgement = judgeContract({
    contractId: `${contract.contract_id}:${contract.agent_id}:${contract.execution_id}`,
    events,
    witness: closed.rows,
    blindDomains: ['process', 'network'],
    requiredEffectDomains: ['filesystem'],
    requiredEffectScope: [...contract.scope],
    authorizedEffectPaths: [...contract.authorizedPaths],
    forbiddenEffectPaths: [...contract.forbiddenPaths],
    witnessProvenance: 'witnessed',
    requiredObservationWindowId: window.window_id,
    // The execution under grade must be an execution the trace OBSERVED; the
    // oracle faults if no tool/call|tool/result event carries this id.
    requiredExecutionId: contract.execution_id,
    expectDeny,
  })
  return judgement
}

/**
 * The identity triple a window is bound to, as one greppable line. Every run
 * prints it, so a recorded verdict can be matched to the World/Agent/Execution it
 * describes without reading the JSON.
 */
export function formatWindowIdentity(contract, window = null) {
  const parts = [
    'M7B1-WINDOW',
    `contract=${contract.contract_id}`,
    `world=${contract.world_id}`,
    `agent=${contract.agent_id}`,
    `execution=${contract.execution_id}`,
    `claim=${contract.claim}`,
    `scope=${contract.scope.join(',')}`,
  ]
  if (window !== null) {
    parts.push(`window=${window.window_id}`, `phase=${window.phase}`, `armedAt=${window.armedAt}`, `closedAt=${String(window.closedAt)}`, `producer=${window.producedBy}`)
  }
  return parts.join(' ')
}
