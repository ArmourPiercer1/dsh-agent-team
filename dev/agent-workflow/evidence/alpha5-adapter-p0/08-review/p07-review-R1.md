# P0-7 独立 Reviewer 报告 — R1

> **Reviewer**: Alpha.5 P0 独立 Reviewer（非实验执行者，独立会话）。
> **模型逐字自报（powered-by）**：`qwen3.8-flash-next`。
> **复核时实际 HEAD（W= 本 worktree）**：`c46ffb76e33c8ce097a84963c72a60d88a9d263e`（= 预期 c46ffb76…，分支 `exp/alpha5-poc-20261016`，无其后协调者提交）。
> **pinned test-use HEAD**：`639ed015397290b3745d163aafe02ffee4aa3f84`（0.2.0-rc.2），全程 `git status --porcelain` tracked=0（本会话开始与全部复跑后均实测）。
> **裁决口径**：VERIFIED = 本 Reviewer 在精确 HEAD 上亲手复跑/亲读源码直接证实；REFUTED = 亲手证据与声称矛盾；NOT_VERIFIED = 本轮无证据可裁（含 PENDING 项，按 guide §5 ENV_BLOCK/PENDING 语义不算缺陷）。

## 0. 复跑造成的证据面变更（诚实披露）

按指令"亲手复跑"以下脚本时，脚本自身覆盖了其结果文件（这是 re-runnable 设计的固有副作用，非手改）：
- `00-baseline/p00-result.json`、`01-routing/p01-result.json` 被复跑重写（verdict 集合与 HEAD 版完全一致：5/5、12/12 PASS；仅时间戳/`team_HEAD` 字段前进，diff 已核）；
- `07-integration/p06-host-smoke.sh`（P06_PORT=3184）新产生 `07-integration/smoke-a5p0-smoke-20261015T214638Z.log` 并重写 `02-plugin/observation.json`（脚本首步 `rm -f` 属脚本原文行为）。
- 环境探测 log 写到 `/tmp`（脚本支持 log 参数），未污染已提交 `env-capability-probe-run.log`。
- 本会话唯一手写的文件 = 本报告。

## 1. 裁决面逐条（§6.2 清单）

