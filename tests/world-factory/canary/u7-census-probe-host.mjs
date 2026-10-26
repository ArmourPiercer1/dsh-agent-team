/**
 * u7-census-probe-host.mjs — the U7-0 (EB2-A) ObservedRuntimeInventory
 * collector row (TEST-ONLY; mounted through the public profile-patch seam
 * by tests/world-factory).
 *
 * WHAT IT OBSERVES (public seams only):
 *   - `ctx.tools.schemas(scope)` — the visible-name set per scope
 *     (tests/deepseek-harness-test-use packages/core/tools/src/index.ts
 *     public `schemas`; a deep-clone PROJECTION — used for the name set,
 *     NEVER as registration identity, per its own contract);
 *   - `ctx.tools.get(name, scope)` — the live Definition (public `get`);
 *   - `definitionIdentityOf` from packages/runtime/tool-dispatch (the ONE
 *     placement-identity minter the Guard and the plane share, injected as
 *     a file-URL seam — the census reports the SAME identity algebra, it
 *     does not invent a second one);
 *   - `tools/change` — a registration-generation counter (empty payload by
 *     contract; the census records the counter, never pretends the event
 *     carried a name);
 *   - `agent/created` — every lane's agent reference + ctx (held, never
 *     deref'd outside a try).
 *
 * IDENTITY LAW (pinned by the tracked artifact's `law` block): placement
 * identity is PER-BOOT WeakMap algebra — recorded, never digest-compared
 * across boots. The cross-boot fact is the model-facing SHAPE digest,
 * computed through the testkit canonical module (same file URL the C1
 * tests import, so probe and reconciler can never disagree by drifting
 * implementations).
 *
 * FORBIDDEN here (and absent): host private internals, string-as-identity
 * of the Body, eval/Function, mutation of anything. This row REGISTERS ONE
 * tool and READS. No product surface changes.
 *
 * Seam env (set by tests/world-factory/lib/world-factory.mjs):
 *   U7C_LEDGER     JSONL ledger path (the evidence channel; the transcript
 *                  is never evidence)
 *   U7C_WORLD      world id tag
 *   U7C_TD_URL     file URL of the tool-dispatch dist face (definitionIdentityOf)
 *   U7C_CANON_URL  file URL of packages/testkit/census/json-canonical.mjs
 *   U7C_BOOT_ID    this boot's id (pairs same-boot comparisons)
 *   U7C_AUTO_SNAPSHOT_MS  comma-separated ms offsets after mount at which
 *                  an unattended snapshot is recorded (the governed lanes
 *                  exist at boot; the census must not depend on any model
 *                  capability grant to see them)
 *
 * @module tests/world-factory/canary/u7-census-probe-host
 */
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export const name = 'u7-census-probe-host'
export const inject = ['tools']

const LEDGER = process.env['U7C_LEDGER'] ?? ''
const WORLD = process.env['U7C_WORLD'] ?? 'unknown'
const TD_URL = process.env['U7C_TD_URL'] ?? ''
const CANON_URL = process.env['U7C_CANON_URL'] ?? ''
const BOOT_ID = process.env['U7C_BOOT_ID'] ?? 'boot-1'

export const CENSUS_TOOL_NAME = 'u7_census'

/** Names whose PRESENCE marks a lane as Team-coordination (classification,
 *  not authority): own-layer leader tools + the plane alias rows. */
const TEAM_MARKERS_PREFIX = ['team_']
/** Native names the governed plane takes over at native spelling (U4
 *  PLANE_SUPPORTED_NATIVE_TAKEOVERS: read, bash) — an identity that
 *  DIFFERS from the global row is a governed-lane signal. */
const NATIVE_TAKEOVER_NAMES = new Set(['read', 'bash'])

