/**
 * G1F-SUP-A unit self-checks (ZERO Host starts): exercises the routing
 * `decide`, `treeHash`/`treeDigest`, and — the critical part — runs
 * `evaluateG1AOracle` against a SYNTHETIC ledger that mirrors, row-for-row,
 * what the plugin emits on a fully passing run (plus negative mutations, to
 * prove the oracle is not vacuously permissive). Transcription drift between
 * the plugin's row schema and the oracle is the top pre-run risk; this file
 * catches it before a Host start is spent.
 * Usage: node g1fa-selfcheck.mjs
 * @module dev/agent-workflow/evidence/u4-g1f-sup-a-20261025/g1fa-selfcheck
 */
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync, appendFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { evaluateG1AOracle, makeDecideG1A, treeDigest, treeHash, GROUPS } from './g1fa-run.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const TMP = join(HERE, 'runs', 'selfcheck-tmp')
let failures = 0
const t = (name, cond, detail = '') => {
  if (cond !== true) { failures += 1; console.log(`FAIL ${name} ${detail}`) } else console.log(`ok   ${name}`)
}

// ── 1. decide routing / answered / breaker ──────────────────────────────────
{
  rmSync(TMP, { recursive: true, force: true })
  const probes = []
  const decide = makeDecideG1A({ maxRepeat: 8, maxTotal: 500, onProbe: (p) => probes.push(p), sessionIds: { T: 'ST', N: 'SN' }, spoofMarker: 'G1A-SPOOF-x' })
  const r0 = decide({ req: { messages: [{ role: 'user', content: `go G1A-T-1 ${'G1FA-PROMPT-T'} st` }], tools: [{ function: { name: 'u4_h0_target' } }] } })
  t('decide-first-is-h1', r0.kind === 'tool-call' && r0.toolCalls[0].id === 'g1a-h1' && r0.toolCalls[0].name === 'u4g1a_ctl', JSON.stringify(r0.toolCalls?.[0]))
  const r1 = decide({ req: { messages: [{ role: 'user', content: 'G1FA-PROMPT-T' }, { role: 'tool', tool_call_id: 'g1a-h1' }] } })
  t('decide-answered-advances', r1.toolCalls?.[0]?.id === 'g1a-c1', JSON.stringify(r1.toolCalls?.[0]))
  const msgsN = [{ role: 'user', content: 'G1FA-PROMPT-N' }]
  const rN = decide({ req: { messages: msgsN } })
  t('decide-N-routes-plugin-manager', rN.toolCalls?.[0]?.id === 'g1a-n1' && rN.toolCalls?.[0]?.name === 'plugin_manager', JSON.stringify(rN.toolCalls?.[0]))
  const spoofMsgs = [{ role: 'user', content: 'G1FA-PROMPT-T' }]
  const allT = GROUPS.filter((g) => g.sess === 'T').flatMap((g) => g.script)
  const idx16 = allT.findIndex((e) => e.id === 't16')
  for (const e of allT.slice(0, idx16)) spoofMsgs.push({ role: 'tool', tool_call_id: `g1a-${e.id}` })
  const rS = decide({ req: { messages: spoofMsgs } })
  t('decide-spoof-dynamic-args', rS.toolCalls?.[0]?.id === 'g1a-t16' && rS.toolCalls?.[0]?.arguments?.agent_id === 'SN' && rS.toolCalls?.[0]?.arguments?.message === 'G1A-SPOOF-x', JSON.stringify(rS.toolCalls?.[0]))
  const breaker = makeDecideG1A({ maxRepeat: 2, sessionIds: { T: 'ST', N: 'SN' } })
  let last
  for (let i = 0; i < 4; i += 1) last = breaker({ req: { messages: [{ role: 'user', content: 'G1FA-PROMPT-T' }] } })
  t('decide-circuit-breaker', last.kind === 'text' && last.content.includes('g1a-circuit-break'), JSON.stringify(last))
  const idle = decide({ req: { messages: [{ role: 'user', content: 'title request' }] } })
  t('decide-idle-untagged', idle.kind === 'text' && idle.content === 'g1a-idle', JSON.stringify(idle))
}

// ── 2. treeHash/treeDigest ──────────────────────────────────────────────────
{
  mkdirSync(join(TMP, 'profiles', 'web'), { recursive: true })
  writeFileSync(join(TMP, 'profiles', 'web', 'cordis.patch.yml'), 'a\n')
  const h1 = treeDigest(treeHash(join(TMP, 'profiles')))
  writeFileSync(join(TMP, 'profiles', 'web', 'extra.mjs'), 'x\n')
  const h2 = treeDigest(treeHash(join(TMP, 'profiles')))
  t('treeDigest-changes-on-add', h1 !== h2, `${h1.slice(0, 8)} vs ${h2.slice(0, 8)}`)
  t('treeDigest-missing-root-empty', treeDigest(treeHash(join(TMP, 'nope'))) === treeDigest(new Map()), 'stable empty digest')
}

