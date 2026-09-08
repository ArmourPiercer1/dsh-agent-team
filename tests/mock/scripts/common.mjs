// common.mjs — shared helpers for tests/mock V2 suite scripts (plan §6).
// Read-only forensics + public-seam RPC (session/prompt, team-remote).
// No product-code imports; node builtins only.
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash, randomUUID } from 'node:crypto'
import net from 'node:net'
import { zstdDecompressSync } from 'node:zlib'

export const HERE = dirname(fileURLToPath(import.meta.url))
export const MOCK_ROOT = resolve(HERE, '..')
export const REPO_ROOT = resolve(HERE, '..', '..', '..')
export const DSH_HOME = process.env.MOCK_DSH_HOME
  ? resolve(process.env.MOCK_DSH_HOME)
  : join(MOCK_ROOT, '.dsh-home')
export const STATE_DIR = join(MOCK_ROOT, 'state')

// ── durable session log access (multi-frame zstd JSONL) ────────────────────

/** Decompress every zstd frame concatenated in one buffer (durable log layout). */
export function decompressAll(buf) {
  const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
  const starts = []
  let off = 0
  for (;;) {
    const i = buf.indexOf(MAGIC, off)
    if (i === -1) break
    starts.push(i)
    off = i + 4
  }
  const bounds = [...starts, buf.length]
  const parts = []
  let pendingFrames = null
  for (let k = 0; k < bounds.length - 1; k++) {
    const chunk = buf.subarray(bounds[k], bounds[k + 1])
    const cand = pendingFrames === null ? chunk : Buffer.concat([...pendingFrames, chunk])
    try { parts.push(zstdDecompressSync(cand)); pendingFrames = null } catch { pendingFrames = pendingFrames === null ? [chunk] : [...pendingFrames, chunk] }
  }
  if (pendingFrames !== null) {
    // Tolerate a half-written tail frame (host mid-flush while polling):
    // the incomplete data is the last appended frame — drop it and retry,
    // then drop the whole remainder if that still fails.
    const tryAll = Buffer.concat(pendingFrames)
    try { parts.push(zstdDecompressSync(tryAll)) } catch {
      if (pendingFrames.length > 1) {
        try { parts.push(zstdDecompressSync(Buffer.concat(pendingFrames.slice(0, -1)))) } catch { /* partial tail dropped */ }
      }
    }
  }
  return Buffer.concat(parts)
}

/**
 * Locate one session's durable log. Logs live under
 * <DSH_HOME>/sessions/<workspace-slug>/<sessionId>/session.jsonl.zstd —
 * the slug varies with the session workspace, so search every slug dir.
 */
export function sessionLogPath(sessionId, dshHome = DSH_HOME) {
  const base = join(dshHome, 'sessions')
  if (!existsSync(base)) return null
  for (const slug of readdirSync(base)) {
    const p = join(base, slug, sessionId, 'session.jsonl.zstd')
    if (existsSync(p)) return p
  }
  return null
}

/** Parse the durable log into rows: {seq, turn, step, type, raw}.
 *  Row shape: {type, seq, time, data:{turn, step, ...}} — turn/step live in data.
 *  Non-JSON rows are dropped. */
export function logRows(logPath) {
  const text = decompressAll(readFileSync(logPath)).toString('utf8')
  const rows = []
  for (const line of text.split('\n')) {
    if (!line) continue
    let o
    try { o = JSON.parse(line) } catch { continue }
    rows.push({
      seq: o.seq ?? null,
      turn: o.data?.turn ?? o.turn ?? null,
      step: o.data?.step ?? o.step ?? null,
      type: o.type ?? o.kind ?? null,
      raw: o,
    })
  }
  return rows
}

/** Highest turn number seen in turn/start or turn/end rows (0 if none). */
export function maxTurn(logPath) {
  let m = 0
  for (const r of logRows(logPath)) {
    if (typeof r.turn === 'number' && r.turn > m) m = r.turn
  }
  return m
}

/** Last model-request tools array in the log: {seq, count, names, team, mcp}. */
export function lastTools(logPath) {
  let last = null
  let lastSeq = -1
  for (const r of logRows(logPath)) {
    const arr = findTools(r.raw)
    if (arr && arr.length && (r.seq ?? -1) >= lastSeq) { last = arr; lastSeq = r.seq ?? -1 }
  }
  if (!last) return null
  const names = last.map((t) => (t && (t.function ? t.function.name : t.name)) ?? '?')
  return {
    seq: lastSeq,
    count: names.length,
    names,
    team: names.filter((n) => String(n).startsWith('team_')),
    mcp: names.filter((n) => String(n).startsWith('mcp__')),
  }
}
function findTools(node, depth = 0) {
  if (depth > 6 || node === null || typeof node !== 'object') return null
  if (Array.isArray(node.tools) && node.tools.length) return node.tools
  for (const v of Object.values(node)) {
    const r = findTools(v, depth + 1)
    if (r) return r
  }
  return null
}

