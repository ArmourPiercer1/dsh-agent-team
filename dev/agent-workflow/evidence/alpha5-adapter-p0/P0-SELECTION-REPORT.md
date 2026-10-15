# Alpha.5 P0 — 路线选择报告（PoC，非产品 GO）

> **状态：EXECUTED-PARTIAL / P0 NOT CLOSED（双独立复核 R1+R2 = PASS 复核面）。** 本报告记录 2026-10-16 授权的 P0 PoC 实验事实。
> 依据 `P0-independent-adapter-poc-implementation-guide.md`（PR#249 @`d3c9760d`）§5 算法逐工具族出 verdict。
> **fixture 级证据只收窄范围；GO 只能来自真实 pinned Host（§5 明文）。本报告不含任何 GO。**

## 0. 冻结版本与环境
| 项 | 值 |
| --- | --- |
| 实验 worktree/分支 | `.worktrees/exp-alpha5-poc-20261016` / `exp/alpha5-poc-20261016` @ `d3c9760d8f8ea2a2bfac4fd628133261b127f756`（PR249 head；OPEN；未 merge） |
| origin/master | `d455a274eee9e465df26d63f563d0cd4bbb0ec22` |
| pinned Host | 0.2.0-rc.2 @ `639ed015397290b3745d163aafe02ffee4aa3f84`（test-use 克隆自建，全程 porcelain=0） |
| 基线保护 | 主树 `master@6259cf4b`（脏 1 既有文件）与 `fix/post-alpha4-20261016@7e2a25ec` 全程未动；G1 trim 未触碰 |
| 模型 | 主代理+全部子代理 qwen3.8-flash-next（rev-D/E 及 E1/E6 有逐字自报；其余由 workflow/subagent 参数钉定） |
| 沙箱事实 | 本 harness 会话运行于宿主 bwrap 沙箱内（PID1=bwrapProfileArgs(workspace-write)）。**定性（按实测，不外推）**：拦截点=userns 可创建但 uid_map 写 EPERM + 会话 NoNewPrivs=1 + bwrap 非 setuid 无法自建 namespace；"嵌套结构性不可能"**不作为结论**，landlock 是否内核不执法待诊断代理最小正负控复核 |

## 1. 执行面（每项=commit+日志+命令+耗时+判定）
| 实验 | 计划条款 | 结果 | 证据/复跑 | commit |
| --- | --- | --- | --- | --- |
| E1 源码锚定 S-01..S-12 | §0.1 | **12/12 CONFIRMED**（4 条位置注记） | 00-baseline/source-map.md | 74151aad |
| P0-0 双 Scope fixture+计数器 | §3 P0-0 | **5/5 PASS**（<1s；含 preset 父子拓扑腿） | 00-baseline/p00-runner.mjs→p00-run.log | 74151aad+aaf327a8 |
| P0-1 路由/竞态 BND | §3 P0-1,§4 BND-01..06 | **12/12 leg PASS**：own-layer 同名遮蔽即独占（BND-01）；safe-unload native=0（BND-02）；**竞态窗实存**=dispatch 期 `resolveExecution`(index.ts:1578) 晚期重解析：safe 序 native=0，**lift-mask 危险序 native=1（预期反例=设计防护证据）**；guard-after-allow 单调（BND-04）；agentless=全局 lane 不覆盖（INV-1 素材）；run_code 双面拒绝 | 01-routing/p01-runner.mjs | 74151aad |
| P0-4 OS 强制能力 | §4 PROC/NET/SRCH 依赖 | **ENV_BLOCK×4**（bwrap 嵌套拒/netns EPERM/userns 不可映射/landlock 强制不可观测）；S-10 源码 CONFIRMED | 04-process/env-capability-probe.sh（幂等） | 5406a21e |
| P0-6 阶段1 真实宿主冷启动 | §3 公共前置/P0-6 | **PASS**（boot 行+401 门+303+test-use byte-clean+token 已脱敏） | 07-integration/host-boot.log | d523a7d4 |
| P0-6 阶段2a 公开 seam 插件 | §3 P0-6 装配面 | **PASS**（Team 插件经 cordis.patch.yml file-URL 行在真实宿主进程内注册成功） | 07-integration/stage2-boot.log,02-plugin/ | 7559b652 |
| P0-2 grep/glob 竞速 | §3 P0-2,§4 SRCH-* | **INCONCLUSIVE(fixture-supports-R3)**：SRCH-03 12/12 真 rg 对照 PASS（argv 全存）、async confine→spawn 桥 PASS、A/B 结果深相等；**R2=fixture-shows-prereq-missing**（无 subprocess 服务→fiber PENDING 零注册，非 throw）；R4 NOT-ELIGIBLE；SRCH-04 spill NOT_RUN | 02-search/p02-search-runner.mjs→p02-result.json+notes.md | df5b27df |
| P0-3 Controlled FS | §3 P0-3,§4 FS-01..04 | **11/11 PASS**（strace 逐腿孵化复跑=OS 级 open 计数；观察自污染通道修正留痕）；硬链接发现：realpath≠对象身份→需 realpath+(dev,ino) 拒绝集；未适配旁路腿实证 INV-1 缺口 | 03-fs/p03-fs-runner.mjs→p03-result.json+notes.md | 25cfa3c1 |
| P0-5 PTC/LSP | §3 P0-5,§4 PTC/LSP-01 | **PTC**：8 腿（1-7 PASS/CITED，8 NOT_RUN）——内层 dispatch 走同一分级管线且 scoped guard 可断内层（原体 0）；桥可公开构造=无需 blocker。**LSP**：全栈公开挂载+池化实证——同路径不同策略共享常驻 pid（HAZARD-OBSERVED），服务器侧 OS 读不受限（虚构数据）；§6.1 十一字段 CORE 素材已录（素材，非宣告） | 05-ptc/+06-lsp/ 各 runner+result+notes | eaec6c55 |
| P0-6 阶段2b 宿主级 BND/Team 世界 | §3 P0-6 | **PASS（run-2026-10-15T22-44-01，VERDICT 10/10）**：隔离真实宿主 :3185、mock-model Team world；成员原生 read 真实执行、同名 Adapter 遮蔽+对照成员不受影响、dispose→typed unknown（restrict 保留）；原始失败全留痕（蓝图校验×2、mock 线块形 root-cause+storm fuse、oracle off-by-one） | 07-integration/03-stage2b/ | c43fc41b |
| P0-7 独立 Reviewer | §2.7/§6 | **R1 PASS（c46ffb76）+ R2 PASS（delta→9e422ff5，13/13 VERIFIED 零 REFUTED）**：两轮均亲手复跑/独立反"恒真"抽验（strace 负/正控、rg argv 重放、obs 计数、真实 spawn pid）；两位 Reviewer 均自报 qwen3.8-flash-next；均明示"复核 PASS≠P0 关闭≠GO" | 08-review/p07-review-R1.md, p07-review-R2.md | 42867b7b+本轮 |

