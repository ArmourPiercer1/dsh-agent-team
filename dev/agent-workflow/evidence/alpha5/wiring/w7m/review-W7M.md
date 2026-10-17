# review-W7M — W7M（alpha5-w7m-kit @ `b8ac7acb`）独立 reviewer 裁决

- **reviewer** = W7M 独立 reviewer（qwen3.8-flash-next；≠ 实现者 e7bcb50a、≠ dd7bb571；本会话未参与 W7M/W-E2 实现）
- **受审 SHA** = `b8ac7acb243a190bb6592d72976e0d5369c4ae4c`（分支 `alpha5-w7m-kit`，origin tip = 同值）
- **一次性 worktree** = `.worktrees/a5w7m-rev-w7m`（detached @ b8ac7acb，porcelain 空）
- **review 时间** = 2026-10-17T04:40Z … 04:5xZ
- **裁决 = 补充内容**（0 阻塞项 in-increment；1 个**合并裁决条件**必须满足，否则该合并动作本身构成阻塞；4 项 MINOR 补充）

---

## 0. reviewer 自证环境（复现前提）

| 项 | reviewer 自有事实 |
| --- | --- |
| 运行时 | 本 worktree 自有 `tests/deepseek-harness-test-use` 副本，`rev-parse HEAD = 639ed015397290b3745d163aafe02ffee4aa3f84`，`status --porcelain` = **0 行**（跑前/跑后各测）；只读源 baseline `/srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness` @ 同 SHA、porcelain 0 |
| lane dist | **由 reviewer 自己从 b8ac7acb 源码重建**（`pnpm --filter @dsh-agent-team/runtime run build` → `tsc -p tsconfig.build.json` exit 0）；barrel `sha256 = 694852ff90185022263eaa2509cc63eb5ea06f2ddb305e4a817a3883a8bb1d69` 与实现者构建 + 在册 `barrel-import-gate.txt`（`694852ff90185022`）**逐字节一致** ⇒ GLUE-1「公开 barrel = repo dist」非宣称 |
| 稳定实例 | `:3080` 只读探测：跑前 401 / 跑后 401，零操作 |
| 端口 | 跑前 `ss -ltn`：3180–3186 **全空闲**（reviewer 外部自证；见 §5 MINOR-2：kit 自身未做端口探测） |
| 世界 | `a5w7m-rev-*`（本轮 brief 指定前缀）+ `a5w7mrev-*`（RED 对照）+ `a5w7rev-*`（W7 复跑）+ 1 个 `--keep` 世界（用于 §2 持久性实测，实测毕已删除）；**结束时 `tests/homes/` 剩余世界 = 0** |
| 证据 | `dev/agent-workflow/evidence/alpha5/wiring/w7m/rev-*`（本文件同批入库；token/auth-cookie 扫描 = 0 命中） |

---

## ① A3-(a) 四件增量真实性 —— **核实为真**（reviewer 独立复跑 24/24 EXIT=0）

reviewer 复跑（**非引用实现者的 run**）：`node tests/kits/a5-w7m-m13-domain-veto/a5w7m-kit.mjs --evidence-dir …/rev-w7m-run --port 3184 --world-prefix a5w7m-rev` → `criteria: 24/24 pass`，`EXIT=0`，世界 `a5w7m-rev-2026-10-17T04-40-37` 删除并复验（M12c `world=removed porcelain=0`）。

