/**
 * effect-oracle.mjs — the WEB family's witnesses and its CLOSED refusal mapping.
 *
 * THE EFFECT IS BOTH HALVES. A web vector's model-facing text alone proves
 * nothing (a fixture provider could print anything), so every record carries
 * the corroborating side effect measured OUTSIDE the tool:
 *
 *   @srv:requests  the fixture server's OWN arrival log, in order (method+path),
 *                  as a count + a digest + a readable sequence;
 *   @srv:bytes     the bytes the fixture actually wrote;
 *   @result        the admitted value's URL/status/kind/truncation (a refusal
 *                  carries no result, which is itself the claim);
 *   facts          one a5sf-guard-consult fact per face call (allow/deny,
 *                  decidedBy, locator, annotations);
 *   net            the outbound-socket witness (`lib/net-witness.mjs`), which
 *                  says whether a real loopback socket was used and that ZERO
 *                  non-loopback connects were attempted.
 *
 * THE REFUSAL MAPPING IS REUSED, NOT FORKED. `REFUSAL_CATEGORIES`,
 * `CATEGORY_IDS` and `RefusalVocabularyError` come from
 * `tests/ute-g1-fs/lib/refusal-categories.mjs` (the owner's closed vocabulary).
 * That module's maps hold the FS surface, so the WEB surface's mapping lives
 * here, with the same two invariants:
 *
 *   TOTAL      — every observed refusal code maps, or `REFUSAL_VOCABULARY_INCOMPLETE`
 *                is raised. There is no default bucket.
 *   `unknown`  — is UNREACHABLE from this map: no entry maps to it, and the
 *                capture refuses a row that would land in it.
 *
 * WHERE THE CODE COMES FROM. Two shapes reach the model:
 *   - a `TeamIoDenial` (the confined face) is rendered with its typed code as
 *     `Error: <CODE>: <detail>`, and the SAME code is on the guard fact
 *     (`decidedBy`);
 *   - a pinned-provider `WebError` is rendered as `Error: <prose>` — its code is
 *     NOT in the text and there is no deny fact (the call was admitted first).
 *     `PINNED_WEB_ERROR_TEXT` therefore names each observed prose pattern and
 *     the code it is: a CLOSED table, not a regex bucket. A prose refusal no
 *     entry names raises `REFUSAL_VOCABULARY_INCOMPLETE` instead of being
 *     guessed at — that refusal to guess is `SD-WEB-3` in
 *     `lib/semantic-differences.mjs`.
 *
 * @module tests/ute-g1-web/lib/effect-oracle
 */
import { createHash } from 'node:crypto'

import {
  CATEGORY_IDS,
  REFUSAL_CATEGORIES,
  RefusalVocabularyError,
} from '../../ute-g1-fs/lib/refusal-categories.mjs'

export { CATEGORY_IDS, REFUSAL_CATEGORIES, RefusalVocabularyError }

/** The residual class name the vocabulary declares but this corpus may never emit. */
export const RESIDUAL_CLASS = 'other'

/** The category a refused call must NOT rest in. */
export const UNKNOWN_CATEGORY = 'unknown'

/** The typed code an unmapped refusal raises. */
export const VOCABULARY_INCOMPLETE = 'REFUSAL_VOCABULARY_INCOMPLETE'

/**
 * The observed pinned-provider prose → typed code. CLOSED: each entry is a
 * literal message prefix (or a whole message) the pin can render, and the code
 * is the one `@deepseek-ai/dsh-web` raised. Adding an entry is a decision.
 */
export const PINNED_WEB_ERROR_TEXT = Object.freeze([
  Object.freeze({ text: 'unsupported content type ', code: 'WEB_UNSUPPORTED_CONTENT_TYPE' }),
  Object.freeze({ text: 'unsupported charset ', code: 'WEB_UNSUPPORTED_CONTENT_TYPE' }),
  Object.freeze({ text: 'response exceeds the maximum of ', code: 'WEB_FETCH_TOO_LARGE' }),
  Object.freeze({ text: 'exceeded the maximum of ', code: 'WEB_REDIRECT_BLOCKED' }),
  Object.freeze({ text: 'cross-origin redirect to ', code: 'WEB_REDIRECT_BLOCKED' }),
  Object.freeze({ text: 'redirect response (HTTP ', code: 'WEB_PROVIDER_ERROR' }),
  Object.freeze({ text: 'web fetch timed out', code: 'WEB_FETCH_TIMEOUT' }),
  Object.freeze({ text: 'web fetch aborted', code: 'WEB_ABORTED' }),
  Object.freeze({ text: 'web fetch failed: ', code: 'WEB_PROVIDER_ERROR' }),
  Object.freeze({ text: 'invalid URL: ', code: 'WEB_INVALID_URL' }),
  Object.freeze({ text: 'URL exceeds the maximum length of ', code: 'WEB_INVALID_URL' }),
  Object.freeze({ text: 'unsupported URL scheme ', code: 'WEB_INVALID_URL' }),
  Object.freeze({ text: 'credentials in URLs are not allowed', code: 'WEB_BLOCKED_URL' }),
])