## 2. 逐工具族 verdict（§5 算法；含 PENDING 者按已证部分写 INCONCLUSIVE）
| 族 | verdict | 理由（真实值） |
| --- | --- | --- |
| read/write/edit/move（Controlled FS 面） | **INCONCLUSIVE（方向支持进程内 Controlled FS）** | 11/11 腿绿但前置未满足：①INV-1 全覆盖（bypass 腿实证 T_dispatchable⊋T_governed 时缺口即成）②真实宿主复核；策略要求新增：realpath+**(dev,ino) 对象身份**双检（硬链接绕过实证） |
| grep/glob | **INCONCLUSIVE（fixture-supports-R3；倾向 R3 候选）** | fixture 级 parity/桥全绿但 GO 需真实宿主（spill/取消/并发/隔离未覆盖）；R2 需 subprocess 服务前置；登记差异 presentationMeta 非包根可复现 |
| bash/pwsh（Confined Spawn 面） | **LANDLOCK 读面 SUPPORTED（修正）/ bwrap·netns·uid_map 维持 ENV_BLOCK** | 诊断代理实测 landlock ABI v4 ENFORCE-WORKS（前轮假 ABSENT=探针 handled_access 常量 bug，逐字复现+正确正负控+fork/exec 继承腿，ext4/tmpfs 双 fs）→ adapter 侧 landlock 预 exec 自锁即可做读收缩，不依赖 userns/bwrap；嵌套限制按实测拦截点表述（uid_map EPERM 与 unshare() EPERM 两层，不外推"结构性不可能"）|
| bash/pwsh 补强 | **landlock 通路 OS_ENFORCED（10-landlock-lanes）** | 受限读/受控 spawn/不可信命令注入负控/双层拒全绿；机制=子进程入口自锁（ruleset fd CLOEXEC 不可跨 exec）；锁不可自解=能力域交集棘轮；适配要求=非交付 fd 强制 O_CLOEXEC；bwrap/netns/uid_map 维持各自实测 ENV_BLOCK |
| run_code/PTC | **fixture 级全证（外层腿已补；宿主级复核归 P0-6）** | 保留拒绝 CONFIRMED；内层 guard 断链 PASS；**PTC-08 外层 PASS**：dsh-ptc-runtime-node EXISTS-PUBLIC，生产 NodePtcRuntime 外层真实进程+真 run_code 桥，guard 拒内层=原体 0+durable isError、正控=原体 1、同管线 exec.parent=true |
| LSP | **INCONCLUSIVE + 严格 Profile fail-closed 为安全兜底（族=Bounded Defer）** | 池键=仅路径身份、seam 无策略通道、服务器侧 I/O 不受限（真实池化代码路径+虚构服务器）；CORE 素材十一字段已录，留待上游接口讨论；fixture 不构成 LSP-01 全量 PASS |
| web/jobs/MCP | **INCONCLUSIVE(方向性)×3，无 GO**（09 路本地回环/mock，30/30） | web：拒绝发生在 fetch 调用点前（零 socket/零 DNS/tripwire=0），重定向/超限/超时闭环，生产 provider 回环预 socket fail-closed；真实外网行为=申请项非默认缺失。jobs：生产 service 直调闭环（族形态钉死：模型面仅 job_output/list/kill）；owner-scoped NOT_RUN(缺 dsh-agent)。MCP：生产 mcp-client+stdio mock 真子进程，同名遮蔽下子进程侧零调用，代际回收全验。证据 09-web-jobs-mcp/ |

