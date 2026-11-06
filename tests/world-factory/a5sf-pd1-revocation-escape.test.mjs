/**
 * a5sf-pd1-revocation-escape.test.mjs — the **PD-1 acceptance arms**.
 *
 * PD-1 (F3) in `docs/plans/active/alpha5-sandbox-first/PRODUCT-DEBT-REGISTER.md`
 * was: `revoke(memberInstanceId)` recorded a revoked generation key only for
 * members that already owned a live domain, so a member that owned NO shell at
 * revoke time was never recorded and an `acquire` afterwards succeeded.
 *
 * The owner ruling of 2026-11-09 chose **generation-scoped isolation**:
 * `revoke` takes the trusted member identity (teamId, memberInstanceId,
 * instanceGeneration) and records that generation's key unconditionally; a
 * legitimate NEW generation of the same member may still acquire. A permanent
 * `memberInstanceId`-wide tombstone was explicitly rejected because it would
 * block re-creation.
 *
 * ARMS (one contract, four observations):
 *
 *   1. `PD-1 REFUSAL` — a member that owns NO live shell at revoke time is
 *      refused afterwards with `DOMAIN_REVOKED` and **0 port allocations**.
 *   2. `PD-1 CONTRAST (live domain)` — the same member WITH a live shell at
 *      revoke time is killed and refused afterwards. This is the control that
 *      stops a red on arm 1 from being read as "revocation does nothing".
 *   3. `PD-1 IN-FLIGHT` — a revoke that lands while `spawn()` is awaited must
 *      reap the late creation BEFORE it is published: `0 usable domains`, the
 *      injected PTY is SIGKILLed, and the acquire returns `DOMAIN_REVOKED`.
 *      The fixture keeps a live shell on another binding so this arm isolates
 *      the post-await re-check from the unconditional recording line (the
 *      negative control relies on that separation).
 *   4. `PD-1 CONTRAST (new generation)` — a member re-created at a NEW
 *      generation may acquire after the old generation was revoked. This is
 *      the property the owner insisted must survive; if it ever reds, the fix
 *      has slid into the rejected member-wide tombstone.
 *
 * ARM 5 is the register coupling: the row must be `FIXED`, carry the ruling
 * semantics sentence, and name these arms. A pin that outlives its own record
 * is worse than no pin.
 *
 * SURFACE. The arms import the PRODUCT PACKAGE ENTRY
 * (`packages/runtime/team-sandbox/src/index.ts`, the public export of
 * `createTerminalDomainRegistry`). The PTY port (`PtyHandle`) is a recorder:
 * no real OS PTY is created and no boot, port or DSH_HOME is used. "Usable"
 * means the injected port was asked to `spawn` and the per-command gate
 * (`assertCurrent`) would admit; `PtyHandle` has no byte channel (PD-9).
 *
 * Run: node --test tests/world-factory/a5sf-pd1-revocation-escape.test.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { register } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = dirname(dirname(HERE))

const REGISTER_REL = 'docs/plans/active/alpha5-sandbox-first/PRODUCT-DEBT-REGISTER.md'
const ARM_REL = 'tests/world-factory/a5sf-pd1-revocation-escape.test.mjs'
const PRODUCT_ENTRY_REL = 'packages/runtime/team-sandbox/src/index.ts'

/** The owner ruling's semantics sentence, kept verbatim in the register. */
const SEMANTICS_SENTENCE =
  "Revocation is generation-scoped: `revoke` takes the trusted member identity (teamId, memberInstanceId, instanceGeneration) and records that generation's revocation key unconditionally, even when the member owns no live domain; a new generation of the same member may acquire, and a spawn that completes after the revoke is reaped before publication."

