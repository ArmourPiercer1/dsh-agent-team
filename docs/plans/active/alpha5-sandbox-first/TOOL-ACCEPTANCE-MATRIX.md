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
| read (M-01) | 原生 read（ctx.fs） | service-mediated:fs（route C 重挂原生模块到 Member 隔离 fs scope） | MemberCeiling(read) ∩ ToolRestriction(read) | 大文件中间窗口、流式、禁读真实拒绝、双 Member 不串权 | **live 已实测**（8/8 acceptance 的 row1/row2/row3——lane 内读取由 confined provider 实际服务、restriction 拒绝、ceiling 拒绝；退出码与逐案判定见附录 A 与 README §13）；证据=dev/agent-workflow/evidence/a5sf-preflight/README.md；tested=44babbfcff2026b04395f2219a1c4a77565ff7af；**2026-11-07 layer B（host-free，0 boot，⑧/⑨ 不变）**=FSB-READ-1/2（`tests/world-factory/a5sf-fs-contract.test.mjs`，真 pinned `tool-fs` + 真 `LocalFileSystem` 经产品 route-C seam）：10,500,033 B 文件 `streamText` 恰 1 次/`readText` 0 次、窗口 256 行/总 52,501 行、footer 精确、尾字节不进模型，续读仍是流；小文件对照 `readText`；变异 M2（confined `stat` 少报 size）只让该臂红。证据=`dev/agent-workflow/evidence/a5sf-fs-face/README.md` §3–§4 | 大文件中间窗口/流式仍未覆盖；工具尚未绑定到生产 preset（本行证明的是装配+准入+执行体）；可信 JS 可绕 ctx.fs（TRUSTED_ONLY）；**live 断言按 Q7 仍记 `NEEDS_REVALIDATION`（2026-11-05 重切未能复位）**：重切前 baseline 早于 63 个产品面路径；重切 `as20261105r1` 把 baseline 移到 `1fd0d9fca…`，但实测树 `44babbfcf` 的 `packages/**` 与它**不相等**（116 个路径，含 `team-services/src/fs.ts`、`mount.ts`、`member-io-policy/src/{compile,path-rules}.ts` 与 glue `src/plugin/live/agent-bindings.mjs`；glue sha256 `df9b46af…` ≠ `6d256096…`），该 live 证据描述的树不是新 baseline 的树；复位需在新 baseline 上重跑 live，证据不删（§1.1 / 附录 A）**2026-11-05 candidate-1 live 重测（在 baseline 树上，不是旧树的等价证明）**：冻结候选 `1484fa4ee`（= snapshot `as20261105r2` 的 baseline）单次 boot（port 3184，`dev/agent-workflow/evidence/a5sf-candidate1/README.md`，run `a5sf-candidate1-2026-11-05T12-17-52-246Z`，11 案 9 PASS / 2 FAIL，1 intent + 1 boot，0 abort）：row1（A）PASS（2 条 binding allow fact、1 次 confined provider read）、row3（C）PASS（ceiling deny / restriction allow / effective deny，无放宽）、**row2（B）REFUTED**，失败条款 `everyReadPathFactOnBindingLane`——B 与 search row3 的 grep 操作数共用同一 locator，同一路径上多出一条 member realm 的 `spawn deny`（grep 准入），judge 见 2 条 read-path fact 不全在 binding lane；`bindingDenyOnReadPath`/`everyReadPathConsultationDenied`/`noProviderRead`/`noClaimLeak`/`typedLaneRefusal` 均为真。REFUTED 不能当 PASS，故当时维持 `V@B=no`。**同日 allocation #4 retry（coordinator 授权，同一 baseline 树）**：只把 fixture 拆开——FS read B 改到 `workspace/lane/fs/outside-restriction.txt`（自己的 locator、自己的 expected fact 集），search row3 的操作数 `workspace/lane/outside-restriction.txt` 原样不动；判官文件字节未动。单次 boot（port 3184，`dev/agent-workflow/evidence/a5sf-candidate1/README.md` §3，run `a5sf-candidate1-2026-11-05T12-33-06-567Z`） **11/11 PASS**，本行判 `BINDING_DENY_ON_READ_PATH`：`readPathFacts 1`、method `stat`、decision `deny`、全部在 binding lane、`noProviderRead`、`counterRows 0`。故本行复位为 `ENFORCE-PARTIAL` / `V@B=yes`：tested `25e106b4573cac0ab624c7e0bc5ca7d36dba3730`（= 冻结候选 `1484fa4ee` + 仅证据/fixture 改动，`packages` tree `44535c94…`、`scripts` tree `d4bcc358…`、两个判官 blob 逐项与 baseline 相同，见 run record `bindings.productTreeProof`），snapshot `as20261105r2` 的 baseline = `1484fa4ee`。 **2026-11-05 合并 `origin/master`（`a5bd88b85`，`#606`）后本行 claim 失效（Q7 触发）**：`1484fa4ee..HEAD` 产品漂移 **28 路径**，且包含本行所骑的面——`packages/runtime/team-services/src/subprocess.ts`、`mount.ts`、`install.ts`、`types.ts`、`index.ts`，以及 `packages/runtime/test/a5sf-bl16-grep-realm.test.ts`；被测树已不是将合并的树。按 Q7 复位为 `NEEDS_REVALIDATION` / `V@B=no`：上面 11/11 的结论**只属于 `1484fa4ee`**，不撤回；重新成立需在新树再 boot 一次（fixture 拆分已在位）。**2026-11-07 layer-B 增量2（host-free，0 boot，⑧/⑨ 不变）**=FSB-READ-ABORT：真 `streamText` 中途取消（恰 1 chunk 后 abort）⇒ 恰 1 条 typed `FS_ABORTED`（`read aborted`）、无窗口/无成功文本/无截断 footer、provider 调用 stat=1/streamText=1/readText=0、`/proc/self/fd` 无泄漏句柄；分层=工具契约（layer B），live 未重跑。证据=`dev/agent-workflow/evidence/a5sf-fs-face/README.md` §3.2；**2026-11-10 DEV-LIVE（只注记，不改 ⑧/⑨）：FS/Search 面有稳定 DEV-LIVE 结果，run pair=run-3/run-4，14 行 13 PASS / 0 FAIL / 1 NOT_REACHED，证据=`dev/agent-workflow/evidence/a5sf-fs-devlive/README.md` §2，见 §1.3；等级/V@B 不变**；**2026-11-12 MEMBER-CONSOLIDATE（只注记，不改 ⑧/⑨）：opt-in 受治 Member（`memberPresetId: a5sf-governed-member`）的 `bash` 读轴在真实 Host 上被走到——in-lane 读返回 lane 字节、out-of-lane 读得 `IO_READ_DENIED` 且 0 secret 字节，两次一致；这是 bash 中介的读，不是原生 `read` 工具；`DEV-LIVE`、no `V@B`；见 §1.5** | NEEDS_REVALIDATION | no |
| write (M-02) | 原生 write（ctx.fs） | service-mediated:fs | MemberCeiling(write) ∩ ToolRestriction(write)（binding restriction 只约束 read 轴） | 原子替换与版本校验、禁写字节不变、写不自动获读 | **live 已实测（两半）**：row4a 在 lane 内可读路径上写成功，全部 write fact 落在 **ceiling realm**；row4b 证明 guard **允许**「写一个 binding lane 读不到的文件」，拒绝写出的是**原生 write 工具自身的 read-before-write 契约**（原生工具要求先 read，不是 Team lane 在拒绝）；证据=dev/agent-workflow/evidence/a5sf-preflight/README.md；tested=44babbfcff2026b04395f2219a1c4a77565ff7af | **2026-11-04 裁决（README §12.8.3 RULING）**：原生 write 的 read-before-write 契约保留，代数**不加** write⇒read 耦合；只写不读/读被拒权限下的 team 行为 = `BL-38`（owner-owned，非本 lane 实施）；原子替换/版本校验未单独验收；**live 断言按 Q7 仍记 `NEEDS_REVALIDATION`（2026-11-05 重切未能复位）**：同 M-01——实测树 `44babbfcf` 与 baseline `1fd0d9fca…` 的 `packages/**` 不相等（116 个路径；写/读轴的 `team-services/src/fs.ts`、`mount.ts`、`install.ts` 与 `member-io-policy/src/*.ts` 都在其中），证据不删；复位需在新 baseline 上重跑 live**2026-11-05 candidate-1 live 重测（baseline 树上）**：冻结候选 `1484fa4ee`（= snapshot `as20261105r2` 的 baseline）的同一次 boot（port 3184，`dev/agent-workflow/evidence/a5sf-candidate1/README.md`）在**当前 baseline 树**上判绿 row4a（写 lane 内可读文件：盘上内容与写入一致、write fact 在 ceiling realm、confined provider 写 1 次）与 row4b（ceiling 允许而 binding 读不到的目标：guard 允许写，原生 write 以 read-before-write 拒绝，盘上字节不变、无植入字节回传）。故本行复位为 `ENFORCE-PARTIAL` / `V@B=yes`（snapshot `as20261105r2`；tested `1484fa4ee0ff9326a3dafcac060bf63f8d334a1f`）；未覆盖项不变：原子替换/版本校验、只写不读的 team 语义 = `BL-38`。同日 allocation #4 的同树 retry（tested `25e106b4…`，产品树逐项相同）11/11 复核，两行仍绿。 **2026-11-05 合并 `#606`（`a5bd88b85`）后本行 claim 失效（Q7）**：28 条产品路径移动，含 `team-services/src/install.ts`/`mount.ts`/`types.ts`/`index.ts` 与 `subprocess.ts`——write 所骑的 service 面在动。复位 `NEEDS_REVALIDATION` / `V@B=no`；row4a/row4b 的 11/11 结论保留于 `1484fa4ee`，需新树 boot 才能重新 current。**2026-11-07 layer-B 增量2（host-free，0 boot，⑧/⑨ 不变）**=FSB-CREATE-1/2/3（`createIfAbsent` 面无 live 臂）：新建文件（写 lane 允许、读 lane 不覆盖）**成功**=恰 1 次 `writeText`、0 stat/0 readText、`Created file`、盘上有字节、恰 1 条 `writeText/allow` fact（版本守卫对不存在的文件不参与）；同一 lane 对**已存在**目标被 product guard 以 `IO_WRITE_REQUIRES_READ` 在 provider 前拒绝（0 调用、0 字节）；已存在且未被读的目标由 provider 以 `FS_NOT_OBSERVED` 拒绝（恰 1 次 `writeText`、1 条 typed provider error、0 字节），补一次 read 后同一 write 成功。`FSB-BIND-WRITE` 另证 binding 车道：in-binding 写由 binding provider 服务（ceiling provider 0 次、恰 1 条 binding fact），ceiling-only 目标 1 条 `IO_WRITE_DENIED`、0 调用、0 字节。BL-38 的产品语义仍未裁决，不改 grade。证据=同 README §3.2；**2026-11-10 DEV-LIVE（只注记，不改 ⑧/⑨）：FS/Search 面稳定 DEV-LIVE 结果覆盖本行（run-3/run-4，14 行 13 PASS / 0 FAIL / 1 NOT_REACHED），证据=`dev/agent-workflow/evidence/a5sf-fs-devlive/README.md` §2，见 §1.3；等级/V@B 不变**；**2026-11-12 MEMBER-CONSOLIDATE（只注记，不改 ⑧/⑨）：同一 opt-in 受治 Member 的 in-lane/denied 对只走了读轴，write 未被走到；`DEV-LIVE`、no `V@B`；见 §1.5** | NEEDS_REVALIDATION | no |
| edit (M-03) | 原生 edit | service-mediated:fs | 读旧内容与写新内容两轴 | 版本冲突、禁写、读旧内容也需读权限 | **host-free 半场已实测；live 半场从未运行**：EDIT-1（routed/confined 定义在 lane 内执行，恰一条 `editText/allow` 事实，与 preset 对照可区分）+ EDIT-2（out-of-lane `IO_WRITE_DENIED`，字节不变）+ EDIT-3a/3b/3c（读写两轴分离：`IO_WRITE_REQUIRES_READ` / `IO_WRITE_DENIED`；读要求以目标存在为条件）+ EDIT-4（只在 ceiling partition 恰一次，surface 中性）；证据=dev/agent-workflow/evidence/a5sf-fs-tools/README.md；tested=93b007cd2f496877e70abec4ee5aec25f9be4753；**2026-11-07 layer B（host-free，0 boot，⑧/⑨ 不变）**=FSB-EDIT-1/2（真 pinned `fs-observation-policy` + 真 `fs-local` 版本守卫）：read→外部改动→edit 恰 1 次 `editText` 调用、1 条 typed `FS_STALE_VERSION`（消息含 re-read remedy）、0 字节改动、恰 1 条 `editText/allow` fact（sequence 连续）；fresh edit 对照成功。**版本冲突因此从“未测”变为 host-free 已测；live 半场仍从未运行**；原子替换仍无独立臂。证据=`dev/agent-workflow/evidence/a5sf-fs-face/README.md` §3–§4 | 版本冲突与原子替换未测（provider double 不触发 live 的 expected-version 校验/atomic rename）；**binding 车道自 2026-11-07 有 host-free 臂（FSB-BIND-EDIT），live 仍只有 ceiling 车道**；**六行 live 验收不含 `edit`**——该证据行自述 `V@B=no`，本行不得写成 live（2026-11-04 更正了此前的一句 live 误述）**2026-11-07 layer-B 增量2（host-free，0 boot）**=FSB-EDIT-MULTI-1/2（多匹配无 `replace_all` ⇒ 恰 1 次 `editText` + 1 条 typed `FS_AMBIGUOUS_EDIT`（matched 3 times）+ 0 字节改动，同一次 read 后加 `replace_all` 成功；`replace_all` 多匹配 ⇒ 恰 1 次 `editText`（一次原子写）+ 全部替换）+ FSB-BIND-EDIT（binding 车道：in-binding edit 由 binding provider 服务、ceiling provider 0 次、恰 1 条 binding fact；ceiling-only 目标 1 条 `IO_WRITE_DENIED`、0 调用、0 字节）；**2026-11-10 DEV-LIVE（只注记，不改 ⑧/⑨）：`edit` 的 live 半场已在 FS/Search DEV-LIVE 的 14 行表里被走到（run-3/run-4，其中 edit 2 行 PASS；整表 13 PASS / 0 FAIL / 1 NOT_REACHED，唯一 NOT_REACHED 是 `read_image`），证据=`dev/agent-workflow/evidence/a5sf-fs-devlive/README.md` §2，见 §1.3；本行仍 ENFORCE-PARTIAL / V@B=no——"live 半场从未运行"是历史真话，不是今天的句子** | ENFORCE-PARTIAL | no |
| read_image (M-04) | 原生 read_image（routed deferred registration） | service-mediated:fs + attachments（原生 `ctx.inject(['attachments'])`，见 #576） | 读上界，附件服务单独识别 | 像素与大小上界、工具展示等价；附件来源不可绑定则 UNSUPPORTED | 证据=dev/agent-workflow/evidence/a5sf-deferred/green-probe.log,dev/agent-workflow/evidence/a5sf-deferred/all-a5sf-node-suites.log,dev/agent-workflow/evidence/a5sf-assembly/README.md,dev/agent-workflow/evidence/a5sf-p0/README.md,dev/agent-workflow/evidence/a5sf-acceptance/README.md；**机制半场（host-free，条件性证明）**=A1（`mounted=true`，`definitionIdentities.read_image="routed"`）+ TA11（deferred 定义经同一 partition，`read` 仍按编译交集拒绝）+ assembly §3.2（post-settle 注册折叠入账并 invalidate）+ P0 §3（admission deny 覆盖该 managed name）；**live 未验收**=acceptance §1/§9（第 2 条）；证据 HEAD `cfdf87267`、`84e9348fc`、`6d1b7a1fb`；**2026-11-07 layer B（host-free，0 boot，⑧/⑨ 不变）**=FSB-IMG-1/2/3 + **`GAP-FS-CONTRACT-1`**：未修产品路由下 routed `read_image` 的 deferred 子 fiber 解析不到 `fs`（`cannot get property "fs" without inject`），0 provider 读、0 附件字节、0 guard fact（FSB-IMG-1）；按拟议最小 diff（`ROUTED_SERVICE_NAMES` 增 `fs`）的组合下 allowed=恰 1 个 `{image/png, 70 B, 1×1}` 附件（`stat`→`readBytes` 顺序、工具值与附件同一 id），refused=恰 1 条 `stat deny` 且 0 `readBytes`/0 附件字节（FSB-IMG-2/3）；变异 M4（附件 store 不记账）只让 allowed 臂红。缺口、未提交 diff 与影响实测=`dev/agent-workflow/evidence/a5sf-fs-face/README.md` §6。**该缺口今天 fail-closed（无越界读），但 route-C 下 `read_image` 不可用且遮蔽可用的 preset 定义。** | 依赖可解析的 `attachments`（缺失时该子 fiber 良性不注册、`read_image` 不在 surface）；依赖 `DEFERRED_SETTLE_ROUNDS=20` settle bound（有 attachments 时实测 ~4.2 ms / A1 端到端 10 ms；超界即 fail-closed 拒绝）；read_image 自身执行路径的 guard fact 仅在**拟议** `binding-post-gap-1` 组合下已测，产品 route-C 下仍未测**2026-11-07 layer-B 增量2（host-free，0 boot）**=FSB-IMG-4a/4b（route gate：text-only 路由在**任何 provider I/O 之前**被拒绝——恰 1 次 `resolveModelInfo(provider,model)`（调用路由，非默认）、0 stat/0 readBytes/0 附件字节/0 guard fact；4b 证明**产品 route-C** 下同样在 I/O 前拒绝，并显式断言 GAP 的 inject 文本**不出现**：两个失败码不混）+ FSB-BIND-IMAGE（拟议 `binding-post-gap-1` 组合：in-binding 图片读由 binding provider 服务 stat→readBytes 各 1、恰 1 附件、facts 均 `realm=binding`；ceiling-only 目标 1 条 binding `stat deny IO_READ_DENIED`、0 `readBytes`、0 附件字节）。证据=同 README §3.2 | BOUNDED-DEFER | no |
| str_replace_editor (M-05) | str_replace_editor（若 Host 提供） | service-mediated:fs | 读写两轴 | 原生编辑与原子写保留、逐工具拒绝 | 证据=dev/agent-workflow/evidence/a5sf-g1/G1-GATE-REPORT.md；机制级 | BL-21 库存已查明：模块存在于 pinned baseline（`@deepseek-ai/dsh-tool-str-replace-editor`，`inject=["tools","fs"]`，同步注册 `str_replace_editor`），但**不在产品 preset 里、也未进 `a5sfNativeToolModules`** → 未接入；见 `NATIVE-SOURCE-INVENTORY.md` §2/§3 | NOT_WIRED | no |
| grep (M-06 native) | 原生 grep 经 OS rg | service-mediated:subprocess 加 os-confined:leaf | 读上界；进程 argv 不可注入越界路径 | exit 0/1、无匹配、非法模式、流与取消、真实 OS 拒读 | **host-free 半场已实测（BL-16）**：真 pinned `@deepseek-ai/dsh-tool-fs-search` 0.2.0-rc.2 @ `639ed01539` + 真 `rg`（`@vscode/ripgrep-linux-x64@1.18.0`）+ P1-07 真 Landlock launcher，经产品 seam（`mountMemberA5sfRealm` + `attachA5sfNativeToolModules`）驱动；GREP-PRE（对照：confined 面挂载前同一越界搜索仍执行并返回越界内容、`facts=0`，即 SEARCH-3 的原洞）+ GREP-IN（in-lane 执行成功，`method=spawn/allow/ALLOW`，locator=搜索根）+ GREP-OUT（out-of-lane **在任何进程存在前**拒绝：`spawns=0->0`，恰一条 `decide/IO_READ_DENIED` 事实，越界内容不出现）+ GREP-EXIT1（无匹配 = 正常结果而非失败）+ GREP-EXIT2（非法模式 = 失败，绝不冒充 no-match）+ SHELL-DENY（`sh -c 'cat /etc/passwd; cat <outside>/secret.txt'` 在**准入层**被拒：`spawns=0->0`、`providerCalls=0`、恰一条 `deny/IO_READ_DENIED` fact（`locator=/bin/sh`）、字节为空；同一命令在修正前实测返回 `/etc/passwd`） + KERNEL（第 2 层直测：raw provider 绕过准入时，越界读被内核拒绝且 in-lane 读仍成功） + PIN-ETC/PIN-SYMLINK/PIN-HARDLINK/PIN-CAPS（实测内核 allowance `lane ∪ /bin,/usr,/lib,/lib64,programDir ∪ /etc,/proc` 的边界、in-lane 能力收窄；symlink 只在第 2 层 raw provider 下可服务，产品 seam 因 `--follow` 不在 shipped shape 内而拒绝）+ B1-FILE/B1-FILEEQ（`rg -f`/`--file=` 的 pattern-file 读在准入层拒绝）+ B2-NOCONFIG（`--` 之后的 `--no-config` 只是 operand；`RIPGREP_CONFIG_PATH` 的 `--pre` 不再可达）+ B3-PROG（可写目录中名为 `rg` 的脚本因 realpath 落在 effective write lane 而拒绝）；单元/产品 seam 套件 `packages/runtime/test/a5sf-confined-subprocess.test.ts`（21）+ `a5sf-bl16-grep-realm.test.ts`（6）各有臂；证据=dev/agent-workflow/evidence/a5sf-bl16-grep/README.md + `dev/agent-workflow/evidence/a5sf-bl16-grep/arms.json` + `dev/agent-workflow/evidence/a5sf-bl16-grep/grep-arms.mjs`（18 臂）；历史可采纳性测量（SEARCH-0/1/2/3）仍见 dev/agent-workflow/evidence/a5sf-fs-tools/README.md |**host-free 半场已实测（该段为 2026-11-04 时点）**：当时无 Host boot，生产 preset/glue 是否真的供给 `subprocess` face、live agent 的 `grep`/`glob` surface 是否中性未实测；2026-11-05 的第十次 boot 在 `c658d974d` 上补齐了 live 半场（六行全 PASS，见本行末条）。残余风险（按实测改写）：（a）**内核 allowance 大于“lane 之外一律拒绝”**：OS profile = `lane ∪ /bin,/usr,/lib,/lib64,programDir ∪ /etc,/proc`；前四项与程序目录由本 face 为 exec/loader 添加，`/etc`+`/proc` 的 READ_FILE/READ_DIR 来自**共享 launcher 的 `runtime_base`**。实测（raw provider，绕过准入）：直接 `/etc/passwd`、`/usr/lib/os-release`、`/proc/self/status` 读取成功；in-lane symlink 到三者仅在 `--follow` 下成功（产品 seam 拒绝该 flag）；**预先存在**的 in-lane hardlink 到 lane 外 inode 成功（`PIN-ETC`/`PIN-SYMLINK`/`PIN-HARDLINK`）。内核拒绝 `/home` `/srv` `/var` 与 scratch 兄弟目录。**因此对 allowance 内的“已声明 root”，准入层是唯一一层**。**在 BL-39 后端加固审计落地前，OS profile 不是全局读白名单**：它是含 `/etc`+`/proc` 的 allowance，审计范围 = 枚举真正不可避免的 runtime 依赖、逐项判断能否收窄到具体文件/目录、区分哪些例外属于可信 host 而非不可信子进程。（b）**shell 洞已按准入关闭，不再是“无 fact 不对称”**：`sh`/`bash`/`python*`/`node`/`perl`/`ruby`/`awk`/`xargs`/`find`/未知二进制一律在准入层拒绝（typed `TeamIoDenial(IO_READ_DENIED)` + 恰一条 deny fact + 0 进程）。allow-list 是声明的类型化列表（当前仅 `rg`）；`rg` 的 argv 契约是 **shipped shapes 的 allow-list**：`--no-config` 必须是程序后的第一个参数（在首个 `--` 之前），只接受 `--json`/`--regexp=…`/`--glob=…`/`--files`/`--sort=modified`/`--no-ignore`/`--hidden` 与 `--` 根；`-f`/`--file`/`--ignore-file`（B1：读未声明的 pattern/ignore 文件）、位置化 `--no-config`（B2）、`--pre`/`--search-zip`/`-z`、`--follow` 及其余 flag 一律拒绝。**残余**：已准入 root 内部的预置 hardlink 仍被产品 seam 服务并记 `ALLOW` fact（准入只看声明的 root，不遍历树）；nested symlink 只在内核层（raw provider + `--follow`）可服务，产品 seam 已拒绝 `--follow`；程序身份按 **effective write lane 的 realpath** 判定（B3 关闭），但不按二进制字节 hash，也不覆盖本 face effective write lane 之外的 Member 可写集合，且不检查调用方 `spec.env`（`LD_PRELOAD`/`LD_AUDIT` 类加载器注入；可达前提 = 直接控制 argv/env 的调用方，pinned 模块不提供该入口）。（c）模型可见文本是模块自己的 `grep subprocess failed before reporting an outcome`，typed code 只在抛出的 `TeamIoDenial` 与事实里。（d）`toolBindingIdentity` **显式为 `null` 且 install spec 没有字段可设**：`ConfinedSubprocessOptions.toolBindingIdentity` 存在、默认 `null`，但 `ConfinedSubprocessRealmSpec`（install/realm 输入）未暴露该字段，故所有事实 `toolBindingIdentity=null`；search 无 `dsh.fs/*` 绑定，ceiling realm 即预期 realm，但这不是“绑定面已覆盖”。（e）`mode:'all'` 车道、spill/control/inherit stdio、`spawnTerminal`、非绝对 `argv[0]` 一律 fail-closed 拒绝（非降级）。（f）**binding-realm 不再有潜在洞（BL-17，2026-11-04）= 组合期 typed 拒绝**：`mountNativeToolModules` 将 binding-owned mount 挂到 `binding?.ctx`，而 `installToolBindingRealm` 只隔离 `fs`、**不挂 `subprocess` face**。现在每个已装 realm 以**必填**的 `faces: RealmServiceFaces` 陈述自己拥有哪些 confined face（`subprocess` = 已挂 face 或 `null`，不允许“未回答”）；声明 `inject` 含 `subprocess` 的模块若目标 realm 的答案是 `null`，在**任何 fiber / tool 定义 / service lookup 之前**以 typed `TeamServiceInstallError` code `SUBPROCESS_UNCONFINED_REALM`（导出 token `A5SF_SUBPROCESS_UNCONFINED_REALM`）拒绝，错误点名 realm 与 module；deferred `ctx.inject(['subprocess'], …)` 由 settle 后的子 fiber 检查在同一组合边界拒绝。实测（host-free，真 pinned 模块）：`a5sf-subprocess-unconfined-realm.test.ts` U1/U1b——binding-realm mount 与产品行 attach 都被同一 code 拒绝，`spawns=0`、base `subprocess` tripwire 计数不变、被拒调用创建 **0** 个 fiber、`grep` 定义仍是调用前那个；U2 对照：拥有 face 的 Member realm 挂载同一模块并让 routed `grep` 在 confined provider 上执行。search 不受影响（挂 ceiling `memberTarget`）。**未来 binding-mounted subprocess consumer 如何才受支持**：在该 binding realm 的隔离 scope 上安装 confined `subprocess` provider 并在 `faces.subprocess` 报告它（`installToolBindingRealm` 今天不挂）——否则一律拒绝；不得放宽 mount seam，也不得解析继承的 base service。（g）**in-lane 能力收窄（实测 `PIN-CAPS`）**：文件写成功；`mkdir`、symlink 创建、in-lane `execve` 被拒；**两个 in-lane 路径之间的 hardlink 创建成功**（profile 无 link 位）——“no link creation”对 hardlink 为假，本行不采用该说法。（h）未测：>cap 结果裁剪、流式读取中途取消（取消臂用 double）；无 Host boot。**2026-11-05 产品装配半场（不改变本行等级）**：产品行现有 `config.a5sfMemberPolicies` 产品可见声明面（`packages/runtime/team-services/src/product-assembly.ts`；声明即受管、未声明的模板走原路径，不是隐藏开关），被声明模板经**同一** `mountMemberA5sfRealm` 得到 ceiling+binding realm，且该声明面把`executionBoundary=confined-subprocess` 的绑定在**组合期**以 `SUBPROCESS_UNCONFINED_REALM` 拒绝（网络轴收窄 → `NETWORK_UNCONFINED_REALM`）。**但这不构成本行的产品覆盖**：confined `subprocess` face 仍不能由产品 config 表达（需组合提供 P1-07 `ConfinedProcessProvider` + launcher pin），且本仓库没有任何 shipped composition/preset 声明 `a5sfMemberPolicies` —— preset-only World 的 `grep`/`glob` 仍无受限面（`dev/agent-workflow/evidence/a5sf-search-live/README.md` §4 F2 结论不变）。证据=`dev/agent-workflow/evidence/a5sf-product-assembly/README.md`。 **2026-11-05 家系发现（live row 1 判红后修复；本行等级/V@B 不变）**：in-lane `grep` 在 git worktree 内曾因 confined `rg` 向上做 VCS/祖先 ignore 发现、读 lane 外 `.git` FILE 被内核拒绝而 `exit 2`；修复在**调用**而非 lane：`laneSafeSearchArgv` 仅在「搜索根的祖先超出 effective read lane」时于 `--no-config` 后加 `--no-ignore-parent --no-ignore-vcs`，并把「VCS/祖先 ignore 发现已禁用、`.gitignore`/`.git/info/exclude` 语义不再应用、`.git` 未被读取」记在**同一条** allow fact 的 `annotations`（`a5sf-guard-consult/1` 可选增量字段；fact/进程数不变）；lane 含 worktree root 时 argv 原样、`.gitignore` 语义不变；`.git` 直读仍在准入（deny、0 进程）与内核两层拒绝。残余：仅在该根祖先越界时 `.gitignore` 语义被关闭（同目录下被忽略文件会进入结果），已由上述 fact 披露；未 boot、未重判 live row。证据=dev/agent-workflow/evidence/a5sf-rg-ancestors/README.md。 **2026-11-05 live 半场：六行全 PASS；重切时曾复位为当前断言，但 `#598`/`#599`/`#600` 后已退回 `ENFORCE-PARTIAL` / `V@B=no`**：`P2-04` 第 10 次 boot 于 head `c658d974d`（证据 `dev/agent-workflow/evidence/a5sf-search-live/`，`overall=PASS cases=6 PASS:6`，`10 intents + 10 boots + 0 aborts`）在真 Host 上判绿：in-lane 允许（`confined-exit code=0`、`stderr` 为空；同时按 `#593` 记录 `annotations`：该 lane 形态下 `.gitignore`/`.git/info/exclude` **关闭**）、越 ceiling 与越 restriction 两种均在任何进程存在前拒绝、取消后子进程以 143 终止、非法模式为 tool error、archive 边界后工具面 **422 + 0 fact + 0 spawn**。**旧 baseline 下不计 current claim 的原因不是能力而是新鲜度**：`as20261102r1`（`17ce7043…`）早于本轮产品面（`#593`/`#594` 均改了 `packages/**`）。**2026-11-05 重切曾证明树相等并复位本行（该复位只对当时那棵树成立）**：实测树 `c658d974d` 的 `packages/**` 树哈希 `9609403ccc5a2057f66fbc2d0b6187832d834814` 与新 baseline `1fd0d9fca…` 的 `packages/**` 树哈希逐字节相等；`scripts/**`、`tests/paths.mjs`、`package.json`、`pnpm-lock.yaml`、glue `agent-bindings.mjs` 亦逐项相等。故当时按 §1.1 记 `ENFORCE-PARTIAL` / `V@B=yes`（snapshot `as20261105r1`；tested `c658d974d3d0502af482727b0aea23482f5e3920`），证据不删；`#598`/`#599`/`#600` 再移动产品面后本行已退回 `V@B=no`（见本节末与 §1.1）。**本行明确不放宽**：`toolBindingIdentity` 仍为 `null`（install spec 无字段）；row 3 的 **preset-expression** 收窄臂仍 `UNSUPPORTED`；binding-realm `subprocess` face 仍被 BL-17 拒；row 6 的 typed code 只在产品内部，线上仅 422 + message **2026-11-05 归档边界并发窗口（不改等级）**：live 第十次 boot 判绿的 row-6 断言是**顺序**形态（归档完成后下发）。同日独立审查实测产品顺序为 `quiesce → commit`（`quiesce.ts:143` 释放驻留 → `archive.ts:141-151` durable ARCHIVED）；其 **quiesce → commit 窗口**内的下发曾被合法冷启动并让 handle 活过提交（200、1 次工具执行、驻留存活）。修复=提交后重放驻留释放 + resume 后 durable 复核（`liveAgents.set` 前无 await）+ 每成员 admission close（原先产品为 no-op，现实现并在每次退出时 reopen）；host-free 臂 `dev/agent-workflow/evidence/a5sf-archived-gate/archive-race-arms.test.mjs` RO1–RO4 与变异对照 `race-mutation-control.mjs` 覆盖该窗口（RED 3 failed / 1 passed → GREEN 4/4）。本行等级仍为 `ENFORCE-PARTIAL`，但 `V@B` 已退回 `no`（见本节末）；live 证据未删、未重判。仍不覆盖：child factory 的 `liveAgents` 写入（row-start、无工具下发路由）与跨进程陈旧视图；boot resume loop 与 boot publish 已由 `#599`/`#600` 关闭（`a5sf-boot-seam`/`a5sf-boot-publish` 的 BS1–BS5；前提 = lifecycle 接线 `AdmissionClosePort`，产品 `root.ts` 自 `#598` 起满足），且 mid-boot publish 确实可从工具下发到达（BS4），不能再写成“非工具下发路径”。另：deny fact 不再携带"rg 已运行"注解（原为事实夸大，已修并加被拒目录根回归臂）。 **本行 `V@B` 于同日退回 `no`（不是能力撤回，也不是重新判负）**：`RACE-FIX` 改了 `archive.ts`/`dispose.ts`/`quiesce.ts`/`agent-bindings.mjs`/`guard-observability.ts`，即 live 六行所测产品面本身；Q7 因此拒绝 current claim（`#598` 时点 34 条；至 `#600` 为 36 条）。live PASS 仍属于修复前的树（证据不删），要恢复 `V@B=yes` 只能在新树上重新实测——需新的 boot 预算，`P2-04` 已 10/10 用尽。**2026-11-05 candidate-1 live 重测（baseline 树上）**：冻结候选 `1484fa4ee`（= snapshot `as20261105r2` 的 baseline）单次 boot（port 3184，`dev/agent-workflow/evidence/a5sf-candidate1/README.md`）六行中 row1/row2/row4/row5/row6 PASS（row1：1 confined spawn、0 base、confined-exit 0；row2：0/0 进程、1 deny、无泄漏；row4：子进程 143；row5：tool error；row6：归档后 422 + 0 fact + 0 spawn，home 删除、端口释放、无孤儿），负控 PROVEN（无 realm 时同一越界 grep 返回 2 行越界内容、11 次 base spawn、0 guard fact）；**row3（restriction 收窄臂）REFUTED**，失败条款 `exactlyOneDenyFact`，原因同 M-01：B 与该行操作数共用 locator，多出一条 binding realm 的 `stat deny`；产品侧仍是 0/0 进程、无泄漏、result 为 error。REFUTED 不是 PASS，故当时维持 `V@B=no`。**同日 allocation #4 retry（同一 baseline 树，只拆 fixture）**：row3 判 `RESTRICTION_NARROWER_THAN_CEILING_REFUSED_AT_ADMISSION`——恰好 1 条 deny fact（member/`spawn`/`IO_READ_DENIED`）、0 confined + 0 base spawn、无泄漏 token，六行 6/6 PASS（同一次 boot 的负控仍 PROVEN）。故本行复位为 `ENFORCE-PARTIAL` / `V@B=yes`：tested `25e106b4573cac0ab624c7e0bc5ca7d36dba3730`（产品树与冻结候选 `1484fa4ee` 逐项相同，判官 blob 未变）。 **2026-11-05 合并 `#606` 后本行 claim 失效（Q7）**：`subprocess.ts`（grep 骑的子进程面）与 `a5sf-bl16-grep-realm.test.ts` 本身都在 28 条漂移路径内——BL-18 给该 provider 加了可选 `probe` 并由 web 面共用。复位 `NEEDS_REVALIDATION` / `V@B=no`；6/6 的结论保留于 `1484fa4ee`，需新树 boot 才能重新 current。**2026-11-10 DEV-LIVE（只注记，不改 ⑧/⑨）：Search 行在 FS/Search DEV-LIVE 的 14 行表里重测（run-3/run-4，search 6 行全 PASS，整表 13 PASS / 0 FAIL / 1 NOT_REACHED），证据=`dev/agent-workflow/evidence/a5sf-fs-devlive/README.md` §2，见 §1.3；等级/V@B 不变** | NEEDS_REVALIDATION | no |
| glob (M-07) | 原生 glob 经 rg | service-mediated:subprocess 加 os-confined:leaf | 读上界 | 目录与过滤、无结果、异常、禁读 | **host-free 半场已实测（BL-16，与 M-06 同一 confined `subprocess` face；同一真 pinned `@deepseek-ai/dsh-tool-fs-search` 0.2.0-rc.2 @ `639ed01539`）**：GLOB-IN（in-lane 列出 `needle.txt`/`quiet.txt`，`method=spawn/allow/ALLOW`）+ GLOB-OUT（out-of-lane `spawns=0->0`，恰一条 `deny/IO_READ_DENIED`，越界目录名 `secret.txt` 不出现）+ `a5sf-bl16-grep-realm.test.ts` G1/G2；对照 GREP-PRE 与历史 SEARCH-0/SEARCH-3 证明挂载前同一越界 glob 执行并列出越界内容、`facts=0`；证据=dev/agent-workflow/evidence/a5sf-bl16-grep/README.md + `dev/agent-workflow/evidence/a5sf-bl16-grep/arms.json` |与 M-06 同一实现与同一残余风险（见 M-06：内核 allowance 含 `/etc`+`/proc`，**在 BL-39 审计落地前不是全局读白名单**；预置 hardlink 以 ALLOW fact 服务；nested symlink 只在 raw layer 2（产品 seam 已拒 `--follow`）；程序身份 = effective write lane realpath（B3；不 hash 字节、不覆盖本 face 之外的 Member 写集合、不检查 env）；B1/B2 已关闭；`toolBindingIdentity=null` 且 spec 无字段；binding-realm 无 `subprocess` face → 组合期 typed 拒绝（`SUBPROCESS_UNCONFINED_REALM`，见 M-06(f)），不是潜在洞；in-lane 能力收窄；只证 host-free 半场）。**glob 特有**：无结果与“不允许”现在可由 fact 区分（拒绝必有 deny 事实），但 result 逐条目录/过滤语义（VCS/hidden/ignored 排除）仍只有既有的 glob-backend 套件覆盖，本 lane 未重跑那组对抗臂。**2026-11-05 产品装配半场（不改变本行等级）**：与 M-06 同一结论——产品声明面已存在，且不可表达的面在**组合期**以 `SUBPROCESS_UNCONFINED_REALM`/`NETWORK_UNCONFINED_REALM` 拒绝；但 confined `subprocess` face 不可由产品 config 表达、无 shipped preset 声明 `a5sfMemberPolicies`，故本行等级/V@B 不变，preset-only World 的 `glob` 仍无受限面。证据=`dev/agent-workflow/evidence/a5sf-product-assembly/README.md`。 **2026-11-05 家系发现（live row 1 判红后修复；本行等级/V@B 不变）**：in-lane `grep` 在 git worktree 内曾因 confined `rg` 向上做 VCS/祖先 ignore 发现、读 lane 外 `.git` FILE 被内核拒绝而 `exit 2`；修复在**调用**而非 lane：`laneSafeSearchArgv` 仅在「搜索根的祖先超出 effective read lane」时于 `--no-config` 后加 `--no-ignore-parent --no-ignore-vcs`，并把「VCS/祖先 ignore 发现已禁用、`.gitignore`/`.git/info/exclude` 语义不再应用、`.git` 未被读取」记在**同一条** allow fact 的 `annotations`（`a5sf-guard-consult/1` 可选增量字段；fact/进程数不变）；lane 含 worktree root 时 argv 原样、`.gitignore` 语义不变；`.git` 直读仍在准入（deny、0 进程）与内核两层拒绝。残余：仅在该根祖先越界时 `.gitignore` 语义被关闭（同目录下被忽略文件会进入结果），已由上述 fact 披露；未 boot、未重判 live row。证据=dev/agent-workflow/evidence/a5sf-rg-ancestors/README.md。 **2026-11-05 live 半场：六行全 PASS；重切时曾复位为当前断言，但 `#598`/`#599`/`#600` 后已退回 `ENFORCE-PARTIAL` / `V@B=no`**：`P2-04` 第 10 次 boot 于 head `c658d974d`（证据 `dev/agent-workflow/evidence/a5sf-search-live/`，`overall=PASS cases=6 PASS:6`，`10 intents + 10 boots + 0 aborts`）在真 Host 上判绿：in-lane 允许（`confined-exit code=0`、`stderr` 为空；同时按 `#593` 记录 `annotations`：该 lane 形态下 `.gitignore`/`.git/info/exclude` **关闭**）、越 ceiling 与越 restriction 两种均在任何进程存在前拒绝、取消后子进程以 143 终止、非法模式为 tool error、archive 边界后工具面 **422 + 0 fact + 0 spawn**。**旧 baseline 下不计 current claim 的原因不是能力而是新鲜度**：`as20261102r1`（`17ce7043…`）早于本轮产品面（`#593`/`#594` 均改了 `packages/**`）。**2026-11-05 重切曾证明树相等并复位本行（该复位只对当时那棵树成立）**：实测树 `c658d974d` 的 `packages/**` 树哈希 `9609403ccc5a2057f66fbc2d0b6187832d834814` 与新 baseline `1fd0d9fca…` 的 `packages/**` 树哈希逐字节相等；`scripts/**`、`tests/paths.mjs`、`package.json`、`pnpm-lock.yaml`、glue `agent-bindings.mjs` 亦逐项相等。故当时按 §1.1 记 `ENFORCE-PARTIAL` / `V@B=yes`（snapshot `as20261105r1`；tested `c658d974d3d0502af482727b0aea23482f5e3920`），证据不删；`#598`/`#599`/`#600` 再移动产品面后本行已退回 `V@B=no`（见本节末与 §1.1）。**本行明确不放宽**：`toolBindingIdentity` 仍为 `null`（install spec 无字段）；row 3 的 **preset-expression** 收窄臂仍 `UNSUPPORTED`；binding-realm `subprocess` face 仍被 BL-17 拒；row 6 的 typed code 只在产品内部，线上仅 422 + message **2026-11-05 归档边界并发窗口（不改等级）**：live 第十次 boot 判绿的 row-6 断言是**顺序**形态（归档完成后下发）。同日独立审查实测产品顺序为 `quiesce → commit`（`quiesce.ts:143` 释放驻留 → `archive.ts:141-151` durable ARCHIVED）；其 **quiesce → commit 窗口**内的下发曾被合法冷启动并让 handle 活过提交（200、1 次工具执行、驻留存活）。修复=提交后重放驻留释放 + resume 后 durable 复核（`liveAgents.set` 前无 await）+ 每成员 admission close（原先产品为 no-op，现实现并在每次退出时 reopen）；host-free 臂 `dev/agent-workflow/evidence/a5sf-archived-gate/archive-race-arms.test.mjs` RO1–RO4 与变异对照 `race-mutation-control.mjs` 覆盖该窗口（RED 3 failed / 1 passed → GREEN 4/4）。本行等级仍为 `ENFORCE-PARTIAL`，但 `V@B` 已退回 `no`（见本节末）；live 证据未删、未重判。仍不覆盖：child factory 的 `liveAgents` 写入（row-start、无工具下发路由）与跨进程陈旧视图；boot resume loop 与 boot publish 已由 `#599`/`#600` 关闭（`a5sf-boot-seam`/`a5sf-boot-publish` 的 BS1–BS5；前提 = lifecycle 接线 `AdmissionClosePort`，产品 `root.ts` 自 `#598` 起满足），且 mid-boot publish 确实可从工具下发到达（BS4），不能再写成“非工具下发路径”。另：deny fact 不再携带"rg 已运行"注解（原为事实夸大，已修并加被拒目录根回归臂）。 **本行 `V@B` 于同日退回 `no`（不是能力撤回，也不是重新判负）**：`RACE-FIX` 改了 `archive.ts`/`dispose.ts`/`quiesce.ts`/`agent-bindings.mjs`/`guard-observability.ts`，即 live 六行所测产品面本身；Q7 因此拒绝 current claim（`#598` 时点 34 条；至 `#600` 为 36 条）。live PASS 仍属于修复前的树（证据不删），要恢复 `V@B=yes` 只能在新树上重新实测——需新的 boot 预算，`P2-04` 已 10/10 用尽。**2026-11-05 candidate-1 live 重测（baseline 树上）**：冻结候选 `1484fa4ee`（= snapshot `as20261105r2` 的 baseline）同一次 boot（port 3184，`dev/agent-workflow/evidence/a5sf-candidate1/README.md`）的 glob 面：in-lane `glob` PROVEN、越 ceiling `glob` PROVEN（0 进程、1 条 deny、越界文件名不出现，`glob-face.json`）；glob 操作数不与任何其他行共用 locator，不受 row3 别名问题影响。故本行复位为 `ENFORCE-PARTIAL` / `V@B=yes`（tested `1484fa4ee0ff9326a3dafcac060bf63f8d334a1f`）；未覆盖项不变（`toolBindingIdentity=null`、preset 表达收窄 `UNSUPPORTED`、row6 typed code 仅内部）；同日 allocation #4 的同树 retry 11/11 复核，glob 两面仍 PROVEN。 **2026-11-05 合并 `#606` 后本行 claim 失效（Q7）**：glob 与 grep 同骑 `subprocess.ts`，该文件在 28 条漂移路径内。复位 `NEEDS_REVALIDATION` / `V@B=no`；两臂 PROVEN 的结论保留于 `1484fa4ee`，需新树 boot 才能重新 current。**2026-11-10 DEV-LIVE（只注记，不改 ⑧/⑨）：Search 行在 FS/Search DEV-LIVE 的 14 行表里重测（run-3/run-4，search 6 行全 PASS，整表 13 PASS / 0 FAIL / 1 NOT_REACHED），证据=`dev/agent-workflow/evidence/a5sf-fs-devlive/README.md` §2，见 §1.3；等级/V@B 不变** | NEEDS_REVALIDATION | no |
| bash persistent (M-08) | 原生持久 bash 经 ctx.terminals | os-confined:leaf 加 team-shell | 读写两轴，network 拒绝 | 同 PTY 多命令、cwd、前后台、信号与超时、只写不读、旧代 PTY 拒用 | 证据=dev/agent-workflow/evidence/a5sf-p1-08/TERMINAL-LIFECYCLE-EVIDENCE.md；生命周期已测，工具级待 BL-17；BL-17 后端半场（host-free）=dev/agent-workflow/evidence/a5sf-bash/README.md（shell-class 准入、只写不读、chmod/新建负控、禁网拒绝、旧代 PTY 拒用；live 未证，`V@B=no` 不变）；**layer B 契约半场（host-free，0 boot）= dev/agent-workflow/evidence/a5sf-subprocess-face/README.md**（argv 边界精确谓词、program-vs-shell-class 优先级、`probeNetworkDenial` 形状与禁网拒绝不 spawn、写轴归属、`confinedChildEnvironment` 与上游代理 overlay 的实测分歧；只证拒绝位置与契约，不证 OS 级网络隔离，等级/V@B 不变）；**Shell-PTY layer B 契约半场（host-free，0 boot，⑧/⑨ 不变）= dev/agent-workflow/evidence/a5sf-pty-face/README.md**（分配/复用/替换/撤销/回收的精确转移与「一次分配、一次 kill」，退出状态在产品 registry 被塌缩成 `killed:true`（F1），旧代 PTY 拒用在 DECLARED 形状先于任何分配、在 DEFERRED 形状**后于分配**（F2），无 domain 的 revoke 不持久（F3），stale-but-active（F4），双终端身份不串；只证端口边界，真 PTY 与 OS 级 reap 记 `NOT_REACHED`）；**2026-11-10 DEV-LIVE（只注记，不改 ⑧/⑨）：Shell-PTY 面有稳定 DEV-LIVE 结果（run pair=run-08/run-09）：Member 的 shell 是继承的 legacy PTY，该路径被实测在 realm 之外（PD-13），证据=`dev/agent-workflow/evidence/a5sf-pty-devlive/README.md` §3a/§3b，见 §1.3；"live 未证"保留为历史，等级/V@B 不变**；**2026-11-11 BL-42 追加（不改 ⑧/⑨）：同面的 `network: deny` 现已有 OS 级后端——受限子进程自有 netns，实测 deny 子进程 0 连接、`connect`/`sendto` 得 `ENETUNREACH`；但 §7 严格计数只有 **4/5**（宽读 5/5，且宽读的 item 5 是同一个 process face 上的第二个消费面，不是 live Host），且 **0 次启动**、无 `DEV-LIVE` 行。本行仍 `NOT_WIRED`：该机制作用于 confined 子进程，不作用于 preset 继承的 legacy PTY，且没有任何 shipped 组合声明 shell class/该面。仍 not entitled：A Member's `bash` cannot reach the network. 见 §1.4 与 `dev/agent-workflow/evidence/a5sf-bl42-netdeny/README.md` §6–§8。**；**2026-11-12 MEMBER-CONSOLIDATE（只注记，不改 ⑧/⑨）：opt-in 受治 Member 拿到的是 confined terminal face 上的 `bash`（每条命令一个 fresh confined child），持久 shell 不提供，产品组合臂 `G7` 以 `TERMINALS_DOUBLE_TERMINAL_REFUSED` 拒绝双终端；默认 preset 的 Member 两者都没有；`DEV-LIVE`、no `V@B`；见 §1.5**；**2026-11-13 FINAL-DOCS（只注记，不改 ⑧/⑨）：本行所骑的 realm 挂载点也是 label-without-mechanism 的所在——一个声称 `a5sfGovernedRealm: true` 却编译不出 realm 的行，原本会让 Member 跑继承的 `bash`；现以已有的 typed `REALM_DECLARATION_INVALID` 拒绝并 RED→GREEN 钉住（W3b）。默认路径不可达（`host.ts:2142-2149` 才构造 governed provider，`agent-bindings.mjs:2598` 才进入挂载，shipped layer 不写这两个键）；见 §1.6** | 真实 PTY 仍是测试 double；同 UID chmod 越界 | NOT_WIRED | no |
| bash transient (M-09) | 原生瞬态 bash 经 ctx.shell | os-confined:leaf | 读写两轴 | 与持久终端分别验收；danger-full-access 不越 Member ceiling | 证据=dev/agent-workflow/evidence/a5sf-p1-07/OS-RUNNER-EVIDENCE.md；OS 机制已测；**layer B 契约半场（host-free，0 boot）= dev/agent-workflow/evidence/a5sf-subprocess-face/README.md**，含真 pinned `@deepseek-ai/dsh-bash-local` 经产品 seam 挂载后在 `argv[0]` 被 `SUBPROCESS_PROGRAM_NOT_ABSOLUTE` 拒绝的 `GAP-SUB-CONTRACT-1`（live 未证，`V@B=no` 不变）；**2026-11-10 DEV-LIVE（只注记，不改 ⑧/⑨）：Subprocess 面有稳定 DEV-LIVE 结果（run pair=boot 10/boot 11）：shipped executor serves `bash`，且 `network: deny` 只拒绝该 face 自己的调用（同一 Member 的 model-visible `bash` 照跑，bwrap argv 无 `--unshare-net`，PD-12），证据=`dev/agent-workflow/evidence/a5sf-sub-devlive/README.md` §Q1/§Q5，见 §1.3；等级/V@B 不变。**；**2026-11-10 PD12-FIX 追加（仍不改 ⑧/⑨）：PD-12 已修（draft PR）：同一 `bash` 调用现在由 confined face 服务，deny 成员以 `NETWORK_UNCONFINED_REALM` 在 admission 层拒绝（0 provider/0 进程）；这是 admission 拒绝，不是 OS 网络隔离，`V@B` 不变。证据=`dev/agent-workflow/evidence/a5sf-pd12-fix/README.md`。**；**2026-11-11 BL-42 追加（不改 ⑧/⑨）：同面的 `network: deny` 车道现在有 OS 级后端（受限子进程自有 netns；父进程读计数：对照子进程 accepted=1 且 nonce 匹配，deny 子进程 accepted=0 且 `connect`/`sendto` 得 `ENETUNREACH`），但 §7 严格计数 **4/5**（宽读 5/5），**0 次启动**、无 `DEV-LIVE` 行；本行仍 `NOT_WIRED`（工具未绑定，且没有 shipped 组合声明该面）。仍 not entitled：A Member's `bash` cannot reach the network. 见 §1.4。**；**2026-11-12 MEMBER-CONSOLIDATE（只注记，不改 ⑧/⑨）：opt-in 受治 Member 的 model-visible `bash` 在真实 Host 上由 confined terminal face 服务（1 次 confined-provider launch 服务 2 条命令、带夹具的 base bwrap 0），本行 ctx.shell 瞬态路径仍未绑定；默认 preset 不变；`DEV-LIVE`、no `V@B`；见 §1.5**；**2026-11-13 FINAL-DOCS（只注记，不改 ⑧/⑨）：本行是 label-without-mechanism 的 blast radius 所在——声称 `a5sfGovernedRealm: true` 的行在模板无 `memberIoCeilings` 时，provider 答 `undefined`、挂载在 governed-row 拒绝之前返回，Member 的 model-visible `bash` 就是预设继承的不受限执行体；现以已有的 typed `REALM_DECLARATION_INVALID` 拒绝并 RED→GREEN 钉住（W3b）。默认路径不可达（`host.ts:2142-2149` / `agent-bindings.mjs:2598`）；见 §1.6** | 工具尚未绑定 | NOT_WIRED | no |
| pwsh (M-10) | pwsh 持久与瞬态 | os-confined:leaf（可用平台） | 读写两轴 | 平台不支持即 ENV_BLOCK；不虚称 Linux PASS 等于 Windows | 证据=dev/agent-workflow/evidence/a5sf-g1/G1-GATE-REPORT.md；机制级 | 本机无 Windows 后端 | NOT_WIRED | no |
| run_code / PTC (M-11) | 原生 run_code 与 PTC | os-confined:leaf 加受控 Host bridge | 文件读写与 network 拒绝，IPC 受控 | 运行与嵌套调用正控；无 Host 代发旁路 | 证据=dev/agent-workflow/evidence/a5sf-g1/G1-GATE-REPORT.md；机制级 | BL-21 库存：`run_code` 不是可装载工具模块，而是 `@deepseek-ai/dsh-tools` 的 **PTC 模式保留名**（不可 register/shadow），PTC 是执行模式；无 routed-native 接入面 → 见 `NATIVE-SOURCE-INVENTORY.md` §3 | NOT_WIRED | no |
| lsp (M-12) | lsp 与 language server | os-confined:leaf 加 scoped service | 进程加代码库只读 | 生命周期、cwd、通信与退出；无法覆盖则 UNSUPPORTED | 证据=dev/agent-workflow/evidence/a5sf-g1/G1-GATE-REPORT.md；机制级 | 实际启动位置未 trace；BL-21 库存：模块存在（`@deepseek-ai/dsh-tool-lsp`）但不在产品 preset | NOT_WIRED | no |
| terminal_* (M-13) | terminal_open/send/read/signal/close/list | os-confined 已装 Terminal Backend | 读写两轴 | opening 与发送与读与 signal 与 close/list；失效不回裸 backend | 证据=dev/agent-workflow/evidence/a5sf-p1-08/TERMINAL-LIFECYCLE-EVIDENCE.md；领域层已测；**layer B（host-free，0 boot）= dev/agent-workflow/evidence/a5sf-pty-face/README.md**（真 pinned `TerminalSessionService` + 注入 backend：spawn→send→read→kill→`NO_SESSION`、exitCode vs signal vs transport error 三分、close-once 与 dispose 清理、同 owner 双会话写入不串/杀一不杀二；服务为真、PTY 机制为记录器，真 PTY 记 `NOT_REACHED`） | 端口为 double；BL-21 库存更正工具名：模块注册 `terminal_open/send/read/signal/close/list`（**无 `terminal_kill`**，见 `NATIVE-SOURCE-INVENTORY.md` §2）；**2026-11-10 DEV-LIVE（只注记，不改 ⑧/⑨）：Shell-PTY 面有稳定 DEV-LIVE 结果（run pair=run-08/run-09），实测的正是 preset 继承的 legacy PTY（`pty-1`/`pty-2` 身份不串）且该路径在 realm 之外（PD-13），证据=`dev/agent-workflow/evidence/a5sf-pty-devlive/README.md` §1/§6，见 §1.3；等级/V@B 不变** | NOT_WIRED | no |
| web_fetch (M-14) | 原生 web_fetch 经 ctx.web.fetch | service-mediated:web | network allow/deny（布尔，HTTP 前） | provider 选择、HTML 展示、network=deny 前置拒绝 | 证据=dev/agent-workflow/evidence/a5sf-g1/G1-GATE-REPORT.md；network=restricted UNSUPPORTED 已披露；**2026-11-10 DEV-LIVE（只注记，不改 ⑧/⑨）：Web 面有稳定 DEV-LIVE 结果（run pair=run-06/run-07）：seam 在 legacy/non-strict Member 自己的 tool call 上 live 到达，deny lane 在 face 上以恰 1 条 guard fact、0 provider entry 拒绝，证据=`dev/agent-workflow/evidence/a5sf-web-devlive/README.md` §3/§4，见 §1.3；"live 未跑"保留为历史，等级/V@B 不变**；**2026-11-11 BL-42 追加（不改 ⑧/⑨）：BL-42 的 netns 只作用于 confined 子进程，**不覆盖** service-mediated 的 web face；本行的 `network: deny` 仍是 face 上的 service-level 准入拒绝，不是 OS 网络拒绝。§7 严格 **4/5**（宽读 5/5）的计数属于 subprocess 车道，不属于本行；**0 次启动**，不 entitled 把这读成 Web 面已被 OS 隔离。见 §1.4。** | 上游 provider 内部网络不受本机 OS 限制 | NOT_WIRED | no |
| web_search (M-15) | 原生 web_search | service-mediated:web | network allow/deny（布尔） | source 与截断与 provider error 兼容、禁网 | 证据=dev/agent-workflow/evidence/a5sf-g1/G1-GATE-REPORT.md；机制级；**2026-11-10 DEV-LIVE（只注记，不改 ⑧/⑨）：Web 面稳定 DEV-LIVE 结果（run-06/run-07）覆盖 fetch/search 共用的 deny 车道——legacy/non-strict Member 自己的 tool call 在 face 上被拒，恰 1 条 guard fact、0 provider entry，证据=`dev/agent-workflow/evidence/a5sf-web-devlive/README.md` §3/§4，见 §1.3；PD-10 locator marker 仍在，等级/V@B 不变**；**2026-11-11 BL-42 追加（不改 ⑧/⑨）：与 M-14 同一条 web face——BL-42 的 netns 只作用于 confined 子进程，不使本行的 `network: deny` 变成 OS 拒绝；§7 严格 **4/5**（宽读 5/5）只描述 subprocess 车道，**0 次启动**，不 entitled 把这读成 Web 面已被 OS 隔离。见 §1.4。** | 不得复用旧 web-family PASS | NOT_WIRED | no |
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

