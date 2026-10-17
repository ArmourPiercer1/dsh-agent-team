# review-PC — P-C 独立 code review：`alpha5-prod-pr7` @ `ce44fd4e`

- **审查者**：P-C 独立 reviewer（≠ 实现会话 `83dda87c`；本会话未参与该 PR 实现）。
- **受审对象**：branch `alpha5-prod-pr7`，固定 SHA `ce44fd4eae4d7977a323124eb540432305a2721b`；base = `d714a941`（= 写入时 `origin/master` tip，`git merge-base HEAD origin/master` = `d714a941`）。
- **一次性 worktree**：`.worktrees/a5p7-rev-pc`（detached @ `ce44fd4e`，本会话自建，自带 `node_modules` 与 pristine `tests/deepseek-harness-test-use` 副本）；对照 worktree `.worktrees/a5p7-rev-pc-base-ctl`（detached @ `d714a941`，同依赖副本）用于差分归因。
- **运行时**：宿主 `0.2.0-rc.2` @ `639ed01539`（`tests/paths.mjs` 唯一来源；porcelain 审查前后均 = 0，HEAD 未移动）；port **3185**（IF-2 族内）；world `tests/homes/a5w7pc*`（teardown 后 `tests/homes/` 为空）；稳定实例 `:3080` 只读探针 **401 → 401**，全程未操作；审查结束无残留 host 进程。
- **裁决（四选一）**：**补充内容**（1 项必须补充 = F-1；其余为记录项）。PR7 自述的每一项声明都被本会话独立复现成立；F-1 是本 PR 对**邻接 lane 亲验仪表**造成的回归，须随本 PR 或在同一合并列车中指派对齐。

---

## 0. 亲跑复现清单（本会话全部实跑，非引用实现方日志）

| # | 命令 | 结果 |
| --- | --- | --- |
| R1 | `node dev/.../prod/review-PC-differential.mjs` | 20 booked / **0 failures**；6 判据 transcript 与 base 逐字节相等 |
| R2 | `node dev/.../prod/review-PC-build-basekit.mjs` + base 原 kit `--port 3185` | base（d714a941）W7 原 kit 对 **head lane 源**零注入真跑 = **22/22 pass** |
| R3 | `node tests/kits/a5-w7-jobs-wiring/a5w7-kit.mjs --port 3185 --world-prefix a5w7pc2` | head kit（注入三源）真跑 **22/22 pass**（`review-PC-w7-run/`） |
| R4 | `node dev/.../prod/review-PC-liveprobe.mjs --port 3185` | 11 保留 leg + 审查者 PC1–PC4 = **15/15 pass**（`review-PC-live-run/`） |
| R5 | `node scripts/check-artifacts-committed.mjs` | `verdict=ok compared=1680 glue=1` |
| R6 | `node scripts/check-artifacts-at-head.mjs`（scratch worktree 重建 HEAD） | `script=check-artifacts-at-head subject=commit verdict=ok compared=1680 drift=0` |
| R7 | `tsc -p packages/runtime/tsconfig.build.json --outDir node_modules/.pc-w0a-fresh`（审查者自建 W0a） | exit=0；12 个 `.js/.d.ts` 与 committed **逐字节相同**；12 个 `.map` 仅 `sources` 前缀不同 |
| R8 | `npx vitest run packages/runtime/test/a5p7-*.test.ts` | **38/38**（9+18+7+4） |
| R9 | `npx vitest run`（全仓） | 7011 pass / 10 fail；**10 个失败在 base 对照 worktree 上逐条同现** → 非本 PR 差分（见 §5） |
| R10 | `node --test pr8-runner-self.test.mjs`（head / base 对照） | head **4 红**；base **35/35 绿** → F-1 |

---

## 1. ① 缺省 = base 逐字不变 —— **亲验成立（双向）**

### 1.1 仪表 A：双桶 transcript 差分（in-process，无注入）

