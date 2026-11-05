# BL-33 / P4-05A — 双平面同调用一致性与实际消费（C1，host-free）

> **2026-11-05 UPDATE — A5-DUAL-PLANE-01 CLOSED (interim, fail-closed).** The three DISAGREE cases below are
> the historical measurement, not the current state. Admission now REFUSES an `ask`-covered locator with the
> typed `IO_ASK_REQUIRES_APPROVAL` (authored AND resolved identity, both realms, both axes, fs + subprocess
> faces); no approval flow was invented and `resolveAskClassCall` stays unwired (BL-30). The BL-33 harness was
> extended to 42 cases → **37 AGREE / 5 cited EXCEPTION / 0 DISAGREE**, `allow 15 / ask 7 / deny 20`, overall
> `ALIGNED_WITH_CITED_EXCEPTIONS`. Evidence + gates: `dev/agent-workflow/evidence/a5sf-ask-closed/`.

**状态：IN-PROGRESS，不是 DONE。** 三平面对齐在 37 个案例中的 34 个成立（29 全等 + 5 条具名且引用的例外），
**3 个案例是未裁决的分歧**：`ask` 覆盖的 locator 被 Provider 实际准入为 `allow`，没有审批请求、没有审批消费。
**BL-33 不能标记 DONE**（见 §5、§10）。

- 任务：`BL-33 | P4-05A`（backlog 行：`docs/plans/active/alpha5-sandbox-first/ALPHA5-SANDBOX-BACKLOG.md`）
- 分支：`task/a5sf-bl33-20261105`；worktree：`.worktrees/a5sf-bl33`
- 基线：**任务书写 `master 6785c161c`，该对象在本 clone 不存在**；实际从 `origin/master = a636a00c5` 切出（见 §9.1）
- **没有 boot Host**：零端口、零 `DSH_HOME`、零 pristine-host 树，全部在 Cordis 单元世界里完成（见 §1）
- **CORE PATCH BUDGET = 0**：只新增 `tests/world-factory/` 下的 harness 与本 evidence；产品代码 `.ts` 零改动

---

## 0. 一句话回答（单一最重要的问题）

> **是否存在 Provider consulted 决策与独立推导不一致的输入？**

**有。** `ask` 覆盖、且落在 allow 子树内部的 locator（读两例——其中一例的 `ask` 是经 in-lane symlink 抵达的；写一例）。此时：

- **plane 1（真实 Alpha.4 准入模块）说 `ask`**；
- **plane 3（独立 oracle，不 import 任何一方）说 `ask`**；
- **plane 2（Provider 实际 consulted 的决策）说 `allow`**，`decidedBy: ALLOW`，基础 Provider 真的执行了，读回了字节 / 写入了磁盘。

**哪两个一致：plane 1 与 plane 3。错的是 plane 2（准入侧）。** 它把一个被声明为 `ask` 的 locator
在没有任何审批的情况下放行了。这不是 oracle 抄实现，也不是 plane 1 过时：`ask` 是 v4 语法里合法且被
`compileMemberPolicy` 保留的 disposition，但 Provider 的 guard 从不读取 `ask`（`fs.ts` 明确写
"does not know about tools or approvals"）。**编译出了 `ask`，却在准入处没有消费者。**

反方向（`ask` 不在 allow 内）是 **fail-closed** 的：交集把该 `ask` 丢掉，Provider `deny`，已作为具名例外
`EX-3` 引用（§4）。它不放大权限，但意味着"作者声明了 ask、审批通过后仍无法执行"。

---

## 1. 三个平面各自是什么（证据纪律）

