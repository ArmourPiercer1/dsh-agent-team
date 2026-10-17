#!/usr/bin/env node
// probe-M-08.mjs — M-08 run_code(PTC)（RLW 行）live 探针：对着 W4 冻结装配面的编码断言。
// 依赖声明（机检矩阵 pending_probe.depends_on 同步）：
//   W4 观测面 = ConfinedProcessProvider 真实 spawn = OS 强制面（D3/D5 级实证：外层真实进程 +
//              内层复入同一管线逐次 Guard；per-call 策略注入的 OS 真实拒绝负控）；
//   IF-6 名称面 = 不可用/越界 profile 启动前 typed 拒 IO_POLICY_UNSUPPORTED（零 spawn 证据）。
// 判据（矩阵 M-08 note）：保留传输同名双侧 throw；外层真实进程+内层复入同一管线逐次 Guard；
// ENFORCE 级宣称必须落在 OS 强制面证据上（IF-7），仅 fixture 级 ⇒ receipt 不得带 OS_ENFORCED 断言。
// 装配面缺位 ⇒ 运行即 NOT-RUN-READY exit 3 + 缺装配原因（禁假 PASS；W8 正式轮：kit 装配面已合并）。零端口零世界，纯只读。
// writer=alpha5-wire-pr8prep（qwen3.8-flash-next）。
// 判据对齐注记（W-PTC-ROWFIX #290，2026-10-17 06:53Z root 口径；以计划口径为准）：
//   本 probe 原 A1–A4 四条全部只覆盖【内层 per-call 载荷执行边】（A1 内层复入同一管线逐次 Guard /
//   A2 内层 per-call OS 拒绝 / A3 内层 provider 启动前拒 / A4 同名双侧 throw）。而 M-08 判据的计划口径
//   （S0-SELECTION-MATRIX.md:55 未测项明文「外层直接 fs/net OS 级拒绝负控」+ 禁止路径「以『内层 guard
//   通过』替代外层防护」；post-poc-technical-design.md:123/125/66/191/214/22/21）恒含【外层程序直接
//   fs/net OS 级拒绝负控】边。W-PTC-OUTER 轮（证据 commit 348f9989，独立 reviewer PASS 06c3b502，
//   canonical runs/outer-2026-10-17T06-34-21Z 27/27+8INFO）实证该外层边在可达面上：真 Landlock 域
//   fs 写禁区=真阻止（EACCES+不创建、域跨 fork/execve 继承），但 net.connect 真域腿直通（无任何 OS
//   机制覆盖），且公开 seam 无法把 per-call Grant 注入外层 bootstrap（四处 typed throw + ctx.set 拒）。
//   ⇒ 判据与 S0:55 的差异=原四条缺外层边判据，A1–A4 全 SATISFIED 不构成行级 LIVE。补 A5（收紧，非放宽）：
//   receipt 必须带 outer_direct_io_os_denial=true（外层直接 fs/net OS 级拒绝负控在册；net 腿需独立
//   OS 机制覆盖证明，pr290 实测 net 直通=缺口绝不记为防护）。字段缺 ⇒ NOT-EXECUTED ⇒ 按 probe 自身
//   词表如实落 PROBE-GATED（不硬凑 verdict；行级转态正本=machine 矩阵 M-08 transition_record）。
import { runProbe, probeRelPath, receiptRelPath, clauseField, clauseContains } from './probe-lib.mjs';

await runProbe({
  rowId: 'M-08',
  family: 'run_code (PTC)',
  probeRelPath: probeRelPath('M-08'),
  receiptRelPath: receiptRelPath('M-08'),
  deps: [
    { lane: 'W4', surface: 'provider 工厂→会话装配 + Landlock 在场/撤销对照（OS 强制面，ENFORCE 证据分级如实）', if_refs: ['IF-1', 'IF-6'] },
  ],
  preflight: [
    { id: 'w4-spawn-assembly', lane: 'W4', surface: 'w4 kit 装配面（ConfinedProcessProvider 会话装配 + Landlock 在场/撤销对照，IF-1/IF-6）', kind: 'face' },
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
    {
      // 06:53Z 判据对齐补条（计划口径，见头注；A1–A4 为内层边，本条为外层边）：
      // 外层程序直接 fs/net（不经任何注册工具）的 OS 级拒绝负控在册；net 腿须独立 OS 机制覆盖证明。
      // W-PTC-OUTER 实测（可达正控真值表）：真 Landlock 域 fs 写禁区 EACCES+不创建，net.connect 真域腿
      // 直通（1 conn/62B 实收）⇒ 该边未被观测；精确局部阻塞见 w-ptc-outer/pr290-comment.md §5。
      id: 'A5-outer-direct-io-os-denial',
      criterion: '外层直接 fs/net OS 级拒绝负控在册（S0:55 未测项 + design:123/125/191/214/21/22 = 原计划受控对象；禁以内层 guard/载荷边替代外层防护）',
      run: (r) => clauseField(r, 'outer_direct_io_os_denial', true, '外层直接 fs/net OS 级拒绝负控在册（net 腿需独立 OS 机制覆盖，非文件域）'),
    },
  ],
});
