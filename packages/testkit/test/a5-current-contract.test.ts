/**
 * a5-current-contract.test.ts — the 2026-10-22 docs-realignment pointer contract (Q1-Q8).
 *
 * TWO ENTRIES, DELIBERATELY SEPARATE. The first describe block pins `checkStatePointers`
 * against the ALPHA.4 HISTORICAL SHAPE — it is the LEGACY-ONLY test entry: its fixtures are
 * Alpha4 historical-form graphs, graded for historical integrity ONLY, and none of them is a
 * production path. The production path is the second block: `checkCurrentContract` against a
 * current-contract graph, plus one real-leg integration run. THE PRODUCTION PATH NEVER FALLS
 * BACK: a graph with a pristine legacy block and no `current_contract` must FAIL (fixture N5),
 * because "delete the current fields" must not silently reopen the old door.
 *
 * What the controls are for (root ruling, PLAN-v3 §C):
 *   positive  P1 current-consistent contract; P2 Alpha.4 history block untouched (legacy entry
 *             still green, and the same legacy-only graph fails the production check);
 *             P3 docs-only commit (empty drift) passes with claimed rows present.
 *   negative  N1 contract phase points back at Alpha.4; N2 active_plan target missing;
 *             N3 duplicate/conflicting active fields; N4 product drift while a row claims
 *             current verification; N5 current_contract block absent (the no-fallback rule).
 * Baseline equality with HEAD is legal by design (Q4): the forbidden logic is REQUIRING the
 * equality or REQUIRING inequality, not the equality itself — fixture P1b pins that both
 * baseline==HEAD and baseline-ancestor pass.
 */

import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { checkStatePointers, checkCurrentContract, checkPointerCurrentContract } from '../../../scripts/ci-pr-gate.mjs'
import { canonicalBytes, snapshotDigest } from '../../../scripts/authority-snapshot.mjs'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

// The checker lives in scripts/ci-pr-gate.mjs (plain JSDoc JS; test packages do not infer
// script-side JSDoc as types). These are its ACTUAL runtime return shapes — findings is a
// string[] on both checkers — declared once here so every downstream callback parameter
// receives a real contextual type. No assertion changed; no `any`, no disable-comment.
type ContractGrade = { findings: string[]; info: Record<string, unknown> }
type LegacyGrade = { findings: string[]; info?: Record<string, unknown> }

// ─────────────────────────────── LEGACY-ONLY test entry ──────────────────────────────
// Alpha4 historical-form fixtures for checkStatePointers. NOT the production path: these
// graphs carry no current_contract on purpose — they are what a round-58 Alpha.4 tree looked
// like, and the s7-round integrity rules must keep grading them unchanged (historical
// completeness, not Alpha.5 progress — the round field is NOT a phase counter).
describe('checkStatePointers — LEGACY-ONLY fixture entry (Alpha4 historical shape, NOT the production path)', () => {
  const legacyGraph = [
    'current_phase: "ALPHA.4 HARD-GOVERNANCE PHASE — EXECUTION (A4-PR7 Task 7, closing lap)"',
    'state_pointers:',
    '  round: 42',
    '  master_sha: abc1234',
    '  recovery_read: "SESSION_ROUTER_LOG.md newest entry, then this block, then the NEWEST s7_round*_records key."',
    'alpha4_governance_20261007:',
    '  a4_pr7_task7:',
    '    s7_round41_records: "x"',
    '    s7_round42_records: "y"',
  ].join('\n')
  const legacyLog = ['## 2026-10-08 round 41 — lane', '## 2026-10-08 round 42 — close'].join('\n')

  it('grades the Alpha.4 shape green on its own terms (integrity, not currency)', () => {
    const { findings }: LegacyGrade = checkStatePointers({ graphText: legacyGraph, logText: legacyLog, isAncestor: () => true })
    expect(findings).toEqual([])
  })

  it('still refuses a phase that embeds a revision — the rule that made the field checkable', () => {
    const g = legacyGraph.replace('closing lap)"', 'master = abc1234)"')
    const { findings }: LegacyGrade = checkStatePointers({ graphText: g, logText: legacyLog, isAncestor: () => true })
    expect(findings.some((f) => f.includes('embeds a master revision'))).toBe(true)
  })

  it('N5 (production boundary): the pristine legacy graph FAILS checkCurrentContract — no fallback', () => {
    const cc: ContractGrade = checkCurrentContract({
      graphText: legacyGraph,
      readFile: () => null,
      fileExists: () => false,
      revExists: () => true,
      baselineCurrent: () => true,
      driftProvider: () => [],
    })
    expect(cc.findings.some((f) => f.startsWith('Q8:') && f.includes('never falls back'))).toBe(true)
  })
})

