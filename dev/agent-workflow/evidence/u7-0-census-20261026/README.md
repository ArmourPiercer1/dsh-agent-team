# U7-0 evidence — dynamic tool census (EB2-A), 2026-10-26

Task: ExpectedToolObligations artifact (tracked) + ObservedRuntimeInventory
collector + three-way reconciler + CI hook (C1) + ONE live C2 census at the
pinned Host baseline (`0.2.0-rc.2 @ 639ed015`, port 3180-family,
`tests/homes/<world>`, HTU pristine, :3080 untouched).

This directory carries SMALL sanitized receipts. Raw per-boot host logs,
census ledgers, inventories and RUN records live under
`.artifacts/tmp/u7-0-census-live/` (gitignored era: raw stays raw); the
PINNED live snapshots themselves are promoted to
`dev/engineering/tool-obligations/baselines/` (tracked, digest-pinned).

## Receipts (fill from RUN records; every claim below is machine-checkable)

<!-- RUN-RECEIPTS:BEGIN -->
RUN-3 (PINNING, review-R1 re-run on the reviewer-granted +2 boots)
`u7-0-census-2026-10-26T12-42-24-521Z` — overall PASS 5/5:
  c2-non-team PASS (live1 snapshot, 2 scopes, seam refusals 0)
  c2-governed-team PASS (team lane observed: leader lane classified
    team_lane:true via team-layer names; boot-root legacy lane classified
    non-team; global row layer of a Team host carries only the row tools —
    recorded verbatim)
  reconcile PASS with ASSERTIONS (review-R1 M4): reviewed MISSING/UNKNOWN
    sets + team-lane presence + no per-boot kinds cross-boot + zero
    source_findings + drift-free self legs; recorded problems: []
  leak-check PASS; stable-instance-unchanged PASS (:3080 401 -> 401)
  snapshot digests (pinned, baselines/, review-R1 digest law incl.
  scope_id + source_class; rows stamp provider_identity NOT_OBSERVABLE):
    non-team        sha256:c4e7da01fa1fa60633bdf6dcbf1c6e07ad184e40fd4adbf81c4869cf5634bf47
    governed-team   sha256:320f81fa3e5be8c31ab0235fb346c21c7158b98c06f1bbfc9c3c47d592a7a30f
  verdict digests (schema u7-0/census-reconcile/v2):
    non-team        sha256:a890ced2bbb33448b33757d346857e17957a3f544f669742182a1b9c94b7035c
    governed-team   sha256:e223456d4392b5785ad10a25a472287e45252c718e2894b38dcc1abfb6f59ada
    cross-boot leg  sha256:780c727c6d0529ed8c7f51ff670b5c2c3f06f5ac626753d2590839c58a4bfb29
      (2 definition-shape rows on agent-1: read + bash — the reviewed Team
       governed-takeover variants whose model-facing shape legitimately
       differs from the host one-shot rows; NO per-boot kinds, by law)
  counts (live, honest): non-team missing 11 / unknown 2 (test rows only) /
    source_findings 0 / drift 0 / gaps 18;
    governed-team missing 24 (same 11 host profile-gated + 13 team-lane
    tools the anchor blueprint does not grant) / unknown 5 (2 test rows +
    edit/write/read_image `scope-mismatch` — native REQUIRED observed on the
    governed leader lane while the reviewed seeds say NO Team arm: reported,
    authorized:false, DISCLOSED here as a live census finding) /
    source_findings 0 / drift 0 (self leg) / gaps 0.
  bindings.teamSha = 2f630e766… = repo HEAD at run time (review-R1 m4);
    honest note: the working tree carried the (then-uncommitted) review-R1
    fix set, landed as the same-push commits after this run.
  Budget: RUN-3 ledger `u7c-budget-run3.jsonl` (line u7c3) 2/2 starts —
    these two are the review-R1 reviewer-GRANTED +2 boots, declared here;
    total boots this task: RUN-1 2 + RUN-2 2 + RUN-3 2 = 6.
  Superseded (in place, same filenames): RUN-2 pinned set under the old
    narrower digest law; cross-boot snapshot stability (byte-identical
    non-team digest across independent boots) was live-proven by RUN-1 vs
    RUN-2 and remains recorded in baselines.manifest.json history.
<!-- RUN-RECEIPTS:END -->

## RUN ledger (honesty of counts)

- RUN-1 `.artifacts/tmp/u7-0-census-live/2026-10-26T10-41-16-540Z/` —
  overall FAIL(1): `c2-governed-team` failed for a REAL reason the census
  itself surfaced as a harness bug (NOT a product finding): the alpha2
  permission-coverage gate refused the governed leader bootstrap because
  the two row-layer test tools (`u5_canary`, `u7_census`) sat
  `unknown-unmanaged` on the leader surface. Fix per the measured u6-fs
  law (deny IS coverage): the anchor blueprint now carries both names in
  the leader `builtinToolDeny`, and the census call rides the boot-root
  legacy session lane (the proven u6-fs trigger-lane pattern). The same
  run exposed the per-boot `def#N` cross-boot mis-pairing (both boots
  carried the literal boot_id `boot-1`), fixed by world-unique boot ids.
  Both fixes are harness-side; zero product semantics involved.
