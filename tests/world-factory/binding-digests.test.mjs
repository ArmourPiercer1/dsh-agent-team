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
 *   F4  trusted sources (R-G4R-1a) the plane TrustSources union digest: exact-law
 *                       reproduction, order-independence, null-with-reason and
 *                       empty-set legs (never a partial or backfilled digest),
 *                       cold-reader recompute, one-byte mutation RED, per-world
 *                       profile entries through bindWorldProfile (idempotent,
 *                       relaunch-safe), and the new cells grading clean through
 *                       the real eb3 validator.
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
  ADMISSION_DOCUMENT_UNAVAILABLE, ORACLE_HASH_LAW, TRUSTED_SOURCE_FAMILY, TRUSTED_SOURCES_HASH_LAW,
  TRUSTED_SOURCES_SCHEMA, bindWorldProfile, captureOracleBinding, captureProfileBinding,
  captureTrustedSourcesBinding, computeTrustedSourcesDigest, recomputeTrustedSources,
  recomputeWorldOracle, refreshTrustedSourcesDigest, trustedSourcesUnavailable, verifyProfileBindingLaunched,
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

// ── F4 (R-G4R-1a) — the plane TrustSources digest surface ──────────────────
// Design: dev/agent-workflow/gates/R-G4R-1a-DIGEST-SURFACE.md. Every leg is checked BOTH
// green (law reproduced by hand from the recorded law string) and RED (tamper, missing
// file, empty set), because this cell's whole claim is compute-from-bytes-or-say-null.

/** Fixture trusted-source tree: three tracked-document lookalikes under a scratch root. */
const tsFixtureTree = (name) => {
  const dir = scratch(`${name}-`)
  mkdirSync(join(dir, 'dev/engineering/tool-obligations'), { recursive: true })
  const rels = TRUSTED_SOURCE_FAMILY.map((f) => f.path)
  rels.forEach((rel, i) => writeFileSync(join(dir, rel), `${rel} fixture bytes v1 (${String(i)})\n`))
  return dir
}
const tsFixtureFamily = () => TRUSTED_SOURCE_FAMILY.map((f) => ({ role: f.role, path: f.path }))

test('C1-F4a the digest equals the RECORDED LAW hand-reproduced, and is deterministic', () => {
  const dir = tsFixtureTree('ts-law')
  const binding = captureTrustedSourcesBinding({ repoRoot: dir, family: tsFixtureFamily() })
  const digest = binding.trustedSourcesDigest
  assert.match(digest, /^[0-9a-f]{64}$/, 'a computed digest is 64-hex, not null')
  assert.equal(binding.trustedSourcesUnavailableReason, undefined, 'a computable set carries no unavailable reason')
  // Hand-compute the law exactly as TRUSTED_SOURCES_HASH_LAW states it, from the entries.
  const entries = [...binding.trustedSources.sources].sort((a, b) => (`${a.role}\u0000${a.path}` < `${b.role}\u0000${b.path}` ? -1 : 1))
  const h = createHash('sha256')
  for (const e of entries) h.update(Buffer.from(e.role, 'utf8')).update(Buffer.from([0])).update(Buffer.from(e.path, 'utf8')).update(Buffer.from([0])).update(Buffer.from(e.sha256, 'utf8')).update(Buffer.from([0]))
  assert.equal(digest, h.digest('hex'), 'the implementation IS the recorded law (a reader holding only the law string reproduces the digest)')
  for (const e of binding.trustedSources.sources) assert.equal(e.sha256, sha(join(dir, e.path)), 'each entry sha256 is the source bytes hashed')
  // Anti-laundering fields the design pins.
  assert.equal(binding.trustedSources.schema, TRUSTED_SOURCES_SCHEMA)
  assert.equal(binding.trustedSources.hashLaw, TRUSTED_SOURCES_HASH_LAW, 'the cell states the law the code implements')
  assert.equal(binding.trustedSources.substituteAdoption, 'none', 'the census-substitution ruling is NOT taken by this cell')
  assert.equal(binding.trustedSources.admissionDocument.available, false)
  assert.equal(binding.trustedSources.admissionDocument.reason, ADMISSION_DOCUMENT_UNAVAILABLE, 'the runtime admission-document refusal travels verbatim inside the cell')
  // Deterministic: same bytes, fresh capture, same digest.
  assert.equal(captureTrustedSourcesBinding({ repoRoot: dir, family: tsFixtureFamily() }).trustedSourcesDigest, digest)
  console.log(`C1-F4a GREEN: law hand-reproduction == implementation (${digest.slice(0, 12)}…)`)
})

