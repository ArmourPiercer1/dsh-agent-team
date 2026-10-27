#!/usr/bin/env node
/**
 * diag-call-chain.test.mjs — node:test coverage for scripts/diag-call-chain.mjs (U7-3 / EB4-B).
 * No Host, no network, no port. Scratch files live under the OS temp dir and are removed.
 * Run: node --test tests/diag-call-chain/diag-call-chain.test.mjs
 *
 * The NEGATIVE CONTROL (N1–N4) is the point of this file: an input that carries a
 * credential-shaped value must never reach stdout, and the redactor must be shown to be the
 * thing that stops it (N4 runs the same input through an un-redacted render and proves the
 * backstop would have refused it).
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import test, { after } from 'node:test'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const TOOL = resolve(HERE, '..', '..', 'scripts', 'diag-call-chain.mjs')
const mod = await import(TOOL)
const scratch = mkdtempSync(join(tmpdir(), 'u7-3-diag-'))
after(() => rmSync(scratch, { recursive: true, force: true }))

const run = (args) => spawnSync(process.execPath, [TOOL, ...args], { encoding: 'utf8', timeout: 15_000 })

// Synthetic credentials, mixed case + digits so the opaque-run rule would see them too.
const SECRET_TOKEN = 'sk-Live-9fK3xQz7VbN2mT8rWs4Yd'
const SECRET_BEARER = 'Live-A7Qm2XzRt9Kd4Vn6Pb8Wy'
const SECRET_OPAQUE = 'Zx9QmR2tLk7VbN4pWs8Yd3Hf6Jc1Ga5Ue0Io2Pq7Rs9T'
const FP = `sha256:${'0e370d8e024f9e6009806ec78db2b900d0519df26cc81ebbe286350c0eccc69f'}`

test('S1 --self-test: every FACE_TABLE / KIND_STAGES / shadow citation holds at this tree', () => {
  const r = run(['--self-test'])
  assert.equal(r.status, 0, r.stdout)
  assert.match(r.stdout, /OK \d+ codes/)
})

test('S2 the self-test is not vacuous: a fixture tree without the emitters fails it', () => {
  const problems = mod.selfTest(scratch)
  assert.ok(problems.length > 10, `expected many missing-file problems, got ${String(problems.length)}`)
  assert.ok(problems.some((p) => p.startsWith('missing file')))
})

test('S3 a drifted line hint is reported as moved, a vanished token as a problem (no false red, no false green)', async () => {
  const { cpSync, mkdirSync, writeFileSync: wf, readFileSync: rf } = await import('node:fs')
  const root = join(scratch, 'drift-tree')
  const repo = resolve(HERE, '..', '..')
  for (const rel of ['packages/tools/a5p5-tools/src', 'packages/runtime/tool-admission', 'packages/runtime/tool-dispatch', 'packages/runtime/governance-center', 'packages/runtime/operation-permission', 'packages/runtime/sandbox-provider', 'packages/runtime/src/plugin/live', 'packages/domain/tool-governance/src', 'packages/tools/fs-family/src', 'packages/tools/families']) {
    mkdirSync(join(root, rel), { recursive: true })
    cpSync(join(repo, rel), join(root, rel), { recursive: true })
  }
  const pipe = join(root, 'packages/tools/a5p5-tools/src/pipeline.ts')
  wf(pipe, `// shifted\n// shifted\n${rf(pipe, 'utf8')}`)
  const moved = []
  const problems = mod.selfTest(root, moved)
  assert.deepEqual(problems, [], JSON.stringify(problems))
  assert.ok(moved.some((m) => m.includes('pipeline.ts')), JSON.stringify(moved))
  wf(pipe, rf(pipe, 'utf8').replaceAll("kind: 'refused-spill'", "kind: 'refused-SPILL-RENAMED'"))
  const after = mod.selfTest(root, [])
  assert.ok(after.some((p) => p.includes('refused-spill') && p.includes('anywhere')), JSON.stringify(after))
})

// ── family registration refusals: resolved from the descriptors, not listed (#399/#400 drift) ──

/** A temp tree carrying only the family descriptor dir (and whatever else `extra` copies). */
async function familyTree(name) {
  const { cpSync, mkdirSync } = await import('node:fs')
  const root = join(scratch, name)
  const repo = resolve(HERE, '..', '..')
  mkdirSync(join(root, 'packages/tools'), { recursive: true })
  cpSync(join(repo, 'packages/tools/families'), join(root, 'packages/tools/families'), { recursive: true })
  return root
}

