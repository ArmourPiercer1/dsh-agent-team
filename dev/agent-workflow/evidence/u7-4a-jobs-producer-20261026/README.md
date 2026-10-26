# U7-4a evidence — governed background-bash attribution producer (C1 + C2)

Task lane: `task/u7-4a-jobs-attribution-producer-20261026` (worktree `.worktrees/u7-4a`),
base origin/master `496a3980f`. User ruling 2026-10-26 item 2 (USER-RULINGS): the governed
background spawn IS an approved Alpha.5 capability — the existing `attributeBackgroundJob`
must gain its producer; the job trio may not be delivered as an all-refusal surface.

## What landed (production, four hunks + placement)

- `packages/runtime/src/plugin/live/jobs-background-producer.mjs` (NEW, zero imports — P9 pin):
  the creation-lane producer. Authority order: kernel consumeOnce → backend.run → preflight
  (inside `JobRegistry.start`) → spawn (inside `run()`, SAME confined provider, SAME request)
  → host receipt → `attributeBackgroundJob` → only then the model-visible receipt.
  Attribution refusal closes the job honestly (requested / already-finished /
  TERMINATION-UNCONFIRMED) and answers a typed refusal.
- `packages/tools/process-family/src/confined-shell-executor.mjs`: optional `background`
  collaborator (explicitly-configured arm, same confined provider); UNCONFIGURED → the
  `background-not-supported` refusal stays byte-identical BEFORE probe/spawn (zero flip).
