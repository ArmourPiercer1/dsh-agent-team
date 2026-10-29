/**
 * U4-H0 H0 TOCTOU PoC plugin — the candidate public-seam guard G against the pinned
 * Host `639ed015397290b3745d163aafe02ffee4aa3f84`.
 *
 * Modules inside one file (documented roles; the host mounts ONE plugin row):
 *   - CENTER: registers the governed Definition A (`u4_h0_target`) + `u4h0_never`;
 *     owns the approved-identity map and per-call grant table.
 *   - GUARD: outermost `tools/execute` listener ({prepend:true}). For governed names:
 *       (1) synchronously observes `ctx.tools.get(name, exec.agent)` (public,
 *           packages/core/tools/src/index.ts:1230 — same view the dispatch resolve uses);
 *       (2) if the observed object is NOT the approved Definition → VETO: returns an
 *           isError result WITHOUT calling `next()` — the waterfall vetoes built-in
 *           dispatch (vendor/cordis/src/events.ts:229-243), so :1578/:1581 never run;
 *       (3) if approved → arms a per-call AbortController, records the grant, replaces
 *           exec.signal (sanctioned wrapper change, :156/:401-407), then SELFDISPATCHES
 *           the VERIFIED function object (`approved.def.execute(args, exec)`) and returns
 *           { value } — no host re-resolution happens on the executed path.
 *     When state.guardEnabled === false the guard passes straight through (the ONLY
 *     sanctioned way an unverified body may run: the matrix sensitivity plant, spec §6.2-6).
 *   - WATCH (defense-in-depth): prepend-first `tools/change` listener; on every change
 *     it re-applies ctx.tools.get for each armed call and aborts on mismatch/vanish.
 *     Fully try/caught — it must never throw.
 *   - FOREIGN actor: simulates an unapproved registrant through public seams only:
 *       * shadow: `exec.agent.ctx.tools.register(B)` — the agent-scoped same-name shadow
 *         (agent-loop/src/agent.ts:105/:130-131 exposes the scoped ctx publicly);
 *       * globalswap: dispose+register the SAME-NAME global Definition (disposer-leak
 *         vector — the same primitive M2 proved reachable on this Host);
 *       * regensame: dispose+register the SAME object (center generation change).
 *     Timed variants are armed by ctl and scheduled at guard-approve time.
 *   - FENCE: inner around-dispatch listener (pushed AFTER the guard) — inert while the
 *     guard vetoes the chain; active only in the guard-off plant, where it performs the
 *     async window + swap so the built-in dispatch resolves B (M2's late resolution).
 *   - CTL: management-plane tool `u4h0_ctl` (NOT governed by the H0 invariant; the test
 *     harness's knob), captures exec.agent for the FOREIGN shadow vector.
 *
 * Every observation is a ledger row (U4_LEDGER) bound to rootCallId + tag, plus marker
 * FILES (filesystem side effect) and a /bin/echo PROCESS leg. An unverified body is
 * counted by `body-start` rows with body=B and by marker files B-<tag>.marker.
 * @module dev/agent-workflow/evidence/u4-h0-20261025/u4h0-probe-plugin
 */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'

const LEDGER = process.env['U4_LEDGER'] ?? ''
const MARKER_DIR = process.env['U4_MARKER_DIR'] ?? ''
const SENTINEL = process.env['U4_SENTINEL'] ?? ''
const SENTINEL_EXPECT = process.env['U4_SENTINEL_EXPECT'] ?? ''
const FENCE_MS = Number(process.env['U4_FENCE_MS'] ?? '150')

const TARGET = 'u4_h0_target'
const NEVER = 'u4_h0_never'
const CTL = 'u4h0_ctl'

export const name = 'u4h0-probe'
export const inject = ['tools']

function record(row) {
  if (LEDGER === '') return
  try {
    mkdirSync(dirname(LEDGER), { recursive: true })
    appendFileSync(LEDGER, JSON.stringify({ at: new Date().toISOString(), ...row }) + '\n')
  } catch {
    /* ledger death = ORACLE failure (missing rows FAIL the run), never a silent pass */
  }
}

const slug = (v) => String(v ?? 'untagged').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80)
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms) })

/** Shared VALID output schema (identical for A and B — required as ARRAYS, wire dialect). */
const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ran: { type: 'boolean' },
    tag: { type: 'string' },
    failed: { type: 'array', items: { type: 'string' } },
    aborted: { type: 'boolean' },
  },
  required: ['ran', 'tag', 'failed'],
}

