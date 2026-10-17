#!/usr/bin/env node
// probe-M-08.mjs — M-08 run_code(PTC)（RLW 行）live 探针：对着 W4 冻结装配面的编码断言。
// 依赖声明（机检矩阵 pending_probe.depends_on 同步）：
//   W4 观测面 = ConfinedProcessProvider 真实 spawn = OS 强制面（D3/D5 级实证：外层真实进程 +
//              内层复入同一管线逐次 Guard；per-call 策略注入的 OS 真实拒绝负控）；
//   IF-6 名称面 = 不可用/越界 profile 启动前 typed 拒 IO_POLICY_UNSUPPORTED（零 spawn 证据）。
// 判据（矩阵 M-08 note）：保留传输同名双侧 throw；外层真实进程+内层复入同一管线逐次 Guard；
// ENFORCE 级宣称必须落在 OS 强制面证据上（IF-7），仅 fixture 级 ⇒ receipt 不得带 OS_ENFORCED 断言。
// 当前无装配 ⇒ 运行即 NOT-RUN-READY exit 3 + 缺装配原因（禁假 PASS）。零端口零世界，纯只读。
// writer=alpha5-wire-pr8prep（qwen3.8-flash-next）。
import { runProbe, probeRelPath, receiptRelPath, clauseField, clauseContains, ASSEMBLY_ANCHORS, GLUE_PATH } from './probe-lib.mjs';

await runProbe({
  rowId: 'M-08',
  family: 'run_code (PTC)',
  probeRelPath: probeRelPath('M-08'),
  receiptRelPath: receiptRelPath('M-08'),
  deps: [
    { lane: 'W4', surface: 'provider 工厂→会话装配 + Landlock 在场/撤销对照（OS 强制面，ENFORCE 证据分级如实）', if_refs: ['IF-1', 'IF-6'] },
  ],
  preflight: [
    { id: 'w4-spawn-assembly', lane: 'W4', surface: 'ConfinedProcessProvider 会话装配（IF-1）', kind: 'anchor', files: [GLUE_PATH], anchors: [ASSEMBLY_ANCHORS.W4.glue_anchor] },
    { id: 'registry-50-run-mounted', lane: 'W4', surface: 'registry 套件 50-ptc-lsp 断言实现挂载（run≠null）', kind: 'registry-run', suite: '50-ptc-lsp' },
  ],
  assertions: [
    {
      id: 'A1-outer-real-process-inner-pipeline',
      criterion: '外层=真实进程（非 stub），内层复入同一管线且逐次过 Guard（PoC-6a 之外的装配级实证）',
      run: (r) => {
        const a = clauseField(r, 'execution.outer_real_process', true, '外层真实进程在册');
        if (a.status !== 'SATISFIED') return a;
        return clauseField(r, 'execution.inner_reentry_same_pipeline', true, '内层复入同一管线逐次 Guard');
      },
    },
    {
      id: 'A2-per-call-os-enforced-denial',
      criterion: 'per-call 策略注入的 OS 真实拒绝负控（EACCES/EPERM 级观测）；等级=OS_ENFORCED 才谈 ENFORCE（IF-7）',
      run: (r) => clauseContains(r, 'per_call_policy_denials', { os_level_observed: true }, 'D3/D5 型 OS 拒绝负控在册'),
    },
    {
      id: 'A3-unsupported-profile-pre-spawn-refusal',
      criterion: '不可用 profile ⇒ 启动前 typed 拒 IO_POLICY_UNSUPPORTED（IF-6 原名），spawn 计数=0',
      run: (r) => clauseContains(r, 'negative_controls', { error: 'IO_POLICY_UNSUPPORTED', spawn_count: 0 }, '启动前拒+零 spawn 证据'),
    },
    {
      id: 'A4-transport-override-both-sides-throw',
      criterion: '保留传输同名双侧 throw（不可覆盖）在装配面复现',
      run: (r) => clauseField(r, 'transport_same_name_both_sides_throw', true, '双侧 throw 观测在册'),
    },
  ],
});
