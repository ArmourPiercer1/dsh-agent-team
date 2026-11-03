/**
 * Alpha.5 P2 WIRING — the PRODUCT-ROW call site of the a5sf realm mount.
 *
 * WHY THIS MODULE EXISTS: PR #548 shipped the mechanism — `mountA5sfRealm`
 * (`packages/runtime/team-services/src/mount.ts`) plus the guard-consultation
 * transport (`guard-observability.ts`) — but nothing in the product row called
 * it, and the emit did not carry the lane. The live glue
 * (`agent-bindings.mjs`, plain JS, never emitted by tsc) is the ONE place a
 * booted row assembles a Member, so this module is the thin, EXPORTED helper
 * that call site uses. It is deliberately NOT a second mount path: it builds a
 * file sink, hands the sink's `record` to `mountA5sfRealm` as
 * `onGuardConsult`, and returns the mounted realm untouched. Every decision,
 * every refusal and every rollback stays in the seam that owns it.
 *
 * DEFAULT-PRESERVING (the law this module adds):
 *   ENABLED  IFF the row config carries a non-blank `a5sfEvidencePath` AND
 *            the row's composition supplies `a5sfRealmProvider`.
 *   Otherwise this module returns `undefined` WITHOUT creating a sink, calling
 *   the provider, touching the filesystem or mounting anything — the legacy
 *   path is byte-identical (no observer, no mount, no file writes).
 *
 * The evidence path ALWAYS comes from row configuration (the run/evidence
 * config the caller boots with); it is never derived here and never hardcoded.
 *
 * WHAT THE PROVIDER IS, AND WHY IT IS INJECTED: the compiled objects
 * (`CompileResult<MemberPolicy>` ceilings + `EffectiveIoPolicy` binding lanes)
 * are policy compilation output. This glue must never compile or re-evaluate a
 * lane (that would be a second compiler and a second authority decision), so
 * the row's composition supplies them through a plain provider:
 *
 *   a5sfRealmProvider = () => ({
 *     compiledFor({ sessionId, instanceId, teamRootSessionId, templateId, bindPath })
 *       => { members, bindings?, providerClass? } | undefined | Promise<…>
 *   })
 *
 * (a LAZY accessor — it is never called while the row is unconfigured).
 *
 * `undefined` from `compiledFor` = this Member has no compiled realm (no mount).
 * A malformed provider answer throws (a declared wiring that cannot mount is a
 * configuration fault, never a silent no-op).
 *
 * FAIL-CLOSED TRANSPORT: the sink is the seam's own
 * `createGuardConsultFileSink`; a write failure rejects, `observeGuard` turns
 * that into `GUARD_OBSERVATION_FAILED`, and the consulted call is REFUSED
 * before the base Provider runs. This module adds no catch and no downgrade.
 *
 * F1 (effective half, dated 2026-11-03) — WHAT IS BOUND AND WHAT IS NOT.
 * The realm's isolated Provider lives on `installation.members[i].ctx`
 * (`install.ts:182`); the Context handed to the mount keeps the BASE provider.
 * `a5sfToolPlaneOf` below is the ONE naming of the scope the product row's TOOL
 * PLANE is placed on: the live Member setup mounts its tool registrations and
 * the governed tool plane through `toolPlane.ctx`, and routes the permission
 * adapter's per-call fs seam through `toolPlane.fs` — so a TOOL-SHAPED
 * definition (one whose body resolves the fs provider from the ctx it runs on,
 * as the shipped tool packages do) is consulted by the confined guard and
 * writes one `a5sf-guard-consult/1` fact, while the agent ctx itself keeps the
 * base provider (a LEADER or a non-tool consumer is untouched). This is NOT a
 * claim about the native preset tools — see STILL OPEN below.
 *
 * STILL OPEN, stated so it cannot be read as done: the upstream agent-preset
 * registry EAGERLY activates a preset at registration and mounts every preset
 * plugin under its OWN `createScope(registryCtx, generationKey)` fiber
 * (`@deepseek-ai/dsh-agent-preset-registry` activate()/mountPreset()), i.e.
 * BEFORE any agent ctx exists and never below it. No Context handed to
 * `agentPresets.mount()` can therefore change which `fs` a preset tool body
 * resolves — the native `read`/`write`/`edit` rows stay on the base provider
 * until the P3 native takeover (BL-22) places them on this plane. Measured:
 * `dev/agent-workflow/evidence/a5sf-f1-ctx/` (§3 topology measurement) and the
 * BEFORE/AFTER probe `probe-f1-tool-plane.mjs` over the committed dist.
 *
 * @module @dsh-agent-team/runtime/plugin/live/a5sf-realm-row
 */
