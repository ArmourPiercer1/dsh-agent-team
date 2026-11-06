# Alpha.5 阶段性开发报告 — 2026-11-10

> **本报告不代表 Alpha.5 通过验收，也不代表可以停工。**
> 它是本工作批次的正式收口陈述（owner 2026-11-09 裁决：第 75 轮前提交），此后开发继续。
> 报告时点：`master` = `f87f226e3`，Authority 指针 `as20261105r2`，host pin `639ed015397290b3745d163aafe02ffee4aa3f84`（0.2.0-rc.2）。
> 自 2026-11-02 起合并 **95** 个 PR；本阶段 `CORE PATCH BUDGET = 0` 从未突破，upstream 树从未被写入。

---

## 0. 三句话摘要

1. **机制层已经成立**：Member × Tool 两轴上界被编译进真实执行路径，FS/Search/Subprocess/Web 四个面在真实 Host 上被
   走到、被拒绝、被记录，各有一对**逐项一致**的稳定 live 结果（`DEV-LIVE`，31 次启动、2 小时 49 分）。
2. **机制层的成立不等于约束成立**：live 测出**两个治理洞**——`network: deny` 不约束成员的 `bash`（PD-12），
   成员自己的终端路径没有读轴、能读出被 lane 禁止的字节（PD-13）。两者都是"机制工作，但不在调用路径上"。
3. **不可发布**：`release BLOCKED`。缺的不是证据数量，而是受管终端面（BL-17）、真实网络拒绝后端（BL-42）、
   PTC 接线、G2–G5 发布矩阵。已交付的是**可独立评估的阶段成果**，不是 Alpha.5 完成。

---

## 1. 本阶段要证明什么（不变量）

```
EffectiveIo(member, tool, call) ⊆ MemberCeiling(member) ∩ ToolRestriction(member, tool)
```

三个正交轴：读、写、网络（网络是单一冻结的二元轴）。"证明"的含义是：对任意成员、任意工具、任意一次调用，
**有效的 IO 面都被两个上界的交集所包含**，而且每一次拒绝都能归因到"哪一层拒绝的"。

这条不变量是 Alpha.5 的全部内容。本阶段的工作可以读作对它的一次系统性压力测试。

---

## 2. 现在成立的事实（按证据类型分级）

### 2.1 机制级（host-free 臂 + 真实 seam，无 Host）

| 面 | 臂 | 证明了什么 |
|---|---|---|
| FS Provider | 20 臂 / 16–17 变体控制 | 真实 `tool-fs` + `LocalFileSystem` + route-C 在 provider 调用之前实施编译后的交集 |
| Subprocess | 15 臂 / 6 变体控制 | 出 lane 的搜索在**任何进程存在之前**被拒绝（`spawns 0→0`，一条 deny fact） |
| Shell-PTY | 15 臂 / 9 变体控制 | 生命周期、命令闸、`killDomain` 收敛（`killed:true`）、撤销契约（PD-1 修复后） |
| Web | 10 臂 / 5 变体控制 | deny lane 在 face 上、provider 之前失败，五个通道计数全零 |
| 原生来源清单 | 42 项 | 每个原生工具的来源与可采纳性 |
| 债务登记 | PD-1…PD-14 | 每个已发现缺陷/差异的**可执行钉**与验收判据 |

`DEV-LIVE` 之外，所有等级仍只靠这些臂与明文声明支撑；`V@B` 没有因为 live 结果而移动。

### 2.2 live 级（真实 Host，`DEV-LIVE`，31 次启动）

| 面 | 稳定对 | 结果 | 关键观察 |
|---|---|---|---|
| FS/Search | run-3 / run-4 | **13 PASS / 0 FAIL / 1 NOT_REACHED**（14 行） | `read`/`write`/`edit`/`grep`/`glob` 在 lane 内外行为正确；1 行 `read_image` 未到达（模型未声明图像输入） |
| Subprocess | boot 10 / 11 | 4/4 case，8/8 proposition | `bash` 落在 shipped `SandboxBashExecutor`；argv 谓词 live 生效；deny 在准入层、零进程 |
| Shell-PTY | run-08 / run-09 | 6 项一致裁决 | 成员的 shell 是 preset 继承的 legacy PTY；同 PTY 多命令共享；chmod 缺口复现 |
| Web | run-06 / run-07 | 2/2 case 一致 | seam 真的把 confined web face 交给成员自己的 tool call；deny 在 face 上、一条 fact、零 provider entry |

**这四个面第一次有了"我们的机制在真实 Host 上确实被走到"的证据**，此前它们只有 host-free 臂。

### 2.3 三个必须一起读的限定

