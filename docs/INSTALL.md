# INSTALL — 在独立 DSH 实例上安装挂载 dsh-agent-team

> **性质**：master 产品（R125 收口，2026-09-04）的安装指南。权威状态见 `docs/STATUS.md`；
> 本文件是快照，与 graph.yaml + 日志冲突时以后者为准。

## 1. 前提

| 项 | 要求 |
| --- | --- |
| DSH（deepseek-harness） | **0.1.2-rc.1**（已测基线；0.1.3-alpha.1 的插件契约已逐字节核验一致 —— `plugin.ts`/`profile.ts` 加载链同形） |
| Node | `^22.19.0 \|\| >=24.0.0`（repo `engines`） |
| pnpm | `11.7.0`（repo `packageManager` pin） |
| 模型 | 目标机器可用的真实 provider/model + DSH 凭据（真实功能测试必需；测试世界的假模型配置不可用于真测） |
| 红线 | 安装只触 DSH_HOME profile 层（公开 seam）；**不改 DSH 源码**（CORE PATCH BUDGET = 0，零上游补丁） |

两条安装路径：**§2 快速安装**（`dsh plugin add github:`，一条命令 + 一次性
pnpm prepare 白名单；推荐）与 **§3 手动安装**（clone + 构建 + 手工挂载，
离线 / 需逐字段掌控行内容时）。

## 2. 快速安装（`dsh plugin add`，推荐）

root `package.json` 已声明 `dsh.bundle`（bundle 层 = 仓库根 `cordis.patch.yml`，
machine-agnostic：host 行 `name: "dsh-agent-team/host"` 子路径包、client 行
`name: "dsh-agent-team"` 裸包名，**无任何 file:// 机器路径**）与
`dsh.client`（platform web），DSH CLI 可一步安装并登记：

```bash
pnpm dsh plugin --profile web add github:ArmourPiercer1/dsh-agent-team
```

### 首次运行：pnpm prepare 白名单（必须，一次性）

pnpm 11 对 git 依赖的生命周期脚本（`prepare`）默认**拒绝执行**：首次 `add`
会**硬失败**（依赖完全未装入），并打印：

```text
[ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED] ... dsh-agent-team@<spec>#<commit> ...
  allowBuilds:
    <pnpm 打印的完整 name@spec#commit 键>: true
```

处置（键 = pnpm 打印的**完整 `name@spec#commit`**，不是裸包名；照抄打印行）：

1. 打开 profile 的 `pnpm-workspace.yaml`（`DSH_HOME/profiles/web/pnpm-workspace.yaml`，
   CLI 初始化 profile 时自动生成；不存在则新建空文件即可 —— profile 目录必须有
   自己的 workspace 声明，否则 pnpm 会向上并入外层 workspace）；
2. 在其中加入 `allowBuilds:`，把错误信息打印的键原样写入：

   ```yaml
   allowBuilds:
     <错误信息中 allowBuilds: 下打印的那一整行键>: true
   ```

3. **重跑** `add` 命令：本次安装成功，`prepare` 链
   （`pnpm install --ignore-scripts && pnpm build && pnpm build:composition`）
   在依赖目录内自动完成：registry-pinned 运行时依赖（5 ×
   `@deepseek-ai/*@0.1.2-rc.1` + zod 4.4.3，均 npm access:public）安装 →
   9 包 tsc → glue 放置 + client composition 生成。

安装成功后 CLI 的 reconcile 检测到 `dsh.bundle.patch` 声明，**自动**把
`./cordis.patch.yml` 并入 profile 的 `dsh.profile.bundles`（无需手工编辑
`cordis.patch.yml`；若版本过旧未带该声明，CLI 会打印 `declares no dsh.bundle —
installed as a plain dependency` 警告且无 Team UI —— 见 §7 排障）。

### 层覆盖语义（override = 整段替换）

bundle 层在 profile 层**之下**加载；profile 自己的 `cordis.patch.yml` 若含
同 `id` 行（`dsh-agent-team` / `dsh-agent-team-client`），profile 行**整体替换**
bundle 行配置（last-write-wins，**不是字段级 merge**）——要覆盖个别字段，
必须写出完整 config。要定制团队蓝图，推荐在 profile 层写一条同 id 的
完整 host 行（形态见 §3 挂载模板，glueUrl/seamUrl 可省略 —— host 入口会
从自身位置推导，见 §7 排障行 3）。

