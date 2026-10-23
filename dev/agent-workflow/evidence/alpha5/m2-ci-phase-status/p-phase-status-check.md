# p-phase-status-check.md — Q9 提案：state-freshness 腿最小校验 phase_status 三态一致性

- 卡：`M2-CI-PHASE-STATUS-01`（本卡 owner = M2 CI worker；共享件唯一 writer = CENTER）
- 日期：2026-10-23；工作树 HEAD `c978eb2fc`（draft PR #359 分支 `feat/a5-m1-center-kernel`）
- 根裁原文口径 = **最小校验**：不新建审计体系、不设新腿、不设 Host 门。本文件是 `scripts/ci-pr-gate.mjs` 的
  **patch 提案**，由 CENTER 落笔；CI worker 零字节触碰共享件。
- 背景缺口（本卡立案依据，实测）：`checkCurrentContract`（`scripts/ci-pr-gate.mjs:283-517`）只读
  `current_contract` 的六个旧字段（`:307-312`），**不读** commit `0bf5b1c42a325c5806c27dce8313bfa4dfc3c068`
  （M2-DOCS-01）新增的 `phase_status` / `phase_status_collected`。两字段可被删除、写歪、放 flow 值而不产生任何红。

## 1. 判则（语义，先于代码）

Q9 对既有 `state-freshness` 腿（`:1144-1189`，经 `:1166` 折叠调用 `checkCurrentContract`）追加四条，全部
block 内正则读，无新依赖、无 YAML 解析器、无新腿：

1. **必填**：`phase_status` 与 `phase_status_collected` 是 `current_contract` 块的现行成员字段——缺失即红
   （found 0 指名道姓），与既有"production 路径不回落"的 Q8 精神一致：指针不得被静默丢弃。
2. **形状**：`phase_status` 必须是单行字符串标量（引号或裸值，经既有 `field()` 读取）；flow 值（`[`/`{` 起头）
   或 block 标量（`|`/`>` 起头）= 非字符串 = 红。`phase_status_collected` 复用 `baseline_collected` 的
   ISO8601Z 语法（`:332` 同一 regex）。
3. **词汇封闭**：`phase_status` 以 `M<n>-<STATE>` 声明里程碑；STATE ∈ **{FROZEN, MERGED, IN-PROGRESS}**
   （封闭词表 = 当前三态指针的全部现有词。未来加词 = 在 checker 显式扩表，不在指针侧随手造词）。
   里程碑同号重复声明 = 红。
4. **与计划一致（GROUP B 同纪律：比 VALUE，不比子串）**：active_plan 正文中 `当期三态指针` 所在行按
   `M<n> (已冻结 | 已…合入 | 进行中)` 提取计划侧三态，与 `phase_status` 逐里程碑对照：
   `{FROZEN↔已冻结, MERGED↔已…合入, IN-PROGRESS↔进行中}`；里程碑集合不等、或任一里程碑状态词不符 ⇒ 红，
   **detail 同时指名两侧原文**（`phase_status says M2-FROZEN but the plan 当期三态指针 says M2 进行中`），
   因为说不出哪个里程碑动了的红是重新调查，不是指针。

**为何这样切**：`phase_status` 的语义正本 = active plan §4 当期三态指针行（2026-10-23 更新口径）。计划是
CENTER 单 writer 的人类侧文本，graph 块是机读侧；两者漂移正是 s7 轮 `current_phase` 老化的同族事故。词表
只此三条、锚行只此一个（`当期三态指针`）、比较只到里程碑粒度——刻意不做 SHA 级校验（`baseline` 字段与
Q4/Q7 已管修订事实；`phase_status` 括号里的 SHA 是 merge/audit 证据 SHA，非基线副本，Q6 已禁其入文档）。

## 2. 精确 patch（插入位置 + 全文本）

**文件**：`scripts/ci-pr-gate.mjs`（唯一改动点，函数 `checkCurrentContract` 内）。

**插入位置**：Q4 块之后、Q1 注释行之前。锚（现有 `:335-339` 逐字）：

```text
  // Q4 — grammar + git reality. Equality with HEAD is legal; required equality or inequality are both bugs.
  if (!baseline || ![0-9a-f]{40}$/.test(baseline)) …
  else if (!revExists(baseline)) …
  else if (!baselineCurrent(baseline)) …
← 新块插在 Q4 的最后一行 else-if 之后、下面的空行处
  // Q1 — active wording must agree with the contract; retired wording is a stale pointer.
```

