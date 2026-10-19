# TOOLS.md — A 路：原生工具治理与真实安装正负验收（Alpha.5）

基线：产品冻结 SHA `d5de74974b0320b191b310ead82407d478477ed7`（分支 a5-tools-gov 基点）；
宿主 = `tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84`（0.2.0-rc.2；d5de7497 `tests/paths.mjs:68-70` 现场钉，主检出 AGENTS.md 旧行 46a7f68b09 为 D 路排队件的实证样本）。
端口族 3187/3495；世界 `tests/homes/a5tools-gov-*`（用毕精确名清理）；:3080 仅 GET 只读探针。
kit = `code/a5tools-gov-kit.mjs`（复用 #337/#343 glob-off 装面法：`plugin --profile web add github:…#<sha>` 真装 + 三零律 + 公开 seam only + mock 仅在 LLM 位）。
方法令（根 07:30Z）：**判"已接线"必须有真实装配执行收据**；禁保留名钉表冒充覆盖。

## 0. 治理面总闭集（现场枚举 @ d5de7497，行数实数）

| 治理类（authority-owner class，6 类） | 成员（行数） | 定义处 |
| --- | --- | --- |
| MANAGED_OPERATION_PERMISSION | **7**：read, read_image, write, edit, lsp（file class 5）+ bash, pwsh（shell class 2） | `packages/domain/blueprint/src/schema.ts:421` PERMISSION_TOOL_NAMES；镜像 `packages/runtime/operation-permission/types.ts`（单一来源防漂移） |
| SAFE_UNMANAGED | **1**：todo_write | `packages/runtime/operation-permission/permission-coverage.ts:130` |
| KNOWN_SENSITIVE_UNMANAGED（exact） | **14**：grep, glob（fsSearch，A2C-6 延期）; subagent, subagent_fork, ralph, workflow（orchestration）; web_fetch, web_search（network）; job_list, job_output, job_kill（jobs）; send_message, interrupt_agent, list_agents（agentControl） | `permission-coverage.ts:146-170` + `job_` 前缀族 `:180` |
| UNKNOWN_UNMANAGED | 其余一切具名（含 str_replace_editor） | 分类默认臂 `:360` |
| TEAM_TOOL（GLUE-5 放置归属） | selectTeamTools 选定名 + a5PlaneOwnNames（装配放置=管理事实） | `agent-bindings.mjs:2745` 前后 |
| OTHER_MANAGED_MCP | MCP reconcile 增量名（pre/post 面差分证明归属） | `agent-bindings.mjs:2664-2691` |

Coverage Gate 仅 STRICT（模板声明 `capabilities.permissions`）agent 生效：KNOWN_SENSITIVE/UNKNOWN 出现在最终面 = setup 响亮失败，typed error `alpha2-permission-coverage-unmanaged-tools`（`errors.ts:337`，detail=确定性排序 unmanagedTools[{name,classification,reason,remediation}]；无 auto-hide、无逃逸阀；remediation 文案=「builtinToolDeny 移除或补受审 authority owner」）。
Pre-execute 管线（strict）：`ctx.on('tools/pre-execute')` → canonicalize（5 file + 2 shell 全分支 `canonical-operation.ts:669-704`）→ 静态 A3 → 动态 permission plane（overlay/hard）→ ask=A4 `awaitControlDecision` 同步等 → allow=`guardOperation` 消费后 `next()`；**一切 non-allow 在 next() 前拒（零效果不变量）**；unsupported 工具名=pass-through（`pre-execute-adapter.ts:12`，strict 面被 gate 前置清空，非 strict 面无监听器）。
挂载链（公开 seam）：`agentPresets.mount(agentCtx, presetId)`（`host.ts:1318` 惰性访问器；缺服务=typed `member/root-base-tools-unavailable` fail-closed）→ builtinToolDeny=`agentCtx.tools.restrict({deny})`（`packages/tools/src/builtin-deny.ts`，P0-2 捕获真 disposer）→ team 工具/skills → MCP reconcile → Coverage Gate → pre-execute 安装（最后一步，随 agent 生命周期 drain）。

