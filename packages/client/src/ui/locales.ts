/** Team UI locale dictionaries. */

export type TeamKey =
  | 'nav'
  | 'title'
  | 'empty.title'
  | 'empty.description'
  | 'empty.step1'
  | 'empty.step2'
  | 'empty.step3'
  | 'member.leader'
  | 'member.teammate'
  | 'field.model'
  | 'field.tools'
  | 'field.mcp'
  | 'field.context'
  | 'view.team'
  | 'view.zero'
  | 'view.timeline.title'
  | 'view.timeline.empty'
  | 'view.timeline.aria'
  | 'view.timeline.running'
  | 'view.members.title'
  | 'view.members.active'
  | 'view.members.created'
  | 'view.members.running'
  | 'view.members.settled'
  | 'view.members.archived'
  | 'view.members.disposed'
  | 'view.members.noInstances'
  | 'view.members.action.empty'
  | 'view.members.waiting'
  | 'view.activity.title'
  | 'view.activity.empty'
  | 'view.activity.member'
  | 'view.activity.in_progress'
  | 'view.activity.completed'
  | 'view.activity.blocked'
  | 'view.ledger.title'
  | 'view.ledger.empty'
  | 'view.ledger.loading'
  | 'view.ledger.remaining'
  | 'view.ledger.retry'
  | 'view.ledger.loadEarlier'
  | 'view.ledger.loadFailed'
  | 'view.ledger.pending'
  | 'view.ledger.filter.all'
  | 'view.ledger.filter.team'
  | 'view.ledger.filter.members'
  | 'view.ledger.filter.lifecycle'
  | 'view.ledger.filter.messages'
  | 'view.ledger.filter.controls'
  | 'view.ledger.filter.policy'
  | 'view.ledger.filter.compatibility'
  | 'view.ledger.filter.progress'
  | 'view.ledger.fact.work_admitted'
  | 'view.ledger.fact.member_created'
  | 'view.ledger.fact.lifecycle'
  | 'view.ledger.fact.message'
  | 'view.ledger.fact.control_request'
  | 'view.ledger.fact.control_decision'
  | 'view.ledger.fact.control_consumed'
  | 'view.ledger.fact.progress'
  | 'view.ledger.fact.interval_opened'
  | 'view.ledger.fact.interval_closed'
  | 'view.ledger.fact.policy'
  | 'view.ledger.decision.allow'
  | 'view.ledger.decision.deny'
  | 'view.ledger.decision.stale_denied'
  | 'intent.startHere'
  | 'intent.title'
  | 'intent.blueprint'
  | 'intent.blueprint.placeholder'
  | 'intent.blueprint.loading'
  | 'intent.blueprint.error'
  | 'intent.blueprint.empty'
  | 'intent.revision'
  | 'intent.workspace'
  | 'intent.workspace.placeholder'
  | 'intent.preset'
  | 'intent.preset.hint'
  | 'intent.initialWork'
  | 'intent.initialWork.placeholder'
  | 'intent.compatibility'
  | 'intent.compatibility.checking'
  | 'intent.compatibility.ready'
  | 'intent.compatibility.degraded'
  | 'intent.compatibility.fatal'
  | 'intent.compatibility.unknown'
  | 'intent.compatibility.owner'
  | 'intent.compatibility.subjects'
  | 'intent.ack'
  | 'intent.create'
  | 'intent.createAndSend'
  | 'intent.acknowledge'
  | 'intent.creating'
  | 'intent.error'
  | 'intent.retry'
  | 'intent.cancel'
  | 'intent.rootKept'
  | 'intent.fatal.preset'
  | 'member.action.sendWork'
  | 'member.action.followup'
  | 'member.action.resume'
  | 'member.action.message'
  | 'member.action.archive'
  | 'member.action.restore'
  | 'member.action.dispose'
  | 'member.action.create'
  | 'member.command.pending'
  | 'member.command.error'
  | 'member.create.title'
  | 'member.create.template'
  | 'member.create.label'
  | 'member.create.label.placeholder'
  | 'member.create.group'
  | 'member.create.workspace'
  | 'member.create.fresh'
  | 'member.create.submit'
  | 'member.create.cancel'
  | 'member.send.title'
  | 'member.send.prompt'
  | 'member.send.prompt.placeholder'
  | 'member.send.submit'
  | 'member.send.cancel'
  | 'member.message.title'
  | 'member.message.subject'
  | 'member.message.body'
  | 'member.message.body.placeholder'
  | 'member.message.submit'
  | 'member.message.cancel'
  | 'member.archive.title'
  | 'member.archive.running'
  | 'member.archive.plain'
  | 'member.archive.confirm'
  | 'member.archive.cancel'
  | 'member.dispose.title'
  | 'member.dispose.body'
  | 'member.dispose.confirm'
  | 'member.dispose.cancel'
  | 'dock.title'
  | 'dock.running'
  | 'dock.pending'
  | 'dock.jump'
  | 'dock.expand'
  | 'dock.collapse'
  | 'dock.members.empty'
  | 'dock.activities.empty'
  | 'marker.progress'
  | 'marker.decision'
  // P9-T8 (S5-C/S5-D): governance surfaces + handoff + legacy zero-state.
  | 'governance.compatibility'
  | 'governance.title'
  | 'governance.compatibility.badge.pass'
  | 'governance.compatibility.badge.degraded'
  | 'governance.compatibility.badge.actionRequired'
  | 'governance.compatibility.badge.fatal'
  | 'governance.compatibility.counts'
  | 'governance.compatibility.generation'
  | 'governance.compatibility.probed'
  | 'governance.compatibility.freshRead'
  | 'governance.compatibility.readCounts'
  | 'governance.compatibility.review'
  | 'governance.compatibility.recheck'
  | 'governance.compatibility.recheckHelp'
  | 'governance.compatibility.ack'
  | 'governance.compatibility.ackDisabled'
  | 'governance.policy.header'
  | 'governance.policy.help'
  | 'governance.policy.review'
  | 'governance.policy.commit'
  | 'governance.policy.preview'
  | 'governance.policy.cell.locked'
  | 'governance.policy.entry.none'
  | 'governance.policy.entry.allow'
  | 'governance.policy.entry.deny'
  | 'governance.policy.items'
  | 'governance.effectiveConfig'
  | 'governance.effectiveConfig.empty'
  | 'governance.lane.suppressed'
  | 'governance.lane.unavailable'
  | 'governance.lane.effectiveFrom'
  | 'governance.hardPolicy'
  | 'governance.override.show'
  | 'governance.override.set'
  | 'governance.override.reset'
  | 'governance.override.none'
  | 'governance.override.reading'
  | 'governance.reading'
  | 'governance.pending'
  | 'governance.error'
  | 'handoff.title'
  | 'handoff.source'
  | 'handoff.generate'
  | 'handoff.preparing'
  | 'handoff.ready'
  | 'handoff.preview'
  | 'handoff.failed'
  | 'handoff.retry'
  | 'handoff.continue'
  | 'handoff.cancel'
  | 'handoff.canceled'
  | 'handoff.provenance'
  | 'legacy.banner.line1'
  | 'legacy.banner.line2'
  | 'legacy.banner.line3'
  | 'legacy.summary'
  | 'legacy.counts'
  | 'legacy.inspectError'