// ── 3. oracle against a synthetic full PASS ledger ──────────────────────────
const ev = { runDir: join(TMP, 'ev'), markerDir: join(TMP, 'markers'), ledger: join(TMP, 'ledger.jsonl') }
rmSync(ev.runDir, { recursive: true, force: true })
rmSync(ev.markerDir, { recursive: true, force: true })
mkdirSync(ev.markerDir, { recursive: true })
writeFileSync(ev.ledger, '')

const L = (row) => appendFileSync(ev.ledger, JSON.stringify({ at: '2026-10-25T00:00:00Z', ...row }) + '\n')
const marker = (name) => writeFileSync(join(ev.markerDir, name), 'x\n')

/** Emit the rows one governed TARGET call produces on the happy path. */
function targetCall(tag, callId, { body = 'A', legs = ['read', 'process'], abort = false, ran = true, cls = 'SUCCESS', reason = '', nested = false, guard = 'approve', signalRestored = true, post = 'ok' } = {}) {
  if (guard === 'approve') L({ leg: 'guard', phase: 'approve', callId, tag, nested, signalReplaced: true })
  if (guard === 'veto') L({ leg: 'guard', phase: 'veto', callId, tag, nested, reason })
  if (guard === 'off') L({ leg: 'guard', phase: 'disabled-passthrough', callId, tag })
  if (guard !== 'veto') {
    L({ leg: 'body-start', body, tag, callId, nested })
    L({ leg: 'grant-ok', body, tag, callId })
    marker(`${body}-${tag}.marker`)
    if (abort) L({ leg: 'body-abort-observed', body, tag, callId, reason: 'aborted' })
    for (const leg of legs) {
      L({ leg: leg === 'read' ? 'leg-read' : 'leg-process', body, tag, callId, ok: true, ...(leg === 'process' ? { echoOut: `g1fa-echo ${body} ${tag}` } : {}) })
      if (leg === 'process') marker(`${body}-${tag}.echo`)
    }
    L({ leg: 'body-end', body, tag, callId, ran: ran && !abort, aborted: abort, failed: [] })
  }
  if (guard === 'approve') L({ leg: 'guard', phase: 'settled', callId, tag, signalRestored, post, code: cls })
  L({ leg: 'result', callId, tag, name: 'u4_h0_target', isError: cls !== 'SUCCESS', code: cls, reason, msgHead: '' })
}
function equiv(kind, code, extra = {}) {
  L({ leg: 'equiv', kind, code, extra })
  if (!['eq1', 'eq4'].includes(kind)) {
    const tag = kind
    const cls = code
    if (!['eq5', 'eq6a', 'eq6b', 'eq7'].includes(kind)) { /* non-target-producing kinds handled by caller */ }
    return extra
  }
  return extra
}
const ctl = (action, tag = '', ok = true) => L({ leg: 'ctl', action, kind: '', ok, detail: '', callId: `ctl-${action}-${tag}`, tag })
const result = (callId, tag, name, code, reason = '', msgHead = '') => L({ leg: 'result', callId, tag, name, isError: code !== 'SUCCESS', code, reason, msgHead })

// heals + settles per group
for (const g of GROUPS) { if (g.sess === 'T' || g.name === 'G12') if (g.sess === 'T') ctl('heal', g.name) }
for (const extra of ['G4b', 'G5b', 'G5c', 'G9b']) ctl('heal', extra)
for (const g of GROUPS) ctl('settle', g.name)
ctl('regen-same')
ctl('restrict-on')
ctl('bind-late')
L({ leg: 'registrant', action: 'shadow-add', ok: true, detail: '', tag: '' })

