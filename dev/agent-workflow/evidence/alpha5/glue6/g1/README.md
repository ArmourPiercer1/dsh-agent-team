# alpha5-g1 — plane deny-lane 命名空间统一（GAP PROBE G1 修复轮）

- 分支：`alpha5-g1-denyfix`（1 task = 1 branch = 1 worktree `.worktrees/a5g1-denyfix`）
- base：`fe829038`（origin/master 含 #311 install-entry recorded run 面）
- 提交链：RED `ef8cb081` → 修复 `7605d5a6`（src+dist 镜像同笔）→ 成功臂补针 `dcf71bdb` → 证据笔
- **base 与预期 rebase**：#313（render ContentBlock[]）/#314 **未并入**本 base（即将先行
  合并）；本支合入序预期 = #313/#314 先 master、本支 **rebase 后重跑本 kit 两 posture**
  （lane 改动在 `createLaneDecide` 内部，与 render/打包面无交叠；套件与 kit 字节预期零改）。
  合并后 CI 统一验证由 parent 侧执行。
- 世界/端口：`a5g1-<posture>-<runid>`，kit 宿主 `:3185`、mock `:3495`；`:3080` 只读探针（前后 401→401，从未 POST）
- 宿主：`tests/deepseek-harness-test-use` pristine 0.2.0-rc.2 @ `639ed01539`（H3a/H3b porcelain 0）

## 1. 症状（GAP PROBE G1 原文引用）

三条上游记录，逐字引用（未合并分支 `origin/alpha5-glue6-fix` 与 master 日志）：

**① GLUE-6 README §5（`git show origin/alpha5-glue6-fix:dev/agent-workflow/evidence/alpha5/glue6/README.md`）**：

> - **GAP PROBE G1（记录，未修，非本轮范围）**：member 模板 deny 了 bash 类、也没有给
>   grep/glob 任何 lane 覆盖，按语义这两次 own-layer 调用应在 deny lane 被挡
>   （`code=template-deny-lane`）；实测两次都走到 backend 面
>   （`code=IO_POLICY_UNSUPPORTED`），`denyLaneSeen=false`。原因是
>   `createLaneDecide`（`team-tool-plane.mjs:205-226`）的 `bashNames`/`fileNames` 装的是
>   挂载后的**别名**，而 lane 的 effect 声明说的是**原生类名**
>   （`packages/tools/a5p5-tools/src/effects-schema.ts:77` `toolName = parsed.tool`），
>   两条 lane 快速路径对 plane 工具恒不命中。已上报 parent 排期；本轮只保证"判决能送到模型
>   手里"这一契约，不偷偷扩范围。

**② GLUE-6 kit G1 判据（`a5g6-install-kit.mjs` 的 `check('G1', …)` 文本）**：

> GAP PROBE — recorded, NOT fixed here: the member template DENIES the bash class and
> gives no grep/glob coverage, so the deny lane (code=template-deny-lane) is where
> these calls should be answered. … any code other than template-deny-lane means
> createLaneDecide (team-tool-plane.mjs:205-226 — bashNames/fileNames hold the mounted
> ALIASES) never matches the effect the lane declares (a5p5 effects-schema.ts:77
> `toolName = parsed.tool`, the NATIVE class), i.e. the deny-lane fast path is inert
> for the plane tools.

**③ SESSION_ROUTER_LOG ⑥588（`git show origin/alpha5-glue6-fix:dev/agent-workflow/SESSION_ROUTER_LOG.md`）**：

> **本轮发现但 NOT fixed（上报待排）**=GAP PROBE **G1**：member 模板 deny 了 bash 类且无
> grep/glob lane 覆盖，语义上两次 own-layer 调用应死在 deny lane（`template-deny-lane`），
> 实测两次都走到 backend 面（`IO_POLICY_UNSUPPORTED`，`denyLaneSeen=false`）。原因＝
> `createLaneDecide`（`team-tool-plane.mjs:205-226`）的 `bashNames/fileNames` 装挂载后
> **别名**，而 lane effect 声明说**原生类名**（`a5p5-tools/src/effects-schema.ts:77`
> `toolName=parsed.tool`）⇒ 两条 lane 快速路径对 plane 工具恒不命中。

（master 侧的同一缺口三行在 `SESSION_ROUTER_LOG.md:6587`〔#311 install-entry recorded run
条目，(2)(3) 两行即 render-face 崩与 IO_POLICY_UNSUPPORTED 落点〕。）

## 2. 根因

