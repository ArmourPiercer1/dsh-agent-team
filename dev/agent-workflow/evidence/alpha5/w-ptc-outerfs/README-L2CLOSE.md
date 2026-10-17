# W-PTC-OUTERFS-L2 收口（F-L2-1 登记/铸权入口关死 + F-L2-2 disposer 生命周期）— README-L2CLOSE

liveness 首报：**You are a coding agent powered by the qwen3.8-flash-next model.**
base = `alpha5-ptc-outerfs@303e1195`（= L2 `e80ca6eb` + 独立安全审查 `303e1195`）；一次性 worktree `.worktrees/a5ptc4c-l2fix`（本地分支 `alpha5-ptc-outerfs-l2fix`，收口 ff 回 `alpha5-ptc-outerfs`）；端口 **3184**（自证空闲）；世界前缀 `a5ptc4c-*`（跑毕删除）；:3080 稳定实例只探不动。
被评审件 `a5ptc4b-grantrow.mjs` **逐字节未改**（RED 轮直接跑它，SHA 对齐 `e80ca6eb` 内 blob）；`review-SECURITY-L2.md` **保持原样不改写**；矩阵行/graph.yaml **零改动**（M-08 行修 lane 拥有）。

## 判定：**L2 收口成立（攻击链三步全拒 + 生命周期回归干净 + 五负控不劣化）**；net 半臂仍单列阻塞、**不由 fs 推导**

- **RED-first 前置（修复前完整打通 = 危险实证）**：`runs/a5ptc4c-chainred-2026-10-17T11-09-32Z/`（`node run-a5ptc4c-chainred.mjs --port 3184`）= **10/10**，`status=RED-CHAIN-COMPLETE`。被评审 L2 件原样：
  1. `REDCHAIN-0`：无任何 lane 时 member 升级 ask 得到零应答（lane-timeout）零写入 —— 后面的写入只可能来自攻击；
  2. `REDCHAIN-1`：member **自家 confined workspace-write 子进程**（无宿主凭据、无升级、纯 loopback）`POST /__a5ptc4b/provision` 把未登记会话 ATK 注册成**铸权 lane**（200 ok role:lane，roster 现带三 lane 工具，账本 provision-complete）；
  3. `REDCHAIN-2`：攻击者驱动**自己会话 ATK** 的 lane 工具 `a5ptc4b_grant`，以 declared 形态**铸出绑定 M1 四元组的 Grant**（declared 的绑定是自由文本——诚实 lane 抄不了的宿主字段，在"任何会话都能被登记成 lane"面前无意义）；
  4. `REDCHAIN-3`：M1 呈现该四元组 → `allowed-once` 带伪造 grantId，**禁区文件真实落盘**（真 confined-OS 越权，Team 从未批准）。全链无诚实 lane、无被盗凭据。
- **GREEN 权威轮（收口件收死每一步 + 全套不劣化）**：`runs/a5ptc4c-green-2026-10-17T12-05-32Z/`（`node run-a5ptc4c-l2close.mjs --port 3184`）= **32/32 criteria，治理判据集 15/15**，`status=GREEN-ALL-PASS`；收口件 `a5ptc4c-grantrow.mjs`：
  - `F1-REG-TRUSTED-CHANNEL-ONESHOT`：花名册（含 lane）**只**来自装配器私有生命周期通道（registeredVia=trusted-lifecycle-channel，逐条 decision=registered）；消费过的 nonce 重放拒、已在册成员转 lane 拒（永不升格）、**seal 之后一切登记拒**；ATK 从未上册；
  - `F1-NO-HTTP-REGISTRATION-MINT`：对八条可设想路径（评审面 `/__a5ptc4b/*`、收口面 `/__a5ptc4c/*`、devkit `/__a5ptc4cdev/*`）POST 登记/铸权形 body：**一切登记/铸权/生命周期形路径非 2xx**、roster/grants 账本零移动、路由 census `mutating=0`。**方法不分治（如实披露，审查精度项）**：宿主 seam 不按方法区分路径，只读 census 面对 POST 返回 200 **只读体**——其安全语义不是「非 2xx」而是**任意方法零改变**（reviewer 14 形状探针独立实测：roster/ADJ/账本零差，`REV-HTTP-DEAD-MINT`）；
  - `F1-INWORLD-ATTACK-REFUSED`：RED 轮那个**同一个攻击子进程**再跑：三条登记面 + 铸权形全 405，roster 只读可见但零新增 lane，**追加写生命周期通道文件被 OS 拒（EACCES，与禁区目录同地板对照）**，ws 写控制照常，roster 零差；
  - `F1-ATK-MINT-DEAD`：攻击者驱动 ATK 调 `a5ptc4c_grant` —— ATK 从未登记 ⇒ 其会话上**不存在铸权工具**（模型边界实证 unknown-tool），grants 零移动；
  - `F1-CHAIN-CONSUME-REFUSED`：M1 呈现攻击目标四元组：无 Grant ⇒ 挂 Team lane 至限期 ⇒ `lane-timeout` 拒且无 grantId；**RED 轮真实写过的 `l-chain.txt` 此轮不存在**；
  - `F1-DELEGATION-PATH-UNDISTURBED`：拒完攻击链后，诚实 lane（经通道登记）对新鲜 ask 照旧 ask-bound `allowed-once` 写入落地 —— 修的是入口，不是委托路径。
