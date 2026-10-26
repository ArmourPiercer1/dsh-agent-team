// Reviewer probes for PR #386 (U7-0 / EB2-A). Read-only against product code.
// Run from the review worktree root: node dev/agent-workflow/evidence/u7-0-review-r1/probes.mjs
import { readFileSync } from 'node:fs'
import { loadExpectedPair } from '../../../../packages/testkit/census/expected-obligations.mjs'
import { reconcile } from '../../../../packages/testkit/census/reconcile.mjs'
import { withDigests, digestEligibleView } from '../../../../packages/testkit/census/inventory.mjs'
import { canonicalDigest, definitionShapeDigest } from '../../../../packages/testkit/census/json-canonical.mjs'

const REPO = process.cwd()
const pair = loadExpectedPair(REPO)
const TEST_ROWS = ['u7_census', 'u5_canary']
const fixture = () => JSON.parse(readFileSync('packages/testkit/census/fixtures/synthetic-non-team.inventory.json', 'utf8'))
const live = (f) => JSON.parse(readFileSync(`dev/engineering/tool-obligations/baselines/${f}`, 'utf8'))
const run = (o) => { const r = reconcile({ ...pair, testRowNames: TEST_ROWS, ...o }); if (!r.ok) throw new Error(JSON.stringify(r.violations)); return r.result }
const out = {}

