#!/usr/bin/env node
// probe-M-04.mjs — M-04 str_replace_editor（RLW 行）live 探针：对着 W4/W5 冻结装配面的编码断言。
// 依赖声明（机检矩阵 pending_probe.depends_on 同步）：
//   W5 观测面 = admission 门控工具面注册进测试会话（IF-1 plugin row + ctx.agents + dist barrels）；
//   W4 观测面 = 受支持 profile 真实 spawn+执行观测（编辑器 governed 落盘执行腿）；
//   IF-6 名称面 = 不可精确映射子命令 → typed 默认拒 IO_POLICY_UNSUPPORTED（launch 前、零副作用）。
// 判据（矩阵 M-04 note）：子命令级 I/O 映射逐路径可观测；不可精确映射者 typed 默认拒；undo 历史 I/O 在治理腿内。
// 装配面缺位 ⇒ 运行即 NOT-RUN-READY exit 3 + 逐条缺装配原因（禁假 PASS；W8 正式轮：kit 装配面已合并 master）；词表封闭 LIVE/PROBE-GATED/NOT-RUN-READY/FAIL。
// 零端口零世界（IF-2/IF-3 归正式轮）；纯只读。writer=alpha5-wire-pr8prep（qwen3.8-flash-next）。
import { runProbe, probeRelPath, receiptRelPath, clauseField, clauseContains } from './probe-lib.mjs';

await runProbe({
  rowId: 'M-04',
  family: 'str_replace_editor',
  probeRelPath: probeRelPath('M-04'),
  receiptRelPath: receiptRelPath('M-04'),
  deps: [
    { lane: 'W5', surface: 'admission 门控工具面注册进测试会话（IF-1）——editor 子命令 I/O 映射观测面宿主', if_refs: ['IF-1'] },
    { lane: 'W4', surface: '受支持 profile 真实 spawn+执行观测——编辑器执行落盘腿', if_refs: ['IF-1'] },
    { lane: 'W5', surface: 'IF-6 拒装名观测：不可精确映射子命令 typed 默认拒 IO_POLICY_UNSUPPORTED（launch 前、零副作用）', if_refs: ['IF-6'] },
  ],
  preflight: [
    { id: 'w5-tool-face-assembly', lane: 'W5', surface: 'w5 kit 装配面（admission 门控工具面经 lane 装载注册；IF-1 公开 seam）', kind: 'face' },
    { id: 'w4-spawn-assembly', lane: 'W4', surface: 'w4 kit 装配面（ConfinedProcessProvider 会话装配，IF-1）', kind: 'face' },
  ],
  assertions: [
    {
      id: 'A1-subcommand-io-map-complete',
      criterion: 'view/insert/delete/undo 每个子命令映射到声明的 I/O effect 集（可精确映射）',
      run: (r) => clauseField(r, 'editor_subcommand_map_complete', true, 'receipt 须记录逐子命令映射表完整（S0 untested_carried_over 全谱已覆盖）'),
    },
    {
      id: 'A2-unmappable-typed-deny',
      criterion: '不可精确映射的子命令/参数 ⇒ 启动前 typed 默认拒 IO_POLICY_UNSUPPORTED（IF-6 原名），零副作用',
      run: (r) => clauseContains(r, 'negative_controls', { error: 'IO_POLICY_UNSUPPORTED', side_effects: 0 }, '负控=typed 默认拒且 spawn/写副作用计数 0'),
    },
    {
      id: 'A3-undo-history-io',
      criterion: 'undo 历史 I/O 观测在治理腿内（undo 读/写经同一 admission 门控面）',
      run: (r) => clauseField(r, 'undo_history_io.observed', true, 'undo 谱 I/O 观测在册（S0 全谱未测项闭环证据）'),
    },
  ],
});