test('S4 family refusal codes resolve from the reviewed descriptors: the three at this tree, a new listed family without editing the tool', async () => {
  const { readFileSync: rf, writeFileSync: wf } = await import('node:fs')
  for (const [code, descriptor] of [['PLANE_READ_REGISTRATION_REFUSED', 'fs.mjs'], ['PLANE_PROCESS_REGISTRATION_REFUSED', 'process.mjs'], ['PLANE_SEARCH_REGISTRATION_REFUSED', 'search.mjs']]) {
    const got = mod.attribute(null, code)
    assert.equal(got.verdict, 'ATTRIBUTED', `${code}: ${JSON.stringify(got)}`)
    assert.deepEqual(got.candidates.map((c) => c.face), ['plane-mount'])
    assert.deepEqual(got.candidates[0].emitters, [`packages/tools/families/${descriptor} (refusalCode:)`])
  }
  const root = await familyTree('family-new')
  const fam = join(root, 'packages/tools/families')
  wf(join(fam, 'widget.mjs'), "export default Object.freeze({ familyId: 'dsh.widget', refusalCode: 'PLANE_WIDGET_REGISTRATION_REFUSED' })\n")
  wf(join(fam, 'stray.mjs'), "export default Object.freeze({ familyId: 'dsh.stray', refusalCode: 'PLANE_STRAY_REGISTRATION_REFUSED' })\n")
  const before = mod.familyRefusalRows(root)
  assert.ok(!Object.hasOwn(before.rows, 'PLANE_WIDGET_REGISTRATION_REFUSED'), 'an UNLISTED descriptor must attribute nothing (only a listed module mounts)')
  const manifest = JSON.parse(rf(join(fam, 'manifest.json'), 'utf8'))
  manifest.families.push({ module: 'widget.mjs', sha256: '0'.repeat(64) })
  wf(join(fam, 'manifest.json'), JSON.stringify(manifest))
  const after = mod.familyRefusalRows(root)
  assert.deepEqual(after.problems, [])
  assert.deepEqual(after.rows.PLANE_WIDGET_REGISTRATION_REFUSED, [['plane-mount', 'packages/tools/families/widget.mjs', 'refusalCode:']])
  assert.ok(!Object.hasOwn(after.rows, 'PLANE_STRAY_REGISTRATION_REFUSED'), 'listing one family must not pull in an unlisted one')
})

test('S5 control: a listed descriptor that drops its refusalCode turns the self-test RED, naming the code and the file', async () => {
  const { readFileSync: rf, writeFileSync: wf } = await import('node:fs')
  const root = await familyTree('family-drop')
  const fs = join(root, 'packages/tools/families/fs.mjs')
  const src = rf(fs, 'utf8')
  const dropped = src.replace(/\n\s*refusalCode: 'PLANE_READ_REGISTRATION_REFUSED',/, '')
  assert.notEqual(dropped, src, 'the control could not stage its mutation')
  assert.deepEqual(mod.familyRefusalRows(root).problems, [], 'honest copy must be clean before the mutation')
  wf(fs, dropped)
  const problems = mod.selfTest(root)
  assert.ok(problems.some((p) => p.startsWith('PLANE_READ_REGISTRATION_REFUSED: packages/tools/families/fs.mjs no longer contains the literal')), JSON.stringify(problems))
  assert.ok(problems.some((p) => p.startsWith('packages/tools/families/fs.mjs: family descriptor carries no')), JSON.stringify(problems))
  // and the two untouched families are NOT reported (no collateral red)
  assert.ok(!problems.some((p) => /PLANE_(PROCESS|SEARCH)_REGISTRATION_REFUSED/.test(p)), JSON.stringify(problems))
})

test('S6 fail-closed: no manifest means no family code is attributable (UNKNOWN, never a guess); vocabulary-only stays NO_PRODUCTION_EMITTER', () => {
  const none = mod.familyRefusalRows(scratch)
  assert.deepEqual(none.rows, {})
  assert.ok(none.problems.some((p) => p.includes('manifest.json unreadable')), JSON.stringify(none.problems))
  assert.equal(mod.attribute(null, 'DOMAIN_DENIED').verdict, 'NO_PRODUCTION_EMITTER')
  assert.equal(mod.attribute(null, 'PLANE_WIDGET_REGISTRATION_REFUSED').verdict, 'UNKNOWN_CODE')
})

test('A1 refused-admission: attributed through the kind, fingerprint printed only in digest shape', () => {
  const r = run(['--text', `a5p5-refused kind=refused-admission code=template-deny-lane detail=${FP}`, '--json'])
  assert.equal(r.status, 0)
  const j = JSON.parse(r.stdout)
  const one = j.refusals[0]
  assert.equal(one.verdict, 'ATTRIBUTED')
  assert.deepEqual(one.candidates.map((c) => c.face), ['lane-decide'])
  assert.deepEqual(one.effectFingerprint, { state: 'present', value: FP })
  assert.equal(one.chain.invocationCorrelation, 'NOT_OBSERVABLE_FROM_INPUT')
})

