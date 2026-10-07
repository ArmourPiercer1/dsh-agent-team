# Lane C-testkit — §7.4 Blueprint fixture migration (pre-flip half) — FINDINGS

Branch `feat/a4-74-ctk-fixtures`, worktree `.worktrees/a4-74-ctk`, base `origin/master = 0af1bd63`
(after two coordinator-ordered rebases: `a55c4fbe` INTENTIONAL_RETIRED, `0af1bd63` fence round 3).
Head at report time: see `git log --oneline` — commits, in order:
G1 (group 1) → G2 (boot) → pin (bp1h:95 retirement) → evidence → G3 (twelve kits) → G4 (pr-e/pr-f + notes) → this file.

## 1. Dispositions used

Only the two lawful pre-flip dispositions: **migrate-by-hand** (19 files) and
**stop-and-disclose** (1 file: `p7t6`, not touched at all). The `pr-e`/`pr-f`
files are **migrated** (live docs) AND **keep one site each** (the protected
historical anchor). Counting, per the review correction (c): **19 migrated,
1 stopped-and-disclosed; 17 files at zero sites; 3 files keep sites
(1 + 1 + 9 = 11).**
No site was inverted, no skip/only/todo added, no vacuous assertion, no version constant,
scan script, or scan scope touched, no fixture padded with identity keys.

Every migrated site was probe-RED first: rewriting the declared version to `9` makes the
tree's own strong parser refuse with `SCHEMA_VERSION_MISMATCH` ⇒ the version is read ⇒
migrate-by-hand (not delete-lie) was correct. No probe came back green anywhere.

## 2. Gate results

