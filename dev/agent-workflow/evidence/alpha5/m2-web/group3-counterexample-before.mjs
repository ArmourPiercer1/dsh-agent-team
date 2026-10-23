import { createWebGateway } from '../../../../../packages/runtime/dist/packages/runtime/web-gateway/src/index.js'
const REALM = 'realm-g'
const grant = (over = {}) => ({ grantId: 'grant-1', realmId: REALM, bindingId: 'b-1', callId: 'c-1', parametersFingerprint: 'sha256:GRANT-MATERIAL-fixed', singleUse: true, issuedAt: 0, expiresAt: Date.now() - 60_000, effects: { effects: [{ kind: 'tool-invoke', toolName: 'web_fetch', resource: null }, { kind: 'connect', resource: { realmId: REALM, kind: 'network-destination', canonicalLocator: 'https://target.test', rights: ['connect'] } }] }, ...over })
const binding = { bindingId: 'b-1', toolName: 'web_fetch' }
let seamCalls = 0
const gw = createWebGateway({ ports: { fetch: async () => { seamCalls += 1; return { url: 'https://target.test/page', statusCode: 200, truncated: false } }, search: async () => ({ sources: [], truncated: false }) }, searchOrigin: () => 'https://api.deepseek.com' })
const req = (g, pfp, url) => ({ grant: g, binding, target: { webOperation: { kind: 'web.fetch', url } }, payloadFingerprint: pfp })
// C1 过期 grant（expiresAt 已过期 60s）
const r1 = await gw.callWeb(req(grant(), 'sha256:m1', 'https://target.test/page'))
// C2 同一 singleUse grant 复用第二次（C1 已消费）
const r2 = await gw.callWeb(req(grant(), 'sha256:m2', 'https://target.test/page'))
// C3 换 payload：payloadFingerprint ≠ grant.parametersFingerprint，且 url 换到另一目的地但复用同一 grant（该 grant 只批了 target.test？不——换 url 会被 N 臂拒；这里演示 fingerprint 脱钩：payloadFingerprint 与 payload 内容无任何绑定校验）
const r3 = await gw.callWeb(req(grant(), 'sha256:ANYTHING-ELSE-totally-different', 'https://target.test/page'))
// C4 伪 binding：grant.bindingId 改配另一个 bindingId 一致对（gateway 只查两字符串相等，binding 本身无定义注册面背书）
const g4 = grant({ bindingId: 'FORGED-ANY' }); const b4 = { bindingId: 'FORGED-ANY', toolName: 'web_fetch' }
const r4 = await gw.callWeb({ grant: g4, binding: b4, target: { webOperation: { kind: 'web.fetch', url: 'https://target.test/page' } }, payloadFingerprint: 'sha256:m4' })
console.log(JSON.stringify({
  C1_expired_grant: { ok: r1.ok, seamCallsAfter: seamCalls },
  C2_single_use_REUSED: { ok: r2.ok, seamCallsAfter: seamCalls },
  C3_fingerprint_decoupled: { ok: r3.ok, seamCallsAfter: seamCalls },
  C4_forged_binding_pair: { ok: r4.ok, seamCallsAfter: seamCalls },
}, null, 1))
