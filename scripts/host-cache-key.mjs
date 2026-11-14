#!/usr/bin/env node
/**
 * host-cache-key — a strong key for a Host build artifact, and VERIFICATION of the artifact
 * itself (TINF M3, spec `docs/plans/memo/agent-testing-infrastructure-20261114/08-BUILD-CACHE-AND-PROVENANCE.md` §3/§4/§6).
 *
 * WHY THIS EXISTS. §1 of that memo measured the actual cost split (census 78%, host build 19%,
 * repo build 1.6%) and §3 states the rule that makes a host cache safe to even consider: a cache
 * key is a CLAIM, and a claim is not a hit — "构建成功也要验证预期入口、文件数/摘要及可安装性，不得直接
 * 接受 cache key 的字符串宣称". So this file is two halves and they are deliberately separate:
 *
 *   1. `hostCacheKey(facts)` — the §3 key object, every field derived from a REAL file or a real
 *      git object, plus ONE `key = sha256:` over a canonical (sorted-key) JSON of those fields.
 *      Field order can never change the key; a single changed field always does.
 *   2. `verifyHostArtifact({dir, expect})` — the artifact is opened, its entry point stat'ed, its
 *      whole tree walked into a manifest (file count + digest), and the identity it RECORDED is
 *      compared with what was expected. Any mismatch is `INFRA_ERROR` with a named reason. It is
 *      never `OK`.
 *
 * THREE VERDICTS, NOT TWO (spec §6 "一旦缓存 SHA/文件完整性验证失败，标记 INFRA_ERROR 并触发明确的重建
 * 路径；不能把缺失目标当成'无需运行'"):
 *   OK          every check passed.
 *   INFRA_ERROR the artifact is there but untrustworthy (missing entry point, tampered content,
 *               identity disagreement, unreadable/missing recorded manifest, missing expected fact).
 *   MISS        the artifact directory is absent. Non-green exactly like INFRA_ERROR, but a
 *               DIFFERENT path: a miss means "build it", an INFRA_ERROR means "the thing we found
 *               must not be used, find out why".
 *
 * WHAT THE KEY FIELDS MEAN AND WHY EACH IS IN IT (§3 lists them; the derivation is the deliverable):
 *   platform                   process.platform-arch — a binary built for another platform is not
 *                              the same artifact, and node-pty/esbuild are platform binaries.
 *   node_version               process.version — exact, because native addons are ABI-bound.
 *   pnpm_version               repo `packageManager` — the installer that produced node_modules.
 *   host_commit                tests/paths.mjs TEST_USE_BASELINE_SHA — the ONE host pin (never a
 *                              copy: reading it here is what keeps this key from drifting).
 *   host_lock_digest           sha256 of the host tree's pnpm-lock.yaml — a lockfile edit at the
 *                              same commit (a fork patch, a local install) changes the deps.
 *   host_build_flags_digest    sha256 of the census-runtime.yml host-build STEP text (env + the
 *                              measured `pnpm install --ignore-scripts` / `pnpm run build` chain).
 *                              The flags ARE part of the artifact: a build without
 *                              DSH_CLIENT_COMMIT_HASH is a different tree.
 *   product_merge_tree         `git rev-parse HEAD^{tree}` — the tree, not the commit: a rebase
 *                              with an identical tree must hit the same key.
 *   product_lock_digest        sha256 of this repo's pnpm-lock.yaml.
 *   toolchain_config_digest    sha256 over {tsconfig.base.json, node/pnpm versions, both build-step
 *                              texts} — compiler settings change the output without touching source.
 *
 * WHAT VERIFICATION CAN AND CANNOT DO — this is the honest limit and it is in the memo too:
 *   It CAN prove the bytes on disk match a manifest that was recorded with an identity, and that
 *   the identity agrees with the key we expect. It CANNOT prove the artifact was BUILT FROM that
 *   commit: a forger who rewrites the recorded manifest and the tree together passes every check
 *   here (the digest is not signed). It is a trust-the-producer check (§4: the trusted push build
 *   is the producer; a low-trust PR only reads), not a proof of provenance. It also does not prove
 *   the artifact is RUNNABLE ("可安装性" in §3 is a separate exercise: boot it or install it).
 *   `.git` is excluded from the manifest on purpose: git metadata is a provenance store, not
 *   artifact content, and its identity check is the recorded `host_commit`.
 *
 * NOT SWITCHED ON. This milestone PREPARES the cache: no `actions/cache` read or write step exists
 * anywhere, no CI path consults a key, and nothing here changes what runs. Switching the cache on
 * is a separate, reviewed step (spec: 先量化、再影子对照验证、最后切换), gated on the timing rows
 * `scripts/tinf-timing.mjs` now produces.
 *
 * USAGE
 *   node scripts/host-cache-key.mjs --key [--repo-root DIR] [--host-dir DIR] [--json]
 *   node scripts/host-cache-key.mjs --record --dir DIR --expect FILE   # write host-artifact.json
 *   node scripts/host-cache-key.mjs --verify --dir DIR --expect FILE [--json]
 *   node scripts/host-cache-key.mjs --self-test
 *
 * Exit: 0 OK, 1 INFRA_ERROR, 2 REFUSED (a required fact cannot be derived — never substituted),
 * 3 MISS. Exit 2 is the same "a wrong answer is worse than no answer" rule census-profile.mjs uses.
 */
