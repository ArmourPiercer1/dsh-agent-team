# PR1 Delta 复审 — PR #253 修复轮 `2075a815..2c045840`（head `2c045840ff789007e20fbe0b6daf81f8eee30e47`）

- **Reviewer**: Alpha.5 PR1 原独立 reviewer（≠实现者；模型 `qwen3.8-flash-next`，powered-by 逐字；与原 FAIL 审查同一独立会话线）
- **审查对象**: 修复轮三提交 `623f9a81`（F1–F5 BLOCKER 关闭 + 失败路证明）/ `af5fabaf`（§12(i) + manifest）/ `2c045840`（MINOR-2 撤销 + MINOR-3 条件注记）；kit 判据 8→9 order 腿 + 13 Host 腿 = **22**（run-17 22/22，final=07-35-26 重跑 22/22）
- **方法**: 一次性脚本在已提交 dist 上按原复现语义重放 R1–R4（`.rt-review-scratch/repro2.mjs`，用后即删）；vitest 实跑；run-17 / fatal-f5 证据核对；不 merge 不 push（除本件）

## 总判定：**PASS — 建议恢复 PR1 Gate**（0 BLOCKER / 0 MAJOR；MINOR-1 保持 open 不阻断；INFO 2）

## 1. R1–R4 原语义重放 — 全部 CLOSED，且非"全拒糊弄"

同一脚本对 delta 后 dist 重放（原文均在运行输出中）：

- **R1**：publish 前 own-scope 注册 `evil_own_tool` → `entry = {origin:inherited-native, verified:false, bindingId:"unbound-observed:<scope>:evil_own_tool"}`，`decide => deny TOOL_BINDING_UNVERIFIED`。**同时正控**：全局视图内可钉定的 `read` 仍 `verified:true bindingId=native:read`（native 允许 = 显式 trusted list（`tools.schemas()` 无 scope 的全局公开视图，agent-bindings delta）∧ bind 时 `tools.get` 可钉定，两事实缺一不可；closed-world-guard.ts bindInheritedSurface 重写）。
- **R2**：同名换 body → `deny reason=definition-drift`；entry `verified=false revision=2`（verification 以不可变 revision 撤销，**永久**直至受信 re-bind；revalidateSurface 只降不升，`revise()` 获得生产调用者——原审查指出的死通道已活）。**R2b**：definition 不可读 → `deny definition-unreadable`，"读不到=没变"路径被封死；resolver 缺失 ⇒ 组装不发布（R2c）。
- **R3**：`on` 缺失 / pre-execute 注册抛错 / `tools.get` 缺失 ⇒ 全部 `install ok=false (IO_POLICY_UNSUPPORTED)`；抛错腿 `listeners left on ctx = []`、mask 未撤——`unarmAll + failAssembly + residue:'none'` 实证无半装残留；seams 计数（requiredSeams=5）由 publish 断言。
- **R4**：lease 挺过 `tools/post-execute`（inFlight=1），只在 `tools/result`（registry 终发射边，成功/错误路径均测）+ ACTIVE 期内结束；drain 开始后迟到的 settled 回调**记录并拒绝**（TOMBSTONED 半态保持、mask 不撤），`noteDrainGiveUp` 后 release 永久拒绝——原复现中"body 存活即完全拆防"已反转为"body 存活即永不拆防"。
- **非全拒证据**：run-17 真 Host C3（governed read 出内容）、C4（legacy lane native write 落盘）、C5（re-drive 再出内容，drift=0）、C1d（2 Agents 发布）全 PASS；我的一次性正控腿（bind→publish→pre/post/result 走全链→零在飞干净 RELEASED）亦过。

## 2. F2 特别核 — 成本/时序如实；撤销不可逆成立

