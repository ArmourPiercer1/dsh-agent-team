import sys
p = '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5m2-wire-g6/dev/agent-workflow/evidence/a5m2-g6host/kit/g6-host-kit.mjs'
s = open(p).read()
n = 0
def rep(old, new):
    global s, n
    assert old in s, 'MISSING: ' + old[:90].replace('\n', '\\n')
    s = s.replace(old, new, 1)
    n += 1

# ── card 3: header case semantics ───────────────────────────────────────────
rep(""" *   C1  P session_trace own session (rides PA pairing: first gated call ->
 *          durable control-request -> leader team_list_pending_control +
 *          team_resolve_control(allow) via MODEL tools -> retry -> serve)
 *   C2  P session_event_trace own            C2b P session_event_read
 *   C3  P session_event_search (census)      C4  P session_search current
 *   C5  P member child session (ceiling+)    C6  N foreign session deny
 *   C7  N archived member (team_archive_member first) deny
 *   C8  N NO_CURRENT_STEP (fresh member w2, first turn, current scope)""",
""" *   C1  P session_trace own session; PA gating is judged from the DURABLE
 *          LEDGER (open control-request), never from deny words in tool text;
 *          resolve rides team_list_pending_control + team_resolve_control and
 *          COMPLETES ONLY on a real control-resolved tool result; audit =
 *          exactly ONE decision + ONE allow-consume for that requestId.
 *   C3  P session_event_search (own target, census) -> seqs of REAL events
 *   C2  P session_event_trace {seq from C3}   C2b P session_event_read {same seq}
 *   C4  P session_event_search NO session_id  = the caller-clamp lane (leader
 *          HAS an active step here — NO_CURRENT_STEP is NOT forced)
 *   C5  P member child session (ceiling-positive)  C6  N foreign target deny
 *   C7  N archived member (team_archive_member first) deny
 *   C8  session_event_search on fresh w2's first turn: SHAPE case — a fresh
 *          turn normally HAS an active step (root 23:08: do NOT hard-expect
 *          NO_CURRENT_STEP); recorded verdict: clamp-executed OR
 *          SESSION_QUERY_TOOL_NO_CURRENT_STEP, only wire/schema/PA codes FAIL""")
rep(" *   C10 N unknown target -> SESSION_QUERY_SESSION_NOT_FOUND",
""" *   C10 N unknown target -> the TEAM CEILING denies FIRST (root 23:08:
 *          expecting SESSION_QUERY_SESSION_NOT_FOUND would leak existence)
 *   Positive verdicts (root 23:08): the result FACE must correlate to the
 *   case's tool_use_id + tool name with is_error=false, and the payload must
 *   echo REAL seeded content (unique marker) / concrete seq — never mere
 *   non-empty minus four deny words.""")

# ── card 1: blueprint with capabilities (permissionPolicy source) ──────────
rep("""const BLUEPRINT_YAML = `---
schemaVersion: 1
blueprintId: ${BLUEPRINT_ID}
revision: "1"
displayName: "G6 session-query acceptance world"
description: "One boot; leader + archivable worker w1 + fresh worker w2 (C8)."
leader:
  templateId: leader
  persona: "You lead this team. Follow the scripted instructions literally; never improvise extra tool calls."
members:
  - templateId: worker
    displayName: "Worker"
    persona: "You are a worker. Do exactly what each prompt says and answer briefly."
requirements:
  - domain: persona
    name: standard""",
"""// permissionPolicy is boundTemplate.capabilities.permissions (agent-bindings
// :2207); with capabilities ABSENT the governed plane (incl. the G6 arm)
// never mounts (root 23:08 card 1). Templates below are STRICT: the four
// required capability fields + permissions lanes; builtinToolDeny carries
// subagent_fork (known-sensitive; the preset-spawn subagent is NOT deny-able
// on the standard preset — skill §5.2, recorded, not mitigable here).
const BLUEPRINT_YAML = `---
schemaVersion: 1
blueprintId: ${BLUEPRINT_ID}
revision: "1"
displayName: "G6 session-query acceptance world"
description: "One boot; leader + archivable worker w1 + fresh worker w2 (C8 shape)."
leader:
  templateId: leader
  persona: "You lead this team. Follow the scripted instructions literally; never improvise extra tool calls."
  capabilities:
    teamTools:
      kind: allow
      items: [team_list_members, team_list_templates, team_inspect_config, team_create_member, team_delegate, team_follow_up, team_collect, team_send_message, team_report_progress, team_request_control, team_resolve_control, team_list_pending_control, team_archive_member]
    builtinToolDeny: [subagent_fork]
    skills: { kind: deny, items: [] }
    mcp: { kind: deny, items: [] }
    permissions:
      default: ask
      allow: []
      ask: []
      deny: []
members:
  - templateId: worker
    displayName: "Worker"
    persona: "You are a worker. Do exactly what each prompt says and answer briefly."
    capabilities:
      teamTools: { kind: deny }
      builtinToolDeny: [subagent_fork]
      skills: { kind: deny, items: [] }
      mcp: { kind: deny, items: [] }
      permissions:
        default: ask
        allow: []
        ask: []
        deny: []
requirements:
  - domain: persona
    name: standard""")

