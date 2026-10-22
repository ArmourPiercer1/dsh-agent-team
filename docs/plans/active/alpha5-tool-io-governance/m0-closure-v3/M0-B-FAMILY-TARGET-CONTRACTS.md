# M0-B：工具 family 的目标治理合同（中心有界候选）

状态：PROPOSED v1.2 / NOT-FROZEN。有限接口补证修订；只读设计输入，不是实现完成、C2通过或M0清零。2026-10-22。
基线：Team 9b2ee57bc5afd30e89855e09d1769d2e5ec83912；Host 639ed015397290b3745d163aafe02ffee4aa3f84；矩阵 c09f94b（SHA256 b7062a9d7fb0d0366e5ceb19b99068ab869cf2355437f3c23a6877ce325aba0f）。记录母表 M0-route-records-v3c.json（55233426a022531cb5049587ffb605c5e487608cdcc08004e68509c2e535c929）。
生命周期唯一依据：M0-A-LIFECYCLE-INTERFACE-DELTA.md（208ba98cf0b9ddca91cb34d403f479b6994cf283f4fed04b75e1f40f3cdfb61c）；本文不修改其两账本、全Effects审核、ceiling、单次消费、Prepare先决和取消规则。

## 0. 裁决范围及证据诚实性

本件选定 family 目标形态、目标标识、补口责任、验收观察点，映射覆盖93记录（89工具来源记录+4surface），三个同名实现按(name,scope)分别映射。不能把映射覆盖读作合同全部已可冻结。§5将先前接口unknown收敛为已选Team adapter补口及工程验收；ACTIVATION-TCB已按用户产品边界收敛为USER_SCOPE_CLARIFIED（见§5.3），其余真实超出可信provider边界的实例另提具名裁决。

E=固定源码已有；P=本件明确拟新增。E证据有两级：E1本轮亲读固定源/已固定本地源码；E2沿用v3c既有只读调查的文件/行锚，本轮未逐行重复复核。每记录保留sourceEvidence及evidenceLevel，不把E2升级成E1。全程零产品修改、零产品/Host测试、零远端写入。

## 1. 一条中心执行路线，不是按family再造授权

所有模型可调用入口，包括 own-layer、Host继承面、别名、动态MCP、嵌套PTC，都进入A的同一可信执行上下文。名称只用于发现；ACTIVE ToolBinding必须绑定exec.agent当前安装、当前definitionIdentity/providerId、当前realm、policy/authority代际；实际body是同一owned adapter闭包，不在批准后按名字重新找Host原生body。

P `FamilyAdapter`是中心内部接口而非现有导出API：
- `classify(args, trustedContext)`：纯解析，产出完整RequestedEffectSet、不可变ExecutionTargetManifest及参数指纹。禁止读磁盘/网络/启动服务来猜效果；确需查询的动作拆成独立已治理查询调用。
- `prepare(admittedContext, immutablePlan)`：仅A允许阶段执行，准备效果在已批effects或明确有限provider准备能力范围内。不得把服务懒启动、attachment创建、浏览器启动藏在纯解析。
- `execute(consumedContext, preparedPlan)`：实际backend操作，先做对应服务owner/目标版本/Domain Gate检查，再提交。拿不到可靠提交边界，不得原样透传原生body并称治理完成。
- `cancel/settle`：映射到A的PA lease与provider/service真实终止证据；只记录真实可确认结果。同步查询没有持久资源时明确C3=N/A(持久lease)，但取消/并发/撤销仍有测试。
接口名为P；落点为Team新增 `packages/runtime/src/plugin/live/governed-families/<family>.mjs`，不是声称这些文件已存在。

完整目标manifest由中心A的严格reviewPayload承载：P增 `familyId, adapterRevision, providerIdentity, targetManifest`，其全值参加operationFingerprint；不得仅传摘要后由可变配置重建目标。每family列出的目标、动作、预算、payload摘要及对象版本是该targetManifest的严格闭集schema，不是任意JSON。敏感数据不复制到审批日志，保存足够绑定的摘要与非秘密对象标识；用于执行的内存payload不允许被换包。

### 1.1 优先复用现有Effects，不引入泛用业务资源系统

固定effects.ts闭集只有tool-invoke/read/write/list/meta/connect/domain-ref；resource.ts仅workspace/realm-home/absolute-path/directory/metadata/network-destination。不能将session、PTY、任务板、插件权限伪装成文件路径，也不能把一个domain-ref当逐目标批准证明。

选定默认：用现有tool-invoke表示该准确受信工具的执行许可；真实FS/net效果逐项进入现RequestedEffectSet；有真实独立Domain权威才加入domain-ref并在效果提交点执行Domain Gate。业务目标、动作、payload摘要、owner、对象revision、预算置于严格targetManifest，由A完整批准载荷绑定。adapter保留原生角色/owner/资源范围检查并与Team工具准入交集。这里的业务目标核查不是新增Team权限产品：没有现存对象级Team政策要求时，不凭“全工具接管”自行新增逐业务对象权限层。

下文S(service,target,operation/right)只是**业务操作义务的语义记法，不是新增PA Effect、ResourceRef或权限凭证**。writer必须为每条S给出真实原生检查/提交入口；该工具还必须具有I以及所有实际F/N/D。不得把未映射的真实文件、网络或现有政策明确约束的效果藏进S或工具名。manifest绑定精确本次动作防换包，不能替代实际owner检查；Domain Gate保证原生边界，不能覆盖Team ceiling。审批人是否具备执行此工具及所有现有effects的权威仍由A逐项验证，不能由adapter自行allow。

明确区分两种需求：
- 已批准要求只是既有tool-invoke门+原生owner/Domain授权+完整FS/net Effects：用上述现机制完成，零新增Effect kind。
- 已批准契约/现行policy明确要求Team对业务对象/动作选择性审批，而当前effectApprovalScope无对应表达：记录具体政策条款、具体工具operation、缺失scope以及不扩类型的替代为何不足，再交中心裁定最小差量。不得以domain-ref粗粒度默认allow绕过这种已存在的要求。

本轮没有证据证明全部非FS family都要求第二种粒度，因此不选service-target为M0必需项，不修改公共kind/schema。一个可供真实缺口时评估的备选是单一service-target kind，仍需resource/effects parser、PA policy/deny-source投影、effectApprovalScope与verify的全链修改及新增测试；它有真实成本，不是免费补一个字段，本件不将其冻结或交产品实施。