### 验证

启动 `dsh web` 后按 §5 核验（boot 行 + 401 + 四个 UI 入口）。安装产物与
§3 手动路径完全一致（同一 `prepare` 链；§5 的四个 client 产物 SHA 基线
同样适用）。

## 3. 手动安装（clone + 构建 + 挂载，离线 / 后备路径）

### 3.1 构建（目标机器）

```bash
git clone <repo-url> dsh-agent-team
cd dsh-agent-team
git checkout master
pnpm install              # row-owned 运行时依赖已声明（packages/runtime：5 × @deepseek-ai/*@0.1.2-rc.1
                          # + zod 4.4.3，均已在 npm registry 发布、access:public）——新机器由 pnpm
                          # 直接安装，无需手工 link / junction（R125(1b)）
pnpm build              # 9 个包 tsc → packages/*/dist（legacy 包输出到 packages/runtime/dist，见 §2 产物表注）
pnpm build:composition  # ① 放置 runtime glue ② 生成 packages/client/composition-shim/
```

`build:composition` 两步（均为仓库内 canonical 脚本）：

1. `scripts/place-dist-glue.mjs` — tsc 不发射 `.mjs`：把
   `packages/runtime/src/plugin/live/agent-bindings.mjs` **字节级复制**到
   `packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs`
   （host 行 `glueUrl` 的行内目标，无回退，必须存在；T12/P9 boot kit 同款步骤
   的产品化）。`upstream-resolver.mjs` **无需**复制：host.js 的 resolve 钩子
   走布局候选列表（dist 或 source 均可解析）。
2. `scripts/build-client-composition.mjs` — 把 `packages/client` 的 tsc ESM dist
   + CSS 源编译为单文件 client bundle（`window.__ModuleLoader__.load` wire 格式，
   identity class map + `<style>` 注入，基线 external 集合 fail-closed 校验），
   连同 `dsh.client` manifest 与惰性 Node 半输出到 `packages/client/composition-shim/`
   （gitignored 构建产物）。与 R122 验证世界所用 S8 适配器**字节级同构**
   （SHA-256 一致，见 `dev/agent-workflow/evidence/P9-master-closure/`）。

| 产物 | 路径 |
| --- | --- |
| Host 入口（Cordis host 插件） | `packages/runtime/dist/packages/runtime/src/plugin/host.js` |
| glue（agent bindings） | `packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs` |
| seam（root binding harness） | `packages/runtime/root-binding/harness/seam.mjs` |
| Client 挂载面（shim 包：`dsh.client` manifest + `./client` export + 惰性 Node 半） | `packages/client/composition-shim/` |

`build:composition` 由 `scripts/build-client-composition.mjs` 生成（仓库内 canonical，
R125 产品化；与 R122 验证世界所用 S8 适配器字节级同构，产物含 CSS 内联与
`window.__ModuleLoader__.load` wire 格式）。

## 3.2 挂载（DSH_HOME/profiles/web/cordis.patch.yml）

在目标机器 DSH 的 `DSH_HOME/profiles/web/`（不存在时先启动一次 `dsh web` 让 DSH 初始化
profile 目录）编辑 `cordis.patch.yml` —— 顶层是 patch 数组；不存在则新建。

