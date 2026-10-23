// OVERLAY-22 OFFLINE RE-EVALUATION (root 22:45) — read-only, no Host, no boot, no world, no network.
// It replays the RETAINED raw of the original run against the KIT'S OWN predicate bytes and re-evaluates
// every C5 criterion independently, then prints a receipt to stdout (this script writes nothing).
//
// What this receipt is NOT, in root's own words so the record cannot drift: the signing scope is
// "真实正 / deny / abandon + 谓词假阴性的离线复核". It is NOT a claim that the original runner exited RC0,
// NOT a claim that the original run passed — summary.json still says exitCode 2 with C5 3/4, and this file
// quotes that verbatim instead of re-attributing it. Nothing in the run dir is modified or deleted.
//
// HONESTY OF METHOD (root 22:55): this script does NOT call the kit's denialPairSeen — it runs its OWN
// structural pair scan (tool_use(read_image, IMG_REL) -> tool_result with the SAME tool_use_id and is_error
// true) and imports only the kit's toolResultText + c5SettleTextOk bytes. So it demonstrates the pair the
// criterion needs, judged by the kit's text rule; it is not a claim that the same function was executed.
// Predicate sources: the CURRENT kit (fixed c5SettleTextOk) and the RETAINED pre-fix snapshot
// .pinbuild-verify/kit-c5prefix-1c3d2642.mjs, from which the OLD inline predicate is extracted exactly as
// written — so the false negative is reproduced with the bytes that were actually in force, not paraphrased.
import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'

// this file lives at dev/agent-workflow/evidence/a5m2-img-r18/offline-reeval/; walk up to the worktree root
let root = dirname(new URL(import.meta.url).pathname)
for (;;) { if (existsSync(join(root, 'tests/kits/a5m2-todo-c2/a5m2-todo-c2.mjs'))) break; const up = dirname(root); if (up === root) throw new Error('worktree root not found above this script'); root = up }
const RUN = process.argv[2] ?? join(root, 'dev/agent-workflow/evidence/a5m2-img-r18/run-2026-10-23T22-35-22')
const sha = (buf) => createHash('sha256').update(buf).digest('hex')
const hashes = {}
const loadTxt = (p, label) => { const buf = readFileSync(p); hashes[label ?? p] = sha(buf); return buf.toString('utf8') }

const reqs = JSON.parse(loadTxt(join(RUN, 'mock.log'), 'mock.log (full 28-request wire array)'))
const ledger = JSON.parse(loadTxt(join(RUN, 'ledger-dump.json'), 'ledger-dump.json (final durable readLedger())')).last
const conseq = JSON.parse(loadTxt(join(RUN, 'control-consumption-evidence.json'), 'control-consumption-evidence.json'))
const fixture = JSON.parse(loadTxt(join(RUN, 'fixture-evidence.json'), 'fixture-evidence.json'))
const todoLaw = JSON.parse(loadTxt(join(RUN, 'zero-todo-law-public-abandon.json'), 'zero-todo-law-public-abandon.json'))
const summary = JSON.parse(loadTxt(join(RUN, 'summary.json'), 'summary.json (the runner outcome, quoted, never rewritten)'))
const runLog = loadTxt(join(RUN, 'run.log'), 'run.log')
const kitNew = loadTxt(join(root, 'tests/kits/a5m2-todo-c2/a5m2-todo-c2.mjs'), 'kit CURRENT (OVERLAY-22b) tests/kits/a5m2-todo-c2/a5m2-todo-c2.mjs')
const kitOldPath = join(root, '.pinbuild-verify/kit-c5prefix-1c3d2642.mjs')
const kitOld = loadTxt(kitOldPath, `kit PRE-FIX snapshot .pinbuild-verify/${kitOldPath.split('/').pop()}`)
const sessionFile = join(RUN, 'session-logs', `on-stop__--srv-workspace-dsh-plugins-dsh-agent-team-.worktrees-a5-m2-int-tests-deepseek-harness-test-use--__session-team-child-976d16bfee62d2a7378e60e13b081e8f__session.v4.jsonl.zstd.txt`)
const sessionTxt = loadTxt(sessionFile, 'session-logs/<child 976d16bfee…> session.v4 (Host-side tool/result events)')