import process from 'node:process'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, lstatSync, mkdtempSync, readFileSync, readlinkSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const KEY_SCHEMA = 'host-cache-key/1'
export const ARTIFACT_MANIFEST = 'host-artifact.json'
export const MANIFEST_SCHEMA = 'host-artifact-manifest/1'
export const ENTRY_POINT = 'apps/cli/lib/bin.js'
/** §3's field set, in a fixed (sorted) order: HOST identity + the PRODUCT tree it was used for. */
export const KEY_FIELDS = [
  'host_build_flags_digest',
  'host_commit',
  'host_lock_digest',
  'node_version',
  'platform',
  'pnpm_version',
  'product_lock_digest',
  'product_merge_tree',
  'toolchain_config_digest',
]
/**
 * The fields that identify the HOST alone (spec §3/§4: a Host cache hits by Host identity, so it
 * must not move when a different PR's merge tree arrives). Everything in KEY_FIELDS that is not
 * listed here belongs to the PRODUCT layer.
 */
export const HOST_KEY_FIELDS = [
  'host_build_flags_digest',
  'host_commit',
  'host_lock_digest',
  'node_version',
  'platform',
  'pnpm_version',
  'toolchain_config_digest',
]
/** Fields that belong to the PRODUCT layer (merge tree + its lockfile). */
export const PRODUCT_KEY_FIELDS = ['product_lock_digest', 'product_merge_tree']

/** The identity fields an artifact RECORDS and verification compares (§3/§6). */
export const IDENTITY_FIELDS = ['host_commit', 'host_lock_digest', 'toolchain_config_digest']
const HOST_WORKFLOW = '.github/workflows/census-runtime.yml'
const HOST_BUILD_STEP = 'Build the pristine host'
const REPO_BUILD_STEP = 'Build this repo'

/** A refusal with a machine-readable code. Never caught into a verdict: it exits 2. */
export class KeyRefusal extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'KeyRefusal'
    this.code = code
  }
}

export function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex')
}

export function digestFile(path) {
  return `sha256:${sha256Hex(readFileSync(path))}`
}

/** Canonical JSON: sorted keys at every level, no insignificant whitespace. */
export function canonicalJson(value) {
  const walk = (v) => {
    if (Array.isArray(v)) return v.map(walk)
    if (v !== null && typeof v === 'object') {
      const out = {}
      for (const k of Object.keys(v).sort()) out[k] = walk(v[k])
      return out
    }
    return v
  }
  return JSON.stringify(walk(value))
}

function gitOut(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return null
  }
}

/**
 * The `- name:` step text, normalized to its non-comment lines, so the digest covers the build
 * COMMAND and its env — not the YAML's indentation or its prose.
 */
