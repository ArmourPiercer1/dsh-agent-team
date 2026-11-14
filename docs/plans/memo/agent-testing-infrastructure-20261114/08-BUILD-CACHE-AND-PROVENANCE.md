# 08 — 构建缓存、制品复用与来源证明

[返回索引](README.md) · [World Factory](06-WORLD-FACTORY-AND-FAULTS.md) · [Census](07-CENSUS-SHARDING-AND-AGGREGATOR.md)

## 1. 性能先有剖析再有缓存

当前 Ready CI 约 24min；CI 工作包括 checkout、Host provision、Host build、Product install/build、宿主安全 suite、九 root census、transcript grading。项目 #762 尚无充分的 step 级耗时，**不能断言** 24 分钟大部分是构建。

首先记录：每一阶段墙钟、CPU/runner、下载字节、cache hit/miss、runner OS、Host/Product 构建身份、耗时分位数。必须分别测 cold/warm 与成功/失败路径。

## 2. 环境分三层

| 层 | 内容 | 可缓存 | 禁止存储 |
| --- | --- | --- | --- |
| Base | Node、pnpm、OS 依赖 | 版本相同的构建上下文 | 密钥、token |
| Host | 固定 DSH Git commit、依赖、构建产物 | 可信且校验后的不可变 Host artifact | 带用户会话的 DSH_HOME |
| Product | 本次合成 merge tree 的编译产物 | 同 identity 的下游 shard 复用 | 可跨 PR 误用的 PASS 结果 |
| World (not cache) | 测试实例的 HOME、进程、PTY、临时目录、审批状态 | **禁止作为可变运行状态共享** | 任何真实用户资源 |

参考 SWE-bench 的 base/env/instance 图像层缓存思想，但无需强制使用 Docker；dsh-agent-team 可以先利用 GitHub artifacts、pnpm store 与受控预构建目录来实现。

## 3. 强缓存键（推荐最小字段）

~~~json
{
  "platform": "linux-x64",
  "node_version": "<exact>",
  "pnpm_version": "<exact>",
  "host_commit": "<40-hex>",
  "host_lock_digest": "sha256:<digest>",
  "host_build_flags_digest": "sha256:<digest>",
  "product_merge_tree": "<tree>",
  "product_lock_digest": "sha256:<digest>",
  "toolchain_config_digest": "sha256:<digest>"
}
~~~

Host 缓存可按 Host identity 独立命中；Product 缓存必须包含 merge tree 和所有影响 build 的输入。构建成功也要验证预期入口、文件数/摘要及可安装性，不得直接接受 cache key 的字符串宣称。

## 4. CI 缓存信任边界

- 由受信 `push` 构建/校验固定 Host 缓存；低信任 PR 工作流只读使用共享 Host 缓存。
- PR 中的 Product build 是不可信代码执行结果，仅可供 **同一合成树身份** 的低权限测试 job 使用，不回流高权限发布任务。
- 不在 `pull_request_target` 等高权限上下文直接构建未审查 PR 的执行代码。
- 绝不缓存 token、secret、真实 DSH_HOME、旧工具审批记录或活跃套接字。
- 定期执行无缓存的完整构建，并测试 cache miss/损坏/过期的回退路径。
- 缓存来源与 artifact digest 在 Run Record 中完整记载。

参见 [GitHub dependency cache / artifacts distinction](https://docs.github.com/en/actions/concepts/workflows-and-actions/dependency-caching)；该文档明确提醒低信任缓存毒化风险。

## 5. 缓存不可代替执行证明

一次完整测试的“PASS”不能仅凭 Host cache 或相同 run ID 复用。SWE-bench 曾记录结果缓存按 run_id+instance_id 而忽略 patch diff 的已知行为（[官方说明](https://www.swebench.com/SWE-bench/guides/evaluation/)）：此行为不适合作为我们的安全回归判定。

只有输入与原始验证轨迹的严格同一性满足明确可信重用政策时才可能重用结论；第一阶段一律 **不跨 L2 运行复用 PASS**。

## 6. 分层复用与失败切换

- 优先共享只读 Host binary + pnpm store，再尝试同一 PR 的 Product artifact；避免为了缓存增添新的全权限服务。
- 一旦缓存 SHA/文件完整性验证失败，标记 INFRA_ERROR 并触发明确的重建路径；不能把缺失目标当成“无需运行”。
- CI 仍需验证 `check-artifacts-committed` 的产品契约，不能让缓存掩盖源代码与已提交 dist 的不一致。
- 记录缓存是否真正减少 wall time、runner-minute 和存储成本；如果净负收益，应允许关掉缓存而不改变验证语义。
