# 阶段二 kit 执行留痕（PR-D C1/C2a + PR-F G6，landlock backend 生效态）

时间：2026-10-01 12:39–12:41 UTC。执行者：本会话（验收会话，独占 3182/3497 等测试口）。
授权链：helper 安装已获用户授权并留痕（helper-placement-20261001.md）【位置注记 2026-10-01：该留痕文件未提交入本仓——原件属独立 env session 记录，主仓 `dev/agent-workflow/evidence/` 无此文件；此引用保留为出处指向，非本仓可核路径。landlock-run helper 的用户自装动作另有 §9/图注在案】；kit 精确身份由主协调方下达：
审定 head `4757112c7153b12ed9a81f31699bb39d69c51fa7` = master merge `427219e443ece4d57ac8558f13850c5f42ff8330`
（tree 恒等，实测两 SHA `^{tree}` 均为 `5618124982bfb910e43bd7bbb6b3af86e396418f`）。

## kit 载体（只读使用）

- 路径：`.worktrees/test-kits-probe-consent-fix`，实际 HEAD = 审定 `4757112c71`（逐字）。
- worktree porcelain：7 条，**全部 untracked**（3 个 11:36–11:51 reviewer evidence 目录 + 4 个 node_modules 符号链接），tracked 文件零差异（`git status --porcelain | grep -v '^??'` = 0，运行前后均 0）。

## 运行与结果（真实宿主、嵌套拓扑）

| kit | 命令要点 | 结果 |
| --- | --- | --- |
| PR-D D.6 real-host gate（stamp `prd-control-2026-10-01T12-39-21`，host 3182 / mock 3497） | 自举真实 0.1.7-rc.1 宿主（test-use `46a7f68b09`）+ 插件 dist 经 profile-patch 装载 | **exit 0 全绿**：C1 5/5（**C1 bash 真实执行**，marker 落 `tests/deepseek-harness-test-use/tmp/.prd-gate/<stamp>/`）；C2 5/5（**C2a allow→执行、C2b deny→拦截 reason `decision-deny` 无文件**）；C3 7/7；C4 15/15（含 allow-voiding、typed `CONTROL_REQUEST_ABANDONED` 透传、exactly-once）；C5 4/4（同 home 重启全历史完好）；H1 3/3；H2 1/1 |
| PR-F F.6 GAP kit（stamp `prf-2026-10-01T12-41-15`，host 3182 / mock 3497 / mini-MCP 3491-3493） | 1 world 5 boots（create/resume/webdown/restore/ptc） | **exit 0 全绿 11/11（G1-G9+H1/H2）**；**G6 = 真实 300KB stdout（>64KB inline cap）spill → durable `artifact-read-granted`（instanceId inst-leader，source kind=shell-foreground stream=stdout toolName=bash，locator=/tmp/dsh-subprocess-*/…-stdout.log，grants=1）**；world 自清理（worldCleaned=true），端口全释放 |

## 宿主真实 selected backend 确证（按主协调方要求：以宿主运行产物为准，非手工 probe 复演）

- **PR-D：直接确证**。其 evidence `mock.log` 含 **10×** `landlock-run: partial enforcement (older Landlock ABI)` —— 该行为 landlock-run helper **每次受限子进程运行的 stderr 自报行**，经宿主工具输出回传模型、被 mock 记录 = 宿主工具命令**真实在 landlock-run 下执行**；同 evidence 中 bwrap 签名 **0** 次。⇒ selected backend = **landlock，enforcement = partial（如实）**。
- **PR-F：间接确证（分类如实）**。其 evidence 格式不持久化工具 stderr（mock.log 仅记 mock 自身回复行），故无 per-run 自报行；判定依据 = 与 PR-D 完全同树、同嵌套拓扑、provider 链确定性（嵌套 bwrap 必败 → landlock 唯一可用；若链 unavailable 则 fail-closed、G6 spill/marker 不可能存在，而两者均成功）。运行中 3 次 `ps` wrapper 采样未命中（采样时 kit 已自然结束）。如需 PR-F 自身的直接 wrapper 证据，可复跑 + 实时采样，未擅自加跑。
- 手工链原语复演仅作预测记录在案，不作为宿主验收。

## deny 文案匹配类（EROFS vs EACCES）

**未发生**：两份 evidence 中 `Read-only file system` 字样 0 次；无失败断言、无被改写断言。kit 内 deny 断言为 control-guard 层（`decision-deny`/`request-abandoned`/`no-request`），不依赖 bwrap EROFS 方言，真实 landlock EACCES 未触撞断言文案。主安全断言（无越界侧效）原样通过。

## 完整性 / 隔离 / 脱敏

