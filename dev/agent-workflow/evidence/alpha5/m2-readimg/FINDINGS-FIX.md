# FINDINGS-FIX — M2-READIMG-01 中心修复卡 · 五项一次修完（revision 2）

- 日期：2026-10-23（fix-card 轮）；owner：M2-READIMG-01（read_image，matrix row `read_image (M-05)`）
- 交付制式：**新 SHA 精确 delta 交 parent 独审**（本卡不 commit、不 mount、零 Host boot）。
- 三腿终验（runs/2026-10-23T08-04-59Z-arm2/）：`vitest 15/15 RC=0`；`eslint RC=0`（五文件）；`pnpm run typecheck RC=0`（包级全绿）。
- 修前首失全量保留（不涂改）：`runs/2026-10-23T08-00-12Z-arm2`（6 红）、`08-02-10Z`（1 红）、`08-02-49Z`（1 红）——含真实首失原文（如 port 桩作用域缺陷被臂如实映射成 `P_IMAGE_PORT_UNAVAILABLE … read is not defined … sideEffectPossible=false`，即"口违约 ⇒ 臂拒"路径本身在工作）。
- rev1 反例正本 = 本目录 `FINDINGS-BLOCKED.md`（root 07:38 六条 + rev1 代码原文引用，逐条在下认领）；rev1 测试历史 = git `e329ad05…`（不追溯编辑），其 17 腿身份保留于 `census-identities-arm.txt` 作历史普查；rev2 腿普查 = `census-identities-arm-rev2.txt`（15 腿，来自实跑）。

## 逐项：修复前反例原文 → 修复后拒/单飞原文

### 缺陷 1（ticket 不绑定五件；自报 exec 身份；WeakMap 自造账本）
- 修复前（FINDINGS-BLOCKED §2/rev1）："我的单飞是 **WeakMap-per-ticket**……第二次 prepare 发第二张票……各消费一次"；身份取 `exec?.agent?.identity`（自报）。
- 修复后（rev2 结构）：`image.mjs` **无任何账本/票据/身份自报面**——`execute(args, receipt, callFacts, signal)` 只消费 durable strict 链的 approve 回执（真 `createControlService` 行 + 人审 allow + fresh recheck + `guardOperation` check-and-reserve），消费点对 durable manifest 与当次 trusted facts **五件逐对**（member/call/authorityGeneration/definition/provider）。单飞在**中心**：correlation 级耐久消耗事实。
- 绿腿原文（实测）：
  - 正腿（真链）：approve 回执的 `manifest.schema === 'a5m1.pa-control-manifest.v2'`、`approvalCaseId === plan.approvalCaseId`、`parametersFingerprint === canonicalJsonFingerprint({file_path})`（耐久行自带，非 fixture 手交）；**同 correlation 第二次 leg ⇒ `decision:'deny'`（detail 命中 /guard|consum/）**，objects 仍 =1、commits 仍 =1。replay 中第二次 resolve 被服务拒：`ControlService: request 'ctrl-…' already carries a durable decision (the first decision is authoritative)`（耐久单决策律，runs/08-02-49Z 原文留档）。
  - 五对逐一拒：`P_IMAGE_CONSUMPTION_BINDING_MISMATCH`（五个 manifest 篡改 + 一个 callFacts 换 callId，每次 port 调用 =0）。
  - 无票不跑：undefined/deny/无 manifest/无 grant ⇒ `P_IMAGE_RECEIPT_INCOMPLETE`，port 0 / storeCalls 0。
  - 结构性反证：rev2 `image.mjs` 全文 `grep WeakMap|readFile|node:fs|resolveAnchoredPath` = 0 命中（腿内机器断言），无 `prepare/cancel` 面。

