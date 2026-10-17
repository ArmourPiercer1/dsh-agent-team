# review-W8prep — W8 准备轮独立审查（≠writer ed259796）

- **reviewer** = W8prep 独立 reviewer（qwen3.8-flash-next；模型/harness 分列；writer=ed259796，非本会话）
- **受审 SHA** = `1ecb29ea42b9b20bdae9af3a27080eb893cbc665`（branch `alpha5-wire-pr8prep`，base `62cc2b87`；`git diff 62cc2b87..1ecb29ea` = 24 文件 / +2117 / −16）
- **复现环境** = 一次性 detached reviewer worktree `.worktrees/a5w8-rev-w8prep` @ `1ecb29ea`（**全新检出**，非 writer 工作树；writer 工作树全程只读、审后 `git status` 仍净）。本文件是本 diff 之后唯一新增的在册件。
- **裁决 = 投机通过（speculative pass）**：四项审查要求全部独立复现通过、PASS 无证据路径由 reviewer **亲自注入** 31 例全部咬住；风险台账两件（F-1/F-2）须在 W8 正式轮读该机制前落地。零 blocker、零冻结语义冲突。

---

## ① 锚点/名称编码 vs 实际 master 面 — 一致（亲验）

| 检查 | reviewer 亲验结果 |
|---|---|
| `ASSEMBLY_ANCHORS` 三锚点在胶水面现势 | 全新检出 `packages/runtime/src/plugin/live/agent-bindings.mjs` 对 `ConfinedProcessProvider` / `a5p5` / `jobs-gateway` 三串 **grep 命中 = 0**（该文件确有 `a5p1-guard` 等串，证非文件为空）⇒ 五 probe 报 NOT-RUN-READY 是**如实**而非脚本坏 |
| 锚点是否指向真实 master 符号 | W4=`sandbox-provider/index.ts` barrel → `provider.ts` 的 `createConfinedProcessProvider`（锚为其子串，真名在册）；W5=lane 包名即 `packages/tools/a5p5-tools/`；W7=`packages/runtime/jobs-gateway/`（`createJobsGateway`）⇒ 三锚**都不是凭空名** |
| registry 套件锚 | `registry.mjs` 真实 id：`20-controlled-fs`(matrixRows 含 M-04/M-05) / `50-ptc-lsp`(M-08/M-09) / `60-web-jobs-mcp-domain`(M-13)，三处 `run: null` 现势在册 ⇒ probe preflight 的 `run≠null` 判据与登记面同形 |
| M-13 第二预检（编译面） | `packages/runtime/tsconfig.build.json` 无 `jobs-gateway` ⇒ 该 MISSING-ASSEMBLY 行如实；与 `WIRING-SURFACE.md:34`（jobs-gateway tsconfig 归 Lane F 另轮）互证 |
| IF-6 名称面 | probe 断言用的 `IO_POLICY_UNSUPPORTED` / `DOMAIN_DENIED` = §5 冻结闭集成员（`packages/domain/tool-governance/src/errors.ts:28,31`，`a5p0-contracts.test.ts` 钉集）；`admission-unbound` = C-FS 既有 reason（`controlled-fs/src/admission-binding.ts:92` + `a5w-integration-wiring.test.ts:171,178`）⇒ **零新造码**，符合 IF-6 |
| 五 probe 实跑（全新检出，零端口零世界） | M-04/05/08/09/13 = `# VERDICT NOT-RUN-READY exit=3` ×5，逐条 `MISSING-ASSEMBLY` + `DEPEND` 声明 + `MINIMAL-REPRO`；stdout 无 `VERDICT PASS`/`VERDICT LIVE` |

## ② 转态自锁（核心）— reviewer 亲自注入 31 例，ESCAPED=0

注入件 = `.w8rev/inject-runtime.mjs`（22 项）+ `.w8rev/inject-probe.mjs`（9 例），**本地一次性、不入 push**（脚本正文与逐条输出以本节摘要在册；对照臂本身由 prep 测试节常驻）。