export function extractStepText(workflowText, namePrefix) {
  const lines = String(workflowText ?? '').split('\n')
  const start = lines.findIndex((l) => {
    const m = /^\s*-\s+name:\s*(.*)$/.exec(l)
    return m !== null && m[1].trim().replace(/^["']|["']$/g, '').startsWith(namePrefix)
  })
  if (start < 0) return null
  let end = lines.length
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^\s*-\s+name:/.test(lines[i])) { end = i; break }
  }
  const body = lines.slice(start, end)
    .map((l) => l.trim())
    .filter((l) => l !== '' && !l.startsWith('#'))
  return body.join('\n')
}

/** Read the host pin from tests/paths.mjs (READ, never copied) and require 40-hex. */
export function hostPinFromPaths(repoRoot) {
  const file = join(repoRoot, 'tests', 'paths.mjs')
  if (!existsSync(file)) throw new KeyRefusal('HOST_CACHE_FACT_MISSING', `host_commit: ${file} is absent, so the host pin cannot be read`)
  const text = readFileSync(file, 'utf8')
  const m = /export\s+const\s+TEST_USE_BASELINE_SHA\s*=\s*['"]([0-9a-f]{40})['"]/.exec(text)
  if (!m) throw new KeyRefusal('HOST_CACHE_FACT_MISSING', `host_commit: ${file} carries no 40-hex TEST_USE_BASELINE_SHA`)
  return m[1]
}

/**
 * Derive every §3 fact from real files. A fact that cannot be derived is a REFUSAL naming the
 * fact and the path it looked at — a placeholder ("unknown", "0") would make two different
 * artifacts share one key, which is worse than not keying at all.
 */
export function deriveHostCacheFacts({ repoRoot = process.cwd(), hostDir = null } = {}) {
  const root = resolve(repoRoot)
  const host = hostDir === null ? join(root, 'tests', 'deepseek-harness-test-use') : resolve(hostDir)
  // Facts are collected into `missing` and raised ONCE at the end, so a refusal names every
  // underivable fact instead of only the first one it tripped over.
  const missing = []

  // platform / node_version are process facts: exact by construction.
  const platform = `${process.platform}-${process.arch}`
  const nodeVersion = process.version

  let pnpmVersion = null
  const pkgPath = join(root, 'package.json')
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
      const pm = String(pkg.packageManager ?? '')
      const m = /^pnpm@(.+)$/.exec(pm)
      if (m) pnpmVersion = m[1]
    } catch { /* falls through to the missing list below */ }
  }
  if (pnpmVersion === null) missing.push(`pnpm_version: no packageManager "pnpm@<version>" in ${pkgPath}`)

  let hostCommit = null
  try {
    hostCommit = hostPinFromPaths(root)
  } catch (e) {
    missing.push(e.message)
  }

  // A host checkout that is NOT the pin must not be keyed: the key would claim the pin's identity
  // for a different tree. Only checked when a git checkout is actually present.
  if (hostCommit !== null && existsSync(join(host, '.git'))) {
    const head = gitOut(['rev-parse', 'HEAD'], host)
    if (head !== null && head !== hostCommit) {
      throw new KeyRefusal('HOST_CHECKOUT_DRIFT', `host_commit: ${host} is at ${head} but tests/paths.mjs pins ${hostCommit} — a drifted host tree cannot be keyed as the pin`)
    }
    // HEAD alone is not the tree: a dirty checkout at the pin would be keyed as the pin's bytes.
    const dirty = gitOut(['status', '--porcelain'], host)
    if (dirty !== null && dirty.trim() !== '') {
      throw new KeyRefusal('HOST_CHECKOUT_DIRTY', `host_commit: ${host} is at the pinned commit but has uncommitted changes (${dirty.trim().split('\n').length} path(s)) — a dirty host cannot be keyed as the pin`)
    }
  }

  let hostLock = null
  const hostLockPath = join(host, 'pnpm-lock.yaml')
  if (existsSync(hostLockPath)) hostLock = digestFile(hostLockPath)
  else missing.push(`host_lock_digest: ${hostLockPath} is absent (provision/build the host, or pass --host-dir)`)

  let hostBuildFlags = null
  const workflowPath = join(root, HOST_WORKFLOW)
  const workflowText = existsSync(workflowPath) ? readFileSync(workflowPath, 'utf8') : null
  if (workflowText === null) {
    missing.push(`host_build_flags_digest: ${workflowPath} is absent`)
  } else {
    const step = extractStepText(workflowText, HOST_BUILD_STEP)
    if (step === null) missing.push(`host_build_flags_digest: ${workflowPath} has no step named "${HOST_BUILD_STEP}"`)
    else hostBuildFlags = `sha256:${sha256Hex(step)}`
  }

  const productMergeTree = gitOut(['rev-parse', 'HEAD^{tree}'], root)
  if (productMergeTree === null || !/^[0-9a-f]{40}$/.test(productMergeTree)) {
    missing.push(`product_merge_tree: ${root} is not a git checkout with a readable HEAD^{tree}`)
  }

  let productLock = null
  const productLockPath = join(root, 'pnpm-lock.yaml')
  if (existsSync(productLockPath)) productLock = digestFile(productLockPath)
  else missing.push(`product_lock_digest: ${productLockPath} is absent`)

  const tsconfigPath = join(root, 'tsconfig.base.json')
  let repoBuild = null
  if (workflowText !== null) {
    const step = extractStepText(workflowText, REPO_BUILD_STEP)
    if (step !== null) repoBuild = `sha256:${sha256Hex(step)}`
  }
  if (!existsSync(tsconfigPath)) missing.push(`toolchain_config_digest: ${tsconfigPath} is absent`)
  if (repoBuild === null) missing.push(`toolchain_config_digest: ${HOST_WORKFLOW} has no step named "${REPO_BUILD_STEP}"`)

  if (missing.length > 0) throw new KeyRefusal('HOST_CACHE_FACT_MISSING', missing.join(' ;; '))

  const toolchain = `sha256:${sha256Hex(canonicalJson({
    node_version: nodeVersion,
    pnpm_version: pnpmVersion,
    tsconfig_base_digest: digestFile(tsconfigPath),
    host_build_flags_digest: hostBuildFlags,
    repo_build_flags_digest: repoBuild,
  }))}`

  return {
    platform,
    node_version: nodeVersion,
    pnpm_version: pnpmVersion,
    host_commit: hostCommit,
    host_lock_digest: hostLock,
    host_build_flags_digest: hostBuildFlags,
    product_merge_tree: productMergeTree,
    product_lock_digest: productLock,
    toolchain_config_digest: toolchain,
  }
}

