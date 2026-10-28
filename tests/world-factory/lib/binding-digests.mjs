/** Offline-verifiable RUN bindings. No host/private API or model claims. */
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, relative } from 'node:path'

export const digestFile = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')

/** Persist launch bytes before spawn; evidence survives home teardown. */
export function captureProfileBinding({ patchFile, logDir, worldId }) {
  if (readFileSync(patchFile).length > 1024 * 1024) throw new Error('profile binding artifact exceeds 1 MiB evidence cap')
  mkdirSync(logDir, { recursive: true })
  const path = join(logDir, `composed-profile-${digestFile(patchFile)}.patch.yml`)
  copyFileSync(patchFile, path)
  return { worldId, composedProfileDigest: digestFile(path), artifactPath: path, launchPath: patchFile,
    coverage: 'exact materialized web profile patch bytes, including comments and final newline; not a flattened upstream base bundle' }
}

/**
 * The suite's executable oracle/expected-answer artifact is its source module
 * (core uses the runner + oracle module). Hash bytes, not function.toString().
 * Additional suite-specific artifacts must be declared by the caller, not guessed.
 */
export function captureOracleBinding({ artifactPath, evidencePath, sourceRoot = dirname(artifactPath), suite = 'offline' }) {
  // Preserve the actual source bytes, not reconstructed function text. Follow
  // literal relative imports within the suite's oracle tree, including assembly
  // expected-answer constants. External product/host inputs stay team/host-bound.
  const seen = new Map()
  const visit = (path) => {
    path = resolve(path)
    if (seen.has(path)) return
    const bytes = readFileSync(path)
    seen.set(path, bytes)
    for (const match of bytes.toString('utf8').matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+\.mjs)['"]/g)) {
      const target = resolve(dirname(path), match[1])
      if (!relative(sourceRoot, target).startsWith('..') && !['world-factory.mjs', 'binding-digests.mjs', 'suites.mjs'].some((name) => target.endsWith(`/${name}`))) visit(target)
    }
  }
  visit(artifactPath)
  const files = [...seen].map(([path, bytes]) => ({ path: relative(sourceRoot, path), bytesBase64: bytes.toString('base64') })).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
  const bytes = JSON.stringify({ schema: 'u7-oracle-source-artifact/1', entry: relative(sourceRoot, artifactPath), files }) + '\n'
  if (Buffer.byteLength(bytes) > 1024 * 1024) throw new Error('oracle binding artifact exceeds 1 MiB evidence cap')
  mkdirSync(dirname(evidencePath), { recursive: true })
  writeFileSync(evidencePath, bytes)
  const digest = createHash('sha256')
  for (const file of files) digest.update(Buffer.from(file.bytesBase64, 'base64'))
  const worldOracleDigest = digest.digest('hex')
  return { worldOracleDigest, worldOracle: { suite, digest: worldOracleDigest, sources: files.map((f) => join(sourceRoot, f.path)), order: 'lexical relative path; SHA-256 over concatenated raw source bytes without separators' }, oracleArtifactPath: evidencePath,
    oracleCoverage: 'suite and literal relative mjs imports within tests/world-factory; base64 byte copies retained in artifact; external inputs remain teamSha/hostSha-bound' }
}

export function trustedSourcesUnavailable() {
  const unavailableReason = 'The runner public World/HTTP surface exposes no plane TrustedSources/admission source document or digest. authoritative-tool-sources.v1.json is census inventory, not the plane admission document; it cannot substitute.'
  return { trustedSourcesDigest: null, trustedSourcesUnavailableReason: unavailableReason,
    trustedSources: { digest: null, unavailableReason } }
}

/** Update the same live object before each boot (including restart attempts). */
export function bindWorldProfile(bindings, entry) {
  bindings.composedProfileDigest ??= {}
  bindings.composedProfileDigest[entry.worldId] ??= []
  bindings.composedProfileDigest[entry.worldId].push(entry.composedProfileDigest)
  bindings.profileArtifacts ??= []
  bindings.profileArtifacts.push(entry)
}
