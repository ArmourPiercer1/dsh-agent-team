# gate-proposal-G-g — PENDING-GATES.md G-g 行更新**提案**（新文件，不直接改正本）

> 性质 = 提案：合并走守卫后续 PR（协调者守卫），本分支 `alpha5-g-g-gate` 不触碰 `PENDING-GATES.md` 正本。
> 判定依据 = 同目录 `GATE-VERDICT.md`（G-g 门判定 reviewer @master 46a406b9，独立复现 kit 18/18 · unit 23/23 · lint 713md/0 · live runs 19/19×2+18/18）。
> 守卫注记（落文 PR 必读）：`scripts/lint-g-g-wording.mjs:86-99` 的互斥检查按**行**判定——任何含 `G-a` 词面的行若同时含 `CLOSED/已关闭` 字面、且另有含 `G-g` 词面的行也含该字面，即红。下方建议行已按此写：**"G-a"引用与"收口"字面不同行**；G-a 行本身保持无 CLOSED 字面。落文 PR 推送前须 `node scripts/lint-g-g-wording.mjs .` 绿。

## 建议替换行（PENDING-GATES.md 现 :19 行 → 提案行）

现文（收口前口径，将被本提案取代）：

```
| **G-g** | **静默已订阅通道的排除门=独立开放项（用户：不得随 G-a 默认关闭）**：…现状=名字级降级+响亮 alarm（事实已证，契约文本未收口） | 开放 | 契约文本+证据清单收口前，该配置在验收矩阵中=UNSUPPORTED/待证，不得默认 SUPPORTED |
```

提案行：

```
| **G-g** | **静默已订阅通道的排除门（用户：不得随取消范围裁决默认关闭）**。证据门**已收口**（GATE-VERDICT @alpha5-g-g-gate，master@46a406b9 基）：支持契约 §3 G-1..G-5 已合 master（ced9254c，独立 review bbaf45de）⇒ 分级 P1=D · P2=E · P3=E · P4=E+D（同配置恢复路径已测，"钉到 re-bind"允许口径自此成立）· P5=D+E（对照）· P6=E（armed⇒proven 已成断言）· P7=D · P8=E（措辞 lint 挂 root suite 常跑）· P9=UR；live 轮 G-6/G-7 已合（0e0b605a，review ACCEPT b90abc10 + 独立复跑 ead3f155）= **LIVE-CONFIRMED**（G-6 19/19×2 · G-7 18/18，G-6 计分项挂 G-d 不随本行） | 收口（证据级；**等级上限 LIVE-CONFIRMED/ENFORCE-PARTIAL**：缺 OS 强制面 · trusted 输入 fixture-grade · 取消协作式，三项原样在册 README:60-67，增强=独立后续项非本门）；静默失效**非 fail-closed**（G-7 实测被移 Body 实跑，证伪在案） | 无剩余证据动作；措辞禁则由 lint-g-g-wording 常跑执行；双维度（proven 可达 vs 静默响亮告警）禁合并措辞；引用带 GATE-VERDICT §3-§5 |
```

## 配套（同一守卫 PR 内，可选但建议）

1. G-a 行（:14）"放行前动作"列尾的 "**G-6/G-7 仍 LIVE-GATED=PR3 后接线轮**；G-g 保持开放至 live 项+落文双闭环" 已过时（live 项已落地，落文即本提案），改为："G-6/G-7 live 项已落地（见 G-g 行提案）；G-g 行同步收口"。**注意 G-a 行任何更新不得引入 CLOSED/已关闭 字面**（lint 互斥 + 边界②）。
2. 支持矩阵/s12 若被引用，行状态以本提案 + GATE-VERDICT §1 分级表为准；`s12-residual-evidence.md:335` 的矩阵 G 行"未收口"由落文 PR 一并对齐（只追加注记，不抹原文）。

## 不改变的事项（明示）

- 取消范围裁决原文不动；D-1 延期不动；G-d 行独立开放不动；P9 UR 不为 P1–P4 顶替；"恰一次暴露"旧宣称维持撤回（seam-record :99-122）。
- ENFORCE 级不可宣称：三项缺项原样列出（OS 强制面 / 可信 fixture-grade / 协作式取消），增强为独立后续项，非 G-g 门槛。
