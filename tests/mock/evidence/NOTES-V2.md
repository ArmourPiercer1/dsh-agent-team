# NOTES-V2 — dtest workspace V2（回归+收束轮）执行笔记

计划：`docs/plans/active/TEAM_DTEST_WORKSPACE_PLAN_V2.md`
Round-1 笔记：`evidence/NOTES.md`（本报告只记 V2 增量；沿用 round-1 的 requestToken 命名风格 `dtest-v2-*`）

## 环境

| 项 | 值 |
| --- | --- |
| 宿主机 | 127.0.0.1:3181（`tests/mock/scripts/boot.mjs`），MCP facet 3491 / host 3492 |
| DSH_HOME | `tests/mock/.dsh-home`（round-1 原样沿用） |
| dist | round-1 构建（**未含任何修复** — 本轮只做脚本功能冒烟，修复未开始） |
| API key | `.credentials.yaml` 沿用（未打印、未落盘新副本，除 scratch home 的 Copy-Item） |

## P0 — 资产冒烟（T0.2 dry-run / T0.3 资产冒烟）

日期：2026-09-07（UTC）

### T0.2a 脚本清单与语法

| 脚本 | 用途 | `node --check` |
| --- | --- | --- |
| `scripts/common.mjs` | 共享库（zstd 多帧解码容错、domain 表访问、RPC 封装、日志助手） | OK |
| `scripts/wait-turn.mjs` | D5 turn watchdog（180s）+ F3 挂死指纹 | OK |
| `scripts/wait-end-seed.mjs` | D6 kill→restart 前置（等 durable end-seed） | OK |
| `scripts/preflight-check.mjs` | G0 八项契约预检 | OK |
| `scripts/suite-face-verify.mjs` | B7 并发面验证（leader 路由 / direct 双模式） | OK |
| `scripts/suite-ledger-complete.mjs` | R-F11 API 半（分页完备性 + durable 对账） | OK |
| `scripts/suite-domain-diff.mjs` | durable domain vs 期望清单 | OK |
| `scripts/forensics-batch.mjs` | 每阶段只读取证合一 | OK |
| `scripts/ui-gate.mjs` | §2.4 UI gate（playwright-cli 编排 + 配置驱动） | OK |
| `scripts/boot.mjs`（扩展） | D1 workspace 预置 / D2 cookie 持久化+导航打印 / MOCK_DSH_HOME | OK |
| `scripts/gates/smoke-g1.json` | G1 冒烟 gate 配置 | — |
| `scripts/expected-smoke.json` | 冒烟用 domain-diff 期望（round-1 终态基线） | — |
| `scripts/prompts/*.md`（13） | canary×2 / ok×2 / b1 / t2345 / b2 / b3 / b4 / b5 / t43 / t41 / b6-req / b6-resolve / e2e-a / e2e-b / fixture-fill | — |

### T0.2b scratch-home 冒烟（D1+D2+D6，零模型 turn）— PASS（附 D6 语义澄清）

scratch home：`tests/mock/.dsh-home-smoke`（profile 经 copy-profile.mjs junction-safe 复制；`.credentials.yaml` Copy-Item 沿用，key 未打印）。boot：`MOCK_DSH_HOME=…smoke MOCK_BOOT_LABEL=smoke-scratch`。

