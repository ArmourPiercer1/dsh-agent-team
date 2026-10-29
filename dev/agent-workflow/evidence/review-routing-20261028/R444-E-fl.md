# R444-E — PR #444 data-plane mechanical audit (u7-tool-acceptance CASE relabel)

- **Seat disclosure**: emergency quota-substitution seat, model `qiyuan-self/qwen3.8-flash-next`, fresh session. Independent mechanical audit; judge logic is reviewed by a separate pair — this report covers the **data plane only**.
- **Branch**: `origin/task/u7r1-acceptance-levels-20261029` vs `origin/master`. Repo: `/srv/workspace/dsh-plugins/dsh-agent-team`. Git operations READ-ONLY; the only file written is this report.
- **Method**: raw-JSON recount via `node -e`, programmatic row/level/status diff, consumer grep + line inspection, census `--check`, evidence-dir diff-stat.

## 1. Recount of run-u7fa5 citations + programmatic diff — PASS

Raw-JSON recount (`node -e` over `git show`, no hand-reading), base `origin/master` @ `2b7729e5e9`:

- **BASE hits = 8**, **BRANCH hits = 8**, identical sets: `subagent`, `subagent_fork`, `send_message`, `interrupt_agent`, `list_agents`, `list_subagent_models`, `workflow` at `@L2-mounted` (7) + `interrupt_agent@L3-refusal` (1). Matches the expected 7+1 exactly.
- Programmatic diff over **all 31 rows × 4 levels** (parse both, compare every row/level/status, print only differences): `DIFF total=8, outside-8=0`, `L4touched=0`, `rows A/B=31/31` (no rows added/removed). The only 8 differences are exactly the 8 hit cells.
- On each of the 8: `status` stays **PROVEN**; exactly the 4 keys `proof, runOverall, failedScope, caseIndependence` are added. Byte-comparison of the pre-existing content with the 4 new keys deleted: **identical on all 8** (evidence pointers, statuses untouched). No L4 cell, no L1 cell, no DISCLOSED row, no other level moved.

## 2. Disclosure values vs backing record run-u7fa5.json — PASS

Record `dev/agent-workflow/evidence/u7-f-agentA-20261026/c2/run-u7fa5.json` (read raw):

- `overall = REFUSED` ✓; `bindings.teamSha` prefix `0ea0848acd22` ✓ (the "old teamSha").
- Case verdicts: `ac:mounted=PASS  ac:enumerate-governed=REFUSED  ac:spawn-failclosed=REFUSED  ac:interrupt-foreign-zero=PASS  ac:leak-check=PASS  stable-instance-unchanged=PASS` — the relabeled rows' cited PASS cases (`ac:mounted` ×7, `ac:interrupt-foreign-zero` ×1) sit inside an overall-REFUSED run whose REFUSED cases are exactly the two named in `failedScope`.
- All 8 relabeled rows: `proof='CASE'` and `runOverall='REFUSED'` → **true on all 8**.
- `failedScope` is an array (not string): `["ac:enumerate-governed","ac:spawn-failclosed","old teamSha 0ea0848acd"]`, identical on all 8 (uniq=1) and on all 8 it names **ac:enumerate-governed + ac:spawn-failclosed + old teamSha 0ea0848acd** → check true.
- `caseIndependence` is non-boilerplate and differs **per case**: distinct=2 across the 8 rows = 1 text for the 7 `ac:mounted` rows, a different text for the `ac:interrupt-foreign-zero` row. Two quotes (truncated):
  - L2 rows: "ac:mounted PASS asserts the tool's own row on the live placement feed (placementFeed names it, placementHas7=true, pilotCarriedFam…"
  - L3 row: "ac:interrupt-foreign-zero PASS asserts its own typed structural refusal with zero reach (controlRowsForInterrupt=0, ranWitnesses=0…"

## 3. Consumers & strict-iteration check (+ census, packages/testkit) — PASS

`git grep -l "u7-tool-acceptance"` (tracked tree; plain recursive grep skipped — it stalls on the huge gitignored `tests/homes`/`.worktrees` trees, not a ledger issue) → **12 files**, no others hidden behind the tail:

| Consumer | Kind | Breaks on new fields? |
| --- | --- | --- |
| `scripts/eb3-tool-acceptance.mjs` | the only real JSON parser/validator of the ledger | **No.** Validates named fields (schema/status/level/evidence); no unknown-key rejection anywhere (only `Object.keys` loop is over the names map at line 189). Master version doesn't know `proof` and would flag `ACCEPT_PROVEN_NOT_PASS_OVERALL` — which is exactly why the **same branch** ships the CASE opt-in: branch checker validates `proof:'CASE'` requires verbatim `runOverall` + `failedScope` (list) + non-empty `caseIndependence` (branch lines 398–399) and admits otherwise-non-PASS records only through that gate (line 406). Checker + `eb3-tool-acceptance.test.mjs` are both in the branch file set (branch diff = ledger + checker + checker test only). |
| `scripts/eb3-ci-negative-controls.mjs` | comment reference only (mutations staged on an in-memory copy of the ledger) | No — no JSON key iteration over this ledger. |
| `dev/ci/eb3-ci-manifest.json` / `dev/ci/eb3-impact-graph.json` | path/string references | No — path refs, field-shape agnostic. |
| 6 × `dev/agent-workflow/evidence/u7-*/README.md`/`pr-body.md`, `docs/PARALLEL-INTEGRATION.md` | prose | No. |
| `dev/agent-workflow/ledgers/u7-tool-acceptance.json` | the file itself | — |

- Census path: `node dev/engineering/tool-obligations/build-expected-tool-obligations.mjs --check` (run on master working tree) → **`CHECK OK — committed artifacts are the byte-exact replay of the generator`**. The census builder contains **no reference** to this ledger at all (grep for `u7-tool-acceptance`/`ledgers/` empty) — census is independent of this change.
- `grep -rn "u7-tool-acceptance" packages/testkit` → **no matches**; nothing under `packages/testkit` reads this ledger.

## 4. Evidence directory untouched in branch diff — PASS

`git diff --stat origin/master...origin/task/u7r1-acceptance-levels-20261029 -- dev/agent-workflow/evidence/` → **empty output** (zero changes under `dev/agent-workflow/evidence/`). Whole branch file set is exactly 3 files: the ledger, `scripts/eb3-tool-acceptance.mjs`, `scripts/eb3-tool-acceptance.test.mjs`. The backing record `run-u7fa5.json` is cited, not rewritten.

## Verdict (data plane)

**通过** — for the data plane. The 8 run-u7fa5 citations are exactly as expected (7× L2-mounted + 1× L3-refusal); the programmatic diff shows those 8 cells are the ONLY changes (31 rows × 4 levels, statuses and evidence byte-identical, zero L4/other touches); every relabeled cell carries `proof:'CASE'`, `runOverall='REFUSED'`, a `failedScope` naming `ac:enumerate-governed` + `ac:spawn-failclosed` + old teamSha `0ea0848acd`, and per-case non-boilerplate `caseIndependence` — all matching the raw record (overall=REFUSED, teamSha `0ea0848acd22`, the two REFUSED cases as named, cited PASS cases genuinely PASS). No consumer breaks; census CHECK OK; testkit clean; evidence tree untouched. Judge-logic semantics remain with the separate reviewing pair.