/**
 * The §3 key object, with the two layers kept separate.
 *
 * `host_key` is what a Host cache may be shared on: it must NOT include the product tree, or a
 * host built once could never be reused by another PR (review finding: hashing all nine fields for
 * the host artifact made Host hits impossible).
 * `product_key` is the layer above it. `key` is the composite of both, kept for the record and for
 * callers that want "this exact host for this exact tree".
 */
export function hostCacheKey(facts) {
  const absent = KEY_FIELDS.filter((f) => facts?.[f] === undefined || facts?.[f] === null || String(facts[f]) === '')
  if (absent.length > 0) {
    throw new KeyRefusal('HOST_CACHE_KEY_FACT_MISSING', `hostCacheKey needs every §3 field; missing: ${absent.join(', ')}`)
  }
  const body = {}
  for (const f of KEY_FIELDS) body[f] = String(facts[f])
  const hostBody = {}
  for (const f of HOST_KEY_FIELDS) hostBody[f] = body[f]
  const productBody = {}
  for (const f of PRODUCT_KEY_FIELDS) productBody[f] = body[f]
  return {
    ...body,
    host_key: `sha256:${sha256Hex(canonicalJson(hostBody))}`,
    product_key: `sha256:${sha256Hex(canonicalJson(productBody))}`,
    key: `sha256:${sha256Hex(canonicalJson(body))}`,
  }
}

