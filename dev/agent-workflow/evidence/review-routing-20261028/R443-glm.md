# R443 独立复审（R3，用户指定席位）— PR #443 agent-state 审计账本加固

- **PR**: #443 `fix(tools): harden agent-state audit ledger (R-AUDIT-HL-1, R-AUDIT-FAIL-1)`（head `task/u7r1-audit-hardening-20261029` @ `1cd0d0cba`，base master）
- **Reviewer**: glm-5.3 独立会话（未参与实现）；日期 2026-10-29
- **裁决**：**补充内容**（SUPPLEMENT）— src 层四项声明全部独立证实，但 PR 未携带自身构建（dist install-surface 陈旧，仓库自有工具 verdict=stale），须补齐后才可合并。

## 复跑 vs 只读检查（明确声明）

**我亲自复跑的**（worktree `.worktrees/rr-443` @ `1cd0d0cba`，symlink 根 node_modules，uid=1000 非 root）：
- `vitest run test/u7-agentstate-fs-store-audit.test.ts test/u7-agentstate-fs-store-c1.test.ts` → **Test Files 2 passed (2) / Tests 55 passed (55)**（audit 5 + C1 50）；audit 文件逐条 verbose 全 ✓，两条 chmod-000 故障腿在本机**真实执行**（非跳过）。
- `node scripts/check-artifacts-at-head.mjs` → `DSH-ARTIFACT-VERDICT ... subject=commit rev=HEAD verdict=stale compared=1883 drift=1 sites=1`，指名 `packages/runtime/dist/packages/tools/agent-state-family/src/fs-state-store.mjs` content-drift，"HEAD does NOT carry its own build"。
- 直连 `fs-state-store.mjs`（仅依赖 node 内建，node --input-type=module）的独立探针：applyTodos 正常路径 `result.audit="CONFIRMED"`；**盘上 writes.jsonl / attempts.jsonl 行均无 `audit` 键**（行 = `{"op","scope","key","applyId"}`，旧 schema 原样）；`ledgerBytes(文件路径非目录,…)` → ENOTDIR **抛 `AGENT_STATE_STORE_LEDGER_UNREADABLE`**（uid 无关的 non-ENOENT 故障注入）；`ledgerBytes(不存在,…)` → 0。

**只读检查的**：全量 `gh pr diff 443`（300 行读完）；`fs-state-store.mjs` 全文关键段（guard/typedError/safeReadRecord/finishAttempt/commitWrite/applyWithAudit/writesBytes）；`executors.mjs` ANSWER 装配；repo 级 grep（ledgerBytes / writesBytes / attempts.jsonl / applyTodos / applyGoal / appendLineIn / dist 引用）；merge-base 处 dist↔src md5 恒等比对；两文件 git 提交史；用户裁决文件本地正本（`docs/plans/memo/unified-baseline-alpha5-20261025/gates/USER-RULING-20261029.md` §R-AUDIT-HL-1/R-AUDIT-FAIL-1，PR #442 未合并不影响）。

## 四项 worker 声明逐条独立证实

1. **Guard 正确**（fs-state-store.mjs:408-414）：`handle.stat()` 是 Node `FileHandle.stat()` = **对已打开 fd 的 fstat(2)**，非路径重 stat（无 TOCTOU-on-path）；读路径 :271-273 同一模式，现在读写两腿对称。拒绝（throw）在 `handle.writeFile` **之前**；typed 风格 = `typedError('AGENT_STATE_STORE_ALIAS_REFUSED', …)`，与本模块 append 路径既有 typed throw（OVERSIZED）及读路径同码 refusal 一致。注释诚实：FD-pinning 论述逐句对齐用户裁决原文（"cannot be redirected … closes the escape axis for this operation"），并显式声明 sharing/integrity 轴（per-event O_EXCL）为**未实现**的后续项——未夸大。残余的"fstat 后新建硬链接共享 inode"竞态即被推迟的 sharing 轴，注释口径与裁决一致，不计 finding。
2. **ledgerBytes 回归面**：全仓唯一真实调用 = store 自身 `writesBytes()`（:873）+ index 再导出 + 测试；C1/C2/world-factory 均无会把"合法预期 non-ENOENT 错误"传进来的调用点；absent（ENOENT）→0 保留，empty/有尺寸照旧，其余抛 `AGENT_STATE_STORE_LEDGER_UNREADABLE`（ENOTDIR 探针独立证实）。`center-shadow-row.mjs:94` 的 `ledgerBytesWritten` 是无关本地计数器，不调 ledgerBytes。抛出严格优于把 unreadable 读成零（正是裁决要求）。
3. **审计浮现真增量**：diff 中 4 处 return 仅做 `{...原对象, audit}` 展开，refusal/commit 控制流不变；committed state 从不重放。**盘上 JSONL 行 schema 不变**（探针实证：序列化发生在 audit 赋值之前，盘上无 audit 键）；内存 log 条目多一个 audit 字段（增量）。ANSWER 边界实证：executors 只取 `applied.code/.detail`（:245/:263）与 `projectGoal(applied.snapshot)`/`projectTodos(applied.todos)`（:248/:266），audit **不进入工具 ANSWER**。既有解析方（u7astore-assembly `lines()` :236-238 JSON.parse 容错、C1 `linesOf`）不受影响。
4. **测试为真**：硬链接测试用 `linkSync` 植真硬链到外部文件（有真实内容），断言 typed 拒绝 + 外部文件字节不变（'TOP-SECRET-BYTES'/'ATTEMPT-SECRET'）+ 零盘写；nlink=1 happy path 断言 CONFIRMED + 盘上含行；triad + UNCONFIRMED 测试在本机（uid 1000）真实执行。我复跑 55/55 与 worker 声明一致。