// ─────────────────────────────── production path ───────────────────────────────
const BASELINE = '9'.repeat(40)

function contractGraph(over: Record<string, string> = {}) {
  const f = {
    phase_id: 'alpha5-tool-io-governance',
    active_plan: 'docs/plans/active/alpha5-tool-io-governance/current-execution-plan.md',
    backlog: 'docs/plans/active/alpha5-tool-io-governance/ALPHA5-EFFECTIVE-BACKLOG.md',
    matrix: 'docs/plans/active/alpha5-tool-io-governance/TOOL-CAPABILITY-MATRIX-9b2.md',
    baseline: BASELINE,
    baseline_collected: '2026-10-22T07:20:56Z',
    ...over,
  }
  return [
    'current_phase: "ALPHA.5 TOOL-IO-GOVERNANCE PHASE — EXECUTION (authority = current_contract)"',
    'current_contract:',
    `  phase_id: ${f.phase_id}`,
    `  active_plan: ${f.active_plan}`,
    `  backlog: ${f.backlog}`,
    `  matrix: ${f.matrix}`,
    `  baseline: ${f.baseline}`,
    `  baseline_collected: "${f.baseline_collected}"`,
    'blocked: []',
  ].join('\n')
}

function matrixText(vab: 'yes' | 'no' = 'no') {
  return [
    '<!-- phase-baseline-ref: dev/agent-workflow/graph.yaml#current_contract -->',
    '<!-- phase-identity: alpha5-tool-io-governance -->',
    '<!-- q5:main-begin -->',
    '| ①行ID | ②合入SHA | ③入口 | ④IO | ⑤审批 | ⑥验证 | ⑦缺陷 | ⑧级别 | V@B |',
    '|---|---|---|---|---|---|---|---|---|',
    `| read | #353=1739b262f | plane | ok | ask | 真实Host @1739b262f；证据=evidence/alpha5/x/；适用性=0/3 | none | LIVE-CONFIRMED(scope=x) | ${vab} |`,
    '| write | — | 无 | 继承 | — | 历史 @0e0b605a；适用性=3/3 | — | NOT_IMPLEMENTED/NOT_WIRED | no |',
    '<!-- q5:main-end -->',
    '<!-- q5:appendix-begin -->',
    '- **fixture_probe** [opt-in] — 逐名：UNKNOWN（主表无行；缺口登记）',
    '<!-- q5:appendix-end -->',
  ].join('\n')
}

const docs = (extra = '') =>
  `<!-- phase-baseline-ref: dev/agent-workflow/graph.yaml#current_contract -->\n<!-- phase-identity: alpha5-tool-io-governance -->\n# doc\n${extra}`
const files = (over: Record<string, string | null> = {}) => {
  const map: Record<string, string | null> = {
    'docs/plans/active/alpha5-tool-io-governance/current-execution-plan.md': docs(),
    'docs/plans/active/alpha5-tool-io-governance/ALPHA5-EFFECTIVE-BACKLOG.md': docs(),
    'docs/plans/active/alpha5-tool-io-governance/TOOL-CAPABILITY-MATRIX-9b2.md': matrixText(),
    'AGENTS.md': docs(),
    // matrixText's read-row cites evidence/alpha5/x/ — resolvable through the
    // dev/agent-workflow/ fallback (the same fallback the production leg uses).
    'dev/agent-workflow/evidence/alpha5/x': '',
    ...over,
  }
  return {
    readFile: (p: string) => map[p] ?? null,
    fileExists: (p: string) => map[p] !== undefined && map[p] !== null,
  }
}

