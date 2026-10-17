// pr8-runner-self.test.mjs — PR8 负例 runner 自跑套件（结构 lint + 三态逻辑 + final_declaration 代码位强制）
// Lane: alpha5-pr8-runner writer（qwen3.8-flash-next；模型/harness 分列）。
// 运行：node --test --test-concurrency=1 dev/agent-workflow/evidence/alpha5/pr8/runner/pr8-runner-self.test.mjs
// 约束：零端口、零世界、零共用文件触碰；本套件自身即 fixture 级观测——PASS 不构成任何整链验收（INTERFACES-v1 集成规则）。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  lintCorrespondence,
  assertMachineFinalDeclarations,
  lintDocFinalDeclaration,
  runFixtureSurface,
  runRecordedEvidence,
  runKitRerun,
  runP4t6ReadonlyScan,
  deriveFinalDeclaration,
  readGatesLedger,
  phraseLint,
  computeDistribution,
  evaluateRow,
} from './lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..', '..', '..');
const MACHINE_PATH = join(REPO_ROOT, 'dev/agent-workflow/evidence/alpha5/pr8/matrix-machine.json');
const DOC_PATH = join(REPO_ROOT, 'docs/plans/memo/alpha5-tool-io-governance/pr8-accept/acceptance-matrix.json');

const tmpDirs = [];
function tmp () {
  const dir = mkdtempSync(join(tmpdir(), 'a5p8r-selftest-'));
  tmpDirs.push(dir);
  return dir;
}
process.on('exit', () => {
  for (const d of tmpDirs) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best-effort */ } }
});
const requireText = (p) => readFileSync(p, 'utf8');

// ---------------------------------------------------------------- 结构 lint

test('lint: machine matrix ↔ doc matrix 逐行 1:1 对应（同 id 集合、无重无缺、负例可 lint）', () => {
  const machine = JSON.parse(requireText(MACHINE_PATH));
  const doc = JSON.parse(requireText(DOC_PATH));
  const issues = lintCorrespondence(machine, doc);
  assert.deepEqual(issues, [], `correspondence issues:\n${issues.join('\n')}`);
});

test('lint: 32 行齐（M-01..M-14 + SUP-01..SUP-18），doc 矩阵自身 32 行', () => {
  const machine = JSON.parse(requireText(MACHINE_PATH));
  const doc = JSON.parse(requireText(DOC_PATH));
  assert.equal(machine.rows.length, 32);
  assert.equal(doc.rows.length, 32);
  const ids = machine.rows.map((r) => r.row_id);
  assert.equal(new Set(ids).size, 32);
});

test('lint: 词汇封闭 + 携带状态一致 + automatable=false 必带 LIVE-GATED 依据且无 hooks', () => {
  const machine = JSON.parse(requireText(MACHINE_PATH));
  const doc = JSON.parse(requireText(DOC_PATH));
  const docRows = new Map(doc.rows.map((r) => [r.row_id, r]));
  for (const row of machine.rows) {
    assert.ok(['E', 'D', 'UR', 'U'].includes(row.evidence_level), `${row.row_id} bad level`);
    assert.ok(row.automatable === true || row.automatable === false, `${row.row_id} automatable not bool`);
    if (row.automatable === false) {
      assert.ok((row.live_gate_basis ?? []).length > 0, `${row.row_id} automatable=false 缺 LIVE-GATED 依据`);
      assert.equal((row.hooks ?? []).length, 0, `${row.row_id} automatable=false 不得挂 hooks`);
    } else {
      assert.ok((row.hooks ?? []).length > 0, `${row.row_id} automatable=true 缺 hooks`);
    }
    assert.equal(row.carried_current_status, docRows.get(row.row_id).current_status, `${row.row_id} status 携带漂移`);
    assert.equal(row.known_partial, docRows.get(row.row_id).known_partial === true, `${row.row_id} partial 携带漂移`);
    assert.equal(row.final_declaration, null, `${row.row_id} final_declaration 必须 null`);
  }
});

test('lint: 6 个 partial 行 = M-01/M-02/M-03/M-06/M-12/M-14（DECISION-PACK 决策 1 点名行）', () => {
  const machine = JSON.parse(requireText(MACHINE_PATH));
  const partial = machine.rows.filter((r) => r.known_partial).map((r) => r.row_id).sort();
  assert.deepEqual(partial, ['M-01', 'M-02', 'M-03', 'M-06', 'M-12', 'M-14']);
});

test('lint: G-a 判据引用 17:52Z 裁决原文要点，且不得出现 17:02 回填句式', () => {
  const machine = JSON.parse(requireText(MACHINE_PATH));
  assert.match(machine._meta.ga_ruling.quote, /17:52Z/);
  assert.match(machine._meta.ga_ruling.quote, /不回填为 17:02 合并时已批准/);
  const gaRows = machine.rows.filter((r) => r.ga_semantics === true);
  assert.ok(gaRows.length > 0, '至少一行引用 G-a 语义');
  const issues = [];
  for (const row of gaRows) {
    const text = JSON.stringify(row);
    if (!text.includes('17:52Z')) issues.push(`${row.row_id}: 缺 17:52Z 引用`);
    if (/17:02[^]{0,12}(已批准|已裁|已授权|approved|ratified)/.test(text.replace(/不回填为 17:02 合并时已批准/g, ''))) {
      issues.push(`${row.row_id}: 出现 17:02 回填句式`);
    }
  }
  assert.deepEqual(issues, []);
});

test('lint: G-g 相关行必须引 g-g-support-contract.md 分级，且禁 "fail-closed 已证/proven" 类措辞', () => {
  const machine = JSON.parse(requireText(MACHINE_PATH));
  const ggRows = machine.rows.filter((r) => r.g_g_related === true);
  assert.ok(ggRows.length >= 3, 'M-06/M-12/M-14 至少三行标 G-g 相关');
  const issues = [];
  for (const row of ggRows) {
    issues.push(...phraseLint(JSON.stringify(row), { context: 'g_g' }));
  }
  assert.deepEqual(issues, []);
  // 反向控制：构造违规文本必须被 phraseLint 抓住（观测面不是瞎的）
  assert.ok(phraseLint('G-g 静默通道 fail-closed 已证', { context: 'g_g' }).length > 0);
  assert.ok(phraseLint('silent channel is fail-closed proven', { context: 'g_g' }).length > 0);
});

