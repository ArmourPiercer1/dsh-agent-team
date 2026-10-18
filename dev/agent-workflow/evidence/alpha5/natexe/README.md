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
