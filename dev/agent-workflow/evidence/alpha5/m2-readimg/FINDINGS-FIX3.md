# FINDINGS-FIX3 — 根复审（f3864b24-fix3 复核）定向修：all-allow 真 PA grant + 三处命名/文案（合并一轮）

- 日期：2026-10-23（fix4 轮）；owner：M2-READIMG-01。零 Host / 零 merge / 零 mount / 零 commit / 零 push。
- 两令合并执行（parent 08:3xZ）：all-allow 真 grant 修 + 头注措辞/正腿标题/drift 文案，一次精确 delta；已闭项（Ask family/plan 逐字段、reference drain、`recommits` 单名、normalized-only）未重开；未接 FS、未升 C2。
- 终验（runs/2026-10-23T08-39-02Z-fix4-final，rc 先落盘）：**vitest 16/16 RC=0；eslint RC=0；runtime typecheck RC=0**。普查 = `census-identities-arm-fix4.txt`（16 腿，实跑）。

## A. all-allow 真 grant（根复审主件）

### 错在哪（修复前反例原文，fix3 轮代码 + 绿色反证）
- `image.mjs`（fix3）：`grant: receipt?.grant ?? Object.freeze({})` + `...(manifest === undefined ? { callId: callFacts.callId } : {})`——把"无 Control 行"错当"无执行凭据"，在 all-allow 路上**构造了一个空凭据**。
- 反证（runs/2026-10-23T08-29-15Z-fix3-final，census-identities-arm-fix3.txt）：`✓ … world (a) all-allow … receipt undefined EXECUTES…` **绿**——空 grant 被 port 双件接受并完成了 read+commit。这正是根禁的"空值/伪造凭据"形。
- 真实现场（亲读 `team-tool-plane.mjs`，只读）：`:1166-1168` `let grant = null; if (decision.kind === 'admitted') { grant = decision.grant }`；`:1406` `const edge = assembly.consumeForExecution(grant, { … bindingId: grant.bindingId … })`。**无 Control 行 ≠ 无 PA grant**。

### 改成什么（修复后原文）
- 臂（`image.mjs`）：world (a) 注释钉死 "NO CONTROL ROW ≠ NO PA GRANT …（plane :1166-1168）…（:1406, CENTER's law）"；all-allow 分支新增 grant 法：
  `callFacts.grant` 缺失或无真 `grantId` ⇒ `P_IMAGE_CONSUMPTION_CONTEXT_UNKNOWN`（原文："no Control row means no durable approval, NEVER no execution credential — the arm does not synthesize one: zero port calls, zero attachment writes"）。
- port 输入统一为 `grant: executionGrant`（ask=铸出的 receipt.grant；all-allow=受信面交下的 decision.grant 原物）；`{}`/callId 替身形**删除**并注明为"本 revision 的伪造凭据形"。
- `image.d.mts`：新 `ImagePaGrant { grantId: string, [key: string]: unknown }`；`ImageReadBoundedGrantRef.grant: ImagePaGrant` **必填**（"a missing grant is a TYPE error here AND a runtime refusal in the arm (fail-closed in both shapes)"）；`ImageCallFacts` 改**判别联合**：`{approval:'ask', grant?: undefined} | {approval:'all-allow', grant: ImagePaGrant}`。
- 三态腿（新标题，census fix4 实跑绿）：`world (a) all-allow (root re-review on f3864b24-fix3): NO Control row but a REAL PA grant — …`
  1. **真 grant 被边消费（正）**：`grant {grantId:'grant-tadm-allow-1'}` 在 stand-in 面签发集内；`ran.ok=true`、`port.grants toContain('grant-tadm-allow-1')`（真 id 原样过边）、commits 1、**listControlState 行数不变**（零 durable 请求持续钉住）。
  2. **伪造/自造 grant（拒）**：形好但未签发 `{grantId:'grant-self-minted-9'}` ⇒ 消费面原文 `grant 'grant-self-minted-9' was never issued by this consumption face — the edge refuses; zero reads (the real unified PA final edge is CENTER's consumeForExecution)`，臂回 `P_IMAGE_PORT_REFUSAL`（原码逐字），commits/calls 均不增。
  3. **受信面未给 grant（typed 拒，零后端）**：`grant: Object.freeze({})`（fix3 的 bug 形）与 delete grant 两式均 ⇒ `P_IMAGE_CONSUMPTION_CONTEXT_UNKNOWN`，port counters.calls 不变（零 port 调用）。
  - 保留件：all-allow 呈交任何 receipt ⇒ `P_IMAGE_RECEIPT_INCOMPLETE`；unknown approval ⇒ `CONSUMPTION_CONTEXT_UNKNOWN`。
- 边仍归 CENTER：port 双件加的是 **lane ledger（见证面）**，注释与 NOT_PROVEN 头注均写明统一 final edge / execToken 单飞**本道未接线**。

## B. 三处文案/命名（parent 08:3xZ 合并令）

1. **"single-flight"误名**：`image.mjs` 头注（原 "The durable guard consumption IS the correlation-level single flight"）与 `:353-360` doc（原 "the single flight OUTSIDE this arm"）均改为事实描述：**CONTROL-SIDE reserve / one-shot view**；"The unified PA final edge and the exec-token single flight are CENTER's and are NOT WIRED in this lane"。全文再扫：src+spec 内 "single flight" 仅剩自我更正说明与 "NOT wired" 事实句，无误名残留；spec 内 4 处（头注×2、双件注释、replay 腿名）同步改 "NOT WIRED HERE"。
2. **正腿标题名实一致**：`C2 positive on the REAL chain (ask world)…` ⇒ `ASK-WORLD POSITIVE at component level (Control-harness chain — NOT Host, NOT the real mount)…`；describe `real strict-chain … (real chain + real store…)` ⇒ `Control-harness consumption … (in-process real Control/guard services + real store; NO Host, NO mount…)`；fixture 注释 `Drive the REAL chain … (human allow…)` ⇒ `Drive the Control-harness chain (in-process services, NO Host) … (LEADER allow decision + Control-side check-and-reserve)`。全文件 "C2"/"REAL chain" 标题字样清零。
3. **drift 拒详情单一接受条件**：`image-attachment.mjs` 原详情 "match neither the original source digest nor the store object identity"（二选一残留）⇒ "do not hash to the COMMITTED normalized object identity — that is the ONLY accept condition (no source/store either-or); refused as drift, never served"。

## 未证明（保持/新增）
- 统一 PA final edge（`assembly.consumeForExecution`）与 exec-token 单飞**本道未接线**：注入 port 是带 lane ledger 的替身消费面；all-allow grant 在缝上是**真形状**（decision.grant）但生产签发→过边的乘骑是 CENTER 轮。
- 其余 NOT_PROVEN 不变（attach-vision/render、跨重启 ledger、装配掩蔽、真 readBounded、sharp normalize 差异）。

## 交付 delta（fix4 轮，同四件路径，无新文件面）
`image.mjs`（真 grant 法/executionGrant 单点/伪造形删除/两处 reserve 措辞）；`image.d.mts`（ImagePaGrant + grantRef 必填 + ImageCallFacts 判别联合）；`image-attachment.mjs`（drift 详情单一条件）；spec（标题×2+注释、makePort issuedGrants ledger、all-allow 三态腿重写、NOT_PROVEN 新条、single-flight 清扫）。证据：本卷 + `census-identities-arm-fix4.txt` + runs/2026-10-23T08-38-34Z-fix4（首跑）+ runs/2026-10-23T08-39-02Z-fix4-final（终验）。
