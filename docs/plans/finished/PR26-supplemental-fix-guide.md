# PR #26 补充开发与修复指引

**目标分支**：`task/strict-read-core-spill`  
**审查基线**：PR #26 @ `73b6feb068f744dd4a1adebf717b6a0d7fa1446b`  
**目标**：保持现有架构方向不变，修复 1 个 merge blocker，并补齐 3 个生产完整性问题。  
**硬约束**：继续保持 `CORE PATCH BUDGET = 0`；不得修改 DSH upstream / test-use checkout；不得使用路径白名单；不得解析 model-visible spill notice 作为 authority。

## 0. 不要推翻的现有设计

以下架构保持不变：

- durable principal = `(rootSessionId, InstanceId)`；
- `explicit deny / external-hard > ArtifactReadGrant > ask/default`；
- grant 仅作用于 `read`；
- locator 本身不是 authority；
- targetKey / FsVersion 只作 opaque identity；
- TeamDomain 保持 v2；
- 无 revoke fact；
- archive dormant / restore reactivate / disposed terminal；
- background shell 继续允许作为 accepted debt；
- 不复制 `dsh-spill-policy`、grep/glob policy 或 shell executor 主逻辑。

本轮只处理：

1. **P1** foreground shell grant 异步竞态；
2. **P2** managed-Team SpillStore 真实 vertical 缺失；
3. **P2** `spill-local -> team-spill-local` 配置迁移；
4. **P2** `artifact-read-granted` 被 UI 作为 unknown fact 裸展示。

---

# 1. P1 BLOCKER：foreground shell pending-grant race

## 1.1 问题

当前路径：

```text
tools/result
  -> async listener
    -> recordShellArtifact()
      -> fs.resolve
      -> fs.stat
      -> ledger append
      -> registry.install
```

DSH 的 `tools/result` observer 不等待 listener Promise，因此存在：

```text
bash result committed
-> grant recording still pending
-> model immediately issues read(spillPath)
-> registry has no grant yet
-> read falls into default deny / ask
```

这不能依赖“下一轮模型请求通常比较慢”。

## 1.2 修复方案：pending grant barrier

增加 process-local 的 pending issuance 状态。

语义：

```text
tools/result callback
  -> 同步解析 structured spillPath
  -> 在第一个 await 前登记 pending(root, instance, locator, promise)
  -> 异步执行 durable record

authorizeRead(...)
  -> durable grant 已存在：正常验证
  -> durable grant 不存在但 exact pending 存在：await pending
  -> pending 成功：重新走 durable grant 验证
  -> pending 失败：按普通 permission pipeline 处理
  -> 无 pending：按普通 permission pipeline 处理
```

**pending 本身绝不能直接授权。**

建议修改：

```text
packages/runtime/artifact-read/registry.ts
packages/runtime/artifact-read/authority.ts
packages/runtime/artifact-read/shell-result-observer.ts
packages/runtime/test/artifact-read-authority.test.ts
packages/runtime/test/shell-result-observer.test.ts
```

可选新增：

```text
packages/runtime/artifact-read/pending.ts
```

建议由 authority 提供一个高层方法，例如：

```ts
beginShellArtifactRecord(args): void
```

内部负责：

```text
register pending
-> recordShellArtifact
-> durable ledger
-> registry install
-> finally remove pending
```

observer 不直接管理 pending map。

## 1.3 必须增加确定性测试

### Race-1：same-instance immediate read waits

```text
1. observer 收到 valid spillPath
2. fake ledger append 被 latch 阻塞
3. pending 已登记，durable registry 尚无 grant
4. 立即调用 authorizeRead(locator)
5. assert read 尚未 settle
6. release ledger latch
7. issuance 成功
8. authorizeRead -> valid:true
```

### Race-2：issuance failure

```text
pending registered
-> read waits
-> ledger append rejects
-> pending settles failure
-> read returns invalid / ordinary pipeline
-> registry remains empty
```

### Race-3：cross-instance

```text
A has pending X
B reads X
-> B must not wait on A pending
-> no grant
```

### Race-4：wrong locator

```text
A has pending X
A reads Y
-> no wait
-> no grant
```

---

# 2. P2：补真实 managed-Team SpillStore vertical

