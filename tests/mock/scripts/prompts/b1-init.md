依次执行三个工具调用（按序）：
① team_list_templates：列出可用模板；
② team_create_member：用 worker 模板创建成员 W1，requestToken 用 dtest-v2-w1-create，displayName 用 W1；
③ team_create_member：用 collector 模板创建成员 W2，requestToken 用 dtest-v2-w2-create，displayName 用 W2。
最终回复中逐字给出：模板列表、两个成员的 instanceId、W1 首请求可见的 identity 上下文（若有）。