### 1.2 共用验收 BASE（所有工具行必引用）
- BASE.C1：证明真实definition/provider绑定、纯classify输出完整effects与manifest；同名伪造、跨agent/realm/owner、未知operation、不可解析target、CURRENT与target混淆均拒。全allow与Ask两路、普通可升梯deny与hard/domain veto分开；每种公开operation分支均列出effects，不能只测工具名。
- BASE.C2：真实注册入口→A→实际backend的功能成功正控，且观察业务结果，不接受mock返回或仅Guard绿灯；Ask pending时Prepare/body/业务写入=0；批准后恰一次body；拒绝、撤销、definition/provider/代际漂移、跨owner、重放及同名替换时零未授权效果。all-allow无Control行；Ask有真实对应消费行。各行C2须同时实现family.C2及逐行delta。
- BASE.C3：在等待、Prepare、消费前后分别取消；两并发入口单飞；binding DRAINING后不能native fallback；冷重启旧grant/旧批准不重跑；持久任务只按可信owner恢复观察。取消不等终止，副作用不确定不得报成功；无持久lease的行说明N/A依据，但仍测取消提交边界与并发读取隔离。
- 公共日志最少记录：invocationCorrelation、binding revision、manifest digest、Control实际request/decision/consumption（Ask）、PA实际消费状态、backend开始/提交/结束及lease证据。日志是证据，不是新权限账本。

## 2. 唯一owner与变更边界

所有者是明确工程角色，待中心分配给实际writer；本件不冒称已有人员接受任务。一个共享文件仅一owner。
- CENTER（中心集成writer）：现有 `packages/runtime/src/plugin/live/agent-bindings.mjs`、`team-tool-plane.mjs`、`packages/tools/src/guard.ts`、`builtin-deny.ts`、`packages/runtime/operation-permission/permission-coverage.ts`。独占注册、placement、mask、registry执行关联、A调用和动态失效；其他family不得私改共享接线。
- AUTH（PA/Control writer）：A列明的 `packages/runtime/tool-admission/admission-kernel.ts`、`approval-case.ts`、`packages/runtime/control/types.ts`、`service.ts`。唯一审批语义writer，负责既有Effects投影、全Effects校验与A差量；与中心共同审核但不多writer并写。
- SCHEMA（中心指定单writer，可与AUTH同人）：`packages/domain/tool-governance/src/{resource,effects,binding,interfaces}.ts`，唯一公共类型owner。若确有类型差量须中心另裁，family不得自加私有effect名。
- FS-PROC：现有 `packages/runtime/src/plugin/live/plane-effect-backends.mjs`、`packages/runtime/sandbox-provider/provider.ts`及新增 fs/search/process/terminal/lsp adapters。所有此共享后端改动由本角色串行集成。
- SERVICE：新增 session/goal/schedule/skill/present/subagent/orchestration/inspect adapters；调用Host公开服务，不改Host Core。
- CONNECTOR：新增 web/mcp/browser adapters；现有MCP装配改动提交CENTER，不自改agent-bindings。
- CONTROL：own-Team/control工具adapter与服务业务角色检查；Control共享service实际变更归AUTH，不自建ledger。
- PLUGIN：新增plugin-management/dependencies adapter；profile全局变更与执行脚本是其独立范围，不能交FS-PROC用路径壳糊住。
- TEST：生成每记录实际验收卡，按本件索引观察真实结果，不能改变合同。ROOT裁决具名表示缺口及未能证明可行的特殊provider能力；不重新问全scope是否必交。

## 3. Family目标合同

每节均继承§1绑定与A生命周期，列出的targets/effects必须全量纳入；I=该准确工具的tool-invoke，S(op,target,right)=严格manifest里的业务操作义务（非PA效果），D=可信domain-ref，N=connect目的地，F=实际FS效果。全部family均为PROPOSED target，只有明确标E的backend/API是既有。

### B-FS：read / write / edit / str_replace_editor
身份：E placementFeed绑定owned definition；P每个公开command分支固定schema。目标：realm+canonical path、read窗口、edit旧/新输入摘要、command；view→read，create→write，replace/insert→read+write（若实现确实读旧内容）；I+所有F+准备scratch。先授权后open，symlink/父目录变化由ControlledFs最终解析复核，不能纯路径字符串确认。
路线/owner：FS-PROC用E ControlledFs.readText/writeText等，CENTER替换write/edit等未接管面；复杂编辑在Team adapter内以受控read/write实现，不假设Host FsSandboxController=Team治理。
C1：command全集映射及path/window；C2：逐command批准后正确内容、拒绝无open/write，别名/symlink逃逸拒；read无默认limit替换null；C3：原子提交/并发旧内容漂移失败，取消可能已写如实报告，不盲目重试。锚：interfaces.ts:49–130；v3c write/edit/str_replace来源；plane backend read:918–966（现同步decide不等A准入）。

### B-IMAGE：read_image
目标：I+F(read exact file)+S(attachment-store,create,write)+S(session,attach-vision,write)，绑定bytes/pixels上限、目标会话/attachment namespace。不是write家族的简单read别名。
路线/owner：FS-PROC用受控读；SERVICE的attachment adapter在批准后创建/引用附件，容量检查在读取时落实。E Host read-image.ts:209–263与conditional attachment挂载，仅作功能接口事实。
C1：缺store只条件不可用，不豁免；C2：批准后有效图像/同scope附件可取，拒绝0文件读取/附件写，超cap拒；C3：取消清理仅本调用未提交附件，不删既有附件，cold resume不得重新发布。

### B-SEARCH：grep/glob/team_grep/team_glob
选定alias+native mask形式（P，中心可等强改同名）；每个native记录映射对应别名功能正控，非纯deny。目标I按实际暴露definition；F(list/read subtree)及confined rg进程、有限输出spill。pattern/path/include逐字遵守native公共参数；不能因legacy四旋钮不支持说native缺参。
路线/owner：FS-PROC现confined-rg，E公共buildGrepCommand/parseGrepMatches/resolveRgPath；CENTER保证native名称禁回落且提示/调用schema明确指向别名。C1：scope树及glob/grep差量；C2：native声明参数面、结果结构、caps/spill等价正控+跨owner目录拒，native deny单独不算通过；C3：rg取消/lease及输出spill归属，更新中mask持续。锚：v3c routes§0.3；plane-effect-backends.mjs:264–277；Host grep.ts:285–292/glob.ts:305–320（E2）。

### B-PROCESS：bash/team_bash/pwsh
目标I+受信process service spawn对象(S)+实际F/N envelope、cwd/env键与值摘要、argv/script摘要、timeout/output/后台上限、完整准备路径。shell内容不靠静态字符串猜所有访问，允许效果必须是可执行provider能强制的明确有限范围。
路线/owner：FS-PROC将P adapter连接E runtime Provider.prepare/execute/executeStreaming；PA grant→provider fingerprint/lease映射遵A。pwsh必须真实Windows provider与同等保证，不能复用bash已验收断言。
C1：provider各维assurance满足请求且不降ceiling；C2：批准后的真实命令/正确退出与副作用，Ask pending scratch/probe/spawn=0（team_bash R2）；拒绝无naked spawn，超网络/文件范围实拒；C3：前后台tree终止、recordCapable payloadExit证据、后台owner、cancel与输出不可伪报。锚：provider.ts:74,112,569,646,716,832,861；A及v3c pwsh。

