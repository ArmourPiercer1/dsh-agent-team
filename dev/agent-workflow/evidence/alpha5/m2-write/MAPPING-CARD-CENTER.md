# write 跨中心接口收口 · 精确现接口映射 + 需变文件（CENTER 交根核，根核后才动共享件）

## 一、现接口真身（本仓亲读，行锚 = 提交树/宿主树实测）
| 段 | 真身 | 事实 |
| --- | --- | --- |
| M1 完整开边（权威） | `packages/runtime/src/plugin/live/plane-effect-backends.mjs:1221-1416` | `:1242-1244` policy 默认拒；`:1246-1250` 冻结 A 异步 PA 边（"NOTHING below runs until that edge says allow"）；`:1258` 取消 ⇒ 零消费；`:1259-1273` token 账单（**沿用原 id**，不新造）；`:1441-1453` **exec-time** `verifyOpenedHandle`（同句柄重解析 + 快照 dev/ino 一致 + `read-too-large` 上限） |
| 一次性消费 | `packages/runtime/tool-admission/admission-kernel.ts:187/:582/:632`；出厂 FS 端口 `:1015/:1109`（`:682` 注「THE FS PORT is the kernel's own execution…」） | `consumeForExecution` 属 kernel face；`consumedCount()` 为可观测计数 |
| 身份/代际再核（权威） | `packages/runtime/control/types.ts` `PaControlManifest:1027+` / `parsePaControlManifest:1081+`；guard 比对 `packages/runtime/operation-permission/pa-control-bridge.ts:776-800`；当前事实 `PaCallFacts:1403+` | guard 逐字段比 `binding{bindingId,agentScopeKey,toolName,**definitionIdentity**,**providerId**,implementationOrigin,executionBoundary,status,policyGeneration,authorityGeneration,revision}` + assurance 指纹 + member ⇒ **definition/provider 新鲜再核是中心辖区，臂不可能自证** |
| 写片现状 | `packages/tools/a5p5-tools/src/write-slice.ts`：`lexicalWriteAnchor:144-170`（零 fs，可原样复用）；`SliceCanonicalize:228`（类型**不禁止**访问 fs ⇒ 纯 lexical 靠装配侧）；`checkCallIdentity:627`（未导出）；单飞账单 `:416-`（correlation-only，非账本）；`identityMismatch:652`（**不含** definition/provider 再核）；`makePort` 臂 `:597` 直接 `createFsAdmissionPort`；取消三出口 `:527/:551/:571`；`mapLaneError:378-398`（已导出，可搬） | 根裁两条成立：审批前存在 realpath/exists；直接 port consume ≠ paAdmitEdge |
| 测试件不可复用点 | `packages/tools/a5p5-tools/test/a5m2-write-slice.test.ts:257-265` | `resolveTarget` 用 `existsSync/realpathSync` ⇒ **本身是 FS 访问**，证不了 pending 零 FS；N16 位置属性随纯 lexical 落地而改 |

## 二、需变文件（一次精确 delta，零新 ledger、零大框架）
1. `packages/runtime/src/plugin/live/plane-effect-backends.mjs`：**新增 write 受管臂 = 复用 `paAdmitEdge` 同一条开边**（policy → PA 冻结 A → token 账单 → 批准后 `verifyOpenedHandle` 同句柄核验 → C-FS 写入），**单一消费归属**；C-FS 侧不再二次 consume（消费仍唯一在 `consumeForExecution`）。
2. `packages/tools/a5p5-tools/src/write-slice.ts`：`resolveTarget`/`canonicalize` **审批前纯 lexical**（key 取词法稳态键，contentHash 半不变）；root/FD 核验**后置**到批准后执行边（复用 1 的 `verifyOpenedHandle`）；`identityMismatch` 保留但对 definition/provider 只作**消费前提示**，权威再核归 1/中心。
3. `packages/runtime/operation-permission/pa-control-bridge.ts` + `packages/runtime/control/types.ts`：新族 family 判别与四件 P-adds 全链（见另一条 bridge 集中卡，**同轮**闭，勿两处各改一半）。
4. `packages/runtime/dist/**` 8 项漂移 + `scripts/place-dist-glue.mjs`：write 源稳定后标准构建一次精确同步（我 = build 唯一 writer）。
5. `packages/testkit/test/p4t6-session-event-scan.test.ts`：census 格式行已闭（lane 105/106 唯一红已在 `e922591d` 消除；owner 报的是 c978eb2fc 旧态）。
6. `packages/tools/a5p5-tools/src/index.ts`（barrel）：仅在 1/2 需要新导出时动。

## 三、不改的（口径钉住）
漂移 seam 仍**候选 C1、未接生产**（不称 C2）；`root/祖先漂移` 生产接入不在本卡；零新 ledger；零概率循环/新探针；`mapLaneError` 的 undetermined 恒保 `sideEffectPossible` 不变。
