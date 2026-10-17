# W-PTC-OUTERFS-L2 收口（F-L2-1 + F-L2-2）独立安全审查 — review-SECURITY-L2CLOSE

- **受审件**：`alpha5-ptc-outerfs @ 780ffbee`（收口件 `a5ptc4c-grantrow.mjs` sha256 `10a2ade891a615dd…` + `run-a5ptc4c-{chainred,l2close,devkit}.mjs` + `a5ptc4c-devprovision-pkg/` + `README-L2CLOSE.md`）；base `303e1195`；被评审的修复前 L2 件 `a5ptc4b-grantrow.mjs` sha256 `6579202bf3956946…` = **我对 `git show e80ca6eb` blob 亲自比对相同**。
- **审查者**：OUTERFS-L2 收口独立 reviewer（qwen3.8-flash-next；**独立会话**，≠ `e7b656aa` / `edd16e49` / `d4626632` / `0903bf09`）；worktree `.worktrees/a5-ptc-outerfs` @ `780ffbee`（一次性）；pinned host `tests/deepseek-harness-test-use` @ `639ed01539`（每轮跑前/跑后 `porcelain=0`）；端口 **3184**（每轮 `net.createServer().listen` 自证空闲）；世界 `tests/homes/a5ptc4d-rev-*`（**审查毕删除**）；**:3080 前/后 401、零操作**。
- **方法**：① 被审 runner 三件（chainred / l2close GREEN / l2close RED 判别 / devkit）= **我的一行世界前缀副本**（`diff <(sed 's/a5ptc4d-rev-/a5ptc4c-/' rev-l2c-X.mjs) run-a5ptc4c-X.mjs` 全空 = 逐字节等价，仅世界名不同）；② **reviewer 自有确定性探针** `rev-l2c-probe.mjs`（我自己的世界 / 我自己的 0600 通道 / 我自己的 lane+attacker 会话 / 我自己的 confined 子进程 / 我自己的 14 条 POST 形状，零模型腿）；③ 装配件与 devkit 行**源码亲读** + 路由 census 静态裁决。
- **模型路由声明（原文）**：`You are a coding agent powered by the qwen3.8-flash-next model.`

## 0. 结论（先行）

**判定：`alpha5-ptc-outerfs@780ffbee` = F-L2 收口成立 ⇒「fs 半臂 per-call 治理 L2」的 F-L2-1 / F-L2-2 两条前置均已处置，生产装配接线前置满足（fs 半臂 L2 装配级）。**

- 修复前攻击链：**我亲自端到端打通**（10/10 = `RED-CHAIN-COMPLETE`），历史 RED 非虚。
- 修复后同一链**每一步我亲验拒**：登记面八路径 **405** + 路由 census `mutating=0`；成员 confined 子进程对装配器 0600 通道文件 **EACCES**（我自己拥有的子进程第一手）；未登记会话上铸权工具不存在（宿主 `ToolNotFoundError` 在**模型边界**一手捕获）；消费腿 `lane-timeout` **无 grantId**、RED 轮真写过的 `l-chain.txt` 此轮不存在。
- 登记权威唯一性：**装配器私有生命周期通道 = 唯一登记入口**（亲读源码：`openSync(path,'r')` 只读轮询 + 一次性 nonce + seal + already-rostered 永不升格）；devkit provision = **显式 mount ∧ `A5PTC4C_DEVKIT=1` 双门默认关**、纯 ingress 汇入同一通道、dev 形态也铸不了 lane（403）；生产 patch 清单**只有两行**（收口件 + 独立探针），devkit 文件不在其中且收口件零 import。
- 诚实委托路径不受扰（ask-bound `allowed-once` 照常落地）；五负控 + 委托 + 并发 + T-5 零回归；F-L2-2 disposer 分层（真 disposer + 重装恰一次 + 残留只读披露）成立。
- **三条非阻断精度项**（不影响判定，见 §7）：runner 对 NC-3「写落地」做**单次** existsSync 采样（我这一轮踩到，文件 58ms 后落盘，我已盘上亲验）；census 面对 POST 因宿主不做方法区分而返回 200 只读体（**零改变**，但「一切 POST 非 2xx」的措辞应按「一切登记/铸权形路径非 2xx」精确化）；重装账行 `faces` 字段把已 dispose 的陈旧条目计入。

## 1. 任务① 修复前攻击链 —— 我亲跑 = **10/10 `RED-CHAIN-COMPLETE`**（危险端到端实证）