### B-TERMINAL：六terminal工具
可信目标：当前exec.agent→E requireAgent→terminals owner记录，禁止仅用sessionId或display name授权。open绑定中心调用关联与待创建PTY的type/cwd/shell backend version/资源envelope，真实PTY ID由Host service稍后铸造；send绑定PTY incarnation、输入bytes摘要、submit、fg/bg、当前envelope及job目标；read绑定输出窗口；signal绑定准确signal+PTY incarnation；close绑定进程树；list只owner集合。S分别spawn/write-stdin/read/signal/close/list，加open/send可产生的F/N/process envelope；每次send是新调用新许可，不继承open许可。
路线：P Team-owned terminal backend，从open起就在provider强制envelope内运行，stdin不会逃出该沙箱；不是只检查stdin字符串。PTY保持全生命周期能力上限，send授权范围不得比该PTY可实际行使范围更窄而仍放任其执行。需要更窄权限时必须新的隔离PTY；不能用原进程“换grant”假称降权。若当前PTY不能按次暂停/约束背景活动，不能把send一次批准称只许可这一条命令；完整persistent scope须明确批准且仍逐send治理。此处不再以未运行Host为“合同不可定义”：选定下述公开backend接点，provider实现/实证属于后续C2交付，不是terminal范围删除。
E真实调用：Host packages/terminal/tool-terminal/src/index.ts:164–195 `ctx.terminals.spawn(owner,request,signal)`；:258–285 `startSend(owner,id,request)`，bg通过jobs.start→started.cancel/done；read/signal/close/list同文件302+。P adapter不得用背景job的killed作为PTY已终止证据。
E1补证：Host terminal/terminal/src/index.ts:125公开registerBackend；types.ts:148–172公开TerminalBackend.spawn及TerminalBackendSession.startSend/read/signal/status/close；terminal-bash/src/index.ts:185–239公开BashTerminalBackend，构造器可注入spawnTerminal和createSession。P选定Team注册专用governed backend，不触碰Host Core；选定每open唯一私有backend registration闭包，捕获本次批准的provider plan；其关联细节严格按§5.1，不假设Host透传call/token，禁止owner/currentPlan及进程级共享currentGrant。保留Host服务mint sessionId与owner核验，Team不伪造PTY ID；manifest绑定中心open关联及预留name，收到真实ID后建立非授权性质的owner/incarnation关联。子进程必须由Team PTY-provider运行器在批准envelope内创建，普通node-pty调用不是已治理证明。后续send/read/signal/close经原公开服务，A恰一次消费后才进入相应方法；后台jobs明确owner与PTY关联。
owner FS-PROC；C1：六operation清单、owner/incarnation、pending零spawn/zero stdin；C2：真实持久REPL跨两次send保留状态、approved send恰一次、跨owner和过期PTY拒、read/list可用、信号/close真操作；C3：send idle/timeout不是exit，bg取消/close分别观测foreground与PTY tree，policy收紧时阻止新send并drain，冷恢复不重发stdin。

### B-JOB：job_output/job_list/job_kill
目标S(真实job owner+jobId+producer incarnation, read/list/cancel)，read位置/limit入manifest。E JobRegistry.start(spec.owner)/read/readAt/list/kill/wait；不存在owner()、done()方法。P producer grant/lease关联表只记录归属，不授予权限；unowned job不纳成调用者自有。
owner FS-PROC+CENTER注册；C1：owner必由生产者可信注册，名字不足；C2：真后台job输出/list/kill请求成功，跨owner/重放kill不能控制其他job；C3：kill=requested，等待producer hooks.done与真实资源终止；restart只恢复观察，不能重spawn。锚：Host jobs/jobs/src/index.ts:110–174、types.ts:105–156。

### B-LSP：lsp
目标语言服务实例=member+workspace+policyGeneration+server binary identity；I+S(request method/document/version)+F(read项目范围)+process/scratch。E1 Host packages/lsp/tool-lsp/src/index.ts:110–123的闭集恰为goToDefinition/findReferences/goToImplementation/hover四个只读导航操作，参数operation/file_path/line/character；不在本M0擅自新增write/executeCommand/diagnostics功能。line/character为one-based UTF-16，parseLspArgs转zero-based；:183–194要求sessionCwd且无fallback，再ctx.lsp.query(request,exec.signal)。
owner FS-PROC；P per-instance adapter在启动及每请求都A；复用真实clangd/tsserver，不复用未受控裸进程。C1：method白名单与目标document解析；C2：goToDefinition/findReferences/goToImplementation/hover四操作真实功能及跨项目拒；C3：generation变更kill/drain旧server、并发request取消，cold instance重建新准入。E2 v3c lsp、assembly；E1补证及P精确补口见§5.2；不再作为泛化unknown。

### B-WEB：web_fetch/web_search
目标I+N(每实际目的地/搜索provider)+D(存在独立域时)+S(query/fetch exact URL operation)，URL/query摘要、redirect及返回大小/timeout上限。搜索不是固定网址fetch假实现。
owner CONNECTOR；P把既有DORMANT PR7臂接真实已安装Host provider，Gateway最终执行DNS/IP、重定向每跳及loopback/linklocal检查；预先批完整destination envelope，超范围跳转拒，不暗增effects。C1：真实provider identity及目标解析；C2：真实允许fetch+search各正控，拒绝/恶意redirect/DNS rebinding无违规请求；C3：abort停止流与provider作业，不确定远端处理不报回滚。E interfaces.ts:ProviderGateway；v3c Host dsh-tool-web search.ts:326/provider:187。

### B-SKILL：skill
目标I+S(skill catalog namespace+skillId+version,read/load)+S(current session prompt,inject,write)；内容摘要、来源与当前挂载身份。加载内容是数据，不形成授权；skill里的后续工具仍逐次A。owner SERVICE；P捕获已验证catalog条目而非按同名全局重查，保留E model-invocable双gate/user-gesture边界。
C1：kind:user不得模型伪造；C2：批准后实际技能内容可用，拒绝不注入prompt，恶意内容不能扩权限；C3：catalog换版使旧批准stale，卸载后不复用缓存。E2 Host skill index.ts:81,138,145,161,195；agent-bindings.mjs:2692–2697。