**2026-11-05 合并 master 后四行全部回到 `no`——这次不是形式问题**：为清 BEHIND 合入 `origin/master`（`a5bd88b85`，`#606` confined web 面）后，`1484fa4ee..HEAD` 的产品漂移是 **28 条路径**，其中 `packages/runtime/team-services/src/subprocess.ts`（grep/glob 骑的子进程面）、`mount.ts`/`install.ts`/`types.ts`/`index.ts`（read/write 骑的 service 面）以及 `packages/runtime/test/a5sf-bl16-grep-realm.test.ts` 本身都在动——**被测的代码已经不是要合并的代码**。既不是把 pin 调大能解决的问题，也不是 master 自带红：同一条 gate 在 `origin/master` 上单独跑是 **pass**（baseline `1fd0d9fca3c8…`、claimed 0、drift 89——没有 current claim 就不触发 Q7）；合并树上是 `fail`（claimed 4、drift 28）。因此四行按 Q7 复位 `NEEDS_REVALIDATION` / `V@B=no`：11/11 的证据与结论保留（属于 `1484fa4ee`），但不再作为 current claim。重新成立只需一次 boot（fixture 拆分已在位）；在它发生之前，本表不宣称 FS/Search 在当前树上是当前的。

**诚实上限仍然成立**：任一行的 ⑤ 覆盖都未满，`DONE`/`LIVE-CONFIRMED` 仍不得出现在任何一行。
**2026-11-07 layer-B 轮（host-free，0 boot，不改任何 ⑧/⑨）**把其中两项从“无臂”变为“host-free 有臂”：
**大文件窗口/流式** = `M-01` 的 FSB-READ-1/2（真 pinned `tool-fs` + 真 `LocalFileSystem`，10,500,033 B
文件 `streamText` 恰 1 次、`readText` 0 次、窗口 256 行/总 52,501 行、footer 精确、尾字节不泄漏）；
**版本冲突** = `M-03` 的 FSB-EDIT-1/2（真 `fs-observation-policy` + 真版本守卫：stale edit 恰 1 次
`editText` 调用、1 条 `FS_STALE_VERSION`、0 字节改动、恰 1 条 allow fact；fresh edit 对照成功）；
**`read_image`** = `M-04` 的 FSB-IMG-1/2/3，并因此发现 `GAP-FS-CONTRACT-1`（见该行 ⑥ 与
`dev/agent-workflow/evidence/a5sf-fs-face/README.md` §6）。**原子替换仍无独立臂**（abort 臂只证
“不发布半成品”，不证 rename 原子性）；上述三项都**仍是 host-free 半场**，`M-01`/`M-03` 的 `V@B`
与 live 状态不变，`M-04` 仍是 `BOUNDED-DEFER` / `V@B=no`。

