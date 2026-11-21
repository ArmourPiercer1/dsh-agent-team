/**
 * bind-path.mjs — the bind path, and the ONE rule about what it may bridge.
 *
 * It lives in its own module because three places need the rule and two of them must not drag in the
 * others' dependency graphs: the realm row (which owns the T1 paths), the template locator (where the
 * hint may substitute for a durable row) and the glue. A hint is adjacent to authorization, so it
 * exists once.
 *
 * @module packages/runtime/src/plugin/vnext/bind-path
 */

/**
 * The fresh-create window hint. A member setup legitimately sees NO durable roster row for the very
 * instance it is composing (the row commits AFTER the setup runs), so the child factory carries the
 * two values the flow commits moments later (`instanceId`, `templateId`) and names the call path.
 *
 * The hint may bridge ONLY `fresh-member`: a cold resume, a request boundary or any other path reads
 * the row it resumed and fails closed when it is absent (P0-1 §3.4 — a hint is never an authorization
 * fallback).
 *
 * @param {string} [bindPath] - the T1 bind path (fresh-member / cold-member / fresh-root / cold-root).
 * @returns {boolean} true only for the fresh member creation window.
 */
export function freshCreateHintAdmits (bindPath) {
  return bindPath === 'fresh-member'
}
