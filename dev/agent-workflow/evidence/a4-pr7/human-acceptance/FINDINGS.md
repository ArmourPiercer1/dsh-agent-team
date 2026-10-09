# A4-PR7 W5 FINDINGS — 一个真正耐久损坏的世界（人工验收准备）

任务口径：W1 与 W4 的 FINDINGS 都写着"没有真的制造损坏记录、没有真的宿主往返、没有 `tests/homes/<world>`"。
本轮把这句话改成可执行事实：**一个人在 GUI 前能自己造出来的损坏世界**，加上**生产读取面的两次读数原文**。
本轮改动只落在 `dev/agent-workflow/evidence/a4-pr7/human-acceptance/**`；产品代码、产品测试、`boot.mjs` 一字未改。

## 1. 一句话结论

`tests/homes/a4-w5-corrupt-acceptance` 是一个真世界：它的 `storages/team_domain.json` 里耐久躺着
**一条** `control-request-recorded` 记录，严格读取器拒收它、把它登记成 corrupt leg，
v9 `team.listCorruptControlLegs` 报 `corruptCount 1 / sequence 15 / disclosesMember false`——
**离线的生产读取面**与**已启动宿主的真实 HTTP 通道**都量到同一个数。GUI 那一行等人在 §7.7 现场确认。

## 2. 这条记录是怎么写进去的（不是手写 JSON）

写入走的是**产品自己的写路径**，从本仓库已构建产物里加载（也就是插件行挂载的同一套模块）：

- `tests/deepseek-harness-test-use/packages/storage/storage-json/lib/index.js` → `JsonStorageBackend(<world>/storages)`
  （宿主服务 `<DSH_HOME>/storages/team_domain.json` 用的就是这个后端）；
- `…/storage-domain/lib/index.js` → `DomainFacility`（唯一"发明"的对象是它需要的 Cordis ctx：
  `storage.backend.get()` 路由 + 吞掉的 logger + 吞掉的 `emit`；离线没有 `domain/changed` 订阅者）；
- `packages/runtime/root-binding/harness/seam.mjs` → `createRealStorageDomainSeam(facility)`（行自有的真实 seam）；
- `packages/runtime/dist/packages/storage/repositories/team-domain.js` → `openTeamDomain(seam)`；
- 写：`repositories.ledger.allocateSequence()` + `repositories.ledger.put({...})`。

于是 canonical key-sorted 字节、`__ledger_sequence_counter` 前进、`team_sessions.generation` 的 S1-A 印记
（fact-durable-before-stamp）全是产品代码做的，脚本没有复刻任何编码规则。原始字节对比（**实测**，`raw/11`）：

```text
# raw bytes of the injected row, next to a row the product itself wrote
# file: tests/homes/a4-w5-corrupt-acceptance/storages/team_domain.json
# ledger table keys (sorted): ['1', '10', '11', '12', '13', '14', '15', '2', '3', '4', '5', '6', '7', '8', '9']
# counter row __ledger_sequence_counter = {"kind":"ledger-sequence-counter","schemaVersion":2,"value":15}

## sequence 14 (written by the product during the acceptance boot):
{"createdAt":"2026-10-08T04:49:30.988Z","factType":"provision-member-instance","operationId":"op-1jruotp11ap1uk0iim17f1gw","payload":{"instanceId":"inst-00o6p7r1q73w","label":"a4w-fresh-20261008T044850","rootSessionId":"session-a4-accept-boot","templateId":"worker","workspace":"/home/user/dsh-plugins/dsh-agent-team/tests/homes/a4-accept-20261007T16-57-26Z/workspace"},"rootSessionId":"session-a4-accept-boot","schemaVersion":2,"sequence":14}

## sequence 15 (appended by make-corrupt-world.mjs through LedgerRepository.put):
{"createdAt":"2026-10-09T12:42:22.100Z","factType":"control-request-recorded","payload":{"actionName":"","correlation":"","executionCoupling":"guarded","kind":"leader-approval","operationFingerprint":42,"requestId":"req-a4w5-human-acceptance-damage","requester":{"humanId":"a4-w5-human-acceptance","kind":"human"},"subject":42,"targetInstanceId":"","toolName":42},"rootSessionId":"session-a4-accept-boot","schemaVersion":2,"sequence":15}

# both values are canonical key-sorted JSON strings, exactly like every other row;
# the ONLY difference is the payload content (the damage), not the encoding.

## team_sessions row (generation advanced by the same append: 16 -> 17, the S1-A stamp):
   key=session-a4-accept-boot generation=17 rootSessionId=session-a4-accept-boot
   defaultWorkspace=/home/user/dsh-plugins/dsh-agent-team/tests/homes/a4-accept-20261007T16-57-26Z/workspace
```

