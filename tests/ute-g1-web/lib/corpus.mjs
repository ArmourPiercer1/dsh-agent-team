/**
 * corpus.mjs — the WEB family's declared (request → effect) vectors.
 *
 * Each vector is a DESIGN CLAIM, not a recording: `expect` states the outcome,
 * the refusal category, the exact server-side request sequence and (for an
 * admitted call) the status/kind/truncation the effect must carry. A capture
 * that contradicts a claim is RED (`OLD-PATH-CLAIM-MISMATCH`), never green.
 *
 * THE LIMITS ARE PER VECTOR ON PURPOSE. `maxResponseBytes`, `maxBodyChars`,
 * `timeoutMs` and `maxRedirects` are the composition's declared transport
 * bounds; a cap vector has to DECLARE the bound it measures, otherwise the
 * fixture would be testing whatever default happened to be in force.
 *
 * URLS CARRY `<origin>` INSTEAD OF A PORT so the fixture is transport-stable:
 * the capture substitutes the live loopback origin and the record normalizes it
 * back to `<origin>` before it is written.
 *
 * @module tests/ute-g1-web/lib/corpus
 */

/** The transport bounds a vector runs under (the pinned provider's limit shape). */
const LIMITS = Object.freeze({
  wide: Object.freeze({ maxResponseBytes: 8192, maxBodyChars: 4096, timeoutMs: 30_000, maxRedirects: 2, userAgent: 'ute-g1-web-b1-fixture' }),
  narrowChars: Object.freeze({ maxResponseBytes: 8192, maxBodyChars: 120, timeoutMs: 30_000, maxRedirects: 2, userAgent: 'ute-g1-web-b1-fixture' }),
  narrowBytes: Object.freeze({ maxResponseBytes: 2048, maxBodyChars: 4096, timeoutMs: 30_000, maxRedirects: 2, userAgent: 'ute-g1-web-b1-fixture' }),
  shortDeadline: Object.freeze({ maxResponseBytes: 8192, maxBodyChars: 4096, timeoutMs: 250, maxRedirects: 2, userAgent: 'ute-g1-web-b1-fixture' }),
})

/**
 * The corpus. Order is the fixture order.
 * @type {readonly object[]}
 */
