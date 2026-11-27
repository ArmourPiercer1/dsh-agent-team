# TRIAL GUIDE — 试用候选 `v0.3.0-trial.1`（可安装、可回滚，不是 release）

**这份文档是给 owner 的一份可执行试用说明，不是发布说明。** 它只描述本 trial tag 上**实测过**的事实；
每条命令都在本轮（2026-11-27，round 128）的隔离 `DSH_HOME` 里跑过，证据目录见 §9。
凡本文没有实测的，都会写明"未测"，不借用相邻证据。

> 语言：正文中文；**命令与路径逐字节精确**。`$` 行是命令，缩进块是预期输出片段。

---

## 1. Trial 身份，以及它与 release 的区别

| 项 | 值 | 如何自查 |
| --- | --- | --- |
| trial tag | `v0.3.0-trial.1`（annotated） | `git rev-parse v0.3.0-trial.1^{commit}` |
| tag 指向的 commit | 就是**包含本文档的那个提交**（annotated tag 打在文档提交上，所以不需要另填 SHA：`git rev-parse v0.3.0-trial.1^{commit}` 与 `git rev-parse HEAD` 在该 tag 上相同） | `git rev-parse v0.3.0-trial.1^{commit}` |
| 包版本 | root `package.json` `version` = `0.3.0-trial.1` | `node -p "require('./package.json').version"` |
| 已验证的 DSH 宿主 | **0.2.2-rc.5**（owner 目标宿主）与 **0.2.0-rc.2**（本仓构建/测试代） | §3 的安装检查；`pnpm dsh --version` |
| 兼容声明 | `engines.dsh` = `0.2.0-rc.2 \|\| 0.2.2-rc.5`，18 个 `@deepseek-ai/dsh*` peer 同一串 | `node -p "JSON.stringify(require('./package.json').engines)"` |
| 分支 | `vnext/a1-cut`，PR #822 **仍是 DRAFT** | `gh pr view 822 --json isDraft,state` |
| 安装方式 | 从 tag 装（git 依赖，无构建期脚本） | §3 |

**trial ≠ release。** 本 tag 是"可以装、可以起、可以回滚"的试用候选：

- 它可以被安装、被试用、被回滚；它**不是** `PRODUCT-PROVEN`，**不是** release candidate，**不**携带任何
  等级 / `V@B` / 发布结论；
- `PRODUCT-PROVEN` 仍由**发布保护规则**决定（冻结的 candidate SHA + version gate 在该 SHA 上
  **Required 且 green** + 可验证的 `version-gate-receipt.json`，定义见
  `dev/agent-workflow/evidence/ute-a1/CANDIDATE-REPORT.md` §1.1 与同目录 `VERSION-GATE.md`）。
  **装了这个 tag、跑通了本指南，不产生任何 `PRODUCT-PROVEN` 结论**；
- 本 trial 的安装 path 已实测（§3），但**没有**重做 candidate / release 的验收电池。不要把本指南的执行结果
  引用成 release 证据。

---

## 2. 前提

| 项 | 要求 | 说明 |
| --- | --- | --- |
| Node | `^22.19.0 \|\| >=24.0.0` | root `engines.node`；本轮实测 `v24.21.0` |
| pnpm | `11.x`（本仓 pin `11.7.0`） | `pnpm --version` |
| OS | **Linux x64** 为本 trial 的已验证目标 | 见下方"沙箱能力" |
| 沙箱能力 | 宿主需要可用的 OS 沙箱后端（本机 = Landlock 启动器 `landlock-run`；无特权 user namespace 下 `bwrap` 不可用） | 缺后端时宿主 **fail closed**，不是你配错 |
| git | 任意近期版本（从 `github:` 安装需要） | `git --version` |
| 浏览器 | 用来打开带 token 的 Web UI | 无头机可只用 curl（§5.3） |
| 端口 | 本指南统一用 **3180**（本仓测试口段 3180–3199），**永不用 3080** | 见 §8 安全声明 |

**沙箱能力不足时会发生什么（明确拒绝，不是静默降级）：**

- 宿主在请求 `workspace-write` 却没有任何可用沙箱后端时报
  `sandbox mode "workspace-write" is requested but no sandbox backend is usable on this host`，进程退出；
