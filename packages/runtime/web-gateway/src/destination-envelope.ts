/**
 * `runtime/web-gateway` destination envelope — M2 B-WEB lane.
 *
 * THE LAW SPLIT (contract §B-WEB + integration ruling 2026-10-23, verbatim
 * honored): the authoritative DNS/IP validation, EVERY-redirect-hop
 * revalidation and connection pinning belong to the production
 * `web-fetch-http` provider — host `packages/web/web-fetch-http/src/network.ts`
 * (`isPublicIpAddress` :54; "…resolves to a non-public IP address", code
 * `WEB_BLOCKED_URL` :101) and its policy (`policy.ts:31-36`) @ 639ed01539.
 * This module runs NO copy of those checks. What it does is the Team lane's
 * own belt BEFORE transport:
 *
 *  1. DESTINATION IDENTITY — derive the frozen network-destination locator
 *     `scheme://host[:port]` (law: `tool-governance/src/resource.ts:91-99`,
 *     no path) FROM THE REAL URL / REAL provider config. The endpoint PATH
 *     is transport detail and never enters the resource identity.
 *  2. SCHEME — the envelope exists only for `http`/`https`; other schemes are
 *     refused HERE (the provider policy enforces the same law independently —
 *     belt and authority, not a copy).
 *  3. LITERAL NON-PUBLIC ADDRESS VETO — the literal forms of the standard
 *     non-public classes (loopback, RFC1918, link-local, ULA, CGNAT,
 *     multicast/reserved, `localhost` hostnames). This is a STRICTER-OR-EQUAL
 *     literal pre-check: whatever it waves through is still fully validated
 *     post-DNS by the provider; whatever it vetoes never leaves the lane.
 *     Drift toward MORE lenience here could not weaken the provider — the
 *     provider re-checks every address of every hop regardless; that is why
 *     this belt is allowed to be dumb and offline.
 *
 * @module runtime/web-gateway/destination-envelope
 */
import type { WebAddressVeto, WebDestinationEnvelope } from './types.js'

/** Minimal STRUCTURAL face of the WHATWG URL the runtime actually provides.
 *  This compilation surface (@types/node's ambient URL) carries no members —
 *  the sibling-card lesson: at such a seam, cast ONCE to a structural face
 *  and stay typed everywhere else (no host type crosses this line). */
interface LooseHttpUrl {
  readonly protocol: string
  readonly origin: string
  readonly hostname: string
  readonly port: string
}

function parseHttpUrl(input: string): LooseHttpUrl {
  return new URL(input) as unknown as LooseHttpUrl
}

/** Parse failure reasons for one retrieval URL / config origin. */
export type EnvelopeFailure =
  | { readonly code: 'url-unparseable'; readonly detail: string }
  | { readonly code: 'url-scheme-unsupported'; readonly detail: string }

/**
 * Derive the destination envelope from an absolute retrieval URL (fetch arm)
 * or a config-resolved provider endpoint (search arm — the path is dropped:
 * `https://api.deepseek.com/anthropic/v1` ⇒ `https://api.deepseek.com`,
 * authority host `web-search-deepseek/src/provider.ts:34/:217`).
 */
export function deriveDestination(input: string): WebDestinationEnvelope | EnvelopeFailure {
  let parsed: LooseHttpUrl
  try {
    parsed = parseHttpUrl(input)
  } catch {
    return { code: 'url-unparseable', detail: `the destination is not an absolute URL: ${safePreview(input)}` }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { code: 'url-scheme-unsupported', detail: `only http(s) destinations exist for the web lane; received ${parsed.protocol}` }
  }
  // URL.origin: lowercased host, default ports elided, userinfo/path/query
  // absent by construction — exactly the frozen locator law.
  const locator = parsed.origin
  const host = parsed.hostname // bracketless for IPv6 literals
  const port = parsed.port === '' ? null : Number(parsed.port)
  return {
    canonicalLocator: locator,
    scheme: parsed.protocol === 'https:' ? 'https' : 'http',
    host,
    port,
    literalVeto: literalAddressVeto(host),
  }
}

/** Origin (`scheme://host[:port]`) of any absolute URL — receipt material.
 *  `null` on unparseable input (never throws at fingerprint time). */
export function originOf(absoluteUrl: string): string | null {
  try {
    return parseHttpUrl(absoluteUrl).origin
  } catch {
    return null
  }
}

/**
 * The literal-address belt. Recognizes ONLY literals (a hostname that happens
 * to resolve privately is the provider's catch, post-DNS — measured e.g. by
 * the p09 W9 leg: `WEB_BLOCKED_URL` at resolve time).
 */
export function literalAddressVeto(host: string): WebAddressVeto | null {
  const h = host.toLowerCase().replace(/^\[(.*)\]$/, '$1').replace(/%.*$/, '')
  if (h === 'localhost' || h === 'ip6-localhost' || h === 'ip6-loopback' || h.endsWith('.localhost')) {
    return { code: 'loopback-hostname', detail: `loopback hostname literal ${JSON.stringify(host)}` }
  }
  const v4 = parseIpv4(h)
  if (v4 !== null) {
    return ipv4Veto(h, v4)
  }
  const v6 = parseIpv6(h)
  if (v6 !== null) {
    return ipv6Veto(h, v6)
  }
  return null // not an address literal: no literal opinion, provider decides post-DNS
}

