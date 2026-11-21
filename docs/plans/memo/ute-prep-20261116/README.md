# UTE-Prep — #765 设计基线刷新、接口差量与 G0/G1 首批纵切

**[updated 2026-11-16 UTE-Prep]** 本目录是 PR #765（`docs/plans/memo/unified-tool-execution-dsh-022-20261114/`，11 章 UTE 设计）的**评审前准备包**：把它的宿主基线从 `dsh-v0.2.2-rc.3@38a6a5c` 移到固定 `dsh-v0.2.2-rc.5@9c2670d3`，给出 rc.3→rc.5 的接口差量判定，冻结三条权威边界裁决，并把 G0/G1 拆成可逐个评审的首批 PR。它不是新的设计正本，也不改任何产品/测试/Authority 文件。

**本轮（2026-11-18 实测 UTC 20:07Z，forward-merge `origin/master@f46bcdd29`）追加**：三条曾被本目录写成"规则/提案"的工程 lane **已经落地**（#786 / #787 / #788）。因此本目录现在区分两种时态：**规则条文**（仍然有效，是合同）与**当时的状态**（"待 G0-S1 实现"之类已过期）。过期处逐条标注了落地 commit 与实测证据，**没有**把已实现的东西继续写成提案；实现与本 memo 设计不一致的三处也逐条记录，见 §4。

> **日期口径**：目录名与 banner 用本任务规定的标签 `2026-11-16`；写盘实测 `date -u` = `2026-11-18T20:07:54Z`（首轮为 `2026-11-18T13:57:51Z`）。两者差 2 天，按 `dev/agent-workflow/gates/CLOCK-ANCHOR-20261030.md` 的时钟锚点纪律记录，不做静默对齐。

## 1. 这份准备包回答什么

> **Owner ruling（原文照录，2026-11-16）** —— G1 development **is authorised to start** (public API / binding / executor prototypes, old and new coexisting and isolated); but **not** replacing the governed production execution path; **not** deleting the old ToolPlane/Family Body (needs G1-S4 old-path baseline + equivalence + a retirement gate); **not** changing production Authority; **not** enabling a fork. Three parallel lanes now in flight: **Task A** observer closeout (F-07/F-08/F-09), **Task B** rc.5 into controlled CI, **Task C** G1-S1 FS prototype + old-path golden vectors. **#765's G1-S1 is not blocked by A/B for prototyping, only for issuing a safety verdict.**
>
> 同一轮评审的**另一条裁决（否决）**：G1-S1 原验收设计"用 FS Oracle 证明未授权读取没有发生"**不成立**——快照见证看不见 `read()`。修正版见 [04](./04-FIRST-SLICES-G0-G1.md) §2 G1-S1：effect 轴可证（可声明 "no unauthorized write effect"），read 轴取 (b) 降级为 `CLAIM_NOT_OBSERVABLE` / **read-confinement UNPROVEN**，read 轴的负控是**拒绝**而不是绿。


#765 是"下一版本统一工具执行"的设计草案，外部评估的结论是：**方向可留，基线不可留，门禁不可执行**。具体三件事：#765 钉在 rc.3、而 rc.5 已发布；#765 的三大边界（宿主基线 / 结算保证 / Fork 授权）写成了意图而不是规则；#765 的 G0–G5 是横向大 Gate，没有可单独评审的第一刀。本目录逐条处理，并且**只处理这三件事**——不重写 UTE 的架构主张。

