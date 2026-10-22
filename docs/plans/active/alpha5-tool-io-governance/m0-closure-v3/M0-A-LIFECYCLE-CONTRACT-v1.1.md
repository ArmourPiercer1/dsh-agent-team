# M0-A 生命周期接口差量：单一有界候选

状态：中心选定合同候选 v1.1／PROPOSED，非已实现、未冻结。只读审阅固定 Team 9b2ee57bc5afd30e89855e09d1769d2e5ec83912、Host 639ed015397290b3745d163aafe02ffee4aa3f84 源摘录及 P2/P3/P4 最终审单；零产品修改、零测试。

## 1. 根可选定的方案

保留 PA 异步 admission、Alpha4 唯一 durable case/leg/decision/consumption 和 PA 既有 grant ledger。新增的只是中心调用关联与既有 Control 行的严格批量载荷，不建第三授权账本。

D2 选择**完整 manifest 内嵌现有 reviewPayload**，不选“只有指纹、内容另找”。manifest 完整记录不可变 RequestedEffectSet、PA 请求身份、批准时 provenance；摘要不能替代它。D3 保留 Host symbol、PA grantId、PA 逻辑问题 ID、Control case/request 四种不同身份，以可信 invocationCorrelation 关联。

all-allow：admitCall → admitted(grant) → Prepare → final recheck → PA consume → execute；无 Control 请求/批准/消费，无 planEffectSetApproval。

Ask：admitCall → planApproval → requestApprovalLeg → awaitControlDecision/合法 resolve → 可信 presenter → issueApprovedGrant（内部完整 verifyEffectSetApproval）→ guardOperation 真消费 → Prepare → final recheck → PA consume → execute。所有 Prepare 效果都位于完整批准和真 durable 消费之后。

## 2. 字段合同：存在不等于已接线

E=Existing；P=PROPOSED。P 字段名仅为本候选建议，不能对外写成现有导出 API。

| 字段／关系 | 状态、真实来源与严格含义 |
|---|---|
| hostExecutionToken | E 值：Host ToolExecution.token，branded symbol（host tools:319,393–397,1391+）。P 桥字段。只存本进程受信引用，不序列化、不叫 PA token、不从字符串重建。 |
| hostCallId / rootCallId | E：exec.callId / exec.rootCallId。rootCallId只关联树。P 桥分别保存；hostCallId不是不可伪造凭据。 |
| invocationCorrelation | P：中心为每个registry执行创建唯一不可模型选择的关联值，活跃表把它绑定到确切exec/token。持久化此字符串并不使它成为Bearer。重复进入同exec返回同关联；另一个exec即使同hostCallId也不得共享关联。 |
| PA request.callId | E 字段，P 取值映射：用上述中心唯一invocationCorrelation作为PA callId；原hostCallId另保留审计。避免仅依靠Host输入callId碰撞；须明确这是适配合同，不改PA字段类型。 |
| agentScopeKey | E：ToolBinding.agentScopeKey；P：从exec.agent及当前中心安装绑定验证等值。Host exec无scope字段，不臆造Host getScope API。 |
| member.teamSessionId / member.instanceId | E：AdmissionRequest.member。P：先验证可信durable Team/Member唯一归属，再验证exec.agent的安装binding及member.instanceId；root来自该归属，不是childSessionId，也不是两个自报字符串互相等值。接线核对锚：agent-bindings.mjs:3093/3110/5386/5411。与durable root/instance subject一致。 |
| realmId | E：AdmissionRequest.realmId / assembly.realmId。P：与当前provider、binding对应Realm及每个resource.realmId交叉校验。 |
| bindingId / revision | E：ToolBinding.bindingId / revision；PA grant含bindingId / bindingRevision。P：每次从当前中心placement/binding槽取，不以grant内旧revision代替当前值。 |
| definitionIdentity / providerId / status | E：ToolBinding相应字段；live placementFeed返回definitionIdentity、realmId。P：绑定当前placed wrapper及provider；status必须ACTIVE。typed placement helper存在不代表live已接线。 |
| policyGeneration / authorityGeneration | E：ToolBinding字段；PA配置有authorityGeneration()。P：中心政策更新/placement生命周期维护可信当前policy代际，与权威reader当前authority代际比较。Host tools/change无代际，只触发失效/重读。 |
| parametersFingerprint / requestedEffects | E：AdmissionRequest字段；requestedEffects含完整effects及fingerprint。P：纯分类一次生成并冻结，durable manifest保存完整值并重算digest。 |
| logicalQuestionId | P 桥名，E 值：planApproval().value.approvalCaseId，即现toolAskApprovalCaseId。保留跨call稳定规则；仍供PresentedApproval.approvalCaseId使用，不冒充Control ID。all-allow不为取得此值调用Ask planner。 |
| paGrant / paGrantId | E：OperationGrant及grantId，admitCall或issueApprovedGrant返回；不是Host symbol。保留member/callId/realmId/bindingId/bindingRevision/authorityGeneration/parametersFingerprint/effects/issuedAt/expiresAt。 |
| controlCaseId | E：requestApprovalLeg结果及readApprovalCaseState的派生case identity；P桥关联。不能用PA逻辑ID覆盖。 |
| controlRequestId / requestSequence | E：ControlRequestRecord.requestId / requestSequence。请求必须属于本invocation和当前leg。 |
| decisionSequence / decider / decision | E：ControlDecisionRecord字段；decision='allow'等真实词汇，不虚构approve_once或decisionId。decider来自durable记录及受信角色解析，不信任模型提供的reviewerAuthority。 |
| durable consumption proof | E：guardOperation返回allowed:true,requestId,decisionSequence；listControlState().consumptions有requestId,decisionSequence,scope,consumedAt。**没有现成consumptionId字段**。关联键用root+requestId+decisionSequence；消费回包不确定时先读真实行，不重消费/不执行。 |
| invocationPhase | P：中心短生命周期执行状态，控制单飞及终态，不能自行授予权限。权限事实仍只来自PA及Control。重启不恢复symbol、PA grant或prepared plan。 |