| # | 裁决项 | 裁决 | 亲手证据（命令→关键输出/退出码） |
|---|---|---|---|
| 1 | **Pinned Host 未变** | **VERIFIED** | `git -C W/tests/deepseek-harness-test-use rev-parse HEAD` = `639ed015397290b3745d163aafe02ffee4aa3f84`（rc=0）；`status --porcelain` 行数=0（rc=0，p00/p01/probe/smoke 全部复跑之后再测仍 0）。主 worktree `git -C W status --porcelain`：改动仅 `dev/agent-workflow/evidence/alpha5-adapter-p0/**` 下 tracked 证据 + 本 Reviewer 复跑产物；junction 位于 gitignored `node_modules/`（`git check-ignore -v` 证实 `.gitignore:12` 覆盖），porcelain 不显示=预期。例外见 §3-F1（`dev/tests/` 遗留世界）。 |
| 2 | **原体零执行主张** | **VERIFIED**（fixture 级，即本轮声称范围） | 亲手复跑 `node 01-routing/p01-runner.mjs` exit 0，12/12 PASS；`node 00-baseline/p00-runner.mjs` exit 0，5/5 PASS。BND-02 safe-unload：`secondRun="Error: unknown tool \"grep\"" native=0`；L3-safe：`native=0 adapter=0`；P0-0.preset-topology：presetBodyCount=0。p00 observations 独立重算：`{'NATIVE.grep':2,'NATIVE.read':1,'ADAPTER.grep':1,'ADAPTER.psp_grep':1}` 与断言期望 1/2 逐一对合。注：报告未主张真实宿主原体零执行（fixture 级声明，见 #5）。 |
| 3 | **丢 Adapter 不回落** | **VERIFIED**（fixture 级） | L2b：dispose 后 `get`→UNKNOWN，二次 execute 报 unknown tool 且 `NATIVE.grep=0`；L3-safe（在飞调用+已 dispose Adapter、mask 存活）：`native=0 adapter=0`。与 committed p01-result.json 逐字段一致。 |
| 4 | **PTC 子分发（本轮=拒绝面证据）** | **VERIFIED**（拒绝面）；内层准入 NOT_VERIFIED（P0-5 PENDING，报告如实记 PENDING） | L7：register/restrict 双侧 throw 原文复现：`tool name "run_code" is reserved for the PTC mode presentation transport…` / `tools.restrict() cannot name reserved PTC mode presentation transport "run_code"…`。内层 `tools.*` 再准入腿（PTC-02）无已提交证据（`05-ptc/` 仅 untracked 在制品，不在 HEAD 审断范围）。 |
| 5 | **真实拒绝 I/O（本轮 fixture 级声明是否越界）** | **VERIFIED（声明未越界）** | p00-fixture.mjs 头注明确 TEST DOUBLE 定位；negative-cases.md NEG-3 明记"源码 CONFIRMED；本宿主 OS 级受限读 ENV_BLOCK（无法做正/负控闭环）"；P0-SELECTION-REPORT §4"fixture/替身证据不写成真实宿主 PASS……无 P0 GO"。全文 grep 无任何把 fixture 证据写成真实宿主 GO/通过的表述；§2 verdict 全为 PENDING/INCONCLUSIVE/ENV_BLOCK。**真实拒绝 I/O 本身：NOT_VERIFIED（本轮未主张，P0-3/P0-4 pending/ENV_BLOCK）。** |
| 6 | **同 Agent 并发 Grant** | **NOT_VERIFIED** | P0-3 未提交（`03-fs/` 在 HEAD 无任何 tracked 工件，报告记 PENDING）；FS-03 无证据可核。按指令规则记 NOT_VERIFIED。 |
| 7 | **两 Agent 隔离** | **VERIFIED**（fixture 级） | P0-0.scope-distinction.get：A=ADAPTER.grep / B=NATIVE.grep / global=NATIVE.grep；L1：A→ADAPTER B→NATIVE；preset-topology：B 未绑定→`unknown tool "psp_grep"` fail-closed（NEG-4 一致）。真实宿主双 Team 隔离=P0-6 stage2b，报告记 BOUNDED-DEFER（一致）。 |
| 8 | **取消/进程树（本轮=P0-4 ENV_BLOCK 声明诚实性）** | **VERIFIED（声明诚实）** | 亲手复跑 `env-capability-probe.sh`（log→/tmp）：逐项 rc 与 matrix §3 清单逐位一致（A1=0 A2=0 A3=1 A4=1 A5=1 / B1=5 / C1=1 C2=1 C3=0 / D1=0 D2=1 D3=0）。**亲手执行 bwrap 负控**：`bwrap --ro-bind allowed allowed --dev /dev --proc /proc cat private/secret.txt` → rc=1 `bwrap: No permissions to create new namespace…`；正控同 mount 组合亦 rc=1（同一 EPERM → "负控失败不代表读限制生效"判定成立，ENV_BLOCK 成立）。**亲手执行 landlock 探针**：`ABI_VERSION=4; ruleset_fd=3; add_rule rc=0; restrict_self rc=0; POS OK(21B); NEG-FAIL: secret READABLE (32B) -> enforcement ABSENT` exit 5 → matrix 的"接口应答≠强制在场、记 ENV_BLOCK 不记 SUPPORTED"逐字吻合，无夸大。 |
| 9 | **read-before-write / Spill** | **NOT_VERIFIED** | 本轮无已提交证据（S-09 仅源码级 CONFIRMED；FS-02/SRCH-04 属 P0-2/P0-3 PENDING）。报告未主张，记 PENDING，一致。 |
| 10 | **缺失 Sandbox fail-closed** | **NOT_VERIFIED** | 本轮无"缺 Sandbox 时组合被拒绝"的行为级证据（P0-4 已证 OS 强制缺失但无工具级 fail-closed 实验；报告未主张）。 |
| 11 | **无私有导入与 Core 修改** | **VERIFIED** | HEAD 全部 tracked `.mjs` import 逐行 grep：仅 `node:fs/os/path/url/child_process`、相对路径、与 5 个允许包根 `@deepseek-ai/{cordis,dsh-scope,dsh-system-prompt,dsh-tools,dsh-llm}`（fixture junction 表与之一一对应）；**零** `src/` 内部路径/深子路径导入。`p06-observer-plugin.mjs` 仅 import `node:fs`、只用公开 `ctx.tools` 面、写文件仅 `P06_OBS_OUT`/自身目录（不写 T 树）。Core 修改：test-use porcelain=0（前后多次）、`profiles.ts` L17 源码引文与 matrix §F 逐字一致。 |
| 12 | **报告口径审计（无夸大）** | **VERIFIED（附 2 条 staleness 记录，非夸大）** | P0-1 行"12/12 leg PASS"与 committed p01-result.json 一致；NEG-1"原体执行 1 次"与我复跑 hazard（native=1, `outcome="ran:grep@NATIVE.grep"`）一致；NEG-2/4/5/6 各行的错误原文/计数与 p00/p01-result 一致；§0 冻结项 origin/master `d455a274…`、主树 `6259cf4b`（tracked 脏 1 文件=SESSION_ROUTER_LOG.md）均实测吻合；stage1/stage2a 两项 REAL-HOST PASS 由我亲手复现（见 §2）。发现 F1/F2（§3）：均**低报**（under-claim）方向，无虚高。 |