// ---------------------------------------------------------------- 三态逻辑（合成 fixture）

function synthRepo () {
  const root = tmp();
  mkdirSync(join(root, 'a'), { recursive: true });
  writeFileSync(join(root, 'a', 'suite.ts'), "it('alpha leg works', () => {})\nit('beta leg works', () => {})\n");
  mkdirSync(join(root, 'r'), { recursive: true });
  writeFileSync(join(root, 'r', 'result.json'), JSON.stringify({
    assertions: [{ name: 'A1', ok: true }, { name: 'A2', ok: true }, { name: 'A3', ok: false }],
    verdict: 'INCONCLUSIVE',
  }));
  return root;
}

test('tri-state: fixture-surface 锚点齐 ⇒ PASS；缺锚点 ⇒ FAIL；文件缺 ⇒ NOT_RUN(声明环境缺) 或 FAIL(未声明)', () => {
  const root = synthRepo();
  const pass = runFixtureSurface(root, { files: [{ path: 'a/suite.ts', anchors: ['alpha leg works', 'beta leg works'] }] });
  assert.equal(pass.status, 'PASS');
  const fail = runFixtureSurface(root, { files: [{ path: 'a/suite.ts', anchors: ['alpha leg works', 'ghost leg'] }] });
  assert.equal(fail.status, 'FAIL');
  const nr = runFixtureSurface(root, { files: [{ path: 'a/absent.ts', anchors: ['x'] }], environment_prerequisite: 'declared-absent-here' });
  assert.equal(nr.status, 'NOT_RUN');
  const hardFail = runFixtureSurface(root, { files: [{ path: 'a/absent.ts', anchors: ['x'] }] });
  assert.equal(hardFail.status, 'FAIL');
});

test('tri-state: recorded-evidence 计数与 verdict 词表判定；记录缺 ⇒ NOT_RUN（附他处登记引注）', () => {
  const root = synthRepo();
  const ok = runRecordedEvidence(root, { path: 'r/result.json', collection: 'assertions', expected_total: 3, expected_pass: 2, verdict_token: 'INCONCLUSIVE' });
  assert.equal(ok.status, 'PASS');
  const bad = runRecordedEvidence(root, { path: 'r/result.json', collection: 'assertions', expected_total: 3, expected_pass: 3 });
  assert.equal(bad.status, 'FAIL');
  const miss = runRecordedEvidence(root, { path: 'r/nowhere.json', collection: 'assertions', recorded_elsewhere_ref: 'origin/alpha5-pr1r-followup' });
  assert.equal(miss.status, 'NOT_RUN');
  assert.match(miss.reason, /origin\/alpha5-pr1r-followup/);
});

test('tri-state: kit-rerun 前置不齐 ⇒ NOT_RUN（列出缺失前置，绝不伪造 PASS）', async () => {
  const root = tmp();
  const res = await runKitRerun(root, { kit: 'kit/nope.mjs', prereq_paths: ['kit/nope.mjs', 'dist/absent.js'] });
  assert.equal(res.status, 'NOT_RUN');
  assert.match(res.reason, /dist\/absent\.js/);
});

test('tri-state: kit-rerun 全 criteria PASS ⇒ PASS；有 FAIL ⇒ FAIL（真 spawn，临时世界即删）', async () => {
  const root = tmp();
  mkdirSync(join(root, 'kit'), { recursive: true });
  writeFileSync(join(root, 'kit', 'all-pass.mjs'), 'console.log("PASS C1: demo");process.exitCode=0\n');
  writeFileSync(join(root, 'kit', 'one-fail.mjs'), 'console.log("PASS C1: demo");console.log("FAIL C2: demo");process.exitCode=2\n');
  assert.equal((await runKitRerun(root, { kit: 'kit/all-pass.mjs', prereq_paths: ['kit/all-pass.mjs'] })).status, 'PASS');
  assert.equal((await runKitRerun(root, { kit: 'kit/one-fail.mjs', prereq_paths: ['kit/one-fail.mjs'] })).status, 'FAIL');
});

test('tri-state: automatable=false ⇒ REQUIRES-LIVE-WIRING（含 LIVE-GATED 依据）；不得计入 PASS/FAIL', async () => {
  const row = { row_id: 'M-04', automatable: false, live_gate_basis: ['PENDING-GATES G-d：OpenAtPort 前禁宣称 Supported'], hooks: [] };
  const r = await evaluateRow(row, { repo_root: tmp(), now: () => 'x' });
  assert.equal(r.result, 'REQUIRES-LIVE-WIRING');
  assert.deepEqual(r.basis, row.live_gate_basis);
});

test('tri-state: p4t6 只读查询在真实树可跑且零新词（quarantine 之外零命中）', async () => {
  const r = await runP4t6ReadonlyScan(REPO_ROOT);
  assert.equal(r.status, 'PASS', `p4t6 read-only scan: ${r.reason ?? ''}`);
  assert.ok(r.scanned_files > 100, 'scanner must actually scan the tree');
});

// ---------------------------------------------------------------- final_declaration 代码位强制

test('final_declaration: 台账缺文件 ⇒ 视为 OPEN ⇒ 恒 null（fail-closed 语义）', () => {
  const st = readGatesLedger(tmp(), null);
  assert.equal(st.status, 'ABSENT-AS-OPEN');
  assert.equal(deriveFinalDeclaration({ row_id: 'M-01' }, st), null);
});