注入只允许在**应用停止**时做：运行中的宿主把整个 unit 文档缓存在内存里，它下一次写会把外部追加的行抹掉。
脚本对此的判据是**对 marker 记录的端口做 TCP 连接**（端口只允许 3180 族 / 3491-3500），不是 pid——
理由见 §7 的 pid 教训。

## 3. 为什么这一行既"被拒收"又"不可归属"（逐条实测，不是照抄简报）

判定谓词 = `corruptLegDisclosesMember()`（`packages/runtime/control/service.ts:1204`）；
拒收谓词 = `parseRequestPayload()`（同文件 `:705`）；登记 = `loadControlState()`（`:1759`-`:1816`）。
本轮写进去的 payload（`world-seam.mjs` 的 `damagedControlRow()`，与 W1 已合并验收的
`packages/runtime/test/a4w1-corrupt-warning.test.ts` 的不可归属行同形状）：

| 字段 | 值 | 拒收？ | 披露？（谓词实测） |
| --- | --- | --- | --- |
| `actionName` | `""` | 是：空 actionName | 否——该字段"拒空"，空值不是一个值，因此没有内容可披露 |
| `correlation` | `""` | 是：空 correlation | 否（同上，拒空） |
| `toolName` | `42` | 是：present 但非 string | 否——非 string 不算披露。**关键陷阱**：`toolName` 可选且**容忍空串**，`""` 会被当作值 → 会披露；所以这里必须用错类型而不是空串（下面有实测） |
| `operationFingerprint` | `42` | 是：非 string | 否——谓词要求 string |
| `subject` | `42` | 是：`parseSubject` 返回 undefined | 否——读不出身份就没有身份可披露 |
| `targetInstanceId` | `""` | 否（可选且允许空） | 否——空串不算 legacy 投影披露 |
| `requestId` | `req-a4w5-human-acceptance-damage` | 否（可读） | **不是**成员；但会随 `request <id>` 原样带到线上，方便人找到并清理这一行 |

那个陷阱不是推理出来的。在一次性探针世界 `tests/homes/a4-w5-disclosure-probe`（= 验收世界的副本）里，
只把 `toolName` 从 `42` 换成 `""`、其余完全相同地再追加一行，生产读取面回答：

```text
appended sequence 16
corruptCount 2
[
 {
  "sequence": 15,
  "requestId": "req-a4w5-human-acceptance-damage",
  "disclosesMember": false
 },
 {
  "sequence": 16,
  "requestId": "req-a4w5-disclosure-probe-empty-toolname",
  "disclosesMember": true
 }
]
```

同一份损伤：`toolName: 42` → `disclosesMember: false`；`toolName: ""` → `disclosesMember: true`。

探针没被保留成第五个交付脚本（它写盘，不该混进"验证"命令里），但它可以照着这六行复现——
把 `tests/homes/a4-w5-corrupt-acceptance` 复制一份，然后在新世界里：

```js
const seam = await import('./world-seam.mjs')
const opened = await seam.openWorld('<repo>', '<copied world>')
const r = opened.domain.repositories
const root = r.teamSessions.list()[0].rootSessionId
await r.ledger.put({
  schemaVersion: 2, sequence: await r.ledger.allocateSequence(), rootSessionId: root,
  factType: 'control-request-recorded', createdAt: new Date().toISOString(),
  payload: { requestId: 'req-a4w5-disclosure-probe-empty-toolname', kind: 'leader-approval',
             requester: { kind: 'human', humanId: 'probe' }, subject: 42, targetInstanceId: '',
             actionName: '', toolName: '',            // ← 唯一与验收行不同的一处
             correlation: '', operationFingerprint: 42, executionCoupling: 'guarded' },
})
```

再用 `verify-corrupt-world.mjs --world <copied world> --expect-count 2` 读即可。

探针世界按 TEST_METHODS §7 留在原位，
清理 = `rm -rf tests/homes/a4-w5-disclosure-probe`（它比验收世界多一条行，`corruptCount` 是 2，别和 RECIPE 的世界混用）。

登记只取决于损伤本身，不取决于归属（RULING 5-A / W8），所以这条行必然进 `corruptLegs`。

## 4. 两次读数原文（注入前 / 注入后）

