# ALPHA5 集成本轮台账（natexe）— 审批后执行：native bash 走 placement feed 的正型落地

分支 `alpha5-natexe`，基 = `alpha5-int-mnt@afd936ee`；一次性 worktree
`.worktrees/a5natexe`；writer = natexe（qwen3.8-flash-next）。
文件所有权：agent-bindings 核验/feed 区 + 其测试 + 本目录；未触
`plane-effect-backends.mjs`、未触 docs/skills。**生产 diff = 0**（本轮闭环
= 既有面的用法 + 钉 + 台账；见 §3）。

## 1. 缺口因果链（文件:行级，@ afd936ee）

**症状（GLUE-8 assembled A4.4 所钉落点）**：治理世界 native `bash` ask →
durable leader-approval 落账被消费 → dispatch 仍拒
`team tool guard: the Tool Binding for "bash" cannot be verified at dispatch
time (no fallback to the native body)`，NOTHING 执行。
钉 = glue8 kit `run-v4-feed-live.mjs:998-1014`（assembled 臂；注释
`:953-959` 自认该落点为当时正确设计）与 `:1030-1031`（preassembly 臂）。

因果链（每一跳 = 本树亲验行号）：

1. **守卫在每次调用时核验的是 Body 身份，不是名字**：`guardDecision`
   （`packages/runtime/tool-dispatch/closed-world-guard.ts:554`起）对
   `entry.verified === false` 直拒（`:581-597`），消息模板
   `guardDenialMessage` BINDING_UNVERIFIED 分支 = 上引 VERBATIM
   （`:196-199`，a5pbr2 测试逐字钉）。
2. **native 名字进的是 inherited-native lane**：assembly publish 时
   `installScopedToolGuard.publish()`（`install.ts:1162`起）读 scoped
   surface，对未 owned 的名字调 `bindInheritedSurface`
   （`closed-world-guard.ts:432`起）。verified 的唯一路 =
   `claimsNative = nativeNames.has(name)` 且 scoped 与 trusted(global)
   两读指纹一致（`:444-452`）。
3. **trusted native 列表在 web profile 上恒空**：`nativeNames` 唯一来源 =
   全局面 `tools.schemas()` 无 scope 读（`agent-bindings.mjs:2287-2296`）；
   web profile 设计上全局面为空（根 tool-fs/tool-bash 行禁用、preset-realm
   注册不达全局面）——**bind-diag 实测闭环**
   （`evidence/alpha5/wiring/bind-diag/README.md`：`globalNames=[]` →
   `unattributed` → 上引 VERBATIM 逐字复现；挂 top-level 工具行后
   `globalNames=[bash,edit,read,read_image,write]`、`sameDefinition=true`、
   bash 真跑）。故治理世界 native `bash` 恒 bound
   `unattributed`（`install.ts:1187` → `closed-world-guard.ts:483-505` 的
   unbound-observed 形），`verified=false`。
4. **审批改变不了这一点**：ask lane 的 durable approval 属
   pre-execute 权限面（账本三行 request→decision→consumption 实测对齐）；
   Guard 单调无 allow（`closed-world-guard.ts` 头部律 1）——批准只放开
   pre-execute 门，dispatch 落点仍撞第 1 跳的拒。这就是「审批后执行」
   未通的完整因果链。
5. **既有可信 feed 早已为此而设**：装配 PLACED 的名字走
   `bindAll`+`bindingFeed` 三闸（`install.ts:1077-1112`：realm 配对、
   「placement attribution is the only feed authority」（`:1098`）、
   placement→bind 连续性（`:1112`）），身份 = placement 时刻对象指纹
   （`install.ts` WeakMap `def#N`）。feed 填法 = `a5PlanePlacementFeed`
   （`agent-bindings.mjs:2228/2448`）← 平面 `placementFeed`
   （`team-tool-plane.mjs:503-511`）。**治理 `read` 行已经以 native 拼写
   takeover-mounted 并跑通此链**（`team-tool-plane.mjs:463-494`，
   int-a5b T5；C1 真字节 = 生产实证）。shell 行的名字本就是可配的
   （`team-tool-plane.mjs:315` `names` 合并；a5p5
   `names.bash ?? 'bash'`），lane 判定按 native 类映射
   （`nativeOf`，`:196-207`）。

