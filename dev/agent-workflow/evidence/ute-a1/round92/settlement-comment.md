**[dated settlement, 2026-11-24T00:00Z — round 92: PTC / `run_code` is NOT SUPPORTED by owner ruling — enforcement, NOT-APPLICABLE markers, wiring audit, full gate set; head `@@HEAD@@`]**

Covered head: `@@HEAD@@` (parent `03dcbad14`). PR #822 stays **DRAFT**, unmerged. :3080 and its
DSH_HOME were never touched; no second server was started; no non-topic push; no history rewrite; no
frozen A0 evidence edited; no DSH fork or upstream patch (CORE PATCH BUDGET = 0).

## Verdict

**PTC / `run_code` is formally NOT SUPPORTED for this generation, per the owner ruling
(`docs/reviews/20261124-0151.txt` §PTC, 2026-11-24), and the decision is implemented end to end.** It is
recorded as `dev/agent-workflow/evidence/ute-a1/ADR-ptc-unsupported.md` — an amendment that CITES the
frozen A0 contract instead of editing it. Nothing was deleted to obtain green: the two PTC POSITIVE arms
are now explicit `NOT APPLICABLE — PRODUCT UNSUPPORTED` with machine-visible markers that other arms
assert, and the refusal negative controls are KEPT and strengthened. This is a **ruled scope reduction**.

## What the ruling requires, and what this head does

| requirement | implementation | arm |
| --- | --- | --- |
| governed Member's `run_code` explicitly unsupported | typed `ADMISSION_PTC_UNAVAILABLE` before the body, at the ONE centre | `ADM-87`, `ADM-76` |
| never in the model-visible tool set | shipped `native` presentation projects no `run_code`; the per-member definition does not resolve it; governed preset declares no PTC row | `ADM-79` (1), `a5sf-governed-preset` G0 |
| an accidental call through the host-RETAINED entry is a typed refusal, ZERO worker | in a PTC-presenting deployment the host keeps the transport; the call is refused before any worker/confine, zero effect | `ADM-79` (2) |
| status distinct from "missing provider"/"misconfigured" | `status: unsupported-by-product-ruling` on the refusal table entry, the invocation-authority fact (a FIELD), the execution fact, and the settlement `terminalReason`; `ADMISSION_PTC_UNAVAILABLE` kept | `ADM-87`, `ADM-79` |
| PTC-only wiring cleaned, shared pieces justified | audit found no provably dead PTC-only consumer; the refusal row/branch ARE the enforcement, and `ptc-escalation-row.mjs` (+`host.ts` install + glue re-export) is a SHARED `approval/request` escalation control (every sandbox-escalation prefix, host bash/pwsh included) — kept, rationale in ADR §6 | ADR §6 |
| DSH host PTC untouched; native bash/PTY/Control/Stop untouched | no upstream file changed; host PTC smokes unchanged; `d3:persistent-subprocess` / `ADM-125…132` unchanged | — |

**Hiding was not treated as completion.** `ADM-79` drives BOTH halves in one arm: absence from the
offered set under the shipped presentation, and a typed refusal with zero worker through the retained
entry under a PTC-presenting deployment.

## The two PTC positives: NOT APPLICABLE — PRODUCT UNSUPPORTED (not silent skips, not deleted)

| arm | before | after |
| --- | --- | --- |
| `ADM-69` (B ladder rung 6) | positive: `run_code` executes, effect observed | reports `VNEXT-PTC-PRODUCT-UNSUPPORTED arm=ADM-69 marker="NOT APPLICABLE — PRODUCT UNSUPPORTED" status=unsupported-by-product-ruling verdict=NOT_APPLICABLE`, asserts the declaration, then skips WITH the marker |
| `ADM-147` (declared-world PTC positive) | suite said the positive "needs a world that declares the binding" | BUILDS that declared world (`perTool.run_code` allow + ready executor), proves the declaration cannot make PTC supported (typed refusal, zero body), reports the marker, skips WITH it |

Each marker is asserted by a companion arm in the same suite — `ADM-80` (ladder) and `ADM-148`
(admission) — which require the machine line to exist with the marker/status/verdict/ADR path, keep the
not-applicable arm list CLOSED (a new skipped positive cannot borrow the status; the reporter throws),
and require the refusal controls (`ADM-76`, `ADM-87`) to still exist. A silent skip fails; a deletion
fails.

## A0 B-ladder amendment (frozen files untouched)

