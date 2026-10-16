# review-PR0-delta — independent review of fix delta `3f8cfff8..a3e9d272` @ `alpha5-pr0-contracts`

- **Reviewer**: independent session (≠ implementer); model `qwen3.8-flash-next` (harness declaration verbatim: "a coding agent powered by the qwen3.8-flash-next model").
- **Object**: single commit `a3e9d272` ("claimed effect set must re-verify its own fingerprint; assurance dimensions carry the §2.1 record"), 8 files, +369/−30.
- **Method**: independent re-run of every claimed verification (tests, audit, typecheck) + a one-off probe script importing the tsc-compiled lane (scratch dir outside the tracked tree, deleted after; zero repo residue).
- **三值口径**: PASS / MINOR（不阻断）/ FAIL（阻断）。

## 总判定：**PASS** — 建议恢复 PR0 Gate（本件为三独立评审之一；§3.1 汇总仍须三审齐过）

修复真实、RED-first 证据自洽、无反向回归、diff 面纪律干净。0 阻断项；2 条 MINOR 观察 + 2 条范围外记录。

---

## 1. 四条 RED 场景复验 — **PASS**

实现后行为由三条独立途径交叉证实：

- **重跑新测试**（a5p0-schema-negatives.test.ts:333-343，①②③④ + 不变式）：3 个改动测试文件 70/70 绿（本会话实跑，2026-10-16T05:37Z）。
- **一次性探针**（编译产物直调 `parseRequestedEffectSet`，effects=[read(workspace), tool-invoke(bash)]）：
  - ① `{effects}` 无 key → **REJECTED** `missing-field@$.fingerprint`
  - ② `fingerprint:null` → **REJECTED** `missing-field@$.fingerprint`
  - ③ `fingerprint:42` → **REJECTED** `field-type@$.fingerprint`
  - ④ `fingerprint:undefined` → **REJECTED** `missing-field@$.fingerprint`
  - 附加：`''` → `fingerprint-mismatch`；`{}` → `field-type`。
- **修复前确为接受**：`git show 3f8cfff8:…/effects.ts` 旧守卫 `typeof claimedFingerprint === 'string' && …`（旧文件 199-203 行）在非字符串/缺键时跳过复算，`problems=∅` → `finish` 走 `canonicalize(parsed)` 成功 = 静默铸指纹；RED 日志（runs/a5p0-claimed-fingerprint-RED.log，含 4 条 `ok:true` 实物输出与 4 failed/1 passed 汇总）独立记录同一行为。

**错误码入联合**：`missing-field` / `field-type` / `fingerprint-mismatch` 均为闭合联合 `TOOL_CONTRACT_PROBLEM_CODES`（parse-util.ts:17-35）既有成员，零新增码。注：本 lane 的解析拒绝走 `ParseResult{problems}` 词汇表；§5 `GOVERNANCE_ERROR_CODES`（errors.ts:25-35）是冻结接口的结果词汇表，二者分层是 review-PR0 PASS 时确立的既有模型（映射属 PR2 接线），本 delta 未破坏。

新守卫代码：effects.ts:199-212。

## 2. 反向回归 — **PASS**（无"全部拒绝"式糊弄）

同一探针：
- 合法 raw 数组仍唯一规范化路径：`[read,tool-invoke]` → ACCEPTED `sha256:9e015b54…`；
- **合法 claimed（true digest）→ ACCEPTED**（指纹同值，`A2`）；
- claimed 携带错误字符串指纹 → REJECTED `fingerprint-mismatch`（A3）；
- 未排序 claimed + 缺指纹 → `not-canonical`+`missing-field` 并集（A5）；空集/非记录/未知字段闭合性不变（A6-A8）；
- `a5p0-…-schema-negatives:345` 不变式测试同绿。

**确定性/泄露**：比较为 `recomputed.fingerprint !== claimed`（effects.ts:210，字符串全等，确定性；非 MAC 场景无恒定时间要求）。`fingerprint-mismatch` detail 为固定文案，**不携带 canonical 值**（探针 A4 实测 problems JSON 无 digest）。RED 日志中的 digest 输出是测试断言消息（修复前 harness 输出），非 shipped 错误面。无泄露 → 不触发 MINOR。

## 3. expiry — **PASS**（只钉语义，未改语义）