`createLaneDecide`（`packages/runtime/src/plugin/live/team-tool-plane.mjs`）的两条快速路径用
**挂载别名**做集合判定（`bashNames = {planeNames.bash} = {'team_bash'}`、
`fileNames = {'team_grep','team_glob'}`），而 lane 的两端——模板策略规则与派生 effect 声明
（a5p5 `effects-schema.ts:77 toolName = parsed.tool`）——都说**原生类名**（`bash/grep/glob`）。
`bashNames.has('bash') === false` 恒成立 ⇒ 对挂载了 `team_*` 别名的 plane，(a) deny-lane
快速路径与 (b) default-deny 门同时失活；模板 deny 对 plane 工具恒不命中，调用落到 backend 面。
生产面（未注 backend）落点即 `IO_POLICY_UNSUPPORTED` —— 它是**落点证据，永远不是 deny 证据**。

## 3. 修法（语义不变，无新架构，R-a/封闭世界不动）

`createLaneDecide` 内建**单点** 挂载别名↔原生类 映射 `nativeOf`：由 `planeNames`
（原生类→挂载名表）反向构造，原生拼写先占位（别名不得遮蔽原生类名）；(a)(b) 两条快速路径
的每个名字都经这**一个点**解析后，只在原生命名空间里比较。既定权限语义逐条不变：lane 只收紧
不放宽、`shellToolsDenyOnly()` 特例不动、文件类臂判定不动、default-deny 门语义不动；
`planeNames` 之外的名字解析为自身，判定逐字节不变（Δ=[ ]，见 §5 向量表）。
dist 镜像 `packages/runtime/dist/…/team-tool-plane.mjs` 与 src **同笔提交**（place-dist-glue
byte-identical placement；`check:artifacts:head` 在 `7605d5a6` drift=0 / 1730 compared）。

**成功臂补针（parent ③，`dcf71bdb`，测试笔非语义笔）**：lane 放行时（ask-default、无 deny
的 member 配置——member 的 shell ALLOW 被策略派生拒绝，故 ask-default 是最小开 lane 形状），
`team_bash`/`team_grep` 达 fixture backend 的**字节成功**必须原样带回合法呈现
（`bash · exit=0` / `a5p5-meta` + 成功 marker，全程无 `a5p5-refused`），execCount 各 1。
宿主面向的 **ContentBlock[] 投影**在本 base 实测为 `String(value?.text ?? '')`
（#311 日志 ⑥587(2)）——那是 #313/#314 的面，此处**测量+披露而不钉死**（钉死=偷并把另一
lane 拖进本轮）；rebase 后该断言归 #313/#314 侧套件。

## 4. 环境与观测口径（如实披露，任务口径内选择）

- **正控口径**：本 base 上"具备真实 backend 的正控环境"择**可达者 = fixture backend 轴
  （AXIS-A）**：production assembly（从被测树**已提交 dist 镜像** import，sha 记录）经公开
  `backends` 装配 seam 注入可观测 backend（execCount + fs sentinel + 呈现文本 marker），
  经挂载别名 `team_*` 驱动。生产宿主不注 backend（GLUE-4 已披露后续），live 轴给不出
  before/after 排序。
- **live 盲区**：GLUE-6 render-face 修复（#313）未并入 master ⇒ 本 base 上任何**落到**
  backend 面的 live 工具结果都在宿主结果组装处崩（`content.some is not a function`），
  模型侧看不到判决码；两 posture 都以 **aux 面**启动（#311 的 strict 面自足缺口属 GLUE-6/#313
  lane，未并入）。red/green 两跑**同形**，唯一 delta = lane 字节。
- 因此：**排序/零副作用**在 AXIS-A 上判；**live 轴**只判 mount 现实（L0：`a5-plane: placed`
  行 + member wire catalog 含三别名 + 全局零别名）与 red 的**落点见证**（denied 调用带着
  backend 结果走到宿主组装——崩文出现在 member 的 tool result 里；lane 拒 never 组装 content）。
- 铁律执行：`IO_POLICY_UNSUPPORTED` 只作落点证据使用，从未当 deny 证据。

## 5. 证据（`runs/`，双 posture recorded run）

