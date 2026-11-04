/**
 * Alpha.6 — a FILE-BACKED `ReviewWakeIntentStore` (one durable row per latch).
 *
 * This is the production-shaped implementation of the existing narrow port:
 * `persistQueued` writes the row BEFORE delivery, `markAccepted` records Inbox
 * acceptance, `clear` removes it, and `read` answers the row (or `null`).
 * Writes are atomic (temp file + rename) so a crash leaves either the old row
 * or the new one, never a torn JSON document.
 *
 * It is NOT a second ledger: the row carries only latch identity, wakeId and
 * work fingerprint — no decision, no authority, no payload.
 *
 * @module packages/runtime/alpha6/wake-intent-store
 */
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type {
  PersistedReviewWakeIntent,
  ReviewWakeIntentStore,
  ReviewWakeQueuedIntent,
} from './wake-intent.js'

export interface FileWakeIntentStoreOptions {
  /** Absolute path of the single JSON row. */
  readonly filePath: string
}

function isRow(value: unknown): value is PersistedReviewWakeIntent {
  if (typeof value !== 'object' || value === null) return false
  const row = value as Record<string, unknown>
  const key = row['key']
  if (typeof key !== 'object' || key === null) return false
  const k = key as Record<string, unknown>
  return (
    typeof k['rootSessionId'] === 'string' &&
    typeof k['reviewerInstanceId'] === 'string' &&
    typeof k['sessionGeneration'] === 'number' &&
    typeof row['wakeId'] === 'string' &&
    typeof row['workFingerprint'] === 'string' &&
    (row['status'] === 'queued' || row['status'] === 'accepted')
  )
}

export function createFileWakeIntentStore(
  options: FileWakeIntentStoreOptions,
): ReviewWakeIntentStore {
  const file = options.filePath

  async function write(row: PersistedReviewWakeIntent): Promise<void> {
    await mkdir(dirname(file), { recursive: true })
    // A UNIQUE temp name per write: two async writers of the same latch must
    // never share a scratch file (one rename would publish the other's bytes,
    // or fail ENOENT after the first rename). The rename stays the atomic
    // publish point; an orphaned temp is ignored by every reader.
    const tmp = `${file}.${randomUUID()}.tmp`
    await writeFile(tmp, `${JSON.stringify(row)}\n`, 'utf8')
    await rename(tmp, file)
  }

  return {
    async persistQueued(intent: ReviewWakeQueuedIntent): Promise<void> {
      await write({ ...intent, status: 'queued' })
    },
    async markAccepted(wakeId: string): Promise<void> {
      const row = await readRow()
      if (row === null || row.wakeId !== wakeId) return
      await write({ ...row, status: 'accepted' })
    },
    async clear(wakeId?: string): Promise<void> {
      if (wakeId !== undefined) {
        const row = await readRow()
        if (row !== null && row.wakeId !== wakeId) return
      }
      try {
        await unlink(file)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
    },
    async read(): Promise<PersistedReviewWakeIntent | null> {
      return readRow()
    },
  }

  async function readRow(): Promise<PersistedReviewWakeIntent | null> {
    let raw: string
    try {
      raw = await readFile(file, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
    const parsed: unknown = JSON.parse(raw)
    if (!isRow(parsed)) throw new Error('alpha6: the wake-intent row is malformed')
    return parsed
  }
}
