// T12-V18 (glue resume-loop literal conformance) + T12-V19 (V3 budget 480s -> 600s)
// Applied with explicit newline control: agent-bindings.mjs is CRLF; runner NL detected.
import fs from 'node:fs'

const WT = 'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/T12-V'

// ── T12-V18: agent-bindings.mjs ──
const p1 = `${WT}/packages/runtime/src/plugin/live/agent-bindings.mjs`
let s1 = fs.readFileSync(p1, 'utf8')
const R = '\r\n'
const old1 =
  `        for (const member of members) {` + R +
  `          // T12-V17 (parent run #7 postmortem item 1): mirror the create path's` + R +
  `          // leader exclusion (the create loop skips LEADER_INSTANCE_ID because the` + R +
  `          // leader IS the root session, resumed above) — explicit by instance id.` + R +
  `          if (String(member?.instanceId) === LEADER_INSTANCE_ID) continue` + R +
  `          // T12-V10: the production create path mints the v2 leader row with` + R +
  `          // NO childSessionId key (the leader IS the root session, resumed` + R +
  `          // above) — String(undefined) produced SessionId("undefined") and` + R +
  `          // killed every resume boot (T12 vertical runs #6-#10). Structural` + R +
  `          // guard in the shape used by projection-source.ts /` + R +
  `          // s6-live-overlay.ts ('childSessionId' in row).` + R +
  `          const childRaw = member?.childSessionId` + R +
  `          if (typeof childRaw !== 'string' || childRaw.length === 0) continue` + R +
  `          const child = childRaw` + R
const new1 =
  `        for (const member of members) {` + R +
  `          // T12-V18 (parent final directive; literal form of the T12-V17/T12-V10` + R +
  `          // resume fix): mirror the create path's exclusion (the create loop` + R +
  `          // skips LEADER_INSTANCE_ID because the leader IS the root session,` + R +
  `          // resumed above) — explicit by instance id, plus the explicit keyless-row` + R +
  `          // guard before any stringification (String(undefined) produced` + R +
  `          // SessionId("undefined") and killed every resume boot: T12 vertical` + R +
  `          // runs #6-#10; T12-B2 repair family).` + R +
  `          if (String(member.instanceId) === LEADER_INSTANCE_ID) continue` + R +
  `          if (member.childSessionId === undefined || member.childSessionId === null) continue` + R +
  `          // T12-V10 structural guard (shape used by projection-source.ts /` + R +
  `          // s6-live-overlay.ts): second line of defense vs empty-string or` + R +
  `          // non-string values.` + R +
  `          const childRaw = member.childSessionId` + R +
  `          if (typeof childRaw !== 'string' || childRaw.length === 0) continue` + R +
  `          const child = childRaw` + R
const i1 = s1.indexOf(old1)
if (i1 < 0) throw new Error('T12-V18 glue anchor not found')
if (s1.indexOf(old1, i1 + 1) >= 0) throw new Error('T12-V18 glue anchor not unique')
s1 = s1.slice(0, i1) + new1 + s1.slice(i1 + old1.length)
fs.writeFileSync(p1, s1)
console.log('T12-V18 glue edit applied at byte', i1)

// ── T12-V19: t12-vertical.mjs — V3 denied-ack budget 480s -> 600s ──
const p2 = `${WT}/packages/tools/harness/t12-vertical.mjs`
let s2 = fs.readFileSync(p2, 'utf8')
const N = s2.includes('\r\n') ? '\r\n' : '\n'
const old2 =
  `    // 480 s (was 180 s): run #6 showed the fresh-child non-idle window PERSISTS` + N +
  `    // past the first turn — V2-A's turn 1 took ~47 s, V3's turn 2 (USE_MCP) took` + N +
  `    // ~181 s and the denied-ack landed 1.3 s past a 180 s deadline. The window` + N +
  `    // is per-agent-materialization but spans MULTIPLE turns until convergence` + N +
  `    // (turn 3 on the same agent was immediate, 0.25 s). t12v-finding-360s-first-turn.md.` + N +
  `    const v3AdmittedAt = Date.now()` + N +
  `    const deniedAck = await waitForLogLineJson(HOME_A, workerA.childSessionId, (l) => JSON.stringify(l).includes(\`T12V_MCP_DENIED_ACK_\${NONCE}\`), 480_000)` + N +
  `    v3.check('turn settled after the mcp tool call was handled by the real agent loop', deniedAck !== null, deniedAck === null ? '<denied-ack not in child log within 480s>' : 'settled')` + N
const new2 =
  `    // 600 s (was 480 s, which was 180 s): parent final directive — the pre-T12-V16` + N +
  `    // denied-ack misses were SYSTEMATIC (three consecutive runs, 1.1-1.5 s past the` + N +
  `    // 480 s deadline; the window converged at ~481-482 s). A 600 s budget with margin` + N +
  `    // is the honest bound; since T12-V16 (delivery at admission) the denied-ack has` + N +
  `    // landed in ~0.3-1 s (runs #14/#15), so the bound now has wide margin. Every other` + N +
  `    // budget unchanged (V1/V2-A/V4/RESTART/handoff stay 480 s; LIFECYCLE 900 s).` + N +
  `    const v3AdmittedAt = Date.now()` + N +
  `    const deniedAck = await waitForLogLineJson(HOME_A, workerA.childSessionId, (l) => JSON.stringify(l).includes(\`T12V_MCP_DENIED_ACK_\${NONCE}\`), 600_000)` + N +
  `    v3.check('turn settled after the mcp tool call was handled by the real agent loop', deniedAck !== null, deniedAck === null ? '<denied-ack not in child log within 600s>' : 'settled')` + N
const i2 = s2.indexOf(old2)
if (i2 < 0) throw new Error('T12-V19 runner anchor not found')
if (s2.indexOf(old2, i2 + 1) >= 0) throw new Error('T12-V19 runner anchor not unique')
s2 = s2.slice(0, i2) + new2 + s2.slice(i2 + old2.length)
fs.writeFileSync(p2, s2)
console.log('T12-V19 runner edit applied at byte', i2, 'NL=' + (N === '\r\n' ? 'CRLF' : 'LF'))
