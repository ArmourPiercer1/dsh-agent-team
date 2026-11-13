# 绿色到底证明了什么：L0 覆盖率与 claim→run 绑定

> **Dated**: 2026-11-13（UTC）· **状态**: 度量完成；两项提案待 owner 裁决
> **性质**: 设计 memo（`docs/plans/memo/`）；**不改 `ci-local.mjs` 的语义、不改 gate**
> **工具**: `scripts/coverage-audit.mjs`（只读，复用 `ci-local.mjs` 的 `classify()`）
> **证据**: `dev/agent-workflow/evidence/eng-l0-coverage-20261113/`

---

## 0. 两个「绿」都不够硬

1. **L0 绿**：`pnpm ci:local` 对约一半的已合并改动返回 `coverage=undetermined`（exit 2）。
   它不是失败，但也不是「本地已验证」——开发者只能推上去问 L1。
2. **文档绿**：约一半含 PASS/绿 断言的证据 README 里找不到 run id / commit / 摘要，
   读者无法从「PASS」走到「哪次运行」。

两件事同源：**「绿」被当成结论，而不是「绿的证据」。** 本 memo 量化两者，并给出不改变现有判定的提案。

## 1. A6：`ci-local` 的 undetermined 发生率 = 50%

对 `origin/master` 最近 40 个 first-parent commit（有 diff 的 40 个）：

| 结果 | 数量 |
|---|---|
| determined | 20 |
| **undetermined** | **20（50%）** |

导致 undetermined 的路径（Top 8，按出现 commit 数）：

| 次数 | 路径 |
|---|---|
| 4 | `tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs` |
| 3 | `tests/kits/a1-bash-governance-20261112/a1-bash-governance.mjs` |
| 2 | `.merge-loop.sh` / `.merge2.sh` / `.nbp.patch`（仓库根） |
| 2 | `tests/kits/*/compare-*.mjs`、`run-joint-acceptance.mjs`、`wp3-fence-timing.mjs` |

**原因不是产品代码**：`classify()` 有意只对 prose、`packages/**`、CI 家族与测试文件给出确定答案；
`tests/kits/**` 的 kit 运行器与仓库根的临时脚本没有规则覆盖，因此落入 undetermined。
这与 2026-11-12 的 `eslint.config.mjs` 修复同源——当时选择「诚实地说不知道」，现在要决定的是
**这些路径是否值得被命名**，而不是「是否要猜」。

### 提案 C1（owner 裁决）：把 kit 运行器命名为 `evidence-only`

- **做什么**：`classify()` 增加一类 `evidence`：`tests/kits/**/*.mjs`（以及 `tests/world-factory/drivers/**/run-*.mjs`）
  归入该类，`coverage=determined`，选中 0 个测试，并在输出中明示「evidence-only: N path(s)」。
- **理由**：这些脚本是**证据生成器**，它们的正确性由 run record 与其 README 证明，不由 CI 单测证明；
  现在 50% 的合并被 undetermined 覆盖，等于 L0 对一半工作没有结论，反而促使人们忽略 exit 2。
- **风险**：kit 脚本里的真实逻辑 bug 不会被 CI 捕获——但现在也没有被捕获，区别只是「明说」与「假装不知道」。
- **替代方案**：保持现状，在 `DEV-PR-WORKFLOW` 里教大家用 `--no-tests` 并说明理由（不改变工具语义）。

### 提案 C2（仓库卫生）：根目录临时文件不应被跟踪

`.merge-loop.sh`、`.merge2.sh`、`.nbp.patch` 出现在已合并 commit 的 diff 中。建议加入 `.gitignore`
（如果它们确实是本地临时文件），而不是为它们写分类规则。

### 提案 C3：不改 `ci-local` 的语义

C1 会改变 `ci-local` 的**覆盖率判定**，即使不改变任何检查。它属于开发工具语义变更，
**本 PR 不实施**；如 owner 采纳，应单独 PR，并在 `DEV-PR-WORKFLOW` 同步说明。

## 2. A5：claim → run id 的绑定率 = 约 52% 缺证据

对 `dev/agent-workflow/evidence/*/README.md`（192 份）做启发式扫描：

| 指标 | 数量 |
|---|---|
| 含 PASS / 通过 / 绿 断言 | 179 |
| 断言附近有 run id / commit / sha256 / 长数字 | 86 |
| **没有** | **93（52%）** |

口径是启发式的（正则匹配 README 内的 run-id、`runs/<id>`、`run-record`、sha256、长数字或 commit SHA），
所以 93 是上界，不是每个都真的缺证据——但足够说明：**「PASS」在多数 README 里不是一个可追溯的断言。**

### 提案 R1：证据 README 的 dated 头部固定三个字段

```
> **Verdict**: PASS 11/11
> **Run**: run-record.json | runs/43465510512 | commit 6361185d8
> **Reproduce**: node tests/kits/<x>/run.mjs
```

不是要求重写历史（**不retro-edit**），而是对**新证据**生效；文档校验可先做成 warn。

### 提案 R2：后续可加 checker

`docs:probe` 已经能扫 prose 断言；未来可对 `dev/agent-workflow/evidence/**/README.md` 增加一条
「dated 头部含 Run 字段」的 advisory。属文档校验面，需要单独 PR 与 owner 同意。

### 提案 R3：不追溯修改

已合并的证据按当时的规则写就；本提案只约束新证据。任何追溯重写都会破坏「证据是当时事实」的语义。

## 3. 与其它 PR 的关系

- 与 #760（冻结候选状态）同属「身份/验收分离」：那里区分 FROZEN 与 C2 记录，这里区分
  「检查是绿的」与「绿是可追溯的」。
- 与 #759（Draft-first）互补：L0 undetermined 是「为什么大家直接推 ready」的机制原因之一。

## 4. 验收

- `node --test scripts/coverage-audit.test.mjs` → 8/8；
- `node scripts/coverage-audit.mjs --self-test` → 4/4；
- 真树运行：`evidence/eng-l0-coverage-20261113/audit.txt`（50%）与 `claim-scan.txt`（93/179）；
- 未改 `.github/`、`dev/ci/`、`ci-local.mjs`、分支保护、Authority、候选 manifest/ref。