**2026-11-07 layer-B 增量2（host-free，0 boot，不改任何 ⑧/⑨）**把上一轮 §8 列为“两层都未证明、
被默认为真”的五项全部变为 host-free 有臂，并逐项标明所属层：**create/`createIfAbsent`** =
`M-02` 的 FSB-CREATE-1/2/3（写 lane 宽于读 lane 时新建成功、覆盖已存在目标被 `IO_WRITE_REQUIRES_READ`
在 provider 前拒绝、已存在未读目标被 provider `FS_NOT_OBSERVED` 拒绝）；**binding 车道的
`edit`/`write`/`read_image`** = FSB-BIND-EDIT/WRITE（产品 route-C）与 FSB-BIND-IMAGE（拟议
`binding-post-gap-1`，因 GAP-FS-CONTRACT-1）；**多匹配 `edit`/`replace_all`** = FSB-EDIT-MULTI-1/2；
**流式读取消** = FSB-READ-ABORT；**`read_image` 路由门** = FSB-IMG-4a/4b（4b 证明产品 route-C 下
text-only 拒绝仍先于任何 I/O，且 GAP 的 inject 文本不出现）。**原子替换仍无独立臂**（abort 臂只证
“不发布半成品”）；上述五项**都仍是 host-free 半场**，`M-01`/`M-02`/`M-03` 的 live 状态、`M-04` 的
`BOUNDED-DEFER` / `V@B=no` 均不变。证据=`dev/agent-workflow/evidence/a5sf-fs-face/README.md` §3.2/§8。

