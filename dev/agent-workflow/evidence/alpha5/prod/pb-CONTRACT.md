# pb-CONTRACT — PR4/5 安装产物装配契约（P-B · 分支 `alpha5-prod-pr45`）

- writer = P-B（qwen3.8-flash-next，liveness 首报）；基 = `origin/master @ d714a941`（亲 fetch）。
- 本笔只改 sandbox-provider lane + `packages/tools/a5p5-tools` lane + 各自 test/tsconfig + 本 evidence 目录。
  **共享文件零改**：dist 再生成、`scripts/`、根配置、`packages/tools/tsconfig.build.json`、
  根 `vitest.config.ts` 全部未触碰（=GLUE 队列）。缺口本体 = PRODUCTION-READINESS-CHECKLIST
  （branch `alpha5-prod-checklist`@`5bea01c6`）「最大三个生产缺口」之 ②（a5p5 emit 不落 committed
  安装面、无 barrel/注册边）与 PR4「零生产消费边」（C-10）的**装配契约半壁**。
- 裁决边界：**committed 安装面汇入 = GLUE-5**（§3 给文件清单）；**scoped 挂载（哪个 Agent scope、
  别名还是接管、相对 guard publish 的顺序）= GLUE-4 裁决，不在本笔**——本笔只造"可注册的面"，
  不造注册边。

---

## 1. PR4 provider：生产入口参数化 + 注册行形状（给 GLUE-5 的 profile 行草案）

### 1.1 新 seam（已落 lane，`packages/runtime/sandbox-provider/provider.ts`）

```ts
export interface ProviderAssemblyConfig {
  readonly pythonPath?: string      // 探针腿 + confined-exec 的解释器（缺省 = A5P4_PYTHON env，否则 python3）
  readonly launcherPath?: string    // 受信 launcher 绝对路径（缺省 = 模块相对源树副本，仅源树有意义）
  readonly launcherSha256?: string  // 受信字节 sha256（64 hex）；设定后 gate 每一次探针腿与每一次 spawn
  readonly minAbiVersion?: number   // landlock ABI 下限；探针测得低于下限 ⇒ spawn 前 typed 拒
}
// ProviderOptions 新可选字段：readonly assembly?: ProviderAssemblyConfig
```

- **ABSENT = 历史 lane 面逐字节不变**（模块相对 launcher、env python、无 pin、无 ABI 下限）——
  DORMANT 面与全部既有消费者不动（a5p4 全套 50/50 + provider 6/6 亲跑绿）。
- 动机（W4 row 已披露的装配事实）：committed 安装面是 tsc emit，**不携带 `.py` 资产**，模块相对
  默认路径在 dist 里不存在；W4 row 只能靠 deps spy 重写 argv[0] 冒充受信字节。`assembly` 是诚实
  seam：装配点名哪份字节，provider 就 gate 哪份字节。

### 1.2 launcher sha 校验路径（`probe-abi.ts: verifyLauncherIntegrity`，纯函数可注入 read）

verdict 闭集：`PINNED-MATCH | PIN-MISMATCH | UNREADABLE | INVALID-PIN`；provider 内两处 gate：

1. `probe()`：availability 预检通过后、**任何探针腿运行前** gate（PIN 不符 ⇒ `SANDBOX_UNAVAILABLE`，
   零 launcher 调用——回归测腿 ①）；
2. `execute()`：`deps.run` 前**再验同一路径字节**（probe 干净后被换的字节仍到不了 run；拒发生在
   plan 消费之前，一次性 grant 不被"什么都没停下的拒绝"烧掉——回归测腿 ②）。

单测：`packages/runtime/test/a5p4-assembly-config.test.ts`（10 测，含换字节回归、ABI 下限、
ABSENT-assembly 默认面钉）。回归复跑：`runs/w4-extract2-*/receipt.md` §PB-R3-SHA-GATE。

### 1.3 trustRoot 校验参数（GLUE-5 必须照此成对校验）