import { isAbsolute } from 'node:path'
import { pathToFileURL } from 'node:url'
import { scopeOf } from '@deepseek-ai/dsh-scope'
import { createGuardConsultFileSink } from '../../../team-services/src/guard-observability.js'
import { NATIVE_REGISTRATION_ROUTING, mountA5sfRealm } from '../../../team-services/src/mount.js'

/** The row-config key carrying the JSONL evidence path (JSON-safe string). */
export const A5SF_EVIDENCE_PATH_KEY = 'a5sfEvidencePath'

/**
 * The row-config key carrying the NATIVE tool modules to re-mount inside each
 * Member's isolated `fs` scope (route C, 2026-11-03).
 *
 * Each entry is either a module specifier string or `{ url, config? }`:
 *   - `file:` URL, or an absolute filesystem path (converted with
 *     `pathToFileURL`), or any specifier `import()` resolves FROM THIS MODULE.
 *   - The ROW COMPOSITION owns resolution (the same discipline as
 *     `a5sfRealmProvider`): the host knows where its own `@deepseek-ai/dsh-tool-fs`
 *     lives; this glue must not guess a host install path.
 */
export const A5SF_NATIVE_TOOL_MODULES_KEY = 'a5sfNativeToolModules'

/**
 * Name the MEMBER TOOL PLANE scope of one mounted realm.
 *
 * WHY: the mount installs the confined Provider into `root.isolate('fs', …)`,
 * so the Context passed in keeps the base provider and only the returned
 * `installation.members[i].ctx` resolves the confined one. The product row
 * therefore needs ONE place that says "this is the ctx the Member's tools run
 * on, and this is the fs instance its calls must resolve". This function is
 * that place — it adds no mount, no policy decision and no second registry; it
 * only validates and names the scope the caller already mounted.
 *
 * The `fs` member is the INSTALLED confined provider instance, captured once
 * (never a per-call `ctx.get('fs')`): after the realm is disposed the isolated
 * provider fiber unregisters and a ctx LOOKUP on the scope answers `undefined`
 * (measured, suite arm F1-6 — it does not fall back to the base provider, but
 * it also cannot serve a late call). Capturing the instance keeps a late or
 * racing consumer on the confined lane, where it still gets the guard's own
 * refusal instead of a service-resolution fault.
 *
 * @param {object|undefined|null} realm - the object `mountMemberA5sfRealm`
 *   returned (`undefined` = this row mounted no realm: the legacy path).
 * @returns {{ ctx: object, fs: object } | undefined} the frozen tool-plane
 *   scope, or `undefined` when the row is not a5sf-wired.
 */
export function a5sfToolPlaneOf(realm) {
  if (realm === undefined || realm === null) return undefined
  const members = realm.installation?.members
  const member = Array.isArray(members) ? members[0] : undefined
  if (member === undefined || member === null) {
    throw new TypeError('agent-bindings: a mounted a5sf realm must carry at least one Member installation (the tool plane needs its isolated ctx + confined fs)')
  }
  if (member.ctx === undefined || member.ctx === null || typeof member.ctx.get !== 'function') {
    throw new TypeError('agent-bindings: the a5sf Member installation carries no usable isolated ctx')
  }
  if (member.fs === undefined || member.fs === null || typeof member.fs.readText !== 'function') {
    throw new TypeError('agent-bindings: the a5sf Member installation carries no confined fs provider surface')
  }
  return Object.freeze({ ctx: member.ctx, fs: member.fs })
}