/**
 * The WEB surface's closed refusal map. Each entry names the CONDITION, never
 * the class it is convenient to land in:
 *
 *   denied-by-lane      the SSRF/destination admission (or the egress witness)
 *                       withheld the effect before any provider entry;
 *   invalid-argument    the URL itself could not be admitted as a request;
 *   unsupported-mode    a deployment BOUND (redirect budget, byte cap, content
 *                       type, transport fault) refused to serve the answer;
 *   route-unresolved    this composition has no search provider at all;
 *   cancelled           the caller's cancellation, or the transport deadline
 *                       that stopped the call before completion (the closed
 *                       vocabulary has no separate `deadline` class; the note
 *                       in `golden/COVERAGE.md` states the extension).
 */
export const WEB_REFUSAL_MAP = Object.freeze([
  Object.freeze({ code: 'WEB_DESTINATION_FORBIDDEN', category: 'denied-by-lane', note: 'PD-30 SSRF destination leg: the declared origin is not one of the composition\'s fixtures' }),
  Object.freeze({ code: 'NETWORK_UNCONFINED_REALM', category: 'denied-by-lane', note: 'the compiled network lane denies and no face-bound enforcement proof exists' }),
  Object.freeze({ code: 'EGRESS_REFUSED', category: 'denied-by-lane', note: 'the outbound-socket witness refused a non-loopback destination (unreachable in a golden run)' }),
  Object.freeze({ code: 'WEB_REQUEST_MALFORMED', category: 'invalid-argument', note: 'the declared URL/query is not an admissible request' }),
  Object.freeze({ code: 'WEB_INVALID_URL', category: 'invalid-argument', note: 'the pinned provider\'s transport policy refused the URL shape' }),
  Object.freeze({ code: 'WEB_UNSUPPORTED_CONTENT_TYPE', category: 'unsupported-mode', note: 'the response body kind is not decodable by this deployment' }),
  Object.freeze({ code: 'WEB_FETCH_TOO_LARGE', category: 'unsupported-mode', note: 'the response exceeds the declared byte bound' }),
  Object.freeze({ code: 'WEB_REDIRECT_BLOCKED', category: 'unsupported-mode', note: 'the redirect budget / same-origin law refused the next hop' }),
  Object.freeze({ code: 'WEB_PROVIDER_ERROR', category: 'unsupported-mode', note: 'the transport failed after admission (no answer to serve)' }),
  Object.freeze({ code: 'WEB_FETCH_TIMEOUT', category: 'cancelled', note: 'the transport deadline stopped the call before completion' }),
  Object.freeze({ code: 'WEB_ABORTED', category: 'cancelled', note: 'the caller\'s signal stopped the call' }),
  Object.freeze({ code: 'cancelled', category: 'cancelled', note: 'the fixture search transport\'s own cancellation code' }),
  Object.freeze({ code: 'WEB_PROVIDER_UNAVAILABLE', category: 'route-unresolved', note: 'no usable search provider on this composition' }),
  Object.freeze({ code: 'WEB_SEARCH_DESTINATION_DENIED', category: 'denied-by-lane', note: 'a provider destination outside the declared origin set (unobserved here)' }),
])

/** Codes deliberately declared UNMAPPED: observing one refuses the capture. */
export const DECLARED_UNMAPPED = Object.freeze([
  Object.freeze({ code: 'WEB_BLOCKED_URL', why: 'one code covers credentials-in-URL (invalid-argument) AND non-public resolution (denied-by-lane); a single category would be a guess' }),
])

/** code → category. */
const CATEGORY_BY_CODE = new Map(WEB_REFUSAL_MAP.map((entry) => [entry.code, entry.category]))

