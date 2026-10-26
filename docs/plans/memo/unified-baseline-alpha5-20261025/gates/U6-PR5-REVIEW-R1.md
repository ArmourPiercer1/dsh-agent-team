# U6-PR5-REVIEW-R1 — independent review (verbatim)

> Provenance: qiyuan-inter/gpt-6.1-sol independent session; source `dev/agent-workflow/evidence/u6-pr5-review-r1/REVIEW.md`; copied verbatim.

# U6 PR5 / PR #380 独立审查 Round 1

## 裁决：投机通过

### ARC-A ruling
**ARC-A 本身成立（投机通过）**：`tests/u6-arc-a-probe-family/**` 是新 test-only family；以 PR5 merge-base `22110abbe`（PR4 已合入 master）归因，probe family 对受保护 center 集的产品 diff 为空；probe 的固定 Host C2 证据显示 mount/register/positive marker/unbound refusal/replay refusal/unload 都通过。Search family 是另一条真实 family move，不能计入 probe 的 zero-center claim；它确实把 grep/glob/cancel/search mechanics 移入 `packages/tools/search-family/**`，旧中心实现删除而非双账本。

## Findings (按重要度)

1. **C2 search 三腿仍失败（carried product gap）** — `dev/agent-workflow/evidence/u6-pr5-20261026/c2/run8-console.log.txt:6-10`、`run8-greper-tool-transcript.txt:8-13`。`arca:search-grep-live`、`search-glob-live`、`search-refusal-zero-effect` 均 FAIL，均在 Body 前返回 `IO_POLICY_UNSUPPORTED`。这不是 ARC-A probe fixture 失败：同一 run native grep control PASS，离线 `run8-offline-lane-decide-probe.txt:1-2` 显示 read-any allow、empty template deny；`packages/runtime/tool-admission/assurance-runtime.ts:139-142` 的 derived-demand/capability mismatch 是产品层拒绝。最小补充：将其登记为 GLUE-4 / assurance round 的明确 product-gap，并在后续 assurance 修复后重跑三 legs；不得把当前 C2 结果写成 search capability 已 live-proven。

2. **“第 9 次 boot 不会改变 verdict”证据可接受但仅限当前缺口** — `run8-greper-tool-transcript.txt:3-5`、`run8-offline-lane-decide-probe.txt:1-2`。它证明模板/derived demand 路径，不证明真实 search positive effect；因此 C2 的失败结论稳定，但不能升级为 search 正控证明。保留为 R-U6P5-1 carried risk。

3. **Golden v3 face disclosure正确，TEST_ONLY edge可接受但应继续严格 pin** — `golden-rerecord-note.md:8-32`、`u6-pr5-search-golden-vectors.test.ts:40-47`。v2 确实错误地用了 mechanics package face；v3 改回 a5p5 barrel 的 model-facing ROW grammar（`register.ts` PARAM_SCHEMA，`output_mode` required），并由 `a5p5-dormant-audit` 以单一、路径/形式固定的 TEST_ONLY dynamic import 例外约束。该例外是规则的窄化例外而非产品绕过；必须保持仅测试使用、精确 form pin。

4. **Golden corpus覆盖充分且重跑通过** — `u6-pr5-search-golden-corpus.mts:43-49,52-109,111-147`；`u6-pr5-search-golden-vectors.test.ts:90-115`。409 vectors、digest `0dabc187…`、master/family完整逐向量一致；含 regex/metacharacters、unicode/NFC/NFD/astral/RTL/zero-width/NBSP、binary/no-match/huge/type/path edges，以及 argv/parser/truncation/protocol faces。C1重跑 golden/fitness/move/kernel/probe 共 36 tests 全绿。

5. **L1 protected digest lock有效且 named override未被滥用** — `packages/testkit/test/arc-a-fitness/scan.mjs:42-99`、`u6-arc-a-fitness.test.ts:47-100`。real tree 由 `origin/master` booked digests 校验，mutation legs 覆盖 drift/new/vanish/wrong override；唯一 existing override 是 PR4 agent-bindings move，且 attributable diff against PR4 merge-base为空。Named override允许“精确新 digest + named center-interface PR”，符合 §9.1/§9.3，但该 ledger机制本身信任提交者；必须继续要求独立 PR/理由审查。

6. **L2 no-tool-name-branch非空树扫描及植入反例均有效** — `scan.mjs:101-123`、`u6-arc-a-fitness.test.ts:103-126`。扫描 kernel/registry/adapter/schema/index，当前无命中，植入 `name === 'grep'` 可检测。注意扫描也计注释，属于刻意保守规则，现有 C1 通过。

7. **L3 census与L4 closedness具备反例，不明显vacuuous** — `scan.mjs:125-205`、`u6-arc-a-fitness.test.ts:129-224`。census 覆盖 product/test contributions，反例覆盖 unbooked/vanished/familyId drift；closedness覆盖 dynamic name/unreviewed source/multiple familyId。family census ledger记录 probe 为 test-only，且 C1 通过。

8. **Search move存在中心 re-export，但不构成旧实现双账本** — `packages/runtime/src/plugin/live/plane-effect-backends.mjs:95-143` 与 `packages/runtime/src/plugin/live/team-tool-plane.mjs:77-125`。旧 center 文件保留兼容 export surface，production plane直接导入 search-family mechanics/glob backend；`u6-pr5-search-move-law.test.ts`及golden通过。需继续把“re-export≠authority/implementation”写入后续审查说明，避免未来中心重新承载 mechanics。

9. **C2 probe family的产品隔离证据充分** — `tests/u6-arc-a-probe-family/src/probe-contribution.mjs:1-70`、`u6-arc-a-fitness.test.ts:142-157`、`run8-console.log.txt:1-5`。fitness还扫描 packages production imports，禁止 product import test-only probe。正控 marker effect 与 zero-effect refusal 均有证据。

10. **Bookkeeping基本正确** — `packages/testkit/test/p4t6-session-event-scan.test.ts:209-244,2944-3060` 迁移 search/glob/cancel booking 并加入 U6PR5 12 paths；`p4t6-GREEN.log`与相关 C1 通过。lint identity/census/typecheck/root vitest 及完整 requested matrix 的独立 receipt未在本轮全部重做，故不将其升级为“全套已验证”；merge receipts仍应作为 carried evidence。

## Verification summary

- Protected-set diff against PR5 merge-base `22110abbe`：empty for PR5; `agent-bindings.mjs` change is PR4/master named override, not PR5.
- Fitness + search golden + move law + kernel flow + probe C1: **36/36 passed**.
- `node --test tests/world-factory/world-factory.test.mjs`: **32/32 passed**.
- C2 run8: probe/native control PASS; three governed search legs FAIL at assurance capability layer (`IO_POLICY_UNSUPPORTED`).

## Minimal required additions before upgrading verdict

1. Add/retain a named GLUE-4 assurance product-gap record and rerun the three search C2 legs after capability records can satisfy derived search-row demand.
2. Preserve v3 TEST_ONLY a5p5 barrel edge as exact path/form pin; do not replace it with mechanics face or broaden the exception.
3. Keep PR4 override provenance and family census/p4t6/lint/root-vitest receipts attached to the merge record.

## Carried risks

- R-U6P5-1: search grep/glob live positive and refusal legs are not proven on Host; currently fail closed at assurance, not ARC-A.
- R-U6P5-2: full requested C1 matrix/lint/typecheck/root-vitest receipt was relied on from branch evidence rather than wholly rerun in this review.
- R-U6P5-3: L1 named override is safe only with independent center-interface PR attribution; a family PR must never add one.