function record(row) {
  if (LEDGER === '') return
  try {
    mkdirSync(dirname(LEDGER), { recursive: true })
    appendFileSync(LEDGER, JSON.stringify({ at: new Date().toISOString(), world: WORLD, boot: BOOT_ID, ...row }) + '\n')
  } catch {
    /* the ledger dying is an ORACLE failure — the missing rows read as FAIL
       at the judge; this row never fakes them */
  }
}
const slug = (v) => String(v ?? 'untagged').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80)
const safeLabel = (fn, cap = 120) => {
  try {
    const v = fn()
    return String(v ?? 'unknown').slice(0, cap)
  } catch (error) {
    return `unreadable(${String(error?.message ?? error).slice(0, 60)})`
  }
}

// ── public-seam imports (file URLs injected by the factory) ────────────────
if (TD_URL === '' || CANON_URL === '') {
  record({ leg: 'seam-refused', code: 'U7C_SEAMS_MISSING', td: TD_URL === '', canon: CANON_URL === '' })
}
const td = TD_URL === '' ? null : await import(TD_URL).catch((e) => { record({ leg: 'seam-refused', code: 'TD_IMPORT_FAILED', error: String(e?.message ?? e).slice(0, 200) }); return null })
const canon = CANON_URL === '' ? null : await import(CANON_URL).catch((e) => { record({ leg: 'seam-refused', code: 'CANON_IMPORT_FAILED', error: String(e?.message ?? e).slice(0, 200) }); return null })

// ── observed state ─────────────────────────────────────────────────────────
/** agent label → { agent, agentCtx } from agent/created (held refs). */
const lanes = new Map()
/** registration-generation counter: every tools/change bumps it. */
let changeSeq = 0
/** `${name}` → changeSeq at which it FIRST appeared in the GLOBAL view. */
const globalFirstSeenSeq = new Map()

function globalVisible(tools) {
  try {
    return (tools.schemas() ?? []).map((s) => String(s?.name ?? '')).filter((n) => n !== '')
  } catch (error) {
    record({ leg: 'schemas-error', scope: 'global', error: String(error?.message ?? error).slice(0, 160) })
    return []
  }
}
function trackGlobal(names) {
  for (const n of names) if (!globalFirstSeenSeq.has(n)) globalFirstSeenSeq.set(n, changeSeq)
}

/** Snapshot ONE scope. `scopeArg` is the real agent reference for agent
 *  lanes (the S1-proven public pattern: the agent ref passed as the scope
 *  argument of the public reads), undefined for the global view. */
function snapshotScope(tools, scopeId, kind, scopeArg) {
  let names
  try {
    names = (tools.schemas(scopeArg) ?? []).map((s) => String(s?.name ?? '')).filter((n) => n !== '')
  } catch (error) {
    record({ leg: 'schemas-error', scope: scopeId, error: String(error?.message ?? error).slice(0, 160) })
    names = []
  }
  const toolsOut = []
  for (const name of [...names].sort()) {
    let def = null
    try {
      def = tools.get(name, scopeArg)
    } catch (error) {
      record({ leg: 'get-error', scope: scopeId, name, error: String(error?.message ?? error).slice(0, 160) })
    }
    if (def === null || def === undefined) {
      // visible in the projection but the public read resolves nothing:
      // recorded verbatim (it is itself a census fact), never dropped.
      toolsOut.push({ name, definition_identity: null, schema_digest: `sha256:${'0'.repeat(64)}`, identity_vs_global: 'n/a', change_seq: globalFirstSeenSeq.get(name) ?? null, unresolved: true })
      continue
    }
    const identity = td?.definitionIdentityOf?.(def) ?? null
    const shapeDigest = canon?.definitionShapeDigest?.({
      name: def.name,
      description: def.description ?? null,
      parameters: def.parameters ?? null,
      outputSchema: def.output?.schema ?? null,
      timeoutMsPresent: def.timeoutMs !== undefined,
    }) ?? `sha256:${'0'.repeat(64)}`
    toolsOut.push({
      name,
      definition_identity: typeof identity === 'string' ? identity : null,
      schema_digest: shapeDigest,
      identity_vs_global: 'n/a', // filled after the global pass
      change_seq: globalFirstSeenSeq.get(name) ?? null,
    })
  }
  return { scope_id: scopeId, kind, agent_label: scopeArg === undefined ? 'row/global' : safeLabel(() => scopeArg?.id ?? scopeArg?.session?.header?.id), tools: toolsOut }
}