## 2. 修复形态（复用既有 placement 可信 feed；零新语义、零新架构、零生产 diff）

行配置 `teamToolPlane.names = { bash: 'bash' }` → 平面 shell 行以 **native
拼写** takeover-mounted（与 `read` 行同形，int-a5b T5 先例）：

- 身份 = placement 时刻 `def#N`（`definitionIdentityOf`），经 `a5PlaneOwnedNames`
  （owned 名不走 inherited lane，`install.ts:1186`）+ `bindOwnTools` + feed
  三闸核验；**不从作者字段制造身份**（v4 `toolBindings` family 继续
  safe-but-dark，u1 ③ 选项 A = 既定律现行）；
- ask lane 语义不动：`bash` 仍 permission-ask，durable approval 仍是执行前
  唯一开门者（lane 判定亲验：ask 覆盖不拒、deny 臂 `template-deny-lane`
  先于 backend，unit N4）；
- 封闭世界不动：**没有** placement 行的作用域继续逐字 GLUE-8 拒（unit
  N1 逐字钉；GLUE-8 两模式 kit 的世界不带该 config → 预期不变、无悄改）；
- 批准后落点从「拒」变「真执行」仅发生在 takeover 世界；GLUE-8 assembled
  臂 A4.4 的旧预期在其自己的世界（无 takeover config）继续成立——本轮
  **未改 GLUE-8 kit 一个字节**。

## 3. 验收

- **live kit** `run-natexe-live.mjs`（本目录，v3+v4 双世界）：
  **ALL GREEN 26/26**（`runs/live-2026-10-18T03-54-26/`，KIT_EXIT=0；
  v3 13/13 + v4 13/13）。E4 账本三行逐 requestId 对齐、E4.2 批准 OPEN 期
  零副作用、E5.1 批准消费后真执行（governed root 内哨兵文件字节 + wire
  exit=0 + SENTINEL-WROTE）、E6.1 批准不放大（第二次批准后的越界写
  `cannot create ... Permission denied`，HOME 内无逃逸文件）、E7.1 deny
  臂先于 ask/backend 由持久权限层拒（见 §5 逐字披露）、E8.1 装配见证
  `placement-feed rows=[team_grep,team_glob,bash,read]` + `confined-shell
  ran`、E9 双时代身份零漂移（v3 anchor 恒 3/current）。
  **resolveControl 版本律实测**：contract-v4 方法对 v3-era 与 v4-era 团队
  均以 payload version 4 成功（方法可用性=契约版本，与蓝本时代正交；
  `ports.ts:513` "v4-only" = 引入版本）。
- **GLUE-8 两模式 kit 不回归（本树复跑，未改其一个字节）**：
  assembled **20/20**（`a5natexe-glue8-assembled.log`）+ preassembly
  **15/15**（`a5natexe-glue8-preassembly.log`），均 VERDICT GREEN fails=[]。
- **全树双抓红集恒等 published 9**（本目录 `vitest-fulltree-natexe-{1,2}.log`，
  RUN1≡RUN2≡published **逐行恒等**（`.reds` 三份 diff 空 =
  `TRIPLE_IDENTITY_OK`；files 579 / legs 7289 = published 578/7281 + 本票
  1 文件 8 测试全绿）：红 = t2×1 + p6t3-mediation×5 + p6t3-restart×2 +
  p6t6×1，drift 另验 `check:artifacts:head` drift=0（1746，glue=7）。
- **unit 钉**：`packages/runtime/test/a5natexe-native-takeover.test.ts`
  （N1 unfed 落点逐字存续 / N2 takeover 走 feed → abstain → placed body
  真跑 / N3 三闸各自拒形 / N4 lane 语义 native 拼写）= **8/8**；
  `p4t6-session-event-scan`（具名集入账后）+ 本测试合跑 **18/18**。
  首跑曾 1 红 = 本测试对生产漂移消息的转写不符，按「真实失败≠静默修复」
  以生产 VERBATIM（`install.ts:1112` "the Body moved between placement
  and bind"）为真钉正，未动生产消息。