// ── team_domain.json access (table rows are JSON strings) ──────────────────

export function loadDomain(dshHome = DSH_HOME) {
  const path = join(dshHome, 'storages', 'team_domain.json')
  if (!existsSync(path)) throw new Error(`team_domain.json not found at ${path}`)
  const dom = JSON.parse(readFileSync(path, 'utf8'))
  return {
    tables: dom.tables ?? {},
    row(table, key) {
      const raw = this.tables[table]?.[key]
      if (raw === undefined) return undefined
      return typeof raw === 'string' ? JSON.parse(raw) : raw
    },
    rows(table) {
      const t = this.tables[table] ?? {}
      return Object.entries(t).map(([key, v]) => [key, typeof v === 'string' ? JSON.parse(v) : v])
    },
  }
}

/** {label, templateId, childSessionId, lifecycle, instanceId} per member instance of one root. */
export function teamMembers(domain, rootSessionId) {
  const out = []
  for (const [id, v] of domain.rows('member_instances')) {
    if (v.rootSessionId !== rootSessionId || v.instanceId === 'inst-leader') continue
    out.push({
      instanceId: v.instanceId,
      label: v.label ?? null,
      templateId: v.templateId ?? null,
      childSessionId: v.childSessionId ?? null,
      lifecycle: v.lifecycle ?? null,
    })
  }
  return out.sort((a, b) => String(a.label).localeCompare(String(b.label)))
}

/** Ledger facts for one root: [{sequence, factType, operationId, createdAt, payload}] sorted by sequence. */
export function ledgerFactsForRoot(domain, rootSessionId) {
  const out = []
  for (const [, v] of domain.rows('ledger')) {
    if (v.rootSessionId !== rootSessionId) continue
    out.push({
      sequence: v.sequence,
      factType: v.factType,
      operationId: v.operationId ?? null,
      createdAt: v.createdAt,
      payload: v.payload ?? {},
    })
  }
  return out.sort((a, b) => a.sequence - b.sequence)
}

// ── public-seam RPC (browser wire format, cookie-authenticated) ────────────

export function readBootState() {
  const p = join(STATE_DIR, 'boot-state.json')
  if (!existsSync(p)) throw new Error(`state/boot-state.json absent — run boot.mjs first (path ${p})`)
  return JSON.parse(readFileSync(p, 'utf8'))
}

/** The persisted session cookie (normalized to `name=value`). */
export function readCookie() {
  const p = join(STATE_DIR, 'cookie-header.txt')
  if (!existsSync(p)) throw new Error(`state/cookie-header.txt absent — run boot.mjs first (D2 persists it)`)
  const raw = readFileSync(p, 'utf8').trim()
  return raw.split(';', 1)[0].trim()
}

/**
 * One unary Connection RPC over HTTP (createWebConnectionRpc wire format):
 * POST {origin}{channel}/{endpoint}, body client-request envelope, cookie auth.
 * Returns {status, ok, value, error, raw}.
 */
export async function rpc(origin, cookie, channel, endpoint, payload, timeoutMs = 60_000) {
  const rpcId = randomUUID()
  const res = await fetch(`${origin}${channel}/${endpoint}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId, method: endpoint, payload }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  const text = await res.text()
  let env = null
  try { env = JSON.parse(text) } catch { env = { nonJson: text.slice(0, 400) } }
  if (env?.type === 'server-response' && env.rpcId !== rpcId) {
    throw new Error(`rpcId mismatch on ${channel}/${endpoint} (sent ${rpcId})`)
  }
  const result = env?.result
  return {
    status: res.status,
    ok: result?.ok === true,
    value: result?.ok === true ? result.value : null,
    error: result?.ok === false ? result.error : null,
    raw: env,
  }
}

/** Deliver one queued text prompt to a session (public session API).
 *  Wire request requires requestId (typert gateway boundary validation). */
export function sessionPrompt(origin, cookie, sessionId, text, mode = 'queue') {
  return rpc(origin, cookie, '/api', 'session/prompt', {
    args: { request: { requestId: randomUUID(), sessionId, mode, content: [{ type: 'text', text }] } },
  })
}

/** One team-remote catalog call (contract version 1 default). */
export function teamRemote(origin, cookie, method, params, version = 1) {
  return rpc(origin, cookie, '/team-remote', method, { version, params })
}

// ── misc ───────────────────────────────────────────────────────────────────

export function sha256hex(s) {
  return createHash('sha256').update(s).digest('hex')
}

export function portOpen(port, timeoutMs = 1500) {
  return new Promise((resolvePromise) => {
    const s = net.connect(port, '127.0.0.1')
    s.on('connect', () => { s.destroy(); resolvePromise(true) })
    s.on('error', () => resolvePromise(false))
    s.setTimeout(timeoutMs, () => { s.destroy(); resolvePromise(false) })
  })
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function writeState(name, text) {
  writeFileSync(join(STATE_DIR, name), text)
}
