/**
 * Alpha.6 — the DIRECTORY-backed wake-intent store: ONE row per latch.
 *
 * The single-file store remains available for a one-latch world; this variant
 * keys each row by the coordinator's `ReviewWakeKey`, so two reviewers (the
 * Officer and a transferred Leader) never overwrite each other. A boot-time
 * recovery enumerates every row and adopts each one independently.
 *
 * The row carries no decision and no authority; it is the same tiny intent
 * record the single-file store writes.
 *
 * @module packages/runtime/alpha6/wake-intent-directory
 */
import { access, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ReviewWakeKey } from '../review-wake/index.js'
import type {
  PersistedReviewWakeIntent,
  ReviewWakeIntentStore,
} from './wake-intent.js'
import { createFileWakeIntentStore } from './wake-intent-store.js'

export interface WakeIntentDirectory {
  /** The narrow store bound to ONE latch identity. */
  forKey(key: ReviewWakeKey): ReviewWakeIntentStore
  /** Every persisted row, in filename order (a deterministic scan). */
  list(): Promise<readonly PersistedReviewWakeIntent[]>
  /** The file path of one latch's row (diagnostics). */
  pathFor(key: ReviewWakeKey): string
  /**
   * The durable Sticky Stop marker for one latch. It is a small presence
   * file BESIDE the intent row (not a second approval ledger): `true` means a
   * trusted user Stop outranks any persisted wake, and only an explicit
   * resume interaction clears it. A missing marker is `false`.
   */
  /** The marker path (diagnostics / tests). */
  stoppedPathFor(key: ReviewWakeKey): string
  isStopped(key: ReviewWakeKey): Promise<boolean>
  markStopped(key: ReviewWakeKey): Promise<void>
  clearStopped(key: ReviewWakeKey): Promise<void>
}

/** Stable FNV-1a hash of the latch identity; no clock, no randomness. */
function keyHash(key: ReviewWakeKey): string {
  const canonical = `${key.rootSessionId}\u001f${key.reviewerInstanceId}\u001f${String(key.sessionGeneration)}`
  let hash = 0x811c9dc5
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

export function createFileWakeIntentDirectory(directory: string): WakeIntentDirectory {
  return {
    pathFor(key) {
      return join(directory, `wake-${keyHash(key)}.json`)
    },
    stoppedPathFor(key: ReviewWakeKey) {
      return join(directory, `stopped-${keyHash(key)}.json`)
    },
    async isStopped(key) {
      try {
        await access(this.stoppedPathFor(key) as string)
        return true
      } catch {
        return false
      }
    },
    async markStopped(key) {
      await writeFile(this.stoppedPathFor(key) as string, '{"stopped":true}\n', 'utf8')
    },
    async clearStopped(key) {
      await rm(this.stoppedPathFor(key) as string, { force: true })
    },
    forKey(key) {
      return createFileWakeIntentStore({ filePath: this.pathFor(key) })
    },
    async list() {
      let names: string[]
      try {
        names = await readdir(directory)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
        throw error
      }
      const rows: PersistedReviewWakeIntent[] = []
      for (const name of names.filter((entry) => entry.startsWith('wake-') && entry.endsWith('.json')).sort()) {
        const row = await createFileWakeIntentStore({ filePath: join(directory, name) }).read()
        if (row !== null) rows.push(row)
      }
      return rows
    },
  }
}