test('C1-F4a2 order-independence: entry insertion order never moves the digest', () => {
  const entries = [
    { role: 'alpha-source', path: 'a/one.json', sha256: 'a'.repeat(64) },
    { role: 'beta-source', path: 'b/two.json', sha256: 'b'.repeat(64) },
    { role: 'gamma-source', path: 'c/three.json', sha256: 'c'.repeat(64) },
  ]
  const d1 = computeTrustedSourcesDigest(entries).digest
  const d2 = computeTrustedSourcesDigest([...entries].reverse()).digest
  const d3 = computeTrustedSourcesDigest([entries[1], entries[2], entries[0]]).digest
  assert.equal(d1, d2, 'reversed insertion order produces the same digest')
  assert.equal(d1, d3, 'rotated insertion order produces the same digest')
  // One flipped byte inside one source's sha is RED.
  const tampered = entries.map((e) => (e.role === 'beta-source' ? { ...e, sha256: 'f'.repeat(64) } : e))
  assert.notEqual(computeTrustedSourcesDigest(tampered).digest, d1, 'a flipped source digest flips the union digest')
  // Duplicate identities are refused, never silently deduped.
  assert.throws(() => computeTrustedSourcesDigest([...entries, entries[0]]), /duplicate trusted-sources entry/)
  console.log('C1-F4a2 GREEN: order-independence + mutation RED + duplicate refusal')
})

test('C1-F4b null-with-reason: a missing family file mints NO digest (fail-closed, named)', () => {
  const emptyRoot = scratch('ts-missing-')
  const binding = captureTrustedSourcesBinding({ repoRoot: emptyRoot, family: tsFixtureFamily() })
  assert.equal(binding.trustedSourcesDigest, null, 'a partial union digests NOTHING — the cell says null')
  assert.equal(binding.trustedSources.digest, null)
  assert.match(binding.trustedSourcesUnavailableReason, /trusted-sources digest refused/, 'the reason is machine-recognisable')
  assert.equal(binding.trustedSources.missingSources.length, 3, 'every missing source is NAMED, none silently dropped')
  assert.deepEqual(binding.trustedSources.sources, [], 'no partial entry list is presented as a bound set')
  console.log(`C1-F4b GREEN: missing files -> null + reason (${binding.trustedSources.missingSources.length} named)`)
})

test('C1-F4c empty-set leg: an empty declared set is null-with-reason, not hash-of-nothing', () => {
  const binding = captureTrustedSourcesBinding({ repoRoot: ROOT, family: [] })
  assert.equal(binding.trustedSourcesDigest, null)
  assert.match(binding.trustedSourcesUnavailableReason, /empty/, 'the reason says the set was empty')
  assert.equal(binding.trustedSources.digest, null)
  // The legacy disclosure helper keeps its exact shape (existing readers/tests keep working).
  const legacy = trustedSourcesUnavailable()
  assert.equal(legacy.trustedSourcesDigest, null)
  assert.equal(legacy.trustedSourcesUnavailableReason, ADMISSION_DOCUMENT_UNAVAILABLE)
  assert.equal(legacy.trustedSources.digest, null)
  console.log('C1-F4c GREEN: empty set + legacy unavailable() shapes are honest nulls')
})

