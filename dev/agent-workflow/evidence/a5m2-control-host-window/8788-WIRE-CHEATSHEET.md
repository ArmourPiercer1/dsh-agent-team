# 87/88 WIRE/CARRIER 复用料（B→A，E8/E9 唯一合法复用源；tier：**接线未测**）

来源 commit：`11623d82c`（本文件随附修正 commit 仅注释）；文件 `scripts/05-control-window-runner.mjs`（sha256 见 commit）。
**复用纪律**：以下全部为 B 实测代码的**原文引用**（parseBlueprint 离线 PARSE-OK 验证过形状），但 87/88 链本身**尚未在 Host 窗开火**——A 引用不得升格为"已测"。

## 1. WIRE 实发形状（driver :605 / :612，tools.js 合同）

```js
// team_grant_permission（87；revoke=88 同形状换名/token）
{
  rootSessionId: '<team rootSessionId>',
  requestToken:  'ctlhw-grant-<nonce>',            // 每次调用唯一
  targetInstanceId: '<member instanceId>',          // 单实例
  rules: [
    { operationClass: 'read',
      matcher: { kind: 'exact', value: 'package.json' },   // WIRE matcher = {kind, value}
      effect: 'allow' }
  ]
}
```
- closed `required: ['rootSessionId','requestToken','targetInstanceId','rules']`（fixture dist `packages/tools/src/tools.js` permissionSpec）
- Leader-only 前置：`caller.kind==='instance' && caller.instanceId===LEADER_INSTANCE_ID`，否则 `status:rejected`（TEAM_TOOL_PERMISSION_NOT_LEADER）
- effect 封闭：`allow|ask|deny`（PERMISSION_EFFECTS）；WIRE matcher kinds：`exact|subtree`（value 非空串 ≤4096）或 `exec`（`{kind:'exec', intent}`，exec 类专用）

## 2. 三套闭合语法（同一 fs 事实，三个源各拼各的——勿通吃）

| 层 | matcher 字段 | 源（fixture dist） |
|---|---|---|
| 蓝图 carrier（本文件 SAVED_BP） | `{ kind, path }` | `domain/blueprint/src/schema.js:213-216` FILE_MATCHER_FIELDS |
| WIRE grant/revoke 规则 | `{ kind, value }` | `tools/src/tools.js` parsePermissionRules |
| 运行时 overlay | `{ kind, resource }` | `runtime/governance/permission-mutation.js` validateMatcher（kinds 另含 `fingerprint`；fs 类禁 fingerprint，shell 类必 fingerprint） |

（B 首次实现曾用 WIRE 语法通吃三处——`parseBlueprint` 离线当场拒绝 `unknownFields:['resource']`，即表第一行 `{kind,path}` 为正。**A 的 E8/E9 三处勿混。**)

## 3. 已核 carrier YAML（SAVED_BP 内、boot-anchor 保持 `rules:[]`）

```yaml
permissionMutationEnvelope:
  rules:
    - operationClass: read
      matcher:
        kind: exact
        path: package.json
      maximumEffect: allow
teamHardEnvelope:            # schemaVersion-3 双 ceiling，永不合并，双覆盖才放行 expansion
  rules:
    - operationClass: read
      matcher:
        kind: exact
        path: package.json
      maximumEffect: allow
```

## 4. 判据锚点（B 的 L6/L7 所用，A 可映射到 EDIT）

- 基线：grant 前 member 面执行被 `default:deny` 拒（需显式 deny 形文本，未知格式 FAIL）
- 87 双证：ledger `permission-mutated` 事实 **且 payload 载规则原文**（durable）
- 消费面：pre-execute 治理车道消费 overlay（源：`operation-permission/pre-execute-adapter.js:21-22` "read tool + … (ask OR default-deny) decision"）——A 换 `operationClass:'edit'` + 靶文件 path（exact），carrier 双 ceiling 同构镜像
- 88 链回：第二条 mutated 事实 + **行为级无残留**（再执行被拒），revoke 若 `status:rejected` 原样 FAIL（reveal-expansion 需 carrier 覆盖，无覆盖零写入属设计）
