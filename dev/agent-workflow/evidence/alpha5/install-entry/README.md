# INSTALL-ENTRY — alpha5 安装面真实 governed-Team 调用验收

- **Base**: master = `bcb65eb8ef821cd51b443eeba2f16930a3f339db`（GLUE-5 final assembly，= origin/master）。工作树 = `.worktrees/a5ie-install-entry`（detached @ base；本证据提交在分支 `feat/alpha5-install-entry-evidence`）。
- **Kit**: `a5ie-install-kit.mjs`（本目录）；**recorded run** = `runs/2026-10-17T17-06-56Z/`；完整 stdout = `recorded-run.log`。测试运行时 = `tests/deepseek-harness-test-use` pristine `0.2.0-rc.2 @ 639ed01539`（porcelain 0，before+after，H1/H3）；端口 3183 + 3491；`:3080` 只读探针 before/after 不变（H3）。
- **终局**: **26/30 GREEN；RED = T5,T6,T7,T8 = 判据②成员工具执行的精确局部缺口**（如实标，见下，不代以拒替代、不 fake、不 patch）。

## 五栏（每判据步：判定 / 怎么亲测 / 证据 / 红与缺口 / 分层）

### ① 纯净安装面自证 — 判定：受控扩展 GREEN，严格公开清单面 RED（红证据保留）

- **怎么亲测**: `git archive HEAD` 按安装清单展开到全新目录（不 import 任何 repo source 路径）。**E1**: 严格公开清单（`packages/runtime/package.json` `files:["dist"]`）= 1727 dist 文件 + package.json = 1728 文件，但生产入口在运行时加载 `<pkg-root>/src/plugin/upstream-resolver.mjs` 与 `<pkg-root>/root-binding/harness/seam.mjs`（镜像外 tracked 源文件）→ **公开清单不覆盖**。按根 16:43Z 裁决：本验收用 aux 面（tracked 集补齐 4 项：两 sibling + `.agents/skills`×2 = 1732 文件）跑 ②③④，并**保留严格面红证据**。**RED-A**: 只按严格清单展开 + 依赖闭包，boot 宿主 → `ERR_MODULE_NOT_FOUND …/src/plugin/upstream-resolver.mjs`（原文引用于 `install-manifest-red-evidence.log`，含引用名 + 逐字解析失败 + skills 未注册告警）。**E2**: drift 门 exit 0。**E3**: 从扩展目录做 6 条生产行 import 探针，BFS 传递依赖闭包 29 包（离线 pnpm store 来源，披露于 facts）零逃逸。**E4**: `module.registerHooks` load-graph purity —— loaded=1635 个 `file:` 模块全部解析于扩展内，foreign=0。
- **证据**: `runs/2026-10-17T17-06-56Z/{expansion-manifest.json（逐文件 sha256）,install-surface-facts.json,install-manifest-red-evidence.log,red-a-facts.json}`。
- **红与缺口**: **RED-A（保留红）**= 打包/路径缺口：`upstream-resolver.mjs` + `seam.mjs`（+ skills 目录）不在 `files:["dist"]` 覆盖内 → 正式修 = GLUE 正式轮单 writer（本 kit 零打包改动）。**诚实披露**: ②③④ 跑在 **non-pure-aux** 面上（每个 world facts 都带 `surface: 'non-pure-aux …'` 标记）——"纯净安装通过"从未被宣称。
- **分层**: 装配级亲测（本 artifact + 本 host 版本）；非族级 GO。

### ② 受治理 Team 真跑 — 判定：deleg/placement/wire/ledger GREEN；**成员工具真实执行 = 局部缺口（正控不可得，精确到行）**

- **怎么亲测**: 从扩展 artifact 启真宿主（preset governed team，mock provider 仅替换 LLM 后端），真实 Leader→member 委托（`team_delegate` sync + `team_collect`，requestToken 纪律），member 链真实调用 read/team_bash/team_grep，全 wire 落 `wire-digests-*.jsonl`。
- **GREEN**: T1 catalog 预检；T2 R1 placement 真实（leader scoped trio + placedRows=2 + carriers=2，无 global）；T3 wire 达两 agent（leader `team_*` 五件、member 别名三件）；T4 真实委托（member-bound session 收 task，4-request 转录，collect `status:"succeeded"`）；T9 ledger（全 session quiet + PR7 gateway lease ACTIVE + SIGTERM exit 0）；S1/S1b/S2 synth（扩展模块直测 lane/lease）。
- **红与缺口（根 16:43Z 边界①口径：backend-failed 只算拒链证据，拒≠正控；能力不可得 → 如实标）**——三条精确 capability 行：
  1. **`read`（受治理成员核心工具）**：dispatch 时 closed-world guard 拒 —— `Tool Binding for "read" cannot be verified at dispatch time (no fallback to the native body)`（BINDING_UNVERIFIED；installed row 未接原生核心工具的 binding feed，pb-CONTRACT §6 provider 装配线）。→ **正控（受治理工具真实成功执行小任务）在现 artifact 不可得**。
  2. **`PLANE_PRESENTATION_FACE.render`（新发现，仅 LIVE 宿主可暴露，synth 测不到）**：`team-tool-plane.mjs:95` render 返回 `String` 而宿主法要求 `ContentBlock[]`（`core/tools/src/index.ts:217`，:1839 消费）→ 任何 trio live 调用（含已算出的拒）在宿主结果组装处崩 `content.some is not a function`，**拒都到不了模型**（S3 GAP PROBE 钉死该行）。
  3. **trio effect backends** = `IO_POLICY_UNSUPPORTED`（已知 GLUE-4 follow-up，pb §6；synth 层 S1b/GLUE-5 已证 lane 拒绝计算正确）。