## 3. D2/D3最小必要接口差量与Owner

| 接口／字段 | Existing → PROPOSED差量；唯一Owner |
|---|---|
| requestApprovalLeg(input) | E types:1848、service:4449，无reviewPayload。P新增reviewPayload/reviewPayloadDigest透传到其内部现requestControl；本effect-set类别必须有完整、严格解析的manifest及一致digest。普通旧类别维持兼容。保留类别坏/缺manifest或digest必须作为可阻断的损坏事实保留，不得由reader略过后变成no-request自治放行。Owner：Control接口writer，中心owner审批共享合同。 |
| manifest v1 | P载荷字段：version、invocationCorrelation、hostCallId、完整AdmissionRequest快照（binding/member/callId/realmId/parametersFingerprint/requestedEffects）、logicalQuestionId、beneficiaryAuthority、requiredAuthorityAtCreation、deniedEffectsAtCreation。不放Host symbol、密钥、裸可重放grant；per-effect required可供显示但必须重算。 |
| Control identity/scope | E rootSessionId、subject、actionName、toolName、capabilityDomain、correlation、operationFingerprint、authorityScope。P映射：root=member.teamSessionId；subject=受益instance；correlation=invocationCorrelation；operationFingerprint=规范化完整manifest digest；authorityScope={operationClass:'tool-effect-set',matcher:{kind:'fingerprint',resource:同digest}}。'tool-effect-set'是**拟议保留operationClass判别值**，当前scope parser允许该字符串形状（types:807–837；service:903–913/1564–1567），不是新的ControlRequestKind（service:2162闭集）。继续使用既有kind、beneficiary/requestedEffect闭集与guarded coupling；保留类别强制strict manifest及resolve/guard专属分派，不能旧单scope fallback，也不能把聚合Envelope规则当全Effects批准。 |
| durable读写/升梯 | E requestControl已有reviewPayload/digest，request记录可读。P验证payload完整值与digest，而非只检查字符串；case各leg必须携同一manifest/digest；escalate/terminal-create/strict parser/read projection要传承并校验，不允许后续leg丢载荷。decision与consumption通过scope.operationFingerprint及requestId精确绑定原manifest，无需复制新账本。 |
| resolveControl | E service:2500附近角色/权限/外部硬顶及durable提交。P在allow提交前、同Team锁中，对保留类别调用新的受信批量验证port；输入**durable manifest + 实际解析的decider权威位置 + 当前权威事实**。复用PA纯plan/provenance及verifyEffectSetApproval；port必须只读，不mint、不consume、不重入Control同Team锁（resolve:2537、guard:3167；不可重入纪律:5079）。不得在port内调用issueApprovedGrant、resolveControl或guardOperation。任一失败不得写allow。deny不要求批准证明。不是把自由reviewPayload自动提升为权威。 |
| ControlAuthorityRecheckInput/port | E types:864+；当前仅单authorityScope、commandFingerprint、row reviewAuthority等；service:3014+在guard锁内调用。P对本类别增加完整已验证manifest及durable decision的真实decider信息；重复同一只读、无mint/consume、无Control同Team锁重入的全Effects验证器。旧单scope分支不动；保留类别坏/缺manifest、digest、port或真实reviewer映射一律拒，不能fallback到单聚合scope。锁外异步读取的facts必须在提交/消费前重核代际；Team锁不代表所有上游事实变化也被原子锁住。Owner：Control writer+PA验证逻辑writer；中心负责可信facts接线。 |
| trusted presenter | P中心内部函数，不冒称completePresentedApproval现API。先读readApprovalCaseState+listControlState，检查当前leg、allow、未abandon、manifest/correlation/完整调用身份，导出PA PresentedApproval；其approvalCaseId仍为PA logicalQuestionId，reviewerAuthority来自真实decider，deniedEffectsAtCreation来自已批manifest。随后在Control锁外独立调用E issueApprovedGrant进行PA mint；其内部E verifyEffectSetApproval与deny provenance重核不省略。 |
| guardOperation(scope) | E types:1662/service:3086+，真实一次性消费入口；P调用接线使用上面**完整相同**scope，allowed:false任何reason均不进入Prepare，no-request也不例外。E返回无消费序号字段，不编造。保留guarded；不改成inline绕消费。 |
| final fresh validation | E consumeForExecution只验证传入call fields并消费ledger，不等于自动重读全部Host binding/当前policy。P中心新fresh-validation步骤，必要时PA提取一个**不mint、不consume**的内部校验入口：重用identity/assurance/expansion、Ask的verify及deny provenance逻辑；all-allow必须仍全集allow，若新需Ask则stale终止，不续开Ask。所有异步等待后重新比较当前binding/definition/两代际及signal，再同步consume并进入owned wrapper。Owner：中心/PA，不改Host Core。 |

