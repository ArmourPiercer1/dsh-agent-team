# S8-D 整合记录（2026-09-04，主 Agent）

S8-C vertical 收口后（attempt-32 全绿，见 R115）的整合动作与决定。

## 1. temp 探针清理

- **已删（74 个）**：全部取证/诊断 temp 文件 —— `temp-trace25*…31*.mjs`、`temp-projprobe*`、`temp-proj30/31.mjs`、`temp-sesslist30*.mjs`、`temp-s5*/s6*/dom26*/store26-29*/teamrows` 系列、`temp-cwd30.mjs`、`temp-dom30.mjs`、`temp-ledger30/31.mjs`、`temp-s7probe30*.mjs`、`temp-s7forensic30*.mjs`、`temp-timeline31.mjs`、`temp-hcresp.mjs`、`temp-members-sec.mjs`、`temp-store.mjs`、`temp-bindings.mjs`、`temp-bundlecheck.mjs`、`temp-compat.mjs`、`temp-dumpcompat.mjs`、`temp-dumps5.mjs`、`temp-send29.mjs`、`temp-sessions27.mjs`、`temp-trace-tail.txt`、`temp-trace29-out.txt`、`temp-commit-msg-8.txt` 等。
- **保留工具（3 个 temp + 7 个 s8-*）**：
  - `temp-pline2.mjs`（长行 verbatim 打印，graph/日志长行读取）
  - `temp-yamlcheck.mjs`（graph.yaml strict YAML 校验，S9 落档仍需）
  - `temp-printlines.mjs`（行打印）
  - `s8-resolve-probe.mjs` / `s8-authprobe.mjs` / `s8-401probe.mjs` / `s8-fixurl.mjs` / `s8-verify.mjs` / `s8-presetprobe.mjs` / `s8-compatprobe.mjs`（boot 诊断探针族，S9 若需复验 boot 面可用）
- **`s8-mock.mjs` 去留决定：保留**。理由：`s8-boot.mjs` 文档头（L22）将其记为 standalone mock 备选（现 boot 用 in-process mock：`packages/tools/harness/mock-deepseek.mjs` 的 `startMockModel`）；删除需连带改 boot 文档头，收益为零；体积小、无副作用。
- `browser/vertical-attempt32-utf8.log`（我读取用的 UTF-8 派生副本）已删；规范证据 = `browser/vertical-attempt32.log`（原始 Tee 输出，UTF-16）。

## 2. worktree 卫生

- **已删** `.worktrees/P9/packages/runtime/dist` 与 `.worktrees/P9/packages/client/dist`（S8 完成，按卫生规则移除；两者均 gitignored，worktree porcelain = 0）。
- tip 不变：`47b41df`（bug #9 修复，`task/P9-ui-legacy-reuse`）。

## 3. test-use web-dist 重建 = 预期偏差（文档化）

- `references/deepseek-harness-test-use` 源树保持 pristine（@ cd5ef814，porcelain 0）——pristine-upstream 角色未破坏。
- 唯一本地偏差：gitignored 构建产物 `apps/web/dist`（2026-09-03 22:24:55 重建，P9/T12 期间为让被 serve 的 Web shell 匹配当前 client 契约而重建）。该目录不入库、不进入任何 commit，属**预期偏差**：源 pristine + 本地产物新鲜 = S8 真机 vertical 的成立条件（boot 直接 serve 该 dist）。任何复跑若 dist 缺失/过期，先重建再 boot。

## 4. 保留证据清单（attempt-32 最终 vertical）

- `browser/vertical-attempt32.log`（全部 assert 行）
- `browser/vertical-trace.json`（42 次 team-remote 调用 request/response；trace body 截断 2000 字符）
- `browser/vertical-console.json`（console errors = 0）
- `browser/vertical-01…10-*.png` / `*.html`（10 组截图/DOM：shell → workspace → s1 → s2 → s3 → s4 → s5 → s6×2 → s7-archived → s7-restored → s8-reloaded → s9a → s9b）
- `state.json`（attempt-32 world：home `.dsh-test-s8-2026-09-03T20-25-30`，pid 55284 已 stop，端口释放）
- `instances/instance-port3180.log`（instance 日志尾；ERROR 行 = 0）
- boot 驱动 `s8-boot.mjs` + vertical 驱动 `s8-browser.mjs`（含 gap #1–#6 全部 driver 修复）+ `shim/`（client bundle 834110 B sha `4a72c0e8…`）

## 5. 状态

S8-D 整合完成。剩余：S9 收口（DoD 15 + bottom-line 3 + reuse-audit 五档 + P9_VERDICT）+ early-P9 遗留修复（tools TS6059、composition-smoke stale path，独立 commit）。No push（未授权）。
