# U6 PR3 evidence — process/bash family on the governance kernel (2026-10-26)

Single-writer slice 3/6 (ARC-B part 2). Branch `task/u6-pr3-process-family-20261026`.
Protected set untouched (`control/**`, `pa-mount-registry.mjs`, `tool-admission/**`);
CORE PATCH BUDGET = 0; Host pin 0.2.0-rc.2 @ `639ed01539`.

## C1 — golden-vector parity (the stop condition)

- `digest-master.txt` / `digest-family.txt` + `golden-vectors-master.json` /
  `golden-vectors-family.json`: 299 vectors, ok=154 / err=145, IDENTICAL
  digests — `sha256:efb096a6140530d913ab2b5483d59c981843aa4b57e599fac451c93ae1d02964`.
  Family (governed bash row through the Kernel) is byte-for-byte the master
  (old center path) on every vector.
- `golden-recorder.scratch.test.ts.txt` — the recorder, preserved as
  `.txt` (scratch files must not live in the lint universe; deleted from
  `packages/runtime/test/` before commit).

## C1 — gates

- `p4t6-RED-unbooked.log` / `p4t6-GREEN.log` — the census gate: unbooked
  rows-1263 RED, booked 10 rows GREEN (10/10). Booking 1263−1253=10 = the
  new `packages/tools/process-family` + world-factory lane files.
- `lint-identities-final.txt` — 76 distinct identities, baseline delta
  new=0 resolved=0. Scratch files were MOVED OUT of the lint universe first
  (this dir preserves them as `.txt`).
- `dualgate-offline-probe.test.ts.txt` — the vitest probe proving the dual
  gate's blueprint-side inputs parse correctly: parsed blueprint carries the
  teamEnvelope `bash` token and `leaderExecEnvelopeOps → ["bash"]` + the
  leader allow-lane shell rule. (Deleted from `packages/runtime/test/`
  before commit — its finding is disclosed in the PR body.)
- `sim-u6proc-brain.mjs.txt` — the offline phase-machine simulation of the
  C2 brain router (drives the full phase ladder + wake cadence against a
  synthetic decide script; SIM OK).
- vitest: all suites green (17 PR3 tests; patched-plane 106; glue7 12;
  a5b2/a5b3 23; plants 5; bash-c1 7; u6-fs pin tests 22/22 incl. the
  offline judge fixture over `c2/u5-u6-proc-u6prc5-*.u6proc-evidence.json`);
  `pnpm -r typecheck` clean; docs gates 0 (`docs:sync --check`,
  `docs:probe --worktree-only` blocking=0).
