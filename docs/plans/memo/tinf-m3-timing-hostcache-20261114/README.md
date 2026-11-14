# TINF M3 — harness 级计时 + Host 缓存键/校验（**未启用缓存**）

> Dated: 2026-11-14 · Status: **IMPLEMENTED (draft PR)** · 设计正本：`docs/plans/memo/agent-testing-infrastructure-20261114/08-BUILD-CACHE-AND-PROVENANCE.md`（§1/§3/§4/§6）与 `12-INVARIANTS-AND-NEGATIVE-CONTROLS.md`
> 前置：M0（`scripts/census-profile.mjs`，PR #768）给出 Actions step 级中位数并**明写**「九 root 分解需要 harness 级计时（M3）」；M1（PR #769）给出 catalog；M2（PR #770，merged `b471224a`）给出 oracle。

## 1. 一句话

M3 交付**两半、都不上线**：**(A) 把 census 内部按 root 的耗时第一次变成可读的行**（`scripts/tinf-timing.mjs`，接进 `ci-pr-gate.mjs` 的 census 路径，**shadow**）；**(B) 把 Host 缓存的前提条件做出来并做成可拒绝的**（`scripts/host-cache-key.mjs`：强键 + 对制品的**校验**，不是对键字符串的信任）。

**缓存没有打开**。没有任何 `actions/cache` 读写步骤，没有任何 CI 路径读取键，没有任何东西因为本 PR 改变「跑什么」。设计正本的说法是「先量化、再影子对照验证、最后切换」；本 PR 只完成第一步，并要求第二步以本 PR 的行数据为依据。

## 2. 测到了什么 vs 仍然未知

| | 现在由谁测 | 状态 |
| --- | --- | --- |
| job 总墙钟、每个 **Actions step**（Host provision/build、repo build、安全 suite、census） | `scripts/census-profile.mjs`（M0，jobs API 的 `started_at/completed_at`） | 已有：n=3 样本 census p50 1100 s（77%）、host build 272 s（19%）、job p50 1427 s |
| **census 那一个 step 内部按 root 的耗时** | `scripts/tinf-timing.mjs`（M3） | **本 PR 新增**：每次 capture 一行 `census-capture` + 报告里出现的**每个** root 一行 `census-root`，落在 `census-transcripts/tinf-timing.tsv` 并随既有 artifact 上传 |
| gate 的**每个 leg** | 同上（`phase=leg`） | 新增；`--only census` 时只有 `census` 这一个 leg 行 |
| cold / warm | **无人测** | 行里没有热标签，报告**明写不分组**，不从 `attempt` 猜（见 §4） |
| 缓存命中率 / runner-minute 节省 | **无人测** | 缓存未启用，没有命中可测；这正是「先量化再切换」要等的东西 |

**仍然未知（本 PR 不解决，也不假装解决）**：单次 hosted run 的 root 分解还没有真实样本——本 checkout **没有** pristine host（`tests/deepseek-harness-test-use` 不存在）也没有 `node_modules`，`vitest run` 在这里跑不起来，所以本 PR 只用「合成 report + 真实 recorder」验证了链路（证据见 §9）。第一次真实数字来自本 PR 合并后第一个 Ready 轮。

## 3. 计时器：TSV schema 与 API

`tinf-timing/1`，一行一个 phase，制表符分隔，**恰好九列**：

| 列 | 含义 | 约束（违反 = 整份文件按行号拒绝） |
| --- | --- | --- |
| `schema` | 恒为 `tinf-timing/1` | 其它值 → `BAD_SCHEMA` |
| `run_id` | 调用方的 run 标识（gate 用 `<stamp>-<pid>`） | 非空 |
| `phase` | `leg` / `census-capture` / `census-root` | `[a-z][a-z0-9-]*` |
| `root` | leg 名 / `nine-roots`（capture 行沿用既有名字）/ 报告里出现的 root 目录（`packages/<pkg>`，含嵌套包根） | 非空 |
| `attempt` | 1 起的 capture/重采样序号 | 正整数 |
| `started_at` | ISO-8601 UTC 墙钟（**只是时间戳，不是时长来源**） | `...Z` 且可解析 |
| `duration_ms` | 非负整数毫秒；`time()` 用 `process.hrtime.bigint()`，**不用 `Date.now()` 算时长** | `^\d+$` |
| `status` | `ok` / `failed` | 其它 → `BAD_STATUS` |
| `identity` | `key=value` 以 `;` 连接（`host_commit` / `product_merge_tree` / `head`）；值 percent-encode | 单值内不可能出现 tab/换行 |

