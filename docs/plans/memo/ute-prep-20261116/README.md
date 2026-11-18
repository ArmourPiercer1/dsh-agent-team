# UTE-Prep — #765 设计基线刷新、接口差量与 G0/G1 首批纵切

**[updated 2026-11-16 UTE-Prep]** 本目录是 PR #765（`docs/plans/memo/unified-tool-execution-dsh-022-20261114/`，11 章 UTE 设计）的**评审前准备包**：把它的宿主基线从 `dsh-v0.2.2-rc.3@38a6a5c` 移到固定 `dsh-v0.2.2-rc.5@9c2670d3`，给出 rc.3→rc.5 的接口差量判定，冻结三条权威边界裁决，并把 G0/G1 拆成可逐个评审的首批 PR。它不是新的设计正本，也不改任何产品/测试/Authority 文件。

> **日期口径**：目录名与 banner 用本任务规定的标签 `2026-11-16`；本目录写盘时实测 `date -u` = `2026-11-18T13:57:51Z`（见 §验证记录）。两者差 2 天，按 `dev/agent-workflow/gates/CLOCK-ANCHOR-20261030.md` 的时钟锚点纪律记录，不做静默对齐。

## 1. 这份准备包回答什么

#765 是"下一版本统一工具执行"的设计草案，外部评估的结论是：**方向可留，基线不可留，门禁不可执行**。具体三件事：#765 钉在 rc.3、而 rc.5 已发布；#765 的三大边界（宿主基线 / 结算保证 / Fork 授权）写成了意图而不是规则；#765 的 G0–G5 是横向大 Gate，没有可单独评审的第一刀。本目录逐条处理，并且**只处理这三件事**——不重写 UTE 的架构主张。

| 文件 | 内容 | 对应 #765 章节 |
|---|---|---|
| [01-BASELINE-REFRESH.md](./01-BASELINE-REFRESH.md) | 固定 tag+commit 的验证记录；第二棵 pinned 宿主树的共存规则 | README §技术基线、[十](../unified-tool-execution-dsh-022-20261114/10-IMPLEMENTATION-GATES.md) §1 |
| [02-INTERFACE-DELTA-RC3-RC5.md](./02-INTERFACE-DELTA-RC3-RC5.md) | rc.3→rc.5 逐区差量：模型响应、Web/Search 默认、版本管线、ToolsService/Pipeline 面 | [三](../unified-tool-execution-dsh-022-20261114/03-EXECUTION-FLOW.md) §2、[五](../unified-tool-execution-dsh-022-20261114/05-TOOL-ADOPTION.md) §3 |
| [03-RULINGS-AUTHORITY-BINDING-SETTLEMENT.md](./03-RULINGS-AUTHORITY-BINDING-SETTLEMENT.md) | 三条裁决：宿主基线规则 / S1-S2 结算保证分层 / Fork 授权最小例外 | [七](../unified-tool-execution-dsh-022-20261114/07-SETTLEMENT-RECOVERY.md) §5、[九](../unified-tool-execution-dsh-022-20261114/09-INFRASTRUCTURE-FORKS.md) §1 |
| [04-FIRST-SLICES-G0-G1.md](./04-FIRST-SLICES-G0-G1.md) | G0/G1 首批纵切矩阵（接口/文件所有权/验收=代码+真实负控+旧路径对照+退役条件） | [十](../unified-tool-execution-dsh-022-20261114/10-IMPLEMENTATION-GATES.md) §2/§3 |
| [05-SCOPE-FENCE.md](./05-SCOPE-FENCE.md) | 什么**不是** G1 前置、什么**是**；退役顺序禁令 | [十](../unified-tool-execution-dsh-022-20261114/10-IMPLEMENTATION-GATES.md) §1 |
| [06-PROPOSED-ACTIVE-PLAN-PATCH.md](./06-PROPOSED-ACTIVE-PLAN-PATCH.md) | 需要主 Agent 执行的 `ALPHA5-SANDBOX-BACKLOG.md` / `AGENTS.md` 精确补丁（worker 不得改） | — |

## 2. 本包改了什么、没改什么

**改了**（都在 #765 自己的分支上，逐处带 `**[updated 2026-11-16 UTE-Prep]**` banner）：12 章的"技术基线"行（rc.3→rc.5 + Team 文档基线 → `master@b7276ffa`）、[七](../unified-tool-execution-dsh-022-20261114/07-SETTLEMENT-RECOVERY.md) §5 的结算保证分层、[九](../unified-tool-execution-dsh-022-20261114/09-INFRASTRUCTURE-FORKS.md) §1 的 Fork 例外、[十](../unified-tool-execution-dsh-022-20261114/10-IMPLEMENTATION-GATES.md) 的 G0/G1 与范围围栏指针。

**没改**：任何 `docs/plans/active/**`、`AGENTS.md`、`docs/ROUTER_RULES.md`、`docs/TEST_METHODS.md`、`dev/engineering/**`、`scripts/**`、`tests/**`、产品代码。需要改的那两处（`ALPHA5-SANDBOX-BACKLOG.md` 的 B5–B9 归档口径、`AGENTS.md` 的 Fork 禁令例外）以**精确补丁文本**放在 [06](./06-PROPOSED-ACTIVE-PLAN-PATCH.md)，等主 Agent + owner 执行。

## 3. 验证记录（我自己跑的命令与输出，不引用他人结论）

