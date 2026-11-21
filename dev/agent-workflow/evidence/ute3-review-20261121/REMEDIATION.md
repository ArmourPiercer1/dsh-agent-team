# UTE-3 review remediation — finding → change → proof

**Review of record:** [`REVIEW.md`](./REVIEW.md) (independent adversarial, `CLAIMS-EXCEED-EVIDENCE`).
**Base:** `origin/master` = `2b69193fac66f5b89fb2010ca398de3f5b2ecdb5` (re-fetched before work).
**Branch:** `task/ute3-review-fixes-20261121`.
**Scope:** documents, ledger, lane tests and evidence. No product code, no deletion, no
authority move, no approval, no CORE patch.

| finding | what was wrong | what is now true | proof |
| --- | --- | --- | --- |
| **B1** web controls unexecuted | `tests/ute-g1-web/lane-suite.test.mjs` never ran `negative-controls.mjs`; the ledger claimed it did. | The suite executes the script, requires the exact line `NC-VERDICT GREEN controls=11 failed=0`, requires a line-for-line match with the committed transcript, and runs `UTE_WEB_NC_MUTATE=drop-widening`, which must exit 1 with `NC-VERDICT RED controls=11 failed=1`. | `node --test tests/ute-g1-web/lane-suite.test.mjs` → `UTE-G1-WEB-CONTROLS GREEN controls=11 transcript=exact mutated=RED` |
| **B1** fs / search / uistate shrinkable | Their suites ran controls but did not pin the committed transcript or the exact count. | FS (13), search (8 family + 12 B2) and UI/AS (13) now assert the exact control count and a line-for-line transcript match; a deleted control or edited transcript reds. | `node --test tests/ute-g1-fs/lane-suite.test.mjs tests/ute-g1-search/lane-suite.test.mjs tests/ute-g1-uistate/lane-suite.test.mjs` (see `lane-suites.txt`) |
| **B3** member total | 20 booked members. | **27 = 4+2+2+3+2+7+2+5**, with per-family member cells in both tables; the progress board's `unit` column is separately labelled as 3-axis coverage. | `node -e '…census.families.reduce((n,f)=>n+f.nativeNames.length,0)'` → 28 incl. u6-probe; 27 excluding it. |
| **B4** deletion set | 77 files; FS listed 7 of its 17; the 87 body files were not the whole surface. | **87 body files = 17+9+10+10+11+14+9+7**. FS lists all 16 `src/` files + `families/fs.mjs`; the set is defined as every file of the governed family body, derived from `contributionPaths` + the directory because `UTE_OLD_PATH_PARTIALLY_REMOVED` cannot see an omitted entry. The ledger's `fs.oldPath.files` now has the same 17. **Round 2 (F5):** the shared generated surface — `packages/tools/families/{index.mjs,manifest.json,index.d.mts}` — is a separate §6.1 subsection: **87 + 3 = 90** tracked source files, because deleting only the 87 leaves `index.mjs` importing a missing `./fs.mjs`. | `node -e` directory/ledger check (below), `EB3-FAMILY-DEFINITIONS pass files=88`, and `grep -n "6.1 The generated surface" docs/plans/memo/ute-g1-20261120/RELEASE-REQUEST-2026-11-21.md` |
| **B5** stale FS golden meta | Meta said `newPathPending: true` and “the new-path run cannot reproduce these baselines”. | The meta now records the measured truth: the rc.5 new path reproduces all six `FS-I*` rows, `newPathPending` is removed, and the lane suite asserts the stale sentences are absent. | `node --test tests/ute-g1-fs/lane-suite.test.mjs` → `UTE-G1-FS-META newPathPending=absent image-vectors=reproduced` |
| **B6** Group B overreach | One sentence claimed one mechanism for five differences, falsely including `ask_user_question` and web, and miscategorised inspect. | Group B now states each of the five separately: web = repo's own `dsh-agent-team/web-tool` row, not a pinned host package; agent-control = an ungraded claim, not a mounted second implementation; inspect = alias→native **rename**; UI = `present` mounted but `ask_user_question` unmounted by PD-25; AS = all five declared and mounted. Ledger summaries and the uistate source statement match. | `grep -n "Group B" docs/plans/memo/ute-g1-20261120/RELEASE-REQUEST-2026-11-21.md`; `grep -n "SIX of the SEVEN" tests/ute-g1-uistate/lib/semantic-differences.mjs` |
| **B7** route-absent claim | “Neither family is reachable on product route-C”, refuted by its own probe (`present` registered on the preset scope, all five AS names served as inherited preset rows). | Release Group C and both ledger summaries now say: the **bare** route registers none; the shipped preset serves `present` + all five agent-state names from host rows; `ask_user_question` is absent by PD-25; the governed **body** is what is not mounted. 6 of 7 names are served on the product route. | `node scripts/ute-retirement-gate.mjs --all` still refuses; `grep "product-route-absent" dev/agent-workflow/ledgers/ute-retirement.json` |
| **B8** “nonexistent control” | The review claimed the cited FS `unconfined-fs` mutation did not exist. **It does exist; the finding was reviewer error and is withdrawn.** | `unconfined-fs` is a real test: `tests/ute-g1-fs/product-route-image.test.mjs:268` `test('MUTATION unconfined-fs: …')`, collected by the census CI argv (`.github/workflows/census-runtime.yml:434`), and it does exactly “lane denial → 70-byte allow”. The release request keeps the accurate citation (and also names the equally real `NC-MEMBER read_image` control `widen-read-lane-image`; that replacement was harmless but unnecessary). | `grep -n "MUTATION unconfined-fs" tests/ute-g1-fs/product-route-image.test.mjs`; `grep -n "product-route-image" .github/workflows/census-runtime.yml` |
| **B9** wrong partition | A=8 but enumerated 7; three refusal ids double-counted in A/E; D collapsed 8 into 4. | Programmatic map over the ledger: **A=7, B=5, C=4, D=14, E=1 = 31**, every id exactly once, table in the release request. | `node dev/agent-workflow/evidence/ute3-review-20261121/partition.mjs` → `PARTITION VERDICT GREEN groups=5 total=31 unique=31 ledger=31 counts=A7,B5,C4,D14,E1` |
| **B10** `process.oldBaseline` | Ledger said `true` and matrix ✅ while the gate derived `false` (`pwsh` has no baseline vector). | Under `RETIREMENT.md` §2, unit coverage is graded **inside** the term, so a declared wiring exclusion shortens measured coverage, not the census unit: the term is **false**. Ledger records `verdict:false`, both tables say `1/2 (pwsh uncovered)`, and the gate now also emits `UTE_OLD_BASELINE_MISSING` for `process`. | Gate line before: `codes=UTE_MEMBER_UNCOVERED,UTE_NEW_PATH_UNVERIFIED,UTE_SEMANTIC_DIFFERENCES_UNRESOLVED,UTE_VECTOR_UNREPRODUCED`; after: `codes=UTE_OLD_BASELINE_MISSING,UTE_NEW_PATH_UNVERIFIED,UTE_SEMANTIC_DIFFERENCES_UNRESOLVED,UTE_MEMBER_UNCOVERED,UTE_VECTOR_UNREPRODUCED` (`retirement-gate-all.txt`). |
| **B11** stale search note | Said `newPathVerified FALSE, zero PASS lines` while B2 had 15 PASS lines. | The note now records PR B2's 15/15 reproduction and keeps only the real blocker (three unapproved differences). | `grep -n "15/15" dev/agent-workflow/ledgers/ute-retirement.json`; `grep -c "NEW-PATH-VECTOR .* PASS" dev/agent-workflow/evidence/ute3-search-b2-20261120/new-path-run.txt` → 15 |
| **NB** absolute host paths | FS/search new-path and FS capture transcripts embedded absolute worktree roots; the first fix's grep also **omitted** `ute3-search-b1-20261120/{README.md,lane-suite.txt}` and `ute3-search-b2-20261120/lane-suite.txt`, which still carried `/home/armourpiercer/...`. | Every host-absolute path in the **UTE-G1 evidence set** is redacted to `<host-root>` / `<tmp>` / `<srv>` / relative paths (21 files, including the three the first pass missed), with the rules and the residual whole-tree count disclosed in [`HOST-PATH-AUDIT.md`](./HOST-PATH-AUDIT.md). The redaction is textual and changes no measured number. | `grep -rInE '(^|[^.[:alnum:]_/-])(/home/\|/Users/\|/tmp/\|/srv/)' dev/agent-workflow/evidence/ute0-* dev/agent-workflow/evidence/ute1-* dev/agent-workflow/evidence/ute2-* dev/agent-workflow/evidence/ute3-* dev/agent-workflow/evidence/ute-g1-* \| grep -v ute3-review-20261121 \| wc -l` → 0 |
| **NB** host-less connect bag | `connect({port})` defaulted to `localhost` (fail-open). | It classifies as `<unknown>` → external and is refused `EGRESS_REFUSED`; `NC-NET-COUNTER-POSITIVE` drives the bag and requires `external=2`, `host-less-bag=EGRESS_REFUSED`. | `NC-PASS NC-NET-COUNTER-POSITIVE external=2 … host-less-bag=EGRESS_REFUSED …` |
| **NB** vacuous `installed` conjunct | `net.Socket.prototype.connect !== undefined` was always true. | Uses `networkWitnessInstalled()` (refcount) before uninstall; the control fails if the witness is not installed. | same transcript line: `witness-installed=yes` from the refcount |
| **NB** “12 controls” conflation | Search's 8-family battery was reported as 12. | Both documents state **8 family + 12 B2** and call them non-interchangeable; each suite pins its own exact count. | release §3, progress §1; `node --test tests/ute-g1-search/lane-suite.test.mjs` |