### 1.1.1 行 → 能力面归属，与“本行证据满足哪一层”（2026-11-06，**不改任何 ⑧/⑨**）

主矩阵是 9 格定点表（`q5:main-begin/end` 之间的解析器要求每行恰好 9 格），因此**不在主矩阵加
`face` 列**——行归属放在这里，一张表钉死。层定义见 `ALPHA5-SANDBOX-BACKLOG.md` §0.1.2：
**A** = 面 × 权限轴共享安全矩阵；**B** = 逐工具契约；**C** = 冻结候选跨面真 Host。

记法：`A` = 该行被用于面级共享边界矩阵的某条臂（allow / deny / ceiling / 双 Member 不串权）；
`B` = 行级契约（该工具自身行为、错误形状、exit/展示）；`C` = 在冻结候选上的跨面实测；
`†` = 该证据的 **current claim** 已被 Q7 撤回（`#606` 后 `1484fa4ee..HEAD` 28 条产品路径），
证据与结论保留、不作为当前断言；`—` = 没有验收证据，只有披露（`NOT_WIRED`/`UNSUPPORTED` 行）。

| 行 | 工具 | Face | 本行证据满足的层 | 说明 |
|---|---|---|---|---|
| M-01 | read | FS Provider | `A+B+C†` | A：read 轴 in-lane / restriction / ceiling 三臂；B：`readText` 拒绝形状与展示；C：allocation #4 row2 = `BINDING_DENY_ON_READ_PATH` |
| M-02 | write | FS Provider | `A+B+C†` | A：write 轴 in-lane / 越过 binding read lane 的写；B：read-before-write 契约（**非 Team lane**）；C：allocation #4 row4a/4b |
| M-03 | edit | FS Provider | `B` | 仅 host-free（EDIT-1/EDIT-2）；live 从未运行 |
| M-04 | read_image | FS Provider | `B` | 仅 host-free；`BOUNDED-DEFER`（延迟注册 + attachments） |
| M-05 | str_replace_editor | FS Provider | `—` | 机制级 inventory；宿主是否提供未定 |
| M-06 | grep | Subprocess | `A+B+C†` | A：argv 归属 + 声明 root + 准入层 fail-closed；B：exit 0/1/2、非法模式、流、取消；C：allocation #4 |
| M-07 | glob | Subprocess | `A+B+C†` | 同上（同一 confined `subprocess` face） |
| M-08 | bash persistent | Shell-PTY | `B` | 领域状态机 21 臂 + shell-class 准入；**live 零覆盖** |
| M-09 | bash transient | Shell-PTY | `B` | OS runner 机制级；本行契约 live 未跑 |
| M-10 | pwsh | Shell-PTY | `—` | 本机无 Windows 后端（`NOT_WIRED`，`ENV_BLOCK`） |
| M-11 | run_code / PTC | External execution | `—` | 无 routed-native 接入面（BL-19，T-06） |
| M-12 | lsp | External execution | `—` | 无产品接线；启动位置未 trace |
| M-13 | terminal_* | Shell-PTY | `B` | `TERMINALS_LEGACY_PTY_REFUSED` + 端口注入状态机 |
| M-14 | web_fetch | Web | `B` | deny 车道 provider 之前拒绝；`#608` 起行已转发/可配置 `web` face，live 仍未跑（不是“不可达”） |
| M-15 | web_search | Web | `B` | 同上；`GAP-WEB-CONTRACT-1`：真 `{query}` 形状的 fact locator 落在稳定 marker，见 `a5sf-web-face/README.md` §4 |
| M-16 | third-party CLI | Subprocess | `A+B` | A：通用 argv/stdio/cwd 的 OS confinement；`PROBE-GATED` |
| M-17 | stdio MCP | External execution | `—` | `NOT_WIRED` |
| M-18 | remote MCP / HTTP / SSH | External execution | `—` | `UNSUPPORTED` + `TRUSTED_DELEGATION` 披露 |
| M-19 | state tools | Non-data-plane | `—` | 无数据面 I/O，不另设上限（若读写文件须重新归面） |
| M-20 | present / skill / attachment | Non-data-plane | `B` | 来源能力分开；已知不受管 I/O 标 `CONDITIONAL` |
| M-21 | unknown in-process JS | Non-data-plane | `—` | `UNSUPPORTED`（`TRUSTED_ONLY`），不提供伪保证 |

**两处必须说清的缺口（不是新发现，是这次归属让它们可见）：**

1. **A 层目前以测试臂存在，没有以矩阵文档存在。** `a5sf-member-policy.test.ts`、`a5sf-product-assembly.test.mjs`
   （PA5/PA8）、`a5sf-bl16-grep-realm.test.ts` 里的臂就是 A 层的内容，但它们没有被组织成“每面 × 每轴
   一张 allow/deny/refuse-before-side-effect 表”。把臂整理成表是**文档工作，不需要 boot**；
   T-06/T-07/T-08 以及本表 §0.1 的补全属于下一批。
2. **External execution 面与 Non-data-plane 面在 B 层是空的**（除 M-20）。这不是“验收失败”，
   是“没有产品可验收”；把它们记为 `—` 而不是 `NO`，是为了不把“未接线”读成“已限制”。

**本小节不改变任何 ⑧ 等级或 ⑨ `V@B`**：`M-01`/`M-02`/`M-06`/`M-07` 仍是
`ENFORCE-PARTIAL` / `V@B=no`（`#606` 之后），`M-10`/`M-11`/`M-12`/`M-17`/`M-19`/`M-21` 仍是不接线/
不支持，其余不动。`†` 标记的四行与 §1.1 正文的撤回说明是同一件事的两种写法。

**2026-11-07 Subprocess 面 layer B（契约半场，0 boot，不改等级/V@B）**：`M-06`/`M-07` 骑的 confined
`subprocess` face 与 `M-08`/`M-09` 的 shell-class 准入现在有五条 host-free 契约臂（`P1`–`P5` + 真
`bash-local` 边界）在其**产品挂载面**上实测：`mountA5sfRealm` + 真 pinned `LocalSubprocessRuntime`/`bash-local`
+ 真 Landlock provider。证据=`dev/agent-workflow/evidence/a5sf-subprocess-face/README.md`、`suite.log`、
`mutations.log`。**这些臂不构成任何行的 live/level 证据**：`M-06`/`M-07` 仍 `ENFORCE-PARTIAL`/`V@B=no`
（live 树的 `#606` 漂移未重测），`M-08` 仍 `NOT_WIRED`，`M-09` 仍 `NOT_WIRED`；本段只加证据指针。

**2026-11-07 Shell-PTY 面 layer B（契约半场，0 boot，不改等级/V@B）**：该面今天是两层——产品侧 `createTerminalDomainRegistry`（`team-sandbox/src/terminal.ts`，纯生命周期状态机，`PtyHandle` 端口**无写/读/退出状态**）与 pin 住的宿主 `TerminalSessionService`（有 `spawn/send/read/signal/kill/close` 与 exitCode/signal 状态），两者之间**没有 confined terminal face**（`RealmServiceFaces` 无 `terminals` 字段，`GAP-PTY-CONTRACT-1`）。14 条 host-free 臂在其真实挂载面/注入端口上实测分配生命周期、退出状态传播、回收、旧代 PTY 拒用**顺序**、并发身份；证据=`dev/agent-workflow/evidence/a5sf-pty-face/README.md`、`suite.log`、`mutations.log`、`red-first-run.log`。**这些臂不构成任何行的 live/level 证据**：`M-08`/`M-13` 仍 `NOT_WIRED`；真 PTY、OS 级 fd/zombie 观测记 `NOT_REACHED`（README §5 给出 boot 命令）。本段只加证据指针。**2026-11-08 PD-9 正名（仅证据词汇，不改等级/V@B）**：产品 P1 旧称的 "write"/"read" 实为**命令门**（`assertCurrent` 对当前 policy revision 准入/拒绝一个 command request）与 **descendant 审计**（记录 handle 对后代的报告），不是字节通道；`PtyHandle` 无写/读通道。臂名与 README 已改为该词汇，断言未变；证据=`dev/agent-workflow/evidence/a5sf-pty-face/README.md` §3 的 PD-9 correction note。
**2026-11-07 Web 面 layer B（契约半场，0 boot，0 egress，不改等级/V@B）**：`M-14`/`M-15` 骑的 confined
`web` face 现在有五条 host-free 契约性质（10 条臂）在**产品挂载面**上实测：`mountA5sfRealm`（真 pinned
`@deepseek-ai/dsh-tool-web`，route-C 挂载）+ `mountMemberA5sfRealm`（真行）。P1 守护顺序：allowed 调用在
provider 进入时已有一条 guard fact（`factsAtEntry===1`），且 provider 收到**声明** URL 的同一字符串；P2
拒绝措辞：`deny` 的 `NETWORK_UNCONFINED_REALM` 必须命名**能力**（`network-destination` / `unsupported` /
`capability probe`）而**不得**声称任何观测（`observed zero connections` / `no traffic` / `syscalls recorded`
任一出现即该臂 FAIL）；P3 两条 residual 钉成**位置**：provider 内部跟随的 redirect 目标从不重新过 guard，
proxy 选择整体在 provider 下游（face 只传 `(request, signal)` 且不改写环境）；P4 fetch/search **共用**一条
compiled 车道与**同一个** guard 实例（`sequence` 1→2），因此“allow fetch / deny search”**不可表达**（产品
陈述，非测试缺口）；P5 `compiled.web` 与 `a5sfWebFace` 同时存在时在**编写期** fail-closed（两源都点名、
零 provider 调用、sink 未创建），且两条单源路径各自可用。证据=
`dev/agent-workflow/evidence/a5sf-web-face/README.md`、`suite.log`、`mutations.log`、`red-first-run.log`。
**这些臂不构成任何行的 live/level 证据**：`M-14`/`M-15` 仍 `B` / `V@B=no`；本段只加证据指针，并把
`M-14` 原“行不转发 `web` face”的过时说明更正为“live 未跑”。

## 1.2 2026-11-08 定点更正（ALPHA5-CONSOLIDATE；只追加，不改任何历史数字）

**本节不重写上面任何一行。** 上面出现的 `PASS`、`8/8`、`11/11`、`六行全 PASS` 全部**保留原样可见**；
本节只在它们旁边写下“今天它值多少”。四行 `M-01`/`M-02`/`M-06`/`M-07` 的 ⑧/⑨ 一个字符没动
（仍是 `ENFORCE-PARTIAL` / `NEEDS_REVALIDATION` 与 `V@B=no`），因为本轮没有新证据可以把任何一行升级。

### 1.2.1 BL-17 / BL-18 期待 live 证据、实际没有：逐面更正

| 面 | 期待（BL 条目） | 实际发生 | live 半场今天的读法 | 证据 |
|---|---|---|---|---|
| **Shell-PTY**（M-08/M-09/M-13） | BL-17 用 allocation #2/#3 的两次启动测四个 live 问题：同 PTY 多命令、只写不读的读轴拒绝、`chmod` 缺口、`network: deny` 拒绝位置 | boot #3：driver gate 顺序缺陷，`NOT_REACHED` ×4；boot #4：leader 面未覆盖，`team.create` 被 A2C-2 拒，`NOT_REACHED` ×4、**零 model 请求** | **live 半场未证，零 case 到达。** 四个问题一个都没有被观测；本面仍无 confined terminal face（`RealmServiceFaces` 无 `terminals`），真实 PTY 仍是 double | `dev/agent-workflow/evidence/a5sf-bl17-live/README.md` §2/§4；`dev/agent-workflow/evidence/a5sf-bl17-live2/README.md` §2/§6 |
| **Web**（M-14/M-15） | BL-18 用 allocation #5 的**一次**启动测 deny 车道的准入拒绝（一条 guard fact、零 provider entry） | **0 boots**：lane 在 NO-GO 下**没有花**这次 start；只产出 host-free 装配证明、marker mock、两个 bundle | **live 半场未证，零启动。** “deny 车道能挂载并在 face 上拒绝”是 host-free 事实；“真实 Host 上模型调用到达这个 face”没有发生 | `dev/agent-workflow/evidence/a5sf-bl18-live/README.md` §2/§6/§7 |
| **FS Provider**（M-01/M-02） | BL-16 的候选轮本来就要把 FS/Search 的 current claim 在冻结候选树上重新立起来 | allocation #1 `FAIL 9/11`（locator 别名）；allocation #4 `PASS 11/11` | **曾经成立、今天不 current**：`#606` 移动 28 条产品路径，Q7 撤回；`M-01`/`M-02` 记 `NEEDS_REVALIDATION` / `V@B=no` | `dev/agent-workflow/evidence/a5sf-candidate1/README.md` §1–§3；本文件 §1.1 |
| **Subprocess**（M-06/M-07） | 同上（同一轮候选） | 同 FS：11/11 含 search 五案，负控 PROVEN | 同上：`ENFORCE-PARTIAL` / `V@B=no`，需在新树重跑 live 才能再断言 | 同上 |
| **External execution / Non-data-plane** | **BL-17/BL-18 从未对这两个面作出 live 承诺** | — | 不是“BL 失败”，是“这两个面没有可验收的产品接线”：M-11/M-12/M-17/M-18 `NOT_WIRED`/`UNSUPPORTED`，M-19/M-20/M-21 只有契约与披露 | 本文件 §1.1.1；`ALPHA5-SANDBOX-BACKLOG.md` §5/§6 |

**一句话**：BL-17 与 BL-18 的 live 半场都是 **`NOT_REACHED`**，不是 `FAIL`、更不是 `PASS`；
BL-16 的 live 半场曾经 `PASS` 但**当前不成立**。三种状态在同一张表里必须能被区分，这正是本节的用途。

### 1.2.2 为错误的原因报绿的 payload（逐条点名）

| payload | 当时的判词 | 今天的判词 | 为什么是“绿错了原因” |
|---|---|---|---|
| `dev/agent-workflow/evidence/a5sf-bl17-live2/preflight-bundle.json` | **`PASS 16/16`**（boot #4 启动前，`dev/agent-workflow/evidence/a5sf-bl17-live2/README.md` §4） | **`FAIL 15/18` `blocks=BUNDLE_CASE_UNDECLARED`**（`dev/agent-workflow/evidence/a5sf-refusal/README.md` §4/§5） | driver 自己的 `CASES` 字面量声明了 **4** 个 case，bundle 的 `cases` 只列了 **3** 个，`plannedCases` 也被缩到同样 3 个；**被漏掉的正是 `network-deny-refusal`——这次启动要测的那一个**。16/16 是对“不完整计划”的满分 |
| `dev/agent-workflow/evidence/a5sf-bl17-live2/archive/pre-boot-preflight-bundle.json` | **`PASS 16/16`**（启动前冻结的同一计划副本） | **同一个 `FAIL`，同一条缺失 case** | 同一份计划的两个字节副本，同一个洞；archive 不因为被冻结就变成证据 |
| `dev/agent-workflow/evidence/a5sf-bl18-live/preflight-enforced-claim.bundle.json` | **`PASS 17/17`** | 仍 `PASS`，但**它是负控、不是计划** | 它与真话 bundle 只差一个字段：`networkProbeEnforced: true`——一个本机探测（`network-destination: unsupported`）与 §7 同时否定的强制声明。**它的 PASS 证明的是“假声明能过”，不是“计划能过”** |
| `dev/agent-workflow/evidence/a5sf-bl17-live/preflight-bundle.json` | `PASS 13/13`（更小的检查集） | 今天 `UNKNOWN`（不是新 FAIL） | 它没有可被新规则判红的声明；`UNKNOWN` 也不是通过 |

**结论**：**两个 payload、一个计划**曾经是“绿错了原因”（live2 的 `PASS 16/16` 及其 archive 孪生）；
另有 **一个负控**的 PASS 只能靠假声明取得。三者都保留在树里，本文件不删不改它们。

本轮**复跑**（2026-11-08，0 boots，`--host-root` 借只读 pristine 树）复现了上表两行：
`dev/agent-workflow/evidence/a5sf-bl17-live2/preflight-bundle.json` → `FAIL 15/18
blocks=BUNDLE_CASE_UNDECLARED unknown=driver.leader-surface,driver.log-capture`；
`dev/agent-workflow/evidence/a5sf-refusal/bl18-after.bundle.json` → `PASS 18/18`。这是测量，不是引用。

### 1.2.3 什么才算 green preflight（本节是本轮新增的读法约束）

> **green preflight 的意思是：这份“计划”是诚实且完整的，不是“这个行为被验证了”。**
>
> 它检查的是**声明**：cases 是否被完整列出、driver 的 gate 是否排在自己消费的事实之后、
> 模型可见面是否被覆盖、证据路径与身份绑定是否存在、网络声明是否与后端能力一致。
> 它不启动 Host，因此**不能**证明任何 provider 被调用、任何进程被创建、任何字节被读取或拒绝。
>
> 三个直接推论（都由本阶段的实测付出过代价）：
> 1. **PASS 可以对不完整的计划发生**（`PASS 16/16` 漏掉 4 个 case 中的 1 个）；
> 2. **PASS 可以对假声明发生**（`networkProbeEnforced: true` 的负控 `PASS 17/17`）；
> 3. **PASS 不覆盖它没建模的事实**（boot #3 的 gate 顺序、boot #4 的 leader 面，都是 PASS 之后才炸）。
>
> 因此：**矩阵的任何等级不得引用 preflight PASS 作为行为证据**；PASS 只能作为“允许花一次启动”的
> 前置条件。反过来说，`FAIL` 也不等于产品失败——它可能只说明计划里有一句不诚实的话。

## 1.3 2026-11-10 DEV-LIVE 注记（只追加；不改任何 ⑧ / ⑨ / 历史数字 / 上方任何 dated 块）

**记录类别**：`DEV-LIVE` = 真实 Host、隔离 World、面级 `scope: "DEV-LIVE"` authorisation 下**可重复
自授权**的启动（协议 = `docs/DEV-LIVE-OPERATOR-GUIDE.md`；操作约束 = 每机 2 并发、无累计上限）。四个面
共用 **31 次启动**（Web 7 / FS 4 / PTY 9 / Sub 11；逐条账见
`dev/agent-workflow/evidence/a5sf-{fs,sub,pty,web}-devlive/RUNS.md` 与 `LIVE-EVIDENCE-LEDGER.md` §5）。
它是 **live development evidence**，**不是** candidate claim：`CANDIDATE-C2` 需要不可变 SHA +
Authority + Host + Oracle + 独立裁决；`DEV-LIVE` 的 run record 在 finalizer 里会被直接拒绝判为候选
证据，因此它**结构上不可能**产出 `V@B=yes`。

**本节不做什么**：不升级任何等级、**不移动任何 `V@B`**、不关闭 G2–G5、不改上表的等级格。四行
`M-01`/`M-02`/`M-06`/`M-07` 仍是 `NEEDS_REVALIDATION` / `V@B=no`，`M-03` 仍 `ENFORCE-PARTIAL` /
`V@B=no`，`M-08`/`M-09`/`M-13`/`M-14`/`M-15` 仍是 `NOT_WIRED` / `V@B=no`。本轮**没有**做任何
`ENFORCE-PARTIAL` 或等级变更——③–⑤ 与 ⑦–⑨ 的字节未动，只在 ⑥ 末尾追加 dated 指针；⑧ 等级与 ⑨
`V@B` 一个字符未改。
**"live measured" 不是 "enforced"**：本节证明的是机制在真实 Host 上被走到/被拒绝；它**不**证明机制
足以约束成员——PD-12/PD-13 正是后者的反例。

