/**
 * a5sf-pd1-revocation-escape.test.mjs — the **PD-1 acceptance arm**: an
 * executable DEFECT PIN for the revocation escape recorded in
 * `docs/plans/active/alpha5-sandbox-first/PRODUCT-DEBT-REGISTER.md` §2 (PD-1 (F3)).
 *
 * THIS ARM IS NOT A GUARANTEE. Read the discipline before changing it:
 *
 *   1. IT ASSERTS THE DEFECT, NOT THE CONTRACT. Today
 *      `revoke(memberInstanceId)` records a revoked generation key only for
 *      members that already own a live domain (`terminal.ts:249-258`), and its
 *      signature carries no generation. A member that owns NO shell at revoke
 *      time is therefore never recorded, and an `acquire` AFTERWARDS succeeds
 *      — one real port-allocation request, a live `active` domain whose
 *      per-command gate (`assertCurrent`) admits. The arm goes green by
 *      printing `PD1-ESCAPE-REPRODUCED`.
 *
 *   2. WHEN PD-1 IS FIXED THIS ARM MUST TURN RED ON PURPOSE. The failure
 *      message is the handover contract: it names the register row and says
 *      the register needs updating. Red here means "the record caught up with
 *      the code", not "a regression".
 *
 *   3. IT IS COUPLED TO THE REGISTER. A separate case reds if
 *      `PRODUCT-DEBT-REGISTER.md` no longer carries the PD-1 row classified
 *      `governance hole`, or no longer points at this arm as its acceptance
 *      criterion. A defect pin that survives the deletion of its own record is
 *      worse than no pin.
 *
 *   4. IT CARRIES ITS OWN CONTRAST. The same member WITH a live domain at
 *      revoke time is killed and refused afterwards — so a red on the escape
 *      case cannot be confused with "revocation does nothing here at all".
 *
 *   5. IT HAS A NEGATIVE CONTROL. `mutation-control.mjs` in the evidence
 *      directory records the generation unconditionally in-process, which
 *      makes the escape impossible; the same arm run with
 *      `A5SF_PD1_EXPECT=fixed` then asserts the closed outcome and is GREEN.
 *      The product source is restored byte-for-byte. See
 *      `dev/agent-workflow/evidence/a5sf-product-debt/PD-1-revocation-escape/`.
 *
 * SURFACE. The arm imports the PRODUCT PACKAGE ENTRY
 * (`packages/runtime/team-sandbox/src/index.ts`, the public export of
 * `createTerminalDomainRegistry`), not the private module file and not a test
 * double of the registry. There is no product mount for a terminal face today
 * (`RealmServiceFaces` has no `terminals` — PD-3), so the package entry is the
 * deepest reachable product surface for this lifecycle; the evidence README
 * states that scoping plainly. The PTY port (`PtyHandle`) is the seam the
 * module itself injects and is a recorder: no real OS PTY is created, and the
 * arm does not claim one.
 *
 * ZERO Host boots, ZERO ports, no DSH_HOME, no `tests/homes/**`, no pinned host
 * checkout: the module under test is the repo's own TS source, loaded through
 * the repo's type-stripping hook.
 *
 * Run: node --test tests/world-factory/a5sf-pd1-revocation-escape.test.mjs
 * Control: A5SF_PD1_EXPECT=fixed node --test ... (only the mutation driver sets it)
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

/** The one machine-readable line the pin prints when the escape is reproduced. */
const ESCAPE_TOKEN = 'PD1-ESCAPE-REPRODUCED'
/** The control's line: printed only under the mutation, when the escape is closed. */
const CLOSED_TOKEN = 'PD1-ESCAPE-CLOSED'

/** `fixed` is set ONLY by the negative-control driver; the pin's default mode is `escape`. */
const EXPECT = process.env.A5SF_PD1_EXPECT ?? 'escape'
assert.ok(['escape', 'fixed'].includes(EXPECT), `A5SF_PD1_EXPECT must be "escape" or "fixed", got "${EXPECT}"`)