### B-DEPENDENCY：load_workspace_dependencies
目标I+S(workspace runtime install namespace+版本,install,write)+F(精确runtime cache/目的目录/临时路径)+process/N若实际需要；复制/rename/删除旧临时件逐项，不包进一句install。owner PLUGIN；P在获准后执行已固定payload安装计划，memoized成功绑定payload hash+workspace+owner，memo不绕A。
C1：不把mkdir/cp/rename/rm当纯prepare；C2：真runtime可用、拒绝无目录变化、不能改PATH或无关文件；C3：并发安装单飞、部分失败不宣称成功，下次新调用重准入，保留无关历史。E2 Host index.ts:204–235,249。

### B-SESSION：todo_write / create_goal/get_goal/update_goal
目标I+S(current session incarnation, exact todo/goal action)，goal revision、文本摘要、状态、continuation rounds上限；create/update包括durable append及arm/disarm效果，不只是文件write。owner SERVICE；P在E session/goal服务提交前做owner/revision检查，保留direct-human恢复要求，模型不能冒充human。
C1：get/read与update/write分离；C2：todo真更新、goal create/get/update各成功，拒绝无append/arm，跨session及revision冲突拒；C3：cancel与提交race报告真实结果，session停止disarm，重启不自动把human-only rearm转模型许可。E2 goal/src/index.ts:278–282,613、authority.ts:100；todo assembly。

### B-SCHEDULE：schedule_create/delete/list/update
目标I+S(owner session+taskId+revision,action)+S(timer namespace,arm/reschedule/disarm)+S(destination session,wake)；cron/时区/时间窗/最大触发次数、payload摘要、目标会话、存储对象全入manifest。未来wake不是本次grant可无限复用的执行许可：本次批准持久schedule定义及其界限；每次触发新invocation重查当前policy/目标owner，实际后续工具仍逐次治理。
owner SERVICE；E task服务durable storage/timer，P受信trigger adapter。C1：跨会话目标不能从caller字符串猜；C2：真实创建→触发一次→update→delete→list功能，拒绝0timer/存储/wake；C3：restart不双触发、取消后不再wake、policy撤销阻触发且保留可审计任务状态。E2 schedule tools.ts:416–527/runtime.ts:101–124/storage.ts:56–59。

### B-SESSIONQUERY：五session查询工具
目标I+S(authorized workspace+session/event/lineage集合,read/search/trace)；query/精确eventId/范围/limit，不因同workspace自动读全部私有session。owner SERVICE；P调用现服务授权之后再交集Team ceiling，搜索不开启只记current mount条件，exact read仍需治理。
C1：完整五schema及target scope；C2：逐工具真返回授权数据，跨owner/工作区拒且无existence泄漏；C3：30s deadline/cancel、并发一致的scope快照，无持久lease故仅lease settlement N/A。E2 Host tool-session-query index.ts:65–121。

### B-SUBAGENT：subagent/fork/codex/claude_code/list_subagent_models/Host control trio
目标I+S(parent member+child instance,spawn/fork/message/interrupt/read/model-list)，模型/provider/预算/最大深度/seed内容摘要/工作区及新child权限上限；fork上下文读取也列effect。exact host-provider身份不得与上游实验Team同名trio互认。
owner SERVICE；P child创建前安装同一CENTER closed world，不能先spawn再补Guard；external codex/claude provider必须可强制该child envelope，不能把外部模型当已治理native工具。消息包含续跑能力与资源预算，send不是仅内存write。C1：parent-child可信关系及nested depth；C2：各provider真任务/继续/interrupt/list功能，未安装治理child不得启动，跨owner message拒；C3：父cancel传播并等待child资源证据，停止当前turn不假称永久销毁child，cold恢复不可复制fork。
E2 Host tool-subagent index.ts:108,379，subagent-control index.ts:28,74与list-agents.ts:86；CENTER agent-bindings.mjs createTeamAgent路径4071+。

### B-ORCHESTRATION：workflow/ralph
目标I+S(execution graph/loop instance,run)+每个child spawn、上下文读取、轮次/并行/总预算、模型路由；静态完整graph可预列，运行时新发现target必须独立子调用A，不继承outer grant。owner SERVICE；P调用E engine前建立受限child工厂，所有模型tools穿CENTER。C1：workflow脚本禁止逃逸服务能力、ralph cap明确；C2：真实多节点/多轮结果且nested Ask停在子body前，拒绝无fanout；C3：cancel全children收敛、并发预算不超、重启不继续旧grant。E2 workflow index.ts:60,126,328–329；ralph index.ts:411/preset cap64。

### B-HUMAN：ask_user_question/exit_plan_mode
目标I+S(owner session+question/mode incarnation,ask/exit-plan)，问题/选项或计划digest，退出所需现Host approval。owner SERVICE；P Team前置准入后保留Host人类交互门；用户回答只属于对应问题，不能当任意工具allow。C1：只准当前会话；C2：真实展示/回答或批准后mode切换，拒绝不发问/不切换；C3：取消撤销等待，无重复问题，过期回答无效。E2 ask-user index.ts:38–39/plan-mode index.ts:67,278。

### B-PRESENT：present
目标I+F(read/metadata exact deliverable)+S(current audience/session,expose,write)，artifact ID/版本/可见受众，呈现不是“只读无副作用”。owner SERVICE；P经deliverable服务保留stateless no-copy但确认目标可见范围。
C1：路径/attachment owner校验；C2：真卡片可打开允许文件，拒绝无暴露、跨owner附件不可冒领；C3：取消发布race准确，不凭未发送claim撤销既已展示内容。E2 tool-present index.ts:38–39。

### B-PLUGIN：plugin_manager
身份/目标：当前可信profile ID而非模型参数；每action独立I+S(profile,operation,target)，list/read；enable/disable含profile配置持久写及影响所有sessions的runtime topology变化；install含package spec/版本约束及解析后实际hash核验、registry/fallback N、FS缓存/安装路径、脚本进程envelope、approvedBuilds持久许可、activation；remove包含准确安装目标；version exemption含exact package@version+runtimeVersion、enabled/acceptRisk。manifest明确全profile影响及脚本持续许可，不能“target包名”代表任意依赖版本/脚本。
E Host packages/boot/plugin-manager/src/tools.ts:20–31闭集8 actions，:38–45 approveEscalation，:47–94 manager实际调用。Host full-access免提示≠Team allow；先A，再既有Host escalation和服务业务校验，两个门交集。
P adapter采用获准operation envelope内的安装流程，不强迫用户先手动运行第二个工具：classify纯绑定package spec、允许registry集合、profile/安装根、build许可、启用要求及预算；解析/下载/执行均在A之后，实际新目标超出已批集合才stale终止或成为新调用，不能静默放宽。E1 installBundle(spec,options)已有requestId；waitForInstall(requestId)与cancelInstall(requestId)分别在index.ts:577、588，取消仅installing阶段可确认，applying返回too-late，not-running不能推定完成。P adapter生成不可模型冒领的requestId，绑定owner与A invocation，signal映射cancelInstall并保留too-late/不确定结果；工具壳当前未传这些字段不等于Host接口不存在。脚本约束和activation最终recheck的选定Team补口见§5.3，不宣称manager原样调用已经充分。所有8动作仍有正验收，不用拒绝install冒充全family完成。
owner PLUGIN；CENTER独占生效前placement重concile，guard/mask先于新工具publish。C1：8action逐分支、构建许可/版本豁免不能从普通install推导；C2：真列出/安装/启停/移除/豁免正控及profile写检查，拒绝无fetch/script/config/activation；C3：install中撤销防后续脚本/激活，部分安装报告不盲清除无关文件；profile变更并发与旧bindings失效，全session scope核对。

