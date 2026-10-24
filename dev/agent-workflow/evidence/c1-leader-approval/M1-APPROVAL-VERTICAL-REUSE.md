# M1 审批纵切 — B-Control 核验与 A 复用件（2026-10-25，root 裁决后）

作者：B-Control lane owner（分支 `feat/a5m2-wire-g1` @ `8d1410567`）。
用途：A 第三窗 worker 的 request-control 被 worker mutation envelope 挡 → 按裁决给
**该隔离测试 worker** 授予"仅对本 Team/自身调用发起 request-control"的最小 fixture 授权。
本文件全部为**真实源码引用**（非 querysmoke 推演）。阶段 fixture 授权 **不得**推广为产品默认。

## 1. 真实 PermissionMutationEnvelope 完整 shape（原 M1 来源，逐字）

- **运行时规范定义**：`packages/runtime/governance/permission-mutation.ts`
  - `:611 PermissionEnvelopeRule = AuthorityEnvelopeRuleDocument`
  - `:619 PermissionMutationEnvelope = AuthorityEnvelopeDocument`
  - `:624 parsePermissionMutationEnvelope(raw)` — 唯一验证/冻结口。
- **文法 leaf（document/rule/matcher 的真实字段名）**：
  `packages/domain/authority-envelope/src/authority-envelope.ts`
  - AST（blueprint 声明形，`:211-228`）：
    `{ rules: [ { operationClass: string, matcher:
        { kind:'exact', path } | { kind:'subtree', path } | { kind:'fingerprint', fingerprint },
        maximumEffect: 'allow'|'ask'|'deny' } ] }`
  - runtime（canonical 形，`:240-261`）：matcher 的 `path|fingerprint` 塌缩为 `resource`
    （opaque canonical identity）；塌缩**只发生一次**，在
    `permission-plane.ts:557 buildAuthorityEnvelope`（AST→runtime 唯一 canonicalization，按 cwd 解析）。
- **parse 法**（`permission-mutation.ts:624-673`，逐条实测源码）：
  1. `{rules}` 非 record/非数组 → `envelope-not-a-record` / `rules-not-an-array`；
  2. `operationClass` 必须落在**封闭词表** `AUTHORITY_OPERATION_CLASSES =
     [read, read_image, write, edit, lsp, bash, pwsh]`（authority-envelope.ts:91-99；
     表外 token = `operation-class-unknown` 拒绝，"never silently inert"）——
     **team_request_control 不是 operation class**：envelope 只谈文件/执行操作，
     request-control 是工具行（§2），两者的授权面不可互换；
  3. `maximumEffect ∈ allow|ask|deny`；
  4. shell 类（bash/pwsh）**fingerprint-only**（exact-only，永不 subtree 加宽）；
  5. `(operationClass, resource)` 对**至多一次**（`duplicate-envelope-pair`）；
  6. 空 `rules` **合法且唯一含义 = 零展开授权**（fail-closed；tightening 不受影响，A1-4 双平面律）。
- **blueprint 载体字段**：`blueprint.permissionMutationEnvelope`
  （`permission-plane.ts:728 buildEnvelope`：absent 或空 rules → `NO_ENVELOPE={rules:[]}`，
  零 fs 调用的**类型化沉默**）。注意与 `teamHardEnvelope`（Human User 硬顶，approval plane）
  区分：同 shape、反含义（absence 在展开面=拒绝一切，在审批面=不加窄）。

**A 的墙的精确解释**：worker 蓝图 `permissionMutationEnvelope` 缺失/空 → 展开面 no-authority。
edit-Ask 决议落地要动的是 worker 自身文件的 `edit` 权限展开；`{rules:[]}` 时**即使 Leader
allow 也无法展开**（这不是 bug，是 A1-4 fail-closed 律）。

## 2. 已验证 M1 审批纵切（请求 → Leader 决议 → 同 call 消费）源码位点

- **封闭 13 工具面 + 行名**：`packages/runtime/src/plugin/live/team-tool-plane.mjs:171-178`
  （`team_request_control` / `team_resolve_control` / `team_list_pending_control` 等，closed set）。
- **PA 表（B-CONTROL rev-8 FULL-PAIRING，records 83/84/85/87/88）**：
  `packages/runtime/control/types.ts:1478-1555`——
  required 六叶（controlRecord + trusted 五件）；
  `request-control` variant adds：`requestRootSessionId/requestToken/requestKind/
  requestTargetInstanceId/requestActionName/requestToolName/requestSummary`（可选 lane 参数
  走 reviewed-encoding，omitted='absent'）；`resolve-control` adds
  `requestCaseId/requestDecision/requestNote`；`list-pending` adds `requestLimit`；
  `grant/revoke-permission` adds `permissionTargetInstanceId/permissionRules`（rules 全值
  canonical JSON）。
- **同 call 消费三定则（本分支实测绿，assembly/PA-真实链层面，tier=接线未测）**：
  `packages/runtime/test/a5m2-g1-wire-c1.test.ts`
  - `:2145` CONTROL row 端到端：durable row 携 rev-8 全值块 → **leader allow →
    ONE consumption → captured native entered ONCE**；
  - `:1050` FIXED POINT 1 同 call 身份：durable row / 注册定义身份 / minted variant 叶
    出自**同一次 classify/plan**；mixed-origin/moved feeds 零 row 拒绝；
  - `:931` CURRENT-facts 律：审批等待期间 topology 移动 → **消费后拒绝、零 native**；
  - `:948` 共享 token 律：未绑 token / in-flight 重放 / settled 重放 → 全拒、零额外 row；
  - `:966` 预取消：signal 已 abort → PA 边界即 cancelled，零 Control row。
  - 历史 live 参考（旧 fixture 语义件）：`dev/agent-workflow/evidence/c1-leader-approval/smoke/
    c1-smoke-2026-09-18T09-27-24/`（pending→resolve→ledger-final 三段账变）。

## 3. A 复用件（按 root 裁决的最小面，仅隔离测试 worker）

在 **A 的第三窗隔离 worker 蓝图**上给 `permissionMutationEnvelope` 添加**恰好所需**的规则
（AST 形，进 `buildAuthorityEnvelope` canonicalize）：

```yaml
permissionMutationEnvelope:
  rules:
    - operationClass: edit
      matcher: { kind: subtree, path: <worker 自身工作目录（fixture 内）> }
      maximumEffect: allow
```

- 只授 **edit 展开到 worker 自身目录子树**——这是 edit-Ask 决议落地所需的最小展开授权；
  `read/write` 等其他类、其他路径一律不加（每对 (operationClass,resource) 至多一条）。
- **不**给 worker 任何 resolve 能力：`team_resolve_control`（84）是 Leader 行；envelope
  本来就只谈文件/执行操作，授予它也不会扩到 resolve/policy——裁决的"不准自行
  resolve/approve/扩 policy"由**行身份 + PA + 封闭表**把住，不由本 fixture 授权把住。
- 83 行的 PA 审批（请求发起本身）在 A 的 world 需要 B-CONTROL 行 armed；若 A 的 world 未开
  closed-key，request-control 走 native host 路径——A 用哪条路取决于其 world 的 armed 状态，
  两条路 worker 都只能"发起"，决议恒在 Leader/受控测试路径。
- **阶段口径**：本文件 §2 的"已验证"= 源级/PA 真实链 assembly 层（接线未测），live-Host
  C2 执行仍待主冻结 SHA/f86 后按已呈报 runner 方案跑；届时才允许"已测"字样。
- **推广禁止**：以上 envelope 规则是**测试世界 fixture 属性**；产品默认（`{rules:[]}`
  fail-closed）不动、不"顺手修"。
