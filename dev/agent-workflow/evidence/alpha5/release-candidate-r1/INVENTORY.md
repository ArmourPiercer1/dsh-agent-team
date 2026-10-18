# ① 可试用机制/工具清单（master = `5885e46e…` 安装面（开轮 `b6d7c48a`，r4 轮 fail-closed 拦到 #340 窗口内合入；差=changed 12/added 0）；逐条对字节证据）

> 口径：**开关/配置键全部现场取自 master 源码与已装面的 `--dump-config` 组合输出**（本目录 `runs/<stamp>/dump-config-probe.txt` 为现场收据），不猜。
> **证据路径**只指已并入 master 的合并证据（`dev/agent-workflow/evidence/alpha5/…`）；`a5ie-r4-b2`（B2 装面复跑 35/35）目前是本地 tag `a5ie-r4-b2-evidence=b071b4f5`、**未入仓**（如实注，回放入册是在册事项，见 ②）。
> 最小验证命令两条路：`bash rc-trial.sh`（本目录，<20 行，真网络装+Team 入口真跑，本轮已实跑）或对应验收 kit 的既有腿（腿号+录制收据给出）。

## 1. Team 创建 / 成员 / 委派

- **装配面（唯一开关）**：profile `cordis.patch.yml` 中与已装 bundle 同 id 的覆盖行
  `- id: dsh-agent-team / name: dsh-agent-team/host / config: {…}`（last-write-wins 整段替换，INSTALL §3.2）。
  `config` 键（现场 dump-config 收据 `runs/<stamp>/dump-config-probe.txt`，形状=验收 kit 所用行形）：
  `rootSessionId` / `bootPhase: create` / `blueprintSource`（锚蓝图内联 YAML）/ `blueprintDir`（草稿蓝图目录）/ `rootPresetId` / `memberPresetId`（preset 声明行经 `tests/kits/_shared/preset-seam.mjs` 同缝挂载）/ `seedMembers` / `generation` / `staticModel {provider, model}` / `deniedSelection` / `mcpServers` / `mcpServer` / `environmentFacts` / `externalPolicyFacts`。
- **公开操作面**：`POST /team-remote/catalog.list`、`/team-remote/catalog.get`（蓝图预检）→ `/team-remote/team.create`（RPC 封套 `{type:'client-request', rpcId, method, payload:{version:1, params:{rootSessionId, blueprintId, initialWork:{prompt}}}}`；鉴权=boot token `GET /?token=` 303 换 cookie）。Leader 侧闭集 13 件 `team_*` 工具：成员=`team_create_member`（显式建员）→ `team_list_members`（实例 id 解析）；委派=`team_delegate`（`delegationTemplateId` 创建式 / `delegationInstanceId` 按实例式；默认 async，`async:false` 同步）；回读=`team_collect`（同 requestToken 读回耐久结算）。requestToken 纪律与寻址律（实例 id，非 label/templateId）正本=`.agents/skills/team-leader-operations/SKILL.md`（**随发布面出货**——`files:` 含 `.agents/skills/×2`）。
- **最小验证命令**：`bash rc-trial.sh`（腿 `B2` catalog 预检 / `B3` team.create / `M1` create-member+list / `M2` 按实例委派+collect）。
- **证据**：`dev/agent-workflow/evidence/alpha5/a5ie-r2b/`（43/43+2 booked：T 腿委托/collect/零扩权）、`a5ie-r3/`（50/50）、本轮 `runs/<stamp>/criteria.json`（B1–B3、M1–M2）；蓝图起草校验面=`team-blueprint-authoring` SKILL + domain 完备性校验（`packages/domain/blueprint/src/schema.ts`，v3/v4 双解析窗 `SUPPORTED=[3,4]` 自 `ee49c4c0`/#324）。

## 2. 审批 — PTC 升级行（#334 已合 = `b6d7c48a`；现 master=`5885e46e`/#340 未动此臂）

- **开关/配置键**：**无独立开关，构造式注册**——登记位于 `packages/runtime/src/plugin/live/agent-bindings.mjs` 的 `:2412` 门内（`permissionPolicy !== undefined && config.teamToolPlane != null` 才装配 PTC 路由；非 Team 安装路由表空 → host 级唯一 `approval/request` 全局监听纯 `next()` 直通，零扩权 by construction，S6）。理由文法逐字 `escalate sandbox to <mode>: <justification>`（mode ∈ 宿主闭集 `SandboxMode` 三件，宿主 `lib/index.js:109` 实测）；审批梯=leader→`user-approval` / member→`leader-approval`（`actionName 'parameter-permission'`），`decision==='allow'` 是唯一铸权触发；一次性 grant 走 PR2 `mintOperationGrant`/`createGrantLedger`（内核冻结优先序 identity→realm→generation→revision→fingerprint→expiry→consumption）。
- **自证行**：boot census 行 `a5ptc: census-boot root=… selectedRunner=… enforcement=…`（**CONFIG-DECLARED**：selectedRunner/enforcement 来自 `teamToolPlane.confinedProvider.assembly.{launcherPath, launcherSha256}` 三件套钉，**不声称 OS 运行时探针**——如实边界在件）。
- **最小验证命令**：合成腿 `pnpm vitest run packages/runtime/test/a5ptc-escalation-row.test.ts`（7/7，RED-first 先钉）；生产入口真跑=ptc live kit（配方 `production-run-recipe.md`）；装面 census 行见证=`rc-trial.sh` 腿 `M7`（本轮已实跑）。
- **证据**：`dev/agent-workflow/evidence/alpha5/ptc-fs-impl/`（README 六腿→代码行号级 + `runs/live-2026-10-18T15-01-38/` = live **19/19 KIT_EXIT=0**（durable leader-approval→allowed-once→禁区真写+hash、重放/过期/他队/mode 漂移零写、non-team 逐字节零差、unload 对称 U-1/U-1b/U-2）+ `kit-run13.stdout.log`）；合并注记=`b6d7c48a` commit message（19/19+三独审+契约冻结面全录 body）。