- diff 文件清单中 `grant.ts` **零改动**；现行 `grant.ts:142` 仍为严格 `now > expiresAt`。
- 新增测试（a5p0-grant-replay.test.ts:118-133）：到期瞬间 `now=5000`（fixture `expiresAt:5000`）仍 ok:true、`5000.000001` → `grant-expired`、`NaN`/`−∞` 不判过期、`+∞` 判过期——三非有限值全部钉死。NaN/Infinity 非法 now 测试**在位**。
- "无相反历史契约"主张**独立复核成立**：全 `docs/` grep，`expiresAt` 语义仅设计 §4.2"可选到期"（post-poc-technical-design.md:169）；`restart-recovery-guide:518` 的 `expiresAt` 属 v3 `ordinaryPermits`（D3 ordinary mode），非 `OperationGrant`，非相反契约。

## 4. M-2 最小补齐 — **PASS**（§2.1 覆盖完整；附 1 条 MINOR 观察）

- 设计 §2.1 verbatim："逐项记录**机制、作用 Realm、可信根、证据**与 `enforced | author-trusted | partial | unsupported | untested`" → 五要素对 `AssuranceDimensionRecord { level, mechanism, realmId, trustRoot, evidence }`（assurance.ts:82-95）**逐项覆盖，无缺项**。必填性：五键全必填；`mechanism/trustRoot/evidence` 值可显式 `null`（诚实"无"，空白串拒收 `empty-string`）；`realmId` 必填非空 Realm 名（Realm 不可混淆）。`assuranceSatisfies` 仅读 `.level`（assurance.ts:209）——推导律不变，非第二开关，与设计 §1.4 一致。
- **schema 负测真实**：schema-negatives:143-196 (a) 裸 level → `not-a-record`、(b) 缺 mechanism+realmId → 两条 `missing-field`、(c) 空白 mechanism → `empty-string`；探针 B4-B6 独立复现全部行为（含 `realmId:'  '` → field-type）。

**MINOR-1（不阻断）**：无 level↔字段交叉律——`level:'enforced'` 且 `mechanism:null, evidence:null` 仍过 schema。代码注释（assurance.ts:71-80）显式把一致性裁决让渡给 reviewer/PR3/PR4 evidence gate；§2.1 字面只要求"记录"，故非违例，但 PR2 冻结前建议一句裁决（同 review-PR0 决议请求 #4 的口径）。

## 5. 全量 — **PASS**（本会话实跑）

| 项 | 结果 |
| --- | --- |
| 改动 3 测试文件 | 70/70 绿 |
| lane 全 6 文件（a5p0-*） | 114/114 绿（commit 声称 103/103 = 同一计数口径扣除 fingerprint-negatives 11，与前轮 94 口径一致；本审实测全绿，只多不少） |
| `node scripts/audit-a5-tool-governance-imports.mjs` | **EXIT 0**（12 lane files, 44 edges; pure-domain, no cycles, zero production consumers） |
| `pnpm -r typecheck` | **EXIT 0**（全 9 包 Done） |
| DORMANT | audit "zero production consumers" + grep runtime/client/tools/remote `src/` 零 `tool-governance` 引用；index.ts:6 "DORMANT BY CONTRACT" 头在位 |
| hygiene | a3p3 21/21 绿、p4t6 10/10 绿 |

**范围外记录（非本 delta 缺陷）**：packages/domain 全量含 1 个**基线即有**失败 `t2-blueprint-hash.test.ts > projects absent optional singles as explicit null`——在 base `3f8cfff8` 逐字同败（本审对照实跑），源于分支上 a4-pr7 blueprint v3 漂移（`capabilities` 投影字段），与本 delta 文件集零交集；建议 coordinator 另行处置，不阻断 PR0。

## 6. diff 面纪律 — **PASS**

8/8 文件全在允许集：lane src 3（effects/assurance/index 导出补 `AssuranceDimensionRecord` 类型）、a5p0 规格 3、evidence runs 2（RED/GREEN 日志）。`name-only` 过滤越界文件 = 空；v3 与其他包零触碰。

**MINOR-2（不阻断）**：实现者 worktree 根残留未跟踪 `.pr-body.md`（已提交副本在 runs/.pr-body.md）——writer 清理即可，不属 diff。

---

## 复现命令（worktree `.worktrees/a5-pr0` @ a3e9d272）

```bash
cd packages/domain && npx vitest run            # lane 全绿；仅 t2 基线败（见 §5）
node scripts/audit-a5-tool-governance-imports.mjs   # exit 0
pnpm -r typecheck                               # exit 0
```

## 结论

**PASS**：四条 claimed 场景全部由"静默 canonicalize 接受"转为**精确拒绝且码在闭合联合内**；合法路径保持绿；expiry 只钉未改且主张有据；M-2 五要素齐备且负测真实；审计/类型/DORMANT 全过；diff 面零越界。**建议恢复 PR0 Gate 三审汇总**；MINOR-1 并入 PR2 冻结前裁决清单（与 review-PR0 决议请求 #4 同列），MINOR-2 为 writer 清理项。
