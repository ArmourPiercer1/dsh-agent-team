# FIX-T T2 live crash-reclaim runs (shared budget ledger: budget.jsonl, cap 6)

- crash-reclaim-attempt1-failclosed/ — first live run. The in-flight trio and
  ALL reclaim/leak conditions passed (kill landed mid-tool, both stale leases
  reclaimed with provenance naming the killed runner, ports idle, home deleted
  via marker, zero refusals); the case FAILed on one over-strict conjunction
  (`hostKilledByReclaimWithProcProof`) that demanded reclaim itself kill the
  orphan host — the group SIGKILL legitimately reaps runner+host+mock
  together, so reclaim correctly found them dead. Fail-closed cascade marked
  the dependent cases FAIL (survivor runner A itself finished 7/7 PASS in
  parallel, see its -A.json). Verdict algebra proven: FAIL cannot be recolored.
- crash-reclaim-attempt1-reconstruct/ — `--reconstruct` re-judgement of that
  record with ZERO host spawns (0 budget cost), honest FAIL reproduced.
- protocol fix: conditions became hostKillPathResolved (group-kill OR
  proof-gated reclaim kill) + reclaimKillsOnlyRecordedPids +
  zeroProcessesClaimVictimHome (post-reclaim /proc scan: no live process
  anywhere still claims the destroyed DSH_HOME).
- crash-reclaim-2/ — second live run. abnormal-kill conditions nearly all
  green, but `hostLeaseProvenanceNamesKilledRunner` was false: the SURVIVOR's
  own boot legitimately swept the victim's dead host claim 1s BEFORE the
  reclaim scan ran (proof survives as reclaimedFrom inside the peer's fresh
  claim — see 3180 seq log decode during triage). Protocol-correct behavior,
  wrong-condition RED. Forward fix: provenance accepted from reclaim receipt
  OR live-peer sweep (snapshot taken immediately at reclaim). Fail-closed
  cascade again marked dependents FAIL (survivor runner A itself was mid-suite).
- crash-reclaim-3/ — third live run with both condition fixes.
  abnormal-kill-reclaim = PASS with the FULL conjunction: kill landed in
  flight (pre marker, no post, no victim record), host+mock leases reclaimed
  with provenance naming the killed runner (path: reclaim-scan), host dead,
  zero refusals, home deleted via marker, ports idle, ZERO live processes
  anywhere claiming the destroyed home. crash-simulation-reclaim = PASS
  (real orphan process killed through the /proc-environ proof gate).
  other-world-unaffected = FAIL: supervisor sequencing flaw (NOT a factory
  defect) — the survivor started concurrently and finished its ~5s suite
  before the kill landed, so 'alive at reclaim' could not be proven; plus the
  child 'close' event lagged the exited runner (kept fd) into the
  9-minute backstop. Both fixed forward: survivor now starts only AFTER the
  victim holds its in-flight call and the kill waits for the survivor's own
  U5-IN-RUN; completion settles on RUN RECORD + dead pid, 'close' is only the
  fast path.
- crash-reclaim-3-reconstruct/ — zero-spawn reconstruction of run 3:
  abnormal-kill + simulation replay PASS, other-world stays FAIL (stored
  aAliveWhileBCrashedAndReclaimed=false) — the reconstruction deliberately
  cannot recolor a survivor that never straddled the kill.
- budget.jsonl — 6 of 6 authorized host starts consumed (3 attempts x 2;
  attempts 1-2 are informative REDs, each root-caused to the SUPERVISOR's
  judgment/sequencing, never to the factory or the lease protocol). A clean
  run of the forward-fixed sequence needs +2 starts and awaits owner
  authorization; the factory-side T2 acceptance conjunction (in-flight kill
  + provenance reclaim + proof-gated kill + zero refusals + marker-only home
  delete) is live-PASSED and reconstruct-replayable TODAY.

## Review round 2 closure + provenance disclosure

The supervisor now emits `hostTreePristine` for the pristine TEST_USE host
checkout and a separately computed Team-repository `teamTreeClean`, with
`teamTreeDirtyPaths` when tracked files are dirty. C1 injects a dirty tracked
status through the git seam and requires `teamTreeClean === false`.

The committed live record at `teamSha` **d8f40c0d** predates this field. Its
legacy `bindings.teamTreeClean` therefore means only “TEST_USE host-tree
pristine”; it must not be read as Team-tree cleanliness. The only delta
between that live teamSha and the current PR head is docs/evidence:
`git diff d8f40c0d..HEAD --stat -- packages tests scripts` is empty, so the
proven CODE equals the current head's code.

Injected IO is explicitly marked `simulated: true` and
`evidenceKind: 'injected-io'`; the frozen production IO object produces
`simulated: false` / `real-io`. `assertLiveDigest()` rejects simulated digests
before verdict consumption. The live record's probe digests are real: they
were produced by the default real IO path (HTTP health plus session/create
requests), not an injected seam; reviewers can verify this by checking the
record's digest/evidence rows and the absence of an injected `io` argument in
production `main`.
