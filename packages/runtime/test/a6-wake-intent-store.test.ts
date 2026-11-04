/**
 * Alpha.6 — the file-backed wake-intent store implements the SAME narrow
 * port the crash-recovery protocol consumes: one row, queued -> accepted,
 * clear-by-wakeId, missing file = no intent, malformed = throw.
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createFileWakeIntentStore } from '../alpha6/wake-intent-store.js'

const KEY = {
  rootSessionId: 'session-root-wake-intent',
  reviewerInstanceId: 'inst-wakeintent',
  sessionGeneration: 0,
} as const

describe('A6 file wake-intent store', () => {
  let dir: string
  let file: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'a6-wake-intent-'))
    file = join(dir, 'nested', 'intent.json')
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('reads no intent before the first persist', async () => {
    const store = createFileWakeIntentStore({ filePath: file })
    await expect(store.read()).resolves.toBeNull()
  })

  it('persists a queued row and reads it back', async () => {
    const store = createFileWakeIntentStore({ filePath: file })
    await store.persistQueued({ key: KEY, wakeId: 'wake-1', workFingerprint: 'fp-1' })
    await expect(store.read()).resolves.toEqual({
      key: KEY,
      wakeId: 'wake-1',
      workFingerprint: 'fp-1',
      status: 'queued',
    })
  })

  it('marks the SAME wake accepted and ignores a different wakeId', async () => {
    const store = createFileWakeIntentStore({ filePath: file })
    await store.persistQueued({ key: KEY, wakeId: 'wake-1', workFingerprint: 'fp-1' })
    await store.markAccepted('wake-other')
    expect((await store.read())?.status).toBe('queued')
    await store.markAccepted('wake-1')
    expect((await store.read())?.status).toBe('accepted')
  })

  it('clears only the matching wakeId', async () => {
    const store = createFileWakeIntentStore({ filePath: file })
    await store.persistQueued({ key: KEY, wakeId: 'wake-1', workFingerprint: 'fp-1' })
    await store.clear('wake-other')
    expect(await store.read()).not.toBeNull()
    await store.clear('wake-1')
    expect(await store.read()).toBeNull()
  })

  it('writes valid JSON on disk and throws on a malformed row', async () => {
    const store = createFileWakeIntentStore({ filePath: file })
    await store.persistQueued({ key: KEY, wakeId: 'wake-1', workFingerprint: 'fp-1' })
    const parsed = JSON.parse(await readFile(file, 'utf8')) as { status: string }
    expect(parsed.status).toBe('queued')
    await writeFile(file, '{"nope":true}\n', 'utf8')
    await expect(store.read()).rejects.toThrow(/malformed/)
  })
})
