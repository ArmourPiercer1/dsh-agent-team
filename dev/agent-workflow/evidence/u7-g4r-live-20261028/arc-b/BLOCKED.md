# ARC-B leg — BLOCKED by the named runner's own boot-budget law (0 Host starts)

Command (verbatim from `dev/agent-workflow/evidence/u7-tbash-l4-20261027/README.md`
§"Run:" in `c2/run-c2.mjs`; no invented flags):

```
node dev/agent-workflow/evidence/u7-tbash-l4-20261027/c2/run-c2.mjs
```

Result on the frozen candidate (`run-attempt.log`, exit 1, **before any Host spawn**):

```
[u7tb-c2] FATAL Error: boot budget exhausted: 7/7 declared in /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/u7-g4r2/dev/agent-workflow/evidence/u7-tbash-l4-20261027/c2/boot-budget.jsonl
    at declareBoot (file:///…/u7-tbash-l4-20261027/c2/run-c2.mjs:72:25)
    at main (file:///…/u7-tbash-l4-20261027/c2/run-c2.mjs:143:20)
```

## Facts

- The named ARC-B harness is the merged lane's own evidence runner. Its committed
  lane ledger `dev/agent-workflow/evidence/u7-tbash-l4-20261027/c2/boot-budget.jsonl`
  already holds **7 integer boot declarations** against the runner's hardcoded
  `const BUDGET = 7` (line 37; the lane's history: budget raised 3→5→6→7 across
  its own authorized rounds). `declareBoot` therefore refuses boot #8 fail-closed
  before `world.startHost` — this is the harness's own law, executing correctly.
- The runner has no lane-independent budget seam: unlike
  `tests/world-factory/u5-canary-runner.mjs` (`--evidence`, `--budget-ledger`,
  `--max-host-starts`) and `tests/world-factory/u7-4a-jobs-suite.mjs` (same),
  `run-c2.mjs` hardcodes `BUDGET_PATH = join(HERE, 'boot-budget.jsonl')` and its
  `evidence[]` paths to the **old lane directory**, and its ledger is the merged
  lane's committed evidence. There is therefore NO way to boot ARC-B on this
  candidate from the committed harness without either (a) editing the merged
  lane's committed boot ledger or `BUDGET` constant — a harness change this lane
  is forbidden to make ("if a harness defect blocks you, STOP and report it —
  do not fix it here") — or (b) running a relocated copy whose record would cite
  the OLD lane's committed `host-boot1.log`/`mock-excerpt-boot1.json` paths
  (their existence filter passes on old-lane files while the real bytes sit
  elsewhere) — a misattributed binding this gate must never accept. Neither was
  done. No dry-run substitute is claimed either (`--dry-run` produces
  `mode:"dry-run"` judge output, never a live C2 record).
- Zero Host starts consumed by this leg: `boot-budget.jsonl` byte-identical after
  the attempt (still 7 lines, `git status` clean for that lane), no listener
  outside system ports + :3080 (`ss -ltn` after, see below), no stray
  `apps/cli|canary-runner` process.
- Side effect + cleanup (disclosed per TEST_METHODS §7): the refusal lands AFTER
  `factory.createWorld` + `world.startMock`, so the attempt created World home
  `tests/homes/u5u7tb-20261028T11-18-52Z` (ownership marker `.u5-created.json`
  present, `createdBy` pid of the just-exited runner; the mock is in-process
  `node:http`, dead with the process; no host ever booted, no boot declared, no
  token issued). The home was removed immediately after capturing this receipt,
  together with the runner's empty scratch log dir
  `.artifacts/tmp/u7-tbash-c2-world/`. `tests/homes/` is empty again; shared
  cross-worktree lease dir only ever holds reclaimable dead-pid slots (harness
  stale-reclaim protocol); the next lease acquisition reclaims per protocol.
- `:3080` untouched: the stable-instance read-only probe inside the runner ran
  BEFORE the failure (GET `/`, no token); lane-level probe 401 before
  (`../stable-3080-probe-pre.txt`) and re-checked 401 after this leg.

## Verdict for this leg (as produced, not as hoped)

ARC-B on this candidate: **NOT PROVEN — leg blocked by the named runner's
committed boot-budget state (0 starts).** This is an execution-evidence gap
(harness state), not a product defect: the boot-7 record
(`…/u7-tbash-l4-20261027/c2/c2-verdicts-boot7.json`, PASS 6/6) remains the
last live ARC-B evidence and stays HISTORICAL-ONLY (dirty tree `96dd541e`,
AFFECTED path) exactly as `G4-PROMOTION-REVIEW-R1.md` grades it. Closing ARC-B
on a frozen candidate needs a main-agent ruling that either (a) re-authorizes a
budget declaration for that lane (the precedent is that lane's own writer
raising `BUDGET` with disclosure), or (b) lands a runner change giving ARC-B a
lane-independent `--evidence/--budget-ledger` seam like the other two suites —
both OUT OF SCOPE for this lane and deliberately NOT done here.

`ss -ltn` after (only system ports + :3080):

```
```
State  Recv-Q Send-Q Local Address:Port Peer Address:PortProcess
LISTEN 0      4096         0.0.0.0:22        0.0.0.0:*
LISTEN 0      50           0.0.0.0:139       0.0.0.0:*
LISTEN 0      50           0.0.0.0:445       0.0.0.0:*
LISTEN 0      4096   127.0.0.53%lo:53        0.0.0.0:*
LISTEN 0      511        127.0.0.1:3080      0.0.0.0:*
LISTEN 0      4096      127.0.0.54:53        0.0.0.0:*
LISTEN 0      4096            [::]:22           [::]:*
LISTEN 0      50              [::]:139          [::]:*
LISTEN 0      50              [::]:445          [::]:*
```

ps -eo pid,cmd | grep -E "apps/cli|canary-runner" — empty (no stray processes). curl :3080 → 401 (unchanged).