- **受治 Member realm**（本 trial 的 §4）依赖受限子进程面；该面不可用时，受治行不会"退化成不受限运行"：
  Member 在挂载结果上被 `MEMBER_CENTRE_UNWIRED` / `REALM_DECLARATION_INVALID` 类拒绝，
  拒绝发生在任何工具执行之前；
- 因此：**macOS / Windows 上本指南的受治 tier 未验证**（安装与 ungoverned 启动未在本轮对照测量）。
  如果宿主报上面的 `no sandbox backend`，停止，不要用"放宽配置"绕过。

**不要在宿主机上改这几样东西：** `~/.dsh`（稳定实例的 home）、端口 `:3080`、已发布的 tag。
本指南所有写入都在你自己的 trial `DSH_HOME` 里。

---

## 3. 安装（一次命令，从 tag 装）

### 3.1 选一个隔离 home，并先确认它真的被用上

```bash
export DSH_HOME="$PWD/.dsh-trial-031"        # 任意你自己的目录，绝不能是 ~/.dsh
mkdir -p "$DSH_HOME"
echo "DSH_HOME=$DSH_HOME"                     # 每次开新 shell 都要重新 export 并回显
```

> **为什么会有人踩坑**：某些工具环境会**预先导出** `DSH_HOME=$HOME/.dsh`。如果它被继承，
> 你下一条 `dsh plugin add` 就会装进稳定实例的 home。**每次**操作前 `echo "$DSH_HOME"` 自检，
> 并确认结果不是 `/home/<you>/.dsh`。

如果你的环境把默认 pnpm store 放在只读文件系统上（沙箱里常见），给 pnpm 一个可写 store：

```bash
export pnpm_config_store_dir="$PWD/.pnpm-store-trial"
export pnpm_config_cache_dir="$PWD/.pnpm-cache-trial"
```

### 3.2 安装

```bash
pnpm dsh plugin --profile web add github:ArmourPiercer1/dsh-agent-team#v0.3.0-trial.1
```

- **ref 分隔符是 `#`**：`github:user/repo@vX` 在 pnpm 里不成立；
- 这条命令把 tag 的 commit 作为 git 依赖装进 `$DSH_HOME/profiles/web`，**安装期不跑任何构建脚本**
  （本包没有生命周期脚本，也不需要 `allowBuilds` 白名单）；
- 安装成功后 CLI 自动把 `dsh-agent-team` 写进 profile 的 `dsh.profile.bundles`（唯一需要重启 profile 的一步）。

### 3.3 三条核对（缺一不可）

```bash
# 1) profile 依赖 + bundle 登记
node -p "JSON.stringify(require('$DSH_HOME/profiles/web/package.json'),null,2)"

# 2) 组合树里出现 bundle 行（不需要模型、不启动服务）
pnpm dsh --profile web --dump-config | grep -nE "dsh-agent-team/(host|web-transport)|# == dsh-agent-team"

# 3) 兼容检查没有拒绝：安装输出里没有 "is incompatible with dsh" / 没有回滚提示
```

预期（本轮实测）：

- `dependencies` 出现 `"dsh-agent-team": "github:ArmourPiercer1/dsh-agent-team#v0.3.0-trial.1"`；
- `dsh.profile.bundles` 出现 `"dsh-agent-team"`，排在 `@deepseek-ai/dsh-base` / `@deepseek-ai/dsh-web-app` 之后；
- `--dump-config` 输出里出现 `# == dsh-agent-team`，以及 `name: dsh-agent-team/host` 和
  `name: dsh-agent-team/web-transport` 两行；
- profile 的 `node_modules/@deepseek-ai/` 下**只有** `dsh-web-search-exa`（+ 其传输依赖），
  **没有** `dsh-tools`——`dsh-tools` 一旦进了 profile，所有工具调用都会以
  `Cannot read properties of undefined (reading 'prepare')` 失败（PD-37）。

### 3.4 记录你装到的到底是哪个 commit

```bash
jq -r '.importers["."].dependencies["dsh-agent-team"].version' "$DSH_HOME/profiles/web/pnpm-lock.yaml" 2>/dev/null \
  || grep -A3 'dsh-agent-team' "$DSH_HOME/profiles/web/pnpm-lock.yaml" | head
git rev-parse v0.3.0-trial.1^{commit}
```

