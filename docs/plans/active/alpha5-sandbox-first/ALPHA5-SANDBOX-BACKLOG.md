# ALPHA.5 SANDBOX-FIRST — EFFECTIVE BACKLOG（有效待办唯一入口）

<!-- phase-baseline-ref: dev/engineering/current-authority.json -->
<!-- phase-identity: alpha5-sandbox-first -->

> **当前阶段：ALPHA.5 SANDBOX-FIRST（沙箱优先执行面）**。本文件是当期唯一有效待办入口；
> 设计需求正本见 `docs/plans/memo/alpha5-sandbox-first-20261101/`（ADR / ARCHITECTURE /
> IMPLEMENTATION-PLAN / TOOL-ADOPTION-MATRIX / TRANSITION-PLAN），当前态计划见同目录
> `current-implementation-plan.md`，逐工具验收见 `TOOL-ACCEPTANCE-MATRIX.md`。
> 机器权威 = `dev/engineering/current-authority.json` 指针解析到的不可变快照；本文件只引用、
> 不复制 baseline SHA。**历史绿 ≠ 新验收**：任何旧矩阵 PASS 都不能折算成本阶段验收。

> **2026-11-06 重组（owner 指令）**：本文件自本轮起按**能力面（capability face）**而非按阶段排列。
> 阶段（P1–P5）保留为每一条目的历史定位（每条仍在对应 face 下按阶段分表），**BL/BR 编号一律不变、
> 任何条目文字不删不改**；新增的是 §0.1 的能力面登记、三层验收（A/B/C）与 C1/C2 证据台账。
> 机器可读的等级/V@B 仍在 `TOOL-ACCEPTANCE-MATRIX.md`，本文件不复制等级。

## 0. 记法与裁决

- `BL-NN` = 本阶段待办；`BR-NN` = 本阶段必须回归/复验项（回归而非新功能）。
- 状态：`DONE` / `IN-PROGRESS` / `READY` / `BLOCKED` / `DEFERRED`。
- 每个条目必须绑定：证据目录（`dev/agent-workflow/evidence/a5sf-*`）、验收 Gate、独立 Reviewer。
- 禁止：第二套授权/第二套启动器/第二套策略编译器；禁止重新引入 `RequestedEffectSet`；
  禁止把原生工具塞回 `FamilyAssembly`；禁止把旧 `web-family` 历史当作 network ceiling 证据。

- **2026-11-03 装配复杂度裁决（用户与外部审查讨论后入档，优先于本文件内既有装配策略判断）**：
  1. **P0 优先于一切装配优化**：受管 Member 的原生 shadow 失效后，必须**先拒绝该 Member 的受管工具执行准入**，再异步销毁 Fiber；「预设定义重新可见但零新事实」**不等于**安全（`NoStaleShadow ≠ NoUnconfinedExecution`，`A5-FALLBACK-01`）。执行资格只有在完整重新装配并通过核验后才恢复。
  2. **工具归属的优先输入 = 既有 `TrustedToolRegistry`**（`packages/runtime/member-io-policy/src/trust-registry.ts`：`toolName`/`packageDigest`/`dependencyDigest`/`scope`/`definitionGeneration`）。只增加一层**模块→工具归属**薄元数据（模块来源+摘要+工具集合+条件性工具），**不新建第二套权限权威**：归属只回答「`read` 由哪个原生模块提供」，不回答「`read` 能读什么」。
  3. **`observeOnly` 探针仅为显式准入的受信兼容路径**，只对已验证可安全重复装载的模块启用；不推广为任意插件的通用接口，也不要求全体原生模块满足新的「幂等/无副作用」合同（幂等 ≠ 可安全重复执行）。
  4. **不建设通用 register-only loader**；重复分 Binding 挂载（`k+1`）是 S-1 的机制成本，登记只能消掉探针那一次，不得为消除它重写原生 ToolRuntime 或改 Core。
  5. **新增工程原则（架构审查项）**：在引入任何新的装配发现、运行时追踪或注册语义之前，**必须先检查既有 `TrustedToolRegistry` / `ToolRuntime` / Provider / OS backend 是否已掌握该事实**；只有信息确实缺失时才扩展机制。审查者不仅要找所选方案的漏洞，还要问「这个方案原本是否必要」。
  6. **`read_image` 记为 P3 条件性不支持项**（延迟注册、`attachments` 依赖）；不得靠改登记名或复用 Team 自研 `read_image` 声称原生兼容。
  7. **验收顺序**：P0 准入 → `tools/change` 不可用不得静默降级为两轮检查 → 归属登记复用 → 才花最后一次 P2-01 boot，六行验收表（A/B/C 三行 + `write` 不串通道 + **运行中失效后受管调用被拒且禁止字节不返回** + 终止后无失控 shadow/后台进程/未结清调用）。覆盖不全就记 NOT_REACHED，不为绿色报告放松断言。

- **2026-11-06 owner 裁决（v1 不要求完整网络隔离后端；原文约束入档，优先于本文件内既有网络判断）**：
  1. `network: deny` **保持 fail-closed**：没有 deny 后端时拒绝执行，**绝不**回退到联网运行，也不把 allow 当成近似的 deny。
  2. **FS/Search 等已验证面现在可以组成 scoped internal trial candidate**，不被 Bash/CLI 缺少 deny 后端阻塞。
  3. **Bash/CLI 只有在真实 OS/进程边界 deny 后端验证通过后**才可声称 "offline but functional"；**拒绝启动不算通过该 feature 的验收**。
  4. Web 的 `network: allow` 路径可继续被接受；可信 Web Provider 前的 `network: deny` 拒绝**不得**被推广成「任意子进程已被网络隔离」——**Web service-level deny refusal ≠ subprocess network isolation**。
  5. **归属更正**：**BL-39 是 Launcher `/etc`+`/proc` 文件读取例外收窄（read-exception hardening），不是网络隔离**；BL-39 保留原范围，真实 deny 后端独立记 **BL-42**。

## 0.1 能力面（capability face）与三层验收

### 0.1.1 六个能力面 + 一个 cross-face 桶

“面”= **一条共享的权限机制 + 一簇骑在它上面的原生产品工具**。同一面内的工具共用同一个执行边界
（同一个编译结果、同一个 guard 传输、同一个 OS profile），因此安全缺陷会**跨工具**传播——这就是
按面验收而不是按工具逐条验收的理由。归面规则：一个条目只归一个面；跨越两个面以上的**批量/阶段**
条目归 `cross-face`，并在条目文字里写明它覆盖哪些面（不改原文，只在 §0.1 台账里标注）。

| Face | 共享机制（一个执行边界） | 条目 | 矩阵行 |
|---|---|---|---|
| **FS Provider** | `ctx.isolate('fs')` + `installToolBindingRealm` 的受限 `fs` provider；一个编译器 `compileEffectiveIo`、一个 guard `observeGuard` | BL-03、BL-14、BL-15、BL-22、BL-27、BL-28、BL-38 | M-01…M-05 |
| **Subprocess** | 同一个 `fs` 链 + OS profile：`createConfinedSubprocessClass` 的准入（argv 归属、声明 root）+ `compileExecutionProfile` | BL-07、BL-16、BL-20、BL-39、BL-40、BL-41 | M-06、M-07、M-16 |
| **Shell-PTY** | 同一个 `subprocess` face 的 shell-class 声明 + 持久进程领域状态机（`team-sandbox/src/terminal.ts`，PTY 端口注入） | BL-08、BL-17、**BL-42** | M-08、M-09、M-10、M-13 |
| **Web** | 同一个编译结果的 `effective.network.access` + 同一个能力探针 `probeNetworkDenial`；`createConfinedWebClass` 在 provider 之前拒绝 | BL-18、BL-29 | M-14、M-15 |
| **External execution（LSP · MCP · PTC）** | 尚无面的实现：LSP/MCP 是**外部进程或远端执行**，PTC 是执行模式；三者都还没有产品接线 | BL-19（其余需求在 BL-23/BL-24 批内） | M-11、M-12、M-17、M-18 |
| **Non-data-plane tools** | 无数据面 I/O；Alpha.4 调用准入即可 | 无独立条目（需求在 BL-25 批内） | M-19、M-20、M-21 |
| **Cross-face** | 机制/治理/批量/发布：不属于任何单一共享边界 | 见下表 | — |

