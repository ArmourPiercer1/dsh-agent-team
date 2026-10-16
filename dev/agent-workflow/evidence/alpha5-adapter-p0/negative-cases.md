# 反例台账（negative cases）— Alpha.5 P0 PoC

> 计划要求（guide §6.2）：反例是设计防护的证据，不是可提交产品行为。本表登记本轮**确定性复现**的反例及其证据。

| ID | 反例 | 预期（设计含义） | 实测 | 证据 |
| --- | --- | --- | --- | --- |
| NEG-1 | **lift-mask-under-race**：in-flight 调用停在 pre-execute 栅栏时"先撤 restrict、再卸 Adapter"（错误卸载序） | 危险时序实存 → 装配/卸载必须**原子有序**且 mask 寿命 ≥ adapter 与在飞调用（guide §3 P0-1 步骤 6） | dispatch 期晚期重解析（index.ts:1578）解析回全局原生体，**原体执行 1 次**（native=1）；对照组（先卸 adapter、mask 保留）native=0 | 01-routing/p01-runner.mjs `L3-hazard`/`L3-safe`，p01-result.json |
| NEG-2 | **agentless lane**：无 agent 作用域调用 | Team Adapter 只治理 scoped lane；agentless 走全局层 → binding 覆盖必须显式含此 lane（INV-1） | agentless execute 命中全局原体（ADAPTER=0/NATIVE=1） | 01-routing `L6` |
| NEG-3 | **原生读直通**（S-10）：fs-sandbox 只覆写 writeText/editText；bwrap `--ro-bind / /` | "受限读"不能靠原生 fs-sandbox 达成 → 受限读必须走新 Adapter/独立 FS 面 | 源码 CONFIRMED；本宿主 OS 级受限读 ENV_BLOCK（无法做正/负控闭环） | 00-baseline/source-map.md S-10；04-process/env-capability-matrix.md |
| NEG-4 | **未绑定 Scope 触达 Preset 工具名** | 非 Team/未绑定成员应 fail-closed | `Error: unknown tool "psp_grep"`，原体计数 0 | 00-baseline `P0-0.preset-topology` |
| NEG-5 | **run_code 命名冲突尝试** | 保留传输不可注册/遮蔽 | register 与 restrict 双侧 throw（含 run_code 字样） | 01-routing `L7` |
| NEG-6 | **早期 allow listener 试图绕过 guard** | guard 单调、不可被前段 allow force-allow | 仍 deny（`Error: team-guard-denial`），体计数 0/0 | 01-routing `L4` |

| NEG-7 | **同步面泄露 Promise**（SRCH-02）：若 Adapter 在必须同步返回 argv 的位置调用 async confine | sync/async 形状不匹配会产生不可用 argv（S-07 的可执行形态） | 未 await 时 argv[0]="[object Promise]"→spawnSync ENOENT（rg 实际未跑）；原对象直传 TypeError；awaited 正控 exit=0——原生体本就在同步 spawn 前 await（search-core.ts:238-239），Adapter 必须同型 | 02-search/p02-result.json observations.srch02_*，notes.md |
| NEG-8 | **R2 前置缺失形态**：无 subprocess 服务时挂载 tool-fs-search | 缺服务不应静默成功 | 不 throw 而是 fiber PENDING + tools.schemas()=[]（零注册悬挂）→ 装配必须显式校验服务存在，否则工具静默消失（"隐藏但仍可达/消失"辨别面的实证） | 02-search/p02-result.json observations.srch01_r2_prereq.exact_observable |

| NEG-9 | **LSP 池键=仅路径身份**（LSP-3/5/7）：同 workspace 路径、调用方策略不同的两个查询 | per-caller 策略无法进入池键/seam（types.ts:38-47 无 agent/policy 字段） | 同一常驻 pid 服务两个"策略"（opens=2）；不同路径 pid 分离（正控）；keyA===keyB demo 固化为可执行断言 → 每成员 ACL 隔离在 LSP 面**结构性不可表达**，安全兜底=严格 Profile 拒绝常驻服务器 | 06-lsp/p05-result.json L3/L5/L7 |
| NEG-10 | **LSP 服务器侧任意读**（LSP-4/6）：常驻服务器以自身 OS 权限经自定义 JSON-RPC 方法读任意路径 | provider 级任意方法=任意 I/O 面，不经 ctx.fs/Agent Scope | 虚构服务器 initialize 期与 $/p05ReadProbe 均成功读 forbidden（虚构敏感数据；host.ts:91 containment 只护宿主预读） | 06-lsp/p05-result.json L4/L6 |

| NEG-11 | **硬链接别名绕过 realpath**（FS-04.hardlink）：在允许子树内对被禁对象建硬链接 | "授权对象==访问对象"须按实际对象身份判定 | realpath(别名)=别名∈allowed（POSIX 硬链接无正本）→ 单 realpath 策略被绕；加 (dev,ino) 拒绝集后 ALIAS_DENIED、两路径 strace open=0 | 03-fs/p03-result.json FS-04.hardlink + notes §发现2 |
| NEG-12 | **未适配旁路**（FS-01.native-bypass）：注册一个未适配读工具 | 只要 T_dispatchable ⊋ T_governed，缺口立即可用 | bypass 工具经 get+schemas 实证 dispatchable 并直读 private 成功（strace=1）→ deny/适配并存是 FS 族任何结论的前置 | 03-fs/p03-result.json FS-01.native-bypass |

（P0-3 反例已收齐；无更多待入。）
