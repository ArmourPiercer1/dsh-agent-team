# 浏览器插件诊断与自动化方案 — 只读证据报告

- 日期：2026-10-01（UTC）
- 会话性质：**独立诊断会话，以只读为主的分析**。本轮零安装、零系统策略变更、零浏览器启动、零委派、零 push。
- 写入范围精确化：**不声称"纯零写企图"**。一次 `npm view` 元数据查询由 npm 自行尝试写缓存而在只读绑定上得到 `EROFS`（边界见 §1），随即停止，**未提权、未改缓存目录绕过**。本轮**实际持久写入 = 本报告的创建与后续修订**，仅此一处（工作区内的 `evidence/` 新目录）。
- 运行环境：`dsh-plugin-dev`，`dsh.service`（systemd slice `system.slice/dsh.service`），uid 1000
- 稳定实例红线：`:3080` 及其 DSH_HOME **全程零操作**（仅读取其 profile 内的插件安装物与配置结构）

---

## 0. 权限恢复状态确认（第一步）

| 项 | 实测值 | 来源 |
| --- | --- | --- |
| DSH 文件策略 | `workspace-write`（仅 `/srv/workspace/dsh-plugins/dsh-agent-team` 可改） | 运行时快照 |
| 审批策略 | `ask` | 运行时快照 |
| 外层 wrapper | `bwrap --ro-bind / / --dev /dev --unshare-pid --proc /proc --die-with-parent --tmpfs /tmp --bind <workspace> <workspace>` | `/proc/1/cmdline` |
| rw 绑定集合 | **仅** workspace 与 tmpfs `/tmp`；`/` 为 `ro,nosuid,nodev` | `/proc/self/mountinfo` |
| NoNewPrivs | `1` | `/proc/self/status` |
| capabilities | `CapInh/Prm/Eff/Bnd/Amb` 全 `0000000000000000` | `/proc/self/status` |
| AppArmor label | `bwrap//&unpriv_bwrap (enforce)` | `/proc/self/attr/current` |
| 越界写实测 | `~/.dsh/profiles/web`、`~/.bsk/dsh-starts`、`~/.local/bin` 均 **NOT writable** | `access()` 探测（未创建文件） |

要点：本模式的隔离由 **mount 层**（`--ro-bind /` + 单一 rw bind）强制，而非仅靠策略提示。与本轮临时完全权限阶段的外层 wrapper 不同（该阶段无此 ro-bind 约束）。**本轮未再请求任何提权，未设置 `sandbox_permissions`。**

---

## 1. 证据边界纠正（对上一批口头结论的更正）

