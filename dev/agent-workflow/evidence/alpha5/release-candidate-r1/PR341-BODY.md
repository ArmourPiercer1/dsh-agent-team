# PR #341 body（候父方 REST 刷新用；父 20:53Z ② 单）

> 用法：正文即 PR body 全文；`{{HEAD}}` 由父方以本正文所属提交的 `rev-parse` 回报值替换（该值写入 body 的时刻必然晚于本文件入仓，占位为诚实做法，非遗漏）。

---

## Alpha.5 release-readiness 独立审计四件套 + 当前态台账（candidate-fix 轮）

**final head = `{{HEAD}}`**（分支 `a5rc-inventory-fix`；链：master `5885e46e` → `ccd4356f`（四件套+返工六单）→ 本头（#341 候修四件+补修三件）；**本 PR 不含任何产品代码/测试改动**——全部为 `dev/agent-workflow/evidence/alpha5/` 下证据与台账文档+试用工装（kit/shell/helpers）。）

### 内容

1. **可试用机制清单** `release-candidate-r1/INVENTORY.md`：六条根点名机制（jobs 身份线/LSP/native 审批后执行/shell exit+取消/PTC/glob 等装面行）逐条=挂载面/开关键/未闭洞/最小验证命令/证据。
2. **未验收清单** `release-candidate-r1/NOT-ACCEPTED.md`：A 已闭口径刷新 / B 已裁语义边界（非缺陷）/ C 在册待办 / D 红线禁用项。
3. **固定 SHA+回退+试用脚本** `ROLLBACK-AND-TRIAL.md` + `rc-trial.sh`/`rc-trial-kit.mjs`/`helpers/`：装=公开 `plugin add github:…#<master-SHA>`；launcher=同 commit 字节带外供给（I8 披露面外）；回退=具名 uninstall+world 清。
4. **隔离 smoke receipts** `SMOKE.md` + `runs/`（r1-r6b 全录不删）：`tests/homes/` 世界+3183/3185 族端口，:3080 只读探针，具名清理。
5. **当前态台账** `ALPHA5-CURRENT-STATE.md`（§A-F 现在时事实+出处）+ `REWORK-2026-10-18.md`（21 行三层口径表+逐名 §⑤+§④ native 精确版）。
6. **G-e 一页映射** `G-e-mapping.md`（四编号=历史身份待核+隔离标注；已同意相邻方向逐条带时戳行号；推测映射与覆盖关系；不重问用户/不阻已明确范围）。
7. **scoped visibility 三选项评估材料** `scoped-visibility-options.md`（Q1/Q2/Q3 正文原文+语义+影响面+与已生效裁决关系；**呈根评估非呈用户**）。

### 验收摘要（现场 SHA 均 rev-parse/ls-remote 直读）

- **本 kit 终态 r5 = 28/0 GREEN** @`5885e46e`：装面三零 1773/1773 rootSha `3a3911a8fb494034…`、launcher `1264ea58…`/26992B/abi4、`team.create→create-member→委派→collect`、`bash · exit=0` 真落盘、越界 `exit=1`+内核 `Permission denied` verbatim、`cancelled:false`（无取消路径语义）、具名清理 left=[]。
- **r6b（+M9 native-bash 见证腿）= 28/1**：该红=我方判据未预设**第三分支**之工件，红 receipt 本身即新事实 verbatim——RC 形状**非接管**原生 bash 被 `request-control` 包络门**派发前 fail-closed**；判据当场扩三分支，不重跑（重跑仅复制同 verbatim）。r6 FATAL=与 a5ie-r5 真跑并发端口相撞（其实占 3184+3491），设计拦截+具名清。
- **a5ie-r5（真安装全量验收）= 40/41 + 3 booked，唯一红 C1（如实，判据未降）**：cancel RPC 命中成员 sleep-90 lane（E1 判别器 ≤5s 触发、http=200）仍落死亡形（`exit=not-observed cancelled=false`+`Error: tool call aborted`）——**`bash · cancelled`/`"cancelled":true` 在装面 team lane 未端到端达到**（#340 已合=代码/CI 层事实；装面端到端=RED 未闭）。入账=`a5ie-r5`@`c44f51e4` runs `2026-10-18T20-36-13Z`。