test('C1-F4d the real obligations family digests, recomputes cold, and one byte is RED', () => {
  const binding = captureTrustedSourcesBinding({ repoRoot: ROOT })
  assert.match(binding.trustedSourcesDigest, /^[0-9a-f]{64}$/, 'the tracked family digests from bytes on this checkout')
  const roles = binding.trustedSources.sources.map((s) => s.role)
  for (const f of TRUSTED_SOURCE_FAMILY) assert.ok(roles.includes(f.role), `family role ${f.role} is booked`)
  const rec = { bindings: { ...binding } }
  const cold = recomputeTrustedSources(rec, ROOT)
  assert.equal(cold.matches, true, 'the recorded digest AND every family sha256 re-derive from this checkout')
  assert.equal(cold.digestMatches, true)
  assert.equal(cold.bytesAgree, true)
  // Relocate the family into a DIFFERENT root, flip one byte there: bytes disagree -> RED.
  const otherRoot = scratch('ts-relocate-')
  for (const s of binding.trustedSources.sources) {
    mkdirSync(dirname(join(otherRoot, s.path)), { recursive: true })
    copyFileSync(join(ROOT, s.path), join(otherRoot, s.path))
  }
  const manifestRel = TRUSTED_SOURCE_FAMILY[0].path
  writeFileSync(join(otherRoot, manifestRel), `${readFileSync(join(otherRoot, manifestRel), 'utf8')}\n`)
  const moved = recomputeTrustedSources(rec, otherRoot)
  assert.equal(moved.digestMatches, true, 'the entry list still re-derives the digest (the law is entry-based)')
  assert.equal(moved.bytesAgree, false, 'but the ONE tampered family file no longer hashes to its booked sha256')
  assert.equal(moved.matches, false, 'C1-F4d RED: one byte in a trusted source turns the cold-reader check false')
  // A tampered ENTRY is RED too (digest law leg).
  const forged = { bindings: { trustedSources: { ...binding.trustedSources, sources: binding.trustedSources.sources.map((s, i) => (i === 0 ? { ...s, sha256: '0'.repeat(64) } : s)) } } }
  assert.equal(recomputeTrustedSources(forged, ROOT).digestMatches, false, 'a forged entry sha breaks the union digest')
  console.log('C1-F4d GREEN: real family leg recomputes; one byte + forged entry are both RED')
})

test('C1-F4e profile entries join via bindWorldProfile: refresh, idempotent, relaunch-books-both', () => {
  const dir = tsFixtureTree('ts-profile')
  const base = captureTrustedSourcesBinding({ repoRoot: dir, family: tsFixtureFamily() })
  const bindings = { ...base }
  const digestAtCapture = bindings.trustedSourcesDigest
  const launch = join(dir, 'cordis.patch.yml')
  writeFileSync(launch, '# launch bytes A\n- insert: [{id: a}]\n')
  const p1 = captureProfileBinding({ patchFile: launch, logDir: join(dir, 'ev'), worldId: 'w1' })
  bindWorldProfile(bindings, p1)
  const roles = bindings.trustedSources.sources.map((s) => s.role)
  assert.ok(roles.includes('composed-profile/w1#1'), `profile entry booked, got ${JSON.stringify(roles)}`)
  assert.notEqual(bindings.trustedSourcesDigest, digestAtCapture, 'the union digest covers the launched profile')
  const d1 = bindings.trustedSourcesDigest
  bindWorldProfile(bindings, p1) // the post-spawn re-publish must not duplicate or drift
  assert.equal(bindings.trustedSourcesDigest, d1, 're-publishing the same entry changes nothing')
  assert.equal(bindings.trustedSources.sources.filter((s) => s.role.startsWith('composed-profile/')).length, 1)
  // A relaunched World that launches DIFFERENT bytes books BOTH (no silent drop).
  const launch2 = join(dir, 'cordis-restart.patch.yml')
  writeFileSync(launch2, '# launch bytes B (post-restart)\n- insert: [{id: b}]\n')
  const p2 = captureProfileBinding({ patchFile: launch2, logDir: join(dir, 'ev'), worldId: 'w1' })
  bindWorldProfile(bindings, p2)
  assert.notEqual(bindings.trustedSourcesDigest, d1, 'the relaunched profile moves the digest')
  assert.equal(bindings.trustedSources.sources.filter((s) => s.role.startsWith('composed-profile/w1#')).length, 2, 'both profile digests are booked')
  // refresh on a legacy/absent cell is a no-op null, never an invention.
  assert.equal(refreshTrustedSourcesDigest({}), null)
  console.log('C1-F4e GREEN: profile entries refresh the union digest idempotently; relaunch books both')
})

