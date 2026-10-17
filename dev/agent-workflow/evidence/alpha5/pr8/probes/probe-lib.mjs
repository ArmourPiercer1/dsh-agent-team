// probe-lib.mjs — W8 准备轮（alpha5-wire-pr8prep）：RLW 行 live probe 的共享执行骨架。
// 契约（IF-7 判据语言）：probe 结论词表封闭为 LIVE / PROBE-GATED / NOT-RUN-READY / FAIL 四个 VERDICT，
// 永不输出 VERDICT PASS——PASS 不是行级终态（WIRING-PHASE-PLAN IF-7：REQUIRES-LIVE 禁为本阶段终态，
// 要么转 LIVE 要么 PROBE-GATED+最小复现；本骨架连"fixture 冒充 LIVE"的路一并封死：
// LIVE 只能在装配锚点在场 + 合法 receipt 全判据 SATISFIED 时得出）。
// 失败即真相：装配缺失 ⇒ 运行即 NOT-RUN-READY exit 3 并逐条打印缺装配原因（MISSING-ASSEMBLY），禁假 PASS。
// 零端口、零 DSH_HOME 世界、纯只读观测（读文件 + 动态 import registry.mjs 数据）；不 import upstream。
// writer: alpha5-wire-pr8prep（qwen3.8-flash-next；模型/harness 分列）。

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const VERDICT = Object.freeze({
  LIVE: 'LIVE',
  PROBE_GATED: 'PROBE-GATED',
  NOT_RUN_READY: 'NOT-RUN-READY',
  FAIL: 'FAIL',
});

export const EXIT = Object.freeze({ LIVE: 0, FAIL: 2, NOT_RUN_READY: 3, PROBE_GATED: 4 });

export const REGISTRY_PATH = 'docs/plans/memo/alpha5-tool-io-governance/pr8-accept/e2e-skeleton/suites/registry.mjs';
export const GLUE_PATH = 'packages/runtime/src/plugin/live/agent-bindings.mjs';

// 装配锚点契约（W4/W5/W7 合并落地后的最小可观测信号；lane 若以别的名暴露，须回报协调者改此表——
// 锚点即 probe 的依赖声明面，不许在 probe 内私放"看起来像装配"的宽松判据）。
export const ASSEMBLY_ANCHORS = Object.freeze({
  W4: { lane: 'W4', glue_anchor: 'ConfinedProcessProvider', surface: 'provider 工厂→会话装配（真实 spawn+执行观测；不可用 profile 启动前 typed 拒 IO_POLICY_UNSUPPORTED）' },
  W5: { lane: 'W5', glue_anchor: 'a5p5', surface: 'search/shell 工具面经 admission 门控注册进测试会话（spill 生命周期 + shell parity 双腿）' },
  W7: { lane: 'W7', glue_anchor: 'jobs-gateway', surface: 'jobs 身份/lease 经 jobs-gateway 公开面装配（两 member 隔离 + lease 互斥 + revocation）' },
});

function fieldPath (obj, dotted) {
  let cur = obj;
  for (const seg of dotted.split('.')) {
    if (cur === null || typeof cur !== 'object' || !(seg in cur)) return { found: false };
    cur = cur[seg];
  }
  return { found: true, value: cur };
}

// 断言子句 helper：receipt 数据缺 ⇒ NOT-EXECUTED（门禁态，不猜）；数据在而值不符 ⇒ VIOLATED（真违例）。
export function clauseField (receipt, path, expectEq, why) {
  const r = fieldPath(receipt, path);
  if (!r.found) return { status: 'NOT-EXECUTED', detail: `receipt 缺字段 ${path}（${why}）` };
  if (expectEq !== undefined && JSON.stringify(r.value) !== JSON.stringify(expectEq)) {
    return { status: 'VIOLATED', detail: `${path}=${JSON.stringify(r.value)} ≠ 期望 ${JSON.stringify(expectEq)}（${why}）` };
  }
  return { status: 'SATISFIED', detail: `${path}=${JSON.stringify(r.value)}（${why}）` };
}