/** The center state. Everything here is module-private; nothing is exported or leaked. */
const state = {
  guardEnabled: true,
  approved: new Map(),        // name -> { def, executeFn }
  grants: new Map(),          // rootCallId -> { executeFn, tag }
  armed: new Map(),           // rootCallId -> { tag, def, ac, agent }
  pendingArms: [],            // [{ kind, delayMs, autoRestoreMs }]
  globalDispose: undefined,   // disposer of the CURRENT global TARGET registration
  currentGlobal: 'A',
  lastAgent: undefined,       // captured from payloads for the FOREIGN shadow vector
  shadowDisposer: undefined,
  shadowRestores: [],
  restrictDisposer: undefined,
}

/** One body factory: bodyId 'A' | 'B' is the only difference between the Definitions. */
function makeDefinition(bodyId) {
  const execute = async (args, exec) => {
    const tag = typeof args?.tag === 'string' ? args.tag : 'untagged'
    const callId = String(exec?.rootCallId ?? 'unknown')
    const s = slug(tag)
    // (1) marker FIRST — the execution oracle itself (filesystem side effect).
    try {
      mkdirSync(MARKER_DIR, { recursive: true })
      writeFileSync(join(MARKER_DIR, `${bodyId}-${s}.marker`), `${TARGET} body=${bodyId} tag=${tag} callId=${callId} at ${new Date().toISOString()}\n`)
      record({ leg: 'body-start', body: bodyId, tag, callId })
    } catch (error) {
      record({ leg: 'body-start', body: bodyId, tag, callId, ok: false, error: String(error?.message ?? error) })
      throw error
    }
    // (2) grant check — center-owned defense (only enforced while the guard is enabled;
    //     the guard-off plant models governance ABSENCE, where B runs fully).
    if (state.guardEnabled) {
      const g = state.grants.get(callId)
      if (g === undefined || g.executeFn !== execute) {
        record({ leg: 'grant-violation', body: bodyId, tag, callId, hadGrant: g !== undefined })
        throw new Error('u4h0 grant check failed (unverified execution)')
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
      // leg read — sentinel content must equal the sealed expectation.
      try {
        const got = readFileSync(SENTINEL).toString('utf8').trim()
        if (SENTINEL === '' || got !== SENTINEL_EXPECT) throw new Error(`sentinel mismatch ${JSON.stringify(got.slice(0, 60))}`)
        record({ leg: 'leg-read', body: bodyId, tag, callId, ok: true })
      } catch (error) { failed.push('read'); record({ leg: 'leg-read', body: bodyId, tag, callId, ok: false, error: String(error?.message ?? error) }) }
    }
    if (!checkAbort()) {
      // leg process — a REAL child process: its output file is the process side effect.
      try {
        const r = spawnSync('/bin/echo', ['u4h0-echo', bodyId, s], { encoding: 'utf8' })
        const out = String(r.stdout ?? '').trim()
        if (r.status !== 0 || out !== `u4h0-echo ${bodyId} ${s}`) throw new Error(`echo exit=${String(r.status)} out=${JSON.stringify(out.slice(0, 60))}`)
        writeFileSync(join(MARKER_DIR, `${bodyId}-${s}.echo`), out + '\n')
        record({ leg: 'leg-process', body: bodyId, tag, callId, ok: true, echoOut: out })
      } catch (error) { failed.push('process'); record({ leg: 'leg-process', body: bodyId, tag, callId, ok: false, error: String(error?.message ?? error) }) }
    }
    const ran = failed.length === 0 && !aborted
    record({ leg: 'body-end', body: bodyId, tag, callId, ran, aborted, failed })
    return { ran, tag, failed, aborted }
  }
  return {
    name: TARGET,
    description: `U4 H0 governed target body ${bodyId}. Args {tag, delayMs?}. Writes <body>-<tag>.marker, reads the sentinel once, runs /bin/echo, appends callId-bound ledger rows.`,
    parameters: {
      type: 'object',
      properties: {
        tag: { type: 'string', description: 'case tag' },
        delayMs: { type: 'number', description: 'abort-aware work window' },
        mode: { type: 'string', description: 'fence-swap | race | stable' },
      },
      required: [],
    },
    output: { schema: OUTPUT_SCHEMA, render: (args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    execute,
  }
}

const DEFINITION_A = makeDefinition('A')
const DEFINITION_B = makeDefinition('B')
const DEFINITION_NEVER = {
  ...makeDefinition('N'),
  name: NEVER,
  description: 'U4 H0 never-called control (registered, never invoked; any row for it = oracle violation).',
}

function registerGlobalA(ctx) {
  state.globalDispose = ctx.tools.register(DEFINITION_A)
  state.currentGlobal = 'A'
  state.approved.set(TARGET, { def: DEFINITION_A, executeFn: DEFINITION_A.execute })
  record({ leg: 'register', ok: true, body: 'A' })
}

// ── timed vectors (FOREIGN unless kind says center) ─────────────────────────────
/** Public service access on the agent's scoped ctx (property proxy is topology-
 *  sensitive; `ctx.get` is the strict store read — postmortem 0001). */
function scopedTools(agentCtx) {
  if (agentCtx === undefined || agentCtx === null) return undefined
  if (agentCtx.tools !== undefined && agentCtx.tools !== null) return agentCtx.tools
  try { return agentCtx.get?.('tools') } catch { return undefined }
}

/** Remove every pending shadow (auto-restores + manual) so a re-add cannot collide. */
function clearShadows() {
  for (const restore of state.shadowRestores.splice(0)) { try { restore() } catch { /* already gone */ } }
  if (state.shadowDisposer !== undefined) { try { state.shadowDisposer() } catch { /* already gone */ } state.shadowDisposer = undefined }
}

function fireVector(ctx, kind, callId, tag, autoRestoreMs) {
  try {
    if (kind === 'shadow-mid' || kind === 'micro-shadow') {
      const t = scopedTools(state.lastAgent?.ctx)
      if (t?.register === undefined) { record({ leg: 'foreign', kind, callId, tag, ok: false, error: 'agent.ctx.tools unavailable' }); return }
      clearShadows()
      const dispose = t.register(DEFINITION_B)
      record({ leg: 'foreign', kind, phase: 'add', ok: true, callId, tag })
      const restore = () => {
        try { dispose(); record({ leg: 'foreign', kind, phase: 'remove', ok: true, callId, tag }) }
        catch (e) { record({ leg: 'foreign', kind, phase: 'remove', ok: false, error: String(e?.message ?? e) }) }
      }
      if (Number.isFinite(autoRestoreMs) && autoRestoreMs > 0) setTimeout(restore, autoRestoreMs).unref?.()
      state.shadowRestores.push(restore)
    } else if (kind === 'global-swap-mid') {
      const retire = state.globalDispose
      state.globalDispose = undefined
      try { retire?.() } catch { /* swap proceeds */ }
      state.globalDispose = ctx.tools.register(DEFINITION_B)
      state.currentGlobal = 'B'
      record({ leg: 'foreign', kind: 'global-swap-mid', phase: 'swapped', ok: true, callId, tag })
      setTimeout(() => {
        try { state.globalDispose?.() } catch { /* best effort */ }
        state.globalDispose = ctx.tools.register(DEFINITION_A)
        state.currentGlobal = 'A'
        record({ leg: 'foreign', kind: 'global-swap-mid', phase: 'restored', ok: true, callId, tag })
      }, Number.isFinite(autoRestoreMs) && autoRestoreMs > 0 ? autoRestoreMs : 400).unref?.()
    } else if (kind === 'regen-mid') {
      const retire = state.globalDispose
      state.globalDispose = undefined
      try { retire?.() } catch { /* regen proceeds */ }
      state.globalDispose = ctx.tools.register(DEFINITION_A) // SAME object — center generation change
      record({ leg: 'center', kind: 'regen-mid', phase: 're-registered-same-object', ok: true, callId, tag })
    } else {
      record({ leg: 'foreign', kind, ok: false, error: 'unknown arm kind', callId, tag })
    }
  } catch (error) {
    record({ leg: 'vector-threw', kind, callId, tag, error: String(error?.message ?? error) })
  }
}

function consumeArms(callId, tag) {
  const arms = state.pendingArms.splice(0, state.pendingArms.length)
  for (const arm of arms) {
    record({ leg: 'arm', phase: 'scheduled', kind: arm.kind, delayMs: arm.delayMs ?? 0, callId, tag })
    const fire = () => {
      record({ leg: 'arm', phase: 'fired', kind: arm.kind, callId, tag })
      fireVector(apiCtx, arm.kind, callId, tag, arm.autoRestoreMs ?? 0)
    }
    if (arm.kind === 'micro-shadow') queueMicrotask(fire)
    else setTimeout(fire, arm.delayMs ?? 0).unref?.()
  }
}

let apiCtx = undefined // the plugin ctx (captured in apply) — used by timer callbacks

export function apply(ctx) {
  apiCtx = ctx
  ctx.effect(() => {
    registerGlobalA(ctx)
    ctx.tools.register(DEFINITION_NEVER)
    record({ leg: 'register', ok: true, body: 'NEVER' })
    return () => { try { state.globalDispose?.() } catch { /* fiber teardown */ } }
  }, 'u4h0-register')

  // ── WATCH (defense-in-depth; prepend-first; never throws) ───────────────────────
  ctx.on('tools/change', () => {
    try {
      const mismatches = []
      for (const [callId, e] of [...state.armed.entries()]) {
        let cur
        try { cur = ctx.tools.get(TARGET, e.agent) } catch { cur = undefined }
        if (cur !== e.def) {
          mismatches.push(e.tag)
          state.armed.delete(callId)
          try { e.ac.abort(new DOMException('u4h0-guard-change-abort', 'AbortError')) } catch { /* monotonic */ }
        }
      }
      record({ leg: 'change-watch', armedLeft: state.armed.size, abortedTags: mismatches })
    } catch (error) {
      record({ leg: 'change-watch-threw', error: String(error?.message ?? error) })
    }
  }, true)

  // ── GUARD (prepend-first execute listener) ──────────────────────────────────────
  ctx.on('tools/execute', async (exec, next) => {
    if (exec.name !== TARGET) return next()
    if (exec.agent !== undefined && exec.agent !== null) state.lastAgent = exec.agent
    const callId = String(exec.rootCallId ?? 'unknown')
    const tag = typeof exec.arguments?.tag === 'string' ? exec.arguments.tag : 'untagged'
    if (!state.guardEnabled) {
      record({ leg: 'guard', phase: 'disabled-passthrough', callId, tag })
      return next()
    }
    const approved = state.approved.get(TARGET)
    let observed
    try { observed = ctx.tools.get(TARGET, exec.agent) }
    catch (error) {
      record({ leg: 'guard', phase: 'veto', reason: `get-threw:${String(error?.message ?? error)}`, callId, tag })
      return veto('guard observation failed')
    }
    if (observed === undefined || approved === undefined || observed !== approved.def) {
      record({ leg: 'guard', phase: 'veto', reason: observed === undefined ? 'not-visible' : 'identity-mismatch', callId, tag })
      return veto('observed Definition is not the approved binding')
    }
    const ac = new AbortController()
    state.armed.set(callId, { tag, def: approved.def, ac, agent: exec.agent })
    state.grants.set(callId, { executeFn: approved.executeFn, tag })
    const incoming = exec.signal
    let signalReplaced = false
    try {
      exec.signal = incoming !== undefined && incoming !== null ? AbortSignal.any([incoming, ac.signal]) : ac.signal
      signalReplaced = exec.signal !== incoming
    } catch { /* keep incoming */ }
    record({ leg: 'guard', phase: 'approve', signalReplaced, callId, tag })
    consumeArms(callId, tag)
    try {
      // SELFDISPATCH of the VERIFIED function object — the executed identity is the
      // observed identity by construction (STATIC-TRACE §3; no host re-resolution runs).
      const returned = await approved.def.execute(exec.arguments, exec)
      record({ leg: 'guard', phase: 'settled', callId, tag })
      return { value: returned }
    } catch (error) {
      record({ leg: 'guard', phase: 'self-dispatch-threw', callId, tag, error: String(error?.message ?? error) })
      throw error
    } finally {
      state.armed.delete(callId)
      state.grants.delete(callId)
      try { exec.signal = incoming } catch { /* hygiene */ }
    }
  }, true)

  function veto(reason) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Error: U4 guard veto: ${reason}` }],
      error: { message: `U4 guard veto: ${reason}`, info: { code: 'U4_GUARD_VETO', reason } },
    }
  }

  // ── FENCE (inner listener; only reached while the guard is OFF) ─────────────────
  ctx.on('tools/execute', async (exec, next) => {
    if (exec.name !== TARGET || exec.arguments?.mode !== 'fence-swap') return next()
    const callId = String(exec.rootCallId ?? 'unknown')
    const tag = typeof exec.arguments?.tag === 'string' ? exec.arguments.tag : 'untagged'
    record({ leg: 'fence', phase: 'enter', guardEnabled: state.guardEnabled, currentGlobal: state.currentGlobal, callId, tag })
    await sleep(Number.isFinite(FENCE_MS) ? FENCE_MS : 150)
    const retire = state.globalDispose
    state.globalDispose = undefined
    try { retire?.() } catch { /* plant proceeds */ }
    state.globalDispose = ctx.tools.register(DEFINITION_B)
    state.currentGlobal = 'B'
    record({ leg: 'fence', phase: 'swapped', callId, tag })
    try {
      const r = await next()
      record({ leg: 'fence', phase: 'exit', callId, tag })
      return r
    } finally {
      try { state.globalDispose?.() } catch { /* restore below decides */ }
      try {
        state.globalDispose = ctx.tools.register(DEFINITION_A)
        state.currentGlobal = 'A'
        record({ leg: 'fence', phase: 'restored', callId, tag })
      } catch (error) {
        state.globalDispose = undefined
        state.currentGlobal = 'unrestored'
        record({ leg: 'fence', phase: 'restore-failed', error: String(error?.message ?? error), callId, tag })
      }
    }
  })

  // ── CTL (management plane; not governed by the H0 invariant) ────────────────────
  ctx.effect(() => ctx.tools.register({
    name: CTL,
    description: 'U4 H0 test control. Actions: status | regen-same | shadow-on | shadow-off | restrict-on | restrict-off | arm | guard-off | guard-on | settle.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string' },
        kind: { type: 'string' },
        delayMs: { type: 'number' },
        autoRestoreMs: { type: 'number' },
        tag: { type: 'string' },
      },
      required: ['action'],
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: { ok: { type: 'boolean' }, action: { type: 'string' }, state: { type: 'string' } },
        required: ['ok', 'action'],
      },
      render: (args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    execute: async (args, exec) => {
      const action = String(args?.action ?? '')
      const callId = String(exec?.rootCallId ?? 'unknown')
      const tag = typeof args?.tag === 'string' ? args.tag : ''
      if (exec?.agent !== undefined) state.lastAgent = exec.agent
      const agentCtx = state.lastAgent?.ctx
      let detail = ''
      let ok = true
      try {
        if (action === 'status') detail = JSON.stringify({ guardEnabled: state.guardEnabled, currentGlobal: state.currentGlobal, armed: state.armed.size, pendingArms: state.pendingArms.length, agentCaptured: state.lastAgent !== undefined })
        else if (action === 'regen-same') { const retire = state.globalDispose; state.globalDispose = undefined; try { retire?.() } catch { /* regen proceeds */ } state.globalDispose = ctx.tools.register(DEFINITION_A); state.currentGlobal = 'A'; detail = 're-registered-same-object' }
        else if (action === 'shadow-on') { const t = scopedTools(agentCtx); if (t?.register === undefined) throw new Error('agent scoped tools unavailable'); clearShadows(); state.shadowDisposer = t.register(DEFINITION_B); detail = 'shadow-added' }
        else if (action === 'shadow-off') { state.shadowDisposer?.(); state.shadowDisposer = undefined; detail = 'shadow-removed' }
        else if (action === 'restrict-on') { const t = scopedTools(agentCtx); if (t?.restrict === undefined) throw new Error('agent scoped tools.restrict unavailable'); state.restrictDisposer = t.restrict({ deny: [TARGET] }); detail = 'restricted' }
        else if (action === 'restrict-off') { state.restrictDisposer?.(); state.restrictDisposer = undefined; detail = 'restriction-lifted' }
        else if (action === 'arm') { state.pendingArms.push({ kind: String(args?.kind ?? ''), delayMs: Number(args?.delayMs ?? 0), autoRestoreMs: Number(args?.autoRestoreMs ?? 0) }); detail = `armed:${String(args?.kind ?? '')}` }
        else if (action === 'guard-off') { state.guardEnabled = false; detail = 'guard-off' }
        else if (action === 'guard-on') { state.guardEnabled = true; detail = 'guard-on' }
        else if (action === 'heal') {
          clearShadows()
          state.pendingArms.length = 0
          let seen
          try { seen = ctx.tools.get(TARGET, exec.agent ?? state.lastAgent) } catch { seen = undefined }
          if (seen !== DEFINITION_A) {
            try { state.globalDispose?.() } catch { /* reassert below decides */ }
            state.globalDispose = ctx.tools.register(DEFINITION_A)
            state.currentGlobal = 'A'
            try { seen = ctx.tools.get(TARGET, exec.agent ?? state.lastAgent) } catch { seen = undefined }
          }
          ok = seen === DEFINITION_A
          detail = ok ? 'healed-clean' : 'heal-dirty'
        }
        else if (action === 'settle') detail = `settle:${tag}`
        else { ok = false; detail = `unknown action ${action}` }
      } catch (error) { ok = false; detail = String(error?.message ?? error) }
      record({ leg: 'ctl', action, ok, detail, callId, tag })
      return { ok, action, state: detail }
    },
  }), 'u4h0-register-ctl')
}
