/**
 * LedgerRepository — the `ledger` store: the durable append-only fact
 * ledger, keyed by `String(sequence)` (no delete).
 *
 * The recovery protocol (roll-forward, never rollback) reconciles against
 * this ledger: sequence gaps are first-class diagnostics
 * (`gaps()`), and a crashed write between the counter increment and the
 * entry write leaves a gap that a later write may fill (the entry put
 * only requires `sequence <= counter`, never contiguity).
 *
 * Allocation uses the public seam's `update` (atomic on the domain write
 * chain): the counter row is bootstrapped with an idempotent put when
 * absent (race-safe: both racers write the identical `value: 0` bytes),
 * then incremented atomically — the increment is the only non-idempotent
 * step, and it is serialized on the write chain.
 *
 * @module @dsh-agent-team/storage/repositories/ledger
 */

import {
  LEDGER_SEQUENCE_COUNTER_KEY,
  LEDGER_SEQUENCE_COUNTER_KIND,
  TEAM_DOMAIN_SCHEMA_VERSION,
  deserializeLedgerEntry,
  deserializeLedgerSequenceCounter,
  normalizeValidationError,
  parseLedgerEntry,
  serializeLedgerEntry,
  serializeLedgerSequenceCounter,
  teamDomainError,
} from '../schema/index.js'
import type { LedgerEntry, LedgerSequenceCounter, StorageDomainHandle } from '../schema/index.js'
import { BaseRepository } from './base.js'

/**
 * The `ledger` repository (append-only journal).
 */
export class LedgerRepository extends BaseRepository {
  /**
   * @param handle - the open `team_domain` handle.
   */
  constructor(handle: StorageDomainHandle) {
    super(handle, 'ledger')
  }

  /** Read the counter row, or `undefined` before the first allocation. */
  private readCounter(): LedgerSequenceCounter | undefined {
    const raw = this.readRow(LEDGER_SEQUENCE_COUNTER_KEY)
    if (raw === undefined) return undefined
    try {
      return deserializeLedgerSequenceCounter(raw)
    } catch (error) {
      throw normalizeValidationError(error, this.storeName, LEDGER_SEQUENCE_COUNTER_KEY)
    }
  }

  /**
   * Allocate the next ledger sequence (atomic, serialized on the domain
   * write chain).
   * @returns the newly allocated sequence (1 on a fresh ledger).
   */
  async allocateSequence(): Promise<number> {
    if (this.readCounter() === undefined) {
      const boot: LedgerSequenceCounter = {
        schemaVersion: TEAM_DOMAIN_SCHEMA_VERSION,
        kind: LEDGER_SEQUENCE_COUNTER_KIND,
        value: 0,
      }
      await this.putRaw(LEDGER_SEQUENCE_COUNTER_KEY, serializeLedgerSequenceCounter(boot))
    }
    const updated = await this.updateRaw(LEDGER_SEQUENCE_COUNTER_KEY, (current) => {
      if (typeof current !== 'string') {
        throw teamDomainError(
          'RECORD_INVALID',
          `ledger counter row '${LEDGER_SEQUENCE_COUNTER_KEY}' is not a string`,
          { store: this.storeName, key: LEDGER_SEQUENCE_COUNTER_KEY, problem: 'row-not-a-string' },
        )
      }
      const counter = deserializeLedgerSequenceCounter(current)
      return serializeLedgerSequenceCounter({ ...counter, value: counter.value + 1 })
    })
    if (typeof updated !== 'string') {
      throw teamDomainError(
        'SEAM_FAILURE',
        'ledger counter update returned a non-string value',
        { store: this.storeName, key: LEDGER_SEQUENCE_COUNTER_KEY, problem: 'update-result-not-string', seamCode: 'malformed-medium' },
      )
    }
    let counter: LedgerSequenceCounter
    try {
      counter = deserializeLedgerSequenceCounter(updated)
    } catch (error) {
      throw normalizeValidationError(error, this.storeName, LEDGER_SEQUENCE_COUNTER_KEY)
    }
    return counter.value
  }

