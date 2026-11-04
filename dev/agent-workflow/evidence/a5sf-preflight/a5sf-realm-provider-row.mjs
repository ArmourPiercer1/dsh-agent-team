/**
 * a5sf-realm-provider-row.mjs — the BOOT COMPOSITION half that supplies the
 * TWO-AXIS compiled realm to the product row (`packages/runtime/src/plugin/
 * live/host.ts` reads the OPTIONAL `teamA5sfRealm` service; the live glue
 * `agent-bindings.mjs` mounts a Member's realm iff BOTH `config.a5sfEvidencePath`
 * AND that service exist).
 *
 * COPIED FROM `evidence/a5sf-live-native3/a5sf-native-provider-row.mjs` (the
 * boot that proved a model-visible native `read` executes through the CONFINED
 * provider) and EXTENDED by exactly one thing: the provider answer now carries
 * a `bindings` lane, i.e. the RIGHT factor of
 *
 *     EffectiveIo(m, t) ⊆ MemberCeiling(m) ∩ ToolRestriction(m, t)
 *
 * So the same boot can ask whether the CEILING **and** a NARROWER `dsh.fs/read`
 * ToolBinding restriction both govern the model-visible native `read`, and
 * whether the binding lane can ever WIDEN the ceiling.
 *
 * WHY THIS FILE EXISTS AT ALL: at this base NO product code provides
 * `teamA5sfRealm` (grep: only the consumer in `host.ts` and the type doc in
 * `plugin/types.ts`). This row is that supplier for ONE boot — test
 * composition, not product code. It is mounted as a plain profile-patch row
 * (the same public seam the production Team row uses) and calls
 * `ctx.provide('teamA5sfRealm', …)`, the same API `host.ts` uses for
 * `teamRoot`.
 *
 * WHAT IS PRODUCT AND WHAT IS FIXTURE — stated so it cannot be read as more:
 *   - the CEILING and the RESTRICTION *inputs* are composed by this row
 *     (fixtures): no product code bridges a v3 blueprint to compiled ceilings at
 *     this base (see `evidence/a5sf-p2-wiring/README.md` §7.6);
 *   - the INTERSECTION is the PRODUCT's algebra: `intersectPathRuleSets` /
 *     `matchLocator` are imported from the emitted
 *     `packages/runtime/dist/packages/runtime/member-io-policy/src/path-rules.js`
 *     (`compileEffectiveIo` itself is not in the host's emitted set at this
 *     base — `packages/runtime/tsconfig.build.json` does not emit
 *     `member-io-policy/src/compile.ts` — so the two calls that function makes
 *     are made here, with the product's own functions, and the lane report below
 *     records exactly which product function answered);
 *   - the GUARD that enforces the effective lane (`createMemberFsGuard` +
 *     `TeamConfinedFileSystem`) and the binding-realm installer are the SHIPPED
 *     ones, called through the product row.
 *
 * LANE SHAPE (the acceptance table's three files):
 *   ceiling.read  = restricted, allow [workspace]
 *   binding read  = restricted, allow [workspace/axis/allow, <home>/restriction-outside]
 *   effective.read = intersection = [workspace/axis/allow]   (PRODUCT algebra)
 *     A = workspace/axis/allow/a.txt        inside both   -> allow
 *     B = workspace/axis/b.txt              ceiling only   -> DENY
 *     C = <home>/restriction-outside/c.txt  restriction only -> DENY (no widening)
 *   write axis: restriction declares `no-additional-narrowing`, so the effective
 *   write lane is the Member ceiling's write lane (write declares no path and
 *   therefore cannot widen anything).
 *
 * THE COUNTER is test-composition instrumentation (the shipped host `fs`
 * provider has NO counter of its own; this module does not claim to be one). It
 * wraps the LIVE provider class prototype for the four read methods AND
 * `writeText`/`editText`, passing every call through unchanged, so the report
 * can say WHICH provider INSTANCE served a call: the base instance, or one of
 * the two isolated confined instances (Member ceiling realm vs binding realm).
 * A call the Guard refuses never reaches a provider method at all.
 *
 * THE LATE-TOOL TRIGGER (row 5) — WHAT IT IS AND WHAT IT IS NOT.
 * `config.lateToolRoute` (default `/__a5sf/late-tool`) registers ONE test-only
 * HTTP route. A POST to it registers ONE REAL tool through the PUBLIC
 * `tools.register` seam on this row's (app-level) scope, i.e. it becomes an
 * INHERITED name on every agent's next assembly and fires the public
 * `tools/change` event. That is a genuine, product-observed surface change —
 * exactly the class `a5sf-native-invalidation/1` exists to catch — and it is
 * the live analogue of the host-free P0 arm's `x_p0_late_unrelated` (+10 ms)
 * late registration.
 *
 * WHAT IS TEST COMPOSITION, STATED SO IT CANNOT BE READ AS MORE: the TRIGGER
 * (a route that adds an unrelated tool when asked) is a test fixture. The
 * BEHAVIOUR under test — invalidation, shadow disposal and the admission deny
 * — is the product's (`team-services/src/mount.ts`, the P0 merge). No product
 * code registers a tool late in normal operation; this route is how a live
 * boot can produce the event at a chosen time without patching Core. The tool
 * it registers does nothing when called (it returns a marker) and is never
 * dispatched to by this run.
 *
 * @module dev/agent-workflow/evidence/a5sf-acceptance/a5sf-realm-provider-row
 */

