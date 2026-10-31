# RCA-6 — bw6 裁决：imgov 泳道上线 + L3 deny 格真绿 + 剩余 FAIL=套件双行决策缺陷（dated 2026-10-31T01:34Z）

## bw6 实录（run-bw6-formal.json，真实启动计入 C4 4/4）
- lanes={imgov:true,uigov:true,leader:true}：#508 seam 修复后 imgov 泳道**史上首次上线**（imageRows=6）。
- **首绿**：ri:placement-one-row（三连绿）、**ri:answered-deny-zero-effect（read_image L3 deny 零副作用=真实 Host 首绿，3×pa-refused code=APPROVAL_DENIED 法条齐、objects 增量=0）**、ui:ask-approved-ran（f4 三连绿）、bw:leak-check。
- FAIL：ri:ask-approved-ran / ri:store-law-zero-commit（ranCount=0）。

## 具名失败定案（control-bridge 套件类，首见；非产品缺陷）
铁证：每个 read_image 调用在账本上录**两行** control-request-recorded——调用指纹行（summary="read_image <abs path>.png"）+ "PA ask case=tadm:<root>:<inst>:sha256:…" 案腿行（run-bw6-formal.json approval.requestRows 实录 6 行=3 调用×2）。产品双行/双腿路由、deny 终局、allow 消费语义全部正确；套件 planFor 按 toolName 出现序发号（allow,deny,allow,deny,…），把 allow 调用的第二腿喂成 DENY → 三次调用全灭（决策实录与 pa-refused 的 requestId 逐一对应）。trace 佐证：成员收到的 tool_result 全是 APPROVAL_DENIED。
修复（已提交，套件驱动词汇，法律面零动）：decisionFor 以调用指纹为键（good/huge=allow 全腿、denied=deny），"PA ask case=" 行跟随其调用行的决定（toolName=read_image 限定，防劫持 ask 行），ask=allow 不变；RAN/store-law 判据一字未改。

## 预算与 C4 机动启用（per 用户 2026-10-31 裁决）
- 前置①离线预检：本日于 boot head 完成（registries 12/12、--dry、port-probe 5/5、bindseam C1 7/7、test-use pristine）；修复后 --dry+registries 复跑在册。
- 前置②具名归因：本 RCA = 具名失败定案；C4 余额=0（4/4），证明确有 ≥1 格之需。
- 启用：**机动格 1/2 = bw7**（预登记四件套：head sha/预算格/有效格判据/收据义务）。判绿=台账翻 L4；若再现新具名失败=同类计数+RCA 先行，机动格 2/2 仅在具名归因再成立时启用。
