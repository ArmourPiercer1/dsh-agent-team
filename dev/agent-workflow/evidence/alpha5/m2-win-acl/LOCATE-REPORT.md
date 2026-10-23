# M2-WIN-PROVIDER-LOCATE-01 — pwsh 静态入口 + Windows ACL enforcement 边界（只读定位）

- 卡：`M2-WIN-PROVIDER-LOCATE-01`（Alpha.5 M2；只读定位，零运行、零 Host/产品测试、零环境动作）
- 起手自核：工作树 `/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-m1-kernel` HEAD=`c978eb2fc7141b33cce9de50fb8dceae47934b91`，分支 `feat/a5-m1-center-kernel`（=卡面要求）；宿主树 `tests/deepseek-harness-test-use` `git rev-parse HEAD` = `639ed015397290b3745d163aafe02ffee4aa3f84`（pin639 ✓），porcelain 空（全程保持）。
- 必读已读：`AGENTS.md`（worktree 版）、`docs/ROUTER_RULES.md`（§0 当期计划优先）、`docs/TEST_METHODS.md`；矩阵 `TOOL-CAPABILITY-MATRIX-9b2.md` :32 pwsh 行 + :9-14 头部约定（⑥格式/⑧封闭枚举）；冻结合同 `M0-B-FAMILY-TARGET-CONTRACTS.md` B-PROCESS（:77-80）/ B-JOB（:89-91）原文。
- 根收窄令（session-ff84025b 转达）已执行：交付=静态定位+⑥/⑦措辞；loader.spec skip 定性=无 Team/无 sandbox 环境正控、skip≠pass；partial 不升 full；零 HKLM/ACL 修复建议；不造 provider、不提 workflow。
- 诚实法：以下全部为**静态源码可达入口/自述边界**，零运行时验证声称；`ENV-NOT-AVAILABLE`≠通过；NOT_RUN≠covered；静态入口≠运行时能力。

---

## 一、pwsh provider 注册与选择入口（静态可达，宿主 pin639）

### 1.1 宿主：装载/平台门（Windows 与非 Windows 分岔）

| 入口 | path:line | 事实（静态） |
|---|---|---|
| base bundle 装载 | `tests/deepseek-harness-test-use/packages/bundle/base/cordis.patch.yml:241-243` | `pwsh-sandbox`（`@deepseek-ai/dsh-pwsh-sandbox`）`disabled: !!js process.platform !== 'win32'` |
| base bundle 装载 | 同文件 `:271-273` | `tool-pwsh`（`@deepseek-ai/dsh-tool-pwsh`）`disabled: !!js process.platform !== 'win32'`；对照 `:235-237` `bash-sandbox` 与 `:267-269` `tool-bash` = 反向 `=== 'win32'` 关断（bash/pwsh 互斥平台分岔） |
| web-app 宿主面关断 | `packages/bundle/web-app/cordis.patch.yml:453-454` | `tool-pwsh disabled: true`（宿主面关、迁 preset；非"无实现"） |
| preset 平台门 | `packages/bundle/web-app/presets/standard.patch.yml:23-25`；`ptc.patch.yml:23-25`；`cordis.patch.yml:26-28` | 三 preset 内 `tool-pwsh` 均 `disabled: !!js process.platform !== 'win32'`（=route-records 所记 "presets ~:23-28"） |
| minimal preset persistent | `packages/bundle/web-app/presets/minimal.patch.yml:43-48,49-51` | `terminal-pwsh`（dsh-terminal-bash `shellDialect: pwsh`）与 `persistent-pwsh`（dsh-tool-pwsh-persistent）均 disabled-unless-win32 |

### 1.2 宿主：工具/执行器注册与可执行文件解析

