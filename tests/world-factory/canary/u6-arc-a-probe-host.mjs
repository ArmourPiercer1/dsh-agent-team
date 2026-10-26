/**
 * u6-arc-a-probe-host.mjs — the U6 PR5 ARC-A C2 probe row (test-only).
 * Mounts the ARC-A PROBE FAMILY (the very lane `tests/u6-arc-a-probe-family/`
 * ships, imported through env-provided public-seam URLs — the Host world
 * resolves governance-center and contracts at their SHIPPED dist faces) on
 * a REAL Host, and answers one governed-by-its-own-kernel tool:
 * `u6arc_probe`. Every call runs the family's full walk (plan -> one-shot
 * consume -> marker write); the refusals (no entry, replayed grant, calls
 * after the family's own unload) return BEFORE the body.
 *
 * THE ORACLE IS DISK: the marker dir and the JSONL ledger. The model
 * transcript is never evidence. The negative legs' law is the ABSENCE of a
 * marker file, the positive leg's law is the nonce INSIDE the file.
 *
 * Seam-resolution disclosure (slice-plan §10.5): the row imports nothing
 * private — `U6ARC_ASSEMBLY_URL` is the lane's own public assembly module;
 * the lane resolves its two public seams (governance-center, contracts) at
 * the dist files the production glue itself imports (world-factory sets
 * `U6ARC_CENTER_URL` / `U6ARC_CONTRACTS_URL`). Zero center diff means the
 * HOST needs no knowledge of this family — the row is a profile-patch row
 * exactly like the canary and the PR2/PR3 probes.
 *
 * @module tests/world-factory/canary/u6-arc-a-probe-host
 */
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const name = 'u6-arc-a-probe-host'
export const inject = ['tools']

const LEDGER = process.env['U6ARC_LEDGER'] ?? ''
const MARKER_DIR = process.env['U6ARC_MARKER_DIR'] ?? ''
const WORLD = process.env['U6ARC_WORLD'] ?? 'unknown'
const ASSEMBLY_URL = process.env['U6ARC_ASSEMBLY_URL'] ?? ''

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

/** ONE family mount per host process; the walk legs share it (one kernel,
 *  one ledger — the ARC-A claim is about the FAMILY's lifecycle, and the
 *  family owns exactly one mount, like every product family). */
let fam = null

const probeDefinition = {
  name: 'u6arc_probe',
  description: 'U6 PR5 ARC-A probe family tool. Arguments: { action: "walk" | "unbound" | "teardown" | "report", callId?: string, grantId?: string, nonce?: string }.',
  parameters: {
    type: 'object',
    properties: { action: { type: 'string' }, callId: { type: 'string' }, grantId: { type: 'string' }, nonce: { type: 'string' } },
    required: ['action'],
  },
  // Host register law (measured run u6arca1): a tool must declare
  // `output { schema, render }` — the same face the fs probe row carries.
  // Host register law (measured runs u6arca1-3): `output { schema, render }`
  // AND the supported-JSON-schema assertion — type ARRAYS are not
  // supported, so nullable legs OMIT the field instead of carrying null.
  output: {
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        action: { type: 'string' }, ok: { type: 'boolean' },
        stage: { type: 'string' }, code: { type: 'string' },
        marker: { type: 'string' }, settled: { type: 'boolean' },
        refused: { type: 'boolean' }, outcome: { type: 'string' },
        state: { type: 'string' },
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
    if (fam === null) {
      record({ leg: 'walk-refused', action, callId, code: 'FAMILY_NOT_MOUNTED' })
      return { action, ok: false, code: 'FAMILY_NOT_MOUNTED' }
    }
    if (action === 'walk') {
      const r = await fam.walk({ callId, grantId: grantId === '' ? undefined : grantId, nonce })
      record({ leg: 'walk', action: 'walk', callId, grantId, ok: r.ok, stage: r.stage, code: r.code ?? null, markerFile: r.markerFile ?? null })
      return { action: 'walk', ok: r.ok, ...(r.stage ? { stage: r.stage } : {}), ...(r.code ? { code: String(r.code) } : {}), ...(r.markerFile ? { marker: r.markerFile } : {}) }
    }
    if (action === 'unbound') {
      // The no-approval-entry leg: the kernel is asked about a name the
      // family NEVER declared — the (scope, name) table answers nothing,
      // the door refuses, and NO body runs. Refusal shape is family-blind.
      const v = fam.kernel.decide({ nativeName: 'u6arc_probe_unbound', scopeKey: 'u6arca-host', definitionIdentity: 'def#unbound' })
      // 'allow' here would be the FAILURE of this leg; the runner judges
      // outcome !== 'allow' AND zero markers for the callId.
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
  record({ leg: 'plugin-apply', pid: process.pid, hasTools: (() => { try { return typeof ctx?.tools?.register === 'function' } catch (e) { return `threw ${String(e?.message).slice(0, 80)}` } })() })
  try {
    fam = createU6ProbeAssembly({
      markerDir: MARKER_DIR,
      scopeKey: 'u6arca-host',
      mode: 'enforcing',
    })
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
  }, 'u6-arc-a-probe-tool')
}