- **运行期代码位（60 组合矩阵）**：真实机检矩阵 5 行 × 12 种伪造 verdict（`PASS` / `PASS`+双证据 / 小写 `pass` / `SUPPORTED` / `REQUIRES-LIVE-WIRING` / 空串 / 无 verdict 键 / `LIVE` 四种缺证据变体）⇒ **零行落 PASS、零无证据 LIVE**。具体形态：`attempt-PASS ⇒ result=FAIL + violation=转态违例…`；`LIVE` 缺 `assembly_anchors_verified`（或 `evidence_refs=[]`）⇒ 降级 `PROBE-GATED` + `repro_ref`。
- **第二道兜底（fixture 冒充 LIVE 的路）**：给 pending_probe 行同时置 `automatable=true` 并塞一个**必 PASS** 的 `fixture-surface` hook ⇒ hook0=PASS 而行结果=**FAIL**（运行期兜底）；同一注入被 `assertProbeRegistrations` 与 `lintCorrespondence` 双双咬红。
- **提交时 lint 注入**（每项同时验 `assertProbeRegistrations` 与 `lintCorrespondence` 咬红）：`allowed_transitions` 加 `PASS`／删 `forbidden_outcomes`／`status_now=LIVE`／`probe_script` 指到 `pr8/probes/` 外／`depends_on lane=W8`／整行摘掉 `pending_probe`／**doc 矩阵侧删同步** ⇒ 7/7 咬红。
- **PASS 计数不变式**：五行同时 attempt-PASS 注入 ⇒ `PASS 24→24`（不动）、`FAIL 0→5`、`RLW 5→0`、`LIVE/PROBE-GATED` 独立桶存在。
- **probe 侧（造"假装配"根 + 伪造 receipt，9 例）**：锚点在场无 receipt⇒`PROBE-GATED/4`；断言全 SATISFIED 但缺 `evidence_refs`／缺 `assembly_anchors_verified`／`evidence_refs=[]` ⇒ 三例全 `PROBE-GATED/4`；断言违例⇒`FAIL/2`；`pinned_host.job_start_present=true`（杜撰锚点）⇒`FAIL/2`（A5 咬住）；**完美 receipt 但装配锚点不在场 ⇒ 仍 `NOT-RUN-READY/3`**（receipt 买不到 LIVE）；双条件齐 ⇒ `LIVE/0`（happy path 存在，见 F-1 残余信任边界）。
- **writer 自带违例证据核对**：`runs/w8prep-violation-selftest-full.log` 分布 `PASS=24 FAIL=1 NOT_RUN=3 RLW=2 LIVE=1 PROBE-GATED=1`、`# exit: 2 (1 项实质违规)` ⇒ 与我独立复现同形（attempt-PASS=FAIL、无证据 LIVE=降级、PASS 不动、违规非零退出）。

## ③ 矩阵五行挂接 + doc 同步 + lint + 分布无漂移 — 复跑绿

