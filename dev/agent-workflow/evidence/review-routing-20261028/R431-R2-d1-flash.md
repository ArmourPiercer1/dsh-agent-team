# R431-R2 — Dimension 1 (判据保真) review

Reviewer: independent read-only gate reviewer. Object: PR #431 @ `d5c340cb5`.

## Worktree self-check

```
$ cd .worktrees/rr-431 && pwd && git rev-parse --short HEAD && git status --porcelain | wc -l
/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/rr-431
d5c340cb5
0
```

Clean detached worktree at the briefed head `d5c340cb5`. No checkout performed.

Path note: the brief names `dev/agent-workflow/evidence/u7-g4r3/*/gates/…`, but the diff actual path is
`docs/plans/memo/unified-baseline-alpha5-20261025/gates/`:

```
$ git diff --name-only origin/master...HEAD
docs/plans/memo/unified-baseline-alpha5-20261025/gates/GATE-LEDGER.md
docs/plans/memo/unified-baseline-alpha5-20261025/gates/RULING-B-G4R-3.md
```

## Check 1 — boot arithmetic internal consistency

Claim under test: "all five gate items re-run on ONE freshly frozen clean candidate — ARC-A 1 + ARC-B 1
+ ARC-D 1 + Jobs 1 + crash survivor 2 = **6 boots, hard ceiling 8**" (RULING-B-G4R-3.md:5-6).

The table sums to the stated total:

```
$ sed -n '92,99p' RULING-B-G4R-3.md   # starts column
| 1 | ARC-A ... | 1 |
| 2 | ARC-B ... | 1 |
| 3 | ARC-D ... | 1 |
| 4 | Jobs Bridge ... | 1 |
| 5 | R-G3-1 / R-REM-1 crash survivor | 2 |
| | **phase-3 total** | | **6** |
```
1+1+1+1+2 = 6 — matches the stated 6. No off-by-one in the item table.

## Check 2 — consistency with the cited R1 envelope and the phase-2 ledger

R1 envelope, verbatim:

```
$ grep -n 'Budget for G4-R' G4-PROMOTION-REVIEW-R1.md
44:Budget for G4-R: 3 starts for items 1–3, +1 retry only for ENV or a harness defect fixed in
   between, +2 if crash-survivor equivalence breaks. No over-budget boots without a new
   main-agent ruling.
```
3 + 1 + 2 = 6, and RULING:101-102 restates it as "3 + 1 (ENV or harness defect fixed in between) +
2 (crash equivalence breaks) = 6" — **verbatim-faithful**, no inflation of the envelope.

Phase-2 consumption of 3, per the lane's own record:

```
$ grep -n 'Start count' dev/agent-workflow/evidence/u7-g4r-live-20261028/README.md
36:**Start count: 3 Host boots total** (ARC-D ×2, Jobs ×1), within the parent budget

$ grep -n 'Zero Host starts' dev/agent-workflow/evidence/u7-g4r-live-20261028/arc-b/BLOCKED.md
41:- Zero Host starts consumed by this leg: `boot-budget.jsonl` byte-identical after
```
Matches RULING:102-103 "Phase 2 consumed 3 of those (two ARC-D starts — one lost to an operator
omission — and one Jobs start)" exactly; the operator omission is independently documented at
README:39-41 ("I omitted the documented `--run-record`", "not a FAIL").

Closing arithmetic: 3 (phase 2) + 6 (phase 3) = 9; 9 − 6 (envelope) = **3 over**, matching
RULING:104 "takes G4-R to 9, which **exceeds the original envelope by 3**". Consistent.

### Finding P2 — "hard ceiling 8 + 1 reserved" is already saturated by the authorised 6

```
$ sed -n '104,111p' RULING-B-G4R-3.md
authorises **6 further starts, taking G4-R to 9**, which **exceeds the original envelope by 3**.
**Hard ceiling: 8 starts, +1 reserved strictly for an ENV/harness defect fixed between attempts.**
The crash-survivor pair may collapse to 1 if its first start yields a finalized overall PASS ...
```
8 + 1 = 9, which is the same 9 that 3 + 6 already produces. So the "+1 strictly reserved" start is
not additive slack: under the authorised worst case it is the 9th start itself. The reserve survives
only if the crash pair collapses to 1 (line 110-111) → 3 + 5 = 8. The doc does not state which
reading governs, so the ceiling reads as 9 while being written as 8+1. Disclosure is intact
(explicit "exceeds ... by 3" twice); this is an accounting ambiguity, not concealment.

## Check 3 — no SKIP / REFUSED / ENV_BLOCK laundered into PASS