**与 §1.2.1 的并读关系（历史句子保留）**：§1.2.1 写 Shell-PTY "**live 半场未证，零 case 到达**"、
Web "**live 半场未证，零启动**"，M-03 写 "live 半场从未运行"、M-08 写 "live 未证"，§1.1.1 的归属表写
M-03 "live 从未运行"、M-08 "live 零覆盖"、M-14 "live 仍未跑"——这些在各自书写时点都是真的（BL-17 的
两次启动确实 `NOT_REACHED`；BL-18 的 allocation #5 确实没花）。本节**不删、不改**它们，只把它们标记为
历史：它们描述的是 **P2-04 候选池**的那两次/零次启动；`DEV-LIVE` 是**另一条记录类别**在同一面上的后续
测量，既不是对它们的否定，也没有把那次 `NOT_REACHED` 追认成 PASS。

### 1.3.1 FS / Search（M-01 / M-02 / M-03 / M-06 / M-07）

- **稳定 `DEV-LIVE` 结果存在**：证据 = `dev/agent-workflow/evidence/a5sf-fs-devlive/README.md` §2
  （14 行表）与同目录 `RUNS.md`；**run pair = `run-3` / `run-4`**（该 lane 4 次启动共用一个 grant；
  `driver/runs/INDEX.json` 存两表，`driver/ledger.json` 4 条 `DEV-LIVE` 行）。
- **它证明了什么**：**13 PASS / 0 FAIL / 1 NOT_REACHED on 14 rows, stable across two runs**
  （run-3 / run-4 在 reason 粒度逐行相同）；那 1 行是 `read_image`——route 上模型未声明图像输入，
  未到达，不是失败。14 行 = search 6 + FS 5 + edit 2 + `read_image` 1。
- **它没有证明**：零 OS 级观测（没有内核日志、没有独立的第二条读取路径）；`read_image` 在 live 上
  既未被成功调用也未被 lane 拒绝；没有 candidate 树、没有 `V@B`、没有等级变化。
- **行注记**：M-01 / M-02 / M-03 / M-06 / M-07 的 ⑥ 已各加一句指针；⑧/⑨ 一个字未动。

### 1.3.2 Subprocess（M-09；M-06 / M-07 / M-16 同面）

- **稳定 `DEV-LIVE` 结果存在**：证据 = `dev/agent-workflow/evidence/a5sf-sub-devlive/README.md`
  §Q1/§Q2/§Q5 与 `RUNS.md`；**run pair = boot 10 / boot 11**（同 driver sha256、八命题与四 case
  逐条一致；该 lane 共 11 次启动）。
- **它证明了什么**：**the shipped executor serves `bash`**（`SandboxBashExecutor` 在继承的 base
  subprocess service 上执行：1 条 `shell-exec`、带 marker 的 confined provider 调用 0 次、命令在
  OS 进程里被 `/proc` 看到），**and `network: deny` refuses only the face's own calls**（同一 Member、
  同一 lane 的 model-visible `bash` 照跑、`isError=false`，bwrap argv 无 `--unshare-net`）。
- **它没有证明**：没有任何 `enforced` 网络后端（BL-42），所以"离线但可用"仍不可宣称；没有真实出网
  尝试；`network: deny` 在 OS 层没有任何拒绝事实；sandbox root 解析到 pinned host checkout 而不是
  World workspace（PD-14，behavioural divergence）。
- **治理洞后果（PD-12）**：不变式 `EffectiveIo ⊆ MemberCeiling ∩ ToolRestriction` 在 **ceiling
  term** 被破坏——对该 Member 编译出的 ceiling 写着 `network: deny`，但 model-visible 工具集里
  有一个网络能力子进程，因为 ceiling 按 **face** 编译，而 ToolRestriction 把 `bash` 绑定到一个
  从不进入该 face 的 executor；交集算在了一条调用不经过的机制上。**受影响行读法**：M-09（及
  同面的 M-06/M-07/M-16 行）上的"受限"只在**该 face 被调用时**成立，不等于 Member 的 `bash` 被约束。

### 1.3.3 Shell-PTY（M-08 / M-13）

- **稳定 `DEV-LIVE` 结果存在**：证据 = `dev/agent-workflow/evidence/a5sf-pty-devlive/README.md`
  §1/§3a/§3b/§4/§6 与 `RUNS.md`；**run pair = `run-08` / `run-09`**（六个 verdict 与事实逐条相同，
  两跑之间无代码改动；该 lane 共 9 次启动）。
- **它证明了什么**：**a Member's shell is the inherited legacy PTY**（真实 `/dev/pts/0`、`tty_nr`
  与 fd0 设备一致；同 Member 多命令共用一个 shell，`export`/`cd` 存活；第二个 Member 独立
  `pty-2`），**and that path was measured to be outside the realm**（同一个 shell 读了 confined
  write-only lane 声明不可读的文件并返回字节、exit 0；confined face 对同一问题 `IO_READ_DENIED`、
  0 provider 调用、0 字节；该命令的 confined spawn = 0、guard fact = 0）。
- **它没有证明**：仍没有 confined terminal face（PD-3）；真实 PTY 的 **OS 级**行为仍未观测
  （session leader、`SIGKILL` 到进程组、zombie/fd 计数）；`chmod 644→600` 缺口在 live 复现
  （BL-17 `LIVE-REPRODUCED`）但没有声明层；`bash` 的 OS 级隔离仍只有宿主自己的
  `workspace-write` bwrap。
- **治理洞后果（PD-13）**：同一不变式在 **ToolRestriction term** 被破坏——route C 只 shadow 它
  重注册的工具（FS/search 对），`bash` 不在其中，因此 Member 的 `bash` 由 preset 自己的 tool row
  服务、带 preset 的 legacy PTY，**没有任何 lane 被咨询**；ceiling 的读拒绝从未被求值，交集不是
  "算错了"，而是在这条路径上**从未被取**。**受影响行读法**：M-08 / M-13 的"有 shell"是"有宿主
  继承的 shell"，不是"有受管 shell"。

### 1.3.4 Web（M-14 / M-15）

- **稳定 `DEV-LIVE` 结果存在**：证据 = `dev/agent-workflow/evidence/a5sf-web-devlive/README.md`
  §3/§4、`RUNS.md` 与 `two-run-agreement.json`；**run pair = `run-06` / `run-07`**（每个 verdict 与
  决定性事实逐条一致；该 lane 共 7 次启动）。
- **它证明了什么**：**the seam delivers live to a legacy/non-strict Member's own tool call and the
  deny lane refuses at the face with one guard fact and zero provider entries**（两个 legacy Member
  的自己的模型请求 `tools` 同时含 `web_fetch`/`web_search`；模型自己的调用各产生恰一条 typed guard
  fact：`realm: member`、`memberIdentity` = 该 Member 实例、`decidedBy: NETWORK_UNCONFINED_REALM`，
  fetch/search/transport/dns/connect 全零，拒绝文本点名 capability）。
- **它没有证明**：零 OS 级网络观测（所有传输是 recorder，没有 socket、没有 DNS/redirect/代理链）；
  confined web face 的 deny 仍然只是**我们自己的准入拒绝**，不是 isolation；`web_search` 的 locator
  是 `<search:malformed-request>`（PD-10），两条 fact 的 `toolBindingIdentity` 为 `null`。
- **治理洞后果**：PD-12/PD-13 不落在 Web 行上（本面无 terminal / bash 路径），但同一读法适用：
  "deny 在 face 上生效"只说明**这一次调用**被挡，不说明该 Member 的 `web_*` 能力被整体约束。

### 1.3.5 一句话（两个方向都必须成立）

> `DEV-LIVE` 结果证明了**我们的机制在真实 Host 上确实被走到/被拒绝**，没有证明**该机制足以约束成员**——PD-12/PD-13 正是后者的反例：机制工作，但不在调用路径上。

反过来读同样成立：**不能因为 PD-12/PD-13 存在，就把 `DEV-LIVE` 结果读成"什么都没测到"**——四面
的机制确实在真实 Host 上被走到/被拒绝，只是"被走到"不等于"足以约束"。

## 1.4 2026-11-11 BL-42 网络注记（只追加；不改任何 ⑧ / ⑨ / 历史数字 / 上方任何 dated 块）

**记录类别**：BL-42 已作为 **#644** 合入 `origin/master`（`990becb07`）；它的证据是 **host-free 臂 +
本机 OS 实测**，**0 次启动**、无 `DEV-LIVE` 行、无候选分配。它不是 `CANDIDATE-C2`，也不能从这里产出
`V@B=yes`。**本节不升级任何等级、不移动任何 `V@B`**：受影响四行的 ⑧ 与 ⑨ 一个字符未改，只在 ⑥ 末尾
追加了 dated 指针。

**本节不做什么**：不把 `enforced` 读成 `isolated`；不把 lane 的 OS 拒绝读成 Member 的 `bash` 被约束；
不关 G2–G5、不改 `release BLOCKED`、不改 `network: restricted`。`enforced` 是**能力行**的取值，含义只有
一条：这个后端在**本机**被要求拒绝，并且它自己的测量确认了拒绝。它不描述产品里哪个 Member 的哪条调用
会走到这个后端。

### 1.4.1 现在被证明的是什么，由哪个 artefact 证明

- **机制**：每个受限子进程一个非特权 network namespace（`unshare(CLONE_NEWUSER|CLONE_NEWNET)`），由
  launcher 创建、子进程自有；除 down 的 `lo` 外没有接口；继承 socket fd 直接拒绝而不是过滤。证据 =
  `dev/agent-workflow/evidence/a5sf-bl42-netdeny/README.md` §2（`landlock-prelauncher.py` 的
  `enter_netns()` / `--net-leg`）与 `pin-after.log`。
- **观测（不是 argv 里多了一个 flag）**：同一个 launcher 进程先绑 loopback TCP + UDP listener、生成
  nonce，再用同一脚本、同一 argv 跑两个子进程，并在**父进程**读计数：对照子进程 `accepted=1`、
  `datagrams=1`、`nonce_matched=true`；deny 子进程 `accepted=0`、`datagrams=0`、`connect` 与 `sendto`
  均 `ENETUNREACH (101)`，且它自己的 `/proc/self/ns/net` inode 与 host 不同。证据 = 同 README §2、§6 的
  `A1`/`A3`/`A5` 与 `pin-after.log`。
- **probe 诚实性**：只有 `NET-DENY-CONFIRMED` + 非空 mechanism + 两个不同 inode + 对照 TCP/UDP 均带
  nonce 匹配 + deny 计数为零 + 两个 deny errno 都在，capability row 才写 `enforced` 并带绑定
  realm/trustRoot 的 `evidence://` 行；`probeNetworkDenial()` 把「只有 level、没有 mechanism 或没有
  evidence」的 `enforced` 降为 `unsupported`；`evaluateNetworkRequirement('deny', realm, proof?)` 没有
  `NetworkEnforcementProof` 仍返回 `IO_POLICY_UNSUPPORTED`；launcher 对 `network_unenforced`
  fail-closed。证据 = 同 README §3、§5（变异 MA/MB 各自令受保护臂变红）、§6 的 `A2`/`A2b`/`P0`。

### 1.4.2 §7 计数：严格 4/5，宽读 5/5

`dev/agent-workflow/evidence/a5sf-subprocess-face/README.md` §7 的五项，逐项计：

- **严格 4/5**：items 1–4 由 `A2`/`A3`/`A5` 与父进程计数满足；**item 5 的 live Host 半场没有做**。
- **宽读 5/5**：item 5 只在「second consumer path = 第二个产品面」这个更宽的读法下成立——`A5` 的第二个
  消费者是 **PD-13 的 confined terminal face**，与 items 2–4 是**同一个 process face**。README 原文
  要求的「live Host preset」**没有被做**：没有 boot，没有 `DEV-LIVE` 行。

**所以「5/5」不能当作「live Host 半场已证」使用，「4/5」也不能当作「机制未成立」使用。** 两个数字必须
在同一句里出现，并且各自带上缺的那一项。

### 1.4.3 仍然 not entitled 的句子

> **A Member's `bash` cannot reach the network.**

理由（README §7 的 disclosures）：没有 boot、没有 shipped preset 行；`AF_UNIX` pathname socket 在
netns 之外（它是文件系统对象）；继承 socket fd 是**拒绝**而不是过滤；DNS 只作为 loopback 形状的 UDP
传输被测，不证明“DNS 不能解析”；在不允许非特权 user namespace 的 host 上退回旧的准入层拒绝（`P0`
每次重测）；`network: restricted` 未动；没有多用户/敌意测试；receipt 的 applied facts 只在 provider
seam 断言。

### 1.4.4 对本表四行的效果（⑧ / ⑨ 不变）

| 行 | 今天多知道什么 | 仍然不知道 / 不能写 | ⑧ / ⑨ |
|---|---|---|---|
| **M-09 bash transient** | 该行骑的 confined `subprocess` 车道，在本机上可以为 `network: deny` 提供 **OS 级**拒绝：受测 deny 子进程 `connect`/`sendto` 得 `ENETUNREACH`，父进程 listener 计数 0（§7 严格 4/5，宽读 5/5） | 本行的工具仍未绑定（`NOT_WIRED`）；没有 shipped 组合声明该面；0 次启动；不 entitled 写 “A Member's `bash` cannot reach the network.” | `NOT_WIRED` / `no`（未改） |
| **M-08 bash persistent** | 同上机制**可达**该面：`A5` 用 PD-13 的 confined terminal face 驱动同一个 process face，deny 侧 0 连接 | Member 实际拿到的是 preset 继承的 legacy PTY，它在 realm 之外（PD-13），不走这个 netns；0 次启动；不 entitled 写 “A Member's `bash` cannot reach the network.” | `NOT_WIRED` / `no`（未改） |
| **M-14 web_fetch** | 没有新增：BL-42 的 netns 只覆盖 confined 子进程，**不覆盖** service-mediated 的 web face | 本行的 `network: deny` 仍是 **service-level** 准入拒绝；“Web 面被 OS 隔离”仍不可写；0 次启动 | `NOT_WIRED` / `no`（未改） |
| **M-15 web_search** | 同 M-14（fetch/search 共用同一编译车道与同一 guard） | 同 M-14；PD-10 的 locator marker 仍在 | `NOT_WIRED` / `no`（未改） |

**Web 面的一个必须先说的 caveat（不是 BL-42 引入，但 BL-42 让它更接近可构造）**：web face 的 deny
admission 只问**它自己注入的** provider 的 `probe` 是否返回 `enforced`（`web.ts` 调用同一个
`probeNetworkDenial`），而 `enforced` 行的 mechanism/evidence 并没有被**绑定到 web 面**。因此一个把
subprocess provider 的 realm-bound 证明转交给 web provider 的组合，可以让 `network: deny` 的
`web_fetch` 被**放行**到普通 host egress——netns 从来没有覆盖进程内 HTTP。树内没有任何组合这样做
（web provider 的 probe 是 composition-owned，产品路径与全部测试臂仍报 `unsupported`，deny 仍在
provider 之前拒绝），但这是**结构缺口**，不是保证；`a5sf-web.test.mjs` 的 `PROBE-LOAD-BEARING`
臂本身就证明“`enforced` 即放行”。BL-42 不改变本表 Web 行的 ⑧/⑨，也不据此声称 Web 面受管；这条
caveat 的证据边界与本节其余部分相同：**§7 严格 4/5（宽读 5/5）、0 次启动**。

### 1.4.5 一句话（两个方向都必须成立）

> BL-42 让“`network: deny` 车道”第一次可以诚实地写 `enforced`——**因为 OS 被要求拒绝，并且拒绝被测量到**；
> 它没有让“网络隔离”或“Member 的 `bash` 不能上网”变成可写句：§7 严格 **4/5**（宽读 5/5）、**0 次启动**、
> 无 `DEV-LIVE` 行、无 shipped preset。

反过来读同样成立：**不能因为 not entitled 就否认证伪机制**——`A1`/`A2`/`A3`/`A5` 与 MA/MB 变异控制测的
是“机制是否被施加、probe 是否撒谎”，这些是成立的；它们只是不回答“产品里哪条调用会走到该机制”，也不
回答“另一个面借用这个证明是否安全”。

## 1.5 2026-11-12 MEMBER-CONSOLIDATE 注记（opt-in 受治 Member 的 live turn；只追加；不改任何 ⑧ / ⑨ / 历史数字 / 上方任何 dated 块）

**记录类别**：`DEV-LIVE` —— 真实 Host、隔离 World、面级 `scope: "dev-live"` authorisation 下**可重复
自授权**的启动。证据 = `dev/agent-workflow/evidence/a5sf-live-member/README.md`（run pair =
`runs/boot01` / `runs/boot02`，head `11991c2d4`，`agreement.txt` 两次 `agreeing=true differing=[]`）与
`dev/agent-workflow/evidence/a5sf-governed-preset/README.md`（shipped preset 行 + 两次 boot/config 级
pair）。它是**开发证据**，不是 candidate claim：run record 自述 `candidateClaimEligibility.eligible=false`、
`DEV_LIVE_EVIDENCE_NOT_CANDIDATE`；`CANDIDATE-C2` **未运行**，它**结构上不可能**产出 `V@B=yes`。

**本节不做什么**：不升级任何等级、不移动任何 `V@B`、不关闭 G2–G5、不改 `release BLOCKED`、不改任何
历史字节。受影响行只在 ⑥ 末尾追加 dated 指针；`M-14`/`M-15`（Web）**明确不变**，未加指针。
**"opt-in 受治 Member 能工作"不是"Members 已受治"**：默认 preset（`standard`）一个字节未改，shipped
layer 不点名任何 preset，没有任何 Team 自动进入 realm，而且**大多数 Member 仍在默认路径上**。

### 1.5.1 现在为真的是什么（真实 Host，两次一致）

- **入口是 operator 的显式 opt-in**：Team 行带 `memberPresetId: a5sf-governed-member`（并
  `a5sfGovernedRealm: true`）时，`#648` 的 shipped preset 行把该 Member 的 `bash` 交给 confined
  terminal face；默认值仍是 `standard`，不写这两个键的 Team 走原路径（`G2c`：非 opt-in v3 行仍
  mount nothing）。
- **一个真实的 Member turn 发生过**：Leader 经产品自己的 `team_delegate` 激活 Member
  （`inst-0htk69p0jfud`、`ADMISSION_OPEN`、`workSettled: true`、`memberResult.status: succeeded`），
  Member 在**自己的 durable transcript**（`member-session.v4.jsonl.zstd`）里跑了两条 `bash` 命令。
- **两个结果都在 Member 自己的日志里**：in-lane 读返回 lane 字节
  （`A5SF_LIVE_MEMBER_IN_LANE_BYTES`，`kind: confined-terminal`、`exitCode: 0`）；out-of-lane 读返回
  typed `IO_READ_DENIED`、**0** secret 字节——拒绝在准入层，该命令**没有** spawn（没有
  `confined-terminal` 记录）。guard facts 恰 **1 ALLOW + 1 DENY**（`shellRead` in-lane `allow`、
  `shellRead` out-of-lane `deny`/`IO_READ_DENIED`），身份是该 Member 实例。
- **精确计数器**（两次 boot 相同，`counters.json`）：**1** 次 confined-provider launch 服务 **2** 条
  命令（`confinedTurnLaunchers=1`）、带夹具的 base bwrap **0**（`baseBwrapWithMarkers=0`）、
  `payloadInLaneSightings=0`、`procSecretCommandSightings=0`、`memberModelRequests=3`、
  非夹具的 `otherBwrapPids=1`。`preflightLaunchers`（3 / 5）是 attach 期探针，**被排除**、不是
  agreement 行。
- **它逼出了一个真实产品缺陷并已修复**：activation 在耐久写 `MemberInstance` 行**之前**创建 child
  session，realm 在 live 创建窗口读到 `lifecycle=undefined`，于是**每个** live 受治 Member 都被
  `AUTHORITY_REFUSED` 拒绝（`MEMBER_POLICY_UNAVAILABLE`）。修法 = 只承认 `freshCreate` 窗口
  （`lifecycle === undefined && freshCreate === true`）、**耐久行永远优先**（`ARCHIVED`/`DISPOSED`
  拒绝，`CREATED`/`RUNNING`/`SETTLED` 承认）、负控臂 `G5c` 钉住；pinned Host 未被触碰，
  `CORE PATCH BUDGET = 0`。
- **启动账（读 ledger，不猜）**：该 lane 自己的 `run-ledger.jsonl` 记 **17** 次 dev-live 启动——15 次
  在修复前树 `dc4f26fea`、2 次在修复后树 `11991c2d4`；因此阶段 dev-live 启动总数 **31 → 48**
  （Web 7 / FS 4 / PTY 9 / **Sub 28**）。本注记本身 **0 boots**、只追加文档。

