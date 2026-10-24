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

# ── ① decide(): completion branch FIRST (was unreachable); list/resolve after ──
rep(R"""  if (userText.includes(MK.PAIR_RESOLVE)) {
    if ((toolSeq.get('pair') ?? 0) === 0) {
      bump('pair')
      return toolCall('team_list_pending_control', { rootSessionId: ROOT_G6, requestToken: `g6-pending-${NONCE}` })
    }
    const reqId = /"requestId"\s*:\s*"([^"]+)"/.exec(lastResultText)?.[1] ?? null
    if (reqId === null) return { kind: 'text', content: `G6_PAIR_ID_EXTRACT_FAIL :: ${lastResultText.slice(0, 200)}` }
    bump('pair_resolved')
    return toolCall('team_resolve_control', { rootSessionId: ROOT_G6, requestToken: `g6-resolve-${NONCE}`, requestId: reqId, decision: 'allow' })
  }
  if (userText.includes(MK.PAIR_RESOLVE) && (toolSeq.get('pair_resolved') ?? 0) > 0) {
    // REAL completion branch: the resolve tool's OWN result must say
    // control-resolved; anything else is a named failure, never silence.
    if (lastResultText.includes('control-resolved')) return { kind: 'text', content: `${doneTag('PAIR_RESOLVED')} :: ${lastResultText.slice(0, 300)}` }
    return { kind: 'text', content: `G6_PAIR_RESOLVE_FAIL :: ${lastResultText.slice(0, 300)}` }
  }""",
R"""  if (userText.includes(MK.PAIR_RESOLVE)) {
    // COMPLETION CHECK FIRST (root 23:3x ①): once the resolve call went out,
    // its OWN result decides the terminal state — this branch was previously
    // unreachable behind the unconditional resolve return.
    if ((toolSeq.get('pair_resolved') ?? 0) > 0) {
      if (lastResultText.includes('control-resolved')) return { kind: 'text', content: `${doneTag('PAIR_RESOLVED')} :: ${lastResultText.slice(0, 300)}` }
      return { kind: 'text', content: `G6_PAIR_RESOLVE_FAIL :: ${lastResultText.slice(0, 300)}` }
    }
    if ((toolSeq.get('pair') ?? 0) === 0) {
      bump('pair')
      return toolCall('team_list_pending_control', { rootSessionId: ROOT_G6, requestToken: `g6-pending-${NONCE}` })
    }
    const reqId = /"requestId"\s*:\s*"([^"]+)"/.exec(lastResultText)?.[1] ?? null
    if (reqId === null) return { kind: 'text', content: `G6_PAIR_ID_EXTRACT_FAIL :: ${lastResultText.slice(0, 200)}` }
    bump('pair_resolved')
    return toolCall('team_resolve_control', { rootSessionId: ROOT_G6, requestToken: `g6-resolve-${NONCE}`, requestId: reqId, decision: 'allow' })
  }""")

# ── ① kit side: ONE wait to either terminal state, not FAIL-240s-then-success ──
rep(R"""    const fail = await waitForMock(mock, (r) => r.reply?.kind === 'text' && String(r.reply?.content ?? '').startsWith('G6_PAIR_RESOLVE_FAIL'), 240_000, 'pair FAIL', startsFrom)
    if (fail !== null) await dieFatal(`pairing resolve NOT completed: ${String(fail.reply?.content).slice(0, 300)}`)
    const ok = await waitForMock(mock, (r) => r.reply?.kind === 'text' && String(r.reply?.content ?? '').startsWith(doneTag('PAIR_RESOLVED')), 240_000, 'pair settle', startsFrom)
    if (ok === null) await dieFatal('pairing resolve chain did not reach the control-resolved completion branch')""",
R"""    const settled = await waitForMock(mock, (r) => r.reply?.kind === 'text' && (String(r.reply?.content ?? '').startsWith(doneTag('PAIR_RESOLVED')) || String(r.reply?.content ?? '').startsWith('G6_PAIR_RESOLVE_FAIL')), 240_000, 'pair settle', startsFrom)
    if (settled === null) await dieFatal('pairing resolve reached NO terminal state (resolved or FAIL) within 240s')
    if (String(settled.reply?.content ?? '').startsWith('G6_PAIR_RESOLVE_FAIL')) await dieFatal(`pairing resolve NOT completed: ${String(settled.reply?.content).slice(0, 300)}`)""")