test('C1-F4f a full RUN record with the new cells grades clean through the real EB3 validator', () => {
  const dir = join(ROOT, '.artifacts/tmp/u7-g4r-c1')
  mkdirSync(dir, { recursive: true })
  const oracle = join(dir, 'ts-oracle-entry.mjs')
  writeFileSync(oracle, 'export const answer = "PASS";\n')
  const citedPath = join(dir, 'ts-cited.oracle.json')
  const citedBinding = captureOracleBinding({ artifactPath: oracle, evidencePath: citedPath, repoRoot: ROOT, suite: 'offline' })
  const tsBinding = captureTrustedSourcesBinding({
    repoRoot: ROOT,
    extraEntries: [{ role: 'world-oracle', path: citedBinding.worldOracle.evidence[0]?.path ?? '', sha256: citedBinding.worldOracleDigest }],
  })
  const teamSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim()
  const rr = createRunRecord({
    runId: 'u7r3-g4r1a-c1', suite: 'offline', selectedCases: ['trusted-sources-cells'],
    bindings: {
      teamSha, hostSha: context(ROOT).host.sha, authority: readAuthorityBinding(ROOT),
      composedProfileDigest: {}, ...tsBinding,
      worldOracleDigest: citedBinding.worldOracleDigest, worldOracle: citedBinding.worldOracle,
      hostTreeSha: context(ROOT).host.sha,
    },
  })
  rr.addCase('trusted-sources-cells', 'PASS')
  const record = rr.finalize()
  record.evidence = [...citedBinding.worldOracle.evidence]
  assert.deepEqual(validateRunRecord({ record, rel: 'fixture', ctx: context(ROOT) }).findings, [], 'additive cells must not move the validator')
  const cellCheck = recomputeTrustedSources({ bindings: record.bindings }, ROOT)
  assert.equal(cellCheck.matches, true, 'the record-level cell cold-recomputes, oracle entry included')
  const fixtureRel = '.artifacts/tmp/u7-g4r-c1/ts-fixture.json'
  writeFileSync(join(ROOT, fixtureRel), JSON.stringify(record))
  const cli = execFileSync(process.execPath, ['scripts/eb3-run-manifest.mjs', '--paths', fixtureRel], { cwd: ROOT, encoding: 'utf8' })
  assert.match(cli, /EB3-RUN-MANIFEST pass records=1 strict=0 .*findings=0/, `the real CLI must grade the new-cell fixture clean: ${cli}`)
  console.log('C1-F4f GREEN: eb3 validator + CLI grade the trusted-sources-cell record clean (findings=0)')
})

test('C1-F4g the arc-b c-suite driver gains a recomputable oracle cell (future records emit it)', () => {
  const dir = join(ROOT, '.artifacts/tmp/u7-g4r-c1')
  mkdirSync(dir, { recursive: true })
  const driverRel = 'dev/agent-workflow/evidence/u7-tbash-l4-20261027/c2/run-c2.mjs'
  const binding = captureOracleBinding({
    artifactPath: join(ROOT, driverRel),
    evidencePath: join(dir, 'u7tb-c2-driver.oracle.json'),
    sourceRoot: dirname(join(ROOT, driverRel)),
    repoRoot: ROOT,
    suite: 'u7-team-bash-l4',
  })
  assert.ok(binding.worldOracle.sources.includes(driverRel), 'the c-suite record closes over the driver that judges it')
  assert.ok(binding.worldOracle.sources.includes('tests/world-factory/lib/u7-tbash-assembly.mjs'), 'and over the assembly holding the expected answers')
  const cold = recomputeWorldOracle({ bindings: binding }, ROOT)
  assert.equal(cold.matches, true, 'the driver-closure digest recomputes from repo-relative paths')
  console.log(`C1-F4g GREEN: u7-tbash driver closure binds ${binding.worldOracle.sources.length} sources, recompute matches (complete=${String(binding.worldOracle.complete)})`)
})