| 平面 | 实现 | 为什么它是"真的" |
| --- | --- | --- |
| **plane 1** Alpha.4 / alpha.2 旧准入面 | `packages/runtime/operation-permission/pre-execute-adapter.ts` 实际调用的 `canonicalizeOperation` + `resolveOperationPermission` | 该 adapter 就是 `tools/pre-execute` 的生产监听器（`agent-bindings.mjs:3927` `installParameterPermissionListener`）；其文件头写明顺序 `canonicalizeOperation(...)` → `resolveOperationPermission(...)`（`pre-execute-adapter.ts:17-20`，调用点 `:1325` / `:1480`）。harness 只补它文档要求的 A5 归一化输入（canonical key + `containsOperation` 布尔），不重写判定。 |
| **plane 2** Alpha.5 实际准入 | 真实产品路径：`a5sfRealmConfigOf` → `mountMemberA5sfRealm` → `installMemberIoProviders` / `installToolBindingRealm` → 被约束的 Provider → guard 写 `a5sf-guard-consult/1` fact → 基础 Provider | fact 由 `packages/runtime/team-services/src/guard-observability.ts` 在 guard 内部、**delegate 之前**写出；harness 只读文件，不构造 fact。测试同时断言 **effect**：`allow` 时基础 Provider 计数 +1 且字节/磁盘改变；`deny`/`ask` 时计数为 0 且抛出的错误码与 fact 的 `decidedBy` 相同。 |
| **plane 3** 独立 oracle | `tests/world-factory/lib/a5sf-dual-plane-oracle.mjs` | 只 import `node:fs` / `node:path`；自己实现段包含、`realpath` 身份、lane 交集、`deny > ask > allow` 优先级、写前读前置；**不 import 任何一方的符号**。`FENCE` 断言在去注释后源码里不出现 `matchLocator` / `evaluateLocatorAccess` / `createMemberFsGuard` / `resolveOperationPermission` / `canonicalizeOperation` / `locatorWithinRuleSet` / `compileEffectiveIo`。 |

plane 1 被喂的是**工具级 lane**：产品声明了该工具的 binding restriction 时用它，否则用 Member ceiling
（旧平面没有"Member ceiling"概念，只有工具规则）。这一结构差异**只**在两个地方显形，且都已登记为具名例外
（§4），不是默认容忍。

**没有把任何东西伪装成"已 boot"**：本 evidence 的结论只覆盖 Provider 准入 seam，不覆盖真实 Host 的
`tools/pre-execute` 控制面往返（§9.4 明确边界）。

---

## 2. 案例空间与充分性

案例表在 `tests/world-factory/lib/a5sf-dual-plane.mjs` 的 `DUAL_PLANE_CASES`（37 例，declarative，
每例自带 reviewed expected triple）。一个案例 = 一次真实调用。

| 维度 | 取值 | 覆盖 |
| --- | --- | --- |
| 轴 | `read` / `write` | 23 / 14 |
| realm | `member`（ceiling-only）/ `binding`（ceiling ∩ tool restriction） | 16 / 20 |
| 资源形状 | `subtree` / `exact` / `any`（整个工具，`mode: all`） | 28 / 3 / 6 |
| disposition | `allow` / `ask` / `deny` | 见 §3 交叉表 |
| restriction | 比 ceiling 窄 / 与 ceiling 相同 / **比 ceiling 宽（必须拒绝）** / 未声明 | 14 / 3 / 3 / 16 |
| 路径形状 | 直系 / parent symlink 出界 / leaf symlink 出界 / dangling symlink / 硬链接（内名与外名）/ `..` 出界 / `..` 仍在内 | 全部 |
| 写目标 | 已存在（触发读前置）/ 新建 leaf / 经 symlink parent 新建 | 全部 |
| 双 realm | 同一 ceiling 在 `binding` 与 `member` 下分别判定 | 有配对案例 |

**充分性论证**（不是"看起来不少"）：

1. **每个维度的每个取值至少出现一次**；`DP-SUM` 用代码断言 `axes = {read,write}`、`realms = {member,binding}`、
   `kinds = {subtree,exact,any}`、跨平面 decision 集合 `= {allow,ask,deny}`，以及 `dotdot`/`symlink`/
   `hardlink`/`exact`/`any`/`ask` 六种形状都至少有一例。少一个就红。
2. **决策矩阵闭合**：只用 allow 无法暴露拒绝路径；只用 deny 无法暴露放行路径。两个方向都有，且
   `DP-SUM` 断言 plane 2 的 allow 与 deny 都 > 0。
3. **例外必须被走到**：每个声明的例外 id 至少命中一次，否则 `summarize` 返回 `INCOMPLETE` 而不是通过
   （`unexercisedExceptions` 断言为空）。
4. **反例方向**：MUT-3 证明"恰好长成例外的三元组、但案例没声明例外"必须报 DISAGREE——例外注册表不是豁免权。

**明确不覆盖**（scope note，不是遗漏）：

