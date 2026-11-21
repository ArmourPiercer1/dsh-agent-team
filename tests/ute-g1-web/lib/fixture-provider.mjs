/**
 * fixture-provider.mjs — the COMPOSITION-OWNED transport the confined `web`
 * face needs, wired to the loopback fixture server over a REAL socket.
 *
 * WHY THE COMPOSITION OWNS A TRANSPORT AT ALL. `packages/runtime/team-services/src/web.ts`
 * (the confined `web` face, BL-18/PD-15/PD-30) deliberately ships no transport:
 * it consults the compiled `network` axis, emits the one guard fact, and then
 * delegates to `provider.fetch` / `provider.search` — "the composition injects
 * one, exactly like the confined process provider". A C1 world therefore has to
 * supply it, and that is the ONLY thing this module invents.
 *
 * WHAT IS *NOT* INVENTED HERE (the answers, so a reviewer can check them):
 *
 *   fetch        the PINNED host `HttpFetchProvider` (`@deepseek-ai/dsh-web-fetch-http`,
 *                read-only import from the pristine tree at `tests/paths.mjs`'s
 *                pin) performs the whole fetch: redirect following under the
 *                same-origin + hop-cap law, content-type classification
 *                (`WEB_UNSUPPORTED_CONTENT_TYPE`), the byte cap
 *                (`WEB_FETCH_TOO_LARGE`), the character cap (`truncated`), the
 *                deadline (`WEB_FETCH_TIMEOUT`) and the charset decode. Its
 *                documented resolver argument is the seam that points it at the
 *                fixture (`new HttpFetchProvider(limits, resolveAddresses)`) —
 *                the production default (`publicHttpNetwork.resolve`) refuses
 *                non-public addresses, which is exactly why a loopback fixture
 *                needs the injected resolver instead of a patched provider.
 *   search       the pinned tree ships only vendor API clients (exa/perplexity/
 *                deepseek keys), so the fixture POSTs to its own JSON endpoint
 *                over the same loopback socket and validates the answer against
 *                the host's `WebSearchResult` shape. The seam's own source cap
 *                (`capSearchSources`, inside the confined face) is what the
 *                corpus measures, not this module.
 *   admission    the confined face's PD-30 SSRF leg. The fixture origin is
 *                declared as `testEndpoints` — the documented, EXACT-origin
 *                composition exemption — so `http://127.0.0.1:3182` is admitted
 *                while `http://localhost:3182` and every undeclared origin are
 *                refused before the provider.
 *
 * NO EGRESS. The resolver answers the loopback literal for every hostname, and
 * the pinned provider only connects to the pinned address set it was handed, so
 * every socket this provider opens is `127.0.0.1:3182`. The independent check is
 * `lib/net-witness.mjs`, which counts the CONNECT calls of the whole process.
 *
 * @module tests/ute-g1-web/lib/fixture-provider
 */
import { request as httpRequest } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
/** This suite's repo root (`tests/ute-g1-web/lib` → repo root). */
export const REPO_ROOT = join(HERE, '..', '..', '..')

/** The pinned host tree (read-only; never written, never tracked). */
export const PRISTINE_ROOT = join(REPO_ROOT, 'tests', 'deepseek-harness-test-use')

/** The exact limits the corpus's cap vectors are derived from (documented, not guessed). */
export const DEFAULT_FETCH_LIMITS = Object.freeze({
  maxResponseBytes: 2048,
  maxBodyChars: 120,
  timeoutMs: 30_000,
  maxRedirects: 2,
  userAgent: 'ute-g1-web-b1-fixture',
})

/** The bounded JSON POST the search fixture uses (bytes in, bytes out, wall time). */
const SEARCH_MAX_BYTES = 64 * 1024
const SEARCH_TIMEOUT_MS = 5_000

let providerModulePromise
/** Load the PINNED fetch provider (once) from the pristine tree. */
export function loadPinnedFetchProvider() {
  providerModulePromise ??= import(
    pathToFileURL(join(PRISTINE_ROOT, 'packages', 'web', 'web-fetch-http', 'lib', 'index.js')).href
  )
  return providerModulePromise
}

/**
 * Build the confined face's provider over the fixture origin.
 *
 * @param {object} input
 * @param {string} input.origin - the exact fixture origin (`http://127.0.0.1:3182`).
 * @param {object} [input.fetchLimits] - the pinned provider's resolved limits.
 * @param {'present'|'unavailable'|'absent'} [input.searchMode] - the declared search capability.
 * @param {readonly string[]} [input.testEndpoints] - the EXACT origins the composition declares as fixtures.
 * @returns {Promise<object>} the provider (a plain object: the face's structural contract).
 */
