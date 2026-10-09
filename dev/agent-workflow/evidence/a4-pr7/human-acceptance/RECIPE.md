# A4-PR7 W5 — 人工验收配方：让 GUI 里真的出现"损坏记录"提示条

这份配方把"损坏的审批记录"从**测试构造**变成**人在 GUI 前可以现场复现的世界**：
复制既有验收世界 → 在应用停止时，用存储层自己的写 API 追加**恰好一条**严格读取器拒收、
且不可归属的 `control-request-recorded` 记录 → 用生产读取面证明它到了 v9 响应 →
启动宿主，人在 Team 页面看到顶部提示条。

- 本目录三个脚本：`make-corrupt-world.mjs`（造世界）、`verify-corrupt-world.mjs`（离线验证，无 GUI 无服务）、
  `live-check.mjs`（可选：已启动宿主上的 HTTP 验证，仍然无浏览器）。共享实现见 `world-seam.mjs`。
- 每一步的**实测原文**在 [`FINDINGS.md`](FINDINGS.md) 与 [`raw/`](raw/)。本配方里出现的每条命令都在 2026-10-09 真跑过。
- 红线（脚本自己会拒绝越界）：只写 `tests/homes/<world>`；不碰 `:3080` 及其 `DSH_HOME`；端口只用 3180 族 / 3491-3500；
  源验收世界 `tests/homes/a4-accept-20261007T16-57-26Z` 只读（实测校验见 FINDINGS §5）。

---

## 0. 准备（干净检出 → 可运行的构建产物）

```bash
cd /home/user/dsh-plugins/dsh-agent-team          # 或本分支的 worktree：.worktrees/w5-corrupt-world
export CI=true
export XDG_CACHE_HOME="$PWD/.tmp-xdg/cache"       # TEST_METHODS §5：缓存放工作区内

pnpm install
pnpm run build                                    # 生成 packages/*/dist —— 注入用的就是这套产物
pnpm run build:composition                        # 浏览器侧组合产物（GUI 需要）
pnpm run check:artifacts:head                     # 提交产物 = HEAD 一致
```

如果是在 `.worktrees/<x>` 里跑，先链接 pristine 测试运行时（TEST_METHODS §1；**不要 `git add` 它**）：

```bash
ln -sfn /home/user/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use tests/deepseek-harness-test-use
```

脚本的 `--repo` 默认是**脚本自己所在的那个检出**。在 worktree 里跑本目录的脚本时，那个 worktree 通常没有
`packages/*/dist`，脚本会明确报缺哪个产物——此时要么在 worktree 里 `pnpm install && pnpm build`，
要么直接指向已构建好的主检出：

```bash
node make-corrupt-world.mjs   --repo /home/user/dsh-plugins/dsh-agent-team --copy-only
node verify-corrupt-world.mjs --repo /home/user/dsh-plugins/dsh-agent-team --expect-count 0
```

（`--repo` 只决定"用哪套构建产物 + 哪个 `tests/homes/`"，世界路径始终是 `<repo>/tests/homes/<name>`。）

第 0 步实测过的期望末行（`check:artifacts:head`，2026-10-09，主检出 `f1e2a3af`）：

```text
DSH-ARTIFACT-VERDICT script=check-artifacts-at-head subject=commit rev=HEAD verdict=ok compared=1508 drift=0
[check-artifacts-at-head] HEAD carries its own build: the committed surface IS a fresh build of itself (1508 compared file(s)).
```

> 为什么第 0 步不能跳：`make-corrupt-world.mjs` 的"写"就是 `packages/runtime/dist/**` 里的
> `openTeamDomain` + `LedgerRepository`，`verify-corrupt-world.mjs` 的"读"也是。缺产物时脚本会明确报缺哪个文件。

## 1. 造世界（先只复制，让"注入前"读数留在同一个世界上）