- test-use：运行前后 HEAD=`46a7f68b09…`、porcelain=0（kit H1 + 本会话独立复核双证）。
- :3080/:3180 稳定实例零触碰（kit 只读 GET pre==post：401 / unreachable）；:3080 唯一监听 = 用户服务（MainPID 290638）。
- 端口：31/34 族运行后全空；本会话 worlds 全部清理（kit 自清）；`.worktrees/.../tests/homes/` 残留 `prf-2026-10-01T11-41-33`、`prf-2026-10-01T11-49-38`（+lock）为 11 点 reviewer 运行的遗留 world，**非本会话产物，未动**。
- 脱敏复核：两份 evidence 目录 grep **零** raw `lt-v1-<64hex>`、零 `?token=<val>`、零可用 `sk-` key；redaction 标记在场（`lt-v1-REDACTED`、`sk-user*` 形）。**观察项（不改 kit）**：PR-F console 输出（非落盘 evidence）在 throwaway-boot 行打印过一次完整 launch-token——evidence 已 scrub，但 console/终端留存面仍在，建议 kit owner 后续把该行也做脱敏。
- 真实 exit code 与断言计数一律原样记录（PR-D exit 0；PR-F exit 0；无任何"改断言凑 PASS"）。

---

# 精确可复核记录（主协调方补充要求，只读取证，未改产品/kit）

## 1. 两次运行的完整命令 / cwd / exit

| | PR-D | PR-F |
| --- | --- | --- |
| cwd | `/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/test-kits-probe-consent-fix` | 同左 |
| 命令 | `node tests/kits/pr-d-control-real-host/pr-d-control-real-host.mjs --worktree /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/test-kits-probe-consent-fix --testuse /srv/workspace/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use` | `node tests/kits/pr-f-closure-smoke/pr-f-closure-smoke.mjs --worktree <同上> --testuse <同上>` |
| exit | **0**（后台 job bash-19 completed） | **0**（后台 job bash-25 completed） |

## 2. kit 身份（审定 worktree，只读）

- worktree：`.worktrees/test-kits-probe-consent-fix`，HEAD=`4757112c7153b12ed9a81f31699bb39d69c51fa7`，tree=`5618124982bfb910e43bd7bbb6b3af86e396418f`（= merge `427219e443ece4d57ac8558f13850c5f42ff8330` 的 tree，实测恒等）。
- kit 文件 blob（HEAD:path）：PR-F `tests/kits/pr-f-closure-smoke/pr-f-closure-smoke.mjs` = `64b9d0cd01d20579e82b779ae7e5c20ad7da5af4`；PR-D `tests/kits/pr-d-control-real-host/pr-d-control-real-host.mjs` = `e878f7c2444351800c1f5d9fa5fcdc0fd071aae6`。
- 运行前后 tracked 文件差异 = 0（porcelain 仅 untracked 证据/node_modules）。

## 3. 证据目录绝对路径 + summary.json 权威计数

- PR-D：`/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/test-kits-probe-consent-fix/dev/agent-workflow/evidence/pre-alpha3-refactor/pr-d/prd-control-2026-10-01T12-39-21/`
  summary.json：**criteria=7，checks=40，checksOk=40，exitCode=0，pass=true**；分布 C1:5 C2:5 C3:7 C4:15 C5:4 H1:3 H2:1；hostTree=/srv/workspace/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use，clientCommitHash=46a7f68b09。
- PR-F：`/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/test-kits-probe-consent-fix/dev/agent-workflow/evidence/pre-alpha3-refactor/pr-f/prf-2026-10-01T12-41-15/`（27 文件）
  summary.json：**verdict=PASS，"11/11 criteria pass"，results=11 条**；run.log 断言行 = **21 PASS / 0 FAIL**（分布 G1:2 G2:2 G3:4 G4:3 G5:2 G6:1 G7:1 G8:1 G9:1 H1:3 H2:1）。

## 4. 计数澄清：21（历史口径）vs 11（本次口径）——同一 runner、同一契约、两套粒度

历史证据（同 worktree，stamp 11-41-33 / 11-49-38）：
- run.log 断言行 = **20 PASS + 1 FAIL（FAIL=G6）= 21 行**，分布与本次逐 criteria **逐行相同**（含 H1:3）；
- 其 summary.json verdict 措辞本身就是双粒度：**"10/11 criteria pass"**（criteria 层）+ 21 断言行（run.log 层）；
- 两次历史运行的 run.log 头 = `=== pre-alpha3 PR-F F.6 real-host GAP kit (11 criteria: G1-G9 + H1/H2) ===`，与本次头部逐字相同 ⇒ **同为 11-criteria runner，非另一 runner**。
⇒ 本次 "11/11" 是 criteria 层；"21 项" 是断言行层（本次同层为 21/21）。不混淆：历史 = 21 行中 G6 1 行 FAIL（criteria 层 10/11），本次 = 21 行全 PASS（criteria 层 11/11）。

