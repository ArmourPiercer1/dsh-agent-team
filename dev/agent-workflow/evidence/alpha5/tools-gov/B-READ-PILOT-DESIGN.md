# B-READ-PILOT-DESIGN — bounded read 试点：设计 + 测试计划（**设计文，实施零启动**）

状态（根正式放行令+补充硬约束 @2026-10-20）：**bounded READ PILOT 已放行（仅此阶段：实现+测试；非 production write/merge/activation）**；branch=`a5-read-pilot`（1-task=1-branch）；重型活体槽=F 五腿之后串行。
**根补充硬约束全文入册**：
- ① **isolated**：实现/证据均在试点世界；**当前生产装配现行为零改动**（strict 生产面写执行道仍不存在——试点不改变生产 deny 语义）。
- ② **绝不以 pin 连续性放行**：effect boundary policy / binding revision / gen / identity / revocation **任何不符=typed reject**；"对象还连着"不构成放行理由。
- ③ **未定义情形先 reject**，且 write 保持禁用（undefined≠pass 化）。
- ④ **不静默丢 sandbox flags / image 模态**：不支持=typed 拒或如实披露，**吞掉**两态皆禁。
- ⑤ 范围锁 read：不扩 image/edit/write 阶段。
- **write 阶段设计边界（预锁，届时另 gate）**：validation 前零 O_TRUNC、read-for-edit 强制、write-only 无旧数据泄漏、禁 pathname reopen；**"retarget 后总写原 fd"不被接受**——pin 对象不得绕过撤销 lease / current policy / identity mismatch，遵原 governedFS 不变量。
架构面依据（根复核确认，无需用户二次架构选择）：原 PR3/PoC3§6 + `tool-fork-debt` 已覆盖 **TeamControlledFs + 边界内 native helper + 独立 ToolDefinition 保 native 契约**；B 只要满足**同 scope 绑定 + 原契约**即在既定授权内，非新架构决策。

## 0. 根纠正（取代 SELECT-TICKET 的过宽表述）

**"单次 open(O_NOFOLLOW)→fstat 即关闭全部竞速"不成立。** 诚实的技术面：

| 竞速面 | 单点 O_NOFOLLOW+fstat 能否关闭 | 本设计采用的机制 |
| --- | --- | --- |
| final-component symlink/swap | ✅ | `O_NOFOLLOW` 打开 + fstat 验证同一 fd |
| **ancestor traversal**（祖先目录被换/指外） | ❌ | **trusted-dirfd 链**：自治理根起逐段 `open(/proc/self/fd/<parentFd>/<comp>, O_NOFOLLOW|O_DIRECTORY)`，每步钉住 inode 视图（见 §2）；`openat2(RESOLVE_BENEATH|RESOLVE_NO_SYMLINKS)` 为**等价但 Node 不可用**路线（如实标注，§5） |
| **parent retarget**（子段打开后父目录被改指） | ❌（单点） | 同上：父 fd 已钉，改名不影响已开 fd；验证全在 fd 上 |
| **hardlink**（受害者 inode 挂进树内） | ❌（内容不可区分） | 政策位：`nlink>1` 默认**拒**（typed），可配 allow+flag；不可达面如实 unsupported（§4-U3） |
| **rename**（验证与执行间换名） | ❌（字符串路径重开时） | **验证后禁任何字符串路径重开**（§2 定律三）：执行只用已验证 fd；换名只影响"下一个 open 见到谁"，不混合两次视图 |
| **O_TRUNC 前置** | —— | **任何情况下 validation 前禁 O_TRUNC**（read 形 O_RDONLY 天然无；定律为全局，写形试点时约束其 open 旗语：O_TRUNC/O_WRONLY 必在 fd 验证全绿之后，创建走 O_EXCL 新建） |

## 1. 范围与契约（read 形试点）

- **同名注册** `read` 的受限复刻件（strict 成员才挂；leader/legacy 面不动），schema/输出信封**与宿主逐字段对拍**（`<path>/<type>/<content>` 信封、行切片、错误文案形状）。
- 同 scope 绑定：定义在我方装配段持有 ⇒ Guard 走装配面定义比较（bindingFeed 增列），**不动 Guard/kernel**；受管名恒等集不变（census identity 不动）。
- 决策一次定律：车道裁决/guard grant 在 dispatch 时已消费；fork 入口快照 `{laneDecision, grantId, policyGeneration}`，执行期不二次裁决（并发换代的语义见 §3-T3）。

## 2. 打开算法（唯一执行体；定律三条）

