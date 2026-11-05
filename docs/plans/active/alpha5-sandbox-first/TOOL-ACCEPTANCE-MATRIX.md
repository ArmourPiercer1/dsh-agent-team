# ALPHA.5 SANDBOX-FIRST — TOOL ACCEPTANCE MATRIX（逐工具验收）

<!-- phase-baseline-ref: dev/engineering/current-authority.json -->
<!-- phase-identity: alpha5-sandbox-first -->

> **当前阶段：ALPHA.5 SANDBOX-FIRST**。本矩阵是**验收合同**，不是能力宣传：每行只写已经有证据
> 支持的状态。`NOT_WIRED` = 新执行面尚未绑定该工具；`PROBE-GATED` = 机制已由 P1 探针证实但工具
> 尚未端到端绑定；`DONE`/`LIVE-CONFIRMED` 需要 tested SHA **和**可解析的证据路径。
> **历史绿 ≠ 新验收**：旧矩阵的 PASS、旧 `web-family` 历史、旧 `fs-family` 证据都不能折算成本表
> 的等级。`V@B` = 该行是否已在当前 baseline 上验证（`yes` 才计 current claim）。
> 设计需求正本 = `docs/plans/memo/alpha5-sandbox-first-20261101/`（尤其 TOOL-ADOPTION-MATRIX）。

## 0. 全表前提（不因行而异）

- 每次受限调用必须满足 `EffectiveIo(member,tool,call) ⊆ MemberCeiling(member) ∩ ToolRestriction(member,tool)`；
  三轴 = read / write / network。本轮 `network=restricted` 为 **UNSUPPORTED**（没有目的地粒度）。
  **2026-11-05 审查修复（B1，机制级）**：本前提曾有一个反例——`projectToolIoRestriction` 把合法的
  v4 `{mode:'all', deny:[…]}` 整条塌缩为 `'no-additional-narrowing'`（丢弃 deny），realm 因此**服务**了
  被拒绝的路径（实测 `readText(secret)` 成功、`providerReads = 1`）。已修：只有 `deny` 为空的 all
  lane 才是交集恒等元，否则保留 `mode:'all'` + deny 的 `PathRuleSet`（交集/匹配/定位器判定本就支持该
  形状，无需新形状、无需拒绝分支）。两级回归臂已锁：`a5sf-member-policy.test.ts`（投影层，
  read+write 两轴）与 `tests/world-factory/a5sf-product-assembly.test.mjs` PA8（realm 层，
  `IO_READ_DENIED`、`providerReads = 0`、被拒文件仍存在）。证据 =
  `dev/agent-workflow/evidence/a5sf-product-assembly/README.md` §10-B1（含 RED 记录）。
- 工具级 `allow all` 不是 Member 上界的提升；审批只决定“是否允许执行”，不改写硬上界。
- 不允许的降级：Provider 不可用、后端不强制、策略不可表达时**拒绝执行**，绝不退回裸执行。
- 同一 `member/tool/call/revision` 必须能追到：Alpha.4 允许/拒绝 → 编译结果 → Provider
  `consulted` → 独立效果 Oracle。缺任一环即不构成 PASS（BL-11）。
- 表内等级闭集：`DONE` / `LIVE-CONFIRMED` / `ENFORCE-PARTIAL` / `PROBE-GATED` / `WIRED` /
  `WIRED-NOT-ACCEPTED` / `BOUNDED-DEFER` / `DEFERRED` / `UNSUPPORTED` / `NOT_IMPLEMENTED` /
  `NOT_WIRED` / `NOT_IMPLEMENTED/NOT_WIRED` / `NOT_VERIFIED` / `BLOCKED-FOR-RELEASE` /
  `NEEDS_REVALIDATION`。
- 等级语义（描述性定义；⑧ 的机器可写值仍以上一条闭集为准）：
  `ENFORCE` = 机制与全部最低验收项在指定树上都被实测；
  `ENFORCE-PARTIAL` = 机制已实测但至少一项最低验收项未覆盖（host-free 半场的常规等级）；
  `NEEDS_REVALIDATION` = 曾 live 实测，但其树早于当前 baseline（Q7）；
  `N/A` = 该工具不经本机制（没有可验收的执行面）；
  `NOT_WIRED` = 该工具本应经本机制，但新执行面尚未绑定（目前不经本机制）。
  `ENFORCE` / `N/A` 尚未进入 ⑧ 闭集与 `ci-pr-gate` 的 ENUM，当前无行使用；要把它们写成 ⑧，必须同时
  扩展 gate 的 ENUM（本审计不改 gate）。
- `V@B` 与 ⑧ **正交**：`V@B` 只回答“当前 baseline 的树是否被测过”，不回答等级高低；语义上一行可以
  `ENFORCE` 而 `V@B=no`（当前无此组合）。

## 1. 主矩阵（工具 × 面）

<!-- q5:main-begin -->

