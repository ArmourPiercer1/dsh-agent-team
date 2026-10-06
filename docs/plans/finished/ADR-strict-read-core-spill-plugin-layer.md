# ADR — Strict-read + Core-spill：插件层 Provider 替换

**状态**：Accepted  
**日期**：2026-09-20  
**目标基线**：`dsh-agent-team` master @ `d63cb71441e0b7af0c6bd167ab4c4ccf24040777`；DSH `0.1.5-rc.2` @ `fb2c4b9e69`  
**边界**：仅修改 `dsh-agent-team`。**DSH upstream 保持 pristine，CORE PATCH BUDGET = 0。**

## 1. 背景

Team 的 strict-read 会限制 Agent 读取工作区外文件；而 DSH 本身把 workspace-write 视为“写入边界”而非“读取边界”，并会把 oversized tool result、grep/glob 完整结果、session-reference 内容、shell 输出等 spill 到工作区外的临时位置。

因此会出现：

```text
DSH 产生合法 spill
-> 模型获得 locator
-> Team strict-read 认为它是工作区外普通文件
-> read 被拒绝
```

把 spill root 临时迁入 workspace 只能解决当前测试环境，不能作为正式架构。

## 2. 设计约束

必须同时满足：

1. ordinary out-of-workspace file 仍不可读；
2. 知道 locator 不等于获得权限；
3. 不信任 `/tmp`、spill root、`dsh-spill-*`、文本 notice 等路径启发式；
4. 不修改、fork、patch DSH；
5. 不复制 DSH spill-policy、grep/glob retention、cleanup 等逻辑；
6. grant principal 是 durable `InstanceId`，不是某次 DSH Session；
7. 不升级 TeamDomain v2 schema。

## 3. 核心决策

### D1. 引入 ArtifactReadGrant

ArtifactReadGrant 是 runtime 签发的、只针对一个精确 artifact 的正向 `read` capability。

它不进入 Blueprint allow/ask/deny lane。

### D2. 权限优先级

```text
canonicalization/fail-closed
    >
explicit Team deny rule
    >
external-hard ceiling
    >
ArtifactReadGrant
    >
ordinary ask / allow / policy.default
```

因此：

- explicit deny 永远压过 grant；
- valid grant 可越过 ask 或 default deny；
- external-hard 仍是最终 ceiling；
- resolver 必须利用现有 provenance 区分 “explicit deny rule” 和 “default deny”。

### D3. Principal

grant 默认只属于产出 artifact 的 `InstanceId`。

```text
Member A creates X -> A 可读
Leader sees X       -> 无权限
Member B sees X     -> 无权限
```

本轮不做 Team-wide grant，也不做 capability transfer。

### D4. Durable authority

使用现有 TeamLedger 新增 fact family：

```text
artifact-read-granted
```

不新增 TeamDomain store，不升 v3。

运行时 `ArtifactReadRegistry` 只是 durable facts 的 projection/cache。

durable fact 至少记录：

- producer `InstanceId`;
- locator;
- `targetKey` 的 digest；
- `FsVersion` 的 digest；
- structured provenance（spill-store / shell-foreground 等）；
- tool/call 信息（如有）。

raw targetKey / raw FsVersion 不持久化、不解析。

### D5. Artifact identity

grant 不是绑 pathname，而是绑：

```text
locator
+ targetKeyDigest
+ versionDigest
```

签发与使用时都 fresh `resolve` + `stat`：

- missing -> inactive；
- replacement/rewrite -> version mismatch -> inactive；
- retarget -> target mismatch -> inactive；
- non-regular file -> inactive。

### D6. 生命周期

- `CREATED/RUNNING/SETTLED`：eligible；
- `ARCHIVED`：dormant；
- Restore 后相同 `InstanceId` 可重新激活历史 grant；
- `DISPOSED`：永久失效；
- Leader 不新造 lifecycle。

不增加 revoke fact。

## 4. 关键修正：不改 DSH upstream

之前考虑过给 DSH 加 `spill/saved` provenance seam。此方案正式拒绝。

原因：