**两个面当前没有独立条目，这不是遗漏，是本阶段的真实投入状态**：External execution 只有 BL-19
（PTC）一条 READY，LSP 与 MCP 只以矩阵行存在（全部 `NOT_WIRED`/`UNSUPPORTED`）；Non-data-plane
只有 BL-25 一个批量条目。按面组织之后，这两个面的“零 C1”是可见的，而按阶段排列时它藏在 BL-23/
BL-24/BL-25 的括号里。

### 0.1.2 三层验收（A / B / C）

| 层 | 名称 | 回答的问题 | 证据形态 | 谁签 |
|---|---|---|---|---|
| **A** | capability-face × permission-axis **shared safety matrix** | 这个面的**共享边界**在每个权限轴（read/write/network）上是否 allow/deny/refuse-before-side-effect？ | 每面 × 每轴一张小矩阵；host-free 臂（必选）+ live 探针（有预算时） | Capability Implementer 产出，Acceptance-Reviewer 独立复跑 |
| **B** | **per-tool contract acceptance** | 骑在这个面上的**每一个原生工具**是否保持自己的契约（exit code、错误形状、展示、取消、生命周期）？ | 矩阵逐行 `TOOL-ACCEPTANCE-MATRIX.md` ⑧/⑨，最低验收列 | Acceptance-Reviewer |
| **C** | **frozen-candidate cross-face real Host acceptance** | **冻结候选**上，多个面**同时**在一个真实 Host 里是否仍然成立？ | 一次 boot、一个候选 SHA、独立 oracle、run record + grant + archive | Integration Owner 启动，Acceptance-Reviewer 判 |

**A 层不产生等级，也不替代 B 层**：A 层的失败是“这个面不能上产品”的阻塞，B 层的失败是“这个工具
这一条没到”。**C 层不能把 B 层的一行变成 PASS**，也不能用旧候选的 C 证据给新 master 的行背书——
这正是 2026-11-05 `#606` 之后 M-01/M-02/M-06/M-07 退回 `NEEDS_REVALIDATION` 的原因。

### 0.1.3 证据类别 C1 / C2（与 A/B/C 层正交）

`C1` = **host-free**（无 boot、无端口、无 DSH_HOME、无 pristine 写入）；`C2` = **live**（真实 Host
启动）。两词描述**证据类别**，不是层：C1 证据可以满足 A 层和 B 层的一部分，C2 证据是 B 层 live 半场
与 C 层的必要条件。**C1 永远不能替代 C2**，C2 也不能替代 C1（一个只能 live 才能发现的产品缺陷，
与一个本该 host-free 却花了 boot 才发现的 driver 缺陷，是两类成本）。

**条目台账（不复制等级；状态文字仍在各条自身）**：

| 条目 | Face | C1（host-free） | C2（live） | 需要 boot | 说明 |
|---|---|---|---|---|---|
| BL-01 | cross | 有 | — | 否 | v4 grammar/`memberIoCeiling` 单测 |
| BL-02 | cross | 有 | — | 否 | 编译器单测（`EffectiveIo ⊆ ceiling ∩ restriction`） |
| BL-03 | fs | 有 | 有（历史，已撤回） | 是（复核时） | 路径/硬链接/Provider 能力；live 半场由 M-01/M-02 行承载，`#606` 后按 Q7 撤回 |
| BL-04 | cross | 有 | — | 否 | Invocation Binder + Trust Registry |
| BL-05 | cross | 有 | — | 否 | Service Realm / Provider 绑定 |
| BL-06 | cross | 有 | — | 否 | Provider/Backend 排他替换 |
| BL-07 | subprocess | 有 | 有 | 是 | OS Runner 机制级 live（P1-07）；工具级 live 见 BL-16 |
| BL-08 | shell-pty | 有 | — | 是（换真 PTY 时） | 领域状态机已测；真实 PTY 端口仍是 double |
| BL-09 | cross | 有 | — | 否 | R1 接管（ControlService 公开 seam） |
| BL-10 | cross | 有 | — | 否 | R2 工程基线 |
| BL-11 | cross | 有 | — | 否 | R3 证据链（四链同调用） |
| BL-12 | cross | 有 | — | 否 | R4 诊断工具 |
| BL-13 | cross | 有 | — | 否 | R5 黄金向量（回归输入，非验收） |
| BL-14 | fs | 有 | 有（历史，已撤回） | 是 | read live 8/8 在 `44babbfcf`；`#606` 后 `V@B=no` |
| BL-15 | fs | 有 | 有（历史，已撤回） | 是 | write live 两半；同上 |
| BL-16 | subprocess | 有 | 有（历史，已撤回） | 是 | grep/glob 六行 PASS + 候选 11/11；`#606` 后撤回 |
| BL-17 | shell-pty | 有 | — | **是（allocation #2，暂缓）** | shell-class 准入/写轴/网络探针/旧代 PTY 拒用 host-free 已证 |
| BL-18 | web | 有 | — | **是（allocation #3，暂缓）** | deny 车道 provider 之前拒绝；live 需 web face 转发（`#608` 未完成） |
| BL-19 | external | — | — | 否（先 C1） | run_code/PTC：无 routed-native 接入面（矩阵 M-11） |
| BL-20 | subprocess | — | — | 否（先 C1） | 通用 launcher 端到端；机制已在 P1-07 实测 |
| BL-21 | cross | 部分（源半） | — | 是（runtime 半） | 来源清单：runtime 枚举需 boot |
| BL-22 | fs | — | — | 否（批量） | FS 工具组批量；覆盖由 BL-14/15/22 的成员条目承担 |
| BL-23 | cross | — | — | 视面而定 | 批量：覆盖 Subprocess/Shell-PTY/External 三个面 |
| BL-24 | cross | — | — | 视面而定 | 批量：覆盖 Web/External 两个面 |
| BL-25 | cross | — | — | 否（批量） | Non-data-plane 批量 |
| BL-26 | cross | — | — | 否 | 旧 Family 退役（唯一 Integrator 变更） |
| BL-27 | fs | — | — | 是（G4） | FS 授权矩阵 |
| BL-28 | fs | — | — | 是（G4） | 路径/硬链接矩阵 |
| BL-29 | web | — | — | 是（G4） | network deny/allow（Web 前置 + OS 网络） |
| BL-30 | cross | — | — | 是（G4） | 一次性审批与撤权 |
| BL-31 | cross | — | — | 是（G4） | 绑定/运行时更新 |
| BL-32 | cross | — | — | 是（G4） | Host 兼容 |
| BL-33 | cross | 有（一致性半） | — | 是（消费半） | 双平面同调用一致性 |
| BL-34 | cross | — | — | 是（G4） | 性能与资源 |
| BL-35 | cross | — | — | 是（G5） | 对抗 I/O |
| BL-36 | cross | — | — | 是（G5） | 生命周期/故障恢复 |
| BL-37 | cross | — | — | 是（G5） | 发布双验收 |
| BL-38 | fs | — | — | 否（owner-owned，本阶段不实施） | 只写不读的 team 语义 |
| BL-39 | subprocess | — | — | 是 | **文件读取例外收窄**（`/etc`+`/proc` 的 READ_FILE/READ_DIR），**不是**网络隔离——2026-11-06 owner 归属更正 |
| BL-40 | subprocess | — | — | 否 | shell/PTY 依赖 BL-16 的准入规则（DONE：依赖已记录） |
| BL-41 | subprocess | — | — | 否 | standing rule：argv 校验只是纵深防御 |
| BL-42 | shell-pty | — | — | **是**（backend 落地后） | 真实 OS/进程边界 network-deny 后端；**cross-face 阻塞**：Bash/CLI、第三方 CLI、external execution 都等它；行在 Shell-PTY（唯一具名阻塞消费者是 BL-17）；行文本取自 #611（未合并），与其余行同等 verbatim |
| BR-01/02/03 | cross | 有（持续） | 有（持续） | 视 PR | 回归义务，不构成验收 |

**读法**：`C1` 列为 `—` 的条目**不得**以“已经写了代码”充当证据；`C2` 列为 `—` 而等级列出现
`DONE`/`ENFORCE` 的行是矩阵缺陷，不是本表缺陷。**需要 boot 的条目共 17 条**，其中只有 BL-17/18 有
具名 allocation（#2/#3），其余全部在 G3/G4/G5 之后——这是“boot 是稀缺资源”的可核验表达。