## 3. 关键设计证据（喂给后续实施计划）
1. **独占分发机制已在 pinned ToolRuntime 上实证**（fixture 级）：own-scope 同名注册即遮蔽继承面（BND-01）；restrict-first 装配 + 原子有序卸载在竞态窗（prepare→dispatch 重解析）下保持原体 0；**卸载顺序错误（先撤 mask）确定性复现危险时序** → 实施必须原子有序装配+调用排空证明（guide §3 P0-1 步骤 6 由本反例闭环）。
2. **单调 guard 不能被前段 allow 绕过**（L4）；`tools/execute` 环绕不可当替代 ToolDefinition 通道（S-04 源码 + L4 行为一致）。
3. **agentless 调用走全局层**（L6）：Team Adapter 覆盖不了无 agent 作用域的 dispatch → INV-1 的 binding 覆盖必须显式处理该 lane。
4. **受限读是本宿主的硬环境缺口**（P0-4）：任何"OS 级受限读"验收都必须换/配宿主，PoC 不能也不应绕过。
5. 原生 grep/glob 的真实失败路径经公开 helper 可组合复算（以 02-search 结果为准）；spill 精确身份判定=S-09（替换 Definition 会丢 spill 属预期代价）。

## 4. 诚实边界
- fixture/替身证据不写成真实宿主 PASS；每个 TEST DOUBLE 在其 notes.md 有界限声明。
- 未跑项一律 NOT RUN/ENV_BLOCK/BOUNDED-DEFER + 缺项说明；无 P0 GO；不新增 fork（A5-FORK-001 仍 CONDITIONAL/未产生）；不触碰 PR249/不改 PR 状态；G1 与各待裁项未动。

---

## 6. 续轮增补（用户裁定"无本轮时限"后，HEAD c31e8cc7）

| 车道 | 判定 | 提交 |
| --- | --- | --- |
| SRCH-04 spill | 行为级 PASS（生产 handler+LocalSpillStore+真 rg；S-09 对象身份弃权=Δ0+footer，他 scope Δ1，dispose 恢复） | 2b61441a |
| PTC-08 外层 | PASS（dsh-ptc-runtime-node EXISTS-PUBLIC；外层/内层均真实 OS 进程；guard 拒内层原体 0） | 2b61441a |
| P0-4 修正 | **landlock ENFORCE-WORKS**（根因=探针 READ=3 实为 EXECUTE\|WRITE_FILE，handled 从未含 READ_FILE(4)；逐字复现假 ABSENT） | da67ed8e |
| landlock 通路补做 | L1/L1FD/L2/L3/L4+TOCTOU 全 **OS_ENFORCED**（受限读、受控 spawn 含不可信命令注入负控、锁不可自解=交集棘轮、双层拒；适配要求=子进程入口自锁+非交付 fd 强制 O_CLOEXEC）；bwrap/netns/uid_map 维持各自实测 ENV_BLOCK | 56a2091d |
| web/jobs/MCP | 三族 INCONCLUSIVE(方向性)（回环 30/30；拒绝在 fetch 前零 socket/零 DNS；jobs 族形态钉死；MCP 注入路径与 P0-1 一致） | 43c8e8c8 |
| **P0-6 stage2b** | **PASS 10/10**（隔离真实宿主 :3185、mock-model Team world：成员原生 read 真实执行、同名 Adapter 遮蔽+对照成员不受影响、dispose→typed unknown 且 restrict 保留；失败全留痕：蓝图校验×2、块形 wire OOM 根因+storm fuse、oracle off-by-one） | c43fc41b |

**P0 状态更新：核心装配/路由/FS/spill/PTC/受限读/受控 spawn/web/MCP 均已有 fixture 级或真实宿主级证据；剩余缺口 = ①LSP per-member 隔离（结构性，上游接口项）②真实外网 web 行为（第三方外联申请项）③浏览器维度 ④宿主级补强：把 FS-01..04/SRCH 反例集在 stage2b world 内重跑（机制已双证，属 REG 系列而非 P0 缺口）。GO 仍未产生，任何族不得写成 GO。**