| ①行ID | ② 工具 / 面 | ③ 接入模式 | ④ 编译上界 | ⑤ 最低验收 | ⑥ 验证 | ⑦ 残余风险 | ⑧ 等级 | ⑨ V@B |
|---|---|---|---|---|---|---|---|---|
| read (M-01) | 原生 read（ctx.fs） | service-mediated:fs（route C 重挂原生模块到 Member 隔离 fs scope） | MemberCeiling(read) ∩ ToolRestriction(read) | 大文件中间窗口、流式、禁读真实拒绝、双 Member 不串权 | **live 已实测**（8/8 acceptance 的 row1/row2/row3——lane 内读取由 confined provider 实际服务、restriction 拒绝、ceiling 拒绝；退出码与逐案判定见附录 A 与 README §13）；证据=dev/agent-workflow/evidence/a5sf-preflight/README.md；tested=44babbfcff2026b04395f2219a1c4a77565ff7af | 大文件中间窗口/流式仍未覆盖；工具尚未绑定到生产 preset（本行证明的是装配+准入+执行体）；可信 JS 可绕 ctx.fs（TRUSTED_ONLY）；**live 断言按 Q7 仍记 `NEEDS_REVALIDATION`（2026-11-05 重切未能复位）**：重切前 baseline 早于 63 个产品面路径；重切 `as20261105r1` 把 baseline 移到 `1fd0d9fca…`，但实测树 `44babbfcf` 的 `packages/**` 与它**不相等**（116 个路径，含 `team-services/src/fs.ts`、`mount.ts`、`member-io-policy/src/{compile,path-rules}.ts` 与 glue `src/plugin/live/agent-bindings.mjs`；glue sha256 `df9b46af…` ≠ `6d256096…`），该 live 证据描述的树不是新 baseline 的树；复位需在新 baseline 上重跑 live，证据不删（§1.1 / 附录 A）**2026-11-05 candidate-1 live 重测（在 baseline 树上，不是旧树的等价证明）**：冻结候选 `1484fa4ee`（= snapshot `as20261105r2` 的 baseline）单次 boot（port 3184，`dev/agent-workflow/evidence/a5sf-candidate1/README.md`，run `a5sf-candidate1-2026-11-05T12-17-52-246Z`，11 案 9 PASS / 2 FAIL，1 intent + 1 boot，0 abort）：row1（A）PASS（2 条 binding allow fact、1 次 confined provider read）、row3（C）PASS（ceiling deny / restriction allow / effective deny，无放宽）、**row2（B）REFUTED**，失败条款 `everyReadPathFactOnBindingLane`——B 与 search row3 的 grep 操作数共用同一 locator，同一路径上多出一条 member realm 的 `spawn deny`（grep 准入），judge 见 2 条 read-path fact 不全在 binding lane；`bindingDenyOnReadPath`/`everyReadPathConsultationDenied`/`noProviderRead`/`noClaimLeak`/`typedLaneRefusal` 均为真。REFUTED 不能当 PASS，故当时维持 `V@B=no`。**同日 allocation #4 retry（coordinator 授权，同一 baseline 树）**：只把 fixture 拆开——FS read B 改到 `workspace/lane/fs/outside-restriction.txt`（自己的 locator、自己的 expected fact 集），search row3 的操作数 `workspace/lane/outside-restriction.txt` 原样不动；判官文件字节未动。单次 boot（port 3184，`dev/agent-workflow/evidence/a5sf-candidate1/README.md` §3，run `a5sf-candidate1-2026-11-05T12-33-06-567Z`） **11/11 PASS**，本行判 `BINDING_DENY_ON_READ_PATH`：`readPathFacts 1`、method `stat`、decision `deny`、全部在 binding lane、`noProviderRead`、`counterRows 0`。故本行复位为 `ENFORCE-PARTIAL` / `V@B=yes`：tested `25e106b4573cac0ab624c7e0bc5ca7d36dba3730`（= 冻结候选 `1484fa4ee` + 仅证据/fixture 改动，`packages` tree `44535c94…`、`scripts` tree `d4bcc358…`、两个判官 blob 逐项与 baseline 相同，见 run record `bindings.productTreeProof`），snapshot `as20261105r2` 的 baseline = `1484fa4ee`。 | ENFORCE-PARTIAL | yes |
| write (M-02) | 原生 write（ctx.fs） | service-mediated:fs | MemberCeiling(write) ∩ ToolRestriction(write)（binding restriction 只约束 read 轴） | 原子替换与版本校验、禁写字节不变、写不自动获读 | **live 已实测（两半）**：row4a 在 lane 内可读路径上写成功，全部 write fact 落在 **ceiling realm**；row4b 证明 guard **允许**「写一个 binding lane 读不到的文件」，拒绝写出的是**原生 write 工具自身的 read-before-write 契约**（原生工具要求先 read，不是 Team lane 在拒绝）；证据=dev/agent-workflow/evidence/a5sf-preflight/README.md；tested=44babbfcff2026b04395f2219a1c4a77565ff7af | **2026-11-04 裁决（README §12.8.3 RULING）**：原生 write 的 read-before-write 契约保留，代数**不加** write⇒read 耦合；只写不读/读被拒权限下的 team 行为 = `BL-38`（owner-owned，非本 lane 实施）；原子替换/版本校验未单独验收；**live 断言按 Q7 仍记 `NEEDS_REVALIDATION`（2026-11-05 重切未能复位）**：同 M-01——实测树 `44babbfcf` 与 baseline `1fd0d9fca…` 的 `packages/**` 不相等（116 个路径；写/读轴的 `team-services/src/fs.ts`、`mount.ts`、`install.ts` 与 `member-io-policy/src/*.ts` 都在其中），证据不删；复位需在新 baseline 上重跑 live**2026-11-05 candidate-1 live 重测（baseline 树上）**：冻结候选 `1484fa4ee`（= snapshot `as20261105r2` 的 baseline）的同一次 boot（port 3184，`dev/agent-workflow/evidence/a5sf-candidate1/README.md`）在**当前 baseline 树**上判绿 row4a（写 lane 内可读文件：盘上内容与写入一致、write fact 在 ceiling realm、confined provider 写 1 次）与 row4b（ceiling 允许而 binding 读不到的目标：guard 允许写，原生 write 以 read-before-write 拒绝，盘上字节不变、无植入字节回传）。故本行复位为 `ENFORCE-PARTIAL` / `V@B=yes`（snapshot `as20261105r2`；tested `1484fa4ee0ff9326a3dafcac060bf63f8d334a1f`）；未覆盖项不变：原子替换/版本校验、只写不读的 team 语义 = `BL-38`。同日 allocation #4 的同树 retry（tested `25e106b4…`，产品树逐项相同）11/11 复核，两行仍绿。 | ENFORCE-PARTIAL | yes |
| edit (M-03) | 原生 edit | service-mediated:fs | 读旧内容与写新内容两轴 | 版本冲突、禁写、读旧内容也需读权限 | **host-free 半场已实测；live 半场从未运行**：EDIT-1（routed/confined 定义在 lane 内执行，恰一条 `editText/allow` 事实，与 preset 对照可区分）+ EDIT-2（out-of-lane `IO_WRITE_DENIED`，字节不变）+ EDIT-3a/3b/3c（读写两轴分离：`IO_WRITE_REQUIRES_READ` / `IO_WRITE_DENIED`；读要求以目标存在为条件）+ EDIT-4（只在 ceiling partition 恰一次，surface 中性）；证据=dev/agent-workflow/evidence/a5sf-fs-tools/README.md；tested=93b007cd2f496877e70abec4ee5aec25f9be4753 | 版本冲突与原子替换未测（provider double 不触发 live 的 expected-version 校验/atomic rename）；只有 ceiling 车道；**六行 live 验收不含 `edit`**——该证据行自述 `V@B=no`，本行不得写成 live（2026-11-04 更正了此前的一句 live 误述） | ENFORCE-PARTIAL | no |
| read_image (M-04) | 原生 read_image（routed deferred registration） | service-mediated:fs + attachments（原生 `ctx.inject(['attachments'])`，见 #576） | 读上界，附件服务单独识别 | 像素与大小上界、工具展示等价；附件来源不可绑定则 UNSUPPORTED | 证据=dev/agent-workflow/evidence/a5sf-deferred/green-probe.log,dev/agent-workflow/evidence/a5sf-deferred/all-a5sf-node-suites.log,dev/agent-workflow/evidence/a5sf-assembly/README.md,dev/agent-workflow/evidence/a5sf-p0/README.md,dev/agent-workflow/evidence/a5sf-acceptance/README.md；**机制半场（host-free，条件性证明）**=A1（`mounted=true`，`definitionIdentities.read_image="routed"`）+ TA11（deferred 定义经同一 partition，`read` 仍按编译交集拒绝）+ assembly §3.2（post-settle 注册折叠入账并 invalidate）+ P0 §3（admission deny 覆盖该 managed name）；**live 未验收**=acceptance §1/§9（第 2 条）；证据 HEAD `cfdf87267`、`84e9348fc`、`6d1b7a1fb` | 依赖可解析的 `attachments`（缺失时该子 fiber 良性不注册、`read_image` 不在 surface）；依赖 `DEFERRED_SETTLE_ROUNDS=20` settle bound（有 attachments 时实测 ~4.2 ms / A1 端到端 10 ms；超界即 fail-closed 拒绝）；read_image 自身执行路径未经 guard fact 测量 | BOUNDED-DEFER | no |
| str_replace_editor (M-05) | str_replace_editor（若 Host 提供） | service-mediated:fs | 读写两轴 | 原生编辑与原子写保留、逐工具拒绝 | 证据=dev/agent-workflow/evidence/a5sf-g1/G1-GATE-REPORT.md；机制级 | BL-21 库存已查明：模块存在于 pinned baseline（`@deepseek-ai/dsh-tool-str-replace-editor`，`inject=["tools","fs"]`，同步注册 `str_replace_editor`），但**不在产品 preset 里、也未进 `a5sfNativeToolModules`** → 未接入；见 `NATIVE-SOURCE-INVENTORY.md` §2/§3 | NOT_WIRED | no |
| grep (M-06 native) | 原生 grep 经 OS rg | service-mediated:subprocess 加 os-confined:leaf | 读上界；进程 argv 不可注入越界路径 | exit 0/1、无匹配、非法模式、流与取消、真实 OS 拒读 | **host-free 半场已实测（BL-16）**：真 pinned `@deepseek-ai/dsh-tool-fs-search` 0.2.0-rc.2 @ `639ed01539` + 真 `rg`（`@vscode/ripgrep-linux-x64@1.18.0`）+ P1-07 真 Landlock launcher，经产品 seam（`mountMemberA5sfRealm` + `attachA5sfNativeToolModules`）驱动；GREP-PRE（对照：confined 面挂载前同一越界搜索仍执行并返回越界内容、`facts=0`，即 SEARCH-3 的原洞）+ GREP-IN（in-lane 执行成功，`method=spawn/allow/ALLOW`，locator=搜索根）+ GREP-OUT（out-of-lane **在任何进程存在前**拒绝：`spawns=0->0`，恰一条 `decide/IO_READ_DENIED` 事实，越界内容不出现）+ GREP-EXIT1（无匹配 = 正常结果而非失败）+ GREP-EXIT2（非法模式 = 失败，绝不冒充 no-match）+ SHELL-DENY（`sh -c 'cat /etc/passwd; cat <outside>/secret.txt'` 在**准入层**被拒：`spawns=0->0`、`providerCalls=0`、恰一条 `deny/IO_READ_DENIED` fact（`locator=/bin/sh`）、字节为空；同一命令在修正前实测返回 `/etc/passwd`） + KERNEL（第 2 层直测：raw provider 绕过准入时，越界读被内核拒绝且 in-lane 读仍成功） + PIN-ETC/PIN-SYMLINK/PIN-HARDLINK/PIN-CAPS（实测内核 allowance `lane ∪ /bin,/usr,/lib,/lib64,programDir ∪ /etc,/proc` 的边界、in-lane 能力收窄；symlink 只在第 2 层 raw provider 下可服务，产品 seam 因 `--follow` 不在 shipped shape 内而拒绝）+ B1-FILE/B1-FILEEQ（`rg -f`/`--file=` 的 pattern-file 读在准入层拒绝）+ B2-NOCONFIG（`--` 之后的 `--no-config` 只是 operand；`RIPGREP_CONFIG_PATH` 的 `--pre` 不再可达）+ B3-PROG（可写目录中名为 `rg` 的脚本因 realpath 落在 effective write lane 而拒绝）；单元/产品 seam 套件 `packages/runtime/test/a5sf-confined-subprocess.test.ts`（21）+ `a5sf-bl16-grep-realm.test.ts`（6）各有臂；证据=dev/agent-workflow/evidence/a5sf-bl16-grep/README.md + `dev/agent-workflow/evidence/a5sf-bl16-grep/arms.json` + `dev/agent-workflow/evidence/a5sf-bl16-grep/grep-arms.mjs`（18 臂）；历史可采纳性测量（SEARCH-0/1/2/3）仍见 dev/agent-workflow/evidence/a5sf-fs-tools/README.md |**host-free 半场已实测（该段为 2026-11-04 时点）**：当时无 Host boot，生产 preset/glue 是否真的供给 `subprocess` face、live agent 的 `grep`/`glob` surface 是否中性未实测；2026-11-05 的第十次 boot 在 `c658d974d` 上补齐了 live 半场（六行全 PASS，见本行末条）。残余风险（按实测改写）：（a）**内核 allowance 大于“lane 之外一律拒绝”**：OS profile = `lane ∪ /bin,/usr,/lib,/lib64,programDir ∪ /etc,/proc`；前四项与程序目录由本 face 为 exec/loader 添加，`/etc`+`/proc` 的 READ_FILE/READ_DIR 来自**共享 launcher 的 `runtime_base`**。实测（raw provider，绕过准入）：直接 `/etc/passwd`、`/usr/lib/os-release`、`/proc/self/status` 读取成功；in-lane symlink 到三者仅在 `--follow` 下成功（产品 seam 拒绝该 flag）；**预先存在**的 in-lane hardlink 到 lane 外 inode 成功（`PIN-ETC`/`PIN-SYMLINK`/`PIN-HARDLINK`）。内核拒绝 `/home` `/srv` `/var` 与 scratch 兄弟目录。**因此对 allowance 内的“已声明 root”，准入层是唯一一层**。**在 BL-39 后端加固审计落地前，OS profile 不是全局读白名单**：它是含 `/etc`+`/proc` 的 allowance，审计范围 = 枚举真正不可避免的 runtime 依赖、逐项判断能否收窄到具体文件/目录、区分哪些例外属于可信 host 而非不可信子进程。（b）**shell 洞已按准入关闭，不再是“无 fact 不对称”**：`sh`/`bash`/`python*`/`node`/`perl`/`ruby`/`awk`/`xargs`/`find`/未知二进制一律在准入层拒绝（typed `TeamIoDenial(IO_READ_DENIED)` + 恰一条 deny fact + 0 进程）。allow-list 是声明的类型化列表（当前仅 `rg`）；`rg` 的 argv 契约是 **shipped shapes 的 allow-list**：`--no-config` 必须是程序后的第一个参数（在首个 `--` 之前），只接受 `--json`/`--regexp=…`/`--glob=…`/`--files`/`--sort=modified`/`--no-ignore`/`--hidden` 与 `--` 根；`-f`/`--file`/`--ignore-file`（B1：读未声明的 pattern/ignore 文件）、位置化 `--no-config`（B2）、`--pre`/`--search-zip`/`-z`、`--follow` 及其余 flag 一律拒绝。**残余**：已准入 root 内部的预置 hardlink 仍被产品 seam 服务并记 `ALLOW` fact（准入只看声明的 root，不遍历树）；nested symlink 只在内核层（raw provider + `--follow`）可服务，产品 seam 已拒绝 `--follow`；程序身份按 **effective write lane 的 realpath** 判定（B3 关闭），但不按二进制字节 hash，也不覆盖本 face effective write lane 之外的 Member 可写集合，且不检查调用方 `spec.env`（`LD_PRELOAD`/`LD_AUDIT` 类加载器注入；可达前提 = 直接控制 argv/env 的调用方，pinned 模块不提供该入口）。（c）模型可见文本是模块自己的 `grep subprocess failed before reporting an outcome`，typed code 只在抛出的 `TeamIoDenial` 与事实里。（d）`toolBindingIdentity` **显式为 `null` 且 install spec 没有字段可设**：`ConfinedSubprocessOptions.toolBindingIdentity` 存在、默认 `null`，但 `ConfinedSubprocessRealmSpec`（install/realm 输入）未暴露该字段，故所有事实 `toolBindingIdentity=null`；search 无 `dsh.fs/*` 绑定，ceiling realm 即预期 realm，但这不是“绑定面已覆盖”。（e）`mode:'all'` 车道、spill/control/inherit stdio、`spawnTerminal`、非绝对 `argv[0]` 一律 fail-closed 拒绝（非降级）。（f）**binding-realm 不再有潜在洞（BL-17，2026-11-04）= 组合期 typed 拒绝**：`mountNativeToolModules` 将 binding-owned mount 挂到 `binding?.ctx`，而 `installToolBindingRealm` 只隔离 `fs`、**不挂 `subprocess` face**。现在每个已装 realm 以**必填**的 `faces: RealmServiceFaces` 陈述自己拥有哪些 confined face（`subprocess` = 已挂 face 或 `null`，不允许“未回答”）；声明 `inject` 含 `subprocess` 的模块若目标 realm 的答案是 `null`，在**任何 fiber / tool 定义 / service lookup 之前**以 typed `TeamServiceInstallError` code `SUBPROCESS_UNCONFINED_REALM`（导出 token `A5SF_SUBPROCESS_UNCONFINED_REALM`）拒绝，错误点名 realm 与 module；deferred `ctx.inject(['subprocess'], …)` 由 settle 后的子 fiber 检查在同一组合边界拒绝。实测（host-free，真 pinned 模块）：`a5sf-subprocess-unconfined-realm.test.ts` U1/U1b——binding-realm mount 与产品行 attach 都被同一 code 拒绝，`spawns=0`、base `subprocess` tripwire 计数不变、被拒调用创建 **0** 个 fiber、`grep` 定义仍是调用前那个；U2 对照：拥有 face 的 Member realm 挂载同一模块并让 routed `grep` 在 confined provider 上执行。search 不受影响（挂 ceiling `memberTarget`）。**未来 binding-mounted subprocess consumer 如何才受支持**：在该 binding realm 的隔离 scope 上安装 confined `subprocess` provider 并在 `faces.subprocess` 报告它（`installToolBindingRealm` 今天不挂）——否则一律拒绝；不得放宽 mount seam，也不得解析继承的 base service。（g）**in-lane 能力收窄（实测 `PIN-CAPS`）**：文件写成功；`mkdir`、symlink 创建、in-lane `execve` 被拒；**两个 in-lane 路径之间的 hardlink 创建成功**（profile 无 link 位）——“no link creation”对 hardlink 为假，本行不采用该说法。（h）未测：>cap 结果裁剪、流式读取中途取消（取消臂用 double）；无 Host boot。**2026-11-05 产品装配半场（不改变本行等级）**：产品行现有 `config.a5sfMemberPolicies` 产品可见声明面（`packages/runtime/team-services/src/product-assembly.ts`；声明即受管、未声明的模板走原路径，不是隐藏开关），被声明模板经**同一** `mountMemberA5sfRealm` 得到 ceiling+binding realm，且该声明面把`executionBoundary=confined-subprocess` 的绑定在**组合期**以 `SUBPROCESS_UNCONFINED_REALM` 拒绝（网络轴收窄 → `NETWORK_UNCONFINED_REALM`）。**但这不构成本行的产品覆盖**：confined `subprocess` face 仍不能由产品 config 表达（需组合提供 P1-07 `ConfinedProcessProvider` + launcher pin），且本仓库没有任何 shipped composition/preset 声明 `a5sfMemberPolicies` —— preset-only World 的 `grep`/`glob` 仍无受限面（`dev/agent-workflow/evidence/a5sf-search-live/README.md` §4 F2 结论不变）。证据=`dev/agent-workflow/evidence/a5sf-product-assembly/README.md`。 **2026-11-05 家系发现（live row 1 判红后修复；本行等级/V@B 不变）**：in-lane `grep` 在 git worktree 内曾因 confined `rg` 向上做 VCS/祖先 ignore 发现、读 lane 外 `.git` FILE 被内核拒绝而 `exit 2`；修复在**调用**而非 lane：`laneSafeSearchArgv` 仅在「搜索根的祖先超出 effective read lane」时于 `--no-config` 后加 `--no-ignore-parent --no-ignore-vcs`，并把「VCS/祖先 ignore 发现已禁用、`.gitignore`/`.git/info/exclude` 语义不再应用、`.git` 未被读取」记在**同一条** allow fact 的 `annotations`（`a5sf-guard-consult/1` 可选增量字段；fact/进程数不变）；lane 含 worktree root 时 argv 原样、`.gitignore` 语义不变；`.git` 直读仍在准入（deny、0 进程）与内核两层拒绝。残余：仅在该根祖先越界时 `.gitignore` 语义被关闭（同目录下被忽略文件会进入结果），已由上述 fact 披露；未 boot、未重判 live row。证据=dev/agent-workflow/evidence/a5sf-rg-ancestors/README.md。 **2026-11-05 live 半场：六行全 PASS；重切时曾复位为当前断言，但 `#598`/`#599`/`#600` 后已退回 `ENFORCE-PARTIAL` / `V@B=no`**：`P2-04` 第 10 次 boot 于 head `c658d974d`（证据 `dev/agent-workflow/evidence/a5sf-search-live/`，`overall=PASS cases=6 PASS:6`，`10 intents + 10 boots + 0 aborts`）在真 Host 上判绿：in-lane 允许（`confined-exit code=0`、`stderr` 为空；同时按 `#593` 记录 `annotations`：该 lane 形态下 `.gitignore`/`.git/info/exclude` **关闭**）、越 ceiling 与越 restriction 两种均在任何进程存在前拒绝、取消后子进程以 143 终止、非法模式为 tool error、archive 边界后工具面 **422 + 0 fact + 0 spawn**。**旧 baseline 下不计 current claim 的原因不是能力而是新鲜度**：`as20261102r1`（`17ce7043…`）早于本轮产品面（`#593`/`#594` 均改了 `packages/**`）。**2026-11-05 重切曾证明树相等并复位本行（该复位只对当时那棵树成立）**：实测树 `c658d974d` 的 `packages/**` 树哈希 `9609403ccc5a2057f66fbc2d0b6187832d834814` 与新 baseline `1fd0d9fca…` 的 `packages/**` 树哈希逐字节相等；`scripts/**`、`tests/paths.mjs`、`package.json`、`pnpm-lock.yaml`、glue `agent-bindings.mjs` 亦逐项相等。故当时按 §1.1 记 `ENFORCE-PARTIAL` / `V@B=yes`（snapshot `as20261105r1`；tested `c658d974d3d0502af482727b0aea23482f5e3920`），证据不删；`#598`/`#599`/`#600` 再移动产品面后本行已退回 `V@B=no`（见本节末与 §1.1）。**本行明确不放宽**：`toolBindingIdentity` 仍为 `null`（install spec 无字段）；row 3 的 **preset-expression** 收窄臂仍 `UNSUPPORTED`；binding-realm `subprocess` face 仍被 BL-17 拒；row 6 的 typed code 只在产品内部，线上仅 422 + message **2026-11-05 归档边界并发窗口（不改等级）**：live 第十次 boot 判绿的 row-6 断言是**顺序**形态（归档完成后下发）。同日独立审查实测产品顺序为 `quiesce → commit`（`quiesce.ts:143` 释放驻留 → `archive.ts:141-151` durable ARCHIVED）；其 **quiesce → commit 窗口**内的下发曾被合法冷启动并让 handle 活过提交（200、1 次工具执行、驻留存活）。修复=提交后重放驻留释放 + resume 后 durable 复核（`liveAgents.set` 前无 await）+ 每成员 admission close（原先产品为 no-op，现实现并在每次退出时 reopen）；host-free 臂 `dev/agent-workflow/evidence/a5sf-archived-gate/archive-race-arms.test.mjs` RO1–RO4 与变异对照 `race-mutation-control.mjs` 覆盖该窗口（RED 3 failed / 1 passed → GREEN 4/4）。本行等级仍为 `ENFORCE-PARTIAL`，但 `V@B` 已退回 `no`（见本节末）；live 证据未删、未重判。仍不覆盖：child factory 的 `liveAgents` 写入（row-start、无工具下发路由）与跨进程陈旧视图；boot resume loop 与 boot publish 已由 `#599`/`#600` 关闭（`a5sf-boot-seam`/`a5sf-boot-publish` 的 BS1–BS5；前提 = lifecycle 接线 `AdmissionClosePort`，产品 `root.ts` 自 `#598` 起满足），且 mid-boot publish 确实可从工具下发到达（BS4），不能再写成“非工具下发路径”。另：deny fact 不再携带"rg 已运行"注解（原为事实夸大，已修并加被拒目录根回归臂）。 **本行 `V@B` 于同日退回 `no`（不是能力撤回，也不是重新判负）**：`RACE-FIX` 改了 `archive.ts`/`dispose.ts`/`quiesce.ts`/`agent-bindings.mjs`/`guard-observability.ts`，即 live 六行所测产品面本身；Q7 因此拒绝 current claim（`#598` 时点 34 条；至 `#600` 为 36 条）。live PASS 仍属于修复前的树（证据不删），要恢复 `V@B=yes` 只能在新树上重新实测——需新的 boot 预算，`P2-04` 已 10/10 用尽。**2026-11-05 candidate-1 live 重测（baseline 树上）**：冻结候选 `1484fa4ee`（= snapshot `as20261105r2` 的 baseline）单次 boot（port 3184，`dev/agent-workflow/evidence/a5sf-candidate1/README.md`）六行中 row1/row2/row4/row5/row6 PASS（row1：1 confined spawn、0 base、confined-exit 0；row2：0/0 进程、1 deny、无泄漏；row4：子进程 143；row5：tool error；row6：归档后 422 + 0 fact + 0 spawn，home 删除、端口释放、无孤儿），负控 PROVEN（无 realm 时同一越界 grep 返回 2 行越界内容、11 次 base spawn、0 guard fact）；**row3（restriction 收窄臂）REFUTED**，失败条款 `exactlyOneDenyFact`，原因同 M-01：B 与该行操作数共用 locator，多出一条 binding realm 的 `stat deny`；产品侧仍是 0/0 进程、无泄漏、result 为 error。REFUTED 不是 PASS，故当时维持 `V@B=no`。**同日 allocation #4 retry（同一 baseline 树，只拆 fixture）**：row3 判 `RESTRICTION_NARROWER_THAN_CEILING_REFUSED_AT_ADMISSION`——恰好 1 条 deny fact（member/`spawn`/`IO_READ_DENIED`）、0 confined + 0 base spawn、无泄漏 token，六行 6/6 PASS（同一次 boot 的负控仍 PROVEN）。故本行复位为 `ENFORCE-PARTIAL` / `V@B=yes`：tested `25e106b4573cac0ab624c7e0bc5ca7d36dba3730`（产品树与冻结候选 `1484fa4ee` 逐项相同，判官 blob 未变）。 | ENFORCE-PARTIAL | yes |
| glob (M-07) | 原生 glob 经 rg | service-mediated:subprocess 加 os-confined:leaf | 读上界 | 目录与过滤、无结果、异常、禁读 | **host-free 半场已实测（BL-16，与 M-06 同一 confined `subprocess` face；同一真 pinned `@deepseek-ai/dsh-tool-fs-search` 0.2.0-rc.2 @ `639ed01539`）**：GLOB-IN（in-lane 列出 `needle.txt`/`quiet.txt`，`method=spawn/allow/ALLOW`）+ GLOB-OUT（out-of-lane `spawns=0->0`，恰一条 `deny/IO_READ_DENIED`，越界目录名 `secret.txt` 不出现）+ `a5sf-bl16-grep-realm.test.ts` G1/G2；对照 GREP-PRE 与历史 SEARCH-0/SEARCH-3 证明挂载前同一越界 glob 执行并列出越界内容、`facts=0`；证据=dev/agent-workflow/evidence/a5sf-bl16-grep/README.md + `dev/agent-workflow/evidence/a5sf-bl16-grep/arms.json` |与 M-06 同一实现与同一残余风险（见 M-06：内核 allowance 含 `/etc`+`/proc`，**在 BL-39 审计落地前不是全局读白名单**；预置 hardlink 以 ALLOW fact 服务；nested symlink 只在 raw layer 2（产品 seam 已拒 `--follow`）；程序身份 = effective write lane realpath（B3；不 hash 字节、不覆盖本 face 之外的 Member 写集合、不检查 env）；B1/B2 已关闭；`toolBindingIdentity=null` 且 spec 无字段；binding-realm 无 `subprocess` face → 组合期 typed 拒绝（`SUBPROCESS_UNCONFINED_REALM`，见 M-06(f)），不是潜在洞；in-lane 能力收窄；只证 host-free 半场）。**glob 特有**：无结果与“不允许”现在可由 fact 区分（拒绝必有 deny 事实），但 result 逐条目录/过滤语义（VCS/hidden/ignored 排除）仍只有既有的 glob-backend 套件覆盖，本 lane 未重跑那组对抗臂。**2026-11-05 产品装配半场（不改变本行等级）**：与 M-06 同一结论——产品声明面已存在，且不可表达的面在**组合期**以 `SUBPROCESS_UNCONFINED_REALM`/`NETWORK_UNCONFINED_REALM` 拒绝；但 confined `subprocess` face 不可由产品 config 表达、无 shipped preset 声明 `a5sfMemberPolicies`，故本行等级/V@B 不变，preset-only World 的 `glob` 仍无受限面。证据=`dev/agent-workflow/evidence/a5sf-product-assembly/README.md`。 **2026-11-05 家系发现（live row 1 判红后修复；本行等级/V@B 不变）**：in-lane `grep` 在 git worktree 内曾因 confined `rg` 向上做 VCS/祖先 ignore 发现、读 lane 外 `.git` FILE 被内核拒绝而 `exit 2`；修复在**调用**而非 lane：`laneSafeSearchArgv` 仅在「搜索根的祖先超出 effective read lane」时于 `--no-config` 后加 `--no-ignore-parent --no-ignore-vcs`，并把「VCS/祖先 ignore 发现已禁用、`.gitignore`/`.git/info/exclude` 语义不再应用、`.git` 未被读取」记在**同一条** allow fact 的 `annotations`（`a5sf-guard-consult/1` 可选增量字段；fact/进程数不变）；lane 含 worktree root 时 argv 原样、`.gitignore` 语义不变；`.git` 直读仍在准入（deny、0 进程）与内核两层拒绝。残余：仅在该根祖先越界时 `.gitignore` 语义被关闭（同目录下被忽略文件会进入结果），已由上述 fact 披露；未 boot、未重判 live row。证据=dev/agent-workflow/evidence/a5sf-rg-ancestors/README.md。 **2026-11-05 live 半场：六行全 PASS；重切时曾复位为当前断言，但 `#598`/`#599`/`#600` 后已退回 `ENFORCE-PARTIAL` / `V@B=no`**：`P2-04` 第 10 次 boot 于 head `c658d974d`（证据 `dev/agent-workflow/evidence/a5sf-search-live/`，`overall=PASS cases=6 PASS:6`，`10 intents + 10 boots + 0 aborts`）在真 Host 上判绿：in-lane 允许（`confined-exit code=0`、`stderr` 为空；同时按 `#593` 记录 `annotations`：该 lane 形态下 `.gitignore`/`.git/info/exclude` **关闭**）、越 ceiling 与越 restriction 两种均在任何进程存在前拒绝、取消后子进程以 143 终止、非法模式为 tool error、archive 边界后工具面 **422 + 0 fact + 0 spawn**。**旧 baseline 下不计 current claim 的原因不是能力而是新鲜度**：`as20261102r1`（`17ce7043…`）早于本轮产品面（`#593`/`#594` 均改了 `packages/**`）。**2026-11-05 重切曾证明树相等并复位本行（该复位只对当时那棵树成立）**：实测树 `c658d974d` 的 `packages/**` 树哈希 `9609403ccc5a2057f66fbc2d0b6187832d834814` 与新 baseline `1fd0d9fca…` 的 `packages/**` 树哈希逐字节相等；`scripts/**`、`tests/paths.mjs`、`package.json`、`pnpm-lock.yaml`、glue `agent-bindings.mjs` 亦逐项相等。故当时按 §1.1 记 `ENFORCE-PARTIAL` / `V@B=yes`（snapshot `as20261105r1`；tested `c658d974d3d0502af482727b0aea23482f5e3920`），证据不删；`#598`/`#599`/`#600` 再移动产品面后本行已退回 `V@B=no`（见本节末与 §1.1）。**本行明确不放宽**：`toolBindingIdentity` 仍为 `null`（install spec 无字段）；row 3 的 **preset-expression** 收窄臂仍 `UNSUPPORTED`；binding-realm `subprocess` face 仍被 BL-17 拒；row 6 的 typed code 只在产品内部，线上仅 422 + message **2026-11-05 归档边界并发窗口（不改等级）**：live 第十次 boot 判绿的 row-6 断言是**顺序**形态（归档完成后下发）。同日独立审查实测产品顺序为 `quiesce → commit`（`quiesce.ts:143` 释放驻留 → `archive.ts:141-151` durable ARCHIVED）；其 **quiesce → commit 窗口**内的下发曾被合法冷启动并让 handle 活过提交（200、1 次工具执行、驻留存活）。修复=提交后重放驻留释放 + resume 后 durable 复核（`liveAgents.set` 前无 await）+ 每成员 admission close（原先产品为 no-op，现实现并在每次退出时 reopen）；host-free 臂 `dev/agent-workflow/evidence/a5sf-archived-gate/archive-race-arms.test.mjs` RO1–RO4 与变异对照 `race-mutation-control.mjs` 覆盖该窗口（RED 3 failed / 1 passed → GREEN 4/4）。本行等级仍为 `ENFORCE-PARTIAL`，但 `V@B` 已退回 `no`（见本节末）；live 证据未删、未重判。仍不覆盖：child factory 的 `liveAgents` 写入（row-start、无工具下发路由）与跨进程陈旧视图；boot resume loop 与 boot publish 已由 `#599`/`#600` 关闭（`a5sf-boot-seam`/`a5sf-boot-publish` 的 BS1–BS5；前提 = lifecycle 接线 `AdmissionClosePort`，产品 `root.ts` 自 `#598` 起满足），且 mid-boot publish 确实可从工具下发到达（BS4），不能再写成“非工具下发路径”。另：deny fact 不再携带"rg 已运行"注解（原为事实夸大，已修并加被拒目录根回归臂）。 **本行 `V@B` 于同日退回 `no`（不是能力撤回，也不是重新判负）**：`RACE-FIX` 改了 `archive.ts`/`dispose.ts`/`quiesce.ts`/`agent-bindings.mjs`/`guard-observability.ts`，即 live 六行所测产品面本身；Q7 因此拒绝 current claim（`#598` 时点 34 条；至 `#600` 为 36 条）。live PASS 仍属于修复前的树（证据不删），要恢复 `V@B=yes` 只能在新树上重新实测——需新的 boot 预算，`P2-04` 已 10/10 用尽。**2026-11-05 candidate-1 live 重测（baseline 树上）**：冻结候选 `1484fa4ee`（= snapshot `as20261105r2` 的 baseline）同一次 boot（port 3184，`dev/agent-workflow/evidence/a5sf-candidate1/README.md`）的 glob 面：in-lane `glob` PROVEN、越 ceiling `glob` PROVEN（0 进程、1 条 deny、越界文件名不出现，`glob-face.json`）；glob 操作数不与任何其他行共用 locator，不受 row3 别名问题影响。故本行复位为 `ENFORCE-PARTIAL` / `V@B=yes`（tested `1484fa4ee0ff9326a3dafcac060bf63f8d334a1f`）；未覆盖项不变（`toolBindingIdentity=null`、preset 表达收窄 `UNSUPPORTED`、row6 typed code 仅内部）；同日 allocation #4 的同树 retry 11/11 复核，glob 两面仍 PROVEN。 | ENFORCE-PARTIAL | yes |
| bash persistent (M-08) | 原生持久 bash 经 ctx.terminals | os-confined:leaf 加 team-shell | 读写两轴，network 拒绝 | 同 PTY 多命令、cwd、前后台、信号与超时、只写不读、旧代 PTY 拒用 | 证据=dev/agent-workflow/evidence/a5sf-p1-08/TERMINAL-LIFECYCLE-EVIDENCE.md；生命周期已测，工具级待 BL-17；BL-17 后端半场（host-free）=dev/agent-workflow/evidence/a5sf-bash/README.md（shell-class 准入、只写不读、chmod/新建负控、禁网拒绝、旧代 PTY 拒用；live 未证，`V@B=no` 不变） | 真实 PTY 仍是测试 double；同 UID chmod 越界 | NOT_WIRED | no |
| bash transient (M-09) | 原生瞬态 bash 经 ctx.shell | os-confined:leaf | 读写两轴 | 与持久终端分别验收；danger-full-access 不越 Member ceiling | 证据=dev/agent-workflow/evidence/a5sf-p1-07/OS-RUNNER-EVIDENCE.md；OS 机制已测 | 工具尚未绑定 | NOT_WIRED | no |
| pwsh (M-10) | pwsh 持久与瞬态 | os-confined:leaf（可用平台） | 读写两轴 | 平台不支持即 ENV_BLOCK；不虚称 Linux PASS 等于 Windows | 证据=dev/agent-workflow/evidence/a5sf-g1/G1-GATE-REPORT.md；机制级 | 本机无 Windows 后端 | NOT_WIRED | no |
| run_code / PTC (M-11) | 原生 run_code 与 PTC | os-confined:leaf 加受控 Host bridge | 文件读写与 network 拒绝，IPC 受控 | 运行与嵌套调用正控；无 Host 代发旁路 | 证据=dev/agent-workflow/evidence/a5sf-g1/G1-GATE-REPORT.md；机制级 | BL-21 库存：`run_code` 不是可装载工具模块，而是 `@deepseek-ai/dsh-tools` 的 **PTC 模式保留名**（不可 register/shadow），PTC 是执行模式；无 routed-native 接入面 → 见 `NATIVE-SOURCE-INVENTORY.md` §3 | NOT_WIRED | no |
| lsp (M-12) | lsp 与 language server | os-confined:leaf 加 scoped service | 进程加代码库只读 | 生命周期、cwd、通信与退出；无法覆盖则 UNSUPPORTED | 证据=dev/agent-workflow/evidence/a5sf-g1/G1-GATE-REPORT.md；机制级 | 实际启动位置未 trace；BL-21 库存：模块存在（`@deepseek-ai/dsh-tool-lsp`）但不在产品 preset | NOT_WIRED | no |
| terminal_* (M-13) | terminal_open/send/read/signal/close/list | os-confined 已装 Terminal Backend | 读写两轴 | opening 与发送与读与 signal 与 close/list；失效不回裸 backend | 证据=dev/agent-workflow/evidence/a5sf-p1-08/TERMINAL-LIFECYCLE-EVIDENCE.md；领域层已测 | 端口为 double；BL-21 库存更正工具名：模块注册 `terminal_open/send/read/signal/close/list`（**无 `terminal_kill`**，见 `NATIVE-SOURCE-INVENTORY.md` §2） | NOT_WIRED | no |
| web_fetch (M-14) | 原生 web_fetch 经 ctx.web.fetch | service-mediated:web | network allow/deny（布尔，HTTP 前） | provider 选择、HTML 展示、network=deny 前置拒绝 | 证据=dev/agent-workflow/evidence/a5sf-g1/G1-GATE-REPORT.md；network=restricted UNSUPPORTED 已披露 | 上游 provider 内部网络不受本机 OS 限制 | NOT_WIRED | no |
| web_search (M-15) | 原生 web_search | service-mediated:web | network allow/deny（布尔） | source 与截断与 provider error 兼容、禁网 | 证据=dev/agent-workflow/evidence/a5sf-g1/G1-GATE-REPORT.md；机制级 | 不得复用旧 web-family PASS | NOT_WIRED | no |
| third-party CLI (M-16) | 未登记的本机 CLI | os-confined:leaf（通用 argv 与 stdio 与 cwd） | 读写两轴加 network 拒绝 | 换一个未命名命令仍可执行；零专用 ToolDefinition 执行体 | 证据=dev/agent-workflow/evidence/a5sf-p1-07/OS-RUNNER-EVIDENCE.md；通用 launcher 机制已测，端到端待 BL-20 | 需 BL-20 端到端 | PROBE-GATED | no |
| stdio MCP (M-17) | stdio MCP server（本机进程） | os-confined:leaf | 子进程读写 | RPC 取消、生命周期、本地 I/O 受限 | 证据=dev/agent-workflow/evidence/a5sf-g1/G1-GATE-REPORT.md；机制级 | 启动服务未 trace | NOT_WIRED | no |
| remote MCP / HTTP / SSH (M-18) | 远端执行的 provider | trusted-delegation | 本机联网入口可禁，远端效果不承诺 | 明确 TRUSTED_DELEGATION 或 UNSUPPORTED | 证据=dev/agent-workflow/evidence/a5sf-g1/G1-GATE-REPORT.md；披露项 | 远端文件与网络效果不可由本机限制 | UNSUPPORTED | no |
| state tools (M-19) | goal/todo/jobs/session 等 | Alpha.4 调用准入 | 无直接数据面 I/O 时不另设上限 | 不复刻状态机；保留原业务行为 | 证据=dev/agent-workflow/evidence/a5sf-g1/G1-GATE-REPORT.md；机制级 | 若实际读写文件需重新分类 | NOT_WIRED | no |
| present / skill / attachment (M-20) | present 与 skill 与附件读取 | service-mediated 或可信宿主代理 | 若读文件则受读上界 | 上传与读取与渲染来源能力分开；已知不受管 I/O 标 CONDITIONAL | 证据=dev/agent-workflow/evidence/a5sf-g1/G1-GATE-REPORT.md；机制级 | 可能读取用户文件，不能按无 I/O 猜测 | NOT_WIRED | no |
| unknown in-process JS (M-21) | 未知同进程第三方 JS | 无通用 Tool Host 时 UNSUPPORTED | 无 | 明确 TRUSTED_ONLY，不提供伪保证 | 证据=dev/agent-workflow/evidence/a5sf-g1/G1-GATE-REPORT.md；披露项 | node:fs 直连；hash 登记不是 sandbox | UNSUPPORTED | no |

