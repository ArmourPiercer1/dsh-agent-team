/**
 * binding-digests.test.mjs — the G4-R C1 for the RUN binding cells.
 *
 * Every cell is RECOMPUTED here from what a cold reader can open, and every
 * one is tamper-tested (RED) before it is trusted (GREEN):
 *
 *   F1  oracle closure  dynamic imports and out-of-tree repo files are bound
 *                       (suite 120 → packages/tools/agent-state-family/src/
 *                       fs-state-store.mjs); a non-literal `import(x)` fails
 *                       the cell closed; one byte in a dynamically imported
 *                       file flips the digest.
 *   F2  oracle law      `sources` are repo-relative posix paths under the
 *                       recorded hashLaw, so the digest recomputes in a
 *                       DIFFERENT checkout root; the artifact is cited
 *                       evidence and eb3-run-manifest grades it.
 *   F3  profile proof   the recorded digest is the hash of the bytes written
 *                       for the launch, and a writer that mutates the launch
 *                       file between capture and spawn sets
 *                       `composedProfileDigestMismatch` and fails the proof.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { context, validateRunRecord } from '../../scripts/eb3-run-manifest.mjs'
import { createRunRecord, readAuthorityBinding } from './lib/run-record.mjs'
import {
  ORACLE_HASH_LAW, bindWorldProfile, captureOracleBinding, captureProfileBinding,
  recomputeWorldOracle, trustedSourcesUnavailable, verifyProfileBindingLaunched,
} from './lib/binding-digests.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
const scratch = (name) => mkdtempSync(join(tmpdir(), `u7-g4r-${name}-`))
const ASTORE_STORE_REL = 'packages/tools/agent-state-family/src/fs-state-store.mjs'

/** Capture the oracle of a real collected suite exactly as the runner does. */
const captureSuite = (suite, file, dir) => captureOracleBinding({
  artifactPath: join(ROOT, 'tests/world-factory/suites', file),
  evidencePath: join(dir, `${suite}.oracle.json`),
  sourceRoot: join(ROOT, 'tests/world-factory'),
  repoRoot: ROOT,
  suite,
})

/** Copy a recorded source list into a DIFFERENT root, preserving rel paths. */
const relocate = (sources, targetRoot) => {
  for (const rel of sources) {
    const dest = join(targetRoot, rel)
    mkdirSync(dirname(dest), { recursive: true })
    copyFileSync(join(ROOT, rel), dest)
  }
  return targetRoot
}

// ── F1 ─────────────────────────────────────────────────────────────────────
test('C1-F1a the oracle closure follows dynamic imports out of tests/world-factory', () => {
  const dir = scratch('closure-')
  const binding = captureSuite('u7-astore', '120-u7-astore.mjs', dir)
  const sources = binding.worldOracle.sources
  // The proven miss: suite 120 dynamic-imports the PRODUCTION store at
  // suites/120-u7-astore.mjs:79 and :247 through pathToFileURL(join(REPO_ROOT,…)).
  assert.ok(sources.includes(ASTORE_STORE_REL), `suite 120 closure must bind ${ASTORE_STORE_REL}, got ${JSON.stringify(sources)}`)
  assert.equal(binding.worldOracle.complete, true, `closure must be complete, disclosures: ${JSON.stringify(binding.worldOracle.unresolvedDynamicImports)}`)
  // …and the closure still contains the suite + its expected-answer assemblies.
  assert.ok(sources.includes('tests/world-factory/suites/120-u7-astore.mjs'))
  assert.ok(sources.includes('tests/world-factory/lib/u7astore-assembly.mjs'))
  // Bare specifiers are disclosed, never followed into node/host bytes.
  assert.ok(binding.worldOracle.externalSpecifiers.every((s) => !s.startsWith('.')))
  assert.ok(binding.worldOracle.externalSpecifiers.includes('node:fs'))
  // The launcher helper is EXCLUDED and that exclusion is DISCLOSED.
  assert.ok(!sources.includes('tests/world-factory/lib/world-factory.mjs'))
  assert.deepEqual(binding.worldOracle.excludedHelpers, ['tests/world-factory/lib/world-factory.mjs'])
  console.log(`C1-F1a GREEN: u7-astore binds ${sources.length} sources incl. ${ASTORE_STORE_REL}`)
})

test('C1-F1b a non-literal dynamic import fails the closure closed (complete:false)', () => {
  const root = scratch('dyn-')
  writeFileSync(join(root, 'leaf.mjs'), 'export const expected = "PASS";\n')
  writeFileSync(join(root, 'entry.mjs'), 'import { expected } from "./leaf.mjs";\nconst x = "./leaf.mjs";\nconst mod = await import(x);\nexport const verdict = expected === mod.expected ? "PASS" : "FAIL";\n')
  const binding = captureOracleBinding({ artifactPath: join(root, 'entry.mjs'), evidencePath: join(root, 'entry.oracle.json'), repoRoot: root, suite: 'fixture-non-literal' })
  assert.equal(binding.worldOracle.complete, false, 'a computed dynamic-import specifier must fail the cell closed')
  assert.deepEqual(binding.worldOracle.unresolvedDynamicImports, ['entry.mjs:3'], 'the unresolved edge is named as file:line')
  console.log(`C1-F1b GREEN: import(x) -> complete:false ${JSON.stringify(binding.worldOracle.unresolvedDynamicImports)}`)
})

