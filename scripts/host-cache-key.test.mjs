/**
 * Host-free regression suite for the TINF M3 host cache key + artifact verification
 * (`scripts/host-cache-key.mjs`, spec 08-BUILD-CACHE-AND-PROVENANCE §3/§4/§6).
 *
 * The cache is NOT switched on in this milestone, so the laws that would make switching it on
 * unsafe are pinned here instead of being discovered by a poisoned runner:
 *   - the key is a canonical digest: field ORDER cannot change it, and EVERY single field change does;
 *   - a missing fact is a REFUSAL (exit 2), never a placeholder that would let two artifacts collide;
 *   - verification says OK only after the entry point, the recorded identity, the file count AND the
 *     tree digest all agree — a missing entry point, a one-byte change, a wrong commit and a missing
 *     expectation are all INFRA_ERROR with a named reason;
 *   - an absent directory is MISS, not INFRA_ERROR (different rebuild path; both non-green);
 *   - content without a recorded manifest is INFRA_ERROR, never "assume it matches".
 *
 * Host-free: mkdtemp fixtures, one real key derivation over THIS checkout (read-only git + files)
 * and three cheap `node` spawns. No port, no DSH_HOME, no pristine host, no build, no network.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  ARTIFACT_MANIFEST,
  ENTRY_POINT,
  KEY_FIELDS,
  IDENTITY_FIELDS,
  canonicalJson,
  deriveHostCacheFacts,
  extractStepText,
  hostCacheKey,
  manifestOf,
  recordHostArtifact,
  sha256Hex,
  verifyHostArtifact,
} from './host-cache-key.mjs'

const SCRIPT = fileURLToPath(new URL('./host-cache-key.mjs', import.meta.url))

function tmp() {
  return mkdtempSync(join(tmpdir(), 'tinf-host-key-test-'))
}

function cli(args) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' })
  return { status: r.status, out: `${r.stdout}\n${r.stderr}` }
}

/** A complete, synthetic §3 fact set. Stable strings so the digest assertions are deterministic. */
const FACTS = {
  platform: 'linux-x64',
  node_version: 'v24.21.0',
  pnpm_version: '11.7.0',
  host_commit: 'a'.repeat(40),
  host_lock_digest: `sha256:${'b'.repeat(64)}`,
  host_build_flags_digest: `sha256:${'c'.repeat(64)}`,
  product_merge_tree: 'd'.repeat(40),
  product_lock_digest: `sha256:${'e'.repeat(64)}`,
  toolchain_config_digest: `sha256:${'f'.repeat(64)}`,
}

/** A tiny artifact tree that satisfies the entry-point rule. */
function makeArtifact() {
  const dir = tmp()
  mkdirSync(join(dir, 'apps', 'cli', 'lib'), { recursive: true })
  writeFileSync(join(dir, ENTRY_POINT), '#!/usr/bin/env node\nconsole.log("host")\n')
  writeFileSync(join(dir, 'package.json'), '{"name":"host"}\n')
  recordHostArtifact({ dir, facts: FACTS })
  return dir
}

test('key: the canonical digest is stable under field order', () => {
  const a = hostCacheKey(FACTS)
  const reversed = Object.fromEntries(Object.entries(FACTS).reverse())
  assert.equal(hostCacheKey(reversed).key, a.key)
  assert.match(a.key, /^sha256:[0-9a-f]{64}$/)
  // The digest covers exactly the §3 fields — no hidden extras, no missing ones.
  assert.deepEqual(Object.keys(a).sort(), [...KEY_FIELDS, 'key'].sort())
  assert.equal(a.key, `sha256:${sha256Hex(canonicalJson(Object.fromEntries(KEY_FIELDS.map((f) => [f, FACTS[f]]))))}`)
})

test('key: EVERY single-field change changes the key (parameterised over all nine)', () => {
  const base = hostCacheKey(FACTS).key
  for (const field of KEY_FIELDS) {
    const changed = hostCacheKey({ ...FACTS, [field]: `${FACTS[field]}-changed` }).key
    assert.notEqual(changed, base, `${field} did not change the key`)
  }
})

test('key: a missing field is a refusal, never a placeholder', () => {
  for (const field of KEY_FIELDS) {
    const facts = { ...FACTS }
    delete facts[field]
    assert.throws(() => hostCacheKey(facts), (e) => e.code === 'HOST_CACHE_KEY_FACT_MISSING' && e.message.includes(field), field)
  }
})

