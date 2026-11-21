/**
 * realm-lane.mjs — the ONE way a member's tool definitions reach a provider.
 *
 * WHAT THIS IS FOR. A native tool body resolves its provider from the `ctx` captured when the
 * module's `apply()` ran (see 07-A1-SEAM-DECISION.md). So "give member A a confined fs" can only
 * mean "mount the HOST's own fs module where `ctx.fs` is A's provider". This module performs that
 * mount and proves it took effect. It never authors a tool body and never renames one.
 *
 * THE TWO THINGS IT REFUSES, because both were real:
 *
 *  1. A TEAM-AUTHORED MODULE URL. The retired route mounted `confined-fs-tool.mjs` — a Team copy
 *     of `read`/`write`/`edit` — so the model-visible definition was a second declarant, and every
 *     guarantee had to be re-verified against a body the host does not maintain. A spec whose URL
 *     is not a bare `@deepseek-ai/...` package specifier is refused here, by construction.
 *  2. A MOUNT THAT DOES NOT CHANGE THE AGENT'S DEFINITION. Mounting the host module into a scope
 *     where the agent still resolves the inherited preset definition is silent: the name set is
 *     unchanged, the body runs on the base provider and no confinement is consulted. The old
 *     `uncoveredShadowedTools` had to diff definition IDENTITY to catch this; so does this lane,
 *     per name, and a name that did not change is a refusal rather than a warning.
 *
 * @module packages/runtime/src/plugin/vnext/realm-lane
 */

/** A bare host package specifier: `@deepseek-ai/<pkg>`, optionally with a subpath. No scheme. */
const HOST_PACKAGE = /^@deepseek-ai\/([a-z0-9-]+(\/[a-z0-9._-]+)?)$/

/**
 * The realm services whose absence makes a native module UNCONFINABLE on this realm, and the
 * `faces` key that answers whether the realm owns them. `fs` is total (every realm installs a
 * confined provider); the other three are declared, nullable faces.
 */
const CONTROLLED_FACE_SERVICES = Object.freeze(['fs', 'subprocess', 'web', 'terminals'])

export class VnextRealmError extends TypeError {
  constructor (code, message) {
    super(`vnext-realm: ${message}`)
    this.name = 'VnextRealmError'
    this.code = code
  }
}

const fail = (code, message) => {
  throw new VnextRealmError(code, message)
}

/**
 * Validate the composition's native module specs.
 *
 * A spec is `{ url, module, expectedTools, config?, toolBindingIdentity? }`. The URL is the
 * DECLARATION of where the body comes from; `module` is what was imported. Both are checked,
 * because a caller that imported the host package but declared a Team file URL would otherwise
 * pass. `config` and `toolBindingIdentity` are passed through to the realm's own mount contract
 * (the router needs them to partition a package's suite across bindings); this lane neither reads
 * nor reinterprets them.
 *
 * @param {readonly object[]} specs
 * @returns {readonly { url: string, module: object, expectedTools: readonly string[] }[]}
 */