当前 real-profile smoke 主要证明的是：

```text
foreground bash early-spill
-> tools/result observer
-> grant
-> read
```

尚未真正证明：

```text
managed Team agent
-> dsh-spill-policy / grep / glob
-> TeamAwareLocalSpillStore
-> sibling bridge
-> TeamArtifactAuthority
-> durable grant
-> strict-read readback
```

## 2.1 至少补两个真实 producer case

优先扩展：

```text
dev/agent-workflow/evidence/strict-read-core-spill/smoke/strict-read-smoke.mjs
```

### S1：generic spill-policy

构造稳定的 oversized plain-text tool result：

```text
managed strict Team agent
-> generic oversized result
-> upstream dsh-spill-policy
-> TeamAwareLocalSpillStore
-> exactly one spill-store grant
-> same Instance read(locator) succeeds
-> another Instance read(locator) denied
```

不要用 foreground bash 代替，因为它走 early-spill，不经过 SpillStore。

### S2：grep 或 glob over-cap

构造稳定的 workspace tree：

```text
managed strict Team agent
-> grep/glob over cap
-> tool-owned post-execute spill
-> TeamAwareLocalSpillStore
-> spill-store grant
-> same Instance read full result
```

并断言 durable provenance：

```json
{
  "source": {
    "kind": "spill-store",
    "spillSource": {
      "kind": "tool",
      "toolName": "grep"
    }
  }
}
```

或 `glob`。

这样才能证明 provider replacement 真正覆盖 tool-owned spill。

## 2.2 推荐增加一次真实 git-install boot

当前 strict-read smoke 使用 `file:<WORKTREE>` + symlink。

建议复用现有 PBA/git-install 测试方法，至少跑：

```text
fresh profile
-> git dependency install
-> bundle auto-added
-> real host boot
-> team-spill-local provider loads
```

最低断言：

```text
no ERR_MODULE_NOT_FOUND
no duplicate spillStore
spill-local disabled
team-spill-local active
```

不必在 git-install world 再跑完整 24/24 smoke。

---

# 3. P2：处理 `spill-local` 配置迁移

当前：

```yaml
- id: spill-local
  disabled: true

- insert:
    - id: team-spill-local
      name: dsh-agent-team/spill-local
```

因此用户已有：

```yaml
- id: spill-local
  config:
    root: ...
    cleanupPeriodDays: ...
```

不会自动传给新的 `team-spill-local` row。

这会产生 silent behavior change。

## 3.1 最低修复要求

### A. 文档迁移说明

在插件自己的 INSTALL / upgrade 文档中明确：

```yaml
# Before
- id: spill-local
  config:
    root: ...
    cleanupPeriodDays: ...

# After
- id: team-spill-local
  config:
    root: ...
    cleanupPeriodDays: ...
```

说明原 `spill-local` row 已被 bundle disable。

### B. 配置回归测试

覆盖：

```text
team-spill-local config.root 生效
cleanupPeriodDays 正常传给 inherited LocalSpillStore
```

不要只测默认 config。

### C. 可选 warning

如果能低成本读取 effective config，可在检测到：

```text
disabled spill-local has config
active team-spill-local has no matching config
```

时打印 warning。

如果需要侵入 loader，不强求。

---

# 4. P2：不要在 Team Events 裸展示 artifact grant payload

当前 `artifact-read-granted` 未进入 client known-fact map，因此落入 `unknown`，generic renderer 会 `JSON.stringify(payload)`。

会暴露：

```text
locator
targetKeyDigest
versionDigest
source provenance
```

虽然不会直接扩大 read authority，但这属于内部 authority state，不应该污染 Team Events。

## 4.1 推荐修复

优先修改：

```text
packages/client/src/model/team-ledger-model.ts
```

### 推荐 Option A：过滤 internal fact

`artifact-read-granted` 仍保留在 TeamLedger / raw remote ledger，但不进入 Events section。

这是最符合语义的：

```text
ledger fact = authority/audit
not user activity
```

### 备选 Option B：安全摘要

如果必须一 fact 一 row，则新增 dedicated kind，但只显示：

```text
Artifact read grant recorded for <instance>
```

不得展示 locator / digests。

## 4.2 测试

明确断言：

```text
artifact-read-granted
-> filtered
```