命令：`node verify-corrupt-world.mjs --expect-count 0`（注入前）与 `node verify-corrupt-world.mjs`（注入后，默认期望 1）。
脚本是**断言**不是打印：期望不符就 `exit 2`。

### 4.1 注入前（`raw/02-verify-BEFORE-expect-0.log`，exit 0）

```text
═══ a4-w5 corrupt-world verification (production read plane, no server) ═══
WORLD        : /home/user/dsh-plugins/dsh-agent-team/tests/homes/a4-w5-corrupt-acceptance
LEDGER FILE  : /home/user/dsh-plugins/dsh-agent-team/tests/homes/a4-w5-corrupt-acceptance/storages/team_domain.json
TEAM (root)  : session-a4-accept-boot
SERVICE      : ControlService over the open TeamDomain, catalog over blueprints/a4-accept-team.yaml

── READ A  ControlService.listControlState() ──
requests=0 decisions=0 consumptions=0 abandonments=0 escalations=<not exposed on this route>
corruptCount = 0
corruptLegs  = []

── READ B  s6 dispatcher → team.listCorruptControlLegs (contract v9) ──
{
  "teamSessionId": "session-a4-accept-boot",
  "corruptCount": 0,
  "truncated": false,
  "legs": []
}

corruptCount = 0   (expect 0)
disclosesMember = []

VERDICT: PASS — the read plane reports corruptCount=0 exactly as expected

── STILL READABLE  (the same world, other durable reads) ──
ledger rows      : 14
by factType      : {
  "provision-member-instance": 4,
  "team-work-admitted": 2,
  "activity-interval-opened": 2,
  "activity-interval-closed": 2,
  "member-lifecycle-changed": 4
}
team_sessions    : 1 row(s), generation=16
member_instances : 5
control requests : 0 (a refused leg row is excluded; accepted rows are not)

NOTE: this is the ledger the STRICT control reader refuses ONE row of. The storage
      layer read above enumerated every row including the damaged one; the control
      reader filed it as a corrupt leg instead of defaulting it. Both facts are part
      of the limitation statement — see FINDINGS.md.
```

### 4.2 注入这一步（`raw/03-inject.log`）

```text
world already present (copy skipped): /home/user/dsh-plugins/dsh-agent-team/tests/homes/a4-w5-corrupt-acceptance
appended row     : sequence 15 (factType control-request-recorded)
ledger rows      : 14 -> 15

WORLD        : /home/user/dsh-plugins/dsh-agent-team/tests/homes/a4-w5-corrupt-acceptance
LEDGER FILE  : /home/user/dsh-plugins/dsh-agent-team/tests/homes/a4-w5-corrupt-acceptance/storages/team_domain.json
TEAM (root)  : session-a4-accept-boot

next: node verify-corrupt-world.mjs    (production read plane, no GUI, no server)
then: RECIPE.md step "boot it" points boot.mjs --world at this directory.
```

### 4.3 注入后（`raw/05-verify-AFTER-expect-1.log`，exit 0）

```text
═══ a4-w5 corrupt-world verification (production read plane, no server) ═══
WORLD        : /home/user/dsh-plugins/dsh-agent-team/tests/homes/a4-w5-corrupt-acceptance
LEDGER FILE  : /home/user/dsh-plugins/dsh-agent-team/tests/homes/a4-w5-corrupt-acceptance/storages/team_domain.json
TEAM (root)  : session-a4-accept-boot
SERVICE      : ControlService over the open TeamDomain, catalog over blueprints/a4-accept-team.yaml

── READ A  ControlService.listControlState() ──
requests=0 decisions=0 consumptions=0 abandonments=0 escalations=<not exposed on this route>
corruptCount = 1
corruptLegs  = [
  {
    "sequence": 15,
    "requestId": "req-a4w5-human-acceptance-damage",
    "approvalCaseId": null,
    "disclosesMember": false
  }
]

── READ B  s6 dispatcher → team.listCorruptControlLegs (contract v9) ──
{
  "teamSessionId": "session-a4-accept-boot",
  "corruptCount": 1,
  "truncated": false,
  "legs": [
    {
      "sequence": 15,
      "disclosesMember": false,
      "requestId": "req-a4w5-human-acceptance-damage"
    }
  ]
}

corruptCount = 1   (expect 1)
disclosesMember = [
  false
]
marker cross-check: injector recorded sequence 15 and the wire served it

VERDICT: PASS — the read plane reports corruptCount=1 exactly as expected

── STILL READABLE  (the same world, other durable reads) ──
ledger rows      : 15
by factType      : {
  "provision-member-instance": 4,
  "team-work-admitted": 2,
  "activity-interval-opened": 2,
  "activity-interval-closed": 2,
  "member-lifecycle-changed": 4,
  "control-request-recorded": 1
}
team_sessions    : 1 row(s), generation=17
member_instances : 5
control requests : 0 (a refused leg row is excluded; accepted rows are not)

NOTE: this is the ledger the STRICT control reader refuses ONE row of. The storage
      layer read above enumerated every row including the damaged one; the control
      reader filed it as a corrupt leg instead of defaulting it. Both facts are part
      of the limitation statement — see FINDINGS.md.
```

