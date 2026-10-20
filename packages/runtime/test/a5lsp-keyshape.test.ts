/**
 * a5lsp-keyshape.test.ts — the `filePath` vs `file_path` key-shape law for the
 * canonicalizer (route A; RETRACTED premise, reviewer fe2d6cf7 measured: the
 * shipped `tool-lsp` schema spells the path `file_path` at
 * `tests/deepseek-harness-test-use/packages/lsp/tool-lsp/src/index.ts:120` —
 * the earlier "shipped schema = filePath @ index.ts:131" citation in this
 * round's first commit was false and is retracted here; camelCase lives only
 * in the host's internal LSP-seam vocabulary). What this round ACTUALLY pins:
 * model camelCase DRIFT is tolerated as a fail-safe SUPERSET — a drifted call
 * used to die fail-closed (`file-path-missing`, the A5-LEG probe receipt) and
 * now becomes decidable. The installed lsp channel finding from the A5-LEG
 * report is NOT closed by this file and stays booked with its own root cause
 * (the pre-PR canonicalizer accepts the shipped form; measured 3/3).
 *
 * SCOPE (root 终态令): the alias is canonicalizer-layer tolerance ONLY — it
 * does not rewrite or forward args, so a camel-only call still fails at the
 * host parser (parseLspArgs reads `args.file_path`); execution is zero either
 * way and only the answering layer moves. Every test below is the
 * fake-resolver/direct-canonicalizer UNIT level; none of them is installed-
 * chain verification, and no installed lsp-channel finding is claimed fixed.
 *
 * The pinned semantics (root directive, small-PR scope):
 *  - ONE key present → its value is THE path (either spelling, any file tool);
 *  - BOTH keys, same value → deterministic, decidable: it is ONE object;
 *  - BOTH keys, different values → a DETERMINISTIC refusal with its OWN
 *    reason code (`file-path-key-conflict`) — the canonicalizer never picks a
 *    winner between two candidate targets (never-guess);
 *  - a present-but-malformed value under EITHER key fails closed before the
 *    conflict question is even asked;
 *  - NEITHER key → the unchanged `file-path-missing` refusal.
 * The canonicalizer authorizes the path it extracts; the BODY stays the
 * schema authority (a tool that ignores the other spelling fails at its own
 * face — governance authorizing a path the body never reads executes
 * nothing; the dangerous direction, authorizing a path the body reads that
 * governance never saw, cannot exist once both spellings are extracted).
 *
 * Fingerprint identity corollary (tested): the key SPELLING is not a security
 * fact — same path bytes under either spelling project to one resource key
 * and one fingerprint (a lane can never be spelled around by renaming keys).
 *
 * Purity: the deterministic fake resolver (same model as the a2 suite —
 * the module treats keys as OPAQUE).
 *
 * p4t6: this file is the ONE scannable spec added by the A5-LSP-KEYFIX round.
 *
 * @module @dsh-agent-team/runtime/test/a5lsp-keyshape
 */
import { describe, expect, it } from 'vitest'
import {
  OPERATION_PERMISSION_ERROR_CODES,
  canonicalizeOperation,
  isOperationPermissionError,
} from '../operation-permission/index.js'
import type { CanonicalOperation, PathTargetResolver } from '../operation-permission/index.js'

const FAKE_CWD = '/workspace'

function fakeCanonical(raw: string): string {
  const absolute = raw.startsWith('/') || /^[A-Za-z]:[\\/]/.test(raw) ? raw : FAKE_CWD + '/' + raw
  const segments = absolute.split(/[\\/]+/)
  const out: string[] = []
  for (const segment of segments) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') out.pop()
    else out.push(segment)
  }
  return '/' + out.join('/')
}

const resolver: PathTargetResolver = async (path: string) => ({
  key: `fskey:${fakeCanonical(path)}`,
  display: `display:${fakeCanonical(path)}`,
})