## 1. 总矩阵（每工具一节；执行收据见 runs/<stamp>/criteria.json 与 wire-digests）

| 工具 | 治理类 | 车道能力 | 装配收据 | 正验收（真执行） | 负验收 |
| --- | --- | --- | --- | --- | --- |
| write | 受管 file | allow(exact/subtree)/ask/deny | ①链已核（§0） | PENDING wide.P1 / lanes.L1 | PENDING lanes.L3 default-deny 零效果 + ask A3 |
| edit | 受管 file | 同上（projection 含 old/new） | ①链已核 | PENDING wide.P2 | 同上（共享 canonical/lane 面） |
| read | 受管 file | 同上 + artifact-read grant 端口 | ①链已核 | PENDING wide.P3 | PENDING lanes.L2 deny-lane exact 拒+不外泄 |
| read_image | 受管 file | 同 read | ①链已核 | PENDING wide.P4（形状 BOOK） | PENDING lanes.L4（allow 腿）/L3 |
| lsp | 受管 file | 4 操作枚举 | ①链已核（枚举 `canonical-operation.ts:198-203`） | 本 kit 不排（preset 无 tool-lsp）；B 路 LSP 矩阵承接 | — |
| bash | 受管 shell | 成员仅 ask/deny any；leader allow any 双门（envelope exec token bash） | ①链已核 | PENDING wide.P8 | PENDING lanes.L5 成员无道拒+零副作用 |
| pwsh | 受管 shell | 同 bash（POSIX 宿主 disabled；≠bash 权威） | ①链已核（disabled 行实测注记） | N/A（Linux 宿主 preset disabled） | 注记：bash authority≠pwsh authority（types.ts A2C-1） |
| glob | KNOWN_SENSITIVE(fsSearch) | 无（strict 须 deny） | ①链已核 | PENDING wide.P6 | PENDING lanes.L6 关断 absent + unmanaged U1 拒 setup |
| grep | KNOWN_SENSITIVE(fsSearch) | 无 | ①链已核 | PENDING wide.P7 | 同上 |
| str_replace_editor | **UNKNOWN_UNMANAGED（零治理条目）** | 无；opt-in 独立包（与 edit 两注册形） | ①链已核（独立包注册名实核 `tool-str-replace-editor/src/index.ts:430`） | PENDING wide.P5 | PENDING lanes.L6 + **unmanaged U1/U2 响亮 FATAL 实拍** |
| task 系（subagent/subagent_fork/workflow/ralph/job_*/send_message/interrupt_agent/list_agents） | KNOWN_SENSITIVE（orchestration/jobs/agentControl） | 无 | ①链已核（含 §5.2 own-layer subagent 披露） | 本 kit 不跑正验收（C2 已披露面）；负=strict 须 deny（派生 denyList 实测含之，L6 catalog absent 收据覆盖 subagent_fork 等） | PENDING L6/S.surface 派生账 |
| todo_write | SAFE_UNMANAGED | 无（source-reviewed） | ①链已核 | 不在 smoke preset（注记） | — |

## 2. 逐工具节

