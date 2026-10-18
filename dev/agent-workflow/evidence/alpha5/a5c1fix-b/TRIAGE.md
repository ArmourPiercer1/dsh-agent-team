# a5c1fix-b TRIAGE（监视腿卷）

- **K10** F3b v1 监视口径过宽 → 跨腿污染 FAIL（disclosed, 22-46-29Z）：25s 窗口覆盖到后续腿启动，新 plan json + landlock launcher 的 access 探针文件（badhandled/{allowed,other,private}）被计入"新文件"。realm 法律（沙箱写域=腿自身子树）给出正确限域 → v2 监视器 pin 种子文件所在目录为 watchRoot，判据=种子 mtime Δ≤+2s ∧ 子树全体 mtime Δ≤+2s（exit.json 除外，launcher 收尾合法）∧ 子树零新文件。
- **根 22:50Z 措辞收紧令在案**：F3 判词只认 F3b；rc 代理形仅参考。
- 卷间不可并跑：`a5c1fix-b-` 前缀被 base kit sweep（前缀 `a5c1fix-`）包含；全部串行执行。

- **K11** v3 补丁splice换行缺陷致 run 3 首启即语法死（kit-side，零世界副作用，run 戳未生成前死亡）：python splice 拼接 newc 末行缺 \n，`check(F3b)` 与 `const relayed` 粘连。修复后同 run 名重跑（kit-b3.out）。
