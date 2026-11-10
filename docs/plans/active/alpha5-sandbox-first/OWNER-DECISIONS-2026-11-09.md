# 待裁决问题清单 — 联合收尾（2026-11-09）

> 这份文件是**裁决台账**，不是计划。每一条都写：问题是什么、为什么必须由 Owner 而不是我决定、
> 选项与代价、我的建议、以及**不裁决会发生什么**。所有数字来自实测（见各条的来源指针），
> 没有一条是为了让清单看起来完整而填的。
>
> 状态：`DECIDED` = 本轮已裁决（决策 + 后果已写明）；`OPEN` = 等 Owner；`MY CALL` = 属于我的执行裁量，
> 列出来只是让你有机会否决。

---

## 0. 本轮已裁决（3 条）

### D1 — G3–G5 按哪条路径验收　`DECIDED`
**裁决**：按 **opt-in governed preset**（受治路径）验收，不承诺默认 `standard` 路径的逐工具矩阵。

**后果（我会照此执行）**：
- 矩阵结论与 Release Notes 必须写明"G3–G5 的适用范围是 opt-in 受治路径"；默认 `standard` 路径保留其
  原有权限与执行行为（Alpha.4 envelope + 宿主原生授权），**不宣称**受 Alpha.5 confined I/O 上界治理，
  也不纳入逐工具矩阵。**本节初稿写"默认路径 I/O 上界照常生效"是错的，已由 2026-11-09 勘误撤回**：
  confined realm 只在显式 `a5sf-governed-member` + `a5sfGovernedRealm` 下装配。
- 计划 `TOOL-ACCEPTANCE-MATRIX` 里 BL-27…BL-34 的字面口径与此不一致，我会以**只追加**方式写一条口径注记，
  不重写历史行。
- 这也意味着 **C2 候选轮的 preset 必须是受治 opt-in**，而不是 `standard`——见 D15。

### D2 — CANDIDATE-C2 的独立裁决人　`DECIDED`
**裁决**：任命一个**未参与产品实现**的独立评审 agent 作为裁决人。

**后果**：
- 它必须自己写 `run-boot.mjs` 的调用、自己跑 **≥2 次一致 boot**、自己产出 per-case verdict，
  并签进候选清单；它不得修改产品代码。
- 我会在证据里**明写**它的独立性依据（"未写产品代码、未参与候选实现"）以及**它不是什么**
  （不是一个法律意义上的外部机构；如果审计要求外部人类签名，这一条不满足）。
- 实现上需要一件现在不存在的东西：`verifiedFor` 的解析器 + 候选引用提供者（见 D8）。

### D3 — `network: restricted`　`DECIDED`
**裁决**：接受为**类型化例外**，写进 Release Notes。

**后果**：能力表只承诺 `allow` / `deny` 两态；`restricted` 必须**显式判 UNSUPPORTED**（不是静默降级成
deny 或 allow），且 Release Notes 的"已知限制"必须点名。BL-42 的 netns 后端去留见 D6。

---

## 1. 仍待裁决

### D4 — BL-38（read/write 分离）是否进入 v0.1.6　`DECIDED 2026-11-09：推迟 + 类型化例外`
**问题**：BL-27 的读写分离格引用了 BL-38，而 BL-38 在计划里明确标为 Owner-owned、当前 deferred。
现在 `read` 与 `write` 是**两条独立轴**，各自有上界；BL-38 要的是"写权限不能蕴含读权限"的更强语义。

**选项与代价**：
1. **推迟，记类型化例外**（我建议）：BL-27 的该格标例外并引用 BL-38；现有两轴独立上界不变。
   代价 0 boot，1 行矩阵注记。
2. **纳入 v0.1.6**：需要新语义 + 一轮 boot 验收，且会动到已发布的 Alpha.5 语义，风险最高。

**不裁决的后果**：BL-27 会一直卡在"引用一个 Owner-owned 未决项"，G4 无法判定为 PASS 还是例外。

