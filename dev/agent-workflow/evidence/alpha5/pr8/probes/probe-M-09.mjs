#!/usr/bin/env node
// probe-M-09.mjs — M-09 lsp（RLW 行）live 探针：对着 W4 冻结装配面的编码断言（PR6 缺口对照）。
// 依赖声明（机检矩阵 pending_probe.depends_on 同步）：
//   W4 观测面 = 持久服务进程经 ConfinedProcessProvider 装配（服务器自身 OS 读走 Confined；
//              per-Member 独立 pid；策略变更→旧 PID 终止重建=池键含 policyGeneration 的机制腿）；
//   IF-6 名称面 = Strict deny 兜底以既有 typed 名呈报（不新造 §5 码）。
// 判据（矩阵 M-09 note）：恢复判据=per-Member 池 PoC 成功 + 策略变更→旧 PID 终止重建断言；
// 已知公开面缺策略输入通道（pr6/SEAM-VERDICTS.md:59）——该腿无观测数据 ⇒ PROBE-GATED（门禁不猜，
// 差距行同步登在 vnext-migration-gap-checklist.md），不因此 FAIL 也不因此 LIVE。
// 当前无装配 ⇒ 运行即 NOT-RUN-READY exit 3 + 缺装配原因（禁假 PASS）。零端口零世界，纯只读。
// writer=alpha5-wire-pr8prep（qwen3.8-flash-next）。
import { runProbe, probeRelPath, receiptRelPath, clauseField, ASSEMBLY_ANCHORS, GLUE_PATH } from './probe-lib.mjs';

await runProbe({
  rowId: 'M-09',
  family: 'lsp',
  probeRelPath: probeRelPath('M-09'),
  receiptRelPath: receiptRelPath('M-09'),
  deps: [
    { lane: 'W4', surface: '持久服务进程经 provider 装配（服务器 OS 读中介 + per-Member pid + 池策略代际腿）', if_refs: ['IF-1', 'IF-6'] },
  ],
  preflight: [
    { id: 'w4-spawn-assembly', lane: 'W4', surface: 'ConfinedProcessProvider 会话装配（IF-1）', kind: 'anchor', files: [GLUE_PATH], anchors: [ASSEMBLY_ANCHORS.W4.glue_anchor] },
    { id: 'registry-50-run-mounted', lane: 'W4', surface: 'registry 套件 50-ptc-lsp 断言实现挂载（run≠null）', kind: 'registry-run', suite: '50-ptc-lsp' },
  ],
  assertions: [
    {
      id: 'A1-per-member-distinct-pids',
      criterion: 'per-Member 独立 pid 在装配面复现（PoC6b 主问=通过的升级证据）',
      run: (r) => clauseField(r, 'pool.per_member_pids_distinct', true, '每 Member 独立 pid 观测在册'),
    },
    {
      id: 'A2-policy-generation-eviction',
      criterion: '策略变更 ⇒ 旧 PID 终止 + 重建（池键 ⊇ …+PolicyGeneration 的机制腿；公开面无策略输入通道时此腿必无数据 ⇒ PROBE-GATED）',
      run: (r) => clauseField(r, 'pool.policy_change_old_pid_terminated_recreated', true, '策略代际逐出/重建观测在册'),
    },
    {
      id: 'A3-server-os-reads-mediated',
      criterion: '服务器自身 OS 读经 Confined 中介（06-lsp p05 HAZARD 的装配级封堵）',
      run: (r) => clauseField(r, 'server_os_reads_mediated', true, '服务器读全部走中介面观测'),
    },
    {
      id: 'A4-shared-pool-cross-policy-reuse-observed-denied',
      criterion: '共享池跨策略复用同 PID（HAZARD）不再可能：跨策略同 pid 主张即违例',
      run: (r) => clauseField(r, 'pool.cross_policy_pid_reuse', false, '跨策略同 PID 复用=0'),
    },
  ],
});
