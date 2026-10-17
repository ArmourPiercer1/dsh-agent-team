# ra-review — R-a fact-3 全局假设审查 + scoped-aware 修订方案 + 隔离 PoC

Writer lane: RA-REVIEW（一次性 review）。Base `origin/master @ 01df26ca`，branch `alpha5-ra-review`，
host pin `0.2.0-rc.2 @ 639ed015397290b3745d163aafe02ffee4aa3f84`（porcelain-clean before AND after，H1/H1b）。
世界在 port **3185**（自证空闲，H3）；`:3080` 只读探测 401→401，从未操作；`tests/homes/a5rr-*` 已清扫（G3/§7）。
**零生产改动**：IF-5 共享面（`packages/`、`scripts/`、根 `vitest.config.ts`、根 `cordis.patch.yml`）porcelain 空（H2），
本方法全部文件只在本目录；`dev/**` 为 lint 忽略面 → gate 债务集与基线 byte-identical by construction。
本轮按任务口径 = 只诊断/方案/隔离 PoC。

根 08:05Z 硬口径遵守声明：本 lane **没有**因自写 guard 只查 global 而断言上游无解——恰恰相反，
实测结论是上游公开 scoped 接缝**提供**执行体身份读取（H5/H6），互斥的成立范围因此被重新划定（④）。

---

## ① fact-3 原设计动机核对 vs 公开 scoped registry 的身份/代际读取（实测）

**fact-3 是本仓自设规则（引设计/代码行，@01df26ca）：**

- `packages/runtime/tool-dispatch/closed-world-guard.ts:284-300`（`bindInheritedSurface` 文档）——三条事实中
  fact 3 =「`trusted[name]`（同一公共接缝**无 scope** 解析出的 trusted global Definition）必须存在且与
  `resolved` 同一身份」；`:293` 「Fact 3 is what the residual round added (**R-a**). Facts 1+2 alone let a
  name through that merely LOOKED native: a normal third-party row or MCP bridge … made the assembly pin
  the SHADOWING body and stamp it `native:<name>` / `verified: true`」；`:298-299`「The two reads are the
  same public seam with different scopes; **comparing them is the whole rule**」。
- 同文件 `:180-183`（`NATIVE_SHADOWED`）「R-a: a trusted NAME never transfers its standing to somebody
  else's DEFINITION」；分发时法则 `:603-606`「THE DEFINITION, NOT THE NAME (PR1 Gate R2)」。
- 读点实现：`packages/runtime/tool-dispatch/install.ts:353-367`（`readTrustedDefinition` = `tools.get(name)`
  无 scope）与 `:337-350`（`readDefinition` = `tools.get(name, runtimeAgent)`）；生产装配读点
  `packages/runtime/src/plugin/live/agent-bindings.mjs:2248-2266`（`nativeNames` ← 无 scope `tools.schemas()`）。
- 上游 host **没有**任何等价规则：registry 只有可见性/遮蔽/限制三层法则（见下），不存在"trusted global
  面"概念。→ fact-3 是本仓 PR1 residual 轮的**自设防遮蔽攻击规则**，不是上游约束。

**公开 scoped registry 给不给「当前调用实际 Definition 身份/代际」？（host 源 + 实测定标）**

- 源法则（pin @639ed01539，`packages/core/tools/src/index.ts`）：`view(scope)` `:1178-1221`（global 最远、
  祖先链次之、**own layer 最后且豁免过滤**）；`get(name, scope)` `:1230-1232` = `view(scope).visible.get(name)`
  （**返回活对象引用，不是克隆**；`schemas()` `:1260+` 才是 name/description/parameters 白名单克隆）；
  执行路径 `resolveExecution` `:1247-1252` 与 `dispatchToolBody` `:1578-1581` 就是 `get(exec.name, exec.agent)`
  → **scoped 读返回的对象就是会执行的对象本身**（同一引用）。`register` `:1063-1090`（同层同名 duplicate 拒绝）；
  `restrict` `:1097-1122`（需 scoped ctx）。`ScopeKey` = host 签发的不透明对象身份（`core/scope/src/index.ts:154`
  `scopeOf`；`store.ts:180/192` `peek`/`chainLayers`——未知 key ⇒ 无链无 own 层 ⇒ 只看到 global 面）。
