# tests/world-factory — the ONE TestWorldFactory + real-Host Canary/Oracle (U5 / gate G3)

One creation/reclamation point for test Worlds on the pinned pristine Host
(`tests/deepseek-harness-test-use` @ `TEST_USE_BASELINE_SHA`), plus the
test-only **Canary** that walks the full public path once per live run
(registration → dispatch through a real model turn against a mock provider →
effect on disk → returned result) and an **Oracle** that judges effects ONLY
from channels independent of the tool's own return value.

Nothing here is collected by vitest (`vitest.config.ts` only includes
`packages/*/test/**`). Live-Host runners are opt-in by construction: they boot
a Host only when a human/agent invokes them explicitly, and every `startHost`
is written to a shared budget ledger BEFORE the spawn; a run whose ledger
already holds `--max-host-starts` entries REFUSEs every case instead of
booting.

## Test tiers

| tier | what | run | touches Host? |
| --- | --- | --- | --- |
| **C1 adapter-local** | offline unit + sensitivity tests of the factory machinery (port leases incl. the FIX-T cross-process race harness, verdict algebra, Oracle fault-planting sensitivity, cleanup-ownership guards, capped ledgers, owned-path guard, mock decide discrimination, host-base guard) | `node --test tests/world-factory/world-factory.test.mjs` | NO — CI-safe (`U5_RACE_TRIALS` raises the race sample) |
| **C2 real-Host, candidate-pinned** | the Canary suites below against the pinned pristine Host at `TEST_USE_BASELINE_SHA` (the fixed candidate; no floating versions) | `node tests/world-factory/u5-canary-runner.mjs --suite <core\|core-restart\|negatives\|u6-shadow\|u6-fs\|u6-proc\|u6-arc-a\|crash-victim> --line <line> --evidence <dir> [--budget-ledger <jsonl>] [--max-host-starts 15]` | YES — budget-leased |
| **C3 parallel/crash orchestration** | two Worlds live in parallel; victim SIGKILLed; crash-residue reclaim; other-World + pristine + :3080 + sibling-home untouched checks | `node tests/world-factory/u5-parallel-supervisor.mjs --evidence <dir> [--mode parallel\|crash-reclaim] [--survivor-suite core\|core-restart] [--inflight-timeout ms]` (`--reconstruct <liveRecord>` re-judges a finished live run with zero spawns) | YES (2–3 starts) |

C1 is the ONLY tier CI runs. C2/C3 require a built Host tree and lease ports
3180–3186 / 3491–3500 — never 3080 (the stable dev instance is probed
read-only before/after and never signalled).

## What each C2 suite proves

* `core` (one World, one boot): `token-gate` (401 without token),
  `positive-control` (full chain green), `error-return-with-effect` (tool
  throws AFTER its effect → result errored, Oracle still sees the effect),
  `planted-defect-detected` (the canary LIES `ran:true` while writing nothing;
  the sound Oracle must report NO effect — this PASS IS a fault-planting RED),
  `oracle-blinding-divergence` (the deliberately-broken `ignore-marker` Oracle
  turns the SAME planted defect GREEN — the divergence is the sensitivity
  proof), `leak-check` (every owned pid dead, every leased port idle, every
  lease file gone, World home released).
* `core-restart` = `core` + `restart-persistence` (stop/boot again on the SAME
  World: boot-1 markers survive, fresh session writes again).
* `negatives`: `wrong-scope-no-effect` (mounted but not registered → a forced
  model call yields no effect and an error result), `start-failure-classified`
  (unparseable profile-patch layer → boot dies → verdict **START_FAILED**,
  never PASS), `timeout-classified` (tool outlives its case budget → verdict
  **TIMEOUT**), `interrupt-classified` (`session/cancel` mid-call →
  classified, cancel accepted, result never returns clean).

