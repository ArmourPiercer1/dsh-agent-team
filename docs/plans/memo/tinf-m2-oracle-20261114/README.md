# TINF M2 — Scripted Model、独立副作用 Witness 与 Contract Oracle（shadow）

> Dated: 2026-11-14 · Status: **IMPLEMENTED (shadow draft PR)** · 设计正本：`docs/plans/memo/agent-testing-infrastructure-20261114/05-SCRIPTED-MODEL-AND-ORACLE.md`（PR #767，merged `f24c41337`）
> 前置：M0（PR #768）修好测量工具；M1（PR #769）让测试集合可见。M2 只补“确定性模型输入 + 独立证据 + 判定器”三件仪器，不接管任何 lane。

## 1. 一句话

把“模型说了什么”从安全测试里拿掉，把“系统实际做了什么”变成独立观测：Scripted Model 固定模型 I/O，FS Witness 在 host 之外看文件变化，Contract Oracle 只在这两个通道都可信时才给 `SATISFIED`。
**本 PR 与 M1 一样是 shadow**：新增的判定器没有被任何 gate、workflow 或 lane 调用；代码上线不改变任何现有测试结果。

## 2. M2 交付

| 文件 | 内容 |
| --- | --- |
| `packages/testkit/src/scripted-model.ts` | `agent-script/1` 校验、`ScriptedModelAdapter extends LlmAdapter`、`assertComplete()`；四类拒绝码 |
| `packages/testkit/src/effect-witness.ts` | `EffectWitness`、`createFsWitness()`、`createBlindWitness()`；诚实披露 `blindDomains` |
| `packages/testkit/src/contract-oracle.ts` | `contract-oracle/1` 输入、`judgeContract()`；四态判定 + `limitations` |
| `packages/testkit/test/m2-*.test.ts` | 26 条负控/正控（8 + 6 + 12），全部 in-process |
| `packages/testkit/src/index.ts` | 三个模块的 public 名称随 `PACKAGE_ID` 一起导出 |
| `packages/testkit/test/p4t6-bookings/tinf-m2.json` | p4t6 扫描账本登记：新增 6 个 `packages/**` 文件，total 1511 → 1517 |

p4t6 的扫描账本要求每个新增 `packages/**` 文件登记；不登记会让既有 `p4t6-session-event-scan` 红（这是新文件导致的真实回归，必须随本 PR 修掉，不是 flake）。

## 3. E1 已经做到的 vs 仍必须 E2 的

**E1（本 PR，进程内）**：脚本结构匹配（`tools_include` 对 `GenerateOptions.tools`，`contains_text` 对序列化 messages）；真实 `StreamChunk` 协议（block-start/delta/block-end/usage/finish）；对 `outside/` 的构造时快照与 observe 时 diff；四态判定与负控灵敏度。

**仍需 E2（真实宿主/OS）**：
- **真实 confined subprocess / OS fidelity**：M2 的进程/网络 witness 尚不存在，FS witness 只能证明“声明目录里没有新/改文件”，不能证明没有进程、PTY 或网络出口效果。
- **Host restart / durable ledger / recovery**：本 PR 不启宿主、不读 ledger、不验证 crash window；事件序列是调用方喂进来的，不是从真实 host 读出来的。
- **真实审批与授权边界**：scripted model 只替换模型，不替换 router/approval/executor；M2 没有把它们接到一起跑（这是 lane 接线，不是 oracle 逻辑）。
- 因此 M2 的 `SATISFIED` 严格限定在 `requiredEffectDomains` 内，且不能外推到未接入的效果域。

## 4. 四个 verdict 与触发顺序

| verdict | 何时触发（按实现顺序，先到先判） |
| --- | --- |
| `INSTRUMENT_ERROR` | `event_seq` 不严格递增；event/witness 字段缺失或类型错误；`witness` 为空 |
| `INCONCLUSIVE` | 必需域没有 witness 观测；**必需域被 witness 自己声明为 blind**（矛盾输入不算通过）；**必需域的行没有 `instrumented: true`**（仪器自己说看不见）；trace 没有 computed/denied 事件；deny 合同没有 `DENIED`；有授权副作用但本 oracle 不给“授权效果”发 PASS；**在未评估域观测到副作用**（不能当作没发生） |
| `VIOLATED` | 有 `DENIED` 且必需域真的观测到副作用；`DENIED` 事件自带 `effect_id`（自相矛盾）；`DISPATCHED`/`COMPLETED` 的 `authority_ref` 为 null 且观测到副作用；`authority_actor_id` 与 `actor_id` 不同（**决策签发给另一个身份**） |
| `SATISFIED` | 仅当每个必需域的观测行 `instrumented: true` 且 `observed: false`，且 deny 合同有 `DENIED` 决策事件 |

