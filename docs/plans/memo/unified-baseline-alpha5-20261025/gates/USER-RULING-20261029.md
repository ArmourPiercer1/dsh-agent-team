# USER-RULING — 2026-10-29 (post-G4 independent architecture & code review; main-agent verification appended)

**Source.** The user's independent review of master `880de10ca` / frozen candidate `5d0c8ff583`, delivered
2026-10-29. Recorded here verbatim-in-substance by the main agent; the user's own words govern.

## The ruling

| Scope | Verdict | Conditions |
| --- | --- | --- |
| Retain `G4-PASS (投机通过, conditional)` | **agreed** | registered risks and conditions stay; failure history never rewritten |
| U7 remaining engineering | **released** | independent families, centre zero-arbitrary-change, short-transaction merges |
| G5 candidate build + test work | **released with conditions** | build a NEW candidate; remediate first the code/judges that would affect its acceptance results |
| G5 formal PRODUCT-GATE PASS | **not released** | required features, security, evidence and install acceptance first |
| Alpha.5 release / trusted bootstrap baseline | **not released** | independent E5/G5 verdict + final user approval |

The queued question from the #440 gate row (whether a 投机通过 with open MEDIUM residuals unlocks the
release path) is **answered YES for the U7-work/G5-prep scope only** — not for G5 formal acceptance,
not for release. G4's decisive blocker (no unified-candidate real-host evidence) is recognized as
substantially resolved; no U6 centre rework is required. Centre architecture verdict (scoped static
review): basically healthy — `consumeOnce()` reserves the Grant ID synchronously before the async call;
no parallel grant ledger found. That verdict is explicitly scoped: it is NOT a claim that every U7
Family production implementation is safe.

**Execution order (user-ordered):** U7-R1 security & evidence trust → U7-R2 test infrastructure →
U7-R3 remaining tool acceptance (12 L4 / 17 L3 gaps, owners + real host, or explicit product-scope
rulings — never "done by refusal") → G5: freeze a NEW full candidate (installer, real host, production
profile, trusted sources; C3 + EB/E5). **G5 does not inherit PASS-by-knob, partial-Landlock, or
incomplete-oracle records as its proofs.** BL-20..23 stay an independent hash-pin regeneration package.
Changes touching G4-relevant test law must mark old-evidence applicability explicitly; G4 history is
never back-edited.

## Main-agent verification of the review's findings (this round, against 880de10ca bytes)

- **P1 hardlink append (`fs-state-store.mjs` `appendLineIn` :394-407): CONFIRMED.** `APPEND_NOFOLLOW`
  (:158) = `O_WRONLY|O_CREAT|O_APPEND|O_NOFOLLOW`; after `fsp.open` the code writes with **no
  `fstat`/`nlink` check**, while the read path (`safeReadRecord` :273; doc :108/:118) refuses
  `nlink !== 1` — the asymmetry is exactly as reported. Registered **R-AUDIT-HL-1**. Note recorded for
  the fix: an FD-pinned append cannot be *redirected* by a hardlink planted after `open`+`fstat`
  (the write follows the inode we hold), so the same-FD `nlink !== 1` refusal closes the escape for
  this operation; the durable fix (immutable per-event `O_EXCL` files + a stated ledger-directory
  trust model) closes the sharing/integrity axis and is the agreed direction.
- **P1 acceptance gate (`scripts/eb3-tool-acceptance.mjs` :283-336): CONFIRMED.** The gate requires
  schema + `overall`/`finishedAt` present + tracked + `hit.verdict === 'PASS'`, but **never requires
  `record.overall === 'PASS'`** and does not check candidate binding / host provenance / mock flags at
  this step. Ledger census (mine): **95 PROVEN = 31 L1 + 31 L2-mounted + 14 L3 + 19 L4** (matches the
  review's table); **11 distinct backing records**; the REFUSED record
  `dev/agent-workflow/evidence/u7-f-agentA-20261026/c2/run-u7fa5.json` (`overall=REFUSED`; cases
  `ac:enumerate-governed`/`ac:spawn-failclosed` REFUSED; **teamSha `0ea0848acd` — an older tree**)
  backs **8 PROVEN units — 7× `L2-mounted` (case `ac:mounted`) + 1× `L3-refusal`
  (`ac:interrupt-foreign-zero`)** — i.e. *more* than the 3 stated in the review. (Provenance of this number: the review
  said 3; my first census said 7; the R442 independent re-review recounted the bytes to 8 —
  `interrupt_agent` carries both an L2 and an L3 citation of the record. 8 is the recorded truth.) Registered **R-ACCEPT-RUN-1** (the concrete build-out of R-G4R-3): `CASE_PROVEN` vs
  `RUN_PROVEN` + mutation negative controls.
- **P2 audit swallow (`:778-784`, `ledgerBytes :411-418`): CONFIRMED.** `finishAttempt`/`commitWrite`
  `catch {}`; `ledgerBytes` returns 0 on unreadable. Registered **R-AUDIT-FAIL-1** (CONFIRMED /
  UNCONFIRMED audit states; never re-run a committed write as remediation; zero-side-effect assertions
  must distinguish 0 bytes from unreadable).
- **P2 production-home availability (`packages/tools/families/agent-state.mjs`): CONFIRMED as stated**
  (fail-closed `PLANE_AGENT_STATE_STORE_MISSING` when DSH_HOME absent/relative/inside `~/.dsh`;
  real-host C2 proved on constructed World homes only). Registered **R-STATE-HOME-1** — needs a product
  decision (trusted persistence location / host home-capability interface / diagnosis), a §4-class user
  question at decision time, not answered here.
- **P2 ENV_BLOCK breadth (`070-u7-f-web.mjs:307+`): CONFIRMED** (e.g. `web:fetch-positive` → ENV_BLOCK
  with only an in-test reason, no independent environment-unavailability proof). Registered
  **R-ENVBLOCK-1** (split NOT_REACHED / proven ENV_BLOCK / product FAIL).
- **P2/P3 runner + asset gaps: CONFIRMED with one scope note** — `run-c2.mjs` lives in the CLOSED lane
  `u7-tbash-l4-20261027/` (immutable history; F1/F2 self-discipline flags exist there); the fix applies
  to the **reusable runner lineage** (canary/u7 runner scripts and future lanes): reject ALL unknown
  args, budget pre-check before any resource creation, `try/finally` teardown of owned resources.
  Registered **R-RUNC2-1**. Mode-bit verification on the `present` path of
  `tests/world-factory/lib/host-sandbox-assets.mjs`: registered **R-ASSET-MODE-1**.
- **R-CRASH-1 / R-413-1 / R-G4R-1a / R-ORACLE-1 / R-G4R-3**: retained, and per this ruling **G5-blocking**
  (previously scheduled merely "post-freeze").

## Program registration

U7-R1 (this week): R-AUDIT-HL-1, R-AUDIT-FAIL-1, R-ACCEPT-RUN-1 (+ targeted C1/C2 + mutation controls).
U7-R2: R-CRASH-1, F-1/F-2 (as R-RUNC2-1), OG-1/R-ASSET-MODE-1, R-413-1, R-ENVBLOCK-1; every judge-law
change carries an old-evidence applicability note. U7-R3: 12 L4 + 17 L3 gap units, owner + real-host
test or explicit product-scope ruling per unit. G5: new candidate + C3 + EB/E5; G5 PRODUCT-GATE and
release return to the user. Every work item: 1 task = 1 branch = 1 worktree, independent cross-model
review before merge, receipts per PR. No G4 record is rewritten by any of it.
