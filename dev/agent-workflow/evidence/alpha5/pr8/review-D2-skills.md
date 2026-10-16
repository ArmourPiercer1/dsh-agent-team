# review-D2-skills — D-2 落文独立审查件（reviewer 4dac3d04 名义执行代理，qwen3.8-flash-next）

- **对象**：`origin/alpha5-d2-skills` @ `90dc56a6c122d51ab44631db7091fa9880a62ac9`（基 `ced9254c4cf1fd3d93007d95491f75fc4bdf2582`，单提交直接父子）。
- **改动面**（实测 numstat）：`.agents/skills/team-leader-operations/SKILL.md` **+53/−0**；`dev/agent-workflow/evidence/alpha5/pr8/skills-update-D2-execution.md` **+35/−0（新文件）**。共 88 插入 / 0 删除。
- **方式**：一次性 detached worktree（`.worktrees/d2-skill-rev`）只读审查；harness 用户级 dot skills 零触碰（本机无用户级 skills 目录，且全程零写入）；本审查件为该分支唯一追加提交（ff）。

## 判定

**通过（PASS，0 阻塞 / 2 非阻塞注记 RNB1-RNB2）**。本判定按任务声明构成 Alpha.5 完成条件之一（D-2 skills 落文维度）。

## 逐项核验

### ① 六要素逐字（行号 = SKILL.md @90dc56a6）

- **17:52Z 裁决引文 byte-identical（脚本比对）**：G-a 行裁决+边界段（`**用户裁决 2026-10-16 17:52Z：接受扩大取消范围**（限定=…）。**边界：不扩大为 provider 卸载自动杀全团队；G-g 不随之关闭；不回填为 17:02 合并时已批准**`）按注记方法截取（`sed 's/。运行接线验收.*//'`）后，`cc47fb18` 与权威 `3768a28d`（origin/alpha5-pr1r-followup，G-a 行 :14）间 sha256 = `e1a5fc29a94603705f50b2106f95bb91ad1b3a2c1746550c44b22f3b1f758667`，**两侧恒等**；G-a 全行仅第 4 列（验收依据）不同，与注记 :16 声称一致。执行注记内两段带省略号引文与非省略引文（`**用户裁决…**`、`**边界：…**`）及头部引文（PENDING-GATES :7 `本登记**仅限项目内**…`）均为权威文本**字节级子串**，实测在场。
- **触发/影响集合**：:261-267 点 1（governed `(scope,name)`、仅点名漂移名 `RW-ISOLATION-NEIGHBOUR-TOOL`、MCP 整代撤回+重绑 `RW-MCP-RESYNC-CANCELS-AND-REBIND-RESTORES`）。在场。
- **取消≠终止**：:269-276 点 2（`ABORTED_BEFORE_DISPATCH` 调度门前取消；started 收 abort REQUEST，落地=TERMINATION `RW-ABORT-INSIDE-BODY-IS-TERMINATION`；裁决不承诺立即终止；pinned Host caller-cancel 边界实测注记）。在场。
- **三分类**：:278-283 点 3（**not executed** / **executed, possibly with side effects (original value preserved)** / **termination unconfirmed**，`EXECUTION_TERMINATION_UNCONFIRMED` 独立类不得折叠）。三分句逐一在场。
- **无回滚**：:278（"Side effects of already-started calls are NEVER rolled back"）。在场。
- **卸载三区别**：:285-292 点 4 (a) 不自动杀全团队 (b) 有序 teardown 清账 `RW-TEARDOWN-NO-LEAK` 非 mass abort (c) 通道不可订阅=预 spawn 类型化拒绝 `IO_POLICY_UNSUPPORTED`。三分项在场。
- **D-1（项目内登记/无 outbound upstream）**：:297-302（`NO-ABORT-AFTER-BODY-START` DEFERRED；恢复需公开可信 body-start 检查+回归腿；"This deferral is a project-internal registration only: no request has been filed with the Host upstream or anyone outside this repo, and filing one is a separate future action requiring explicit user authorization."）。在场。

### ② 三边界同文在场

