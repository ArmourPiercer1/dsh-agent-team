/**
 * f10-contract-identity.test.mjs — F-10 (2026-11-20): a formal observation
 * contract has an IDENTITY OF ITS OWN, and the trace's actor is bound.
 *
 * THE DEFECT THIS CLOSES. `declareObservationContract` checked the caller's
 * `world`, minted a contract and hung the World on a non-enumerable symbol. But
 * `contractWorldIdentity()` then read that symbol off the object it was handed,
 * and JavaScript property reads walk the prototype chain. So this passed:
 *
 *     const derived = Object.create(validContract)
 *     Object.defineProperty(derived, 'world_id', { value: 'another-world' })
 *     contractWorldIdentity(derived)   // ok:true, world:validContract's world
 *
 * The contract had no identity of its own: a child inherited the schema AND the
 * World reference while its own `world_id` named another World. The same hole
 * had a second door — `Object.getOwnPropertySymbols()` DOES enumerate the
 * deliberately non-enumerable World symbol, so a `Reflect.ownKeys` reflection
 * copy carried the World too. And `checkWindowBinding()` matched the durable
 * trace on `execution_id` alone, so two sessions sharing a call id could swap
 * evidence (`actor_id` was never compared to the contract's `agent_id`).
 *
 * THE FIX (F-10). The module that DECLARES the contract now mints a contract
 * identity: a module-private `WeakSet` (object identity — a copy/child/proxy is
 * a different object) plus a frozen snapshot of the five identity fields. The
 * contract is frozen (it already was at the previous head; the census below
 * found no legitimate mutation, so no exception is recorded). `checkWindowBinding`
 * additionally requires every trace event carrying the graded `execution_id` to
 * have `actor_id === contract.agent_id`.
 *
 * EACH CONTROL MUST BE RED WITHOUT THE FIX, GREEN WITH IT (measured by
 * reverting `lib/m7b1-observation-contract.mjs` + `lib/world-identity.mjs` to
 * `ef7e3af00` and re-running this file; transcripts live in
 * dev/agent-workflow/evidence/f10-contract-identity-20261120/):
 *
 *   (a) Object.create(validContract) + overridden world_id
 *         pre-fix: accepted (inherits the World symbol) -> post-fix: CONTRACT_IDENTITY_UNPROVEN
 *   (b) Object.create(validContract) with NO override
 *         pre-fix: accepted -> post-fix: CONTRACT_IDENTITY_UNPROVEN
 *         DECISION: refused, not "clearly attributed". A child that happens to
 *         agree with its prototype today is one `defineProperty` away from the
 *         (a) forgery, and the only thing separating them is which fields a later
 *         caller chooses to read. Object identity is the receipt; a derived object
 *         is not the declared contract even when every inherited field matches.
 *   (c) Reflect.ownKeys / getOwnPropertySymbols reflection copy
 *         pre-fix: accepted (the symbol is copyable) -> post-fix: CONTRACT_IDENTITY_UNPROVEN
 *   (d) a MINTED contract whose world_id is mutated after minting
 *         post-fix: CONTRACT_FIELDS_MISMATCH (own data property differs from the
 *         frozen mint-time snapshot). The real contract is frozen, so the literal
 *         vector is a TypeError; the snapshot is what makes the rule hold even if
 *         a future edit drops the freeze, and a mutable minted object is used here
 *         to exercise it. A minted object whose field became an ACCESSOR is
 *         refused by the same name (own DATA property required).
 *   (e) two different Worlds' contracts cross-wired
 *         pre-fix: the derived object answers with World A while its fields say B
 *         -> post-fix: CONTRACT_IDENTITY_UNPROVEN. A MINTED cross-wire is refused
 *         as CONTRACT_FIELDS_MISMATCH by the Factory-receipt cross-check.
 *   (f) execution_id matches, actor_id belongs to another agent
 *         pre-fix: checkWindowBinding returns null (a pass) -> post-fix: ACTOR_ID_MISMATCH
 *
 * A POSITIVE control is in every block: the REAL declared contract is accepted
 * (else the refusals above could be vacuous "always refuse" code).
 *
 * HOST-FREE BY CONSTRUCTION: the only filesystem is a scratch directory under
 * `.artifacts/tmp/`, no Host is booted and the pinned runtime tree is not
 * required. This is why it can ride the census job's next-host lane without
 * provisioning anything new.
 *
 * Run:  node --test --test-reporter=spec tests/world-factory/f10-contract-identity.test.mjs
 * CI:   .github/workflows/census-runtime.yml (next host lane argv) and the
 *       mirrored check[] in dev/ci/eb3-ci-manifest.json.
 */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { TestWorld, TestWorldFactory } from './lib/world-factory.mjs'
