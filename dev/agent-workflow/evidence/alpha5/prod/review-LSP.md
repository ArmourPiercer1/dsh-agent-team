# review-LSP — P-LSP 独立复核（R-1 streaming 臂 / R-2 policyChange 装配纪律）

- **subject** = `alpha5-prod-lsp @ 93b728a37a90112b39408d789bed484b5fcf3d12`（review 区间 `3668da59..93b728a3` = `7c8a90b8` RED → `ab9ee76f` GREEN → `9d3d0d89` docs+lint → `93b728a3` ci-304）
- **reviewer** = P-LSP 独立 reviewer（qwen3.8-flash-next；liveness 首报 `You are a coding agent powered by the qwen3.8-flash-next model.`；**≠** 实现面 `2437a167` / `644633ea`；本轮零参与实现）
- **worktree** = 一次性 `.worktrees/a5lsp2-rev`（`git worktree add --detach` @ subject SHA；teardown 见 §6）；端口 **3182** 开跑前亲证空闲（node bind→release = `connection refused`），全程**未绑任何端口**，`:3080` 未触碰（只读 GET = 401 原状）；世界 = `tests/homes/a5lsp2-rev-<stamp>`（单一世界，teardown 已删，本轮 git status 无残留）
- **方法** = 按 ROUTER_RULES §3.1.3，裁决只落在**代码与测试**上：逐行读 diff（`provider.ts` / 新增 `lsp-assembly.ts` / launcher diff）→ 在一次性 worktree 里**复跑**被审方引用的三条在册腿与两条 lane 测试 → 再用** reviewer 自备 payload 与自备 kit**（不用 lane fixture）在真实 Landlock（本机 ABI v4 / kernel 6.8.0-142-generic / node v24.21.0）上重测主张。`SESSION_ROUTER_LOG` / `COORDINATION` 只为恢复根 08:43Z 口径而读，不作为裁决对象。
- **裁决 = 通过**（六项全部实测成立；附 2 项不阻塞的 README 陈旧口径更正 + 4 项在册注记，见 §5）

## 0. 我亲自跑出的数字（全部在本 worktree，非引用被审方日志）

| 腿 | 命令 | 结果 |
| --- | --- | --- |
| 旧面字节不变（ABSENT face） | `cd packages/runtime && npx vitest run test/a5p4-*.test.ts` | **66/66 PASS**（10 files，真实 Landlock） |
| 本轮 lane 测试 | `npx vitest run test/a5lsp2-streaming.test.ts test/a5lsp2-assembly.test.ts` | **22/22 PASS**（15 + 7） |
| dist 镜像 | `pnpm run check:artifacts:head` | `verdict=ok compared=1684 drift=0 EXIT=0` |
| dist 镜像（独立复现） | `pnpm -r run build` 后 `git status --porcelain` | 全仓只剩我这 2 个新文件 ⇒ **提交的 dist 与 HEAD 源码的全新构建逐字节一致** |
| 记账腿（⑥） | `a5p0-layer-audit` / `p4t6-session-event-scan` / `a4p7-merge-gate` | **4/4**、**10/10**、**35/35 PASS** |
| reviewer 自备 replay kit | `node dev/agent-workflow/evidence/alpha5/prod/review-LSP-replay.mjs` | **53/53 PASS**（`REVIEW-REPLAY: 53/53 PASS`，EXIT=0，世界扫描空） |

kit 原文 = 本目录 [`review-LSP-replay.output.txt`](review-LSP-replay.output.txt)，脚本 = [`review-LSP-replay.mjs`](review-LSP-replay.mjs) + [`review-LSP-probe-payload.mjs`](review-LSP-probe-payload.mjs)（confined 侧自报 fd/pid/cwd/deny 事实，非 lane fixture）。

## 1. ① spawnStreaming 复用面 = 真复用，不是复制出的弱面

读 diff 而非读宣称：`spawnStreaming`（provider.ts:626）= `prepare()` + `executeStreaming()`，**同一条** prepare 阶梯（argv 显式非空 → realm 混淆 → 网络闭包 → `probe()` → ABI pin → hard-profile → `compileFdPlan`），**同一个** `plans`/`consumedPlans` 一次性账本，**同一套** `leases`。

