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

# ── card 6: recovery-account enforced pre-boot too (floor is not a substitute) ──
rep(R"""  if (budgetPre >= TASK_WORLD_CAP_BYTES) throw new Error(`pre-launch budget REFUSAL: task-new ${budgetPre}B >= world cap ${TASK_WORLD_CAP_BYTES}B`)""",
R"""  if (budgetPre >= TASK_WORLD_CAP_BYTES) throw new Error(`pre-launch budget REFUSAL: task-new ${budgetPre}B >= world cap ${TASK_WORLD_CAP_BYTES}B`)
  if (RECOVERY_RECORD_BYTES + budgetPre >= RECOVERY_CAP_BYTES) throw new Error(`pre-launch RECOVERY-ACCOUNT REFUSAL: recorded ${RECOVERY_RECORD_BYTES}B + task-new ${budgetPre}B >= recovery cap ${RECOVERY_CAP_BYTES}B (the 5GiB free-floor does NOT substitute for increment accounting — root 23:08 card 6)`)""")
rep(R"""    writeFileSync(join(RUN_DIR, `budget-${where}.json`), JSON.stringify({ at: new Date().toISOString(), where, taskNewAllocatedBytes: b, taskWorldCapBytes: TASK_WORLD_CAP_BYTES }, null, 2))
    if (b >= TASK_WORLD_CAP_BYTES) { budgetHalt = true; log(`BUDGET-HALT at ${where}: task-new ${b}B >= cap ${TASK_WORLD_CAP_BYTES}B — remaining case steps STOPPED`) }""",
R"""    const recoveryUsed = RECOVERY_RECORD_BYTES + b
    writeFileSync(join(RUN_DIR, `budget-${where}.json`), JSON.stringify({ at: new Date().toISOString(), where, taskNewAllocatedBytes: b, taskWorldCapBytes: TASK_WORLD_CAP_BYTES, recoveryUsedBytes: recoveryUsed, recoveryCapBytes: RECOVERY_CAP_BYTES }, null, 2))
    if (b >= TASK_WORLD_CAP_BYTES || recoveryUsed >= RECOVERY_CAP_BYTES) { budgetHalt = true; log(`BUDGET-HALT at ${where}: world ${b}B/${TASK_WORLD_CAP_BYTES}B recovery ${recoveryUsed}B/${RECOVERY_CAP_BYTES}B — remaining case steps STOPPED`) }""")

# ── card 5: wire liveRef at spawn points ────────────────────────────────────
rep(R"""  const mock = await startMockModel({ port: pre.mockPort, decide, log: (l) => log(`mock: ${l}`), fixtures: { dir: join(RUN_DIR, 'model-fixtures'), maxTextLength: 1600 } })""",
R"""  const mock = await startMockModel({ port: pre.mockPort, decide, log: (l) => log(`mock: ${l}`), fixtures: { dir: join(RUN_DIR, 'model-fixtures'), maxTextLength: 1600 } })
  liveRef.mock = mock
  liveRef.ports = [pre.port, pre.mockPort]""")
rep(R"""  const started = await instance.start({ timeoutMs: 240_000 })""",
R"""  const started = await instance.start({ timeoutMs: 240_000 })
  liveRef.instance = instance""")