## Not fixed here, and why

- **B2 (gate inflation)** is not in this task's finding list. It is a gate-logic hardening
  owned by the other lane; this branch does not touch `scripts/ute-retirement-gate.mjs`.
- **`UTE_OLD_PATH_PARTIALLY_REMOVED` still cannot see an omitted entry.** The detector's
  semantics are unchanged; the mitigation is that the deletion set and `fs.oldPath.files`
  are now derived from the directory (17/87), so there is no omitted entry for it to miss.
- **The gate test pin was updated.** `scripts/ute-retirement-gate.test.mjs` pinned the
  process code set exactly. B10 explicitly required updating that pin when the corrected
  ledger changes the code list (`UTE_OLD_BASELINE_MISSING`), so the expected set was
  extended; no assertion was weakened and the gate logic was not modified. This is the one
  place where the task's B10 instruction and the generic hard-fence sentence conflict; the
  specific B10 instruction is followed and disclosed here.
- **The process baseline itself is still 1/2.** No `pwsh` vector exists and none was
  fabricated; the term is recorded false rather than made green by shrinking the unit.

## Commands (verbatim output in `lane-suites.txt` / `retirement-gate-all.txt`)

```
node dev/agent-workflow/evidence/ute3-review-20261121/partition.mjs
node --test --test-force-exit --test-timeout=480000 tests/ute-g1-fs/lane-suite.test.mjs tests/ute-g1-search/lane-suite.test.mjs tests/ute-g1-web/lane-suite.test.mjs tests/ute-g1-process/lane-suite.test.mjs tests/ute-g1-agentctl/lane-suite.test.mjs tests/ute-g1-uistate/lane-suite.test.mjs
node --test --test-force-exit --test-timeout=1500000 scripts/ute-retirement-gate.test.mjs
node scripts/ute-retirement-gate.mjs --all
node scripts/eb3-ci-required.mjs
node scripts/test-catalog.mjs --max-uncollected 41 --max-excluded 7
node scripts/eb3-family-definitions.mjs
node scripts/ute-family-inventory.mjs
node scripts/docs-sync.mjs --check
node scripts/check-append-only-log.mjs
git diff --check
git ls-tree -r --name-only HEAD | grep -c '^tests/deepseek-harness'
```