<!-- q5:main-end -->

## 1.1 live 半场的现状（2026-11-05 更新）

**历史（#575 的唯一一次预留 boot）**：`dev/agent-workflow/evidence/a5sf-acceptance/README.md`
§1/§3/§7 记录 a5sf-wired Member 在 #561 的 deferred-registration 拒绝处**根本没激活**，六行全部
`NOT_REACHED`（run record：`overall=FAIL cases=7`）；#576 修好了该机制
（`dev/agent-workflow/evidence/a5sf-deferred/README.md` §2/§4.1）。此后 P2-01 的 boot 配额在该次
尝试上耗尽（`a5sf-acceptance/README.md` §7：“P2-01's allocation is now exhausted”），池中剩余
6 次属于 `reserve`(2) 与 `G1.5/G1.6/G1.8 closure`(4)
（`dev/agent-workflow/budgets/a5sf-boot-pool-20261103.json`），按池规则不是 live 验收预算。

**现状（2026-11-04）**：那条 live 阻塞已解除——三个专用 P2-01 start 走完，**第三跳 8/8 PASS**，
实测 sink 与逐案判定在 `dev/agent-workflow/evidence/a5sf-preflight/README.md` §13（head
`44babbfcf`），本表附录 A 复刻了同一份八条事实。§1.1 先前那句“live 半场为零行”**已过期**，
不再成立；但 live 覆盖的只有 `read`/`write` 两轴，`edit` 从未真跑 live（见 M-03 行）。

