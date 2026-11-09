# PD-35 / PD36-INSTALL-SMOKE — 普通安装冒烟：机制成立，主流程不成立

> 日期 2026-11-16 ｜ lane `PD36-INSTALL-SMOKE` ｜ branch `task/pd36-install-smoke-20261116`
> ｜ base `origin/master` @ `87484ded13db97ea688484e85c67a85107a72d1f`
> ｜ 登记册行 = **PD-35**（连续律；见 README 末「编号」） ｜ 0 个 `packages/**` 变更
> ｜ `CORE PATCH BUDGET = 0` ｜ 无 `V@B`、无等级移动、不改 Q7/Authority/Required-CI

本文回答外部审查留给本 lane 的唯一问题——**"一个普通用户按文档安装、启动之后，到底能不能跑主流程？"**
答案与证据如下；结论先行：**安装机制成立；主流程不成立。** 这条不是推断，是三次控制实验的直接读数。

---

## 1. 一句话结论

**按 `docs/INSTALL.md` §2 的普通路径安装之后，普通用户仍然跑不了主流程**：打包、安装、启动、插件挂载、
`team.create`、真实模型回合全部成立，但**每一次工具调用**都以
`Cannot read properties of undefined (reading 'prepare')` 结束，因此 `web_fetch` / 文件读写 / goal / Stop /
结果收集**一条都没跑通**；同一事实在 WorldFactory 的链接形态下**同样**出现，所以它不是打包差异，而是
"插件装载进真实 profile"这一形态下的缺陷。登记为 **PD-35**。

---

## 2. 安装机制：这一段是**成立**的（逐条可复核）

| 步骤 | 命令 / 产物 | 读数 |
| --- | --- | --- |
| 打包 | `pnpm pack --pack-destination .scratch/install-smoke`（打包前后 `git status --porcelain` 均为空） | `dsh-agent-team-0.1.1-alpha.2.tgz`，**4 208 998** 字节，`sha256 = bea32690ba57661f4a940b3f2f3efa71e9789818c64bbad7520db4df290ce366`（`tarball.json`） |
| 干净宿主 | 空目录 `app/`，`package.json` 只有 `{"@deepseek-ai/dsh":"0.2.0-rc.2"}`，本地 `pnpm-workspace.yaml`（`packages: ['.']`，防止 pnpm 向上走进仓库 workspace），`pnpm install --store-dir ../pnpm-store` | 816 包 / 504 MB；`node .../dsh/lib/bin.js --version` → `0.2.0-rc.2` |
| 真实安装 | `DSH_HOME=<home> node <app>/node_modules/@deepseek-ai/dsh/lib/bin.js plugin --profile web add <tarball>` | `Packages: +21`，`Done in 2.6s using pnpm v11.7.0`；**没有**任何 workspace link、没有对源码树的 `file:` |
| profile 结果 | `home/profiles/web/package.json` | `dependencies["dsh-agent-team"] = "file:<...>/dsh-agent-team-0.1.1-alpha.2.tgz"`（**指向打包产物**，不是源码树）；`dsh.profile.bundles` 由 CLI 自动追加 `dsh-agent-team`（`profile-package.json`） |
| 落盘树 | `home/profiles/web/node_modules/dsh-agent-team/` | `README.md`、`cordis.patch.yml`、`package.json`、`.agents/skills`、`packages/{client,runtime}`（`install-transcript.txt` §5） |
| 启动 | `DSH_HOME=<home> node <app>/.../lib/bin.js web --port 3183 --no-open` | `dsh web: http://127.0.0.1:3183/?token=…`；`[dsh-agent-team] registered 2 bundled team skill(s)`；`[dsh-agent-team] remote mount: MOUNTED channel=/team-remote` |
| 团队建立 | `POST /team-remote/team.create`（contractVersion 9）→ `team.ensureRootLive` | `ok:true`，`path:"cold-root"`，`teamSessionId team-root`，`generation 2`；`live:true, mode:"team"` |
| 真实模型 | profile 的 `staticModel = {provider: deepseek-official, model: deepseek-v4-flash}`，凭据来自用户自己的 `$DSH_HOME/.credentials.yaml`（复制进冒烟 home，`chmod 600`） | Leader 回合真实运行（4 个回合、真实工具调用），**不是 mock** |