/** Cache the product module per process; the loader hook must be installed first. */
let productModule
async function loadProduct() {
  if (productModule !== undefined) return productModule
  register(pathToFileURL(join(REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)
  productModule = await import(pathToFileURL(join(REPO_ROOT, PRODUCT_ENTRY_REL)).href)
  return productModule
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

async function until(predicate, what) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (predicate()) return
    await tick()
  }
  throw new Error(`PD-1 fixture: timed out waiting for ${what}`)
}

/**
 * One host-free world: the REAL product registry over an injected `PtyHandle`
 * recorder. `allocations` counts `spawn` requests; `kills` records every
 * signal the registry sent to a recorded shell.
 */
async function makeWorld() {
  const product = await loadProduct()
  const allocations = []
  const kills = []
  let pid = 7000
  const registry = product.createTerminalDomainRegistry({
    currentRevision: () => 'rev-1',
    now: () => '2026-11-09T00:00:00.000Z',
    isTrustedMember: () => true,
  })

  function acquire(identity, binding = 'binding-shell', { gate } = {}) {
    pid += 1
    const label = `${identity.memberInstanceId}/${binding}`
    return registry.acquire({
      owner: { identity, toolBindingIdentity: binding },
      sessionHandle: `session-${binding}`,
      policyRevision: 'rev-1',
      backend: 'pty-recorder',
      spawn: async () => {
        allocations.push(label)
        if (gate !== undefined) await gate
        let alive = true
        return {
          pid,
          backend: 'pty-recorder',
          descendants: () => (alive ? [pid + 1, pid + 2] : []),
          async kill(signal = 'SIGTERM') {
            kills.push([label, signal])
            alive = false
          },
        }
      },
    })
  }

  return { registry, acquire, allocations, kills }
}

const MEMBER = Object.freeze({
  teamId: 'team-a5sf-pd1',
  memberInstanceId: 'member-pd1',
  templateId: 'worker',
  instanceGeneration: 1,
})
const NEXT_GENERATION = Object.freeze({ ...MEMBER, instanceGeneration: 2 })

// ---------------------------------------------------------------------------
// 1. THE FIXED CONTRACT — a member with NO live shell is still bound.
// ---------------------------------------------------------------------------

test('PD-1 REFUSAL: revocation binds a member that owns no live shell (DOMAIN_REVOKED, 0 allocations)', async () => {
  const world = await makeWorld()

  // The authority withdraws BEFORE the member ever holds a shell.
  const killed = await world.registry.revoke(MEMBER, 'member archived')
  assert.deepEqual(killed, [], 'PD-1 fixture: there is no live domain to kill at revoke time')
  assert.equal(world.allocations.length, 0, 'PD-1 fixture: no port allocation happened before the revoke')

  const refused = await world.acquire(MEMBER, 'binding-late')
  assert.equal(refused.ok, false, 'PD-1: a revoked generation must not acquire a shell, even with no live domain at revoke time')
  assert.equal(refused.code, 'DOMAIN_REVOKED', `PD-1: expected DOMAIN_REVOKED, got ${JSON.stringify(refused)}`)
  assert.equal(world.allocations.length, 0, 'PD-1: the refused acquire must not reach the port at all')
  assert.equal(world.registry.list().length, 0, 'PD-1: no domain may exist after a refused acquire')
  process.stdout.write('PD1-REFUSAL-ZERO-ALLOC\n')
})

// ---------------------------------------------------------------------------
// 2. THE WITH-DOMAIN CONTRAST — revocation still kills a visible shell.
// ---------------------------------------------------------------------------

test('PD-1 CONTRAST (live domain): revocation kills the shell and refuses that generation', async () => {
  const world = await makeWorld()

  const before = await world.acquire(MEMBER, 'binding-live')
  assert.equal(before.ok, true, 'fixture: the member holds a live shell before the revoke')
  const liveDomainId = before.value.domainId

  const killed = await world.registry.revoke(MEMBER, 'member archived')
  assert.deepEqual(killed, [liveDomainId], 'revocation kills exactly the visible domain')
  assert.deepEqual(world.kills, [[`${MEMBER.memberInstanceId}/binding-live`, 'SIGKILL']], 'revocation SIGKILLs the live shell')
  assert.equal(world.registry.assertCurrent(liveDomainId).ok, false, 'the killed domain no longer admits commands')

  const after = await world.acquire(MEMBER, 'binding-live')
  assert.equal(after.ok, false, 'a member that owned a live shell at revoke time is REFUSED afterwards')
  assert.equal(after.code, 'DOMAIN_REVOKED')
  assert.equal(world.allocations.length, 1, 'the refused acquire allocated no second shell')
  assert.equal(world.registry.list().length, 0)
  process.stdout.write('PD1-CONTRAST-WITH-DOMAIN\n')
})

// ---------------------------------------------------------------------------
// 3. THE IN-FLIGHT RACE — a revoke during an awaited spawn must reap the
//    late creation before it can be published.
// ---------------------------------------------------------------------------

test('PD-1 IN-FLIGHT: a revocation during an awaited spawn reaps the late creation (0 usable domains)', async () => {
  const world = await makeWorld()

  // A live shell on ANOTHER binding: it makes the revoke record the generation
  // through the historical live-domain path, so this arm isolates the
  // post-await re-check rather than the unconditional recording line.
  const live = await world.acquire(MEMBER, 'binding-live')
  assert.equal(live.ok, true, 'fixture: the member holds a live shell before the race')

  let releaseSpawn
  const spawnGate = new Promise((resolve) => {
    releaseSpawn = resolve
  })
  const inFlightLabel = `${MEMBER.memberInstanceId}/binding-inflight`
  const inFlight = world.acquire(MEMBER, 'binding-inflight', { gate: spawnGate })
  await until(() => world.allocations.includes(inFlightLabel), 'the in-flight spawn to be entered')

  // The revocation lands while `spawn()` is still awaited. No domain for the
  // in-flight binding exists in `domains` yet, so only the post-await re-check
  // can stop it from being published.
  const killed = await world.registry.revoke(MEMBER, 'member archived')
  assert.deepEqual(killed, [live.value.domainId], 'the visible live domain is killed by the same revoke')

  releaseSpawn()
  const late = await inFlight

  assert.equal(late.ok, false, 'PD-1 race: a creation that completes after the revoke must not become eligible')
  assert.equal(late.code, 'DOMAIN_REVOKED', `PD-1 race: expected DOMAIN_REVOKED, got ${JSON.stringify(late)}`)
  assert.ok(
    world.kills.some(([label, signal]) => label === inFlightLabel && signal === 'SIGKILL'),
    'PD-1 race: the spawned shell must be killed/reaped by the registry',
  )
  assert.equal(world.registry.list().length, 0, 'PD-1 race: ZERO usable domains after the in-flight revoke')
  assert.equal(world.allocations.filter((label) => label === inFlightLabel).length, 1, 'the late spawn did allocate exactly once')
  // No publish means nothing is addressable under any domain id the caller saw.
  assert.equal('value' in late, false, 'a refused in-flight creation returns no domain id')
  process.stdout.write('PD1-INFLIGHT-REAPED\n')
})

// ---------------------------------------------------------------------------
// 4. THE NEW-GENERATION CONTRAST — the property the ruling insisted survives.
// ---------------------------------------------------------------------------

test('PD-1 CONTRAST (new generation): a re-created generation may acquire after revocation', async () => {
  const world = await makeWorld()

  const first = await world.acquire(MEMBER, 'binding-gen1')
  assert.equal(first.ok, true, 'fixture: the first generation holds a shell')

  // Deliberately generation-agnostic. This arm asserts only the property the
  // owner required to survive — a new generation is not blocked by the old
  // generation's revocation — so it can pass both before and after the fix
  // (before it, `revoke` under the new signature is a no-op and the acquire
  // reuses the old domain; after it, the old domain is killed and a new one is
  // spawned). The kill itself is arm 2's job, not this arm's.
  await world.registry.revoke(MEMBER, 'member archived')

  const recreated = await world.acquire(NEXT_GENERATION, 'binding-gen2')
  assert.equal(recreated.ok, true, 'a NEW generation is a NEW revocation scope and may acquire')
  assert.ok(recreated.value.domainId.length > 0, 'the re-created generation received a domain')
  const gate = world.registry.assertCurrent(recreated.value.domainId)
  assert.equal(gate.ok, true, 'the re-created generation command gate admits')
  process.stdout.write('PD1-CONTRAST-NEW-GENERATION-ACQUIRES\n')
})

// ---------------------------------------------------------------------------
// 5. THE REGISTER COUPLING — the row must stay FIXED and name these arms.
// ---------------------------------------------------------------------------

test('PD-1 REGISTER: the row is FIXED, carries the ruling semantics, and names these arms', () => {
  const register = readFileSync(join(REPO_ROOT, REGISTER_REL), 'utf8')
  const relation =
    `PD-1 in ${REGISTER_REL} no longer supports these acceptance arms. A pin that survives the ` +
    'deletion or downgrade of its own record is worse than no pin: restore the PD-1 row with its ' +
    `FIXED status, the owner-ruling semantics sentence, and the acceptance pointer to ${ARM_REL}.`

  // (a) the at-a-glance table still carries the PD-1 row and marks it FIXED.
  const tableRow = register
    .split('\n')
    .find((line) => /^\|\s*PD-1 \(F3\)\s*\|/.test(line))
  assert.ok(tableRow !== undefined, `the summary table has no PD-1 (F3) row. ${relation}`)
  assert.match(tableRow, /FIXED/, `the summary table does not mark PD-1 FIXED. ${relation}`)

  // (b) the detail block carries a `status: FIXED` field.
  const head = /^### PD-1 \(F3\) — .+$/m.exec(register)
  assert.ok(head !== null, `the register has no "### PD-1 (F3) — …" detail block. ${relation}`)
  const rest = register.slice(head.index + head[0].length)
  const next = /^### PD-\d+ \(/m.exec(rest)
  const body = next === null ? rest : rest.slice(0, next.index)
  assert.match(body, /^- \*\*status\*\*: FIXED — /m, `the PD-1 detail block is not FIXED with evidence. ${relation}`)

  // (c) the owner ruling's semantics sentence is present verbatim.
  assert.ok(body.includes(SEMANTICS_SENTENCE), `the PD-1 row no longer states the 2026-11-09 ruling semantics. ${relation}`)

  // (d) the row names this arm and the four observation names.
  assert.ok(body.includes(ARM_REL), `the PD-1 row no longer names this arm as its acceptance criterion. ${relation}`)
  for (const arm of ['PD-1 REFUSAL', 'PD-1 CONTRAST (live domain)', 'PD-1 IN-FLIGHT', 'PD-1 CONTRAST (new generation)']) {
    assert.ok(body.includes(arm), `the PD-1 row no longer names the arm "${arm}". ${relation}`)
  }
})