**2026-11-05 重切（`as20261105r1`，baseline `1fd0d9fca…`）当时，四行的机器新鲜度分成两组**：
`M-06`/`M-07` 的实测树 `c658d974d` 与 baseline 的 `packages/**`（及 `scripts/**`、
`tests/paths.mjs`、`package.json`、`pnpm-lock.yaml`、glue `agent-bindings.mjs`）**逐项相等**，
故重切时曾按本计划复位为 `ENFORCE-PARTIAL` / `V@B=yes`（tested `c658d974d3d0502af482727b0aea23482f5e3920`）；
`M-01`/`M-02` 的实测树 `44babbfcf` 与 baseline 的 `packages/**` **不相等**（116 个路径，含读/写轴的
`team-services/src/fs.ts`、`mount.ts`、`member-io-policy/src/{compile,path-rules}.ts` 与 glue
`src/plugin/live/agent-bindings.mjs`；glue sha256 `df9b46af…` ≠ `6d256096…`），因此重切时**不**复位：
它们保持 `NEEDS_REVALIDATION` / `V@B=no`，要复位必须在新 baseline 上重跑 live。
`M-01`/`M-02` 的过期因此有两层**路径事实**：上面 116 个路径是 live 树与 baseline 的差；
baseline..HEAD 另有 36 个 Q7 路径（`#598`/`#599`/`#600` 的 `lifecycle/archive.ts`、`dispose.ts`、
`quiesce.ts`、`agent-bindings.mjs` 等），是当前树与 baseline 的差；即使前一层归零，后一层仍要求重跑。
**但重切不是终态**：同日的 `#598`（RACE-FIX）、`#599`（BOOT-SEAM）、`#600`（BOOT-PUBLISH）
再次移动产品面（baseline..HEAD 现为 36 个 Q7 路径，含 `lifecycle/archive.ts`、`dispose.ts`、
`quiesce.ts`、`agent-bindings.mjs`），Q7 因此也拒绝 `M-06`/`M-07` 的 current claim：
**四行现在全部是 `V@B=no`**（`M-06`/`M-07` 为 `ENFORCE-PARTIAL` / `V@B=no`），重切时对
`M-06`/`M-07` 的复位只属于当时那棵树，不能当作当前断言。**证据一条未删**：被拒绝复位的行是
“树不等价，所以不把旧树的实测冒充新树的实测”，不是把 live 降级成 host-free。

