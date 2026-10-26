# U7-T1 — harness closure evidence (sanitized)

Task: CI-03 disk oracle (E1), blinded-twin pairing (E2), jobs Team-lane stall
(R-U6P4-2), governed-session targeting (R-U6P3-1), crash-reclaim offline
re-check (R-G3-1), live restrict/lift pair (R-U6P6-1). All verdicts are
DISK + LEDGER + HOST LOG based; nothing here cites model transcript text.

## R-G3-1 — parallel crash-reclaim `other-world-unaffected`: OFFLINE re-check of the forward fix (zero host starts, zero budget)

Source live record (prior budget, NOT recolored here):
`dev/agent-workflow/evidence/u5-fixt-20261026/live/crash-reclaim-3/run-u5-crash-2026-10-25T17-27-10-230Z.json`
— stored verdicts: `abnormal-kill-reclaim PASS`, `crash-simulation-reclaim PASS`,
`other-world-unaffected FAIL` (`aAliveWhileBCrashedAndReclaimed=false` — the
survivor finished before the kill landed; a SUPERVISOR sequencing flaw, the
forward fix is committed in `tests/world-factory/u5-parallel-supervisor.mjs`:
survivor starts only after the victim holds its in-flight call, the kill waits
for the survivor's own `U5-IN-RUN`, completion settles on RUN RECORD + dead
pid with `close` as fast path only).

Re-check method (`--reconstruct`, zero spawns; run through the CURRENT
forward-fixed code on this tree):

1. `live/run-u5-crash-recon-2026-10-26T10-40-26-338Z.json` — faithful
   re-judgement of the stored record:
   `overall FAIL` = `abnormal-kill-reclaim PASS`,
   `crash-simulation-reclaim PASS`,
   `other-world-unaffected FAIL` (`aAliveWhileBCrashedAndReclaimed=False`),
   `pristine-host-and-stable-untouched PASS`, `sibling-homes-untouched PASS`.
   The no-recolor law holds: a survivor that never straddled kill+reclaim
   stays FAIL under the fixed code — the forward fix does not launder the
   old record.
2. `live/run-u5-crash-recon-2026-10-26T10-40-32-784Z.json` — re-judgement of
   `live/crash-reclaim-3-synthetic-straddle.json` (clearly-labelled
   SYNTHESIS: the run-3 record with ONLY the missing straddle proof supplied
   — `aAliveWhileBCrashedAndReclaimed=true`, settle `via: record+dead`,
   survivor `overall PASS` — exactly what the forward-fixed sequencing
   produces): `overall PASS` = all five cases PASS,
   `other-world-unaffected PASS`.

Conclusion (offline): the case's FAIL cause is EXACTLY the sequencing proof
the forward fix now generates — every factory/protocol condition replays
green, and the sole missing boolean flips the verdict. No product change is
implicated. A CLEAN LIVE CONFIRMATION of the fixed sequence needs +2 host
starts (prior round consumed 6/6 of its cap, per
`u5-fixt-20261026/live/budget.jsonl`); the U7-T1 C2 budget spent its
crash-reclaim priority as this offline re-check, so the live confirmation
stays owner-budgeted (recorded, not silently dropped).

## C2 rounds

(append per boot: suite, line id, verdicts verbatim, budget)

### Boot 1 — u6-jobs, line `u6jobs8`, host 1 of 6 budget

`c2/u5-u6-jobs-u6jobs8-2026-10-26T10-41-34-830Z.u6jobs-evidence.json` —
`RUN-SUMMARY … overall=FAIL cases=9 FAIL:3 PASS:6`.

Verdicts verbatim: `jobs:mounted PASS`, `jobs:birth-positive FAIL`,
`jobs:ci05-governed-fail-closed PASS`, `jobs:owner-fence FAIL`,
`jobs:kill-refusal-zero-reach FAIL`, `jobs:ctl-native-untouched PASS`,
`jobs:no-second-ledger PASS`, `jobs:leak-check PASS`;
`lane completion gaps: foreign,leader`.

