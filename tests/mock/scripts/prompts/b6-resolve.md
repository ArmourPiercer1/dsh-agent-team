依次执行三次工具调用（按序）：
① team_resolve_control 对请求 H1（B6 的 W1 请求，requestToken dtest-v2-hard-req-1 对应的 requestId）：decision=allow，requestToken 用 dtest-v2-hard-res-1——预期外部硬策略拒绝（EXTERNAL_POLICY_DENIED 类 typed 结果），把原始返回逐字记录；
② 再次对同一请求 resolve allow，requestToken 用 dtest-v2-hard-res-2——预期返回"已裁决"类 typed 结果；
③ team_send_message 给 W2（requestToken 用 dtest-v2-hard-coord-1）：内容逐字为 HARD-COORD-OK（纯协调消息，无任何权限请求）（本轮禁止调用 team_report_progress 工具）。
最终回复逐次给出原始返回。