**2026-11-05 candidate-1（boot allocation #1 of 5）把"树不等价"这一层从两行上去掉了**：冻结候选 `1484fa4ee`、发布 snapshot `as20261105r2`（baseline = 该候选 head）、移动指针，然后**在该 baseline commit 上**单次 boot（port 3184，`dev/agent-workflow/evidence/a5sf-candidate1/`，run `a5sf-candidate1-2026-11-05T12-17-52-246Z`，`overall=FAIL`、11 案 9 PASS / 2 FAIL、1 intent + 1 boot、0 abort、0 retry）。结果是**两行复位、两行仍 no**，而且原因都在证据本身：`M-02`（row4a/row4b）与 `M-07`（glob 两面）在 baseline 树上判绿 → `ENFORCE-PARTIAL` / `V@B=yes`；`M-01` 的 row2 与 `M-06` 的 row3 判 **REFUTED**——两者共用同一个 locator（`outside-restriction.txt`：既是 FS 的 read B，又是 search row3 的 grep 操作数），两个 judge 都按 locator 收 fact，于是各自多看见一条**另一条 lane 的拒绝事实**（FS 看见 member realm 的 `spawn deny`，search 看见 binding realm 的 `stat deny`）。这是**装配/fixture 缺陷，不是产品放宽**：两行的 typed 拒绝、0 进程、无字节泄漏条款全绿。按"不把失败重试成通过"的纪律，本次不重跑；拆开后重跑属 `#4`/`#5` retry 预算。

