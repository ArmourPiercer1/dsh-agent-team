#!/usr/bin/env node
// probe-M-05.mjs — M-05 read_image（RLW 行）live 探针：对着 W4/W5 冻结装配面的编码断言。
// 依赖声明（机检矩阵 pending_probe.depends_on 同步）：
//   W5 观测面 = admission 门控工具面注册进测试会话（IF-1）——read_image 附件读取腿宿主；
//   W4 观测面 = 受控读经 provider/ControlledFs 装配的真实执行（deny-before-open 观测）；
//   IF-6 名称面 = 未绑定调用 typed 拒 admission-unbound；越权读 typed deny（禁缩略图绕过 read 授权）。
// 判据（矩阵 M-05 criterion）：03-fs 未测清单全链携带 = 附件→渲染授权身份全链可观测；
// 禁以缩略图绕过 read 授权；OpenAtPort 前 arbitrary-tree 不发布（探针不主张任意树，receipt 若主张 ⇒ VIOLATED）。
// 当前无装配 ⇒ 运行即 NOT-RUN-READY exit 3 + 缺装配原因（禁假 PASS）。零端口零世界，纯只读。
// writer=alpha5-wire-pr8prep（qwen3.8-flash-next）。
import { runProbe, probeRelPath, receiptRelPath, clauseField, clauseContains, ASSEMBLY_ANCHORS, GLUE_PATH } from './probe-lib.mjs';

await runProbe({
  rowId: 'M-05',
  family: 'read_image',
  probeRelPath: probeRelPath('M-05'),
  receiptRelPath: receiptRelPath('M-05'),
  deps: [
    { lane: 'W5', surface: 'admission 门控工具面注册进测试会话（IF-1）——附件读取工具腿', if_refs: ['IF-1'] },
    { lane: 'W4', surface: '受控文件读经装配面真实执行（deny-before-open 观测腿）', if_refs: ['IF-1', 'IF-6'] },
  ],
  preflight: [
    { id: 'w5-tool-face-registered', lane: 'W5', surface: 'admission 门控工具面注册（IF-1）', kind: 'anchor', files: [GLUE_PATH], anchors: [ASSEMBLY_ANCHORS.W5.glue_anchor] },
    { id: 'w4-spawn-assembly', lane: 'W4', surface: 'ConfinedProcessProvider 会话装配（IF-1）', kind: 'anchor', files: [GLUE_PATH], anchors: [ASSEMBLY_ANCHORS.W4.glue_anchor] },
    { id: 'registry-20-run-mounted', lane: 'W5', surface: 'registry 套件 20-controlled-fs 断言实现挂载（run≠null）', kind: 'registry-run', suite: '20-controlled-fs' },
  ],
  assertions: [
    {
      id: 'A1-full-chain-via-gated-fs',
      criterion: 'image 字节读取全链（附件引用→解码→渲染）经 admission 门控 ControlledFs 观测（03-fs 全链未测项闭环）',
      run: (r) => clauseField(r, 'image_read.chain', 'admission-gated-controlled-fs', 'receipt 须记录读取链=gated fs 而非 host 直读'),
    },
    {
      id: 'A2-no-thumbnail-bypass',
      criterion: '以缩略图/预览旁路取图必被 read 授权拒（typed deny，不静默）',
      run: (r) => clauseContains(r, 'negative_controls', { attempt: 'thumbnail-read-bypass', outcome: 'typed-deny' }, '缩略图绕过负控=typed 拒且有诊断行'),
    },
    {
      id: 'A3-unbound-typed-refuse',
      criterion: '未绑定调用 ⇒ typed 拒 admission-unbound（IF-6 原名），零字节外泄',
      run: (r) => clauseContains(r, 'negative_controls', { error: 'admission-unbound', bytes_leaked: 0 }, '未绑定调用负控在册'),
    },
    {
      id: 'A4-arbitrary-tree-never-asserted',
      criterion: 'OpenAtPort 前任何"任意可变树已支持"主张即违例（doc openat_port_gate 恒 false 的观测面对照）',
      run: (r) => clauseField(r, 'arbitrary_tree_profile_published', false, 'receipt 不得主张任意树已发布（发布=OpenAtPort 落地后另行转态）'),
    },
  ],
});