- `packages/shell/tool-pwsh/src/index.ts:49-50`（`name='tool-pwsh'`、`inject=['tools','shell','systemPrompt','shellEnv']`）；`:383-384` `defineTool({name:'pwsh'})`；`:595,:598,:602-605` `ctx.tools.register(pwshTool(...))`（前台形与 jobs 组合形）。
- 同名 persistent 注册臂：`packages/shell/tool-pwsh-persistent/src/index.ts:426-427`（`ctx.tools.register(defineTool({name:'pwsh'}))`）、`:453`（`name='tool-pwsh-persistent'`）——one-shot 与 persistent **同名 `pwsh` 分实现**，与矩阵附录 A-2 "persistent 不能继承 one-shot 测量"口径一致。
- shell provider（Service Provider 臂）：`packages/shell/pwsh-local/src/index.ts:123-134`（`PwshLocalExecutor`，config 键 `pwshPath` `:77/:133`）；执行文件选择 `packages/shell/pwsh-local/src/resolve.ts:67-79`（`resolvePwshPath`：显式 `pwshPath` 直采 `:72`；仅 `platform==='win32'` 才探装机路径 `:73-77`；否则回落裸 `pwsh` 走 PATH `:78`；候选表 `:21-37`）——**非 Windows 平台该解析无装机探测，仅 PATH 回落**。
- 受限执行器：`packages/shell/pwsh-sandbox/src/index.ts:52-53`（`SandboxPwshExecutor extends PwshLocalExecutor`，`inject=['subprocess','sandbox','sandboxPolicy']`）；`danger-full-access` 直通 `:99-104`；confine 走 `ctx.sandbox.confine` `:194-196`。
- 沙箱后端选择（宿主 confinement 分岔）：`packages/sandbox/sandbox-local/src/index.ts:160-166`（`PLATFORM_CHAINS`：linux=`['bwrap','landlock']`、darwin=`['seatbelt']`、**win32=`['windows-acl']` 单候选无探针**）；`:511-515`（链选择实现，单候选直接采用 `STATIC_ENFORCEMENT`）。

### 1.3 我方插件侧对 pwsh 的当前态度（team-tool-plane.mjs / agent-bindings.mjs）

- `packages/runtime/src/plugin/live/team-tool-plane.mjs:403-463` `PLANE_RESERVED_NATIVE` **含 `'pwsh'`**（:405，与 `'bash'` 同行）。
- 同文件 `:465-479` `PLANE_SUPPORTED_NATIVE_TAKEOVERS` = `{bash:['bash'], read:['read'], grep:[], glob:[], jobs:[job_output,job_list,job_kill]}`——**无 pwsh 键、无 pwsh 值**；配合 `:482-483`（names map 封闭到 grep/glob/bash）与 `:492-495`（reserved 名非 supported 即 `PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED` typed 拒）→ `names.bash='pwsh'` 被拒为**源码+注释双证**（:326-337 明写首轮粗类门曾接受 `names.bash 'pwsh'`，root ruling 06:43Z 收紧后拒绝）。
- lane 判定词汇含 pwsh：`:524` `shellTools = new Set(['bash','pwsh'])`，消费于 `:598` 与 `:610-611`（`shellToolsDenyOnly`）——shell 类模板规则同时键 `bash`/`pwsh` 两个 native 拼写。
- `agent-bindings.mjs` 无 pwsh 注册臂；pwsh 出现在三处**词汇臂**：`:220`、`:411`（shell spill 观测器仅记"successful foreground bash/pwsh"）、`:425`（leader exec-envelope 令牌 `'bash'/'pwsh'`）。配套：`packages/runtime/admission/envelope.ts:182` `ENVELOPE_EXEC_OPS=['bash','pwsh']`（:174 "bash authority != pwsh authority" 令牌分立）；`packages/runtime/artifact-read/shell-result-observer.ts:212` `SHELL_OBSERVER_DEFAULT_TOOLS=['bash','pwsh']`；`packages/runtime/src/plugin/s6-remote.ts:489` `tool:'bash'|'pwsh'`。
- Team 进程 provider（B-PROCESS 目标路线的 E runtime Provider）：`packages/runtime/sandbox-provider/provider.ts:569`（`prepare()`）/`:646` 附近（`execute()` 一次性消费）——文件头 `:12` 自述 **DORMANT wired-to-nothing**；该文件无 pwsh 臂（Linux launcher 词汇）。
- **限定**：以上全部为静态可达入口；Team 组成在 win32 之外 pwsh 无生产面，win32 之上 pwsh 亦仅有"宿主继承面 preset 挂载"这一条静态路线（无 plane takeover 行）。

