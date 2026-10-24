# a5c1fix-b TRIAGE（监视腿卷）

- **K10** F3b v1 监视口径过宽 → 跨腿污染 FAIL（disclosed, 22-46-29Z）：25s 窗口覆盖到后续腿启动，新 plan json + landlock launcher 的 access 探针文件（badhandled/{allowed,other,private}）被计入"新文件"。realm 法律（沙箱写域=腿自身子树）给出正确限域 → v2 监视器 pin 种子文件所在目录为 watchRoot，判据=种子 mtime Δ≤+2s ∧ 子树全体 mtime Δ≤+2s（exit.json 除外，launcher 收尾合法）∧ 子树零新文件。
- **根 22:50Z 措辞收紧令在案**：F3 判词只认 F3b；rc 代理形仅参考。
- 卷间不可并跑：`a5c1fix-b-` 前缀被 base kit sweep（前缀 `a5c1fix-`）包含；全部串行执行。

- **K11** v3 补丁splice换行缺陷致 run 3 首启即语法死（kit-side，零世界副作用，run 戳未生成前死亡）：python splice 拼接 newc 末行缺 \n，`check(F3b)` 与 `const relayed` 粘连。修复后同 run 名重跑（kit-b3.out）。

## K12 — external mid-run killer (shared host), two victims on the fixed face
- rv2 (23-12Z, harness job): job evaporated from the registry mid-chain; kit+host dead, run dir left at direct-control stage. HARVESTED (disclosed, not a graded run): rc=-15@+3.95ms, gen1={"kind":"user"}, witness bash-2 **cancelled=true**, death-form in member history — raw log redacted at harvest.
- rv2b (23-43Z, detached setsid kit): survived call boundaries but was killed in the pnpm-install phase (peak memory; concurrent foreign agent worlds visible in tests/homes → OOM/reaper suspected, unprovable from sandbox).
- Mitigation posture: harvest-on-death + immediate redact; distribution may legitimately count the harvested sample WITH the label; detached launch is not immunity.

## K13 — rv3 install-phase hang (discarded, no graded run)
- `dsh plugin add` attempt hung ~25min > the kit's 900s spawnSync timeout (timeout not firing = killed-holder stdio pattern, same host instability family as K12). Kit terminated by hand; worlds swept; `kit-rv3.stalled-install-discarded.out` kept. Distribution finalized 2 KIT_DONE + 1 HARVEST.
