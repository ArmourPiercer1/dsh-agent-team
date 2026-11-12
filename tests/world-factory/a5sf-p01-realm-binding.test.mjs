/**
 * a5sf-p01-realm-binding.test.mjs — P01 TASK A (realm BINDING repair), 2026-11-11.
 *
 * ZERO Host boots, ZERO ports, no DSH_HOME. Pure modules + one in-process guard
 * surface; `mkdtemp` fixtures only.
 * Run: `node --test tests/world-factory/a5sf-p01-realm-binding.test.mjs`
 *
 * THE MEASURED DEFECT THIS SUITE PINS (audit C Change A, PD-42 live result):
 * the route-C attach registers the Member realm's confined
 * `read`/`write`/`edit`/`read_image` definitions, but nothing declares them to
 * the closed-world Guard: they are absent from the global `nativeNames` (which
 * carries no scope) and from `bindOwnTools`' name list, so the Guard binds them
 * through the INHERITED lane as `verified:false` and every call is refused
 * `TOOL_BINDING_UNVERIFIED` before any realm face is consulted.
 *
 * ARMS:
 *   A1 the receipt reader takes `routing.forwarded` on `realm === 'ceiling'`
 *      fibers ONLY — never `observed` (which also lists DROPPED names), never a
 *      module's `expectedTools`, never a binding-realm fiber.
 *   A2 the admission predicate declares a forwarded name that is on the
 *      post-attach surface, not plane-owned, and readable — the positive arm.
 *   A3 each failing arm refuses ALONE: plane-owned, off-surface, unreadable.
 *      Fail closed: a refused name is not declared, so it keeps the pre-P01
 *      refusal rather than getting a wider bind.
 *   A4 the GUARD consequence, measured on the real algebra: a name bound
 *      `verified:true` dispatches with NO unverified denial, while the same
 *      name on the inherited lane answers `TOOL_BINDING_UNVERIFIED` — i.e. a
 *      name ABSENT from `forwarded` stays refused exactly as before.
 *   A5 the "no realm" world is byte-identical: no fibers => no receipt names =>
 *      nothing declared, and the plane's own-name handling is untouched.
 *
 * NOT PROVEN HERE (and not claimed): that the plane's `bash` body is the native
 * DSH definition. It is NOT — that is the reported A5-NATIVE-01/02 finding,
 * owned by the native-preservation lane, not by this binding repair.
 */
import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { register } from 'node:module'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..')

register(pathToFileURL(join(REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)

const row = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs')).href)
const dispatch = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'tool-dispatch', 'index.ts')).href)
/** The receipt property the mount publishes on every route-C fiber. */
const mountSeam = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'team-services', 'src', 'mount.ts')).href)
const domain = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'domain', 'tool-governance', 'src', 'index.ts')).href)

/** A fiber double carrying only the registration receipt the mount publishes. */
function fiberOf(routing) {
  return { [mountSeam.NATIVE_REGISTRATION_ROUTING]: routing }
}

const ROUTING_CEILING = {
  realm: 'ceiling',
  toolBindingIdentity: null,
  forwarded: ['read', 'write', 'edit'],
  observed: ['read', 'write', 'edit', 'bash'],
  dropped: ['bash'],
  forwardedSections: [],
}

// ── A1 the receipt reader ───────────────────────────────────────────────────

test('A1 the receipt reader takes ONLY forwarded names from ceiling fibers', () => {
  const names = row.a5sfAttachedToolNames([
    fiberOf(ROUTING_CEILING),
    // `bash` is OBSERVED and DROPPED by that fiber, never forwarded: it must
    // not be declared (it is the plane's name in this composition anyway).
    fiberOf({ realm: 'ceiling', toolBindingIdentity: null, forwarded: ['read_image'], observed: ['read_image'], dropped: [], forwardedSections: [] }),
    // A binding-targeted fiber forwards exactly one name owned by ANOTHER
    // realm: not part of the Member ceiling set.
    fiberOf({ realm: 'binding', toolBindingIdentity: 'dsh.fs/read', forwarded: ['secret'], observed: ['secret'], dropped: [], forwardedSections: [] }),
  ])
  assert.deepEqual([...names], ['read', 'write', 'edit', 'read_image'])
  assert.ok(!names.includes('bash'), 'an OBSERVED-but-DROPPED name is never a forwarded name')
  assert.ok(!names.includes('secret'), 'a binding-realm fiber is not the Member ceiling')
})

test('A1b an empty/absent attach answers an empty set (the no-realm world)', () => {
  assert.deepEqual([...row.a5sfAttachedToolNames(undefined)], [])
  assert.deepEqual([...row.a5sfAttachedToolNames([])], [])
  assert.deepEqual([...row.a5sfAttachedToolNames([{}])], [], 'a fiber without a receipt contributes nothing')
})

// ── A2/A3 the admission predicate ───────────────────────────────────────────

const SURFACE = new Set(['read', 'write', 'edit'])
const READABLE = new Set(['read', 'write', 'edit'])
const lookup = (name) => (READABLE.has(name) ? { name } : undefined)

