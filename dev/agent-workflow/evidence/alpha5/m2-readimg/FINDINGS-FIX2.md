# FINDINGS-FIX2 — 根对 f3864b24 裁决的三件修复轮（部分关闭/总 BLOCK 的应轮）

- 日期：2026-10-23（fix3 轮）；owner：M2-READIMG-01。零 Host / 零 merge / 零 mount / 零 commit。
- 不重开项（根裁定）：取消读后 save 前、namespace entitlement、source/normalized hash 分离——维持；normalize 差异维持 NOT_VERIFIED。
- 终验（runs/2026-10-23T08-29-15Z-fix3-final，rc 先落盘）：**vitest 16/16 RC=0；eslint RC=0；runtime typecheck RC=0**（本轮全包绿；中途 write-lane 自有红见下"非我文件"）。腿普查 = `census-identities-arm-fix3.txt`（16 腿，实跑）。

## ① 强制 approve + durable requestId 误杀 all-allow —— 已修
- 修复前反例（本卡 fix 轮原文）：execute 无条件要求 `decision=approve + requestId + manifest + grant` ⇒ "没有 Control 行/没有 requestId" 被当错误路径拒——误杀策略全放行世界。
- 修复后（消费执行上下文，按 root 两世界）：`callFacts.approval` 必为 `'ask' | 'all-allow'`（trusted 面给出，臂不猜、缺值 ⇒ `P_IMAGE_CONSUMPTION_CONTEXT_UNKNOWN` 零后端）。
  - (a) all-allow：receipt 必为缺席；`execute(args, undefined, facts)` 执行（绿腿实测：port 1、commits 1、**listControlState 行数不变 = 从未需要行**）；此处呈交任何 receipt（含 `requestId:'ctrl-placeholder-0'` 形）⇒ `P_IMAGE_RECEIPT_INCOMPLETE`（"the all-allow world has no approval to present … 伪 requestId/占位 id/自造 approval are refused in both worlds"）。
  - (b) ask：真 durable requestId + 真批准回执四件门原样保留。
- 统一 PA final edge 归 CENTER：臂只区分世界，不建边。port 输入在 all-allow 显式带空 grant 对象 + trusted callId（无 mint 就无 id，绝不伪造型）。

## ② family 缺失放行已删；"投影剥字段"说法已更正（错误认领）
- **错误认领（原文在案）**：本卡 fix 轮写"parsePaControlManifest strips them；raw row carries them @28d0b1…"。真实情况（f696e6f2，亲读代码）：`parsePaManifestFamilyBlock` 四件 all-or-nothing 全值保留（partial ⇒ 整个 manifest fail）；`createPaControlLeg` 对注册族在**行之前**拒缺件/残件/与注册不符（`family-review-facts-missing / -incomplete / family-mismatch / family-adapter-revision-mismatch / family-provider-identity-mismatch / family-claim-on-unregistered-binding / family-target-invalid`）；`PA_FAMILY_TARGET_RULES['B-IMAGE']` 按本族 typed plan 落九键闭集。我的 chainCase 走旧路**只因为它自己没传 `input.family`、没注册 `governedFamilies`**。文字已在 arm 头注、spec 头注、本卷更正；此后不再写"投影把字段剥了"。
- 修复后臂律（绿腿实测）：
  - 真链携带：注册 `governedFamilies` + `input.family` 后，耐久行 manifest 自带 `familyId:'B-IMAGE'/adapterRevision:2/providerIdentity/targetManifest`（正腿断言，行原文见 FIX2 runs）。
  - **无放行**：剥掉四件任一 ⇒ `P_IMAGE_RECEIPT_INCOMPLETE`（"never a pending release"）；`disclosure` 位随放行一并删除（断言 `disclosure not in outcome`）。
  - **完整 typed plan 逐字段**（非四值）：伪造 familyId/adapterRevision/providerIdentity/**byteCap/declaredMediaType/businessObligations/缺 plan 字段/多 plan 字段** 8 形逐一 ⇒ `P_IMAGE_FAMILY_FACTS_MISMATCH`（每形 fresh 真批准）。
  - 中心边见证：注册族 input 无 carrier ⇒ leg 在行前 `deny('family-review-facts-missing: B-IMAGE')`（断言命中）。
- 本轮中心链接线的首失（不涂改，runs 08-26~08-28Z-fix3）：真携带后行被 deny（`the approval was denied (deny)`）两层原因实测定位——(1) member ask 的 decider 是 **leader**（carrier: member ask → leader-approval），fixture 用 human resolve 不落决策 ⇒ 改 `leaderCaller()`（与登记 spec 一致）；(2) `PaCallFacts` 新增 **`governedFamily`** 当前注册面（0c8f6cf4 第 3 点"compared to current facts"），fake 未答 ⇒ guard 视为 registration-vanished。两层都是**中心接口收紧，臂与 fixture 跟上**，非中心缺陷。

## ③ 引用面三小件 —— 已修
- `reference` 补 drain/取消（与主路径同纪律）：drain 后 ⇒ `P_IMAGE_DRAINING`（storeCalls 0）；pre-abort ⇒ `P_IMAGE_CANCELLED`（storeCalls 0）；fetch 在途撞取消 ⇒ 拒**投递**（原文说明 fetch 不可召回、该腿零写入）。
- 计数口径统一：`recommits` 一个事实一个名（init+increment+stats+.d.mts 同名；`recomputes` 幽灵键清除并有断言 `stats keys 不含 recomputes`；re-commit 断言 commits+1 / recommits=1 / objects=1）。
- `referenceImage` **只验已提交 normalized 对象**：`reread sha === bareHex(提交 attachmentId)` 为唯一接受条件；source digest 是回执记录事实，不再是"任一命中"的旁路。反证腿：说谎 store（save 真 ref / read 篡改字节）⇒ `P_IMAGE_ATTACHMENT_COMMIT_DRIFT` 且 `bytes` 不服务（leg 内注明：该假 store 是本适配器核验律的合同探针）。

## 措辞纪律（根口径，全文执行）
- "Control consume ≠ PA consume"：正腿/标题改为 durable check-and-reserve（Control 侧），统一 PA final edge / execToken 并发单飞 = CENTER，NOT_PROVEN here。
- "读完才 add 的 oneShot Set 不是并发单飞"：port 双件的 consumed 集全部改称 **sequential consumed-view guard**（spec 头 + 代码注释 + 腿名），不称单飞。
- 真 `readBounded` 生产口仍缺（声明不变）。

## 非我文件（只报不修）
- 中途包 typecheck 唯一红 = `test/a5m2-post-consume-write-c1.test.ts:39 TS2339 'pid'`（write-row owner 在写面）；我的五文件全程零命中；终验轮全包 RC=0（该文件已由其 owner 转绿，非我改动）。

## 交付 delta（fix3 轮，五件同路径）
`image.mjs`（上下文分世界 / family 无放行+逐字段 / reference 纪律 / grantRef 空授形）；`image-attachment.mjs`（recommits 同名 / normalized-only 核验）；`image.d.mts`（`approval` 上下文、grantRef.callId、去 disclosure）；`image-attachment.d.mts`（stats 键名）；spec（carrier 真携带 + governedFamilies + governedFamily facts + leader resolve + 新 all-allow/伪造/漂移/draining-reference 腿 + 全文措辞）。证据：本卷 + `census-identities-arm-fix3.txt` + runs/2026-10-23T08-2{5..9}*Z-fix3*。