- RUN-2 — the pre-review pinned run (superseded in place by RUN-3 under
  the widened review-R1 digest law; its receipts are in git history of this
  file and in `.artifacts/tmp/u7-0-census-live/`).
- RUN-3 — the review-R1 pinning run (reviewer-granted +2 boots; receipts
  block above). The reconcile leg now ASSERTS (M4) and its
  reviewed expectation sets (MISSING 11/24, UNKNOWN 2/5) are the disclosed
  live facts encoded in `u7-0-census-runner.mjs`.

## Negative controls (C1, planted counterexamples — architecture §10.5-6)

1. inject `mcp__planted_server__planted_tool` → UNKNOWN
   (`dynamic-instance-unadmitted`, `authorized:false`,
   `in_authoritative_sources:false`) — verdict digest moves;
   a non-prefixed brand-new name lands `not-in-obligations` the same way;
2. replace an execution Definition → DRIFT: same-boot spelling plants a
   placement-identity move (`definition-identity`), the cross-boot spelling
   moves the model-facing shape digest (`definition-shape`) and the pinned
   snapshot digest;
3. drop `read` from every scope → MISSING (1),
   `in_authoritative_sources:true`, `expected_in:'native-scope'`.
Every plant asserts the EXACT count delta + the named row + a moved
`verdict_digest`; the authorization law leg asserts no output on any plant
carries `authorized:true` (§10.4: discovery reports, never authorizes).
`packages/testkit/test/u7-0-census-reconcile.test.ts` — 26/26 PASS offline
(review-R1 grew it from 11: B2/B3/M1/M3/M6/M7/m2/m5/m6 + generator-refusal
negative controls; RED-first evidence + mutant-kill addendum in
`review-r1-red.log`).

## Digest law (pinned)

- `snapshot_digest` covers only cross-boot-stable facts — review-R1 m2
  WIDENED the law: scope IDENTITY (`scope_id` + kind/team_lane — renaming a
  lane moves the digest) plus, per tool: name / shape digest /
  identity_vs_global / TRUSTED ATTRIBUTION (`source_class`)
  — rewriting every `def#N`, every change_seq and the boot id leaves it
  byte-identical (asserted); PROVIDER identity is never in it: the public
  seam exposes no registrant, rows stamp `provider_identity:
  "NOT_OBSERVABLE"` explicitly (schema carries the seam evidence: HTU
  core/tools index.d.ts register :636 has no source parameter, schemas()
  whitelists name/description/parameters at :154, tools/change is
  payload-less); binding identity IS the per-(scope,name) placement algebra
  over `definitionIdentityOf`, compared pair-wise (review-R1 B1/B2);
- `full_digest` covers every recorded byte (audit binding);
- `verdict_digest` covers the whole three-way diff;
- artifact digests + generator sha are in
  `dev/engineering/tool-obligations/manifest.json` (replay:
  `node dev/engineering/tool-obligations/build-expected-tool-obligations.mjs --check`).

## Budget / non-interference

- Host starts: RUN-1 = 2, RUN-2 = 2 (each its own budget ledger; the
  factory refuses a spawn once its ledger reaches `--max-host-starts`);
  every start logged BEFORE spawn.
- Ports: leased 3180-family + mock 3491-3500 (lease v5, shared
  `.artifacts/tmp/port-leases` root); :3080 probed READ-ONLY before/after
  (status stable, 401 unauthenticated as expected) — case
  `stable-instance-unchanged` PASS in every RUN record.
- HTU base (`tests/deepseek-harness-test-use`, the main checkout's pristine
  0.2.0-rc.2 tree, used READ-ONLY via the factory `hostTree` seam — the
  shared `/srv/workspace/dsh-stable-3-0.2.0-rc.2` baseline is absent in
  this environment, disclosed): HEAD/porcelain asserted before EVERY
  spawn and after the run (`assertHostBase`), porcelain stayed empty.
- Homes under `tests/homes/` (workspace), deleted at teardown; leak-check
  (pids/ports/leases/home) PASS in every RUN record.

## Review-R1 fix ledger (reviewer branch `task/u7-0-review-20261026` @ a444d07c2)

RED-first: the review-R1 test block was appended FIRST and captured red —
`review-r1-red.log` shows 13 failed | 12 passed (25), failing exactly the
new controls; after the fixes the file is 26/26 green (the 26th test,
flag-suppression, was authored during the fix and is green by construction
against the red-tested rule). Mutant addendum (same log): deleting the
revision-emission (M6) and the source-emission (M7) each turn the suite red
(2 failed | 23 skipped), restored → 25 passed.

