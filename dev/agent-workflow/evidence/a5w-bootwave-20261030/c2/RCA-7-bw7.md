# RCA-7 — bw7（机动格 1/2）：RCA-6 修正被证实 + 新具名失败 = B 行 allow 被记 deny（dated 2026-10-31T01:35Z）

- RCA-6 修正生效证据：resolutions via=call/case-after-call 全部按调用指纹正确发号；deny 调用两行全 deny → pa-refused 两条（denied 调用一腿定局，另一腿仍被裁 deny=同决策一致性保持）；ri:answered-deny-zero-effect 再绿。
- **新具名失败（首见）**：suite 对 B 行（PA ask case=…）发 allow 且 ok=true，账本 control-decision-recorded 却记 decision=deny（bw7：ctrl-0wpn/ctrl-08hu 两行，RES allow vs DEC deny），执行器随后记 "governed-image pa-refused code=APPROVAL_DENIED detail=durable Control request [B-id] answered deny"。同 boot 中 ask_user_question 的 B 形行 allow → "governed-ask RAN answers=1"（结局不同=关键判别子）。A 行（调用指纹行）allow → control-allow-consumed 正常。〔dated 2026-10-31T01:47Z 勘误补记：本行两处行内代码在初稿写入时被未引号 heredoc 的反引号求值吞掉（命令替换执行失败=内容丢失），现按 run-bw7.json 与实例日志原文恢复；除此之外本文件初稿即真稿。〕
- 分类：**未决（甲/乙二分进行中）**——派 LEG-SEMANTICS-INVESTIGATION（task/a5w-bwlegs-20261031，零 boot 法源精读）回答：A/B 行各属哪道门、B 行合法裁决契约（RPC/词表/decider 身份/leg 权威）、ask 与 image B 行结构差。修正未定前**不烧机动格 2/2**（不得以额度代替修复）。
- 有效格：bw7=有效（修正被验证 + 新具名失败 + 判别子到手）。收据：run-bw7.json/oracle/logs/host-starts 行齐。

## 勘误与升级（dated 2026-10-31T02:12Z，per LEG-SEMANTICS-INVESTIGATION §1/§5，协调者转录）
- 更正①：本文件"deny 调用两行全 deny"不确。bw7 图像行共 5 行（3×A + 2×B）：被 deny 的调用**只铸 A 行**（A 拒则执行器不运行、桥不被走到）；两条 pa-refused 均属两条发 allow 的 B 行。
- 更正②：判别子升级为——A/B 两形行 rung 同为 leader、代次同为 g0（字节 summary 证实），**唯一变量 = 效果集是否含撞 subtree 规则的文件类效果**（image=3 效果含 read；ask=2 效果无文件类且 tool-invoke 臂本为 exact matcher 不经 seam）。
- 定性更新：RCA-7 的甲/乙未决由调查关闭为**乙**（pa-control-bridge 校验器三处纯核调用不传 seam 的产品装配缺口，插件层非 CORE；套件 resolve 契约被证实正确，无需再改）。修复 lane=task/a5w-vseam-20261031。