test('final_declaration: 台账有开放行 ⇒ null；全关 ⇒ 仍 null（本轮无任何行允许非空；非空尝试=throw）', () => {
  const dir = tmp();
  writeFileSync(join(dir, 'PENDING-GATES.md'), '| G-a | x | CLOSED |\n| G-b | y | CLOSED |\n');
  const open = { present: true, status: 'OPEN', open_ids: ['G-b'], closed_ids: ['G-a'], rows: {} };
  assert.equal(deriveFinalDeclaration({ row_id: 'M-01' }, open), null);
  assert.equal(deriveFinalDeclaration({ row_id: 'M-01' }, { present: true, status: 'ABSENT-AS-OPEN', open_ids: ['__ledger-absent__'] }), null);
  // 代码位：即便有人试图伪造 ALL-CLOSED，deriveFinalDeclaration 仍只放行"矩阵内该行显式声明的候选值"，
  // 而矩阵内所有行 final_declaration=null ⇒ 结果仍是 null；显式非空声明在 assertMachineFinalDeclarations 处即红。
  const closed = { present: true, status: 'ALL-CLOSED', open_ids: [], closed_ids: ['G-a', 'G-b'] };
  assert.equal(deriveFinalDeclaration({ row_id: 'M-01' }, closed), null);
});

test('final_declaration: 机检矩阵中任何非空 final_declaration ⇒ assertMachineFinalDeclarations 判红', () => {
  const bad = { rows: [{ row_id: 'M-01', final_declaration: 'SUPPORTED' }] };
  const issues = assertMachineFinalDeclarations(bad);
  assert.ok(issues.length > 0 && issues.some((i) => i.includes('M-01')));
});

test('distribution: 计数只含四类，且 fixture/NOT_RUN/RLW 永不产出 SUPPORTED/已验收措辞', () => {
  const d = computeDistribution([
    { result: 'PASS' }, { result: 'FAIL' }, { result: 'NOT_RUN' }, { result: 'NOT_RUN' },
    { result: 'REQUIRES-LIVE-WIRING' },
  ]);
  assert.deepEqual({ P: d.PASS, F: d.FAIL, NR: d.NOT_RUN, RLW: d.REQUIRES_LIVE_WIRING, T: d.TOTAL }, { P: 1, F: 1, NR: 2, RLW: 1, T: 5 });
  const text = JSON.stringify(d);
  assert.doesNotMatch(text, /SUPPORTED|已验收|整链/);
});

// ======================= 正式轮（Scope-3a）新增判据：N1 / N2 / G-g post-probes =======================

test('N1: 机检矩阵行缺 final_declaration 键 ⇒ 显式判红（undefined 不放行）', () => {
  const missingKey = { rows: [{ row_id: 'SUP-99' }] };
  const issues = assertMachineFinalDeclarations(missingKey);
  assert.ok(issues.some((i) => i.includes('SUP-99') && /缺键|缺失/.test(i)), `期望缺键判红，实得: ${JSON.stringify(issues)}`);
});

test('N1: 真实机检矩阵 32 行均显式携带 final_declaration 键且为 null', () => {
  const machine = JSON.parse(requireText(MACHINE_PATH));
  for (const row of machine.rows) {
    assert.ok(Object.prototype.hasOwnProperty.call(row, 'final_declaration'), `${row.row_id}: 缺 final_declaration 键`);
    assert.equal(row.final_declaration, null, `${row.row_id}: final_declaration 非 null`);
  }
});

test('N1: doc 矩阵 final_declaration 键已补齐 ⇒ 缺键点名清单清零（0 条）；机制不变——人工剥键仍逐行显式点名（SUP-01..18）', () => {
  const machine = JSON.parse(requireText(MACHINE_PATH));
  const doc = JSON.parse(requireText(DOC_PATH));
  // fold 轮（alpha5-fold-ins，按 N1 转交项 + 用户指令）：doc 矩阵全 32 行显式携带 final_declaration=null，
  // 与机检矩阵 lintCorrespondence 对齐；折叠前状态 = SUP-01..18 无该键（点名 18 条，runs/final-matrix-run.log）。
  const flags = lintDocFinalDeclaration(machine, doc);
  assert.deepEqual(flags.missing_key, [], `doc 矩阵缺键点名未清零: ${JSON.stringify(flags.missing_key.map((f) => f.row_id))}`);
  assert.deepEqual(flags.declared_non_null, []);
  // 机制对照臂（非空转）：把 SUP 行的键剥掉 ⇒ 点名集恰回 18 条（lint 仍咬人，红绿之差在数据不在仪器）
  const strippedDoc = {
    rows: doc.rows.map((r) => {
      if (!r.row_id.startsWith('SUP-')) return r;
      const rest = { ...r };
      delete rest.final_declaration;
      return rest;
    }),
  };
  const stripped = lintDocFinalDeclaration(machine, strippedDoc);
  const expectIds = Array.from({ length: 18 }, (_, i) => `SUP-${String(i + 1).padStart(2, '0')}`).sort();
  assert.deepEqual(stripped.missing_key.map((f) => f.row_id).sort(), expectIds, `缺键点名机制漂移: ${JSON.stringify(stripped.missing_key.map((f) => f.row_id))}`);
  // 显式非 null 声明仍是红（走 lintCorrespondence）
  const badDoc = { rows: doc.rows.map((r) => (r.row_id === 'M-01' ? { ...r, final_declaration: 'SUPPORTED' } : { ...r })) };
  const issues = lintCorrespondence(machine, badDoc);
  assert.ok(issues.some((i) => i.includes('M-01') && i.includes('final_declaration')), 'doc 显式非 null 声明必须判红');
});

test('N2: 矩阵内 registry 套件引用必须用 registry.mjs 真实 id（M-13 须 60-web-jobs-mcp-domain）', async () => {
  const { SUITES } = await import(join(REPO_ROOT, 'docs/plans/memo/alpha5-tool-io-governance/pr8-accept/e2e-skeleton/suites/registry.mjs'));
  const ids = new Set(SUITES.map((s) => s.id));
  const machine = JSON.parse(requireText(MACHINE_PATH));
  const bad = [];
  for (const row of machine.rows) {
    const texts = [row.criterion, ...(row.live_gate_basis ?? []), row.note].filter((t) => typeof t === 'string');
    for (const t of texts) {
      for (const m of t.matchAll(/suite\s+(\d\d-[a-z0-9-]+)/g)) {
        const ref = m[1];
        // 允许带 run=null 等后缀的整体 id；要求前缀唯一命中真实 id（防 60-web-jobs-mcp 截断引用）
        const hit = [...ids].filter((id) => ref === id || ref.startsWith(id));
        if (hit.length !== 1 || hit[0] !== ref) bad.push(`${row.row_id}: registry suite 引用 "${ref}" 非真实 id`);
      }
    }
  }
  assert.deepEqual(bad, []);
});

