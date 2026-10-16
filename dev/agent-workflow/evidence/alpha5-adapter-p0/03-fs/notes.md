# P0-3 Controlled FS — 实验笔记（Alpha.5 独立 PoC，fixture 级证据）

- **代理**：Alpha.5 P0-3 独立实验代理（非协调者）。日期：2026-10-16（worktree `exp/alpha5-poc-20261016`）。
- **模型名（系统提示 powered-by 逐字回报）**：`qwen3.8-flash-next`。
  （此为我会话系统提示中模型名的逐字转写；runner 结果里的 `header.model_reported_by_agent` 是同一字符串，由代理注入，runner 自身无法核验模型身份。）
- **范围**：`docs/plans/memo/alpha5-tool-io-governance/P0-independent-adapter-poc-implementation-guide.md` §1（INV-1/4/5/9/10）、§3 P0-3、§4 FS-01..04、§5；`architecture.md` §14.4/§14.5。基线复用 `00-baseline/source-map.md` **S-10（CONFIRMED：原生 fs-sandbox 只 fence 修改，读直通）**。

## 命令清单（复跑）

```bash
W=/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/exp-alpha5-poc-20261016
cd "$W/dev/agent-workflow/evidence/alpha5-adapter-p0/03-fs"
node p03-fs-runner.mjs            # 全量：进程内 11 腿 + 每腿 strace 子进程重跑；写 p03-result.json
# 内部形态（协调者提示的推荐形态，本 runner 一开始即如此实现）：
#   strace -f -qq -e trace=openat,openat2,open,creat -s 512 -o <log> -- node p03-fs-runner.mjs --child=<LEG>
# 即：strace 直接孵化 node（ptrace_scope=1 下唯一可行形态；不 -p attach），逐腿独立进程，解析 log 区分
#   成功 open 与 "= -1"（ENOENT 等）失败尝试。本次运行 strace 可用，无腿因通道受限降级。
```

退出码（已实测两轮 + 幂等复跑）：`0` = 全部已执行腿 PASS；`1` = 任一腿 FAIL；`2` = 环境失败。
本次两轮均 **EXIT=0**。

## fixture 语义声明（必须随证据一起读）

- **in-process Trusted FS 边界 = Team adapter 本体在其真实 `node:fs` 调用点实施策略**（architecture.md §14.5：`read/write/edit` 族 = Controlled FS，**无进程沙箱**）。策略检查全部发生在 open 之前；被拒路径**从未被 open**（这是"不是输出过滤"的操作性定义）。
- **原生/未适配 lane 是 bypass 对照面**：本 fixture 中的 `legacy_native_read` 是测试定义（直读 `node:fs`，无策略），不是真宿主原生工具；真实原生的读直通由 00-baseline **S-10 源码级 CONFIRMED** 另行背书。二者拼起来是 INV-1 覆盖缺口的对照证据，不冒充宿主实测。
- mount 机制**只读复用** `00-baseline/p00-fixture.mjs`（真实 cordis + ToolRuntime 分发）。`W/node_modules` 的 5 个 junction 为 P0-0 已存在；本实验**未新增/修改任何 junction**（result.header 里 `junctions_before/after + junctions_unchanged=true` 为审计证据）。宿主包经既有 junction 的真实路径解析（等价于绝对 file URL 到 `T/.../lib/index.js`），transitive 走 `T` 自身 pnpm 布局；`T`（pristine `639ed01539…`）porcelain 全程 CLEAN。
- 全部文件内容标 **SYNTHETIC**；未触碰真实用户数据/凭据/`:3080`；未改源/配置/权限；未 git commit。

## 证据通道（三层）

1. **adapter open 账本**（append-only）：每条决策带 stage；`refused:*` 严格先于任何 open ⇒ FS-01 负控 = `open-issued(private/secret.txt)=0`（同时 ≥1 条 `refused(READ_DENIED)`）。
2. **strace 系统调用重跑**（每腿独立孵化）：OS 级成功-open 计数。关键读数：FS-01 负控 `secret_okOpens=0`；FS-01 bypass 对照 `secret_okOpens=1`（缺口实证）；FS-02 负控 `secret_okOpens=0`；FS-03 `specialA_okOpens=1`（仅 A 的调用开过）；FS-04 硬链接腿 `secret_okOpens=0 且 hardlink_okOpens=0`；traversal 腿 `etcPasswd_okOpens=0`；空格腿 `sp␠` 成功 open=1、trimmed `sp` 仅作为 ENOENT 探针出现（成功=0，失败尝试=1）。
3. **文件哈希/mtime 前后**：FS-02 负控 `sha256+mtimeNs before==after`。观测者哈希经由 fixture 锚点**之外**的观测者硬链接别名读取（同 inode、内容等价），使被拒路径字符串上的 OS open 计数成为 adapter/bypass lane 的纯净信号。