const grade = (graph: string, fs_: ReturnType<typeof files>, drift: string[] | null = [], revExists = () => true, baselineCurrent = () => true): ContractGrade =>
  checkCurrentContract({
    graphText: graph,
    readFile: fs_.readFile,
    fileExists: fs_.fileExists,
    revExists,
    baselineCurrent,
    driftProvider: () => drift,
  })

describe('checkCurrentContract — production path (current_contract is the only current authority)', () => {
  it('P1: a current-consistent contract passes', () => {
    const r = grade(contractGraph(), files())
    expect(r.findings).toEqual([])
    expect(r.info.matrix_rows).toBe(2)
  })

  it('P1b: baseline==HEAD is legal (the forbidden logic is requiring equality, not equality)', () => {
    const r = grade(contractGraph(), files(), [], () => true, () => true)
    expect(r.findings).toEqual([])
  })

  it('P3: docs-only commit (empty drift) passes even with claimed rows', () => {
    const f = files({ 'docs/plans/active/alpha5-tool-io-governance/TOOL-CAPABILITY-MATRIX-9b2.md': matrixText('yes') })
    expect(grade(contractGraph(), f, []).findings).toEqual([])
  })

  it('N1: an active pointer dressed as Alpha.4 fails', () => {
    const g = contractGraph().replace('ALPHA.5 TOOL-IO-GOVERNANCE', 'ALPHA.4 HARD-GOVERNANCE')
    expect(grade(g, files()).findings.some((f) => f.startsWith('Q1:'))).toBe(true)
  })

  it('N2: a missing active_plan target fails', () => {
    const f = files({ 'docs/plans/active/alpha5-tool-io-governance/current-execution-plan.md': null })
    expect(grade(contractGraph(), f).findings.some((f_) => f_.startsWith('Q2:') && f_.includes('does not exist'))).toBe(true)
  })

  it('N3: a duplicate baseline INSIDE current_contract fails', () => {
    const g = contractGraph().replace(`  baseline: ${BASELINE}`, `  baseline: ${BASELINE}\n  baseline: ${'8'.repeat(40)}`)
    expect(grade(g, files()).findings.some((f) => f.startsWith('Q3:') && f.includes('exactly once'))).toBe(true)
  })

  it('P4: nested historical `baseline:` keys outside the contract block are legal (history is not a live duplicate)', () => {
    // Measured in the real graph: the Alpha.4 history sections legitimately carry their own
    // two-space `baseline:` keys; scanning all of them would grade history as a live claim.
    const g = `${contractGraph()}\nstate_pointers:\n  round: 42\n  master_sha: abc1234\n  baseline: ${'8'.repeat(40)}\n`
    expect(grade(g, files()).findings.filter((f) => f.startsWith('Q3:'))).toEqual([])
  })

  it('N4: product drift voids rows that claim current verification', () => {
    const f = files({ 'docs/plans/active/alpha5-tool-io-governance/TOOL-CAPABILITY-MATRIX-9b2.md': matrixText('yes') })
    const r = grade(contractGraph(), f, ['packages/runtime/src/plugin/live/agent-bindings.mjs'])
    expect(r.findings.some((f_) => f_.startsWith('Q7:') && f_.includes('read'))).toBe(true)
  })

  it('N5b: baseline that does not resolve is a hard fail (never a silent pass)', () => {
    const r = grade(contractGraph(), files(), [], () => false)
    expect(r.findings.some((f) => f.startsWith('Q4:') && f.includes('does not resolve'))).toBe(true)
  })

  it('N6: a failed drift comparison is FAIL, not an empty diff', () => {
    expect(grade(contractGraph(), files(), null).findings.some((f) => f.startsWith('Q7:') && f.includes('never treated as empty'))).toBe(true)
  })

  it('Q6: a second 40-hex baseline copy in a doc fails; tested SHAs do not', () => {
    const f = files({ 'AGENTS.md': docs(`baseline: ${'7'.repeat(40)}`) })
    expect(grade(contractGraph(), f).findings.some((x) => x.startsWith('Q6:')))
      .toBe(true)
    const ok = grade(contractGraph(), files())
    expect(ok.findings.filter((x) => x.startsWith('Q6:'))).toEqual([])
  })

  it('Q5: levels carry parenthetical scopes (ASCII and full-width), NOT_IMPLEMENTED and NOT_WIRED stand alone', () => {
    const matrix = [
      '<!-- phase-baseline-ref: graph#current_contract -->',
      '<!-- q5:main-begin -->',
      '| ①行ID | ② | ③ | ④ | ⑤ | ⑥ | ⑦ | ⑧ | V@B |',
      '|---|---|---|---|---|---|---|---|---|',
      '| a | x | y | z | w | 历史 @0e0b605a | — | **WIRED**（生产注册实证；非验收等级） | no |',
      '| b | x | y | z | w | Unit 无；n/a | 全谱未测 | NOT_IMPLEMENTED | no |',
      '| c | x | y | z | w | Unit 无；n/a | 未复验 | NOT_WIRED(装配臂未接) | no |',
      '| d | x | y | z | w | 同上；适用性=3/3 | — | LIVE-CONFIRMED(同 scope) | no |',
    '<!-- q5:main-end -->',
    '<!-- q5:appendix-begin -->',
    '- **fixture_probe** [opt-in] — 逐名：UNKNOWN（主表无行；缺口登记）',
    '<!-- q5:appendix-end -->',
    ].join('\n')
    const f = files({ 'docs/plans/active/alpha5-tool-io-governance/TOOL-CAPABILITY-MATRIX-9b2.md': matrix })
    const r = grade(contractGraph(), f)
    // a/b/c: parenthetical + standalone statuses are in the enum. d: LIVE-CONFIRMED is a CLAIM
    // level whose own ⑥ cell says 同上 — literal-cell discipline owes it BOTH findings: no
    // tested SHA of its own AND no evidence path/disclosure of its own.
    expect(r.findings.filter((x) => x.includes('outside the closed enum'))).toEqual([])
    const dd = r.findings.filter((x) => x.includes('row d'))
    expect(dd.some((x) => x.includes('no tested SHA'))).toBe(true)
    expect(dd.some((x) => x.includes('without an existing evidence path'))).toBe(true)
  })

  // ─────────── batch-3: the six bad graphs the reviewer built by hand that ALL graded
  // green under the batch-2 checks. Each is now a named negative control; the fix was made
  // in the checker, never by weakening an assertion (root ruling 2026-10-22).
  describe('batch-3 hardening — six formerly-green bad graphs, one control each', () => {
    it('① AGENTS ref aimed at old/alpha4 AND body still declaring Alpha.4 as current', () => {
      const agents = `<!-- phase-baseline-ref: docs/plans/old/alpha4/plan.md -->\n<!-- phase-identity: alpha4-permission-governance -->\n**当前阶段（2026-10-07）**：**Alpha.4 硬治理阶段**\n`
      const f = files({ 'AGENTS.md': agents })
      const r = grade(contractGraph(), f)
      expect(r.findings.some((x) => x.startsWith('Q6:') && x.includes('targets docs/plans/old/alpha4/plan.md'))).toBe(true)
      expect(r.findings.some((x) => x.startsWith('Q6:') && x.includes('declares 当前阶段 Alpha.4'))).toBe(true)
    })

    it('② active_plan body declaring its own phase historical (substring-presence checks passed it)', () => {
      const plan = `<!-- phase-baseline-ref: dev/agent-workflow/graph.yaml#current_contract -->\n<!-- phase-identity: alpha5-tool-io-governance -->\n- **当前阶段**：Alpha.4（historical；Alpha.5 未开始）\n`
      const f = files({ 'docs/plans/active/alpha5-tool-io-governance/current-execution-plan.md': plan })
      expect(grade(contractGraph(), f).findings.some((x) => x.startsWith('Q6:') && x.includes('active_plan body declares 当前阶段 Alpha.4'))).toBe(true)
    })

    it('③ a duplicated active_plan field whose second copy points at Alpha.4', () => {
      // DUPLICATED field: the Alpha.4 copy is ADDED above the current one (a retarget would
      // be a different bug; the shape that fooled batch 2 was two declarations, both present).
      const g = contractGraph().replace(
        '  active_plan: docs/plans/active/alpha5-tool-io-governance/current-execution-plan.md',
        '  active_plan: docs/plans/active/alpha4-permission-governance/alpha4-implementation-plan.md\n  active_plan: docs/plans/active/alpha5-tool-io-governance/current-execution-plan.md',
      )
      expect(grade(g, files()).findings.some((x) => x.startsWith('Q3:') && x.includes('active_plan must appear exactly once'))).toBe(true)
    })

    it('④ a matrix claim citing evidence/…/missing-file.md that does not exist', () => {
      const matrix = [
        '<!-- phase-baseline-ref: graph#current_contract -->',
        '<!-- phase-identity: alpha5-tool-io-governance -->',
        '<!-- q5:main-begin -->',
        '| ①行ID | ② | ③ | ④ | ⑤ | ⑥ | ⑦ | ⑧ | V@B |',
        '|---|---|---|---|---|---|---|---|---|',
        '| e | x | y | z | w | 真实Host @1a7c3c1cb；证据=`evidence/alpha5/missing-file.md` | — | LIVE-CONFIRMED(scope=x) | no |',
          '<!-- q5:main-end -->',
        '<!-- q5:appendix-begin -->',
        '- **fixture_probe** [opt-in] — 逐名：UNKNOWN（主表无行；缺口登记）',
        '<!-- q5:appendix-end -->',
    ].join('\n')
      const f = files({ 'docs/plans/active/alpha5-tool-io-governance/TOOL-CAPABILITY-MATRIX-9b2.md': matrix })
      const r = grade(contractGraph(), f)
      expect(r.findings.some((x) => x.startsWith('Q5:') && x.includes('missing-file.md') && x.includes('do not resolve in-repo'))).toBe(true)
    })

    it('⑤ phase_id = nonsense is rejected by the canonical-id whitelist', () => {
      const r = grade(contractGraph({ phase_id: 'nonsense' }), files())
      expect(r.findings.some((x) => x.startsWith('Q2:') && x.includes('canonical id'))).toBe(true)
    })

    it('⑥ blocked:[BL-999] — a phantom backlog ID is graded; BL-01, which exists, is not', () => {
      const bg = docs() + '\n| BL-01 | x | OPEN | x |\n'
      const f = files({ 'docs/plans/active/alpha5-tool-io-governance/ALPHA5-EFFECTIVE-BACKLOG.md': bg })
      const bad = grade(contractGraph().replace('blocked: []', 'blocked: [BL-999]'), f)
      expect(bad.findings.some((x) => x.startsWith('Q1:') && x.includes('BL-999') && x.includes('does not exist in the backlog'))).toBe(true)
      const good = grade(contractGraph().replace('blocked: []', 'blocked: [BL-01]'), f)
      expect(good.findings.filter((x) => x.startsWith('Q1:') && x.includes('BL-01'))).toEqual([])
    })

    it('NEEDS_REVALIDATION must carry V@B=no; flipping the level alone is red', () => {
      const matrix = [
        '<!-- phase-baseline-ref: graph#current_contract -->',
        '<!-- phase-identity: alpha5-tool-io-governance -->',
        '<!-- q5:main-begin -->',
        '| ①行ID | ② | ③ | ④ | ⑤ | ⑥ | ⑦ | ⑧ | V@B |',
        '|---|---|---|---|---|---|---|---|---|',
        '| g | x | y | z | w | 历史 @1a7c3c1cb；证据=`evidence/alpha5/x/`；适用性=3/3 | — | NEEDS_REVALIDATION | yes |',
          '<!-- q5:main-end -->',
        '<!-- q5:appendix-begin -->',
        '- **fixture_probe** [opt-in] — 逐名：UNKNOWN（主表无行；缺口登记）',
        '<!-- q5:appendix-end -->',
    ].join('\n')
      const f = files({ 'docs/plans/active/alpha5-tool-io-governance/TOOL-CAPABILITY-MATRIX-9b2.md': matrix })
      const r = grade(contractGraph(), f)
      expect(r.findings.some((x) => x.startsWith('Q7:') && x.includes('row g') && x.includes('V@B=yes'))).toBe(true)
      const flipped = matrix.replace('| yes |', '| no |')
      const ok = grade(contractGraph(), files({ 'docs/plans/active/alpha5-tool-io-governance/TOOL-CAPABILITY-MATRIX-9b2.md': flipped }))
      expect(ok.findings.filter((x) => x.includes('row g'))).toEqual([])
    })

    it('GROUP A: every current field is counted, not just baseline (duplicated collected/matrix)', () => {
      const dup = contractGraph().replace('blocked: []', '  baseline_collected: "2026-10-23T00:00:00Z"\nblocked: []')
      // The duplicate sits BEFORE blocked: — inside the block; count must catch it.
      expect(grade(dup, files()).findings.some((x) => x.startsWith('Q3:') && x.includes('baseline_collected must appear exactly once'))).toBe(true)
    })
  })

  // Annex boundary contract (phase-review ruling): the 9-cell law is REGION-BOUND and the
  // appendix carries its own minimal contract. Three named negatives + one positive, reusing
  // this file. Nothing here claims CI proves the live Host tool set — it audits the static
  // catalog's self-consistency only (the dynamic-enumeration gap stays a document sentence).
  describe('Q5 boundary + Q5a appendix minimal contract', () => {
    const annex = (entries: string[], mainRow = '| read (M-01) | x | plane | ok | ask | 装配在册 | none | WIRED | no |') =>
      [
        '<!-- phase-baseline-ref: dev/agent-workflow/graph.yaml#current_contract -->',
        '<!-- phase-identity: alpha5-tool-io-governance -->',
        '<!-- q5:main-begin -->',
        '| ①行ID | ② | ③ | ④ | ⑤ | ⑥ | ⑦ | ⑧ | V@B |',
        '|---|---|---|---|---|---|---|---|---|',
        mainRow,
        '<!-- q5:main-end -->',
        '<!-- q5:appendix-begin -->',
        ...entries,
        '<!-- q5:appendix-end -->',
      ].join('\n')
    const gradeMatrix = (matrix: string): ContractGrade =>
      grade(contractGraph(), files({ 'docs/plans/active/alpha5-tool-io-governance/TOOL-CAPABILITY-MATRIX-9b2.md': matrix }))

    it('negative 4 (round 2): an entry that declares NO mapping — no citation, no gap registration — is graded', () => {
      const r = gradeMatrix(annex(['- **silent_ghost** [default] — 逐名：字段留空，不引用不登记']))
      expect(r.findings.some((x: string) => x.startsWith('Q5a:') && x.includes('silent_ghost') && x.includes('no mapping'))).toBe(true)
    })

    it('negative 5 (round 2): an appendix region with zero entries is graded (no empty-annex green)', () => {
      const r = gradeMatrix(annex([]))
      expect(r.findings.some((x: string) => x.startsWith('Q5a:') && x.includes('appendix region is empty'))).toBe(true)
    })

    it('negative 6 (round 2): deleting a boundary marker grades red — the production path has no fallback', () => {
      const stripped = annex(['- **read** [default] — 主表 read (M-01) 行事实']).replace('<!-- q5:main-begin -->\n', '')
      const r = gradeMatrix(stripped)
      expect(r.findings.some((x: string) => x.startsWith('Q5:') && x.includes('q5:main-begin') && x.includes('exactly once'))).toBe(true)
    })

    it('positive: appendix entries citing existing stable IDs pass, and appendix lines never hit the 9-cell law', () => {
      const r = gradeMatrix(annex([
        '- **read** [default] — 逐名适用：主表 read (M-01) 行事实',
        '- **terminal_open** [opt-in] — 逐名：UNKNOWN（主表无行；缺口登记）',
        '- **interrupt_agent** [subagent 族侧] — UNKNOWN',
        '- **interrupt_agent** [上游 team 族侧] — UNKNOWN；同名分实现保留',
      ]))
      expect(r.findings.filter((x: string) => x.startsWith('Q5'))).toEqual([])
    })

    it('negative 1: an appendix entry with an empty static tool name is graded', () => {
      const r = gradeMatrix(annex(['- **** [default] — 主表 read (M-01)']))
      expect(r.findings.some((x: string) => x.startsWith('Q5a:') && x.includes('empty static tool name'))).toBe(true)
    })

    it('negative 2: a duplicated name under the same side-tag is graded; across side-tags it stays legal', () => {
      const dup = gradeMatrix(annex([
        '- **read** [default] — 主表 read (M-01)',
        '- **read** [default] — 主表 read (M-01)',
      ]))
      expect(dup.findings.some((x: string) => x.startsWith('Q5a:') && x.includes('duplicated'))).toBe(true)
    })

    it('negative 3: a dangling mapping — the appendix cites a stable ID no main row carries', () => {
      const r = gradeMatrix(annex(['- **ghost** [default] — 逐名适用：主表 ghost (M-99) 行事实']))
      expect(r.findings.some((x: string) => x.startsWith('Q5a:') && x.includes('M-99') && x.includes('dangling mapping'))).toBe(true)
    })
  })

  // Production-path pin: the leg grades THIS tree, so it also guards the very docs it grades.
  // (During the 2026-10-22 review-list rework this test was pinned skipped with a reason rather
  // than weakening the check; the correction commit is what makes it green again.)
  it('production integration: the real state-freshness leg passes on this tree (graph-parse + contract Q1-Q8)', () => {
    const r = spawnSync(process.execPath, ['scripts/ci-pr-gate.mjs', '--only', 'graph-parse', '--only', 'state-freshness'], {
      cwd: REPO,
      encoding: 'utf8',
      timeout: 120_000,
    })
    const out = `${r.stdout}${r.stderr}`
    expect(out).toContain('DSH-CI-LEG leg=graph-parse verdict=pass')
    expect(out).toContain('DSH-CI-LEG leg=state-freshness verdict=pass')
    expect(out).toContain('DSH-CI-VERDICT pass')
    expect(r.status).toBe(0)
  })
})