| 判据 | red（`--worktree …a5g1-redcap` @ `fe829038`） | green（HEAD `7605d5a6`+） |
|---|---|---|
| K1 fixture 正控 | denied `team_bash` 返回 **backend 成功**（`A5G1_BACKEND_RAN`）、execCount 1、sentinel **已写** — deny 未命中且有真实副作用 | `a5p5-refused kind=refused-admission code=template-deny-lane`，execCount 0、sentinel **不存在** — 拒在 backend 之前、零副作用 |
| K2 allow lane | `A5G1_GREP_HIT` + execCount 1 + sentinel（两 posture 同判） | 同左（防过修） |
| K3 生产(shut)面 | denied bash 带 `code=IO_POLICY_UNSUPPORTED` 且无 lane 码（落点） | denied bash `code=template-deny-lane` 且**无**落点码；allow lane 仍落 shut backend 面 |
| K4 default-deny 门 | uncovered grep 落 backend 面 | `code=template-default-deny` 先于 shut backend；bash 的 shellToolsDenyOnly 特例保持（两 posture 同） |
| K5 判决向量表 | 11 向量逐一如期（`axis-a-red.json`） | 11 向量逐一如期（`axis-a-green.json`）；配对= **4 翻转**（原生 bash deny×2、uncovered grep/glob 门）/ **7 恒等**（别名拼写×2、takeover 挂载、allow lane、非 plane 名、文件类 exact、ask default）⇒ Δ=[ ] |
| E1–E3 | aux 面展开 1732 文件 + 依赖闭包 BFS + eager load-graph 零错零逃逸 | 同形 |
| A0/A1 | 宿主起服 + 插件行 applied:true（aux 面） | 同形 |
| L0 | plane mount + member wire 三别名 + 全局零别名 | 同形 |
| L1/L2 | live deny-miss（log/wire/final 零 lane 码）+ 落点（崩文在 tool result） | chain 完整（delegate+collect+member final），无新增错误类 |
| H3a/b、C1/C2 | :3080 只读不变、porcelain 0、世界扫净、零泄漏 | 同形 |

RED 的权威单元测试捕获（**final committed test bytes @ 未修生产字节**，临时 worktree
`.worktrees/a5g1-redcap` @ `fe829038`）：`history/red-bytes-final-on-fe829038.log`
= 6 failed / 4 passed；6 条失败全为 deny-miss/落点形状（`kind=backend-failed
code=IO_POLICY_UNSUPPORTED`），4 条恒等 pin 绿。

## 6. 门禁

- vitest 全量（final HEAD `dcf71bdb`，双捕获恒等）：`563 files / 7097 legs`（= 基线 562/7086
  **+1 文件/+11 legs** = 本轮新套件 11 腿全部绿）；红 **9 = 已发布 9-red 基线逐条相同**
  （p6t3-mediation×5、p6t3-restart×2、p6t6×1、t2×1），零新增红。基线窗口期曾见的
  `a4p7 > composition smoke leg`（未构建的 gitignored `packages/client/dist`，构建后转绿）
  与 `a3p3`/`rc2` 两条负载窗口 flake（后者 5s 超时型）在静默终捕获中转绿，全部如实披露于
  `runs/CENSUS.md`（含一次被中断捕获泄漏 `.tmp-fault` scratch 导致的采集污染对——已弃置重抓）。
  双捕获记录：`runs/CENSUS.md` + `census-capture-1/2.log`。
- `pnpm check:artifacts:head` @ `7605d5a6`：**verdict=ok compared=1730 drift=0**（镜像同笔）。
- `pnpm -r run typecheck`：**EXIT=0**（`history/typecheck.log`）。
- eslint 全仓指纹：base `fe829038` 与 HEAD 均 **161 problems（129 errors/32 warnings）**，
  finding 指纹多重集逐条相同（`history/lint-base.log` vs `history/lint-head.log`）；
  本轮触碰文件（lane row / 测试 / p4t6）单文件 lint 0 findings。
- p4t6 census 记账：链 `1168 → 1169`（`packages/runtime/test/alpha5-g1-deny-lane.test.ts`
  在 RED 提交 `ef8cb081` 已记账；kit 文件在 `dev/` 下不入扫描面）。

## 7. 复跑

```
node dev/agent-workflow/evidence/alpha5/glue6/g1/a5g1-deny-kit.mjs --posture green
node dev/agent-workflow/evidence/alpha5/glue6/g1/a5g1-deny-kit.mjs --posture red \
  --worktree <pre-fix-tree> --testuse <pristine-host-tree>
```

## 8. 迭代披露（kit/测试字节，非判据偷改）

- 测试字节：首次 RED（`ef829038` 字节）中两条 assembly 行先死于**测试自身**的 schema 严格度
  （grep 参数缺 `output_mode` → `refused-schema` 抢在 lane 测量之前）。修正后以
  **final committed bytes** 在未修生产字节上重抓权威 RED（`history/red-bytes-final-on-fe829038.log`），
  6/4 切分与四条恒等 pin 不变；首次 6/4 捕获为会话记录（无独立日志），如实说明。
- kit 首跑（`history/kit-red-iteration-1.log`，14/17）三条 FAIL 均为 **kit 自身预期错误**，
  与 lane 语义无关：takeover 挂载在 pre-fix 本就命中（挂载名==原生类名，改为恒等向量）；
  load-graph 探针误断言两条 lazy 行（#311 未并缺口，改为 5 eager 行 + lazy 记录）；
  red L2 落点见证在 wire（崩文作为 tool result 送达）而非 instance log。修正后 recorded run
  red 17/17、green 16/16（`history/kit-red-console.log`、`history/kit-green-console.log`）。
- observer 行 / 蓝图 / mock 脚本 / 红action 与泄漏扫描沿用 GLUE-6 kit 机制（复制非重造）。
