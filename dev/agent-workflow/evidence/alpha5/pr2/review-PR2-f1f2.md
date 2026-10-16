# Review-F1F2 — Alpha.5 PR2 pre-merge tail delta (`4f334d43..2501308d`)

- **Reviewer**: independent (rounds 1–5; ≠ writer). Model column: `qwen3.8-flash-next`. Harness (separate): `DeepSeek Harness`.
- **Object**: head `2501308d`; chain `03bc0b05` (RED, 2 red identities by name, 131 green) → `33c5bcdf` (GREEN) → `2501308d` (evidence). My own review commit `4f334d43` **is an ancestor** (verified — no rewrite, no force-push).
- **Delta**: `approval-case.ts` (+27), `admission-kernel.ts` (+35), 1 spec (+~60), rebuilt `dist`, evidence. 21 files, +581/−21. Two evidence logs deleted — the summary-only tails I flagged — **disclosed** in s12 (口径更正) and replaced by full captures.
- All probes were throwaway specs in my own worktree, deleted after the run (universe verified back to **1172**).

## 0. Verdict

**通过 (PASS).** Both final-head items are closed in the direction the ruling requires, they close *fail-closed* (never by picking a winner), and nothing regressed: F-1's order-dependence is gone (I hammered all six permutations), F-2's late-deny mint is gone (pairs are part of the case, and omitting the pin refuses rather than passing). Two items remain and both are carry-forward, not gaps: a README/contract NIT and the already-ledgered presentation-trust boundary. **可 rebase 到 master 走合并序** — with §4's NIT folded into the rebase or carried explicitly into PR3.

## 1. F-1 — the folding law, read then hammered

`find` is gone: `covering = filter(...)` then a **distinct** projection on exactly the triple `(ownerAuthority, sourceVersion, sourceRef)`; `distinct.length > 1` ⇒ `unapprovable.sourceDiagnosis='ambiguous'` → kernel `TOOL_BINDING_UNVERIFIED / deny-source-ambiguous`, with the message enumerating **every** candidate (`leader@g1:a, human-user@g1:b, human-admin@g1:c` — I read the rendered list) and the reason stated as *"no precedence between authorities' projections is this lane's to invent"* (`approval-case.ts:290-308`). Measured:

| probe | result |
| --- | --- |
| exact duplicate triple ×3 | **collapses**, opens at `human-user` — not over-strict |
| 3 distinct owners × **all 6 array orders** | `deny-source-ambiguous` in every order (set size 1), `regs=0` — order no longer decides anything |
| same owner+version, **different `sourceRef`** | **refused ambiguous** — folding cannot be used to launder two different source claims as one |
| two identical **stale** duplicates (`sourceVersion` 2,2) | collapse first, then `deny-source-version-drift` — staleness is never dropped silently |
| fresh (g1) + stale (g2) coexisting | **ambiguous** — no silent pick of the fresher entry; the assembly must resolve |

The last two are the ordering-free consequences I did not ask for but wanted: collapse is *equality*, not recency, and never resolves a conflict.

## 2. F-2 — the pairs are now part of the case

`PresentedApproval.deniedEffectsAtCreation` (`approval-case.ts:421-426`) is copied verbatim from `planApproval().value.deniedEffects`; the issue path compares it **pairwise, positionally, before** the max-rung comparison (`admission-kernel.ts:503-524`) and refuses `APPROVAL_STALE / deny-provenance-moved` with both lists rendered. Measured against my round-4 repro:

- **late second deny, honest pin** (case `@human-user`, pinned `[{1:leader}]`, second deny floored below the rung): **refused `deny-provenance-moved`, `regs=0`** — pre-fix this MINTED with `regs=1` (my `X16`);
- **pin omitted** on a deny-bearing case: same refusal — the optional field fails **closed** (`approvedDenials = … ?? []`), so an assembler that forgets it cannot mint;
- **coverage boundary I probed for**: the two reproof legs live under `if (expansion.policyDenied.length > 0)`, so a case whose deny *vanishes* before issue skips them. Both escalations I built (rung raised via the walk after withdrawal) still refused `approval-stale`, `regs=0` — the pre-existing per-effect verification leg backstops it. No hole;
- **forgery attempt**: re-presenting the *post-change* pairs (`deniedEffectsAtCreation` = the late re-plan's output) **MINTS** (`regs=1`). The pin is a presentation field, not a receipt bound to the approval event — the same trust class as `reviewerAuthority`/`requiredAuthorityAtCreation`. Against an honest assembly (the lane's stated threat model, "the assembly, not the model") the leg does its job; the fix is PR3's presenter echoing plan-time pairs, and if in-lane binding is ever wanted it needs a receipt digest, since the PR0 case-identity grammar is frozen and cannot absorb it. Recorded, not a defect (§4).

## 3. No regression (spot-checked at this head)

Six-state 对照表 test green inside the 133; identity legs intact (cross-member and forged `approvalCaseId` ⇒ `approval-case-identity-mismatch`, `regs=0`); H1 `clock: NaN` at issue ⇒ `clock-not-finite` with `probeCalls=0`; H2 enforced-without-observation ⇒ `assurance-runtime-verification`, sequence `["probe:content-read"]`; one-shot edge **replayed on a deny-lifted grant** (the new path): concurrent double consume ⇒ `OK + REFUSED`, `consumptions=1`.

## 4. Carry-forward (both non-blocking)

1. **NIT — the contract doc did not follow the code.** `README.md` (the lane's carrier for INTERFACES-v1 C-ADM) contains neither `deny-source-ambiguous`, `deny-provenance-moved`, nor `deniedEffectsAtCreation`; `r1a-source-contrast.md` has no ambiguity row either. The field is *mandatory in practice* (omitting it refuses any deny-bearing case), and PR3's presenter must map these codes. One paragraph + one table row.
2. **Ledger (extends G-d / my round-4 F-3)**: pin truthfulness = presenter discipline; `ownerAuthority` provenance and `sourceRef` resolution stay PR3 obligations.

## 5. Gates — PASS (independently reproduced)

Targeted set **133/133** across the 9 suites (I re-ran exactly that set); `pnpm -r run typecheck` **exit 0**; committed `dist` reproduces **byte-identically** from my `tsc` rebuild (only `.map` `sources` differ); lint universe **1172**, new 0; audit script OK — still **9** consumer files / 12 lane files, no cycles (DORMANT intact); fail-set **independently recomputed** from the new captures: `only_in_after = ∅`, `only_in_base = 1` (the a4p7 build-state leg), 21 identities **identical to the previous rounds' set**, census `after-census-f1f2.json` = `6762 / 6741 passed / 21 failed`; token scan of the range → **0**; porcelain in the writer's worktree = `?? runs/` only. The round-4 log NIT is **closed**: `red-f1f2-full.log` / `green-f1f2-full.log` carry the `$ pnpm exec vitest run …` command line, the per-test lines, all 9 suite names, and the totals (RED `2 failed | 131 passed (133)`, GREEN `133 passed`) — the suite set and every assertion are recoverable from the captures themselves.

## 6. Merge-sequence note

The lane is still DORMANT (zero production importers, 9 audited consumers) and the deny-source projection is unwired in the production assembly — so the merge lands a *live fail-closed door* (every policy deny meets `deny-source-unattributed` until PR3 wires the projection), not a behavior change. That is the stated intent of the tail rounds and is consistent with merging.
