# W7M-2 — coverage 门禁 `job_*` 家族：定位 + 分腿保持 + 受治理装配三件实证

- 分支 `alpha5-w7m2-covgate`（base master `148c3f49`）；port 3184 自证（`runs/*/port-self-proof.json`）；world `a5cvg-*` 全部跑毕删除（C10/C-red3 实证）。
- 宿主 pin：`0.2.0-rc.2 @ 639ed015397290b3745d163aafe02ffee4aa3f84`（`tests/paths.mjs` 唯一来源）；porcelain 0 pre/post（C0b/C9）。
- 本轮**未触碰**任何 glue/barrel/registry/lane 源码与 `matrix-machine.json`；`dist` barrel 字节不变（C9 `barrelStable=true`）。IF-5 遵守。

## ① 定性：**计划外（OUT OF PLAN）**

`job_*` 的 coverage 注册在当期任何计划中都不是计划项：

- PR249 §10 PR7 = identity/lease only（无 jobs coverage 项）；
- alpha2 A2C-1..8 = 无 jobs operation adapter 项；
- W7 卡片无 coverage 项。

仓内门禁自身把 `job_kill/job_list/job_output` 分类为 `known-sensitive-unmanaged`（`packages/runtime/operation-permission/permission-coverage.ts:161/:138/:180`，本树 needle 实证 `runs/green/repo-citation-anchors.json`），caller-injected 闭集三元组经 glue 事实注入（`packages/runtime/src/plugin/live/agent-bindings.mjs:2435`；`packages/domain/blueprint/src/schema.ts:406`）。声明 `capabilities.permissions` 的模板（strict）一旦 surface 含三件，团队启动 **fatal**。

**最小复现（原文入册）**：

- `runs/repro-jobs/`（3/3 PASS）— 标准面 + 仅 jobs 插件。fatal 原文：
  `PermissionCoverageUnmanagedError: permission coverage gate failed for instance 'inst-leader': 3 unmanaged tool(s) on the final model-facing surface: job_kill (known-sensitive-unmanaged), job_list (known-sensitive-unmanaged), job_output (known-sensitive-unmanaged) (code: alpha2-permission-coverage-unmanaged-tools)`
  `unknown_unmanaged_present=false` → `job_*` 家族被隔离为唯一 blocker。
- `runs/repro-standard/`（3/3 PASS）— 完整标准面 fatal（三件 + `web_search`/`ask_user_question` 同现）。

## ② 走哪条：**路线 ③（分腿保持）**

计划外 ⇒ 不借道任何计划项升格：#284/W7M-A3a 三件保持**公开能力实证**（plain-session 域）；W-E2 的 M-13 引用**不**复用为升格（`gap-registration.json.legs_not_borrowed`）。同时把缺口如实注册（精确 file:line + 上列最小复现），并用**合法绿色路径**（门禁自己的 remediation (a)：`builtinToolDeny` 移除 model-facing 三件）把受治理装配的三件结果测全。门禁**未被移除、未被放宽、未被绕过**——C1/C6 实证门禁武装且由它自己放行。

## 三件结果（同一受治理团队，非 plain session；`runs/green/` 16/16）

装配 = strict anchor（boot，gate 经 remediation (a) 通过）+ strict main（`/team-remote team.create`，leader 双门 open：`permissions.allow bash/any` + teamEnvelope `bash` exec token；members ask-lane）。行（row）经公开 profile-patch seam 挂载，装配**公开 barrel**（repo dist，8 exports，sha256 `694852ff90185022…` 稳定）+ 宿主 `ctx.jobs` 公开面。

### 1) 两 member 隔离（`runs/green/t-iso.json`）

wa=`inst-02gaqun1yy83`/`session-team-child-d9de…`，wb=`inst-1m7177i1e2tk`/`session-team-child-54b4…`（`durable-state.json`，均 durable `CREATED`）。caller-fenced `jobs.list`：A 只见自己的 `a5cvg-1`；B 见空；leader 见空（本轮 leader 面 guard-blocked，两向皆零）。registry 自己的 fence 原文拒绝：`job a5cvg-1 belongs to another session`；lane gateway 独立拒绝 B 认领 A 的 jobId：`owner-mismatch — this jobId is already owned by another member scope`。

### 2) allow 真注册可列（`t-allow-row.json` + `t-allow-model-verdict.json`）

