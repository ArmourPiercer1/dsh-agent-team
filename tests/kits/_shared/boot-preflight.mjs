/**
 * `tests/kits/_shared/boot-preflight.mjs` — the ONE pre-boot gate every
 * kit/boot driver can call BEFORE it starts a Host.
 *
 * WHY THIS FILE EXISTS
 *
 * A real Host start is the scarcest resource a live kit spends. The owner's
 * directive (2026-11-11, work package F-5 / Boot Preflight) named a specific
 * bug class observed across the live drivers: a driver recorded an ARM IT DID
 * NOT SELECT as `FAIL`. A run that never attempted an arm cannot fail it; it
 * can only be `NOT_SELECTED` (or `NOT_REACHED` when a real prerequisite
 * stopped the drive before the arm's observable existed). Mixing those two
 * states produces red evidence for work that never happened, and it hides the
 * real defect behind a count.
 *
 * This module therefore does two things, and nothing else:
 *
 *   1. It RUNS a small, host-free set of pre-start checks over plain facts the
 *      caller supplies (env, host pin, candidate SHA, model modalities,
 *      Officer count, port availability, the World/`DSH_HOME`, the selected
 *      test arms). It never spawns, opens a socket, or reads a Host log.
 *   2. It CLASSIFIES every outcome into the owner's CLOSED six-word set and
 *      REFUSES the start (`assertBootPreflight`) when the verdict is not
 *      `PASS`, with the typed reason.
 *
 * THE CLOSED SET (semantics; no seventh word, no synonyms)
 *
 *   PASS          The check ran and its requirement is satisfied.
 *   FAIL          The check ran and its requirement is VIOLATED. A FAIL is an
 *                 assertion about the artifact/policy, never about the weather.
 *   NOT_REACHED   A prerequisite did not reach PASS, so this check's observable
 *                 could not exist. The question was never asked; it is NOT a
 *                 negative answer.
 *   NOT_SELECTED  This run did not select the arm the check belongs to. It is
 *                 assigned STRUCTURALLY, before any evaluation of the check's
 *                 raw outcome, and it can never become FAIL (see
 *                 {@link recordCheck}). `NOT_SELECTED` never blocks a start.
 *   UNSUPPORTED   The declared host/product generation does not support the
 *                 capability the check asks about. A documented incompatibility
 *                 is a fact about the matrix, not a defect of this run.
 *   ENV_BLOCK     The environment cannot support the run at all: a required env
 *                 var is absent, a port is taken, the World is missing or
 *                 outside the workspace, the candidate manifest is absent, a
 *                 required executable/host checkout is not there. Nothing about
 *                 the product has been tested.
 *
 * `NOT_REACHED` and `ENV_BLOCK` are deliberately distinct: the first is about
 * ORDER inside a run (a later observable could not exist), the second about the
 * MACHINE before the run (nothing could have run). A driver that maps both to
 * "cannot run here" loses the ability to tell an instrument defect from a
 * missing env var.
 *
 * WHY THE SELECTION RULE IS STRUCTURAL, NOT A CONVENTION
 *
 * `recordCheck` receives the raw state a caller computed. If the check carries
 * an `arm` that is not in `arms.selected`, the raw state is REPLACED with
 * `NOT_SELECTED` and the original is kept under `rawState` for audit. A caller
 * therefore cannot record `FAIL` for an arm it did not select, even by mistake:
 * the only way to obtain that FAIL is to select the arm. This is the invariant
 * that the owner's bug class required, and
 * `boot-preflight.test.mjs` asserts it in both directions (selected arm can
 * FAIL; unselected arm cannot).
 *
 * The same applies to the overall verdict: `NOT_SELECTED` checks are excluded
 * from the pass/fail computation, so a suite of 6 arms whose run selected 1
 * still yields `PASS` when the selected arm passed and the other 5 were never
 * selected.
 *
 * USAGE (a boot driver, before `spawn`)
 *
 *   import { runBootPreflight, assertBootPreflight } from '../_shared/boot-preflight.mjs'
 *
 *   const preflight = await runBootPreflight({
 *     env: {
 *       required: ['DSH_HOME', 'DSH_CLIENT_COMMIT_HASH', 'DEEPSEEK_BASE_URL'],
 *       provided: process.env,
 *     },
 *     hostPin: { declared: TEST_USE_BASELINE_SHA, actual: readHostPin(TESTUSE) },
 *     candidate: { expectedSha, actualSha, manifestPath },
 *     modalities: [{ id: 'text', supported: true, arm: 'ask-1' }],
 *     officer: { required: true, count: 1, arm: 'ask-1' },
 *     ports: [{ port: hostPort, free: await portFree(hostPort) }],
 *     world: { dshHome: HOME, workspaceRoot: REPO, created: false },
 *     arms: { selected: ['ask-1'], known: ['ask-1', 'ask-2'] },
 *   })
 *   assertBootPreflight(preflight)   // throws BootPreflightRefusal unless PASS
 *   // … only now spawn the Host
 *
 * The result is JSON-serialisable so a driver can write it as
 * `<evidence-dir>/boot-preflight.json` BEFORE spending the start. A run
 * directory without that file is a driver defect, not an environment fact.
 *
 * WHAT THIS MODULE DOES NOT DO
 *
 *   - It does not decide product semantics. It only grades DECLARED facts.
 *   - It does not open ports or spawn processes; callers pass measurements.
 *   - It does not invent checks: pass only what the run actually needs.
 *
 * @module tests/kits/_shared/boot-preflight
 */

