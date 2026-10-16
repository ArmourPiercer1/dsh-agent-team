// pr8-runner-self.test.mjs — PR8 负例 runner 自跑套件（结构 lint + 三态逻辑 + final_declaration 代码位强制）
// Lane: alpha5-pr8-runner writer（qwen3.8-flash-next；模型/harness 分列）。
// 运行：node --test --test-concurrency=1 dev/agent-workflow/evidence/alpha5/pr8/runner/pr8-runner-self.test.mjs
// 约束：零端口、零世界、零共用文件触碰；本套件自身即 fixture 级观测——PASS 不构成任何整链验收（INTERFACES-v1 集成规则）。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  lintCorrespondence,
  assertMachineFinalDeclarations,
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
