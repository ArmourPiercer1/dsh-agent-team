/**
 * g1fb-lib.mjs — shared primitives for the G1-F supplement PoC set (executor G1F-SUP-B).
 *
 * Provenance: record()/slug()/sleep() follow the sealed H0 pattern
 * (dev/agent-workflow/evidence/u4-h0-20261025/u4h0-probe-plugin.mjs :58-69);
 * canonicalJson follows the #360 write.mjs canonical-law helper
 * (origin/feat/a5-m2-integration, governed-families/write.mjs :86-91,
 * evaluated by source only — the file itself is not importable here).
 * @module dev/agent-workflow/evidence/u4-g1f-sup-b-20261025/g1fb-lib
 */
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'

export const LEDGER = process.env['G1F_LEDGER'] ?? ''
export const MARKER_DIR = process.env['G1F_MARKER_DIR'] ?? ''
export const WORK_ROOT = process.env['G1F_WORK_ROOT'] ?? ''

/** Ledger append. A dead ledger is an ORACLE failure, never a silent pass. */
export function record(row) {
  if (LEDGER === '') return
  try {
    mkdirSync(dirname(LEDGER), { recursive: true })
    appendFileSync(LEDGER, JSON.stringify({ at: new Date().toISOString(), ...row }) + '\n')
  } catch {
    /* oracle death: missing rows FAIL the run downstream */
  }
}

export function marker(name, text) {
  if (MARKER_DIR === '') return
  try {
    mkdirSync(MARKER_DIR, { recursive: true })
    // Marker NAMES are the independent oracle: one per (case, effect), created
    // only when the effect really happened.
    appendFileSync(join(MARKER_DIR, name), String(text ?? '') + '\n')
  } catch { /* oracle death */ }
}

export const slug = (v) => String(v ?? 'untagged').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80)
export const sleep = (ms) => new Promise((r) => { setTimeout(r, ms) })
export const sha256 = (text) => createHash('sha256').update(String(text), 'utf8').digest('hex')
export const sha256File = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')

/** Canonical JSON with sorted object keys (the #360 canonical law, minimal). */
export const canonicalJson = (value) => JSON.stringify(value, (_k, v) => (
  v !== null && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
    : v
))

/** parametersFingerprint law (#360 write.mjs: sha256 over canonical values). */
export const fingerprint = (args) => sha256(canonicalJson(args ?? {}))

export function readLedger(path) {
  if (path === '' || path === undefined) return []
  let text = ''
  try { text = readFileSync(path, 'utf8') } catch { return [] }
  return text.split('\n').filter((l) => l.trim() !== '').map((l) => { try { return JSON.parse(l) } catch { return { leg: 'unparseable', raw: l.slice(0, 120) } } })
}

/** Typed refusal in the Host's error-result shape (H0 veto shape, own code). */
export function refusal(code, detail) {
  return {
    isError: true,
    content: [{ type: 'text', text: `Error: G1F refused (${code}): ${detail}` }],
    error: { message: `G1F refused (${code}): ${detail}`, info: { code, detail } },
  }
}
