# gate-evidence — a5m2w-web-c1.test.ts 落位的门禁原文（交 CENTER 明处登记/重录依据）

Worktree `.worktrees/a5-m1-kernel` @ feat/a5-m1-center-kernel，team HEAD 7a354093；
捕获 2026-10-23T06:56–06:59Z。全部命令在 worktree 根实跑，stdout+rc 原文照录（长标题行截断处标 `[…title…]`，AssertionError 行一律全文）。

## ① p4t6 exact-count leg（挡新增的红字）

命令：

```
pnpm exec vitest run packages/testkit/test/p4t6-session-event-scan.test.ts -t '980 files scanned'
```

**A. 五文件齐（兄弟卡 4 + 我 1）：**

```
AssertionError: expected 1233 to be 1228 // Object.is equality
- Expected 1228 / + Received 1233
 ❯ packages/testkit/test/p4t6-session-event-scan.test.ts:2819:37
    2819|     expect(scanResult.filesScanned).toBe(
 Test Files  1 failed (1)      Tests  1 failed | 9 skipped (10)
P4T6_EXIT_ALL=1
```

**B. 仅我的文件移出（其余 4 兄弟文件留在原位）后：**

```
AssertionError: expected 1232 to be 1228
 Test Files  1 failed (1)      Tests  1 failed | 9 skipped (10)
P4T6_EXIT_WITHOUT_MINE=1
```

⇒ **我的净增量 = 恰好 +1**（`packages/runtime/test/a5m2w-web-c1.test.ts`）；
其余 +4 = 兄弟卡（a5-m2-todo-write-c1 / a5m2-readimg-c1 / a5p5-tools write-slice+test）
的未入账增量，归各自卡登记，非我账。断言位置=`packages/testkit/test/p4t6-session-event-scan.test.ts:2819`
（`scanResult.filesScanned` 精确数；标题 literal=当前 booking 1228；同文件 :2885 处另有
`scanResult.files.length` 对 booking 列表和的断言，booking 文案须同步——由 pin owner 明处做）。

## ② governance-imports audit 前后

命令：`node scripts/audit-a5-tool-governance-imports.mjs`

前（我的测试暂存出位）与后（原位）**输出逐字节一致**，均：

```
tool-governance audit: 13 lane files, 49 edges, 26 consumer file(s)
OK: pure-domain lane, no cycles, consumers = …(26 文件列表，无 a5m2w 项)…
AUDIT_RC_BEFORE=0 / AUDIT_RC_AFTER=0
```

⇒ 我的测试文件不构成 production consumer（audit 只扫生产消费者面；测试入 edge 不在其口径），
前后零漂移。

## ③ a4-artifact-provenance

命令：`node scripts/a4-artifact-provenance.mjs`

```
PROVENANCE_RC=0
(空 stdout，0 字节；/tmp 重定向复核同为 0 字节)
```

⇒ 该脚本是**无 CLI 的谓词模块**（正文自述：由 `a4p75-composition-smoke-classification.test.ts`
与 `a4p7-merge-gate.test.ts` 消费；"WHY THIS IS A MODULE AND NOT A SENTENCE IN A TEST"）。
直跑无输出、rc=0 = 合法空操作，不是"通过"断言。本批新增=一个 test 文件，不声明任何
artifact；web-gateway lane（批次 2）落位时若触 artifacts/glue 钉，届时取对应 spec 原文。

## typecheck 归属（前车之鉴自查）

命令：`pnpm --filter @dsh-agent-team/runtime run typecheck` → `TYPECHECK_RC=2`

5 条错误**全部**属 `test/a5m2-readimg-c1.test.ts`（80,77 TS2769 / 82,48 TS2349 /
165,14+171,14+179,14 TS4113——即 CENTER 前车之鉴原文同款），`a5m2w` 匹配行数=**0**
（同一次 tsc pass 内归属隔离）。我的文件：`: any`/`as any`/`<any>` 计数=0；
`eslint-disable` 计数=0。

## 我的测试定向腿（existing entry，绿）

```
pnpm exec vitest run packages/runtime/test/a5m2w-web-c1.test.ts
✓ packages/runtime/test/a5m2w-web-c1.test.ts (8 tests) 17ms
Test Files 1 passed (1)   Tests 8 passed (8)   M2W_VITEST_RC2=0
```

首跑曾 3 红（原文保留于 harness 记录；三处均为我断言未对齐实现真实事实，非生产缺陷）：
C1-1 解析器返回 canonical 排序集合（非输入序）→ 改集合断言；
C1-3 冒名 connect@fs 实际首闸码=`rights-matrix`（RESOURCE_RIGHT_MATRIX，
resource.ts:67-75；比 effect 级检查更紧，N 臂无"合法权利+错 kind"中间态可伪造——已写进断言注释）；
C1-8 witness doc 注释位于函数之上（witness 拆两段：注释归属位置 + 函数体无 additionalProperties）。
修后 8/8 绿（上）。

## 需 CENTER 明处登记（我的账目）

- p4t6 booking：+1 文件 = `packages/runtime/test/a5m2w-web-c1.test.ts`（a5m2w web C1：
  B-WEB classify/manifest 闭集 8 腿，含 S 裁定 no-service-kind 与参数根 open 的当前形态 witness）。
- census 语料：+1 file、registered legs +8（题=describe 'a5m2w web C1 — B-WEB classify/manifest
  over the frozen closed set' 下 C1-1…C1-8）；9 titled reds 不动。
- governance-imports audit / artifact provenance：零漂移，无需重录。
