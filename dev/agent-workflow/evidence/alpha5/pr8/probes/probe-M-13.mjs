#!/usr/bin/env node
// probe-M-13.mjs — M-13 Domain 工具（RLW 行）live 探针：对着 W7 冻结装配面的编码断言。
// 依赖声明（机检矩阵 pending_probe.depends_on 同步）：
//   W7 观测面 = jobs 身份/lease 经 jobs-gateway 公开面装配（两 member 同宿主隔离实测）之上，
//              Domain 引用/许可经同一身份面观测；Domain mock（CAS/模拟设备联锁）为观测数据源；
//   IF-6 名称面 = 未确定 Domain reference fail-closed；DOMAIN_DENIED（doc M-13 reject_error_candidates 登记名）。
// 判据（矩阵 M-13 note）：TeamPermit ∧ DomainPermit 任一方拒不可被另一方覆盖；veto ⇒ 0 side effects 观测。
// pinned absent-anchor（job_start）不因本 probe 改变——absent 仍如实（ALPHA5-ACCEPTANCE-STATUS §2-③）。
// 当前无装配（jobs-gateway tsconfig/live 未落）⇒ 运行即 NOT-RUN-READY exit 3 + 缺装配原因（禁假 PASS）。
// 零端口零世界，纯只读。writer=alpha5-wire-pr8prep（qwen3.8-flash-next）。
import { runProbe, probeRelPath, receiptRelPath, clauseField, clauseContains, ASSEMBLY_ANCHORS, GLUE_PATH } from './probe-lib.mjs';

await runProbe({
  rowId: 'M-13',
  family: 'Domain 工具（HPC/RPC/研究状态/设备）',
  probeRelPath: probeRelPath('M-13'),
  receiptRelPath: receiptRelPath('M-13'),
  deps: [
    { lane: 'W7', surface: 'jobs-gateway 公开面装配（身份/lease/隔离）之上的 Domain 许可/引用观测面 + Domain mock 联锁数据源', if_refs: ['IF-1', 'IF-6'] },
  ],
  preflight: [
    { id: 'w7-jobs-gateway-registered', lane: 'W7', surface: 'jobs-gateway live 装配（IF-1）', kind: 'anchor', files: [GLUE_PATH], anchors: [ASSEMBLY_ANCHORS.W7.glue_anchor] },
    { id: 'w7-jobs-gateway-in-build-plane', lane: 'W7', surface: 'jobs-gateway 进编译/emit 面（tsconfig include 落地，WIRING-SURFACE:34 缺项的关闭信号）', kind: 'anchor', files: ['packages/runtime/tsconfig.build.json'], anchors: ['jobs-gateway'] },
    { id: 'registry-60-run-mounted', lane: 'W7', surface: 'registry 套件 60-web-jobs-mcp-domain 断言实现挂载（run≠null，含 Domain mock）', kind: 'registry-run', suite: '60-web-jobs-mcp-domain' },
  ],
  assertions: [
    {
      id: 'A1-team-deny-not-overridable',
      criterion: 'TeamPermit 拒 × DomainPermit 允 ⇒ 终局拒（另一方可不能覆盖）',
      run: (r) => clauseContains(r, 'veto_matrix', { team_permit: false, domain_permit: true, outcome: 'denied' }, 'Team 拒不可被 Domain 覆盖'),
    },
    {
      id: 'A2-domain-deny-not-overridable',
      criterion: 'DomainPermit 拒 × TeamPermit 允 ⇒ 终局拒（DOMAIN_DENIED 观测名在册）',
      run: (r) => clauseContains(r, 'veto_matrix', { team_permit: true, domain_permit: false, outcome: 'denied', error: 'DOMAIN_DENIED' }, 'Domain 拒不可被 Team 覆盖'),
    },
    {
      id: 'A3-veto-zero-side-effects',
      criterion: 'veto ⇒ 0 side effects（观测面=assembly-ledger/联锁记录，非宣称）',
      run: (r) => clauseField(r, 'veto_side_effects', 0, 'veto 后副作用计数=0 的观测记录在册'),
    },
    {
      id: 'A4-unresolved-reference-fail-closed',
      criterion: '未确定 Domain reference ⇒ fail-closed typed 拒（不猜测绑定）',
      run: (r) => clauseContains(r, 'negative_controls', { attempt: 'unresolved-domain-reference', outcome: 'typed-deny' }, '未确定引用负控在册'),
    },
    {
      id: 'A5-job_start-anchor-still-absent',
      criterion: 'pinned host absent-anchor job_start 仍 absent（本行不制造该面；出现即违例=杜撰锚点）',
      run: (r) => clauseField(r, 'pinned_host.job_start_present', false, 'absent 仍如实（design:72 不杜撰）'),
    },
  ],
});