- 双门确实在位：`launcherIntegrityGate()` 在 `probe()`（:386）与 `executeStreaming`（:542）**各跑一次**，且第二次在 `consumedPlans.add` **之前** —— 字节被换则拒，且不烧掉一次性 grant（与 `execute` :479 同型）。实测 L8：错 pin 的 assembly 连 `ensure`/`policyChange` 都拒（typed `SANDBOX_UNAVAILABLE`），且**存活进程样本数不变**（before=4 after=4）⇒ 门在任何进程存在之前。
- 一次性法实测：kit L2 + lane 15 项；`executeStreaming` :537 与 `execute` :469 同判据文案（"second spawn without a second grant"）。
- 旧 API 字节不变：面冻结为 8 键（L1 实测 `execute,executeStreaming,prepare,probe,requestCancellation,settleTermination,spawn,spawnStreaming`），6 个历史键原样；ABSENT face 我以 a5p4 **66/66** 亲跑复现（不是引用）。
- **fd-3 reservation 时序修正**：launcher `mode_confined_exec` :345-350 把 `reserve` 在**任何 fd 分配之前**算出（`os.fstat(HANDSHAKE_FD)` 成功才 `{3}`，否则 `∅`）。我做了三向测量：
  - **L3a** 完全不传 fd 3（此时 ruleset 自己落在 3）→ `rc=0`，one-shot 臂正常执行，deny 路径仍 EACCES；
  - **L3b** 传 fd 3（marker 文件）→ `rc=0`，且 payload **不持有**该通道；
  - **L3c 反事实**（把该 guard 去掉 = 修正前形状）→ 无 fd 3 时 **`rc=127`**（子进程关掉自己正要 restrict 的 ruleset），有真 fd 3 时 `rc=0`。**⇒ 时序 guard 是承重的，a5p4 那条 one-shot 回归面确实被这次修改保住**（L2b 另证：stream 臂 handshake 真写进通道、`exit.json` pid 与 handshake pid 一致、supervisor 随 payload 退出，无孤儿）。

## 2. ② policyChange 四条要求（生产版本，LSP-DR 口径）

`lsp-assembly.ts` 的次序 = **pre-gate → dispose → assemble**（:283 门先跑，:252 dispose，:297 重建），四条我全部用 OS 观察而非记账验证：

1. **旧 pid 有界退出**：L5 `goneAfterMs=1`（`/proc` 轮询），台账 `realm-disposed{lastPid,disposeMs:25}`；
2. **新实例起来**：新 pid ≠ 旧 pid，且新实例在活管道上应答 `gen=g1` 且 `cwd` = 新代际根；
3. **兄弟不动**：B 的 pid 恒定、`/proc` 存活、变化后仍能应答；
4. **中途失败零残留**：L7 用"永不应答 ready 的活半件"（silent 模式）触发失败 → typed 拒 + `current('A')===undefined` + 旧 pid OS-gone + 世界扫描只剩兄弟（`["supervisor:85","payload:86"]`，kind-aware 扫描：每个活实例合法持有 1 个 supervisor）+ 台账 `assemble-failed{stage:'ready', detail:'… cleanup settled: terminated'}`。
- **generation-mismatch `ensure` 拒**：L6 实测 typed `IO_POLICY_UNSUPPORTED`（"a generation change goes through policyChange()"），且拒后 live 实例 pid 不变。
- 半件 ready 失败路径在返回前 `terminate+settle`（:224），`disposeInstance` 未确认时**重新登记旧实例**并返回 `EXECUTION_TERMINATION_UNCONFIRMED` + `sideEffectUnknown`（:252-253）—— 失败面是保守的。

## 3. ③ 隔离（双 member 双 pid 互不干扰）

L4：A/B 两个 confined pid 互异（70/86），各自只在自己的管道上应答（自报 pid+gen 交叉核对），hot re-`ensure` 不产生第二进程；复跑一路（kit 每轮换新世界，均复现）。另 L2 侧证真实中介存在：payload 内读白名单外文件 = **EACCES**，`cwd` = 代际根，握手 pid = payload OS pid。

## 4. ④ lease 法链（抽样两条 + 真实流程序列）

- **`cancelling` 不自落**：L9 真实流程序列 —— `requestCancellation` → `cancelling`；进程随后真的消失（`afterMs=25`）；**再次** `requestCancellation` 仍返回 `cancelling`（provider.ts:643 只在 `active` 上动作，:641 注释即法条），绝不自动 `terminated`。
- **`termination-unconfirmed` 是真终态**：`settleTermination(false)` → `termination-unconfirmed`；再 `settleTermination(true)` → `terminated`（:661 是唯一落 `terminated` 的路径，`leases.set` 只在 :517/:583/:645/:656/:670 五处）。
- **terminate 的 `/proc` 复核**：L2/L10 —— 忽略 SIGTERM 的 confined 子进程在 grace 之后升级并确认，`tookMs=430 ≥ grace 400`（我先等到子进程自报 hello，确保 handler 已装上，否则测的是启动竞态）；L11 `disposeAll` 净零、世界扫描空。

## 5. ⑤ 宣称纪律 + ⑥ 记账三条