git 依赖在 `pnpm-lock.yaml` 里记录为 `github.com/ArmourPiercer1/dsh-agent-team/<40-hex-commit>`；
两者必须是同一个 commit。本轮实测的解析值见 §9 的证据文件。

---

## 4. 受治试用配置（Leader + Worker + Officer）

**默认状态（不做本节）**：bundle 行是 **ungoverned** —— 没有 `centreStatePath`，Member 跑宿主的权限模型，
`uteProtected=false`，不产生 UTE admission fact / settlement。安装和启动都正常，但这不是本 trial
想让你试的治理面。

**受治状态（本节）**：一行 profile 覆盖 + 一份 v4 blueprint，把 Worker/Officer 关进一个 workspace 的
I/O 上限里。两个文件都在本仓库里，脚本会把它们放进你的 trial home。

### 4.1 生成受治 profile 层与 blueprint

```bash
# 在你的 checkout 里执行（仓库路径以你 clone 的位置为准）
export DSH_HOME="$PWD/.dsh-trial-031"          # 与 §3 同一个 home
bash docs/trial/install-trial-profile.sh
```

脚本做的事（都可复查，不改仓库、不改已安装的 bundle 副本）：

1. `mkdir -p "$DSH_HOME"/{trial-workspace,blueprints,centre,a5sf-evidence}`；
2. 把 `docs/trial/trial-team.v4.yaml` 里的 `@WORKSPACE@` 换成 **`$DSH_HOME/trial-workspace` 的绝对路径**，
   写成 `$DSH_HOME/blueprints/trial-team.yaml`（= 目录型蓝图源，`blueprintDir` 会扫它）；
3. 写 `$DSH_HOME/profiles/web/cordis.patch.yml`：**整段替换** bundle 的 `dsh-agent-team` 行 config
   （profile 层在 bundle 层之上，last-write-wins，没有字段级 merge），加上受治键：

   | 键 | 值 | 作用 |
   | --- | --- | --- |
   | `blueprintDir` | `$DSH_HOME/blueprints` | 保存型蓝图目录（`*.yaml` 立即被下一次 catalog 查询看到） |
   | `memberPresetId` | `a5sf-governed-member` | bundle 里已 ship 的受治 Member preset（受限 shell/fs/web 面） |
   | `a5sfGovernedRealm` | `true` | 中性启用键：行必须显式写它才编译 realm |
   | `centreStatePath` | `$DSH_HOME/centre` | 中心（centre）的耐久事实与 settlement 目录 |
   | `a5sfEvidencePath` | `$DSH_HOME/a5sf-evidence/consult.jsonl` | guard 咨询事实 |
   | `defaultWorkspace` | `$DSH_HOME/trial-workspace` | Team 的默认工作区 |

4. 打印所有落地路径。模型默认 `deepseek-official / deepseek-v4-flash`，可用
   `TRIAL_PROVIDER=... TRIAL_MODEL=... bash docs/trial/install-trial-profile.sh` 覆盖。

### 4.2 blueprint 的内容与文件路径

| 项 | 值 |
| --- | --- |
| 仓库模板 | `docs/trial/trial-team.v4.yaml`（**schemaVersion 4**） |
| 载入后的路径 | `$DSH_HOME/blueprints/trial-team.yaml` |
| 身份 | `blueprintId: trial-team`，`revision: "1"` |
| 模板 | `leader` / `worker` / `officer`（Leader + Worker + Officer） |
| 受治上限 | `memberIoCeilings`：`worker` 与 `officer` 各一条，`read`/`write` = `restricted` 到 `@WORKSPACE@`，`network` = `deny` |

为什么必须是 **v4**：受治 realm 从**绑定蓝图**的 `memberIoCeilings` 编译每个 Member 的上限；v3 文档在
受治行里被 **typed 拒绝**（`REALM_DECLARATION_INVALID`），绝不会被赠予一个默认上限。
为什么 `requirements: []`：本 trial 的 Member preset id 是 `a5sf-governed-member`，客户端静态 roster
不保证把它映射成 `standard` 人格类；空需求列表 = 不主张人格类，避免一个与本 trial 无关的
`PERSONA_INCOMPATIBLE` 把创建流程卡死。