### 4.4 两条旁证：幂等 + 断言真的会咬

- 第二次注入（`raw/04-inject-again-idempotent.log`）：
  `already injected : the damaged row is durable at sequence 15 — NOTHING WRITTEN (idempotent).`
  哨兵 = 账本里存在 `factType==='control-request-recorded'` 且 `payload.requestId === 'req-a4w5-human-acceptance-damage'` 的行。
- 负控制（`raw/06-verify-negative-control-expect-2.log`，**exit 2**）：`MISMATCH: corruptCount 1 !== expected 2`。
  读数错的时候这条命令会失败，不是一句 PASS。

## 5. 源验收世界与 `:3080`：实测未被触碰

```text
# after the live leg:
$ sha256sum tests/homes/a4-accept-20261007T16-57-26Z/storages/team_domain.json
969588a7a4f98ca96f854ea2637acdeb0f76674eebbc1e740c53065b9f33daaa  tests/homes/a4-accept-20261007T16-57-26Z/storages/team_domain.json
# (pre-boot value recorded before any of this task's runs: 969588a7a4f98ca96f854ea2637acdeb0f76674eebbc1e740c53065b9f33daaa)

$ find tests/homes/a4-accept-20261007T16-57-26Z -newermt '2026-10-09 18:00' | head
(empty above = the SOURCE acceptance world was never written by any step of this recipe)

$ (ss -ltn) | grep -E ':318[0-9]|:349[0-9]|:3080|:3081'   # after cleanup
LISTEN 0      511         127.0.0.1:3081       0.0.0.0:*   
LISTEN 0      511         127.0.0.1:3080       0.0.0.0:*   
# 3181/3492 released by stopping the supervisor job; :3080/:3081 are the stable dev instances, never touched (boot.mjs probed :3080 before boot -> status=401, see 08-boot-supervisor.log)
```

- 源世界 `tests/homes/a4-accept-20261007T16-57-26Z/storages/team_domain.json` 的 sha256
  在本轮所有步骤前后同为 `969588a7a4f98ca96f854ea2637acdeb0f76674eebbc1e740c53065b9f33daaa`；
  `find … -newermt` 空 = 该世界里没有任何文件被本轮写过（包括"启动新世界"那一步）。
- `:3080` / `:3081` 全程在监听、从未被本目录的任何脚本连过（端口白名单在 `world-seam.mjs` 里硬编码，族外端口既不探测也不请求）；
  `boot.mjs` 自己在启动前后探测 `:3080`，实测 `status=401`（见 `raw/08`）。

## 6. 已启动宿主上的真实往返（仍然没有 GUI）

启动新世界（`boot.mjs --supervise --world … --port 3181 --mock-port 3492`，作为受管后台作业跑）后，
`node live-check.mjs` 走浏览器真正用的 `/team-remote` 通道（`raw/07-live-check-host-3181.log`）：

