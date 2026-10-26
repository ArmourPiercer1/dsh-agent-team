/**
 * u6-arc-d-probe-host.mjs — the U6 PR6 ARC-D C2 probe row (test-only).
 *
 * Mounts the SAME probe family PR5 shipped (imported through the env
 * public-seam URLs like the ARC-A row — zero new family code is the point:
 * the adversarial legs attack the family AS SHIPPED) and answers one tool,
 * `u6arcd_probe`, whose actions ARE the live legs:
 *
 *   walk       — the family's full walk (plan -> one-shot consume ->
 *                marker write); the positive control, the replay attack
 *                (SAME grantId, different callId) and the post-teardown
 *                call all ride it.
 *   spoof      — the walk asked to run under a SELF-REPORTED foreign scope:
 *                the (scope, name) table answers nothing there, the walk
 *                refuses, no marker.
 *   swap       — the walk carrying a self-moved definition identity: the
 *                kernel answers IDENTITY_MISMATCH, no marker. The live
 *                sensitivity pair is the POSITIVE walk: same mount, same
 *                body, same marker machinery — only the identity differs.
 *                (A guard-OFF twin is NOT this family's to offer: a shadow
 *                kernel still computes refuse verdicts, and the family's
 *                walk enforces its own kernel whatever the mode. The
 *                unguarded twin lives at the offline C1 seams — the
 *                f_plant/p5a legs — where the guard genuinely is off.)
 *   unbound    — decide() for a name that was never bound: never 'allow'.
 *   teardown   — drain -> tombstone -> release, honest settle.
 *   report     — the family's own faces (state, generation, approval).
 *
 * The oracle is DISK (marker dir) + LEDGER (JSONL); the transcript is never
 * evidence. Seam-resolution law identical to the ARC-A row's: the row
 * imports nothing private, the family resolves its two public seams
 * (governance-center, contracts) at the dist faces world-factory pins.
 *
 * @module tests/world-factory/canary/u6-arc-d-probe-host
 */
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export const name = 'u6-arc-d-probe-host'
export const inject = ['tools']

const LEDGER = process.env['U6ARCD_LEDGER'] ?? ''
const MARKER_DIR = process.env['U6ARCD_MARKER_DIR'] ?? ''
const WORLD = process.env['U6ARCD_WORLD'] ?? 'unknown'
const ASSEMBLY_URL = process.env['U6ARCD_ASSEMBLY_URL'] ?? ''

// The PR5 family resolves its OWN two public seams under the U6ARC_* names
// (probe-assembly.mjs / probe-contribution.mjs). The ARC-D world's factory
// sets both spellings; this bridge makes the row self-contained: when the
// U6ARCD_* seam names are present they win, so the row works with either
// spelling without the Host needing to know which module reads which.
const CENTER_URL = process.env['U6ARCD_CENTER_URL'] ?? ''
const CONTRACTS_URL = process.env['U6ARCD_CONTRACTS_URL'] ?? ''
if (CENTER_URL !== '') process.env['U6ARC_CENTER_URL'] = CENTER_URL
if (CONTRACTS_URL !== '') process.env['U6ARC_CONTRACTS_URL'] = CONTRACTS_URL

function record(row) {
  if (LEDGER === '') return
  try {
    mkdirSync(dirname(LEDGER), { recursive: true })
    appendFileSync(LEDGER, JSON.stringify({ at: new Date().toISOString(), world: WORLD, ...row }) + '\n')
  } catch {
    /* best-effort: the markers are the hard channel */
  }
}
const slug = (v) => String(v ?? 'untagged').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80)

const { createU6ProbeAssembly } = await import(ASSEMBLY_URL)

/** ONE enforcing mount per host process — the attacked family AS PR5 SHIPPED
 *  (mode 'enforcing', one scopeKey, bind-ONCE). No second mount: a shadow
 *  assembly would REFUSE the same walks it is asked to "blind" (the kernel
 *  computes refuse verdicts in every mode and the family's walk enforces its
 *  own kernel), so it could only masquerade as a passing sensitivity plant.
 *  The unguarded twins live at the offline C1 seams, not here. */
let fam = null

