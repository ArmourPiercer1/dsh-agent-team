/**
 * G1F-SUP-A center guard — the HOST-EQUIVALENT (next()-passing) redesign of
 * the sealed U4-H0 guard, tested against the pinned Host
 * `639ed015397290b3745d163aafe02ffee4aa3f84`.
 *
 * WHY next(): the sealed H0 guard vetoes the waterfall and SELFDISPATCHES the
 * verified function (H0 README §2, STATIC-TRACE §3). G1-F round-1 findings
 * 1–3 show self-dispatch bypasses `dispatchToolBody`'s signal fuse +
 * pre-body abort check (:1564-1575), `cancellationStates.bodyInvoked`
 * bookkeeping, Host settlement classes (:1549-1557, :1623-1627) and the
 * post-execute/result re-resolve semantics (:1803-1810, :1865-1883). This
 * guard instead:
 *
 *   GUARD (prepend `tools/execute`):
 *     (1) for a governed NAME, synchronously observes
 *         `ctx.tools.get(name, exec.agent)` (the same view dispatch resolves —
 *         F2) and compares it to the center approval table entry;
 *     (2) mismatch / not-visible / no table entry → VETO result WITHOUT
 *         `next()` (F4): built-in dispatch and its late :1578 resolve never
 *         run; the error path performs no re-resolve (:1867-1874);
 *     (3) approved → arm a per-call AbortController + grant, replace
 *         `exec.signal` with the guard-fused signal (the contract-permitted
 *         wrapper change, :401-407), then CALL `next()`.
 *         Host `dispatchToolBody` then runs NORMALLY: it re-fuses the original
 *         caller signal with the wrapper signal (:1569), runs its own
 *         pre-body abort check (:1572), sets bodyInvoked, invokes the resolved
 *         body, and classifies settlement (ABORTED vs ABORTED_BEFORE_DISPATCH)
 *         — all Host-native.
 *     (4) any binding change between this guard and the P4 abort check is
 *         synchronous and emits `tools/change` synchronously (F1); the
 *         prepend-first WATCH listener aborts the armed call, so the fused
 *         signal is already aborted when Host reaches :1572 and the Host's
 *         OWN check prevents the body (the window [W] is closed by Host
 *         mechanics, not by listener self-discipline).
 *     (5) after `next()` resolves, a POST-EXECUTE IDENTITY CHECK re-applies
 *         `ctx.tools.get`; on drift the guard records the event and converts
 *         a SUCCESS result into a guard error, so a result schema-validated
 *         against a swapped binding (:1876 re-resolve) is never forwarded as
 *         success.
 *
 *   WATCH: prepend-first `tools/change` listener; re-`get`s every armed call's
 *   live binding and aborts on mismatch/vanish. Fully try/caught.
 *   RESULT: `tools/result` listener records the final settlement CLASS
 *   (error.info.code) per call — the oracle's class ground truth.
 *   FENCE2: inner `tools/execute` listener that performs the SYNCHRONOUS
 *   in-window swap for the eq4 cell (proves (4) end-to-end on the real Host).
 *   FENCE: plant-only listener (guard OFF) — swaps mid-await so Host's own
 *   late resolve picks B: the non-vacuousness plant.
 *   CTL: `u4g1a_ctl` management plane (ungoverned; the matrix's knob) —
 *   incl. the `equiv` driver cells that call the PUBLIC `ctx.tools.execute`
 *   / `executionMode` as a caller with full signal control, and the nested
 *   sub-dispatch with `parent` (public ToolExecutionToken of a live exec,
 *   index.ts:316-349/1351-1353).
 *
 * PoC-5/6 governance: CONTROL_NAMES (send_message / interrupt_agent /
 * plugin_manager) are DENIED (veto, no next()) for agents the center has
 * marked governed (`govern-self`), while every other agent keeps native
 * behavior — the Team-member vs non-Team contrast requested by the review.
 * @module dev/agent-workflow/evidence/u4-g1f-sup-a-20261025/g1fa-plugin
 */
import {
  CONTROL_NAMES, CTL, NEVER, TARGET, makeDefinition, record, scopedTools, sleep, state, veto,
} from './g1fa-shared.mjs'
import { LATE_DEF } from './g1fa-registrant.mjs'

