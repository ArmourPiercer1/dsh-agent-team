#!/usr/bin/env node
/**
 * e6-two-team-leader-isolation.mjs — guide §8 E6 (PR #35 second
 * follow-up): the two-team leader residency isolation over the LIVE
 * smoke host (the same host serves Team A and Team B; both teams'
 * leaders are `inst-leader`).
 *
 * Asserts (per team, NOT merely token(A) != token(B)):
 *   - getProjection(A) v6 leader liveActivity = the expected residency
 *     (A: resident — its root session is open/live; B: cold);
 *   - getProjection(B) v6 leader liveActivity = cold;
 *   - projection.liveToken(A) == readState.liveToken(A) (same live
 *     state, two surfaces);
 *   - projection.liveToken(B) == readState.liveToken(B);
 *   - token(A) !== token(B) (the semantic live states differ).
 *
 * Usage: node e6-two-team-leader-isolation.mjs <origin> <token> \
 *         <teamA> <teamB> <leaderResidencyA> <leaderResidencyB>
 * (the token is consumed to mint a session cookie inside this process;
 * neither is ever written to evidence or printed.)
 */

const [, , ORIGIN, TOKEN, TEAM_A, TEAM_B, RESIDENCY_A, RESIDENCY_B] = process.argv
if (!ORIGIN || !TOKEN || !TEAM_A || !TEAM_B || !RESIDENCY_A || !RESIDENCY_B) {
  console.error('usage: e6-two-team-leader-isolation.mjs <origin> <token> <teamA> <teamB> <residencyA> <residencyB>')
  process.exit(2)
}

const authRes = await fetch(`${ORIGIN}/?token=${TOKEN}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
const setCookie = authRes.headers.get('set-cookie')
if (authRes.status !== 303 || setCookie === null) throw new Error(`authentication returned HTTP ${authRes.status} (expected 303 + set-cookie)`)
const COOKIE = setCookie.split(';', 1)[0]

async function remoteCall(method, params, version) {
  const res = await fetch(`${ORIGIN}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: COOKIE },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `e6-${Math.random().toString(36).slice(2, 12)}`,
      method,
      payload: { version, params },
    }),
    redirect: 'manual',
    signal: AbortSignal.timeout(120_000),
  })
  if (res.status !== 200) throw new Error(`${method}: HTTP ${res.status}`)
  const doc = await res.json()
  const result = doc?.result
  if (result?.ok !== true) throw new Error(`${method}: not ok: ${JSON.stringify(result?.error ?? result).slice(0, 400)}`)
  return result.value?.data ?? null
}

function leaderOf(projection, teamSessionId) {
  const leader = projection.members.find((member) => member.instanceId === 'inst-leader')
  if (leader === undefined) throw new Error(`${teamSessionId}: no leader row in the projection members`)
  return leader
}

const checks = []
function check(name, cond, detail) {
  checks.push({ name, ok: Boolean(cond), detail: String(detail).slice(0, 400) })
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name} — ${String(detail).slice(0, 400)}`)
}

// ── phase 0: make Team A's root live IN TEAM MODE via the public seam ──────
// (team.ensureRootLive, v3-only — the live glue's ensureLiveAgent; Team B
//  stays untouched: its root is never opened, so its leader stays cold.)
const ensure = await remoteCall('team.ensureRootLive', { teamSessionId: TEAM_A }, 3)
check('E6-0: team.ensureRootLive(A) activates Team A root in Team mode',
  ensure?.live === true && ensure?.mode === 'team' && ensure?.rootSessionId === TEAM_A,
  `ensureRootLive(A)=${JSON.stringify(ensure)}`)
await new Promise((r) => setTimeout(r, 1500)) // let the live epoch settle

const results = {}
for (const [label, team, expected] of [
  ['A', TEAM_A, RESIDENCY_A],
  ['B', TEAM_B, RESIDENCY_B],
]) {
  const projectionDoc = await remoteCall('team.getProjection', { teamSessionId: team }, 6)
  const readStateDoc = await remoteCall('team.getReadState', { sessionId: team }, 6)
  const projection = projectionDoc?.projection
  const readState = readStateDoc
  if (projection === null || projection === undefined) throw new Error(`${label}: no projection in the v6 response data`)
  const leader = leaderOf(projection, team)
  results[label] = {
    leaderResidency: leader.liveActivity?.residency ?? null,
    leaderLastActivityAt: leader.liveActivity?.lastActivityAt ?? null,
    projectionToken: projection.liveToken,
    projectionGeneration: projection.durableGeneration,
    readStateRelation: readState.relation,
    readStateToken: readState.liveToken,
    readStateGeneration: readState.durableGeneration,
  }
  check(`E6-${label}: projection leader residency = ${expected}`,
    leader.liveActivity?.residency === expected,
    `leader.liveActivity=${JSON.stringify(leader.liveActivity)}`)
  check(`E6-${label}: projection.liveToken == readState.liveToken (same live state, two surfaces)`,
    projection.liveToken !== null && projection.liveToken === readState.liveToken,
    `projection=${String(projection.liveToken).slice(0, 20)}… readState=${String(readState.liveToken).slice(0, 20)}…`)
  check(`E6-${label}: the pair (durableGeneration, liveToken) is identical on both surfaces`,
    projection.durableGeneration === readState.durableGeneration
    && readState.relation !== 'none',
    `projection gen=${projection.durableGeneration} readState gen=${readState.durableGeneration} relation=${readState.relation}`)
}
check('E6: token(A) != token(B) (the semantic live states differ — a consequence, not the point)',
  results.A.projectionToken !== results.B.projectionToken,
  `A=${String(results.A.projectionToken).slice(0, 20)}… B=${String(results.B.projectionToken).slice(0, 20)}…`)
check('E6: both read-states name their own team (per-team ownership, no cross-talk)',
  results.A.readStateRelation === 'team-root'
  && TEAM_A !== null
  && results.B.readStateRelation === 'team-root',
  `A=${results.A.readStateRelation} B=${results.B.readStateRelation} (per-team teamSessionId asserted below)`)
// the per-team teamSessionId lives on the read-state row itself
for (const [label, team] of [['A', TEAM_A], ['B', TEAM_B]]) {
  const rs = await remoteCall('team.getReadState', { sessionId: team }, 6)
  check(`E6-${label}: read-state teamSessionId == the queried team (no cross-team bleed)`,
    rs.teamSessionId === team, `readState.teamSessionId=${rs.teamSessionId}`)
}

const verdict = checks.every((c) => c.ok)
console.log(`E6 VERDICT ${verdict ? 'PASS' : 'FAIL'}`)
console.log(JSON.stringify(results, null, 1))
process.exit(verdict ? 0 : 1)
