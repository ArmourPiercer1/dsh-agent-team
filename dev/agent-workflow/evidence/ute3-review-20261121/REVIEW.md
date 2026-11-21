# UTE G1 — independent adversarial review of the retirement evidence

**Reviewer:** independent adversarial (read-only worktree, uncommitted report)
**Worktree:** `.worktrees/ute3-review-20261121` @ `task/ute3-review-20261121`
**Master reviewed:** `2b69193fac66f5b89fb2010ca398de3f5b2ecdb5` (`origin/master`, verified with `git rev-parse origin/master`)
**Ledger revision:** `dev/agent-workflow/ledgers/ute-retirement.json` (schema `ute-retirement/1`, 8 rows)
**Date:** 2026-11-21

---

## Verdict

**`CLAIMS-EXCEED-EVIDENCE`**

The gate, the 237 evidence tokens and the 31 blocking differences are mostly real, but the
two documents an owner will act on overstate the evidence in specific, checkable ways: a
member total that is 7 short, a deletion set that omits 10 of the FS body's 17 files, a WEB
control battery that no test or workflow ever executes while the ledger says the lane suite
re-runs it, a route-C absence claim its own probe refutes, an FS new-path claim its own golden
meta contradicts, a control name that exists nowhere, and a five-group split that
double-counts three differences and silently collapses eight into four. Independently, the
gate itself can be made to print `UTE-RETIREMENT-ALLOW` by (a) deleting the `differences`
list, (b) changing `blocking: true` to `blocking: "yes"`, or (c) supplying a fabricated
approval whose `record` is any committed file containing the word "owner" and whose
`reference` is the repository's **root commit**. I reproduced all three against a `/tmp`
copy of the ledger; no tracked file was modified.

The good news the owner should also see: every `expect` token is genuinely present verbatim,
every `contradicts` string is genuinely absent, every declared old-path file exists, the four
refusal codes named in the release request are real and reachable, the census-derived unit
rule (including `UTE_UNIT_UNDERCLAIMED`) works, the hosted census really ran 18,650 assertions
with `skipped_total=0` on #815's head, and the #810 flake description is accurate.

---

## Blocking findings

### B1. WEB's `negativeControlsPass=true` rests on a transcript that nothing executes, and the ledger says the opposite

- **Claim:** `dev/agent-workflow/ledgers/ute-retirement.json:344` — “The lane suite re-runs the
  transcript and refuses any verdict line that is not GREEN with failed=0.” The release
  request (`RELEASE-REQUEST-2026-11-21.md:45`) and progress board (`PROGRESS-2026-11-21.md:21`)
  grade web's controls `✅ 11 controls`.
- **Evidence:** `grep -rn "negative-controls" tests/ute-g1-web/` returns only the file itself and
  `tests/ute-g1-web/README.md`. `tests/ute-g1-web/lane-suite.test.mjs` has no test that runs
  `negative-controls.mjs`; its 8 tests cover the fixture, corpus, golden stability, design
  claims, refusal mapping, socket corroboration, the socket destination, and the differences.
  No workflow runs it either (`dev/ci/eb3-ci-manifest.json` *claims* the web controls “re-run
  GREEN”, but the census argv at `.github/workflows/census-runtime.yml:434` runs only
  `tests/ute-g1-web/lane-suite.test.mjs`). The gate greps the committed
  `dev/agent-workflow/evidence/ute3-web-b1-20261120/negative-controls.txt`; that file can be
  hand-edited or `git rm`-ed together with the script and every test stays green.
- **Fix:** add a web lane test that re-runs `negative-controls.mjs` and compares its lines to the
  committed transcript (as agentctl/process do), or move the control assertions inline. Until
  then web's `negativeControlsPass` is an unprotected text file, and the ledger note is false.

### B2. The gate accepts three kinds of ledger inflation, including a fabricated approval

- **Claim:** `scripts/ute-retirement-gate.mjs` (file header, and `RELEASE-REQUEST:54-56`) —
  “a ledger edit that claims more than its evidence shows is refused”. `APPROVAL-REQUEST:24-27`
  says the reference must be “a real merge you made”.
