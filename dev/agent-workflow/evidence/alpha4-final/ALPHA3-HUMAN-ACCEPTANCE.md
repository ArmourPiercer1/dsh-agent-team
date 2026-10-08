# Alpha.3 §8 permission-surface human acceptance — Alpha.4 stage closure receipt

**Status: `BLOCKED / NOT_RUN` — owner = the human project owner.** Nothing in this file is a pass until a
human signs it per step. The coordinator owns this receipt, the environment request, and the reminder —
never the verdict. `docs/plans/active/alpha4-permission-governance/alpha4-implementation-plan.md` §7.7;
the checklist itself is `dev/agent-workflow/evidence/alpha3-pr5-notification-projection/ALPHA3-PERMISSIONS-USER-FACING.md` §8 (`:193`–`:240`).

**The §7.7 trigger has fired** (2026-10-08): §7.3's v3-only flip landed, §7.4's fixture migration landed,
§7.5's remainder landed **including the `leaderEnvelopeCoverage` deletion** (PR #187 at `0e7004b6`), and the
test runtime builds and boots here. What is still unavailable in this environment is `DEEPSEEK_*` model
credentials, so the *agent-turn* dimension of steps 4–7 can only be driven through the repo's mock model
lane; **a human holding real credentials can perform the whole checklist as written.**

## What to run

```bash
cd /home/user/dsh-plugins/dsh-agent-team
# 1. build gate, on the merged tree
pnpm build && pnpm build:composition && pnpm check:artifacts && pnpm check:artifacts:head
# 2. boot a TEST instance (3180 family; NEVER :3080) against the acceptance world
cd dev/agent-workflow/evidence/a4-pr76-acceptance-world
node boot.mjs --detach --model-delay-ms 4000 --repo /home/user/dsh-plugins/dsh-agent-team   # prints the token URL
#    … perform the steps in the browser at that URL …
node boot.mjs --stop        # ALWAYS tear down, and confirm the port refuses afterwards
```

**Protocol-version note (plan §7.7):** steps 4–5 are written against remote **v7**; execute them at **v8**
and **retain the v7 compatibility leg** — i.e. perform each of steps 4–5 twice, once at each version, and
record both. A v7 leg that no longer answers is a finding, not a simplification.

**Teardown rule learned the hard way (F3):** `boot.mjs --stop` prints `stopped` from its own marker file
while the port can still be answering — **confirm `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3180/`
returns `000` / connection refused**, and if it does not, kill the managed job that owns the supervisor.

## Machine legs already witnessed (context for the performer, never a substitute)

| §8 step | machine status on the merged tree | what a human adds |
| --- | --- | --- |
| 1 build gate | MACHINE — `check:artifacts` `verdict=ok compared=1508`, `check:artifacts:head` `verdict=ok drift=0` | — |
| 2 boot + team from an envelope-carrying v3 Blueprint | MACHINE — bare `/` → 401, token URL renders, catalog lists both blueprints | seeing the team exist in the GUI |
| 3 tool surface | half: both permission tools route to production on the Leader (typed `TEAM_TOOL_BAD_ARGUMENT` witness); **GUI half open** | the tool surface *as displayed* for a Blueprint-selected subset |
| 4 WRITE | MACHINE — `changed:true`, identical replay `changed:false reason:no-change`, operator v7 twin | performing it from the composer |
| 5 READ | MACHINE — `authority.present:true`, server-canonicalized rule, `history` ascending | reading it back on screen |
| 6 ACTIVE notification | **GUI-WITNESSED** — `[team-perm-changed … generation=3]` renders in the member trajectory; header correct, `ruleCount: 3` and no rule bodies, exactly one logical delivery | with a **real** model instead of the mock lane |
| 7 IDLE no-wake | MACHINE — idle window ≥ 2× delay, zero new model requests, WRITE still commits | watching that nothing wakes the member |
| 8 negative reads | MACHINE — `TEAM_REMOTE_FOREIGN_TEAM`, `PERMISSION_LIFECYCLE_INSTANCE_UNKNOWN`, `method-version-unsupported` | — |
| 9 lifecycle audit | MACHINE — archive keeps history `[1..5]`, fresh member `authority.present:false` | — |

Receipts: `dev/agent-workflow/evidence/a4-pr76-acceptance-world/receipts/driver-run-20261008T044850.log`,
`…/GUI-20261008.md`, `…/gui-20261008-member-trajectory-step6.png`.
**Known weakness of one machine leg, disclosed:** step 6's *machine* witness once passed on
`capturesScanned: 0` (finding F2); the GUI observation is what makes it true. If you re-run the driver,
expect that to be fixed or re-file it.

---

## Receipt (one block per step — fill, sign, and flip the status above)

Common fields: **tree SHA** · **world** (`tests/homes/a4-accept-*`) · **host** (`0.2.0-rc.2-639ed0151`) ·
**port** · **model lane** (real / mock) · **performer** · **date/time** · **observed** · **verdict**
(PASS / FAIL / NOT RUN — *no third value; "couldn't run" is NOT RUN and blocks closure*).

- [ ] **Step 1 — build gate.** `pnpm build && pnpm build:composition` then `pnpm check:artifacts`
      `rc=0` **and** `pnpm check:artifacts:head` `rc=0`. Paste both `DSH-ARTIFACT-VERDICT` lines.
- [ ] **Step 2 — boot and create a team** from a valid v3 Blueprint carrying a non-empty
      `permissionMutationEnvelope`. Note the boot line, the 401 on bare `/`, and the team id.
- [ ] **Step 3 — tool surface.** In the Leader session, confirm `team_grant_permission` and
      `team_revoke_permission` are visible among the Blueprint-selected subset (fewer of the other
      thirteen tools is legitimate). Screenshot the surface.
- [ ] **Step 4 — WRITE leg** as Leader, `team_grant_permission` for one exact file resource on one
      existing member → ack reports `changed: true`. Re-issue the identical grant → may no-op with zero
      notification, by design. **Then the operator-side equivalent at v8, and again at v7.**
- [ ] **Step 5 — READ leg.** `override.getPermission` → `authority` shows the grant, `history` ascending.
      Confirm on screen that this is overlay + history **only**, then confirm the execution conclusion by
      actually attempting the next operation. **At v8 and at v7.**
- [ ] **Step 6 — ACTIVE notification.** With the addressed member RUNNING, a CHANGING grant produces **at
      most one** message starting `[team-perm-changed team=… instance=… generation=…]`, containing **no
      rule bodies**, and the member is **not** restarted. Zero is a legitimate best-effort outcome — if
      you see zero, say zero (and note that the machine leg that once passed on zero captures is F2).
- [ ] **Step 7 — IDLE no-wake.** Same grant/revoke while the member is IDLE → it receives **nothing** and
      is **not** woken (no new activity on it), and the WRITE still commits (proven by the step-5 read).
- [ ] **Step 8 — negative reads.** Foreign `teamSessionId` → `TEAM_REMOTE_FOREIGN_TEAM`; current team +
      another team's `memberInstanceId` (or any ghost id) → `PERMISSION_LIFECYCLE_INSTANCE_UNKNOWN`,
      **not** an empty view; the call at protocol v6 → `method-version-unsupported`.
- [ ] **Step 9 — lifecycle audit.** Archive the member, re-read → history **remains** readable; create a
      fresh member → `authority` **absent** (no inheritance).

**Then, and only then:** flip this file's status, and the coordinator records stage closure separately from
the merge (they are different facts — *PRs merged* / *implementation complete* / *human acceptance* /
*stage closure*).