/**
 * Read the row's a5sf wiring out of its config.
 *
 * ABSENT (`undefined`/`null` key) = the row is not a5sf-wired at all: returns
 * `undefined`, the legacy path. PRESENT but not a non-blank string = a
 * configuration fault (fail loudly at row assembly, never a silently disabled
 * sandbox lane).
 *
 * `a5sfNativeToolModules`, when present, is validated here too (route C): a
 * non-array, an empty array entry, or an entry that is neither a non-blank
 * string nor `{ url: <non-blank string>, config?: object }` is a configuration
 * fault. The key stays OMITTED from the returned block when absent, so the
 * pre-route-C block is byte-identical (its readers and their pinned tests are
 * unaffected).
 *
 * @param {object|undefined|null} config - the row config.
 * @returns {{ evidencePath: string, nativeToolModules?: readonly object[] } | undefined}
 *   the frozen wiring block.
 */
export function a5sfRealmConfigOf(config) {
  const raw = config === undefined || config === null ? undefined : config[A5SF_EVIDENCE_PATH_KEY]
  if (raw === undefined || raw === null) return undefined
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new TypeError(
      `agent-bindings: config.${A5SF_EVIDENCE_PATH_KEY} must be a non-blank string when present (the a5sf guard-consult evidence path)`,
    )
  }
  const modules = nativeToolModulesOf(config[A5SF_NATIVE_TOOL_MODULES_KEY])
  return Object.freeze({
    evidencePath: raw,
    ...(modules === undefined ? {} : { nativeToolModules: modules }),
  })
}

/**
 * Validate the native-tool-module list (route C). `undefined`/`null` = the
 * module is not requested at all: the pre-route-C mount, byte-identical.
 *
 * @param {unknown} raw - the config value.
 * @returns {readonly {url: string, config?: object}[] | undefined} frozen specs.
 */
function nativeToolModulesOf(raw) {
  if (raw === undefined || raw === null) return undefined
  if (!Array.isArray(raw)) {
    throw new TypeError(`agent-bindings: config.${A5SF_NATIVE_TOOL_MODULES_KEY} must be an array when present (one entry per native tool module)`)
  }
  if (raw.length === 0) return Object.freeze([])
  return Object.freeze(raw.map((entry, index) => {
    const where = `config.${A5SF_NATIVE_TOOL_MODULES_KEY}[${index}]`
    if (typeof entry === 'string') {
      if (entry.trim() === '') throw new TypeError(`agent-bindings: ${where} must be a non-blank module specifier`)
      return Object.freeze({ url: entry })
    }
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new TypeError(`agent-bindings: ${where} must be a module specifier string or { url, config? }`)
    }
    const url = entry.url
    if (typeof url !== 'string' || url.trim() === '') {
      throw new TypeError(`agent-bindings: ${where}.url must be a non-blank module specifier`)
    }
    const pluginConfig = entry.config
    if (pluginConfig !== undefined && (pluginConfig === null || typeof pluginConfig !== 'object' || Array.isArray(pluginConfig))) {
      throw new TypeError(`agent-bindings: ${where}.config must be a plain object when present`)
    }
    return Object.freeze({ url, ...(pluginConfig === undefined ? {} : { config: pluginConfig }) })
  }))
}

/**
 * The Member AGENT's model-visible tool names, read from the ONE registry.
 *
 * WHY a separate reader: the route-C re-mount must be SURFACE-NEUTRAL. A
 * registration made from the agent's own scope is outside the inherited
 * `tools.restrict` filter (`ToolRuntime.view`: own registrations are applied
 * last, outside the filter), so re-mounting a module whose tool the Member's
 * `builtinToolDeny` lane denied would SILENTLY RE-ENABLE it. Comparing the
 * agent's visible set before/after the mount makes that a measured refusal
 * instead of a governance hole.
 *
 * @param {object} root - the agent Context the realm installs into.
 * @param {object|undefined} [runtimeAgent] - the CANONICAL runtime Agent (the
 *   Agent IS the scope key upstream). It takes precedence over the context tag
 *   because `scopeOf()` is blind across duplicate `@deepseek-ai/dsh-scope`
 *   module instances: the tag is a module-private Symbol, and the live Host
 *   measured a healthy Host-tagged ctx reading `undefined` through the Team
 *   plugin's `.pnpm` copy (evidence
 *   `dev/agent-workflow/evidence/a5sf-live-native/scope-duplicate-instances.log`).
 *   The tag stays the LAST-RESORT fallback for a host that carries no explicit
 *   Agent; when NEITHER yields a key the refusal below still fails closed.
 * @returns {Set<string>} the visible tool names.
 */