test('A2 a forwarded name on the surface, not plane-owned and readable IS declared', () => {
  const out = row.a5sfBindableRealmNames({
    attachedNames: [...row.a5sfAttachedToolNames([fiberOf(ROUTING_CEILING)])],
    surface: SURFACE,
    planeOwned: new Set(['bash']),
    lookup,
  })
  assert.deepEqual([...out.declared], ['read', 'write', 'edit'])
  assert.deepEqual([...out.skipped], [])
})

test('A3 a PLANE-OWNED name is not double-bound', () => {
  const out = row.a5sfBindableRealmNames({
    attachedNames: ['read', 'bash'],
    surface: new Set([...SURFACE, 'bash']),
    planeOwned: new Set(['bash']),
    lookup,
  })
  assert.deepEqual([...out.declared], ['read'])
  assert.deepEqual([...out.skipped], [{ name: 'bash', reason: 'plane-owned' }])
})

test('A3b a name off the post-attach surface, or unreadable at the public seam, is refused', () => {
  const out = row.a5sfBindableRealmNames({
    attachedNames: ['read', 'gone', 'unreadable'],
    surface: new Set([...SURFACE, 'unreadable']),
    planeOwned: new Set(),
    lookup,
  })
  assert.deepEqual([...out.declared], ['read'])
  assert.deepEqual([...out.skipped], [
    { name: 'gone', reason: 'not-on-post-attach-surface' },
    { name: 'unreadable', reason: 'definition-unreadable' },
  ])
})

test('A3c an empty receipt declares nothing at all (never a wide bind)', () => {
  const out = row.a5sfBindableRealmNames({ attachedNames: [], surface: SURFACE, planeOwned: new Set(), lookup })
  assert.deepEqual([...out.declared], [])
  assert.deepEqual([...out.skipped], [])
})

// ── A4 the guard consequence, on the real algebra ───────────────────────────

const SCOPE = { agentScopeKey: 'session-p01', trustedIdentities: ['session-p01'] }

function bindingFor(name) {
  const parsed = domain.parseToolBinding({
    bindingId: `team-own:session-p01:${name}`,
    agentScopeKey: 'session-p01',
    toolName: name,
    definitionIdentity: `team-own:${name}`,
    providerId: 'dsh-agent-team',
    implementationOrigin: 'team-trusted-extension',
    executionBoundary: 'trusted-host',
    assurance: dispatch.untestedAssurance('team-trusted-extension', 'trusted-host'),
    policyGeneration: 0,
    authorityGeneration: 0,
    revision: 1,
    status: 'ACTIVE',
  })
  assert.equal(parsed.ok, true, 'fixture ToolBinding must parse')
  return parsed.value
}

/**
 * What the Guard answers for `name` over a surface that bound it `verified` or
 * not — the REAL algebra, with the definition fingerprint the Binding pinned so
 * the R2 definition check is a match rather than a drift.
 */
function verdictFor(name, verified) {
  const surface = dispatch.createGovernedSurface(SCOPE)
  const binding = bindingFor(name)
  const bound = surface.bind({ name, origin: 'team-own', binding, verified })
  assert.equal(bound.ok, true)
  return dispatch.guardDecision({
    exec: { name, agentIdentity: 'session-p01' },
    scope: SCOPE,
    surface,
    active: true,
    policyGeneration: 0,
    authorityGeneration: 0,
    definition: { ok: true, fingerprint: binding.definitionIdentity },
  })
}

test('A4 DECLARED (verified) dispatches; the SAME name on the inherited lane is refused unverified', () => {
  const declared = verdictFor('read', true)
  assert.notEqual(declared.kind, 'deny', `a declared realm-forwarded name must dispatch: ${JSON.stringify(declared)}`)

  // The pre-P01 world: the name exists on the model surface but the assembly
  // never bound it, so the Guard holds no verified Binding for it.
  const refused = verdictFor('read', false)
  assert.equal(refused.kind, 'deny')
  assert.equal(refused.error.code, 'TOOL_BINDING_UNVERIFIED')
  assert.equal(refused.reason, dispatch.GUARD_DENIAL_REASONS.BINDING_UNVERIFIED)
})

test('A4b a name ABSENT from `forwarded` is never declared => it keeps the pre-P01 refusal', () => {
  const forwarded = new Set(row.a5sfAttachedToolNames([fiberOf(ROUTING_CEILING)]))
  assert.ok(forwarded.has('read'))
  assert.ok(!forwarded.has('bash'), 'bash is not forwarded by the realm in this composition')
  const admitted = row.a5sfBindableRealmNames({
    attachedNames: [...forwarded],
    surface: new Set([...SURFACE, 'bash']),
    planeOwned: new Set(['bash']),
    lookup: (name) => ({ name }),
  })
  assert.ok(!admitted.declared.includes('bash'), 'bash never enters the realm bind set')
  const bash = verdictFor('bash', false)
  assert.equal(bash.kind, 'deny')
  assert.equal(bash.error.code, 'TOOL_BINDING_UNVERIFIED')
})

// ── A5 the no-realm world ───────────────────────────────────────────────────

test('A5 no attach => no declared names and no skipped names (byte-identical path)', () => {
  const attached = row.a5sfAttachedToolNames([])
  const out = row.a5sfBindableRealmNames({ attachedNames: [...attached], surface: SURFACE, planeOwned: new Set(), lookup })
  assert.deepEqual([...out.declared], [])
  assert.deepEqual([...out.skipped], [])
})