轮：`runs/a5ptc4d-rev-chainred-2026-10-17T15-32-23Z/`（`node rev-l2c-chainred.mjs --port 3184`；被审件**原样**，`P-REVIEWED-ROW-UNMODIFIED` sha 对齐 `e80ca6eb` blob）。

| 步 | 我亲眼看到的观测（observed 原文摘要） | 判定 |
| --- | --- | --- |
| `REDCHAIN-0` 零 lane 基线 | M1 加宽 ask：`decision=lane-timeout / outcome=rejected`，`written=false`（callId `…-HIJACK`） | 后面的写只可能来自攻击 |
| `REDCHAIN-1` 未鉴权登记铸权 lane | M1 **自家 confined workspace-write 子进程**（pid 182，无凭据、无升级、纯 loopback）`POST /__a5ptc4b/provision` ⇒ **`200 {"ok":true,"role":"lane"}`**；roster 出现 ATK 且带 `["a5ptc4b_grant","a5ptc4b_revoke","a5ptc4b_unload"]` | **步 1 成立（危险）** |
| `REDCHAIN-2` 铸出伪造 Grant | 攻击者驱动**自己会话** ATK 的 lane 工具 ⇒ `grantId=g1 via=team-lane-tool source=declared state=issued`，绑定 = 受害者 M1 的 `agent\|callId\|run_code\|danger-full-access` | **步 2 成立（危险）** |
| `REDCHAIN-3` 消费 | `decision=lane-allow outcome=allowed-once` 带伪造 `grantId`；**禁区文件真实落盘**：我亲见 `…-forb/l-hijack.txt`（22B，sha256 `57e4832b…`），同目录 `secret.txt` 未被碰 | **步 3 成立（真 confined-OS 越权）** |

⇒ 历史「RED-CHAIN-COMPLETE」**不是纸面推断**：全链无诚实 lane、无被盗凭据，纯靠未鉴权登记面 + declared 自由文本绑定。

## 2. 任务① 修复后同链 —— 每一步我亲验拒

**GREEN 权威轮（被审 runner 的前缀副本，我亲跑）** `runs/a5ptc4d-rev-green-2026-10-17T15-33-24Z/` = **31/32（治理判据 15/15）**；唯一 FAIL 是 §7 的 runner 采样精度，**不是任何拒点**。
**reviewer 自有探针轮（我亲跑）** `rev-l2c-probe.mjs` → `runs/a5ptc4d-rev-probe-2026-10-17T15-50-12Z/`（终态 r5）= **14/14**。

| 攻击步 | 修复后我亲验的拒 | 一手证据 |
| --- | --- | --- |
| 登记/铸权 HTTP 面 | 八路径 POST 授权/登记/铸权形 body：`{"/__a5ptc4b/provision":405,"/__a5ptc4b/grant":405,"/__a5ptc4c/provision":405,"/__a5ptc4c/grant":405,"/__a5ptc4c/revoke":405,"/__a5ptc4c/register":405,"/__a5ptc4cdev/provision":405,"/__a5ptc4cdev/grant":405}`，**roster 5→5 / grants 0→0**，路由 census `mutating=0`（`F1-NO-HTTP-REGISTRATION-MINT` PASS）。我自己的探针把形状加到 **14 条**（另加 `/__a5ptc4c/seal`、`/unload`、`/uninstall` 405、`/mode` 400、census 两径 200 只读体）⇒ **roster 2→2 / grants 0→0 / 存活 ADJ 面 4→4 / 零 teardown 账行** | GREEN `F1` observed + 探针 `REV-HTTP-DEAD-MINT` |
| 世界内攻击（成员自家 confined 子进程） | GREEN 轮被审件子进程：`{oldFace:405,newFace:405,devFace:405,mint:405, ipcWrite:"EACCES", forbControl:"EACCES", rosterStatus:200}` + `rosterDelta=0`、ATK 不在册。**我自己拥有的** confined 子进程同判据：`{"ipcWrite":"EACCES","forb":"EACCES","ws":"ok","statuses":{五径全 405},"rosterStatus":200}` | GREEN `chain-green-stepA.json` + 探针 `REV-CONFINED-EACCES` |
| 铸权工具 | 攻击者驱动自己会话 ATK 调 `a5ptc4c_grant` ⇒ **模型边界**收到 `content:[{text:"Error: unknown tool \"a5ptc4c_grant\""}], isError:true, error:{name:"ToolNotFoundError",code:"UNKNOWN_TOOL"}`（session 日志一手行），grants Δ=0、无 chain Grant | GREEN `chain-green-stepB.json`（`F1-ATK-MINT-DEAD` PASS） |
| 消费腿 | M1 呈现同一目标四元组：`decision=lane-timeout / outcome=rejected / heldMs=10000`，**行内无 grantId 字段**；`l-chain.txt` 不存在（RED 轮写过同一文件）；我在保留世界上直接确认禁区只有被授权腿的文件 | GREEN `chain-green-stepC.json` + 禁区目录 listing |
| 登记语义（一次性/升格/封档） | GREEN：`refused=["replay-or-missing-nonce","already-rostered","sealed"] sealed=true atkOnRoster=false`，5 条 roster 全 `registeredVia=trusted-lifecycle-channel`。**我的探针**同判据独立复现：ledgerRefusals 同上三条 + seal 后即使由**非 confined 同 uid 进程**写入的合规记录仍被拒（`sealedRefusals=2`）、roster 零移动 | GREEN `registration-channel.json` + 探针 `REV-CHANNEL-AUTHORITY` / `REV-BOUNDARY-DISCLOSED` |