### 缺陷 2（假 readPort；三次路径解析 TOCTOU）
- 修复前：`readPort {stat→size, readFile(maxBytes)}`（FINDINGS-BLOCKED §6 判"最重"）。
- 修复后：臂 import 零 `node:fs`；读只走 root 裁定的 **`readBounded(grantRef, {maxBytes, signal})`** 口（同 FD 重锚、O_NOFOLLOW、final-FD、cap+1 截停在**口内**，"读到 cap+1 为止"）。臂端一次调用、审批前纯 lexical（`lexicalAnchor` 拒在一切 fs 之前）。**生产口 = CENTER 共享面**；本 lane 注入实现端口契约的合同双件（真实文件上 cap+1、one-shot grant 视图、口的原词 ANCHOR-DRIFT/fd-recycled）——头注已声明"口的同 FD 内部竞态律属 CENTER 腿，NOT_VERIFIED here"。
- 绿腿原文（实测）：cap 32B 部署对 69B 文件 ⇒ `P_IMAGE_READ_TOO_LARGE`，detail `the read answered 33 bytes against the 32-byte cap …refused after the capped read, BEFORE any commit — zero attachment writes`（cap+1 事实），storeCalls 0 / objects 0。口原词透出：`portCode 'ANCHOR-DRIFT'/'fd-recycled'` + detail 逐字包含（不映射新协议）。

### 缺陷 3（read 返回后 abort 仍 save）
- 修复前：readFile 返回与 commitImage 之间无重核。
- 修复后：`await read` 之后、`save` 之前同步重核 signal/drain ⇒ `P_IMAGE_CANCELLED_BEFORE_COMMIT`/`P_IMAGE_DRAINING`，零写；提交尾按真实 committed/unknown 分界。
- 绿腿原文（实测三点全零写）：pre-abort ⇒ `P_IMAGE_CANCELLED`（port 调用 0）；读中途 abort ⇒ `P_IMAGE_CANCELLED`（storeCalls 0）；**bytes 已回、commit 前 abort**（双件在 return 前 abort 执行信号）⇒ `P_IMAGE_CANCELLED_BEFORE_COMMIT`，storeCalls 0、objects 0。

### 缺陷 4（同内容跨 namespace 覆盖 owner）
- 修复前：`minted.set(attachmentId, {ns,ref})` 直接覆盖前主。
- 修复后：`image-attachment.mjs` 账本 = **`(namespaceKey, attachmentId)` entitlement 集**（namespace = durable 腿 member 身份 realm/team/instance 三件），每 entitlement 保存**完整 store ref**并在引用腿整只重呈。
- 绿腿原文（实测）：两 namespace 同字节 ⇒ **store 对象 = 1（去重是 store 特性）、commits = 2（所有权不去重）**；两 owner 引用皆 byte-exact（正控）；第三 namespace 引用 ⇒ `P_IMAGE_ATTACHMENT_FOREIGN_NAMESPACE` 且 **storeCalls 增量为 0**（负控）；未知 id ⇒ `P_IMAGE_ATTACHMENT_UNKNOWN`（亦 0 store 调用）；第二次 mint 后原 owner 引用仍可用（覆盖缺陷反证）。

### 缺陷 5（提交哈希一锅烩）
- 修复前：attachmentId 当源身份；reference 现读现算比内容。
- 修复后：回执分离 `sourceSha256`（按读入字节之 digest）与 store normalized 对象身份 `attachmentId`，`normalizedEqualsSource` 为独立事实；reference 对**原提交记录**（source digest 或 normalized 身份）核验，两者皆不中 ⇒ `P_IMAGE_ATTACHMENT_COMMIT_DRIFT` 拒服务。
- **本轮实测新事实（修正 rev1 一条假事实）**：pin639 真实 store 的 `attachmentId` 形如 **`sha256:<hex>`（带前缀）**；pass-through 保存时 hex === sha256(source)（probe 原文留 runs/ 及本文件附注）。等式律按去前缀形实现并断言：`sourceSha256 === sha(PNG)`、`attachmentId === 'sha256:'+sha(PNG)`、`normalizedEqualsSource === true`、对象路径 `objects/<hex[0:2]>/<hex>`（裸 hex，store lib :298 实证）。
- 真实 normalize 分歧腿（本 checkout）：metadata-PNG 探口 ⇒ store 原词 `INVALID_IMAGE "Unsupported or malformed image data."`（写前拒，objects 0）⇒ 臂映射 `P_IMAGE_STORE_LAW_REFUSED`。**本 checkout 无 sharp ⇒ 源≠normalized 的真分歧在本 lane 不可表示：NOT_VERIFIED（lane 环境限制，不作已证）**；双 hash **律**由 pass-through 等式腿钉住。

