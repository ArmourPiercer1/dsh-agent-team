# R-FAMILY-SCOPE-1 只读枚举清单（2026-10-29，边界 PoC 第一件；零代码改动）

方法 = 静态枚举 packages/{tools,runtime/src/plugin/live}/**.mjs（排 dist/node_modules）中 `hostService(...)` / `services.get(...)` / `ctx.get(...)` 调用点，按字面量名 vs 计算名分桶。

## 字面量服务名（各 Family 实际申报面）
| Family/模块 | 服务名 |
| --- | --- |
| agent-control-family | run_code |
| agent-state-family (fs-state-store) | dshHomePath |
| fs-family | attachments |
| ui-family | userQuestions |
| families/ 装配描述 | userQuestions, cordisInspect, attachments, llm |
| harness (tests 辅助) | webServer, teamRoot, set-cookie(非服务) |
| inspect-family | name/description/disable-model-invocation（配置字段，非服务查询） |

runtime live 面桥：jobs-family-bridge → get('jobs')×5、attachments、subagents、run、fs×4（jobs/fs 为 runtime 自有桥）。

## 真正的计算名透传点（本清单核心发现，全部三处）
1. `packages/runtime/src/plugin/live/team-tool-plane.mjs:1604` — `hostServices.ctx.get(name)`，:1629 以 `hostService: (name) => hostService(name)` 挂上 Family 能力对象 = **外部审查指认面：无按 Family 白名单**。
2. `packages/tools/agent-control-family/src/agent-runtime-port.mjs:149` — Family 内透传 `hostService(name)`；当前 Family 侧全部调用者传字面量（run_code 等），但函数面接受任意名。
3. `packages/tools/agent-state-family/src/fs-state-store.mjs:592` — 同上形态（当前调用面 dshHomePath 字面量）。

73 个"计算名"命中中其余均为 Map/Set 令牌台账与内部缓存（tokenLedger.get(tokenKey) 类），非服务查询——甄别记录在案，避免虚报攻击面。

## 结论（不改中心的可先行部分到此为止）
- 现实攻击链：无（受审导入 + 字面量调用面）；风险=**结构面**上第 1 点对任何 Family 能力持有者开放全部 ctx 名字，第 2/3 点为低危同形透传。`injected` 浅冻结 + `input.backends` 浅展开的对应披露成立。
- 加固需要中心能力契约（按 familyId 的允许名闭集 + 负控 + 具名 Center Interface PR + ARC-A/B/D 重验）= **needs_human 排队，本席位不启动**。
- 本清单价值：将来 Center Interface PR 的申报闭集直接以此为种子；任何新 Family 引入新字面量名时应更新本清单（评审门检查点）。
