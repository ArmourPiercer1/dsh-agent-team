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

---

## 附录 B — 2026-11-11 附录：§2.3 的“没有网络隔离声明”已被**部分**取代（只追加；§2.3 原文不改）

**这一条只追加在报告末尾，不编辑 §2.3 的任何字节。** §2.3 写于 2026-11-10，它的三条限定在当时是真的；
BL-42（#644，`990becb07`）之后，第二条从“全真”变成“部分被取代”，第一、三条不变。

### B.1 §2.3 第二条：哪半句仍然真，哪半句不再真

原文（保留）：

> **没有任何网络隔离声明**。所有网络结论都是"准入层拒绝、零进程、因为 provider 自己的能力探测报告
> `network-destination: unsupported`"，OS 从未被要求拒绝任何东西。§7 的五个可观测项（非空 mechanism + 证据行、
> 真实子进程被内核/传输拒绝、正控、带外传输观测、第二条消费路径）**一个都不具备**。

- **不再真的半句**：对**本机一个 confined 子进程的 `network: deny` 车道**，“OS 从未被要求拒绝任何东西”不再
  成立——OS 被要求了，并且拒绝被**带外测量**到了：同一 launcher 的对照子进程到达 loopback listener
  （`accepted=1`、`datagrams=1`、nonce 匹配），deny 子进程 `accepted=0`、`connect`/`sendto` 得
  `ENETUNREACH`、自身 `/proc/self/ns/net` inode 与 host 不同。§7 的五个可观测项现在按**严格 4/5**成立
  （items 1–4），**宽读 5/5**（item 5 的 second consumer = PD-13 的 confined terminal face，同一个 process
  face）。证据 = `dev/agent-workflow/evidence/a5sf-bl42-netdeny/README.md` §2/§3/§6。
- **仍然真的半句**：**“没有任何网络隔离声明”仍然成立**。`enforced` 是**能力行**的值，描述“这个后端在本机
  被要求拒绝且测量确认”，不描述产品里哪个 Member 的哪条调用会走到它，也不等于隔离。§7 的 item 5
  **live Host 半场没有做**：BL-42 **0 次启动**、无 `DEV-LIVE` 行、无 shipped preset。AF_UNIX pathname
  socket 在 netns 之外、继承 fd 是拒绝不是过滤、DNS 只按 loopback 形状的 UDP 被测、不允许非特权 userns
  的 host 退回准入拒绝。
- **仍然不 entitled 的句子**：**A Member's `bash` cannot reach the network.** 没有 boot，就没有关于
  产品接线的结论；PD-12 的修复把 `bash` 送进 confined face，但该 face 的 deny 在**没有** proof 时仍然只是
  准入拒绝，而 shipped 组合仍未声明该面。

### B.2 §2.3 第一、三条（不变）

- 第一条（`DEV-LIVE` 不是 `CANDIDATE-C2`、不产生 `V@B=yes`）**不变**：BL-42 连 `DEV-LIVE` 都不是，它是
  host-free 臂加上一条本机 OS 测量；它没有 boot，也没有候选分配。
- 第三条（web 传输是 recorder、PTY 端口是 double）**不变**：BL-42 没有给 web 面加 socket，也没有改变
  PTY 注入端口。web face 的 deny 仍是 service-level 准入拒绝，不是 OS 网络拒绝；BL-42 的 netns 不覆盖
  进程内 HTTP。

### B.3 与本报告 §7 表的关系（同一读法）

§7 的 Subprocess 行写“PD-12 的 deny 是 admission 拒绝，不是 OS 拒绝”“OS 从未被要求”——这两句在**写它们
的树上**是真的，保留不改。今天要补一句：在**持有 netns 后端并拿到 proof** 的 confined 子进程车道上，
deny 已经可以是 OS 拒绝（严格 4/5 / 宽读 5/5，0 次启动）；但**这不改变任何面级能力声明**，也不改变
`release BLOCKED`。

**一句话**：BL-42 让“OS 拒绝”这半句第一次有证据；它没有让“隔离”或“Member 的 `bash` 不能上网”有证据。

---

## 附录 C — 2026-11-12 附录：§3 的“机制不在那条路径上”对**显式 opt-in 的 Team** 已部分被取代（只追加；§3 原文不改）

**这一条只追加在报告末尾，不编辑 §3 的任何字节。** §3 写于 2026-11-10，它关于 PD-12/PD-13 的结论
（“机制是对的，但它不在那条路径上”，以及“未装该面的 shipped preset 的 `bash` 不变”）在**默认路径**上
仍然成立；对**显式 opt-in 的 Team**，它从“全真”变成“部分被取代”。

### C.1 哪半句不再真，哪半句仍然真