| 增量 | reviewer 亲验（`rev-w7m-run/`） |
| --- | --- |
| (1) 公开 `session/create` 建 **PLAIN** 会话 | `POST /api/session/create` → 200 `{sessionId:"session-a5w7m-plain-2026-10-17T04-40-37", agentPreset:"standard"}`。路由在 pinned 树为**上游公开面**：`packages/api/gateway/src/index.ts:235`（`intercept('/api', …)`）+ `packages/api/session-controller/src/index.ts:136`（`namespace:'session'`）`:272`（`@Remote('create')`）⇒ 非 kit 私造入口 |
| (2) `bash run_in_background` 真注册 `ctx.jobs` | 真实工具结果 = `started background job bash-1`（模型侧真实跨进程边界，非 mock 返回） |
| (3) `job_list` 真列 | verbatim 一行：`bash-1 [bash] running — echo A5W7M_EFFECT_2026-10-17T04-40-37 && sleep 1 && echo A5W7M_EFFECT_2026-10-17T04-40-37_END` |
| (4) `job_output` 真收 | 两个 marker + `[status: completed, exit code: 0]` 全收，链终态 `A5W7M_ALLOW_DONE` |
| veto 三格同面零注册 | **同一** `job_list` verbatim 渲染 = **恰 1 行**（允许腿）；`vetoMarkerHits=0`、`vetoSideEffects=0`；四格全在册（`cell-FT/TF/FF` denied + `cell-TT` granted）；row 侧 `commits=["cell-TT"]`、CAS `version 0→1` 只归因 cell-TT、veto 格 `actuator_invoked=false` |
| 分层自证（非文字） | PLAIN 会话实测模型面 = 26 名，含 `bash/job_list/job_output/job_kill`；治理（kit preset）面实测 **5 名、`job_*` 零命中** ⇒ 「(a) 层在 host 自有面 / 治理面无 job 面」是观测事实 |
| 非空洞性（reviewer 自跑 RED） | `--without-row` @3184（世界 `a5w7mrev-*`）= **12/24，EXIT=2**，缺腿逐条失败（M1b 404 / M4-M5 null / M9 settled=0 window=undefined / M11 fields=false）；M10 absent-anchor 仍如实 0/0 = 正确不过 |
| probe 只读复跑 | `probe-M-13.mjs` → `ANCHORS runner-grep=PRESENT` + A1–A5 **SATISFIED** + 13 条 `evidence_refs` 逐项存在 → `# VERDICT LIVE exit=0`（`rev-probe-M-13.log`） |
| TeamPermit 腿的宿主事实 | 复跑两 member 为 **HOST minted**：`inst-0bp5m3h18pk6`(wa) / `inst-0air2wo11979`(wb)，childSession 互异、lifecycle=CREATED ⇒ TeamPermit 判决对着 HOST durable 事实 |

**口径校准（非缺陷，读法要求）**：
1. `M7b`「veto 三格在同一公开 job_list 面零注册」在字面上永远为真——三格是 **row 内部 gateway admit**，其 effect 通道从不指向 `ctx.jobs`。故该腿是**同面一致性/非空洞性核验**（允许腿恰 1 行 ⇒ 零注册不是空面假象），**不是**「被治理拒的真实 host 工具调用不注册」的证明。真正的 veto⇒0 证据 = row 联锁账本（M7a）。
2. W7M 的 **A1（Team 拒）实现 = `owner-mismatch`**（A 持锚 lease + B 冲撞同 jobId 的构造性碰撞），是 lane 真实码但属**归因拒**；W-E2 的 A1 = 真实 PR2 kernel `requires-approval`。⇒ 两册并存才完整，并册不是形式主义（见 §4）。

---

## ② 覆盖门发现的定性 —— **治理面自锁属实；(a) 层落 PLAIN 会话 = 如实分层（判定：非绕行）**

**reviewer 独立复推**（零端口零世界；用我自己在 b8ac7acb 上编译出的 lane classifier `packages/runtime/dist/…/operation-permission/permission-coverage.js`，输入 = 我复跑中 PLAIN 会话**实测** 26 名面，`rev-coverage-gate-rederivation.txt`）：

- `evaluatePermissionCoverage(surface, facts).ok = **false**`，20 条 FATAL，其中
  `job_list / job_output / job_kill → known-sensitive-unmanaged`，reason = `background job process control is outside the static permission coverage (no alpha.2 operation adapter)`；
- `KNOWN_SENSITIVE_TOOL_PREFIXES = ["job_"]` ⇒ 整个 `job_` **族**（含未来新控制）皆 FATAL；
- 最小面 `[bash,job_list,job_output,job_kill,read,write]` → `ok=false`（三条 fatal）⇒ 与「shipped standard preset 治理会话必红」同构；
- 与在册 typed 原文同码同类同 reason（`run-RED-attempt1-coveragegate/setup-failure.json`：19 名 unmanaged、`code: alpha2-permission-coverage-unmanaged-tools`、抛点 `agent-bindings.mjs:2445`）⇒ **typed 原文在案且可复推，发现不是叙述而是事实**。

