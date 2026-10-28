# u7-tbash-seam-20261028 — lane-independent seam for the ARC-B governed-bash C2 runner

Lane: `tbash-seam` · branch `task/u7-tbash-seam-20261028` · base `origin/master @ 6457b9675`
Red lines honoured: NO change under `packages/**` or `scripts/**`; NO Host boot in this
lane (every command below is offline: unit tests + the runner's fixture dry-run); no
force-push; every committed evidence file ≤ 1 MiB (largest: 15,410 B).

## 1. The seam

`dev/agent-workflow/evidence/u7-tbash-l4-20261027/c2/run-c2.mjs` gained three CLI flags,
mirroring the seam the other runners already have
(`tests/world-factory/u5-canary-runner.mjs` `parseArgs`, `--evidence/--budget-ledger/--max-host-starts`):

| flag | meaning |
| --- | --- |
| `--evidence <dir>` | repo-relative (or absolute, in-repo) dir where THIS run writes host/mock logs, digests and the record |
| `--budget-ledger <jsonl>` | the boot ledger to declare against (must be in-repo, outside the closed lane) |
| `--budget <n>` | positive-integer boot budget |

Resolution lives in one pure export, `resolveRunConfig(argv)`
([run-c2.mjs:79](../u7-tbash-l4-20261027/c2/run-c2.mjs#L79)); the runner consumes it once at
[run-c2.mjs:126](../u7-tbash-l4-20261027/c2/run-c2.mjs#L126). Companion pure exports:
`parseBootLedger(text)` (:110), `assertBootBudget({declared,budget,ledgerPath})` (:115),
`evidencePathOf(cfg, file)` (:122). Laws:

- **No flags → byte-for-byte the #415 behaviour**: `BUDGET 7`,
  `BUDGET_PATH = join(HERE, 'boot-budget.jsonl')` (the committed 7/7 ledger), evidence
  prefix `dev/agent-workflow/evidence/u7-tbash-l4-20261027/c2/`, outputs beside the runner.
  Pinned by the `DEFAULT_*` exports ([run-c2.mjs:57-60](../u7-tbash-l4-20261027/c2/run-c2.mjs#L57-L60)).
- **Any one of the three without the other two is REFUSED** (`got N of 3; refusing to
  fall back to the closed lane's committed ledger`) — fail closed, the old full ledger is
  never an implicit fallback.
- **`--budget` must be a positive integer.**
- **`--evidence`/`--budget-ledger` outside the repo or inside the closed lane dir
  `dev/agent-workflow/evidence/u7-tbash-l4-20261027/` are REFUSED.**
- When `--evidence` is given, the record's `evidence:` list is derived from that dir via
  `evidencePathOf` — the old literal prefix is gone from the record path (it survives only
  as the no-flag default constant, which is what keeps #415 history byte-stable).

Untouched, as required: the judge (`judgeTbash` usage), the drive logic, the fixtures, every
verdict computation — the diff is path/budget plumbing only. The import-without-side-effect
guard (`invokedDirectly`, [run-c2.mjs:487](../u7-tbash-l4-20261027/c2/run-c2.mjs#L487)) and
`--dry-run` behaviour are preserved; a malformed flag set throws during module evaluation,
i.e. BEFORE any world/host work (`cli-refusals.log` shows exit 1 with no boot).

## 2. Why

`run-c2.mjs` hardcoded its boot ledger and evidence location, so the closed #415 lane
(PR #415, history) blocks every future ARC-B run:

- line 37-38 (old): `const BUDGET = 7`, `const BUDGET_PATH = join(HERE, 'boot-budget.jsonl')`,
  and the committed `c2/boot-budget.jsonl` already holds **7/7** boot declarations
  (plus one disclosure line) — the old `declareBoot` refuses boot 8 unconditionally;
- line 183 (old): the record's `evidence:` paths were the literal string
  `dev/agent-workflow/evidence/u7-tbash-l4-20261027/c2/…`, so a new lane could not record
  its own evidence without rewriting a closed lane's files.

No new lane can run the governed-bash (ARC-B) C2 without a seam; rewriting the closed
lane's ledger would rewrite history.

## 3. C1 RED/GREEN — `tests/world-factory/u7-tbash-seam.test.mjs`

`node --test tests/world-factory/u7-tbash-seam.test.mjs` → **5/5 pass** (`C1-GREEN.log`).
Cases: (a) no flags → resolved budget/budget-path/evidence prefix equal the #415 constants
spelled out in the test; (b) flags → given values win, every `evidencePathOf` output starts
with the given dir and never the closed lane; (c) `--evidence` without `--budget-ledger`/
`--budget` (and every other 1-of-3 / 2-of-3 combination, missing values, bad budgets) refused;
(d) paths inside the closed lane or outside the repo refused for BOTH flags; (e) a ledger
already at budget refused before the next boot — including the committed closed-lane ledger
parsed as-is (`7/7 → throw`).

**Mutation → RED** (`C1-MUTATION-RED.log`): with the no-flag default ledger changed to
`boot-budget-elsewhere.jsonl`, the run is `tests 5 / pass 4 / fail 1`
(`actual: …/boot-budget-elsewhere.jsonl, expected: …/boot-budget.jsonl`); restoring the
constant returns `5/5 pass` (re-verified after restore, exit 0).

Full u7 offline trio green with the seam:
`node --test tests/world-factory/u7-tbash.test.mjs tests/world-factory/u7-tbash-seam.test.mjs tests/world-factory/u7-tbash-offline-drive.test.mjs`
→ `tests 14 / pass 14 / fail 0`. `node --test tests/world-factory/world-factory.test.mjs`
→ `tests 43 / pass 43 / fail 0`.

## 4. The default is unchanged (dry-run, offline, zero boots)

Lane README §4.9 command, run in THIS worktree with **no seam flags**:

```
node dev/agent-workflow/evidence/u7-tbash-l4-20261027/c2/run-c2.mjs --dry-run \
  --fixtures dev/agent-workflow/evidence/u7-tbash-l4-20261027/c2/dry-run-fixtures.json
```

- GREEN: exit 0, `"overall": "PASS"` (`dry-run-GREEN.log`); byte-diff vs the committed
  `c2/dry-run-GREEN.json` is exactly ONE line — the `fixture` absolute path, which is
  `resolve(fixturePath)` (pre-existing behaviour; the committed copy records the OLD
  worktree's absolute path `.worktrees/u7-tbash/…`, this run is in `.worktrees/u7-tbseam/…`).
  See `dry-run-GREEN-vs-committed.diff`.
- Mutation RED: `U7TB_DRY_RUN_MUTATE=1` → exit 0 with `"mutation": true`, `"overall": "FAIL"`
  (`dry-run-RED.log`); same single-line fixture-path-only diff (`dry-run-RED-vs-committed.diff`).
- The closed lane's `dry-run-GREEN.json` / `dry-run-RED.json` were restored byte-identical
  via `git checkout --` after the runs; `git status` in `c2/` shows only `run-c2.mjs` modified.

**Seam equivalence proof** (`dry-run-SEAM-GREEN.log`, `arc-b/dry-run-GREEN.json`): the same
dry-run through the seam writes ONLY into `--evidence` (closed lane untouched — `git status`
verified) and its record is BYTE-IDENTICAL to the committed GREEN record (fixture path
normalized), so the seam moves paths without moving semantics.

CLI refusals (`cli-refusals.log`, all exit 1, no boot): 1-of-3 flags, 2-of-3 flags,
`--evidence` inside the closed lane, `--budget-ledger` inside the closed lane, `--evidence`
outside the repo.

## 5. The exact command a NEW lane must use

```
node dev/agent-workflow/evidence/u7-tbash-l4-20261027/c2/run-c2.mjs \
  --evidence dev/agent-workflow/evidence/<new-lane>/arc-b \
  --budget-ledger dev/agent-workflow/evidence/<new-lane>/arc-b/boot-budget.jsonl \
  --budget 1
```

All three flags, always together; `<new-lane>` must not be `u7-tbash-l4-20261027` (refused).

## 6. Changed files (quoted gate output)

`git diff --name-only origin/master...HEAD` (after commit — paste verified below):

```
dev/agent-workflow/evidence/u7-tbash-l4-20261027/c2/run-c2.mjs
dev/agent-workflow/evidence/u7-tbash-seam-20261028/C1-GREEN.log
dev/agent-workflow/evidence/u7-tbash-seam-20261028/C1-MUTATION-RED.log
dev/agent-workflow/evidence/u7-tbash-seam-20261028/README.md
dev/agent-workflow/evidence/u7-tbash-seam-20261028/arc-b/dry-run-GREEN.json
dev/agent-workflow/evidence/u7-tbash-seam-20261028/cli-refusals.log
dev/agent-workflow/evidence/u7-tbash-seam-20261028/dry-run-GREEN-vs-committed.diff
dev/agent-workflow/evidence/u7-tbash-seam-20261028/dry-run-GREEN.log
dev/agent-workflow/evidence/u7-tbash-seam-20261028/dry-run-RED-vs-committed.diff
dev/agent-workflow/evidence/u7-tbash-seam-20261028/dry-run-RED.log
dev/agent-workflow/evidence/u7-tbash-seam-20261028/dry-run-SEAM-GREEN.log
dev/agent-workflow/evidence/u7-tbash-seam-20261028/fixture-next-lane/arc-b/boot-budget.jsonl
tests/world-factory/u7-tbash-seam.test.mjs
```

NOTHING under `packages/` or `scripts/` — quoted list contains no such path.
(run-c2.mjs diff: +106/−13, path/budget plumbing only.)

**CI round 1 (honest record).** `docs:probe --base` went RED on the first head with two
`CITED_PATH_MISSING` findings: `tests/world-factory` is a cited-paths root
(`scripts/doc-checks.mjs` `CITED_PATH_ROOTS`), and the test's fictional fixture
`dev/agent-workflow/evidence/u7-next-lane/arc-b(/boot-budget.jsonl)` existed nowhere.
Fixed the lane, not the rule: the fixtures now cite a COMMITTED zero-entry ledger
`fixture-next-lane/arc-b/boot-budget.jsonl` (= the exact state a new lane starts in), and
test (e) additionally parses that committed ledger (`parse → 0 → boot 1 allowed`).
`docs:probe --base origin/master` → blocking=0; seam test still 5/5.

## 7. Gates

- `node --test tests/world-factory/u7-tbash.test.mjs tests/world-factory/u7-tbash-seam.test.mjs` + offline-drive: **14/14 pass**; `world-factory.test.mjs`: **43/43 pass**.
- `node scripts/eb3-run-manifest.mjs --new-since origin/master`: **findings=0** (the new
  `arc-b/dry-run-GREEN.json` carries no `u5-run-record` schema, so the manifest does not
  grade it; committed records unaffected — the runner never rewrites #415 records).
- `git diff --check origin/master...HEAD`: clean (see PR evidence note).
- p4t6 booking: NOT required, MEASURED — `scanSessionEventVocabulary(cwd)` counts 1389
  files, **all** under `packages/**`, **0** under `tests/world-factory/` (scanner scope
  comment "EVERY .ts/.mts/.mjs file under `packages/**`",
  `packages/testkit/fault-injection/session-event-scan.mjs:39`). This lane adds no path
  under `packages/**`; it edits no booking JSON.
- `node scripts/ci-pr-gate.mjs --store-dir .tmp-pnpm-store`: see PR comment / result below.

## 8. File index

| file | content |
| --- | --- |
| `C1-GREEN.log` | seam test 5/5 on the real code |
| `C1-MUTATION-RED.log` | mutation (default ledger elsewhere) → fail 1 |
| `dry-run-GREEN.log` / `dry-run-RED.log` | default no-flag dry-run, PASS / mutation FAIL |
| `dry-run-GREEN-vs-committed.diff` / `dry-run-RED-vs-committed.diff` | the ONLY diff is the recorded absolute `fixture` path |
| `dry-run-SEAM-GREEN.log`, `arc-b/dry-run-GREEN.json` | seam-routed dry-run: lands in `--evidence`, byte-identical verdicts |
| `cli-refusals.log` | five fail-closed CLI refusals, exit 1, zero boot |
| `R1-RED.log` | review round 1: legs (f)–(i) RED before implementation + pre-fix ELF-trap crash |
| `R1-GREEN.log` | review round 1: seam 9/9, trio 18/18, invariants re-confirmed |
| `R1-MUTATION-RED.log` | five mutants (one per fix), each killed by its leg; restored GREEN |
| `fixture-next-lane/arc-b/boot-budget.jsonl`, `arc-b/boot-budget.jsonl` | committed zero-entry ledgers the tests cite |

## 9. Review round 1 (2026-10-28) — verdict **补充内容**, F1–F4 closed

The independent review of PR #428 returned 补充内容 (supplement): the seam was correct as plumbing but
left authority with code review instead of code. Four findings were fixed on this branch; the no-flag
#415 default stayed byte-for-byte (leg (a) green; no-flag dry-run rerun differs from the committed
record only in the pre-existing absolute `fixture` line — `R1-GREEN.log`).

| finding | defect | fix (seam plumbing in `run-c2.mjs` only) | closing test |
| --- | --- | --- | --- |
| **F1 (HIGH, governance)** | `--budget` unbounded + self-declared: empty ledger + `--budget 999` authorised arbitrarily many Host boots | flagged `--budget` capped at the committed `MAX_FLAGGED_BUDGET = 3` (this lane's history is 1 boot per acceptance run; 3 = acceptance + 2 declared retries) with a typed refusal; the ONLY override is the named env `U7TB_BUDGET_OVERRIDE_REASON="<short reason ≤200 chars>"`, and when used the marker `{budget, cap, env, reason}` is stamped into the boot-ledger entry AND the produced record (`bootBudgetOverride`) — an over-budget run is impossible to hide. No-flag default budget stays exactly 7. | seam leg **(f)**; mutant M1 (cap disabled) → (f) RED |
| **F2 (MEDIUM)** | `--budget-ledger` accepted any in-repo path outside the closed lane → a lane could exhaust or inherit ANOTHER lane's ledger | the ledger must live inside `--evidence` or share its lane root (`dev/agent-workflow/evidence/<lane>`; outside the evidence tree: the same parent dir), typed refusal otherwise | seam leg **(g)** (foreign committed ledger refused, same-lane sibling accepted); mutant M2 (check disabled) → (g) RED |
| **F3 (MEDIUM)** | record cited `<own dir names> ∩ existsSync` while boot numbering restarts at 1 → files left by an earlier run in a reused dir could be cited as this run's | flagged mode stamps the run's id into every output name (`boot<N>-<runId>`); the record's evidence list is built ONLY from files this run wrote successfully (no dir scan); a flagged run REFUSES a non-empty `--evidence` dir unless `--allow-reused-dir` is passed. No-flag names stay `boot<N>` byte-for-byte. | seam leg **(h)** incl. real-process spawn (refusal writes nothing; opt-in writes); mutants M3a (stamp removed) / M3b (fresh-dir refusal removed) → (h) RED |
| **F4 (LOW)** | `process.argv[indexOf('--fixtures')+1]` yielded `argv[0]` (the node ELF binary) when the flag was absent — the guard never fired and the run died in `JSON.parse` on ELF bytes | `resolveFixturesArg(argv)` reads the flag by name: missing flag or flag-without-value fails closed with a message naming `--fixtures` | seam leg **(i)** incl. the real process (pre-fix crash in `R1-RED.log`, post-fix message in `R1-GREEN.log`); mutant M4 (trap restored) → (i) RED |

RED before implementing: `R1-RED.log` (legs (f)–(i) fail, legs (a)–(e) stay green, pre-fix ELF crash).
GREEN after: `R1-GREEN.log` (seam 9/9; u7 offline trio 18/18; no-flag defaults and closed-lane artefacts
byte-unchanged). Mutations: `R1-MUTATION-RED.log` (M1/M2/M3a/M3b/M4 each turn exactly their leg RED;
restored 9/9; `git status` afterwards shows only the intended changes).

**Disclosed limitations (recorded, not coded around):**

1. `declareBoot` is an **unlocked check-then-write** (assert-then-append): two concurrent runs sharing
   one ledger could double-spend a boot slot. This repo's single-writer law (1 task = 1 branch =
   1 worktree = 1 writer, `docs/ROUTER_RULES.md`) is what covers it; the limitation is noted at the
   function ([run-c2.mjs declareBoot](../u7-tbash-l4-20261027/c2/run-c2.mjs)), no lock is taken.
2. `--dry-run` writes `dry-run-*.json` into the evidence dir while consuming **no boot** (no ledger
   entry). The artefact itself carries `mode: "dry-run"` — **never mistake a dry-run artefact for
   boot evidence**: it only proves the offline judge passes on fixtures.

New test-cited fixtures committed in this lane (docs:probe cited-paths law): `arc-b/boot-budget.jsonl`
(zero-entry, same-lane-root sibling for the F2 acceptance case).

§1's law list is superseded where narrower: the seam header comment in
[run-c2.mjs](../u7-tbash-l4-20261027/c2/run-c2.mjs) is the law text (F1 cap + override law,
F2 same-lane rule, F3 own-bytes rule, F4 named-flag rule).