R-U6P4-2 — the STALL IS FIXED and proven on the disk+ledger plane:
`controlRead = {channel: "remote:team.getLedgerPage", teamSessionId:
session-u6jobs-team-u5u6jobs8-…, anchoredToBootRoot: false,
positiveReadProven: true, approverErrors: []}`; `birthRow
{seen: true, resolved: true}` with three `team.resolveControl` resolutions
all `status 200 ok true`; `jobs:no-second-ledger PASS` with
`{trioControlRows: [], controlRowsTotal: 3, observationChannelProven: true,
trioUses: 7}`; `jobs:ci05-governed-fail-closed PASS` with the refusal verbatim
`"refused: unattributed-job — the Team lane never attributed this job id; a
governed mount refuses it before any host reach (CI-05)"` (CI-05: the refusal
is the EXPECTED governed answer, required verbatim by the judge).
Leader-lane telemetry: `{requests: 46, exchanges: 11, wakes: 29,
wakeRejected: 0}` — the lane wakes and exchanges (previously: parked forever).

Remaining boundary (recorded, NOT worked around): with the ask rows born and
ALLOWED, the member's background `bash` still produces no job id because the
guard kernel refuses at dispatch, verbatim:
`"Error: team tool guard: the Tool Binding for \"bash\" cannot be verified at
dispatch time (no fallback to the native body)"`
(digest `debug.worker`). The three FAILs chain from that one refusal
(no id → no ring/claim collection, no kill subject born, foreign lane never
completes). The kernel refusing an unverifiable binding is the kernel's own
correct law (the matrix scores it as the armed-world law); making the jobs
world's `bash` lane EXECUTABLE is a product/binding-verification question
outside a tests-only closure PR — reported, not patched. The judge said FAIL
precisely because the effects never reached the disk/ring — no false green.


### Boot 2 — u6-arc-d, line `u7arc1`, host 2 of 6 budget

`c2/u5-u6-arc-d-u7arc1-2026-10-26T10-52-04-372Z.evidence.json` —
`RUN-SUMMARY … overall=FAIL cases=12 FAIL:2 PASS:10`.

Verdicts verbatim: `arcd:mounted PASS`, `arcd:positive PASS`,
`arcd:spoof-zero-authority PASS`, `arcd:swap-refused PASS`,
`arcd:unbound-refused PASS`, `arcd:replay-refused PASS`,
`arcd:ci03-native-parity FAIL`, `arcd:restrict-veto PASS`,
`arcd:lift-control FAIL`, `arcd:marker-ledger PASS`, `arcd:teardown-honest PASS`.

What the boot PROVED (E1 + R-U6P6-1 machinery live):
- the E1 direct-disk oracle caught a real false-green: the OLD ci03 arm
  (counting the claim text echoed in native tool-result bytes) had been
  PASSING while `nativeEvidence {readFromDisk:true, present:false}` — no
  disk effect had ever landed. Under E1 the case FAILs, as it must.
- the mask lane is live: durable `{leg:"govern", action:"restrict-on",
  ok:true}` and `{action:"restrict-off", ok:true}` rows;
  `laneDone {pairRestrict:true, pairLift:true}`; `arcd:restrict-veto PASS`
  (zero disk effect under the mask).

Root cause of the two FAILs (same law for both): the confined provider
refuses sandboxed writes into a NEW SUB-DIRECTORY (`notes/…`; the jobs/
u6-proc READMEs measured it and chose FLAT workspace-root children — this
boot proved arc-d hits the identical law). Both effect writers had been
placed under `notes/`, so the lift leg's write never landed
(`pairLift.present:false`) — making the earlier restrict-veto PASS possibly
FOR THE WRONG REASON (absence from a dead channel, not from the mask).
The `lift-control` FAIL is the canary that exposes it; the judge never
colored anything green.