> **这是真实模型冒烟，不是脚本化 mock**：模型由 `deepseek-official` 适配器解析真实 key 并返回真实回合。
> 既有 E2E/World 车道仍是 mock 模型——两者的差别不影响本条结论（失败发生在模型之后、工具执行层）。

---

## 3. 主流程：这一段**不成立**

第一个工具调用就失败，`tool/result` 是"已记录但未落定"的中断结果，回合以 error 结束
（`tool-execution-failure.txt`，逐字）：

```
tool/call   {"turn":1,"step":1,"callId":"call_00_fglkxn0wX29oN02BUxoO1427","name":"bash","arguments":"{\"command\": \"echo team-plain-ok\" …}"}
tool/result {"isError":true, … "The tool call was interrupted after it was recorded, but no result was durably recorded. …"}
turn/end    {"turn":1,"reason":{"kind":"error","error":{"message":"Cannot read properties of undefined (reading 'prepare')","code":"UNKNOWN"}}}
```

受治（governed）形态更完整地展示了同一失败：Leader 连续 4 个回合分别尝试
`skill` / `skill` / `team_list_templates` / `bash`，**每一次**都被同一错误结束——包括 **`team_list_templates`
这样的只读 team 工具**。因此：

| 主流程环节 | 结果 |
| --- | --- |
| `web_fetch`（本地/真实端点） | **未到达**（工具层在 `prepare` 就失败） |
| 文件读 + 写 | **未到达** |
| 一个 goal（≥2 轮） | **未到达** |
| Stop（UI 入口或等价 RPC） | **未到达**（Member 建不出来，没有可停的目标） |
| 结果收集（`team_collect`） | **未到达** |
| 重启后不自动续轮 | **未测量**（同上） |
| UI Stop 入口是否真的可点 | **未测量**（本机**没有 headless 浏览器**：`bsk` 未安装；不做"应该能点"的推断） |

**因此对外只能写**：主流程在**普通安装**下**尚未被证明可跑**；不得写"装完即可用"。

---

## 4. 控制矩阵（把"是不是打包差异"钉死）

同一台机器、同一宿主版本 `0.2.0-rc.2`、同一批会话创建/提示 RPC。完整文本 = `control-matrix.txt`。

| # | 宿主来源 | profile 里的插件 | 首个 `bash` |
| --- | --- | --- | --- |
| A | pinned 树 `tests/deepseek-harness-test-use`（`639ed01539`） | **无** | **成功**：`bash` → `pinned-ok`，`turn/end completed` |
| B | pinned 树 | **tarball 安装**（本文 §2 的路径），shipped 行 | **失败**，同一 `prepare` 错误 |
| C | pinned 树 | **链接**（WorldFactory 形态：`node_modules/dsh-agent-team -> 仓库根`），shipped 行 | **失败**，同一错误 |
| D | **npm 安装** `@deepseek-ai/dsh@0.2.0-rc.2`（node_modules 扁平） | **无** | **失败**，同一错误 |
| E | **pnpm 安装**（isolated linker） | **无** | **失败**，同一错误 |
| F | pinned 树 | tarball 安装 + **受治行**（`memberPresetId: a5sf-governed-member` + `a5sfGovernedRealm: true`） | `team.create` 成功、真实模型回合成功，**首个工具调用失败**，同一错误 |

读法，逐条都要说全，否则会误归因：

1. **A vs B/C**：在同一宿主上，**装插件**是差异所在。B 与 C 同错，所以**不是**"tarball 与链接"的差异，
   即**不是打包形态**的差异。
2. **B/C 与 World 的关系**：World 也是链接形态（C 就是它的形状）。World 的记录是绿的，而 C 在这里是红的
   → **World 的绿依赖 WorldFactory 额外提供的东西**（harness 行 / 组合 / 图），这正是外部审查点名的
   "测试替身"缺口；`tests/world-factory/lib/profile-module-graph.mjs` 的注释自述它提供"每个 World 都有的
   install graph"。