export const name = 'g1fa-center'
export const inject = ['tools']

const FENCE_MS = Number(process.env['G1A_FENCE_MS'] ?? '150')

const DEFINITION_A = makeDefinition({ bodyId: 'A', finalizeMarker: 'A' })
// A is the ONLY definition declaring concurrency: the eq9 scheduler cell needs
// an observable classification flip (parallel while A is live, exclusive after
// any swap — a swapped binding never EXECUTES anyway (guard veto), so the
// flip is an observation of the classification race, not an execution leak).
DEFINITION_A.isConcurrencySafe = (args) => args?.concurrency === 'safe'
const DEFINITION_B = makeDefinition({ bodyId: 'B', finalizeMarker: 'B', renderPrefix: 'B-render:' })
const DEFINITION_NEVER = { ...makeDefinition({ bodyId: 'N', finalizeMarker: 'N' }), name: NEVER, description: 'G1A never-called control (registered, never invoked; any row for it = oracle violation).' }
// Schema-DIVERGENT definition for eq6b: output requires a field no body ever
// returns, so a post-execute value replacement validated against THIS live
// binding must fail INVALID_TOOL_OUTPUT (the condition-4 hazard, made
// observable). Its body must never execute (Bdiv rows = oracle violation).
const DEFINITION_B_DIV = {
  ...makeDefinition({ bodyId: 'Bdiv', finalizeMarker: 'Bdiv' }),
  output: {
    schema: {
      type: 'object', additionalProperties: false,
      properties: { ran: { type: 'boolean' }, tag: { type: 'string' }, failed: { type: 'array', items: { type: 'string' } }, aborted: { type: 'boolean' }, note: { type: 'string' }, extra: { type: 'string' } },
      required: ['ran', 'tag', 'failed', 'extra'],
    },
    render: (args, value) => [{ type: 'text', text: `Bdiv-render:${JSON.stringify(value)}` }],
  },
}

function registerGlobalA(ctx) {
  state.globalDispose = ctx.tools.register(DEFINITION_A)
  state.currentGlobal = 'A'
  state.approved.set(TARGET, { def: DEFINITION_A, executeFn: DEFINITION_A.execute })
  record({ leg: 'register', ok: true, body: 'A' })
}

function swapTo(ctx, def, label) {
  const retire = state.globalDispose
  state.globalDispose = undefined
  try { retire?.() } catch { /* swap proceeds */ }
  state.globalDispose = ctx.tools.register(def)
  state.currentGlobal = def === DEFINITION_A ? 'A' : (def === DEFINITION_B ? 'B' : 'Bdiv')
  record({ leg: 'swap', label, to: state.currentGlobal, ok: true })
}

function restoreA(ctx, label) {
  try { state.globalDispose?.() } catch { /* restore below decides */ }
  try {
    state.globalDispose = ctx.tools.register(DEFINITION_A)
    state.currentGlobal = 'A'
    record({ leg: 'swap', label: `${label}-restored`, to: 'A', ok: true })
  } catch (error) {
    state.globalDispose = undefined
    state.currentGlobal = 'unrestored'
    record({ leg: 'swap', label: `${label}-restore-failed`, error: String(error?.message ?? error), ok: false })
  }
}

function clearShadows() {
  for (const restore of state.shadowRestores.splice(0)) { try { restore() } catch { /* already gone */ } }
  if (state.shadowDisposer !== undefined) { try { state.shadowDisposer() } catch { /* already gone */ } state.shadowDisposer = undefined }
}