export async function createFixtureWebProvider({ origin, fetchLimits = DEFAULT_FETCH_LIMITS, searchMode = 'present', testEndpoints = [origin] }) {
  const { HttpFetchProvider } = await loadPinnedFetchProvider()
  const stats = { fetches: 0, searches: 0, urls: [], queries: [] }
  // THE SEAM: the provider's own documented resolver argument. Every hostname
  // resolves to the fixture's loopback address, so the pinned connector can only
  // reach the fixture (its lookup is this answer set, pinned).
  const inner = new HttpFetchProvider(fetchLimits, async () => [{ address: '127.0.0.1', family: 4 }])

  const provider = {
    testEndpoints: Object.freeze([...testEndpoints]),
    stats,
    async fetch(request, signal) {
      stats.fetches += 1
      stats.urls.push(typeof request?.url === 'string' ? request.url : '<no-url>')
      return inner.fetch(request, signal)
    },
  }
  if (searchMode === 'absent') {
    // The face's `assertSearchAvailable` refuses with WEB_PROVIDER_UNAVAILABLE.
    provider.searchAvailable = () => false
  } else if (searchMode === 'unavailable') {
    provider.searchAvailable = () => false
    provider.search = async () => {
      throw new Error('the fixture search provider must never run when it declares itself unavailable')
    }
  } else {
    provider.searchAvailable = () => true
    provider.search = async (request, signal) => {
      stats.searches += 1
      const query = typeof request?.query === 'string' ? request.query : ''
      stats.queries.push(query)
      const payload = JSON.stringify({ query, maxResults: request?.maxResults ?? null })
      const answer = await postJson(`${origin}/search-api`, payload, signal)
      if (answer === null || typeof answer !== 'object') {
        throw new Error('the fixture search endpoint answered no object')
      }
      const sources = Array.isArray(answer.sources) ? answer.sources : []
      const result = {
        sources,
        truncated: answer.truncated === true,
      }
      if (typeof answer.content === 'string') result.content = answer.content
      return result
    }
  }
  return provider
}

/**
 * One bounded JSON POST to the fixture (real socket, abort honouring, byte cap).
 *
 * @param {string} url - absolute fixture URL.
 * @param {string} body - the JSON payload.
 * @param {AbortSignal|undefined} signal - the caller's signal.
 * @returns {Promise<unknown>} the parsed answer.
 */
async function postJson(url, body, signal) {
  return await new Promise((resolve, reject) => {
    const target = new URL(url)
    if (signal?.aborted === true) {
      const error = new Error('the web search request was cancelled before it was sent')
      error.code = 'cancelled'
      reject(error)
      return
    }
    const req = httpRequest(target, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(body)) },
    }, (res) => {
      const chunks = []
      let total = 0
      res.on('data', (chunk) => {
        total += chunk.length
        if (total > SEARCH_MAX_BYTES) {
          res.destroy()
          const error = new Error(`the fixture search answer exceeds the ${String(SEARCH_MAX_BYTES)}-byte bound`)
          error.code = 'WEB_RESPONSE_TOO_LARGE'
          reject(error)
          return
        }
        chunks.push(Buffer.from(chunk))
      })
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
        } catch (error) {
          reject(new Error(`the fixture search answer was not JSON: ${String(error)}`))
        }
      })
      res.on('error', reject)
    })
    const timer = setTimeout(() => {
      req.destroy()
      const error = new Error('the fixture search request exceeded its wall-time bound')
      error.code = 'WEB_TIMEOUT'
      reject(error)
    }, SEARCH_TIMEOUT_MS)
    if (typeof timer.unref === 'function') timer.unref()
    const onAbort = () => {
      req.destroy()
      const error = new Error('the web search request was cancelled')
      error.code = 'cancelled'
      reject(error)
    }
    signal?.addEventListener?.('abort', onAbort, { once: true })
    req.on('error', (error) => {
      clearTimeout(timer)
      signal?.removeEventListener?.('abort', onAbort)
      reject(error)
    })
    req.on('close', () => {
      clearTimeout(timer)
      signal?.removeEventListener?.('abort', onAbort)
    })
    req.end(body)
  })
}
