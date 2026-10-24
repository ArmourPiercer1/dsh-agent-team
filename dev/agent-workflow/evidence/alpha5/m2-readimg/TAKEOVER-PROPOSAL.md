# M2-READIMG-01 — 前置接管落地方案（P 层补越界主缺口；共享文件 diff 提案交 CENTER 落笔）

- 日期: 2026-10-23（UTC）。锚 = worktree `feat/a5-m1-center-kernel` @`7a3540937e`，宿主 pin639。
- 主缺口（parent 独立复验 + 本卡亲读一致）：`read-image.ts:263` 走 `ctx.fs.readBytes`；宿主 `fs-sandbox` containment 只罩写面（`index.ts:107` 仅 `writeText/editText` 经 `checkedTarget:121-143`；`readBytes` 在 fs-sandbox 内零命中）⇒ **读面越界拒绝完全委托所挂 ctx.fs 后端；LocalFileSystem 无根约束**。CORE PATCH BUDGET=0 ⇒ 补口在我方 P 层做**前置接管**。
- 合同面（§3，不扩架构）：`I + F(read exact file) + S(attachment-store, create, write) + S(session, attach-vision, write)`，绑定 bytes/pixels 上限 + 目标会话/attachment namespace；**不是 write 家族**。路线=FS-PROC 受控读；attachment adapter（SERVICE）只在批准后创建/引用；容量检查在读取时落实。

## 1. 新 P 层模块（本卡 owner，新建文件，批准清单内）

`packages/runtime/src/plugin/live/read-image-takeover.mjs`

```
createGovernedReadImageExecutor({ realmId, rootDir, policy, decide, pa, subtreeContains,
                                  attachments, llmRoute, observe })
  → (raw, corr) => outcome   // 与 read 行同款 tagged-union 出口；拒绝=verbatim 文本 throw
```

execute 检查序（全部先于任何 IO；每臂 typed：`refused-<class> <code> — detail`）：
1. **参数面**：恰好 `{ file_path: string 非空 }`；**未知顶层键 = typed 拒**（宿主顶层未声明 `additionalProperties:false` 的实测事实——见 FINDINGS-C1 §cross——由 P 层在 admission 收紧）。
2. 扩展名声明表（4 格式，公共语义表重实现，**不 import 宿主内部**）/ 无扩展名→读后嗅探。
3. 部署 mediaTypes 集 + `limits = attachments.imageLimits`（注入的公开 SERVICE 面读取）。
4. **route gate**：`llmRoute(provider, model, signal)`（= 宿主 `ctx.get('llm').resolveModelInfo` 公开面注入）；非 image-capable ⇒ typed 拒（镜像 `:125/:129` 语义）。
5. **锚定（主缺口补口）**：`resolveAnchored(rootDir, file_path)` 复用 `plane-effect-backends.mjs:180-203` ⇒ `target-outside-governed-root` / `symlink-alias` typed 拒，**先于 open**。
6. **容量在读取时**：stat 尺寸 ≤ `byteCap = min(limits.maxImageBytes, limits.maxMessageImageBytes)`，超限 typed 拒（FS_TOO_LARGE 语义），再经受控读。
7. **FS-PROC 受控读**：走 plane 的 ControlledFs 实例根面（与 read 行同一 executor 底座），**不经宿主 ctx.fs**。
8. 无扩展名嗅探 / 声明-vs-字节不符 ⇒ typed rename/convert 臂（镜像 `:316-319` 语义）。
9. **批准后 SERVICE 腿**：`attachments.saveImage({data, mediaType, name})`——注入的是 **namespace wrapper**：键 = `(realmId, 目标 session id)`；每次 commit 记 `attachmentId → (realmId, sessionId)` 台账；引用/render 面只认同 namespace 台账内 mint 的 ref ⇒ 附件/渲染存储保持授权身份（S0 危险面"附件落未授权渲染路径/缩略图绕过"= 台账外 ref 不可渲染）。
10. render：信封文本 + image block（单一事实=saveImage ref；presentationMeta={path}）。
11. cancel：signal 贯穿 6-9；saveImage 原子提交 ⇒ 提交前取消 = 0 附件写（C3）。