- 实测 Tier-B（本目录 `a5rr-host-kit.mjs`，GREEN 10/10，`runs/2026-10-17T08-24-49Z/`）：
  **H5** 对真实宿主标准 preset 的 5 个工具，公开 scoped 读两次返回**同一对象**（identity 可读、稳定）；
  **H6** 任何 Definition 上**不存在** id/uuid/version/generation/definitionId 字段（`identityLikeFields=[]`）——
  公开面给的是**身份（对象引用）**，不给**代际标签**；"代际"在公开面上只能以「每次调用重读 + 对象身份比对
  （drift）」的形式存在——而这正是 Guard 已消费的机制（`guardDecision` 的 `definition` 输入）。
- 结论：**若 fact-3 要的是"将执行的那份 Definition 的身份"，公开 scoped 接缝已经给**（glue4 的
  `sameDefinition` 读法本身就是它的运用）。互斥**不因"身份读不到"而成立**；它只因 fact-3 把 trusted 侧
  钉死在**无 scope 的 global 读**上而成立。故 GLUE-4 结论需修正为：*guard 侧读法可以 scoped-aware*，
  但把它修订为 discovery-style（用 scoped 读替换 global 读做同一相等比较）**不安全**（见 ②NC-1/R5 反证），
  安全的 scoped-aware 修订走的是**另一条本仓设计已批准的装配路线**（R1 placement，见 ②/④）。

---

## ② 最小 scoped-aware 绑定修订方案（placement-attribution 版）

**不是**把 `readTrustedDefinition` 从"无 scope"改成"带 scope"（那是 discovery-style，反证不成立），
**而是**把受治理 team 工具面从 *inherited-native lane*（R-a fact-3 管辖）换到 **`team-own` lane**
（R-a 不管辖、生产已在跑的路径）：装配**自己把审阅过的 Definition 放进该 Agent 的 own layer**
（公开 `tools.register`，team tools 现用接缝），pin **自己放下的那个对象**，每调用 scoped 重读比对。
这正是冻结设计文档自己的 R1 路线：`docs/plans/memo/alpha5-tool-io-governance/post-poc-technical-design.md:42`
「**R1：Scoped Binding** —— 对继承工具先 `tools.restrict({deny:[name]})`，在 **Agent Own Scope 注册稳定同名
Dispatcher/Definition**；成功条件：原体被遮蔽、跨 Agent 不互扰、运行时持续 Guard、有序销毁」；
宿主实现件已存在：`install.ts:987-1024`（`bindAll`：pin scoped 读 + `verified:true`）+
`agent-bindings.mjs:2459-2471`（`bindOwnTools` → publish 前置）+ `install.ts:1062`（owned 名字不再进 native 名单）。

**精确安全不变量（修订成立的前提，逐条可测）：**

1. **Placement attribution（承重条）**：一个名字在该 scope 得到 `verified:true`，当且仅当
   装配自己执行了该对象的成功 `register`（own layer），且每次分发时 `get(name, agent) ===` 装配放下的
   那个对象。**验证的是"放置"，不是"发现"**——scoped 读只用于事后比对，绝不用于选取 pin 对象。
2. **每 scope 独立判定**：pin/绑定/裁决全部 per-agent-scope；一个 scope 上的 verified 不迁移到任何其他
   scope（无进程-wide 面 ⇒ 非 team 会话零接触）。
3. **未知归属 fail-closed**：own-layer 重名 duplicate 拒绝（`index.ts:1063-1090`）⇒ 装配放置失败 ⇒ 该名字
   只能作为"被观察到但不可归属"的名字存在，走**原样保留**的 fact-3/fact-1/2 路径（`native-shadowed` /
   `native-unreadable` / `unattributed` → 分发拒绝）。装配放置失败必须使该 Agent 装配失败（现 `bindAll`
   的 fail-closed 语义），绝不回落到"发现"式 pin。
4. **同名跨 realm 定义分叉检测**：global/祖先面存在同名不改变裁决——own 最后遮蔽它（`view()` 法则），
   每调用比对的是自己放下的对象；祖先同名**永远不可能继承**这份验证（撤销遮蔽后 fall-through 立刻
   `definition-drift` 拒，PoC R6c）。若团队想要的是 *继承* 那份同名原生体，则 fact-3 原样适用（不一致 ⇒ 拒）。
