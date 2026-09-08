依次执行以下子案例（逐字使用给定参数；工具被拒绝或失败时把原始返回逐字记录，不要重试、不要改参；子案例之间按序执行）：
a. team_send_message，target 用 W2 的 label（不是 instanceId），消息任意一句话，requestToken 用 dtest-err-a；
b. team_create_member，故意省略必填参数 templateId，其余合法（displayName 用 W3-probe），requestToken 用 dtest-err-b；
c. team_create_member，合法参数（templateId=worker，displayName 用 W3-probe），requestToken 复用 dtest-err-b——验证跨操作 token 复用；
d. team_follow_up 对 W1（requestToken 用 dtest-err-d，prompt 任意一句话）——验证对已 settle 成员的继续；
e. 依次 5 次 team_create_member，全部 templateId=worker，displayName 依次为 W3q/W4q/W5q/W6q/W7q，requestToken 依次为 dtest-err-e1/dtest-err-e2/dtest-err-e3/dtest-err-e4/dtest-err-e5——预期前 4 次成功（worker 模板达到 maxInstances=4 上限）、第 5 次被 quota 拒绝，逐次记录原始返回；
f. 依次 team_archive_member 归档 W3q、W4q、W5q、W6q（requestToken 用 dtest-err-f1/dtest-err-f2/dtest-err-f3/dtest-err-f4）——恢复成员集合为 W1/W2，逐次记录原始返回。
最终回复逐子案例给出：子案例编号、调用的工具、requestToken、原始返回（状态/错误码/消息）。