## 1. Face: FS Provider

**共享边界**：Member 隔离 `fs` scope 上的受限 provider；一个编译器（`compileEffectiveIo`）、
一个定位器判定（`evaluateLocatorAccess`）、一条事实传输（`observeGuard`）。

- **A（面 × 轴安全性）**：read / write 两轴 × {in-lane allow、restriction deny、ceiling deny、
  双 Member 不串权}。host-free 臂在 `a5sf-member-policy.test.ts` 与
  `a5sf-product-assembly.test.mjs` PA8；live 探针 = M-01/M-02 行。
- **B（逐工具契约）**：M-01 read、M-02 write、M-03 edit、M-04 read_image、M-05（`str_replace_editor`，
  矩阵附录）各自的 exit/错误形状/展示契约。
- **C（候选跨面）**：candidate-1 allocation #4（11/11，含 FS 五案）是**目前唯一**一次 FS 面在冻结
  候选上的跨面实测；`#606` 之后该证据的 current claim 已撤回（被测树 ≠ HEAD），但**证据本身不删**。

**本面的已知不对称**：write 轴**不**蕴含 read 轴（2026-11-04 裁决）；`write` 的 read-before-write
拒绝来自**原生工具**而非 Team lane。这是 B 层契约，不是 A 层洞。

#### P1 — 基础体系（G1）

| ID | 工作包 | 状态 | 证据 / PR |
|---|---|---|---|
| BL-03 | P1-03 授权路径/硬链接/Provider 能力（13 方法闭集、越界/悬空链接拒绝） | DONE | `evidence/a5sf-p1-03/` |

#### P2 — 每机制代表工具（G2）

| ID | 工作包 | 状态 | 入口 / 证据 |
|---|---|---|---|
| BL-14 | P2-01 原生 `read`（>10MiB 中间窗口、流式、禁读真实拒绝、双 Member 不串权） | IN-PROGRESS（**live G2 已取得**；大文件窗口/流式仍 PARTIAL；矩阵行按 Q7 记 `NEEDS_REVALIDATION`；2026-11-05 重切因实测树 `44babbfcf` 与 baseline `1fd0d9fca…` 的 `packages/**` 不相等而**未能复位**，需在新 baseline 上重跑 live，证据不删） | PR #581（`a5sf-preflight`）；`evidence/a5sf-preflight/README.md` §13：真实 Host 上 8/8 PASS——row1 内读被 confined provider 服务、row2 restriction 拒绝、row3 ceiling 拒绝，读路径咨询全落 binding realm；禁读真实拒绝与 in-lane 拒绝均为实测。**未覆盖**：>10MiB 中间窗口、流式、双 Member 同时并发（同轮两 Member 未做） |
| BL-15 | P2-02 原生 `write`（原子替换/版本校验；禁写字节不变；写不自动获读） | IN-PROGRESS（原记 PARTIAL；写轴 live 于树 `44babbfcf` 已证，原子/版本未验；矩阵 M-02 因该树与 baseline `1fd0d9fca…` 的 `packages/**` 不等价记 `NEEDS_REVALIDATION` / `V@B=no`，见矩阵 §1.1） | PR #581；row4a 在 lane 内写成功且 write fact 全在 ceiling realm；row4b 证明 guard **允许**写一个 binding lane 读不到的文件（binding restriction 只约束 read 轴），拒绝写出的是**原生 write 工具自身的 read-before-write 契约**，不是 Team lane。**已裁决（2026-11-04）**：`write` **不**蕴含 `read`——原生 `write` 的 read-before-write 契约保留，Team 代数不加 write⇒read 耦合（裁决原文 = `evidence/a5sf-preflight/README.md` §12.8.3 RULING）；只写不读/读被拒权限下的 team 行为 = BL-38。**未验**：原子替换、版本校验、禁写字节不变（本轮只验拒绝路径不改盘） |

#### P3 — 原生工具逐项接入（G3）

| ID | 工作包 | 状态 | 备注 |
|---|---|---|---|
| BL-22 | P3-01 FS 工具组（`read`/`write`/`edit`/`read_image`/`str_replace_editor`） | IN-PROGRESS（原记 BLOCKED（依赖 BL-21）；矩阵 M-01/M-02/M-03/M-04 显示 read/write/edit/read_image 已有证据，str_replace_editor 仍 NOT_WIRED） | 不新增 `fs-family` executor |

#### P4 — 全维度验收（G4）

| ID | 工作包 | 状态 |
|---|---|---|
| BL-27 | P4-01 FS 授权矩阵（读写分离/目录/新建/覆盖/rename/chmod/跨 Member） | BLOCKED（依赖 G3） |
| BL-28 | P4-02 路径与硬链接矩阵（授权硬链接、软链出界、前缀/rename/相对路径） | BLOCKED（依赖 G3） |

#### P5 — 对抗与发布（G5）

| ID | 工作包 | 状态 |
|---|---|---|
| BL-38 | P5-04 **只写不读 / 读被拒权限下的 Team 行为**（owner-owned 后续，**不在本阶段实施**）：一个 Member 被编译成有写 lane、无读 lane（或读被拒）时的 team 语义——写入是否可被指令盲投、是否需要在策略层耦合读写两轴、以及在 native `write` 之外（`edit`、shell、其他写面）的对应行为 | DEFERRED（owner-owned） |

## 2. Face: Subprocess

**共享边界**：同一个 `fs` 链 + OS profile。准入层（`programAttributionRefusal`、
`readIntentsOf`、`shellClassAdmissionRefusal`）在**任何进程存在之前**决策；执行层是
`compileExecutionProfile` 的 Landlock profile。

- **A**：read/write lane 的声明归属、未知程序 fail-closed、`network: deny` 只认后端 `enforced`、
  预置 hardlink / in-lane symlink / `runtime_base` allowance 三类**已披露**的越界面。
- **B**：M-06 `grep`、M-07 `glob`、M-16 third-party CLI（`PROBE-GATED`）。
- **C**：candidate-1 的 search 五案（allocation #4）是唯一一次跨面 search 实测；`#606` 后撤回。

**`rg` allow-list 的定位（BL-41）**：它是**一个固定原生工具的纵深防御**，不是任意 shell/Python/
LSP/MCP 的通用安全模型。任何把 `CONFINED_SUBPROCESS_STATIC_PROGRAMS` 当成“CLI 类工具都能这样接”
的读法都是错的；CLI 类工具的 confinement 必须来自其实际消费边界上的 OS confinement。

#### P1 — 基础体系（G1）

| ID | 工作包 | 状态 | 证据 / PR |
|---|---|---|---|
| BL-07 | P1-07 OS Runner / Subprocess 公共面（真实 Landlock 证据，嵌套 deny 拒绝） | DONE | `evidence/a5sf-p1-07/` |

#### P2 — 每机制代表工具（G2）