**边界复用（根令）**：算法构建于**已证 controlledFS syscall 边界**之上——`packages/runtime/controlled-fs/src/open-at-exec.ts` 的既有法（exec-time `verifyOpenedHandle`：`/proc/self/fd` escape 检查 + fstat(dev,ino) 对快照 drift=undetermined 不"差不多"；fallback=段 lstat 走+O_NOFOLLOW+exec 复读，残差窗已在该包 README 登记）；运行时逐项校验经 `admission-binding.ts` 已落地面（`bindAdmissionRecheck`：绑定指纹 divergent/null=`fingerprint-divergence` 拒于 port 之前；`createAdmissionGatedControlledFs` 唯一 sanctioned 入口，unbound=typed 拒非 NO_RECHECK）。试点新增的只有 **trusted-dirfd 链**（下表 stepN，闭合 ancestor 面的 Node 公开面形）与**逐调用 binding/gen/grant/abort 校验**（root ③），不改冻结面、不接 `OpenAtPort`（openat2 native helper 未接线=残差不冒称）。

```
step0  治理根 dir → fd0（世界启动时开一次，fstat 记 st_dev/st_ino 钉住）
stepN  对每个路径段 comp：
       fdN = open("/proc/self/fd/<fd(N-1)>/" + comp,
                  O_RDONLY|O_NOFOLLOW|O_DIRECTORY|O_CLOEXEC)
       —— symlink→ELOOP 拒; 非目录→ENOTDIR 拒; 缺→ENOENT 拒（全部 typed，fail-closed）
final  fd = open("/proc/self/fd/<lastDir>/" + name, O_RDONLY|O_NOFOLLOW|O_CLOEXEC)
verify fstat(fd): S_ISREG 且 size≤cap 且 (nlink 政策) 且 st_dev==fd0.st_dev
read   全部字节经此 fd（一次/分块均可，不再触路径）
```

**定律一（单 fd 执行）**：检查与执行同一 fd 对象；验证后所有读写只经 fd。
**定律二（不重开）**：验证失败⇒typed 拒；**绝不**以 finalpath/新路径二次 resolve 重试（禁 finalpath 重开）。
**定律三（旗语纪律）**：validation 前禁 O_TRUNC/O_WRONLY/O_RDWR；read 形恒 O_RDONLY。

Node 公开面依据：`fs.constants.O_NOFOLLOW` 存在（Linux）；`/proc/self/fd/<n>` 魔链=内核自该 inode 视图解析（祖先换指不影响已开 fd）。**诚实披露**：多步链≠openat2 的单次原子 resolve——每步 fail-closed 但步间存在"下一段见到谁"窗口（该窗口只允许产生**拒**或**当时真实在场文件**两结果，永不混合两视图）；`/proc` 不可用环境=**unsupported**（不降级到字符串路径）。

## 3. 威胁面×机制逐项（含四项必涵面）

| # | 威胁/必涵面 | 机制 | 判据（测试计划引用） |
| --- | --- | --- | --- |
| 1 | **initial path identity** | §2 链从钉住的治理根 fd0 起步；首段前 fstat 钉 st_dev；链上任一 symlink/换指=ELOOP/ENOTDIR typed 拒 | T-U2/U3, T-L2 |
| 2 | **fd 验证** | open 后 fstat(fd)：S_ISREG/size/nlink/st_dev；任一不合=typed 拒且**不**回退路径重开 | T-U4/U5, T-L1 |
| 3 | **stale-generation·grant 并发** | 入口快照决策上下文；in-flight 完成于已开 fd（有界：size cap+超时）；换代不预抢占=**披露语义**；ledger 恰一次消费（不双烧不裸放） | T-L3 |
| 4 | **creation-overwrite 语义** | read 形无创建/覆盖（无此面，**如实标 n/a**）；定律三预锁写形未来约束（O_EXCL 创建、验证绿前禁 O_TRUNC） | T-U6（缺文件=native 形错误，非创建） |
| 5 | **错误 metadata 不泄漏旧内容** | 错误载荷只含 {path, code, 当前 size/stat 摘要}；**禁**内容片段/旧 stat 快照/partial buffer 入错误 | T-L4 |
| 6 | **不得以 finalpath 重开** | 定律二 + 打开计数观察（链开次数=段数+1，验证后 open 调用=0） | T-L5 |

## 4. unsupported / 残差面（一律如实标，不 pass 化）

