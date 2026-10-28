import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { context, validateRunRecord } from '../../scripts/eb3-run-manifest.mjs'
import { createRunRecord, readAuthorityBinding } from './lib/run-record.mjs'
import { captureOracleBinding, captureProfileBinding, digestFile, trustedSourcesUnavailable } from './lib/binding-digests.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const sha = (p) => digestFile(p)

test('C1 binding digests equal exact artifacts, mutation is RED, and RUN schema accepts cells', () => {
  const dir = mkdtempSync(join(tmpdir(), 'u7-g4r-c1-'))
  const launch = join(dir, 'cordis.patch.yml')
  const oracle = join(dir, 'oracle.mjs')
  writeFileSync(launch, '# exact launch bytes\n- insert:\n    - id: u5\n')
  writeFileSync(oracle, 'export const answer = "PASS";\n')
  const profile = captureProfileBinding({ patchFile: launch, logDir: join(dir, 'evidence'), worldId: 'u5-c1' })
  const oracleBinding = captureOracleBinding({ artifactPath: oracle, evidencePath: join(dir, 'evidence', 'oracle.mjs') })
  assert.equal(profile.composedProfileDigest, sha(profile.artifactPath))
  const recomputeOracle = () => {
    const hash = createHash('sha256')
    for (const path of oracleBinding.worldOracle.sources) hash.update(readFileSync(path))
    return hash.digest('hex')
  }
  assert.equal(oracleBinding.worldOracleDigest, recomputeOracle())
  writeFileSync(oracle, `${readFileSync(oracle, 'utf8')}x`)
  assert.notEqual(oracleBinding.worldOracleDigest, recomputeOracle(), 'oracle one-byte mutation is RED')
  console.log('C1 MUTATION RED: profile + oracle one-byte tamper rejected')

  const before = profile.composedProfileDigest
  writeFileSync(profile.artifactPath, `${readFileSync(profile.artifactPath, 'utf8')}x`)
  assert.notEqual(sha(profile.artifactPath), before, 'C1 mutation must turn the digest RED')

  const teamSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim()
  const rr = createRunRecord({
    runId: 'u7-g4r-c1', suite: 'offline', selectedCases: ['digest-cells'],
    bindings: {
      teamSha, hostSha: context(ROOT).host.sha, authority: readAuthorityBinding(ROOT),
      composedProfileDigest: { 'u5-c1': [before] },
      trustedSourcesDigest: trustedSourcesUnavailable().trustedSourcesDigest,
      trustedSourcesUnavailableReason: trustedSourcesUnavailable().trustedSourcesUnavailableReason,
      worldOracleDigest: oracleBinding.worldOracleDigest,
      hostTreeSha: context(ROOT).host.sha,
    },
  })
  rr.addCase('digest-cells', 'PASS')
  const record = rr.finalize()
  assert.deepEqual(validateRunRecord({ record, rel: 'fixture', ctx: context(ROOT) }).findings, [])
  const fixturePath = join(dir, 'fixture.json')
  writeFileSync(fixturePath, JSON.stringify(record))
  execFileSync(process.execPath, ['scripts/eb3-run-manifest.mjs', '--paths', fixturePath], { cwd: ROOT, encoding: 'utf8' })
})
