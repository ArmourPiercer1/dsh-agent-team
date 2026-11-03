/**
 * a5sf-harness.mjs — R2 (BL-10) engineering-baseline inheritance for the
 * Alpha.5 Sandbox-First C2 suites.
 *
 * WHAT THIS IS: ONE thin adapter that lets a Sandbox-First suite (P2: BL-14…
 * BL-20) reach the four pre-existing pieces of engineering machinery WITHOUT
 * rebuilding any of them. The reclamation rule
 * (`dev/agent-workflow/evidence/a5sf-reclaim/ASSET-RECLAMATION-REGISTRY.md`
 * R2-b) is "inherit the MECHANISM, adapt the interface": this module adds NO
 * launcher, NO budget ledger, NO policy compiler and NO oracle algebra. Each
 * concern is delegated to its single owner and this file only normalises the
 * calls, the refusals and the receipts:
 *
 *   | concern            | owner (reused as-is)                                   | how |
 *   | ------------------ | ------------------------------------------------------ | --- |
 *   | World creation     | `TestWorldFactory` / `TestWorld.createWorld`            | `factory` |
 *   | Host boot          | `TestWorld.startHost` (the ONE DshInstance chain)       | `boot()` |
 *   | Host-start budget  | `createRunRecord().logHostStart / ledgerStartCount` + `run-record.mjs#hostStartBudgetPosition` | `budget()` / `boot()` |
 *   | Fixed candidate    | `TEST_USE_BASELINE_SHA` (`tests/paths.mjs`)             | `candidate()` |
 *   | Member ceiling     | `runtime/member-io-policy` `compileMemberPolicy` (P1-02)| `compileCeiling()` |
 *   | Tool restriction   | `member-io-policy` `projectToolIoRestriction`           | `compileInvocation()` |
 *   | Per-call policy    | `member-io-policy` `compileEffectiveIo` (P1-02)         | `compileInvocation()` |
 *   | Realtime guard     | `team-services` `createMemberFsGuard` (P1-05)           | `installGuard()` |
 *   | Realm install      | `team-services` `installToolBindingRealm` (P1-05)       | `installBindingRealm()` |
 *   | Effect oracle      | `lib/oracle.mjs` `createOracle` / `oraclePaths`        | `oracleFor()` / `judgeEffect()` |
 *   | Failure classify   | `scripts/diag-call-chain.mjs` (PR #394, EB4-B)          | `classifyFailure()` |
 *
 * THE BUDGET LEASE IS A PRECONDITION, NOT A FLAG. `createA5sfHarness` takes the
 * caller's `runRecord` (the object `lib/run-record.mjs#createRunRecord`
 * returns; the C2 runner passes it to every collected suite as `record`) and
 * refuses to construct without its two ledger functions AND a non-empty
 * `record.hostStarts.ledgerPath`. A record with no ledger path is not a lease:
 * `ledgerStartCount()` would answer 0 forever, so a boot would be unbudgeted.
 * `boot()` re-checks the path (a record mutated after construction cannot slip
 * through), asks the ONE gate `run-record.mjs#hostStartBudgetPosition`
 * (imported, not re-derived) for the shared ledger position, appends its own
 * start to that same ledger BEFORE the spawn, and only then calls
 * `world.startHost()`. So the a5sf lane cannot start a Host the ledger does not
 * know about, and a suite that forgot the lease gets a typed refusal instead of
 * a boot.
 *
 * WHY THE P1 MODULES ARRIVE THROUGH A RESOLUTION HOOK: the P1 lanes ship as
 * TypeScript sources (`packages/runtime/member-io-policy/src/*.ts`,
 * `packages/runtime/team-services/src/*.ts`) and P2 suites are plain `.mjs`
 * under `node --test` / `u5-canary-runner.mjs`. `loadPolicySeams()` registers
 * the repo's EXISTING hook (`scripts/run-tests-hooks.mjs`, the one
 * `scripts/run-tests.mjs` already uses for TS-under-plain-node: `.js`→`.ts`
 * sibling resolution + the `vitest` shim) and then imports the P1 modules. No
 * new loader is written here, and no TS file is added or edited.
 *
 * SEAM NOTE (disclosed, not patched): `installToolBindingRealm` is shipped in
 * `packages/runtime/team-services/src/install.ts` but is NOT re-exported by
 * `packages/runtime/team-services/src/index.ts` at this tree; the P1-05 test
 * imports the same deep module (`packages/runtime/test/a5sf-service-install.test.ts:47`).
 * This file does the same instead of editing another lane's TS surface
 * (one-writer rule). See `dev/agent-workflow/evidence/a5sf-r2/README.md` §4.
 *
 * P2 SEAM ADDITION (2026-11-03, additive, default-preserving): the harness now
 * exposes `mountRealm()` — its caller of `team-services#mountA5sfRealm`, the ONE
 * entry point a booted Host would call for an admitted Member — and forwards an
 * optional `onGuardConsult` through `installBindingRealm()` / `mountRealm()`.
 * `mountRealm()` is exercised host-free by
 * `tests/world-factory/a5sf-p2-seam.test.mjs`; no boot, launcher or policy
 * compiler is added here.
 *
 * CORE PATCH BUDGET = 0: nothing here imports or modifies an upstream tree.
 *
 * @module tests/world-factory/lib/a5sf-harness
 */
