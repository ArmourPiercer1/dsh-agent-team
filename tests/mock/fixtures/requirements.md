# DTest 业务任务简报（F2）

你是 leader。请按顺序执行以下任务：

1. 确保有两个成员：若还没有，先用 team_create_member 创建一个 worker 和一个 collector。
2. 工作流 A（worker）：读取 `fixtures/sentinel.txt`，把它的完整内容**逐字**写入 `work/alpha.md`（不增不减，不要添加任何其他内容）。
3. 工作流 B（collector）：读取 `fixtures/seed-note.txt`，把其中要点写成 3 句话的总结，写入 `work/summary.md`（总结中必须逐字引用原文至少一句）。
4. 每个成员完成各自工作流后必须调用一次 team_report_progress 汇报进度。
5. 最后由你汇总 `work/final.md`，内容必须包含：① 两个成员产物文件的绝对路径；② sentinel 的逐字内容；③ collector 总结的要点；④ 团队成员清单及其当前状态（用 team_list_members 的实况）。
6. 完成后向我回报三个文件（alpha.md / summary.md / final.md）的路径。
