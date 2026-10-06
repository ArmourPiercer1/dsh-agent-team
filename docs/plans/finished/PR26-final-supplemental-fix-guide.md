# PR #26 最终补充开发指导

**目标分支**：`task/strict-read-core-spill`  
**当前审查 head**：`56abbd6f7317e392ab0243181871f1684df1d39a`  
**目标**：只修复最后两个收口问题，使 PR #26 达到 merge-ready。  
**范围纪律**：本轮不得再扩展 artifact architecture，不做 background shell、不做 capability transfer、不改 DSH upstream。

## 0. 当前状态

上一轮的核心问题已经闭环：

- pending-grant race：已修复；
- SpillStore real vertical：已补齐；
- git-install / provider resolution：已验证；
- Team Events authority payload 泄漏：已修复；
- zero-core：继续成立；
- TeamDomain：继续保持 v2。

当前只剩：

1. **P1：`docs/INSTALL.md §3.4` 的 profile migration YAML 写法错误；**
2. **P2：strict-read smoke 的 `producerPaths` 汇总逻辑错误，导致 evidence 自相矛盾。**

除这两项外，不做新的产品架构修改。

---

# 1. P1：修正 `spill-local -> team-spill-local` 配置迁移文档

## 1.1 当前错误

bundle 已经插入：

```yaml
- id: spill-local
  disabled: true

- insert:
  - id: team-spill-local
    name: dsh-agent-team/spill-local
```

因此 profile/user layer 只需要对已存在的 `team-spill-local` 做同 id patch。

当前 `docs/INSTALL.md §3.4` 错误写成：

```yaml
- insert:
  - id: "team-spill-local"
    name: "dsh-agent-team/spill-local"
    config:
      root: /path/to/my/spill
      cleanupPeriodDays: 14
```

这会尝试再次插入一个新的 active row，而不是覆盖已有 row，可能导致：

```text
duplicate team-spill-local row
-> duplicate spillStore provider
-> boot failure
```

因此该示例必须修正。

## 1.2 正确 migration 示例

将 `docs/INSTALL.md §3.4` 的 After 改为：

```yaml
# After（profile 层 cordis.patch.yml —— 覆盖 bundle 已存在的 row）
- id: team-spill-local
  config:
    root: /path/to/my/spill
    cleanupPeriodDays: 14
```

如果希望保留 module mismatch guard，也可以：

```yaml
- id: team-spill-local
  name: dsh-agent-team/spill-local
  config:
    root: /path/to/my/spill
    cleanupPeriodDays: 14
```

但**不得出现 `- insert:`**。

## 1.3 文档文字同步修改

建议明确写成：

```text
迁移 = 在 profile/user patch 层用 `id: team-spill-local`
覆盖 bundle 已插入的同名 row 的 config。
不要再次使用 `insert`，否则会产生第二个 provider row。
```

保留以下说明：

- old `spill-local` row 已被 bundle disable；
- 原 `spill-local` config 不会自动迁移；
- 未设置 custom root/cleanupPeriodDays 时无需新增 override；
- config schema 与 upstream LocalSpillStore 一致。

---

# 2. 推荐补一个 composition config override 测试

这是本轮唯一推荐新增的测试。

## 2.1 目的

当前 C1/C2 已经证明：

```text
TeamAwareLocalSpillStore 收到 custom config
-> root 生效
-> cleanupPeriodDays 生效
```

但还没有证明：

```text
真实 bundle composition
+ profile same-id patch
-> exactly one active team-spill-local
-> effective config 正确
```

这个测试可以直接防止 INSTALL 文档再次写错。

## 2.2 建议测试

输入：

```yaml
# dsh-agent-team bundle 已经插入 team-spill-local

# profile overlay
- id: team-spill-local
  config:
    root: /custom/spill
    cleanupPeriodDays: 14
```

断言：

```text
1. effective tree 中只有一个 active provider row：
   id = team-spill-local

2. base spill-local:
   disabled = true

3. team-spill-local effective config:
   root = /custom/spill
   cleanupPeriodDays = 14

4. 不存在第二个 team-spill-local row

5. 不出现 duplicate spillStore
```

如果现有 composition test framework 不方便启动 provider，至少 dump-config 层证明 row 数量和 effective config。

不要为了这个测试新增 loader API 或修改 DSH。

---

# 3. P2：修正 `producerPaths` evidence 汇总逻辑

## 3.1 当前 bug

当前 smoke：

```js
const producerOk = (leg) => CRITERIA.some((c) => c.leg === leg && c.ok)

const producerPaths = {
  'foreground-shell-early-spill': { leg: 'E2', ok: producerOk('E2') },
  'spill-store-generic-spill-policy': { leg: 'S1', ok: producerOk('S1') },
  'spill-store-tool-owned-grep': { leg: 'S2', ok: producerOk('S2') },
}
```

但真实 criteria 名称是：

```text
E2a
E2b

S1a
S1b
S1c
S1d
S1e

S2a
S2b
S2c
S2d
```

所以：

```text
producerOk('E2') = false
producerOk('S1') = false
producerOk('S2') = false
```

即使所有 criteria 都 PASS。