```bash
cd dev/agent-workflow/evidence/a4-pr7/human-acceptance
node make-corrupt-world.mjs --copy-only                  # 复制世界，账本一字未动
node verify-corrupt-world.mjs --expect-count 0           # ← 注入前读数（期望 0）
node make-corrupt-world.mjs                              # 追加恰好一条损坏记录
node make-corrupt-world.mjs                              # 再跑一次：幂等，什么都不写
node verify-corrupt-world.mjs                            # ← 注入后读数（期望 1）
```

期望（实测原文：`raw/01`…`raw/06`）：

- 注入前：`corruptCount = 0`，`corruptLegs = []`，`VERDICT: PASS`；
- 注入：`appended row : sequence 15 (factType control-request-recorded)`、`ledger rows : 14 -> 15`；
- 再跑：`already injected : the damaged row is durable at sequence 15 — NOTHING WRITTEN (idempotent).`；
- 注入后：READ A（`ControlService.listControlState`）与 READ B（s6 dispatcher →
  `team.listCorruptControlLegs`）**都是** `corruptCount = 1`、`sequence 15`、`disclosesMember false`，
  并打印 `marker cross-check: injector recorded sequence 15 and the wire served it`。

世界路径（脚本自己会打印；固定名字，便于反复运行）：

| 项目 | 值 |
| --- | --- |
| 世界（`DSH_HOME`） | `tests/homes/a4-w5-corrupt-acceptance` |
| 账本文件 | `tests/homes/a4-w5-corrupt-acceptance/storages/team_domain.json` |
| Team（root session） | `session-a4-accept-boot` |
| 损坏记录 | ledger `sequence 15`，`requestId req-a4w5-human-acceptance-damage`，不可归属 |

`--dry-run` 全程不写盘；`--world <dir>` / `--source-world <dir>` / `--root <id>` 可覆盖默认值。

## 2. 启动这个新世界（`boot.mjs` 支持 `--world`，无需改它）

`dev/agent-workflow/evidence/a4-pr76-acceptance-world/boot.mjs` 读 `--world`（默认才是
`tests/homes/a4-accept-20261007T16-57-26Z`），并会按新世界路径重新生成 `profiles/web/cordis.patch.yml`、
`blueprints/`、`p6t6-directive.json`。用 **3180 族**里空闲的一对端口（这里 3181/3492；boot.mjs 自己会拒绝族外端口，
并在启动前后探测 `:3080`）：

```bash
cd dev/agent-workflow/evidence/a4-pr76-acceptance-world
node boot.mjs --detach --port 3181 --mock-port 3492 \
  --world /home/user/dsh-plugins/dsh-agent-team/tests/homes/a4-w5-corrupt-acceptance \
  --repo  /home/user/dsh-plugins/dsh-agent-team
```

输出里会打印一行带 token 的 URL，形如：

```
http://127.0.0.1:3181/?token=…
```

（实测那次：`raw/08-boot-supervisor.log`；宿主侧日志 `raw/09-host-log-tail.log`。）

> **停止方式（重要，实测坑）**：这个环境里 `boot.mjs --stop` 不可靠——`.accept-host.json` 记录的 pid
> 是**当时那次进程调用所在的 pid 命名空间**里的（实测 marker 写的是 `supervisorPid: 2, hostPid: 15`），
> 换一次 shell 再 `--stop`，pid 已指向别的进程，实测那次反而把自己的 shell 打成了 `exit 143`，宿主仍在监听。
> 人自己在终端里跑（同一个 shell，Ctrl-C 停掉 supervisor）没问题；在 agent / 沙箱式环境里请停掉
> **启动 supervisor 的那个作业**（supervisor 收到 SIGTERM 会带走宿主 + mock）。实测清理见 `raw/10-integrity-and-ports.log`。

## 3. 人在 GUI 里应该看到什么（§7.7 的观察点）

打开上一步那条 URL，进入这个 Team（`session-a4-accept-boot`）的 Team 页面。团队正文**最上方**应出现固定、不可关闭的提示条：

