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
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { checkStatePointers, checkCurrentContract } from '../../../scripts/ci-pr-gate.mjs'

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
    '| ①行ID | ②合入SHA | ③入口 | ④IO | ⑤审批 | ⑥验证 | ⑦缺陷 | ⑧级别 | V@B |',
    '|---|---|---|---|---|---|---|---|---|',
    `| read | #353=1739b262f | plane | ok | ask | 真实Host @1739b262f；证据=evidence/alpha5/x/；适用性=0/3 | none | LIVE-CONFIRMED(scope=x) | ${vab} |`,
    '| write | — | 无 | 继承 | — | 历史 @0e0b605a；适用性=3/3 | — | NOT_IMPLEMENTED/NOT_WIRED | no |',
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
      '| ①行ID | ② | ③ | ④ | ⑤ | ⑥ | ⑦ | ⑧ | V@B |',
      '|---|---|---|---|---|---|---|---|---|',
      '| a | x | y | z | w | 历史 @0e0b605a | — | **WIRED**（生产注册实证；非验收等级） | no |',
      '| b | x | y | z | w | Unit 无；n/a | 全谱未测 | NOT_IMPLEMENTED | no |',
      '| c | x | y | z | w | Unit 无；n/a | 未复验 | NOT_WIRED(装配臂未接) | no |',
      '| d | x | y | z | w | 同上；适用性=3/3 | — | LIVE-CONFIRMED(同 scope) | no |',
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
        '| ①行ID | ② | ③ | ④ | ⑤ | ⑥ | ⑦ | ⑧ | V@B |',
        '|---|---|---|---|---|---|---|---|---|',
        '| e | x | y | z | w | 真实Host @1a7c3c1cb；证据=`evidence/alpha5/missing-file.md` | — | LIVE-CONFIRMED(scope=x) | no |',
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
        '| ①行ID | ② | ③ | ④ | ⑤ | ⑥ | ⑦ | ⑧ | V@B |',
        '|---|---|---|---|---|---|---|---|---|',
        '| g | x | y | z | w | 历史 @1a7c3c1cb；证据=`evidence/alpha5/x/`；适用性=3/3 | — | NEEDS_REVALIDATION | yes |',
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