1. 官方当前没有适合本插件的 PR 通道；
2. upstream 改动会变成我们长期自维护的 fork/patch；
3. DSH 的源码改动会牵动 package docs、generated catalog、Agent Notes、检查链；
4. 以后每次 DSH 升级都需要 rebase / reconcile；
5. 这正是插件重构前维护成本失控的根源之一。

技术上，一个本地 DSH 改动“可以运行而不更新所有文档”；但要保持 fork 与 DSH 自身 source-of-truth / checks 一致，实践中就必须维护这些文档和生成物。因此不接受 upstream edit。

## 5. 正式方案：替换 SpillStore provider，而不是 spill policy

DSH 当前多个 producer 最终都经过：

```text
ctx.spillStore.saveText(...)
```

包括至少：

- generic `dsh-spill-policy`;
- grep/glob formatted result;
- session-reference spill;
- 未来继续复用 SpillStore 的 producer。

因此在插件层替换 `spill-local` provider 即可获得统一可信 provenance。

实现：

```ts
class TeamAwareLocalSpillStore extends LocalSpillStore {
  async saveText(input) {
    const ref = await super.saveText(input)
    await teamArtifactAuthority.recordIfManaged(input, ref)
    return ref
  }
}
```

要求：

- `super.saveText()` 是唯一 storage path；
- 保留 DSH 原 locator、bytes、retrievalHint；
- 继承 DSH 原 cleanup/config 行为；
- 不复制 spill-policy；
- 不复制 grep/glob 逻辑；
- non-Team session 行为与 upstream 等价；
- Team strict-read session 必须在返回 `SpillRef` 前完成 grant 持久化。

若 DSH file 已写入但 Team grant 持久化失败：

```text
wrapper saveText -> reject
upstream consumer -> 使用其既有 best-effort fallback
写出的 file -> orphan，由 DSH cleanup 处理
```

这样保持：

```text
model-visible locator => durable grant 已提交
```

## 6. Composition

`dsh-agent-team` bundle layer 将最终有效的：

```text
id: spill-local
```

替换为 Team provider。

upstream `spill-policy` row 完全不改。

必须用 real-profile smoke 验证最终 effective row，而不是只检查 YAML。

## 7. Shell spill

### Foreground bash/pwsh

保留原方案：

```text
tools/result
-> canonical result.value
-> stdout.spillPath / stderr.spillPath
-> issue grant
```

不解析 rendered text。

### Background bash/pwsh

background shell 的结构化 spill path 在 `ShellProcessRead` 中，最终 `job_output` 只保留文本。

允许的方案仍限定在插件层：

- 如能通过替换 `bash-sandbox` / `pwsh-sandbox` provider 的薄 subclass/wrapper 保留 upstream 行为并观察 `ShellProcessRead`，则实现；
- principal 使用 DSH-managed、reserved 的 `DSH_SESSION_ID`；
- 如果必须复制 `tool-bash` / `tool-pwsh` 或 executor 主逻辑，则本轮停止，记录为 accepted debt。

绝不通过解析 `job_output` 文本授权。

## 8. 被拒绝方案

- `/tmp` / spill-root allowlist；
- 文本 notice 解析；
- Team 自己复制 `dsh-spill-policy`；
- upstream `spill/saved` patch；
- TeamDomain v3 / `artifact_grants` 新 store；
- Team-wide automatic sharing；
- 本轮 capability transfer。

## 9. 维护边界

每次支持新 DSH 版本时只 probe 这些 public seams：

1. `LocalSpillStore` 仍可 subclass；
2. `saveText(input) -> SpillRef` 兼容；
3. base row `spill-local` 仍可被 bundle override；
4. `ctx.fs.resolve/stat` + opaque `FsVersion` 保持；
5. foreground shell canonical result 仍带 structured spill path；
6. 若启用 background shell wrapper，则对应 shell provider subclass seam 保持。

兼容失败时只适配插件，不修改 DSH。

## 10. 结果

该方案：

- 保留 strict-read；
- 不产生 broad path exception；
- 覆盖所有 SpillStore consumer；
- 不复制 DSH policy；
- 不触碰 DSH 文档系统；
- 不要求 TeamDomain migration；
- 与 cold resume / backend restart 兼容；
- 保持 CORE PATCH BUDGET = 0。
