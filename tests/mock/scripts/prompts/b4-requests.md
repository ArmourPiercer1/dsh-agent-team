请依次调用 team_request_control 四次（每次一个独立请求，参数逐字；这四次都是"意图声明"，你不要真的执行任何文件写入，等裁决后再由后续指令执行）：
① kind=user-approval，action=write，目标说明逐字为：写入 tests/mock-outside/probe/v2-probe-1.txt，requestToken 用 dtest-v2-req-ua-1；
② kind=leader-approval，action=write，目标说明逐字为：写入 work/v2-l1.txt，requestToken 用 dtest-v2-req-la-1；
③ kind=leader-approval，action=write，目标说明逐字为：写入 work/v2-l2.txt，requestToken 用 dtest-v2-req-la-2；
④ kind=leader-approval，action=write，目标说明逐字为：写入 work/v2-self.txt，requestToken 用 dtest-v2-req-self-1。
四次请求全部发出后，立即对自己刚发起的第 ④ 个请求调用一次 team_resolve_control（decision=allow）——预期被拒绝（自升级禁止），把原始返回逐字记录。
最终回复按 ①–④ 逐字列出每次 team_request_control 返回的 requestId/状态，并单列第 ⑤ 次自 resolve 的原始返回。本轮禁止调用 team_report_progress 工具。