| 上一批说法 | 纠正后的可主张范围 |
| --- | --- |
| "本会话没有 `browser_*` 工具可调用，原因是懒注册" | **错误**。本会话工具目录**自始**就含 `browser_session / browser_page / browser_inspect / browser_interact / browser_tabs / browser_assist` 六个 schema（与插件 `BROWSER_TOOL_SPECS` 一致）。我无法从会话内部区分这是 `lazyTools` 已揭示、还是历史恢复所致。**工具曝光**与 **`bsk` 缺失**是两件独立的事，前者成立不代表后者成立。 |
| "`find -xdev -maxdepth 7` 证明整盘不存在 bsk" | 只能主张：在**已查范围**内未见。范围 = `$PATH` + `/home/user` + `/srv/workspace` + `/usr/local` + `/opt` + `/usr/bin` + `/root` + `/var/tmp`（第二轮显式列出、并单独遍历所有 `node_modules/.bin`）；`/usr/lib/node_modules` 不可读。未覆盖：未挂载卷、其他 PID/mount namespace、其他 OS 用户目录、`/usr/lib/node_modules`。 |
| "空 owner journal 证明从未启动任何会话" | 只能主张：`~/.bsk/dsh-starts/e489a24486282f90700c395a/290972-f4ac3f12-…/` **无记录文件**，且 owner 前缀 pid 290972 = `:3080` 宿主自身，形态与 `DiskStartJournal.recover()` 建 owner 目录一致。这是**与该 owner 目录范围一致的空记录**，不构成"任何会话从未启动"的全局证明。 |
| "lib 无 unsafe flag ⇒ 该路线沙箱安全 / AppArmor 对整条路线不适用" | 只能主张：**已发行 `lib/` 内**无 `--no-sandbox` / `--disable-setuid-sandbox` / `--disable-gpu-sandbox` / `playwright` / `puppeteer` 字符串。外部 `bsk` CLI、扩展、被控浏览器的**有效沙箱状态未被本次检查证明**。条件性成立：*若*复用另一台已安全运行的浏览器，则该路线**避免在本 VM 本地 launch**，从而不触发本 VM 的 userns 限制——这不是"AppArmor 与该路线无关"。 |
| "remote 全无" | 撤回。已枚举范围 = 监听 TCP（`ss -ltn`）+ 名字含 bsk/browser/chrom/cdp 的 unix socket + 环境变量 + `profiles/web` 的 bundle/patch 配置。未做：全量 unix socket 审计、任何外部主机探测、上游 server 侧配置审计。 |
| "目录 mtime = 安装时间" | 撤回。`.14:11` mtime 只是解包/写入痕迹；安装动作的直接证据是 `.plugin-manager/logs/operation-04gDeG/pnpm.log` 中的 `+ @wxg-prc-cpg/browser-skill-dsh-plugin ^0.3.2`。 |
| "插件唯一 exec() 是 PID 存活判定" | 更正：`lib/index.mjs:2930` 的 `.exec(` 是 **`String.prototype.exec` 正则方法**，非 `child_process.exec`。真实 spawn 面 = `lib/index.mjs:7` `import { spawn } from "node:child_process"` → `createBskRunner`（`lib/index.mjs:2640`）→ **`lib/index.mjs:2668` `spawnImpl(bskPath, [...args, "--json"], …)`**。即插件的唯一进程创建面是 **bsk CLI**，不直接启动任何浏览器。 |

读取失败的边界（**未换路、未提权重试**）：
- `/sys/kernel/security/apparmor/profiles` → `Permission denied`。因此**已加载 profile 集合未验证**；文件存在 ≠ 已加载。运行期实据仅有 13:51:49 的 journal 内核记录（见 §4）。
- `npm view` 注册表元数据查询失败：`EROFS: read-only file system, open /home/user/.npm/_cacache/tmp/…`。该命令**本身会尝试写 npm 缓存**，而缓存路径落在 bwrap 只读绑定上 ⇒ 这是 **bwrap 只读绑定的本地失败，不是网络结论**，也不是"注册表不可达"的证据。触发后**立即停止**，未提权、未改用 `--cache` 指向 tmpfs 绕过。
  ⇒ 版本来源以本地 lockfile 为准；**注册表侧 integrity / 是否最新版 = 未核**（未取得，不下完整性结论）。

---

## 2. 实际安装物：是什么、启用到哪