import {
  REFUSAL_CODES,
  ObservationContractRefusal,
  checkWindowBinding,
  contractWorldIdentity,
  declareObservationContract,
} from './lib/m7b1-observation-contract.mjs'
// Namespace import on purpose: this file must be able to run (and go RED by
// assertion, not by a module-load SyntaxError) against the PRE-FIX module, where
// `declareContractIdentity` does not exist.
import * as worldIdentity from './lib/world-identity.mjs'

const HERE = new URL('.', import.meta.url).pathname
const REPO_ROOT = resolve(HERE, '..', '..')
const TMP_ROOT = join(REPO_ROOT, '.artifacts', 'tmp', 'f10-contract-identity')

function scratch(name) {
  mkdirSync(TMP_ROOT, { recursive: true })
  return mkdtempSync(join(TMP_ROOT, `${name}-`))
}

const FACTORY = new TestWorldFactory({
  repoRoot: REPO_ROOT,
  evidenceRoot: join(TMP_ROOT, 'evidence'),
  hostTree: join(TMP_ROOT, 'no-host-is-needed-here'),
})

/** A REAL World object minted by the Factory's own class (never booted). */
function probeWorld(home, id) {
  return new TestWorld(FACTORY, { id, name: id, home, workspaceDir: join(home, 'workspace'), visible: false })
}

/** The F-10 attack primitive: copy EVERY own key, enumerable or not, symbol included. */
function reflectionCopy(source) {
  const copy = {}
  for (const key of Reflect.ownKeys(source)) {
    Object.defineProperty(copy, key, Object.getOwnPropertyDescriptor(source, key))
  }
  return copy
}

/**
 * The same reflection copy, but the visible fields are writable so a post-mint
 * mutation can be attempted. (The real contract is frozen; this models the code
 * path the snapshot must keep safe if the freeze is ever removed.)
 */
function mutableContractCopy(source) {
  const copy = {}
  for (const symbol of Object.getOwnPropertySymbols(source)) {
    Object.defineProperty(copy, symbol, Object.getOwnPropertyDescriptor(source, symbol))
  }
  for (const key of Object.keys(source)) {
    Object.defineProperty(copy, key, { value: source[key], writable: true, enumerable: true, configurable: true })
  }
  return copy
}

/** The five fields a contract identity is minted over, read off a real contract. */
function identityFieldsOf(contract) {
  return {
    world_id: contract.world_id,
    world_home: contract.world_home,
    agent_id: contract.agent_id,
    execution_id: contract.execution_id,
    contract_id: contract.contract_id,
  }
}

/** A caller-owned window record shaped like the sealed one (checkWindowBinding is pure). */
function windowFor(contract) {
  return {
    window_id: 'f10-window',
    world_id: contract.world_id,
    agent_id: contract.agent_id,
    execution_id: contract.execution_id,
    phase: 'post',
    closedAt: '2026-11-20T00:00:00.000Z',
    armedAt: '2026-11-20T00:00:00.000Z',
    watchedPaths: [...contract.scope],
    producedBy: '@dsh-agent-team/testkit/effect-witness@1',
  }
}

/** One execution's call+result pair as the durable trace carries it. */
function callAndResult(contract, actorId) {
  return [
    { schema: 'agent-execution-event/1', event_seq: 1, event_type: 'tool/call', actor_id: actorId, execution_id: contract.execution_id, outcome: 'DISPATCHED' },
    { schema: 'agent-execution-event/1', event_seq: 2, event_type: 'tool/result', actor_id: actorId, execution_id: contract.execution_id, outcome: 'COMPLETED' },
  ]
}

