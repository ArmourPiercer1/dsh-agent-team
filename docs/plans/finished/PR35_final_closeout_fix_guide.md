# PR #35 最终收口修复指导

Repository: `ArmourPiercer1/dsh-agent-team`

PR:
`#35 feat(team-sync): remote contract v6 + client-owned polling + deterministic live token + real-spill E2E`

审查基线: `27bb416fd9749a181b9f49a1340dceccc6493e84`

## 目标

本轮不进行架构重构，只处理最终 merge 前收口问题：

1.  cold-bootstrap transient SessionEntry 生命周期；
2.  attach 对 transient entry 的复用；
3.  coordinator 生命周期测试补强；
4.  E2E evidence 与最终 code commit 绑定。

上一轮已经完成并保持：

-   Team-scoped live overlay；
-   same-snapshot v6 liveToken；
-   authoritative read-state UI；
-   read-state driven polling；
-   manual ledger refresh；
-   connection restore coordinator；
-   ownership conflict fail-closed；
-   stale live response ordering；
-   artifact-read-granted 与 compatibility 修复。

------------------------------------------------------------------------

# 1. 当前剩余问题

当前唯一代码风险：

``` text
trigger(session)
  ↓
没有 entry
  ↓
创建 transient scope
  ↓
attach(session)
  ↓
可能创建第二个 scope
```

如果 attach 不复用 transient entry，会重新产生：

``` text
old round
vs
new scope
```

竞争。

目标：

``` text
cold bootstrap
tick
manual refresh
mutation
resume
connection restore
```

全部属于同一个 SessionEntry 生命周期。

------------------------------------------------------------------------

# 2. coordinator 修改要求

文件：

    packages/client/src/state/team-refresh-coordinator.ts

## 2.1 trigger()

禁止：

``` ts
return runRound(options, sessionId, () => true)
```

任何裸 round。

要求：

``` text
trigger(sessionId)
    ↓
entries.get(sessionId)
    ↓
不存在:
    create transient SessionEntry
    ↓
runRound against this entry
```

所有 round 必须拥有：

-   epoch；
-   isCurrent guard；
-   entry identity。

------------------------------------------------------------------------

## 2.2 attach()

要求：

如果 transient entry 已存在：

``` text
reuse existing entry
mark attached=true
arm timer
```

禁止：

``` text
delete old entry
create new entry
```

推荐：

``` ts
let entry = entries.get(sessionId)

if (entry) {
    entry.attached = true
    armTimer(entry)
    return
}

createEntry(sessionId, true)
```

------------------------------------------------------------------------

## 2.3 detach()

保持：

``` text
detach = close current scope
```

要求：

-   删除 entry；
-   使 in-flight round 的 isCurrent=false；
-   防止 late settle 写入 read-state；
-   防止 late settle 触发 projection pull。

------------------------------------------------------------------------

# 3. 新增测试

文件：

    packages/client/test/team-refresh-coordinator.test.ts

## COLD-E1

验证：

``` text
trigger while unattached
attach
manual/tick
```

要求：

-   single-flight；
-   dirty coalescing；
-   不产生并发 probe。

------------------------------------------------------------------------

## COLD-E2

验证：

``` text
cold A starts

detach

reattach

B starts

B success

A late settle
```

要求：

-   A 不更新 read-state；
-   A 不触发 projection pull；
-   B 保持 authoritative。

------------------------------------------------------------------------

## COLD-E3

验证：

``` text
cold A starts

detach permanently

A late settle
```

要求：

-   no publish；
-   no projection pull；
-   entry 已失效。

------------------------------------------------------------------------

## COLD-E4（新增）

验证 transient attach reuse：

步骤：

``` text
1. trigger(session)
2. capture entry identity / epoch
3. attach(session)
4. settle readState
```

要求：

``` text
entry identity unchanged

epoch unchanged

没有第二个 refresh lane
```

如果无法暴露内部 entry，则通过行为验证：

``` text
readState call count == 1
没有第二个 in-flight round
```

------------------------------------------------------------------------

# 4. 建议增加 leader collision regression

文件：

    packages/runtime/test/s6t-live-token.test.ts

新增：

两个 Team：

``` text
Team A:
 inst-leader resident

Team B:
 inst-leader resident
```

目的：

确保未来不会退化回：

``` text
Map<instanceId, state>
```

而保持：

``` text
(teamSessionId, instanceId)
```

身份空间。

------------------------------------------------------------------------

# 5. Evidence 绑定修复

当前部分 evidence 存在：

``` text
worktreeHead != final tested commit
```

风险：

测试可能来自：

``` text
旧 HEAD
+
dirty working tree
```

最终 PR evidence 不应接受这种状态。

------------------------------------------------------------------------

# 6. E2E preflight 增加 clean worktree gate

文件：

    tests/kits/team-view-sync-complete-e2e/team-view-sync-complete-e2e.mjs

增加：

``` bash
git status --porcelain
```

记录：

``` json
{
  "worktreeHead": "...",
  "worktreePorcelain": ""
}
```

最终要求：

``` text
worktreePorcelain == ""
```

------------------------------------------------------------------------

# 7. 正确测试流程

禁止：

``` text
修改代码
↓
跑E2E
↓
commit
```

要求：

``` text
修改代码

↓

targeted tests

↓

full tests

↓

build

↓

artifact check

↓

commit

↓

git status --porcelain为空

↓

E2E/browser smoke
```

------------------------------------------------------------------------

# 8. 最终必须通过

测试：

``` bash
pnpm --filter @dsh-agent-team/client test
pnpm --filter @dsh-agent-team/runtime test
pnpm --filter @dsh-agent-team/remote test

pnpm typecheck
pnpm build

node scripts/place-dist-glue.mjs

node scripts/build-client-composition.mjs   packages/client   packages/client/composition-shim

pnpm check:artifacts
```

------------------------------------------------------------------------

# 9. 最终 E2E 保留场景

## E1 cold member

``` text
child session first open

getReadState(child)
→ team-member

getProjection(root)
```

------------------------------------------------------------------------

## E2 ordinary

``` text
getReadState -> none

projection ordinary == 0

UI 显示明确 ordinary/no-team
```

------------------------------------------------------------------------

## E5 manual refresh

``` text
manual refresh

forced read-state

ledger refresh
```

------------------------------------------------------------------------

## E6 two-team leader isolation

``` text
Team A:
inst-leader resident

Team B:
inst-leader cold
```

验证：

``` text
frame/token 对应各自 Team
```

------------------------------------------------------------------------

## E9 same snapshot

验证：

``` text
one projection request

one live snapshot

token matches frame
```

------------------------------------------------------------------------

## E10 cold bootstrap lifecycle

验证：

``` text
trigger without attach

attach

same SessionEntry

single-flight maintained
```

------------------------------------------------------------------------

# 10. Merge criteria

PR #35 merge 前：

-   [ ] 不存在裸 `runRound(..., () => true)`；
-   [ ] transient trigger 创建 SessionEntry；
-   [ ] attach 复用 transient entry；
-   [ ] COLD-E1/E2/E3/E4 PASS；
-   [ ] two-team leader collision PASS；
-   [ ] evidence 绑定 clean commit；
-   [ ] worktreePorcelain为空；
-   [ ] E1/E2/E5/E6/E9/E10 PASS；
-   [ ] spill E2E PASS；
-   [ ] typecheck/build/artifact PASS。

完成后 PR #35 可以进入 merge。
