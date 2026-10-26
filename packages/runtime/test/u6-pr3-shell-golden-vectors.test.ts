/**
 * U6 PR3 — THE GOLDEN-VECTOR GATE (the slice plan's stop condition, the PR2
 * precedent): the process family's canonicalization pipeline must reproduce
 * master's `canonicalizeOperation('bash' | 'pwsh', …)` output
 * BYTE-IDENTICALLY over a pinned argument corpus.
 *
 * The corpus (generator: `u6-pr3-golden-corpus.mts`, canonicalizer
 * INJECTED, zero imports — the same one generator ran against BOTH
 * canonicalizers): 299 vectors over the shell-class surface —
 *   - quoting (single/double/backtick/`$()`/`${}`, unbalanced forms),
 *   - unicode (NFC/NFD, CJK, astral, RTL, zero-width, NBSP),
 *   - env-assignment prefixes, pipes / AND-OR / redirects / heredoc /
 *     backslash-continuation / comments,
 *   - very long commands (64KiB token, 256KiB command — hashed, never
 *     parsed), control characters, newlines/CR/tab,
 *   - cwd variants (omitted/'.'/blank/relative/absolute/`..`/unicode +
 *     resolver-hostile shapes: threw / empty key / malformed display /
 *     symlink-disclosed target),
 *   - every effect field's type edge (timeoutMs, run_in_background,
 *     sandbox_permissions), unknown-field passthrough,
 *   - record adversarial shapes and the extractor's missing-command law,
 *   - the `bash`/`pwsh` tool-level separation on identical args,
 *   - and the out-of-vocabulary spellings (an alias name is NEVER
 *     shell-canonicalized by the authority — the A2 frozen vocabulary).
 *
 * WHY THIS EXISTS: durable grants and durable rules are keyed by the
 * operation fingerprint. A projection byte (or a detail shape of a closed
 * refusal) that drifts silently re-addresses every existing durable shell
 * approval. The family path (`normalizeShellProjection` + the authority's
 * fingerprint over the returned fields,
 * `canonicalizeShellOperation`) is what this gate pins against the master
 * recording made from the DETACHED `origin/master` worktree @ cd54f3b7c
 * BEFORE `extractShellCommand`/`extractShellEffects` moved —
 * dev/agent-workflow/evidence/u6-pr3-20261026/golden-vectors-master.json.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { canonicalizeOperation } from '../operation-permission/canonical-operation.js'
import type { PathTargetResolver } from '../operation-permission/types.js'
import { normalizeShellProjection } from '../../tools/process-family/src/bash-normalizer.js'
import { buildCorpus, MALFORMED_RESOLVER, type Vector } from './u6-pr3-golden-corpus.mjs'

/** Master @ cd54f3b7c (pre-move; detached-worktree recording): 299 vectors
 *  (154 ok fingerprints / 145 closed refusals). FULL-CORPUS equality is
 *  additionally pinned against the recorded JSON file below. */
const MASTER_CORPUS_DIGEST = 'efb096a6140530d913ab2b5483d59c981843aa4b57e599fac451c93ae1d02964'
const MASTER_VECTOR_COUNT = 299

// The corpus DELIBERATELY feeds resolver results the typed seam forbids
// (`display: 42`, empty `key`) — the canonicalizer must still answer the
// closed typed refusals for them. The cast crosses from that adversarial
// shape into the seam's typed face; runtime behavior is unchanged.
const resolver = MALFORMED_RESOLVER as unknown as PathTargetResolver

async function buildFamilyCorpus(): Promise<Vector[]> {
  return buildCorpus((input) => canonicalizeOperation({
    name: input.name,
    arguments: input.arguments,
    resolveTarget: input.resolveTarget as PathTargetResolver,
  }) as unknown as Promise<{ fingerprint: string; resource: unknown; workdirDisplay?: unknown }>)
}

