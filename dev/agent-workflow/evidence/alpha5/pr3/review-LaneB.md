# review-LaneB.md — A5-PR3 (ControlledFs) 独立 reviewer 审查件

- reviewer: Lane B 独立 reviewer（≠writer；qwen3.8-flash-next；模型/harness 分列）
- 对象: `origin/alpha5-pr3-fs` @ **15002c26**（base `db5cb5f7`；RED commit `bdfbabb7`）；契约正本 = `alpha5-decision-pack-20261016` @ b0d636eb `dev/agent-workflow/evidence/alpha5/INTERFACES-v1.md` C-FS/C-ADM 节
- 运行侧: 一次性 worktree `.worktrees/a5p3-rev`（+RED 复跑 worktree `a5p3-rev-red`）；世界 `tests/homes/a5p3-*`（teardown 后 0 残留）；端口 3182 reserved-unused（无 listener 实测）；:3080 仅一次只读 GET（401，状态如常）

## 总判定（G-d：可否进入集成会话）

**可以进入集成会话（四分类裁决=通过）**，条件见文末 C1–C3（均非阻塞、属接线期义务）。

## ① C-FS 契约符合 — 符合

- `{fs,path,fd?}` 闭集：`cf-descriptor.ts:36`（CF_DESCRIPTOR_KEYS）+ `:61`（PR0 `closeRecordKeys` 拒未知键）；path 闭律（相对、拒 `..`/绝对/反斜杠/空段/尾分隔符、**永不 trim**）`:66-85`。
- **fd 永不入身份**：`descriptorIdentityKey` = `[fs,path]` 两元组（`cf-descriptor.ts:103-105`）；`resolveDescriptor` 出参无 fd（`controlled-fs.ts:447-448`）；呈现 fd 仅作 claim，对 lane 注册表+`/proc` 双验（`controlled-fs.ts:476-493`），从不用于 I/O（读走全新 `readViaRef`）。reviewer 探针 R1 实证：fd 有无不改身份键，`'a b .txt'` 空白保留。
- 三分闭集：`cf-errors.ts:33`（恰三值）+ `:67-94`（reason→class 全划分、越集 throw）；§5 code 全在 PR0 `GOVERNANCE_ERROR_CODES` 内（测试遍历断言，复跑 GREEN 过），无 lane 自造码，class/reason 走 `details.cfClass/cfReason`。
- **hidden-read 强制非空诊断 = 构造性而非约定**：`cfsHidden()` 对空/纯空白 diagnostic **throw**（`cf-errors.ts:143-155`），静默 hidden 在类型+构造双重不可达；实现中所有 hidden 分支（read `:373-380`、resolve `:437-440`）都只能经此构造，stat 走显式 `{exists:false,withheld:true}`+ledger `withheld-stat` 行（`:455-458`）。探针 R2 实证空/空白均 throw。
- 小观察（非 FAIL）：`resolveDescriptor` 未过 visibility——入参 locator 为调用方自带、不出 existence/字节，无新披露，但接线期建议补查或注释定性（→C3）。

## ② PoC3 五腿证据真实性 — 属实（本 reviewer 独立重跑 A–E）

- 复跑 `poc3-probes.test.ts` 13/37 全绿（NAIVE 腿本身即 OS 泄漏实证：alias 裸读=`OUTSIDE-SECRET`、竞态重开=`OTHER-SECRET`、跨成员裸读=`PRIVATE-SECRET`、裸 `readSync` 复用 fd=`RECYCLED-BYTES`——NAIVE 对照确实会泄漏）。
- 另立 7 条 reviewer 自证探针（未提交）：GUARDED 全拒；**B2 inode 换 = `res.ok=false` + `undetermined/exec-time-identity-drift` + code `IO_POLICY_UNSUPPORTED`，绝非静默通过**；E 腿 fd 号复用**实测** `captured=26 == recycled=26`（观察非假设），guarded 拒 `fd-recycled`、体内无新属主字节。
- ledger `open-issued` 仅在真实 open 后记账 ⇒ `open-issued=0` 断言是 OS 级行为断言（A/C/D 腿）。

## ③ open-at-exec 残窗表述诚实 — 一致，无过度宣称

- 探针实证 B 腿 ledger 序：`["open-issued","exec-refused:exec-time-escape","refused:denied:exec-time-escape"]`——**OS foreign-open 确实发生、读字节前被 `/proc` realpath+fstat 重读拦停、零披露**（`open-at-exec.ts:67-93`，escape 先于 drift）。
- README §2.3 与 POC3-RESULTS 判定节据此宣称的三分法与实测完全一致：任意不可信可变树=严格档 **IO_POLICY_UNSUPPORTED**（且 PR8 不得 publish 该 Profile Supported）；固定受信树=成立；`OpenAtPort`（openat2 RESOLVE_BENEATH/IN_ROOT/NO_MAGICLINKS）接缝已立未伪称已证。写侧竞态如实落 `undetermined/write-side-effect-unconfirmed + sideEffectUnknown=true`（探针 R7 实证），未伪装成 denied。

## ④ RED-first 原文 + 37/37 复跑 — 复现

- `bdfbabb7` 内容=仅 5 测试文件+vitest.config+RED 证据（无 `src/`，实测目录不存在）；本 reviewer 在 bdfbabb7 worktree 复跑 = **4 files failed，13 failed | 24 skipped (37)，EXIT=1**，失败行/尾行与 `RED-lane-vitest.txt` 逐条一致。
- 15002c26 复跑 = **37/37 绿 + `tsc -p tsconfig.lane.json` EXIT=0**，与 `GREEN-lane-vitest.txt` 一致；世界 teardown 后 `tests/homes` a5p3 残留=0。

## ⑤ NEW=0 / 共用文件零改动 — 通过

`git diff --name-status db5cb5f7..15002c26` 全列 = **16 files，全部 `A`（新增）**，路径全在 `packages/runtime/controlled-fs/` 与 `dev/agent-workflow/evidence/alpha5/pr3/`；**无任何 shared/tsconfig（根或包）/barrel/registry 命中**（`tsconfig.lane.json`、lane `vitest.config.ts` 均为 lane 目录内新文件）。根 `vitest.config.ts` include=`packages/*/test/**` 不达本 lane 目录=runnable surface 未动（实测）；全仓 grep 无任何对 lane 的 import/引用（唯一命中为 base 已有的 domain 测试字符串 fixture）=**DORMANT 成立**。

## ⑥ token/porcelain/:3080 — 干净

lane 代码+证据 grep 无 token/secret；审查 worktree porcelain 除本轮临时 scratch（已清）外零改动；:3080 仅只读 GET=401（token 门在位，未启停未触碰）；3182 无 listener（reserved-unused，与 README §5 一致）。

## 条件（集成会话义务，非阻塞）

- **C1** README §4 接线注全数执行：`NO_RECHECK`→PR2 `OperationAdmission` 且绑 **本 call 的 PR1 canonical parametersFingerprint**（指纹律）；`effectCovers` subtree→`SubtreeContains`；grant 消费保持 PR2 durable ledger；`OpenAtPort` 落地前 PR8 禁发布 arbitrary-tree profile。
- **C2** 宣称上限维持 fixture 级（"对 fixture/stack 验证"，INTERFACES-v1 集成规则；POC3-RESULTS 已自我限定）。
- **C3** 接线期为 `resolveDescriptor` 补 visibility 检查或在接口注释定性（当前无新披露，非缺陷）。
