# Control: pristine `origin/master` `9c730c3d7` (no PD-28 commit) fails identically

**Why this directory exists.** The PD-28 re-bind boot on the merged tree failed with
`tool-web (dsh-agent-team/web-tool): never started` before any Member probe ran. A
failure that appears right after a merge is guilty until proven otherwise, so this
control boots the SAME driver against a plain worktree of `origin/master` =
`9c730c3d7` (PD-27's merge), with **no PD-28 commit and no PD-28 product file**
present.

**Setup** — `git worktree add --detach .worktrees/pd28-mastercheck 9c730c3d7`, then
the driver directory copied verbatim from the PD-28 worktree
(`tests/world-factory/drivers/a5sf-pd28-service-seam/`; it is lane-local TEST code,
it imports the product through the same public seams as every other a5sf driver, and
it writes only into that worktree's evidence directory). Host tree symlinked to the
same pristine pinned checkout, read-only.

**Result — identical, and it agrees with itself across both boots:**

```
[2026-11-08T12:00:30.988Z] [boot1] rows: dsh-agent-team,preset-a5sf-governed-member,p6t6-team-tools
...
activation: child-session creation failed for member 'inst-0ck3mov0u1sd':
  RemoteError: tool-web (dsh-agent-team/web-tool): never started
RUN-SUMMARY ... overall=FAIL cases=6 FAIL:5 PASS:1
...
TWO-RUN AGREEMENT ... agreeing=true differing=[]
RESULT FAIL arm=postfix (2/2 boots; agreeing pair=true)
```

The Leader still receives its full 43-tool surface (including
`web_fetch`/`web_search`, which come from the **profile** layer), and the failure
happens at the **governed Member preset mount**, i.e. the Member is never created
and no probe can run — the same shape, the same message and the same counters as the
merged tree's boot.

**Conclusion.** The governed-Member regression belongs to `origin/master` itself
(PD-27 / #676), not to the PD-28 merge: master's shipped governed preset carries a
row whose name (`dsh-agent-team/web-tool`) the preset resolver cannot load, so
`auditRows` reports the row with no fiber. Both trees show it byte-for-byte, so no
PD-28 change can be blamed for it and no PD-28 change can fix it from inside this
lane without editing the web lane's composition row.

Files: `driver.log` (full two-boot log), `boot01-diagnostics-final.json` (the model
transcript carrying the `TEAM_RUNTIME_DURABLE_WRITE_FAILED` rejection and its
`RemoteError`), `boot01-leader-surface.json` (the Leader's 43 names — proof the
profile layer is intact), `HEAD.txt` (the exact control commit).