Fix applied before the next boot (tests-only): both effect paths are FLAT
workspace-root children (`u6arcd-native-effect.txt`,
`u6arcd-pair-lift.txt`, `u6arcd-pair-denied.txt`) — the PR3/u6-proc
shape measured able to land; plus a `effectNotes` diagnostic in the digest
(host tool-settle heads for the effect calls — diagnosis only, never a
verdict basis). See `c2/u5-u6-arc-d-u7arc2-*.evidence.json` below.


### Boot 3 — u6-arc-d, line `u7arc2`, host 3 of 6 budget

`c2/u5-u6-arc-d-u7arc2-2026-10-26T11-03-55-443Z.evidence.json` —
`RUN-SUMMARY … overall=FAIL cases=12 FAIL:2 PASS:10` (same two legs:
`arcd:ci03-native-parity`, `arcd:lift-control`).

New `effectNotes` diagnostic (host tool-settle heads, capture-then-decide)
named the root cause verbatim:
`"bash: …/workspace/u6arcd-native-effect.txt: Permission denied
[Command finished with exit code 1]"` — and the SAME for the FLAT pair
path. So the confined provider refuses EVERY bash workspace write on this
pin (flat root included, `notes/` included). Reading the provider
(`packages/runtime/sandbox-provider/provider.ts` `build_ruleset` call
site): the payload's grants are the per-call `allow[]` (the governed
anchor root is READ-only here) — no writable grant exists for the
confined bash lane at all. Bash-redirect effects are structurally dead on
this pin; a pair built on them could not distinguish mask from sandbox.

### Boot 4 — u6-arc-d, line `u7arc3`, host 4 of 6 budget

`c2/u5-u6-arc-d-u7arc3-2026-10-26T11-19-26-093Z.evidence.json` —
`RUN-SUMMARY … overall=FAIL cases=12 FAIL:1 PASS:11`.