const probeDefinition = {
  name: 'u6arcd_probe',
  description: 'U6 PR6 ARC-D probe tool. Arguments: { action: "walk" | "spoof" | "swap" | "unbound" | "teardown" | "report", callId?: string, grantId?: string, nonce?: string, identity?: string }.',
  parameters: {
    type: 'object',
    properties: { action: { type: 'string' }, callId: { type: 'string' }, grantId: { type: 'string' }, nonce: { type: 'string' }, identity: { type: 'string' } },
    required: ['action'],
  },
  // Host register law (measured runs u6arca1-3, kept by this row): a tool
  // must declare `output { schema, render }` and the supported-JSON-schema
  // assertion — type ARRAYS are not supported, so nullable legs OMIT the
  // field instead of carrying null. Same face as the ARC-A probe tool.
  output: {
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        action: { type: 'string' }, ok: { type: 'boolean' },
        stage: { type: 'string' }, code: { type: 'string' },
        marker: { type: 'string' }, settled: { type: 'boolean' },
        refused: { type: 'boolean' }, outcome: { type: 'string' }, state: { type: 'string' },
      },
      required: ['action', 'ok'],
    },
    render: (args, value) => [{ type: 'text', text: JSON.stringify(value) }],
  },
  execute: async (args) => {
    const action = String(args?.action ?? '')
    const callId = slug(args?.callId)
    const grantId = slug(args?.grantId)
    const nonce = slug(args?.nonce)
    const identity = slug(args?.identity)
    if (fam === null) {
      record({ leg: 'walk-refused', action, callId, code: 'FAMILY_NOT_MOUNTED' })
      return { action, ok: false, code: 'FAMILY_NOT_MOUNTED' }
    }
    if (action === 'walk') {
      const r = await fam.walk({ callId, grantId: grantId === '' ? undefined : grantId, nonce })
      record({ leg: 'walk', action: 'walk', callId, grantId, ok: r.ok, stage: r.stage, code: r.code ?? null, markerFile: r.markerFile ?? null })
      return { action: 'walk', ok: r.ok, ...(r.stage ? { stage: r.stage } : {}), ...(r.code ? { code: String(r.code) } : {}), ...(r.markerFile ? { marker: r.markerFile } : {}) }
    }
    if (action === 'spoof') {
      // The scope claim: the CALL carries a self-reported foreign scopeKey.
      // The family table binds (boundScope, name) — the claimed scope holds
      // no entry, the walk refuses before the body, no marker.
      const r = await fam.walk({ callId, nonce, scopeKey: `spoofed-scope-${callId}` })
      record({ leg: 'walk', action: 'spoof', callId, ok: r.ok, stage: r.stage, code: r.code ?? null, markerFile: r.markerFile ?? null })
      return { action: 'spoof', ok: r.ok, ...(r.code ? { code: String(r.code) } : {}), refused: r.ok !== true }
    }
    if (action === 'swap') {
      // The walk carries a definition identity the table never bound — the
      // live-definition swap plant in family terms. The kernel refuses
      // (IDENTITY_MISMATCH) and NO marker lands; the positive walk above is
      // the sensitivity pair: same mount, same body, only the identity
      // differs.
      const r = await fam.walk({ callId, nonce, identity: identity === '' ? 'def#moved-under-swap' : identity })
      record({ leg: 'walk', action: 'swap', callId, ok: r.ok, stage: r.stage, code: r.code ?? null, markerFile: r.markerFile ?? null })
      return { action: 'swap', ok: r.ok, ...(r.code ? { code: String(r.code) } : {}), ...(r.markerFile ? { marker: r.markerFile } : {}), refused: r.ok !== true }
    }
    if (action === 'unbound') {
      // The never-bound-name leg: the kernel is asked about a name the
      // family NEVER declared — the (scope, name) table answers nothing.
      // 'allow' here would be the FAILURE of this leg; the runner judges
      // outcome !== 'allow' AND zero markers for the callId.
      const v = fam.kernel.decide({ nativeName: 'u6arcd_probe_unbound', scopeKey: 'u6arcd-host', definitionIdentity: 'def#unbound' })
      record({ leg: 'walk', action: 'unbound', callId, ok: false, stage: 'plan', code: String(v.code), outcome: v.outcome })
      return { action: 'unbound', ok: true, refused: true, outcome: String(v.outcome), code: String(v.code) }
    }
    if (action === 'teardown') {
      const r = fam.teardown()
      record({ leg: 'teardown', ok: r.ok === true, code: r.code ?? null })
      return { action: 'teardown', ok: r.ok === true, settled: r.ok === true }
    }
    if (action === 'report') {
      const f = fam.faces()
      record({ leg: 'report', state: f.state, familyIds: f.familyIds })
      return { action: 'report', ok: true, state: String(f.state) }
    }
    return { action: action === '' ? 'unknown' : action.slice(0, 32), ok: false, code: 'UNKNOWN_ACTION' }
  },
}

