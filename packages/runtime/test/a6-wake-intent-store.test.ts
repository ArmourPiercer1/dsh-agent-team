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
import { createFileWakeIntentDirectory } from '../alpha6/wake-intent-directory.js'
import { recoverReviewWake } from '../alpha6/wake-intent.js'
import { createReviewWakeCoordinator } from '../review-wake/index.js'

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

describe('A6 file intent store + recovery', () => {
  let dir: string
  let file: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'a6-wake-recover-'))
    file = join(dir, 'intent.json')
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('adopts a queued row ONLY while the native Inbox still holds it', async () => {
    const store = createFileWakeIntentStore({ filePath: file })
    await store.persistQueued({ key: KEY, wakeId: 'wake-live', workFingerprint: 'fp-1' })
    const coordinator = createReviewWakeCoordinator(KEY)
    const adopted = await recoverReviewWake(coordinator, store, { has: () => true })
    expect(adopted.adopted).toBe(true)
    expect(coordinator.state.status).toBe('queued')
    expect((await store.read())?.status).toBe('accepted')
  })

  it('reports absent without clearing a row whose Inbox message is gone', async () => {
    const store = createFileWakeIntentStore({ filePath: file })
    await store.persistQueued({ key: KEY, wakeId: 'wake-gone', workFingerprint: 'fp-1' })
    const coordinator = createReviewWakeCoordinator(KEY)
    const adopted = await recoverReviewWake(coordinator, store, { has: () => false })
    expect(adopted.adopted).toBe(false)
    expect(adopted.reason).toBe('absent')
    // The caller re-plans and overwrites this stale row. Recovery must not
    // await a clear here: that window could delete a row a concurrent
    // dispatch just persisted.
    await expect(store.read()).resolves.not.toBeNull()
  })
})

describe('A6 sharded wake-intent directory', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'a6-wake-shards-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('keeps two latches independent and enumerates both rows', async () => {
    const directory = createFileWakeIntentDirectory(dir)
    const second = { ...KEY, reviewerInstanceId: 'inst-second' }
    await directory.forKey(KEY).persistQueued({ key: KEY, wakeId: 'wake-a', workFingerprint: 'fp-a' })
    await directory.forKey(second).persistQueued({
      key: second,
      wakeId: 'wake-b',
      workFingerprint: 'fp-b',
    })
    const rows = await directory.list()
    expect(rows.map((row) => row.wakeId).sort()).toEqual(['wake-a', 'wake-b'])
    await directory.forKey(KEY).clear('wake-a')
    expect(await directory.forKey(KEY).read()).toBeNull()
    expect((await directory.forKey(second).read())?.wakeId).toBe('wake-b')
  })

  it('returns no rows for a directory that does not exist yet', async () => {
    const directory = createFileWakeIntentDirectory(join(dir, 'missing'))
    await expect(directory.list()).resolves.toEqual([])
  })
})

describe('A6 file wake-intent store — concurrent writers', () => {
  it('serializes markAccepted/clear/persist: a newer row is never clobbered by an older accepted mark', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'a6-wake-intent-mix-'))
    try {
      const store = createFileWakeIntentStore({ filePath: join(dir, 'intent.json') })
      await store.persistQueued({ key: KEY, wakeId: 'wake-1', workFingerprint: 'fp-1' })
      await Promise.all([
        store.markAccepted('wake-1'),
        store.clear('wake-1'),
        store.persistQueued({ key: KEY, wakeId: 'wake-2', workFingerprint: 'fp-2' }),
      ])
      const row = await store.read()
      expect(row).toMatchObject({ wakeId: 'wake-2', workFingerprint: 'fp-2', status: 'queued' })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('never shares a temp file: 24 concurrent persists settle with one intact row', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'a6-wake-intent-race-'))
    try {
      const store = createFileWakeIntentStore({ filePath: join(dir, 'intent.json') })
      await Promise.all(
        Array.from({ length: 24 }, (_, i) =>
          store.persistQueued({ key: KEY, wakeId: `wake-${String(i)}`, workFingerprint: `fp-${String(i)}` }),
        ),
      )
      const row = await store.read()
      expect(row).not.toBeNull()
      expect(row!.wakeId).toMatch(/^wake-[0-9]+$/)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
