#!/usr/bin/env node
/**
 * Field-aware live-token redaction for the team-view-sync browser smoke.
 *
 * WHY THIS EXISTS. The v6 `team.getReadState` response for a team relation
 * carries the team's LIVE TOKEN as a plain JSON field — `data.liveToken` is
 * produced by the production read-state handler (packages/runtime/src/plugin/
 * s6-remote.ts, the liveToken cell of a team relation: "a team relation's
 * read-state must always carry its liveToken cell"). The smoke asserts on that
 * response, so a naive `JSON.stringify` of it into evidence, or into a console
 * line, persists a working credential. The kit's pre-existing `scrub()` only
 * rewrites `?token=<value>` URL query parameters — it cannot see a JSON field,
 * which is exactly the gap external review flagged.
 *
 * THE RULE THIS IMPLEMENTS (and nothing else):
 *   - the ORIGINAL response object stays untouched in memory and is what the
 *     readiness assertions run against — redaction happens on the way OUT;
 *   - persisted copies (evidence JSON) and logged strings get `liveToken`
 *     field values and any `lt-v1-…` shaped value replaced by `lt-v1-REDACTED`;
 *   - criteria-bearing fields (relation / teamSessionId / memberInstanceId /
 *     disposed / durableGeneration) pass through byte-identical, so a redacted
 *     record is still a legible record;
 *   - nothing here touches the wire, the host, or UI authentication.
 *
 * The launch URL is NOT this module's business: it is handled by the kit, which
 * keeps it in a private access record inside the testhome and logs only the
 * scrubbed form.
 */

export const LIVE_TOKEN_FIELD = 'liveToken'
export const LIVE_TOKEN_MASK = 'lt-v1-REDACTED'

/** A liveToken value as the harness formats it: `lt-v1-<opaque>`. Bounded so a
 *  long run of ordinary text that merely mentions the prefix cannot swallow the
 *  rest of the string. */
const LIVE_TOKEN_VALUE = /\blt-v1-[0-9A-Za-z_-]{4,128}\b/g

/** Mask the credential-shaped substrings inside a single string. */
export function redactLiveTokenText(text) {
  return String(text).replace(LIVE_TOKEN_VALUE, LIVE_TOKEN_MASK)
}

/**
 * Deep copy of `value` with live-token material masked, for PERSISTED copies.
 *  - any object key named `liveToken` has its value replaced by the mask (for
 *    any value shape, including null/undefined — the field's presence is the
 *    signal, not its content);
 *  - string values are additionally scanned for `lt-v1-…` inside longer text
 *    (an error message that quotes a token is still a leak);
 *  - keys, order, types and every other value are preserved.
 * The input is never mutated — assertions keep running on the real object.
 */
export function redactLiveTokenFields(value) {
  if (Array.isArray(value)) return value.map((item) => redactLiveTokenFields(item))
  if (value === null || typeof value !== 'object') {
    return typeof value === 'string' ? redactLiveTokenText(value) : value
  }
  const out = {}
  for (const [key, item] of Object.entries(value)) {
    if (key === LIVE_TOKEN_FIELD) {
      out[key] = item === undefined || item === null ? item : LIVE_TOKEN_MASK
      continue
    }
    out[key] = redactLiveTokenFields(item)
  }
  return out
}