function ipv4Veto(host: string, o: readonly [number, number, number, number]): WebAddressVeto | null {
  const [a, b, c] = o
  const veto = (why: string): WebAddressVeto =>
    ({ code: 'literal-non-public-ipv4', detail: `IPv4 literal ${JSON.stringify(host)} is ${why}` })
  if (a === 0) return veto('unspecified/current-network (0.0.0.0/8)')
  if (a === 10) return veto('private (10.0.0.0/8)')
  if (a === 127) return veto('loopback (127.0.0.0/8)')
  if (a === 100 && b !== undefined && b >= 64 && b <= 127) return veto('CGNAT (100.64.0.0/10)')
  if (a === 169 && b === 254) return veto('link-local (169.254.0.0/16)')
  if (a === 172 && b !== undefined && b >= 16 && b <= 31) return veto('private (172.16.0.0/12)')
  if (a === 192 && b === 0 && c === 0) return veto('IETF protocol assignments (192.0.0.0/24)')
  if (a === 192 && b === 0 && c === 2) return veto('documentation (192.0.2.0/24)')
  if (a === 192 && b === 168) return veto('private (192.168.0.0/16)')
  if (a === 198 && (b === 18 || b === 19)) return veto('benchmarking (198.18.0.0/15)')
  if (a === 198 && b === 51 && c === 100) return veto('documentation (198.51.100.0/24)')
  if (a === 203 && b === 0 && c === 113) return veto('documentation (203.0.113.0/24)')
  if (a !== undefined && a >= 224) return veto('multicast/reserved (224.0.0.0/4 and above)')
  return null
}

function ipv6Veto(host: string, groups: readonly number[]): WebAddressVeto | null {
  const veto = (why: string): WebAddressVeto =>
    ({ code: 'literal-non-public-ipv6', detail: `IPv6 literal ${JSON.stringify(host)} is ${why}` })
  const head = groups[0] ?? 0
  if (groups.every((g) => g === 0)) return veto('unspecified (::)')
  if (groups.slice(0, 7).every((g) => g === 0) && groups[7] === 1) return veto('loopback (::1)')
  // IPv4-mapped ::ffff:a.b.c.d expands (via the `::` zero-fill) to five zero
  // groups + 0xffff at groups[5] + the embedded v4 in groups[6..7] — the head
  // group is NOT 0xffff (root 07:38 index fix; scope kept honest: this only
  // decides which belt table the LITERAL hits, no SSRF claim).
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
    const v4: [number, number, number, number] = [((groups[6] ?? 0) >> 8) & 0xff, (groups[6] ?? 0) & 0xff, ((groups[7] ?? 0) >> 8) & 0xff, (groups[7] ?? 0) & 0xff]
    return ipv4Veto(`::ffff:${v4.join('.')}`, v4)
  }
  if ((head & 0xffc0) === 0xfe80) return veto('link-local (fe80::/10)')
  if ((head & 0xfe00) === 0xfc00) return veto('unique-local (fc00::/7)')
  if ((head & 0xff00) === 0xff00) return veto('multicast (ff00::/8)')
  return null
}

function parseIpv4(h: string): readonly [number, number, number, number] | null {
  const parts = h.split('.')
  if (parts.length !== 4) return null
  const octets: number[] = []
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const n = Number(part)
    if (n > 255) return null
    octets.push(n)
  }
  return [octets[0] as number, octets[1] as number, octets[2] as number, octets[3] as number]
}

/** Minimal closed IPv6 literal parser (16-bit words; `::` expanded; optional
 *  zone id; optional trailing IPv4 dotted tail). */
function parseIpv6(h: string): readonly number[] | null {
  const s = h.split('%')[0] as string
  if (!s.includes(':')) return null
  const halves = s.split('::')
  if (halves.length > 2) return null
  const parseSide = (raw: string): number[] | null => {
    if (raw.length === 0) return []
    const segs = raw.split(':')
    const groups: number[] = []
    for (let i = 0; i < segs.length; i += 1) {
      const seg = segs[i] as string
      if (seg.includes('.')) {
        if (i !== segs.length - 1) return null // a dotted tail is only legal last
        const v4 = parseIpv4(seg)
        if (v4 === null) return null
        groups.push((v4[0] << 8) | v4[1], (v4[2] << 8) | v4[3])
      } else {
        const m = /^[0-9a-fA-F]{1,4}$/.exec(seg)
        if (m === null) return null
        groups.push(Number.parseInt(seg, 16))
      }
    }
    return groups
  }
  if (halves.length === 1) {
    const whole = parseSide(s)
    return whole !== null && whole.length === 8 ? whole : null
  }
  const front = parseSide(halves[0] as string)
  const rear = parseSide(halves[1] as string)
  if (front === null || rear === null) return null
  const missing = 8 - front.length - rear.length
  if (missing < 1) return null
  return [...front, ...Array.from({ length: missing }, () => 0), ...rear]
}

function safePreview(input: string): string {
  return JSON.stringify(input.length > 120 ? `${input.slice(0, 120)}…` : input)
}