| finding | status | where |
| --- | --- | --- |
| **B1** provider/binding identity + 可信配置差集 | **disclosed NOT_OBSERVABLE (provider) + implemented (binding, diff set)** | every inventory row stamps `provider_identity:"NOT_OBSERVABLE"` (schema carries the seam evidence: HTU `packages/core/tools/lib/types/index.d.ts` register :636 has NO source parameter; schemas() whitelist :154; `tools/change` payload-less — the live probe confirms). Binding identity = per-(scope,name) placement algebra (`definitionIdentityOf`). The 可信配置差集 is the verdict's `trusted_config` section: additions (UNKNOWN), removals (MISSING), gaps, identity laws. Test: trusted-config section. |
| **B2** name-keyed first-wins identity pairing | **fixed** | reconcile pairs by `(scope_id, name)`; swap in a NON-first scope is reported EXACTLY ONCE attributed to its own scope — B2a (agent lane), B2b (**real live data**: agent-2 `read` on the pinned governed-team baseline), B2c (global swap stays global). |
| **B3** sources side produced no findings | **fixed** | `source_findings` bucket: `required-without-source-registration` / `source-row-without-obligation` / `observed-not-in-sources`, all `authorized:false`, digest-covered (B3a/B3b/B3c); generator REFUSES REQUIRED named with no registration on either side — scratch replay of the tampered u1c seed exits non-zero naming the tool (B3-gen). |
| **M1** placement signal joined into shape branch | **fixed** | independent kind `placement-identity-signal` (identity_vs_global moved, shape held) — M1-placement asserts it is the ONLY kind. |
| **M2** same-boot kinds unreachable on live rows | **disclosed, not fixable** | live product rows carry `identity_vs_global:"n/a"` + `change_seq:null` (row-layer view) → placement/revision drift is synthetic-only (C1); stated verbatim in verdict `trusted_config.unreachable_on_live_rows` + receipts. |
| **M3** known name in foreign scope class | **fixed** | `scope-mismatch` UNKNOWN (authorized:false) unless the reviewed `team_lane_variant_expected` flag covers it; LIVE evidence: RUN-3 leader lane surfaced `edit`/`write`/`read_image` (seeds say NO Team arm) → reported. |
| **M4** reconcile case asserted nothing; pickSnapshot fell back | **fixed** | runner asserts reviewed MISSING/UNKNOWN sets, lane presence, per-boot-kinds exclusion, source_findings 0, self-leg drift 0 (RUN-3 record: `problems: []`); `pickSnapshot` THROWS when `requiresTeamLane` and no lane snapshot exists. |
| **M6/M7** revision/source kinds untested | **fixed (mutants killed)** | M6/M7 tests assert the exact kind; mutation addendum in `review-r1-red.log`. |
| **m1** overstated cross-boot per-boot wording | **fixed** | receipts + digest-law sections corrected (def#N were byte-identical across boots; digest-omission proven synthetically). |
| **m2** digest law missed scope identity + attribution | **fixed** | `scope_id` + per-row `source_class` are digest-eligible (fixture 66da85ef…, live c4e7da01…/320f81fa… re-pinned; m2 test renames each and asserts the digest moves). |
| **m3** dispositions seed unconsumed; fragile worktree pin | **fixed** | generator VALIDATES the u4-unknown-dispositions seed (orphan/coverage/no-route refusals) and pins `unknown_dispositions_seed_sha256` in artifact inputs + manifest; u1c team pin reworded to the commit SHA (ancestor of HEAD, verified `git cat-file`/`merge-base`). Artifact digests moved as a result: expected `sha256:536a358c…`, sources `sha256:abc825d2…` (also carrying the REQUIRED-sourced rule + bash flag projection fix). |
| **m4** empty teamSha in live bindings | **fixed** | `bindings.teamSha = git rev-parse HEAD` at run time (RUN-3: 2f630e766…). |
| **m5** key-order invariance unpinned | **fixed** | deep-reordered-keys + whitespace round-trip tests assert identical digests. |
| **m6** `team_lane_variant_expected` dangling | **fixed (consumed)** | the flag SUPPRESSES expected team-lane takeover observations (bash/read), and team-class drift rows carry it; unflagged observations stay scope-mismatch UNKNOWN (the read/bash projection gap: the takeover rule regex missed the reviewed "Team native takeover" phrasing — fixed, disclosed). |
| **P3** cross-boot Body swap with identical shape | **disclosed, by design** | the public seam offers no cross-boot body channel; the shape digest is the only cross-boot Definition column — stated in the module law, schema $comment and receipts. |

## CI receipts (PR #386, head 512d164856942cea31655d0e90b7628bd78329a1)

- pr-gate PASS (1m19s); candidate-protection PASS (14s); census-runtime
  PASS (18m18s — the no-exemption leg: pinned pristine host provisioned,
  nine-root census with NO refusals, transcript re-graded).
- Root vitest vs pristine master (496a3980f) measured IN THIS ENVIRONMENT:
  the only regression the branch introduced was the a5p0 lane-audit
  consumer-mention hit (code-string mention of the lane name; zero import
  edges — fixed by rewording, commit 512d16485, no consumer booking).
  All 11 remaining reds reproduce identically on pristine master here
  (HTU/environment legs); zero NEW reds from this PR.
- PR left OPEN for reviewer merge (DO-NOT-MERGE discipline per task).
