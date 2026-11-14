# 10 — GitHub Actions 接入、Required 门禁和安全变更路径

[返回索引](README.md) · [分层](04-IMPACT-PLANNER-AND-TIERS.md) · [Census](07-CENSUS-SHARDING-AND-AGGREGATOR.md)

## 1. 当前需保持的现状

基于 master 2026-11-14：`ci-required.yml` 依赖 synthesize merge-tree、`ci-fast`、`ci-integration`、`ci-security`、`ci-product`、`ci-census`；在 Draft 中 census skip，`ci-required` 必须 FAIL，`ci-required-deferred` 才是 L1 判据。在 Ready 中必须运行 census，`ci-required` 聚合所有真实 `needs` verdict 并 fail closed。

受保护分支当前 Required contexts：`pr-gate`、`ci-required`、`pr-settlement-gate`。它们在 M0–M4 保持同名及相同合并阻止语义；外部接口先不动，内部逐步替换测试编排。

## 2. 理想调用形态（示意而非可直接粘贴 YAML）

~~~text
on pull_request
  synthesize-merge-tree
      ├─ fast: catalog + static + L1 selected tests
      ├─ integration/security/product: retained required rules and fast contracts
      └─ census (only when Ready):
           prepare pinned host / product build
           generate complete census plan
           matrix shards with separate Worlds (fail-fast=false)
           aggregate checks expected==observed
  always() grade required results
  when Draft -> deferred report, but ci-required remains red
  separate pr-settlement-gate reads dated settlement for exact head
~~~

确保 job-scope outputs、workflow_call 输出、需要的 `needs`、跳过/取消状态仍符合当前 `eb3-ci-required.mjs` 的安全规则。不能仅通过添加 YAML matrix 就绕过原有 manifest 形状负控。

## 3. Draft-first 操作原则与 ready-helper

从创建 PR 开始 Draft，L1 可多轮，完成独立评审与 settlement 后从最终 head 转 Ready。注意：`scripts/pr-ready-check.mjs` **目前只存在于未合并的 PR #759 分支**（`origin/master` 无此文件，`docs/DEV-PR-WORKFLOW.md` 同样只在 #759/#758 分支上）；它不是既有权威。M0 在 #759 的实现基础上重写并落地该 helper，修正五处假通过：未知 mergeable state 不能假通过（改为 refusal）；本地 HEAD 必须与 PR head 比较；无 upstream 不能算已 push；check-run 的 pending/newer verdict 不得沿用老 success（按 `started_at` 取最新一次尝试）；GitHub comments 必须完整分页。

该 helper 是开发辅助手段，不能替代服务端合并保护；未通过修复与负控前不得作为自动 Ready 的强制权威。

## 4. Selector 和 Gate 变更时的自举安全

PR 可修改测试代码、Catalog、CI manifest、Selector 和工作流自身。若直接运行 PR 新版 checker 并让它宣称“本 PR 的 CI 完整”，会出现自证陷阱。

迁移时采用：
- 将当前受保护 base 的 Policy/contract expectation 用于验证 PR 的新配置；
- 记录 base-policy 与 proposed-policy 的显式差异，增加“是否删除/减弱 required leg”的负控；
- 变更 Required contexts、工作流权限或 branch protection，需单独 Owner review，先 shadow，再切换；
- PR 工作流以 `contents: read` 和最小权限执行，不给低信任 PR 代码 secrets 或 release 权限；
- 避免在 `pull_request_target` 高权限环境中直接 checkout/运行不受信任 PR；
- 可以使用 GitHub Actions reusable workflows 和 artifacts，无需增加自建云控制平面。

## 5. concurrency / cancellation

现 `ci-required` / `ci-census` 的 `cancel-in-progress: false` 为明确保护规则，其 manifest 含对应负控。不能依据 #762 的 B3 直接翻为 true。

若未来考虑只取消过时 Draft 工作，应分离“可取消的非权威快速反馈”和“不能被取消的 Required 最终判定”，并证明 skipped/cancelled/obsolete check 不会被历史 success 顶替、不能被 GitHub branch protection 误视为成功。此项后置，不阻塞性能优化。

## 6. 测试收集的 CI 接入

在明确重用/替代 #530 的 collection gate 后，正常添加测试只需提交测试文件，不再手动修改多个显式 `node --test a.test.mjs` 行。关键 Contract Registry 的变更必须审查；未收集测试、陈旧豁免和重复 ID 皆有可验证负控。

## 7. 需要实测的工作流问题

- Draft 两次 push 的墙钟/runner cost；转 Ready 后是否只跑一次最终 head 完整 L2；
- 标题去 marker 与 settlement 顺序、Branch BEHIND 的自动重跑；
- 代码路径改变后，merge-tree 校验能否拒绝过时编译产物；
- matrix shard 失效、missing artifact、timeout、concurrency 排队时 Required 如何失败；
- 来自外部分支/低权限 PR 的缓存与 artifact 安全；
- 不依赖 admin merge、手动消除 required check、通过取消旧 workflow 洗白结果。

## 8. 外部依据

[GitHub Actions workflow syntax: fail-fast and continue-on-error](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)；
[Dependency caching vs artifacts / cache security](https://docs.github.com/en/actions/concepts/workflows-and-actions/dependency-caching)。