- `trustRoot`（已有字段）= **身份标签**，形状 = `sha256:<launcherSha256 前 16 hex>#<受跟踪仓库路径>`
  （W4 实测形状 `sha256:1a2b…#packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py`；
  capability rows 携带它，见 `probeToCapabilities`）。
- `assembly.launcherSha256` = **校验参数**（全 64 hex），provider 独立复算文件字节哈希。
- **GLUE-5 装载时的成对校验（fail-closed）**：解析 profile 行后，若
  `trustRoot !== "sha256:" + launcherSha256.slice(0,16) + "#" + <声明的受信路径>`，整行拒绝装配
  （typed 报错、拒发 Agent——与 `alpha5-tool-dispatcher-not-published` 同纪律）；provider 的字节
  gate 是第二道，不替代第一道。只给 trustRoot 不给 sha（或反之）= 配置缺陷，同样拒。
- `minAbiVersion`：realm 的策略需要哪代内核 ABI 由装配声明；测得低于下限 ⇒ `prepare` 前拒，
  绝不"降级跑在弱平面"。

### 1.4 profile 行草案（GLUE-5 并入 `cordis.patch.yml` 的行形态；键名为契约，落地归 GLUE-5）

```yaml
# —— GLUE-5 草案：追加到既有 `dsh-agent-team` host row 的 config 块（whole-replace 语义见该文件头注）——
        confinedProvider:                     # ABSENT = 不装配 provider（现状逐字节保持）
          realmId: "team-realm"               # glue 侧 realm 绑定输入
          trustRoot: "sha256:<16>#packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py"
          hardDimensions: ["content-read", "write"]   # 观察-2 定律：hard realm 必带 hardDimensions
          assembly:
            pythonPath: "python3"             # 或绝对解释器路径（受信安装）
            launcherPath: "/abs/path/…/landlock-prelauncher.py"   # 受信安装副本；GLUE-5 装配时用
                            # sha256(受跟踪源树字节) 校验该路径文件后再写死此值（launcher 不随 dist 分发的事实披露保留）
            launcherSha256: "<64-hex>"        # 与 trustRoot 前缀成对（§1.3）
            minAbiVersion: 4                  # 本域实测下限（本机测得 v4；W4 同）
```

对应 **glue 注册行形状**（C-10 生产边，GLUE-5 在 `plugin/live/agent-bindings.mjs` 侧实现；本笔零碰
`packages/runtime/src/**`）——provider 从 committed 安装面公共 barrel 进入：

```js
// GLUE-5 registration line（草案，非本笔代码）：
import { createConfinedProcessProvider } from '<dist-mirror>/packages/runtime/sandbox-provider/index.js';
const provider = createConfinedProcessProvider({
  realmId: cfg.confinedProvider.realmId,
  trustRoot: cfg.confinedProvider.trustRoot,                    // §1.3 成对校验在构造前已完成
  scratchRoot: join(effectiveWorkspace, '.a5p4', realmId),
  hardDimensions: cfg.confinedProvider.hardDimensions,
  assembly: cfg.confinedProvider.assembly,                       // ← 生产入口参数全从这来
});
// 拒装配语义：构造本身不抛；probe()/prepare() 返回 typed refusal，
// 装配方按 "launcher integrity gate" / "ABI pin" / "confined spawn unavailable"
// 前缀 fail-closed 拒发能力（对齐 dispatcher-not-published 先例）。
```

- 网络/元数据两维**恒 `IO_POLICY_UNSUPPORTED` 启动前拒**（PoC-4b 诚实律不因参数化而松动）；
- rc 面缺项（review-LaneC 观察-1）不在本笔：seam 扩展归 GLUE（`RunOutput` 形状冻结）。

## 2. PR5 a5p5：导出 barrel + search/shell 注册面样例

### 2.1 barrel（lane 公共面，`packages/tools/a5p5-tools/src/index.ts`）

