/**
 * a5sf-candidate1-realm-provider-row.mjs — the BOOT COMPOSITION half of the
 * candidate-1 FS/Search regression (allocation #1 of 5, 2026-11-06).
 *
 * DERIVED FROM `evidence/a5sf-search-live/a5sf-search-realm-provider-row.mjs`
 * (the accepted search composition) with ONE addition: the compiled realm also
 * answers an fs ToolBinding (`bindings[]`), so the SAME Member carries the
 * accepted FS read/write lanes (M-01/M-02) AND the confined subprocess face
 * (M-06/M-07). Every other line — the lane algebra, the confined provider, the
 * counters — is the accepted row, edited only for the composite.
 *
 * WHAT IT SUPPLIES: the `teamA5sfRealm` service the production row reads
 * (`packages/runtime/src/plugin/live/host.ts`; the glue mounts a Member realm
 * iff BOTH `config.a5sfEvidencePath` AND that service exist). This row is the
 * live analogue of the P2-01 read row (`evidence/a5sf-preflight/
 * a5sf-realm-provider-row.mjs`) EXTENDED by exactly one thing: the compiled
 * realm now also answers a confined `subprocess` face
 * (`ConfinedSubprocessRealmSpec`, BL-16), so the routed native
 * `@deepseek-ai/dsh-tool-fs-search` module — which injects
 * `["tools","systemPrompt","subprocess"]` — executes a Member's `grep`/`glob`
 * through the confined face instead of the inherited host service.
 *
 * WHAT IS PRODUCT AND WHAT IS FIXTURE (stated so it cannot be read as more):
 *   - the CEILING and the RESTRICTION *inputs* are composed here (fixtures);
 *     no product v3 blueprint -> compiled lane bridge exists at this base;
 *   - the INTERSECTION is the PRODUCT's algebra (`intersectPathRuleSets` /
 *     `matchLocator` from the emitted `member-io-policy/src/path-rules.js`);
 *   - the GUARD (`createMemberSubprocessGuard`), the confined process class
 *     (`createConfinedSubprocessClass`), the OS profile
 *     (`compileExecutionProfile`, P1-07 Landlock) and the binding-realm
 *     installer are the SHIPPED ones, called by the product row;
 *   - the raw OS provider is P1-07's, created here because the composition that
 *     owns the launcher pin is this row (the realm must not guess an assembly);
 *   - COUNTERS are test instrumentation (the shipped provider has no counter):
 *     they record which SERVICE served a call — the inherited base
 *     `subprocess` service or the confined face's raw provider. They decide
 *     nothing and never break the host call they observe.
 *   - CANCELLATION is NOT this row's job: the driver aborts the running tool
 *     call through the SHIPPED client route `/api/session/cancel`
 *     (`session-controller/commands.ts` -> `agent.cancel({kind:'user'})`), so
 *     the trigger is a product route and nothing here composes a cancel.
 *
 * NOT CLAIMED: that the acceptance preset supplies this face by itself. It does
 * not — this row is test composition, exactly like the ceiling inputs (see the
 * evidence README's "what the live preset actually supplies" section).
 *
 * @module dev/agent-workflow/evidence/a5sf-search-live/a5sf-search-realm-provider-row
 */
