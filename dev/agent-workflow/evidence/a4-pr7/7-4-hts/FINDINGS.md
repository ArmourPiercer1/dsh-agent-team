# A4-PR7 §7.4 (pre-flip half) — lane **C-tools+harness** findings

**Branch** `feat/a4-74-hts-fixtures` (worktree `.worktrees/a4-74-hts`), rebased onto `origin/master` =
`5ea79126` (fence round 3 + R3.5, merged at `0af1bd63`, docs on top).
Six commits on the base, nothing pushed: the five file commits `94831a22`, `280e3145`, `bfca3353`,
`1a7c30eb`, `476cae32`, then this evidence commit on top.

| # | file | plan-named site | disposition | commit |
|---|------|-----------------|-------------|--------|
| 1 | [`packages/runtime/root-binding/harness/blueprint-source.mjs`](../../../../packages/runtime/root-binding/harness/blueprint-source.mjs) | scanned at `:30` (now `:31`) | migrate-by-hand | `94831a22` |
| 2 | [`packages/tools/harness/d4-restart-reopen.mjs`](../../../../packages/tools/harness/d4-restart-reopen.mjs) | `:220` | migrate-by-hand | `280e3145` |
| 3 | [`packages/tools/harness/g5-member-e2e.mjs`](../../../../packages/tools/harness/g5-member-e2e.mjs) | `:267` | migrate-by-hand | `bfca3353` |
| 4 | [`packages/tools/harness/run.mjs`](../../../../packages/tools/harness/run.mjs) | `:214` | migrate-by-hand | `1a7c30eb` |
| 5 | [`packages/tools/harness/t12-vertical.mjs`](../../../../packages/tools/harness/t12-vertical.mjs) | `:215` (+ a measured second site `:1844`) | migrate-by-hand + delete-lie (the second site) | `476cae32` |

Every migrated document carries the two v3-required authority documents as
`rules: []`, which is the narrowest legal value and — this is the part each commit argues
file by file — the posture the fixture already had. The v3 grammar requires both keys and
never defaults them (`packages/domain/blueprint/src/validate.ts:1335-1336`); an empty
document is not a widening: on the expansion plane `effectiveAuthorityCeiling` answers a
no-match with **no-authority** (`packages/domain/authority-envelope/src/authority-envelope.ts:409`)
— what an absent v1 carrier already meant — and on the approval plane `narrowingForApproval`
answers no-match with **identity** (`:439`). Writing a rule into any of these five carriers,
to "look governed", would be the change; `rules: []` is the preservation.

## The one limitation that governs this whole lane, stated per file

These five are **real-host harness programs, and none of them was run.** No host booted, no
port was opened (nothing near 31xx, `:3080` untouched), nothing under `tests/homes/**` was
created or mutated. What each file therefore has as evidence is: `node --check` on the file, a
standalone parse of the exact embedded document through the production parser (identity +
`schemaVersion` + derived content hash, before and after), and the fence.

- **`blueprint-source.mjs` — not executed.** The change is verified by construction and by the
  fence; the harness leg itself runs in §7.6.
- **`d4-restart-reopen.mjs` — not executed.** The change is verified by construction and by the
  fence; the harness leg itself runs in §7.6.
- **`g5-member-e2e.mjs` — not executed.** The change is verified by construction and by the
  fence; the harness leg itself runs in §7.6.
- **`run.mjs` — not executed.** The change is verified by construction and by the fence; the
  harness leg itself runs in §7.6.
- **`t12-vertical.mjs` — not executed** (all three worlds). The change is verified by
  construction and by the fence; the harness leg itself runs in §7.6.

This sentence is repeated per file on purpose: a lane-level caveat is how a reader skims past
the fact that four acceptance runners and one harness source changed under a plan section whose
closing evidence is a real-host run.

And to be exact about how little of that is covered by the unit suite: the root `pnpm test`
include pattern is `packages/*/test/**/*.test.ts` (`vitest.config.ts`), so none of these five
paths is collected by it — `grep -c bounded-run` over `scratch/root-test-after.txt` is **0**, which
is how I confirmed it rather than inferred it. The suite proves the migration broke nothing
*elsewhere*; it cannot prove these five programs still work. The probes and the fence are the only
pre-§7.6 evidence that touches the documents themselves, which is precisely why §7.6's five legs
are listed as owed work below and not as a formality.

## What each file proves, and why the empty carriers cannot move it

