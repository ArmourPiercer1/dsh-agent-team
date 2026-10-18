# ③ 安装包固定 SHA + 回退链 + 最小试用脚本

## 1. 固定 SHA（现场 `ls-remote` 原样粘贴，2026-10-18T20:4xZ 终值；开轮 19:4xZ 值见回退链 `b6d7c48a` 行）

```
$ git ls-remote origin refs/heads/master
5885e46ec2bcbfa7bfa58882d835801ec8b79e1f	refs/heads/master
```

- **插件源固定 = 上述全量 SHA**（`#<SHA>` 形式，禁短 SHA 拼接；短名 `5885e46e` 仅作行文引用）。**窗口内推进实证**：kit H1b 腿在 r4 轮以 `b6d7c48a ≠ 5885e46e` fail-closed 拦到 #340 合入=固定 SHA 纪律的现场价值。
- **宿主（运行时）固定** = master `tests/paths.mjs` 权威常量（本轮现场读）：
  `TEST_USE_BASELINE_SHA = 639ed015397290b3745d163aafe02ffee4aa3f84`（0.2.0-rc.2）、`CLIENT_COMMIT_HASH = 639ed01539`；宿主树 `tests/deepseek-harness-test-use` 实测同 SHA、porcelain 0。
- **带外部署输入固定**（Landlock 预启动器，不在发布面）：`git show <安装SHA>:packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py`——**必须与安装同 commit**：
  - `5885e46e` / `b6d7c48a` / `2d1fa21c` / `9116c4a6` → `sha256 1264ea584e3438d6d831c0c8426f5663579f638556af9376d3a6e3617e9736e3`（26992 B；**#340 未动 launcher**，现场 sha256sum 复核）
  - `b35b9ea7` / `fee982d2` → `sha256 b9280090856e5a47…`（r4-b2 I8 在册）
  混用会被 `launcherSha256`/trustRoot 双门 fail-closed 拒（不会静默跑错字节）。
- **安装命令（公开包面，一条）**：
  `node tests/deepseek-harness-test-use/apps/cli/lib/bin.js plugin --profile web add 'github:ArmourPiercer1/dsh-agent-team#5885e46ec2bcbfa7bfa58882d835801ec8b79e1f'`（`DSH_HOME` 显式；profile `pnpm-workspace.yaml` 写 `storeDir` 钉工作区内）。

## 2. 回退链（重装上一固定 SHA；逐点一行语义差 + 安装面字节差=实测）

回退法 = 同一安装命令换 `#<旧全量 SHA>`；部署输入换同 commit 字节（上表）。**取消语义分层**：`5885e46e` 起 `cancelled:true` 可达（仅 user/parent 成因）；**回退到链上任何更早点=取消语义回退为恒 false 渲染**（#340 前现状，无害但试用者须知）。

| SHA | 一行语义 | 安装面字节差（对下一点，实测 ls-tree 逐文件） |
| --- | --- | --- |
| `fee982d2` | **#336**：shell 臂出口码保真——越界内核拒现形 `bash · exit=1`（此前渲染 `exit=0`），`exitPassthrough` 只到 shell 臂，glob/search 完成律原样 | 对 `b35b9ea7`：差 0 |
| `b35b9ea7` | **#335**：纯证据合入（a5ie-r2b/r3 装面排练记录 264 文件入库），**产品字节与上一点全同** | 对 `9116c4a6`：changed 3（`provider.d.ts/.map`+`provider.js.map` 注释镜像随动） |
| `9116c4a6` | **#338**：launcher 注释口径收回（128+signum 不辨死因）→ 部署输入换 `1264ea58…`；无产品行为变化 | 对 `2d1fa21c`：差 0 |
| `2d1fa21c` | **#339**：master 卫生——`probe-mv*` 证据世界 66 文件仅去跟踪 + gitignore 缺口闭合；产品字节不动 | 对 `b6d7c48a`：added 1 + changed 5 |
| `b6d7c48a` | **#334**：PTC fs 半臂生产行——新增 `dist/…/live/ptc-escalation-row.mjs`（面 +1 → **1773**），`host.js/.d.ts/.map×3` + `agent-bindings.mjs` 随动；一次性 grant 裁决进审批瀑布（构造式注册，非 Team 零扩权） | 对 `5885e46e`：changed 12 |
| `5885e46e` | **#340（现 master）**：shell 取消臂——host `ToolExecutionInput.signal` 接上（仅 user/parent→`cancelled:true`；优先律 exited>timedOut>aborted）+ X6 re-scope 注 | —（头） |

**实测差（`b6d7c48a→5885e46e`，本会话 ls-tree 逐文件）**：added 0 / removed 0 / changed **12** = `plane-effect-backends.mjs` + a5p5-tools `backend-contract/pipeline/register` 族 dist 镜像（`.js/.d.ts/.map`）；三零重装实证 rootSha `3a3911a8fb494034…`（④ r5）。

## 3. 最小试用脚本（<20 行，可复制；本轮 ④ 即按此实跑）

[rc-trial.sh](./rc-trial.sh) 全文（其调用的 `rc-trial-kit.mjs` 与 `helpers/` 均在本目录、helper 为 master 同 commit 字节逐字副本）：

```bash
#!/usr/bin/env bash
# rc-trial.sh — Alpha.5 最小试用脚本（release-candidate-r1；<20 行）。
set -euo pipefail
R="$(git rev-parse --show-toplevel)"; SHA="$(git -C "$R" ls-remote origin refs/heads/master | cut -f1)"
git -C "$R" worktree add --detach "$R/.worktrees/rc-trial-audit" "$SHA" 2>/dev/null || true
E="$R/dev/agent-workflow/evidence/alpha5/release-candidate-r1"
test ! -e "$R/tests/homes/rc-trial-1"   # 世界必须全新（fail-closed）
node "$E/rc-trial-kit.mjs" --repo "$R" --worktree "$R/.worktrees/rc-trial-audit" \
  --home "$R/tests/homes/rc-trial-1" --port 3183 --reserved-port 3184 --mock-port 3491 \
  --store-dir "$R/.pnpm-store-a5ie-r4-b2" --evidence-dir "$E/runs/$(date -u +%Y-%m-%dT%H-%M-%SZ)"
echo "KIT_EXIT=$?  (0=GREEN 2=RED 1=FATAL; receipts 见 runs/<stamp>/criteria.json)"
```

（脚本内含覆盖注释：真网络装固定 SHA → 新 `DSH_HOME=tests/homes/rc-trial-1` → 3183/3184 启动 + mock 仅 LLM 位 3491 → `team.create` → `team_create_member` → 委派一个 bash 正写+一个越界负例 → 看渲染 `bash · exit=0` / `bash · exit=1` 真码 → 具名清理。）

前置：node ≥22.19 / pnpm 11.7.0 / python3（Landlock abi≥3 内核）/ 到 GitHub 的网络（真网络安装）/ 宿主树已按 TEST_METHODS §2 构建。想保留世界复查：追加 `--keep`。真人试用把 mock 换成真实 provider（`staticModel` 指真模型即可，其余装配不变）。
