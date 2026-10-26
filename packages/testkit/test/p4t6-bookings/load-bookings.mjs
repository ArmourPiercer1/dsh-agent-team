/**
 * load-bookings.mjs — the p4t6 scannable-file ledger, collected by
 * ENUMERATION (u7-w0, 2026-10-26).
 *
 * Until u7-w0 every lane booked its new scannable paths by appending a
 * `SCANNED_PATHS_<LANE>` array to p4t6-session-event-scan.test.ts AND adding
 * that array to two hand-maintained sum sites, the presence loop and a tie
 * line — four edits in one shared file per lane, the measured merge hotspot
 * of U7 (3 of 7 merged PRs). A lane now ADDS ONE FILE, `<lane>.json`, beside
 * this module and edits no shared list:
 *
 *   {
 *     "schema": "p4t6-booking/1",
 *     "lane": "<LANE>",                       // unique across the directory
 *     "paths": ["packages/…", …],             // the NEW scannable paths
 *     "expectedDelta": {"from": N, "to": M},  // MEASURED tie: paths.length === M - N
 *                                             // (+ retiredLater.length), or
 *                                             // {"netNeutral": true} with "retires"
 *     "reason": "…",                          // what the lane added and why
 *     "tieNote": "…"                          // where the measurement came from
 *   }
 *
 * The law the test file asserts over these bookings is UNCHANGED in kind:
 *   - the scanner total equals EXACTLY  BASE + Σ paths  (bookings with
 *     `countedInBase` are inside BASE and are not summed again);
 *   - every booked path is present in the scan BY PATH; every `retires`
 *     path is ABSENT;
 *   - no path is booked twice (across files, or within one file);
 *   - every tie that is declared holds.
 * An unbooked new path therefore still turns the exact total RED, exactly as
 * an unlisted path did before.
 *
 * This module is pure (no vitest import) so the RED-first controls can feed it
 * planted directories. Zero denylist vocabulary.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The directory the real ledger lives in. */
export const BOOKINGS_DIR = fileURLToPath(new URL('.', import.meta.url))

/** Closed key set of one booking; an unknown key is a schema violation. */
const KEYS = new Set([
  'schema', 'lane', 'paths', 'expectedDelta', 'reason', 'tieNote', 'migratedFrom',
  'pathNotes', 'listNotes', 'countedInBase', 'retiredLater', 'retires', 'retiresNotes', 'retiresReason',
])
const LANE_FILE = /^[a-z0-9][a-z0-9-]*\.json$/

/**
 * Read every `<lane>.json` in `dir` in sorted file-name order (deterministic;
 * the order carries no meaning for a sum, but the violation list is stable).
 * Schema violations are RETURNED, never thrown, so a control can assert on them.
 * @param {string} [dir]
 */