describe('u6-pr3 golden vectors: the moved shell projection reproduces master byte-for-byte', () => {
  it('corpus digest (299 vectors: fingerprints + resource + workdirDisplay + typed-error details) equals the master recording', async () => {
    const corpus = await buildFamilyCorpus()
    expect(corpus.length).toBe(MASTER_VECTOR_COUNT)
    const digest = createHash('sha256').update(JSON.stringify(corpus), 'utf8').digest('hex')
    expect(digest).toBe(MASTER_CORPUS_DIGEST)
  })

  it('the regenerated corpus is byte-equal to the recorded master JSON (not just digest-equal)', async () => {
    const corpus = await buildFamilyCorpus()
    // (the `.href`-string pattern of u6-pr2-review-r1.test.ts: this
    // tsconfig's URL global is untyped-ish; fileURLToPath takes the string.)
    const recorded = readFileSync(
      fileURLToPath(new URL('../../../dev/agent-workflow/evidence/u6-pr3-20261026/golden-vectors-master.json', import.meta.url).href),
      'utf8',
    )
    expect(JSON.stringify(corpus, null, 1)).toBe(recorded)
  })

  it('the shell-class separation survives: identical args, different tools, different fingerprints', async () => {
    const viaBash = await canonicalizeOperation({ name: 'bash', arguments: { command: 'echo hi' }, resolveTarget: resolver })
    const viaPwsh = await canonicalizeOperation({ name: 'pwsh', arguments: { command: 'echo hi' }, resolveTarget: resolver })
    expect(viaBash.fingerprint).not.toBe(viaPwsh.fingerprint)
    expect(viaBash.resource).toEqual({ kind: 'tool', key: 'bash', display: 'bash' })
    expect(viaPwsh.resource.key).toBe('pwsh')
    expect(viaBash.fingerprint.startsWith('sha256:')).toBe(true)
  })

  it('the opaque-command law survives: the command is hashed VERBATIM (no parsing, no trimming)', async () => {
    const plain = await canonicalizeOperation({ name: 'bash', arguments: { command: 'echo hi' }, resolveTarget: resolver })
    const trailing = await canonicalizeOperation({ name: 'bash', arguments: { command: 'echo hi   ' }, resolveTarget: resolver })
    expect(plain.fingerprint).not.toBe(trailing.fingerprint)
    const nfc = await canonicalizeOperation({ name: 'bash', arguments: { command: 'echo caf\u00E9' }, resolveTarget: resolver })
    const nfd = await canonicalizeOperation({ name: 'bash', arguments: { command: 'echo cafe\u0301' }, resolveTarget: resolver })
    expect(nfc.fingerprint).not.toBe(nfd.fingerprint)
  })

  it('the omitted-workdir identity survives: omitted ≡ "." ≡ blank, and the display is presentation-only', async () => {
    const omitted = await canonicalizeOperation({ name: 'bash', arguments: { command: 'echo hi' }, resolveTarget: resolver })
    const dot = await canonicalizeOperation({ name: 'bash', arguments: { command: 'echo hi', workdir: '.' }, resolveTarget: resolver })
    const blank = await canonicalizeOperation({ name: 'bash', arguments: { command: 'echo hi', workdir: '  ' }, resolveTarget: resolver })
    expect(omitted.fingerprint).toBe(dot.fingerprint)
    expect(omitted.fingerprint).toBe(blank.fingerprint)
    expect(omitted.workdirDisplay).toBe('display:.')
  })

  it('the family normalizer answers the closed shell reasons with master\u2019s exact detail shapes', () => {
    expect(normalizeShellProjection('bash', {})).toEqual({ ok: false, reason: 'bash-command-missing' })
    expect(normalizeShellProjection('bash', { command: '   ' })).toEqual({ ok: false, reason: 'bash-command-empty' })
    expect(normalizeShellProjection('bash', { command: 42 })).toEqual({
      ok: false, reason: 'bash-command-not-a-string', details: { key: 'valueType', raw: 'number' },
    })
    expect(normalizeShellProjection('pwsh', { command: 'x', timeoutMs: 0 })).toEqual({
      ok: false, reason: 'pwsh-timeout-ms-invalid', details: { key: 'value', raw: 0 },
    })
    expect(normalizeShellProjection('bash', { command: 'x' })).toEqual({
      ok: true,
      fields: { command: 'x', workdirInput: '.', runInBackground: false, timeoutMs: null, sandboxPermissions: null },
    })
  })

  it('an out-of-vocabulary spelling is NEVER shell-canonicalized (the A2 frozen vocabulary law)', async () => {
    const errors: unknown[] = []
    for (const name of ['team_bash', 'BASH', 'bash ']) {
      try {
        await canonicalizeOperation({ name, arguments: { command: 'echo hi' }, resolveTarget: resolver })
        errors.push(null)
      } catch (error) {
        const e = error as { code?: unknown; details?: unknown }
        errors.push({ code: e.code ?? null, reason: (e.details as { reason?: string } | undefined)?.reason ?? null })
      }
    }
    expect(errors).toEqual([
      { code: 'OPERATION_CANONICALIZATION_FAILED', reason: 'tool-unsupported' },
      { code: 'OPERATION_CANONICALIZATION_FAILED', reason: 'tool-unsupported' },
      { code: 'OPERATION_CANONICALIZATION_FAILED', reason: 'tool-unsupported' },
    ])
  })
})