export function hostNativeSpecs (specs) {
  if (!Array.isArray(specs)) fail('MODULES_INVALID', `expected an array of native module specs, got ${typeof specs}`)
  const out = []
  const seen = new Set()
  for (const [index, spec] of specs.entries()) {
    if (spec === null || typeof spec !== 'object') fail('MODULE_INVALID', `spec[${index}] is not an object`)
    const { url, module, expectedTools } = spec
    if (typeof url !== 'string' || url.trim() === '') fail('MODULE_URL_MISSING', `spec[${index}] has no url; a body without a declared source cannot be proven to be the host's`)
    if (!HOST_PACKAGE.test(url)) {
      fail('MODULE_NOT_HOST', `spec[${index}] declares ${JSON.stringify(url)}, which is not a bare @deepseek-ai/* host package. A Team-authored or file:// body is exactly the second declarant this lane replaced`)
    }
    if (module === null || typeof module !== 'object' || typeof module.apply !== 'function') {
      fail('MODULE_INVALID', `spec[${index}] (${url}) did not import a Cordis plugin (no apply function)`)
    }
    if (!Array.isArray(expectedTools) || expectedTools.length === 0) {
      fail('MODULE_TOOLS_MISSING', `spec[${index}] (${url}) declares no expectedTools; without them the mount cannot prove which names it took over`)
    }
    for (const name of expectedTools) {
      if (typeof name !== 'string' || name.trim() === '') fail('MODULE_TOOLS_MISSING', `spec[${index}] (${url}) has a blank tool name`)
      if (seen.has(name)) fail('MODULE_TOOL_DUPLICATE', `tool ${JSON.stringify(name)} is claimed by two module specs; one name, one host module`)
      seen.add(name)
    }
    out.push(Object.freeze({
      url,
      module,
      expectedTools: Object.freeze([...expectedTools]),
      ...(spec.config !== undefined ? { config: spec.config } : {}),
      ...(spec.toolBindingIdentity !== undefined ? { toolBindingIdentity: spec.toolBindingIdentity } : {}),
    }))
  }
  // Two mounts of the SAME host package into one scope is a duplicate registration waiting to
  // happen; the registry refuses it at mount time, but a refusal after half the suite registered
  // is worse than refusing the spec set.
  const urls = out.map((spec) => spec.url)
  const dup = urls.find((url, i) => urls.indexOf(url) !== i)
  if (dup !== undefined) fail('MODULE_URL_DUPLICATE', `host package ${dup} is listed twice; mount it once and declare the union of its tools`)
  return Object.freeze(out)
}

/**
 * Mount the host modules into a member realm and prove each declared name changed definition.
 *
 * @param {object} options
 * @param {object} options.realm - the mounted member realm (carries `mountNativeToolModules`).
 * @param {object} options.root - the agent-scoped Context (owns the `tools` service).
 * @param {string} [options.scope] - the resolved agent scope key, when the realm needs it.
 * @param {readonly object[]} options.specs - the specs validated by {@link hostNativeSpecs}.
 * @param {readonly string[]} [options.surface] - names the caller expects to exist before mounting;
 *   a declared name that is absent BEFORE and AFTER is reported as `DEFINITION_MISSING`.
 * @param {number} [options.settleRounds] - how many registry re-reads to wait for DEFERRED
 *   registrations. A host tool package registers some tools from a deferred `inject` child (the
 *   pinned `read_image` is one: GAP-FS-CONTRACT-1), so the name is legitimately absent for a few
 *   ticks after the mount returns. Waiting is not leniency: the identity assertion still runs, it
 *   just runs after the registry has had its chance to settle.
 * @returns {Promise<{ mounted: readonly string[], fibers: readonly object[], dispose: () => Promise<void> }>}
 *   `dispose` releases what THIS mount registered. It is part of the contract, not a convenience:
 *   the mount happens on the agent's context, so disposing the member realm does not by itself
 *   remove those registrations - measured, before it was fixed, as a disposed member whose native
 *   `read` still executed.''
 */