# ── card 1b: row config enables the plane (strict sessionQuery bit) ────────
rep("""    glueUrl: pathToFileURL(INSTALLED_GLUE).href,
    seamUrl: pathToFileURL(INSTALLED_SEAM).href,
  }""",
"""    glueUrl: pathToFileURL(INSTALLED_GLUE).href,
    seamUrl: pathToFileURL(INSTALLED_SEAM).href,
    defaultWorkspace: WORLD, // session_search cross-session lane needs a cwd (:1047); pinned, not inherited
    // THE G6 ARM (agent-bindings :2633 gate + :3102 strict bit): the governed
    // plane mounts only with permissionPolicy (blueprint capabilities above)
    // AND config.teamToolPlane; sessionQuery accepts ONLY the literal true
    // (supply rides the live public service, never a config value).
    teamToolPlane: { sessionQuery: true },
  }""")

# ── card 4: tool-result FACES (tool_use_id + name + is_error correlation) ──
rep("""function toolResultBlocks(msgs) {
  const out = []
  for (const m of msgs) {
    const c = m?.content
    if (!Array.isArray(c)) continue
    for (const b of c) if (b?.type === 'tool_result') out.push({ tool_use_id: b.tool_use_id, text: typeof b.content === 'string' ? b.content : JSON.stringify(b.content ?? '') })
  }
  return out
}""",
"""/** The last user-text message carrying text blocks (mid-chain role:user
 *  tool_result carriers hold NO text — scanning only 'the last user message'
 *  loses the scenario marker; root 23:08 card 2). */
function userTextWithMarkers(msgs) {
  const textOf = (m) => (Array.isArray(m?.content) ? m.content.filter((b) => b?.type === 'text').map((b) => b.text ?? '').join(' ') : String(m?.content ?? ''))
  for (const m of [...msgs].reverse()) {
    if (m?.role !== 'user') continue
    const t = textOf(m)
    if (t !== '') return t
  }
  return ''
}
/** Faces = tool_result payloads CORRELATED to their assistant tool_use
 *  (id + name) with the wire's is_error flag (root 23:08 card 4). */
function toolResultFaces(msgs) {
  const names = new Map()
  const out = []
  for (const m of msgs) {
    const c = m?.content
    if (!Array.isArray(c)) continue
    for (const b of c) {
      if (b?.type === 'tool_use') names.set(b.id, b.name ?? 'unknown')
      if (b?.type === 'tool_result') out.push({
        tool_use_id: b.tool_use_id,
        name: names.get(b.tool_use_id) ?? 'unknown',
        is_error: b.is_error === true,
        text: typeof b.content === 'string' ? b.content : JSON.stringify(b.content ?? ''),
      })
    }
  }
  return out
}""")
rep("  const lastResultText = toolResultBlocks(msgs).at(-1)?.text ?? ''",
    "  const lastResultText = toolResultFaces(msgs).at(-1)?.text ?? ''")

# ── card 2: waits start at THIS turn's index (no stale done) ────────────────
rep("""async function waitForMock(mock, pred, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const hit = mock.requests.find((r) => { try { return pred(r) } catch { return false } })""",
"""async function waitForMock(mock, pred, timeoutMs, label, startsFrom = 0) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const hit = mock.requests.slice(startsFrom).find((r) => { try { return pred(r) } catch { return false } })""")

# ── card 2/4: decide routing on marker-bearing user text + real completion
# branches + seeded unique worker content ───────────────────────────────────
rep("""  const msgs = messagesOf(req)
  const lastUser = [...msgs].reverse().find((m) => m?.role === 'user')
  const userText = Array.isArray(lastUser?.content) ? lastUser.content.filter((b) => b?.type === 'text').map((b) => b.text ?? '').join(' ') : String(lastUser?.content ?? '')""",
"""  const msgs = messagesOf(req)
  const userText = userTextWithMarkers(msgs)""")
