#!/usr/bin/env node
/**
 * compare-two-runs.mjs — PD-39 lane, 2026-11-12.
 *
 * Field-by-field comparator for the TWO authoritative real-Host runs of the
 * Inbox ACCEPTED-but-not-CLAIMED window (`run-1`, `run-2`). It reads each
 * run's `a6-inbox-unclaimed.json` / `a6-inbox-unclaimed-before.json` plus the
 * DURABLE Team-domain ledger the run kept (`tests/homes/<stamp>/storages/
 * team_domain.json`), normalizes per-run identity (request ids, session
 * stamps, timestamps), and prints an AGREE/DIFFER row per field.
 *
 * Exit 0 = every asserted field agrees; 1 = at least one differs.
 *
 * Deliberately narrow: it compares the facts this lane asserts (window,
 * claim counts, wake-intent rows, pending count, by-id discoverability,
 * operator resolve, abandonments, duplicates, verdict), not incidental
 * ordering/timestamps.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const WORKTREE = join(here, '..', '..', '..', '..')

const norm = (value, ctx) => {
  if (typeof value === 'string') {
    let out = value
    if (ctx.requestId) out = out.split(ctx.requestId).join('<requestId>')
    if (ctx.stamp) out = out.split(ctx.stamp).join('<stamp>')
    out = out.replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, '<ts>')
    return out
  }
  if (Array.isArray(value)) return value.map((v) => norm(v, ctx))
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, norm(v, ctx)]))
  }
  return value
}

const loadRun = (name) => {
  const dir = join(here, name)
  const after = JSON.parse(readFileSync(join(dir, 'a6-inbox-unclaimed.json'), 'utf8'))
  const before = JSON.parse(readFileSync(join(dir, 'a6-inbox-unclaimed-before.json'), 'utf8'))
  const manifest = JSON.parse(readFileSync(join(dir, 'run-manifest.json'), 'utf8'))
  const stamp = String(manifest.runId)
  const home = join(WORKTREE, 'tests', 'homes', `c1-smoke-${stamp}`)
  const store = JSON.parse(readFileSync(join(home, 'storages', 'team_domain.json'), 'utf8'))
  const ledger = Object.entries(store.tables.ledger)
    .filter(([k]) => !k.startsWith('__'))
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([sequence, raw]) => ({ sequence: Number(sequence), ...JSON.parse(raw) }))
  const control = ledger.filter((row) => String(row.factType).startsWith('control'))
  const requestId = control.find((row) => row.factType === 'control-request-recorded')?.payload?.requestId ?? ''
  const wakeDir = join(home, 'alpha6-wake-intents')
  const wakeIntentRows = existsSync(wakeDir)
    ? readdirSync(wakeDir).filter((n) => n.startsWith('wake-') || n.startsWith('stopped-')).length
    : 0
  return { after, before, control, requestId, stamp, wakeIntentRows }
}

const fields = (run) => {
  const { after, before, control, requestId, wakeIntentRows } = run
  const recovery = after.discoveryAfter?.recovery
  return {
    window: after.window,
    busySeen: after.busySeen,
    wakeIntentRowsBefore: before.wakeRows.length,
    wakeIntentRowsAfterRestart: after.rowsAfterRestart.length,
    wakeIntentRowsAfterDrain: after.rowsAfterDrain.length,
    wakeTurnsBeforeKill: before.wakeTurnsBefore,
    claimedWakeTurnsAfterRestart: after.claimedWakeTurnsAfterRestart,
    duplicateClaims: after.claimedWakeTurnsAfterRestart,
    pendingBefore: before.pendingBefore.length,
    pendingAtRestart: after.pendingAfterRestart.length,
    requestRecorded: control.filter((r) => r.factType === 'control-request-recorded').length,
    decisions: control.filter((r) => r.factType === 'control-decision-recorded').length,
    abandonments: control.filter((r) => r.factType === 'control-request-abandoned').length,
    consumptions: control.filter((r) => r.factType === 'control-allow-consumed').length,
    executionResults: control.filter((r) => r.factType === 'control-execution-result').length,
    pendingControlCount: after.discoveryAfter?.pendingControlCount,
    requestFactVisible: after.discoveryAfter?.requestFactVisible,
    requestIdOccurrences: after.discoveryAfter?.requestIdOccurrences,
    wakeIntentRowsAfterTeardown: wakeIntentRows,
    recoveryStatus: recovery?.status,
    recoveryDecision: recovery?.decision?.decision,
    recoveryDeciderKind: recovery?.decision?.decider?.kind,
    recoveryRequestIdMatches: recovery?.decision?.requestId === requestId,
    verdict: after.verdict,
    acceptable: after.acceptable,
  }
}

const a = loadRun('run-1')
const b = loadRun('run-2')
const fa = fields(a)
const fb = fields(b)
const ctxA = { requestId: a.requestId, stamp: a.stamp }
const ctxB = { requestId: b.requestId, stamp: b.stamp }
const keys = Object.keys(fa)
let differ = 0
const pad = (s, n) => String(s).padEnd(n)
console.log(`${pad('field', 34)} ${pad('run-1', 24)} ${pad('run-2', 24)} verdict`)
for (const key of keys) {
  const va = norm(fa[key], ctxA)
  const vb = norm(fb[key], ctxB)
  const same = JSON.stringify(va) === JSON.stringify(vb)
  if (!same) differ += 1
  console.log(`${pad(key, 34)} ${pad(JSON.stringify(va), 24)} ${pad(JSON.stringify(vb), 24)} ${same ? 'AGREE' : 'DIFFER'}`)
}
console.log(`\n${differ === 0 ? 'TWO-RUN AGREEMENT: field-by-field AGREE' : `TWO-RUN DISAGREEMENT: ${differ} field(s)`}`)
process.exit(differ === 0 ? 0 : 1)