> 改工作区：直接改 `$DSH_HOME/blueprints/trial-team.yaml` 里的两条绝对路径，然后重启宿主
> （目录索引是每次查询重扫的，但**已创建**的 Team 绑定的是创建时冻结的那一版，改文件不会改已有 Team）。
> 改完请重新跑一次 §4.1 的第 3 步之前先确认 `sed` 用的是新路径，或直接 `sed -i` 改文件。

### 4.3 怎么"载入"这份 blueprint

两种等价方式，都在**重启宿主之后**：

1. **Web UI**：New Team 面板 → 蓝图列表里应有 `trial-team`（v4）→ 选中 → 创建。
   列表为空时点"刷新蓝图目录"（目录索引无 watcher）。
2. **RPC 自查**（无头机/脚本，本轮实测）：

```bash
TOKEN=$(pnpm dsh web --port 3180 --host 127.0.0.1 --no-open >/tmp/trial-web.log 2>&1 & echo $!)  # 见 §5，实际用 §5.1
# 拿到带 token 的 URL 后，先换 cookie，再查目录：
curl -s -c /tmp/trial-jar -o /dev/null "http://127.0.0.1:3180/?token=$TOKEN"
curl -s -b /tmp/trial-jar -X POST http://127.0.0.1:3180/team-remote/catalog.list \
  -H 'content-type: application/json' \
  -d '{"type":"client-request","rpcId":"1","method":"catalog.list","payload":{"version":4,"params":{}}}'
```

预期 `blueprints` 里同时有 `my-team-bp-1`（bundle 的 v3 内联锚点）和 `trial-team`
（`schemaVersion: 4`、`migrationState: "current"`）。

### 4.4 怎么确认一个 Member 是 `uteProtected=true`

`uteProtected` 的判定在代码里是**两件事同时成立**：行的 `centreStatePath` 已配置（`governed`），
**且**该 Member 的受限 realm 真的挂载成功（`member.mountedRealm`）——见
`packages/runtime/src/plugin/vnext/centre-config.ts` 的 `memberAdmissionGate`。
它的**唯一权威值**是进程内的 `admissionModeOf(sessionId)`（未暴露到 Web UI / RPC），所以 owner 侧用
下面三条**可观察**证据交叉确认：

```bash
# 1) 受治键在位（profile 层）
grep -nE "centreStatePath|a5sfGovernedRealm|memberPresetId" "$DSH_HOME/profiles/web/cordis.patch.yml"

# 2) 该 Member 没有被打上 "ungoverned" 标签（这行只会在 uteProtected=false 时打印）
grep -n 'UTE-GOVERNANCE ungoverned: member' /tmp/trial-web.log   # 期望：无输出

# 3) 该 Member 真的产生了中心事实/结算（ungoverned Member 一条都不产生）
ls -l "$DSH_HOME"/centre/**/*.facts.jsonl 2>/dev/null
ls -l "$DSH_HOME"/centre/settlement/host-surface/*/*.settlement.json 2>/dev/null
```

判定：**1 成立 + 2 无输出 + 3 至少有一条属于该 Member 的事实或 settlement** = 该 Member 走在受治路径上
（`uteProtected=true`）。反过来，只要日志里出现
`UTE-GOVERNANCE ungoverned: member "<instanceId>" ... uteProtected=false`，该 Member 就是**不受治**，
无论行上写了什么——这就 "受治标签在、机制不在" 的观测面，不要用标签代替第 3 条。
（`admissionModeOf` 的直接调用需要宿主内进程；本 trial 不提供把它暴露到 UI 的 Remote。）

---

## 5. 启动 / 停止（隔离 home、非 3080 端口）

### 5.1 启动

```bash
export DSH_HOME="$PWD/.dsh-trial-031"             # 每次都确认
pnpm dsh web --port 3180 --host 127.0.0.1 --no-open 2>&1 | tee /tmp/trial-web.log
```

起来后会打印一行（token 就是你的浏览器凭证）：

```
dsh web: http://127.0.0.1:3180/?token=<token>
```

同时应看到本 bundle 自己的两行（本轮实测）：