rep("""  WORK_W1: `G6_MK_WORK_W1_${NONCE}`, ARCHIVE_W1: `G6_MK_ARCHIVE_W1_${NONCE}`,
  PAIR_RESOLVE: `G6_MK_PAIR_RESOLVE_${NONCE}`,
}""",
"""  WORK_W1: `G6_MK_WORK_W1_${NONCE}`, ARCHIVE_W1: `G6_MK_ARCHIVE_W1_${NONCE}`,
  PAIR_RESOLVE: `G6_MK_PAIR_RESOLVE_${NONCE}`,
  WORKER_SEED: `G6_WORKER_SEED_${NONCE}`, // REAL unique content in w1's session
}""")
rep("      return toolCall('team_delegate', { rootSessionId: ROOT_G6, requestToken: `g6-work-w1-${NONCE}`, delegationInstanceId: S.w1, prompt: 'Say exactly: WORKER_STEP_DONE', taskSummary: 'g6 w1 real activity', async: false })",
    "      return toolCall('team_delegate', { rootSessionId: ROOT_G6, requestToken: `g6-work-w1-${NONCE}`, delegationInstanceId: S.w1, prompt: `Repeat exactly this line and nothing else: ${MK.WORKER_SEED}`, taskSummary: 'g6 w1 real activity', async: false })")
rep("""    bump('pair_resolved')
    return toolCall('team_resolve_control', { rootSessionId: ROOT_G6, requestToken: `g6-resolve-${NONCE}`, requestId: reqId, decision: 'allow' })
  }""",
"""    bump('pair_resolved')
    return toolCall('team_resolve_control', { rootSessionId: ROOT_G6, requestToken: `g6-resolve-${NONCE}`, requestId: reqId, decision: 'allow' })
  }
  if (userText.includes(MK.PAIR_RESOLVE) && (toolSeq.get('pair_resolved') ?? 0) > 0) {
    // REAL completion branch: the resolve tool's OWN result must say
    // control-resolved; anything else is a named failure, never silence.
    if (lastResultText.includes('control-resolved')) return { kind: 'text', content: `${doneTag('PAIR_RESOLVED')} :: ${lastResultText.slice(0, 300)}` }
    return { kind: 'text', content: `G6_PAIR_RESOLVE_FAIL :: ${lastResultText.slice(0, 300)}` }
  }""")
rep("  if (userText.includes('WORKER_STEP_DONE')) return { kind: 'text', content: 'WORKER_STEP_DONE' }",
    "  if (userText.includes(MK.WORKER_SEED)) return { kind: 'text', content: MK.WORKER_SEED }")

# ── card 3: case table (seq from real events; clamp lane; shape C8; C10
# ceiling-first; per-case REAL-content assertions) ──────────────────────────
rep("""const CASES = [
  { id: 'C1', tool: 'session_trace', input: () => ({ session_id: ROOT_G6 }), expect: 'ok' },
  { id: 'C2', tool: 'session_event_trace', input: () => ({ session_id: ROOT_G6 }), expect: 'ok' },
  { id: 'C2b', tool: 'session_event_read', input: () => ({ session_id: ROOT_G6, ...(S.firstEventSeq !== null ? { seq: S.firstEventSeq } : {}) }), expect: 'ok' },
  { id: 'C3', tool: 'session_event_search', input: () => ({ session_id: ROOT_G6, query: `G6_MARKER_${NONCE}` }), expect: 'ok' },
  { id: 'C4', tool: 'session_search', input: () => ({ query: `G6_MARKER_${NONCE}` }), expect: 'ok' }, // NO session_id -> caller default (:1331 args.session_id ?? caller) = the REAL current-session clamp
  { id: 'C5', tool: 'session_trace', input: () => ({ session_id: S.w1Child }), expect: 'ok' },
  { id: 'C6', tool: 'session_trace', input: () => ({ session_id: 'session-foreign-not-in-team-9f3c' }), expect: 'deny', anyOf: [G6.CEILING, G6.UNAUTHORIZED] },
  { id: 'C7', tool: 'session_trace', input: () => ({ session_id: S.w1Child }), expect: 'deny', anyOf: [G6.CEILING, G6.UNAUTHORIZED] },
  { id: 'C8', tool: 'session_search', input: () => ({ query: 'anything' }), expect: 'deny', anyOf: [G6.NO_STEP] },
  { id: 'C10', tool: 'session_trace', input: () => ({ session_id: 'session-does-not-exist-000000' }), expect: 'deny', anyOf: [G6.NOT_FOUND] },
]""",
"""const CASES = [
  { id: 'C1', tool: 'session_trace', input: () => ({ session_id: ROOT_G6 }), expect: 'ok', mustInclude: [ROOT_G6] },
  { id: 'C3', tool: 'session_event_search', input: () => ({ session_id: ROOT_G6, query: `G6_MARKER_${NONCE}` }), expect: 'ok', mustInclude: [`G6_MARKER_${NONCE}`] },
  { id: 'C2', tool: 'session_event_trace', input: () => ({ session_id: ROOT_G6, seq: S.eventSeq }), expect: 'ok', mustInclude: [String(S.eventSeq)] },
  { id: 'C2b', tool: 'session_event_read', input: () => ({ session_id: ROOT_G6, seq: S.eventSeq }), expect: 'ok', mustInclude: [String(S.eventSeq)] },
  { id: 'C4', tool: 'session_event_search', input: () => ({ query: `G6_MARKER_${NONCE}` }), expect: 'ok', mustInclude: [`G6_MARKER_${NONCE}`] }, // NO session_id = the caller-clamp lane (:1601-1608); the leader HAS an active step
  { id: 'C5', tool: 'session_trace', input: () => ({ session_id: S.w1Child }), expect: 'ok', mustInclude: [MK.WORKER_SEED] }, // REAL seeded content of w1's session
  { id: 'C6', tool: 'session_trace', input: () => ({ session_id: 'session-foreign-not-in-team-9f3c' }), expect: 'deny', anyOf: [G6.CEILING, G6.UNAUTHORIZED] },
  { id: 'C7', tool: 'session_trace', input: () => ({ session_id: S.w1Child }), expect: 'deny', anyOf: [G6.CEILING, G6.UNAUTHORIZED] },
  { id: 'C8', tool: 'session_event_search', input: () => ({ query: MK.WORKER_SEED }), expect: 'shape', shapeOk: [G6.NO_STEP] }, // fresh w2 first turn; NO_STEP allowed, not forced (root 23:08)
  { id: 'C10', tool: 'session_trace', input: () => ({ session_id: 'session-does-not-exist-000000' }), expect: 'deny', anyOf: [G6.CEILING, G6.UNAUTHORIZED] }, // ceiling FIRST; NOT_FOUND here = existence leak
]""")
rep("const S = { w1: null, w1Child: null, w2: null, w2Child: null, firstEventSeq: null }",
    "const S = { w1: null, w1Child: null, w2: null, w2Child: null, eventSeq: null }")