顺序本身是安全设计：后面的“有趣发现”不能覆盖前面的“仪器不可信”。

## 5. 规则：日志文本不是证据

`DENIED` 只是一行系统自述，不是“效果没有发生”的证明。实现里只有一道真正起作用的闸，但它比“声明 blind”强得多：

**每行观测都带 `instrumented`（能力声明），由 witness 实现写，调用方写不了。** oracle 要求必需域存在 `instrumented: true` 的行，`observed: false` 才会被当作“干净”。所以：
- 调用方可以伪造一行 `{observed:false}`，但伪造不了 `instrumented: true` 的仪器；
- 一个“全盲”的 witness 即使 `blindDomains` 传空数组，也会落进 `INCONCLUSIVE`；
- 反过来，如果有人往 witness 里塞一行假的 `network`，那行必须是 `instrumented:true` 才可能被采信 —— 而真正的 FS witness 永远只对 `filesystem` 声称 `instrumented:true`。

（第一版曾宣称“两道硬闸”，其中“所有域都 blind”那条经审计证明不可达，因为它被“必需域未接入”先一步覆盖。现在只保留一条会被测试真正走到的规则，并且有负控证明它拦得住。）

所以 **trace-only 判定必须是 `INCONCLUSIVE`**；`SATISFIED` 必须由独立 witness 的反证支撑。`limitations` 在每个 verdict 上都列出未接入的效果域（FS witness 场景下是 `process, network`）。

## 6. 负控表（测试名 = 实际 `it()` 名）

| 目标 | 精确测试名 | 期望 |
| --- | --- | --- |
| 文本轮 happy path | `happy path: a text turn streams one text block, usage, then stop` | stop |
| 工具轮 happy path | `happy path: a tool-call turn streams one tool-call block and finishes tool-calls` | tool-calls |
| 多一次调用 | `an extra stream call is SCRIPT_EXHAUSTED` | `SCRIPT_EXHAUSTED` |
| 工具不匹配 | `a wrong tools_include is SCRIPT_UNEXPECTED_REQUEST naming expected and seen` | `SCRIPT_UNEXPECTED_REQUEST` |
| 少消费一轮 | `a leftover turn is SCRIPT_UNCONSUMED_TURN listing it` | `SCRIPT_UNCONSUMED_TURN` |
| 非法脚本 | `invalid scripts are SCRIPT_INVALID across every schema violation` | `SCRIPT_INVALID` |
| 无写入 | `no writes: filesystem effect is not observed` | `observed:false` |
| 新建文件 | `a file created under outside is observed with its path in evidence` | `observed:true` + path |
| 修改文件 | `a file modified after construction is observed` | `observed:true` |
| 诚实盲域 | `process and network are reported blind, not clean` | `blindDomains=[process,network]` |
| 证据上限 | `evidence is capped at 20 changed paths and flags truncation` | 20 + `truncated` |
| **灵敏度**：witness 被弄瞎 | `the blind wrapper makes a real write invisible` | 同一写入对盲仪器不可见 |
| **灵敏度必须被判**：盲仪器 + 真写入 | `a blinded witness cannot talk the oracle into SATISFIED` | `INCONCLUSIVE`，理由点名 `filesystem` |
| 伪造观测行（无能力声明） | `fabricated rows without instrumented cannot be graded SATISFIED` | `INCONCLUSIVE` |
| 伪造一个 network 行 | `an invented network row cannot cover a blind network domain` | `INCONCLUSIVE` |
| `DENIED` + `effect_id` | `a DENIED event carrying an effect_id is VIOLATED even with a clean witness` | `VIOLATED` |
| 域外副作用 | `an effect outside the graded scope is INCONCLUSIVE and named, not dismissed` | `INCONCLUSIVE` + 理由/limitations 点名 |
| 决策 id 不是身份 | `a decision id in authority_ref is not an identity mismatch` | `SATISFIED` |
| 声明 blind 与能力声明矛盾 | `a domain declared blind cannot be graded even if a row claims instrumented` | `INCONCLUSIVE` |
| 同尺寸改写 + 还原 mtime | `a same-size rewrite with a restored mtime is still observed (content digest)` | `observed:true` |
| 新建空目录 | `a new empty directory is observed` | `observed:true` |
| 新建符号链接 | `a created symlink is observed (recorded, not followed)` | `observed:true` |
| 取消（abort） | `an already-aborted signal refuses the call and consumes no turn` | 抛 abort 且不消费轮次 |
| 拒绝 + 无效果 | `no effect + DENIED + full instrumentation is SATISFIED` | `SATISFIED` |
| 拒绝 + 真副作用 | `DENIED plus a real effect is VIOLATED` | `VIOLATED` |
| 缺必需域 | `a missing required domain is INCONCLUSIVE` | `INCONCLUSIVE` |
| 序列回退 | `a sequence regression is INSTRUMENT_ERROR` | `INSTRUMENT_ERROR` |
| 全盲 | `all domains blind can never be SATISFIED` | `INCONCLUSIVE` |
| 跨身份 authority | `a wrong-actor authority_ref is VIOLATED` | `VIOLATED` |
| trace-only | `a trace-only input (witness reports everything blind) is INCONCLUSIVE` | `INCONCLUSIVE` |

