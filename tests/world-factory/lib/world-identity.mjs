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
 * @module tests/world-factory/lib/world-identity
 */

/** Version tag of the receipt this module mints. */
export const WORLD_IDENTITY_SCHEMA = 'dsh-world-identity/1'

/** The module-private brand. Not exported: a caller cannot re-apply it. */
const BRAND = Symbol('dsh-agent-team/world-identity')

/** Worlds this module minted (object identity; a copy is a different object). */
const MINTED = new WeakSet()

/** world -> its frozen receipt record. */
const RECEIPTS = new WeakMap()

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
