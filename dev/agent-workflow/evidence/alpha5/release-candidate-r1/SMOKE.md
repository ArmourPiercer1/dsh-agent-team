# ④ 隔离安装 smoke 真跑 — `tests/homes/rc-trial-1`（世界已按具名清单清理）

> 执行 = 本目录 `rc-trial-kit.mjs`（入口即 ③ 的 `rc-trial.sh` 同款参数）；mock 仅占 LLM 位（3491）；世界端口 3183（+3184 预留自证空闲）；宿主 = pinned `639ed01539` porcelain 0 前后。
> 停止令期间=只读落账；根 20:2xZ ④ 单放行「修工装+另跑新腿入新 runs/<stamp>」后完成 r4/r5。三+两轮的全部原始收据在 `runs/`，本文不改写任何红。

## 运行史（如实全录）

| 轮 | run 目录（`runs/` 下） | KIT_EXIT | 结果 | 定性 |
| --- | --- | --- | --- | --- |
| r1 | `2026-10-18T19-49-50Z` | 1（FATAL） | 18 PASS / 0 FAIL：I/B 全绿；**leader 链 600s 超时 FATAL** | **kit 侧 bug**：`team_list_members` 结算体是转义 JSON 字符串（`\"instanceId\":\"inst-…\"`），实例 id 正则要求闭合引号故不中。产品面零红（该轮 `wire-digests.jsonl` 显示 create-member/list 均已 `status:"executed"` 正常返回）。世界按具名清单手动清（forensic pass，记录于本 README），供改判据重跑 |
| r2 | `2026-10-18T20-01-51Z` | 2（RED） | 22 PASS / 6 FAIL | **真实发现（在册）**：`team_delegate` 实例形**同样必填 `label`**，宿主具形拒 `TEAM_TOOL_BAD_ARGUMENTS: required argument 'label' is missing`（`wire-digests.jsonl` seq7 verbatim）→ member 腿整体未触发（M1/M3-M7 连锁红，M2 判据弱=leader 工具在场即过）。**产品行为正确（具形拒），我的脚本参数不合规**；随附发现：随面 SKILL 行文（`label`（create form））与 schema 必填范围有出入=docs 精确化事项（已录 ②§C-15） |
| r3 | `2026-10-18T20-03-25Z` | 2（RED） | 26 PASS / 2 FAIL | **两条红（M5/M6）= 我 kit 断言正则在转义 JSON 上的误判**（`/"exitCode":1/` 对 `\"exitCode\":1` 不中）——红 receipt 里产品三件套**逐字在场**（原文照录于下表，标 SUPERSEDED）。当时按「不重跑」令止于此轮 |
| r4 | `2026-10-18T20-15-22Z` | 1（FATAL） | 0/0，**H1b 拦截** | **设计行为（fail-closed 真立功）**：kit 起腿即测 `ls-remote master=5885e46e ≠ 审计树 b6d7c48a`——**#340 恰在窗口内合入 master**。FATAL-SWEEP=[] 无残留。审计树重挂新头后重跑 |
| **r5** | `2026-10-18T20-16-14Z` | **0（GREEN）** | **28 PASS / 0 FAIL / booked=0** | 正则已修 + 基线=**`5885e46e`（#340 shell cancel leg = 现 master）** 全链复跑绿：I 族三零 **1773/1773 rootSha=`3a3911a8fb494034…`**、launcher `1264ea58…`/26992B/abi4、placement rows=[team_grep,team_glob,team_bash,read]、`bash · exit=0` 真落盘、`bash · exit=1`+内核 `Permission denied` verbatim、`cancelled:false` 在场（**无取消路径下语义正确**——#340 语义=user/parent 取消才 true，取消腿装面驱动=a5ie-r5 范围）、C1 具名清理 left=[]、:3080 401→401、porcelain 0 |

## r5 全绿逐腿要点（全量=`runs/2026-10-18T20-16-14Z/criteria.json`）

- **I3 族**：installed=1773 == 现场重数 declared-face（1771 `files:`+pack 2）；missing/extra/sha-mismatch=0；rootSha `3a3911a8fb494034…`（#340 轮 12 字节变更全部 sha 对齐）。
- **M5**（修后判据）PASS：`bash · exit=1\n> (empty stdout)\nstderr:\n> cat: ../outside/secret.txt: Permission denied…exitCode:1` 三件套真匹配。
- **M6**（修后判据）PASS：`markerOnWire=0 cancelledFalse=true`（零泄露+无取消路径下 `cancelled:false` 逐字在场）。
- **注（如实）**：M6 判据**文案**仍写 "stays unreachable pre-#340"——#340 已合，该从句过时；判据内容（无取消渲染 false）在双语义下皆正确。改文案=工装小件，留 a5ie-r5 轮随派单更新（本轮不改判据内容以免动账嫌疑）。

## r3 历史红（原文保留，**SUPERSEDED-BY-regex-fix**）

| 腿 | 判定 | receipt 原文（当时） |
| --- | --- | --- |
| M5 | FAIL（判据工件） | r_out=`bash · exit=1\n> (empty stdout)\nstderr:\n> cat: ../outside/secret.txt: Permission denied\n> \na5p5-meta {"kind":"shell","exitCode":1,…}` ——三件套逐字在场，红因正则对转义引号不中 |
| M6 | FAIL（判据工件） | `markerOnWire=0`（泄露判据真过）；`cancelledFalse=false` 同因；收据含 `"cancelled":false` 原文 |

## 划界（如实）

- 本轮 = **最小 smoke**（简报六步 + I 族安装三零/部署输入/装配见证 + 具名清理），**不等价**于 `a5ie-r5`（#340 合后全量 50 腿级装面验收=现最优先验收位，含取消腿/oracle/通读/glob 五控/lsp 挂载等）；Z 族（非 team 零足迹）证据止于 a5ie-r2b/r3/r4-b2。
- 环境事实：node v24.21.0 / pnpm 11.7.0 / python3 3.12.3 / Landlock abi 4；世界全字节现装自 GitHub 远端（r5 `downloaded 1`=**冷装新 SHA** 5885e46e 实证）。