## 2. 关键复跑记录（命令 → 结果）

1. `node …/01-routing/p01-runner.mjs` → exit 0；12/12 PASS；额外确定性复跑 5 次全 exit 0（L3 双竞态腿 7 连跑稳定）。hazard 详情：`native=1`；safe 详情：`native=0 adapter=0`；L2b：`native=0`+unknown tool。
2. `node …/00-baseline/p00-runner.mjs` → exit 0；5/5 PASS；header 冻结 `team_HEAD=c46ffb76…`、`test_use_HEAD=639ed01539…`、`porcelain=CLEAN`、`node v24.21.0 linux 6.8.0-142-generic`。
3. `bash …/04-process/env-capability-probe.sh /tmp/reviewer-env-probe.log` → exit 0；A/B/C/D 判定与 matrix 全同（bwrap ENV_BLOCK、landlock rc=5 无强制、netns EPERM、userns 不可映射）；probe-scratch trap 销毁。
4. bwrap 负控/正控 + landlock 探针亲手执行（原文见 §1#8）。
5. `grep -rEn 'token=[A-Za-z0-9]' 07-integration/` → 无命中（rc=1）；boot/smoke log 均为 `token=<REDACTED>`。
6. `P06_PORT=3184 bash …/07-integration/p06-host-smoke.sh` → `SMOKE_OK`：boot_line=1、no_token_http=401、observation `registered: true`（真实宿主进程内）、`test_use_tracked_dirty=0`、`test_use_HEAD=639ed01539…`。:3080 全程未触碰。
7. 源码抽验：pinned `index.ts:1578` `resolveExecution` 在 dispatch 期（NEG-1 锚点实存）；`profiles.ts:17` `--ro-bind / /` 底座（S-10/F 一致）；`fs-sandbox/src/index.ts` 仅 override `writeText`(L80)/`editText`(L101)（NEG-3"只覆写"一致）。

## 3. Findings（不影响裁决，须登记）