// P1 — same-boot Definition replacement in a NON-FIRST scope (fixture: agent-1 only).
{
  const base = fixture(); const obs = fixture()
  obs.scopes.find((s) => s.scope_id === 'agent-1').tools.find((t) => t.name === 'read').definition_identity = 'def#777777'
  const r = run({ observed: withDigests(obs), baseline: base })
  out.P1_identity_swap_agent1_only = { drift: r.counts.drift, rows: r.drift }
}
// P1b — same on LIVE governed-team data: replace read in agent-2 (native lane; agent-1 is first holder of `read`).
{
  const base = live('observed-governed-team.20261026.json'); const obs = structuredClone(base)
  obs.scopes.find((s) => s.scope_id === 'agent-2').tools.find((t) => t.name === 'read').definition_identity = 'def#999999'
  const r = run({ observed: withDigests(obs), baseline: base })
  out.P1b_live_team_identity_swap_agent2 = { drift: r.counts.drift, rows: r.drift }
  const obs2 = structuredClone(base)
  obs2.scopes.find((s) => s.scope_id === 'agent-1').tools.find((t) => t.name === 'read').definition_identity = 'def#999999'
  const r2 = run({ observed: withDigests(obs2), baseline: base })
  out.P1c_live_team_identity_swap_agent1 = { drift: r2.counts.drift, kinds: r2.drift.map((d) => `${d.name}/${d.scope_class}/${d.kind}`) }
}
// P2 — shape replacement with NO baseline (the mode the runner uses for its per-world verdicts).
{
  const obs = fixture()
  for (const s of obs.scopes) { const t = s.tools.find((x) => x.name === 'read'); t.schema_digest = definitionShapeDigest({ name: 'read', description: 'EVIL' }) }
  const r = run({ observed: withDigests(obs) })
  out.P2_shape_swap_no_baseline = { counts: r.counts }
}
// P3 — cross-boot Definition Body replacement with IDENTICAL model-facing shape: snapshot digest + reconcile.
{
  const base = fixture(); const obs = fixture()
  obs.world.boot_id = 'other-boot'
  for (const s of obs.scopes) { const t = s.tools.find((x) => x.name === 'bash'); t.definition_identity = 'def#evil' }
  const pinned = withDigests(obs)
  const r = run({ observed: pinned, baseline: base })
  out.P3_crossboot_body_swap_same_shape = { snapshot_digest_equal: pinned.snapshot_digest === base.snapshot_digest, drift: r.counts.drift }
}
// P4 — sources-only drift: remove `read` from AuthoritativeToolSources but keep the obligation.
{
  const srcMut = structuredClone(pair.sources); srcMut.static_sources.host = srcMut.static_sources.host.filter((t) => t.name !== 'read')
  const clean = run({ observed: fixture() })
  const r = reconcile({ expected: pair.expected, sources: srcMut, observed: fixture(), testRowNames: TEST_ROWS }).result
  out.P4_source_removed_obligation_kept = { clean_counts: clean.counts, mutated_counts: r.counts, verdict_digest_moved: clean.verdict_digest !== r.verdict_digest }
  // add a source name with NO obligation and do not observe it
  const srcAdd = structuredClone(pair.sources); srcAdd.static_sources.host.push({ name: 'new_source_tool', file: 'x', line: 1, authority: null, gating: null, package: null })
  const r2 = reconcile({ expected: pair.expected, sources: srcAdd, observed: fixture(), testRowNames: TEST_ROWS }).result
  out.P4b_new_source_unobserved = { counts: r2.counts, verdict_digest_moved: clean.verdict_digest !== r2.verdict_digest, mentions_new_source: JSON.stringify(r2).includes('new_source_tool') }
  // the SAME new source, but observed
  const inv = fixture(); inv.scopes[0].tools.push({ name: 'new_source_tool', definition_identity: 'def#n', schema_digest: definitionShapeDigest({ name: 'new_source_tool' }), identity_vs_global: 'same', change_seq: null })
  const r3 = reconcile({ expected: pair.expected, sources: srcAdd, observed: withDigests(inv), testRowNames: TEST_ROWS }).result
  out.P4c_new_source_observed = r3.unknown.find((u) => u.name === 'new_source_tool')
}
// P5 — a KNOWN name surfacing in the WRONG scope class (host `web_fetch` appearing in the governed team lane).
{
  const base = live('observed-governed-team.20261026.json'); const obs = structuredClone(base)
  const lane = obs.scopes.find((s) => s.team_lane === true)
  lane.tools.push({ name: 'web_fetch', definition_identity: 'def#x', schema_digest: definitionShapeDigest({ name: 'web_fetch' }), identity_vs_global: 'n/a', change_seq: null })
  const clean = run({ observed: base }); const r = run({ observed: withDigests(obs) })
  out.P5_known_name_new_scope = { clean: clean.counts, mutated: r.counts, unknown_names: r.unknown.map((u) => u.name) }
}
// P6 — DRIFT kind reachability: revision / placement-identity-signal / source.
{
  const base = fixture(); const obs = fixture()
  const g = obs.scopes.find((s) => s.scope_id === 'global').tools.find((t) => t.name === 'read'); g.change_seq = 99999
  out.P6a_revision_reachable = run({ observed: withDigests(obs), baseline: base }).drift.map((d) => d.kind)
  const obs2 = fixture(); obs2.scopes.find((s) => s.scope_id === 'agent-1').tools.find((t) => t.name === 'read').identity_vs_global = 'differs'
  out.P6b_placement_signal_reachable = run({ observed: withDigests(obs2), baseline: base }).drift.map((d) => d.kind)
  const srcMut = structuredClone(pair.sources); srcMut.static_sources.host = srcMut.static_sources.host.filter((t) => t.name !== 'read')
  out.P6c_source_drift_reachable = reconcile({ expected: pair.expected, sources: srcMut, observed: withDigests(fixture()), baseline: base, testRowNames: TEST_ROWS }).result.drift.map((d) => `${d.name}/${d.kind}`)
}
// P7 — canonical digest: key-order / whitespace / tool-order invariance, and semantic sensitivity.
{
  const inv = fixture()
  const reorderKeys = (v) => Array.isArray(v) ? v.map(reorderKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, reorderKeys(x)])) : v
  const r1 = reorderKeys(inv); for (const s of r1.scopes) s.tools.reverse(); r1.scopes.reverse()
  const ws = JSON.parse(JSON.stringify(inv, null, 8))
  const sem = fixture(); sem.scopes[1].tools[3].schema_digest = definitionShapeDigest({ name: 'z' })
  const srcOnly = fixture(); srcOnly.scopes[0].tools[3].source_class = 'unattributed'
  const scopeIdOnly = fixture(); scopeIdOnly.scopes[1].scope_id = 'agent-renamed'
  out.P7_digest = {
    pinned: inv.snapshot_digest,
    reordered_keys_tools_scopes_equal: canonicalDigest(digestEligibleView(r1)) === inv.snapshot_digest,
    whitespace_equal: canonicalDigest(digestEligibleView(ws)) === inv.snapshot_digest,
    semantic_change_moves: canonicalDigest(digestEligibleView(sem)) !== inv.snapshot_digest,
    source_class_change_moves: canonicalDigest(digestEligibleView(srcOnly)) !== inv.snapshot_digest,
    scope_id_change_moves: canonicalDigest(digestEligibleView(scopeIdOnly)) !== inv.snapshot_digest,
  }
}
// P8 — live baselines: identity_vs_global degeneracy (global scope holds only row tools).
{
  for (const f of ['observed-non-team.20261026.json', 'observed-governed-team.20261026.json']) {
    const inv = live(f)
    const g = inv.scopes.find((s) => s.scope_id === 'global')
    const counts = {}
    for (const s of inv.scopes) for (const t of s.tools) counts[t.identity_vs_global] = (counts[t.identity_vs_global] ?? 0) + 1
    out[`P8_${f}`] = { global_names: g.tools.map((t) => t.name), identity_vs_global: counts, recomputed_snapshot_equal: canonicalDigest(digestEligibleView(inv)) === inv.snapshot_digest }
  }
}
// P9 — live pinned baselines replay: re-reconcile pinned inventories and compare with tracked reconcile.20261026.json.
{
  const tracked = JSON.parse(readFileSync('dev/engineering/tool-obligations/baselines/reconcile.20261026.json', 'utf8'))
  const nt = run({ observed: live('observed-non-team.20261026.json') })
  const tm = run({ observed: live('observed-governed-team.20261026.json') })
  out.P9_live_replay = { nonTeam_digest_match: nt.verdict_digest === tracked.nonTeam?.verdict_digest, team_digest_match: tm.verdict_digest === tracked.team?.verdict_digest, nonTeam_missing: nt.missing.map((m) => m.name), team_missing: tm.missing.map((m) => m.name) }
}
console.log(JSON.stringify(out, null, 1))
