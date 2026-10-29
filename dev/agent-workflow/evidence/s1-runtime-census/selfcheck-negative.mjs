/**
 * Pure negative controls for the census oracle extension (root fix #2, no Host, no world).
 * Gate covered EXACTLY: (1) drop one tool's identity row, (2) wrong scope ref on a row,
 * (3) names without identity bindings — each MUST FAIL; fixture-A === calibration alone must
 * NOT carry the gate (mutation 4). Nothing beyond these is asserted (gate not widened).
 * Run: node selfcheck-negative.mjs   (exit 0 = all negative controls behave as required)
 */
import { censusExtChecks } from './s1c-run.mjs'

const TOOL = 's1_m1_probe'
const names = ['aa_alpha', 'bb_beta', 'cc_gamma', TOOL]

function baselineRows() {
  const identity = names.map((n) => ({
    name: n, present: true, defType: 'object', execType: 'function',
    defRefId: `def-${n}`, execRefId: `exec-${n}`, scopeRefId: 'scope-1', repeatGetSameRef: true,
    ...(n === TOOL ? { fixtureCalib: { defIsDefinitionA_by_eq: true, execIsDefinitionAExec_by_eq: true } } : {}),
  }))
  return [
    { leg: 'guard-armed', tag: 'call2', approvedFp: `def-${TOOL}`, approvedPresent: true },
    { leg: 'body-ran', tag: 'call2', callId: 'c2', body: 'A', ran: true, failed: [] },
    {
      leg: 'census', tag: 'call2', callId: 'c2', rootCallId: 'c2',
      scopeRefId: 'scope-1', schemasScopeRefId: 'scope-1', getScopeRefId: 'scope-1',
      registeredVisibleNames: [...names], registeredVisibleCount: names.length, visibleIncludesFixture: true,
      identity_rows: identity,
    },
  ]
}

const MUST = {
  drop_row: 'census_identity_rows_exact_correspondence',
  wrong_scope: 'census_identity_rows_same_scope',
  names_only: 'census_identity_rows_all_fields_bound',
}

let bad = 0
const report = (name, ok, detail) => { if (!ok) bad += 1; console.log(`[${ok ? 'OK' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`) }

// Baseline: every extension check true.
const base = censusExtChecks({ rows: baselineRows() })
report('baseline_all_true', Object.values(base).every(Boolean), Object.entries(base).filter(([, v]) => !v).map(([k]) => k).join(','))

// Mutation 1: delete one non-fixture identity row ⇒ correspondence (and row-count match) FAIL.
const m1 = baselineRows()
m1[2].identity_rows = m1[2].identity_rows.filter((r) => r.name !== 'bb_beta')
const e1 = censusExtChecks({ rows: m1 })
report('neg1_drop_row_fails', e1[MUST.drop_row] === false && e1.census_identity_row_count_matches_visible === false)

// Mutation 2: one row bound to a wrong scope ref ⇒ same-scope FAIL.
const m2 = baselineRows()
m2[2].identity_rows[1] = { ...m2[2].identity_rows[1], scopeRefId: 'scope-WRONG' }
const e2 = censusExtChecks({ rows: m2 })
report('neg2_wrong_scope_fails', e2[MUST.wrong_scope] === false)

// Mutation 3: names without identity (def/exec refs absent) ⇒ bound-fields FAIL even with
// fixture calibration true (calibration cannot substitute for the other rows).
const m3 = baselineRows()
m3[2].identity_rows = m3[2].identity_rows.map((r) => ({ ...r, defRefId: null, execRefId: null }))
const e3 = censusExtChecks({ rows: m3 })
report('neg3_names_without_identity_fails', e3[MUST.names_only] === false && e3.census_fixture_A_calibration_by_eq === true)

// Mutation 4 (calibration does not carry the gate): names-only rows + fixture calibration —
// at least the binding/correspondence gate must reject despite calibration true.
report('neg4_calibration_not_a_substitute', e3[MUST.names_only] === false && e3.census_repeat_get_reference_stable === true)

console.log(bad === 0 ? 'SELFCHECK-NEGATIVE: ALL REQUIRED FAILURES BEHAVE (gate exactly as scoped)' : `SELFCHECK-NEGATIVE: ${String(bad)} MISBEHAVIOR(S)`)
process.exit(bad === 0 ? 0 : 1)