test('C1-F1c one byte inside a dynamically imported file turns the digest RED', () => {
  const root = scratch('dynmut-')
  writeFileSync(join(root, 'leaf.mjs'), 'export const expected = "PASS";\n')
  writeFileSync(join(root, 'entry.mjs'), 'import { pathToFileURL } from "node:url";\nconst mod = await import(new URL("./leaf.mjs", import.meta.url).href);\nexport const verdict = mod.expected;\n')
  const binding = captureOracleBinding({ artifactPath: join(root, 'entry.mjs'), evidencePath: join(root, 'entry.oracle.json'), repoRoot: root, suite: 'fixture-dyn-mut' })
  assert.ok(binding.worldOracle.sources.includes('leaf.mjs'), 'import(new URL(lit, import.meta.url).href) is followed')
  assert.equal(recomputeWorldOracle({ bindings: binding }, root).matches, true, 'the recorded digest recomputes')
  writeFileSync(join(root, 'leaf.mjs'), 'export const expected = "FALSE";\n')
  const after = recomputeWorldOracle({ bindings: binding }, root)
  assert.equal(after.matches, false, 'C1-F1c mutation of a DYNAMICALLY imported answer file must turn the oracle RED')
  console.log('C1-F1c RED: one byte in the dynamically imported file no longer matches the digest')
})

// ── F2 ─────────────────────────────────────────────────────────────────────
test('C1-F2 sources are repo-relative and the digest recomputes in ANOTHER checkout root', () => {
  // The artifact goes UNDER THE REPO ROOT, because only an in-repo artifact
  // can be cited as evidence and graded by eb3-run-manifest.
  const dir = join(ROOT, '.artifacts/tmp/u7-g4r-c1')
  mkdirSync(dir, { recursive: true })
  const binding = captureSuite('u7-astore', '120-u7-astore.mjs', dir)
  const oracle = binding.worldOracle
  assert.equal(oracle.hashLaw, ORACLE_HASH_LAW, 'the record states the law the code implements')
  for (const s of oracle.sources) {
    assert.ok(!s.startsWith('/') && !s.includes('\\') && !s.startsWith('../'), `source ${s} is not repo-relative`)
  }
  assert.deepEqual([...oracle.sources].sort(), oracle.sources, 'sources are in the recorded (hashing) order')
  // In-repo recompute, then the SAME list under a different checkout root.
  assert.equal(recomputeWorldOracle({ bindings: binding }, ROOT).matches, true)
  const otherRoot = relocate(oracle.sources, scratch('checkout-'))
  const moved = recomputeWorldOracle({ bindings: binding }, otherRoot)
  assert.equal(moved.digest, binding.worldOracleDigest, 'the digest is a function of repo-relative path + bytes, not of the checkout location')
  assert.equal(moved.matches, true)
  // The retained artifact is CITED evidence and eb3-run-manifest grades it.
  assert.equal(oracle.evidence.length, 1)
  const cited = join(ROOT, oracle.evidence[0].path)
  assert.equal(sha(cited), oracle.evidence[0].sha256, 'the cited artifact hashes to the recorded sha256')
  assert.equal(readFileSync(cited, 'utf8').includes(ORACLE_HASH_LAW), true, 'the artifact carries the law + byte copies')
  console.log(`C1-F2 GREEN: ${oracle.sources.length} relative sources recompute under ${otherRoot}`)
})

// ── F3 ─────────────────────────────────────────────────────────────────────
test('C1-F3 the profile digest is the launched bytes; a writer mutating before spawn is RED', () => {
  const dir = scratch('profile-')
  const launch = join(dir, 'cordis.patch.yml')
  writeFileSync(launch, '# exact launch bytes\n- insert:\n    - id: u5\n')
  // GREEN: capture hashes the buffer written for the launch; the evidence copy
  // is that same buffer; the post-spawn re-read agrees.
  const ok = captureProfileBinding({ patchFile: launch, logDir: join(dir, 'evidence'), worldId: 'green' })
  assert.equal(ok.composedProfileDigest, sha(launch))
  assert.equal(ok.artifactDigest, ok.composedProfileDigest, 'the retained artifact IS the hashed launch bytes')
  assert.equal(verifyProfileBindingLaunched(ok).composedProfileDigestMismatch, false)
  const bindings = {}
  bindWorldProfile(bindings, ok)
  bindWorldProfile(bindings, ok) // the post-spawn re-publish must not duplicate
  assert.deepEqual(bindings.composedProfileDigest, { green: [ok.composedProfileDigest] })
  assert.equal(bindings.profileArtifacts.length, 1)
  assert.equal(bindings.composedProfileDigestMismatch, undefined)

  // RED: the injected writer mutates the launch file AFTER capture, BEFORE the
  // spawn — exactly what "we hashed what we launched" must refuse.
  const tampered = captureProfileBinding({ patchFile: launch, logDir: join(dir, 'evidence'), worldId: 'red' })
  const injectedWriterThatMutatesBeforeSpawn = (path) => writeFileSync(path, `${readFileSync(path, 'utf8')}- insert:\n    - id: injected\n`)
  injectedWriterThatMutatesBeforeSpawn(launch) // the "launcher" rewrites the patch it was handed
  assert.throws(() => verifyProfileBindingLaunched(tampered), /profile binding mismatch/)
  assert.equal(tampered.composedProfileDigestMismatch, true)
  const redBindings = {}
  bindWorldProfile(redBindings, tampered)
  assert.equal(redBindings.composedProfileDigestMismatch, true, 'the record carries the mismatch flag before the run dies')
  console.log('C1-F3 RED: capture → mutate → spawn is refused (composedProfileDigestMismatch=true)')
})