import { accessSync, appendFileSync, constants, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const name = 'a5sf-search-realm-provider'
/** `ctx.provide` needs no injection; the counters inject their own (`fs`,
 *  `subprocess`). */
export const inject = []

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..', '..', '..', '..')
const DIST = join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime')

const pathRules = await import(pathToFileURL(join(DIST, 'member-io-policy', 'src', 'path-rules.js')).href)
const providerModule = await import(pathToFileURL(join(DIST, 'sandbox-provider', 'provider.js')).href)

const LAUNCHER = join(REPO_ROOT, 'packages', 'runtime', 'sandbox-provider', 'launcher', 'landlock-prelauncher.py')
const LAUNCHER_SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')

const READ_METHODS = Object.freeze(['readText', 'streamText', 'readBytes', 'readByteRange'])
const WRITE_METHODS = Object.freeze(['writeText', 'editText'])
const FS_COUNTER_MARK = Symbol.for('a5sf.search.base-fs-counter')
const SUB_COUNTER_MARK = Symbol.for('a5sf.search.base-subprocess-counter')

// ─────────────────────────────────────────────────────────────────────────────
// counters (test instrumentation — they decide nothing)
// ─────────────────────────────────────────────────────────────────────────────

function recorder(ledgerPath) {
  return (row) => {
    try {
      mkdirSync(dirname(ledgerPath), { recursive: true })
      appendFileSync(ledgerPath, JSON.stringify({ at: new Date().toISOString(), ...row }) + '\n')
    } catch {
      /* instrumentation is best-effort: never break a host call */
    }
  }
}

/** Wrap the BASE `fs` provider class (the P2-01 counter, kept so a search run
 *  also proves the fs face was not the one serving search). */
function installFsCounter(fsCtx, ledgerPath) {
  const baseFs = fsCtx.get('fs')
  if (baseFs === undefined || baseFs === null) return
  const ctor = Object.getPrototypeOf(baseFs)?.constructor
  if (typeof ctor !== 'function') return
  const proto = ctor.prototype
  const record = recorder(ledgerPath)
  if (proto[FS_COUNTER_MARK] === true) return
  const instanceIds = new WeakMap()
  let nextInstance = 0
  const instanceOf = (instance) => {
    if (!instanceIds.has(instance)) {
      instanceIds.set(instance, `fs-${String(nextInstance)}`)
      nextInstance += 1
    }
    return instanceIds.get(instance)
  }
  const baseInstance = instanceOf(baseFs)
  const patched = []
  const wrap = (method, leg) => {
    const original = proto[method]
    if (typeof original !== 'function') return
    Object.defineProperty(proto, method, {
      configurable: true,
      writable: true,
      value: function instrumentedProviderCall(...args) {
        const target = args[0]
        const path = typeof target === 'object' && target !== null
          ? String(target.targetKey ?? target.displayPath ?? '')
          : String(target ?? '')
        record({ leg, method, path, instance: instanceOf(this), isBase: this === baseFs })
        return original.apply(this, args)
      },
    })
    patched.push(method)
  }
  for (const method of READ_METHODS) wrap(method, 'read-call')
  for (const method of WRITE_METHODS) wrap(method, 'write-call')
  Object.defineProperty(proto, FS_COUNTER_MARK, { configurable: true, writable: true, value: true })
  record({
    leg: 'fs-counter-installed',
    baseCtor: ctor.name,
    baseInstance,
    methods: patched,
    note: 'test composition instrumentation; a refused call never reaches a wrapped method',
  })
}

/**
 * Wrap the BASE `subprocess` service's `spawn` — the inherited service the
 * native search module used before BL-16. A `base-spawn` record is the live
 * proof that a search executed UNCONFINED (the negative control); the confined
 * face overrides `spawn` on its own class, so a confined call never produces
 * one. `spawnStreaming` is deliberately not wrapped: the search module calls
 * `spawn`, and wrapping the parent arm would blur the discrimination.
 */
export function installBaseSubprocessCounter(subCtx, ledgerPath) {
  const base = subCtx.get('subprocess')
  if (base === undefined || base === null) return
  const ctor = Object.getPrototypeOf(base)?.constructor
  if (typeof ctor !== 'function') return
  const proto = ctor.prototype
  const record = recorder(ledgerPath)
  if (proto[SUB_COUNTER_MARK] === true) return
  const original = proto.spawn
  if (typeof original !== 'function') return
  Object.defineProperty(proto, 'spawn', {
    configurable: true,
    writable: true,
    value: function instrumentedBaseSpawn(spec) {
      let argv = []
      try { argv = Array.isArray(spec?.argv) ? spec.argv.map((a) => String(a)) : [] } catch { argv = [] }
      const cwd = String(spec?.cwd ?? '')
      record({ leg: 'base-spawn', argv, cwd, instance: this === base })
      try {
        // F1 (2026-11-04T15:56Z, evidence/README.md §4) WAS this line's shape:
        // `original.apply(this, spec)` — `apply` takes an ARRAY-LIKE argument
        // list, so a spec OBJECT becomes ZERO arguments and the pinned service
        // received `spawn(undefined)`. It threw synchronously (the spec
        // validator reads `spec.graceMs`, spawn.ts:165), the search module
        // wrapped that into its one-line "ripgrep launch failed" text, and BOTH
        // unconfined arms of the negative control were broken by the
        // instrumentation that was supposed to observe them.
        return original.call(this, spec)
      } catch (error) {
        // F1 (2026-11-04T15:56Z, evidence/README.md §4): the booted World's base
        // spawn failed SYNCHRONOUSLY and threw its cause away. The search module
        // collapses every launch-time failure into one model-facing line, and
        // the host log died with the World home, so F1's cause was
        // unrecoverable. This is the smallest fix at the only layer that sees
        // both: record the failure's Node fields AND the reachability of the
        // two objects a spawn can fail on (argv[0] and cwd — Node names argv[0]
        // for a bad cwd too). Record, then rethrow unchanged: instrumentation
        // still decides nothing.
        record({
          leg: 'base-spawn-failed',
          argv,
          cwd,
          instance: this === base,
          cause: describeSpawnError(error),
          reach: spawnReach(argv[0], cwd),
        })
        throw error
      }
    },
  })
  Object.defineProperty(proto, SUB_COUNTER_MARK, { configurable: true, writable: true, value: true })
  record({ leg: 'base-subprocess-counter-installed', baseCtor: ctor.name, note: 'test composition instrumentation; records only the inherited service arm' })
}

/**
 * The Node fields one synchronous `spawn` throw carries. `code` alone is
 * ambiguous (`ENOENT` is "program missing" OR "cwd missing"), so `syscall` and
 * `path` are recorded verbatim instead of reconstructed.
 * @param error - the value thrown by `spawn`.
 * @returns the recorded cause projection (every field a string or null).
 */
function describeSpawnError(error) {
  const value = typeof error === 'object' && error !== null ? error : {}
  const text = (name) => (typeof value[name] === 'string' ? value[name] : null)
  return {
    name: typeof value.name === 'string' ? value.name : typeof error,
    code: text('code'),
    errno: typeof value.errno === 'number' ? value.errno : null,
    syscall: text('syscall'),
    path: text('path'),
    message: typeof value.message === 'string' ? value.message : String(error),
  }
}

/**
 * Probe (never create) the state of the objects a spawn can fail on, so a
 * captured code can be attributed: program present + cwd absent is a WORKDIR
 * failure, not a missing ripgrep.
 * @param program - the spec's argv[0].
 * @param cwd - the spec's cwd.
 * @returns reachability rows for the program, the workdir and `os.tmpdir()`.
 */
function spawnReach(program, cwd) {
  const executable = (path) => {
    try {
      accessSync(path, constants.X_OK)
      return true
    } catch {
      return false
    }
  }
  const file = (target) => {
    const path = String(target ?? '')
    try {
      const info = statSync(path)
      return { path, exists: true, directory: info.isDirectory(), file: info.isFile(), executable: executable(path) }
    } catch {
      return { path, exists: false, directory: false, file: false, executable: false }
    }
  }
  return { program: file(program), cwd: file(cwd), tmpdir: file(tmpdir()) }
}

/** Wrap P1-07's raw provider so the confined face's SPAWN and EXIT are visible
 *  as records. The handle's `exited` promise is the OS outcome (code/signal);
 *  the module consumes the same handle unchanged. */
const STDERR_CAPTURE_BYTES = 8192

function countedProvider(inner, ledgerPath, realmTag) {
  const record = recorder(ledgerPath)
  return {
    async spawnStreaming(request, streaming) {
      const argv = Array.isArray(request?.argv) ? request.argv.map((a) => String(a)) : []
      record({ leg: 'confined-spawn', realm: realmTag, argv, cwd: String(request?.cwd ?? '') })
      const spawned = await inner.spawnStreaming(request, streaming)
      // STDERR MUST OUTLIVE THE SPAWN. Row 1's risk is an in-lane grep exiting 2,
      // and the pinned module maps exit not in {0,1} to SearchError, which hides the
      // payload's own complaint. `stderr` is a Readable on the handle; a `data`
      // listener is a broadcast, so the module's own consumption is untouched. The
      // bytes go into the exit row, and the counter is copied OUT of the World home
      // before teardown — so the reason survives the world it was measured in.
      const stderrChunks = []
      let stderrBytes = 0
      const handleStderr = spawned?.value?.stderr ?? null
      if (handleStderr !== null && typeof handleStderr?.on === 'function') {
        handleStderr.on('data', (chunk) => {
          if (stderrBytes >= STDERR_CAPTURE_BYTES) return
          const buf = Buffer.from(chunk)
          stderrChunks.push(buf)
          stderrBytes += buf.length
        })
      }
      if (spawned !== null && spawned !== undefined && spawned.ok === true && spawned.value !== null && spawned.value !== undefined) {
        const exited = spawned.value.exited
        if (exited !== null && exited !== undefined && typeof exited.then === 'function') {
          exited.then((outcome) => {
            record({ leg: 'confined-exit', realm: realmTag, argv, code: outcome?.code ?? null, signal: outcome?.signal ?? null, stderr: Buffer.concat(stderrChunks).toString('utf8').slice(0, STDERR_CAPTURE_BYTES), stderrBytes })
          }).catch(() => {
            record({ leg: 'confined-exit', realm: realmTag, argv, code: null, signal: 'exit-unavailable', stderr: Buffer.concat(stderrChunks).toString('utf8').slice(0, STDERR_CAPTURE_BYTES), stderrBytes })
          })
        }
      } else {
        record({ leg: 'confined-spawn-failed', realm: realmTag, argv, ok: spawned?.ok ?? null })
      }
      return spawned
    },
    probe: () => inner.probe(),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// the lane composition (the product's own algebra)
// ─────────────────────────────────────────────────────────────────────────────

function lane(mode, allow) {
  return Object.freeze({ mode, allow: Object.freeze([...allow]), ask: Object.freeze([]), deny: Object.freeze([]) })
}

function disposition(laneValue, locator) {
  return {
    locator,
    decision: pathRules.matchLocator(laneValue, locator),
    laneCoversAllow: pathRules.laneCoversAllow(laneValue, locator),
    locatorWithinRuleSet: pathRules.locatorWithinRuleSet(laneValue, locator),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// the row
// ─────────────────────────────────────────────────────────────────────────────

export function apply(ctx, config) {
  const allowRoot = typeof config?.allowRoot === 'string' ? config.allowRoot.trim() : ''
  if (allowRoot === '') {
    throw new TypeError('a5sf-candidate1-realm-provider: config.allowRoot (the compiled ceiling root) is required')
  }
  const restrictionReadAllow = Array.isArray(config?.restrictionReadAllow)
    ? config.restrictionReadAllow.filter((entry) => typeof entry === 'string' && entry.trim() !== '')
    : []
  if (restrictionReadAllow.length === 0) {
    throw new TypeError('a5sf-candidate1-realm-provider: config.restrictionReadAllow (the narrower ToolBinding read allow list) is required')
  }
  const bindingIdentity = typeof config?.bindingIdentity === 'string' && config.bindingIdentity.trim() !== ''
    ? config.bindingIdentity.trim()
    : 'dsh.search/grep'
  const fsBindingIdentity = typeof config?.fsBindingIdentity === 'string' && config.fsBindingIdentity.trim() !== ''
    ? config.fsBindingIdentity.trim()
    : 'dsh.fs/read'
  const probePaths = Array.isArray(config?.laneProbePaths)
    ? config.laneProbePaths.filter((entry) => typeof entry === 'string')
    : []
  const scratchRoot = typeof config?.scratchRoot === 'string' ? config.scratchRoot.trim() : ''
  if (scratchRoot === '') throw new TypeError('a5sf-candidate1-realm-provider: config.scratchRoot is required (the OS provider scratch root, inside the World home)')
  const counterPath = typeof config?.counterPath === 'string' ? config.counterPath.trim() : ''
  if (counterPath === '') throw new TypeError('a5sf-candidate1-realm-provider: config.counterPath is required')

  // ── the two authored factors (fixtures) ──────────────────────────────────
  const ceilingRead = lane('restricted', [allowRoot])
  const ceilingWrite = lane('restricted', [allowRoot])
  const restrictionRead = lane('restricted', restrictionReadAllow)
  /** `no-additional-narrowing` — the v4 `mode: all` authoring (it declares no
   *  path, so it contributes no narrowing and cannot widen anything). */
  const restrictionWrite = 'no-additional-narrowing'

  // ── the intersection: the PRODUCT's own algebra ──────────────────────────
  const effectiveRead = pathRules.intersectPathRuleSets(ceilingRead, restrictionRead)
  const effectiveWrite = restrictionWrite === 'no-additional-narrowing'
    ? Object.freeze({ mode: ceilingWrite.mode, allow: ceilingWrite.allow, ask: ceilingWrite.ask, deny: ceilingWrite.deny })
    : pathRules.intersectPathRuleSets(ceilingWrite, restrictionWrite)
  /** The fs ToolBinding the SAME Member carries so the accepted FS read/write
   *  rows (M-01/M-02) can be re-measured on the same Host start as the search
   *  rows. The lane INPUTS and the intersection are the ones above; only the
   *  binding identity differs (the read tool's own identity), so the fact
   *  stream still splits realm=binding / toolBindingIdentity=dsh.fs/read for
   *  reads and realm=member / null for writes. */

  const report = {
    schema: 'a5sf-tool-binding-lane-report/1',
    kind: 'search',
    computedBy: 'packages/runtime/dist/packages/runtime/member-io-policy/src/path-rules.js # intersectPathRuleSets / matchLocator (the emitted product algebra; compileEffectiveIo is not in the host emitted set at this base)',
    bindingIdentity,
    fsBindingIdentity,
    ceiling: { read: ceilingRead, write: ceilingWrite },
    restriction: { read: restrictionRead, write: restrictionWrite },
    effective: { read: effectiveRead, write: effectiveWrite },
    probePaths: probePaths.map((locator) => ({
      locator,
      ceilingRead: disposition(ceilingRead, locator).decision,
      restrictionRead: disposition(restrictionRead, locator).decision,
      effectiveRead: disposition(effectiveRead, locator).decision,
    })),
    note: 'the CEILING and RESTRICTION inputs are test-composition fixtures (no product v3->compiled lane bridge at this base); the intersection and the dispositions are the product functions, called here. The confined `subprocess` face is a MEMBER-realm face (BL-17 refuses a binding-realm one), so its facts carry realm=member and toolBindingIdentity=null. The FS binding realm carries toolBindingIdentity=dsh.fs/read, so the same Member measures the accepted FS read/write rows on the same start.',
  }
  const reportPath = typeof config?.laneReportPath === 'string' ? config.laneReportPath.trim() : ''
  if (reportPath !== '') {
    mkdirSync(dirname(reportPath), { recursive: true })
    writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n')
  }

  /** One raw OS provider per Member (the launcher pin belongs to this row). */
  const providers = new Map()
  const providerFor = (instanceId) => {
    const cached = providers.get(instanceId)
    if (cached !== undefined) return cached
    const raw = providerModule.createConfinedProcessProvider({
      realmId: `member:${instanceId}`,
      trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
      scratchRoot: join(scratchRoot, instanceId),
      assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
    })
    const counted = countedProvider(raw, counterPath, `member:${instanceId}`)
    providers.set(instanceId, counted)
    return counted
  }

  const provider = {
    /** The lazy `compiledFor` accessor `host.ts` forwards. */
    compiledFor(member) {
      const instanceId = String(member?.instanceId ?? '')
      if (instanceId === '') return undefined
      const templateId = String(member?.templateId ?? 'worker')
      const instanceGeneration = 1
      const revision = `a5sf-search:${instanceId}:g${String(instanceGeneration)}`
      const identity = Object.freeze({
        teamId: 'team-a5sf-search',
        memberInstanceId: instanceId,
        templateId,
        instanceGeneration,
      })
      const policy = Object.freeze({
        memberIdentity: instanceId,
        templateId,
        instanceGeneration,
        revision,
        read: ceilingRead,
        write: ceilingWrite,
        network: Object.freeze({ access: 'allow' }),
      })
      /** The effective policy the confined SEARCH face enforces: the product's
       *  `ceiling ∩ restriction`. It is the same object the binding realm would
       *  receive; BL-17 is why there is no binding realm to receive it. */
      const effective = Object.freeze({
        memberIdentity: instanceId,
        toolBindingIdentity: bindingIdentity,
        invocationId: `a5sf-search:${instanceId}:${bindingIdentity}`,
        policyRevision: revision,
        read: effectiveRead,
        write: effectiveWrite,
        network: Object.freeze({ access: 'allow' }),
      })
      const fsEffective = Object.freeze({
        memberIdentity: instanceId,
        toolBindingIdentity: fsBindingIdentity,
        invocationId: `a5sf-candidate1:${instanceId}:${fsBindingIdentity}`,
        policyRevision: revision,
        read: effectiveRead,
        write: effectiveWrite,
        network: Object.freeze({ access: 'allow' }),
      })
      return {
        members: [{ identity, policy: { ok: true, value: policy } }],
        // The FS binding realm (accepted FS composition). A binding realm
        // carries no `subprocess` face (BL-17 refuses that as a typed
        // composition refusal), so the search tool rides the MEMBER realm's
        // confined subprocess face while `read` rides this binding realm.
        bindings: [{ identity, toolBindingIdentity: fsBindingIdentity, effective: fsEffective }],
        subprocess: {
          effective,
          provider: providerFor(instanceId),
          realmId: `member:${instanceId}`,
          bindingId: bindingIdentity,
          memberScope: instanceId,
        },
      }
    },
  }
  ctx.provide('teamA5sfRealm', provider)

  ctx.inject(['fs'], (fsCtx) => installFsCounter(fsCtx, counterPath))
  ctx.inject(['subprocess'], (subCtx) => installBaseSubprocessCounter(subCtx, counterPath))

}
