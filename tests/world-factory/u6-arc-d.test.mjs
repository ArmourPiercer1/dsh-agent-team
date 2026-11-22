/**
 * u6-arc-d.test.mjs — the C1 offline tier of the `u6-arc-d` suite (U6 PR6
 * C2 / ARC-D at the Host). Same harness + idiom as world-factory.test.mjs:
 *
 *   node --test tests/world-factory/u6-arc-d.test.mjs
 *
 * The live leg (u5-canary-runner.mjs --suite u6-arc-d) boots ONE Host; this
 * file proves OFFLINE, with zero spawns: (1) the SUITE_CASES/parseArgs
 * wiring; (2) the assembly's blueprints pass the SAME closed-grammar
 * validator the host catalog runs, and the CI-03 member carries NO
 * capabilities block; (3) RETIRED-BY-A0 (round 80): the arm that mounted the
 * PR5 probe FAMILY "as shipped" retired with that lane
 * (`ute-cut-closure.allow.json#retiredSurfaces[dsh.u6-probe-family]`); its
 * retirement pin at the bottom of this file asserts the lane stays gone and
 * names the successor (`vnext-admission`); (4) makeArcDDecide answers each trigger with exactly ONE tool
 * call and closes each leg by its own fence; (5) the judge's sensitivity
 * law — a synthetic all-green digest PASSes all nine cases and EVERY
 * verdict moves when its own evidence moves; (6) the factory's u6ArcD
 * wiring (option validation + one-World-one-suite exclusion).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('G4-D recorded native failure: same mock drive reads exact effect before edit; missing observation mutation stays RED', async () => {
  const { createArcDAssembly, makeArcDDecide, judgeU6ArcD } = await import('./lib/u6-arc-d-assembly.mjs')
  const recorded = JSON.parse(readFileSync(new URL('../../dev/agent-workflow/evidence/u7-g4d-20261027/recorded-native-failure.json', import.meta.url), 'utf8'))
  assert.equal(recorded.overall, 'FAIL')
  assert.deepEqual(recorded.cases.filter((c) => c.verdict !== 'PASS').map((c) => c.id), ['arcd:ci03-native-parity'])
  assert.ok(recorded.effectNotes.heads.some((s) => s.includes('file has not been read')))
  const a = createArcDAssembly({ repoRoot: process.cwd(), home: '/tmp/g4d-replay', runStamp: 'recorded-replay', reportDir: '/tmp/g4d-replay' })
  const messages = [{ role: 'user', content: `[team-work requestToken=${a.tokens('d1')} x]` }]
  const decide = makeArcDDecide({ assembly: a })
  // Pure simulated public observation/effect receipt: no disk write or boot.
  // This executes the actual production mock driver, not a second recipe.
  let observed = false
  let bytes = `${a.files.nativeEffect.placeholder}\n`
  const calls = []
  for (let i = 0; i < 5; i += 1) {
    const reply = decide({ req: { body: { messages } } })
    if (reply.kind === 'text') break
    const call = reply.toolCalls[0]
    calls.push(call.name)
    const args = call.arguments
    if (call.name === 'read') {
      assert.equal(args.file_path, a.files.nativeEffect.path)
      observed = true
    }
    if (call.name === 'edit') {
      assert.equal(observed, true, 'recorded failure: edit without native read must remain RED')
      assert.equal(args.file_path, a.files.nativeEffect.path)
      bytes = bytes.replace(args.old_string, args.new_string)
    }
    messages.push({ role: 'assistant', content: [{ type: 'tool_use', id: `t${i}`, name: call.name, input: args }] }, { role: 'user', content: [{ type: 'tool_result', tool_use_id: `t${i}`, content: [{ type: 'text', text: 'settled' }] }] })
  }
  assert.deepEqual(calls, ['grep', 'read', 'edit'])
  const verdict = (ne) => judgeU6ArcD({ probeRows: [], markerFiles: [], markerNonces: {}, nativeEvidence: ne, hostAlive: true }).find(([id]) => id === 'arcd:ci03-native-parity')[1]
  assert.equal(verdict(recorded.nativeEvidence), 'FAIL', 'historical direct-disk oracle correctly stays RED')
  const corrected = { readFromDisk: true, present: true, contentMatches: bytes === `${a.files.nativeEffect.marker}\n` }
  assert.equal(verdict(corrected), 'PASS')
  assert.equal(verdict({ ...corrected, contentMatches: false }), 'FAIL', 'missing-read/unchanged-placeholder mutation is RED')
  assert.equal(verdict({ ...corrected, readFromDisk: false }), 'FAIL', 'tool-result-only mutation is RED')
})

const CASE_IDS = [
  'arcd:mounted', 'arcd:positive', 'arcd:spoof-zero-authority', 'arcd:swap-refused',
  'arcd:unbound-refused', 'arcd:replay-refused', 'arcd:ci03-native-parity',
  'arcd:restrict-veto', 'arcd:lift-control', 'arcd:marker-ledger', 'arcd:teardown-honest',
]

test('u6-arc-d: SUITE_CASES entry and parseArgs wiring', async () => {
  const { SUITE_CASES, parseArgs } = await import('./u5-canary-runner.mjs')
  assert.deepEqual(SUITE_CASES['u6-arc-d'], CASE_IDS)
  const opts = parseArgs(['--suite', 'u6-arc-d', '--line', 'u6arcdx', '--evidence', '/tmp/ev'])
  assert.equal(opts.suite, 'u6-arc-d')
  assert.throws(() => parseArgs(['--suite', 'u6-arc-d', '--evidence', '/tmp/ev', '--only', 'nope']))
})

test('u6-arc-d: the HOST validator ingests the emitted blueprints; the run7 comma class is refused before write', async () => {
  const { createArcDAssembly } = await import('./lib/u6-arc-d-assembly.mjs')
  const dir = mkdtempSync(join(tmpdir(), 'u6arcd-ingest-'))
  try {
    const a = createArcDAssembly({ repoRoot: process.cwd(), home: dir, runStamp: 'r-ingest', reportDir: dir })
    a.writePreBootFiles()
    // (a) the emitted faces pass the SAME validator the host catalog runs.
    assert.deepEqual(a.assertBlueprintIngestible(), { 'main.yaml': 'PASS', 'anchor.yaml': 'PASS' })
    a.writeMainBlueprint(['u6arcd_probe'])
    assert.deepEqual(a.assertBlueprintIngestible(), { 'main.yaml': 'PASS', 'anchor.yaml': 'PASS' })
    // (b) run7's defect class (arc-a forensics): a comma inside a
    // permission-lane line is refused by the host validator BEFORE write.
    const bad = a.mainBlueprintYaml(['u6arcd_probe']).replace('deny: []', 'deny: [],')
    assert.notEqual(bad, a.mainBlueprintYaml(['u6arcd_probe']), 'the injected defect must bite the text')
    writeFileSync(join(dir, 'blueprints', 'main.yaml'), bad)
    assert.throws(() => a.assertBlueprintIngestible(), /U6ARCD_INGEST.*not valid YAML|not valid YAML/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('u6-arc-d: the assembly materializes the CI-03 lane (NO capabilities block) + plane + fixture', async () => {
  const { createArcDAssembly } = await import('./lib/u6-arc-d-assembly.mjs')
  const { emitPatchLayer } = await import('./lib/world-factory.mjs')
  const yaml = await import('yaml')
  const dir = mkdtempSync(join(tmpdir(), 'u6arcd-asm-'))
  try {
    const a = createArcDAssembly({ repoRoot: process.cwd(), home: dir, runStamp: 'r-TEST', reportDir: dir })
    a.writePreBootFiles()
    // the single fixture, one unique claim — the CI-03 disk oracle
    assert.ok(existsSync(a.files.native.path))
    assert.equal(readFileSync(a.files.native.path, 'utf8'), `${a.files.native.claim}\n`)
    // E1: the EFFECT file is never pre-written — its only possible author
    // is the native lane during the run, so its existence cannot be faked
    // by the fixture.
    assert.ok(existsSync(a.files.nativeEffect.path) ? !readFileSync(a.files.nativeEffect.path,'utf8').includes(a.files.nativeEffect.marker) : true, 'the native effect CONTENT (marker) is produced by the lane, never seeded by the fixture — a placeholder may pre-exist, the marker may not')
    // R-U6P6-1: the pair legs' effect files likewise exist only if the
    // run's lanes created them.
    assert.ok(!existsSync(a.files.pairDeny.path), 'the restrict DENIED-effect file must start life absent')
    assert.ok(!existsSync(a.files.pairLift.path), 'the lift effect file must start life absent')
    // the main blueprint: leader capabilities exactly like arc-a, ONE
    // member with NO capabilities block at all (the legacy native surface).
    const doc = yaml.parseDocument(a.mainBlueprintYaml(['u6arcd_probe'])).toJS()
    assert.equal(doc.schemaVersion, 3)
    assert.equal(doc.blueprintId, a.BP_MAIN_ID)
    assert.deepEqual(doc.members.map((m) => m.templateId), ['native'])
    const native = doc.members[0]
    assert.equal(native.capabilities, undefined, 'THE CI-03 lane: no capabilities block at all')
    assert.deepEqual(native.displayName, 'u6arcd native control member')
    assert.deepEqual(doc.leader.capabilities.teamTools.items, ['team_list_members', 'team_create_member', 'team_delegate', 'team_collect'])
    assert.ok(doc.leader.capabilities.builtinToolDeny.includes('u6arcd_probe'))
    assert.equal(doc.leader.capabilities.permissions.default, 'deny')
    // the plane: enforcing, workspace-rooted (the same generation of truth
    // beside the attacked family — arc-a law).
    const cfg = a.teamRowConfig()
    assert.equal(cfg.defaultWorkspace, a.workspaceDir, 'native edit must run in the World workspace, not the Host launch tree')
    assert.equal(cfg.teamToolPlane.centerAssembly, 'enforcing')
    assert.ok(cfg.teamToolPlane.realmId.startsWith('u6arcd-realm-'))
    assert.equal(cfg.teamToolPlane.fsInstance.realmId, cfg.teamToolPlane.realmId)
    // the patch-layer emission the factory performs for this World type
    const rows = [
      { id: 'u5-canary', name: './u5-canary-plugin.mjs' },
      { id: 'u6-arc-d-probe-host', name: './u6-arc-d-probe-host.mjs' },
      ...a.teamRows(),
    ]
    const emittedDoc = yaml.parseDocument(emitPatchLayer(['test'], rows))
    assert.equal(emittedDoc.errors.length, 0)
    const emitted = emitPatchLayer(['test'], rows)
    assert.ok(emitted.includes('dsh-agent-team'))
    assert.ok(emitted.includes('u6-arc-d-probe-host'))
    // probe identities are fixed words (ledger + marker dir read back by
    // exact name); the replay REUSES the positive grant id — that IS the
    // replay.
    assert.equal(a.probe.posCall, 'pos-1')
    assert.equal(a.probe.replayGrant, a.probe.posGrant)
    assert.equal(a.probe.movedIdentity, 'def#moved-under-swap')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ===========================================================================
// RETIRED-BY-A0 (round 80) — the PR5 probe family mount arm
// ===========================================================================
// WHAT WAS HERE. One arm (119 lines) mounted the ARC-D canary row and drove it
// against the PR5 probe family "AS SHIPPED" — `tests/u6-arc-a-probe-family/
// src/probe-assembly.mjs` through `U6ARCD_ASSEMBLY_URL`, with the marker
// directory as the oracle and every adversarial leg (spoof / swap / unbound /
// replay / post-teardown) held at ZERO effect. It now dies at module load:
// `ERR_MODULE_NOT_FOUND ... /tests/u6-arc-a-probe-family/src/probe-assembly.mjs`,
// imported from tests/world-factory/canary/u6-arc-d-probe-host.mjs.
//
// WHY IT IS RETIRED (per SUBJECT, never "the check was red").
//   subject:   the U6 ARC-A probe family lane — a test-only family that existed
//              to exercise the retired centre-shadow row / governance-centre
//              kernel (governance-closed-world).
//   citation:  `dev/agent-workflow/ledgers/ute-cut-closure.allow.json`
//              `#retiredSurfaces[dsh.u6-probe-family]` (kind
//              `test-only-family-lane`, disposition `retired-by-a0-cut`;
//              citations: the reviewed inventory §rows-barrel, the keep/delete
//              decision, the frozen attestation, the round-72 per-file record and
//              `ROUND72-DELETION-AUDIT.md` §2). Its three files are booked
//              per-file in `#retiredSubjects` (`probe-assembly.mjs`,
//              `probe-contribution.mjs`, `probe-assembly.d.mts`).
//   successor: `packages/runtime/test/vnext-admission.test.mjs` (the
//              `ute-vnext-a1` CI leg — the ONE admission point and its
//              zero-effect refusals), plus `scripts/ute-cut-closure.mjs --check`
//              and `scripts/ute-p0-assets.mjs --check`, which enforce that the
//              retired lane stays gone. The kernel laws the probe certified are
//              carried there; no preserved capability lost its arm.
//
// WHAT THIS PIN STILL ENFORCES. The probe lane must stay gone (a restored file
// is RED here and in `ute-cut-closure`), the ledger row that licenses the
// retirement must still name this subject and its successors, and every
// successor must exist on disk. Nothing was skipped.
test('RETIRED-BY-A0: the PR5 probe family stays gone and its licence names the successors', async () => {
  for (const rel of [
    'tests/u6-arc-a-probe-family/src/probe-assembly.mjs',
    'tests/u6-arc-a-probe-family/src/probe-contribution.mjs',
    'tests/u6-arc-a-probe-family/src/probe-assembly.d.mts',
  ]) {
    assert.equal(existsSync(join(process.cwd(), rel)), false, `${rel} was retired with the A0/A1 cut; restoring it would re-open a shadow lane`)
  }
  const ledger = JSON.parse(readFileSync(new URL('../../dev/agent-workflow/ledgers/ute-cut-closure.allow.json', import.meta.url), 'utf8'))
  const row = ledger.retiredSurfaces.subjects.find((subject) => subject.id === 'dsh.u6-probe-family')
  assert.ok(row, 'the retirement must be licensed by name, not implied')
  assert.equal(row.disposition, 'retired-by-a0-cut')
  assert.ok(row.successors.includes('packages/runtime/test/vnext-admission.test.mjs'), 'the successor set must still name the admission suite')
  for (const rel of row.successors.filter((entry) => !entry.includes(' '))) {
    assert.ok(existsSync(join(process.cwd(), rel)), `successor ${rel} must exist — a retirement without a target is a silence`)
  }
})

test('u6-arc-d: makeArcDDecide answers each trigger with ONE probe call and closes each leg by its own fence', async () => {
  const { createArcDAssembly, makeArcDDecide } = await import('./lib/u6-arc-d-assembly.mjs')
  const dir = mkdtempSync(join(tmpdir(), 'u6arcd-decide-'))
  try {
    const a = createArcDAssembly({ repoRoot: process.cwd(), home: dir, runStamp: 'r-DECIDE', reportDir: dir })
    const user = (text) => ({ role: 'user', content: text })
    const use = (id, name, args) => ({ role: 'assistant', content: [{ type: 'tool_use', id, name, input: args }] })
    // the wire shape the host builds: the tool's JSON answer rides inside a
    // tool_result content block (every inner quote escaped by the outer
    // JSON.stringify — the close lane must see through that).
    const result = (id, value) => ({ role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: [{ type: 'text', text: JSON.stringify(value) }] }] })
    const nameOf = (r) => (r.kind === 'tool-call' ? r.toolCalls[0].name : r.content)
    const argsOf = (r) => r.toolCalls[0].arguments
    // one decide per leg: the trigger law is per-instance ('fresh' once).
    const legCases = [
      ['T_POS', (r) => { assert.equal(nameOf(r), 'u6arcd_probe'); assert.deepEqual(argsOf(r), { action: 'walk', callId: 'pos-1', grantId: 'grant-pos', nonce: a.probe.posNonce }) }],
      ['T_SPOOF', (r) => { assert.deepEqual(argsOf(r), { action: 'spoof', callId: 'spoof-1', nonce: a.probe.spoofNonce }) }],
      ['T_SWAP', (r) => { assert.deepEqual(argsOf(r), { action: 'swap', callId: 'swap-1', nonce: a.probe.swapNonce, identity: 'def#moved-under-swap' }) }],
      ['T_UNBOUND', (r) => { assert.deepEqual(argsOf(r), { action: 'unbound', callId: 'unbound-1' }) }],
      ['T_REPLAY', (r) => { assert.deepEqual(argsOf(r), { action: 'walk', callId: 'replay-1', grantId: 'grant-pos', nonce: 'NONCE_REPLAY' }) }],
      ['T_TD', (r) => { assert.deepEqual(argsOf(r), { action: 'teardown' }) }],
      ['T_POSTTD', (r) => { assert.deepEqual(argsOf(r), { action: 'walk', callId: 'post-1', grantId: 'grant-post', nonce: 'NONCE_POST' }) }],
    ]
    for (const [key, check] of legCases) {
      const decide = makeArcDDecide({ assembly: a })
      const req = { body: { messages: [user(`run the leg ${a.markers[key]}`)] } }
      const first = decide({ req })
      assert.equal(first.kind, 'tool-call', `${key} must issue exactly one tool call`)
      assert.equal(first.toolCalls.length, 1, `${key}: ONE call per trigger`)
      check(first)
      const second = decide({ req: { body: { messages: [user(`again ${a.markers[key]}`)] } } })
      assert.deepEqual(second, { kind: 'text', content: 'U6ARCD_TRIGGER_DONE' }, `${key}: a re-issued trigger never repeats the call`)
    }
    // close lanes: the fence is per leg (one shared close text would let a
    // leg masquerade as another).
    const closeCases = [
      [{ action: 'walk', ok: true, stage: 'executed', marker: 'p' }, 'U6ARCD_WALK_DONE'],
      [{ action: 'walk', ok: false, stage: 'consume', code: 'GRANT_REPLAY' }, 'U6ARCD_REPLAY_DONE'],
      [{ action: 'walk', ok: false, stage: 'plan', code: 'KERNEL_NOT_ACTIVE' }, 'U6ARCD_POSTTD_DONE'],
      [{ action: 'teardown', ok: true, settled: true }, 'U6ARCD_TD_DONE'],
      [{ action: 'unbound', ok: true, refused: true, outcome: 'defer', code: 'NO_APPROVAL_ENTRY' }, 'U6ARCD_UNBOUND_DONE'],
      [{ action: 'spoof', ok: false, refused: true, code: 'NO_APPROVAL_ENTRY' }, 'U6ARCD_SPOOF_DONE'],
      [{ action: 'swap', ok: false, refused: true, code: 'IDENTITY_MISMATCH' }, 'U6ARCD_SWAP_DONE'],
    ]
    for (const [value, fence] of closeCases) {
      const decide = makeArcDDecide({ assembly: a })
      const base = [user(`run ${a.markers.T_POS}`), use('t1', 'u6arcd_probe', { action: value.action })]
      const closed = decide({ req: { body: { messages: [...base, result('t1', value)] } } })
      assert.deepEqual(closed, { kind: 'text', content: fence }, `close lane for ${JSON.stringify(value)}`)
    }
    // R-U6P6-1 pair legs (live restrict/lift): three steps each — GOVERN
    // (the plugin's tools.restrict mask toggle), the bash effect attempt,
    // then the leg's own fence. Steps advance ONLY on the settled result of
    // the prior step; the machine never re-issues a settled step.
    const pairCases = [
      ['T_RESTRICT', 'restrict-on', a.files.pairDeny, 'U6ARCD_RESTRICT_VETOED'],
      ['T_LIFT', 'restrict-off', a.files.pairLift, 'U6ARCD_LIFT_RAN'],
    ]
    for (const [key, action, target, fence] of pairCases) {
      const decide = makeArcDDecide({ assembly: a })
      const m0 = [user(`run the leg ${a.markers[key]}`)]
      const g = decide({ req: { body: { messages: m0 } } })
      assert.equal(nameOf(g), 'u6arcd_govern', `${key} step 0: the mask toggle rides the plugin govern tool`)
      assert.deepEqual(argsOf(g), { action })
      const b = decide({ req: { body: { messages: [...m0, use('tg', 'u6arcd_govern', { action }), result('tg', { ok: true, action, detail: 'restricted:bash,u6arcd_pair_effect' })] } } })
      // arc-d-u7arc2 law: bash workspace writes are sandbox-refused on this
      // pin, so the pair's effect rides the plugin fs tool — masked by NAME
      // on the same restrict seam. The args are the leg's own file+marker.
      assert.equal(nameOf(b), 'u6arcd_pair_effect', `${key} step 1: the effect attempt is the maskable effect-writer on THIS lane`)
      assert.deepEqual(argsOf(b), { path: target.path, marker: target.marker }, `${key}: the effect args are the leg's own path and run-unique marker`)
      const f = decide({ req: { body: { messages: [...m0, use('tg', 'u6arcd_govern', { action }), result('tg', { ok: true, action }), use('tb', 'u6arcd_pair_effect', { path: target.path, marker: target.marker }), result('tb', { ok: true, wrote: true })] } } })
      assert.deepEqual(f, { kind: 'text', content: fence }, `${key}: the leg closes by its OWN fence`)
    }
    // the native CI-03 lane (E1): grep FIRST (the parity note carrier —
    // ABSOLUTE path, the run-u6arca5 law), then a native WRITE whose disk
    // effect the ORACLE reads back; identified by the delegated request token.
    const nd = makeArcDDecide({ assembly: a })
    const nreq = { body: { messages: [user(`[team-work requestToken=${a.tokens('d1')} x] ${a.markers.MK_NATIVE} ...`)] } }
    const g = nd({ req: nreq })
    assert.equal(nameOf(g), 'grep')
    assert.equal(argsOf(g).pattern, a.files.native.claim)
    assert.equal(argsOf(g).path, join(a.workspaceDir, 'notes'))
    assert.ok(argsOf(g).path.startsWith('/'), 'ABSOLUTE path everywhere the fs-proven convention')
    const w = nd({ req: { body: { messages: [...nreq.body.messages, use('t9', 'grep', {}), result('t9', { hit: true })] } } })
    // E1: native read of the exact effect placeholder must precede edit.
    // Grep of notes is only the separately recorded parity arm.
    assert.equal(nameOf(w), 'read', 'native read establishes edit observation on the exact effect file')
    assert.equal(argsOf(w).file_path, a.files.nativeEffect.path)
    assert.ok(!a.files.nativeEffect.path.includes('/notes/'), 'FLAT workspace-root shape (sub-dir writes measure sandbox refusal, not the lane)')
    // boot-4 measured law: this pin's census-boot surface carries NO builtin
    // write tool (toolNames: bash/edit/glob/grep/read/read_image + team_*),
    // and the confined bash has ZERO writable landlock grants. The legacy
    // spelling the oracle compares is the NATIVE EDIT surface on the
    // placeholder-seeded effect file: only the lane's edit can turn the
    // placeholder into the run-unique marker.
    const wr = nd({ req: { body: { messages: [...nreq.body.messages, use('t9', 'grep', {}), result('t9', { hit: true }), use('tb', 'read', { file_path: a.files.nativeEffect.path }), result('tb', { text: a.files.nativeEffect.placeholder })] } } })
    assert.equal(nameOf(wr), 'edit', 'native edit follows the required read observation')
    assert.equal(argsOf(wr).file_path, a.files.nativeEffect.path, 'the edit targets the same assembly file the oracle reads')
    assert.equal(argsOf(wr).old_string, a.files.nativeEffect.placeholder, 'the edit replaces ONLY the fixture placeholder')
    assert.ok(String(argsOf(wr).new_string).includes(a.files.nativeEffect.marker), 'the edit content is the run-unique marker')
    const g2 = nd({ req: { body: { messages: [...nreq.body.messages, use('t9', 'grep', {}), result('t9', { hit: true }), use('tb', 'read', { file_path: a.files.nativeEffect.path }), result('tb', { text: a.files.nativeEffect.placeholder }), use('te', 'edit', {}), result('te', { ok: true })] } } })
    assert.deepEqual(g2, { kind: 'text', content: 'U6ARCD_NATIVE_DONE' })
    // the leader chain (the arc-a PHASES idiom): create -> the REAL
    // instance id from the tool_result -> async delegate with requestToken
    // d1 -> settled -> collect -> fence -> L1_DONE.
    const ld = makeArcDDecide({ assembly: a })
    const l1 = { body: { messages: [user('U6ARCD_PHASE_n')] } }
    const c1 = ld({ req: l1 })
    assert.equal(nameOf(c1), 'team_create_member')
    assert.equal(argsOf(c1).delegationTemplateId, 'native')
    assert.equal(argsOf(c1).requestToken, a.tokens('c1'))
    const l2 = { body: { messages: [...l1.body.messages, use('tc', 'team_create_member', {}), result('tc', { ok: true, instanceId: 'inst-native-001' })] } }
    const c2 = ld({ req: l2 })
    assert.equal(nameOf(c2), 'team_delegate')
    assert.equal(argsOf(c2).delegationInstanceId, 'inst-native-001', 'the id is the REAL host id read from the transcript, never invented')
    assert.equal(argsOf(c2).requestToken, a.tokens('d1'))
    assert.ok(String(argsOf(c2).prompt).includes(a.markers.MK_NATIVE))
    assert.equal(argsOf(c2).async, true)
    const l3 = { body: { messages: [...l2.body.messages, user(`[team-work-settled requestToken=${a.tokens('d1')} outcome=ok]`)] } }
    const c3 = ld({ req: l3 })
    assert.equal(nameOf(c3), 'team_collect')
    assert.deepEqual(argsOf(c3).requestTokens, [a.tokens('d1')])
    const l4 = { body: { messages: [...l3.body.messages, use('tk', 'team_collect', {}), result('tk', { text: 'member said U6ARCD_NATIVE_DONE' })] } }
    const c4 = ld({ req: l4 })
    assert.deepEqual(c4, { kind: 'text', content: 'U6ARCD_L1_DONE' })
    // the title + discovery lanes never call tools
    const td1 = makeArcDDecide({ assembly: a })
    assert.equal(td1({ req: { body: { messages: [user('Generate the session title for this conversation')] } } }).kind, 'text')
    const td2 = makeArcDDecide({ assembly: a })
    const disc = td2({ req: { body: { messages: [user(a.markers.MK_DISC)] } } })
    assert.equal(disc.kind, 'text')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('u6-arc-d: the judge passes the honest digest and EVERY verdict moves when its evidence moves', async () => {
  const { judgeU6ArcD } = await import('./lib/u6-arc-d-assembly.mjs')
  const { SUITE_CASES } = await import('./u5-canary-runner.mjs')
  const good = () => ({
    probeRows: [
      { leg: 'plugin-apply', pid: 1 },
      { leg: 'family-mount', ok: true },
      { leg: 'register', kind: 'probe-tool', ok: true },
      { leg: 'walk', action: 'walk', callId: 'pos-1', ok: true },
      { leg: 'walk', action: 'spoof', callId: 'spoof-1', ok: false },
      { leg: 'walk', action: 'swap', callId: 'swap-1', ok: false },
      { leg: 'walk', action: 'unbound', callId: 'unbound-1', ok: false, outcome: 'defer' },
      { leg: 'walk', action: 'walk', callId: 'replay-1', ok: false, code: 'GRANT_REPLAY' },
      { leg: 'teardown', ok: true },
      { leg: 'walk', action: 'walk', callId: 'post-1', ok: false, code: 'KERNEL_NOT_ACTIVE' },
      { leg: 'govern', action: 'restrict-on', ok: true },
      { leg: 'govern', action: 'restrict-off', ok: true },
      { leg: 'pair-effect', marker: 'U6ARCD_PAIR_LIFT_x', pathTail: 'u6arcd-pair-lift.txt', ok: true },
    ],
    markerFiles: ['pos-1-marker.txt'],
    markerNonces: { 'pos-1-marker.txt': 'NONCE_POS' },
    nativeEvidence: { readFromDisk: true, present: true, contentMatches: true, pathTail: 'u6arcd-native-effect.txt' },
    nativeGrepParity: { claimOccurrences: 1 },
    pairEvidence: {
      pairDeny: { readFromDisk: true, present: false, contentMatches: false, marker: 'U6ARCD_PAIR_DENY_x', pathTail: 'u6arcd-pair-denied.txt' },
      pairLift: { readFromDisk: true, present: true, contentMatches: true, marker: 'U6ARCD_PAIR_LIFT_x', pathTail: 'u6arcd-pair-lift.txt' },
    },
    hostAlive: true,
  })
  const rows = judgeU6ArcD(good())
  assert.deepEqual(rows.map(([id]) => id), SUITE_CASES['u6-arc-d'], 'the judge answers the SUITE_CASES list, in order')
  for (const [id, verdict] of rows) assert.equal(verdict, 'PASS', `honest digest must PASS every case, ${id} failed`)
  const verdictOf = (d, caseId) => judgeU6ArcD(d).find(([id]) => id === caseId)[1]
  const flipPos = (d) => ({ ...d, probeRows: d.probeRows.map((r) => (r.callId === 'pos-1' ? { ...r, ok: false } : r)) })
  // mounted — a dead host is never a mounted verdict (ENV_BLOCK, and only
  // the judge may say it); a missing register row is FAIL.
  assert.equal(verdictOf({ ...good(), hostAlive: false }, 'arcd:mounted'), 'ENV_BLOCK')
  assert.equal(verdictOf({ ...good(), bootOk: false }, 'arcd:mounted'), 'ENV_BLOCK')
  assert.equal(verdictOf({ ...good(), probeRows: good().probeRows.filter((r) => r.leg !== 'register') }, 'arcd:mounted'), 'FAIL')
  // positive — flip the walk ok AND the marker disappears.
  assert.equal(verdictOf({ ...flipPos(good()), markerFiles: [], markerNonces: {} }, 'arcd:positive'), 'FAIL')
  assert.equal(verdictOf({ ...good(), markerFiles: [], markerNonces: {} }, 'arcd:positive'), 'FAIL', 'an ok walk with NO marker on disk is the very false-green the DISK law exists to catch')
  // spoof — a walk that ANSWERED, or a marker where none may be.
  assert.equal(verdictOf({ ...good(), probeRows: good().probeRows.map((r) => (r.action === 'spoof' ? { ...r, ok: true } : r)) }, 'arcd:spoof-zero-authority'), 'FAIL')
  assert.equal(verdictOf({ ...good(), markerFiles: ['pos-1-marker.txt', 'spoof-1-marker.txt'] }, 'arcd:spoof-zero-authority'), 'FAIL')
  assert.equal(verdictOf({ ...good(), probeRows: good().probeRows.filter((r) => r.action !== 'spoof') }, 'arcd:spoof-zero-authority'), 'FAIL', 'a missing spoof row never PASSes')
  // swap — same shape as spoof.
  assert.equal(verdictOf({ ...good(), probeRows: good().probeRows.map((r) => (r.action === 'swap' ? { ...r, ok: true } : r)) }, 'arcd:swap-refused'), 'FAIL')
  assert.equal(verdictOf({ ...good(), markerFiles: ['pos-1-marker.txt', 'swap-1-marker.txt'] }, 'arcd:swap-refused'), 'FAIL')
  // unbound — 'allow' for a never-bound name is THE failure.
  assert.equal(verdictOf({ ...good(), probeRows: good().probeRows.map((r) => (r.action === 'unbound' ? { ...r, outcome: 'allow' } : r)) }, 'arcd:unbound-refused'), 'FAIL')
  assert.equal(verdictOf({ ...good(), probeRows: good().probeRows.filter((r) => r.action !== 'unbound') }, 'arcd:unbound-refused'), 'FAIL')
  // replay — the settled grant answering, or leaving a marker of its own.
  assert.equal(verdictOf({ ...good(), probeRows: good().probeRows.map((r) => (r.callId === 'replay-1' ? { ...r, ok: true } : r)) }, 'arcd:replay-refused'), 'FAIL')
  assert.equal(verdictOf({ ...good(), markerFiles: ['pos-1-marker.txt', 'replay-1-marker.txt'] }, 'arcd:replay-refused'), 'FAIL')
  // CI-03 (E1) — the verdict rides the DIRECT disk read: no effect file, or
  // a file without THIS run's marker, FAILs whatever the wire carried;
  // and the wire claim going missing must NOT move the verdict (the oracle
  // is independent of every tool return — the grep count is a recorded
  // parity NOTE, never the basis).
  assert.equal(verdictOf({ ...good(), nativeEvidence: { ...good().nativeEvidence, present: false, contentMatches: false } }, 'arcd:ci03-native-parity'), 'FAIL', 'no effect file on disk = the native lane touched NOTHING, whatever its tool returns claimed')
  assert.equal(verdictOf({ ...good(), nativeEvidence: { ...good().nativeEvidence, contentMatches: false } }, 'arcd:ci03-native-parity'), 'FAIL', 'a file without THIS run\'s marker is not the effect')
  assert.equal(verdictOf({ ...good(), nativeGrepParity: { claimOccurrences: 0 } }, 'arcd:ci03-native-parity'), 'PASS', 'the grep parity note NEVER carries the verdict: disk evidence alone decides')
  // restrict-veto (R-U6P6-1) — BOTH facts move it: the durable govern row
  // (the mask transition, plugin-written to the JSONL) and the DENIED
  // effect staying OFF disk.
  assert.equal(verdictOf({ ...good(), probeRows: good().probeRows.filter((r) => !(r.leg === 'govern' && r.action === 'restrict-on')) }, 'arcd:restrict-veto'), 'FAIL', 'no durable restrict row = the live deny change never provably happened')
  assert.equal(verdictOf({ ...good(), pairEvidence: { ...good().pairEvidence, pairDeny: { readFromDisk: true, present: true, contentMatches: true, marker: 'U6ARCD_PAIR_DENY_x' } } }, 'arcd:restrict-veto'), 'FAIL', 'the DENIED effect ON disk = the mask hid nothing — the exact false-green')
  assert.equal(verdictOf({ ...good(), probeRows: [...good().probeRows, { leg: 'pair-effect', marker: 'U6ARCD_PAIR_DENY_x', ok: true }] }, 'arcd:restrict-veto'), 'FAIL', 'the effect writer EXECUTING under the mask = the mask hid nothing even though no file appeared yet — the ledger moves the veto too')
  // lift-control — the dispose row AND the effect landing with the marker.
  assert.equal(verdictOf({ ...good(), probeRows: good().probeRows.filter((r) => !(r.leg === 'govern' && r.action === 'restrict-off')) }, 'arcd:lift-control'), 'FAIL', 'no lift row = the mask was never disposed on the record')
  assert.equal(verdictOf({ ...good(), pairEvidence: { ...good().pairEvidence, pairLift: { readFromDisk: true, present: false, contentMatches: false } } }, 'arcd:lift-control'), 'FAIL', 'no effect after the lift = the lane never recovered (a mask that only hides)')
  assert.equal(verdictOf({ ...good(), pairEvidence: { ...good().pairEvidence, pairLift: { readFromDisk: true, present: true, contentMatches: false } } }, 'arcd:lift-control'), 'FAIL', 'a file without THIS run\'s marker is not the lift effect')
  assert.equal(verdictOf({ ...good(), probeRows: good().probeRows.filter((r) => r.leg !== 'pair-effect') }, 'arcd:lift-control'), 'FAIL', 'a disk file WITHOUT the effect-writer ever executing this run is not a lifted lane — the ledger moves the lift too')
  // marker-ledger — global arithmetic: one EXTRA ok-walk for a refusal
  // callId moves THIS case and (by construction) not the spoof row itself.
  const leaked = { ...good(), probeRows: [...good().probeRows, { leg: 'walk', action: 'walk', callId: 'spoof-1', ok: true }] }
  assert.equal(verdictOf(leaked, 'arcd:marker-ledger'), 'FAIL')
  assert.equal(verdictOf(leaked, 'arcd:spoof-zero-authority'), 'PASS', 'the ledger case is independent arithmetic over ALL walk rows — it catches what a per-leg row read cannot')
  assert.equal(verdictOf({ ...good(), probeRows: good().probeRows.map((r) => (r.callId === 'pos-1' ? { ...r, ok: false } : r)) }, 'arcd:marker-ledger'), 'FAIL', 'zero ok-walks is also a ledger violation (the positive leg must really have run)')
  // teardown-honest — unsettled teardown or a post-teardown call that works.
  assert.equal(verdictOf({ ...good(), probeRows: good().probeRows.filter((r) => r.leg !== 'teardown') }, 'arcd:teardown-honest'), 'FAIL')
  assert.equal(verdictOf({ ...good(), probeRows: good().probeRows.map((r) => (r.leg === 'teardown' ? { ...r, ok: false } : r)) }, 'arcd:teardown-honest'), 'FAIL')
  assert.equal(verdictOf({ ...good(), probeRows: good().probeRows.map((r) => (r.callId === 'post-1' ? { ...r, ok: true } : r)) }, 'arcd:teardown-honest'), 'FAIL')
  // a dead host never launders a PASS through the two live legs either.
  const dead = { ...good(), hostAlive: false }
  const deadRows = judgeU6ArcD(dead)
  assert.equal(deadRows.find(([id]) => id === 'arcd:mounted')[1], 'ENV_BLOCK')
  assert.equal(deadRows.find(([id]) => id === 'arcd:positive')[1], 'ENV_BLOCK')
})

test('u6-arc-d: the factory wires u6ArcD (row exports, option validation, one-World-one-suite)', async () => {
  const wf = await import('./lib/world-factory.mjs')
  assert.equal(wf.U6ARCD_PROBE_ROW_ID, 'u6-arc-d-probe-host')
  assert.ok(String(wf.U6ARCD_PROBE_SRC).endsWith(join('canary', 'u6-arc-d-probe-host.mjs')))
  assert.ok(existsSync(wf.U6ARCD_PROBE_SRC), 'the row file the factory copies beside the profile patch exists')
  const evidenceRoot = mkdtempSync(join(tmpdir(), 'u6arcd-factory-'))
  try {
    const factory = new wf.TestWorldFactory({ repoRoot: process.cwd(), evidenceRoot })
    // one World belongs to one suite — both patch-layer owners would race
    // for the same profile patch file.
    await assert.rejects(() => factory.createWorld({ line: 'u6arcdx', u6ArcD: { rows: [] }, u6Jobs: { rows: [] } }), /mutually exclusive/)
    await assert.rejects(() => factory.createWorld({ line: 'u6arcdx', u6ArcD: { rows: [] }, u6ArcA: { rows: [] } }), /mutually exclusive/)
    await assert.rejects(() => factory.createWorld({ line: 'u6arcdx', u6ArcD: { rows: [] }, u6Fs: { rows: [] } }), /mutually exclusive/)
    // the option shape is validated before any home is created.
    await assert.rejects(() => factory.createWorld({ line: 'u6arcdx', u6ArcD: { nope: true } }), /invalid u6ArcD/)
    await assert.rejects(() => factory.createWorld({ line: 'u6arcdx', u6ArcD: 'yes' }), /invalid u6ArcD/)
  } finally {
    rmSync(evidenceRoot, { recursive: true, force: true })
  }
})
