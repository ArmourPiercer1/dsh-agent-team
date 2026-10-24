# A5M2-G3 — 最小真实 Terminal Host 场景（准备卡；低写轮，零 boot）

状态：本文件是**准备与候选清单**，不是执行记录。截至本提交 G3 TERMINAL 一切结论档位 =
**接线未测**（181 条 battery 是作者控 spec 证据，非 Host）。真实 boot 只在**获准的 Host
窗口**执行；本轮不安装、不 clone、不启动 Host、不触碰 :3080。

## 1. 支持面（root 已裁，@639ed01539 实证）

- Host = 完整 639 checkout `tests/deepseek-harness-test-use`（detached @
  `639ed015397290b3745d163aafe02ffee4aa3f84`，工作树必须 clean）+ 其依赖 + TS 启动链：
  根脚本 `dsh` / `start:web` = `node --import tsx/esm apps/cli/src/bin.ts`
  （package.json scripts 实核；`node_modules/.bin/tsx` 在场——本会话只读复核）。
- 我方插件装载形（既有 a5m2 世界同款，profiles/web/cordis.patch.yml 实核）：
  `dsh-agent-team` host 行指 `install-<sha>/package/packages/runtime/dist/packages/runtime/src/plugin/host.js`，
  配 `glueUrl`（同目录 `live/agent-bindings.mjs`）与 `seamUrl`（`root-binding/harness/seam.mjs`）。
  src 子路径 import 为两 pin 包 exports map 公开子路径（各自 package.json:21 `"./src/*"`），
  仅在该 checkout 世界成立；npm 安装态不等价（files 不含 src）。
- 世界 = `tests/homes/<world>`（工作区内，命名沿用 `a5m2-g3-term-<UTCts>`；3180 族端口，
  禁 3080；见 tests/paths.mjs）。

## 2. 必要候选（等主下发精确组合包时的最小集）

1. **插件 bundle**：集成分支合并后的 dsh-agent-team 包（含本 lane 已闭提交：
   身份/世代/配对/covered = `f67d84ac6` 链）。install-<sha> 目录 + pnpm-lock（复用既有
   runner/kit 的打包步骤——9c 资产，本 lane 不复写、不修改）。
2. **launcher 信任对**（confinedProvider）：
   `packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py`（本 lane 在场，
   sha256 前缀 `1264ea584e3438d6`；全值以合并后 bundle 内文件实测为准），配
   `trustRoot: "sha256:<前16位>#<绝对路径>"`、`assembly.launcherPath/launcherSha256`、
   `minAbiVersion: 3`；机器侧 landlock 运行能力沿用宿主既装现状（本会话未探测，禁止在
   准备轮探测）。
3. **profile 追加行**（在既有 a5m2 世界形之上做加法）：
   `teamToolPlane.terminal: { providerId: "<装配 provider 身份>", declaredBackends:
   ["shell"], sessionConfig: { rows: 24, cols: 80 } }`——其余默认由物化 Config 填
   （backendType='shell' 即 covered 唯一实现类型；docker 等 declared 只会进
   UNCOVERED-declared 观测）。realmId/fsInstance 沿用世界既有值。
4. **blueprint**：member 模板 `teamTools.kind: allow` 增列 terminal_* 六名；
   `permissions.default: ask`（走真实 ControlService 批准链）或最小化变体
   `allow: [{tool: terminal_open,...}]` 逐行放行——两变体都过同一 PA/edge 接线，
   A（allow-lane）先跑接线，B（ask-lane）验批准面。
5. **services**：Host 默认在场的 `terminals`/`subprocess`/`sandbox`/`sandboxPolicy`/
   `jobs`/ControlService（我方经 ctx.get 公开面读取；不新增任何 Host 面）。

## 3. 验证点（boot 获准窗口内的判据，不预跑）

- 启动观测：`a5m2-g3: controlled-route types=[shell] UNCOVERED-declared=[…]` census 行、
  family REGISTERED ×6、placement-feed 行含 terminal_*。
- 正路：member `terminal_open {type:"shell"}` → 批准 → 真实 confined argv spawn（真实
  LocalPtySession + landlock launcher）→ list/send/read/signal/close 各行逐字服务；
  durable 行含 `dsh-g3-po:shell@<挂载世代>` 目标身份。
- 反路（typed 拒，均为已闭卡语义）：未 covered 类型 → P_TERM_TARGET_UNRESOLVED；
  替换 mount 后旧闭包作答 → 具名 mount-identity REFUSED；行中撤 residency →
  effect-disposer 撤销 → 后续作答 NOTHING。
- 每步只动一个变量，留 raw RC + 观测行到本目录（追加 `run-<n>.md`）。

## 4. 等待主/根下发（本 lane 不可自建）

- 精确组合包版本三元组（bundle sha × profile 基 × 世界 kit）——按主既有惯例。
- Host 窗口许可（真实 boot + Chrome 两项 UNVERIFIED 中 terminal 相关的是真实实例使用；
  Chrome 属 Browser 族与本卡无关）。
- 低写已尽：本 runbook + 配置草形即先可做的全部；其余每步都要窗口。
