# write 切片"PA 开半边零消费 / FS 端口唯一消费"的真实 M1 映射（CENTER 亲读 @ pin639 宿主树 + 本仓）

根令：该断言必须附**真实 open / final edge / port 消费映射**供审，不得悄改权威。逐锚本仓与宿主树亲读如下。

| 段 | 权威真身（文件:行） | 事实 |
| --- | --- | --- |
| 开半边（open） | `packages/runtime/src/plugin/live/plane-effect-backends.mjs:1248` 链注 + `:1299` `gate = await pa.open(paCall)` | open 产出 `{request, grant}`，**不触碰消费边**；本片自己**不**调 open，`gate` 由上游注入 |
| 内核一次性消费 | `packages/runtime/tool-admission/admission-kernel.ts:187`（类型）/ `:582` 实现 / `:632` 出现在 kernel face | `consumeForExecution` 是 kernel face 的一次性边；`consumedCount()` 为其可观测计数 |
| FS 端口 = 该边的出厂封装 | `admission-kernel.ts:1015`（类型）/ `:1109`（实现）+ `:682` 注释「THE FS PORT is the kernel's own execution…」；`packages/runtime/controlled-fs/src/admission-binding.ts:196` 指向同一 PR2 `createFsAdmissionPort` | 生产端口工厂**由内核自带**，不是本片自造 |
| 本片唯一注入点 | `packages/tools/a5p5-tools/src/write-slice.ts:342`（`makePort` 缝）/ `:597` `admission: deps.makePort?.(gate.request, gate.grant) ?? refusingPort()` | 端口**只在此一处**成形；缺缝 ⇒ `refusingPort()`（拒绝而非绕过）；本片**无任何**直接 consume 调用 |
| 指纹权威复用 | `write-slice.ts:227` 注 + `:489` 注入 M1 `canonicalizeOperation` 投影 | 全计划冻结复用 M1 已验证事实物，本片零哈希代码 |
| 漂移律 | `write-slice.ts:575-588`（ANCHOR-DRIFT 注入缝 + 注：最终 FD 检查仍归 gated C-FS 车道） | 漂移 = stale 拒：零写、零消费 |

**本映射不证明的事（明写）**：① 权威未被修改——本批对 `plane-effect-backends.mjs` / `admission-kernel.ts` / `controlled-fs/**` **零字节改动**（`git diff` 为证）；② 未做 Host 运行腿，"零消费/唯一消费"由上述锚 + 修复轮 N 系列对**真实内核 ledger** 的 `consumedCount()` 断言支撑；③ plane 无 write takeover 行 ⇒ 生产 resolver/drift 臂**未接线** = `NOT_WIRED`。
