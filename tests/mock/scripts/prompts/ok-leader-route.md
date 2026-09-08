依次执行：先调用一次 team_list_members；然后对每一个非归档成员（{MEMBERS}）各执行一次 team_follow_up，requestToken 用 dtest-face-<成员label小写>-<序号>，prompt 逐字为：请只回复 OK（本轮禁止调用 team_report_progress 工具）。全部工具调用完成后，你只需回复 OK。
