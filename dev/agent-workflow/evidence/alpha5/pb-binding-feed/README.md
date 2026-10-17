# pb-binding-feed — P-B §6 BINDING FEED 正式接线：受治理 `read` 的正控可达化（live 宿主 22+3=25 判据全绿）

Writer lane: **P-B-R2**（pb §6 binding feed 接线 = 正控可达化）。Base `master@230022598dc9`
（origin/master 最新，"W-PTC-OUTERFS … (#301)"），branch `alpha5-pb-binding-feed`，一次性
worktree `.worktrees/alpha5-pb-binding-feed`。Host pin `0.2.0-rc.2 @ 639ed01539`（test-use
porcelain 0 before AND after，C-PIN/C-PIN-AFTER）。Port **3184**（本 lane 自证空闲，
C-PORTS/C-PORT-AFTER）；`:3080` 仅只读探测 401→401（C-3080-BEFORE/AFTER），从未操作。
世界 `tests/homes/a5pbr2-*` 跑毕即删（kit teardown；收口时核验 0 残留）。模型自报：
qwen3.8-flash-next。

## 1. RED（先复现，钉死原文）

install-entry 实证（`feat/alpha5-install-entry-evidence@6a0f8e19`，
`evidence/alpha5/install-entry/runs/2026-10-17T17-06-56Z/world-team.json` 的
`memberReadResult`）：受治理成员对 `read` 的 dispatch 被 guard 拒——

> `team tool guard: the Tool Binding for "read" cannot be verified at dispatch time (no fallback to the native body)`

placement 指纹比对**已在产**（`scoped-dispatcher.ts:362-381` noteCallEdgeDefinition：每调用把
`tools.get(name, scope)` 现场解析的 Definition 指纹与 Binding 钉住的 `definitionIdentity` 比对），
但 provider 侧的 **binding feed**（Team 放置的 verified Definition 身份 → per-call 比对输入，
pb-CONTRACT §6）未接。全 ref grep `bindingFeed` = 0 命中：本支是第一次正式化。

## 2. 修法（lane 面，pb §6 接线）

`packages/runtime/tool-dispatch/install.ts`（+ barrel `index.ts` 导出）：

- `InstallScopedGuardInput` 新增 `realmId?: string`、`bindingFeed?: BindingFeed`
  （`BindingFeed = (name) => { definitionIdentity, realmId } | undefined`，Team 放置记录的 provider 面）。
- `definitionIdentityOf(target)` 导出：把任意对象的 `.execute` 投进 Guard 比对的**同一** WeakMap
  指纹代数（`def#N`），provider 与 Guard 从此共享一个身份代数。
- `bindAll` 的 `team-own` 分支加三道闸（有 feed 条目时）：
  ① **realm 配对**（feed.realmId ≠ install.realmId ⇒ typed 拒，含 `Realm 不可混淆`，observe
  `bind-refused-feed-realm-mismatch`）；② **placement 门**（feed 名必须 ∈ `assemblyOwnedNames`，
  否则 `never placed` 拒，observe `bind-refused-feed-unplaced-name`）；③ **placement 完整性**
  （feed 记录的指纹 ≠ bind 现场解析的指纹 ⇒ `the Body moved between placement and bind` 拒，
  observe `bind-refused-feed-placement-drift`）。三闸全过 ⇒ 钉 feed 身份 + verified +
  `implementationOrigin: 'team-trusted-extension'`（诚实来源，不伪装 dsh-native），observe
  `binding-feed-verified`。
- **无 feed ⇒ bind 路径逐字节回到现码**（feed 只收紧不放宽；现产 glue 不传 feed ⇒ 行为恒等，
  trio 别名继续走既有 bindOwnTools）。**零回退到 native body**：guard 律（closed-world-guard.ts:199）
  一字未动。

三语义（pb §6）在 lane 测试 `packages/runtime/test/a5pbr2-binding-feed.test.ts` 亲验
（10 腿：R1 RED 原文钉死 + R2 feed-无-bind≠allow + F1 正控 + F2 无-feed 字节恒等 + D1 撤销/回移不复活/
显式 re-bind 复位 + D2 bind-time 完整性 + X1/X2 跨 realm + X3 未放置名（R5 律）+ ID1 身份代数）：**绿**。

## 3. LIVE 正控新腿（本目录，a5pbr2-kit.mjs + a5pbr2-row.mjs）

W5 世界形（零生产行挂载，唯一挂载 = 本 kit 行经公共 profile-patch seam；行 import
**committed dist** 的 tool-dispatch barrel = 出厂面，W0a 字节同一论证）。真钉定宿主 :3184，
mock 模型驱动真 session 真 dispatch。**同一个名字 `read`，三个 session，三种 live 答案**
（一个 Binding 名只保一个稳定 family（closed-world-guard.ts:370），red-先-publish 与 green-先-bind
不能同居一 scope——故 RED/GREEN 分坐两 session，名字与原文不变）：

