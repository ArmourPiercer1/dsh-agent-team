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
    assert.deepEqual(defs.map((d) => d.name), ['u6arcd_probe', 'u6arcd_govern', 'u6arcd_pair_effect'])
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
    // R-U6P6-1: the govern row — the live deny-change lane OFFLINE, with a
    // scripted agent ctx whose tools.restrict returns a recorded disposer.
    // restrict-on must call restrict with the masked builtin and store the
    // disposer; restrict-off must DISPOSE it; both must land durable ledger
    // rows (the judge's durable witnesses); a caller WITHOUT a scoped
    // tools.restrict must fail with ok:false (never a silent success).
    const govern = defs[1].execute
    let restricted = null
    let disposed = 0
    const agentExec = { agent: { ctx: { tools: { restrict: (spec) => { restricted = spec.deny.slice(); return () => { disposed += 1 } } } } } }
    const rOn = await govern({ action: 'restrict-on' }, agentExec)
    assert.equal(rOn.ok, true, JSON.stringify(rOn))
    assert.deepEqual(restricted, ['bash', 'u6arcd_pair_effect'], 'the mask covers the built-in bash (the applyBuiltInToolDeny lane) AND the pair effect-writer — the deny leg is a refusal and a zero-effect at once')
    const efDef = defs.find((d) => d.name === 'u6arcd_pair_effect')
    assert.equal(typeof efDef?.execute, 'function', 'the pair effect-writer is a registered tool with an execute')
    assert.deepEqual(Object.keys(efDef.parameters.properties).sort(), ['marker', 'path'], 'the effect-writer takes only { path, marker } — no general-purpose write surface')
    // Its execute is the pair's ONLY disk producer, so the seam test runs it
    // once per shape: the run-unique marker lands (and the row is durable),
    // while anything else is refused BEFORE any write.
    const efPath = join(dir, 'pair-effect-seam.txt')
    const efOk = await efDef.execute({ path: efPath, marker: 'U6ARCD_PAIR_LIFT_seam1' })
    assert.equal(efOk.ok, true, JSON.stringify(efOk))
    assert.equal(readFileSync(efPath, 'utf8').trim(), 'U6ARCD_PAIR_LIFT_seam1', 'the effect the judge later reads off DISK is exactly what this writer wrote')
    for (const bad of [{ path: efPath, marker: 'SOMETHING_ELSE_1' }, { path: join(dir, 'pair-effect-seam.bak'), marker: 'U6ARCD_PAIR_DENY_seam1' }]) {
      const efBad = await efDef.execute(bad)
      assert.equal(efBad.ok, false, `${JSON.stringify(bad)}: only the run-unique PAIR marker shape writes — a general write surface would be its own hole`)
    }
    assert.equal(readFileSync(efPath, 'utf8').trim(), 'U6ARCD_PAIR_LIFT_seam1', 'a refused effect call changed nothing on disk')
    const rOff = await govern({ action: 'restrict-off' }, agentExec)
    assert.equal(rOff.ok, true, JSON.stringify(rOff))
    assert.equal(disposed, 1, 'restrict-off DISPOSES the mask (the lift is a real unwind, not a note)')
    const rNoCtx = await govern({ action: 'restrict-on' }, {})
    assert.equal(rNoCtx.ok, false, 'no scoped tools.restrict = an honest failure, never a claimed success')
    const gRows = rows.concat(readFileSync(join(dir, 'ledger.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l))).filter((r) => r.leg === 'govern')
    assert.ok(gRows.some((r) => r.action === 'restrict-on' && r.ok === true && r.agentCaptured === true))
    assert.ok(gRows.some((r) => r.action === 'restrict-off' && r.ok === true))
    assert.ok(gRows.some((r) => r.action === 'restrict-on' && r.ok === false), 'the failed no-ctx attempt is on the record too — the ledger holds the WHOLE story')
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
    // E1: the native lane PRODUCES a disk effect — it tries BOTH native
    // write spellings (bash redirect at a FLAT workspace-root path, then
    // the builtin write tool), because boot-3 measured the confined
    // provider refusing bash writes and CI-03 compares the whole legacy
    // surface. The verdict basis is what the ORACLE reads back off disk.
    assert.equal(nameOf(w), 'bash', 'the native lane PRODUCES its disk effect through native tools (E1) — the verdict basis is what the oracle reads off disk, not any tool answer')
    assert.ok(String(argsOf(w).command).includes(a.files.nativeEffect.path), 'the effect path is the assembly file the oracle will read')
    assert.ok(String(argsOf(w).command).includes(a.files.nativeEffect.marker), 'the effect command carries the run-unique marker')
    assert.ok(String(argsOf(w).command).includes('>'), 'the effect command WRITES (a pure read would launder the verdict)')
    assert.ok(!a.files.nativeEffect.path.includes('/notes/'), 'FLAT workspace-root shape (sub-dir writes measure sandbox refusal, not the lane)')
    // boot-4 measured law: this pin's census-boot surface carries NO builtin
    // write tool (toolNames: bash/edit/glob/grep/read/read_image + team_*),
    // and the confined bash has ZERO writable landlock grants. The legacy
    // spelling the oracle compares is the NATIVE EDIT surface on the
    // placeholder-seeded effect file: only the lane's edit can turn the
    // placeholder into the run-unique marker.
    const wr = nd({ req: { body: { messages: [...nreq.body.messages, use('t9', 'grep', {}), result('t9', { hit: true }), use('tb', 'bash', {}), result('tb', { stdout: 'Permission denied' })] } } })
    assert.equal(nameOf(wr), 'edit', 'the native lane also drives the builtin edit surface — the whole legacy write surface is compared, and a sandbox-refused bash is answered by the next native spelling, never by laundering')
    assert.equal(argsOf(wr).file_path, a.files.nativeEffect.path, 'the edit targets the same assembly file the oracle reads')
    assert.equal(argsOf(wr).old_string, a.files.nativeEffect.placeholder, 'the edit replaces ONLY the fixture placeholder')
    assert.ok(String(argsOf(wr).new_string).includes(a.files.nativeEffect.marker), 'the edit content is the run-unique marker')
    const g2 = nd({ req: { body: { messages: [...nreq.body.messages, use('t9', 'grep', {}), result('t9', { hit: true }), use('tb', 'bash', {}), result('tb', { stdout: 'Permission denied' }), use('te', 'edit', {}), result('te', { ok: true })] } } })
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