# ── 307c reuse points (root-confirmed): full pagination + typed durable PA
# facts with EXACT payload.requestId (waitForLedgerFact law) ─────────────────
rep(R"""  const ledgerEntries = async (tag) => resultData((await remoteCallReady(host, 'team.getLedgerPage', { teamSessionId: ROOT_G6, afterSequence: 0, limit: 500 }, tag, 1)).body)?.entries ?? []

  const runCaseTurn""",
R"""  // FULL pagination (307c getLedgerPage reuse point): result.value.data.entries
  // until a partial page; single-page reads are NOT treated as the truth.
  const ledgerEntries = async (tag) => {
    const all = []
    let afterSequence = 0
    for (;;) {
      const page = resultData((await remoteCallReady(host, 'team.getLedgerPage', { teamSessionId: ROOT_G6, afterSequence, limit: 500 }, `${tag}-p${all.length}`, 1)).body)
      const entries = page?.entries ?? []
      all.push(...entries)
      const last = entries.at(-1)?.sequence
      if (entries.length < 500 || typeof last !== 'number' || last <= afterSequence) return all
      afterSequence = last
    }
  }
  // Durable PA fact vocabulary (307c 737-740): the ONLY gating vocabulary.
  const PA_FACT_TYPES = new Set(['control-request-recorded', 'control-decision-recorded', 'control-allow-consumed', 'control-request-abandoned'])
  const payloadOf = (e) => {
    const raw = e?.payload
    if (raw === null || typeof raw === 'undefined') return {}
    if (typeof raw === 'string') { try { return JSON.parse(raw) ?? {} } catch { return {} } }
    return typeof raw === 'object' ? raw : {}
  }
  const paFacts = (entries, factType, requestId) => entries.filter((e) => {
    if (!PA_FACT_TYPES.has(e?.factType) || e?.factType !== factType) return false
    return requestId === undefined || payloadOf(e).requestId === requestId // EXACT correlation, never substring
  })
  const waitForLedgerFact = async (tag, factType, requestId, timeoutMs = 90_000) => {
    const deadline = Date.now() + timeoutMs
    for (;;) {
      const hit = paFacts(await ledgerEntries(`${tag}-wait`), factType, requestId)
      if (hit.length > 0) return hit.at(-1)
      if (Date.now() >= deadline) return null
      await new Promise((r) => setTimeout(r, 1500))
    }
  }

  const runCaseTurn""")

# ── card 4: case turns assert the correlated FACE (id+name+is_error) and real
# content; waits are bounded to THIS turn's request index (card 2) ───────────
rep(R"""  const runCaseTurn = async (c, sessionId) => {
    const before = mock.requests.length
    const t = await apiPrompt(origin, cookie, sessionId, `G6_CASE ${c.id} Then answer one line.`, `g6-${c.id}`)
    if (!(t.status === 200 && t.body?.result?.ok === true)) return { status: 'TURN_NOT_ADMITTED', raw: JSON.stringify(t.body).slice(0, 300) }
    const done = await waitForMock(mock, (r) => r.reply?.kind === 'text' && String(r.reply?.content ?? '').startsWith(doneTag(c.id)), 240_000, `${c.id} done`)
    if (done === null) return { status: 'TURN_TIMEOUT' }
    const tr = mock.requests.slice(before).flatMap((r) => toolResultBlocks(messagesOf(r)))
    return { status: 'DONE', toolResult: tr.at(-1)?.text ?? '', toolResults: tr.length }
  }""",
R"""  const runCaseTurn = async (c, sessionId) => {
    const before = mock.requests.length
    const t = await apiPrompt(origin, cookie, sessionId, `G6_CASE ${c.id} Then answer one line.`, `g6-${c.id}`)
    if (!(t.status === 200 && t.body?.result?.ok === true)) return { status: 'TURN_NOT_ADMITTED', raw: JSON.stringify(t.body).slice(0, 300) }
    const done = await waitForMock(mock, (r) => r.reply?.kind === 'text' && String(r.reply?.content ?? '').startsWith(doneTag(c.id)), 240_000, `${c.id} done`, before)
    if (done === null) return { status: 'TURN_TIMEOUT' }
    const faces = mock.requests.slice(before).flatMap((r) => toolResultFaces(messagesOf(r)))
    const face = [...faces].reverse().find((f) => f.name === c.tool) ?? null
    return {
      status: 'DONE',
      faceFound: face !== null,
      isError: face?.is_error === true,
      toolResult: face?.text ?? '',
      toolResults: faces.length,
      mustInclude: typeof c.mustInclude === 'function' ? c.mustInclude() : (c.mustInclude ?? []),
    }
  }""")