  /**
   * Durably put one ledger entry at its allocated sequence.
   *
   * Put rules: the counter must exist (`sequence-not-allocated`), the
   * sequence must not exceed the counter (`unallocated-sequence`), and an
   * occupied sequence raises `duplicate-ledger-entry` (identical bytes are
   * the idempotent no-op). Gaps may be filled later (roll-forward).
   * @param entry - the unknown input, parsed via `parseLedgerEntry`.
   * @returns the frozen entry.
   */
  async put(entry: unknown): Promise<LedgerEntry> {
    let record: LedgerEntry
    try {
      record = parseLedgerEntry(entry)
    } catch (error) {
      throw normalizeValidationError(error, this.storeName)
    }
    const counter = this.readCounter()
    if (counter === undefined) {
      throw teamDomainError(
        'RECORD_INVALID',
        `ledger entry with sequence ${record.sequence} was written before any sequence allocation`,
        { store: this.storeName, key: String(record.sequence), problem: 'sequence-not-allocated' },
      )
    }
    if (record.sequence > counter.value) {
      throw teamDomainError(
        'RECORD_INVALID',
        `ledger entry with sequence ${record.sequence} is not allocated (counter is ${counter.value})`,
        { store: this.storeName, key: String(record.sequence), problem: 'unallocated-sequence', counter: counter.value, found: record.sequence },
      )
    }
    const key = String(record.sequence)
    await this.putRecord(key, serializeLedgerEntry(record), (existing) => {
      try {
        deserializeLedgerEntry(existing)
      } catch (error) {
        throw normalizeValidationError(error, this.storeName, key)
      }
      throw teamDomainError(
        'RECORD_DUPLICATE',
        `ledger sequence ${record.sequence} is already occupied`,
        { store: this.storeName, key, problem: 'duplicate-ledger-entry' },
      )
    })
    return record
  }

  /**
   * Read one ledger entry by sequence.
   * @returns the frozen entry, or `undefined` when absent (a gap).
   * @throws `RECORD_INVALID` (problem `bad-sequence`) for a non-positive
   *   sequence, or a malformed/non-canonical stored row.
   */
  get(sequence: number): LedgerEntry | undefined {
    if (typeof sequence !== 'number' || !Number.isInteger(sequence) || sequence < 1) {
      throw teamDomainError(
        'RECORD_INVALID',
        `ledger sequence must be a positive integer, got ${JSON.stringify(sequence)}`,
        { store: this.storeName, problem: 'bad-sequence' },
      )
    }
    const key = String(sequence)
    return this.readRecord(key, deserializeLedgerEntry, serializeLedgerEntry)
  }

  /**
   * List every ledger entry (the counter row is excluded), sorted by
   * sequence. Gaps appear as missing sequence numbers in the result.
   */
  list(): LedgerEntry[] {
    const entries: LedgerEntry[] = []
    for (const [key, raw] of this.snapshotEntries()) {
      if (key === LEDGER_SEQUENCE_COUNTER_KEY) continue
      entries.push(this.readRecordFromRaw(key, raw, deserializeLedgerEntry, serializeLedgerEntry))
    }
    entries.sort((a, b) => a.sequence - b.sequence)
    return entries
  }

  /**
   * The allocated-but-missing sequences in `1..counter` (empty when the
   * ledger is contiguous or unallocated). This is the crash diagnostic:
   * a gap is expected after a crash between the counter increment and the
   * entry write, and is filled by roll-forward — never by rollback.
   */
  gaps(): number[] {
    const counter = this.readCounter()
    if (counter === undefined) return []
    const present = new Set<number>()
    for (const [key, raw] of this.snapshotEntries()) {
      if (key === LEDGER_SEQUENCE_COUNTER_KEY) continue
      const entry = this.readRecordFromRaw(key, raw, deserializeLedgerEntry, serializeLedgerEntry)
      present.add(entry.sequence)
    }
    const missing: number[] = []
    for (let sequence = 1; sequence <= counter.value; sequence++) {
      if (!present.has(sequence)) missing.push(sequence)
    }
    return missing
  }

  /**
   * The number of fact entries (the counter row is excluded).
   */
  entryCount(): number {
    let count = 0
    for (const [key] of this.snapshotEntries()) {
      if (key !== LEDGER_SEQUENCE_COUNTER_KEY) count += 1
    }
    return count
  }
}