// R-U6P6-1 — the live deny-change lane (the d_restrict_veto / d_lift_control
// pair). `tools.restrict` on the CALLING agent's scoped tools is the very
// mask lane the Team glue drives for builtinToolDeny (applyBuiltInToolDeny ->
// agentCtx.tools.restrict({deny})); g1fa measured this lane live on the same
// pinned host (restrict -> target veto 'not-visible' + zero effect; dispose ->
// success). Here it masks the built-in `bash` on the ROOT lane while the
// suite's pair legs measure the disk on both sides of the change. The
// disposer lives in module state: one pair per run, ordered by the runner.
// The masked set is the pair leg's EFFECT channel: the builtin bash (the
// builtinToolDeny twin shape) AND the pair's effect writer tool below — so
// the deny leg is a typed refusal AND a zero-effect, and the lift leg
// executes for real (arc-d-u7arc2 measured: the confined provider refuses
// every bash workspace write on this pin, so the effect writer is the
// plugin's fs — the ONE writer measured able to land a world file).

// The pair effect writer (R-U6P6-1, arc-d-u7arc2 law): writes the leg's
// marker through the plugin's own fs — the writer measured ABLE to land a
// world file (the pos markers land every boot). Masked by the restrict
// seam on the CALLER, exactly like the builtin bash: masked → typed
// refusal and NO disk effect; unmasked → the file lands and the oracle
// reads it back. Same tool, same path, same marker shape on both legs;
// the mask is the only difference.
const pairEffectDefinition = {
  name: 'u6arcd_pair_effect',
  description: 'U6 ARC-D pair effect writer (R-U6P6-1). Arguments: { path, marker }. Writes marker to path and records a durable row. Under a tools.restrict mask this call must be refused before any write.',
  parameters: {
    type: 'object',
    properties: { path: { type: 'string' }, marker: { type: 'string' } },
    required: ['path', 'marker'],
  },
  output: {
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: { ok: { type: 'boolean' }, wrote: { type: 'boolean' }, error: { type: 'string' } },
      required: ['ok'],
    },
    render: (args, value) => [{ type: 'text', text: JSON.stringify(value) }],
  },
  execute: async (args) => {
    const path = String(args?.path ?? '')
    const marker = String(args?.marker ?? '')
    try {
      // The writers' own contract: only the run-unique pair markers to a
      // FLAT world-workspace path — never a general-purpose file write.
      if (!/^[A-Za-z0-9_./-]+\.txt$/.test(path) || !/^U6ARCD_PAIR_(DENY|LIFT)_[A-Za-z0-9-]+$/.test(marker)) throw new Error('PAIR_EFFECT_ARGS')
      writeFileSync(path, `${marker}\n`)
      record({ leg: 'pair-effect', marker, pathTail: path.split('/').slice(-1)[0], ok: true })
      return { ok: true, wrote: true }
    } catch (error) {
      record({ leg: 'pair-effect', marker, pathTail: path.split('/').slice(-1)[0], ok: false, error: String(error?.message ?? error).slice(0, 140) })
      return { ok: false, wrote: false, error: 'PAIR_EFFECT_FAILED' }
    }
  },
}

const MASKED_BUILTIN = ['bash', 'u6arcd_pair_effect']
let restrictDisposer