/** Walk a tree into a manifest. `.git` and the recorded manifest itself are excluded (see header). */
export function manifestOf(dir, { exclude = [ARTIFACT_MANIFEST] } = {}) {
  const root = resolve(dir)
  const entries = []
  const walk = (abs) => {
    for (const name of readdirSync(abs).sort()) {
      const full = join(abs, name)
      const rel = relative(root, full).replace(/\\/g, '/')
      if (rel === '.git' || rel.startsWith('.git/')) continue
      if (exclude.includes(rel)) continue
      const st = lstatSync(full)
      if (st.isSymbolicLink()) {
        entries.push(`l\t${rel}\t${readlinkSync(full)}`)
      } else if (st.isDirectory()) {
        walk(full)
      } else if (st.isFile()) {
        entries.push(`f\t${rel}\t${st.size}\t${sha256Hex(readFileSync(full))}`)
      } else {
        entries.push(`o\t${rel}\t${st.size}`)
      }
    }
  }
  walk(root)
  entries.sort()
  const body = [MANIFEST_SCHEMA, ...entries].join('\n')
  return { file_count: entries.length, manifest_digest: `sha256:${sha256Hex(body)}`, entries }
}

/**
 * Record the artifact's identity next to its bytes. This is the PRODUCER half: a trusted build
 * runs it after a successful build; verification then compares what was recorded with what is
 * expected. Writing it by hand proves nothing (see the header's limits).
 */
export function recordHostArtifact({ dir, facts }) {
  if (!dir) throw new KeyRefusal('HOST_CACHE_NO_DIR', 'recordHostArtifact needs a directory')
  if (!existsSync(dir) || !statSync(dir).isDirectory()) throw new KeyRefusal('HOST_CACHE_NO_DIR', `${dir} is not a directory`)
  const key = hostCacheKey(facts)
  const manifest = manifestOf(dir)
  const record = {
    schema: MANIFEST_SCHEMA,
    ...Object.fromEntries(KEY_FIELDS.map((f) => [f, key[f]])),
    host_key: key.host_key,
    product_key: key.product_key,
    key: key.key,
    file_count: manifest.file_count,
    manifest_digest: manifest.manifest_digest,
  }
  writeFileSync(join(dir, ARTIFACT_MANIFEST), `${JSON.stringify(record, null, 2)}\n`)
  return record
}

const infra = (reasons, extra = {}) => ({ verdict: 'INFRA_ERROR', reasons, ...extra })

/**
 * Verify an artifact against an expected key/identity. See the header for the three verdicts and
 * for what this cannot prove. Order matters: a missing expected fact is an INFRA_ERROR before any
 * directory is touched, because "no expectation" must never read as "anything matches".
 */
