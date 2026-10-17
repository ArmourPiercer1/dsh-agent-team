# Alpha.5 W4 — provider 工厂 → 测试会话接线（正/负控 + OS 撤销对照）

WIRING-PHASE-PLAN W4 交付（IF-1..IF-7）。基 = master@`62cc2b87`，分支 `alpha5-wire-pr4`；
宿主 = pinned `tests/deepseek-harness-test-use` @ `639ed01539`（0.2.0-rc.2，porcelain 0，
本 worktree 无自带 test-use 树 → 只读复用 `dsh-020rc2-upgrade` worktree 的已建树，同 pin）；
端口 **3182**（IF-2，:3080 全程只读 GET 探针 before/after=401）；世界 `tests/homes/a5w4-<phase>-<stamp>`（IF-3，跑完即删）。

## 文件

| 文件 | 作用 |
| --- | --- |
| `a5w4-provider-row.mjs` | 装配 row：profile-patch 公开 seam 挂载；经 `ctx.agents.get(sessionId)` 解析真实会话 Agent，在其 `ctx.tools` 上注册**唯一受限 exec 工具** `a5w4_confined_exec`（模型只能选 `{mode,tag}`，argv 由 row 固定）；背后是 dist 公开 barrel 导入的真实 Lane C `createConfinedProcessProvider`（三实例：main/missing/revoked），经被跟踪的 landlock-prelauncher 真 spawn |
| `a5w4-revoke-python.py` | 负控 B 的 OS 撤销 wrapper：自带经典 BPF seccomp 过滤器（444/445/446 → EACCES），`prctl(PR_SET_SECCOMP)` 装入后 exec python3；装不上即 fail-closed(exit 4) |
| `run-w4.mjs` | 三相 runner（`--phase pos|nega|negb`）：预检（pin/dist/launcher sha/撤销自测/端口 netstat）→ 装配 → mock 模型脚本链驱动 → 全部判据从**实时路由读取**评分 → 证据落 `runs/<phase>-<stamp>/` → 世界删除+端口收口。RED 姿态：row 缺失时 boot 失败被记为 scored FAIL，绝不回填 |
| `runs/` | 每次 run 的证据目录（criteria.json / live-state.json / live-journal.json / assembly-ledger.jsonl / instance.log〔redact 后〕/ run-receipt.md / mock-capture.json / run-meta.json） |

## 结果（本环境实测，2026-10-17）

- RED（先跑，row 未落盘）：`runs/pos-2026-10-17T02-16-17Z/` — 环境预检绿、接线判据 scored FAIL、exit 2。
- GREEN pos **22/22**：`runs/pos-2026-10-17T02-26-25Z/` — 真 spawn（rc=0、pid 真、lease=terminated、out/err spill 存在且内容匹配 fixture）；同域对私有 fixture **EACCES rc=1 零泄漏**；live capability rows content-read/write=enforced(double evidence)、network=unsupported、ABI v4；legs selective/denyall=ENFORCE-CONFIRMED、badhandled=DEMO-CONFIRMED（假阴性判别器在场）；hard realm 装配按观察 2 配 `hardDimensions` → 每个被接受的 spawn 均通过 prepare 期 `verifyHardProfileEvidence`（真实捕获证据）。
- GREEN nega **19/19**：`runs/nega-2026-10-17T02-26-33Z/` — net deny/restricted/forged 三类全 typed `IO_POLICY_UNSUPPORTED`（**任何进程存在之前**，计账 spy delta=0，原文入册）；PTY 在 seam 上不可表达 → 接线边界 typed `IO_POLICY_UNSUPPORTED`（providerTouched=false，静默降级不可表示）；缺件类 typed `SANDBOX_UNAVAILABLE`（无退路法）。零 spawn 结构性证据：exec-answer 行=0、confined-exec spy 行=0、scratch 无 plans/out 路径、fixture 世界字节不变。
- GREEN negb **18/18**：`runs/negb-2026-10-17T02-26-40Z/` — 同工厂同请求形状，launcher 进程被 wrapper 的 seccomp-BPF **内核级撤销**（wrapper 内 abi-probe 原始行含 errno=EACCES，启动前直接自测证明），probe 实测 abi-unavailable → typed `SANDBOX_UNAVAILABLE`，zero confined-exec；pos 成功回执以 `--pos-receipt` 入册对照。
- 回归：lane C 既有 8 套 `test/a5p4-*.test.ts` **56/56** 复跑零回归（含 lane 自带 hygiene 套）。