export function a5sfAgentToolSurface(root, runtimeAgent) {
  const scope = runtimeAgent ?? scopeOf(root)
  if (scope === undefined) {
    throw new TypeError('agent-bindings: the a5sf native tool re-mount needs a SCOPED agent Context (the tool plane is per-agent)')
  }
  const tools = root.get('tools')
  if (tools === undefined || tools === null || typeof tools.schemas !== 'function') {
    throw new TypeError('agent-bindings: the a5sf native tool re-mount needs the tools service on the agent Context')
  }
  return new Set(tools.schemas(scope).map((schema) => schema.name))
}

/**
 * Mount one admitted Member's compiled a5sf realm, wired to a row-configured
 * file sink — the exact call the live Member setup performs.
 *
 * The ENABLEMENT LAW above lives here, in one place: either half of the wiring
 * absent => `undefined`, and nothing happens.
 *
 * @param {object} input
 * @param {object} input.root - the Cordis Context the realm installs into (the
 *   agent scope the live setup received).
 * @param {{ evidencePath: string } | undefined} input.a5sfConfig - the block
 *   `a5sfRealmConfigOf` returned.
 * @param {Function | undefined} input.provider - the row's LAZY provider
 *   accessor (`() => { compiledFor } | undefined`, the glue's
 *   `deps.a5sfRealmProvider`). It is NEVER called while the row is
 *   unconfigured.
 * @param {object} input.member - the admitted member descriptor forwarded to
 *   `provider.compiledFor`.
 * @returns {Promise<object | undefined>} the mounted realm (`dispose()` must be
 *   kept on the row), or `undefined` when not configured / nothing compiled.
 */
export async function mountMemberA5sfRealm({ root, a5sfConfig, provider, member }) {
  if (a5sfConfig === undefined || a5sfConfig === null) return undefined
  if (typeof provider !== 'function') return undefined
  const resolved = provider()
  if (resolved === undefined || resolved === null) return undefined
  if (typeof resolved.compiledFor !== 'function') {
    throw new TypeError('agent-bindings: deps.a5sfRealmProvider must answer a { compiledFor } object when the row is a5sf-wired')
  }
  if (root === undefined || root === null) {
    throw new TypeError('agent-bindings: mountMemberA5sfRealm needs the agent Context the realm installs into')
  }

  const compiled = await resolved.compiledFor(Object.freeze({ ...member }))
  if (compiled === undefined || compiled === null) return undefined
  if (!Array.isArray(compiled.members) || compiled.members.length === 0) {
    throw new TypeError('agent-bindings: a5sfRealmProvider.compiledFor must answer { members: [...] } with at least one compiled Member ceiling')
  }
  if (compiled.bindings !== undefined && !Array.isArray(compiled.bindings)) {
    throw new TypeError('agent-bindings: a5sfRealmProvider.compiledFor answered a non-array `bindings`')
  }

  // The row's configured path, never a derived or hardcoded one. The sink owns
  // no counter/ledger: one fact per consultation, in call order.
  const sink = createGuardConsultFileSink({ path: a5sfConfig.evidencePath })
  const mountInput = {
    root,
    members: compiled.members,
    ...(compiled.bindings === undefined ? {} : { bindings: compiled.bindings }),
    ...(compiled.providerClass === undefined ? {} : { providerClass: compiled.providerClass }),
    onGuardConsult: (fact) => sink.record(fact),
  }
  // The realm mount is UNCHANGED and does NOT create the native shadow. ROUTE C
  // attaches the shadow LATER, through `attachA5sfNativeToolModules`, called by
  // the glue AFTER its capability deny lane: a shadow created first would sit
  // OUTSIDE the `tools.restrict` filter and survive the deny (measured).
  return await mountA5sfRealm(mountInput)
}

