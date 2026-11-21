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
 * @returns {Promise<{ mounted: readonly string[], fibers: readonly object[] }>}
 */
export async function mountHostModules ({ realm, root, scope, specs, surface }) {
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
  return Object.freeze({ mounted: Object.freeze(mounted), fibers: Object.freeze(Array.isArray(fibers) ? [...fibers] : []) })
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
