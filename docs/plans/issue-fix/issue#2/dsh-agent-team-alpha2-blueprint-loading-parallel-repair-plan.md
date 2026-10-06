# dsh-agent-team — alpha.2 Blueprint Loading / Authoring Repair Plan

> **目标**：在进入 alpha.3 前，以当前 alpha.2 `master` 为共同基线，修复 Blueprint 创建/加载与 `/team-remote/catalog.*` 生命周期耦合问题；与 `dsh-agent-team-alpha2-hardening-followup-repair-plan.md` 并行开发，最终分别通过 PR 合并，并在第二个 PR 合入前完成一次组合态重放。
>
> **共同基线**：`ArmourPiercer1/dsh-agent-team@6a2f3e1e906479ce8d0b07f9bcc6fef4e737f925`
>
> **上游 pin**：`ArmourPiercer1/deepseek-harness:stable@a66e4702047846cdaa10c66c9d3df3951f5ea70d` (`0.1.2-rc.1`)
>
> **CORE PATCH BUDGET = 0**
>
> **并行原则**：Permission hardening follow-up 是窄安全修复；本 Blueprint 修复不得重写 `operation-permission/**`，不得借机调整 permission precedence/end-cap，也不得把 alpha.3 governance 带入。

---

## 0. 当前代码事实与根因

当前 alpha.2 仍存在四个相互耦合的结构问题。

### 0.1 Blueprint authoring 仍绑定 Cordis row config

`packages/runtime/src/plugin/types.ts::TeamPluginConfig` 仍要求：

```ts
readonly blueprintSource: string
```

`packages/runtime/src/plugin/root.ts::createTeamProductionRoot()` 仍直接执行：

```ts
const blueprint = parseBlueprint(config.blueprintSource)
const catalog = createBlueprintCatalog([blueprint])
```

因此 production catalog 是**一个在 root construction 时创建的单 Blueprint 静态 catalog**。

用户修改 Blueprint 的正常方式仍等价于修改 `cordis.patch.yml` 的 host row config；在 rc.1 的 `patchReload: live` 下，这会进入 Cordis row HMR/reconfigure 生命周期，而不是“更新 Blueprint catalog”。

### 0.2 `/team-remote` 生命周期晚于 runtime boot

`packages/runtime/src/plugin/host.ts::bootstrap()` 当前顺序：

```text
createTeamProductionRoot(...)
root = builtRoot
await builtRoot.boot()
mount /team-remote
```

因此任何 `builtRoot.boot()` / AgentSetup / runtime bootstrap failure 都会使 `/team-remote` 根本没有被注册。

DSH rc.1 对未命中的非 GET/HEAD 请求由 frontend-static fallback 返回 HTTP 405，因此 UI 最终看到：

```text
catalog.list -> HTTP 405
```

这会把“runtime boot 失败”和“catalog transport 不存在”混成一个症状。

### 0.3 UI catalog 是 mount-once

`packages/client/src/ui/TeamCreationPanel.tsx` 当前 catalog effect 明确为：

```text
The catalog load (mount once)
...
}, [])
```

瞬时 transport gap 或 Blueprint 新增后，面板没有显式 refresh/reload 路径。

### 0.4 live agent 仍把 row Blueprint 当作唯一能力 authority

`packages/runtime/src/plugin/live/agent-bindings.mjs` 当前：

```js
function getBoundBlueprint() {
  const src = String(config.blueprintSource ?? '')
  ...
  if (boundBlueprint === null) boundBlueprint = parseBlueprint(src)
  return boundBlueprint
}
```

`locateTemplate()`、static capabilities、`capabilities.permissions` 等均依赖这个 row-level Blueprint。

所以只把 `catalog.list/get` 改成多 Blueprint 而不修改 glue，会形成危险的 authority split：

```text
TeamSession 绑定 Blueprint B
catalog/runtime 读取 B
AgentSetup capabilities/permissions/persona 仍读取 bootstrap Blueprint A
```

本轮必须闭合这一点。

---

# 1. 已冻结的 MVP 语义

本轮按已经讨论并冻结的最简语义实施，不引入复杂 draft workflow/state machine。

## 1.1 mutable / frozen

一个 `(blueprintId, revision)`：

```text
尚未成功进入任何 fresh TeamSession
    => mutable

第一次作为 fresh TeamSession snapshot 被绑定
    => frozen

frozen 后同 revision 的内容不可再改变
    => 修改必须使用新 revision
```

