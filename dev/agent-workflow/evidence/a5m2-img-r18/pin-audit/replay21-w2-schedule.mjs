// OVERLAY-21 replay (root 22:21): the deterministic C4 schedule, replayed against the KIT'S OWN code.
// The oracle's whole marker-dispatch region is sliced VERBATIM from
// tests/kits/a5m2-todo-c2/a5m2-todo-c2.mjs (W1 / W3 / CREATE / W2L / W3L branches, no paraphrase), together
// with denialPairSeen + imageTurnDoneAfterDenial, and driven with phased wires. Runner-side ordering that
// needs a live Host is asserted structurally on the same source text and is labelled STATIC.
// Confirms, per root's card: (1) a failed C3 cannot prompt (finishCriterion throws before the prompt line);
// (2) success finishes C3 first, then delegates; (3) the second W1 turn issues exactly ONE call and its
// denial turn closes with DONE, never a third; (4) the FIRST turn's DONE cannot satisfy the tail wait;
// (5) W3's third call and abandon path are unchanged. No Host, no world, nothing written. Exit 0 only if all hold.
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

const rel = 'tests/kits/a5m2-todo-c2/a5m2-todo-c2.mjs'
let dir = dirname(new URL(import.meta.url).pathname)
for (;;) { if (existsSync(join(dir, rel))) break; const up = dirname(dir); if (up === dir) throw new Error(`cannot find ${rel} above ${dir}`); dir = up }
const kit = readFileSync(join(dir, rel), 'utf8')
const src = kit.split('\n')
const lineOf = (needle, from = 0) => { const i = kit.indexOf(needle, from); if (i === -1) throw new Error(`anchor missing: ${needle}`); return i }
const fnFrom = (name) => { const s = lineOf(`function ${name}(`); return kit.slice(s, kit.indexOf('\n}\n', s) + 3) }
// lastUserTextOf is a ONE-LINER in the kit: fnFrom's "\n}\n" terminator would run past it and swallow the
// following helper, so it is taken by line instead (keeps every slice disjoint and each name declared once).
const lineFrom = (name) => { const m = kit.match(new RegExp(`^function ${name}\\(.*$`, 'm')); if (m === null) throw new Error(`one-liner missing: ${name}`); return m[0] }
const region = kit.slice(lineOf('    if (lastUser.includes(MK_DISC))'), lineOf("    return { kind: 'text', content: 'A5M2C2_ORACLE_FALLTHROUGH (no marker)' }"))

const modSrc = [
  `let FIXTURE = 'image'`,
  'function setFixture(f) { FIXTURE = f }',
  `const ROOT_P = 'session-a5m2c2-p-replay'`,
  `const NONCE = 'replay-nonce'`,
  `const MK = (p) => \`\${p}_\${NONCE}\``,
  `const MK_CREATE = MK('CREATE'), MK_WORK1 = MK('W1'), MK_W2L = MK('W2L'), MK_W3L = MK('W3L'), MK_WORK3 = MK('W3'), MK_DISC = MK('DISC')`,
  `const DONE_CREATE = 'A5M2C2_CREATE_DONE', DONE_WORK1 = 'A5M2C2_W1_DONE', DONE_W2L = 'A5M2C2_W2L_DONE', DONE_W3L = 'A5M2C2_W3L_DONE', DONE_WORK3 = 'A5M2C2_W3_DONE', DONE_DISC = 'A5M2C2_DISC_DONE'`,
  `const IMG_REL = 'examples/minimal/.sessions/a5m2c2-im-replay.png', IMG_W = 1024, IMG_H = 768`,
  `const WF_REL = 'wf.txt', WF_TGT = 'TGT', WF_DENY = 'DENY', WF_CANCEL = 'CANCEL'`,
  `const LIST1 = ['L1'], LIST2 = ['L2'], LIST3 = ['L3']`,
  `const NOTIF_PREFIX = '[team-control requestId='`,
  `const ALL_MARKERS = [MK_CREATE, MK_WORK1, MK_W2L, MK_W3L, MK_WORK3, MK_DISC]`,
  fnFrom('toolCall'), fnFrom('userTextOf'), fnFrom('lastTriggerIndex'), lineFrom('lastUserTextOf'),
  fnFrom('allToolResults'), fnFrom('extractInstanceId'), fnFrom('toolResultText'), fnFrom('denialPairSeen'),
  fnFrom('imageTurnDoneAfterDenial'),
  'function toolMsgsOf(msgs) { const i = lastTriggerIndex(msgs); return allToolResults(msgs.slice(i + 1)) }',
  'function imageVisiblePair() { return null }',
  'function decide(msgs) {',
  '  const lastUser = lastUserTextOf(msgs)',
  '  const tools = toolMsgsOf(msgs).length',
  region,
  "  return { kind: 'text', content: 'A5M2C2_ORACLE_FALLTHROUGH (no marker)' }",
  '}',
  'export { decide, setFixture, DONE_WORK1, DONE_W2L, DONE_W3L, DONE_WORK3, ROOT_P, NONCE, MK_WORK1, MK_WORK3, MK_W2L, MK_W3L, IMG_REL, imageTurnDoneAfterDenial }',
].join('\n')
const m = await import(`data:text/javascript;base64,${Buffer.from(modSrc).toString('base64')}`)
const { decide, DONE_WORK1, DONE_W2L, DONE_W3L, DONE_WORK3, ROOT_P, NONCE, MK_WORK1, MK_WORK3, MK_W2L, MK_W3L, IMG_REL } = m

