
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { hostname } from 'node:os'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
const spec = JSON.parse(process.argv[2])
const ev = (o) => process.stdout.write(JSON.stringify({ pid: process.pid, atMs: Date.now(), ...o }) + '\n')
const bootId = (() => { try { return readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim() } catch { return '' } })()
const plant = (text) => { const t = spec.lockPath + '.plant-' + process.pid + '.tmp'; writeFileSync(t, text, { mode: 0o600 }); renameSync(t, spec.lockPath) }
const plantRecord = (nonce, token, at) => JSON.stringify({ pid: process.pid, host: hostname(), boot: bootId, nonce, token, at })
if (spec.role === 'hold') {
  // A LIVE holder: plant the record naming OUR (alive) pid and beat. This is
  // a disk-level fixture of the same documented shape production publishes;
  // the code under test is every WAITER (production acquireLock/mayBreak).
  const nonce = 'b49hold-' + randomUUID()
  let i = 0
  let lastToken = 't0-' + randomUUID()
  plant(plantRecord(nonce, lastToken, Date.now()))
  ev({ kind: 'PLANTED', nonce, token: lastToken })
  const timer = setInterval(() => {
    i += 1; lastToken = 't' + i + '-' + randomUUID()
    try { plant(plantRecord(nonce, lastToken, Date.now())) } catch (e) { ev({ kind: 'BEAT-FAIL', error: String((e && e.code) || e) }) }
  }, spec.beatMs)
  setTimeout(() => {
    clearInterval(timer)
    let present = false, mine = false, nonceSeen = null
    try { const rec = JSON.parse(readFileSync(spec.lockPath, 'utf8')); present = true; nonceSeen = rec.nonce; mine = rec.pid === process.pid } catch { /* gone */ }
    ev({ kind: 'RELEASE_CHECK', present, mine, nonceSeen })
    try { if (existsSync(spec.lockPath)) unlinkSync(spec.lockPath) } catch { /* best effort */ }
    ev({ kind: 'RELEASED' })
    // natural exit (exitCode, never process.exit) so the stdout pipe FLUSHES
    process.exitCode = present ? 0 : 3
  }, spec.holdMs)
} else if (spec.role === 'die') {
  // A CRASHED holder: plant naming our pid, then EXIT (the pid really dies).
  const nonce = 'b49die-' + randomUUID()
  const token = 'd0-' + randomUUID()
  plant(plantRecord(nonce, token, Date.now() - (spec.plantAgeMs || 0)))
  ev({ kind: 'PLANTED', nonce, token, exitSoon: true })
  // natural exit flushes the pipe (the pid still dies identically)
} else if (spec.role === 'apply') {
  const gateDeadline = Date.now() + (spec.gateMaxMs || 0)
  if (spec.gateFile) { while (!existsSync(spec.gateFile) && Date.now() < gateDeadline) { /* gate spin */ } }
  const mod = await import(pathToFileURL(spec.modulePath).href)
  const opts = { rootDir: spec.rootDir, anchorDir: spec.anchorDir, realmId: spec.realmId }
  if (typeof spec.lockTimeoutMs === 'number') opts.lockTimeoutMs = spec.lockTimeoutMs
  const store = mod.createFsStateStore(opts)
  const t0 = Date.now()
  let out
  try {
    out = spec.op === 'goal'
      ? await store.applyGoal(spec.scope, { expectedRevision: spec.expectedRevision, next: spec.next, applyId: spec.applyId })
      : await store.applyTodos(spec.scope, { todos: spec.todos, applyId: spec.applyId })
  } catch (error) { out = { ok: false, code: String((error && error.code) || 'CHILD_THROW'), detail: String((error && error.message) || error) } }
  ev({ kind: 'RESULT', ok: (out && out.ok) === true, code: (out && out.code) || null, elapsedMs: Date.now() - t0, head: JSON.stringify(out).slice(0, 400) })
  // natural exit flushes the pipe
} else {
  ev({ kind: 'BAD-ROLE', role: spec.role })
  process.exitCode = 2
}