### B-INSPECT：cordis_inspect_list/query
目标I+S(current allowed registry topology path,read/query)，query的client目标、数据范围、timeout；拓扑与browser往返也是数据边界。owner SERVICE；P闭集registry query adapter，禁止由任意query触发写/脚本。C1：source/provider与query schema；C2：真列表/query且未授权节点不泄漏；C3：client timeout/cancel不遗留pending请求，跨session响应拒。E2 index.ts:23,42/inspect-registry.ts:119–133。

### B-MCP：动态stdio/HTTP两surface及资源三件
工具实例身份=可信配置server ID+connection incarnation+transport/provider identity+原始toolName+schema digest+scope；任何display name前缀均非权限。资源三件虽静态名字，仍绑定具体server、method、cursor/URI；URI作为MCP opaque URI，不能直接当FS path或可信URL。完整effects：I+S(server,tools/call或resources方法,目标)+D(server的真实域权威)+N(HTTP实际endpoint及跳转)；stdio额外是本地server spawn的F/N/process envelope。stdio是本地进程并可能产生远端业务效果，不是“全remote”也不是只管spawn。
路线：CONNECTOR写Team侧MCP transport adapter，CENTER拥有现agent-bindings.mjs:2733–2832 mount/reconcile入口；现guard mcp__ UNVERIFIED不得用名称升级。连接建立/握手/刷新schema也必须在已授权安装能力或独立治理调用中，不能模型call pending前偷连。每工具真实service-operation目标必须由可信server contract/adapter给出；不信任服务器自报readOnly或任意schema注解作为完整effects。无法给出效果contract的具体server/tool保持具名未完成，不能据此宣称整个MCP功能验收。
E资源 `packages/mcp/mcp-resources/src/tools.ts:21–63 registerResourceTools(ctx,request)`，request(server,{method,...},exec)是真正可包裹的参数转接点；methods为resources/list、resources/templates/list、resources/read。连接scope resolve及URI直传见E2 connection.ts:380/index.ts:122。
C1：动态增删/同名碰撞/schema变更、三resource方法各effect；C2：真实stdio与HTTP工具、三资源方法分别批准成功，scope/URI越权/取消/Domain veto无对应业务效果；C3：断连重连incarnation失效，late result归旧call不触发重试，远端cancel缺ack须UNKNOWN，stdio树终止与远端事务状态分开。

### B-BROWSER：六stagehand工具
目标可信browser/session/tab incarnation、owned launch或明确attach endpoint、URL/origin、动作/提取schema/指令摘要、模型provider目的地、截图attachment目标；I+S(browser action/read/tab-create/close/select)+N导航及模型传输+D适用站点域+F(profile/scratch)+附件写。observe/extract/act会传页面给模型，不以名字read替代外发效应。
E packages/experimental/browser-use-stagehand-native/src/index.ts:176–190 createMcpToolDefinition；:197+ tools/execute监听器先resources.run；懒启动可能早于原生execute，故只在body外包一层不足。P owned adapter必须替换这条前置资源路线或保证CENTER前置生命周期完全包住resource acquisition；不能直接next()绕Prepare。无需Host Core patch，Team可安装own definition/provider并mask原face，但需复用或实现browser资源服务入口。
动作范围：保留原stagehand_act单次instruction API，不强制改成observe再act的双工具产品。A批准绑定真实tab/incarnation、instruction摘要、允许origin/network范围、模型传输及适用Domain gate；不能由审批标签推定用户准许所有业务提交。若已批准操作本身允许在该tab/origin执行该指令，Team无需凭空新增每DOM手势权限产品；若现有具体Domain gate要求提交前业务验证，就必须在该gate的实际提交入口执行，不能靠origin批准越过。E1 native.ts:132–135实际是stagehand.act(instruction,{page,timeout})；现NativeBrowserRuntime未暴露细粒度interceptor，但Team owned provider可在CDP/浏览器资源层实施既有network/target边界并保留独立域adapter，不需Host Core patch。缺某个业务域gate时，只记录该具名接入缺口，不默认创建万能浏览器业务安全引擎。
owner CONNECTOR；C1：六method及owned/attach差别、模型exfil；C2：真导航/观察/提取/截图/tab/原单次act指令成功及禁止站点/模型/适用Domain提交负控，Ask期间0launch/attach/页面外发；C3：cancel drain浏览器资源，attached浏览器不能误杀用户全进程，policy撤销后无后续动作，late模型响应不可触发提交。

### B-PTC：run_code
目标I+外层代码/解释器provider及F/N/process envelope+子调用通道能力清单/预算。outer grant不包含任意nested工具授权；每nested可信Host exec带parent token并独立A，child tool/definition/member身份单独查，不能用rootCallId复用grant。
owner FS-PROC解释器，CENTER nested router唯一owner；E agent-bindings.mjs:2619,2673–2684 registerMember/registerAgent/unregister。P批准后启动隔离解释器，把tools桥只接治理dispatcher；动态发现与schema重置同MCP原则。
C1：outer net/process effects不能以net-process-visibility-GAP占位；C2：真实代码+真实nested allow/Ask/deny，子Ask期间子body=0，outer批准不放过子deny；C3：父取消终止解释器和待执行子调用，已提交子效果如实报告，子并发各一消费，无全组carry。E provider interfaces及v3c run_code来源，网络强制仍需实证。

### B-UPSTREAMTEAM：实验Team的trio/spawn/wait/task-board
身份与Host subagent trio分开：具体provider definition+可信Team membership，不凭同名路由。目标I+S(teamId,member/mailbox/task/action,read/write/list)，spawn预算与child治理；message正文摘要/收件member、任务revision/claim。owner SERVICE；P用实验服务membership验证与Team政策交集，不能由调用者提供teamId决定归属。
C1：所有9工具逐schema与现membership入口；C2：真实roster/message/interrupt/spawn/wait/task CRUD各功能，跨team/claim revision拒，trio不能错投Host实现；C3：durable mailbox不重复投递、任务CAS并发/等待取消/child停机证据。E2 experimental/tool-agent-team index.ts:175–176,215–216,232–243,277–290,313–360,406–409。