| ID | 工作包 | 状态 | 入口 / 证据 |
|---|---|---|---|
| BL-16 | P2-03 原生 `grep`（OS `rg` 真实拒绝、exit 0/1、取消、结果裁剪） | IN-PROGRESS（**host-free 半场已取得；2026-11-05 live 六行全 PASS，重切时曾复位为 `ENFORCE-PARTIAL` / `V@B=yes`（snapshot `as20261105r1`，tested `c658d974d`）；但同日 `#598`/`#599`/`#600` 再移动产品面（baseline..HEAD 36 个 Q7 路径），矩阵 M-06/M-07 现为 `ENFORCE-PARTIAL` / `V@B=no`，需在新树上重跑 live 才能再断言**）：confined `subprocess` Provider 挂到 Member realm 的同一隔离链（`team-services/src/subprocess.ts` + `install.ts`/`mount.ts`/`a5sf-realm-row.mjs` 可选 face）；真 pinned fs-search 模块 + 真 rg + 真 Landlock 下，in-lane grep/glob 执行并各记一条 allow 事实，out-of-lane 在**任何进程存在前**以 `IO_READ_DENIED` 拒绝（`spawns=0->0`）+ 一条 deny 事实，exit 0/1/2 保真、取消终止子进程。**review round 2（修正）**：`sh -c 'cat /etc/passwd'` 不再到达内核——shell/interpreter/未知 argv 在准入层以 typed `TeamIoDenial` + 一条 deny fact 拒绝（`providerCalls=0`）；声明式 allow-list 当前仅 `rg`，且其 argv 契约是 **shipped shapes 的 allow-list**（review round 3）：`--no-config` 必须紧跟程序（在首个 `--` 之前），只接受 `--json`/`--regexp=…`/`--glob=…`/`--files`/`--sort=modified`/`--no-ignore`/`--hidden` 与 `--` 根；`-f`/`--file`/`--ignore-file`（B1）、位置化 `--no-config` + `RIPGREP_CONFIG_PATH --pre`（B2）、`--pre`/`--search-zip`/`-z`、`--follow` 及其余 flag 一律在准入层拒绝。**实测内核 allowance** = `lane ∪ /bin,/usr,/lib,/lib64,programDir ∪ /etc,/proc`：直接 `/etc`/`/usr`/`/proc`、raw provider 下 `--follow` 的 in-lane symlink、预置 in-lane hardlink 均被内核放行（`PIN-*` 臂）；准入层是 allowance 内“已声明 root”的唯一一层。**review round 3（B3）**：程序身份不再只按 basename——`argv[0]` 的 realpath 经同一个 `evaluateLocatorAccess` 落在 effective write lane 内即拒绝（可写脚本冒充 `rg` 不再执行）；shipped `rg` 在外侧仍放行。**live 半场尝试 1–2 已花、0/6 行未测得**（2026-11-04，见下）；残余：预置 hardlink 以 ALLOW fact 服务、nested symlink 只在 raw layer 2（产品 seam 拒 `--follow`）、程序身份不 hash 字节且不覆盖本 face effective write lane 之外的 Member 写集合、不检查 `spec.env`（`LD_PRELOAD` 类；可达前提 = 直接控制 argv/env 的调用方）、`toolBindingIdentity=null` 且 install spec 无字段、binding realm 无 `subprocess` face → 组合期 typed 拒绝 `SUBPROCESS_UNCONFINED_REALM`（BL-17，2026-11-04；不再列为潜在洞）、in-lane 无 mkdir/symlink/execve（hardlink 可建）、模型文本非 typed、`mode:all` 车道拒绝。**live 半场尝试 1–2（2026-11-04T15:36–16:00Z，P2-04 已花 2/3 start，0/6 行未测得）**：尝试 1（15:36–15:39Z，port 3183）失败于 **driver 缺陷**——`runBoot` 把 4 个 row 交给 `emitPatchLayer` 却未 `handOverRows` 给 World，Harness 组合的是 bare World，`/__p6t6/health` 不存在；`--plan` 当时只查**已发射文本**。已修：`handOverRows` 单一交接点、`--plan` 用同一函数对 probe 运行并写 `plan-rows.json`（emitted vs world 按**身份与顺序**逐项相等 + 健康探针 row 存在）、go-no-go **自己**评估该交接（并独立复读源码中 `handOverRows` 在 `harness.boot(` 之前）、变异负控把该行改成 `void rows` 必须让 dry-run 变红。尝试 2（15:56–16:00Z，port 3182，协调者裁决授权的重试，grant `…-b2`）**证明组合成立**：`presentRowIds=[u5-canary,u6-fs-probe-host,a5sf-search-realm,dsh-agent-team,p6t6-team-tools,preset-a5sf-search-base]`、`missingRowIds=[]`、health 200 用时 3s、锚点表面 24 工具含 `grep`/`glob`；随后 **两个真实产品发现**：**F1** 负控 **REFUTED**——不受限的 base `subprocess` 在该 World 内**无法启动打包 rg**（`grep could not start its search command (ripgrep launch failed)`，`base-spawn=2 / confined-spawn=0`）；host-free 已排除模块解析（`@vscode/ripgrep` 从 host-tree 与 pnpm 两条路径都可解析）与 linux-scope 启动（`probeLinuxScope()` 为 false：`systemd-run --user --scope` 报 `Failed to connect to user scope bus`，故走 plain `spawnSubprocess`），**根因未隔离**（候选 `validateSubprocessSpec`/`spawnSubprocess`；`SearchError.cause` 被模块吞掉、World home 已随 teardown 删除）。由于 confined class 复用同一 base spawn，**F1 独立地阻塞 BL-16 live 半场**，并使负控在修好前不可判。**F2** `team.create` 被产品权限覆盖门拒绝：`TEAM_REMOTE_TEAM_CREATE_ROOT_START_FAILED … permission coverage gate failed for instance 'inst-leader': 2 unmanaged tool(s) … glob/grep (known-sensitive-unmanaged)`——native attach 只在 **Member realm** 上把 grep/glob 变成 managed，leader 是 root session 无 realm，故被正确拒绝；driver 已改为 leader 显式 deny grep/glob（`LEADER_MANAGED_TOOL_NAMES`），**未验证**（需新 start）。账本 2 intent + 2 boot（每 run `1 = 1 − 0`）；端口已释放、home 已删、无孤儿。**尝试 3（17:04:45–17:05:05Z，port 3183，协调者授权最后一次 start，grant `…-b3`；基线含 `165059eea`）**：组合再次成立（6 rows、health 0.3s）；**F1 撤销**——`165059eea` 已把 F1 归因为本 lane 自身证据行 `original.apply(this, spec)` → 服务被当作 `spawn(undefined)` 调用，`validateSubprocessSpec` 同步抛 TypeError，被模块统一成「ripgrep launch failed」；修复为 `original.call(this, spec)` 并在重抛前记 `base-spawn-failed`（Node cause），`f1-cause.mjs` 5/5（`F1-ROW-SPAWN` 修复前 RED/修复后 GREEN）；**F2 亦 host-free 验证**（`f2-deny-unit.mjs` 4/4，对真实 `evaluatePermissionCoverage` 与 World 记录的 24 工具面，突变重纳 grep/glob 逐字复现拒绝前缀）。尝试 3 在真实 World 内观测到证据行经 base spawn **成功启动打包 `rg`**（counter：`rg --json --regexp=A5SF_SEARCH_OUTSIDE` + 0 条 `base-spawn-failed`，git spawn 亦恢复），即 F1 在**受测组合内**关闭；随后 **driver 进程组被自身启动方式杀死**（`nohup … &` 在前台调用内，调用返回时 harness 回收进程组，约 17:05:05Z，距首轮 230ms），故负控结果未读回、leader grep probe 未执行、0 行判定；boot 行真实存在，故不申报 abort，**pool 3/3 用尽**。已留痕 `attempt-3-killed.json` + `attempt-3-counter.jsonl`，home 收割后删除、端口释放、无孤儿。**最终账目**：3 intent + 3 boot + 0 abort；0/6 行判定；M-06/M-07 等级与 `V@B` 一律未动。第四条 start 需**新 ruling 条目**（driver 与 go-no-go 均拒绝；本 lane 不再申请）。**README §12「next lane must know」沉淀四条可复用规则**：门必须**执行**交接而非渲染；plan 产物按**身份与顺序**比较组合行与命名行；boot 必须**先读 composed profile 再等 health**；**给服务加仪器的 driver 必须自测仪器（含运行方式）**——F1 与尝试 3 都是自伤。**M-06/M-07 等级与 `V@B` 一律未动**（0 行测得即不改矩阵）；未测得：6 行、负控（已判 REFUTED 但因果在 F1）、binding-realm fact、预置表达 binding 限缩（`UNSUPPORTED`）、取消时序。**可复用教训**：host-free 门必须**执行**交接而非只渲染文本；boot 应在等 health 之前读 composed profile；stage 归因把「一次废掉」变成「哪个交接坏了」。**live 半场尝试 4–6（2026-11-05，owner 追加 3 start → pool 6；0/6 行判定，Member 半场首次真正跑起来）**：`go-no-go` 先对当期 master 复验 GO（handoff 身份、`planHead === HEAD`、ledger 不变式、pool/ruling 全绿），每次 start 前都有**具名变更**。**尝试 4**（18:51:35–18:55:58Z，grant `…-b4`）：leader grep probe **置于 control 之前**并首次产出 `probe-leader-grep.json`（`success=true`、`baseSpawn=1`、`base-spawn-failed=0`、`factsBeforeRealm=0`、工具结果 `Found 2 matches … A5SF_SEARCH_NEEDLE_…`）——上一轮欠的交接物补齐，F1 在受测组合内第二次关闭；`team.create_status=200 ok=true`（F2 deny 生效：`builtinToolDeny=[glob,grep,u5_canary,u6fs_probe]`）；**member-install** 以 `MEMBER_INSTALL_NO_WORKER` 中止，但当时未捕获 delegate 答复（缺口）。**尝试 5**（18:58:10–19:05:32Z，`…-b5`）：**负控 PROVEN**（`UNCONFINED_CONTROL_LEAKS`，两个 out-of-lane token 均泄露，`baseSpawns=11`、`confinedSpawns=0`、`guardFactsBeforeRealm=0`）——attempt 2 的 REFUTED 确系 F1 仪器；新增 `delegate-artifact.json` 捕获 delegate 答复，得到**具名产品答复**：`team_delegate → status=rejected, code=TEAM_RUNTIME_DURABLE_WRITE_FAILED, TeamServiceInstallError: SERVICE_MOUNT_FAILED: native tool module re-mount failed: invalid config: $.sampleOverCapGlobResults missing required value`——**根因在本 lane**：`tool-fs-search` 的 `Config` 要求 `sampleOverCapGlobResults`（无默认），而 team row 以裸字符串挂载（空 config），realm install 在任何工具被 shadow 前即被拒（故 `install-fs/install-subprocess` 均为 0）；已修为 `{ url, config: { sampleOverCapGlobResults: false } }`（false = 确定性的 mtime head）。**尝试 6**（19:07:58–19:17:21Z，`…-b6`）：instrument 再修一处——本 harness 的 follow-up 请求**不回显 assistant `tool_use`**，计数器永为 0，每轮重发同一调用并耗尽 120 s settle（两次 `rg` 相隔 121 s），改为按 `tool_result.tool_use_id` 排序（`resultIdsOf`）；结果 **Member realm 真的装起来了**：`member visible=true instanceId=inst-14xcgx11i3lu childSessionId=<set>`、delegate `status=executed effect.kind=member-activated`、`member turn dispatched=true`、`confined-spawn=3 / confined-exit=3`、**7 条 `a5sf-guard-consult/1` 事实全部落在 400 ms 内**（`realm:"member"`）：①allow in-lane ②deny `IO_READ_DENIED` ceiling-outside ③deny `IO_READ_DENIED` outside-restriction ④allow invalid 目录 ⑤allow glob 目录 ⑥deny `IO_READ_DENIED` ceiling-outside-glob ⑦**deny `IO_READ_DENIED` `lane/blocking.fifo`**。第 ⑦ 条即中止原因：FIFO 在 ceiling 内但在 **tool restriction（`lane/inside`）之外**，被准入层正确拒绝 → 无 confined spawn → 取消窗口不开（`CANCELLATION_WINDOW_NO_CONFINED_SPAWN`，等 240 s）。这是**fixture 缺陷**（窗口需要一个「被准入然后阻塞」的检索）：已把 FIFO 移到 `lane/inside/blocking.fifo`，dry-run 新增「FIFO 必须在 effective read lane 内」检查（**53 checks**）。**账目**：6 intent + 6 boot + 0 abort（每 run `1 = 1 − 0`），pool **6/6 用尽、remaining=0**，`go-no-go` 现打印 `REFUSE budget: boots=6 spent=6 remaining=0` 与 `REFUSE budget: … a further start needs a NEW ruling entry`；端口 3184 释放、`tests/homes/*` 空、无孤儿。**本轮三类仪器缺陷均已修并加检查**：probe 污染 control（按 operand 计数）、tool_use 计数失效（改 tool_result id）、模块 config 违约（补 `sampleOverCapGlobResults`）；**一行未决变更**：FIFO 归位后下一次 start 应能判定第 1/2/3/5 行（Member 链在 400 ms 内跑完 7 调用）。**M-06/M-07 等级与 `V@B` 一律未动**（0 行判定即不改矩阵）；未测得：6 行判定、取消时序（row 4）、teardown 断言（row 6）、binding-realm fact、预置表达 binding 限缩（`UNSUPPORTED`）。证据 `evidence/a5sf-search-live/README.md`。**2026-11-05 row-6 复查（判 a，产品契约缺口）**：`team_archive_member` 提交 ARCHIVED 后，`ensureLiveAgent` 冷恢复与 boot resume 循环均不读 durable `MemberInstance.lifecycle`，archived Member 的 Session 被重新拉起并执行 `glob`（200 `ok:true`，post-stop allow fact ×2，confined spawn +2）；host-free 复判、静态链、4 腿 RED 臂（现 3 failed/1 passed；35 行门草图下 4/4）与契约/裁决框架见 `evidence/a5sf-search-live/row6-diagnosis.md`。本轮 live 其余：row 2/3/5/4 过；row 1 因 rg 读 `.git` 被 Landlock 拒（环境/driver 侧，另处理）。row 6 判定保持 FAIL，待产品门修复后复测。**2026-11-05 修复（ARCHIVED-GATE，产品契约修复）**：`memberResumeRefusal`（`agent-bindings.mjs`）在两个复活接缝读取 durable `MemberInstance.lifecycle` 并拒绝 ARCHIVED/DISPOSED（typed `PERMISSION_LIFECYCLE_EXECUTION_ARCHIVED` / `_TERMINAL`）：`ensureLiveAgentOnce` 在解析 owning root 后（接缝 1）、boot resume 循环在 `seen.add(child)` 后（接缝 2，跳过物化并记 observation）；CREATED/RUNNING/SETTLED 与 leader/root 路径不变，archive 与 restore→SETTLED→follow-up→cold-resume 流程保持可用。RED 臂 3 failed/1 passed → GREEN 4/4；双接缝变异控制各自单独移除均按预期 RED（M1: ARCHIVED+DISPOSED；M2: RESTART）。archived row-6 样本复判：归档字节仍 REFUTED（历史），同一刺激经修复后接缝产生 422 + 无 resume/无 tool 执行，`judgeRow6` 翻为 PROVEN（5 个 clause 因拒绝而翻转）；行名从 `...teardown...` 改为 `...archive-boundary...`（stopInstant 是 archive 边界，非 world.teardown()），clause 未改。成本：稳态 tool call 0 次 durable 读；每次冷恢复 gate 仅 +1 次内存快照 list（总计 4 次）；boot gate 0 次额外读。受保护 glue 源 sha256 由 `df9b46af…` 变为 `6d256096d98c8afdd1935e68c57f7571c647ae63362a652d7198e5f91ddb94e8`（最小 diff：共享 helper + 两个 gate 调用点 + 注释），理由是冻结 Architecture §41.6/§30.2/§29.4 禁止当前行为。证据 `evidence/a5sf-archived-gate/README.md`。 |；**rg 祖先发现（2026-11-05，`#593`）**：confined `rg` 在 git worktree 内会向上读取搜索根之外的 `.git`，lane 正确拒绝后 `rg` 视为致命错误并以 exit 2 结束（实测 stderr `…/.git: Permission denied (os error 13)`）。修在**调用**而非沙箱：仅当声明目录根的发现走行会越出 effective read lane 时，在 `--no-config` 之后、首个 `--` 之前加入 `--no-ignore-parent --no-ignore-vcs`（`laneSafeSearchArgv`）；披露搭同一条 allow fact 的 additive `annotations`，仍是一 fact 一进程。**该 lane 形态下 `.gitignore`/`.git/info/exclude` 对这次 grep 关闭**（被忽略文件会被搜到），`.git` 永不被读取、允许面未加宽。证据 `dev/agent-workflow/evidence/a5sf-rg-ancestors/` |
| BL-20 | P2-07 全新第三方 CLI（通用 launcher，零专用 ToolDefinition 执行体） | READY | `a5sf-new-cli.mjs`（planned, not created） |
| BL-39 | **Launcher 文件读取例外收窄（read-exception hardening，owner-owned；P1-07 代码，不在 BL-16 lane 范围）——收窄共享 launcher 的 `runtime_base`。归属更正（2026-11-06 owner）：本项是 `/etc`+`/proc` 的 READ_FILE/READ_DIR 例外收窄，**不是** network isolation；网络 deny 后端独立记 BL-42，二者互不替代**：BL-16 实测 `runtime_base` 给 `/etc` 与 `/proc` READ_FILE/READ_DIR，使直接 `/etc/passwd`、`/proc/self/status` 读取成功；BL-16 只披露、不修改。**审查者给定的范围（必须逐项落表，不得只写“最小 POSIX 集”）**：(1) 枚举该 launcher 路径上真正**不可避免**的 runtime 依赖（loader/exec、locale/tz、NSS/证书、`/proc/self/*` 等，逐项给出为什么不可避免）；(2) 对每一项判断能否收窄到**具体文件或目录**（而不是整个 `/etc`、整个 `/proc`），并给出 Landlock 规则形状与实测；(3) 区分哪些例外属于**可信 host**（launcher 自身、exec/loader 基础）、哪些不应授予**不可信子进程**，逐项给出裁决理由与负控。**在本次审计落地前，OS profile 不是全局读白名单**：矩阵与证据不得把 `lane ∪ … ∪ /etc,/proc` 表述为“全局只读白名单”或“内核把子进程限制在 lane 内”。**范围边界（2026-11-06）**：BL-39 的验收对象只有「哪些 `/etc`/`/proc` 例外可以收窄到具体文件/目录」；它不提供、也不证明任何 egress/DNS 拒绝能力——网络 deny 后端 = BL-42。 | READY（owner-owned；backend hardening） | BL-16 `evidence/a5sf-bl16-grep/README.md` §6.3(1)；`landlock-prelauncher.py` `build_ruleset` `runtime_base` 分支；矩阵 M-06/M-07 残余 + 全局白名单免责声明 |
| BL-40 | **BL-17（shell/PTY）依赖 BL-16 review round 2 的 shell-class 准入规则**：`sh`/PTY 的 reads 不能由 argv 静态归属，故 BL-16 的通用 `subprocess` face 按设计拒绝 shell 类；BL-17 必须实现独立的、带 fact 的归属路径（如声明的命令行/命令列表），**不得**通过放宽 BL-16 的 allow-list 或依赖内核 `/etc`+`/proc` allowance 来“接通”。 | DONE（依赖已由 BL-16 记录；BL-17 实施前置） | BL-16 `evidence/a5sf-bl16-grep/README.md` §3/§6.4；`subprocess.ts` `programAttributionRefusal` |
| BL-41 | **standing design rule（2026-11-04，BL-16 外部架构审查；BL-17 前置）**：静态 argv 校验只是**固定原生工具适配器的纵深防御**（当前仅 `rg`），**不得**成为 CLI 类工具的架构。Bash / Python / LSP / MCP 的 confinement 必须来自其**实际消费边界上的 OS confinement**（Landlock / 进程 / 网络 profile），argv 检查只能作为额外一层，**绝不能是唯一的权限依据**。**BL-17 必须遵守本规则，不得克隆 `rg` 的 allow-list。** | RULE（standing） | BL-16 `evidence/a5sf-bl16-grep/README.md` §3/§6.4；BL-40；外部 Alpha.5 架构审查（2026-11-04） |