test('F-10 a formal contract has its own identity, and the trace actor is bound', async (t) => {
  const root = scratch('contract-identity')
  t.after(() => rmSync(root, { recursive: true, force: true }))

  const homeA = join(root, 'home-a')
  const watchedA = join(homeA, 'watched')
  const homeB = join(root, 'home-b')
  const watchedB = join(homeB, 'watched')
  mkdirSync(watchedA, { recursive: true })
  mkdirSync(watchedB, { recursive: true })

  const worldA = probeWorld(homeA, 'f10-world-a')
  const worldB = probeWorld(homeB, 'f10-world-b')
  // A REAL declared contract, the object every control below tries to imitate.
  const contract = declareObservationContract({
    world: worldA,
    agentId: 'agent-owner',
    executionId: 'exec-shared',
    scope: [watchedA],
  })
  const otherContract = declareObservationContract({
    world: worldB,
    agentId: 'agent-b',
    executionId: 'exec-b',
    scope: [watchedB],
  })

  await t.test('POSITIVE: the real declared contract is accepted, and its actor-bound trace is gradable', () => {
    const bound = contractWorldIdentity(contract)
    assert.equal(bound.ok, true, 'a contract returned by declareObservationContract is accepted')
    assert.equal(bound.world, worldA, 'and it carries the very World object the Factory minted')
    const verdict = checkWindowBinding({ contract, window: windowFor(contract), events: callAndResult(contract, 'agent-owner') })
    assert.equal(verdict, null, 'a closed window + the graded execution carried by the contract agent IS gradeable')
    t.diagnostic(`F10-POSITIVE ok=true contract=${contract.contract_id} world=${contract.world_id}`)
  })

  await t.test('(a) Object.create(validContract) + overridden world_id is not a declared contract', () => {
    const derived = Object.create(contract)
    Object.defineProperty(derived, 'world_id', { value: 'another-world', enumerable: true, configurable: true })
    assert.equal(derived.schema, contract.schema, 'the child inherits the schema (this is why a field check alone cannot catch it)')
    const refused = contractWorldIdentity(derived)
    assert.equal(refused.ok, false, 'a prototype-inheriting child must never answer for a field it overrides')
    assert.equal(refused.reason, 'CONTRACT_IDENTITY_UNPROVEN')
    assert.match(refused.detail, /not the object declareObservationContract minted/u)
    t.diagnostic(`F10-A-DERIVED-OVERRIDE ok=false reason=${refused.reason}`)
  })

  await t.test('(b) Object.create(validContract) with NO override is refused too (identity is the receipt)', () => {
    const child = Object.create(contract)
    for (const field of ['world_id', 'world_home', 'agent_id', 'execution_id', 'contract_id', 'claim']) {
      assert.equal(child[field], contract[field], `every visible field (${field}) of the child agrees with its prototype`)
    }
    const refused = contractWorldIdentity(child)
    assert.equal(refused.ok, false, 'an Object.create child is not the object the declaring function minted')
    assert.equal(refused.reason, 'CONTRACT_IDENTITY_UNPROVEN')
    const verdict = checkWindowBinding({ contract: child, window: windowFor(contract), events: callAndResult(contract, 'agent-owner') })
    assert.equal(verdict?.reason, 'CONTRACT_IDENTITY_UNPROVEN', 'and a window cannot make it gradeable')
    t.diagnostic(`F10-B-DERIVED-UNCHANGED ok=false reason=${refused.reason}`)
  })

  await t.test('(c) a Reflect.ownKeys / getOwnPropertySymbols reflection copy keeps the World symbol but not the identity', () => {
    const copy = reflectionCopy(contract)
    assert.ok(Object.getOwnPropertySymbols(copy).length > 0, 'the reflection copy really did carry the non-enumerable World symbol')
    const refused = contractWorldIdentity(copy)
    assert.equal(refused.ok, false, 'a symbol survives reflection; object identity does not')
    assert.equal(refused.reason, 'CONTRACT_IDENTITY_UNPROVEN')
    t.diagnostic(`F10-C-SYMBOL-REFLECTION ok=false reason=${refused.reason} symbols=${Object.getOwnPropertySymbols(copy).length}`)
  })

  await t.test('(d) a minted contract whose world_id moves after minting is CONTRACT_FIELDS_MISMATCH', () => {
    const mint = worldIdentity.declareContractIdentity
    assert.equal(typeof mint, 'function', 'the declaring module exposes the mint (F-10 is installed)')
    assert.ok(REFUSAL_CODES.includes('CONTRACT_FIELDS_MISMATCH'))

    // The real contract is immutable already; the snapshot proves the FIELD rule
    // independently of that freeze (a future edit cannot silently drop it).
    assert.ok(Object.isFrozen(contract), 'the declared contract is frozen')
    assert.throws(() => {
      'use strict'
      contract.world_id = 'another-world'
    }, TypeError, 'assigning to the minted contract throws in strict mode')
    assert.throws(() => Object.defineProperty(contract, 'world_id', { value: 'another-world' }), TypeError)
    assert.equal(contract.world_id, worldA.id, 'and the field still names the World it was declared for')

    // A minted-but-mutable object: the snapshot, not the freeze, must refuse it.
    const mutable = mutableContractCopy(contract)
    mint(mutable, identityFieldsOf(contract))
    assert.equal(contractWorldIdentity(mutable).ok, true, 'POSITIVE: a minted contract with unchanged fields is accepted')
    mutable.world_id = 'another-world'
    const refused = contractWorldIdentity(mutable)
    assert.equal(refused.ok, false)
    assert.equal(refused.reason, 'CONTRACT_FIELDS_MISMATCH', `a post-mint mutation is refused (got ${String(refused.reason)})`)
    assert.match(refused.detail, /world_id/u, 'the refusal names the field that moved')
    t.diagnostic(`F10-D-MUTATED-AFTER-MINT ok=false reason=${refused.reason}`)

    // An ACCESSOR is not the own DATA field the declaration path wrote.
    const accessor = mutableContractCopy(contract)
    mint(accessor, identityFieldsOf(contract))
    Object.defineProperty(accessor, 'world_id', { get: () => contract.world_id, enumerable: true, configurable: true })
    const shadowed = contractWorldIdentity(accessor)
    assert.equal(shadowed.ok, false, 'an accessor that happens to return the right value is not the stored field')
    assert.equal(shadowed.reason, 'CONTRACT_FIELDS_MISMATCH')
    assert.match(shadowed.detail, /own data property/u)
    t.diagnostic(`F10-D-ACCESSOR-SHADOW ok=false reason=${shadowed.reason}`)
  })

  await t.test('(e) two Worlds\' contracts cross-wired are refused (and a MINTED cross-wire fails the receipt check)', () => {
    // Derived from A (inherits A's World symbol) but every visible field says B.
    const crossWired = Object.create(contract)
    Object.defineProperty(crossWired, 'world_id', { value: otherContract.world_id, enumerable: true, configurable: true })
    Object.defineProperty(crossWired, 'world_home', { value: otherContract.world_home, enumerable: true, configurable: true })
    Object.defineProperty(crossWired, 'agent_id', { value: otherContract.agent_id, enumerable: true, configurable: true })
    Object.defineProperty(crossWired, 'execution_id', { value: otherContract.execution_id, enumerable: true, configurable: true })
    Object.defineProperty(crossWired, 'contract_id', { value: otherContract.contract_id, enumerable: true, configurable: true })
    Object.defineProperty(crossWired, 'world_identity', { value: otherContract.world_identity, enumerable: true, configurable: true })
    const refused = contractWorldIdentity(crossWired)
    assert.equal(refused.ok, false, 'a contract whose fields name one World while it carries another is never accepted')
    assert.equal(refused.reason, 'CONTRACT_IDENTITY_UNPROVEN')
    t.diagnostic(`F10-E-CROSS-WIRED-DERIVED ok=false reason=${refused.reason}`)

    // Even if such an object is minted (the in-process trust boundary), the
    // Factory-receipt cross-check must catch the two-World disagreement.
    const mint = worldIdentity.declareContractIdentity
    const mintedCrossWire = mutableContractCopy(contract)
    for (const [field, value] of Object.entries(identityFieldsOf(otherContract))) {
      Object.defineProperty(mintedCrossWire, field, { value, writable: true, enumerable: true, configurable: true })
    }
    mint(mintedCrossWire, identityFieldsOf(otherContract))
    const mintedRefusal = contractWorldIdentity(mintedCrossWire)
    assert.equal(mintedRefusal.ok, false)
    assert.equal(mintedRefusal.reason, 'CONTRACT_FIELDS_MISMATCH', `receipt cross-check refuses a minted cross-wire (got ${String(mintedRefusal.reason)})`)
    assert.match(mintedRefusal.detail, /cross-wired/u)
    t.diagnostic(`F10-E-CROSS-WIRED-MINTED ok=false reason=${mintedRefusal.reason}`)
  })

  await t.test('(f) execution_id matches but actor_id belongs to another agent -> ACTOR_ID_MISMATCH', () => {
    const window = windowFor(contract)
    const foreign = callAndResult(contract, 'agent-that-did-not-make-this-call')
    const verdict = checkWindowBinding({ contract, window, events: foreign })
    assert.notEqual(verdict, null, 'a shared execution_id must not let another agent answer for this contract')
    assert.equal(verdict.reason, 'ACTOR_ID_MISMATCH')
    assert.match(verdict.detail, /agent-that-did-not-make-this-call/u, 'the refusal names the actor the trace carried')
    assert.match(verdict.detail, /agent-owner/u, 'and the agent the contract declares')
    t.diagnostic(`F10-F-ACTOR-MISMATCH reason=${verdict.reason}`)

    // An event with NO actor cannot prove the binding either (equality required).
    const anonymous = callAndResult(contract).map((event) => {
      const copy = { ...event }
      delete copy.actor_id
      return copy
    })
    const missing = checkWindowBinding({ contract, window, events: anonymous })
    assert.equal(missing?.reason, 'ACTOR_ID_MISMATCH', 'a missing actor_id is refused by the same name')
    assert.match(missing.detail, /<missing>/u)
    t.diagnostic(`F10-F-ACTOR-MISSING reason=${missing.reason}`)
  })

  await t.test('the refusal vocabulary stays a closed set and names the F-10 codes', () => {
    for (const code of ['CONTRACT_IDENTITY_UNPROVEN', 'CONTRACT_FIELDS_MISMATCH', 'ACTOR_ID_MISMATCH']) {
      assert.ok(REFUSAL_CODES.includes(code), `${code} is in REFUSAL_CODES`)
    }
    assert.equal(new Set(REFUSAL_CODES).size, REFUSAL_CODES.length, 'no duplicate refusal codes')
    assert.equal(typeof ObservationContractRefusal, 'function')
  })
})