### B-TEAM：本项目Team业务十工具（不含控制/权限五件）
目标I+S(可信durable root/member/template/config/消息/归档对象,exact operation)；create/delegate/followup含child运行及预算，collect含返回状态读，send/report含durable消息写，archive含成员生命周期。全部采用既有Team service角色/归属校验，P再接A；own-layer/前缀不豁免。owner CONTROL，CENTER owns registration (agent-bindings.mjs:2444–2456)。E1精确入口已核：packages/tools/src/tools.ts:1524 createTeamTools(options)→:430+ makeDefinition的exec/caller/root核验→各spec.run；业务调用映射见§5.4。不得重复建立同义service层。
C1：每项完整业务operation与source role；C2：10/10正控及对应拒绝、跨root/member/角色负控；C3：create/delegate单飞、followup不重复启动、archive drain后不可旧def回落，消息提交不确定不盲重发。没有child执行的只读行持久lease=N/A，不能因此跳过并发/撤销。

### B-CONTROL：request/resolve/list_pending/grant/revoke五件
目标I+S(真实root+request/case或permission subject+revision,exact action)；请求包含beneficiary/authority scope/完整effect manifest；resolve包含实际caller角色、request/leg/decision；权限变化包含准确overlay、旧/新revision、授权范围。读取list_pending也做leader/可见范围校验。
路线/owner：CONTROL adapter调用E ControlService；AUTH唯一service/ledger owner。控制平面不能自己给自己造工具执行grant来通过自己的审批，亦不能绕A当prefix-trusted：对控制面自身执行权，用现独立角色与上级已授权的政策范围决定all-allow或合法外部审批；如果其执行本身需要同一未决批准才能发起批准，报告显式control-plane authority配置循环，不递归创建case。request本身不批准任何工具；resolve必须按A在allow提交前验证所有effects且不可自授权；grant/revoke维持现leader/ceiling/扩张语义。
C1：五operation及自批/循环负控；C2：真实request→合法reviewer resolve→消费业务效果、list、grant/revoke各正控，伪造reviewer/跨root/低rung/部分effects批准无allow提交；C3：并发resolve/guard一次性、升级leg manifest不丢、权限变更使旧grant失效，取消无退款/replay。锚：A全文；control types:1536,1576,1662,1713；service:2500,3014,3086,4449。

### B-DOMAIN / B-ISOLATION：两个非工具surface
DOMAIN：独立domain服务在实际效果提交点最后裁决，Team允许不是Domain允许；不能给域全局默认allow。C1映射可信domain identity；C2真域拒绝阻止提交而Team允许；C3域断连/代际变化fail closed。owner CONNECTOR/对应真实domain adapter，CENTER只负责交集不创万能域框架。
ISOLATION：preset self-register仍可被CENTER closed-world捕获，own scope/global scope不混淆。C1真实注册隔离契约；C2动态未知工具不能跑，known允许工具仍能跑（全deny不算）；C3卸载/冷恢复/drain顺序与同名伪造。owner CENTER。二surface无独立工具call C2消费计数，但要覆盖其影响的实际工具。

## 4. 波次与条件分轴

每记录保留原acc仅作历史标签；新acceptanceWave按实施计划另排，不承担scope语义。mountCondition只描述req=REQ-COND/REQ-COND-win32的实际平台/挂载条件，所有工具的onMountObligation=FULL_GOVERNANCE。grep/glob req=REQ、mountCondition=always，不得被原W2字样变成可选。未挂载可先C1，C2标ENV_BLOCK及具体条件；不能把ENV_BLOCK当pass或永不实施。

## 5. 有限接口补证后的选定补口与确切剩余裁决

补证输入：m0-existing-research的7线及自补回执；传输容器SHA256 c961bf4ba3f5a00e92fef4ce54aa84d72d2dc52a068951fe34900841a985f41e。回执仅作线索，本轮对下面关键接口另读固定源码；未重复全仓调查。未执行Host不能被写成“合同无法定义”。

### 5.1 PTY：已选定公开backend路线，非Core seam

E接点是TerminalSessionService.registerBackend、TerminalBackend.spawn、TerminalBackendSession全部六操作相关方法；BashTerminalBackend构造器的spawnTerminal注入口可复用现PTY会话协议。P新增Team `governed-families/terminal.mjs` 与 `sandbox-provider/pty-adapter.ts`：后者把准备完成的有限provider plan变成兼容SubprocessTerminalHandle的PTY句柄，必须提供真实foreground process-group signal、scrollback、close quiescence，而不能用普通pipe冒充PTY。其边界是provider内spawn，不是Host Core。

E限制：Host TerminalBackendSpawnSpec只带sessionId/owner/type/name?/cwd?/signal，没有callId、token或grant；TerminalSessionService.reserveSpawn为每owner维护Set，允许多个pending。因此本合同选择**每open唯一、私有、一次性的backend registration闭包**，不用owner或name查可变currentPlan：CENTER为每个可信open生成独立内部backend type；模型输入type仅能选择声明的公共backend，不允许指定任何内部type。内部type不是权限凭证或秘密Bearer，只有owned adapter可将其路由到该闭包。闭包捕获确切owner对象、规范化参数、A invocation关联及该调用prepared plan；在任何await前原子标记只可进入一次，核owner/参数，再启动该plan，二次进入拒绝。spawn一旦认领即撤销此backend注册；若Host在进入backend之前失败，也在finally撤销，已创建session保留自身backend-session实例供后续操作。并发同owner两个open各有独立type/闭包，不共享grant/plan，不扩Host spec。此短生命周期关联只防串call，授权仍来自A。

open在A允许Prepare阶段建立PTY配置/scratch，PA消费后才真正spawn；Host service新建ID后绑定owner/incarnation。每次send为独立call，现PTY的完整有效envelope必须在该调用政策允许范围内，或者本次明确需要并获得该完整范围的批准；拒绝不能留下“仍发了stdin”的路径。永久后台活动属于open所批准的有界lease，不将send返回idle当lease终结；policy收紧由CENTER drain该PTY、阻断新send，并以真实close终止证据结算。保留跨call REPL状态功能，不通过每次开新bash冒充terminal。FS-PROC独占这两个新文件，CENTER仅装配。具体实现及C2尚未做，不是待根重新决定terminal是否要做。

### 5.2 LSP：已核现有assembly，最小A生命周期接线差量

E Team `packages/runtime/sandbox-provider/lsp-assembly.ts`：LspRealmPolicy:44起；LspAssemblyOptions:74起；LspRealmAssembly:93起暴露ensure(memberId,generation)、policyChange、dispose、disposeAll、current、size；createLspRealmAssembly:108；assemble约172先probe再spawnStreaming；policyChange约278先gate新realm再dispose旧realm再assemble。它是per(member×generation)实例，不是Host全局按path复用池。配置已支持argv/cwd/env/allowPaths/networkProfile；不能声称任意LSP method已由该assembly自动治理。