export function verifyHostArtifact({ dir, expect } = {}) {
  if (!dir) return infra(['EXPECT_DIR_MISSING: verifyHostArtifact needs a directory to verify'])
  const absent = IDENTITY_FIELDS.filter((f) => expect?.[f] === undefined || expect?.[f] === null || String(expect[f]) === '')
  if (absent.length > 0) return infra([`EXPECT_FACT_MISSING: ${absent.join(', ')} — an expectation without the identity fields cannot accept any artifact`])

  const root = resolve(dir)
  if (!existsSync(root)) return { verdict: 'MISS', reasons: [`ARTIFACT_DIR_ABSENT: ${root} does not exist — a miss is "build it", never "nothing to run"`] }
  if (!statSync(root).isDirectory()) return infra([`ARTIFACT_DIR_NOT_A_DIRECTORY: ${root}`])

  const entry = join(root, ENTRY_POINT)
  if (!existsSync(entry)) return infra([`ENTRY_POINT_MISSING: ${ENTRY_POINT} is absent under ${root} — the build produced no runnable CLI`])
  if (!statSync(entry).isFile()) return infra([`ENTRY_POINT_NOT_A_FILE: ${ENTRY_POINT} under ${root} is not a regular file`])

  const recordPath = join(root, ARTIFACT_MANIFEST)
  if (!existsSync(recordPath)) return infra([`MANIFEST_MISSING: ${ARTIFACT_MANIFEST} is absent under ${root} — content without a recorded identity proves nothing`])
  let recorded
  try {
    recorded = JSON.parse(readFileSync(recordPath, 'utf8'))
  } catch (e) {
    return infra([`MANIFEST_UNREADABLE: ${ARTIFACT_MANIFEST}: ${String(e && e.message ? e.message : e)}`])
  }

  const reasons = []
  for (const f of IDENTITY_FIELDS) {
    if (String(recorded?.[f] ?? '') !== String(expect[f])) {
      reasons.push(`IDENTITY_MISMATCH: ${f} recorded=${String(recorded?.[f] ?? 'absent')} expected=${String(expect[f])}`)
    }
  }
  // The HOST key is the sharing unit: compare it when the caller supplies it. A host artifact
  // recorded with a different product tree must still verify for HOST use (that is the point of
  // splitting the layers), so only host_key is required here.
  if (expect.host_key !== undefined && String(recorded?.host_key ?? '') !== String(expect.host_key)) {
    reasons.push(`IDENTITY_MISMATCH: host_key recorded=${String(recorded?.host_key ?? 'absent')} expected=${String(expect.host_key)}`)
  }
  // When the caller also supplies the composite key, the whole §3 tuple is compared — a key that
  // disagrees with the recorded identity is a contradiction even if the three identity fields match.
  if (expect.key !== undefined && String(recorded?.key ?? '') !== String(expect.key)) {
    reasons.push(`IDENTITY_MISMATCH: key recorded=${String(recorded?.key ?? 'absent')} expected=${String(expect.key)}`)
  }
  if (reasons.length > 0) return infra(reasons, { recorded, artifact: { dir: root } })

  const manifest = manifestOf(root)
  if (recorded.file_count !== manifest.file_count) {
    reasons.push(`FILE_COUNT_MISMATCH: recorded=${String(recorded.file_count)} measured=${String(manifest.file_count)}`)
  }
  if (recorded.manifest_digest !== manifest.manifest_digest) {
    reasons.push(`CONTENT_DIGEST_MISMATCH: recorded=${String(recorded.manifest_digest)} measured=${String(manifest.manifest_digest)}`)
  }
  const artifact = { dir: root, file_count: manifest.file_count, manifest_digest: manifest.manifest_digest }
  if (reasons.length > 0) return infra(reasons, { recorded, artifact })
  return { verdict: 'OK', reasons: [], recorded, artifact }
}

export function verdictToken(result, key = null) {
  const reasons = result.reasons.length === 0 ? 'none' : JSON.stringify(result.reasons.slice(0, 3).join(' ;; '))
  return `DSH-HOST-CACHE verdict=${result.verdict}${key ? ` key=${key}` : ''} reasons=${reasons}`
}

// ───────────────────────────────────────────────────────────────────────────── cli ──

const HELP = [
  'usage: node scripts/host-cache-key.mjs --key [--repo-root DIR] [--host-dir DIR] [--json]',
  '       node scripts/host-cache-key.mjs --record --dir DIR --expect FILE',
  '       node scripts/host-cache-key.mjs --verify --dir DIR --expect FILE [--json]',
  '       node scripts/host-cache-key.mjs --self-test',
  '',
  '  --expect FILE  a JSON object carrying the §3 fields (the --key --json output, or a subset',
  '                 containing at least host_commit/host_lock_digest/toolchain_config_digest)',
  '',
].join('\n')