## 1.2 registry 是唯一 freeze authority

新增 append-only `blueprint_registry`。

MVP **不扫描 TeamSession 来推导 frozen 状态**；是否 frozen 仅由 registry 决定。

这意味着允许以下 crash window：

```text
registry freeze 成功
TeamSession commit 前进程崩溃
```

恢复后该 revision 仍 frozen，即允许 false-positive freeze；不自动 unfreeze。

## 1.3 draft / save

文件作者工作流保持简单：

```text
*.draft.yml / *.draft.yaml
    => draft，catalog 完全忽略；不校验

*.yml / *.yaml
    => saved source，可被 catalog 扫描
```

“检查合法性并保存”在本轮只做**格式/identity 层校验**，不替代 runtime 强校验。

必须保持：

```text
save accepted
!=
intent.probe / team.create guaranteed accepted
```

`parseBlueprint()` 的现有强校验语义不得削弱。

## 1.4 scan-on-demand，不做 watcher

不引入：

- `fs.watch`
- chokidar
- catalog background cache
- generation/push protocol
- Remote subscription

每次 `catalog.list/get` / `intent.probe` / `team.create` 按需读取当前 source state。

---

# 2. 与 alpha.2 hardening follow-up 的并行分支策略

## 2.1 两个 PR 必须从同一 commit 分叉

共同 base：

```text
6a2f3e1e906479ce8d0b07f9bcc6fef4e737f925
```

建议：

```text
fix/alpha2-hardening-followup
fix/alpha2-blueprint-loading
```

两个 PR 均 target `master`。

开发期间：

- 不互相 cherry-pick 产品提交；
- 不让一个分支把另一个分支当作开发 base；
- 不在开发中途反复 merge `master`；
- 通过 Draft PR / changed-files audit 保持 ownership。

## 2.2 推荐合入顺序

**先合 hardening follow-up PR，再合 Blueprint PR。**

原因：

1. hardening follow-up 是安全 closure，scope 更窄；
2. 它明确可能修改 `agent-bindings.mjs` 的 Bash workdir authority seam；
3. Blueprint repair 也必须修改 `agent-bindings.mjs` 的 Blueprint resolution；
4. 让 Blueprint PR 最后 rebase 到已闭合的 permission baseline，可以把 H4/H5 最终语义作为不可回退基线。

因此：

```text
parallel development
        ↓
PR-HARDENING ready
PR-BLUEPRINT draft/ready except integration tail
        ↓
merge PR-HARDENING
        ↓
rebase PR-BLUEPRINT onto new master
        ↓
regenerate artifacts + recompute pins
        ↓
run combined gates
        ↓
merge PR-BLUEPRINT
```

---

# 3. 文件 ownership / 冲突防线

## 3.1 Hardening follow-up 独占区

Blueprint PR **禁止修改**：

```text
packages/runtime/operation-permission/**
packages/runtime/test/a2*
packages/runtime/test/a3*
packages/runtime/test/a4*
packages/runtime/test/a5*
packages/runtime/test/h1a*
```

除非 post-rebase combined gate 只做测试适配；任何行为修改必须回到 hardening PR。

## 3.2 Blueprint PR 独占区

主要由本 PR ownership：

```text
packages/domain/blueprint/**                # 仅 additive format/source helpers
packages/storage/schema/**
packages/storage/repositories/blueprint-registry.ts
packages/runtime/src/plugin/blueprint-*.ts  # 新 Blueprint authority/source 模块
packages/runtime/src/plugin/root.ts
packages/runtime/src/plugin/host.ts
packages/runtime/src/plugin/s6-remote.ts
packages/runtime/src/plugin/types.ts
packages/client/src/ui/TeamCreationPanel.tsx
Blueprint-specific tests/evidence/docs
```

## 3.3 共享高风险文件：`agent-bindings.mjs`

两个分支都可能触及：

```text
packages/runtime/src/plugin/live/agent-bindings.mjs
```

采用**函数级 ownership fence**：

### Blueprint PR 只允许修改

```text
createAgentBindings deps destructure
getBoundBlueprint / 新 bound-blueprint resolver helper
locateTemplate 调用 Blueprint authority 的位置
staticCapabilitiesOf 使用的 bound blueprint
```

