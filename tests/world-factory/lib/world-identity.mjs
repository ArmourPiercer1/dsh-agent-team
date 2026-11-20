/**
 * world-identity.mjs — F-09: the World Factory's identity RECEIPT.
 *
 * THE DEFECT THIS CLOSES. `declareObservationContract({ world })` used to check
 * `typeof world === 'object'` plus a non-empty `world.id` / `world.home`. That
 * makes "this World is one the Factory created" UNFALSIFIABLE: a hand-written
 * `{ id: 'x', home: '/anywhere' }` passed, so a contract could claim an identity
 * no factory ever minted — and the contract's `world_home` (the label root used
 * to report evidence paths) came from whatever the caller typed.
 *
 * THE RECEIPT. `TestWorld`'s constructor is the only place a World object comes
 * into existence in this repo; it calls `mintFactoryWorldIdentity(world)` once.
 * The mint does two things, BOTH of which are about the object, not its shape:
 *
 *   1. registers the object in this module's private `WeakSet` (identity, so a
 *      copy is a different object and is not registered), and
 *   2. installs a NON-ENUMERABLE, module-private `Symbol` brand on it.
 *
 * `isFactoryWorld()` answers true only when BOTH hold and the id/home are
 * non-empty strings. Consequences, each with a negative control in
 * `tests/world-factory/tinf-observer-closeout.test.mjs`:
 *
 *   - `{ id, home }` literal                  -> no WeakSet entry, no brand: REFUSED
 *   - `{ ...realWorld }` spread copy          -> different identity, and a spread
 *                                                does not copy a non-enumerable
 *                                                symbol: REFUSED
 *   - `structuredClone(realWorld)`            -> different identity, symbols are
 *                                                not cloned: REFUSED
 *   - `Object.create(realWorld)`              -> brand is inherited through the
 *                                                prototype, so the WeakSet (which
 *                                                is keyed by the object itself)
 *                                                still says no: REFUSED
 *   - a forged receipt-shaped object          -> a receipt is never accepted as
 *     (`{ receipt: { schema, ... } }`)           proof; only the registered world
 *                                                object is: REFUSED
 *   - the World object itself                 -> ACCEPTED
 *
 * TRUST BOUNDARY (stated, not hidden): this is the same in-process boundary the
 * testkit's row/window seals already use. A caller that deliberately imports
 * this module and calls the mint can mint an identity for an object it built
 * itself — it is then, by definition, producing a World-shaped fixture rather
 * than proving one. What the receipt does close is the realistic defect class:
 * a plausible-looking literal, a copy, or a serialized round-trip claiming to be
 * a Factory World. Nothing survives JSON.
 *
 * ── F-10 (2026-11-20): THE CONTRACT'S OWN IDENTITY ─────────────────────────
 *
 * The same reasoning applies one level up. `declareObservationContract` used to
 * carry its World only on a non-enumerable `Symbol` property. A non-enumerable
 * symbol survives `Object.getOwnPropertySymbols()`, so a reflection copy passed;
 * and JavaScript property reads walk the prototype chain, so
 * `Object.create(validContract)` inherited the schema AND the World reference
 * while its own `world_id` could say another world. The contract had no identity
 * of its own. This module now mints a CONTRACT identity alongside the World one:
 *
 *   - `declareContractIdentity(contract, fields)` registers the exact object in a
 *     private `WeakSet` and stores a FROZEN snapshot of the five identity fields
 *     (`world_id`, `world_home`, `agent_id`, `execution_id`, `contract_id`) in a
 *     private `WeakMap`. It is mint-once: a second call for the same object
 *     returns the first snapshot and never re-baselines a mutated object.
 *   - `isDeclaredContract()` / `declaredContractFields()` are the predicates the
 *     contract module consumes. Object identity is the receipt: a spread copy, a
 *     reflection copy, an `Object.create` child, a proxy and a JSON round-trip are
 *     all DIFFERENT objects and are refused with `CONTRACT_IDENTITY_UNPROVEN`.
 *   - The snapshot is compared against the contract's OWN data properties, so a
 *     value that moved after minting (if a future edit drops the freeze) is
 *     `CONTRACT_FIELDS_MISMATCH`, not a silent pass.
 *
 * The freeze is NOT the identity (any caller can freeze a forged literal); it is
 * defence in depth, and the snapshot is what makes field drift observable.
 *
 * TRUST BOUNDARY: unchanged and restated. Code that can import this module and
 * call `declareContractIdentity` can mint a contract identity for an object it
 * built — that is producing a fixture, not proving one. This closes object
 * forgery by callers/serialization/copies, not malicious in-module code.
 *
 * @module tests/world-factory/lib/world-identity
 */

/** Version tag of the receipt this module mints. */
export const WORLD_IDENTITY_SCHEMA = 'dsh-world-identity/1'

/** Version tag of the CONTRACT identity this module mints (F-10). */
export const CONTRACT_IDENTITY_SCHEMA = 'dsh-observation-contract-identity/1'

/** The module-private brand. Not exported: a caller cannot re-apply it. */
const BRAND = Symbol('dsh-agent-team/world-identity')

