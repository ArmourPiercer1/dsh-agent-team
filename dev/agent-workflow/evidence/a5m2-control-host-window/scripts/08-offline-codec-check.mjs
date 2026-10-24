#!/usr/bin/env node
// OFFLINE micro decoder-control check (root 2026-10-24; NO Host, no net): loads
// the REAL 05-runner's top-level function region (slice before main()) and
// feeds it the EXISTING Anthropic /v1/messages tool_result shapes already seen
// in window raws. Proves: same-callId result IS harvested (is_error preserved)
// and a marker conversation with an unseen-by-old-code tool_result NO LONGER
// falls to TURN-DONE. Reuses the mock's own structures — no new framework.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const src = readFileSync(fileURLToPath(new URL('./05-control-window-runner.mjs', import.meta.url)), 'utf8')
const cut = src.indexOf('async function main')
if (cut < 0) { console.error('driver shape changed: main anchor missing'); process.exit(2) }
const body = src.slice(0, cut)
const importLines = [...body.matchAll(/^import[\s\S]*?from\s+'[^']+'$/gm)].map((m) => m[0])
const region = body.replace(/^import[\s\S]*?from\s+'[^']+'$/gm, '').replace(/^#!.*$/m, '').replaceAll('import.meta.url', '__SELF_URL__')
const mods = new Map()
for (const line of importLines) {
  const spec = /from\s+'([^']+)'/.exec(line)[1]
  const names = [...line.matchAll(/\{\s*([^}]+)\s*\}/g)].flatMap((m) => m[1].split(',').map((s) => s.trim()).filter(Boolean))
  const mod = await import(spec)
  for (const n of names) mods.set(n, mod[n])
}
// The top-level GO gate lives in the sliced region; the region NEVER calls
// main() (cut excludes it) — no spawn/boot code exists outside main, so this
// env pass-through is pure decode plumbing, not a window and not a GO.
process.env.A5M2_CONTROL_WINDOW = 'GRANTED'
const boot = new Function(...mods.keys(), '__SELF_URL__', `
  const window = { location: { origin: 'http://127.0.0.1:0' } };
  ${region}
  currentRoot = 'session-offline-root'
  return { harvest, decide, callResults, steps, toolsAfterMarker, toolMsgsAfter, lastUserText, NONCE }
`)(...mods.values(), new URL('./05-control-window-runner.mjs', import.meta.url).href)
const results = []
const A = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`) }
const N = boot.NONCE

// (1) same-call result harvest over the Messages shape, is_error preserved
const cid = `call-ctlhw-${N}-1`
boot.steps.set(cid, { step: 'leader:create', tool: 'team_create_member' })
const reqRes = { body: { messages: [
  { role: 'user', content: [{ type: 'text', text: `A5M2-CTLHW-LEADER-CREATE ${N}` }] },
  { role: 'assistant', content: [{ type: 'tool_use', id: cid, name: 'team_create_member', input: { rootSessionId: 'session-offline-root' } }] },
  { role: 'user', content: [{ type: 'tool_result', tool_use_id: cid, is_error: true, content: [{ type: 'text', text: 'PERMISSION_DENIED typed refusal' }] }] },
] } }
boot.harvest(reqRes)
const r1 = boot.callResults.find((x) => x.callId === cid)
A('messages tool_result harvested by SAME callId', r1?.step === 'leader:create' && r1.isError === true && r1.text.includes('PERMISSION_DENIED'), `step=${r1?.step} isError=${String(r1?.isError)} text=${r1?.text.slice(0, 40)}`)

// (2) marker conversation no longer mis-falls to TURN-DONE: with the list
// tool_result present, L3 must EXTRACT the requestId and emit team_resolve_control
boot.steps.set('cid-list', { step: 'leader:list85', tool: 'team_list_pending_control' })
const reqL3 = { body: { messages: [
  { role: 'user', content: [{ type: 'text', text: `A5M2-CTLHW-LEADER-RESOLVE ${N}` }] },
  { role: 'assistant', content: [{ type: 'tool_use', id: 'cid-list', name: 'team_list_pending_control', input: {} }] },
  { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'cid-list', content: [{ type: 'text', text: '{"requests":[{"requestId":"r-83-offline"}]}' }] }] },
] } }
A('toolsAfterMarker counts tool_result blocks', boot.toolsAfterMarker(reqL3.body.messages, `A5M2-CTLHW-LEADER-RESOLVE ${N}`) === 1)
const out3 = boot.decide({ req: reqL3 })
const t3 = out3?.toolCalls?.[0]
A('L3 emits team_resolve_control (NOT TURN-DONE) with the listed requestId', t3?.name === 'team_resolve_control' && String(t3?.arguments?.requestId) === 'r-83-offline', `emitted=${t3?.name ?? out3?.content ?? 'none'} rid=${String(t3?.arguments?.requestId ?? '')}`)

// (3) unique-callId law holds across both protocols (no mixing)
boot.harvest(reqRes)
A('re-harvest does NOT duplicate the same callId', boot.callResults.filter((x) => x.callId === cid).length === 1)

const failed = results.filter((r) => !r.ok).length
console.log(JSON.stringify({ verdict: failed === 0 ? 'OFFLINE-DECODER-OK' : 'OFFLINE-DECODER-FAIL', checks: results.length, failed }))
process.exit(failed === 0 ? 0 : 1)
