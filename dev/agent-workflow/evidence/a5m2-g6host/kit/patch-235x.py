import sys
p = '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5m2-wire-g6/dev/agent-workflow/evidence/a5m2-g6host/kit/g6-host-kit.mjs'
s = open(p).read()
n = 0
def rep(old, new):
    global s, n
    assert old in s, 'MISSING: ' + old[:90].replace('\n', '\\n')
    assert s.count(old) == 1, 'AMBIGUOUS: ' + old[:60].replace('\n', '\\n')
    s = s.replace(old, new, 1)
    n += 1

# ── ① C11 enters the EXECUTION sequence (top-level constant so replay can ──
#    assert the REAL order, not just the case table) ──────────────────────────
rep(R"""]
// C9 = caller drift:""",
R"""]
// THE ACTUAL execution sequence (root dd00 ①: C11 must RUN, not merely sit in
// the table). CASES is the spec; this is the schedule.
const CASE_RUN_ORDER = ['C3', 'C2', 'C2b', 'C4', 'C11', 'C5', 'C6', 'C10']
for (const id of CASE_RUN_ORDER) { if (!CASES.some((c) => c.id === id)) throw new Error(`CASE_RUN_ORDER names unknown case ${id}`) }
if (CASE_RUN_ORDER.filter((id) => (CASES.find((c) => c.id === id) ?? {}).tool === 'session_search').length !== 1) throw new Error('the session_search lane (C11) must appear EXACTLY ONCE in the run order')
// C9 = caller drift:""")
rep(R"""  for (const id of ['C3', 'C2', 'C2b', 'C4', 'C5', 'C6', 'C10']) {""",
R"""  for (const id of CASE_RUN_ORDER) {""")

# ── ② lock the tool_use ids the mock ACTUALLY EMITTED this round (from the
# reply the harness answered with), never from the request's full history ────
rep(R"""// ── verdict branch table (TOP LEVEL: replay exercises the REAL branches) ───""",
R"""/** The tool_use ids this round's mock REPLIES actually emitted for a tool
 *  (root dd00 ②): request.messages is the FULL history and must never be the
 *  id source; the reply's toolCalls[].id is what this turn really called. */
function emittedToolUseIds(turnReqs, toolName) {
  const ids = new Set()
  for (const r of turnReqs) {
    const tcs = r?.reply?.toolCalls
    if (!Array.isArray(tcs)) continue
    for (const t of tcs) if (t?.name === toolName && typeof t.id === 'string') ids.add(t.id)
  }
  return ids
}

// ── verdict branch table (TOP LEVEL: replay exercises the REAL branches) ───""")
rep(R"""    const turnReqs = mock.requests.slice(before)
    const faces = turnReqs.flatMap((r) => toolResultFaces(messagesOf(r)))
    const useIds = new Set()
    for (const r of turnReqs) for (const msg of messagesOf(r)) {
      const cc = msg?.content
      if (!Array.isArray(cc)) continue
      for (const b of cc) if (b?.type === 'tool_use' && b.name === c.tool) useIds.add(b.id) // THIS turn's ids only
    }
    const face = [...faces].reverse().find((f) => useIds.has(f.tool_use_id)) ?? null""",
R"""    const turnReqs = mock.requests.slice(before)
    const faces = turnReqs.flatMap((r) => toolResultFaces(messagesOf(r)))
    const useIds = emittedToolUseIds(turnReqs, c.tool) // THIS round's EMITTED ids (reply-side), not history
    const face = [...faces].reverse().find((f) => useIds.has(f.tool_use_id)) ?? null""")

# ── ③ final gate: pending must be empty AND >=1 VALID audit (decision==1 &&
# consume==1) — an all-none-open zero-audit run is NOT green ─────────────────
rep(R"""  if (PENDING_CONSUME.length > 0) await dieFatal(`pairing law violated: gated request(s) NEVER consumed: ${PENDING_CONSUME.map((x) => x.reqId).join(',')} (decision/consume proof can never be skipped)`)""",
R"""  if (PENDING_CONSUME.length > 0) await dieFatal(`pairing law violated: gated request(s) NEVER consumed: ${PENDING_CONSUME.map((x) => x.reqId).join(',')} (decision/consume proof can never be skipped)`)
  // Root dd00 ③: pending-empty ALONE is not green — the G6 PA loop must have
  // actually PROVEN at least one request with decision EXACTLY 1 and consume
  // EXACTLY 1. An all-'none-open' run with zero audits cannot pass.
  const validAudits = PAIR_AUDIT.filter((a) => a.decisionFacts === 1 && a.consumedFacts === 1)
  if (validAudits.length < 1) await dieFatal(`pairing loop unproven: ${PAIR_AUDIT.length} audit entries, none with decision=1 AND consume=1 (none-open cannot be all-zero green)`)""")

# ── ④ started-flag law: stop.killed=false FAILS only when the Host actually
# started (child process); not-started = noted separately, never false-reject;
# portFree must be true in BOTH cases ────────────────────────────────────────
rep(R"""const liveRef = { instance: null, mock: null, ports: [] }""",
R"""const liveRef = { instance: null, mock: null, ports: [], started: false }""")
rep(R"""  const started = await instance.start({ timeoutMs: 240_000 })""",
R"""  const started = await instance.start({ timeoutMs: 240_000 })
  liveRef.started = true // a started Host MUST die: stop.killed=false then = cleanup failure""")