// ── cells + mutation, as before (kept from the first G4-R round) ──────────
test('C1 binding digests equal exact artifacts, mutation is RED, and RUN schema accepts cells', () => {
  const dir = scratch('cells-')
  const launch = join(dir, 'cordis.patch.yml')
  const oracle = join(dir, 'oracle.mjs')
  writeFileSync(launch, '# exact launch bytes\n- insert:\n    - id: u5\n')
  writeFileSync(oracle, 'export const answer = "PASS";\n')
  const profile = captureProfileBinding({ patchFile: launch, logDir: join(dir, 'evidence'), worldId: 'u5-c1' })
  const oracleBinding = captureOracleBinding({ artifactPath: oracle, evidencePath: join(dir, 'evidence', 'oracle.json'), repoRoot: dir })
  assert.equal(profile.composedProfileDigest, sha(profile.artifactPath))
  assert.equal(recomputeWorldOracle({ bindings: oracleBinding }, dir).matches, true)
  writeFileSync(oracle, `${readFileSync(oracle, 'utf8')}x`)
  assert.equal(recomputeWorldOracle({ bindings: oracleBinding }, dir).matches, false, 'oracle one-byte mutation is RED')
  console.log('C1 MUTATION RED: profile + oracle one-byte tamper rejected')

  const before = profile.composedProfileDigest
  writeFileSync(profile.artifactPath, `${readFileSync(profile.artifactPath, 'utf8')}x`)
  assert.notEqual(sha(profile.artifactPath), before, 'C1 mutation must turn the digest RED')

  // A full RUN record carrying every new cell — plus the oracle artifact as
  // CITED evidence — must validate through the real EB3 validator and CLI.
  const citedPath = join(ROOT, '.artifacts/tmp/u7-g4r-c1/oracle-fixture.json')
  const citedBinding = captureOracleBinding({ artifactPath: oracle, evidencePath: citedPath, repoRoot: ROOT, suite: 'offline' })
  const citedBytes = readFileSync(citedPath)
  const teamSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim()
  const rr = createRunRecord({
    runId: 'u7-g4r-c1', suite: 'offline', selectedCases: ['digest-cells'],
    bindings: {
      teamSha, hostSha: context(ROOT).host.sha, authority: readAuthorityBinding(ROOT),
      composedProfileDigest: { 'u5-c1': [before] },
      trustedSourcesDigest: trustedSourcesUnavailable().trustedSourcesDigest,
      trustedSourcesUnavailableReason: trustedSourcesUnavailable().trustedSourcesUnavailableReason,
      worldOracleDigest: citedBinding.worldOracleDigest,
      worldOracle: citedBinding.worldOracle,
      hostTreeSha: context(ROOT).host.sha,
    },
  })
  rr.addCase('digest-cells', 'PASS')
  const record = rr.finalize()
  record.evidence = [...citedBinding.worldOracle.evidence]
  assert.deepEqual(validateRunRecord({ record, rel: 'fixture', ctx: context(ROOT) }).findings, [])
  // A tampered cited artifact is a finding, not a shrug.
  writeFileSync(join(ROOT, record.evidence[0].path), `${readFileSync(join(ROOT, record.evidence[0].path), 'utf8')}\n`)
  const tamperedFindings = validateRunRecord({ record, rel: 'fixture', ctx: context(ROOT) }).findings
  assert.deepEqual(tamperedFindings.map((f) => f.code), ['RUN_EVIDENCE_DIGEST_MISMATCH'])
  writeFileSync(citedPath, citedBytes) // restore, so the CLI run below grades a clean tree
  console.log('C1 GREEN: validator accepts the cited artifact; one byte on it is RUN_EVIDENCE_DIGEST_MISMATCH')

  const fixtureRel = '.artifacts/tmp/u7-g4r-c1/fixture.json'
  writeFileSync(join(ROOT, fixtureRel), JSON.stringify(record))
  const cli = execFileSync(process.execPath, ['scripts/eb3-run-manifest.mjs', '--paths', fixtureRel], { cwd: ROOT, encoding: 'utf8' })
  assert.match(cli, /EB3-RUN-MANIFEST pass records=1 strict=0 .*findings=0/, `the real CLI must grade the cited fixture clean: ${cli}`)
  console.log('C1 GREEN: eb3-run-manifest CLI grades the cited fixture (records=1 findings=0)')
})
