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

# ── hoist verdict branch table to TOP LEVEL (real function for replay) ──────
i0 = s.index('  const verdicts = results.map((r) => verdictOf(r))\n  void 0\n  const _unusedVerdicts = (r) => {')
tail = """    const missing = (r.mustInclude ?? []).filter((needle) => !text.includes(needle))
    const pass = r.isError !== true && codes.length === 0 && wireCodes.length === 0 && missing.length === 0 && text.length > 0
    return { id: r.id, verdict: pass ? 'PASS' : 'FAIL', expect: 'ok', missingContent: missing, observedCodes: codes, observed: text.slice(0, 240) }
  })"""
j0 = s.index(tail, i0) + len(tail)
body = '''  const verdicts = results.map((r) => verdictOf(r))'''
s = s[:i0] + body + s[j0:]
n += 1

rep(R"""// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(RUN_DIR, { recursive: true })""",
R"""// ── verdict branch table (TOP LEVEL: replay exercises the REAL branches) ───

function verdictOf(r) {
  if (r.status === 'NOT_ATTEMPTED') return { id: r.id, verdict: 'NOT_ATTEMPTED', reason: r.reason }
  if (r.status !== 'DONE') return { id: r.id, verdict: 'FAIL', why: r.status, raw: r.raw ?? '' }
  const text = r.toolResult ?? ''
  if (r.faceFound !== true) return { id: r.id, verdict: 'FAIL', why: 'no tool_result face correlated to the case tool_use_id' }
  const codes = [G6.CEILING, G6.UNAUTHORIZED, G6.NOT_FOUND, G6.NO_STEP, G6.DRIFT].filter((d) => text.includes(d))
  const wireCodes = ['P_G6_WIRE_', 'SESSION_QUERY_INVALID_', 'SESSION_QUERY_MISSING', 'SESSION_QUERY_UNKNOWN', 'SESSION_QUERY_TOOL_FAILED', 'SESSION_QUERY_CORRUPT', 'SESSION_QUERY_PERSISTENCE', 'SESSION_QUERY_SEARCH_DISABLED', 'SESSION_QUERY_ABORTED', 'SESSION_QUERY_INDEX_FAILED', 'SESSION_QUERY_STALE', 'SESSION_QUERY_RESULT_INTEGRITY'].filter((d) => text.includes(d))
  if (r.expect === 'deny') {
    const hits = (r.anyOf ?? DENY_TOKENS).filter((d) => text.includes(d))
    const pass = r.isError !== true && hits.length > 0
    return { id: r.id, verdict: pass ? 'PASS' : 'FAIL', expect: 'deny', observedCodes: codes, observed: text.slice(0, 240) }
  }
  if (r.expect === 'shape') {
    // fresh-turn shape: clamp-executed OR NO_CURRENT_STEP both legal (root
    // 23:08: a new turn normally HAS an active step); wire/schema/PA codes
    // or a missing/erroring face FAIL.
    const pass = r.isError !== true && wireCodes.length === 0 && codes.filter((c) => c !== G6.NO_STEP).length === 0
    return { id: r.id, verdict: pass ? 'PASS' : 'FAIL', expect: 'shape', observedCodes: codes, observed: text.slice(0, 240) }
  }
  const missing = (r.mustInclude ?? []).filter((needle) => !text.includes(needle))
  const pass = r.isError !== true && codes.length === 0 && wireCodes.length === 0 && missing.length === 0 && text.length > 0
  return { id: r.id, verdict: pass ? 'PASS' : 'FAIL', expect: 'ok', missingContent: missing, observedCodes: codes, observed: text.slice(0, 240) }
}

// ── replay (root 23:3x): the four residual behaviors exercised through the
// REAL functions — decide()'s state machine (no unreachable completion),
// runtime-seq mustInclude (no frozen 'null'), THIS-call tool_use_id lock,
// verdict branch table, and cleanup's false-recording — NO Host, NO boot,
// one ephemeral localhost listener only. ────────────────────────────────────

async function runReplay() {
  const checks = []
  const ok = (name, cond, extra = '') => { checks.push({ name, pass: cond === true, extra: String(extra).slice(0, 160) }); log(`replay ${cond === true ? 'OK  ' : 'FAIL'} ${name}${extra !== '' ? ` — ${String(extra).slice(0, 140)}` : ''}`) }
  const msgs = (list) => [{ role: 'user', content: [{ type: 'text', text: 'G6_REPLAY' }], ...list }]
  void msgs
  const reqOf = (messages) => ({ body: { messages } })
  const userT = (t) => ({ role: 'user', content: [{ type: 'text', text: t }] })
  const asstUse = (id, name) => ({ role: 'assistant', content: [{ type: 'tool_use', id, name, input: {} }] })
  const userRes = (id, text) => ({ role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: text }] })

  // R1 — the REAL decide() state machine: completion branch REACHABLE first
  toolSeq.clear()
  const base = [userT(`${MK.PAIR_RESOLVE} resolve it`)]
  const d1 = decide({ req: reqOf(base) })
  ok('R1-list-first', d1.kind === 'tool-call' && d1.toolCalls[0].name === 'team_list_pending_control', JSON.stringify(d1).slice(0, 60))
  const h2 = [...base, asstUse('call-list-1', 'team_list_pending_control'), userRes('call-list-1', '{"ok":true,"requestId":"req-replay-1"}')]
  const d2 = decide({ req: reqOf(h2) })
  ok('R1-resolve-second', d2.kind === 'tool-call' && d2.toolCalls[0].name === 'team_resolve_control', JSON.stringify(d2).slice(0, 60))
  const h3 = [...h2, asstUse('call-res-1', 'team_resolve_control'), userRes('call-res-1', '{"status":"control-resolved"}')]
  const d3 = decide({ req: reqOf(h3) })
  ok('R1-completion-reachable', d3.kind === 'text' && String(d3.content).startsWith(doneTag('PAIR_RESOLVED')), JSON.stringify(d3).slice(0, 80))
  toolSeq.clear()
  bump('pair'); bump('pair_resolved')
  const d3b = decide({ req: reqOf([...base, asstUse('call-res-9', 'team_resolve_control'), userRes('call-res-9', 'boom-not-resolved')]) })
  ok('R1-fail-terminal', d3b.kind === 'text' && String(d3b.content).startsWith('G6_PAIR_RESOLVE_FAIL'), JSON.stringify(d3b).slice(0, 80))

  // R2 — fifth tool restored + mustInclude built at RUNTIME (no frozen 'null')
  ok('R2-session-search-restored', CASES.some((c) => c.tool === 'session_search'), `tools=${new Set(CASES.map((c) => c.tool)).size}`)
  const c2 = CASES.find((c) => c.id === 'C2')
  S.eventSeq = null
  const frozenProbe = (c2.mustInclude() ?? []).filter((v) => typeof v === 'string' && v !== '' && v !== 'null')
  S.eventSeq = 7
  const runtimeProbe = (c2.mustInclude() ?? []).filter((v) => typeof v === 'string' && v !== '' && v !== 'null')
  ok('R2-runtime-seq-not-frozen', typeof c2.mustInclude === 'function' && JSON.stringify(frozenProbe) === '[]' && JSON.stringify(runtimeProbe) === '["7"]', `null-stage=${JSON.stringify(frozenProbe)} seven=${JSON.stringify(runtimeProbe)}`)

  // R3 — REAL toolResultFaces tool_use_id lock: a same-named face from an
  // EARLIER call (id not in this turn) must NOT satisfy this turn
  const faces = toolResultFaces([asstUse('call-old-1', 'session_trace'), userRes('call-old-1', 'OLD-RESULT-TEXT')])
  const useIds = new Set(['call-new-9'])
  const locked = [...faces].reverse().find((f) => useIds.has(f.tool_use_id)) ?? null
  ok('R3-old-call-face-rejected', faces.length === 1 && locked === null, `faces=${faces.length} id=${faces[0]?.tool_use_id}`)

  // R4 — verdict branch table + cleanup false-recording (real functions)
  ok('R4-branch-positive', verdictOf({ id: 'X', status: 'DONE', faceFound: true, isError: false, toolResult: 'marker-abc', mustInclude: ['marker-abc'] }).verdict === 'PASS')
  ok('R4-branch-existence-leak-fails', verdictOf({ id: 'X', status: 'DONE', faceFound: true, isError: false, toolResult: G6.NOT_FOUND, expect: 'deny', anyOf: [G6.CEILING, G6.UNAUTHORIZED] }).verdict === 'FAIL')
  ok('R4-branch-shape-nostep-legal', verdictOf({ id: 'X', status: 'DONE', faceFound: true, isError: false, toolResult: G6.NO_STEP, expect: 'shape' }).verdict === 'PASS')
  ok('R4-branch-faceless-fails', verdictOf({ id: 'X', status: 'DONE', faceFound: false, toolResult: 'x' }).verdict === 'FAIL')
  cleanupDone = false
  const { createServer } = await import('node:net')
  const busy = createServer()
  await new Promise((res, rej) => { busy.once('error', rej); busy.listen(3999, '127.0.0.1', res) })
  liveRef.instance = { stop: async () => ({ killed: false, portFree: false }) }
  liveRef.mock = { close: async () => {} }
  liveRef.ports = [3999]
  const failures = await cleanup()
  busy.close()
  ok('R4-cleanup-records-false-returns', failures.length === 2 && failures.some((x) => x.includes('portFree=false')) && failures.some((x) => x.includes('port 3999')), JSON.stringify(failures).slice(0, 220))
  void userT
  writeFileSync(join(RUN_DIR, 'REPLAY.json'), JSON.stringify({ at: new Date().toISOString(), checks, allPass: checks.every((c) => c.pass) }, null, 2))
  return checks.every((c) => c.pass)
}

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(RUN_DIR, { recursive: true })
  if (process.argv.includes('--replay')) { const pass = await runReplay(); log(`replay ${pass ? 'ALL PASS' : 'FAILURES'} (REPLAY.json)`); process.exit(pass ? 0 : 2) }""")

