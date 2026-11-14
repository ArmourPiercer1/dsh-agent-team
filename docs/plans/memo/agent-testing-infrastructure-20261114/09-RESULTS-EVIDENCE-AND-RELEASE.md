# 09 — Result、Evidence、CI Verdict 与 Candidate C2 的边界

[返回索引](README.md) · [组件权威](02-ARCHITECTURE-AND-AUTHORITY.md) · [不变量](12-INVARIANTS-AND-NEGATIVE-CONTROLS.md)

## 1. 禁止两个常见的错误等价

- `suite green` ≠ `完整计划已执行`；执行了部分任务得到的绿无法证明全量验证完成。
- `CI PASS` ≠ `Candidate FROZEN`、`C2 PASS`、`发布授权`。冻结只固定 commit/ref/tree/digest，C2 是另一个审批/认证流程。#760 的 `C2_A_AND_B` 不等于双 reviewer eligible，更不能直接视为可发布。

此设计不会创建新的 Candidate authority，也不更改已有验收记录。

### 1.1 证据配额（硬约束）

`.json` 证据受 `scripts/integration-order.mjs` 的 `BOUNDS.maxCandidates = 6000` 约束（当前已提交 5995 个，剩 5 个名额）。因此：新证据默认用 `.md`/`.txt`/`.tsv`；同一次运行的多个 JSON 合并成一个文件再提交；任何新增 `.json` 必须先证明配额仍有余量，否则 integration-order 审计会把 PR 判红。这不是风格偏好，是会让门禁拒绝的硬上限。

## 2. 测试执行的终态集合（建议）

| Run terminal | 定义 | L2 必需任务能否视为通过 |
| --- | --- | --- |
| PASS | 验证任务完整执行，所有检查通过 | 是 |
| FAIL | 有实际断言失败或安全违例 | 否 |
| INCOMPLETE | 期望任务缺失/只有部分数据/重复汇总 | 否 |
| INFRA_ERROR | Runner、World、宿主或观察器不可用，无法作可靠判断 | 否 |
| CANCELLED | 中途取消或超时导致结果不可证 | 否 |
| SKIPPED_BY_PLAN | Policy 允许在当前层跳过且有理由 | **L2 census 不允许** |

Contract Oracle 独立返回 SATISFIED/VIOLATED/INCONCLUSIVE/INSTRUMENT_ERROR；映射至测试终态由预定义 Policy 管理。不能通过“异常被 try/catch 后返回 success”吞掉执行错误。

## 3. 统一 Run Record（版本化、可复现、与原始报告有链接）

~~~json
{
  "schema": "verification-run/1",
  "identity": {
    "base_sha": "<40-hex>",
    "head_sha": "<40-hex>",
    "merge_tree_sha": "<40-hex>",
    "host_sha": "<40-hex>",
    "product_build_digest": "sha256:<digest>",
    "catalog_digest": "sha256:<digest>",
    "plan_digest": "sha256:<digest>",
    "policy_digest": "sha256:<digest>",
    "environment_digest": "sha256:<digest>"
  },
  "execution": {
    "tier": "L2",
    "expected_task_ids": ["<task>"],
    "observed_task_ids": ["<task>"],
    "task_results": [{"task_id": "<task>", "status": "PASS", "evidence_ref": "<ref>"}]
  },
  "verdict": "PASS",
  "provenance": {
    "actions_run_id": "<id>",
    "artifact_sha256": "sha256:<digest>"
  }
}
~~~

示意字段不需要立即落地全部可选项；但 `merge_tree_sha`、`host_sha`、`catalog_digest`、`plan_digest`、task identity 和所有必需任务的结果不得省略。Plan JSON 应 canonicalize 以便 digest 能复现。不得从 READMEs 中的“PASS 11/11”推断这些字段。

## 4. Trace 及 Evidence 存储策略

- **日常 L1/L2**：保留机器汇总、失败时的结构化 Trace/World snapshot；体积大的原始输出通过 GitHub Actions artifacts 保存，并给出可检索 run id / artifact digest。
- **成功时**：记录摘要、必要的安全 negative witness 和关键输入身份；必要时允许压缩或抽样细节，但不得丢失用于核验关键合同的必需证据。
- **候选 C2/发布**：引用不可变 Run Record 与身份，按现有冻结/验收政策保留更强证据；不能只上传不稳定的过期 artifact URL 作为唯一永久证据。
- **旧历史**：保持原样不追溯重写，按新格式约束后续记录。

#761 的 `--numstat` 将新增文本行数误当字节，因此 M0 应重新统计 git blob 实际大小和 worktree 体积，再讨论 2 MiB 事故护栏。证据预算不能成为压缩或隐瞒真实 FAIL 记录的理由。

## 5. FAIL、重试和 flaky 测试

- 重试原因必须记录 `infra retry` / `suspected flaky` / `product rerun`，同时保留首次失败。
- 不能为了让 Required check 绿而无限重跑；同一测试结果时好时坏时，应产生“不稳定”事实，不能自动归类为普通 PASS。
- 要有缺陷隔离/降级准则，但安全关键合同不得不经 Owner 裁决转成非阻塞。
- 数量上区分 file/suite/test case/census task/contract，不混用 denominator。

## 6. 正式发布链

~~~text
L2 CI PASS (code quality for exact merged tree)
  -> master integration
  -> immutable Candidate identity
  -> C2 A and B independent review / identity / evidence checks
  -> explicit owner release decision
  -> release asset / pinned install verification
~~~

参考 #763 的 git-install / packaged-identity live gate：继续与本工程 CI 分离，不能把一次 DEV-LIVE smoke 当 C2 授权。对 0.2.0-rc.2 当前宿主及未来 0.2.2 目标宿主分别输出验证结果，不跨宿主拼接 PASS。