| 文件 | 内容 | 对应 #765 章节 |
|---|---|---|
| [01-BASELINE-REFRESH.md](./01-BASELINE-REFRESH.md) | 固定 tag+commit 的验证记录；第二棵 pinned 宿主树的共存规则（**已落地** #787） | README §技术基线、[十](../unified-tool-execution-dsh-022-20261114/10-IMPLEMENTATION-GATES.md) §1 |
| [02-INTERFACE-DELTA-RC3-RC5.md](./02-INTERFACE-DELTA-RC3-RC5.md) | rc.3→rc.5 逐区差量：模型响应、Web/Search 默认、版本管线、ToolsService/Pipeline 面 | [三](../unified-tool-execution-dsh-022-20261114/03-EXECUTION-FLOW.md) §2、[五](../unified-tool-execution-dsh-022-20261114/05-TOOL-ADOPTION.md) §3 |
| [03-RULINGS-AUTHORITY-BINDING-SETTLEMENT.md](./03-RULINGS-AUTHORITY-BINDING-SETTLEMENT.md) | 三条裁决：宿主基线规则 / S1-S2 结算保证分层 / Fork 授权最小例外 | [七](../unified-tool-execution-dsh-022-20261114/07-SETTLEMENT-RECOVERY.md) §5、[九](../unified-tool-execution-dsh-022-20261114/09-INFRASTRUCTURE-FORKS.md) §1 |
| [04-FIRST-SLICES-G0-G1.md](./04-FIRST-SLICES-G0-G1.md) | G0/G1 首批纵切矩阵（接口/文件所有权/验收=代码+真实负控+旧路径对照+退役条件） | [十](../unified-tool-execution-dsh-022-20261114/10-IMPLEMENTATION-GATES.md) §2/§3 |
| [05-SCOPE-FENCE.md](./05-SCOPE-FENCE.md) | 什么**不是** G1 前置、什么**是**；退役顺序禁令 | [十](../unified-tool-execution-dsh-022-20261114/10-IMPLEMENTATION-GATES.md) §1 |
| [06-PROPOSED-ACTIVE-PLAN-PATCH.md](./06-PROPOSED-ACTIVE-PLAN-PATCH.md) | 需要主 Agent/owner 执行的 `ALPHA5-SANDBOX-BACKLOG.md` / `AGENTS.md` 精确补丁（**仍是提案，未应用**） | — |

## 2. 三条工程 lane 已落地（原 §"待 G0-S1/S2" 的现状）

| PR | landed commit | 落地事实（可核验的符号/文件，不是转述） | 本目录的对应条文 |
|---|---|---|---|
| **#788** | `b28728fef` | `freeze-candidate` 截断修复（`process.exitCode`，EPIPE-only swallow）；PD34-PIN fail-closed；host-refusal guard 的派生面覆盖 `tests/` **与** `scripts/*.test.mjs`（逐套件 waiver，`CI_HOST_REFUSAL_MARKER_UNLISTED`）；`consumer-candidate` 比渲染字节；未收编 48→**46**；负控 **32/32** | 不直接对应（B3 类卫生）；为 G1-S4 的基线可信度打底 |
| **#787** | `82091ae4a` | `tests/paths.mjs` 的 `NEXT_HOST`（`treeRel: tests/deepseek-harness-next`、`homeSuffix: '-next'`、`portBands: [[13000,13049]]`）；`HOST_PORT_BANDS` 收窄为 `[[3181,3199]]`；`tests/next-host/{boot,native-api}.test.mjs`（13000 带内真实 boot + 六条 native-API 断言：`resolve`/`ResolvedToolSet`/ToolExecutor/pipeline 顺序/PTC nested/取消与结果通知）；资产仍取**已发布** `0.1.2`（`system.node 54a9c25c…`、`landlock-run a752bc72…`），本地重建被判 `DRIFTED`；`dev/ci/excluded-baseline.json`（`excluded_count: 9`）+ `--max-excluded` | [01](./01-BASELINE-REFRESH.md) H-1…H-5、[03](./03-RULINGS-AUTHORITY-BINDING-SETTLEMENT.md) R1.1–R1.4、[04](./04-FIRST-SLICES-G0-G1.md) G0-S1/S2 |
| **#786** | `f46bcdd29` | World Factory 自有 FS 观测窗口（`tests/world-factory/lib/m7b1-observation-contract.mjs`；typed 拒绝 `IDENTITY_MISMATCH` / `WITNESS_NOT_SEALED` / `WINDOW_NOT_CLOSED`）；hosted `M7B1-ARM inside-authorized verdict=SATISFIED`；五个 host-dependent 套件进 **3 条 `ci-census` legs**（该层 5→**8**），未收编 46→**41** | [05](./05-SCOPE-FENCE.md) P2、[04](./04-FIRST-SLICES-G0-G1.md) G1-S1 的观测前置 |

**这意味着什么**：[03](./03-RULINGS-AUTHORITY-BINDING-SETTLEMENT.md) 的 R1 不再是"待实现的规则"——`tests/next-host/boot.test.mjs:61` 就是那条"两代端口不相交"断言的执行体，`host-next-lib.mjs:123` 就是"本地重建不是 pin 的宿主"的执行体。反过来，[03](./03-RULINGS-AUTHORITY-BINDING-SETTLEMENT.md) 的 S1/S2 与 R3 **没有**落地：G1-S3 的结算事实、S2 的 commit-before-return、Fork 例外条文仍按原文待办/待裁。

