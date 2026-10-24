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
  return { harvest, decide, callResults, steps, toolsAfterMarker, toolMsgsAfter, lastUserText, createGate, readOkWitness, explicitRefusalWitness, permissionMutatedWitness, memberToolsSeen, member2ToolsSeen, leaderToolsSeen, NONCE }
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

// (5) ERROR branch: a TRUE isError create return must ABORT before any bind
// wait (gate verdict offline-decidable); non-null is arrival-only, never a
// business-success PASS; timeout fails honestly.
A('gate: is_error=true -> abort-refusal (binding wait NEVER entered)', boot.createGate({ isError: true, text: 'x' }).action === 'abort-refusal')
A('gate: arrival WITHOUT isError -> proceed-bind only (NO business-success claim)', boot.createGate({ isError: false, text: '{}' }).action === 'proceed-bind')
A('gate: null -> fail-timeout (honest, never fake)', boot.createGate(null).action === 'fail-timeout')
A('gate: isError=false BUT status:rejected -> abort-refusal (never success, no 120s)', boot.createGate({ isError: false, text: '{"status":"rejected","code":"X","message":"m"}' }).action === 'abort-refusal')

// (6) 87/88 witnesses (root final card): success needs SAME-call structured
// success AND the window-unique probe; refusal needs typed code/status —
// an arbitrary 'permission' string NEVER passes, any probe leak NEVER passes.
const P = `A5M2-CTLHW-PROBE-${N}`
A('readOk: structured success + probe content passes; name-only does NOT', boot.readOkWitness({ isError: false, text: `1\t{ "probe": "${P}" }` }, N) === true && boot.readOkWitness({ isError: false, text: '{"name":"a5m2-ctlhw-fixture"}' }, N) === false)
A('readOk: isError success-text does NOT count as consumption', boot.readOkWitness({ isError: true, text: P }, N) === false)
A('refusal: typed status:denied passes', boot.explicitRefusalWitness({ isError: false, text: '{"status":"denied","code":"PERMISSION_DENIED"}' }, N) === true)
A('refusal: typed code:rejected passes', boot.explicitRefusalWitness({ isError: false, text: '{"code":"TOOL_DENY_NOT_AUTHORIZED"}' }, N) === true)
A('refusal: BARE "permission" wording (no code/status, no error) FAILS — arbitrary strings never accepted', boot.explicitRefusalWitness({ isError: false, text: 'you need permission for that' }, N) === false)
A('refusal: ANY probe leak in the text fails, even with a denied code', boot.explicitRefusalWitness({ isError: true, text: `denied ${P}` }, N) === false)
A('refusal: explicit harness error + refusal wording passes', boot.explicitRefusalWitness({ isError: true, text: 'Error: the operation was denied by the permission lane' }, N) === true)

// (7) GRANT87 marker emits team_grant_permission over the Messages protocol
// with the closed required set + WIRE matcher {kind,value} (one-shot fixture pin)
const reqG = { body: { messages: [
  { role: 'user', content: [{ type: 'text', text: `A5M2-CTLHW-GRANT87 ${N} tinst=inst-offline-1` }] },
] } }
const outG = boot.decide({ req: reqG })
const tG = outG?.toolCalls?.[0]
A('GRANT87 marker emits team_grant_permission with required closed set + WIRE {kind,value}', tG?.name === 'team_grant_permission'
  && typeof tG?.arguments?.rootSessionId === 'string' && typeof tG?.arguments?.requestToken === 'string'
  && tG?.arguments?.targetInstanceId === 'inst-offline-1' && Array.isArray(tG?.arguments?.rules)
  && tG?.arguments?.rules?.[0]?.matcher?.kind === 'exact' && typeof tG?.arguments?.rules?.[0]?.matcher?.value === 'string'
  && tG?.arguments?.rules?.[0]?.matcher?.value.endsWith('/read-fixture/package.json'), `emitted=${tG?.name ?? 'none'} value=${String(tG?.arguments?.rules?.[0]?.matcher?.value ?? '')}`)