# ── ③ production order: consume can ONLY appear once the gated call RERUNS.
# decision audited here; consume proven AFTER continuation, never before. ────
rep(R"""    const decided = await waitForLedgerFact(`${tag}-decided`, 'control-decision-recorded', reqId)
    if (decided === null) await dieFatal(`pairing: no durable control-decision-recorded for ${reqId}`)
    const consumed = await waitForLedgerFact(`${tag}-consumed`, 'control-allow-consumed', reqId)
    const after = await ledgerEntries(`${tag}-after-pair`)
    const decision = paFacts(after, 'control-decision-recorded', reqId)
    const consumedFacts = paFacts(after, 'control-allow-consumed', reqId)
    PAIR_AUDIT.push({ reqId, decisionFacts: decision.length, consumedFacts: consumedFacts.length })
    writeFileSync(join(RUN_DIR, 'pairing-audit.json'), JSON.stringify(PAIR_AUDIT, null, 2))
    if (decision.length !== 1 || consumedFacts.length !== 1) await dieFatal(`pairing audit: request ${reqId} decision=${decision.length} consume=${consumedFacts.length} (exactly-one law)`)
    void consumed
    return 'resolved-via-leader-model-tools'
  }""",
R"""    const decided = await waitForLedgerFact(`${tag}-decided`, 'control-decision-recorded', reqId)
    if (decided === null) await dieFatal(`pairing: no durable control-decision-recorded for ${reqId}`)
    const after = await ledgerEntries(`${tag}-after-pair`)
    const decision = paFacts(after, 'control-decision-recorded', reqId)
    if (decision.length !== 1) await dieFatal(`pairing audit: request ${reqId} decision=${decision.length} (exactly-one law)`)
    // consume is recorded ONLY when the GATED CALL ACTUALLY RERUNS (production
    // order, root 23:3x ③): queue it; it must NOT be waited for here and can
    // NEVER be skipped — flushConsumeProof proves or fatals later.
    PENDING_CONSUME.push({ reqId, since: tag })
    writeFileSync(join(RUN_DIR, 'pairing-audit.json'), JSON.stringify(PAIR_AUDIT, null, 2))
    return 'resolved-via-leader-model-tools'
  }
  const PENDING_CONSUME = []
  const flushConsumeProof = async (tag) => {
    for (const pc of [...PENDING_CONSUME]) {
      const hit = await waitForLedgerFact(`${tag}-consume`, 'control-allow-consumed', pc.reqId, 120_000)
      if (hit === null) continue // continuation may still be in flight; re-proved at later phases
      const after = await ledgerEntries(`${tag}-consume-audit`)
      const decision = paFacts(after, 'control-decision-recorded', pc.reqId)
      const consumed = paFacts(after, 'control-allow-consumed', pc.reqId)
      PAIR_AUDIT.push({ reqId: pc.reqId, decisionFacts: decision.length, consumedFacts: consumed.length })
      writeFileSync(join(RUN_DIR, 'pairing-audit.json'), JSON.stringify(PAIR_AUDIT, null, 2))
      if (decision.length !== 1 || consumed.length !== 1) await dieFatal(`pairing audit: ${pc.reqId} decision=${decision.length} consume=${consumed.length} (exactly-one law)`)
      PENDING_CONSUME.splice(PENDING_CONSUME.indexOf(pc), 1)
      log(`pairing ${pc.reqId}: decision=1 consume=1 PROVEN after continuation (${tag})`)
    }
  }""")