- 每调用一次 `tools.get` 读 + WeakMap 函数身份 → O(1) 内容无关指纹，无时钟（S7 钉）、无源码比较（防 re-stringify 伪造）；resolver 在服务可读的装配期捕获（Cordis proxy inject 约束注释在位）。
- **TOCTOU（INFO-1）**：per-call 读发生在 body 解析前，读→registry 实际执行之间仍存在公共接缝固有的微观窗口（同 scope 在他调用体内热重注册）。该敌手类别 = 设计 §4.1 明文排除的"恶意同进程 Host 插件任意改写注册表"，且后续调用必被 drift 检测撤销；README/install 注释如实地把每调用读说成 decision-path 而非原子保证。无虚假承诺。
- **不可逆性**：`DEFINITION_DRIFT`/`DEFINITION_UNREADABLE` 的 verified 撤销经 revision+1 落账（[scoped-dispatcher.ts](../../../../../packages/runtime/tool-dispatch/scoped-dispatcher.ts) reviseImpl 单通道），恢复仅受信装配显式 re-bind（同 bindingId + 严格更高 revision）；`tools/change` 通道只降不升——热注册无法自我平反。

## 3. NEG1-SEAM 旧测量更正 — 替代而非并列掩盖

README "a correction on the record"：旧 SEAM 的 park 未真正吊住 Body（obs 尾序 `wrapper-enter→body→wrapper-return` 早于 teardown）⇒ 旧结论作废并**明文撤回**；重测（[a5p1-order-hazard.mjs:116](../../../../../tests/kits/a5-pr1-guard-dispatch/a5p1-order-hazard.mjs#L116) 起）`postExecutedAfterBodyReturn=true, inFlightAtTeardown=1, bodyReturnedAtTeardown=false`——lease 语义随之内移。`NEG1-R4` 是新语义的**执行腿**（drain 后晚归 body → refused release、mask kept、late callback 记录），与 SEAM 是"测量/行为"两层，非掩盖。**8→9 无丢腿**：run-17 表逐条含旧 8 条 + NEG1-R4；NEG1-CONTROL native=1 防护对照原样在位。

## 4. baseline / lint / artifacts 抽验

- `baseline-identity-diff.json`（F1–F5 后重测）：`only_in_after = 0`，7 个共同红文件身份法（原文 method 字段）；`a2c7` 13 条的 full-suite 条件注记在 [s12-evidence.md:118](../../../../../dev/agent-workflow/evidence/alpha5-pr1-implementation/s12-evidence.md#L118)。
- 实跑：lane 4 测试文件 **122/122 绿**（较原审 +20 新 F1–F4 RED-first 用例，`runs/F1-F2-guard-RED.log`/`F1-F4-install-RED.log`/`F1-F4-lane-GREEN.log` 在库）；`npx eslint`（4 个 in-scope 文件）exit 0；`pnpm check:artifacts` OK 1572 files（含脚本自身 tree-vs-index 与 build-freshness 的区分声明）。

## 5. 原 4 MINOR 处置

- **MINOR-1**（C2b transcript 级无效果判定）：**仍 open**，按 parent 口径记录不阻断。
- **MINOR-2**：final（07-35-26 重跑）`undeclared-name-evidence.json` note 重写并以 "…that contradicted the data in this same file and is withdrawn (independent review MINOR-2)" 明文撤销——**属实**。
- **MINOR-3**：a2c7 full-suite 环境条件注记落 s12:118，方向声明（两树同身份）与我的双树实跑一致——**属实**。
- **MINOR-4/F5**：`alpha5-pr1-host/fatal-f5/` 实存（summary `cleanup.world=removed, residue=verified absent (re-checked 500 ms)`）+ `runs/F5-forced-fatal.log` 全 trace + `--inject-fatal-after-boot` kit 入口 + liveness 改 `kill(pid,0)` 的坑注记——**FATAL 腿实证闭合，MINOR-4 关闭**。

## 6. INFO 汇总（不阻断）

- INFO-1：§2 的公共接缝微观窗口（设计已排除该敌手类别；建议 PR2 Admission 落 Grant 时一并覆盖参数指纹维度）。
- INFO-2：`definitionIds` WeakMap 进程内代际——重启后新号，与 Binding 同寿命语义一致，无需动作。

## 结论

四条 BLOCKER 的**修复行为均在本 reviewer 原复现语义下独立重放成立**，正反两侧同时有证（governed 腿真跑、敌手腿真拒、半态永不自动拆防）；旧测量更正走"明文撤回+重测替代"路径；证据链（RED-first、run-17、fatal-f5、baseline 重测）自洽。**建议恢复 PR1 Gate。**
