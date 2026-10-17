# review-W8-formal — W8 正式轮独立审查（≠writer a621416e）

- **reviewer** = W8 正式轮独立 reviewer（qwen3.8-flash-next；模型/harness 分列；writer=a621416e，非本会话）
- **受审 SHA** = `5b209958376a3a7af37466bc6e451d8a7d9c743c`（branch `alpha5-wire-pr8`，W8 正式轮三提交 `d0b1e406` RED → `416c20da` GREEN → `5b209958` feat，base `2ff24c5a`=W8-prep+W4+W5+W7 合并树）
- **复现环境** = 一次性 detached reviewer worktree `.worktrees/a5w8-rev-w8formal` @ `5b209958`（全新检出，writer 树全程只读、审后 porcelain 净）。M-06 kit-rerun / pinned-grep 腿需构建运行时：以 **gitignored 只读符号链接**复用 `dsh-020rc2-upgrade` 已建树（@`639ed01539`，porcelain 0，与 W4 轮披露的既有复用路径同款）；跟踪树零影响。
- **裁决 = 投机通过（speculative pass）**：五项审查要求全部独立复现成立；四自注例经 reviewer 独立注入 **39 例全咬、零逃逸**；新增探测两条残余（symlink ref / 字符串字面量装配形，均 NIT 级、均需先提交树内异常文件才可达）。0 LIVE 与缺项声明**如实**。零 blocker、零冻结语义冲突。

---

## ① F-1/F-2 修复对抗复验 — 39 例注入全咬；4 自注例逐条咬住

注入件 = `.w8rev/inject.mjs`（一次性，不入 push），直接 import `probe-lib`/`runner/lib` 的 `evidenceRefsCheck` / `grepAssemblyAnchors` / `assertProbeRegistrations` / `deriveProbeTransition` + probe 子进程。

**四自注例（RED-first 在册：runs/w8-formal-RED-self.log 35 tests / fail 9 先红 → 本审独立复跑 GREEN 35/35）：**

| 自注例 | reviewer 注入 | 结果 |
|---|---|---|
| refs 逃逸 repo_root | R2 `../outside.log` / R3 绝对路径 / R4 嵌套 `dev/../..` / R8 反斜杠 `..` / R9 `C:\` / R1 不存在 / R6 目录 ref | **全 rejected**；R7 在册真 ref=ok（仪器非空转） |
| 注释锚 | G1 整行注释含全装配形 / G2 行尾注释（`//` 前代码+形在注释内） | **missing=7（三面七形全咬）**；G5 真形代码行=sanity present ✓ |
| 自证布尔 | D2 `assembly_anchors_verified:true`+锚点不在场 ⇒ **PROBE-GATED 降级**；D4 布尔=false+真 refs+锚点在 ⇒ **LIVE**（布尔彻底无效化，正反两向都不参与判定）；P1 完美 receipt+注释锚假根 ⇒ **NOT-RUN-READY/3**（receipt 买不到 LIVE） | 全咬 |
| doc 漂移 | L1 doc 侧 `status_now` 改 `TRANSITIONED-LIVE` ⇒ lint "status_now 未同步" 红；（机检侧越词表 L2、缺 transition_record L3 同咬） | 全咬 |

**提交时/运行期双位**：L4 GATED 行假 ref、L5 LIVE 行假 ref、L6 LIVE 空 refs、L7 LIVE 真 refs+假根锚点缺 ⇒ 各自点名红；D1 attempt-PASS / D5 越词表 verdict ⇒ VIOLATION；P2 完美 receipt+ghost refs（假根）⇒ PROBE-GATED/4；P2b/P3 完美 receipt+在册 refs+面在场 ⇒ **LIVE/0**（正向 happy path 存在，机制非永久红的空转仪器）。