import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const name = 'a5sf-acceptance-realm-provider'
/** `ctx.provide` needs no injection; the counter adds itself through
 *  `ctx.inject(['fs'], …)` so this row's apply order is exactly the previous
 *  boot's (it must still be mounted before the Team row). */
export const inject = []

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..', '..', '..')
const PATH_RULES_URL = pathToFileURL(join(
  REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'member-io-policy', 'src', 'path-rules.js',
)).href

/** The emitted product locator algebra (see the module doc for why not compile.ts). */
const pathRules = await import(PATH_RULES_URL)

const READ_METHODS = Object.freeze(['readText', 'streamText', 'readBytes', 'readByteRange'])
const WRITE_METHODS = Object.freeze(['writeText', 'editText'])
const COUNTER_MARK = Symbol.for('a5sf.acceptance.base-provider-counter')

/** Test-composition provider counter (see the module doc). Never decides anything. */
function installProviderCounter(fsCtx, ledgerPath) {
  const baseFs = fsCtx.get('fs')
  if (baseFs === undefined || baseFs === null) return
  const ctor = Object.getPrototypeOf(baseFs)?.constructor
  if (typeof ctor !== 'function') return
  const proto = ctor.prototype
  const record = (row) => {
    try {
      mkdirSync(dirname(ledgerPath), { recursive: true })
      appendFileSync(ledgerPath, JSON.stringify({ at: new Date().toISOString(), ...row }) + '\n')
    } catch {
      /* instrumentation is best-effort: never break a host call */
    }
  }
  if (proto[COUNTER_MARK] === true) {
    record({ leg: 'counter-present', baseCtor: ctor.name })
    return
  }
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
  Object.defineProperty(proto, COUNTER_MARK, { configurable: true, writable: true, value: true })
  record({
    leg: 'counter-installed',
    baseCtor: ctor.name,
    baseInstance,
    methods: patched,
    note: 'test composition instrumentation; the shipped host fs provider has no counter of its own. A refused call never reaches a wrapped method.',
  })
}

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