One check covers all five, and it is the cheapest way to see that no fixture here "carries" its
identity: all **14** content hashes this lane produced — the seven documents the five files embed
(one each in files 1–4, three in t12) in both their states — grepped over the live tree
(`packages`, `tests`, `scripts`, `cordis.patch.yml`; `.ts`/`.mts`/`.mjs`/`.json`/`.yml`):
`a22c7816 a7f3203f ffe5a168 2c4f61c5 db644b60 bd1e78eb 35ade657 89bc0454 65ab058d 4d50ddf5
4749e6ea d457a829 af47d8dc b369ceee` → **0 hits, 14 of 14**. Every one of these documents has its
hash *derived by the parser at run time*, so a v1→v3 migration cannot strand a hand-copied digest
anywhere, and no re-pinning was needed or done. (The retired values appear only inside historical
run records under `dev/agent-workflow/evidence/`, which are records, not assertions.)

Full argument in each commit body; the load-bearing citation per file:

1. **`blueprint-source.mjs`** — the P5-T5 harness Blueprint source, consumed at
   `packages/runtime/root-binding/plugin.mjs:431 parseBlueprint(...)` with a derived-hash
   cross-check at `:439`. No version-conditional behaviour reads this document; the derived hash
   is the only value any reader compares, and it is **derived, never copied** (a re-pinned
   `contentHash` literal would have been the lie). v1
   `sha256:a22c7816f98bc462e29b62e35fdda898051cccdad0a90157485f96834c3a71b5` → v3
   `sha256:a7f3203fba5ab13215054fdc5a9ace02318a934ca41d15f09aaf8625d6e838b5`.
