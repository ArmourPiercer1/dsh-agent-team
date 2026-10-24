/**
 * governed-families/g1-trusted-topology-supply.mjs — the REAL public supply
 * of the frozen G1 `trustedTopology` port (center 00:53 card ② + ROOT 01:01
 * contract ruling; the G1-WIRE lane's independent semantics block — 44ece's
 * PA-placement and Guard owner-held feed ports untouched; the signed
 * wiring/assembly files are NOT reopened: this supply plugs into the
 * ALREADY-SIGNED shapes `wiring.ports.trustedTopology = { current() }` and
 * `createG1QueryAssembly({ topology: { current() } })`).
 *
 * THE SIGNED CONSUMPTION LAW THIS SUPPLY MEETS (root 01:01, verified against
 * the adapter): classify reads `current()` SYNCHRONOUSLY (:621-643) and the
 * edge re-verify (:824-838) compares ONLY revision+digest EQUALITY. The
 * revision type is nonNegativeInt. M0 scope = the CURRENT authorized topology
 * only — no monotonic-event and no ABA guarantee is promised, and this block
 * claims neither: an equal pair means "the normalized content is the same",
 * never "nothing ever happened in between".
 *
 * REAL SOURCES, FRESH PER READ (no cache, no snapshots, no fake events, no
 * private symbols, no new ledger):
 *  - the directory: the Host's PUBLIC Inspect seam — CordisInspectRegistry-
 *    Service (cordis service id 'cordisInspect', cordis-host-runner/
 *    inspect-registry.ts @639: list()/register()/query()/syncClientManifest();
 *    list() is SYNCHRONOUS there — verified, which is what makes a cacheless
 *    synchronous current() honest; the same face the native cordis_inspect_list
 *    reads, mounted plugin-side exactly as tool-cordis/host.ts:18 mounts it);
 *  - the AUTHORIZED SCOPE: the mount's existing authorization facts, read
 *    live per call through the owner-held `authorized()` reader. Publicly
 *    VISIBLE is NOT authorized: `allowed` is the same-read INTERSECTION of
 *    the live directory triples with the authorized scope (exact triples,
 *    closed grammar); an absent/ill-shaped scope is a config defect and fails
 *    closed to `undefined` — the adapter's own P_G1_TRUSTED_TOPOLOGY_ABSENT
 *    (the signed guard, identity unmoved).
 *
 * VALUE LAWS: `allowed` = fully normalized (sorted, deduped, frozen) triples
 * from the SAME read. `topologyDigest` = the FULL SUMMARY of the complete
 * canonical content: sha256 over the canonical sorted full allowed set,
 * recomputed per read (any content movement moves it). `topologyRevision` =
 * the CONTENT-VERSION companion the ruling derives DETERMINISTICALLY from the
 * same canonical content (first 52 bits of the same digest -> a non-negative
 * safe integer). Compatibility semantics stated plainly: equal pair = same
 * normalized content; the short revision NEVER stands alone as equality
 * evidence (the digest carries the full content and the adapter's own
 * equality is the pair). No constant, no observation count, no monotonicity
 * or hidden-substitution claim.
 *
 * @module @dsh-agent-team/runtime/plugin/live/governed-families/g1-trusted-topology-supply
 */
import { createHash } from 'node:crypto'

export const A5_G1_TRUSTED_TOPOLOGY_SUPPLY_REVISION = 1

/** Typed facts OWNED by this block (P_G1_TOPO_*). */
export const A5_G1_TRUSTED_TOPOLOGY_SUPPLY_CODES = Object.freeze({
  INSPECT_ABSENT: 'P_G1_TOPO_INSPECT_ABSENT',
  AUTHORIZED_ABSENT: 'P_G1_TOPO_AUTHORIZED_ABSENT',
})

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

/** Sorted-key canonical JSON (the lane's mint algebra — full and reversible,
 *  never a silent field-drop: the digest is over the COMPLETE content). */
const canonical = (value) => JSON.stringify(value, (_key, item) => (
  isRecord(item) && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]]))
    : item
))

const refuseSupply = (code, message) => Object.freeze({ ok: false, code, message })

const byTriple = (a, b) => a.platform.localeCompare(b.platform)
  || a.provider.localeCompare(b.provider)
  || a.method.localeCompare(b.method)

const tripleKey = (t) => `${t.platform}\u0000${t.provider}\u0000${t.method}`