export function clauseContains (receipt, arrayPath, matcher, why) {
  const r = fieldPath(receipt, arrayPath);
  if (!r.found || !Array.isArray(r.value)) return { status: 'NOT-EXECUTED', detail: `receipt 缺数组 ${arrayPath}（${why}）` };
  const hit = r.value.find((el) => el && Object.entries(matcher).every(([k, v]) => JSON.stringify(el[k]) === JSON.stringify(v)));
  if (!hit) return { status: 'VIOLATED', detail: `${arrayPath} 无满足 ${JSON.stringify(matcher)} 的记录（${why}）` };
  return { status: 'SATISFIED', detail: `${arrayPath} 含 ${JSON.stringify(matcher)}（${why}）` };
}

async function checkPreflight (repoRoot, check) {
  if (check.kind === 'anchor') {
    const missing = [];
    for (const rel of check.files) {
      const abs = join(repoRoot, rel);
      if (!existsSync(abs)) { missing.push(`${rel} 不在树内`); continue; }
      const text = readFileSync(abs, 'utf8');
      for (const a of check.anchors ?? []) {
        if (!text.includes(a)) missing.push(`${rel} 未出现装配锚 [${a}]（装配未落地或未以契约名暴露，回报协调者）`);
      }
    }
    return missing;
  }
  if (check.kind === 'registry-run') {
    try {
      const mod = await import(pathToFileURL(join(repoRoot, REGISTRY_PATH)).href);
      const suite = (mod.SUITES ?? []).find((s) => s.id === check.suite);
      if (!suite) return [`registry 无套件 ${check.suite}`];
      if (suite.run === null || suite.run === undefined) return [`registry 套件 ${check.suite} run=null（断言实现未挂）`];
      return [];
    } catch (e) {
      return [`registry 不可读: ${e.message}`];
    }
  }
  return [`未知 preflight.kind: ${check.kind}`];
}