### 2.1 write（受管 file class）
- 治理面：PERMISSION_TOOL_NAMES 成员；canonical projection=`{tool:'write', resourceKey, contentHash}`（`canonical-operation.ts:683`）→ fingerprint=sha256(canonicalJson)。车道：exact/subtree 资源；default 只允许 ask|deny（blueprint 校验拒 allow）。
- 装配面：preset 挂载（tool-fs 包）→ 非 strict=零监听器直跑；strict=pre-execute 全链（§0）。
- 正验收：PENDING（wide：fs 字节+wire 确认信封「Created file at path」形状；lanes：allow subtree 腿）。
- 负验收：PENDING（lanes：越出 subtree→default deny+文件不存在；ask：human deny 零效果；builtinToolDeny 腿）。
### 2.2 edit — 同 write 形；projection 含 old/new 串（`canonical-operation.ts:688-698`）。PENDING。
### 2.3 read — 同 file 形 + **artifact-read grant 端口**（strict 下合法 grant 免 control 请求，`agent-bindings.mjs` authorizeArtifactRead；port 故障=fail-closed 无 grant）。PENDING。
### 2.4 read_image — file 形；执行形状=host 渲染图像内容部（wire 原样留档）。PENDING。
### 2.5 str_replace_editor — 治理零条目（UNKNOWN_UNMANAGED）：非 strict=普通宿主工具直跑（无治理执行！矩阵单栏披露）；strict=setup 响亮拒（U1 typed 原文留档）；唯一关断腿=builtinToolDeny（U3 正控：denied 后可运行）。opt-in 独立包口径（根令），standard preset 不含（现场核 0 命中）。
### 2.6 read / glob / grep — read 受管；glob/grep=fsSearch 延期类（A2C-6）：strict 面出现即 FATAL，非 strict 自由执行。glob/search 的 team-plane 行先例（#337/#343，`team_glob` 缺省/关断+prod-compat scratch）在 `evidence/alpha5/glob-off-install/`——本路覆盖**原生 builtin 同名件**。PENDING。
### 2.7 bash/pwsh — shell class：成员无正允许道（allow any 在成员模板被 blueprint 校验拒）→成员执行必走 ask/deny；leader allow any 仅当有效 mutation envelope 携对应 exec token（`'bash'`/`'pwsh'` 分token），缺则降级 user-approval ask；bash≠pwsh 权威（指纹含精确工具名）。PENDING（wide 正/lanes 成员负；leader 双门腿=B 路 exec-contract 先例，本路注记引用）。

## 2.8 层3 · I/O 执行边界（根 07:46Z 令；body 链静态实核 @宿主 0.2.0-rc.2 源 + 我方 d5de7497 源）

**统一口径撤回**：07:38Z 的"公开链完整"仅覆盖层1-2（授权+检查），不再使用。

**层3 静态事实（每工具 body 调用链 file:line，宿主源实读）**：
- **write**：`tool-fs/src/write.ts:108 execute()` → `sandbox.resolvePolicy('write')`（会话 fs-sandbox，**非** Team realm）→ `ctx.fs.resolve()`（**第二次独立 resolve**，与治理门各一）→ `ctx.waterfall('fs/write-intent')`（观察政策插件）→ `ctx.fs.writeText()` → `fs-local/src/index.ts:202 writeText()`：`withLock(targetKey)` + probe + `writeFileAtomic(target.targetKey)`——落点=resolve 得出的 **realpath 字符串键**（`fs-local/fsio.ts:154-165` realpath 身份），**路径重命名原子写，非 fd 持有**。
- **edit**：`tool-fs/src/edit.ts:113 execute()` → 同型（resolvePolicy→ctx.fs.resolve→waterfall fs/edit-intent→ctx.fs.editText）→ fs-local editText（版本守卫+原子写）。
- **read**（原生形）：`tool-fs/src/read.ts:137 execute()` → `resolveRegularReadTarget`（一次 stat）→ `ctx.fs.streamText/readText(target)`——宿主原生实例。
- **read_image**：`tool-fs/src/read-image.ts:239 execute()` → 先全部门禁（格式/attachment 服务/deployment media-type）→ `assertImageCapableRoute`（:119-129：`llm.resolveModelInfo` 查 **inputModalities 含 image** 否则 typed 拒）→ 再读字节（原生实例）。
- **我方治理门（pre-execute）与 body 之间无对象传递**：canonicalize 用 `ctx.fs.resolve` 得 realpath 键做车道判定后即弃；body 各自再 resolve+落盘。**检查→执行的对象固定性=身份字符串二次独立解析**，无 fd/openat 钉定；两次 resolve 之间符号链接改靶=静态竞态面（-kit 的 L8/L9 腿打"检查时已是链接"的决定论形；活体竞速形不在本 kit 范围，静态披露）。
- **Team Controlled-FS 覆盖对照（执行中介有无，静态）**：`team-tool-plane.mjs:321-326` **PLANE_SUPPORTED_NATIVE_TAKEOVERS = {bash:[bash], read:[read], grep:[], glob:[]}**——受治理行仅 bash/read 有接管形（read 行= `createGovernedReadExecutor` @ `plane-effect-backends.mjs:37-38/:810+`，骑受控 fs 实例+车道 admission :847-850）；**write/edit/read_image/str_replace_editor 无任何 plane 中介、无 C-FS 实例在其 body 路径上**；保留名伪装防线=PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED 门（natexe 审，:184-215：readName 挂 'write' 曾被实测为**返回内容但零落盘**的伪装者——该门存在即此风险的第一手记录）。
- **会话级 fs-sandbox（≠Team realm）**：`fs-sandbox/src/containment.ts` isPathUnder（词法快路+fs 身份回退）=宿主会话模式（workspace-write 族）边界，按会话授权模式生效，与团队蓝图车道**互不替代**。
- **工具替换/卸载 fail-closed**：我方 Guard（a5p5）未发布拒调 + end-cap 单调拒内层重入（pre-execute-adapter）；行为形=L6（关断名 absent+调用拒）+ R6 end-cap（模块级+live 双证）。
- **行为级终判（真装）**：PENDING（bash-1497 四世界：X9/X10 已证 wide 形 read=宿主原生应答、legacy write **越界落盘=true**（无中介实锤，首轮 2026-10-19T07-59-11Z）；lanes L8/L9 symlink 零变异 + ask 零效果 + unmanaged FATAL 在跑）。