export async function mountHostModules ({ realm, root, scope, specs, surface, settleRounds = 20 }) {
  if (realm === null || typeof realm !== 'object') fail('REALM_MISSING', 'no member realm: a tool definition may not fall back to the composition provider')
  if (typeof realm.mountNativeToolModules !== 'function') fail('REALM_MISSING', 'the realm cannot mount native tool modules (no mountNativeToolModules)')
  const tools = root?.get?.('tools')
  if (tools === null || typeof tools !== 'object' || typeof tools.get !== 'function') {
    fail('TOOLS_UNAVAILABLE', 'the agent context has no tools service that can answer definition identity; without it the mount cannot prove it took effect')
  }
  const hostSpecs = hostNativeSpecs(specs)
  const before = new Map()
  for (const spec of hostSpecs) {
    for (const name of spec.expectedTools) before.set(name, tools.get(name, scope))
  }
  // The realm's mount contract takes MOUNT DESCRIPTORS, not bare module namespaces: a native tool
  // package registers its whole suite from one apply(), so the mount carries the per-binding
  // partition data the router needs. Handing it a namespace would mount nothing and every name
  // below would then be DEFINITION_UNCHANGED — a refusal with the wrong cause.
  const mounts = hostSpecs.map((spec) => ({
    module: spec.module,
    ...(spec.config !== undefined ? { config: spec.config } : {}),
    ...(spec.toolBindingIdentity !== undefined ? { toolBindingIdentity: spec.toolBindingIdentity } : {}),
  }))
  const fibers = await realm.mountNativeToolModules(mounts, { scope })
  // DEFERRED REGISTRATION. The mount returns before every deferred child has registered, so at
  // this instant neither absence nor an unchanged definition is a fact yet. Re-read until every
  // declared name has CHANGED or the budget is spent, bounded: an unbounded wait would hang a
  // member's setup, and a zero-round wait would report a tick as a defect. A name that never
  // changes still reports DEFINITION_UNCHANGED afterwards — the wait does not soften the verdict.
  const declared = hostSpecs.flatMap((spec) => spec.expectedTools)
  for (let round = 0; round < settleRounds; round += 1) {
    const pending = declared.filter((name) => {
      const current = tools.get(name, scope)
      return current === undefined || current === null || current === before.get(name)
    })
    if (pending.length === 0) break
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  const mounted = []
  const unchanged = []
  const missing = []
  for (const spec of hostSpecs) {
    for (const name of spec.expectedTools) {
      const after = tools.get(name, scope)
      if (after === undefined || after === null) {
        missing.push(name)
        continue
      }
      if (after === before.get(name)) {
        unchanged.push(name)
        continue
      }
      mounted.push(name)
    }
  }
  if (unchanged.length > 0) {
    // Release what was registered before refusing: a partial mount that leaves the agent with a
    // mixed surface is the state this lane exists to prevent.
    await disposeQuietly(realm)
    fail('DEFINITION_UNCHANGED', `${unchanged.join(', ')} still resolve to the pre-mount definition after the mount; the agent would execute the inherited body on the base provider with no confinement consulted`)
  }
  if (missing.length > 0) {
    await disposeQuietly(realm)
    fail('DEFINITION_MISSING', `${missing.join(', ')} did not resolve after the mount`)
  }
  if (Array.isArray(surface)) {
    const declared = new Set(hostSpecs.flatMap((spec) => spec.expectedTools))
    const absent = surface.filter((name) => !declared.has(name))
    if (absent.length > 0) {
      // The composition promised a surface the spec set does not cover: mounting would leave
      // those names on the inherited definition, which is the silent half-mount above.
      await disposeQuietly(realm)
      fail('SURFACE_UNCOVERED', `the composed surface names ${absent.join(', ')} but no host module spec declares them`)
    }
  }
  return Object.freeze({
    mounted: Object.freeze(mounted),
    fibers: Object.freeze(Array.isArray(fibers) ? [...fibers] : []),
    // LIFECYCLE CLOSE. The mount lives on the agent's context, so the member realm's disposal does
    // not remove it; without this the retired member's confinement outlives the member and its
    // native tools keep executing for whoever still holds the scope.
    dispose: async () => {
      // ORDER: release, then close. The tombstone cannot be registered while the mounted definition
      // still occupies the name ('already registered in this scope', measured), so the release comes
      // first and the refusal is put in its place immediately after. The window between the two is
      // the body of this call - no dispatch can interleave inside it - and it is the smallest window
      // that exists, because removal alone would leave the unconfined inherited body in place.
      if (typeof realm?.disposeNativeToolModules === 'function') {
        await disposeQuietly(realm)
      } else {
        for (const fiber of [...(Array.isArray(fibers) ? fibers : [])].reverse()) {
          try {
            await fiber?.dispose?.()
          } catch {
            // The mount's own refusal is the failure worth reporting, not a dispose race.
          }
        }
      }
      const tools = root?.get?.('tools')
      if (tools !== undefined && tools !== null && typeof tools.register === 'function') {
        for (const name of mounted) {
          try {
            tools.register(closedTombstone(name))
          } catch {
            // A reserved name cannot be shadowed; the release above still happened, and refusing
            // that call is the admission point's job, not this one's.
          }
        }
      }
    },
  })
}

/**
 * A CLOSED member must refuse, not disappear.
 *
 * Measured: removing an own registration does not make the tool unavailable - it exposes the
 * inherited one, which the UNCONFINED composition provider serves. So close registers a refusing
 * tombstone on the member's own layer FIRST, and only then releases the mounted definitions. The
 * tombstone runs no body and names itself, which is the only fail-closed way to retire a surface
 * that has an ancestor registering the same name.
 */
function closedTombstone (name) {
  const refusal = `MEMBER_CLOSED: ${JSON.stringify(name)} belongs to a retired member; the surface is closed, not reverted to the composition provider`
  return {
    name,
    description: 'Unavailable: the member that owned this tool has been closed.',
    parameters: { type: 'object', properties: {}, additionalProperties: true },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: String(value) }],
    },
    execute: async () => { throw new Error(refusal) },
  }
}