| 检查 | 结果 |
| --- | --- |
| D1 workspace 预置（fresh home） | PASS — boot 日志 `D1: workspace registry pre-seeded (workspace=223de51b… sessionIds=[session-dtestmtrc6cfy299b])`；落盘核对：`initialized:true`、mock 行 `path=tests\mock`、`sessionIds` 含 directive root；**host 未丢弃预置的 root id**（root session 在 boot 时即由 directive 创建，id 有效） |
| D1 no-op 路径（existing home） | 待 T0.2c 首行日志验证（预期 `D1: workspace registry already present — no-op`） |
| D2 cookie 持久化 + 导航打印 | PASS — `state/cookie-header.txt` 224B（前缀 `dsh-auth-…`，值未打印）；stdout 出现 `COOKIED=1` + `PLAYWRIGHT_NAV: playwright-cli -s=mocktest goto <BOOT_URL>` |
| 健康门 | PASS — row ready toolCount=10，liveSessions=[scratch root]；client bundle 910KB served 200 |
| scratch team_domain | PASS — boot 后 directive 立即建 team（`team_sessions` 恰含 scratch root） |
| D6 kill→end-seed | **语义澄清（重要）**：`session/end-seed` 不是被杀进程关机时写的，而是**新进程 revive/retire 已存 session 时写的边界标记**（upstream `session.md` "The end-seed boundary" + round-1 boot#7 取证）。force-kill 后 scratch root 日志末尾仍为 `approval/policy`（4 行 seed，无 end-seed）→ wait-end-seed 前置等待**必然超时**（by design）。D6 配方修正为：kill → 重启#1（若 live-collision 失败，失败进程已 retire 会话并写 end-seed）→ `wait-end-seed.mjs` 确认 retire → 重启#2。`wait-end-seed.mjs` 文档/用法已按此重写；真正的 D6 端到端验证放在 T0.2c 尾部（campaign root 上） |
| 端口释放 | PASS — kill 后 3181/3491/3492 全部 listening=False |

**OBS-1（脚本自测发现，已修）**：durable 日志行形状为 `{type, seq, time, data:{turn,step,…}}`——初版 `logRows` 把 `turn/step` 读在顶层（恒 null），wait-turn 会失效；已修正为 `o.data?.turn`。
**OBS-2（脚本自测发现，已修）**：`wait-end-seed.mjs` 空串 sessionId 不走 `??` fallback；已改 `||`。

### T0.2c 存量 home 冒烟（face-verify 3 个模型 turn + 只读套件 + UI gate + D6 重启）— PASS

boot：`MOCK_ROOT_SESSION_ID=session-dtestp61051185350112102111120115117 MOCK_BOOT_LABEL=smoke-v2`（14:35:44 READY，live=3，toolCount=10；**D1 no-op 路径验证**：`D1: workspace registry already present — no-op`）。

| 步骤 | 结果 |
| --- | --- |
| G0 preflight（首跑） | 8 项中 3 FAIL → **全部为脚本自身 bug**（见 OBS-3..5），修复后 8/8 PASS（cookie/row-health/blueprint-binding/envelope 交集/workspace/MCP/team-binding/team-remote seam gen=70） |
| B7 face-verify（leader 路由） | **PASS** — leader prompt 1 次投递，3 会话并发 wait-turn 全部 <180s；面 = leader 11（10 team_* + dtesthttp）/ W1 37 / W2 37，与 round-1 已知良好基线一致。基线 turn 21/10/3 → 完成后 leader turn 22 |
| R-F11 API suite-ledger-complete | **PASS** — 2 页（50+26）分页至 `nextAfterSequence=null`；Σ=76==server total==durable count；tail=144 双端一致；严格递增/无重复/无 foreign entry |
| suite-domain-diff（expected-smoke.json） | **PASS** — 9/9（minFacts 76≥68；work-admitted 14≥12；control 三类齐；W1/W2 存在且 SETTLED） |
| forensics-batch | **PASS** — 单命令合一取证：gen 70→78、ledger 直方图（68→76，+8 = 2×(work-admitted+interval-open+interval-close+lifecycle-changed)）、root log 尾 turn 22 完整、overrides 仅 round-1 旧 root 1 条 |
| G1 ui-gate（playwright） | **PASS** — goto→展开"未分组"→点 root→role=tab eval 切"团队"→断言 W1/W2/时间线 present→快照 `state/teamtab-v2-smoke-g1.yml` + 截图 `evidence/screenshots/v2-smoke-g1.png` + raw log |
| D6 端到端（同 root 重启） | **PASS（idle 分支）** — kill（会话 idle）→ 端口释放 → 重启#1（label smoke-v2-d6）**首次即成功**（14:46:51，live=3，toolCount=10）→ preflight 复跑 8/8（gen=78）→ kill → 3 端口释放。= R-B7 语义验证（idle 态 kill 首次成功；活动态 kill 的 live-collision 分支按 round-1 配方 wait-end-seed+重试一次，本轮未触发） |
| 合规 | 3181/3491/3492 全释放；:3080 开发实例 pid 11676 未触碰；test-use 树 clean @ `a66e470204`；key 全程未打印；`.gitignore` 新增（强制忽略 `.dsh-home*/state//hosts//work/` 等凭据级运行时产物） |

