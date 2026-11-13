# V016-RC1-GO-NO-GO — recommendation to the owner for `v0.1.6-rc.1`

**Status: RECOMMENDATION ONLY. NO TAG, NO RELEASE, NO npm PUBLISH, NO AUTHORITY MOVE.**
**Recommendation: NO-GO.**
**Lane:** `docs/v016-rc1-release-package` (worktree `.worktrees/v016-rc1-docs`), base
`origin/master` @ `76a86d6e923efa291350a32d1c1eb70e3754a684` (#746).
**Date:** 2026-11-13 (workday clock; decision snapshot at `2026-11-12T22:37Z`).
**Companion:** [`RELEASE-NOTES-0.1.6.md`](./RELEASE-NOTES-0.1.6.md) §11 (the stable /
opt-in-experimental split with evidence classes). `CORE PATCH BUDGET = 0`; `:3080` and upstream
untouched.

This document is addressed to the **owner**. It does not cut the tag, does not decide the tag name, and
does not move any accepted row. It states what the measurements support, what is open, and what a release
would be allowed to claim if the blockers below were cleared.

---

## 1. Frozen candidate identity

| field | value | source |
| --- | --- | --- |
| candidate id | `cand-v0.1.6-4` | manifest |
| candidate ref | `refs/heads/candidate/v0.1.6-4` → `0d31f9121308a43030701fe6d56c316100782419` | `git rev-parse candidate/v0.1.6-4` |
| candidate commit | `0d31f9121308a43030701fe6d56c316100782419` | manifest; ancestor of `origin/master` |
| product tree | `packages` `6f42b2afe7f40b9a87c66556c294d41d96c76dec` | manifest `product.trees` |
| manifest | `dev/engineering/candidates/cand-v0.1.6-4.json` — **tracked on `master` as of `76a86d6e9`** (#746); byte-identical to the freeze-branch copy `5a5da26a7` (`task/freeze-cand-4`, not an ancestor of the candidate, by ruling D12) | `dev/engineering/candidates/cand-v0.1.6-4.json` |
| manifest file digest | `sha256 c0962acc5eb5cd31c712e5616664cf65495f9cfd1d1d20d5d5bbb534840841cc` | `dev/agent-workflow/evidence/v016-rc1-release-package/cand4-identity.txt` |
| manifest content digest (F0) | `sha256:4d37bf396e26b375f02f496dc09bc065c6a93e4fd30a1bc8eae50281857a17c1` | same |
| host pin | `0.2.0-rc.2 @ 639ed015397290b3745d163aafe02ffee4aa3f84` | `tests/paths.mjs` (read through the manifest) |
| Authority | pointer → snapshot `as20261109r1`, baseline `cb2e41483af8447700fb3c2a25c2686705320692`, **not moved** | manifest; `dev/engineering/current-authority.json` |
| manifest `evidence.status` | `AWAITING_C2` | manifest |

**Verify output (measured, not transcribed).** Running
`node scripts/verify-candidate.mjs --manifest dev/engineering/candidates/cand-v0.1.6-4.json` reports
**`VERIFIED` with `PASS=147`, `MISMATCH=0`, `MISSING=0`, `REFUSED=0`, `UNVERIFIABLE=0`** (exit 0).
Running it again with **both** C2 records reports **`VERIFIED`, `PASS=148`** (one evidence edge added).
Full output: `dev/agent-workflow/evidence/v016-rc1-release-package/cand4-identity.txt` and
`…/c2-presence.txt`.

**C2 records are valid only for the SHA they name.** The only complete C2 pair in this repository is
`dev/agent-workflow/evidence/candidate-v0.1.6-3/C2-A.json` + `C2-B.json`, bound to `cand-v0.1.6-3` @
`17a24e2c302cd991c3ba495ae29576b58a6c1069`. That pair **cannot be re-pointed** at `0d31f9121`, and the
release notes cite it only for the Alpha.6 arms on `cand-v0.1.6-3`. The **new** pair for
`cand-v0.1.6-4` is a separate set of files (§3).

**Documentation drift in the frozen manifest (does not change identity).** `evidence.record_root` still
names `dev/agent-workflow/evidence/candidate-v0.1.6-1`; the freeze generator carried the field unchanged
across cand-1/-2/-3/-4. The verifier does not read that field, so no recomputed identity edge changes —
but the C2-A adjudicator recorded it as **FAIL / manifest documentation drift** and made its correction a
condition of candidate-level eligibility (§3–§4).

---

## 2. The four objective gates

Gate status is the status of the **measurement**. Adjudication status is separate and is what decides
eligibility (§3–§4). "PASS" here never means "releasable".

| gate | question it answers | status | evidence that settles it |
| --- | --- | --- | --- |
| **G1 — Joint acceptance** | Does one v5 Team carrying **both** families (`memberIoCeilings` + `reviewRouting`) really run on a real Host, arms `J01–J11`? | **PASS** — `11 PASS / 0 FAIL / 0 NOT_REACHED`, twice, field-by-field identical on the final joint tree; C2-A reproduced 11/11 twice on `cand-v0.1.6-4`; C2-B signed the same result (S7) | `dev/agent-workflow/evidence/joint-acceptance/README.md`; `dev/agent-workflow/evidence/candidate-v0.1.6-3/ADJUDICATION.md` (joint 11/11 ×2); C2-A and C2-B records (§3) |
| **G2 — Stable Alpha.5 governance** | Do the seven A1 clauses hold on the real OS and the ledger, and do they survive with `alpha6ReviewRouting` explicitly off on the plane-takeover composition? | **PASS** — A1 `7/7 ×4` on two trees; A6-off plane-takeover `7/7` twice, agreeing field-by-field with a same-tree A6-on control (`7/7`); independently re-run by C2-B on the candidate SHA (A1, `7/7` twice) | `tests/kits/a1-bash-governance-20261112/README.md`; `dev/agent-workflow/evidence/a1-bash-governance/README.md` (+ `a1-agreement.json`, `a1-agreement-current-tip.json`); `dev/agent-workflow/evidence/a6off-plane-takeover-20261113/README.md` (+ `a6off-agreement.json`, `a6on-vs-a6off-agreement.json`); C2-B (§3) |
| **G3 — Alpha.6 opt-in arms** | Do allow / deny / exception / Stop / crash each behave as claimed on a real Host, twice, with durable ledger evidence? | **PASS** as measured — C2-A ran all five arms twice each on `cand-v0.1.6-4`; C2-B independently measured the crash windows and the Sticky Stop arms on the same SHA. Both records still refuse the **candidate-level** claim (§3) | `dev/agent-workflow/evidence/candidate-v0.1.6-3/C2-A.json` + `C2-B.json` + `ADJUDICATION.md` (cand-3, other SHA); C2-A / C2-B for `cand-v0.1.6-4` (§3) |
| **G4 — Packaging / install chain** | Does `pnpm pack` → clean-Host `dsh plugin add` → Team/Member/Goal/Stop/cold-boot run, and is rollback exact? | **PASS** — `33/33` driver checks and `39/39` live checks, twice per adjudication, tarball identity equal, installed tree = packed tree, rollback byte-exact; C2-A reproduced `33/33 + 39/39` twice on `cand-v0.1.6-4`; C2-B re-checked `16/16` packaging arms with the same tarball sha256 | `dev/agent-workflow/evidence/packaging-v016-20261112/README.md`; `dev/agent-workflow/evidence/candidate-v0.1.6-3/packaging-agreement.json`; `dev/agent-workflow/evidence/candidate-v0.1.6-3/ADJUDICATION.md`; C2-A / C2-B (§3) |

**What none of the four gates measures** (carried into §4–§5): rates/stability beyond two agreeing
worlds; real vendor-model behaviour; OS-level network isolation; any upgrade protocol; PD-42's
approved-`bash` ceiling conjunction; `Goal ∧ plane-takeover ∧ A6-off`; the operator re-issue path. These
are **refused** claims, not pending gates.

---

## 3. The C2 pair for `cand-v0.1.6-4` — present, verifying, and still not eligible

C2-A and C2-B must both exist **for this SHA** and both must **verify** against this manifest, before a
candidate-level release claim exists on `0d31f9121`. **Both conditions now hold.** That is necessary, not
sufficient: **both records return `candidateClaimEligibility.eligible: false`**, and C2-B's overall
verdict is `NOT PASS (candidate claim not eligible from this record)`.

| record | present? | verifies against `cand-v0.1.6-4`? | what it says |
| --- | --- | --- | --- |
| **C2-A** | **YES**, adjudicator worktree `.worktrees/c2a-cand4/dev/agent-workflow/evidence/candidate-v0.1.6-4/C2-A.json` (`sha256 0823170e…`) — **not committed** | **YES** — `verify-candidate --record` → `PASS`, `recordClass=CANDIDATE-C2`, `candidateCommit=0d31f9121…` | **`PASS`, scoped `C2-A only`, `eligible: false`.** Reproduces: identity 147/147; A6-off A1 `7/7` twice with same-tree A6-on control; joint `11/11` twice; A6 allow/deny/throw/exception/Stop/crash twice each; packaging `33/33 + 39/39` twice; PD33-SUPERSEDED pin and host-free test `14/14`. Its `eligibleIf` requires **C2-B measured with a PASS** and the **manifest `evidence.record_root` corrected by a new manifest commit**. |
| **C2-B** | **YES**, adjudicator worktree `.worktrees/c2b-cand4/dev/agent-workflow/evidence/candidate-v0.1.6-4/C2-B.json` (`sha256 1e05deaa…`) — **not committed** | **YES** — `verify-candidate --record` → `PASS`, `recordClass=CANDIDATE-C2`, `candidateCommit=0d31f9121…` | **`NOT PASS`; `eligible: false`.** Signed S1–S8: A6-off `7/7` twice (legacy Leader deciders 11/11, no Officer wake, identical blueprint document), #738 lifecycle gate, pd33 supersession, packaging `16/16`, both crash-window behaviours, joint `11/11` twice, two attack suites. Refused R1–R7: general "A6-off zero regression", PD-42's A1 conjunction, "durable Sticky Stop" (PD-40 reproduces, arm B 4/4), universal delivery of accepted wakes, notes/register agreement on PD-43, operator re-issue, and "#745 artifacts back the #745 claims". |

Snapshot with paths, sha256s, both record verdicts/eligibility and the verifier output:
`dev/agent-workflow/evidence/v016-rc1-release-package/c2-presence.txt`.

**Consequence.** A release decision taken now would have **two independent adjudications on the same SHA,
both explicitly withholding the candidate-level claim**. That is stronger evidence than the
`cand-v0.1.6-3` refusal, not weaker: the measurements are green where they were taken; the adjudicators
refuse because the claims a release would make are broader than the instruments on this tree.

---

## 4. Open items, with severity

Severity is for the **`v0.1.6-rc.1` decision**, not a product priority queue. "Blocks" names the claim it
blocks, not a matrix grade.

| # | open item | severity | what it blocks / what is true | evidence |
| --- | --- | --- | --- | --- |
| **O1** | **No candidate-level eligibility on `cand-v0.1.6-4`** | **Blocker** | Both C2 records exist and verify, and **both return `eligible: false`**; C2-B's verdict is `NOT PASS`. C2-A's conditions (C2-B measured **with a PASS**; manifest `record_root` corrected by a new manifest commit) are not met: C2-B did not pass the claim, and no manifest correction commit exists. | §3; `…/candidate-v0.1.6-4/C2-A.json`; `…/C2-B.json`; `dev/agent-workflow/evidence/v016-rc1-release-package/c2-presence.txt` |
| **O2** | **Frozen manifest `evidence.record_root` drift** | **High** (identity/bookkeeping) | C2-A records it as FAIL and requires correction **by a new manifest commit**. A new manifest commit changes the **manifest digest**, so any record that cites the old digest must be **re-verified** against the corrected manifest; do not assume it carries over. | `…/candidate-v0.1.6-4/C2-A.json` `manifestFindings`; `cand4-identity.txt` |
| **O3** | **PD-40 — Sticky Stop is latch-scoped** | **High** for the experimental surface; none for Alpha.5 | A Stop between asks (or after restart before the next ask) writes **no durable marker**; the next wake can activate a "stopped" reviewer. **C2-B reproduces it on `cand-v0.1.6-4`** (arm B 4/4; control arm A 6/6). Not fixed. Blocks any "durable Sticky Stop" claim. | `PRODUCT-DEBT-REGISTER.md` PD-40; `dev/agent-workflow/evidence/v016-fix/README.md` §2; `dev/agent-workflow/evidence/wp1-sticky-stop/`; `candidate-v0.1.6-3/C2-B.json`; C2-B for `cand-v0.1.6-4` (§3) |
| **O4** | **PD-42 — approved-`bash`-out-of-lane conjunction unmeasured** | **High** for the composition claim | The v5 gate is fixed and the joint composition runs, but **no kit issues an approved command that targets outside the ceiling** (`J04` `realmTerminalFacts=0`; A1-2's out-of-lane write is refused before any approval). C2-B leaves it UNMEASURED (A7/R2). | `PRODUCT-DEBT-REGISTER.md` PD-42; `dev/agent-workflow/evidence/joint-acceptance/README.md`; `candidate-v0.1.6-3/C2-B.json` `refusedClaims`; C2-B A7 (§3) |
| **O5** | **`Goal ∧ plane-takeover ∧ A6-off` unmeasured** | **Medium** (claim gap) | The A1 kit has no Goal arm and drives no rounds; the nearest A6-off goal evidence does not mount the plane takeover. C2-B R1 names this as the limit on "zero regression". | `dev/agent-workflow/evidence/a6off-plane-takeover-20261113/README.md` ("NOT MEASURED"); C2-B R1 (§3) |
| **O6** | **No upgrade protocol** | **Medium** | No version negotiation, no data migration, no compatibility contract. Rollback = re-installing the previous tarball (byte-exact swap measured). `0.1.5 → 0.1.6` was **never measured**. | `dev/agent-workflow/evidence/packaging-v016-20261112/README.md` §7; `candidate-v0.1.6-3/ADJUDICATION.md` |
| **O7** | **No second-machine-class install** | **Medium** | Every install/package measurement is on **this** machine and this host pin; no second OS/arch/machine class was exercised. Blocks a portability claim, not the measured local chain. | `dev/agent-workflow/evidence/packaging-v016-20261112/README.md` §0 ("measured on this machine in this lane") |
| **O8** | **No npm publish / provenance test** | **Low** | Distribution is the annotated tag + GitHub Release + tarball; npm is **not used** and provenance was not tested. Blocks an npm-distribution claim only. | `RELEASE-NOTES-0.1.6.md` header + §11.4; `candidate-v0.1.6-3/ADJUDICATION.md` |
| **O9** | **PD-39 Gap 2 residual** — decided-dead-invocation terminal abandonment | **Low** (disclosed, by design) | An allow decided before a crash, dead before consumption, is terminally abandoned at boot (`CONTROL_REQUEST_ABANDONED`); recovery is re-issue, no auto-redelivery. Not a blocker; must be stated. | `dev/agent-workflow/evidence/pd39-inbox-window-20261112/README.md`; `docs/runbooks/REVIEW-WAKE-ACCEPTED-NOT-CLAIMED.md` |
| **O10** | **#745's committed composition artifacts are stale/misdescribed** | **Medium** (evidence integrity) | The committed `composition-a6-{on,off}/a1-composition.json` carry a null blueprint digest and a schema the frozen kit no longer emits; the README's "every request `reviewAuthority: leader`" is false for the five `team-tool-execute` plane legs. The **substantive** #745 claims reproduce on the frozen instrument (C2-B A1/S1/S2), so this is an artifact defect, not a false measurement. Not corrected here (another lane's frozen evidence); the release notes now rely on the fresh measurement and do not quote those digests. | `dev/agent-workflow/evidence/a6off-plane-takeover-20261113/composition-a6-on/a1-composition.json`; `…/a6off-run1/a1-ledger.json`; C2-B A9/R7 (§3) |
| **O11** | **Release notes asserted PD-43 open in four places** | **Medium** (documentation truth) | C2-B A10/R5 refused the notes on this point. **Corrected in this package** by the appended, dated §11.6 of `RELEASE-NOTES-0.1.6.md`; the refusal was issued against the pre-correction text and stands as issued. | C2-B A10/R5 (§3); `RELEASE-NOTES-0.1.6.md` §11.6; `PRODUCT-DEBT-REGISTER.md` PD-43 row; `76293c79f` (#738) |

Additional refused claims (not open items, because there is no plan to measure them for this RC): rates
or stability beyond two agreeing worlds; real vendor-model behaviour; OS-level network isolation; the
operator re-issue path as a **measured** path. See `RELEASE-NOTES-0.1.6.md` §11.4.

---

## 5. Recommendation

### **NO-GO for `v0.1.6-rc.1`.**

The measured product surface is green on `cand-v0.1.6-4`: identity verifies, and both C2 records
independently reproduce joint 11/11 twice, A1 A6-off 7/7 twice with an A6-on control, the A6 arms, and
packaging twice with a byte-identical artifact. **The blocker is not the surface; it is eligibility.**
Both adjudications — on the same SHA, with no coordination — **explicitly withhold the candidate-level
claim**, and C2-B's verdict is `NOT PASS`.

1. **C2-A withholds eligibility.** Its `eligibleIf` is unmet: C2-B was measured on this SHA but did
   **not** produce a PASS of the release claim, and the frozen manifest's stale `evidence.record_root`
   has not been corrected by a new manifest commit.
2. **C2-B refuses the claims a release would make.** PD-40 reproduces on this SHA (so "durable Sticky
   Stop" stays refused); `Goal ∧ plane-takeover ∧ A6-off` and PD-42's approved-`bash` out-of-lane
   conjunction have **no instrument**; the operator re-issue path is unmeasured; the #745 evidence
   artifacts do not support their own README in part; and the notes were stale on PD-43 (now corrected
   here, but the record stands as issued).
3. **A GO would have to override two independent adjudications.** That is not a risk this document is
   willing to recommend to the owner.

### If the owner later clears the blockers, what the release would be allowed to claim

- **Stable (Alpha.5), exactly:** the A1 seven clauses (S1); the A6-off plane-takeover result **restricted
  to the seven clauses on that composition** (S2), not "Alpha.5 behaviour is unchanged"; and the scope
  clarification that the Alpha.5-only composition's governed `bash` is typed-shut by design and pd33's
  arm is superseded (S3). Nothing more.
- **Opt-in experimental (Alpha.6), default OFF, exactly:** Officer review routing allow / deny /
  exception / Stop / crash as measured (E1), with **PD-40 disclosed as a live limitation** (E2) and
  **PD-39 Gap 2's terminal abandonment + re-issue recovery** disclosed (E3). Both remain experimental;
  presence in the artifact is not promotion.
- **Nothing from the refusal list** (`RELEASE-NOTES-0.1.6.md` §11.4): no rates/stability, no real
  vendor-model behaviour, no OS-level network isolation, no upgrade protocol, no PD-42 conjunction, no
  measured operator re-issue path, no `Goal ∧ plane-takeover ∧ A6-off`.
- The release notes' stable/experimental split (§11) is the ceiling on the language; the four gates in
  §2 are measurements, not an eligibility grant.

**Minimum path to a GO recommendation** (ordered, no shortcuts): (1) close the claim gaps the records
name — instruments for `Goal ∧ plane-takeover ∧ A6-off`, PD-42's approved out-of-lane `bash`, and the
operator re-issue path — or narrow the claims in a new candidate's brief; (2) either fix PD-40 or scope
Sticky Stop as latch-only; (3) have the #745 artifacts corrected by their owner and re-measured; (4)
correct the manifest `evidence.record_root` by a **new manifest commit** and re-verify identity; (5)
re-freeze if the product SHA moves, then run **C2-A and C2-B again** on the resulting frozen identity.
Until then the answer is **NO-GO**.

**The tag itself is the owner's decision.** This document recommends, and stops there.

---

## Appended 2026-11-13 (after #747 merged) — four statements are superseded by the tree; **the recommendation does not change**

This is an **append-only correction**. The body above is kept exactly as written and is not rewritten;
where a sentence below disagrees with the body, the body is **superseded**, not deleted. Nothing here
upgrades a claim, moves a `V@B` cell or changes §5: the blocker is still eligibility, and the answer is
still **NO-GO for `v0.1.6-rc.1`** on `cand-v0.1.6-4`. Two facts moved since this document was written:
#747 (this package) merged, and the closing branch `task/v016-closing-20261113` landed four items.

**1. The C2 pair is now committed — "not committed" in §3 is superseded.** Both records for
`cand-v0.1.6-4` are byte-identical copies under version control at
`dev/agent-workflow/evidence/candidate-v0.1.6-4/` (adjudicator worktrees were the only copy before):

| record | committed path | sha256 | verify (`--manifest dev/engineering/candidates/cand-v0.1.6-4.json`) |
| --- | --- | --- | --- |
| C2-A | `dev/agent-workflow/evidence/candidate-v0.1.6-4/C2-A.json` | `0823170ed5937f2160072af11aac3e5b7dac5dd8198187f2dd2aa7e95a9618ec` | `PASS`, `recordClass=CANDIDATE-C2`, `eligible=false`, `candidateCommit=0d31f9121…` → `VERIFIED … PASS=147`, exit 0 |
| C2-B | `dev/agent-workflow/evidence/candidate-v0.1.6-4/C2-B.json` | `1e05deaa40ac99dbb29ed1604f0305c11c4a1997359df5180b28cb369c5e64a6` | `PASS`, `runId=c2-b-cand-v0.1.6-4-20261113`, `eligible=false` → `VERIFIED … PASS=147`, exit 0 |

With both records supplied the verifier reports `VERIFIED … PASS=148` (exit 0); the no-record baseline
is 147. **Nothing about eligibility changed:** both records still return
`candidateClaimEligibility.eligible: false`, and C2-B's verdict is still
`NOT PASS (candidate claim not eligible from this record)`. Committing an adjudication does not turn it
into a pass; §5 items 1–3 stand verbatim. Transcripts: `…/candidate-v0.1.6-4/verify-C2-A.txt`,
`verify-C2-B.txt`, `verify-both.txt`; the README in that directory records the same facts.

**2. The stable ceiling is S1–S4, not S1–S3.** The §5 bullet "what the release would be allowed to
claim" lists S1/S2/S3 and says "Nothing more"; `RELEASE-NOTES-0.1.6.md` §11.1 now carries a fourth stable
row, **S4** — *governed `bash` requires the plane-takeover composition* — with the operator consequence
below the table (a pre-#730 composition's governed `bash` is typed-shut with
`A5_NATIVE_ADMISSION_UNAVAILABLE`; no approval request, no execution; it stays that way until the
takeover is mounted). S4 is a **configuration prerequisite stated as a product fact**, not a new
capability and not a duplicate of S3: S3 records the measurement and the supersession of pd33's `FAIL`,
S4 records the prerequisite, its code anchors (`native-bash-tool.mjs:97-102`, `agent-bindings.mjs:3135`
/ `:3390`) and the upgrade path (`docs/INSTALL.md` §3.6). A release built on these notes may therefore
claim governed `bash` **only on the plane-takeover composition** — which is exactly what S2 measured.

**3. The manifest `evidence.record_root` drift is frozen history, and its recurrence is now prevented
— O2 and §5(4) still stand.** No frozen manifest was rewritten: `cand-v0.1.6-2/-3/-4.json` still contain
`"record_root": "dev/agent-workflow/evidence/candidate-v0.1.6-1"`, so `freeze-candidate --check` on them
reports `DRIFT evidence.record_root` and C2-A's `manifestFindings` stays true as issued. What changed is
the **generator**: `scripts/freeze-candidate.mjs` now derives the root from `--candidate-id`
(`recordRootFor()`; `cand-<x>` → `…/evidence/candidate-<x>`), pinned by a host-free test
(`tests/s2-authority/freeze-candidate.test.mjs`, 12 cases, including a negative control that the string
`candidate-v0.1.6-1` cannot appear in a manifest frozen under another id, and a case asserting the frozen
manifests keep their stale text). `--check` on `cand-v0.1.6-1` — the only manifest CI checks — remains
**CLEAN**. The next freeze derives a correct root; **the correction of `-4`'s own manifest still requires
a new manifest commit** (§5 step 4), and no such commit exists, so §5's minimum path is unchanged.

**4. PD-40 now carries an owner ruling; it is still a disclosed limit, not a fix — O3 stands.** The
owner ruled (2026-11-13) that PD-40 is an **accepted opt-in-experimental limit for the v0.1.6 Preview**
provided the text never promises more than the code delivers; a full session-scoped durable marker is
**deferred** (design change with crash semantics), and **no unconditional-stop claim is permitted**. The
two sentences that over-claimed were corrected in `RELEASE-NOTES-0.1.6.md` — §1's "durable human-Stop
marker" and §2.2's "may not survive" — and an appended before/after correction record quotes both. This
satisfies the *wording* limb of §5 step (2) ("or scope Sticky Stop as latch-only"): the notes now say the
durable marker is written **when a review wake latch exists** and that a Stop with no live wake writes
nothing and is not persisted. It does **not** satisfy step (1), (3), (4) or (5), it does not upgrade E2,
and it does not move C2-B's verdict — "durable Sticky Stop" remains a refused claim.

**What this append does not touch.** #748's A6-off evidence re-cut was **not on `master`** when this was
written (the work exists only on `origin/task/a6off-evidence-refresh-20261113`), so nothing here relies on
it; §2's four gate measurements, §3's verdicts, O1's blocker, O4–O11 and §5's recommendation are
unchanged. Gates re-run on the closing branch after the rebase onto #747: generator test 12/12,
`a5sf-debt-register` 10/10, `lint-identities` clean, `docs-probe --base origin/master` blocking=0,
`docs-sync --check` findings=0.