const governDefinition = {
  name: 'u6arcd_govern',
  description: 'U6 PR6 ARC-D live deny-change control (R-U6P6-1). Arguments: { action: "restrict-on" | "restrict-off" | "status" }. Applies/disposes a tools.restrict mask over the CALLING agent (the builtinToolDeny mask lane).',
  parameters: {
    type: 'object',
    properties: { action: { type: 'string' } },
    required: ['action'],
  },
  output: {
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: { ok: { type: 'boolean' }, action: { type: 'string' }, detail: { type: 'string' } },
      required: ['ok', 'action'],
    },
    render: (args, value) => [{ type: 'text', text: JSON.stringify(value) }],
  },
  execute: async (args, exec) => {
    const action = String(args?.action ?? '')
    // The g1fa scopedTools law verbatim: the CALLING agent's ctx, with the
    // get('tools') fallback — never the plugin's own mount ctx.
    const c = exec?.agent?.ctx
    let scoped
    if (c !== undefined && c !== null) scoped = (c.tools !== undefined && c.tools !== null) ? c.tools : (() => { try { return c.get?.('tools') } catch { return undefined } })()
    let ok = true
    let detail = ''
    try {
      if (action === 'restrict-on') {
        if (scoped?.restrict === undefined) throw new Error('agent scoped tools.restrict unavailable')
        restrictDisposer = scoped.restrict({ deny: [...MASKED_BUILTIN] })
        detail = `restricted:${MASKED_BUILTIN.join(',')}`
      } else if (action === 'restrict-off') {
        restrictDisposer?.()
        restrictDisposer = undefined
        detail = 'restriction-lifted'
      } else if (action === 'status') {
        detail = JSON.stringify({ restricted: restrictDisposer !== undefined, masked: MASKED_BUILTIN })
      } else {
        ok = false
        detail = 'UNKNOWN_ACTION'
      }
    } catch (error) {
      ok = false
      detail = String(error?.message ?? error).slice(0, 200)
    }
    // The DURABLE witness row (JSONL, not the transcript): every restrict
    // transition lands here with its own ok; the judge reads these rows.
    record({ leg: 'govern', action, ok, detail, agentCaptured: exec?.agent !== undefined })
    return { ok, action, ...(detail === '' ? {} : { detail }) }
  },
}

export function apply(ctx) {
  record({ leg: 'plugin-apply', pid: process.pid })
  try {
    fam = createU6ProbeAssembly({ markerDir: MARKER_DIR, scopeKey: 'u6arcd-host', mode: 'enforcing' })
    const bound = fam.bindApproval()
    record({ leg: 'family-mount', ok: bound.ok === true, state: fam.kernel.state() })
  } catch (error) {
    fam = null
    record({ leg: 'family-mount', ok: false, error: String(error?.message ?? error).slice(0, 300) })
  }
  ctx.effect(() => {
    let dispose
    let governDispose
    try {
      dispose = ctx.tools.register(probeDefinition)
      record({ leg: 'register', kind: 'probe-tool', ok: true })
    } catch (error) {
      record({ leg: 'register', kind: 'probe-tool', ok: false, error: String(error?.message ?? error).slice(0, 300) })
      return () => {}
    }
    try {
      governDispose = ctx.tools.register(governDefinition)
      record({ leg: 'register', kind: 'govern-tool', ok: true })
    } catch (error) {
      record({ leg: 'register', kind: 'govern-tool', ok: false, error: String(error?.message ?? error).slice(0, 300) })
    }
    let pairEffectDispose
    try {
      pairEffectDispose = ctx.tools.register(pairEffectDefinition)
      record({ leg: 'register', kind: 'pair-effect-tool', ok: true })
    } catch (error) {
      record({ leg: 'register', kind: 'pair-effect-tool', ok: false, error: String(error?.message ?? error).slice(0, 300) })
    }
    return () => {
      try {
        pairEffectDispose?.()
        record({ leg: 'unregister', kind: 'pair-effect-tool', ok: true })
      } catch { /* unwind */ }
      try {
        dispose()
        record({ leg: 'unregister', kind: 'probe-tool', ok: true })
      } catch { /* unwind */ }
      try {
        governDispose?.()
        record({ leg: 'unregister', kind: 'govern-tool', ok: true })
      } catch { /* unwind */ }
      // Mount hygiene (g1fa's teardown law): a mask that outlived its legs
      // dies with the mount, never with the world.
      try { restrictDisposer?.(); restrictDisposer = undefined } catch { /* already gone */ }
      // The FAMILY settles with its mount: an unload never strands the
      // kernel (drain -> tombstone -> release is idempotent-safe here).
      if (fam !== null) {
        const r = fam.teardown()
        record({ leg: 'unload-settle', ok: r.ok === true })
      }
    }
  }, 'u6-arc-d-probe-tool')
}
