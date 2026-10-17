#!/usr/bin/env node
// run-pr8-negative.mjs — PR8 负例 runner：对 matrix-machine.json 逐行产出 PASS/FAIL/NOT_RUN 三态，
// 对 automatable=false 行产出 REQUIRES-LIVE-WIRING（含 LIVE-GATED 依据引用）。
// 零端口、零世界；kit-rerun 为 in-process 钉定 registry；本 runner 的任何 PASS 均不构成行验收/整链验收。
// 用法：node run-pr8-negative.mjs [--repo-root <path>] [--gates <path>] [--quiet]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintCorrespondence, assertMachineFinalDeclarations, lintDocFinalDeclaration, evaluateRow, computeDistribution, readGatesLedger, deriveFinalDeclaration, runFixtureSurface, RESULTS } from './lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const argVal = (name, dflt) => { const i = argv.indexOf(name); return i === -1 ? dflt : argv[i + 1]; };
const repoRoot = resolve(argVal('--repo-root', resolve(HERE, '..', '..', '..', '..', '..', '..')));
const machinePath = join(repoRoot, 'dev/agent-workflow/evidence/alpha5/pr8/matrix-machine.json');
const docPath = join(repoRoot, 'docs/plans/memo/alpha5-tool-io-governance/pr8-accept/acceptance-matrix.json');
const gatesPath = argVal('--gates', null);
const outDir = join(HERE, 'runs');

const machine = JSON.parse(readFileSync(machinePath, 'utf8'));
const doc = JSON.parse(readFileSync(docPath, 'utf8'));
const lines = [];
const say = (s) => { lines.push(s); if (!argv.includes('--quiet')) console.log(s); };

say(`# PR8 负例 runner — matrix-machine @ base ${machine._meta.base_sha.slice(0, 8)}  run-utc=${new Date().toISOString()}`);
say(`# repo-root=${repoRoot}`);

// 1) 结构 lint（机检矩阵 ↔ doc 矩阵对应关系 + final_declaration 代码位）
const lintIssues = lintCorrespondence(machine, doc);
say(`\n## 结构 lint: ${lintIssues.length === 0 ? 'OK' : `${lintIssues.length} 项违规`}`);
for (const i of lintIssues) say(`  LINT-FAIL ${i}`);

// N1：doc 矩阵 final_declaration 缺键 ⇒ 显式点名（不按 undefined 静默放行；补齐=集成 owner 转交项，见 README）
const docFd = lintDocFinalDeclaration(machine, doc);
say(`\n## doc final_declaration 显式点名: 缺键=${docFd.missing_key.length} 行 / 非 null 声明=${docFd.declared_non_null.length} 行`);
for (const f of docFd.missing_key) say(`  DOC-MISSING-KEY ${f.row_id} — ${f.note}`);
for (const f of docFd.declared_non_null) say(`  DOC-DECLARED-NON-NULL ${f.row_id} = ${JSON.stringify(f.value)}（应经 pending_update_template 且属红）`);

// 2) PENDING-GATES 台账状态（fail-closed）
const gates = readGatesLedger(repoRoot, gatesPath);
say(`\n## PENDING-GATES 台账: ${gates.status}${gates.present ? '' : '（fail-closed：' + gates.path + ' 不在本 ref 树内）'}`);
say(`  open=[${(gates.open_ids ?? []).join(',')}] closed=[${(gates.closed_ids ?? []).join(',')}]`);
say(`  ${gates.note ?? ''}`);

// 3) 观测面致盲对照（mandated negative control：本条必须表现为被抓住的 FAIL，若其 PASS 则 runner 自判盲）
const ctrl = runFixtureSurface(repoRoot, { files: [{ path: 'dev/agent-workflow/evidence/alpha5/pr8/matrix-machine.json', anchors: ['__ghost_anchor_control_must_not_exist__'] }] });
const ctrlCaught = ctrl.status === RESULTS.FAIL;
say(`\n## 对照臂（观测面非盲证明）: ghost-anchor probe = ${ctrl.status} ⇒ ${ctrlCaught ? 'OK（FAIL 被如实捕获）' : 'RUNNER-BLIND（应 FAIL 而未 FAIL）'}`);

// 4) 逐行三态
say('\n## 逐行三态（criterion-level-fixture；NOT_RUN/RLW 不构成任何通过性结论）');
const results = [];
for (const row of machine.rows) {
  const r = await evaluateRow(row, { repo_root: repoRoot });
  r.final_declaration = deriveFinalDeclaration(row, gates);
  r.ga_semantics_row = row.ga_semantics === true;
  r.g_g_related_row = row.g_g_related === true;
  results.push(r);
  const marks = `${r.ga_semantics_row ? '[G-a]' : ''}${r.g_g_related_row ? '[G-g]' : ''}`;
  say(`  ${r.result.padEnd(21)} ${r.row_id.padEnd(7)} lvl=${r.evidence_level} auto=${row.automatable ? 'yes' : 'no '}${marks}`);
  if (r.result === RESULTS.RLW) for (const b of r.basis) say(`      LIVE-GATED: ${b}`);
  if (r.hooks) for (const h of r.hooks) if (h.status !== RESULTS.PASS) say(`      ${h.status.padEnd(7)} ${h.label}: ${h.reason ?? ''}`);
}

// 5) 分布 + final_declaration 汇总
const dist = computeDistribution(results);
say('\n## 分布');
say(`  PASS=${dist.PASS} FAIL=${dist.FAIL} NOT_RUN=${dist.NOT_RUN} REQUIRES-LIVE-WIRING=${dist.REQUIRES_LIVE_WIRING} TOTAL=${dist.TOTAL}`);
for (const [k, v] of Object.entries(dist.by_level).sort()) say(`  level×auto: ${k} = ${v}`);
const fdAll = results.every((r) => r.final_declaration === null);
say(`\n## final_declaration: ${fdAll ? '全 null（PENDING-GATES 未全关，代码位强制）' : '!!! 存在非空声明 — 违规'}`);
say('## 反升格声明: 本运行全部为 fixture/记录级观测；不产出 SUPPORTED/已验收/整链已验证（INTERFACES-v1；review-LaneG 条件①）');

mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const jsonOut = join(outDir, `matrix-run-${stamp}.json`);
writeFileSync(jsonOut, JSON.stringify({ run_utc: new Date().toISOString(), repo_root: repoRoot, gates_status: gates.status, distribution: dist, lint_issues: lintIssues, control_arm: { ghost_anchor: ctrl.status, ok: ctrlCaught }, rows: results }, null, 2));
const logOut = join(outDir, `matrix-run-${stamp}.log`);
writeFileSync(logOut, lines.join('\n') + '\n');
say(`\n# written: ${jsonOut}`);
say(`# written: ${logOut}`);

const failCount = dist.FAIL + lintIssues.length + (ctrlCaught ? 0 : 1) + (fdAll ? 0 : 1);
say(`# exit: ${failCount === 0 ? '0 (结构 lint 干净；红/NOT_RUN 分布如实呈报)' : `2 (${failCount} 项实质违规)`}`);
process.exitCode = failCount === 0 ? 0 : 2;