**定性（明确结论）**：
- **是治理面自锁**：lane 自家六类封闭并集把 `job_` 族钉在 `KNOWN_SENSITIVE_UNMANAGED`（第 5 类 = FATAL），且它自给的两条 remediation 只有 `builtinToolDeny`（把面删掉 ⇒ 无面可观测）或「新增 reviewed operation adapter」（超出 W7M 范围）。⇒ 治理（`capabilities.permissions` strict）会话在 alpha.2 **结构上没有 job 面的合法席位**。
- **(a) 层落 PLAIN host 会话 = 如实分层，不是绕行/不是扩面**：PLAIN 会话是 host 自带面（公开 `session/create` + shipped `standard` preset），Team 治理面对它**不适用** ⇒ 没有任何「本应生效却被跳过」的东西；veto/矩阵/负控全部在 row 装配面上做，未借 PLAIN 会话冒领治理证据；这正是在册 recheck 给 (a) 层的位置（见 §5 MINOR-4 引文悬空）。
- **`DSH_PERMISSION_MODE=danger-full-access` 判定：只作用于一次性测试 host 进程 + 其一次性世界；不构成任何持久权限扩面。** 依据（全部实测）：
  - 注入点唯一 = kit 的 `spawnHost` 子进程 env（`a5w7m-kit.mjs:414-426`），pinned 树读取点 = `packages/bundle/base/cordis.patch.yml:232`（`sandbox-policy.mode`）与 `:248`（approval `policy: … 'never' : 'ask'`）——boot 期 `process.env` 求值，**进程作用域**；
  - 仓库产品/装配源码对该 env **零引用**（全树 grep：仅本 kit + 上游自带测试 fixture/捕获件）⇒ 无被分发/被装配的默认值改变；
  - 世界外零写入：`:3080` 只读 401→401；pristine 树 porcelain 0；repo 树 porcelain 0；
  - **世界内唯一持久痕迹**（我用 `--keep` 实开世界测得）：每会话投影 `storages/session_projcache/sessions/*.json` 的 `"sandboxMode": {"val":"danger-full-access"}`（plain/root/team/team-child 各 3 命中）⇒ 随世界删除（我的复跑 `world=removed`；kit M12c 500 ms 后复验）。**无 `~/.dsh`、无 :3080、无仓库配置被写**。

**披露充分性 = 基本充分但不完整（MINOR，非阻塞）**：`disclosure[3]` / `a3_allow_leg.approval_mode` 只写了「批准层 policy=never」，缺三句——(i) 同一 env 同时把**文件沙箱 mode** 置为 `danger-full-access`（`cordis.patch.yml:232`，不只是批准层）；(ii) 它是 **host-global**：同一世界内 team-child 会话同样记录该 mode（我实测，非仅允许腿）；(iii) **默认 `workspace-write`+`ask` 组合未被测过**——允许腿在无头条件下通过，故 (a) 层的 LIVE 结论条件于该旋钮，不构成「默认批准层下同一腿已验」。

---

## ③ `w_e2_quote` 不冒充声明 —— **核实：真实归属，零冒领**

| quote 断言 | reviewer 抽查 |
| --- | --- |
| 「六腿链在册记账 = W-E2 @`a9bbeb1c`（`alpha5-wire-tools2`）」 | `git merge-base --is-ancestor a9bbeb1c <branch alpha5-wire-tools2 tip f26c3971>` = YES；分支名对 |
| 「28/28」 | 直接数 `a9bbeb1c:…/we2/runs/gated-2026-10-17T04-01-07Z/criteria.json` = **rows 28 / pass 28**；其 `run-receipt.md` 亦 `criteria: 28/28 pass` |
| 「TRANSITIONED-LIVE 提案」 | `a9bbeb1c:…/matrix-machine.json` M-13 行 `status_now=TRANSITIONED-LIVE`、`verdict=LIVE`、basis 自书「提案值（终裁归 PR8 正式轮 + 独立 reviewer）」 |
| 「本回合不重做其记账／同型不冒充六腿链」 | 结构上成立：W7M `veto_matrix[*]` 字段集 = `cell/team_permit/domain_permit/outcome/error/team_refusal_code/effect_committed/device_version_before/after`，W-E2 = `team_permit/domain_permit/outcome/leg/device/grant`；`negative_controls` 三件亦不同（W7M：unresolved/withdrawn/cas-stale；W-E2：unresolved/post-publish-unbound/cross-member-lease）⇒ 未拿 W-E2 的腿当自己的；W7M 13 条 `evidence_refs` 全指向**自己** run 目录且逐项存在（probe 亲验 + 我复验） |

---

## ④ `M-13.receipt.json` 逐键 diff —— **W7M 非 W-E2 超集 ⇒ 合并裁决条件（不可覆盖）**

根因（先定性质，再谈丢键）：`b8ac7acb` 与 `a9bbeb1c` 是**同一父 `aece4f21` 的兄弟提交**（`merge-base = aece4f21`；`a9bbeb1c` 不是 `b8ac7acb` 祖先）。所以 `a9bbeb1c..b8ac7acb` 的 diff **不是** W7M 增量，而是「W7M 增量 + W-E2 内容的反面」。W7M 真实增量（`aece4f21..b8ac7acb`）= 102 文件：新 kit（3）+ 新 w7m 证据 + `M-13.receipt.json`(M) + probe 日志 + runner run；**未碰** `matrix-machine.json` / `packages/**` / `scripts/`（IF-5 计数 0）。`git merge-tree --write-tree` 实测 = **唯一冲突 = `M-13.receipt.json`**。

