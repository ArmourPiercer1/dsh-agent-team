# INSTALL — 在独立 DSH 实例上安装挂载 dsh-agent-team

> **性质**：master 产品（R125 收口，2026-09-04）的安装指南。权威状态见 `docs/STATUS.md`；
> 本文件是快照，与 graph.yaml + 日志冲突时以后者为准。

## 1. 前提

| 项 | 要求 |
| --- | --- |
| DSH（deepseek-harness） | **0.1.2-rc.1**（已测基线；测试实例同版本，`docs/TEST_METHODS.md` §1） |
| Node | `^22.19.0 \|\| >=24.0.0`（repo `engines`） |
| pnpm | `11.7.0`（repo `packageManager` pin） |
| 模型 | 目标机器可用的真实 provider/model + DSH 凭据（真实功能测试必需；测试世界的假模型配置不可用于真测） |
| 红线 | 安装只触 DSH_HOME profile 层（公开 seam）；**不改 DSH 源码**（CORE PATCH BUDGET = 0，零上游补丁） |

## 2. 构建（目标机器）

```bash
git clone <repo-url> dsh-agent-team
cd dsh-agent-team
git checkout master
pnpm install
pnpm build              # 9 个包 tsc → packages/*/dist
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

## 3. 挂载（DSH_HOME/profiles/web/cordis.patch.yml）

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
        seedMembers: []
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
      name: "file:///<REPO>/packages/client/composition-shim/index.js"
```

- `<REPO>` = 目标机器 clone 目录的绝对路径；file:// URL 一律**正斜杠**
  （Windows 例：`file:///D:/code/dsh-agent-team/...`）。
- `blueprintSource` 为内联 YAML 字符串：leader/members 的 `templateId`、`persona` 按团队
  设计填写；`requirements` 引用的 persona 必须与 `environmentFacts` 中 available 的
  persona 对齐（示例：`persona/standard`）。
- `rootSessionId` 每个世界唯一；复用既有世界时按现状调整。
- `defaultWorkspace`（可选）：Root 默认 workspace 目录。
- client 行若 file:// 形式不被目标 DSH 版本接受，退回验证过的相对路径形态：把
  `packages/client/composition-shim/` 复制进 `DSH_HOME` 内（如 `DSH_HOME/team-client-row/`），
  行写 `name: "../../team-client-row/index.js"`（R122 验证世界即此形态）。
- 热加载（可选）：profile `package.json` 的 `dsh.profile` 加 `"patchReload": "live"`，
  否则改完 `cordis.patch.yml` 重启 `dsh web` 进程。

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
| host 行加载失败 | 核 file:// 路径（正斜杠、文件存在：`pnpm build` 已跑）；`bootPhase`/`rootSessionId` 与既有世界冲突 |
| client 行加载失败 | `pnpm build:composition` 是否已跑（`composition-shim/` 存在）；改试 §3 的相对路径形态 |
| 页面 404 | 目标 DSH 缺 web shell 产物（源码安装 DSH 需在该机 `pnpm build:web` 一次；发布版 DSH 不应出现） |
| 成员轮次不动 | 模型凭据/`staticModel` 配置（§4）；查看 DSH host 日志 |

## 7. 测试世界参照（本机，local-only）

R122 rc.1 验证世界的完整挂载样本（含假模型测试装置与 p6t6 观测行、目录选择器
headless pin）：`references/.dsh-test-s8-2026-09-04T12-26-59/profiles/web/cordis.patch.yml`
+ `references/.dsh-test-s8-2026-09-04T12-26-59/s8-client-row/`（`references/` 为
gitignored 本地目录，不在 GitHub 仓库内 —— 上模板即其产品化等价物）。