export function apply(ctx, config) {
  const allowRoot = typeof config?.allowRoot === 'string' ? config.allowRoot.trim() : ''
  if (allowRoot === '') {
    throw new TypeError('a5sf-acceptance-realm-provider: config.allowRoot (the compiled ceiling root) is required')
  }
  const restrictionReadAllow = Array.isArray(config?.restrictionReadAllow)
    ? config.restrictionReadAllow.filter((entry) => typeof entry === 'string' && entry.trim() !== '')
    : []
  if (restrictionReadAllow.length === 0) {
    throw new TypeError('a5sf-acceptance-realm-provider: config.restrictionReadAllow (the narrower ToolBinding read allow list) is required')
  }
  const bindingIdentity = typeof config?.bindingIdentity === 'string' && config.bindingIdentity.trim() !== ''
    ? config.bindingIdentity.trim()
    : 'dsh.fs/read'
  const probePaths = Array.isArray(config?.laneProbePaths)
    ? config.laneProbePaths.filter((entry) => typeof entry === 'string')
    : []

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

  const report = {
    schema: 'a5sf-tool-binding-lane-report/1',
    computedBy: 'packages/runtime/dist/packages/runtime/member-io-policy/src/path-rules.js # intersectPathRuleSets / matchLocator (the emitted product algebra; compileEffectiveIo is not in the host emitted set at this base)',
    bindingIdentity,
    ceiling: { read: ceilingRead, write: ceilingWrite },
    restriction: { read: restrictionRead, write: restrictionWrite },
    effective: { read: effectiveRead, write: effectiveWrite },
    probePaths: probePaths.map((locator) => ({
      locator,
      ceilingRead: disposition(ceilingRead, locator).decision,
      restrictionRead: disposition(restrictionRead, locator).decision,
      effectiveRead: disposition(effectiveRead, locator).decision,
    })),
    note: 'the CEILING and RESTRICTION inputs are test-composition fixtures (no product v3->compiled bridge at this base); the intersection and the dispositions are the product functions, called here',
  }
  const reportPath = typeof config?.laneReportPath === 'string' ? config.laneReportPath.trim() : ''
  if (reportPath !== '') {
    mkdirSync(dirname(reportPath), { recursive: true })
    writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n')
  }

  const provider = {
    /** The lazy `compiledFor` accessor `host.ts` forwards. */
    compiledFor(member) {
      const instanceId = String(member?.instanceId ?? '')
      if (instanceId === '') return undefined
      const templateId = String(member?.templateId ?? 'worker')
      const instanceGeneration = 1
      const revision = `a5sf-acceptance:${instanceId}:g${String(instanceGeneration)}`
      const identity = Object.freeze({
        teamId: 'team-a5sf-acceptance',
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
      /** The effective policy `installToolBindingRealm` installs. */
      const effective = Object.freeze({
        memberIdentity: instanceId,
        toolBindingIdentity: bindingIdentity,
        invocationId: `a5sf-acceptance:${instanceId}:${bindingIdentity}`,
        policyRevision: revision,
        read: effectiveRead,
        write: effectiveWrite,
        network: Object.freeze({ access: 'allow' }),
      })
      return {
        members: [{ identity, policy: { ok: true, value: policy } }],
        bindings: [{ identity, toolBindingIdentity: bindingIdentity, effective }],
      }
    },
  }
  ctx.provide('teamA5sfRealm', provider)

  const counterPath = typeof config?.counterPath === 'string' ? config.counterPath.trim() : ''
  if (counterPath !== '') {
    ctx.inject(['fs'], (fsCtx) => installProviderCounter(fsCtx, counterPath))
  }

  // ── the late-tool trigger (row 5; see the module doc) ────────────────────
  const lateToolRoute = typeof config?.lateToolRoute === 'string' ? config.lateToolRoute.trim() : ''
  if (lateToolRoute !== '') {
    installLateToolTrigger(ctx, {
      route: lateToolRoute,
      toolName: typeof config?.lateToolName === 'string' && config.lateToolName.trim() !== ''
        ? config.lateToolName.trim()
        : 'x_acceptance_late_unrelated',
      hostToolsModule: typeof config?.hostToolsModule === 'string' ? config.hostToolsModule.trim() : '',
      reportPath: typeof config?.lateToolReportPath === 'string' ? config.lateToolReportPath.trim() : '',
    })
  }
}

/**
 * Register the test-only late-tool route (see the module doc).
 *
 * The tool goes through the PUBLIC `tools.register` seam on THIS row's context,
 * so it is an app-scoped (inherited) registration: every agent's next tool
 * assembly sees it and the public `tools/change` event fires, which is exactly
 * the surface-change class the realm's post-settle verification watches.
 *
 * @param {object} ctx - the row Context (app scope).
 * @param {{route: string, toolName: string, hostToolsModule: string, reportPath: string}} spec
 */
function installLateToolTrigger(ctx, spec) {
  /** Late-bound inside the inject callback (the row applies before webServer). */
  let report = { route: spec.route, toolName: spec.toolName, registered: false, calls: 0 }
  const record = (extra) => {
    report = { ...report, ...extra }
    if (spec.reportPath === '') return
    try {
      mkdirSync(dirname(spec.reportPath), { recursive: true })
      writeFileSync(spec.reportPath, JSON.stringify(report, null, 2) + '\n')
    } catch {
      /* instrumentation is best-effort */
    }
  }
  ctx.inject(['webServer', 'tools'], (sub) => {
    /** @type {(() => void) | undefined} */
    let toolDisposer
    sub.effect(() => () => {
      try {
        toolDisposer?.()
      } catch {
        /* row teardown must not be blocked by the fixture */
      }
    })
    sub.effect(() => sub.webServer.register({
      kind: 'exact',
      path: spec.route,
      handler: async (req, res) => {
        const send = (status, body) => {
          res.statusCode = status
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify(body))
        }
        if (req.method !== 'POST') {
          send(405, { error: 'POST only' })
          return
        }
        try {
          report.calls += 1
          if (toolDisposer !== undefined) {
            record({ lastCallAt: new Date().toISOString(), alreadyRegistered: true })
            send(200, { ok: true, already: true, name: spec.toolName, calls: report.calls })
            return
          }
          // The PUBLIC seam: defineTool-equivalent fixture from the HOST's own
          // tools package (a pure factory; no second registry is created).
          const hostTools = spec.hostToolsModule === ''
            ? undefined
            : await import(spec.hostToolsModule)
          if (typeof hostTools?.defineContentToolFixture !== 'function') {
            send(500, { error: `no defineContentToolFixture in ${JSON.stringify(spec.hostToolsModule)}` })
            return
          }
          const definition = hostTools.defineContentToolFixture({
            name: spec.toolName,
            description: 'A5SF acceptance late-surface-change trigger (test composition; registers ONE unrelated tool through the public tools.register seam).',
            parameters: {},
            async execute() {
              return [{ type: 'text', text: 'A5SF_ACCEPTANCE_LATE_TOOL' }]
            },
          })
          toolDisposer = sub.tools.register(definition)
          record({
            registered: true,
            registeredAt: new Date().toISOString(),
            disposerType: typeof toolDisposer,
            lastCallAt: new Date().toISOString(),
          })
          send(200, { ok: true, already: false, name: spec.toolName, calls: report.calls })
        } catch (error) {
          record({ error: String(error?.message ?? error) })
          send(500, { error: String(error?.message ?? error) })
        }
      },
    }), 'a5sf acceptance late-tool trigger route')
  })
}