## 3. 本包改了什么、没改什么

**改了**（都在 #765 自己的分支上，逐处带 `**[updated 2026-11-16 UTE-Prep]**` banner）：12 章的"技术基线"行（rc.3→rc.5 + Team 文档基线 → 当期 master）、[七](../unified-tool-execution-dsh-022-20261114/07-SETTLEMENT-RECOVERY.md) §5 的结算保证分层、[九](../unified-tool-execution-dsh-022-20261114/09-INFRASTRUCTURE-FORKS.md) §1 的 Fork 例外、[十](../unified-tool-execution-dsh-022-20261114/10-IMPLEMENTATION-GATES.md) 的 G0/G1 与范围围栏指针、[五](../unified-tool-execution-dsh-022-20261114/05-TOOL-ADOPTION.md) §3 的 `web_search` 路由透传义务。

**没改**：任何 `docs/plans/active/**`、`AGENTS.md`、`docs/ROUTER_RULES.md`、`docs/TEST_METHODS.md`、`dev/engineering/**`、`scripts/**`、`tests/**`、产品代码。需要改的那两处（`ALPHA5-SANDBOX-BACKLOG.md` 的 §0.4 围栏、`AGENTS.md` 的 Fork 禁令例外）以**精确补丁文本**放在 [06](./06-PROPOSED-ACTIVE-PLAN-PATCH.md)，**owner 裁决前保持提案状态**，本 PR 不应用。

## 4. hosted runs 证伪了什么（诚实记录，不是成绩单）

### 4.1 能力配对：一次"本地全绿"是假绿

`P3` 的两条 network 臂原先各自钉死**一台机器**的能力：`P3-PROBE-SHAPE` 要求 `enforced`，`P3-DENY-KERNEL-REFUSED` 要求准入。hosted runner 的 Landlock 是 **ABI v8**，其 probe note 自己说 *"Landlock ABI v4 mediates only TCP port bind/connect inside the domain"*，所以 probe 正确回答 `unsupported`；于是 deny 臂在**创建任何进程之前**就以 `NETWORK_UNCONFINED_REALM` 拒绝——**产品是对的，断言是错的**。

两条臂现在断言的是**配对**，在任何内核上都成立：`enforced` ⇒ 必须有与 `netns` 匹配的机制 + realm 绑定的 `evidence://` 行；`unsupported` ⇒ 必须**没有**机制、**没有**证据、且有一条**点名 ABI 缺口**的 note，同时 deny 臂必须 **spawn 前拒绝**（`spawns.after === 0`）。两个方向都反着测：`enforced` 而无机制 = 能力声明不是观测；`unsupported` 而放行 = 静默允许。hosted 侧用 `capabilityOverride`（只注入 probe，spawn 路径仍是产品自己的）让 v7 开发机证拒绝半边、v8 runner 证准入半边。

**这条证伪的是本 memo 的一处隐含假设**：[04](./04-FIRST-SLICES-G0-G1.md) 写"真实负控"时默认"同一断言在所有主机上同向"。正确的写法是**断言能力配对，不断言某台机器的能力**——G1-S1 的 FS 负控不受影响（文件系统域没有这种能力分叉），但 G1 里任何 Bash/PTC/PTY 负控都必须照这条改。证据：`docs/plans/memo/m7b1-b4-20261116/README.md` §3c。

### 4.2 `ci-integration` 的 `tinf-instruments` 红：**UNKNOWN**

hosted run `44343691531` attempt 1 的 `test catalog + TINF instruments` 步骤 exit 1；**同一 head 的 rerun 通过**，集合摘要相同（`set=sha256:9ea399ec…`）。红套件名**不在**保留的 job log 里（日志在 2231 行处从中间截断），所以没有"是哪个套件"的结论，也不假装有。

复现尝试（同一 leg、同一 head、同一 set digest）：**10 次顺序运行**全部 exit 0（每次 781 tests / 775 pass / 0 fail / 6 skipped）、**2 条 leg 并发**（96 文件同时）两条都 exit 0 且摘要相同、`--test-concurrency=64`（4× 本机核数）exit 0。repo 被咬过的每一类共享状态都静态扫过：固定端口（无；`port-probe` 只用 `TEST_PORT_RANGES` 内已证明空闲的端口，`m7a-real-slice-unit` 听 0）、固定 `/tmp` 路径（无写入；`a5sf-assembly` 只在拒绝断言里把它当**配置字符串**）、repo 内 tracked 路径写入（无；`binding-digests` 只碰 `.artifacts/tmp/` 下 gitignored 暂存并在两行后恢复）、`git status` 类（本 leg 不 live）、墙钟断言（`tinf-timing` 只断合成报告）。

