#!/usr/bin/env node
/**
 * admission-proof — Session Format v4 message-source admission for the
 * work-completion Leader wake, run against the pristine 0.1.7-rc.1
 * runtime (tests/deepseek-harness-test-use @ 46a7f68b09 = tag
 * dsh-v0.1.7-rc.1; built lib of @deepseek-ai/dsh-session-format-v3-to-v4).
 *
 * Public API only. Proves:
 *
 *   A. RED        — the pre-fix v3 wrapper source
 *                   { kind: 'plugin', plugin: 'dsh-agent-team' } is
 *                   rejected by NATIVE v4 admission (encodeEvent runs
 *                   assertV4RowAdmission) with the exact error observed
 *                   in production.
 *   B. GREEN      — the shipped producer-owned kind
 *                   { kind: 'plugin:dsh-agent-team' } is admitted:
 *                   encode + strict decode row round trip preserve it.
 *   C. CONTINUITY — the official v3→v4 session migration (stage
 *                   transformEvent, the same path DSH uses when
 *                   upgrading historical Sessions) maps the historical
 *                   wrapper source to EXACTLY the shipped kind: legacy
 *                   history and newly-created wakes share one producer
 *                   identity.
 *
 * Read-only: imports the test-use built lib; writes nothing outside this
 * evidence directory. Exit 0 = all three proofs hold.
 *
 * Test-use root resolution (TEST_METHODS.md §1: pristine upstream
 * checkout, gitignored — absent in worktrees): argv[2] override, then
 * `<repo>/tests/deepseek-harness-test-use`, then the PRIMARY working
 * tree (git common dir) of a worktree checkout.
 */
import { strict as assert } from 'node:assert'
import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

// repo-root/dev/agent-workflow/evidence/v4-work-completion-source/ -> repo root
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')

function resolveTestUseRoot() {
  const candidates = []
  if (process.argv[2] !== undefined) candidates.push(resolve(process.argv[2]))
  candidates.push(join(REPO_ROOT, 'tests', 'deepseek-harness-test-use'))
  try {
    const common = execFileSync(
      'git', ['-C', REPO_ROOT, 'rev-parse', '--git-common-dir'], { encoding: 'utf8' },
    ).trim()
    const mainRoot = common.startsWith('/')
      ? dirname(common)
      : resolve(REPO_ROOT, dirname(common))
    candidates.push(join(mainRoot, 'tests', 'deepseek-harness-test-use'))
  } catch { /* no git metadata — fall through to the error below */ }
  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'packages', 'session', 'session-format-v3-to-v4', 'lib', 'index.js'))) {
      return candidate
    }
  }
  throw new Error(
    'admission-proof: tests/deepseek-harness-test-use checkout (built lib) not found — see TEST_METHODS.md §1',
  )
}

const TEST_USE = resolveTestUseRoot()
const { releasedV4SessionFormatCodec, createSessionFormatV3ToV4 } = await import(
  join(TEST_USE, 'packages', 'session', 'session-format-v3-to-v4', 'lib', 'index.js'),
)

const OLD_SOURCE = { kind: 'plugin', plugin: 'dsh-agent-team' }
const NEW_SOURCE = { kind: 'plugin:dsh-agent-team' }
const TEXT = '[team-work-settled requestToken=admission-proof]'

function wakeEvent(source) {
  return {
    type: 'user/message',
    seq: 0,
    time: 1,
    surfaceOp: 'append',
    data: { id: 'u', role: 'user', source, content: [{ type: 'text', text: TEXT }] },
  }
}

// --- A. RED: the retired v3 wrapper is rejected by native v4 admission -------
let redError = ''
try {
  releasedV4SessionFormatCodec.encodeEvent(wakeEvent(OLD_SOURCE))
} catch (error) {
  redError = String(error.message ?? error)
}
assert.match(
  redError,
  /format v4 message requires a producer-owned source kind/,
  'A: the retired v3 wrapper must be rejected by v4 admission',
)
console.log(`A RED:        old source rejected -> ${redError}`)

// --- B. GREEN: the shipped kind is admitted (encode + strict decode) ---------
const header = { type: 'session', version: 4, id: 'wcn', createdAt: 1, delegationDepth: 0, isSeeded: false }
const encoded = releasedV4SessionFormatCodec.encodeEvent(wakeEvent(NEW_SOURCE))
assert.ok(encoded, 'B: encode of the new source must succeed')
const decoder = releasedV4SessionFormatCodec.createDecoder(header, 'strict')
const decoded = []
decoder.decodeRow(encoded, {
  emitEvent: (event) => decoded.push(event),
  emitRun: () => { throw new Error('unexpected run') },
})
assert.equal(decoded.length, 1, 'B: exactly one event decodes')
assert.deepEqual(decoded[0].data.source, NEW_SOURCE, 'B: decoded source equals the shipped kind')
console.log(`B GREEN:      new source admitted, round trip intact -> ${JSON.stringify(decoded[0].data.source)}`)

// --- C. CONTINUITY: official migration maps history to the shipped kind ------
const v3Header = { version: 3, id: 'wcn', createdAt: 1, isSeeded: false, delegationDepth: 0 }
const migration = createSessionFormatV3ToV4([])
const stage = migration.createStage({
  sourceHeader: v3Header,
  targetHeader: { ...v3Header, version: 4 },
  sourceKind: 'decoded',
  sourceInheritedEventCount: 0,
})
const migrated = []
stage.transformEvent(wakeEvent(OLD_SOURCE), {
  emitEvent: (event) => migrated.push(event),
  emitRun: () => { throw new Error('unexpected run') },
})
assert.equal(migrated.length, 1, 'C: exactly one event migrates')
assert.deepEqual(migrated[0].data.source, NEW_SOURCE, 'C: migration must map the wrapper to the shipped kind')
console.log(`C CONTINUITY: v3 wrapper migrates to -> ${JSON.stringify(migrated[0].data.source)}`)

console.log('\nadmission-proof: A+B+C all hold — the fix is admitted by native v4 and identity-continuous with migrated history')