- `DEV-LIVE` **不是** `CANDIDATE-C2`：代码层禁止它产生 `V@B=yes`（`DEV_LIVE_EVIDENCE_NOT_CANDIDATE`），
  它不进入候选验收，也不能改写任何等级。
- **没有任何网络隔离声明**。所有网络结论都是"准入层拒绝、零进程、因为 provider 自己的能力探测报告
  `network-destination: unsupported`"，OS 从未被要求拒绝任何东西。§7 的五个可观测项（非空 mechanism + 证据行、
  真实子进程被内核/传输拒绝、正控、带外传输观测、第二条消费路径）**一个都不具备**。
- **传输是 recorder**：web 臂的传输没有 socket/DNS/proxy；PTY 的端口是注入的 double（PD-1 的修复因此是契约级验证）。

---

## 3. 本阶段最重要的两个发现（它们把"机制成立"和"约束成立"分开了）

### PD-12 — `network: deny` 不约束成员的 `bash`（治理洞，破坏 **ceiling 项**）

> **2026-11-10 关闭（draft PR `task/a5sf-pd12-fix-20261110`，未合并；`DEV-LIVE`，0 candidate）。**
> 修法：在成员自己的 scope 内用既有 route-C 原生模块 seam **shadow `bash`**（不是改 preset、不是
> 改 upstream），于是调用由 confined `subprocess` face 服务，编译后的 `network: deny` 被求值。
> 下面这段仍是**修复前**的测量（pin 保留）；修复后三个连续真实 Host 的一致结果是：allow 车道的
> model `bash` 恰好 1 次到达 confined provider（base `shell-exec` 0、base spawn 0），deny 成员的
> 同一命令以 `NETWORK_UNCONFINED_REALM`（点名 `network-destination`）拒绝，**0** provider 调用、
> **0** base spawn、**0** `/proc` sighting。证据 `dev/agent-workflow/evidence/a5sf-pd12-fix/`。
> **不能宣称**：OS 级网络隔离（provider probe 仍 `unsupported`，BL-42 仍开）；shell body 的读轴
> 已可归因（PD-13 **仍未关闭**）；没有 `shellClass` 的产品组合从"执行"变成了
> `SUBPROCESS_SHELL_NOT_DECLARED` 拒绝；`product-assembly.ts` 仍不能请求进程面，故未装该面的
> shipped preset 的 `bash` 不变。

- **live 事实**：一个 ceiling 声明 `network: deny` 的成员，其模型可见的 `bash` 仍然执行命令：落在
  shipped `SandboxBashExecutor`（继承的 base subprocess 服务），confined provider 被调用 **0 次**，
  一个 OS 进程带着该命令，bwrap argv **没有 `--unshare-net`**。
- **为什么不变量被破坏**：ceiling 是**按面**编译的，而 ToolRestriction 把 `bash` 绑到一个**永不进入该面**的执行器，
  于是"交集"是在一个调用根本不经过的机制上算出来的。
- **为什么 host-free 臂没抓到**：臂问的是"我的机制做什么"，不是"这个 tool 实际走哪个机制"。
  PD-6 的臂测的是 face **拒绝** shipped executor——与"executor 在别处照旧运行"是两个命题。

### PD-13 — 终端路径没有读轴（治理洞，破坏 **ToolRestriction 项**）

- **live 事实**：成员的 `bash` 是 preset 继承的 legacy persistent shell（`/dev/pts/N`，一个 shell 跨多条命令，
  第二个成员独立），**0 confined spawn / 0 guard fact**；该 shell **读出了只写 lane 禁止的 secret 并返回其字节**（exit 0）。
  同一个问题问到 confined face，得到 `IO_READ_DENIED`、0 provider call、0 字节。
- **为什么不变量被破坏**：route C 只 shadow 它重新注册过的工具（FS/search 对），`bash` 不在其中，所以 preset 的行服务于它，
  ceiling 的读禁止**从未被求值**——交集根本没有被取。
- **最锋利的一句话**：**机制是对的，但它不在那条路径上。**

### 另外两个已记录项

- **PD-14**：成员 session 的 sandbox root 解析到 `session.header.cwd`，而 World 把它设成 **pinned host checkout**，
  于是 bash 子进程对一棵永不被删除的树有 `--bind` 读写权（卫生问题，与安全洞独立）。
- **PD-11**（已修）：bootstrap 在存储介质关闭后失败时，会把 teardown 报成自己的失败原因——它掩盖了真实原因，
  这正是"boot #5 看起来像产品缺陷"的机制。

---

## 4. 没做完的部分（明确列出，不使用"基本完成"这类词）