- 不扩大 provider-unload-kills-all-team：:286-287（"does NOT auto-kill the whole team — that is an explicit boundary of the ruling"）。
- G-g 不因本裁决关闭：:294-296（"support-matrix position is NOT closed (gate G-g…)"，非 SUPPORTED 口径）；另 §7 追加条 :252 交叉引用。
- 不回填 17:02：:257-258（"recorded after the fact — it is NOT to be read back into the 17:02 merge"）。

### ③ 候选保真（skills-candidate-D2.md @ c0cfa718，实测在 origin/alpha5-pr8-runner）

- 候选 §8 代码块（候选 :12-57）= **46 行**；SKILL.md §8 区段（:255-302）= 48 行。`diff -u` 实测：**唯一差异 = 末段末行追加一句**（"regression legs first." 后接 "This deferral is a project-internal registration only: … explicit user authorization."，3 物理行），其余 45 行含缩进逐字一致。该句系任务要素⑥要求（候选未含），执行注记 :22-28 设"唯一增句"专节注记在场，且注记引文与 SKILL.md :300-302 落文**字节恒等**（脚本 `SENTENCE BYTE-IDENTICAL: True`），PENDING-GATES 头部口径对应。
- §7 追加条：候选 :63-66 = SKILL.md :250-253，`diff` 零差异 = **4/4 逐字**。

### ④ 结构

- 标题序 :13/:33/:95/:122/:150/:206/:228/:255 = **§1..§8 连续**；:306 无编号 Alpha.4 附录保持文末原位（未移动）。
- frontmatter（name/description，:1-4）完好；SKILL.md diff = 单 hunk `@@ -247,6 +247,59 @@`、minus 行 = **0** → **既有行零改写，纯插入**（亲验）；`---` 分隔线为既有上下文行。

### ⑤ 旧口径残留扫描 = 0

- 弱/强旧表述英文正则（`only affects subsequent`/`does not affect in-flight`/`never receives an abort`/`cancels only un-executed` 作现行语义）扫描：唯一命中 :297 `claim the strict "cancel only un-executed calls" property`，其句法为 **"And do not claim … DEFERRED (gate D-1)"** 否定式 + D-1 延期描述，属任务允许形态，非现行语义表述。17:02 批准类句式 = 0（唯一 :258 为否定式）。
- 注记 :12 声称复核：§8 区段（255-302）`quiesce` 计数 = 0（全文 2 处均在既有 §2 :85/:89）；`](` 计数 = 0（无 markdown 链接，无悬空路径引用）。

### ⑥ 执行注记一致性 + token/porcelain

- 注记全部可测声称实测吻合：+53/+35 ✓；基 ced9254c ✓（父子亲验）；候选 ref c0cfa718 ∈ alpha5-pr8-runner ✓；G-a :14 ✓；锚点计数 `2026-10-16 17:52Z`×1 / `17:02`×1 / `auto-kill the whole team`×1 / `G-g`×2 / `D-1`×2 全中 ✓；blueprint skill 未动（diff 仅 2 文件）✓；master 未动 ✓。
- token/secret 扫描：命中全部为 requestToken 文档语义（该 skill 既有正文），零真实凭据 ✓。
- 审查 worktree `git status --porcelain` = 0 行 ✓；§8 引用的 RW-* 判据名全部在树内证据有实体（各 13-18 文件命中），非虚构锚点 ✓。

## 非阻塞注记

- **RNB1**：`PENDING-GATES.md` 尚不在 ced9254c 树（在 alpha5-pr1r-followup），故 §8 的 "PENDING-GATES G-a"/"gate D-1" 为名称级前向引用；SKILL.md 无链接/路径（`](`=0）故无悬空链接。随 pr1r 分支合并自然闭环。
- **RNB2**：候选映射表 :79 配置 F 名 `RW-NO-CHANGE-CHANNEL-UNSUPPORTED` 与 §8 落文 `IO_POLICY_UNSUPPORTED`（类型码）并存属候选既有口径（候选原文逐字，非落文改动引入）。

## 流程

- push = `alpha5-d2-skills` 分支 ff 追加（任务授权，无 force）；master/stable 未触碰；一次性 worktree 审查后回收；回收后 df 留痕。