**2026-11-05 allocation #4（retry，coordinator 授权）把它重跑干净了**：唯一改动是 fixture——FS read B 移到 `workspace/lane/fs/outside-restriction.txt`（自己的 locator 与 expected fact 集），search row3 的操作数不动，两个判官文件字节与 baseline 相同。单次 boot（port 3184，同目录 README §3，run `a5sf-candidate1-2026-11-05T12-33-06-567Z`）**11/11 PASS**（FS row2 = `BINDING_DENY_ON_READ_PATH`，readPathFacts 1/stat/deny/全 binding lane；search row3 = `RESTRICTION_NARROWER_THAN_CEILING_REFUSED_AT_ADMISSION`，恰好 1 条 deny、0/0 进程、无泄漏），于是 `M-01`/`M-02`/`M-06`/`M-07` 四行现均为 `ENFORCE-PARTIAL` / `V@B=yes`。**诚实边界**：retry 的 `teamSha` 是执行树 `25e106b4…`（= 冻结候选 + 仅证据改动），`bindings.baseline` 与快照 baseline 仍是 `1484fa4ee`，产品路径的 tree/blob 逐项相等（run record `bindings.productTreeProof`）——之所以不在 `1484fa4ee` 上跑，正是因为它含有被授权的那个别名 fixture。refuted verdict 记为装配缺陷，不作为产品结论保留。

