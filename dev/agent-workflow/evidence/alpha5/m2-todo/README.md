# m2-todo — Alpha.5 M2-TODO-01（矩阵行 `todo_write (M-14)`）owner 证据目录

Owner：todo_write M2 卡 owner（唯一）。工作树 `.worktrees/a5-m1-kernel` @ `7a3540937`（branch `feat/a5-m1-center-kernel`）；宿主树 `tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84`（pin639，`.git/HEAD` 直载复核，porcelain 空）。全程零 Host、零端口、宿主零字节、零 commit。

## 1. 定位包（全 path:line，逐条本轮亲读复验）

宿主（pin639 固定树内）：
- `packages/todo/tool-todo/src/index.ts:135-136` 注册 `todo_write`（`ctx.tools.register(defineTool({`）；`:194-197` 无 owning session 抛**裸 Error**；`:26` 状态枚举 `['pending','in_progress','completed']`；`:23` `inject=['tools','sessionProjections']`；`:120-133` `todos` projection fold（`todo/write`→list、`turn/start`→null、last-write-wins）；`:79-101` `toTodoList` 值法（trim 非空/去重/单活多 active 拒——均裸 Error）。
- 入参（`:137-157`，编译形见 fixture T2）：根=**implicit open object**（无根级 `additionalProperties`），`todos` required array；items `additionalProperties:false`（:145，唯一封闭层）；项 `content`/`status` required、`status` 枚举封闭。出参：`todos[]` + `counts{pending,inProgress,completed}`。
- Config（`:37`/`:42`）：`allowParallelInProgress` `z.boolean().required()`，**必填无默认**；`Config({})` → `ValidationError: $.allowParallelInProgress missing required value`；非布尔 → `expected boolean`。
- `docs/tool-catalog.md:44`（ctx.tools + owning Agent session；必填无默认口径原文）；`packages/bundle/base/cordis.patch.yml:430-433` 装载 + `allowParallelInProgress: true`@:433；`packages/bundle/web-app/cordis.patch.yml:552-553` host 面关；`packages/bundle/web-app/presets/standard.patch.yml:133-136` preset 重挂（true@:136）；`scripts/gen-tool-catalog.ts:622-631` 目录审计条目。

plane/中心（HEAD 现文，行漂已录：矩阵 :405=基线 9b2 位，HEAD= :410）：
- `packages/runtime/src/plugin/live/team-tool-plane.mjs:410` `'todo_write'` ∈ `PLANE_RESERVED_NATIVE`；`:402` `PLANE_RESERVED_NATIVE_HOST_PIN='0.2.0-rc.2@639ed01539'`；`PLANE_SUPPORTED_NATIVE_TAKEOVERS`（:465-480）**无 todo 行**=无 takeover；`:492-494` 冒用同名 → `PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED`。
- `agent-bindings.mjs`/`pa-mount-registry.mjs` 对 `todo` **零命中** ⇒ 无专列继承接线；治理=继承原生面。
- dispatch lane 真实在册法：`tool-dispatch/closed-world-guard.ts`（`GUARD_DENIAL_REASONS`/`guardDecision`：IDENTITY_ABSENT/IDENTITY_FOREIGN/UNGOVERNED/NATIVE_SHADOWED/DEFINITION_DRIFT/NOT_ACTIVE）、`tool-dispatch/install.ts:116` `definitionIdentityOf`（WeakMap 实例身份）。
- effects 闭集词：`packages/domain/tool-governance/src/effects.ts:43`（EFFECT_KINDS）、`:57-62`（ToolInvokeEffect `resource:null`）。

## 2. 缺项清单（⑦素材；不豁免；P 落地波后逐条注记）

1. **继承面无 P 前置接管**：生产装配（注册/placement/mask/takeover 账）未接线——arm 已落 src，`todoEnabled` 消费在 CENTER 共享面（提案=本目录 `p-takeover-proposal.md`）。【生产路径未证明；arm+lane 已证（T15-T18）】
2. 宿主 `:194-197` 无 owning session = **裸 Error 无 typed code**。【GOVERNED 路径已由 arm typed 替代（T11 翻转证明）；HOST 面原状保留钉死（宿主零字节）】
3. **未知顶层键（open root，`src/index.ts:138-157`）原生面无 typed 拒且写入照常发生（键不消费进列表）**。【GOVERNED 路径已翻：`P_TODO_CLASSIFY_UNKNOWN_PARAMETER`+零 append（T10 翻转证明）；HOST 面原状保留钉死】
4. 运行时值法三则（空 content/重复 content/单活多 active）=裸 Error 无 code。【分层不变（T13/T14）：classify 纯 parse 不造平行法（§1.1），dup/单活留原生；blank 为 shape 律 classify 同拒】
5. `allowParallelInProgress` 必填无默认 = config 层 `ValidationError`（design-intent，在册非缺陷；T9；arm 装配面同律镜像：非布尔=构造即拒）。
6. goal 家族 durable append/arm/disarm **不属本单**（B-SESSION goal 臂归 goal owner）。