## 3. Face: Shell-PTY

**共享边界**：`subprocess` face 的 shell-class 声明（argv 形状 `<program> -c <body>` + 声明的
read/write/chmod root）+ `team-sandbox/src/terminal.ts` 的持久进程领域状态机（PTY 端口**注入**，
不自建进程）。

- **A**：shell-class 的声明准入、写轴（`spawn:write`）、`chmod` 缺口披露、`network: deny` 探针、
  旧代 PTY 拒用（组合期 `TERMINALS_LEGACY_PTY_REFUSED`）。
- **B**：M-08 持久 `bash`、M-09 瞬态 `bash`、M-10 `pwsh`、M-13 `terminal_*`。
- **C**：**无**。本面从未在真实 Host 上跑过一次（BL-17 live 半场 = allocation #2，暂缓）。

**这是全阶段风险最高的面**：它是唯一“机制已实现、产品面按设计故意不接、且 live 零覆盖”的面；
一旦接入，它同时交出环境出网与未中介 `chmod` 两个已披露维度。

**本面的 `network: deny` 不由本面的代码完成**：它等 **BL-42**（真实 OS/进程边界 deny 后端）。
2026-11-06 owner 裁决的四条硬边界直接约束本面：① 无 deny 后端时**保持 fail-closed**（拒绝执行，
绝不以 allow 近似，绝不回退联网）；② **拒绝启动不算通过该 feature 的验收**——"offline but
functional" 需要实测拒绝 egress/DNS/connect（0 connect）+ allow 路径仍工作 + 负控；③ Web
service-level 的 deny 拒绝**不得**被推广成「任意子进程已被网络隔离」；④ 本面 live 半场在 BL-42
落地前只能验「拒绝路径」，不能验「离线可用」。

