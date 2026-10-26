/**
 * census/expected-obligations — the load side of the tracked EB2-A artifacts
 * (ExpectedToolObligations + AuthoritativeToolSources).
 *
 * Fail-closed: a malformed, schema-invalid, or digest-drifting artifact
 * THROWS. The reconciler never sees a half-validated obligation set (U6
 * census law: "失败即关闭,绝不回退" — the same discipline as
 * scripts/current-authority.mjs for the authority pointer).
 *
 * @module census/expected-obligations
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { validateAgainstSchema } from './schema-check.mjs'
import { bytesDigest } from './json-canonical.mjs'

const DIR_REL = 'dev/engineering/tool-obligations'

/** @param {string} file */
function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

/**
 * Load + validate one tracked artifact against its tracked schema.
 * @param {string} repoRoot
 * @param {string} artifactFile e.g. 'expected-tool-obligations.v1.json'
 * @param {string} schemaFile
 */
export function loadTrackedArtifact(repoRoot, artifactFile, schemaFile) {
  const bytes = readFileSync(join(repoRoot, DIR_REL, artifactFile))
  const artifact = JSON.parse(bytes.toString('utf8'))
  const schema = readJson(join(repoRoot, DIR_REL, schemaFile))
  const v = validateAgainstSchema(artifact, schema)
  if (!v.ok) {
    throw new Error(`${artifactFile} violates its tracked schema: ${JSON.stringify(v.errors.slice(0, 6))}`)
  }
  return { artifact, digest: bytesDigest(bytes) }
}

/**
 * The paired load the reconciler consumes. `__digest` is the pinned bytes
 * digest (recorded, never recomputed-into-the-content); the manifest digest
 * is cross-checked by the C1 test, not here (this module stays sync-pure).
 * @param {string} repoRoot
 */
export function loadExpectedPair(repoRoot) {
  const expected = loadTrackedArtifact(repoRoot, 'expected-tool-obligations.v1.json', 'expected-tool-obligations.schema.json')
  const sources = loadTrackedArtifact(repoRoot, 'authoritative-tool-sources.v1.json', 'authoritative-tool-sources.schema.json')
  return {
    expected: { ...expected.artifact, __digest: expected.digest },
    sources: { ...sources.artifact, __digest: sources.digest },
  }
}