```
[dsh-agent-team] registered 2 bundled team skill(s) from .../node_modules/dsh-agent-team/.agents/skills (...)
[dsh-agent-team] remote mount: MOUNTED channel=/team-remote (...)
```

无 token 的裸 `GET /` 返回 **401** 是**预期行为**，不是启动失败。

### 5.2 停止

在同一个终端 `Ctrl-C`，或对进程发 `SIGTERM`：

```bash
kill -TERM <pid>       # 本轮实测：进程退出码 0，进程消失，无残留子进程树
```

**重启语义**：同一 `DSH_HOME` 重启 = `bootPhase: create-or-open`，adopt 已有的 `team_domain`，
**不重放**已完成的回合（重启后不会重复投递既有的 Control 决议或 settlement；重复写同一 settlement 是
`DUPLICATE_SETTLEMENT` no-op，不是第二条事实）。

### 5.3 无头机的最小确认

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3180/     # 401 = 门在
```

---

## 6. 真实模型凭据：放哪里、怎么换

**不要**把 key 写进仓库（`.gitignore` 已忽略 `.env` / `.env.*`；trial 期间也不要新增任何被跟踪的凭据文件）。

```bash
# 在仓库根下建一个被 git 忽略的 .env（权限收紧）
umask 077
cat > .env <<'ENV'
DEEPSEEK_API_KEY=<your-real-key>
EXA_API_KEY=<optional-web-search-key>
ENV