# resolvePairingIfNeeded now runs BEFORE the case (already does) — C1 retry + loop flush the consume proof
rep(R"""    caseAllowance.set('C1', 2)
    c1 = await runCaseTurn(CASES[0], ROOT_G6)
    c1.paired = pairState
  } else if (pairState !== 'none-open' && pairState !== 'resolved-via-leader-model-tools') {""",
R"""    caseAllowance.set('C1', 2)
    c1 = await runCaseTurn(CASES[0], ROOT_G6) // TRIGGER continuation first (production order)
    c1.paired = pairState
    await flushConsumeProof('g6-pair')        // THEN prove consume == 1
  } else if (pairState !== 'none-open' && pairState !== 'resolved-via-leader-model-tools') {""")
rep(R"""    results.push({ id, ...r, expect: c.expect, anyOf: c.anyOf, shapeOk: c.shapeOk })""",
R"""    results.push({ id, ...r, expect: c.expect, anyOf: c.anyOf, shapeOk: c.shapeOk })
    await flushConsumeProof(`g6-${id}`) // any pairing resolved earlier proves consume here, after the call RAN""")
rep(R"""  const fp = allocatedFootprint(WORLD)
  const cleanupFailures = await cleanup()""",
R"""  if (PENDING_CONSUME.length > 0) await dieFatal(`pairing law violated: gated request(s) NEVER consumed: ${PENDING_CONSUME.map((x) => x.reqId).join(',')} (decision/consume proof can never be skipped)`)
  const fp = allocatedFootprint(WORLD)
  const cleanupFailures = await cleanup()""")

# ── ② restore session_search as the FIFTH model-facing tool + runtime seq ────
rep(R"""  { id: 'C10', tool: 'session_trace', input: () => ({ session_id: 'session-does-not-exist-000000' }), expect: 'deny', anyOf: [G6.CEILING, G6.UNAUTHORIZED] }, // ceiling FIRST; NOT_FOUND here = existence leak
]""",
R"""  { id: 'C10', tool: 'session_trace', input: () => ({ session_id: 'session-does-not-exist-000000' }), expect: 'deny', anyOf: [G6.CEILING, G6.UNAUTHORIZED] }, // ceiling FIRST; NOT_FOUND here = existence leak
  { id: 'C11', tool: 'session_search', input: () => ({ query: `G6_MARKER_${NONCE}` }), expect: 'ok', mustInclude: [`G6_MARKER_${NONCE}`] }, // the FIFTH tool: CROSS-SESSION workspace lane (:1047), cwd pinned via defaultWorkspace — NOT the current-event clamp
]""")
rep(R"""  { id: 'C2', tool: 'session_event_trace', input: () => ({ session_id: ROOT_G6, seq: S.eventSeq }), expect: 'ok', mustInclude: [String(S.eventSeq)] },
  { id: 'C2b', tool: 'session_event_read', input: () => ({ session_id: ROOT_G6, seq: S.eventSeq }), expect: 'ok', mustInclude: [String(S.eventSeq)] },""",
R"""  { id: 'C2', tool: 'session_event_trace', input: () => ({ session_id: ROOT_G6, seq: S.eventSeq }), expect: 'ok', mustInclude: () => [String(S.eventSeq)] }, // FUNCTION: real seq at RUNTIME, never a frozen 'null'
  { id: 'C2b', tool: 'session_event_read', input: () => ({ session_id: ROOT_G6, seq: S.eventSeq }), expect: 'ok', mustInclude: () => [String(S.eventSeq)] },""")
rep(R"""      mustInclude: typeof c.mustInclude === 'function' ? c.mustInclude() : (c.mustInclude ?? []),
    }
  }""",
R"""      mustInclude: (typeof c.mustInclude === 'function' ? c.mustInclude() : (c.mustInclude ?? [])).filter((v) => typeof v === 'string' && v !== '' && v !== 'null'),
    }
  }""")