- `packages/runtime/src/plugin/live/team-tool-plane.mjs`: closed keys `jobsEnabled` +
  `backgroundJobs`; five ordered PLANE_CONFIG_INCOMPLETE refusals incl. the CREATING-LANE
  PIN LAW (`names.bash` must be `'bash'` — the attribution path reads the placement feed by
  the creating row's name; default naming = never-registered mapping refusal).
- `packages/runtime/src/plugin/live/agent-bindings.mjs`: per durable member mount, when
  `backgroundJobs` is configured, the producer is built over `ci05GovernedGatewayRow` +
  the jobs bridge `ensureRegistered`, owner = mount facts (session/root/instance);
  `ownerDurable` is an ADVISORY earlier-refusal (leader-style mounts without a durable
  MemberInstance never spawn, never attribute). NAMED center-interface change — booked as
  an override in `dev/agent-workflow/ledgers/arc-a-protected-center.json`.
- `scripts/place-dist-glue.mjs`: PLACEMENTS +1 (dist mirror placed; `check:artifacts` green).

## C1 (offline, vitest)

- `c1-run1-RED-fixture-and-pin-fixes.log` — first run 8F/19P: the deepest finding was the
  CREATING-LANE PIN (K1 mapping-rejected under default naming) plus three fixture/producer
  fixes (late-handle terminate kick, ProviderResult error-code read, microtask wiring).
- `c1-run2-GREEN.log` — 19/19: producer unit G1 P1–P9, ci05 regression G2, executor arm
  G3 E1–E3, and the FULL KERNEL G4 K1–K6 (real plane + real landlock launcher + real PA ask
  legs via approving/denying control legs; K4 = zero-flip default naming; K5 = deny → zero
  spawn/zero producer; K6 = the full config-refusal matrix + the positive legal combination).
- `c1-runtime-suite-GREEN-minus-preexisting-p6t3.log` — full `packages/runtime/test` suite:
  7 failures, ALL pre-existing p6t3-mediation/restart reds, byte-identical to the SAME
  failures measured on the pristine base checkout @ 496a3980f (main checkout, unmodified).
  No new reds. (team-session-activation A15 flaked once under heavy concurrent load —
  elapsed = −27808 ms, a clock-skew artifact; passes isolated.)
- `p4t6-RED-unbooked.log` → `p4t6-GREEN-booked.log` — scanned-total 1279 = 1277 + the two
  booked U7-4a paths (SCANNED_PATHS_U74A).
- Center fitness: `u6-arc-a-fitness` + `u6-pr6-arc-d-adversarial` 25/25 green once the
  NAMED center-interface override is booked (sha256 03e74843… of agent-bindings.mjs).

## C2 (live host) — FINAL: main 12/12 PASS (`u74a-main-4`), plant 3/3 PASS (`u74a-plant-1`)

**RAW vs RE-JUDGED (R1-F2 traceability, see `VERDICTS-MANIFEST.json`):** the raw live
judge of `u74a-main-4` recorded **11 PASS / 1 FAIL** (`u74a:kill-live-requested` — a
judge DEFECT: the leg required warm bytes inside a DELTA read that had legitimately
consumed them earlier); the raw judge of `u74a-plant-1` recorded **3 PASS / 1 FAIL**
(`u74a:plant-refused` — the leg guessed the refusal wording instead of measuring it).
Both FAILs were defects of the JUDGE, fixed in this PR's own commit (0c94eac93), and
both boots were re-judged OFFLINE over their retained digests (the judge is a pure
function; no re-boot, no re-measure): accepted final verdicts 12/12 and 3/3, with the
anti-laundering proof in `VERDICTS-MANIFEST.json` (the re-anchored legs assert strictly
MORE physical evidence than the defective ones).

Five boots, budget 5/5. Iterations: run1 (approver targeted the wrong Team session —
`ok:false` recorded per row made it visible), run2 (9/12 — learned the MOUNT-SCOPED
attribution ledger and the native `description` requirement), run3 (11/12 — leader
follow-stage restructured into a clean wait→follow→collect state machine),
run4/`u74a-main-4` (final 12/12; the kill-live late read under DELTA semantics answers
`(no new output)` past the FINAL window + `[status: killed …]` — recorded in
`u74a-main-4.rejudged.json`), `u74a-plant-1` (plant 3/3 via `u74a-plant-1.rejudged.json`,
the leg re-anchored to the measured unconfigured row shape `a5p5-refused …
code=background-not-supported`). Both re-judges are the PURE judge over the boots' own
retained digests — no re-boot, fully disclosed.


Harness (three NEW files, lane-owned; shared factories imported unmodified):
`tests/world-factory/lib/u74a-jobs-assembly.mjs`,
`tests/world-factory/canary/u74a-ctl-probe-host.mjs` (read-only
`/__u74a/controls?session=…` over the public `teamRoot.control.listControlState`),
`tests/world-factory/u7-4a-jobs-suite.mjs` (ONE host start per invocation; wall guard).
Approver law: every governed ask row is settled EXACTLY ONCE through the PUBLIC
`team.resolveControl` v4 seam against the GOVERNED team session — no invented tokens, no
private API. Approval rows observed via BOTH the p6t6 observer and the additive probe
(the R-U6P4-2 root-visibility lesson).

- `harness-offline-smoke.mjs` — the offline smoke kept in-repo for re-audit: config law
  (backgroundJobs true/absent, names takeover, launcher sha hashed, A2C-1 no-shell-allow),
  all decide machines (incl. the kill-live EARLY + decisive LATE T_KLFOLLOW reads), judge
  saturation (11 MAIN + 3 PLANT all-PASS) and judge emptiness (all-FAIL). 27/27.

## Honest notes

- TWO CLOSED GRAMMARS, one per face (live-confirmed): the GOVERNED bash row takes
  `{command, cwd, timeout, background}` (`a5p5-tools/src/args.ts parseBashArgs`,
  `additionalProperties:false`); the NATIVE host bash tool takes
  `{command, description(required), timeout, run_in_background}`. Member lanes ride the
  governed grammar (extra keys = refused-schema); the CI-03 boot-root control lane rides the
  native one. A mid-lane authoring confusion between the two was caught by source audit and
  live evidence before any verdict depended on it (boot-1 `native-ctl` line records it).
- MEASURED LAW (boot 2, honestly re-anchored into the judge): the attribution ledger is
  MOUNT-SCOPED at this pin — a governed member reading ANOTHER member's genuinely attributed
  id meets the typed `unattributed-job` refusal with zero host reach (the word
  `owner-mismatch` does not exist in this bridge build). The foreign leg is judged against
  the measured law: typed refusal + zero ring bytes + zero host vocabulary.
- Concurrent-writer incident: two delegated authoring agents plus the parent touched the
  three harness files between 11:10–11:20. The parent audited the final on-disk state file
  by file (imports, judge legs, config surface, arg grammar) and re-verified with the smoke
  above; no production file was touched by that exchange. Disclosed for review honesty.
- Receipt face vs native host bash is a registered presentation difference: header
  `bash · exit=not-observed`, stdout `> started background job <id> (governed: manage it
  with the job_list / job_output / job_kill trio)`.

## Final gate state (post-merge, clean committed tree)

- `ci-pr-gate --full --census`: **PASS 8/8** (`ci-pr-gate-full-GREEN-8of8-on-clean-committed-tree.log`).
  The first (pre-commit) run's two new census reds were the a4p7 self-legs — composition-smoke
  needed `pnpm build` (`pnpm-build.log`; identical refusal captured on pristine base), install-surface
  measures the committed surface. Both legs 35/35 green after build+commit; `artifacts-at-head`
  first-run refusal was a missing store dir (environment), pass on re-run.
- Post-merge unit sweep 46/46 (p4t6 1279 booking holds through the master merge; arc-a fitness green).
- SESSION_ROUTER_LOG conflict (append-only, both-sides-appended) resolved keeping master's
  entries first, mine last; my own pre-PR entry amended in-branch (never landed) to the final
  5/5-boot tally.