/**
 * Create the trustedTopology supply over the mount's live public seams.
 *
 * @param input {{
 *   inspect: { list(): unknown },              // the PUBLIC cordisInspect face (ctx.cordisInspect at the mount)
 *   authorized: () => unknown,                 // LIVE reader of the mount's authorized scope: [{platform, provider, method}, …] (exact triples; owner-held facts)
 *   observe?: (row: object) => void,
 * }} input
 * @returns frozen `{ ok: true, supply: { revision, current() } }` or a frozen
 *          `{ ok: false, code, message }` arm refusal. `current()` answers the
 *          FULL face only over complete, well-shaped same-read facts; absent/
 *          malformed answers `undefined` — the adapter's own fail-closed
 *          P_G1_TRUSTED_TOPOLOGY_ABSENT path.
 */
export function createG1TrustedTopologySupply(input = {}) {
  const inspect = input.inspect
  if (!isRecord(inspect) || typeof inspect.list !== 'function') {
    return refuseSupply(A5_G1_TRUSTED_TOPOLOGY_SUPPLY_CODES.INSPECT_ABSENT, 'the supply reads the PUBLIC cordisInspect face (ctx.cordisInspect.list()) live — with no inspect directory there is no topology, and this block ships no snapshot')
  }
  if (typeof input.authorized !== 'function') {
    return refuseSupply(A5_G1_TRUSTED_TOPOLOGY_SUPPLY_CODES.AUTHORIZED_ABSENT, 'authorized() (live [{platform, provider, method}] scope) is REQUIRED — publicly visible is NOT authorized; without the mount scope there is nothing to intersect and this block ships no allow-all default')
  }
  const observe = typeof input.observe === 'function' ? input.observe : () => {}

  const current = () => {
    // ── SAME-READ, FRESH: both sources are read here, once, now — no cache,
    // no event history (the public face is synchronous at 639, verified).
    const directory = inspect.list()
    if (!Array.isArray(directory)) {
      observe({ event: 'g1-topo:directory-ABSENT' })
      return undefined
    }
    const scope = input.authorized()
    if (!Array.isArray(scope)) {
      observe({ event: 'g1-topo:authorized-ABSENT' })
      return undefined
    }
    const authorizedKeys = new Set()
    for (const entry of scope) {
      if (!isRecord(entry) || typeof entry.platform !== 'string' || typeof entry.provider !== 'string' || typeof entry.method !== 'string') {
        // An ill-shaped authorization entry is a config defect: fail closed
        // (the adapter's own refusal), never guess which entries "meant".
        observe({ event: 'g1-topo:authorized-MALFORMED' })
        return undefined
      }
      authorizedKeys.add(tripleKey({ platform: entry.platform, provider: entry.provider, method: entry.method }))
    }
    const triples = []
    for (const view of directory) {
      if (!isRecord(view) || typeof view.platform !== 'string' || typeof view.id !== 'string' || !Array.isArray(view.methods)) {
        // A half-known directory is NOT a topology.
        observe({ event: 'g1-topo:directory-MALFORMED' })
        return undefined
      }
      for (const method of view.methods) {
        if (!isRecord(method) || typeof method.name !== 'string') {
          observe({ event: 'g1-topo:directory-MALFORMED', provider: view.id })
          return undefined
        }
        const triple = { platform: view.platform, provider: view.id, method: method.name }
        if (authorizedKeys.has(tripleKey(triple))) triples.push(Object.freeze(triple))
      }
    }
    const deduped = []
    const seen = new Set()
    for (const triple of triples.sort(byTriple)) {
      const key = tripleKey(triple)
      if (seen.has(key)) continue
      seen.add(key)
      deduped.push(triple)
    }
    const allowed = Object.freeze(deduped)
    // ── FULL SUMMARY of the complete canonical content, recomputed per read.
    const digestHex = createHash('sha256').update(canonical(allowed)).digest('hex')
    // ── CONTENT-VERSION companion (root 01:01): deterministic, derived from
    // the SAME canonical content (first 52 bits — always a non-negative safe
    // integer). Equal pair = same normalized content; this short value NEVER
    // stands alone as equality evidence (the digest carries the full content,
    // and the adapter's own equality is the pair), and no monotonic order or
    // hidden-substitution guarantee is claimed or implied.
    const topologyRevision = Number.parseInt(digestHex.slice(0, 13), 16)
    observe({ event: 'g1-topo:answered', providers: directory.length, allowedCount: allowed.length })
    return Object.freeze({
      topologyRevision,
      topologyDigest: `sha256:${digestHex}`,
      allowed,
    })
  }

  const supply = Object.freeze({ revision: A5_G1_TRUSTED_TOPOLOGY_SUPPLY_REVISION, current })
  observe({ event: 'g1-topo:supply-mounted' })
  return Object.freeze({ ok: true, supply })
}