## 3. 实跑记录（首次失败原文保留）

fixture = `packages/runtime/test/a5-m2-todo-write-c1.test.ts`（现 18 titled legs T1-T18；P 落地波前为 14；本机无 Host 参与）。

- 首个套件运行（06-54:18Z，**3 红**——均 fixture 自身缺陷，非宿主行为；该输出当轮直录本目录上报，逐字关键行）：
  - `T1 … AssertionError: expected 'def#2' to be 'def#1' // Object.is equality`（我对 identity 定律外推错：WeakMap 实例身份非名字恒定）
  - `T2 … AssertionError: expected 'object' to be 'array' // Object.is equality`（defineTool 编译根=implicit object）
  - `T14 … AssertionError: promise resolved "{ todos: [ { …(2) }, { …(2) } ], …(1) }" instead of rejecting`（单活断言误用 allowParallel=true 挂载）
  - 汇总原文：`Test Files 1 failed (1) / Tests 3 failed | 11 passed (14) / RC=1`。
  - **留痕缺陷（如实）**：为落盘重跑时误用 `$(ls|tail -1)` 复用同一目录 `runs/2026-10-23T06-54-25Z/` 且以 `>` 重定向，该 run.log 先存 3 红全文、后被一次失败工具调用（vitest 4.1.11 无 `--json` 选项，`CACError: Unknown option --json` 原文现存该文件）覆写——3 红全文以上述逐字行为准，覆写不再回溯。
  - 更早的 `fileURLToPath is not defined`（ReferenceError，导入漏项）为该轮首个真实失败，原文当轮已报。
- 终跑 `runs/2026-10-23T06-57-31Z/`：`run.log`（verbose，**14 passed，RC=0**）+ `vitest.json`（titled legs 机读正本）+ `typecheck-runtime.log`（`pnpm --filter @dsh-agent-team/runtime run typecheck`，**RC=2**——**我的文件零错误**；剩余 5 红全部来自他人文件 `test/a5m2-readimg-c1.test.ts`（TS2769/TS2349/TS4113×3），非我产、我不碰，只报不改）。
- 类型修复轮（共享面义务，CENTER 令）：`mount()` 显式注册契约断言替代索引可能空、T2 显式嵌套形、T8 二分支 `then` 收窄、T12 索引改 map——全部我文件内修，无 `!`/`as any`。
- **P 落地波终跑 `runs/2026-10-23T07-14-09Z/`**：`run.log`（verbose，**18 titled legs passed，RC=0**）+ `vitest.json`（机读正本）+ `typecheck-runtime.log`（**RC=0——整包干净**，此前他人文件 `a5m2-readimg-c1.test.ts` 的 5 红已由其 owner 自修，非我动）+ eslint 两文件 RC=0。**本波首次运行即绿——无当轮新红（如实记录，前波 3 红不因此删除）。**

## 4. 矩阵 `todo_write (M-14)` 草案（交 CENTER 落笔，V@B=no）

- **⑥**：fixture 级实测 @工作区（tested 面=`7a3540937`+未提交工作区文件，untracked 披露；C1 口径=BASE.C1 之 fixture 层，**不含段1/段3 运行证明**）；证据=`packages/runtime/test/a5-m2-todo-write-c1.test.ts` + `dev/agent-workflow/evidence/alpha5/m2-todo/runs/2026-10-23T06-57-31Z/`；适用性=宿主面 dep-diff（pin639 树内 `todo_write` 依赖路径 `.git/HEAD`==pin 恒等=0/3 源锚复验）+ 仓内装配（plane/guard/dispatch 三件 baseline→HEAD=3/3 漂移，**测对在 HEAD 非 9b2**，V@B=no 如实）。
- **⑦**：本 README §2 全六条（含 open-root 精确措辞、`:194-197` 裸 Error 分层缺陷、`allowParallelInProgress` 必填在册）。
- **⑧**：`NOT_IMPLEMENTED/NOT_WIRED`（复合值，依 CENTER 更正：矩阵第 11 行复合合法；我先稿 `NOT_WIRED` 单值错在 P-src 未落时用了"有实现未接线"定义域）——**NOT_IMPLEMENTED 半格已升**：P arm 真落 src（`governed-families/todo.mjs`，T10/T11 翻转型落地证明 + T15-T18 lane 生产路径腿 = 18/18 绿）；**NOT_WIRED 半格未升**：takeover 账增行/`todoEnabled` 消费/placement+mask  glue 在 CENTER 共享面未合；**下一格**=CENTER 落 `p-takeover-proposal.md`（含 §4 place-dist glue）→ C2a 排 Host（`77a11fa5`）→ C2b 随装配可达。非终点。

## 5. P 落地波（根令"owner 不得因登记停等"当轮，2026-10-23）

