// wait-end-seed.mjs — V2 plan D6 kill->restart recipe helper (refined after
// the scratch smoke, 2026-09-07).
//
// Semantics of session/end-seed (upstream session.md "The end-seed boundary"):
// it is written by a NEW process when it revives/retires a stored session —
// NOT by the killed process at shutdown. The round-1 boot#7 collision chain:
// kill (sessions left open) -> restart#1 revives the open session (end-seed
// appended during revival) -> the team plugin's prepare of the same session
// collides ("cannot prepare session ... while it is live") -> the failing
// process exits and retires the revived session -> restart#2 succeeds.
//
// usage: node wait-end-seed.mjs [sessionId] [timeoutMs=30000]
//
// Run AFTER a failed restart (live collision): it confirms the failed
// process retired the session (end-seed row appended) before you retry.
// Running it before any restart is not the contract — a force-killed host
// leaves no end-seed, so a pre-restart wait would time out by design.
// sessionId defaults to the boot-state root.
// exit 0 = end-seed seen (retired — retry the boot); 1 = timeout.
import { logRows, readBootState, sessionLogPath, sleep } from './common.mjs'

const bootState = (() => { try { return readBootState() } catch { return null } })()
const sessionId = process.argv[2] || bootState?.rootSessionId
const timeoutMs = Number(process.argv[3] || 30_000)
if (!sessionId) { console.error('usage: node wait-end-seed.mjs [sessionId] [timeoutMs=30000]'); process.exit(2) }

const logPath = sessionLogPath(sessionId)
if (!logPath) { console.error(`[wait-end-seed] no durable log found for ${sessionId}`); process.exit(2) }

const start = Date.now()
for (;;) {
  const rows = logRows(logPath)
  const last = rows[rows.length - 1]
  if (last && typeof last.type === 'string' && last.type.includes('end-seed')) {
    console.log(`[wait-end-seed] OK end-seed row: type=${last.type} seq=${last.seq} elapsed=${Date.now() - start}ms — session retired, retry the boot`)
    process.exit(0)
  }
  if (Date.now() - start >= timeoutMs) {
    console.log(`[wait-end-seed] TIMEOUT after ${timeoutMs}ms; last row: type=${last?.type} seq=${last?.seq}`)
    console.log('[wait-end-seed] no end-seed yet — if the failed boot already exited, retry once after a short pause (round-1 recipe)')
    process.exit(1)
  }
  await sleep(1_000)
}