- **RED 判别轮（`--red`，`A5PTC4C_ASSEMBLE=0`）**：`runs/a5ptc4c-red-2026-10-17T11-46-55Z/`：`verdict=EXPECTED`——治理判据集（15 条，含新增 F1-CHAIN-CONSUME / F1-DELEGATION / 三条 F2）**0/15（全 FAIL）、其余 17 条安全姿态/卫生判据全 PASS** ⇒ 判据不同义反复，涨的确实是治理装配带来的行为。
- **dev 形态单证**（`node run-a5ptc4c-devkit.mjs --port 3184`）：`runs/a5ptc4c-devkit-2026-10-17T12-07-07Z/` = **7/7 `verdict=DEV-SHAPE-PROVEN`**：`DEVKIT-LIVE-WHEN-EXPLICIT` / `DEVKIT-SINGLE-SINK`（devkit 面纯 ingress，登记仍走同一通道，registeredVia=trusted-lifecycle-channel）/ `DEVKIT-LANE-REFUSED`（dev 形态也铸不了 lane，403+零移动）/ `DEVKIT-OFF-WITHOUT-ENV`（挂载≠启用：无 `A5PTC4C_DEVKIT=1` 时零路由）+ `install-manifest.json` / `devkit-manifest-diff.json` 安装面清单：生产装配**只有** `a5ptc4c-grantrow` + 独立探针，devkit 文件**不在**生产 patch、收口件源码无 devkit import。

## F-L2-1 落法（唯一登记入口 = Team 生命周期，成员任何路径不可注册/铸权）

| 审查要求 | 收口落法（全公开面） | 机检 |
| --- | --- | --- |
| 关死测试自举入口 | 收口件**不注册任何 mutating HTTP 路由**（无 provision/grant/revoke/register 路径字面量；`T1` 静态 + 路由 census `mutating=0`）；kit 若保留登记面 = 独立 `a5ptc4c-devprovision.mjs`，**显式 mount + env 双门默认关**、纯 ingress、lane 恒拒 | `T1-NO-TOKEN-CHANNEL-AND-NO-MUTATING-ROUTE-IN-ARTIFACT` / `F1-NO-HTTP-REGISTRATION-MINT` / devkit 轮 |
| 授权只从可信 Team 生命周期来 | 装配器（=世界 runner，Team 宿主替身）在 spawn 前创建 **0600 append-only 通道文件**（`F1-CHANNEL-0600`：先于宿主存在）；插件只读轮询公开 fs；每条登记一次性 nonce，`seal` 关闭登记；lifecycle op（install/uninstall-all）也只走此通道 | `F1-REG-TRUSTED-CHANNEL-ONESHOT` / `registration-channel.json` |
| 成员任何路径不可注册/铸权 | 成员唯一执行面 = confined 外层程序（workspace-write 地板）：通道文件/禁区一律 EACCES（OS 实测）；成员会话上永远没有铸权工具（工具只在 lane 登记时注册；ATK 实证 unknown-tool） | `F1-INWORLD-ATTACK-REFUSED` / `F1-ATK-MINT-DEAD` / `chain-green-stepA/B/C.json` |
| 不进可安装产物 | 安装面清单 diff（生产 patch 两行 vs dev patch 三行）+ 静态无 import + 生产 boot 时 `/__a5ptc4cdev/*` 非 2xx（runner 与子进程双探针） | `F1-DEVKIT-ABSENT-BY-DEFAULT` / `install-manifest.json` / `devkit-manifest-diff.json` |