/** Worlds this module minted (object identity; a copy is a different object). */
const MINTED = new WeakSet()

/** world -> its frozen receipt record. */
const RECEIPTS = new WeakMap()

/** Contracts the DECLARING module minted (object identity; a copy is a different object). */
const DECLARED_CONTRACTS = new WeakSet()

/** contract -> its frozen identity-field snapshot, taken once at mint time. */
const CONTRACT_SNAPSHOTS = new WeakMap()

/** The five fields a contract identity is minted over. Order is part of the doc. */
export const CONTRACT_IDENTITY_FIELDS = Object.freeze(['world_id', 'world_home', 'agent_id', 'execution_id', 'contract_id'])

/**
 * Mint (once) the identity receipt for a World the Factory constructed.
 *
 * Called by `TestWorld`'s constructor, which is the only constructor of a World
 * in this repo. Calling it twice for the same object returns the same receipt
 * rather than minting a second identity.
 *
 * @param {object} world - the World instance being constructed
 * @returns {object} the frozen receipt record
 */
export function mintFactoryWorldIdentity(world) {
  if (typeof world !== 'object' || world === null || Array.isArray(world)) {
    throw new TypeError('mintFactoryWorldIdentity: a World is an object, never a primitive or an array')
  }
  const existing = RECEIPTS.get(world)
  if (existing !== undefined) return existing
  const receipt = Object.freeze({
    schema: WORLD_IDENTITY_SCHEMA,
    world_id: typeof world.id === 'string' ? world.id : String(world.id ?? ''),
    home: typeof world.home === 'string' ? world.home : String(world.home ?? ''),
    minted_at: new Date().toISOString(),
  })
  Object.defineProperty(world, BRAND, {
    value: true,
    enumerable: false,
    writable: false,
    configurable: false,
  })
  MINTED.add(world)
  RECEIPTS.set(world, receipt)
  return receipt
}

/**
 * Whether `value` is a World object THIS factory minted. Never throws: a hostile
 * getter or proxy trap answers `false`.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isFactoryWorld(value) {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
    if (!MINTED.has(value)) return false
    if (value[BRAND] !== true) return false
    if (typeof value.id !== 'string' || value.id.trim() === '') return false
    if (typeof value.home !== 'string' || value.home.trim() === '') return false
    return true
  } catch {
    return false
  }
}

/**
 * The frozen receipt of a minted World, or `null` for anything else. The receipt
 * is what a contract records as its provenance; it is NOT what the predicate
 * accepts (see the module doc: a receipt is not a World).
 *
 * @param {unknown} value
 * @returns {object|null}
 */
export function factoryWorldReceipt(value) {
  if (!isFactoryWorld(value)) return null
  return RECEIPTS.get(value) ?? null
}

/**
 * Mint (once) the identity of a contract the declaring module constructed (F-10).
 *
 * Called by `declareObservationContract`, the only function in this repo that
 * constructs a formal observation contract, IMMEDIATELY before it freezes the
 * object. The snapshot is what makes "these fields have not moved since the
 * declaration path wrote them" falsifiable; the `WeakSet` is what makes "this is
 * that object, not a child of it" falsifiable.
 *
 * Mint-once by design: a second call for the same object returns the FIRST
 * snapshot. Re-minting after a mutation would launder field drift, so it is
 * refused structurally rather than trusted to callers.
 *
 * @param {object} contract - the contract object being declared
 * @param {Record<string, string>} fields - the five identity fields written by the declaring module
 * @returns {object} the frozen snapshot
 */
export function declareContractIdentity(contract, fields = {}) {
  if (typeof contract !== 'object' || contract === null || Array.isArray(contract)) {
    throw new TypeError('declareContractIdentity: a contract is a non-array object')
  }
  const existing = CONTRACT_SNAPSHOTS.get(contract)
  if (existing !== undefined) return existing
  const snapshot = { schema: CONTRACT_IDENTITY_SCHEMA }
  for (const field of CONTRACT_IDENTITY_FIELDS) {
    const value = fields?.[field]
    if (typeof value !== 'string' || value.trim() === '') {
      throw new TypeError(`declareContractIdentity: ${field} must be a non-empty string (got ${JSON.stringify(value)})`)
    }
    snapshot[field] = value
  }
  const frozen = Object.freeze(snapshot)
  DECLARED_CONTRACTS.add(contract)
  CONTRACT_SNAPSHOTS.set(contract, frozen)
  return frozen
}

/**
 * The frozen field snapshot of a contract THIS module minted, or `null` for
 * anything else — a spread copy, a reflection copy (`Object.getOwnPropertySymbols`
 * carries the World symbol but not the WeakSet entry), an `Object.create` child,
 * a proxy, or a JSON round-trip. Never throws.
 *
 * @param {unknown} value
 * @returns {object|null}
 */
export function declaredContractFields(value) {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
    if (!DECLARED_CONTRACTS.has(value)) return null
    return CONTRACT_SNAPSHOTS.get(value) ?? null
  } catch {
    return null
  }
}

/**
 * Whether `value` is a contract object the declaring module minted. Identity,
 * not shape: the snapshot must also be present.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isDeclaredContract(value) {
  return declaredContractFields(value) !== null
}