rep(R"""      const st = await liveRef.instance.stop({ timeoutMs: 30_000 })
      log(`host stopped (killed=${st?.killed} portFree=${st?.portFree})`)
      if (st?.portFree !== true) failures.push(`instance.stop returned portFree=${String(st?.portFree)}`) // a false return IS a cleanup failure""",
R"""      const st = await liveRef.instance.stop({ timeoutMs: 30_000 })
      log(`host stopped (killed=${st?.killed} portFree=${st?.portFree} started=${liveRef.started})`)
      if (st?.portFree !== true) failures.push(`instance.stop returned portFree=${String(st?.portFree)}`) // false = failure in BOTH states
      if (st?.killed === false) {
        // Root dd00 ④: killed=false while the Host was STARTED means the child
        // may survive = cleanup failure; never started = noted separately,
        // never a false reject.
        if (liveRef.started === true) failures.push('instance.stop returned killed=false after a real start (child may survive)')
        else log('NOTE: stop.killed=false with no started Host (no child expected) — noted, not a failure')
      }""")

# ── replay: R3 now constructs the ACTUAL emitted set via the real function
# (positive AND stale-history negative); R5 covers the started-flag law ──────
rep(R"""  // R3 — REAL toolResultFaces tool_use_id lock: a same-named face from an
  // EARLIER call (id not in this turn) must NOT satisfy this turn
  const faces = toolResultFaces([asstUse('call-old-1', 'session_trace'), userRes('call-old-1', 'OLD-RESULT-TEXT')])
  const useIds = new Set(['call-new-9'])
  const locked = [...faces].reverse().find((f) => useIds.has(f.tool_use_id)) ?? null
  ok('R3-old-call-face-rejected', faces.length === 1 && locked === null, `faces=${faces.length} id=${faces[0]?.tool_use_id}`)""",
R"""  // R3 — REAL emitted-id law: ids come from the mock REPLIES (emittedToolUseIds),
  // positive case built from that SAME actually-emitted set, negative proves a
  // same-named face from the request HISTORY (different id) cannot match.
  const liveReq = { reply: { kind: 'tool-call', toolCalls: [{ id: 'emit-A', name: 'session_trace', arguments: {} }] }, body: { messages: [asstUse('emit-A', 'session_trace'), userRes('emit-A', 'THIS-ROUND-RESULT')] } }
  const realIds = emittedToolUseIds([liveReq], 'session_trace')
  const liveFaces = toolResultFaces(messagesOf(liveReq))
  const liveMatch = [...liveFaces].reverse().find((f) => realIds.has(f.tool_use_id)) ?? null
  const staleReq = { reply: { kind: 'tool-call', toolCalls: [{ id: 'emit-B', name: 'team_delegate', arguments: {} }] }, body: { messages: [asstUse('call-old-1', 'session_trace'), userRes('call-old-1', 'OLD-RESULT-TEXT')] } }
  const staleIds = emittedToolUseIds([staleReq], 'session_trace')
  const staleFaces = toolResultFaces(messagesOf(staleReq))
  const staleMatch = [...staleFaces].reverse().find((f) => staleIds.has(f.tool_use_id)) ?? null
  ok('R3-emitted-set-positive', realIds.has('emit-A') && liveMatch?.text === 'THIS-ROUND-RESULT', `ids=${[...realIds]}`)
  ok('R3-history-id-rejected', staleIds.size === 0 && staleFaces.length === 1 && staleMatch === null, `staleFace=${staleFaces[0]?.tool_use_id} emitted=${[...staleIds].length}`)
  ok('R1-order-schedule-includes-session_search', CASE_RUN_ORDER.includes('C11') && (CASES.find((c) => c.id === 'C11') ?? {}).tool === 'session_search', CASE_RUN_ORDER.join(','))""")
rep(R"""  ok('R4-cleanup-records-false-returns', failures.length === 2 && failures.some((x) => x.includes('portFree=false')) && failures.some((x) => x.includes('port 3999')), JSON.stringify(failures).slice(0, 220))""",
R"""  ok('R4-cleanup-records-false-returns', failures.length === 2 && failures.some((x) => x.includes('portFree=false')) && failures.some((x) => x.includes('port 3999')), JSON.stringify(failures).slice(0, 220))

  // R5 — started-flag law: started + killed=false FAILS; never-started
  // killed=false is NOT a false reject; portFree=true required regardless
  cleanupDone = false
  liveRef.instance = { stop: async () => ({ killed: false, portFree: true }) }
  liveRef.mock = { close: async () => {} }
  liveRef.ports = []
  liveRef.started = true
  const fKilled = await cleanup()
  cleanupDone = false
  liveRef.started = false
  const fIdle = await cleanup()
  ok('R5-started-killed-false-fails', fKilled.length === 1 && fKilled[0].includes('killed=false'), JSON.stringify(fKilled).slice(0, 160))
  ok('R5-idle-killed-false-not-rejected', fIdle.length === 0, JSON.stringify(fIdle).slice(0, 160))""")

open(p, 'w').write(s)
print(f'patch-235x applied: {n} replacements')
