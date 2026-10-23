import { createWebGateway } from '../../../../../packages/runtime/dist/packages/runtime/web-gateway/src/index.js'
import { canonicalJsonFingerprint } from '../../../../../packages/runtime/dist/packages/domain/tool-governance/src/index.js'
const REALM = 'realm-g'
const REGISTERED = new Map([['b-1:web_fetch', true]]) // trusted definition registry stand-in (center edge)
const grant = (over = {}) => ({ grantId: 'grant-1', realmId: REALM, bindingId: 'b-1', callId: 'c-1', parametersFingerprint: 'sha256:GRANT-MATERIAL-fixed', singleUse: true, issuedAt: 0, expiresAt: Date.now() - 60_000, effects: { effects: [{ kind: 'tool-invoke', toolName: 'web_fetch', resource: null }, { kind: 'connect', resource: { realmId: REALM, kind: 'network-destination', canonicalLocator: 'https://target.test', rights: ['connect'] } }] }, ...over })
const binding = { bindingId: 'b-1', toolName: 'web_fetch' }
let seamCalls = 0
// production-shaped recorder: ONE consume, expiry, definition registry, manifest binding — ALL at the center edge
const authority = (() => {
  const used = new Set()
  return { consumes: 0, async consume(i) {
    this.consumes += 1
    const g = i.grant
    if (g.expiresAt !== null && g.expiresAt < Date.now()) return { ok: false, error: { code: 'TOOL_BINDING_UNVERIFIED', message: 'grant-expired (recorder)', sideEffectUnknown: false } }
    if (!REGISTERED.has(`${g.bindingId}:${i.operationKind === 'web.fetch' ? 'web_fetch' : 'web_search'}`) || i.binding.bindingId !== g.bindingId) return { ok: false, error: { code: 'TOOL_BINDING_UNVERIFIED', message: 'definition-unknown-or-binding-mismatch (recorder)', sideEffectUnknown: false } }
    if (used.has(g.grantId)) return { ok: false, error: { code: 'TOOL_BINDING_UNVERIFIED', message: 'grant-already-consumed (recorder single-use)', sideEffectUnknown: false } }
    used.add(g.grantId)
    return { ok: true, value: { grantId: g.grantId, effects: g.effects } }
  } }
})()
const gw = createWebGateway({ ports: { fetch: async (r) => { seamCalls += 1; return { url: r.url, statusCode: 200, truncated: false } }, search: async () => ({ sources: [], truncated: false }) }, searchOrigin: () => 'https://api.deepseek.com', authority })
const req = (g, op, pfp = canonicalJsonFingerprint(op)) => ({ grant: g, binding, target: { webOperation: op }, payloadFingerprint: pfp })
const op = { kind: 'web.fetch', url: 'https://target.test/page' }
const r1 = await gw.callWeb(req(grant(), op))                       // C1 过期 grant
const r2 = await gw.callWeb(req(grant({ expiresAt: Date.now() + 60_000, grantId: 'grant-fresh' }), op)) // 基线正控（证明链路本身能通）
const r2b = await gw.callWeb(req(grant({ expiresAt: Date.now() + 60_000, grantId: 'grant-fresh' }), op)) // C2 同 grant 复用
const r3 = await gw.callWeb(req(grant({ expiresAt: Date.now() + 60_000 }), op, `sha256:${'e'.repeat(64)}`)) // C3 换 payload
const r4 = await gw.callWeb(req(grant({ expiresAt: Date.now() + 60_000, bindingId: 'FORGED' }), op))         // C4 伪 binding（配对未注册）
console.log(JSON.stringify({
  C1_expired_grant: { ok: r1.ok, msg: r1.error?.message, consumesAtCenter: authority.consumes, seamCalls },
  BASELINE_valid: { ok: r2.ok, seamCalls },
  C2_single_use_REUSED: { ok: r2b.ok, msg: r2b.error?.message, seamCalls },
  C3_payload_swap: { ok: r3.ok, msg: r3.error?.message, consumedBurned: authority.consumes, seamCalls },
  C4_forged_binding_pair: { ok: r4.ok, msg: r4.error?.message, seamCalls },
}, null, 1))