- **lane-assembly 腿（PASS）**：cell-TT TeamPermit(gateway admit ok)+DomainPermit+ref+CAS 全通过 → actuator 真调宿主 `ctx.jobs.start`，真 spawn `/bin/bash` 生产者，owned by member A 的 child session，registry id `a5cvg-1`，`wait` → `completed`，`readAt(caller=wa-child)` 收效标记原文，device_version 0→1。
- **model-driven 腿（原文测得 REFUSAL，注册为第二缺项）**：leader（双门 open）model 链真发 `bash run_in_background`，被 a5p1 closed-world Guard 在 dispatch 拒绝，原文：
  `Error: team tool guard: the Tool Binding for "bash" cannot be verified at dispatch time (no fallback to the native body)`
  boot anchor 探针（`guard-binding-probe-anchor.json`）**同一原文** → 本宿主构建上每个 strict 受治理面（boot 与 team.create 两路皆同）模型驱动 bash 都到不了 `ctx.jobs`。未绕行：不换 non-strict 模板、不改门禁、不动 lane 源码。

### 3) deny 零注册（veto 面原文入册，`t-deny-zero.json`）

三 veto 格：cell-FT team 侧拒 `owner-mismatch`（gateway 真实身份锚 `C7`：held jobId 按 HOST member A 身份先 admit 成功）；cell-TF/cell-FF domain 侧拒 `DOMAIN_DENIED`（FF 叠加 stale-CAS）。三格 `actuator_invoked=false`，registry delta `newIds=[]` —— 拒绝面**零注册**、零副作用（effect_committed=false，device_version 不动）。

## 缺项台账（注册，不修）

1. `job_*` coverage 注册 = 计划外；缺 operations adapter 或等价 reviewed authority owner（门禁 remediation 原文两案，`permission-coverage.ts:138`）。引用行（本树 needle）：`permission-coverage.ts:161/:138/:180`、`agent-bindings.mjs:2435`、`schema.ts:406`、`validate.ts:1185`。
2. **本轮实测新增**：preset-mounted `bash` 在 closed-world Guard 下无 verified Tool Binding（dispatch 原文拒绝，boot/created 两路一致）⇒ 受治理会话内"模型驱动"注册无法触达 `ctx.jobs`；宿主 jobs PLANE 本身工作正常（leg 2 实证）。
3. RED 对照旁证（披露不追因）：无 row 的 RED world 前两次 boot 出现生产行 `bootstrap FAILED: TeamDomainError: store 'member_instances'/'session_bindings' … the TeamDomain is closed`（race 特征，两 store 各一）；封版 RED run 未复现（`red-no-row/red-observations.json` 原文捕获位）。W7M-2 范围外，仅披露。

## 披露（诚实姿态）

- **无 permission-mode 旋钮**（exec-contract 先例复证）；leader bash 零审批 = 双门 open 形状，by design。
- members **不能**持有 positive bash allow（`validate.ts:1185` "alpha.2 grants no positive whole-tool permission for bash"）——ask-lane 是法定姿态；member 实证走 row actuator。
- actuator 由 lane row 驱动（host plane），这是本装配的全部主张边界；`T-allow` 判据两分支（真注册 PASS / 原文 REFUSAL 已测）都在判据文案里写明，无强制变绿。
- 未移除/放宽覆盖门禁求绿；未知 `job_start` 面 pre/post 皆 0（C0b/C9）。

## 产物索引

| 文件 | 内容 |
| --- | --- |
| `a5cvg-kit.mjs` | runner（`--mode green|repro-jobs|repro-standard`，`--without-row`，`--evidence-dir`，`--port`） |
| `a5cvg-jobs-plane-row.mjs` | 装配行：公开 barrel + `ctx.jobs` 注入 + Domain mock（device/ref/permit/CAS/actuator funnel）+ row routes |
| `runs/green/` | 16/16（含 `gap-registration.json`、`t-allow-model-verdict.json`、`guard-binding-probe-anchor.json`） |
| `runs/red-no-row/` | RED 对照 5/5 |
| `runs/repro-jobs/`、`runs/repro-standard/` | 最小复现 3/3 + 3/3（fatal 原文 + blueprints + instance.log） |
| `M13-CORRECTION-PROPOSAL.md` | M-13 台账缺项更正提案（仅提案，未动 matrix-machine.json） |
