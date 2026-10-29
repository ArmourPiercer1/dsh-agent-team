/**
 * G1F-SUP-A shared oracle primitives — ONE module instance shared by the
 * center-guard plugin (`g1fa-plugin.mjs`), the late-registrant plugin
 * (`g1fa-registrant.mjs`), and the runner's unit self-checks (Node module
 * cache keys on the resolved file URL, and the Host loads every plugin row
 * from this same directory path, so all importers see this exact object
 * graph; no Host-internal import is involved).
 *
 * Contents:
 *  - ledger/marker/sentinel plumbing (the execution oracle: rows written from
 *    INSIDE the Bodies + marker files + a /bin/echo process leg — same oracle
 *    class as sealed U4-H0, which the G1-F review round-1 finding 10 accepted
 *    as real and non-vacuous);
 *  - the state container shared across the two plugin rows (approved table,
 *    grants, armed calls, callId→tag map, governance flags);
 *  - the Definition factory (bodies A / B / B-prime / B-div) with per-call
 *    grant check, abort-aware work window, and finalize/project identity
 *    markers (review finding 6);
 *  - the guard VETO result constructor (waterfall short-circuit, so Host
 *    dispatch and its late resolve never run — error path performs no
 *    re-resolve, index.ts:1867-1874 @639ed015).
 *
 * Nothing here is Host-internal: everything reaches the Host through the
 * public `tools.register` / event seams only.
 * @module dev/agent-workflow/evidence/u4-g1f-sup-a-20261025/g1fa-shared
 */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'

export const LEDGER = process.env['G1A_LEDGER'] ?? ''
export const MARKER_DIR = process.env['G1A_MARKER_DIR'] ?? ''
export const SENTINEL = process.env['G1A_SENTINEL'] ?? ''
export const SENTINEL_EXPECT = process.env['G1A_SENTINEL_EXPECT'] ?? ''

export const TARGET = 'u4_h0_target'
export const NEVER = 'u4_h0_never'
export const CTL = 'u4g1a_ctl'
export const LATE_NAME = 'u4g1a_late'
export const CONTROL_NAMES = Object.freeze(['send_message', 'interrupt_agent', 'plugin_manager'])

export function record(row) {
  if (LEDGER === '') return
  try {
    mkdirSync(dirname(LEDGER), { recursive: true })
    appendFileSync(LEDGER, JSON.stringify({ at: new Date().toISOString(), ...row }) + '\n')
  } catch {
    /* ledger death = ORACLE failure (missing rows FAIL the run), never a silent pass */
  }
}

export const slug = (v) => String(v ?? 'untagged').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80)
export const sleep = (ms) => new Promise((r) => { setTimeout(r, ms) })

/** Shared VALID output schema (identical for A, B and B-prime; arrays = wire dialect). */
export const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ran: { type: 'boolean' },
    tag: { type: 'string' },
    failed: { type: 'array', items: { type: 'string' } },
    aborted: { type: 'boolean' },
    note: { type: 'string' },
  },
  required: ['ran', 'tag', 'failed'],
}

/** The shared center state. Module-private to the fixture; never exported to Host code. */
export const state = {
  guardEnabled: true,        // governed-NAME guard (H0 parity; off ONLY for the f1 plant)
  ctlGuardEnabled: true,     // agent-control NAMES guard for governed agents (off ONLY for the p6 plant)
  approved: new Map(),       // name -> { def, executeFn } — the center-owned approval table
  grants: new Map(),         // callId -> { executeFn, tag } — per-call grant (defense only)
  armed: new Map(),          // callId -> { tag, def, ac, agent } — armed change-watcher calls
  callTags: new Map(),       // callId -> tag — correlation for tools/result rows
  settled: new Map(),        // callId -> { signalRestored, postCheck } — guard observations
  pendingArms: [],           // [{ kind, delayMs, autoRestoreMs }]
  governedAgents: new Set(), // agents of governed (Team-member-modelled) sessions
  globalDispose: undefined,
  currentGlobal: 'A',
  lastAgent: undefined,
  shadowRestores: [],
  shadowDisposer: undefined,
  restrictDisposer: undefined,
}

/** Public service access on the agent's scoped ctx (postmortem 0001: `ctx.get` is the strict store read). */
export function scopedTools(agentCtx) {
  if (agentCtx === undefined || agentCtx === null) return undefined
  if (agentCtx.tools !== undefined && agentCtx.tools !== null) return agentCtx.tools
  try { return agentCtx.get?.('tools') } catch { return undefined }
}

/**
 * One body factory. `bodyId` ('A' | 'B' | 'Bp') is the executed-identity the
 * oracle counts; `finalizeMarker` makes finalize/project capture observable
 * (STATIC-TRACE createExecution :1407-1439 captures these callbacks BEFORE
 * policy — a swapped live binding must NOT change which callback runs).
 */
