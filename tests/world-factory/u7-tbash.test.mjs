/**
 * u7-tbash.test.mjs — C1 (offline, zero boots) for the U7 `team_bash` L4
 * round. Same harness idiom as u6-arc-d.test.mjs:
 *
 *   node --test tests/world-factory/u7-tbash.test.mjs
 *
 * Pins: (1) the emitted blueprints pass the HOST's closed-grammar validator,
 * and the parsed leader carries NO shell lane while the asker is default-ask
 * with request-control in BOTH the team root and its own envelope (the
 * measured r2..r4 cause); (2) the lane-scoped resolver allows exactly one
 * row — the pinned command, first issue, once — and denies everything else;
 * (3) results join to calls by tool_use_id (the r5 index-pairing artifact
 * cannot recur); (4) the brain issues the fixed four-step script derived
 * from the transcript, and its fence never self-satisfies; (5) the judge's
 * sensitivity law: an all-green digest PASSes every case and EVERY case
 * flips when its own evidence is mutated (mutation controls).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const lib = () => import('./lib/u7-tbash-assembly.mjs')

function withAssembly(fn) {
  return async () => {
    const { createTbashAssembly } = await lib()
    const dir = mkdtempSync(join(tmpdir(), 'u7tb-c1-'))
    try {
      const a = createTbashAssembly({ repoRoot: process.cwd(), home: dir, runStamp: 'r-c1', reportDir: dir })
      a.writePreBootFiles()
      await fn(a)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }
}

test('u7-tbash: blueprints pass the host validator; leader has no shell lane; asker can open an ask row', withAssembly(async (a) => {
  const anchor = a.parseWithHostValidator(a.BP_ANCHOR_YAML)
  assert.equal(anchor.blueprintId, a.BP_ANCHOR_ID)
  a.writeMainBlueprint(['web_fetch'])
  const doc = a.parseWithHostValidator(a.mainBlueprintYaml(['web_fetch']))
  assert.equal(doc.blueprintId, a.BP_MAIN_ID)
  assert.ok(doc.teamEnvelope.allow.includes('request-control'), 'team root must name request-control (r2..r4 cause)')
  assert.ok(!doc.teamEnvelope.allow.includes('bash'), 'no exec token: the leader has no shell lane')
  assert.ok(!doc.teamEnvelope.allow.includes('resolve-control'), 'approval is the human seam, not the leader')
  const leaderPerms = doc.leader.capabilities.permissions
  assert.equal(leaderPerms.default, 'deny')
  assert.deepEqual([...leaderPerms.allow, ...leaderPerms.ask], [])
  assert.ok(!doc.leader.capabilities.teamTools.items.includes('team_resolve_control'))
  assert.equal(doc.members.length, 1)
  const asker = doc.members[0]
  assert.equal(asker.templateId, 'asker')
  assert.equal(asker.capabilities.permissions.default, 'ask')
  assert.deepEqual([...asker.capabilities.permissions.allow, ...asker.capabilities.permissions.ask], [])
  const entry = doc.memberEnvelopes.find((e) => e.templateId === 'asker')
  assert.ok(entry.envelope.allow.includes('request-control'))
  // a defect in the emitter is refused BEFORE write (host validator)
  assert.throws(() => a.parseWithHostValidator(a.mainBlueprintYaml([]).replace('deny: []', 'deny: [],')))
}))

test('u7-tbash: commands are harmless printf appends inside the team root', withAssembly(async (a) => {
  const c = a.cmds()
  for (const k of ['appr', 'other', 'deny']) {
    assert.match(c[k], /^printf '[A-Z0-9_a-z-]+\\n' >> '[^']+' && echo U7TB_[A-Z]+_RAN$/)
    assert.ok(c[k].includes(a.workspaceDir) || c[k].includes('/workspace/'), 'target is under the team root')
    assert.ok(!c[k].includes(a.SECRET_FILE))
  }
  assert.notEqual(c.appr, c.other)
  assert.notEqual(c.appr, c.deny)
}))

test('u7-tbash: governed identity extractor fails closed and accepts only good fresh-root identity', async () => {
  const { extractGovernedSessionId } = await lib()
  const base = { path: 'fresh-root', durable: { teamSession: { rootSessionId: 'team-1' } }, bind: { identity: { rootSessionId: 'team-1' } } }
  assert.equal(extractGovernedSessionId({ ...base, durable: null, bind: {} }, { expectedRoot: 'team-1', bootRoot: 'boot' }).ok, false)
  assert.equal(extractGovernedSessionId({ ...base, bind: { identity: { rootSessionId: 'other' } } }, { expectedRoot: 'team-1', bootRoot: 'boot' }).ok, false)
  assert.equal(extractGovernedSessionId(base, { expectedRoot: 'boot', bootRoot: 'boot' }).ok, false)
  assert.equal(extractGovernedSessionId({ ...base, path: 'cold-root' }, { expectedRoot: 'team-1', bootRoot: 'boot' }).ok, false)
  const good = extractGovernedSessionId(base, { expectedRoot: 'team-1', bootRoot: 'boot' })
  assert.equal(good.ok, true)
  assert.equal(good.teamSessionId, 'team-1')
})

test('u7-tbash: the lane-scoped resolver allows exactly the pinned command once', async () => {
  const { decideResolution, commandHashOf } = await lib()
  const A = "printf 'X\\n' >> '/w/a' && echo U7TB_APPR_RAN"
  const B = "printf 'Y\\n' >> '/w/b' && echo U7TB_OTHER_RAN"
  const pinned = commandHashOf(A)
  const row = { requestId: 'ctrl-1', toolName: 'team_bash', rootSessionId: 'team-1' }
  assert.equal(decideResolution({ row, outstanding: { step: 0, command: A }, pinnedCommandHash: pinned, governedSessionId: 'team-1', allowsGiven: 0 }).decision, 'allow')
  assert.equal(decideResolution({ row: { ...row, rootSessionId: 'other' }, outstanding: { step: 0, command: A }, pinnedCommandHash: pinned, governedSessionId: 'team-1', allowsGiven: 0 }).decision, 'deny', 'other session is denied')
  // mutation controls: every widening is refused
  assert.equal(decideResolution({ row, outstanding: { step: 1, command: A }, pinnedCommandHash: pinned, governedSessionId: 'team-1', allowsGiven: 1 }).decision, 'deny', 'replay after the one allow')
  assert.equal(decideResolution({ row, outstanding: { step: 0, command: A }, pinnedCommandHash: pinned, governedSessionId: 'team-1', allowsGiven: 1 }).decision, 'deny', 'second allow is unexpressable')
  assert.equal(decideResolution({ row, outstanding: { step: 1, command: A }, pinnedCommandHash: pinned, governedSessionId: 'team-1', allowsGiven: 0 }).decision, 'deny', 'only the first issue')
  assert.equal(decideResolution({ row, outstanding: { step: 0, command: B }, pinnedCommandHash: pinned, governedSessionId: 'team-1', allowsGiven: 0 }).decision, 'deny', 'different command hash')
  assert.equal(decideResolution({ row, outstanding: { step: 0, command: `${A} ` }, pinnedCommandHash: pinned, governedSessionId: 'team-1', allowsGiven: 0 }).decision, 'deny', 'one byte differs = different hash')
  assert.equal(decideResolution({ row: { ...row, toolName: 'team_skill' }, outstanding: { step: 0, command: A }, pinnedCommandHash: pinned, governedSessionId: 'team-1', allowsGiven: 0 }).decision, 'deny', 'other tool')
  assert.equal(decideResolution({ row, outstanding: null, pinnedCommandHash: pinned, governedSessionId: 'team-1', allowsGiven: 0 }).decision, 'deny', 'unattributed row')
  // MEASURED at boot 1 (dev/agent-workflow/evidence/u7-tbash-l4-20261027/
  // c2/c2-verdicts-boot1.json): the durable PA row for a governed team_bash
  // call carries `toolName: "bash"` — the NATIVE takeover spelling the row
  // mounts under, not the managed alias the model calls. The lane resolver
  // must recognise it; the command hash stays the ONLY widening control.
  assert.equal(decideResolution({ row: { ...row, toolName: 'bash' }, outstanding: { step: 0, command: A }, pinnedCommandHash: pinned, governedSessionId: 'team-1', allowsGiven: 0 }).decision, 'allow', 'native takeover spelling')
  assert.equal(decideResolution({ row: { ...row, toolName: 'bash' }, outstanding: { step: 0, command: B }, pinnedCommandHash: pinned, governedSessionId: 'team-1', allowsGiven: 0 }).decision, 'deny', 'native spelling does not widen the command')
})

test('u7-tbash: results join to calls by tool_use_id, not by position (r5 artifact)', async () => {
  const { callResultsOf } = await lib()
  const use = (id, cmd) => ({ type: 'tool_use', id, name: 'team_bash', input: { command: cmd } })
  const res = (id, text) => ({ type: 'tool_result', tool_use_id: id, content: [{ type: 'text', text }] })
  // call 1 BLOCKS (no result yet) while call 2 (another lane) answers first
  const reqs = [
    { body: { messages: [{ role: 'assistant', content: [use('t1', 'A')] }] } },
    { body: { messages: [{ role: 'assistant', content: [use('t2', 'B')] }, { role: 'user', content: [res('t2', 'refused B')] }] } },
    { body: { messages: [{ role: 'assistant', content: [use('t1', 'A')] }, { role: 'user', content: [res('t1', 'ran A')] }] } },
  ]
  const out = callResultsOf(reqs)
  assert.deepEqual(out.map((x) => [x.command, x.text]), [['B', 'refused B'], ['A', 'ran A']])
})

test('u7-tbash: the brain issues the 4-step script from the transcript; fence never self-satisfies', withAssembly(async (a) => {
  const { makeTbashDecide, askerScript } = await lib()
  const decide = makeTbashDecide({ assembly: a })
  const script = askerScript(a)
  assert.deepEqual(script.map((s) => s.tag), ['appr', 'replay', 'other', 'deny'])
  assert.equal(script[0].command, script[1].command)
  const notice = { role: 'user', content: `[team-work requestToken=${a.tokens('d1')}] ${a.markers.MK_SCRIPT}` }
  const msgs = [notice]
  for (let k = 0; k < 4; k += 1) {
    const reply = decide({ req: { body: { messages: msgs } } })
    assert.equal(reply.kind, 'tool-call')
    assert.equal(reply.toolCalls[0].name, 'team_bash')
    assert.equal(reply.toolCalls[0].arguments.command, script[k].command)
    // a retried identical request yields the SAME step (no counter drift)
    assert.equal(decide({ req: { body: { messages: msgs } } }).toolCalls[0].arguments.command, script[k].command)
    const id = `tu-${String(k)}`
    msgs.push({ role: 'assistant', content: [{ type: 'tool_use', id, name: 'team_bash', input: { command: script[k].command } }] })
    msgs.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: [{ type: 'text', text: 'x' }] }] })
  }
  assert.deepEqual(decide({ req: { body: { messages: msgs } } }), { kind: 'text', content: a.DONE.asker })
  assert.deepEqual(decide.__state().issued.map((x) => x.step), [0, 1, 2, 3])
  // leader: create, then (no id yet) wait; hold text never embeds the fence
  const l1 = decide({ req: { body: { messages: [{ role: 'user', content: a.markers.MK_L1 }] } } })
  assert.equal(l1.toolCalls[0].name, 'team_create_member')
  const created = [{ role: 'user', content: a.markers.MK_L1 }, { role: 'assistant', content: [{ type: 'tool_use', id: 'c', name: 'team_create_member', input: {} }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'c', content: [{ type: 'text', text: '{"instanceId":"inst-asker-1"}' }] }] }]
  const l2 = decide({ req: { body: { messages: created } } })
  assert.equal(l2.toolCalls[0].name, 'team_delegate')
  assert.equal(l2.toolCalls[0].arguments.delegationInstanceId, 'inst-asker-1')
  let held = null
  for (let i = 0; i < 10 && held === null; i += 1) {
    const r = decide({ req: { body: { messages: [...created, { role: 'user', content: 'U7TB_PHASE_w' }] } } })
    if (r.kind === 'text') held = r.content
  }
  assert.ok(held !== null && !held.includes(a.DONE.asker), 'hold text must not contain the fence')
  // the leader's OWN assistant text containing the fence does not advance it
  const self = decide({ req: { body: { messages: [...created, { role: 'assistant', content: a.DONE.asker }, { role: 'user', content: 'U7TB_PHASE_w' }] } } })
  assert.notDeepEqual(self, { kind: 'text', content: a.DONE.leader })
  // a HOST message (the team_collect tool_result) carrying the fence advances to close
  const fenced = decide({ req: { body: { messages: [...created,
    { role: 'assistant', content: [{ type: 'tool_use', id: 'k', name: 'team_collect', input: {} }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'k', content: [{ type: 'text', text: `collected: ${a.DONE.asker}` }] }] }] } } })
  assert.deepEqual(fenced, { kind: 'text', content: a.DONE.leader })
}))

function greenDigest(commandHashOf) {
  const A = "printf 'U7TB_APPR_x\\n' >> '/w/a' && echo U7TB_APPR_RAN"
  return {
    pinned: { commandHash: commandHashOf(A), claims: { appr: 'U7TB_APPR_x' }, ranEcho: { appr: 'U7TB_APPR_RAN', other: 'U7TB_OTHER_RAN', deny: 'U7TB_DENY_RAN' } },
    calls: [
      { step: 0, tag: 'appr', command: A, result: { isError: false, text: 'U7TB_APPR_RAN' } },
      { step: 1, tag: 'replay', command: A, result: { isError: false, text: 'a5p5-refused kind=refused-admission code=APPROVAL_DENIED' } },
      { step: 2, tag: 'other', command: 'printf B', result: { isError: false, text: 'a5p5-refused code=APPROVAL_DENIED' } },
      { step: 3, tag: 'deny', command: 'printf D', result: { isError: false, text: 'a5p5-refused code=APPROVAL_DENIED' } },
    ],
    resolutions: [
      { requestId: 'rA', step: 0, decision: 'allow', ok: true },
      { requestId: 'rR', step: 1, decision: 'deny', ok: true },
      { requestId: 'rB', step: 2, decision: 'deny', ok: true },
      { requestId: 'rD', step: 3, decision: 'deny', ok: true },
    ],
    ledger: {
      requests: [],
      decisions: [{ requestId: 'rA', decision: 'allow' }, { requestId: 'rR', decision: 'deny' }, { requestId: 'rB', decision: 'deny' }, { requestId: 'rD', decision: 'deny' }],
      consumptions: [{ requestId: 'rA' }],
    },
    seamReAllow: { requestId: 'rA', ok: false },
    effects: { appr: 'U7TB_APPR_x\n', other: null, deny: null },
    leak: { inCorpus: false, inHostLog: false, bytesUnchanged: true },
  }
}

test('u7-tbash: judge — all-green PASSes, and every case flips on its own evidence (mutation controls)', async () => {
  const { judgeTbash, commandHashOf, TBASH_CASES } = await lib()
  const verdicts = (d, alive = true) => Object.fromEntries(judgeTbash(d, alive).map(([id, v]) => [id, v]))
  const green = verdicts(greenDigest(commandHashOf))
  assert.deepEqual(Object.keys(green).sort(), TBASH_CASES.filter((c) => c !== 'tbash:mounted').sort())
  for (const v of Object.values(green)) assert.equal(v, 'PASS')
  const mutations = {
    'tbash:approve-spawn-once': [
      (d) => { d.effects.appr = 'U7TB_APPR_x\nU7TB_APPR_x\n' }, // two spawns
      (d) => { d.effects.appr = null }, // no effect on disk
      (d) => { d.ledger.consumptions = [] }, // never consumed
      (d) => { d.ledger.consumptions.push({ requestId: 'rA' }) }, // consumed twice
      (d) => { d.ledger.decisions.push({ requestId: 'rA', decision: 'allow' }) }, // two decisions
      (d) => { d.calls[0].result.text = 'refused' }, // tool result is not the ran echo
      (d) => { d.resolutions[0].ok = false }, // seam resolve failed
    ],
    'tbash:replay-refused': [
      (d) => { d.calls[1].result.text = 'U7TB_APPR_RAN' }, // replay ran
      (d) => { d.resolutions[1].decision = 'allow' }, // replay got an approval
      (d) => { d.resolutions[1].requestId = 'rA' }, // replay reused the spent row
      (d) => { d.seamReAllow.ok = true }, // spent row re-allowed at the seam
      (d) => { d.calls[1].command = 'printf other' }, // not actually a replay
    ],
    'tbash:other-command-refused': [
      (d) => { d.effects.other = 'U7TB_OTHER_x\n' }, // effect landed
      (d) => { d.calls[2].command = d.calls[0].command }, // same command, not "other"
      (d) => { d.resolutions[2].decision = 'allow' }, // grant widened
      (d) => { d.ledger.consumptions.push({ requestId: 'rB' }) },
    ],
    'tbash:deny-zero-effect': [
      (d) => { d.effects.deny = 'U7TB_DENY_x\n' },
      (d) => { d.resolutions = d.resolutions.filter((r) => r.step !== 3) }, // no human deny happened
      (d) => { d.ledger.decisions = d.ledger.decisions.filter((x) => x.requestId !== 'rD') },
      (d) => { d.calls[3].result = null }, // never answered
    ],
    'tbash:leak-check': [
      (d) => { d.leak.inCorpus = true },
      (d) => { d.leak.inHostLog = true },
      (d) => { d.leak.bytesUnchanged = false },
    ],
  }
  for (const [caseId, list] of Object.entries(mutations)) {
    for (const [i, mutate] of list.entries()) {
      const d = greenDigest(commandHashOf)
      mutate(d)
      assert.equal(verdicts(d)[caseId], 'FAIL', `${caseId} mutation #${String(i)} must FAIL`)
    }
  }
  // a dead host fails every effect case
  const dead = verdicts(greenDigest(commandHashOf), false)
  for (const c of ['tbash:approve-spawn-once', 'tbash:replay-refused', 'tbash:other-command-refused', 'tbash:deny-zero-effect']) assert.equal(dead[c], 'FAIL')
  // the synchronous-refusal replay mode (no second row) is ALSO a pass
  const sync = greenDigest(commandHashOf)
  sync.resolutions = sync.resolutions.filter((r) => r.step !== 1)
  sync.ledger.decisions = sync.ledger.decisions.filter((x) => x.requestId !== 'rR')
  assert.equal(verdicts(sync)['tbash:replay-refused'], 'PASS')
})