## 3. 任务② 登记权威唯一性 + devkit dev-only 双门

- **唯一登记入口（源码亲读，非推断）**：`a5ptc4c-grantrow.mjs` 的登记只来自 `handleLifecycleRecord()`，其字节来源是 `pumpLifecycleChannel()` 的 `openSync(IPC_PATH,'r')` + 增量 `readSync`（**插件只读、永不写**；账行自述「assembler is the only writer」，并由我探针 `REV-NO-PLUGIN-WRITE` 用**文件记录数 == 我自己追加数**反证）；`nonce` 一次性、`seal` 关档、`already rostered` **永不升格**；生命周期 op（`install`/`uninstall-all`）同样只走该通道。通道文件由装配器在 **host 启动之前**创建、`mode 0600`（`F1-CHANNEL-0600` + 我的 `REV-CHANNEL-0600` 两轮独立确认）。
- **无任何 HTTP 登记/铸权面**：路由 census `mutating=0`、14 条注册路径全在披露的只读 census 集合内（我探针 `REV-ROUTES-STATIC`：`mutating=0 outsideSet=[] n=14`）；静态判据 `T1-NO-TOKEN-CHANNEL-AND-NO-MUTATING-ROUTE-IN-ARTIFACT` PASS（L1 token 字面量只在对照件里、实测惰性）。
- **devkit = dev-only 双门默认关（我亲验）**：`a5ptc4c-devprovision-pkg/a5ptc4c-devprovision.mjs` 三重独立门——(1) 生产 `cordis.patch.yml` 不引用它（`F1-DEVKIT-ABSENT-BY-DEFAULT` PASS：patch 文本无 `devprovision`/`a5ptc4cdev`）；(2) 挂上但无 `A5PTC4C_DEVKIT=1` ⇒ `apply()` **注册零面**（我跑的 dev 形态轮 `DEVKIT-OFF-WITHOUT-ENV`：`health=404 provision=405`）；(3) 即便显式开启也 `canRegisterLane:false`——`role:lane` **403** 且零登记记录（`DEVKIT-LANE-REFUSED`），成员/outsider 排队也只是**追加进同一条通道**（`DEVKIT-SINGLE-SINK`：`registeredVia=trusted-lifecycle-channel`）⇒ 宿主内**不存在第二条登记路径**。清单级核对（我轮 `devkit-manifest-diff.json`）：生产 manifest 两行 `[a5ptc4c-grantrow, a5ptc4b-downstream-probe]`、`devkitFile: ABSENT`；dev 形态三行 + `envGate=A5PTC4C_DEVKIT=1`；收口件源码零 devkit import。**我这一轮 devkit 轮 = 7/7 `DEV-SHAPE-PROVEN`。**
- **诚实委托路径不受扰**：全部拒完之后，新鲜 M3 ask 由经通道登记的诚实 lane 以 ask-bound Grant 答 `allowed-once` 且**写落地**（`F1-DELEGATION-PATH-UNDISTURBED` PASS）；域外 FX 仅 `decision=foreign / outcome=pass-through`、宿主 `approval/asked` reason 逐字未改写、无 `approval/decided`（仍挂真人 lane）。

## 4. 任务③ 五负控 + 委托 + 并发 + T-5 零回归（我这一轮逐条）