## 3. 受限 shell — Landlock confined provider（exit-code 保真已修 = #336 `fee982d2`）

- **开关/配置键**：`config.teamToolPlane.confinedProvider = { trustRoot: "sha256:<launcher-sha256 前16>#<launcher 绝对路径>", assembly: { launcherPath, launcherSha256, minAbiVersion: 3 } }`（trustRoot 与 launcher 字节双门，INSTALL §3.5 部署输入形态）。
- **发布面缺口（如实，I8）**：预启动器 `packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py` **不在发布面**（`files:` 只带 dist，tsc 永不产 `.py`）→ 安装者必须**从同一 commit** 带外供字节。**master 现字节（现场 `git show … | sha256sum`）**=`1264ea584e3438d6d831c0c8426f5663579f638556af9376d3a6e3617e9736e3`，26992 B（#338 起；`fee982d2/b35b9ea7` 回退点=`b9280090856e…`，混用会被 sha 门 fail-closed 拒）。ABI 自检：`python3 landlock-prelauncher.py --abi-probe` → `{"kind":"abi-available","abi_version":4}`（本轮 I9 腿实测）。
- **出口码保真（#336）**：`exitPassthrough: true` 为 **shell 臂请求级硬编码**（`packages/runtime/src/plugin/live/plane-effect-backends.mjs:650`），**非配置键**；glob/search 行不设该 flag → 其常量完成律原样保留。渲染律：真码直渲 `bash · exit=<n>`；超时 `bash · exit=not-observed · timed-out`；null 臂不flatten 成 0。**用户口径钉（根裁入册）**：`128+signum` 数值可与 payload 主动 exit 同值重合，任何面不得声称数字区分死因（#338 已改 launcher 注释口径）。
- **最小验证命令**：`bash rc-trial.sh`（腿 `M3` 正写 `bash · exit=0`+真落盘 `M4`；`M5` 越界 `bash · exit=1` + 内核 `Permission denied` stderr verbatim + meta `exitCode:1`；`M6` 零泄露+`cancelled:false` 现状）。
- **证据**：`a5ie-r2b/runs/2026-10-18T12-14-43Z/`（A6/A7 真 Landlock 首证+I9 三重字节证明）、tag `a5ie-r4-b2-evidence`=`b071b4f5`（**未入仓**：装面 A7 翻形 `exit=1`+X2 `exit=7`+I10 flag 到装面，35/35）、本轮 `runs/<stamp>/criteria.json` + `wire-digests.jsonl`。

## 4. search（confined rg）

- **开关/配置键**：`config.teamToolPlane.fsInstance = { fs, rootDir, realmId, kind: 'absolute-path' }`（锚根）；行名闭集 `DEFAULT_PLANE_NAMES = { grep: 'team_grep', glob: 'team_glob', bash: 'team_bash' }`（`team-tool-plane.mjs:83`）。搜索体复用宿主公开 W5 血统件：`import { buildGlobCommand, GLOB_MAX_RESULTS, resolveRgPath } from '@deepseek-ai/dsh-tool-fs-search'`（`plane-effect-backends.mjs:63`）——锚内执行、上限链、答案归因（命中行携带锚定绝对路径，无静默替换）。
- **rg-parity**：#330 已合 = `1a7c3c1cb1e8ae59c43cb1fa00d4c19a8f6172e1`（search rg-parity+dist 闭包；srgp 17 行对照表 16 行序同、knob 按名拒、argv 注入全封）。
- **最小验证命令**：录制腿 `a5ie-r2b` A3/A4/A5（正命中/诚实 0-matches×2）+ `a5ie-r3` A3/A10（归因腿）；现行装面复跑口径=待 `a5ie-r5`（②）。注意：`104b4991→b6d7c48a` 间 `plane-effect-backends.mjs` 的字节差仅 #336 shell 臂 hunk（search 段原样），search 行完成律无 payload exit code（常量律）。
- **证据**：`dev/agent-workflow/evidence/alpha5/srgp/`、`a5ie-r2b/`、`a5ie-r3/`。

## 5. glob（**状态如实：live，但带在案未闭洞**）

