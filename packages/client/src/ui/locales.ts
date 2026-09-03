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
}
