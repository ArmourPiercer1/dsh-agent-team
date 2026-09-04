# R125 Gate 总结 — int/P9-master-product-closure @ 8cf9fcb（.worktrees/P9-MC，全新 tree 复跑）

日期：2026-09-04。tree = master(2c1c200) + task/upstream-rc1-compat(bd38827) 合并(232316d) + R125(1/2)(8cf9fcb)。
环境：Node v26.0.0 / pnpm 11.7.0 / 暖 store `D:/.pnpm-store` / workspace-write 沙箱（vitest 需 vite child-spawn → 本会话一次性 full-access 授权；其余门全部在默认沙箱内直跑 node 二进制）。
方法论：逐包独立、无 `pnpm -r`（R122 同法）；`pnpm install --ignore-scripts` + 逐包 `node node_modules/typescript/bin/tsc -p …`（R122 同法，沙箱 pnpm lifecycle spawn EPERM 绕行）。

## 五闸结果

| 门 | 命令 | 结果 | 日志 |
| --- | --- | --- | --- |
| install | `pnpm install --ignore-scripts` | EXIT 0（44.3s，暖 store） | gate-install.log |
| typecheck | 逐包 `tsc -p packages/<p>/tsconfig.build.json`（8 包；legacy 无 tsconfig.json，按惯例 8/8） | **8/8 EXIT 0** | gate-build.log（typecheck 段） |
| build | 同上 tsc 全量产物（9 包） | **9/9 EXIT 0（BUILD-ALL-FAIL=0）** | gate-build.log（build 段） |
| test | 根配置 `vitest run` + 逐包 `vitest run`（R122 方法论） | 根配置 219 files / **2395/2395** 全绿；逐包 9 包合计 **2630/2630** 全绿（p6t1-parallel 负载 flake 2 项 → 隔离复跑 9/9，R122 r122d 先例） | gate-test.log + gate-test-perpkg*.log + gate-perpkg.ps1（runner 脚本） |
| lint | `node node_modules/eslint/bin/eslint.js .` | **EXIT 0（0 error 0 warning）** | gate-lint.log |
| smoke（3180 全新世界 boot） | — | **不重复执行**：R122 在 bd38827（= 本 tree 产品面，byte-identical，见 merge-audit.md §2）上已全绿（S8-READY / gentry `failures: []` / 干净世界冒烟 OK）。本轮以 byte-match（byte-compare.md）+ 四门新复跑承接其有效性 | （R122 证据：evidence/upstream-rc1-compat/ + references/.dsh-test-s8-2026-09-04T12-26-59/） |

## 测试计数对账（2532 vs 2630）

- R122 记录「vitest 2532（runtime 1070/1070）」= RC1 worktree 逐包合计，**不含 legacy 包**：2532 = contracts 150 + domain 312 + storage 269 + runtime 1070 + tools 35 + remote 92 + client 480 + testkit 124。
- 根因：`packages/legacy` **没有本地 vitest.config.ts**（8 包有、legacy 无）→ 从 legacy cwd 跑 vitest 时向上找到根配置，而 vitest root 仍为 cwd，根级 include `packages/*/test/**/*.test.ts` 在 legacy cwd 下零匹配 →「No test files found, exiting with code 1」。R122 的逐包 runner 因此漏计 legacy（其 7 files / 98 tests）。
- 本轮修正：legacy 以**根配置 + 路径过滤**运行（`vitest run packages/legacy` @ worktree root）→ 7 files / 98 tests 全绿 → 逐包合计 **2630 = 2532 + 98**（恰为 legacy 数）。
- 交叉验证：根配置单次 run（2395）= 2630 − 235（client `.client.spec.ts(x)` UI 套件，仅 `packages/client/vitest.config.ts` include）；2395 中 client 的 `.test.ts` 部分 = 245，480 − 245 = 235 ✓。
- 产品面无差异：两侧 tree 测试代码 byte-identical（merge-audit.md §2）；差异纯属 runner 覆盖范围。本轮测试门**严格强于** R122（多覆盖 legacy 98 tests）。

## p6t1-parallel 说明（已知 flake，非回归）

- 逐包连跑时 runtime 出现 2 项失败（`p6t1-parallel.test.ts`：N=2 同模板并行激活两项断言）——R122 已记录的同款**并发负载 flake**（「`p6t1-parallel` 已知并发负载 flake，隔离 9/9 `r122d`」）。
- 根配置单次 run（gate-test.log）该套件 9/9 全绿；隔离复跑（gate-test-perpkg-runtime-p6t1-iso.log）9/9 全绿。
- 处置 = R122 先例（隔离复跑确认），不修改测试/产品代码。

## 结论

四道非 smoke 门在本 tree 全新复跑全绿；smoke 门以「产品面 byte-identical + shim/glue byte-match + R122 已验证世界」承接。五闸口径满足，int 分支具备 ff master 资格（待三独立 reviewer 裁决）。