## 3. 红账（append-only，禁覆写）

**R-1 @2026-10-19T07:39Z（run 2026-10-19T07-30-00Z，FATAL，非产品行为红=我方部署输入缺陷经产品 fail-closed 法放大暴露）**：preset 行 `tool-fs-search` 未带 0.2.0-rc.2 必填 config（`sampleOverCapGlobResults: z.boolean().required()` @ 宿主 `tool-fs-search/src/index.ts:98`）→ 装配链响亮拒（原文摘录）：

> bootstrap FAILED: TeamAgentBinderError: binder overlay effect 'persona' failed during 'fresh-root' bind of session 'a5tools-gov-root': the mounted root preset 'a5tools-gov-base' has an UNRESOLVED persona observation (source: none) — the preset seam cannot express the failure (fail closed); preset 'a5tools-gov-base' is broken: tool-fs-search (@deepseek-ai/dsh-tool-fs-search): invalid config: $.sampleOverCapGlobResults missing required value

同跑安装面判据全绿（I1/I2/I3 三零 rootSha=dd2b75e17fddbc2e… 1773/1773；H1/H1b/H0 绿）⇒ 失败精确隔离在 preset 装配段。此条同时是**装配 fail-closed 链的免费负收据**：非法 preset 输入 → 根绑定拒（不回退、不裸跑、typed 链 binder.js→fresh-root.js→root.js:1890→host.js:2291）。修复=补 config（两站点），复跑=bash-1167。

（后续 RED 原文届时原样追加，不转述。）

**R-2 @2026-10-19T08:26Z 跑（2026-10-19T08-26-03Z，FATAL `lanes member completed its ladder`，kit.mjs runWorld→waitFor 超时）——定性=治理面真拒形（fail-closed 正向）+ 我方装配注入腿缺失（产品级缺口，首个 live 实锤）**：
- **调用序列尾部（wire-digests-lanes.jsonl）**：seq26-27 DISC 屏障（root）→ seq28-29 L0 → seq30 leader `team_delegate` **结果=**（原文）：

> {"status":"rejected","code":"TEAM_RUNTIME_DURABLE_WRITE_FAILED","message":"activation: child-session creation failed for member 'inst-03o3bzh0842k': Error: agent-bindings: alpha.5 Team tool plane refused the mount for 'session-team-child-1feff9a613a139098a810a6b493a5518': projection refused: the policy carries a subtree rule but no SubtreeContains seam was injected — subtree coverage is unanswerable without the planes containment law and is never guessed (same law as the C-FS wiring face) (code: TOOL_BINDING_UNVERIFIED)"}