Effects→authority使用现effectApprovalScope逐项映射：tool-invoke→realm|tool:name；domain-ref→realm|domain:id；resource效果→resource.realmId|canonicalLocator。保留原effect.kind及matcher，最高rung仅路由reviewer，不代替每项覆盖；domain-ref标识本身不证明远端已允许，实际Domain Gate仍可拒。Preparation scratch/probe的完整有限资源范围也须进入effects或可验证provider准备能力范围，不能先探测再决定要申请什么。

明确的现接口不足：仅把完整payload传给当前requestApprovalLeg尚不成立；当前resolve/消费recheck不会据该payload做全Effects验证，必须实施上述透传、严格持久化、真实reviewer及验证port差量。现有接口也不提供把Host symbol序列化冷恢复的能力，本方案不要求它。上述均是明确的Team侧补口，不是声称全仓不存在其他帮助接口。

## 4. 可验证状态转移与失败含义

| 状态边 | 必须成立的事实；失败后准确状态 |
|---|---|
| RECEIVED→CLASSIFIED | registry token/exec受信、当前ACTIVE binding、纯解析完成、全部Effects确定；否则REJECTED，零Prepare/Body。 |
| CLASSIFIED→ALL_ADMITTED | E admitCall中identity+assurance+全集expansion成功，mint恰一次。没有needApproval时不得调用planApproval/planEffectSetApproval，不生成Control行。 |
| CLASSIFIED→ASK_WAIT | E admitCall要求审批，planApproval成功；P完整manifest经requestApprovalLeg落既有Control行。一call多Effects共一case，升梯可多leg；同组其他call不能继承此行。pending时Prepare=0、Body=0。 |
| ASK_WAIT→ASK_VERIFIED | 当前leg真实allow；完整presenter验证；issueApprovedGrant成功。其内部verifyEffectSetApproval必须成功，不以max rank、F-1逻辑ID校验或wait结果代替。 |
| ASK_VERIFIED→ASK_RESERVED | guardOperation准确scope返回allowed:true；核对requestId/decisionSequence。external hard veto、当前权威失败、abandon、已消费均阻断。 |
| ALL_ADMITTED或ASK_RESERVED→PREPARING | 中心原子单飞转移；同exec第二入口只能等同一结果或拒绝，不能再次Prepare。再次核signal及当前身份；Ask另要求真实消费凭据。Prepare可产生已授权scratch/probe效果。 |
| PREPARING→PREPARED / PREPARE_FAILED | 失败可能已产生准备效果，Body=0；清理仅本call资源。调用终态不可重进。Ask durable许可可能已消费；PA grant通常**尚未消费**，不可谎报ledger burned。 |
| PREPARED→DISPATCHED | 所有fresh checks成功；E consumeForExecution使用当前authorityGeneration、member、PA callId、realmId、bindingId、**当前**bindingRevision、parametersFingerprint、完整requestedEffects、cancelRequested；成功后才调用稳定owned definition/provider。已有createFsAdmissionPort会消费，迁移时不得再消费第二次。 |
| PA消费成功但打开lease失败→LEASE_UNCONFIRMED | E admission-kernel:608–623：ledger已消费，但lease创建失败，返回EXECUTION_TERMINATION_UNCONFIRMED；不启动Body、不伪造成功、不退款。Control是否已消费按实际分支记录，不能统一标PA unconsumed。 |
| PREPARED→STALE/CANCELLED | 无Body，无自动再规划/缩scope/退款/重放；已产生的Prepare效果如实记录。只有取消先于PA消费时E内核:582–597明确零ledger变化；不得外推所有失败均未消费。 |
| DISPATCHED→SETTLED/UNCONFIRMED | 使用E PA lease requestCancellation/settleTermination及runtime provider对应方法，显式映射两类lease。cancel请求或exited不自动证明资源释放；recordCapable无recorded payloadExit不得当成功。 |
| 进程重启/冷恢复 | 不重建旧symbol、不导入旧PA grant、不自动执行已批准/已消费case。旧durable行继续可审计；旧pending按既有授权关闭/展示，不能靠新call认领。新执行使用新invocation、新准入，Ask需新独立批准。既有后台job/lease只按可信owner与provider证据恢复观察，不重新spawn。 |