* `u6-fs` (U6 PR2 C2, one governed Team World, one boot): the kernel-owned
  governed `read` lane on the REAL pinned Host — `fs:mounted` (production Team
  row + p6t6 state + probe row registered), `fs:governed-read-positive` (a
  permissions-carrying member's read answered by the host Body, content claim
  proven outside the transcript via the probe ledger), `fs:refusal-zero-effect`
  (deny-lane read: call reached the dispatcher, result errored, the denied
  file's unique claim appears NOWHERE), `fs:ctl-native-read` (CI-03: the
  permissions-less template's native read unchanged), `fs:identity-swap` +
  `fs:toctou-abort` (the probe row's SPOOF re-registration of the governed
  name between-calls and inside a call's execute window — PASS requires zero
  spoof-Body effect; the ledger records which host law refused the plant:
  dispatch-time identity refusal or the registry's own scope law),
  `fs:identity-swap-sensitivity` (reads run immediately before the swap and
  after restore — the plant verdict cannot be explained by a dead lane),
  `fs:shadow-ledger-cap` (R-REM-3: the inert PRODUCT shadow row mounts
  alongside the enforcing lane with a 5-row K5 ledger budget — the run is
  REQUIRED to hit the bounded-ledger terminal marker `shadow-ledger-capped`
  while the governed lane keeps answering post-cap reads: cap is an
  audit-channel event, never a flow event. The post-cap read is proven by
  THREE agreeing witnesses — the transcript claim, the ledger marker, and
  an INDEPENDENT oracle row (probe `tools/post-execute` reads the target
  file itself at the fs boundary: bytes/sha256/claimSeen, never the tool
  return), timestamped after the capped marker and carried in the receipt),
  `fs:leak-check` (as everywhere).
  Plant disclosure: on the live Host the spoof row is accepted only in
  member/row scopes and NEVER dispatched (the boot-root scope's re-register
  throws the Host's own `already registered in this scope`), so the swap
  arms judge `registration-refused` with zero spoof effects; the kernel-
  table swap law itself is pinned offline (C1 plants + RR legs).
* `u6-arc-a` (U6 PR5 C2, one governed Team World, one boot; design budget
  1 boot/run): the ARC-A claim on the REAL pinned Host — the PROBE FAMILY
  (`tests/u6-arc-a-probe-family`, a NEW family with ZERO center diff)
  mounts as a profile-patch row and its kernel runs the whole walk for
  real: `arca:mounted` (family-mount + probe-tool register on the ledger),
  `arca:probe-positive` (the marker file lands with the nonce INSIDE —
  disk oracle), the three refusal legs (`arca:probe-unbound-refused-…`,
  `arca:probe-replay-refused-…`, `arca:probe-unload-settles` incl. the
  post-teardown KERNEL_NOT_ACTIVE leg) each with the marker dir provably
  UNCHANGED, and the lane-side search matrix on the moved family's live
  rows: `arca:search-grep-live` / `arca:search-glob-live` (claims found +
  unicode path enumerated + the `.git` decoy EXCLUDED — the native
  contract), `arca:search-refusal-zero-effect` (the anchored containment
  refusal typed, fixture census unchanged), `arca:native-grep-control`
  (§10.5-5: the non-Team native grep unchanged). The row resolves the
  lane's two public seams at their SHIPPED dist faces
  (`U6ARC_CENTER_URL`/`U6ARC_CONTRACTS_URL` in lib/world-factory.mjs); the
  fake-scope offline test in world-factory.test.mjs runs the identical
  walk in plain node.
* `u6-proc` (U6 PR3 C2, one governed Team World, one boot): the kernel-owned
  governed process/bash lane on the REAL pinned Host, ARC-B-visible —
  `proc:mounted` (the placement feed lists `team_bash` AND `read` on ONE
  realm; zero mount/placement refusals; the confined-provider census line
  carries the pinned Landlock launcher digest), `proc:exec-door-fail-closed`
  (all leader exec-lane spawn attempts answered with typed refusals BEFORE
  any process, zero effect files — on the factory world the shell ask is
  born-terminal for EVERY rung: the fingerprint resource pins
  `requiredAuthority=human-admin` (pinned grammar, a4p7-v3-cutover-acceptance
  :1797) and no Admin resolver exists (ADR A1-12), and the leader
  exec-autonomy DUAL GATE (allow-lane rule + envelope `bash` token,
  exec-autonomy-contract) fails closed when the token is absent at bind
  time, downgrading the allow into that born-terminal ask),
  `proc:member-ask-born-terminal` (the fail-closed law live: synchronous
  terminal deny, zero processes, the leader never even notified),
  `proc:deny-zero-spawn` (typed default-deny refusal; the claim never
  touches disk), `proc:replay-settled-refusal` (the durable
  `team.resolveControl` seam refuses typed and nothing is ever left open;
  the grant-level GRANT_REPLAY twin is pinned offline in C1 kernel-flow
  C-legs), `proc:spoof-refusal` + `proc:guard-off-channel` (the spoofed
  `team_bash` body NEVER runs while the channel control body DOES — refusal
  is the lane, not a dead channel), `proc:late-call-refused` (the
  row-timeout command refused at admission; terminate mechanics carry their
  own offline pins: glue7 raceShellSettle, a5b3 cancel legs),
  `proc:ctl-native-untouched` (CI-03: the boot-root native `bash` close
  carried the NATIVE tool name with ZERO kernel mediation). Spawn mechanics
  (approve→grant→consumeOnce→execute, deny→zero-spawn, terminate, tie law)
  are pinned at the C1 production seam — the suite never claims at C2 what
  C2 cannot measure. Verdicts run through ONE shared `judgeU6Proc`
  (lib/u6-proc-assembly.mjs) used by both the live run and the zero-boot
  `u6proc-reconstruct.mjs` (offline re-judgment of written evidence; the
  budget ledger records no start for it), pinned by offline fixture tests
  over the committed run-u6prc5/u6prc6/u6prc7 evidence.
  Review-r1 POSITIVE arm (`proc:approve-spawn-once`,
  `proc:approve-replay-refused`): a named TEST-ONLY fixture — the `asker`
  member template (default:ask, NO shell rule) whose envelope NAMES
  `request-control` (closed `ALL_MUTATION_OPS` vocabulary). Full boundary
  law (admission/envelope.ts, measured u6prc6-8): a member's effective
  envelope is `blueprint.teamEnvelope.allow` NARROWED by the
  memberEnvelopes entry — template entries never widen the team-root
  allow list — so the authorization is team-root data: `teamEnvelope.allow
  += request-control` plus a leader entry pinning the leader's old bounds
  exactly (leader lanes byte-identical). Its governed `team_bash` opens a
  REAL pending leader-approval row; the
  runner settles it through the PUBLIC `team.resolveControl` v4 seam (the
  GUI's human lane; `CONTROL_RESOLVER_ROLES` admits `human`); approval ->
  bridge -> guard consume-once (one consumption row) -> real confined
  spawn whose DISK marker the independent oracle counts (never the tool
  return) -> host-native SUCCESS; the in-world replay of the SAME
  approval-case identity must be refused with zero second spawn. Product
  hooks used, all pre-existing public seams: blueprint YAML data, team-row
  `teamToolPlane`/confinedProvider config, HTTP v4 `team.resolveControl`,
  p6t6 observer. Forensic disclosure (u6prc6/u6prc7, digests carry the
  bridge's own observations): the PRE-fix lanes' live refusal cause was
  the runtime boundary refusing ask-row creation (`request-control`
  outside the declared envelopes) — NOT the shell-rung walk; the
  human-admin born-terminal and dual-gate downgrade laws remain
  C1/offline claims, attributed as such in the judge notes.

`negatives` carries honest worst-of semantics: that record's overall is
TIMEOUT/START_FAILED **by design** — the classification is the demonstrated
behaviour. **The green signal for G3 is the `core` suite**, repeated
identically. `RUN-SUMMARY`/exit codes can never say PASS while any case is
non-PASS (`lib/run-record.mjs`, pinned by C1).

## Boundaries (hard)

* Pristine Host base is READ-ONLY: `assertHostBase` (porcelain empty + HEAD ==
  pin) runs before AND after every live run; drift fails the run.
* `:3080`: read-only GET probe recorded before/after; never killed, never
  written.
* Cleanup deletes ONLY paths carrying this World's `.u5-created.json` marker;
  pid kills target ONLY pids listed in `.u5-ownership.json` AND verified via
  `/proc/<pid>/environ` (`DSH_HOME=<this home>`); a recorded-but-unverifiable
  pid is REFUSED, never killed. A foreign listener on a free-leased port is
  `EXTERNAL_BIND` → refuse, never touch.
* Port leases use APPEND-ORDERED CLAIMS (FIX-T T1 protocol, `lib/port-lease.mjs`
  header has the full proof sketch): slot dir `<port>.lease/` + append-only
  `seq` claim log; a creator's claim ORDER is the byte offset of its unique
  token line (O_APPEND offsets are strictly unique — post-write `fstat` is
  NOT, and the difference is what closed the double-ownership class); owner =
  lowest live order whose claim file exists; later creators see the earlier
  line BEFORE their decide, at any skew. Stale (dead-pid) claim files are
  reclaimed BY NAME (`renameSync` that file, ENOENT=lost; identity+liveness
  re-verified after the move) — a fresh claim can never be the object moved.
  LEGACY pre-FIX-T bare-file slots (`<port>.lease`, possibly written by a
  peer still running the old code) coexist: held while their pid lives; when
  dead they are swept via the link-identity path (hard-link + inode match +
  unlink — cannot move a directory) under a sweep sentinel. The `seq` log is
  append-only (~90 B per start) and lives under the lease root
  (`.artifacts/tmp/port-leases`), reclaimed wholesale with it.
  Reproduce/rerate the race: `node tests/world-factory/lease-race.mjs
  --trials N --procs 8 [--inject stale|reclaim]` (GREEN baseline: 460/460
  single-owner trials; the same harness measured 193/300 double-ownerships on
  the pre-fix protocol — see `dev/agent-workflow/evidence/u5-fixt-20261026/`).
* Every ledger/log the factory or canary writes is BYTE-CAPPED (FIX-T T3,
  `canary/ledger-cap.mjs`; 256 B reserved so the one `LEDGER-CAP-REACHED`
  notice always fits; rows are never rewritten or truncated): canary ledger +
  U6 shadow ledger 2 MiB (in-Host, inside the World home — `startHost` throws
  if any ledger/marker path escapes the owned home), host-start budget ledger
  1 MiB, supervisor runner logs 32 MiB (rolling, drop-with-notice).
* Windows: descendant-process-TREE cleanup beyond the recorded pids is NOT
  implemented → `windows-process-tree-cleanup: ENV_BLOCK` (stated, not
  claimed). Linux is the graded platform.
* Fresh-home disclosure: the two base-bundle LLM-API metadata contributors
  (`session-log-deepseek`, `plugin-package-inventory-deepseek`) fail EVERY
  model request with `REQUEST_EXTENSION` on a fresh unauthenticated DSH_HOME
  (measured; reported upstream in the PR body). Worlds disable ONLY them
  through their own public `config.enabled` flag (s1-h0-m1 `noext` precedent);
  all tools/Guard/dispatch paths stay mounted. The Canary never touches any
  Alpha.5 product governance path.

## Evidence

Raw logs + RUN records live OUTSIDE git under the `--evidence` root (planned:
`dev/agent-workflow/evidence/u5-g3-20261025/` in the main checkout). Launch
tokens never reach disk: only sha256 8-char fingerprints are recorded.

## Canary green ≠ product green

The Canary is a TEST-ONLY plugin exercising public seams. Its PASS proves the
test infrastructure end-to-end (gate G3). It does NOT make any product tool
green: the Alpha.5 per-tool matrix reds stay red and must be read from
`TOOL-CAPABILITY-MATRIX-9b2.md`, not from here.
