# WIRE-MAP-VERIFICATION — 简报 wire map 逐条证伪（真实 UTC 2026-10-30T20:0xZ）

方法：每条锚跑三类独立扫描——(S1) 本 worktree（master `f1db2a6db`）全树 find/grep；
(S2) 全 ref 历史 `git log --all -S<token>` + 全部 sibling worktree（`a5w-r4131`/`a5w-regime`/
`a5w-ri-tests`/`u7r3-oracle1`/`u7r3-sync14`/`u7r3-xval`）；(S3) 只读宿主 pin
`tests/deepseek-harness-test-use` @ `639ed01539…` 与本机宿主 checkout
`/home/armourpiercer/deepseek-harness`（同 SHA）+ 兄弟项目树。命令原文 = 本 lane shell 记录；
结论只陈述「不存在/存在且异义」两类，不代裁意图。

| # | 简报锚 | 结果 | 证据 |
| --- | --- | --- | --- |
| W1 | `packages/remote/src/http/events.ts`（「waterfall 转发器，硬编码只转发 permission_request/user_question 两类」） | **不存在**。`packages/remote/src/` = `contracts/ handlers/ push/ index.ts`，无 `http/` 目录；全包 grep `waterfall|permission_request|user_question` 零命中；全历史 `git log --all -S"team-remote-server"` 零命中。真实同职文件在**宿主源**：`tests/deepseek-harness-test-use/packages/api/remotes/src/remote-events.ts:20-48`（`API_REMOTE_FORWARDED_EVENTS`，自称 the one home，闭集 `as const satisfies`；waterfall 仅 `approval/request :22` + `user-questions/request :47`） | S1 `ls packages/remote/src`；S2 grep -S；S3 文件实读 |
| W2 | `team-remote-server.mjs`（`:5458-5462` `publicPresentFilesProvider` 注入点、`:5983` present-files handler） | **仓库历史从未存在**（`git log --all -S"publicPresentFilesProvider"` = 0 行；`-S"presentFilesViaPort"` = 0 行；`find` 全树/全 sibling/兄弟项目无此文件名）。我方对外面是 cookie-gated `POST /team-remote/<method>` 合同目录（`packages/remote/src/contracts/catalog.ts`），无任何 present/文件取件方法 | S1/S2/S3 |
| W3 | `packages/tools/src/team-tool-plane.mjs :2829-2875 / :3969-4013 / :1551`（presentFilesViaPort/present 实现/present-files 工具面） | **路径不存在**；同名真实文件 = `packages/runtime/src/plugin/live/team-tool-plane.mjs`，全长 **2118 行**（三个行锚全部越界），且全包 grep `presentFilesViaPort` 零命中。其 `:1551` 邻域、`:2829`+ 均无法对应所述职 | S1 `wc -l` + grep |
| W4 | `packages/tools/src/team-tool-surface.ts :121-148`（present-files 面 schema） | **不存在**（`packages/tools/src/` 无此文件；全历史无）。真实 present 参数 schema = `packages/tools/ui-family/src/ui-mechanics.mjs:195-231`（`parsePresentArgs`，闭集 `{path,description?}`×1..maxFiles，宿主 tool-present 镜像） | S1 |
| W5 | `client-plugin/src/user-questions.ts`（消费模式参照） | **不存在**。真实的两个参照：宿主 `packages/client/ui-deliverables/src/presented.ts:7,10`（`/api/present.open|host` 常量，GUI 读侧）与宿主 gateway 消费环 `packages/api/gateway/src/client/remote-events.ts`（`dispatchWaterfall`，本 lane 实读） | S1/S3 |
| W6 | 证据目录 `dev/agent-workflow/evidence/u7-uileg0-20261030/`（LEG-0-REPORT + RUN-ANALYSIS） | 目录名不确；真实 = `u7r3-uileg0-20261030/`（README.md = 四问裁决 + 两条 dated 更正；`PRESENT-PUBLISH-GAP-MEMO.md`）。其 Q2 结论与简报前提**相反**：缺口是「无受审 publish 服务可委托」，而 `deliverables/presented` 行**本身带 session 绑定**（tool 行亲笔 append，turn+callId） | 全读 |
| W7 | 「UI_DESIGN §16.6 类承诺产物可观察」 | 冻结 UI 文档 §16 仅 `16.1 固定层级 / 16.2 Template row / 16.3 Instance row / 16.4 Duplicate label`（grep `^## 16` 全列举）；全文 present/deliver 相关命中 4 处，均为 presentation 字样，**无产物观察承诺条款**。用户 2026-10-30 直令（协调者增量②转述）是需求的真实来源，锚引需改 | S1 grep |
| W8 | 「present 唯一公开出口=宿主 present 插件 files() 且无 session 绑定」 | 宿主插件面实读：原生行 durable 行 = `session.append('deliverables/presented',{turn,callId,files})`（`tool-present/src/index.ts:100-108`，`session` 即调用方 agent 的 Session ⇒ **有** session 绑定）；`/api/present.open|host` 是宿主 client 插件注册的桌面动作/读侧（`presented.ts:7,10`），非「files() 公开出口」。ctx 侧无 publish 服务（O2-B (a) 91 键穷举，本 lane 不重推导） | S3 实读 |
| W9 | 帧族名 `permission_request`/`user_question` | 宿主词汇 = `approval/request`、`user-questions/request`；`permission_request` 与 `user_question`（下划线形）在宿主源与我方包 grep 零命中 | S1/S3 |

**净结论**：简报把一条**宿主闭集 allowlist 事实**（waterfall 只转发两族）错写成**我方包内一个
可改文件**，并虚构了配套的服务端注入点/取件面/工具面/schema 面行锚。按其派工会导向两种伪证：
要么在 `packages/remote` 造一条生产恒零的假事件流（违 declared==requested + 无旋钮两律），
要么误触宿主源（破 CORE PATCH BUDGET=0）。两条都未发生。