库 API（`ci-pr-gate.mjs` 用的就是这套）：

```js
import { createTimer } from './tinf-timing.mjs'
const timer = createTimer({ dir, runId, identity })   // dir 为 null = 静默 no-op（默认 run 不写文件）
timer.time('census-capture', 'nine-roots', fn, { attempt })  // 同步 fn 保持同步；throw → 记 failed 并 re-throw
timer.record({ phase: 'census-root', root, attempt, startedAt, durationMs, status })  // 调用方自己量的行
const { path, rows, warnings } = timer.flush()        // 幂等；**永不 throw**
```

**写不进去不是红 census**：`createTimer` 在构造时 `mkdirSync` 失败 → `path=null` 并记 `TIMING_DIR_UNWRITABLE`；写失败 → `TIMING_WRITE_FAILED` 并停止重试。gate 把 warnings 打成一行 `[tinf-timing] WARN …`，**只此而已**：不改 verdict、不改 exit code、不改 token、不改顺序。

## 4. root 行是**推导**的，不是包住一个循环（偏差 1）

设计稿说「per root（census root loop）」，但真实代码里**没有 root 循环可以包**：所有 root 在**一次** `vitest run` 里并发执行（根 `vitest.config.ts` 的 include 是 `packages/<pkg>/test/**` 加两条 lane 目录，其注释原文：*"the census single-capture runs nine package roots concurrently"*；注意这句话本身也不精确——include 同时覆盖 `packages/runtime/controlled-fs` 和 `packages/tools/a5p5-tools` 两个嵌套包根，实测出现 **11** 个 root）。在进程里为不存在的循环记 hrtime，等于发明一个测量。

所以诚实的版本是：

- 每次 capture 用 `time()` 包住**真实的 vitest spawn**（`phase=census-capture`，monotonic）；
- 每个 root 的行从**这次 capture 的 vitest JSON report** 推导（`phase=census-root`）：该 root 下所有文件的 `max(endTime) - min(startTime)` 即它的**窗口**。`testResults[].startTime/endTime` 是 vitest reporter 自己写的字段，本仓库 vitest 4.1.11 实测存在（在主 checkout 跑一次 `--reporter=json` 读到的形状：`name/startTime/endTime/status/assertionResults`）。
- 因此：**root 行与 capture 行是两种量级的东西**，`summarize` 明说这一点——root 的 share 是「占 capture 中位数的百分比」，因为窗口互相重叠，**加总可以超过 100%**；`census-root` 行在 phase 表里 share 显示 `n/a`，不参与分母（否则就是重复计数）。
- 一个 root **没有可读 span** → 该行 `status=failed`，**不是 0 ms 的 ok**；不可读的 report 让整个推导跳过并记 warning，**不影响 leg**。
- `rootOf()` 从 `/packages/` 锚点取名字（`packages/domain`），因为 vitest report 里是绝对路径——不锚定的话同一套件的 root 名会带 runner 的 `/home/runner/work/...` 前缀，跨 run 不可比。**取第一个** `/test/` 段而不是最后一个：`packages/domain/test/fixtures/test/a.test.ts` 属于 `packages/domain`（取最后一个会发明一个 `packages/domain/test/fixtures` root）；lane 目录稳定成 `tests/<lane>`，不会退化成绝对路径。
- **不是「九个」root**：根 `vitest.config.ts` 的 include 同时覆盖嵌套包根（`packages/runtime/controlled-fs`、`packages/tools/a5p5-tools`），所以真实报告会给出 11 个 root。本工具报告**它实际看到的数量**（`census_root_count`），notes 里也写明这一点——把「九」写死就是第二轮审查抓到的错误。
- **`status != ok` 的行永远不被当成耗时**：它从所有统计里剔除，并按名字列进 `failed_rows`（`--json`）与 `failed rows` 段（文本）；一个只有失败窗口的 root 显示 `(FAILED: no readable span in N attempt(s))`，绝不显示成 `0 ms`。