**结论**：`UNKNOWN` ——未修复，也**未归咎于任何东西**。残余疑点**只作为疑点**记录：hosted 步骤在约 4 核共享 runner 上按 node 默认文件并发跑同一批 48 文件，本机 16 核复现不出负载相关竞态。能确定的是：不是确定性产品缺陷（同 head rerun 通过、摘要相同）。transcript：`dev/agent-workflow/evidence/hosted-l2-20261118/flake-hunt.txt`。

**这条证伪的是"门禁绿 = 该 leg 可靠"**。所以 [04](./04-FIRST-SLICES-G0-G1.md) 的 G1-S4 要求"基线自身有'改语义必须红'的负控"，理由现在更硬：一个偶发红的 leg 既可能掩盖真回归，也可能把真回归洗成 flake。

### 4.3 与 memo 设计不一致的三处（记录，不改写）

| 实现选择 | memo 原写法 | 为什么这样选（落地理由） |
|---|---|---|
| 五个 host-dependent 套件进 **`ci-census` 3 条新 leg**（该层 5→8） | 没有点名放哪一层；G1-S4 只要求"能跑" | 它们**需要被 provisioning 的宿主**；`tinf-instruments` 属于 host-free 的 `ci-integration`，塞进去会把该层的 `hostFree` 声明变成谎。`tinf-instruments` 保持 50 个套件不动 |
| P3 网络臂改为**能力配对**（`enforced`/`unsupported` 两向） | [04](./04-FIRST-SLICES-G0-G1.md) 写的是"真实负控"，默认单一断言同向 | hosted ABI v8 证明同向断言是机器特定的（§4.1）；配对才是合同 |
| `excludes` 由 `dev/ci/excluded-baseline.json`（9）+ `--max-excluded` 收紧 | memo 只提 `--max-uncollected 48` | 排除是"不执行"的第二条通道，只卡未收编数会漏掉它：`EXCLUDED_NEW`/`EXCLUDED_GREW` 现在是阻塞，每个排除行带 reason + review trigger，文件由工具生成、禁止手写 |

一处**不是**偏差而是按 memo 执行：端口按代际分带，实现方式是把 `HOST_PORT_BANDS` 收窄成 `[[3181,3199]]` 并新增 `NEXT_HOST.portBands=[[13000,13049]]`（legacy 不再溢出到第二段），`tests/next-host` 与 world-factory 的端口腿双向断言——正是 [01](./01-BASELINE-REFRESH.md) H-3 / [03](./03-RULINGS-AUTHORITY-BINDING-SETTLEMENT.md) R1.2 要求的"显式裁决 + G0-S1 改动，不是常量微调"。

## 5. 验证记录（我自己跑的命令与输出，不引用他人结论）

| 事实 | 命令 | 结果 |
|---|---|---|
| rc.5 tag 存在且指向该 commit | `git ls-remote --tags https://github.com/deepseek-ai/deepseek-harness 'dsh-v0.2.2*'` | `9c2670d3bce5275e0d1610272958121af87787bb refs/tags/dsh-v0.2.2-rc.5`（同输出 rc.3 = `38a6a5c9…`） |
| 该 tag 是 commit（无 tag object 剥离层） | `gh api repos/deepseek-ai/deepseek-harness/git/matching-refs/tags/dsh-v0.2.2` | 7 个 `dsh-v0.2.2*` ref，全部 `"object":{"type":"commit"}` |
| 本仓 `origin` 不带这些 tag | `git ls-remote --tags origin` | 9 行，无任何 `dsh-v*` ⇒ 基线核对**只能**对上游做 |
| rc.3→rc.5 改动面 | 两个 tag 的本地 blobless diff | 448 条路径 / 13 commit，`behind_by=0` |
| 落地后的第二棵宿主 pin | `tests/paths.mjs`（`NEXT_HOST`，L214+） | `treeRel: tests/deepseek-harness-next`、`homeSuffix: '-next'`、`portBands: [[13000,13049]]` |
| 端口分带被断言 | `tests/next-host/boot.test.mjs:61-68,83-87` | `legacy=3181-3199(19) next=13000-13049(50) overlap=0`；boot 端口落在 13000–13049 |
| 本地重建被拒 | `tests/next-host/host-next-lib.mjs:123` | `pinned native asset … is DRIFTED: <sha> … re-provision with … --from-package --host next` |
| 排除通道被收紧 | `dev/ci/excluded-baseline.json` + `scripts/test-catalog.mjs` | `excluded_count: 9`；`EXCLUDED_NEW` / `EXCLUDED_GREW` 为阻塞码 |
| 收集口径 | `node scripts/test-catalog.mjs --max-uncollected 48 --max-excluded 9` | `tests=875 … UNCOLLECTED 41 … refused=0 findings=0`（census 层 8 条 leg） |
| 观测窗口 | `tests/world-factory/lib/m7b1-observation-contract.mjs` | 拒绝码 `IDENTITY_MISMATCH`/`WITNESS_NOT_SEALED`/`WINDOW_NOT_CLOSED` 在册 |
| 当前 master | `git fetch origin master && git rev-parse origin/master` | `f46bcdd2944a0f055f03cf951714303ecb85fd2b` |