- `mode: 'all'` 在 v4 里不能携带 `ask`（`BLUEPRINT_V4_IO_RW_FIELDS_BY_MODE`），所以"`any` + ask"不可表达；
  `exact` + 子路径（exact 只指一个文件身份，不覆盖其后代）、network / exec / PTY 轴、真实 Host 控制面
  往返、并发审批、撤权、持久 Bash——分别属于 BL-27/28/29/30 与本 evidence 的边界（§9）。
- 硬链接按**路径**判定，不按 inode（ADR D5 已披露）：内联名允许、外名拒绝，两例都在表内；oracle 不使用 inode 身份。
- `exact` 只测"该文件本身"与"sibling 不被覆盖"；不存在"成功调用 exact 规则的子路径"这种输入（无效果可证）。

---

## 3. 三平面结果

`node --test tests/world-factory/a5sf-dual-plane.test.mjs` 的实测输出（37 例）：

| verdict | count |
| --- | ---: |
| AGREE | **29** |
| EXCEPTION（具名 + 引用） | **5** |
| DISAGREE（开放） | **3** |
| **total** | **37** |

plane 2（实际准入结果）分布：`allow` 17、`deny` 20、**`ask` 0**——**这个 seam 上 `ask` 从未成为准入结果**。
这正是 §5 发现的一半：`ask` 只能以 `IO_POLICY_UNSUPPORTED`（解析器故障）出现在 fact 里，
正常路径不会产出 `ask`。

三元组交叉表：

| (plane 1 / plane 2 / plane 3) | count | verdict |
| --- | ---: | --- |
| allow / allow / allow | 14 | AGREE |
| deny / deny / deny | 15 | AGREE |
| allow / deny / deny | 4 | 3× EX-1，1× EX-2 |
| ask / deny / deny | 1 | EX-3（fail-closed） |
| ask / allow / ask | **3** | **DISAGREE（开放）** |

即：**34/37 对齐（含 5 条引用例外），3/37 硬分歧，1 条 fail-closed 的引用例外。**
逐例明细见附录 A。

---

## 4. 具名例外（每条都有引用；不是"容忍的 mismatch"）

| id | 形状 | plane 1 / 2 / 3 | 次数 | 引用 |
| --- | --- | --- | ---: | --- |
| `EX-1-CEILING-OUTRANKS-TOOL-ADMISSION` | restriction 比 ceiling 宽（local）→ 旧工具规则允许、ceiling 拒绝 | allow / deny / deny | 3 | ADR `A5-GENERIC-02`（`ADR.md:61`："工具调用审批不扩大这两个硬上界"、"单次批准仅在硬上界内部"）；`ARCHITECTURE.md:33`（`EffectiveIo ⊆ MemberCeiling ∩ ToolRestriction`）；`compile.ts` 头注释（"nothing here can widen a ceiling"）；PA3 覆盖双向求交 |
| `EX-2-ADMISSION-READ-BEFORE-WRITE` | 已存在目标的写：写 lane 允许、同一 realm 的读 lane 不覆盖 → `IO_WRITE_REQUIRES_READ` | allow / deny / deny | 1 | `fs.ts:21-23`（"write ⇒ read, the native read-then-write contract"）与 `fs.ts:133,141`；`a5sf-preflight/README.md` §12.8.2 + **2026-11-04 RULING §12.8.3**（`:966-987`："write does not imply read"；该拒绝属于 native tool 的契约，**不是 Team lane 代数**） |
| `EX-3-TOOL-ASK-DROPPED-BY-INTERSECTION` | `ask` 不在 allow 内 → 交集丢掉 ask，准入 deny（fail-closed）；旧工具规则 ask | ask / deny / deny | 1 | `path-rules.ts:168-169`（"ask is the STRICTER disposition: an ask survives if the OTHER lane permits that location"）；`compile.ts`（`EffectiveIo ⊆ MemberCeiling ∩ ToolRestriction`） |

三点必须一起读：

1. **EX-1 不是"restriction 比 ceiling 宽会被拒绝"**——产品装配处是**求交，不拒绝**；拒绝发生在**调用时**。
   "声明 ceiling 比绑定的 blueprint 更宽"才是装配期拒绝（`REALM_DECLARATION_EXCEEDS_BLUEPRINT`，B2，§7）。
   两种读法都在本 evidence 里有各自的可执行证据，互不替代。