| 判据 id（与被审轮同 id） | 我轮实测 | 判定 |
| --- | --- | --- |
| `ANCHOR-TEAM-GRANT-ALLOWED-ONCE` | ask-bound Grant → `allowed-once`，confined 外层程序真实写禁区，Grant 转 `consumed` | PASS |
| `NEG1-REPLAY-REFUSED` | 同四元组二次呈现 ⇒ `replay-of-consumed / rejected`；死 L1 token 文本只进 `modelTextLog` | PASS |
| `NEG2-EXPIRED-REFUSED-DOWNSTREAM-VISIBLE` | 1200 ms TTL 先到期 ⇒ `expired / rejected` + `state=expired`（裁决时惰性判定） | PASS |
| `NEG3`（TEAM BIND）第一半 | M3 借 M1 活 Grant callId ⇒ 我方**零应答**（`lane-timeout`、无 grantId）、Grant 仍 `issued/consumedAt=null`、M3 零写入 | PASS |
| `NEG3` 第二半 | M1 本人呈现 ⇒ Grant `consumed`（写于裁决后 58ms 落盘，我盘上亲验）| **runner 采样缺陷**，治理语义成立（§7） |
| `NEG4-REVOKED-BEFORE-USE-REFUSED` | 先撤后用 ⇒ `revoked / rejected`（GRANTS 先查，无缓存可答） | PASS |
| `NEG5-MODE-BIND-MISMATCH-REFUSED` | 错绑 mode ⇒ 无可消费记录 ⇒ `lane-timeout`，错绑 Grant 仍 `issued` | PASS |
| `CONCURRENCY-ISOLATION` | M1/M2 同时 pending，各由自己 seq 判定（`lane-allow@pending` vs `lane-reject@pending`），互不借用 | PASS |
| `DELEG-ZERO-ANSWER-VERBATIM-DOWNSTREAM` | 见 §3 末（零应答 + 逐字下行 + 仍 pending） | PASS |
| `T5-UNLOAD-SYMMETRIC-AND-DEAD` | lane 自家 `a5ptc4c_unload` ⇒ 我方 approval/request 面归零，其后 in-domain ask 我方**零应答 / 零账行 / 零写入** | PASS |
| `GOV-ADJUDICATION-INPUT-IS-TEAM-GRANT-ONLY` | `grants=9 via=["team-lane-tool"] issuer=[单一 lane]`、`answeredRows=12 unexplained=[]`、`rosterVia=["trusted-lifecycle-channel"]` | PASS |
| `PERM-ORIGINAL-NOT-LOWERED-NOT-WIDENED` | 六会话 `sandbox.mode/approvalPolicy` 前后逐字 `workspace-write/ask`；`refusedButWritten=[]`；`secret.txt` 不变 | PASS |
| `RED 判别轮`（`A5PTC4C_ASSEMBLE=0`） | 我亲跑 = **16/32，治理集 0/15 全 FAIL，其余 16 条安全姿态/卫生判据全 PASS** ⇒ 判据不同义反复，涨的确实是治理装配带来的行为 | `verdict=EXPECTED` |

## 5. 任务④ F-L2-2 disposer 分层与生命周期（我亲验）

