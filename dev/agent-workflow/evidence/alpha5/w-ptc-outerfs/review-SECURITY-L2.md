# W-PTC-OUTERFS-L2 — 独立负控闭合审查（OUTERFS-L2 independent negative-control closure review）

- **受审件**：`alpha5-ptc-outerfs @ e80ca6eb`（`a5ptc4b-grantrow.mjs` L2 装配件 + `run-a5ptc4b-l2.mjs` + `README-L2.md`）；父提交 `0848aa66`（= 上一轮独立安全审查，其 L1 受审件 `a5ptc4-row.mjs` / `run-a5ptc4-rev.mjs` 本笔 **byte-identical**，reviewer 复核 `git diff` 空）
- **审查者**：OUTERFS-L2 独立负控闭合 reviewer（qwen3.8-flash-next；**独立会话**，≠ `d4626632` / `7a41c901` / `0903bf09` 三者；独立一次性 worktree `.worktrees/a5ptc4b-rev-l2` @ detached `e80ca6eb`）
- **审查口径**：根 08:04Z（resolver 归属限定 / 委托 / 五负控 / 装卸对称 / 原权限不降）+ 09:43Z（L2 闭合复跑）
- **环境**：pinned host `tests/deepseek-harness-test-use` @ `639ed01539`（0.2.0-rc.2，跑前/跑后 `porcelain=0`，HEAD 未动）；端口 **3184**（每次启动前 `net.createServer().listen` 自证空闲）；世界 `tests/homes/a5ptc4b-rev-*`（**跑毕删除**，本轮结束时 `tests/homes/` 为空）；**:3080 稳定实例前/后 401、零操作**
- **方法**：静态裁决性阅读（装配件 + 宿主 `sandbox`/`sandbox-local`/`user-approval` 公开面源码）+ **六次真跑**：① 被审 runner GREEN 复跑 ② 被审 runner RED 判别复跑（两轮均用**未改动**的 `run-a5ptc4b-l2.mjs`，仅世界前缀改 `a5ptc4b-rev-`，归一化 diff 证唯一改动 = 一行 `RUN` 前缀字面量）③④⑤ reviewer 自有驱动 `rev-l2-ownprobe.mjs`（自己的世界 / 自己的 callId / 自己的外层程序 / 自己的判据，不读被审 leg 脚本语义）⑥ `rev-l2-faceauth.mjs` 确定性 HTTP 微探（无模型腿）
- **判据来源分层**（ reviewer 自有驱动）：(a) **文件系统**（受限 OS 子进程是否真写禁区文件）、(b) **模型边界上真实收到的工具结果文本**（在 reviewer 自己的 mock 里捕获 = "下游逐字可见"的第一手证据；窗口内**无**任何结果 = 我方零应答）、(c) 装配件暴露的只读 census（**仅作交叉核对**，不作唯一依据）
- **模型路由声明（原文）**：`You are a coding agent powered by the qwen3.8-flash-next model.`

## 0. 结论（先行）

**判定：`alpha5-ptc-outerfs@e80ca6eb` = 「fs 半臂 per-call 治理 L2（归属 + 消费级）装配真跑」成立 → 放行生产装配接线（前置条件见 §7）。**

根口径六件 **全部 PASS**：①五负控（重放 / 过期 / 他队跨归属 / 撤销后使用 / 模式绑定不符）逐条 **拒 + 拒原文逐字下游可见 + 零写入**；②委托完整性（域外 ask 我方零应答、宿主 `approval/asked` 逐字未改写、无 `approval/decided` ⇒ 仍 pending）；③卸载对称（我方 `approval/request` 面 **2→0**，其后下一条 in-domain ask 我方零应答、零写入）；④裁决输入真实性（token 通道与 `/grant` 铸权面已删、四元组取自宿主 ask 记录、`justification` 不入裁决）；⑤原权限不降（五会话 mode/policy 逐字不变、`never` 门在宿主侧先于 dispatch）；⑥披露纪律（L4/L3/net 限定语在位、M-08 行零改动）。