// ── the kit's own bytes, sliced not paraphrased ────────────────────────────────────────────────────────
const slice = (src, name) => { const s = src.indexOf(`function ${name}(`); if (s === -1) throw new Error(`slice anchor missing: ${name}`); return src.slice(s, src.indexOf('\n}\n', s) + 3) }
const IMG_REL = fixture.relPath
const mod = await import(`data:text/javascript;base64,${Buffer.from([
  `const IMG_REL = ${JSON.stringify(IMG_REL)}`,
  slice(kitNew, 'toolResultText'), slice(kitNew, 'denialPairSeen'), slice(kitNew, 'c5SettleTextOk'),
  'export { denialPairSeen, c5SettleTextOk, toolResultText }',
].join('\n')).toString('base64')}`)
const oldLine = kitOld.split('\n').find((l) => l.includes('const pair = denialPairSeen(msgs, wantC,'))
// The OLD line ends with "…/i.test(t))": the first ')' closes .test(, the second closes denialPairSeen(.
// Stripping exactly one gives the arrow body byte-for-byte as it was written in kit 1c3d2642.
if (!oldLine || !oldLine.endsWith('.test(t))')) throw new Error('old predicate line not recoverable from the pre-fix snapshot')
const oldExpr = oldLine.slice(oldLine.indexOf('(t) => ') + 7, oldLine.length - 1).replaceAll('row3.payload.requestId', 'rid')
const oldPred = new Function('t', 'rid', `return (${oldExpr})`)

// ── identities, taken from the raw (never assumed) ─────────────────────────────────────────────────────
const recorded = (ledger.recorded ?? []).filter((f) => (f.payload?.toolName ?? '') === 'read_image')
const ridOrder = [...new Set(recorded.map((f) => f.payload.requestId))]
const abMatch = runLog.match(/C5 PASS — cancel via the EXISTING p6t6 abandon fixture[^\n]*/)
const abVal = abMatch ? JSON.parse(abMatch[0].match(/value=(\{.*?\}) err=/s)[1]) : null
const row1 = conseq.requestId
const row3 = abVal?.requestId
const row2 = ridOrder.find((r) => r !== row1 && r !== row3) ?? null
const cnt = (list, rid) => (list ?? []).filter((f) => f.payload?.requestId === rid).length
const wantC = { tool: 'read_image', file: IMG_REL }
const msgsOf = (r) => (r?.body?.messages ?? [])
const scan = (rid, pred) => reqs.flatMap((r) => {
  const uses = new Set()
  for (const m of msgsOf(r)) if (m?.role === 'assistant' && Array.isArray(m.content)) for (const b of m.content) if (b?.type === 'tool_use' && b?.name === 'read_image' && b?.input?.file_path === IMG_REL) uses.add(b.id)
  const out = []
  for (const m of msgsOf(r)) for (const b of Array.isArray(m?.content) ? m.content : []) {
    if (b?.type === 'tool_result' && uses.has(b.tool_use_id) && b.is_error === true) {
      const t = mod.toolResultText(b.content ?? '')
      if (pred(t, rid)) out.push({ seq: r.seq, at: r.receivedAt, callId: b.tool_use_id, text: t })
    }
  }
  return out
})
const sessionEvents = sessionTxt.split('\n').map((l) => { try { return JSON.parse(l) } catch { return null } }).filter((o) => o?.type === 'tool/result')
const sessOf = (rid) => sessionEvents.find((o) => JSON.stringify(o?.data?.message ?? '').includes(rid))