- **本票新增文件的树律义务（全部按既有法履行，均非回归）**：
  (a) `p4t6-session-event-scan.test.ts` 具名集入账一笔
  （`SCANNED_PATHS_A5NATEXE`，tie `1185-1184`，979→980；a5glb 分支自审
  先例同款）；
  (b) `a4p7-merge-gate` typecheck 腿：live 行无声明面（by design），unit
  改用树内既有法 = 计算式 specifier 动态 import + 局部 cast（同
  `alpha5-glue7-plane-backends.test.ts:114`），runtime 包 tsc 净；
  (c) `a4p7-merge-gate` composition-smoke 腿 = 本 worktree 环境缺口：
  client dist 未构建（gitignored 构建面）→ `pnpm --filter
  @dsh-agent-team/client build` 补齐（int-mnt 同款环境修复，porcelain
  恒 0），产物 `packages/client/dist/packages/client/src/plugin/
  client.js` 就位。

## 4. 运行记录

- test-use = 本 worktree 独立 pristine clone @ `639ed01539…`（paths.mjs
  基线），porcelain 0 前后亲验；node_modules 硬链自 a5int-mnt 同锁文件树
  （磁盘 95% 环境下的既定法）。
- 端口：host `3184`、mock `349x` 族（kit 自检 free）；:3080/:3180 只读探针
  前后同值（kit H0/H3）。
- 世界 `tests/homes/a5natexe-<era>-<stamp>` 跑毕即扫（kit 自证 swept）。
- 一次性探针 `probe-takeover-assembly.mjs`（装配面 5 连：takeover ownNames /
  feed 身份 / lane ask-allow / deny-lane 先拒 / 默认别名零漂移）= exit 0。
- push：`git push origin alpha5-natexe` 于本会话执行前亲验 **https remote
  无凭据**（同 u1/glue7 先例 fatal）→ **未推**，分支本地留存，head 以
  `git rev-parse alpha5-natexe` 为准。

## 5. 逐字披露（leg-semantics updates，绝不静默）

1. **GLUE-8 kit 未改一字节**：其 assembled A4.4（批准后 native bash 拒
   `...cannot be verified at dispatch time (no fallback to the native
   body)`）的世界**不带** takeover config，落点在本树复跑逐字存续
   （assembled **20/20**、preassembly **15/15**）。
   「批准后真执行」只在带 placement 行的 takeover 世界成立——这正是缺口
   定义（该世界此前不存在）。
2. **deny 臂落点身份**（本 kit E7.1 新腿）：takeover 世界上 deny-lane
   成员的 native bash 由**持久权限层**先于 ask/backend 拒：
   `Error: permission denied: exec fingerprint sha256:<fp> answered deny
   from the layer`（生产消息 `permission-lifecycle/decision-lane.ts:387`，
   kernel-precedence 折叠）。GLUE-7 世界的别名形落点 `template-deny-lane`
   （plane lane 码）继续由 unit N4 与 #321 kit 钉死。两者同为
   deny-before-effect、零副作用、零 ask 行；本 kit 以实测 VERBATIM 为钉，
   未把生产消息改成 kit 的期望。
3. **首跑红→修的真实因果**（非静默修复记录）：
   (a) v3 首跑 ask 永不开 = 本 kit 蓝本 memberEnvelopes 漏 `request-control`
   （kit 侧修复，生产无关）；
   (b) 首跑「第三条 ledger 行(user-approval)」与「成员结果读到 leader 行」
   = 本 kit oracle 以全文包含判会话归属，把 bash 注进了 leader 对话的
   伪影；改为「首条 user 消息归属法」后消失（mock-digest.jsonl 全程见证）；
   (c) unit G-c 首跑红 = 本测试对生产漂移消息的转写不符，以生产 VERBATIM
   为真（§3）。生产代码全程 0 改动。

