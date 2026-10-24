// ROOT bf6a39be 两条腿的 dist 编译物断言原文：
// (1) consume 边在判定时刻对 LIVE 取消源真读到 true（常量 false 过不了）；
// (2) 正常完成后 caller/row 上的合并监听归零（泄漏修复），取消路径仍真 abort。
import { createWebGateway } from '../../../../../packages/runtime/dist/packages/runtime/web-gateway/src/index.js'
import { canonicalJsonFingerprint } from '../../../../../packages/runtime/dist/packages/domain/tool-governance/src/index.js'
const REALM = 'realm-bf'
const effects = (locator, tool) => ({ effects: [
  { kind: 'tool-invoke', toolName: tool, resource: null },
  { kind: 'connect', resource: { realmId: REALM, kind: 'network-destination', canonicalLocator: locator, rights: ['connect'] } },
] })
const factsStub = { capture: async () => ({ ok: true, value: { member: { teamSessionId: 'ts', instanceId: 'in' }, callId: 'c', bindingRevision: 1, authorityGeneration: 1, policyGeneration: 1, effects: effects('https://ok.test', 'web_fetch') } }) }
const out = {}
{ // (1) mid-consume cancellation: decision-time read must be TRUE
  const ac = new AbortController()
  let readAtDecision
  const gw = createWebGateway({
    ports: { fetch: async (r) => { out.seamHit = true; return { url: r.url, statusCode: 200, truncated: false } }, search: async () => ({ sources: [], truncated: false }) },
    searchOrigin: () => 'https://api.deepseek.com', factsSource: factsStub, lifecycle: { isClosed: () => false, signal: undefined },
    authority: { consume: async (i) => { ac.abort(); readAtDecision = i.isCancelled(); return { ok: true, value: { grantId: i.correlation.grantId, effects: i.facts.effects } } } },
  })
  const op = { kind: 'web.fetch', url: 'https://ok.test/p' }
  const res = await gw.callWeb({ grant: { grantId: 'g', realmId: REALM, bindingId: 'b', effects: effects('https://ok.test', 'web_fetch') }, binding: { bindingId: 'b', toolName: 'web_fetch' }, target: { webOperation: op }, payloadFingerprint: canonicalJsonFingerprint(op) }, { signal: ac.signal })
  out.mid_consume_cancel = { readAtDecision, refusalMessage: String(res.error?.message).slice(0, 130), seamHit: out.seamHit === true }
}
{ // never-cancelled ⇒ false（对照半）
  let readAtDecision
  const gw = createWebGateway({
    ports: { fetch: async (r) => ({ url: r.url, statusCode: 200, truncated: false }), search: async () => ({ sources: [], truncated: false }) },
    searchOrigin: () => 'https://api.deepseek.com', factsSource: factsStub, lifecycle: { isClosed: () => false, signal: undefined },
    authority: { consume: async (i) => { readAtDecision = i.isCancelled(); return { ok: true, value: { grantId: i.correlation.grantId, effects: i.facts.effects } } } },
  })
  const op = { kind: 'web.fetch', url: 'https://ok.test/p' }
  const res = await gw.callWeb({ grant: { grantId: 'g', realmId: REALM, bindingId: 'b', effects: effects('https://ok.test', 'web_fetch') }, binding: { bindingId: 'b', toolName: 'web_fetch' }, target: { webOperation: op }, payloadFingerprint: canonicalJsonFingerprint(op) })
  out.never_cancelled = { readAtDecision, ok: res.ok }
}
{ // (2) listener hygiene: counting signals; clean completion ⇒ adds===removes on BOTH
  class CountingSignal {
    constructor() { this.aborted = false; this.reason = undefined; this.adds = 0; this.removes = 0; this.listeners = [] }
    addEventListener(_t, l) { this.adds += 1; this.listeners.push(l) }
    removeEventListener(_t, l) { this.removes += 1; const i = this.listeners.indexOf(l); if (i >= 0) this.listeners.splice(i, 1) }
    fireAbort() { if (this.aborted) return; this.aborted = true; for (const l of this.listeners.splice(0)) l() }
  }
  const callerSig = new CountingSignal(); const rowSig = new CountingSignal()
  let hangNext = false
  const gw = createWebGateway({
    ports: {
      fetch: async (r, signal) => {
        if (!hangNext) return { url: r.url, statusCode: 200, truncated: false }
        return await new Promise((_resolve, reject) => { signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted mid-transport'), { code: 'ABORT_ERR' })), { once: true }) })
      },
      search: async () => ({ sources: [], truncated: false }),
    },
    searchOrigin: () => 'https://api.deepseek.com', factsSource: factsStub,
    lifecycle: { isClosed: () => false, signal: rowSig },
    authority: { consume: async (i) => ({ ok: true, value: { grantId: i.correlation.grantId, effects: i.facts.effects } }) },
  })
  const req = (op) => ({ grant: { grantId: 'g', realmId: REALM, bindingId: 'b', effects: effects('https://ok.test', 'web_fetch') }, binding: { bindingId: 'b', toolName: 'web_fetch' }, target: { webOperation: op }, payloadFingerprint: canonicalJsonFingerprint(op) })
  const one = await gw.callWeb(req({ kind: 'web.fetch', url: 'https://ok.test/p' }), { signal: callerSig })
  out.clean_completion = { ok: one.ok, callerAdds: callerSig.adds, callerRemoves: callerSig.removes, rowAdds: rowSig.adds, rowRemoves: rowSig.removes }
  hangNext = true
  const second = gw.callWeb(req({ kind: 'web.fetch', url: 'https://ok.test/p' }), { signal: callerSig })
  await new Promise((resolve) => { setTimeout(resolve, 0) })
  callerSig.fireAbort()
  const two = await second
  out.abort_path = { seamCode: two.error?.details?.seamCode, sideEffectUnknown: two.error?.sideEffectUnknown, callerRemoves: callerSig.removes, rowRemoves: rowSig.removes, fullyDetached: callerSig.removes === callerSig.adds && rowSig.removes === rowSig.adds }
}
console.log(JSON.stringify(out, null, 1))