| 项 | 实测 |
| --- | --- |
| 包 | `@wxg-prc-cpg/browser-skill-dsh-plugin` **0.3.2**（MIT） |
| 位置 | `~/.dsh/profiles/web/node_modules/@wxg-prc-cpg/browser-skill-dsh-plugin` |
| 启用面 | `profiles/web/package.json` → `dsh.profile.bundles` **含该包**，`dependencies` **仅含该包**；`cordis.patch.yml` 含 `- id: browserskill` 插入，**无 `config` 块** ⇒ 全部默认值生效 |
| 版本/完整性 | `profiles/web/pnpm-lock.yaml`：`specifier ^0.3.2` → `version 0.3.2`，`resolution.integrity = sha512-Z8m5KmNzCqc83M99q6pSPUwzFYr+RI4F1pQNCHp56rL/97Ogz7Z/YcWGEwYlvfSMWePjcib8aUQNpSVInW35AA==`。安装目录为真实目录（非 symlink）；`.pnpm/` 下仅有 `lock.yaml`。**离线无法复算 tarball 完整性** ⇒ 该 integrity 是安装期 pnpm 记录值，本次未独立验证。 |
| 上游 | `github.com/Tencent/BrowserSkill`，子目录 `packages/dsh-plugin-browserskill`；`publishConfig.registry = registry.npmjs.org` |
| 它**不是** | Python `browser-use`；也不是 DSH 自带 `packages/browser-use*` provider。后者存在于 `stable-2-0.1.7-rc.1 @ 46a7f68b09` 源码树但 **未挂载**（`profiles/web` deps 里没有）。**源码存在 ≠ 启用。** |
| 运行依赖 | `package.json` `dependencies = {}`（零运行时依赖）；能力来自**外部 `bsk` CLI + Chrome/Edge 扩展 + daemon** |
| `bsk` 状态 | 在 §1 所列**已查范围**内未发现 `bsk` 可执行文件；`command -v bsk` 空；`~/.local/bin` 只有 `uv`/`uvx`。上游 README：CLI 为 Rust 构建物（`crates/bsk-cli`），官方安装 = `curl … install.sh \| sh` → 默认落 `~/.local/bin`，**非系统包管理器路径**。 |
| 宿主 PATH 面 | 稳定实例由 `~/bin/start-dsh.sh` 启动（nvm 24.21.0 → `pnpm dsh web --no-open --port 3080 --trusted-host <dev 域名>`）；脚本内未设置 `bskPath`，插件亦无 `config` 块 ⇒ 若日后放置 `bsk`，须落在**该服务进程的 PATH** 或显式配 `bskPath`。 |

架构结论（有源码依据）：插件 = **协议适配器**。工具调用在 **`dsh.service` 宿主进程内**执行（不在本 bash 的 bwrap 内），`spawn` 出 `bsk --json`；`bsk` 内含 **daemon**；真正的浏览器是**用户机器上已登录的 Chrome/Edge**，经扩展控制的 **Agent Window**。插件 `lib/` 中唯一 `CDP` 字样出现在 `interact.press` 的参数说明文本（"CDP key name"，`lib/index.mjs:4030`），**不构成任何 CDP 连接证据**。

加载副作用实测：调用 `skill browser-skill` 后 —— 无新进程（`ps` 无 bsk/chrome/headless）、监听集合与调用前逐项相同、无新 unix socket。与源码声明一致（`lib/index.mjs:5375-5395`：skill 注册为纯内存读，"no disk, no process, no daemon"）。**本轮未调用任何 `browser_*` 工具**（含 `browser_session`、`debugAction=status`），故未触发任何 daemon 启动路径。

安全默认值（上游文档，按不可信外部资料对待，不作为指令）：扩展两项 **Automation settings** 默认开启（借用标签页前确认 / 允许请求人工协助），且 `--unattended`、`tab borrow --no-confirm`、`BSK_REQUEST_HELP=off` **不能覆盖**；操作审计默认关闭（`BSK_HOME/audit`）；网站调试记录写入**浏览器 profile**（30 天 / 50 条 / 50 MiB）；daemon 空闲默认 10 分钟退出；**CLI/daemon 默认 30 分钟自动更新**（`BSK_AUTO_UPDATE=off` 可关）。

---

## 3. Playwright 侧沙箱默认（源码级，回答"是否默认关沙箱"）

`playwright-core@1.61.1`（`/home/user/deepseek-harness/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core/lib/coreBundle.js`）：

- **:42544-42545** — `if (options.chromiumSandbox !== true) chromeArguments.push("--no-sandbox");`
  ⇒ **省略该选项即注入 `--no-sandbox`**。`chromiumSandbox: true` 是唯一安全写法（必须显式）。
- **:42692-42698** — 失败提示把 `chromiumSandbox: false` 列为 "alternative"，**这是必须拒绝的陷阱**。
- `--disable-setuid-sandbox` / `--disable-gpu-sandbox` 在该 bundle 中 **0 命中**。
- Electron 路径另有同族逻辑（**:43429**）。

