# pa-CONTRACT — PR2/PR3 生产装配契约（P-A writer → GLUE-5）

- writer = P-A（qwen3.8-flash-next），分支 `alpha5-prod-pr23`，基 = `origin/master @ d714a941`（亲 fetch）。
- 范围 = **仅** `packages/runtime/tool-admission/**` + `packages/runtime/controlled-fs/src/**` + 各自测试（`packages/runtime/test/a5p2-*.test.ts`、`packages/runtime/controlled-fs/test/**`）。
- 共享入口零改：`agent-bindings.mjs`（src+dist）、`packages/runtime/dist/**`（提交态 dist 由 GLUE 单 writer 再生成）、根配置（`vitest.config.ts` / `packages/runtime/tsconfig*.json`）、`packages/domain/test/a5p0-layer-audit.test.ts`、`packages/testkit/test/p4t6-session-event-scan.test.ts` 全部零字节改动。
- 账本事实（GLUE-5 免猜）：本轮 **packages/** 下新增文件 = 0**（生产类落在既有 lane 模块内，测试追加进既有测试文件）⇒ p4t6 tie = 0；a5p0 consumer 集不变（新代码零新增 tool-governance 文件边——`approval-case.ts`/`admission-kernel.ts` 本就是已具名消费者，新增 import 名字不新增文件边）；GLUE-5 仅需做 dist 再生成（`check:artifacts`）。
- 范围声明：**GLUE-4 的 scoped 互斥不在本线**；本线只交付 lane 内生产模块到"可被装配的公开 API + barrel + 本契约"完整态。端口/世界零触碰（kit 真跑归 GLUE-5 集成轮，见 §6）。

---

## 1. 导出符号（装配面 = 两个 barrel，均为纯增）

### 1.1 `@dsh-agent-team/runtime/tool-admission`（`packages/runtime/tool-admission/index.ts`）

新增自 `admission-kernel.ts`：

| 符号 | 种类 | 一句话 |
|---|---|---|
| `createProductionAdmissionAssembly(config)` | 函数 → `GovernanceResult<ProductionAdmissionAssembly>` | **kernel admission 生产入口类**：吃真实授权输入（模板 `capabilities.permissions` 的 A1 规范对象），派生 PR0 `ToolPolicyDocument` + `PolicyDenySource[]`，装配 `createAdmissionKernel`，并提供 PR3 exec-edge 的 FS admission 端口适配器 |
| `ProductionAdmissionConfig` | type | 构造参数（§2） |
| `ProductionAdmissionAssembly` | type | 装配句柄（§3） |
| `ProductionFsAdmissionPort` | type | 与 C-FS `FsAdmissionPort` 结构同形的端口（kernel 执行边适配器） |

新增自 `approval-case.ts`（装配可单测的派法律，装配之外一般不直接用）：

| 符号 | 种类 | 一句话 |
|---|---|---|
| `deriveTeamPolicyAuthority(input)` | 函数 → `GovernanceResult<TemplatePolicyProjection>` | 模板策略 → PR0 文档/deny 源的纯派生（kit `allowPolicy(tg, arms)` 常量的生产替代） |
| `TemplatePolicyProjectionInput` / `TemplatePolicyProjection` | type | 派生入参/结果 |

### 1.2 `controlled-fs` lane barrel（`packages/runtime/controlled-fs/src/index.ts`）

新增自 `admission-binding.ts`（既有"唯一被认可的接线入口"模块）：

| 符号 | 种类 | 一句话 |
|---|---|---|
| `createProductionControlledFsProvider(config)` | 函数 → `ProductionControlledFsProvider`（构造违例 = typed `TypeError`，与 `bindAdmissionRecheck` 同风格） | **C-FS 生产 provider 类**：固化 kit 的 `gatedLane(...)` 序列——每次被放行的调用（`AdmissionBoundFsCall`）→ `createAdmissionGatedControlledFs`，代际/时钟/已消费视图全部来自注入的读口 |
| `ProductionControlledFsProviderConfig` / `ProductionControlledFsProvider` | type | 同上 |

既有符号零改名、零删除；`ARBITRARY_TREE_PROFILE_PUBLISHED=false`、`UNBOUND_ADMISSION_RECHECK`、`bindAdmissionRecheck`、`createAdmissionGatedControlledFs` 四法则原样（`a5w-integration-wiring` 钉死面零扰动）。

## 2. 构造参数（`ProductionAdmissionConfig`）——每参数=谁在真宿主上供给

```ts
interface ProductionAdmissionConfig {
  // ── 真实授权输入（非 fixture 常量）──
  permissionPolicy: TemplatePermissionPolicy      // = boundTemplate.capabilities.permissions
      // agent-bindings.mjs:2031 读到的 A1 规范对象（default + allow/ask/deny 三 lane，
      // 规则 = { tool, resource: exact|subtree|any }）；蓝本 validate/normalize 已在
      // blueprint 解析期完成，本入口再验证形状（防御）且 fail-closed 投影（§5 投影律）。
  realmId: string                                  // PR1 guard 发布所用 Realm 名
  templateId: string                               // deny-source 溯源前缀（sourceRef = `<templateId>#deny[<i>]`）
  definitionOwnerAuthority: RuntimeAuthority       // 静态模板 lane 的属主 rung（GLUE-5 依 Team-definition 采纳方给定；'member'|'leader'|'human-user'|'human-admin'）
  role: 'leader' | 'member'                        // 本次安装的角色（shell allow-any 的语法角色门）
  // ── 受信任运行输入（装配供给，绝不来自模型）──
  clock: () => number                              // 宿主墙钟（每调用 H1 有限性门把关；无 fixture 固定时钟）
  authorityGeneration: () => number                // 与 guard 发布代际一致（identityChecks 用它；denySources.sourceVersion 读时=它）
  beneficiaryAuthority: RuntimeAuthority           // 本安装受益 rung（member 安装='member'，leader 安装='leader'）
  documents?: () => AuthorityEnvelopeDocuments     // 默认 = { teamHardEnvelope:{rules:[]}, permissionMutationEnvelope:{status:'absent'} }（"存在但零收窄"——与 Alpha.4 permission-plane 无 mutation 事实同形；有真实硬顶文档时必须注入）
  canonicalizeResource?: (declaredPath: string) => string | null
      // 声明路径 → 效应 canonicalLocator 的宿主正则化（Alpha.4 的 fs 正则化同一来源）；
      // 缺省时规则路径必须以 '/' 开头（absolute-path 实例恒等映射），否则构造失败。
  subtreeContains?: SubtreeContains                // planes 的包含律注入；含 subtree 规则而缺它 ⇒ 构造失败（不是运行时 undetermined）
  leaderExecTokenPresent?: () => boolean           // leader shell-allow-any 的双门读口（Alpha.4 语义）；缺省 ⇒ 该规则降为 ask 并记 note（绝不静默 allow）
  assuranceProbe?: AssuranceProbe                  // 默认 = createStubAssuranceProbe({})（各维 'untested'——硬顶永不被 redeem；PR4 OS 面落地后由宿主换真探针）
  requiredAssurance?: RequiredAssuranceReader      // 默认 = () => ({})
  grantExpiry?: (issuedAt: number) => number | null// 透传 kernel（默认 null=不过期，PR0 法）
  ledger?: GrantLedger                             // 默认新建（同 kernel；跨重启消费事实归 PR7，注记在册）
  cancelRequested?: (callId: string) => boolean    // 执行边取消视图（端口消费时读；缺省 () => false）
  onObserve?: (event) => void                      // 观测汇（构造/默认-deny 门/投影 note 事件）
}
```

`ProductionControlledFsProviderConfig`（C-FS provider）：

```ts
interface ProductionControlledFsProviderConfig {
  realmId: string                                   // 与 assembly 同一 Realm
  instances: readonly ControlledFsInstance[]        // 宿主登记的实例根（fs/rootDir/kind:'absolute-path'），realmId 必须一致
  clock: () => number                               // lane 的 now（非有限 ⇒ lane 自身 typed 拒）
  authorityGeneration: () => number                 // 每次 gateCall 读时取（lane config 的 per-call 值）
  consumed: (grantId: string) => boolean            // = assembly.ledgerView（消费视图，只读）
  subtreeContains?: SubtreeContains                 // C1 子树律注入（与 assembly 同一读口即可）
  visibility?: (member: {teamSessionId,instanceId}, descriptor) => 'visible'|'hidden'  // 观测政策缝（结构型，免第二类型拼写）
}
```

## 3. 装配句柄（`ProductionAdmissionAssembly`）

| 成员 | 语义 |
|---|---|
| `kernel` | 底层 `AdmissionKernel`（planApproval / issueApprovedGrant / lease 直通口——审批循环归 GLUE-5 + Alpha.4 case） |
| `policyDocument()` | **读时**派生的 PR0 文档（leader exec 双门每次读时求值——overlay 变化即时生效） |
| `denySources()` | 读时派生 `PolicyDenySource[]`（`sourceRef=<templateId>#deny[i]`、`ownerAuthority=definitionOwnerAuthority`、`sourceVersion=authorityGeneration()` ⇒ 恒与 identityChecks 同步、可信） |
| `admitCall(request)` | 默认门 + `kernel.admit`（`default:'deny'` 且无任何投影规则覆盖该效应 ⇒ `{kind:'denied', code:'IO_POLICY_UNSUPPORTED', refusal:'template-default-deny'}`，零 kernel 副作用——与 H1 同姿态） |
| `createFsAdmissionPort(request, grant)` | PR3 端口适配器：`recheckCall` = kernel 执行边 `consumeForExecution`（one-shot：已消费 ⇒ `grant-consumed`；代际/取消等 ⇒ `grant-invalid`） |
| `projectionNotes` / `consumed(grantId)` / `realmId` | note 只读集 / 消费视图（喂 C-FS provider）/ Realm |

**一次被放行的 C-FS 操作 = 一个 grant**（lane 的 revalidate+recheck 在第二次操作时即 `CONSUMED`——kit 每 op 独立 `admitOp` 的实况即此法；GLUE-5 每个受控文件操作 = 独立 `callId` 的 admitCall）。

## 4. 期望宿主调用点（GLUE-5 = 唯一装配 writer）

挂载点 = `packages/runtime/src/plugin/live/agent-bindings.mjs` 的 per-agent 装填闭包：`permissionPolicy`（`:2031`）与 guard 装填（`:2203` `installScopedToolGuard`）之后、Agent 发布之前构造 assembly；**构造失败 = 与 guard 装填失败同姿态拒发 Agent**（typed error 上抛，AgentSetup 回滚）。每工具调用在既有 pre-execute 链后走 `admitCall`；文件效应体经 provider 的 gated lane 执行（deny-before-open 在 lane 内）。

```js
// ── GLUE-5 接入样例（per-agent，guard 装填成功后）────────────────────────
import * as ta from '../tool-admission/index.js'          // dist 形态: runtime/tool-admission/index.js
import * as cf from '../controlled-fs/src/index.js'       // dist 形态: runtime/controlled-fs/src/index.js

const backend = fsBackend(agentCtx)                       // 既有 Alpha.2 fs seam（resolveTarget/contains）
const built = ta.createProductionAdmissionAssembly({
  permissionPolicy,                                        // ← 真实授权输入（boundTemplate.capabilities.permissions）
  realmId: a5RealmId, templateId: String(boundTemplate.templateId),
  role: isLeader ? 'leader' : 'member',
  definitionOwnerAuthority: 'human-user',                  // Team-definition 采纳 rung（GLUE-5 定夺并留证）
  clock: () => Date.now(), authorityGeneration: () => a5AuthorityGeneration,
  beneficiaryAuthority: isLeader ? 'leader' : 'member',
  documents: () => permissionPlaneRef?.current?.authorityDocuments ?? undefined0 /* 真文档（缺省=零收窄） */,
  canonicalizeResource: (declared) => resolveTarget(declared)?.ok === true ? resolveTarget(declared).value.targetKey : null,
  subtreeContains: (rootKey, childKey) => backend.contains({ targetKey: rootKey }, { targetKey: childKey }) === true,
  onObserve: (row) => observations.push(`a5p2prod: ${String(row.event)}`),
})
if (!built.ok) throw Object.assign(new Error(`alpha5 admission assembly refused: ${built.error.message}`), { code: built.error.code })
const assembly = built.value
const fsProvider = cf.createProductionControlledFsProvider({
  realmId: a5RealmId, instances: [{ fs: 'team', rootDir: teamFileRoot, realmId: a5RealmId, kind: 'absolute-path' }],
  clock: () => Date.now(), authorityGeneration: () => a5AuthorityGeneration, consumed: assembly.consumed,
})

