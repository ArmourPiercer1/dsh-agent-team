# 07 — 根四问逐条实现级回答（round B 修正令，08:47Z）

每问=结论（成立=缺口存在/已修+最小修复面）+ 一手实现证据（文件:行）+ 新增实测名。
修复全部落 C2 授权窗口面（`plane-effect-backends.mjs` 桥两函数）；测试落既有 actuator 档；
dist 镜像同 commit（#338 律）。**未动 git 历史、未动凭据**。

## ① jobList 无逐 job Team owner 过滤 — **成立（缺口存在）→ 已修 + 同 caller 双成员负控实测**

- 一手事实（修复前）：`jobList = svc.list(caller)` 直通（原 :1021-1031），注释自认"the fence
  invents no per-job gate"。宿主 caller fence 按 caller 圈行，**caller 是派发提供的**：任何路由形
  把同一 caller 呈现给两个受治成员时，已归属他人的行会经列表互见（标签/id 泄漏面）。
- 最小修复：桥 `jobList` 对宿主返回的**每一行**过 `asm.checkManagementAccess({jobId, viewer})`：
  有记录且非本 scope → **隐身**（不点名、不回显 owner=C-GW 静默拒）；无记录 → corded:false
  披露透传不变（宿主辖区，桥不造所有权）。
- **实测（不是不同 caller 代偿）**：`ROOT① NEGATIVE CONTROL (same caller, two members)` —
  两成员桥 + **同一** caller `caller-shared`：A 归属行对 B **隐身**、B 看不到
  `owner-mismatch` 回显、无记录行双方都见（披露透传）、每桥恰一次宿主查询。
- 旧 pin 处置：原 "job_list stays a pure identity read" 更名为 assembly-level 真话并**在册声明
  其 per-row 法已迁至桥**（审稿前旧法，superseded 注记写在测试名内，不静默）。

## ② corded:false 未归属透传 vs 已批 pc-CONTRACT — **符合契约原文（两层语义按令区分）**

- 契约原文（`dev/agent-workflow/evidence/alpha5/prod/pc-CONTRACT.md` :26，已批准文本逐字）：
  > 「两层 fence 各自独立：registry 按 caller session fence（`job … belongs to another session`
  > 原文），gateway 按 member-scope fence」
  同行缺位列：「今日受治理 team 的用户 jobs 能力仍 = 宿主公开面，非本 lane 宣称」；
  checklist :114：「`jobs` 缺位时装配仍自洽（gateway 不假造宿主 jobs 能力；`job_start` absent
  anchor 不许被行"补"出来）」。
- **两层语义区分（按令明写）**：corded:false = **宿主安全 fence 在位**（caller-session fence 原文
  仍权威，读/杀照样被宿主拒）≠ **Team owner 已证明**（gateway 对该 jobId 的记录=零，Team 层
  零宣称、永不事后造所有权）。契约语义 = 各层只为自己回答；未归属作业本属宿主公开面 ⇒
  透传**符合原文**，且 lane 披露（assembly :142-152 + README-c3）自 C1 起即按此措辞。
- 结论=成立（合规），无需修复；语义区分入本档与 README-c3 防口径漂移。

## ③ ensureDefinitions registered 缓存留旧身份 — **成立（缺口存在）→ 已修 + 替换形实测**

- 一手事实（修复前）：`registered = new Set()`，名字首注后**永不再读 feed**；行本地定义 store 为
  last-write-wins Map（assembly :87-89）⇒ 定义替换/重挂 mint 新 identity 后 store 停旧值，
  后续 admit 全 pin 旧身份（C-BIND"定义已移动"律被旧缓存掩盖）。
- 诚实半边：**管理调用不消费定义 store**（`checkManagementAccess` 只读 owner 法：records +
  jobOwnerKey，assembly :154-162）⇒ 旧 pin 永远误导不了 read/kill/list，只可能误导**归属**——
  而归属恰是修复面对象。
- 最小修复：`registered: Map<name, lastIdentity>`；feed 身份**移动即重注**（懒式律不变：未 mint
  永不注册 undefined），observe 词分 `definition-registered / definition-re-registered`。
- **实测（构造替换形）**：`ROOT③ REPLACEMENT SHAPE` — v1 懒注册 → feed 翻 `bash@v2-replacement`
  → `ensureRegistered()` → 新 admit pin = **v2**（修复前此断言 RED=旧 Set 永不再注）。

## ④ wait 挂起中 kill/定义变化 → read 边界 — **行为=宿主法，已实测钉死（无需修复）**

- 构造：`ROOT④ wait boundary` — 桥 `job_output(wait:true)` 挂起（宿主 `wait(jobId, ms, caller)`
  未回）→ 期间经桥 kill（gate 先过=owner 本人）→ 宿主答 `'requested'`（**请求≠终结**）→ 测试驱动
  **settling edge**（异步进程死亡才解 wait=宿主语义）→ read 见**终形态**：output 字节 + 结果尾
  `(job cancelled by request)`，调用序精确钉 `wait → kill → read`。
- 断言关键：settling edge 之前 read 不可见终态（挂起中）；kill 请求把 gateway 记录标
  `cancelRequested=true` 但 **lease token 保持 outstanding**（PR1 Gate R4：request≠settlement）；
  wait 期间定义变化不影响挂起中的 read（read 不消费定义 store，②③同法），下一次归属才见新身份。
- 结论=行为成立（宿主两态语义在桥后原形保持），以实测固化。

## M1 事实四项（按修正令格式，禁贴值——遵禁）

1. **用途**：live kit 临时世界（:3186 回环 web 面）的一次性启动认证 token。
2. **有效期**：一次性、随其世界会话生命周期；终档世界中该实例与端口随世界扫净已销毁 ⇒ 事实上已失效。
3. **宿主是否已终止**：已终止（临时实例进程随 era 收尾关闭；:3080/:3180 稳定实例全程只读探针未触及）。
4. **权限范围**：仅该临时实例 :3186 回环 web 面的根会话权限；不触及本机其它实例/目录凭据。
- 处置=已落 `4073039b`（append-only）：已 commit 尾档打码 + README 口径更正 + 重复原始档删除 +
  kit 捕获点真打码。**未动 git 历史、未动任何凭据**。

## 门禁账（本 commit）

actuator 17/17（14→+3 新负控）+ 同链 jobs-assembly 14 + hygiene 14 + p4t6 1（**文件 census 不变=1208**，
新增测试全在既有档内）=46/46；runtime typecheck rc=0；check-artifacts ok 1748/glue9
（桥 .mjs 的 dist placement 镜像**同 commit**）。