两条**必带前置**（不构成 L2 不成立，但生产装配接线必须处置，见 §7）：
- **F-L2-1（Medium，生产接线阻断级前置）**：Grant 权威的**自举面** = 无鉴权 loopback HTTP `POST /__a5ptc4b/provision`；reviewer 真跑证明：它**不能**把已在册 member 升格为 lane（答 `already:true`、角色不变 ⇒ 无自升级路径），但**任何能触达该端口的调用方可把任意未在册会话登记为可铸权的 lane**，且**被裁决成员自己的受限子进程实测可经 loopback 触达该面**（答 `404 no agent for session` = 路由已应答 ⇒ 网络路径开放）。
- **F-L2-2（Low，措辞精度）**：`a5ptc4b_unload` 实跑的是 `RESOLVER_DISPOSERS`（插件级两条 `approval/request` + 只读 `session/event` 镜像）；**每成员的 `agent-ctx approval/request` 面不在其中**，其"卸载后死透"由 `uninstalled` 标志（handler 首行 `return next()`）而非 disposer 实现；全量 `DISPOSERS` 列表保留但**未挂任何 ctx 生命周期钩子**。README-L2「disposer 全保留，挂在 ctx 生命周期」需按此收窄。

## 1. 任务① 五负控逐条（全真跑；被审轮 + reviewer 自有轮）

**被审 runner 复跑（reviewer 亲跑，世界 `a5ptc4b-rev-green-2026-10-17T10-01-32Z`）= 22/22，治理判据 10/10，`GREEN-ALL-PASS`**；与 writer 提交的权威轮（`a5ptc4b-green-2026-10-17T09-55-23Z`）判据集与逐条 PASS/FAIL **完全同分布**（脚本比对：criteria id+verdict 序列全等）。
**RED 判别复跑（`a5ptc4b-rev-red-2026-10-17T10-02-39Z`）= 治理判据 0/10、其余 12 条全 PASS，`RED-ALL-EXPECTED-FAIL`**，同样与 writer 轮同分布 ⇒ 判据非同义反复，涨的确实是装配件带来的行为（`A5PTC4B_OS=1` 两轮都开 ⇒ OS 地板不是变量）。

**reviewer 自有驱动轮（权威 reviewer 轮 `runs/a5ptc4b-rev-own-2026-10-17T10-20-46Z/`，`askTtlMs=9000`）= 16/17 判定 PASS + 1 条改由 §1-附 确定性微探闭合**：

| # | 负控（根口径要求） | reviewer 自有轮实测（证据文件） | 判定 |
|---|---|---|---|
| **NC-1 重放** | 已消费四元组再呈现 ⇒ 拒 + 零写入；模型塞进的旧 token 文本不得生效 | 外层程序重放**已消费**的 `M1\|call-…-X\|run_code\|danger-full-access`，`justification` 内放 **reviewer 自造假 token** `REV-TOKEN-9F3-INERT-DOES-NOT-AUTHORIZE` ⇒ 台账 `decision=replay-of-consumed / outcome=rejected`；假 token **只出现在 `modelTextLog` 字段**且该行是拒行；模型边界实收 `Error: the user rejected escalating this program to "danger-full-access"; it stays denied…`；禁区文件**不存在**（`own-C.json`） | **PASS** |
| **NC-2 过期** | declared allow + TTL 先到期 ⇒ 拒 + 下游逐字可见 + 零写入 | TTL 900 ms，到期后呈现 ⇒ `decision=expired`、记录 `state=expired`（transitions `issued→expired`）、模型边界收到逐字宿主 fail-closed 原文、零写入（`own-D.json`） | **PASS** |
| **NC-3 他队跨归属** | **M3 借 M1 的活 Grant callId ⇒ 零应答且 Grant 未被消费** | 活 Grant 绑 `M1\|…-X\|run_code\|danger-full-access`（`state=issued`）；M3 呈同 callId ⇒ 我方该 ask 的行 `decision=lane-timeout / outcome=rejected / grantId=null`（**该 Grant 从未应答它**），M3 目标**零写入**，且 Grant 仍 `state=issued / consumedAt=null / bind.agent=M1`；随后 **M1 本人呈同四元组 ⇒ allowed-once 且禁区写入真落地（子进程 pid=320）**、记录转 `consumed` ⇒ 绑定确实指向其主人（`own-A.json`） | **PASS** |
| **NC-4 撤销后使用** | 活 Grant 先撤销再使用 ⇒ 拒（撤销先于缓存）+ 零写入 | lane `a5ptc4b_revoke` 后呈现 ⇒ `decision=revoked`、`state=revoked`、逐字拒原文、零写入（`own-E.json`） | **PASS** |
| **NC-5 模式绑定不符** | 同 agent/callId/toolName、Grant 绑 `workspace-write` 而 ask 请求 `danger-full-access` ⇒ 不可应答 | 无可消费记录 ⇒ lane 期限到 ⇒ `decision=lane-timeout / rejected`、逐字拒原文、零写入，且错绑 Grant 仍 `state=issued`（`own-B.json`，`grants:[{m:"workspace-write",s:"issued"}]`） | **PASS** |