#### P1 — 基础体系（G1）

| ID | 工作包 | 状态 | 证据 / PR |
|---|---|---|---|
| BL-08 | P1-08 PTY / 持久进程生命周期（撤销先于首个 await、generation 键） | DONE | `evidence/a5sf-p1-08/` |

#### P2 — 每机制代表工具（G2）

| ID | 工作包 | 状态 | 入口 / 证据 |
|---|---|---|---|
| BL-17 | P2-04 原生持久 `bash`（同 PTY 多命令、只写不读、`chmod`/新建文件负控、禁网、旧代 PTY 拒用） | IN-PROGRESS（**BACKEND-PARTIAL；`V@B = no`；live 半场未测**）。2026-11-05 后端半场（host-free，分支 `task/a5sf-bash-20261105`）：(1) **shell-class 显式准入**——`shellClass` 只由**组合**在 install spec 上声明（Member/工具/蓝图/行配置均无字段），argv 形状闭合为 `<program> -c <body>`，未声明/未准入/未声明调用/形状不符分别以 typed `SUBPROCESS_SHELL_{NOT_DECLARED,PROGRAM_NOT_ADMITTED,INVOCATION_UNDECLARED,ARGV_UNSUPPORTED}` 拒绝（0 spawn、一条 deny fact），`SUBPROCESS_UNCONFINED_REALM` 仍是第一道组合期门，`rg` allow-list 未放宽（`RG-UNCHANGED` 前后都绿）；(2) **只写不读**——写轴走同一个 `evaluateLocatorAccess`/`TeamIoDenial`/`observeGuard`，只换 method=`spawn:write`（同一 fact schema），声明读只写 root 必 `IO_READ_DENIED` 且编译出的内核 profile 无读位，同一 root 可写；写不蕴含读；(3) **`chmod`/新建文件负控**——越界声明写/`chmod` 均 `IO_WRITE_DENIED`、0 spawn、文件不出现、mode+bytes 不变；**披露**：Landlock 无 chmod 权限位，未声明的同 UID `chmod` 不在本准入的射程内；(4) **禁网**——`network: deny` 在 spawn 前询问后端自身 capability probe，只有 `network-destination: enforced` 才放行，否则 typed `NETWORK_UNCONFINED_REALM`（0 spawn）。本机实测 Landlock ABI v7、该维 `unsupported`，故**本环境不存在“既运行 bash 又拒绝网络”的合法声明**；(5) **旧代 PTY 拒用**——注入 `terminals` 的原生模块（含 deferred `ctx.inject(['terminals'])`）在组合期以 typed `TERMINALS_LEGACY_PTY_REFUSED` 拒绝（继承的 legacy PTY 0 次被咨询、0 fiber、无 attach 记录），**产品面可达**（`mountNativeToolModules`）。**产品接线故意不接**：无任何产品组合声明 shell class，故 `bash` 在每个产品 realm 上以 `SUBPROCESS_SHELL_NOT_DECLARED` 拒绝；声明一个 shell class 会同时交出环境出网与未中介 `chmod`，与行内 禁网/chmod 条款相反。**未证**（需 Host boot，未授权、未执行）：真实 PTY 与同 PTY 多命令、真实 shell 运行、内核观测的读拒绝、chmod 缺口复现、真实出网尝试、跨代 PTY drain/kill。门：`node --test tests/world-factory/a5sf-*.test.mjs` **301/301**（基线 280/280，新增 21）、21 臂 RED 17/21 → GREEN 21/21、三条变异控制 M1/M2/M3 各自单独 RED、`pnpm -r typecheck` 0、touched eslint 0、`vitest` 目标组 234/234、`git diff --check` rc 0 | `dev/agent-workflow/evidence/a5sf-bash/README.md`（`arms-red.log`/`arms-green.log`/`mutation-controls.json`/`capability-probe.log`）；产品面拒绝入口 = `team-services/src/mount.ts` `mountNativeToolModules`；后端 = `team-services/src/subprocess.ts` |
| BL-42 | **真实 OS/进程边界 network-deny 后端（Bash/CLI 的 `network: deny`；v1 不要求完整 network isolation backend）** | READY（owner-owned；backend） | 裁决约束（2026-11-06 owner）：(1) `network: deny` 保持 fail-closed——无 deny 后端即拒绝执行，绝不回退联网运行，也不以 allow 近似；(2) Web `network: allow` 路径可继续被接受；(3) 可信 Web Provider 前的 `network: deny` 拒绝**不得**推广为「任意子进程已网络隔离」：**Web service-level denial ≠ subprocess network isolation**；(4) **FS/Search 等已验证面现在可以组成 scoped internal trial candidate**，不受 Bash/CLI 缺少 deny 后端阻塞；(5) Bash/CLI 只有在**真实 OS/进程边界 deny 后端**（能实测拒绝 egress/DNS/connect 的 netns/Landlock-net/seccomp 等，按实测选型）落地并通过验收后，才可声称 "offline but functional"；**refusing to start 不算通过该 feature 的验收**；(6) 不得以本项为由放宽 Q7、`V@B` 或任何既有行等级。验收=真实 egress/DNS/connect 尝试被拒绝（0 connect）+ allow 路径仍工作 + 无后端时 typed 拒绝且 0 connect 的负控 + 独立 reviewer。与 BL-39 分工：BL-39 只收窄 `/etc`+`/proc` 读取例外，不提供任何网络能力证明。 | BL-17 `dev/agent-workflow/evidence/a5sf-bash/README.md`（§(4) 禁网）；BL-18 `dev/agent-workflow/evidence/a5sf-web/README.md`；矩阵 M-08/M-14/M-15；BL-29 |