### 1.5.2 逐行效果（⑧ / ⑨ 一个字符未改）

| 行 | 一个 opt-in 受治 Member 今天在真实 Host 上能做什么 | 仍然不能写 | ⑧ / ⑨ |
|---|---|---|---|
| **M-08 bash persistent** | `bash` 是 confined terminal face：**每条命令一个 fresh confined child**，in-lane 读返回字节、out-of-lane 读 `IO_READ_DENIED` 且 0 字节；**持久 shell 不提供**（产品组合臂 `G7` 以 `TERMINALS_DOUBLE_TERMINAL_REFUSED` 拒绝双终端，0 legacy 分配）。**默认 preset 的 Member 既没有这个 face，也没有持久受管 shell。** `DEV-LIVE`、no `V@B`。 | 同 PTY 多命令/cwd 存活/前后台/信号与超时不适用（face 每命令 fresh）；`timeoutMs`、后台 job、sandbox 升级在这个面上不存在；真实 PTY 的 OS 级行为仍未观测。 | `NOT_WIRED` / `no`（未改） |
| **M-09 bash transient** | Member 的 **model-visible `bash`** 由 confined terminal face 服务：1 次 confined-provider launch 服务 2 条命令、带夹具的 base bwrap 0、`payloadInLaneSightings=0`、`procSecretCommandSightings=0`。**默认 preset 的 Member 仍走宿主继承的执行体，既没有 confined face，也没有读轴 lane。** `DEV-LIVE`、no `V@B`。 | 本行 `ctx.shell` 的瞬态路径仍未绑定到这个 face；`network: deny` 未在 OS 层证明；动态 shell 读（`$(…)`/反引号）不拒；PD-5 / BL-39 不变。 | `NOT_WIRED` / `no`（未改） |
| **FS Provider（`M-01` read / `M-02` write）** | 这一对 in-lane/denied **只走读轴**，而且是 **`bash` 中介的读**（`shellRead`/`spawn` guard facts），不是原生 `read`/`write` 工具：in-lane 返回 lane 字节，out-of-lane 返回 `IO_READ_DENIED` 且 0 字节。`DEV-LIVE`、no `V@B`。 | 原生 `read`/`write` 的等级与 `V@B` 不动；**write 没有被走到**，写 lane、原子替换、read-before-write 未在这条路径上测；PD-5（route-C 下 `read_image` 不可用）不变。 | 未改 |
| **M-14 / M-15（Web）** | **明确无变化**：本 lane 没有驱动任何 `web_fetch`/`web_search` 调用；受治 preset 只是原样保留 web 行，Web 面没有任何新增 live 证据；不追加 ⑥ 指针。 | "Web 面被 OS 隔离"仍不可写；BL-42 的 netns 不覆盖进程内 web transport。 | `NOT_WIRED` / `no`（未改） |

**编号说明（报告冲突，不抹平）**：任务简报把 fs read/write 写作 `M-12`，但本矩阵的 `M-12` 是 **lsp**
（`NOT_WIRED`）；fs read/write 是 **`M-01`/`M-02`**。本节按矩阵编号写，`M-12` 未被触及。

### 1.5.3 仍然 not entitled 的句子

> **"Members are governed."**

默认 preset 未变，shipped layer 不点名任何 preset，大多数 Member 在默认路径上；受治路径要求 operator
在两个键上显式 opt-in，且**没有 Team 自动进入 realm**。同样不能写："Member's shell cannot read out of
lane"——动态 shell 读（`$(…)`/反引号）不可词法归因、准入层不拒绝，只有 authored locator 被判定
（PD-13 的弱点仍在）；不能写"per-Team scratch isolation"（`NOT_WIRED`，scratch root 是 Host 路径，
`A5SF_GOVERNED_SCRATCH` 可覆盖）；不能写网络隔离（受治 preset 只声明 `network: allow`，收窄 lane 在
assembly 期以 `NETWORK_UNCONFINED_REALM` 拒绝，无 netns 声明；BL-39 / PD-5 不变）。

### 1.5.4 一句话（两个方向都必须成立）

> 一个**显式 opt-in** 的 Team，可以在真实 Host 上让受治 Member 的 `bash` 读 in-lane 字节、拒 out-of-lane
> 读且 0 字节外泄，两次一致——这是 `DEV-LIVE`、no `V@B`；它**不是**"Members 已受治"：默认 preset 一个
> 字节未改，大多数 Member 仍在它上面。

反过来读同样成立：**不能因为默认路径未变，就把这次 Member turn 读成"什么都没发生"**——机制第一次在
真实 Host 上走上了一个 Member 的调用路径，并且它逼出的 activation-window 缺陷是真实的、已修的、有负控的。

### 1.5.5 2026-11-13 勘误（ARGV-ERRATA）：`payloadInLaneSightings=0` 曾被读成"命令正文在 argv 里不可见"（只追加；不改任何 ⑧ / ⑨ / 等级 / 历史数字 / 上方任何 dated 块）

**记录类别**：Docs-only + 引用一份 `DEV-LIVE` 侦察证据；**0 boots、0 产品代码改动**。本节**只追加**，
§1.5.1 与 §1.5.2 的原句一字未改（它们保留为历史），更正以本块为准。

- **旧断言（错，本矩阵两处引用过）**：§1.5.1 的计数器段（本文件 `:467`）与 §1.5.2 的 `M-09` 行
  （本文件 `:485`）把 `payloadInLaneSightings=0` 并列进"精确计数器"，其上游解释是
  `dev/agent-workflow/evidence/a5sf-live-member/README.md` §5 的原句："the confined terminal writes
  the command text to a PTY, so the command never appears in any process's `argv`"。**该解释是错的**，
  因此把它当"payload 不可见"的证据也是错的。
- **代码**：`packages/runtime/team-services/src/terminal.ts:535` = `argv: [program, '-c', text]`，
  `:538` = `stdio.stdin: 'ignore'`；命令正文**在** shell 子进程 argv 里，没有 PTY 可写
  （`confined-pty-N` 只是 `terminal.ts:489` 的 label；实测 `ptyHolders=0`）。
- **实测**：Face C 侦察（PR **#660**，分支 `recon/c-shell-20261113`，`DEV-LIVE`、`eligible=false`、
  候选 SHA `235e1af8b`、宿主 `639ed01539`）在同一受限终端面两 boot：`runs/boot01/counters.json`
  `payloadInLaneSightings=3`、`runs/boot02/counters.json` `=2`（该报告 §D-1 散文写 2 / 1，
  以 JSON 捕获为准），且子进程 cmdline 明含 `<world>/workspace/in-lane.txt`；
  同两 boot `ptyHolders=0`、`baseBwrapWithMarkers=0`。
- **正确结论**：**受治 Member 执行的命令正文，对同机其它进程可见**（`/proc/<pid>/cmdline`，0444）。
  这是**一条必须披露的进程列表泄漏面**；它**不是** lane 隔离的失败——in-lane/out-of-lane 判定、
  `IO_READ_DENIED`、0 字节外泄、`baseBwrapWithMarkers=0`、launcher 计数全部不受影响，
  本节**不移动任何等级或 `V@B`**。任何"受治 = 命令不可见"的读法都必须撤回。
- **对 §1.5.1 / §1.5.2 的引用约束**：`payloadInLaneSightings=0` 只能读作"本轮采样未捕到"
  （采样间隔约 240 ms，短命 `bash` 子进程会被漏抓），**不得**再作为"payload 不可见"的支持证据；
  `M-09` 行的真 witness 仍是 `confinedTurnLaunchers=1` 与 `baseBwrapWithMarkers=0`，这两项不变。
- **计数器判断**：`payloadInLane` 测的正是"命令正文出现在某进程 argv 里"，**计数器是对的、结论是错的**；
  但它在 driver 里被当成**精确相等的 agreement 行**（`run-boot.mjs` 的 `buildAgreement` `keys`），
  而一次诚实的 sighting 计数必然随采样抖动，于是该项配置在系统性地奖励 0。**未来该看**：
  可见性 = `payloadInLaneSightings >= 1` 的布尔（记录项，不作精确相等行）；"跑过没有" = `confinedTurnLaunchers`。
  本轮只改 `run-boot.mjs` 的归因**注释**，不改采样逻辑、judge 或 agreement 行。

## 1.6 2026-11-13 FINAL-DOCS 注记：标了治理、却没有机制（只追加；不改任何 ⑧ / ⑨ / 历史数字 / 上方任何 dated 块）

**记录类别**：进程内证据（0 boots；真实产品模块、Host 调用的同一 seam）+ 本注记本身 Docs-only。证据 =
`dev/agent-workflow/evidence/a5sf-window-hunt/README.md`（`origin/master` = `1f2011c73`，PR #651，base
`ff04b6f41`）。本节**不改一个等级、不移动一个 `V@B`、不关闭任何门、不删任何证据**。

### 1.6.1 (a) 本轮的新发现：label-without-mechanism（标签在、机制不在）

- **一句话**：一行可以**合法地**写着 `a5sfGovernedRealm: true`，却让 Member 跑 preset 继承的、**不受限的 `bash`**。
- **为什么"合法"**：`schemaVersion: 4` 的 blueprint 可以声明一个**没有 `memberIoCeilings` 条目**的 Member
  模板——parser 只要求每条 ceiling 的 `templateId` 能解析，不要求每个模板都有 ceiling（实测）。对这样的
  Member，`createGovernedRealmProvider(...).compiledFor(...)` 答 `undefined`。
- **窗口**：`packages/runtime/src/plugin/live/a5sf-realm-row.mjs:858-880` 在 governed 行上**原本**只在
  "provider 缺失"时拒绝；`compiledFor` 答 `undefined` 时 `mountMemberA5sfRealm` 直接 `return undefined`，
  `packages/runtime/src/plugin/live/agent-bindings.mjs` 因此跳过 route-C shadow（`if (a5sfRealm !== undefined)`），
  Member 跑上继承执行体。**爆炸半径 = 一个标签为受治的 Member 在跑不受限的 `bash`，而它自己的行仍写着
  `a5sfGovernedRealm: true`。** 这是"声明的 confinement 没被挂上"（declared-but-unmounted）这一类，不是新机制。
- **修法**：复用**已有的** typed `REALM_DECLARATION_INVALID`（同一条"declared-but-unmounted confinement"
  法条，原先用于 provider 缺失），只加一个条件；没有新模块、没有 Host patch、没有默认值变化。
  **ungoverned 行字节不变**：`undefined` 仍等于"没有 realm"（legacy 路径）。
- **RED→GREEN pin**：`tests/world-factory/a5sf-window-taxonomy.test.mjs` **W3b**——两模板 blueprint、ceiling
  只覆盖 `worker`、以 `sidekick` 挂载 ⇒ 必须 `REALM_DECLARATION_INVALID`，且 base 子进程 spawn **0**。
  修复前实测 RED（`Missing expected rejection`），修复后 GREEN。
- **默认路径可达性（明确回答，不假设）**：**No，默认路径不可达。** `governedRealmProvider` 只在
  `resolvedRowConfig.a5sfGovernedRealm === true` 时构造（`packages/runtime/src/plugin/host.ts:2142-2149`）；
  挂载只在 `a5sfRowConfig !== undefined && a5sfRealmProvider !== undefined` 时进入
  （`packages/runtime/src/plugin/live/agent-bindings.mjs:2598`）；shipped layer 保留 `standard` 为部署默认、
  不点名该 preset、也不写这两个键（`cordis.patch.yml:146-156`）。因此默认 `standard` 行既没有 provider
  也没有 row config，挂载根本不进入；ungoverned 行的 `undefined` 是**设计上的 legacy 路径**
  （`a5sf-realm-row.mjs:870-880`），它**不作任何治理声明**。该发现只在**显式 opt-in** 的 Team 上可达：
  该 Team 同时写 `memberPresetId: a5sf-governed-member` 与 `a5sfGovernedRealm: true`，而其 v4 blueprint
  有一个没有 ceiling 的模板。
- **它不证明**：这不让 preset 本身变成"会 confinement"；也不让任何默认 Member 进入 realm。

### 1.6.2 (b) window 表的裁决（每窗一行）

| # | 窗口（组件先于耐久事实被问/挂载） | 裁决 |
|---|---|---|
| **W1** | 激活窗口：realm 在 `MemberInstance` 行之前问 authority | **按设计关闭，且只经一个具名例外** `freshCreate`（live glue `bindPath === 'fresh-member'`）；耐久行永远优先，cold/state 无行一律拒绝 |
| **W2** | 模板/persona 投影在行之前读 roster | **同一个具名例外**；两个消费者现在都调用导出的 `freshCreateHintAdmits`，不再依赖调用顺序 |
| **W3** | 工具面先于 provider 挂载；governed 行但 provider 编译不出 realm | 顺序**按顺序关闭**（先挂 provider、deny 之后才挂 shadow）；`undefined` 答案**按拒绝关闭**——即本轮新发现 W3b |
| **W4** | capability 行先于 probe 结果 | **按拒绝关闭**：挂载时不作任何 capability 声明；缺失/抛出/拒绝/无 mechanism+evidence 的 `enforced` 全判 `unsupported`，绝不默认放行 |
| **W5** | guard 先于 policy revision | **按拒绝关闭**：没有 revision 的编译策略在 install 期被拒；guard 的咨询事实带的就是那个 revision |
| **W6** | skill/config identity 先于 config 行 | **按拒绝关闭**：没有 `templateId` 在 authority 读取之前 `MEMBER_IDENTITY_INVALID`，不猜 ceiling |

仍**明知开放**的一条：**crash-resume 顺序**（`createChildSession` 先于 `ensureDurable`）——它 fail-closed
（cold 路径拒绝），但不能重开 fresh-create 窗口，因此一个 PREPARED 操作需要 operator 才能收敛；证据
README §5 已披露，本注记不改变它。

### 1.6.3 (c) 一个套件的夹具顺序被改成与产品一致

`tests/world-factory/a5sf-governed-preset.test.mjs` 原先默认 `state = { generation: 0, lifecycle: 'RUNNING' }`，
**在行已存在之后挂载**——与产品顺序相反，因此看不见 #649。现在默认 `lifecycle: undefined` 并按
`host.ts:2109-2139` 转发 `freshCreate`，套件**在窗口内**挂载，仍 14/14；新增 **G5d** 钉住顺序本身
（先无行 → 窗口内挂载成功 → 挂载后写入的行被 cold re-attach 读到 → 再删行则 cold 拒绝）。两个源码文本
pin 只是**增加**了那个新导出符号，断言没有删弱。**夹具时序比生产更宽松**由此成为仪器史第 11 条，
**标签与机制分离**是第 12 条（报告附录 D）。

### 1.6.4 (d) 本注记不改什么

**不改任何 ⑧ 等级、不改任何 `V@B`、不关闭 G2–G5、不改 `release BLOCKED`、不删任何证据、不改任何历史数字。**
`M-08`/`M-09` 仍是 `NOT_WIRED` / `V@B=no`；本注记只在它们的 ⑥ 末尾加一条 dated 指针。`DEV-LIVE` 的边界
不变：它是开发证据，`CANDIDATE-C2` 未运行，结构上不可能产出 `V@B=yes`。仍未被证的清单一字未改：
network deny 在 OS 层、动态 shell 读（`$(…)`/反引号）、per-Team scratch isolation、PD-5、BL-39。

> **必须连读的一句**：**一个声称受治的 Member 不会静默地不受治运行**——前提是它**通过 shipped opt-in 行**
> 作出这个声称；默认路径不作这个声称，所以这句话不能被读成"Members 已受治"。

## 1.7 2026-11-14 POSTFIX-DOCS：受治 / 不受治 / 不在面（只追加；不改任何 ⑧ / ⑨ / 历史数字）

**记录类别**：docs-only，**0 boots**、0 产品代码改动。本节只把**已有** `DEV-LIVE` 与 host-free 证据
按同一口径重数一遍；**不新造测量**、**不升级任何等级**、**不移动任何 `V@B`**、不关闭 G2–G5、
`release BLOCKED` 不变。对象是 **shipped opt-in 受治 preset** `a5sf-governed-member`
（`cordis.patch.yml:191`），不是默认 `standard`，也不是 §1 主矩阵的逐工具等级表。

### 1.7.1 口径（与 `a5sf-recon-review` §1 同一口径，先写死再数）

- **受治** = 模型可见工具的执行经过 confined face，**且**产生 `a5sf-guard-consult/1` fact。
- **表面存在但不受治** = 名字在 Member 的 model-request `tools` 里、可被模型调用，执行时 **0** 条 a5sf fact。
- **完全不在面** = 名字不在 `tools` 里（模型无法命名）。
- **面上名册** = `dev/agent-workflow/evidence/a5sf-pd18-web-ptc/runs/boot02/member-surface.json` 的
  `tools` 数组（PD-18 之后的真实 Host Member 请求，**40 名**；其中 `u5_canary` / `u6fs_probe` 是
  World 组合的**测试夹具**，不是 shipped 工具名）。同一次 boot 的 standard Leader 面 =
  `runs/boot02/leader-surface.json`（**43 名**）。
- **失败层级**（本节新增的列，用来回答“哪一层拒绝的”，不是等级）：`L0 router` = 宿主工具路由
  （typed `UNKNOWN_TOOL`，零执行）；`L1 admission` = a5sf guard 在 provider / 进程之前；`L2 host-tool
  gate` = pinned 宿主工具自身的门（`read_image` 的模型路由门、base `ctx.web` 的 SSRF 策略）；
  `L3 OS/process` = 内核边界（Landlock / netns），**只对 confined 子进程成立**；`none` = 该调用路径上
  没有任何 a5sf 层。

### 1.7.2 三个数字（本轮自己数，不照抄任务简报）

| 桶 | 数量 | 构成（逐名） | 依据 |
|---|---|---|---|
| **受治**（confined face + fact） | **7** | `bash`；`read` / `write` / `edit` / `read_image`；`grep` / `glob` | `confined-terminal-tool.mjs` + `confined-fs-tool.mjs:99` + `confined-search-tool.mjs:91`；名册 = pd18 boot02 `member-surface`，执行 = PD-16/PD-17 的 `DEV-LIVE` + host-free 臂 |
| **表面存在但不受治**（0 a5sf fact） | **33** | `team_*` **15** + 产品原生 **16** + World 夹具 **2** | 40 − 7；15 个 `team_*` 有自己的 request-token/envelope 平面，不能读成“无授权” |
| **完全不在面** | **13** | 从未在面 **10**（`run_code`、`lsp`、`str_replace_editor`、`pwsh`、`terminal_open/send/read/signal/close/list`）+ PD-18 fail-closed **3**（`web_fetch`、`web_search`、`workflow`） | `tool-surface.json` 的 removed 行 + `member-surface.json` 的 `closedNames`；MCP 族 **0 名**（shipped `mcpServers: []`） |

**面上合计 = 40 = 7 受治 + 33 不受治**；**总名册 = 53 = 40 面上 + 13 不在面**。若剔除 2 个 World
夹具，shipped 读数是 **38 面上 / 7 受治 / 31 不受治**，三个桶的差不变。
**与 2026-11-13 独立复审（`a5sf-recon-review` §1，被测树 `235e1af8b`、pre-PD-16/17/18）比**：
受治 **1 → 7**、表面存在但不受治 **42 → 33**、完全不在面 **10 → 13**（+3 就是 PD-18 的 fail-closed
移除），面上名册 **43 → 40**（standard Leader 面仍 43；复审 §1 的 10 名清单在 `master` 上仍成立）。
这不是等级升级：7 个受治里只有 `read_image` 的 live 调用是 `NOT_REACHED`，其余 6 条有
`DEV-LIVE` 执行证据；全部 7 条都仍是 **no `V@B`**。

### 1.7.3 现状表（每行一个工具或一个具名族；族行逐一列出名字）