### D5 — BL-34 性能阈值　`DECIDED 2026-11-09：排除，Release Notes 写明未验收`
**问题**：BL-34 要 per-tool 的延迟/开销上界。计划明确"禁止发明阈值"。
**选项**：给我一组可接受上界（例如"受治路径相对非受治路径 ≤ N×"），或**明确把 BL-34 排除在本次发布之外**。
**代价**：若给阈值 → 5–10 boots；若排除 → 0 boot，但 Release Notes 必须写"性能未验收"。
**建议**：排除，并在 Release Notes 的"未验收"清单里点名。

### D6 — BL-42（netns 后端）去留　`DECIDED 2026-11-09：搁置，restricted 仅声明 v0.1.6 不支持`
**现状**：netns 后端是一份**未合并的草稿**，0 boot。
**选项**：1) 明确搁置，`restricted` 永久记 UNSUPPORTED（与 D3 一致，推荐）；2) 继续实现并等一轮独立验收。
**不裁决的后果**：`restricted` 会一直是"半成品字段"，用户会以为它只是没配好。

### D7 — Q7 基线是否重立（Authority 变更）　`DECIDED 2026-11-09：批准重立到本轮联合集成的固定 master HEAD`
**实测**：当前 `current-authority` 指向的基线是 `1484fa4ee`；从基线到 HEAD 的产品路径漂移
**420 个**（计划记录的 28 是 `#606` 时代的数字）。整个 Alpha.6 栈 + 约 40 个 PD lane 都叠在上面。

**为什么必须你决定**：移动 Authority 基线是治理动作，不是执行动作。我无权自己重立。

**选项**：
1. **重立基线**到当前 master（推荐）：给出一条带理由的 `switch-authority` 记录，之后 `V@B` 与
   `candidateRefProvider` 才有意义。代价 0 boot。
2. **不重立**：保留 `1484fa4ee`，则任何 `V@B=yes` 的旧结论都**不能**用于当前树（它们本来就已因漂移失效），
   C2 的候选只能"自证"，无法与 Authority 对齐。
3. **把 Alpha.6 拆出去**：让 `standrad` 路径回到旧基线附近——工作量最大，等于回退这次收尾。

**建议**：1。**不裁决的后果**：C2 只能在"无 Authority 对齐"的状态下进行，我不会把它记成 C2 通过。

### D8 — 是否扩充 Required CI 覆盖　`DECIDED 2026-11-09：方案 2 + 独立验证库，不改 Required CI/Q7`
**实测**：`42 / 51` 个 world-factory `a5sf-*.test.mjs` 与全部 `tests/s2-authority/*` **不在任何 Required leg**；
`verifiedFor` 的负控只能手工跑；`ci-pr-gate.mjs` 里没有 `verifiedFor` / `Q7_CANDIDATE_*` 的实现。

**冲突点**：你的硬约束是"不改 Q7/Authority/Required CI"。**扩充覆盖**算不算"改 Required CI"？

**选项**：
1. **不碰 Required CI**（严格字面）：这些套件保持 CI 不可见，C2 的 gate 侧校验由独立裁决人手工执行并在证据里签字。代价 0，但"没人守门"。
2. **只加"非必需" leg**：新增一条 informational workflow，不加入 required contexts。不改变 Required CI 的判定，但提供可见性。
3. **扩充 Required CI**：把 42 个套件与 `verifiedFor` 解析器接入 `ci-integration`，并把新 leg 加进 required contexts。

**建议**：2（可见性而不改判定）＋ 把 `verifiedFor` 解析器作为**库**先落地（不影响任何 leg）。
**不裁决的后果**：C2 的"gate 侧"永远是手工的，下一次收尾还要重新手工。

### D9 — 类型化例外的枚举范围　`DECIDED 2026-11-09：有条件批准逐项例外`
**实测**：数据面 REQUIRED 名字 42 个 → 约 **108 格**候选；今天只有 11–12 个名字有可执行的 confined face，
即约 34 格现在可测，**约 74 格需要接线，或为每个名字写一条类型化例外**。