## 5. 精确 CLI 用法

```bash
# 计时
node scripts/tinf-timing.mjs --summarize <dir-or-tsv> [...] [--json]
node scripts/tinf-timing.mjs --self-test          # 26 cases，pin 自己的 parser/拒绝集/算术

# 生成 sidecar（gate 已接，无需手跑；census leg 有 --transcript-dir 时才写）
node scripts/ci-pr-gate.mjs --full --only census --census-captures 2 \
  --transcript-dir "$RUNNER_TEMP/census-transcripts"
node scripts/tinf-timing.mjs --summarize "$RUNNER_TEMP/census-transcripts"

# 缓存键 / 记录 / 校验
node scripts/host-cache-key.mjs --key [--repo-root DIR] [--host-dir DIR] [--json]
node scripts/host-cache-key.mjs --record --dir DIR --expect KEY_JSON    # 产出侧：写 host-artifact.json
node scripts/host-cache-key.mjs --verify --dir DIR --expect KEY_JSON [--json]
node scripts/host-cache-key.mjs --self-test        # 13 cases
```

退出码：计时器 `0` 报告 / `2` 具名拒绝（`NO_INPUT_PATHS`、`NO_INPUT`、`NO_INPUT_ROWS`、`NO_CENSUS_ROWS`、`BAD_ROW`、`BAD_SCHEMA`、`UNKNOWN_ARGUMENT`）。缓存键 `0 OK` / `1 INFRA_ERROR` / `2 REFUSED`（必需 fact 推不出来）/ `3 MISS`。

## 6. Host 缓存键：九个字段、**两层**，每个都从真实文件/对象来

**审查修正（重要）**：第一版把九个字段一起哈希成「host key」。但 spec §3/§4 说 Host 缓存按 **Host identity** 命中、Product 缓存才携带 merge tree——把 `product_merge_tree`/`product_lock_digest` 混进 host 键，意味着**每个 PR 的 host 都不可能复用**。现在输出三个值：

| 值 | 字段 | 用途 |
| --- | --- | --- |
| `host_key` | platform / node_version / pnpm_version / host_commit / host_lock_digest / host_build_flags_digest / toolchain_config_digest | **Host 层可共享的那把键**（未来 Host 缓存按它命中） |
| `product_key` | product_merge_tree / product_lock_digest | Product 层 |
| `key` | 九个字段的复合摘要 | 记录用，以及「这个 host 配这个树」的精确断言 |

`verifyHostArtifact` 用 `host_key` 判定「是不是同一个 host」，因此同一个 host 可以被另一个树的验证接受；`key` 只在调用方显式提供时作第二道核查。另外：**dirty host 被拒绝**（`HOST_CHECKOUT_DIRTY`）——只查 HEAD 会把“在 pin 上但工作树脏”的字节当成 pin 的字节。

**键 = `sha256:` over canonical（键名排序）JSON of 下面九个字段**。字段顺序不可能改变键；**任何单个字段变化一定改变键**（九项逐一有测试）。