function fireVector(ctx, kind, callId, tag, autoRestoreMs) {
  try {
    if (kind === 'shadow-mid' || kind === 'micro-shadow') {
      const t = scopedTools(state.lastAgent?.ctx)
      if (t?.register === undefined) { record({ leg: 'foreign', kind, ok: false, error: 'agent.ctx.tools unavailable', callId, tag }); return }
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
      swapTo(ctx, DEFINITION_B, 'global-swap-mid')
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

let apiCtx = undefined // the plugin ctx (captured in apply) — used by timer callbacks and the ctl driver

export function apply(ctx) {
  apiCtx = ctx
  ctx.effect(() => {
    registerGlobalA(ctx)
    ctx.tools.register(DEFINITION_NEVER)
    record({ leg: 'register', ok: true, body: 'NEVER' })
    return () => { try { state.globalDispose?.() } catch { /* fiber teardown */ } }
  }, 'g1fa-register')

  // ── WATCH (prepend-first tools/change; never throws) ────────────────────────
  ctx.on('tools/change', () => {
    try {
      const mismatches = []
      for (const [callId, e] of [...state.armed.entries()]) {
        let cur
        try { cur = ctx.tools.get(TARGET, e.agent) } catch { cur = undefined }
        if (cur !== e.def) {
          mismatches.push(e.tag)
          state.armed.delete(callId)
          try { e.ac.abort(new DOMException('g1fa-guard-change-abort', 'AbortError')) } catch { /* monotonic */ }
        }
      }
      record({ leg: 'change-watch', armedLeft: state.armed.size, abortedTags: mismatches })
    } catch (error) {
      record({ leg: 'change-watch-threw', error: String(error?.message ?? error) })
    }
  }, true)

  // ── RESULT (tools/result emit listener — settlement-class ground truth) ────
  ctx.on('tools/result', (exec, result) => {
    try {
      const callId = String(exec?.callId ?? 'unknown')
      record({
        leg: 'result',
        callId,
        tag: state.callTags.get(callId) ?? 'unknown',
        name: String(exec?.name ?? '?'),
        isError: result?.isError === true,
        code: result?.isError === true ? String(result?.error?.info?.code ?? 'ERROR') : 'SUCCESS',
        reason: String(result?.error?.info?.reason ?? ''),
        msgHead: String(result?.content?.[0]?.text ?? '').slice(0, 90),
      })
    } catch (error) {
      record({ leg: 'result-listener-threw', error: String(error?.message ?? error) })
    }
  })

  // ── GUARD (prepend-first tools/execute; next()-passing on approval) ────────
  ctx.on('tools/execute', async (exec, next) => {
    const callId = String(exec.callId ?? 'unknown')
    const tag = typeof exec.arguments?.tag === 'string' ? exec.arguments.tag : 'untagged'
    state.callTags.set(callId, tag)
    if (exec.agent !== undefined && exec.agent !== null) state.lastAgent = exec.agent
    const isTarget = exec.name === TARGET
    if (!isTarget) {
      if (CONTROL_NAMES.includes(exec.name)) {
        const argHead = (() => { try { return JSON.stringify(exec.arguments ?? {}).slice(0, 80) } catch { return '' } })()
        if (state.ctlGuardEnabled && state.governedAgents.has(exec.agent)) {
          record({ leg: 'ctl-guard', phase: 'veto', reason: 'agent-control-deny', name: exec.name, callId, tag, argHead })
          return veto('agent-control-deny', exec.name)
        }
        record({ leg: 'ctl-guard', phase: 'passthrough-native', name: exec.name, callId, tag, argHead })
        return next()
      }
      return next()
    }
    if (!state.guardEnabled) {
      record({ leg: 'guard', phase: 'disabled-passthrough', callId, tag })
      return next()
    }
    const approved = state.approved.get(TARGET)
    let observed
    try { observed = ctx.tools.get(TARGET, exec.agent) }
    catch (error) {
      record({ leg: 'guard', phase: 'veto', reason: `get-threw:${String(error?.message ?? error)}`, callId, tag, nested: exec.parent !== undefined })
      return veto('guard observation failed')
    }
    if (observed === undefined || approved === undefined || observed !== approved.def) {
      record({ leg: 'guard', phase: 'veto', reason: observed === undefined ? 'not-visible' : 'identity-mismatch', callId, tag, nested: exec.parent !== undefined })
      return veto('observed Definition is not the approved binding')
    }
    // Approved: arm, then delegate to the HOST dispatch chain via next().
    const ac = new AbortController()
    state.armed.set(callId, { tag, def: approved.def, ac, agent: exec.agent })
    state.grants.set(callId, { executeFn: approved.executeFn, tag })
    const incoming = exec.signal
    let guardSignal = incoming
    let signalReplaced = false
    try {
      guardSignal = incoming !== undefined && incoming !== null ? AbortSignal.any([incoming, ac.signal]) : ac.signal
      exec.signal = guardSignal
      signalReplaced = exec.signal !== incoming
    } catch { /* keep incoming */ }
    record({ leg: 'guard', phase: 'approve', signalReplaced, callId, tag, nested: exec.parent !== undefined })
    consumeArms(callId, tag)
    let result
    try {
      result = await next() // Host dispatch: fuse (:1569), abort check (:1572), resolve (:1578), bodyInvoked (:1580), settlement, restore (:1590)
    } catch (error) {
      record({ leg: 'guard', phase: 'next-threw', callId, tag, error: String(error?.message ?? error) })
      throw error
    } finally {
      state.armed.delete(callId)
      state.grants.delete(callId)
    }
    const signalRestored = exec.signal === guardSignal
    let post = 'ok'
    let cur
    try { cur = ctx.tools.get(TARGET, exec.agent) } catch { cur = undefined }
    if (cur !== approved.def) {
      post = 'drift'
      if (result?.isError !== true) {
        result = veto('result-path-identity-drift', tag) // never forward a result bound to a swapped schema as success (:1876)
      }
    }
    record({ leg: 'guard', phase: 'settled', callId, tag, signalRestored, post, code: result?.isError === true ? String(result?.error?.info?.code ?? 'ERROR') : 'SUCCESS' })
    state.settled.set(callId, { signalRestored, post })
    try { exec.signal = incoming } catch { /* hygiene */ }
    return result
  }, true)

  // ── FENCE2 (INNER listener: synchronous swap inside the guard→:1578 window, eq4 only) ──
  ctx.on('tools/execute', async (exec, next) => {
    if (exec.name !== TARGET || exec.arguments?.mode !== 'swap-in-window') return next()
    const callId = String(exec.callId ?? 'unknown')
    const tag = typeof exec.arguments?.tag === 'string' ? exec.arguments.tag : 'untagged'
    record({ leg: 'fence2', phase: 'enter', callId, tag })
    // SYNCHRONOUS swap before next(): tools/change fires synchronously (F1),
    // the WATCH listener aborts the armed wrapper signal synchronously, and
    // the Host's own :1572 abort check then prevents the body.
    swapTo(ctx, DEFINITION_B, 'fence2')
    record({ leg: 'fence2', phase: 'swapped', callId, tag })
    try {
      const r = await next()
      record({ leg: 'fence2', phase: 'exit', callId, tag, code: r?.isError === true ? String(r?.error?.info?.code ?? 'ERROR') : 'SUCCESS' })
      return r
    } finally {
      restoreA(ctx, 'fence2')
    }
  })

  // ── FENCE (plant-only: guard OFF; async window + swap so Host's late resolve picks B) ──
  ctx.on('tools/execute', async (exec, next) => {
    if (exec.name !== TARGET || exec.arguments?.mode !== 'fence-swap') return next()
    const callId = String(exec.callId ?? 'unknown')
    const tag = typeof exec.arguments?.tag === 'string' ? exec.arguments.tag : 'untagged'
    record({ leg: 'fence', phase: 'enter', guardEnabled: state.guardEnabled, currentGlobal: state.currentGlobal, callId, tag })
    await sleep(Number.isFinite(FENCE_MS) ? FENCE_MS : 150)
    swapTo(ctx, DEFINITION_B, 'fence-plant')
    try {
      const r = await next()
      record({ leg: 'fence', phase: 'exit', callId, tag })
      return r
    } finally {
      restoreA(ctx, 'fence-plant')
    }
  })

  // ── one-shot tools/post-execute helpers (result-path cells) ────────────────
  const activePostDisposers = []
  function oncePost(handler) {
    let dispose = undefined
    dispose = ctx.on('tools/post-execute', async (exec, result, next) => {
      try { dispose?.() } catch { /* effect hygiene */ }
      const i = activePostDisposers.indexOf(dispose)
      if (i >= 0) activePostDisposers.splice(i, 1)
      return handler(exec, result, next)
    }, true)
    activePostDisposers.push(dispose)
  }
  function dropAllPost() {
    for (const d of activePostDisposers.splice(0)) { try { d() } catch { /* gone */ } }
  }

  const codeOf = (r) => r?.isError === true ? String(r?.error?.info?.code ?? 'ERROR') : 'SUCCESS'

  // ── equiv driver cells (public ctx.tools.execute / executionMode as caller) ──
  async function runEquiv(kind, exec) {
    const agent = exec.agent
    const base = (tag, extra = {}, callId = `g1a-${tag}`) => {
      state.callTags.set(callId, tag)
      return { callId, name: TARGET, arguments: { tag, mode: 'stable', ...extra }, agent, signal: new AbortController().signal }
    }
    const out = { leg: 'equiv', kind, code: 'RUNTIME-ERROR', extra: {} }
    try {
      if (kind === 'eq1') { // pre-aborted caller signal → Host :1500/:1572 short-circuit; body never starts
        const ac = new AbortController()
        ac.abort(new DOMException('g1a-caller-prerun', 'AbortError'))
        const res = await ctx.tools.execute({ ...base('eq1'), signal: ac.signal })
        out.code = codeOf(res)
        out.extra = { msgHead: String(res?.content?.[0]?.text ?? '').slice(0, 80) }
      } else if (kind === 'eq2') { // caller cancel DURING body → bodyInvoked true → ABORTED (not BEFORE_DISPATCH)
        const ac = new AbortController()
        setTimeout(() => { try { ac.abort(new Error('g1a-caller-mid')) } catch { /* monotonic */ } }, 120).unref()
        const res = await ctx.tools.execute({ ...base('eq2', { delayMs: 500 }), signal: ac.signal })
        out.code = codeOf(res)
      } else if (kind === 'eq3') { // change-watcher abort mid-body: fuse carries it; Host restores wrapper signal
        setTimeout(() => fireVector(ctx, 'shadow-mid', 'g1a-eq3', 'eq3', 0), 120).unref()
        const res = await ctx.tools.execute(base('eq3', { delayMs: 400 }))
        const s = state.settled.get('g1a-eq3')
        out.code = codeOf(res)
        out.extra = { signalRestored: s?.signalRestored ?? null, guardPost: s?.post ?? null }
        clearShadows()
      } else if (kind === 'eq4') { // synchronous swap INSIDE the guard→dispatch window (fence2) → Host :1572 prevents body
        const res = await ctx.tools.execute(base('eq4', { mode: 'swap-in-window' }))
        out.code = codeOf(res)
      } else if (kind === 'eq5') { // post-execute VALUE replacement under schema parity (binding stays A)
        oncePost(async () => ({ kind: 'accept', value: { ran: true, tag: 'eq5', failed: [], note: 'G1A-VALUE-REPLACED' } }))
        const res = await ctx.tools.execute(base('eq5'))
        out.code = codeOf(res)
        out.extra = { valueNote: res?.value?.note ?? null }
      } else if (kind === 'eq6a') { // replacement validated + rendered against the THEN-LIVE swapped (schema-identical) binding
        oncePost(async () => {
          swapTo(ctx, DEFINITION_B, 'post-eq6a')
          return { kind: 'accept', value: { ran: true, tag: 'eq6a', failed: [], note: 'G1A-VALUE-REPLACED-VIA-B' } }
        })
        const res = await ctx.tools.execute(base('eq6a'))
        out.code = codeOf(res)
        out.extra = { valueNote: res?.value?.note ?? null, contentHead: String(res?.content?.[0]?.text ?? '').slice(0, 40) }
        restoreA(ctx, 'post-eq6a')
      } else if (kind === 'eq6b') { // replacement re-resolves the DIVERGENT live binding → INVALID_TOOL_OUTPUT (condition-4 hazard)
        oncePost(async () => {
          swapTo(ctx, DEFINITION_B_DIV, 'post-eq6b')
          return { kind: 'accept', value: { ran: true, tag: 'eq6b', failed: [] } }
        })
        const res = await ctx.tools.execute(base('eq6b'))
        out.code = codeOf(res)
        out.extra = { msgHead: String(res?.content?.[0]?.text ?? '').slice(0, 80) }
        restoreA(ctx, 'post-eq6b')
      } else if (kind === 'eq7') { // post-execute BLOCK on a governed name → isError with the feedback
        oncePost(async () => ({ kind: 'block', feedback: [{ type: 'text', text: 'G1A-POST-BLOCKED eq7' }] }))
        const res = await ctx.tools.execute(base('eq7'))
        out.code = codeOf(res)
        out.extra = { msgHead: String(res?.content?.[0]?.text ?? '').slice(0, 80) }
      } else if (kind === 'fin-eq8') { // finalize/project CAPTURE: created at createExecution (:1407-1439), swap must not move them
        setTimeout(() => fireVector(ctx, 'shadow-mid', 'g1a-fin-eq8', 'fin-eq8', 0), 120).unref()
        const res = await ctx.tools.execute(base('fin-eq8', { delayMs: 300 }))
        out.code = codeOf(res)
        out.extra = { contentHead: String(res?.content?.[0]?.text ?? '').slice(0, 40) }
        clearShadows()
      } else if (kind === 'eq9') { // scheduler executionMode race: classification reads the live binding; a swap between classification and dispatch fails closed at the guard
        const input = base('eq9', { concurrency: 'safe' })
        const m1 = ctx.tools.executionMode(input)
        swapTo(ctx, DEFINITION_B, 'eq9')
        const m2 = ctx.tools.executionMode(base('eq9', { concurrency: 'safe' }, 'g1a-eq9-m2'))
        const res = await ctx.tools.execute(base('eq9', { concurrency: 'safe' }, 'g1a-eq9-run'))
        restoreA(ctx, 'eq9')
        out.code = codeOf(res)
        out.extra = { modeBefore: m1?.kind ?? '?', modeAfterSwap: m2?.kind ?? '?' }
      } else if (kind === 'eq10') { // NESTED transport-style sub-dispatch: public parent token (index.ts:316-349), same guard + Host path
        const res = await ctx.tools.execute({
          callId: 'g1a-eq10-inner', rootCallId: exec.rootCallId, name: TARGET,
          arguments: { tag: 'eq10', mode: 'stable' }, agent, parent: exec.token, signal: exec.signal,
        })
        out.code = codeOf(res)
      } else if (kind === 'eq11') { // nested NEGATIVE: swap lands before the nested dispatch → guard vetoes the nested call
        swapTo(ctx, DEFINITION_B, 'eq11')
        const res = await ctx.tools.execute({
          callId: 'g1a-eq11-inner', rootCallId: exec.rootCallId, name: TARGET,
          arguments: { tag: 'eq11', mode: 'stable' }, agent, parent: exec.token, signal: exec.signal,
        })
        restoreA(ctx, 'eq11')
        out.code = codeOf(res)
      } else {
        out.code = 'UNKNOWN-KIND'
      }
    } catch (error) {
      out.threw = String(error?.message ?? error)
    }
    record(out)
    return out
  }

  // ── CTL (management plane; not governed) ────────────────────────────────────
  ctx.effect(() => ctx.tools.register({
    name: CTL,
    description: 'G1A test control. Actions: status | regen-same | shadow-on | shadow-off | restrict-on | restrict-off | arm | guard-off | guard-on | ctlguard-off | ctlguard-on | govern-self | bind-late | unbind-late | equiv | heal | settle.',
    parameters: {
      type: 'object',
      properties: { action: { type: 'string' }, kind: { type: 'string' }, delayMs: { type: 'number' }, autoRestoreMs: { type: 'number' }, tag: { type: 'string' } },
      required: ['action'],
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean' }, action: { type: 'string' }, state: { type: 'string' } }, required: ['ok', 'action'] },
      render: (args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    execute: async (args, exec) => {
      const action = String(args?.action ?? '')
      const callId = String(exec?.callId ?? 'unknown')
      const tag = typeof args?.tag === 'string' ? args.tag : ''
      if (exec?.agent !== undefined) state.lastAgent = exec.agent
      const agentCtx = state.lastAgent?.ctx
      let detail = ''
      let ok = true
      try {
        if (action === 'status') detail = JSON.stringify({ guardEnabled: state.guardEnabled, ctlGuardEnabled: state.ctlGuardEnabled, currentGlobal: state.currentGlobal, armed: state.armed.size, pendingArms: state.pendingArms.length, governed: state.governedAgents.size, agentCaptured: state.lastAgent !== undefined })
        else if (action === 'equiv') { const r = await runEquiv(String(args?.kind ?? ''), exec); detail = JSON.stringify({ kind: r.kind, code: r.code, threw: r.threw ?? null, ...r.extra }); ok = r.threw === undefined }
        else if (action === 'regen-same') { const retire = state.globalDispose; state.globalDispose = undefined; try { retire?.() } catch { /* regen proceeds */ } state.globalDispose = ctx.tools.register(DEFINITION_A); state.currentGlobal = 'A'; detail = 're-registered-same-object' }
        else if (action === 'shadow-on') { const t = scopedTools(agentCtx); if (t?.register === undefined) throw new Error('agent scoped tools unavailable'); clearShadows(); state.shadowDisposer = t.register(DEFINITION_B); detail = 'shadow-added' }
        else if (action === 'shadow-off') { state.shadowDisposer?.(); state.shadowDisposer = undefined; detail = 'shadow-removed' }
        else if (action === 'restrict-on') { const t = scopedTools(agentCtx); if (t?.restrict === undefined) throw new Error('agent scoped tools.restrict unavailable'); state.restrictDisposer = t.restrict({ deny: [TARGET] }); detail = 'restricted' }
        else if (action === 'restrict-off') { state.restrictDisposer?.(); state.restrictDisposer = undefined; detail = 'restriction-lifted' }
        else if (action === 'arm') { state.pendingArms.push({ kind: String(args?.kind ?? ''), delayMs: Number(args?.delayMs ?? 0), autoRestoreMs: Number(args?.autoRestoreMs ?? 0) }); detail = `armed:${String(args?.kind ?? '')}` }
        else if (action === 'guard-off') { state.guardEnabled = false; detail = 'guard-off' }
        else if (action === 'guard-on') { state.guardEnabled = true; detail = 'guard-on' }
        else if (action === 'ctlguard-off') { state.ctlGuardEnabled = false; detail = 'ctlguard-off' }
        else if (action === 'ctlguard-on') { state.ctlGuardEnabled = true; detail = 'ctlguard-on' }
        else if (action === 'govern-self') { if (exec?.agent === undefined) throw new Error('no agent'); state.governedAgents.add(exec.agent); detail = `governed=${state.governedAgents.size}` }
        else if (action === 'bind-late') { state.approved.set(TARGET, { def: LATE_DEF, executeFn: LATE_DEF.execute }); detail = 'bound-to-late' }
        else if (action === 'unbind-late') { state.approved.set(TARGET, { def: DEFINITION_A, executeFn: DEFINITION_A.execute }); detail = 'bound-to-A' }
        else if (action === 'heal') {
          clearShadows()
          dropAllPost()
          state.pendingArms.length = 0
          state.restrictDisposer?.(); state.restrictDisposer = undefined
          let seen
          try { seen = ctx.tools.get(TARGET, exec.agent ?? state.lastAgent) } catch { seen = undefined }
          if (seen !== DEFINITION_A) {
            try { state.globalDispose?.() } catch { /* reassert below decides */ }
            state.globalDispose = ctx.tools.register(DEFINITION_A)
            state.currentGlobal = 'A'
            try { seen = ctx.tools.get(TARGET, exec.agent ?? state.lastAgent) } catch { seen = undefined }
          }
          state.approved.set(TARGET, { def: DEFINITION_A, executeFn: DEFINITION_A.execute })
          ok = seen === DEFINITION_A
          detail = ok ? 'healed-clean' : 'heal-dirty'
        }
        else if (action === 'settle') detail = `settle:${tag}`
        else { ok = false; detail = `unknown action ${action}` }
      } catch (error) { ok = false; detail = String(error?.message ?? error) }
      record({ leg: 'ctl', action, kind: String(args?.kind ?? ''), ok, detail, callId, tag })
      return { ok, action, state: detail }
    },
  }), 'g1fa-register-ctl')
}