export function loadBookings(dir = BOOKINGS_DIR) {
  const files = readdirSync(dir).filter((n) => n.endsWith('.json')).sort()
  const bookings = []
  const violations = []
  for (const file of files) {
    if (!LANE_FILE.test(file)) {
      violations.push({ kind: 'bad-file-name', file, detail: 'booking files are <lowercase-lane>.json' })
      continue
    }
    let b
    try {
      b = JSON.parse(readFileSync(join(dir, file), 'utf8'))
    } catch (error) {
      violations.push({ kind: 'unparseable', file, detail: String(error?.message ?? error) })
      continue
    }
    const unknown = Object.keys(b ?? {}).filter((k) => !KEYS.has(k))
    if (b?.schema !== 'p4t6-booking/1') violations.push({ kind: 'schema', file, detail: `schema ${JSON.stringify(b?.schema)}` })
    if (unknown.length > 0) violations.push({ kind: 'schema', file, detail: `unknown key(s) ${unknown.join(',')}` })
    if (typeof b?.lane !== 'string' || b.lane === '') violations.push({ kind: 'schema', file, detail: 'lane must be a non-empty string' })
    if (typeof b?.reason !== 'string' || b.reason.trim() === '') violations.push({ kind: 'schema', file, detail: 'reason must be non-empty' })
    if (!Array.isArray(b?.paths) || b.paths.length === 0 || b.paths.some((p) => typeof p !== 'string' || !p.startsWith('packages/'))) {
      violations.push({ kind: 'schema', file, detail: 'paths must be a non-empty list of packages/** strings' })
    }
    if (typeof b?.lane === 'string' && file !== `${b.lane.toLowerCase().replace(/_/g, '-')}.json`) {
      violations.push({ kind: 'bad-file-name', file, detail: `lane ${b.lane} must live in ${b.lane.toLowerCase().replace(/_/g, '-')}.json` })
    }
    const d = b?.expectedDelta
    // `null` = the five historical lists that never carried a tie; only a
    // MIGRATED booking may say so. A new lane books its measured delta.
    if (d === null && typeof b?.migratedFrom !== 'string') {
      violations.push({ kind: 'schema', file, detail: 'expectedDelta is required for a new booking (measure it: the unbooked run reads `expected <to> to be <from>`)' })
    }
    const deltaOk = d === null
      || (d !== null && typeof d === 'object' && d.netNeutral === true && Array.isArray(b.retires))
      || (d !== null && typeof d === 'object' && Number.isInteger(d.from) && Number.isInteger(d.to) && d.to >= d.from)
    if (!deltaOk) violations.push({ kind: 'schema', file, detail: `expectedDelta ${JSON.stringify(d)}` })
    bookings.push({ ...b, file })
  }
  return { bookings, violations }
}

/**
 * The ledger law over a scan result. Pure: returns every violation and the
 * derived total, so the test asserts `violations` empty AND `scanned === expected`.
 * @param {{ base: number, bookings: any[], scannedFiles: readonly string[], scannedCount: number }} input
 */
export function checkLedger({ base, bookings, scannedFiles, scannedCount }) {
  const violations = []
  const scanned = new Set(scannedFiles)
  const lanes = new Map()
  const owner = new Map()
  let summed = 0
  for (const b of bookings) {
    if (lanes.has(b.lane)) violations.push({ kind: 'duplicate-lane', lane: b.lane, detail: `${lanes.get(b.lane)} and ${b.file}` })
    else lanes.set(b.lane, b.file)
    for (const p of b.paths) {
      if (owner.has(p)) violations.push({ kind: 'double-booked', lane: b.lane, path: p, detail: `already booked by ${owner.get(p)}` })
      else owner.set(p, b.lane)
      if (!scanned.has(p)) violations.push({ kind: 'booked-but-absent', lane: b.lane, path: p })
    }
    for (const p of b.retires ?? []) {
      if (scanned.has(p)) violations.push({ kind: 'retired-but-present', lane: b.lane, path: p })
    }
    if (b.countedInBase !== true) summed += b.paths.length
    const d = b.expectedDelta
    if (d !== null && d !== undefined) {
      if (d.netNeutral === true) {
        if (b.paths.length !== (b.retires ?? []).length) {
          violations.push({ kind: 'tie', lane: b.lane, detail: `net-neutral: ${String(b.paths.length)} added vs ${String((b.retires ?? []).length)} retired` })
        }
      } else {
        // a path retired AFTER the booking keeps its historical delta true
        // for its booking tree: the list shrank, the delta did not.
        const expected = d.to - d.from - (b.retiredLater ?? []).length
        if (b.paths.length !== expected) {
          violations.push({ kind: 'tie', lane: b.lane, detail: `paths ${String(b.paths.length)} != ${String(d.to)} - ${String(d.from)}${(b.retiredLater ?? []).length > 0 ? ` - ${String(b.retiredLater.length)} retired` : ''}` })
        }
      }
    }
  }
  const expected = base + summed
  if (scannedCount !== expected) {
    violations.push({ kind: 'total', detail: `scanner counts ${String(scannedCount)}, ledger derives ${String(base)} + ${String(summed)} = ${String(expected)}` })
  }
  return { expected, summed, violations }
}
