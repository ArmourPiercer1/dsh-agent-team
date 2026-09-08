// wait-turn.mjs — V2 plan D5 turn watchdog (also the F3 hang detector).
//
// usage: node wait-turn.mjs <logPath> [timeoutMs=180000] [pollMs=2000]
//
// Semantics:
//  - baseline = the highest turn number present in the log AT START
//    (send the prompt BEFORE invoking this script);
//  - polls until a turn/end row with turn > baseline appears;
//  - on success: prints the turn/end row + elapsed, exit 0;
//  - on timeout: prints the FINGERPRINT (baseline turn, last 8 rows, and
//    any trailing tool/call lacking its tool/result) + exit 1.
import { logRows, maxTurn, sleep } from './common.mjs'

const [logPath, timeoutArg, pollArg] = process.argv.slice(2)
if (!logPath) { console.error('usage: node wait-turn.mjs <logPath> [timeoutMs=180000] [pollMs=2000]'); process.exit(2) }
const timeoutMs = Number(timeoutArg ?? 180_000)
const pollMs = Number(pollArg ?? 2_000)

const start = Date.now()
const baseline = maxTurn(logPath)
console.log(`[wait-turn] baseline turn=${baseline} timeout=${timeoutMs}ms log=${logPath}`)

for (;;) {
  const rows = logRows(logPath)
  const done = rows.filter((r) => r.type === 'turn/end' && typeof r.turn === 'number' && r.turn > baseline)
  if (done.length > 0) {
    const t = done[done.length - 1]
    console.log(`[wait-turn] OK turn/end turn=${t.turn} reason=${JSON.stringify(t.raw.reason ?? null)} elapsed=${Date.now() - start}ms`)
    process.exit(0)
  }
  if (Date.now() - start >= timeoutMs) {
    console.log(`[wait-turn] TIMEOUT after ${Date.now() - start}ms (baseline turn=${baseline})`)
    const tail = rows.slice(-8)
    console.log('[wait-turn] FINGERPRINT last rows:')
    for (const r of tail) {
      const d = r.raw
      let brief = JSON.stringify(d).slice(0, 200)
      if (d.type === 'tool/call') brief = `tool/call turn=${d.turn} step=${d.step} name=${d.name} args=${String(d.arguments).slice(0, 120)}`
      if (d.type === 'user/message') brief = `user/message ${String(JSON.stringify(d.content ?? '')).slice(0, 120)}`
      console.log(`  seq=${r.seq} type=${r.type} ${brief}`)
    }
    // dangling call detection: last tool/call without a matching tool/result
    let dangling = null
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].raw.type === 'tool/call') { dangling = rows[i].raw; break }
    }
    if (dangling) {
      const hasResult = rows.some((r) => r.raw.type === 'tool/result' && r.raw.message?.source?.callId === dangling.callId)
      console.log(`[wait-turn] LAST tool/call: turn=${dangling.turn} name=${dangling.name} resultPresent=${hasResult}${hasResult ? '' : '  <-- HANG SIGNATURE (F3)'}`)
    }
    process.exit(1)
  }
  await sleep(pollMs)
}
