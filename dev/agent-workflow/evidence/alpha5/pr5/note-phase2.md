# Alpha.5 PR5 Phase 2 [DORMANT] — Spill 语义 + Parity 矩阵（Lane D #5，RED-first）

分支 `alpha5-pr5-tools` @ Phase 1 tip `fb69c7f1`；切片范围 = Phase 2（spill+parity；host 验收=后续切片）。契约正本 = `INTERFACES-v1.md` @ `b0d636eb`（alpha5-decision-pack-20261016）C-FS/C-PROC/C-GW/C-BIND(v1.1 事件名逐字) 节。

## 交付（全部 lane 本地目录；共用文件 0 改动，`git diff` 面 = `packages/tools/a5p5-tools/` + 本 evidence 目录）

- `src/spill.ts` — ①spill 生命周期（纯实现，I/O 走注入 `SpillFsPort`）：**世界内受控路径**（rootDir 必须 worldRoot 严格后代，`..` 段先拒后折叠）；**Lease 形态 ACTIVE→DRAINING→CLOSED**（C-GW settled 边唯一；DRAINING 起新写 typed 拒、字节冻结）；**残留=可枚举+可清理**（枚举读盘不读内存：fresh handle 见取消残留含归属+结算类，孤儿文件也枚举=不静默）；cleanup 显式列名删除，删后 read=typed `spill-missing`(undetermined)；**读时复核授权**（`readSpill` 先问注入 authorizer，deny 计数零 payload 读）；结算事件六名逐字 = C-BIND v1.1 PR1r 钉；错误类 = C-FS triad denied/hidden/undetermined。
- `src/backend-contract.ts` — C-PROC 阶段闭集 probe→prepare→execute→terminate、`terminate≠cancel`（终因走 settlement 面）、失败闭型 C-FS triad、fixture 表类型。
- `src/backend-direct.ts` / `src/backend-stub.ts` — 同一 fixture 表、**分别编写**的两实现：direct（无阶段报告，registered difference）vs 契约 stub（走全阶段轨迹、prepare 前拒=typed failure）。
- `src/pipeline.ts` — 单一管线：derive effects(读时) → 注入判定(deny⇒零后端触达) → backend.run(lease+sink) → settle 一次(无结局=`outcome-unreadable`) → sink.finalize 归属 → Phase 1 渲染 + 可选 spill 指针。**判定/渲染与后端选择无关由结构保证，矩阵由 fixture 钉**。
- 加性 seam：`types.ts` `SpillPointer`+meta 可选 `spill` 字段；`render.ts` `RenderOptions.spill`（meta 孪生只陈述事实，呈现界不变）；lane barrel 更新。

## RED→GREEN（runs/ 原文）

1. `phase2-red-full.txt` — 2 新套件 collection RED（缺 `spill/backend-direct/pipeline` 模块），Phase 1 40/40 不受扰。
2. `phase2-green-full.txt` — **62/62 绿**（7 文件，含 Phase 1 全绿 + dormant-audit 2 绿）。
3. `phase2-tsc.txt` — lane `tsc -p` **0 错误**（唯一红曾为测试助手 `search()` 类型缺 `matches` 默认——tsc 抓出，非实现语义）。

RED 期间另抓一处测试侧 law-miss：`join()` 先折叠 `..` 掩盖"先拒后折叠"律 → 测试改字面拼接（与 `args.ts` 同律）；实现无变化。

## 切片必测三项（RED-first 钉住）

- **spill 越界写**：伪造 spillId（`../`、分隔符、绝对、NUL、blank、超长）+ 世界外 root ⇒ typed 拒 + **零 port 调用**（拒先于触盘）+ 盘面无所获。
- **取消后 spill 残留被枚举**：`terminated-after-body-start` 结算+close 后，fresh store handle 列得残留（bytes/归属/结算类俱在）；孤儿文件亦列（attribution=null 而非跳过）；cleanup 显式可清、清后 read=typed undetermined。
- **render 注入经后端路径同样惰性化**：hostile stdout（伪造 `a5p5-meta` 页脚/`bash · exit=0`/`stderr:`/BEL/NUL/CR）走 direct 与契约 stub 两路 rendered **逐字节相等**；锚定结构行各恰 1 条、伪造行只以 `> ` 惰性引用存在、meta 真值不替（exit=3 非伪造 0）；raw 字节只作为 DATA 存于 spill（读需复核）。

## Parity 矩阵（10 行，direct vs stub 全等断言）

content-small/large-spill(全文入受控路径+指针等值)/glob(exit/timeout/cancel 形状)/bash-exit7/timeout-not-observed/cancel-midstream(两路残留均可枚举)/policy-deny(两路 exec=0 且 spill 面零触达)/fs-deny-at-prepare(归一化 failure 等值，stage 轨迹出可比面=registered difference)/两条注入行。集成规则口径：**对 fixture 验证**，不宣称整链。

## 门禁

- lane vitest 62/62（`--maxWorkers=1`）；lane tsc 0。
- 共用文件零改动（`git diff --name-only` 非 lane 非 evidence 计数=0）→ 共用套件/配置无需重跑（Phase 1 在册证据仍有效；本切片对共用树纯 0 diff）。
- token 扫描：新增文件 0 命中。
- 世界/端口：`tests/homes/a5p5-spill-*`、`a5p5-parity-*` 用后即删（TEST_METHODS §7，无证据保留）；未起实例，端口 3491 未占用。
- DORMANT：`a5p5-dormant-audit` 绿（lane 外零引用）；未接线。