2. **EX-2 的 `deny` 不是 lane 的拒绝**，是 native write 的读前置；ledger 里必须写成 admission 契约，
   不能写成"binding 限制了写"。2026-11-04 裁决正是为这句话留下的。
3. **EX-3 是 fail-closed**：它把"作者声明的 ask"变成 deny，不能放大权限；但审批通过后也无法执行，
   所以它是功能缺口，不是安全缺口。它与 §5 的开放分歧是同一个缺口的两端。

`compareThreeWay` 只在**案例显式声明**该例外 id、且三元组与 `decidedBy` 都精确匹配时返回 `EXCEPTION`；
否则一律 `DISAGREE`。MUT-3 是这条规则的反向证明。

---

## 5. 开放分歧 `A5-DUAL-PLANE-01`（本任务的交付物）

### 5.1 案例

- `read-binding-subtree-ask-under-allow`
  - ceiling 与 binding restriction 相同：`read = {allow:[<base>/lane], ask:[<base>/lane/inside/ask.txt]}`
  - 调用：`readText(<base>/lane/inside/ask.txt)`，`realm = binding`，`toolBindingIdentity = dsh.fs/read`
- `write-binding-subtree-ask-under-allow`
  - 写 lane 同形状；目标 `ask.txt` 已存在（读前置由 ceiling 的 read lane 满足）
  - 调用：`writeText(<base>/lane/inside/ask.txt, ...)`

### 5.2 三个决策（实测）

分歧类共三例：`read-binding-subtree-ask-under-allow`、
`read-binding-subtree-allow-symlink-into-ask`（ask 经 in-lane symlink 抵达）、
`write-binding-subtree-ask-under-allow`。

| plane | read（直呼） | read（经 symlink 到 ask 文件） | write | 证据 |
| --- | --- | --- | --- | --- |
| 1 旧准入 | `ask` | `ask` | `ask` | `matchLocator`：deny 无、ask 命中 → ask（ask > allow）；plane 1 先把调用 canonicalize 到 realpath，所以别名也命中 ask |
| 2 Provider consulted | **`allow`** | **`allow`** | **`allow`** | fact `{decision:"allow", decidedBy:"ALLOW", realm:"binding", toolBindingIdentity:"dsh.fs/read|write", method:"readText|writeText", locator:"…"}` |
| 3 独立 oracle | `ask` | `ask` | `ask` | S1 交集保留 ask（ask 位于 allow 内）；S3 把判定重新施加到 canonical identity 上，别名解析到 ask 路径 → ask |

**哪两个一致：1 与 3。离群者：2。** 三个案例的 `compareThreeWay` 都返回 `mismatch: "plane2"`。

**effect 证据**：read 直呼案例基础 Provider 读回 `ASK\n`（计数 1）；symlink 案例读回同一个
`ASK\n`（别名没有改变效果）；write 案例基础 Provider 写入成功、磁盘内容改变。
没有审批请求、没有审批 token、没有 `deny`。fact 的 `decidedBy` 是 `ALLOW`，不是任何 ask/approval 码。

### 5.3 机制（为什么 plane 2 是错的）

1. `evaluateLocatorAccess`（`provider-capabilities.ts`）只读取 **deny** 与 **allow 覆盖**：先是 authored deny，
   再是 authored within-allow，然后 realpath 后的 deny/within。**`ask` 从不参与**。
2. `createMemberFsGuard` 的 `admitted` 用 `decision.allowed` 决定放行；`fs.ts:21-23` 明说
   "does not know about tools or approvals"。
3. `compileMemberPolicy` / `intersectPathRuleSets` **保留**了 `ask`（`compile.ts` 把它编译进
   `EffectiveIo`，prompt/observability 也能看到），所以这不是"编译时丢了"，是"运行时没人读"。
4. 设计中的消费点在 `packages/runtime/member-io-policy/src/approval-takeover.ts:206`
   `resolveAskClassCall`（按 asked locator 收窄 lane），但 **`grep` 全仓找不到生产调用方**：
   只有它自己的文件与 `index.ts` 的 re-export。R1 takeover 没有接线。
