// OVERLAY-20 minimal replay (root 22:05 + 307c's confirmed raw of run-2026-10-23T21-53-39).
// Runs the KIT'S OWN oracle text — sliced verbatim from tests/kits/a5m2-todo-c2/a5m2-todo-c2.mjs, not a
// paraphrase — against phased model-visible wires. It confirms exactly what root pinned, nothing else:
//   (1) the SECOND read_image is emitted only when imageVisiblePair confirms THIS call's success
//       (same tool_use_id, same IMG_REL, is_error not true, native image envelope with the ORIGINAL
//       frame clause) AND exactly one read_image(IMG_REL) tool_use exists on the wire;
//   (2) first result is_error, or a paired result that is not the image envelope, or a wire that already
//       carries two calls => DONE_WORK1: no second/third call, and C3's first-failure stop keeps control;
//   (3) case 2 still DONE_WORK1, so case 1 and case 2 can never both issue and no third call exists;
//   (4) the write and todo fixtures behave exactly as before at case 1.
// Raw fidelity (307c, read-only): request #11 carried call-a5c2-1i8huzff with is_error=false, path
// …21-53-39.png, 512x384 with original 1024x768 stated twice, image/jpeg base64 of 16264 chars decoding
// to 12197 B; #11's reply was A5M2C2_W1_DONE and the LAST reply #12 was A5M2C2_NOTIF_REMOTE_DRIVEN (a
// notification-driven branch, NOT a DONE); the child session shows that one image call id x7 and the
// ledger only the first requestId. No Host, no world, no network, nothing written.
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

// Locate the kit from the worktree root so this replays identically from either of its homes
// (dev/agent-workflow/evidence/a5m2-img-r18/pin-audit/ or .pinbuild-verify/).
const rel = 'tests/kits/a5m2-todo-c2/a5m2-todo-c2.mjs'
let dir = dirname(new URL(import.meta.url).pathname)
for (;;) { if (existsSync(join(dir, rel))) break; const up = dirname(dir); if (up === dir) throw new Error(`cannot find ${rel} above ${dir}`); dir = up }
const KIT = join(dir, rel)
const kit = readFileSync(KIT, 'utf8')

// RETIRED BY OVERLAY-21 (root 22:21), RETAINED AS THE RECORD — not deleted, not rewritten. This harness
// proved OVERLAY-20 (image case 1 issuing the second read_image inside the SAME turn, guarded by
// imageVisiblePair + readImageUses). That approach was replaced by the deterministic second delegation
// (MK_W2L after C3 passes), so the code it slices no longer exists. It retires with exit 0 — a retirement,
// not a failure. Current harness: replay21-w2-schedule.mjs.
if (!kit.includes('function readImageUses')) {
  console.log('SUPERSEDED — OVERLAY-20 in-turn continuation was reverted at root 22:21; replay21-w2-schedule.mjs is the current harness. Retained, not deleted; retiring with exit 0 (not a failure).')
  process.exit(0)
}
const upto = (needle, from = 0) => { const i = kit.indexOf(needle, from); if (i === -1) throw new Error(`slice anchor missing: ${needle}`); return i }
const fnFrom = (name) => { const s = upto(`function ${name}(`); return kit.slice(s, kit.indexOf('\n}\n', s) + 3) }
const work1Branch = kit.slice(upto('    if (lastUser.includes(MK_WORK1)) {'), upto('    if (lastUser.includes(MK_WORK3))'))

const srcFor = (fixture) => [
  `const FIXTURE = ${JSON.stringify(fixture)}`,
  `const IMG_REL = 'examples/minimal/.sessions/a5m2c2-im-replay.png'`,
  `const IMG_W = 1024, IMG_H = 768`,
  `const MK_WORK1 = 'A5M2C2_WORK1'`,
  `const DONE_WORK1 = 'A5M2C2_W1_DONE'`,
  `const WF_REL = 'wf-target.txt', WF_TGT = 'TGT', WF_DENY = 'DENY'`,
  `const LIST1 = [{ id: '1', content: 'one', status: 'pending' }], LIST2 = [{ id: '1', content: 'one', status: 'completed' }]`,
  `const NOTIF_PREFIX = '[notification]'`,
  `const ALL_MARKERS = [MK_WORK1]`,
  fnFrom('toolCall'), fnFrom('userTextOf'), fnFrom('lastTriggerIndex'), fnFrom('lastUserTextOf'),
  fnFrom('readImageUses'), fnFrom('imageVisiblePair'), fnFrom('toolResultText'), fnFrom('allToolResults'),
  'function toolMsgsOf(msgs) { const i = lastTriggerIndex(msgs); return allToolResults(msgs.slice(i + 1)) }',
  'function decideWork1(msgs) {',
  '  const lastUser = lastUserTextOf(msgs)',
  '  const tools = toolMsgsOf(msgs).length',
  work1Branch,
  "  return { kind: 'no-match', content: 'NO_MATCH' }",
  '}',
  'export { decideWork1, readImageUses, IMG_REL }',
].join('\n')
const load = async (fixture) => import(`data:text/javascript;base64,${Buffer.from(srcFor(fixture)).toString('base64')}`)