或至少：

```text
detail NOT contains locator
detail NOT contains targetKeyDigest
detail NOT contains versionDigest
```

---

# 5. 本轮不要扩展的范围

不要顺手做：

- background shell；
- capability transfer；
- Team-wide grant；
- artifact browser；
- revoke；
- grep/glob direct permission；
- `read_image` grant；
- artifact cleanup ownership；
- TeamDomain v3；
- DSH upstream docs；
- DSH core patch。

目标只是让 PR #26 达到可合并状态。

---

# 6. 建议补充提交顺序

## Commit 1

```text
fix(artifact-read): serialize shell spill grants with immediate reads
```

内容：

- pending barrier；
- race success/failure/cross-instance/wrong-locator tests。

## Commit 2

```text
test(artifact-read): verify managed spill-store producers in real profile
```

内容：

- generic spill-policy real vertical；
- grep 或 glob real vertical；
- custom `team-spill-local` config test；
- migration docs；
- 推荐 git-install boot probe。

## Commit 3

```text
fix(client): keep artifact grants out of team activity feed
```

内容：

- client projection hygiene；
- client model tests。

---

# 7. 最终测试矩阵

## Race

```text
pending same-instance immediate read -> waits -> success -> ALLOW
pending issuance failure -> waits -> failure -> ordinary policy
A pending, B read same locator -> no wait/no grant
A pending X, A read Y -> no wait/no grant
```

## Permission

```text
explicit deny + grant -> DENY
external-hard + grant -> DENY
explicit ask + grant -> ALLOW, no request
default deny + grant -> ALLOW
no grant + default deny -> DENY
grant never applies to non-read tools
end-cap remains effective
```

## Freshness / lifecycle

```text
same file -> valid
deleted -> inactive
rewritten -> inactive
replaced target -> inactive
archive -> dormant
restore -> active
disposed -> terminal
cross-instance -> denied
```

## SpillStore producers

真实 profile 至少：

```text
generic dsh-spill-policy -> PASS
grep OR glob tool-owned spill -> PASS
non-Team session -> upstream equivalent
```

## Install / packaging

```text
effective spill-local disabled
effective team-spill-local active
no duplicate spillStore
provider imports resolve
custom root config works
DSH test-use pristine
```

## UI

```text
artifact-read-granted does not dump locator/digests into Team Events
```

---

# 8. 全量 gates

执行：

```text
pnpm typecheck
pnpm build
pnpm build:composition
pnpm check:artifacts
pnpm test
```

以及：

```text
zero-core verifier
test-use porcelain clean
strict-read real-profile smoke
```

更新 smoke summary 时明确拆分：

```text
foreground shell early-spill vertical
SpillStore-backed generic vertical
SpillStore-backed grep/glob vertical
```

不要用一个笼统的 “core-spill PASS” 代替三个 producer path。

---

# 9. Merge gate

PR #26 重新提交审查前必须满足：

- [ ] foreground shell pending-grant race 被确定性修复；
- [ ] race success/failure/cross-instance/wrong-locator tests 齐全；
- [ ] generic spill-policy managed-Team real-profile vertical；
- [ ] grep 或 glob managed-Team real-profile vertical；
- [ ] `team-spill-local` custom config 有测试；
- [ ] 文档说明原 `spill-local` override 的迁移；
- [ ] artifact grant fact 不再在 Team Events 裸展示 locator/digest；
- [ ] existing permission/grant/lifecycle tests 全绿；
- [ ] strict-read smoke 全绿；
- [ ] zero-core 仍为 0；
- [ ] DSH test-use checkout pristine；
- [ ] TeamDomain schema 仍为 v2。

---

# 10. 最终语义必须保持

```text
ordinary out-of-workspace read
    -> strict-read policy

own authenticated DSH artifact
    -> exact per-artifact grant

explicit deny / external hard
    -> always able to block grant

another Instance
    -> locator knowledge gives no authority

restart / resume
    -> durable fact rebuild
    -> fresh fs identity verification

DSH upstream
    -> zero modifications
```

如果某个补丁只有通过以下方式才能实现，则停止该路线：

```text
modify DSH core
parse model-visible notice
copy spill-policy
copy shell executor main implementation
broaden path allowlist
```