5. alpha.2 的 `tools/pre-execute` 监听器确实会 `ask`（`pre-execute-adapter.ts`），但它判定的是
   **另一份 authored 对象**——模板的 `capabilities.permissions`，不是 Alpha.5 的
   `toolBindings[].io` lane；而且 `agent-bindings.mjs:3691` 明确："ABSENT policy -> install NOTHING"。
   所以：
   - 只声明 `a5sfMemberPolicies`（Alpha.5 产品路径）→ 根本没有 pre-execute 监听器，ask 完全无人消费；
   - 两份都声明 → ask 由旧 policy 决定；两份 authored 对象若不一致，Provider 仍然不读 Alpha.5 的 ask。

### 5.4 为什么这不是"具名例外"

没有任何 ruling / ADR / 文档说"ask 覆盖的 locator 可以在没有审批时放行"。相反：

- `ADR.md:61` 说"单次批准仅在硬上界**内部**对这次调用生效"——这句话隐含"批准"这一步必须存在；
- `a5sf-preflight` 的 2026-11-04 裁决只处理 **write 的 read 轴**，与 ask 无关；
- `guard-observability.ts:60` 把 `IO_POLICY_UNSUPPORTED` 映射为 `ask`，说明 `ask` 在 fact 词汇里是
  "无法判定/需要审批"，而不是 `ALLOW`。

所以它是**缺口**，不是被裁决的差异。把它登记成例外会违反"deliberate divergence 必须有 ruling 引用"的规则。

### 5.5 影响面与建议（未实施：需产品裁决 / BL-30）

**影响面**：任何 `toolBindings[].io.{read,write}.ask` 覆盖、且该 locator 同时落在 allow 子树内的调用。
read 会泄露字节，write 会改文件。它**没有**突破 ceiling（allow 仍在 `EffectiveIo` 内），所以不是
ceiling 越权；缺的是"单次批准"这半个契约。

**建议（按代价从低到高，均未在本 PR 实施）**：

1. **立刻 fail-closed（最小、可独立裁决）**：guard 遇到 ask 覆盖的 locator 时 `deny`
   （新增 `IO_ASK_REQUIRES_APPROVAL`），直到调用方携带审批。它阻止放大，但让"已批准的 ask"仍无法执行。
2. **正确接线（根治）**：把 `resolveAskClassCall` 接入 Provider 准入（按调用收窄 lane / InvocationAuthority），
   属 BL-30（一次性审批与撤权）范围，需要与 BL-30 的 token 生命周期一起设计。
3. **把本 harness 加进门**：修复后 37 例必须不再出现 DISAGREE（29 AGREE + 5 引用例外，3 个 ask 案例按裁决改为对齐或另立引用例外），任何回归立即红。

**当下可用的产品侧规避**：需要安全就先声明 `deny` 而不是 `ask`；`ask` 目前的实际语义是
"allow 内 → allow（无审批），allow 外 → deny（fetch 不到审批）"。

---

## 6. 变异控制（证明比较器不会空过）

| 控制 | 变异 | 实测 |
| --- | --- | --- |
| **MUT-1** | 只在 fixture/声明侧**放宽** plane 2 的 read ceiling（allow 加 `<base>/outside`） | baseline `AGREE`；变异后 fact `allow`、基础 Provider 真的返回 `SECRET\n`；plane 1 `deny`、oracle `deny` → **DISAGREE，outlier = plane2**。证明 fact 是"实际 consulted"，不是投影。 |
| **MUT-2** | 只在 fixture/声明侧**收窄** plane 2 的 read ceiling（allow 只留 `<base>/outside`） | fact `deny`，基础 Provider 未被调用；plane 1 `allow`、oracle `allow` → **DISAGREE，outlier = plane2**。 |
| **MUT-3** | 只从 **plane 1 的输入**删掉 deny 规则（`read-member-subtree-deny-explicit`） | 得到 `(allow, deny, deny)`——**恰好是 EX-1 的形状**——但该案例没有声明 EX-1 → **DISAGREE，outlier = plane1**。证明注册表不是豁免权。 |
| **MUT-4** | 关掉 oracle 的 S4（write⇒read） | oracle 变 `allow`；plane 1 `allow`、plane 2 `deny` → **DISAGREE，outlier = plane2**；EX-2 不再匹配（它要求 plane 3 = deny）。证明 oracle 的读前置步骤是承重的。 |
| **MUT-5** | 把 2026-11-04 的 member-realm write 案例**当成 binding** 算 oracle（把 read restriction 也约束到读前置） | oracle 变 `deny`；plane 1/2 都 `allow` → **DISAGREE，outlier = plane3**。证明"写只受 ceiling 约束、binding restriction 只约束读轴"这条裁决被 oracle 编码，而不是被忽略。 |
| **B2** | 声明 ceiling 比 `blueprintSource` 的 ceiling 更宽 | `a5sfRealmConfigOf` 在**装配期**抛 `REALM_DECLARATION_EXCEEDS_BLUEPRINT`（`detail` 点名 `ceiling.read`），零 mount、零 fact；收窄的声明正常装配。PA9 拥有完整矩阵（含 `mode:all` 反向、未知 template、不可解析 blueprint）。 |

