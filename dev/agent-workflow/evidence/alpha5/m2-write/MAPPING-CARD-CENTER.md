# write 跨中心接口收口 · 精确现接口映射 + 需变文件（CENTER 交根核，根核后才动共享件）

## 一、现接口真身（本仓亲读，行锚 = 提交树/宿主树实测）
| 段 | 真身 | 事实 |
| --- | --- | --- |
| M1 完整开边（权威；**本卡前版锚位有误，已按根核更正**） | `team-tool-plane.mjs`：`paAdmitPartA :1001`、`paAdmitEdge :1221`、`paAdmitBody :1423-1435` | 签名逐字 `paAdmitEdge = async ({ grant, paDurableMint, request, placementName, paConstructionBinding, realmId: callRealm, callId, parametersFingerprint, requestedEffects, signal })`；`paAdmitBody` 先跑 `paAdmitPartA(input)`，**`:1425 if (opened.ok !== true) return opened`** ⇒ 非 allow 时边根本不被调用；边内先 fresh epoch/generation/五件漂移/approved-question 再核（`:1253-1391` 一律 `stale()`→deny；注释 `:1222-1223` "Every failure below is zero-body by construction"）；**consume 传参 `:1406-1416`**、失败 `:1417-1419` deny、中止 `:1403-1405` `{allow, cancelled:true}`。前版把 `plane-effect-backends.mjs:1221-1416` 当开边是错的：那是**读执行段**（其 `:1441-1453` 为同句柄核验），不是写消费边。 |
| 一次性消费 | `packages/runtime/tool-admission/admission-kernel.ts:187/:582/:632`；出厂 FS 端口 `:1015/:1109`（`:682` 注「THE FS PORT is the kernel's own execution…」） | `consumeForExecution` 属 kernel face；`consumedCount()` 为可观测计数 |
| 身份/代际再核（权威） | `packages/runtime/control/types.ts` `PaControlManifest:1027+` / `parsePaControlManifest:1081+`；guard 比对 `packages/runtime/operation-permission/pa-control-bridge.ts:776-800`；当前事实 `PaCallFacts:1403+` | guard 逐字段比 `binding{bindingId,agentScopeKey,toolName,**definitionIdentity**,**providerId**,implementationOrigin,executionBoundary,status,policyGeneration,authorityGeneration,revision}` + assurance 指纹 + member ⇒ **definition/provider 新鲜再核是中心辖区，臂不可能自证** |
| 写片现状 | `packages/tools/a5p5-tools/src/write-slice.ts`：`lexicalWriteAnchor:144-170`（零 fs，可原样复用）；`SliceCanonicalize:228`（类型**不禁止**访问 fs ⇒ 纯 lexical 靠装配侧）；`checkCallIdentity:627`（未导出）；单飞账单 `:416-`（correlation-only，非账本）；`identityMismatch:652`（**不含** definition/provider 再核）；`makePort` 臂 `:597` 直接 `createFsAdmissionPort`；取消三出口 `:527/:551/:571`；`mapLaneError:378-398`（已导出，可搬） | 根裁两条成立：审批前存在 realpath/exists；直接 port consume ≠ paAdmitEdge |
| 测试件不可复用点 | `packages/tools/a5p5-tools/test/a5m2-write-slice.test.ts:257-265` | `resolveTarget` 用 `existsSync/realpathSync` ⇒ **本身是 FS 访问**，证不了 pending 零 FS；N16 位置属性随纯 lexical 落地而改 |

