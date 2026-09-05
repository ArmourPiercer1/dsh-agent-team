# D-2 会话日志证据（2026-09-05，R139）

用户实机测试轮 2 报告「leader 看不到对应的团队工具」。本目录归档定位该报告的
**决定性会话日志证据**（`C:\Users\user\.dsh-dev` 只读解析，未写用户 home 任何字节）。

## 文件

| 文件 | 来源 | 内容 |
| --- | --- | --- |
| `user-session-0bf2409a.jsonl` | `C:\Users\user\.dsh-dev\sessions\--D-test--\session-0bf2409a-9316-4c54-9503-4610fa0c671d\session.jsonl.zstd` | 用户 19:40 实际对话所在的会话日志（**普通 web 会话**，workspace `D:\test`，随机 UUID）。66 个 zstd 帧，107,695 B，160 事件。 |
| `user-team-root-session.jsonl` | `C:\Users\user\.dsh-dev\sessions\--D-AgentDev-deepseek-harness--\team-root\session.jsonl.zstd` | **真正的 Leader 会话**（D-1 自愈 boot 于 19:39:07 由插件创建）。仅一行会话头，**零回合**——用户从未向真 Leader 发送任何消息。 |
| `decode-session-log.mjs` | 工作区 `references/.dsh-rmr-selftest/` | 多帧 zstd 解码器（移植 DSH `packages/session/session-persistence-jsonl/src/zstd.ts` 的 `scanZstdFrames` 语义；Node 内置 `zstdDecompressSync` 只解第一帧）。用法：`node decode-session-log.mjs <src.zstd> <dst.jsonl>`。 |

## 决定性事实

1. **用户对话发生的会话是普通 web 会话，不是团队会话。**
   `user-session-0bf2409a.jsonl` 的 `request/header` epoch（seq 10，模型可见工具
   列表的日志重建——DSH `foldRequestHeader` 契约：`event.type === 'request/header'` →
   `header.tools: ToolSchema[]`）= **恰好 24 个 DSH 标准工具**：
   `ask_user_question, create_goal, edit, exit_plan_mode, get_goal, glob, grep,
   interrupt_agent, job_kill, job_list, job_output, list_agents, pwsh, ralph, read,
   read_image, send_message, skill, subagent, subagent_fork, todo_write, update_goal,
   web_fetch, web_search, workflow, write`——**零 `team_*` 工具**，与用户引用的
   工具列表逐一对应。普通会话本就不携带团队工具（团队工具只注册在团队自己的
   agent 上）——该 agent 回答「当前会话没有挂载 Team 插件」对它自身完全正确。

2. **对话内容**（160 事件中的用户轮次）：
   - 「你是谁?」
   - 「这个 team 中有哪些 teammate?」——该 agent 在 `D:\test` 里探索到
     **legacy 团队演示** `team-e2e-demo/.dsh/teammates/{leader,backend-dev,code-reviewer}.md`，
     按文件内容作答（旧词汇来源）。
   - 「Can you see a list_teammates tool?」

3. **真 Leader（`team-root`）零回合**：`user-team-root-session.jsonl` 仅含会话头
   `{"type":"session","version":0,"id":"team-root","createdAt":1788608347687,
   "cwd":"D:\\AgentDev\\deepseek-harness","delegationDepth":0}`。

## 结论

- 报告 = **误报（问错了会话）**；生产接线（`teamToolsRef` 装配期无条件填充 →
  glue create/resume 两分支 setup 注册 → DSH core agent-scoped register 进入模型
  可见 assembly）经代码路径全读核验正确，**无代码缺陷**。
- 真实缺口 = glue 注册循环**零测试覆盖**（全部 T12A bridge 世界
  `teamToolsRef.current = undefined`，只走跳过分支）→ 已由
  `packages/runtime/test/t12a-team-tools-registration.test.ts`（task `858bc79`）
  补盲：真实 glue + 真实 `createTeamTools` 十工具栈，create/resume/close 三阶段。
- vNext 实际 10 工具（`packages/tools/src/tools.ts` 冻结词汇）：
  `team_list_members, team_list_templates, team_inspect_config, team_create_member,
  team_delegate, team_follow_up, team_send_message, team_report_progress,
  team_request_control, team_resolve_control`。用户引用的
  `list_teammates/delegate_to_teammate/team_control/team_progress/send_team_message`
  为 **legacy（pre-vNext）词汇**（`docs/migration/` 记录；用户工作区 `D:\test`
  的 legacy 演示文件亦用旧名）。

## 复测指引（给用户）

真 Leader 是团队会话 `team-root`：**团队 tab → Leader 行（「回到 leader」）**
打开它，在那里提问（如「你能看到哪些 `team_` 前缀的工具?」）——预期列出 10 个
`team_*` 工具。**不要在普通聊天会话里问**（普通会话没有团队工具是设计使然）。