逐键（24 键全列；`rev-M-13.receipt.{we2,w7m}-copy.json` 为两侧原文副本）：

| 键 | W-E2 | W7M | 状态 |
| --- | --- | --- | --- |
| `row` | Y | Y | **identical** |
| `veto_side_effects` | 0 | 0 | **identical** |
| `round`/`run_utc`/`host`/`port`/`world_prefix`/`caliber`/`evidence_refs`/`veto_matrix`/`negative_controls`/`pinned_host` | Y | Y | CHANGED（各自回合事实：3183/`a5e2-*` ↔ 3184/`a5w7m-*`；ref 集不同） |
| **`assembly`** | Y（kit row/fixtures/lane-compile/driver 四路径） | — | **W7M 无** |
| **`veto_zero_byte_evidence`** | Y（`device-actions.jsonl` 恰 1 行 + aux/belt version=0 + 联锁可读回对照） | — | **W7M 无** |
| **`red_contrast`** | Y（ungated 22/28 红且仅红 Team 门控腿） | — | **W7M 无** |
| **`gate_semantics_note`** | Y（domain-ref 作用域键 = `approval-case.ts:83` 同一律；`DOMAIN_DENIED` 登记名） | — | **W7M 无** |
| **`not_observed`** | Y（durable MemberInstance 腿／job_start host 面） | — | **W7M 无** |
| `kit`/`pinned_host_observation`/`veto_side_effects_observation`/`a3_allow_leg`/`observed_on_assembly_face`/`w_e2_quote`/`disclosure` | — | Y | W7M 新增 7 键（独有增量=A3-(a)） |

**判定**：按既定合并裁决依据「W7M 应为超集；任何丢键 = 阻塞」——**W7M 版不满足超集**，故：

> **合并裁决条件（B-1，条件性阻塞）**：canonical `M-13.receipt.json` **禁止**以 `b8ac7acb` 版覆盖 `a9bbeb1c` 版。任何「取 W7M 侧」的冲突解会一次性丢掉 W-E2 的 `assembly`（装配面在册）、`veto_zero_byte_evidence`（字节级零副作用证据）、`red_contrast`（RED 对照 22/28）、`gate_semantics_note`（门语义）、`not_observed` 五键 —— 即抹掉已审通过的六腿记账。该**覆盖动作 = 阻塞**；**并集 = 无阻塞**（无测试损失、纯在册合并）。

---

## ⑤ W7 零回归 —— **核实（reviewer 自己跑 22/22）**

`node tests/kits/a5-w7-jobs-wiring/a5w7-kit.mjs --evidence-dir …/rev-w7-w7rerun --port 3185 --world-prefix a5w7rev` → `criteria: 22/22 pass`，`W7_EXIT=0`，anchor pre/post `0/0`，世界 removed（`rev-rerun-W7-and-RED-console.log`）。
附带（reviewer 自跑，零端口）：`pr8 runner run-pr8-negative.mjs` → `RUNNER_EXIT=0`、结构 lint OK、`PASS=27 FAIL=0 NOT_RUN=0 LIVE=0 PROBE-GATED=5 TOTAL=32`、`final_declaration 全 null`（`rev-runner-rerun-reviewer.log`）⇒ 与本树行态（M-13 = `TRANSITIONED-PROBE-GATED`，承父树 W8-formal 记录）一致。

---

## 1. 附带发现（MINOR，均为补充项，不阻塞增量）