let bad = 0, total = 0
const line = (name, ok, detail) => { total += 1; if (!ok) bad += 1; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}\n       ${detail}`) }

console.log('=== OVERLAY-22 OFFLINE RE-EVALUATION OF C5 — original run raw, read-only ===')
console.log(`run dir      : ${RUN}`)
console.log(`fixture      : ${IMG_REL}  (mode=${fixture.mode} synthetic=${JSON.stringify(fixture.synthetic)}; expected normalization ${fixture.expectedNormalization.width}x${fixture.expectedNormalization.height} from ${fixture.expectedNormalization.originalDimensions.width}x${fixture.expectedNormalization.originalDimensions.height})`)
console.log(`wire         : ${reqs.length} requests, seq ${reqs[0].seq}..${reqs[reqs.length - 1].seq}`)
console.log(`identities   : row1(allow)=${row1}  row2(deny)=${row2}  row3(abandon)=${row3}  read_image rows in durable ledger=${ridOrder.length}`)
console.log(`durable facts: recorded=${(ledger.recorded ?? []).length} decisions=${(ledger.decisions ?? []).length} consumptions=${(ledger.consumptions ?? []).length} abandonments=${(ledger.abandonments ?? []).length}`)
console.log('method (root 22:55): this script runs its OWN structural pair scan over the raw (tool_use(read_image, IMG_REL) -> '
  + 'tool_result with the SAME tool_use_id and is_error true) and imports only the kit\'s toolResultText and '
  + 'c5SettleTextOk bytes; it does NOT call the kit\'s denialPairSeen, so nothing here claims same-function '
  + 'verification — it shows the pair the criterion needs, judged by the kit\'s own text rule.')
console.log(`original outcome (quoted, NOT re-attributed): summary.exitCode=${summary.exitCode} criteria=${JSON.stringify((summary.criteria ?? []).map((c) => [c.id, c.status, (c.checks ?? []).filter((k) => k.ok === true).length + '/' + (c.checks ?? []).length]))}`)

const census = (fixture.afterAllow ?? {}).storeCensus ?? []
line('C5-1 a third governed read_image row was recorded and stayed pending (never decided, never consumed)',
  ridOrder.length === 3 && row3 !== null && cnt(ledger.decisions, row3) === 0 && cnt(ledger.consumptions, row3) === 0,
  `ridOrder=${JSON.stringify(ridOrder)} decisions(row3)=${cnt(ledger.decisions, row3)} consumptions(row3)=${cnt(ledger.consumptions, row3)}`)

line('C5-2 cancel ran through the EXISTING p6t6 abandon fixture = production abandonControlRequest authority (runner-recorded answer; the durable fact carries its own sequence)',
  !!abVal && (abMatch[0].includes('status=200')) && abVal.requestId === row3 && typeof abVal.abandonmentSequence === 'number' && /a5m2c2-c5 cancel-via-existing-fixture/.test(abVal.reason ?? ''),
  `${(/status=\d+/.exec(abMatch[0] ?? '') ?? ['status=n/a'])[0]} requestId=${abVal?.requestId} abandonmentSequence=${abVal?.abandonmentSequence} reason=${abVal?.reason} abandonedAt=${abVal?.abandonedAt}`)

line("C5-3 ONE durable abandon fact for row3 and ZERO consumptions for row3, re-derived here from ledger-dump; the post-abandon CENSUS comparison is read from the run's own recorded afterAllow snapshot — this script does not re-measure the census at that instant",
  cnt(ledger.abandonments, row3) === 1 && cnt(ledger.consumptions, row3) === 0
  && census.length === (fixture.storeCensusBaseline ?? []).length + 1 && census.every((o) => o.rel === (fixture.afterAllow ?? {}).addedObject),
  `abandonFacts(row3)=${cnt(ledger.abandonments, row3)} consumptions(row3)=${cnt(ledger.consumptions, row3)} | recorded census baseline=${JSON.stringify(fixture.storeCensusBaseline)} afterAllow=${JSON.stringify(census)} addedObject=${(fixture.afterAllow ?? {}).addedObject} | LAYERED: "the abandon added no object" rests on the original run's own C5 PASS and its C2 baseline-0 / C3 +1 / C4 store-1 raw, not on a re-measurement here`)

line('C5-3x CROSS — the row2 public DENY produced NO abandon fact and NO consumption, so a plain deny cannot masquerade as an abandon; row1 keeps its single consumption',
  cnt(ledger.abandonments, row2) === 0 && cnt(ledger.consumptions, row2) === 0 && cnt(ledger.consumptions, row1) === 1
  && (runLog.match(/durableFileAbandonFacts=(\d+)/)?.[1] === '1'),
  `abandonFacts(row2)=${cnt(ledger.abandonments, row2)} consumptions(row2)=${cnt(ledger.consumptions, row2)} consumptions(row1)=${cnt(ledger.consumptions, row1)} durableFileAbandonFacts(row3)=${runLog.match(/durableFileAbandonFacts=(\d+)/)?.[1]} consumptionEvidence.requestId=${conseq.requestId}`)

const oldHits3 = scan(row3, oldPred)
const newHits3 = scan(row3, (t, rr) => mod.c5SettleTextOk(t, rr, true))
const newHits2 = scan(row2, (t, rr) => mod.c5SettleTextOk(t, rr, true))
const wireUses27 = (() => { const r = reqs.find((x) => x.seq === 27); const ids = []
  for (const m of msgsOf(r)) if (m?.role === 'assistant' && Array.isArray(m.content)) for (const b of m.content) if (b?.type === 'tool_use' && b?.name === 'read_image' && !ids.includes(b.id)) ids.push(b.id)
  return ids })()