P FS-PROC在同一现文件内提供两阶段内部端口（名称P）：prepareRealm(member,generation,approvedPolicy)返回不可重放plan；executePreparedRealm(plan)使用runtime provider.executeStreaming，消费必须由A完成后调用。现ensure/policyChange不能在Ask等待前触发probe/spawn；既有调用迁移到A的Prepare/execute分段而非第二次消费。新 `governed-families/lsp.mjs` 负责现公开LSP工具参数→协议请求的严格映射，以及document URI/workspace/version与服务端process envelope交集；每调用不能用热点server存在为免准入。完整参数schema按已核四操作及actual mounted definition固定，保留Host公开parseLspArgs/sessionCwd/render语义；Team query adapter把四操作转换到当前独立server协议并保留结果caps。安装时固定schema digest；未识别method不能走泛用executeCommand回落。

P必须补齐两个现有接点的真实消费：
- readiness选现LspAssemblyOptions.ready(instance)注入口，不用默认defaultReady。默认line-JSON ping/pong/pid只是fixture协议，不能证明clangd/tsserver可用。Team协议adapter按实际server完成真实initialize/initialized及就绪响应（tsserver按其实际协议握手/请求），设置有界timeout并检验当前instance/incarnation；四导航操作与返回caps在同协议adapter内落实。真实ready在已获准进程执行后进行，不能在Ask等待期启动server探测。
- hardDimensions当前options声明但providerFor未透传；FS-PROC必须把当前批准请求所需维度解析成合法AssuranceDimension闭集，再显式传给createConfinedProcessProvider({...,hardDimensions})，每个新realm/pre-gate都使用同一已验证要求。禁止只保留配置字段或用string cast当能力满足；热实例每请求仍验证assurance/envelope，不能因server存在而免验。

P失败清理必须遵A：readiness失败后terminateInstance若返回termination-unconfirmed，保留UNKNOWN/sideEffectUnknown及具体lease/实例关联，不能宣称zero residual、净零或已释放。固定源码assemble约218–224的“zero residual handles/pids”文案不能无条件沿用；只有真实终止证据支持时才报资源清理完成。cleanup未确认不能删除唯一追踪再装作无活进程。

C1新增：ensure同代热复用无二次spawn、错代拒并只由policyChange替换；policyChange失败不改为旧代已授权。C2必须真clangd/tsserver所声明功能，C3并发ensure/policyChange由Team adapter按member串行，避免现Map异步窗口重复spawn。不是要求本轮运行，也不是Core patch。

### 5.3 插件安装：已有取消，新增的是效果执行与激活边界

E Host plugin-manager/src/index.ts:462–568完整install流程；:474 approveBuilds会先写持久构建许可；:482 checkGithubConnection会产生网络/进程；:497 registryPlan；:506 runPnpm；:555转applying，:560 configure/selectBundle/reload。:577 waitForInstall，:588 cancelInstall（too-late与not-running含义如B-PLUGIN）。:661 private runPnpm调用operations.ts:284 runProfilePnpm。该runner options:32–58有command/args/env/signal、execution='service'、activateNewBundles/timeout；它没有PA grant或逐目标效果门。

选定P不是改Host Core，也不是“以后想办法”：Team `governed-families/plugin.mjs`为八action唯一owned adapter；复用现有plugin manager及其Host公开manifest/compatibility/registry解析语义，仅做必要adapter接线；不为本family新增受控执行器/activation引擎（USER_SCOPE_CLARIFIED：不为获准插件初始化代码建通用沙箱）。流程阶段如实声明：已批准范围内的resolve/check→Host既有脚本审批通道(approvedBuilds/版本豁免)→校验安装清单→配置提交→activation（属既有manager行为面；下载/配置效果按既有要求如实声明，不称初始化沙箱、不称全部插件自动可信）。每步携本次不可变context和当前signal；不将grant放进环境变量，不用全局currentGrant，不另造授权账本。脚本执行走Host既有approvedBuilds/版本豁免审批语义，不另造约束引擎；profile文件通过受控FS写，保留原锁/兼容性/版本豁免/approvedBuilds语义。已有Host cancel/wait语义作为结果兼容目标；Team adapter接线必须维护真实阶段事实，applying后取消报too-late，不伪称回滚。

**ACTIVATION-TCB → USER_SCOPE_CLARIFIED（2026-10-23，用户产品边界，Sentinel_e08e9aeed9e08191bd7208454dca9323）**：用户原文『DSH Agent能通过 plugin manager 自行安装插件吗？使用的是什么工具？要想约束各种初始化代码是不可能的。我们只要能够让 Agent 安装插件的行为受到管控即可。』据此：Alpha5治理plugin_manager安装/启禁/移除等管理调用，**不做获准插件初始化代码的通用沙箱**；保留Team tool/action/target授权、参数绑定/单次/撤销；保留Host既有脚本/版本豁免审批；**Host full-access不得跳过Team准入**；不扩调用权限、不批准具体安装（具体安装逐次走Team授权）。原OPEN叙述（Sentinel_5606c190ded88191a4d9bd9990fda52e待裁，ACTIVATION-TCB=OPEN，含『不选可信插件例外/默认完整保证』口径）保留为历史；不再为此新增受控installer/activation引擎，复用现有manager仅必要adapter接线。本family保留安装/启禁/移除管理面功能义务与如实效果声明。

E事务事实（非可调用private API）：Host plugin-manager/src/index.ts:715 selectBundle、:756 configure、:762 reload、:767 change均private；change:772使用withFileLock(profile/package.json)，configure在该阶段使用hmr.runExclusive，reload调用公开boot reconcileProfilePatches/readProfilePatches。公开setBundleEnabled:443会自行进入change/configure，不能在已持同profile锁时再次调用造成重入。P实现约束（USER_SCOPE_CLARIFIED修订）：原『受控installer必须…』P义务随installer新增要求的撤回而撤回为历史（见上段，与index record 52一致）；对调用manager写路径的adapter接线，锁事实仍是硬约束——与现profile共享同一文件锁协议、固定文件锁→HMR提交次序、锁内重核profile版本与批准包字节/依赖/入口、避免反向取锁及private方法调用。可评估公开atomic-write/boot/HMR接点，但此处只列事实和约束，不提前决定批准语义或将mask当初始化I/O拦截器。

owner PLUGIN独占插件family的adapter接线与插件族内文件（USER_SCOPE_CLARIFIED修订：原『PLUGIN独占新增installer』义务撤回为历史；插件面复用现有manager），CENTER独占注册代际。与Host原流程共享的业务语义须用8action正控及失败恢复差异测试，不能只复制happy path。『固定源码没有现成受控installer』一句保留为历史事实描述，不再构成P义务依据。