/**
 * ROUTE C — create the NATIVE tool shadow on an ALREADY-MOUNTED realm, after
 * the Member capability deny lane, and refuse if it changes the surface.
 *
 * WHY A SECOND CALL AND NOT PART OF THE MOUNT (review fix, 2026-11-03): the
 * production glue mounts the realm early (its tool plane feeds the Team tools
 * and the governed plane) but applies `builtinToolDeny` LATER in the same
 * setup. An OWN-scope registration is outside the inherited `tools.restrict`
 * filter, so the deny order decides the outcome:
 *
 *   deny  -> shadow : `read` is hidden first; the surface check then REFUSES the
 *                     shadow (it would ADD a name) — fail closed.
 *   shadow -> deny  : the deny hides the inherited preset row and the shadow
 *                     takes its place — the denied tool stays visible AND
 *                     executable on the confined lane.
 *
 * Only the first order is safe, so this function must be called after the deny
 * (the glue's order is pinned by the suite).
 *
 * @param {object} realm - the object `mountMemberA5sfRealm` returned.
 * @param {object} root - the agent Context the realm was mounted on.
 * @param {object|undefined} a5sfConfig - the block from `a5sfRealmConfigOf`.
 * @param {object|undefined} [runtimeAgent] - the setup's CANONICAL runtime
 *   Agent (the Agent IS the scope key). Forwarded to `a5sfAgentToolSurface` so
 *   the POST-DENY surface read does not depend on a `scopeOf()` that is blind
 *   across duplicate `@deepseek-ai/dsh-scope` module instances; absent = the
 *   context tag is the last-resort fallback (and a keyless ctx still refuses).
 * @returns {Promise<readonly object[]|undefined>} the created fibers, or
 *   `undefined` when the row does not configure native modules.
 */
export async function attachA5sfNativeToolModules(realm, root, a5sfConfig, runtimeAgent) {
  const nativeSpecs = a5sfConfig?.nativeToolModules ?? []
  if (nativeSpecs.length === 0) return undefined
  if (realm === undefined || realm === null || typeof realm.mountNativeToolModules !== 'function') {
    throw new TypeError('agent-bindings: the a5sf native tool attach needs a mounted realm carrying mountNativeToolModules (the pre-route-C realm cannot re-mount native tools)')
  }
  // The POST-DENY surface: this is the baseline the shadow must not change.
  const before = a5sfAgentToolSurface(root, runtimeAgent)
  // The baseline DEFINITIONS, by name: the coverage check below needs identity,
  // not just the name set (a module that registers nothing, or registers late,
  // leaves the preset definition in place — same name, ZERO guard facts).
  const coverageScope = runtimeAgent ?? scopeOf(root)
  const toolsService = root.get('tools')
  // Identity coverage needs the scoped reader; a surface-only double (a test
  // world, or a pre-`get` tools row) keeps the name-set gate instead of
  // pretending to prove more than it can.
  const canReadDefinitions = toolsService !== undefined && toolsService !== null && typeof toolsService.get === 'function'
  const beforeDefinitions = canReadDefinitions
    ? new Map([...before].map((name) => [name, toolsService.get(name, coverageScope)]))
    : new Map()
  const nativeToolModules = await Promise.all(nativeSpecs.map(async (spec) => {
    // Imported by the ROW COMPOSITION's specifier; the mount seam forwards it.
    // WRAPPED: a resolution failure must name the configured entry, not surface
    // as a bare ERR_MODULE_NOT_FOUND from the middle of agent setup.
    let imported
    try {
      imported = await import(moduleSpecifierOf(spec.url))
    } catch (error) {
      throw new TypeError(
        `agent-bindings: cannot load ${A5SF_NATIVE_TOOL_MODULES_KEY} entry ${JSON.stringify(spec.url)}: `
        + `${error instanceof Error ? error.message : String(error)}`,
      )
    }
    if (imported === null || (typeof imported !== 'object' && typeof imported !== 'function')) {
      throw new TypeError(`agent-bindings: ${A5SF_NATIVE_TOOL_MODULES_KEY} entry ${JSON.stringify(spec.url)} did not evaluate to a Cordis plugin module`)
    }
    return Object.freeze({ module: imported, ...(spec.config === undefined ? {} : { config: spec.config }) })
  }))
  const fibers = await realm.mountNativeToolModules(nativeToolMountsOf(nativeToolModules, realm))
  const coverage = canReadDefinitions ? uncoveredShadowedTools(root, coverageScope, fibers, beforeDefinitions) : []
  if (coverage.length > 0) {
    // FAIL CLOSED on COVERAGE, not just on the name set. A tool a router reports
    // as forwarded MUST be the definition the agent now resolves; if the preset
    // definition is still the one visible, the tool executes on the BASE provider
    // with zero guard facts while every surface name stayed equal — the hole a
    // name-only check cannot see.
    for (const fiber of [...fibers].reverse()) {
      try {
        await fiber.dispose()
      } catch {
        // The coverage refusal is the failure that must be reported.
      }
    }
    throw new TypeError(
      `agent-bindings: the configured ${A5SF_NATIVE_TOOL_MODULES_KEY} left ${JSON.stringify(coverage)} on the unshadowed baseline`
      + ' (the router forwarded the name but the preset definition is still the one the agent resolves); refusing the mount —'
      + ' those tools would execute on the BASE provider with zero guard facts',
    )
  }
  const after = a5sfAgentToolSurface(root, runtimeAgent)
  const added = [...after].filter((name) => !before.has(name))
  const removed = [...before].filter((name) => !after.has(name))
  if (added.length > 0 || removed.length > 0) {
    // FAIL CLOSED. A re-mount may only place the SAME native surface on the
    // confined lane; a name that appears (a denied tool re-enabled, an extra
    // tool package) or disappears is a governance change this wiring must not
    // make silently. The shadow is removed and the refusal propagates; the
    // realm itself stays mounted (it is still the Member's confined provider).
    for (const fiber of [...fibers].reverse()) {
      try {
        await fiber.dispose()
      } catch {
        // The surface refusal is the failure that must be reported.
      }
    }
    throw new TypeError(
      `agent-bindings: the configured ${A5SF_NATIVE_TOOL_MODULES_KEY} would CHANGE the Member's model-visible tool surface`
      + ` (added: ${JSON.stringify(added)}; removed: ${JSON.stringify(removed)}); refusing to mount the native shadow — a scoped`
      + ' registration is outside the inherited tools.restrict filter, so a re-mounted tool could re-enable a builtinToolDeny lane',
    )
  }
  return fibers
}