- 汇总行：`控制账本存在无法解析的损坏记录（仅提示，不改变执行语义）: 1`
- 逐行：`记录 #15 — 无法归属到具体成员（团队级提示） · request req-a4w5-human-acceptance-damage`
- 不出现"其余损坏记录未在此列出"（本次只有 1 条，`truncated: false`）
- 不出现 `审批记录完整性检查暂不可用…` 那条中性提示（那是读取失败时的另一条路，见 W4 F1）
- DOM 上可核对：`[data-team-control-corruption]`（`role="alert"`）、`[data-team-control-corruption-leg]`、
  且该行的 `data-team-control-corruption-attributable="no"`

措辞逐字来源：`packages/client/src/ui/locales.ts` 的 `view.corruption.*`（zh 341-346）；渲染组合见
`packages/client/src/ui/TeamView.tsx` 1450-1483（`summary + ': ' + corruptCount`，`记录 #<sequence>` + 归属后缀 + ` · request <requestId>`）。
英文界面则是 `The control ledger carries corrupt records that cannot be parsed (visibility notice only — execution semantics are unchanged): 1`
和 `record #15 — not attributable to a specific member (team-level notice) · request req-a4w5-human-acceptance-damage`。

顺带确认（同一次 `live-check.mjs` 实测，`raw/07`）：提示条出现的同时，**这个 Team 其他地方照常读**——
`team.getProjection` 正常返回 5 个成员（`inst-leader` RUNNING，两个 CREATED，两个 ARCHIVED）与绑定的 blueprint，
`team.getLedgerPage` 返回 `total=15`（含被拒收的那一行）。也就是说这是**严格读取器拒收一行**，不是整个账本读失败。

想在开浏览器之前先确认数据侧到位（可选）：

```bash
cd dev/agent-workflow/evidence/a4-pr7/human-acceptance
node live-check.mjs            # 读新世界 .accept-launch.json 的端口+token，只读三个 team-remote 方法
```

## 4. 清理

停掉宿主（见第 2 步的停止方式说明），然后删掉这个世界：

```bash
cd /home/user/dsh-plugins/dsh-agent-team
rm -rf tests/homes/a4-w5-corrupt-acceptance
```

只删这一个目录即可：源验收世界从未被写入（`raw/10-integrity-and-ports.log` 里 `sha256` 与 mtime 双重核对）。
`tests/homes/**` 是 gitignored，本来就不该进 git；token / `.accept-launch.json` 同样不得提交。

---

## 这份配方**没有**主张的事

- 我没有点 GUI（§7.7 是人的验收）。我证明的是**数据侧到得了 v9 响应**：离线的
  `ControlService` + s6 dispatcher，以及**已启动宿主**上真实 HTTP `team.listCorruptControlLegs` 都返回
  `corruptCount 1 / sequence 15 / disclosesMember false`。GUI 里那一行的存在，还需要人现场确认。
- 损坏记录只有**一种形状**（不可归属）。自带归属线索的那一行（`disclosesMember: true`）仍只有
  `packages/runtime/test/a4w1-corrupt-warning.test.ts` 的自动验收覆盖，本配方没造。
- 更多细节、限制与未验证清单都在 [`FINDINGS.md`](FINDINGS.md)。

## 重启后端后恢复会话（必读，否则会被「会话不可用」卡住）

后端重启后进入既有 Team 会话时 composer 会显示 **「会话不可用」**（输入框与工具条均禁用，实测）。恢复流程：

1. 打开 **团队** 标签；
2. 在 **成员组** 的 Leader 行点 **「以 Team 模式打开 / 回到 Leader」**；
3. 等按钮右侧出现 **「Team 模式」** 字样；
4. **刷新页面**（这一步承重，缺它输入框一直是禁用）。

刷新后输入框才可用。机制与归档 gate 的冲突记录见 `RUN-20261010-check2-and-reopen.md` 第 2 节。