同一 node 进程内同时装载 base 桶（`d714a941` committed dist barrel）与 head 桶（`ce44fd4e` committed dist barrel），对**同一脚本**跑六判据，捕获**每个返回值 + 每条 observation 事件 + 终态内部 dump**，以键排序的规范 JSON 逐字节对照（`review-PC-differential.mjs` / `.json`）。缺省形状 = 不注入 `identity`、不注入 `lease`、显式 `pinnedIdentity`。

| 判据（取自 W7 语义族） | 覆盖面 | 结果 |
| --- | --- | --- |
| C1 `W3-identity-pin` | owner 绑定、caller 对象事后变异（value pin）、`owner-mismatch`+alarm、`duplicate-job`、`jobOwnerKey` 数学 | **1162 canonical bytes 相等**（两侧各 2 条事件） |
| C2 `W4-isolation` | 两 member 互不可见、跨 scope 投影静态 detail、swapped-root viewer、第三方 viewer | **1492 相等** |
| C3 `W5-revocation-attribution` | 只取消自身 `(scope,name)` 移动的 job、邻居不误伤、不可读单独成类、执行时身份归因、probe 覆写 | **1972 相等** |
| C4 `W6-settle-release` | ACTIVE 期 settle、自计数零 drain→RELEASED、RELEASED 后 admit 拒 | **1485 相等** |
| C5 `W7-boundary-giveup` | A 持有 ⇒ B 拒、drain 起新 admit 立拒、跨边界 settle 拒且 token 保留、giveUp 后 release 永久拒、`refused` end 任意态终结 | **2971 相等** |
| C6 `redaction-unknown` | 未知 callId 记录不发明、无 outcome 事件不误终结、凭据形 key 入场即涂、投影面 | **1847 相等** |

**结论**：六判据在返回值、事件流、终态三层全部逐字节相同 ⇒ 缺省面未被本 PR 移动。

### 1.2 仪表 B：把 **base 原 kit** 打在 head 源上（"不注入三源跑 W7 原 kit"的字面执行）

从 `d714a941` 取出 kit 三件（`a5w7-kit.mjs`、`a5w7-jobs-plugin.mjs`、`tsconfig.lane.json`）重建为审查者仪表（`review-PC-basekit/`，构建脚本 `review-PC-build-basekit.mjs`），KIT_DIR/REPO_ROOT 指向本 worktree，并把 kit-local 编译指向 **head 的 `packages/runtime/jobs-gateway/**/*.ts`**。该 kit 的行**不含任何注入**（只有 `resolveDefinition` + `onObserve`，处处显式 pin）。

真跑（真宿主 :3185、真 durable members、mock model）结果：**criteria 22/22 pass**（`review-PC-basekit-run/kit.log`，W0a `tsc exit=0 import=BARREL_OK`；kit.log 内 `injected` 出现次数 = 0，即确为零注入行）。

⇒ 原 kit 的**全部** 22 项语义判据（不只是抽出的 6 条）在 head 生产模块上、零注入下逐字复现。

### 1.3 仪表 C：head kit 真跑（注入三源）22/22

`review-PC-w7-run/`（W0a 的 fresh-build 目录 = `node_modules/.a5w7-fresh-build`，teardown 已验证移除）。

### 1.4 边界记录（INFO，非回归判定）

`pinnedIdentity` 传入 `''` 或 `undefined` 且**无任何注入**时：base 接受并记空 pin（`gateway-job-admitted`，占 1 个 lease token），head 拒 `mapping-rejected`（`no-reader`，零状态增量）。两侧形状都在 `review-PC-differential.json` 的 `BND-*` 条目里留痕。TS 类型面（head 为 `pinnedIdentity?: string`）不允许该输入，a5p7/W7/W7M-2 三个消费者从不产生它；"fixture 形状 = 非空字符串逐字不变"由 C1–C6 + T2c 亲验。
**要求（措辞）**：`pc-CONTRACT.md` §4 的"行为逐字不变（新行为 opt-in）"应补一句限定——逐字不变的范围是**显式非空 pin 的 fixture 形状**；空/缺 pin 在缺省面也从"静默接受"变为"typed refusal"（更严，但不是逐字不变）。