async function disposeQuietly (realm) {
  if (typeof realm?.disposeNativeToolModules === 'function') {
    try {
      await realm.disposeNativeToolModules()
    } catch {
      // The refusal below is the load-bearing outcome; a disposal failure must not replace it
      // with a different error, but the caller still learns the mount did not stand.
    }
  }
}

/**
 * The services a plugin module DECLARES it injects (Cordis' public `Plugin.inject`, array or
 * name→config object form). Metadata only: this lane never grants anything from it.
 * @param {object} module - an imported Cordis plugin module.
 * @returns {readonly string[]}
 */
function declaredInjectionsOf (module) {
  const declared = module?.inject
  if (declared === undefined || declared === null) return []
  if (Array.isArray(declared)) return declared.map((name) => String(name))
  if (typeof declared !== 'object') return []
  return Object.keys(declared)
}

/**
 * Does this realm own a confined face for `service`? An absent face is an EXPLICIT answer: a module
 * that would inject the inherited base service must not be mounted here (the realm's own
 * BL-16/BL-17/BL-18 refusals exist for exactly that), so the caller skips it rather than mounting an
 * unconfined body.
 * @param {object} realm - the mounted member realm.
 * @param {string} service - `fs` | `subprocess` | `web` | `terminals`.
 * @returns {boolean}
 */
function realmOwnsFace (realm, service) {
  const faces = realm?.installation?.members?.[0]?.faces
  if (faces === null || typeof faces !== 'object') return false
  if (service === 'fs') return faces.fs === 'confined'
  return faces[service] !== undefined && faces[service] !== null
}

/**
 * Ask the realm which tool names each module REGISTERS, without creating a shadow.
 *
 * This is the product's own ownership probe (`mountNativeToolModules` observe-only), the same
 * mechanism the route-C row uses to answer "which module owns this tool". It registers nothing and
 * the caller disposes every probe fiber, so the model-visible surface is untouched.
 * @param {object} realm - the mounted member realm.
 * @param {readonly {module: object, config?: unknown}[]} modules - imported module namespaces with
 *   the preset row's OWN config (the probe must receive the same config the real mount will).
 * @param {unknown} scope - the resolved agent scope key.
 * @param {string} routingKey - the realm's registration-routing property (`NATIVE_REGISTRATION_ROUTING`).
 * @returns {Promise<readonly Set<string>[]>} one observed name set per module, in argument order.
 */