- **不再真的半句**：`#648` 之后仓库**ship** 了一个 opt-in 的 governed Member preset 行
  （`preset-a5sf-governed-member`，operator 在 Team 行上写 `memberPresetId: a5sf-governed-member` 并
  `a5sfGovernedRealm: true`），`#649` 之后一个真实 Host 上的 **Member turn** 让 confined terminal
  face 真的成了该 Member `bash` 的执行路径：in-lane 读返回 lane 字节、out-of-lane 读
  `IO_READ_DENIED`、**0** secret 字节，两个结果都在 Member 自己的 durable transcript 里；**1** 次
  confined-provider launch 服务 **2** 条命令、带夹具的 base bwrap **0**；两次一致。证据 =
  `dev/agent-workflow/evidence/a5sf-live-member/README.md`。因此“没有任何 shipped 组合让机制走上
  Member 的调用路径”这句话，对**显式 opt-in 的 Team** 不再为真。它是 `DEV-LIVE`、no `V@B`。
- **仍然真的半句**：**默认路径未变**。`standard` 仍是部署默认，shipped layer 不点名任何 preset，没有
  Team 自动进入 realm；**一个在默认 preset 上的 Member 仍然既没有 confined terminal face、也没有受管
  shell**——PD-13 的那条 legacy PTY 路径原样存在。所以本附录不能被读成“Members 已受治”。

### C.2 §3 的两个治理洞今天的位置（不改变任何等级 / `V@B` / 发布门）

- **PD-12** 已 `FIXED`（#640）；在 opt-in 受治 preset 上，`bash` 就在 confined face 上，因此该 face 的
  deny/allow 被求值。
- **PD-13** 对 **opt-in 受治 Member 的 `bash`** 不再成立（读轴在 face 上）；对 **默认 preset 的 Member**
  仍然成立（legacy PTY 在 realm 之外）。PD-13 的产品语义裁决**没有**因此自动关闭。
- 不变：`CANDIDATE-C2` 未运行、`release BLOCKED`、无 `V@B`、无等级；`network: deny`、动态 shell 读、
  per-Team scratch isolation、PD-5、BL-39 全部维持原状。

### C.3 一般教训：激活窗口（activation window）——比这条证据本身更持久

- **事实**：activation 的顺序是 `createChildSession` → `durability.ensureDurable(childSessionId)` →
  耐久写 `MemberInstance` 行；而 governed realm 在 `createChildSession` 内挂载，于是它在**行还不存在**
  的窗口里问 durable authority，读到 `lifecycle=undefined`，把“还没有行”读成“不准入”，每个 live
  受治 Member 都被 `AUTHORITY_REFUSED` 拒绝。修复 = 只承认 `freshCreate` 窗口，**耐久行永远优先**
  （`ARCHIVED`/`DISPOSED` 拒绝，`CREATED`/`RUNNING`/`SETTLED` 承认），负控臂 `G5c` 钉住；pinned Host
  未被触碰，`CORE PATCH BUDGET = 0`。
- **为什么所有进程内测试都是绿的**：它们把 realm 挂在 `MemberInstance` 行**已经存在**的 roster 上。
  **进程内测试在行存在之后挂载；产品在行存在之前挂载。夹具的时序比生产更宽松。**
- **因此这是一类应当被刻意搜寻的缺陷，而不是一次性 bug**：凡是测试装配顺序比产品装配顺序更宽松的
  地方（先有行再挂载、先有 session 再绑定、先有 durable 状态再解析 authority），都可能藏着一个只在
  真实 Host 上出现的窗口。§5 的十条仪器缺陷应当增加第 11 条：**夹具顺序比产品顺序更宽松**——它不会
  让仪器变红；它让被测系统在仪器里永远是绿的。

**一句话**：对显式 opt-in 的 Team，“机制不在那条路径上”已被一个真实 Member turn 部分取代
（`DEV-LIVE`、no `V@B`）；默认路径与 PD-13 对默认 Member 的结论不变；而这次真正学到的，是**产品在行
存在之前挂载、测试在行存在之后挂载**——夹具顺序比生产顺序更宽松，是一整类需要主动猎捕的缺陷。

---

## 附录 D — 2026-11-13 附录：§10 的“机制正确、路径不完整”今天该怎么说（只追加；§10 原文不改）

### D.1 报告写完之后，变了什么

- **路径不再“不完整”了——对显式 opt-in 的 Team**：`#648`/`#649` 之后，一个 operator 显式写
  `memberPresetId: a5sf-governed-member` + `a5sfGovernedRealm: true` 的 Team，在**真实 Host** 上让一个真实
  Member turn 的 `bash` 由 confined terminal face 服务：in-lane 返回 lane 字节、out-of-lane
  `IO_READ_DENIED` 且 **0** secret 字节，两个结果都在 Member **自己的 durable transcript** 里，两次一致；
  1 次 confined-provider launch 服务 2 条命令、带夹具的 base bwrap 0。证据 =
  `dev/agent-workflow/evidence/a5sf-live-member/README.md`（`DEV-LIVE`、no `V@B`）。