- **Evidence (reproduced, `/tmp` ledger copies, tracked files untouched):**
  - Delete `terms.semanticDifferencesResolved.differences` to `[]`, set `verdict: true` →
    `UTE-RETIREMENT-ALLOW family=fs terms=4/4`. Cause: `evaluateDifferences` starts
    `established = true` and only refuses when `differences` is **not an array**
    (`scripts/ute-retirement-gate.mjs:592-598`); an empty array is accepted and never checked
    against the evidence file (which still says `retirement-blocking YES`).
  - Change both FS `blocking: true` to `blocking: "yes"` (or delete the key), set
    `verdict: true` → `ALLOW`. Cause: `const blocking = diff.blocking === true`
    (`:606`); any non-boolean (or absent) value is treated as **non-blocking and skipped**.
  - Fabricate an approval
    `{by:"owner", on:"2026-11-21", record:"docs/plans/memo/ute-g1-20261120/RELEASE-REQUEST-2026-11-21.md", reference:"PR #1 @ e7a91fd16e9d567c4576afbf8b10c59d3c3b15fb"}`
    (that file contains the word “owner”; `e7a91fd…` is the repository's **root commit**),
    set `verdict: true`, `state: RETIREABLE` → `ALLOW`, zero findings. Cause: the record check is
    `expect: [approval.by]` (`:633-636`), i.e. the approver's *name* anywhere in any committed
    file; the reference check only requires the 40-hex to be an ancestor of HEAD
    (`:646-668`) — it never checks that the named PR is the merge, that the commit is a merge at
    all, or that the record mentions the difference id.
- **Fix:** require `differences.length > 0` when the verdict is true; require
  `typeof blocking === 'boolean'` (refuse otherwise); bind the record to the difference id
  (expect `[diff.id, approval.by]` and a `record` that is an approval document), and require
  `git merge-base --is-ancestor` **plus** `git rev-list --merges` containment of the named sha,
  preferably with the matching `PR #n`.

### B3. “20 booked members” is false — the census books 27, and both documents' own rows sum to 27

- **Claim:** `PROGRESS-2026-11-21.md:29` and `RELEASE-REQUEST-2026-11-21.md:49` — “20 booked
  members”.
- **Evidence:** `dev/agent-workflow/ledgers/arc-a-family-census.json` `nativeNames` per booked
  family: fs 4, search 2, web 2, inspect 3, process 2, agent-control 7, ui 2, agent-state 5 =
  **27**. The gate's own derived units print 27 members (`node scripts/ute-retirement-gate.mjs
  --all --json` → `unit.members` lengths 4/2/2/3/2/7/2/5). The `20` is exactly the sum of the
  *declared* `unit.members` arrays, which exclude fs and inspect (both `declared: null`) — and
  the progress board's own `members` column and the release matrix's `unit` column both sum to
  27, so each document contradicts itself.
- **Fix:** “27 booked members”; or state “20 explicitly declared members (fs/inspect are
  derived from the census)”, which would be true but is not what “booked” means.

### B4. The 77-file deletion set omits 10 of the 17 FS body files, so “delete exactly these” does not delete the FS body

- **Claim:** `RELEASE-REQUEST-2026-11-21.md:186-190` — “Expected-deletable old code (77 files,
  by family)”, `fs (7): families/fs.mjs, fs-family/src/{fs-family-contribution,fs-read-contribution,read-row,write-row,edit-row,image-row}.mjs`.
- **Evidence:** `packages/tools/fs-family/src/` actually contains 16 files; with
  `packages/tools/families/fs.mjs` the FS body is **17 files**. The 10 undeclared files are
  `edit-executor.mjs`, `fs-mechanics.mjs`, `fs-mutation-mechanics.mjs`, `image-executor.mjs`,
  `image-read-port.mjs`, `index.mjs`, `read-executor.mjs`, `read-normalizer.ts`,
  `read-presentation.mjs`, `write-executor.mjs` — including the entry point `index.mjs` and
  every executor the seven listed rows call. The ledger's `fs.oldPath.files` is the same 7
  (`ute-retirement.json:6-20`), so the deletion detector (`UTE_OLD_PATH_PARTIALLY_REMOVED`)
  also cannot see removal of those 10. All seven other families match their `src/` directory
  exactly (search 9, web 10, inspect 10, process 11, agent-control 14, ui 9, agent-state 7).
- **Fix:** list the 10 files (making 87 old-path files, not 77), or delete the whole
  `fs-family/` directory and say so. The “every file in the 77 exists” check is true but
  irrelevant to whether the set is the body.

### B5. The FS golden meta says the new path cannot reproduce `read_image`, while the ledger claims 16/16 and the transcript contains the PASS lines

- **Claim:** `dev/agent-workflow/ledgers/ute-retirement.json:40-42` — `newPathVerified: true`,
  `NEW-PATH-VECTOR FS-I1-inlane-image PASS` … `FS-I6-cancel-before-dispatch PASS`.
- **Evidence:** `tests/ute-g1-fs/golden/old-path.meta.txt:105-107` — “**`read_image` on the NEW
  path** — the prototype provider has no image support yet, so every `FS-I*` row stays
  `newPathPending: true`; the new-path run cannot reproduce these baselines (PR B2).” This is
  the reviewed fixture's own description. `tests/ute-g1-fs/lane-suite.test.mjs` fails if
  `newPathPending` exists anywhere, and `new-path-run.txt` has all six `FS-I*` PASS lines, so
  the meta is stale — but it is the paragraph an owner reads in the same directory the ledger
  cites, and it says the opposite of the 4/4 claim.
- **Fix:** delete/replace that paragraph in `old-path.meta.txt` in the same commit that closed
  B2; better, make the lane suite assert the meta no longer says `newPathPending`.

### B6. “The same spelling is declared twice … by the pinned host package the Member preset already mounts” is false for `ask_user_question`, false for web, and miscategorises the inspect alias

- **Claim:** `RELEASE-REQUEST-2026-11-21.md:122-127` (Group B): “In each, **the same spelling is
  declared twice** — by the governed family body and by the pinned host package the Member
  preset already mounts.”
- **Evidence (both directions, exact sites):**
  - **TRUE for 6 of 7 ui/agent-state members.** Governed: `packages/tools/ui-family/src/present-row.mjs:60`
    (`name: PRESENT_NATIVE_NAME`), `packages/tools/agent-state-family/src/executors.mjs:303`
    (`name: 'todo_write'`) and :329/:343/:349/:371; host:
    `…/tool-present/lib/index.js:24` (`name: "present"`), `…/tool-todo/lib/index.js:96`,
    `…/tool-goal/lib/index.js:276/265/302`, `…/plan-mode/lib/index.js:232`; and
    `cordis.patch.yml:335,361,369,401` mounts `tool-present`, `tool-goal`, `plan-mode`,
    `tool-todo`.
  - **FALSE for `ask_user_question`.** Governed `packages/tools/ui-family/src/ask-row.mjs:130`;
    host `…/tool-ask-user/lib/index.js:67` (`name: "ask_user_question"`). But the Member preset
    does **not** mount it: `cordis.patch.yml` has no `tool-ask-user` row (PD-25), and the lane's
    own probe says so — `dev/agent-workflow/evidence/ute3-uistate-b1-20261121/composition-probe.txt:87`
    “`product-route=absent-from-product (PD-25 fail-closed removal; no host preset row …)`”.
    The statement in `tests/ute-g1-uistate/lib/semantic-differences.mjs:24-30` therefore
    overstates: both *declare* the name, but the preset does not mount the host one.
  - **FALSE as stated for web.** The two claimants are `packages/tools/families/web.mjs:104`
    (`claims: () => ['web_fetch','web_search']`, opt-in `webEnabled`) and
    `packages/runtime/src/plugin/live/a5sf-realm-row.mjs:1210`
    (`A5SF_WEB_TOOL_NAMES = ['web_fetch','web_search']`, PD-27 shadow). The preset row is
    `cordis.patch.yml:350-351` `id: tool-web, name: 'dsh-agent-team/web-tool'` — **the repo's own
    module**, explicitly “never the host `tool-web` package” (`cordis.patch.yml:347`). The
    pinned host `@deepseek-ai/dsh-tool-web` (which does declare both names,
    `packages/web/tool-web/lib/index.js:262` etc.) is not mounted. The ledger's own
    `SD-WEB-1` text is accurate (“route-C composition also serves both names”); the release
    request's generalisation is not.
  - **MISCATEGORISED for inspect.** `alias-to-native-name-change` is in Group B, whose defining
    property is “the same spelling is declared twice”. By its own ledger text the governed side
    serves `team_skill`/`team_cordis_inspect_*` while the native side serves
    `skill`/`cordis_inspect_*` — the spellings **differ**. It is a name change, not a
    same-spelling collision.
- **Fix:** split Group B into “same-spelling collision (and is the host row mounted?)” and
  “alias→native rename”; scope each family's sentence to the member(s) where the mount is
  actually present.

### B7. `SD-UI-product-route-absent` / `SD-AS-product-route-absent` state a claim their own probe refutes

- **Claim:** `tests/ute-g1-uistate/lib/semantic-differences.mjs:141` — “**Neither family is
  reachable on the product route-C composition**: the bare route registers none of the seven
  names (`unknown tool`), the shipped preset serves four agent-state names from the HOST
  packages plus `present` from the route-C host shadow, and `ask_user_question` is deliberately
  absent …”.
- **Evidence:** the same sentence contradicts itself, and the probe proves the second half:
  `composition-probe.txt:75-79` — `PROBE-ROUTE-C-PRESET present-on-preset-scope=registered`,
  `present attach-fibers=1 shadowed=yes`, `present arm=inlane isError=false text="Presented …"`.
  The four agent-state names are also served from the preset (`PROBE-DISPOSITION`), i.e. 5 of 7
  names **are** reachable on the product route. Only the *governed family body* is unmounted.
  The bare-route arm (`:359`) is a deliberately configured composition
  (`nativeToolModules: []`), so it would print `unknown tool` for any preset-served name.
- **Fix:** “the governed family body is not mounted on the product route; the names are served
  by host preset rows (4 agent-state + present) and `ask_user_question` is absent (PD-25).”
  The release request's Group C sentence (`:131`) has the same ambiguity and should be scoped
  to “the family body”.
- **Related, same root cause (agent-control):** `SD-AGENTCTL-1-route-c-unserved` is *true*, but
  the cited probe is the same no-preset composition (`tests/ute-g1-agentctl/probe-composition.mjs:203`
  hard-codes `nativeToolModules=[]`). It cannot distinguish “route C serves none” from “the
  probe configured no host preset”. The independent proof lives in `cordis.patch.yml:216-232`
  (the delegation group is removed from the governed preset, `UNKNOWN_TOOL`), not in the probe.

### B8. The release request cites an FS control that does not exist

- **Claim:** `RELEASE-REQUEST-2026-11-21.md:60-62` — “controls green (including the
  `unconfined-fs` mutation that turns a lane denial into a 70-byte allow)”.
- **Evidence:** `grep -rn "unconfined-fs"` across the repo finds only this sentence. The actual
  control is `NC-MEMBER read_image`, `control=widen-read-lane-image`, producing
  `attachmentBytes=70` (`tests/ute-g1-fs/negative-controls.mjs:168-190`,
  `ute-g1-fs-20261121/negative-controls.txt`). The behaviour described is real; the identifier
  is fabricated. (A real `unconfined-fs` arm exists elsewhere — `tests/ute-g1-fs/product-route-image.test.mjs`
  and its CI note — but it is not part of this family's control battery and not what the
  release request is citing.)
- **Fix:** name the real control, or cite `product-route-image.test.mjs` and say it is a
  different suite.

### B9. The five-group split of the 31 differences does not match the ledger

- **Claim:** `RELEASE-REQUEST-2026-11-21.md:117-144` — “Group A (8)”, “Group B (5)”,
  “Group C (4)”, “Group D (10)”, “Group E (4)”, summing to 31.
- **Evidence (recomputed from the ledger's 31 ids):**
  - Group A's own enumeration sums to **7**, not 8: `fs ×2 + search ×1 + web ×1 + process ×1 +
    ui ×1 + agent-state ×1 = 7`.
  - Three differences are listed **twice**: `SD-PROCESS-4-refusal-surface`,
    `SD-UI-refusal-vocabulary`, `SD-AS-refusal-vocabulary` are in Group A **and** Group E.
  - Group D says 10 but expands “`SD-UI-*`/`SD-AS-*` result envelope, state sink, present
    receipt turn, timed-pending shape” — that is **8** differences (4 UI + 4 AS), not 4, so
    Group D is 14 (6 named + 8).
  - The only partition consistent with the ledger is **A=7, B=5, C=4, D=14, E=1**
    (`SD-AGENTCTL-3`), total 31.
- **Fix:** restate the group counts and make the groups a partition; the owner is being asked
  to answer “31 decisions” but the document's own buckets do not add up to 31 distinct ones.

### B10. `process.oldBaseline` is `verdict: true` in the ledger while the gate derives `false`

- **Claim:** `ute-retirement.json` process row, `oldBaseline.verdict: true`; `RELEASE-REQUEST:43`
  marks process baseline `✅` while `:26` says OldBaseline is `6 / 8`.
- **Evidence:** the gate prints `process terms={"oldBaseline":false,…}`, coverage
  `oldBaseline: ["bash"]`, with `UTE_MEMBER_UNCOVERED` for `pwsh`. The row's own note admits
  “covered 1 of 2”. The matrix's seven `✅` baselines (fs, search, web, process, agent-control,
  ui, agent-state) contradict the 6/8 aggregate; the gate's true set is fs, search, web,
  agent-control, ui, agent-state.
- **Fix:** set `oldBaseline.verdict: false` (or add an owner ruling that a wiring-excluded
  member does not count toward the baseline — a schema decision), and mark the matrix row
  “1/2, pwsh excluded” rather than `✅`.

### B11. The search row's own note says the opposite of its `newPathVerified` verdict

- **Claim:** `ute-retirement.json:229` — “It may NOT retire: no new path exists for Search
  (newPathVerified FALSE, zero NEW-PATH-VECTOR PASS lines)”.
- **Evidence:** the same row's `newPathVerified.verdict` is `true` (`:142`), citing
  `ute3-search-b2-20261120/new-path-run.txt` with 15 `NEW-PATH-VECTOR … PASS` lines and
  `NEW-PATH-VERDICT GREEN vectors=15`; the gate computes `newPathVerified: true`. The note is
  the B1 text that PR #809 (B2) superseded and was never updated.
- **Fix:** replace the sentence with the B2 state (new path verified 15/15; three differences
  remain unapproved).

---

## Non-blocking findings

1. **`NegativeControlsPass` is understated in §1.** `RELEASE-REQUEST:26` says `6 / 8`; the gate
   says **7/8** (all but inspect), and the same document's matrix marks 7 ✅. Verified with
   `--json`.
2. **Search's “12 controls” conflates two batteries.** `RELEASE-REQUEST:65` / `PROGRESS:20`
   say 12; the family's `negativeControlsPass` term expects and the transcript prints
   `controls=8` (`ute3-search-b1-20261120/negative-controls.txt`). The 12 is
   `NEW-PATH-NC-VERDICT GREEN controls=12` in the separate B2 new-path mutation harness
   (`ute3-search-b2-20261120/new-path-controls.txt`). Both numbers are real; the sentence
   does not say which.
3. **Absolute host paths leak into FS/SEARCH evidence.** `ute-g1-fs-20261121/new-path-run.txt:1`
   (`tree=/home/armourpiercer/…/ute3-fs-b2-20261120/tests/deepseek-harness-next`),
   `ute3-search-b2-20261120/new-path-run.txt:16-32` (every `NEW-PATH-PROVENANCE entry=/home/…`),
   and the FS capture transcripts (`ute-g1-fs-20261119/old-path-capture.txt`,
   `ute-g1-fs-20261120/old-path-capture.txt`). Consequence: the transcripts are not
   byte-reproducible on another machine and disclose the author's worktree layout. The search
   capture pair is byte-identical only because both runs shared the same path. The golden TSVs
   themselves are clean (no absolute path, timestamp, pid or random id — checked every cell).
   Web's note “No wall clock, no absolute path, no pid” is true for web; there is no equivalent
   guarantee for fs/search.
4. **“Two byte-identical captures” is not evidenced as a pair for fs and process.** A committed
   pair exists for search (`capture-run-1/2.txt`), web and uistate (verified: identical sha256);
   agentctl has NC-F6. FS has a single re-derivation transcript (which asserts
   `compare=identical` against the fixture), and process has `old-path-capture.txt` ending
   `compare=identical` — i.e. capture-vs-fixture equality, not two independent committed runs.
   The `RELEASE-REQUEST:23` definition is universal; it holds for 3 of 6 families as written.
5. **The socket witness has a fail-open default.** `tests/ute-g1-web/lib/net-witness.mjs:84`
   and `:100` default the destination to `'localhost'` when a connect argument bag has no
   string `host` — an external fetch through an unrecognised bag shape would be counted as
   loopback and forwarded, which is exactly the failure the file claims to close. Unix-socket
   targets are also loopback “by construction” even if they front external network. Neither
   case is exercised by any control. Fix: default to `'<unknown>'` (which classifies external
   and is refused) and add an arm for the bag shape.
6. **NC-NET-COUNTER-POSITIVE's `installed` assertion is vacuous**
   (`net.Socket.prototype.connect !== undefined` is always true). The control does drive a real
   `socket.connect({host:'example.com'})` through the patched prototype and checks
   `external=1/forwarded=0`, so the counter is not a constant; only that one conjunct is
   meaningless.
7. **Control-battery shrinkability.** Only agentctl (exact `deepEqual` fresh-vs-committed) and
   process (verdict line compared, live lines ⊆ committed) protect the committed battery.
   FS and uistate re-run their controls but assert only “all ok” / `length >= 7` and never
   compare the committed transcript or the declared control count; search asserts
   `controls >= 8`. A harness control deleted from the uistate battery (13 → 12) leaves every
   test green while the gate still reads `controls=13` from the stale transcript. Web is
   B1-level unprotected.
8. **`tests=892 refused=0` is only true with the CI ratchet flags.** The bare
   `node scripts/test-catalog.mjs` prints `refused=41 findings=41` (41 `TEST_UNCOLLECTED`).
   Adding `--max-uncollected 41 --max-excluded 7` (the exact `.github/workflows/ci-integration.yml:290`
   invocation) prints `tests=892 refused=0 findings=0`. The board quotes the output without the
   invocation; reproducible, but not with the command a reader would try.
9. **`master 1d64aeb45` in both documents is an ancestor, not HEAD.** HEAD is `2b69193fa`; the
   only changes since `1d64aeb45` are
   `RELEASE-REQUEST-2026-11-21.md` and `PROGRESS-2026-11-21.md` (`git diff --stat
   1d64aeb45..HEAD -- dev/agent-workflow/ledgers tests scripts docs/plans/memo/ute-g1-20261120`
   shows only those two files). The measurements therefore still hold at HEAD; the header
   merely reads as if `1d64aeb45` were current.
10. **Search's lane suite does not compare its committed control transcript** despite the
    ledger note saying it “re-runs the whole transcript”. It re-runs the script and asserts a
    verdict regex plus `controls >= 8`; the committed file is not read.
11. **`NC-MEMBER-POSITIVE edit`** compares against the golden `FS-E2-stale-edit` row but runs a
    synthetic `FS-E2-stale-edit-control` vector and checks only `outcome`/`refusal`, not the
    full row. It is adequate for “the guard, not a missing old_string, refused”, but it is not
    a full row reproduction.

---

## Vacuity table

“Would it red if the mutation is reverted?” means: the control's own bidirectional arm would
fail (base would stop differing from mutant, or the mutant would stop matching the required
effect), **and** that failure would be observed by a test. The second column is the assertion
the control protects. The last column is how I checked (read the code and the committed
transcript, not a live run).

| control | assertion it protects | reds if reverted? | how checked |
| --- | --- | --- | --- |
| fs `NC-1-lane-bites` | the out-of-lane write is denied *by the lane* with an absent target | yes (outcome/refusal/denyFact all conjunctive) | code `negative-controls.mjs:200-217`; but it runs on the **new path** (`runVector`), so it does not test the governed body |
| fs `NC-2-harness-bites` | the comparator bites on a mutated golden cell | yes (`mutatedFailures===1` + field `effects`; restoring the cell makes it 0) | code `:219-246` |
| fs `NC-3-no-fallback` | a missing next-host tree is a typed error naming the pin and never the legacy tree | yes (typed class + `namesPin` + `!namesLegacy`) | code `:248-266` |
| fs `NC-4-lane-load-bearing` | widening the write lane makes the file appear | yes (allow + exists + bytes=5) | code `:268-278`; new path |
| fs `NC-MEMBER read` | widening only the read lane leaks `SECRET_TOKEN` | yes (base==golden ∧ base≠mutant ∧ leak) | code `:94-110`; bidirectional |
| fs `NC-MEMBER write` | widening only the write lane creates the 5-byte file | yes (same shape + effect) | code `:113-130` |
| fs `NC-MEMBER edit` | dropping the version guard applies the stale edit | yes (base stale-deny, mutant allow with changed sha) | code `:137-167` |
| fs `NC-MEMBER read_image` | widening the image read lane materialises a 70-byte attachment | yes | code `:168-190` |
| fs `NC-IMAGE-OBSERVER` | the store-seam observer refuses 0/>1/mismatched/committed-anyway attachments | yes (4 named cases) | code `:37-61` |
| fs `NC-VERDICT` reset of any control | the 13-control battery is green | **only if the script is edited**: the lane suite asserts “all ok”, not the id set or count, and never compares the committed transcript | `lane-suite.test.mjs:104-109`; gate greps the stale file |
| search `NC-HARNESS-BITES` | a flipped golden match digest reds the comparator | yes | code + transcript |
| search `NC-CATEGORY-TOTAL` | an unexplained refusal raises `REFUSAL_VOCABULARY_INCOMPLETE`; `unknown` unreachable | yes | code + transcript |
| search `NC-MEMBER grep` | widening only the grep read lane returns the planted out-of-lane secret | yes (deny→allow, effect present, token leaked) | code + transcript |
| search `NC-MEMBER glob` | same for the glob walk (path leaked) | yes | code + transcript |
| search `NC-MEMBER-POSITIVE grep/glob` | the unmodified vector still reproduces its golden row | yes (would fail if the mutant were the only difference *and* the base drifted) | code; **count floor only (`>=8`)** |
| search `NC-SHADOW-LOAD-BEARING` | disposing the PD-16 search shadow makes the out-of-lane grep leak | yes | code + transcript |
| search `NC-STDIN-LOAD-BEARING` | the same disposal turns the path-less `grep` zero into real matches | yes | code + transcript |
| web `NC-MEMBER web_fetch` | the declared set, not the provider, refused the destination | yes (widening flips deny→allow, `providerFetches=1`, loopback) | code `:107-128`; **not executed by any test** |
| web `NC-MEMBER web_search` | the provider's own `available()` is the decision | yes | code; not executed |
| web `NC-MEMBER-POSITIVE web_fetch/search` | the unmodified rows still reproduce golden | yes | code; not executed |
| web `NC-GOLDEN-MUTATION` | the comparator bites on a flipped status/request cell | yes | code; not executed |
| web `NC-CATEGORY-TOTAL` | invented code raises `REFUSAL_VOCABULARY_INCOMPLETE`; `unknown`/`other` unreachable | yes | code; not executed |
| web `NC-SHADOW-LOAD-BEARING` | removing the PD-27 shadow reaches `BL18_TRIPWIRE` with zero arrivals | yes | code; not executed |
| web `NC-NET-SHIM-LOAD-BEARING` | a disabled witness refuses to report a zero (`NET_WITNESS_MISSING`) | yes | code `:212-226`; partly duplicated inline by the lane suite, not this control |
| web `NC-NET-COUNTER-POSITIVE` | the external counter is not a constant | yes (external=1, forwarded=0, `EGRESS_REFUSED`); `installed` conjunct vacuous | code `:228-259`; the `host`-less bag case is **untested** (see finding 5) |
| web `NC-CONCURRENT-NORMALIZATION` | the concurrent vector's request witness declares `sorted` | yes | code; not executed |
| process `NC-HARNESS-BITES` | a flipped golden cell reds the comparator | yes | code + transcript |
| process `NC-CATEGORY-TOTAL` | unmapped refusal raises the typed error; `unknown` unreachable | yes | code + transcript |
| process `NC-PWSH-EXCLUSION-CONDITIONAL` | the `pwsh` exclusion is a *wiring* fact: any of shadow/preset/registration mutated must raise `PWSH-EXCLUSION-UNJUSTIFIED`, and the same wiring with a vector must be `COVERED` | yes — genuinely bidirectional, fail-closed on a missing/unparseable probe line (`measureWiring` throws) | `negative-controls.mjs:182-208`, `lib/pwsh-exclusion.mjs:93-146` |
| process `NC-MEMBER bash` | widening the read lane leaks the out-of-lane secret | yes | code `:211-219` |
| process `NC-MEMBER bash-POSITIVE` | the unmodified `PB-B8` row still reproduces | yes | code |
| process `NC-SHADOW-LOAD-BEARING` | dropping the route-C bash shadow makes the out-of-lane workdir call succeed on the inherited shell (`baseCalls>0`) | yes | code `:224-232` |
| process `NC-CONFINEMENT-WITNESS` | the confined provider's spawn count is the witness | yes | code + transcript |
| process `NC-TIMEOUT-LOAD-BEARING` | removing the timeout makes the timed-out child run on | yes | code + transcript |
| process `NC-ENV-SCRUB-LOAD-BEARING` | the env scrub is what removes the secret | yes | code + transcript |
| process `NC-CAP-LOAD-BEARING` | the output cap is what truncates | yes | code + transcript |
| agentctl `NC-MEMBER <m>-policy-deny` ×7 | the deny-default template flips the member's success row | yes (`expectRed`: any mutation that leaves the row green fails the control) | `negative-controls.mjs:96-107` |
| agentctl `NC-MEMBER <m>-port-absent` ×7 | an absent runtime port flips the row to `route-unresolved` | yes (same shape; transcript records `red=2/2` per member) | code + transcript |
| agentctl `NC-F1`…`NC-F10` | design-claim checker, vocabulary incompleteness, no residual bucket, route-C detector (with injected spec), two-implementation detector (with a dropped spelling), byte-identical capture + mutation, host-path leak scanner, census coverage, PA-ask witness, fixture header | yes — each has an injected-mutation arm | code `:110-180`; exact fresh-vs-committed `deepEqual` in `lane-suite.test.mjs:123-133` |
| uistate `NC-MEMBER` ×7 | port-removed / root-widened / lane-allowed / other-scope / direct-human / current-revision / seeded-plan-mode, each with a `mustMove` field list | yes | `negative-controls.mjs:46-105`; **count not asserted (`>=7`)** |
| uistate `NC-HARNESS` ×6 | comparator, vocabulary totality, declared coverage, store witness, effect witness, durable readback | yes (each returns a problem list) | code; **removal of any harness control is undetected** |

**Named vacuous/unprotected items:** web's entire 11-control battery (no executor);
fs/uistate batteries' *membership* (shrinkable without a red); uistate's and fs's committed
transcripts (stale-able because nothing compares them); the socket witness's `host`-less
connect bag (fail-open, untested); NC-NET-COUNTER-POSITIVE's `installed` conjunct.

---

## Verified list (actually audited, genuinely supported)

1. **All 237 `expect` tokens are present verbatim; all 68 `contradicts` strings are absent;
   all 32 evidence paths exist and are tracked** (`/tmp/verify.mjs`, 8 rows × 4 terms).
   No quoted token is missing. (This is the one place the evidence is strongest.)
2. **All 31 differences are `blocking: true` and carry no approval** (0/31), matching
   “31 blocking differences, 31 × approval: null”.
3. **All 77 declared old-path files exist** and are tracked; the per-family counts
   (7/9/10/10/11/14/9/7) match `oldPath.files` exactly. (The *set* is wrong for fs — B4 — but
   the declared files are present.)
4. **Golden vector counts:** fs 16, search 15, web 15, process 14, agent-control 42,
   ui+agent-state 69 (22 UI + 47 AS) — all match the board and the release matrix.
5. **The gate summary and terms:** `requested=8 allowed=0 refused=8`; per-family terms exactly
   as printed above; `state=NOT_RETIREABLE` on all 8 and no `UTE_STATE_CONTRADICTED`.
6. **The four refusal codes named in the release request are real and reachable:**
   `UTE_APPROVAL_UNREFERENCED`, `UTE_VECTOR_UNREPRODUCED`, `UTE_MEMBER_UNCOVERED`,
   `UTE_UNIT_UNDERCLAIMED`. I proved `UTE_UNIT_UNDERCLAIMED` fires by declaring
   `unit.members: ["read"]` for fs (`codes=UTE_UNIT_UNDERCLAIMED,… unit=0/4`).
7. **The “fs is one indivisible four-tool assembly” rule holds:** members are derived from
   `arc-a-family-census.json` (`read,write,edit,read_image`); omitting `unit.members` entirely
   still yields all four (fs’s row has `declared: null` and the gate’s unit is 4/4), and a
   declared subset is refused.
8. **The other census/gate outputs reproduce at HEAD:** `EB3-FAMILY-DEFINITIONS pass files=78
   findings=0`; `UTE-FAMILY-INVENTORY-SUMMARY families=9 files=92 findings=0`;
   `EB3-CI-REQUIRED pass workflows=10 findings=0`; `DSH-TEST-CATALOG tests=892 refused=0
   findings=0` under the CI ratchet flags (finding 8 for the bare command).
9. **Byte-identical captures are real** for search (`a3333719…`), web (`64cdb621…`) and uistate
   (`cb3c4902…`): run 1 and run 2 share a sha256 and each contains full per-vector output plus
   `OLD-PATH-GOLDEN compare=identical`, not a truncated copy. Golden TSVs contain no wall
   clock, pid, absolute path, temp dir or random id.
10. **Effects are independently witnessed, not just the tool’s return value:** search
    corroborates every match with `statSync` and a before/after tree digest
    (`lib/effect-oracle.mjs:105-213`); fs records file `present/bytes/sha256/mode` and the
    attachment store’s own bytes/digest; web counts the fixture server’s arrival log plus a
    real socket witness; process records the spawned child’s exit/stdout/stderr and a tree
    digest; agentctl/uistate record the injected port’s own log and a durable store readback.
11. **The same-spelling collision is TRUE for 6 of 7 ui/agent-state members** with the exact
    declaration sites in both directions (governed row + host `index.js` + preset mount), and
    the host tree is the pinned `639ed015397290b3745d163aafe02ffee4aa3f84`.
12. **Route-C vs governed-plane baselines:** fs/search/web/process old paths really are
    route-C captures (`OLD-PATH-IDENTITY … seam="mountMemberA5sfRealm + attachA5sfNativeToolModules"`),
    and agent-control/ui/agent-state really are governed-plane captures
    (`PROBE-ROUTE-C agent-control-shadow=ABSENT`, `PROBE-UISTATE two-implementations=yes`).
    The progress board's §5 statement is accurate.
13. **The hosted chain:** `#805` head `f4989884…` and `#815` head `fbf10510…` each have all 11
    checks green including `ci-census / census-runtime` (25m30s / 28m21s); the run head equals
    the PR head. The census job log for #815 (run `44861914408`, job `136717050211`) contains
    `assertions_total=18650 assertions_executed=18650 skipped_total=0` and
    `DSH-CI-LEG leg=census verdict=pass`. `#815`'s merge commit is
    `1d64aeb45430a790439cd54de3eb32aa445a066f` — the SHA both documents quote.
14. **The #810 flake is described accurately:** the `ci-required` run on its head
    (`44836506263`) has `run_attempt: 2` and `conclusion: success`; i.e. a failed first attempt
    was rerun clean, not silently green.
15. **No `try/catch` or default branch in the gate silently passes.** Every catch
    (`:210,226,241,266,332,342,468,849,854,955,961`) returns `false` or a problem; an
    unreadable/untracked evidence file and an empty `expect` list are refusals
    (`UTE_EVIDENCE_UNREADABLE`); a missing census is `UTE_UNIT_UNGRADABLE`.
16. **`process`'s `pwsh` exclusion is genuinely conditional and fail-closed**, not a
    host-binary assertion: `coverageObligation` refuses the exclusion the moment any of
    shadow/preset/registration serves `pwsh`, and `measureWiring` throws on missing or
    unparseable probe lines.

---

## What I could NOT check, and why

1. **Live execution of any lane suite, control battery, or capture.** This fresh worktree has
   no `tests/deepseek-harness-test-use` / `tests/deepseek-harness-next` (they are gitignored;
   the prompt's “symlinks into another worktree” do not exist in a new `git worktree add`), and
   I was instructed not to create or write them. I therefore could not re-run the prototype
   (fs 16/16, search 15/15), the captures, or the negative controls. Everything about behaviour
   above is read from the committed transcripts plus the code, and I say so per finding.
2. **Whether `capture-run-2.txt` is an independent execution or a byte copy.** The transcripts
   carry no run id, timestamp or nonce (deliberately, so that two runs can be byte-identical),
   which makes a copy indistinguishable from a second run. The READMEs claim two consecutive
   invocations; the artifacts cannot prove independence.
3. **Whether the “second run” for fs/process is a real pair** — see finding 4. I found only
   single re-derivation transcripts for those families.
4. **FS `read_image` on the new path beyond the six vectors** — no JPEG/WebP/GIF, downscale,
   byte-cap or mid-read cancellation arm exists (the golden meta says so); the 16/16 claim is
   about the six recorded vectors only.
5. **The #810 local “100/100 and 41/41 green”** — no local artifact in the reviewed tree; I
   verified only the hosted rerun (`run_attempt: 2`).
6. **The prototype's own honesty** — I read `run-prototype.mjs`’s assertions and the
   `newPathPending`-must-not-exist rule, but without the next-host tree I could not confirm that
   the transcript was generated by that code rather than hand-written. The absolute-path line
   is at least consistent with a real run in `ute3-fs-b2-20261120`.
7. **A genuine owner approval** does not exist, so the approval path is untested against a real
   record; my fabricated-approval result is the only measured behaviour of that path.
8. **The inspect lane** has no baseline, no controls and no new path by design; I confirmed the
   gate refuses it (`UTE_OLD_BASELINE_MISSING` + `UTE_UNIT_UNGRADABLE`) and that its single
   difference is `alias-to-native-name-change`, but there is no executable evidence to audit.
9. **`dev/ci/eb3-ci-manifest.json`'s “what it proves” prose is stale** for search (it still says
   `new-path=PENDING`) and false for web's controls (“re-run GREEN” when no step runs them). It
   is outside the listed review objects, but it is the document that justifies the CI legs, so
   an owner should know it is not a reliable statement of what the hosted run executed.

---

## Reproduction commands used

```bash
# worktree
cd /home/armourpiercer/projects/dsh-agent-team
git fetch origin
git worktree add .worktrees/ute3-review-20261121 -b task/ute3-review-20261121 origin/master

# token / path verification (no writes)
node /tmp/verify.mjs                      # 237 expect tokens, 0 missing; 0 contradictions

# gate
node scripts/ute-retirement-gate.mjs --all --json > /tmp/gate.json

# inflation probes (writes only under /tmp)
cp dev/agent-workflow/ledgers/ute-retirement.json /tmp/x.json   # then edit + --ledger /tmp/x.json
# 1) differences: [] + verdict:true            -> ALLOW family=fs terms=4/4
# 2) blocking:"yes" (or absent) + verdict:true -> ALLOW
# 3) approval{by:"owner",record:<doc with "owner">,reference:"PR #1 @ <root>"} -> ALLOW

# members / files
node -e '…census nativeNames…'            # 27 booked members
node -e '…oldPath.files…'                 # 77 declared, 0 missing; fs body is 17 files, 10 undeclared

# hosted
gh pr checks 805 ; gh pr checks 815 ; gh run view 44861914408 --json headSha,conclusion
gh api "repos/…/actions/runs?head_sha=cc46e705…"   # #810 ci-required run_attempt=2 success
gh api "repos/…/actions/jobs/136717050211/logs" | grep assertions_executed  # 18650/18650, skipped 0

# other gates
node scripts/test-catalog.mjs --max-uncollected 41 --max-excluded 7   # tests=892 refused=0
node scripts/eb3-family-definitions.mjs                               # files=78 findings=0
node scripts/ute-family-inventory.mjs                                 # families=9 files=92 findings=0
node scripts/eb3-ci-required.mjs                                      # workflows=10 findings=0
```

No tracked file was modified; `git status --porcelain` in the review worktree shows only this
uncommitted `REVIEW.md`.