## Review round 2 (`VERIFICATION-2.md`, `FIXES-PARTIAL`) — what changed here

The second adversarial verification confirmed B1/B3–B7/B9–B11 fixed and withdrew B8 as
its own error. This branch answers its remaining document/evidence findings (F5–F10):

- **F5** — the generated surface `packages/tools/families/{index.mjs,manifest.json,index.d.mts}`
  is now §6.1 of the release request: regenerate per removal, never delete blindly;
  revised total **87 + 3 = 90**; the broken-import consequence is stated.
- **F6** — the three transcripts the first grep omitted, and every other host-absolute
  path in the UTE-G1 evidence set, are redacted; rules, changed files, number-stability
  proof and the disclosed whole-tree residual are in [`HOST-PATH-AUDIT.md`](./HOST-PATH-AUDIT.md).
- **F7** — the “does not remove every capability” / “change nothing observable”
  contradiction is replaced by the exact per-family claim (six families lose nothing
  reachable on the shipped preset; `agent-control` also loses nothing reachable but has
  no second implementation; `inspect`'s governed body **is** the only implementation).
- **F8** — “two byte-identical captures” is qualified everywhere it is stated (release
  term table, progress board, ledger notes): committed pair = search/web/ui/agent-state;
  capture-vs-fixture = fs/process; two fresh in-suite captures with no committed pair =
  agent-control.
- **F9** — `NC-MEMBER-POSITIVE edit` now grades the whole row with the same
  `COMPARED_FIELDS` comparator the golden uses, instead of only outcome/refusal.
- **F10** — the B8 row above is corrected to “withdrawn as reviewer error”, the accurate
  `unconfined-fs` citation is restored/kept in the release request, and
  [`CORRECTIONS.md`](./CORRECTIONS.md) records the verifier's two self-corrections
  (`contradicts` 7 not 68; 6 of 7 ui/AS names served, not 5) alongside ours.

**Residual, disclosed:** the requested whole-tree grep (`dev/agent-workflow/evidence/`)
still matches 6,574 historical pre-UTE files that no UTE-G1 document or ledger pointer
cites; redacting those is a separate history-wide mechanical change and is out of this
PR's scope (see `HOST-PATH-AUDIT.md`).
