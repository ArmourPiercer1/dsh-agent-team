/**
 * a2-canonical-operation.test.ts — A2 (alpha.2, plan §7) MUST-TEST: the
 * canonical operation + exact fingerprint of the operation-permission
 * module (plan §7.6 minimum, all cases covered):
 *
 * - same path spellings → same resource key (relative / backslash /
 *   absolute-with-`..` — the module passes the RAW path to the resolver
 *   and trusts the resolver's opaque key, plan §7.2);
 * - different file → different key;
 * - write same file ± content → same / different fingerprint;
 * - edit old/new change → fingerprint changes (also replace_all);
 * - read offset/limit change → fingerprint changes (A2C-5: the
 *   omitted `limit` is a DISTINCT identity from an explicit `limit: 2000`
 *   — the conservative identity of plan §8.2; the omitted `offset` still
 *   defaults to 1, the pinned-upstream fixed default);
 * - display changes do NOT affect authority (same key, different
 *   display → same fingerprint);
 * - malformed path → fail closed (typed error, closed reason, never a
 *   pass-through; the resolver is the only I/O and is NOT called when
 *   the arguments already fail closed);
 * - bash → tool-level resource (the resolver is consulted EXACTLY ONCE
 *   — for the workdir authority key, `args.workdir ?? '.'`; H5 P1-B);
 *   the FINGERPRINT BINDS the command AND the execution effect (H2
 *   P1-2 + H5: commandHash over the RAW command — different command →
 *   different fingerprint, same command → same fingerprint, raw command
 *   never persisted — plus the workdir KEY, runInBackground, explicit
 *   timeoutMs, requested sandboxPermissions; omitted ≡ explicit
 *   session-cwd workdir — both resolve to the seam's cwd basis); a
 *   missing/non-string/whitespace-only command fails closed (closed
 *   `bash-command-*` reasons) and a malformed effect field fails closed
 *   BEFORE the resolver call (closed `bash-workdir-not-a-string` /
 *   `bash-run-in-background-not-boolean` / `bash-timeout-ms-invalid` /
 *   `bash-sandbox-permissions-not-a-string` reasons);
 * - unsupported tool → classification (the class the A5 adapter uses to
 *   `next()` WITHOUT entering the resolver) + typed failure if
 *   canonicalized anyway;
 * - fingerprint determinism (byte-identical across calls; the
 *   `'sha256:<64 hex>'` shape; the projection carries no display
 *   string).
 *
 * The module is seam-injected (plan §7.2): these cases run over a
 * deterministic FAKE resolver (a small model of a local backend's
 * realpath-like identity, case-sensitive). The REAL upstream fs-local
 * backend contract (Windows separator/case/`..`/symlink/junction
 * semantics per plan §7.6) is pinned separately in
 * `./a2-canonical-operation-realfs.mjs` and asserted at the end.
 *
 * RUNNER CONSTRAINTS (this repo's plain-node shim — see
 * `d1-team-ownership-index.test.ts` header): every async scenario runs
 * at MODULE level (top-level await) and captures its results; the `it`
 * bodies are pure synchronous assertions. Shim matchers used: toBe /
 * toEqual (+.not) only.
 *
 * SELF-CLEANLINESS: this file is inside the P4-T6 whole-tree scanner's
 * scope (`packages/**`), so no legacy Team SessionEvent denylist token
 * may appear in this source — none does.
 *
 * @module @dsh-agent-team/runtime/test/a2-canonical-operation
 */
import { describe, expect, it } from 'vitest'
import {
  BASH_TOOL_RESOURCE_KEY,
  LSP_OPERATION_VALUES,
  OPERATION_PERMISSION_ERROR_CODES,
  READ_LIMIT_DEFAULT,
  READ_OFFSET_DEFAULT,
  canonicalizeOperation,
  classifyPermissionTool,
  isOperationPermissionError,
  isPermissionToolName,
} from '../operation-permission/index.js'
import type { CanonicalOperation, PathTargetResolver } from '../operation-permission/index.js'
import { runRealBackendCases } from './a2-canonical-operation-realfs.mjs'
import type { RealBackendCasesResult } from './a2-canonical-operation-realfs.mjs'

// ---------------------------------------------------------------------------
// The deterministic fake resolver (plan §7.2: the module treats keys as
// OPAQUE — the fake models ONE backend: a case-sensitive local FS whose
// identity is the canonical absolute path; the module must never see
// through it).
// ---------------------------------------------------------------------------

const FAKE_CWD = '/workspace'

/** The fake backend's identity: canonical absolute path (case-sensitive). */
function fakeCanonical(raw: string): string {
  const absolute = raw.startsWith('/') || /^[A-Za-z]:[\\/]/.test(raw) ? raw : FAKE_CWD + '/' + raw
  const prefix = /^[A-Za-z]:/.test(absolute) ? absolute.slice(0, 2) : ''
  const segments = absolute.slice(prefix.length).split(/[\\/]+/)
  const out: string[] = []
  for (const segment of segments) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') out.pop()
    else out.push(segment)
  }
  return prefix + (prefix ? '/' : '') + '/' + out.join('/')
}

