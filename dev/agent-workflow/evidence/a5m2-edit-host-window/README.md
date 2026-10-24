# A5M2 EDIT/SRE — 真实 Host 正负控小窗（Window A 最终形：单 boot EDIT allow/deny 真链）

状态：**runner 已写成真实入口**（05），boot 仍锁在根的窗口裁决后
（`A5M2_EDIT_WINDOW=GRANTED`；未授予时 runner 打 NOT_RUN 并**非零**退出 rc3）。
本提交轮零 boot、零安装、未触 :3080。档位不变：接线未测。

## 1. 产品钉（显式输入，禁旧包冒充）

**组合 = `5c31341803318ab35465908bf93b1f77f5cad16a`**（根钉；f86 = pack 唯一
writer，按此钉实收）。blob 复验（该树 `git ls-tree` 实测）：
dist `governed-families/edit.mjs` = `5a6db608a4043793e8569998bbe1c8fa5a0695be`、
`governed-families/sre.mjs` = `6a1ec67f062dd77ee7110a6d4d6e3781376f4f35`（与
source 同 blob）。pack 产物经 `A5M2_EDIT_PACK_TGZ` + `A5M2_EDIT_PACK_SHA256` +
`A5M2_EDIT_COMPOSED_SHA` **显式输入**进 runner（hash 实测比对，旧 161e4/699cc/
874f 一律拒）；**本 runner 自身 full SHA 另记** `runs-<ts>/runner-identity.json`。
原 01-pack-sequence.sh 已删除（根令：假 pack 职责移除，pack 唯一 f86）。

## 2. Window A（根令收窄：一条链、一次 boot、不 3boot）

单 boot 内先后两条真调用（同靶 `notes.txt`）：
- **E1 EDIT-ALLOW 正链**：member 真 edit toolcall → 公开 registry → 等
  B-EDIT PA request → `team.resolveControl allow` → 真 `tool_result` →
  `control-allow-consumed` 耐久事实 + 盘上字节 `alpha→BETA-ALLOWED` 重读 +
  mtime 前进。
- **E2 EDIT-DENY 负链**：同靶第二次 edit → `deny` → 结果面带
  `cf-class=denied`（风险事实 In-BAND）+ **零执行字节双测**（sha 相等 +
  mtime 冻结比对——runner 先 `utimesSync` 冻钟，touch-open 也会露）+ 该
  requestId 无 allow-consumed 事实。
- E0 前置：member 工具表真含 `edit`（mount 实开收据）。

race-04（inotify harness，`scripts/04-race-inotify-harness.mjs`）**不入本窗**，
另窗候另 GO。禁直 call arm：一切经 member session 公开链。

## 3. 端口 / HOME / 证据法（沿第四 Team 窗受限方式）

| 项 | 值 |
| --- | --- |
| Host 端口 | **3183**（预探 `portInUse` awaited；3080 稳定实例、3180/3181 durable 永不触） |
| mock 独立口 | **3498** |
| fresh HOME | `tests/homes/a5m2-edit-hw-a-<UTCts>Z`（存在非空即 fail-closed；锁文件 `a5m2-edit-hw-lock.json` 同处留证） |
| manifest rootDir | `$HOME/fsroot`（**本新世界，非 cwd**；boot 前写入 `notes.txt` = `alpha\nbeta\ngamma\n`） |
| RUN_DIR | `dev/agent-workflow/evidence/a5m2-edit-host-window/runs-<UTCts>/`（raw：results/transcript/instance 日志/lockupdate+install log） |

退出与清场：`finally` 内 `mock.close()` + `instance.stop()` +
`waitForPortFree(3183/3498)`，任何 ERR/free=false → cleanupOk=false → **禁绿
exit**；失败/NOT_RUN 非零（1=CRIT-FAIL, 2=FATAL, 3=NOT_RUN）。**不 rm 原证**：
HOME 世界与 raw 永不删除；证据归档 = 窗口后 `cp -a` 相关世界到 `runs-<ts>/`
（`--keep` 留活世界；runs-*/ 为本地证据不提交——含 token/世界态，永不入 git）。

## 4. 真实入口与载具

