# round-6 补采：**未交付**（如实记录失败原因与缺口，不出伪数据）

**判定一句话：来源全证 = 否。** 已证的只有"写入点级"事实（round-5：launcher 无 stderr 写入点、控制记录写
`exit.json` 文件、provider 原样暴露 stderr、`code` 是 LAUNCHER 的、parity 条文在 `glob-backend.mjs:994`）；
**逐腿 stderr 原文语料 + 同次 exit.json rc 的实证矩阵仍未采集**，矩阵存在空格，不得声称全证。

## 本轮实际发生
1. 附带项①（rg 直调 rc=0/1/2 各 ≥3 次）**失败并已被丢弃**：本 worktree 的裸 shell `PATH` 里没有 `rg`
   （`rg --files …` → `rc=127 command not found`），`require('@vscode/ai/ripgrep').rgPath` 亦为空；
   生成的 12 行"corpus"记的全是 rc=127 的 shell 报错，**不是 rg 的退出码**，已 `rm -f` 删除，不入库。
   ⇒ 有效做法（下一手直接用）：走行层自己的解析路径拿 rg 绝对路径（`glob-backend.mjs`/`search-backend.mjs`
   内的 rg 解析与 `rgBinDir` 计算，allowPaths 里那条 `{ path: rgBinDir, … }` 就是它），再用绝对路径直调。
2. 附带项②（round-4 的 24/51 复现计数在"收口形"下重测）**本轮未做**：复现需要"两流收口"的产品码补丁，
   而本单要求**产品码零动**——两条要求在这一点上互斥，需你裁决顺序（先落收口形分支再复测，或允许在
   `.glob-flake-diag/` 那样的旁路副本上复测，不动产品树）。
3. 51 腿全量 `internalLog` + 同次 `exit.json` rc 的采集**未开始**（上下文预算耗尽）。
   可行配方（已验证过的零件）：`internalLog` 能拿到 walker 原词——先例见
   `alpha5-glue7-plane-backends.test.ts` 的 `loud` 腿（断言 `lines.join('\n')` 含 `error parsing glob`）；
   `exit.json` 由 launcher 写在 provider 为其分配的 out-dir（`prelauncher:504`），采集需先定位该 out-dir
   （本轮没定位，属真实缺口）。
4. 清理纪律遵守根令：**未用宽 glob**——只按 `git status --porcelain` 的 `??` 名单逐名删除，tracked 文件零删。

## 空格清单（矩阵现状）
| 需要实证 | 现状 |
| --- | --- |
| rc=0 有匹配 + 良性 note 原文（24/51 那一格） | 缺：需行层 `internalLog` 落盘 |
| rc=1 无匹配 + stderr 是否空 | 缺：同上（rg 直调未取到真 rc） |
| rc=2 真错原文（`[unclosed` 族） | 部分：round-4 抓到行层 detail 前缀逐字；rg 原文未取 |
| 权限形（unreadable） | 缺 |
| 每格 ≥1 条逐字原文 | 缺（仅 rc=2 有行层 detail 前缀） |
