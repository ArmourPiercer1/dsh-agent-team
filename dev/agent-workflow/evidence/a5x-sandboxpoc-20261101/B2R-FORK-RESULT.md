# B2-R 结果（PoC banner）：成员界持久 shell 经**零复制包裹**闭合 — R-B2 改判

> 证据：`dev/agent-workflow/evidence/a5x-pocB2R-20261102T112949/`（b2r.json + host.log + tails）；
> 前置对照：`a5x-pocB1-20261031T185429`（run9，同腿全部越界）。
> 件：`tests/kits/a5x-envpoc/a5x-fork-capped-terminal-bash.mjs`（provenance 头内含 FORK-DECISION 形状字段）。

## 机制（比批准的 fork 更轻一档）

`@deepseek-ai/dsh-terminal-bash` 以**公开导出** `{name, inject, Config, apply}` 被包裹：我们的行（preset roster 替换，非 disable+insert）调用 `nativeApply(wrappedCtx, config)`，wrappedCtx 的 `sandboxPolicy.resolve` 按成员帽强制降级 mode/workspaceRoot（danger-full-access 请求被钳制，resolve 无视请求升权）。**上游零字节复制、零修改**——D6 首选形态「先继承/公开装配」的实例；若未来某接缝确实非改不可，才升级到有 diff 的基础设施 fork。

## 判定腿（副作用 oracle，非工具文本）

| 腿 | run9（无帽） | B2-R（成员帽 rootA） |
| --- | --- | --- |
| `echo > secret`（帽外） | 写入成功 | **拒绝（EROFS，文件未变）** |
| `echo > rootB/escape` | 写入成功 | **拒绝** |
| `echo > rootA/inside`（正控） | 成功 | 成功 |
| `danger-full-access` 尝试 | exit 0，写入成功 | **钳制**（仍被拒；无审批噪音） |
| `cat secret`（读侧） | 可读 | 可读（**F9 宿主读方言不变**，本 spike 不修读侧，披露） |

消费实据（host.log）：`resolve session=a5x-b2r-M1-… key=M1 → CAP applied root=…/rootA`——每次 PTY 启动时刻解析，绑定 `spec.owner.session`。

## 对 R-B2 的改判

- 原判定 **CORE_SEAM_BLOCKER** 的技术依据中，「sandboxPolicy 服务实例锁定」**仍然成立**：isolate 层重供被拒/无效（run2/run6 事实不变）。
- 但闭合路径存在且已被实证：**不需要服务层重供，需要的是在装配时刻给原生插件传入策略视图**（公开 apply 可代理 ctx）。成员粒度持久 shell OS 界 = **PUBLIC_SEAM_AVAILABLE（零 fork）**，属 P1 装配工程而非核心改动。
- 残余（诚实边界）：① 读侧不设限是宿主方言（workspace-write 只绑写根），成员读白名单仍需 OS-Confined 线（Landlock/掩蔽）另行闭合；② `spec.owner.session` 的**可信性**未在本轮证明（本 spike 信任宿主传入的 session 对象——生产必须验证调用方无法伪造 owner，POC-PLAN「不能用 argv/cwd/全局可变当身份」条款适用）；③ danger 请求钳制发生在策略层，审批 UI 侧的可见语义未测。

**verdict 变更**：R-B2 `CORE_SEAM_BLOCKER` → `CONDITIONAL`（成员界闭合实证 + 上述三条残余）。B1 全链（grep/spawn/glob + 持久 shell）就此**无任何核心级阻塞**。