import { register } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { TEST_USE_BASELINE_SHA } from '../../paths.mjs'
import { DEFAULT_MAX_HOST_STARTS, hostStartBudgetPosition } from './run-record.mjs'
import { createOracle, oraclePaths } from './oracle.mjs'
import { TestWorldFactory } from './world-factory.mjs'

/**
 * The closed TRANSPORT-refusal vocabulary of THIS adapter (budget/world/seam
 * preconditions), deliberately NOT a failure-classification table: a tool or
 * compiler refusal keeps its owner's code verbatim (`compilerCode`, or the PR
 * #394 tool's report). Adding classification rows here would be the second
 * vocabulary R2 forbids; `dev/agent-workflow/evidence/a5sf-r2/README.md` §5
 * discloses the boundary.
 */
export const A5SF_HARNESS_CODES = Object.freeze([
  /** no `runRecord`, no ledger functions, or no shared ledger path was handed in */
  'BUDGET_LEASE_REQUIRED',
  /** the SHARED host-start ledger already holds `maxHostStarts` starts */
  'BUDGET_EXHAUSTED',
  /** the P1 compiler refused the lane (compiler code preserved in `detail.compilerCode`) */
  'UNSUPPORTED_LANE',
  /** the P1 modules cannot be resolved/imported at this `repoRoot` */
  'SEAM_UNAVAILABLE',
  /** no Alpha.4 effective authority was supplied; the compiler never invents one */
  'AUTHORITY_REQUIRED',
  /** `boot()` was called without a World */
  'WORLD_REQUIRED',
])

export class A5sfHarnessError extends Error {
  /**
   * @param {string} code one of {@link A5SF_HARNESS_CODES}
   * @param {string} detail human-readable, never string-matched by callers
   * @param {object} [extra] structured detail (e.g. `{ compilerCode, path }`)
   */
  constructor(code, detail, extra = {}) {
    super(`a5sf harness ${code}: ${detail}`)
    this.name = 'A5sfHarnessError'
    this.code = code
    this.detail = detail
    Object.assign(this, extra)
  }
}

const HOOKS_REGISTERED = new Set()

/**
 * Register the repo's existing TS-under-plain-node hooks once per process.
 * Deliberately NOT a new loader: it is `scripts/run-tests-hooks.mjs`, unchanged.
 */
function registerSeamHooks(repoRoot) {
  const hooks = join(repoRoot, 'scripts', 'run-tests-hooks.mjs')
  if (HOOKS_REGISTERED.has(hooks)) return hooks
  if (!existsSync(hooks)) {
    throw new A5sfHarnessError('SEAM_UNAVAILABLE', `no TS resolution hooks at ${hooks}`, { path: hooks })
  }
  register(pathToFileURL(hooks).href)
  HOOKS_REGISTERED.add(hooks)
  return hooks
}

const SEAM_CACHE = new Map()

