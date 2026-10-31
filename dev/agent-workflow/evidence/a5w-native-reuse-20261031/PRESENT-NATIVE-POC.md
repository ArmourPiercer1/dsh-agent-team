# PRESENT-NATIVE-POC — Native Reuse First 下原生 present 保留路线 PoC（a5w-pvpoc）

- **Lane**: `a5w-pvpoc`（工作流 A 产品原型席；**零真实 Host boot**：静态源码检查 + 真实 ToolRuntime 进程内实验 + 公开 API + 可复现夹具）
- **分支**: `task/a5w-pvpoc-20261031` @ `origin/master f995ce7814`；worktree `.worktrees/a5w-pvpoc`
- **真实 UTC 落笔**: 2026-10-31T04:41Z（起手 `date -u`）→ 本文 ≈ 2026-10-31T04:54Z（R-CLOCK-1）
- **宿主对象**: `tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84`（0.2.0-rc.2 pin，**只读**；实验前后 `git status --porcelain` = 0 行、`rev-parse HEAD` = 基线，实测见 `green-console.log` 同场运行）
- **红线遵守**: 零 boot、零端口（3180 族未租用）、:3080 未触碰、真实 `~/.dsh` 未触碰、生产中心码零改动、upstream 零写入。写面 = 本 evidence 目录 + `tests/world-factory/poc/`（PoC 原型测试，**不入生产判据**）。
- **复现**: `node --test tests/world-factory/poc/poc-native-present.test.mjs` → 38/38（`green-console.log`，captured 2026-10-31T04:54Z，exit 0，fixture scratch 全部建于工作区 `.artifacts/tmp/` 且 teardown 清零；`/tmp` 无残留）。harness 直接以绝对路径加载宿主 **built lib/**（artifact plane，与运行期插件加载面一致），按宿主自身 `present.spec.ts` 的手工 ctx 形制构造真实 `ToolRuntime`/`Session`/turnBoundary 投影/`LocalFileSystem`；**所有工具调用一律经 `ctx.tools.execute()` 走流水线，全程未直接调用任何保存的 `ToolDefinition.execute()`**（禁令遵守；E1.3/E6.4 实测证明该禁令是 load-bearing 的）。

---

## 0. 一句话结论

**P-P1（原生 Definition 保留）= 条件可达，但按派工严格条款判 FAIL-on-clause（in-flight 身份约束无公开面可保证 + body 出身无公开面可证明），缓解后残余缺口有界且从未触及内容字节；P-P2 七项 = 5 PASS + 2 FAIL-with-documented-envelope（#2/#3 的身份等价维度）；P-P4 进程内正向臂 PASS，真实产品验收 UNKNOWN ⇒ present L4 维持 DISCLOSED，决策表任何格不得判 GO。**

---

## 1. P-P1 原生 Definition 保留路线 —— 可达性与特别验证（全部实测）

### 1.1 保留形态的机制事实（宿主公开面）

| 公开面 | 实测事实（E 编号 = poc-native-present.test.mjs 用例） |
| --- | --- |
| 注册 | `ctx.tools.register()` 经调用方 ctx 分层：global ctx → 全局层；`agent.ctx`/preset-scope ctx → 该层（E1.2/E1.3/E1.4/E1.7） |
| 解析 | `ctx.tools.get(name, agent)` 沿 scope chain 解析 = **派发真相**（dispatch 时 `dispatchToolBody` 再解析一次，E6.4 实测）；`schemas(scope)` 同款可见性 |
| 前置治理 | `tools/pre-execute` waterfall：deny/ask/cancel/allow；`tools/guard()` 单调、deny-only、跑在**所有** pre-execute 监听器之后、dispatch 之前（E6.4a 实测排序） |
| 后置治理 | `tools/post-execute`：accept（可换 value）/block（转 isError + feedback，模型可见）；block 后 `tools/result` 只见最终失败结果（E5.1/E5.2） |
| 发布链 | 原生 present 在 `tools/result` 上对**成功**结果 `session.append('deliverables/presented',{turn,callId,files})`；turn 来自 turnBoundary 投影（open turn），session = `exec.agent.session`（E0.1/E7.1/E9.1） |
| 取消 | `ABORTED_BEFORE_DISPATCH`（体不跑）与 `ABORTED`（体跑完仍被替换为失败）两级语义；post-execute 中 abort 亦被替换（E6.1/E6.2） |

治理层需要的钩子全部存在且可组合：身份校验（pre-execute + guard 内 `ctx.tools.get(exec.name, exec.agent)`）、效果集推导（`exec.arguments.files` 逐路径 realpath/stat/anchor 校验，E3.2/E9.1 实测生效）、PA/Control（`ask` → `ctx.get('approval')` 服务面，可注入 Team Control 桥；无服务时 fail-closed deny，E2.3/E2.4）、单调 Guard（E2.2）、post-execute 复核（E5/E9.2）、发布后合法观察（`tools/result` 单次、冻结 exec，E6.3/E9.1 callId 交叉核对）。

### 1.2 特别验证 A —— 「工具名叫 present ≠ 原生可信证明」：**证实，且比命题更强**

1. 同名 shadow 合法且静默：agent 层（E1.3）、preset 祖先层（E1.4）各注册一个 `present` decoy，均合法、全局视图不可见、dispatch 直接命中 decoy；原生 `tools/result` 监听器用 WeakMap 只认自家 execute 的 exec，decoy 成功执行**零发布**（E1.3/E7.2）。
2. **注册不携带出身**：`ToolDefinition` 无任何 registrant/provenance 字段（E10.2 对 built d.ts 静态验证）；公开方法面无任何 scope 完备枚举（E1.1：`layers`/`view`/`guardReason`/`callerCancelled` 全部 TS-private，d.ts 非公开成员）。
3. **fingerprint 有天花板**：pinned build 下 schema 字段 + 函数源文本可复现且可区分 decoy（E1.5），但 built `execute` 是 defineTool 的**通用参数校验包装**（`validate(args)…userExecute(args,exec)`，实测 toString 全文 171 字符），native body 闭包不可达 ⇒ 公开面可达的最强指纹 = schema 逐字 + 通用包装文本，**不能证明 body 等价**。可信残余 = 包 pin（pnpm integrity）+ 组合（profile/preset patch 声明 `@deepseek-ai/dsh-tool-present` 于 preset 层）+ 全局层先到先得单占位（E1.2）。
4. 身份校验的可用形：**每调用、按 member 的 scope 解析**并与「本 Team 授权的注册」比对（对象同一性仅在单次实例化内有效）；`tools/change` 作 epoch 信号（E1.6）。

### 1.3 特别验证 B —— 「全局工具枚举 ≠ 所有 Preset Scope 注册完整来源」：**证实**

 shipped 组合把 `@deepseek-ai/dsh-tool-present` 挂在 **preset 层**（`packages/bundle/web-app/presets/{standard,ptc,cordis}.patch.yml` `- id: present`），bundle 内 grep 无任何 global 层挂载；每个 preset 各实例化一份（独立 definition 对象、独立 WeakMap、独立 result 监听器）。E1.7 进程内复刻双 preset：两份 definition **对象不同一、指纹相同**、发布各归各层会话、另一 preset 的观察器零感知。⇒ 治理**必须** per-agent scope per-call 解析（E1.4 证明只查全局视图的校验可在 agent 实际派发 preset decoy 时通过——经典绕过面）。

### 1.4 残余缺口（公开面不可消除，实测证明）

| # | 缺口 | 实测 | 效果面（envelope） |
| --- | --- | --- | --- |
| G1 | **in-flight 身份锚定缺失**：pre-execute/guard 校验通过后、native body 之前，路径可被换指向**另一个常规文件**；body 校验的是路径（lstat/resolve/stat，可挡 symlink/dir/missing），不是 Team 授权过的 inode | E4.2（rename 换位成功发布） | 发布事件引用的对象 ≠ 授权对象；**内容零读取**（全部 38 例 `fs.readBytes` 计数 = 0，body 只 stat metadata，E0.2/E3.2/E4.x/E9.1）。缓解 = post-execute ino 复核可 block 漂移发布（E9.2 PASS），残余 = 「post 复核前恢复原 inode」的窄窗口 |
| G2 | **body 出身证明缺失**：见 1.2(3)——schema 逐字相同的 decoy 可携带任意 body 而公开面不可区分 | E10.2 + execute.toString 包装实测 | 身份校验降级为「组合完整性 + 包 pin 信任」 |
| G3 | **guard→dispatch 微任务窗口**：最后一个 guard 之后、`dispatchToolBody` 再解析之前换定义，decoy body 会执行 | E6.4(b)（decoy 跑了但**零发布**，原生监听器忽略非自家 exec） | 恶意 body 副作用仍可能；发布面安全，效果面不保证 |
| G4 | **无 callId 去重**：同 callId/同 args 二次 dispatch = 二次发布 | E6.5 | 单次消费纪律是 **Team 侧义务**（PA 消费账本先行，E6.5 缓解腿 PASS） |

### 1.5 P-P1 裁决

- 按派工第 4 项括注原文「**若执行前/中文件约束无法保证 P-P1 判 FAIL**」：**执行前 = 可保证**（deny 全通道实测体零执行，E2.*）；**执行中（in-flight）身份约束 = 无法保证**（G1，无公开 seam）⇒ **严格条款下 P-P1 = FAIL（G1+G2 为不可消除公开面缺口）**。
- 按「文件读取」字面语义（缺口 envelope 实测为 metadata/发布引用一致性，**内容读取从未发生**）：可辩护为 **CONDITIONAL-GO with mandatory disclosure**（G1–G4 全部带入产品验收判据）。
- 两读法均不改变决策表结论：产品验收列 UNKNOWN ⇒ **非 GO**（§4）。
- **未触「必须改中心码 → 停手」线**：治理目标本身经公开 composition path 可达（E9.1 全链实测）；G1/G2 的「与受控实现身份强度等价」维度确实需要中心面（in-flight 身份 seam / 注册出身 attestation），本文件 §5 即按接口缺口报告口径记录，**不新立 CORE_SEAM_BLOCKER**（判据「证明无既有 public composition path」不达——路径存在，只是强度有界）。

---

## 2. P-P2 执行阶段安全性七项（进程内实测逐项裁决）

| # | 判据 | 裁决 | 证据 |
| --- | --- | --- | --- |
| 1 | 拒批/权限不足时原生 Body 不运行 | **PASS** | E2.1–E2.4：pre-execute deny、guard deny、ask→rejected、ask→无审批服务（fail-closed）四通道均 `lstat/resolve/stat/readBytes = 0` 且零事件；E2.5 grant 腿通（ask→allowed-once 可桥 Team Control） |
| 2 | Team 文件权限 + 原生 FS 校验组合不宽于现行受控实现 | **FAIL（身份等价维度）/ PASS（scope 轴，且严格窄于裸原生）** | E3.1 裸原生无授权子树（外部绝对路径直发，宿主 spec 本意）；E3.2 组合拒外部绝对路径/symlink/中间 symlink 目录/hardlink(nlink≠1) 且被拒调用 native fs 零触碰；受控实现（present-executor 锚定 fd + post-consume 复核 + 单 fd 身份）的**身份锚定强度组合不可复制**（G1）⇒ 等价判据 FAIL |
| 3 | pre-execute 与 Body 间路径/身份漂移不造成未授权读取 | **内容读取轴 PASS；对象身份轴 FAIL** | E4.1 漂移成 symlink → body 自拒、零发布、零字节；E4.2 漂移成另一常规文件 → body 成功、事件引用未授权 inode（漂移发布）；readBytes 全程 0（原生 body 定义上只 stat metadata）；缓解腿 E9.2 post 复核 block |
| 4 | 原生 Body 成功但 Team 后置复核拒绝时不错误发布成功事件 | **PASS** | E5.1 block → isError + 零事件；E5.2 `tools/result` 观察者只见最终失败（无假成功可被归属证明误采）；E5.3 post 换 value 不能夹带文件进 durable 事件（事件绑 body 捕获的 files）；不可逆披露：block 撤不回 body 已执行的 fs 校验（envelope = metadata，零内容读） |
| 5 | 取消/Definition 替换/权限撤销/冷恢复不重复发布 | **PASS（进程内全腿）；真实冷恢复腿 UNPROVEN（boot 域，零 boot 边界）** | E6.1 dispatch 前取消（ABORTED_BEFORE_DISPATCH，体零执行）；E6.2 post 阶段取消（成功后仍替换 ABORTED）；E6.3 每 dispatch 恰一次 result；E6.4b 定义替换 decoy 执行但**零发布**；E6.6 会话重读零重发布；E6.5 原生无 callId 去重 ⇒ Team 消费账本义务 + 缓解腿 |
| 6 | A-Session 产物不误归 B-Session | **PASS** | E7.1 事件仅落 A session（turn/callId/files 绑 exec.agent.session）；E7.2 B 层 decoy 任何路径零发布 + 身份校验 deny 使其不派发；E1.7 双 preset 实例发布各归各层 |
| 7 | PTC 内层、同名 Scope Shadow、非 Team 原生会话符合既有保证 | **PASS** | E8.1 ptc 模式 model-direct 在**策略管线之前** collapse 为 UNKNOWN_TOOL（治理零消耗、监听器不可见）；E8.2/E8.3 PTC 子派发（parent token）完整过治理且 Team deny 体零执行；E8.4 无 Team 层时宿主 baseline（正/负）保持 |

**计数：5 PASS（#1/#4/#5/#6/#7）+ 2 FAIL-on-equivalence（#2/#3，均附通过轴与缓解腿）。能证已证；UNPROVEN 仅一条子腿（真实冷恢复，属 boot 域）。**

---

## 3. P-P3 备选（非主路，未实作）

P-P1 有可执行通道，备选不升级为主路；若用户拒收 §1.4 披露缺口：
- **窄 Host Service Adapter**：无 `deliverables/publish` 公开服务可接（a5w-present-wire §5(A)：`api-catalog.ts` 91 键零命中），adapter 腿生产世界恒 fail-closed = 不可行，除非 R-N2 上游落地。
- **ctx.isolate/公开服务重装**：重装目标面（publish）不存在 ⇒ 与 R-N2 同阻塞；isolate 不改变发布语义。
- **最小 tool-present Fork**：技术上唯一可携带 G1 修复（自持 fd 锚定）的下下策；禁（派工令禁止整抄子系统，且 Fork 的等价证明/许可证/升级跟踪成本 + 双实现漂移风险 > 披露缺口本身）。
- **接口缺口报告（若用户要求中心补强才可达的项）**：(i) 注册出身 attestation（loader 记录 registrant 并公开可查）；(ii) in-flight 身份 seam（dispatch 时把已解析 definition/或调用方锚定物交回调用方校验，或 defineTool 暴露 post-resolution hook）；(iii) `deliverables.publish` 公开服务（= O2-B N2 原提案）。三项均为上游公开接口流程，非本仓可交付。

---

## 4. P-P4 验收目标与 §10 路线决策表

**进程内正向臂 PASS**（E9.1）：Team 授权（成员校验 + 定义身份 + 子树/anchor 效果集推导 + PA ask→allowed-once）→ 原生 body 执行 → **恰一次** durable 发布（session/turn/callId/files 正确，独立观察者 callId 交叉核对一致）；未授权成员、集合外文件、漂移、取消、重放各腿零不当发布。**真实产品验收（真 Team world、持久化、GUI 消费端复用既有 open/呈现能力、冷恢复）未做且本席零 boot 不可做 ⇒ UNKNOWN。**

UI 消费端未修改可复用其既有功能保障（presented.ts `/api/present.open|host` 读 durable 行）——但该保障**不得也不能替代** Team 发布链正向验证；本 PoC 的正臂是 ToolRuntime/Session 层的，不声称 GUI 层。

### 路线决策表（四列 × 逐路线；UNKNOWN/MOCK-PASS 不得判 GO）

| 路线 | 接口存在？ | 安全可接入？ | 等价实现？ | 产品验收通过？ | 决策 |
| --- | --- | --- | --- | --- | --- |
| **R-N1 原生 Definition 保留 + 管线治理（本 PoC 主体）** | **YES（实测）**：pre/guard/post/result + ask + scoped get 公开可用且被 shipped 词汇消费 | **CONDITIONAL（实测）**：#1/#4/#5/#6/#7 PASS；#2/#3 身份轴 FAIL（G1/G2/G3/G4 披露为接入条款） | **NO**：身份锚定强度 ≠ 受控实现；body 出身不可证（G2） | **UNKNOWN**：零 boot，真世界/持久化/GUI 消费未验 | **非 GO**；下一步 = 带 G1–G4 披露进真实 Team-world boot 级 P-P4 正臂（boot 波），不新立开发 |
| R-N2 宿主公开 `deliverables.publish`（O2-B N2） | **NO（实测：api-catalog 零命中）** | UNKNOWN | UNKNOWN | UNKNOWN | 非 GO；上游跨仓流程存续 |
| R-N3 受信 glue 仿写（Center Interface PR） | PARTIAL（注入 seam 形状已有；仿写语义未裁） | UNKNOWN | UNKNOWN（仿写 = 非原生事件亲笔） | UNKNOWN | 非 GO；owner 裁决位 + 具名 PR 门未动 |
| R-P3a isolate/公开服务重装 | NO（目标面不存在） | — | — | — | 不可行 |
| R-P3b 窄 Host Service Adapter | NO（无服务可接，恒 fail-closed） | — | — | — | 不可行（R-N2 前置） |
| R-P3c 最小 tool-present Fork | YES（自抄） | UNKNOWN（等价/许可证/升级跟踪未证） | UNPROVEN | UNKNOWN | 非 GO；派工令禁整抄，最后手段 |

**推荐格**：R-N1 = 全表唯一「接口存在=YES + 安全可接入有实测」的路线，但「等价实现=NO、产品验收=UNKNOWN」⇒ **Native Reuse First 裁决下的推荐行动 = 以 R-N1 携 G1–G4 强制披露进入 boot 级正向验收；任何 GO（含 present L4 转正）在 boot 级 P-P4 正臂完成前禁止。** present L4 维持 DISCLOSED（`u7-tool-acceptance.json` 理由行可增指本包）。

---

## 5. 复现与产物清单

- `tests/world-factory/poc/host-present-harness.mjs` — 进程内宿主世界 harness（built lib 绝对路径装载 + 基线 fail-closed 校验 + 脚本化 approval stub）。
- `tests/world-factory/poc/poc-native-present.test.mjs` — E0–E10 共 38 例；文件头标注 **PoC ONLY，不入生产判据**。
- `green-console.log` — 38/38 完整 console（captured 2026-10-31T04:54Z 真实 UTC，node v24.21.0）。
- 关键常量：native present pinned 指纹（schema+包装文本 sha256）`92e4fabe3f2bfb53eec71bf5b5d55c19e24f0a00748dc7cff430e101cd340805`（**仅覆盖 schema+参数校验包装，不覆盖 body**——见 G2）。
- 宿主树复核：实验后 porcelain = 0、HEAD = 基线（本文 §0）；未租端口、未建 DSH_HOME（`.artifacts/tmp/` 仅为 fs fixture，teardown 清零）。