### Hardening PR 只允许修改

```text
permissionPolicy install block
fsBackend / resolveTarget
Bash effective workdir authority seam
installParameterPermissionListener(...) 参数
```

Blueprint PR **不得**顺手整理 permission block 注释/格式；Hardening PR **不得**顺手重写 `getBoundBlueprint()/locateTemplate()`。

即便 Git 自动合并，也必须在 Blueprint PR post-rebase review 中人工验证这两个 hunk 都存在。

## 3.4 generated dist/artifacts

两个分支都可能生成：

```text
packages/runtime/dist/**
packages/client/composition-shim/**
```

规则：

> **generated artifact 不做手工语义 merge。**

Blueprint PR rebase 到 hardening merged master 后：

```text
删除/恢复 branch-local generated output
从最终 source tree 重新 build
重新 place dist glue
重新 check-artifacts
提交 regenerated artifact
```

任何“保留 ours/theirs 的 dist 文件”都视为无效冲突处理。

## 3.5 p4t6 DEC-1 pin

两个分支都可能增加 `packages/**` 新文件，因此：

```text
packages/testkit/test/p4t6-session-event-scan.test.ts
```

是预期 bookkeeping conflict。

规则：

- feature commits 可以在各自分支临时更新；
- Blueprint PR 在 hardening merge 后 **重新运行 scanner 计算 merged-tree 真值**；
- 不能用 `old + 本分支文件数 + 另一分支文件数` 心算；
- 最终 pin + comment chain 以 post-rebase scanner 输出为准。

## 3.6 graph/router log/bookkeeping

以下文件在并行阶段不作为 feature implementation 文件：

```text
dev/agent-workflow/graph.yaml
SESSION_ROUTER_LOG.md（若当前仓库仍使用）
```

Blueprint PR 的 closure bookkeeping 延后到 **hardening merged + Blueprint rebased** 后的最后一个 commit。

这样避免两个 PR 都在同一 YAML/日志尾部追加造成大段冲突。

## 3.7 dependency files

Blueprint repair 不引入第三方 watcher/parser dependency。

应尽量做到：

```text
package.json              无变化
pnpm-lock.yaml            无变化
```

filesystem 使用已有 Node builtin；YAML/Blueprint parse 复用现有 domain code。

---

# 4. BP0 — Characterization / RED probes

先在 `fix/alpha2-blueprint-loading` 建立旧实现 RED 证据，产品代码不改。

至少固定：

### RED-1：静态单 catalog

构造两个 Blueprint source，证明 current root 的 `catalog.list` 只看到 `config.blueprintSource`。

### RED-2：第二 Blueprint 无法无 HMR 生效

保持 host row config 不变，在外部 source 目录创建第二 Blueprint；旧实现 `catalog.list` 无变化。

### RED-3：UI 无 reload

固定 `TeamCreationPanel` 当前 mount-once 行为：catalog 第一次失败/空后，source 更新不会触发第二次 `listCatalog()`。

### RED-4：per-Team Blueprint authority split

建立 Team A / Team B 两个不同 snapshot，证明 current glue 的 `getBoundBlueprint()` 仍只能返回 row Blueprint。

这是本轮最重要的 RED：后续必须有 GREEN 双-Team authority 测试。

### RED-5：boot failure → remote unavailable

用已有 host test seam 在 `builtRoot.boot()` 失败前后观察 remote registration，固定当前：

```text
boot rejects
=> mountRemoteNow 未调用
```

不必在 unit test 强依赖 frontend-static 405；405 已由 upstream rc.1 路由事实解释。unit 只固定“route 未注册”。

---

# 5. BP1 — Blueprint format inspector（不削弱 strong parser）

新增纯 domain helper，例如：

```text
packages/domain/blueprint/src/inspect.ts
```

职责仅是：

```text
splitFrontmatter
decodeYamlFrontmatter
assert top-level plain record
schemaVersion 存在且受支持
blueprintId 可解析
revision 可解析
```

返回最小 identity：

```ts
interface BlueprintSourceIdentity {
  schemaVersion: number
  blueprintId: string
  revision: string
}
```

不要检查：

- template reference closure
- member/template duplicate semantics
- requirement conflict
- capability compatibility
- mutation envelope conflict
- quota relation
- permission rule logic

现有：

```ts
parseBlueprint()
```