## 6. 定性补单（根 04:34Z）：配置来源定性 → 合法配置面 → 防冒充值域封闭

### 6.1 ① takeover 配置来源定性（文件:行因果链）

`teamToolPlane.names={bash:'bash'}` **不是 kit 专属注入**，它是**行 config
的既有语法面**，真实安装路径可达：

- 宿主行 config 来源 = `DSH_HOME/profiles/web/cordis.patch.yml`
  （docs/INSTALL.md §3.2，公开安装面；git-install 的 bundle 行同面）；
- 装配消费点 = `agent-bindings.mjs:2412-2413`
  （`config.teamToolPlane` 存在且模板 governed → 挂平面；`planeCfg` 整块
  传入 `createTeamToolPlaneAssembly` 的 `input.plane`）；
- `names` 合并点 = `team-tool-plane.mjs`（`{...DEFAULT_PLANE_NAMES,
  ...input.plane?.names}`），与 shipped 的 `readName` 默认 `'read'`
  （治理 read 行的 native takeover，GLUE-7 shipped 先例）同块同通道；
- **blueprint 无通道（设计如此）**：顶层字段集封闭
  （`validate.ts:1347 assertNoUnknownFields` → `common.ts:35` 抛
  `MALFORMED_DTO`「TeamBlueprint has unknown field」；v4 集 = v3 + 冻结增量，
  `blueprint-v4.ts:63-64`），任何作者字段都造不出平面挂载——placement
  attribution 是 feed 的唯一权威，作者面参与造身份即破封闭世界法。

### 6.2 ② 合法配置面 + 用户文档

行为面本就走 §3.2 行 config（零新通道）；本轮补**用户文档** = INSTALL
新增 **§3.5 治理工具面（`teamToolPlane` 行 config）**：完整 config 模板
（realmId/fsInstance/confinedProvider 三件套 + names 接管）、值域封闭法、
缺省零挂载（A4.4 fail-closed 存续）、审批后执行语义。只写已验证行为，
每条挂证据线（natexe/glue7/glue8）。

### 6.3 ③ 防同名冒充审计（实测→封闭）

审计**实测**（probe legs A1-A4，`probe-takeover-assembly.mjs` 扩展腿）：
值域原本**不闭**——(A1) shell 行挂到 grep 行名（同名双行）、(A2) shell 行
冒充 `read`、(A3) 空串名、(A4) `__proto__` 全部通过装配。lane 的
native-first 律（team-tool-plane.mjs createLaneDecide）使这些异常只能
**收紧** deny 覆盖、不能放宽，且不污染原型——但同名双挂载是真实危害面。

**修复 = Gate 0b `verifyPlaneNames`**（build 边界，与 Gate 0
`verifyConfinedProviderPairing` 同一装配拒绝面，生产码 +1 文件）：
形状 `^[a-z][a-z0-9_]{0,63}$`；键集封闭（grep/glob/bash）；四挂载名两两
互异；**原生拼写只能被本类行接管**（`bash:'bash'` = 本轮 takeover 合法；
`bash:'read'`/`grep:'bash'`/`bash:'write'` 冒充一律拒）。violation →
`PLANE_NAMES_INVALID` 装配拒绝 = 启动 fail-closed。
真值表 11/11（合法形态 defaults/takeover/自定义别名全过）；probe 9/9
（A1-A4 全部 REFUSED）；unit **N5** 两腿（恶意形态逐字码 + 合法形态零回归）；
总 unit 10/10。

**攻击面闭合结论**：(a) 恶意 blueprint → names 冒充 = 无通道（§6.1，
封闭字段集既有法定死）；(b) 恶意行 config = 安装者信任层（与 `glueUrl`
任意代码同层，无新增攻击面），realm 配对 + attribution 唯一权威 +
placement→bind 连续性三闸已把身份封死在本装配 realm 内，跨 realm 同名
不可能（unit N3 G-a/G-b/G-c 持续钉）；(c) 无 takeover 旧配置 fail-closed
存续由 unit N1（逐字落点）+ GLUE-8 两模式复跑钉死。