# ── card 2: PA gating from the DURABLE LEDGER; completion only on a real
# control-resolved result; one decision + one consume audited (exact ids) ────
rep(R"""  const resolvePairingIfNeeded = async (tag) => {
    const entries = await ledgerEntries(tag)
    const asText = (e) => (typeof e?.payload === 'string' ? e.payload : JSON.stringify(e?.payload ?? {}))
    const openReq = [...entries].reverse().find((e) => e?.factType === 'control-request-recorded')
    if (openReq === undefined) return 'none-open'
    const reqIdRaw = /"requestId"\s*:\s*"([^"]+)"/.exec(asText(openReq))?.[1] ?? null
    const already = reqIdRaw !== null && entries.some((e) => e?.factType === 'control-decision-recorded' && asText(e).includes(reqIdRaw))
    if (already) return 'already-resolved'
    const t = await apiPrompt(origin, cookie, ROOT_G6, `${MK.PAIR_RESOLVE} List pending control requests and resolve the pairing request with allow.`, 'g6-pair')
    if (!(t.status === 200 && t.body?.result?.ok === true)) await dieFatal('pairing resolve turn not admitted')
    const ok = await waitForMock(mock, (r) => r.reply?.kind === 'text' && String(r.reply?.content ?? '').includes('control-resolved'), 240_000, 'pair settle')
    if (ok === null) await dieFatal('pairing resolve chain did not settle (leader model tools)')
    return 'resolved-via-leader-model-tools'
  }""",
R"""  // PA law (root 23:08 card 2 + 307c reuse points): durable facts ONLY,
  // correlated by EXACT payload.requestId. The RPC envelope rpcId is transport
  // identity and is NEVER a PA requestId. Abandoned requests are terminal, not
  // open. Completion = a REAL control-resolved tool result, then exactly ONE
  // decision + ONE allow-consume for that requestId.
  const PAIR_AUDIT = []
  const resolvePairingIfNeeded = async (tag) => {
    const entries = await ledgerEntries(tag)
    const requests = entries.filter((e) => e?.factType === 'control-request-recorded')
    const openReq = [...requests].reverse().find((e) => {
      const reqId = payloadOf(e).requestId
      const closed = paFacts(entries, 'control-decision-recorded', reqId).length + paFacts(entries, 'control-request-abandoned', reqId).length
      return closed === 0
    })
    if (openReq === undefined) return 'none-open'
    const reqId = payloadOf(openReq).requestId
    if (typeof reqId !== 'string' || reqId === '') await dieFatal('pairing: durable request without a payload.requestId')
    const startsFrom = mock.requests.length
    const t = await apiPrompt(origin, cookie, ROOT_G6, `${MK.PAIR_RESOLVE} List pending control requests and resolve the pairing request with allow.`, 'g6-pair')
    if (!(t.status === 200 && t.body?.result?.ok === true)) await dieFatal('pairing resolve turn not admitted')
    const fail = await waitForMock(mock, (r) => r.reply?.kind === 'text' && String(r.reply?.content ?? '').startsWith('G6_PAIR_RESOLVE_FAIL'), 240_000, 'pair FAIL', startsFrom)
    if (fail !== null) await dieFatal(`pairing resolve NOT completed: ${String(fail.reply?.content).slice(0, 300)}`)
    const ok = await waitForMock(mock, (r) => r.reply?.kind === 'text' && String(r.reply?.content ?? '').startsWith(doneTag('PAIR_RESOLVED')), 240_000, 'pair settle', startsFrom)
    if (ok === null) await dieFatal('pairing resolve chain did not reach the control-resolved completion branch')
    const decided = await waitForLedgerFact(`${tag}-decided`, 'control-decision-recorded', reqId)
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
  }""")

# ── seeded REAL unique content into early leader turns (marker must exist
# BEFORE the clamp boundary so the caller-clamp lane can hit it) ─────────────
rep(R"""    const t = await apiPrompt(origin, cookie, ROOT_G6, `${marker} Follow the scripted tool chain.`, tag)""",
R"""    const beforeSeed = mock.requests.length
    const t = await apiPrompt(origin, cookie, ROOT_G6, `${marker} Follow the scripted tool chain. G6_MARKER_${NONCE}`, tag)""")
rep(R"""    if ((await waitForMock(mock, (r) => r.reply?.content === done, 240_000, tag)) === null) await dieFatal(`seed chain did not settle (${tag})`)""",
R"""    if ((await waitForMock(mock, (r) => r.reply?.content === done, 240_000, tag, beforeSeed)) === null) await dieFatal(`seed chain did not settle (${tag})`)""")