const s50 = sessOf(row3)
line('C5-4a the OLD predicate reproduces the recorded FALSE NEGATIVE exactly — zero hits over all 28 requests (the raw settle was there, the wording set missed it)',
  oldHits3.length === 0, `oldPredicate(row3) hits=${oldHits3.length}; runner recorded: "${(runLog.match(/no callId-paired is_error tool_result bound to row3 requestId observed/) ?? ['n/a'])[0]}" after "${(runLog.match(/mock wait timed out: C5 member-visible cancel settle[^\n(]*/) ?? ['n/a'])[0]}…)"`)
line('C5-4b the FIXED predicate (kit bytes, sliced) finds the row3 settle with the IMAGE leg set (root 22:55: the denial branch is image-only and also requires APPROVAL_DENIED) — same callId, is_error true, IMG_REL tool_use paired, row3 requestId bound, no row2 bleed',
  newHits3.length === 1 && newHits3[0].seq === 27 && newHits3[0].callId === wireUses27[wireUses27.length - 1] && newHits3[0].text.includes(row3) && !newHits3[0].text.includes(row2),
  `seq=${newHits3[0]?.seq} at=${newHits3[0]?.at} callId=${newHits3[0]?.callId} (third and last read_image call on that wire: ${wireUses27[wireUses27.length - 1]}) text=${JSON.stringify(String(newHits3[0]?.text).slice(0, 130))}`)
const denyCallId = newHits2[0]?.callId
line('C5-4c DISCRIMINATION — bound to row2 the SAME predicate resolves ONLY to the row2 pair (identical wording, different requestId) across every request that repeats that history: the binding is per-row, not per-word',
  newHits2.length >= 1 && denyCallId !== undefined && denyCallId !== newHits3[0]?.callId
  && newHits2.every((h) => h.text.includes(row2) && !h.text.includes(row3) && h.callId === denyCallId)
  && newHits3.every((h) => h.callId !== denyCallId),
  `row2-bound hits=${newHits2.length} on seqs ${newHits2.map((h) => h.seq).join(',')} all callId=${denyCallId}; row3-bound hits=${newHits3.length} callId=${newHits3[0]?.callId}`)
line('C5-4d Host-side agreement (nested field, not top level) — the child session tool/result event carries event.data.message.isError=true for the SAME callId and the same row3 sentence',
  s50?.data?.message?.isError === true && (s50.data.message.toolCallId ?? '') === newHits3[0]?.callId
  && mod.toolResultText(s50.data.message.content ?? '').includes(`durable Control request ${row3} answered deny`),
  `session seq=${s50?.seq} type=${s50?.type} data.keys=${JSON.stringify(Object.keys(s50?.data ?? {}))} message.keys=${JSON.stringify(Object.keys(s50?.data?.message ?? {}))} isError=${JSON.stringify(s50?.data?.message?.isError)} toolCallId=${s50?.data?.message?.toolCallId}`)

const wireTodo = reqs.reduce((n, r) => n + msgsOf(r).filter((m) => m?.role === 'assistant').flatMap((m) => Array.isArray(m.content) ? m.content : []).filter((b) => b?.type === 'tool_use' && b?.name === 'todo_write').length, 0)
line('C5-5 ZERO todo footprint at the public-abandon boundary (durable lanes, the run boundary snapshot, and the model wire re-counted from raw)',
  (todoLaw.laneFacts ?? []).length === 0 && (todoLaw.sessionRows ?? -1) === 0 && wireTodo === 0 && todoLaw.ledgerError === null,
  `laneFacts=${JSON.stringify(todoLaw.laneFacts)} sessionRows=${todoLaw.sessionRows} wireCalls=${todoLaw.wireCalls} wireHits=${JSON.stringify(todoLaw.wireHits)} ledgerError=${JSON.stringify(todoLaw.ledgerError)} wireTodoRecount=${wireTodo}`)

console.log('--- runner outcome lines, quoted verbatim (original failure preserved) ---')
for (const l of runLog.split('\n')) if (/C4: |C5: |C5 FAIL|FIRST-FAILURE-STOP/.test(l)) console.log('  ' + l.trim())
console.log('--- inputs, hashed read-only by this receipt (full sha256) ---')
for (const [k, v] of Object.entries(hashes)) console.log(`  ${v}  ${k}`)
console.log(`RECEIPT PASS=${total - bad}/${total} bad=${bad} — scope: 真实正 / deny / abandon + C5 谓词假阴性 的离线复核. The original runner exit (summary.exitCode=${summary.exitCode}, C5 ${(summary.criteria ?? []).find((c) => c.id === 'C5')?.checks?.filter((k) => k.ok === true).length}/4) stands as recorded; this receipt does not declare the original run passed and wrote nothing into the run dir.`)
process.exit(bad === 0 ? 0 : 1)
