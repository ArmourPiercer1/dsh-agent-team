# L4 收据 — read_image（dated 2026-10-31，真实 UTC；书写时刻以本文件 commit 时间为准）

## 结论
read_image **L3 + L4 在真实 Host 连续两次独立复现全绿**（同套件、同 boot tree、不同 world/run-id/approval-ids）：

- run 1 = `u5-u7r3-bootwave-bw9-2026-10-31T05-38-21-670Z`（world u5bw9-20261031T05-38-21Z，boot head 65f54157a07c91320bfc27981b7957d2245ca155 = master@4229bd5605(fmerge)）
- run 2 = `u5-u7r3-bootwave-bw10-2026-10-31T05-39-04-663Z`（world u5bw10-20261031T05-39-04Z，boot head 95812295b9d178edf8dead7e651a5dddb7ebab0d）
- 宿主=639ed01539（porcelain 0），suite=u7r3-bootwave，PASS 9/10×2；唯一非绿格=ui:live-root-law NOT_REACHED（L2-as-is 律一致，非 read_image 义务格，非 FAIL）。

## 格位 → 实录事实（两 run 一致；引 run-bw9/run-bw10.json + logs/u5bw*/instance-port3181.log + bootwave-evidence.json）
| 格 | 事实 |
|---|---|
| ri:placement-one-row | 治理 read_image 在 member 面恰 1 行，描述为治理文本（governed=true） |
| ri:ask-approved-ran (L4) | 批准→内核铸授→实例日志出现 `a5-admission: event=admission-grant-minted`/`admission-approved-grant-issued`（各 3 行/allow 调用）+ `governed-image RAN bytes=69` 执行行同面出现；grantAudit>0 |
| ri:attachment-commit-one (L4) | objects/v1 恰 1 对象 `d6325bd24a66141e…`，bytes=69=good.png，文件名=自身 sha256，identityMatch=true，模型侧 base64Length=92 对应同一对象 |
| ri:tool-output-two-blocks (L4) | RAN 调用后的请求中模型实收 envelope 文本块（`<path>…bootwave-good.png</path><type>image</type>`）+ 图像部双块（twoBlocks=true） |
| ri:answered-deny-zero-effect (L3) | 第二行 durable deny→内核门类型化拒绝（kernel-admission 臂：成员转录 `Error: the approval was denied`）；zeroNewObjectsAfterDeny=true、workspaceNewFiles=[]、普查峰值=1、ranCount=1（唯一 RAN 属 allow 调用）——live typed refusal with zero effect 字面成立 |
| ri:store-law-zero-commit | 第三次调用命中存储自身法条 `store-law-refused code=IMAGE_TOO_MANY_PIXELS`，RAN 计数与对象普查保持 1 |
| bw:leak-check | 两 run 全回收（pids dead、ports/home/leases released） |

## 预算与授权链
- 本两跑 = 用户 2026-10-31「批准 C2 boot 预算 x2」批 (a)/(b)，预登记在 BOOT-BUDGET-20261031C.md（bw9/bw10 条），账本 host-starts.jsonl 第 7/8 行；批后用尽=池 0，再启动需用户新裁。
- 判据词表的两次合法演进均有 RCA 与独立审查在案（RCA-7 勘误、RCA-8：kernel-admission 臂与整请求展平；语义零放宽：live typed refusal / zero effect / 双块交付 / 单对象入仓的断言全部保留并加强记录）。

## 边界披露
- ui:live-root-law NOT_REACHED 维持 L2-as-is 披露（family port 不传 Agent → assertLiveRoot 不可达），非本收据义务。
- 本收据=工具能力格 L3/L4 证据完备声明；不宣布 G5/发布级结论。
- Alpha.5 账本翻转由 GAP-MATRIX 同日更新条目承载（见 U7-R3-GAP-MATRIX-20261029.md dated 条目）。
