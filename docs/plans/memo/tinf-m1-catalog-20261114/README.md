# TINF M1 — Test Catalog 与 Runner Dispatch（shadow）

> Dated: 2026-11-14 · Status: **IMPLEMENTED (draft PR)** · 设计正本：`docs/plans/memo/agent-testing-infrastructure-20261114/` 的 M1 一节（PR #767，merged `f24c41337`）
> 前置：M0（PR #768，merged `db125a185`）已把测量工具修好；本 PR 用它们量出来的东西做发现。

## 1. 一句话

仓库里有 **857 个测试文件**，其中 **87 个不被任何 lane 收集**。M1 不把它们收进来，而是让这个数字**可见、可复算、且只能变小**：自动发现（不再手写名单）+ 关键合同绑定 + 双向差集 + 拒绝增长。

## 2. 发现（没有手写名单）

| 来源 | 规则 | 结果 |
| --- | --- | --- |
| vitest | 匹配**任一** vitest 配置（`vitest.config.ts` / `vitest.poc.config.ts` / `vitest.scratch.config.ts`）的 `include[]`、不匹配其 `exclude[]`。**判据是配置是否匹配，不是文件名后缀**；glob 相对谁由配置自身决定（见下） | 745（736 collected / 7 uncollected / 2 config-excluded） |
| node:test | 任意位置的 `*.test.mjs|cjs|js` | 105（20 collected / 80 uncollected / 5 evidence-excluded） |
| 显式 suite 清单 | `tests/checks/eb3-security-suites.txt`（`scripts/eb3-security-run.mjs` 执行的那 65 个） | 计入 collected |
| 证据目录 | `dev/agent-workflow/evidence/**` 下的 recorder | 5 个 node + 7 个登记排除 = 12；另 2 个由 client 配置自身排除 |

**配置是读出来的，不是抄下来的**：`include`/`exclude` 从各 `vitest.config.ts` 解析，改配置不会让 catalog 悄悄过期；解析失败 → `VITEST_CONFIG_UNREADABLE` 拒绝。

**两次真实的漏检（都已修）**：
1. 第一版用「文件名是不是 `.test.ts`」做入口，漏掉 `packages/client` 的 **32 个 `*.client.spec.ts[x]`** —— 它们由 client 配置 include，与 `.test.ts` 无关。
2. 第二版只看名叫 `vitest.config.ts` 的文件，漏掉 `tests/poc-web-native-reuse/vitest.poc.config.ts` 与根 `vitest.scratch.config.ts`；而且那个 POC 配置的 glob 写成 `tests/poc-web-native-reuse/**/*.test.ts`（**仓库相对**，不是配置目录相对）。现在配置名接受任意 `vitest*.config.ts`，glob 的相对基准由「include 是否拼出自身目录」判定。

两次都有回归测试。一个漏测试的 catalog 比没有更糟：它的 digest 看起来像覆盖承诺。

## 3. 量出来的三个真问题

1. **7 个 `packages/domain/compatibility/test/*.test.ts` 不被任何 config 收集**：根 include `packages/*/test/**` 只覆盖一层，`packages/domain/vitest.config.ts` 的 `test/**` 以包根为准，它们在 `compatibility/` 下两层，security 的 65 条清单也没有它们。T5 兼容性套件写完之后没进过任何 lane。
   （`tests/poc-web-native-reuse/*.test.ts` 曾被误报为同一类：它们**有**自己的 `vitest.poc.config.ts`，并在 authoring 轮跑过 `4 files / 49 passed`（`dev/agent-workflow/evidence/a5w-native-reuse-20261031/WEB-NATIVE-POC.md`）；真实缺口是**不在任何 CI lane**，不是没有 config。）
2. **80 个 node:test 套件没有 lane**（M0 已报 79；catalog 的 node 口径更宽——任意位置的 `*.test.mjs`，因此多数一个 `packages/runtime/root-binding/harness/*.regression.test.mjs`）。
3. **手写名单与发现是两套事实**：`--diff` 双向列出 `catalog_only` / `ci_only`。`ci_only` 非空 = 某条 lane 点名了一个发现不到的文件（目录/glob 形态）→ 拒绝 `PLAN_REFERENCES_UNKNOWN_ID`。

## 4. Critical Contract Registry

`dev/ci/test-contracts.json`（`test-contracts/1`）登记 6 条**安全关键**合同，每条都有真实 test_refs、witness_type 和 limitations：

| contract | 绑定的测试 | limitations（明写） |
| --- | --- | --- |
| `AUTH-01` 身份与授权绑定 | `a3p4-r4-authority-binding`、`contracts/test/identity` | E0；真实进程由 E2 负责 |
| `EXEC-01` 未授权不产生副作用 | `alpha5-g1-deny-lane`、`a5sr3-default-deny-mapping` | 无 FS/OS 副作用 witness（M2 的 oracle） |
| `REVIEW-01` 审批不可跨身份复用 | `a4p4-operation-approval-authority`、`a4p3-approval-escalation` | 文档级，不对真实 UI |
| `LIFE-01` sticky stop 后不新调度 | `a6-stop-fence`、`a6-stop-fence-wiring` | 不覆盖 stop 与 fence 之间的崩溃 |
| `RECOVERY-01` 不盲目重试不确定副作用 | `p6t1-recovery`、`recovery-dispatch-deny-zero-effect` | 进程内，真实 kill 属 E2 |
| `ISOLATION-01` 不越 OS/服务边界 | `a5sf-subprocess-unconfined-realm`、`f1-webserver-shim-isolation` | **纯 JS 永远不能证明 OS 边界**（05/12），这里只绑定拒绝逻辑 |