| gate | result |
| --- | --- |
| fence scan before (baseline) | `dirty(120,259) unknown(16,24) advisory(12,18) refused(52,115) prose(5,5)`, exit 1 |
| fence scan final | `dirty(103,215) unknown(0,0) adjudicated(16,24) advisory(11,16) refused(52,115) prose(5,5)`, exit 1 (other lanes' paths remain) |
| wrapper `a4p7-blueprint-version-clean.test.ts` | **58/58** on the round-3 base (red-first captures before every DEFERRALS deletion: G1 named 4 paths, G2 named `tests/mock/scripts/boot.mjs`, G3 named the twelve — transcripts `wrapper-red-*.txt`) |
| 3 testkit specs + p7t6 legacy spec (unedited) | 41/41 |
| `p4t6-session-event-scan` | 10/10 (edits were inside existing counted files; no inventory increment; nothing added/removed under counted roots; harness copies NEVER entered any commit — created and `rm`'d inside one bash call) |
| `node --check` every touched `.mjs` | all clean |
| `pnpm -r run typecheck` | 0 errors |
| `npx eslint` changed files | repo-linted files clean; `tests/kits/**` is eslint-ignored by config — forced `--no-ignore` error counts identical pre/post (33/33, 34/34 sampled) |
| `lint-identities --diff` baseline `0237d487` | 160 lines / 76 distinct, **new 0, resolved 0** |
| root `pnpm test` (after `rm -rf packages/testkit/test/.tmp-fault/`) | 9 files / 19 tests failed — **failing-name identical to baseline**: `t1-capability-schema`×9, `p6t3-mediation`×5, `p6t3-restart`×2, `t2-blueprint-hash`, `d3-member-identity-context`, `p6t6-actions`; no-tests trio (`p8s3b-result-effects`, `t12a-b2-child-identity`, `t12a-glue-handoff-ports`); `p6t1-parallel` did not flake this run. None of my files is in the failing set. |

## 3. Per-file before/after (fence sites, baseline scan → final scan)

| # | file | before | after |
| --- | --- | --- | --- |
| 1 | `packages/testkit/test/bp1h-blueprint-authoring.test.ts` | dirty L128; advisory L95, L149 | **none** (identity pins 1→3; weak draft v3+envelopes keeping its named invalidity `templateId: 42`; named advisory pin retired in the `pin` commit) |
| 2 | `packages/testkit/test/t6-10-composition-pipeline.test.ts` | dirty L64 | none (doc v3+envelopes; hash stays derived) |
| 3 | `packages/testkit/test/t6-7-fresh-per-delegation.test.ts` | dirty L63 | none (same) |
| 4 | `scripts/blueprint-authoring.mjs` | dirty L92 | none (`draftSkeleton` → CLOSED v3 skeleton + both envelopes; docs updated) |
| 5 | `packages/legacy/test/p7t6-teammates-adapter.test.ts` | dirty 9 sites | **unchanged — STOPPED** (see §6) |
| 6 | `tests/mock/scripts/boot.mjs` | dirty L248 | none |
| 7 | `tests/kits/c1-leader-approval-smoke/…` | L506, L628 | none |
| 8 | `tests/kits/exec-contract-live-smoke/blueprint.mjs` | L168, L194 | none |
| 9 | `tests/kits/f15-mcp-live-loss-smoke/…` | L628(v2), L701 | none |
| 10 | `tests/kits/mcp-initial-grant-smoke/…` | L475, L510 | none |
| 11 | `tests/kits/model-preference-routing-smoke/…` | L337, L359, L417 | none |
| 12 | `tests/kits/pr-b-effective-policy-smoke/…` | L688, L748 (template literals) | none |
| 13 | `tests/kits/pr-c-mcp-isolation-smoke/…` | L569, L622, L661 | none |
| 14 | `tests/kits/pr-d-control-real-host/…` | L1158, L1292 | none |
| 15 | `tests/kits/pr-e-requirement-recovery-smoke/…` | L446(v1 anchor), L795/L810(ledger v2), L1155/1322/1409(v2 docs), L1496(v1 anchor-live) | **L447=v1 only** — the protected historical anchor (line shifted +1 by the ledger import; bytes identical). Ledger rows → `TEAM_DOMAIN_SCHEMA_VERSION`; live docs → v3. DEFERRALS entry KEPT with disposition note. |
| 16 | `tests/kits/pr-f-closure-smoke/…` | L375(anchor), L787/L802(ledger), L1175/1352/1490/1577(v2), L1446(v1 spill), L1664(v1 anchor-live) | **L376=v1 only** (same story) |
| 17 | `tests/kits/rc2-real-host-smoke/…` | L603, L643 | none |
| 18 | `tests/kits/send-message-liveness-smoke/…` | L480, L601 | none |
| 19 | `tests/kits/team-view-sync-complete-e2e/…` | L217 | none |
| 20 | `tests/kits/work-completion-wakeup-smoke/…` | L489, L604 | none |

My files in the final `advisory` class: **none** (the round-3 closed-backslash-continuation
advisory branch does not reclassify any of my sites — checked line-by-line against the class
lists); none of my emitted documents is partial, so the `refused` class is unchanged by this
lane (`refused(52,115)` before and after) — and no fixture was padded to manipulate it.

## 4. What each migrated document must keep proving, and how it is shown

Method (all kits): the documents were **assembled by the emitter's own code** — truncated
copy at native depth (definitions only, cut before `async function main`) or full copy under
the module's own entry guard, temp files in the kit directory, deleted in the same call —
then parsed with the tree's strong parser (`parseBlueprint`) and probe(v9)-refused.
PRISTINE world parses 44/44 at the OLD versions (harness fidelity), CURRENT world parses
every migrated document at v3 (`parse-probe-current-final.txt: ALL-OK`).
Per-kit transcripts: `per-kit/parse-<kit>.txt` (parse+probe) and `per-kit/docdiff-<kit>.diff`
(emitted bytes, pre vs post: across all **31** group-3 documents the ONLY non-noise delta is one
version line + the four envelope lines; the only other deltas are per-run `RUN_STAMP` marker
noise in personas). [Correction (b) from the review: the G3 commit message says "32 emitted
docs"; the correct count is **31** — the 44-document headline stands: 31 (twelve kits) + 5
(pr-e) + 7 (pr-f) + 1 (boot).]

Downstream consumer of each document (what would break silently if assembly broke):
- `boot.mjs` — the mock host's row-anchor document, ingested by the host's strong parser at
  boot; `tests/mock` driver flows assert on the booted row's blueprint identity.
- c1 — saved sources the approval-smoke host resolves; leader `capabilities.teamTools` drives
  the ask/deny legs the kit's criteria assert.
- exec-contract `blueprint.mjs` — library builders the exec-contract kit imports; token arm
  feeds its exec-token criteria.
- f15 / mcp-initial-grant — MCP grant documents; the kits' grant-loss criteria read the
  resolved capability state.
- model-pref — anchor + main + role documents; the kit's role documents carry model-preference
  routing, and its S-legs assert on resolved templates. **Its `BP_ANCHOR_YAML` migrated too**
  — only the *historical copies inside pr-e/pr-f* stay v1.
- pr-b — the two policy-state documents its effective-policy legs diff.
- pr-c — mcp-isolation vs workflow team documents; its isolation assertions read resolutions.
- pr-d — control-plane documents; control-flow legs assert on envelopes (byte-identical).
- rc2 / send-message / work-completion — row anchors + saved sources; send-message and
  work-completion additionally run `assertBlueprintInspectsOk` over their own documents
  before booting (kit-internal proof leg, executed at §7.6).
- team-view — the single TVS document its sync assertions resolve.
- pr-e / pr-f — consent hashes for the LIVE documents are **derived** at runtime
  (`parseBlueprint(...).contentHash`), so nothing hand-copied rides the migration; the
  ledger rows the kits seed must byte-compare against the host's canonical form — proven
  byte-identical below.

Envelope choice (all): `rules: []` = expansion of NOTHING is authorized — fail-closed, not
a boundless approximation. The kits' proof axis is the TEAM/CONTROL/APPROVAL planes
(`teamEnvelope`, `memberEnvelopes`, capabilities — all byte-identical); the
`permissionMutationEnvelope` axis (`operationClass` ∈ `PERMISSION_TOOL_NAMES`) is not what
any of these kits tests; approval-plane no-match meets identity (no narrowing). Grep-verified
no kit exercises permission-mutation escalation flows through the migrated documents.

## 5. Historical pair and ledger rows (the deliberate residues)

**V1 anchors (`pr-e` L447, `pr-f` L376 after rebase; `V1_ANCHOR_SOURCE` + hand-copied
`V1_ANCHOR_HASH_PRE_PR_E`)** — byte-identical, verified byte-for-byte across worlds AND by
derivation with the tree's own pipeline:
`parseBlueprint(V1_ANCHOR_SOURCE).contentHash = sha256:6a7fba9ffce952639cf85b01714b1ca61a7d4816efe32607f3d7061da0c15a37`
= the pinned literal (MATCH true, `scratch/derive-v1-anchor-hash.mjs`, also inside
`parse-probe-*` output for both kits). Migration of the historical pair would keep the
syntax and destroy the claim. Disposition (coordinator ruling, `7-3-flip/intentional-retired.md`
rows 1–2, quoted verbatim in my DEFERRALS notes): **post-§7.3-flip refusal proof** — at the
flip the kits' claim inverts to refusal, the one lawful `invert-to-refusal`. The line numbers
moved +1 (import insertion above them); the rows file already says "re-verify at the flip".

**TeamDomain ledger rows (pr-e L795/L810, pr-f L787/L802 → now constants)** — replaced the
literal `2` with `import { TEAM_DOMAIN_SCHEMA_VERSION }` (production stamping form).
BYTE PROOF (`ledger-row-byte-identity.txt`, printed rows, not "value is 2"):
```
LEDGER ROW emitted from literal 2 : {"createdAt":"2026-10-08T05:00:00.000Z","factType":"requirement.granted",…,"schemaVersion":2,…}
LEDGER ROW emitted from constant  : (identical)   BYTE-IDENTICAL: true
COUNTER  emitted from literal 2   : {"kind":"ledger-sequence-counter","schemaVersion":2,"value":7}
COUNTER  emitted from constant    : (identical)   BYTE-IDENTICAL: true
```
(both through the production `parseLedgerEntry` + `canonicalJsonStringify` /
`serializeLedgerSequenceCounter`.)
DISCLOSURE, plainly: this moves those four sites **permanently out of the fence's view** —
a constant carries no digit. That is honest only because the constant IS how production
stamps these rows and this is the fence's **false-positive class** (it keys on
`schemaVersion` text + a `blueprintId` half, so any non-Blueprint version axis carrying both
reads as a Blueprint document) — the instrument's class, recorded by the coordinator, not
my fixtures, which were right.

**Site arithmetic for the vanished OFFENDING count (review correction (d)):** my file set
carried **55** baseline OFFENDING sites (`baseline-sites-mine.txt`); it carries **11** now
(`scan-final.txt`: p7t6 9 + pr-e 1 + pr-f 1), so **44 OFFENDING sites vanished — of those,
4 are TeamDomain LEDGER-ROW stamps (pr-e L795/L810, pr-f L787/L802), not documents**; the
other 40 are document-version sites. The review's **46** counts the two bp1h sites
(L95/L149) which vanished from the ADVISORY class, not the OFFENDING class; the full
classified-site delta is 44 OFFENDING + 2 ADVISORY = 46. Without this line the drop would
read as 46 documents migrated; 42 documents + 4 ledger stamps is the truth.

**`p7t6-teammates-adapter.test.ts` — open disposition, NOT resolved by this lane.** File
byte-identical (9 dirty sites stand). It is the legacy `.md` teammate-file format's own
version axis (L380 is the adapter's negative rejection test); migrating would delete the
acceptance proof; §7.3 owns the emitter. DEFERRALS entry KEPT with a note naming it a
non-Blueprint version axis awaiting the fence's dirty-class adjudication row
(`intentional-retired.md` row 3).

## 6. Deviations, accidents, environment facts (with error text)

1. **bp1h named advisory pin retired by me** (coordinator-ruled, own commit, four
   conditions met). **Causality stated correctly per review correction (a) — this also
   corrects the coordinator's brief, which had it backwards:** the ADVISORY drop from my
   file set was **two** sites (`bp1h:95` **and** `bp1h:149`) and was **caused by the
   migration** (the identity pins moved to `schemaVersion: 3`, which the fence does not
   classify) — `bp1h` left the advisory class **entirely**, taking the repo-wide advisory
   class from 12 to 11 files. The wrapper's named-pin failure
   (`AssertionError: packages/testkit/test/bp1h-blueprint-authoring.test.ts:95 must be an
   advisory line: expected undefined to be defined`) was the **consequence** of the
   migration, and its retirement was the consequence of that consequence — deleting the
   pin changed nothing about the class counts. No re-pin to a new line; no advisory site
   was created by my migrations, so no new pin owed.
2. **sed quoting accident on the wrapper during G3** (mangling, caught immediately):
   `sed: -e expression #1, char 60: unknown command: ...` and vitest
   `FAIL packages/testkit/test/a4p7-blueprint-version-clean.test.ts [ ... ]` (collection error).
   Recovery per protocol: `git show HEAD:<path> > <path>` (cp from my own last commit, not
   `git checkout --`), verified 48/48, deletion redone with python content-matching.
   No commit ever contained a mangled wrapper.
3. **Install environment**: default pnpm store is outside the sandbox
   (`ERR_PNPM ... ERR_SQLITE_ERROR unable to open database file`); installed with
   `--store-dir /home/user/dsh-plugins/dsh-agent-team/.worktrees/.pnpm-store` (the shared
   in-repo store). First combined spec run failed `Cannot find package 'yaml'` pre-install;
   resolved by the working install.
4. **Round-3 rebase**: clean (docs+ledger landed under me; `UNKNOWN_LEDGER` left the wrapper
   for the gate-input JSON — none of my files ever carried an UNKNOWN row, so no ledger row
   was moved, added, or re-keyed by this lane). The `.tmp-faultscratch` ENOENT leg did NOT
   fire post-rebase (fix is merged; I saw no `ENOENT … adjud-bad-empty.json`); 58/58 green
   with `.tmp-faultscratch` never created by me.
5. **`pnpm-lock.yaml` drift**: resolved by the rebases; no dependency change touched this
   lane's scope (lock identical across `a55c4fbe..0af1bd63`).
6. **Harness residue**: `git status` in `tests/` clean apart from intended edits; no
   `.a474ctk-*` file exists or was committed (created+deleted inside single calls; verified
   `ls`-empty and porcelain-clean after every harness run).

## 7. Per-kit verification limitation (stated as required)

**No kit and no mock host was booted by this lane** — they are real-host programs
(`main()` spawns hosts on 31xx and writes `tests/homes/**`). Verification is **by
construction and by the fence**: each document is assembled by the emitter's own code and
passes the tree's own strong parser at v3, the probe is red, emitted-byte deltas are
enumerated. **Execution of every kit happens in §7.6** against the migrated sources.
Ports 31xx stayed clear; `tests/homes/**`, `references/**`, `tests/deepseek-harness-test-use`,
`:3080`, `master`, `stable` were never touched. Nothing pushed.

## 8. Files this lane STOPPED on

- `packages/legacy/test/p7t6-teammates-adapter.test.ts` — open disposition, see §5.
- `packages/testkit/test/a4p7-blueprint-version-clean.test.ts` — beyond my own DEFERRALS
  lines and the coordinator-ruled bp1h pin retirement, untouched: no rule, no classifier,
  no scope, no other lane's entry; DEFERRALS deletions were single-line content matches
  (12+1+4 lines) with zero reflow.

## 9. F1 — prose that named the migrated versions (review fix, one commit)

The migration changed version BYTES; this pass changed the prose that NAMED those versions
so it no longer lies — 29 lines across five emitters (f15, mcp-initial-grant, pr-c, pr-e,
pr-f). **Every line is quoted verbatim before and after in
`prose-fixes-before-after.txt`** (driver-asserted: the needle was present exactly once on
each cited line, or the run aborts). The dangerous instances were the PRINTED check names —
f15 L233 (criteria table `C0`) and L1266 (`check('C0', …)`) — which would have carried a
wrong version into §7.6's real receipts; after the fix each check still names the SAME
thing (`C0`, same subject: catalog.get resolves the blueprint + intent.probe PASS), only the
version token moved v2→v3. Doc-comment versions on migrated emitters (f15 L620
`schemaVersion 2→3`, "closed-v1→closed-v3" headers, the `(v2)`/`(v1)` team consts and builder
docs in pr-e/pr-f, `LEGACY v1 leader→LEGACY-shape leader`, `v1 flat list→flat requirements
list`) follow the same one-token discipline.

**Deliberately NOT touched** (different axis or still-correct prose, per the review):
`team.create` contract v1 RPC cells (team-view L26, rc2 L337/339 `version` = remote contract,
pr-d L334 `team.getLedgerPage (v1)`), `MemberInstanceRecordDto v1` (pr-b L627),
`recovery-dispatch/v1` payload shape (pr-e L494/L2547), preset-id semantics (pr-f L144),
the PR-F-G5 finding name (pr-f L26), boot-chain/profile "v2" (boot.mjs L7/L148), historical
mapping labels kept beside corrected ones (pr-f L25 `E.12 S1 (v2 create)`, L88 tail
`the E.12 main world shape`), and ALL frozen-anchor prose: pr-e L186/498/2273, pr-f L24,
plus the inherited-fixture comments pr-f L359/L362 — those name the V1 anchor, which is
still v1 and correct as written.

Gates for this commit: `node --check` on all five touched `.mjs` (prose inside .mjs must
parse), wrapper 58/58, fence run twice with byte-identical output (`scan-f1-a.txt` =
`scan-f1-b.txt`), eslint on the touched kits (config-ignored; forced-lint error counts
unchanged pre/post this commit).