**reviewer 新增逃逸探测（writer 未列）**：
- **大小写路径**（R5）：`m-08.receipt.json` vs 真文件 `M-08.receipt.json` ⇒ **rejected**（Linux 大小写敏感 FS；该逃逸在本宿主不成立）。
- **symlink 中继（NIT-F1b，真实残余）**：repo 内符号链接指向仓外字节（`.w8rev/tmp/link-out.log → /tmp/…`）被 `evidenceRefsCheck` 判 **ok**（`statSync` 跟随链接；`resolve()` 只查字面路径），可经 L8 提交时位与 D6/P4 运行期位一路支撑 **LIVE**。影响有界：须先在跟踪树内提交一枚可见的 symlink 文件（diff 可见），且 LIVE 本身仍是待终裁提案；但"refs 指向 repo_root 内**真实在册**记录"的字面语义被中继绕过。**建议（~3 行）**：`lstatSync(abs).isSymbolicLink()` 即拒，或 `realpath` 后再做 repo_root 包含判定；**首个 TRANSITIONED-LIVE 登记前落地**。
- **字符串字面量装配形（NIT-F2b，已披露方向的措辞精确化）**：完整绑定形（如 `mod.createConfinedProcessProvider(XX)`）藏进代码行的**字符串字面量**仍过 `grepAssemblyAnchors`（G4 present=W4/W5/W7）。README"注释与字符串裸子串不过"对**裸子串**成立（G3 全咬），对"含完整调用形的字符串"不成立——行形 grep 无语法解析，此为机制天花板；威胁面同 F-1b（须改装配面 kit 文件本身，diff 可见）。可选加固：锚点形加代码前缀（`const`/`await`/`=` 引子）。

## ② 五行 TRANSITIONED-PROBE-GATED 诚实性 — 0 LIVE 如实；SATISFIED 腿实至名归

- **0 LIVE 的缺项声明 vs kit 装配面亲查**：W4 装配 row 只注册**唯一** `a5w4_confined_exec`（w4/README 题注+row `name:` 亲验）；W5 row 只装 `a5w5_bash`/`a5w5_search`/`a5w5_unbound_probe`（grep `name:` 亲验）；W7 kit 只答 jobs-gateway 公开面身份/lease/隔离（README 亲验）。⇒ editor 族（M-04）/read_image 链（M-05）/PTC 管线两腿（M-08）/lsp 池四腿（M-09）/Domain mock 三腿（M-13）**确不在任何 kit 装配面**，probe 输出逐条 `ASSERT … NOT-EXECUTED :: receipt 缺字段…` 与矩阵 `missing_legs`、receipt `not_observed` 对账一致（M-04 3/3、M-08 2/2、M-09 3 条覆盖 4 腿、M-13 3 条覆盖 4 腿）。
- **M-08 A2/A3 SATISFIED 亲查**：`runs/w8-w4-pos/criteria.json` `W4-DOMAIN-DENY` 行 observed=**`rc=1 eacces=true leaked=false`** + stderr 原文（live-journal 含 `stderr…EACCES` 原始串）；A3 负控 `IO_POLICY_UNSUPPORTED` 对应 nega 相 `W4-NEG-NET spyDelta=0`×3 + `W4-NEG-ZEROSPAWN execAnswerRows=0 ceSpyRows=0 scratchSpawnPaths=0`（19/19 pass 原文在册）。ENFORCE 分级措辞如实（fixture/subprocess 级 OS_ENFORCED，未宣称整链）。
- **M-13 A5 SATISFIED 亲查**：`w8-w7-green/anchor-host-grep-{pre,post}.json` 均 **`hits:0`** + `treeHead 639ed0153972 porcelainLines 0`；receipt `pinned_host.job_start_present=false`。absent 不因 W7 转述被杜撰——如实。
- kit 数字亲阅：pos 22/22、nega 19/19、negb 18/18、w5 34/34、w7 criteria 表 22×`| PASS |`；port 3186、世界 `a5w8-*`（writer 树 `tests/homes/` 现**空**=即删兑现）、宿主树 porcelain 0（本审复核）、:3080 只读 401/401 在册。
- **NIT-G1（台账齐性）**：M-05 probe 输出 4 条 NOT-EXECUTED（含 `A4-arbitrary-tree-never-asserted`），矩阵 `missing_legs` 与 receipt `not_observed` 各只列 3 条（A4 缺席条款腿未入账）。方向保守（行仍 PROBE-GATED），无升格风险；补一行指针即可。