```yaml
- insert:
    - id: "dsh-agent-team"
      name: "file:///<REPO>/packages/runtime/dist/packages/runtime/src/plugin/host.js"
      config:
        bootPhase: "create"
        rootSessionId: "team-root"
        blueprintSource: |
          ---
          schemaVersion: 1
          blueprintId: my-team-bp-1
          revision: "1"
          leader:
            templateId: leader
            persona: "You lead this team."
          members:
            - templateId: worker
              displayName: "Worker A"
              persona: "You are a worker on this team."
          requirements:
            - domain: persona
              name: standard
          teamEnvelope:
            allow: [assign-task, create-member, send-message, report-progress, archive-member, restore-member]
            deny: [delete-team]
          memberEnvelopes:
            - templateId: worker
              envelope:
                allow: [send-message, report-progress]
                deny: []
          policyStates:
            - id: default
              description: "Default state."
          quotas:
            team:
              maxInstances: 12
              maxConcurrent: 12
            members:
              maxInstances: 4
              maxConcurrent: 4
          metadata: {}
          ---
        seedMembers: []
        # 以下三字段必填：host 配置校验 fail-closed，缺失任一 → TEAM_PLUGIN_CONFIG_INVALID
        # （字段集与 R122 验证行逐字对齐，R125 gate reviewer-3 B1）
        generation: 1
        deniedSelection: null
        mcpServer: null
        staticModel:
          provider: <your-provider>
          model: <your-model>
        environmentFacts:
          - { domain: "tool", subject: "web", available: true, generation: 1 }
          - { domain: "skill", subject: "base", available: true, generation: 1 }
          - { domain: "persona", subject: "standard", available: true, generation: 1 }
        externalPolicyFacts:
          hard: {}
          capabilityExists: {}
        glueUrl: "file:///<REPO>/packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs"
        seamUrl: "file:///<REPO>/packages/runtime/root-binding/harness/seam.mjs"
    - id: "dsh-agent-team-client"
      name: "../../team-client-row/index.js"
```

- `<REPO>` = 目标机器 clone 目录的绝对路径；file:// URL 一律**正斜杠**
  （Windows 例：`file:///D:/code/dsh-agent-team/...`）。
- `glueUrl` / `seamUrl`（**可选**）：host 入口会从自身位置推导（glue =
  入口旁 `live/agent-bindings.mjs`；seam = runtime 包根
  `root-binding/harness/seam.mjs`，dist/src 双布局候选）；显式值优先。
  模板保留显式 file:// 形态 = R122/125 已 live 验证的逐字形态。
- `blueprintSource` 为内联 YAML 字符串（YAML literal block `|`）：leader/members 的 `templateId`、`persona` 按团队
  设计填写；`requirements` 引用的 persona 必须与 `environmentFacts` 中 available 的
  persona 对齐（示例：`persona/standard`）。**块内必须保留首、末两行 `---` frontmatter
  定界符**（模板已含）：host 侧 `parseBlueprint`/`splitFrontmatter`（packages/domain）
  fail-closed —— 首行非 `---` → `MALFORMED_DTO`（`frontmatter-missing`）；缺闭合 `---` →
  `frontmatter-unclosed`；闭合行后有任何非空内容 → `markdown-body-not-allowed`。
  修改蓝图字段时勿删这两行（R125 round-3 reviewer-9 实测：缺定界符的模板首次
  `team.create` 必失败）。
- `rootSessionId` 每个世界唯一；复用既有世界时按现状调整。
- `defaultWorkspace`（可选）：Root 默认 workspace 目录。**缺省时 host 入口
  默认取 `dsh web` 的启动目录（`process.cwd()`）**：projection fold 要求
  每个 team 行有可解析的 effective workspace（否则团队视图 fail-closed
  零态、`team.getProjection` 报 internal-error），而 git-install 的 bundle
  行机器无关、不能携带绝对路径（plugin-bundle-form D9）；需要固定到特定
  目录时在 user 层行显式给出。
- **client 行（推荐 = R122 已 live 验证的相对形态）**：把 `packages/client/composition-shim/`
  复制进 `DSH_HOME` 内（如 `DSH_HOME/team-client-row/`），行写
  `name: "../../team-client-row/index.js"`（R122 验证世界即此形态）。`file:///<REPO>/…/index.js`
  形态未 live 验证，仅当确认目标 DSH 版本接受 file:// 行时使用。
- 热加载（可选）：profile `package.json` 的 `dsh.profile` 加 `"patchReload": "live"`；
  rc.1 自带 web profile 已默认 `patchReload: live`（此时改完 `cordis.patch.yml` 自动热加载，
  无需再显式声明），否则改完 `cordis.patch.yml` 需重启 `dsh web` 进程。

## 4. 真实模型

- `staticModel` 必须指向目标机器上**真实可用**的 provider/model，且该 DSH 实例已配置
  对应凭据；否则团队成员的模型轮次无法完成。
- R122 测试世界使用假模型（`deepseek-official` / `s8v-model`）做确定性验证 —— 那是
  测试装置，不是产品配置，真测不可沿用。