# docs: fifth tool, consume order law, replay usage
rep(R""" *   C10 N unknown target -> the TEAM CEILING denies FIRST (root 23:08:
 *          expecting SESSION_QUERY_SESSION_NOT_FOUND would leak existence)""",
R""" *   C10 N unknown target -> the TEAM CEILING denies FIRST (root 23:08:
 *          expecting SESSION_QUERY_SESSION_NOT_FOUND would leak existence)
 *   C11 P session_search (the FIFTH tool): cross-session workspace lane
 *          (:1047, cwd pinned via defaultWorkspace) — not the event clamp
 *   Pairing PRODUCTION ORDER (root 23:3x): decision durable BEFORE
 *   continuation; control-allow-consumed appears ONLY once the gated call
 *   actually RERUNS — the kit triggers continuation first, then proves
 *   exactly-one consume; an unconsumed gated request is FATAL, never skipped.""")
rep(R""" * USAGE: `node g6-host-kit.mjs [--boot] [--port 3186]` — WITHOUT --boot the
 * kit runs pre-flight + case-table validation only (exit 0 = ready-to-boot).""",
R""" * USAGE: `node g6-host-kit.mjs [--boot|--replay] [--port 3186]` — WITHOUT
 * --boot: pre-flight + case-table validation only (exit 0 = ready-to-boot);
 * --replay: offline residual-behavior replay through the REAL functions
 * (decide state machine / runtime seq / tool_use_id lock / verdict table /
 * cleanup false-recording), no Host, one ephemeral localhost listener.""")

open(p, 'w').write(s)
print(f'patch-2309 part2: {n} operations')