5. **撤销/换代竞态**：放置被 dispose ⇒ 重读 unreadable 或落到他体 ⇒ `definition-unreadable`/`definition-drift`
   拒（R6a/R6c）；重注册 ⇒ 新对象 ⇒ `definition-drift` 拒（R6b），恢复只许 trusted re-bind（更高 revision，
   冻结语义）。**已披露残余**：Guard 判定（pre-execute）与 `resolveExecution`（`:1578`）之间存在 await 边界，
   窗口内重注册由**已 shipped** 的 `tools/change`→B3 pendingCalls 取消机制兜（`install.ts:960-977`），
   dispose 则 registry 自身 `UNKNOWN_TOOL` 拒执行——该残余为现状 R-a 与本修订**共有**，修订不新增窗口。
6. **审计身份如实**：该路径的 Binding 记录如实写 `implementationOrigin:'team-trusted-extension'` /
   providerId `dsh-agent-team`（`install.ts:1004-1007` 既有语义），**不**冒充 `dsh-native`——需要
   "verified dsh-native"标签是另一个问题（见 ④ 裁决问题）。

**三负控设计（PoC 实测 + 生产 kit 应逐条复刻）：**

- **NC-1 同名跨 realm（先抢位）**：他方同名注册先落 own layer ⇒ 装配 duplicate 失败 ⇒ 不可 verified ⇒ 拒
  （R4）。**配套反证（承重证明）**：若改用 discovery-style scoped pin（发现什么 pin 什么），他方体内体
  会被 stamp `verified:true` 并放行（R5 实测 ABSTAIN）——**这就是 R-a 当初要杀的遮蔽攻击**，
  故 discovery-style 修订必须被否决，placement attribution 是唯一承重不变量。
- **NC-2 撤销/换代竞态**：dispose⇒unreadable 拒；dispose 后有 global 同名⇒drift 拒（祖先不继承）；
  重注册⇒drift 拒（R6a/b/c）。
- **NC-3 伪造 scope 标签**：**不可伪造，且能证明为什么**——(a) 修订不在 exec 路径上新增任何 scope 标签：
  `guardDecision` 的输入只有 `name + agentIdentity + 装配用闭包句柄读到的 fingerprint`（`closed-world-guard.ts:234-239`），
  scope 是装配闭包持有的 **host 签发不透明对象**，不在模型/调用方可控数据里；(b) 伪造一个"scope"（普通对象）
  去读 `get(name, forged)` 只能解析 **global 面**（未知 ScopeKey ⇒ 无链无 own 层），永远够不到团队的
  scoped 放置——真实宿主实测 H8 `forgedScope leaks=false`；(c) 伪造 exec 身份字符串 ⇒ `agent-identity-foreign`，
  缺省 ⇒ `agent-identity-absent`（R7b）。

---

## ③ 隔离 PoC（合成世界，非生产；guard 只读 instrumented 克隆；生产文件零改）

**Tier A `a5rr-synth-poc.mjs`（GREEN 11/11，`runs/2026-10-17T08-23-42Z/synth-facts.json`）**——合成 registry 按
L1-L6 复刻宿主层法则（view 链/global 面/own 遮蔽/duplicate 拒绝/未知 key 只见 global/执行=get 引用），
**裁决全部由真实编译产物 `packages/runtime/dist/.../closed-world-guard.js`（tracked @01df26ca）计算**
（`createGovernedSurface`+`bindInheritedSurface`+`guardDecision`，只 import 不改动）；读点
`definitionFingerprint`/`readDefinition`/`readTrustedDefinition`/`bindAll` 为 install.ts 的 instrumented 只读克隆。
结果：R1 复钉 GLUE-4 停点（preset-realm 原生名 `native-unreadable` 拒）；**R2 修订读法在 team 装配下
verified 成立**（放置+绑定+分发 = `abstain/governed-and-verified`，trusted global 面保持空）；
**R3 minimal 非 team 零变化**（装配前后 global/minimal 面 byte-identical，`global=[] minimal=[]`）；
R4-R7 = 三负控全绿（含 R5 反证）；R8 = 身份可读/无代际字段。

**Tier B `a5rr-host-kit.mjs` + `a5rr-probe-row.mjs`（GREEN 10/10，`runs/2026-10-17T08-24-49Z/`）**——pin 定
真实宿主 + 只读 probe 行（公开 profile-patch 接缝），两非 team 会话（standard/minimal）+ mock 设定轮，
无 `DSH_PERMISSION_MODE` 旋钮、无任何工具体执行：H4 global 面空（bind-diag 法则复钉）；**H5 scoped 身份
稳定可读 5/5**；H6 无 id/version/generation 字段；H7 无 scope 读对 preset-realm 副本给不出 trusted 侧
（GLUE-4 停点活体复测）；H8 伪造 scope key 零泄漏；**H9 minimal 非 team 面 `["bash"]` 零扩权**（与 glue4
基线一致）。世界 `a5rr-world-*` 已清扫；宿主 porcelain 前后 0。