（上文 anchor 中 `[0-9a-f]{40}` 处原文件有正则前导斜杠，anchor 仅供定位，勿整段照抄。）

作用域内已存在、被本块直接引用：`ccBlock`（`:297-300`）、`field`（`:301-306`）、`count`（`:317`）、
`activePlan`（`:308`）、`readFile`（形参）、`findings`（`:284`）。

**插入全文**（以下 fenced 块 = 提案正本；`phase-status-kit.mjs` 从本文件提取该块直接执行，见 §4——文档即工件，
无第二副本；测试套件内镜像与之逐行等值，parity 由 kit 自检）：

```js
  // Q9 — the phase_status milestone pointer must agree, BY VALUE, with the active plan's
  // 当期三态指针 line (card M2-CI-PHASE-STATUS-01; the fields were added to the block by
  // M2-DOCS-01). Minimal caliber, no new leg and no second audit layer: both collected fields
  // are REQUIRED members of the block; phase_status is a single-line string scalar whose
  // milestones read `M<n>-<STATE>` from a CLOSED vocabulary; phase_status_collected carries the
  // exact baseline_collected grammar; every disagreement names the milestone with both
  // spellings (graph state and plan word), because a red that cannot say which milestone moved
  // is a re-investigation, not a pointer. A silently dropped pointer is the failure mode this
  // rule exists for: absence and non-scalar shapes are red, never ignored.
  {
    const PS_STATES = { FROZEN: /^已冻结$/, MERGED: /^已\S*合入$/, 'IN-PROGRESS': /^进行中$/ }
    const psCount = count(/^ {2}phase_status:/gm, ccBlock)
    const pscCount = count(/^ {2}phase_status_collected:/gm, ccBlock)
    const ps = field('phase_status')
    const psc = field('phase_status_collected')
    if (ps === null) findings.push('Q9: current_contract.phase_status is missing — the milestone pointer is a required current field (found 0 inside the block)')
    else if (psCount > 1) findings.push(`Q9: current_contract.phase_status must appear exactly once inside the block (found ${String(psCount)}; two active claims for one pointer)`)
    else if (/^[{[|>]/.test(ps)) findings.push(`Q9: current_contract.phase_status must be a single-line string scalar, got a flow/block value (${ps.slice(0, 48)})`)
    else {
      const seen = new Map()
      for (const m of ps.matchAll(/\bM(\d+)-([A-Z][A-Z-]*)/g)) {
        if (seen.has(m[1])) findings.push(`Q9: phase_status declares M${m[1]} twice (${String(seen.get(m[1]))} then ${m[2]}) — one state per milestone`)
        else seen.set(m[1], m[2])
      }
      if (seen.size === 0) findings.push('Q9: phase_status names no milestone — expected M<n>-<STATE> tokens (e.g. M0-FROZEN / M1-MERGED / M2-IN-PROGRESS)')
      for (const [n, st] of seen) if (PS_STATES[st] === undefined) findings.push(`Q9: phase_status M${n} state "${st}" is outside the closed vocabulary {${Object.keys(PS_STATES).join(', ')}} — extend the vocabulary in the checker, never in the pointer`)
      const planText = activePlan === null ? null : readFile(activePlan)
      const planLine = planText === null ? undefined : planText.split('\n').find((l) => l.includes('当期三态指针'))
      if (planText === null) findings.push('Q9: the active plan is unreadable; phase_status cannot be compared to the plan pointer it must agree with')
      else if (planLine === undefined) findings.push('Q9: the active plan carries no 当期三态指针 line — the plan side of the milestone comparison is absent')
      else {
        const plan = new Map()
        for (const m of planLine.matchAll(/M(\d+)\s*(已冻结|已\S*合入|进行中)/g)) plan.set(m[1], m[2])
        if (plan.size === 0) findings.push('Q9: the plan 当期三态指针 line declares no milestone word (M<n> followed by 已冻结 / 已…合入 / 进行中)')
        const gk = [...seen.keys()].sort().join(' ')
        const pk = [...plan.keys()].sort().join(' ')
        if (seen.size > 0 && plan.size > 0 && gk !== pk) findings.push(`Q9: phase_status milestones {M${gk.replace(/ /g, ' M')}} do not match the plan 当期三态指针 milestones {M${pk.replace(/ /g, ' M')}}`)
        else for (const [n, st] of seen) {
          const word = plan.get(n)
          if (word !== undefined && (PS_STATES[st] === undefined || !PS_STATES[st].test(word))) findings.push(`Q9: phase_status says M${n}-${st} but the plan 当期三态指针 says M${n} ${word} — the milestone moved in one carrier only; update plan and pointer in the same commit`)
        }
      }
    }
    if (psc === null) findings.push('Q9: current_contract.phase_status_collected is missing — every collected pointer owes its own timestamp')
    else if (pscCount > 1) findings.push(`Q9: current_contract.phase_status_collected must appear exactly once inside the block (found ${String(pscCount)})`)
    else if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(psc)) findings.push('Q9: phase_status_collected must be an ISO8601Z timestamp (same grammar as baseline_collected)')
  }
```

