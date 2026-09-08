依次执行三次工具调用（按序；每次返回后再发起下一次）：
① team_delegate 给 W1 新工作流，requestToken 用 dtest-v2-alpha-1，任务逐字为：把 fixtures/sentinel.txt 的内容逐字写入 work/alpha.md，完成后回显文件内容（本轮禁止调用 team_report_progress 工具）；
② team_follow_up 对 W1 继续，requestToken 用 dtest-v2-alpha-2，任务逐字为：在 work/alpha.md 末尾追加一行 ALPHAS2，然后逐字回报文件当前完整内容（本轮禁止调用 team_report_progress 工具）；
③ team_send_message 给 W2，requestToken 用 dtest-v2-msg-1，消息内容逐字为：FIXTURE-MESSAGE-1（请把收到的内容逐字回显）（本轮禁止调用 team_report_progress 工具）。
最终回复中逐次给出每次工具返回的状态字段原文。
