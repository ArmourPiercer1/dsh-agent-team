/**
 * U7-9a — the mutation-family golden corpus: ONE generator, run against
 * TWO canonicalizers exactly like the U6 PR2 read gate (the shipped
 * branch-path `canonicalizeOperation` and the master-tree canonicalizer
 * loaded from a detached `origin/master` git worktree). Byte-identical
 * output over the WHOLE corpus JSON is the CA-01 parity proof: the write/
 * edit/read_image canonical law is the CENTER's and this delivery does not
 * move it — the corpus pins that it did not MOVE and cannot silently
 * CHANGE, while the new family rows prove their parameter contract feeds
 * exactly that unchanged law.
 *
 * The path classes reuse the U6 PR2 corpus (one home for the adversarial
 * path grid: Unicode NFC/NFD, non-BMP, `..` escapes, `./`, trailing/double
 * slashes, absolute inside/outside, symlink-disclosing resolver names).
 *
 * This module imports NOTHING at runtime (the canonicalizer is injected),
 * so a master worktree can import it cross-tree without node_modules.
 *
 * @module packages/runtime/test/u7-9a-mutation-golden-corpus
 */
import { EXTRA_PATHS, MALFORMED_RESOLVER, PATHS } from './u6-pr2-golden-corpus.mjs'

export { MALFORMED_RESOLVER }
export type Vector = { readonly tool: string; readonly args: unknown; readonly out: unknown }

/** The write CONTENT classes: every shape the governed write row's law and
 *  the center's `extractWriteContent` must answer identically — the empty
 *  string is LEGAL (clears the file), a non-string refuses, an absent
 *  field refuses, the 1 MiB-cap class is a FAMILY deployment law (the
 *  canonicalizer stays cap-free — the row refuses above cap, which is
 *  pinned in the C1 suite, not by the digest). */
export const WRITE_CONTENTS: readonly (unknown | 'ABSENT')[] = [
  'ABSENT',
  '',
  'x',
  'multi\nline\ntext\n',
  'caf\u00E9 \u6587\u4EF6 \u{1F600}',
  'binary-ish\u0000\u0001\u0002content',
  'a'.repeat(4096),
  'tab\tsep',
  42,
  null,
  true,
  {},
]

/** The edit OLD/NEW field classes (matched cross-product capped below):
 *  empty old (refused), identical pair (refused), multiline/unicode/emoji,
 *  the delete-to-empty form (new ''), non-string shapes. */
export const EDIT_OLDS: readonly (unknown | 'ABSENT')[] = ['ABSENT', '', 'a', 'a\nb', 'caf\u00E9', 'x'.repeat(256), 7, null]
export const EDIT_NEW: readonly (unknown | 'ABSENT')[] = ['ABSENT', '', 'b', 'a\nb', 'caf\u00E9\u4F53', 'y'.repeat(64), 7, null]
export const EDIT_REPLACE_ALL: readonly (unknown | 'ABSENT')[] = ['ABSENT', true, false, 'yes', null, 1]

type Canonicalize = (input: {
  name: string
  arguments: Record<string, unknown>
  resolveTarget: unknown
}) => Promise<{ fingerprint: string; resource: unknown }>

function withField(args: Record<string, unknown>, key: string, value: unknown | 'ABSENT'): void {
  if (value !== 'ABSENT') args[key] = value
}

async function runVector(canonicalize: Canonicalize, tool: string, args: unknown): Promise<Vector> {
  const resolver = MALFORMED_RESOLVER as unknown as (path: string) => Promise<unknown>
  try {
    const op = await canonicalize({ name: tool, arguments: args as Record<string, unknown>, resolveTarget: resolver })
    return { tool, args, out: { ok: { fingerprint: op.fingerprint, resource: op.resource } } }
  } catch (error) {
    const e = error as { code?: unknown; details?: unknown; message?: unknown }
    return {
      tool,
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

/** The full grid: write = (all paths) x (all content classes) + malformed
 *  argument shapes; edit = (all paths) x (old x new x replace_all) with
 *  the field-presence classes; read_image = (all paths) (the canonical
 *  projection is resourceKey-only). Deterministic order, JSON-stable. */
export async function buildMutationCorpus(canonicalize: Canonicalize): Promise<Vector[]> {
  const vectors: Vector[] = []
  // Malformed-argument shapes shared by every tool (non-object args ride
  // the canonicalizer's own argument law).
  const malformed: readonly unknown[] = [null, 'string-args', [], { content: 'x' }, { old_string: 'a', new_string: 'b' }, { file_path: '' }, { file_path: 42 }, { file_path: null }]
  for (const bad of malformed) {
    vectors.push(await runVector(canonicalize, 'write', bad))
    vectors.push(await runVector(canonicalize, 'edit', bad))
    vectors.push(await runVector(canonicalize, 'read_image', bad))
  }
  // read_image: resourceKey-only projection over every path class.
  for (const path of [...PATHS, ...EXTRA_PATHS]) {
    vectors.push(await runVector(canonicalize, 'read_image', { file_path: path }))
  }
  vectors.push(await runVector(canonicalize, 'read_image', { file_path: 'a.txt', extra: 'ignored-by-projection' }))
  // write: every path x every content class.
  for (const path of [...PATHS, ...EXTRA_PATHS]) {
    for (const content of WRITE_CONTENTS) {
      const args: Record<string, unknown> = { file_path: path }
      withField(args, 'content', content)
      vectors.push(await runVector(canonicalize, 'write', args))
    }
  }
  // write: extra parameter classes (the canonicalizer ignores extras; the
  // governed row refuses them — the divergence is a STRICTER family law,
  // pinned in C1, never a digest difference).
  vectors.push(await runVector(canonicalize, 'write', { file_path: 'a.txt', content: 'x', sandbox_permissions: 'danger-full-access' }))
  vectors.push(await runVector(canonicalize, 'write', { file_path: 'a.txt', content: 'x', justification: 'because' }))
  // edit: path x old x new x replace_all (paths restricted to a 3-class
  // slice to keep the cross-product honest-size; the path law is shared
  // with write/read_image and fully pinned there).
  const editPaths = ['a.txt', 'caf\u00E9.txt', 'boom']
  for (const path of editPaths) {
    for (const oldString of EDIT_OLDS) {
      for (const newString of EDIT_NEW) {
        for (const replaceAll of EDIT_REPLACE_ALL) {
          const args: Record<string, unknown> = { file_path: path }
          withField(args, 'old_string', oldString)
          withField(args, 'new_string', newString)
          withField(args, 'replace_all', replaceAll)
          vectors.push(await runVector(canonicalize, 'edit', args))
        }
      }
    }
  }
  // edit: extras (same disclosure class as write).
  vectors.push(await runVector(canonicalize, 'edit', { file_path: 'a.txt', old_string: 'a', new_string: 'b', sandbox_permissions: 'x' }))
  return vectors
}