**选项**：1) 逐名字写例外（0 boot，但例外清单会很长，且必须引用 `expected-tool-obligations.v1.json` 的 file:line）；2) 先接线再测（每名字 1–2 boot）。
**建议**：1，并且例外必须**机器可核对**（引用义务清单的行），不接受"手工声明"。
**不裁决的后果**：G4 的格子会长期停在"未测"而不是"例外"，两者在审计里不是一回事。

### D10 — 候选冻结是否重做　`MY CALL`（列出供你否决）
现有冻结 `candidate/a5sf-fs-search-1 @ 25e106b4` 的 6 个产品 blob + 2 个判官 blob **今天仍逐字节可复算**，
但它比当前产品树落后 420 条路径。我会**新建** `cand-a5sf-fs-search-2` 指向本次候选 head，
并**补一个清单生成器**（现在的清单是 §7.1 手写的，这是下一次收尾的隐患）。

### D11 — `A6-26` 是否允许随 rc.1 发布　`DECIDED 2026-11-09：允许，仅 opt-in experimental`
**现状**：Inbox `ACCEPTED`-but-not-`CLAIMED` 崩溃窗口**终态放弃**该请求（0 重复执行、0 副作用、typed、
账本页可按 id 查到，但不在 `team_list_pending_control` 里，恢复=重新发起）。已写进 Release Notes 与 runbook。
**选项**：1) 允许，作为**opt-in experimental** 面的已知缺陷发布（推荐，前提是 Release Notes 明确到"你会发现它消失"）；2) 修好再发（需要新的重投/认领语义，等于在崩溃窗口里重新引入自动重放，与你既有的 Scheme A 裁定方向相反）。
**不裁决的后果**：rc.1 无法定义"已知缺陷是否阻塞发布"。

### D12 — rc.1 与正式 v0.1.6 的放行　`DECIDED 2026-11-09：方案 1（严格候选语义）`
**现状**：第三门（联合验收 + Required CI 绿 + 独立审查）**已完成**；第四门未做，因为 G2–G5 与 C2 未完成。
**选项**：1) 等在 D4–D11 全部落定并跑完 G2–G5 + C2 再打 `v0.1.6-rc.1`（推荐，符合你裁决的字面）；2) 允许"候选冻结 + 独立审查"就发 rc.1，把 G2–G5/C2 放到正式版之前（更快，但 rc.1 的语义会从"候选验收完成"退化成"冻结候选"）。

### D13 — PD-33 驱动的 fail-closed 填充　`MY CALL`
**现象**：用 `--arms e2e` 只选一部分臂时，未选中的 8 条 lifecycle 臂被填成 `overall=FAIL`
（原文 `"selected case produced no verdict (fail-closed)"`）。G2 的验收员**没有在测量中途改驱动**，是对的。
**我会做**：把"未选中"与"失败"在记录里分开（`not-selected` ≠ `fail`），并保留原 fiber。这不改任何判定语义。

### D14 — 448 KB 未跟踪证据　`MY CALL`
`evidence/a5sf-live-member/{archive,driver}/` 有 448 KB 未跟踪文件，不在任何门的证据集里。
**我会做**：要么按引用关系提交，要么就地删除并在日志里记一行——**不会**让它长期挂在 `git status` 里
被下一个人误当成"本次改动"。

### D15 — C2 候选轮是否必须包含 A6-on　`DECIDED 2026-11-09：不采用 A5-only，改为 C2-A + C2-B 共享同一候选`
按 D1，G3–G5 在**受治 opt-in** 路径上验收。但 Alpha.6 的审批面是**另一层 opt-in**。
**选项**：1) C2 只覆盖受治 Alpha.5 路径，A6 的验证继续由独立 kit 承担（推荐，责任边界清晰）；2) C2 需同时覆盖 A6-on 组合（更强，但需要两套 preset 与双倍 boot）。

---

## 2. 决策 → 工作量（实测口径）