// a–f cells
targetCall('a1', 'g1a-t01')
targetCall('b1', 'g1a-t02')
targetCall('c2', 'g1a-t03', { guard: 'veto', reason: 'identity-mismatch', cls: 'U4_GUARD_VETO', reason_ : undefined, legs: [] })
targetCall('c3', 'g1a-t04')
targetCall('d1', 'g1a-t05', { guard: 'veto', reason: 'not-visible', cls: 'U4_GUARD_VETO', legs: [] })
targetCall('d2', 'g1a-t06')
targetCall('c1', 'g1a-t07', { legs: [], abort: true, cls: 'ABORTED', post: 'drift' })
L({ leg: 'change-watch', armedLeft: 0, abortedTags: ['c1'] })
targetCall('b2', 'g1a-t08', { legs: [], abort: true, cls: 'ABORTED' })
L({ leg: 'center', kind: 'regen-mid', phase: 're-registered-same-object', ok: true })
// e1/e2: swap lands pre-dispatch → Host prevents body invocation (no body rows, no markers)
for (const t of ['e1', 'e2']) {
  L({ leg: 'guard', phase: 'approve', callId: `cid-${t}`, tag: t, nested: false, signalReplaced: true })
  L({ leg: 'change-watch', armedLeft: 0, abortedTags: [t] })
  L({ leg: 'guard', phase: 'settled', callId: `cid-${t}`, tag: t, signalRestored: true, post: 'drift', code: 'ABORTED_BEFORE_DISPATCH' })
  result(`cid-${t}`, t, 'u4_h0_target', 'ABORTED_BEFORE_DISPATCH')
}
targetCall('e3', 'g1a-t11', { legs: [], abort: true, cls: 'ABORTED' })
targetCall('f1', 'g1a-t14', { body: 'B', guard: 'off' })
targetCall('f2', 'g1a-t15')

// equivalence cells
equiv('eq1', 'ABORTED_BEFORE_DISPATCH')
result('g1a-eq1', 'eq1', 'u4_h0_target', 'ABORTED_BEFORE_DISPATCH')
equiv('eq2', 'ABORTED'); targetCall('eq2', 'g1a-eq2', { legs: [], abort: true, cls: 'ABORTED' })
equiv('eq3', 'ABORTED', { signalRestored: true, guardPost: 'drift' }); targetCall('eq3', 'g1a-eq3', { legs: [], abort: true, cls: 'ABORTED', post: 'drift' })
equiv('eq4', 'ABORTED_BEFORE_DISPATCH')
L({ leg: 'fence2', phase: 'swapped', callId: 'g1a-eq4', tag: 'eq4' })
L({ leg: 'change-watch', armedLeft: 0, abortedTags: ['eq4'] })
result('g1a-eq4', 'eq4', 'u4_h0_target', 'ABORTED_BEFORE_DISPATCH')
equiv('eq5', 'SUCCESS', { valueNote: 'G1A-VALUE-REPLACED' }); targetCall('eq5', 'g1a-eq5')
equiv('eq6a', 'SUCCESS', { valueNote: 'n', contentHead: 'B-render:{"ran":true}' })
L({ leg: 'swap', label: 'post-eq6a-restored', to: 'A', ok: true })
targetCall('eq6a', 'g1a-eq6a')
equiv('eq6b', 'INVALID_TOOL_OUTPUT', { msgHead: 'x' })
L({ leg: 'swap', label: 'post-eq6b-restored', to: 'A', ok: true })
targetCall('eq6b', 'g1a-eq6b')
equiv('eq7', 'ERROR', { msgHead: 'G1A-POST-BLOCKED eq7' })
targetCall('eq7', 'g1a-eq7')
equiv('fin-eq8', 'ABORTED', { contentHead: 'FINALIZED-BY-A' })
targetCall('fin-eq8', 'g1a-fin-eq8', { legs: [], abort: true, cls: 'ABORTED', post: 'drift' })
L({ leg: 'leg-finalize', body: 'A', callId: 'g1a-fin-eq8', tag: 'fin-eq8' })
L({ leg: 'leg-project', body: 'A', callId: 'g1a-fin-eq8', tag: 'fin-eq8' })
equiv('eq9', 'U4_GUARD_VETO', { modeBefore: 'parallel', modeAfterSwap: 'exclusive' })
L({ leg: 'guard', phase: 'veto', reason: 'identity-mismatch', callId: 'g1a-eq9-run', tag: 'eq9', nested: false })
result('g1a-eq9-run', 'eq9', 'u4_h0_target', 'U4_GUARD_VETO', 'identity-mismatch')
L({ leg: 'swap', label: 'eq9-restored', to: 'A', ok: true })
equiv('eq10', 'SUCCESS')
targetCall('eq10', 'g1a-eq10-inner', { nested: true })
equiv('eq11', 'U4_GUARD_VETO')
L({ leg: 'guard', phase: 'veto', reason: 'identity-mismatch', callId: 'g1a-eq11-inner', tag: 'eq11', nested: true })
result('g1a-eq11-inner', 'eq11', 'u4_h0_target', 'U4_GUARD_VETO', 'identity-mismatch')
L({ leg: 'swap', label: 'eq11-restored', to: 'A', ok: true })

// PoC-5
targetCall('p5a', 'g1a-t12', { guard: 'veto', reason: 'identity-mismatch', cls: 'U4_GUARD_VETO', legs: [] })
targetCall('p5b', 'g1a-t13', { body: 'Bp' })