---

## 2. ② admit-first 门 —— **亲验成立**

### 2.1 owner-not-durable ⇒ 零注册 veto（真跑 + 差分 0）

真跑 leg **PC1**（`review-PC-live-run/pc1-owner-not-durable-live.json`）：在活的装配行上，用行自己的 `/__a5w7/state` 面取前后快照，三种伪造 claim：

- `forged-instanceId`（真 root + 不存在的 `inst-pc-not-a-member`）
- `forged-rootSessionId`（不存在的 root + 真 instanceId）
- `swapped-pair`（另一 root + 真 instanceId）

三者全部 `owner-not-durable`；实测差分：`{jobs: 0, tokens: 0, windowState: "unchanged", admittedEvents: 0, alarmEvents: 3, observationDelta: 3}` ⇒ **零 job 记录、零 lease token、窗口状态不动、零 `gateway-job-admitted`、每次拒恰一条 alarm**。

**PC4（权威面为真）**：identity 源读到的 durable 行 = `["inst-0k44rfu1st9h","inst-1s1xm7v0w9kf","inst-leader"]`（宿主生成的两 member + leader 行），伪造 claim 不在其中 ⇒ veto 面对的是真权威，不是空 stub。

**"registry 差分 0"的两个口径都成立**：(a) gateway 侧 job/token 面差分 0（上）；(b) 宿主注册面零变化——`job_start` anchor 宿主树 grep **pre=0 / post=0**、活 roster 无 job-start 形名字（W0b/W8 复跑，`anchor-host-grep-*.json` + `anchor-runtime-roster.json`）。

**门序（T1b）**：veto 时注入 reader 调用数 = **0** ⇒ GATE 1（身份）确在 GATE 2（定义读）之前，veto 不触定义面。
**AUTHORITY COPY（T1c）**：让源返回与 claim 不同的规范化 owner 后，记录的 `ownerKey` = 权威副本 key ≠ claim key；claim 侧 `projectFor` 拒、权威侧可见 ⇒ 冻结的是源副本。
**记录项 N-1**：`identity.resolve` **抛异常**时 gateway 不吞异常（fail-loud），但注册面仍为 0（`T1d`）。契约把 try/catch 放在实现侧（§1.1① 样例有 `catch { return null }`）；建议在 pc-CONTRACT §2 明确"gateway 不为源兜异常"，避免后续装配行误以为可抛。

### 2.2 pin 省略 ⇒ admit 边现读；不可读 = mapping-rejected（负控）

真跑 **PC2**（`pc2-admit-edge-live-pin.json`）：

- 两次 pin 省略的 admit，行内 row-local store 先 `pc2-def-live-1` 后 `pc2-def-live-2` ⇒ 记录分别钉住 `pc2-def-live-1` / `pc2-def-live-2`（**admit 边现读、无缓存、非首读恒定**）；
- 负控 A：未注册 `(scope,name)` + pin 省略 ⇒ `mapping-rejected`；负控 B：先 `defPut` 再 `defWithdraw`（现读不可读）+ pin 省略 ⇒ `mapping-rejected`；两次负的差分 `{jobs: 0, tokens: 0}`；
- 对照：显式 `pinnedIdentity='pc2-explicit'` 对未注册 pair 仍**逐字通过**（钉 `pc2-explicit`）。

in-process 同族（`T2-*`）：无 reader + pin 省略 ⇒ `mapping-rejected`（`no-reader`）零增量；显式 pin ⇒ reader 调用数 **0**。

### 2.3 lease 注入对象驱动（`assemblyOwnsWindow` 复验）