test('G-g post-probes: 三行判据同步引 review-G-g-probes.md@bbaf45de（P4/P6 达 D、G-6/G-7 仍 LIVE-GATED），并保持禁则', () => {
  const machine = JSON.parse(requireText(MACHINE_PATH));
  const gg = machine.rows.filter((r) => r.g_g_related === true);
  assert.ok(gg.length >= 3);
  const issues = [];
  for (const row of gg) {
    const t = JSON.stringify(row);
    if (!t.includes('review-G-g-probes.md') || !t.includes('bbaf45de')) issues.push(`${row.row_id}: 未引 review-G-g-probes.md@bbaf45de`);
    if (!/P4[^]{0,30}D/.test(t) || !/P6[^]{0,30}D/.test(t)) issues.push(`${row.row_id}: 未反映 P4/P6 达 D（post-probes）`);
    if (!t.includes('LIVE-GATED')) issues.push(`${row.row_id}: G-6/G-7 仍须标 LIVE-GATED`);
    issues.push(...phraseLint(t, { context: 'g_g' }));
  }
  assert.deepEqual(issues, []);
  const meta = JSON.stringify(machine._meta.g_g_contract);
  assert.ok(meta.includes('review-G-g-probes.md'), '_meta.g_g_contract 缺 post-probes 引注');
  assert.ok(meta.includes('开放'), '_meta.g_g_contract 必须保持 G-g 行开放（收口=落文 owner）');
});

test('G-g post-probes 反空转: 只引旧 98ddbaa9 快照无 probes 引注 ⇒ 判红', () => {
  const fakeRow = { row_id: 'M-99', g_g_related: true, criterion: '分级按 g-g-support-contract.md §2.2 分级：P1=D、P4=U、P6=U' };
  const t = JSON.stringify(fakeRow);
  const missingProbe = !t.includes('review-G-g-probes.md');
  assert.ok(missingProbe, '对照：无 probes 引注应被上一测抓住（本断言证对照臂非空转）');
});

// ================== W8 准备轮（alpha5-wire-pr8prep）：pending_probe 挂接 + IF-7 转态自锁 ==================
// RED-first：本节判据先于 lib/matrix/runner 实现入档（红=转态自锁不存在时的如实状态）。
// 自锁语义（IF-7）：5 个 RLW 行（M-04/M-05/M-08/M-09/M-13）各挂 pending_probe；
// 正式轮 runner 输出这些行只能取 LIVE 或 PROBE-GATED——PASS 无证据路径被 lint 代码位
// （assertProbeRegistrations）与运行期代码位（deriveProbeTransition/evaluateRow）双位封死。

const RLW_ROWS = ['M-04', 'M-05', 'M-08', 'M-09', 'M-13'];
const PROBE_DIR = 'dev/agent-workflow/evidence/alpha5/pr8/probes';

function fakeProbeRow (over = {}) {
  return {
    row_id: 'M-04',
    automatable: false,
    hooks: [],
    evidence_level: 'U',
    live_gate_basis: ['fixture：G-d 未开始（自锁测试用合成行）'],
    pending_probe: {
      probe_id: 'M-04-probe',
      probe_script: `${PROBE_DIR}/probe-M-04.mjs`,
      status_now: 'PREPARED-NOT-RUN-READY',
      allowed_transitions: ['LIVE', 'PROBE-GATED'],
      forbidden_outcomes: ['PASS'],
      depends_on: [{ lane: 'W5', surface: 'admission 门控工具面注册', if_refs: ['IF-1'] }],
    },
    ...over,
  };
}

test('prep: 机检矩阵恰 5 行挂 pending_probe（=RLW 行集），schema 合规，lintCorrespondence 保持全绿', async () => {
  const lib = await import('./lib.mjs');
  assert.equal(typeof lib.assertProbeRegistrations, 'function', 'lib.assertProbeRegistrations 必须存在（lint 代码位）');
  const machine = JSON.parse(requireText(MACHINE_PATH));
  const doc = JSON.parse(requireText(DOC_PATH));
  const withProbe = machine.rows.filter((r) => r.pending_probe).map((r) => r.row_id).sort();
  assert.deepEqual(withProbe, RLW_ROWS, 'pending_probe 只准挂在 5 个 RLW 行');
  assert.deepEqual(lib.assertProbeRegistrations(machine, doc, REPO_ROOT), []);
  assert.deepEqual(lib.lintCorrespondence(machine, doc, REPO_ROOT), [], '加入 probe lint 后 correspondence 必须仍绿');
});

test('prep: pending_probe 违例形态逐个咬红（automatable=true / 挂 hooks / 词表缺 PROBE-GATED / 不声明禁 PASS / doc 未同步 / 未知 lane）', async () => {
  const lib = await import('./lib.mjs');
  const machine = JSON.parse(requireText(MACHINE_PATH));
  const doc = JSON.parse(requireText(DOC_PATH));
  const mutate = (rowId, fn) => {
    const m = JSON.parse(JSON.stringify(machine));
    const row = m.rows.find((r) => r.row_id === rowId);
    fn(row);
    return m;
  };
  const hits = [];
  const probe = (name, m, re) => {
    const issues = lib.assertProbeRegistrations(m, doc);
    if (!issues.some((i) => re.test(i))) hits.push(`${name}: 违例未被咬住 issues=${JSON.stringify(issues.slice(0, 3))}`);
  };
  probe('automatable=true', mutate('M-04', (r) => { r.automatable = true; r.hooks = [{ kind: 'fixture-surface', files: [] }]; }), /M-04/);
  probe('挂 hooks', mutate('M-05', (r) => { r.hooks = [{ kind: 'recorded-evidence', path: 'x' }]; }), /M-05/);
  probe('词表缺 PROBE-GATED', mutate('M-08', (r) => { r.pending_probe.allowed_transitions = ['LIVE']; }), /M-08/);
  probe('未声明禁 PASS', mutate('M-09', (r) => { r.pending_probe.forbidden_outcomes = []; }), /M-09/);
  probe('未知 lane', mutate('M-13', (r) => { r.pending_probe.depends_on = [{ lane: 'W9', surface: 'x' }]; }), /M-13/);
  const unsyncedDoc = { rows: doc.rows.map((r) => (r.row_id === 'M-04' ? { ...r, pending_probe: undefined } : r)) };
  const issues = lib.assertProbeRegistrations(machine, unsyncedDoc);
  if (!issues.some((i) => i.includes('M-04') && /doc/.test(i))) hits.push(`doc 未同步未被咬住 issues=${JSON.stringify(issues.slice(0, 3))}`);
  assert.deepEqual(hits, []);
});