/** The code set the mapping explains. */
export const MAPPED_CODES = Object.freeze([...CATEGORY_BY_CODE.keys()])

/** Refusals whose cause is measured from TEXT because no typed code exists. */
export const TEXTUALLY_CLASSIFIED = Object.freeze(['cancelled'])

/**
 * CLOSED prose → category table for a refusal that carries NO typed code. The
 * registry's own pre-dispatch cancellation is the only such arm in this corpus:
 * it refuses before the face, so there is neither a code nor a guard fact.
 */
export const TEXTUAL_REFUSALS = Object.freeze([
  Object.freeze({ text: 'tool call aborted before dispatch', category: 'cancelled', code: 'cancelled' }),
])

/** The model-facing error prefix the tool registry adds. */
const ERROR_PREFIX = 'Error: '

/**
 * Normalize one model-facing text for the fixture: the live origin becomes
 * `<origin>` so no port, host or absolute path is recorded.
 *
 * @param {string} text - the raw text.
 * @param {string} origin - the live fixture origin.
 * @returns {string}
 */
export function normalizeText(text, origin) {
  return String(text).split(origin).join('<origin>')
}

/** The digest of one text. */
export function textDigest(text) {
  return createHash('sha256').update(String(text), 'utf8').digest('hex')
}

/**
 * The typed code of a `TeamIoDenial`-shaped text (`Error: CODE: detail`).
 * @param {string} text
 * @returns {string|null}
 */
export function typedCodeOf(text) {
  const match = /^Error: ([A-Z][A-Z0-9_]{2,}): /.exec(String(text))
  return match === null ? null : match[1]
}

/**
 * The code of a PINNED-provider prose refusal (closed table).
 * @param {string} text
 * @returns {{code: string, entry: object}|null}
 */
export function pinnedCodeOf(text) {
  const body = String(text).replace(/^Error: /, '')
  for (const entry of PINNED_WEB_ERROR_TEXT) {
    if (body.startsWith(entry.text)) return { code: entry.code, entry }
  }
  return null
}

/**
 * The codes one vector produced: the guard facts' refusals first (a deny fact
 * names the decision), then the text's typed code, then the pinned prose table.
 *
 * @param {{outcome: string, text: string, facts: readonly object[]}} input
 * @returns {string[]}
 */
export function codesOf({ outcome, text, facts }) {
  const codes = []
  for (const fact of Array.isArray(facts) ? facts : []) {
    if (fact?.decision === 'deny' && typeof fact.decidedBy === 'string' && fact.decidedBy !== 'ALLOW') {
      if (!codes.includes(fact.decidedBy)) codes.push(fact.decidedBy)
    }
  }
  const typed = typedCodeOf(text)
  if (typed !== null && !codes.includes(typed)) codes.push(typed)
  if (codes.length === 0 && outcome === 'deny') {
    const pinned = pinnedCodeOf(text)
    if (pinned !== null) codes.push(pinned.code)
    if (codes.length === 0) {
      const body = String(text).replace(/^Error: /, '')
      const textual = TEXTUAL_REFUSALS.find((entry) => body.startsWith(entry.text))
      if (textual !== undefined) codes.push(textual.code)
    }
  }
  return codes
}

/**
 * Map one observed refusal to the closed vocabulary. Throws
 * {@link RefusalVocabularyError} (`REFUSAL_VOCABULARY_INCOMPLETE`) when the
 * evidence does not name a mapped code — never a default bucket.
 *
 * @param {{outcome: string, text: string, facts: readonly object[]}} input
 * @returns {string|null} the category id (or null for an admitted call).
 */
export function classifyWebRefusal({ outcome, text, facts }) {
  if (outcome !== 'deny') return null
  const codes = codesOf({ outcome, text, facts })
  for (const code of codes) {
    if (DECLARED_UNMAPPED.some((entry) => entry.code === code)) {
      throw new RefusalVocabularyError(
        VOCABULARY_INCOMPLETE,
        `refusal code '${code}' is DECLARED UNMAPPED (${DECLARED_UNMAPPED.find((entry) => entry.code === code).why}); it cannot be bucketed without deciding which condition it was`,
      )
    }
    const category = CATEGORY_BY_CODE.get(code)
    if (category !== undefined) {
      if (category === UNKNOWN_CATEGORY) {
        throw new RefusalVocabularyError(VOCABULARY_INCOMPLETE, `'${code}' maps to the residual 'unknown' bucket, which this corpus may not use`)
      }
      return category
    }
  }
  throw new RefusalVocabularyError(
    VOCABULARY_INCOMPLETE,
    `the observed refusal (codes=${codes.join(',') || '-'}, text=${JSON.stringify(String(text).slice(0, 160))}) is not explained by any WEB_REFUSAL_MAP entry`,
  )
}

