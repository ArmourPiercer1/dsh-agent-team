import { readFileSync } from 'node:fs'
import { loadExpectedPair } from '../../../../packages/testkit/census/expected-obligations.mjs'
import { reconcile } from '../../../../packages/testkit/census/reconcile.mjs'
import { withDigests } from '../../../../packages/testkit/census/inventory.mjs'
const pair = loadExpectedPair(process.cwd())
const TEST_ROWS = ['u7_census', 'u5_canary']
const fx = () => JSON.parse(readFileSync('packages/testkit/census/fixtures/synthetic-non-team.inventory.json', 'utf8'))
const run = (o) => { const r = reconcile({ ...pair, testRowNames: TEST_ROWS, ...o }); if (!r.ok) throw new Error(JSON.stringify(r.violations)); return r.result }
const out = {}
// A: drop `read` from BOTH sides (sources + observation) -> is the sources removal itself a finding?
{
  const inv = fx(); for (const s of inv.scopes) s.tools = s.tools.filter((t) => t.name !== 'read')
  const clean = run({ observed: withDigests(inv) })
  const srcMut = structuredClone(pair.sources); srcMut.static_sources.host = srcMut.static_sources.host.filter((t) => t.name !== 'read')
  const mut = reconcile({ expected: pair.expected, sources: srcMut, observed: withDigests(inv), testRowNames: TEST_ROWS }).result
  out.A_missing_row_annotated = { source_present: clean.missing.find((m) => m.name === 'read')?.in_authoritative_sources, source_removed: mut.missing.find((m) => m.name === 'read')?.in_authoritative_sources, counts_equal: JSON.stringify(clean.counts) === JSON.stringify(mut.counts) }
}
// B: REQUIRED obligations that have NO authoritative-source row at all (orphans the sources side should flag).
{
  const named = pair.expected.obligations.filter((o) => o.kind === 'named')
  const orphan = named.filter((o) => o.source_registration === null && o.team_source_registration === null)
  out.B_required_with_no_source_row = { total_named: named.length, orphan_count: orphan.length, orphans: orphan.map((o) => `${o.name}(${o.obligation})`) }
}
// C: does anything in the reconcile output reference provider / binding / trusted-config?
{
  const r = run({ observed: fx() })
  const s = JSON.stringify(r)
  out.C_subrequirement_vocabulary_in_verdict = { provider: /provider/i.test(s), binding: /binding/i.test(s), trusted_config: /trusted|config_diff|effective_config/i.test(s) }
  const e = JSON.stringify(pair.expected); const so = JSON.stringify(pair.sources)
  out.C_subrequirement_vocabulary_in_artifacts = {
    expected_keys: [...new Set(pair.expected.obligations.flatMap((o) => Object.keys(o)))].sort(),
    has_provider_field: /"provider"\s*:/.test(e), has_binding_field: /"binding"\s*:/.test(e),
    sources_top_keys: Object.keys(pair.sources).sort(),
    mentions_trusted_config: /trusted.?config|config.?diff|effective.?config/i.test(e + so),
  }
}
// D: identical tool sets in two lanes -> does the pinned snapshot digest move when a lane is added?
{
  const inv = fx(); const before = withDigests(inv).snapshot_digest
  inv.scopes.push(structuredClone({ ...inv.scopes[1], scope_id: 'agent-2' }))
  out.D_duplicate_lane = { digest_moved: withDigests(inv).snapshot_digest !== before }
  const inv2 = fx(); const b2 = withDigests(inv2).snapshot_digest
  inv2.scopes[1].scope_id = 'agent-renamed'
  out.D_lane_rename = { digest_moved: withDigests(inv2).snapshot_digest !== b2 }
}
console.log(JSON.stringify(out, null, 1))