# ── card 5: unified cleanup — dieFatal never skips stop/close/port-free ────
rep("""const log = (m) => console.log(`[g6-kit ${new Date().toISOString().slice(11, 19)}] ${m}`)
async function dieFatal(msg) {
  try { mkdirSync(RUN_DIR, { recursive: true }) } catch { /* best effort */ }
  try { writeFileSync(join(RUN_DIR, 'FATAL.json'), JSON.stringify({ fatal: String(msg).slice(0, 2000), results, transcript: transcript.slice(-40) }, null, 2)) } catch { /* best effort */ }
  log(`FATAL: ${String(msg).slice(0, 400)}`)
  process.exit(1)
}""",
"""const log = (m) => console.log(`[g6-kit ${new Date().toISOString().slice(11, 19)}] ${m}`)
// Root 23:08 card 5: after ANY start, every exit path runs the SAME awaited
// cleanup (stop host, close mock, BOTH ports free); cleanup failure flips the
// exit code — process.exit must never skip it.
const liveRef = { instance: null, mock: null, ports: [] }
let cleanupDone = false
async function cleanup() {
  if (cleanupDone) return []
  cleanupDone = true
  const failures = []
  if (liveRef.instance !== null) {
    try { const st = await liveRef.instance.stop({ timeoutMs: 30_000 }); log(`host stopped (killed=${st.killed} portFree=${st.portFree})`) } catch (e) { failures.push(`instance.stop: ${String(e).slice(0, 120)}`) }
  }
  if (liveRef.mock !== null) {
    try { await liveRef.mock.close() } catch (e) { failures.push(`mock.close: ${String(e).slice(0, 120)}`) }
  }
  for (const p of liveRef.ports) {
    try { await waitForPortFree(p, 30_000) } catch { failures.push(`port ${p} not free 30s after stop`) }
  }
  if (failures.length > 0) log(`CLEANUP FAILURES: ${failures.join(' | ')}`)
  return failures
}
async function dieFatal(msg) {
  try { mkdirSync(RUN_DIR, { recursive: true }) } catch { /* best effort */ }
  try { writeFileSync(join(RUN_DIR, 'FATAL.json'), JSON.stringify({ fatal: String(msg).slice(0, 2000), results, transcript: transcript.slice(-40) }, null, 2)) } catch { /* best effort */ }
  log(`FATAL: ${String(msg).slice(0, 400)}`)
  const cleanupFailures = await cleanup()
  process.exit(cleanupFailures.length > 0 ? 3 : 1)
}""")

open(p, 'w').write(s)
print(f'cards 1,2,3,4,5 applied: {n} replacements')