/**
 * The names a router reported as FORWARDED whose definition is still the
 * pre-attach (preset) one, or whose definition is gone.
 *
 * WHY identity: `a5sfAgentToolSurface` compares NAMES. A tool that a module
 * registers asynchronously — or registers nowhere while the preset still
 * provides it — keeps the same name and the same preset DEFINITION object, so
 * the name set is unchanged and the tool executes on the BASE provider with no
 * guard consultation at all. Diffing definition identity per forwarded name
 * turns that into a measured refusal.
 *
 * @param {object} root - the agent Context.
 * @param {object|undefined} scope - the RESOLVED agent scope key (`runtimeAgent ?? scopeOf(root)`).
 * @param {readonly object[]} fibers - the router fibers the mount created.
 * @param {Map<string, unknown>} beforeDefinitions - name -> pre-attach definition.
 * @returns {string[]} forwarded names that are not shadowed by this attach.
 */
function uncoveredShadowedTools(root, scope, fibers, beforeDefinitions) {
  const tools = root.get('tools')
  const forwarded = new Set()
  for (const fiber of fibers) {
    const routing = fiber?.[NATIVE_REGISTRATION_ROUTING]
    if (routing === undefined || routing === null) continue
    for (const name of routing.forwarded) forwarded.add(name)
  }
  const uncovered = []
  for (const name of forwarded) {
    const definition = tools.get(name, scope)
    if (definition === undefined || definition === beforeDefinitions.get(name)) uncovered.push(name)
  }
  return uncovered
}