function selfTest() {
  const cases = []
  const ok = (label, cond, detail = '') => cases.push([label, cond, detail])
  const dir = mkdtempSync(join(tmpdir(), 'tinf-m3-key-'))
  const facts = {
    platform: 'linux-x64',
    node_version: 'v24.21.0',
    pnpm_version: '11.7.0',
    host_commit: 'a'.repeat(40),
    host_lock_digest: 'sha256:'.padEnd(71, 'b'),
    host_build_flags_digest: 'sha256:'.padEnd(71, 'c'),
    product_merge_tree: 'd'.repeat(40),
    product_lock_digest: 'sha256:'.padEnd(71, 'e'),
    toolchain_config_digest: 'sha256:'.padEnd(71, 'f'),
  }
  const k = hostCacheKey(facts)
  ok('the key is a sha256 over the nine fields', /^sha256:[0-9a-f]{64}$/.test(k.key), k.key)
  const reordered = Object.fromEntries(Object.entries(facts).reverse())
  ok('field order cannot change the key', hostCacheKey(reordered).key === k.key, hostCacheKey(reordered).key)
  let changed = 0
  for (const f of KEY_FIELDS) {
    if (hostCacheKey({ ...facts, [f]: `${facts[f]}-x` }).key !== k.key) changed += 1
  }
  ok('every one of the nine fields changes the key when it changes', changed === KEY_FIELDS.length, String(changed))
  let refused = false
  try { hostCacheKey({ ...facts, platform: '' }) } catch (e) { refused = e.code === 'HOST_CACHE_KEY_FACT_MISSING' }
  ok('a missing key field refuses instead of substituting a placeholder', refused, 'refused')

  // Artifact round-trip: build a tiny tree, record it, verify it.
  const art = join(dir, 'host')
  writeFileSync(join(dir, 'placeholder.txt'), 'x')
  execFileSync('mkdir', ['-p', join(art, 'apps/cli/lib')])
  writeFileSync(join(art, 'apps/cli/lib/bin.js'), '#!/usr/bin/env node\nconsole.log(1)\n')
  writeFileSync(join(art, 'package.json'), '{"name":"host"}\n')
  recordHostArtifact({ dir: art, facts })
  ok('a freshly recorded artifact verifies OK', verifyHostArtifact({ dir: art, expect: facts }).verdict === 'OK', JSON.stringify(verifyHostArtifact({ dir: art, expect: facts })))
  ok('an absent directory is MISS, not INFRA_ERROR', verifyHostArtifact({ dir: join(dir, 'nope'), expect: facts }).verdict === 'MISS', 'MISS')
  ok('a missing expected fact is INFRA_ERROR, never OK', verifyHostArtifact({ dir: art, expect: { host_commit: facts.host_commit } }).verdict === 'INFRA_ERROR', 'INFRA_ERROR')
  ok('a wrong host_commit is INFRA_ERROR', verifyHostArtifact({ dir: art, expect: { ...facts, host_commit: 'b'.repeat(40) } }).reasons.some((r) => r.startsWith('IDENTITY_MISMATCH')), 'mismatch')

  writeFileSync(join(art, 'package.json'), '{"name":"host!"}\n')
  const tampered = verifyHostArtifact({ dir: art, expect: facts })
  ok('a one-byte change is INFRA_ERROR/CONTENT_DIGEST_MISMATCH', tampered.verdict === 'INFRA_ERROR' && tampered.reasons.some((r) => r.startsWith('CONTENT_DIGEST_MISMATCH')), JSON.stringify(tampered.reasons))

  const removed = join(dir, 'host-no-entry')
  execFileSync('mkdir', ['-p', removed])
  writeFileSync(join(removed, 'package.json'), '{}\n')
  recordHostArtifact({ dir: removed, facts })
  const noEntry = verifyHostArtifact({ dir: removed, expect: facts })
  ok('a missing entry point is INFRA_ERROR/ENTRY_POINT_MISSING', noEntry.verdict === 'INFRA_ERROR' && noEntry.reasons.some((r) => r.startsWith('ENTRY_POINT_MISSING')), JSON.stringify(noEntry.reasons))

  const unrecorded = join(dir, 'host-unrecorded')
  execFileSync('mkdir', ['-p', join(unrecorded, 'apps/cli/lib')])
  writeFileSync(join(unrecorded, 'apps/cli/lib/bin.js'), 'x\n')
  const noManifest = verifyHostArtifact({ dir: unrecorded, expect: facts })
  ok('content without a recorded manifest is INFRA_ERROR', noManifest.verdict === 'INFRA_ERROR' && noManifest.reasons.some((r) => r.startsWith('MANIFEST_MISSING')), JSON.stringify(noManifest.reasons))

  ok('canonical JSON sorts keys at every level', canonicalJson({ b: 1, a: { d: 2, c: 3 } }) === '{"a":{"c":3,"d":2},"b":1}', canonicalJson({ b: 1, a: { d: 2, c: 3 } }))
  ok('a step text is extracted by name', (extractStepText('steps:\n  - name: Build the pristine host (x)\n    run: |\n      pnpm run build\n  - name: Next\n', 'Build the pristine host') ?? '').includes('pnpm run build'), 'step')

  let bad = 0
  for (const [label, cond, detail] of cases) {
    if (!cond) bad += 1
    process.stdout.write(`  ${cond ? 'ok  ' : 'FAIL'} ${label}${cond ? '' : `: ${detail}`}\n`)
  }
  process.stdout.write(`DSH-HOST-CACHE-KEY-SELFTEST ${bad === 0 ? 'PASS' : 'FAIL'} cases=${String(cases.length)} failed=${String(bad)}\n`)
  return bad === 0 ? 0 : 1
}