### 6.4 生产 diff 披露（更正首节口径）

首节「生产 diff=0」自本补单起更正为：**生产改动 = 1 文件 1 面**
（`team-tool-plane.mjs` Gate 0b 值域封闭，装配期拒绝，无任何运行时新语义/
新权限；dist 镜像同步，drift 门复验）。合法配置（缺省别名形 / takeover 形 /
自定义别名）逐字节行为不变——由 GLUE-7 unit 16/16、GLUE-8 两模式、
natexe 双时代 kit 复跑证明。

### 6.5 复跑 receipts（Gate 0b 之后，全部本树）

- natexe live kit 双时代 **26/26 ALL GREEN**（`kit-supplement-run.log`，
  runs/live-2026-10-18T04-45-51）；
- GLUE-8 assembled **20/20** + preassembly **15/15**（换端 3185 复跑：
  `glue8-rerun-assembled-0434.log` / `glue8-rerun-preassembly-0434.log`，
  3182 被并行世界占用属他方，换端非语义变化）；
- GLUE-7 live kit（#321，plane 挂载世界全链）：**24/24 GREEN**（`glue7-rerun-run2-GREEN-24-24.log`，换端 3186/3187；首跑 RED 唯一腿 = E2 drift 门，当时 src/dist 尚未 commit——commit 后复跑即绿，两轮日志均存证，非语义失败）；
- 全树双抓（Gate 0b 后）：**RUN5 ≡ RUN6 ≡ published 红 9 逐行恒等**
  （`vitest-fulltree-natexe-{5,6}.log`，`.reds` diff 空 =
  RUN5_EQ_RUN6_EQ_PUBLISHED；files 579 / legs 7291；红 = t2×1 +
  p6t3-mediation×5 + p6t3-restart×2 + p6t6×1）。
- **树内既有竞态披露（本票补单二次双抓发现，非本票引入）**：全树 RUN 对
  中，`p4t6 coverage` 计数题与 `a4p7-merge-gate` 的真实构建腿存在时序竞态
  ——a4p7 的构建腿运行期在 `packages/**` 下写临时文件（运行毕即消失；其持久
  dist 产物不在 p4t6 扫描面，solo 复跑在产物在场时恒绿），p4t6 的冻结计数
  扫描若与之重叠会瞬时多计（实测 `expected 1194 to be 1192` 一例，
  `vitest-fulltree-natexe-4.log`）。本票改动不触任何构建产物；双抓恒等以
  竞态未命中的 RUN 对为准，两轮日志全存证。

## 6.6 独审 06:43Z 修正轮（Gate 0b 语义收紧，PR 链续笔）

裁决：`PLANE_NATIVE_CLAIMS` 以粗权限类别归并（write/edit/read_image/lsp→read、
pwsh→bash）导致 `readName="write"/"edit"/"lsp"/"read_image"`、
`names.bash="pwsh"` 过闸——**粗粒度权限类别 ≠ 工具实现等价**。

- **① 三面实测（修复前留痕，代码级结论）**：`measure-native-claims-pre-fix.mjs` +
  `-pre-fix.log`。FACE A：五形全过 verifyPlaneNames（缺陷坐实）。FACE B：
  `readName="write"` 装配出的 read 行 **MASK 宿主 write**（own 层胜出）、以
  read schema（`file_path`，无 content 面）应答、execute 返回文件内容而零写入，
  placement feed 交出 def 身份 → guard 会 **verified-abstain**（受验的冒充者）；
  `bash@pwsh` 行被 lane 按 BASH 类判 while durable exec-approval 面说 PWSH
  身份（一次调用两个裁决身份）。FACE C：plane lane 按 effect CLASS 分类
  （`{tool:'write'}` deny 不命中 read-kind，实测 allow），durable 面按
  DISPATCHED 名投影（permission-lifecycle/decision-lane.ts:174-184）。
  **每形结论：无受支持的同类接管依据**（read 实现≠write 实现；bash body≠pwsh
  实现；schema/权限身份双侧分裂）。
