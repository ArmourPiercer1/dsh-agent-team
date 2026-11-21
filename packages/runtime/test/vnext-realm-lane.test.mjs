/**
 * vnext-realm-lane.test.mjs — the mount lane's own arms, with a fake registry.
 *
 * The fake is a registry, not a provider: it answers the only question the lane asks
 * ("which definition does the agent resolve for this name?") and lets each arm make the mount
 * fail in the specific way the lane exists to catch. The real host mount is proven separately
 * (a live boot), because a fake must never be the evidence that a real provider was consulted.
 *
 * Run: node --test packages/runtime/test/vnext-realm-lane.test.mjs
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hostNativeSpecs, mountHostModules, VnextRealmError } from '../src/plugin/vnext/realm-lane.mjs'

const plugin = (name) => ({ name, apply () {} })

const toolsWith = (definitions) => {
  const map = new Map(Object.entries(definitions))
  return {
    map,
    get: (name, scope) => (scope === undefined ? map.get(name) : map.get(`${scope}/${name}`) ?? map.get(name)),
  }
}

/**
 * A realm whose mount REGISTERS into the given registry, the way a real mount does: it installs a
 * NEW definition object for each name. `expose: []` models a mount that reports success while the
 * agent keeps resolving the old definition (the silent half-mount).
 */
const realmRegistering = (tools, { expose } = {}) => {
  let disposed = 0
  const names = expose ?? [...tools.map.keys()]
  return {
    disposed: () => disposed,
    async mountNativeToolModules (modules, options) {
      const registered = []
      for (const name of names) {
        const mount = modules[0]
        // The lane must hand the realm MOUNT DESCRIPTORS, not raw namespaces: a bare namespace
        // would mount nothing, and the lane would then report the wrong cause (DEFINITION_UNCHANGED).
        if (mount === null || typeof mount !== 'object' || !('module' in mount)) throw new Error('mount is not a descriptor')
        const definition = { execute () {}, mountedFrom: mount.module, options }
        tools.map.set(name, definition)
        registered.push({ module: modules[0], name, definition, options })
      }
      this.registered = registered
      return registered.map(() => ({ dispose () {} }))
    },
    async disposeNativeToolModules () { disposed += 1 },
  }
}

const hostSpec = (url, expectedTools, module = plugin(url)) => ({ url, module, expectedTools })

test('REALM-1 — a Team-authored or file:// body is refused by declaration', () => {
  assert.throws(() => hostNativeSpecs([hostSpec('file:///repo/confined-fs-tool.mjs', ['read'])]), (e) => e instanceof VnextRealmError && e.code === 'MODULE_NOT_HOST')
  assert.throws(() => hostNativeSpecs([hostSpec('./confined-fs-tool.mjs', ['read'])]), (e) => e.code === 'MODULE_NOT_HOST')
  assert.throws(() => hostNativeSpecs([hostSpec('node:fs', ['read'])]), (e) => e.code === 'MODULE_NOT_HOST')
})

test('REALM-2 — the host package specifier is accepted, with or without a subpath', () => {
  const specs = hostNativeSpecs([hostSpec('@deepseek-ai/dsh-tool-fs', ['read', 'write', 'edit'])])
  assert.equal(specs.length, 1)
  assert.deepEqual([...specs[0].expectedTools], ['read', 'write', 'edit'])
})

test('REALM-3 — one name, one host module: duplicate claims and duplicate packages are refused', () => {
  assert.throws(() => hostNativeSpecs([hostSpec('@deepseek-ai/dsh-tool-fs', ['read']), hostSpec('@deepseek-ai/dsh-other', ['read'])]), (e) => e.code === 'MODULE_TOOL_DUPLICATE')
  assert.throws(() => hostNativeSpecs([hostSpec('@deepseek-ai/dsh-tool-fs', ['read']), hostSpec('@deepseek-ai/dsh-tool-fs', ['write'])]), (e) => e.code === 'MODULE_URL_DUPLICATE')
})