**诚实上限仍然成立**：任一行的 ⑤ 覆盖都未满（大文件窗口、流式、原子替换、版本冲突未验收），
`DONE`/`LIVE-CONFIRMED` 仍不得出现在任何一行。

## 2. 静态工具名附录（与主矩阵的映射）

<!-- q5:appendix-begin -->

- **read** [native] → (M-01)
- **write** [native] → (M-02)
- **edit** [native] → (M-03)
- **read_image** [native] → (M-04)
- **grep** [native] → (M-06 native)
- **glob** [native] → (M-07)
- **bash** [native, persistent] → (M-08)
- **bash** [native, transient] → (M-09)
- **pwsh** [native] → (M-10)
- **run_code** [native] → (M-11)
- **lsp** [native, conditional] → (M-12)
- **terminal_open** [native] → (M-13)
- **terminal_send** [native] → (M-13)
- **terminal_read** [native] → (M-13)
- **terminal_signal** [native] → (M-13)
- **terminal_close** [native] → (M-13)
- **terminal_list** [native] → (M-13)
- **web_fetch** [native] → (M-14)
- **web_search** [native] → (M-15)
- **goal** [native state] → (M-19)
- **todo** [native state] → (M-19)
- **jobs** [native state] → (M-19)
- **session** [native state] → (M-19)
- **ask** [native state] → (M-19)
- **present** [native, host service] → (M-20)
- **skill** [native, host service] → (M-20)
- **str_replace_editor** [native, conditional] → (M-05)
- **动态 MCP 与插件新来源** [dynamic] → 主表无行：默认 NOT_TESTED，进入 BL-21 库存后才分配行 ID

