# m2-ci-phase-status — evidence（卡 M2-CI-PHASE-STATUS-01）

M2 CI worker 独占目录。HEAD `c978eb2fc`，2026-10-23。零 commit、零 push、零 Host、零端口、零 census、零全 suite；
`scripts/**`、`docs/plans/**`、`dev/agent-workflow/graph.yaml` 对本 worker 零字节。

## 文件

| 文件 | 内容 |
|---|---|
| `p-phase-status-check.md` | **交 CENTER 的精确 patch 提案**：Q9 判则 + 插入锚位 + 全文本 + 失败 detail 文案表 + 落笔清单 + 边界/诚实法 |
| `phase-status-kit.mjs` | 自证 kit：直接执行 patch 文档 §2 的 fenced 块（文档即工件）；镜像/patch parity 机械核对；真实树 pass + 四负例 DSH-CI-LEG fail 原文 + 现 shipped reader 的 gap 原文 |
| `runs/2026-10-23T07-18-17Z/01-legs-baseline-pure-head.txt` | 基线腿（纯 HEAD 提交态）**先红**原文 + 归因（matrix `vitest.json` 文案，CENTER 已在工作树修复，非本卡问题） |
| `runs/.../02-legs-fixed-worktree.txt` | 定点腿 `--only graph-parse --only state-freshness` 现形态 pass（RC=0）原文 |
| `runs/.../03-vitest-a5-current-contract.txt` | 定点 fixture 套件 33/33 绿原文（含 N9 stdout：负例真红 detail + gap `[]`） |
| `runs/.../04-kit.txt` | kit 全量输出（RC=0，KIT VERDICT pass） |

## 只读定位交底（checkCurrentContract 六字段 + 失败上腿通道）

`scripts/ci-pr-gate.mjs`，函数 `checkCurrentContract`（`:283-517`，导出）：

| # | 字段（读取行） | 判则行 | 内容 |
|---|---|---|---|
| 1 | `phase_id`（`:307`） | `:326`（Q2 canonical id 白名单）、`:343-345`（Q1 与 current_phase 措辞一致）、`:492-494`+`:497-501`（Q6 各载体 phase-identity 按值相等、计划正文 当前阶段 Alpha 数字一致） | 阶段身份 |
| 2 | `active_plan`（`:308`） | `:327-331`（Q2 必填/目标存在/必须 `docs/plans/active/` 前缀）、`:485-501`（Q6 载体 ref/identity/正文） | 当期计划指针 |
| 3 | `backlog`（`:309`） | `:327-330`（Q2）、`:351-361`（GROUP C：ready/blocked 必须是 backlog 内真实 B[LR]-NN，phantom 红） | 待办簿指针 |
| 4 | `matrix`（`:310`） | `:327-330`（Q2）、`:363-478`（Q5/Q5a：区域边界标记恰一次且有序；主表 9 格；⑧ 闭集枚举；V@B yes|no；NEEDS_REVALIDATION⇔V@B=no；⑥ 证据路径存在性（`fileExists(裸路径) || fileExists('dev/agent-workflow/'+裸路径)`，`:430`）；附录映射/UNKNOWN 登记） | 能力矩阵指针 |
| 5 | `baseline`（`:311`） | `:335-337`（Q4：40hex、可解析为 commit、=HEAD 或祖先）、`:505-514`（Q7：baseline..HEAD 产品面 drift；有 drift 且有 V@B=yes 行 ⇒ 红） | M0 冻结基线锚 |
| 6 | `baseline_collected`（`:312`） | `:332`（Q2：ISO8601Z） | 基线采集时间戳 |
| 横切 | 块圈定 `:297-300`（ccBlock）；Q8 无 current_contract 即红且永不回落 `:288-292`；Q3 六字段块内恰一次 `:318-323`；`field()` 读法 `:301-306`（引号剥离/尾注剥离，单行） | | |

**失败上腿通道**：`:1166-1181` 折叠调用（readFile/fileExists/revExists/baselineCurrent/driftProvider 注入，
`:1172-1179` drift 面 = packages+scripts+tests/paths.mjs+package.json+lock，故意保守）⇒ `:1182`
`cc.findings.length > 0 ⇒ { verdict:'fail', detail: cc.findings.join(' ; ') }` ⇒ `legLine`（`:139-141`）压平
空白、截 400 字符，产 `DSH-CI-LEG leg=state-freshness verdict=fail detail=…` 原文；`:1183-1188` pass 侧 detail
带 phase_id/baseline/rows/drift 摘要。fixture 体系：`packages/testkit/test/a5-current-contract.test.ts`
（改前 31 例：legacy-only 3 例 + Q1-Q8 生产 26 例 + 末尾真树 integration spawn）。

**缺口（本卡立案）**：`:320` 的必检字段清单与全部判则均不涉 `phase_status` / `phase_status_collected`
（`graph.yaml:99-100`，commit `0bf5b1c42a325c5806c27dce8313bfa4dfc3c068` 引入）——两字段删改/造形零红。
`04-kit.txt` 的 gap 行即其实证（shipped reader 对反义图 findings 无任何 Q9）。

## 本 worker 改动面（核账口径）

- `packages/testkit/test/a5-current-contract.test.ts`（既有件加两腿 P9/N9 + 一致默认值预铺 + 1 行 import）
- `dev/agent-workflow/evidence/alpha5/m2-ci-phase-status/`（本目录，独占）

其余工作树脏项（matrix/backlog 文案、a5ie-r2b、m2-todo、a5m2-readimg、pack/ 等）= CENTER 与并行 lane 的
在写项，本卡未触碰。

## 诚实法

CENTER 落 `p-phase-status-check.md` §2 之前：P9/N9 与 kit 均为 **fixture 级**证据；生产
`DSH-CI-LEG leg=state-freshness` 今日不判 phase_status（gap 有原文）。落笔后生产效力由 CENTER 的
§5 清单（腿实跑 + self-test）确认。