- **路径依然“不完整”——对默认路径**：`standard` 仍是部署默认，shipped layer 不点名任何 preset；默认
  Member 的 `bash` 仍是继承的 legacy 执行体（PD-13 对默认 Member 仍成立）。§4 的“受管终端面 NOT_WIRED /
  默认路径未变”一字未改。
- **报告自己缺的一项被补上了**：本阶段在猎捕**自己的仪器教训**（§5 第 11 条：夹具顺序比生产更宽松）时，
  找到了同一类的第二个实例——**标签与机制分离**（矩阵 §1.6 / W3b）：一个合法 v4 blueprint 的模板没有
  `memberIoCeilings` 条目时，`a5sfGovernedRealm: true` 的行会让 Member 跑 preset 继承的**不受限 `bash`**。
  已用已有的 typed `REALM_DECLARATION_INVALID` 拒绝，RED→GREEN 钉住
  （`tests/world-factory/a5sf-window-taxonomy.test.mjs` W3b）。这是 §10 结论里**缺的那一项**：机制正确还不够，
  **一个治理标签在机制缺席时必须被拒绝**。默认路径不可达（governed provider 只在行写该键时构造，
  `packages/runtime/src/plugin/host.ts:2142-2149`；挂载只在 row config 与 provider 都在时进入，
  `packages/runtime/src/plugin/live/agent-bindings.mjs:2598`）。

### D.2 §10 结论的继任句（读者可以直接引用的版本）

> **Alpha.5 的机制是正确的，opt-in 路径是完整的、并在真实 Host 上被一个真实 Member turn 走通过；
> 默认路径一个字节未变；而本阶段最后学到的是——当治理标签背后的机制缺席时，标签本身必须被拒绝。**
> （`DEV-LIVE`、no `V@B`；默认路径不作出该声称。）

它保留了 §10 为真的部分（机制正确），替换了不再为真的部分（“路径不完整”现在只对默认路径为真），并把
“标签必须被拒绝”升格为阶段结论的一部分——这是原报告没有、而本轮真实发现的。

### D.3 没变的东西（与 D.2 同读）

`release BLOCKED` 不变；G2 读/写仍需在 Q7 下重基线；G3–G5 未开始；`CANDIDATE-C2` 未运行；无 `V@B`、
无等级移动、无证据删除。仍未证：network deny 在 OS 层、dynamic shell reads（`$(…)`/反引号）、per-Team
scratch isolation、PD-5、BL-39。本 appendix 自身 0 次启动：阶段 dev-live 总数仍是 48（Web 7 / FS 4 / PTY 9 /
Sub 28）。

### D.4 读者接下来该做什么（按优先级；以及三件不得做的事）

1. **先做 G2 读/写的 Q7 重基线**：真实结论存在，但被 `#606` 的产品漂移撤回（矩阵 §1.1 / 附录 A）。为什么
   先做它：它是唯一“已有真实结论、只缺在正确树上重跑”的发布义务；不做，G3–G5 的任何结论都会建立在比
   将合并的树更旧的证据上。
2. **在 opt-in 路径上做 G3–G5 验收**：受治面已经存在、已 live 走通，G3（逐工具正向等价与最小权限负控）、
   G4（全工具 × I/O 维度矩阵）、G5（对抗/故障/发布双验收）现在有可寻址的对象。为什么第二：先把已存在的
   路径验收成发布义务，比再造一个新面更接近 release。
3. **跑独立的 `CANDIDATE-C2`**：只有冻结候选 + 不可变 SHA + Authority + Host + Oracle + 独立裁决才能产生
   `V@B=yes`；`DEV-LIVE` 结构上不是那条路径。为什么第三：它必须在一棵**已验收**的树上跑，否则只是把旧
   问题再测一遍。

**不得做**：(a) **不得声称默认路径受治**——默认 `standard` 未变，大多数 Member 在它上面；(b) **不得把
`DEV-LIVE` 当候选证据**——run record 自述 `eligible=false`，它不能关闭任何门；(c) **不得把一个面的证明
挪用到另一个面**——subprocess 的 netns 证明不覆盖进程内 web transport；BL-42 的宽读 item 5 只是同一个
process face，不是“终端面已被 OS 隔离”。

### D.5 仪器史的第 11、12 条（§5 的十行不改，只追加）

- **第 11 条：夹具顺序比生产更宽松。** 进程内测试在 `MemberInstance` 行**已存在之后**挂载；产品在行
  **之前**挂载。`tests/world-factory/a5sf-governed-preset.test.mjs` 已改成在窗口内挂载并新增 `G5d` 钉住
  顺序（仍 14/14）。它不让仪器变红；它让被测系统在仪器里永远是绿的。
- **第 12 条：标签与机制分离。** 一个治理标签可以在它背后的机制缺席时继续存在，于是系统“声明了 confinement
  却没有挂上”。它同样是一条**必须被刻意拒绝**的形状，而不是一次性 bug；修复 = `REALM_DECLARATION_INVALID`
  在挂载处拒绝，RED→GREEN（矩阵 §1.6，W3b）。
