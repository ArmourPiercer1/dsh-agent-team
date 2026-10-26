# U6 PR6 — Legacy center-path removal: per-name ledger + proof

Scope (B) of U6 PR6: kernel-owned family names lose their legacy center path.
Consumption law (U6-SLICE-PLAN §PR6): **a name loses its old path only when
(a) its contribution is registered in the derived census and (b) C1 + C2 are
green for the new home.** There is no dual ledger: after this round exactly
one path per name exists in the production tree.

Machine evidence for every row: `legacy-path-removal-machine.json` (this dir) —
ARC-A fitness L1–L4 over THIS tree (L1 digest-locked protected ledger: 0
violations over 33 tracked protected files; L2: zero tool-name literals in the
five governance-center sources; L3 census closure: 0 violations; L4 closedness:
0 violations), hub-path absence on disk ×3, and the production grep census.

## What left the world (the legacy center site)

| Path | Status |
| --- | --- |
| `packages/runtime/src/plugin/live/plane-effect-backends.mjs` | DELETED (7 pure re-export blocks, ZERO module importers — the only in-tree "import" was a regex pin in u6-pr4, flipped to an ABSENCE pin in the same commit) |
| `packages/runtime/src/plugin/live/plane-effect-backends.d.mts` | DELETED (its consumed face `createGovernedReadExecutor` is retargeted to the fs-family index; the consumed call-signature typed locally at the one legacy consumer `a5-read-slice-window` which pinned the literal specifier) |
| `packages/runtime/dist/packages/runtime/src/plugin/live/plane-effect-backends.mjs` | dist mirror DELETED; `scripts/place-dist-glue.mjs` PLACEMENTS entry dropped (28 placements remain) and the generator re-run verified |

The `git ls-files` pins are written as trackedPresent() (index ∩ work-tree) so
they hold pre-commit AND post-commit, never vacuously (non-vacuity leg: the
same check still sees `jobs-family-bridge.mjs`).

## Per-name ledger (kernel-owned families)

| Name | Old center path (now gone) | Single home (registered) | Census row | C1 (packages/*/test) | C2 (world-factory) |
| --- | --- | --- | --- | --- | --- |
| `read` | plane-effect-backends.mjs re-export | `packages/tools/fs-family/` (read-executor / fs-mechanics / read-presentation / read-contribution) | `dsh.fs-family` | a5-read-slice-window 40 ✓ (retargeted import), read-slice suites as booked | `u6-fs` suite (PR2 receipts; `fs:governed-read-positive` etc.) |
| `bash` | plane-effect-backends.mjs re-export | `packages/tools/process-family/` (shell-mechanics / confined-shell-executor / bash-contribution) | `dsh.process-family` | a5b3-cancel-leg 12 ✓, a5r-cause-relay 9 ✓, a5-m1-auth-bridge 50 ✓ (retargeted) | `u6-proc` suite (PR3 receipts; approve-spawn-once etc.) |
| `grep`, `glob` | plane-effect-backends.mjs re-export | `packages/tools/search-family/` (search-mechanics / search-row / search-contribution; git-mv trio from PR5) | `dsh.search-family` | u6-pr5-search-move-law 4 ✓ (M3 flipped to hub-absence), alpha5-search-backend 42 ✓, glue7 12 ✓ (retargeted) | `u6-arc-a` suite (PR5 receipts) |
| jobs trio (`job_output`/`job_kill`/`job_list` governed bridge) | plane-effect-backends.mjs provenance block | `packages/runtime/src/plugin/live/jobs-family-bridge.mjs` (named BRIDGE — intentionally NOT in the family census; arc-a L3/L4 scan scope `*contribution*.mjs` correctly never saw it) | n/a (bridge, disclosed) | u6-pr4-jobs-bridge 24 ✓ (A2 flipped to ABSENCE pin + bindings edge pins kept), a5p7-jobs-assembly-actuator 40 ✓ (retargeted) | `u6-jobs` suite (PR4 receipts) |

`probe` (`u6arc_probe`) — test-only family, booked in the census as
`dsh.u6-probe-family`; not a production center path, listed for completeness.

## Law flips that used to REQUIRe the old path (now require its absence)

* `u6-pr4-jobs-bridge.test.ts` A2: old-home edge → asserts the hub is DELETED
  (existsSync false + trackedPresent empty) and keeps the agent-bindings edge
  pins verbatim.
* `u6-pr5-search-move-law.test.ts` M3(b): dropped `read(PLANE_PEB)`, asserts
  `.mjs` + `.d.mts` absence; M1/M2 ride `gitShow(rel, BASE_SHA)` history reads
  (unaffected by deletion); M4 untouched.
* `a5p7-lane-hygiene.test.ts`: the hub's ledger entry removed; jobs bridge and
  u6-pr4 entries intact.
* `p4t6-session-event-scan.test.ts`: first REMOVAL ROUND in the census's
  history — `SCANNED_PATHS_U6PR6` (+2 specs) nets against
  `RETIRED_PATHS_U6PR6` (−2 booked names, pinned ABSENT), historical ties
  corrected by the derived retired term. Measured UNBOOKED RED then GREEN:
  `p4t6-UNBOOKED-RED.log` → `p4t6-GREEN.log` (10/10).

## Sensitivity of the proof (§10.5-6 for a REMOVAL)

The removal is not trusted from `rm`: (1) the u6-pr4/u6-pr5 law flips are
RED-first-shaped — if any hub copy reappears, existsSync/ls-files go RED
(non-vacuity leg proves the check can see a present file); (2) the p4t6
absence-pins go RED on resurrection; (3) every consumer suite listed above
runs the SAME bodies through the family homes (the C1 columns are the positive
controls: the work still executes, now under one home); (4) L1–L4 stay 0/0/0/0
with plants covered in u6-pr6-arc-d-adversarial AD4/AD5 (second-ledger twin +
digest-drift plant both caught).

## Disclosures

* Comments in family lanes referencing plane-effect-backends.mjs as the code
  PROVENANCE (moved-verbatim headers, "at master" anchors) are kept — they are
  true history. The three comments claiming an ONGOING re-export
  (fs-mechanics, shell-mechanics, team-tool-plane) were corrected in this
  commit because the deletion makes them false.
* The worktree `a5p4-lane-hygiene` self-typecheck leg fails ONLY on this
  worktree's missing `node_modules/@types` link (reproduced with a trivial
  file under identical compilerOptions by the removal executor); CI installs
  normally.
* Scope-(A) boot ledger, ARC-D matrix verdicts and the G4 recommendation ride
  `docs/plans/memo/unified-baseline-alpha5-20261025/u6/G4-CORE-EVIDENCE.md`.
