# review-LaneD.md — Alpha.5 PR5（工具面）独立审查 · Lane D reviewer（≠writer）

对象 = `origin/alpha5-pr5-tools` @ **72a2c1b2**（base **db5cb5f7**；Phase1 fb69c7f1 + Phase2 72a2c1b2）。
契约正本 = `INTERFACES-v1.md` @ b0d636eb（C-FS/C-PROC/C-GW/C-BIND(v1.1) 节）；事件面权威 = master **452a04c0**。
复现 = 一次性 worktree `.worktrees/a5p5-rev`（detached @72a2c1b2；`--store-dir` 用仓内 `.pnpm-store-wt`）；vitest `--maxWorkers=1`；审查探针世界 `tests/homes/a5p5-rev-*` 用后即删。模型 qwen3.8-flash-next，与 writer 会话独立。

## ① 效果 schema = PR0 冻结代数只读消费 — **属实**

- 单一事实源：全部腿经 `parseRequestedEffectSet`（`effects-schema.ts:64` → `domain/tool-governance/src/effects.ts:163`）；本层无自造代数/身份键/digest。派生律 grep=invoke+list(directory)+read(placement)、glob=invoke+list（`effects-schema.ts:88` 永不铸 read；测试 `a5p5-effects-schema.test.ts:86-93` 钉 read 缺席）、bash=仅 invoke（`:79-81`，law 2）。与 S0 **M-07 口径**（bash 现实由 confined-execution/OS 层约束、禁命令文本预测副作用；`evidence/alpha5/s0/review-S0.md:26,30`）一致，且测试钉 "同指纹不随命令文本变"（`a5p5-effects-schema.test.ts:124-131`）。
- 无第二问题码：lane parse 面用码 ⊆ PR0 `TOOL_CONTRACT_PROBLEM_CODES`（`parse-util.ts:17-34`；`locator-rejected` 系 PR0 自有 `:24`）。spill/backend 码为 lane 自有闭合拒绝集（新面合法），错误类 = C-FS triad。
- **realmId 注入面对抗试**（探针 A1/A2）：三 parser 对 `realmId` 一律 `unknown-field` 拒；非串/空 realm typed 拒不铸效果集。args 形状层面伪造 realm 不可达（`types.ts:22-25`）。✅

## ② render 注入 — **6 负控复跑绿 + 结构行独占性成立（`\n` 法下）**；两观察项

- 6 条负控原样复跑绿（伪造页脚/头/`stderr:`、ANSI/BEL/NUL、CR 覆盖、`\n` 路径、match 文本铸页脚）。探针 B1/B4 复证；spill 指针经 `JSON.stringify` 不可铸第二页脚。
- **B3（观察，建议补强）**：`render.ts:110/122/126` 把 `outcome.outputMode` 未消毒拼入 header——恶意 *backend*（非恶意仓库字节）可在该控制字段塞 `\n` 铸出第二条锚定 `a5p5-meta ` 行（探针实证 count=2）。威胁模型内 backend=受信 provider，故不阻塞；建议渲染路径对 outputMode 做 `closedValue`/`inline()` 防御纵深。
- **B2（观察）**：U+2028/U+2029 不转义——对按 U+2028 分线的消费者，缩进保证可绕（`\n` 法下无懈）。登记即可。

## ③ spill 生命周期 — 三律实证成立；**事件名 5/6 与 master@452a04c0 实际发射名不一致（本审唯一实质 finding）**

- **DRAINING 字节冻结**：探针 C1 = late write typed 拒（`spill.ts:253`）且既有字节**逐字节**不变（严于 lane 自身的 size 断言）；C2 同 lease 第二 sink 亦拒。✅
- **取消残留 fresh-handle 枚举含孤儿**：C5 fresh handle 列得取消残留（bytes/归属/结算类俱在）+ 无 meta 孤儿（attribution=null 不静默）；`readSpill` deny 时**任意 port 调用增量=0**（探针计数严于 lane 测试的 readText+exists 两计数）；`spill.ts:304-313` authorize 先于一切 payload I/O。✅
- **六事件名逐字对 master@452a04c0**：runtime 发射名全部带 `dispatcher-call-` 前缀（`install.ts:651,662,673,686,763`：`dispatcher-call-outcome-unreadable` / `-terminated-after-body-start` / `-cancelled-before-body` / `-cancelled-by-others` / `-completed-after-abort` / `-executed-unvalidated`）。lane `SETTLEMENT_EVENTS`（`spill.ts:51-58`）仅第 1 名全形，**5/6 为无缀短形**——逐字转录自 INTERFACES-v1.md C-ADM v1.1 行（该行本身混写：首名全形、余五名短形），故 lane「对文档逐字」成立、**「对 452a04c0 事件面逐字」不成立**。探针 C3 实证：以运行时全名 settle 被拒。DORMANT 内不驱动任何授权判定 ⇒ 不阻塞本分支，但 **G-d 接线前必须由契约 owner 裁决**（对齐全名 + 文档修订，或登记映射）。
- 附：未知事件名的 settle 拒绝复用码 `spill-settled-twice`（`spill.ts:185`，码不配义，补一个 typed 码即可）。
- **C4（接线前必闭）**：`openSink` 对**已存在且已 finalize 的 spillId 重复开**不拒——追加穿透既有 payload 且 meta 的 settlement 被覆盖为 null、归属可换（探针实证）。lane 流程内 spillId=tool+admission 注入的唯一 callId，风险受控；接线前应加 spill-id-in-use 拒。cleanup 会删受控 root 内非 spill 文件（root 独占前提下可接受，登记）。

## ④ parity 口径 — **诚实**

note-phase2 明言「对 fixture 验证，不宣称整链」；direct/stub 分别编写、同一 10 行表、逐字节等值 + deny-before-backend exec=0 双路断言（`a5p5-parity.test.ts:290-330`）；stage 轨迹出可比面 = registered difference 有记录并测试钉（`:308-316`）。✅

## ⑤ RED-first 与复跑 — **属实**

`phase2-red-full.txt` 原文 = 两新套件 collection RED（缺 `spill/backend-direct/pipeline` 实现）且 Phase1 40/40 不受扰——必测三项（越界写/取消残留枚举/后端路径注入惰性化）全在 RED 套件内。本审复跑：**62/62 绿**（`--maxWorkers=1`）、lane **tsc 0 错误**。Phase1 证据链（真语义 bug 于 RED 抓出：IO 腿子集律）完整可核。

## ⑥ 卫生 — **全过**

共用文件零命中（diff 29 文件全落 `packages/tools/a5p5-tools/` + `evidence/alpha5/pr5/`）；DORMANT 钉绿（lane 外零引用 + 共享 barrel 不知 lane）；token 扫描 0 真命中（仅 "secretish" 类测试字串）；本 worktree porcelain 净（探针文件与世界已回收）；`:3080` 仅只读 GET=401 与基线一致，未触碰。

## 判定

**G-d 集成会话：可（投机通过级）+ 条件**——
1. （接线门）六事件名由契约 owner 裁决对齐 master@452a04c0 全发射名并修订 INTERFACES 行，或登记显式映射；lane 不得以 5/6 短形静默接线。
2. （接线门）`openSink` 拒绝已存在 spillId（或 finalize 单调化），封死重开覆盖结算事实/追加穿透。
3. （建议）render 对 `outcome.outputMode` 走闭合校验；U+2028 与未知事件码 `spill-settled-twice` 两处登记入风险台账。
