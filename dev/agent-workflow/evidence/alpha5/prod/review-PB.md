# review-PB — alpha5-prod-pr45 @ 87f465dd 独立审查（P-B reviewer，≠writer 会话）

- 审查对象 = `87f465dd43503a286204dbceeb7005015bf55fa8`（base `d714a941`），一次性 worktree `.worktrees/a5-pb-pr45`，HEAD 亲验 == 固定 SHA。
- 审查者模型 = qwen3.8-flash-next（与本支线 writer 会话独立；裁决只基于代码、diff、测试复跑与随附证据）。
- 全部复跑于 2026-10-17 07:55–08:0xZ 本会话亲测；本文 = 唯一审查产出（+ 复跑产物 runs/w4-extract2-2026-10-17T07-58-05Z/）。

## 判定：**通过（PASS）** — 四判据全部独立复现；note 级残留 3 条（§6），无补充要求、无阻塞。

---

## ① provider 参数化（`packages/runtime/sandbox-provider/provider.ts` / `probe-abi.ts`）

**ABSENT 面字节不变 — 亲验：成立。**
- diff 亲读：`ProviderAssemblyConfig` 四字段全可选；默认链保持历史逐字面——
  `assembly.pythonPath ?? A5P4_PYTHON ?? 'python3'`、`assembly.launcherPath ?? join(dirname(import.meta.url),'launcher','landlock-prelauncher.py')`；
  未 pin 时 `launcherIntegrityGate()` 在 `launcherSha256 === undefined` 直接返回 ok（**零 fs 读、零顺序变化**）；
  `minAbiVersion` ABSENT 时整段跳过。`probe-abi.ts` 为**纯追加**（仅 import 行 + `verifyLauncherIntegrity` 新节；既有函数零改动）。
- 复跑：既有**未改动**的 `a5p4-provider.test.ts`（6/6，含真 launcher 真实 confinement 腿，走模块相对默认路径）+ 全套 a5p4 **9 套 66/66** 在本 delta 上全绿；
  新增 ABSENT 钉腿（argv[0] 必须匹配 `sandbox-provider/launcher/landlock-prelauncher.py`）通过。

**双 gate 真拒 — 复跑 `a5p4-assembly-config.test.ts` 10/10 绿，两腿亲验：**
- 腿①（错误 pin）：`probe()` 在 availability 之后、**任何探针腿之前**拒 `SANDBOX_UNAVAILABLE`（"launcher integrity gate"），注入计数 fake 全程 `calls==[]`（零探针腿、零预检 run、零 spawn）；
- 腿②（prepare 后换字节）：`execute()` 在 `consumedPlans.add` 与 `deps.run` **之前**再 gate 重拒——`--confined-exec` 计数 =0；恢复受信字节后**同一 plan** 执行成功（exec 计数=1，证明一次性 grant 未被"什么都没停下的拒绝"烧掉）；第三次 execute 仍拒（one-shot 定律保持）。代码序亲读一致：gate 在 301 行 `advancePhase`（纯闭集检查，无状态）之后、310 行 `consumedPlans.add` 之前。
- 独立于 vitest 的第二载体：本会话**亲跑** `run-pb-w4-extract2.mjs`（编译后 dist 公共 barrel + 真 Landlock）→ **7/7 PASS，EXIT=0**，
  其中 PB-R3-SHA-GATE（PIN 不符 → 拒于任何 launcher 调用前，runs=0）与 PB-R1-W4-POS-SPAWN（真 confined spawn rc=0 pid=29 lease=terminated）复现；
  PB-PORT-3183-IDLE 前后自证（bind+ss，无监听）。新 receipt/ledger（8 行）= `runs/w4-extract2-2026-10-17T07-58-05Z/`。

**ABI 下限拒 — 复跑绿**：`minAbiVersion:6` vs 测得 4 ⇒ typed `SANDBOX_UNAVAILABLE`（"below the assembly-pinned floor v6"），零 launcher 调用（进程不存在前拒）；下限=4 ⇒ proceed。

## ② register.ts 类型层 + emit 自检

- **反例编译亲造**（临时文件 `test/pb-cex-ungated-expressibility.ts`，已删，git status 复净）：
  省略 `decide` → `TS2345 Property 'decide' is missing … but required in type 'A5P5Assembly'`；
  `decide: undefined` → `TS2322 Type 'undefined' is not assignable…`；无 backends → TS2345。
  **TSC_EXIT=2 = "ungated 注册"在本面类型层不可表达，钉死。** 附加：`pipeline.ts` 的 `RunToolCallDeps.decide` 同为必填（:47，:76 直呼）⇒ 裸 pipeline 面同样不可绕过。
- **emit 自检真跑**（`a5p5-barrel-emit.test.ts` 4/4）：测试体内以仓库 `typescript/lib/tsc.js -p tsconfig.build.json` 真 emit → `import(pathToFileURL(emitted index.js))` 断言全导出面并**在 dist 图上真跑** definitions（allow / deny / schema-refuse 三腿）。
  亲验产物在位：`packages/tools/a5p5-tools/dist/packages/tools/a5p5-tools/src/{index,register}.js`（时间戳=本轮复跑）。