→ seq31 leader `team_collect`（WORK_TOKEN_UNKNOWN，成员从未 admitted）→ 成员**零 wire 请求**（阶梯零步、无任何 pending ask/deny 事实、controlLedger=null）。**最后完成的工具调用=leader team_delegate（rejected）**；卡点=成员 activation 之前的 plane 挂载投影（admission-kernel.ts:900 守卫），非 mock 推进形、非车道拒批形。
- **守卫语义（静态钉）**：`agent-bindings.mjs:2427` `createTeamToolPlaneAssembly(...)` 调用不带 `fs:{subtreeContains}`（assembly 签名 `team-tool-plane.mjs:475` 支持；消费点 lane-decide :398-405 fail-closed、kernel matcher :762）⇒ **strict 蓝图含 subtree 规则 ⇒ plane 挂载必拒**（live 先例全部 any/exact，本跑首次踩实）。修复面=纯 sole-writer agent-bindings 注入腿（fsBackend.contains 公开 seam + subtree 规则 setup 期预规范化；零 core、非 fork）。
- **副作用计数（如实含遥测缺陷）**：成员从未激活 ⇒ **结构零副作用**（零成员请求、零工具步、无 durable 控制行）；本跑 teardown 树指纹（treeFingerprintAfter=0/victimAfter=null）为 **kit 遥测排序缺陷**（事实计算在世界清理后，不可用作计数）——红字不修面，kit 已列入修复（指纹前移到 teardown 前）。lanes 超时本身**不作为任何层通过证据**（根 08:47Z ②令）。
  - **更正 @2026-10-19T09:2xZ（诚实定案，不改上文）**：复核 kit 码序后精确定因——after-facts 在正常路径**先于** teardown 计算（kit :724 早于 :732 finally / :750 rm），本跑为空是**失败路径提前 die 跳过 facts 段**所致（undefined≠null，非"清理后测得"）。"结构零副作用"论据不变（零成员请求+activation 拒于建会话前）；修复同上（after-facts 挪入 finally 首段 rm 前并 try-守卫，失败路径也产计数），下一跑生效。

**R-3 @2026-10-19T07:59Z 跑（2026-10-19T07-59-11Z，wide read_image 首形 RED，非产品缺陷）**：typed 拒原文——
> Error: cannot read "…/governed/seed.png" as an image: model "a5tools-gov-model" does not declare image input; switch to an image-capable model to read images

定性=**门禁活着**（`read-image.ts:119-129 assertImageCapableRoute`→`llm.resolveModelInfo` 查 inputModalities）；首形拒因=测试环境属性（mock 模型名不在官方 catalog）。修复=model 改 `deepseek-flash`（catalog inputModalities ['text','image'] `llm-deepseek/src/models.ts:8-11`），修后跑在跑（后续 run 目录）。

**R-4 @2026-10-19T08:52Z（环境红，非本分支引入，不修面）**：`packages/runtime/test/a3p5-glue-permission-receipt.test.ts`（经 `t12a-live-bridge.mjs`）在本环境 **11/11 红**（先于本分支编辑存在：stash 对照同红）；且需手工补 `node_modules/@deepseek-ai/{dsh-scope,dsh-tool-fs-search}` → test-use 包软链（与既有 5 链同型，gitignored 基础设施，主检出内）才能 collect。本地 typecheck 同理缺 @types/node（typecheck 门历来经 CI）。CI 门（pr-gate @ head_sha）为准。

## 4. wide 逐工具三层记录（根 08:47Z ①令；run 2026-10-19T07-59-11Z；证据=`runs/2026-10-19T07-59-11Z/world-wide.partial.json`+`wire-digests-wide.jsonl` seq 号）