| 工具名 | 在受治 Member 面上？ | 执行走 confined face？ | 产 fact？ | 失败层级 | 依据（PR + 证据路径 + file:line） |
|---|---|---|---|---|---|
| **bash** | 是 | 是：confined terminal face，每条命令一个 fresh confined child | 是（`shellRead` / `spawn`；PD-19 后带 `tool` + `callId`） | **L1**：读轴在 `spawn` 前；动态 shell 读（`$(…)`/反引号）不可词法归因 ⇒ 该子路径**不受治**；本 preset 声明 `network: allow`，无 L3 网络层 | #640/#642；`dev/agent-workflow/evidence/a5sf-live-member/README.md`、`.../a5sf-pd18-web-ptc/runs/boot02/member-surface.json`；`cordis.patch.yml:206`、`a5sf-realm-row.mjs:994`、`terminal.ts:535` |
| **read** | 是 | 是：confined `fs` face | 是（`stat` / `readText`） | **L1**：provider 调用之前（越界 0 字节 + typed `IO_READ_DENIED` + 1 deny fact） | #664；`a5sf-pd17-fs/README.md` D1/D2/A1；`confined-fs-tool.mjs:99`、`a5sf-realm-row.mjs:1100`、`a5sf-realm-row.mjs:1292` |
| **write** | 是 | 是：confined `fs` face | 是（`writeText`） | **L1**：写轴准入；另保留原生 read-before-write 契约（**L2**，属宿主工具、不是 Team lane） | #664；`a5sf-pd17-fs/README.md` D3/A2/A4 |
| **edit** | 是 | 是：confined `fs` face | 是（`stat` + `readText` + `editText`） | **L1**：读写两轴分别准入；版本守卫在 provider 内（**L2**） | #664；`a5sf-pd17-fs/README.md` D4/A3 |
| **read_image** | 是（仅当附件服务挂载） | 是（host-free：confined `fs` face 注册可见子集） | host-free：**D5 deny 有 1 条 `IO_READ_DENIED` fact**；A5 allow 只证 face 行为（未单列 allow fact）；**live：否**（`NOT_REACHED`：模型路由未声明图像输入，0 attachment saves、0 fs allow fact） | **L2** route gate（live 在 face **之前**拒绝）；越界时 **L1**（D5：1 条 deny fact，0 字节） | #664；`a5sf-pd17-fs/README.md` §7 + A5/D5；`confined-fs-tool.mjs:99` |
| **grep** | 是 | 是：confined `subprocess` face（真 `rg` + launcher） | 是（`spawn` allow / deny） | **L1**：任何进程存在之前（`spawns=0→0`、1 条 deny fact、0 字节）；模型看到的错误文本仍是宿主包的 provider 失败措辞 | #661；`a5sf-pd16-search/README.md` D1/D2/A1；`confined-search-tool.mjs:91`、`:155`、`a5sf-realm-row.mjs:1035` |
| **glob** | 是 | 是：同一个 confined `subprocess` face | 是（`spawn`） | **L1**：同 grep（`spawns=0→0`、1 条 deny fact） | #661；`a5sf-pd16-search/README.md` D3/A5 |
| **team_***（15：`team_archive_member`、`team_collect`、`team_create_member`、`team_delegate`、`team_follow_up`、`team_grant_permission`、`team_inspect_config`、`team_list_members`、`team_list_pending_control`、`team_list_templates`、`team_report_progress`、`team_request_control`、`team_resolve_control`、`team_revoke_permission`、`team_send_message`） | 是 | 否 | 否（不产 a5sf fact） | `none`（a5sf 平面）：它们走 Team 自己的 request-token / envelope 授权，不是“无授权” | `a5sf-recon-review/README.md` §1 #2；矩阵 §1.1.1 / M-19 |
| **state / goal / job / ask / message**（12：`ask_user_question`、`create_goal`、`exit_plan_mode`、`get_goal`、`interrupt_agent`、`job_kill`、`job_list`、`job_output`、`list_agents`、`send_message`、`todo_write`、`update_goal`） | 是 | 否 | 否 | `none`：无数据面 I/O 或走宿主服务，本阶段不另设数据面上限 | 矩阵 §1.1.1 / M-19；`a5sf-pd18-web-ptc/runs/boot02/member-surface.json` |
| **subagent / subagent_fork** | 是 | 否 | 否 | `none`（a5sf 平面）；**子 realm 装配 UNMEASURED** | `a5sf-pd18-web-ptc/README.md` §2.6（代码读，不是 boot 测量） |
| **present / skill** | 是 | 否 | 否 | `none` / **L2 host service**：`skill` 正文读取是真实目录读，**无 a5sf 中介**；`present` 走宿主服务 | `a5sf-pd18-web-ptc/README.md` §2.6；矩阵 M-20 |
| **u5_canary / u6fs_probe**（World 夹具，非 shipped） | 是（仅测试 World） | 否 | 否 | `none`：测试夹具 | `tests/world-factory/lib/world-factory.mjs:65`、`tests/world-factory/lib/u6-fs-assembly.mjs:31`；`member-surface.json` |
| **web_fetch** | **否**（PD-18 fail-closed 移除） | 否 | 否（0 执行） | **L0 router**：typed `UNKNOWN_TOOL`，0 provider entry、0 字节；**这不是“已受治”，是能力回退** | #668；`a5sf-pd18-web-ptc/README.md` §1/§2.1；`cordis.patch.yml:162` |
| **web_search** | **否**（同上） | 否 | 否（0 执行） | **L0 router**：同上 | #668；`a5sf-pd18-web-ptc/README.md` §1/§2.1 |
| **workflow**（PTC） | **否**（PD-18 fail-closed 移除） | 否 | 否（0 执行；`ptcRuntimeInMemberWindow=0`） | **L0 router**：typed `UNKNOWN_TOOL`，无 PTC 子进程；**能力回退** | #668；`a5sf-pd18-web-ptc/README.md` §1/§2.2；`cordis.patch.yml:162` |
| **run_code** | 否（PTC display name；standard 面也没有） | 否 | 否 | 结构性不在面：无 routed-native 接入面（`NOT_WIRED`） | #668；`a5sf-pd18-web-ptc/README.md` §2.3；矩阵 M-11 |
| **pwsh** | 否 | 否 | 否 | 结构性不在面：Windows-only 第二 shell，PD-18 前已从受治 preset 移除 | `cordis.patch.yml:160`；`a5sf-governed-preset/tool-surface.json`（removed `tool-pwsh`） |
| **lsp** | 否 | 否 | 否 | 结构性不在面：模块在 pinned host、产品零接线（`NOT_WIRED`） | `a5sf-pd18-web-ptc/README.md` §2.4；矩阵 M-12 |
| **str_replace_editor** | 否 | 否 | 否 | 结构性不在面：模块存在但不在产品 preset、未进 `a5sfNativeToolModules`（`NOT_WIRED`） | 矩阵 M-05；`NATIVE-SOURCE-INVENTORY.md` §2/§3 |
| **terminal_open / terminal_send / terminal_read / terminal_signal / terminal_close / terminal_list**（6） | 否 | 否 | 否 | 结构性不在面：受治 preset **没有** `dsh-terminal` / persistent-shell 行（双终端会以 `TERMINALS_DOUBLE_TERMINAL_REFUSED` 拒绝整个 realm） | #668；`a5sf-pd18-web-ptc/README.md` §1；`cordis.patch.yml:156-190` 的 SURFACE 注释 |
| **MCP 族**（`mcp__*` / `list_mcp_resources` / `list_mcp_resource_templates` / `read_mcp_resource`） | 否（**0 名**） | 否 | 否 | 结构性不在面：shipped `mcpServers: []` | `a5sf-pd18-web-ptc/README.md` §2.5；`cordis.patch.yml` 的 `mcpServers: []` |

### 1.7.4 这张表不说什么（必须与数字同读）

1. **失败层不是隔离层。** 7 条受治路径的拒绝都在 **L1 admission**；L3 只描述 confined 子进程上的
   OS 边界（BL-42 的 netns / Landlock），**不是** Member 级网络隔离。受治 preset 的 `network: allow`
   没有收窄，`network: deny` 的 OS 层结论仍不可写（BL-39 / BL-42 的 live Host 半场未做）。
2. **fail-closed ≠ 已受治。** `web_fetch` / `web_search` / `workflow` 的 `UNKNOWN_TOOL` 是**能力回退**，
   不是这三个工具被 confined face 管住了；`standard` preset 仍然声明它们（`tool-surface.json` 的
   `declaration.removed` 只在受治 preset 生效）。
3. **“产 fact”是机制事实，不是 candidate 事实。** PD-19 把 `tool` + `callId` 加到 fact 上，host-free
   臂只实测了 `read`（FA1/FA2/FA6）；PD-19 §6 明说 **live 归因半场未测**。因此“6 条路径产可归因事实”
   是**结构上**成立（carrier 在 `tools/execute` 上、不读决策），不是每条都有 live 归因证据；
   pre-PD-19 的历史 fact 仍然不可归因。
4. **两个未测项原样。** `read_image` 的 live 调用 `NOT_REACHED`；`subagent` 子 realm 装配
   UNMEASURED；动态 shell 读、`skill` 正文读、per-Team scratch isolation 仍不在受治面内。
5. **没有 `V@B`。** 本节所有数字都是 `DEV-LIVE`（可重复、`eligible=false`）或 host-free 证据，
   **结构上不可能**产出候选级 `V@B`；矩阵 ⑧/⑨ 一格未动。

> **2026-11-14 CORRECTION（PD-24 SURFACE-LEDGER，只追加；§1.7 原文一字未改）**：§1.7.3 把 `present`
> 写成「走宿主服务、不另设数据面上限」、把 `ask_user_question` 记作「无数据面 I/O」，两处都只是**未测量**
> 的措辞，已被实测推翻（`present` 是 BASE `fs` 上的越界静默成功 + 存在性 oracle，0 条 a5sf fact；
> `ask_user_question` 不拒绝而是**阻塞**一个 delegated 回合）。**逐行账本、五个桶的恒等式、以及 34 名
> 名册的完整归属见 §1.8**；本节的历史数字（7 / 33 / 13、40 名）保留不动，只作时点读数。

## 1.8 2026-11-14 PD-24 SURFACE-LEDGER：受治 Member 面账本（dated）

**记录类别**：`DEV-LIVE`（真实 Host + shipped opt-in preset `a5sf-governed-member` + 真实 delegated
Member 回合，pinned host `639ed015397290b3745d163aafe02ffee4aa3f84`；lane base `6cfc67b76`，pre-fix 与
ask 两对 boot 跑在 base 上、post-fix 一对跑在 lane head `13c0c33f3` 上，组合内容相同）＋ host-free
（0 boots 的 5 臂套件 + 4 臂 mutation controls）＋ **派生账本**（`build-ledger.mjs` 从 boot 产物重算，
自检恒等式与名册覆盖，不合格就拒绝写出）。**不改任何 ⑧ 等级、不改任何 `V@B`、不关闭 G2–G5、不改
`release BLOCKED`、不删 §1.7 的任何历史数字与行文**——§1.7 原文一字未删，本节只在 §1.8.0 追加一条
dated CORRECTION 指针。

**为什么需要这一节**：§1.7 用「受治 / 表面存在但不受治 / 不在面」三分，把 33 个非受治名整体写成
「无数据面 I/O 或走宿主服务，本阶段不另设数据面上限」。那是**未测量**的措辞，不是测量结论——其中
**10 个名字从来没有被单独判过**。owner 的问题不是再讲一遍三分，而是「**到底有多少真正可用的受治
原生工具**」。答案必须能逐行核，所以本节的主产物是**账本**：`ledger.json`（机器可读，每行内联它
的实测证据）、`ledger.txt`（同一批行的表）、`roster.json`（每次 boot 的实测名册）。数字由脚本从
boot 产物重算，不是手打；脚本在名册移动、桶计数与行数不符、或出现未分类名字时**拒绝写出**。

### 1.8.0 CORRECTION（对 §1.7 的 dated 修正；只追加，不改原文）

1. **§1.7.3 的 `present / skill` 行把 `present` 写成「走宿主服务、本阶段不另设数据面上限」——错。**
   实测：`present` 的 preset 行挂在**注册代 scope**，它取到的是 **BASE `fs`**；`ctx.fs.stat` **接受**了
   真实越界路径（`Presented …/out-of-lane/secret-out-of-lane.txt`），缺失路径回 `file not found`（存在性
   oracle），**0 条** `a5sf-guard-consult` fact，同时 **2 条** `deliverables/presented` 落在 Member 自己的
   session。已 fail-closed 移除（§1.8.5）。
2. **§1.7.3 的 `state / goal / job / ask / message` 行把 `ask_user_question` 记作「无数据面 I/O」——不完整。**
   它不越界（不写 Team 状态、不产 `user/questions`），但**阻塞**：调用发出后 60 s 观察窗内无 tool result、
   无 `turn/end`；开发首 boot 上同步委派把 `team.create` 挂了 **300 s**（§1.8.4）。
3. **§1.7.2 的「33 = team_* 15 + 产品原生 16 + World 夹具 2」是 40 名名册上的读数。** 名册在此之后缩过：
   **40 →（PD-21/22 delegation 组 −5）→ 35 →（PD-23 `skill` −1）→ 34 →（PD-24 `present` −1）→ 33**。
   本节用 **34 名**（pre-fix）口径，与 §1.7 不矛盾，只是时点不同；每个差值都在 §1.8.2 的恒等式里。

### 1.8.1 口径与名册来源（先写死再数）

- **本节被审计的名册 = pre-fix 的 34 名**，取自 `dev/agent-workflow/evidence/a5sf-pd24-surface-ledger/archive/pair-prefix/boot01|02/member-surface.json`
  （两次 boot 逐字相同）。post-fix 名册 **33 名**取自 `runs/boot01|02/member-surface.json`（两次逐字相同）；
  差值恰为 `present` 一项。
- **面上名册**仍然是**模型请求里的 `tools` 数组**，不是 preset 声明——`present` 的移除必须有模型请求
  侧的读数才算数。
- **World 夹具** `u5_canary` / `u6fs_probe` 如实披露，但**不计入** shipped 行（与 §1.7 同口径）。
- 每行判定列固定为：**桶 / 在面 / 调用会做什么 / 作用域 / 产 fact / 越界时是 typed 拒绝还是静默成功 /
  依据**。
- **失败层级**沿用 §1.7.1 的闭集（`L0 router` / `L1 admission` / `L2 host-tool gate` / `L3 OS` / `none`）。
- **`DEV-LIVE` 边界不变**：boot 不是合并证据，`CANDIDATE-C2` 未跑，结构上不可能产出 `V@B=yes`。
  本节所有数字 `eligible = false`。

### 1.8.2 五个桶、恒等式、以及两个读数

| 桶 | 数量 | 名单（逐名） | 判定依据 |
|---|---|---|---|
| **GOVERNED**（confined face + fact） | **7** | `bash`、`read`、`write`、`edit`、`read_image`、`grep`、`glob` | 一次 Member 回合产 **9 条** allow fact：`bash` 3、`read` 2、`write`/`edit`/`grep`/`glob` 各 1；`read_image` 的 live 分支在 **route gate** 被拒（`model "deepseek-v4-flash" does not declare image input`），face 行为只有 host-free 证据 |
| **SESSION-LOCAL**（只写自己 session） | **9** | `todo_write`、`job_list`、`job_output`、`job_kill`、`get_goal`、`create_goal`、`update_goal`、`exit_plan_mode`、`ask_user_question` | 逐条实测见 §1.8.3 / §1.8.4；无一条写 Team 状态 |
| **OTHER-AUTHZ**（`team_*`，另一授权平面） | **15** | `team_archive_member`、`team_collect`、`team_create_member`、`team_delegate`、`team_follow_up`、`team_grant_permission`、`team_inspect_config`、`team_list_members`、`team_list_pending_control`、`team_list_templates`、`team_report_progress`、`team_request_control`、`team_resolve_control`、`team_revoke_permission`、`team_send_message` | 不产 a5sf fact；自己的 request-token/envelope 授权（`TEAM_RUNTIME_CALLER_AUTHORITY_DENIED` 等）。**本 lane 未测未改** |
| **FAIL-CLOSED**（typed `unknown tool`，零执行） | **11** | 册上 1：`present`（PD-24）；册外 10：`send_message`、`interrupt_agent`、`list_agents`、`skill`、`subagent`、`subagent_fork`、`web_fetch`、`web_search`、`workflow`、`pwsh`（PD-18/21/22/23） | 一次 Member 回合内逐名调用，全部 `isError=true` + `unknown tool "<name>"`，零副作用 |
| **UNMEASURED**（名字级） | **0** | —（无） | 3 个**分支**未测（§1.8.6），但没有一个名字未分类 |

**恒等式（两个读数必须同时成立）**：

```
7 (GOVERNED) + 9 (SESSION-LOCAL) + 15 (OTHER-AUTHZ) + 11 (FAIL-CLOSED) + 0 (UNMEASURED) = 42
42 = 32（shipped 在册名） + 10（更早已移除、不在册的 10 名）
名册：34（pre-fix 实测） = 32（shipped 在册） + 2（World 夹具）
post-fix：33 = 31 shipped + 2 夹具     （差 = `present`）
FAIL-CLOSED 的 11 = 册上 1（`present`） + 册外 10
```

一句话：**42 个名字全部有归属，零遗漏、零重复**；这 42 个 = 32 个曾经在面上的 shipped 名 + 10 个更早
被移除的名字。任务里说的「剩下 27 条还没判过」= 32 shipped − 7 受治 + 2 夹具 = **27**（其中 15 条是
`team_*`，本次按指令不判、只归类）。

### 1.8.3 逐行账本（脚本生成，`ledger.txt` 同内容）

