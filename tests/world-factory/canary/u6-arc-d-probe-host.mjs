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
import { appendFileSync, mkdirSync } from 'node:fs'
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
    try {
      dispose = ctx.tools.register(probeDefinition)
      record({ leg: 'register', kind: 'probe-tool', ok: true })
    } catch (error) {
      record({ leg: 'register', kind: 'probe-tool', ok: false, error: String(error?.message ?? error).slice(0, 300) })
      return () => {}
    }
    return () => {
      try {
        dispose()
        record({ leg: 'unregister', kind: 'probe-tool', ok: true })
      } catch { /* unwind */ }
      // The FAMILY settles with its mount: an unload never strands the
      // kernel (drain -> tombstone -> release is idempotent-safe here).
      if (fam !== null) {
        const r = fam.teardown()
        record({ leg: 'unload-settle', ok: r.ok === true })
      }
    }
  }, 'u6-arc-d-probe-tool')
}