---

## 7. 复现

```bash
# 单套（本 evidence 的唯一入口；会打印 §3 的表）
node --test tests/world-factory/a5sf-dual-plane.test.mjs

# 现有 a5sf 世界工厂回归集（基线 219）
node --test tests/world-factory/a5sf-*.test.mjs

# 类型检查（本 PR 不触碰 .ts；若触碰则必须跑）
pnpm -w exec tsc -p tsconfig.json --noEmit

git diff --check
node scripts/ci-pr-gate.mjs --help   # 以仓库实际入口为准；环境腿允许 not-run 时必须点名
```

本 PR 的门禁结果见 §8。

---

## 8. 门禁记录

| 门 | 结果 |
| --- | --- |
| 本套 `a5sf-dual-plane.test.mjs` | **46/46 pass**（37 案例 + DP-SUM + 5 MUT + B2 + FENCE），`node --test` |
| 现有 `a5sf-*` 世界工厂集 | **265/265 pass**（= 既有基线 219 + 本套 46；同一个 `node --test tests/world-factory/a5sf-*.test.mjs`） |
| `tsc` | 本 PR **未触碰 `.ts`**；`ci-pr-gate` 的 `typecheck` 腿仍跑全仓 `pnpm typecheck` 并通过 |
| `git diff --check` | 通过（无空白错误） |
| `ci-pr-gate`（默认腿，`--skip install,artifacts-at-head`） | **`DSH-CI-VERDICT pass pass=6 fail=0 skip=3 skipped=install,artifacts-at-head,census`**；通过的 6 腿：`graph-parse` / `kit-home-guard` / `state-freshness` / `blueprint-fence` / `typecheck` / `lint-identities`（identity diff: new 0, resolved 0） |

**未运行 / 环境腿（不是通过，已点名）**：

- `install` — 本 worktree 的 `node_modules` 是 symlink 到主 checkout，`node_modules/.modules.yaml` 记录的
  store 指向已删除的 `.worktrees/a5sf-native-route-c/.review-scratch/pnpm-store/v11`，pnpm 11 因此报
  `[ERR_SQLITE_ERROR] unable to open database file`。**这是环境问题，不是 lockfile 问题**：本 PR 零依赖变更。
  用 `--store-dir` 指向可写 store 会重写共享的 `node_modules`，故选择显式 `--skip` 而不是伪造通过。
- `artifacts-at-head` — 同一 store 问题的拒绝：`committed install surface verdict=not-run
  reason=store-not-writable`；本 PR 不产生产物（无 build 输出），该腿在 CI 的全新 checkout 上应正常。
- `census` — 默认 opt-in，命名的 skip；**未运行，不声称通过**。

## 9. 诚实的边界与已知差异

### 9.1 基线 SHA 不一致

任务书写的 `master 6785c161c` 在本 clone 中不存在（`git cat-file` 失败）。实际基线是
`origin/master = a636a00c5`，worktree `task/a5sf-bl33-20261105` 从它切出。这不是"选择更新"，是
任务书 SHA 与远端不一致；如果 `6785c161c` 在别处存在，本 evidence 的结论需要在该提交上重跑才能声称
"在指定基线上成立"。

### 9.2 只覆盖 FS 的 read/write

`toolBindings[].io` 还有 network / exec / PTY 轴；本 harness 只覆盖 FS。network 的 `deny/allow` 与
exec 的 ceiling 属于 BL-29/28，不在本证明内。**不要把本表的 34/37 外推成全工具矩阵全对齐。**

### 9.3 没有 boot Host