2. **`d4-restart-reopen.mjs`** (`BLUEPRINT_DOC` `:218`, consumed `:740 blueprintSource`) — the
   restart/reopen legs assert durable identity across a restart; the document is read at boot and
   its derived hash is the anchor. v1 `sha256:ffe5a1681a57a4f5de052eb4ffb8c985528aa12954bcc7c001ba55d0cae53625`
   → v3 `sha256:2c4f61c5c63214989eaf55c6358105b491b89914f005615ae595f4fb76d2feff`.
   Namespace trap checked: `:1021 domLeader(...).schemaVersion === 2` is a **LeaderInstance row**
   stamp (`packages/contracts/src/dto/member-instance-record.ts:238`, "stamped to 2 by the
   factory"), not a Blueprint document, and is untouched.
3. **`g5-member-e2e.mjs`** (`BLUEPRINT_DOC` `:265`, consumed `:1079`) — S4a/b/c are real member
   file/shell tool turns (`:1723`), i.e. the harness's approval-sensitive legs; approval narrowing
   for an empty document is the identity (`authority-envelope.ts:439`), so the member tool turns
   keep exactly the envelope the fixture grants. v1
   `sha256:db644b600c96189ab47e44718ea630ca82d226904265ebd2f35f093357c0c550` → v3
   `sha256:bd1e78eba7fcfc52df244fa0734755034249fe675dc654e6050077a0fa58c966`.
4. **`run.mjs`** (`TEAM_BLUEPRINT_SOURCE` `:212`, consumed `:329 blueprintSource`) — the file that
   needed real checking, because P8-S4B's M-scenarios mutate governance and assert the mutation
   lands. They mutate **cells** via `setOverride`
   (`packages/tools/harness/plugin.mjs:659` route → `:712` call), whose only document read is the
   **capability** envelope (`packages/runtime/src/plugin/root.ts:1897 readBlueprintEnvelope` →
   `capabilityValuesOf(bound.capabilityPolicy)`) — which this migration leaves byte-identical, and
   the probe prints it — and which skips the envelope check outright for an operator slot with no
   origin (`packages/runtime/governance/service.ts:305 writeTimeChecks`). The v3 ceiling law is
   consulted only on the permission-overlay mutation lane (`governance/service.ts:651, :714,
   :1154-1178`), and `mutatePermission` appears **nowhere** in this harness or its plugin (grep
   count 0 in both). v1 `sha256:35ade6577ed506374003a0e033e9ba2d836b1d181c563ed0bcc2764fd13a76b7`
   → v3 `sha256:89bc04540635b868c6caa2c69e167e20f91fca01728ebc74a182024f957694c4`.
5. **`t12-vertical.mjs`** (`blueprintDoc(world, bpId)` `:212`, three worlds, consumed `:282`) —
   V3's stage-1 HARD deny of the `mcp` capability is an **external** policy fact on the row config
   (`externalPolicyFacts` in `teamRowConfig`), not a Blueprint authority document; the empty
   carriers write to a plane this harness never consults. Three derived pairs:
   a `65ab058de01e…` → `4d50ddf54cc6…`, b `4749e6eacb15…` → `d457a829def4…`,
   c `af47d8dce6ed…` → `b369ceee78bf…` (full hashes in the commit body and
   `scratch/probes-before-all.txt` / `scratch/probes-after-all.txt`).

## The plan/DEFERRALS note about `t12-vertical` was wrong, and the second site was not a document

The `DEFERRALS` entry read *"…; also emits a v2 document; the L1838 occurrence is comment prose,
not a site"*, and the flip-window note pointed at this file as the first place to look for a
literal that cannot move. **Measured: this harness emits exactly three documents, all built by
`blueprintDoc`, all now v3** — the probe enumerates them (`documentCount: 3`). Its other version
digit sat inside a V5 `v5.check` **label**, whose predicate is `sv === 2` on
`projection.schemaVersion`: the **projection** axis (`SUPPORTED_PROJECTION_SCHEMA_VERSIONS`,
production stamps the upper one), a frozen namespace the Blueprint document cutover does not
touch. The label spelled that stamp in YAML document-key form — exactly the spelling the fence
keys on — so a sentence *about* a version was being reported as a document *at* a version.

Disposition: `delete-lie` on the sentence, nothing else. The label now names the axis it pins; the
assertion `sv === 2` and its detail `schemaVersion=${sv}` are byte-identical; the P8-S contract
quote in the comment above the check (the evidence for the value) is untouched and the fence
classifies it as `PROSE` (non-gating), now at `L1852`. No digit was "migrated" to 3 — that would
have falsified a real contract claim. The label is compared by nothing: the only other occurrences
of the string in the tree are historical T12 run records under `dev/agent-workflow/evidence/T12/`.

**No row was added to** [`../7-3-flip/intentional-retired.md`](../7-3-flip/intentional-retired.md),
and this is a judgement call the coordinator should overrule if they read it differently. Reasons:
(a) that file's own staleness invariant is "while a row lives here, its path stays dirty and its
`DEFERRALS` entry must remain" — `t12-vertical.mjs` now has no gated site, so a row would either
force back a `DEFERRALS` entry the wrapper then reddens, or break the invariant; (b) admission
criterion 1 ("cannot be migrated to the supported version without deleting what the file proves")
no longer applies, because the file carries no retired-version Blueprint literal at all. If the
coordinator wants the projection axis registered anyway, this is the row I would have filed:

> **`packages/tools/harness/t12-vertical.mjs` — not a Blueprint document (projection axis).**
> line(s): the V5 `v5.check('projection carries the production v2 stamp …')` predicate, `sv === 2`
> (`:1868-1869` post-commit; `:1844` pre-commit). spec clause: P8-S backend-contract-freeze — a
> production read of `team.getProjection` carries the projected DTO stamped at the upper supported
> projection version. why-not-migrate: that digit is the projection namespace; the Blueprint
> cutover does not own it, and moving it would replace a contract assertion with a falsehood.
> disposition: legitimate non-Blueprint version axis. flip-verification:
> `node --check packages/tools/harness/t12-vertical.mjs` plus grep that the V5 check still reads
> `sv === 2` and that the file has no gated site
> (`node scripts/verify-blueprint-version-clean.mjs | grep -c '^OFFENDING packages/tools/harness/t12-vertical.mjs'` → `0`).
> owner: §7.4 lane C-tools+harness (filed), fence owner if a ledger row is ever needed.

## Fence: the two runs, per file

Scan run from the worktree root (`paths` in the report are cwd-relative). Full logs in
[`scratch/`](scratch/).

| run | log | `RESULT dirty` | this lane's five paths |
|-----|-----|----------------|------------------------|
| before (pre-rebase base `a2059c73`) | `scratch/scan-before.txt` | `120 files, 259 sites` | `blueprint-source L30=v1`, `d4 L220=v1`, `g5 L267=v1`, `run L214=v1`, `t12 L215=v1, L1844=v2` (+ `PROSE t12 L1838=v2`) |
| after rebase, before migration | `scratch/scan-after-rebase.txt` | `117 files, 256 sites` | only `run L214=v1`, `t12 L215=v1, L1844=v2` (files 1–3 already clean) |
| after file 4 | `scratch/scan-after-file4.txt` | `116 files, 255 sites` | only `t12 L215=v1, L1844=v2` |
| after file 5 (lane end) | `scratch/scan-after-file5.txt` | `115 files, 253 sites` | **none** — the five paths appear in no gated class; `PROSE t12 L1852=v2` remains (non-gating) |

Also visible across those runs: the sixth class landed with the rebase — `unknown(16 files, 24
sites)` in the pre-rebase run is `unknown(0) / adjudicated(16, 24)` after round 3, with the same
24 sites. Scan exit code stays **1** (other lanes' paths are still dirty); my lane's closure is
the disappearance of the five `OFFENDING` lines, not the exit code.

## Gate results (all run in this worktree at lane head)

> These are the **pre-rebase** numbers, taken at base `5ea79126`; they stayed true as history but
> they are not what a merge should be judged against. The coordinator's ruling was to rebase onto
> `ff9218a3` and re-derive — that is done, and every number quoted for merge is in
> [Post-approval round](#post-approval-round-parents-rulings-mutation-proofs-the-rebase-and-the-gates)
> below.

| gate | command | result |
|------|---------|--------|
| fence | `node scripts/verify-blueprint-version-clean.mjs` | exit 1, `dirty(115, 253)`, `unknown(0, 0)`, `adjudicated(16, 24)`; zero lines for any of the five paths |
| fence wrapper | `pnpm exec vitest run packages/testkit/test/a4p7-blueprint-version-clean.test.ts` | **58 passed (58)**; red-first transcript for each of the five files is in its commit body |
| test counter | `pnpm exec vitest run packages/testkit/test/p4t6-session-event-scan.test.ts` | **10 passed (10)** — no file created/deleted in a counted scope, so `983 + Σ lists` did not move (edits to existing counted files are not increments) |
| load check | `node --check` ×5 | all OK |
| typecheck | `pnpm -r run typecheck` | exit 0, all packages Done (`scratch/typecheck.txt`) |
| lint | `npx eslint` on the five + the wrapper | **one error, pre-existing** — see deviation D5 |
| identity lint | `node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt` | `76 distinct; new 0, resolved 0` |
| root suite | `rm -rf packages/testkit/test/.tmp-fault/ && pnpm test` | `10 failed files / 24 failed tests` (491 files, 6159 tests) — identical to the declared baseline by failing **name**, plus the declared `p6t1-parallel` flake at 5 tests: see below |

### Base drift while this lane worked

`origin/master` moved from `5ea79126` (my rebase target, the one the coordinator named) to
`ff9218a3` — 10 commits, including `0a4f5029` (*"p4t6 +1 by list, not by hand"*). This lane was
**not** rebased onto it, so the numbers above are stated for `5ea79126` + my 6 commits, and the
merge is the coordinator's call. What was measured instead of assumed:

- none of those 10 commits touches the fence script, the wrapper test, `packages/tools/harness/`,
  `packages/runtime/root-binding/harness/`, or the adjudication ledger
  (`git log 5ea79126..origin/master -- <those paths>` is empty), so no `DEFERRALS` line of mine
  was edited underneath;
- none of their in-scope files carries a Blueprint document (`blueprintId` text **and** a
  `schemaVersion`-with-digit line: zero candidates), so the closed-set claim — these five paths in
  no gated class — survives the merge, and `dirty(115, 253)` moves only by what other lanes land;
- the p4t6 pin moved upstream **by list** (`0a4f5029`) and this lane creates and deletes no file in
  a counted scope, so `10 passed (10)` survives unchanged; it was re-run at lane head
  `38d8912d` after the evidence commit.

### Root suite, by failing name

Baseline (declared): 9 files / 19 tests — `t1-capability-schema`×9, `p6t3-mediation`×5,
`p6t3-restart`×2, `t2-blueprint-hash`, `d3-member-identity-context`, `p6t6-actions` — plus the 3
collection files that report *no tests* (`p8s3b-result-effects`, `t12a-b2-child-identity`,
`t12a-glue-handoff-ports`).

This run (`scratch/root-test-after.txt`, names in `scratch/after-names.txt`): every one of those
19 names fails, with the same per-file counts, and the same 3 collection files fail to collect.
The **only** names outside the baseline are five `p6t1-parallel` tests (P1 N=2 ×2, P3 quota race
×3). That file is the declared flake; here it exceeded the declared ±1–3 band in count, so it was
not waved through:

- run alone, twice: `pnpm exec vitest run packages/runtime/test/p6t1-parallel.test.ts` →
  **9 passed (9)** both times;
- the repo's own §7.0 gate logs already show this suite moving run-to-run
  (`dev/agent-workflow/evidence/a4-pr7/gates/7-0-root-run1.txt` = 20 failed tests,
  `7-0-root-run2.txt` = 21 failed tests, with `p6t1-parallel` among them);
- nothing in this lane's diff can reach it: the five migrated paths are harness programs that no
  test imports (`grep` over `packages`/`tests`/`scripts` finds only path-string mentions in
  `p4t6-session-event-scan.test.ts` and the `bounded-run.regression.test.mjs` port ledger, and the
  three `blueprint-source` "hits" are the unrelated production module
  `packages/runtime/src/plugin/blueprint-source-index.js`), and the other edited file is the
  fence wrapper itself.

Verdict: environmental (whole-machine load from concurrent lanes), reported with the count
because it is outside the declared band.

## Post-approval round (parent's rulings): mutation proofs, the rebase, and the gates

Two rulings came back on the lane: **D3 approved on the condition that the rewritten control be
shown able to fail**, and **rebase onto `origin/master` (`ff9218a3`) before merge** because
`0a4f5029` moved `p4t6`'s pin by list, *"which is exactly the arithmetic I want re-derived rather
than reasoned about"*. Both are done; the mutation proof is what changed the code again.

### The control was partly decorative, and a mutation is the only reason that is known

The full write-up, the three-mutation table and the empty-set measurement are in deviation **D3**
below. The short version: mutating the report producer and re-running the wrapper showed that the
first rewrite of `the fence reports sites, not a bare count…` could not see **one specific class of
under-reporting** — a site whose `L<line>=v<version>` token also occurs on another report line
(69 of the 253 dirty sites, measured) keeps passing a whole-report `toContain` even when its
suffix is deleted. That is exactly the "decorative" case the parent asked to be reported rather
than patched quietly. It is reported **and** fixed: the leg now parses the `OFFENDING` lines into
`path → sites printed for that path` and requires each site on its own path's line, and all three
mutations (A: strip the suffix of the first site of every line; B: drop one dirty path from the
naming; C: strip one colliding site) redden it, one leg each time, 57 others passing.

Restoration was mechanical, not remembered: the fence script was restored by `cp` and its sha256
re-checked after **every** mutation round ([`scratch/fence-script-sha.txt`](scratch/fence-script-sha.txt)
= `bcb569c107b6e413025764993a31839e300cf2bed94f29cad405ef87343ac432`), and `git status` on
`scripts/` was empty at the end of each round. `git checkout --` was never used.

**The answer to the empty-set question, executed** (not reasoned): with `dirty: []` fed to the real
`formatReport`, both loops run 0 iterations and pass; `RESULT dirty(0 files, 0 sites)` and
`RESULT verdict: clean (dirty 0, unadjudicated unknown 0)` are printed; the tally assertion still
passes because it tracks the real count; the one literal reader-anchor assertion fails, which is
the same retirement event the archetype leg below already forces. No `dirty.length > 0` guard was
added — that would re-arm the leg as the red-on-success control it was rewritten to escape.
[`scratch/control-empty-set-probe.mjs`](scratch/control-empty-set-probe.mjs) reproduces it.

**A discarded round, recorded because it is the interesting part:** the first mutation battery
"passed" all three checks because my parse tested `!== undefined` on `RegExp.exec`, which returns
`null` — the leg threw a TypeError and every mutation looked caught. The green baseline run that
must follow a mutation round is what exposed it. A mutation battery without a green control run
proves nothing in either direction.

### The rebase

`git rebase --onto ff9218a3 5ea79126 feat/a4-74-hts-fixtures` — 7 commits replayed, **zero
conflicts** (consistent with the path-overlap check below), `origin/master` re-fetched first and
still at `ff9218a3`. Nothing was pushed. Commit map (old → new):

| | pre-rebase | post-rebase |
|---|---|---|
| 1/5 `blueprint-source` | `94831a22` | `528b552c` |
| 2/5 `d4-restart-reopen` | `280e3145` | `2e22a43d` |
| 3/5 `g5-member-e2e` | `bfca3353` | `9a3aa5ef` |
| 4/5 `run.mjs` | `1a7c30eb` | `3f303e78` |
| 5/5 `t12-vertical` | `476cae32` | `94202668` |
| findings + evidence | `732cfa63` | `235c4962` |
| control rewrite + mutation proofs | `fa6081ce` | `561c3164` |
| the typecheck fix below | — | `2ead5aa1` (new) |

The reviewer was dispatched against `732cfa63`; the content of the five migrations and of the
findings commit is unchanged by the replay (no conflicts, no edits), so the review stands for the
five files — but **the control leg changed after that SHA** (`fa6081ce`/`561c3164` plus
`2ead5aa1`), and the reviewer must be told to look at the current head, not at `732cfa63`, for
`packages/testkit/test/a4p7-blueprint-version-clean.test.ts`.

### Gates re-run in the landing tree (every quote below is from this worktree at the new head)

| gate | command | result |
|------|---------|--------|
| load check | `node --check` ×5 | all five OK |
| fence, twice | `node scripts/verify-blueprint-version-clean.mjs` ×2 | exit **1 / 1**; the two outputs are **byte-identical** (`sha256sum` `242ef431…` both, `diff -q` silent); `scanned-in-scope: 744 tracked files`; `RESULT dirty(115 files, 253 sites)`, `unknown(0 files, 0 sites)`, `advisory(12, 18)`, `refused(52, 115)`, `prose(5, 5)`, `adjudicated(16, 24)`, `RESULT verdict: dirty-or-unknown` |
| my five paths | grep of the report | absent from every gated class; the only line is the non-gating `PROSE packages/tools/harness/t12-vertical.mjs :: L1852=v2` |
| wrapper | `pnpm exec vitest run packages/testkit/test/a4p7-blueprint-version-clean.test.ts` | **58 passed (58)** |
| test counter | `pnpm exec vitest run packages/testkit/test/p4t6-session-event-scan.test.ts` | **10 passed (10)** — re-derived against upstream's moved pin, not reasoned about; this lane still creates/deletes nothing in a counted scope |
| typecheck | `pnpm -r run typecheck` | exit **0**, `grep -c "error TS"` = 0 — after one real fix of my own, see below |
| lint | `npx eslint` on the five | unchanged: **one pre-existing error**, `g5-member-e2e.mjs 640:16 'apiPage' is defined but never used` (D5, routed to §7.6) |
| identity lint | `node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt` | `160 identity lines, 76 distinct; new 0, resolved 0` |
| root suite | `rm -rf packages/testkit/test/.tmp-fault/ && pnpm test` | `9 failed files / 19 failed tests` (492 files, 6170 tests) — **exactly** the declared baseline by name, zero new names; `p6t1-parallel` did not misbehave this time |
| parse probes | the five probes, standalone | all seven documents re-derived to the same identities: `a7f3203f…`, `2c4f61c5…`, `bd1e78eb…`, `89bc0454…`, `4d50ddf5…`, `d457a829…`, `b369ceee…`; every one `parsed_schemaVersion: 3` |

**`dirty(115, 253)` survived unchanged** — that was the specific thing to check, since ten commits
landed underneath. It is a real check, not a stale tree: scope grew `741 → 744 tracked files`, so
three in-scope files did arrive and none of them carries a Blueprint document site. The counter did
not move because of my five paths, and nothing else moved it either.

### Two findings that belong to other people's merges, said loudly

1. **`a4p75-composition-smoke-classification` fails deterministically in a fresh worktree at
   `ff9218a3`, and this lane cannot cause it.** First root run after the rebase: 11 files / 23
   tests, with a new name `composition-smoke verdict against this repository > never reports a
   passing gate over a step it did not run`, failing on
   `the closure-gated leg did not print PASS by name (client plugin (packages/client))`. It failed
   in isolation too (1 failed / 52 passed), so it is not load. Cause, measured: that arm is
   closure-gated on the built artifact `packages/client/dist/packages/client/src/plugin/client.js`
   (`scripts/composition-smoke-targets.mjs:41-42`), and a fresh worktree has never run the client
   build — `packages/client/dist` did not exist here, while the main worktree has it. After
   `pnpm --filter ./packages/client run build` (plain `tsc -p tsconfig.build.json`: no host, no
   port, no `tests/homes/**`), the file is **53 passed (53)** and the root suite is back to exactly
   the declared 9/19. Attribution: this lane touches **zero** files under `scripts/` and zero in
   that test (`git diff --name-only ff9218a3..HEAD -- scripts …a4p75… | wc -l` → `0`); the leg that
   reddens arrived with `12a76047` (*"a SKIPPED step now fails the composition gate"*, merged as
   #136, i.e. the §7.6 lane). **Consequence for every other lane and for §7.6:** from `12a76047`
   on, a worktree that has not built `packages/client` cannot get a meaningful root-suite baseline,
   and the failure looks like a governance regression rather than a missing build. Worth a line in
   the §7.6 runner or in TEST_METHODS §2.
2. **`pnpm -r run typecheck` caught a defect in my own control that the test suite could not.**
   After the control rewrite, typecheck exited 2 with `TS2345`/`TS2532` at the new parse
   (`noUncheckedIndexedAccess` makes `RegExpExecArray` groups `string | undefined`, so
   `off !== null` narrows nothing) — while vitest reported 58/58 green, because it strips types
   without checking them. Fixed in `2ead5aa1` with named locals, not with `!` or a cast. The
   general point is in that commit body: my mutation battery proved runtime teeth and said nothing
   about types, and the earlier `typecheck exit 0` quote predated the leg entirely, so it was not
   evidence for it.

### What changed since the lane report

`732cfa63` → `2ead5aa1`: one control leg rewritten again (per-path token membership), one typecheck
defect of mine fixed, the whole lane replayed onto `ff9218a3`, and the two findings above measured.
Nothing else moved: the five harness files, their hashes, and the DEFERRALS deletions are untouched
by this round (`git diff 732cfa63 2ead5aa1 -- packages/tools/harness packages/runtime/root-binding/harness`
is empty modulo the replay).

## Deviations and stops

- **D1 — lane assignment.** The `DEFERRALS` note for
  `packages/runtime/root-binding/harness/blueprint-source.mjs` labelled it `C-runtime-fixtures`;
  the coordinator assigned the file to this lane. Executed as assigned; recorded because a
  mislabelled owner in the list is how a file gets migrated twice or not at all.
- **D2 — second site on file 5.** The plan/note claimed a "v2 document"; measured shape and
  disposition in the section above. This is a correction to the plan's own site enumeration, not
  extra scope.
- **D3 — the wrapper's positive control was rewritten, not just re-pointed, and then rewritten
  again because a mutation proved the first rewrite partly decorative.** Migrating `run.mjs`
  reddened *two* legs: `every deferred path is still dirty (a migrated path must leave the list)`
  and `the fence reports sites, not a bare count, and names a file the reader can open`, which
  hard-coded `OFFENDING packages/tools/harness/run.mjs :: `. The first is the ratchet working; the
  second is a control pinned to a file its own lane is migrating — a control that goes red on
  **success**, which is when mutes happen. It now asserts the law it stood in for: every dirty
  **path** is named and every dirty **site** prints its `L<line>=v<version>`, and it keeps one
  literal named path for the reader (the archetype the next leg pins line-by-line,
  `packages/domain/blueprint/testdata/fixtures.ts`). Nothing muted, no assertion deleted, no
  version constant or scope touched.

  **Proof it can fail** (coordinator's requirement — a universal assertion that cannot go red is
  inventory, not a control). Three mutations to the report *producer*
  ([`scratch/mutate-fence.mjs`](scratch/mutate-fence.mjs)) — never to the scanner, the wrapper, or
  the fence's classification rules; the pristine script is restored by `cp` and its sha256
  re-verified after every round ([`scratch/fence-script-sha.txt`](scratch/fence-script-sha.txt),
  `bcb569c1…`):

  | mutation | what it breaks | first rewrite (whole-report `toContain`) | final rewrite (per-path) |
  |---|---|---|---|
  | A | the first site of every dirty line loses `=v<version>` | **red** | **red** — `the report must print cordis.patch.yml L60=v1 on that path's own OFFENDING line` |
  | B | one dirty path vanishes from the naming, sites still in the result | **red** | **red** — `the report must name the dirty path …a1-permission-policy.test.ts` |
  | C | **one** site whose token also occurs elsewhere loses its suffix | **GREEN — decorative** | **red** — `… must print packages/domain/test/blueprint-v1-frozen-resume.test.ts L76=v1 …` |

  Mutation C is the one that mattered. Measured on the real report: **69 of the 253 dirty sites**
  have an `L<line>=v<version>` token that also appears on some other report line, so a whole-report
  `toContain(token)` cannot see those sites being stripped — 27% of the sites were unchecked while
  looking checked. The final rewrite therefore parses the `OFFENDING` lines back into
  `path → sites printed for that path` and requires each site on **its own** path's line; an empty
  parse fails every path assertion rather than satisfying them. Logs:
  [`mutation-A-wrapper.txt`](scratch/mutation-A-wrapper.txt),
  [`mutation-B-wrapper.txt`](scratch/mutation-B-wrapper.txt),
  [`mutation-C-wrapper.txt`](scratch/mutation-C-wrapper.txt) (final rewrite, red),
  [`mutation-C-against-old-form.txt`](scratch/mutation-C-against-old-form.txt) (first rewrite,
  green), [`mutation-proofs-strengthened.txt`](scratch/mutation-proofs-strengthened.txt) (all
  three, same round, sha-verified restores). One round of "proofs" was thrown out before this: my
  first parse used `!== undefined` on `RegExp.exec`, which returns `null`, so the leg died on a
  TypeError and every mutation "passed" for the wrong reason — caught by the green baseline that
  had to follow, fixed, re-run.

  **Empty-set behaviour, executed not asserted**
  ([`scratch/control-empty-set-probe.mjs`](scratch/control-empty-set-probe.mjs), which feeds the
  real `formatReport` a run whose `dirty` is empty and everything else intact): both loops run
  **0 iterations** and pass; the report says `RESULT dirty(0 files, 0 sites)` and
  `RESULT verdict: clean (dirty 0, unadjudicated unknown 0)`; the tally assertion
  (`RESULT dirty(0 files`) still passes because it tracks the real count; and the single literal
  archetype assertion **fails**. So the leg is not purely vacuous at closure — it goes red there on
  exactly one assertion, the reader-anchor literal, which is the same retirement event the leg
  immediately below already forces (it pins that path's five named lines). That is one named review
  event, not a silent pass, and it is not the red-on-success shape the leg was rewritten to
  escape: there the trigger was *this lane cleaning its own file*, here it is *the archetype
  fixture itself moving*, a real change to the corpus the leg describes. The loops' vacuity is
  correct at closure and is why the leg carries no `dirty.length > 0` guard of its own: a guard
  would re-arm the control against the plan's own success. Emptiness is owned by the exit-contract
  leg (`exit 1 iff dirty or unknown`) and the two-directional `DEFERRALS` legs.
- **D4 — one prose line in `run.mjs` was stale, not just old.** `:1678` read "human-override
  records - the only **v1** authority that can GRANT a cell". The ruling is about the
  human-override lane, not the document version, so the qualifier is gone and the sentence says
  why. Zero assertions touched. Flagged because it is a comment edit outside the document region.
- **D5 — pre-existing eslint error, not fixed.** `npx eslint` on the five files reports
  `packages/tools/harness/g5-member-e2e.mjs:640:16 'apiPage' is defined but never used`. It is
  pre-existing: the symbol is defined at `5ea79126:packages/tools/harness/g5-member-e2e.mjs:622`,
  was introduced by `2602d730` (the G5A harness commit), and `git diff 5ea79126..HEAD -- <that
  file>` contains zero mentions of it (line number moved 622→640 because of the inserted carrier
  comment). Not fixed: deleting an unused helper from a real-host harness that this lane is
  forbidden to run is exactly the kind of unverifiable "while I was here" edit this phase keeps
  producing. Owner: whoever next runs the tools harness in §7.6.
- **D6 — no `intentional-retired.md` row**, with the pre-drafted row text above and the reasoning.
- **D7 — environment, not code.** `pnpm install --frozen-lockfile` fails in this environment with
  `[ERR_SQLITE_ERROR] unable to open database file` against the default read-only store; the
  working incantation is `pnpm install --frozen-lockfile --store-dir
  /home/user/dsh-plugins/dsh-agent-team/.worktrees/.pnpm-store`.
- **D8 — probes and before/after logs are committed evidence, copies are not.** The
  pre-migration state of files 2–5 is reproducible with
  `git show <commit>^:<path>` (the exact commands are the headers of
  [`scratch/probes-before-all.txt`](scratch/probes-before-all.txt)); re-running each probe on that
  blob reproduces the recorded v1 hashes byte-for-byte. Harness copies were deliberately not
  committed: they would put retired-version literals in the tree for no evidentiary gain.
- **Stop (not a deviation):** `docs/**` and `dev/agent-workflow/SESSION_ROUTER_LOG.md` were not
  touched (coordinator-owned), nothing was pushed, `master`/`stable` untouched, and no other
  worktree was entered.

## What §7.6 owes this lane (the unexecuted half, per file)

Each of these five programs must be run end to end at/after the flip, and the named leg is the
one the empty carriers could in principle have moved — so those are the assertions to read first
in the §7.6 receipts:

1. `blueprint-source.mjs` → the P5-T5 bounded run: the boot parse (`plugin.mjs:431`) succeeds and,
   where a run directive supplies one, the cross-check at `:439` agrees with the derived v3 hash
   `sha256:a7f3203fba5ab13215054fdc5a9ace02318a934ca41d15f09aaf8625d6e838b5`. Nothing live pins the
   old value — `grep -r a22c7816` across the tree hits only historical run records under
   `dev/agent-workflow/evidence/dsh-020rc2-upgrade/` — so there is no stale hash to re-point, and
   re-pinning one would have been the lie this file's own header warns about.
2. `d4-restart-reopen.mjs` → the restart/reopen legs (identity + anchor re-read after restart),
   with the boot document at
   `sha256:2c4f61c5c63214989eaf55c6358105b491b89914f005615ae595f4fb76d2feff`.
3. `g5-member-e2e.mjs` → **S4a/S4b/S4c** (real member file/shell tool turns) plus the D3 identity
   block.
4. `run.mjs` → the whole P6-T6 set, above all **P8-S4B M-scenarios** (operator `human-override`
   grants landing on the seeded worker's next turn) and `EXPECTED_TOOL_COUNT = 13`.
5. `t12-vertical.mjs` → all three worlds; **V3** (external stage-1 HARD deny of `mcp`), **V4**,
   and **V5**'s projection leg including `sv === 2`.

## Reproducing this lane's evidence

```bash
cd .worktrees/a4-74-hts
node --check packages/tools/harness/t12-vertical.mjs            # …and the other four
node dev/agent-workflow/evidence/a4-pr7/7-4-hts/probes/probe-t12-vertical.mjs   # after-state
git show 476cae32^:packages/tools/harness/t12-vertical.mjs > /tmp/t12-before.mjs
node dev/agent-workflow/evidence/a4-pr7/7-4-hts/probes/probe-t12-vertical.mjs /tmp/t12-before.mjs
node scripts/verify-blueprint-version-clean.mjs
pnpm exec vitest run packages/testkit/test/a4p7-blueprint-version-clean.test.ts
```

Probes load the parser from `packages/runtime/dist/packages/domain/blueprint/src/index.js` (the
committed dist mirror of the v3 validator) and evaluate the document **as the file builds it** —
the array literal sliced out and joined, or the file's own builder function called — so the
certified bytes are the harness's bytes. Every probe also runs the parser's own refusal controls
over the same document: forging the version to 9 →
`SCHEMA_VERSION_MISMATCH "unsupported blueprint schema version 9; this build supports [1, 2, 3]"`,
and deleting either carrier → `MALFORMED_DTO "blueprint is missing required field '<key>' at $"`.
Those two refusals are what make "`rules: []` is required, not decorative" a checked statement
rather than a claim; on the pre-migration copies the carrier controls honestly report *"no such
carrier in this document"* instead of pretending a v1 document had them.
