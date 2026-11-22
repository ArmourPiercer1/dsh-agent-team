# ESCALATION — a centre-configured row has no runtime team-creation entrance

**Raised:** round 59 (D-stage boot run). **Class:** a product capability is unreachable because of a refusal
this cut made on purpose; the fix is a ruling, not a patch.

> **STATUS: RESOLVED (round 74).** Owner ruling `docs/reviews/20261122-1536.txt` §3 (裁决三) picked a shape
> that is NOT one of the three below: restore S6 Remote as a **governed management control plane**, reusing
> the existing Principal + TeamDomain + Control + creation/start gates, and refuse any S6 command whose
> actual effect is agent-tool execution. Options 2 and 3 are rejected as the product answer. The resolution,
> implementation map and the measurements that prove it are in the final section; the original escalation
> text is kept verbatim below as the historical record.

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

---

# RESOLUTION (round 74, 2026-11-23) — a governed management control plane, not a second executor

Owner ruling: `docs/reviews/20261122-1536.txt` §3 and 裁决三. The ruling rejects the "just re-enable it"
reading of the bullet above **and** the premise that team creation needs a Member I/O axis. It separates two
questions the cut had merged:

| authority | sole duty |
| --- | --- |
| TeamDomain / ControlService | who may create / manage / approve / terminate a Team or Member |
| Blueprint / Member Policy | identity, tool-execution authorization, resource ceilings |
| **UTE Admission** | **only whether THIS agent's THIS tool call may run** |
| Provider / OS Sandbox | bounds |
| Settlement | what happened, with evidence |

The escalation's own table already puts "用户通过 Web 创建 Team" under *S6 Principal + Team 创建权限与治理门禁*,
not under UTE. The round-55 refusal was therefore correct to stop the S6 plane from becoming an **execution**
authority, and wrong to remove the whole **management** plane (which was also the product's only runtime
creation entrance). "One centre" means *one operation cannot obtain contradictory execution authorization by
different paths*, not *every management request must first pretend to be an agent tool call*.

## Decision

1. **Restore the S6 Remote plane on a centre-configured row** as an authenticated management control plane:
   `root.ts` always builds `createS6RemoteSurfaces`; `host.ts` mounts the registration when the seam is
   `installed` (its `skipped` branch is retained for compositions that genuinely have no S6 plane).
2. **Classify every S6 command by its ACTUAL EFFECT, in ONE closed place**
   (`packages/runtime/src/plugin/s6-command-classification.ts`):
   - `control-plane-read` / `control-plane-creation` / `control-plane-management` → served, subject to the
     existing server-derived Principal (`s6-principal.ts`), TeamDomain ownership/authority and the existing
     creation/start gates (`createAndStartTeam()`).
   - `agent-execution` → **REFUSED** before params/handlers with the existing host-surface vocabulary
     (`ADMISSION_REMOTE_UNAVAILABLE`, axis `team.control`), durable fact + `REFUSED`/`not-started`
     settlement. The refused set is pinned literally: `team.admitInitialWork`, `team.ensureRootLive`,
     `member.create`, `member.send`, `member.followup`.
   - A command NOT in the table is **not** default-allowed: `isS6ControlPlaneCommand` returns false and the
     dispatcher refuses it; a test compares the table with `REMOTE_METHOD_NAMES` in BOTH directions.
3. **No admission-duty expansion**: `admission.ts` is untouched, no new axis, no Team-creation admission
   path, and no member admission on the management route. Creation authority is answered where it already
   was: the S6 principal + TeamDomain + `createAndStartTeam()`.
4. **Honest scope of the principal**: a per-DSH_HOME authenticated operator (the host's Connection Gate), not
   multi-user RBAC. This resolution does NOT claim user-level identity isolation.

## Implementation map

| concern | file |
| --- | --- |
| closed effect table + lookups + unclassified detection | `packages/runtime/src/plugin/s6-command-classification.ts` (new) |
| per-command guard (after method recognition, before envelope/params), threaded through registration/surfaces | `packages/runtime/src/plugin/s6-remote.ts` (`refuseExecutionCommand`) |
| always build the S6 surfaces on a centre row; record the refusal via the existing point | `packages/runtime/src/plugin/vnext/root.ts` |
| refusal wording (per-command subset; code/axis/subject unchanged) | `packages/runtime/src/plugin/vnext/host-surface-refusal.mjs` |
| wire vocabulary for the typed refusal | `packages/remote/src/handlers/dispatch.ts` (`ADMISSION_REMOTE_UNAVAILABLE`) |
| mount only when `installed` (both states) | `packages/runtime/src/plugin/host.ts` |

`team.create` and `handoff.create` run the SAME `createAndStartTeam()` primitive. The created Member runs
with its OWN compiled Binding and its OWN centre ledger: the management request never carries a member
Binding, and the created Team's turns are admitted by the centre in-process.

## Measurements

- `packages/runtime/test/vnext-admission.test.mjs` **ADM-86** (rewritten, stronger): classification equals
  the frozen catalog both ways; a new/unclassified command is REFUSED (no default-allow); the governed
  dispatcher serves `catalog.list`, refuses `member.send` with the typed code before any port, and the
  refusal has a durable fact (`team.control`) + `REFUSED`/`not-started` settlement; an unauthenticated
  principal context is refused (`TEAM_REMOTE_PRINCIPAL_INVALID`) before the guard/ports.
- `packages/runtime/test/a3p4-pr4-production-entry-regression.test.ts` **E3**: the real production root on
  a `centreStatePath` row has `remoteHandlerRegistration.installed === true`, serves `catalog.list`, refuses
  all five agent-execution commands with `ADMISSION_REMOTE_UNAVAILABLE`, and writes an
  `invocation-authority` fact for each on the row's own durable ledger.
- Live driver `run-boot.mjs --boots 2` (remote creation path restored): see `D-BOOT-FEASIBILITY.md` /
  `D-ACCEPTANCE-REPORT.md` for the measured `d:remote-creation` verdict (unauthenticated refused and mints
  no Team; cross-team `TEAM_REMOTE_FOREIGN_TEAM`; runtime `team.create` succeeds; duplicate mints no second
  Team and adds no provider request; `member.send` is refused with zero provider requests).

## What remains NOT proven / out of scope

- This is not user-level RBAC (per-DSH_HOME authenticated operator; see above).
- Process-lane authorization (裁决一) and the settlement recheck (裁决二) are separate rounds.
- `handoff.create` is classified as control-plane creation, but only `team.create` is exercised live by the
  D driver; `handoff.create` inherits the same creation gate in code, not in this round's live evidence.
- No claim is made that every historical S6 command was individually re-audited beyond the closed effect
  table; the table is the audit point, and the refused set is the deliberately conservative reading.

