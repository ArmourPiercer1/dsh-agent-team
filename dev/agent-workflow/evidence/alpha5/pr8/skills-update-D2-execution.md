# skills-update-D2-execution — D-2 落文执行注记（4d990c89 名义执行代理，qwen3.8-flash-next）

- **日期**：2026-10-16 之后的 D-2 收尾执行轮（本文件随 `alpha5-d2-skills` 分支落证）。
- **基线**：`origin/master` @ `ced9254c4cf1fd3d93007d95491f75fc4bdf2582`（fetch 后实测），一次性 worktree `.worktrees/alpha5-d2-skills`，分支 `alpha5-d2-skills`，单 writer。
- **输入**：候选文案 `dev/agent-workflow/evidence/alpha5/pr8/skills-candidate-D2.md` @ `origin/alpha5-pr8-runner` `c0cfa718`；权威原文 `dev/agent-workflow/PENDING-GATES.md` @ `origin/alpha5-pr1r-followup` `3768a28d`（G-a 行 :14）。
- **改动面**：仅 `.agents/skills/team-leader-operations/SKILL.md`（新增 §8 + §7 追加一条）+ 本注记。**blueprint skill（team-blueprint-authoring）未动**（候选未涉及其语义，验收清单第 9 条自然满足）；harness 用户级 dot skills **零触碰**；master 未动。

## 落位注记（候选建议 vs 实际文件结构）

- 候选建议"新增 §8、§7 追加一条"。实际 master 文件在 §7 之后还有一个**无编号** `## Do not narrow a shell-class permission below 'allow' (Alpha.4, 2026-10-08)` 附录节。
- 最小侵入落位：§8 插在 §7 列表与既有 `---` 分隔线之间（编号序 §7→§8 连续，Alpha.4 附录保持文末原位）；§7 追加条按候选原文置于 §7 列表末尾。未移动/未改写任何既有行。
- frontmatter（name/description）未动；文件既有词表（§6 `executed/rejected/blocked/...`）与 §2 `team_archive_member` quiesce 表述未与 §8 互相指代（验收清单第 8 条满足：§8 全文不含 quiesce 字样，脚本可复核）。

## 与 PENDING-GATES G-a 行的一致性（脚本比对）

- **裁决段逐字一致**：G-a 行的裁决与边界段（`**用户裁决 2026-10-16 17:52Z：接受扩大取消范围**（限定=…三分类…）。**边界：不扩大为 provider 卸载自动杀全团队；G-g 不随之关闭；不回填为 17:02 合并时已批准**`）在 `cc47fb18` 与 `3768a28d` 两 ref 间 **byte-identical**（脚本 diff，段截取 `sed 's/。运行接线验收.*//'`，输出 `RULING+BND SEGMENT IDENTICAL`；两 ref 仅"验收依据"列不同）。SKILL.md §8 引用即取此段口径（英文行文，候选已译，六要素语义逐点对应）。
- **§8 候选逐字保真**：候选 §8 代码块 46 行 vs SKILL.md §8 区段 diff = 仅末行追加一句（见下"唯一增句"），其余 45 行含缩进逐字一致（`diff` 实测）；候选 §7 追加条 4 行逐字在场（`grep -Fxf` 4/4）。
- **引用锚点在场计数**（`grep -cF`）：`2026-10-16 17:52Z`×1；`17:02`×1（与 17:52Z 同段，"NOT to be read back into the 17:02 merge"）；三分类 `not executed`/`executed, possibly with side effects`/`termination unconfirmed` 各在场；`auto-kill the whole team`×1（4(a) 裁决边界）；`G-g`×2（末段"support-matrix position is NOT closed"，非 SUPPORTED/已合规口径）；`D-1`×2。三边界（不杀全团队/G-g 不随之关闭/不回填 17:02）同文在场。
- **旧口径残留扫描 = 0**：'定义移动只影响后续调用' 式与 '已开始调用绝不收到 abort' 式英文弱/强表述正则扫描 0 命中。
- **结构门禁**：`## ` 标题序 = §1..§8 连续 + 文末无编号附录；frontmatter 完好；本文件无 markdown 链接（`](` 计数 0，抽核通过）；token/secret 扫描 0。

## 唯一增句（超出候选文本，供独立 reviewer 4dac3d04 核）

任务六要素 ⑥ 要求"无 outbound upstream 请求"在文在场，候选 §8 未含此句。按 `PENDING-GATES.md` 头部原文（"本登记**仅限项目内**：不构成对 Host upstream 或任何外部的请求；对外提交是将来须用户另行授权的动作"）在 §8 末段追加：

> This deferral is a project-internal registration only: no request has
> been filed with the Host upstream or anyone outside this repo, and filing one is a separate
> future action requiring explicit user authorization.

除此之外零改动、零删除。kit 判据名（RW-*）锚点按候选"可删锚点不得删语义"权限**全部保留**。

## 边界与流程

- 本文件不构成 D-2 完成声明；状态推进由 4dac3d04 独立审查 + 终验按 PENDING-GATES 流程登记。
- push = `alpha5-d2-skills` 新分支 ff 创建（任务授权，无 force）；master/stable 未触碰。