/**
 * The owner's closed classification vocabulary (2026-11-11 ruling). Exactly
 * these six values are legal; a seventh word is a schema violation.
 * @type {readonly string[]}
 */
export const PREFLIGHT_STATES = Object.freeze([
  'PASS',
  'FAIL',
  'NOT_REACHED',
  'NOT_SELECTED',
  'UNSUPPORTED',
  'ENV_BLOCK',
])

/**
 * Blocking precedence: which non-PASS state names the refusal when several
 * occur. `FAIL` first (a real violation outranks a blocked machine), then
 * `ENV_BLOCK`, then `UNSUPPORTED`, then `NOT_REACHED`. `NOT_SELECTED` is never
 * blocking and is absent on purpose.
 * @type {readonly string[]}
 */
export const BLOCKING_PRECEDENCE = Object.freeze(['FAIL', 'ENV_BLOCK', 'UNSUPPORTED', 'NOT_REACHED'])

/** The typed refusal a boot driver raises instead of starting the Host. */
export class BootPreflightRefusal extends Error {
  /**
   * @param {string} reason
   * @param {Readonly<{ verdict: string, blocking: ReadonlyArray<object> }>} detail
   */
  constructor(reason, detail) {
    super(`BootPreflightRefusal: ${reason}`)
    this.name = 'BootPreflightRefusal'
    this.code = 'BOOT_PREFLIGHT_REFUSED'
    this.reason = reason
    this.verdict = detail.verdict
    this.blocking = detail.blocking
  }
}

/**
 * The state a check may carry. Rejects anything outside the closed set so a
 * typo (`FAILED`, `ERROR`) fails loudly instead of silently reading like a
 * pass.
 * @param {unknown} state
 * @returns {string}
 */
export function assertPreflightState(state) {
  if (typeof state !== 'string' || !PREFLIGHT_STATES.includes(state)) {
    throw new TypeError(`boot-preflight: ${JSON.stringify(state)} is not one of ${PREFLIGHT_STATES.join('|')}`)
  }
  return state
}

/**
 * Normalise one check record and apply the STRUCTURAL selection rule.
 *
 * An unselected arm's check is `NOT_SELECTED` regardless of the raw state the
 * caller computed; the raw state is preserved under `rawState` for audit but is
 * never counted. Selection is decided here, once, so no downstream reader can
 * re-derive it differently.
 *
 * @param {object} check
 * @param {string} check.id            stable check id (evidence key)
 * @param {string} [check.arm]         arm this check belongs to (omit = core)
 * @param {'PASS'|'FAIL'|'NOT_REACHED'|'NOT_SELECTED'|'UNSUPPORTED'|'ENV_BLOCK'} check.state
 * @param {string} [check.detail]
 * @param {ReadonlyArray<string>} selectedArms
 * @returns {{ id: string, arm: string|null, state: string, detail: string, rawState?: string }}
 */
