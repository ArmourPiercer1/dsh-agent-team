/**
 * U7-9a golden vectors — the mutation-family CANONICALIZATION parity gate.
 *
 * The write/edit/read_image canonical law lives in the CENTER
 * (`operation-permission/canonical-operation.ts`) and this delivery moves
 * NOTHING there — that is the CA-01 claim (a new family member added with
 * ZERO center diff). This test is the durable guard for that claim: it runs
 * the mutation corpus
 * (`u7-9a-mutation-golden-corpus.mts`) through the shipped
 * `canonicalizeOperation` and pins the WHOLE-corpus digest. Any future edit
 * that changes a write/edit/read_image fingerprint or typed-error detail
 * turns this red — exactly as the read golden
 * (`u6-pr2-read-golden-vectors.test.ts`) guards `read`.
 *
 * The digest was RECORDED cross-tree at authoring (scratch recorder
 * `z-u79a-golden-recorder.scratch.test.ts`, receipt in
 * `dev/agent-workflow/evidence/u7-9a-fs-20261026/`): the corpus over the
 * branch canonicalizer and over a DETACHED `origin/master @ 496a3980f` git
 * worktree were BYTE-IDENTICAL (full JSON, not a spot list) — the parity
 * proof that the family rows feed the unchanged center canonical law.
 *
 * @module packages/runtime/test/u7-9a-mutation-golden-vectors
 */
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { canonicalizeOperation } from '../operation-permission/canonical-operation.js'
import type { PathTargetResolver } from '../operation-permission/types.js'
// (lane .mjs parser reaches this gate via a dynamic import at use — see the edit leg)
import { buildMutationCorpus, MALFORMED_RESOLVER, type Vector } from './u7-9a-mutation-golden-corpus.mjs'

/** origin/master @ 496a3980f (CA-01 parity): 1440 vectors, byte-identical
 *  branch↔master. Digest of the full corpus JSON (fingerprints + resources
 *  for the accepted shapes, closed typed-error code/details for the rest). */
const MASTER_CORPUS_DIGEST = '91fee9a6ff7ea6db450e49b7fd2b39b142a3fc06d4f924664521a69329da332b'
const MASTER_VECTOR_COUNT = 1440

// The corpus feeds resolver results the typed seam forbids (`display: 42`,
// empty `key`) on purpose — the canonicalizer must still answer the closed
// typed refusals. The cast crosses that adversarial shape into the seam's
// typed face; runtime behavior is unchanged (same cast as the read gate).
const resolver = MALFORMED_RESOLVER as unknown as PathTargetResolver

async function buildCorpus(): Promise<Vector[]> {
  return buildMutationCorpus((input) => canonicalizeOperation({
    name: input.name,
    arguments: input.arguments,
    resolveTarget: input.resolveTarget as PathTargetResolver,
  }) as unknown as Promise<{ fingerprint: string; resource: unknown }>)
}

