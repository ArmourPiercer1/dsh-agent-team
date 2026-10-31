# a5w-law1 — 律① ACCEPT_DISCLOSED_UNSOURCED 最小变异执法（dated 2026-10-31T12:50Z 真实 UTC）

- 席位：工程基线席 workflow C（零 boot 零端口）；worktree `.worktrees/a5w-law1`，
  分支 `task/a5w-law1-fixture-20261031` @ base `e18d758c6e559c235f051047f665252438340a74`（origin/master）。
- 改动面：仅 `scripts/eb3-tool-acceptance.test.mjs`（+3 用例 (m)(n)(o) + harness 一处字符串透传）。
  **真实 checker `scripts/eb3-tool-acceptance.mjs` 与 `scripts/eb3-ci-negative-controls.mjs` 零字节改动。**

## 1. 缺口来源（sync17 F-1，#528 审席）

eb3 checker 律①（`eb3-tool-acceptance.mjs` :429-436）：DISCLOSED 行若声明 `source`，
`reason` 必须能在该文件内 verbatim 找到（`containsVerbatim` :260-263，含 whitespace 归一半支）。
该分支**无任何变异 fixture**：

- `scripts/eb3-tool-acceptance.test.mjs`（原 12 测试）全部是 RUN/CASE 律；
- `scripts/eb3-ci-negative-controls.mjs` C20 只演 (d) 空 reason→UNREASONED（:1023-1028），
  不触碰「reason 不在 source 内」分支。

后果：把 `containsVerbatim` 削弱为恒真，CI 仍绿——律①是装饰而非执法。

## 2. 三腿设计（加在 test.mjs，合成台账，零真实台账依赖）

选址裁决：test.mjs 的 `grade()` harness 本就接收合成 ledger + 注入式 `readFile`，
支持合成 source 文件输入 → 按任务倾向加此处；negative-controls 不触碰（其 honest
half 跑真实台账，与本缺口无涉；其变异腿纪律「in-memory copy, never disk」与本次
「合成 fixture 台账」一致，未破坏）。harness 唯一改动：records map 的字符串值原样
透传给 `readFile`（原 `JSON.stringify` 会吃掉散文换行，归一半支将无法被测）。

- **(m) 红腿**：DISCLOSED 行（`pr:'#528'`，合成 `source` 文件存在）reason 不在
  source 内 → 断言恰 1 条 finding 且 code=`ACCEPT_DISCLOSED_UNSOURCED`、detail 命中
  「does not contain the reason verbatim」分支（区别于 source-absent 分支）。
- **(n) 归一绿腿**：同 reason 在 source 内被换行+缩进+多空格重排 → 直接 `includes`
  必假，只有 whitespace 归一半支能使其绿 → 0 findings。把归一收紧（恒等比较）会红。
- **(o) 负控自证腿（变异执法）**：内存 monkeypatch 不可行——ESM 导出绑定只读，且
  checker 内部以局部函数调用 `containsVerbatim`（削弱导出影响不到调用点）；checker
  亦无注入 env。故按任务预案走**临时副本树**：`readFileSync` 真实 checker → 锚点
  `export function containsVerbatim(haystack, needle) {` 后插 `return true` →
  `mkdtempSync(tmpdir())` 落盘副本 → 动态 `import()` 副本 grade 同一 (m) 台账。
  断言三连：① 副本下 (m) 台账 0 findings（=(m) 断言在恒真世界必红 → (m) 真实依赖律①）；
  ② canary：副本上空 reason→`ACCEPT_DISCLOSED_UNREASONED` 仍触发（副本是活 checker
  非死模块，防空 import 假绿）；③ 微分对照：真实模块对同一台账仍出 UNSOURCED。
  **锚点 fail-closed**：锚点消失 = (o) 红，强制变异控制与 checker 同演进，不得静默空转。

## 3. 验证输出（worktree 内，2026-10-31 真实 UTC）

```
$ node --test scripts/eb3-tool-acceptance.test.mjs
ℹ tests 15 / pass 15 / fail 0        （原 12 + (m)(n)(o)）

$ node scripts/eb3-tool-acceptance.mjs        # 真实台账，honest half 未受扰
EB3-TOOL-ACCEPTANCE pass tools=31 L4-proven=19 L4-disclosed=11 L4-unverified=1   (exit 0, findings=0)

$ node --test tests/world-factory/registries.test.mjs
ℹ tests 12 / pass 12 / fail 0

$ node scripts/eb3-ci-negative-controls.mjs   # 未触碰，sanity leg
24/24 control(s) behaved as required
```

## 4. 负控自证输出摘录

test.mjs (o) 腿在进程内做同一实验；另做一次进程外一次性演示（/tmp 副本，真实树
`git status --porcelain -- scripts/eb3-tool-acceptance.mjs` = 空 复核零改动）：

```
$ sed 's|export function containsVerbatim(haystack, needle) {|…{\\n  return true // MUTANT|' \
    scripts/eb3-tool-acceptance.mjs > /tmp/…/mutant.mjs   # 临时副本树，真实文件只读
real   findings: [ 'ACCEPT_DISCLOSED_UNSOURCED' ]
mutant findings: []
```

恒真世界红变绿 = sync17 F-1 描述的缺口实形；(o) 断言正是把这次演示固化进 CI。

## 5. 诚实边界（执法覆盖不对称就此闭合）

律②③（RUN/CASE 律）自 R-ACCEPT-RUN-1 起有变异 fixture；律①自本 commit 起有。
三律的「削弱即红」覆盖不对称就此闭合。仍诚实披露的残余边界（不假装补全）：

- (o) 变异的是 `containsVerbatim` 本体（恒真）；「source-absent 分支」(:434) 的独立
  变异执法未补——它不经过 containsVerbatim，削弱 :434 不影响本次三腿，属另一装饰面，
  未在册缺口（sync17 F-1 只点名 :434-435 verbatim 分支无 fixture）不硬凑。
- 覆盖在 `node --test` 腿（CI 调用 `scripts/*.test.mjs` 惯例），不在 C20 腿——C20 的
  honest-half 语义（真实台账必须绿）未被触碰，24/24 复核在案。
- 负控副本落 `os.tmpdir()`（TEST_METHODS §7 之外的纯内存级临时物，用毕 `rmSync`，
  不登记 tests/homes/——无 launch token、无世界状态，非 DSH_HOME 世界）。
