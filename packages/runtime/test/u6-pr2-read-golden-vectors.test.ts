/**
 * U6 PR2 — THE GOLDEN-VECTOR GATE (mandatory; the slice plan's stop
 * condition): the FS family's canonicalization pipeline must reproduce
 * master's `canonicalizeOperation('read', …)` output BYTE-IDENTICALLY over a
 * pinned argument corpus — the 877-vector grid (degenerate args × file_path
 * shapes × offset/limit value grid) recorded from master @ 2db321f63 BEFORE
 * the `case 'read'` projection moved to
 * `packages/tools/fs-family/src/read-normalizer.ts`.
 *
 * WHY THIS EXISTS: durable grants and durable rules are keyed by the
 * operation fingerprint. If the move had shifted the projection by one byte
 * (or the A2C-5 identity — omitted `limit` → null, NOT the 2000 constant —
 * had drifted), every existing durable read approval would silently address
 * a different operation. The corpus covers the whole surface: every error
 * reason the read path can answer (`file-path-*`, `read-offset-invalid`,
 * `read-limit-invalid`, `resolver-threw`, `resolver-key-empty`,
 * `resolver-result-malformed`) plus the success fingerprints.
 *
 * The gate is the FULL digest of the regenerated corpus (JSON.stringify of
 * the vector array, same construction as the master recording) — one pinned
 * hex ties 877 outputs byte-for-byte — plus readable spot vectors so a
 * failure names the shape that moved.
 */
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { canonicalizeOperation } from '../operation-permission/canonical-operation.js'
import type { PathTargetResolver } from '../operation-permission/types.js'
import { normalizeReadProjection } from '../../tools/fs-family/src/read-normalizer.js'

/** Recorded from master @ 2db321f63 before the move (see
 *  dev/agent-workflow/evidence/u6-pr2-20261025/golden-vectors-*). */
const MASTER_CORPUS_DIGEST = '7fbb3ab9ae48451fc8ab41489491dfcf4d0420bfaa0f596dd09c949124a7987c'
const MASTER_VECTOR_COUNT = 877

const MALFORMED_RESOLVER = async (path: string) => {
  if (path === 'boom') throw new Error('resolver exploded')
  if (path === 'emptykey') return { key: '', display: 'd' }
  if (path === 'baddisplay') return { key: 'k', display: 42 }
  return { key: `file:${path}`, display: `display:${path}` }
}
// The corpus DELIBERATELY feeds resolver results the typed seam forbids
// (`display: 42`, empty `key`) — the canonicalizer must still answer the
// closed typed refusals for them. The cast crosses from that adversarial
// shape into the seam's typed face; runtime behavior is unchanged.
const resolver = MALFORMED_RESOLVER as unknown as PathTargetResolver

const PATHS: readonly unknown[] = ['a.txt', '/abs/b.txt', 'sub/../c.txt', 'boom', 'emptykey', 'baddisplay']
const WINDOW_VALUES: readonly (unknown | 'ABSENT')[] = ['ABSENT', 1, 5, 0, -1, 1.5, '3', null, 2000, 1000000, 1e21, true]

type Vector = { readonly args: unknown; readonly out: unknown }

async function runVector(args: unknown): Promise<Vector> {
  try {
    const op = await canonicalizeOperation({
      name: 'read',
      arguments: args as Record<string, unknown>,
      resolveTarget: resolver,
    })
    return { args, out: { ok: { fingerprint: op.fingerprint, resource: op.resource } } }
  } catch (error) {
    const e = error as { code?: unknown; details?: unknown; message?: unknown }
    return {
      args,
      out: {
        err: {
          code: e.code ?? null,
          details: JSON.parse(JSON.stringify(e.details ?? null)),
          message: String(e.message ?? '').slice(0, 200),
        },
      },
    }
  }
}