const txt = (t) => ({ role: 'user', content: [{ type: 'text', text: t }] })
const asst = (blocks) => ({ role: 'assistant', content: blocks })
const use = (id, name, input) => ({ type: 'tool_use', id, name, input })
const toolRes = (id, text, isError) => (isError ? { role: 'tool', tool_call_id: id, is_error: true, content: text } : { role: 'tool', tool_call_id: id, content: text })
const MEMBER_RESULT = toolRes('call-create', JSON.stringify({ targetInstanceId: 'inst-member-1' }))
const callsOf = (r) => (r.kind === 'tool-call' ? r.toolCalls : [])
const first = (r) => callsOf(r)[0] ?? null
let bad = 0
const t = (name, cond, detail) => { if (!cond) bad += 1; console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${detail ? ` :: ${detail}` : ''}`) }

// ---- (3)+(4) the CHILD side: a second MK_WORK1 delegation = exactly one call, denial closes with DONE ----
const w1 = [txt(`${MK_WORK1} do the image task`)]
const c1 = decide(w1)
const c1call = first(c1)
t('1 W2-turn child at tools=0 issues exactly ONE read_image (IMG_REL)', callsOf(c1).length === 1 && c1call?.name === 'read_image' && c1call.arguments.file_path === IMG_REL, JSON.stringify(c1call ?? c1).slice(0, 100))
const c2 = decide([...w1, asst([use(c1call.id, 'read_image', { file_path: IMG_REL })]), toolRes(c1call.id, 'image ok')])
t('2 …and at tools=1 the turn CLOSES with DONE_WORK1 (in-turn continuation is gone)', c2.kind === 'text' && c2.content === DONE_WORK1, JSON.stringify(c2))
const denyText = `APPROVAL_DENIED durable Control request ctrl-row2 answered deny`
// A real governance denial arrives as an ERROR tool result (is_error true) whose text carries APPROVAL_DENIED
// plus the requestId-bound "answered deny" sentence — the shape the kit's own denialPairSeen requires and the r17
// write leg observed on the real Host, so the fabricated wires stay faithful to it.
const c3 = decide([...w1, asst([use(c1call.id, 'read_image', { file_path: IMG_REL })]), toolRes(c1call.id, denyText, true)])
t('3 a denied result closes the same way: DONE_WORK1, never a third call', c3.kind === 'text' && c3.content === DONE_WORK1, JSON.stringify(c3))
const c4 = decide([...w1, asst([use('u1', 'read_image', { file_path: IMG_REL })]), toolRes('u1', 'a'), asst([use('u2', 'read_image', { file_path: IMG_REL })]), toolRes('u2', 'b')])
t('4 tools=2 (call + denial already in) closes with DONE_WORK1 as text — never a third call', c4.kind === 'text' && c4.content === DONE_WORK1, JSON.stringify(c4))

// ---- (2)+(5) the LEADER side: W2L delegates once with its own token; W3L untouched ----
const leaderW2 = [txt('…create a member…'), asst([use('call-create', 'team_create_member', {})]), MEMBER_RESULT, txt(`${MK_W2L} Delegate task W2 to w1 asynchronously.`)]
const d0 = first(decide(leaderW2))
t('5 W2L leader delegates exactly once, with its OWN token a5c2-w2-delegate-<nonce>', d0?.name === 'team_delegate' && d0.arguments.requestToken === `a5c2-w2-delegate-${NONCE}`, JSON.stringify(d0?.arguments ?? decide(leaderW2)).slice(0, 160))
t('6 the delegation carries the SAME memberId, label w1, async true and prompt MK_WORK1', d0?.arguments.delegationInstanceId === 'inst-member-1' && d0?.arguments.label === 'w1' && d0?.arguments.async === true && d0?.arguments.prompt === MK_WORK1, JSON.stringify(d0?.arguments).slice(0, 200))
t('7 the W2L prompt text carries MK_W2L and NOT MK_WORK1, so the leader never calls read_image itself',
  !(`${MK_W2L} Delegate task W2 to w1 asynchronously.`).includes(MK_WORK1) && d0?.name !== 'read_image' && MK_W2L !== MK_WORK1)
t('8 the W2L leader targets ROOT_P (a prompt to the leader session, never straight to the child)', d0?.arguments.rootSessionId === ROOT_P, String(d0?.arguments.rootSessionId))
const dd = decide([...leaderW2, asst([use('call-deleg', 'team_delegate', {})]), toolRes('call-deleg', 'delegated')])
t('9 W2L turn then closes with its own DONE_W2L (a leader cannot delegate twice)', dd.kind === 'text' && dd.content === DONE_W2L, JSON.stringify(dd))
const dd2 = decide([...leaderW2, asst([use('a', 'team_delegate', {})]), toolRes('a', 'ok'), asst([use('b', 'team_delegate', {})]), toolRes('b', 'ok')])
t('10 a third W2L step can only FALLTHROUGH as text', dd2.kind === 'text' && String(dd2.content).includes('W2L_FALLTHROUGH'), JSON.stringify(dd2))
const leaderW3 = [txt('…create…'), asst([use('call-create', 'team_create_member', {})]), MEMBER_RESULT, txt(`${MK_W3L} Delegate task W3 to w1 asynchronously.`)]
const w3call = first(decide(leaderW3))
t('11 W3L path unchanged: token a5c2-w3-delegate-<nonce>, prompt MK_WORK3, DONE_W3L',
  w3call?.arguments.requestToken === `a5c2-w3-delegate-${NONCE}` && w3call?.arguments.prompt === MK_WORK3
  && decide([...leaderW3, asst([use('x', 'team_delegate', {})]), toolRes('x', 'ok')]).content === DONE_W3L, JSON.stringify(w3call?.arguments).slice(0, 170))
const w3child = decide([txt(`${MK_WORK3} third`), asst([use('t1', 'read_image', { file_path: IMG_REL })]), toolRes('t1', 'ok')])
t('12 W3 child turn still closes with DONE_WORK3 (abandon leg for row3 unchanged)', w3child.kind === 'text' && w3child.content === DONE_WORK3, JSON.stringify(w3child))

// ---- (4) the C4-tail predicate: the FIRST turn's DONE must not satisfy it ----
const okPairMsgs = [...w1, asst([use('u1', 'read_image', { file_path: IMG_REL })]), toolRes('u1', '<type>image</type> downscaled from 1024x768 px')]
const denyPairMsgs = [...w1, asst([use('u1', 'read_image', { file_path: IMG_REL })]), toolRes('u1', '<type>image</type>'), asst([use('u2', 'read_image', { file_path: IMG_REL })]), toolRes('u2', denyText, true)]
const doneReply = { kind: 'text', content: DONE_WORK1 }
t('13 first-turn DONE (no denial pair) does NOT satisfy the image tail wait', m.imageTurnDoneAfterDenial(doneReply, okPairMsgs, 'ctrl-row2') === false)
t('14 W2-turn DONE + the row2 denial pair DOES satisfy it', m.imageTurnDoneAfterDenial(doneReply, denyPairMsgs, 'ctrl-row2') === true)
t('15 a denial pair for a DIFFERENT requestId does not satisfy it', m.imageTurnDoneAfterDenial(doneReply, denyPairMsgs, 'ctrl-other') === false)
t('16 a non-DONE reply never satisfies it even with the pair', m.imageTurnDoneAfterDenial({ kind: 'text', content: 'A5M2C2_NOTIF_REMOTE_DRIVEN' }, denyPairMsgs, 'ctrl-row2') === false)
t('17 APPROVAL_DENIED without the exact "answered deny" wording does not satisfy it',
  m.imageTurnDoneAfterDenial(doneReply, [...w1, asst([use('u2', 'read_image', { file_path: IMG_REL })]), toolRes('u2', 'APPROVAL_DENIED but no sentence', true)], 'ctrl-row2') === false)

// ---- STATIC: runner ordering that needs a live Host, asserted on the same source text ----
const fcClose = lineOf("    finishCriterion('C3')\n")
const w2Prompt = lineOf("const p2 = await apiPrompt(host.origin, host.cookie, ROOT_P, `${MK_W2L} Delegate task W2 to w1 asynchronously.`, 'c4')")
const row2Wait = lineOf('`C4 second ${ROW_TOOL} row`')
const tailImg = lineOf('imageTurnDoneAfterDenial(r.reply')
const guard = kit.lastIndexOf("if (FIXTURE === 'image') {", w2Prompt)
t('18 STATIC: the W2 prompt sits strictly AFTER C3 finishCriterion and BEFORE the row2 wait', fcClose < w2Prompt && w2Prompt < row2Wait, `finish=${fcClose} prompt=${w2Prompt} row2wait=${row2Wait}`)
t('19 STATIC: the prompt is inside an image-only guard, targets ROOT_P, carries MK_W2L and never MK_WORK1/childSid',
  guard > fcClose && guard < w2Prompt && kit.slice(guard, w2Prompt).includes("FIXTURE === 'image'")
  && !kit.slice(w2Prompt, w2Prompt + 220).includes(MK_WORK1) && !kit.slice(w2Prompt, w2Prompt + 220).includes('childSid'), kit.slice(guard, guard + 24).replace(/\n/g, ' '))
t('20 STATIC: finishCriterion throws on a recorded failure, so a failed C3 cannot reach the prompt',
  /if \(!r\.pass\) throw new FirstFailureStop/.test(kit) && fcClose < w2Prompt)
t('21 STATIC: admission mirrors C5 (status 200 && result.ok -> dieFatal) and no new timer appears',
  /p2\.status === 200 && p2\.body\?\.result\?\.ok === true/.test(kit) && /C4 W2 delegate prompt not admitted/.test(kit)
  && /const p3 = await apiPrompt\(host\.origin, host\.cookie, ROOT_P, `\$\{MK_W3L\}/.test(kit) && /LOOP_BREAK_CAP = 2/.test(kit))