- 真跑 **PC3**：`/__a5w7/state` 报 `assemblyOwnsWindow: true` + `identitySourceInjected: true`；审查者自己的 3 个 lease 在 ACTIVE 期 settle，装配面 `drain` 起新 admit 立拒（`gateway-not-active`），`release` 达 `RELEASED`（`pc3-assembly-owned-window-live.json`）。head kit 自己的 W6 同样断言该位（本会话复跑绿）。
- in-process **T3**：`gateway.lease === 注入窗口`；**同一窗口**上第二个 gateway 看见同一 token（⇒ gateway 内无私有影子窗口）；settle/drain/release 全打在装配对象上；**T3-giveup**：装配对象 `giveUp` 对 gateway 同样终态（跨边界 settle 拒、token 保留、状态 `GIVEN_UP`）。

---

## 3. ③ kit 切 committed dist 的字节恒等 + `tsconfig.lane.json` 退役

### 3.1 字节恒等声明 —— **亲验成立**

- kit 的 W0a 本会话复跑：`tsc exit=0 parity=IDENTICAL(12 emitted artifact files byte-identical) import=BARREL_OK`（`review-PC-w7-run/lane-tsc-output.txt` 首行 `exit=0`）。
- 审查者独立重建（R7）：24 个产物中 **12 个 `.js/.d.ts` 逐字节相同**；12 个 `.map` 不同，且**唯一差异字段是 `sources`**，差异内容只是 `--outDir` 覆写带来的相对路径前缀（`../../../../../packages/runtime/jobs-gateway/x.ts` vs `../../../../jobs-gateway/x.ts`）——与 kit 的"maps excluded"披露**逐字相符**，非漂移。
- 更强仪表（R6，独立于 kit）：`check-artifacts-at-head.mjs` 在 scratch worktree 按规范相对布局重建该 commit 并跑既有比较仪 → **`drift=0` / compared=1680**，maps 一并在内。⇒ committed dist 就是该 commit 自己的构建（不是陈旧镜像，也不是 kit 私有编译）。
- kit 确实以 committed dist 为 barrel：`gatewayUrl = …/packages/runtime/dist/packages/runtime/jobs-gateway/index.js`，W1b 报 8 个公共导出在场（真进程内读数）。

### 3.2 F-1（**必须补充**）：`tsconfig.lane.json` 退役有**活残引用**，令邻接 lane 亲验仪表转红

退役本体没问题（kit 已切 committed dist；`scripts/`、`tsconfig.build.json`、`.github/`、`packages/` 内对该路径**零引用**；kit README 与 W0a 注释按文档化退役路径改写）。残引用集中在 PR8/W8 的**装配锚点仪表**：

| 残引用位 | 性质 |
| --- | --- |
| `dev/agent-workflow/evidence/alpha5/pr8/probes/probe-lib.mjs` → `ASSEMBLY_FACES.W7.files[1].path` | **活仪表**：`grepAssemblyAnchors` 把"文件不在树内"记为 missing；`runner/lib.mjs:159/190` 用它决定 RLW 行能否 LIVE |
| `dev/agent-workflow/evidence/alpha5/pr8/runner/pr8-runner-self.test.mjs:495`（假根 fixture）+ `:485`（"master 现势装配锚点应全在场"断言） | **活自测** |
| `dev/agent-workflow/evidence/alpha5/pr8/matrix-machine.json` `anchor_contract` 词汇 ×5、`README.md`、`vnext-migration-gap-checklist.md` | 机检矩阵词汇与在册散文 |
| `dev/agent-workflow/evidence/alpha5/wiring/we2/tsconfig.lane.json:4` | 历史注释（散文，不构成引用） |

实测（同环境、同依赖，两个 worktree 只差一个 commit）：