## Findings

### HIGH-1 — PR 未携带自身构建：install-surface dist 仍是漏洞代码

- **证据**：`node scripts/check-artifacts-at-head.mjs` @ `1cd0d0cba` → `verdict=stale compared=1883 drift=1 sites=1`，`C content-drift (git add): packages/runtime/dist/packages/tools/agent-state-family/src/fs-state-store.mjs`。merge-base 处该 dist 文件与 src **字节恒等**（md5 `81d18ea185cf92a904c2dd694685a03d` 两侧相同）→ 分歧完全由本 PR 引入；dist 侧至今仍是**无 nlink guard 的 appendLineIn + catch→0 的 ledgerBytes**。
- **为何重要**：`docs/RECOVERY.md:42` 明律 "commit the rebuilt `packages/runtime/dist` … in the SAME commit; confirm with `pnpm check:artifacts:head` (verdict=ok drift=0)"；`docs/RELEASE.md:64` 发布面 = `--plugin packages/runtime/dist`；world-factory live-host 测试即从 dist 装载（`world-factory.test.mjs:1159`、`U6_CENTER_SHADOW_ROW_REL`）。即：合并后**运行时/发布面装载的仍是未修复代码**，且本 PR 正文未披露此陈旧态（只报了 `git diff --check`）。提交史佐证常态：`bfa26bfc0`、`88c14eb87` 均 src+dist 同commit；`237ca9147` 更是专门为一次漏交 dist 的补救 commit。
- **整改**：重建（pnpm setup / place-dist-glue）并在**本 PR** 内提交该 dist 文件，复跑 `node scripts/check-artifacts-at-head.mjs` 至 `verdict=ok drift=0` 并把结果行写进 PR 正文。本环境实证该工具可用（与 worker 自己给 vitest 用的同一 node_modules symlink 手法即可跑通），故环境限制不构成未跑理由。
- **严重性**：HIGH——安全修复未落到实际装载面；但 src 修复本身已验证正确、整改机械且有先例，故裁决为补充内容而非阻塞。

### LOW-1 — root 环境下两条故障腿"静默通过"而非 skip-as-skip

- **证据**：`packages/runtime/test/u7-agentstate-fs-store-audit.test.ts:143` 与 `:153` 用 `if (isRoot()) return` —— root 主机上 vitest 报 **passed**（绿色），不报 skipped；PR 正文"skips gracefully as root"措辞超出实际（runner 输出看不出腿未执行）。父级测试法明确要求 skip-as-skip。本机 uid=1000 两条腿真实跑过（且我用 ENOTDIR 探针独立补证了 throw 行为，uid 无关），故仅影响 root 证据主机的可见性。建议 `it.skipIf(isRoot())` 或 `ctx.skip()`。

### LOW-2 — 符号链接账本名浮现裸 errno 作 audit code

- **证据**：账本名为 symlink 时 open 以 ELOOP 失败，`shortErrorCode`（fs-state-store.mjs:805-808）原样透传 → `audit:{status:'UNCONFIRMED', error:'ELOOP'}`，而读路径对 symlink 用 typed `AGENT_STATE_STORE_ALIAS_REFUSED`（:267）。仍是 fail-closed 且诚实（远优于修复前的整吞），仅码风格不一致。

## 范围 / 纪律核验

- **范围**：`git diff --stat` merge-base..HEAD = 恰 2 文件（新测试 169 行 + fs-state-store.mjs +62/−11）；无 centre/kernel、无封闭 lane、无账本历史改写。`git diff --check` exit 0。PR 正文含 **DO-NOT-MERGE before review** 行。✅
- **偏差复核（node_modules symlink）**：PR 分支 `git ls-files | grep -c node_modules` = 0，worktree `git status --porcelain` 为空——未留任何已提交产物。✅
- **测试计数**：C1 50 + audit 5 = 55，与声明一致。✅

## 复跑输出（本人运行，摘录）

```
$ cd .worktrees/rr-443/packages/runtime && ../../node_modules/.bin/vitest run test/u7-agentstate-fs-store-audit.test.ts test/u7-agentstate-fs-store-c1.test.ts
 ✓ test/u7-agentstate-fs-store-c1.test.ts (50 tests) 8411ms
 Test Files  2 passed (2)
      Tests  55 passed (55)
$ node scripts/check-artifacts-at-head.mjs   # @1cd0d0cba
DSH-ARTIFACT-VERDICT script=check-artifacts-committed subject=index verdict=stale compared=1883 drift=1 sites=1
  C content-drift (git add): packages/runtime/dist/packages/tools/agent-state-family/src/fs-state-store.mjs
$ # 独立探针（node --input-type=module，直连 fs-state-store.mjs）
apply.ok: true | result.audit: "CONFIRMED"
disk line has audit key: false / attempts disk line has audit key: false
ENOTDIR throw code: AGENT_STATE_STORE_LEDGER_UNREADABLE ; ENOENT -> 0
```

## 结论

src 层修复（guard 位置、同 fd fstat、typed 拒绝、诚实注释、ledgerBytes 三分、additive 审计、测试真实性）**全部独立证实**；但 **HIGH-1（dist install-surface 陈旧，仓库自有检查 verdict=stale drift=1）必须先补**，另两项 LOW 建议顺手修。补充后无需全量重审，复审 HIGH-1 整改收据（`check:artifacts:head → verdict=ok drift=0`）即可。