# 启动宿主前载入（同一个 shell 会话）
set -a; . ./.env; set +a
```

- 模型：`staticModel.provider/model` 由 §4.1 的脚本写进 profile 层（默认
  `deepseek-official / deepseek-v4-flash`）；宿主按 provider 的 **credential-ref** 解析 key，
  默认环境名就是 `DEEPSEEK_API_KEY`（`packages/llm/llm-deepseek-api-key` 的 `apiKeyEnv` 默认值）。
- Web 搜索（可选）：bundle 的 `a5sf-web-transport` 行从 `A5SF_WEB_SEARCH_API_KEY` 或 `EXA_API_KEY` 读 key
  （`A5SF_WEB_SEARCH_BASE_URL` 可指向内网网关）。
- **轮换 / 删除**：改 `.env` → 重启宿主（key 是按请求解析的，但已在内存的旧值不会自己变）；
  删凭据 = 覆盖/删除 `.env` 后重启，并确认 `git status --porcelain` 里没有 `.env`。
- 宿主自己的凭据文件是 `$DSH_HOME/.credentials.yaml`（browser-session 等）；它也是 trial 本地文件，
  不要提交、不要拷进 stable home。
- 检查没有泄漏：`git status --porcelain | grep -i env` 应为空；`git check-ignore -v .env` 应命中。

---

## 7. 耐久产物在哪、怎么看

所有路径都在**本次 trial 的 `$DSH_HOME` 下**（下面的 `/trial/...` 指你的 home）。

| 你想看什么 | 路径 | 读取方式 |
| --- | --- | --- |
| Team/Member 耐久行（TeamSession、MemberInstance、lifecycle、ledger、blueprint registry、permission overlays） | `$DSH_HOME/storages/team_domain.json` | `jq '.tables \| keys'`；`jq '.tables.member_instances'` |
| Leader 会话 transcript | `$DSH_HOME/sessions/*/team-root/session.v4.jsonl.zstd` | zstd 压缩的 JSONL：`node -e "process.stdout.write(require('node:zlib').zstdDecompressSync(require('node:fs').readFileSync(process.argv[1])))" <file> \| jq -c .` |
| 成员 transcript | `$DSH_HOME/sessions/*/<member-session-id>/session.v4.jsonl.zstd` | 同上 |
| **Control 请求 / 决议 / 执行事实** | `$DSH_HOME/storages/team_domain.json` 的 `tables.ledger`（`control-request-recorded` / `control-decision` / `invocation-authority` / 执行事实） | `jq '.tables.ledger'`；单行 JSON 值可用 `jq -r '...\|fromjson'` 展开 |
| **admission 事实 / execution 事实**（受治 Member） | `$DSH_HOME/centre/<capability>.host-surface.facts.jsonl` | `jq -c . <file> \| tail` |
| **settlements** | `$DSH_HOME/centre/settlement/host-surface/<capability>/<executionId>.settlement.json` | `jq '{outcome,dispatch,stops}' <file>` |
| guard 咨询（受治面） | `$DSH_HOME/a5sf-evidence/consult.jsonl` | `jq -c . <file> \| tail` |
| 宿主 stdout（含 `UTE-GOVERNANCE` 观测、挂载行） | 你自己 `tee` 的文件（本指南 = `/tmp/trial-web.log`） | `grep -n "dsh-agent-team\|UTE-GOVERNANCE" /tmp/trial-web.log` |
| 安装期 pnpm 日志 | `$DSH_HOME/profiles/web/.plugin-manager/logs/operation-*/pnpm.log` | `ls -lt` + `tail` |
| 组合后的 profile 树（不必启动） | `pnpm dsh --profile web --dump-config` 的输出 | `grep -n "dsh-agent-team" -A30` |

**注意"有没有"本身就是结论**：一个 `ungoverned` Member **不会**产生 `centre/**` 下的任何事实或
settlement。所以"§7 的 centre 目录为空"与"§4.4 第 2 条无输出"合起来不能证明受治；必须看到第 3 条的事实。

---

## 8. Owner 手动清单（每项都写清"看哪里才能确认"）

前置：§3 装好、§4 生成受治层、§5 起在 3180、浏览器打开带 token 的 URL。

| # | 操作 | 在哪里确认 |
| --- | --- | --- |
| 1 | **UI 团队创建 / 蓝图 / persona** | New Team 面板列出 `trial-team`（v4）；创建后 `catalog.get` / 团队视图显示绑定 revision；`team_domain.json` 的 `tables.team_sessions` 出现一条 `boundBlueprint` |
| 2 | **Worker + Officer** | 团队视图 members 区段两个成员；Leader 的 `team_list_members` 返回 `worker`/`officer`；`tables.member_instances` 两行 |
| 3 | **委派 / 消息 / 收集** | Leader transcript 里 `team_delegate` 的 admission receipt（`workStatus:"admitted"`）→ 之后 `team_collect` 拿到终态；`tables.ledger` 有对应的 admission/execution 事实；成员 transcript 有该轮 |
| 4 | **FS allow / deny** | 让 Worker 读 `$DSH_HOME/trial-workspace` 内文件 = 成功；读 `$DSH_HOME` 外（如 `/etc/hostname`）= 成员 transcript 里 typed `IO_READ_DENIED`，`centre/**/*.facts.jsonl` 里该 call 是 refusal |
| 5 | **Ask → Officer → Grant → execute** | Worker 发起需要审批的操作 → `team_list_pending_control` 出现 pending Control；Officer 决议后 `tables.ledger` 有 `control-request-recorded` + `control-decision`，随后同一 `callId` 的执行事实/ settlement 为 `COMPLETED` |
| 6 | **deny + Stop** | 拒绝的请求：settlement `REFUSED` + `dispatch:"not-started"`（零执行）；Stop：`stops[]` 有 `pre-dispatch`/`in-flight` 且终态 `CANCELLED`，**不是** `COMPLETED` |
| 7 | **persistent bash + out-of-lane 拒绝** | 默认（ungoverned）preset 的 `bash` 是宿主持久 shell（cwd/env 跨调用保留）；**受治 preset 的 `bash` 是受限面，每条命令一个 fresh confined child（cwd/env 不跨调用保留）**——这是文档化的差别，不是 bug。越界命令 = typed 拒绝、零进程（`centre/**` 里该 call 无 execution 事实） |
| 8 | **archive / restore** | `team_archive_member` 后 `tables.member_instances` 该行 `ARCHIVED`；对它的下一次调用 = `ADMISSION_MEMBER_CLOSED` + `REFUSED`/`not-started` settlement；`team_restore_member`（如蓝图/工具面允许）后可再委派 |
| 9 | **重启不重放** | 停（§5.2）再起（§5.1）：`tables.ledger` 行数不增（同一 settlement 再写是 `DUPLICATE_SETTLEMENT` no-op），transcript 不重复回合，TeamSession 仍是同一 `teamSessionId` |
| 10 | **MCP / skill / subagent** | 启动日志有 `registered 2 bundled team skill(s)`（`team-blueprint-authoring`、`team-leader-operations`）；MCP：profile 行 `mcpServers: []` 默认空，配一个真实 server 后 `/mcp` 工具出现在 Leader 工具面；subagent：宿主自带 `subagent` 工具在 Leader 回合可用（本 trial 未逐个复测 MCP/subagent，见 §9 的"未测"清单） |

---

## 9. 回滚 / 卸载 / 清理

### 9.1 回滚这次安装（profile 层，不是 git 回滚）

```bash
export DSH_HOME="$PWD/.dsh-trial-031"
# 方式 A：用 CLI 摘掉 bundle（推荐；会自动从 dsh.profile.bundles 移除）
pnpm dsh plugin --profile web remove dsh-agent-team

# 方式 B：如果 A 不可用，手工把 profile 恢复到安装前
#   - 从 package.json 的 dependencies 删掉 dsh-agent-team
#   - 从 dsh.profile.bundles 删掉 "dsh-agent-team"
#   - 删掉你加的 cordis.patch.yml 覆盖层（§4.1 生成的）
#   - pnpm install --frozen-lockfile（在 profile 目录里）
```

回滚成功的判据（本轮实测）：`package.json` 的 `dependencies` 为空、`dsh.profile.bundles` 回到
`["@deepseek-ai/dsh-base","@deepseek-ai/dsh-web-app"]`、`node_modules/dsh-agent-team` 消失、
`--dump-config` 里不再有 `# == dsh-agent-team` 段，且宿主仍能正常启动（ungoverned、无 Team UI 行）。

### 9.2 清理整个 trial

```bash
# 先停宿主（§5.2）
rm -rf "$DSH_HOME"            # 只删你自己的 trial home
# 如果你为本 trial 建了 pnpm store/cache，也一并删：
rm -rf "$PWD/.pnpm-store-trial" "$PWD/.pnpm-cache-trial"
```

### 9.3 git 侧不产生任何东西

trial 的安装、启动、回滚都不改你的 checkout（`git status --porcelain` 应保持干净）。
唯一会出现在 checkout 里的东西是你自己建的 `.env` 与 trial home 目录——两者都在 `.gitignore` 里
（`.env*`、本指南建议的 `.dsh-trial-*` 请自行确认未被跟踪）。

---

## 10. 安全声明（`:3080` 与 `~/.dsh`）

- **本 trial 从不需要、也不允许触碰 `:3080` 或 `~/.dsh`。** 安装只写你 `export` 的那个 `DSH_HOME` 的
  `profiles/web`；启动只绑你指定的端口。
- 每次操作前 `echo "$DSH_HOME"`，并确认不是 `$HOME/.dsh`；不要 `unset DSH_HOME` 后就跑 `dsh`。
- 端口固定用 **3180**（或 3181–3199 / 3491–3500 / 13000–13099 段）。动手前后各跑一次：
  ```bash
  ss -ltnp | grep -E ':(3080|3180)\b' || true
  ```
  看到 3080 的监听进程时，**不要 kill、不要 `pnpm dsh` 到那个 home**——它是稳定开发实例。
- 回滚/清理只删你自己的 trial home 与 tag 的安装；**不要删任何已发布 tag**，不要 force-push。

---

## 11. 本轮实测范围（诚实边界）

**实测**（隔离 `DSH_HOME`，rc.5 CLI，2026-11-27）：

- 从 tag 安装（git 依赖）成功、profile 依赖 + bundles 登记、`--dump-config` 出现两行 bundle 行；
- 宿主启动（3180）、skill 注册、`/team-remote` 挂载、SIGTERM 退出码 0、进程消失；
- 受治 profile 层 + v4 blueprint 启动无错误，`catalog.list` 返回 `trial-team`（v4）；
- `plugin remove` 回滚后 profile 回到安装前的 bundle 集，宿主仍能启动。

**未测（不要读成已验证）**：

- 一次完整的、带真实模型 key 的 Member 回合（本指南的 §8 清单是给你照着做的手动步骤）；
- MCP server 与 subagent 的逐个复测；
- macOS / Windows 上的受治 tier；
- `PRODUCT-PROVEN` 的任何等级 / 发布结论。
