# RCA-8 — bw8（机动格 2/2）：#510 修复真机生效，L4 首枚对象入仓；三残根全具名定案（dated 2026-10-31T04:35Z）

## bw8 实录（run-bw8.json，world u5bw8-20261031T04-18-27Z，boot head 405191114e 含 #510）
- **PASS 6**（bw7=5→6）：**ri:attachment-commit-one 首绿**（objects/v1 恰好 1 对象，文件名=自身 sha256，bytes=69=good.png，模型侧 base64 长度 92 对应同一对象）+ **ri:store-law-zero-commit 首绿**（第三次调用命中存储自身法条 `store-law-refused code=IMAGE_TOO_MANY_PIXELS`，RAN 计数与对象普查保持 1）+ placement 三连、ui f4、leak、stable-instance。
- **`governed-image RAN bytes=69 mediaType=image/png` 实例日志首现**——#510（Control 侧校验器 seam）修复被真实 Host 证实：B 行 allow 不再被改写 deny，执行链（内核放行→桥铸授→消费→执行→存储）全链贯通。
- 机动格 2/2 有效格判据=满足（首绿×2）。**机动池见底（2/2）**：下一次真实启动需用户新批（预登记硬停线条款在册）。

## 三残根定案（全部具名，全部有运行内铁证）
1. **ri:ask-approved-ran FAIL 残根=授予审计行不可观测（插件装配缺口，mount 面）**。判据要求 `admission-grant-minted|admission-approved-grant-issued` 日志行；内核经 `options.onObserve` 发射（admission-kernel.ts:164/:223/:307/:578），但装配点 team-tool-plane.mjs:812 `createProductionAdmissionAssembly({...})` **未传 onObserve**→事件全部被 noop 吞。与 #508/#510 同族（mount 面接线缺位）。修复席=task/a5w-vobs-20261031（白名单渲染入实例 observations 通道，不整包 stringify）。
2. **ri:answered-deny-zero-effect FAIL 残根=套件观测词表过时（非产品退化，本格实质断言 bw8 全真）**。#510 后 DENY 调用在**内核门**被拦（A 行 deny→执行器根本不运行，RCA-7 勘误已证 deny 调用只铸 A 行），执行器 `pa-refused` 行**必然为空**；类型化拒绝真实发生在模型面（trace 条目 74：`Error: the approval was denied` is_error=true）。零副作用普查全绿：zeroNewObjectsAfterDeny=true、workspaceNewFiles=[]、ranCount=1 且唯一 RAN 属 good 调用。套件修正=承认两条合法拒绝臂（executor-pa-refused / kernel-admission 转录臂），记录承载臂 denialArm，全部零副作用断言原样保留——台账语义 "live typed refusal with zero effect" 未动，动的是观测词汇（驱动词表）。
3. **ri:tool-output-two-blocks FAIL 残根=套件抽取器选错消息（非呈现缺陷）**。imageResultReq 命中正确（同一请求 blob 内 base64=92 即图像部已达模型），但旧 blocksOf 取"最后一条 tool_result 消息"=后续调用（deny/huge）的纯文本轮，envelope 与 image 块在更早轮次→双双"不可见"。修正=对整请求展平（harness 可将投影图像部置于独立消息；法语义="该请求中模型收到 envelope 文本块与图像部"，与包装位置无关）。trace 条目 60 铁证 envelope `<path>...` 文本块已达模型。

## 定性
- 产品面：本 boot 零新增产品缺陷（残根1 为观测装配，修复在途；残根2/3 为套件驱动词汇）。
- 下一 boot（bw9，需用户新批）判据预期：grantAudit 行出现（vobs 合并后）+ twoBlocks 双块 + deny 臂重绿；三格即齐 → read_image L4 收据条件成立（按 BW3-RECEIPT-TEMPLATE 翻台账）。