export function recordCheck(check, selectedArms) {
  const state = assertPreflightState(check.state)
  const arm = typeof check.arm === 'string' && check.arm.length > 0 ? check.arm : null
  const selected = arm === null || selectedArms.includes(arm)
  const effective = selected ? state : 'NOT_SELECTED'
  return {
    id: String(check.id),
    arm,
    state: effective,
    detail: String(check.detail ?? ''),
    ...(selected ? {} : { rawState: state }),
    ...(arm !== null && !selected ? { selection: 'arm not selected by this run' } : {}),
  }
}

/**
 * Grade a list of already-normalised checks. `NOT_SELECTED` is excluded from
 * the pass count and from blocking entirely.
 *
 * @param {ReadonlyArray<{ id: string, arm: string|null, state: string }>} checks
 * @returns {{
 *   verdict: string,
 *   reason: string,
 *   counts: Record<string, number>,
 *   blocking: ReadonlyArray<object>,
 *   skipped: ReadonlyArray<string>,
 * }}
 */
export function gradeChecks(checks) {
  const counts = Object.fromEntries(PREFLIGHT_STATES.map((s) => [s, 0]))
  for (const check of checks) {
    if (!PREFLIGHT_STATES.includes(check.state)) {
      throw new TypeError(`boot-preflight: graded check ${check.id} carries ${JSON.stringify(check.state)}`)
    }
    counts[check.state] += 1
  }
  const blocking = checks.filter((c) => c.state !== 'PASS' && c.state !== 'NOT_SELECTED')
  if (blocking.length === 0) {
    return {
      verdict: 'PASS',
      reason: counts.NOT_SELECTED > 0
        ? `every selected check passed; ${counts.NOT_SELECTED} check(s) belong to unselected arms (NOT_SELECTED never blocks)`
        : 'every check passed',
      counts,
      blocking: Object.freeze([]),
      skipped: Object.freeze(checks.filter((c) => c.state === 'NOT_SELECTED').map((c) => c.id)),
    }
  }
  const primary = BLOCKING_PRECEDENCE.find((state) => blocking.some((c) => c.state === state))
  const named = blocking.filter((c) => c.state === primary)
  const first = named[0]
  return {
    verdict: primary,
    reason: `${primary} at ${first.id}${first.detail === '' ? '' : ` (${first.detail})`}`,
    counts,
    blocking: Object.freeze(blocking.map((c) => ({ ...c }))),
    skipped: Object.freeze(checks.filter((c) => c.state === 'NOT_SELECTED').map((c) => c.id)),
  }
}

/**
 * The state of a check whose PREREQUISITE did not pass. Kept in one place so a
 * driver cannot decide "the env broke, call it FAIL" on its own.
 * @param {boolean} prerequisitePassed
 * @param {string} state
 * @returns {string}
 */
export function gatedState(prerequisitePassed, state) {
  assertPreflightState(state)
  return prerequisitePassed ? state : 'NOT_REACHED'
}

// ── individual check families ───────────────────────────────────────────────
//
// Each builder takes plain measured facts and returns {id, arm?, state, detail}.
// They are exported so unit tests can grade a family in isolation and so a
// caller can compose a subset without re-implementing the classification.

/**
 * Required environment variables. Presence is `typeof value === 'string' &&
 * value.length > 0`; a var set to the empty string is ABSENT (shells export
 * empty strings routinely, and a driver configured with `DSH_HOME=` must not
 * look configured).
 */
export function checkEnv({ required = [], provided = {} } = {}) {
  const missing = required.filter((name) => {
    const value = provided[name]
    return typeof value !== 'string' || value.length === 0
  })
  return {
    id: 'env.required',
    state: missing.length === 0 ? 'PASS' : 'ENV_BLOCK',
    detail: missing.length === 0
      ? `${required.length} required env var(s) present`
      : `missing/empty: ${missing.join(', ')}`,
  }
}