## 判定表（逐腿，fixture 级）

| 腿 | 内容 | 正控 | 负控 | verdict |
| --- | --- | --- | --- | --- |
| FS-01.pos | per-member read 集合 + realpath，读 allowed/read.txt | 成功 + 内容正确 + strace=1 open | — | **PASS** |
| FS-01.neg | 读 private/secret.txt | — | typed `READ_DENIED`；**账本 open-issued=0**；strace 成功 open=0；体无秘密 | **PASS** |
| FS-01.native-bypass | INV-1 覆盖缺口对照：未适配工具仍在 dispatchable 面（`get`+`schemas` 实证）直读 private | 泄漏被观测 = 预期发现 | — | **PASS**（缺口=预期证据） |
| FS-02.refusal | write-only grant 下 str_replace/edit | — | typed `READ_REQUIRED_FOR_EDIT`；旧内容从未被读（strace 0）；返回体无旧内容子串；文件未动 | **PASS** |
| FS-02.pos | 写 out/ 正控 | 成功，哈希=写入体 | 返回体不含旧内容标记 | **PASS** |
| FS-02.neg | 写 private/ 负控 | — | `WRITE_DENIED`；sha256+mtimeNs 不变；open-issued=0；strace=0 | **PASS** |
| FS-03.race | 并发 one-shot grant：B 在 I/O 前 await 事件栅栏；期间 A 完成并消费 GA | A 读到 special-a（且仅 1 次 open） | B 用自身 grant 越界=`GRANT_SCOPE_DENIED`；B 用他人未消费 grant=`GRANT_CALL_MISMATCH`；消费后重放=`GRANT_CONSUMED`；B 输出零泄漏；事件序单调 | **PASS** |
| FS-04.symlink | alias→private | — | realpath 实际对象身份拒绝；strace private=0；无披露 | **PASS** |
| FS-04.hardlink | 同 inode 多路径（allowed/ 内别名） | fixture 自证 same dev:ino | **realpath 不足以识别硬链接**（realpath(别名)=别名∈allowed）；需对象身份 (dev,ino) 拒绝账本 ⇒ `ALIAS_DENIED`；两条路径 strace 均 0 open | **PASS** |
| FS-04.traversal | `..` / 绝对外部 / in-anchor `..` | — | `TRAVERSAL_DENIED` / `ANCHOR_OUT` / 一律拒绝（不做路径规格化）；/etc/passwd open=0 | **PASS** |
| FS-04.spaces | 尾空格文件名 `sp␠` 原名读成功（不 trim，realPath 保留尾空格）；trimmed `sp` 探针 ENOENT | 原名成功 | trim 变体不存在（成功 open=0，仅失败探针=1） | **PASS** |

**族 verdict（§5 算法，fixture 级）：`INCONCLUSIVE`（候选），方向性倾向支持"进程内 Controlled FS（adapter 在自身 node:fs 调用点强制）"承载 read/write/edit 族**。前置条件未满足项：① **INV-1 全覆盖未实施** —— FS-01 bypass 腿实证 `T_dispatchable ⊋ T_governed` 时未适配/应 deny 的工具照常可分发并成功读私有数据，故任何族级结论以"deny/适配并存、T_dispatchable⊆T_governed 强制"为前提；② **真实 pinned 宿主复核未做**（P0-6/REG-01），fixture 证据不可提升为选型结论。原生读直通（S-10）= 原生 lane 必须 deny 或适配并存。

## 关键发现（超出逐腿断言的记录）

1. **覆盖 > 机制**：in-process 策略在适配 lane 上表现完美，但只要一个未适配工具还在 dispatchable 面，全部拒绝保证即被整体旁路。这是 T_dispatchable⊆T_governed 强制的直接实验支撑。
2. **realpath ≠ 对象身份**：对硬链接，`realpath(别名)=别名`（POSIX 下硬链接无"正本"）；只按 realpath 判定的策略会被"在允许子树内建硬链接"绕过。有效策略 = realpath 检查 **加** 策略编译期登记的被拒对象 (dev,ino) 集合拒绝。本 fixture 的别名在 allowed/ 内仍被 `ALIAS_DENIED` 拦下（open=0）。
3. **NRM-1 同源教训**：授权对象==访问对象。策略返回的 realPath 原样保留尾空格并用它执行 I/O；trim 变体在 OS 层是**另一个（不存在的）名字**（ENOENT）。任何 trim/normalize 都会把合法路径静默改写成别的对象/错误对象。
4. **one-shot grant 语义顺序**（INV-4）：消费账本为 adapter 级 Map；顺序 = `UNKNOWN → CONSUMED(先) → CALL_MISMATCH → MEMBER_MISMATCH → SCOPE_DENIED → consume`。B 的越权尝试全部止步于 open 之前；已消耗 grant 对任何调用方一律 `GRANT_CONSUMED`。
5. **写面披露**（FS-02）：write-only grant 下 edit 族无法不读旧内容 ⇒ typed refusal（INV-9 失效关闭），write 族结果体**结构上不含**旧内容/diff；正控侧（有权成员）结果语义保持正常。
6. 协调者 strace 提示（-p attach 被 yama 拒、须孵化形态）与实现一致；未因此扩权，未改权限。