继续是 runtime strong validation 唯一入口之一，不改弱。

### 测试

必须覆盖：

1. invalid YAML -> format reject；
2. missing id/revision -> reject；
3. **格式合法但逻辑非法** -> inspector accept、`parseBlueprint()` reject；
4. strong parser 的既有测试零回归。

---

# 6. BP2 — TeamDomain v2 + append-only `blueprint_registry`

## 6.1 schema bump

当前：

```text
TEAM_DOMAIN_SCHEMA_VERSION = 1
8 stores
```

改为：

```text
TEAM_DOMAIN_SCHEMA_VERSION = 2
9 stores
+ blueprint_registry
```

按当前 alpha 决策：

- 不实现 v1→v2 migration；
- 不扫描旧 TeamSession backfill；
- 测试/开发 world 直接 reset；
- v1 medium 被 v2 open 时 loud mismatch 是预期。

## 6.2 registry record

建议最小记录：

```ts
interface BlueprintRegistryRecord {
  schemaVersion: 1
  blueprintId: string
  revision: string
  contentHash: string
  source: string
  frozenAt: string
}
```

**必须保存 immutable source 本身，不只保存 hash。**

原因：TeamSession durable row 只保存 snapshot ref；如果 frozen source 文件被删除/误改，runtime 仍必须能从 registry 重建该 snapshot。

registry source 是 frozen revision 的 runtime authority。

## 6.3 repository surface

只提供 append-only / read：

```text
get(id, revision)
list()
freeze(record)
```

禁止：

```text
update
delete
unfreeze
replace
```

`freeze` 规则：

```text
不存在
  => append

已存在 + same contentHash
  => idempotent success

已存在 + different contentHash
  => fail loud BLUEPRINT_REVISION_FROZEN / equivalent typed storage error
```

并发 first-freeze 要通过 put-if-absent/re-read 闭合，不能 last-write-wins。

### crash rule

允许：

```text
registry record exists
TeamSession does not exist
```

后续仍视为 frozen。

---

# 7. BP3 — Filesystem Blueprint source index

新增 host/runtime-side I/O module，例如：

```text
packages/runtime/src/plugin/blueprint-source-index.ts
```

domain package不拥有 I/O。

## 7.1 config

在 `TeamPluginConfig` additive 增加：

```ts
readonly blueprintDir?: string
```

为了最大限度兼容 hardening branch：

- `blueprintSource` **继续保留且继续必填**；
- `blueprintDir` absent 时，行为退化为“旧 inline bootstrap Blueprint only”；
- alpha.2 hardening 的现有 live kit 无需立刻改 config。

`blueprintSource` 从“用户日常 authoring surface”降级为：

> bootstrap/compatibility anchor source

之后用户新增/编辑 Blueprint 不再修改 host row。

## 7.2 path semantics

不要猜 Cordis row 文件位置。

MVP 明确：

```text
absolute blueprintDir -> 原样
relative blueprintDir -> 相对 host process.cwd()
absent -> filesystem catalog disabled
```

文档必须写清楚。

如果执行 Agent 找到 rc.1 已有公开 profile/home path seam，可写 deviation proposal；未经证据不要另造隐式 DSH_HOME 推导。

## 7.3 scan rule

每次请求：

```text
readdir
stable sort
inspect saved source identity
union frozen registry identities
union inline bootstrap identity
```

文件规则：

```text
*.draft.yaml / *.draft.yml -> ignore
*.yaml / *.yml             -> candidate saved source
其他                        -> ignore
```

同一 `(blueprintId, revision)` 有两个 mutable source：

```text
fail loud duplicate
```

frozen registry 与磁盘同 identity 时：

```text
registry wins
```

即使磁盘被删除，frozen registry revision 仍存在、仍可 resolve。

## 7.4 no whole-catalog strong parse

**不要**直接对整个 directory 调：

```ts
createBlueprintCatalogFromSource(...)
```

因为它会 strong-parse 每个 source；一个逻辑错误的 saved Blueprint 会使整个 catalog 不可用。

source index 只做 identity-level inspection。

---

# 8. BP4 — Live `BlueprintAuthority` / dynamic catalog

新增窄 authority，例如：