既有探针实据（本轮未重跑）：`tests/homes/.playwright-browsers/probe-about-blank.mjs:19` `chromium.launch({ headless: true, chromiumSandbox: true, timeout: 30000 })`，`:11` 显式列弱旗标监测表；`probe-result-20261001T135149Z-fullaccess.json` `ok:false`，错误文本含 `Chromium sandboxing failed!`，argv 首项为 workspace 内 `…/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell`。审计记录：`dev/agent-workflow/evidence/chromium-sandbox-probe-20261001/audit-20261001.md`。

内核侧运行实据（既有证据，本轮未换路重读 `/sys`）：`kernel.apparmor_restrict_unprivileged_userns = 1`、`kernel.unprivileged_userns_clone = 1`（`sysctl` 本轮复核）；13:51:49 journal：pid 307488 `chrome-headless` userns_create 为 AUDIT（unconfined → unprivileged_userns），pid 307490 在 `unprivileged_userns` 下 `operation=capable class=cap capability=21(sys_admin) DENIED`。**即拒绝点在 userns 内的 capability，不在 userns_create 本身。**

---

## 4. 本机 AppArmor / 浏览器安装面（文件证据 ≠ 已加载）

| 项 | 实测 |
| --- | --- |
| `dpkg -l` | `apparmor 4.0.1really4.0.1-0ubuntu0.24.04.8`、`apparmor-profiles`、`libapparmor1` **已装**；**无** `google-chrome-*`、**无** `chromium*` |
| `/etc/apparmor.d/chrome` | 由 **`apparmor` 包 own**（`dpkg -S`）。内容：`profile chrome /opt/google/chrome/chrome flags=(unconfined) { userns, include if exists <local/chrome> }` ⇒ **exec-attach 路径匹配**，不是 PATH 匹配 |
| `/etc/apparmor.d/unprivileged_userns` | 同包 own；`audit deny capability`（全 capability）、`audit deny change_profile` ⇒ 与 §3 journal 的 DENIED 形态一致 |
| `/etc/apparmor.d/local/` | 无 `chrome` / `userns` 覆盖项 |
| `/opt/google/chrome/chrome` | **不存在**（`/opt/google` 整目录不存在）；`/usr/bin/chromium`、`/usr/bin/chromium-browser`、`/snap/bin/chromium` 均不存在 ⇒ **该 profile 在本机当前无可匹配可执行文件** |
| 已加载 profile 集合 | **未验证**（`/sys/kernel/security/apparmor/profiles` 读取被拒，未换路） |

---

## 5. 三方案对比（均为**方案**，本轮未执行任何一项）

### 现状公共前提
- 需求出处：`docs/plans/active/dsh-agent-team-pre-alpha3-refactor-plan.md` §E.12 "Real-host / browser gate"，DoD 第 18 项 "**browser Team tab / ledger / pending review**"。
- 仓库现有测试设施 = `tests/kits/*`（16 个 kit）与 `tests/characterization/`，**全部为真宿主 HTTP/进程级断言，无任何浏览器 kit**；端口约定 host 3182–3186 / mock+mini-MCP 3491–3500，`:3080`/`:3180` 零触碰。
- **PR53 writer 占用 testports，本轮零触碰**（只从日志读取端口约定文字）。

### A. 受控测试域名 → 隔离 testport（云浏览器 UI 验收）