这导致：

```text
summary.verdict = PASS
33/33 PASS
```

同时：

```json
"producerPaths": {
  "...": { "ok": false }
}
```

证据自相矛盾。

---

# 4. 推荐修复 `producerOk`

推荐使用闭合 required-leg 集，而不是 prefix 上“有一个 PASS 就算 PASS”。

```js
function allCriteriaPass(requiredLegs) {
  return requiredLegs.every((leg) =>
    CRITERIA.some((c) => c.leg === leg && c.ok)
  )
}

const producerPaths = {
  'foreground-shell-early-spill': {
    leg: 'E2',
    ok: allCriteriaPass(['E2a', 'E2b']),
  },
  'spill-store-generic-spill-policy': {
    leg: 'S1',
    ok: allCriteriaPass(['S1a', 'S1b', 'S1c', 'S1d', 'S1e']),
  },
  'spill-store-tool-owned-grep': {
    leg: 'S2',
    ok: allCriteriaPass(['S2a', 'S2b', 'S2c', 'S2d']),
  },
}
```

这个版本比：

```js
CRITERIA.filter(c => c.leg.startsWith(prefix)).every(...)
```

更稳定，因为 future 新增 informational `S1x` 不会意外改变 producer vertical 的闭合验收含义。

---

# 5. 增加 smoke self-consistency hard gate

为了避免以后再次出现：

```text
summary PASS
producerPaths false
```

建议 producerPaths 纳入最终 verdict。

例如：

```js
const producerPathsOk = Object.values(producerPaths).every((p) => p.ok)
const anyFail =
  failed.length > 0
  || !producerPathsOk
  || fatalError !== null
```

或者在计算 verdict 前把每个 producer path 加入 CRITERIA。

要求：

> producerPaths 只要有一个 false，最终 smoke verdict 就不能是 PASS。

---

# 6. 重新运行 smoke 并更新 evidence

修复 smoke 后必须重新跑：

```text
strict-read real-profile smoke
```

期望：

```text
所有 criteria PASS
fails = []
```

并确认：

```json
"producerPaths": {
  "foreground-shell-early-spill": {
    "leg": "E2",
    "ok": true
  },
  "spill-store-generic-spill-policy": {
    "leg": "S1",
    "ok": true
  },
  "spill-store-tool-owned-grep": {
    "leg": "S2",
    "ok": true
  }
}
```

更新：

```text
producer-paths.json
summary.json
smoke.log
```

历史 run 可以继续保留，但 PR body / graph / router log 中的“final run”引用应指向新的修复后 run。

---

# 7. 不需要重做的内容

本轮无需重构：

- pending barrier；
- Race-1..4；
- authority lifecycle；
- cold restart；
- grant freshness；
- explicit deny / external-hard precedence；
- client INTERNAL_FACT_TYPES；
- S1/S2 producer 设计；
- git-install probe 架构；
- TeamDomain；
- DSH upstream；
- background shell。

---

# 8. 最小产品 diff

理想情况下，产品源码只需要：

```text
docs/INSTALL.md
```

测试/证据修改：

```text
dev/agent-workflow/evidence/strict-read-core-spill/smoke/strict-read-smoke.mjs
composition config-override test（推荐）
新的 final smoke evidence
graph / router log 的 final evidence 引用（如需要）
```

不要修改：

```text
packages/runtime/artifact-read/**
packages/runtime/operation-permission/**
packages/runtime/src/plugin/team-spill-local.ts
packages/runtime/src/plugin/host.ts
packages/client/src/model/team-ledger-model.ts
```

除非测试证明已有代码存在真实 defect。

---

# 9. 回归 gates

完成后执行至少：

```text
pnpm typecheck
pnpm build
pnpm build:composition
pnpm check:artifacts
```

针对修改范围执行：

```text
composition tests
strict-read real-profile smoke
```

并保留：

```text
zero-core verifier
test-use porcelain clean
```

如果全量：

```text
pnpm test
```

仍只出现已确认的 `p6t1-parallel` 既有 load flake，则按现有 debt 记录处理，不在本轮追修。

---

# 10. Merge-ready 条件

以下全部满足即可重新提交审查：

- [ ] `INSTALL.md §3.4` After 示例不再使用 `insert`；
- [ ] 文档明确 same-id patch 覆盖已有 `team-spill-local`；
- [ ] 推荐：composition test 证明 custom config 不产生第二 provider；
- [ ] `producerPaths` 汇总逻辑修正；
- [ ] producer path 3/3 均为 `ok:true`；
- [ ] final smoke verdict 与 producerPaths 一致；
- [ ] final smoke PASS；
- [ ] zero-core 仍为 0；
- [ ] DSH test-use pristine；
- [ ] TeamDomain schema 无变化。

---

# 11. 范围边界

如果修复过程中发现需要：

```text
修改 DSH core
新增 upstream seam
复制 spill-policy
修改 authority model
扩大 path allowlist
新增 background shell support
```

则停止，不属于本轮修复。

本轮目标只是：

> **修正文档中的错误配置操作，并使 smoke evidence 与已经通过的真实 producer vertical 保持一致。**