```text
origin       : http://127.0.0.1:3181   (world /home/user/dsh-plugins/dsh-agent-team/tests/homes/a4-w5-corrupt-acceptance)
auth         : ok

── team.listCorruptControlLegs (contract v9) ──
{
  "teamSessionId": "session-a4-accept-boot",
  "corruptCount": 1,
  "truncated": false,
  "legs": [
    {
      "sequence": 15,
      "disclosesMember": false,
      "requestId": "req-a4w5-human-acceptance-damage"
    }
  ]
}

── team.getProjection (contract v1) — the rest of the Team must still read ──
keys: schemaVersion, teamSessionId, blueprint, generation, generatedAt, root, templates, members, ledger
{
  "teamSessionId": "session-a4-accept-boot",
  "generation": 17,
  "blueprint": {
    "blueprintId": "a4.accept.team",
    "revision": "1",
    "contentHash": "sha256:af9df261e24f7ffeb50875748d8b0c33a2c53d5b58fd3a4bd5bcc02296e3c912"
  },
  "members": [
    {
      "instanceId": "inst-00o6p7r1q73w",
      "state": "CREATED"
    },
    {
      "instanceId": "inst-0j5egdr0mug1",
      "state": "ARCHIVED"
    },
    {
      "instanceId": "inst-1ivfmm71p1qu",
      "state": "ARCHIVED"
    },
    {
      "instanceId": "inst-1kchdpf029n7",
      "state": "CREATED"
    },
    {
      "instanceId": "inst-leader",
      "state": "RUNNING"
    }
  ]
}

── team.getLedgerPage (contract v1) — the rest of the Team must still read ──
total=15 served=15 nextAfterSequence=n/a
by factType: {
  "provision-member-instance": 4,
  "team-work-admitted": 2,
  "activity-interval-opened": 2,
  "activity-interval-closed": 2,
  "member-lifecycle-changed": 4,
  "control-request-recorded": 1
}
the damaged row IS served on this route: {
  "sequence": 15,
  "factType": "control-request-recorded",
  "payloadKeys": [
    "actionName",
    "correlation",
    "executionCoupling",
    "kind",
    "operationFingerprint",
    "requestId",
    "requester",
    "subject",
    "targetInstanceId",
    "toolName"
  ]
}

VERDICT: PASS — the booted host serves corruptCount=1 and the other Team reads answer too.
```

三条事实：

1. **v9 到了**：真实宿主返回 `corruptCount 1`、`sequence 15`、`disclosesMember false`、`truncated false`——
   正是提示条要渲染的那个 cell。
2. **世界其余部分照常读**：`team.getProjection` 正常（generation 17、5 个成员、绑定的 `a4.accept.team@1`）；
   `team.getLedgerPage` `total=15`。所以损伤是**严格读取器拒收一行**，不是整本账本读失败——
   这正是"限制陈述"里必须分清的两件事。
3. **`team.getLedgerPage` 会把那一行的原始 payload 原样带出**（10 个 key 全在）。这是这条 v1 路由既有语义
   （它就是原始账本读），不是我注入造成的新问题；但它说明"不可归属"只约束**损坏提示条**这条面，
   不约束原始账本面。人若在意这一点，那是另一个产品判断，本轮不改任何东西、只记录。

清理（`raw/10`）：停掉 supervisor 作业后 3181/3492 释放，只剩 `:3080`/`:3081`。

## 7. 限制、坑、以及我**没有**验证的事（未验证清单）

1. **GUI 里那一行没被我亲自确认**：§7.7 是人的验收，我没点浏览器。我证明的是数据侧到得了 v9 响应
   （离线 + 真宿主 HTTP）。RECIPE.md §3 给了逐字预期文案与 DOM 属性，等人现场确认。
2. **离线读 `createTeamDomainReadPort(domain)` 会抛 `TEAM_PROJECTION_SOURCE_TEMPLATES_UNAVAILABLE`**
   （`packages/runtime/src/plugin/projection-source.ts`）：没有生产注入的 catalog-backed `deps.templates` 时它按
   S5A 设计 fail-closed。这是**预先存在**的行为、与损坏无关，活宿主上正常（§6 的 `team.getProjection` 就成功了）。
   我因此没有离线复刻投影读，而是用真宿主补上这一条。
3. **`boot.mjs --stop` 在跨进程调用的沙箱环境里不可靠**：`.accept-host.json` 记的 pid 属于当时的 pid 命名空间
   （实测 marker `supervisorPid: 2, hostPid: 15`），另开 shell 执行 `--stop` 实测把我的 shell 打成 `exit 143` 而宿主仍在监听。
   人自己在同一终端 Ctrl-C 停 supervisor 没有这个问题；RECIPE.md 里写的是"停掉启动它的那个作业/shell"。
   **我没有修改 `boot.mjs`**（按指令：不改它；这里只是把实测坑写下来）。
4. **marker 的 pid 不能当存活判据**：实测 `process.kill(3, 0)` 对内核线程成功、而 `15` 是 ESRCH——
   所以注入前的"是否还在跑"用 TCP 连接探测（只允许 3180 族 / 3491-3500 的端口），族外端口直接拒绝。
5. **耐久字段仍指向源世界的 workspace**：新世界 `team_sessions.defaultWorkspace` 与成员 `workspace` 都是
   `…/tests/homes/a4-accept-20261007T16-57-26Z/workspace`（复制带过来的耐久事实）。实测这样也能正常启动与读
   （§6，generation 从 17 继续），而 `sessions/` 目录名是 workspace 路径的 slug，改写这些路径属于脆弱的语义手术，
   本轮**没有**改；如果人要一个"路径也自洽"的世界，得由产品侧提供正式的迁移路径。