## 6. 本包提交时的门禁输出（原文）

```
node scripts/docs-sync.mjs --check
  docs:sync --check: docs=189 notes=4 plans=148(0 declaring) findings=0 blocking=0 contracts=20 pairs compared
node scripts/test-catalog.mjs --max-uncollected 48 --max-excluded 9
  UNCOLLECTED 41 … DSH-TEST-CATALOG tests=875 digest=sha256:df24c182474a0bfd8ef506a3a61c412a763075e882f7f03e8cd08c6a9d4cb198 refused=0 findings=0
node scripts/dispatch-tests.mjs --check
  DSH-TEST-DISPATCH-CHECK mode=inspect PASS legs=18 bad=0
node scripts/eb3-ci-required.mjs
  EB3-CI-REQUIRED pass workflows=10 findings=0
node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt
  baseline …: 76 distinct; new 0, resolved 0
git diff --check
  （空）
```

（本包只加/改 Markdown，因此这些是**唯一**能自证的部分；rc.5 的运行时行为来自 #787 的 hosted 证据，不是本 PR 重跑。）

## 7. 给 owner 的四句话

1. **基线可以钉死了**：`dsh-v0.2.2-rc.5` = `9c2670d3bce5275e0d1610272958121af87787bb`，上游 lightweight tag，两次独立通路复验；**且 #787 已经把它变成 `tests/deepseek-harness-next` 这棵真实存在、能 boot 的第二棵 pin 树**（不再只是提案）。
2. **rc.3→rc.5 对 UTE 只真正碰到两处**：Web 搜索按模型路由选 provider（`WebSearchRequest.llmProvider`），以及 refusal 路径要求"执行事实的写入不依赖回合收尾"；ToolsService / Executor / Pipeline / `ResolvedToolSet` / Batch **源码零改动**。
3. **三条裁决里两条已有实物、一条仍是纸面**：R1（宿主基线）由 #787 行使；M7-B1 观测窗口由 #786 行使（hosted `M7B1-ARM inside-authorized verdict=SATISFIED`）；S1/S2 与 R3（Fork 例外）**仍未实现/未裁决**——S1 在 G1-S3，R3 等 owner 把条文写进 `AGENTS.md`。
4. **G1 已获授权开工（prototype，不是生产替换）**：owner 裁决见 §1；下一刀是 G1-S1/S2/S3（G0-S1/S2 已落地）。退役旧工具族仍要等 G1-S4 基线；FS 的 PASS 不外推到 Bash/PTC/PTY，**也不外推到 read 轴**——read-confinement 在 (b) 下就是 UNPROVEN；任何跨代能力差异必须按 §4.1 的**配对断言**写，不能钉一台机器的能力。

---

**文档导航**：[本目录索引](./README.md) · [01 基线刷新](./01-BASELINE-REFRESH.md) · [02 接口差量](./02-INTERFACE-DELTA-RC3-RC5.md) · [03 三条裁决](./03-RULINGS-AUTHORITY-BINDING-SETTLEMENT.md) · [04 首批纵切](./04-FIRST-SLICES-G0-G1.md) · [05 范围围栏](./05-SCOPE-FENCE.md) · [06 待主 Agent 执行的补丁](./06-PROPOSED-ACTIVE-PLAN-PATCH.md)
