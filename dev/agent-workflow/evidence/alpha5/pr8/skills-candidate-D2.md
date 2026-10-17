# skills-candidate-D2 — team-leader-operations SKILL 增补段落候选（D-2）

> **性质：候选文案，非落文件。** D-2 收尾轮由 **4d990c89**（followup 文档 writer）执行、**4dac3d04** 独立核验（owner 指派：PENDING-GATES.md@origin/alpha5-pr1r-followup cc47fb18 :24，17:54Z 授权留名留证）。本文件**不触碰** `.agents/skills/**`；对齐目标 = `.agents/skills/team-leader-operations/SKILL.md`（如 blueprint 语义受影响则含 team-blueprint-authoring）。
> 依据（全部原文核对）：取消语义裁决 `PENDING-GATES.md:14`（2026-10-16 **17:52Z**，事后裁决**不回填** 17:02 合并时点）；取消测量腿与三分类 `s12-residual-evidence.md` §(k)/§(j)@origin/alpha5-pr1r-followup；D-1 延期 `PENDING-GATES.md` D-1 行 + `seam-record-post-door-resolution.md` §DEFERRED；G-g 状态按 `review-G-g-probes.md`@origin/alpha5-g-g-probes bbaf45de（未收口）。
> 落点建议：SKILL.md 现无取消语义段落（§5 guard/blocked、§6 结果词表均不涉）；建议新增 **§8**，并在 §7 Common mistakes 追加一条。以下英文段落为可直接嵌入的候选文本。

---

## 候选段落（SKILL.md 新增 §8）

```markdown
## 8. Cancellation semantics when a tool definition changes or is withdrawn

User ruling 2026-10-16 17:52Z (PENDING-GATES G-a; recorded after the fact — it is NOT to be read
back into the 17:02 merge). As Leader you need exactly four facts to reason about an in-flight
delegation whose underlying tool definition drifts or is withdrawn:

1. **Trigger and affected set (exact scope).** A definition change/withdrawal for a governed
   `(scope, name)` cancels the *unexecuted* calls associated with THAT name and propagates an
   abort REQUEST to the *already-started* calls associated with the same name. Nothing else is
   touched: neighbouring tools keep executing (measured: only the drifted name is named —
   `RW-ISOLATION-NEIGHBOUR-TOOL`). A whole-generation MCP withdrawal + re-bind follows the same
   rule: in-flight unexecuted calls are cancelled, the name is withdrawn until re-bind
   (`RW-MCP-RESYNC-CANCELS-AND-REBIND-RESTORES`).

2. **Cancellation is not termination.** Unexecuted calls are cancelled at the dispatch door
   (canonical code `ABORTED_BEFORE_DISPATCH`). Calls whose Body has already started receive an
   abort REQUEST — if it lands, that is a TERMINATION (`ABORTED`, `terminated=1`;
   `RW-ABORT-INSIDE-BODY-IS-TERMINATION`), and the ruling does NOT promise immediate termination.
   On the pinned Host a caller-side cancellation raised while a Body is in flight is not visible
   at the result edge of a direct execute() call (measured without any lane); the implementation
   distinguishes the two canonical codes the Host does emit and does not claim a cancellation it
   cannot observe.

3. **No rollback.** Side effects of already-started calls are NEVER rolled back. Every affected
   call reports in the closed three-way outcome classification — **not executed** / **executed,
   possibly with side effects (original value preserved)** / **termination unconfirmed**
   (`EXECUTION_TERMINATION_UNCONFIRMED` stays its own class: never folded into "not executed"
   nor into "executed"). Treat an unconfirmed-termination result as an open question about the
   external world, not as a clean cancel.

4. **Plugin/provider unload is a different operation — three distinctions.**
   (a) Provider unload does NOT auto-kill the whole team — that is an explicit boundary of the
   ruling; team work continues under the remaining governed definitions.
   (b) Unload/teardown is ORDERED and ledger-clean: in-flight calls are drained via ordered
   teardown to `RELEASED` with an empty ledger (`RW-TEARDOWN-NO-LEAK`), not by mass abort.
   (c) When the change-notification channel cannot be subscribed at all (missing `on` / subscribe
   throws), assembly itself is refused pre-spawn with a typed refusal (`IO_POLICY_UNSUPPORTED`) —
   the system refuses to mount a weak configuration rather than pretending drift is inert.

Do not read these guarantees into the silent-subscription configuration (channel subscribed but
never delivering): that configuration's support-matrix position is NOT closed (gate G-g; alarm +
name-level withdrawal only, in-flight calls unaffected — `RW-CHANGE-INERT-LOUD`). And do not
claim the strict "cancel only un-executed calls" property: `NO-ABORT-AFTER-BODY-START` is
DEFERRED (gate D-1) — today an abort request IS propagated to started calls (see point 2), and
restoring the strict property requires a publicly trustworthy body-start check plus its own
regression legs first.
```