function classifyTeamLane(scope) {
  const names = new Set(scope.tools.map((t) => t.name))
  for (const n of names) if (TEAM_MARKERS_PREFIX.some((p) => n.startsWith(p))) return { team_lane: true, signal: 'team-names' }
  for (const t of scope.tools) if (NATIVE_TAKEOVER_NAMES.has(t.name) && t.identity_vs_global === 'differs') return { team_lane: true, signal: 'native-takeover-identity' }
  return { team_lane: false, signal: 'none' }
}

function snapshotAll(ctx, tag) {
  const scopes = []
  const globalScope = snapshotScope(ctx.tools, 'global', 'global', undefined)
  trackGlobal(globalScope.tools.map((t) => t.name))
  scopes.push(globalScope)
  const globalIdentity = new Map(globalScope.tools.map((t) => [t.name, t.definition_identity]))
  let agentN = 0
  for (const [label, lane] of lanes) {
    if (lane.agent === undefined || lane.agent === null) continue
    agentN += 1
    const scope = snapshotScope(ctx.tools, `agent-${String(agentN)}`, 'agent', lane.agent)
    for (const t of scope.tools) {
      if (!globalIdentity.has(t.name)) t.identity_vs_global = 'n/a'
      else if (t.definition_identity === null || globalIdentity.get(t.name) === null) t.identity_vs_global = 'n/a'
      else t.identity_vs_global = t.definition_identity === globalIdentity.get(t.name) ? 'same' : 'differs'
    }
    scopes.push(scope)
  }
  for (const t of globalScope.tools) t.identity_vs_global = 'same'
  for (const s of scopes) {
    const cls = classifyTeamLane(s)
    s.team_lane = cls.team_lane
    s.team_lane_signal = cls.signal
    s.tools.sort((a, b) => (a.name < b.name ? -1 : 1))
  }
  record({ leg: 'census-snapshot', tag: slug(tag), boot: BOOT_ID, changeSeq, scopes })
  return scopes
}

const censusDefinition = {
  name: CENSUS_TOOL_NAME,
  description: 'U7-0 runtime tool census (test-only). Arguments: { action: "snapshot" | "report", tag?: string }. Snapshot records every visible tool per observed scope with its placement identity and shape digest.',
  parameters: {
    type: 'object',
    properties: { action: { type: 'string' }, tag: { type: 'string' } },
    required: ['action'],
  },
  output: {
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        action: { type: 'string' }, ok: { type: 'boolean' },
        scopes: { type: 'integer' }, tools: { type: 'integer' },
        change_seq: { type: 'integer' }, code: { type: 'string' },
      },
      required: ['action', 'ok'],
    },
    render: (args, value) => [{ type: 'text', text: JSON.stringify(value) }],
  },
  execute: async (args) => {
    const action = String(args?.action ?? '')
    if (td === null || canon === null) {
      record({ leg: 'snapshot-refused', action, code: 'SEAMS_UNRESOLVED' })
      return { action, ok: false, code: 'SEAMS_UNRESOLVED' }
    }
    if (action === 'snapshot') {
      const scopes = snapshotAll(applyCtx, args?.tag ?? 'snap')
      const tools = scopes.reduce((n, s) => n + s.tools.length, 0)
      record({ leg: 'census-snapshot-summary', action, tag: slug(args?.tag), scopeCount: scopes.length, toolRows: tools, changeSeq })
      return { action, ok: true, scopes: scopes.length, tools, change_seq: changeSeq }
    }
    if (action === 'report') {
      record({ leg: 'census-report', lanesHeld: lanes.size, changeSeq })
      return { action, ok: true, scopes: lanes.size + 1, change_seq: changeSeq }
    }
    return { action: `unknown:${action}`, ok: false, code: 'UNKNOWN_ACTION' }
  },
}