```ts
interface BlueprintAuthority {
  listIdentities(): readonly BlueprintIdentity[]
  resolve(blueprintId: string, revision?: string): TeamBlueprint
  resolveSnapshot(ref: BlueprintSnapshotRef): TeamBlueprint
  freezeSnapshot(ref: BlueprintSnapshotRef): Promise<void>
}
```

并提供一个实现现有 `BlueprintCatalog` interface 的 live facade：

```text
blueprintIds getter
listRevisions()
resolve()
resolveLatest()
snapshotOf()
```

每次方法调用都向 authority 查询当前 state，不持有 install-lifetime directory snapshot。

### authority resolve precedence

```text
registry contains id@rev
    => parse registry.source
    => contentHash 必须 == registry.contentHash
    => return frozen Blueprint

else
    => read current mutable source
    => strong parseBlueprint()
    => return
```

### freezeSnapshot

```text
registry 已存在
    => hash same: idempotent
    => hash different: fail loud

registry 不存在
    => 重新 resolve 当前 mutable source
    => strong parse
    => 其 contentHash 必须 == requested snapshot hash
    => append registry record
```

重新 resolve + hash equality 是 TOCTOU fence：

如果文件在 `team.create` resolve 与 freeze 之间被改写，freeze 必须失败，而不是冻结另一个内容。

---

# 9. BP5 — Production root 使用 dynamic catalog，但保留 bootstrap Blueprint

这是本轮降低改动范围的关键。

当前 root：

```ts
const blueprint = parseBlueprint(config.blueprintSource)
const catalog = createBlueprintCatalog([blueprint])
```

改成：

```text
blueprint = parseBlueprint(config.blueprintSource)  // bootstrap root anchor，保留
catalog   = injected live BlueprintCatalog          // dynamic authority
```

也就是说：

- host anchor/root-specific compatibility wiring仍可继续使用 bootstrap Blueprint；
- activation/runtime/control 等当前已经依赖 `BlueprintCatalog` 的组件拿到 live catalog；
- 不把整个 root.ts 重写成异步 provider 架构。

`TeamProductionRootParams` 增加：

```ts
blueprintCatalog: BlueprintCatalog
blueprintAuthority: BlueprintAuthority / freeze port
```

existing `TeamProductionRoot.catalog` 对外暴露 live catalog。

---

# 10. BP6 — freeze barrier 放在 fresh TeamSession choke point

不要在每个 caller 手写 freeze。

root 的 fresh binding wrapper：

```text
input.blueprint snapshot
        ↓
blueprintAuthority.freezeSnapshot(input.blueprint)
        ↓
bindFreshTeamRoot(...)
```

因此以下路径自动共享：

- host bootstrap create；
- `team.create` v1/v2；
- handoff fresh target；
- 任何复用 rootBinding.bindFresh 的 future caller。

### 写入顺序

必须：

```text
所有纯 preflight
freeze registry
TeamSession durable put
binding/member 后续写
```

不追求 registry + TeamSession 原子事务。

### direct TeamSession writer audit

执行 Agent 必须 grep：

```text
repositories.teamSessions.put
putTeamSession
```

逐个分类：

1. production fresh root -> 必须经 freeze barrier；
2. fork child 继承 parent snapshot -> 必须证明 parent snapshot registry 已存在；
3. tests/fixtures -> 可显式 seed registry 或使用 test helper；
4. 不允许出现新的“fresh arbitrary snapshot 直接 put”。

新增 invariant test：

> production fresh TeamSession commit 后，registry 必有同 `(id, revision, hash)` record。

---

# 11. BP7 — 修复 live glue 的 per-Team Blueprint authority

这是与 hardening follow-up 唯一真正的产品代码重叠点。

## 11.1 host 注入窄 resolver

host 构造：

```ts
resolveBoundBlueprint(rootSessionId)
```

逻辑：

```text
repos.teamSessions.get(rootSessionId)
    ↓
snapshot
    ↓
BlueprintAuthority.resolveSnapshot(snapshot)
    ↓
hash equality
```

传入 `createAgentBindings()` deps。

## 11.2 glue 只改 Blueprint resolution hunk

把 row-global：

```js
getBoundBlueprint()
```

替换成 team-root-aware：

```js
getBoundBlueprint(teamRootSid)
```

`locateTemplate()` 必须先确定 owning team root，再取得该 TeamSession 的 frozen Blueprint。

同一次 AgentSetup：

```text
boundBlueprint
boundTemplate
capabilities
permissions
persona
```