export function makeDefinition({ bodyId, name = TARGET, finalizeMarker, renderPrefix = '' }) {
  const execute = async (args, exec) => {
    const tag = typeof args?.tag === 'string' ? args.tag : 'untagged'
    const callId = String(exec?.callId ?? 'unknown')
    const s = slug(tag)
    state.callTags.set(callId, tag)
    // (1) marker FIRST — the execution oracle itself (filesystem side effect).
    try {
      mkdirSync(MARKER_DIR, { recursive: true })
      writeFileSync(join(MARKER_DIR, `${bodyId}-${s}.marker`), `${name} body=${bodyId} tag=${tag} callId=${callId} at ${new Date().toISOString()}\n`)
      record({ leg: 'body-start', body: bodyId, tag, callId, nested: exec?.parent !== undefined })
    } catch (error) {
      record({ leg: 'body-start', body: bodyId, tag, callId, ok: false, error: String(error?.message ?? error) })
      throw error
    }
    // (2) grant check — center-owned defense (only while the guard is enabled;
    //     the guard-off plant models governance ABSENCE, where B runs fully).
    if (state.guardEnabled) {
      const g = state.grants.get(callId)
      if (g === undefined || g.executeFn !== execute) {
        record({ leg: 'grant-violation', body: bodyId, tag, callId, hadGrant: g !== undefined })
        throw new Error('g1fa grant check failed (unverified execution)')
      }
      record({ leg: 'grant-ok', body: bodyId, tag, callId })
    }
    const failed = []
    let aborted = false
    const signal = exec?.signal
    const checkAbort = () => {
      if (signal?.aborted === true && !aborted) {
        aborted = true
        record({ leg: 'body-abort-observed', body: bodyId, tag, callId, reason: String(signal?.reason?.message ?? 'aborted') })
      }
      return aborted
    }
    // (3) abort-aware work window (simulates real work; gives timed swaps a mid-body slot).
    const delayMs = Number(args?.delayMs ?? 0)
    if (Number.isFinite(delayMs) && delayMs > 0) {
      const until = Date.now() + delayMs
      while (Date.now() < until && !checkAbort()) await sleep(Math.min(25, until - Date.now()))
    }
    if (!checkAbort()) {
      try {
        const got = readFileSync(SENTINEL).toString('utf8').trim()
        if (SENTINEL === '' || got !== SENTINEL_EXPECT) throw new Error(`sentinel mismatch ${JSON.stringify(got.slice(0, 60))}`)
        record({ leg: 'leg-read', body: bodyId, tag, callId, ok: true })
      } catch (error) { failed.push('read'); record({ leg: 'leg-read', body: bodyId, tag, callId, ok: false, error: String(error?.message ?? error) }) }
    }
    if (!checkAbort()) {
      try {
        const r = spawnSync('/bin/echo', ['g1fa-echo', bodyId, s], { encoding: 'utf8' })
        const out = String(r.stdout ?? '').trim()
        if (r.status !== 0 || out !== `g1fa-echo ${bodyId} ${s}`) throw new Error(`echo exit=${String(r.status)} out=${JSON.stringify(out.slice(0, 60))}`)
        writeFileSync(join(MARKER_DIR, `${bodyId}-${s}.echo`), out + '\n')
        record({ leg: 'leg-process', body: bodyId, tag, callId, ok: true, echoOut: out })
      } catch (error) { failed.push('process'); record({ leg: 'leg-process', body: bodyId, tag, callId, ok: false, error: String(error?.message ?? error) }) }
    }
    const ran = failed.length === 0 && !aborted
    record({ leg: 'body-end', body: bodyId, tag, callId, ran, aborted, failed })
    return { ran, tag, failed, aborted }
  }
  return {
    name,
    description: `G1A governed target body ${bodyId}. Args {tag, delayMs?, mode?}. Writes <body>-<tag>.marker, reads the sentinel, runs /bin/echo, appends callId-bound ledger rows.`,
    parameters: {
      type: 'object',
      properties: {
        tag: { type: 'string', description: 'case tag' },
        delayMs: { type: 'number', description: 'abort-aware work window' },
        mode: { type: 'string', description: 'fence-swap | swap-in-window | race | stable' },
      },
      required: [],
    },
    output: {
      schema: OUTPUT_SCHEMA,
      render: (args, value) => [{ type: 'text', text: `${renderPrefix}${JSON.stringify(value)}` }],
    },
    execute,
    ...(finalizeMarker === undefined ? {} : {
      // Identity markers for the finalize/project CAPTURE cells: which
      // Definition's callbacks ran is recorded even though the live binding
      // may have been swapped mid-body.
      finalizeContent: (exec, _result) => {
        const callId = String(exec?.callId ?? 'unknown')
        const tag = String(state.callTags.get(callId) ?? 'untagged')
        record({ leg: 'leg-finalize', body: bodyId, callId, tag })
        // Only the dedicated capture cells get a content replacement; every
        // other call keeps the renderer output (class assertions unaffected).
        return tag.startsWith('fin') ? [{ type: 'text', text: `FINALIZED-BY-${finalizeMarker}` }] : undefined
      },
      projectContent: (exec, _result) => {
        record({ leg: 'leg-project', body: bodyId, callId: String(exec?.callId ?? 'unknown'), tag: String(state.callTags.get(String(exec?.callId ?? '')) ?? 'untagged') })
        return undefined
      },
    }),
  }
}

/** The guard veto result: returned WITHOUT calling next(), so built-in dispatch and its late resolve never run. */
export function veto(reason, detail = undefined) {
  return {
    isError: true,
    content: [{ type: 'text', text: `Error: G1A guard veto: ${reason}${detail === undefined ? '' : ` (${detail})`}` }],
    error: { message: `G1A guard veto: ${reason}${detail === undefined ? '' : ` (${detail})`}`, info: { code: 'U4_GUARD_VETO', reason, ...(detail === undefined ? {} : { detail }) } },
  }
}