本 evidence 证明的是 **Provider 准入 seam** 上的三平面对齐，不是"真实 Host 的端到端行为"。特别是：
alpha.2 的 `tools/pre-execute` 控制面往返（审批 UI、token、取消、并发）没有在本 harness 内运行。
§5.3 关于 pre-execute 的结论来自代码阅读（`agent-bindings.mjs:3691`、`pre-execute-adapter.ts`），
不是 boot 观测。真实 Host 下的审批行为需要 BL-30 的 boot 证据，不能由本文件替代。

### 9.4 `ask` 的 fact 词汇

`guard-observability.ts:60,146` 把 `IO_POLICY_UNSUPPORTED` 映射为 `ask`（"无法判定"），而正常 lane 的
`ask` 永远不会在 fact 里出现为 `ask`。本 harness 的 37 例中 plane 2 的 `ask` 计数为 0，与代码一致。
这不是"harness 漏测"，而是 §5 发现的一部分：**准入 seam 不产出 ask 决策**。

### 9.5 memory / 性能 / 并发

未测；不属于 P4-05A 的声明范围。

---

## 10. 对 BL-33 状态的含义

- **不能 DONE**：定义要求"whole case space 三平面全对齐，例外有引用"。当前有 3 例未裁决分歧。
- **不是 BLOCKED**：BL-11 已 DONE（R3 evidence chain 在 `tests/world-factory/lib/a5sf-evidence.mjs`），
  本任务不依赖外部未完成项；分歧是**产品行为缺口**，不是环境阻塞。
- **建议状态**：`IN-PROGRESS（C1 已落；开放分歧 A5-DUAL-PLANE-01：ask lane 未被准入消费）`。
- 一旦按 §5.5 修复（或 owner 裁决把当前行为定为正确并给出引用），重跑本套：
  开放分歧应归零（修复为 fail-closed/审批消费后，ask 案例应不再是 DISAGREE）；届时才可改 DONE。
- 该分歧应同时知会 **BL-30**（一次性审批与撤权）owner，因为正确的消费点就是 BL-30 的 token 生命周期。

---

## 附录 A — 逐例三平面明细

（由案例表生成；实测三元组与 reviewed expected 逐例断言相等。`EXCEPTION (1/2/3)` 对应 §4 的 EX-1/EX-2/EX-3。）