**范围声明**：本附录是**静态种子**，不是运行中 Host 的完整工具清单。真实来源清单（含动态
MCP 与插件注册、source package 与 SHA、Definition provenance）由 BL-21 从 pinned Host 导出，
动态新来源默认 `NOT_TESTED`，禁止按名称猜测 I/O 效果。BL-21..BL-26 的 source-evidenced
半场（pinned baseline 的模块→工具、注册同步/延迟、依赖与采用/退役判断）现由同目录
`NATIVE-SOURCE-INVENTORY.md` 承载；它**不是** booted Host 的导出，dynamic MCP 仍是 `NOT_TESTED`。

<!-- q5:appendix-end -->

## 3. 证据索引与门禁

| Gate | 本矩阵中的对应 |
|---|---|
| G1 | P1 机制级证据（`evidence/a5sf-p1-01/`、`evidence/a5sf-p1-02/`、`evidence/a5sf-p1-03/`、`evidence/a5sf-p1-04/`、`evidence/a5sf-p1-05/`、`evidence/a5sf-p1-06/`、`evidence/a5sf-p1-07/`、`evidence/a5sf-p1-08/`、`a5sf-g1/G1-GATE-REPORT.md`）；工具级：`read` = `ENFORCE-PARTIAL` / `V@B=yes`（2026-11-05 冻结候选树上 rows1/2/3 PASS；row2 先在 allocation #1 被 fixture locator 别名判 REFUTED，allocation #4 拆开 fixture 后同树 11/11 PASS，见 §1.1）、`write` = `ENFORCE-PARTIAL` / `V@B=yes`（row4a/row4b 在同一冻结树上 PASS）、`edit` = `ENFORCE-PARTIAL`（host-free，live 未跑）、`grep` = `ENFORCE-PARTIAL` / `V@B=yes`（BL-16 host-free 半场 + 2026-11-05 六行 6/6 PASS + 无 realm 负控 PROVEN）、`glob` = `ENFORCE-PARTIAL` / `V@B=yes`（同一 boot 的两臂 PROVEN）、`read_image` = `BOUNDED-DEFER`，其余仍 `NOT_WIRED` |
| G2 | BL-14 至 BL-20 代表机制正向与基本拒绝；**host-free 机制半场**已有 FS 证据（`a5sf-s1/`、`a5sf-assembly/`、`a5sf-p0/`、`a5sf-deferred/`），**live 半场**已执行：六行 2026-11-04 8/8 PASS（`a5sf-preflight/README.md` §13），覆盖 `read`/`write`；`edit` 的 live 半场仍未跑 |
| G3 | BL-22 至 BL-26 逐工具正向等价与最小权限负控（来源清单见 `NATIVE-SOURCE-INVENTORY.md`） |
| G4 | BL-27 至 BL-34 全工具与 I/O 维度矩阵 |
| G5 | BL-35 至 BL-37 对抗、故障、发布双验收 |

**本表当前结论**：G1 机制级 = 有证据；FS 工具级 = `read`/`write` 的 live 半场已实测（2026-11-04，
8/8 PASS，head `44babbfcf`），`edit` 仍只有 host-free 半场，`grep`/`glob` 的 host-free 半场与
2026-11-05 live 半场均已实测（BL-16：越界搜索在任何进程存在前被 typed 拒绝且有 guard fact；
第十次 boot 六行全 PASS），`read_image` 为条件性 `BOUNDED-DEFER`，其余工具级仍 `NOT_WIRED`；
G2 至 G5 = 未完成。2026-11-05 的 candidate-1 在**新 baseline 树**上实测（allocation #1）后 `M-02`/`M-07` 复位，
allocation #4 拆开别名 fixture 后同树 11/11，`M-01`/`M-06` 亦复位：四行现均 `V@B=yes`
（`ENFORCE-PARTIAL`）。REFUTED 曾出现的成因是两条 lane 共用同一 fixture locator（装配缺陷，非产品放宽），
**这不是 release coverage**：
不得把任一 `NOT_WIRED`、`ENFORCE-PARTIAL` 或 `NEEDS_REVALIDATION` 读作能力已交付。

## 附录 A — live 验收的事实来源（2026-11-04）

第一份**在真实 Host 上全绿**的工具级验收：`dev/agent-workflow/evidence/a5sf-preflight/README.md`
§13（8/8 PASS，head `44babbfcf`，三个专用 P2-01 start 全部花在该轮，池储备未动）。

2026-11-05 的 **candidate-1 冻结轮**与其后的 **allocation #4 retry**：`dev/agent-workflow/evidence/a5sf-candidate1/README.md`
（#1 = 9/11、`overall=FAIL`，两行 REFUTED 且诊断为同一 fixture locator 的别名；#4 = **11/11、`overall=PASS`**，
只拆 fixture、两个判官 blob 字节未变、产品树 tree/blob 逐项等于冻结候选 `1484fa4ee`）。两轮各一次 start，
port 3184，共享 BL-14 ledger 共 4 行（2 intent + 2 boot，`boot2` 区分 #4），累计花费 `2/5`、0 abort。

可复用的判定事实（不是结论，是原始 sink）：

```
binding  stat allow a.txt     binding  readText allow a.txt
binding  stat deny  b.txt     binding  stat deny   c.txt
binding  stat allow w4a.txt   binding  readText allow w4a.txt
member   writeText allow w4a.txt   member writeText allow b.txt
```

即：**读路径的所有咨询都落在 binding realm，写 fact 全部落在 ceiling realm**，且没有任何 write
fact 越到读 lane。`V@B=yes` 的含义就是这个——"binding realm 上的约束被实测验证"——**不**指上面
⑤ 列的全部最低验收项都已覆盖（大文件窗口、流式、原子替换、版本冲突仍未验收）。

**这两行的 live 证据为什么在重切后仍记 `NEEDS_REVALIDATION` / ⑨ = `no`**：**live 验证确实存在于
`44babbfcf`**（上面这份 sink 就是那一次），证据未删、判定未改；但 2026-11-05 的重切
（`as20261105r1`，baseline `1fd0d9fca…`）证明实测树的 `packages/**` 与 baseline 的 `packages/**`
**不相等**（116 个路径；glue `agent-bindings.mjs` sha256 `df9b46af…` ≠ `6d256096…`），所以这两行
**没有**复位：把旧树上的实测写成新 baseline 的当前验证就是洗白。复位条件 = 在新 baseline 上重跑
live；本表宁可让机器读成"等重新断言"，也不把它写成"当前已验证"。这不是把 live 降级成 host-free。

**写轴的裁决（2026-11-04）**：`write` **不**蕴含 `read`——binding restriction 只约束读轴，写只受
ceiling 约束；`write` 目标若在 binding lane 读不到，仍会被**原生 `write` 工具自身的
read-before-write 契约**拒掉，该拒绝属于原生工具、**不属于** Team lane。裁决原文与边界见
`dev/agent-workflow/evidence/a5sf-preflight/README.md` §12.8.3（RULING），后续
"只写不读/读被拒权限下的 team 行为" = `ALPHA5-SANDBOX-BACKLOG.md` 的 `BL-38`（owner-owned）。

失效面同样已 live 验证：被 invalidated 的 managed shadow 按名拒绝
（`A5SF_NATIVE_SHADOW_INVALIDATED`），无字节、无 fact、无 provider 调用，in-lane 亦拒；停止后
的派发可被咨询但绝不被服务（`probeFactsAreRefusals`）。