export const CORPUS = Object.freeze([
  Object.freeze({
    id: 'WB-F1-inline-text',
    entry: 'web_fetch',
    network: 'allow',
    limits: LIMITS.wide,
    steps: Object.freeze([Object.freeze({ tool: 'web_fetch', args: Object.freeze({ url: '<origin>/text' }) })]),
    expect: Object.freeze({
      outcome: 'allow',
      refusal: null,
      status: 200,
      bodyKind: 'text',
      truncated: false,
      requests: Object.freeze(['GET /text']),
      providerFetches: 1,
      includes: Object.freeze(['(HTTP 200)', 'UTE-WEB-B1 deterministic text body.']),
    }),
  }),
  Object.freeze({
    id: 'WB-F2-inline-html',
    entry: 'web_fetch',
    network: 'allow',
    limits: LIMITS.wide,
    steps: Object.freeze([Object.freeze({ tool: 'web_fetch', args: Object.freeze({ url: '<origin>/html' }) })]),
    expect: Object.freeze({
      outcome: 'allow',
      refusal: null,
      status: 200,
      bodyKind: 'html',
      truncated: false,
      requests: Object.freeze(['GET /html']),
      providerFetches: 1,
      // The pinned turndown conversion: a heading, a strong run and a GFM row.
      includes: Object.freeze(['# UTE Web B1', 'Fixture **paragraph**.', '| Left | Right |', '| alpha | beta |']),
    }),
  }),
  Object.freeze({
    id: 'WB-F3-redirect-chain',
    entry: 'web_fetch',
    network: 'allow',
    limits: LIMITS.wide,
    steps: Object.freeze([Object.freeze({ tool: 'web_fetch', args: Object.freeze({ url: '<origin>/r1' }) })]),
    expect: Object.freeze({
      outcome: 'allow',
      refusal: null,
      status: 200,
      bodyKind: 'text',
      truncated: false,
      // Two same-origin hops, each served by the fixture, then the target.
      requests: Object.freeze(['GET /r1', 'GET /r2', 'GET /final']),
      providerFetches: 1,
      finalUrl: '<origin>/final',
      includes: Object.freeze(['Fetched <origin>/final (HTTP 200)', 'UTE-WEB-B1 redirect target.']),
    }),
  }),
  Object.freeze({
    id: 'WB-F4-redirect-cap',
    entry: 'web_fetch',
    network: 'allow',
    limits: LIMITS.wide,
    steps: Object.freeze([Object.freeze({ tool: 'web_fetch', args: Object.freeze({ url: '<origin>/loop' }) })]),
    expect: Object.freeze({
      outcome: 'deny',
      refusal: 'unsupported-mode',
      code: 'WEB_REDIRECT_BLOCKED',
      // maxRedirects=2: the initial request plus the two hops it may follow.
      requests: Object.freeze(['GET /loop', 'GET /loop', 'GET /loop']),
      providerFetches: 1,
      includes: Object.freeze(['exceeded the maximum of 2 redirects']),
    }),
  }),
  Object.freeze({
    id: 'WB-F5-status-404',
    entry: 'web_fetch',
    network: 'allow',
    limits: LIMITS.wide,
    steps: Object.freeze([Object.freeze({ tool: 'web_fetch', args: Object.freeze({ url: '<origin>/missing' }) })]),
    expect: Object.freeze({
      outcome: 'allow',
      refusal: null,
      // An HTTP error status is DATA to web_fetch, not a refusal: the body and
      // the status both reach the model.
      status: 404,
      bodyKind: 'text',
      truncated: false,
      requests: Object.freeze(['GET /missing']),
      providerFetches: 1,
      includes: Object.freeze(['(HTTP 404)', 'the fixture has no such page.']),
    }),
  }),
  Object.freeze({
    id: 'WB-F6-content-type-refused',
    entry: 'web_fetch',
    network: 'allow',
    limits: LIMITS.wide,
    steps: Object.freeze([Object.freeze({ tool: 'web_fetch', args: Object.freeze({ url: '<origin>/binary' }) })]),
    expect: Object.freeze({
      outcome: 'deny',
      refusal: 'unsupported-mode',
      code: 'WEB_UNSUPPORTED_CONTENT_TYPE',
      requests: Object.freeze(['GET /binary']),
      providerFetches: 1,
      includes: Object.freeze(['unsupported content type "application/octet-stream"']),
    }),
  }),
  Object.freeze({
    id: 'WB-F7-body-byte-cap',
    entry: 'web_fetch',
    network: 'allow',
    limits: LIMITS.narrowBytes,
    steps: Object.freeze([Object.freeze({ tool: 'web_fetch', args: Object.freeze({ url: '<origin>/big' }) })]),
    expect: Object.freeze({
      outcome: 'deny',
      refusal: 'unsupported-mode',
      code: 'WEB_FETCH_TOO_LARGE',
      requests: Object.freeze(['GET /big']),
      providerFetches: 1,
      includes: Object.freeze(['response exceeds the maximum of 2048 bytes']),
    }),
  }),
  Object.freeze({
    id: 'WB-F8-body-char-cap',
    entry: 'web_fetch',
    network: 'allow',
    limits: LIMITS.narrowChars,
    steps: Object.freeze([Object.freeze({ tool: 'web_fetch', args: Object.freeze({ url: '<origin>/truncate' }) })]),
    expect: Object.freeze({
      outcome: 'allow',
      refusal: null,
      status: 200,
      bodyKind: 'text',
      truncated: true,
      requests: Object.freeze(['GET /truncate']),
      providerFetches: 1,
      includes: Object.freeze(['(Content truncated.']),
    }),
  }),
  Object.freeze({
    id: 'WB-F9-timeout',
    entry: 'web_fetch',
    network: 'allow',
    limits: LIMITS.shortDeadline,
    fixtureDelayMs: 1500,
    steps: Object.freeze([Object.freeze({ tool: 'web_fetch', args: Object.freeze({ url: '<origin>/slow' }) })]),
    expect: Object.freeze({
      outcome: 'deny',
      refusal: 'cancelled',
      code: 'WEB_FETCH_TIMEOUT',
      // The request REACHED the fixture (one arrival), and nothing was delivered.
      requests: Object.freeze(['GET /slow']),
      providerFetches: 1,
      includes: Object.freeze(['web fetch timed out']),
    }),
  }),
  Object.freeze({
    id: 'WB-F10-abort-before-dispatch',
    entry: 'web_fetch',
    network: 'allow',
    limits: LIMITS.wide,
    steps: Object.freeze([Object.freeze({ tool: 'web_fetch', args: Object.freeze({ url: '<origin>/text' }), abort: true })]),
    expect: Object.freeze({
      outcome: 'deny',
      refusal: 'cancelled',
      // Cancelled by the caller's own already-aborted signal, before the face:
      // no request, no provider entry, no guard fact.
      code: 'cancelled',
      textualCode: true,
      requests: Object.freeze([]),
      providerFetches: 0,
      includes: Object.freeze(['aborted before dispatch']),
    }),
  }),
  Object.freeze({
    id: 'WB-F11-destination-forbidden',
    entry: 'web_fetch',
    network: 'allow',
    limits: LIMITS.wide,
    steps: Object.freeze([Object.freeze({ tool: 'web_fetch', args: Object.freeze({ url: 'http://localhost:3182/text' }) })]),
    expect: Object.freeze({
      outcome: 'deny',
      refusal: 'denied-by-lane',
      code: 'WEB_DESTINATION_FORBIDDEN',
      // An out-of-lane destination that is NOT the declared fixture origin: the
      // SSRF leg refuses the local name before the provider, so nothing is served.
      requests: Object.freeze([]),
      providerFetches: 0,
      includes: Object.freeze(['WEB_DESTINATION_FORBIDDEN']),
    }),
  }),
  Object.freeze({
    id: 'WB-F12-url-malformed',
    entry: 'web_fetch',
    network: 'allow',
    limits: LIMITS.wide,
    steps: Object.freeze([Object.freeze({ tool: 'web_fetch', args: Object.freeze({ url: 'ftp://fixture.test/page' }) })]),
    expect: Object.freeze({
      outcome: 'deny',
      refusal: 'invalid-argument',
      code: 'WEB_REQUEST_MALFORMED',
      requests: Object.freeze([]),
      providerFetches: 0,
      includes: Object.freeze(['WEB_REQUEST_MALFORMED']),
    }),
  }),
  Object.freeze({
    id: 'WB-S1-search-single',
    entry: 'web_search',
    network: 'allow',
    limits: LIMITS.wide,
    steps: Object.freeze([Object.freeze({ tool: 'web_search', args: Object.freeze({ queries: Object.freeze(['ute fixture query']) }) })]),
    expect: Object.freeze({
      outcome: 'allow',
      refusal: null,
      requests: Object.freeze(['POST /search-api']),
      providerSearches: 1,
      sourceCount: 5,
      truncated: false,
      includes: Object.freeze(['Fixture summary for ute fixture query.', '- [One](https://source.test/one) — alpha snippet']),
    }),
  }),
  Object.freeze({
    id: 'WB-S2-search-multi',
    entry: 'web_search',
    network: 'allow',
    limits: LIMITS.wide,
    // Two queries run CONCURRENTLY (`Promise.allSettled` in the pinned tool), so
    // their ARRIVAL ORDER at the fixture is not a deterministic fact. The record
    // sorts this vector's request list and says `sorted` in the cell.
    concurrent: true,
    steps: Object.freeze([Object.freeze({ tool: 'web_search', args: Object.freeze({ queries: Object.freeze(['alpha query', 'beta query']) }) })]),
    expect: Object.freeze({
      outcome: 'allow',
      refusal: null,
      requests: Object.freeze(['POST /search-api', 'POST /search-api']),
      providerSearches: 2,
      sourceCount: 5,
      truncated: false,
      includes: Object.freeze(['### alpha query', '### beta query', 'Fixture summary for beta query.']),
    }),
  }),
  Object.freeze({
    id: 'WB-S3-search-unavailable',
    entry: 'web_search',
    network: 'allow',
    limits: LIMITS.wide,
    searchMode: 'unavailable',
    steps: Object.freeze([Object.freeze({ tool: 'web_search', args: Object.freeze({ queries: Object.freeze(['ute fixture query']) }) })]),
    expect: Object.freeze({
      outcome: 'deny',
      refusal: 'route-unresolved',
      code: 'WEB_PROVIDER_UNAVAILABLE',
      // The refusal is the face's availability leg: no provider entry, no wire.
      requests: Object.freeze([]),
      providerSearches: 0,
      includes: Object.freeze(['WEB_PROVIDER_UNAVAILABLE']),
    }),
  }),
])

/** The corpus ids, in fixture order (the lane suite pins this list). */
export const VECTOR_IDS = Object.freeze(CORPUS.map((vector) => vector.id))

/** The distinct members the corpus covers (derived, never hand-listed). */
export const COVERED_MEMBERS = Object.freeze([...new Set(CORPUS.map((vector) => vector.entry))])