async function observeNativeModuleOwnership (realm, modules, scope, routingKey) {
  const probes = await realm.mountNativeToolModules(
    modules.map((entry) => ({
      module: entry.module,
      ...(entry.config !== undefined ? { config: entry.config } : {}),
      observeOnly: true,
    })),
    scope === undefined ? {} : { scope },
  )
  try {
    if (!Array.isArray(probes) || probes.length !== modules.length) {
      fail(
        'GOVERNED_NATIVE_OBSERVATION_INVALID',
        `the native ownership observation must answer one receipt per preset module (got ${Array.isArray(probes) ? String(probes.length) : typeof probes} for ${String(modules.length)})`,
      )
    }
    return Object.freeze(probes.map((fiber) => {
      const routing = fiber?.[routingKey]
      return new Set(routing?.observed ?? routing?.forwarded ?? [])
    }))
  } finally {
    for (const fiber of Array.isArray(probes) ? [...probes].reverse() : []) {
      try {
        await fiber?.dispose?.()
      } catch {
        // The observation is read before disposal; a teardown race must not hide its answer.
      }
    }
  }
}

/**
 * SHAPE A — mount a GOVERNED member's native tool modules into its isolated realm BY DEFAULT.
 *
 * THE FINDING THIS CLOSES (round 60, live host): a governed Member got the centre's decision and
 * the BASE provider's I/O, because the preset's own `tool-fs` row resolves the preset standing
 * scope's base `fs`; only an explicitly configured `a5sfNativeToolModules` row re-mounted the same
 * module inside the member's isolated scope, so confinement was opt-in per row.
 *
 * THE LAW NOW: a governed member (a row that compiled a realm and installed the centre) mounts the
 * host's OWN native modules — never a Team-authored shadow — into the member realm, with the module
 * set DERIVED from the preset's own tool rows:
 *   1. the caller supplies the module specifiers of the ACTIVE preset's rows (`presetModules`);
 *   2. a row is a candidate only when the module it names DECLARES a service this realm confines
 *      (`fs`/`subprocess`/`web`/`terminals`) — a row that declares a controlled service whose face
 *      this realm does not own is SKIPPED (it cannot be confined here; an explicitly configured
 *      entry is still refused, typed, by the realm's own BL-16/17/18 invariant);
 *   3. the candidate's tool names come from the realm's own ownership observation, and a module
 *      counts as a native-I/O module only when it registers at least one name the centre admits on
 *      an axis (`TOOL_AXES`) — no second module list and no second tool list exist here;
 *   4. every name the module would register must already be on the member's POST-DENY surface. A
 *      module whose suite is partially denied cannot be re-mounted without re-enabling the denied
 *      member (an own-scope registration sits outside `tools.restrict`), so that is a typed
 *      refusal, never a widening;
 *   5. the mount is proved by DEFINITION IDENTITY per declared name (`mountHostModules`) and by an
 *      unchanged model-visible surface.
 *
 * FAIL CLOSED: an unimportable module, an invalid module, a module that declares a confined service
 * and registers nothing, and any surface change are typed `VnextRealmError`s that propagate out of
 * the member setup. There is no path here that leaves the call on the base provider because the
 * mount failed.
 *
 * UNGOVERNED ROWS ARE UNTOUCHED: `governed !== true` answers `undefined` before the realm or the
 * preset rows are read, so a row without a centre keeps today's behaviour byte-for-byte.
 *
 * @param {object} options
 * @param {boolean} options.governed - the member's compiled-realm answer is present (a centre runs).
 * @param {object} options.realm - the mounted member realm.
 * @param {object} options.root - the agent-scoped Context (owns the `tools` service).
 * @param {unknown} [options.scope] - the resolved agent scope key.
 * @param {readonly (string|{url?: string})[]} [options.presetModules] - the ACTIVE preset's row
 *   module specifiers (from the preset registry's own composition inventory).
 * @returns {Promise<{mounted: readonly string[], modules: readonly string[], skipped: readonly {url: string, reason: string}[], dispose: () => Promise<void>}|undefined>}
 *   `undefined` when the row is ungoverned or when the preset declares no module this realm can
 *   confine (nothing is reachable on a controlled axis). `dispose` releases what THIS mount
 *   registered.
 */