| 决策 | 影响 | 代价（boot / 决策） |
|---|---|---|
| D4 BL-38 推迟 | 解锁 BL-27 判定 | 0 / 1 |
| D5 BL-34 排除 | 解锁 G4 收口 | 0 / 1 |
| D6 netns 搁置 | 让 `restricted` 语义确定 | 0 / 1 |
| D7 重立基线 | **解锁 C2 与 V@B** | 0 / 1（治理动作） |
| D8 覆盖策略 | 决定 C2 是否有人守门 | 0 / 1 |
| D9 例外枚举 | 解锁 G4 的 74 格 | 0 / 1 |
| D11 A6-26 放行 | 定义"已知缺陷是否阻塞" | 0 / 1 |
| D12 放行时点 | 决定 rc.1 的语义 | 0 / 1 |
| D15 C2 是否含 A6 | 决定 C2 轮次规模 | 0 / 1（+2–4 boot 若含 A6） |

**总代价**：约 9 个裁决，**0 个 boot**；它们解锁的后续工作是约 30–37 个 boot（G3–G5 与 C2）。

---

## 3. 我现在就能做、且不需要你裁决的事

1. **D10 候选冻结重做** + 清单生成器（0 boot）。
2. **D13 仪器修正**（未选中 ≠ 失败）。
3. **D14 证据归位**。
4. **G2 剩余项**：BL-17 的网络子句（需要一条 `network: deny` 的 shell 组合——这是产品缺口，不是测量缺口）、
   BL-15 的原生写越界反例、`read_image` 的 image 路由正例。
5. **G3 的"已满足但没记账"部分**：BL-21 运行时半场（`member-surface.json` 40 个真实 Host 名字）、
   A 层表格、BL-24 的解锁——这些都是 0 boot 的记账工作。

---

## 4. 一句话总结

**产品与联合验收已经到"候选可冻结"的程度；卡住发布的是九件需要你拍板的事，其中 D7（Authority 基线）
与 D12（放行时点）决定我们是在"验证一个候选"还是在"验证一个未知基线上的候选"。**


---

## 5. 2026-11-09 Owner 裁决的落地边界（只追加）

**D7**：以本轮联合集成、经检查的固定 `master` HEAD 为 integration baseline；用 `publish-authority.mjs` 发布
不可变快照、`switch-authority.mjs` 在旧指针摘要前置条件下原子切换；**保留旧快照与历史证据**；**不改 Q7 判定逻辑、
不改 `V@B` 含义、不把历史 `DEV-LIVE` 升级**；候选自己的 commit 固定在候选清单里，**冻结候选时不再移动指针**。
这与 §7.6 不冲突：§7.6 反对的是"为某个 Candidate 的 PASS 挪指针"，本次是长期落后的 integration baseline 重立。
**重立的效果是恢复可信比较基准，不是让 420 条历史变化自动获得认证。**

**D12**：现在冻结 `candidate/v0.1.6-1` 并启动 C2；**不打 `v0.1.6-rc.1` Tag**，直到 G2–G5 + 独立 C2 + Required CI
+ 必要 A6 验收 + 发布审查全部通过；Tag 指向的提交创建后不得重写。

**D8**：可加 informational CI 与纯验证库；**不得改现有 Required CI 的通过规则或 Q7 语义**；
**informational 运行成功不得冒充 required context 成功**；候选 Ref 验证器必须由独立裁决人实际执行。

**D9**：逐项例外必须绑定**具体工具 + 义务格 + 拒绝行为 + 证据**；**不能把未完成的必交安全义务批量改名为"例外"**。

**D15**：C2 分两个范围、**共享同一候选 SHA / 同一安装包 / 同一 Host 版本**：
- **C2-A**：Alpha.5 governed、A6-off，执行正式受治 I/O 验收；
- **C2-B**：Alpha.5 governed、A6-on，执行精选联合回归（Officer allow/deny、单次消费与执行、Goal 授权、
  Stop/Sticky Stop、冷恢复、已知 A6-26 故障路径）。预计增加 2–4 次 boot。

**D6 边界**：shell 的网络 `deny` 不得冒充 OS 级隔离。