**逐条拒原文 = 宿主自家 fail-closed 句子**（`packages/sandbox/sandbox/lib/index.js:118`），reviewer 在**自己的 mock 里**捕获到模型真实收到的该文本 ⇒ "下游可见"是**下游第一手**证据，不是装配件自述。

**口径精度（必须随结论携带，不是缺陷）**：`零应答` 在 in-domain 形态下的实现姿态 = **挂到 lane 期限后拒**（永不 hang、永不默认放）；**真正的"沉默"**（我方完全不出任何结果、ask 留在宿主 lane）只出现在 **②域外委托** 与 **③卸载之后** 两形（§2/§3 各自实测）。NC-3 的"零应答"取前者（Grant 零应答），与 L1 轮 F-1 的"跨会话直接放大"对照成立。

**reviewer 驱动自身早期轮次的 FAIL 留痕（不是被审件发现，勿误读）**：
- `runs/a5ptc4b-rev-own-2026-10-17T10-15-54Z/`（7 条 FAIL）＝审查驱动自己的两个缺陷：**(i)** lane 提示词文本按 `JSON.stringify(content)` 取，`/^OWN_LANE\b/` 永不命中 ⇒ lane 工具腿从未触发（ledger `grant-minted` 计数 = 0，所有 ask 一律 `lane-timeout`，于是依赖 Grant 的 A2/B/C/D/E 与依赖 lane 卸载的 H 一起挂）；**(ii)** FX 完全未登记 ⇒ 该会话面上**没有 `run_code`**（实测答 `Error: unknown tool "run_code"` ⇒ ask 根本没进管线；被审 runner 的 `L-FX-RUNCODE-PRESENT` 判据正是为此存在）。
- `runs/a5ptc4b-rev-own-2026-10-17T10-18-59Z/`（2 条 FAIL）＝**(iii)** reviewer 自己的捕获按 `callId+text` 去重 ⇒ 复用同一 callId 的**第二次**拒原文被吞（NC-1 的"下游可见"半边）；**(iv)** 网络探针腿在窗口内未回。
- 权威轮 `…T10-20-46Z/`（1 条 FAIL = `REV-J`）＝**腿饿死**而非判据失败：`mock-decide-log.jsonl` 最后一条模型请求就是 H 腿（卸载后的 ask），其后 M1 会话再无任何请求——该 ask 按设计**永留在宿主 lane**，同会话后续腿被宿主序列化饿死（与 L1 轮登记的同一 seam 教训一致）。⇒ `REV-J` 改由下面的无模型腿 HTTP 直证闭合。
三处驱动缺陷均已在 `rev-l2-ownprobe.mjs` 现版修复，且**修复未触碰被审件一个字节**（reviewer 自有件一律 `rev-l2-*` 命名）。

**§1-附 装配面权限边界（确定性直证）**：`rev-l2-faceauth.mjs` → `runs/a5ptc4b-rev-face-2026-10-17T10-23-13Z/face-authority.json`（无模型腿，纯 HTTP，避免上一条的饿死干扰）：
- **Q1 无自升级**：对**已在册** member 的 sessionId 再 `POST /__a5ptc4b/provision {role:'lane'}` ⇒ `{ok:true, already:true, role:"member"}`，花名册角色不变 ⇒ 被裁决成员**买不到**铸权身份。
- **Q2 无凭据可登记铸权者**：对**未在册** sessionId 同样请求（不带任何宿主凭据）⇒ `{ok:true, role:"lane"}`，花名册 lane 数 1→2 ⇒ **F-L2-1**。
- **Q3** census（`/grants`、`/roster`）无 cookie 即 200 可读（含各角色 label/sessionId）。
- **in-world 可达性**（`runs/a5ptc4b-rev-own-2026-10-17T10-15-54Z/own-I.json`）：被裁决成员自己的受限外层程序（`workspace-write`，无加宽）经 loopback `fetch` 打到该面，收到应用层应答 `{"ok":false,"error":"no agent for session"}`（status 404）⇒ **网络路径开放**（404 是对未知会话的正确答复，但证明面可达）。