| 字段 | 来源（读，不抄） | 为什么在键里 |
| --- | --- | --- |
| `platform` | `process.platform`-`process.arch` | 原生二进制（node-pty/esbuild/koffi）是平台产物 |
| `node_version` | `process.version`（精确） | 原生 addon 绑 ABI |
| `pnpm_version` | 本仓 `package.json#packageManager` 的 `pnpm@…` | 决定 node_modules 形状的安装器 |
| `host_commit` | `tests/paths.mjs` 的 `TEST_USE_BASELINE_SHA`（40-hex 校验；另有 `.git` 存在时核对 HEAD = pin，漂移即 `HOST_CHECKOUT_DRIFT` 拒绝） | 唯一宿主 pin，读它才不会产生第二份会漂的 pin |
| `host_lock_digest` | Host 树 `pnpm-lock.yaml` 的 sha256 | 同 commit 下的 lock 变化（fork patch/本地安装）就是不同依赖 |
| `host_build_flags_digest` | `census-runtime.yml` 里 **Host build 那一步的 step 文本**（env + build 命令；注释与空行剔除）的 sha256 | flag 是产物的一部分：不带 `DSH_CLIENT_COMMIT_HASH` 的构建是另一棵树 |
| `product_merge_tree` | `git rev-parse HEAD^{tree}`（**tree 不是 commit**：同树的 rebase 应当同键） | 合成的 merge tree 才是被测的输入 |
| `product_lock_digest` | 本仓 `pnpm-lock.yaml` 的 sha256 | 依赖图变了，产物就不能复用 |
| `toolchain_config_digest` | canonical JSON 的 sha256：`tsconfig.base.json` 摘要 + node/pnpm 版本 + 两条 build step 的摘要 | 编译器设置/构建链变了，产物可能变，而源码没动 |

**推不出来就拒绝（exit 2），绝不填占位符**：一个 `"unknown"` 会让两件不同的制品共用一个键——那比没有键更危险。拒绝信息逐个点名 fact 与它找过的路径。

## 7. 校验：检查什么，**不能**检查什么

`verifyHostArtifact({dir, expect})` 的三种判决：

| 判决 | 含义 | 触发 |
| --- | --- | --- |
| `OK` | 入口在、身份一致、文件数与树摘要与记录一致 | 全部通过 |
| `INFRA_ERROR` | 制品在，但**不可信** | 入口缺失/不是文件；`host-artifact.json` 缺失或不可读；`host_commit`/`host_lock_digest`/`toolchain_config_digest`（以及给了 `key` 时的整键）与期望不符；文件数不符；树摘要不符；**期望本身缺 fact**（缺期望 ≠ 任何制品都匹配） |
| `MISS` | 制品目录不存在 | 非绿，但与 `INFRA_ERROR` **不同路径**：一个说「去构建」，一个说「找到的东西不许用，先查为什么」（§6 的明确区分） |

树摘要 = 递归清单 `类型\t相对路径\t大小\tsha256`（符号链接记 target），清单头 `host-artifact-manifest/1`，再 sha256。`.git` 与 `host-artifact.json` 本身被排除（git 元数据是来源存储不是制品内容；清单不能把自己算进去，否则记录一次就改一次摘要）。

**它不能证明的（写窄）**：
1. **不能证明产物是从那个 commit 构建出来的**。它只证明「记录的身份 = 期望的身份」+「字节 = 记录的摘要」。同时改写 `host-artifact.json` 与树的人可以通过全部检查——摘要是摘要，不是签名。它是 §4 的**生产者信任**检查（可信 push 构建是生产者，低信任 PR 只读），不是来源证明。
2. **不能证明可运行/可安装**（§3 的「可安装性」是另一件事：真 boot 或真 install）。
3. 不含 `.git`，所以 `.git` 被篡改不在本检查范围内（其身份由记录的 `host_commit` 承担）。
4. 不覆盖「跨 PR 复用 PASS 结果」这类语义问题——那由 §5 的规则禁止，本文件不提供任何结论复用。

## 8. Shadow 状态（**没有启用缓存**）

- 计时：只在 census leg **带 `--transcript-dir`** 时写 `tinf-timing.tsv`（CI 的 census step 就是这个形态）；默认本地 run 一个字节都不多写。写不进目录 = warning 行。**没有任何 gate 读这个文件**，`--check-transcript` 的判据不变，`ci-required` 判的东西不变。
- workflow：`census-runtime.yml` 的既有 Upload step（`if: always()`）路径里**显式**加了 `census-transcripts/tinf-timing.tsv`；**没有**新增 Required context、**没有**改 concurrency、**没有**动 `ci-required` 的 job 集合。`scripts/eb3-ci-required.mjs` = `pass workflows=10 findings=0`。
- 缓存：**零 `actions/cache` 步骤**，零读取键的代码路径，零行为改变。`--record` / `--key` 只是 CLI，CI 不调用。

