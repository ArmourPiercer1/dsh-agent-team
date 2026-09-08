依次对唯一成员执行 5 次 team_follow_up（每次一个独立调用，requestToken 用 dtest-fix-<批次>-1 到 dtest-fix-<批次>-5，prompt 均逐字为：请只回复 OK（本轮禁止调用 team_report_progress 工具））。全部 settle 后只回复 DONE。
