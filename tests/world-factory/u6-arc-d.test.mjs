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
 * capabilities block; (3) the probe row mounts the PR5 probe FAMILY
 * unchanged against the shipped dist seam faces and every adversarial leg
 * holds at the real kernel with ZERO-effect refusals (the marker dir is the
 * oracle); (4) makeArcDDecide answers each trigger with exactly ONE tool
 * call and closes each leg by its own fence; (5) the judge's sensitivity
 * law — a synthetic all-green digest PASSes all nine cases and EVERY
 * verdict moves when its own evidence moves; (6) the factory's u6ArcD
 * wiring (option validation + one-World-one-suite exclusion).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const CASE_IDS = [
  'arcd:mounted', 'arcd:positive', 'arcd:spoof-zero-authority', 'arcd:swap-refused',
  'arcd:unbound-refused', 'arcd:replay-refused', 'arcd:ci03-native-parity',
  'arcd:marker-ledger', 'arcd:teardown-honest',
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

test('u6-arc-d: the probe row mounts the PR5 family AS SHIPPED and the kernel holds every adversarial leg at ZERO effect (dist seams)', async () => {
  // The row + lane + BOTH public seams run here in plain node against the
  // shipped dist faces — the exact resolution the Host world uses. THE
  // MARKER DIR IS THE ORACLE: every refusal leg reads the DIRECTORY, never
  // the row's return value. No shadow twin exists: a shadow kernel still
  // computes refuse verdicts, so an unguarded "twin" could only masquerade
  // (the honest unguarded legs live at the offline C1 seams).
  const repoRoot = process.cwd()
  const dir = mkdtempSync(join(tmpdir(), 'u6arcd-row-'))
  process.env.U6ARCD_LEDGER = join(dir, 'ledger.jsonl')
  process.env.U6ARCD_MARKER_DIR = join(dir, 'markers')
  process.env.U6ARCD_WORLD = 'offline'
  process.env.U6ARCD_ASSEMBLY_URL = new URL('../../tests/u6-arc-a-probe-family/src/probe-assembly.mjs', import.meta.url).href
  process.env.U6ARCD_CENTER_URL = pathToFileURL(join(repoRoot, 'packages/runtime/dist/packages/runtime/governance-center/index.js')).href
  process.env.U6ARCD_CONTRACTS_URL = pathToFileURL(join(repoRoot, 'packages/runtime/dist/packages/contracts/src/index.js')).href
  try {
    const mod = await import(`./canary/u6-arc-d-probe-host.mjs?rowtest=${String(Date.now())}`)
    const defs = []
    const ctx = {
      tools: { register: (d) => { defs.push(d); return () => {} } },
      on: () => () => {},
      effect: (fn) => fn(),
    }
    mod.apply(ctx)
    assert.equal(mod.name, 'u6-arc-d-probe-host')
    assert.deepEqual(mod.inject, ['tools'])
    assert.deepEqual(defs.map((d) => d.name), ['u6arcd_probe'])
    const execute = defs[0].execute
    const markers = () => {
      try { return readdirSync(join(dir, 'markers')).filter((m) => m.endsWith('-marker.txt')).sort() } catch { return [] }
    }
    // positive walk: the family's own effect on disk, nonce inside the file
    const pos = await execute({ action: 'walk', callId: 'pos-1', grantId: 'grant-pos', nonce: 'N1' })
    assert.equal(pos.ok, true, JSON.stringify(pos))
    assert.deepEqual(markers(), ['pos-1-marker.txt'])
    assert.equal(readFileSync(join(dir, 'markers', 'pos-1-marker.txt'), 'utf8').trim(), 'N1')
    // spoof: self-reported foreign scope — refuse at plan, ZERO effect
    const spoof = await execute({ action: 'spoof', callId: 'spoof-1', nonce: 'N2' })
    assert.equal(spoof.ok, false, JSON.stringify(spoof))
    assert.equal(spoof.refused, true)
    assert.deepEqual(markers(), ['pos-1-marker.txt'], 'spoof wrote nothing')
    // swap: an identity the table never bound — IDENTITY_MISMATCH, ZERO
    const swap = await execute({ action: 'swap', callId: 'swap-1', nonce: 'N3', identity: 'def#moved-under-swap' })
    assert.equal(swap.ok, false, JSON.stringify(swap))
    assert.equal(String(swap.code), 'IDENTITY_MISMATCH')
    assert.deepEqual(markers(), ['pos-1-marker.txt'], 'swap wrote nothing')
    // unbound name: never 'allow', ZERO effect
    const unbound = await execute({ action: 'unbound', callId: 'unbound-1' })
    assert.notEqual(unbound.outcome, 'allow')
    assert.deepEqual(markers(), ['pos-1-marker.txt'], 'unbound wrote nothing')
    // report: the family's own faces, still ACTIVE before teardown
    const rep = await execute({ action: 'report' })
    assert.equal(rep.ok, true)
    // replay: the SETTLED grant re-presented on another callId — refused
    const replay = await execute({ action: 'walk', callId: 'replay-1', grantId: 'grant-pos', nonce: 'N4' })
    assert.equal(replay.ok, false, JSON.stringify(replay))
    assert.equal(replay.code, 'GRANT_REPLAY')
    assert.deepEqual(markers(), ['pos-1-marker.txt'], 'replay wrote nothing')
    // honest teardown, then the post-teardown call is refused at ZERO effect
    const td = await execute({ action: 'teardown' })
    assert.equal(td.ok, true)
    assert.equal(td.settled, true)
    const post = await execute({ action: 'walk', callId: 'post-1', grantId: 'grant-post', nonce: 'N5' })
    assert.equal(post.ok, false, JSON.stringify(post))
    assert.equal(post.code, 'KERNEL_NOT_ACTIVE')
    assert.deepEqual(markers(), ['pos-1-marker.txt'], 'post-teardown wrote nothing')
    // the LEDGER (the second hard channel) holds the same story
    const rows = readFileSync(join(dir, 'ledger.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
    assert.ok(rows.some((r) => r.leg === 'family-mount' && r.ok === true))
    assert.ok(rows.some((r) => r.leg === 'register' && r.kind === 'probe-tool' && r.ok === true))
    assert.ok(rows.some((r) => r.leg === 'walk' && r.action === 'spoof' && r.ok === false))
    assert.ok(rows.some((r) => r.leg === 'walk' && r.action === 'swap' && r.ok === false))
    assert.ok(rows.some((r) => r.leg === 'walk' && r.action === 'unbound' && r.outcome !== 'allow'))
    assert.ok(rows.some((r) => r.leg === 'walk' && r.code === 'GRANT_REPLAY'))
    assert.ok(rows.some((r) => r.leg === 'teardown' && r.ok === true))
    const okWalks = rows.filter((r) => r.leg === 'walk' && r.ok === true).map((r) => r.callId)
    assert.deepEqual(okWalks, ['pos-1'], 'exactly ONE ok walk row for the whole adversarial walk — the marker-ledger arithmetic the live judge runs')
  } finally {
    for (const k of ['U6ARCD_LEDGER', 'U6ARCD_MARKER_DIR', 'U6ARCD_WORLD', 'U6ARCD_ASSEMBLY_URL', 'U6ARCD_CENTER_URL', 'U6ARCD_CONTRACTS_URL', 'U6ARC_CENTER_URL', 'U6ARC_CONTRACTS_URL']) delete process.env[k]
    rmSync(dir, { recursive: true, force: true })
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
    // the native CI-03 lane: ONE grep (ABSOLUTE path — the run-u6arca5
    // law), then its own fence; identified by the delegated request token.
    const nd = makeArcDDecide({ assembly: a })
    const nreq = { body: { messages: [user(`[team-work requestToken=${a.tokens('d1')} x] ${a.markers.MK_NATIVE} ...`)] } }
    const g = nd({ req: nreq })
    assert.equal(nameOf(g), 'grep')
    assert.equal(argsOf(g).pattern, a.files.native.claim)
    assert.equal(argsOf(g).path, join(a.workspaceDir, 'notes'))
    assert.ok(argsOf(g).path.startsWith('/'), 'ABSOLUTE path everywhere the fs-proven convention')
    const g2 = nd({ req: { body: { messages: [...nreq.body.messages, use('t9', 'grep', {}), result('t9', { hit: true })] } } })
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
    ],
    markerFiles: ['pos-1-marker.txt'],
    markerNonces: { 'pos-1-marker.txt': 'NONCE_POS' },
    nativeClaimFound: true,
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
  // CI-03 — the native lane never surfaced the disk claim on the wire.
  assert.equal(verdictOf({ ...good(), nativeClaimFound: false }, 'arcd:ci03-native-parity'), 'FAIL')
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