## 9. 未做（明确列出）

1. **没开缓存**，也没做「影子对照」（同一 commit 有/无缓存的两轮对照）——那是切换前的第二步。
2. **没测 cold/warm**：行 schema 不带热标签，报告因此**拒绝分组**。要测就得先在 schema 里加一个明确的标签列（`tinf-timing/2`），不是从 `attempt` 猜。
3. **没在 CI 里计 host provision / host build / repo build / 安全 suite**：它们是好几个 **workflow YAML step**，不在写行的那个进程里。**不假装**：`--only census` 的 gate 进程看不到它们；它们的时间由 M0 的 `census-profile.mjs` 从 Actions step API 读。census 那个 step 内部的分解由本 PR 补上——两者互补，不重叠。
4. **没有把 root 行做成 hrtime span**（原因见 §4；所有 root 并发在一次 vitest 里）。
5. **没有真实的 hosted root 分解样本**：本 checkout 无 pristine host、无 `node_modules`，`vitest run` 无法执行。演示用的 report 是合成的，行是真实 recorder 产的（见下）。
6. 没有改 Authority / Candidate / release 状态 / 三个 Required contexts / 保护规则；`packages/**` 零改动（p4t6 booking 不需要）。
7. 没有新增/删除任何名测试名单（M6 才退役它们）；新套件按 M1 的既有模式接在**同一个** ci-integration leg 与**同一个** manifest `check[]` 里。

## 10. 偏差（带证据）

| # | 设计稿说法 | 真实代码 | 本 PR 的处理 |
| --- | --- | --- | --- |
| 1 | 「wrap per root（census root loop）」 | **没有 root 循环**；所有 root（实测 11 个，含两个嵌套包根）在一次 `vitest run` 里并发（`vitest.config.ts` 注释原文 + include 只有一条 `packages/<pkg>/test/**`） | 每 root 一行，但**从该次 capture 的 report 推导窗口**；行留在 `phase=census-root`，报告明说重叠、share 可超 100%、不参与 phase 分母。证据：`scripts/tinf-timing.mjs` 头注 + §4 |
| 2 | 「cold vs warm-ish 分组」 | 行 schema 里没有热标签 | **不分组**，报告打一行 `cold/warm: NOT distinguished`。要分组先升 schema |
| 3 | 「缓存照 §3 的字段」 | 本 checkout 无 pristine host，`host_lock_digest` 推不出来 | `--key` 在真实仓库上**拒绝并点名 `host_lock_digest`**（证据 `evidence/tinf-m3-20261114/host-key-refused-no-host.txt`）；用 `--host-dir` 指向合成宿主树演示完整键 |
| 4 | 「actions/cache」推进 | 本 PR 明确不做 | 见 §8；提交信息同样声明 |

## 11. 回滚

删除即回滚，无需迁移：

1. `scripts/tinf-timing.mjs`、`scripts/host-cache-key.mjs` 与两个 `*.test.mjs`；
2. `scripts/ci-pr-gate.mjs`：一处 import、`runStamp`/`timingIdentity`/`createTimer` 块、leg 循环里的 `timing.time(...)` 包装、census capture 的 `ctx.timing.time(...)` 与 `rowsFromVitestReport` 块、`finally` 前的 flush、`ctx.timing`；
3. `.github/workflows/census-runtime.yml`：Upload step 里那一行 path（目录项本来就会带上 tsv，删掉只是失去显式声明）；
4. `.github/workflows/ci-integration.yml`：run 行里两个文件；
5. `dev/ci/eb3-ci-manifest.json`：本 leg `check[]` 的两个文件（leg id/why 可一并回退）；
6. 本 memo 与 `SESSION_ROUTER_LOG.md` 的本条（日志只追加：回滚新开一条说明，不改历史）。

