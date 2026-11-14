# 01 — 已确认决策、范围与禁止项

[返回索引](README.md) · [组件权威](02-ARCHITECTURE-AND-AUTHORITY.md) · [实施门](11-MIGRATION-AND-ACCEPTANCE.md)

## 1. 问题诊断

现有项目同时存在三个不同瓶颈，不得用“缩短 CI 总耗时”掩盖其它两个：
- 反馈迟：默认 Ready PR 重复运行约 24 分钟 census；Draft-first 尚未形成常态。
- 检出不足：测试文件需要手工进入 CI，新增 node:test 可能只在本地被执行；缺乏对真实授权、Stop、故障恢复的统一契约覆盖与独立效果观测。
- 治理成本：大量重复显式测试清单、手写 PASS 文案、证据归档、版本身份及合并门逻辑叠加；工程系统自己的维护耗时显著。

当前量化基线引用 #759–764，带样本窗口且不是产品的全部覆盖度。性能目标：L1 P50 ≤ 3min；L2 P50 争取 ≤ 10min，**仅作为待测性能目标，不是可以删测试的理由**。

## 2. 已确认的不可回退边界（D-01—D-12）

| ID | 裁决 |
| --- | --- |
| D-01 | Draft-first，Ready 后 final head 执行一次完整 L2 |
| D-02 | 每个可合并 PR 的 L2 必须完成全量 census，不能默认省略到合并后 |
| D-03 | 暂不变更三个 Required context 的名称与保护语义 |
| D-04 | 保留合成 merge tree 绑定、settlement 覆盖当前 SHA、fail-closed 汇总 |
| D-05 | 测试发现以原生 Runner 为主，关键不变量单独登记，消除手工冗余名单 |
| D-06 | 不认识的影响路径标记 UNKNOWN，并扩大快速测试或明确升级；不推导零测试=充分覆盖 |
| D-07 | Scripted LLM 可替身；审批器、权限路由、受治执行器与被验证的 OS 副作用不得被 Mock 掉 |
| D-08 | 缓存可复用不可变构建产物，不可跨独立 World 复用可变状态 |
| D-09 | CI Result、CI Policy Verdict、Candidate C2/Release Verdict 保持分离 |
| D-10 | 自动聚合要对 expected test-plan 多重集做精确匹配，缺失/重复/错误身份拒绝 |
| D-11 | 变更 Runner、Catalog 或 Gate 不得靠受修改的规则自证安全 |
| D-12 | 新实现必须同步提供旧机制退役清单，避免永久双重权威 |

## 3. 非目标

- 这轮不实现 DSH 工具权限、Approval Router 或 Agent Execution Realm 产品重构；参见 [PR #765](https://github.com/ArmourPiercer1/dsh-agent-team/pull/765)。
- 不重算或修改已冻结候选与 C2 记录；不移动 `current-authority.json`，不发 tag 或 release。
- 不新增通用 Agent Runtime，不引入新的数据库为 CI 保存治理状态，不替换 Vitest / Node.js runner。
- 不使用真实 LLM 生成的答案作为确定性安全断言；真实模型能力评价在 L3/单独评估流程。
- 不用仓库中历史 PASS 文字推断缺失的执行结果；不追溯重写不可变历史证据。
- 不因为“测试太慢”而加 `continue-on-error`、跳过必需的 census 或把拒绝改为静默成功。

## 4. 可在实施时由工程师裁决的参数（不阻塞架构）

- Test Catalog 元数据旁路存放或文件内声明，优先选择 **最少新增声明且可审计** 的做法。
- L2 shard 数、是否部署 OCI host 镜像、具体 cache backend 取决于实测；默认先测分片 1 / 2 / 4 路。
- 测试失败重复采样次数、artifact 保留期和报告压缩格式应按真实容量/成本确定，不作为 PASS 门禁自动宽松条件。
- 现有 #530 的收集门禁是否直接复用，需代码比对后在 M1 决定；其“缺失即拒绝”原则不能下降。

## 5. 设计批准与实施批准不是一回事

Owner 接受设计，只代表允许按本方案提出后续小 PR。任何改变 Required contexts、分支保护、现行候选冻结语义、测试豁免规则或真实执行权限的修改，仍需要在对应实施 PR 中单独审查、留下版本身份与回滚证据。