6. **只造了一种损坏形状**：不可归属（`disclosesMember: false`）。自带归属线索的行（`true` → 另一种文案）、
   `truncated`（>20 条，`REMOTE_CORRUPT_CONTROL_LEGS_CAP`）、以及读取失败时的 `view.corruption.checkUnavailable`
   中性提示，都**没有**在这个世界里造出来，仍只有自动化测试覆盖。
7. **注入只在应用停止时有效**（§2）。如果人的流程是先开 GUI 再跑脚本，脚本会拒绝并说明原因——这是设计，不是失败。
8. **本轮没跑 `pnpm test` 全套**：新增文件都在 `dev/**`，落在 eslint / blueprint-fence / p4t6 扫描器的忽略面内
   （实测口径见下），跑/不跑不影响同一份产物；我跑的是与本改动相关的那几项，原文见 §8。

## 8. 本轮改动面与自查

- `git status` 面 = 本目录 4 个脚本 + 2 份文档 + `raw/` 原始输出。`packages/**`、`docs/**`、`tests/**` 零改动；
  `tests/deepseek-harness-test-use` 未 `git add`（gitignored）；世界与 token 不进 git。
- blueprint fence **实测对比**：`node scripts/verify-blueprint-version-clean.mjs` 在主检出（`f1e2a3af`，零新文件）
  与本 worktree（含本目录全部新文件）里 **exit 都是 1，输出逐字相同**（`diff` = 0 行，唯一差异是 ledger 绝对路径前缀，已排除后比较）。
  两边同为 `scanned-in-scope: 775 tracked files`、`dirty(6 files, 15 sites)`、`unknown(0)`、`refused(53 files, 116 sites)`、
  `adjudicated(16 files, 24 sites)`、`RESULT verdict: dirty-or-unknown`。也就是说：
  (a) 这个 `dirty-or-unknown` 是**仓库既有状态**（fence 在干净树上同样 exit 1），**不是**本改动带来的；
  (b) 本改动没往 fence 面里加任何东西——它自己的 scope 行就写着
  `scope: tests/kits/, scripts/, packages/**/harness/, packages/*/test/, packages/**/testdata/, tests/mock/scripts/, cordis.patch.yml (dev/agent-workflow, dist and non-code extensions excluded)`；
  (c) pr-gate 的 `blueprint-fence` 腿只在新出现的 offending path 不在 baseline 身份集里时才 fail
  （`scripts/ci-pr-gate.mjs:776`-`:797`），所以本轮不需要、也没有去动 fence baseline。
- p4t6 指纹扫描只走 `packages/*`（`packages/testkit/fault-injection/session-event-scan.mjs:200`-`:269`），
  `dev/**` 不可能移动 `filesScanned`；`eslint.config.mjs` ignores 含 `dev/**`（本轮 4 个脚本也各自过 `node --check`）。

> **证据完整性披露**：本目录所有原始输出里，登录 token 一律写成 `token=<REDACTED>`（TEST_METHODS：token 不得进 git）。
> 这是本目录**唯一**对捕获文本做过的改动，其余每一行都是从命令输出逐字复制。

## 9. 复跑与清理

```bash
cd dev/agent-workflow/evidence/a4-pr7/human-acceptance
node make-corrupt-world.mjs --copy-only && node verify-corrupt-world.mjs --expect-count 0
node make-corrupt-world.mjs && node make-corrupt-world.mjs && node verify-corrupt-world.mjs
# 启动/停止与 GUI 观察：见 RECIPE.md 第 2、3 步
rm -rf /home/user/dsh-plugins/dsh-agent-team/tests/homes/a4-w5-corrupt-acceptance   # 清理（保留亦可，gitignored）
rm -rf /home/user/dsh-plugins/dsh-agent-team/tests/homes/a4-w5-disclosure-probe     # §3 探针世界（同样 gitignored）
```

`raw/` 里 12 个文件就是上面每条主张的原文；本文件的每个代码块都从那里逐字贴来（`raw/01` 复制、
`raw/02` 注入前、`raw/03` 注入、`raw/04` 幂等、`raw/05` 注入后、`raw/06` 负控制、
`raw/07` 活宿主、`raw/08` supervisor、`raw/09` 宿主日志、`raw/10` 完整性+端口、`raw/11` 字节对比、`raw/12` 披露探针）。