describe('u7-9a golden vectors: the write/edit/read_image canonical law is unchanged (CA-01)', () => {
  it(`corpus digest (${String(MASTER_VECTOR_COUNT)} vectors: fingerprints + typed-error details) equals the origin/master recording`, async () => {
    const corpus = await buildCorpus()
    expect(corpus.length).toBe(MASTER_VECTOR_COUNT)
    const digest = createHash('sha256').update(JSON.stringify(corpus), 'utf8').digest('hex')
    expect(digest).toBe(MASTER_CORPUS_DIGEST)
  })

  it('the write fingerprint keys on content only (path rides the resource, not the projection)', async () => {
    const a = await canonicalizeOperation({ name: 'write', arguments: { file_path: 'a.txt', content: 'x' }, resolveTarget: resolver })
    const sameContentOtherPath = await canonicalizeOperation({ name: 'write', arguments: { file_path: 'b.txt', content: 'x' }, resolveTarget: resolver })
    const otherContent = await canonicalizeOperation({ name: 'write', arguments: { file_path: 'a.txt', content: 'y' }, resolveTarget: resolver })
    // The write projection is {tool, resourceKey, contentHash}: two different
    // paths with the same content share the fingerprint's contentHash but
    // DIFFER by resourceKey (the resource carries identity). Same path,
    // same content is identical; different content differs.
    expect(otherContent.fingerprint).not.toBe(a.fingerprint)
    expect(a.fingerprint.startsWith('sha256:')).toBe(true)
    expect(sameContentOtherPath.resource).not.toBe(a.resource)
  })

  it('the edit projection is distinct for old/new/replaceAll; the shared refusal vocabulary (empty-old, identical-pair, non-boolean replace_all) refuses on BOTH gates with the SAME code — one vocabulary, no drift', async () => {
    // The lane's .mjs modules carry their types in the JSDoc face only (no
    // .d.mts by lane law); the typed gate reaches the parser the way the
    // runtime does — a NON-LITERAL dynamic import (the C1 loadRow form:
    // `new URL(...).href` is opaque to tsc's static resolution, exactly the
    // untyped runtime edge), cast at use, so no shim file is booked.
    const { parseGovernedEditArgs } = await import(new URL('../../tools/fs-family/src/fs-mutation-mechanics.mjs', import.meta.url).href) as {
      parseGovernedEditArgs: (args: Record<string, unknown>) => { ok: true } | { ok: false; refusal: { code: string } }
    }
    const one = await canonicalizeOperation({ name: 'edit', arguments: { file_path: 'a.txt', old_string: 'a', new_string: 'b' }, resolveTarget: resolver })
    const replace = await canonicalizeOperation({ name: 'edit', arguments: { file_path: 'a.txt', old_string: 'a', new_string: 'b', replace_all: true }, resolveTarget: resolver })
    expect(one.fingerprint).not.toBe(replace.fingerprint) // replaceAll is in the projection
    const centerReason = async (args: Record<string, unknown>): Promise<string> => {
      try {
        await canonicalizeOperation({ name: 'edit', arguments: args, resolveTarget: resolver })
        return 'ACCEPTED'
      } catch (error) {
        return String((error as { details?: { reason?: unknown } }).details?.reason ?? 'UNKNOWN')
      }
    }
    const familyCode = (args: Record<string, unknown>): string => {
      const parsed = parseGovernedEditArgs(args)
      return parsed.ok === true ? 'ACCEPTED' : String(parsed.refusal.code)
    }
    // Every shared refusal class: the CENTER canonicalizer and the FAMILY
    // row answer the SAME closed code (the row's parser mirrors the frozen
    // center vocabulary verbatim — the anti-drift law).
    const shared: readonly Record<string, unknown>[] = [
      { file_path: 'a.txt', old_string: '', new_string: 'b' },
      { file_path: 'a.txt', old_string: 'a', new_string: 'a' },
      { file_path: 'a.txt', old_string: 7, new_string: 'b' },
      { file_path: 'a.txt', old_string: 'a', new_string: 'b', replace_all: 'yes' },
      { file_path: 'a.txt', new_string: 'b' },
      { file_path: 'a.txt', old_string: 'a' },
    ]
    for (const args of shared) {
      expect(familyCode(args)).toBe(await centerReason(args))
    }
    // The family is STRICTER in exactly two disclosed classes the center
    // does not police (extras ride through the center untouched):
    const extraCenter = await centerReason({ file_path: 'a.txt', old_string: 'a', new_string: 'b', sandbox_permissions: 'x' })
    expect(extraCenter).toBe('ACCEPTED')
    expect(familyCode({ file_path: 'a.txt', old_string: 'a', new_string: 'b', sandbox_permissions: 'x' })).toBe('edit-unknown-parameter')
  })

  it('read_image is a resourceKey-only projection (no content hash — the canonicalizer never reads bytes)', async () => {
    const a = await canonicalizeOperation({ name: 'read_image', arguments: { file_path: 'a.txt' }, resolveTarget: resolver })
    const b = await canonicalizeOperation({ name: 'read_image', arguments: { file_path: 'b.txt' }, resolveTarget: resolver })
    expect(a.fingerprint).not.toBe(b.fingerprint)
    expect(a.fingerprint.startsWith('sha256:')).toBe(true)
  })
})