| 工具名 | 桶 | 在面 | 调用会做什么 | 作用域 | 产 fact | 越界行为 | 依据（证据） |
|---|---|---|---|---|---|---|---|
| ask_user_question | SESSION-LOCAL | 是 | asks the human answerer; BLOCKS until an answer arrives (legacy mode has no timeout) | 本 session (its own turn) | 否 | measured in its own arm: NO result inside the observation window (60 s here, 300 s on the first development boot), no `turn/end`, the Member's turn stays open; no Team state is written and no `user/questions` event appears | live: member-probes.json |
| bash | GOVERNED | 是 | one fresh confined child per command (confined terminal face) | Member lane (compiled read/write ceiling) + OS sandbox for the child | 是（3） | typed refusal at admission (no child) | live: member-probes.json |
| create_goal | SESSION-LOCAL | 是 | opens a goal in the calling session and ARMS its self-continuation round driver | 本 session | 否 | n/a — measured: accepted, then round 1 of `<goal_round>` arrives in A's own session | live: member-probes.json |
| edit | GOVERNED | 是 | confined `fs` face: stat + readText + editText through the realm provider | Member lane (read+write ceilings) | 是（1） | typed IO_*_DENIED | live: member-probes.json |
| exit_plan_mode | SESSION-LOCAL | 是 | presents a plan and leaves plan mode — only when plan mode is ACTIVE for the calling session | 本 session | 否 | measured (inactive branch): `exit_plan_mode is only available in plan mode`, no `plan/mode` event | live: member-probes.json |
| get_goal | SESSION-LOCAL | 是 | reads the CALLING session's goal projection | 本 session | 否 | n/a — `{"goal":null}` before create; the goal it later reads is A's own | live: member-probes.json |
| glob | GOVERNED | 是 | confined search face: ripgrep `--files` inside the confined child | Member lane (read ceiling) | 是（1） | typed refusal | live: member-probes.json |
| grep | GOVERNED | 是 | confined search face: ripgrep runs inside the confined child | Member lane (read ceiling) | 是（1） | typed refusal | live: member-probes.json |
| job_kill | SESSION-LOCAL | 是 | cancels a job the CALLING session owns (none can exist here) | 本 session (owner-scoped registry) | 否 | measured: same typed refusal; the Leader's job kept running | live: member-probes.json |
| job_list | SESSION-LOCAL | 是 | reads the OWNER-scoped job registry; no producer exists on this preset | 本 session (owner-scoped registry) | 否 | `belongs to another session` / `unknown job <id>` | live: member-probes.json |
| job_output | SESSION-LOCAL | 是 | reads a job the CALLING session owns (none can exist here) | 本 session (owner-scoped registry) | 否 | measured: `belongs to another session` for the Leader's real job id | live: member-probes.json |
| present | FAIL-CLOSED | 否（pre-fix 是） | PRE-FIX: resolved paths with the BASE `fs` and appended a `deliverables/presented` event to the CALLING session — above the compiled read lane | host filesystem (base `fs`), no ceiling of its own | 否 | PRE-FIX: silent success (no typed refusal, no fact). POST-FIX: typed `unknown tool "present"` — zero execution | live: member-probes.json |
| read | GOVERNED | 是 | confined `fs` face: stat + readText through the realm provider | Member lane (read ceiling) | 是（2） | typed IO_READ_DENIED | live: member-probes.json |
| read_image | GOVERNED | 是 | confined `fs` face (same provider as `read`) — but ONLY if the model route declares image input | Member lane (read ceiling) | 是（0） | route gate: `model "…" does not declare image input`; below it, typed IO_READ_DENIED | NOT_REACHED live: the measured model route (deepseek-v4-flash) declares no image input, so the tool never reaches the face. The confined-face behaviour is host-free evidence only. |
| team_archive_member | OTHER-AUTHZ | 是 | Team tool plane: its own request-token + envelope authorization (NOT the a5sf confined face) | Team | 否 | typed Team refusal (e.g. TEAM_RUNTIME_CALLER_AUTHORITY_DENIED / envelope denial) |  |
| team_collect | OTHER-AUTHZ | 是 | Team tool plane: its own request-token + envelope authorization (NOT the a5sf confined face) | Team | 否 | typed Team refusal (e.g. TEAM_RUNTIME_CALLER_AUTHORITY_DENIED / envelope denial) |  |
| team_create_member | OTHER-AUTHZ | 是 | Team tool plane: its own request-token + envelope authorization (NOT the a5sf confined face) | Team | 否 | typed Team refusal (e.g. TEAM_RUNTIME_CALLER_AUTHORITY_DENIED / envelope denial) |  |
| team_delegate | OTHER-AUTHZ | 是 | Team tool plane: its own request-token + envelope authorization (NOT the a5sf confined face) | Team | 否 | typed Team refusal (e.g. TEAM_RUNTIME_CALLER_AUTHORITY_DENIED / envelope denial) |  |
| team_follow_up | OTHER-AUTHZ | 是 | Team tool plane: its own request-token + envelope authorization (NOT the a5sf confined face) | Team | 否 | typed Team refusal (e.g. TEAM_RUNTIME_CALLER_AUTHORITY_DENIED / envelope denial) |  |
| team_grant_permission | OTHER-AUTHZ | 是 | Team tool plane: its own request-token + envelope authorization (NOT the a5sf confined face) | Team | 否 | typed Team refusal (e.g. TEAM_RUNTIME_CALLER_AUTHORITY_DENIED / envelope denial) |  |
| team_inspect_config | OTHER-AUTHZ | 是 | Team tool plane: its own request-token + envelope authorization (NOT the a5sf confined face) | Team | 否 | typed Team refusal (e.g. TEAM_RUNTIME_CALLER_AUTHORITY_DENIED / envelope denial) |  |
| team_list_members | OTHER-AUTHZ | 是 | Team tool plane: its own request-token + envelope authorization (NOT the a5sf confined face) | Team | 否 | typed Team refusal (e.g. TEAM_RUNTIME_CALLER_AUTHORITY_DENIED / envelope denial) |  |
| team_list_pending_control | OTHER-AUTHZ | 是 | Team tool plane: its own request-token + envelope authorization (NOT the a5sf confined face) | Team | 否 | typed Team refusal (e.g. TEAM_RUNTIME_CALLER_AUTHORITY_DENIED / envelope denial) |  |
| team_list_templates | OTHER-AUTHZ | 是 | Team tool plane: its own request-token + envelope authorization (NOT the a5sf confined face) | Team | 否 | typed Team refusal (e.g. TEAM_RUNTIME_CALLER_AUTHORITY_DENIED / envelope denial) |  |
| team_report_progress | OTHER-AUTHZ | 是 | Team tool plane: its own request-token + envelope authorization (NOT the a5sf confined face) | Team | 否 | typed Team refusal (e.g. TEAM_RUNTIME_CALLER_AUTHORITY_DENIED / envelope denial) |  |
| team_request_control | OTHER-AUTHZ | 是 | Team tool plane: its own request-token + envelope authorization (NOT the a5sf confined face) | Team | 否 | typed Team refusal (e.g. TEAM_RUNTIME_CALLER_AUTHORITY_DENIED / envelope denial) |  |
| team_resolve_control | OTHER-AUTHZ | 是 | Team tool plane: its own request-token + envelope authorization (NOT the a5sf confined face) | Team | 否 | typed Team refusal (e.g. TEAM_RUNTIME_CALLER_AUTHORITY_DENIED / envelope denial) |  |
| team_revoke_permission | OTHER-AUTHZ | 是 | Team tool plane: its own request-token + envelope authorization (NOT the a5sf confined face) | Team | 否 | typed Team refusal (e.g. TEAM_RUNTIME_CALLER_AUTHORITY_DENIED / envelope denial) |  |
| team_send_message | OTHER-AUTHZ | 是 | Team tool plane: its own request-token + envelope authorization (NOT the a5sf confined face) | Team | 否 | typed Team refusal (e.g. TEAM_RUNTIME_CALLER_AUTHORITY_DENIED / envelope denial) |  |
| todo_write | SESSION-LOCAL | 是 | appends a `todo/write` event to the CALLING session only | 本 session | 否 | n/a — measured: only A's session carries `todo/write`; the Leader and every other session carry none | live: member-probes.json |
| update_goal | SESSION-LOCAL | 是 | mutates the calling session's own goal (pause/complete/edit) | 本 session | 否 | n/a — measured: `complete` accepted on the goal round (`roundsStarted` 1 → 2) | live: member-probes.json |
| write | GOVERNED | 是 | confined `fs` face: writeText through the realm provider | Member lane (write ceiling) | 是（1） | typed IO_WRITE_DENIED | live: member-probes.json |
| interrupt_agent | FAIL-CLOSED | 否 | nothing: the row is absent from the governed preset (removed by PD-18/21/22/23) | n/a (not nameable by the model) | 否 | typed `unknown tool "<name>"` — zero execution | live: member-probes.json |
| list_agents | FAIL-CLOSED | 否 | nothing: the row is absent from the governed preset (removed by PD-18/21/22/23) | n/a (not nameable by the model) | 否 | typed `unknown tool "<name>"` — zero execution | live: member-probes.json |
| pwsh | FAIL-CLOSED | 否 | nothing: the row is absent from the governed preset (removed by PD-18/21/22/23) | n/a (not nameable by the model) | 否 | typed `unknown tool "<name>"` — zero execution | live: member-probes.json |
| send_message | FAIL-CLOSED | 否 | nothing: the row is absent from the governed preset (removed by PD-18/21/22/23) | n/a (not nameable by the model) | 否 | typed `unknown tool "<name>"` — zero execution | live: member-probes.json |
| skill | FAIL-CLOSED | 否 | nothing: the row is absent from the governed preset (removed by PD-18/21/22/23) | n/a (not nameable by the model) | 否 | typed `unknown tool "<name>"` — zero execution | live: member-probes.json |
| subagent | FAIL-CLOSED | 否 | nothing: the row is absent from the governed preset (removed by PD-18/21/22/23) | n/a (not nameable by the model) | 否 | typed `unknown tool "<name>"` — zero execution | live: member-probes.json |
| subagent_fork | FAIL-CLOSED | 否 | nothing: the row is absent from the governed preset (removed by PD-18/21/22/23) | n/a (not nameable by the model) | 否 | typed `unknown tool "<name>"` — zero execution | live: member-probes.json |
| web_fetch | FAIL-CLOSED | 否 | nothing: the row is absent from the governed preset (removed by PD-18/21/22/23) | n/a (not nameable by the model) | 否 | typed `unknown tool "<name>"` — zero execution | live: member-probes.json |
| web_search | FAIL-CLOSED | 否 | nothing: the row is absent from the governed preset (removed by PD-18/21/22/23) | n/a (not nameable by the model) | 否 | typed `unknown tool "<name>"` — zero execution | live: member-probes.json |
| workflow | FAIL-CLOSED | 否 | nothing: the row is absent from the governed preset (removed by PD-18/21/22/23) | n/a (not nameable by the model) | 否 | typed `unknown tool "<name>"` — zero execution | live: member-probes.json |

### 1.8.4 三个焦点问题（逐条给实测答案）

**(a) blocking？** 只有 `ask_user_question` 会**阻塞**，而且它不是「拒绝」：

| 观察 | 读数 |
|---|---|
| 调用是否发出 | 是（`call-a5sfpd24-ask`，在 Member 自己的 durable session 里） |
| 60 s 观察窗内有无 tool result | **无**（`ask-blocked.json#result = null`） |
| `turn/end` | **0**（回合仍然开着） |
| `user/questions` 事件 | **0**（问题没有进入任何队列） |
| Team 状态 | 成员数仍为 2（Leader + worker），无写入 |
| 先行的 in-lane `bash` 控制 | `isError=false`（证明不是整个面卡住） |

`exit_plan_mode` **不阻塞**：plan mode 未激活时返回 `Error: exit_plan_mode is only available in plan mode`，
不产 `plan/mode` 事件，回合继续。`todo_write` / `get_goal` / `create_goal` / `update_goal` / `job_*`
都不阻塞。

**(b) Team-level state？** 三个焦点工具**都不写 Team 级状态**：`todo_write` 只落 `todo/write` 到调用者
自己的 session（Leader 的 session 里没有）；`get_goal`/`create_goal`/`update_goal` 只碰调用者自己的
goal；`exit_plan_mode` 不写任何 Team 对象；`ask_user_question` 连问题事件都不写。成员数在整轮前后都是 2。

**(c) `job_*` 无 producer？** 是，且实测为**正确行为**：`job_list` 回 `(no background jobs)`（本 preset 上
confined face 无法把命令交给 job registry，所以 Member 永远没有自己的 job）；`job_output`/`job_kill` 拿
**Leader 真实存在的 job id**（`bash-1`）去调，两个都回 `Error: job bash-1 belongs to another session`，
Leader 的 job 继续运行。owner-scoped + typed 拒绝 ⇒ 保留，不构成漏洞。

**(d) goal 族：能不能建立并启动自续轮？** 能，而且**只在 Member 自己的 session 里**（本轮只测这个，
不改 goal 语义，那是 PD-25 的 remit）：

```
create_goal          -> {"phase":"active","roundsStarted":0,"maxGoalRounds":2},"activation":"armed"
<goal_round> 到达    -> mock 在 A 自己的 session 里被再次请求
get_goal（轮内）     -> {"phase":"active","roundsStarted":1,...}
update_goal complete -> {"phase":"complete","roundsStarted":2},"activation":"disarmed"
```

`counters.goalRounds = 2`（两次 `<goal_round>` 请求），`goalRoundsInOtherSessions = 0`，Leader 与另一个
session 的事件类型里没有任何 goal 事件。**结论**：自续循环真实存在、可启动、可停止，作用域是
「本 session」。

**(e) 清单之外的名字**：`u5_canary`/`u6fs_probe` 是 World 夹具（`{"ran":true}` / `{"spoofCount":0}`）；
`read_image` 的 live 分支卡在模型路由门（见 §1.8.6）；`bash` 的**动态读**子路径（`$(…)`/反引号）仍是
L1 的已知边界（不可词法归因），本节没有把它算成受治——探针 `cat` 的是字面 in-lane 路径。

### 1.8.5 动了什么、没动什么

**只动了一条**：`cordis.patch.yml` 的受治 preset 删掉 `present` 一行（`- id: present` /
`'@deepseek-ai/dsh-tool-present'`）。

- **为什么是删除而不是接进 confined face**：`present` 的 `fs` 来自 preset 行所在的注册代 scope，而 Member
  的 confined provider 是 Member isolate 里的 **fork**——没有任何组合层行能拿到那个 fork 的 `fs`。要接进去
  需要新的 route-C 产品行 + realm-bound provider face（`confined-present-tool` 挂在 `a5sf-realm-row` 上）
  + 自己的 allow/deny 契约测试，属于新能力面，本阶段无预算且 `CORE PATCH BUDGET = 0`。这是一个
  **`CORE_SEAM_BLOCKER`**（与 PD-23 的 `skill` loader 同一 seam）。
- **能力回退（披露）**：受治 Member **不能再申报 deliverable**。这不是 enforce，是回退；恢复需要上面那个
  seam。已登记为 PD-24，并在 §1.8.7 复述。
- **没动 `team_*`**：另一授权平面，按指令不测不改。
- **没动 goal 语义**：只测「能否启动自续轮」，`maxGoalRounds`、pause/edit/complete、轮驱动一字未改。
- **没动 `ask_user_question`**：它阻塞但不越界，本 lane 的处置规则只对「静默成功且越界」的行动手；阻塞
  作为独立缺陷披露（§1.8.4a），待裁决。

**post-fix 的同一个 Member 回合读数**：名册 33、`present` 不在面上（`presentOnSurface=false`）、调用回
typed `Error: unknown tool "present"`、任何 session 都 **0** 条 `deliverables/presented`、`present` 的
fact 数 **0**；`bash`/`read`/`write`/`edit`/`grep`/`glob` 的 9 条 allow fact 与 pre-fix 完全一致。

### 1.8.6 UNMEASURED：0 行 / 3 个分支（缺什么，写清楚）

| 行 | 未测分支 | 缺什么才能测 |
|---|---|---|
| `read_image` | live 执行（route gate → confined face） | 一个**声明支持图像输入**的模型路由。实测路由 `deepseek-v4-flash` 在 face 之前就拒绝；face 行为目前只有 host-free 证据（PD-17 D5：1 条 `IO_READ_DENIED`、0 字节） |
| `exit_plan_mode` | plan-mode-**active** 分支 | 一个能在 **delegated** Member session 上把 `plan/mode` 置为 active 的 seam。`/plan` 是 session 级用户命令，Team 工具面没有 command 路由 |
| `ask_user_question` | **被回答**的分支 | 一个绑定到 Member session 的（真人或脚本）answerer。对 delegated 回合可达的只有「无 answerer」分支——也正是这里要紧的那一支 |

`team_*` 不是「未测」而是**不在 remit**：另一授权平面、已有表征、本 lane 不得测也不得改。

### 1.8.7 这张账本不说什么（必须与数字同读）

1. **boot 不是合并证据。** `DEV-LIVE`，`candidateClaimEligibility=false`，本节不产出任何 `V@B`。
2. **受治 ≠ 已隔离。** 7 条受治路径的拒绝都在 **L1 admission**；L3 只描述 confined 子进程上的 OS 边界。
3. **`read_image` 的 live 分支仍未测**（§1.8.6），不要把它读成「7 条都有 live 执行证据」——是 **6 条**。
4. **`present` 的移除是能力回退**，不是「已受治」；`standard` preset 仍然声明 `present`（受治行删除，不是
   产品删除）。
5. **`ask_user_question` 的阻塞是真的**：一个受治 Member（或同步等它的 Leader）可以把自己的回合永久挂住。
   本节只披露，不修。
6. **`bash` 的动态读子路径不受治**（L1 已知边界），本节未把它算进受治。
7. **一个 Host、一个模型路由、一种 workspace 形状**：换路由只影响 `read_image` 的 live 分支。

### 1.8.8 证据与复现

- 账本：`dev/agent-workflow/evidence/a5sf-pd24-surface-ledger/ledger.json` / `ledger.txt` / `roster.json`
  （由 `build-ledger.mjs` 从 boot 产物生成，含 pre-fix 与 post-fix 组成、`presentDefect`、`askHazard`、
  `unmeasuredResiduals`、driver/composition 摘要）。
- 三对 agreeing boots：`runs/`（post-fix，12/12 PASS）、`archive/pair-prefix/`（pre-fix，12/12 PASS）、
  `runs-ask/`（阻塞臂，各 1 例 PROVEN）；每对都有 `agreement.json`（逐字段比对；**进程观测计数**
  `confinedTurnLaunchers`/`baseBwrapWithMarkers` 只作观察，不参与一致性判定——第一对 pre-fix 因它们
  被判不一致，已重跑并把旧目录留在 `archive/prefix-*` 而不隐藏）。
- 方法、逐行解释、mutation controls、residuals：`evidence/a5sf-pd24-surface-ledger/README.md`。
- host-free：`tests/world-factory/a5sf-pd24-surface-ledger.test.mjs`（PIN / SURFACE-CLOSED /
  SURFACE-POSITIVE-CONTROL / SURFACE-SURGICAL / TYPED-REFUSAL / LEDGER-IDENTITY）+
  `tests/world-factory/a5sf-pd24-mutation-controls.mjs`（CLEAN、M1 注册可分派的 `present`、M2 读回
  pre-fix 组合、PIN 各验证自己的颜色）。
- 复现命令见 evidence README §8；pre-fix 组合由 `git show 6cfc67b76:cordis.patch.yml` 取出，不是手改。

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
| G1 | P1 机制级证据（`evidence/a5sf-p1-01/`、`evidence/a5sf-p1-02/`、`evidence/a5sf-p1-03/`、`evidence/a5sf-p1-04/`、`evidence/a5sf-p1-05/`、`evidence/a5sf-p1-06/`、`evidence/a5sf-p1-07/`、`evidence/a5sf-p1-08/`、`a5sf-g1/G1-GATE-REPORT.md`）；工具级：`read`/`write`/`grep`/`glob` 均在冻结候选 `1484fa4ee` 上实测过（read 11/11 含 row2、write row4a/row4b、grep 6/6 + 无 realm 负控、glob 两臂），但**合并 `#606` 后该树的 claim 已失效**（28 条产品路径移动，含 `subprocess.ts`/`mount.ts`/`install.ts`/`bl16-grep-realm` 测试），故四行现记 `NEEDS_REVALIDATION` / `V@B=no`，见 §1.1；`edit` = `ENFORCE-PARTIAL`（host-free，live 未跑）、`read_image` = `BOUNDED-DEFER`，其余仍 `NOT_WIRED` |
| G2 | BL-14 至 BL-20 代表机制正向与基本拒绝；**host-free 机制半场**已有 FS 证据（`a5sf-s1/`、`a5sf-assembly/`、`a5sf-p0/`、`a5sf-deferred/`），**live 半场**已执行：六行 2026-11-04 8/8 PASS（`a5sf-preflight/README.md` §13），覆盖 `read`/`write`；`edit` 的 live 半场仍未跑 |
| G3 | BL-22 至 BL-26 逐工具正向等价与最小权限负控（来源清单见 `NATIVE-SOURCE-INVENTORY.md`） |
| G4 | BL-27 至 BL-34 全工具与 I/O 维度矩阵 |
| G5 | BL-35 至 BL-37 对抗、故障、发布双验收 |

**本表当前结论**：G1 机制级 = 有证据；FS 工具级 = `read`/`write` 的 live 半场已实测（2026-11-04，
8/8 PASS，head `44babbfcf`），`edit` 仍只有 host-free 半场，`grep`/`glob` 的 host-free 半场与
2026-11-05 live 半场均已实测（BL-16：越界搜索在任何进程存在前被 typed 拒绝且有 guard fact；
第十次 boot 六行全 PASS），`read_image` 为条件性 `BOUNDED-DEFER`，其余工具级仍 `NOT_WIRED`；
G2 至 G5 = 未完成。2026-11-05 的 candidate-1 在**新 baseline 树**上实测（allocation #1 + 拆别名 fixture 的 allocation #4）得到
11/11，四行曾全部复位为 `V@B=yes`；随后合并 `#606`（28 条产品路径移动，含 grep/glob 的子进程面与 read/write 的
service 面）使四行按 Q7 回到 `NEEDS_REVALIDATION` / `V@B=no`——结论保留于被测树，current claim 需要新树 boot。
REFUTED 曾出现的成因是两条 lane 共用同一 fixture locator（装配缺陷，非产品放宽），**这不是 release coverage**：
不得把任一 `NOT_WIRED`、`ENFORCE-PARTIAL` 或 `NEEDS_REVALIDATION` 读作能力已交付。

## 附录 A — live 验收的事实来源（2026-11-04）

第一份**在真实 Host 上全绿**的工具级验收：`dev/agent-workflow/evidence/a5sf-preflight/README.md`
§13（8/8 PASS，head `44babbfcf`，三个专用 P2-01 start 全部花在该轮，池储备未动）。

2026-11-05 的 **candidate-1 冻结轮**与其后的 **allocation #4 retry**：`dev/agent-workflow/evidence/a5sf-candidate1/README.md`
（#1 = 9/11、`overall=FAIL`，两行 REFUTED 且诊断为同一 fixture locator 的别名；#4 = **11/11、`overall=PASS`**，
只拆 fixture、两个判官 blob 字节未变、产品树 tree/blob 逐项等于冻结候选 `1484fa4ee`）。两轮各一次 start，
port 3184，共享 BL-14 ledger 共 4 行（2 intent + 2 boot，`boot2` 区分 #4），累计花费 `2/5`、0 abort。

2026-11-05 合并 `#606`（`a5bd88b85`，confined web 面）后，上述 11/11 的被测树与将合并的树分离：`1484fa4ee..HEAD`
漂移 28 条产品路径（含 `team-services/src/subprocess.ts`、`mount.ts`、`install.ts` 与 `a5sf-bl16-grep-realm.test.ts`），
四行按 Q7 回到 `NEEDS_REVALIDATION` / `V@B=no`；`origin/master` 单独跑同一 gate 为 pass，合并树为 fail（归因见 §1.1）。

可复用的判定事实（不是结论，是原始 sink）：

```
binding  stat allow a.txt     binding  readText allow a.txt
binding  stat deny  b.txt     binding  stat deny   c.txt
binding  stat allow w4a.txt   binding  readText allow w4a.txt
member   writeText allow w4a.txt   member writeText allow b.txt
```

即：**读路径的所有咨询都落在 binding realm，写 fact 全部落在 ceiling realm**，且没有任何 write
fact 越到读 lane。`V@B=yes` 的含义就是这个——"binding realm 上的约束被实测验证"——**不**指上面
⑤ 列的全部最低验收项都已覆盖（原子替换仍无独立臂；大文件窗口/流式、版本冲突、create/`createIfAbsent`、binding 车道 `edit`/`write`/`read_image`、多匹配 `edit`/`replace_all`、流式读取消、`read_image` 路由门自 2026-11-07 起有 host-free 臂，见 `dev/agent-workflow/evidence/a5sf-fs-face/`，但 live 状态不变）。

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