- **分层真存在**：`ADJ`（两条插件 `approval/request` + 只读 `session/event` 镜像 + **每条成员自家 agent-ctx 审批面**，`rebindMemberFaces()` 把成员面 `disposer(...)` 进 ADJ 并带 census tag）与 `LIFE`（witness/guard/presentAs/around-seam + lane 三工具）。对照件 `a5ptc4b-grantrow.mjs:511` 成员面只进 `DISPOSERS`（`:600` 只跑 `RESOLVER_DISPOSERS`，静音靠 `uninstalled` 旗标 = 原 F-L2-2）——**收窄措辞与代码实情一致**，收口件把它变成真 disposer。
- **unload 烧成员面**：我轮 `leg-UNLOAD.json` 卸载前 hook census `count=7`，其中三条 tag `member-approval-ctx:<label>`；`resolver-unloaded` 账行 `memberFaces>=3`；其后幽灵 ask 我方零应答/零账行/零写入（`F2-UNLOAD-BURNS-MEMBER-FACES` PASS）。
- **uninstall-all 双层清零 + 残留只披露**：`residue-disclosure.json` 里 `tierAdjudication` 全部 `done:true`（含 6 条 member/plugin 面两轮）与 `tierLife` 全 `done:true`；残留清单只三条**只读**面（census + 已 seal 通道监听器 + 内存审计账本），且对全部存活 census 面 POST 授权/登记形 body **零改变**（我探针独立版：`liveAdjFaces 4→4`、`uninstallRows=0`；且**没有任何 HTTP 面能触发 teardown**：`REV-UNINSTALL-HTTP-DEAD`）。
- **重装恰一次**：我轮 `assembly-ledger.jsonl` 序列 = `resolver-unloaded{disposersRun=6, memberFaces=3}` → `lifecycle-install{liveFaces=6}` → `lifecycle-uninstall-all{adjudicationDisposed=6, lifeDisposed=19, memberFaces=3}` → `lifecycle-install{liveFaces=6}`；两次重装后的 **live 面数都恰等于装态数 6**（hook census `count=7`＝宿主自家 1 + 我方插件面 2 + 镜像 1 + 成员面 3，**不翻倍**），下一条 ask **恰一条判定行**、无 already-decided 重复（`F2-REINSTALL-EXACTLY-ONCE` PASS）。源码里另有「faces>0 ⇒ no-op」的**双装守卫**（我亲读 `installAdjudicationFaces()`，我这一轮未触发该分支，故不作实测声称）；重装账行的 `faces: 9` 字段把已 dispose 的陈旧 ADJ 条目也计入（存活数看 `liveFaces`），属披露精度项，见 §7-3。

## 6. 任务⑤ 披露纪律 —— **PASS**

- `review-SECURITY-L2.md`、`review-SECURITY.md`、`pr8/matrix-machine.json`、`pr8/probes/**`、`graph.yaml`：`git diff 303e1195..780ffbee` **全空**；`git diff --name-only e80ca6eb..780ffbee` 对 graph.yaml/pr8 **无输出** ⇒ 矩阵行与编排态零改动。
- `README-L2.md` 收窄两处**属实**（逐字对代码）：T-5 行「插件级 disposer + 成员面当时仅旗标静音」对 `a5ptc4b-grantrow.mjs:511/:600`；「provision 面未鉴权 loopback 可把任意会话升成铸权 lane」对 §1 我的端到端复现。文件表行同步收窄（同源）。
- 限定语在位且未弱化：`README-L2.md:12/:54/:101/:102`（net 半臂不由 fs 推导、lane = 决策人替身 ⇒ 人类判断 L4 未证、L3 未做 ⇒ 不得写 L3/L4）；`README-L2CLOSE.md:33/:61`（威胁模型边界 = 成员会话 + 其 confined 子进程；同 uid 非 confined 宿主级进程属边界外；L3/L4/net 不可入账）。**我的探针独立确认这条边界诚实**：`REV-BOUNDARY-DISCLOSED` —— 同 uid 非 confined 进程**能**写通道文件（装配器功率级），但 seal 之后该记录仍被拒、roster 零移动 ⇒ 权威不随字节走。
- `SESSION_ROUTER_LOG` 本笔条目的每条声称（RED 10/10、GREEN 32/32 治理 15/15、RED 判别 0/15、devkit 7/7、八路径 405、EACCES、`ToolNotFoundError`、中间失败轮全留档）我都独立复现或读到一手证据，未见夸大。

## 7. 偏差与精度项（不遮丑；两条均**不改变判定**）

1. **runner 采样精度（我这一轮唯一 FAIL）**：`run-a5ptc4c-l2close.mjs:673` 在裁决行出现的那一刻**单次** `existsSync(FORB_TARGET('xteam'))`，无轮询；我轮裁决 `15:34:07.302`、文件 mtime `15:34:07.360`（**+58 ms**）⇒ 判据 `written=false`，但 `leg-XTEAMUSE.json` 记 `state=consumed`，且我**在保留世界上亲见 `l-xteam.txt` 内容 `A5PTC4C-BODY-RAN-1114`**。写的是被 Grant 明确授权的那一条腿、语义全成立 ⇒ **runner 缺陷（作者权威轮未踩到此竞态）**。修法一行：`pollUntil` 该文件。
2. **census 面对 POST 返回 200 只读体**（宿主 seam 不按方法区分路径）：我 14 形状探针中 `/__a5ptc4c/lifecycle`、`/__a5ptc4c/registration` = 200（读只读 census），**零改变**（roster/grants/ADJ 三面零差）；而八个登记/铸权路径全 405。⇒ 收口文档「一切 POST 非 2xx」宜精确化为「一切**登记/铸权/生命周期形**路径非 2xx 且 census 面对任意方法零改变」。
3. **重装账行的 `faces` 字段含陈旧条目**：`lifecycle-install{faces:9, liveFaces:6}` —— `installAdjudicationFaces()` 返回值把已 dispose 的 ADJ 条目一并计数（真实存活数在 `liveFaces`）。行为无碍（hook census 实测不翻倍），但披露字段宜改报存活数，免得下游误读为面数翻倍。
4. 我自有探针自纠四轮（r1 误把只读 census 名 `/lifecycle` 当铸权面、r1-r2 census 字段嵌套取错、r3 子程序混用 `require`+顶层 `await` 致 Node 拒绝判格式、r4 漏写 `cf`）**全部为探针缺陷、修复未触碰被审件一个字节**（reviewer 件一律 `rev-l2c-*`）；终态轮 r5 = 14/14。