| 维度 | 实测/结论 |
| --- | --- |
| 现状证据 | 仓库 `docs/` + `AGENTS.md` + `README.md` grep（`反代/reverse proxy/nginx/caddy/traefik/cloudflare/公网域名/云浏览器/https?://…`）**零命中**。本机 **无** nginx/caddy/traefik；`/etc/apache2` 目录存在但 `sites-available/*.conf`、`ports.conf` 无 `ServerName/ProxyPass/Listen/SSLEngine` 可用条目 ⇒ 未证明其在本方案中承担路由。唯一发现的实际域名 = 稳定实例启动参数 `--trusted-host dsh-plugin-dev-dots.astral-projection.xyz`，**这是 :3080 GUI 的路由身份**。 |
| 结论 | **所查文档与本机配置中未找到现成的隔离测试路由；本 VM 之外的外部反代状况未知**（不可从本机可见性推断其不存在）。因此**A 现状不是一条已具备、可直接使用的路线**；但也不作绝对"未具备"断言 —— 外部基建可能已存在而未在本机留下痕迹。按红线，**不得**用 `:3080` 的路由身份替代测试路由（那是稳定实例）。上游路由/隔离宿主/TLS 归属均在**本 VM 之外**，本轮无法自证。 |
| 必需变更 | 由基础设施 owner 提供：一个**独立**测试主机名 → 隔离 testport（3182–3186 族），带可核验的路由身份；或明确批准复用某现有测试域并留痕。**若走"新增测试反代"，这是一条有潜在网络暴露与权限影响的路线**（新公网可达面、证书与私钥保管、访问控制与日志边界），**必须 owner 与用户共同批准**；本报告**不**声称它"不引入任何入站监听或安全设置变更"。 |
| 权限/网络/凭据 | 需外部 DNS/反代写权限 + 证书；本会话无、也不申请。需要一次真实 host boot（3182 族，非 3080/3180）才能验端点。 |
| 如何证明 | (1) `GET /` 无 token → 401；带 launch token → 非 401，且**响应 Host 身份头/页面指纹**与 :3080 不同；(2) 路由后端 PID/端口 = 测试实例；(3) 浏览器内 UI 断言（Team tab / ledger / pending review）；(4) 事后 `:3080` pre==post（401，零操作）。 |
| 清理边界 | teardown 测试实例 + 释放端口 + 删除 `tests/homes/<world>`（按 TEST_METHODS §7，删除属影响面操作，需留痕）。 |

### B. 官方安装包路径 + 精确 AppArmor profile（本 VM 内本地 launch）

| 维度 | 实测/结论 |
| --- | --- |
| 现状证据（文件层面） | `apparmor` 包**自带**一个精确路径 profile：`/etc/apparmor.d/chrome`（exec-attach `/opt/google/chrome/chrome` + `userns`），以及 `/etc/apparmor.d/unprivileged_userns`（`audit deny capability`）。本机**缺的是位于该 exec-attach 路径上的可执行文件**。机理上这正是"不是单纯把 chromium 放进 PATH"：profile 按 **exec 路径** attach，Playwright 下载的 headless shell 在 workspace 内，与该 profile 不匹配。 |
| 条件性优势（非保证） | 若该 profile **确已加载**且 Chrome 的 exec 路径与依赖成立，则 B **可能减少额外策略编辑**（无需新写 profile）。**但这不是保证**：不能推出"一定无需新增/放宽策略"，也不能推出"装上必解决"。 |
| 候选最小变更 | 安装**官方签名包**使可执行文件精确落到 `/opt/google/chrome/chrome`（root 属主、agent 不可写）。启动侧 `chromium.launch({ channel: "chrome", chromiumSandbox: true })` **仅为候选**（`chromiumSandbox` 缺省即注 `--no-sandbox`，§3，必须显式 `true`），其可用性未测。 |
| 明确不推荐 | **不得**为任意 workspace 可写二进制新增/放宽 AppArmor profile（workspace = agent 可写，等同把 `userns`+`unconfined` 交给模型可投放的二进制，是权限逃逸面）。**不得** `apparmor_parser` 新 profile、**不得** `sysctl kernel.apparmor_restrict_unprivileged_userns=0`、**不得** setuid 复制二进制。 |
| 权限/网络/凭据 | **需 apt/root 与外部 apt 源访问 = 另批用户批准**（本会话红线：禁 sudo/apt/安装）。批准前须核验：包来源与**签名/校验**、官方 Chrome 包的**必要依赖**、以及它带来的**系统变更面**（新增 root 属主可执行文件、可能的仓库/钩子）。profile 侧是否真的零改动 = **待核**，不作为既定优点。 |
| 如何证明（须实测，不接受推断） | (1) 有界 30s `about:blank`，且 `chromiumSandbox: true` 显式；(2) **记录实际 argv** 并核对无 §3 弱旗标表任一项；(3) **有效沙箱机制的正向证据**：`chrome://sandbox` 或等效 renderer/进程层级证据 —— **不得**仅凭"没有 `--no-sandbox`"就断定各沙箱机制全部生效；(4) 目标进程 `/proc/<pid>/attr/current` 显示进入 `chrome` 而非 `unprivileged_userns`；(5) journal 无该 pid 的 `DENIED`；(6) 真实 UI 结果截图 + DOM 断言，而非仅"launch 成功"。 |
| 未验证（B 的成立前提，均**未测**） | (a) `chrome` profile **是否已加载**（§4 读取被拒）；(b) 官方 Chrome 包的依赖闭包/权限布局与安装后**实际沙箱启动行为**；(c) **在 bwrap + `unpriv_bwrap` profile stacking 之下**目标进程能否如期转入 `chrome` profile（本会话 shell 自身即处该 stacked label，宿主服务上下文是否相同未核）；(d) `channel: "chrome"` 在本仓 Playwright 版本上的解析结果。**若受限模式下仍失败：不自动切 full、不改策略、不放宽 profile** —— 停下报告，转由用户裁决。 |
| 清理边界 | 装包属系统变更，回滚 = apt 卸载；测试产物限 `tests/homes/`，证据入本目录。 |

