# 入口对照（根 01:38Z 硬令②）：v4-flip 原始 authoring 面 vs GLUE-8 装配面 — 逐字段

两份 BP 的字节件 = 各 run 目录 `bp-v4-authoring.yaml`（capture 自 boot 现场；
preassembly 面与 `dev/agent-workflow/evidence/alpha5/v4-flip/run-v4-live-leg.mjs`
的 `v4BlueprintYaml` 逐字一致处以下表标注 VERBATIM）。

## member.capabilities 逐项

| 字段 | v4-flip RED 面（= preassembly，逐字保留） | a5g8 assembled 面 | 生效 lane 决策（实测） | 出处/性质 |
| --- | --- | --- | --- | --- |
| `teamTools` | `kind: deny` | `kind: allow, items: []` | plane 行属 team-tool 家族（agent-bindings:2575），deny 显式拒治理行（实测 member 弧死） | **#321 GLUE-7 已产 kit member 同形面**；native team_* 仍靠缺席关闭；非扩权（可达集 +治理行=本单交付物本身） |
| `permissions.default` | `ask` | `ask` | — | VERBATIM |
| `permissions.allow` | `[]` | `[{tool: read, resource: any}]` | placement 名 `read` ∈ kernel lane 闭集词 → allow 命中 → governed read 行执行（C1 真字节） | **#321 kit member 同形面**；本单③"read 真字节"的正控要求 read 可达；RED 面无 plane 行故 [] 即可 |
| `permissions.ask` | `[{tool: bash, resource: any}]` | `[{tool: bash, resource: any}]` | RED 世界 native `bash` 命中 → durable leader-approval 开（A4.1 ✓ 14/14）；**assembled 世界 `team_bash` 不开任何 request（实测，见下）** | VERBATIM——**ask 面本轮一字未改**，故差异不可归因于"配置没要求 ask" |
| `permissions.deny` | `[]` | `[]` | — | VERBATIM |
| toolBindings 家族 / envelopes / quotas / policyStates / leader 模板 | — | — | 无运行时消费者（README §1 差③） | VERBATIM |

## 生效 lane 决策链（assembled，逐项实测）

1. **`read`**（placement 名 = 原生词）→ host kernel permission lane 闭集词面直接
   命中 `allow: read any` → 放行 → plane governed-read 行执行真字节。
2. **`team_grep` / `team_glob`**（非闭集词）→ host kernel lane **不 addressed**
   （grep/glob 不在 permission 家族闭集 `read|read_image|write|edit|lsp|bash|pwsh`，
   create 期 MALFORMED_DTO 实测钉死该闭集）→ plane 行自身治理（Guard 绑定身份 +
   confined backend + 行 schema；glob 落 `IO_POLICY_UNSUPPORTED` 诚实 shut）。
3. **`team_bash`**：显式 `ask: [{tool: bash, kind: any}]` 在场时**仍不开 durable
   request**（run 证据：`bp-v4-authoring.yaml` + `a4-control-ledger-ask.json`
   requests=[] + decisions=[] + consumptions=[]）。机制：durable leader-approval
   是 **host 内建工具的治理面**，plugin 注册行不进入；plane 内部 lane
   （team-tool-plane.mjs `createLaneDecide`）虽经 `DEFAULT_PLANE_NAMES` 把
   `team_bash` 解回 bash 类（GAP PROBE G1 修复面），但该 lane **只有 deny/allow
   两臂，没有 ask 臂**——ask→durable 的接线在 placement 行上不存在。

## 结论（权限独审裁定 81861aa1 已到，引文对号）

- 裁定：**重钉合法，绕过不成立**——直跑的四调用无一属"必须 ask"臂
  （team_* lane 不可寻址：types.ts:203 unsupported 类 +
  permission-coverage.ts:66-78 OTHER_MANAGED_TEAM_TOOL + schema.ts:421 闭集
  七名；a5g7-live-kit:840 同形在案；read = lane 显式 allow；native bash 仍
  default ask 且被 ask-gated 腿 live 钉住）。
- 因此 assembled 世界的精确绿按裁定文案落定（kit 文案引用裁定出处，无
  consumption/durable-allow 误称于 C4）；ask-gated native bash 腿
  （C5+A4.1-A4.4）live 钉：durable 开、三行对齐、执行前零副作用、批准后
  Guard 拒绝落点（封闭世界语义，allow 不静默扩宽执行）。