test('A2 a code with several source emitters is AMBIGUOUS with every candidate named, never the first', () => {
  const r = run(['--text', `a5p5-refused kind=refused-admission code=IO_POLICY_UNSUPPORTED detail=${FP}`, '--json'])
  assert.equal(r.status, 0)
  const one = JSON.parse(r.stdout).refusals[0]
  assert.equal(one.verdict, 'AMBIGUOUS')
  const faces = one.candidates.map((c) => c.face).sort()
  // Four faces raise this code on the admission kind. `pa-default-deny-coverage` is the
  // default-deny coverage gate inside admission-kernel.ts's admitCall — the site the U7-6
  // forensics identified — and it is distinguished from the kernel proper by a site token.
  assert.deepEqual(faces, ['admission-kernel', 'assurance', 'closed-world-guard', 'pa-default-deny-coverage'])
  const cov = one.candidates.find((c) => c.face === 'pa-default-deny-coverage')
  assert.match(cov.emitters[0], /admission-kernel\.ts \(refusal: 'template-default-deny'\)/)
})

test('A3 the same code on the backend kind narrows to the shut backend face', () => {
  const r = run(['--text', 'a5p5-refused kind=backend-failed code=IO_POLICY_UNSUPPORTED detail=the production effect-face adapter for this backend is the registered GLUE-4 follow-up', '--json'])
  const one = JSON.parse(r.stdout).refusals[0]
  assert.equal(one.verdict, 'AMBIGUOUS') // shut-backend (plane) and provider both emit it on this kind
  assert.ok(one.candidates.some((c) => c.face === 'shut-backend'))
  assert.ok(!one.candidates.some((c) => c.face === 'assurance'), 'an admission face must not be offered for a backend-failed refusal')
})

test('F1 unknown code → UNKNOWN_CODE, exit 1, no nearest match', () => {
  const r = run(['--code', 'IO_POLICY_UNSUPPORTEDX', '--json'])
  assert.equal(r.status, 1)
  const one = JSON.parse(r.stdout).refusals[0]
  assert.equal(one.verdict, 'UNKNOWN_CODE')
  assert.deepEqual(one.candidates, [])
})

test('F2 an invented spill-* code is UNKNOWN (the spill set is read from source, not a prefix)', () => {
  assert.equal(run(['--code', 'spill-invented-x']).status, 1)
  assert.equal(run(['--code', 'spill-read-denied']).status, 0)
})

test('F3 a vocabulary-only code (no production emitter) is not attributed: exit 1', () => {
  const r = run(['--code', 'DOMAIN_DENIED', '--json'])
  assert.equal(r.status, 1)
  assert.equal(JSON.parse(r.stdout).refusals[0].verdict, 'NO_PRODUCTION_EMITTER')
})

test('F4 no refusal in the input → REFUSED exit 2 (empty is never "nothing wrong")', () => {
  const r = run(['--text', 'all good here, tool returned 3 matches'])
  assert.equal(r.status, 2)
  assert.match(r.stdout, /REFUSED NO_REFUSAL_FOUND/)
})