- **red**：无 feed 的 `read` double、guard 以实测全局面（**[]**，bind-diag 律 live 复测）安装并发布，
  不 bind。wire 调用 ⇒ **逐字原文拒**，double Body 计数 **0**（"零回退" 的 live 证人）。
- **green**：§4.1 顺序（place → realm 配对 + feed 安装 → `bindOwnTools`（feed 验证，
  origin=`team-trusted-extension`，identity=`def#N`）→ publish）。wire 调用 ⇒ **放置的 read 真执行**
  （node:fs 真读世界夹具），夹具字节 + TOKEN 经真宿主结果组装**合法回传到模型**。随后 live 跑 §6 语义：
  `drift`（dispose+换体）⇒ wire 撞 drift 拒、mutated Body 0；`restore`（原对象回位）⇒ **仍拒**
  （撤销永久，旧验证永不转移）；`rebind`（属主 assembly 显式重绑 = 唯一文档化归路）⇒ 再执行、字节回传。
- **realm**：同放置、feed 条目声称另一 realm ⇒ `bindOwnTools` typed 拒（`Realm 不可混淆`），
  不发布，wire 调用亦拒（PREPARING 拒式），放置 Body 恒 0。
- **GLUE-6 界定腿**：#308 `PLANE_PRESENTATION_FACE` 形（render 返回 String）的放置 def，按生产
  plane 现状绑定（放置名、无 feed 条目 = 现 placement-attribution 路）⇒ **dispatcher 层绿**
  （guard 弃权、Body 真跑，计数 1），宿主结果组装答复**逐字记录** =
  `Error: content.some is not a function` —— 与 install-entry S3 行同型崩，**归 GLUE-6 并行修复
  （branch `alpha5-glue6-fix`），本笔引证不越面修改**。

**跑毕记录** `runs/2026-10-17T17-44-31Z/`（verdict=GREEN **22 判据 pre-verdict + 3 收尾 = 25/25**，
EXIT=0；criteria.json / assemble-facts.json / wire-capture.json / row-state.json /
assembly-ledger.jsonl / instance.log 全部机读在档）。两次先前跑目录为 **kit 仪器自身缺陷的历史
RED**（非产品测量，逐字保留）：`runs/2026-10-17T17-41-07Z/`（patch 文件漏写 ⇒ row 未挂载 FATAL）、
`runs/2026-10-17T17-42-38Z/`（mock 相位标记取首匹配而非末匹配 ⇒ phase-3 超时 FATAL，此前 13 判据
已真绿——含 wire 级 RED 与正控两腿）。

## 4. 如实界定（不交付假的 native read 接管）

生产 `read`（preset-realm 挂载的原生名）在冻结 RA-a 语义下**不可能**被 verified 绑定——除非全局面
挂载修复（G7/G8 非-team 零加宽法所禁）或上游标签（Q1 optional ask）。因此 §6 的正控 = **经 placement
的 read**（Q4/R1 授权路，glue4-prodentry AMENDMENT）：本 kit 用同一个名字 `read` 演出
"无 feed 逐字拒 → 有 feed 真执行且结果合法回传" 的完整可达化线；生产 glue 侧 feed 输入点已备好
（`bindingFeed`/`realmId` 入参 + `definitionIdentityOf` 面），glue 行的 provider 记录接线属 GLUE
队列（本笔未触 `agent-bindings.mjs`/`team-tool-plane.mjs` = #308 面，红线）。放置 read 的 Body 直接
node:fs 读世界夹具——admission/kernel 效果面**不是**本 leg 的宣称，效果面治理归 a5p5 spill/admission
lane（W5 已 live 验其形）。

## 5. 门（全绿清单见本日志条目）

lane a5pbr2 10/10 · a5p1 lane 102/102 · a5p4 面 80/80 · p4t6 census 10/10（记账
`SCANNED_PATHS_A5PBR2` Δ1=1168→1169，tie 条款在册）· a5p0 4/4 · typecheck 全仓净 ·
lint 恒等（identity diff：76 distinct=基线 76，new 0 resolved 0）· dist 同笔再生 +
`check:artifacts` drift=0（compared=1730）· 全量 vitest 与 base 全量对照恒等（基线债务
8 文件/21 测试逐名同；本支新增失败=0，见日志条）· kit 25/25。

## 6. 红线

CORE PATCH 0；guard 律与 dispatcher 零改动（closed-world-guard / scoped-dispatcher 未触）；
未改 `feat/alpha5-install-entry-evidence`；未触 #308 面与 `:3080`；无 force-push；
世界 `a5pbr2-*` 收口核验 0 残留；test-use porcelain 0 @ 639ed01539。