| 项 | 状态 | 性质 |
|---|---|---|
| 受管终端面（`RealmServiceFaces.terminals` + install 路径 + confined backend） | **NOT_WIRED** | 结构缺口；PD-1 已修，但面无处可装 |
| 真实网络拒绝后端（BL-42） | **NOT_BUILT** | 没有它，"offline" 只能写成"准入层拒绝" |
| Landlock `/etc`+`/proc` 读例外硬化（BL-39） | **NOT_BUILT** | 启动器加固 |
| PTC 接线 / LSP / stdio-MCP | **NOT_WIRED** | 外部执行面无产品实现，故不作任何受限声明 |
| G2 读/写 | **EXPIRED** | 真实结论存在但被 #606 的 Q7 漂移撤回 |
| G3–G5 发布矩阵 | **NOT_STARTED** | 发布门槛未触及 |
| `read_image` 的 lane 行为 | **UNMEASURED** | 模型未声明图像输入；PD-5 既未被证实也未被推翻 |
| 真实 HTTP/DNS/redirect/proxy | **UNOBSERVED** | 传输均为 recorder |
| 两个 Member 并发 | **UNMEASURED** | 结构性未测 |
| >10MiB 窗口、流式 | **UNMEASURED** | 属 FS lane 的下一轮 |

**发布判断：`release BLOCKED`。** 若要做范围受限的内部试用，必须逐面写明上表的状态，并且不得把 `DEV-LIVE` 当作试用验收。

---

## 5. 仪器史：本阶段最贵的教训

五次正式启动、**零个 current live 结论**，全部死在仪器缺陷上；而开发级启动（31 次）把同一类缺陷暴露得更彻底：

| # | 缺陷 | 今天挡住它的检查 |
|---|---|---|
| 1 | 组合交接失败 | `assembly.usable`（原有） |
| 2 | 空配置 | `native.module-config`（原有） |
| 3 | 缺 `over-sample-cap` glob | `native.module-config` + `bundle.case-coverage` |
| 4 | FIFO 在车道外 + 两 case 共用 locator | `policy.fifo` + `cases.isolation` |
| 5 | state gate 在 `team.create` 之前 | `driver.gate-order` |
| 6 | run-record 缺 `pointerSha256` | strict `--new` 档 |
| 7 | leader 模型可见面未覆盖 | `driver.leader-surface`（镜像 A2C-2 谓词 + 漂移守卫） |
| 8 | health 探针把 pending 读成致命 | `preflight-domain-lifecycle`（可区分控制）+ 轮询 |
| 9 | 判据把 guard 的能力探测算成 provider entry | 驱动自测（`LOCUS` 纪律） |
| 10 | "第二条命令"由第一条改写而来 → **false pass** | 独立 control 命令 + 读原始 evidence |

**结论不是"再加检查"，而是三件事**：① 拒绝"绿了就算"的判据（`UNKNOWN` 必须与 `PASS` 可分）；
② 每次拒绝记录 `LOCUS`（哪一层拒绝），因为结果对、归因错 = false pass；
③ 这些缺陷形状的共同点，是**只有真实门禁/Host 才现形**——这直接导致了工作流裁决。

---

## 6. 工作流裁决与实测效果

**2026-11-09 裁决**：开发阶段真实 Host 启动取消固定累计次数；具名能力面的 implementer 在隔离 World 内可自主、重复启动；
Integration Owner 只保留共享装配、PR 集成、资源调度与冻结候选验收；隔离/租约/teardown/记录/独立审查/CI/Q7 全部保留；
`DEV-LIVE` 与 `CANDIDATE-C2` 两类记录不可混用。

**实测（同一时钟源）**：

```
旧模式：5 次正式启动，16h49m40s，0 个 current live 结果（唯一 PASS 同日被 Q7 撤回）
新模式：31 次自主启动，2h49m12s，4 组逐项一致的 live 结果 = 7.75 次启动 / 42m18s 每组
```

**不计算倍数**——旧分母是 0，5/0 无定义。可辩护的说法只有："从零个稳定 live 结果，到四个"。
诚实的注脚：新模式的起点是旧模式五次失败的**教训已经变成预检**；而最便宜的 lane（FS，4 次）正是预检真正在
`spawn` 处生效的那条。

**代价也要记**：31 次里有约 20 次属于仪器缺陷运行（PTY 9 次里 5 次、Sub 11 次里 5 次），
另有 1 次 **false pass**。诚实的改进项：先把 mock 契约与计数分类做单测，再启动；FS lane 估计可把 7 次降到 ~4 次。

---

## 7. 每个面"今天真实能做什么"（一句话版）