- head `ce44fd4e`：`node --test --test-concurrency=1 …/pr8-runner-self.test.mjs` → **4 红**；其中机检矩阵报
  `M-13: TRANSITIONED-LIVE 但装配锚点亲验不在场（F-2）: W7: 装配面文件不在树内 tests/kits/a5-w7-jobs-wiring/tsconfig.lane.json`；
  直接调用亲验位亦复现：`grepAssemblyAnchors(root, ['W4','W5','W7'])` → `present=[W4,W5]`，`missing=["W7: 装配面文件不在树内 …/tsconfig.lane.json"]`。
- base `d714a941`：**35 tests / 35 pass / 0 fail**。

⇒ 该红是本 PR 造成的差分，不是环境噪声。`scripts/ci-pr-gate.mjs` **不含**该套件 ⇒ 不是 CI 红，但它是 W8 正式轮"装配面亲验位"，任何下一次 pr8/probe 复跑都会把在册 TRANSITIONED-LIVE 行读成锚点缺失。

**补充要求（内容）**：随本 PR（或同一合并列车，由 W8/pr8 面 owner/协调者落，PR7 作者不得沉默）把 W7 装配面表改到**在场的面**——建议：删去 `tsconfig.lane.json` 条，改为 (i) `tests/kits/a5-w7-jobs-wiring/a5w7-jobs-plugin.mjs` 现有的 `createJobsGateway(` 调用形 + `await import(directive.gatewayUrl)` import 形（仍成立，本会话亲验），并 (ii) 增一条编译面锚点 `packages/runtime/tsconfig.build.json` 的 lane include 行或 `packages/runtime/dist/packages/runtime/jobs-gateway/index.js` 在场；同步改 `pr8-runner-self.test.mjs` 的假根 fixture 与 `matrix-machine.json` 的 `anchor_contract` 词汇。
**兼容性说明**：这是装配面**词汇表**对齐，不触碰四份冻结文档语义、不触碰上游 seam、不改任何生产行为；与 `matrix-machine.json` 自述的"lane 以别面暴露装配须回报协调者改此表，禁在 probe 内私放宽松判据"是同一条规则的正面执行（本 PR 移除了表里的面，因此必须回报/改表）。

---

## 4. ④ dist 镜像 11 文件与 src 一致 —— **亲验成立**

- `check:artifacts`（工作树 vs index，两装面）：`verdict=ok compared=1680 glue=1`。
- `check:artifacts:head`（R6）：commit 自带构建，`drift=0`，1680 文件比对 ⇒ 11 个变更镜像文件与 3 个变更 src 模块一致。
- 变更集自洽：`index.js` 未变（新增仅 `export type`，无 emit 变化）而其 `.js.map` 变（map 内嵌源文）；`types.js`/`jobs-gateway.js` 变（JSDoc 契约注释入 emit）；全部落在 R6 的零漂移结论内。
- kit/plugin 读的就是该 barrel（W1b 8 导出 + R7 重建恒等）。

---

## 5. ⑤ a5p7 38/38 + hygiene + 零生产 import 边 —— **亲验成立**

- **a5p7 38/38**：`a5p7-job-owner` 9、`a5p7-lease-cancellation` 18、`a5p7-mcp-rebind-chain` 7、`a5p7-lane-hygiene` 4（本地依赖 + 祖先依赖两种解析下都跑过，结果同）。
- **hygiene 断言逐条读**（`a5p7-lane-hygiene.test.ts`）：(1) lane 文件集 pin = **14**（本 PR 未新增 `packages/**` 文件，p4t6 census 集合不变）；(2) 零生产消费者：扫 `packages/**` 的 `.ts/.mts/.mjs`，允许面 = 两 lane 目录 + `a5p7-*` spec，其余任何 importer ⇒ 红，`importers == []`；派生 `dist/` 按**有解释的**规则跳过，而 live row 的**源文件**在扫描面内 ⇒ "仅缺 live row 一行"是真的；(3) census 只允许"引用名"形；(4) lane 全文件 denylist 词汇零命中。
- **独立复核**：`grep -r jobs-gateway packages/runtime/src packages/client packages/domain/src` ⇒ **0 命中** ⇒ 零生产 import 边仍成立；`tests/kits/**` 侧 import 的是 dist barrel（测试 kit，非生产边，已在契约与 README 披露）。
- **全仓 vitest**：7011 pass / **10 fail**。归因：同一环境、同一依赖副本的 base `d714a941` 对照 worktree 上逐条复现同名失败——`packages/domain/test/t2-blueprint-hash.test.ts` 1、`packages/runtime/test/p6t3-mediation.test.ts` 5、`packages/runtime/test/p6t3-restart.test.ts` 2、`packages/tools/test/p6t6-actions.test.ts` 1、`packages/testkit/test/a4p7-merge-gate.test.ts` 1（单文件隔离跑 head/base 均红）。⇒ **本 PR 零测试回归**；这 10 项属既有/环境项，不在本 PR 判据内，也未被本 PR 掩盖。