## 7. 与书面 spec 的偏差（由真实 `dsh-llm` 类型强制）

- 工具 block 的 wire 类型是 **`'tool-call'`**，不是 `'tool_use'`（`ContentBlockMap` / `ContentBlockType`）。
- chunk 顺序是 **`usage` 在 terminal `finish` 之前**，依据 `StreamChunk` 的公开注释 “Adapters emit usage before the terminal finish and nothing afterward”；spec 第 3 节的 finish→usage 顺序与 d.ts 冲突，按 d.ts。
- “Usage” 的真实类型名是 **`TokenUsage`**。
- 工具 block 仍按 spec 用 index 1（text 用 0）；`BlockAssembler` 允许任意首见 index，故合法。
- `LlmAdapter.providerInfo()` 基类默认返回 `{id: provider, name: provider}` 已满足接口，故**没有 override**。
- `stream()` 遵守 `options.signal`（d.ts 要求）：已 abort 的调用直接抛 `AbortError` 且**不消费**任何轮次。spec 没写这条，但适配器契约要求。

## 7.1 见证通道的已知极限（写在代码里，也写在这里）

FS witness 比较两个时间点的快照，因此：
- 在两次 `observe()` 之间**创建再删除**的文件不可见；
- 通过**符号链接**写到被监视目录之外的目标，只能看到链接本身变化（不跟随链接是刻意的：跟随等于替调用方观察另一棵树）；
- 大于 4 MiB 的文件只按 size+mtime 比较（不为此每次观测去哈希 GB 级文件）；4 MiB 以内含 sha256 摘要，所以“同尺寸改写 + 还原 mtime”能被抓到（有负控）。
这些是通道的极限，`limitations` 会写出来，任何判决都不允许把它们读成“干净”。

## 8. 未做（明示）

- **未接入任何 lane / workflow / gate**：没有步骤读这些文件，PR 是 shadow。
- **没有 host boot**：不启 DSH、不建 DSH_HOME、不占端口。
- **没有进程/PTY/网络 witness**：`process`/`network` 一律 `observed:false` + `blindDomains`。
- **没有 census / catalog 语义变化**：新测试被既有 `packages/testkit/vitest.config.ts` 自动收集；`--max-uncollected` 前后均为 **91**。
- 没有 durable ledger、crash window、host restart、真实审批链；这些属 E2（后续 M3/M6）。

## 9. 复现

```bash
cd packages/testkit && npx tsc -p tsconfig.json          # 0 errors
npx vitest run packages/testkit/test/m2-scripted-model.test.ts \
  packages/testkit/test/m2-effect-witness.test.ts \
  packages/testkit/test/m2-contract-oracle.test.ts        # 26 passed
cd packages/testkit && npx vitest run                     # 全包
node --test scripts/test-catalog.test.mjs                 # 19/19
node scripts/test-catalog.mjs --max-uncollected 91        # uncollected 不增长
```

全包（从仓库根跑 `npx vitest run packages/testkit`）在本 worktree 仍有 4 个
**与本 PR 无关的环境失败**：`plugin-dsh-compat`（本 worktree 没有
`tests/deepseek-harness-test-use` pin 检出）、`a4p7-merge-gate` 的三条
（composition smoke 的宿主配置、runtime 的 `tsc` 因缺少根 `@types/node`
符号链接失败、client lane 基线失败）。M2 自己的 3 个文件 26/26 绿，扫描型
`p4t6-session-event-scan` 也因新增 booking 恢复 20/20 绿；全包的其余 32 个
文件通过。
