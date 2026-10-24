# B-Control 最小纵切 runner 备料（2026-10-25 根有限裁决后重写；B 仍未 GO，**未 boot**）

> 根有限裁决要点（照办状态逐条）：kit 加显式仅目标场景 selector ✓（本次落地，driver SHA 另钉）；
> **禁止默认跑 C1–C5 只报 C1** ✓（R1 方案作废——C1 只是 kit 场景编号，非验收等级）；
> 产品必须真实挂载 **37646 标准 tgz / 现 install-0a3f11b2 只读 fixture**，**不以 --worktree 源码冒包**、
> 不 install/clone ✓（§2 挂载合同）；承认 **A 已通 RPC allow ≠ Control 四工具 C2** ✓（§3）；
> 旧 kit 大改 → 直接复用 A 已启动公共 runner 替 Control 场景，不新通用框架 ✓（§5）；
> 端口 3184/mock 3499/fresh 显式 HOME 保 ✓；不 11-legs 扩展 ✓。

## 2''. 挂载更正（根 2026-10-29 裁决；取代 §2'，§2' 的 `--testuse=<install>` 说法作废）

- **`--testuse` 是 Host CLI 树**：真实 Host639 = `/srv/workspace/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use`
  （`apps/cli/lib/bin.js` 已实证存在）；**npm install 目录绝不作 Host**。
- **真实产品 = 37646 INSTALL_DIR 内 host/dist 挂进 Host 的 profile-patch seam（A 法）**，
  本 namespace 只读可见性**已实测**（2026-10-29）：
  - `/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/pack-int/install-0a3f11b2` 可读
    （`package.json`/`pnpm-lock.yaml`/`node_modules/dsh-agent-team` 在位）；
  - lock sha256 **实测 = `7685317ff1ba675f6d3f6b012907360579c3c85bd1bc3319d0248483bde3c659`**（与根数一致）；
  - tgz `/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/pack-int/out-37646ac2-20261024T085726Z/dsh-agent-team-0.1.1-alpha.2.tgz`
    sha256 **实测 = `3652b2ce19025d0d25d8b661fc08f0a3cb0737bb7b4fbc339fd61a12e2b5fd7c`**（与根数一致）。
- **A 现行挂载链逐位复用**（`a5m2-job-family` 树 `evidence/a5m2-edit-host-window/scripts/05-edit-window-runner.mjs`，
  行号实测）：install `package.json` `file:` 指针→tgz 名/目录前缀/sha256 三重钉（:165-178）→
  `PKG_DIR_READ = install/node_modules/dsh-agent-team`（:179）→ `exports['./host']` 解析
  **host/dist 入口**（:366-367）→ `writePatch(patchPath, pathToFileURL(HOST_ENTRY).href)`
  经公开 cordis profile-patch seam 插入 Host（:182-207，`- insert: - id: dsh-agent-team`，
  bootPhase create）；`HOST_TREE = ROOT_DIR/tests/deepseek-harness-test-use`（:74 = 639 独立指 Host）。
  driver/product **双钉** = `runner-identity.json`（runnerFullSha/runnerFileSha256 vs
  composedSha/packSha256/installDir，:355）。GO 门 + `*_DRY=1` 到界预检（install→入口解析→patch，
  spawn 前停）同件复用。
- **旧 kit 的产品输入不合规且改造=大改**：kit 现状把 `--worktree` 构建 dist 当插件
  （:193-195 `PRODUCTION_ROW_PATH=WORKTREE/.../host.js`，:1374 自述"THIS branch's build"）——
  正是根禁止的"以 --worktree 源码冒包"；给 kit 换 install 挂载属大改 → **按裁走 A-runner
  派生：复制其 mount/preflight/identity/GO/dry 骨架，替 Control 场景**，不新通用框架。
  kit 的 `--scenario` selector 保留（本分支全量腿与 C3 等仍有效），不再作为 37646 产品载体。

## 3''. C1 工具面核验（根问"是否真走工具 registry 调 83/84"——核毕，答：一半）

- **84/85 = 真 registry 调用 ✓**：kit mock 程序（:975-1000）在 leader 通知轮发
  `toolCall('team_list_pending_control')` + `toolCall('team_resolve_control')` ——模型面工具
  经工具注册表进真实面。
- **83 ≠ registry 调用 ✗**：C1 的请求由 **member ask-lane 的 pre-execute adapter 内部创建**
  （WIRE_NOTES.C1 原文 "member ask-lane (real pre-execute adapter...)"；注释 :1195-1197
  "the ask's control-request creation is an admitted..."），模型从未 toolCall `team_request_control`。
