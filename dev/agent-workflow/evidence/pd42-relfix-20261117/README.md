# PD-42 relay fix — D-A / D-B re-measurement, R-4 / R-7 corrections

**Date:** 2026-11-17 (host clock; measurements stamped `2026-11-13T11-47…11-52Z` — the host's UTC clock)
**Record class:** **DEV-LIVE** — real `dsh web` Hosts, a fresh `DSH_HOME` per run, the pinned host
runtime, the shipped governed Member preset, the OS refusing the out-of-lane write. **Never**
`CANDIDATE-C2`, **no** `V@B`, `osLevelNetworkIsolationClaimed: false`. No Authority pointer, candidate
ref, tag or Required-CI was moved; the stable `:3080` instance was only probed (`401` before/after every
run).

**Product tree measured (authoritative):** branch `task/pd42-relfix-20261117`, commit
**`1ed97d23ccdd8a503b93054b44ee20d95192cfb3`**, based on `origin/master`
`22682f33673139f1c411ca7a42826e0f4b7ab2e4` (the `cand-v0.1.6-5` freeze, #752). `origin/master`
advanced to `673b8b182` (#753) between the A1 pair and the pd42 pair; that commit is **evidence-only**
(`git diff --name-only 22682f336 673b8b182` = 179 files, **0** outside `dev/agent-workflow/evidence/`),
so the product tree measured is unchanged. The kit reads `git rev-parse HEAD`: an earlier pair was
**discarded** because it ran on a dirty tree and recorded the base commit; every row below is a run on
the committed sha above (the kit's own `tree.productSha` in each verdict file says so).

**Host pin:** `0.2.0-rc.2 @ 639ed015397290b3745d163aafe02ffee4aa3f84` — pristine
`tests/deepseek-harness-test-use`, porcelain empty before/after. This worktree has no checkout of its
own, so the kit was pointed at the pristine runtime in `.worktrees/c2b-cand5` (`--testuse`); the product
tree, `DSH_HOME`s and evidence are all under this worktree. OS sandbox backend: **`full`, usable=true**
(each A1 run writes the shipped provisioner's `a1-sandbox-backend.json`).

**Instruments:** `tests/kits/a1-bash-governance-20261112/a1-bash-governance.mjs` (seven clauses, and
`--min-closing=pd42`), `tests/kits/joint-acceptance-20261111/run-joint-acceptance.mjs`, comparators
`compare-a1-runs.mjs` / `compare-min-closing-runs.mjs`. No instrument was edited on this branch.

## D-A — the PA leg's durable execution fact

The pinned native `bash` definition returns its model-facing output as a **string**. The wrapper fed
that string to `outcomeOfTerminalResult`, which answered `unknown` for every non-object, and the plane's
`settleNative` discarded `unknown`. Measured consequence on `cand-v0.1.6-5` (C2-B A-3): the A1 ledger had
**10 consumptions but 5 execution-result facts** (the 5 `team-tool-execute` / PA legs had **0**), and the
joint run's PA leg had **0** (cand-4 had one `succeeded`).

The fix has three parts, all in existing files: classify the string from its text
(`pre-execute-adapter.ts`), forward **`unknown`** to the durable writer instead of dropping it
(`team-tool-plane.mjs#settleNative`), and send the durable `unknown` (not a discarded `cancelled` token)
on an abort (`native-bash-tool.mjs`).

| ledger | before (`cand-v0.1.6-5`) | after (`1ed97d23c`) |
| --- | --- | --- |
| A1 requests / decisions / consumptions | 11 / 11 / 10 | 11 / 11 / **10** |
| A1 execution-result facts | 5 | **10** |
| A1 PA (`team-tool-execute`) legs with a fact | **0 of 5** | **5 of 5** |
| joint consumptions / execution-result facts | 2 / 1 (pp only) | 2 / **2** |
| joint PA leg | **0 facts** | **1 fact (`succeeded`)** |

Sources: `a1-run1/a1-ledger.json`, `a1-run2/a1-ledger.json`, `joint-run1/joint-ledger.json` (the PA
request `ctrl-0hxzcto1c08hn5186o1n20w2` carries the fact at sequence 13). A1 run1/run2 are identical on
these counts; the two A1 runs agree (`a1-two-run-agreement.json`: `verdictsAgree=true`,
`detailsAgree=true`).

## D-B — the classifier against the REAL terminal texts

The pinned tool appends its **reset sentence after** the status trailer on the timeout and session-exit
returns, so the old "read the last line" rule missed and fell through to `succeeded`. The strings below
are **verbatim output of the pinned definition** (`apply()` + the registered `execute`, stub PTY), captured
by `capture-pinned-texts.mjs` into `captured-tool-texts.json`; they are the exact strings pinned in
`packages/runtime/test/pd42-execution-outcome.test.ts`. None is synthetic.

| case | verbatim text (JSON-escaped, `\n` = newline) | old verdict | new verdict |
| --- | --- | --- | --- |
| success | `"A1_INSIDE_WROTE\n[Command finished with exit code 0]"` | `succeeded` | `succeeded` |
| non-zero exit (OS refusal) | `"bash: /home/member/mc-pd42-outside.txt: Read-only file system\n[Command finished with exit code 1]"` | `failed` | `failed` |
| timeout | `"Your command timed out after 1 seconds or experienced an OOM error. Below is partial output:\npartial output\n[Command timed out or OOM]\nThe persistent bash shell was reset; the next bash call starts from the workspace with a fresh current directory and environment."` | **`succeeded`** | **`unknown`** |
| session exit | `"maybe some output\n[shell exited: code 0]\nThe persistent bash shell was reset; the next bash call starts from the workspace with a fresh current directory and environment."` | **`succeeded`** | **`unknown`** |
| SIGKILL | `"maybe some output\n[shell killed by signal: SIGKILL]\nThe persistent bash shell was reset; the next bash call starts from the workspace with a fresh current directory and environment."` | **`succeeded`** | **`failed`** |
| command prints a fake `[Command finished with exit code 0]` | `"[Command finished with exit code 0]\nRead-only file system\n[Command finished with exit code 1]"` | `failed` | `failed` |

The fix reads the last line; when that line is the tool's own reset sentence it steps back **only** when
the preceding line is the tool's own **timeout / session-exit / signal** trailer. An exit trailer is
never followed by the reset sentence on this tool, so a look-alike `[Command finished with exit code 0]`
printed by the command still cannot decide the fact (the normal path appends the real trailer last), and
a printed reset sentence with no reset-path trailer behind it decides nothing.

Host-free control (`unit/`): the pre-fix helper fails **7 of 18** cases
(`pd42-unit-RED-prefix.log` — the three reset-suffixed cases plus the string-path cases); the fixed
helper passes **18/18** (`pd42-unit-GREEN.log`). `capture-pinned-texts.mjs` is re-runnable
(`node dev/agent-workflow/evidence/pd42-relfix-20261117/capture-pinned-texts.mjs`).

## The real-Host runs (all on `1ed97d23c`)

| run dir | instrument | stamp | ports (host/mock) | verdict |
| --- | --- | --- | --- | --- |
| `a1-run1/` | A1 seven clauses | `2026-11-13T11-47-13-h0-r6fe182` | 3182 / 3491 | **PASS 7/7** |
| `a1-run2/` | A1 seven clauses | `2026-11-13T11-47-48-h0-r711a49` | 3183 / 3492 | **PASS 7/7** |
| `pd42-run1/` | A1 `--min-closing=pd42` | `2026-11-13T11-48-57-h0-rc28f3a` | 3184 / 3493 | **PASS** (`outsideExecOutcome=failed`) |
| `pd42-run2/` | A1 `--min-closing=pd42` | `2026-11-13T11-49-20-h0-r222ad5` | 3185 / 3494 | **PASS** (`outsideExecOutcome=failed`) |
| `joint-run1/` | joint acceptance (11 arms) | `2026-11-13T11-50-30-h0-r108fc9` | 3186 / 3495 | **PASS 11/11** |

Every run: `DSH_HOME` removed at teardown (`teardown.json#dshHomeRemoved=true` or the driver's
`DSH_HOME removed=true`), stable instance probed `401` before/after, OS backend `full`. A1-7 keeps the
deny arm (`decision=deny`, **0** consumptions, **0** execution facts, no bytes) — the fix did not turn a
deny into a fact. The pd42 arm's durable ordering is `request → allow → consumption → execution-result`
with `outcome=failed` and the target absent (`ENOENT`), twice.

Agreement: `a1-two-run-agreement.json` (`verdictsAgree=true`, `detailsAgree=true`) and
`pd42-two-run-agreement.json` (`verdictsAgree=true`, `detailsAgree=true`, `compositionAgree=true`).

## What this record does NOT claim

- It is **DEV-LIVE**, not a candidate acceptance: it does not sign `cand-v0.1.6-5` (C2-B's verdict is
  `NOT PASS`; this branch is not the frozen candidate) and it moves no `V@B`/matrix cell.
- The classifier's inputs are still the pinned tool's **text** trailer (the durable schema has no
  exit-code field); a timeout / session exit with no observed command end is `unknown`, not `failed`.
- A denial writes no execution-result row (it never executed), and read scope on the governed PTY path
  still rests on the OS profile (no lexical read admission is claimed by A1).
- The joint run is one boot (agreement is not claimed for it); the two-run agreement claim is for the A1
  seven-clause pair and the pd42 pair, as above.