interface FakeResolverOptions {
  /** Record every raw path handed to the resolver (asserts raw pass-through). */
  readonly calls?: string[]
  /** Per-path result overrides (modeling malformed/empty-key outcomes). */
  readonly overrides?: Record<string, { key?: unknown; display?: unknown; reject?: string; malformed?: true }>
  /** Display suffix variant (models a different backend's display, same key). */
  readonly displaySuffix?: string
}

/** Build one deterministic fake resolver over the fake canonical identity. */
function fakeResolver(options: FakeResolverOptions = {}): PathTargetResolver {
  return async (path: string) => {
    if (options.calls) options.calls.push(path)
    const override = options.overrides?.[path]
    if (override?.reject) throw new Error(override.reject)
    if (override?.malformed) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { key: override.key, display: override.display } as any
    }
    const key = (override?.key as string | undefined) ?? `fskey:${fakeCanonical(path)}`
    const display = (override?.display as string | undefined) ?? `display:${fakeCanonical(path)}${options.displaySuffix ?? ''}`
    return { key, display }
  }
}

// ---------------------------------------------------------------------------
// Module-level async world: every canonicalization captured here; the `it`
// bodies below are pure synchronous assertions over the captured results.
// ---------------------------------------------------------------------------

const calls: string[] = []
const resolver = fakeResolver({ calls })

async function op(
  name: string,
  args: unknown,
  resolveTarget: PathTargetResolver = resolver,
): Promise<CanonicalOperation> {
  return canonicalizeOperation({ name, arguments: args, resolveTarget })
}

interface FailCapture {
  readonly value: unknown
  readonly typed: boolean
  readonly code: string | undefined
  readonly reason: string | undefined
}

async function failOp(
  name: string,
  args: unknown,
  resolveTarget: PathTargetResolver = resolver,
): Promise<FailCapture> {
  try {
    const value = await canonicalizeOperation({ name, arguments: args, resolveTarget })
    return { value, typed: false, code: undefined, reason: undefined }
  } catch (error: unknown) {
    return {
      value: error,
      typed: isOperationPermissionError(error),
      code: isOperationPermissionError(error) ? error.code : undefined,
      reason:
        isOperationPermissionError(error) && error.details !== undefined
          ? (error.details['reason'] as string | undefined)
          : undefined,
    }
  }
}

