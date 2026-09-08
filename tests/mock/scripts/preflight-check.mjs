// preflight-check.mjs — V2 plan G0: post-boot, pre-first-model-turn contract checks.
//
// usage: node preflight-check.mjs
//
// All checks are read-only and fast (seconds). Purpose: catch the round-1
// class of late failures (F8 envelope misconfig, blueprint drift, dead MCP
// endpoint, bad cookie) in one minute BEFORE any model turn is spent.
// exit 0 = all PASS (or PASS with WARN); 1 = any FAIL.
import {
  DSH_HOME, MOCK_ROOT, REPO_ROOT, loadDomain, portOpen, readBootState, readCookie,
  sessionLogPath, teamRemote,
} from './common.mjs'
import { existsSync as fsExists, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const results = []
const check = (name, ok, detail, warnOnly = false) => {
  results.push({ name, ok, detail, warnOnly })
  console.log(`${ok ? (warnOnly ? 'WARN' : 'PASS') : 'FAIL'}  ${name}  ${detail}`)
}

const state = readBootState()
const origin = state.origin
const cookie = readCookie()
const root = state.rootSessionId

// 1 — cookie valid: GET / with cookie must return 200 (not 401/303).
{
  const res = await fetch(origin, { headers: { cookie }, signal: AbortSignal.timeout(30_000) })
  const text = await res.text()
  check('cookie-auth', res.status === 200, `GET / -> ${res.status} (${text.length} bytes)`)
}

// 2 — row health: /__p6t6/health ok + toolCount 10 + root live.
{
  const res = await fetch(`${origin}/__p6t6/health`, { signal: AbortSignal.timeout(30_000) })
  const body = await res.json().catch(() => null)
  const live = JSON.stringify(body?.liveSessions ?? [])
  check('row-health', res.status === 200 && body?.ok === true && body?.toolCount === 10,
    `status=${res.status} ok=${body?.ok} toolCount=${body?.toolCount} rootLive=${live.includes(root)}`)
}

// 3+4 — parse the patch's blueprintSource (JSON-escaped single-line scalar;
// envelopes live INSIDE the blueprint document, not in the patch YAML).
//   3. blueprint binding: the DOMAIN layer's own parseBlueprint(contentHash)
//      === the domain row's contentHash (production dist, exact derivation —
//      contentHash is derived from the parsed+normalized blueprint, so raw
//      string variants of the source CANNOT match; round-1 hash variants
//      were a red herring).
//   4. envelope intersection (round-1 F8 class): request-control/resolve-control
//      in teamEnvelope.allow ∩ every memberEnvelope.allow
{
  const patchPath = join(DSH_HOME, 'profiles', 'web', 'cordis.patch.yml')
  const m = fsExists(patchPath)
    ? readFileSync(patchPath, 'utf8').match(/blueprintSource: "((?:[^"\\]|\\.)*)"/)
    : null
  const src = m ? JSON.parse(`"${m[1]}"`) : null

  if (src === null) {
    check('blueprint-binding', false, 'blueprintSource not found in patch (format drift?)')
    check('envelope-intersection', false, 'blueprintSource not found — envelopes unparseable')
  } else {
    let ok = false
    let detail = 'parseBlueprint unavailable'
    try {
      const distIndex = pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'domain', 'blueprint', 'src', 'index.js')).href
      const { parseBlueprint } = await import(distIndex)
      const bp = parseBlueprint(src)
      const dom = loadDomain()
      const bound = dom.row('team_sessions', root)?.blueprint?.contentHash
      ok = bp.blueprintId === (dom.row('team_sessions', root)?.blueprint?.blueprintId) && bound === bp.contentHash
      detail = `patch=${bp.blueprintId}@${bp.revision} ${String(bp.contentHash).slice(0, 19)}… domain=${(bound ?? 'absent').slice(0, 19)}… match=${ok}`
    } catch (e) { detail = `parseBlueprint import failed: ${e.message.slice(0, 120)}` }
    check('blueprint-binding', ok, detail)

    // collect `allow:` list items following the first `allow:` inside [from,to) of src
    const allowAfter = (fromIdx, toIdx) => {
      const seg = src.slice(fromIdx, toIdx)
      const j = seg.indexOf('allow:')
      if (j < 0) return null
      const out = []
      for (const line of seg.slice(j).split('\n').slice(1)) {
        const mm = line.match(/^\s+-\s+([a-z-]+)\s*$/)
        if (mm) out.push(mm[1]); else break
      }
      return out
    }
    const teamI = src.indexOf('teamEnvelope:')
    const memberI = src.indexOf('memberEnvelopes:')
    const endI = src.indexOf('policyStates:')
    const teamAllow = teamI >= 0 ? allowAfter(teamI, memberI >= 0 ? memberI : src.length) : null
    const memberBlocks = []
    if (memberI >= 0) {
      const region = src.slice(memberI, endI >= 0 ? endI : src.length)
      const matches = [...region.matchAll(/templateId:\s*(\w+)/g)]
      for (let i = 0; i < matches.length; i++) {
        const mm = matches[i]
        const absStart = memberI + mm.index
        const absEnd = i + 1 < matches.length ? memberI + matches[i + 1].index : memberI + region.length
        const seg = src.slice(absStart, absEnd)
        if (!seg.includes('envelope:')) continue
        const allow = allowAfter(absStart, absEnd)
        if (allow !== null) memberBlocks.push({ template: mm[1], allow })
      }
    }
    const needed = ['request-control', 'resolve-control']
    const problems = []
    if (teamAllow === null) problems.push('teamEnvelope.allow not parsed')
    else for (const t of needed) if (!teamAllow.includes(t)) problems.push(`teamEnvelope.allow missing ${t}`)
    if (memberBlocks.length === 0) problems.push('no memberEnvelope allow lists parsed')
    for (const mb of memberBlocks) for (const t of needed) if (!mb.allow.includes(t)) problems.push(`${mb.template} envelope missing ${t}`)
    check('envelope-intersection', problems.length === 0,
      problems.length === 0
        ? `team(${teamAllow.length}) ∩ member(${memberBlocks.map((b) => b.template).join(',')}) contain ${needed.join('/')}`
        : problems.join('; '))
  }
}