/**
 * The pinned host checkout (`tests/paths.mjs` → `TEST_USE_BASELINE_SHA`).
 *
 * A `declared`/`actual` mismatch is a FAIL: the tree DECLARES one host and the
 * checkout that would run is another. A missing checkout or unreadable pin is
 * ENV_BLOCK — there is no host to grade.
 *
 * @param {{ declared?: string, actual?: string|null, checkout?: string|null, porcelainClean?: boolean|null }} input
 */
export function checkHostPin({ declared, actual, checkout, porcelainClean } = {}) {
  if (typeof declared !== 'string' || declared.length === 0) {
    return { id: 'host.pin', state: 'ENV_BLOCK', detail: 'no declared host pin (tests/paths.mjs TEST_USE_BASELINE_SHA is absent)' }
  }
  if (typeof checkout === 'string' && checkout.length > 0 && actual === undefined) {
    return { id: 'host.pin', state: 'ENV_BLOCK', detail: `host checkout absent at ${checkout}` }
  }
  if (typeof actual !== 'string' || actual.length === 0) {
    return { id: 'host.pin', state: 'ENV_BLOCK', detail: 'host SHA could not be read from the pristine checkout' }
  }
  if (actual !== declared) {
    return {
      id: 'host.pin',
      state: 'FAIL',
      detail: `host checkout is ${actual.slice(0, 12)} but the tree pins ${declared.slice(0, 12)} (HOST_PIN_MISMATCH)`,
    }
  }
  if (porcelainClean === false) {
    return { id: 'host.pin', state: 'FAIL', detail: `host checkout is dirty (porcelain not empty) at ${declared.slice(0, 12)}` }
  }
  return { id: 'host.pin', state: 'PASS', detail: `host ${declared.slice(0, 12)} (${porcelainClean === true ? 'porcelain clean' : 'dirtiness not measured'})` }
}

/**
 * Candidate identity. `expectedSha` comes from `--expect-sha` or the candidate
 * manifest; `actualSha` is the SHA the driver is about to boot.
 *
 * - no expected SHA, or no manifest and no flag → ENV_BLOCK (the run cannot say
 *   WHICH candidate it is accepting; this is the "unfrozen candidate" case and
 *   must not become a PASS by default);
 * - an expected SHA that differs from the measured one → FAIL
 *   (`CANDIDATE_SHA_MISMATCH`);
 * - an expected SHA equal to the measured one → PASS.
 */
export function checkCandidate({ expectedSha, actualSha, manifestPath = null, source = null } = {}) {
  if (typeof expectedSha !== 'string' || expectedSha.length === 0) {
    return {
      id: 'candidate.sha',
      state: 'ENV_BLOCK',
      detail: manifestPath === null
        ? 'no --expect-sha and no candidate manifest: the run cannot name the candidate it would boot'
        : `candidate manifest ${manifestPath} carries no sha`,
    }
  }
  if (typeof actualSha !== 'string' || actualSha.length === 0) {
    return { id: 'candidate.sha', state: 'ENV_BLOCK', detail: 'measured candidate SHA is absent' }
  }
  const same = actualSha.startsWith(expectedSha) || expectedSha.startsWith(actualSha)
  return {
    id: 'candidate.sha',
    state: same ? 'PASS' : 'FAIL',
    detail: same
      ? `candidate ${actualSha.slice(0, 12)} matches ${source ?? 'the expected SHA'}`
      : `candidate is ${actualSha.slice(0, 12)} but ${source ?? 'the expected SHA'} is ${expectedSha.slice(0, 12)} (CANDIDATE_SHA_MISMATCH)`,
  }
}

/**
 * Model modalities the run requires (`text` is the only one every pinned host
 * generation supports; an extra modality is compared against the host's
 * DECLARED capability, never guessed).
 *
 * `supported === false` is UNSUPPORTED (a generation fact); `supported` being
 * absent/unknown is ENV_BLOCK (cannot grade what was not declared) — a missing
 * answer is never read as support.
 */