| 面 | 今天真实能力 | 最强真实声明 | 最弱未证声明 |
|---|---|---|---|
| FS Provider | 只有在声明了 `a5sfMemberPolicies` 的组合里才受限；没有 shipped preset 声明它，故产品路径用继承的 provider；`read_image` 在 route-C 下不可达（PD-5） | 20 臂在真实 `tool-fs` 上于 provider 之前实施交集 | "成员的 FS 被沙箱了"——今天为假，且 live `V@B=no` |
| Subprocess | `grep`/`glob` 在提供 P1-07 + launcher pin 且声明该面时受限；第三方 CLI `PROBE-GATED`；`bash` 在声明了该面的 realm 上现在**由该面服务**（PD-12 已修，2026-11-10；此前走 shipped executor）；未声明该面的 shipped preset 不变 | 15 臂在任何进程之前拒绝出 lane 搜索；PD-12 的 deny 是 admission 拒绝，不是 OS 拒绝 | "`network: deny` 意味着离线"——OS 从未被要求 |
| Shell-PTY | **没有受管 shell**：`RealmServiceFaces` 无 `terminals`；成员的 shell 是 preset 的 legacy PTY，能读出被 lane 禁止的字节（PD-13） | 15 臂 + PD-1 契约修复证明生命周期/命令闸/撤销顺序 | "成员有 shell，只是被拒"——没有面；PTY 是 double |
| Web | seam 真的把 confined face 交给成员的 tool call；deny 在 face 上拒绝；但无 shipped preset 声明该面，且 strict Member 无法承载该工具对 | 10 臂 + 7 次 live 启动（2 组一致） | "接上了 ⇒ 成员受管"——没有 caller 的默认路径 |
| 外部执行 | 未接线（PTC 非可加载模块、LSP 不在 preset、stdio/remote MCP 未连接） | 不存在该面，故不作受限声明 | "`UNSUPPORTED` 意味着受限" |
| 非数据面 | Alpha.4 准入；state 工具无数据面 IO；`present`/`skill`/附件 `CONDITIONAL` | 在此处加数据面上界会是虚假保证 | "present/skill 读不了任意文件" |

---

## 8. 待 owner 裁决 / 我按裁决已执行的

- **已执行**：PD-1 → 代际明确撤销接口 + `spawn` 期间竞态封堵（#629）；开发级 Boot 自授权（#631）；
  三份 2026-11-09 决策入档（#628）。
- **仍需裁决**：PD-4 proxy overlay 语义；PD-5 `fs` 进 `ROUTED_SERVICE_NAMES`；
  PD-6 shipped `bash-local` executor 的去留；**PD-12 的修法已裁决并落地**（把 `bash` shadow 进成员 scope；2026-11-10，draft PR，未合并）；PD-13 的修法仍未裁决；
  **PD-13 的修法**（建受管终端面，还是明确保留 legacy PTY 并停止宣称受管 shell）。
- **不需要裁决但需要决定的工程项**：PD-14 的 session cwd（World 夹具 vs 产品默认）；
  `web_search` locator 形状（PD-10）；PD-1 残留的 `keyOf` 代际（gen-2 可复用 gen-1 活跃域）。

---

## 9. 下一批工作（按价值排序）

1. **PD-12/PD-13 的修法落地**——PD-12 已落地（2026-11-10，`network: deny` 现在在 `bash` 路径上被求值）；**PD-13 仍未落地**，仍是不变量的直接反例，优先级高于任何新面。
2. **受管终端面**（BL-17 的 build）：`RealmServiceFaces.terminals` + install + confined backend；同时处理"preset 仍为成员
   挂 legacy `dsh-terminal`"的双终端问题。
3. **真实网络拒绝后端**（BL-42）——在它之前，任何"离线"声明都必须写成"准入层拒绝"。
4. **`CANDIDATE-C2` 重测**：把 FS/Search 与 Web 的 live 结果升级为候选级证据的唯一路径是冻结候选 + 独立验收；
   `DEV-LIVE` 永远不是那条路径。
5. **仪器前置化**：mock 契约单测、计数分类单测、`LOCUS` 断言，作为下一次 live 的开始条件。

---

## 10. 一句话交付结论

**Alpha.5 目前交付的是一个"机制正确、路径不完整"的沙箱内核**：编译、准入、拒绝归因、证据可复现性都已成立，
并在真实 Host 上被四个面走到；**但它今天还不能保证一个成员的实际能力被其上界包含**——PD-12 的 `bash` 路径已修，PD-13 的读轴不是实现 bug，
而是"上界作用于面、调用走另一条路"的结构性缺口。修复它们之后，Alpha.5 才有资格谈 G4/G5。