const C = {
  // Resource identity — same file, three spellings (plan §7.6 case 1).
  readDotSlash: await op('read', { file_path: './a/b' }),
  readBackslash: await op('read', { file_path: 'a\\b' }),
  readDotDot: await op('read', { file_path: '/workspace/a/../a/b' }),
  // A different file (plan §7.6 case 2).
  readOtherFile: await op('read', { file_path: 'a/c' }),
  // An opaque non-path key (the resolver owns the key shape, plan §7.2).
  readOpaqueKey: await op('read', { file_path: 'urn-file' }, fakeResolver({
    overrides: { 'urn-file': { key: 'urn:file:abc', display: 'urn:file:abc' } },
  })),
  // Display independence (plan §7.6 case 6): same key, different display.
  readDisplayA: await op('read', { file_path: './a/b' }, fakeResolver()),
  readDisplayB: await op('read', { file_path: './a/b' }, fakeResolver({ displaySuffix: ':other-backend' })),
  // Fingerprint determinism (plan §7.6 case 10): the SAME input twice.
  readAgain: await op('read', { file_path: './a/b' }),
  // read window identity (A2C-5, plan §8.2: omitted limit → null
  // identity; omitted offset → the tool's fixed default 1).
  readDefaults: await op('read', { file_path: './a/b' }),
  readExplicitDefaults: await op('read', { file_path: './a/b', offset: 1, limit: 2000 }),
  readExplicitOffset1: await op('read', { file_path: './a/b', offset: 1 }),
  readOffset2: await op('read', { file_path: './a/b', offset: 2 }),
  readLimit100: await op('read', { file_path: './a/b', limit: 100 }),
  // read_image (no window fields at all).
  readImage: await op('read_image', { file_path: './a/b' }),
  // write (plan §7.6 case 3): same file ± content.
  writeSame: await op('write', { file_path: './a/b', content: 'hello' }),
  writeSameAgain: await op('write', { file_path: './a/b', content: 'hello' }),
  writeOtherContent: await op('write', { file_path: './a/b', content: 'world' }),
  writeEmptyContent: await op('write', { file_path: './a/b', content: '' }),
  writeOtherFile: await op('write', { file_path: 'a/c', content: 'hello' }),
  // edit (plan §7.6 case 4): old/new/replaceAll changes.
  editBase: await op('edit', { file_path: './a/b', old_string: 'x', new_string: 'y' }),
  editNewChange: await op('edit', { file_path: './a/b', old_string: 'x', new_string: 'z' }),
  editOldChange: await op('edit', { file_path: './a/b', old_string: 'w', new_string: 'y' }),
  editReplaceAll: await op('edit', {
    file_path: './a/b',
    old_string: 'x',
    new_string: 'y',
    replace_all: true,
  }),
  editReplaceAllExplicitFalse: await op('edit', {
    file_path: './a/b',
    old_string: 'x',
    new_string: 'y',
    replace_all: false,
  }),
  // lsp: only the operation-meaning fields in the projection.
  lspBase: await op('lsp', { operation: 'goToDefinition', file_path: './a/b', line: 10, character: 4 }),
  lspLineChange: await op('lsp', { operation: 'goToDefinition', file_path: './a/b', line: 11, character: 4 }),
  lspCharChange: await op('lsp', { operation: 'goToDefinition', file_path: './a/b', line: 10, character: 5 }),
  lspOperationChange: await op('lsp', { operation: 'hover', file_path: './a/b', line: 10, character: 4 }),
  lspAgain: await op('lsp', { operation: 'goToDefinition', file_path: './a/b', line: 10, character: 4 }),
  // bash (plan §7.6 case 8): tool-level resource; the FINGERPRINT BINDS
  // the command (H2 P1-2 — the command is the security-relevant field,
  // hashed; no shell parsing) AND the execution effect (H5 P1-B —
  // workdir key via the seam over `args.workdir ?? '.'`, runInBackground
  // ?? false, explicit timeoutMs ?? null, requested sandboxPermissions
  // ?? null; description/justification excluded).
  bashOne: await op('bash', { command: 'ls -la' }),
  bashTwo: await op('bash', { command: 'dir /s' }),
  bashSameCommand: await op('bash', { command: 'ls -la' }),
  // H5 — the workdir authority key (the seam's cwd basis IS the fake
  // session cwd `/workspace`: omitted ≡ explicit '.' ≡ explicit
  // `/workspace`; a relative workdir is a distinct identity).
  bashWorkdirDot: await op('bash', { command: 'ls -la', workdir: '.' }),
  bashWorkdirExplicitCwd: await op('bash', { command: 'ls -la', workdir: '/workspace' }),
  bashWorkdirOther: await op('bash', { command: 'ls -la', workdir: 'sub' }),
  bashWorkdirEmptyString: await op('bash', { command: 'ls -la', workdir: '   ' }),
  // H5 — the effect fields (each changes the fingerprint; the EXPLICIT
  // values only).
  bashEffectBackground: await op('bash', { command: 'ls -la', run_in_background: true }),
  bashEffectTimeout: await op('bash', { command: 'ls -la', timeoutMs: 5000 }),
  bashEffectSandbox: await op('bash', {
    command: 'ls -la',
    sandbox_permissions: 'workspace-write',
    justification: 'the display-only justification is excluded from the projection',
  }),
  // H5 — the excluded fields (description/justification never enter the
  // projection).
  bashDescA: await op('bash', { command: 'ls -la', description: 'explain A' }),
  bashDescB: await op('bash', { command: 'ls -la', description: 'explain B' }),
  // Fail-closed (plan §7.6 case 7 + §7.5): malformed path + seam violations.
  failPathMissing: await failOp('read', {}),
  failPathNonString: await failOp('read', { file_path: 42 }),
  failPathWhitespace: await failOp('read', { file_path: '   ' }),
  failArgsNotObject: await failOp('read', ['not', 'an', 'object']),
  failResolverThrew: await failOp('read', { file_path: 'boom' }, fakeResolver({
    overrides: { boom: { reject: 'ENOENT: backend says no' } },
  })),
  failResolverKeyEmpty: await failOp('read', { file_path: 'emptykey' }, fakeResolver({
    overrides: { emptykey: { key: '', display: 'd' } },
  })),
  failResolverResultMalformed: await failOp('read', { file_path: 'malformed' }, fakeResolver({
    overrides: { malformed: { malformed: true, key: 'k' } },
  })),
  failResolverDisplayNonString: await failOp('read', { file_path: 'nondisplay' }, fakeResolver({
    overrides: { nondisplay: { malformed: true, key: 'k', display: 7 } },
  })),
  // read argument validation (the tool would reject these — no effective window).
  failReadOffsetZero: await failOp('read', { file_path: './a/b', offset: 0 }),
  failReadOffsetFloat: await failOp('read', { file_path: './a/b', offset: 2.5 }),
  failReadOffsetString: await failOp('read', { file_path: './a/b', offset: '2' }),
  failReadLimitNegative: await failOp('read', { file_path: './a/b', limit: -1 }),
  // write argument validation.
  failWriteContentMissing: await failOp('write', { file_path: './a/b' }),
  failWriteContentNonString: await failOp('write', { file_path: './a/b', content: 3 }),
  // edit argument validation.
  failEditOldMissing: await failOp('edit', { file_path: './a/b', new_string: 'y' }),
  failEditNewMissing: await failOp('edit', { file_path: './a/b', old_string: 'x' }),
  failEditOldEmpty: await failOp('edit', { file_path: './a/b', old_string: '', new_string: 'y' }),
  failEditOldEqualsNew: await failOp('edit', { file_path: './a/b', old_string: 'x', new_string: 'x' }),
  failEditReplaceAll: await failOp('edit', {
    file_path: './a/b',
    old_string: 'x',
    new_string: 'y',
    replace_all: 'yes',
  }),
  // bash argument validation (H2 P1-2: the command is the security-
  // relevant field — the upstream tool-bash rejects all three before
  // executing, so a bash call without a well-formed command fails
  // closed with zero backend round-trips).
  failBashCommandMissing: await failOp('bash', {}),
  failBashCommandNonString: await failOp('bash', { command: 42 }),
  failBashCommandWhitespace: await failOp('bash', { command: '   \t\n  ' }),
  failBashArgsNotObject: await failOp('bash', ['not', 'an', 'object']),
  // H5 — the effect fields fail closed BEFORE the resolver call (the
  // upstream materialization feeds them to the pre-execute waterfall
  // unvalidated — `validateBashArgs` runs inside `execute`).
  failBashWorkdirNonString: await failOp('bash', { command: 'ls', workdir: 42 }),
  failBashRunInBackgroundNonBoolean: await failOp('bash', { command: 'ls', run_in_background: 'yes' }),
  failBashTimeoutNegative: await failOp('bash', { command: 'ls', timeoutMs: -1 }),
  failBashTimeoutString: await failOp('bash', { command: 'ls', timeoutMs: '10000' }),
  failBashTimeoutInfinity: await failOp('bash', { command: 'ls', timeoutMs: Infinity }),
  failBashSandboxNonString: await failOp('bash', { command: 'ls', sandbox_permissions: 42 }),
  // lsp argument validation.
  failLspOperationMissing: await failOp('lsp', { file_path: './a/b', line: 1, character: 1 }),
  failLspOperationUnknown: await failOp('lsp', {
    operation: 'goToTypeDefinition',
    file_path: './a/b',
    line: 1,
    character: 1,
  }),
  failLspLineZero: await failOp('lsp', { operation: 'hover', file_path: './a/b', line: 0, character: 1 }),
  failLspLineFloat: await failOp('lsp', { operation: 'hover', file_path: './a/b', line: 1.5, character: 1 }),
  failLspLineMissing: await failOp('lsp', { operation: 'hover', file_path: './a/b', character: 1 }),
  failLspCharacterString: await failOp('lsp', {
    operation: 'hover',
    file_path: './a/b',
    line: 1,
    character: '1',
  }),
  // Unsupported tools (plan §7.6 case 9): typed failure + resolver untouched.
  failUnsupported: await failOp('web_fetch', { url: 'https://example.com' }),
}