- **开关/配置键**：同一 `teamToolPlane` 挂载即活（#333=`104b4991…` 翻转入 master；后端 `packages/runtime/src/plugin/live/glob-backend.mjs`，`createAnchoredGlobBackend` 于 `team-tool-plane.mjs:80` 装配；`GLOB_MAX_RESULTS=100` 封顶+诚实 truncated 标记；越界 symlink 别名具名拒 `symlink-alias`；walker 错误=闭码表内 `walker-error`，非静默零）。
- **未闭洞（如实，不降判据）**：
  1. **live stderr 代理判据**：glob/search 行无 payload exit code，launcher 的 `exit.json` rc 缺席时按 DEFAULT EXIT LAW（prelauncher :36-38）完成，行侧以"非空 stderr ⇒ walker-error"作**代理判据**（`plane-effect-backends.mjs:516-524`、`glob-backend.mjs:902-925`）；terminate-前 drain 实测假拒 373/6600@2000ms、Node 层 2.5–4% 直现复现（`11c246f2` 探针在台账在册），**前置在 transport 层**。
  2. **#337=两线均已裁、实施中（#341 补修①刷新，非"候裁"）**：rc-first 判据=步骤 B `178bea59411b2d257cadc0582603b361aec7f96c`（g6b-flake 头，双审中）；stdout 完整性门=`203cac85f00dcadc71df98405f87eca01a477b06`（round-8）；均**未入 master 头**（merge-base 实证）⇒ 洞**闭合前**试用口径不变。
- **最小验证命令**：五控录制腿 `a5ie-r3` G1/G2/G3/G4/G5（GLOB-POS/BOUND(140 真总数+truncated)/SYMLINK(别名不出现)/OUTSIDE-ANCHOR(外名+外字节全 wire 零)/WALKER-ERROR(typed 非静默)）50/50；现行装面复跑同待 `a5ie-r5`。
- **证据**：`dev/agent-workflow/evidence/alpha5/glob-backend/`、`a5ie-r3/`（翻转后五控全过逐字）、`runtime-base-narrow/`（#323 收窄=bug 修复口径）。

## 6. read（受治理只读行）

- **开关/配置键**：同 `teamToolPlane.fsInstance` 锚根；执行体 `createGovernedReadExecutor`（`plane-effect-backends.mjs:702+`）：lane deny 先于 backend，default-deny 门在 effect 自身粒度复查 ALLOW 覆盖；跨根目标=具形拒 `refused-schema target-outside-governed-root`，零字节外泄。装配不齐（仅 `realmId`，无 `fsInstance/confinedProvider`）时成员 read 落**逐字 RED 姿态** `Tool Binding for "read" cannot be verified at dispatch time (no fallback to the native body)`——拒形也是验收判据（P1）。
- **最小验证命令**：录制腿 `a5ie-r2b` A1/A2 + `a5ie-r3` A 族；现行装面复跑同待 `a5ie-r5`。
- **证据**：`dev/agent-workflow/evidence/alpha5/pb-binding-feed/`（#317 binding feed 生产接线）、`glue6/`（#318 安装面自足+render 契约）、`a5ie-r2b/`。

## 7. 非 team 会话零足迹

- **开关/配置键**：**无**——by construction：挂载=config-scoped（行覆盖只作用该行）；PTC 路由无 `permissionPolicy+teamToolPlane` 则为空表、监听器直通（S6）。
- **判据**：同 boot 的 standard/minimal 非 team session 对 baseline **registry Δ=[] ∧ wire Δ=[]**、零 `team_` 别名、零 plane 观测；对照之对照=无 row config 的 governed leader 亦零别名/零 jobs gateway。
- **最小验证命令**：录制腿 `a5ie-r2b`/`a5ie-r3` `Z1`/`Z2`/`T10`；`a5ie-r4-b2` 复确认 `Z2 Δ=[]`（tag，未入仓）。本轮 smoke 未重跑 Z 族（最小化范围=简报六步；Z 证据为已合并态，缺项如实）。
- **证据**：`a5ie-r2b/runs/2026-10-18T12-14-43Z/`（Z1/Z2 逐字）、`a5ie-r3/`。

## 附 — 安装链本身（③ 引用）

固定安装链三要素：(a) 宿主 = `tests/deepseek-harness-test-use` pristine @ `639ed01539`（`tests/paths.mjs` pin，构建经 `pnpm run build` + `DSH_CLIENT_COMMIT_HASH`，启动用 `apps/cli/lib/bin.js`）；(b) 安装 = `dsh plugin --profile web add github:ArmourPiercer1/dsh-agent-team#<全量 SHA>`（预构建产物直接安装、无生命周期脚本、无需 allowBuilds）；(c) profile `pnpm-workspace.yaml` 的 `storeDir` 公开通道把内容库钉在工作区内（沙箱约束）。三零口径=**声明面重数**：master `5885e46e` = `files:` **1771** + pack 恒含 2 = **1773**（对 `b6d7c48a` changed 12/added 0；现场重数见 README；旧 1772 口径止于 `2d1fa21c`）。