### C. BrowserSkill 复用已存在且安全启动的浏览器

| 维度 | 实测/结论 |
| --- | --- |
| 现状证据 | 插件已装并挂载（§2），但**运行时引擎缺失**（§1 已查范围无 `bsk`）；`~/.bsk/dsh-starts` 该 owner 目录无记录；无任何 bsk/daemon/浏览器进程或 socket。**故 C 当前不可用，不是"接上就能用"。** |
| 形态约束（**条件路线，不是"唯一路线"**；纠正我此前对 C 的偏好） | 客户端 ↔ daemon 走**本机 IPC** ⇒ daemon 须与 agent/CLI 同机（本 server）。**本 VM 当前** headless、无带扩展的安全运行浏览器 ⇒ **就现状** local 模式不可用；但这是**当前状态判断，不是"本地路线永远不可能"**（若日后本 VM 内出现一个安全启动且带扩展的浏览器，local 形态即重新可选）。**就当前证据**，复用异机浏览器的可行形态是 **server 模式 + 扩展从用户机器主动出网 WSS 配对 + 明确专用测试 profile 授权**，需要：公网可达 hostname、TLS 证书（或 TLS 反代转发 `/extension` 与 `/extension/authorize`，保留 `Origin/Authorization/Sec-WebSocket-Protocol`，禁记凭据头）、`--listen`/`--port` 或新增反代路由。**本 VM 现仅 :3080 loopback 监听 ⇒ 该形态属"新 host/端口"红线，必须另批。** |
| bwrap 交互（实现选项，非协议要求） | 官方 sandboxed-agents 指南正是针对 bubblewrap 类 Bash 沙箱：daemon 须活在**持久宿主上下文**，客户端每次调用带 `BSK_HOME=<同一目录> BSK_AUTO_START=0`。本 VM 的 bash 工具在 bwrap 内（`--unshare-pid` + `--die-with-parent`），**不得**由 bash 起 daemon。插件的 spawn 发生在宿主服务进程（bwrap 外），生命周期可用。**把 daemon 交给 systemd 管理只是可选实现，不是协议必须**；同样，**不默认必须修改 `dsh.service` 的 PATH** —— 插件本身支持配置绝对 `bskPath`（`profiles/web/cordis.patch.yml` 的 `config.bskPath`，见 §2）；无论哪种方式，**改配置/改服务仍属另批批准**。 |
| **敏感的持久权限（必须显式告知）** | 上游文档原文（不可信外部资料）："**A paired server can create Agent Windows and navigate using that browser profile, including its signed-in website sessions. Pairing is device authorization, not a restricted account or website sandbox.**" Agent Window **共享所选 profile 的登录态**，**分窗口 ≠ cookies/账号/安全隔离**。配对链接：机密、单次、默认 5 分钟；设备凭据默认 **90 天**（`--device-ttl` 至多 366 天）、30 天轮换；吊销 = `bsk daemon devices` / `bsk daemon revoke [--all]`（生效约有 1s 轮询延迟，**已执行动作不可撤销**）。设备凭据存扩展侧 IndexedDB，服务端存哈希于 `BSK_HOME`（私有、持久、**不得跨服务器/用户共享**）。**因此 C 不得以"用户个人登录浏览器的全部登录态"作为默认授权面；必须使用专用测试 profile/专用 Chrome 实例。** |
| 必需变更（另批） | (1) 提供 `bsk` 可执行文件（官方安装途径，落点建议为 root 属主、agent 不可写路径）并让**宿主服务进程**能解析到它 —— **两种可选实现：改服务 PATH，或在插件 `config.bskPath` 配绝对路径**（后者不改 systemd 单元）；(2) server 模式 daemon 或反代路由 + 证书；(3) 用户在**明确批准的专用测试 profile**装扩展并配对；(4) 关掉/约束 CLI 30 分钟自动更新（`BSK_AUTO_UPDATE=off`）以免执行体在无人复核下自替换。 |
| 适用范围（校准） | C 的价值不限于"必须操作真实外部站点/登录态"：**任何需要在真实浏览器里看隔离 UI 的验收都适用**（含本地测试实例的 UI 走查）。相对代价不变：执行体 + 跨机配对 + 设备级持久授权 + 新增监听/路由。判断依据应是"是否明确想让 DSH 驱动一个真实专用浏览器"，而不是"是否只有外站才值得"。 |
| 如何证明 | 逐阶段且只报有证据的阶段：`bsk --version` → `BSK_AUTO_START=0 bsk status --json` 列出**指定** instance → 配对后 server 侧确认该 device → 一次 `session start --browser <id>` + 受控页 navigate/observe → `session stop`；DSH 侧改用注入工具复现同一生命周期。UI 结果 = Team tab/ledger/pending review 的 observe + screenshot。**注意 `bsk doctor`/`status` 成功≠技能发现，也不≠连接已建立。** |
| 清理边界 | `bsk session stop`（只停自己会话，**不得**停共享 daemon）→ 插件 `browser_session action=stop` 会归还借用标签页；吊销 = `bsk daemon revoke DEVICE_ID`（关既有连接）；删测试 profile；`BSK_HOME` 属持久私有数据，删除是影响面操作需留痕。调试记录留在**浏览器 profile** 内 30 天，导出副本须单独管理。 |