**威胁模型披露（不得省略）**：装配器 = 世界 runner 进程（Team 宿主替身）；通道防护的边界是 **member 会话 + 其 confined 子进程**（loopback 无面可打 + 文件写被 Landlock 拒）；同 uid 非 confined 的宿主级进程与装配器同权限，属于边界外（TEE 级隔离是 L4 议题，不在本轮声称内）；nonce/seal 给一次性与关档语义，不承载机密性（通道文件可读不可写，权威=文件写权 + 无 HTTP 面）。人类判断本身仍 L4 未证（审查 §7 原样）；L3 未做。

## F-L2-2 落法（disposer 生命周期 + 残留披露 + 回归）

| 机制 | 收口落法 | 机检 |
| --- | --- | --- |
| 生命周期绑定 | 面分两层：`ADJ`（两条插件 approval/request 面 + 只读镜像 + **每条成员自家 agent-ctx 审批面 = 真 disposer**，带 census tag）与 `LIFE`（witness/guard/presentAs/around-seam + lane 三工具）。lane `a5ptc4c_unload` 跑整层 ADJ；通道 `uninstall-all` 跑两层并清零建态 | `T5-UNLOAD-SYMMETRIC-AND-DEAD` + `F2-UNLOAD-BURNS-MEMBER-FACES`（账本 memberFaces≥3） |
| 残留披露 | census `/__a5ptc4c/lifecycle` 枚举 `residueAfterUninstall`（只读 census 面 + 已 seal 通道监听器 + 审计账本），`/routes` 列出存活路由；**对全部 census 面 POST 授权/登记形 body 零改变**（grants/roster 零差） | `F2-UNINSTALL-ALL-NO-RESIDUE` / `residue-disclosure.json` |
| install→uninstall→reinstall 回归 | uninstall 后 in-domain ask **零应答**（幽灵检查：无账行、无工具结果、零写入）；reinstall 由 `installAdjudicationFaces()` 幂等重建（faces>0 时 no-op，防双注册），hook census 我方点数**恰回装态数不翻倍**，下一条 ask **恰一条判定行**（无 already-decided 重复） | `F2-REINSTALL-EXACTLY-ONCE` / `leg-UNLOAD.json` / `leg-REINSTALL.json` |

## 五负控不劣化（同 id 对照）

GREEN 轮 L2 原 10 条治理 id 全 PASS：`ANCHOR-TEAM-GRANT-ALLOWED-ONCE`、`NEG1-REPLAY-REFUSED`、`NEG2-EXPIRED-REFUSED-DOWNSTREAM-VISIBLE`、`NEG3-AGENT-BIND-GRANT-UNSPENT-AND-OWNER-ONLY`、`NEG4-REVOKED-BEFORE-USE-REFUSED`、`NEG5-MODE-BIND-MISMATCH-REFUSED`、`DELEG-ZERO-ANSWER-VERBATIM-DOWNSTREAM`、`CONCURRENCY-ISOLATION`、`T5-UNLOAD-SYMMETRIC-AND-DEAD`、`GOV-ADJUDICATION-INPUT-IS-TEAM-GRANT-ONLY`（+ `PERM`/`P-*`/`L-*` 卫生线）。L2 权威轮与审查件证据保留在 `runs/a5ptc4b-*`、`runs/a5ptc4b-rev-*`、`README-L2.md`（措辞已按实情收窄两处，见其 T-5 行与文件表）。

## 轮次记录（含中间失败轮，不遮丑）