const mod = await load('image')
const { decideWork1, readImageUses, IMG_REL } = mod
const TRIGGER = { role: 'user', content: [{ type: 'text', text: 'A5M2C2_WORK1 delegate w1' }] }
const useImg = (id) => ({ role: 'assistant', content: [{ type: 'tool_use', id, name: 'read_image', input: { file_path: IMG_REL } }] })
const okImg = (id) => ({ role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: [{ type: 'text', text: `<path>${IMG_REL}</path>\n<type>image</type>\n<content>\nimage/jpeg image, 512x384 px, 12197 bytes (downscaled from 1024x768 px)</content>` }] }] })
const errImg = (id) => ({ role: 'user', content: [{ type: 'tool_result', tool_use_id: id, is_error: true, content: [{ type: 'text', text: 'Error: refused-image P_IMAGE_CONSUMPTION_BINDING_MISMATCH' }] }] })
const plainImg = (id) => ({ role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: [{ type: 'text', text: '{"status":"executed"}' }] }] })
const denyImg = (id) => ({ role: 'user', content: [{ type: 'tool_result', tool_use_id: id, is_error: true, content: [{ type: 'text', text: 'APPROVAL_DENIED durable Control request ctrl-row2 answered deny' }] }] })
const useWith = (id, name, input) => ({ role: 'assistant', content: [{ type: 'tool_use', id, name, input }] })
const resWith = (id) => ({ role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: [{ type: 'text', text: '{"status":"executed"}' }] }] })

const callsOf = (r) => (r.kind === 'tool-call' ? r.toolCalls : [])
const isDone = (r) => r.kind === 'text' && r.content === 'A5M2C2_W1_DONE'
let bad = 0
const t = (name, cond, detail) => { if (!cond) bad += 1; console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${detail ? ` :: ${detail}` : ''}`) }

const first = decideWork1([TRIGGER])
const firstCall = callsOf(first)[0] ?? null
t('1 case0 issues the first read_image (proven shape: name + IMG_REL only)', first.kind === 'tool-call' && firstCall?.name === 'read_image' && firstCall.arguments.file_path === IMG_REL && JSON.stringify(Object.keys(firstCall).sort()) === '["arguments","id","name"]', JSON.stringify(firstCall ?? first).slice(0, 110))

const second = decideWork1([TRIGGER, useImg(firstCall.id), okImg(firstCall.id)])
const secondCall = callsOf(second)[0] ?? null
t('2 case1 issues the SECOND read_image after the confirmed success envelope (same id/path, is_error not true)', second.kind === 'tool-call' && secondCall?.name === 'read_image' && secondCall.arguments.file_path === IMG_REL, JSON.stringify(secondCall ?? second).slice(0, 110))
t('3 the second call carries a FRESH callId (row2 / lane-2 needs a new exec token)', secondCall !== null && secondCall.id !== firstCall.id, `${firstCall.id} vs ${secondCall?.id}`)
t('4 the second call invents no new field (key set + arguments identical to the proven first call)', JSON.stringify(Object.keys(secondCall).sort()) === JSON.stringify(Object.keys(firstCall).sort()) && JSON.stringify(secondCall.arguments) === JSON.stringify(firstCall.arguments), JSON.stringify(secondCall).slice(0, 110))

t('5 first result is_error => DONE_WORK1, no second call (C3 first-failure stop keeps control)', isDone(decideWork1([TRIGGER, useImg(firstCall.id), errImg(firstCall.id)])))
t('6 paired result that is NOT the image envelope => DONE_WORK1 (never continues on a non-image success)', isDone(decideWork1([TRIGGER, useImg(firstCall.id), plainImg(firstCall.id)])))
t('7 post-deny wire (2 calls, 2 results) => case2 DONE_WORK1: no third call', isDone(decideWork1([TRIGGER, useImg(firstCall.id), okImg(firstCall.id), useImg(secondCall.id), denyImg(secondCall.id)])))
t('8 hypothetical pending-second-call wire (2 calls, 1 result) => DONE_WORK1, never a third (count guard)', isDone(decideWork1([TRIGGER, useImg(firstCall.id), okImg(firstCall.id), useImg(secondCall.id)])))
t('9 readImageUses counts only read_image(IMG_REL) uses (guard second half)',
  readImageUses([TRIGGER, useImg('a'), okImg('a'), useWith('b', 'write', { file_path: 'x' }), resWith('b')]) === 1
  && readImageUses([TRIGGER, useImg('a'), okImg('a'), useImg('b')]) === 2
  && readImageUses([TRIGGER, useWith('a', 'read_image', { file_path: 'other.png' }), resWith('a')]) === 0
  && readImageUses([TRIGGER]) === 0)
const modW = await load('write')
t('10 write fixture case1 unchanged (issues write WF_DENY, not the first-call WF_TGT payload)', (() => { const r = callsOf(modW.decideWork1([TRIGGER, useWith('u', 'write', { file_path: 'wf-target.txt', content: 'TGT' }), resWith('u')]))[0]; return r?.name === 'write' && r.arguments.content === 'DENY' && r.arguments.file_path === 'wf-target.txt' })())
const modT = await load('todo')
t('11 todo fixture case1 unchanged (issues todo_write LIST2, field-for-field)', (() => { const r = callsOf(modT.decideWork1([TRIGGER, useWith('u', 'todo_write', { todos: [] }), resWith('u')]))[0]; return r?.name === 'todo_write' && JSON.stringify(r.arguments.todos) === JSON.stringify([{ id: '1', content: 'one', status: 'completed' }]) })())

console.log(bad === 0 ? `ORACLE-REPLAY-OK assertions=11 bad=0 (kit WORK1 region sliced verbatim, ${work1Branch.length} bytes)` : `ORACLE-REPLAY-BAD bad=${bad}`)
process.exit(bad === 0 ? 0 : 1)