- `node --test pr8-runner-self.test.mjs` = **28/28 PASS**（全新检出，554ms）；在册 RED 日志 = 28 tests / 23 pass / **5 fail**（判据先红），GREEN 28/28 ⇒ RED-first 链如实。
- `node run-pr8-negative.mjs` = `PASS=24 FAIL=0 NOT_RUN=3 REQUIRES-LIVE-WIRING=5 LIVE=0 PROBE-GATED=0 TOTAL=32`，`lint_issues=[]`，EXIT=0；与在册 `w8prep-negative-run.json` **逐行 32 行结果 diff = NONE**、分布恒等 ⇒ **无漂移**。
- 机检矩阵：恰 5 行挂 `pending_probe`（=RLW 行集 M-04/05/08/09/13），`automatable=false` + `hooks=[]`，`allowed_transitions=[LIVE,PROBE-GATED]`，`forbidden_outcomes` 含 `PASS`，`depends_on.lane∈{W4,W5,W7}`，`anchor_contract` 文本与 `probe-lib.ASSEMBLY_ANCHORS` 逐项同文，`receipt_path` 与 `probe-lib.receiptRelPath()` 同路径；`_meta.probe_transition` 为正本词表。doc 矩阵五行 `pending_probe` 指针同步（未同步=红，已注入验证）。
- **触碰面**：23/24 文件在 `evidence/alpha5/pr8/` 内；第 24 件 = `docs/plans/memo/…/pr8-accept/acceptance-matrix.json`（③要求的 doc 侧同步，仅新增 `pending_probe` 指针，`current_status/known_partial/final_declaration` 零改动；同 N1/折叠轮既有指定转交通道）。tsconfig / barrel / registry / scanner / packages/** 生产面 **零触碰**（`git diff --name-only` 全表核）。

## ④ 差距检查表引证抽查（6 条，全部实质为真）

| 抽查行 | 引用 | 亲验 |
|---|---|---|
| C-04 | `ALPHA5-ACCEPTANCE-STATUS.md §2-④:49`、`admission-binding.ts:146`、`grep -rl str_replace_editor packages --include=*.ts` 非 dist=0 | 三处**逐字命中**（:146 正是 `export const ARBITRARY_TREE_PROFILE_PUBLISHED = false`；grep=0 复现） |
| C-08 | `jobs-gateway/README.md:1,9`、`WIRING-SURFACE.md:34`、`registry 60 run:null` | :1 题注 DORMANT、:9 "zero production consumers"；:34 = jobs-gateway tsconfig 归 Lane F 另轮 ⇒ 命中 |
| C-10 | `WIRING-SURFACE.md:31`、"agent-bindings 零 provider 引用，本轮亲验 grep=0" | :31 正是"agent-bindings.mjs / live registry：零改动"；我对 `ConfinedProcessProvider\|sandbox-provider\|createConfinedProcessProvider` grep=0 **复现** |
| C-12 | `g-g-probes/GATE-VERDICT.md:42,46-48` | 内容对（:42 被移 Body 实跑、:46-48 维度 A/B 分判禁合并），**路径前缀缺 `alpha5-pr1r/`**（正本在 `evidence/alpha5-pr1r/g-g-probes/`）→ F-3 |
| C-06 | `pr6/SEAM-VERDICTS.md:33` | 实质为真但**行锚偏**：窄固定 session-Realm 分支原文在 `:85`；`HARD_PROFILE_ENABLED=false` 实在 `packages/runtime/sandbox-provider/realm-evidence.ts:45`（:33 是同段的"Strict 仍需 PR4 OS 强制，本腿 NOT_RUN"）→ F-3 |
| C-01/C-13 | `reuse-map.md:52-63,153-162`、`legacy-behavior-inventory.md:10-22`、`packages/tools/src/tools.ts:10-14` | 五处行锚**逐字命中**（§1.5 标题 / §3 红线标题 / §0 G1 行 / facade 映射表五行） |

---

## 发现（按严重度）

- **F-1｜MINOR（须在正式轮读机制前落地）— LIVE 的"证据"只查存在性不查真实性，且 `assembly_anchors_verified` 是 receipt 自证布尔**。`deriveProbeTransition` 判 LIVE 仅要 `evidence_refs.length>0 && assembly_anchors_verified===true`；`evaluateRow` 手里有 `ctx.repo_root` 却不对 refs 做存在性核验。复现：`evidence_refs:["runs/does-not-exist-anywhere.log"]` ⇒ `probe_transition=LIVE`。**writer 自带在册证据已呈此形**：`runs/w8prep-violation-selftest-fixture.json` 给 M-08 引 `runs/w8prep-violation-selftest-LIVE-with-evidence.log`，该文件**全树不存在**（`find -name '*LIVE-with-evidence*'` = 0），而该次运行 M-08 记 LIVE。影响面有界（LIVE 是"转态提案"非 PASS、非终裁，且准备轮 LIVE=0），但"无证据不 LIVE"目前只在**指针级**成立。建议（~5 行 + 1 判据，与冻结语义零冲突）：refs 逐项 `existsSync(join(repo_root, ref))`，缺 ⇒ 降级 `PROBE-GATED` 并注 `evidence_refs 指向不存在的记录`；`assembly_anchors_verified` 改为可观测导出（例如要求同 run 的 probe 运行日志在册/哈希钉），并顺手把违例自测 fixture 的 ref 换成真实在树文件。
- **F-2｜MINOR（设计已披露，方向需收）— 锚点预检是单文件子串在场，注释即可满足**。我在 `.w8rev/fake-assembly-root` 把三串写进"胶水面"一行注释 + 把 registry 三套件 `run` 挂上 ⇒ 五 probe 预检转 present、可进入 receipt 判定，配自证 receipt 即出 `LIVE/0`。`probe-lib` 头注已声明"lane 以别名暴露须回报协调者改锚点表"（假阴性方向已披露），但**假阳性**方向未封。建议锚点升为绑定级模式（如 glue 上 `export …createConfinedProcessProvider` / 显式 assembly-marker 区块由 GLUE owner 落，或锚点=文件+导出名二元组），使"名字出现≠引用"这一既有例外形态在本机制上不留口。
- **F-3｜NIT（引证精度）** C-06 行锚 `SEAM-VERDICTS.md:33`→应为 `:85`（+ `realm-evidence.ts:45`）；C-12 路径缺 `alpha5-pr1r/` 前缀。两条实质为真，改指针即可。
- **F-4｜NIT（声明齐性）** `probe-M-04.mjs` 的 `deps` 只声明 2 腿，矩阵 M-04 `depends_on` 声明 3 腿（缺 IF-6 拒装名腿）⇒ `DEPEND` 输出少一行；IF-6 判据本身由 A2 负控覆盖，无实义缺口，但矩阵↔脚本 `depends_on` 目前无机检对齐。
- **F-5｜NIT（分布标签）** `computeDistribution.by_level` 的 automatable 标签由 **result** 反推，故违例判红的 pending_probe 行在 `level×auto` 表里被记为 `U|automatable`（违例自测日志可见 `U|automatable = 1`）。PASS 桶无污染，仅台账读数易误读。
- **F-6｜NIT（在册出处标签）** runner 头打印 `matrix-machine @ base d69bfc4b`（取 `_meta.base_sha`，本轮未更新），与本轮声明基线 `master@62cc2b87` 不同名；建议加 `_meta.prep_round_base_sha` 或在 README 注明两者语义差。另：五 probe 把"registry 套件 `run≠null`"当作 lane 装配在场信号（标 `lane=W5/W4/W7`），而 `run` 实为 PR8 正式轮工作项——方向是 fail-closed，可保留，宜改标注为"正式轮前置"。

## 复现命令（全部零端口、零世界、只读）

```bash
git worktree add --detach .worktrees/<rev> 1ecb29ea
node --test dev/agent-workflow/evidence/alpha5/pr8/runner/pr8-runner-self.test.mjs   # 28/28
node dev/agent-workflow/evidence/alpha5/pr8/runner/run-pr8-negative.mjs              # 24/0/3/5, lint=[], EXIT=0
for r in 04 05 08 09 13; do node dev/agent-workflow/evidence/alpha5/pr8/probes/probe-M-$r.mjs; done  # ×5 exit=3
```

## 裁决

**投机通过**。①②③④四项审查要求全部独立复现成立：锚点现势为零（NOT-RUN-READY 如实）、名称面零新造码；**转态自锁经 reviewer 亲自注入 31 例（含 hooks 假 PASS、假装配+伪造 receipt）零逃逸，attempt-PASS⇒VIOLATION⇒FAIL 与"无证据不 LIVE"双位封死、PASS 计数不变式成立**；矩阵/doc 同步 + lint 绿 + 分布 24/0/3/5 逐行无漂移；差距检查表 6 条引证实质为真。判"投机"而非"通过"的唯一理由 = F-1/F-2 使 LIVE 的证据条件目前停在**指针/自证级**，风险移交正式轮（记入风险台账：F-1 落地前，任何 probe LIVE 转态提案必须由 reviewer 独立核验 refs 所指实物，不得采信 runner 输出）。零 blocker；不触发 `CORE_SEAM_BLOCKER`/`CONTRACT_CHANGE_REQUEST`/`SPEC_CONFLICT`/`DEPENDENCY_BLOCKER`/`TEST_INFRA_BLOCKER`。

— reviewer 工作树 `.worktrees/a5w8-rev-w8prep`（一次性，审毕回收）；writer 工作树 `.worktrees/a5-w8prep` 全程只读、审后 `git status` 净；注入件与本次复跑产物不入 push。