- supported positive verification scope: `read → write → grep → web_fetch → bash` (rung 5's bash
  positive is still the disclosed `ADM-68` in the realm-shaped world; it is proven at `ADM-125`);
- PTC is verified ONLY as `run_code → typed refusal → zero worker execution → REFUSED/not-started`;
- machine line: `VNEXT-B-LADDER rungs=read,write,grep,web_fetch,bash,run_code negatives=6/6
  positives=4/5 … ptc=ADM-69-NOT-APPLICABLE-product-unsupported amendment=ADR-ptc-unsupported.md`.

## Counts that moved (and why)

- `ute-vnext-a1`: `tests 211 → 215`, `pass 209 → 212`, `skipped 2 → 3`. The four added arms are
  `ADM-79`, `ADM-80`, `ADM-147`, `ADM-148`; the one added skip is the SECOND ruled marker
  (`ADM-147`). `ADM-68` (bash disclosure) is pre-existing, and **no other skip was widened**. Suite/file
  set unchanged (7 files) → leg set digest unchanged (`sha256:edd4f1c4…`).
- Test catalog: unchanged in KIND and in count (`tests=785`, collected 733, excluded 14, uncollected 38
  — no test FILE added or removed; bounds 41/7 remain).
- No frozen A0 file changed; no upstream file changed; dist mirrors rebuilt and committed
  (`place-dist-glue` 34 placements byte-identical).

## Gates at this head

```
DSH-TEST-DISPATCH mode=run leg=ute-vnext-a1 suites=7 files=7 exit=0 set=sha256:edd4f1c494a777b941baa47a286d29455f79eb71d20ae7e48cf46a5580c8a975
  tests 215 / pass 212 / fail 0 / skipped 3
DSH-TEST-CATALOG tests=785 digest=sha256:da8a452d65130a3a7f62ef90b549a5289909e689e1ff619c4b3e0c45d5f5ed32 refused=0 findings=0
  (DISCOVERED_AND_COLLECTED 733 / EXCLUDED_WITH_REASON 14 / UNCOLLECTED 38; bounds --max-uncollected 41 --max-excluded 7)
UTE-CUT-CLOSURE pass deleted=148 references=3 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 retiredSurfaces=12 placements=self findings=0
UTE-P0-ASSETS pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 wave1=146 wave2=0 cut=cut(148/148) findings=0
docs:sync --check: docs=193 notes=4 plans=152(0 declaring) findings=0 blocking=0 contracts=20 pairs compared
place-dist-glue: done (34 placement(s))   — every line byte-identical
EB3-CI-REQUIRED pass workflows=10 findings=0
EB3-LAYER layer=ci-integration verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0 clock_ms=30000
node --test (UTE G1 nine-file argv): tests 89 / pass 89 / fail 0 / skipped 0, exit 0
ci-pr-gate --full --census-captures 2:
@@CIPRGATE@@
```

## Seat and model disclosure

Implementation, reproduction and the gate runs were performed in one delegated DeepSeek-Harness coding
session (model `deepseek-v4.1-flash-1017`, seat: SOLE WRITER in `.worktrees/vnext-a1-cut`). No
second-party reviewer seat was commissioned in that session; the review verdict is the reproduced gate
set above and the readable ADR, not a second reviewer's opinion. The coordinating agent holds the
independent review/merge decision.

## Report / evidence

`dev/agent-workflow/evidence/ute-a1/ADR-ptc-unsupported.md` (the amendment: ruling, measured basis,
what is unsupported / NOT affected, contract amendment, wiring audit, revisit path, counts);
`CAPABILITY-MATRIX-C.md` C-ptc; `D-ACCEPTANCE-REPORT.md` C13 + §4.1b + gap G3;
`MIGRATED-SUITE-STATUS.md` round-92 section; `OWNER-DECISIONS.md` item 1;
`packages/runtime/src/plugin/vnext/ptc-product-ruling.mjs` (machine declaration).

## Limits / NOT proven

No governed PTC positive is claimed — PTC is verified ONLY by its refusal chain. The measurement is
still scripted-mock / per-DSH_HOME-operator where live boots are involved. `d4:routed-wake` stays
REFUTED and BL-30 leaves a granted `ask` unable to execute; those are unrelated to this ruling and are
NOT fixed by it. No capability row becomes PRODUCT-PROVEN. Revisiting PTC is a future feature gated on
an upstream per-execution policy seam (ADR §7), never a silent re-enable.