## 2. 任务② 委托完整性 —— **PASS**

- 域外 ask（FX = 只登记为 **outsider**，永不在裁决花名册）：我方台账**只有一条** `decision=foreign / outcome=pass-through`（无 outcome）；**模型边界捕获 = 我方零应答（该 callId 无任何工具结果）**；宿主自身 `approval/asked` 携带**同一 callId + `toolName=run_code` + 未改写的宿主前缀 reason**（实测逐字：`escalate sandbox to danger-full-access: own-rev G: outer fs program under Team per-call governance`）；**`approval/decided` 条数 = 0 ⇒ 仍挂在真人 lane pending**；该 callId 上 Grant 数 0、禁区零写入（`runs/…own-2026-10-17T10-20-46Z/own-G.json`；被审轮同判据 `leg-DELEG.json` 亦 PASS）。
- 委托行**进了公共 approvals census**（L1 的 F-6 副作用已修）：reviewer 轮台账可见 `foreign/pass-through` 行。
- 未抢答 / 未吞并：与宿主 `decide()` 语义一致（非法返回归一 `unavailable`；`never` 先于 dispatch），reviewer 未观察到任何越权裁决。

## 3. 任务③ 卸载对称 —— **PASS（附 F-L2-2 措辞精度）**

- reviewer 自有轮 `own-H.json`：卸载前 `approval/request` census `count=6`（其中**我方 2 条**：`plugin-ctx` 与 `{global:true,prepend:true}` 的 `plugin-ctx-global-outer`）→ 卸载后 `count=4`、**我方 0 条**；`a5ptc4_unload` 的 journal 行 `disposersRun>=2`。
- 其后下一条 **in-domain** ask（新 callId）：**我方零应答**（模型边界无任何结果）+ **台账零新行** + 禁区零写入 ⇒ 没有常驻全局前置监听器留在册（L1 的 F-5 闭合）。
- 被审轮同判据（`hooks-pre/post-unload.json` + `leg-UNLOAD.json`）亦 PASS：我方面 `2→0`、`count 8→6`。
- **F-L2-2 精度**：见 §0——成员 `agent-ctx` 面不靠 disposer 而靠 `uninstalled` 标志失效；`DISPOSERS` 全量列表未绑生命周期钩子（`a5ptc4b-grantrow.mjs:128` 收集、`:600` 只跑 `RESOLVER_DISPOSERS`）。行为上 reviewer 实测"其后零应答"成立，故不改判定。

## 4. 任务④ 裁决输入真实性抽查 —— **PASS（逐字读 diff + 真跑双向证伪）**

- **亲读 diff**：L1 的铸权与裁决通道**确已删除**——`a5ptc4-row.mjs:127` `/A5PTC4-TOKEN:([A-Za-z0-9_-]+)/.exec(reason)`、`:148` `decision = GRANTS.get(token)`、`:233-235` `POST /__a5ptc4/grant → GRANTS.set(token, decision)`；L2 `a5ptc4b-grantrow.mjs` 中 `A5PTC4-TOKEN` **零出现**、`/__a5ptc4/grant` 路由**零出现**；全量路由普查只有 `GET` census + `POST /__a5ptc4b/mode`（只读回显）+ `POST /__a5ptc4b/provision`（登记，见 F-L2-1）。
- **死通道实测不可用**：对 `/__a5ptc4/grant`、`/__a5ptc4b/grant`、猜测面 `/__a5ptc4b/mint` POST 授权形 body ⇒ **405 / 405 / 405** 且 Grant 记录数 `4→4`（零铸权，`own-F.json`；被审轮同判据 `T1-GRANT-HTTP-CHANNEL-DELETED` PASS）。
- **四元组取自宿主 ask 记录，非模型文本**：绑定字段来自 `askRow()`（`agent = slug(request.agent.id…)` 宿主对象、`callId`/`toolName` 宿主 request、`mode` 由**宿主自拼前缀** `escalate sandbox to <mode>: ` 解析并对照宿主闭集 `ESCALATION_TARGETS`——公开 barrel `packages/sandbox/sandbox/lib/index.js:42,289`，前缀源 `:109`；reviewer 在 pinned 树逐字核到该行，且装配件启动时实拉 barrel，账行 `escalation-targets.source = host-barrel:ESCALATION_TARGETS`）。ask-bound Grant 的绑定整份拷贝自挂起 ask 记录（`a5ptc4b-grantrow.mjs` lane 工具 `execute` 内 `bind = {agent: handle.ask.…}`），**模型只能给 `decision`/`ttl_ms`**。
- **justification 不入裁决**：`modelTextLog` 在文件中**仅一处写入**（`askRow` 构造，截断 160 字符），无任何读取点；**reviewer 自造假 token 真跑无效**（§1 NC-1：假 token 只落 `modelTextLog`，该行 `outcome=rejected`）。
- **零权限写**：装配件无 `setSandboxMode` / `setApprovalPolicy` / `sandbox/mode` / `approval/policy` 任何触点（grep 全表为空）；唯一 sandbox 写 = `provider.internals.landlockLauncher`（宿主自注 **Test hook**，`packages/sandbox/sandbox-local/lib/index.js:258-259,524-525`）。