# ── card 3: C1 gating by durable ledger (never deny words in tool text) ─────
rep(R"""  let c1 = await runCaseTurn(CASES[0], ROOT_G6)
  if (c1.status === 'DONE' && DENY_TOKENS.some((d) => c1.toolResult.includes(d))) {
    const how = await resolvePairingIfNeeded('g6-ledger-pair')
    log(`C1 gated -> pairing ${how}; retrying (allowance 2)`)
    caseAllowance.set('C1', 2)
    c1 = await runCaseTurn(CASES[0], ROOT_G6)
    c1.paired = how
  }
  results.push({ id: 'C1', ...c1, expect: CASES[0].expect })""",
R"""  let c1 = await runCaseTurn(CASES[0], ROOT_G6)
  const pairState = await resolvePairingIfNeeded('g6-ledger-pair') // DURABLE pending-approval law, not tool-text deny words
  if (pairState === 'resolved-via-leader-model-tools' && c1.status === 'DONE' && (!c1.faceFound || c1.isError)) {
    log('C1 gated (open durable request) -> resolved; retrying (allowance 2)')
    caseAllowance.set('C1', 2)
    c1 = await runCaseTurn(CASES[0], ROOT_G6)
    c1.paired = pairState
  } else if (pairState !== 'none-open' && pairState !== 'resolved-via-leader-model-tools') {
    await dieFatal(`unexpected pairing state: ${pairState}`)
  }
  results.push({ id: 'C1', ...c1, expect: CASES[0].expect, mustInclude: CASES[0].mustInclude })""")

# ── card 3: run order + REAL seq extraction (0 legal) + pairing per realm ──
rep(R"""  for (const id of ['C2', 'C3', 'C4', 'C5', 'C6', 'C10']) {
    const c = CASES.find((x) => x.id === id)
    const r = await runCaseTurn(c, ROOT_G6)
    results.push({ id, ...r, expect: c.expect, anyOf: c.anyOf })
    if (id === 'C2') {
      S.firstEventSeq = Number(/"seq"\s*:\s*(\d+)/.exec(r.toolResult ?? '')?.[1] ?? /seq (\d+)/.exec(r.toolResult ?? '')?.[1] ?? '') || null
      const c2b = await runCaseTurn(CASES.find((x) => x.id === 'C2b'), ROOT_G6)
      results.push({ id: 'C2b', ...c2b, expect: 'ok' })
    }
    await resolvePairingIfNeeded(`g6-ledger-${id}`) // a NEW realm may gate a fresh pairing
    if (budgetHalt) break
    phaseBudgetCheck(`case-${id}`)
  }""",
R"""  for (const id of ['C3', 'C2', 'C2b', 'C4', 'C5', 'C6', 'C10']) {
    const c = CASES.find((x) => x.id === id)
    await resolvePairingIfNeeded(`g6-ledger-${id}`) // NEW target realms gate per durable pending approval
    const r = await runCaseTurn(c, ROOT_G6)
    results.push({ id, ...r, expect: c.expect, anyOf: c.anyOf, shapeOk: c.shapeOk })
    if (id === 'C3') {
      // seq comes ONLY from a REAL public event surfaced by the search result
      // (0 is a legal seq); no fabricated fallback (root 23:08 card 3).
      const m = /"seq"\s*:\s*(\d+)/.exec(r.toolResult ?? '') ?? /\bseq (\d+)\b/.exec(r.toolResult ?? '')
      if (m === null) await dieFatal('C3 surfaced no real event seq; refusing to invent one for C2/C2b')
      S.eventSeq = Number(m[1])
      log(`C3 real event seq=${S.eventSeq}`)
    }
    if (budgetHalt) break
    phaseBudgetCheck(`case-${id}`)
  }""")

# ── C7 baseline waits; C8 shape verdict ─────────────────────────────────────
rep(R"""  if (!(at.status === 200 && at.body?.result?.ok === true) || (await waitForMock(mock, (r) => r.reply?.content === doneTag('ARCHIVE_W1'), 240_000, 'archive')) === null) await dieFatal('archive chain failed')""",
R"""  const archFrom = mock.requests.length
  if (!(at.status === 200 && at.body?.result?.ok === true) || (await waitForMock(mock, (r) => r.reply?.content === doneTag('ARCHIVE_W1'), 240_000, 'archive', archFrom)) === null) await dieFatal('archive chain failed')""")