---

## 二、Windows ACL enforcement 源码边界（pin639）与四项逐条

### 2.1 实现点全集与"约束了什么"

- 唯一 Windows ACL enforcement 包 = `packages/sandbox/sandbox-windows-acl`（宿主全树 grep `icacls|SetNamedSecurityInfo|CreateHardLink` 仅命中该包 src/tests + diagnose 资产脚本；`firewall|WFP|netsh advfirewall` 全树 **0 命中**）。
- 机制（约束面=**写与删**）：`src/index.ts:1-24`（WRITE_RESTRICTED token + workspace/temp 两个 capability SID 写 ACE 交集 + Low integrity 降级）；`src/acl.ts:8-15`（每次 grant 一次 `SetNamedSecurityInfoW` 写三类条目：capability-SID **allow Write ACE**、world SID 的 **deny `FILE_DELETE_CHILD`**（唯一 DENY_ACCESS 位点 `:408`）、Low **no-write-up mandatory label**）；执行点=runner argv 前缀（`src/runner.ts:1-19`：`[node, runner.js, '--workspace',…,'--temp',…,'--mode',…,'--',argv…]`，`--mode read-only|workspace-write`）。
- **写面**：`workspace-write` 限 workspace+私有 temp；`read-only` 零 capability SID（站立 ACE 失效）`src/runner.ts:20-26`。**删面**：ambient `FILE_DELETE_CHILD` deny（acl.ts:8-15,408）。
- 宿主自己把该后端标为 **partial**：`packages/sandbox/sandbox-local/src/index.ts:178-188` `STATIC_ENFORCEMENT['windows-acl']='partial'`，注释 :182-187 点名 hardlink 别名、读不受限、AppContainer ACL 面。

### 2.2 四项逐条（有/无 enforcement 点；均"源码可证"）

| 项 | 有无 enforcement 点 | 证据 |
|---|---|---|
| **读取** | **无 enforcement 点（源码可证）**：包内唯一 DENY_ACCESS 是 `FILE_DELETE_CHILD`（acl.ts:408，删权非读权）；无任何读 deny ACE；模块头自述 `src/index.ts:26-28` "writes are restricted; reads, network, and process visibility are NOT (WRITE_RESTRICTED intersects only write accesses)"；README.md:125 "neither layer intersects reads, so a confined child can read any caller-readable file (including files in another workspace)… `read-only` therefore needs a read-side policy to be expressed" | `src/acl.ts:408`、`src/index.ts:26-28`、`README.md:125` |
| **网络** | **无 enforcement 点（源码可证）**：包内 `network/firewall/wfp/winsock` 零命中（仅 index.ts:27 自述"NOT"）；宿主全树 `firewall|WFP|netsh advfirewall|HTTP_PROXY(sandbox/shell 群)` 零命中；restricted-token 交集只作用对象访问检查（index.ts:26-28 自述）；README.md:125 "open sockets" 明示可开 | 同上 |
| **进程可见性** | **无 enforcement 点（源码可证）**：包内 `OpenProcess` 命中均为 **沙箱自身打开自己进程取 token**（`src/token.ts:24-40`，`abi.ts` PROCESS_QUERY_INFORMATION），非对子进程施加可见性约束；全树无 desktop/window-station/BaseNamedObjects 隔离 API 命中；index.ts:26-28 与 README.md:125 自述"process visibility are NOT" | `src/token.ts:24-40`、`src/index.ts:26-27`、`README.md:125` |
| **hardlink 路径别名** | **无收敛/拒绝 enforcement 点（源码可证），且为在册边界**：包内无 `hardlink/reparse/junction/CreateHardLink` 处理（`realpathSync.native` 仅用于 workspace/temp 目录边界不相交判定 `src/path-boundary.ts:10-14`）；`src/runner.ts:19` "…except for the documented Everyone and hard-link boundaries"；README.md:126 "Hard links are file-object aliases, not path aliases — … the same object is writable through an external alias; rejecting multiply-linked files is not viable for ordinary pnpm installations" ⇒ 写权限沿**文件对象 SD** 授予，工作区内 hardlink 名可把外部同对象文件带入可写交集（反向同理）。**该缺口是"写面经别名越界"，不是"读写之外另一读面缺口"——引证时按 README 原文定性** | `src/runner.ts:19`、`README.md:126`、`src/path-boundary.ts:10-14` |