test('key: derivation reads real files — pin, lockfiles, tsconfig, build steps, HEAD tree', () => {
  // This checkout is a real git repo with a real lockfile + tsconfig + the census workflow, so the
  // derivation is exercised for real; only the host lock is borrowed from a synthetic tree (no
  // pristine host exists in this checkout — disclosed in the memo).
  const hostDir = tmp()
  writeFileSync(join(hostDir, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n# synthetic\n')
  const facts = deriveHostCacheFacts({ repoRoot: process.cwd(), hostDir })
  assert.deepEqual(Object.keys(facts).sort(), [...KEY_FIELDS].sort())
  const paths = readFileSync('tests/paths.mjs', 'utf8')
  const pin = /export\s+const\s+TEST_USE_BASELINE_SHA\s*=\s*['"]([0-9a-f]{40})['"]/.exec(paths)[1]
  assert.equal(facts.host_commit, pin)
  assert.match(facts.host_lock_digest, /^sha256:[0-9a-f]{64}$/)
  assert.match(facts.toolchain_config_digest, /^sha256:[0-9a-f]{64}$/)
  assert.match(facts.host_build_flags_digest, /^sha256:[0-9a-f]{64}$/)
  assert.match(facts.product_lock_digest, /^sha256:[0-9a-f]{64}$/)
  assert.match(facts.product_merge_tree, /^[0-9a-f]{40}$/)
  // The composite key is stable across two derivations of the same tree.
  assert.equal(hostCacheKey(deriveHostCacheFacts({ repoRoot: process.cwd(), hostDir })).key, hostCacheKey(facts).key)
})

test('key: a fact that cannot be derived refuses (exit 2) instead of substituting', () => {
  const empty = tmp()
  assert.throws(() => deriveHostCacheFacts({ repoRoot: empty, hostDir: empty }), (e) => e.code === 'HOST_CACHE_FACT_MISSING')
  const r = cli(['--key', '--repo-root', empty, '--host-dir', empty])
  assert.equal(r.status, 2)
  assert.match(r.out, /REFUSED HOST_CACHE_FACT_MISSING/)
  // no host lock anywhere -> the named fact is host_lock_digest, not a generic failure
  const r2 = cli(['--key', '--repo-root', process.cwd(), '--host-dir', empty])
  assert.equal(r2.status, 2)
  assert.match(r2.out, /host_lock_digest/)
})

test('verify: OK for a freshly recorded artifact, and the identity is the recorded one', () => {
  const dir = makeArtifact()
  const result = verifyHostArtifact({ dir, expect: FACTS })
  assert.equal(result.verdict, 'OK')
  assert.deepEqual(result.reasons, [])
  assert.equal(result.artifact.file_count, manifestOf(dir).file_count)
  assert.equal(result.recorded[IDENTITY_FIELDS[0]], FACTS[IDENTITY_FIELDS[0]])
})

test('verify: a missing entry point is INFRA_ERROR/ENTRY_POINT_MISSING', () => {
  const dir = makeArtifact()
  rmSync(join(dir, ENTRY_POINT))
  const result = verifyHostArtifact({ dir, expect: FACTS })
  assert.equal(result.verdict, 'INFRA_ERROR')
  assert.ok(result.reasons.some((r) => r.startsWith('ENTRY_POINT_MISSING')), JSON.stringify(result.reasons))
})

test('verify: an entry point that is a directory is INFRA_ERROR/ENTRY_POINT_NOT_A_FILE', () => {
  const dir = makeArtifact()
  rmSync(join(dir, ENTRY_POINT))
  mkdirSync(join(dir, ENTRY_POINT))
  const result = verifyHostArtifact({ dir, expect: FACTS })
  assert.equal(result.verdict, 'INFRA_ERROR')
  assert.ok(result.reasons.some((r) => r.startsWith('ENTRY_POINT_NOT_A_FILE')), JSON.stringify(result.reasons))
})

test('verify: a one-byte change is INFRA_ERROR/CONTENT_DIGEST_MISMATCH', () => {
  const dir = makeArtifact()
  const before = readFileSync(join(dir, ENTRY_POINT), 'utf8')
  writeFileSync(join(dir, ENTRY_POINT), `${before}x`)
  const result = verifyHostArtifact({ dir, expect: FACTS })
  assert.equal(result.verdict, 'INFRA_ERROR')
  assert.ok(result.reasons.some((r) => r.startsWith('CONTENT_DIGEST_MISMATCH')), JSON.stringify(result.reasons))
})

test('verify: an added file is INFRA_ERROR (file count + digest both disagree)', () => {
  const dir = makeArtifact()
  writeFileSync(join(dir, 'extra.txt'), 'smuggled\n')
  const result = verifyHostArtifact({ dir, expect: FACTS })
  assert.equal(result.verdict, 'INFRA_ERROR')
  assert.ok(result.reasons.some((r) => r.startsWith('FILE_COUNT_MISMATCH')), JSON.stringify(result.reasons))
})

test('verify: a wrong host_commit is INFRA_ERROR/IDENTITY_MISMATCH (and names the field)', () => {
  const dir = makeArtifact()
  const result = verifyHostArtifact({ dir, expect: { ...FACTS, host_commit: 'b'.repeat(40) } })
  assert.equal(result.verdict, 'INFRA_ERROR')
  assert.ok(result.reasons.some((r) => r.startsWith('IDENTITY_MISMATCH: host_commit')), JSON.stringify(result.reasons))
})

test('verify: a wrong composite key is INFRA_ERROR even when the identity fields agree', () => {
  const dir = makeArtifact()
  const key = hostCacheKey(FACTS)
  const result = verifyHostArtifact({ dir, expect: { ...FACTS, key: `${key.key.slice(0, -1)}0` } })
  assert.equal(result.verdict, 'INFRA_ERROR')
  assert.ok(result.reasons.some((r) => r.startsWith('IDENTITY_MISMATCH: key')), JSON.stringify(result.reasons))
})

test('verify: a missing expected fact is INFRA_ERROR — never "anything matches"', () => {
  const dir = makeArtifact()
  for (const field of IDENTITY_FIELDS) {
    const expect = { ...FACTS }
    delete expect[field]
    const result = verifyHostArtifact({ dir, expect })
    assert.equal(result.verdict, 'INFRA_ERROR', field)
    assert.ok(result.reasons.some((r) => r.startsWith('EXPECT_FACT_MISSING')), `${field}: ${JSON.stringify(result.reasons)}`)
  }
})

test('verify: an absent directory is MISS, not INFRA_ERROR', () => {
  const result = verifyHostArtifact({ dir: join(tmp(), 'absent'), expect: FACTS })
  assert.equal(result.verdict, 'MISS')
  assert.ok(result.reasons.some((r) => r.startsWith('ARTIFACT_DIR_ABSENT')), JSON.stringify(result.reasons))
})

test('verify: content without a recorded manifest is INFRA_ERROR, never assumed to match', () => {
  const dir = tmp()
  mkdirSync(join(dir, 'apps', 'cli', 'lib'), { recursive: true })
  writeFileSync(join(dir, ENTRY_POINT), 'x\n')
  const result = verifyHostArtifact({ dir, expect: FACTS })
  assert.equal(result.verdict, 'INFRA_ERROR')
  assert.ok(result.reasons.some((r) => r.startsWith('MANIFEST_MISSING')), JSON.stringify(result.reasons))
})

test('manifest: `.git` is excluded and the recorded manifest never hashes itself', () => {
  const dir = makeArtifact()
  const before = manifestOf(dir)
  mkdirSync(join(dir, '.git', 'objects'), { recursive: true })
  writeFileSync(join(dir, '.git', 'HEAD'), 'ref: refs/heads/x\n')
  const after = manifestOf(dir)
  assert.equal(after.manifest_digest, before.manifest_digest)
  assert.equal(after.file_count, before.file_count)
  // The manifest file is excluded, so re-recording does not change the tree digest.
  assert.equal(verifyHostArtifact({ dir, expect: FACTS }).verdict, 'OK')
})

test('cli: --record / --verify / MISS exit codes are 0 / 0 / 3, and a tampered tree is 1', () => {
  const dir = makeArtifact()
  const expectFile = join(dir, 'expect.json')
  const keyFile = join(dir, 'key.json')
  rmSync(join(dir, ARTIFACT_MANIFEST))
  writeFileSync(keyFile, `${JSON.stringify({ ...FACTS, key: hostCacheKey(FACTS).key }, null, 2)}\n`)
  writeFileSync(expectFile, readFileSync(keyFile, 'utf8'))
  const recorded = cli(['--record', '--dir', dir, '--expect', keyFile])
  assert.equal(recorded.status, 0, recorded.out)
  assert.match(recorded.out, /DSH-HOST-CACHE-RECORD verdict=RECORDED/)
  const verified = cli(['--verify', '--dir', dir, '--expect', expectFile])
  assert.equal(verified.status, 0, verified.out)
  assert.match(verified.out, /verdict=OK/)
  writeFileSync(join(dir, ENTRY_POINT), 'tampered\n')
  assert.equal(cli(['--verify', '--dir', dir, '--expect', expectFile]).status, 1)
  assert.equal(cli(['--verify', '--dir', join(dir, 'absent'), '--expect', expectFile]).status, 3)
})

test('cli: --self-test pins its own parser and controls (exit 0)', () => {
  const r = cli(['--self-test'])
  assert.equal(r.status, 0, r.out)
  assert.match(r.out, /DSH-HOST-CACHE-KEY-SELFTEST PASS/)
})

test('workflow step extraction: the host build step carries the measured chain, not the prose', () => {
  const text = readFileSync('.github/workflows/census-runtime.yml', 'utf8')
  const step = extractStepText(text, 'Build the pristine host')
  assert.ok(step !== null)
  assert.match(step, /pnpm install --ignore-scripts/)
  assert.match(step, /pnpm run build/)
  assert.match(step, /DSH_CLIENT_COMMIT_HASH/)
  // Comments and blank lines are dropped, so a comment edit cannot invalidate a cache key.
  assert.ok(!step.includes('#'))
  // A step name that does not exist is null, which the derivation turns into a named refusal.
  assert.equal(extractStepText(text, 'No such step'), null)
})