- **U1 原子 resolve**：Node 无 openat2 绑定；多步链等价非原子——披露残差窗口及其两结果收敛（拒/在场真实文件）。生产收敛路线（不在本试点）：native helper(openat2) 或 per-tenant uid 或受审计 restricted trusted-tree（祖先 root-owned 不可写）。
- **U2 /proc 不可用**：整体 unsupported，硬拒（无字符串路径降级）。
- **U3 hardlink 混淆**：内容级不可区分；默认 nlink>1 typed 拒；allow+flag=政策位非安全等值。
- **U4 树内 symlink 正读**：本 fork NO_SYMLINKS 恒拒——**严于**宿主 native（native 跟随）；形状对拍含此显式差异表条目（差异=治理收紧，非行为漂移，须披露）。
- **U5 特殊文件/稀疏/超大**：S_ISREG+cap 拒（typed）；mmap 面不提供。
- **U6 换代抢占**：in-flight 不被策略换代抢占（有界执行），语义披露。

## 5. 测试计划（正负两收据×面；实施 gate 开启后执行）

**单元（确定性，无 live）**
- T-U1 形状对拍：同输入 vs 宿主 native read——输出信封逐字段等（文本/行切片/空文件/二进制头）。
- T-U2 final symlink→typed ELOOP；T-U3 mid-chain symlink→ELOOP；均零内容外泄。
- T-U4 fifo/device→S_ISREG 拒（带超时守卫不死等）；T-U5 size>cap→typed；T-U6 缺文件=ENOENT 形错误与 native 文案形状等（非创建）。
- T-U7 双视图不混合：链中注入换指（测试 seam）只产 {拒|旧|新} 单视图。
- **T-U8 hardlink 负控（必列必跑）**：树内 nlink=2（victim inode 挂入）→默认 typed 拒（政策位可 allow+flag，但 flag≠放行）；断言拒答不含旧内容。

**活体（read pilot 已放行；真装世界 pinnedHost）**
- T-L1 rename churner：lane-allow 与执行间并发改名 final→victim；断言**单次视图**（{拒|旧|新} 之一，永不混合）+ 无 finalpath 重开。
- T-L2 ancestor swap churner（**retarget 负控**）：祖先目录换指；断言 fail-closed（ELOOP/ENOTDIR/ENOENT typed），victim 字节原样。**retarget/hardlink/rename 三负控=T-L1/T-L2/T-U8，必列必跑。**
- T-L3 stale-grant：测试 seam 停在入口后翻转策略代际；断言恰一消费/完成或 typed-stale/账本对齐。
- T-L4 错误审计：强制 EACCES/EISDIR/ELOOP/hardlink 全谱，断言错误载荷零内容子串。
- T-L5 重开探测器：wrapper 计 open 调用；验证后 count 增量=0。
- **T-L7（补②）pin 连续性不得放行**：fd 已开且对象在场，但 binding revision 落后 / gen 换代 / identity drift / 撤销 lease 命中——任一=**typed reject**（四变体各一腿）；断言零字节读出、错误码逐变体名。
- **T-L8（补③）未定义情形矩阵**：缺 flag 组合/未知资源 kind/空 path/相对 path 越根/未知错误码——一律**先 reject**（typed），并断言 write 相关面保持禁用（无隐式降级）。
- **T-L9（补④）不吞 flags/模态**：调用携带 `sandbox_permissions`/image 类参数→fork **类型化拒答或如实披露**，断言错误载荷**点名被拒字段**（不得静默剥离后照常执行；亦不得返回与 native 不同的静默成功形）。
- **试点验收总门**：pinnedHost 下 **allow/deny/ask 三形态→实际 bytes + FD witness**（读时 fd 号 + `/proc/self/fd` readlink + fstat 快照入档）；**original native body 调用计数=0**（宿主 tool-fs read 入口 wrapper 观察 + 装配面定义身份比对，两法互证）；native **schema/output/errors/cancel 四 parity** 对拍；每条判据=机器档（criteria.json + 原始 wire/proc 档，含精确头）。
- lanes 全链复跑（L1-L9 全绿为**下一阶段 write 门**，read pilot 期 write 面保持禁用，此处仅确认 read 腿不因试点回归）。

**交付序（read pilot）**：形状钉 spec → 打开算法实现+单元（T-U*）→ 活体三形态+FD witness+native-body-count=0+四 parity（T-L*）→ 精确头报独审。每步 RED 只追加。write/edit/read_image 阶段不启动。

## 6. 放行状态

实施零启动（无实现文件、无目录）；本设计+测试计划=当前全部放行物。**最终 gate 候根**。