- **入口** = `scripts/05-edit-window-runner.mjs`（单 runner；执行只待窗口 GO）。
- 载具 = 第四成功 Team 窗 runner（`tests/kits/a5m2-schedule-c2`）公共链逐形
  复用：`DshInstance`（639 启动链 `node --import tsx/esm apps/cli/src/bin.ts`
  内含）/ token 303+cookie / `team.listRoots` 只读 ready 屏障 / `team.create`
  恰一次（合成 rootSessionId，root 自 mint）/ 唯一成员发现（root-scoped
  team-member binding × templateId join，unique-or-nothing）/ mock marker→一次
  toolcall→同 call 结果后 `TURN-DONE` 闭合（pending 不重发）/ `role:tool` +
  原生 `tool_result` 双形同-call 配对 / 公开 ledger 分页 + canonical JSON
  string safeParse + factType 精确 + `payload.requestId` 严等 / 429 有界重试 /
  安装面 = **f86 fixture 只读复用**（根 FS 窄审定令，2026-10-28）：显式
  `A5M2_EDIT_INSTALL_DIR`（默认
  `/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/pack-int/install-0a3f11b2/`）
  → 验 fixture manifest 的 plugin `file:` **确指**
  `out-5c313418-20261024T082308Z/dsh-agent-team-0.1.1-alpha.2.tgz` → 真实解析
  其 `exports['./host']` 与 dist edit 臂（实路径存在性，非拼串） → 核 tgz
  sha256 == 钉值 `sha256:0a3f11b2c07178cd5377debb11c221fac23d963c666a7a2688ba446168d50b6b`。
  runner **永不** install / lock-only / chmod（递归 a-w 会经共享 store 硬链
  污染——旧 bf4 fixture/lock/store 前置已全部删除）。fixture 缺失 =
  fail-closed rc3（不代建）。Host 启动形不改（DshInstance，
  `tests/deepseek-harness-test-use/apps/cli/lib/bin.js` ls 亲验在场）。
  不 import c1-leader-approval-smoke（其 boot/remoteCall 不 export 且底部
  main 跑整套）。
- profile：`teamToolPlane: { editEnabled: true, fsInstance: { rootDir } }`
  （闭合门键 + 同一受治理 fs 实例根 = 新世界）；blueprint v3：worker
  default-deny + ask 仅 `edit`（kind any），teamTools/skills/mcp deny，
  `builtinToolDeny: []`。
- `02/03` = 断言库（保留），**只喂 05 跑出的实际证据**（callResults/ledger/
  盘上实测），非独立入口；头部 NOT-RUN 标注保留。

## 5. 条件 GO 执行法（root 2026-10-28 正式一次条件 GO）

**执行入口 = `scripts/06-run-window.sh`**（有界包装；已备妥，未跑）。触发条件 =
f86 本次 fixture 准备成功（真实冷 import + 新 hash/lock/path 收据成立）——
当前 f86 仍在 metadata-only 锁准备，**无可用 fixture 前不得 boot、不得自装**。
固定钉：driver `d66e225bec6a77b2bb586eeca99e1d60d38c9850`（runner 文件对签名面
字节不变 + HEAD 承载该 commit）、产品
`5c31341803318ab35465908bf93b1f77f5cad16a`、tgz
`sha256:0a3f11b2c07178cd5377debb11c221fac23d963c666a7a2688ba446168d50b6b`、
Host 639；`A5M2_EDIT_INSTALL_DIR` 显式传 f86 最终完整路径。
包装界：外层 300s（`timeout --group --kill-after=20s`，TERM/必要 KILL **只及
本自有组**，wait 收尸；他 world/3080 不触）、df avail ≥ 18,000,000,000B、
HOME 新字节（nlink==1）≤ 64 MiB、3183/3498 预检空闲（占用即拒，**绝不杀
外来占用**）。留痕：wrapper log + `window-<ts>/external-receipt.json`
（前后 fixture lock/pkg sha256、runner 真实 RC、df、HOME 新字节、端口
前/后）；runner 自身 RUN_DIR raw 与 HOME 永不删。失败/NOT_RUN 真实非零即停
——禁自动二窗、禁临时 install/chmod、禁换候选。一 boot 仅 EDIT allow/deny
两调用。实测（本准备轮）：`bash -n` OK；缺 env 拒（rc1）；缺 fixture rc3；
零 boot。