// ─────────────────────────── U2 pointer-mode production entry ──────────────────────────
// After the G2 switchover the production SOURCE of the six values is the snapshot the live
// pointer resolves to; this block pins that entry with the same fixture philosophy as the
// legacy block above (in-memory docs, tmp-dir authority files, real loader). The controls
// here are the MC-10 set: pointer green through the SAME core (all six surfaced), forged
// snapshot RED, two-current RED, absent pointer RED. Full transaction/restore semantics are
// pinned in tests/s2-authority/current-authority-pointer.test.mjs (plain-node suite).
describe('checkPointerCurrentContract — U2 pointer-mode production entry (the post-switch default)', () => {
  const snapshotSix = {
    phase_id: 'alpha5-tool-io-governance',
    active_plan: 'docs/plans/active/alpha5-tool-io-governance/current-execution-plan.md',
    backlog: 'docs/plans/active/alpha5-tool-io-governance/ALPHA5-EFFECTIVE-BACKLOG.md',
    matrix: 'docs/plans/active/alpha5-tool-io-governance/TOOL-CAPABILITY-MATRIX-9b2.md',
    baseline: BASELINE,
    baseline_collected: '2026-10-22T07:20:56Z',
  }
  const POINTER_REF = 'dev/engineering/current-authority.json'
  // Post-switch carriers cite the POINTER — the same Q6 law, the moved target (control C5
  // in the plain-node suite pins that the retired block citation now grades red).
  const pdocs = (extra = '') =>
    `<!-- phase-baseline-ref: ${POINTER_REF} -->\n<!-- phase-identity: alpha5-tool-io-governance -->\n# doc\n${extra}`
  const pmatrix = () => matrixText().replace('dev/agent-workflow/graph.yaml#current_contract', POINTER_REF)
  const pfiles = () => {
    const map: Record<string, string | null> = {
      'AGENTS.md': pdocs(),
      [snapshotSix.active_plan]: pdocs(),
      [snapshotSix.backlog]: pdocs(),
      [snapshotSix.matrix]: pmatrix(),
      'dev/agent-workflow/evidence/alpha5/x': '',
    }
    return { readFile: (p: string) => map[p] ?? null, fileExists: (p: string) => map[p] !== undefined && map[p] !== null }
  }
  const POINTER_GRAPH = 'current_phase: "ALPHA.5 TOOL-IO-GOVERNANCE PHASE — EXECUTION (authority = current_contract)"\nblocked: []\n'

  /** Real tmp root with a PUBLISHED snapshot + pointer (same bytes the transaction writes).
   *  `noPointer: true` publishes the snapshot only — the absent-pointer control. */
  const ptrRoot = ({ noPointer = false, ...sixOver }: { noPointer?: boolean } & Record<string, unknown> = {}) => {
    const root = mkdtempSync(join(REPO, '.tmp-a5-ptr-'))
    try {
      mkdirSync(join(root, 'dev', 'engineering', 'authority-snapshots'), { recursive: true })
      const snap: Record<string, unknown> = {
        schema_version: 1,
        snapshot_version: 'as20261025r9',
        supersedes: null,
        authored_from: `dev/agent-workflow/graph.yaml#current_contract@${'1'.repeat(40)}`,
        published_by: 'fixture:a5-pointer-test',
        published_utc: '2026-10-25T10:00:00Z',
        current_phase_statement: 'ALPHA.5 TOOL-IO-GOVERNANCE PHASE — EXECUTION (authority = current_contract)',
        current_contract: { ...snapshotSix, ...sixOver },
      }
      snap.content_digest = snapshotDigest(snap)
      writeFileSync(join(root, 'dev/engineering/authority-snapshots/as20261025r9.json'), JSON.stringify(snap, null, 2) + '\n')
      if (!noPointer) {
        writeFileSync(join(root, POINTER_REF), Buffer.concat([canonicalBytes({ snapshot_version: 'as20261025r9', content_digest: snap.content_digest as string }), Buffer.from('\n')]))
      }
    } catch (e) { rmSync(root, { recursive: true, force: true }); throw e }
    return root
  }
  const gradePtr = (root: string, graphText = POINTER_GRAPH): ContractGrade & { refused?: string } =>
    checkPointerCurrentContract({
      root, graphText, ...pfiles(),
      revExists: () => true, baselineCurrent: () => true, driftProvider: () => [],
    }) as ContractGrade & { refused?: string }

  it('P1 the pointer tree grades green through the SAME core, with all six values and the source recorded', () => {
    const root = ptrRoot()
    try {
      const r = gradePtr(root)
      expect(r.findings).toEqual([])
      expect(r.info.contract).toEqual({ ...snapshotSix })
      const src = r.info.authority_source as { kind: string; content_digest: string }
      expect(src.kind).toBe('pointer')
      expect(String(src.content_digest)).toMatch(/^sha256:[0-9a-f]{64}$/)
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  it('N1 forged snapshot bytes after publish → named RED, never a fallback to any other source', () => {
    const root = ptrRoot()
    try {
      const f = join(root, 'dev/engineering/authority-snapshots/as20261025r9.json')
      const snap = JSON.parse(readFileSync(f, 'utf8'))
      snap.current_contract.baseline = '8'.repeat(40)
      writeFileSync(f, JSON.stringify(snap, null, 2) + '\n')
      const r = gradePtr(root)
      expect(r.findings.some((x) => x.startsWith('AUTHORITY_POINTER_') && x.includes('never re-derived from graph.yaml'))).toBe(true)
      expect(r.info.contract).toBeUndefined()
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  it('N2 two-current: a current_contract block reappearing beside the pointer is RED by name', () => {
    const root = ptrRoot()
    try {
      const r = gradePtr(root, `${POINTER_GRAPH}current_contract:\n  phase_id: alpha5-tool-io-governance\n  baseline: ${BASELINE}\n`)
      expect(r.refused).toBe('TWO_CURRENT_AUTHORITY')
      expect(r.findings[0]).toContain('TWO_CURRENT_AUTHORITY')
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  it('N3 absent pointer + absent block = RED: the pointer entry has no graph fallback', () => {
    const root = ptrRoot({ noPointer: true })
    try {
      const r = gradePtr(root)
      expect(r.findings.some((x) => x.startsWith('AUTHORITY_POINTER_ABSENT'))).toBe(true)
    } finally { rmSync(root, { recursive: true, force: true }) }
  })
})