“烧掉权限”的准确拆分：invocation终态不可重用 ≠ PA ledger已消费 ≠ Control allow已消费。机器件须分别记录invocationPhase、controlConsumption（Ask才有）、paConsumption，不以burned:true代替真实关系。本方案通过唯一中心调用状态、grant不外泄及冷恢复不重铸，禁止失败调用重新进入；**不要求伪造消费来销毁grant**。若未来要求在PA ledger新增revoked终态，另列真实API差量，不能冒称现已有burn/revoke。

并发与不确定结果：单飞在任何await前建立；guard两竞争者仅一者能消费，但中心还须阻止获批者重复Prepare。Control消费回包丢失且当前执行进度不明时，读行只用于确认事实，不据此恢复执行；保持UNKNOWN/不执行。两个账本无共同事务，失败可能花掉Control许可而没有PA消费，允许损失，不允许补发重跑。动态更新在最终同步复核后由中心同一生命周期调度约束，所调必须是owned稳定wrapper；无法证明该边界的特殊工具维持具名blocker，不借Host重新resolve静默切换到原生body。

## 5. 安全词义与裁决限界

可归属的ordinary policy deny可以依法升梯；PA plan保留来源owner/version及deny effect pairs。无归属/版本漂移/超最高owner/undetermined按现精确拒绝处理。external hard veto、provider保证不足、Domain Gate deny不可由Team审批覆盖。不能让PB的旧“任意deny”提前吞掉现应升梯的policy deny；其补充否决必须有明确hard/stale等依据，不能独立allow。

上述新增字段、port与映射是中心技术合同差量；不降低既有安全要求、不删必交scope、不改Alpha4层级及guarded一次性语义。该方案可交writer按此收口D2/D3，不能据此宣布现成实现、C2通过或M0冻结。

源锚（相对固定Team ref；Host另列）：
- packages/runtime/tool-admission/admission-kernel.ts：admit约400–466；issueApprovedGrant468–578；consume582–626；assembly997–1140。
- packages/runtime/tool-admission/approval-case.ts：effectApprovalScope；toolAskApprovalCaseId；planEffectSetApproval；verifyEffectSetApproval。
- packages/runtime/control/types.ts：ControlAuthorityRecheckInput864+；ControlOperationScope947+；ControlRequestRecord1022+；Decision1150附近；Consumption1179+；guardOperation1662；requestApprovalLeg1848。
- packages/runtime/control/service.ts：requestControl2134+；resolveControl2500附近；recheckConsumedAuthority3014；guardOperation3086；durable consumption写入约3430；requestApprovalLeg4449。
- packages/domain/tool-governance/src/binding.ts:56；interfaces.ts:49；runtime/sandbox-provider/provider.ts:74,112,569,646,832,861。
- Host packages/core/tools/src/index.ts:319,326–350,393–397,1136,1391–1419,1493–1540,1564–1581。
