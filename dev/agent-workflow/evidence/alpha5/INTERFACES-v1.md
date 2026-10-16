# Alpha.5 并行实施契约 v1（2026-10-16 15:2xZ；协调者=集成 owner；契约节各有 owner）
基线=origin/master **db5cb5f7**（固定 SHA）。全部 lane：qwen3.8-flash-next；模型/harness 分列；DORMANT（不 live-wire，不注册进装配）；RED-first；only_in_after=[]；token 采集即脱敏；storm fuse；:3080 只读；不部署/不改内核网络/不扩权限；共用文件（根 registry、live glue、tsconfig、barrel、scanner）只有集成 owner 可改——lane 各自 worktree 内新目录+本地 contract stub。

## C-ADM（owner=PR2 lane）
- deny 来源三分类：`effect-policy`（扩权面终局，来源=ToolPolicyDocument 读时投影）/`envelope`（可升阶进既有 ApprovalCase）/`unknown`⇒`deny-source-unattributed` 拒+诊断，禁伪装终局。
- **R-1a 律（ruling③ 推论）**：被拒索引的 rung 必须 ≥1 条匹配被拒 scope 的已绑规则支撑；无支撑⇒走 unknown 腿，**不得取 ladder 默认 rung**（fail-open=伪装授权）。
- provenance（撤销的是哪条 DENY@rung）须随 planApproval/observe 事件可见（PR3 审批面依赖）。
- Grant：one-shot、generation、spent-once 语义不变；时钟非有限⇒typed 拒先于一切（H1）。
- 接口面：`admission-kernel.ts`/`approval-case.ts` 导出类型只读消费；禁第二授权库。
- **C-ADM v1.1（PR256 @a51b903d 实现锚定）**：policy deny 来源=`PolicyDenySource` 读时投影（ownerAuthority+sourceRef+sourceVersion==generation 才可信）；case 层级=max(walk, rungAbove(owner))；issue 侧重跑证明；未接线=精确拒（非 DORMANT）；Envelope 内容永非来源证据；两平面 no-match 律不动。六态对照表=r1a-source-contrast.md（固定 SHA）。**消费者版本 pin：C-ADM@v1.1=PR256 a51b903d；C-BIND/取消分型@v1.1=PR257 merged 452a04c0；**发射名勘正 v1.1a（Lane D finding @e3f660fa）**：master 实发全名均带 dispatcher-call- 前缀=install.ts:673 cancelled-before-body / :662 terminated-after-body-start / :686 completed-after-abort / :651 outcome-unreadable / :763 executed-unvalidated（引用请以 :行+全名为准）；旧行后五个无缀短形系文档混写；"cancelled-by-others"在 master tool-dispatch 未检得发射点——消费者含此名者接线门对齐。**）。

## C-FS（owner=B  Lane）
资源描述符 {fs,path,fd?}；错误闭集 typed（denied/hidden/undetermined 三分，hidden-read 永不静默——必须 typed deny+诊断行）；open-at-exec 重读与 PR1 指纹律对齐（集成前置：C-ADM 冻结后接线）。

## C-PROC（owner=C Lane）
阶段闭集 probe→prepare→execute→terminate；FD 继承集显式声明；网络维度闭集；terminate≠cancel（对齐 C-GW 取消边界）；探针权威面=裸 syscall GET_VERSION+真实 enforcement 双证（PR4 findings §3），存在性检查只作前置报告。

## C-GW（owner=F Lane，取消语义与 PR1r B3(ii) 对齐）
Lease 生命周期 ACTIVE→DRAINING 边界=settled 边；**已开始/未开始**取消分型=PR1r 实现为权威（abort-before-exec 形 vs 终止形，事件面可区分）；JobOwner 身份=member scope。

## C-BIND（owner=PR1r Lane）
tools/change=信息通道非安全机制；scope 过滤仅防误伤；取消集合=逐在飞用自己的 (scope,name) 重读判身份；结果身份=执行时刻已核验 definition。

## C-VNEXT（owner=G Lane）
字段映射默认拒绝、无隐式默认；v3 生产文档不改；机器可读验收矩阵=PR8 骨架权威。

## 集成规则
- 上游未合=下游用**固定内容 stack**（cherry-pick 自审查 SHA，本地记录 baseSHA）或**契约 fixture**开发；**不得宣称整链已验证**——只可宣称"对 fixture/stack 验证"。
- 契约争点：只冻结争点接口，其余 lane 继续；版本变更仅契约 owner 提，集成 owner 落。
- 合并拓扑序不变：257→256→PR3/PR4(并行度=CI 资源)→PR5(FS/shell 各自)→PR6∥PR7→PR8 收口；每合一个→下游重指→required CI 真 SUCCESS→再合。

- **消费者版本 pin 更新（v1.2，2026-10-16 20:4xZ，master 侧）**：C-ADM@v1.1=master ae3dcf54（PR256 merged 18:31Z）；C-BIND@v1.2=取消语义用户裁决（2026-10-16 17:52Z，边界三句见 PENDING-GATES.md G-a 行；DEFERRED D-1=严格"只取消未执行"待公开 body-start 接口）；C-FS@lane=B merged 74d947a3；C-PROC@lane=C merged 2cd5185f；工具面@D merged d69bfc4b（lint-fix 后）；PR6-evidence@E 6ce62c25；C-GW/adapters@F fc9f4a07（typefix 后）；PR8 候选+runner@G/#266 3b2c23c5。全部 DORMANT——合并≠接线验收；G-g 仍 OPEN。