/** Simplified Chinese UI strings for every {@link TeamKey}. */
export const zh: Record<TeamKey, string> = {
  'nav': '团队',
  'title': '团队成员配置',
  'empty.title': '未配置团队成员',
  'empty.description': '在以下目录创建 Markdown 定义文件以配置团队成员：',
  'empty.step1': '全局：$DSH_HOME/teammates/*.md',
  'empty.step2': '项目级：.dsh/teammates/*.md',
  'empty.step3': '需要恰好一个 role: leader 的定义',
  'member.leader': '领导者',
  'member.teammate': '队员',
  'field.model': '模型',
  'field.tools': '工具',
  'field.mcp': 'MCP 服务器',
  'field.context': '上下文策略',
  'view.team': '团队',
  'view.zero': '当前会话未加入任何团队',
  'view.timeline.title': '时间线',
  'view.timeline.empty': '暂无委派记录',
  'view.timeline.aria': '团队委派时间线：滚轮缩放，拖拽平移，方向键平移，按 0 复位',
  'view.timeline.running': '进行中',
  'view.members.title': '成员组',
  'view.members.active': '{count} 活跃',
  'view.members.created': '已创建',
  'view.members.running': '运行中',
  'view.members.settled': '已结算',
  'view.members.archived': '已归档',
  'view.members.disposed': '已处置',
  'view.members.noInstances': '尚无实例',
  'view.members.action.empty': '暂无动作',
  'view.members.waiting': '{count} 项待裁决',
  'view.activity.title': '活动与进度',
  'view.activity.empty': '暂无活动进度',
  'view.activity.member': '负责人 {member}',
  'view.activity.in_progress': '进行中',
  'view.activity.completed': '已完成',
  'view.activity.blocked': '受阻',
  'view.ledger.title': '团队事件',
  'view.ledger.empty': '暂无团队事件',
  'view.ledger.loading': '正在加载团队事件…',
  'view.ledger.remaining': '还有 {count} 条事件未加载',
  'view.ledger.retry': '重试',
  'view.ledger.loadEarlier': '加载更早',
  'view.ledger.loadFailed': '事件加载失败：{message}',
  'view.ledger.pending': '等待裁决',
  'view.ledger.filter.all': '全部',
  'view.ledger.filter.team': '团队',
  'view.ledger.filter.members': '成员',
  'view.ledger.filter.lifecycle': '生命周期',
  'view.ledger.filter.messages': '消息',
  'view.ledger.filter.controls': '控制',
  'view.ledger.filter.policy': '策略',
  'view.ledger.filter.compatibility': '兼容',
  'view.ledger.filter.progress': '进度',
  'view.ledger.fact.work_admitted': '工作准入',
  'view.ledger.fact.member_created': '成员创建',
  'view.ledger.fact.lifecycle': '生命周期',
  'view.ledger.fact.message': '消息',
  'view.ledger.fact.control_request': '控制请求',
  'view.ledger.fact.control_decision': '控制裁决',
  'view.ledger.fact.control_consumed': '裁决消费',
  'view.ledger.fact.progress': '进度',
  'view.ledger.fact.interval_opened': '活动开始',
  'view.ledger.fact.interval_closed': '活动结束',
  'view.ledger.fact.policy': '策略变更',
  'view.ledger.decision.allow': '允许',
  'view.ledger.decision.deny': '拒绝',
  'view.ledger.decision.stale_denied': '过期拒绝',
  'intent.startHere': '从此处开始团队',
  'intent.title': '新建团队',
  'intent.blueprint': '团队蓝图',
  'intent.blueprint.placeholder': '选择蓝图…',
  'intent.blueprint.loading': '正在加载蓝图目录…',
  'intent.blueprint.error': '蓝图目录加载失败：{message}',
  'intent.blueprint.empty': '没有可用蓝图',
  'intent.revision': '修订',
  'intent.workspace': '默认工作区',
  'intent.workspace.placeholder': '(未选择)',
  'intent.preset': '运行时预设',
  'intent.preset.hint': '选择团队运行的 Agent 预设；切换会重新运行兼容性检查。',
  'intent.initialWork': '初始任务（可选）',
  'intent.initialWork.placeholder': '交给 Leader 的初始任务…',
  'intent.compatibility': '兼容性',
  'intent.compatibility.checking': '正在检查兼容性…',
  'intent.compatibility.ready': '✓ 就绪',
  'intent.compatibility.degraded': '已按确认降级运行',
  'intent.compatibility.fatal': '✕ 团队无法创建',
  'intent.compatibility.unknown': '兼容性结果无法识别：{message}',
  'intent.compatibility.owner': '需求',
  'intent.compatibility.subjects': '不可用',
  'intent.ack': '我已了解上述降级，继续创建',
  'intent.create': '创建团队',
  'intent.createAndSend': '创建并发送',
  'intent.acknowledge': '确认警告并创建',
  'intent.creating': '正在创建…',
  'intent.error': '创建失败：{message}',
  'intent.retry': '重试',
  'intent.cancel': '取消',
  'intent.rootKept': 'Root 会话已创建；团队创建失败，可重试（会话保留）。',
  'intent.fatal.preset': '该运行时预设拥有完整的系统人格，无法承载此团队蓝图的 Leader/Member 身份（不改变 DSH 核心语义）。',
  'member.action.sendWork': '发送任务…',
  'member.action.followup': '发送跟进',
  'member.action.resume': '恢复…',
  'member.action.message': '发送消息…',
  'member.action.archive': '归档',
  'member.action.restore': '恢复',
  'member.action.dispose': '处置',
  'member.action.create': '创建成员实例',
  'member.command.pending': '处理中…',
  'member.command.error': '命令失败：{code} {message}',
  'member.create.title': '创建成员实例',
  'member.create.template': '模板',
  'member.create.label': '标签',
  'member.create.label.placeholder': '例如：研究员-1',
  'member.create.group': '分组（可选）',
  'member.create.workspace': '工作区（可选）',
  'member.create.fresh': '新的委派会创建新实例。',
  'member.create.submit': '创建',
  'member.create.cancel': '取消',
  'member.send.title': '向 {member} 发送任务',
  'member.send.prompt': '任务内容',
  'member.send.prompt.placeholder': '描述要交给该成员的工作…',
  'member.send.submit': '发送',
  'member.send.cancel': '取消',
  'member.message.title': '给 {member} 发消息',
  'member.message.subject': '主题（可选）',
  'member.message.body': '消息内容',
  'member.message.body.placeholder': '消息正文…',
  'member.message.submit': '发送消息',
  'member.message.cancel': '取消',
  'member.archive.title': '归档该成员？',
  'member.archive.running': '该成员正在运行。归档将停止当前工作，并在归档前排空其驻留子成员。',
  'member.archive.plain': '归档后，该成员将不再接收新的团队任务，直到恢复。',
  'member.archive.confirm': '归档',
  'member.archive.cancel': '取消',
  'member.dispose.title': '处置该成员？',
  'member.dispose.body': '该成员无法再恢复或接收新的团队任务。其会话历史、Chat、Trajectory 与团队审计历史将保留。',
  'member.dispose.confirm': '处置',
  'member.dispose.cancel': '取消',
  'dock.title': '团队',
  'dock.running': '{count} 运行中',
  'dock.pending': '{count} 待裁决',
  'dock.jump': '打开团队标签页',
  'dock.expand': '展开团队概览',
  'dock.collapse': '收起团队概览',
  'dock.members.empty': '暂无成员状态',
  'dock.activities.empty': '暂无活动进度',
  'marker.progress': '进度',
  'marker.decision': '裁决',
  'governance.compatibility': '兼容性',
  'governance.title': '治理',
  'governance.compatibility.badge.pass': '✓ 兼容',
  'governance.compatibility.badge.degraded': '⚠ 降级',
  'governance.compatibility.badge.actionRequired': '⚠ 需要处理',
  'governance.compatibility.badge.fatal': '✕ 结构性错误',
  'governance.compatibility.counts': '{warning} 项警告 · {fatal} 项致命 · {acknowledged} 项已确认',
  'governance.compatibility.generation': '代数 {generation}',
  'governance.compatibility.probed': '最后探测于 {at}',
  'governance.compatibility.freshRead': '最新兼容性读取',
  'governance.compatibility.readCounts': '{pass} 项通过 · {warning} 项警告 · {fatal} 项致命 · {unacked} 项未确认警告 · {stale} 项过期确认',
  'governance.compatibility.review': '审查',
  'governance.compatibility.recheck': '重新检查',
  'governance.compatibility.recheckHelp': '重新检查会生成新的兼容性代数；旧的确认不会自动覆盖新代数。',
  'governance.compatibility.ack': '确认警告',
  'governance.compatibility.ackDisabled': '兼容汇总只暴露聚合计数，未暴露逐项确认标识；无法逐项确认。',
  'governance.policy.header': '策略 [ {state} ]',
  'governance.policy.help': '策略控制团队当前的运行时治理范围，不代表任务进度。',
  'governance.policy.review': '审查',
  'governance.policy.commit': '提交',
  'governance.policy.preview': '将提交：{capabilities}',
  'governance.policy.cell.locked': '已锁定',
  'governance.policy.entry.none': '未设置',
  'governance.policy.entry.allow': '允许',
  'governance.policy.entry.deny': '拒绝',
  'governance.policy.items': '条目',
  'governance.effectiveConfig': '生效配置',
  'governance.effectiveConfig.empty': '该成员暂无生效配置数据',
  'governance.lane.suppressed': '已抑制',
  'governance.lane.unavailable': '不可用',
  'governance.lane.effectiveFrom': '自 {step} 生效',
  'governance.hardPolicy': '请求：{requested} / 生效：{effective} / 原因：{reason}',
  'governance.override.show': '查看覆盖',
  'governance.override.set': '设置覆盖',
  'governance.override.reset': '重置覆盖',
  'governance.override.none': '无显式人工覆盖',
  'governance.override.reading': '正在读取覆盖…',
  'governance.reading': '正在读取…',
  'governance.pending': '处理中…',
  'governance.error': '错误：{message}',
  'handoff.title': '上下文交接',
  'handoff.source': '源会话："{id}"',
  'handoff.generate': '生成一次性摘要',
  'handoff.preparing': '正在生成摘要…',
  'handoff.ready': '摘要已就绪',
  'handoff.preview': '预览',
  'handoff.failed': '上下文交接失败：{message}',
  'handoff.retry': '重试',
  'handoff.continue': '不带交接继续',
  'handoff.cancel': '取消',
  'handoff.canceled': '交接已取消',
  'handoff.provenance': '源自会话：{id}',
  'legacy.banner.line1': '本会话由旧版 Team 实现创建。',
  'legacy.banner.line2': 'Team vNext 不会将其作为 vNext 团队恢复或变更。',
  'legacy.banner.line3': '历史 Chat 与 Trajectory 仍可访问。',
  'legacy.summary': '已解码的旧版团队摘要（只读）',
  'legacy.counts': '{roster} 名花名册成员 · {sessions} 个扫描会话',
  'legacy.inspectError': '旧版团队检查失败：{message}',
}

