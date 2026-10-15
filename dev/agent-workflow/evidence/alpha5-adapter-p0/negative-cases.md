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

（P0-2/P0-3/P0-5 代理产出的反例由各自 notes.md 归入，收齐后在此追加行。）