### 缺陷 6（对不存在的口写整条律）
- 认领不变（FINDINGS-BLOCKED §6）。rev2 全链只碰**核验过的真实面**：`parsePaControlManifest` 投影片段（无 family 四件——实测）、`lexicalAnchor` 返回形 `{ok:false, code:'locator-rejected', detail}` / `{ok:true, path}`、store `{ref,data}` 读对 + `AttachmentError.code`、pre-write 律码集（INVALID_IMAGE / IMAGE_TYPE_MISMATCH / IMAGE_DIMENSION_TOO_LARGE / IMAGE_TOO_MANY_PIXELS）。新造的只有**类型面**（`.d.mts`），零实现伪造。

## 本轮首失（不涂改，runs 留档）
1. port 双件 `read` 出块作用域 ⇒ 臂如实报 `the FS-PROC port threw (read is not defined)…the write boundary was NEVER crossed (sideEffectPossible=false…)`（6 红；修双件后绿）。
2. `attachmentId` 前缀形（上节）⇒ `normalizedEqualsSource false ≠ true` 一红；按实测形修律。
3. replay 二次 resolve 撞耐久单决策律（ControlError 原文在上）⇒ 双件改为让腿直行至 guard 消耗面（这正是该腿要证的中心事实）。
4. eslint 未用 import ×1、tsc 13 错全在本 spec（TeamBlueprint 无 templateId、signal 异步变异缩窄、classify union 收窄、cloneManifest 参数形、URL 双 lib 型冲突、crc 索引可空）⇒ 全修，零 ts-ignore/零 eslint-disable；终验 RC=0。

## family 薄层（bridge 阻塞的认领形状）
- `28d020b1…` 字段只落 raw reviewPayload；`parsePaControlManifest` 不投影 family 四件（types.ts:1081-1188 亲验）⇒ **无人可称 bound family closed**。臂不自补字段、不自算 digest：manifest **无** family 件 ⇒ 走投影内 target tie（`manifest.effects` 的 read.canonicalLocator === 本次 lexical target；换参腿/换 locator 腿绿，`P_IMAGE_TARGET_TIE_MISMATCH`）+ 回执披露 `family-facts:pending-center-finalization`（正腿断言在）。待 CENTER 投影落地 ⇒ 按值钉 familyId/adapterRevision/providerIdentity/targetManifest（伪造四形 ⇒ `P_IMAGE_FAMILY_FACTS_MISMATCH`×4；一致形 ⇒ 通过且无披露位）。**待中心定版点名**：`PaControlManifest` 增 `familyId/adapterRevision/providerIdentity/targetManifest` 之投影 + 可信族判别子（臂侧消费面已就绪，零新协议零新账本）。

## NOT_PROVEN（明写，未断言处 = 无）
- 生产 FS-PROC 口的同 FD 重锚/O_NOFOLLOW/final-FD/竞态律（CENTER 腿）；本 lane 仅端口契约双件。
- 真 attach-vision session-log 搭载与 render 面；placement masking（CENTER mount 轮 + Host dispatch）。
- 跨重启耐久 entitlement 账本（in-life 绑定已证，durable 属 Host）。
- sharp 在场时 normalized≠source 的真分歧（本 checkout 不可表示）。
- Guard/Control/PA 全链生产装配（本 lane = 登记的真实服务/装配类 + FileStorageSeam 世界，仍非 Host 进程）——**15 腿全非 C2**。

## 交付 delta（五件，parent 独审）
1. `packages/runtime/src/plugin/live/governed-families/image.mjs`（重写 rev2）
2. `packages/runtime/src/plugin/live/governed-families/image-attachment.mjs`（重写 rev2）
3. `packages/runtime/src/plugin/live/governed-families/image.d.mts`（rev2 消费面）
4. `packages/runtime/src/plugin/live/governed-families/image-attachment.d.mts`（rev2 消费面）
5. `packages/runtime/test/a5m2-readimg-arm-c2c3.test.ts`（rev2 15 腿）
（另：本证据目录 FINDINGS-FIX.md、census-identities-arm-rev2.txt、runs/2026-10-23T08-0{0,2,3,4}*-arm2、census 轮。）