async function buildCorpus(): Promise<Vector[]> {
  const vectors: Vector[] = []
  for (const bad of ['string-args', 42, null, undefined, true]) {
    vectors.push(await runVector(bad))
  }
  for (const fp of [{}, { limit: 5 }, { file_path: 7 }, { file_path: '' }, { file_path: null }, { FILE_PATH: 'a.txt' }]) {
    vectors.push(await runVector(fp))
  }
  for (const file_path of PATHS) {
    for (const offset of WINDOW_VALUES) {
      for (const limit of WINDOW_VALUES) {
        const args: Record<string, unknown> = { file_path }
        if (offset !== 'ABSENT') args['offset'] = offset
        if (limit !== 'ABSENT') args['limit'] = limit
        vectors.push(await runVector(args))
      }
    }
  }
  for (const extra of [{ file_path: 'a.txt', extra: 'x' }, { file_path: 'a.txt', offset: 2, limit: 3, path: 'zzz' }]) {
    vectors.push(await runVector(extra))
  }
  return vectors
}

describe('u6-pr2 golden vectors: the moved read projection reproduces master byte-for-byte', () => {
  it('corpus digest (877 vectors: fingerprints + typed-error details) equals the master recording', async () => {
    const corpus = await buildCorpus()
    expect(corpus.length).toBe(MASTER_VECTOR_COUNT)
    const digest = createHash('sha256').update(JSON.stringify(corpus), 'utf8').digest('hex')
    expect(digest).toBe(MASTER_CORPUS_DIGEST)
  })

  it('A2C-5 identity survives the move: omitted limit is null, offset defaults to 1', async () => {
    const bare = await canonicalizeOperation({ name: 'read', arguments: { file_path: 'a.txt' }, resolveTarget: resolver })
    const capped = await canonicalizeOperation({ name: 'read', arguments: { file_path: 'a.txt', limit: 2000 }, resolveTarget: resolver })
    const explicit1 = await canonicalizeOperation({ name: 'read', arguments: { file_path: 'a.txt', offset: 1 }, resolveTarget: resolver })
    // (offset 1, limit null) is the omitted-limit identity — DISTINCT from
    // any explicit limit, IDENTICAL to an explicit offset:1 (pinned pre-move).
    expect(bare.fingerprint).toBe(explicit1.fingerprint)
    expect(bare.fingerprint).not.toBe(capped.fingerprint)
    expect(bare.fingerprint.startsWith('sha256:')).toBe(true)
  })

  it('the family normalizer answers exactly the two closed window reasons (raw value as data)', () => {
    expect(normalizeReadProjection('read', { file_path: 'a.txt', offset: 0 })).toEqual({
      ok: false, reason: 'read-offset-invalid', value: 0,
    })
    expect(normalizeReadProjection('read', { limit: '3' })).toEqual({
      ok: false, reason: 'read-limit-invalid', value: '3',
    })
    expect(normalizeReadProjection('read', {})).toEqual({
      ok: true,
      projection: { tool: 'read', resourceKey: '', offset: 1, limit: null },
    })
  })

  it('the authority maps the family failure into the SAME typed error master threw (details byte-equal)', async () => {
    const shapes: readonly Record<string, unknown>[] = [
      { file_path: 'a.txt', offset: null },
      { file_path: 'a.txt', offset: -1, limit: 1.5 },
      { file_path: 'a.txt', limit: true },
    ]
    const errors: unknown[] = []
    for (const args of shapes) {
      try {
        await canonicalizeOperation({ name: 'read', arguments: args, resolveTarget: resolver })
        errors.push(null)
      } catch (error) {
        const e = error as { code?: unknown; details?: unknown }
        errors.push({ code: e.code ?? null, details: JSON.parse(JSON.stringify(e.details ?? null)) })
      }
    }
    // Verbatim master shapes (recorded pre-move): same closed code, same
    // reason, same sanitized value — the family normalizer adds nothing.
    expect(errors).toEqual([
      { code: 'OPERATION_CANONICALIZATION_FAILED', details: { tool: 'read', reason: 'read-offset-invalid', value: null } },
      { code: 'OPERATION_CANONICALIZATION_FAILED', details: { tool: 'read', reason: 'read-offset-invalid', value: -1 } },
      { code: 'OPERATION_CANONICALIZATION_FAILED', details: { tool: 'read', reason: 'read-limit-invalid', value: true } },
    ])
  })
})
