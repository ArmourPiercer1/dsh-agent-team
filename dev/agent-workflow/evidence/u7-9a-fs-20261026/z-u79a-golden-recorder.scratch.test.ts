/**
 * U7-9a golden RECORDER (scratch — runs once at authoring, output recorded
 * into dev/agent-workflow/evidence/u7-9a-fs-20261026/ and into the pinned
 * vectors test): the mutation corpus over TWO canonicalizers —
 *   (a) the branch code (this checkout), and
 *   (b) the master code at origin/master @ 496a3980f, loaded live from the
 *       detached worktree `.artifacts/tmp/u79a-golden-master`.
 * Byte-identical corpus JSON = the CA-01 parity receipt (the write/edit/
 * read_image canonical law is the center's, and this delivery moved
 * nothing). The pinned test `u7-9a-mutation-golden-vectors.test.ts` then
 * guards the digest against any future drift.
 *
 * Not part of the shipped suite (`.scratch.test.ts` is excluded by the
 * vitest include pattern; it exists to produce the receipt).
 */
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { canonicalizeOperation as branchCanonicalize } from '../operation-permission/canonical-operation.js'
import { buildMutationCorpus } from './u7-9a-mutation-golden-corpus.mjs'

const MASTER = '/srv/workspace/dsh-plugins/dsh-agent-team/.artifacts/tmp/u79a-golden-master/packages/runtime/operation-permission/canonical-operation.ts'

describe('u7-9a golden recorder (scratch)', () => {
  it('branch vs origin/master corpus is byte-identical; prints the digest', async () => {
    const { canonicalizeOperation: masterCanonicalize } = await import(MASTER)
    type Canon = Parameters<typeof buildMutationCorpus>[0]
    const branchCorpus = await buildMutationCorpus(branchCanonicalize as unknown as Canon)
    const masterCorpus = await buildMutationCorpus(masterCanonicalize as unknown as Canon)
    const branchJson = JSON.stringify(branchCorpus)
    const masterJson = JSON.stringify(masterCorpus)
    expect(branchJson.length).toBeGreaterThan(100_000)
    expect(branchCorpus.length).toBe(masterCorpus.length)
    // The honest cross-tree compare: full JSON, not a spot list.
    expect(branchJson).toBe(masterJson)
    const digest = createHash('sha256').update(branchJson, 'utf8').digest('hex')
    // eslint-disable-next-line no-console
    console.log(`U79A_GOLDEN vectors=${String(branchCorpus.length)} digest=${digest}`)
  }, 120_000)
})