### 候选 §7 追加条目（Common mistakes）

```markdown
- Reading a definition-change cancellation as a guaranteed stop or a rollback: cancellation of
  unexecuted calls, an abort REQUEST for started calls, and the three-way outcome classification
  are different facts — see §8 (and do not read §8's guarantees into the G-g silent-subscription
  configuration or the D-1 deferred strict property).
```

---

## D-2 六要素 ↔ 依据对照（落文轮 review 用）

| # | 要素 | 候选文本落点 | 原文依据 |
| --- | --- | --- | --- |
| 1 | 扩大取消范围（17:52Z 原文边界） | §8 引言行 + 点 1 + 点 4(a) | PENDING-GATES.md:14 裁决原文三分句（扩大范围=definition 变化/撤回→取消未执行+传播 abort 请求）+ 三边界（不杀全团队/G-g 不随之关闭/不回填 17:02） |
| 2 | 触发与影响集合 | §8 点 1 | (k) 表配置 A/D/I（含 issued 台账点名、邻工具不受及） |
| 3 | 取消≠终止 | §8 点 2 | (k) 配置 B `RW-ABORT-INSIDE-BODY-IS-TERMINATION`（terminated=1/1、ABORTED vs ABORTED_BEFORE_DISPATCH）+ (h) caller-cancel 不可见实测（probe-cancel.mjs） |
| 4 | 无回滚 | §8 点 3 | 裁决原文"不回滚已发生副作用"+ (k) 三分类（终止未确认独立类）+ `dispatcher-call-outcome-unreadable` |
| 5 | 插件卸载三种区别 | §8 点 4(a)(b)(c) | G-a 边界①；(k) 配置 J `RW-TEARDOWN-NO-LEAK`；(k) 配置 F `RW-NO-CHANGE-CHANNEL-UNSUPPORTED` |
| 6 | D-1 延期项与恢复条件 | §8 末段 | D-1 行（bodyInvoked 私有 @core tools index.ts:1580；候选三件①pre-body 事件②公开读点③resolution-pinned Definition，③覆盖①②、本轮不选型；恢复=任一公开且 raise 现场可读；回归三件缺一不可=硬门腿/隔离反例/kit 判据翻转） |

## 验收清单（核验人 4dac3d04 逐条比对，任一不满足即不通过）

- [ ] 三分类措辞与 (k) 一致：**未执行 / 已执行可能有副作用（原值保留）/ 终止未确认**；无第四类、无并类。
- [ ] "不保证立即终止""不回滚已发生副作用"两句在文本中显式在场，且绑定到"已开始调用"语义。
- [ ] **无旧口径①**残留：'定义移动只影响后续调用' 式弱表述（17:52Z 已扩大，禁止沿用）。
- [ ] **无旧口径②**残留：'已开始调用绝不收到 abort' 式强表述（D-1 未恢复，禁止预告）。
- [ ] G-g 静默订阅配置未被写成 SUPPORTED/fail-closed/已合规；仅"未收口+alarm+名字级撤回+在飞不受影响"口径（(j)；分级现状按 bbaf45de）。
- [ ] provider 卸载三区别齐全，且 (a) 明确"不自动杀全团队"为裁决边界而非实现巧合。
- [ ] 17:52Z 引用与"不回填为 17:02 合并时已批准"边界同段在场；验收依据列不得写"17:02 已批准"。
- [ ] team_archive_member 的 quiesce（§2 既有）未被复用为定义变化取消的表述——两者是不同机制，不得互相指代。
- [ ] 若 blueprint 侧（team-blueprint-authoring）落文：只允许引用本节口径，不得另立第二套三分类词表。

## 落文轮边界（给 4d990c89 的备注）

- 收尾轮执行=文档 only；不动 `.agents/skills/**` 之外文件；改后按 skill 现行 frontmatter/词表风格复核（本文候选已按 SKILL.md 英文行文与"measured/closed set"风格撰写）。
- 本候选的 kit 判据名（RW-*）与代码名仅作锚点引用，不构成 skill 读者需要执行的命令；若落文轮认为锚点过密，可删锚点括号但**不得删语义句**。
- 本文件不构成 D-2 完成声明；D-2 状态推进由收尾轮+核验轮按 PENDING-GATES 流程登记。