### 状态行（本头时刻现场核）

- **#337**：方向已根准（R1+rc-first，20:12Z）；两线=rc-first 判据 `178bea59`（g6b-flake 头；**双独审回**=A `e593709f` GO/B `d3cad43b` 投机通过[必办五项在册]→收口单已派、**merge-sync 收口进行中**）+ stdout 完整性门 `203cac85`（round-8）；均**未入 master 头**（merge-base 实证）。glob 行 stderr 代理判据洞在入头+复验绿前不闭。
- **glob 独立关断键**：已裁、**交付候门** `a5-globoff-key`@**`27f70457`**（闭包新头现场实存：缺省不变/显式 false=typed-shut/无绕过/RED-first；RED 5/7→GREEN 7/7、K1 常绿=默认零变直证、K7 四工具真 Landlock、五 hunk 全 assembly 体、11 失败 base A/B 全预存）；新候选形=master+关断键（绿门+独审=候门中）。可核性双注：COORD 尾引 `11c246f2`（writer 头）/`da98c039`（收口派单记录）**现场 cat-file 无此对象**，只按台账行引用。
- **C-16（钉名表 13 名缺口+反向漂移）**：已裁、收口落毕候门 `a5-pindir`@**`b7deacbc`**（现场实存；同形对抗扫+现装∪shipped 并集口径补钉轮[根 21:05Z]；subagent_fork 不得因 catalog 无即删，须保留/退役理由；前引 `68e8d70f` 现场无对象已双注）。
- **native 审批后执行**：**接管形（bash@bash）已交付**=#329 `1fb14c4d`（INSTALL 3.5；durable ask unchanged；natexe 症状链=其修的前态）；剩余=**非接管原生名**（RC 形状=r6b M9 envelope-fail-closed）；同名接管=supported 恰两对（`bash`@`bash`/`read`@`read`，`verifyPlaneNames` 拒文原文为证），grep/glob 强制别名。
- **LSP #306 口径（去混称）**：**clangd 18.1.3=唯一真 LSP 正例**（initialize+31 能力键/真 definition·documentSymbol/shutdown→**自退 code 0**→/proc 消失→lease `terminated`/policyChange 新 pid 真握手+strict EACCES 原文腿）；**tsserver 6.0.3=非 LSP**（原报告 "**no LSP mode**"，官方 TS stdio JSON 面）**仅承载 cross-member 第二服务器腿**（definition offsets 17–30、completionInfo 1042 真条目）；LSP 协议判据=单实现（clangd）背书；hover/completion 慢=原报告披露留档。**不存在"两服务器均通过同等 LSP 交互"。**
- **G-e（原 G1/G3/G7/YAML）与 scoped visibility（根 21:15Z 口径修正版）**：G-e 四编号=**历史事项身份/决策状态待核——不构成"已证实待用户裁"**；正文不在仓内（全集 grep 皆同源转写），历史指针保留+隔离（「内容不明，勿据此行动」），不向用户重问不明问题，不阻任何已有明确范围（全表=`G-e-mapping.md`）。scoped visibility=GLUE-4 Q 单 **10-17 已 RESOLVED**（Q4 准/Q2 拒/Q1 降级 optional upstream ask/Q3 拒），三选项正文+影响评估=`scoped-visibility-options.md`（**呈根评估，非呈用户**）；现册真待用户项=**T-1（v3 退役窗口）**唯一。

### 红线与范围

不 push（本 PR 之外）；`:3080` 只读探针；测试世界=tests/homes 具名+具名清；test-use 宿主 pin `639ed01539` porcelain 0 全程（H1/C2 腿）；产品码/门/判据零改动零放宽（kit 判据两次扩支均为**我方工装匹配面修正并留红原文**，非降门）。