/**
 * The `'sha256:<64 lowercase hex>'` shape check over EVERY captured
 * fingerprint (the shim has no toMatch — plain booleans + toBe).
 */
const FINGERPRINT_SHAPE_OK = [
  C.readDotSlash.fingerprint,
  C.readBackslash.fingerprint,
  C.readDotDot.fingerprint,
  C.readOtherFile.fingerprint,
  C.readOpaqueKey.fingerprint,
  C.readDisplayA.fingerprint,
  C.readDisplayB.fingerprint,
  C.readDefaults.fingerprint,
  C.readExplicitDefaults.fingerprint,
  C.readOffset2.fingerprint,
  C.readLimit100.fingerprint,
  C.readImage.fingerprint,
  C.writeSame.fingerprint,
  C.writeSameAgain.fingerprint,
  C.writeOtherContent.fingerprint,
  C.writeEmptyContent.fingerprint,
  C.writeOtherFile.fingerprint,
  C.editBase.fingerprint,
  C.editNewChange.fingerprint,
  C.editOldChange.fingerprint,
  C.editReplaceAll.fingerprint,
  C.editReplaceAllExplicitFalse.fingerprint,
  C.lspBase.fingerprint,
  C.lspLineChange.fingerprint,
  C.lspCharChange.fingerprint,
  C.lspOperationChange.fingerprint,
  C.bashOne.fingerprint,
  C.bashTwo.fingerprint,
  C.bashSameCommand.fingerprint,
  C.bashWorkdirDot.fingerprint,
  C.bashWorkdirExplicitCwd.fingerprint,
  C.bashWorkdirOther.fingerprint,
  C.bashWorkdirEmptyString.fingerprint,
  C.bashEffectBackground.fingerprint,
  C.bashEffectTimeout.fingerprint,
  C.bashEffectSandbox.fingerprint,
  C.bashDescA.fingerprint,
  C.bashDescB.fingerprint,
].every((fingerprint) =>
  fingerprint.startsWith('sha256:')
  && fingerprint.length === 7 + 64
  && /^[0-9a-f]{64}$/.test(fingerprint.slice(7)),
)