const HANDOVER =
  'PD-1 NO LONGER ESCAPES — this RED is the arm doing its job, not a regression. ' +
  `PD-1 in ${REGISTER_REL} (row "PD-1 (F3) — revocation does not bind a Member that owns no shell yet") ` +
  'is now FIXED in the code: a Member that owned no live domain at revoke time is refused when it ' +
  'acquires afterwards. The register needs updating (re-classify or remove the governance-hole row, ' +
  'retire or invert this KNOWN-DEFECT pin, and keep the WITH-domain contrast case green).'

/** Cache the product module per process; the loader hook must be installed first. */
let productModule
async function loadProduct() {
  if (productModule !== undefined) return productModule
  register(pathToFileURL(join(REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)
  productModule = await import(pathToFileURL(join(REPO_ROOT, PRODUCT_ENTRY_REL)).href)
  return productModule
}

let tokenPrinted = false
function emitOnce(token) {
  if (tokenPrinted) return
  tokenPrinted = true
  process.stdout.write(`${token}\n`)
}

/**
 * One host-free world: the REAL product registry over an injected `PtyHandle`
 * recorder. `allocations` counts `spawn` requests — i.e. how many times a real
 * backend would have had to allocate a PTY.
 */
async function makeWorld() {
  const product = await loadProduct()
  const allocations = []
  const kills = []
  let pid = 4000
  const registry = product.createTerminalDomainRegistry({
    currentRevision: () => 'rev-1',
    now: () => '2026-11-07T00:00:00.000Z',
    isTrustedMember: () => true,
  })

  function acquire(identity, binding = 'binding-shell', policyRevision = 'rev-1') {
    pid += 1
    const label = `${identity.memberInstanceId}/${binding}`
    return registry.acquire({
      owner: { identity, toolBindingIdentity: binding },
      sessionHandle: `session-${binding}`,
      policyRevision,
      backend: 'pty-recorder',
      spawn: async () => {
        allocations.push(label)
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

// ---------------------------------------------------------------------------
// 1. THE DEFECT PIN — the escape itself.
// ---------------------------------------------------------------------------

test('KNOWN-DEFECT PD-1: a member that owns NO live shell at revoke time can acquire one afterwards (the escape)', async () => {
  const world = await makeWorld()

  // The authority withdraws BEFORE the member ever holds a shell.
  const killed = await world.registry.revoke(MEMBER.memberInstanceId, 'member archived')
  assert.deepEqual(killed, [], 'PD-1 fixture: there is no live domain to kill at revoke time')
  assert.equal(world.allocations.length, 0, 'PD-1 fixture: no port allocation happened before the revoke')

  const acquired = await world.acquire(MEMBER, 'binding-late')
  const domainId = acquired.ok ? acquired.value.domainId : undefined
  const gate = acquired.ok ? world.registry.assertCurrent(domainId) : undefined

  if (EXPECT === 'fixed') {
    // NEGATIVE CONTROL / post-fix mode: the mutation (or a real fix) records the
    // revocation unconditionally. The same fixture must now observe a refusal.
    assert.equal(acquired.ok, false, 'PD-1 control: the escape must be impossible under an unconditional revocation record')
    assert.equal(acquired.code, 'DOMAIN_REVOKED', `PD-1 control: expected DOMAIN_REVOKED, got ${JSON.stringify(acquired)}`)
    assert.equal(world.allocations.length, 0, 'PD-1 control: a refused acquire must not reach the port at all')
    assert.equal(world.registry.list().length, 0, 'PD-1 control: no domain may exist after a refused acquire')
    process.stdout.write(`PD1-CONTROL-REFUSAL code=${acquired.code} allocations=${world.allocations.length} domains=${world.registry.list().length}\n`)
    emitOnce(CLOSED_TOKEN)
    return
  }

  // THE PIN. If this assertion ever fails, PD-1 was fixed: the message is the
  // handover contract, not an ordinary assertion failure.
  assert.equal(acquired.ok, true, HANDOVER)
  assert.equal(acquired.value.reused, false, 'the post-revoke acquire is a NEW domain, not a reuse of something older')

  // "Usable" here means exactly two things, and the evidence README says so:
  // (a) the injected port was asked to allocate exactly once (a real backend
  //     would have opened a real shell), and
  // (b) the per-command gate — `assertCurrent`, the product's only
  //     command-admission check for a live domain — ADMITS.
  // It does NOT mean a command ran: `PtyHandle` carries no write/read channel
  // (`terminal.ts:51-57`), so no command can be run by this registry.
  assert.equal(world.allocations.length, 1, 'the revoked member obtained one real port-allocation request')
  assert.equal(world.registry.list().length, 1, 'the acquired domain is live in the registry')
  const domain = world.registry.list()[0]
  assert.equal(domain.status, 'active', 'the acquired domain reports status "active"')
  assert.equal(domain.owner.identity.memberInstanceId, MEMBER.memberInstanceId, 'the live domain belongs to the revoked member')
  assert.equal(gate.ok, true, 'the per-command gate (assertCurrent) admits commands in the acquired domain')
  assert.equal(gate.revision, 'rev-1')

  emitOnce(ESCAPE_TOKEN)
})

// ---------------------------------------------------------------------------
// 2. THE CONTRAST — revocation really does bind a member that owns a live shell.
// ---------------------------------------------------------------------------

test('KNOWN-DEFECT PD-1: the same member WITH a live shell at revoke time IS blocked afterwards (contrast)', async () => {
  const world = await makeWorld()

  const before = await world.acquire(MEMBER, 'binding-live')
  assert.equal(before.ok, true, 'fixture: the member holds a live shell before the revoke')
  const liveDomainId = before.value.domainId

  const killed = await world.registry.revoke(MEMBER.memberInstanceId, 'member archived')
  assert.deepEqual(killed, [liveDomainId], 'revocation kills exactly the visible domain')
  assert.deepEqual(world.kills, [[`${MEMBER.memberInstanceId}/binding-live`, 'SIGKILL']], 'revocation SIGKILLs the live shell')
  assert.equal(world.registry.assertCurrent(liveDomainId).ok, false, 'the killed domain no longer admits commands')

  const after = await world.acquire(MEMBER, 'binding-live')
  assert.equal(after.ok, false, 'a member that owned a live shell at revoke time is REFUSED afterwards')
  assert.equal(after.code, 'DOMAIN_REVOKED')
  assert.equal(world.allocations.length, 1, 'the refused acquire allocated no second shell')
  assert.equal(world.registry.list().length, 0)
})

// ---------------------------------------------------------------------------
// 3. THE REGISTER COUPLING — the pin cannot outlive its own record.
// ---------------------------------------------------------------------------

test('KNOWN-DEFECT PD-1: the register still records PD-1 as a governance hole and names this arm', () => {
  const register = readFileSync(join(REPO_ROOT, REGISTER_REL), 'utf8')
  const relation =
    `PD-1 in ${REGISTER_REL} no longer supports this defect pin. A defect pin that survives the ` +
    'deletion or downgrade of its own record is worse than no pin: restore the PD-1 row classified ' +
    '"governance hole" and its acceptance-criterion pointer to ' +
    `${ARM_REL}, or fix PD-1 and retire this pin and the row together.`

  // (a) the at-a-glance table still classifies PD-1 as a governance hole.
  const tableRow = register
    .split('\n')
    .find((line) => /^\|\s*PD-1 \(F3\)\s*\|/.test(line))
  assert.ok(tableRow !== undefined, `the summary table has no PD-1 (F3) row. ${relation}`)
  const cells = tableRow.split('|').slice(1, -1).map((cell) => cell.trim())
  assert.equal(cells[3], 'governance hole', `the summary table downgraded PD-1 to "${cells[3]}". ${relation}`)

  // (b) the detail block still carries the same classification.
  const head = /^### PD-1 \(F3\) — .+$/m.exec(register)
  assert.ok(head !== null, `the register has no "### PD-1 (F3) — …" detail block. ${relation}`)
  const rest = register.slice(head.index + head[0].length)
  const next = /^### PD-\d+ \(/m.exec(rest)
  const body = next === null ? rest : rest.slice(0, next.index)
  assert.match(body, /^- \*\*security consequence\*\*: \*\*governance hole\*\*/m, `the detail block no longer says "governance hole". ${relation}`)

  // (c) the row points at this arm as its acceptance criterion, and says the
  //     arm is deliberately green while the escape exists.
  assert.ok(body.includes(ARM_REL), `the PD-1 row no longer names this arm as its acceptance criterion. ${relation}`)
  assert.match(body, /deliberately green today/i, `the PD-1 row no longer states that the arm is deliberately green today. ${relation}`)
})