- `root-vitest-final.txt` — the DEFINITIVE full-tree run (quiet tree):
  failing set ⊆ the PR2-recorded machine baseline
  (`t2-blueprint-hash`, `p6t3-mediation`, `p6t3-restart`, `a4p7-merge-gate`,
  `p6t6-actions`), and one baseline red (a4p7's whole-tree typecheck leg)
  turned GREEN through this PR's typecheck fixes. NO NEW REDS.
  Two full-run-only reds found and fixed en route, both disclosed:
  (1) `a5p5-dormant-audit` + `a3p3` consumer census flagged the lane's
  import of the DORMANT a5p5 lane — the design was corrected to
  ASSEMBLY-INJECTED transport (`buildBashRowDefinition(input, rowFactory)`);
  the plane's one form-pinned barrel edge stays the dormant lane's only
  consumer (form pin updated, `a5p5-dormant-audit` 9/9, `a3p3` 21/21).
  (2) `a3p3`'s consumer-set leg re-read every `.ts` of five packages once
  PER policed name (52 full walks); PR3's new files tipped it over the 5 s
  default under full-suite CPU load (`Test timed out in 5000ms`; green
  standalone at 3.6 s). Fixed with a per-run source cache (disk+comment-
  strip once per file; all regexes/teeth untouched): leg 3.6 s → 0.73 s,
  plus an explicit 30 s leg margin.

## C2 — one governed Team World (`c2/`)

- `host-starts.jsonl` — the shared budget ledger: 6 starts,
  `--max-host-starts 6` (u6-proc boots 1-5 = u6prc1..u6prc5, u6-fs re-run
  boot 6 = u6fsr1). The core-suite re-run was SKIPPED for budget and is
  disclosed in the PR body (PR3 touches no surface core exercises; PR2
  core evidence `../u6-pr2-20261025/c2r2/core-u6cr3.out` remains baseline).
- `u6proc-console-run3/4/5.log` + `logs/u5u6prc*-*` — the live drives.
  Run 4's `*.run-abort.json` records the (test-infra) watchdog kill of a
  HEALTHY host mid-drive; the watchdog lifetime was raised afterwards.
- `u5-u6-proc-u6prc5-*.u6proc-evidence.json` — the final live drive's
  evidence digest (9/9 boot time: 6 PASS / 4 FAIL under the OLD spawn-based
  verdicts — the 4 FAILs are the spawn arms that this Host baseline cannot
  reach: the shell-class ask is fingerprint-pinned to `human-admin`
  (pinned grammar a4p7-v3-cutover-acceptance:1797) with no Admin resolver
  (ADR A1-12) → born-terminal for EVERY rung, and the leader exec allow
  downgrades to that ask when the dual-gate token is absent at bind time).
- `u6proc-console-recon.log` + `run-u6proc-recon.json` — the ZERO-BOOT
  reconstruction of the final verdicts through the SHARED judge
  (`judgeU6Proc`, the same function live runs use; the evidence digest is
  its entire input; `proc:mounted` carried verbatim from the live record):
  `overall=PASS cases=9 PASS:9`. The judge's law is disclosed case-by-case
  in `tests/world-factory/README.md`.
- `run-u6proc.json` — the live-run records (all five boots).
- `u6fs-console-rerun.log` + `run-u6fs-rerun.json` +
  `u5-u6-fs-u6fsr1-*.u6fs-evidence.json` — the u6-fs re-run (boot 6):
  `overall=PASS cases=10 PASS:10`, now with the REAL marker-dir channel
  (the PR2-era missing `readdirSync` import — silently `[]` — is fixed;
  PR2's `spoofBodyMarkers: []` was blind, u6fsr1's is a genuine read;
  verdicts unchanged).
- `c2/logs/<world>/instance-port*.log` — per-world Host logs. They contain
  the per-world boot URLs including `?token=...`: these are throwaway
  per-world tokens for torn-down homes on leased ports (never :3080, never
  `~/.dsh`), matching the PR2 evidence precedent (`u6-pr2-20261025`
  records carry the same).

## Review round 1 — the C2 positive arm (named fixture) + forensics

- `host-starts-r2.jsonl` — the review-r1 boot budget (3 lines after the
  parent-authorized third boot: u6prc6 first positive-arm drive, u6prc7
  instrumented drive, u6prc8 the authorized retry on the envelope-fixed
  fixture, head `4c52cda8f`). The pre-review ledger `host-starts.jsonl`
  (6/6) is untouched.
- `u5-u6-proc-u6prc6-*.u6proc-evidence.json`, `run-u6proc-r2.json`,
  `u6proc-console-run6.log` — u6prc6: the fixture (ask-lane `asker`
  member, default:ask, no shell rule) reached the Host; its call answered
  the synchronous boundary refusal; the judge's two new approve-arm cases
  FAIL honestly (8 PASS + 2 FAIL, 12-record with mounted + leak-check).
- `u5-u6-proc-u6prc7-*.u6proc-evidence.json`, `run-u6proc-r3.json`,
  `u6proc-console-run7.log` — u6prc7: the instrumented drive. The digest
  now carries the AUTH BRIDGE'S OWN observation lines
  (`approveEvidence.forensic`), which state the live refusal cause
  verbatim: `leg-deny durable control request failed: TeamRuntime:
  operation 'request-control' (action 'request-control') is outside the
  caller's mutation envelope — the boundary fails closed`. Root cause
  (offline-confirmed at `packages/runtime/admission/envelope.ts`): a
  declared member envelope REPLACES the member's base mutation bounds —
  the fixture team's envelopes name only send-message/report-progress, so
  the member could not even OPEN an approval row. This attribution
  supersedes the earlier inference that the live refusals were the
  shell-rung walk reaching `human-admin` (that law stands at C1/offline;
  the live lanes never got that far — the judge notes carry the honest
  attribution).
- `u5-u6-proc-u6prc8-*.u6proc-evidence.json`, `run-u6proc-r4.json`,
  `u6proc-console-run8.log` — the AUTHORIZED third boot (parent budget
  3/3), head `4c52cda8f` carrying the asker-envelope fix. Result: the
  same bridge refusal, verbatim, in `approveEvidence.forensic`. Offline
  read of the full boundary law (`admission/envelope.ts:100-119`)
  explains it: the member's effective envelope is
  `blueprint.teamEnvelope.allow` NARROWED by the template entry — a
  template entry can only NARROW the team-root allow list, never widen
  it; the canary teamEnvelope.allow names
  create-member/assign-task/send-message/report-progress/resolve-control/
  `bash` but NOT `request-control`, so the asker template's added op was
  filtered at the team root. The prepared (not yet booted) fixture-data
  patch: `teamEnvelope.allow += request-control` PLUS a leader
  memberEnvelopes entry pinning the leader's OLD bounds exactly
  (including the `bash` exec token — the leader currently has no entry,
  entry-tightening skipped by design, so the entry must be added in the
  same edit to keep the leader lanes byte-identical). No product change;
  the fixture's authorization law stays closed-vocabulary and
  test-profile-only. Boot budget is 3/3 spent; per the failure
  instruction the loop stops here pending a parent decision.
- The fix is fixture DATA, not product: the `asker` template's envelope
  additionally names `request-control` (closed `ALL_MUTATION_OPS`
  vocabulary; the member role's standing right to open an approval row).
  Offline the whole remaining chain is pinned (resolver roles admit the
  human lane at `leader-approval`; guard consume-once writes the one
  consumption row; replay reuses the decided row and the spent
  consumption denies with zero second spawn — a4p7/A5 + a5-m1-auth-bridge
  A1/A4 shapes).
- `run-u6proc-r3` reconstruct (`cases=11 FAIL:2 PASS:9`) verified the
  shared judge's zero-boot path over the new evidence.

## Review round 1 (continued) — boot 4 (u6prc9): the ask row is REAL; the observer was looking at the wrong root

- `u5-u6-proc-u6prc9-*.u6proc-evidence.json`, `run-u6proc-r5.json`,
  `u6proc-console-run9.log`, `logs/u5u6prc9-*` — the parent-authorized
  boot 4 (ledger 4/4) on head `822da6379` (teamEnvelope names
  `request-control` + leader pin entry + poller `tool=bash` regex; all
  offline pins green first). Verdicts: 9 PASS, 3 FAIL
  (`proc:approve-spawn-once`, `proc:approve-replay-refused`, and — newly
  flipped — `proc:exec-door-fail-closed`).
- What PROVED the positive mechanism is real: the bridge observed
  `request-created` (fires only after `requestControl` returned a
  persisted row — pa-control-bridge.ts:424) and `notifTurns` jumped 0→21
  (row-creation notifications reached the leader). A REAL durable ask row
  for the governed bash call existed on the real ask path. The asker lane
  stayed blocked on it (`laneDone.appr=false`) — pending, unsettled,
  exactly the product's synchronous-wait law.
- Mechanism 1 (test wiring, decisive): the Host log names the real team
  session `session-u6proc-team-<line>`, while every control observation
  (`/__p6t6/state` → `control` via the boot-root-mounted p6t6 row) and
  every `team.resolveControl` call used `session-u6proc-root-<line>` (the
  CREATE blueprint's boot-root session). The runner observed, resolved and
  counted against the WRONG root in ALL FOUR boots — which is also why the
  pre-boot4 runs' 'zero rows ever existed' reading was over-claimed: rows
  the boot-root session never held could still exist on the real team
  session. The fixture's remaining distance to green is runner seam
  targeting, not governance semantics.
- Mechanism 2 (product law, data-approach blocker): the leader caller
  resolves from the team-root identity WITHOUT a callerMember
  (`admission/resolve.ts:246-267`; the leader is not a member instance —
  invariants 14/15), and `callerEnvelope`'s leader-entry tightening
  requires one (`admission/envelope.ts:113-115`). A blueprint
  memberEnvelopes entry therefore CANNOT narrow the leader lane: naming
  `request-control` at the team root necessarily arms the leader ask lane
  too (the late lane then blocked on its own user-approval row, and the
  exec-door attempt pairing shifted onto the native lane's bash output —
  the measured flip above). A lane-scoped ask-row grant is NOT
  representable in blueprint data; it needs either a product-side
  lane-scoped grant (forbidden this round) or re-shaped leader lanes
  (which breaks 'other 9 unchanged'). The offline law pin of this boot
  had itself synthesized a leader caller shape the runtime never produces
  — caught by the boot, disclosed here.
- Branch state: the boot-4 fixture data was REVERTED (`7861fb307`) so the
  branch returns to the u6prc8-measured fail-closed posture; the honest
  judge fixtures now cover u6prc6..u6prc9 (u6prc9 pinned to FAIL on
  exactly the three cases above, with `request-created` + notifTurns>0 +
  `laneDone.appr=false` asserted from the digest). Boot budget 4/4 spent;
  per instruction the loop STOPS here. The positive-effect leg lands as
  the named U7 item (runner seam targeting the real team root + a
  lane-scoped grant design).

## Hygiene

No secrets, no live-instance material (:3080 / `~/.dsh` never touched);
absolute paths are workspace-local world dirs (test infra, disclosed);
per-world tokens as disclosed above. Test homes `tests/homes/u5u6prc*`,
`tests/homes/u5u6fsr1` were removed after teardown (ownership receipts
checked; all owned PIDs dead — `fs:leak-check` PASS).