## ③ runner 无 flag 复跑 — 亲跑成立（27/0/0/5）

全新检出 + gitignored 运行时链接复现条件下：`node --test …pr8-runner-self.test.mjs` = **35/35**；`node run-pr8-negative.mjs`（零 flag）= `PASS=27 FAIL=0 NOT_RUN=0 REQUIRES-LIVE-WIRING=0 LIVE=0 PROBE-GATED=5 TOTAL=32`，结构 lint OK、ghost-anchor 对照臂如实咬红、final_declaration 全 null、**EXIT=0**；五行 `probe_outcome_source=recorded-transition_record` ⇒ 无 flag 复跑走的是**同一亲验位**（refs 存在性+锚点 grep 在复验，"在册≠免检"）。五 probe 无 flag 复跑 = 5× `VERDICT PROBE-GATED exit=4`（0 NOT-RUN-READY/0 LIVE/0 PASS），M-08 A2/A3、M-13 A5 SATISFIED 复现。

## ④ gap-checklist 刷新引证抽查（4+2 条，全实质为真）

| 行 | 引用 | 亲验 |
|---|---|---|
| C-04 | `admission-binding.ts:146`；`grep -rl str_replace_editor packages` 非 dist | :146 正是 `ARBITRARY_TREE_PROFILE_PUBLISHED = false`；grep=**0** 复现 |
| C-06 | `pr6/SEAM-VERDICTS.md:85`（F-3 修正后）+ `realm-evidence.ts:45` | :85 正是 PoC6a/6b 分叉判定行；:45 = `HARD_PROFILE_ENABLED = false` ⇒ **F-3 行锚修正落实** |
| C-08 | `jobs-gateway/README.md:1,9` + `WIRING-SURFACE.md:34` + `runs/w8-w7-green/summary.json` | :1 DORMANT 题注、:9 "zero production consumers"；:34 tsconfig 归 Lane F 另轮；summary.json **在册** |
| C-10 | `WIRING-SURFACE.md:31` + "agent-bindings 零 provider 引用" | :31 正是"零改动"行；三串 grep=**0** 复现 |
| （加抽）C-07 | `pr6/SEAM-VERDICTS.md:59` | 正是"公开面没有任何策略输入通道"句 |
| （加抽）C-12 | `alpha5-pr1r/g-g-probes/GATE-VERDICT.md:42` | 路径前缀已补全（prep F-3 第二处修正落实）；:42=被移 Body 实跑句 |

## ⑤ 措辞 lint 与 IF-7 禁 RLW — 达成

- `node scripts/lint-g-g-wording.mjs`（全新检出，含本轮全部新 md）= **scanned 740 md / violations=0**；runner `lintCorrespondence`（含 G-g 措辞禁则子集）lint=[]。
- **IF-7**（正本 `WIRING-PHASE-PLAN.md` @a4f7f4fc:12"REQUIRES-LIVE 禁用为本阶段终态"）：终态分布 **RLW=0**；五行为唯一挂 pending_probe 行且 `status_now=TRANSITIONED-PROBE-GATED`+`transition_record`（verdict 同词表、repro_ref 指向可复跑 probe 脚本、evidence_refs 经提交时亲验）；`forbidden_outcomes` 含 `REQUIRES-LIVE-WIRING-as-terminal`；probe 词表封闭四值无 PASS/RLW；运行期 NOT-RUN-READY/FAIL 一律折入 PROBE-GATED+最小复现。**PASS 与 RLW 双禁则达成，且 LIVE 通道开放条件（补缺腿）在 gap-checklist 明列。**

## 触碰面与门禁复核

