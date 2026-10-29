/**
 * s1-h0-m1 / s1m1-session-client.mjs — the MINIMUM public-HTTP session legs.
 *
 * Provenance (byte-verbatim function bodies from the pinned team repo):
 *   4aaaa7b2af87f80a0fae62d9c8d9cf03d5a6fd84:tests/kits/a5-pr1-guard-dispatch/a5p1-kit.mjs
 *   (git blob 6815b41e330f2a4731f2a287f00f0e84ea802144,
 *    sha256 de581347c7bea9f6e596e6b57dddc18fed280889ec472af4e32fc7d61d249357)
 *     - fetchJson            : kit :257-261 (verbatim below)
 *     - authenticate         : kit :266-271 (verbatim below)
 *     - apiPrompt            : kit :279-291 (verbatim below; POST /api/session/prompt,
 *                              method 'session/prompt'; 200 = admitted)
 *   apiSessionCreate is the ONE derived function: same client-request envelope as
 *   kit apiPrompt, targeting the pinned host's @Remote('create')
 *   (639ed015 packages/api/session-controller/src/index.ts:272-274;
 *    SessionCreateRequest = { workspaceId?, cwd?, sessionId?, agentPreset? },
 *    packages/api/session-controller/src/types.ts:285). Its live wire shape is
 *    NOT_OBSERVED until the authorized run — recorded as such.
 *
 * Public surfaces only. No Team dist, no preset assembly, no rereg/order legs.
 * @module dev/agent-workflow/evidence/s1-h0-m1/s1m1-session-client
 */

export async function fetchJson(url, init, timeoutMs = 180_000, signal = undefined) {
  const local = AbortSignal.timeout(timeoutMs)
  const combined = signal === undefined ? local : AbortSignal.any([signal, local])
  const res = await fetch(url, { ...init, signal: combined }).catch((e) => ({ status: 0, error: e.message }))
  const body = res.status === 0 ? null : await res.json().catch(() => null)
  return { status: res.status, body }
}

export async function authenticate(origin, token, signal = undefined) {
  const local = AbortSignal.timeout(30_000)
  const combined = signal === undefined ? local : AbortSignal.any([signal, local])
  const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: combined })
  const setCookie = res.headers.get('set-cookie')
  if (res.status !== 303 || setCookie === null) throw new Error(`authentication returned ${String(res.status)} (expected 303 + set-cookie)`)
  return setCookie.split(';', 1)[0]
}

export async function apiPrompt(origin, cookie, sessionId, text, tag = 'a5p1', signal = undefined) {
  return fetchJson(`${origin}/api/session/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
      method: 'session/prompt',
      payload: { args: { request: { requestId: `${tag}-r-${Math.random().toString(36).slice(2, 10)}`, sessionId, mode: 'queue', content: [{ type: 'text', text }] } } },
    }),
  }, 180_000, signal)
}

/** Derived (see header): create/adopt one ordinary Session. */
export async function apiSessionCreate(origin, cookie, cwd, tag = 's1m1', signal = undefined) {
  return fetchJson(`${origin}/api/session/create`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
      method: 'session/create',
      payload: { args: { request: { cwd } } },
    }),
  }, 180_000, signal)
}

/** Kit :750 pattern: the token gate must answer 401 to an unauthenticated GET /. */
export async function probeNoToken(origin) {
  const res = await fetch(`${origin}/`, { signal: AbortSignal.timeout(10_000) }).catch(() => null)
  return res === null ? 'unreachable' : res.status
}