## 4. Face: Web

**共享边界**：`effective.network.access` + 后端自身的能力探针（`probeNetworkDenial`，与
Subprocess 面**同一个**探针，不复制）；`createConfinedWebClass` 在 provider 之前拒绝。

- **A**：`network: deny` 是否在**任何**请求/ DNS / 代理之前拒绝；allow 车道的 redirect/proxy
  **未中介**维度必须以 typed residual 落在同一条 ALLOW 事实上。
- **B**：M-14 `web_fetch`、M-15 `web_search`。
- **C**：**无**。live 半场的真因是**产品行不转发 `web` face**（`a5sf-realm-row.mjs` 只转发
  `compiled.subprocess`），因此没有 row config key、没有 service、没有 constructor——这不是
  operator 环境问题。未完成的 `#608` 是这条接线的候选，**在它合并且 CI 转绿之前不得把它当作已存在**。

**已知能力缺口**：本机没有任何后端报告 `network-destination: enforced`，所以本环境**不存在**
“既允许 `web_fetch` 又拒绝网络”的合法声明；deny 车道的正确行为是**拒绝执行**（`NETWORK_UNCONFINED_REALM`）。

#### P2 — 每机制代表工具（G2）

| ID | 工作包 | 状态 | 入口 / 证据 |
|---|---|---|---|
| BL-18 | P2-05 原生 `web_fetch`（本地 mock provider、network=deny 前置拒绝、普通 DSH fetch 不受影响） | IN-PROGRESS（**BACKEND-PARTIAL, V@B=no**；2026-11-05 host-free：confined `web` face 挂到 Member realm 同一隔离链，`network=deny` 在 provider 之前以 typed `NETWORK_UNCONFINED_REALM` 拒绝（0 fetch/0 DNS/0 connect/0 proxy，一条 deny 事实），复用 BL-17 的 `probeNetworkDenial`，allow lane 的 redirect/proxy 未中介性以 typed residual 落在 ALLOW 事实；**未证**：真实 egress/DNS、live redirect chain、proxy env 行为、booted world 中模型可见的工具面、产品行接线——产品组合至今不供 web provider，故 governed Member 的 `web_fetch` 仍是继承宿主工具）；**2026-11-06 接线轮（host-free）**：`a5sf-realm-row.mjs` 现转发 `compiled.web`（镜像 `compiled.subprocess` 的 `{effective, provider.fetch/search}`）并新增行配置键 `a5sfWebFace`（模块工厂，返回同一 shape；双源 ⇒ `REALM_DECLARATION_INVALID`），缺失/不可挂载时以 typed `NETWORK_UNCONFINED_REALM` 在 composition 期 fail-closed；10 arms RED→GREEN + 2 mutation controls；**live half 仍未测量**（§8b：steps 3–7 已 RUNNABLE 但未执行，step 8 仍 BLOCKED；默认产品 preset 未新增 web face，`product-assembly.ts` 的 deny 拒绝未改） | `evidence/a5sf-web/README.md`（§5 拒绝位置、§6 残余、§8 live checklist、§8b 接线 unblock） |

#### P4 — 全维度验收（G4）

| ID | 工作包 | 状态 |
|---|---|---|
| BL-29 | P4-03 Network deny/allow（Web 前置 + OS TCP/UDP/IPv4/IPv6/DNS/代理/重定向；无 netns 不伪称） | BLOCKED（依赖 G3） |

## 5. Face: External execution（LSP · MCP · PTC）

**共享边界**：**尚不存在**。LSP 与 MCP 是外部进程/远端执行，PTC 是 `@deepseek-ai/dsh-tools` 的
执行模式而非可装载工具模块；三者都没有产品接线（矩阵 M-11/M-12/M-17/M-18 全部 `NOT_WIRED` 或
`UNSUPPORTED`）。

- **A**：无。本面没有面级安全矩阵，因为还没有共享边界。
- **B**：M-11 `run_code/PTC`（`NOT_WIRED`）、M-12 `lsp`（`NOT_WIRED`）、M-17 stdio MCP
  （`NOT_WIRED`）、M-18 remote MCP（`UNSUPPORTED`，`TRUSTED_DELEGATION`）。
- **C**：无，且**在 A 层存在之前不应有**：先把面做出来，再谈候选验收。

**命名的诚实性**：remote MCP/SSH 的“远端效果不承诺”是**披露**，不是 UNSUPPORTED 之外的保证；
把 `UNSUPPORTED` 读成“已限制”是本阶段明确禁止的读法。

#### P2 — 每机制代表工具（G2）

| ID | 工作包 | 状态 | 入口 / 证据 |
|---|---|---|---|
| BL-19 | P2-06 原生 `run_code/PTC`（Node 子进程 + 受控 Host bridge，无代发旁路） | READY | `a5sf-ptc.mjs`（planned, not created） |

## 6. Face: Non-data-plane tools

**共享边界**：无数据面 I/O；Alpha.4 调用准入即可，**不另设上限**。

- **A**：不适用（没有可被面约束的数据面）。若某工具实际读写文件，必须**重新归面**到 FS/Subprocess。
- **B**：M-19 state tools（`goal`/`todo`/`jobs`/`session`/`ask`）、M-20 `present`/`skill`/attachment、
  M-21 unknown in-process JS（`UNSUPPORTED`，`TRUSTED_ONLY`）。
- **C**：无，且不需要 boot——本面的验收是契约性/披露性的。

**本面没有独立 BL 条目**是真实的投入状态（需求在 BL-25 批内），不是编号遗漏。

_（本面无独立条目。）_

## 7. Cross-face（stage-wide）

机制、治理、批量、发布——不属于任何单一共享边界。它们的验收不由某个能力面的 A/B/C 完成；
它们的 C1/C2 见 §0.1.3 台账。

**跨面阻塞（本桶唯一一条，行不在此处）**：**BL-42**（真实 OS/进程边界 network-deny 后端）同时阻塞
**Bash/CLI**（Shell-PTY 的 M-08/M-09）、**第三方 CLI**（Subprocess 的 M-16）与 **external execution**
（M-12/M-17 的进程出网）。它的行放在 Shell-PTY，因为唯一具名的阻塞消费者是 BL-17；此处只登记“这一条
不是某一个面的私事”，不复制该行、也不复制它的验收条件。

#### P1 — 基础体系（G1）

