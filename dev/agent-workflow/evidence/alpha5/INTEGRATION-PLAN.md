# Alpha.5 集成会话计划（集成 owner=协调者；每步=共享文件独占改动+跑门+记录）
前置：#256 rebase 推送→retarget→CI→合并（G-c 关闭）。此后各 lane 逐个 rebase→master（内容同一性证明：git diff --name-only 只含 lane 文件）→建 PR（base master）→独立复核已完成的直接进 CI→合并。顺序（DORMANT 并行度=CI 资源）：B(PR3-fs)→C(PR4-prov)→D(PR5 工具)→E(PR6 勘查件=docs)→F(PR7 jobs)→G(PR8 候选=docs)→#258(docs)。
集成 owner 专属动作（G-d 义务落点，全部只在集成会话改共用文件）：
1. p4t6 tie 并集：1073→1087(F +14 按 hygiene 列表:52-73)→1090(C +17 或按 C 分支 hunk)→并集注释链；每次改后 p4t6 10/10。
2. runtime/tools tsconfig include + barrel/registry：仅当对应 lane 从 DORMANT 转正接线时；本阶段 **全部保持 DORMANT**（不接 live glue）→多数 include 不加，仅测试树可发现（lane 自带 tsconfig 已在，root vitest include 是否扩=接线决策，默认=加 include 以进 CI 门，仍零生产 import）。
3. Lane C 条件：PR5 接线期补 rc 退出码面+hardDimensions 必配；audit 消费者集保持 4 件全 PR1。
4. Lane B 条件：C1 接线注（AdmissionRecheck→PR2 admission 绑 PR1 parametersFingerprint；subtree→SubtreeContains；OpenAtPort 前 PR8 禁发布 arbitrary-tree profile——写入 PR8 矩阵 M-05/相关行）。
5. Lane E MINOR×2（日期/ptc.ts 行号）+PR8 矩阵逐字携带三条限定；Lane G NIT：authority_refs 钉 SHA（改 b0d636eb 系坐标）+快照引 #258@86719028；Lane F 条件：lease 句柄不外露（接线时）、identity 导入切换重跑 hygiene-2、README 979→993 陈旧改 1073→1087。
6. 每次并入后：root vitest NEW=0 对照 + check:artifacts drift=0 + lint universe 记录；合并前 PENDING-GATES 全表过一遍（用户纪律）。
明确不做：live 装配/registry 注册/端口暴露；F-3 receipt digest（PR3 正式轮）；G-a 冻结面接线。
## 预检（merge-tree 干跑 @ 18:5xZ）
- vs master=452a04c0：**仅 alpha5-pr4-prov 有 1 冲突**=p4t6 ledger tie（与 PR1r 侧并集，解法已裁=union 1073→1087→1104 注释链）；其余六分支（含 #258 followup）零冲突，可直接快进式 rebase/合并。