wide=**无治理对照世界**（legacy 成员：无 capabilities.permissions ⇒ 层1 车道/层2 检查链**按设计不运行**——该两层的正负验收世界=lanes/ask/unmanaged）。wide 角色=**层3 真实执行收据 + 无中介对照**。逐工具（成员阶梯 seq7-16，每步成员会话新起、按 toolResults 计数推进）：

| 工具 | 层1 车道 | 层2 检查链 | 层3 执行（wide 实收） | 证据 |
| --- | --- | --- | --- | --- |
| write | N-A（legacy 无 permissions，按设计） | N-A（非 strict 无 pre-execute 监听器） | **PASS**：确认信封 `<path>…a5tools_write.txt`+`Created file`（内容不回显=write.ts:36-41 形状）；字节落地由 seq8 edit 的 old_string **精确匹配 write 行**互证 | partial.memberToolResults[0]；seq7→8 |
| edit | N-A | N-A | **PASS**：fs 事实 writeTxt=`line one / A5TOOLS-EDITED-TOK-B2 replaced it / line three`（替换精确） | partial.fs.writeTxt；seq8 |
| read | N-A | N-A | **PASS**：返回 EDITED 行内容 | memberToolResults[2]；seq9 |
| read_image | N-A | N-A | **PASS（形状）+ 首轮 RED**：typed 拒=`model "a5tools-gov-model" does not declare image input`（assertImageCapableRoute `read-image.ts:119-129` 真实门禁活体收据；mock 非 image-capable=测试环境属性非产品缺陷）；修复=model 改官方 catalog `deepseek-flash`（inputModalities 含 image，`llm-deepseek/src/models.ts:8-11`）——修后跑（在跑轮）出正形 | memberToolResults[3]；seq10；R-3 |
| str_replace_editor | N-A | N-A | **PASS**：独立包 create 成功，fs 事实 sreTxt 含 SRE-TOK-E5（opt-in 包与 edit 两注册形并存实证） | partial.fs.sreTxt；seq11 |
| glob | N-A（KNOWN_SENSITIVE：strict 须 deny——负形在 lanes/unmanaged） | N-A | **PASS**：点名命中 a5tools_write.txt/a5tools_sre.txt | memberToolResults[5]；seq12 |
| grep | N-A | N-A | **PASS**：GREP-TOK 命中 | memberToolResults[6]；seq13 |
| bash | N-A（成员无正允许道=lanes L5 负形） | N-A | **PASS**：echo+落盘 bashw.txt+回读（fs.bashWrote 含 BASH-TOK） | partial.fs.bashWrote；seq14 |
| read（X9 探针：越界绝对路径） | — | — | **层3 对照正证**：`outside/secret.txt` 内容被宿主**原生 body** 返回（governed read 行未在此成员挂载/未拦截）⇒ legacy 形无 Team 中介 | memberToolResults[8]；seq15 |
| write（X10 探针：越界绝对路径） | — | — | **层3 对照正证**：`wideOutsideWrite="A5TOOLS-WRITE-TOK-OUTSIDE"` **落盘成功** ⇒ legacy 形无执行中介（**语义归属注（协调 08:4x 令）：本行是"wide=无治理对照组，越界写成功=对照成立"之正证，非治理世界泄漏**；治理世界同形=lanes 对照组，将测） | partial.wideOutsideWrite；seq16 |

阶梯序 P9 PASS（10 步全序=[write,edit,read,read_image,str_replace_editor,glob,grep,bash,read,write]）；leader 收尾 seq17-18（delegate 执行+collect）。**首轮两处判据缺陷（RED，不修面）**：P1 谓词曾要求 write 结果含内容 marker（write 设计=不回显内容）——已改信封+互证式；P4 首形=mock 模态缺口（上表注）。X11 卫生 PASS（outside/secret.txt 未被改写；victim 在 wide 世界 before==after、wire 零泄漏）。

## 5. 与 B 路接口注记

三面（team-tool-plane.mjs / agent-bindings.mjs:2470 邻域 / plane-effect-backends.mjs）A 路当前零 hand 编辑（原生治理链在其外，2026-10-19T07:38Z 回报）；C2 窗口制已确认让行。