/** English UI strings for every {@link TeamKey}. */
export const en: Record<TeamKey, string> = {
  'nav': 'Team',
  'title': 'Team Member Configuration',
  'empty.title': 'No Team Members Configured',
  'empty.description': 'Create Markdown definition files in one of these directories:',
  'empty.step1': 'Global: $DSH_HOME/teammates/*.md',
  'empty.step2': 'Project: .dsh/teammates/*.md',
  'empty.step3': 'Exactly one definition must have role: leader',
  'member.leader': 'Leader',
  'member.teammate': 'Teammate',
  'field.model': 'Model',
  'field.tools': 'Tools',
  'field.mcp': 'MCP Servers',
  'field.context': 'Context Policy',
  'view.team': 'Team',
  'view.zero': 'This session is not part of a team',
  'view.timeline.title': 'Timeline',
  'view.timeline.empty': 'No delegations yet',
  'view.timeline.aria': 'Team delegation timeline: wheel to zoom, drag to pan, arrow keys to pan, press 0 to reset',
  'view.timeline.running': 'In progress',
  'view.members.title': 'Members',
  'view.members.active': '{count} active',
  'view.members.created': 'Created',
  'view.members.running': 'Running',
  'view.members.settled': 'Settled',
  'view.members.archived': 'Archived',
  'view.members.disposed': 'Disposed',
  'view.members.noInstances': 'No instances yet',
  'view.members.action.empty': 'No action yet',
  'view.members.waiting': '{count} pending',
  'view.activity.title': 'Activity & Progress',
  'view.activity.empty': 'No activity progress yet',
  'view.activity.member': 'Assignee {member}',
  'view.activity.in_progress': 'In progress',
  'view.activity.completed': 'Completed',
  'view.activity.blocked': 'Blocked',
  'view.ledger.title': 'Team events',
  'view.ledger.empty': 'No team events yet',
  'view.ledger.loading': 'Loading team events…',
  'view.ledger.remaining': '{count} event(s) not loaded yet',
  'view.ledger.retry': 'Retry',
  'view.ledger.loadEarlier': 'Load earlier',
  'view.ledger.loadFailed': 'Loading events failed: {message}',
  'view.ledger.pending': 'Pending decision',
  'view.ledger.filter.all': 'All',
  'view.ledger.filter.team': 'Team',
  'view.ledger.filter.members': 'Members',
  'view.ledger.filter.lifecycle': 'Lifecycle',
  'view.ledger.filter.messages': 'Messages',
  'view.ledger.filter.controls': 'Controls',
  'view.ledger.filter.policy': 'Policy',
  'view.ledger.filter.compatibility': 'Compatibility',
  'view.ledger.filter.progress': 'Progress',
  'view.ledger.fact.work_admitted': 'Work admitted',
  'view.ledger.fact.member_created': 'Member created',
  'view.ledger.fact.lifecycle': 'Lifecycle',
  'view.ledger.fact.message': 'Message',
  'view.ledger.fact.control_request': 'Control request',
  'view.ledger.fact.control_decision': 'Control decision',
  'view.ledger.fact.control_consumed': 'Decision consumed',
  'view.ledger.fact.progress': 'Progress',
  'view.ledger.fact.interval_opened': 'Interval opened',
  'view.ledger.fact.interval_closed': 'Interval closed',
  'view.ledger.fact.policy': 'Policy change',
  'view.ledger.decision.allow': 'Allowed',
  'view.ledger.decision.deny': 'Denied',
  'view.ledger.decision.stale_denied': 'Stale denied',
  'intent.startHere': 'Start Team from Here',
  'intent.title': 'New Team',
  'intent.blueprint': 'Team blueprint',
  'intent.blueprint.placeholder': 'Select a blueprint…',
  'intent.blueprint.loading': 'Loading the blueprint catalog…',
  'intent.blueprint.error': 'Failed to load the blueprint catalog: {message}',
  'intent.blueprint.empty': 'No blueprints available',
  'intent.revision': 'Revision',
  'intent.workspace': 'Default workspace',
  'intent.workspace.placeholder': '(none)',
  'intent.preset': 'Runtime preset',
  'intent.preset.hint': 'Choose the AgentPreset the team runs with; switching re-runs compatibility.',
  'intent.initialWork': 'Initial work (optional)',
  'intent.initialWork.placeholder': 'The initial work for the leader…',
  'intent.compatibility': 'Compatibility',
  'intent.compatibility.checking': 'Checking compatibility…',
  'intent.compatibility.ready': '✓ Ready',
  'intent.compatibility.degraded': 'Running degraded per acknowledgements',
  'intent.compatibility.fatal': '✕ Team cannot be created',
  'intent.compatibility.unknown': 'Unrecognized compatibility result: {message}',
  'intent.compatibility.owner': 'Requirement',
  'intent.compatibility.subjects': 'Unavailable',
  'intent.ack': 'I understand the degradations above and want to continue',
  'intent.create': 'Create Team',
  'intent.createAndSend': 'Create & Send',
  'intent.acknowledge': 'Acknowledge warnings and create',
  'intent.creating': 'Creating…',
  'intent.error': 'Creation failed: {message}',
  'intent.retry': 'Retry',
  'intent.cancel': 'Cancel',
  'intent.rootKept': 'The Root session was created; team creation failed — retry it (the session is kept).',
  'intent.fatal.preset': "This runtime preset owns a complete system persona and cannot host this Team Blueprint's Leader/Member identity without changing DSH core semantics.",
  'member.action.sendWork': 'Send work…',
  'member.action.followup': 'Send follow-up',
  'member.action.resume': 'Resume…',
  'member.action.message': 'Message…',
  'member.action.archive': 'Archive',
  'member.action.restore': 'Restore',
  'member.action.dispose': 'Dispose',
  'member.action.create': 'Create a MemberInstance',
  'member.command.pending': 'Pending…',
  'member.command.error': 'Command failed: {code} {message}',
  'member.create.title': 'Create MemberInstance',
  'member.create.template': 'Template',
  'member.create.label': 'Label',
  'member.create.label.placeholder': 'e.g. researcher-1',
  'member.create.group': 'Group (optional)',
  'member.create.workspace': 'Workspace (optional)',
  'member.create.fresh': 'New delegation creates a new instance.',
  'member.create.submit': 'Create',
  'member.create.cancel': 'Cancel',
  'member.send.title': 'Send work to {member}',
  'member.send.prompt': 'Work / prompt',
  'member.send.prompt.placeholder': 'Describe the work for this member…',
  'member.send.submit': 'Send',
  'member.send.cancel': 'Cancel',
  'member.message.title': 'Message {member}',
  'member.message.subject': 'Subject (optional)',
  'member.message.body': 'Message',
  'member.message.body.placeholder': 'Message body…',
  'member.message.submit': 'Send message',
  'member.message.cancel': 'Cancel',
  'member.archive.title': 'Archive this member?',
  'member.archive.running': 'This member is currently running. Archiving will stop current work and drain resident descendants before the member is archived.',
  'member.archive.plain': 'The member will not receive new Team work until restored.',
  'member.archive.confirm': 'Archive',
  'member.archive.cancel': 'Cancel',
  'member.dispose.title': 'Dispose this member?',
  'member.dispose.body': 'This member cannot be restored or receive new Team work. Its Session history, Chat, Trajectory, and Team audit history will be retained.',
  'member.dispose.confirm': 'Dispose',
  'member.dispose.cancel': 'Cancel',
  'dock.title': 'Team',
  'dock.running': '{count} running',
  'dock.pending': '{count} pending',
  'dock.jump': 'Open the Team tab',
  'dock.expand': 'Expand the team overview',
  'dock.collapse': 'Collapse the team overview',
  'dock.members.empty': 'No member status yet',
  'dock.activities.empty': 'No activity progress yet',
  'marker.progress': 'Progress',
  'marker.decision': 'Decision',
  'governance.compatibility': 'Compatibility',
  'governance.title': 'Governance',
  'governance.compatibility.badge.pass': '✓ Compatible',
  'governance.compatibility.badge.degraded': '⚠ Degraded',
  'governance.compatibility.badge.actionRequired': '⚠ Action required',
  'governance.compatibility.badge.fatal': '✕ Structural error',
  'governance.compatibility.counts': '{warning} warning(s) · {fatal} fatal · {acknowledged} acknowledged',
  'governance.compatibility.generation': 'Generation {generation}',
  'governance.compatibility.probed': 'Last probed at {at}',
  'governance.compatibility.freshRead': 'Latest compatibility read',
  'governance.compatibility.readCounts': '{pass} pass · {warning} warning · {fatal} fatal · {unacked} unacknowledged · {stale} stale acknowledgements',
  'governance.compatibility.review': 'Review',
  'governance.compatibility.recheck': 'Recheck',
  'governance.compatibility.recheckHelp': 'Rechecking starts a new compatibility generation; old acknowledgements never cover it.',
  'governance.compatibility.ack': 'Acknowledge warning',
  'governance.compatibility.ackDisabled': 'The compatibility summary exposes aggregate counts only; per-requirement acknowledgement is not exposed on the wire.',
  'governance.policy.header': 'Policy [ {state} ]',
  'governance.policy.help': 'Policy controls the Team\'s current runtime governance envelope. It does not represent task progress.',
  'governance.policy.review': 'Review',
  'governance.policy.commit': 'Commit',
  'governance.policy.preview': 'Will commit: {capabilities}',
  'governance.policy.cell.locked': 'locked',
  'governance.policy.entry.none': 'not set',
  'governance.policy.entry.allow': 'Allow',
  'governance.policy.entry.deny': 'Deny',
  'governance.policy.items': 'items',
  'governance.effectiveConfig': 'Effective config',
  'governance.effectiveConfig.empty': 'No effective config data for this member yet',
  'governance.lane.suppressed': 'Suppressed',
  'governance.lane.unavailable': 'Unavailable',
  'governance.lane.effectiveFrom': 'effective from {step}',
  'governance.hardPolicy': 'Requested: {requested} / Effective: {effective} / Reason: {reason}',
  'governance.override.show': 'Show override',
  'governance.override.set': 'Set override',
  'governance.override.reset': 'Reset override',
  'governance.override.none': 'No explicit human override',
  'governance.override.reading': 'Reading override…',
  'governance.reading': 'Reading…',
  'governance.pending': 'Pending…',
  'governance.error': 'Error: {message}',
  'handoff.title': 'Context handoff',
  'handoff.source': 'Source: "{id}"',
  'handoff.generate': 'Generate a one-shot summary',
  'handoff.preparing': 'Generating summary…',
  'handoff.ready': 'Summary ready',
  'handoff.preview': 'Preview',
  'handoff.failed': 'Context handoff failed: {message}',
  'handoff.retry': 'Retry',
  'handoff.continue': 'Continue without handoff',
  'handoff.cancel': 'Cancel',
  'handoff.canceled': 'Handoff canceled',
  'handoff.provenance': 'Started from Session: {id}',
  'legacy.banner.line1': 'This Session was created by the previous Team implementation.',
  'legacy.banner.line2': 'Team vNext will not resume or mutate it as a vNext Team.',
  'legacy.banner.line3': 'Historical Chat and Trajectory remain available.',
  'legacy.summary': 'Decoded legacy team summary (read-only)',
  'legacy.counts': '{roster} roster members · {sessions} scanned sessions',
  'legacy.inspectError': 'Legacy inspection failed: {message}',
}