async function op(name: string, args: unknown): Promise<CanonicalOperation> {
  return canonicalizeOperation({ name, arguments: args, resolveTarget: resolver })
}

interface FailCapture {
  typed: boolean
  code: string | null
  reason: string | null
}

async function fail(name: string, args: unknown): Promise<FailCapture> {
  try {
    await canonicalizeOperation({ name, arguments: args, resolveTarget: resolver })
    return { typed: false, code: null, reason: null }
  } catch (e) {
    if (isOperationPermissionError(e)) {
      const reason = (e as { details?: { reason?: unknown } }).details?.reason
      return { typed: true, code: e.code, reason: typeof reason === 'string' ? reason : null }
    }
    return { typed: false, code: 'UNTYPED', reason: String(e) }
  }
}

describe('a5lsp-keyshape — canonicalizer camel-drift tolerance law (unit level)', () => {
  it('single `filePath` (a camelCase model-drift shape; the shipped schema is file_path) canonicalizes', async () => {
    const c = await op('lsp', { operation: 'goToDefinition', filePath: '/a/b.ts', line: 10, character: 4 })
    expect(c.resource.key).toBe('fskey:/a/b.ts')
    expect(c.fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/)
  })

  it('single `file_path` keeps working unchanged (regression leg)', async () => {
    const c = await op('lsp', { operation: 'goToDefinition', file_path: '/a/b.ts', line: 10, character: 4 })
    expect(c.resource.key).toBe('fskey:/a/b.ts')
  })

  it('the key SPELLING is not a security fact: both spellings project identically', async () => {
    const viaCamel = await op('lsp', { operation: 'hover', filePath: '/x/y.ts', line: 1, character: 1 })
    const viaSnake = await op('lsp', { operation: 'hover', file_path: '/x/y.ts', line: 1, character: 1 })
    expect(viaCamel.fingerprint).toBe(viaSnake.fingerprint)
    expect(viaCamel.resource.key).toBe(viaSnake.resource.key)
  })

  it('BOTH keys, SAME value → decidable one object, and it equals the single-key shape', async () => {
    const both = await op('lsp', { operation: 'hover', filePath: '/x/y.ts', file_path: '/x/y.ts', line: 2, character: 3 })
    const single = await op('lsp', { operation: 'hover', filePath: '/x/y.ts', line: 2, character: 3 })
    expect(both.fingerprint).toBe(single.fingerprint)
  })

  it('BOTH keys, DIFFERENT values → deterministic refusal with its OWN reason code', async () => {
    const c = await fail('lsp', { operation: 'hover', filePath: '/x/y.ts', file_path: '/other/z.ts', line: 2, character: 3 })
    expectTyped(c, 'file-path-key-conflict')
  })

  it('the conflict refusal is tool-agnostic (write carries the same law)', async () => {
    const c = await fail('write', { filePath: '/x/y.ts', file_path: '/other/z.ts', content: 'hi' })
    expectTyped(c, 'file-path-key-conflict')
  })

  it('a present-but-malformed value under EITHER key fails closed before the conflict question', async () => {
    const c1 = await fail('lsp', { operation: 'hover', filePath: 42, file_path: '/x/y.ts', line: 2, character: 3 })
    expectTyped(c1, 'file-path-not-a-string')
    const c2 = await fail('lsp', { operation: 'hover', filePath: '   ', line: 2, character: 3 })
    expectTyped(c2, 'file-path-empty')
  })

  it('NEITHER key → the unchanged file-path-missing refusal', async () => {
    const c = await fail('lsp', { operation: 'hover', line: 2, character: 3 })
    expectTyped(c, 'file-path-missing')
  })
})

function expectTyped(capture: FailCapture, reason: string): void {
  expect(capture.typed).toBe(true)
  expect(capture.code).toBe(OPERATION_PERMISSION_ERROR_CODES.OPERATION_CANONICALIZATION_FAILED)
  expect(capture.reason).toBe(reason)
}
