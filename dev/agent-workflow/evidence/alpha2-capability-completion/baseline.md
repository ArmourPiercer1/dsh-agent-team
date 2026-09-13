# alpha.2 capability-completion — 基线记录（2026-09-12，int @ 1e05d24）

> 计划 §2.1 要求的开发前记录。subagent 门禁基准：**不得新增基线之外的确定性失败**。

```text
BASE_SHA          = 1e05d24 (int/alpha2-capability-completion = master 合入 PR #7 后 tip)
计划冻结基线       = a99c21305dc1a712a9cd8be03bb078feca6e148a（其祖先；偏差 D-0 见审查文档 §2）
upstream pin      = a66e4702047846cdaa10c66c9d3df3951f5ea70d（tests/deepseek-harness-test-use）
pristine 复核      = porcelain 0 + HEAD 一致（2026-09-12 派发前）
int worktree      = clean（porcelain 0）
环境              = Linux x86_64 / node v24.21.0 / pnpm 11.7.0 / git 2.53；real vitest 可用
```

## Root suite — `pnpm test`（vitest 4，node env，threads pool，include `packages/*/test/**/*.test.ts`）

**280 files / 3330 tests：10 files / 20 tests 预存在失败**（基线；全量日志 `baseline-vitest.log`）：

| 包 | 文件 | 失败测试 | 性质 |
|---|---|---|---|
| domain | `t1-capability-schema.test.ts` | ×9（Legacy fixture / full capabilities / hash / selective mode 等） | 预存在（V2 backlog 前已登记族） |
| domain | `t2-blueprint-hash.test.ts` | ×1（projects absent optional singles as explicit null） | 预存在 |
| legacy | `p7t6-teammates-adapter.test.ts` | ×1（source scan：no runtime authority vocabulary） | 预存在 |
| runtime | `d3-member-identity-context.test.ts` | ×1（D3-4 FAIL CLOSED 场景） | 预存在 |
| runtime | `p6t3-mediation.test.ts` | ×5（mediation 端到端族） | 预存在 |
| runtime | `p6t3-restart.test.ts` | ×2（restart durability 族） | 预存在 |
| runtime | `p8s3b-result-effects.test.ts` | 文件级（module-scope 构造 glue 时 `root-base-tools-unavailable`：agentPresets dep 缺失） | 预存在（harness 环境类） |
| runtime | `t12a-b2-child-identity.test.ts` | 文件级（module-scope 加载） | 预存在（harness 环境类） |
| runtime | `t12a-glue-handoff-ports.test.ts` | 文件级（module-scope 加载） | 预存在（harness 环境类） |
| tools | `p6t6-actions.test.ts` | ×1（messaging worker→leader deliveredToSessionId） | 预存在（known debt，唯一 tools 失败） |

## Client-local suite — `cd packages/client && pnpm test`（含 `.tsx` jsdom spec，root include 不覆盖）

**47 files / 641 tests：1 file / 1 test 预存在失败**：

| 文件 | 失败测试 | 性质 |
|---|---|---|
| `team-creation-panel.client.spec.tsx:453` | TCM M4 two-stage v2（`admitMock` 期望 0 次实得 1 次） | 预存在 = `4c67da9` 潜伏 spec/实现失配，**裁决待用户**（test-infra-standardization 轮登记；修复二选一未裁决，本轮不得顺手修） |

**触碰 client/remote DTO 的任务（预计仅 A2C-3）**：必须额外跑 client-local 套件，失败不得超出 TCM-M4。

## p4t6 aggregate pin（`packages/testkit/test/p4t6-session-event-scan.test.ts`）

当前 pin = 690（master 状态）。subagent 新增可扫 `.test.ts` 文件会使其在独立分支变红 ——
**预期行为**（计划 §2.3）：subagent 只报告 expected scanner delta，不修改 pin；
主 Agent 在每个 integration tip 按 DEC-1 union 规则更新 pin 并跑 aggregate gate。
