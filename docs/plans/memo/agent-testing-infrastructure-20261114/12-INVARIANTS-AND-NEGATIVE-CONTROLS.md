# 12 — TINF 不变量与 Negative Controls（目标合同，不代表已有 PASS）

[返回索引](README.md) · [迁移验收](11-MIGRATION-AND-ACCEPTANCE.md)

## 1. 统一检查强度

- **STATIC**：可在 E0 通过算法/配置直接验证的结构合同。
- **DYNAMIC**：由可控测试运行与负控验证的行为合同。
- **HOSTED**：必须在 GitHub Hosted Runner 或等价真实 Host/OS 环境看到证据的合同。
- **REVIEW**：需要人类/独立 Agent 判断的验证充分性，不得由机器 PASS 冒充。

每条不变量至少列明测试方式、能触发红灯的最小反例以及尚未验证的情况。当前都是 **目标**，实施前不得标记 PROVEN。

| ID | 目标不变量 | 主要验证 | 必需负控 |
| --- | --- | --- | --- |
| TINF-01 | 普通测试只由 Runner 发现，不能遗漏在 CI 之外 | STATIC | 新增未收集 test 文件 -> red |
| TINF-02 | 强制合同只有一套登记与唯一 ID，引用测试必然存在 | STATIC | 删除最后测试 / 重复 ID -> red |
| TINF-03 | 测试仪器不因 evidence-only 自动判为 coverage adequate | STATIC+DYNAMIC | 修改 kit driver 却选 0 tests -> UNKNOWN/red |
| TINF-04 | 影响集合不认识时不推导“无需测” | STATIC | 新顶层脚本、动态注册不识别 -> UNKNOWN+fallback |
| TINF-05 | 同 Catalog/Policy 下变更多不使选测集合减少 | STATIC/property | 加一变更后反而少选 -> red |
| TINF-06 | 测试 Model 交互严格匹配；多/少一步失败 | DYNAMIC | 未消费 step 或额外 ToolCall -> red |
| TINF-07 | 对安全合同要在真实工具链检查 OS/服务副作用 | HOSTED | 只有拒绝日志但外部文件被写 -> red |
| TINF-08 | Observer 损坏/缺失不得生成 PASS | DYNAMIC+HOSTED | 关闭 effect witness -> INCONCLUSIVE |
| TINF-09 | World 与稳定开发实例完全隔离 | HOSTED | 复用稳定端口或已有 HOME -> refuse |
| TINF-10 | 未授权执行的真实副作用不发生（在声明观察域） | HOSTED | 注入 Policy bypass -> red |
| TINF-11 | Stop/UNKNOWN 恢复不能盲目自动派发/重试 | DYNAMIC+HOSTED | 冷启意外 wake / replay -> red |
| TINF-12 | L2 完整任务集合与计划多重集一致，不丢不重 | STATIC+HOSTED | 丢 shard/重复 task -> INCOMPLETE |
| TINF-13 | L2 所有 task 必须共享合成 merge tree/Host/Plan/Build 身份 | STATIC+HOSTED | shard 错误 SHA -> red |
| TINF-14 | 必需任务的 missing/skipped/cancelled/error/FAIL 都不能变绿 | STATIC+HOSTED | 任一缺失结果 exit 0 -> red |
| TINF-15 | 缓存不共享可变 World 状态，不缓存密码与安全执行结果 | STATIC+HOSTED | 读错 World / 缓存污染 -> refuse |
| TINF-16 | 缓存及构建产物必须有完整可验证输入身份 | STATIC+HOSTED | lock/build flag 变化仍命中 -> refuse |
| TINF-17 | 修改 Gate/Catalog 的 PR 不能完全由自身新 Policy 自证 | STATIC+REVIEW | 删除 required check 并自称 PASS -> red |
| TINF-18 | CI PASS 与 C2 eligible / Release 决策正交 | STATIC+REVIEW | 把 FROZEN 或 single smoke 当发布资格 -> red |
| TINF-19 | 结构化证据缺 SHA、task ID、digest 或 run provenance 不可当可信 PASS | STATIC | README PASS 无 RunRecord -> reject trusted claim |
| TINF-20 | 新机制正式接管后退役旧权威，不能永久重复维护手工测试集合 | REVIEW | 双名单不一致但两者独立绿 -> migration not accepted |

## 2. 操作性高风险案例矩阵

| 路径 | 合法正例 | 应拒绝的负例 | 独立证据 |
| --- | --- | --- | --- |
| Bash / FS | 当前 Agent 授权范围内的实际操作成功 | 跨 Realm / 工作区限制且未批准的操作 | 文件摘要、错误来源、进程效果 |
| Review | 目标请求由指定 Officer 处理并生效 | 旧审批复用、新请求串票 | Request/Execution correlation 与 effect |
| Goal | 允许的轮次/任务继续 | Stop 后自动继续 | 真实执行计数与 durable state |
| Cold boot | 未经人工授权保持停顿 | 自动 ReviewWake/重放不确定执行 | 状态、进程和 side-effect witness |
| Native Tool | 经受治公共入口的真正执行 | 从未绑定的工具定义绕开治理 | Native adapter 与终端实际副作用 |
| CI Census | 所有任务运行并完结 | 任务缺失、重复、跨 SHA 混合 | 完整计划 + shard artifacts + aggregator |

注意：严格的“没有副作用”只能在已声明的可见资源域和 bounded observation window 内被测试支持；无法观察某个效果域必须披露 UNOBSERVED，而不是写作全球无副作用的数学证明。

## 3. 故障注入优先级

P0：审批身份混淆、Stop 后执行、真实拒绝但外部副作用、旧/新 SHA 结果拼接、缺失 shard 假绿。  
P1：超时/取消、Host 缓存污染、驱动脚本错误、角色跨转移、重复提交恢复。  
P2：长时随机并发、真实 LLM 任务评估、跨宿主迁移负载。

## 4. 可证明的与不能证明的

- 有限 case/property/mutation 测试不构成对无限状态空间或所有 OS/网络副作用的数学穷尽证明。
- OS confinement 的 E2 结果不自动覆盖受信 JS service 或远端网络效果；Contract Registry 必须按效果域拆分。
- 当一个测试所证明的是“拒绝路径上的无副作用”，不能据此推断“所有工具的正向执行与恢复均正确”。
- 任何未知机制都应该记录为未覆盖义务，不能仅靠增加测试数量消除风险。