## 2. 共享文件 diff 提案（**父方落笔**；本卡不触碰）

### `team-tool-plane.mjs`
- (i) import 行（`:80` 旁）：`createGovernedReadImageExecutor` from `'./read-image-takeover.mjs'`。
- (ii) `:465-478` `PLANE_SUPPORTED_NATIVE_TAKEOVERS` += `readImage: Object.freeze(['read_image'])`；注释按 natexe 台账法写明同名同义实现=（iv）装配的 executor（装配失败=null ⇒ 挂载名回到 `PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED` 拒，零翻转）。
- (iii) `:742` 同位 `const readImageName = input.plane?.readImageName ?? 'read_image'`；`verifyPlaneNames`（`:480-500`）rows += `['read_image', readImageName]`——reserved 判定/碰撞/形状检查全部骑现逻辑。
- (iv) `:1654-1663`（`readExecutor` 构造位同位）：
  `readImageExecutor = fsInstance 有效 && input.attachments != null && input.llmRoute != null ? createGovernedReadImageExecutor({ realmId, rootDir: fsInstance.rootDir, policy: permissionPolicy, decide, pa: paAdmit, subtreeContains, attachments: input.attachments, llmRoute: input.llmRoute, observe: logBackend('a5m2-readimg') }) : null`
- (v) `:1723-1782`（`baseDefs`）：`readImageExecutor !== null` 时追加 def：`name: readImageName`；parameters=pin639 公开 schema 等价 + **顶层 `additionalProperties:false`（P 层收紧）**；execute=executor（取消走行形态，同 read 行 `cancelled` present-row 法）；output=展示面（纯投影）。
- (vi) `placedByName`/`placementFeed`/`ownNames`（`:1806-1811`）骑 allDefs 现机制，**零新机制**；guard 车道效应类枚举（`:587/:601`）已含 read_image，不改。

### `agent-bindings.mjs`（装配 glue，CENTER）
- plane 输入注入 `attachments = ctx.get('attachments')`（宿主公开服务面）+ `llmRoute = (p, m, s) => ctx.get('llm')?.resolveModelInfo?.(p, m, s)`；任一缺失 ⇒ 行不装配（条件不可用继承，与宿主 inject 门同语义）。

### `pa-mount-registry.mjs`
- **零改动**（binding identity matcher 按 family 键，挂载无关）。

### 配置/strict
- 闭合键 `plane.readImageEnabled`（jobsEnabled 法；缺省=不装配行）；strict Profile 维持 S0 默认处理（未验收前 read_image 由 default-deny 车道拒，`:601` 现成）。

## 3. 验收链（逐格）

1. 合入后本卡补 `read-image-takeover` 单测套件：越界 typed 拒 + 零 IO、cap、取消、namespace 台账、未知顶层键拒。
2. 本卡补 plane 装配整合测（placement/ownNames/feed 身份 + 零翻转字节等值）。
3. **Host owner 排 Host 腿**：真实 Guard/真实附件/attach-vision session-log ride/ask-lane 一次性消费/**接管名遮蔽宿主原生名**的 dispatch 实测（precedence 由 read 行机制继承，但"遮蔽已发生"必须 Host 实证，不口头宣称）。
4. 矩阵行按 scope 升格；行级 LIVE-CONFIRMED 只写实测 scope。

## 4. 边界诚实

- 本提案不主张宿主原生面被改变（CORE PATCH BUDGET=0）；主张的是 Team 装配面上 read_image 行的前置接管可达。
- 宿主原生面自身的越界行为（无根后端下任意可读）保持原样——strict Profile 下该行不得免治理可达（default-deny 车道现成）。
