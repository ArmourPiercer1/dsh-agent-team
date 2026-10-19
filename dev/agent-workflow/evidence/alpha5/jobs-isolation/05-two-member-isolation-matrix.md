# ② 两成员隔离全矩阵（Alpha.5 收口轮 · B 路）

基线=d5de7497；证据前缀 `dev/agent-workflow/evidence/alpha5/jobs-isolation/`；单元套件证据=各测试文件内联（本表给 文件:测试名 级锚点，均可 `vitest run` 复跑）。
图例：✅=已收口（正+负都在册）｜🟡=正控在册、负控在他处/部分｜⏳=接通中（B-ACT-1-PR）｜❌=未测（如实）。
两成员世界基元：root=teamRoot 会话；成员 A/B=durable MemberInstance 对（`{rootSessionId,instanceId}`）；隔离断言两形=**正控**（各自可见/可用）+**泄漏负控**（跨成员必被拦且**拦截本身可测出**）。

## D1 状态（成员实例/生命周期）

| 格 | 正控 | 泄漏负控 | 判定 |
|---|---|---|---|
| durable 身份权威源只认本 root | `durableMemberIdentitySource`：authority 副本剥离夹带字段；无行→null（a5p7-jobs-assembly.test.ts "authority copy strips smuggled fields" / "no row→null"） | **异根声明=null 即便行存在**（"other-root claim null even when row exists"）；repository 抛错→null 不猜测 | ✅ |
| 成员激活/外部恢复围栏 | activation fence（A2/G2 先例，d3-member-identity-context.test.ts） | 非激活态恢复=拒（同套件在册） | ✅（R 盘点 M 行引用） |
| 归档成员冷重挂 | a5ptc-escalation-row L-U1b：归档成员=PRODUCTION PROCEDURE FORM | L-U2 冷重挂陈旧身份**永不泄漏**（"stale identity never leaks"） | ✅ |

## D2 事件/观测

| 格 | 正控 | 泄漏负控 | 判定 |
|---|---|---|---|
| 观测台账 owner-scope | gateway `projectJobForViewer`=owner-only 行（web-projection.ts:82 + a5p7-job-owner 套件 9 测） | 跨成员 projectFor 拒且 **detail 不回显 ownerKey/instanceId**（a5p7-jobs-assembly "projectFor refusal detail lacks inst-1"） | ✅ |
| 凭据脱敏在采集处 | web-projection `redactCredentials` AT COLLECTION（在册测试+R M 行） | 泄漏词根零出现（denylist 扫描） | ✅ |
| 幻影事件 | 未知 callId settle → `gateway-event-unknown-job`，零状态位移 | 不伪造结算（同套件） | ✅ |
| legacy 词汇 census | p4t6 十测（含 1207/1208 双续链 + tie） | denylist 身份集零新增、quarantine 命中=15 恒定 | ✅ |

## D3 工具面

| 格 | 正控 | 泄漏负控 | 判定 |
|---|---|---|---|
| 未绑定探针 | we2：placement 已验证绑定的真实 dispatch | `a5e2_unbound_probe` 过真实 dispatch 必拒（在册） | ✅ |
| 跨成员 lease 互斥 | W7 kit 三件套（互不可见/lease-mutex/撤销→恢复，GREEN 22/22 + RED 9/22，evidence/alpha5/wiring/w7/） | 同格互斥即负控 | ✅ |
| deny 道两成员世界 | a5ie-r2b D1：shell-DENY 成员命中 template-deny-lane | 非 deny 成员继续（**泄漏形=deny 不跨员传染** 同套件在册） | ✅ |
| 同名接管冒充面 | natexe：PLANE_RESERVED_NATIVE 全表 + 双向 drift pin | 每个敌意拼写 typed 拒（a5natexe 22 拒形 verbatim 断言）；C2 台账更新后**在册复跑 GREEN**（runs/c2-GREEN-lease-and-natexe.log） | ✅ |
| jobs 三管理名挂载 | **C2 新增**：jobsEnabled 开=三行入 ownNames/placementFeed（a5p7-jobs-assembly-actuator "enabled WITHOUT a bridge…" / "enabled WITH the real bridge…"） | 键缺省=零翻转（"key ABSENT mounts no job row at all"）；非布尔=typed 拒挂 | ✅（单元面）；装面 ⏳C3 |

## D4 jobs（本 lane 主面）

