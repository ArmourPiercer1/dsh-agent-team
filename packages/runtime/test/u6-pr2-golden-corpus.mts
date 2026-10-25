/**
 * U6 PR2 review-r1 B4 — the golden-vector corpus as ONE generator, run
 * against TWO canonicalizers: the family-path `canonicalizeOperation` (the
 * shipped gate, u6-pr2-read-golden-vectors.test.ts) and the master-tree
 * canonicalizer loaded straight from a detached `origin/master` git worktree
 * (.artifacts/tmp/u6pr2-golden-master). Byte-identical output (full corpus
 * JSON, not just a spot list) is the R-REM-2.4 parity proof for the extended
 * classes: Unicode NFC/NFD, non-BMP, `..` escapes, `./` segments, trailing
 * slash, duplicate slashes, absolute inside/outside, symlink-name paths
 * (canonicalizer-only: the resolver DISCLOSES the alias effect — no fs).
 *
 * This module imports NOTHING at runtime (the canonicalizer is injected),
 * so the master worktree can import it cross-tree without a node_modules.
 */

export const MALFORMED_RESOLVER = async (path: string) => {
  if (path === 'boom') throw new Error('resolver exploded')
  if (path === 'emptykey') return { key: '', display: 'd' }
  if (path === 'baddisplay') return { key: 'k', display: 42 }
  // B4 symlink classes: the resolver answers with the TARGET's key — the
  // canonicalizer trusts the resolver (identity law); the fingerprint must
  // key on the disclosed target on BOTH paths, identically.
  if (path === 'alias') return { key: 'file:TARGET.txt', display: 'display:TARGET.txt' }
  if (path === 'symlink/target.txt') return { key: 'file:/outside/target.txt', display: 'display:/outside/target.txt' }
  return { key: `file:${path}`, display: `display:${path}` }
}

export const PATHS: readonly unknown[] = ['a.txt', '/abs/b.txt', 'sub/../c.txt', 'boom', 'emptykey', 'baddisplay']

/** B4 (review round 1): the path SHAPES the original 877-grid never fed.
 *  Every entry is a pure string class — no filesystem, no resolution. */
export const EXTRA_PATHS: readonly unknown[] = [
  'caf\u00E9.txt', // NFC precomposed é
  'cafe\u0301.txt', // NFD decomposing sequence
  '\u6587\u4EF6.txt', // non-ASCII BMP (CJK)
  '\u{1F600}.txt', // non-BMP (astral plane, surrogate pair in UTF-16)
  '../escape.txt', // leading `..`
  'a/../../b.txt', // `..` climbing past the start dir
  'deep/./x/././y.txt', // `./` segments mid-path
  './rel.txt', // leading `./`
  'dir/', // trailing slash
  'sub//double.txt', // duplicate slash
  '/root/deep/in.txt', // absolute inside the root
  '/etc/outside.txt', // absolute outside the root
  'alias', // symlink name: resolver discloses an in-root target
  'symlink/target.txt', // symlink name: resolver discloses an OUTSIDE target
]

export const WINDOW_VALUES: readonly (unknown | 'ABSENT')[] = ['ABSENT', 1, 5, 0, -1, 1.5, '3', null, 2000, 1000000, 1e21, true]

export type Vector = { readonly args: unknown; readonly out: unknown }
type Canonicalize = (input: {
  name: string
  arguments: Record<string, unknown>
  resolveTarget: unknown
}) => Promise<{ fingerprint: string; resource: unknown }>

export function buildCorpus(canonicalize: Canonicalize): Promise<Vector[]> {
  const resolver = MALFORMED_RESOLVER as unknown as (path: string) => Promise<unknown>
  const runVector = async (args: unknown): Promise<Vector> => {
    try {
      const op = await canonicalize({
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
  return (async () => {
    const vectors: Vector[] = []
    for (const bad of ['string-args', 42, null, undefined, true]) {
      vectors.push(await runVector(bad))
    }
    for (const fp of [{}, { limit: 5 }, { file_path: 7 }, { file_path: '' }, { file_path: null }, { FILE_PATH: 'a.txt' }]) {
      vectors.push(await runVector(fp))
    }
    for (const file_path of [...PATHS, ...EXTRA_PATHS]) {
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
  })()
}
