# RCA-2 — bw3 失败定性（dated 2026-10-30T23:40Z，lane=a5w-bootwave，写者=协调者）

## 事实（run-bw3.json + bootwave-evidence.json + host log 实录）
- 真实 Host 启动 1 次（host-starts.jsonl 第 1 行；C2 现 5/8）。绑定律满足（boot head=注册条款覆盖的 forward-merge head，含 #504）。
- PASS×4：ri:placement-one-row（LIVE imgov 请求面恰好一条 governed read_image + placement 行）、ui:ask-approved-ran（f4 公开应答全链，与 uif4 kit 复跑一致）、bw:leak-check、leader 收束。
- FAIL×3 全在 imgov read_image 执行链：ri:ask-approved-ran（durableRows=0、resolutions 里无 read_image、RAN 行 0）、ri:answered-deny-zero-effect、ri:store-law-zero-commit（NOT_REACHED×3）。objects=0（零提交副作用本身未违零副作用法，但无正向证据）。
- 判别性事实：**decide.steps.imgov=0**（provider 从未把任何请求分类为 imgov 泳道）但 ri:placement-one-row PASS（该 case 从含 d1 token 的请求体读 body.tools，证明确有携带 governed read_image 行的 imgov 泳道请求到达 provider）；laneDone.leader=true 要求 leader 相位机走过 IMG 围栏（phase→L1_DONE），而 steps 却为 0——两事实互斥 ⇒ laneOf 的 imgov 判定在真实请求形下发生了未被现有观测面区分的错位（把 imgov 请求判入他道 或 把含围栏文本的他道请求误判 leader）。**当前观测面无法在两者间裁决。**

## 分类
- **harness/observability**（套件判别/记录面不足），不是产品缺陷证据，也不是 ENV：read_image 执行链的三 FAIL 是"从未发生调用"的下游，不判产品。产品侧 read_image 至今只有 placement 级证据；L4 正向仍未得。
- 同类计数：本类首次（bw1/bw2 的 ENV 类不同）。预登记池 C2=3 已耗 1（bw3），剩 2 = 合法重试额度；重试前 RCA=本文件。

## 重试方案（bw4，1 start）
- 套件加 provider 侧 classify trace（lane 判定 + last-user 尾 140 字 + 回复形状 + 相位状态，逐请求，上限 160）——纯观测，判卷语义零移动（本 commit 内可 diff 验证）。
- bw4 用 trace 在 laneOf 上裁决错位方向；若 trace 显示 imgov 请求判入他道 → 修 laneOf 判定；若请求根本未达 provider → 升级为主机委派问题（届时按产品类走 RCA-3，不烧额度于盲目重试）。
- bw4 后无论何果：有效格判据执行（每 start 至少一格由红转绿，否则 WASTED 记录 + 停耗待裁）。