// bash enters the resolver EXACTLY ONCE (H5 — for the workdir authority
// key: the omitted workdir normalizes to '.'); the unsupported case must
// not have entered the resolver at all.
const bashResolverCalls: string[] = []
await op('bash', { command: 'ls' }, fakeResolver({ calls: bashResolverCalls }))
const unsupportedResolverCalls: string[] = []
await failOp('team_delegate', { message: 'hi' }, fakeResolver({ calls: unsupportedResolverCalls }))

// The malformed-argument failures must not have entered the resolver
// (arguments are validated before the resolver call).
const failCalls: string[] = []
const failResolver = fakeResolver({ calls: failCalls })
await failOp('read', {}, failResolver)
await failOp('read', { file_path: '   ' }, failResolver)
await failOp('write', { file_path: './a/b' }, failResolver)
await failOp('edit', { file_path: './a/b', old_string: '', new_string: 'y' }, failResolver)
await failOp('lsp', { file_path: './a/b', line: 1, character: 1 }, failResolver)
await failOp('bash', {}, failResolver)
await failOp('bash', { command: 42 }, failResolver)
// H5 — the malformed EFFECT shapes fail closed before the resolver call
// too (zero backend round-trips).
await failOp('bash', { command: 'ls', workdir: 42 }, failResolver)
await failOp('bash', { command: 'ls', run_in_background: 'yes' }, failResolver)
await failOp('bash', { command: 'ls', timeoutMs: -1 }, failResolver)
await failOp('bash', { command: 'ls', sandbox_permissions: 42 }, failResolver)

// The real fs-local backend cases (plan §7.6 — the upstream resolve()
// contract; degrades to `{ available: false, reason }` without the
// test-use build).
const real: RealBackendCasesResult = await runRealBackendCases()

// ---------------------------------------------------------------------------
// Classification (plan §7.5: the A5 adapter distinguishes the three
// classes BEFORE any parameter resolution)
// ---------------------------------------------------------------------------