---

## 6. 建议（不含本轮执行）

1. **共同前提（三选一之外先接受的事实）**：**A、B、C 目前均不可直接执行** —— A 缺可核验的受控测试路由（本机不可见其外部反代），B 缺 root 级安装批准与一次真实安全验证，C 缺可执行文件 + 可配对的专用浏览器与新增网络面。本轮不提出任何 launch 探针：三条路的前提都不在本轮授权内，任何启动只产生已知失败，无新信息量。
2. **按"当前既有设施"的排序建议**：
   - **若基础设施 owner 能提供一条与 `:3080` 完全分离的受控测试路由 → 优先 A**：它最不需要在本 VM 内新增执行体、凭据或系统变更，一次搭好后 kit 可长期复用。**注意**：若实现方式是新增测试反代，则它**本身带来网络暴露与安全设置变更**，须 owner + 用户批准，不可当成零影响选项。
   - **否则 B 是本 VM 内自包含的候选**：改动集中在"一个官方 root 属主包 + 可能无需额外策略编辑（待核）"，不引入跨机凭据；但需 root 安装批准、包签名/依赖核验，以及一次**带正向证据**的安全验证（`chrome://sandbox` 或等效 renderer 证据 + profile label + 无 DENIED + 真实 UI 断言）。失败即停，不自动扩权、不改策略。
   - **C 适用于"明确希望 DSH 驱动一个专用真实浏览器"这一目标本身**：它当前需要的前提最多（执行体、TLS/新监听或反代路由、设备配对、专用测试 profile 授权），因此**不是当前最少前提的选择**；但它的适用面比"只为外站登录"更宽，通用隔离 UI 验收同样适用。选择它时必须接受分窗口共享 profile cookie 的事实与设备级持久授权，并落实专用 profile、到期与吊销纪律。
