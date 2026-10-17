# review-PR258-delta — a29ef7c1 → d414b035（17:52Z 裁决落地轮，docs-only）

- **Reviewer**: 独立文档 delta reviewer（≠writer；qwen3.8-flash-next，harness=DSH/qwen3.8-flash-next 会话）；此前 a29ef7c1 轮评审件 = `review-PR258.md`（PASS）。
- **审查对象**: `alpha5-pr1r-followup` @ **d414b035**（origin 头）自 a29ef7c1 的增量：单 commit，4 文件
  （`dev/agent-workflow/PENDING-GATES.md` 新建、`SESSION_ROUTER_LOG.md`、`evidence/alpha5-pr1r/s12-residual-evidence.md`、
  `evidence/alpha5-pr1r/seam-record-post-door-resolution.md`），+204/−37。
- **裁决**: **PASS**（2 条非阻塞 nits；⑤ 的缺失清单与 owner 待改点按任务要求记录如下，不阻塞本 delta）。

## ① 裁决时间戳与"不回填" — PASS

全部四文件 grep：`17:52` 共 20+ 处，均作 **2026-10-16 17:52Z**；`17:02` 仅 5 处，**每一处都与"不回填 17:02 合并时点"同句出现**
（seam-record 状态块③/纪律标注、s12 §(h)/(i)/(k)、日志条目）。无任何"17:02 已批准/该裁决当时已生效"表述。
（`SESSION_ROUTER_LOG.md` 其余"已批准"命中均为他轮历史记录，与本裁决无关。）

## ② 三边界入文 — PASS

| 边界 | seam-record | s12 | 日志 |
| --- | --- | --- | --- |
| 不扩大为 provider 卸载自动杀全团队 | 状态块① | §(h) "Ruled" 段、§(k) 表头 | ✓ |
| G-g（静默通道）不随之关闭 | 状态块② + g-g 节专段（"does not close it either"） | §(b) 行、§(h)、§(i) 口径段、§(j)、§(k) G 行 | ✓ |
| 事后裁决不回填 17:02 合并时点 | 状态块③ + 纪律标注 | §(h) 两条、§(i)、§(k) 表头 | ✓ |

## ③ 三分类↔事件映射 vs master@452a04c0 — PASS

`git show 452a04c0:packages/runtime/tool-dispatch/install.ts` 逐行核对，全部为 `dispatcher-call-` 全前缀：
未执行→`dispatcher-call-cancelled-before-body`（:673，abortedByLane 分支）；已执行可能有副作用（原值保留）→
`dispatcher-call-terminated-after-body-start` + `sideEffectPossible: true`（:662/:665）；终止未确认→
`dispatcher-call-outcome-unreadable`（:651）/ `EXECUTION_TERMINATION_UNCONFIRMED`（:1165）。:686
`dispatcher-call-completed-after-abort`、:763 `dispatcher-call-executed-unvalidated` 存在且未被误引作三分类。
seam-record "acceptance basis" 段与 s12 §(k) 引文与上述完全一致。

## ④ §(k) 十行 vs runs 原文 — PASS（nits N-1/N-2）

§(k) 为本 delta 新建表；十行"测量腿原文"逐一与 `runs/kit-r1r-fix1/rereg-window.json`/`order-hazard.json` detail
字段比对（用户要求抽 A/B/E/G，实际十行全查）：
- **A** `v1=0 v2=0 code=ABORTED_BEFORE_DISPATCH issued=["grep:p00-c1"]` = runs 原文前缀（runs 尾另含
  `verifiedAfter=false obs=third-party-execute-listener>legal-re-register` 未携出 → N-1）。
- **B** `v1=1 code=ABORTED terminated=1/1 cancelledBeforeBody=0 text=Error: tool call aborted` — 逐字等值 ✓。
- **E** `EXECUTION_TERMINATION_UNCONFIRMED` 在 order-hazard.json 实存 8 处（NEG1-PARKED/MASK/R4/LEAK 的
  teardown/复证腿）+ lane 侧 `dispatcher-call-outcome-unreadable` — 锚点成立 ✓。
- **G** `v2=1 unvalidated=1 issued=0 channel=armed verifiedAfter=false` — 逐字等值 ✓。
- C/D/F/H/I/J 同样逐字等值（F 的 message 引文在 `"...tools/change"` 处截断，runs 原文续 "— since the B3 ruling…"
  → N-2 同 N-1 类）。
