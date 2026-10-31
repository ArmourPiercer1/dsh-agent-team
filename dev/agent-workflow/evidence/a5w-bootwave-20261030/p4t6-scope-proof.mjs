/**
 * p4t6 scan-scope proof for the a5w-bootwave lane (run from the worktree):
 * the new scannable candidate is tests/world-factory/suites/140-u7r3-bootwave.mjs.
 * The scanner's scope is packages/<each package dir> ONLY; the p4t6 ledger law
 * (base + Σ bookings === filesScanned) must stay GREEN with NO new booking.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const repoRoot0 = process.cwd()
const { scanSessionEventVocabulary, matchDenyListInText } = await import(pathToFileURL(join(repoRoot0, 'packages/testkit/fault-injection/session-event-scan.mjs')).href)
const { checkLedger, loadBookings } = await import(pathToFileURL(join(repoRoot0, 'packages/testkit/test/p4t6-bookings/load-bookings.mjs')).href)

const P4T6_BASE = 983
const NEW_FILE = 'tests/world-factory/suites/140-u7r3-bootwave.mjs'
const repoRoot = process.cwd()

const scan = scanSessionEventVocabulary({ repoRoot })
const { bookings, violations: schemaViolations } = loadBookings()
const ledger = checkLedger({ base: P4T6_BASE, bookings, scannedFiles: scan.files, scannedCount: scan.filesScanned })

const underTests = scan.files.filter((f) => f.startsWith('tests/'))
const myHit = scan.files.filter((f) => f.includes('140-u7r3-bootwave'))
const denyHits = matchDenyListInText(readFileSync(`${repoRoot}/${NEW_FILE}`, 'utf8'), NEW_FILE)

console.log(JSON.stringify({
  scannedRoots: scan.packageDirs.map((d) => `packages/${d}`),
  filesScanned: scan.filesScanned,
  scanHitsTotal: scan.summary.total,
  scannedPathsUnderTests: underTests.length,
  newFileInsideScanScope: myHit.length > 0,
  ledgerBase: P4T6_BASE,
  bookingsLoaded: bookings.length,
  bookingSchemaViolations: schemaViolations,
  ledgerViolations: ledger.violations,
  scannerCountVsLedger: { scanned: scan.filesScanned, expected: ledger.expected, summed: ledger.summed, ties: scan.filesScanned === ledger.expected },
  preexistingHitFiles: [...new Set(scan.hits.map((h) => h.file))].slice(0, 20),
  denyListHitsInNewFile: denyHits,
}, null, 2))

const green = schemaViolations.length === 0 && ledger.violations.length === 0
  && scan.filesScanned === ledger.expected && myHit.length === 0 && underTests.length === 0 && denyHits.length === 0
console.log(green
  ? `BOOKING EXEMPTION PROVEN: ${NEW_FILE} is OUTSIDE the p4t6 scan scope (roots = packages/<dir> only); the ledger still ties (${String(scan.filesScanned)} === base ${String(P4T6_BASE)} + Σ bookings) with ZERO new booking.`
  : 'EXEMPTION NOT PROVEN — read the JSON above.')
process.exit(green ? 0 : 1)