// (8) the THREE marker families through the REAL decide(): prefix shadowing
// regression (window 20261024T14-34-03Z raw proved TOOLS-CHECK2 swallowed by
// the generic TOOLS-CHECK branch). Each marker must ACK on ITS OWN branch and
// fill ITS OWN capture — verified on the real function, no stand-ins.
const mkReq = (text, tools) => ({ body: { messages: [{ role: 'user', content: [{ type: 'text', text }] }], tools } })
const t2 = boot.decide({ req: mkReq(`TOOLS-CHECK2 ${N}`, [{ name: 'team_resolve_control' }, { name: 'read' }]) })
A('TOOLS-CHECK2 reaches its OWN branch (ACK-C0B, not the generic ACK-C0) and fills member2ToolsSeen',
  String(t2?.content) === `ACK-C0B ${N}` && boot.member2ToolsSeen.includes('team_resolve_control'), `ack=${String(t2?.content)} seen2=${boot.member2ToolsSeen.join(', ')}`)
const tL = boot.decide({ req: mkReq(`TOOLS-CHECK-L ${N}`, [{ name: 'team_grant_permission' }, { name: 'team_revoke_permission' }]) })
A('TOOLS-CHECK-L reaches its OWN branch (ACK-C0L) and fills leaderToolsSeen',
  String(tL?.content) === `ACK-C0L ${N}` && boot.leaderToolsSeen.includes('team_grant_permission'), `ack=${String(tL?.content)} seenL=${boot.leaderToolsSeen.join(', ')}`)
const t0 = boot.decide({ req: mkReq(`TOOLS-CHECK ${N}`, [{ name: 'team_request_control' }]) })
A('generic TOOLS-CHECK still ACKs on its own branch and fills memberToolsSeen ONLY',
  String(t0?.content) === `ACK-C0 ${N}` && boot.memberToolsSeen.includes('team_request_control'), `ack=${String(t0?.content)}`)

// (9) permissionMutatedWitness on the REAL 2fb result family (root shape card)
const expG = { rootSessionId: 'r', targetInstanceId: 'i', verb: 'grant' }
A('witness: exact expected triple grant passes', boot.permissionMutatedWitness({ isError: false, text: JSON.stringify({ status: 'permission-mutated', rootSessionId: 'r', targetInstanceId: 'i', verb: 'grant', changed: true }) }, expG) === true)
A('witness: exact expected triple revoke passes (changed=false no-op still REAL)', boot.permissionMutatedWitness({ isError: false, text: JSON.stringify({ status: 'permission-mutated', rootSessionId: 'r', targetInstanceId: 'i', verb: 'revoke', changed: false }) }, { rootSessionId: 'r', targetInstanceId: 'i', verb: 'revoke' }) === true)
A('witness: FOREIGN rootSessionId fails (root 76eba review)', boot.permissionMutatedWitness({ isError: false, text: JSON.stringify({ status: 'permission-mutated', rootSessionId: 'other-root', targetInstanceId: 'i', verb: 'grant', changed: true }) }, expG) === false)
A('witness: foreign targetInstanceId fails', boot.permissionMutatedWitness({ isError: false, text: JSON.stringify({ status: 'permission-mutated', rootSessionId: 'r', targetInstanceId: 'other-inst', verb: 'grant', changed: true }) }, expG) === false)
A('witness: verb swap fails (grant leg shown a revoke row and vice versa)', boot.permissionMutatedWitness({ isError: false, text: JSON.stringify({ status: 'permission-mutated', rootSessionId: 'r', targetInstanceId: 'i', verb: 'revoke', changed: true }) }, expG) === false)
A('witness: status:rejected never passes', boot.permissionMutatedWitness({ isError: false, text: JSON.stringify({ status: 'rejected', code: 'X', message: 'm' }) }) === false)
A('witness: isError=true never passes; unstructured never passes', boot.permissionMutatedWitness({ isError: true, text: '{"status":"permission-mutated","verb":"grant","changed":true}' }) === false && boot.permissionMutatedWitness({ isError: false, text: 'mutated ok' }) === false)

const failed = results.filter((r) => !r.ok).length
console.log(JSON.stringify({ verdict: failed === 0 ? 'OFFLINE-DECODER-OK' : 'OFFLINE-DECODER-FAIL', checks: results.length, failed }))
process.exit(failed === 0 ? 0 : 1)
