// G8-R3 reviewer-3 e2e — raw node:http helpers + the RealHttpTransport
// bound to the p8t4 test client's RemotePushTransport interface.
//
// Wire (B2-verified shape):
//   GET  /?token=<launchToken>
//     -> 302/303 + Set-Cookie: dsh-auth-<b64url(sha256)>=v1.<sig>.<hmac>
//        (HttpOnly, SameSite=Strict)
//   POST /team-remote/<endpoint>  body {"type":"client-request",
//        "rpcId","method","payload"}   (rpcId is a STRING on the wire —
//        the seam zod schema rejects numbers: run-3 finding)
//     -> {"type":"server-response","rpcId","result":
//        {ok:true,value}|{ok:false,error:{code,message,details}}}
//
// The transport's scripted hooks emulate transport-level events:
//   {type:'loss'}        -> reject with PushTransportLossError (the ONLY
//                           rejection kind the engine special-cases)
//   {type:'replay',...}  -> return a cached SeamServerResponse (with the
//                           current request's rpcId) without touching the
//                           wire — the G8 stale-verdict scenario.
import http from 'node:http'

// ---------------------------------------------------------------------------
// Low-level HTTP
// ---------------------------------------------------------------------------

export function httpRequest({ host, port, method, pathAndQuery, headers, body }) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host,
        port,
        method,
        path: pathAndQuery,
        headers: {
          'content-type': 'application/json',
          ...(headers === undefined ? {} : headers),
        },
      },
      (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8')
          let json = null
          try {
            json = JSON.parse(raw)
          } catch {
            json = null
          }
          resolve({ status: res.statusCode, headers: res.headers, raw, json })
        })
      },
    )
    req.on('error', (err) => reject(err))
    if (body !== undefined) req.write(body)
    req.end()
  })
}

// ---------------------------------------------------------------------------
// Cookie minting from the launch URL
// ---------------------------------------------------------------------------

const COOKIE_NAME_RE = /^dsh-auth-[A-Za-z0-9_-]+$/
const COOKIE_VALUE_RE = /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/

export async function mintCookie({ host, port, launchUrl }) {
  const u = new URL(launchUrl)
  const res = await httpRequest({
    host,
    port,
    method: 'GET',
    pathAndQuery: u.pathname + u.search,
  })
  if (res.status !== 302 && res.status !== 303) {
    throw new Error('mintCookie: expected 302/303 from launch URL, got ' + res.status)
  }
  const setCookies = res.headers['set-cookie']
  if (!Array.isArray(setCookies) || setCookies.length === 0) {
    throw new Error('mintCookie: no Set-Cookie header on launch redirect')
  }
  const authCookie = setCookies.find((c) => c.split(';', 1)[0].startsWith('dsh-auth-'))
  if (!authCookie) {
    throw new Error('mintCookie: no dsh-auth-* cookie in ' + JSON.stringify(setCookies))
  }
  const [pair, ...attrs] = authCookie.split(';').map((s) => s.trim())
  const eq = pair.indexOf('=')
  const name = pair.slice(0, eq)
  const value = pair.slice(eq + 1)
  if (!COOKIE_NAME_RE.test(name)) throw new Error('mintCookie: bad cookie name ' + name)
  if (!COOKIE_VALUE_RE.test(value)) throw new Error('mintCookie: bad cookie value shape')
  const flags = attrs.join(';')
  return {
    name,
    value,
    cookie: pair,
    httpOnly: /httponly/i.test(flags),
    sameSiteStrict: /samesite=strict/i.test(flags),
    raw: authCookie,
  }
}

// ---------------------------------------------------------------------------
// Raw RPC (used by the E5/E6 negatives and the E1 raw cross-check)
// ---------------------------------------------------------------------------

export async function rawRpc({ host, port, cookie, endpoint, payload, rpcId, headers, body }) {
  const wireBody =
    body !== undefined
      ? body
      : JSON.stringify({ type: 'client-request', rpcId: String(rpcId), method: endpoint, payload })
  const res = await httpRequest({
    host,
    port,
    method: 'POST',
    pathAndQuery: '/team-remote/' + endpoint,
    headers: {
      ...(cookie === undefined ? {} : { cookie }),
      ...(headers === undefined ? {} : headers),
    },
    body: wireBody,
  })
  return res
}

// ---------------------------------------------------------------------------
// The transport the p8t4 test client binds to
// ---------------------------------------------------------------------------

export class RealHttpTransport {
  constructor({ host, port, cookie, lossErrorFactory, log }) {
    this.host = host
    this.port = port
    this.cookie = cookie
    this.lossErrorFactory = lossErrorFactory
    this.log = log || (() => {})
    this.scripted = null
    this.sends = 0
    this.scriptedFired = 0
  }

  /** Schedule one scripted behavior, consumed by the next send(). */
  script(fn) {
    this.scripted = fn
  }

  async send(request) {
    if (this.scripted !== null) {
      const scripted = this.scripted
      this.scripted = null
      this.scriptedFired += 1
      const behavior = typeof scripted === 'function' ? scripted(request) : scripted
      if (behavior && behavior.type === 'loss') {
        this.log('transport scripted: loss on rpcId ' + request.rpcId)
        throw this.lossErrorFactory()
      }
      if (behavior && behavior.type === 'replay') {
        this.log('transport scripted: replay of cached gen ' + (behavior.response && behavior.response.result && behavior.response.result.value ? (behavior.response.result.value.provenance || {}).projectionGeneration : '?') + ' on rpcId ' + request.rpcId)
        return { rpcId: request.rpcId, result: behavior.response.result }
      }
      throw new Error('RealHttpTransport: unknown scripted behavior ' + JSON.stringify(behavior))
    }
    this.sends += 1
    const res = await rawRpc({
      host: this.host,
      port: this.port,
      cookie: this.cookie,
      endpoint: request.method,
      payload: request.payload,
      rpcId: request.rpcId,
    })
    if (res.status !== 200) {
      throw new Error('RealHttpTransport: HTTP ' + res.status + ' for ' + request.method + ' :: ' + res.raw.slice(0, 200))
    }
    if (res.json === null || res.json.type !== 'server-response') {
      throw new Error('RealHttpTransport: bad wire response for ' + request.method + ' :: ' + res.raw.slice(0, 200))
    }
    // The wire carries rpcId as a string (seam zod); the client interface
    // uses numbers — correlate and convert at this boundary.
    if (res.json.rpcId !== String(request.rpcId)) {
      throw new Error('RealHttpTransport: rpcId mismatch for ' + request.method + ' (sent ' + String(request.rpcId) + ', wire ' + JSON.stringify(res.json.rpcId) + ')')
    }
    return { rpcId: Number(res.json.rpcId), result: res.json.result }
  }
}