export function checkModalities(modalities = []) {
  const states = modalities.map((entry) => {
    const id = `modality.${String(entry.id)}`
    const common = typeof entry.arm === 'string' && entry.arm.length > 0 ? { arm: entry.arm } : {}
    if (entry.supported === true) return { id, ...common, state: 'PASS', detail: `${entry.id} supported` }
    if (entry.supported === false) {
      return { id, ...common, state: 'UNSUPPORTED', detail: `${entry.id} is not supported by the declared host generation` }
    }
    return { id, ...common, state: 'ENV_BLOCK', detail: `${entry.id} support was not declared (unknown ≠ supported)` }
  })
  if (states.length === 0) return [{ id: 'modality.none', state: 'PASS', detail: 'no modality required by this run' }]
  return states
}

/**
 * Officer count. The Alpha.6 review-routing plane requires EXACTLY ONE live
 * Officer; zero or many is a FAIL (the composition refuses a multi-Officer
 * team). `required: false` makes the count irrelevant (PASS).
 *
 * `scope` distinguishes the two moments the same law is graded: `'declared'`
 * (pre-boot: the blueprint admits exactly one Officer template — the only
 * boot-legal count, since the composition refuses a missing/Leader-equal
 * `officerTemplateId` but tolerates zero live rows) and `'live'` (post-create:
 * exactly one live row carries the template). The default is `'live'`; the
 * detail names which was graded so evidence never reads "live" for a
 * declaration check.
 *
 * @param {{ required?: boolean, count?: number|null, scope?: 'declared'|'live' }} input
 */
export function checkOfficerCount({ required = true, count = null, scope = 'live' } = {}) {
  const what = scope === 'declared' ? 'declared Officer template' : 'live Officer'
  if (required !== true) {
    return { id: 'officer.count', state: 'PASS', detail: 'the run does not require an Officer' }
  }
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
    return { id: 'officer.count', state: 'ENV_BLOCK', detail: `${what} count was not measured` }
  }
  return count === 1
    ? { id: 'officer.count', state: 'PASS', detail: `exactly one ${what}` }
    : { id: 'officer.count', state: 'FAIL', detail: `${count} ${what}(s); the review-routing plane requires exactly 1` }
}

/**
 * Port availability for every port the run will bind.
 *
 * - a port the policy forbids (`:3080`, or any port outside
 *   `TEST_PORT_RANGES`) is FAIL with `PORT_UNSANCTIONED`: using it is a policy
 *   violation, not an environmental accident;
 * - a sanctioned port already in use is ENV_BLOCK (`PORT_BUSY`);
 * - free + sanctioned is PASS.
 *
 * @param {ReadonlyArray<{ port: number, free: boolean|null }>} ports
 * @param {(port: number) => boolean} isSanctioned
 */
export function checkPorts(ports = [], isSanctioned) {
  if (ports.length === 0) return [{ id: 'port.none', state: 'PASS', detail: 'the run binds no port' }]
  return ports.map(({ port, free }) => {
    const id = `port.${port}`
    if (typeof isSanctioned === 'function' && !isSanctioned(port)) {
      return { id, state: 'FAIL', detail: `${port} is outside TEST_PORT_RANGES or is the stable instance (PORT_UNSANCTIONED)` }
    }
    if (free === null || free === undefined) {
      return { id, state: 'ENV_BLOCK', detail: `port ${port} availability was not measured` }
    }
    return free === true
      ? { id, state: 'PASS', detail: `${port} free (loopback)` }
      : { id, state: 'ENV_BLOCK', detail: `port ${port} is already bound (PORT_BUSY)` }
  })
}

