# Round 101 — the ask-under-allow reds, adjudicated per arm (one product defect, two stale oracles, one stale pin)

**Dated**: 2026-11-24 (real UTC) · branch `vnext/a1-cut` · PR #822 (DRAFT, unmerged) · base
`a19d1df018e772f20602f93bc726694524bdeb2f`.

Once the D4 RUN-record fix (round 100) let hosted `ci-integration` reach its later steps, a
pre-existing red was unmasked on the `tinf-instruments` leg: **803 tests / 788 pass / 9 fail**, all
around ask-under-allow semantics. Each arm was adjudicated against the owner ruling and against the
product's own compiled lane. The answer is NOT one side: **one product defect, two stale oracles and
one stale pin**. No arm was skipped, no assertion weakened, no timeout widened, no retry loop added.

## 1. The per-arm adjudication

| arm | oracle expected | product actually did | who was right | what changed |
| --- | --- | --- | --- | --- |
| `read-binding-subtree-ask-only` | `ask/deny/deny` (EX-3: "the intersection drops the ask") | `ask/ask/deny` (plane 3 = the independent oracle still collapsed) | **ORACLE STALE** — it encoded the pre-G11 collapse. Both declared lanes PERMIT the locator (their own disposition is `ask`), so the ask must survive as `ask`, never as `allow`. | case expectation → `ask/ask/ask` AGREE; `a5sf-dual-plane-oracle.mjs` `intersectDeclaredLanes` now keeps an ask iff neither lane answers `deny` (the shipped `intersectPathRuleSets` law); EX-3 rewritten to the only surviving drop reason (a real **deny** on either side). |
| `write-binding-subtree-ask-under-allow` | `ask/ask/ask` | `ask/deny/ask` | **PRODUCT WRONG — observability only.** `fs.ts` correctly refuses the ask through the R3 receipt path (`IO_ASK_RECEIPT_REFUSED`), but `guard-observability.ts#laneOfRefusal` mapped that code to `deny`, erasing the lane the guard had decided. The lane was never promoted to `allow` and no declared deny was lost. | `laneOfRefusal` maps `IO_ASK_RECEIPT_REFUSED` → `ask` (product fix). DP-REFUSE now pins the code PER FACE: read ⇒ `IO_ASK_REQUIRES_APPROVAL` (R4), write ⇒ `IO_ASK_RECEIPT_REFUSED` (R3). |
| `write-binding-subtree-allow-symlink-into-ask` | `ask/ask/ask` | `ask/deny/ask` | **PRODUCT WRONG by the same mapping** — **symlink resolution itself is intact and was verified, not skipped**: `evaluateLocatorAccess` decides the authored path, resolves it, re-applies `deny > ask > allow` on the RESOLVED identity, then hands the refusal to the receipt verifier. The refusal code (`IO_ASK_RECEIPT_REFUSED`, sub-code from the receipt verifier) is what got mislabelled. | no change to the resolution path; the same observability fix makes the fact say `ask`; the arm still asserts zero writes, unchanged disk, and the thrown code equals the fact's `decidedBy`. |
| `write-member-subtree-ask-under-allow` | `ask/ask/ask` | `ask/deny/ask` | **PRODUCT WRONG by the same mapping** (member realm, same `fs.ts` guard) | same product fix. |
| `DP1` | the reviewed triples | 4 arm mismatches | dependent aggregate | green once the four arms above are right (45-case space: 40 AGREE / 5 EXCEPTION / 0 DISAGREE). |
| `DP-SUM` | tables + coverage | `38 !== 42` (evaluateCase throws before recording) | dependent aggregate | green; case space grew 42 → 45 with the three controls below. |
| `DP-REFUSE` | every ask call: ONE `ask` fact, code `IO_ASK_REQUIRES_APPROVAL` | the write arms now refuse with the R3 receipt code | **ORACLE STALE on the code, not on the law.** The refused-write arms were in the ask set but the arm demanded the R4 code on every face. | per-face code assertion (read R4 / write R3), keeping every other clause (one fact, zero bytes, zero writes, unchanged disk, AGREE). |
| `PD29-STOP-SEQUENCE` | the stop facts read from `agent-bindings.mjs` | no `interrupt` there any more | **STALE PIN, not a Stop regression.** Round 90 moved the lane **verbatim** into `stop-drain-lane.mjs` (`createStopDrainLane`, constructed once by the glue). The sequence `cancel(hook) → disarm → durable CAS pause` is intact. | pin re-pointed at the module that owns the sequence; **new `PD29-WIRING` control** proves the glue imports the factory, constructs it exactly once and publishes its `interrupt` (an extracted lane cannot be orphaned silently); `PD29-PIN` now also proves the module did not exist at the base commit; `PD29-MUTATION` mutates the owning file. |
| `PD29-MUTATION` | deleting `disarmStoppedGoal(...)` must change the source | the substring did not exist in the file it mutated, so `mutated === source` | dependent on the same stale path | mutates `stop-drain-lane.mjs` and still asserts the mutated source differs and `callsDisarm === false`. |