现含全 lane 导出：args/effects/render/types/spill/backend/pipeline + 新注册面：

```ts
export { createGovernedToolDefinitions, REFUSAL_PREFIX,
         type A5P5Assembly, type GovernedToolDefinition } from './register.js'
```

### 2.2 注册面（`src/register.ts`，新）= "可注册的面"，不是注册边

- `createGovernedToolDefinitions(assembly)` → 三条**纯数据 Definition**（grep/glob/bash：
  name/description/closed parameters（与 parser 闭键逐一对齐，`additionalProperties:false`）/
  `execute(raw)→{text}`），体内走唯一 pipeline：parse → `decide`（**必填**，无 admission 面就
  构造不出 Definition ⇒ "ungated 注册"在本面不可表达）→ backend → renderer-only 呈现；
  拒绝单行 `a5p5-refused kind=… code=… detail=…`。
- lane 零 `node:*`、零 host import、零 registry 调用。**scoped 挂载归 GLUE-4 裁决，不在本笔**：
  哪个 Agent scope、`names` 用别名还是原生名接管、注册相对 guard bind/publish 的先后
  ——样例里的 for-loop 只是形状演示。实测先例 = W5 row
  （`evidence/alpha5/wiring/w5/a5w5-assembly-row.mjs` 的 `inner.tools.register(searchDef)` 序列）。

```js
// GLUE-4 侧挂载样例（形状演示——挂载裁决本身 = GLUE-4，不在本笔）：
import { createGovernedToolDefinitions } from '<a5p5-dist>/packages/tools/a5p5-tools/src/index.js';
const defs = createGovernedToolDefinitions({
  realmId, decide: (effectSet) => admissionFace.decide(effectSet),  // PR2 kernel / guard 门（GLUE 接）
  searchBackend,   // ToolEffectBackend：C-FS（PR3）适配体（装配侧实现，W5 row 有活样例）
  shellBackend,    // ToolEffectBackend：§1 confined provider 适配体
  spillStore, names: { grep: 'team_grep' }, callIdPrefix: `team-${memberId}`,
});
for (const def of defs) agentCtx.tools.register(def);   // ← 这一步的 scope/命名/顺序 = GLUE-4 裁决
```

### 2.3 自检（已落 lane，`test/a5p5-barrel-emit.test.ts`，4 测绿）

结构腿：barrel 逐模块点名（无孤儿模块可藏）+ `tsconfig.build.json` 形状钉；
emit 腿：用仓库自身 tsc 跑 `-p tsconfig.build.json`（=装配方用的同一配置）emit 进 lane 自身
`dist/`，**import 产物 barrel** 断言全导出面并真跑 definitions（allow/deny/schema-refuse 三腿）。
即"lane tsconfig emit 到自身 dist"是实测事实；**汇入 committed 安装面留 GLUE-5**。

## 3. emit 面 → GLUE-5 文件清单

- lane 新配置：`packages/tools/a5p5-tools/tsconfig.build.json`（rootDir=repo 根，outDir=`dist`，
  include=`src`）；产物 layout 与 runtime dist mirror 同构（`dist/packages/...`）。
- 实测清单（亲生成于本轮）：**228 文件（57 `.js` + 57 `.d.ts` + maps）**——
  `tools/a5p5-tools/src` 44 · `domain/tool-governance/src` 48 · `contracts/src/**` 124 ·
  `domain/authority-envelope/src` 8 · `domain/blueprint/src` 4。全清单 =
  [`pb-a5p5-emit-filelist.txt`](pb-a5p5-emit-filelist.txt)。
- **GLUE-5 待办（本笔不做）**：把上述面汇入根 manifest `files` 白名单/committed dist mirror；
  transitive 的 `contracts/src/**`+`domain/tool-governance/src/**` 已镜像在
  `packages/runtime/dist`——**去重/别名由 GLUE-5 裁决**（可只并入 `tools/a5p5-tools/**` 并
  跨包相对引用，或全量自带，两条路 emit 都成立——barrel-emit 自检走的是全量自带路径）。