### 2.1 判则 → finding 文案对照（失败如何上 `DSH-CI-LEG`）

腿既有机制：`state-freshness`（`:1182`）把 `cc.findings.join(' ; ')` 原样放进 `detail`，`legLine`
（`:139-141`）压平空白并截 400 字符。Q9 不加任何输出通道，只往 `findings` 里 push `Q9:` 前缀行。

| 条件 | finding（= detail 片段） |
|---|---|
| `phase_status` 缺失 | `Q9: current_contract.phase_status is missing — the milestone pointer is a required current field (found 0 inside the block)` |
| `phase_status` 重复（块内 ≥2） | `Q9: current_contract.phase_status must appear exactly once inside the block (found N; two active claims for one pointer)` |
| 非字符串（`[` `{` `|` `>` 起头） | `Q9: current_contract.phase_status must be a single-line string scalar, got a flow/block value (<前48字符>)` |
| 无里程碑 token | `Q9: phase_status names no milestone — expected M<n>-<STATE> tokens (…)` |
| 同号重复 | `Q9: phase_status declares M<n> twice (<first> then <second>) — one state per milestone` |
| 词表外 STATE | `Q9: phase_status M<n> state "<X>" is outside the closed vocabulary {FROZEN, MERGED, IN-PROGRESS} — …` |
| 计划不可读 / 无锚行 / 锚行无词 | 三条各自指名（unreadable / no 当期三态指针 line / declares no milestone word） |
| 里程碑集合不等 | `Q9: phase_status milestones {M0 M1 M2} do not match the plan 当期三态指针 milestones {…}` |
| 单里程碑状态不符 | `Q9: phase_status says M2-FROZEN but the plan 当期三态指针 says M2 进行中 — the milestone moved in one carrier only; update plan and pointer in the same commit` |
| `phase_status_collected` 缺失/重复/语法歪 | 三条各自指名（missing / exactly once / ISO8601Z） |

## 3. fixture 与两腿（已落 `packages/testkit/test/a5-current-contract.test.ts`，CI worker 可写集）

- **预铺默认值**：`contractGraph()` 现默认携带一致的 `PS_LINE`+`PSC_LINE`，`files()` 的 active_plan 默认正文
  现携带 `POINTER_OK` 锚行 ⇒ **既有 31 例在 patch 前（reader 忽略新字段）与 patch 后（Q9 判一致=绿）双双为绿**。
- **P9（正例腿）**：一致 fixture 对 ⇒ `[]`；并且**同码直评真实生产件**（`graph.yaml` 块 × 真实 current-execution-plan）
  ⇒ `[]`。⇒ patch 落上真实树不会误红。
- **N9（负例腿）**：①M2 反义 ②字段缺失 ③flow 值 ④采集字段缺失——四种坏形各自 `Q9:` 红且指名不一致项；
  并当场钉住 **gap**：同一反义图现过 `checkCurrentContract` findings=`[]`（本卡要补的洞，实测原文）。
- **镜像纪律**：`checkPhaseStatusProposed` 函数体 = 本文件 §2 fenced 块逐行等值（仅加 TS 注解
  `Record<string, RegExp>` 与 `new Map<string, string>()` 两处）；parity 由 `phase-status-kit.mjs` 机械核对，不靠嘴。

## 4. 实跑证据（本目录 `runs/`，原文入账）

