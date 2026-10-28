# R431 Round-2 Closure Verification (read-only, flash)

## Self-check

- `pwd` = `/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/rr-431`
- `git rev-parse HEAD` = `b2413b61aa69d2dad9c4e9e8a6014f6089a59bf8` (detached; no checkout performed)
- `git status --porcelain` = **empty** (0 lines) — clean
- Note on commit shape: `b2413b61a` is a **merge commit** (`Merge origin/master (c2b03fc34) into task/u7-g4r3-ruling-20261028`), touching only `SESSION_ROUTER_LOG.md`. The round-1 **fix** commit is its first parent `08be42fc8` ("docs(gates): review round 1 fixes for B-G4R-3 — ceiling reading made explicit, partial-enforcement PASS scoped to its own precondition, ENV_BLOCK conjunction spelled out, origin/master refs pinned (a23f11a3b / c2b03fc34, both 34)"), 2 files / +17 / −6.
- Files verified: `docs/plans/memo/unified-baseline-alpha5-20261025/gates/RULING-B-G4R-3.md`, `.../gates/GATE-LEDGER.md`

## Finding 1 — ceiling statement ambiguity (8+1 reserve vs 9 authorized): **CLOSED**

Fix adds the explicit ceiling note at RULING L119–122:

> *(Ceiling reading, stated so it is not implicit: the planned total is 3 (phase 2) + 6 = 9, so the +1 reserve is only real headroom if the crash pair collapses to 1 — the plan consuming 8. If the pair needs both starts, all 9 authorized starts are plan legs and the reserve is already spent; a further ENV/harness defect then requires a NEW ruling, it cannot draw on the reserve.)*

Both branches (collapse ⇒ reserve real; both starts ⇒ reserve spent, further defect needs a NEW ruling) are now explicit and reconcile 9 authorized vs ceiling 8 ("**Hard ceiling: 8 starts, +1 reserved**", L116). Paren balance of the note verified: `(())`. No new inconsistency introduced.

## Finding 2 — +3 overrun justification (ENV/harness class priced +1): **CLOSED**

RULING L111–113 now prices the class separately from the authorization:

> "the 'ENV or a harness defect fixed in between' class the envelope already anticipated paying for — and with the explicit disclosure that this class prices at only +1 inside the envelope, so the +2 beyond that are a **new over-budget authorization by this ruling under the user standing ruling**, not a claim of in-envelope coverage"

The +2 are no longer presented as in-envelope coverage; they are attributed to the issuing ruling + user standing ruling. Consistent with Finding 1's note.

## Finding 3 — "genuinely PASSED" cited a partial-enforcement receipt: **CLOSED**

RULING L42–45 scopes the claim:

> "`u7-4a-jobs-producer-20261026/logs/u5u74a-…/u74a-main-4.u74a-evidence.json`) — PASSED *under partial Landlock enforcement*; `partial` is an admissible launcher state by this ruling's own precondition below (`partial` or `full`), and no partial⇒`full` equivalence is claimed here or needed by the verdict."

The disclaimer "no partial⇒`full` equivalence is claimed" is present and the appeal to the `partial`/`full` precondition reproduces at L127 ("`partial` or `full` in the worktree that will boot"). CLOSED.

## Finding 4 — ledger ENV_BLOCK conjunction unglossed / referral: **NOT-CLOSED**

The ledger gloss was added, but its cross-reference to the ruling **does not hold**. GATE-LEDGER.md:

> "ENV_BLOCK only on the conjunction of the pre-flight probe receipt **and** a typed sandbox refusal, the leg then referred to the promotion reviewer — the two conditions stated in `RULING-B-G4R-3.md` §"If the Jobs native leg still cannot run")"

The cited section, in full, states only one condition plus a referral:

> "**If the Jobs native leg still cannot run after the provisioning fix**, it is recorded as `ENV_BLOCK` with the probe receipt and referred to the promotion reviewer as the explicit ruling `G4-PROMOTION-REVIEW-R1.md` item 3 requires. It is never relabelled PASS, and the Bridge verdict is not quietly taken to depend on it either way."

Measured absence: `grep -in "typed\|refus\|conjunct" RULING-B-G4R-3.md` returns **no match** for `typed` / `refusal` / `conjunction` anywhere in the ruling (sole hit is the unrelated verb "refuses" at L16). So the "typed sandbox refusal" half of the conjunction is stated in **neither** the cited section **nor** the ruling as a whole. The ledger is now more specific than the authority it cites, and it attributes a two-condition conjunction to a section that states one condition + a referral — a new citation inconsistency introduced by the fix. Closure requires either (a) the ruling section to state the conjunction verbatim, or (b) the ledger to drop "the two conditions stated in …" and point at the actual source of the typed-refusal requirement.

## Finding 5 — equivalence rows cited un-pinned origin/master: **CLOSED**

Pins present in both docs (counts: `a23f11a3b` 2× ruling / 1× ledger; `c2b03fc34` 1× ruling / 1× ledger). RULING L60–62:

> "re-checked 2026-10-28 in the worktree that produced this PR, where master = `a23f11a3b`; the same three counts were independently recomputed by the R2 reviewer at master `c2b03fc34`, also 34 (review `.artifacts/reviews/R431-R2-d2-flash.md`, check 1):"

GATE-LEDGER: "`origin/master` (pinned at re-check time: `a23f11a3b`; independently recomputed at `c2b03fc34` — 34 in both)". Both docs pinned identically; counts agree (34).

## Format / paren sanity of edited passages

- Ledger reconciliation row: **7 cells**, identical to the table header (7 cells) — row intact, not split or merged.
- Ceiling note parentheses balanced `(())`; no stray/unclosed parenthesis in the diff hunks.
- Minor observation (not a finding): the new citation `.artifacts/reviews/R431-R2-d2-flash.md` is a gitignored working artifact; attested precedent exists (`.artifacts/findings/…` "restated inline"), and all measurements are restated inline, so this does not weaken evidence.

## Verdict

**NOT ALL-CLOSED — 4 CLOSED (findings 1, 2, 3, 5) / 1 NOT-CLOSED (finding 4: ledger cites §"If the Jobs native leg still cannot run" for a two-condition conjunction the ruling never states; "typed sandbox refusal" appears nowhere in RULING-B-G4R-3.md).**