function refuse(code, detail) {
  process.stdout.write(`REFUSED ${code}: ${detail}\n`)
  return 2
}

function main(argv) {
  const opts = { key: false, verify: false, record: false, selfTest: false, help: false, json: false, dir: null, expect: null, repoRoot: process.cwd(), hostDir: null }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--key') opts.key = true
    else if (a === '--verify') opts.verify = true
    else if (a === '--record') opts.record = true
    else if (a === '--self-test') opts.selfTest = true
    else if (a === '--json') opts.json = true
    else if (a === '--help' || a === '-h') opts.help = true
    else if (a === '--dir') opts.dir = argv[++i] ?? null
    else if (a === '--expect') opts.expect = argv[++i] ?? null
    else if (a === '--repo-root') opts.repoRoot = argv[++i] ?? null
    else if (a === '--host-dir') opts.hostDir = argv[++i] ?? null
    else return refuse('UNKNOWN_ARGUMENT', `${a} (see --help)`)
  }
  if (opts.help) { process.stdout.write(HELP); return 0 }
  if (opts.selfTest) return selfTest()
  const modes = [opts.key, opts.verify, opts.record].filter(Boolean).length
  if (modes !== 1) return refuse('NO_MODE', 'give exactly one of --key, --record, --verify (or --self-test)')

  if (opts.key) {
    let facts
    try {
      facts = deriveHostCacheFacts({ repoRoot: opts.repoRoot, hostDir: opts.hostDir })
    } catch (e) {
      return refuse(e.code ?? 'HOST_CACHE_FACTS_FAILED', String(e.message ?? e))
    }
    const key = hostCacheKey(facts)
    if (opts.json) process.stdout.write(`${JSON.stringify({ schema: KEY_SCHEMA, ...key }, null, 2)}\n`)
    else process.stdout.write(`${verdictToken({ verdict: 'KEY', reasons: [] }, key.key)}\n  ${KEY_FIELDS.map((f) => `${f}=${key[f]}`).join('\n  ')}\n`)
    return 0
  }

  if (opts.expect === null) return refuse('NO_EXPECT', `${opts.verify ? '--verify' : '--record'} needs --expect FILE (a JSON object with the §3 fields)`)
  if (opts.dir === null) return refuse('NO_DIR', `${opts.verify ? '--verify' : '--record'} needs --dir DIR`)
  let expect
  try {
    expect = JSON.parse(readFileSync(resolve(process.cwd(), opts.expect), 'utf8'))
  } catch (e) {
    return refuse('EXPECT_UNREADABLE', `${opts.expect}: ${String(e && e.message ? e.message : e)}`)
  }

  if (opts.record) {
    let record
    try {
      record = recordHostArtifact({ dir: resolve(process.cwd(), opts.dir), facts: expect })
    } catch (e) {
      return refuse(e.code ?? 'HOST_CACHE_RECORD_FAILED', String(e.message ?? e))
    }
    process.stdout.write(`DSH-HOST-CACHE-RECORD verdict=RECORDED dir=${resolve(process.cwd(), opts.dir)} key=${record.key} files=${String(record.file_count)} manifest=${record.manifest_digest}\n`)
    return 0
  }

  const result = verifyHostArtifact({ dir: resolve(process.cwd(), opts.dir), expect })
  process.stdout.write(`${opts.json ? JSON.stringify(result, null, 2) : verdictToken(result, expect.key ?? null)}\n`)
  return result.verdict === 'OK' ? 0 : result.verdict === 'MISS' ? 3 : 1
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (invokedDirectly) process.exit(main(process.argv.slice(2)))