---

## 6. 覆盖边界（不作宣称的部分）

- 未跑 `pnpm -r typecheck` 全包；本 lane 编译面由 `tsc -p packages/runtime/tsconfig.build.json`（exit 0）+ R6 的 HEAD 自带构建覆盖。
- 未复跑 W7M-2 green 16/16（本 PR 未触其文件；其消费面 = barrel 8 导出 + 显式 pin + option 子集，被 §1.1 的逐字差分与 T2c 覆盖）。
- Definition 身份源仍为 row-local 披露位（宿主无公开 seam），`G-g` OPEN、`final_declaration` 恒 null 纪律不变——与 `pc-CONTRACT.md` §5 一致，本审查不扩大任何宣称。
- 记录项 N-2：`JobsGateway.admitJob` 的 `pinnedIdentity` 变为可选后，缺省面从"照单全收"收敛为 typed refusal（§1.4）；建议契约里把它写成**有意的封闭世界收紧**，而不是"逐字不变"的子句。

---

## 7. 证据工件（本目录）

- `review-PC-differential.mjs` / `.json` — 双桶六判据 transcript 差分 + 注入门 20 项（20/0）。
- `review-PC-basekit/`（base kit 三件 + 构建脚本 `review-PC-build-basekit.mjs`）、`review-PC-basekit-run/` — **零注入** 22/22。
- `review-PC-w7-run/` — head kit（注入三源）22/22，含 `lane-tsc-output.txt`（`exit=0`）。
- `review-PC-build-liveprobe.mjs` + `pc-legs-block.txt` + `review-PC-liveprobe.mjs` + `review-PC-live-run/` — PC1 零注册 veto、PC2 admit 边现读+双负控、PC3 装配自有窗口、PC4 durable 金通道（15/15）。
- `build`/`ctl` 对照 worktree：`.worktrees/a5p7-rev-pc`（head）、`.worktrees/a5p7-rev-pc-base-ctl`（base）。

---

## 8. 判定

**补充内容**（非阻塞、非通过）。

- 通过的部分：①②③(字节恒等)④⑤ 全部独立复跑成立，且 ① 有双向证据（六判据逐字节 + base 原 kit 零注入 22/22），② 有真跑零注册 veto（state 差分 0）与两组负控，③④ 有独立于 kit 的 `check:artifacts:head drift=0`。
- 必须补充：**F-1** —— `tsconfig.lane.json` 删除留下的活残引用使 PR8/W8 装配锚点亲验仪表由 35/35 转 4 红（机检矩阵把在册 TRANSITIONED-LIVE 行读成锚点缺失）。补法见 §3.2，与冻结语义兼容，属词汇表对齐；若不在本 PR 内改（该文件归 W8/pr8 面 owner），必须在合并列车里显式指派并登记，禁默认沉默。
- 记录项：N-1（gateway 不为 identity 源兜异常）、N-2（缺省面空/缺 pin 的封闭世界收紧需在契约措辞中如实表述）。
