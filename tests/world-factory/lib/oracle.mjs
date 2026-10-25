/**
 * oracle.mjs — the U5 effect Oracle: observes tool effects INDEPENDENTLY of
 * the tool's own return value (plan U5 bullet 3: "Oracle observes effects
 * independently of the tool's own return").
 *
 * OBSERVATION CHANNELS (all read from OUTSIDE the host process):
 *   filesystem   World workspace marker files (written by the tool body)
 *   ledger       World home ledger rows appended by the plugin INSIDE the
 *                host process — a separate pipe from the result envelope
 *   processes    the World's ownership ledger (.u5-ownership.json) + pid
 *                liveness: the effect must be attributable to OUR live host
 *                pid, not to a recycled pid or a leftover from an old run
 *   host log     instance log tail: dispatch-visible traces for the tag
 *                (reported as a channel; not a conjunct, because log
 *                verbosity is a host policy, not the canary's contract)
 *
 * EFFECT CONJUNCTION (sound oracle):
 *     marker(tag) present  AND  ledger has body-ran+marker-ran for tag
 *     AND the recorded host pid was alive at observation time.
 * The tool's RETURN VALUE IS NOT AN INPUT to this conjunction — a result
 * saying ran:true with no filesystem effect reads as NO effect (the planted
 * 'defect' mode), and an errored result with a filesystem effect reads as
 * effect (the 'error-after-effect' mode).
 *
 * THE BROKEN VARIANT (fault-planting sensitivity, plan: "植入故障时必须 RED"):
 * createOracle({broken:'ignore-marker'}) claims effect from the tool's return
 * value alone. Run against the planted-defect observation it says effect=true
 * while the sound Oracle says false — the DIVERGENCE demonstrates the sound
 * oracle is sensitive (the blinded oracle would let the planted defect read
 * GREEN, which is exactly the failure the sensitivity meta-test forbids).
 * The broken variant exists ONLY for the sensitivity demonstration; no case
 * verdict is ever graded with it.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { pidAlive } from './port-lease.mjs'

/**
 * @param {object} world effect paths (TestWorld-shaped, or a fixture in unit tests)
 * @param {string} world.markerDir
 * @param {string} world.ledgerPath
 * @param {string} world.ownershipPath
 * @param {string} [world.hostLogPath]
 * @param {object} [opts]
 * @param {'ignore-marker'|null} [opts.broken] deliberately-broken variant
 */
export function createOracle({ markerDir, ledgerPath, ownershipPath, hostLogPath }, opts = {}) {
  const broken = opts.broken ?? null
  return {
    id: broken === null ? 'sound' : `broken:${broken}`,
    broken,

    /** Raw channel reads — no interpretation. Unparseable rows stay visible. */
    observe({ tag, minLedgerRows = 0 }) {
      const markers = []
      try {
        for (const name of readdirSync(markerDir)) markers.push(name)
      } catch {
        /* no markers dir yet = zero markers (an observation, not an error) */
      }
      const ledgerRows = []
      try {
        for (const line of readFileSync(ledgerPath, 'utf8').split('\n')) {
          if (line.trim() === '') continue
          try {
            ledgerRows.push(JSON.parse(line))
          } catch {
            ledgerRows.push({ leg: 'UNPARSEABLE', raw: line.slice(0, 200) })
          }
        }
      } catch {
        /* absent ledger = zero rows (the conjunction below will fail) */
      }
      let ownership = null
      try {
        ownership = JSON.parse(readFileSync(ownershipPath, 'utf8'))
      } catch {
        ownership = null
      }
      const hostPid = Number(ownership?.hostPid)
      const hostAlive = Number.isInteger(hostPid) && hostPid > 0 ? pidAlive(hostPid) : false
      let hostLogHits = null
      if (hostLogPath !== undefined) {
        try {
          const text = readFileSync(hostLogPath, 'utf8')
          hostLogHits = tag === undefined ? null : text.split('\n').filter((l) => l.includes(String(tag))).length
        } catch {
          hostLogHits = null
        }
      }
      const forTag = tag === undefined ? undefined : ledgerRows.filter((r) => r.tag === tag)
      return {
        observedAt: new Date().toISOString(),
        channels: {
          markers: { dir: markerDir, files: markers, forTag: tag === undefined ? undefined : markers.filter((m) => m.startsWith(`${tag}.`) || m === `${tag}.marker`) },
          ledger: { path: ledgerPath, rowCount: ledgerRows.length, forTag: forTag?.map((r) => r.leg), rows: forTag },
          processes: { hostPid: Number.isInteger(hostPid) ? hostPid : null, hostAlive },
          hostLog: { path: hostLogPath ?? null, tagLineHits: hostLogHits },
        },
        ledgerRowsAtLeast: ledgerRows.length >= minLedgerRows,
      }
    },

    /**
     * The verdict-bearing conjunction.
     * @param observation from observe()
     * @param {object} [ctx]
     * @param {boolean} [ctx.returnedRan] the tool's OWN claim — only consulted
     *        by the deliberately-broken variant (that is the point of it).
     * @param {boolean} [ctx.resultErrored] whether the result envelope was an error
     */
    effect(obs, ctx = {}) {
      const marker = obs.channels.markers.forTag !== undefined && obs.channels.markers.forTag.length > 0
      const legs = obs.channels.ledger.forTag ?? []
      const bodyRan = legs.includes('body-ran')
      const markerRan = legs.includes('marker-ran') || legs.includes('pre-marker')
      const attributable = obs.channels.processes.hostAlive === true
      if (this.broken === 'ignore-marker') {
        // BLINDED: trusts the return value, ignores the filesystem evidence.
        return { effect: ctx.returnedRan === true, basis: ['returnedRan'], marker, bodyRan, markerRan, attributable }
      }
      return {
        effect: marker && bodyRan && attributable,
        basis: ['marker', 'ledger:body-ran', 'processes:host-alive'],
        marker,
        bodyRan,
        markerRan,
        attributable,
        resultErrored: ctx.resultErrored === true,
      }
    },
  }
}

/**
 * Convenience: build the Oracle's path set from a TestWorld.
 * (Kept separate so unit tests can pass bare fixtures.)
 */
export function oraclePaths(world, instanceLogPath = undefined) {
  return {
    markerDir: world.markerDir,
    ledgerPath: world.ledgerPath,
    ownershipPath: join(world.home, '.u5-ownership.json'),
    ...(instanceLogPath !== undefined ? { hostLogPath: instanceLogPath } : {}),
  }
}

export function markerExists(markerDir, fileName) {
  return existsSync(join(markerDir, fileName))
}