/**
 * The World (`DSH_HOME`). A fresh world must live INSIDE the workspace (the
 * file sandbox is workspace-write); `DSH_HOME` equal to a stable instance's
 * home is a FAIL. An unmeasured world is ENV_BLOCK.
 *
 * A kit that SEEDS its world from a prepared fixture also declares that seed
 * here ([`seed`] = `{ path, exists }`). A missing seed is ENV_BLOCK, not a
 * criterion failure: the run cannot start, so nothing about the product was
 * measured — the same distinction that keeps an unselected arm out of `FAIL`.
 *
 * @param {{ dshHome?: string|null, workspaceRoot?: string|null, exists?: boolean|null, ownsStableInstance?: boolean, seed?: { path?: string|null, exists?: boolean|null }|null }} input
 */
export function checkWorld({ dshHome, workspaceRoot, exists, ownsStableInstance = false, seed = null } = {}) {
  if (typeof dshHome !== 'string' || dshHome.length === 0) {
    return { id: 'world.dsh-home', state: 'ENV_BLOCK', detail: 'DSH_HOME is absent' }
  }
  if (typeof workspaceRoot !== 'string' || workspaceRoot.length === 0) {
    return { id: 'world.dsh-home', state: 'ENV_BLOCK', detail: 'workspace root is absent, so containment cannot be graded' }
  }
  if (ownsStableInstance === true) {
    return { id: 'world.dsh-home', state: 'FAIL', detail: `${dshHome} is a stable instance home; a test must never bind :3080's World` }
  }
  const root = workspaceRoot.endsWith('/') ? workspaceRoot : `${workspaceRoot}/`
  if (dshHome !== workspaceRoot && !dshHome.startsWith(root)) {
    return { id: 'world.dsh-home', state: 'FAIL', detail: `${dshHome} is outside the workspace (workspace-write sandbox denies it)` }
  }
  if (seed !== null && typeof seed === 'object') {
    if (seed.exists !== true) {
      return {
        id: 'world.seed',
        state: 'ENV_BLOCK',
        detail: `prepared seed world is absent at ${typeof seed.path === 'string' ? seed.path : '<unmeasured>'} (this kit cannot start without it)`,
      }
    }
    return { id: 'world.dsh-home', state: 'PASS', detail: `${dshHome} (seeded from ${typeof seed.path === 'string' ? seed.path : 'a prepared world'})` }
  }
  return {
    id: 'world.dsh-home',
    state: 'PASS',
    detail: `${dshHome}${exists === false ? ' (fresh world, not yet created)' : ''}`,
  }
}

/**
 * The selected test arms. An arm named in `known` but absent from `selected` is
 * NOT_SELECTED at check level (see {@link recordCheck}); this family records
 * the selection itself so the evidence names the matrix that ran.
 *
 * A selected arm the driver does not know (`selected ⊄ known`) is a FAIL: the
 * run's own declaration is inconsistent.
 */
export function checkArmSelection({ selected = [], known = [] } = {}) {
  const unknown = selected.filter((arm) => !known.includes(arm))
  if (unknown.length > 0) {
    return {
      id: 'arms.selection',
      state: 'FAIL',
      detail: `selected arm(s) not in the declared matrix: ${unknown.join(', ')}`,
    }
  }
  const notSelected = known.filter((arm) => !selected.includes(arm))
  return {
    id: 'arms.selection',
    state: 'PASS',
    detail: `selected=[${selected.join(', ')}]`
      + (notSelected.length === 0 ? '' : `; not selected (NOT_SELECTED, never FAIL): [${notSelected.join(', ')}]`),
  }
}

// ── the composed run ────────────────────────────────────────────────────────

/**
 * Run the whole pre-start preflight over measured facts.
 *
 * @param {object} input
 * @param {{ required?: string[], provided?: Record<string,string|undefined> }} [input.env]
 * @param {{ declared?: string, actual?: string|null, checkout?: string|null, porcelainClean?: boolean|null, arm?: string }} [input.hostPin]
 * @param {{ expectedSha?: string, actualSha?: string, manifestPath?: string|null, source?: string, arm?: string }} [input.candidate]
 * @param {ReadonlyArray<{ id: string, supported?: boolean, arm?: string }>} [input.modalities]
 * @param {{ required?: boolean, count?: number|null, arm?: string }} [input.officer]
 * @param {ReadonlyArray<{ port: number, free: boolean|null }>} [input.ports]
 * @param {(port: number) => boolean} [input.isSanctionedPort]
 * @param {{ dshHome?: string|null, workspaceRoot?: string|null, exists?: boolean|null, ownsStableInstance?: boolean, arm?: string }} [input.world]
 * @param {{ selected?: string[], known?: string[] }} [input.arms]
 * @returns {object} a JSON-serialisable preflight record (see `verdict`)
 */