## 5. 启动与验证

1. 启动 `dsh web`；输出 `dsh web: http://127.0.0.1:<port>/?token=...` 一行 = host boot
   完成（plugin tree 已加载）。rc.1 带启动 token 鉴权门：无 token 的裸 GET 返回 401 是
   **预期行为**。
2. 用带 token 的 URL 打开页面，核验 P9 UI 四个入口：
   - 侧栏底部团队入口（`sidebar.footer.action`：折叠 56px rail / 展开行 + 创建 overlay）；
   - 团队视图（members / tasks / ledger / timeline 区段）；
   - composer 上下文栈中的 Team dock 只读行（展开 = 成员状态 + 任务列表）；
   - 设置页 Team 区段（`settings.section`）。
3. 真实功能测试：创建团队（blueprint 内联 YAML 或 UI 创建面板）→ 分配任务 → 成员
   send-message / report-progress 轮次 → 归档/恢复成员。

## 6. 排障

| 症状 | 处置 |
| --- | --- |
| `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`（快速安装） | pnpm 11 拒绝执行未白名单的 git 依赖 `prepare`：把 pnpm 打印的**完整 `name@spec#commit` 键**（照抄、非裸包名）写入 profile `pnpm-workspace.yaml` 的 `allowBuilds:`，重跑 `add`（§2） |
| `declares no dsh.bundle` 警告 / 无 Team UI | 装入的 commit 是 bundle-form 之前的旧版（root 无 `dsh.bundle` 声明）：`pnpm dsh plugin --profile web add github:ArmourPiercer1/dsh-agent-team#<新commit>` 重装，或改 §3 手动路径 |
| 快速安装 host 行加载失败（无 file:// 路径） | `prepare` 链未走完 → dist 缺失（boot fail-loud）：在依赖目录 `<profile>/node_modules/dsh-agent-team` 手工补跑 `pnpm install --ignore-scripts && pnpm build && pnpm build:composition` 后重启；@deepseek-ai/\* 解析错 = 嵌套安装闭包不全（registry 可达性 / lockfile） |
| 快速安装 host 行加载失败（`upstream-resolver.mjs` not found） | 装入的 commit 处于 bundle-form 初期 `files` 安装面不全的窗口（pnpm 对 git 依赖按 `files` 字段裁剪物化，该文件曾被遗漏）：用新 commit 重装；临时处置 = 从源码树把 `packages/runtime/src/plugin/upstream-resolver.mjs` 拷入依赖目录同相对路径后重启 |
| seam 推导失败（`no default seam module was found`） | 安装目录结构残缺（入口推导的两个布局候选都不存在）：重装，或改 §3 手动形态写显式 `seamUrl` |
| host 行配置校验失败 | `TEAM_PLUGIN_CONFIG_INVALID`：`config:` 缺 `generation` / `deniedSelection` / `mcpServer` 三字段之一（必填、fail-closed，见 §3 模板） |
| host 行加载失败 | 核 file:// 路径（正斜杠、文件存在：`pnpm build` 已跑）；`bootPhase`/`rootSessionId` 与既有世界冲突；glue 加载报 @deepseek-ai/* 解析错 → `pnpm install` 闭包不全（registry 可达性 / lockfile），重跑 `pnpm install` |
| client 行加载失败 | `pnpm build:composition` 是否已跑（`composition-shim/` 存在）；改试 §3 的相对路径形态 |
| 页面 404 | 目标 DSH 缺 web shell 产物（源码安装 DSH 需在该机 `pnpm build:web` 一次；发布版 DSH 不应出现） |
| 成员轮次不动 | 模型凭据/`staticModel` 配置（§4）；查看 DSH host 日志 |

## 7. 测试世界参照（本机，local-only）

R122 rc.1 验证世界的完整挂载样本（含假模型测试装置与 p6t6 观测行、目录选择器
headless pin）：`references/.dsh-test-s8-2026-09-04T12-26-59/profiles/web/cordis.patch.yml`
+ `references/.dsh-test-s8-2026-09-04T12-26-59/s8-client-row/`（`references/` 为
gitignored 本地目录，不在 GitHub 仓库内 —— 上模板即其产品化等价物）。