计时是 shadow，所以 1+2+3 任意一行残留都不会改变任何 verdict；缓存从未启用，所以回滚没有缓存残留需要清理。

## 12. 门禁（本 head 实测）

| 门 | 结果 |
| --- | --- |
| `node --test scripts/tinf-timing.test.mjs scripts/host-cache-key.test.mjs` | `tests 46 / pass 46 / fail 0`（23 + 23；三轮审查共新增 10 个） |
| `node scripts/test-catalog.mjs --max-uncollected 91` | exit 0，`tests=862`（`DISCOVERED_AND_COLLECTED 757` / `UNCOLLECTED 91`），`digest=sha256:1b2f3bc521f8b4ea6599b24c030a55f52c5dfc0b69d127c5f41e88456968be46` |
| `node --test scripts/test-catalog.test.mjs` | `19 / pass 19 / fail 0`（未改动） |
| `node --test scripts/tinf-m0.test.mjs` | `13 / pass 13 / fail 0`（未改动） |
| `node scripts/census-profile.mjs --self-test` | `PASS cases=8` |
| `node scripts/tinf-timing.mjs --self-test` | `PASS cases=26` |
| `node scripts/host-cache-key.mjs --self-test` | `PASS cases=13` |
| eslint（5 个文件：两个新脚本 + 两个测试 + `ci-pr-gate.mjs`） | 0 problems |
| `node --check` 每个新文件 | ok |
| `scripts/eb3-ci-required.mjs` | `pass workflows=10 findings=0` |
| `scripts/docs-sync.mjs --check` | `findings=0 blocking=0` |

## 13. 证据（`dev/agent-workflow/evidence/tinf-m3-20261114/`）

| 文件 | 是什么 |
| --- | --- |
| `demo-timing-generation.mjs` | 用**真实** `createTimer`/`rowsFromVitestReport` 从**合成** vitest report 生成 3 roots × 2 attempts 的行（脚本内注明了合成的原因） |
| `tinf-timing.tsv` | 上述脚本产出的真实 TSV（8 行：2 capture + 6 root） |
| `summarize-demo.txt` | `--summarize` 的真实输出（含 share 重叠与 cold/warm 声明） |
| `host-key.json.txt` | `--key --host-dir synthetic-host --json` 的真实输出（九个字段 + 键） |
| `host-key-expect.txt` | 同一份键作 `--expect` 输入 |
| `host-key-refused-no-host.txt` | **真实仓库**上 `--key` 的拒绝：`HOST_CACHE_FACT_MISSING: host_lock_digest`（无 pristine host） |
| `host-record.txt` / `host-verify-ok.txt` | `--record` 与 `--verify` 的 OK 转录（**合成宿主树**，非真实构建产物） |
| `host-verify-tampered.txt` | 一字节改动 → `INFRA_ERROR / CONTENT_DIGEST_MISMATCH` |

**关于「真实 host 树」**：`tests/deepseek-harness-test-use` 与 `/srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness` 在本环境**都不存在**，所以 `--verify` 只能对**合成树**跑（已在上面标注）。真实宿主树上的校验留给切换前的第二步。

## 11. 独立审查（第一轮 CHANGES REQUIRED → 本轮修正）

第一轮独立审查在 head `e5465a3b1` 给出 **CHANGES REQUIRED**，两条 blocking 都是真的：

1. `rootOf` 用的是**最后**一个 `/test/` 段，且文档把「九 root」写死。修正见 §4：第一个 `/test/` 段、报告实际数量、并补了 fixture 路径 / 嵌套包根 / lane 目录三个断言。
2. `summarize` 丢掉了行的 `status`：`status=failed` 的 root 会渲染成 `0 ms / 0%`，正是文件头自己宣称拒绝的「零秒答案」；`--json` 里也没有失败字段。修正：失败行从所有统计中剔除、按名字surface（`failed_rows`）、root 表显示 `FAILED`，并有专门测试。
3. 非阻塞但同轮修掉：host/product 键混在一起（见 §6）、dirty host 只查 HEAD（见 §6）、`host_lock_digest` 缺敏感性测试（现在有「lock 改一字节 → digest 与 host_key 都变」的用例）、`summarize` 对字符串 duration 做 `+` 会拼接（现在入口统一 `Number()`）。