| # | case | axis | realm | kind | plane 1 | plane 2 | plane 3 | verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `read-binding-subtree-allow-in-lane` | read | binding | subtree | allow | allow | allow | AGREE |
| 2 | `read-binding-subtree-deny-outside-restriction` | read | binding | subtree | deny | deny | deny | AGREE |
| 3 | `read-binding-subtree-deny-outside-ceiling` | read | binding | subtree | allow | deny | deny | EXCEPTION (1) |
| 4 | `read-binding-mode-all-deny-outside-ceiling` | read | binding | any | allow | deny | deny | EXCEPTION (1) |
| 5 | `read-binding-subtree-deny-explicit` | read | binding | subtree | deny | deny | deny | AGREE |
| 6 | `read-binding-subtree-ask-under-allow` | read | binding | subtree | **ask** | **allow** | **ask** | **DISAGREE** |
| 7 | `read-binding-subtree-allow-symlink-into-ask` | read | binding | subtree | **ask** | **allow** | **ask** | **DISAGREE** |
| 8 | `read-binding-subtree-ask-only` | read | binding | subtree | ask | deny | deny | EXCEPTION (3) |
| 9 | `read-binding-subtree-allow-symlink-inside` | read | binding | subtree | allow | allow | allow | AGREE |
| 10 | `read-binding-subtree-deny-symlink-parent` | read | binding | subtree | deny | deny | deny | AGREE |
| 11 | `read-binding-subtree-deny-symlink-leaf` | read | binding | subtree | deny | deny | deny | AGREE |
| 12 | `read-binding-subtree-deny-dangling-symlink` | read | binding | subtree | deny | deny | deny | AGREE |
| 13 | `read-binding-subtree-allow-hardlink` | read | binding | subtree | allow | allow | allow | AGREE |
| 14 | `read-binding-subtree-deny-hardlink-alias` | read | binding | subtree | deny | deny | deny | AGREE |
| 15 | `read-binding-subtree-deny-dotdot` | read | binding | subtree | deny | deny | deny | AGREE |
| 16 | `read-binding-subtree-allow-dotdot-inside` | read | binding | subtree | allow | allow | allow | AGREE |
| 17 | `read-member-subtree-allow-in-lane` | read | member | subtree | allow | allow | allow | AGREE |
| 18 | `read-member-subtree-deny-outside` | read | member | subtree | deny | deny | deny | AGREE |
| 19 | `read-member-subtree-deny-explicit` | read | member | subtree | deny | deny | deny | AGREE |
| 20 | `read-member-exact-allow` | read | member | exact | allow | allow | allow | AGREE |
| 21 | `read-member-exact-deny-sibling` | read | member | exact | deny | deny | deny | AGREE |
| 22 | `read-member-any-allow` | read | member | any | allow | allow | allow | AGREE |
| 23 | `read-member-any-deny` | read | member | any | deny | deny | deny | AGREE |
| 24 | `write-binding-subtree-allow-existing` | write | binding | subtree | allow | allow | allow | AGREE |
| 25 | `write-binding-subtree-deny-outside-restriction` | write | binding | subtree | deny | deny | deny | AGREE |
| 26 | `write-binding-subtree-allow-new-leaf` | write | binding | subtree | allow | allow | allow | AGREE |
| 27 | `write-binding-mode-all-deny-outside-ceiling` | write | binding | any | allow | deny | deny | EXCEPTION (1) |
| 28 | `write-binding-subtree-ask-under-allow` | write | binding | subtree | **ask** | **allow** | **ask** | **DISAGREE** |
| 29 | `write-member-subtree-allow-existing` | write | member | subtree | allow | allow | allow | AGREE |
| 30 | `write-member-subtree-deny-outside` | write | member | subtree | deny | deny | deny | AGREE |
| 31 | `write-member-subtree-deny-read-prerequisite` | write | member | subtree | allow | deny | deny | EXCEPTION (2) |
| 32 | `write-member-subtree-allow-while-binding-read-restricted` | write | member | subtree | allow | allow | allow | AGREE |
| 33 | `write-member-subtree-deny-symlink-parent` | write | member | subtree | deny | deny | deny | AGREE |
| 34 | `write-member-subtree-allow-hardlink` | write | member | subtree | allow | allow | allow | AGREE |
| 35 | `write-member-exact-allow` | write | member | exact | allow | allow | allow | AGREE |
| 36 | `write-member-any-allow` | write | member | any | allow | allow | allow | AGREE |
| 37 | `write-member-any-deny` | write | member | any | deny | deny | deny | AGREE |

---

## 附录 B — 产物清单

| 路径 | 作用 |
| --- | --- |
| `tests/world-factory/lib/a5sf-dual-plane-oracle.mjs` | plane 3：独立 oracle（node: 内建，零平面 import） |
| `tests/world-factory/lib/a5sf-dual-plane.mjs` | 案例空间 + plane 1 adapter（真实旧模块）+ 例外注册表 + 三平面比较器 + 汇总 |
| `tests/world-factory/a5sf-dual-plane.test.mjs` | 37 例 + DP-SUM + MUT-1..5 + B2 + FENCE |
| `dev/agent-workflow/evidence/a5sf-p4-05a/README.md` | 本文件 |

## Run log

（只追加；命令 / 退出码 / 计数）

- `node --test tests/world-factory/a5sf-dual-plane.test.mjs` → 46 tests, 46 pass, 0 fail；表：37 例，
  29 AGREE / 5 EXCEPTION / 3 DISAGREE，overall = REFUTED。
- `node --test tests/world-factory/a5sf-*.test.mjs` → 265 tests, 265 pass, 0 fail（既有基线 219 + 本套 46）。
  首次运行 1 例失败，原因是 worktree 缺 `tests/deepseek-harness-test-use`（gitignored pristine baseline）；
  补 symlink 后全绿。该 symlink 被 `.git/info/exclude` 忽略，不入库。
- `git diff --check` → 0（commit `23eea9253` 之后再次确认，见下一个 commit）。
- `node scripts/ci-pr-gate.mjs`（默认腿）→ `DSH-CI-VERDICT fail pass=6 fail=2`：`install` 因上述 store
  路径报 sqlite 错误；`artifacts-at-head` `not-run reason=store-not-writable`。
- `node scripts/ci-pr-gate.mjs --skip install,artifacts-at-head` → `DSH-CI-VERDICT pass pass=6 fail=0
  skip=3 skipped=install,artifacts-at-head,census`。