export async function runProbe (spec, argv = process.argv.slice(2)) {
  const HERE = dirname(fileURLToPath(import.meta.url));
  const argVal = (name, dflt) => { const i = argv.indexOf(name); return i === -1 ? dflt : argv[i + 1]; };
  const repoRoot = resolve(argVal('--repo-root', resolve(HERE, '..', '..', '..', '..', '..', '..')));
  const lines = [];
  const say = (s) => { lines.push(s); console.log(s); };
  const stamp = new Date().toISOString();
  say(`# probe-${spec.rowId} (${spec.family}) run-utc=${stamp} repo-root=${repoRoot}`);
  for (const d of spec.deps) say(`DEPEND ${d.lane} surface="${d.surface}" if=[${(d.if_refs ?? []).join(',')}]`);

  // 1) 装配预检：任一缺失 ⇒ NOT-RUN-READY（先于一切断言；禁假 PASS 的第一道位）。
  const missing = [];
  const present = [];
  for (const check of spec.preflight) {
    const ms = await checkPreflight(repoRoot, check);
    if (ms.length) for (const m of ms) { say(`CHECK ${check.id} lane=${check.lane ?? '-'} missing`); say(`MISSING-ASSEMBLY ${check.lane ?? '?'} ${check.surface ?? check.id} :: ${m}`); }
    else { say(`CHECK ${check.id} lane=${check.lane ?? '-'} present`); present.push(check.id); }
    missing.push(...ms.map((m) => `${check.id}: ${m}`));
  }
  const finish = (verdict, exitCode, extra = []) => {
    for (const e of extra) say(e);
    say(`# VERDICT ${verdict} exit=${exitCode}`);
    process.exitCode = exitCode;
  };
  if (missing.length) {
    finish(VERDICT.NOT_RUN_READY, EXIT.NOT_RUN_READY, [
      `NOT-RUN-READY ${spec.rowId}：依赖装配未在场（上方 MISSING-ASSEMBLY 逐条为缺装配原因），本 probe 未执行任何通过性断言；行仍挂 REQUIRES-LIVE-WIRING，转态只允许 LIVE/PROBE-GATED（见 matrix pending_probe.transition_rule）。`,
      `MINIMAL-REPRO ${spec.probeRelPath}（重跑本脚本即复现缺装配态）`,
    ]);
    return;
  }

  // 2) 装配在场：读 receipt（live 轮记录）。receipt 缺 ⇒ PROBE-GATED（最小复现=本脚本+缺 receipt 说明）。
  const receiptRel = argVal('--receipt', spec.receiptRelPath);
  const receiptAbs = join(repoRoot, receiptRel);
  if (!existsSync(receiptAbs)) {
    finish(VERDICT.PROBE_GATED, EXIT.PROBE_GATED, [
      `PROBE-GATED ${spec.rowId}：装配锚点在场但 live receipt 缺（${receiptRel}）——无记录不判 LIVE；最小复现已登记。`,
      `MINIMAL-REPRO ${spec.probeRelPath} --receipt ${receiptRel}`,
    ]);
    return;
  }
  let receipt;
  try { receipt = JSON.parse(readFileSync(receiptAbs, 'utf8')); } catch (e) {
    finish(VERDICT.FAIL, EXIT.FAIL, [`FAIL ${spec.rowId}：receipt 不可解析: ${e.message}`]);
    return;
  }

  // 3) 逐断言（观测 receipt 记录 + 装配锚点核验状态；全 SATISFIED 且 receipt 自证锚点核验 ⇒ LIVE）。
  let violated = 0; let notExecuted = 0;
  for (const a of spec.assertions) {
    let out;
    try { out = a.run(receipt); } catch (e) { out = { status: 'VIOLATED', detail: `断言异常: ${e.message}` }; }
    say(`ASSERT ${a.id} ${out.status} :: ${out.detail}`);
    if (out.status === 'VIOLATED') violated += 1;
    if (out.status === 'NOT-EXECUTED') notExecuted += 1;
  }
  const anchorsVerified = receipt.assembly_anchors_verified === true;
  const evidenceRefs = Array.isArray(receipt.evidence_refs) ? receipt.evidence_refs : [];
  if (violated) {
    finish(VERDICT.FAIL, EXIT.FAIL, [`FAIL ${spec.rowId}：${violated} 条断言违例（live 观测与判据冲突，行不得转 LIVE）`]);
    return;
  }
  if (notExecuted) {
    finish(VERDICT.PROBE_GATED, EXIT.PROBE_GATED, [
      `PROBE-GATED ${spec.rowId}：${notExecuted} 条断言无观测数据（receipt 字段缺），保持门禁不猜；`,
      `MINIMAL-REPRO ${spec.probeRelPath} --receipt ${receiptRel}`,
    ]);
    return;
  }
  if (!anchorsVerified || !evidenceRefs.length) {
    finish(VERDICT.PROBE_GATED, EXIT.PROBE_GATED, [
      `PROBE-GATED ${spec.rowId}：断言全 SATISFIED 但 receipt 缺 assembly_anchors_verified=true 或 evidence_refs 非空——无证据不 LIVE（转态自锁，IF-7）。`,
      `MINIMAL-REPRO ${spec.probeRelPath} --receipt ${receiptRel}`,
    ]);
    return;
  }
  finish(VERDICT.LIVE, EXIT.LIVE, [
    `EVIDENCE ${evidenceRefs.join(' ')}`,
    `LIVE ${spec.rowId}：装配锚点核验 + receipt 全断言 SATISFIED + 证据引注在册（行级转态提案值=LIVE，终裁归 PR8 正式轮 + 独立 reviewer）。`,
  ]);
}

export const probeRelPath = (rowId) => `dev/agent-workflow/evidence/alpha5/pr8/probes/probe-${rowId}.mjs`;
export const receiptRelPath = (rowId) => `dev/agent-workflow/evidence/alpha5/pr8/probes/receipts/${rowId}.receipt.json`;
