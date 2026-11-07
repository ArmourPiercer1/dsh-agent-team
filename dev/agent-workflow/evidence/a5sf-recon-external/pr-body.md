RECON-EXTERNAL

# E 面（External / 非数据面）可达性侦察 — 只侦察，不改装配

**基座**：`235e1af8b`（本分支 worktree 冻结）｜ **分支**：`recon/e-external-20261113`
｜ **Host**：`639ed01539`（0.2.0-rc.2，pinned）｜ **记录类**：`DEV-LIVE`，`eligible=false`
｜ **不改**：产品源码 / 矩阵 / 登记册 / STATUS / `V@B` / Member 生命周期。

## 结论

受治 Member 的模型可见面实测 **43** 个名字（26 产品工具 + 15 `team_*` + 2 测试 fixture）。

- **实际能用**：`job_list`/`job_output`/`job_kill`（真实分派到宿主 `ctx.jobs`，本 preset 无
  producer，恒 `(no background jobs)`）；`skill`（真实 `ctx.skills` 查询，正文路径未受 a5sf 中介）；
  `workflow`（**真实 PTC 子进程执行体**，模型写 JS，返回 `42`）。
- **只是看起来在面上**：`run_code`（PTC 展示名，`mode=native` 时不存在）；`lsp`（模块在 pinned
  host，产品零接线）；MCP 工具族（alpha.1 接线在，shipped `mcpServers: []`）。
- **完全不在面**：`mcp__*`、MCP resources 族、`terminal_*`、stdio MCP。

**这张面上没有任何受治执行路径**：三条可执行体 **0 条 Alpha.5 guard fact、0 个 face**；面上唯一
受治的 `bash` 属于 Subprocess/Shell-PTY 面（`cordis.patch.yml:161-164`），不属于 E 面。

## 落地的两个文件（都不是产品源码）

1. `tests/world-factory/drivers/a5sf-recon-external/run-boot.mjs` — 从 `a5sf-live-member` 派生：
   **保留完整 surface**（祖先在 `run-boot.mjs:1011` 把面裁剪成 `bash`+`team_*`，因此它的
   `member-surface.json` 只有 16 个名字，结构上无法回答"某工具在不在面"）；新增三条只读 probe
   （`job_list` / `skill <不存在>` / `workflow return 42`）；修掉祖先每 boot 泄漏一个 dev-live 槽位
   的缺陷（`lease.release?.()` → `releaseSlot`/`finish`）。
2. `dev/agent-workflow/evidence/a5sf-recon-external/` — README（七项账 + A–E 归因 + file:line）、
   agreeing pair（`runs/boot01|boot02`，`differing=[]`）、grant、ledger、驱动日志、早期尝试 archive。

## 证据要点

| 事实 | 值 | 位置 |
| --- | --- | --- |
| 面大小 | 43（41 纯产品） | `runs/boot01/e-face.json`、`member-surface.json` |
| `run_code` / `lsp` / `mcp__*` | false / false / `[]` | 同上 `presence` |
| `job_list` 真实返回 | `(no background jobs)` | `runs/boot01/member-transcript.txt` |
| `skill` typed 拒绝 | `skill "…" is unknown or no longer available` | 同上 |
| `workflow` 执行 | `completed (0 agents). Return value: 42` | 同上 |
| guard facts | 4（全部来自 `bash`；三条 probe 新增 0） | `guard-facts.json`、`counters.json` |
| workflow 未走 confined face | `confinedTurnLaunchers=1` 未增 | `counters.json` |

关键 file:line：`tool-jobs/src/index.ts:365`（`ctx.jobs.list`）、`tool-skill/src/index.ts:136,143`
（typed 错误）、`workflow-ptc/src/host.ts:279-280` + `ptc-runtime-node/src/index.ts:236`（真子进程 +
宿主 `sandboxPolicy`）、`agent-bindings.mjs:2141-2150`（MCP streamable-http 挂载）、
`cordis.patch.yml:130/197/199/201/284/288`（preset 行）。

## 不关闭什么

`DEV-LIVE` 不是候选证据（`DEV_LIVE_EVIDENCE_NOT_CANDIDATE`），不能产出 `V@B=yes`；本 PR 不改任何
矩阵等级，也不把"面在"读成"验收"。E 面"没有受治执行"是**侦察结论**，不是修复；修复需要在
Alpha.5 面清单里给 `workflow`/`skill`/`jobs` 决定归面，那是另一张卡。

## 复跑

```sh
node tests/world-factory/drivers/a5sf-recon-external/run-boot.mjs --boots 2
```

需在带 `node_modules` 与 pristine `tests/deepseek-harness-test-use` 的 checkout 上跑（本 worktree
没有这两个 gitignored 目录）；端口 3180 族，`:3080` 不碰，boot 后删 `tests/homes/<world>`。