### 5.4 Team十五工具：精确复用口已落位

E `packages/tools/src/tools.ts:1524 createTeamTools(options)`列全15spec，:430+ makeDefinition先resolveToolCaller并核callerRoot==requestedRoot，再spec.run；P插入A不能跳过这些业务校验。
- team_list_members/list_templates/inspect_config/create_member/delegate/follow_up/collect/archive_member：同文件:366 performRuntimeAction → options.teamRuntime.performAction；对应spec行498/520/542/572/614/710/772/1197。collect是WORK_STATUS只读，不因母表eff误标durable-write而制造新写效果；delegate/followup async缺省是异步admit，不能把admitted当settled。
- team_send_message：:840 options.messaging.sendTeamMessage；team_report_progress：:899 activity，:917 recordProgress，现最多一次stale-sequence retry，须同一已批准业务请求，不能再次消费A。
- team_request_control：:1000 controlService.requestControl；resolve：:1065 escalateApprovalLeg或:1073 resolveControl；list_pending：:1163 listControlState+:1164 listOpenApprovalCases。
- grant/revoke：permissionSpec:1370；先leader检查，再permission.canonicalizeExecIntent/canonicalizeFile，:1484 mutatePermission。服务端canonicalization与双ceiling保留，mutatePermission规则集合相等才no-op，不虚构mutationId去重账本。
P最小接线：CENTER为这15个精确definition建binding，并在它们进入spec.run前用同一A；CONTROL只拆出纯目标分类/manifest，不重写上述业务service。可能有I之外真实FS读取的canonicalization不能提前到纯classify。CONTROL与AUTH明确检查executeGuarded现业务Control门与A的effect-set消费不会指向同一request二次consume；既有业务guard保持独立作用域，A绝不拿“no-request”当自己的许可。没有同名/前缀自信任，也没有第二Team权限层。

### 5.5 Stagehand与其他动态面：合同可定，不强行变产品

E Stagehand native.ts:94 openNativeBrowser，:106–151六method；act仍单instruction，observe/extract会发模型；返回screenshot的是image base64，持久attachment由上游结果适配链负责，不把native.ts本身说成直接写durable store。E index.ts:197+资源hook可能先启动浏览器，故P own adapter不透传该pre-effect hook：Team持有独立BrowserResource lease，在A Prepare后建profile/连接、消费后调用执行；所有launch/attach首次准备效果须入获批范围。

P `governed-families/browser.mjs` + `browser-use/governed-native-provider.ts`固定CDP target、允许origin/network和模型provider；导航/redirect/子资源流量在实际网络/target边界受限，CDP连接和模型request不是靠字符串前缀放行。attached浏览器不得靠独占DSH reservation假设人类停止操作；执行前及后续目标变更核incarnation/origin，不能证明时stale停止。取消只断本call/本Agent持有连接，不能误杀用户整个browser。自然语言act保持原API，已有具体Domain业务gate按真实边界执行；没有这种gate不凭空发明普适业务规则层（ADR:75明禁）。

MCP、外部subagent、PTC同理：合同采用现有provider/transport/child工厂接点与CENTER统一A，具体实例assurance、schema、endpoint、child治理能力作为安装时严格证据输入；缺证据阻本实例，不把未收集运行快照当整个family合同unknown。C2随后各实际声明安装配置都要覆盖，不用一个样例替全部部署。

### 5.6 剩余技术裁决（不是重新开scope）

1. 中心是否采纳上述新增Team-only adapters与A targetManifest严格扩展；插件面按USER_SCOPE_CLARIFIED口径执行；具体安装批准仍逐次走Team授权，不被采纳语句默认为通过。它们是有限实施合同，不要求新增service-target、Host Core补丁或新授权ledger。
2. 具体声明provider若要求任意不可信Host插件即时加载、无法限制的PTY环境、不能保证目标边界的attached browser，须报该实例的确切assurance不足及可替代provider。是否接纳更强trusted TCB假设必须显式裁定；不得用Team审批提高实际保证，也不得把这些实例默默永久排除。现在没有证据证明所有此类family必需Core patch。
3. 本件没有C1 checker/编译或C2/C3执行证据；这是后续验收状态，不是接口设计留空。27family目标路线与93记录义务均已定义，不能据索引覆盖宣布已实现/可冻结。冻结仍需中心核合同一致性（特别A分段与业务guard作用域）、分配单writer并核每个新增口的有限静态实现计划。

## 6. 精确源锚及本轮新核对

本轮亲读固定Team：packages/domain/tool-governance/src/effects.ts:43–136（Git blob 82266cf169ee7034b6924376db94a33a077bbae2），resource.ts:40–150（blob d06aa8d10cd086ba955ab03444713d26178d0aa1）；本地固定 approval-case.ts:81–90、269、466；admission-kernel.ts:942–946及1078+；binding.ts:56+；interfaces.ts:49+、ControlledFs与ProviderGateway。
本轮亲读固定Host：packages/terminal/terminal/src/index.ts:125,154,243,285与types.ts:148–172；packages/terminal/terminal-bash/src/index.ts:185–239；packages/boot/plugin-manager/src/index.ts:462–588,661与operations.ts:32–58,284；packages/experimental/browser-use-stagehand-native/src/native.ts:94–151；packages/terminal/tool-terminal/src/index.ts:164–285；packages/boot/plugin-manager/src/tools.ts:20–94；packages/mcp/mcp-resources/src/tools.ts:21–63；packages/experimental/browser-use-stagehand-native/src/index.ts:176–218。保留本地只读摘录于 m0-authority-facts（仅研究材料）。补读固定Host packages/lsp/tool-lsp/src/index.ts:110–123,183–194；补读固定Team packages/tools/src/tools.ts:430–490,498–1223,1370–1540；packages/runtime/sandbox-provider/lsp-assembly.ts:44–108,172–320。其余详细E2锚逐记录复制自v3c sourceEvidence，不能误称本轮亲证。
官方链接模板：Team https://github.com/ArmourPiercer1/dsh-agent-team/blob/9b2ee57bc5afd30e89855e09d1769d2e5ec83912/<path>#L<n>；Host https://github.com/ArmourPiercer1/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/<path>#L<n>。

## 7. v1.2有限修订审计
仅落实M0-B-FAMILY-LIMITED-CROSSCHECK前两项：PTY每open私有一次性backend闭包；LSP真实ready注入口、hardDimensions透传、清理未确认语义。插件补列private事务/HMR/公开接点事实与不可重入约束，ACTIVATION-TCB已USER_SCOPE_CLARIFIED（§5.3）。未修改产品、远端、公共Effects或执行任何Host/产品测试。