3. **两条绝对红线（本轮与后续均适用）**：`chromiumSandbox: true` 显式（缺省即 `--no-sandbox`）；拒绝 Playwright 提示中的 `chromiumSandbox: false`；以及**不得**为 workspace 可写二进制放行 AppArmor。

---

## 7. 精确源码/证据路径索引

| 主张 | 位置 |
| --- | --- |
| 插件唯一 spawn 面 = bsk CLI | `~/.dsh/profiles/web/node_modules/@wxg-prc-cpg/browser-skill-dsh-plugin/lib/index.mjs:7`（`spawn` 导入）、`:2640`（`createBskRunner`）、**:2668**（`spawnImpl(bskPath, [...args,"--json"], …)`） |
| `lazyTools` 默认 true | 同上 `:5455` |
| skill 注册无副作用 | 同上 `:5375-5395` |
| 6 个工具规格 | 同上 `:4422`（`BROWSER_TOOL_SPECS`）、`:4424/4458/4483/4537/4629/4666` |
| `bsk` 探针失败即降级为安装指引 | 同上 **:5506**（`bsk probe failed …; browser tools will report install guidance until the bsk CLI is available`） |
| journal 恢复（非启动证据） | 同上 `:2909-2955`（`DiskStartJournal`），`:2930` 为正则 `.exec` |
| Playwright 弱默认 | `playwright-core@1.61.1/…/lib/coreBundle.js:42544-42545`；提示文本 `:42692-42698` |
| 既有探针 | `tests/homes/.playwright-browsers/probe-about-blank.mjs:11,19`；`probe-result-20261001T135149Z-fullaccess.json` |
| 探针审计 | `dev/agent-workflow/evidence/chromium-sandbox-probe-20261001/audit-20261001.md` |
| AppArmor 文件 | `/etc/apparmor.d/chrome`（own by `apparmor`）、`/etc/apparmor.d/unprivileged_userns` |
| 浏览器 gate 需求 | `docs/plans/active/dsh-agent-team-pre-alpha3-refactor-plan.md:970`（§E.12）、`:1108`（DoD 18） |
| 测试端口/红线 | `docs/TEST_METHODS.md` §1/§3/§7；`dev/agent-workflow/SESSION_ROUTER_LOG.md:4319` 等端口守纪条目 |

## 8. 未验证清单（勿当结论使用）

- 运行中已加载的 AppArmor profile 集合（含 `chrome` 是否 loaded）。
- `bsk` 在**未挂载卷 / 其他 namespace / 其他用户目录**下的存在性。
- 上游 tarball integrity 的独立复算（离线不可得）；npm 注册表当前状态（本地 EROFS）。
- 上游 `browser-use-playwright-mcp` / `chrome-devtools-mcp` provider 自身的沙箱默认（其默认在各自 MCP server 包内，不在本仓源码；这三个 provider 未挂载）。
- `dsh-plugin-dev-dots.astral-projection.xyz` 的上游反代归属、TLS、可路由端口（在本 VM 之外）。
- 全量 unix socket 与出网策略审计（未做）。