- **新落 src（我独占新建）**：`packages/runtime/src/plugin/live/governed-families/todo.mjs` = `createGovernedTodoArm`：classify（闭集 op `replace-list`；effects 仅 `{kind:'tool-invoke',toolName:'todo_write',resource:null}`，`@` 半格=bind-time `definitionIdentity`；manifest 严格字段；unknown 顶层键/item 键/shape/枚举/空白/跨与缺 session=typed 拒）；prepare（一次性 ticket——Ask pending/deny 无 ticket ⇒ 体不可达=零 append 的构造性证明）；execute（owner/incarnation 预检 typed→CURRENT-vs-target 混淆拒→**先 claim 后 body** 单飞→绑定期捕获的原生 definition，无按名重找、无 native fallback）；cancel（诚实 race 报告：BEFORE/AFTER-ADMISSION=零 append、ALREADY-COMMITTED 不重写）；drain（全阶 typed 拒）。宿主零字节、零新 I/O 面、零平行值法、**未 import `domain/tool-governance`**（audit 消费者清单无新增）。
- **fixture 改写**：删测试内 P 参考实现（法归一处）；T10/T11 按原注释**翻为 typed 拒（落地证明）**且 HOST 面原状各自保留钉死；T12/T13 改吃真模块；新增 T15（正控恰一 append+真 fold 读回+backend 日志五连同一 correlation）/T16（Ask pending/deny 零 append+假 ticket NOT_ADMITTED）/T17（C3 三点取消 race 报告）/T18（单飞 re-fire ALREADY_CONSUMED+DRAINING 无 fallback）。
- **集成批次影响清单（CENTER booking/基线用）**：新 scannable 文件 `packages/runtime/src/plugin/live/governed-families/todo.mjs`（续 booking；测试文件已在 `SCANNED_PATHS_A5M2`）；`lint-identities` 语料 +新身份（todo.mjs 导出面），基线登记归批次；`check-artifacts` 需重建 dist 镜像（新 src .mjs）；census = 文件 558→**560**（+test 已录 559，+src 再 +1）、legs 7010→**+18**（**前报 +14 作废**）、9 titled reds 容差集与 `.ids.txt` 不动。

## 6. C2 生产可达路径（Host 腿，排队；由 CENTER 排唯一 Host owner `77a11fa5` 串行）

- **世界**：`tests/homes/m2-todo-<UTC stamp>`（TEST_METHODS §7 临时世界，gitignored，工作区内）。
- **Host**：pin639 构建产物入口 `tests/deepseek-harness-test-use/apps/cli/lib/bin.js web --port <3180 族>`，DSH_HOME=上世界；a5 分支插件 bundle 经 profile 挂载。
- **生产入口**：`packages/runtime/root-binding/harness/run.mjs`（真实 root 创建 → 成员创建；harness 明示 "the persona is a preset mount"，成员 preset 经 persona slot 装配——生产可达，非桩面）。
- **preset 声明**：成员 persona 引用 standard preset ⇒ `tool-todo` 真挂（`web-app/presets/standard.patch.yml:133-136`，`allowParallelInProgress:true`@:136）⇒ 成员继承面持 `todo_write`。
- **capabilities 组合**：
  - 正控腿：`mode:'selective'` + `builtinToolDeny:[]`（todo 不 deny）⇒ 继承面有名，调用成功；
  - 拒控腿：`builtinToolDeny:['todo_write']` ⇒ 继承面被 mask（`agent-bindings.mjs:2480/:2527` restrict+mask 装配序在册），名不在面/调用拒，**零 append**。
- **观察 `todo/write` 事件面（三处，业务结果非 Guard 绿灯）**：① durable：成员 session 事件日志中 `todo/write` 行（事件名钉死 host `index.ts:199`；日志文件形 `session.v4*.jsonl*`，运行世界内直读）；② live：`sessionProjections` key=`todos`（UI 清单面，fold=last-write-wins，index.ts:120-133）；③ `tool/result` 的 `counts` 与回读列表一致（trim 规范化）。
- **腿序（无环境阻塞，全部依赖序，非 ENV_BLOCK）**：
  - **C2a（现形态即可跑）**：注册入口→原生 body→三观察面正控 + deny 拒控零 append + 取消边界（等待/前置/提交前三点；todo 无持久 lease=持久部分 N/A 注记，取消提交边界与并发读隔离照测；冷重启 session 日志回放不重跑旧批准）。
  - **C2b（待 P 前置接管落地）**：A 批准/Ask pending/deny 三路的零写与恰一次断言（`Ask pending 时 Prepare/body/业务写入=0`）——依赖 CENTER 落 `p-takeover-proposal.md` 三件 + `todoEnabled` 装配，属**依赖序阻塞**（写明：P-src 未落前此腿不可跑，非环境缺口）。
- 跨 session/revision 冲突拒腿随 C2b 加 typed 码断言。
