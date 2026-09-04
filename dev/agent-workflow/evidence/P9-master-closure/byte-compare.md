# R125 byte-compare 记录 — 生成产物 vs 已验证产物

日期：2026-09-04。tree = `int/P9-master-product-closure` @ `8cf9fcb`（.worktrees/P9-MC）。
方法：`Get-FileHash -Algorithm SHA256`（SHA-256，大写 hex）。本会话在合并后 tree 上对生成产物**重新计算**（非转录旧值）。

## 1. client composition shim（bundle）

| 项 | SHA-256 |
| --- | --- |
| 生成：`packages/client/composition-shim/client-bundle.js`（`pnpm build:composition` 之 `scripts/build-client-composition.mjs`，PLAIN 变体，非 `--probe`） | `2097CE5E570B187F4F163DD09C8FBEE9BF2E04298120B7EA221229423CB86997` |
| 参考：`references/.dsh-test-s8-2026-09-04T12-26-59/s8-client-row/client-bundle.js`（R122 干净世界冒烟已验证的 s8-client-row 工件，world home …T12-26-59） | `2097CE5E570B187F4F163DD09C8FBEE9BF2E04298120B7EA221229423CB86997` |
| **结论** | **byte-identical（match=True，本会话复测）** |

含义：master 上 `pnpm build:composition` 可复现 R122 live 验证过的 client bundle（identity CSS class maps + `<style>` 注入的单文件 `window.__ModuleLoader__.load` 包）。构建器代码逐字源出 `evidence/P9/s8/s8-bundle.mjs`；移除未用 import（`readdirSync`/`statSync`）后输出 byte-match 已复验（不影响产物字节）。

## 2. runtime dist glue（agent-bindings.mjs）

| 项 | SHA-256 |
| --- | --- |
| 放置：`packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs`（`scripts/place-dist-glue.mjs` 从 `packages/runtime/src/plugin/live/agent-bindings.mjs` 逐字节复制） | `D50D3B3FBE371078B31208DC1E87F2DA1D5DE309D243E99E6AE9BB452B40225B` |
| 参考：RC1 dist 已验证副本（R122 boot 自愈 sync 步放置的 byte-identical glue；t12-vertical.mjs L403-412 先例「tsc 从不产出 .mjs：FINAL glue 必须 byte-identical 放置」） | `D50D3B3FBE371078B31208DC1E87F2DA1D5DE309D243E99E6AE9BB452B40225B` |
| **结论** | **byte-identical** |

## 3. 为什么这两个 byte-match 是安装面关键

- `upstream-resolver.mjs` 走 `register(new URL(candidate, import.meta.url))` 布局候选列表（dist 或 source），**无需** dist 副本；
- `agent-bindings.mjs` 是 row 所有 `glueUrl` 的**唯一目标**（无 fallback）→ dist 缺失 = host row 不可加载 → 必须由构建链放置（`place-dist-glue.mjs` fail-closed：src 缺失或 `packages/runtime/dist` 根缺失即报错退出）；
- shim 是 DSH_HOME 侧挂载行（`dsh.client` manifest + `./client` export）的 bundle 源 —— T10 裁决：产品包 package.json 不动、无 `./client` export，composition 侧 shim 为既定安装形态。

两个 byte-match 合起来 = 「fresh clone + `pnpm install && pnpm build && pnpm build:composition` 得到的安装面，与 R122 在 0.1.2-rc.1 上 live 验证过的安装面逐字节一致」。
