# Lane C（PR4 provider/launcher + PoC4）— lane notes  2026-10-16

代理=qwen3.8-flash-next / harness=DeepSeek Harness（分列）。branch `alpha5-pr4-prov` @ base `db5cb5f7`（master=PR1 merged），worktree `.worktrees/a5-pr4prov`。
**状态 = DORMANT**：零生产消费者、零装配；`scripts/audit-a5-tool-governance-imports.mjs` 复跑消费者集不变（本 lane 用 INTERFACES-v1 的**本地 contract stub**，不 import 冻结域轨，故共用 audit 脚本/tsconfig/barrel/scanner **零改动**）。live wiring 随 PR5。

## 1. 交付物

| 面 | 文件（packages/runtime/） |
| --- | --- |
| C-PROC 阶段闭集 probe→prepare→execute→terminate；terminate≠cancel（lease `cancelling` 仅经 settle 达终态；abort-before-exec=prepare→terminate 零进程腿） | `sandbox-provider/phases.ts` |
| 冻结词汇本地 contract stub（8 §5 码/5 level/6 dimension 逐元素 pin=hygiene 测试） | `sandbox-provider/contract-stub.ts` |
| FD 继承声明集：闭集 purpose、**固定默认 close-all-undeclared**（无 inherit-all 臂）、CLOEXEC=机制非保证（TOCTOU_A 律入 payload 注释） | `sandbox-provider/fd-inheritance.ts` |
| 网络维度闭集 `deny|restricted`（无 unconfined 臂）；PoC-4b 诚实面：TCP-bits≠无网络，两 profile 一律 spawn 前 `IO_POLICY_UNSUPPORTED` | `sandbox-provider/network.ts` |
| **PoC4 权威探针面**：裸 syscall GET_VERSION + 真实 enforcement 双证（selective&denyall），存在性检查仅前置报告且文案禁内核断言（`KERNEL_ASSERTION_FORBIDDEN`） | `sandbox-provider/probe-abi.ts` |
| realm/trustRoot 证据面骨架 + hard-profile 前置校验（**负控 only**；`HARD_PROFILE_ENABLED=false` 编译 OFF；fabrication guard=enforced 的 evidence 必须解析到真实录入腿） | `sandbox-provider/realm-evidence.ts` |
| provider seam（frozen 形状：probe/spawn/requestCancellation/settleTermination + prepare/execute 拆分=PoC-4c 形态；plan 一次性消费；**无回退律**：拒绝先于任何进程存在，fake-seam 测试观测零调用） | `sandbox-provider/provider.ts` |
| 受信预启动器参考实现（python3 stdlib ctypes；syscalls 444/445/446、attr=`pack("@QQ")`、rule=`pack("@Qi")`、c_long 防截断——与 04-process diag/10-lanes 实测姿势逐字同源；P1 入口自锁 / P2 fork-not-exec；**无 unconfined 臂**） | `sandbox-provider/launcher/landlock-prelauncher.py` |
| RED-first 规格 7 份 + harness + lane 自审（纯度/一致性/**in-process tsc 自检**/DORMANT/enablement OFF） | `test/a5p4-*.test.ts`（9 文件） |

## 2. PoC4 实测（本宿主，Linux 6.8.0-142-generic，uid 非 root，harness bwrap 内）

`node dev/agent-workflow/evidence/alpha5/pr4/run-poc4.mjs` → **EXIT=0**，`runs/poc4-evidence.json`：

| 腿 | 判定 |
| --- | --- |
| abi-probe（裸 syscall 444 GET_VERSION） | **abi-available v4**（rc=4 errno=0 原文） |
| selective（restrict 后新建 fd 负控 + exec 继承腿 + 基线/正控 11 检查） | **ENFORCE-CONFIRMED**（NEG 全 EACCES 原文；`NOTE pre-restrict fd read (by-design OK)`=TOCTOU_A 由设计记录） |
| denyall（handled=全支持位、**零规则**鉴别器） | **ENFORCE-CONFIRMED**（一切新 open=EACCES） |
| badhandled（handled 缺 READ_FILE ⇒ 假 ABSENT 复现鉴别器） | **DEMO-CONFIRMED**（TRAP 可读=配置错形态被证明可检出） |
| fd-close（P2 fork-not-exec：父编译 ruleset→fork→子 close-all-undeclared→restrict→readlink 身份判定） | **FD-CLOSURE-CONFIRMED**（declared 存活、undeclared ENOENT、域活体鉴别器 EACCES） |
| confined-exec（P1：入口自锁后 execve 不可信 argv） | rc=0；子内 `cat deny/secret.txt`→`Permission denied`，secret 零泄漏，allow 写正控 ok |

**判定层级措辞**：以上=fixture/子进程级 OS_ENFORCED（规则由本 lane 代码编译、合成策略 JSON；真实 Team runtime 集成属装配阶段——与 10-landlock-lanes 同措辞）。判定层≠全系统：不改任何 sysctl/模块/namespace；scratch=`tests/homes/a5p4-*` 用毕即删。

## 3. 门禁