`git diff 2ff24c5a..5b209958` = 92 文件；pr8 evidence 外仅 4 件：`run-w4.mjs`/`run-w5-live.mjs`/`a5w7-kit.mjs`（`--world-prefix`/`--port` **附加旗标**，diff 亲验默认值逐字不变 `a5w4`/`a5w5`/`a5w7`/`3184`；跨 lane kit 改动已在 README 披露）+ doc 矩阵（5 行 `status_now` 同步=N1 先例指定转交通道）。packages/tsconfig/barrel/registry/scanner/p4t6 **零触碰**；writer 树 porcelain 净；token 扫描证据树 0 raw（9 件均 REDACTED）；世界 0 残留 / 3186 释放。

## 发现（按严重度；全部不推翻本轮转态）

- **NIT-F1b（MINOR 边缘，LIVE 前必修）— symlink 中继过 evidenceRefsCheck**：repo 内 symlink→仓外文件被判"在册"（R10/L8/D6/P4 实证），"证据字节在树内"语义可被中继。修复 ~3 行（lstat 拒 symlink 或 realpath 包含判定）。
- **NIT-F2b — 完整装配形藏入字符串字面量可过行形 grep**（G4）：机制天花板（非语法解析），README"字符串裸子串不过"措辞宜精确为"裸名字不过；完整形入字符串仍过，属披露残余"。
- **NIT-G1 — M-05 A4 缺席条款腿未列 matrix missing_legs/receipt not_observed**（4-3=1 行台账差，方向保守）。
- **NIT（carry-over F-6）— runner 头仍打印 `base d69bfc4b`**（`_meta.base_sha` 未随轮更新；README 本轮已注明语义差，台账可读性问题）。

## 复现命令（零端口、零世界；kit-rerun 腿需运行时链接见头注）

```bash
git worktree add --detach .worktrees/<rev> 5b209958
ln -s <已建 0.2.0-rc.2 树> .worktrees/<rev>/tests/deepseek-harness-test-use   # gitignored 只读复用
node --test --test-concurrency=1 dev/agent-workflow/evidence/alpha5/pr8/runner/pr8-runner-self.test.mjs  # 35/35
node dev/agent-workflow/evidence/alpha5/pr8/runner/run-pr8-negative.mjs       # 27/0/0 + RLW0/LIVE0/PG5, EXIT=0
for r in 04 05 08 09 13; do node dev/agent-workflow/evidence/alpha5/pr8/probes/probe-M-$r.mjs; done      # ×5 exit=4
node scripts/lint-g-g-wording.mjs                                            # 740md/0
```

## 裁决

**投机通过**。F-1/F-2 修复经独立注入 39 例全咬（含四自注例逐条复现），LIVE 现在需要 **runner 现场行形 grep 装配面 + refs 逐项在册**双亲验，自证布尔彻底出局；无 flag 复跑 27/0/0/5 与五行 transition_record 复验位成立；0 LIVE 对照 kit 装配面**如实**（缺的是工具族腿不是装配面），M-08 A2/A3 与 M-13 A5 的 SATISFIED 各有原始 criteria/journal 锚点背书；gap-checklist 引证 6/6 实质为真（含 F-3 两处修正落实）；IF-7 禁 RLW 与措辞 lint 达成。判"投机"而非"通过"的剩余理由 = NIT-F1b（symlink 中继）与 NIT-F2b（字符串字面量装配形）两条新残余——均须先提交树内可见异常文件才可达、且当前 LIVE=0 无一受益，**移交条件：首个 TRANSITIONED-LIVE 登记前落地 F-1b 3 行修复并顺带 G1 台账补行**；此后本机制可支撑 LIVE 转态的独立终裁。

— reviewer 工作树 `.worktrees/a5w8-rev-w8formal`（一次性，审毕回收）；writer 工作树 `.worktrees/a5-w8` 全程只读、审后 `git status` 净；注入件（`.w8rev/`）与本审复跑产物不入 push。