// ── per governed file op（一个 op = 一个 callId = 一个 one-shot grant）──
const decision = await assembly.admitCall({ binding, member, callId, realmId: a5RealmId, parametersFingerprint, requestedEffects })
if (!decision.ok || decision.value.kind !== 'admitted') { /* 呈现原文；体零执行 */ }
else {
  const lane = fsProvider.gateCall({
    admission: assembly.createFsAdmissionPort(request, decision.value.grant),  // exec-edge = kernel consumeForExecution
    parametersFingerprint: decision.value.grant.parametersFingerprint,          // C1：绑定本调用 PR1 canonical 指纹
  })
  const res = await lane.fs.readText(decision.value.grant, ref, { offset: 0, limit: null })
}
```

**GLUE-5 待补的宿主侧一缝（非本线）**：`ToolBinding` 的真来源——PR1 guard handle 现在**不**暴露已发布 binding（`tool-dispatch/install.ts` 无 binding 访问器；GLUE-4 scoped 面归它）。装配方二选一：给 guard handle 加只读 `bindingFor(name)`（tool-dispatch lane，走它的评审），或由 guard 发布事实经 `parseToolBinding` 重建同值 binding。契约按 `admitCall(request.binding)` 冻结输入形状（`ToolBinding`，PR0 `grant.ts/interfaces.ts`）。

## 5. 投影律（模板 lane → PR0 文档；`deriveTeamPolicyAuthority` 的实现即此表，逐条有单测钉）

| 模板规则 | 投影 | 失败姿态 |
|---|---|---|
| `{tool: read/read_image, exact\|subtree p}` | `read@realm\|canon(p)` + `meta@同 matcher`（C-FS resolve/stat 腿需 meta；无它则 allow 了 read 的调用在 meta 腿上变 Ask——功能断裂）+ `tool-invoke@realm\|tool:<tool>` 同 lane | `p` 不可正则化：allow ⇒ 跳过+note（no-authority⇒Ask，只紧不松）；ask/deny ⇒ **构造拒**（丢规则=放松） |
| `{tool: write/edit, exact\|subtree p}` | `write` + `meta` + `tool-invoke` 同上 | 同上 |
| `{tool: lsp, exact\|subtree p}` | 仅 `tool-invoke`（PR0 无 lsp 资源效应映射）+ note | **deny** lane ⇒ 构造拒（资源级 deny 无法表达，宁可拒装不可放松） |
| `{tool: bash\|pwsh, any}` ask/deny | `tool-invoke@realm\|tool:<tool>` 同 lane（shell 无资源维——完全表达） | exact/subtree ⇒ 构造拒（A2C-1 语法） |
| `{tool: bash\|pwsh, any}` allow（leader 合法形） | 双门读口真 ⇒ allow；假/缺省 ⇒ **ask** + note（绝不静默 allow） | member 形 ⇒ 构造拒（蓝本语法已拒的防线重钉） |
| `{tool: 文件类, any}` allow | 仅 `tool-invoke` allow + note（资源效应走 no-authority⇒Ask——比模板更紧，披露） | — |
| `{tool: 文件类, any}` deny | — | **构造拒**（`IO_POLICY_UNSUPPORTED`：无 `any` matcher 的文档族表达不了资源级全拒；伪造一条=放松 deny） |
| `default: 'ask'` | 无需规则（PR0 no-authority ⇒ Ask 与模板语义同形） | — |
| `default: 'deny'` | `admitCall` 前置门：效应不被任何投影规则覆盖 ⇒ typed denied（零 kernel 副作用） | 有 subtree 规则而缺 `subtreeContains` ⇒ 构造拒 |
| deny lane 全部规则 | 同时投影 `PolicyDenySource[]`（声明序、`deny[i]` 溯源、owner=`definitionOwnerAuthority`、version 读时=authorityGeneration）——R-1a 具名 deny 源就位，ruling ① 的 upgradable-Ask 走 kernel 原路 | — |

范围匹配 = PR0/plane 的 matcher 语义（exact 恒等、subtree 走注入的 `SubtreeContains`）；lane 文档规则顺序 = 固定 `allow→ask→deny` × lane 内声明序（deterministic，镜像 A1 规范化的"保声明序不并条"）。

## 6. kit 改消费（删重复实现）——**GLUE-5 执行**，原因如实

kit 消费的是**提交态 `packages/runtime/dist`**；本轮 dist 零改（GLUE 再生成）。因此证据 kit 的换装+复跑只能在 GLUE-5 的 dist 再生成之后做（且 LIVE kit 触端口/世界，本轮红线不触）。逐文件替换表（删重复实现 = 这些 fixture 函数改为调用生产类）：

| kit 文件（`dev/agent-workflow/evidence/alpha5/…`） | 重复实现 | 生产替代 |
|---|---|---|
| `live/a5live-fixtures.mjs`、`wiring/we2/a5e2-fixtures.mjs`、`wiring/w5/a5w5-fixtures.mjs` 的 `makeLiveHarness`/`allowPolicy`/`admitCall`/`execEdgeConsume` | 手装 kernel + 常量 arms 策略 | `createProductionAdmissionAssembly`（模板策略对象替 `policyArms`）+ `admitCall` + `createFsAdmissionPort` |
| `wiring/c0405/a5c45-fixtures.mjs` 的 `makeAdmissionStack`/`fsPortFor`、`wiring/c08/a5c08-fixtures.mjs` 同型 | port 手接 kernel | `assembly.createFsAdmissionPort(request, grant)` |
| `wiring/c0405/a5c45-editor-image-row.mjs:268` `gatedLane(...)`、`wiring/c08/a5c08-image-row.mjs` 同型 | 手组 `createAdmissionGatedControlledFs` config | `createProductionControlledFsProvider({...}).gateCall(bound)` |

零回归判据（GLUE-5 复跑口径）：各 kit criteria 集不变（W5 gated/ungated 对照、C0405 37/37、C08 组），仅装配来源从 fixture 函数换成生产类；本轮我方以 **编译产物 import 冒烟**（`pa-smoke-installed.mjs`，非 kit tsconfig）先行钉死"kit 可消费性"（§7 验证行）。

## 7. 验证（本轮实测；数值见同目录 log）

1. lane 编译：`tsc -p packages/runtime/controlled-fs/tsconfig.lane.json`（lane 全量 typecheck）+ `tsc -p packages/runtime/tsconfig.json`（含 tool-admission 的 runtime 型面）——`pa-tsc.log`。
2. 安装包态自测：`tsc -p packages/runtime/tsconfig.build.json --outDir <scratch>`（**不触提交态 dist**）后，`pa-smoke-installed.mjs` 以纯 ESM `import` 编译产物 barrel（`runtime/tool-admission/index.js`、`runtime/controlled-fs/src/index.js`——与 kit 消费路径同形），驱动 模板策略→admit→gated lane 真读/真写 + replay 拒 + 默认-deny 拒 全链——`pa-smoke.log`。
3. lane 单测：`a5p2-*` 全组（含新增 production-assembly/derive legs）+ `controlled-fs/test/**`（含新增 provider legs）+ `a5w-integration-wiring`（法则零扰动回归钉）——数值写入本文件末尾"回归记录"。

## 回归记录（writer 实测）

- lane 编译（`pa-tsc.log`）：C-FS lane / runtime 全包 / runtime 构建配置（→ scratch outDir）三绿 EXIT=0×3；工具链 node v24.21.0 + typescript 6.0.3 + vitest 4.1.11。
- 安装包态自测（`pa-smoke.log`）：**12/12 CRITERIA PASS**（纯 file-URL `import` 编译产物 barrel，驱动 模板策略→admit→port→gateCall→真读/真写 + one-shot replay 拒 + 默认-deny 门 全链；世界建于 tests/homes/a5pa-smoke-*，teardown 已删）。
- 单测（`pa-vitest.log`）：**基线 140/140（11 文件，本轮改动 stash 后实测）→ 改后 197/197（14 文件）** = 既有 140 **零回归** + 新增 22 legs（kernel 文件投影律 9 + composition 生产链 8 + C-FS provider 5）+ 共享钉 35（a3p3 hygiene 21 / a5p0 layer-audit 4 / p4t6 scan-ledger 10 全绿 ⇒ 消费面文件集与扫描数零扰动）。
- 证据文件 = `pa-CONTRACT.md` / `pa-smoke-installed.mjs` / `pa-tsc.log` / `pa-smoke.log` / `pa-vitest.log`（本目录）。scratch 编译树 `tests/homes/.pa-smoke/`（gitignored）验证后删除；复现命令在 log 头。
- 账本零触碰确认：`git status` 变更面 = 7 个既有文件（2 源 + 2 barrel 行级 + 3 测试）+ 本 evidence 目录新增；`packages/runtime/dist`、根配置、`agent-bindings`(src/dist)、a5p0/p4t6 测试文件均零字节改动；packages/** 新增文件 = 0。
- 分支 `alpha5-prod-pr23` @ 提交 SHA：见本文件 git blame / 汇报消息（HEAD 40-位随 send_message 报父 agent）。