- 本笔 dist 目录不提交（`dist/` gitignore 规则未动；`check:artifacts` census 不受影响，亲验：
  lane 套件内 emit 只写 gitignored `packages/tools/a5p5-tools/dist`）。

## 4. W4 判据抽 2 复跑（port 3183 自证空闲）

- 驱动 = [`run-pb-w4-extract2.mjs`](run-pb-w4-extract2.mjs)（provider face，零 host 启动）；
  receipt/ledger = [`runs/w4-extract2-2026-10-17T07-44-17Z/receipt.md`](runs/w4-extract2-2026-10-17T07-44-17Z/receipt.md)。
- 结果 **7/7 PASS**：PB-BUILD（生产构建配置 emit）· **PB-R1-W4-POS-SPAWN**（抽 ①：真 Landlock
  confined spawn rc=0 pid 真 lease=terminated，全走 assembly 面）· PB-R1-SPILL-MATCH ·
  PB-R1-NO-ARGV-REWRITE（新面自证：offered==trusted，W4 spy 重写已不需要）·
  **PB-R2-W4-NEG-MISSING**（抽 ②：缺件 → SANDBOX_UNAVAILABLE，零 confined-exec，预检行无内核
  文案）· PB-R3-SHA-GATE（sha 校验路径回归）· **PB-PORT-3183-IDLE**（bind+ss 前后自证空闲）。
- 诚实注记：复跑载体 = 编译后 dist 公共 barrel（与 W4 row 同 import 路径）；W4 全 22 判据中
  host/E2E 腿不在本笔抽题内（kit 原件未动，`alpha5-prod-pr45` 零碰 `dev/agent-workflow/evidence/alpha5/w4/`）。

## 5. 本笔文件清单（lane-only，共享文件零改）

| 动作 | 文件 |
| --- | --- |
| 改 | `packages/runtime/sandbox-provider/provider.ts`（assembly 面 + 两处 sha gate + ABI 下限 gate） |
| 改 | `packages/runtime/sandbox-provider/probe-abi.ts`（`verifyLauncherIntegrity` 纯函数） |
| 新 | `packages/runtime/test/a5p4-assembly-config.test.ts`（10 测） |
| 新 | `packages/tools/a5p5-tools/src/register.ts`（注册面） |
| 改 | `packages/tools/a5p5-tools/src/index.ts`（barrel 增注册面导出） |
| 新 | `packages/tools/a5p5-tools/tsconfig.build.json`（lane emit 配置） |
| 新 | `packages/tools/a5p5-tools/test/a5p5-barrel-emit.test.ts`（emit 自检，4 测） |
| 新 | `dev/agent-workflow/evidence/alpha5/prod/{pb-CONTRACT.md, pb-a5p5-emit-filelist.txt, run-pb-w4-extract2.mjs, runs/w4-extract2-*/}` |

零回归证据：runtime a5p4 全套 **66/66**（9 套 = 其余 7 套 50 + provider 6 + assembly-config 10）·
a5p5 lane 全套 **73/73**（含新 4 测）· tools 共享套件 161/162（唯一失败 = `p6t6-actions` 1F，
**已验与本笔无关**：stash 本笔全部 tracked 改动后复跑仍同形失败；ROUTER 日志债务集在册成员）·
`pnpm -r run typecheck` **EXIT=0** · dormant-audit 腿不受影响（本笔无 shipped 面命名 lane）。

## 6. 残留（登记，非本笔）

- GLUE-5：profile 行并入 + dist 汇入（§1.4/§3）+ trustRoot/sha 成对校验的 glue 实现；
- GLUE-4：scoped 挂载裁决（§2.2）+ C-FS/provider 的 ToolEffectBackend 适配体生产化；
- run-w4 全 22 判据的 host 级复跑（W4 kit 现成）；registry 40 常跑；rc 面 seam 扩展（观察-1）。