复现：
```
node dev/agent-workflow/evidence/alpha5/wiring/ra-review/a5rr-synth-poc.mjs      # Tier A, 秒级, EXIT0=GREEN
node dev/agent-workflow/evidence/alpha5/wiring/ra-review/a5rr-host-kit.mjs --port 3185   # Tier B, ~2min
```

---

## ④ 判定

1. **互斥是否真成立——按被证明的命题成立，按其被推广的用法不成立。**
   成立（且不可经 guard 读法修复）：*「让 host 原生体作为 inherited-native 被 verified，同时不出现在
   无 scope global 面」* 不存在公共解——fact-3 的 trusted 侧只有 global 这一个公共 witness，scoped 替代
   被 R5 反证否决（discovery-style = 放行 R-a 要杀的遮蔽体）。glue4 的五法则 + G4-G8 实测继续有效。
   不成立（推广层面）：*「GLUE-4 的受治理 team 面必须等 Q1/Q2/Q3 才能 verified」*——设计文档自带的
   **R1 Scoped Binding**（design `:42`）走 **placement**（team-own lane）今天就能 verified 且非 team 零
   delta（Tier-A R2/R3 + 生产件 `bindOwnTools` 已在跑），不需要 guard 改一个字。
2. **修订分类**：本修订 = **「实现读法/装配路线扩展」，不是 R-a 冻结语义变更**——
   `closed-world-guard.ts` 与 fact-3 的「global 有同名且同定义才可继承 verified」**逐字保留**，被改的只是
   受治理面**从哪条 lane 来**（inherited-native → team-own placement），该 lane 的语义早已被 PR1 冻结
   词表如实记录（`team-trusted-extension`）。真正的语义代价不在 guard 而在**工具体供给纪律**：团队
   自带同名 Dispatcher/Definition（R1 成功条件），复用 host 原生体则回到 `tool-fork-debt` 台账。
   若根想的是另一种"修订"——把 fact-3 的比较侧从 global 换成 scoped 发现——那是**原冻结 R-a 语义变更
   且已被本 PoC 反证否决**，不应裁决。
3. **GLUE-4 结论修正建议（一行）**：README 的 "guard 侧读法不可满足 ⇒ 装配停" 应改为
   "guard 读法**保持**；受治理面改走 R1 placement lane（新选项 **Q4**）；Q1（upstream 可见性门控 global
   mount）仅在根要『host 原生体 + verified-**dsh-native** 标签 + 非 team 零扩权』三者兼得时仍是唯一解"。
4. **给根的精确裁决问题（GLUE-4 不代裁）**：
   > **Q4（新增，装配范围裁决，非 guard 语义）**：是否批准 GLUE-4 生产入口按冻结设计 R1 走 scoped
   > placement——`team-own` lane、每 scope 独立判定、②的六条不变量为验收门、工具体由团队包提供
   > （host 原生体复用另立 fork-debt 登记）——从而使受治理 team 工具面 verified 且非 team 零 delta？
   > （若是：Q2『guard 语义改读法』建议按 R5 反证**否决**；Q1 降级为"dsh-native 标签 + 零扩权"的可选
   > upstream 诉求；Q3 可废。）

---

## 收尾台账（本 review 部分）

- 实现文件：ONLY 本目录 4 件（两 kit/row + README + `runs/`）。`git diff` 生产面空（H2）；
  lint 债务集 byte-identical by construction（`dev/**` 在 eslint ignores，`eslint.config.mjs:102`）；
  根 `vitest` 无涉（无 `packages/` delta，本目录不被任何测试 import）。
- 用户可用面：不变（无出厂）。
- 剩余：根对 ④.4 的 Q4 裁决；GLUE-4 README 的结论段按 ④.3 修正（建议由 GLUE-4 lane/根落笔）。
- gates 记录：test-use porcelain 前 0 后 0；`:3080` 401→401 未操作；`a5rr-*` 世界已清扫；端口 3185/3491 自证空闲。
