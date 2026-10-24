# A5M2 G5 host-window B — PREPARED, NOT FIRED (no root GO; boot env absent = rc3 NOT_RUN)

Root B-slot dispatch 2026-10-28. One boot, exactly TWO real governed G5 calls over the
public wire: **get_goal ALLOW** then **get_goal DENY** (identical args; the ONLY
difference is the Control decision). Family-structural PA (the plane `paAdmit` seat;
goal names are NOT in the 37646 blueprint vocabulary — no lane rule is nameable or
needed). No direct arm calls, no invented Host API, no placeholder asserts.

## Executable entry (GO time; NOTHING ran with boot here — both local passes were DRY, zero spawns)

    cd /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5m2-wire-g5
    A5M2_G5_WINDOW=GRANTED \
    A5M2_G5_INSTALL_DIR=/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/pack-int/install-0a3f11b2 \
    A5M2_G5_RUNNER_SHA256=<driver sha below> \
      bash dev/agent-workflow/evidence/a5m2-g5-host-window-b/scripts/06-run-g5-window.sh
    # dry pre-proof path (no boot): A5M2_G5_DRY=1 replaces A5M2_G5_WINDOW=GRANTED

## Fixed inputs (verified, read-only)

| item | value |
| --- | --- |
| product | `37646ac288dbd0ee3c998343dc91fd1a8da7a2d5` |
| tgz | `.worktrees/pack-int/out-37646ac2-20261024T085726Z/dsh-agent-team-0.1.1-alpha.2.tgz` sha256 `3652b2ce19025d0d25d8b661fc08f0a3cb0737bb7b4fbc339fd61a12e2b5fd7c` |
| fixture | `.worktrees/pack-int/install-0a3f11b2` (READ-ONLY, lock `7685317f…659` verified per pass; NEVER installed/touched; fixture lock/pkg hashes measured equal before/after) |
| dist trio | g5-goal-service `8a98ee550cfb21a8cd427be7a73b2f83793f6ffff9a7f36d3def162070a3ab5a` (== this lane's delegate src, byte-identical), g5-goal-wiring `c87f3db5aef3b2064fe16b18c516758d66dddca7683aec07fdf0351134b8c2e7`, agent-bindings `cd9df2f3e610c41b2dbe5330189cbc24251379b4eb1f04aa97bf1ae5bb280435` |
| host | 639ed01539 checkout `tests/deepseek-harness-test-use` — REUSED, never cloned/installed |
| blueprints | validated by the REAL `parseBlueprint`/`validateBlueprintDocument` from the pack pre-boot: anchor v3 `sha256:c850f701f…`, saved `team.a5m2-g5-hw` v3 `sha256:5a244672e…` |
| driver | runner file sha256 `d5b84a45b6ebf37f0f12f4a8211aaf4755ac3ebf44dff7a4cceefbbea10c84ef` (pre-commit; the commit carrying it is the lane tip below) |

## Coverage law (root correction 2026-10-28: managed = OWNERSHIP, not vocabulary)

Worker `builtinToolDeny` = A-window-2's measured 15 unmanaged names (`ask_user_question`,
`create_goal`, `exit_plan_mode`, `get_goal`, `glob`, `grep`, `job_kill`, `job_list`,
`job_output`, `present`, `skill`, `update_goal`, `web_fetch`, `web_search`, `workflow`)
**MINUS** the G5 trio `create_goal`/`get_goal`/`update_goal` — those three are OWNED here
by the mounted plane rows (GLUE-5: `a5PlaneOwnNames` enter the coverage gate under the
team-tool authority owner, agent-bindings :6993-7005). The trio is NOT deniable without
denying this window's tested subject. Resulting removal set (12): ask_user_question,
exit_plan_mode, glob, grep, job_kill, job_list, job_output, present, skill, web_fetch,
web_search, workflow. Exposure-shrink for this isolated test world only — it exempts no
tool from delivery and claims no tool unmanageable. fsInstance ABSENT (no fs family
armed; the A-window COMPLETE four-field shape applies only if one ever is).

## Supervision / cleanup / budgets

- HOME `tests/homes/a5m2-g5-hw-b-<UTCts>Z`, NEVER deleted, NEVER globbed — explicit
  pointer file `$OUT/home.txt` (env `A5M2_G5_HOME_POINTER`, written before boot);
  new-bytes budget 64 MiB (measured dry: 3546 B).
- ports 3184/3499 pre-check only; occupied => refuse rc3, foreign occupants NEVER killed.
- one boot; 300s TERM to the OWN process group, 20s grace, KILL own group only;
  cleanup = mock.close + instance.stop + waitForPortFree (any ERR/free=false => no green exit).
- df bar 6442450944 B (root-ruling temporary, mirrored from the A monitor 38b81fff).
- rc: 0 green / 1 CRIT-FAIL / 2 FATAL / 3 NOT_RUN. runs-*/window-*/HOME retained, never committed.
- A/B non-collision: A = lane a5m2-wire-g3, 3183/3498, HOME `a5m2-edit-hw-a-*`, BP `team.a5m2-edit-hw`,
  realm `a5m2-edit-hw-realm`; B = this lane, 3184/3499, HOME `a5m2-g5-hw-b-*`, BP `team.a5m2-g5-hw`,
  realm `a5m2-g5-hw-realm`. No shared ports/HOME/BP/realm/files; shared face is read-only only
  (install-0a3f11b2 + pack + Host639). A third window owns 3183/3498 — untouched here.

## Evidence law (what GO-time must show, or the window FAILS)

E0 member face carries the governed trio; E1 allow => `control-allow-consumed` fact +
served `{"goal":null}` projection in the model-visible result; E2 deny => NO
allow-consumed fact + durable decision fact + in-band refusal, NO served projection.

## Known open items (honest, pre-GO)

1. E2 refusal-band wording is matched with `/denied|refus|P_G5|pa-/i` — the exact refusal
   bytes for a G5 deny are FIRST-WINDOW MEASUREMENTS; tighten to the measured wording after the boot.
2. E1 assumes the member world is goal-less so get_goal answers `{"goal":null}`; if the
   real serve shape differs, that is a measurement to report, not to pre-assert.
3. Original G5 semantics beyond the get_goal pair (create/update arms, goal-round
   blocked delegate) need further root-GO'd windows; NOT scripted here (不自行扩大).
4. G5 remains 必交 — this slot release is a queue move, not a delivery waiver.