（"无 enforcement 点"的口径=在该 enforcement 的实现树内不存在对应检查/拒绝位点，且实现自身文档自认；不作"未找到即不存在"之外的推断，不引第二手文档作结论。）

### 2.3 loader.spec.ts 定性（按根令，引用时带此定性）

`packages/shell/tool-pwsh/tests/loader.spec.ts:20,39`（`hasPwsh` 探针 + `describe.skipIf(!hasPwsh)`）；其组成 `tests/fixtures/loader/cordis.yml` = system-prompt/tools/subprocess-local/**pwsh-local（无 sandbox 后端）**/shell-env/jobs-local/tool-jobs/tool-pwsh——**无 Team、无 sandbox 的环境正控**；其 skip（本宿主无 pwsh 二进制）**不是 pass**，亦不构成 provider 能力证据。

---

## 三、路径解析与别名收敛：写面 vs 读面（fs 面 + 进程面分立）

### 3.1 进程面（pwsh 实际受限走的路径）

ACL 后端不做路径别名收敛（见 §2.2 第四项）：收敛对象只有 workspace/temp 目录不相交（`path-boundary.ts` realpath），写授权本身随文件对象 SD 传播。**pwsh 子进程的文件别名越界在 ACL 层无收敛点。**

### 3.2 fs 工具面（宿主 `ctx.fs`）

- 写面收敛：`packages/fs/fs-sandbox/src/index.ts:80`（`writeText` override）、`:101`（`editText` override）、`:122-130`（`checkedTarget`：写前**重新 canonicalize**（`resolve` realpath 最深现存祖先，捕捉换 symlink 的 TOCTOU，注释 :114-116）+ containment 检查；`read-only` 全拒 `:126-127`）；别名等价（Windows 8.3 长名/大小写）由 `containment.ts:46-76` `isPathUnder` 的 **dev/ino 文件系统身份回退**收敛。头注 `:12-16` 自述"containment, not a security boundary"（信任代码上的模型可控路径检查，残余 TOCTOU 已声明接受）。
- 读面：**不收敛**——`packages/fs/fs-sandbox/src/index.ts:7-8` "Reads pass through untouched: every mode permits reading"；`SandboxedFileSystem` 不覆写任何读方法，读继承 `packages/fs/fs-local/src/index.ts`（`readBytes` 实现 `:183`；抽象声明 `packages/fs/fs/src/index.ts:228`；调用方 `packages/fs/tool-fs/src/read-image.ts:263`）。
- **与 read_image 卡并列（不裁决）**：该卡结论"读面走 `ctx.fs.readBytes`、`fs-sandbox` 内 `readBytes` 零命中"与本卡 pin639 亲读一致（fs-sandbox/src 两文件内 `readBytes` 出现次数=0；读路径无 containment），两结论不冲突，如实并列。

---

## 四、矩阵 pwsh 行（M-07 :32）⑥/⑦ 措辞建议（矩阵由 CENTER 落笔；⑧ 只给封闭枚举内取值建议）

**⑧ 建议：维持 `NOT_VERIFIED`**（封闭枚举内；本轮零运行，无 tested SHA 可填；**禁**升 `ENFORCE-PARTIAL`——该级别会宣称本行治理面已被部分强制，而 ACL partial 是**宿主后端自述事实**、非本行验收；亦禁借 `LIVE-CONFIRMED`）。`V@B=no` 维持。

**⑥ 建议措辞**（保留原 ENV-NOT-AVAILABLE 句与"禁跑该腿≠provider 否定"句，追加静态定位段）：