## 二、需变文件（一次精确 delta，零新 ledger、零大框架）
1. `packages/runtime/src/plugin/live/team-tool-plane.mjs`：**write 受管臂 = 整条复用 `paAdmitPartA → paAdmitEdge`**（开上下文经 `...input` 原样带入 + PartA 交回五件），**单一消费归属**：消费唯一发生在边内 `:1406` 的 `consumeForExecution`，**禁止只摘 `consumeForExecution`**；C-FS 侧改由第四节的新内部口落字节，**不再二次 consume**。
2. `packages/tools/a5p5-tools/src/write-slice.ts`：`resolveTarget`/`canonicalize` **审批前纯 lexical**（key 取词法稳态键，contentHash 半不变）；root/FD 核验**后置**到批准后执行边（复用 1 的 `verifyOpenedHandle`）；`identityMismatch` 保留但对 definition/provider 只作**消费前提示**，权威再核归 1/中心。
3. `packages/runtime/operation-permission/pa-control-bridge.ts` + `packages/runtime/control/types.ts`：新族 family 判别与四件 P-adds 全链（见另一条 bridge 集中卡，**同轮**闭，勿两处各改一半）。
4. `packages/runtime/dist/**` 8 项漂移 + `scripts/place-dist-glue.mjs`：write 源稳定后标准构建一次精确同步（我 = build 唯一 writer）。
5. `packages/testkit/test/p4t6-session-event-scan.test.ts`：census 格式行已闭（lane 105/106 唯一红已在 `e922591d` 消除；owner 报的是 c978eb2fc 旧态）。
6. `packages/tools/a5p5-tools/src/index.ts`（barrel）：仅在 1/2 需要新导出时动。

## 三、不改的（口径钉住）
漂移 seam 仍**候选 C1、未接生产**（不称 C2）；`root/祖先漂移` 生产接入不在本卡；零新 ledger；零概率循环/新探针；`mapLaneError` 的 undetermined 恒保 `sideEffectPossible` 不变。

## 四、三点实测答（原 write owner 只读核证，CENTER 复核；按根令补入本卡，不另立新文档）
1. **真实 final edge 完整上下文**：开上下文五件 `realmId, callId, parametersFingerprint, requestedEffects, signal` 由 `paAdmitBody:1427` 的 `...input` 带入；PartA 交回五件 `grant, paDurableMint, request, placementName, paConstructionBinding`（`:1218` 逐字，`:1428-1432` 注入）。硬锚：`:1425` 决定"未 allow 零下游"；边内每条失败路径都先于 `:1406` consume 返回。信任边界一句话：**授权只活在"PartA 完整验核 → 边内 fresh 再核 → 一次性 consume 成功"这条事实链上，`grant` 对象本身不是许可**；写侧必须整边带走。
2. **免二次 consume 的内部入口 = 明确新口（现树不存在，不伪称现成）**：拟 `packages/runtime/controlled-fs/src/` 出工厂
   `createPostConsumeWriter(config: { instances; now?; currentAuthorityGeneration?; visibility?; subtreeContains? }): { writeTextApproved(approved: { anchorReal: string; approvedLocator: string; content: string }): Promise<GovernanceResult<FsWriteReceipt>> }`
   **不做**：不 consume、不调 `revalidateGrant`/`recheck`、不自铸权威、**不接受布尔 `consumed` / 裸 `OperationGrant` / "已 allow" 标志当许可入参**；成员/指纹类参数**刻意不入参**（防自证）。注入者唯一 = CENTER（装配事实）。既存反证：`revalidateGrant`（`controlled-fs.ts:256-278`，`:273` `grant-consumed`→APPROVAL_STALE）与端口 `:1115` 双拒已消费 grant；`NO_RECHECK` 是 pre-freeze 零准入语义，**不是**此口。
3. **截断前身份核验次序（逐条现成 / 需新写）**：
   - fd 逃逸检查（`/proc/self/fd` realpath + `isBeneath`）：**现成** `open-at-exec.ts:74-86`；
   - 同 FD `fstat` dev/ino 对 pre-open lstat 快照：**现成** `open-at-exec.ts:87-91`（读写共用）；
   - **"批准 root 身份"比对基**：**需新写**（`anchorReal` 由 `bindTarget` 现场 `realpathSync(instance.rootDir)`，`controlled-fs.ts:246`；`verifyOpenedHandle` 无批准值入参位）；
   - **不截断打开**：原语现成（`safeOpen` flags 入参 `:338` `flags|O_NOFOLLOW`），但 `writeText` 硬编码 `O_WRONLY|O_CREAT|O_TRUNC`（`:564`）⇒ **新调用序需新写**；
   - **验证后 truncate**：**需新写**（全树零 `ftruncate`/`FileHandle.truncate` 调用）；
   - `openat2`/parent-FD：**不存在**（`ARBITRARY_TREE_PROFILE_PUBLISHED=false`，`admission-binding.ts:146`），本轮范围外如实标注。