| 事实 | 命令 | 结果 |
|---|---|---|
| rc.5 tag 存在且指向该 commit | `git ls-remote --tags https://github.com/deepseek-ai/deepseek-harness 'dsh-v0.2.2*'` | `9c2670d3bce5275e0d1610272958121af87787bb refs/tags/dsh-v0.2.2-rc.5`（同一输出里 rc.3 = `38a6a5c965aa99ab525161efb7cc5cf1fe62fced`） |
| 该 tag 是 commit（无 tag object 剥离层） | `gh api repos/deepseek-ai/deepseek-harness/git/matching-refs/tags/dsh-v0.2.2` | 7 个 `dsh-v0.2.2*` ref，全部 `"object":{"type":"commit"}`；rc.5 的 sha 同上 |
| 本仓 `origin` 不带这些 tag | `git ls-remote --tags origin` | 9 行，无任何 `dsh-v*` ⇒ 基线核对**只能**对上游做，不能从本仓自证 |
| rc.3→rc.5 改动面 | `git fetch --filter=blob:none` 两个 tag 到临时 bare 仓后 `git diff --name-status rc3 rc5` | 448 条路径；13 个 commit，`behind_by=0`（`gh api .../compare/38a6a5c...9c2670d3`） |
| 发布资产包版本数 | `curl -sS https://registry.npmjs.org/@deepseek-ai%2Fnode-addon-system-linux-x64` | `versions: ['0.1.2']`，`dist-tags: {latest: '0.1.2'}` ⇒ "每个 DSH 发布都有对应资产包"**当前不成立** |
| 当前 Team 宿主基线 | `tests/paths.mjs:70-72` | `DSH_BASELINE_VERSION='0.2.0-rc.2'`、`TEST_USE_BASELINE_SHA='639ed015397290b3745d163aafe02ffee4aa3f84'` |
| 收集口径 | `node scripts/test-catalog.mjs --max-uncollected 48` | `tests=872 … UNCOLLECTED 48 … refused=0 findings=0` |
| census 单一来源 / 4 worker | `scripts/census-invocation.mjs` 头注 + `dev/agent-workflow/SESSION_ROUTER_LOG.md:8990` | `--maxWorkers` 只在此处；hosted `DSH-CI-LEG leg=census verdict=pass seconds=761` |
| M7-A 真实链 | `SESSION_ROUTER_LOG.md:8988` | `M7A-STEP verdict=VERIFIED reason=ARMS_GRADED arms=5` / `M7A-STEP-LEDGER verdict=VERIFIED arms=5 run=43804251634-1` |
| 资产 pin 与宿主 pin 分离的机器规则 | `tests/world-factory/lib/host-sandbox-assets.mjs:780,898,901` | `PACKAGE_PIN_DIVERGES_FROM_HOST_PIN` |
| 文档/pin 纪律的门 | 见 §4 | 全绿 |

## 4. 本包提交时的门禁输出（原文）

```
node scripts/docs-sync.mjs --check
  docs:sync --check: docs=187 notes=4 plans=146(0 declaring) findings=0 blocking=0 contracts=20 pairs compared
node scripts/test-catalog.mjs --max-uncollected 48
  UNCOLLECTED 48 … DSH-TEST-CATALOG tests=872 … refused=0 findings=0
node scripts/dispatch-tests.mjs --check
  DSH-TEST-DISPATCH-CHECK mode=inspect PASS legs=18 bad=0
node scripts/eb3-ci-required.mjs
  EB3-CI-REQUIRED pass workflows=10 findings=0
node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt
  baseline …: 76 distinct; new 0, resolved 0
git diff --check
  （空）
```

（这些是仓库在 `origin/master@b7276ffa` 上的既有门禁，本包只加 Markdown，因此它们保持绿是**唯一**能自证的部分；rc.5 的运行时行为本包没有执行，见 [02](./02-INTERFACE-DELTA-RC3-RC5.md) §末 UNKNOWN。）

## 5. 给 owner 的三句话

1. **基线可以钉死了**：`dsh-v0.2.2-rc.5` = `9c2670d3bce5275e0d1610272958121af87787bb`，上游 lightweight tag，我复验过两次（ls-remote + refs API），本仓 `origin` 不带该 tag。
2. **rc.3→rc.5 对 UTE 只真正碰到一处**：Web 搜索从"配置里钉一个 provider"变成"按模型路由选 provider"，并且 `WebSearchRequest` 多了一个 `llmProvider` 字段；ToolsService / Executor / Pipeline / `ResolvedToolSet` / Batch **源码零改动**（只有 380 个 `package.json` 的版本号 + 一个生成式 API catalog 文案）。所以 [五](../unified-tool-execution-dsh-022-20261114/05-TOOL-ADOPTION.md) §3 必须补这条转发义务，其他章节不动。
3. **G0/G1 的第一刀是"第二棵宿主树 + 一次可复现的 rc.5 空载启动"，不是任何产品代码**；退役旧工具族必须等到旧路径有可运行回归基线之后，且 FS 的 PASS 永不外推到 Bash/PTC/PTY。

---

**文档导航**：[本目录索引](./README.md) · [01 基线刷新](./01-BASELINE-REFRESH.md) · [02 接口差量](./02-INTERFACE-DELTA-RC3-RC5.md) · [03 三条裁决](./03-RULINGS-AUTHORITY-BINDING-SETTLEMENT.md) · [04 首批纵切](./04-FIRST-SLICES-G0-G1.md) · [05 范围围栏](./05-SCOPE-FENCE.md) · [06 待主 Agent 执行的补丁](./06-PROPOSED-ACTIVE-PLAN-PATCH.md)