- 结论照根口径：**C1 通过 ≠ `team_request_control` C2**；且 C2 段是 RPC v4 `team.resolveControl`，
  同样不算两工具。**最小纵切因此必须含 83 的真实 registry 腿**：member 模型轮
  `toolCall('team_request_control', {rootSessionId, targetInstanceId(自身相关), actionName, summary})`
  （member envelope `allow:[request-control]` :1291-1293 恰好放行，deny:[]），Leader 通知轮
  list+resolve（84/85），**同 call/同 requestToken 消费**（B-CONTROL variant 叶 requestToken
  配对律 `control/types.ts:1492+`）+ durable 双对账（`team.getLedgerPage` 产品 wire +
  只读 `team_domain.json` 扫描）。三腿一 boot，即最小纵切，不再加腿。



- 启动链实测契约：`tests/characterization/lib/instance.mjs:89` 以
  `<hostTree>/apps/cli/lib/bin.js web --port` 拉起 —— 故挂载点 =
  **`--testuse <install-0a3f11b2 只读挂载根>`**，该根必须暴露 `apps/cli/lib/bin.js`
  （标准包 CLI 布局）；37646 标准 tgz = 该安装夹具的冻结来源，两者为"包→安装"同一输入链。
- **`--worktree` 只承载 kit/driver/evidence/HOME，绝不作为产品输入**（本 kit 的
  `HOST_TREE = TESTUSE`，:169 实录）；工作区可见范围**当前无** install-0a3f11b2 挂载
  （find 实测无该目录、无 37646 tgz）→ ready 依据之一 = 主挂载后运行前**只读预检**：
  `test -f <mount>/apps/cli/lib/bin.js` + 记录 mount 树 `git rev-parse HEAD`（或包
  `package.json#version` + tgz SHA256），双数入回执。预检不过 = fatal 停，不改 driver 迁就
  （**固定输入不等禁止修 driver**）。

## 3'. 真实受治理 Control 工具名/路径与纵切场景（不再猜）

- 治理行（封闭面实名，`team-tool-plane.mjs:171-178` + PA 表 `control/types.ts:1492+` variant 叶）：
  **`team_request_control`**（83，variant `request-control`：requestToken+kind/targetInstanceId/
  actionName/toolName/summary）、**`team_resolve_control`**（84，`resolve-control`：caseId+decision/note）、
  `team_list_pending_control`（85，closed-key hand-over 行）。87/88 grant/revoke 不在本最小纵切。
- **本 call 消费**定义：83 行 plan 在**同一次 classify/plan** 产出 durable row/定义身份/variant 叶
  （wire-c1 :1050 定点律）→ PA ONE consumption → captured native entered ONCE（:2145 装配层已证）。
- **场景**（kit C1 段内三步，即最小纵切）：member ask-lane（真实 pre-execute adapter 拦 edit/bash 类
  操作）→ worker 侧 `team_request_control` 发起 → Leader `team_resolve_control` allow →
  被拦的**本 call** 恢复执行（ask-lane 语义即同 call 消费）；durable 双对账 =
  产品 wire `team.getLedgerPage` + 只读 `team_domain.json` 扫描。
- **承认根澄清**：A 已通的 RPC allow 通道 ≠ Control 四工具的 C2 运行已测；本纵切跑绿才允许
  `team_request_control`/`team_resolve_control` 两行称 C2 运行已测（消费腿随 C1 语义）。

## 6. selector 落地（driver SHA 另钉）与命令

`--scenario <Cn>`：显式仅目标场景（setup + 单段 + 该场景 verdict；summary 记
`scenario` 字段）。依赖法为**实测**：C1/C3 setup 后自含；C2/C4 依赖 C1 段创建的 w1、
C5 读 C4 弃单 → selector **拒收**（不悄悄拉前置），要连跑请用全 kit 默认。
负路已实测：`--scenario C2` / `--scenario C9` 均在 boot 前 throw（本备料轮实跑仅这两条
纯参数校验，未触 boot）。

```bash
node tests/kits/pr-d-control-real-host/pr-d-control-real-host.mjs   --scenario C1   --worktree <冻结候选worktree>   --testuse <install-0a3f11b2 只读挂载根>   --host-port 3184 --mock-port 3499   --evidence-dir <worktree>/.gate/bctl-c1-<stamp> --keep
```

- **双钉**：driver SHA = 本 selector 提交（回执给完整 SHA，钉 `--worktree` 内 kit 文件）；
  产品 SHA/版本 = mount 预检记录（tgz SHA256 + bin 树版本/SHA）。二者独立入账。


