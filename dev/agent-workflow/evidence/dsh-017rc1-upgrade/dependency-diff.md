# U1 — 依赖图统一 diff（0.1.5-rc.2/0.1.2-rc.1 混合 → 0.1.7-rc.1 单基线）

**日期**：2026-09-24
**基线**：base = `dc6fb6f`（= origin/master `3e402b1` + 本地 bookkeeping，升级分支起点）
**原则**（计划 §1）：禁止继续混用 0.1.2 / 0.1.5 / 0.1.7 的 DSH package graph；所有实际被本插件编译或运行消费的 DSH packages 统一到 0.1.7-rc.1。

## 1. 旧状态（dc6fb6f 实查，计划 §1 声明与实态对照）

| 包 | runtime deps | runtime devDeps | client devDeps |
| --- | --- | --- | --- |
| dsh-agent / dsh-llm / dsh-mcp-client / dsh-session / dsh-storage-domain | 0.1.2-rc.1 | — | — |
| dsh-spill / dsh-spill-local | 0.1.5-rc.2 | — | — |
| dsh-agent-loop | — | 0.1.2-rc.1 | — |
| dsh-agent-presets（旧包） | — | 0.1.2-rc.1 | — |
| dsh-scope / dsh-session-projection / dsh-skill / dsh-system-prompt / dsh-tools | — | 0.1.2-rc.1 | — |
| dsh-client-locale / -store / -test-runtime / -ui-conversation / -ui-primitives / -ui-slots | — | — | 0.1.2-rc.1 |
| cordis | — | 4.0.2 | 4.0.2 |
| cordis-plugin-group / -include / -loader | — | 1.0.2 / 1.0.7 / 1.0.3 | — |

与计划 §1 声明一致（大量 0.1.2-rc.1 + spill 双包 0.1.5-rc.2 + client 全 0.1.2-rc.1）。

## 2. 新状态（统一后）

- 全部 `@deepseek-ai/dsh-*` 直接依赖 → **`0.1.7-rc.1`**（registry 实查：21 个相关包均发布 0.1.7-rc.1，含新 `dsh-agent-preset` / `dsh-agent-preset-registry`；0.1.7-rc.1 发布时间 2026-09-23，当日安装，触发 pnpm 供应链 `minimumReleaseAge` 策略 → pnpm 自动写入 `pnpm-workspace.yaml` 的 `minimumReleaseAgeExclude`（逐包列表，自说明，随本提交入库））。
- 旧包 `@deepseek-ai/dsh-agent-presets` → **删除**；新增 `@deepseek-ai/dsh-agent-preset-registry`（U2 preset 声明模型的 registry 面；若 U2 最终未 import 则 U7 前移除并重新生成 lockfile）。
- **cordis vendor 同步**（计划 U1.4：以 0.1.7 upstream 实际 vendor 版本为准，同 minor patch 提升）：

| 包 | 0.1.5 upstream vendor | 0.1.7 upstream vendor | 本插件新 pin |
| --- | --- | --- | --- |
| @deepseek-ai/cordis | 4.0.2（vendor/cordis @ fb2c4b9e） | 4.0.4（vendor/cordis @ 46a7f68b） | 4.0.4 |
| cordis-plugin-include | 1.0.7 | 1.0.9 | 1.0.9 |
| cordis-plugin-loader | 1.0.3 | 1.0.5 | 1.0.5 |
| cordis-plugin-group | 1.0.2 | 1.0.4 | 1.0.4 |

- 非 DSH 依赖零改动（yaml ^2.9.0 / zod 4.4.3 / react 18.3.1 / jsdom / @testing-library / @types/* 不变）。

## 3. lockfile / 安装证据

- `pnpm install`（worktree，store-dir = 仓内 `.pnpm-store`）exit 0，13.8s；
- `pnpm-lock.yaml` 变化：3886 行（+1479/−2566 全仓统计含 manifest；lockfile 主体 = 0.1.2/0.1.5 节点 → 0.1.7-rc.1 节点重解析）；
- U1.5 核验：`grep -rn "0\.1\.2-rc\.1\|0\.1\.5-rc\.2" packages/*/package.json pnpm-lock.yaml` = **0 命中**；
- npm registry 逐包核验（registry API）：dsh-agent / dsh-agent-loop / dsh-llm / dsh-mcp-client / dsh-session / dsh-session-projection / dsh-scope / dsh-skill / dsh-system-prompt / dsh-tools / dsh-spill / dsh-spill-local / dsh-storage-domain / dsh-agent-preset / dsh-agent-preset-registry / dsh-client-locale / dsh-client-store / dsh-client-test-runtime / dsh-client-ui-conversation / dsh-client-ui-primitives / dsh-client-ui-slots — 全部 HAS 0.1.7-rc.1。

## 4. 已知风险（U2–U6 消化）

lockfile 统一只保证包版本一致；**API 漂移**由 typecheck/测试在 U2–U6 暴露（计划 §1.1 已声明的 breaking surfaces：preset 声明模型 / agent/created 串行异步 / session log V4 / client multi-instance / MCP SDK v2 / spill token budget / plugin version compat check）。
