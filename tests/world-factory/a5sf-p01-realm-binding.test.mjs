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
 *   A4 RETIRED-BY-A0 (round 80): the guard consequence used to be measured on
 *      the legacy dispatch algebra (`packages/runtime/tool-dispatch/index.ts`),
 *      which the A0 cut deleted and the A1 execution centre replaced. The
 *      declaration contract is still measured here (A1/A2/A3/A5); the guard
 *      consequence is carried by `packages/runtime/test/vnext-admission.test.mjs`
 *      and `packages/runtime/test/a5p2-admission-kernel.test.ts`. See the
 *      retirement pin below for the subject, citation and successors. Nothing
 *      was skipped.
 *   A5 the "no realm" world is byte-identical: no fibers => no receipt names =>
 *      nothing declared, and the plane's own-name handling is untouched.
 *
 * NOT PROVEN HERE (and not claimed): that the plane's `bash` body is the native
 * DSH definition. It is NOT — that is the reported A5-NATIVE-01/02 finding,
 * owned by the native-preservation lane, not by this binding repair.
 */
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { register } from 'node:module'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..')

register(pathToFileURL(join(REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)

const row = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs')).href)
/** The receipt property the mount publishes on every route-C fiber. */
const mountSeam = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'team-services', 'src', 'mount.ts')).href)

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

// ── A4 RETIRED-BY-A0 (round 80): the guard consequence ───────────────────────
// WHAT WAS HERE. Two arms (A4, A4b) measured the CONSEQUENCE of the declaration
// on the retired dispatch algebra — `createGovernedSurface` / `guardDecision`,
// `untestedAssurance`, `GUARD_DENIAL_REASONS`, imported at module scope from
// `packages/runtime/tool-dispatch/index.ts`:
//   A4   a name bound `verified:true` dispatches with no unverified denial,
//        while the same name on the inherited lane answers TOOL_BINDING_UNVERIFIED;
//   A4b  a name absent from `forwarded` is never declared, so it keeps that refusal.
//
// WHY THEY ARE RETIRED (per SUBJECT, never "the check was red").
//   subject:   the legacy guard algebra in `packages/runtime/tool-dispatch/index.ts`.
//   citation:  the module is in the A0 frozen delete set
//              (`dev/agent-workflow/ledgers/ute-p0-assets.snapshot.json`;
//              `dev/agent-workflow/ledgers/ute-cut-closure.allow.json`
//              `#retiredSubjects` books the per-file loss), and the A1 execution
//              centre replaced it: `TOOL_BINDING_UNVERIFIED` is now answered by
//              the centre's admission port, not by a governed surface.
//   successor: `packages/runtime/test/vnext-admission.test.mjs` (the
//              `ute-vnext-a1` CI leg: the ONE admission point, including the
//              no-binding / no-axis / no-locator refusals) and
//              `packages/runtime/test/a5p2-admission-kernel.test.ts` (the
//              kernel's TOOL_BINDING_UNVERIFIED arms).
//
// WHAT THIS PIN STILL ENFORCES. The retired module must stay absent (a
// re-introduced import is a module-load failure, i.e. RED), and the surviving
// declaration contract in A1/A1b/A2/A3/A3b/A5 above is still measured: a name
// is declared only when it was forwarded, is on the post-attach surface, is not
// plane-owned and is readable. No skip was added anywhere in this file.
test('A4 RETIRED-BY-A0: the legacy guard algebra stays gone and its successors exist', () => {
  for (const rel of [
    'packages/runtime/test/vnext-admission.test.mjs',
    'packages/runtime/test/a5p2-admission-kernel.test.ts',
  ]) {
    assert.ok(existsSync(join(REPO_ROOT, rel)), `successor ${rel} must exist — a retirement without a target is a silence`)
  }
  assert.equal(existsSync(join(REPO_ROOT, 'packages', 'runtime', 'tool-dispatch', 'index.ts')), false,
    'the A0 cut retired packages/runtime/tool-dispatch/index.ts; a restored module would re-open the second policy the centre replaced')
})

// ── A5 the no-realm world ───────────────────────────────────────────────────

test('A5 no attach => no declared names and no skipped names (byte-identical path)', () => {
  const attached = row.a5sfAttachedToolNames([])
  const out = row.a5sfBindableRealmNames({ attachedNames: [...attached], surface: SURFACE, planeOwned: new Set(), lookup })
  assert.deepEqual([...out.declared], [])
  assert.deepEqual([...out.skipped], [])
})
