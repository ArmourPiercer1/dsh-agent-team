/**
 * S1 RUNTIME CENSUS observer (public API only, fixed Host @639ed015). DERIVED with a small diff
 * from the sealed M3 probe (sha256 181fc9a73fc77151f8bb3c232dc3778c9109366869e62403a834cb10c5cf57a3,
 * sealed file byte-untouched above in s1-h0-m3/). Mechanism inherited verbatim: register A,
 * call-#1 swap arm, guard wrapper, call-#2 restored-A control arm.
 *
 * CENSUS QUESTION (root-authorized): inside the RESTORED-A CONTROL call context, one REAL
 * exec.agent reference is passed to the two PUBLIC queries
 *   - ctx.tools.schemas(scope)         (public, packages/core/tools/src/index.ts:1260 @639ed015)
 *   - ctx.tools.get(name, scope)       (public, packages/core/tools/src/index.ts:1230 @639ed015)
 * and the ledger records, via a plugin-owned WeakMap identity tracker (the sealed M3 identityOf,
 * kept verbatim): Definition-object identity, its execute-reference identity, the Scope reference
 * identity used by both calls, rootCallId, and the registered-visible name set.
 *
 * FORBIDDEN and ABSENT from this file (asserted by the launcher preflight byte-scan): the four
 * private tools-registry seams (presentation-mode at :922, private view at :1178, wire projection
 * at :1008, execution-resolution at :1247 — names deliberately not spelled out here so the byte
 * scan over THIS file stays strict), stringification-as-identity, eval/Function, and any
 * monkeypatching of host objects. No other tool body is executed: only the fixture body runs.
 * Identity uses === and the WeakMap tracker only. schemas() rows are DEEP CLONES by contract
 * (:1259 "@returns one deep-cloned schema per visible tool") — their identities are recorded
 * ONLY as row counts/names, never as registration identity; get() returns the live Definition.
 *
 * Kit env: S1C_LEDGER, S1C_MARKER_DIR, S1C_SENTINEL, S1C_SENTINEL_EXPECT, S1C_FENCE_SLEEP_MS.
 * @module dev/agent-workflow/evidence/s1-runtime-census/census-probe-plugin
 */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'

/** Public identity tracker for Definitions returned by ctx.tools.get(). */
const identityIds = new WeakMap()
let nextIdentityId = 1
export function identityOf(definition) {
  if (definition === null || definition === undefined || (typeof definition !== 'object' && typeof definition !== 'function')) return null
  let id = identityIds.get(definition)
  if (id === undefined) { id = `def-${nextIdentityId++}`; identityIds.set(definition, id) }
  return id
}
export const fingerprintOf = identityOf

export const name = 's1c-census-probe'
export const inject = ['tools']

const LEDGER = process.env['S1C_LEDGER'] ?? ''
const MARKER_DIR = process.env['S1C_MARKER_DIR'] ?? ''
const SENTINEL = process.env['S1C_SENTINEL'] ?? ''
const SENTINEL_EXPECT = process.env['S1C_SENTINEL_EXPECT'] ?? ''
const FENCE_SLEEP_MS = Number(process.env['S1C_FENCE_SLEEP_MS'] ?? '150')

const TOOL_NAME = 's1_m1_probe'
const slug = (value) => String(value ?? 'untagged').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80)

function record(row) {
  if (LEDGER === '') return
  try {
    mkdirSync(dirname(LEDGER), { recursive: true })
    appendFileSync(LEDGER, JSON.stringify({ at: new Date().toISOString(), ...row }) + '\n')
  } catch {
    /* a dead ledger is an ORACLE failure (missing row => FAIL), never a silent pass */
  }
}

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms) })

/** Shared valid output schema (identical for A and B — enforced subset, required as ARRAYS). */
const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ran: { type: 'boolean' },
    tag: { type: 'string' },
    failed: { type: 'array', items: { type: 'string' } },
  },
  required: ['ran', 'tag', 'failed'],
}