3. **D/E 是环境事实，不是归因**：本机从 npm 装的宿主**即使不装插件**也复现同一错误；本环境的 native 包
   install script 被挡（`@deepseek-ai/dsh-subprocess-local`、`koffi`、`node-pty`、`protobufjs`、
   `@google/genai`）。因此 **D/E 不能用来指控上游发布缺陷**，只能说明"本环境的 npm 宿主不可作证据"。
4. **未能进一步归因的地方，明说**：本 lane 没有把失败定位到单行代码。已知的候选是
   `@deepseek-ai/dsh-agent-loop` 的 `ctx.tools[TOOL_RUNTIME_SCHEDULER].prepare(...)`
   （pinned 树 `packages/core/agent-loop/src/tool-calls.ts:170`；符号由 `@deepseek-ai/dsh-tools` 定义），
   即"取到的 `tools` 服务上没有调度器"。本 lane **没有**证实是重复模块实例、服务被 router/isolate 覆盖、
   还是别的路径。**结论只到"下一次调用必失败"这一层，不越过。**

---

## 5. 复现命令（最小集）

```bash
# 1) 打包（lane 的 worktree 内，工作区干净）
pnpm pack --pack-destination .scratch/install-smoke
sha256sum .scratch/install-smoke/dsh-agent-team-0.1.1-alpha.2.tgz   # bea32690…

# 2) 干净宿主（空目录，只有 dsh 依赖；本地 workspace 文件防止向上继承）
cd .scratch/install-smoke/app && pnpm install --store-dir ../pnpm-store

# 3) 真实安装（CLI 自己的 plugin 命令；profile 的 pnpm-workspace.yaml 里给 storeDir）
DSH_HOME=<home> node node_modules/@deepseek-ai/dsh/lib/bin.js plugin --profile web add <tarball>

# 4) 启动（本 lane 用 3183/3188/3189；:3080 从未被触碰）
DSH_HOME=<home> node node_modules/@deepseek-ai/dsh/lib/bin.js web --port 3183 --no-open

# 5) 让任意会话做一次工具调用，然后读会话日志
node .scratch/install-smoke/read-session.mjs <home> <sessionId> --types=tool/call,tool/result,turn/end
```

本 lane 用到的所有 RPC 都是 UI 自己发出的那几条（`POST /team-remote/<method>`、
`POST /api/session/prompt`、`POST /api/session/create`），helper = `.scratch/install-smoke/smoke-driver.mjs`
（gitignored，不进提交；行为在 README 里逐条说明，足以重写）。

---

## 6. 两条必须一起读的环境披露

1. **pnpm `storeDir` 被重定向进工作区**：本环境 `$HOME` 只读，pnpm 默认 store 会 `EROFS`；`dsh plugin add`
   用 `extendEnv:false` + scrubbed env 调 pnpm，`.npmrc`/`npm_config_*` 都不生效，唯一可行处是 profile 自己的
   `pnpm-workspace.yaml`（pnpm 11 从那里读设置）。**这是环境绕过，不是产品步骤**——真实用户的 `$HOME` 可写时
   不需要它。
2. **没有 headless 浏览器**：`browser_session start` 报 `bsk CLI ("bsk") was not found`。因此**没有做 DOM 点击**；
   Stop 入口的可点性在本 lane **未测量**（既有 PD-34 的组件级点击证据不受影响，但它不是真实浏览器）。

---

## 7. 编号

外部审查给本 lane 的编号是 **PD-36**，但本 base（`87484ded1`）上登记册的最后一行是 **PD-34**，**PD-35 空缺**；
`tests/world-factory/a5sf-debt-register.test.mjs` 强制 `PD-1…PD-n` 连续，故本行只能取 **PD-35**。
lane / 分支 / PR 首行 / 证据目录仍用 **PD36**（审查给出的轮次标识），登记册里以 `sourceId = INSTALL-SMOKE`
标识、并在 `source` 里写明这次改号。兄弟 lane（Stop 结果分类）若先合并，本行按同一规则重编号
（先例：`PD-25-from-PD-24`、`PD-28-from-PD-30`）。