范围 = 仅"请求→Leader 决议→同 call 消费"纵切（= 既有 kit 的 C1 判据），**不**新增 11-legs、
**不**自动 boot、**不**改 driver。复用已核真实 shape（A `f0a0b9557` 同源的成员操作级 envelope）
与 M1 链，不做任何新猜测。

## 1. 固定产品/驱动输入关系（准确版）

| 输入 | 唯一来源 | 传递方式 |
| --- | --- | --- |
| **产品树** | 根给定**冻结候选 SHA**（含本支收口） | `--worktree <冻结候选检出路径>`（kit 默认=自身所在树，须显式给出以防误跑他树） |
| **Host 输入** | 根给定 **f86 统一 Host**；若与本地基线不同树则显式传，同源则以 `tests/paths.mjs` pin 为准（本检出 = `tests/deepseek-harness-test-use` @ `639ed01539`，0.2.0-rc.2） | `--testuse <f86 路径>`（缺省时 kit 经 `paths.mjs`/父仓 fallback 解析） |
| **driver** | `tests/kits/pr-d-control-real-host/pr-d-control-real-host.mjs` @ 同一冻结候选 SHA，**逐字不改**（改 driver 即破坏已入账输入关系；无 subset flag，见 §3） | 直接 `node` 执行 |
| **成员 envelope** | kit 内置 blueprint：member allow 已含 `request-control`（:1291-1293，deny:[]），与根核 A 正解 `allow:[request-control], deny:[]` 同源同 law；**B 无需也不得再改** | kit 生成（无外部 fixture） |
| **HOME** | kit 自建 fresh world home：`<worktree>/tests/homes/<RUN_STAMP>`（工作区内，TEST_METHODS §7；每次运行全新，自清理除非 `--keep`） | kit 管理；取证轮用 `--keep` 并在回执记确切路径 |

## 2. 预置命令（GO 前不执行）

```bash
node tests/kits/pr-d-control-real-host/pr-d-control-real-host.mjs \
  --worktree <冻结候选worktree> \
  --testuse <f86-host 或省略走 paths.mjs pin> \
  --host-port 3184 \
  --mock-port 3499 \
  --evidence-dir <worktree>/.gate/bctl-c1-<stamp> \
  --keep
```

- 端口按根指定显式化：host **3184**（kit 允许区 3182-3186 内，永不 3080/3180/3181）、
  mock **3499**（显式覆盖 kit 默认 3497-3498 探测）。
- 退出语义（kit header 实录）：`0` = 全判据+hygiene 过；`2` = 判据失败（证据全量在
  evidence-dir）；`1` = 环境/boot/row fatal。原始 RC 一律 tee 存证（记 `tee` 管道 RC 教训）。

## 3. 最小纵切与既载判据的关系（不多不少）

- **纵切 = C1**（kit WIRE_NOTES.C1 原文）：member ask-lane（真实 pre-execute adapter）
  → Leader 模型面工具 `team_list_pending_control` / `team_resolve_control` 决议 →
  同 call 消费；durable 事实经**产品 wire** `team.getLedgerPage` + 只读
  `team_domain.json` 扫描双对账。
- kit 无 criteria subset flag（仅 `--worktree/--testuse/--host-port/--mock-port/
  --evidence-dir/--keep` 六项，:90-97 实录），C2–C5 与 C1 共享同一次 boot 账。
  **选项 R1（默认建议）**：原样跑 kit（零改动、输入关系即已入账关系），回执按
  `summary.json` 逐判据报——**纵切结论只从 C1 取证**，C2–C5 如实标"同 run 随行判据"。
  **选项 R2（严格 C1-only）**：需给 kit 加 subset flag = 改 driver = 破坏固定输入关系，
  除非根 GO 明令，不做。
- 消费/取消/deny 零副作用等其余腿（前呈 ≤11 legs 方案）**冻结不展开**，等纵切 C2 落地后根再裁。

## 4. 回执口径（执行轮）

- FULL SHA（冻结候选）+ f86 host 版本/SHA + 确切 HOME 路径 + evidence-dir 原始 RC +
  `summary.json` 中 C1 各 check 清单 + ledger 双对账件路径。
- 首条允许写 "**C2 运行已测**" 的行 = 仅 C1 覆盖的 `team_request_control` 发起 +
  Leader `team_resolve_control` 决议 + 同 call 消费（其余行维持接线未测）。
- 失败即停：不重试改参（除非根再 GO），现场 `--keep` 保留。