**无任何测量值被改动**；改动只发生在"验收依据"列（新列，统一为 17:52Z 裁决 / 既有裁决链 / 未收口）。
§(j) G-g：状态原文（未收口 / UNSUPPORTED/待证 / 不得记 supported/closed/compliant / 允许与不允许说法）全部保留；
仅一行把"不因 G-a 解除而自动关闭"改引为"不因 17:52Z 裁决而关闭（裁决原文即列为不随之关闭）"——为边界②入文所需，
G-g 定位实质**未动**（若要求字面零触碰需回滚该句，本 reviewer 判定合规，nit N-3 记录）。

## ⑤ PENDING-GATES 两版对照 — 缺失清单 + 待改点（按任务要求记录，非本 delta 阻塞）

repo 版（d414b035 新建）仅含 **D-1/D-2 两行**；对照主检出未入库草稿
`dev/agent-workflow/evidence/alpha5/PENDING-GATES.md`（untracked，18:18Z），**repo 版缺**：

1. **G-a 行**（裁决状态行：17:52Z 接受扩大取消范围 + 三边界原文 + "运行接线验收自本裁决起可按门推进"）；
2. **G-b 行**（PR257 必改点1 文档项，follow-up 状态 + "禁'已合规'措辞"）；
3. **G-c 行**（PR256 F-1/F-2/NIT，"修复+新 head 独立复核+CI 后才谈合并"）；
4. **G-d 行**（六 lane 契约 v1.1 集成确认 + p4t6 pin +14 / tsconfig include / F-3 PR3 义务 / OpenAtPort 前禁宣称 Supported）；
5. **G-e 行**（原 G1/G3/G7/YAML 待裁项，不默认旧提案）;
6. **G-f 行**（census 非终态禁称"全部 CI 绿"纪律）；
7. **G-g 行**（静默已订阅通道独立开放项全文，含"送达+生效原文"证据要求）；
8. 草稿尾注（repo 版无）：合并协议补充条款（"PASS+CI 绿"≠放行）、G-d 预扫描 p4t6 pin 处置二选一、
   Lane B/C/E/F/G 复核进展与集成义务、PR256 尾差收口 head、18:3xZ 台账。

**后续事实（审查中分支已移动，如实记录）**：本地分支已推进到 **7cddad2d**（18:18Z，"merge G-a..G-g rows…"，
**未推送**，origin 仍 = d414b035），补齐了上述 1–7 行（G-f/G-g 顺序颠倒，无害）；草稿第 1 行已降为指针存根。
8 类尾注仍未入 repo 版（草稿自称将并入 INTEGRATION-PLAN.md 阅读，归协调方裁量）。

**owner 待改点（⑤ 要求记录）**：D-1/D-2 的 owner 表述在 **d414b035 与 7cddad2d 两处均未改为协调方直接指派**——
表列仍为"待集成 owner 提名 → 用户确认"，正文/日志同口径，且 seam-record DEFERRED 节
`owner : TO BE NAMED — the integration owner nominates, the user confirms` 亦未改。7cddad2d 的 commit message
声称 "owners directly assigned per 17:54Z delegation（d9da2f74=D-1 / 4d990c89=D-2 exec / 4dac3d04=reviews,G-g /
coordinator=integration）"，但**表体文字未同步**——message 与内容不一致，补齐时须一并把表列、D-1/D-2 正文、
seam-record DEFERRED owner 三处改为直接指派；草稿第 1 行"含 …+Owner 指派"的指针声明在 7cddad2d 时点同样超前于事实。

## ⑥ 文件面与卫生 — PASS

`git diff --stat a29ef7c1..d414b035` = 恰好上述 4 个文档；`packages/`、`tests/`、kit、graph.yaml **零触碰**。
diff 无 token/key/secret/bearer 类字符串。worktree porcelain 干净（评审写作前复核）。本评审件本身未 commit
（按指示不 push，由集成方转推）。

## Nits（均非阻塞）

- **N-1**：§(k) A 行引文截断掉 runs 尾部的 `verifiedAfter=false`——值未改，但该字段语义偏负面，"原文不动"宜全携或加省略号。
- **N-2**：§(k) F 行 message 同样为前缀截断（同上处理）。
- **N-3**：§(j) 一行被改写（G-a 引用→裁决引用），G-g 状态实质未动；若"§(j) 不动"按字面执行需回滚该句。
- **N-4**（登记类，见⑤）：owner 直接指派未落地 + 草稿指针声明超前——列入 7cddad2d 的下一笔补齐。