**Why the oracle change is not a weakening.** The new expectation is strictly more permissive **only**
for the legal pure-ask case the owner ruling requires: an `ask` at a location BOTH lanes permit is
preserved as `ask` instead of collapsing to `deny`. It grants nothing — `ask` still requires approval
and the guard still refuses without a receipt — and every other locator stays denied. The controls
below pin exactly what the old expectation protected: an ask that either side DENIES is still dropped
(`deny > ask`), and a pure-ask lane still denies every locator it does not cover.

## 2. Cited controls added (nothing silently lost)

| control | what it pins |
| --- | --- |
| `read-binding-subtree-pure-ask-lane` | G11's own shape `{allow: [], ask: [p]}` ∩ a tool restriction stays `ask` — the exact case the round-94 fix exists for (`docs/reviews/20261124-0151.txt` §2). |
| `read-binding-subtree-pure-ask-lane-outside` | the SAME pure-ask lane asked about a locator it does not cover is still `deny` — the fix preserves the ask, it does **not** widen the lane. |
| `read-binding-subtree-ask-dropped-by-ceiling-deny` | the surviving EX-3: an ask DROPPED by an explicit deny on the member ceiling (`deny > ask`), with plane 1 (the tool rule alone) still asking. |
| `PD29-WIRING` | the extracted stop lane is the one the row mounts (import + single construction + published `interrupt`). |
| `DP-REFUSE` (rewritten) | per-face refusal code; a real `deny` still keeps `IO_READ_DENIED` and is never relabelled `ask`. |

Unit-level law was already pinned by round 94 in `a5sf-member-policy.test.ts` (pure-ask survives; a
disjoint/denied ask is dropped) and `a5sf-path-rules.test.ts`; the dual-plane suite is the
admission-level witness on top of it.

## 3. Gates at the final tree (this directory's `.log` files)

| gate | result |
| --- | --- |
| `dispatch-tests --run --leg ute-vnext-a1` | 248 tests / 245 pass / 0 fail / 3 skipped |
| `tinf-instruments` leg (the red leg) | **807 tests / 801 pass / 0 fail / 6 skipped**, suites=51 files=51 exit=0 |
| `test-catalog --max-uncollected 41 --max-excluded 7` | tests=785 refused=0 findings=0 (uncollected 38 / excluded 14) |
| `ute-cut-closure --check` | pass, `cut(0/148)` |
| `ute-p0-assets --check` | pass, 37 modules / 180 files / 69512 lines, `cut(148/148)` |
| `docs-sync --check` | pass, findings=0 |
| `place-dist-glue` | done, 35 placements, byte-identical |
| `eb3-ci-required` | pass workflows=10 findings=0 |
| bound vitest leg (`eb3-security-run --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt`) | PASS 15 suites / 238 passed / 0 failed |
| `ci-pr-gate --full --census-captures 2` | PASS 10 / 0 |
| UTE G1 argv (`node --test` 9 files) | 89 / 89 pass |
| `eb3-run-manifest` (and `--new-since a19d1df01`, the CI base) | pass records=516 strict=144 incomplete=11 findings=0 |
| `eb3-ci-negative-controls` | 35/35 controls behaved as required |
| `ute-a1-window --check` | pass red=0/0 cut=(148/52) |
| `dispatch-tests --run --leg devex-diag` | 44/44 pass |

## 4. Still open

* `d4:ask-execute-process` remains REFUTED by the named assembly gap (owner decision, unchanged).
* `ci-required` remains RED on this DRAFT PR because `ci-census` is `skipped` — the documented draft
  tier, not a product red. The PR stays DRAFT and unmerged.
* The UTE G1 refusal-category table (`tests/ute-g1-fs/lib/refusal-categories.mjs`) does not list the
  newer `IO_ASK_RECEIPT_REFUSED`; it gates a legacy corpus and no arm is red, so it was left untouched
  rather than silently widening a closed vocabulary.
