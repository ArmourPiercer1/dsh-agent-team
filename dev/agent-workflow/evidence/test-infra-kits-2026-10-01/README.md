# test-infra kits 2026-10-01 — tracked-run 证据索引（PR #51 内容）

> 本目录 = test-infra PR #51（branch `test/kits-stable-probe-consent-fix`）tracked kit 的**最终实宿主证据**。
> 产品 mergeSHA（被测树）= `c19af1954239c6b3933e708fd9bdb0d50dbe1ea4`（分支 base；分支只改 `tests/kits`，产品树字节一致）。
> 宿主 = 主仓 pristine test-use `46a7f68b0922371ce7144b668b90e377d8e799f4`（0.1.7-rc.1）；端口 = 3180 族（3182-3186 + mini-MCP 3491-3498 + mock 3497/3498+3506）；
> homes = 各 worktree `tests/homes/<stamp>`（gitignored，PASS 自清）；**stable :3080/:3180 = 仅 kit H1 腿只读 pre==post 观测，零触碰**。
> 无 scratch —— 被测 tracked kit = PR 内容本身（node_modules = 从 closure worktree 按包符号链接，fresh worktree 未安装所致，环境注记；不影响 kit 语义）。

| 日志 | 内容 | 判定 |
|---|---|---|
| `battery-t1-e12-tracked.log` | **E.12 tracked kit**（PR #51 修订版：probe 修正 + Finding-J keyed-consent + **严格 S9**（精确前缀 + UUID/fallback 形状）+ **新 S10 freshness**） | **VERDICT PASS — all 16 criteria green（14 场景 + H1/H2）；world cleaned；EXIT=0**（2026-10-01 11:40:34Z）。S9 严格断言 + digest 重算 + S10（b3a/b3b/b3c 两两不同 UUID）实测全绿 |
| `battery-t2-prf-tracked.log` | **prf tracked kit**（修订前代码 = 中间记录） | VERDICT: FAIL — 1 criterion(ia) failed: **G6**（披露环境阻塞 = 宿主 bash 沙箱后端在 agent 侧嵌套 wrapper 子树不可用）；EXIT=2。G5 gate-lane（create ACCEPTED + T9 durable team-root）+ 其余全腿绿 |
| `battery-t3-prf-tracked-fixed.log` | **prf tracked kit（外部审查 3 处小修后 = 最终记录）** | VERDICT: FAIL — 1 criterion(ia) failed: **G6**（同披露环境阻塞）；EXIT=2。G5 gate-lane 在**严格 positive-integer durableGeneration 断言**下 PASS（T9 真实持久化实测，断言收紧未伤 lane）；其余全腿与 t2 一致 |

**G6 环境阻塞（精确分阶段诊断 = closure 证据 `…/closure/realhost-battery-post-merge/namespace-sandbox-diagnostics.md`，含 §8 OBSERVED/INFERRED 区分）**：
agent 会话位于 harness bwrap wrapper 子树（uid 1000，CapBnd=0，NoNewPrivs=1，setgroups=deny）—— 该子树内 bwrap EXIT=1（观测）；
用户普通 SSH 实测（用户回报）：同形 bwrap EXIT=0 → **差异源 = 外层 wrapper 层**（嵌套第二层非特权 userns+mountns 组合 + uid_map 写入在该特权链下被拒；裸 `unshare -U` 在两上下文均 EXIT=0，kernel 非 blocker）。
补齐动作 = 用户在普通 SSH 自行执行（agent 不自行外层执行）：同参数 backend probe（`bwrap --ro-bind / / --dev /dev --unshare-pid --proc /proc --die-with-parent -- true`）→ tracked PR-D + PRF 串行有界重跑；用户侧验收脚本（rc 显式捕获 + mktemp 唯一路径 + PIN_SHA 身份校验）= closure 证据 `user-side-acceptance-script.sh`。
**不承诺脚本成功**（未经用户侧实跑）；预期仅来自上列 agent 侧同 kit 记录。

**外部审查 3 处小修（本分支已含，t3 即修订后内容）**：
1. prf G5 `createdDurable`：移除 `durableGeneration === null` 宽容 → 断言 **positive safe integer**（v6 team-root 契约：null 仅 `none` 关系；remote handler 对 team-root 拒 null — `packages/remote/src/handlers/team.ts` L563-566；wire 校验 L504-511）；T9 真实持久化保障不变（t3 实测 PASS）。
2. prf G5 注释/label/criterion/saveScenario：fail-closed 方向 = **CROSS-KIT** 证据（E.12 S12b 腿 + 合并树 suite persona-kind 测试）—— 原 "S12b in same kit" 不实（prf 无 bare-preset 启动腿）。
3. prf scenario-14 header（旧 L133-155 区）：G5 段更新为 POST-RESOLUTION 准确表述（PR-F-G5 历史记录保留为 historical；与已改契约不再冲突）；不改历史证据。

**逐跑 world/run 目录**（本 worktree，untracked，保留供检）：`dev/agent-workflow/evidence/pre-alpha3-refactor/pr-e/prereq-2026-10-01T11-36-44/`（t1）、`pr-f/prf-2026-10-01T11-41-33/`（t2）、`pr-f/prf-2026-10-01T11-4x-*/`（t3）。