/**
 * Import the P1 public seams (compiler + realm/guard) from `repoRoot`.
 *
 * @param {string} repoRoot team-repo checkout that owns `packages/` and `scripts/`
 * @returns {Promise<object>} frozen set of the P1 functions this harness calls
 */
export async function loadPolicySeams(repoRoot) {
  const key = String(repoRoot)
  if (SEAM_CACHE.has(key)) return SEAM_CACHE.get(key)
  const promise = (async () => {
    registerSeamHooks(key)
    try {
      const policy = await import(pathToFileURL(join(key, 'packages', 'runtime', 'member-io-policy', 'src', 'index.ts')).href)
      const services = await import(pathToFileURL(join(key, 'packages', 'runtime', 'team-services', 'src', 'index.ts')).href)
      // Deep import, see the SEAM NOTE in the header: not re-exported by the barrel.
      const servicesDeep = await import(pathToFileURL(join(key, 'packages', 'runtime', 'team-services', 'src', 'install.ts')).href)
      const blueprint = await import(pathToFileURL(join(key, 'packages', 'domain', 'blueprint', 'src', 'index.ts')).href)
      const seams = Object.freeze({
        parseBlueprintV4: blueprint.parseBlueprintV4,
        compileMemberPolicy: policy.compileMemberPolicy,
        projectToolIoRestriction: policy.projectToolIoRestriction,
        compileEffectiveIo: policy.compileEffectiveIo,
        createMemberFsGuard: services.createMemberFsGuard,
        TeamIoDenial: services.TeamIoDenial,
        TEAM_IO_DENIAL_CODES: services.TEAM_IO_DENIAL_CODES,
        installToolBindingRealm: servicesDeep.installToolBindingRealm,
        installMemberIoProviders: services.installMemberIoProviders,
        // P2 seam (additive): the ONE mount entry point + the guard-consult
        // transport, both re-exported by the team-services barrel.
        mountA5sfRealm: services.mountA5sfRealm,
        createGuardConsultFileSink: services.createGuardConsultFileSink,
        readGuardConsultFile: services.readGuardConsultFile,
        observeGuard: services.observeGuard,
        GuardObservationError: services.GuardObservationError,
      })
      const functions = [
        'parseBlueprintV4', 'compileMemberPolicy', 'projectToolIoRestriction', 'compileEffectiveIo',
        'createMemberFsGuard', 'installToolBindingRealm', 'installMemberIoProviders',
        'mountA5sfRealm', 'createGuardConsultFileSink', 'readGuardConsultFile', 'observeGuard',
      ]
      for (const name of functions) {
        if (typeof seams[name] !== 'function') {
          throw new A5sfHarnessError('SEAM_UNAVAILABLE', `P1 seam '${name}' is not a function at ${key}`, { path: key })
        }
      }
      if (!Array.isArray(seams.TEAM_IO_DENIAL_CODES)) {
        throw new A5sfHarnessError('SEAM_UNAVAILABLE', `P1 seam 'TEAM_IO_DENIAL_CODES' is not a code list at ${key}`, { path: key })
      }
      return seams
    } catch (error) {
      if (error instanceof A5sfHarnessError) throw error
      throw new A5sfHarnessError('SEAM_UNAVAILABLE', `P1 seams did not load from ${key}: ${String(error?.message ?? error)}`, { path: key })
    }
  })()
  SEAM_CACHE.set(key, promise)
  // A failed load must not be cached as a permanently broken seam.
  promise.catch(() => SEAM_CACHE.delete(key))
  return promise
}

/** The record's shared-ledger path, or null when the record cannot lease one. */
function ledgerPathOf(runRecord) {
  const ledgerPath = runRecord?.record?.hostStarts?.ledgerPath
  return typeof ledgerPath === 'string' && ledgerPath.trim() !== '' ? ledgerPath : null
}