// 5 — workspace registry: initialized + a row for the mock root exists.
{
  const wsPath = join(DSH_HOME, 'storages', 'workspace.json')
  let ok = false
  let detail = 'workspace.json absent'
  if (fsExists(wsPath)) {
    const ws = JSON.parse(readFileSync(wsPath, 'utf8'))
    const rows = Object.values(ws.tables?.workspaces ?? {})
    const norm = (p) => String(p).replace(/\\/g, '/').toLowerCase()
    const mockRow = rows.find((r) => norm(r.path) === norm(MOCK_ROOT))
    const init = ws.global?.initialized === true
    ok = init && mockRow !== undefined
    detail = `initialized=${init} workspaces=${rows.length} mockRow=${mockRow ? `sessions=${mockRow.sessionIds.length}` : 'absent'} rootBound=${mockRow?.sessionIds?.includes(root) ?? false}`
    check('workspace-registry', ok, detail)
  } else check('workspace-registry', false, detail)
}

// 6 — MCP endpoints listening (TCP level; tool-level verified in P2/P3).
{
  const facet = await portOpen(state.mcp?.facet?.port ?? 3491)
  const host = await portOpen(state.mcp?.host?.port ?? 3492)
  check('mcp-endpoints', facet && host, `facet:${state.mcp?.facet?.port}=${facet} host:${state.mcp?.host?.port}=${host}`)
}

// 7 — team session bound in domain + root log exists.
{
  const dom = loadDomain()
  const ts = dom.row('team_sessions', root)
  const logOk = sessionLogPath(root) !== null
  check('team-binding', ts !== undefined && logOk,
    `team_sessions[${root.slice(0, 18)}…]=${ts ? `gen=${ts.generation} bp=${ts.blueprint.blueprintId}@${ts.blueprint.revision}` : 'absent'} rootLog=${logOk}`)
}

// 8 — team-remote seam reachable (team.getProjection, read-only).
{
  const r = await teamRemote(origin, cookie, 'team.getProjection', { teamSessionId: root })
  const ok = r.status === 200 && r.ok === true
  check('team-remote-seam', ok,
    ok ? `getProjection gen=${r.value?.data?.projection?.generation ?? r.value?.data?.generation ?? '?'} (origin=${r.value?.provenance?.origin ?? '?'})`
      : `status=${r.status} err=${JSON.stringify(r.error ?? r.raw?.nonJson ?? 'n/a').slice(0, 160)}`)
}

const fails = results.filter((r) => !r.ok && !r.warnOnly)
const warns = results.filter((r) => !r.ok && r.warnOnly)
console.log(`\n[preflight] ${results.length - fails.length - warns.length} PASS, ${warns.length} WARN, ${fails.length} FAIL — ${fails.length === 0 ? 'CLEAR to run model turns' : 'BLOCKED: do not spend model turns'}`)
process.exit(fails.length === 0 ? 0 : 1)
