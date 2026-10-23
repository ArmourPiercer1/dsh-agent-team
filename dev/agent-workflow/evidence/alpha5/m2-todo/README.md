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

## 2. 缺项清单（⑦素材；不豁免）

1. **继承面无 P 前置接管**：无 A 前置、无 owner/revision/incarnation 预检——生产路径未证明（本单主缺；`p-takeover-proposal.md` 交 CENTER）。
2. 宿主 `:194-197` 无 owning session = **裸 Error 无 typed code**（宿主零字节，P 层补 typed 拒；fixture T11 钉现状）。
3. **未知顶层键未被拒绝（无 typed 拒）且写入照常发生（该键不被消费进列表）**——根无 `additionalProperties:false`（`src/index.ts:138-157`，仅 `items` 层 :145 封闭）；CENTER 静态复验成立、措辞已照令收紧（fixture T10 回归网，P classify 落地即翻 typed）。
4. 运行时值法三则（空 content/重复 content/单活多 active）=裸 Error 无 code（T14 分层钉）。
5. `allowParallelInProgress` 必填无默认 = config 层 `ValidationError`（design-intent，在册非缺陷；T9）。
6. goal 家族 durable append/arm/disarm **不属本单**（B-SESSION goal 臂归 goal owner）。

## 3. 实跑记录（首次失败原文保留）

fixture = `packages/runtime/test/a5-m2-todo-write-c1.test.ts`（14 titled legs T1-T14；本机无 Host 参与）。

- 首个套件运行（06-54:18Z，**3 红**——均 fixture 自身缺陷，非宿主行为；该输出当轮直录本目录上报，逐字关键行）：
  - `T1 … AssertionError: expected 'def#2' to be 'def#1' // Object.is equality`（我对 identity 定律外推错：WeakMap 实例身份非名字恒定）
  - `T2 … AssertionError: expected 'object' to be 'array' // Object.is equality`（defineTool 编译根=implicit object）
  - `T14 … AssertionError: promise resolved "{ todos: [ { …(2) }, { …(2) } ], …(1) }" instead of rejecting`（单活断言误用 allowParallel=true 挂载）
  - 汇总原文：`Test Files 1 failed (1) / Tests 3 failed | 11 passed (14) / RC=1`。
  - **留痕缺陷（如实）**：为落盘重跑时误用 `$(ls|tail -1)` 复用同一目录 `runs/2026-10-23T06-54-25Z/` 且以 `>` 重定向，该 run.log 先存 3 红全文、后被一次失败工具调用（vitest 4.1.11 无 `--json` 选项，`CACError: Unknown option --json` 原文现存该文件）覆写——3 红全文以上述逐字行为准，覆写不再回溯。
  - 更早的 `fileURLToPath is not defined`（ReferenceError，导入漏项）为该轮首个真实失败，原文当轮已报。
- 终跑 `runs/2026-10-23T06-57-31Z/`：`run.log`（verbose，**14 passed，RC=0**）+ `vitest.json`（titled legs 机读正本）+ `typecheck-runtime.log`（`pnpm --filter @dsh-agent-team/runtime run typecheck`，**RC=2**——**我的文件零错误**；剩余 5 红全部来自他人文件 `test/a5m2-readimg-c1.test.ts`（TS2769/TS2349/TS4113×3），非我产、我不碰，只报不改）。
- 类型修复轮（共享面义务，CENTER 令）：`mount()` 显式注册契约断言替代索引可能空、T2 显式嵌套形、T8 二分支 `then` 收窄、T12 索引改 map——全部我文件内修，无 `!`/`as any`。

## 4. 矩阵 `todo_write (M-14)` 草案（交 CENTER 落笔，V@B=no）

- **⑥**：fixture 级实测 @工作区（tested 面=`7a3540937`+未提交工作区文件，untracked 披露；C1 口径=BASE.C1 之 fixture 层，**不含段1/段3 运行证明**）；证据=`packages/runtime/test/a5-m2-todo-write-c1.test.ts` + `dev/agent-workflow/evidence/alpha5/m2-todo/runs/2026-10-23T06-57-31Z/`；适用性=宿主面 dep-diff（pin639 树内 `todo_write` 依赖路径 `.git/HEAD`==pin 恒等=0/3 源锚复验）+ 仓内装配（plane/guard/dispatch 三件 baseline→HEAD=3/3 漂移，**测对在 HEAD 非 9b2**，V@B=no 如实）。
- **⑦**：本 README §2 全六条（含 open-root 精确措辞、`:194-197` 裸 Error 分层缺陷、`allowParallelInProgress` 必填在册）。
- **⑧**：`NOT_WIRED` —— 已闭合格=C1 fixture 全 14 绿（真实 definition/provider 绑定/classify 闭集词 effects+manifest/同名伪造/跨与缺身份 typed 拒/未知名无 abstain/DRAINING 拒/正控写读回一致）；**未闭合项**=P 前置接管 src 未落（提案已交 CENTER）、takeover 账增行未合、段1/段3 与 C2/C3 全套=Host 腿未跑（唯一 Host owner `77a11fa5` 串行，CENTER 下 GO）；**下一格**=CENTER 落 p-takeover-proposal 三件 → T10/T11 翻 typed（落地证明）→ C2 排队。NOT_WIRED 非终点。

## 5. C2 生产可达路径（Host 腿，排队；由 CENTER 排唯一 Host owner `77a11fa5` 串行）

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