- `runs/a5ptc4c-chainred-2026-10-17T11-09-32Z/`：**RED-first 10/10 = 攻击链完整打通（危险实证，被评审 L2 件原样）**。
- `runs/a5ptc4c-green-2026-10-17T11-16-22Z/`：19/32（治理 8/15）——全部为 **runner 缺陷**（legSay 队列竞态：queue-prompt RPC 先于 lane 工具执行返回 ⇒ REVOKE 腿先于撤销呈上被消费；REPLAY callId 别名三元写反；mock 对块状 content 做 JSON.stringify 使 `(\S+)` 捕获吞进 `"}]` ⇒ EXPIRY 铸权被拒/lane 全灭一半；FXCHECK 误带升级把 FX 会话饿死；hook census 用 toString 而宿主 `bind` 遮蔽回调源码 ⇒ mine 恒 0；F2 对照取了旧快照；直探针参数多一个 `--`）。收口件行为在账本里逐条正确（如 REPLAY 行的 modelTextLog 带死 token 却仅日志、g2 撤销行晚于消费行 = runner 竞态铁证）。
- `runs/a5ptc4c-green-2026-10-17T11-26-41Z/`：30/32（治理 14/15）——剩两处观察面缺陷：TTL 过期是**裁决时惰性判定**（呈前读 state 仍 issued 属正常，判据改呈后读）；outsider 的 runs 未进 state census（census 按 role 分支漏了 outsider.runs）。
- `runs/a5ptc4c-green-2026-10-17T11-30-53Z/`：32/32（治理 15/15）——GOV 红逃逸修复前的绿权威轮（绿值与终版逐字一致）。
- `runs/a5ptc4c-red-2026-10-17T11-34-53Z/`：治理 14/15——**GOV 判据缺陷**（`(MODE==='red'||decided>0)` 红逃逸 + 空数组 `every` 真空 ⇒ 无裁决器时 GOV 反而过），判据改为两种模式都必须有观测到的 Team-Grant 判定行；收口件无关。
- `runs/a5ptc4c-red-2026-10-17T11-46-55Z/`：**终版 RED 判别轮** = 16/32，治理集 **0/15 全 FAIL、其余 17 全 PASS**，`verdict=EXPECTED`。
- `runs/a5ptc4c-green-2026-10-17T12-05-32Z/`：**终版 GREEN 权威轮** = **32/32，治理 15/15**，`status=GREEN-ALL-PASS`（与终版 runner 逐字节对应）。
- `runs/a5ptc4c-devkit-2026-10-17T12-07-07Z/`：**dev 形态 7/7**（此前两轮 devkit 自我修复：package.json 内不能带 `#` 注释行——宿主以 JSON 解析整文件并禁该行；`ctx.webServer` 须 `export const inject=['webServer']` 声明方可见——缝事实两条）。
- `review-SECURITY-L2CLOSE.md` + `rev-l2c-*.{mjs,log}` + `runs/a5ptc4d-rev-*`（9 目录）：**独立 L2CLOSE 审查轮（reviewer 亲跑，证据原样入库）**——被审四件均为 reviewer 一行世界前缀副本（diff 全空 = 逐字节等价）+ reviewer 自有确定性探针（自有世界/0600 通道/confined 子进程/14 条 POST 形状，零模型腿）⇒ **判定 = 闭合成立**；三条非阻断精度项全部收口：**(a)** `run-a5ptc4c-l2close.mjs` NC-3 写落地单次 existsSync 采样 → 有界轮询（reviewer 实测裁决行后 +58 ms 落盘；判据不放宽，仅采样方式修正，`leg-XTEAMUSE.json.writeLanding` 留 mtime/size 遥测）；**(b)** census 措辞精确化：「一切 POST 非 2xx」→「一切登记/铸权/生命周期形路径非 2xx；census 面对任意方法返回只读体零改变（方法不分治，如实披露）」；**(c)** `lifecycle-install` 账行 `faces` 改报**存活数**（=liveFaces），原累计口径保留为 `facesCumulativeSinceBoot` 并注陈旧（reviewer 实例 9 vs 6）。三修后复跑 `runs/a5ptc4c-green-2026-10-17T15-59-43Z/` = **32/32，治理 15/15 全回归**（含 NC-3 有界轮询绿、重装账行 faces:6=liveFaces:6 且累计字段如实=9、census 数字复核）。

## 可入账 / 不可入账（措辞纪律）

- **可入账**：F-L2-1 攻击链修复前后对照闭环（前=完整打通含禁区落盘；后=每步拒+台账可观测+委托路径不受扰）；F-L2-2 disposer 生命周期 + 残留披露 + 重装回归；devkit 面不进安装面的清单级证明。全部为**证据行**装载、零 Core 改、零网络姿态改动。
- **不可入账**：人类判断（L4）、资源/路径粒度与并发多 Team（L3）、同 uid 宿主级进程防护（模型边界外）、net 半臂（仍独立单列阻塞，**绝不从 fs 半臂推导**）。

## 红线守纪

CORE PATCH BUDGET=0（pin 树 @`639ed01539` 跑前跑后 porcelain 0）；只用公开面（profile-patch 证据行 / `ctx.on` / `agent.ctx.tools.*` 含 disposer / `ctx.webServer.register` 含 disposer / `ctx.get` census / `ctx.sandbox.internals.*` 公开测试钩子）；端口 3184（自证空闲）；:3080 前后 401 未动；世界 `tests/homes/a5ptc4c-*` 跑毕删除；矩阵行/graph.yaml 零改动；review-SECURITY-L2.md 未改写；L2 五负控证据保留；无 force-push、无 master 直推。