/**
 * Expand the configured native modules into the PER-FIBER mounts S-1 requires.
 *
 * A native tool PACKAGE registers its whole suite from one `apply`, so a single
 * mount can only ever execute on ONE realm. The mount seam's registration
 * router (see `mount.ts`) partitions the suite by tool name; this function is
 * the row-side half of that partition:
 *
 *   - ONE ceiling mount per module (no `toolBindingIdentity`), which forwards
 *     every tool that has NO mounted binding (today's behaviour), and
 *   - ONE mount per mounted ToolBinding realm, which forwards ONLY that
 *     binding's own tool (`dsh.fs/read` -> `read`) and executes it on the
 *     binding's already-compiled/confined provider.
 *
 * The UNION of the fibers is the module's surface, exactly once: the existing
 * surface-neutrality check below stays the gate, and `EffectiveIo` is never
 * recomputed — the selected realm's guard already holds the compiled
 * intersection.
 *
 * @param {readonly object[]} nativeToolModules - imported module specs.
 * @param {object} realm - the mounted realm (its `bindings` are the routing table).
 * @returns {readonly object[]} the mounts to hand to `mountNativeToolModules`.
 */
function nativeToolMountsOf(nativeToolModules, realm) {
  const bindings = Array.isArray(realm?.bindings) ? realm.bindings : []
  const identities = []
  for (const binding of bindings) {
    const identity = binding?.toolBindingIdentity
    if (typeof identity !== 'string' || identity.trim() === '') {
      throw new TypeError('agent-bindings: every mounted a5sf ToolBinding realm must carry a non-blank toolBindingIdentity (the native routing table)')
    }
    identities.push(identity)
  }
  const mounts = []
  for (const module of nativeToolModules) {
    mounts.push(module)
    for (const toolBindingIdentity of identities) mounts.push({ ...module, toolBindingIdentity })
  }
  return Object.freeze(mounts)
}

/**
 * Turn one configured module specifier into something `import()` accepts.
 *
 * `file:` URLs pass through; absolute paths become file URLs; anything else is
 * treated as a bare specifier resolved from THIS module (the host install that
 * carries the plugin). The row composition is responsible for naming a module
 * the host can actually load.
 *
 * @param {string} specifier - the configured specifier.
 * @returns {string} the import specifier.
 */
function moduleSpecifierOf(specifier) {
  if (specifier.startsWith('file:')) return specifier
  if (isAbsolute(specifier)) return pathToFileURL(specifier).href
  return specifier
}

/**
 * Wrap a mounted realm's async `dispose()` as a SAFE SYNC row disposer.
 *
 * WHY: the row drain (`agent-bindings.mjs` close) invokes every disposer
 * SYNCHRONOUSLY (`d()`) and only catches synchronous throws — an `async`
 * disposer returned un-awaited would be fire-and-forget, and a rejection would
 * surface as an unhandled rejection instead of a reported teardown fault. This
 * wrapper starts the unmount on the same tick (the drain has already decided to
 * tear down), never throws, reports a rejection to `onError` instead of
 * swallowing it, and exposes `settled()` so the row can AWAIT the disposals it
 * started before it returns from `close()`.
 *
 * Idempotency is the realm's own (`MountedA5sfRealm.dispose` is idempotent);
 * this wrapper does not add a second flag — calling it twice starts two awaits
 * whose second resolves immediately. The agent-scope unwind remains the
 * backstop if the row never reaches its drain.
 *
 * @param {{ dispose(): Promise<void> }} realm - the mount helper's return value.
 * @param {(error: unknown) => void} [onError] - reports a rejected unmount
 *   (the row pushes an observation; it is never silent).
 * @returns {(() => void) & { settled(): Promise<void> }} the sync disposer.
 */
export function createA5sfRealmRowDisposer(realm, onError) {
  if (realm === undefined || realm === null || typeof realm.dispose !== 'function') {
    throw new TypeError('agent-bindings: createA5sfRealmRowDisposer needs a mounted realm with an async dispose()')
  }
  /** @type {Set<Promise<void>>} the unmounts this wrapper started. */
  const pending = new Set()
  const dispose = () => {
    const disposal = Promise.resolve()
      .then(() => realm.dispose())
      .catch((error) => {
        try {
          onError?.(error)
        } catch {
          // A faulting reporter must never re-break the teardown path.
        }
      })
      .finally(() => {
        pending.delete(disposal)
      })
    pending.add(disposal)
  }
  Object.defineProperty(dispose, 'settled', {
    value: async () => {
      // Loop: an onError report may itself trigger no new disposal, but a
      // concurrent second call can add one while we await; converge.
      while (pending.size > 0) await Promise.allSettled([...pending])
    },
  })
  return dispose
}