let applyCtx = null

export function apply(ctx) {
  applyCtx = ctx
  record({ leg: 'plugin-apply', pid: process.pid, tdSeam: TD_URL !== '', canonSeam: CANON_URL !== '' })
  if (td === null || canon === null) return
  ctx.effect(() => {
    let dispose
    try {
      dispose = ctx.tools.register(censusDefinition)
      trackGlobal(globalVisible(ctx.tools))
      record({ leg: 'register', kind: 'census-tool', ok: true })
    } catch (error) {
      record({ leg: 'register', kind: 'census-tool', ok: false, error: String(error?.message ?? error).slice(0, 300) })
      return () => {}
    }
    return () => { try { dispose() } catch { /* unwind */ } }
  }, 'u7-census-tool')
  try {
    ctx.on('agent/created', (payload) => {
      const label = safeLabel(() => payload?.agent?.id ?? payload?.agent?.session?.header?.id)
      let agentCtx
      try { agentCtx = payload?.agent?.ctx } catch { agentCtx = undefined }
      lanes.set(label, { agent: payload?.agent, agentCtx })
      record({ leg: 'agent-created', agent: label, held: payload?.agent !== undefined && payload?.agent !== null })
    })
    record({ leg: 'listen', event: 'agent/created', ok: true })
  } catch (error) {
    record({ leg: 'listen', event: 'agent/created', ok: false, error: String(error?.message ?? error).slice(0, 160) })
  }
  try {
    ctx.on('tools/change', () => {
      changeSeq += 1
      // Attribute the generation to the GLOBAL view only: the event carries
      // no name (contract), so a lane-local attribution would be a guess.
      trackGlobal(globalVisible(ctx.tools))
    })
    record({ leg: 'listen', event: 'tools/change', ok: true })
  } catch (error) {
    record({ leg: 'listen', event: 'tools/change', ok: false, error: String(error?.message ?? error).slice(0, 160) })
  }
  try {
    // A pure OBSERVER arm: every call carries its executing agent; the
    // lane reference is what the census needs as the public scope argument
    // (the S1-proven pattern). This arm never decides anything: it always
    // forwards to next() (a swallowing observer is worse than no observer).
    ctx.on('tools/pre-execute', (exec, next) => {
      try {
        const agent = exec?.agent
        if (agent !== undefined && agent !== null) {
          const label = safeLabel(() => agent?.id ?? agent?.session?.header?.id)
          if (!lanes.has(label)) {
            lanes.set(label, { agent })
            record({ leg: 'agent-observed', agent: label, via: 'pre-execute' })
          }
        }
      } catch { /* never block the call for the observer's sake */ }
      return typeof next === 'function' ? next() : undefined
    })
    record({ leg: 'listen', event: 'tools/pre-execute', ok: true })
  } catch (error) {
    record({ leg: 'listen', event: 'tools/pre-execute', ok: false, error: String(error?.message ?? error).slice(0, 160) })
  }
  // Unattended snapshot arms: the governed lanes exist AT BOOT; recording
  // them must not depend on a model turn or a capability grant.
  const autoMs = (process.env['U7C_AUTO_SNAPSHOT_MS'] ?? '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n >= 0)
  for (const ms of autoMs) {
    setTimeout(() => {
      try {
        const scopes = snapshotAll(ctx, `auto-${String(ms)}ms`)
        record({ leg: 'census-snapshot-summary', action: 'auto', tag: `auto-${String(ms)}ms`, scopeCount: scopes.length, toolRows: scopes.reduce((n, s) => n + s.tools.length, 0), changeSeq })
      } catch (error) {
        record({ leg: 'census-auto-error', ms, error: String(error?.message ?? error).slice(0, 200) })
      }
    }, ms)
  }
  if (autoMs.length > 0) record({ leg: 'auto-arms', offsetsMs: autoMs })
  record({ leg: 'probe-mounted', boot: BOOT_ID })
}