⑤ **在位**：README:78-80 明确"隔离宣称 = realm 粒度；**policy 粒度驱逐 NOT claimed**（池键仍是纯路径，改名复用被 brief 禁止）"，与契约 `LSP-rulings-brief.md` §3 的两分表述一致；README:76-77 明确"fixture 只实现 LSP stdio framing，**本 lane 证的是 PROVIDER/ASSEMBLY seam，不是任何产品编辑器功能**"。我未在任何主张行发现升格。根 08:43Z 口径（真实语言服务器最小交互 = 后续验收项）在**未跟踪**的 `dev/agent-workflow/evidence/alpha5/COORDINATION.md:92` 在册；tracked 的 `ALPHA5-ACCEPTANCE-STATUS.md` 里**没有**这条后续项 —— 后续项只在根侧口径里，不构成"已交付"表述（本轮无人如此表述）。

⑥ **三条腿我逐条复跑并核对身份**：
- **a5p0**：`packages/domain/test/a5p0-layer-audit.test.ts` 相对 base 只**新增 1 条** consumer-set 项 `tools/a5p5-tools/src/register.ts`，4/4 PASS；
- **p4t6 Δ9**：`SCANNED_PATHS_A5PBLSP` 相对 base `d714a941` 恰为 **9 个**可扫文件、名字逐一对得上，两处求和表达式 + present-by-path 循环都加了，10/10 PASS（RED 原文 `ci-304/p4t6-RED-expected-1157-got-1166.log` 在册）；
- **a4p7 闭合证据**：`a4p7-merge-gate.test.ts` **35/35 PASS**（含"commit carries its own build"腿 12.5s）。注：我第一次在**未 build** 的新鲜 worktree 跑时，"green by arm name and absence of a skip"一腿读 `refused`，唯一原因是 `packages/client/dist` 尚未产出；`pnpm -r run build` 之后同一腿绿 ⇒ 这是**环境顺序**，不是实现缺陷。
- **stacked cherry-pick 披露在位**：`83c591fc` / `87f465dd` 带 `-x` 标记，README:13 有 GLUE-5 dedup 说明（"when P-B lands, these two commits drop out"）。

## 6. 必办更正（不阻塞本 Gate）+ 在册注记

**必办更正（同一文件下一次落笔时改掉，属证据文本陈旧，不属实现）**

1. README:90-92 仍写 "dist regeneration **deferred** to GLUE-5 … **not committed**"，但 `93b728a3` 自己就把 `packages/runtime/dist/.../sandbox-provider/*`（含 `lsp-assembly.js`）提交了（`git ls-tree HEAD` 命中；我另以全新构建逐字节复现）。文本与 HEAD 树矛盾。
2. README:104-106 仍写 a4p7 "commit carries its own build" 一腿 "red by ruling"，而 `ci-304/a4p7-merge-gate-RERUN-GREEN.log` 与我本次 35/35 实测都表明它在完整构建后就地绿。两处都是**低报**（不会把未做的说成做了），故不阻塞，但会误导 GLUE-5 去重复处理已完成的 dist/记账面。

**在册注记（非阻塞，建议随 GLUE-5 或下一次 lane 触碰时处理）**

- (a) provider.ts:342-350：`beginKillSequence` 以 `run.exited` 为门；若 supervisor 先死，payload 不再被发信号 —— 落 `termination-unconfirmed`，方向保守（不谎报成功），但值得在文档里写明这条失败形状。
- (b) `leases` / `streamRuns` 只做 `set` 从不 `delete`（:517/:583/:645/:656/:670）⇒ 长驻 realm 下映射无上界增长；本 lane 无长驻世界故未观察到后果。
- (c) **fd-plan 法被 launcher 自有约定静默覆盖（我实测，非推断）**：`compileFdPlan` 允许声明 `fd: 3`（closed set `['stdin','stdout','stderr','delivery']` 无 3 保留位），但 one-shot 臂 :375 的 `for leaky in reserve: os.close(leaky)` 与 stream 臂的 `hs_close()` 无条件关闭 fd 3 —— kit **L3d** 实测：策略声明了 fd 3，payload 仍拿不到它（`declared-fd-3-survived=false`）。这与 `inheritDefault: 'close-all-UNDECLARED'` 的法条相张力：声明面说"声明过就活"，执行面对 launcher 自有编号说不。建议在 `compileFdPlan` 或请求校验里显式拒 `fd === 3`（launcher-owned），把冲突放在拒绝面而不是静默覆盖。
- (d) 后续验收项（真实语言服务器最小交互）目前只在**未跟踪**的 COORDINATION 里；tracked `ALPHA5-ACCEPTANCE-STATUS.md` 无对应行。若希望后续轮次不依赖会话记忆，需要一条 tracked 登记。

**清理**：`tests/homes/a5lsp2-rev-*` 已删（kit teardown，最终扫描 empty）；一次性 worktree 在本报告 push 后移除；`:3080` 全程未触碰；未绑端口；push = fast-forward（推送前 `git ls-remote` 亲验远端仍在 `93b728a3`）。凭据状态：本机 push 由环境凭据完成，本轮未新增/读取任何凭据。