| ID | 工作包 | 状态 | 证据 / PR |
|---|---|---|---|
| BL-01 | P1-01 v4 复用与最小 Member 上界增量（三轴 grammar，`memberIoCeiling`） | DONE | `dev/agent-workflow/evidence/a5sf-p1-01/`、`a5sf-g1/G1-GATE-REPORT.md` |
| BL-02 | P1-02 MemberPolicy 编译器（`EffectiveIo ⊆ MemberCeiling ∩ ToolRestriction`，`all` 为交集单位元） | DONE | `evidence/a5sf-p1-02/` |
| BL-04 | P1-04 Invocation Binder + Trust Registry（能力不可重放、lease 需调用方时钟） | DONE | `evidence/a5sf-p1-04/` |
| BL-05 | P1-05 Service Realm / Provider 绑定（隔离 `ctx.isolate('fs')`、安装回滚、代际拒绝、`installToolBindingRealm`） | DONE | `evidence/a5sf-p1-05/` |
| BL-06 | P1-06 Provider/Backend 排他替换及发布路径 | DONE | `evidence/a5sf-p1-06/` |
| BL-09 | R1 审批/治理接管（Alpha.4 ControlService/Envelope/ApprovalCase 以公开 seam 接管新执行面） | DONE | PR #541；`evidence/a5sf-r1/`；只消费既有 `ControlService.guardOperation` 的耐久 allow，只可收窄不可放宽；无第二 Ledger |
| BL-10 | R2 工程基线继承（WorldFactory/Canary/oracle、四层 CI、`PR #394` 诊断工具） | DONE | PR #540；`evidence/a5sf-r2/`；唯一 launcher/ledger/oracle/诊断表，预算门移到 `run-record.mjs` 单一实现 |
| BL-11 | R3 证据链（Alpha.4 允许/拒绝 → 编译结果 → Provider consulted → 独立效果 Oracle 同调用对齐） | DONE | PR #545；`tests/world-factory/lib/a5sf-evidence.mjs` + `evidence/a5sf-r3/`；四链同调用对齐，passive（不决策），`consulted/disposition` 为 lane 声明并已披露；未知行种类 fail-closed |
| BL-12 | R4 诊断工具（approval-bypass / 失效分类报告） | DONE | PR #542；`evidence/a5sf-r4/`；`scripts/a5sf-diag.mjs` 复用 `PR #394` 分类表与 P1 `matchLocator`，不新增词汇 |
| BL-13 | R5 黄金向量转换（旧 tool-family 输出向量 → 新 Provider 对照） | DONE | PR #543；`evidence/a5sf-r5/`；12/5041 向量转成回归对照语料，MATCH 明确不构成验收 |

#### P3 — 原生工具逐项接入（G3）

| ID | 工作包 | 状态 | 备注 |
|---|---|---|---|
| BL-21 | P3-00 原生来源清单与分类（真实 `ToolRuntime`/Preset/动态 MCP 导出，动态来源默认 NOT_TESTED） | IN-PROGRESS（源半已 done、runtime 半被 boot 阻；原记 BLOCKED（需真实 Host boot）） | 输出 `tests/kits/a5sf-native-inventory/` + `evidence/a5sf-p3/inventory/` |
| BL-23 | P3-02 搜索与进程组（`grep`/`glob`/瞬态与持久 shell/`run_code`/`terminal_*`/`lsp`） | IN-PROGRESS（原记 BLOCKED（依赖 BL-21）；矩阵 M-06/M-07 显示 grep/glob 已有 ENFORCE-PARTIAL 证据，shell/run_code/terminal_*/lsp 仍 NOT_WIRED） | 分别验收瞬态与持久 |
| BL-24 | P3-03 Web 与外部提供者（`web_fetch`/`web_search`/stdio MCP/remote MCP） | BLOCKED（依赖 BL-18/BL-21） | remote = TRUSTED_DELEGATION 或 UNSUPPORTED |
| BL-25 | P3-04 无直接数据面 I/O 的工具与未知工具（`goal`/`todo`/`jobs`/`present`/`ask`/`skill`/`session`） | BLOCKED（依赖 BL-21） | 逐工具列明实施/不实施理由 |
| BL-26 | P3-05 旧工具 Family 分阶段接管/退役（freeze → parity → switch → delete，不删证据） | BLOCKED（依赖 BL-22..BL-25） | 唯一 Integrator 变更 `team-tool-plane.mjs` 等 |

#### P4 — 全维度验收（G4）

| ID | 工作包 | 状态 |
|---|---|---|
| BL-30 | P4-04 一次性审批与撤权（并发仅一次扩权、持久 Bash 排空、取消 ≠ 确认终止） | READY（原记 BLOCKED（依赖 BL-09/BL-11，二者已 DONE）） |
| BL-31 | P4-05 绑定/运行时更新（HMR/源摘要/同名替换/Realm/重启/cold resume，无未受控 fallback） | BLOCKED（依赖 G3） |
| BL-32 | P4-06 Host 兼容（非 Team read/bash/web 不受影响、`spillStore` 回归） | BLOCKED（依赖 G3） |
| BL-33 | P4-05A 双平面同调用一致性与实际消费（Alpha.4 → Provider consulted → 独立 oracle 全对齐） | IN-PROGRESS（**一致性半已 done**：42 例 37 AGREE / 5 引用例外 / **0 DISAGREE**，`IO_ASK_REQUIRES_APPROVAL` 在准入侧 fail-closed，投影保留 ask 车道已实测；**消费半** blocked on BL-30 的一次性审批，届时 ask 才可被批准而非一律拒绝） |
| BL-34 | P4-07 性能与运行资源（p50/p95/p99、RSS、CPU、启动次数；无自定阈值假保证） | BLOCKED（依赖 G3） |

#### P5 — 对抗与发布（G5）

| ID | 工作包 | 状态 |
|---|---|---|
| BL-35 | P5-01 对抗性 I/O（TOCTOU、软链出界、`/proc/self/fd`、继承 FD、PATH 替换、孤儿进程、代理/UDS/host bridge） | BLOCKED（依赖 G4） |
| BL-36 | P5-02 生命周期/故障恢复/上游升级演习（撤销/重启代际、崩溃、双装、无 Landlock/bwrap、僵尸清理） | BLOCKED（依赖 G4） |
| BL-37 | P5-03 发布前产品/工程双验收（RUN-MANIFEST、GATE-REPORT、独立权威迁移 PR、用户最终裁决） | BLOCKED（依赖 G5.1/G5.2） |

#### 回归义务（BR）

| ID | 内容 | 状态 |
|---|---|---|
| BR-01 | 每个 PR 必跑：`pnpm -r typecheck`、`pnpm -r build`、`pnpm check:artifacts`、受影响 Alpha.4/5 套件 | IN-PROGRESS（持续） |
| BR-02 | `tests/deepseek-harness-test-use` 保持 pristine `639ed01539`；非 Team 路径等价 | IN-PROGRESS（持续） |
| BR-03 | 旧 Alpha.4 权限/审批/Jobs 语义不退化（只追加证据，不改历史） | IN-PROGRESS（持续） |

## 8. 阶段索引（按阶段的旧读法仍然可用）

| 阶段 | 条目（归面） |
|---|---|
| P1 | BL-01（cross）、BL-02（cross）、BL-03（fs）、BL-04（cross）、BL-05（cross）、BL-06（cross）、BL-07（subprocess）、BL-08（shell-pty）、BL-09（cross）、BL-10（cross）、BL-11（cross）、BL-12（cross）、BL-13（cross） |
| P2 | BL-14（fs）、BL-15（fs）、BL-16（subprocess）、BL-17（shell-pty）、BL-18（web）、BL-19（external）、BL-20（subprocess）、BL-39（subprocess）、BL-40（subprocess）、BL-41（subprocess） |
| P3 | BL-21（cross）、BL-22（fs）、BL-23（cross）、BL-24（cross）、BL-25（cross）、BL-26（cross） |
| P4 | BL-27（fs）、BL-28（fs）、BL-29（web）、BL-30（cross）、BL-31（cross）、BL-32（cross）、BL-33（cross）、BL-34（cross） |
| P5 | BL-35（cross）、BL-36（cross）、BL-37（cross）、BL-38（fs） |
| BR | BR-01（cross）、BR-02（cross）、BR-03（cross） |