> 无 tested SHA（零运行）；适用性=NOT_VERIFIED(未测)；**静态入口定位（@pin639 `639ed01539` + 我方 `c978eb2fc` 亲读，零运行）**：宿主装载/平台门=base `cordis.patch.yml:241-243,271-273` + web-app `:453-454` + presets standard/ptc `:23-25`、cordis `:26-28`、minimal `:43-51`（全部 disabled-unless-win32；bash 反向门）；工具注册=tool-pwsh `index.ts:383-384,595-605`（同名 persistent 臂 tool-pwsh-persistent `:426-427,453`）；执行器/解析=pwsh-local `index.ts:123-134` + `resolve.ts:67-79`（win32 才探装机路径，否则 PATH 回落）；受限臂=pwsh-sandbox `index.ts:52-53,194-196` → sandbox-local `index.ts:160-166`（win32 单候选 windows-acl，**无探针**）；我方 plane=pwsh ∈ `PLANE_RESERVED_NATIVE`（team-tool-plane.mjs:405）但 takeover 表（:465-479）无 pwsh 臂、`names.bash='pwsh'` typed 拒（:492-495，注释 :326-337）——Team 内 pwsh 无治理接管行，仅宿主继承面 win32 条件静态路线；lane/envelope 词汇臂含 pwsh（:524；admission/envelope.ts:182 令牌分立）。**以上=静态可达入口，非运行时能力**。win32 条件腿宿主可用性维持原判：本宿主(Linux 6.8.0-142, pin639)无 `pwsh`/`powershell`、binfmt_misc 零条目、无 wine ⇒ **ENV-NOT-AVAILABLE**（证据 `dev/agent-workflow/evidence/alpha5/m2-mount-audit/raw/task2-env-probe.txt`；禁跑该腿≠provider 否定；宿主 loader.spec.ts:39 skipIf 属**无 Team/无 sandbox 组成正控，skip≠pass**）；定位正本=`dev/agent-workflow/evidence/alpha5/m2-win-acl/LOCATE-REPORT.md`

**⑦ 建议措辞**（保留原两句，追加）：

> Windows/provider 对等未证明（B-PROCESS 冻结原文："pwsh必须真实Windows provider与同等保证，不能复用bash已验收断言"）；**宿主自身标该腿 partial**：sandbox-local `index.ts:188` `STATIC_ENFORCEMENT['windows-acl']='partial'`；其 enforcement 只覆盖写/删（capability SID 写 ACE+Low no-write-up+`FILE_DELETE_CHILD` deny，acl.ts:8-15,408），**读、网络、进程可见性无 enforcement 点、hardlink 路径别名无收敛点**（index.ts:26-28、README.md:125-126 原文自述边界）；⇒ **换任一 Windows runner 亦不因此获得同等保证**（Host639 ACL=partial 为在册根结论；本行不得外推"同等保证"，亦不得反向据此否定 provider 存在性）；S0 条款"OS 支持范围外 unsupported"=设计文本非 9b2 实测，不扩大为全 provider 断言

---

## 不确定处

1. 本宿主无 win32 环境：§一/§二全部为静态阅读；win32 上注册实际生效序（Loader 对 `disabled: !!js` 的求值、runner 探针、probe.spec/control.spec 等平台套件行为）**未运行验证**。
2. hardlink 越界的**具体可复现链**（先有外部文件、以何权限建链）未实测亦未在本卡推演为结论——只引用包自身 README.md:126 与 runner.ts:19 的在册边界；README.md:128-129（standing Low label 对同用户 Low-IL 其他进程的写面放大）为同包在册边界，本卡未展开。
3. `sandbox-local:182-187` 注释提"Everyone stays in both restricting lists"的 keep-alive 组合细节未逐行展开（超出本卡四要素）。
4. AppContainer-ACL'd 树"对子进程不可读"（README.md:125/126 并列提及）属读面**收紧**方向的边界，非缺约束方向；本卡未对 AppContainer 路径展开定位。
5. 宿主 `read-only` 模式下 shell 写拒是否覆盖 hardlink 别名场景，源码只有文档级自述（README.md:70 "same documented boundaries"），无运行证据；不作通过/失败断言。