/** An object that can pay the shared host-start ledger's bill. */
function assertBudgetLease(runRecord) {
  const ok = runRecord !== null && typeof runRecord === 'object' &&
    typeof runRecord.logHostStart === 'function' && typeof runRecord.ledgerStartCount === 'function'
  if (!ok) {
    throw new A5sfHarnessError(
      'BUDGET_LEASE_REQUIRED',
      'createA5sfHarness needs the run record that OWNS the shared host-start ledger (lib/run-record.mjs#createRunRecord): an object with logHostStart() and ledgerStartCount(). Without it a World cannot be booted under a budget, so the harness refuses instead of booting unbudgeted.',
    )
  }
  // A record with no ledger path is NOT a lease: ledgerStartCount() would answer
  // 0 forever, so every boot would be unbudgeted (the 2026-11-02 review's
  // fail-open). Refuse at construction; boot() re-checks the path below.
  if (ledgerPathOf(runRecord) === null) {
    throw new A5sfHarnessError(
      'BUDGET_LEASE_REQUIRED',
      'the run record has no shared host-start ledger path (record.hostStarts.ledgerPath is null/empty); a record without a ledger cannot lease a boot. Pass the ledgerPath that createRunRecord() was given (the C2 runner: --budget-ledger).',
      { field: 'ledgerPath' },
    )
  }
  return runRecord
}

/**
 * Create the a5sf harness over the EXISTING factory/ledger/oracle machinery.
 *
 * @param {object} opts
 * @param {string} opts.repoRoot      team-repo checkout (worktree) that owns `tests/`
 * @param {string} opts.evidenceRoot  gitignored dir for raw logs/RUN evidence
 * @param {string} opts.suite         suite name (e.g. 'a5sf-read'); tag only
 * @param {string} opts.line          World line tag (same rule as `createWorld`)
 * @param {object} opts.runRecord     the caller's shared-ledger run record (REQUIRED)
 * @param {number} [opts.maxHostStarts] cap read against the SHARED ledger (default `DEFAULT_MAX_HOST_STARTS` from `run-record.mjs`, not a local copy)
 * @param {string} [opts.leaseRoot]   shared port-lease dir (forwarded to the factory)
 * @param {string} [opts.hostTree]    pristine host tree (forwarded to the factory)
 */