/**
 * The corpus-level totality guard: every observed code must be mapped (or be
 * the textually-classified arm), `unknown` must be unreachable, and the
 * residual class must be unreachable.
 *
 * @param {readonly string[]} observedCodes
 * @returns {{ok: boolean, problems: string[]}}
 */
export function assertVocabularyTotal(observedCodes) {
  const problems = []
  for (const code of observedCodes) {
    if (DECLARED_UNMAPPED.some((entry) => entry.code === code)) {
      problems.push(`observed code '${code}' is declared unmapped`)
      continue
    }
    if (!CATEGORY_BY_CODE.has(code) && !TEXTUALLY_CLASSIFIED.includes(code)) {
      problems.push(`observed code '${code}' has no WEB_REFUSAL_MAP entry (${VOCABULARY_INCOMPLETE})`)
    }
  }
  for (const entry of WEB_REFUSAL_MAP) {
    if (entry.category === UNKNOWN_CATEGORY || entry.category === RESIDUAL_CLASS) problems.push(`map entry '${entry.code}' lands in '${entry.category}', which must be unreachable`)
    if (!CATEGORY_IDS.includes(entry.category)) problems.push(`map entry '${entry.code}' names '${entry.category}', which is not a closed-vocabulary id`)
  }
  return { ok: problems.length === 0, problems }
}

/**
 * The fixture server's request log as one effect: count, digest and a readable
 * sequence. `sorted` is used ONLY by a vector whose steps are concurrent, where
 * arrival order is not a deterministic fact (declared in the corpus).
 *
 * @param {readonly {method: string, path: string}[]} entries
 * @param {{sorted?: boolean}} [options]
 * @returns {{list: string[], digest: string, count: number, ordered: string}}
 */
export function requestWitness(entries, { sorted = false } = {}) {
  const list = entries.map((entry) => `${entry.method} ${entry.path}`)
  if (sorted) list.sort()
  const digest = createHash('sha256').update(list.map((line) => `${line}\n`).join(''), 'utf8').digest('hex')
  return { list, digest, count: list.length, ordered: sorted ? 'sorted' : 'arrival' }
}

/** The bytes the fixture actually wrote across completed responses. */
export function servedBytes(entries) {
  return entries.reduce((total, entry) => total + (Number.isInteger(entry.bytesWritten) ? entry.bytesWritten : 0), 0)
}

/**
 * Build the record's effect list.
 *
 * @param {object} input
 * @returns {object[]} the effects in a fixed order.
 */
export function buildEffects({ outcome, value, requests, bytes, sorted = false, normalizedText }) {
  const witness = requestWitness(requests, { sorted })
  const effects = [
    {
      path: '@srv:requests',
      exists: true,
      bytes: witness.count,
      sha256: witness.digest,
      mode: `${witness.ordered},list=${witness.list.length === 0 ? '-' : witness.list.join('+')}`,
    },
    {
      path: '@srv:bytes',
      exists: true,
      bytes,
      sha256: null,
      mode: bytes > 0 ? 'written' : 'none',
    },
  ]
  if (outcome === 'allow' && value !== null && typeof value === 'object') {
    const status = Number.isInteger(value.statusCode) ? String(value.statusCode) : 'none'
    const kind = typeof value.body?.kind === 'string' ? value.body.kind : 'none'
    const truncated = value.truncated === true ? 'yes' : 'no'
    const sources = Array.isArray(value.sources) ? `,sources=${String(value.sources.length)}` : ''
    const content = typeof value.content === 'string' ? `,chars=${String(value.content.length)}` : ''
    effects.push({
      path: '@result',
      exists: true,
      bytes: normalizedText.length,
      sha256: textDigest(normalizedText),
      mode: `status=${status},kind=${kind},truncated=${truncated}${sources}${content}`,
    })
  } else {
    effects.push({ path: '@result', exists: false, bytes: null, sha256: null, mode: 'no-result-observation' })
  }
  return effects
}