export function runBootPreflight(input = {}) {
  const selected = Array.isArray(input.arms?.selected) ? [...input.arms.selected] : []
  const known = Array.isArray(input.arms?.known) ? [...input.arms.known] : []
  const raw = []
  const arm = (value) => (typeof value === 'string' && value.length > 0 ? value : undefined)

  raw.push({ id: 'arms.selection', state: checkArmSelection({ selected, known }).state, detail: checkArmSelection({ selected, known }).detail })
  raw.push({ ...checkEnv(input.env ?? {}) })
  raw.push({ ...checkHostPin(input.hostPin ?? {}), arm: arm(input.hostPin?.arm) })
  raw.push({ ...checkCandidate(input.candidate ?? {}), arm: arm(input.candidate?.arm) })
  for (const check of checkModalities(input.modalities ?? [])) raw.push({ ...check })
  raw.push({ ...checkOfficerCount(input.officer ?? {}), arm: arm(input.officer?.arm) })
  for (const check of checkPorts(input.ports ?? [], input.isSanctionedPort)) raw.push({ ...check })
  raw.push({ ...checkWorld(input.world ?? {}), arm: arm(input.world?.arm) })

  // Prerequisite propagation: when a CORE (non-arm) check is not PASS, no arm
  // observable could exist. Arm checks whose raw state is PASS/FAIL become
  // NOT_REACHED; their own NOT_SELECTED is still assigned first by
  // `recordCheck` (selection outranks reachability: an arm nobody selected was
  // never going to run even with a perfect machine).
  const coreOk = raw.every((check) => check.arm !== undefined || check.state === 'PASS')
  const checks = raw.map((check) => {
    const selectedCheck = recordCheck(check, selected)
    if (selectedCheck.state === 'NOT_SELECTED') return selectedCheck
    if (!coreOk && check.arm !== undefined && (check.state === 'PASS' || check.state === 'FAIL')) {
      return { ...selectedCheck, state: 'NOT_REACHED', detail: `${selectedCheck.detail}; core preflight did not pass` }
    }
    return selectedCheck
  })

  const graded = gradeChecks(checks)
  return {
    schema: 'dsh-boot-preflight/1',
    generatedAt: new Date().toISOString(),
    selectedArms: Object.freeze(selected),
    knownArms: Object.freeze(known),
    verdict: graded.verdict,
    reason: graded.reason,
    counts: graded.counts,
    checks,
    blocking: graded.blocking,
    skipped: graded.skipped,
    startAllowed: graded.verdict === 'PASS',
  }
}

/**
 * REFUSE the start unless the preflight is PASS. This is the one call a boot
 * driver must make immediately before `spawn`; it throws
 * {@link BootPreflightRefusal} carrying the typed reason and the blocking
 * checks, so a driver cannot "try anyway".
 *
 * @param {object} preflight the value returned by {@link runBootPreflight}
 * @returns {object} the same preflight (convenient for chaining)
 */
export function assertBootPreflight(preflight) {
  if (preflight === null || typeof preflight !== 'object' || typeof preflight.verdict !== 'string') {
    throw new BootPreflightRefusal('no preflight record', { verdict: 'ENV_BLOCK', blocking: [] })
  }
  if (preflight.verdict === 'PASS') return preflight
  const blocking = Array.isArray(preflight.blocking) ? preflight.blocking : []
  throw new BootPreflightRefusal(preflight.reason ?? `preflight verdict is ${preflight.verdict}`, {
    verdict: preflight.verdict,
    blocking,
  })
}
