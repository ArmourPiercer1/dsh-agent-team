# W-E2 Domain-mock 工具族 LIVE 回合 + editor/read_image 测量面（Alpha.5 接线阶段）

基线 = `origin/master @ aece4f21`（分支 `alpha5-wire-tools2`，一次性 worktree `.worktrees/alpha5-wire-tools2`）。
宿主 = `tests/deepseek-harness-test-use` pinned pristine @ `639ed01539`（0.2.0-rc.2，复用已构建，porcelain 前后各=0）（IF-4；本 worktree 内为指向 a5-w8 worktree 同源 checkout 的 gitignored symlink）。
端口 3183（起跑前自证空闲）· mock model 3491 族 · 世界 `tests/homes/a5e2-<mode>-<stamp>`（IF-2/IF-3，用后即删）。
`:3080` 全程只读探测（401/401 不变）。装配 = plugin row（公开 profile-patch seam）+ 公开 `ctx.agents`/`ctx.webServer` + dist 公开 barrels + jobs-gateway **kit-local 编译**（IF-1；IF-5 共享面 porcelain 全程空，runner 自带 L-E2-IF5/IF5-POST 判据）。

## 文件

| 文件 | 角色 |
| --- | --- |
| [`tsconfig.lane.json`](./tsconfig.lane.json) | jobs-gateway 未改源码的 kit-local ESM 编译面（W7 tsconfig.lane.json 同型；产物落 gitignored `node_modules/.a5e2-jobs-build`，重建命令见下『重跑』） |
| [`a5e2-fixtures.mjs`](./a5e2-fixtures.mjs) | 装配构件：dist barrels 装载（tool-governance/tool-admission/tool-dispatch/controlled-fs + jobs build）、PR2 admitCall 端口（tool-invoke + **domain-ref** 效应经冻结解析器；作用域键 `<realm>|tool:<name>` / `<realm>|domain:<id>`，approval-case.ts:83 同一律）、exec-edge one-shot 端口、**DomainMock**（row-local MOCK：CAS+模拟设备联锁，盘面状态文件 `<world>/domain/devices/*.json` + 追加式动作台账 `device-actions.jsonl` = 副作用的字节面；refusal 词表=矩阵 M-13 登记名 `DOMAIN_DENIED`） |
| [`a5e2-domain-mock-row.mjs`](./a5e2-domain-mock-row.mjs) | 测试侧 LIVE 装配 row：注册 `a5e2_domain_act` → PR1 Guard install → bindOwnTools → publish → **publish 后**注册 `a5e2_unbound_probe`（unbound 负控走真实 dispatch 路径）；body = 未确定引用 fail-closed（先于铸 grant）→ PR2 admitCall（TeamPermit 半）→ `mock.decide` 联锁+CAS（DomainPermit 半）→ exec-edge 首耗+重放检查 → `mock.act` 唯一副作用面；routes `/__a5e2/{health,journal,state,agents,veto-table,native-face,native-leg,interlock-probe,assemble}`；`A5E2_MODE=ungated` = 无 guard/无 kernel 的 RED 对照面（Domain mock 独立照拒） |
| [`run-we2-live.mjs`](./run-we2-live.mjs) | runner：boot→create×2（成员 A 工具宿主 + 成员 B 身份）→setup→assemble→脚本化真实模型驱动**六调用链**（acted / Team 拒 / lease 联锁拒 / CAS 拒 / 未确定引用 / unbound 探针）→**两段 bracketed native 测量腿**（read→edit、read_image，含治理观测 census 增量）→interlock 探针→live route 读回→28 条判据→teardown；token 捕获即脱敏 |
| `WE2-RED-UNGATED.log` + `runs/ungated-2026-10-17T04-01-00Z/` | **RED（先跑）**：同一判据表、同一工具面、无 guard 无 kernel → **22/28，红且仅红 Team 门控腿**（GUARD/ACTED/TEAM-DENY/DOMAIN-DENY/VETO-ZERO/UNBOUND：政策外设备被真实写 ledger=2、unbound body 跑 1 次）；Domain 腿（联锁/CAS/未确定引用）独立照拒 |
| `WE2-GATED-GREEN.log` + `runs/gated-2026-10-17T04-01-07Z/` | **GREEN 28/28**（本报告引用之；veto-table/live-state/interlock-probe/native-face/native-legs/transcript-union 俱在该目录） |
| `runs/{ungated,gated}-2026-10-17T03-5*/` | 前两轮迭代实录（判据修正的测量史：census 词表机器化 = 对 master 发射面源串逐名验证；native 腿目标文件移入宿主实例自身 workspace） |