必须来自同一 Team bound snapshot。

不得重新读取 `config.blueprintSource` 作为动态 Team authority。

## 11.3 双-Team GREEN probe

至少：

```text
Team A -> Blueprint A
Team B -> Blueprint B
```

Blueprint A/B 的以下字段必须故意不同：

- leader persona
- member persona
- teamTools allowlist
- builtinToolDeny
- permissions default/rules

断言：

```text
A agent 只得到 A
B agent 只得到 B
cold resume 后仍各自一致
```

这是本轮 architecture gate，不允许只测 `catalog.get`。

---

# 12. BP8 — Remote availability 与 boot readiness 解耦

## 12.1 调整 host 顺序

当前：

```text
root = builtRoot
await builtRoot.boot()
mountRemote
```

改为：

```text
root = builtRoot
mountRemote / arm watcher
await builtRoot.boot()
```

route registration 需要 root 已构造，但不再等待 live boot 成功。

## 12.2 readiness state

新增进程内只读 state：

```text
starting
ready
failed
```

mount 后：

```text
starting
await boot()
  success -> ready
  reject  -> failed + rethrow to ready promise/log
```

`catalog.list/get` 在 `starting/failed` 仍允许，因为它们只依赖 source authority + opened domain。

其他 runtime method 在非 ready 状态：

```text
fail closed
```

不新增 Remote method、不 bump protocol。

优先复用 frozen Remote 的 `internal-error` failure envelope；不要为了 readiness 单独扩 Remote contract。

## 12.3 目标

普通 AgentSetup/runtime boot failure：

```text
catalog.list -> HTTP 200 RemoteResponse
```

不得再变成 route-missing 405。

注意：如果失败发生在 **domain/root construction 前**，本轮不承诺 catalog 可用；本轮隔离的是 Blueprint authoring/runtime boot 与 Remote route 的错误耦合。

---

# 13. BP9 — Client manual refresh

把 `TeamCreationPanel` mount-once catalog load 抽成可重入：

```text
reloadCatalog()
```

调用点：

```text
panel mount
manual "Refresh blueprints" button
```

要求：

- generation/sequence guard，旧请求不得覆盖新结果；
- refresh 时清空/重建 per-row details；
- 当前 selection 若在新 catalog 中消失，明确 reset；
- 不 polling；
- 不 subscription；
- 不 Remote bump。

保存/编辑 `.yaml` 后：

```text
点击 Refresh
=> 立即看到新 source state
```

不需要 Cordis HMR。

---

# 14. BP10 — authoring helper / docs

本轮不做 Web 全功能 Blueprint editor，不新增 Blueprint CRUD Remote。

提供最小本地 helper（命令名可由实现 Agent按现有脚本风格确定）：

### `stage`

```text
写/保留 *.draft.yaml
不校验
```

本质上允许用户直接用编辑器修改 draft。

### `validate-save`

做：

```text
format inspector
identity extraction
目标文件 atomic replace/write
```

不做 strong semantic validation。

如果 helper 能通过同进程/test harness 获得 registry repository，则 frozen identity 应直接拒绝同 revision 写入；如果产品 CLI 无公开 durable seam，本轮 authority 仍以 runtime registry 为准：

```text
外部误改 frozen file
=> registry frozen copy继续生效
=> 同 revision 不改变任何 Team/runtime authority
```

不得为了给 CLI 查询 frozen 状态新增 Remote v5。

文档必须明确：

```text
frozen 的含义是“authority 不再变化”
而不是依赖 OS 文件只读位保证用户无法编辑
```

---

# 15. Parallel integration tail（必须在 hardening PR 合并后执行）

Hardening follow-up 合并后，Blueprint branch 执行：

```text
git fetch
git rebase origin/master
```

然后按以下顺序处理。

## 15.1 `agent-bindings.mjs`

人工三方核对：

### 必须保留 hardening side

- exact rule 每 decision fresh resolution；
- Bash expanded effect fingerprint；
- final workdir authority seam；
- H1 monotonic end-cap；
- permission listener/guard lifecycle。

### 必须保留 Blueprint side

- per-Team `resolveBoundBlueprint(teamRoot)`；
- no row-global authority for dynamic teams；
- A/B Team isolation。

禁止用整文件 `--ours` / `--theirs`。

## 15.2 artifacts