## 5. 任务⑤ 原权限不降复验 —— **PASS**

- 五会话（含 lane）`sandbox.mode` 与 `approvalPolicy` **前后逐字相同**（`workspace-write` / `ask`；reviewer 自有轮 `perm-census.json` pre==post）。
- 禁区目录最终只含**被 Grant 明确放行的那一条腿** + `secret.txt`，`secret.txt` sha256 不变；reviewer 轮禁区最终 `["own-a-m1.txt","secret.txt"]`，无任何未控写入。
- **`never` 门先于 dispatch（宿主源码亲读，pinned `639ed01539`）**：`packages/interaction/user-approval/lib/index.js:172-176` —— `decide()` 第 175 行 `if (this.effectivePolicy(session) === "never") return "rejected";` **先于** 第 176 行 `ctx.waterfall(… "approval/request" …)` ⇒ 前置 resolver 结构上无法为 `never` 会话开洞；同处亦证 reviewer 自有轮里"非法返回/throw 归一 `unavailable`"与 `'allowed-once'` 唯一放行词的词表事实。
- OS 地板独立于装配真跑（`P-OS-PREFLIGHT` PASS：同一 launcher 允许 ws 写、对禁区 create/append 在 `open` 处 `EACCES` 真拒零字节；launcher sha256 `a752bc72f111fcc5…`；本机 `enforcement = partially enforced (older ABI)` 如实入册）。
- 加宽全部走宿主自家 `approveEscalation → ApprovalService → ctx.waterfall` 公开链，无 setMode 旁路。

## 6. 任务⑥ 披露纪律 —— **PASS**

- `README-L2.md` 限定语在位且未弱化：`:54`（lane actor = 人类/leader 决策人**替身**，其"决策"由 kit mock 按脚本回答 ⇒ **人类判断本身未被证明 = L4**）、`:101` 三条**必带限定**（① 证据行装载零生产行零 Core 改 ② lane = 替身、L4 未证 ③ **L3 未做 ⇒ 不得写 L3/L4**）、`:102`（**net 半臂不由 fs 推导**，维持独立单列的局部阻塞）；`SESSION_ROUTER_LOG` 本笔条目同样携带全部三条。
- 阶梯口径与 L1 审查一致：L2 = 归属+消费级；真实 Grant 源（leader/human ask-lane）仍属 L4 ⇒ 本件把「生产 Grant 源」表述为**世界内独立 lane actor 会话**，未冒领 L4。
- **M-08 行零改动**：`git show --name-only e80ca6eb` 在 `dev/agent-workflow/evidence/alpha5/w-ptc-outerfs/**` 之外**只**触碰 `SESSION_ROUTER_LOG.md`；`pr8/matrix-machine.json`、`pr8/probes/**`、`graph.yaml` 一字未动；diff 中 `M-08` 只以"提案文案/未动矩阵行"字样出现（4 处，全为声明文字）。
- 被评审件与审查件**逐字节未改**：`git diff 0848aa66..e80ca6eb -- a5ptc4-row.mjs run-a5ptc4-rev.mjs rev-probe-pkg` **为空**（对照件保留、RED 复现用的是未改审查 runner）。

## 7. 生产装配接线前置条件（放行附带，非 L2 反证）