## 结果（三态；IF-7：本阶段终态只有 LIVE / PROBE-GATED）

**① Domain-mock 工具族经 guard+admission+联锁装配进真实会话 — LIVE-CONFIRMED（矩阵 M-13 行级转态提案值=TRANSITIONED-LIVE，终裁归 PR8 正式轮+独立 reviewer）。**
真实模型驱动六腿链（`runs/gated-…/veto-table.json`）：
- **acted 腿**：PR2 grant 铸出（`grant:f9ab61fb…`）→ `mock.decide` 允（lease 空闲首占）→ exec-edge 首耗 ok/重放 typed 拒（ledger consumed=1）→ `mock.act` 唯一副作用（CAS 0→1，台账 1 行）→ `A5E2-ACTED …` 进真实 transcript。
- **A1 Team 拒不可被 Domain 覆盖**：aux 未挂 domain-ref 政策臂 → 真实 kernel 自有词汇 `requires-approval` 拒（Domain 侧本可允：lease=null/version=0），设备 0 副作用、CAS 不动。
- **A2 Domain 拒不可被 Team 覆盖**：kernel 已铸 grant（`grant:6994ff2c…`/`grant:287bad83…`）仍被 mock 联锁 typed `DOMAIN_DENIED` 拒（lease-holder=成员 B 规范 ownerKey；CAS expected=999 actual=1），拒原文进真实 transcript，设备字节不动。
- **A3 veto⇒0 副作用（字节级）**：模型链读回时动作台账恰 1 行=acted 腿、aux/belt version=0；ungated 对照破缺方式（aux 被写）与门承载关系由 RED 面实证。
- **A4 fail-closed 负控**：未确定引用先于铸 grant 拒（grantId=null、不猜绑定）；post-publish unbound body 计数=0（guard 调用边原文拒）；cross-member lease 拒（联锁探针：B act 成功 0→1 证明设备非死、拒是归因性的，A 再犯仍 0 副作用）。
- **A5 pinned absent-anchor**：`job_start` host 全树 grep hits=0 + 活 roster 无机检形名（instrument 与 W7/W8 同型）。
- 身份面：jobs-gateway 公开 barrel admit 两成员 job、规范 ownerKey 相异、lease=ACTIVE；事件 census 17 名全部机器验证为 master 发射面（IF-6 无新码、无退役短名）。

**② editor / read_image — 不发明生产代码，两面实测=精确差距事实（M-04/M-05 行保持 PROBE-GATED，判据腿 NOT-EXECUTED 如实）。**
Team 任何包无 editor/read_image 实现（census 复验；计划出处 `S0-SELECTION-MATRIX.md:51-52`、`post-poc-technical-design.md:78,83-84`、`architecture.md:232-233`）。真实会话量得：
- **gated 面**（本 kit guard 装配后）：模型驱动宿主原生 `read`/`edit`/`read_image` 在调用边被活 guard typed 拒——逐字『the trusted global definition of "edit" is unreadable at the public seam … refusing rather than crediting a name nobody could pin』；治理流可见 dispatcher-call-* 事件（edit 腿 delta=6/img 腿 delta=3），文件字节 0 变化。=W7 披露的 Definition 公共 seam 缺口的 editor/image 侧现测：现行公开 seam 无法把宿主原生实现钉进治理 bind。
- **ungated 对照面**：`read`→`edit` 真实文件编辑往返成功（文件 sha 变化在 `runs/ungated-…/native-legs.json`）、真实 70B PNG `read_image` 解码呈报进 transcript（『image/png 1x1 px 70 bytes』）——两腿治理观测增量=**0**：真实编辑/图像字节完全在 Team 治理面之外流动。
- M-05 的 A4（任意树未发布）经装配 runtime 实读闭环（journal `cf_arb_tree=false`）；缩略图旁路/admission-unbound/子命令映射各腿双侧无面，probe 复跑维持 PROBE-GATED（`probes/runs/w-e2-post-M-0{4,5}.log`）。