- **MINOR-1 端口政策未过政策位**：`HOST_PORT` 直接取 `--port`，未过 `tests/paths.mjs` 的 `isSanctionedTestPort()`（该函数注释明写「harnesses and bounded runners now read these numbers」）⇒ 传 `--port 3080` 会被**直接尝试**，违反 TEST_METHODS §3.2 只靠操作纪律。W7 同病（既有事实），但新 kit 应补。
- **MINOR-2 README 与代码不符**：README 称「3184 self-proved free；若被占则记录偏差并改用 3180 族空闲端口」，代码里**既无端口空闲探测、也无回退**（只有 M1a 断言 boot marker 端口 == 请求端口）。本轮 3184 空闲由 reviewer 用 `ss` 外部自证，非 kit 自证。措辞或实现二者择一修正。
- **MINOR-3 receipt 里一句是无条件表达式**：`pinned_host_observation` 的 `live roster job-start-shaped = []`（`a5w7m-kit.mjs:979`：`(anchorPost !== null ? [] : []).concat()`）与真实 roster 观测**无关**（恒为 `[]`）。真观测在 `anchor-runtime-roster.json`（我复跑：roster = 15 名全 `team_*`，`rosterHasJobStart=false`）。⇒ 该句改为读 `stateEnd.body` 或直接删；顺带注意：该 roster 面 = `teamRoot.tools`（Team 工具面），措辞「live roster」宜限定，absent 主证仍是宿主树 grep 0/0。
- **MINOR-4 引文悬空**：kit README（3 处）+ kit 注释（1 处）引 `dev/agent-workflow/evidence/alpha5/wiring/w7/JOPS-CAPABILITY-RECHECK.md`，该文件在 **b8ac7acb 树、父树 `aece4f21`、master 均不存在**，只在未合并分支 `alpha5-jobs-recheck`（origin tip `078e6d1e`）在册。⇒ 引文须带 `branch@SHA`（或把该 recheck 文档并入册）；否则本轮独有增量的「在册位置」在受审树内不可解。
- **MINOR-5 差距表未同步**：`pr8/vnext-migration-gap-checklist.md` C-08 行仍写「Domain mock（CAS/联锁）待建 + 三腿缺项」，而本轮已建并已观测；覆盖门 `job_` 族自锁事实也未登记。⇒ 建议 C-08 更正 + C-08/C-09 各加一句：`job_` 族 = `KNOWN_SENSITIVE_UNMANAGED` ⇒ 治理会话无 job 面合法席位，解锁需 reviewed operation adapter（这才是「(a) 层只能在 host 自有面」的根因登记位）。
- **附带（无覆盖门、纯口径）**：本轮唯一增量把「Team 拒」实现为 lease 归因拒（§0 校准 2），W-E2 用真实 kernel `requires-approval`；两册并置才是 M-13 A1 的完整强度。

---

## 2. 裁决

**补充内容**（四选一）。

- 通过面：①②③⑤ 四项 reviewer **全部独立复跑/复推成立**——A3-(a) 四件增量真实（24/24 EXIT=0 + RED 12/24 非空洞 + probe LIVE exit=0）、覆盖门自锁属实且 (a) 层落 PLAIN = 如实分层、`danger-full-access` **仅一次性 host 进程 + 一次性世界作用域**（零持久扩面，实测）、`w_e2_quote` 零冒领、W7 22/22 零回归、runner 27/0/0/LIVE=0/PG=5、IF-5 共享面零触、`:3080` 零操作、token 零外泄、世界零残留。
- 补充要求（compat：纯在册/措辞，不动语义、不动产品面、不重跑）：MINOR-1…5（§1）+ B-1 并集解法（§4）。
- **B-1 = 条件性阻塞**：仅当合并时以 `b8ac7acb` 版 receipt **覆盖** W-E2 版才触发（丢 5 键 = 抹已审记账）。走并集即无阻塞。

## 3. 合并序建议（给协调者）

1. **W-E2 先合**（`alpha5-wire-tools2`：canonical 内容 `a9bbeb1c` + 其独立审 `f26c3971` 已在册）——它是 M-13 canonical receipt 与矩阵 `TRANSITIONED-LIVE` 记录的记账本体。
2. **W7M 随后**（rebase 到含 W-E2 的树上），`M-13.receipt.json` 冲突解 = **并集**：W7M 的 7 新键为体，W-E2 的 `assembly` / `veto_zero_byte_evidence` / `red_contrast` / `gate_semantics_note` / `not_observed` **原样保留**；矩阵 M-13 行 = W-E2 的 LIVE 记录 + `live_legs_booked` 追加一条 A3-(a) 腿 + `evidence_refs` 追加 `rev…/run-GREEN/{plain-session-create,allow-leg,veto-side-effects,host-face-anchors}.json` 与 `probes/runs/w7m-probe-M-13-LIVE.log`。
3. 若协调者不愿改写 canonical receipt（等价方案，同样满足 B-1）：W7M receipt 独立落 `pr8/probes/receipts/M-13.receipt.a3a.json` 在册，canonical receipt 保持 W-E2 版，矩阵行 refs 追加两册 —— probe 只读 canonical，不受影响。
4. W7M 侧 MINOR-1…5 可同批或紧随（均不影响任何已验观测）；**不得**为消 MINOR 而重跑改判据。
5. 任何步骤若出现「取 W7M 版覆盖 W-E2 版 receipt」⇒ **立即停**（B-1 触发）。
