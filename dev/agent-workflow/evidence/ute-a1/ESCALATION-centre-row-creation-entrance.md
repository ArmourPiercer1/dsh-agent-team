# ESCALATION — a centre-configured row has no runtime team-creation entrance

**Raised:** round 59 (D-stage boot run). **Class:** a product capability is unreachable because of a refusal
this cut made on purpose; the fix is a ruling, not a patch.

## Measured

The centre row boots, the model-visible surface carries 43 tools (including the host-native `read` and all 15
`team_*`), the remote mount is `SKIPPED` with the C-remote reason, and:

```
[boot1] team.create status=405 ok=false null
```

- the driver's only creation entrance is the S6 remote plane (`POST /team-remote/team.create`,
  `tests/world-factory/lib/u6-fs-assembly.mjs:505`);
- C-remote (round 55) refuses to BUILD that plane on a centre row (`root.ts:4324`) and therefore never
  installs its registration seam (`root.ts:4725`);
- the round-58 fix (`host.ts:1638`) correctly turns that into `skipped` instead of a boot failure — but with no
  dispatcher there is no route, hence 405.

A/B is clean, not implicated: the round-58 *no-centre* arm got `team.create status=200` on the same driver and
then refused the Member for want of a centre. So the two halves of the product currently cannot be true at
once: **governance and runtime team creation are mutually exclusive today.**

## Why C-remote refuses at all

The S6 dispatcher is authorized by a server-derived principal, not by a member binding, so the centre's
compiled ceiling cannot speak for it and there is no member I/O axis to admit a remote command on. Building the
plane anyway would put an ungoverned second command authority beside the centre — exactly what A1 forbids.
That reasoning still holds; what it did not anticipate is that the plane is also the product's ONLY creation
entrance.

## Three lawful shapes

| # | shape | cost |
| --- | --- | --- |
| **1** | A centre-governed creation command: give the remote plane a declared axis so the ONE centre admits it (contract change: the v4 member ceiling's frozen `io` set has no such axis) | contract change + a new axis; the honest long-term answer |
| **2** | A non-remote product creation route (an in-process/CLI/host-api entrance that goes through the centre's own admission) | product feature; no contract change |
| **3** | Accept BOOT-CREATED teams only on centre rows (the product already supports a boot-created Team, `root.ts:4888`) and let the D driver bind the v4 blueprint at boot | no product change; MEASUREMENT-ONLY, and it must be stated as a LIMIT: "a centre row cannot create a team at runtime" |

## Recommendation

**3 now, 2 next, 1 as the contract decision.** 3 unblocks the acceptance measurement without pretending the
limitation away; 2 is the product-shaped fix and should be planned; 1 is the contract question that belongs
with the process-lane and settlement-recheck rulings.

## What must not happen

- Do not re-enable the remote plane on centre rows "just for creation": that is the second command authority
  A1 forbids, and it would be ungoverned by construction.
- Do not let the D report say "governance and creation both work" — today they do not, and the 405 is the
  measurement that says so.
