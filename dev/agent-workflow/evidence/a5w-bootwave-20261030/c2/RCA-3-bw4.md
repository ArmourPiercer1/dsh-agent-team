# RCA-3 — bw4 全 trace 定性 + 同类×2 停线与最后一格裁决（dated 2026-10-30T23:48Z）

## bw4 trace 实录（57 请求，run-bw4.json bootwaveDecideFacts.trace）
1. **根因主链**：trace#04 create-member(c1=imgov) 的 tool_result 携带 "…N_FAILED","rootSessionId":…,"instanceId":"inst-19307fv06cos"}；trace#05-06：delegate d1 被主机拒绝 correlation=bootwave-d1-…，reason="target-stale"，此后 imgov 泳道 0 请求（steps.imgov=0 与 placement PASS 不再矛盾——placement 读的是成员会话建立时的请求体）。全仓唯一 "*N_FAILED" 激活码 = **ACTIVATION_CHILD_SESSION_CREATION_FAILED**（packages/runtime/activation/{adapter,provider,errors}.ts Step 13 child-session factory fault + 适配器注释）。即 **imgov 成员的子会话在主机侧创建失败 → 成员被处置 → 委派 target-stale**；ri:* 三 FAIL 全部是该失败的下游。uigov（无 ask-subtree 规则）全程正常，两模板唯一实质差 = imgov 的 permissions.ask[0] = {tool: read_image, resource:{kind:subtree, path:<world workspace>}}。
2. **套件缺陷（bug-2，已修）**：FENCE_HOLD 文本内嵌围栏字符串本体（"BOOTWAVE_FENCE_HOLD_" + fence），leader 历史含自身回复 ⇒ 下一次唤醒轮 leaderHasMarker 自满足、相位机假推进（trace#18→19：FENCE_HOLD 后 wake 直接 delegate d2，phase→3/4，L1_DONE 打出）。已改为不含围栏串的 BOOTWAVE_HOLD_<TOK>_ROUNDS12（驱动脚本自有词汇，非被判法律；laneDone 走 replySeen 判 provider 回复，本来就没被骗——bw4 laneDone.imgov=false 是诚实的）。
3. trace lu 尾 140 字截掉了 child-factory 的具体 fault message——不足以在"套件误用规则形（主机正当拒绝）"与"产品缺口（插件工具名进 session permission 规则被主机覆盖表拒绝）"之间裁决。trace 已加宽尾 1600 + 命中 ACTIVATION/_FAILED 时加记头 1600。

## 分类与同类计数
- ri:* 控制链 FAIL：bw3+bw4 同类（control-bridge）×2 = **停线**。本文件=停线 RCA。
- 当前分类 = **harness 与产品的分界未决**（fault message 一到即定）：若主机的 child-session 校验拒绝规则形（如 resource.path 必须在会话 cwd 内 / 工具名必须在主机内建覆盖表）→ 套件误用，改写规则形重试；若主机对插件治理工具的合法 ask 规则 fail-closed → **产品缺口**（governed read_image 的 ask 腿无法经 blueprint 构造 = read_image L3/L4 路径的实质阻塞），按产品类立项，不再烧 boot。
- 预算：C2 6/8（bw4 已记）。预登记池 3 剩 1 = **bw5 专项捕获格**（唯一任务：拿到 child-factory fault 全文；同轮附带验证 bug-2 修复不改变 laneDone 诚实性）。有效格判据：fault 全文到手即有效；若预登记耗尽仍需重试 → 新 dated 预登记再来，不偷跑。