```
$ grep -n -E 'SKIP|REFUSED|ENV_BLOCK|never relabelled|never PASS|PASS' RULING-B-G4R-3.md
21:status: G4 stays `G4-CORE-PASS / BRIDGE-BLOCKED` (2026-10-26, unchanged ...)
34:   user namespaces ⇒ every native workspace-write leg is ENV_BLOCK here". Measured:
127:`ENV_BLOCK` with the probe receipt and referred to the promotion reviewer as the explicit ruling
128:`G4-PROMOTION-REVIEW-R1.md` item 3 requires. It is never relabelled PASS, and the Bridge verdict is
136:- Any change to a historical record. The Jobs `overall: FAIL` and the phase-2 ARC-D PASS stand as
```
No SKIP or REFUSED token appears anywhere in the document — nothing to launder. ENV_BLOCK is handled
in the one direction the precedent demands: "It is never relabelled PASS, and the Bridge verdict is
not quietly taken to depend on it either way" (127-129), which reproduces R1:40 verbatim in intent
("ENV_BLOCK is never PASS"; "the Bridge verdict must not depend on it"). The gate status is held, not
upgraded — "G4 stays `G4-CORE-PASS / BRIDGE-BLOCKED`" (21) — and a prior FAIL is explicitly preserved
as FAIL: "The Jobs `overall: FAIL` ... stand as written; only attribution is corrected" (136-137).
The ruling also self-classifies as "an **authorization + disclosure, not a gate verdict**" (20-22),
so it claims no PASS it has not earned. Additionally a `unusable` pre-flight is defined as "a stop,
not a leg verdict" (116-117) — the failure mode is kept as a stop rather than converted to a pass.
**Conclusion: no laundering found.**

### Finding P3 — the one PASS sentence rides on a "partial" receipt

```
$ grep -n 'genuinely PASSED' RULING-B-G4R-3.md
39:   The same leg genuinely PASSED on 2026-10-26 (`landlock-run: partial enforcement (older Landlock ABI)`,
```
"The same leg genuinely PASSED" is asserted from a receipt whose own text is "partial enforcement
(older Landlock ABI)"; the document never argues partial ⇒ full PASS. It is used as host-capability
evidence, not as a gate verdict (historical records are explicitly left standing, 136-137), and the
ruling's own pre-flight accepts a probe of `partial` **or** `full` (116-117), so this is internally
coherent — but the word "PASSED" outruns the receipt it cites. P3 wording, not a gate-status effect.

## Check 4 — is the over-envelope disclosure explicit?

Yes, stated twice in the authorising sentences, unprompted:

```
RULING-B-G4R-3.md:5-6    ... = **6 boots, hard ceiling 8** — which **exceeds the envelope in
                         [G4-PROMOTION-REVIEW-R1.md](./G4-PROMOTION-REVIEW-R1.md) by 3, disclosed**.
RULING-B-G4R-3.md:104    authorises **6 further starts, taking G4-R to 9**, which **exceeds the
                         original envelope by 3**.
RULING-B-G4R-3.md:108    over-budget status is stated in the PR and the gate doc, not hidden.
```
Plus a named upstream duty is honoured rather than evaded: R1:44 requires "No over-budget boots
without a new main-agent ruling" and the document *is* that ruling ("Issued by the incoming main
agent", 9-10; "Authority: ... No over-budget boots without a new main-agent ruling", 27-28). The
folio carries the same disclosure (GATE-LEDGER.md:30, "**exceeding R1's envelope by 3, disclosed**").
**Disclosure is explicit and duplicated; not hidden.**

### Finding P3 — overrun justified by a class the envelope priced at +1

```
$ sed -n '105,107p' RULING-B-G4R-3.md
It is granted because the overrun is caused by the two defects in inputs 1–2, i.e. exactly the
"ENV or a harness defect fixed in between" class the envelope already anticipated paying for, and
```
R1:44 prices that class at **+1 start**; the overrun being licensed on that ground is **+3**. The
causal claim is directionally right but the allowance invoked is a third the size of the spend. It is
fully disclosed, so no fidelity break — the justification is just under-priced relative to the
envelope clause it leans on.

---

## Verdict

**PASS-WITH-FINDINGS** — the boot arithmetic is internally consistent (5 items → 6 boots, 1+1+1+1+2),
consistent with the cited R1 envelope (3+1+2=6, verbatim) and with the phase-2 ledger (3 Host boots:
ARC-D ×2 incl. the documented operator omission, Jobs ×1, ARC-B 0), and the total (3+6=9 vs envelope 6
→ +3) matches the disclosed overrun exactly. No SKIP/REFUSED/ENV_BLOCK is laundered into PASS, and the
over-envelope status is disclosed explicitly and twice. Findings are accounting/wording grade only and
do not disturb any gate status.

| sev | location | issue | evidence |
|---|---|---|---|
| P2 | RULING-B-G4R-3.md:109 | "Hard ceiling: 8 starts, +1 reserved" equals the 9 starts already authorised (3+6); the reserve is only real if the crash pair collapses to 1 (3+5=8). Reading unstated. | `8 + 1 = 9` = `3 + 6 = 9`; line 110-111 offers the collapse |
| P3 | RULING-B-G4R-3.md:105-107 | +3 overrun justified by the "ENV or harness defect" class that G4-PROMOTION-REVIEW-R1.md:44 prices at +1 | R1:44 "`+1 retry only for ENV or a harness defect fixed in between`" |
| P3 | RULING-B-G4R-3.md:39 | "The same leg genuinely PASSED" cites a receipt reading "partial enforcement (older Landlock ABI)"; partial ⇒ PASS never argued | quoted at line 39; mitigated by 116-117 accepting probe `partial` or `full` |

Scope limits: read-only; no Host started; `:3080` / `~/.dsh` untouched; no checkout performed.
The brief's path (`dev/agent-workflow/evidence/u7-g4r3/*/gates/`) does not exist at this head — the
documents live under `docs/plans/memo/unified-baseline-alpha5-20261025/gates/`.
