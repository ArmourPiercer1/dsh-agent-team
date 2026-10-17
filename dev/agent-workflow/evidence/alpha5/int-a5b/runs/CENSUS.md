# int-a5b — root vitest 全树双抓（合并树 alpha5-int-a5b）

- 树：`alpha5-int-a5b` @ build-drift 注记笔（merge ①②③ 之后），HEAD `762a86f8`。
- 命令：`pnpm vitest run --reporter=dot`（root，全树），两抓串行、无并发负载。

| 捕获 | 文件 | 腿 | 失败文件 | 失败测试 |
| --- | --- | --- | --- | --- |
| `census-capture-1.log` | 565 (561+4 红) | 7112 (7103+9) | 4 | 9 |
| `census-capture-2.log` | 565 (561+4 红) | 7112 (7103+9) | 4 | 9 |

- 红集（两抓逐名一致，`diff f1.txt f2.txt` 空 = `CAPTURES_IDENTICAL`）：
  `p6t3-mediation.test.ts` ×5 + `p6t3-restart.test.ts` ×2 + `p6t6-actions.test.ts` ×1 + `t2-blueprint-hash.test.ts` ×1
  = **已发布基线 9 红逐条身份集，新增红 0**。
- 文件/腿数对基线 562/7086 的位移 = 本轮并入的三个新套件：+a5g6-install-face-render（+1f/+5l）
  +a5pbr2-binding-feed（+1f/+10l）+alpha5-g1-deny-lane（+1f/+11l）⇒ 565/7112，逐支与三个来源分支各自
  的 census 记录相加一致。
- 台账链核对：`p4t6-session-event-scan.test.ts` 10/10 绿；scanner 直读
  `filesScanned=1171 files=1171 quarantineHits=15` = 链终点 **1171**
  （1166 → glue5 1168 → glue6 1169 → pbr2 1170 → g1 1171，tie 条款逐段在册，int tie 注见该文件）。