## 12. 第二轮审查（再 CHANGES REQUIRED）与修正

第二轮在 `def4327cc` 又给 **CHANGES REQUIRED**，其中一条 blocking 是我上一轮漏改：

1. **blocking**：`baseSum`（share 的分母）仍然只按 phase 过滤、并且对字符串 duration 做 `+`。复现：一个 ok capture 1000 ms + 一个 failed leg 1000 ms → capture 的 share 显示 50%（应为 100%）；用字符串时更糟，分母变成 `'010001000'` → share 显示 0%。现在分母与分子用同一组「status=ok 且可转数字」的行，并有专门回归测试（ok + failed → 100%）。
2. 非阻塞已修：
   - `rootOf` 对**非 census 布局**仍会发明 root（`scripts/ci-local.test.mjs` → 自己；绝对路径 → 带 runner 前缀的目录；`tests/kits/mykit/test/a` → `tests/kits/mykit`）。现在只承认 `packages/…` 与 `tests/<lane>` 两种布局，其余一律 `unknown`；lane 判定优先于嵌套 `/test/`。
   - **不同 host 曾被接受**：只给最小 expectation（三个 digest/commit 字段）时，darwin 产物能验证为 linux host。`platform` 与 `node_version` 现在进入 `IDENTITY_FIELDS`，并有 `platform` 不匹配 → `INFRA_ERROR` 的测试。
   - 「dirty host 被拒绝」此前是**只有代码、没有测试**（测试仓库不在 pin 上，drift 先触发）。加了 `hostPinOverride` 测试缝：先证明 off-pin → `HOST_CHECKOUT_DRIFT`，再把 pin 指到测试仓库自己的 HEAD、弄脏工作树 → `HOST_CHECKOUT_DIRTY`。
   - 「九 root」措辞在源码头注/测试/本 memo 残留处全部改掉（报告的 root 数量是实测值，不是常量）。

## 13. 第三轮审查（再 CHANGES REQUIRED）与修正

第三轮在 `b3a6660b4` 又给 **CHANGES REQUIRED**，blocking 仍是「失败行漏进统计」，这次在 **token 行**：

1. **blocking**：`verdictToken` 用 `top?.median_ms ?? 0`，一个只有失败窗口的 root 会把 `top_median_ms` 写成 `0`（而表格里已显示 FAILED），于是人手 grep 的那一行又变成「零秒答案」。现在 null → `n/a`，token 里还带 `failed_rows=N`，并有测试禁止 `top_median_ms=0` 出现。
2. 非阻塞已修：
   - `census_attempts` 不再把「只有失败行」的 attempt 算成已测量的 capture attempt。
   - 直接调 `summarize()` 传入 `status=ok` 但非数字的 duration（`'fast'`）→ 按失败行处理，不再产生 `NaN`。
   - `rootOf` 的 lane 判定改用**最后**一个 `/tests/`：`/home/runner/work/tests/repo/tests/checks/x.test.ts` 仍解析为 `tests/checks`，不会被前缀里的 `tests` 劫持。
   - 测试头注里的「nine-root」措辞一并清除。
3. 审查确认已修好的部分：baseSum 的 repro（ok 1000 + failed 1000 → 100%）、1102 个文件的 `rootOf` 扫描（24 个 root、0 个越界、27 个 `unknown`）、dirty-at-pin 真正走到 `HOST_CHECKOUT_DIRTY`、`platform`/`node_version` 不匹配 → `INFRA_ERROR`。
4. 仍未直接比较的字段（`pnpm_version`、`host_build_flags_digest`）会经由 `toolchain_config_digest` 与 `host_key` 间接覆盖；审查判定不 blocking，此限制已写在 §7.1。