绑定的含义被刻意写窄：**它说的是“这条合同由这些具名测试承担”，不是“这些测试足够”**。缺 test_refs 的合同 = 空头承诺 → `CONTRACT_WITHOUT_TEST`；绑定的路径消失 = `CONTRACT_UNKNOWN_TEST`（删掉关键合同的唯一测试是**红**，不是“catalog 变小了一点”）。

## 4.5 digest

`catalog_digest`（本 head）= `sha256:69d5b59f1ac665f1f837421486a2f4a8ddcaa018ed3c13b68626a40e30150caf`（digest 只含 id/path/runner/kind/contract_ids，不含 classification）：两次运行一致；测试集合变（加一个 suite）则变。

## 5. 拒绝集（本 PR 的交付物）

| code | 触发 | 负控 |
| --- | --- | --- |
| `TEST_UNCOLLECTED` | 默认严格：发现到但没 lane | live：91 条 |
| `UNCOLLECTED_GREW` | `--max-uncollected N` 棘轮：超过 N | 加一个未收集 suite → 92 > 91 → 红（`nc-m1-5`） |
| `CONTRACT_UNKNOWN_TEST` | test_ref 路径不存在 | 删掉一条合同测试 → 红（`nc-m1-1`） |
| `CONTRACT_WITHOUT_TEST` | 合同没有 test_refs | 红 |
| `DUPLICATE_ID` | 两个测试共用一个逻辑 id | 红（`nc-m1-2`） |
| `STALE_EXCLUDE` | 排除项缺 reason/review，**或路径已不存在** | 红（`nc-m1-3`） |
| `INSTRUMENT_DRIVER_MISSING` / `UNKNOWN_DRIVER` | 登记了不存在的 driver | 红（`nc-m1-4`） |
| `VITEST_CONFIG_UNREADABLE` | 配置解析失败 | 红（不当作“没有配置”） |
| `PLAN_REFERENCES_UNKNOWN_ID` | `--diff` 的 `ci_only` 非空 | 红 |

**棘轮而不是豁免**：`--max-uncollected 87` 是 CI 用的模式——已知集合可以留着（M2–M5 才收），**增长不行**。数字只能往下走。两层保护：删掉 manifest 的 `check[]` 是 `CI_LAYER_LEG_WEAKENED`；只删步内的棘轮行，则由 suite 里那条读 `ci-integration.yml` 的测试抓住。

## 6. 逻辑 id 与 digest

- 逻辑 id 默认 `runner:<path-without-.test.ext>`；登记表可给 `{path, id}` 指定**与路径无关**的逻辑 id（测试搬家语义不变时 id 不变）。两个测试抢同一个 id → `DUPLICATE_ID`。
- `catalog_digest = sha256(排序后的 [id, path, runner, kind, contract_ids])`：与顺序无关，与 classification 无关（分类依赖 CI 列表，会变），测试集合变则变。`--json` 打印 `test-catalog/1` artifact，**不提交**生成索引（设计 §2.5：生成物不是新权威）。

## 7. 边界（明示未做）

- **不是权威**：没有任何 gate 读 catalog 决定跑什么。workflow 文件列表与 `eb3-ci-manifest.json` 仍是唯一事实，直到 M5。两套权威比一套更糟。
- **没有删除任何手写名单**（设计 M1 要求）；`--diff` 只是把差集摊开。
- **manifest 只钉住 suite 文件，不钉步内命令**：删掉 workflow 里的棘轮行，`eb3-ci-required` 仍是 pass。所以 `test-catalog.test.mjs` 里加了一条测试直接读 `ci-integration.yml`，断言「跑本 suite 的那个 step 里必须有 `--max-uncollected`」。删棘轮行会让那条测试红。
- **没有跑 vitest**：`vitest list --json` 需要安装依赖与构建，CI 里是另一条链；本工具用配置匹配 + 显式清单判定“是否会被收集”，这是**静态判定**，不是“这次跑成功了”的证据。设计 §2.1 的原生 list 留给 M5 的 dispatch 落地。
- 没有接 GitHub Actions matrix、没有 shard、没有替换 census。
- `tests/poc-web-native-reuse/*.test.ts`（4 个）同样不在任何 config 的 include 里 → 计入 91。

## 8. 复现

```bash
node --test scripts/test-catalog.test.mjs        # 18/18
node scripts/test-catalog.mjs --self-test        # 22 cases
node scripts/test-catalog.mjs                    # 严格：87 条 UNCOLLECTED → exit 2
node scripts/test-catalog.mjs --max-uncollected 87   # CI 用棘轮 → exit 0
node scripts/test-catalog.mjs --diff --max-uncollected 87   # 双向差集：ci_only=0
node scripts/test-catalog.mjs --json | head -5   # artifact（不提交）
```

## 9. 回滚

删除一个 CI leg（`ci-integration.yml` 一行 + manifest 一个条目）与四个新文件（`scripts/test-catalog*.mjs`、`dev/ci/test-contracts.json`、本 memo）。catalog 是只读 shadow，回滚不触及任何 gate、Authority、candidate 或 release 状态。