- **F1（工作树卫生，先于本会话存在）**：`git -C W status --porcelain` 有 `?? dev/tests/`——21:42 一次失败 smoke（T 变量解析为 worktree root、bin.js MODULE_NOT_FOUND，见 committed `smoke-a5p0-smoke-20261015T214220Z.log`）遗留的世界目录（仅 1 个 `profiles/web/cordis.patch.yml`）。位置违反 TEST_METHODS §7（世界应在 `tests/homes/`）。当前脚本版本已修正路径（我复跑的世界正确落在 `tests/homes/`）。建议协调者删除该遗留目录（Reviewer 依只读约束不动）。
- **F2（报告 staleness，低报方向）**：P0-SELECTION-REPORT §1 P0-0 行仍写 **4/4**，而 HEAD 上 runner 实为 **5/5**（aaf327a8 后未回填）。方向为 under-claim，不判 REFUTED；建议回填 5/5。
- **F3（措辞核）**：`?? dev/agent-workflow/evidence/…/P0-SELECTION-REPORT.md`、`EXECUTION-LOG.md`、`02-search/`、`03-fs/`、`05-ptc/`、`06-lsp/` 均为 **untracked**（HEAD 未含）；本次裁决只以 HEAD tracked 工件 + 我亲手复跑为准，untracked 在制品不计入证据面，与其 PENDING 口径自洽。

## 4. 总体裁决

**PASS**（对 R1 复核面）：HEAD `c46ffb76` 上全部已提交主张（P0-0 5/5、P0-1 12/12、P0-4 ENV_BLOCK×4、P0-6 stage1/2a REAL-HOST PASS、反例台账 NEG-1..6、无私有导入、pinned Host 未变、token 已脱敏）经我亲手复跑/亲读逐条 VERIFIED，无一 REFUTED，报告无任何把 fixture/ENV_BLOCK 证据写成 GO 的夸大；P0-3/P0-2/P0-5 内层/取消进程树/read-before-write 等仍 NOT_VERIFIED 但报告均已如实记 PENDING/ENV_BLOCK/BOUNDED-DEFER——**P0 整体未关闭（报告自称 EXECUTED-PARTIAL），本 PASS 仅指"证据诚实且可复现"，不构成 P0 GO**。

## 5. 本 Reviewer 实际使用的全部命令清单

```bash
git -C W rev-parse HEAD / branch --show-current / log --oneline -5
git -C W/tests/deepseek-harness-test-use rev-parse HEAD            # 639ed015397290b3745d163aafe02ffee4aa3f84
git -C W/tests/deepseek-harness-test-use status --porcelain        # 0 行（复跑前后各测）
git -C W status --porcelain ; git -C W diff -- <p00|p01>-result.json ; git -C W show HEAD:<两个 result.json>
git -C W ls-files dev/agent-workflow/evidence/alpha5-adapter-p0/ ; grep -nE 'import|require' <全部 tracked .mjs>
node dev/agent-workflow/evidence/alpha5-adapter-p0/01-routing/p01-runner.mjs   # ×6（exit 0）
node dev/agent-workflow/evidence/alpha5-adapter-p0/00-baseline/p00-runner.mjs  # exit 0
bash dev/agent-workflow/evidence/alpha5-adapter-p0/04-process/env-capability-probe.sh /tmp/reviewer-env-probe.log
cd /tmp/rev-negctl && bwrap --ro-bind allowed allowed --dev /dev --proc /proc cat private/secret.txt   # rc=1（负控）
cd /tmp/rev-negctl && bwrap --ro-bind allowed allowed --dev /dev --proc /proc cat /allowed/read.txt    # rc=1（正控同败→ENV_BLOCK）
python3 <landlock 探针，逻辑同 B1，/tmp 独立副本>                                                                 # exit 5 enforcement ABSENT
grep -rEn 'token=[A-Za-z0-9]' dev/agent-workflow/evidence/alpha5-adapter-p0/07-integration/            # 无命中
P06_PORT=3184 bash dev/agent-workflow/evidence/alpha5-adapter-p0/07-integration/p06-host-smoke.sh       # SMOKE_OK
sed -n '1574,1582p' <test-use>/packages/core/tools/src/index.ts ; grep -nE … <fs-sandbox/src/index.ts>
git -C W/tests/deepseek-harness-test-use check-ignore -v …node_modules… ; git -C <主树> rev-parse --short HEAD ; git -C <主树> status --porcelain ; git -C W rev-parse origin/master
```

（W=/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/exp-alpha5-poc-20261016；全程未触碰 :3080，未 commit/push，未扩权，除本报告外零手写文件。）