## 8. 文件与复现

| 文件 | 角色 |
| --- | --- |
| `rev-l2c-chainred.mjs` / `rev-l2c-l2close.mjs` / `rev-l2c-devkit.mjs` | 被审三 runner 的**唯一一行世界前缀**副本（`diff <(sed 's/a5ptc4d-rev-/a5ptc4c-/' …) <被审件>` 为空 = 证明） |
| `rev-l2c-probe.mjs` | **reviewer 自有确定性探针**（自己的世界/通道/会话/confined 子进程/14 条 POST 形状；零模型腿） |
| `runs/a5ptc4d-rev-chainred-…T15-32-23Z/` | 修复前攻击链完整打通（10/10）+ 禁区落盘 |
| `runs/a5ptc4d-rev-green-…T15-33-24Z/` | 修复后权威轮（31/32，治理 15/15；含 `chain-green-stepA/B/C`、`registration-channel`、`leg-UNLOAD/REINSTALL/XTEAM/XTEAMUSE`、`residue-disclosure`） |
| `runs/a5ptc4d-rev-red-…T15-34-48Z/` | RED 判别轮（治理 0/15，其余全 PASS） |
| `runs/a5ptc4d-rev-devkit-…T15-47-24Z/` | dev 形态 7/7 + `devkit-manifest-diff.json` 清单级证明 |
| `runs/a5ptc4d-rev-probe-…T15-50-12Z/` | reviewer 自有探针终态 14/14（前四轮自纠留档 `…T15-47-36Z`/`…T15-48-21Z`/`…T15-49-14Z`/`…T15-49-35Z`） |

```bash
cd dev/agent-workflow/evidence/alpha5/w-ptc-outerfs
node rev-l2c-chainred.mjs --port 3184            # 修复前 → RED-CHAIN-COMPLETE 10/10
node rev-l2c-l2close.mjs  --port 3184            # 修复后 → 治理 15/15（NC-3 半边受 §7-1 竞态影响）
node rev-l2c-l2close.mjs  --red --port 3184      # RED 判别 → 治理 0/15，其余全 PASS
node rev-l2c-devkit.mjs   --port 3184            # dev 形态 7/7
node rev-l2c-probe.mjs    --port 3184            # reviewer 自有探针 14/14
```

## 9. 红线自查

CORE PATCH BUDGET=0（pin 树 `@639ed01539` 每轮跑前/跑后 `HEAD` 未动、`porcelain=0`）；只用公开面（profile-patch 证据行 / `ctx.on` / `agent.ctx.tools.*` / `ctx.webServer.register` / `ctx.get` census / `internals.*` 宿主自注 test-hook / 公开 `session/create|prompt` RPC）；**被审件与既有审查件逐字节未改**（reviewer 件一律 `rev-l2c-*`）；端口 3184 每轮自证空闲且已释放；**:3080 只读探测、前后 401**；世界 `tests/homes/a5ptc4d-rev-*`（含 `-forb`）审查毕删除；`graph.yaml` / 矩阵 / M-08 行 / `review-SECURITY-L2.md` 零改动；本文件不含 launch token / cookie；无 push、无 master 直推、无 force-push。

> **交付状态**：本审查件与我自有件（`rev-l2c-*.mjs`、`rev-l2c-*.stdout.log`、`runs/a5ptc4d-rev-*/`）以**未提交**状态留在一次性 worktree `.worktrees/a5-ptc-outerfs`（该分支 writer 归属不属于本 reviewer，入账与否由父 Agent 裁决）；本 reviewer 会话模型路由 = qwen3.8-flash-next。