# ── ③ lock THIS call's tool_use_id (never scan history by tool name) ────────
rep(R"""    const faces = mock.requests.slice(before).flatMap((r) => toolResultFaces(messagesOf(r)))
    const face = [...faces].reverse().find((f) => f.name === c.tool) ?? null
    return {
      status: 'DONE',
      faceFound: face !== null,""",
R"""    const turnReqs = mock.requests.slice(before)
    const faces = turnReqs.flatMap((r) => toolResultFaces(messagesOf(r)))
    const useIds = new Set()
    for (const r of turnReqs) for (const msg of messagesOf(r)) {
      const cc = msg?.content
      if (!Array.isArray(cc)) continue
      for (const b of cc) if (b?.type === 'tool_use' && b.name === c.tool) useIds.add(b.id) // THIS turn's ids only
    }
    const face = [...faces].reverse().find((f) => useIds.has(f.tool_use_id)) ?? null
    return {
      status: 'DONE',
      faceFound: face !== null,
      toolUseId: face?.tool_use_id ?? null,""")

# ── ④ register BEFORE start; cleanup records stop-portFree-false AND the
# waitForPortFree FALSE return (it resolves false, does not throw) ────────────
rep(R"""  const instance = new DshInstance({ hostTree: HOST_TREE, dshHome: WORLD, port: pre.port, clientCommitHash: CLIENT_COMMIT_HASH, logDir: join(RUN_DIR, 'instances') })""",
R"""  const instance = new DshInstance({ hostTree: HOST_TREE, dshHome: WORLD, port: pre.port, clientCommitHash: CLIENT_COMMIT_HASH, logDir: join(RUN_DIR, 'instances') })
  liveRef.instance = instance // registered BEFORE start: a failed start still cleans""")
rep(R"""  const started = await instance.start({ timeoutMs: 240_000 })
  liveRef.instance = instance""",
R"""  const started = await instance.start({ timeoutMs: 240_000 })""")
rep(R"""    try { const st = await liveRef.instance.stop({ timeoutMs: 30_000 }); log(`host stopped (killed=${st.killed} portFree=${st.portFree})`) } catch (e) { failures.push(`instance.stop: ${String(e).slice(0, 120)}`) }""",
R"""    try {
      const st = await liveRef.instance.stop({ timeoutMs: 30_000 })
      log(`host stopped (killed=${st?.killed} portFree=${st?.portFree})`)
      if (st?.portFree !== true) failures.push(`instance.stop returned portFree=${String(st?.portFree)}`) // a false return IS a cleanup failure
    } catch (e) { failures.push(`instance.stop: ${String(e).slice(0, 120)}`) }""")
rep(R"""  for (const p of liveRef.ports) {
    try { await waitForPortFree(p, 30_000) } catch { failures.push(`port ${p} not free 30s after stop`) }
  }""",
R"""  for (const p of liveRef.ports) {
    let free = false
    try { free = await waitForPortFree(p, 30_000) } catch { free = false } // util waitForPortFree RESOLVES false on timeout — the false path must be recorded
    if (free !== true) failures.push(`port ${p} not free 30s after cleanup (waitForPortFree=${String(free)})`)
  }""")

# ── hoist verdict mapper so REPLAY exercises the REAL branch table ──────────
rep(R"""  const verdicts = results.map((r) => {
    if (r.status === 'NOT_ATTEMPTED') return { id: r.id, verdict: 'NOT_ATTEMPTED', reason: r.reason }""",
R"""  const verdicts = results.map((r) => verdictOf(r))
  void 0
  const _unusedVerdicts = (r) => {
    if (r.status === 'NOT_ATTEMPTED') return { id: r.id, verdict: 'NOT_ATTEMPTED', reason: r.reason }""")

open(p, 'w').write(s)
print(f'patch-2309 part1: {n} replacements')