Redesign (tests-only) that got the pair live: the effect writer becomes a
plugin tool `u6arcd_pair_effect` (the plugin's own fs is the one writer
measured able to land a world file); the restrict seam masks its NAME
plus `bash`. Verdicts verbatim: `arcd:restrict-veto PASS` (govern row
`{action:"restrict-on", ok:true, detail:"restricted:bash,u6arcd_pair_effect"}`
+ deny file ABSENT + NO pair-effect row for the deny marker — zero effect
twice-verified) and `arcd:lift-control PASS` (govern row
`{action:"restrict-off", ok:true}` + pair-effect row ok + the file ON
disk with THIS run's marker, read back by the oracle). R-U6P6-1 is now a
live d_restrict_veto/d_lift_control pair on disk + ledger. Bonus
surface-level proof in the same run: the boot-root `toolNames` list LOST
`bash` exactly for the masked window (mockTail seq 29-31) and regained it
after the dispose (seq 32-33).

Remaining `arcd:ci03-native-parity FAIL` — the E1 oracle holding the
line, with the surface measured: the census-boot tool surface carries NO
builtin `write` (toolNames: bash/edit/glob/grep/read/read_image +
team_*), and confined bash has zero writable grants. The lane's remaining
native spelling is the builtin EDIT surface (host fs, not confined): the
fixture seeds ONLY a placeholder and the verdict basis is the run-unique
marker CONTENT — which only the lane's own edit can produce. Boot 5
(`u7arc4`) tests it; whichever way it lands, the disk says so honestly.

### Boot 5 — u6-arc-d, line `u7arc4`, host 5 of 6 budget

`c2/u5-u6-arc-d-u7arc4-2026-10-26T11-22-20-164Z.evidence.json` —
`RUN-SUMMARY … overall=FAIL cases=12 FAIL:1 PASS:11` (11 PASS = every leg
including the pair; the single FAIL is `arcd:ci03-native-parity`, and the
run's `effectNotes` complete the native-surface MAP that explains it):

- `grep` RUNS live on the native lane: settle `"Found 1 match …
  U6ARCD_NATIVE_CLAIM_…"` — a real execution, and (now that the fixture
  is placeholder-seeded) `nativeEvidence {present:true, contentMatches:
  false}` proves the effect CONTENT stays lane-only.
- `bash` redirect: landlock `Permission denied` (boot-3 law, reproduced).
- builtin `edit` (host fs, NOT confined): refused only by its own
  precondition — `"Error: cannot modify …u6arcd-native-effect.txt: file
  has not been read — read this file before editing"` — NOT by a
  workspace guard. A `read` step before the edit satisfies it; the
  chain is committed (C1 green) awaiting its own boot.
- mask refusal shape captured verbatim: the masked boot-root's effect
  call settles `"Error: unknown tool "u6arcd_pair_effect""` and the
  same tool EXECUTES after the dispose — d_restrict_veto/d_lift_control
  in typed refusal vs success, ledger + disk.

Final C2 accounting: 5 of 6 starts spent (jobs8, u7arc1..4); the 6th is
spent on the mandated u6-proc governed-session boot below. The committed
`read->edit` spelling therefore gets its live verdict in the next budget
round; until then `arcd:ci03-native-parity` records the honest FAIL —
which is precisely what E1 was for: the OLD claim-text arm had been
coloring this case green for every historical boot while NO native disk
effect had EVER landed.

### Boot 6 — u6-proc, line `u6prc10`, host 6 of 6 budget (budget exhausted)

`c2/u5-u6-proc-u6prc10-2026-10-26T11-25-49-464Z.u6proc-evidence.json` —
`RUN-SUMMARY … overall=FAIL cases=12 FAIL:4 PASS:8`.

R-U6P3-1 — targeting PROVEN, blocking point recorded exactly:
- GOVERNED-session targeting verified live: `controlRead
  = {channel:"remote:team.getLedgerPage", teamSessionId:
  "session-u6proc-team-u5u6prc10-20261026t11-25-49z",
  anchoredToBootRoot:false, positiveReadProven:false}` — reads are paged
  over the team.create-echoed governed session id (identity assertions
  passed; the boot anchor p6t6 block read 0/0/0 as its law says, kept
  only as `bootAnchorNote`).
- WHERE blocked (product semantics): the governed member's `team_bash`
  never produces a durable control request at all — the call is refused
  at the a5p5 admission seam BEFORE ControlService: verbatim
  `"a5p5-refused kind=refused-admission code=APPROVAL_DENIED"` (the same
  family as the jobs-world `Tool Binding … cannot be verified` law). So
  `pendingSeen:false, maskRequestId:null` and the resolve arm has no id
  to resolve: resolveControl is armed for the v4 governed-session shape
  and waits on a row that this pin's admission law never lets be born.
- THE HARNESS HELD: with `positiveReadProven:false` the judge FAILs
  `proc:member-ask-born-terminal` and `proc:replay-settled-refusal`
  (`controlChannelPositiveRead:false` in the detail) instead of certifying
  "no rows = born terminal" on an unproven channel — the exact false-green
  R-U6P3-1 exists to catch; `proc:approve-spawn-once`/
  `proc:approve-replay-refused` FAIL honestly (nothing to approve).
- The eight PASS legs stand on disk+ledger: `proc:exec-door-fail-closed`,
  `proc:deny-zero-spawn` (`denyClaimOccurrences:0`), `proc:guard-off-channel`,
  `proc:late-call-refused` (`lateFileAbsent:true`), `proc:ctl-native-untouched`,
  `proc:spoof-refusal`, `proc:mounted`, `proc:ctl-native-untouched`.

C2 round closes: 6/6 host starts, every verdict recorded verbatim.
Product-change findings needing owner lanes (NO source touched here):
(1) governed-lane native tool binding verification at dispatch (jobs +
proc admission refusals); (2) confined-provider writable-anchor policy —
the sandboxed bash has ZERO writable grants, so no CI/effect design may
ride bash workspace writes; (3) the census-boot tool surface has no
builtin `write` (edit needs read-first — committed chain awaits boot).