// PoC-6 (T negatives + plant; N positives)
for (const [name, callId] of [['send_message', 'cid-sm-veto'], ['interrupt_agent', 'cid-in-veto'], ['plugin_manager', 'cid-pm-veto']]) {
  L({ leg: 'ctl-guard', phase: 'veto', reason: 'agent-control-deny', name, callId, tag: 'untagged', argHead: '{}' })
  result(callId, 'untagged', name, 'U4_GUARD_VETO', 'agent-control-deny')
}
L({ leg: 'ctl-guard', phase: 'passthrough-native', name: 'send_message', callId: 'cid-sm-plant', tag: 'untagged', argHead: '{"agent_id":"g1fa-bogus-agent","message":"G1A-PLANT-NATIVE"}' })
result('cid-sm-plant', 'untagged', 'send_message', 'ERROR', '', 'delivery failed')
L({ leg: 'ctl-guard', phase: 'passthrough-native', name: 'plugin_manager', callId: 'cid-pm-n', tag: 'untagged', argHead: '{"action":"list_plugins"}' })
result('cid-pm-n', 'untagged', 'plugin_manager', 'ERROR', '', 'sandbox escalation unavailable')
result('cid-la-n', 'untagged', 'list_agents', 'SUCCESS')
L({ leg: 'ctl-guard', phase: 'passthrough-native', name: 'send_message', callId: 'cid-sm-n', tag: 'untagged', argHead: '{"agent_id":"g1fa-bogus-agent","message":"g1fa-native-probe"}' })
result('cid-sm-n', 'untagged', 'send_message', 'ERROR', '', 'unknown agent')

const mock = { requests: [{ body: { messages: [{ content: 'G1FA-PROMPT-T ...' }, { content: 'G1A-SPOOF-2026' }] } }] } // T-only history mentions the marker
const base = () => evaluateG1AOracle({
  ev, noTokenStatus: 401, sessionIds: { T: 'ST', N: 'SN' },
  promptStatuses: GROUPS.map(() => 200), mock, final: true,
  spoofMarker: 'G1A-SPOOF-2026', profileHashes: { pre: 'aaaa', post: 'aaaa' },
})
const o1 = base()
const bad = Object.entries(o1.cells).filter(([, c]) => c.gating !== false && c.pass !== true).map(([k, c]) => `${k}:${c.detail}`)
t('synthetic-pass', o1.pass === true, bad.join(' | '))

// ── 4. negative mutations: the oracle must NOT stay green ───────────────────
const mutate = (name, row) => { L(row); const o = base(); t(`mutation-${name}`, o.pass === false, Object.entries(o.cells).filter(([, c]) => c.gating !== false && c.pass !== true).map(([k]) => k).join(',')) }
// B runs without the plant → global_b_exactly_plant fails
L({ leg: 'body-start', body: 'B', tag: 'a1', callId: 'g1a-t01', nested: false })
{
  const o = base()
  t('mutation-b-extra-start', o.pass === false, 'global_b_exactly_plant')
}
// profile hash drift → p6_profile_zero_effects fails
{
  const o = evaluateG1AOracle({ ev, noTokenStatus: 401, sessionIds: { T: 'ST', N: 'SN' }, promptStatuses: GROUPS.map(() => 200), mock, final: true, spoofMarker: 'G1A-SPOOF-2026', profileHashes: { pre: 'aaaa', post: 'bbbb' } })
  t('mutation-profile-drift', o.cells.p6_profile_zero_effects?.pass === false, 'p6_profile_zero_effects')
}
// spoof leaked into session N's request → zero-effects fails
{
  const leaky = { requests: [{ body: { messages: [{ content: 'G1FA-PROMPT-N' }, { content: 'G1A-SPOOF-2026' }] } }] }
  const o = evaluateG1AOracle({ ev, noTokenStatus: 401, sessionIds: { T: 'ST', N: 'SN' }, promptStatuses: GROUPS.map(() => 200), mock: leaky, final: true, spoofMarker: 'G1A-SPOOF-2026', profileHashes: { pre: 'aaaa', post: 'aaaa' } })
  t('mutation-spoof-leak', o.cells.p6_spoof_zero_effects?.pass === false, 'p6_spoof_zero_effects')
}
// a leg row present where NONE expected (c1) → legsOkFor must reject (the round-1 oracle bug)
L({ leg: 'leg-read', body: 'A', tag: 'c1', callId: 'g1a-t07', ok: true })
{
  const o = base()
  t('mutation-unexpected-leg-rejected', o.cells.c1_foreign_midbody?.pass === false, 'legsOkFor(c1, []) now REJECTS an unexpected leg row')
}
rmSync(TMP, { recursive: true, force: true })
console.log(failures === 0 ? 'SELFCHECK ALL OK' : `SELFCHECK FAILURES: ${failures}`)
process.exit(failures === 0 ? 0 : 1)