- **证据**: `world-team.json` + `wire-digests-team.jsonl`（member tr[0]=guard 拒原文、tr[1]/tr[2]=render 崩原文）；`criteria.json` S3 行。
- **分层**: 委托机制/装配层 = 真实跑通（装配级亲测）；成员 IO 执行 = **未交付，局部缺口** —— provider/render/binding 装配补齐归 GLUE 正式轮单 writer（本 kit 只出定位，未自扩面）。

### ③ 同轮非 team 零扩权反证 — 判定：GREEN

- **怎么亲测**: 同一 recorded run 内、同扩展 artifact，standard/minimal 非 team session（A/B 面）与 baseline 对比：**Z-standard / Z-minimal** registry Δ=[] 且 wire Δ=[]，两面零 `team_` 别名，而同 boot 的 governed 世界挂载活着；**T10** 对照之对照：baseline governed leader（无 row config）零别名、零 plane 观测、无 jobs gateway（挂载是 config-scoped，非环境性）。
- **证据**: `world-baseline.json` / `world-gatered.json` + 各自 wire-digests。红与缺口: 无。分层: 装配级亲测。

### ④ coverage 门 / boot 负控仍红一验 — 判定：GREEN（两负控仍如预期红）

- **怎么亲测**: **N3** plane 挂载 + `team_` namespace masquerader 同轮 → setup 死于 `alpha2-permission-coverage-unmanaged-tools`（门未被洗白），非 team session 不受累；**N4/N4b** half-paired trustRoot row → 类型化 `TRUST_ROOT_SHA_MISMATCH` 拒整个 governed setup（无降级、无部分挂载、拒绝处全 unwind）。
- **证据**: `world-gatered.json` / `world-refuse.json`。红与缺口: 无（红是预期产物，已验证仍红）。分层: 装配级亲测。

### ⑤ 收口三件套 + 世界清理 — 判定：GREEN

- **怎么亲测**: **C1** `tests/homes/a5ie-*` 全清 + 两扩展（aux + pure）删除（per-file sha256 manifest 为保留证据）；**C2** 原始 instance log 捕获时脱敏后删除（仅 `*.log` redacted 留存，launch token 零残留）；**H3** `:3080` 稳定实例只读探针 before/after 一致 + test-use porcelain 0 + 世界目录零残留。
- **证据**: `recorded-run.log` C1/C2/H3 行 + 本目录 `*.log`。红与缺口: 无。

## 附

- **OOM 诊断（run6，根 16:55Z 要求）**: 见 `oom-diagnostic-2026-10-17.md` —— mock 全量 body 留存 × 宿主 boot 风暴（25–50 req/s）吃满 kit V8 堆；修复 = digest + body 剪枝 + storm guard（fail-fast 诊断），**未调大任何 cap、未加并发**（世界保持串行）；修复后 recorded run 全程 rss ~100–118MB（`recorded-run.log` `[hb]` 行）。
- **Kit 开发迭代披露（诚实）**: run1–5 = E3 探针分类/匹配缺陷（ESM/CJS regex、store 候选歧义、BFS 闭包补漏），run6 = OOM（见上），run7 = boot-marker 脱敏顺序缺陷，run8 = member-wire 判据污染（leader persona 内嵌 task marker），run9 = evidence 落盘作用域缺陷，run10 = 定位成员真实事实（→ 发现缺口 1/2），final = recorded run。**recorded run 一次成型，中途无任何"为过测改判据"**；T5–T8 判据文本自 run8 起未再改动。
- **git**: 证据在分支 `feat/alpha5-install-entry-evidence`（1 task=1 branch=1 worktree）；**无 push 凭据 → 未推送（如实）**。