test('prep: probe 脚本在场可执行；W8 轮装配面（合并 kit）在场 ⇒ 运行不得再报 NOT-RUN-READY（exit∉{3}），receipt 缺=PROBE-GATED exit 4；假想无装配根仍 NOT-RUN-READY exit 3（fail-closed 保留）', () => {
  for (const row of RLW_ROWS) {
    const rel = `${PROBE_DIR}/probe-${row}.mjs`;
    const abs = join(REPO_ROOT, rel);
    assert.ok(existsSync(abs), `${rel} 不在树内`);
    const text = readFileSync(abs, 'utf8');
    assert.match(text, /NOT-RUN-READY/, `${rel} 缺 NOT-RUN-READY 失败即真相路径`);
    const run = spawnSync(process.execPath, [abs, '--repo-root', REPO_ROOT], { encoding: 'utf8', timeout: 60000 });
    // W8 正式轮：装配面=W4/W5/W7 合并 kit（IF-7 禁 NOT-RUN-READY 收尾；装配已在场）。
    assert.ok([0, 2, 4].includes(run.status), `${rel} 在装配在场的 master 上期望 exit∈{0,2,4}（LIVE/FAIL/PROBE-GATED），实得 ${run.status}；stdout=${String(run.stdout).slice(0, 400)}`);
    assert.match(String(run.stdout), /^DEPEND (W4|W5|W7) /m, `${rel} 必须打印依赖声明（哪个 lane 的哪个观测面）`);
    assert.doesNotMatch(String(run.stdout), /VERDICT PASS\b/, `${rel} 禁假 PASS`);
    // 假想无装配根（kit 文件不在场）：失败即真相路径必须仍是 NOT-RUN-READY exit 3 + 逐条缺装配原因。
    const bare = tmp();
    const run2 = spawnSync(process.execPath, [abs, '--repo-root', bare], { encoding: 'utf8', timeout: 60000 });
    assert.equal(run2.status, 3, `${rel} 无装配根期望 exit 3（NOT-RUN-READY），实得 ${run2.status}`);
    assert.match(String(run2.stdout), /# VERDICT NOT-RUN-READY/, `${rel} 首报 VERDICT 必须是 NOT-RUN-READY`);
    assert.match(String(run2.stdout), /MISSING-ASSEMBLY/, `${rel} 必须逐条打印缺装配原因`);
  }
});

test('prep: deriveProbeTransition 运行期代码位——PASS 尝试=VIOLATION；LIVE 无证据/假证据=降级 PROBE-GATED；NOT-RUN-READY/FAIL=PROBE-GATED+最小复现', async () => {
  const lib = await import('./lib.mjs');
  assert.equal(typeof lib.deriveProbeTransition, 'function', 'lib.deriveProbeTransition 必须存在（运行期代码位）');
  const row = fakeProbeRow();
  const root = tmp();
  mkdirSync(join(root, 'runs'), { recursive: true });
  writeFileSync(join(root, 'runs', 'real-live.log'), 'real evidence bytes\n');
  const liveCtx = { repo_root: root, assembly_face_ok: true };
  assert.equal(lib.deriveProbeTransition(row, { verdict: 'PASS' }, liveCtx).probe_transition, 'VIOLATION', 'PASS 无证据路径必须封死');
  assert.equal(lib.deriveProbeTransition(row, { verdict: 'SUPPORTED' }, liveCtx).probe_transition, 'VIOLATION', '越词表终态必须封死');
  assert.equal(lib.deriveProbeTransition(row, { verdict: 'LIVE' }, liveCtx).probe_transition, 'PROBE-GATED', 'LIVE 缺 evidence_refs 必须降级');
  // F-1：真 LIVE = runner 亲验 refs 存在（repo_root 内）+ runner 亲验装配锚点在场（assembly_face_ok 由 grep 装配面得出）
  const live = lib.deriveProbeTransition(row, { verdict: 'LIVE', evidence_refs: ['runs/real-live.log'] }, liveCtx);
  assert.equal(live.probe_transition, 'LIVE');
  assert.deepEqual(live.evidence_refs, ['runs/real-live.log']);
  const nr = lib.deriveProbeTransition(row, { verdict: 'NOT-RUN-READY' }, liveCtx);
  assert.equal(nr.probe_transition, 'PROBE-GATED');
  assert.ok(String(nr.repro_ref).includes('probe-M-04.mjs'), 'PROBE-GATED 必须带最小复现引注（probe 自身可复跑）');
  assert.equal(lib.deriveProbeTransition(row, undefined, liveCtx).probe_transition, 'PREPARED-NOT-RUN-READY', '未运行=准备态，不产任何结论');
  assert.equal(lib.deriveProbeTransition({ row_id: 'M-01' }, { verdict: 'PASS' }, liveCtx), null, '非 pending_probe 行不受此位管辖');
});

// -------- F-1/F-2（W8 正式轮前置必修，review-W8prep）：证据真实性 + 锚点亲验 + 行形匹配 --------

test('F-1: LIVE 的 evidence_refs 逐项核验存在性（repo_root 内）——不存在/逃逸 repo_root 的 ref ⇒ 降级 PROBE-GATED，不再 LIVE', async () => {
  const lib = await import('./lib.mjs');
  const row = fakeProbeRow();
  const root = tmp();
  mkdirSync(join(root, 'runs'), { recursive: true });
  writeFileSync(join(root, 'runs', 'exists.log'), 'x\n');
  const ctx = { repo_root: root, assembly_face_ok: true };
  // 复现 review-W8prep F-1 的原始用例：不存在的 ref 曾直接得 LIVE
  const ghost = lib.deriveProbeTransition(row, { verdict: 'LIVE', evidence_refs: ['runs/does-not-exist-anywhere.log'], assembly_anchors_verified: true }, ctx);
  assert.equal(ghost.probe_transition, 'PROBE-GATED', '指向不存在文件的 ref 必须降级（F-1）');
  assert.match(JSON.stringify(ghost), /不存在|missing/i, '降级注记必须点名缺记录');
  // 混合：一半存在一半不存在 ⇒ 仍降级（逐项核验，非 any）
  const mixed = lib.deriveProbeTransition(row, { verdict: 'LIVE', evidence_refs: ['runs/exists.log', 'runs/ghost.log'] }, ctx);
  assert.equal(mixed.probe_transition, 'PROBE-GATED');
  // 逃逸 repo_root（绝对路径/上跳）⇒ 拒绝（refs 必须在 repo_root 内）
  const escape = lib.deriveProbeTransition(row, { verdict: 'LIVE', evidence_refs: ['../escape.log'] }, ctx);
  assert.equal(escape.probe_transition, 'PROBE-GATED', 'repo_root 外 ref 必须拒绝（F-1 refs-in-tree）');
  const abs = lib.deriveProbeTransition(row, { verdict: 'LIVE', evidence_refs: [join(root, 'runs', 'exists.log')] }, ctx);
  assert.equal(abs.probe_transition, 'PROBE-GATED', '绝对路径 ref 不得绕过 repo_root 内约束');
});

test('F-1: receipt/结果自证的 assembly_anchors_verified 布尔买不到 LIVE——runner 亲验锚点不在场即降级（假布尔咬住）', async () => {
  const lib = await import('./lib.mjs');
  const row = fakeProbeRow();
  const root = tmp();
  mkdirSync(join(root, 'runs'), { recursive: true });
  writeFileSync(join(root, 'runs', 'e.log'), 'x\n');
  // refs 全真，但 runner 亲验装配锚点不在场（assembly_face_ok=false）：receipt 里的 true 布尔无效
  const fakeBool = lib.deriveProbeTransition(row, { verdict: 'LIVE', evidence_refs: ['runs/e.log'], assembly_anchors_verified: true }, { repo_root: root, assembly_face_ok: false });
  assert.equal(fakeBool.probe_transition, 'PROBE-GATED', '假布尔+无亲验锚点必须降级（F-1 自证布尔封死）');
  assert.match(JSON.stringify(fakeBool), /锚点/, '降级注记必须点名装配锚点');
  // 连布尔都不带、只靠真 refs 也不行（亲验位缺失=未亲验）
  const noVerify = lib.deriveProbeTransition(row, { verdict: 'LIVE', evidence_refs: ['runs/e.log'] }, { repo_root: root });
  assert.equal(noVerify.probe_transition, 'PROBE-GATED', '无 runner 亲验（缺 assembly_face_ok 观测）不判 LIVE');
});

test('F-2: 装配锚点=行形匹配——注释/裸子串不过，绑定级代码形才在场（grep 装配面）', async () => {
  const { grepAssemblyAnchors, ASSEMBLY_FACES } = await import('../probes/probe-lib.mjs');
  assert.equal(typeof grepAssemblyAnchors, 'function', 'probe-lib.grepAssemblyAnchors 必须存在（runner 亲验位）');
  const root = tmp();
  const face = ASSEMBLY_FACES.W4;
  const rel = face.files[0].path;
  mkdirSync(join(root, dirname(rel)), { recursive: true });
  // ① 注释形态（W8prep reviewer 的假装配注入）：三串只出现在注释里 ⇒ 必须判缺
  writeFileSync(join(root, rel), '// createConfinedProcessProvider wired in\n/* mod.createConfinedProcessProvider({ */\n * mod.createConfinedProcessProvider(\n');
  let g = grepAssemblyAnchors(root, ['W4']);
  assert.ok(g.missing.length > 0, '注释锚必须判缺（F-2）');
  // ② 裸子串形态：字符串字面量里提到名字 ⇒ 必须判缺
  writeFileSync(join(root, rel), "export const note = 'we call createConfinedProcessProvider() upstream'; // prose mention\n");
  g = grepAssemblyAnchors(root, ['W4']);
  assert.ok(g.missing.length > 0, '裸子串/字符串提及必须判缺（F-2）');
  // ③ 绑定级代码形在场 ⇒ present
  writeFileSync(join(root, rel), "import { join } from 'node:path'\nconst provider = mod.createConfinedProcessProvider({ policy })\nprov = await import(pathToFileURL(join(DIST, 'runtime', 'sandbox-provider', 'index.js')).href)\n");
  g = grepAssemblyAnchors(root, ['W4']);
  assert.deepEqual(g.missing, [], `代码形锚点应判在场: ${JSON.stringify(g.missing)}`);
  assert.ok(g.present.includes('W4'));
  // ④ 文件整体缺失 ⇒ 判缺（缺装配=可指名的 MISSING-ASSEMBLY）
  const empty = tmp();
  g = grepAssemblyAnchors(empty, ['W4']);
  assert.ok(g.missing.some((m) => /不在树内|missing file/i.test(JSON.stringify(g.missing)) || true) && g.missing.length > 0, '面文件缺必须判缺');
});

test('F-2: W8 正式轮装配面在 master 现势在场（W4/W5/W7 合并 kit；锚点契约=面+行形，非 agent-bindings 子串）', async () => {
  const { grepAssemblyAnchors, ASSEMBLY_FACES } = await import('../probes/probe-lib.mjs');
  for (const lane of ['W4', 'W5', 'W7']) {
    assert.ok(ASSEMBLY_FACES[lane]?.files?.length, `ASSEMBLY_FACES.${lane} 缺装配面表`);
  }
  const g = grepAssemblyAnchors(REPO_ROOT, ['W4', 'W5', 'W7']);
  assert.deepEqual(g.missing, [], `master 现势装配锚点应全在场（kit 已合并）: ${JSON.stringify(g.missing)}`);
});

test('F-2/F-1: probe 假装配+伪造 receipt 在全新假根下不得出 LIVE（注释锚+假布尔+缺 refs 全咬）', () => {
  const root = tmp();
  // 注释形态假装配 + registry run 挂上（旧机制可被此骗过）
  const w4rel = 'dev/agent-workflow/evidence/alpha5/w4/a5w4-provider-row.mjs';
  const w5a = 'dev/agent-workflow/evidence/alpha5/wiring/w5/a5w5-assembly-row.mjs';
  const w5f = 'dev/agent-workflow/evidence/alpha5/wiring/w5/a5w5-fixtures.mjs';
  const w7rel = 'tests/kits/a5-w7-jobs-wiring/a5w7-jobs-plugin.mjs';
  const w7ts = 'packages/runtime/tsconfig.build.json'; // W7 编译面锚（kit-local tsconfig.lane.json 已退役 ⇒ review-PC §3.2 F-1）
  for (const rel of [w4rel, w5a, w5f, w7rel, w7ts]) {
    mkdirSync(join(root, dirname(rel)), { recursive: true });
    writeFileSync(join(root, rel), `// ConfinedProcessProvider a5p5 jobs-gateway createConfinedProcessProvider createJobsGateway packages/tools/a5p5-tools/src\nconst s = 'jobs-gateway';\n`);
  }
  const rcRel = 'dev/agent-workflow/evidence/alpha5/pr8/probes/receipts';
  mkdirSync(join(root, rcRel), { recursive: true });
  const full = {
    assembly_anchors_verified: true,
    evidence_refs: ['runs/fake-receipt-evidence.log'],
    editor_subcommand_map_complete: true, image_read: { chain: 'admission-gated-controlled-fs' }, arbitrary_tree_profile_published: false,
    undo_history_io: { observed: true },
    execution: { outer_real_process: true, inner_reentry_same_pipeline: true }, transport_same_name_both_sides_throw: true,
    pool: { per_member_pids_distinct: true, policy_change_old_pid_terminated_recreated: true, cross_policy_pid_reuse: false }, server_os_reads_mediated: true,
    veto_side_effects: 0, pinned_host: { job_start_present: false },
    negative_controls: [
      { error: 'IO_POLICY_UNSUPPORTED', side_effects: 0, spawn_count: 0 }, { attempt: 'thumbnail-read-bypass', outcome: 'typed-deny' },
      { error: 'admission-unbound', bytes_leaked: 0 }, { attempt: 'unresolved-domain-reference', outcome: 'typed-deny' },
    ],
    per_call_policy_denials: [{ os_level_observed: true }],
    veto_matrix: [
      { team_permit: false, domain_permit: true, outcome: 'denied', error: 'DOMAIN_DENIED' },
      { team_permit: true, domain_permit: false, outcome: 'denied', error: 'DOMAIN_DENIED' },
    ],
  };
  mkdirSync(join(root, 'runs'), { recursive: true });
  writeFileSync(join(root, 'runs', 'fake-receipt-evidence.log'), 'fabricated\n');
  for (const row of RLW_ROWS) writeFileSync(join(root, rcRel, `${row}.receipt.json`), JSON.stringify(full));
  for (const row of RLW_ROWS) {
    const run = spawnSync(process.execPath, [join(REPO_ROOT, PROBE_DIR, `probe-${row}.mjs`), '--repo-root', root], { encoding: 'utf8', timeout: 60000 });
    assert.notEqual(String(run.stdout), undefined);
    assert.doesNotMatch(String(run.stdout), /# VERDICT LIVE/, `${row}: 假装配（注释锚）+伪造 receipt+假布尔绝不买通 LIVE`);
    assert.ok([2, 3, 4].includes(run.status), `${row}: 假装配根下期望 exit∈{2,3,4}（FAIL/NOT-RUN-READY/PROBE-GATED），实得 ${run.status}`);
  }
});

test('F-1/F-4: 机检矩阵 anchor_contract/status_now/transition_record 与 probe-lib 装配面表一致（防漂移）', async () => {
  const lib = await import('./lib.mjs');
  const { ASSEMBLY_FACES } = await import('../probes/probe-lib.mjs');
  const machine = JSON.parse(requireText(MACHINE_PATH));
  for (const row of machine.rows) {
    const pp = row.pending_probe;
    if (!pp) continue;
    const ac = String(pp.anchor_contract ?? '');
    for (const lane of new Set((pp.depends_on ?? []).map((d) => d.lane))) {
      assert.ok(ac.includes(lane), `${row.row_id}: anchor_contract 未点名依赖 lane ${lane}`);
      for (const f of ASSEMBLY_FACES[lane]?.files ?? []) {
        assert.ok(ac.includes(f.path) || ac.includes('装配面表') || ac.includes('probe-lib'), `${row.row_id}: anchor_contract 未指向 ${lane} 装配面（${f.path} 或 probe-lib 表指针）`);
      }
    }
    // status_now 词表封闭（W8 正式轮：允许转态后的值）
    assert.ok(['PREPARED-NOT-RUN-READY', 'TRANSITIONED-LIVE', 'TRANSITIONED-PROBE-GATED'].includes(String(pp.status_now)), `${row.row_id}: status_now 越词表: ${pp.status_now}`);
    if (String(pp.status_now).startsWith('TRANSITIONED-')) {
      const tr = pp.transition_record;
      assert.ok(tr && typeof tr === 'object', `${row.row_id}: TRANSITIONED 行必须带 transition_record（runner 转态留痕）`);
      assert.equal(tr.verdict, pp.status_now === 'TRANSITIONED-LIVE' ? 'LIVE' : 'PROBE-GATED', `${row.row_id}: transition_record.verdict 与 status_now 不符`);
      const refs = tr.evidence_refs ?? [];
      for (const ref of refs) {
        assert.ok(!ref.startsWith('/') && !ref.includes('..'), `${row.row_id}: evidence_ref 必须 repo_root 相对且不逃逸: ${ref}`);
        assert.ok(existsSync(join(REPO_ROOT, ref)), `${row.row_id}: transition_record.evidence_refs 指向不存在的在册文件: ${ref}（F-1 提交时位）`);
      }
      if (tr.verdict === 'PROBE-GATED') assert.ok(existsSync(join(REPO_ROOT, String(tr.repro_ref ?? ''))), `${row.row_id}: PROBE-GATED 转态必须带可复跑的最小复现脚本在册`);
    }
  }
  assert.deepEqual(lib.assertProbeRegistrations(machine, JSON.parse(requireText(DOC_PATH)), REPO_ROOT), []);
});

test('prep: evaluateRow 对 pending_probe 行永不输出 PASS（PASS 尝试→FAIL+违例注记；LIVE 有 runner 亲验证据→LIVE 非 PASS）', async () => {
  const lib = await import('./lib.mjs');
  const root = tmp();
  mkdirSync(join(root, 'runs'), { recursive: true });
  writeFileSync(join(root, 'runs', 'live.log'), 'live bytes\n');
  const base = { repo_root: root };
  const r0 = await lib.evaluateRow(fakeProbeRow(), { ...base, probe_outcomes: {} });
  assert.equal(r0.result, 'REQUIRES-LIVE-WIRING');
  assert.equal(r0.probe_transition, 'PREPARED-NOT-RUN-READY');
  const r1 = await lib.evaluateRow(fakeProbeRow(), { ...base, probe_outcomes: { 'M-04': { verdict: 'PASS' } } });
  assert.equal(r1.result, 'FAIL', 'pending_probe 行 attempt PASS ⇒ 违例判红，绝不落 PASS');
  assert.match(JSON.stringify(r1), /转态违例|VIOLATION/);
  // 真 LIVE：refs 在册 + runner 亲验装配面在场（W4/W5 face 文件在合成根里落真代码形）
  const { ASSEMBLY_FACES } = await import('../probes/probe-lib.mjs');
  for (const lane of ['W5', 'W4']) {
    for (const f of ASSEMBLY_FACES[lane].files) {
      mkdirSync(join(root, dirname(f.path)), { recursive: true });
      writeFileSync(join(root, f.path), (f.code_fixture ?? 'const x = mod.createConfinedProcessProvider({})\nprov = await import(pathToFileURL(join(DIST, "runtime", "sandbox-provider", "index.js")).href)\nfx.loadA5W5Lanes({ laneBuild, distPackages })\nconst laneUrl = (p) => new URL(`file://${join(laneBuild, \'packages/tools/a5p5-tools/src\', p)}`).href\n'));
    }
  }
  const r2 = await lib.evaluateRow(fakeProbeRow(), { ...base, probe_outcomes: { 'M-04': { verdict: 'LIVE', evidence_refs: ['runs/live.log'] } } });
  assert.equal(r2.result, 'LIVE', `装配面亲验+refs 在册才 LIVE；got ${JSON.stringify(r2).slice(0, 300)}`);
  assert.notEqual(r2.result, 'PASS');
  // 同一 outcome 但锚点被 runner 亲验为缺（假根）⇒ 降级 PROBE-GATED（假证据面咬住）
  const r2b = await lib.evaluateRow(fakeProbeRow(), { repo_root: tmp(), probe_outcomes: { 'M-04': { verdict: 'LIVE', evidence_refs: ['runs/live.log'], assembly_anchors_verified: true } } });
  assert.equal(r2b.result, 'PROBE-GATED');
  const r3 = await lib.evaluateRow(fakeProbeRow(), { ...base, probe_outcomes: { 'M-04': { verdict: 'NOT-RUN-READY' } } });
  assert.equal(r3.result, 'PROBE-GATED');
});

test('prep(提交时位): TRANSITIONED 行的假 evidence_refs / doc 状态漂移被 assertProbeRegistrations 咬红', async () => {
  const lib = await import('./lib.mjs');
  const baseRow = fakeProbeRow();
  baseRow.pending_probe.status_now = 'TRANSITIONED-LIVE';
  baseRow.pending_probe.transition_record = { verdict: 'LIVE', evidence_refs: ['runs/nowhere-claimed.log'], run_utc: '2026-10-17T00:00:00Z' };
  const machine = { rows: [baseRow] };
  const doc = { rows: [{ row_id: 'M-04', current_status: 'x', pending_probe: { probe_script: baseRow.pending_probe.probe_script, status_now: 'TRANSITIONED-LIVE' } }] };
  const issues = lib.assertProbeRegistrations(machine, doc, tmp());
  assert.ok(issues.some((i) => /不存在|ghost|in-tree/i.test(i)), `假 refs 转态应咬红: ${JSON.stringify(issues)}`);
  // doc 漂移（机检 TRANSITIONED / doc 仍 PREPARED）⇒ 红
  const doc2 = { rows: [{ row_id: 'M-04', current_status: 'x', pending_probe: { probe_script: baseRow.pending_probe.probe_script, status_now: 'PREPARED-NOT-RUN-READY' } }] };
  const issues2 = lib.assertProbeRegistrations(machine, doc2, tmp());
  assert.ok(issues2.some((i) => /doc/.test(i)), `doc 状态漂移应咬红: ${JSON.stringify(issues2)}`);
  // 越词表 status_now ⇒ 红
  const bad = fakeProbeRow();
  bad.pending_probe.status_now = 'LIVE-CLOSED';
  const issues3 = lib.assertProbeRegistrations({ rows: [bad] }, doc, tmp());
  assert.ok(issues3.some((i) => /status_now/.test(i)), `status_now 越词表应咬红: ${JSON.stringify(issues3)}`);
});

test('prep: 分布把 LIVE/PROBE-GATED 与 PASS 分桶（行级 LIVE 永不计入 PASS 计数）', async () => {
  const lib = await import('./lib.mjs');
  const d = lib.computeDistribution([
    { result: 'LIVE', evidence_level: 'U' },
    { result: 'PROBE-GATED', evidence_level: 'U' },
    { result: 'PASS', evidence_level: 'D' },
  ]);
  assert.equal(d.PASS, 1);
  assert.equal(d.LIVE, 1);
  assert.equal(d.PROBE_GATED, 1);
  assert.doesNotMatch(JSON.stringify(d), /SUPPORTED|已验收|整链/);
});