rebase 完成后从 merged source **重新生成**：

```text
runtime dist
glue mirror
client composition artifacts
```

然后跑 artifact freshness gate。

## 15.3 p4t6

重新 scanner，更新 pin + DEC comment。

## 15.4 bookkeeping

最后才更新：

```text
graph.yaml
router/session log
Blueprint repair closure report
```

---

# 16. 组合态回归门

Blueprint PR 不能只证明自己的 tests 绿色；它是两个并行 PR 的最终 integration gate。

## 16.1 Blueprint focused

至少：

```text
format inspector
registry append-only
source index
dynamic catalog
freeze barrier
dual-Team Blueprint authority
remote pre-boot mount/readiness
client manual refresh
```

## 16.2 Hardening follow-up replay

按第二轮计划至少重跑：

```text
a2 canonical operation
a3 permission resolver
a4 exact control scope
a5 pre-execute
a6 production wiring
h1a end-cap adversarial
h3 hostile seam
H4 exact-rule identity tests
H5 Bash effect fingerprint tests
```

目标：

> Blueprint resolver 改造不得改变 hardening follow-up 的任何 permission verdict/fingerprint/lifecycle 语义。

## 16.3 lifecycle

至少：

```text
fresh root
fresh member
cold root
cold member
legacy permissions-absent
```

## 16.4 live smoke

### BL-L1 — hot load without HMR

host 启动并确认 `catalog.list` 200。

随后只修改 `blueprintDir`：

```text
add new saved Blueprint
catalog.list refresh -> 新 Blueprint 出现
host row 未重载
/team-remote registration 未消失
```

### BL-L2 — mutable before first Team

同 id/rev 内容 A：

```text
catalog.get -> A
```

修改为 B（仍未 freeze）：

```text
catalog.get -> B
```

### BL-L3 — first use freezes

create Team：

```text
registry = frozen B
TeamSession snapshot hash = B
```

再把文件改 C：

```text
catalog.get(id,rev) -> frozen B
existing Team remains B
new Team requesting same rev -> B
```

新 revision：

```text
rev+1 = C
=> 可正常使用并在第一次 fresh bind freeze
```

### BL-L4 — frozen file deleted

删除 saved file：

```text
catalog.list/get
existing Team cold resume
```

仍从 registry 成功。

### BL-L5 — boot failure not 405

注入 AgentSetup/runtime boot failure：

```text
ready rejects / bootstrap FAILED logged
catalog.list -> HTTP 200
non-catalog runtime request -> fail-closed RemoteResponse
```

### BL-L6 — dual Team permission/persona

真实或 production-like host：

```text
Team A blueprint != Team B blueprint
```

验证 persona + capability + permissions 均不串线。

---

# 17. Full gates

Blueprint PR post-rebase 最终记录：

```text
runtime full suite
domain full suite
storage/testkit
client tests
typecheck
build
build:composition
check-artifacts-committed
lint
live smoke
cold resume
legacy regression
references/deepseek-harness-test-use porcelain
```

对于 repo 既有失败：

```text
hardening-merged master baseline failing set
Blueprint PR tip failing set
diff
```

要求：

```text
NO new deterministic regression
CORE PATCH BUDGET = 0
```

---

# 18. 推荐 Blueprint PR commit 拆分

## BP-A — characterization RED probes

只测试/evidence，不改产品。

## BP-B — format inspector + source-index primitives

纯 Blueprint/source discovery；不碰 glue。

## BP-C — TeamDomain v2 + blueprint_registry

schema + repository + tests。

## BP-D — BlueprintAuthority + live catalog

dynamic catalog，保留 inline bootstrap fallback。

## BP-E — root freeze barrier + production catalog wiring

root/remote runtime authority接线。

## BP-F — per-Team live glue Blueprint resolution

只改 `agent-bindings.mjs` Blueprint hunk；这是 conflict-sensitive commit。

## BP-G — remote mount-before-boot + readiness

host lifecycle 修复。

## BP-H — client refresh + docs / authoring helper

UI/reload和操作说明。

## BP-I — post-hardening rebase integration

只做：

- merge/rebase conflict resolution；
- regenerate dist/artifacts；
- recompute p4t6；
- combined gates；
- closure evidence/bookkeeping。

**BP-I 必须发生在 hardening follow-up 已经合入 master 之后。**

---