t('22 STATIC: the image tail uses the denial-bound wait, the write/todo leg keeps the original DONE_WORK1 wait',
  tailImg > row2Wait && /else if \(\(await waitForMock\(mock, \(r\) => r\.reply\?\.content === DONE_WORK1, 120_000, 'WORK1 turn done'\)\)/.test(kit))
t('23 STATIC: MK_W2L is a trigger marker (lastTriggerIndex sees it) and readImageUses is gone',
  /const ALL_MARKERS = \[MK_CREATE, MK_WORK1, MK_W2L, MK_W3L, MK_WORK3, MK_DISC\]/.test(kit)
  && !/function readImageUses/.test(kit) && !/readImageUses\(/.test(kit) && !/imageVisiblePair\(msgs\) !== null/.test(kit))

m.setFixture('write')
const wCase = first(decide([txt(`${MK_WORK1} w`), asst([use('u', 'write', { file_path: 'wf.txt', content: 'TGT' })]), toolRes('u', 'ok')]))
t('24 write fixture case1 unchanged (still write WF_DENY; the revert touched image only)', wCase?.name === 'write' && wCase.arguments.content === 'DENY', JSON.stringify(wCase).slice(0, 120))
m.setFixture('todo')
const tCase = first(decide([txt(`${MK_WORK1} w`), asst([use('u', 'todo_write', { todos: [] })]), toolRes('u', 'ok')]))
t('25 todo fixture case1 unchanged (still todo_write LIST2)', tCase?.name === 'todo_write' && JSON.stringify(tCase.arguments.todos) === JSON.stringify(['L2']), JSON.stringify(tCase).slice(0, 120))
m.setFixture('image')

console.log(bad === 0 ? `SCHEDULE-REPLAY-OK assertions=25 bad=0 (oracle region sliced verbatim, ${region.length} bytes; 5 static source assertions)` : `SCHEDULE-REPLAY-BAD bad=${bad}`)
process.exit(bad === 0 ? 0 : 1)