## 局限声明（不可省略）

- **非真实宿主**：本实验是 plain-node + 真实 cordis/ToolRuntime 的 **fixture 级**证据；`legacy_native_read` 是原生读通路的测试替身（真宿主直通行为引用 S-10 源码级 CONFIRMED）。P0-6 必须在 pinned 真宿主复验后才可能有族级选型结论。
- **非 OS 级强制**：策略只约束适配代码自身调用；进程内任何未适配代码（包括测试替身本身）都能直通 `node:fs`。strace 只是本沙箱内对本测试进程的**观测**通道，不是强制机制。bwrap/landlock/namespace 均未涉及（那是 P0-4 的范围）。
- open 账本 instrumentation 覆盖 adapter/测试定义的调用面（检查先于 open 的代码结构 + 账本 + strace 交叉验证），不是全进程 syscall 强制。
- 未测范围（记录不装）：symlink **重定向竞态/TOCTOU**（open 后对象替换）、rename/mount 竞态、`watch`/流式读、`read_image`/`editor` 子命令全谱、`~/` Realm Home、FS-02 的"diff 抑制但写成功"变体在真 `write` 工具上的结果等价性。
- 观测者哈希走外部硬链接别名（同 inode）；inode 相同性以 stat 现场核对并写入 evidence。
- worktree 分支与协调者共享，HEAD 在两轮运行间因协调者提交而漂移（header 如实记录当轮 HEAD）；本代理未做任何 git 写操作。
- `probe-scratch/`（fixture-tree、observer 别名、11 份 per-leg strace log）全部保留为原始证据；重跑 `p03-fs-runner.mjs` 会整体重建 fixture-tree（幂等，已实测两轮 EXIT=0）。

## 修正记录（如实记录开发轮，非隐藏迭代）

1. **strace 通道**：从一开始即为"strace 直接孵化 node 子进程"形态（`strace -f … -- node p03-fs-runner.mjs --child=LEG`，每腿独立进程 + log 解析区分成功 open 与 `= -1`），与协调者中途提示的 yama ptrace_scope=1 约束一致；从未尝试 `-p` attach，未扩权。通道本身全程可用（strace 存在，两轮 11 腿 log 均生成）。
2. **通道污染源修正**（非 strace 故障）：首轮 FS-02 负控 strace 计数出现 `secret_okOpens=2` —— 来源是**观测者自身**的前后哈希读取打开了被拒路径字符串。修正 = 观测者改经 fixture 锚点外的硬链接别名（同 inode）读取，被拒路径上的成功 open 计数恢复为 lane 纯净信号（修后 =0）。
3. **adapter 缺陷首轮 FAIL 记录**：首轮 `FS-02.refusal/pos/neg` 三腿 **FAIL** —— 根因是策略方法可选参数解构写成 `{ tool = 'write' }`（无 `= {}` 默认）导致 TypeError，策略尚未执行即崩。修正为 `{…} = {}` 后全 PASS。首轮 FAIL 属于被测 fixture 代码缺陷而非策略被否证，但按纪律如实记录。
4. **TEST DOUBLE 记录**：`legacy_native_read`（bypass 对照）与全部 read/write/str_replace/oneshot 工具是注册在**真实 cordis/ToolRuntime** 上的测试定义（p00 先例：TEST DEFINITIONS stand in for production natives）；真宿主原生 `ctx.fs` 读直通行为本 fixture 不直接执行，以 00-baseline S-10 源码级 CONFIRMED 引用。证据 JSON 不内嵌任何 SYNTHETIC 秘密标记字符串（grep=0），旁路泄漏以布尔+哈希记录。
5. **幂等复跑**：共 3 轮完整运行（修 bug 后 2 轮）均 EXIT=0、11/11 PASS；`p03-result.json` 以最后一轮为准（header 记录该轮 `team_HEAD=42867b7b`、host=`639ed01539…` CLEAN、junction 集前后未变）。

## 工件

- `p03-fs-runner.mjs` — 可复跑 runner（含策略引擎、grant 账本、双通道证据采集）。
- `p03-result.json` — 每腿正负控 + 文件哈希前后 + open 账本 + strace 计数 + grant 账本 + 头冻结信息（无任何 SYNTHETIC 秘密标记字符串，已 grep 验证）。
- `probe-scratch/strace-FS-*.log` — 原始系统调用日志。