**G6 契约同版核对（必查项）**：历史 11:4x 运行时 branch 上该 kit 的修订窗口 = `b9db6e80`(11:35:31)（git-pre 的 git-status/git-diff.log 均 0 字节 = 运行时 worktree 干净；证据未记录 kit 仓 HEAD 本身，修订归属由 commit 时序窗口锚定，509751ad=11:52:30 晚于两次历史运行）。`git diff b9db6e80..4757112 -- <pr-f kit>` 全部 6 个 hunk = **G5 post-resolution 措辞/断言（header 注释、135-159 文档、CRITERIA 的 G5 条目、main() G5/B5 段）+ scrubTokens 的 lt-v1 行（4757112 新增）**；CRITERIA 数组中 **G6 条目为未变更上下文行**；全 diff 的 +/- 行中 `G6|spill|settle|grants|artifact` 关键字命中 = **0**。辅助佐证：历史 FAIL 与本次 PASS 的 G6 断言名串 md5 相同（f1447c71…）。⇒ **G6 断言在 11:4x FAIL 与本次 PASS 之间逐字未变**。
历史 G6 FAIL 详情形态：`createOk=true grants=0 settleMs=null shape=false payloadHead=null`（spill 事实从未出现）——与当时 B2 helper 缺失（12:31 才落位）+ 嵌套 bwrap 不可用 ⇒ G6 沙箱 bash fail-closed 未执行的解释**高度一致；归因未独立复现（未重跑），如实标注**。

## 5. PR-F console 原始 launch-token 输出源码位置（只读定位，不回显值，未改源码）

- 发射点：**`tests/characterization/lib/instance.mjs:212`** — `log(\`throwaway boot OK: ${url}\`)`（把含 `?token=<raw>` 的完整 boot URL 打进 console/stdout）。
- 触发路径：kit `main()`（web profile 首用）→ `ensureWebProfile`（instance.mjs:205-214，world 的 profile 未初始化时跑一次性 throwaway boot）→ `DshInstance` boot → `waitForBoot()` 用 `BOOT_MARKER`（instance.mjs:23，正则解析宿主 boot banner `dsh web: http://127.0.0.1:<port>/?token=…`，注释在 :13）→ :212 将 url **含 token 原样**打印。
- 宿主侧 banner 本体由 DSH web 服务打到宿主自身 stdout → 进 world 内 file-FD host log（PASS 时随 world 自删；上游 banner 的 src 行号未在 apps/cli|web src 直接命中，可能在编译产物/其他包，未深搜——交接时如需可再定位）。
- 留存面提示：本次运行的后台 job stdout 捕获中也有一次该 token 行（**记录中一律不转录值**）。落盘 evidence 已被 scrub（`?token=`/`lt-v1-<64hex>` 零命中，`lt-v1-REDACTED`/`sk-user*` 标记在场）。**交 main 单独收口**：修 instance.mjs:212 的输出脱敏即可断根。

## 6. PR-F 直接 backend 证据可否从现有日志提取

**不能。** 27 个落盘文件均不含宿主 stdout/stderr 通道（run.log=kit 自身、mock.log=仅 mock 回复行、api-transcript.json=仅 remote RPC 信封、scenario-*.json=断言细节）；DshInstance 的 host 日志文件在 world 内，PASS 时已随 world 自删（worldCleaned=true）。若需 PR-F 自身 per-run landlock 直接证据：复跑加 `--keep` 后在 world 的 host 日志/会话工具结果中 grep `landlock-run: partial enforcement`——**本轮未重跑**。PR-D 的直接确证（mock.log 10× helper 自报行 + bwrap 0）仍成立且不受影响。

## 7. sandbox deny 三分（不得等同）

1. **PR-D C2b/C4 = control-plane guard 层拒绝**（`decision-deny`/`request-abandoned`/`no-request`）——应用层授权语义，与文件系统沙箱无关。
2. **安装预验（用户监督安装轮，本会话执行）= landlock 内核层文件系统拒绝**：provider grants 形态下 `/home/user/.dsh` 写 → `Permission denied`（EACCES），文件未创建；granted 路径写成功。
3. **本轮 home 拒绝 = 外层 bwrap ro-bind 层拒绝**（本验收会话自身的工具沙箱负对照）：`touch /home/user/.perm-probe-home` → `Read-only file system`（EROFS），文件未创建——机制/层级与 2 不同，与宿主内 landlock 层亦不同。
宿主内文件系统越界 deny 方言在两份 kit evidence 中未被任何断言触发（本次运行无相关 FAIL，也无被改写断言）。