describe('a2 classification (plan §7.5)', () => {
  it('classifies the five file tools as the file class', () => {
    for (const tool of ['read', 'read_image', 'write', 'edit', 'lsp']) {
      expect(classifyPermissionTool(tool)).toEqual({ kind: 'file', tool })
    }
  })

  it('classifies bash as tool-level', () => {
    expect(classifyPermissionTool('bash')).toEqual({ kind: 'tool-level', tool: 'bash' })
  })

  it('classifies non-permission tools as unsupported', () => {
    for (const tool of ['web_fetch', 'team_delegate', 'unknown_tool', '', 'READ']) {
      expect(classifyPermissionTool(tool)).toEqual({ kind: 'unsupported' })
    }
  })

  it('isPermissionToolName matches exactly the closed six', () => {
    for (const tool of ['read', 'read_image', 'write', 'edit', 'lsp', 'bash']) {
      expect(isPermissionToolName(tool)).toBe(true)
    }
    for (const tool of ['web_fetch', 'team_delegate', 'BASH']) {
      expect(isPermissionToolName(tool)).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// Resource identity (plan §7.1/§7.2/§7.6)
// ---------------------------------------------------------------------------

describe('a2 resource identity (plan §7.1/§7.2/§7.6)', () => {
  it('same path spellings → same resource key (relative / backslash / absolute-with-..)', () => {
    expect(C.readDotSlash.resource.kind).toBe('file')
    expect(C.readDotSlash.resource.key).toBe('fskey:/workspace/a/b')
    expect(C.readBackslash.resource.key).toBe(C.readDotSlash.resource.key)
    expect(C.readDotDot.resource.key).toBe(C.readDotSlash.resource.key)
  })

  it('the module passes the RAW path to the resolver (no normalization of its own)', () => {
    expect(calls.includes('./a/b')).toBe(true)
    expect(calls.includes('a\\b')).toBe(true)
    expect(calls.includes('/workspace/a/../a/b')).toBe(true)
  })

  it('different file → different key → different fingerprint', () => {
    expect(C.readOtherFile.resource.key).not.toBe(C.readDotSlash.resource.key)
    expect(C.readOtherFile.fingerprint).not.toBe(C.readDotSlash.fingerprint)
  })

  it('the resource key is the resolver key verbatim (opaque — even non-path keys)', () => {
    expect(C.readOpaqueKey.resource.key).toBe('urn:file:abc')
    expect(C.readOpaqueKey.resource.display).toBe('urn:file:abc')
  })

  it('display changes do NOT affect authority (same key, different display → same fingerprint)', () => {
    expect(C.readDisplayA.resource.key).toBe(C.readDisplayB.resource.key)
    expect(C.readDisplayA.resource.display).not.toBe(C.readDisplayB.resource.display)
    expect(C.readDisplayA.fingerprint).toBe(C.readDisplayB.fingerprint)
  })
})

// ---------------------------------------------------------------------------
// Fingerprint (plan §7.3/§7.4)
// ---------------------------------------------------------------------------

describe('a2 fingerprint (plan §7.3/§7.4)', () => {
  it('fingerprint determinism: byte-identical across calls, sha256:<64 hex> shape', () => {
    expect(C.readAgain.fingerprint).toBe(C.readDotSlash.fingerprint)
    expect(C.lspAgain.fingerprint).toBe(C.lspBase.fingerprint)
    expect(FINGERPRINT_SHAPE_OK).toBe(true)
  })

  it('read: offset/limit change → fingerprint change; omitted limit is a DISTINCT identity from explicit 2000 (A2C-5, plan §8.2)', () => {
    expect(READ_OFFSET_DEFAULT).toBe(1)
    expect(READ_LIMIT_DEFAULT).toBe(2000)
    // A2C-5: the omitted `limit` canonicalizes to the null identity —
    // it is NO LONGER pseudo-equivalent to an explicit `limit: 2000`
    // (the pre-A2C-5 effective-defaults residual, removed by plan §8).
    expect(C.readDefaults.fingerprint).not.toBe(C.readExplicitDefaults.fingerprint)
    // The omitted `offset` still defaults to 1 (the pinned-upstream
    // fixed one-based default — the recon-confirmed unchanged semantic):
    // omitted offset + omitted limit ≡ explicit offset 1 + omitted limit.
    expect(C.readExplicitOffset1.fingerprint).toBe(C.readDefaults.fingerprint)
    expect(C.readOffset2.fingerprint).not.toBe(C.readDefaults.fingerprint)
    expect(C.readLimit100.fingerprint).not.toBe(C.readDefaults.fingerprint)
  })

  it('read_image: resource-only projection (no window fields)', () => {
    expect(C.readImage.resource.key).toBe(C.readDotSlash.resource.key)
    expect(C.readImage.fingerprint).not.toBe(C.readDotSlash.fingerprint)
  })

  it('write: same file ± content → same / different fingerprint (content hashed, never persisted)', () => {
    expect(C.writeSame.fingerprint).toBe(C.writeSameAgain.fingerprint)
    expect(C.writeOtherContent.fingerprint).not.toBe(C.writeSame.fingerprint)
    expect(C.writeEmptyContent.fingerprint).not.toBe(C.writeSame.fingerprint)
    expect(C.writeOtherFile.fingerprint).not.toBe(C.writeSame.fingerprint)
    expect(C.writeSame.fingerprint.includes('hello')).toBe(false)
  })

  it('edit: old/new/replaceAll change → fingerprint change; omitted replace_all == false', () => {
    expect(C.editNewChange.fingerprint).not.toBe(C.editBase.fingerprint)
    expect(C.editOldChange.fingerprint).not.toBe(C.editBase.fingerprint)
    expect(C.editReplaceAll.fingerprint).not.toBe(C.editBase.fingerprint)
    expect(C.editReplaceAllExplicitFalse.fingerprint).toBe(C.editBase.fingerprint)
  })

  it('lsp: operation-meaning fields only — line/character/operation each change the fingerprint', () => {
    expect(LSP_OPERATION_VALUES).toEqual(['goToDefinition', 'findReferences', 'goToImplementation', 'hover'])
    expect(C.lspLineChange.fingerprint).not.toBe(C.lspBase.fingerprint)
    expect(C.lspCharChange.fingerprint).not.toBe(C.lspBase.fingerprint)
    expect(C.lspOperationChange.fingerprint).not.toBe(C.lspBase.fingerprint)
  })

  it('bash: tool-level resource (kind/key/display = bash); the FINGERPRINT BINDS the command (H2 P1-2) AND the execution effect (H5 P1-B); the resolver is consulted exactly once — for the workdir key', () => {
    expect(BASH_TOOL_RESOURCE_KEY).toBe('bash')
    expect(C.bashOne.tool).toBe('bash')
    // The RESOURCE stays tool-level (the resource identity is the tool
    // itself, plan §4/§7.1/§3.2) — the workdir key enters the
    // FINGERPRINT, not the resource.
    expect(C.bashOne.resource).toEqual({ kind: 'tool', key: 'bash', display: 'bash' })
    // The FINGERPRINT BINDS the command (H2 P1-2): a different command
    // string → a different fingerprint (the constant-fingerprint P1-2 is
    // closed); the SAME command string → the same fingerprint
    // (deterministic).
    expect(C.bashOne.fingerprint).not.toBe(C.bashTwo.fingerprint)
    expect(C.bashSameCommand.fingerprint).toBe(C.bashOne.fingerprint)
    // The raw command is never persisted: the projection carries the
    // command HASH (the write contentHash pattern) — the fingerprint
    // is a digest, not the payload.
    expect(C.bashOne.fingerprint.includes('ls -la')).toBe(false)
    // H5 — the workdir authority key: the resolver is consulted EXACTLY
    // ONCE, over the normalized input (the omitted workdir ⇒ '.').
    expect(bashResolverCalls).toEqual(['.'])
    // The effective-canonical ruling: omitted ≡ explicit '.' ≡ explicit
    // session-cwd ≡ empty-string workdir (all resolve to the seam's
    // cwd basis — the same key, the same fingerprint).
    expect(C.bashWorkdirDot.fingerprint).toBe(C.bashOne.fingerprint)
    expect(C.bashWorkdirExplicitCwd.fingerprint).toBe(C.bashOne.fingerprint)
    expect(C.bashWorkdirEmptyString.fingerprint).toBe(C.bashOne.fingerprint)
    // A different effective workdir → a different fingerprint.
    expect(C.bashWorkdirOther.fingerprint).not.toBe(C.bashOne.fingerprint)
    // The workdir DISPLAY is presentation-only (the approval summary's
    // cwd= token) — it never enters the fingerprint (the projection
    // carries the opaque KEY).
    expect(C.bashOne.workdirDisplay).toBe('display:/workspace')
    expect(C.bashWorkdirOther.workdirDisplay).toBe('display:/workspace/sub')
    expect(C.bashWorkdirOther.fingerprint.includes('display:')).toBe(false)
    // H5 — each effect field changes the fingerprint (explicit values
    // only); description/justification are EXCLUDED (same fingerprint).
    expect(C.bashEffectBackground.fingerprint).not.toBe(C.bashOne.fingerprint)
    expect(C.bashEffectTimeout.fingerprint).not.toBe(C.bashOne.fingerprint)
    expect(C.bashEffectSandbox.fingerprint).not.toBe(C.bashOne.fingerprint)
    expect(C.bashDescA.fingerprint).toBe(C.bashDescB.fingerprint)
  })

  it('projection carries no display string (the fingerprint is display-independent by construction)', () => {
    // The display variant shares the key AND the fingerprint; the
    // display text appears nowhere in the identity (it is not in the
    // projection, so it cannot be in the digest either).
    expect(C.readDisplayB.fingerprint).toBe(C.readDisplayA.fingerprint)
    expect(C.readDisplayB.fingerprint.includes('other-backend')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Fail-closed (plan §7.5)
// ---------------------------------------------------------------------------

describe('a2 fail-closed (plan §7.5)', () => {
  function expectTypedFailure(capture: FailCapture, reason: string): void {
    expect(capture.typed).toBe(true)
    expect(capture.code).toBe(OPERATION_PERMISSION_ERROR_CODES.OPERATION_CANONICALIZATION_FAILED)
    expect(capture.reason).toBe(reason)
  }

  it('malformed path → typed failure (never a pass-through)', () => {
    expectTypedFailure(C.failPathMissing, 'file-path-missing')
    expectTypedFailure(C.failPathNonString, 'file-path-not-a-string')
    expectTypedFailure(C.failPathWhitespace, 'file-path-empty')
    expectTypedFailure(C.failArgsNotObject, 'file-path-missing')
  })

  it('resolver rejection / empty key / malformed result → typed failure', () => {
    expectTypedFailure(C.failResolverThrew, 'resolver-threw')
    expectTypedFailure(C.failResolverKeyEmpty, 'resolver-key-empty')
    expectTypedFailure(C.failResolverResultMalformed, 'resolver-result-malformed')
    expectTypedFailure(C.failResolverDisplayNonString, 'resolver-result-malformed')
  })

  it('read: a present-but-invalid offset/limit (the tool would reject it) → typed failure', () => {
    expectTypedFailure(C.failReadOffsetZero, 'read-offset-invalid')
    expectTypedFailure(C.failReadOffsetFloat, 'read-offset-invalid')
    expectTypedFailure(C.failReadOffsetString, 'read-offset-invalid')
    expectTypedFailure(C.failReadLimitNegative, 'read-limit-invalid')
  })

  it('write: missing/non-string content → typed failure (empty content is legitimate)', () => {
    expectTypedFailure(C.failWriteContentMissing, 'write-content-missing')
    expectTypedFailure(C.failWriteContentNonString, 'write-content-not-a-string')
    expect(C.writeEmptyContent.resource.kind).toBe('file')
  })

  it('edit: the tool\'s own rejections are mirrored fail-closed', () => {
    expectTypedFailure(C.failEditOldMissing, 'edit-old-string-missing')
    expectTypedFailure(C.failEditNewMissing, 'edit-new-string-missing')
    expectTypedFailure(C.failEditOldEmpty, 'edit-old-string-empty')
    expectTypedFailure(C.failEditOldEqualsNew, 'edit-old-equals-new')
    expectTypedFailure(C.failEditReplaceAll, 'edit-replace-all-not-boolean')
  })

  it('bash: missing/non-string/whitespace-only command → typed failure (H2 P1-2 — the tool would reject it); malformed effect field → typed failure BEFORE the resolver call (H5 P1-B — the upstream feeds the effect fields to the waterfall unvalidated)', () => {
    expectTypedFailure(C.failBashCommandMissing, 'bash-command-missing')
    expectTypedFailure(C.failBashCommandNonString, 'bash-command-not-a-string')
    expectTypedFailure(C.failBashCommandWhitespace, 'bash-command-empty')
    expectTypedFailure(C.failBashArgsNotObject, 'bash-command-missing')
    expectTypedFailure(C.failBashWorkdirNonString, 'bash-workdir-not-a-string')
    expectTypedFailure(C.failBashRunInBackgroundNonBoolean, 'bash-run-in-background-not-boolean')
    expectTypedFailure(C.failBashTimeoutNegative, 'bash-timeout-ms-invalid')
    expectTypedFailure(C.failBashTimeoutString, 'bash-timeout-ms-invalid')
    expectTypedFailure(C.failBashTimeoutInfinity, 'bash-timeout-ms-invalid')
    expectTypedFailure(C.failBashSandboxNonString, 'bash-sandbox-permissions-not-a-string')
  })

  it('lsp: unknown operation / invalid coordinates → typed failure', () => {
    expectTypedFailure(C.failLspOperationMissing, 'lsp-operation-missing')
    expectTypedFailure(C.failLspOperationUnknown, 'lsp-operation-unknown')
    expectTypedFailure(C.failLspLineZero, 'lsp-line-invalid')
    expectTypedFailure(C.failLspLineFloat, 'lsp-line-invalid')
    expectTypedFailure(C.failLspLineMissing, 'lsp-line-invalid')
    expectTypedFailure(C.failLspCharacterString, 'lsp-character-invalid')
  })

  it('unsupported tool → typed failure; the resolver is never entered (the A5 next() class)', () => {
    expectTypedFailure(C.failUnsupported, 'tool-unsupported')
    expect(unsupportedResolverCalls.length).toBe(0)
  })

  it('malformed arguments fail closed BEFORE the resolver call (zero backend round-trips)', () => {
    expect(failCalls.length).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// The REAL fs-local backend contract (plan §7.6 — the upstream resolve()
// IS the Windows path semantics; the module defines none of them itself)
// ---------------------------------------------------------------------------

describe('a2 real fs-local backend (plan §7.6)', () => {
  it('the test-use backend ran (or the unavailability reason is recorded)', () => {
    if (real.available) {
      expect(typeof real.root).toBe('string')
      expect(real.cases !== undefined).toBe(true)
    } else {
      expect(typeof real.reason).toBe('string')
      expect((real.reason ?? '').length > 0).toBe(true)
    }
  })

  it('same file → same key: relative, absolute, separator-variant, `..` traversal', () => {
    if (!real.available || !real.cases) return
    const { relative, absolute, sepVariant, traversal } = real.cases
    expect(typeof relative.key).toBe('string')
    expect(relative.key.length > 0).toBe(true)
    expect(absolute.key).toBe(relative.key)
    expect(sepVariant.key).toBe(relative.key)
    expect(traversal.key).toBe(relative.key)
    // The local backend's displayPath is the absolute display path.
    expect(typeof relative.display).toBe('string')
    expect(relative.display.length > 0).toBe(true)
  })

  it('case semantics per the backend: a case-variant spelling resolves to the same key on a case-insensitive FS', () => {
    if (!real.available || !real.cases) return
    const cases = real.cases
    if (cases.caseInsensitive) {
      expect(cases.caseBaseline !== undefined).toBe(true)
      expect(cases.caseVariant !== undefined).toBe(true)
      expect(cases.caseVariant?.key).toBe(cases.caseBaseline?.key)
    }
  })

  it('symlink/junction: the public seam resolves a link to the target\'s key (realpath)', () => {
    if (!real.available || !real.cases) return
    const { fileSymlink, dirJunction } = real.cases
    if (fileSymlink.ok) expect(fileSymlink.sameKey).toBe(true)
    if (dirJunction.ok) expect(dirJunction.sameKey).toBe(true)
  })

  it('absent file: stable identity for spellings, distinct for different files', () => {
    if (!real.available || !real.cases) return
    const { absentKey, absentTraversalKey, absentOtherKey } = real.cases
    expect(absentTraversalKey).toBe(absentKey)
    expect(absentOtherKey).not.toBe(absentKey)
  })
})