test('F5 shadow rows: only outcome=refuse counts; allow/defer rows are not refusals', () => {
  const allow = run(['--text', JSON.stringify({ leg: 'shadow-verdict', name: 'read', outcome: 'allow', code: 'OK' })])
  assert.equal(allow.status, 2)
  const refuse = run(['--text', JSON.stringify({ leg: 'shadow-verdict', name: 'read', outcome: 'refuse', code: 'SCOPE_UNVERIFIED', generation: 3 }), '--json'])
  assert.equal(refuse.status, 0)
  const one = JSON.parse(refuse.stdout).refusals[0]
  assert.match(one.stage, /SHADOW verdict \(audit-only/)
  assert.deepEqual(one.candidates.map((c) => c.face), ['center-kernel'])
})

test('F6 usage: zero or two inputs, unknown flag, --kind without --code → exit 2', () => {
  assert.equal(run([]).status, 2)
  assert.equal(run(['--text', 'x', '--code', 'GRANT_STALE']).status, 2)
  assert.equal(run(['--bogus']).status, 2)
  assert.equal(run(['--text', 'x', '--kind', 'refused-spill']).status, 2)
})

test('B1 bound: an input file over 1 MiB is REFUSED before it is read', () => {
  const big = join(scratch, 'big.txt')
  writeFileSync(big, 'x'.repeat(mod.BOUNDS.inputBytes + 1))
  const r = run(['--file', big])
  assert.equal(r.status, 2)
  assert.match(r.stdout, /INPUT_OVER_BOUND/)
})

test('B2 bound: a symlinked --file is refused (regular files only)', () => {
  const real = join(scratch, 'real.txt')
  writeFileSync(real, `a5p5-refused kind=refused-admission code=GRANT_STALE detail=${FP}\n`)
  const link = join(scratch, 'link.txt')
  symlinkSync(real, link)
  assert.equal(run(['--file', link]).status, 2)
  assert.equal(run(['--file', real]).status, 0)
})

test('B3 bound: more than 12 refusals → 12 reported, the rest counted, truncated=true', () => {
  const many = Array.from({ length: 35 }, () => `a5p5-refused kind=refused-admission code=GRANT_STALE detail=${FP}`).join('\n')
  const f = join(scratch, 'many.txt')
  writeFileSync(f, many)
  const r = run(['--file', f, '--json'])
  assert.equal(r.status, 0)
  const j = JSON.parse(r.stdout)
  assert.equal(j.reported, 12)
  assert.equal(j.seen, 35)
  assert.equal(j.truncated, true)
  assert.ok(Buffer.byteLength(r.stdout) <= mod.BOUNDS.outputBytes)
})

test('B4 bound: a free-text field is cut to the detail cap after redaction', () => {
  const r = run(['--text', `a5p5-refused kind=backend-failed code=SANDBOX_UNAVAILABLE detail=${'word '.repeat(200)}`, '--json'])
  const d = JSON.parse(r.stdout).refusals[0].detail
  assert.ok(d.length <= mod.BOUNDS.detailCap + 40, `detail length ${String(d.length)}`)
  assert.match(d, /chars cut/)
})

// ── NEGATIVE CONTROL: credential-shaped values never reach stdout ──────────────────────────

test('N1 a credential in a backend-failed detail is redacted, the rest of the detail kept', () => {
  const line = `a5p5-refused kind=backend-failed code=SANDBOX_UNAVAILABLE detail=probe failed url http://127.0.0.1:3182/?token=${SECRET_TOKEN} auth Bearer ${SECRET_BEARER}`
  for (const fmt of [[], ['--json']]) {
    const r = run(['--text', line, ...fmt])
    assert.equal(r.status, 0, r.stdout)
    assert.ok(!r.stdout.includes(SECRET_TOKEN), 'boot token leaked')
    assert.ok(!r.stdout.includes(SECRET_BEARER), 'bearer leaked')
    assert.match(r.stdout, /REDACTED/)
    assert.match(r.stdout, /probe failed/)
  }
})

test('N2 a non-digest detail on refused-admission is withheld entirely, not printed', () => {
  const r = run(['--text', `a5p5-refused kind=refused-admission code=APPROVAL_STALE detail=token=${SECRET_TOKEN}`, '--json'])
  assert.equal(r.status, 0)
  assert.ok(!r.stdout.includes(SECRET_TOKEN))
  const one = JSON.parse(r.stdout).refusals[0]
  assert.match(one.effectFingerprint.state, /^ABSENT_OR_MALFORMED/)
  assert.equal(one.detail, undefined)
})

test('N3 credentials inside a shadow-ledger row (scopeKey/callId/name) are redacted', () => {
  const row = JSON.stringify({ leg: 'shadow-verdict', name: `x ${SECRET_OPAQUE}`, scopeKey: `Bearer ${SECRET_BEARER}`, callId: `api_key=${SECRET_TOKEN}`, outcome: 'refuse', code: 'GRANT_IN_FLIGHT', generation: 2 })
  const r = run(['--text', row])
  assert.equal(r.status, 0, r.stdout)
  for (const s of [SECRET_TOKEN, SECRET_BEARER, SECRET_OPAQUE]) assert.ok(!r.stdout.includes(s), `leaked ${s.slice(0, 6)}…`)
})

test('N4 sensitivity: without redaction the same output would be caught by the backstop', () => {
  // The un-redacted rendering of N1's detail: the backstop (rule 5) must name it.
  const raw = `detail (redacted): probe failed url http://127.0.0.1:3182/?token=${SECRET_TOKEN} auth Bearer ${SECRET_BEARER}`
  const hits = mod.residualHits(raw)
  assert.ok(hits.includes('boot-token') && hits.includes('bearer'), `backstop blind: ${JSON.stringify(hits)}`)
  // …and the redacted form passes it.
  assert.deepEqual(mod.residualHits(mod.safeField(raw)), [])
  // A no-op redactor is therefore detectable: safeField must change a secret-bearing string.
  assert.notEqual(mod.safeField(raw), raw)
})

test('N5 the tool never prints the input verbatim for an unknown code (no echo channel)', () => {
  const r = run(['--code', `Bearer ${SECRET_BEARER}`])
  assert.equal(r.status, 1)
  assert.ok(!r.stdout.includes(SECRET_BEARER))
})
