/**
 * Type surface for `load-bookings.mjs` (the p4t6 per-lane booking ledger) —
 * the sidecar declaration convention of this repo's plain-.mjs testkit
 * modules (session-event-scan.d.mts, arc-a-fitness/scan.d.mts).
 */
export type Booking = {
  schema: 'p4t6-booking/1'
  lane: string
  paths: string[]
  expectedDelta: { from: number; to: number } | { netNeutral: true } | null
  reason: string
  tieNote?: string
  migratedFrom?: string
  pathNotes?: Record<string, string>
  listNotes?: string
  countedInBase?: boolean
  retiredLater?: string[]
  retires?: string[]
  retiresNotes?: Record<string, string>
  retiresReason?: string
  /** the file the booking was read from (added by the loader) */
  file: string
}

export type LedgerViolation = { kind: string; file?: string; lane?: string; path?: string; detail?: string }

export declare const BOOKINGS_DIR: string

export declare function loadBookings(dir?: string): { bookings: Booking[]; violations: LedgerViolation[] }

export declare function checkLedger(input: {
  base: number
  bookings: readonly Booking[]
  scannedFiles: readonly string[]
  scannedCount: number
}): { expected: number; summed: number; violations: LedgerViolation[] }