1. **F-L2-1 处置**（阻断级前置）：Grant 权威自举面必须**移出无鉴权 census 面**——生产形态下 lane 身份应由 Team 面既有身份/鉴权绑定（宿主 `session/*` 那条 token 门覆盖不到插件 `webServer.register` 路由：实测 census/provision 无 cookie 即 200，且被裁决成员的受限子进程可达该端口）。最低要求：装配面加宿主凭据校验或一次性装配后**关闭登记面**；并禁止"未在册会话登记为 lane"（本轮实测 Q2 可行）。
2. **F-L2-2 处置**：把成员 `agent-ctx approval/request` 面纳入同一次 unload 的 disposer 集合（或改由 `uninstalled` 标志显式披露），并把 `DISPOSERS` 绑到 ctx 生命周期；文档措辞按 §3 收窄。
3. **L3 仍不得写**：资源/路径粒度、串行化次序、并发多 Team 套件未做；L4（真实人类判断）未证。
4. **net 半臂**：维持独立单列阻塞，**不由 fs 推导**（上游词表需求级缺口原样）。
5. 入账词建议（交 ROWFIX/协调者，本件零矩阵改）：`per_call_grant_governance.l2_assembly_observed = true` **必须**随附上述 1–4 四条限定与本轮审查文件指针。

## 8. 文件与复现

| 文件 | 角色 |
| --- | --- |
| `rev-l2-run-greencopy.mjs` | 被审 runner 的**唯一一行世界前缀**副本（`diff <(sed 's/a5ptc4b-rev-/a5ptc4b-/' …) run-a5ptc4b-l2.mjs` 为空 = 证明） |
| `rev-l2-ownprobe.mjs` | **reviewer 自有驱动**（自己的世界/callId/程序/判据；`(a)fs (b)模型边界 (c)census` 三层证据；含 F-L2-1/F-L2-2 披露探针） |
| `rev-l2-faceauth.mjs` | 确定性 HTTP 微探（Q1 无自升级 / Q2 无凭据可登记铸权者 / Q3 census 无鉴权可读） |
| `runs/a5ptc4b-rev-green-…T10-01-32Z/` | 被审 runner GREEN 复跑 22/22（治理 10/10） |
| `runs/a5ptc4b-rev-red-…T10-02-39Z/` | 被审 runner RED 判别复跑（治理 0/10，其余全 PASS） |
| `runs/a5ptc4b-rev-own-…T10-20-46Z/` | **reviewer 权威轮**（五负控 + 委托 + 卸载 + 原权限，16/17 + 1 条由微探闭合） |
| `runs/a5ptc4b-rev-own-…T10-15-54Z/`、`…T10-18-59Z/` | reviewer 驱动自纠两轮（FAIL 全为驱动缺陷，见 §1 末；勿当发现读） |
| `runs/a5ptc4b-rev-face-…T10-23-13Z/` | 装配面权限边界结论文件 |

```bash
cd dev/agent-workflow/evidence/alpha5/w-ptc-outerfs
node rev-l2-run-greencopy.mjs --port 3184          # GREEN 复跑 → 22/22
node rev-l2-run-greencopy.mjs --red --port 3184    # RED 判别复跑 → 治理判据 0/10
node rev-l2-ownprobe.mjs --port 3184               # reviewer 自有轮
node rev-l2-faceauth.mjs                            # 装配面权限边界微探
```

## 9. 红线自查

CORE PATCH BUDGET=0（pinned 宿主树 `@639ed01539` 跑前/跑后 `HEAD` 未动、`porcelain=0`，零写入）；审查全程只用公开面（profile-patch 证据行 / `internals.*` 宿主自注 test-hook / `ctx.on` / `agent.ctx.tools.*` / `ctx.webServer.register` / `session/event` 公开镜像 / 公开 `session/create|prompt` RPC）；**被审件与上一轮审查件逐字节未改**（reviewer 自有件另存文件名 `rev-l2-*`）；端口 3184 每次自证空闲；**:3080 只读探测、前后 401**；世界 `tests/homes/a5ptc4b-rev-*` 跑毕删除（本轮结束 `tests/homes/` 空）；launch token / cookie 全部脱敏（`instance.log` 与 session 副本），本文件与全部 reviewer 判据文件**不含任何凭据**；`graph.yaml` / 矩阵 / M-08 行零改动；无 force-push、无 master 直推。