export async function mountGovernedNativeToolModules ({ governed, realm, root, scope, presetModules } = {}) {
  if (governed !== true) return undefined
  if (!Array.isArray(presetModules) || presetModules.length === 0) return undefined
  if (realm === null || typeof realm !== 'object' || typeof realm.mountNativeToolModules !== 'function') {
    fail('REALM_MISSING', 'a governed member has no realm to mount its native modules into; refusing rather than leaving them on the base provider')
  }
  const tools = root?.get?.('tools')
  if (tools === null || typeof tools !== 'object' || typeof tools.get !== 'function' || typeof tools.schemas !== 'function') {
    fail('TOOLS_UNAVAILABLE', 'the agent context has no tools service that can answer the surface and definition identity; a governed native mount cannot be proved without it')
  }
  // The ownership predicate and the observation key come from the PRODUCT's own modules, loaded
  // lazily so this file stays importable without the TS resolution hooks (the route-C row itself
  // does the same at its own import boundary).
  const [{ TOOL_AXES }, { NATIVE_REGISTRATION_ROUTING }] = await Promise.all([
    import('./admission.js'),
    import('../../../team-services/src/mount.js'),
  ])
  const controlledToolNames = new Set(Object.keys(TOOL_AXES))
  const surface = new Set(tools.schemas(scope).map((schema) => schema.name))
  // NOTHING TO CONFINE. The law is about names that EXIST on the member's post-deny surface: if
  // no name the centre adjudicates survives the deny, no native tool of this composition can reach
  // a controlled axis (each candidate suite is absent or wholly denied), so there is nothing to
  // mount and nothing to refuse. This also keeps a composition whose preset rows are not installed
  // in THIS process (a test-world preset double) from failing a member that has no native tool at
  // all: there is no base-provider call for the double's absent rows to leave unconfined.
  if (![...surface].some((name) => controlledToolNames.has(name))) return undefined
  /** @type {{url: string, module: object, config?: unknown}[]} */
  const candidates = []
  const skipped = []
  const seenUrls = new Set()
  for (const entry of presetModules) {
    const url = typeof entry === 'string' ? entry : entry?.url
    // A preset row that is not a host package is not a native tool module (and the mount lane
    // refuses Team-authored bodies by construction): skip, never import it here.
    if (typeof url !== 'string' || !HOST_PACKAGE.test(url) || seenUrls.has(url)) continue
    seenUrls.add(url)
    let module
    try {
      module = await import(url)
    } catch (error) {
      fail(
        'GOVERNED_NATIVE_MODULE_UNRESOLVED',
        `the preset names native tool module ${JSON.stringify(url)} but it could not be imported (${error instanceof Error ? error.message : String(error)}); a governed member never falls back to the preset's base provider for a module it cannot mount`,
      )
    }
    // A row that does not declare a controlled service is NOT a native I/O tool row (a prompt
    // section, a command, a service class...): it is never mounted here, and its plugin shape is
    // not this lane's business. Only the I/O candidates are validated as mountable plugins.
    const declared = declaredInjectionsOf(module)
    const controlled = CONTROLLED_FACE_SERVICES.filter((name) => declared.includes(name))
    if (controlled.length === 0) continue
    const pluginLike = (module !== null && typeof module === 'object' && typeof module.apply === 'function')
      || typeof module === 'function'
      || typeof module?.default === 'function'
    if (!pluginLike) {
      fail('GOVERNED_NATIVE_MODULE_INVALID', `the preset names ${JSON.stringify(url)} as a native I/O tool module, but it did not import a Cordis plugin (no apply function); refusing to leave its tools on the base provider`)
    }
    const missingFaces = controlled.filter((name) => !realmOwnsFace(realm, name))
    if (missingFaces.length > 0) {
      skipped.push({ url, reason: `this realm owns no confined ${missingFaces.join('/')} face (the module would resolve the inherited base service)` })
      continue
    }
    candidates.push({ url, module, ...(entry !== null && typeof entry === 'object' && entry.config !== undefined ? { config: entry.config } : {}) })
  }
  if (candidates.length === 0) return undefined
  const observations = await observeNativeModuleOwnership(realm, candidates.map((entry) => ({ module: entry.module, ...(entry.config !== undefined ? { config: entry.config } : {}) })), scope, NATIVE_REGISTRATION_ROUTING)
  /** @type {{url: string, module: object, expectedTools: readonly string[]}[]} */
  const specs = []
  const claimed = new Map()
  for (const [index, candidate] of candidates.entries()) {
    const observed = [...(observations[index] ?? [])]
    const controlledNames = observed.filter((name) => controlledToolNames.has(name))
    if (controlledNames.length === 0) {
      // It declares a confined service but registers no tool the centre admits: it is not a native
      // I/O tool row (a provider-only row, e.g. a skill provider). Nothing to confine; leave it be.
      continue
    }
    if (observed.length === 0) {
      fail(
        'GOVERNED_NATIVE_MODULE_EMPTY',
        `the preset's ${JSON.stringify(candidate.url)} declares a confined service this realm owns but registered no tool at the ownership probe; a governed member cannot prove which names it took over (fail closed)`,
      )
    }
    const outside = observed.filter((name) => !surface.has(name))
    if (outside.length > 0) {
      // The module's suite is (partly) DENIED on this member. Re-mounting the module registers its
      // whole suite in the member's own scope, which sits outside `tools.restrict`: that would
      // RE-ENABLE the denied names. Refuse — never widen a deny lane to obtain confinement.
      if (controlledNames.some((name) => surface.has(name))) {
        fail(
          'GOVERNED_NATIVE_SURFACE_CONFLICT',
          `the preset's ${JSON.stringify(candidate.url)} registers ${JSON.stringify(outside)}, which the member's post-deny surface does not carry; mounting the host module whole would re-enable ${outside.length === 1 ? 'that tool' : 'those tools'} outside the capability deny lane — refusing (fail closed)`,
        )
      }
      // The WHOLE suite is denied: there is nothing to confine and mounting it would only re-add
      // denied names. Skipping keeps today's (denied) behaviour exactly.
      skipped.push({ url: candidate.url, reason: `every tool it registers is denied by the member's capability lane (${outside.join(', ')})` })
      continue
    }
    for (const name of observed) {
      const owner = claimed.get(name)
      if (owner !== undefined) {
        fail('GOVERNED_NATIVE_MODULE_AMBIGUOUS', `the preset's ${JSON.stringify(owner)} and ${JSON.stringify(candidate.url)} both register ${JSON.stringify(name)}; one name must have one host module (fail closed)`)
      }
      claimed.set(name, candidate.url)
    }
    specs.push(Object.freeze({
      url: candidate.url,
      module: candidate.module,
      ...(candidate.config !== undefined ? { config: candidate.config } : {}),
      expectedTools: Object.freeze([...observed]),
    }))
  }
  if (specs.length === 0) return undefined
  const mounted = await mountHostModules({ realm, root, scope, specs })
  const after = new Set(tools.schemas(scope).map((schema) => schema.name))
  const added = [...after].filter((name) => !surface.has(name))
  const removed = [...surface].filter((name) => !after.has(name))
  if (added.length > 0 || removed.length > 0) {
    await mounted.dispose()
    fail(
      'GOVERNED_NATIVE_SURFACE_CHANGED',
      `the governed native mount would CHANGE the member's model-visible surface (added: ${JSON.stringify(added)}; removed: ${JSON.stringify(removed)}); a scoped registration is outside the inherited restrict filter, so a changed surface is refused rather than accepted`,
    )
  }
  return Object.freeze({
    mounted: mounted.mounted,
    modules: Object.freeze(specs.map((spec) => spec.url)),
    skipped: Object.freeze(skipped),
    dispose: mounted.dispose,
  })
}