# 19. PR 审查重点

Reviewer 不应只问“405 是否消失”，必须检查：

1. 新 Blueprint 是否无需改 `cordis.patch.yml` 即可被发现；
2. `blueprintSource` 是否已退化为 bootstrap anchor，而非所有 Team 的 runtime authority；
3. frozen revision 是否由 registry source 保证可重放；
4. 是否存在 registry frozen、TeamSession absent 的合法 false-positive 状态；
5. fresh TeamSession 是否都经过 freeze barrier；
6. AgentSetup 是否按 owning TeamSession snapshot 解析 persona/capabilities/permissions；
7. filesystem 中一个逻辑坏 Blueprint 是否只影响自己，而不是击穿整个 catalog；
8. `/team-remote` 是否在 live boot failure 时仍存在；
9. 是否无 Remote protocol bump / DSH core patch；
10. hardening follow-up 的 exact-rule/Bash/end-cap 语义是否在合并后完整保留。

---

# 20. Definition of Done

只有全部满足才可合并 Blueprint PR：

- [ ] 分支 base = `6a2f3e1e...`，hardening/Blueprint 开发期间无交叉 cherry-pick
- [ ] `blueprintSource` 不再承担动态 Team 的唯一 runtime authority
- [ ] `blueprintDir` 可在 host 不重载的情况下新增/修改 Blueprint
- [ ] draft 文件完全不进入 catalog
- [ ] save-format 校验与 `parseBlueprint()` strong validation 明确分层
- [ ] TeamDomain v2 有 append-only `blueprint_registry`
- [ ] registry 保存 frozen source + hash，不只保存 hash
- [ ] MVP 不扫描 TeamSession 推导 frozen 状态
- [ ] first fresh TeamSession bind 前完成 freeze
- [ ] crash 后允许 false-positive freeze，永不自动 unfreeze
- [ ] frozen source 文件删除/误改不破坏旧 Team resolve/cold resume
- [ ] 同 revision frozen 后内容 authority 永不变化；修改必须新 revision
- [ ] dual-Team persona/capabilities/permissions isolation GREEN
- [ ] catalog add/edit 不触发 Cordis HMR
- [ ] AgentSetup/runtime boot failure 不再令 `catalog.list` 表现为 HTTP 405
- [ ] UI 有手工 refresh，且无 polling/subscription
- [ ] `operation-permission/**` 未被 Blueprint PR 改写
- [ ] hardening follow-up H4/H5 + H1/H3 gates 在组合态重跑 GREEN
- [ ] generated artifacts 在 post-rebase merged source 上重新生成
- [ ] p4t6 pin 来自 merged-tree scanner 真值
- [ ] full suite 无新增 deterministic regression
- [ ] `deepseek-harness` pin 不变、porcelain clean
- [ ] `CORE PATCH BUDGET = 0`
- [ ] 无 alpha.3 dynamic grant / teamHardDeny / permission admin UI / Blueprint Remote CRUD creep

---

# 21. 给本地 Agent 的执行顺序

```text
1. 从 6a2f3e1e 创建 fix/alpha2-blueprint-loading worktree；
2. 记录 master / upstream pin / baseline gates；
3. 写 BP-A RED probes；
4. 实现 BP-B inspector/source index；
5. 实现 BP-C TeamDomain v2 + registry；
6. 实现 BP-D dynamic BlueprintAuthority/catalog；
7. 实现 BP-E freeze barrier + root/runtime catalog wiring；
8. 实现 BP-F per-Team glue resolution，但严格只改 Blueprint-owned hunks；
9. 实现 BP-G mount-before-boot/readiness；
10. 实现 BP-H client refresh + docs；
11. 在 hardening follow-up 未合并前，不做最终 dist/pin/bookkeeping closure；
12. 等 hardening PR merge；
13. rebase Blueprint branch onto new master；
14. 人工三方审 agent-bindings：Blueprint hunk + H4/H5 permission hunk都保留；
15. 从 merged source 重新生成所有 committed artifacts；
16. scanner 重算 p4t6 pin；
17. 跑 Blueprint focused + hardening replay + lifecycle/live/cold/legacy；
18. 跑 full parity/typecheck/build/lint/artifact/core-patch gates；
19. 生成 closure report + 最后 bookkeeping commit；
20. PR review 重点按 §19 检查，通过后 merge。
```