| 格 | 正控 | 泄漏负控 | 判定 |
|---|---|---|---|
| 同 ID 争用 | A 先登记者持权（actuator "bash-background receipt…"） | B 抢同一 hostJobId → `owner-mismatch` + alarm，A 记录/token 零扰动（"cross-member attribution attempt… never a swap"） | ✅ |
| 跨成员管理调用 | owner 检查通过=corded record | B 对 A 作业 → typed owner-mismatch，**宿主层调用计数=0**（"refuses WITHOUT any host touch"，MEASURED non-reach）；mount 级同形（C2 "enabled WITH the real bridge" denied 段 + detail 不回显） | ✅ |
| 无记录透传 | corded:false 交宿主 caller fence（"NO team record passes corded:false"） | 宿主层自身 `belongs to another session` 原文在场、两层互不代偿（同测 verbatim 断言） | ✅ |
| 过期回收 | （见①结论：lease 层无 TTL=法；grant-expired→APPROVAL_STALE @grant 层；provider termination-unconfirmed @provider 层） | 同左 | ✅（①收口） |
| kill 两形 | 'requested'→cancelRequested 置位、token 屹立（"kill → requested marks…keeps token outstanding"） | 'already-finished' 零结算；unknown id typed 拒（"never invents"） | ✅ |
| 创建归属生产者 | — | **治理世界无背景作业生产者**：confined shell 行**按名拒** background（plane-effect-backends.mjs `background-not-supported`，"never reinterpreted"）⇒ 归属登记 API 在位、生产方=零（corded:false 透传=现存活形）。**记录，非缺口掩盖**：宿主无 job_start 工具面（钉面+全树互证）=宿主法律 | ✅（记录形） |
| 装面端到端（3188/3496/a5jobs-*） | 计划 C3：两成员世界正反控+Z1 对照+drain | 同左 | ⏳（接通已落装：C2 commit；前置=host.ts 依赖行缺项单 **B-ACT-1-DEP**，见 04 号证据） |

## D5 审批/复核（PTC/ask 道）

| 格 | 正控 | 泄漏负控 | 判定 |
|---|---|---|---|
| steer/followup 禁层 | permission-notification/binding.ts:12 FORBIDDEN 层 | :500 源码钉"module source never names a wake-capable call site"（结构负控） | ✅ |
| instance-addressed 路由 | messaging/coordinator 正例族 | self-send REJECTED；label token 拒（不变式 19）；**"handle whose identity is not the EXACT addressed pair drops"**（a3p5 :373） | ✅ |
| PTC 一次性/键隔离 | NC-1 one-shot replay 拒 | **NC-3 "another root never vouches for this root's grants; keys are member-scoped"**（a5ptc-escalation-row） | ✅ |
| L-U1 驻留/投递 | 正投递 | 非驻留即 drop（L-U1 在册） | ✅ |
| 审批道×成员数×工具面组合矩阵 | 见 ③ 兼容矩阵行 | 同左 | 🟡（组合维=③） |

## D6 abort/中断

| 格 | 正控 | 泄漏负控 | 判定 |
|---|---|---|---|
| cause 中继 | a5r-cause-relay（#345 abort-cause） | cause 不跨员窜改（在册） | ✅ |
| per-call pending-calls 作用域 | scoped dispatcher per-scope 结算 | 跨 scope settle=zero-delta（同族） | ✅ |
| lease 门 drain 门序 | drain 后新 admit=gateway-not-active（C1 "drain refuses new admits at the lease door"） | cross-drain settle 保 token；giveUp 永拒 release；重组装=新窗（同套件三条 verbatim） | ✅ |
| job 级 cancel 宿主端到端 | （gateway 语义形=C-PROC 两形已钉） | M26 在册：job-level cancel BOUNDED-DEFER（宿主面语义未裁形，勿造） | ❌→⏳（随 C3） |
| 成员面 abort（M06 RED C1 open） | — | **他 lane 在飞**（#347 待用户），非我修面；矩阵如实挂 RED(C1) | ❌（记录） |

## 收口判定

- 六维中 D1/D2/D3/D5 单元面全绿收口；D4=本轮主增量（14+6 新测，装配+挂载两面在册）；D6 两格挂他 lane/宿主记录。
- **泄漏负控纪律**：所有"跨成员必拦"格均有**拦截可测出**证据（typed code + 宿主零触达计数 + 不回显身份三形至少其一）。
- 未测清单（诚实入账）：装面端到端（C3，前置 B-ACT-1-DEP）；M06 abort 装面（他 lane）；M28 LSP 装面腿（③）；M30 MCP 经治理链执行（③）。