test('REALM-4 — a module without expectedTools cannot prove what it took over, so it is refused', () => {
  assert.throws(() => hostNativeSpecs([hostSpec('@deepseek-ai/dsh-tool-fs', [])]), (e) => e.code === 'MODULE_TOOLS_MISSING')
  assert.throws(() => hostNativeSpecs([{ url: '@deepseek-ai/dsh-tool-fs', module: plugin('fs') }]), (e) => e.code === 'MODULE_TOOLS_MISSING')
})

test('REALM-5 — a successful mount reports every declared name as changed', async () => {
  const base = { execute () {} }
  const tools = toolsWith({ read: base })
  const realm = realmRegistering(tools)
  const specs = hostNativeSpecs([hostSpec('@deepseek-ai/dsh-tool-fs', ['read'])])
  const result = await mountHostModules({ realm, root: { get: () => tools }, specs })
  assert.deepEqual([...result.mounted], ['read'])
  assert.equal(realm.disposed(), 0, 'a standing mount is not disposed')
})

test('REALM-6 — a mount the agent does not resolve is a REFUSAL, not a warning (the silent half-mount)', async () => {
  // The realm "succeeds" but registers into a different scope: the agent still resolves the
  // preset definition, which is exactly the failure that ran unconfined in production.
  const tools = toolsWith({ read: { execute () {} } })
  const realm = {
    async mountNativeToolModules () { return [] },
    async disposeNativeToolModules () { this.disposed = true },
  }
  const specs = hostNativeSpecs([hostSpec('@deepseek-ai/dsh-tool-fs', ['read'])])
  await assert.rejects(
    () => mountHostModules({ realm, root: { get: () => tools }, specs }),
    (e) => e instanceof VnextRealmError && e.code === 'DEFINITION_UNCHANGED' && /read/.test(e.message),
  )
  assert.equal(realm.disposed, true, 'a refused mount releases what it half-registered')
})

test('REALM-7 — a declared name that does not resolve at all is refused', async () => {
  const tools = toolsWith({})
  const realm = realmRegistering(tools, { expose: [] })
  const specs = hostNativeSpecs([hostSpec('@deepseek-ai/dsh-tool-fs', ['read'])])
  await assert.rejects(() => mountHostModules({ realm, root: { get: () => tools }, specs }), (e) => e.code === 'DEFINITION_MISSING')
})

test('REALM-8 — no realm means no fallback to the composition provider', async () => {
  await assert.rejects(() => mountHostModules({ realm: null, root: { get: () => toolsWith({}) }, specs: [] }), (e) => e.code === 'REALM_MISSING')
  await assert.rejects(() => mountHostModules({ realm: {}, root: { get: () => toolsWith({}) }, specs: [] }), (e) => e.code === 'REALM_MISSING')
})

test('REALM-9 — without definition identity there is no proof, so the mount is refused up front', async () => {
  await assert.rejects(
    // The realm must never be reached: a registry that cannot answer `get` cannot prove the mount
    // took effect, so the refusal happens before any module is mounted.
    () => mountHostModules({ realm: { async mountNativeToolModules () { throw new Error('must not be called') } }, root: { get: () => ({}) }, specs: hostNativeSpecs([hostSpec('@deepseek-ai/dsh-tool-fs', ['read'])]) }),
    (e) => e.code === 'TOOLS_UNAVAILABLE',
  )
})

test('REALM-10 — a composed surface the specs do not cover is refused, never left on the base provider', async () => {
  const tools = toolsWith({ read: { execute () {} } })
  const realm = realmRegistering(tools)
  const specs = hostNativeSpecs([hostSpec('@deepseek-ai/dsh-tool-fs', ['read'])])
  await assert.rejects(
    () => mountHostModules({ realm, root: { get: () => tools }, specs, surface: ['read', 'bash'] }),
    (e) => e.code === 'SURFACE_UNCOVERED' && /bash/.test(e.message),
  )
})
