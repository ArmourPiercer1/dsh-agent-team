# Alpha.6 Lane 2 — Round-1 report (2026-10-30 / 2026-10-31 real UTC)

> **Reading note for a reader on `master`.** This memo reports on Lane 2's branches; it does not
> describe this tree. The code it names (`packages/runtime/review-mandate/`,
> `packages/runtime/review-wake/`, the p4t6 booking `alpha6-pr3.json`) lives on
> `alpha6/lane2-s0-20261030` and `alpha6/lane2-pr3-wake-20261030`, **not** on `master`, and nothing here
> claims otherwise. It is filed on a docs-only branch so the round's numbers, verdicts and open rulings
> have one durable, reviewable home next to the S0 revalidation that preceded them; every measurement is
> reproducible from the SHAs it names on those branches.

> **Status of this file.** A lane-internal round report, **not** Current Authority. The repository's
> current authority is unchanged: `dev/engineering/current-authority.json` → Alpha.5
> (`alpha5-tool-io-governance`). Nothing here changes it, wires anything to `allow`, or enables
> anything by default. Owner: the Lane 2 integrator session in the independent clone
> `/home/armourpiercer/projects/dsh-agent-team-lane-2`. Cross-lane channel: GitHub only
> (PR #501, PR #503, Issue #502).

## 1 · Where lane-2 stands against the design baseline

| anchor | value |
| --- | --- |
| design source | PR #319 (Closed, never merged) `docs/plans/memo/alpha6-review-separation/architecture.md`, head `e3158780533997acfe4fdc92023301504b16a77a`, originally reviewed against `master @ fe8290381d1518ff437b6…` |
| re-review baseline | `origin/master @ 12cc9843e840849e7f831d513fdcd83b0813a921` = the starting HEAD of this clone |
| distance travelled by the design | `fe829038..12cc9843e` = **942 commits**; inside Alpha.6's blast radius: `control/**` 1 commit, `operation-permission/**` 3 |
| host pin | DSH `0.2.0-rc.2 @ 639ed01539…`, pristine read-only source, **CORE PATCH BUDGET = 0 — still 0** |
| lane-2 branch chain | `12cc9843e` (master) → `4c2da8e96` → `fe551196e` → `60016ed2b` → `3e1d28464` (**PR #501** head: PR0 review-mandate lane) → `fd6c08ddd` → `92fef05c8` → `ab56a5146` → `f56b67e07` → `9a030b28c` → **`ee4c0e437`** (**PR #503** head: PR3′ review-wake lane); the report branch forks at `12cc9843e` → `bf02f582e` → `7c81a0871` (**PR #505**) |

Two independent new lanes (`packages/runtime/review-mandate/`, `packages/runtime/review-wake/`),
**219 new legs (128 + 91)**, **zero protected files touched**, **zero production importers** — both lanes are
dormant by absence of import, verified from disk by the hygiene specs and independently re-grepped
by the reviewer.

## 2 · S0 verdict: **CONDITIONAL PASS**, and all three conditions are being honoured

Recorded in `docs/plans/memo/alpha6-review-separation/s0-revalidation-20261030.md` §0: the
architecture is viable with **no `CORE_SEAM_BLOCKER`** — it can be built without touching upstream
DSH — subject to three conditions that must hold as implementation proceeds:

| condition | content | how it stands after round 1 |
| --- | --- | --- |
| **C1 protected center** | Every Alpha.6 *decision-entry* change lands inside the ARC-A digest-pinned 33-file protected center, so it must be a **named Center-Interface PR + an `arc-a-protected-center.json` override entry** (precedents #377/#391/#392), never a quiet feature PR. | **Honoured by construction so far:** PR0 and PR3′ touch ∅ protected files (`u6-arc-a-fitness` 12/12 on both PRs). The genuinely C1 work — **PR-I1** (admission OR-branch: `kind-role table ∋ role` **OR** `approvalCaseId` present ∧ valid mandate bound to `callerOf(caller)`) and **PR-I2** (delivery + host-fact ingress into `agent-bindings.mjs` / `root.ts`) — is **named and not yet opened**. That is where the protected center will actually be asked for something, and it is where I am asking the user for a ruling (§9a). |
| **C2 same-machine resource isolation** | Two clones' port leases are mutually invisible (lease files live inside each clone), the shared `/srv` host baseline does not exist on this machine, and BOOT-BUDGET is a git ledger, not runtime mutual exclusion. **Real-Host concurrent boot is forbidden.** | **Honoured by refusal:** PR3′ and PR0 contain **zero** real-Host (C2) legs. Both the design memo and both PR bodies list the C2 obligations and where they must be re-run (final merged HEAD, single-owner machine). They are recorded as `ENV_REFUSED`, never as PASS. |
| **C3 CI visibility** | Every workflow triggers on `pull_request: branches: [master]`, so a PR based anywhere else gets **zero hosted CI**. | **Disclosed, not hidden:** PR #503 is stacked on PR #501's head, so it has no hosted checks — stated in its description, with every leg executed locally at the head SHA and the single named skip named. PR #501, based on master, **did** run hosted CI: 10 pass / 1 skip / 1 fail, and that one fail is the settlement gate refusing to settle a PR that carries a `DO-NOT-MERGE` marker (§8.5.1), i.e. the marker working. |

## 3 · Original design decisions: kept, revised, vetoed

**Kept (evidence supported them, no revision needed)**

- **P-1** no new permission rung: an Approval Officer is an ordinary Member Instance holding a
  limited `ReviewMandate`.
- **P-2** `ReviewAssignment` expresses assignment only and grants nothing; the single
  ControlService/TeamDomain path remains the only authority.
- **P-3** `handoff` (peer transfer) ≠ `escalateApprovalLeg` (`control/service.ts:4786`: a real rung
  transition writing `control-request-escalation-recorded` and advancing the leg).
- **P-4** the scheduler owns non-authoritative scheduling state only; no second approval ledger.
- **P-5** no claim of physical exactly-once across TeamDomain and the DSH inbox; crash recovery,
  dedupe, fencing, Stop and fail-closed are designed in instead.
- **P-6** teams that do not enable Alpha.6 keep the old behaviour; the old and new notifiers must
  never both deliver the same approval path.

**Revised (the current code gave a stronger form than the design assumed)**

- **R-1** `ReviewPlan` upgraded from "configuration suggestion" to **hard precondition**: a mandate
  may only be derived from a trusted `ReviewPlan` pinned to the current Team/Blueprint hash and
  epoch; model text and a self-declared `callerRef` are invalid. Forced by §2.1: a member decider
  is *legally reachable in the persisted grammar today*.
- **R-2** the case-scoped mandate's landing shape fixed: a new ledger fact family (granted/revoked,
  same `putEntry`, same `withTeamLock`) plus a `mandates` slice derived in
  `buildApprovalCaseState` (`control/service.ts:4363`) — no assertion bolted onto the Case row.
- **R-3** the admission predicate must be the OR form, and the **OR branch must be gated on
  `approvalCaseId` being present**: merely widening the role table would give unlegged
  historical/PA rows a member resolver too.
- **R-4** delivery is a **new delivery face with the old path explicitly preserved**, not a
  retrofit of `deliverRootControlNotification`: the same file already contains the correct
  precedent (`deliverRootWorkCompletionNotification`, `agent-bindings.mjs:5203-5256`,
  acceptance-only + plugin attribution), against the defect at `:5030-5033`.
- **R-5** single-flight dedupe fixed concretely: the host has no idempotency key, but the inbox
  enforces uniqueness of *pending* messages by `message.id` and throws synchronously
  (`agent-loop/src/inbox.ts:223`) — so a **plugin-minted deterministic `MessageId`** is a
  host-backed dedupe primitive. Uniqueness covers pending only, which is exactly why PR3′ has a
  recovery fold.
- **R-6** `ReviewAssignment` must land with its projection-category booking **in the same PR**: the
  projection fold throws `TEAM_PROJECTION_SOURCE_LEDGER_CATEGORY_UNKNOWN` on an unknown
  `factType`, so a fact family without its category is a runtime fault, not a TODO.

**Vetoed**

- **V-1** "implement Reviewer by widening `CONTROL_RESOLVER_ROLES`" — `control/types.ts:193-197` is
  a carrier-kind closure; widening it breaks invariant 37 and reaches unlegged rows.
- **V-2** "the scheduler decides who handles this" — routing is deterministic code; a router with
  missing input fails closed to the Leader.
- **V-3** any Blueprint v3 schema change in this round — per-team opt-in rides existing unvalidated
  Host pass-through flags under `config.teamToolPlane` (precedents `jobsEnabled`, `centerAssembly`,
  `uiFamilyEnabled`), default = zero behaviour flip.

**Amendments produced by implementation, not by design** (each landed in code + a leg, and is
recorded in the PR3′ memo §7): the wake **store key IS the slot triple** (so creating the first
slot contends on the same key as updating it, making invariant 1 store-atomic rather than
check-then-create); **event ingress is not authenticated by the kernel** — `wakeId` is a digest
over a public tuple, so PR-I2 must source `claimed`/`turn-ended`/`resume` from host facts only;
and the **`hasReadyWork` false-negative window is a disclosed liveness bound**, not a bug to hide.

## 4 · Alpha.5 ↔ Alpha.6 interface dependency and collision list

Dependency direction: **Alpha.6 consumes Alpha.5's frozen surfaces; Alpha.5 consumes nothing from
Alpha.6.** Full matrix: `.artifacts/alpha6-s0/C-ownership-matrix.md` (read-only analysis).

* **Pinned by ARC-A (33 files, digest-locked):** `control/**`, `operation-permission/**`,
  `governance-center/**`, `tool-admission/**`, `tool-dispatch/**`, `agent-bindings.mjs`,
  `pa-mount-registry.mjs`. **Not** pinned: `root.ts`, `team-tool-plane.mjs`.
* **Good news the matrix established:** the generic family-mount seam the design called missing
  **has landed** (`docs/PARALLEL-INTEGRATION.md` §4a), so a review family can mount without
  editing the plane; and Alpha.6 needs **no Blueprint schema change** (opt-in via
  `config.teamToolPlane` pass-through).
* **CTL-1 (repeated-wake debt) is only half solved upstream:** the host fires
  `port.notifyLeaderRequest` for a newly-created request only
  (`control/leader-notification.ts` + `service.ts:2533-2544`), so repeated-wake suppression is
  Alpha.6's job — which is precisely PR3′.

Collision surface with Alpha.5's *open* work, ranked:

| rank | collision | status |
| --- | --- | --- |
| 1 | **BL-01, a RELEASE BLOCKER in Alpha.5**: `team_bash` default-ask approval penetration — a fix in the ask/approval lane, i.e. the same lane Alpha.6 delegates within | Not mine; **sequencing question for the user (§9c)** |
| 2 | U7-R3 L4 legs of `read_image`/`ask_user_question`/`present` run **through the leader-rung ApprovalCase** that Alpha.6 proposes to delegate | Prospective; concentrates in **PR-I1** (the admission OR-branch) |
| 3 | shared mutable files: `packages/tools/families/manifest.json` (digest-booked per family PR), `tests/world-factory/**` (109 non-merge commits, hottest tree in the repo), `dev/agent-workflow/ledgers/u7-tool-acceptance.json` | **No collision yet** — PR0/PR3′ touch none of them |
| 4 | census bookings and the projection-category registry (R-6) | Managed by booking discipline; PR0 and PR3′ each booked their own file set |

Measured fact worth stating: PR0 and PR3′ add files in **new lane directories only**, which is why
the collision list above is prospective. The moment PR-I1 edits `control/**`, ranks 1–2 become live.

## 5 · CI and same-machine resource isolation, as measured

**Hosted CI, PR #501 (base = master, so CI runs), head `3e1d28464`:**

```
pr-gate pass · ci-required pass · ci-fast pass · ci-full pass (19m57s) · ci-integration pass
ci-security pass · census-runtime pass (18m37s) · candidate-protection pass
synthesize-merge-tree pass · ci-required-deferred skipping
pr-settlement-gate FAIL  →  DSH-SETTLEMENT-VERDICT BLOCKED-BY-MARKER marker=title-prefix
```

That failure is **the `DO-NOT-MERGE` marker doing its job** (§8.5.1: while the marker is open,
settlement is refused), and with `enforce_admins=true` on master's required checks it is the
mechanism that makes accidental merge impossible rather than a defect to fix. Two related
findings: (a) earlier in this round hosted CI was legitimately red on my branch with
`check-artifacts-committed verdict=stale drift=16` because I had not co-committed the rebuilt
`dist` — fixed in `60016ed2b`, and the law is now stated in both PR bodies and the p4t6 booking;
(b) **`pr-settlement-gate` reads settlements from PR comments whose first line matches
`**[dated settlement, YYYY-MM-DD …]**` and which contain the 40-hex head SHA** — my review
settlements were prose with a different opener, so `candidates=0`. I have deliberately **not**
posted a machine-shaped settlement, because it cannot settle a marked PR and would read as a merge
recommendation the user has not authorised; the format is recorded so it is executable at the
merge decision.

**Hosted CI, PR #503 (base ≠ master): zero checks reported — disclosed, not omitted.** Locally at
`f56b67e07`: `pnpm build` 0 · `pnpm typecheck` 0 · eslint clean · lane suite **258/258** ·
`ci-pr-gate` `pass=8 fail=0 skip=1` (skip named: `census`, whose in-repo counterpart is the p4t6
suite 20/20) · `eb3-security-run` `verdict=PASS suites=19 passed=254 failed=0` exit 0 ·
`check-artifacts-at-head verdict=ok compared=1919 drift=0` · `docs-sync --check findings=0`.
**Full-repo `vitest run`, three measurements, all logged under `.artifacts/alpha6-s0/`:**

| head | files red / total | tests red / green | lane specs red | delta vs the `60016ed2b` baseline (53) |
| --- | --- | --- | --- | --- |
| `fd6c08ddd` (concurrent with my own work) | 52 / 658 | 19 / 8240 | none | +1 `a5p4-lane-hygiene`, which is green 8/8 alone |
| `ab56a5146` (idle) | 51 / 658 | 16 / 8244 | none | **zero new**, 2 baseline failures now green |
| `f56b67e07` (idle) | 54 / 658 | — / — | **2: `a6-pr0-lane-hygiene`, `a6-pr3-lane-hygiene`** | +3 |
| **`9a030b28c`** (idle) | **53 / 658** | **18 / 8246** | **none** | net 53: `a5p4-lane-hygiene` in (green 8/8 alone, third confirmation), `a5-cancel-glob` out |
| **`ee4c0e437`** (idle) | **52 / 658** | **17 / 8248** | **none** | **zero new failures**, `a5-cancel-glob` out — the round's cleanest measurement |

The third row is a real defect in my own two hygiene specs, found only by a third run: they walk
every package to prove dormancy with `readdirSync` + `statSync`, and the f3a/f3b/f3c and
po-notify suites create and destroy scratch under `packages/testkit/test/.tmp-fault`, which that
walk crosses — so the spec died with `ENOENT: stat '.../.tmp-fault/po-notify-determinism'`
whenever a sibling was mid-cleanup. The two earlier green runs had simply won the race. Fixed in
`9a030b28c`: "gone" is treated as gone for *foreign* trees (a deleted file cannot import a
dormant lane), every other filesystem error still throws, the lane's own founding modules are
still read strictly so the module-set leg cannot pass vacuously, and a deterministic leg — a
symlink to a missing target, which raises ENOENT from `statSync` on every platform — pins that
the walk does not throw, **counts** the vanished entry, and still finds and pattern-matches the
real file beside it. Resilience that quietly became blindness would pass "did not throw" and
fail that leg.

The claim this round rests on is the narrow measured one: *the red set does not grow because of
Alpha.6* — and for one head it did grow, by my own fragility, which is why the claim has to be
re-measured rather than reasoned about.

**Resource isolation.** The two clones cannot mutually exclude on Host resources: port leases live
in each clone's own tree (port band 3180 family per `tests/paths.mjs`), `DSH_HOME` is
in-clone (`tests/homes/<world>`), and the shared `/srv` baseline this machine was supposed to have
does not exist here. BOOT-BUDGET is a git ledger of *planned* starts, not a mutex. Therefore
**this lane runs no real-Host legs at all** and says so in every PR; `:3080` was never touched, and
Lane 1's directory, `.git`, worktrees, test worlds and runtime state were never read, written,
cleaned or borrowed.

## 6 · GitHub artifacts of round 1

| artifact | content |
| --- | --- |
| **PR #501** (`DO-NOT-MERGE`, draft) | PR0: `packages/runtime/review-mandate/` — trusted `ReviewPlan` parsing, mandate derivation/admission, 127 legs; base `12cc9843e`, head `3e1d28464`; hosted CI 10 pass / 1 skip / 1 marker-refusal |
| **PR #503** (`DO-NOT-MERGE`, draft) | PR3′: `packages/runtime/review-wake/` — single-flight wake kernel, 92 legs; five review rounds; base `3e1d28464`, head `ee4c0e437`; round-4 review report and both measurement tables in [comment 6534610525](https://github.com/ArmourPiercer1/dsh-agent-team/pull/503#issuecomment-6534610525) |
| **PR #505** (`DO-NOT-MERGE`, draft, docs-only, base `master`) | **this file**, filed at master's base so a round report is the one Alpha.6 artifact that gets hosted CI: `pr-gate`, `ci-fast`, `ci-integration`, `ci-security`, `candidate-protection`, `synthesize-merge-tree` all pass, `ci-full` and `census-runtime` ran at filing, and `pr-settlement-gate` is red with `BLOCKED-BY-MARKER` exactly as the marker requires. Head `7c81a0871d5a58e0228839038edce47ed880e805`. |
| **Issue #502** | cross-lane interface/ownership table + Lane 2 progress log (four progress comments; the only cross-lane channel in use) |
| commits | `4c2da8e96` S0 docs · `fe551196e` PR0 · `60016ed2b` PR0 review fixes + co-committed dist · `3e1d28464` PR0 review round 2/3 closures · `fd6c08ddd` PR3′ kernel · `92fef05c8` hydration identity + vocabulary single source · `ab56a5146` dead-helper removal · `f56b67e07` round-4 closures · `9a030b28c` race-safe tree walks · `ee4c0e437` round-5 closures |
| no force-push, no amend of pushed history | every fix is a new commit; `master`/`stable` untouched and unpushed |

## 7 · Code, tests and independent review actually completed

* **PR0 (mandate lane):** 128 legs. Review rounds 1–3, ending with a signed verdict "safe to merge
  and ship DORMANT" conditional on two amendments, both folded into code and docs (store-key
  pinning and the false-negative disclosure). Reviewer independently confirmed 127/127, the brand
  mutation flipping `admitted` to true, the vocabulary pinned at three layers, and the security and
  gate legs.
* **Round 5 (post-verdict re-review)** graded only the two commits that followed round 4 and
extended the settlement to `… + f56b67e07 + 9a030b28c`: **"safe to merge DORMANT" survives, no
re-scoping**. It re-ran round 4's one surviving mutation and confirmed the new leg catches it, and
it attacked the walk fix for the failure mode that mattered — could the new tolerance hide a real
importer? `chmod 000` on a planted importer turns the dormancy leg **red** (`EACCES` is not
gone-coded), so no. Its five findings are closed in `ee4c0e437`, and two of them are the most
instructive artifacts of the whole round:

* the collision witnesses in the leg I wrote to close round 4's NEW-3 **were not witnesses** — my
  five triples are distinct under a naive `:`, `|` and `__` join, so the assertion passed for the
  very key the comment said was impossible, and the comment was false;
* a tree walk that reads **zero** files passed the dormancy leg, because the only anti-vacuity
  counted package *names* — proven by giving it one empty package.

Both are now fixed with real fixtures (a genuine separator-collision pair, a 600-triple key sweep,
a per-package non-empty floor, a closed export surface so "exactly one key derivation" is a fact,
and `.tsx` in the walk because PR-I2's wake UI lands there).

A **coverage note** matters more than the verdict itself: the round-4 settlement covers
`fd6c08ddd + 92fef05c8 + ab56a5146`; `f56b67e07` and `9a030b28c` are post-verdict — the first
closing the reviewer's own carried items, the second fixing a defect that only measurement could
find. A focused re-review of the two post-verdict commits is running
(`ec4f0ab8-9d92-4a08-8856-9bb1a754b1ef`), tasked with trying to turn the walk fix's tolerance into
blindness (can a real importer hide behind `ELOOP`, does `VANISHED.count` catch a scan that
silently returns zero files?).

**PR3′ (wake lane):** 91 legs (76 kernel + 14 hygiene) covering the 16-leg design matrix. Review
  round 4 verdict **"safe to merge DORMANT"**, from an 18-sequence external attack suite and an
  11-mutation battery with **10/11 mutations caught**; its three carried items (an unowned guard,
  an unbacked "one exported function" claim in my own memo, and booking prose reading like a
  guarantee) are closed in `f56b67e07`.
* **Defects found before the reviewer by my own suite, all fixed in-branch:** recovery refusing the
  legitimate adopt case; a backoff exponent off by one; an unreachable refusal code; `hydrateWakeSlot`
  trusting a stored `wakeId` (cross-triple wake-token confusion); a hand-copied closed vocabulary
  inside a test; a dead spec helper caught by the gate's lint leg; and two tree walks that died when a
  sibling suite deleted scratch mid-walk (found by a third full-suite run, fixed with a deterministic
  leg). The reviewer's NEW-1 confirms the `hydrateWakeSlot` one independently, on both the broken and
  fixed builds. Two of these six — the stale vocabulary copy and the walk race — were bugs in my
  *verification*, not in the kernel, and both were invisible to a green run.
* **Reviewers used are separate sessions from the implementer**, instructed to execute rather than
  read, confined to `/tmp` mirrors of committed blobs, with porcelain verified empty afterwards.

## 8 · Work packages I can continue without new rulings

1. **PR2′** — deterministic router + the `ReviewAssignment` fact + its projection-category booking in
   the same PR (R-6), with `handoff ≠ escalateApprovalLeg` pinned by legs. New lane directory, no
   protected file, so C1 untouched.
2. **PR4′** — `team_review_defer` behaviour *inside the plugin lane* (defer as scheduling state, never
   as authority), plus the "old notifier and new notifier never both deliver" negative test (P-6).
3. **PR5′** — read-only UI/metrics surfaces over the scheduler's non-authoritative state
   (slot phase, redelivery count, suspend reason), no new authority surface.
   **PR2′ feasibility — CORRECTED 2026-10-31, after PR2′ was actually built and measured (#507).** The
   paragraph below is kept as written, because the correction is only meaningful next to the claim it
   corrects. Its load-bearing sentence was: "the plugin-facing `appendLedger(teamSessionId, entry)`
   exists at `packages/runtime/src/plugin/root.ts:456` and `plugin/durable-mutation-store.ts:218`, both
   **outside** the 33 protected paths". **That is a real code path and it is not a durable one.**
   `root.ts:456-461` appends to a `Map`: `const list = ledgerByTeam.get(team) ?? []; list.push(entry);
   ledgerByTeam.set(team, list)` — no repository, no sequence allocation, no `createdAt`, and the value
   type is `MutationLedgerEntry[]` (`root.ts:396`), not `LedgerEntry`; `durable-mutation-store.ts:218-219`
   is a verbatim delegation to that same object. So this report's own open question — "`MutationLedgerEntry`
   vs `LedgerEntry` may be different stores" — is answered: **they are different stores**, and the one
   named here is the in-memory one.

   What the durable append actually looks like, measured at `f0e567f36`, four precedents all **outside**
   the protected centre (the ledger holds 33 files + 3 overrides; verified by listing them, not by
   trusting this sentence):
   1. `src/plugin/durable-mutation-store.ts:283-300 writePolicyStateTransitionRow(ledger, rootSessionId, …)`
      — takes the OPENED TeamDomain `ledger` repository as a parameter and does
      `await ledger.allocateSequence()` then `await ledger.put({schemaVersion, sequence, rootSessionId,
      factType, payload, createdAt})`. Its doc block states the three laws a writer needs:
      `allocateSequence` is atomic on the domain write chain (allocation order = admission order), `put`
      is idempotent on identical bytes, and a failure propagates to the caller (no silent ack, no retry).
   2. `src/plugin/host.ts:2978-2992 ArtifactLedgerPort.appendGranted` — same shape through
      `domain.repositories.ledger`, with the comment "Allocate + put serialize on the domain's single
      write chain".
   3. `src/plugin/root.ts:4264-4271 factLedgerFor(rootSessionId)` — the composition root **constructs** a
      two-method durable port `{allocateSequence, put}` from `repos.ledger` (choosing `putPreTeam` vs
      `put` on whether the TeamSession record exists yet) and hands it to a governance writer
      (`grantDegradationConsent({ledger: …})`). This is the shape PR2′ needs, already in the tree.
   4. `governance/proposal-store.ts:703/721` — a governance writer that is not protected either,
      declaring its port structurally (`allocateSequence(): Promise<number>`, `put(…)`, `list()`).
   And the read side of the same store: `src/plugin/projection-source.ts:851` folds `repos.ledger.list()`,
   the repository all four writers above write into — so the "does the append land in the ledger the
   projection folds?" question this paragraph said PR2′ must prove **before** writing a fact is answered
   yes, with line numbers.

   **What that changes, and what it does not.** It was wrong to say "if it does not [land in the same
   store], PR2′ collapses back into PR-I1's protected surface, and the answer to ruling (a) becomes urgent
   instead of scheduled" — the store question resolves the other way, so **a durable assignment writer
   does not require editing any protected file**: the port is threaded from `src/plugin/*.ts`, which is
   unprotected, exactly as `factLedgerFor` threads it to governance today. What PR-I1 still has to decide
   is not *where the bytes go* but *who may hand a lane that port and under what single-writer discipline*
   — the four precedents above each scope their writer to one fact family by the writer's own validation,
   and none of them exposes a general-purpose `append` to a tool lane. Ruling (a) therefore stays
   scheduled rather than urgent, and ruling (b)'s C2 question is untouched. Disclosure of a limit: no C2
   leg was run, so "it lands in the durable store" is established by reading the four call sites and the
   projection's read path, not by booting a Host.

   Two more corrections from the same work, both cheaper to state than they were to find. (i) There is no
   `'active'` member lifecycle: the frozen five are `CREATED / RUNNING / SETTLED / ARCHIVED / DISPOSED`
   (`contracts/src/dto/member-instance-record.ts`), so any eligibility rule written against `'active'`
   fails closed and every test stays green — PR2′'s first draft did exactly that. (ii) The R-6 "same PR"
   booking law is wider than this report said: a new `factType` must be booked in the host
   `projection-source.ts` **and** in the client mirror `packages/client/src/model/ledger-adapter.ts` in the
   same commit, with the mirror's *value* pinned by that package's own test, because
   `a4pr0a-fact-type-closed-set` C3 compares the two maps' **key sets only**.

   >>> ORIGINAL TEXT, UNCHANGED (superseded by the above): **PR2′ feasibility, measured rather than
   assumed (found while waiting on measurement):** the

   design's `ReviewAssignment` fact does **not** obviously require a protected file. Three reads
   establish it: `LedgerEntry.factType` is a free-form hygienic string of 1–128 chars validated in
   `packages/storage/schema/ledger.ts` (no closed enum at the store layer); the plugin-facing
   `appendLedger(teamSessionId, entry)` exists at `packages/runtime/src/plugin/root.ts:456` and
   `plugin/durable-mutation-store.ts:218`, both **outside** the 33 protected paths; and the place
   that *does* enforce closure is `plugin/projection-source.ts`'s `FACT_TYPE_CATEGORY` — also not
   protected — which throws `TEAM_PROJECTION_SOURCE_LEDGER_CATEGORY_UNKNOWN` on an unbooked
   `factType`, exactly the R-6 "same PR" law. The one thing PR2′ must **prove before writing the
   fact**: that this append path lands in the same durable ledger that the control projection
   folds (`MutationLedgerEntry` vs `LedgerEntry` may be different stores), and that it runs under
   the same team lock. If it does not, PR2′ collapses back into PR-I1's protected surface, and the
   answer to ruling (a) becomes urgent instead of scheduled.

4. **Booking/doc/discipline maintenance** — census bookings, memo truth-as-of-the-code, and the
   dated-settlement-format preparation for whichever head the user eventually marks mergeable.
   Carried small items from round 5 that belong to PR-I2 rather than a cleanup PR: a symlink-loop
   subtree is skipped silently by the dormancy walk, a package that is itself a symlink is never
   enumerated, and a FIFO named `*.ts` would block a read — all three become worth fixing when
   there is a wake UI whose absence from the walk would actually matter.
5. **Re-measurement** of the full suite and the two C2-carrying claims at each new head, and the
   standing offer to re-run `a5p4-lane-hygiene` when the machine is idle.

## 9 · Rulings I actually need (three; nothing else is blocking)

**(a) May Alpha.6 open a named Center-Interface PR that adds an `arc-a-protected-center.json`
override entry?** PR-I1 (admission OR-branch) and PR-I2 (delivery face + host-fact ingress) cannot
be written without touching protected files, and the ARC-A law says the route is a named
Center-Interface PR + an override entry citing that PR (#377/#391/#392 are precedents). I can open
such a PR under my current authority, but **editing the frozen-surface ledger itself felt like a
user ruling rather than an integrator's choice**, so I stopped before drafting it. Absent a ruling
I will keep shipping C1-free lanes (PR2′, PR4′, PR5′) and hold PR-I1/PR-I2 as written designs.

**(b) C2: how should real-Host legs be run at all?** Options: (i) authorise a cross-clone isolation
protocol — e.g. lane-2 owns a disjoint port band and a lease file both clones honour, which is a
change to shared test infrastructure and therefore touches Alpha.5's hot `tests/world-factory/**`;
(ii) keep refusing all C2 legs from this machine and defer them to a single-owner run at the final
merged HEAD (what I am doing, at the cost of two open C2 obligations); (iii) an explicit
time-partition rule ("lane-2 may boot real Host only when lane-1's runner is confirmed idle"). I
recommend (ii) until PR-I2 needs a real inbox, then (i) as its own infrastructure PR.

**(c) Does Alpha.5's BL-01 (`team_bash` default-ask approval penetration, an open RELEASE BLOCKER
in the ask/approval lane) gate Alpha.6's PR-I1?** Alpha.6 delegates *within* that lane. If the user
wants the delegation designed against the fixed behaviour, PR-I1 should wait for BL-01's shape; if
BL-01 is orthogonal (a guard/ask-lane bug, not a resolver-identity question), PR-I1 can proceed in
parallel and re-verify afterwards. I can start either way, but the re-verification cost is mine to
predict only with this answer.

Everything else in this round was decided inside the lane and is recorded above.