1. 基线定点腿（改前）：`node scripts/ci-pr-gate.mjs --only graph-parse --only state-freshness`。
   **如实记录**：在**纯 HEAD `c978eb2fc` 提交态**该腿先红——matrix 行 `todo_write (M-14)` 的 ⑥ 段括注
   `（含 vitest.json 机读正本）` 让 Q5 把裸 token `vitest.json` 当路径解析（仅试 `vitest.json` /
   `dev/agent-workflow/vitest.json` 两解，真文件实存于被引 run 目录内）⇒ Q5 红。此为共享 matrix 文案问题
   （CENTER 单 writer），与本卡无关、CI worker 不得改；本轮 CENTER 已在**工作树未提交态**将其改写为完整路径
   `机读正本=dev/agent-workflow/evidence/alpha5/m2-todo/runs/2026-10-23T06-57-31Z/vitest.json`，此后两腿
   pass（RC=0）。**CENTER 落笔时请将该 matrix 文案修复一并入账**，否则 patch 后的腿验收仍被这条无关红绊住。
2. `pnpm exec vitest run packages/testkit/test/a5-current-contract.test.ts`：33/33 绿；N9 stdout 含负例真红
   detail 原文与 gap 原文（见 runs/）。
3. `node …/phase-status-kit.mjs`：从本文件 §2 提取 fenced 块执行（文档即工件）——真实树 pass、
   四种坏形各出 `DSH-CI-LEG … verdict=fail detail=Q9: …` 原文、并输出 mirror/patch parity 结论。

## 5. CENTER 落笔清单（一步收敛）

1. 把 §2 fenced 块插入 `scripts/ci-pr-gate.mjs`（§2 锚位；此外对该文件零改动）。
2. `packages/testkit/test/a5-current-contract.test.ts`（落笔时随共享件归 CENTER 单 writer）：
   - 删 `checkPhaseStatusProposed` 镜像与块提取/构造 helper 中的 mirror 头注；
   - P9 改：`expect(grade(contractGraph(), files()).findings.filter((x) => x.startsWith('Q9:'))).toEqual([])`
     （真实树维度已由既有 production-integration 腿覆盖，可不另设 spawn）；
   - N9 的 gap 断言**反接**为期望红：`expect(grade(withPhaseStatus(contractGraph(), '  phase_status: "M0-FROZEN / M1-MERGED / M2-FROZEN"'), files()).findings.some((x) => x.startsWith('Q9:') && x.includes('M2-FROZEN'))).toBe(true)`，
     其余三种坏形同法从镜像直调改为 `grade(...)` 断言；两条 `console.log` 证据行可删。
3. 同轮把 §4.1 的 matrix `vitest.json` 文案修复（工作树已存在，未提交）一并提交，跑
   `--only graph-parse,state-freshness` + 本测试文件定点腿 + `--self-test` 入账。
4. 不新增 `--only` 词汇、不动 `LEG_ORDER`——Q9 折叠进 `state-freshness`，与 2026-10-22 "扩腿不加腿" 根裁一致。

## 6. 边界与诚实法

- **本文件与两条 fixture 腿在 CENTER 落 §2 之前不产生任何 CI 效力**：生产 `DSH-CI-LEG leg=state-freshness`
  今日对反义 `phase_status` 判 pass（gap 原文在 N9 stdout 与 runs/）。fixture 级 ≠ 生产/CI 已生效。
- 400 字符 detail 截断：若同轮 Q5/Q6 红很多，Q9 片段可能被截；这是既有通道的固有性质，判则未改它；
  单条 Q9 finding ≤ ~200 字符已为截断留量。
- 词表封闭是特性不是缺陷：新里程碑词（如 M3-PLANNED 若入指针）必须先扩 checker，红会教你。
- 计划侧只认 `当期三态指针` 锚行一处、`find` 取首行；多锚行（复制粘贴老化）时首行赢——与 field 重复检测
  不同粒度，刻意不加码（最小口径）；锚行措辞大改（弃用"当期三态指针"四字）会转为"锚行缺失"红，属预期。
- `phase_status` 值必须**单行**（与 `field()` 一致的现实约束，graph 现值即单行）；多行 block-scalar 会被
  判非字符串红——要换形状先改 checker，别在数据侧换。
- 本卡零 Host、零端口、零 census、零全 suite；宿主树（:3080 世界）零接触；`docs/plans/**`、`graph.yaml`、
  `scripts/**` 对 CI worker 零字节。