## 级别声明（诚实口径）

- **ENFORCE 定级从 live rows 现场计算**，非假设：本宿主 Landlock ABI v4 在场 → pos 为 ENFORCE-CONFIRMED（fixture/subprocess 级：被跟踪 launcher 编译真实 Landlock 规则、真实 execve；realm/trustRoot 按 lane 措辞为 fixture 级身份，非 OS 锚定）。
- 负控 B 的撤销是 **per-process 内核强制**（seccomp 过滤器）。本环境 `seccomp(2)` 直调返 E2BIG（嵌套 bwrap），wrapper 走 `prctl(PR_SET_SECCOMP, SECCOMP_MODE_FILTER)`——同一内核机制。**系统级（sysctl/启动参数）撤销在非特权嵌套沙箱内不可达**：如实记为环境约束，未冒充。
- §5 码零新增（IF-6）：只用 IO_POLICY_UNSUPPORTED / SANDBOX_UNAVAILABLE。缺件类按 lane 契约落 SANDBOX_UNAVAILABLE（与网络类 IO_POLICY_UNSUPPORTED 分列如实报）。
- G-6/G-7 通道观测仅在 provider 面**复用观测管道**（row 自有的 tools/change 控制订阅 + 对自有 Definition 的一次合法注册表移动：controlEvents 1→3，真实注册表有递达）。provider seam 本身不发 §5 事件——**不构成任何通道闭合断言**；G-g 口径不变、仍 OPEN。

## 披露（seam 事实，均为实测非推测）

1. **rc/pid 观测通道 = row 的公开 deps 计账 spy**：seam 的 RunOutput 不携带 rc/pid（review-LaneC 观察 1）；seam 扩展属 GLUE 后续，不是 lane 改动。
2. `provider.execute()` 用其模块自解析路径作 argv[0]（dist 内无 .py 资产）；公开 deps seam 正是装配决定"跑哪份可信字节"之处——spy 将 argv[0] 改写为 trustRoot 以 sha256 指名的被跟踪 launcher（`cee10ed5…`），两种身份均入册，argv 尾部保持 provider 编译原样。
3. profile-patch 文件是**顶层 YAML 数组**（`- insert:` 行，row 以 file-URL 命名）；对象形状在宿主 boot 即被拒（实测）。
4. 工具结果按线格式骑在 USER 消息的 tool_result 块（Anthropic 路线）与 role:'tool'（OpenAI 路线）并存，mock 脚本双路解析（live 轮实测事实沿用）。
5. 缺件类的存在性预检（python3 --version / test -f）由 lane preflight 自走 spawnSync，不经 deps.run——记为前置条件探针，非 payload spawn；revoked 实例的 probe legs 在 wrapper 下运行、其 scratch 探针目录如实留册。
6. 本 kit 全部文件在 `dev/agent-workflow/evidence/` 下，位于一切 packages/** census/DORMANT/p4t6/audit 走查根之外 → **共享文件零改动**（IF-5 满足；无任何 GLUE 需求）。

## 复跑

```bash
node run-w4.mjs --phase pos
node run-w4.mjs --phase nega
node run-w4.mjs --phase negb --pos-receipt runs/<pos-stamp>/run-receipt.md
```

launch token 在 capture 时即 `REDACTED-<sha8>` 脱敏，原始实例日志脱敏后删除；密钥为合成串。