**模型 turn 消耗**：3（leader 1 + W1 1 + W2 1，均为"请只回复 OK"面验证）。世界状态变化：gen 70→78、ledger 68→76（seq 69..144）、W1/W2 activityVersion 各 +1 活动区间、leader 新增 turn 22。

### OBS 清单（冒烟暴露的脚本缺陷，全部已修复）

| # | 缺陷 | 修复 |
| --- | --- | --- |
| OBS-1 | durable 日志行形状为 `{type,seq,time,data:{turn,step,…}}`，初版 `logRows` 在顶层读 `turn/step`（恒 null）→ wait-turn 失效 | `o.data?.turn`（common.mjs） |
| OBS-2 | `wait-end-seed.mjs` 空串 sessionId 不走 `??` fallback | 改 `||` |
| OBS-3 | preflight blueprint 绑定：contentHash 由 **domain 层 parse 后派生**（`packages/domain/blueprint` `parseBlueprint→contentHash`），源字符串的任意规范化变体都不可匹配（round-1 五变体法是红鲱鱼） | preflight 直接 import 生产 dist 的 `parseBlueprint` 精确比对 → 匹配 `sha256:e1b1df8f…` |
| OBS-4 | preflight envelope 解析：allow 列表在 **blueprintSource 解码后的文档内**（非 patch YAML 层）；初版正则层级错误 + memberBlocks 用了 region 相对偏移 | 先 `JSON.parse` 解码 JSON-escape 标量，再在文档内定位 `teamEnvelope:`/`memberEnvelopes:` 区段解析 allow；team(8) ∩ member(worker,collector) 均含 request/resolve-control |
| OBS-5 | preflight team-remote 调用了裸 `rpc`（payload 顶层放 teamSessionId → `malformed-request: unknown field`） | 改走 `teamRemote()`（`{version:1, params:{…}}` 信封） |
| OBS-6 | `session/prompt` wire request **必须含 `requestId`**（typert 边界校验 `gateway/input-invalid: wire field "request" failed boundary validation`） | `sessionPrompt()` 加 `requestId: randomUUID()` |
| OBS-7 | ui-gate：`playwright-cli` 是 `.ps1/.cmd` shim，`spawnSync` 无 shell 不执行；shell:true 时数组参数不转义（eval 表达式被 cmd 拆散） | 解析出真实入口 `@playwright/cli/playwright-cli.js`（`PLAYWRIGHT_CLI_JS` 可覆盖），直接 `node <entry> <args>` |
| OBS-8 | ui-gate：find 输出以**上下文容器行**开头（首个 ref = 页面根）；ref 带 per-browser 前缀（`f1e49` 而非 `e4`） | `pickRef()` 解析"带引号节点名"的行，按 exact/startsWith 匹配；ref 正则放宽为 `[A-Za-z0-9]+` |
| OBS-9 | ui-gate：`find "团队"` 在文档序上先命中侧边栏"新建团队"按钮 | 切 tab 改用 `role=tab` 精确文本 eval 点击 |
| OBS-10 | root session 在**折叠的"未分组"组**内，未展开时 find 无匹配 | gate 配置加 `rootGroup` 步骤（先点组展开） |

### 交付物（本轮新增，未提交）

`scripts/`: common.mjs / preflight-check.mjs / wait-turn.mjs / wait-end-seed.mjs / suite-face-verify.mjs / suite-ledger-complete.mjs / suite-domain-diff.mjs / forensics-batch.mjs / ui-gate.mjs / expected-smoke.json / gates/smoke-g1.json / prompts/×13；`boot.mjs`（M：D1/D2/MOCK_DSH_HOME）；`tests/mock/.gitignore`（新）；本文件。提交/推送等用户裁决。