rep(R"""    const r8 = await runCaseTurn(CASES.find((x) => x.id === 'C8'), S.w2Child)
    results.push({ id: 'C8', ...r8, expect: 'deny', session: S.w2Child })""",
R"""    const r8 = await runCaseTurn(CASES.find((x) => x.id === 'C8'), S.w2Child)
    results.push({ id: 'C8', ...r8, expect: 'shape', shapeOk: [G6.NO_STEP], session: S.w2Child })""")

# ── card 4: verdicts on correlated faces + real content, shape/deny/ok ─────
rep(R"""  const verdicts = results.map((r) => {
    if (r.status === 'NOT_ATTEMPTED') return { id: r.id, verdict: 'NOT_ATTEMPTED', reason: r.reason }
    if (r.status !== 'DONE') return { id: r.id, verdict: 'FAIL', why: r.status, raw: r.raw ?? '' }
    const text = r.toolResult ?? ''
    const hit = (r.anyOf ?? DENY_TOKENS).filter((d) => text.includes(d))
    const pass = r.expect === 'deny' ? hit.length > 0 : (hit.length === 0 && DENY_TOKENS.every((d) => !text.includes(d)) && text.length > 0)
    return { id: r.id, verdict: pass ? 'PASS' : 'FAIL', expect: r.expect, observed: text.slice(0, 240) }
  })""",
R"""  const verdicts = results.map((r) => {
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
  })""")

# ── card 5: teardown rides the SAME awaited cleanup; failures flip exit ────
rep(R"""  let stopInfo = null
  try { stopInfo = await instance.stop({ timeoutMs: 30_000 }); log(`host stopped (killed=${stopInfo.killed} portFree=${stopInfo.portFree})`) } finally { try { await mock.close() } catch { /* port check below is authoritative */ } }
  await waitForPortFree(pre.port, 30_000).catch(() => log('WARN port not free 30s after stop'))
  const fp = allocatedFootprint(WORLD)
  writeFileSync(join(RUN_DIR, 'footprint.json'), JSON.stringify({ world: WORLD, ...fp, recoveryIncrementCap: BUDGET_CAP_BYTES, taskNewAllocatedBytes: taskNewAllocated(), taskWorldCapBytes: TASK_WORLD_CAP_BYTES, budgetHalt }, null, 2))
  const fails = verdicts.filter((v) => v.verdict === 'FAIL').length
  log(`verdicts: ${verdicts.filter((v) => v.verdict === 'PASS').length} PASS / ${fails} FAIL / ${verdicts.filter((v) => v.verdict === 'NOT_ATTEMPTED').length} NOT_ATTEMPTED; world own-allocated ${fp.ownExclusiveAllocated}B (+dirs ${fp.dirBytes}B) / cap ${BUDGET_CAP_BYTES}B`)
  process.exit(fails > 0 || budgetHalt === true || fp.ownExclusiveAllocated + fp.dirBytes > BUDGET_CAP_BYTES ? 2 : 0)""",
R"""  const fp = allocatedFootprint(WORLD)
  const cleanupFailures = await cleanup()
  writeFileSync(join(RUN_DIR, 'footprint.json'), JSON.stringify({ world: WORLD, ...fp, recoveryIncrementCap: BUDGET_CAP_BYTES, recoveryUsedBytes: RECOVERY_RECORD_BYTES + taskNewAllocated(), taskNewAllocatedBytes: taskNewAllocated(), taskWorldCapBytes: TASK_WORLD_CAP_BYTES, budgetHalt, cleanupFailures }, null, 2))
  const fails = verdicts.filter((v) => v.verdict === 'FAIL').length
  log(`verdicts: ${verdicts.filter((v) => v.verdict === 'PASS').length} PASS / ${fails} FAIL / ${verdicts.filter((v) => v.verdict === 'NOT_ATTEMPTED').length} NOT_ATTEMPTED; world own-allocated ${fp.ownExclusiveAllocated}B (+dirs ${fp.dirBytes}B) / recovery ${RECOVERY_RECORD_BYTES + taskNewAllocated()}B/${RECOVERY_CAP_BYTES}B`)
  process.exit(cleanupFailures.length > 0 ? 3 : (fails > 0 || budgetHalt === true || RECOVERY_RECORD_BYTES + taskNewAllocated() > RECOVERY_CAP_BYTES ? 2 : 0))""")

open(p, 'w').write(s)
print(f'patch-B v2 applied: {n} replacements')
