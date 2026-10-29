/**
 * SCRATCH (U6 PR2, golden-vector recorder) — deleted after recording.
 * Records master's canonicalizeOperation('read', …) behavior over the
 * pinned corpus to .artifacts/tmp/u6pr2-read/golden-vectors.json BEFORE
 * any canonicalizer surgery. Not a shipped suite.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { canonicalizeOperation } from '../operation-permission/canonical-operation.js'

const resolver = async (path: string) => {
  if (path === 'boom') throw new Error('resolver exploded')
  if (path === 'emptykey') return { key: '', display: 'd' }
  if (path === 'baddisplay') return { key: 'k', display: 42 }
  return { key: `file:${path}`, display: `display:${path}` }
}

const PATHS: readonly unknown[] = ['a.txt', '/abs/b.txt', 'sub/../c.txt', 'boom', 'emptykey', 'baddisplay']
const WINDOW_VALUES: readonly (unknown | 'ABSENT')[] = ['ABSENT', 1, 5, 0, -1, 1.5, '3', null, 2000, 1000000, 1e21, true]

type Vector = { readonly args: unknown; readonly out: unknown }
const vectors: Vector[] = []

function record(args: unknown, out: unknown): void {
  vectors.push({ args, out })
}

async function runVector(args: unknown): Promise<void> {
  try {
    const op = await canonicalizeOperation({ name: 'read', arguments: args as Record<string, unknown>, resolveTarget: resolver })
    record(args, { ok: { fingerprint: op.fingerprint, resource: op.resource } })
  } catch (error) {
    const e = error as { code?: unknown; details?: unknown; message?: unknown }
    record(args, {
      err: {
        code: e.code ?? null,
        details: JSON.parse(JSON.stringify(e.details ?? null)),
        message: String(e.message ?? '').slice(0, 200),
      },
    })
  }
}

describe('u6-pr2 golden-vector recorder (scratch)', () => {
  it('records master read behavior over the pinned corpus', async () => {
    // degenerate argument shapes FIRST (they terminate before the window)
    for (const bad of ['string-args', 42, null, undefined, true]) {
      await runVector(bad)
    }
    // missing / malformed file_path
    for (const fp of [{}, { limit: 5 }, { file_path: 7 }, { file_path: '' }, { file_path: null }, { FILE_PATH: 'a.txt' }]) {
      await runVector(fp)
    }
    // path × offset × limit grid
    for (const file_path of PATHS) {
      for (const offset of WINDOW_VALUES) {
        for (const limit of WINDOW_VALUES) {
          const args: Record<string, unknown> = { file_path }
          if (offset !== 'ABSENT') args['offset'] = offset
          if (limit !== 'ABSENT') args['limit'] = limit
          await runVector(args)
        }
      }
    }
    // extra unknown fields ride through (projection ignores them) — pinned
    for (const extra of [{ file_path: 'a.txt', extra: 'x' }, { file_path: 'a.txt', offset: 2, limit: 3, path: 'zzz' }]) {
      await runVector(extra)
    }
    mkdirSync('.artifacts/tmp/u6pr2-read', { recursive: true })
    writeFileSync('.artifacts/tmp/u6pr2-read/golden-vectors.json', JSON.stringify(vectors, null, 1))
    expect(vectors.length).toBeGreaterThan(600)
  })
})