- **RED-first**：`runs/a5p4-RED-first.log`（8 文件全红=模块未建，0 tests）→ 实现 → `runs/a5p4-GREEN.log` **56/56**。
- **p4t6 ledger**：PRE-EXTEND 实测 `expected 1090 to be 1073`（`runs/p4t6-PRE-EXTEND-RED.log`）→ 文档化程序扩展（17 named files，tie `1090-1073`）→ GREEN 10/10（`runs/p4t6-GREEN.log`）。
- **dormancy audit**：`audit-a5-tool-governance-imports.mjs` OK，consumers 集不变（4 文件，全为 PR1）。
- **lint**：lane+ledger 文件 0 error。
- **token**：采集即脱敏——evidence 全件 grep `token=|api[_-]?key|PRIVATE KEY` = **0 命中**（合成数据仅 `TOP-SECRET-*`/`SYNTHETIC-*` 字面量，无真实凭据；本 lane 不触任何 DSH home/launch token）。
- **NEW=0 / baseline**：全量 root vitest 见 `runs/root-vitest-full.log`（既有红名单=base 同败项，逐条比对记于 runs 尾注）。
- 端口 3181 与 DSH 实例：本 lane 为 fixture/子进程级，**未启动任何 DSH 实例**（无需求）；:3080 与测试实例均零接触。

## 4. seam 请求（宿主面，非本 lane 编辑——CORE PATCH BUDGET=0）

上游宿主 bash 后端存在性检查的文案修正（findings §1(a)/§3：pinned `0.2.0-rc.2 @639ed01539`）：
- `packages/sandbox/sandbox-local/src/index.ts`（rung 链与 `defaultProbeBwrap` 文案）与 `native/system/packages/entry/src/index.ts` 的 `launcherPath()` 注释/`--probe` 语义：**缺件与内核无强制不可区分**的结论式文案（"…probes `unusable` the same way an unenforcing kernel does" + 指引语 "Landlock-enforcing kernel"）应降级为**存在性/可 spawn 层报告**（"launcher presence not verified"），不得输出内核能力断言。
- 本 lane 已按裁定实现正确形状可作参照：availability 行只报 present/not-found 且禁内核词，内核面结论只允许出自裸 syscall GET_VERSION+真实 enforcement 腿（`probe-abi.ts`/`a5p4-existence-wording.test.ts` 即活体规格）。
- landlock-run 缺件对 PR4 信任预启动器=**非硬阻塞**（P1/P2 裸 syscall 444/445/446 实证，本 lane 参考实现不链接 liblandlock、不依赖 npm 预编译件；`Config.runnerCommand` 公开逃逸口保留）。

## 5. 边界与移交（集成 owner）

- realm/trustRoot：本 lane 只产出**证据接口+负控**；hard-profile 启用=后续装配决策，启用前必须过 `verifyHardProfileEvidence`（真实 probe 证据先于 hard-profile，PR2 冻结项 (ii) 的 PR4 义务=此函数+fabrication guard）。
- PoC-4a：metadata 严格隔离不主张（`directory-metadata` 恒 unsupported，仅发布内容读写窄子能力）；PoC-4b：`network:deny` 维持 IO_POLICY_UNSUPPORTED，未把 TCP bits 说成无网络；PoC-4c：prepare/execute 真拆分+一次性 plan 已备，PTY/Managed-Range 全保真归 PR5 实测。
- 消费登记（audit allow-list、runtime tsconfig、barrel）=集成时的**评审后共用文件编辑**，本 lane 依 brief 不碰。

## 6. 契约版本 pin（v1.1 广播对齐，2026-10-16）

- 正本 `INTERFACES-v1.md` 已入分支 `alpha5-decision-pack-20261016` @ `b0d636eb`（对旧主检出副本 diff=仅新增 v1.1 pin 行，**C-PROC 节零改动**→本 lane 消费面**无需对齐修改**）。
- 消费 pin 记录：C-PROC=C-PROC@v1.0（本 lane 唯一消费面：phase 闭集/FD 声明集/网络闭集/terminate≠cancel+lease 镜像=PR0 冻结件）；C-ADM@v1.1=PR256 `a51b903d`（PolicyDenySource/rungAbove——本 lane **不消费**，provider 无 policy-deny 来源面）；C-BIND/取消分型@v1.1=PR257 `452a04c0`（六事件名逐字——本 lane **不发射 dispatcher 事件**，取消面=lease 状态机，PR5 装配时由事件轨接线）。

## 7. NEW=0 基线对照（root vitest 全量，runs/new0-baseline-compare.md）

全量 `vitest run` 三轮：pre-fix `runs/root-vitest-full.log`（22 红=21 base 红+1 本 lane typecheck 红）、post-fix `runs/root-vitest-full-POSTFIX.log`（22 红=21 base 红+1 本 lane hygiene 全量并发瞬态目录竞态红，walk 已加固）、final `runs/root-vitest-full-POSTFIX2.log`（**21 红=base 21 红逐文件 1:1，a5p4 零红=NEW 0**）；base（stash 本 lane 后实测）同集红项逐文件对照记录于 `runs/new0-baseline-compare.md`。其中唯一本 lane 引入红=a4p7 merge-gate 的 `pnpm -r run typecheck` 腿：runtime 共享 tsconfig 的 `test/**` include 把 lane 文件纳入真实 typecheck，而程序内 `src/plugin/node-min.d.ts` ambient 垫片结构性收窄 `process`/`URL`（PR1 同侪从不直用二者）→ lane 侧以 globalThis 访问器 cast + path-join 修正（零共享文件改动）→ 复测 `tsc -p packages/runtime/tsconfig.json` 零错误、`pnpm -r run typecheck` exit 0。其余红项（p6t3×7、rc2-persona-probe×3、plugin-dsh-compat×6、rc2-kit-preset-seam×2、a4p7 composition-smoke×1、p6t6-actions×1、t2-blueprint-hash×1）在 base 实测同数=环境/既有（test-use runtime 树在新建 worktree 内缺失属 gitignored 环境件，非本 lane）。