**③ 矩阵/runner（诚实分布）**：M-13 machine+doc 双矩阵同步 `TRANSITIONED-LIVE`（transition_record 全部 evidence_refs 实存，runner lint 亲验）；receipts M-04/M-05 刷新为实测式差距事实；`run-pr8-negative.mjs` 复跑 = **PASS=27 FAIL=0 NOT_RUN=0 LIVE=1 PROBE-GATED=4 TOTAL=32，exit 0**（基线=本 worktree 挂宿主 symlink 后 27/0/0/LIVE=0/PG=5，见 `pr8/runner/runs/we2-baseline-post-symlink.log`；空 worktree 无 runtime 的 24/0/3 实录亦在册）。runner 自检 `pr8-runner-self.test.mjs` 全绿。

## 诚实披露（全部主动在册）
1. **Domain mock 是 MOCK**：CAS/模拟设备联锁为矩阵 M-13 evidence_types 在册『待建』项，由本 kit 按批准路径建成 row-local 数据源；界面/词表/台账全标 MOCK，不作真实设备宣称。
2. kernel 信任输入 fixture 级（同 W5/W7/W8 口径）；policyArms 是 row 构造的授权事实，证明的是门的行为，不是生产 policy 的存在。
3. 身份=rootSessionId HOST 会话事实 + 网关规范 ownerKey；**instanceId 为 row-local fixture**（durable-MemberInstance 腿在 W7 kit 在册，不在本行断言内）。
4. 任务书 ② 引『M-05』的 mock 腿实册于 **M-13** 行（M-05=read_image）；本回合按矩阵在册行执行并在 gap-checklist §3 与终报披露，未挪册未借类别（W8 的类别不冒充口径保持：editor 级 IO_POLICY_UNSUPPORTED 仍无腿、不借 W4 profile 形状）。
5. LIVE 为**行级转态提案值**（transition_rule 原文），终裁归 PR8 正式轮 + 独立 reviewer；G-g 引用不变（OPEN-only）；无『已证/整链/SUPPORTED』措辞。
6. 宿主树 grep `job_start` 为只读操作（pin 检查判据在册，未触碰 host 树任何文件；porcelain=0 前后一致）。

## 重跑
```bash
# 1) kit-local jobs-gateway 编译（未改任何 packages/ 源码，IF-5 零触）
node <repo>/../a5-w8/node_modules/typescript/bin/tsc -p dev/agent-workflow/evidence/alpha5/wiring/we2/tsconfig.lane.json
printf '{"type":"module"}' > node_modules/.a5e2-jobs-build/package.json
# 2) RED（先跑）与 GREEN：
node dev/agent-workflow/evidence/alpha5/wiring/we2/run-we2-live.mjs --mode ungated --port 3183
node dev/agent-workflow/evidence/alpha5/wiring/we2/run-we2-live.mjs --mode gated   --port 3183
# 3) 探针与 runner：
node dev/agent-workflow/evidence/alpha5/pr8/probes/probe-M-13.mjs   # LIVE exit=0
node dev/agent-workflow/evidence/alpha5/pr8/runner/run-pr8-negative.mjs
```

— writer=W-E2（alpha5-wire-tools2，qwen3.8-flash-next）；IF-5 共享面零触碰（每次运行自带判据）；世界用后即删；token 捕获即脱敏。