/** One Definition factory: `bodyId` is the ONLY difference ('A' | 'B'). */
function makeDefinition(bodyId) {
  return {
    name: TOOL_NAME,
    description: `S1 census fixture body ${bodyId}. Arguments: { tag: string }. Writes <body>-<tag>.marker, reads the sentinel once, runs /bin/echo, appends callID-bound ledger rows.`,
    parameters: {
      type: 'object',
      properties: { tag: { type: 'string', description: 'marker/ledger tag for this call' } },
      required: [],
    },
    output: {
      schema: OUTPUT_SCHEMA,
      render: (args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    execute: async (args, exec) => {
      const tag = typeof args?.tag === 'string' ? args.tag : 'untagged'
      const callId = String(exec?.rootCallId ?? 'unknown')
      const s = slug(tag)
      const failed = []
      // Leg marker — the file name itself carries the body identity.
      try {
        mkdirSync(MARKER_DIR, { recursive: true })
        writeFileSync(join(MARKER_DIR, `${bodyId}-${s}.marker`), `${TOOL_NAME} body=${bodyId} tag=${tag} callId=${callId} at ${new Date().toISOString()}\n`)
        record({ leg: 'marker-ran', body: bodyId, callId, tag, ok: true })
      } catch (error) {
        failed.push('marker')
        record({ leg: 'marker-ran', body: bodyId, callId, tag, ok: false, error: String(error?.message ?? error) })
      }
      // Leg read — one read, content must equal the sealed expectation.
      try {
        if (SENTINEL === '' || SENTINEL_EXPECT === '') throw new Error('S1C_SENTINEL / S1C_SENTINEL_EXPECT unset')
        const buf = readFileSync(SENTINEL)
        const got = buf.toString('utf8').trim()
        if (got !== SENTINEL_EXPECT) throw new Error(`sentinel content mismatch (got ${JSON.stringify(got.slice(0, 80))})`)
        record({ leg: 'read-ran', body: bodyId, callId, tag, ok: true, sentinelBytes: buf.length })
      } catch (error) {
        failed.push('read')
        record({ leg: 'read-ran', body: bodyId, callId, tag, ok: false, error: String(error?.message ?? error) })
      }
      // Leg process — controlled /bin/echo, exact expected stdout.
      try {
        const r = spawnSync('/bin/echo', ['s1c-echo', bodyId, s], { encoding: 'utf8' })
        const out = String(r.stdout ?? '').trim()
        if (r.status !== 0) throw new Error(`echo exit ${String(r.status)} signal=${String(r.signal ?? '')}`)
        if (out !== `s1c-echo ${bodyId} ${s}`) throw new Error(`echo stdout mismatch: ${JSON.stringify(out.slice(0, 80))}`)
        record({ leg: 'process-ran', body: bodyId, callId, tag, ok: true, echoOut: out })
      } catch (error) {
        failed.push('process')
        record({ leg: 'process-ran', body: bodyId, callId, tag, ok: false, error: String(error?.message ?? error) })
      }
      const ran = failed.length === 0
      record({ leg: 'body-ran', body: bodyId, callId, tag, ran, failed })
      return { ran, tag, failed }
    },
  }
}

const DEFINITION_A = makeDefinition('A')
const DEFINITION_B = makeDefinition('B')

export function apply(ctx) {
  // Mutable disposer binding: whichever registration is current is the one we own.
  let disposeCurrent
  let currentBody = 'A'
  let fenceCalls = 0
  ctx.effect(() => {
    try {
      disposeCurrent = ctx.tools.register(DEFINITION_A)
    } catch (error) {
      record({ leg: 'register', body: 'A', ok: false, error: String(error?.message ?? error) })
      throw error
    }
    currentBody = 'A'
    record({ leg: 'register', body: 'A', ok: true })
    return () => {
      try { disposeCurrent?.() } finally { disposeCurrent = undefined }
    }
  }, 's1c-probe-register-A')

  // ── Census wrapper 1 (public listener): the M3 guard wrapper VERBATIM (limits inherited). ──
  let guardCalls = 0
  ctx.on('tools/execute', async (exec, next) => {
    if (exec.name !== TOOL_NAME) return next()
    guardCalls += 1
    const callId = String(exec.rootCallId ?? 'unknown')
    const tag = typeof exec.arguments?.tag === 'string' ? exec.arguments.tag : 'untagged'
    let approved
    let incoming = exec.signal
    let controller
    let maybeOff
    let incomingAbortOff
    let watchArmed = true
    let changeSeen = 0
    let abortFired = 0
    let approvedId
    const disposerKind = 'api-disposer'
    const refuse = (reason) => {
      record({ leg: 'guard-refused', callId, tag, reason })
      try { if (typeof maybeOff === 'function') maybeOff() } catch { /* reclaim best effort */ }
      try { if (typeof incomingAbortOff === 'function') incomingAbortOff() } catch { /* reclaim best effort */ }
      try { exec.signal = incoming } catch { /* refusal is fail-closed */ }
      return { isError: true, content: [{ type: 'text', text: `Error: S1C guard refused: ${reason}` }], error: { message: `S1C guard refused: ${reason}`, info: { code: 'S1C_GUARD_REFUSED', reason } } }
    }
    try {
      approved = ctx.tools.get(TOOL_NAME, exec.agent)
      if (approved === undefined || approved === null) throw new Error('tools.get returned nothing')
      approvedId = identityOf(approved)
      record({ leg: 'guard-armed', callId, tag, approvedFp: approvedId, approvedPresent: true })
      controller = new AbortController()
      const onChange = () => {
        if (!watchArmed) return
        changeSeen += 1
        record({ leg: 'guard-change-delivered', callId, tag, delivery: changeSeen })
        try {
          controller.abort(incoming?.reason ?? new DOMException('s1c-guard-change-abort', 'AbortError'))
          abortFired += 1
          record({ leg: 'guard-abort-fired', callId, tag, callerReasonPreserved: incoming?.reason !== undefined && incoming?.reason !== null, reasonName: controller.signal.reason?.name, reasonMessage: controller.signal.reason?.message })
        } catch (error) { record({ leg: 'guard-abort-threw', callId, tag, error: String(error?.message ?? error) }) }
      }
      maybeOff = ctx.on('tools/change', onChange)
      if (typeof maybeOff !== 'function') return refuse('tools/change disposer missing')
      record({ leg: 'guard-watch-installed', callId, tag, disposerKind: 'api-disposer', incomingAlreadyAborted: incoming?.aborted === true })
      const forward = () => controller.abort(incoming?.reason ?? new DOMException('s1c-guard-change-abort', 'AbortError'))
      if (incoming?.addEventListener) { incomingAbortOff = () => incoming.removeEventListener('abort', forward); incoming.addEventListener('abort', forward, { once: true }) }
      if (incoming?.aborted === true) forward()
      exec.signal = controller.signal
      const retained = exec.signal === controller.signal
      record({ leg: 'guard-signal-replaced', callId, tag, retained })
      if (!retained) return refuse('exec.signal write not retained')
    } catch (error) {
      return refuse(`precondition failed: ${String(error?.message ?? error)}`)
    }

    try {
      const result = await next()
      const code = result?.error?.info?.code
      record({
        leg: 'guard-exit', callId, tag, phase: 'settled',
        abortedBeforeDispatch: code === 'ABORTED_BEFORE_DISPATCH',
        resultCode: typeof code === 'string' ? code : 'none',
        isError: result?.isError === true,
      })
      return result
    } catch (error) {
      record({ leg: 'guard-exit', callId, tag, phase: 'threw', error: String(error?.message ?? error) })
      throw error
    } finally {
      watchArmed = false
      let watchDisposed = 'not-attempted'
      try {
        if (typeof maybeOff === 'function') { maybeOff(); watchDisposed = 'called' } else { watchDisposed = 'no-api-disposer' }
      } catch (error) { watchDisposed = `threw:${String(error?.message ?? error)}` }
      try { exec.signal = incoming } catch { /* reported by signalRestored below */ }
      record({
        leg: 'guard-finally', callId, tag, disposerKind, watchDisposed,
        signalRestored: exec.signal === incoming, changeSeen, abortFired,
      })
    }
  })

  // ── Census wrapper 2 (public listener): the M3 fence, VERBATIM except the control arm. ──
  ctx.on('tools/execute', async (exec, next) => {
    if (exec.name !== TOOL_NAME) return next()
    fenceCalls += 1
    const callId = String(exec.rootCallId ?? 'unknown')
    const tag = typeof exec.arguments?.tag === 'string' ? exec.arguments.tag : 'untagged'
    record({ leg: 'fence-enter', callId, tag, fence_call: fenceCalls, body_visible_before: currentBody })

    if (fenceCalls !== 1) {
      // Control arm: no swap. A must be the live definition again (restored in the swap's finally).
      record({ leg: 'fence-control', callId, tag, body_visible_before: currentBody })
      // === CENSUS: ONE real exec.agent reference; schemas(scope), then EVERY actually visible
      // name gets per-item public get(name, same scope ref) + one repeat get for reference
      // consistency. Bodies are NEVER invoked. Fixture-A === calibration is kept but is just
      // one row; it stands in for nothing else. Missing fields/rows must fail the oracle. ===
      if (tag === 'call2' && currentBody === 'A') {
        try {
          const scope = exec.agent                       // the SAME real reference for every call
          const rows = ctx.tools.schemas(scope)          // public :1260 (scope view of visible defs)
          const names = Array.isArray(rows) ? rows.map((r) => (typeof r?.name === 'string' ? r.name : '<noname>')).sort() : null
          const identityRows = []
          if (names !== null) {
            for (const nm of names) {
              const g1 = ctx.tools.get(nm, scope)        // public :1230, same scope reference
              const g2 = ctx.tools.get(nm, scope)        // same-pass repeat: reference consistency
              const present = g1 !== undefined && g1 !== null
              identityRows.push({
                name: nm,
                present,
                defType: present ? typeof g1 : 'absent',
                execType: present ? typeof g1.execute : 'absent',
                defRefId: identityOf(g1),
                execRefId: present && typeof g1.execute === 'function' ? identityOf(g1.execute) : null,
                scopeRefId: identityOf(scope),
                repeatGetSameRef: g1 === g2,
                ...(nm === TOOL_NAME ? { fixtureCalib: { defIsDefinitionA_by_eq: present && g1 === DEFINITION_A, execIsDefinitionAExec_by_eq: present && g1.execute === DEFINITION_A.execute } } : {}),
              })
            }
          }
          record({
            leg: 'census', callId, tag,
            rootCallId: callId,
            scopeRefId: identityOf(scope),
            schemasScopeRefId: identityOf(scope),
            getScopeRefId: identityOf(scope),
            schemasRowsCount: Array.isArray(rows) ? rows.length : -1,
            registeredVisibleNames: names,
            registeredVisibleCount: names === null ? -1 : names.length,
            visibleIncludesFixture: names !== null && names.includes(TOOL_NAME),
            identity_rows: identityRows,
            census_public_calls: ['tools.schemas(scope)', 'tools.get(name,scope) per visible name + one repeat each'],
          })
        } catch (error) {
          record({ leg: 'census-failed', callId, tag, error: String(error?.message ?? error) })
        }
      }
      try {
        const result = await next()
        record({ leg: 'fence-exit', callId, tag, phase: 'control', result: 'settled' })
        return result
      } catch (error) {
        record({ leg: 'fence-exit', callId, tag, phase: 'control', result: 'threw', error: String(error?.message ?? error) })
        throw error
      }
    }

    // Swap arm: async fence, then public unregister A → public register B (same name).
    await sleep(Number.isFinite(FENCE_SLEEP_MS) ? FENCE_SLEEP_MS : 150)
    const retireA = disposeCurrent
    disposeCurrent = undefined
    try { retireA?.() } catch (error) { record({ leg: 'fence-retire-failed', callId, tag, error: String(error?.message ?? error) }) }
    let disposeB
    try {
      disposeB = ctx.tools.register(DEFINITION_B)
      disposeCurrent = disposeB
      currentBody = 'B'
      record({ leg: 'fence-swapped', callId, tag, from: 'A', to: 'B' })
    } catch (error) {
      // Fail closed: put A back and let the dispatch proceed against the known-good A.
      record({ leg: 'fence-swap-failed', callId, tag, error: String(error?.message ?? error) })
      disposeCurrent = ctx.tools.register(DEFINITION_A)
      currentBody = 'A'
    }
    try {
      const result = await next()
      record({ leg: 'fence-exit', callId, tag, phase: 'swap', result: 'settled', body_visible: currentBody })
      return result
    } catch (error) {
      record({ leg: 'fence-exit', callId, tag, phase: 'swap', result: 'threw', error: String(error?.message ?? error) })
      throw error
    } finally {
      // Restore A on every path so the control call runs against the original Definition.
      try { disposeB?.() } catch { /* restoring A below is what the oracle needs */ }
      try {
        disposeCurrent = ctx.tools.register(DEFINITION_A)
        currentBody = 'A'
        record({ leg: 'fence-restored', callId, tag, to: 'A' })
      } catch (error) {
        disposeCurrent = undefined
        currentBody = 'unrestored'
        record({ leg: 'fence-restore-failed', callId, tag, error: String(error?.message ?? error) })
      }
    }
  })
}