- **② 最小拒绝**：判据 = 装配面存在同名同义实现。支持对 = **bash 行@`bash`**
  （live 双时代实测）+ **read 行@`read`**（shipped readName 默认）；其余保留名
  （write/edit/read_image/lsp/pwsh/grep/glob 一切组合）装配前 typed 拒，具名子类
  `PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED`（shape/keys/collision 保持
  `PLANE_NAMES_INVALID`）。grep/glob 行保留别名挂载（GLUE-5 别名裁决：无已验
  装配对）。非保留自定义别名不受影响。
- **③ 全矩阵**：`matrix-reserved-native.mjs`（9 reserved × 4 rows = 36 格，
  每格 verdict+依据，可执行重放）+ receipt：GREEN，2 accepted / 34 refused。
- **口径变更披露**：truth table 11 行 verdict 不变（3 accepted / 8 refused），
  其中 3 行 code 换为具名子类（工件注记+receipt 重打）；unit N5 拒形清单扩至
  14 形并逐形钉 code；探针 A2 现报新 code（REFUSED 语义不变，9/9）。
  INSTALL §3.5 挂载名规则同步改写。

## 6.7 独审必办轮（#329 PASS 后三必办，head 1d3b4e81 续笔）

- **① 保留名边界穷尽**：首刀 9 名静态表留下 web_search/skill/todo_write/
  present/send_message 等真实宿主原生名可挂（同一 own-mask+verified-abstain
  面）。修法 = 支持对白名单穷尽：`PLANE_RESERVED_NATIVE` 扩为**宿主发布面
  穷尽表**（51 精确注册名，逐一取自 pinned host 的 tool-* 包注册面 +
  `mcp__` 前缀族），来源二选一核码后定案 = **静态超集 + 宿主版本 pin +
  漂移钉测**（依据：`createTeamToolPlaneAssembly` 输入恰为
  `{backends, fs, instanceId, plane}`，宿主工具面在挂载名固化处不可得；
  治理世界 web profile 原生派发面实测为空——派生即空表 = 不设防）；
  `PLANE_RESERVED_NATIVE_HOST_PIN='0.2.0-rc.2@639ed01539'` 与 tests/paths.mjs
  比对，基线一动 unit 漂移钉 RED。unit 12/12（新增漂移钉 + 混合缺陷优先序
  钉，N5 扩 6 形宿主名拒钉）；矩阵重放 = **208 格**（51+前缀 × 4 行，
  receipt GREEN：2 accepted / 206 refused）。
- **② 引用精度（追加不改写）**：decision-lane 名键裁决位精确 = :242/:332/
  :370（原引 :174-184 为投影段；measure log 尾部注记，本文件与 ROUTER_LOG
  以本节为准）。
- **③ 混合缺陷优先序**：形状→保留名声明→互异，先命中者拒（"其余保持
  INVALID"仅纯单类缺陷成立）；INSTALL §3.5 与门注记同步，unit 钉之。
- **回归**：truth table 11 行 verdict 不变（3/8，子类披露同前）、probe 9/9、
  natexe kit 双时代 26/26、drift 门终 HEAD、tsc/eslint 净。

## 6.8 增量复核收口一笔（3f36a9ef 续笔：穷尽表 51→53）

独审全 tool-* defineTool 精确枚举比对：漏 `cordis_inspect_list` /
`cordis_inspect_query`（tool-cordis/src/index.ts:23，cordis preset 门控——
同门控类的 experimental agent-team 6 名已收录，准据一致故必收；cordis-preset
世界本可 own-mask+verified-abstain）。修 = 注册表 53 名（src+dist 镜像），
矩阵重放 **216 格**（53 精确名 + 1 前缀探针，各 × 4 行；2 accepted /
214 具名子类拒），matrix 头注旧文案（36 格/34 拒）改实数，N5 +2 拒行、
漂移钉关键子集 +2，INSTALL §3.5 计数同步；漂移 pin 不变。