export function createA5sfHarness(opts = {}) {
  const { repoRoot, evidenceRoot, suite, line, maxHostStarts = DEFAULT_MAX_HOST_STARTS, leaseRoot, hostTree } = opts
  for (const [name, value] of [['repoRoot', repoRoot], ['evidenceRoot', evidenceRoot], ['suite', suite], ['line', line]]) {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new A5sfHarnessError('BUDGET_LEASE_REQUIRED', `createA5sfHarness needs a non-blank '${name}'`, { field: name })
    }
  }
  if (!Number.isInteger(maxHostStarts) || maxHostStarts < 1) {
    throw new A5sfHarnessError('BUDGET_LEASE_REQUIRED', `maxHostStarts must be a positive integer, got ${JSON.stringify(maxHostStarts)}`, { field: 'maxHostStarts' })
  }
  const runRecord = assertBudgetLease(opts.runRecord)
  /** The ONE factory (no second launcher path). */
  const factory = new TestWorldFactory({ repoRoot, evidenceRoot, leaseRoot, hostTree })

  /** Current position of the SHARED ledger this run is charged against. */
  function budget() {
    // ONE gate: `run-record.mjs` owns the `used >= max` formula and the default
    // cap; this adapter only carries its position unchanged.
    return hostStartBudgetPosition(runRecord, maxHostStarts)
  }

  const harness = {
    suite,
    line,
    factory,

    /**
     * The FIXED candidate, read from `tests/paths.mjs` — never copied. `assert`
     * additionally runs the factory's own read-only host-base guard (HEAD == pin,
     * porcelain empty) and therefore requires a real pristine host tree.
     */
    candidate() {
      return Object.freeze({ pin: TEST_USE_BASELINE_SHA, source: 'tests/paths.mjs#TEST_USE_BASELINE_SHA', hostTree: factory.hostTree, asserted: false })
    },
    assertCandidate() {
      const base = factory.assertHostBase('a5sf-harness')
      return Object.freeze({ pin: TEST_USE_BASELINE_SHA, source: 'tests/paths.mjs#TEST_USE_BASELINE_SHA', hostTree: factory.hostTree, asserted: true, head: base.head })
    },

    budget,
    /** The caller's run record (same object, for evidence binding). */
    runRecord,

    /** Create one World through the EXISTING factory API. */
    async createWorld(worldOptions) {
      return factory.createWorld(worldOptions)
    },

    /**
     * Boot a World under the SHARED budget ledger.
     *
     * Order is the law: (0) the record still carries a shared ledger path,
     * (1) ledger position check, (2) append THIS start to the same ledger,
     * (3) `world.startHost()` (the one launcher). A refusal in (0)/(1) leaves
     * the ledger and the World untouched — no spawn happens.
     */
    async boot({ world, phase = 'a5sf-boot1', bootTimeoutMs } = {}) {
      if (world === null || world === undefined || typeof world.startHost !== 'function') {
        throw new A5sfHarnessError('WORLD_REQUIRED', 'boot() needs a World created by this harness (createA5sfHarness().createWorld())', {})
      }
      if (ledgerPathOf(runRecord) === null) {
        throw new A5sfHarnessError(
          'BUDGET_LEASE_REQUIRED',
          'the run record no longer carries a shared host-start ledger path; refusing to boot unbudgeted (no ledger, no boot)',
          { field: 'ledgerPath', worldId: world.id },
        )
      }
      const position = budget()
      if (position.exhausted) {
        throw new A5sfHarnessError(
          'BUDGET_EXHAUSTED',
          `the shared host-start ledger already holds ${String(position.used)} >= ${String(maxHostStarts)} starts; refusing to boot ${world.id}`,
          { budget: position, worldId: world.id },
        )
      }
      runRecord.logHostStart({ world: world.id, phase, suite })
      return world.startHost(bootTimeoutMs === undefined ? {} : { bootTimeoutMs })
    },

    /**
     * Compile one Member ceiling through P1-02. The Alpha.4 authority is a
     * REQUIRED input: the compiler consumes it and this adapter will not
     * synthesise an admission fact on a caller's behalf.
     *
     * @param {object} input
     * @param {object|string} input.blueprint  parsed v4 blueprint, or its YAML body
     * @param {string} input.templateId
     * @param {string} input.memberInstanceId  trusted TeamDomain instance id
     * @param {number} input.instanceGeneration
     * @param {object} input.authority `{ revision, admitted, memberInstanceId?, instanceGeneration? }` (Alpha.4 fact)
     * @param {string} [input.teamId] defaults to the blueprint's own `blueprintId`
     */
    async compileCeiling(input = {}) {
      const { blueprint, templateId, memberInstanceId, instanceGeneration, authority, teamId } = input
      if (authority === null || typeof authority !== 'object' || typeof authority.revision !== 'string') {
        throw new A5sfHarnessError('AUTHORITY_REQUIRED', 'compileCeiling needs the Alpha.4 effective authority ({ revision, admitted, … }); the compiler never recomputes or invents approval state', {})
      }
      const seams = await loadPolicySeams(String(repoRoot))
      let parsed = blueprint
      let parseError = null
      if (typeof blueprint === 'string') {
        try {
          parsed = seams.parseBlueprintV4(`---\n${blueprint}\n---\n`)
        } catch (error) {
          parseError = error
        }
      }
      if (parseError !== null || parsed === null || typeof parsed !== 'object') {
        return Object.freeze({
          ok: false,
          code: 'BLUEPRINT_MALFORMED',
          detail: String(parseError?.message ?? 'blueprint is neither a parsed v4 blueprint nor a YAML body'),
          path: 'blueprint',
        })
      }
      const member = {
        teamId: teamId ?? parsed.blueprintId,
        memberInstanceId,
        templateId,
        instanceGeneration,
      }
      const result = seams.compileMemberPolicy({
        trustedMember: member,
        boundBlueprint: { teamId: member.teamId, blueprint: parsed },
        effectiveAuthority: {
          revision: authority.revision,
          admitted: authority.admitted,
          memberInstanceId: authority.memberInstanceId ?? memberInstanceId,
          instanceGeneration: authority.instanceGeneration ?? instanceGeneration,
        },
      })
      if (!result.ok) return Object.freeze({ ...result, member })
      return Object.freeze({ ok: true, policy: result.value, member, authorizationSource: 'caller-supplied Alpha.4 authority' })
    },

    /**
     * Same as `compileCeiling`, but a refusal becomes a typed `UNSUPPORTED_LANE`
     * throw (the compiler's own code stays in `error.compilerCode`). Use this
     * when the suite's case verdict depends on the lane being expressible: an
     * unsupported lane is a case result, never a silent allow.
     */
    async requireCeiling(input) {
      const result = await harness.compileCeiling(input)
      if (result.ok) return result
      throw new A5sfHarnessError('UNSUPPORTED_LANE', `${result.code}: ${result.detail}`, { compilerCode: result.code, path: result.path, member: result.member ?? null })
    },

    /**
     * Ask P1-05 for the realtime admission guard over the compiled ceiling.
     * Returns the SAME policy object (identity, not a copy) so a caller can
     * assert the installed decision is the compiled `MemberPolicy`.
     */
    async installGuard(policy) {
      if (policy === null || typeof policy !== 'object' || typeof policy.memberIdentity !== 'string') {
        throw new A5sfHarnessError('UNSUPPORTED_LANE', 'installGuard needs a compiled MemberPolicy from compileCeiling()', {})
      }
      const seams = await loadPolicySeams(String(repoRoot))
      return Object.freeze({ policy, revision: policy.revision, guard: seams.createMemberFsGuard(policy), TeamIoDenial: seams.TeamIoDenial })
    },

    /**
     * Project one v4 tool binding (RIGHT factor) and intersect it with the
     * Member ceiling for ONE bound call (P1-02 `compileEffectiveIo`).
     */
    async compileInvocation({ policy, toolBinding, invocation } = {}) {
      const seams = await loadPolicySeams(String(repoRoot))
      const tool = seams.projectToolIoRestriction(toolBinding)
      if (!tool.ok) return Object.freeze({ ...tool })
      const effective = seams.compileEffectiveIo(policy, tool.value, invocation)
      if (!effective.ok) return Object.freeze({ ...effective })
      return Object.freeze({ ok: true, tool: tool.value, effective: effective.value })
    },

    /**
     * Mount the confined Provider for ONE (Member × tool binding) realm through
     * the shipped P1-05 installer. Requires the live Cordis root of a booted
     * World — this adapter passes the call through and adds nothing.
     *
     * P2 seam (additive): `onGuardConsult` is forwarded to the installer's own
     * observer input, so a suite observes each consultation of THIS realm
     * without a second install path. Omitted = the installer's default path.
     */
    async installBindingRealm({ root, identity, toolBindingIdentity, effective, config, providerClass, onGuardConsult } = {}) {
      const seams = await loadPolicySeams(String(repoRoot))
      return seams.installToolBindingRealm({
        root,
        spec: { identity, toolBindingIdentity, effective, ...(config === undefined ? {} : { config }) },
        ...(providerClass === undefined ? {} : { providerClass }),
        ...(onGuardConsult === undefined ? {} : { onGuardConsult }),
      })
    },

    /**
     * Mount a Member's COMPILED realm (ceiling + its binding realms) through the
     * ONE P2 entry point `team-services#mountA5sfRealm`. This is the harness's
     * caller of the production mount: it adds no launcher, no compiler and no
     * policy logic — the caller supplies the root Context and the compiled
     * objects. Omitted `onGuardConsult` = the entry point's default path.
     */
    async mountRealm({ root, members, bindings, providerClass, onGuardConsult } = {}) {
      if (root === undefined || root === null) {
        throw new A5sfHarnessError('WORLD_REQUIRED', 'mountRealm needs the live Cordis root of a booted World (or an in-process unit root)', {})
      }
      const seams = await loadPolicySeams(String(repoRoot))
      return seams.mountA5sfRealm({
        root,
        members,
        ...(bindings === undefined ? {} : { bindings }),
        ...(providerClass === undefined ? {} : { providerClass }),
        ...(onGuardConsult === undefined ? {} : { onGuardConsult }),
      })
    },

    /**
     * The effect Oracle over a World (or any `oraclePaths`-shaped object).
     * Delegates to `lib/oracle.mjs`; no second verdict algebra.
     */
    oracleFor(target, { hostLogPath, broken = null } = {}) {
      const paths = target !== null && typeof target === 'object' && typeof target.home === 'string' && typeof target.markerDir === 'string'
        ? oraclePaths(target, hostLogPath)
        : { ...target }
      return createOracle(paths, broken === null ? {} : { broken })
    },

    /**
     * Observe + judge one tag. The tool's OWN claim (`returnedRan`) is passed
     * through for the record only: the sound Oracle never reads it.
     */
    judgeEffect({ oracle, tag, returnedRan, resultErrored = false, minLedgerRows = 0 } = {}) {
      const observation = oracle.observe({ tag, minLedgerRows })
      const verdict = oracle.effect(observation, { returnedRan, resultErrored })
      return Object.freeze({ oracleId: oracle.id, tag, effect: verdict.effect, basis: verdict.basis, verdict, observation })
    },

    /**
     * Failure classification, delegated to the EXISTING PR #394 tool
     * (`scripts/diag-call-chain.mjs`, EB4-B static attribution).
     *
     * Two honest arms:
     *  - a refusal LINE (`a5p5-refused kind=… code=… detail=…`, a
     *    `shadow-verdict` JSONL row, or `{ text }`) → the tool's own JSON report;
     *  - a P1 compiler refusal (`{ ok:false, code, detail, path }`) → the P1
     *    code verbatim plus `classified:false`. The PR #394 table's vocabulary
     *    is the Alpha.5 tool-io one; it has NO a5sf emitter rows, and where a
     *    STRING overlaps (`IO_POLICY_UNSUPPORTED`) its row names the Alpha.5
     *    faces, not `member-io-policy/compile.ts`. Quoting that row for an a5sf
     *    refusal would be a cross-vocabulary misattribution, so this adapter
     *    reports the compiler's own code instead of inventing a table.
     */
    async classifyFailure(input) {
      const diagPath = join(repoRoot, 'scripts', 'diag-call-chain.mjs')
      if (input !== null && typeof input === 'object' && input.ok === false && typeof input.code === 'string') {
        let overlapping = false
        if (existsSync(diagPath)) {
          const diag = await import(pathToFileURL(diagPath).href)
          overlapping = Object.hasOwn(diag.FACE_TABLE, input.code)
        }
        return Object.freeze({
          ok: false,
          vocabulary: 'a5sf-member-io-policy',
          classified: false,
          code: input.code,
          detail: input.detail ?? null,
          path: input.path ?? null,
          overlappingAlpha5String: overlapping,
          note: 'PR #394 diag-call-chain owns the Alpha.5 tool-io vocabulary, not the a5sf two-axis codes; no row was added (a second classification table is exactly what R2 forbids). Cite packages/runtime/member-io-policy/src/compile.ts for this code.',
        })
      }
      if (!existsSync(diagPath)) {
        return Object.freeze({ ok: false, classification: 'UNCLASSIFIABLE_TOOL_ABSENT', detail: `no PR #394 diagnostics tool at ${diagPath}` })
      }
      const diag = await import(pathToFileURL(diagPath).href)
      const text = typeof input === 'string' ? input : String(input?.text ?? '')
      const out = diag.diagnose(text, { json: true, kind: input?.kind ?? null })
      if (out.exit === 2) return Object.freeze({ ok: false, classification: 'REFUSED', delegatedTo: 'scripts/diag-call-chain.mjs', detail: String(out.stdout).trim() })
      const report = JSON.parse(out.stdout)
      return Object.freeze({ ok: true, classified: true, delegatedTo: 'scripts/diag-call-chain.mjs#diagnose', exit: out.exit, report })
    },
  }
  return Object.freeze(harness)
}

/**
 * Read the harness's own source and report whether the pinned candidate SHA is
 * copied into it. Exposed for the C1 test: the pin must be IMPORTED, so the
 * literal must not appear. (The test supplies the pin it read from
 * `tests/paths.mjs`; this helper only reads this file's bytes.)
 */
export function harnessSourceText() {
  return readFileSync(new URL(import.meta.url), 'utf8')
}