- lane tsc 亲跑（无包含反例文件时）**EXIT=0**。

## ③ 作用域 / 最小权限（根三查）

- **barrel=纯导出面**：`src/index.ts` `^import` 计数 = **0**（全部非注释行 ∈ 多行 export 语句）；
  `register.ts` grep 无 `node:`/fs/registry/`.register(`/`globalThis`/`import.meta`；
  `createGovernedToolDefinitions` 全仓消费方 grep：lane 外 **NONE** ⇒ **零自我注册边**（GLUE-4 裁决面未被预占）。
- **共享文件零改 — diff 亲验**：`d714a941..87f465dd` = 12 文件（4 evidence + sandbox-provider 2 + runtime 新测试 1 + a5p5-tools 4 + lane tsconfig）；
  `scripts/`、根配置（根 package.json / tsconfig.base / cordis.patch.yml / pnpm-workspace.yaml）、dist、`packages/tools/tsconfig.build.json`（GLUE-2 include 为**基线既有**，diff 0 行）全部未触碰。
- **实际安装路径**：committed runtime dist mirror 在位（`packages/runtime/dist/packages/runtime/sandbox-provider/index.js`），
  但本轮**未再生成**（grep `assembly|verifyLauncherIntegrity` = 0，mirror 末次生成于 9e75ee83）——与 pb-CONTRACT §3"汇入 committed 安装面 = GLUE-5"的披露一致；`check:artifacts` HEAD 亲跑 EXIT=0（census 不涉新鲜度）。
  register 面 emit 落 gitignored lane dist（`.gitignore:28 dist/`，复跑后 `git status` 净），根 `files`/`exports` 不含 tools dist ⇒ **未进入 shipped 面**（作用域 = lane-only，符合声明）。
- **最小权限**：probe-abi 新增能力面 = `createHash` + 对**配置路径**的 `readFileSync`（无新 env 读、无网络、无新写）；
  `node scripts/audit-a5-tool-governance-imports.mjs` 亲跑 OK（12 lane 文件 / 44 边 / 无环，register.ts 计入纯域消费者）；`a5p5-dormant-audit` 5/5 绿。

## ④ 回归面抽验（超额：全量而非抽 10）

| 套件 | 结果 | 抽点（≥10/边） |
| --- | --- | --- |
| runtime a5p4 全套（9 文件） | **66/66** | provider 真 confinement、phases、network-closure、fd-inheritance、poc4-probe、realm-evidence、existence-wording、lane-hygiene(自 strict typecheck)、assembly-config 10、ABSENT 默认面腿 |
| a5p5 lane 全套（8 文件） | **73/73** | args/effects-schema/render/render-injection/spill/parity/dormant-audit/barrel-emit |
| tools 共享套件 | 161/162 | 唯一失败 = `p6t6-actions`（预期内债务腿） |
| `pnpm -r run typecheck` | **EXIT=0**（pipefail 严格复跑，0 错误行） | 全 9 包 Done |
| W4 extract-2（真 Landlock，dist barrel） | **7/7 PASS**（本会话独立复跑） | POS spawn / spill / no-argv-rewrite / NEG missing / sha-gate / 3183-idle |

**p6t6-actions 预存在亲证（比 stash 复跑更强的静态证明）**：该测的全部输入面
（`packages/tools/src`、`runtime/activity`、`runtime/admission`、`p6t1/p6t2-helpers`、测文件本身）在 `d714a941..87f465dd` 区间 **diff 为空**
⇒ 同码同红，与本 delta 无关；与 writer 的 stash 复跑结论一致。

## 6. note 级残留（不阻塞，登记）

1. **sha-gate 的固有 TOCTOU**：字节校验与 spawn 之间存在窗口（launcher 不自校验字节）——seam 上"距 spawn 最近的一次校验"已是本面极限；GLUE-5 加固候选（fd/fexecve 类或 launcher 自哈希）。
2. **committed dist mirror 落后一轮**（provider 新面未入 mirror）——已披露为 GLUE-5 队列；`check:artifacts` 不约束新鲜度，装配在 GLUE-5 再生成前不会消费到新面（W4 复跑自带 build，不受影响）。
3. **a5p5 lane 无 package.json** ⇒ `pnpm -r typecheck` 不覆盖该 lane；覆盖由 lane-local tsc（本审 EXIT=0）+ 套件内 emit 腿承担——登记为作用域事实，非缺陷。

## 裁决

**通过（PASS）**。①②③④ 四判据全部独立复现；delta 严格 lane-only；参数化未松动任何既有拒绝语义（ABSENT 面不变、双 gate/ABI 下限真拒、ungated 类型层不可表达、注册面零自我注册）。

— P-B reviewer 会话 · 2026-10-17 · 无凭据操作（远端 TLS 不可达，push 状态见回报）
