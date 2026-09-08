依次执行四次 team_resolve_control（每次一个请求，参数逐字；requestId 用上一轮 B4 返回中记录的对应值）：
① 对 user-approval 请求（B4 的 ①，记为 UA）：decision=allow，requestToken 用 dtest-v2-res-ua——预期被拒绝（resolver 越权，allowed 应只含 human），把原始返回逐字记录；
② 对 B4 的 ②（work/v2-l1.txt，记为 LA1）：decision=allow，requestToken 用 dtest-v2-res-la1；
③ 对 B4 的 ③（work/v2-l2.txt，记为 LA2）：decision=deny，requestToken 用 dtest-v2-res-la2——预期 blocked/decision-deny，零副作用；
④ 再次对 LA1（复用已消费的 token）：decision=allow，requestToken 用 dtest-v2-res-la1-retry——预期返回 allow-consumed 类 typed 结果。
最终回复逐次给出原始返回（状态/错误码/消息）。
