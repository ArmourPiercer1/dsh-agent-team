# Round 91 — `d:remote-creation` red: reproduction, mechanism, fix

Worktree `.worktrees/vnext-a1-cut` · branch `vnext/a1-cut` · **HEAD `b67a3eb38d617b2aa7dbe0cddd2fb9f2a49e334f`**
· pinned host `0.2.0-rc.2` @ `639ed015397290b3745d163aafe02ffee4aa3f84` · DEV-LIVE, not candidate evidence.
Sole writer; no other worktree, no history rewrite, `:3080` and its DSH_HOME untouched.

The question was the round-90 red at
`dev/agent-workflow/evidence/ute-a1/round90/drivers-before.log:27`:
`run-boot.mjs --boots 1` → `overall=FAIL`, `5 PASS / 1 FAIL`, `d:remote-creation` FAIL.

## 1. Reproduction (real driver, unmodified tree)

```
$ node tests/world-factory/drivers/d-boot-feasibility/run-boot.mjs --boots 2
[2026-11-23T09:51:11.049Z] RUN-SUMMARY ... overall=FAIL cases=6 FAIL:1 PASS:5
[2026-11-23T09:53:50.116Z] RESULT FAIL (2/2 boots; agreeing pair=true)
EXIT=1
```

Log: `round91/repro-run-boot.log`. Both boots agreed; both leased **port 3194** (mock 13056), i.e. the
same port the round-90 log recorded. The case's own diagnostics (not the verdict line) name exactly one
failing clause:

```
"id": "no-execution-without-admission",
"ok": false,
"detail": "member.send ok=undefined code=undefined provider requests added=0"
```

and the same boot's `remote-creation.json` measured this product answer:

```json
{"rootWork":{"status":200,"code":"ADMISSION_REMOTE_UNAVAILABLE","ok":false},
 "rootLive":{"status":200,"code":"ADMISSION_REMOTE_UNAVAILABLE","ok":false},
 "delivery":{"status":200,"code":"TEAM_RUNTIME_ACTION_ADDRESSING_REJECTED","ok":false,"servedNotRefused":true},
 "mockRequestsAdded":0}
```

The other seven clauses were `ok:true` (401 unauthenticated / no Team minted / `TEAM_REMOTE_FOREIGN_TEAM`
/ runtime `team.create` 200 `path:"fresh-root"` / runtime root created / duplicate mints no second Team
/ duplicate adds 0 provider requests). The pre-fix artefacts are preserved in
`dev/agent-workflow/evidence/d-boot-feasibility/archive/2026-11-23T09-54-52-433Z/boot0{1,2}/`.

## 2. The mechanism — a stale driver judge, not the product

`judgeRemoteCreation()` still read the **pre-round-83** flat refusal shape:

```js
ok: execution.ok === false && execution.code === 'ADMISSION_REMOTE_UNAVAILABLE' && execution.mockRequestsAdded === 0
```

Round 83 (`5c09cbd82`, 2026-11-23T02:22:36Z) changed the sample's shape in `run-boot.mjs` to the new
delivery-law classification — `{rootWork, rootLive, delivery, mockRequestsAdded}` — but did not update
that clause. `execution.ok` and `execution.code` are therefore `undefined`, and
`undefined === false` is `false`, so the clause can never pass regardless of what the product does.
The driver's own inline guards (which *do* read the new shape and passed) are why the boot never
aborted: the sample was fine, only the judge's reader was stale.

Evidence chain, all at the same clause id:

| run | sample shape | clause | verdict |
| --- | --- | --- | --- |
| `archive/2026-11-22T14-50-21-474Z` (pre-`5c09cbd82`) | flat `{status:200, code:"ADMISSION_REMOTE_UNAVAILABLE", ok:false, mockRequestsAdded:0}` | `member.send ok=false code=ADMISSION_REMOTE_UNAVAILABLE …` → true | **PASS** |
| `archive/2026-11-23T09-54-52-433Z` (this HEAD, pre-fix) | nested `{rootWork, rootLive, delivery, …}` | `member.send ok=undefined code=undefined …` → false | **FAIL** |
| `runs/boot0{1,2}` (this HEAD, post-fix) | identical nested sample | `rootWork ok=false code=…; rootLive ok=false code=…; delivery status=200 ok=false code=TEAM_RUNTIME_ACTION_ADDRESSING_REJECTED servedNotRefused=true; provider requests added=0` → true | **PASS** |

`git show 5c09cbd82 -- tests/world-factory/drivers/d-boot-feasibility/run-boot.mjs` contains the shape
change and no change to `judgeRemoteCreation`; `git show 5c09cbd82^:…/run-boot.mjs` shows the clause was
already the flat one before that commit. The red is therefore a **refactor defect introduced by round 83's
driver edit**, exposed — not caused — by round 90.

## 3. The four suspects, each settled

**(a) Port/home collision from the D4 probe's bands — REFUTED.**
- There is no per-probe band. `tests/paths.mjs#HOST_PORT_BANDS` is one global legacy band `3181-3199`;
  `WorldFactory` leases a port through `port-lease.mjs#acquirePortLease` (exclusive token claim + bind
  probe). The round-87 D4 README's "port 3194/3195" is an **observation of the ports its boots happened
  to lease**, not a declaration or reservation; the probe calls `harness.createWorld()` with no port
  preference (`probe-d4-routed-wake.mjs:921`, `:1159`). "D4 claimed a production band" is not true of the
  code, and no probe can be shown to hold a port another live probe leases.
- The decisive run-time fact: **the same port 3194** produced FAIL before the fix (2/2 boots) and PASS
  after it (2/2 boots), with the identical product answer. A port collision cannot flip a shape-reading
  boolean that never sees the port.
- The create response itself proves the request reached *this* world's host: the durable
  `teamSession.defaultWorkspace` is `…/tests/homes/u5u5a5sfdev1-20261123T09-48-33Z/workspace`, this
  boot's own home.
- Home collision is guarded: `world-factory.mjs` bumps the one-second stamp up to 5 s when a home already
  exists and refuses after that; both boots used distinct homes (`…09-48-33Z`, `…09-51-11Z`).
- Why 3194 (and not 3181) was leased, stated exactly: the shared lease root
  `…/.artifacts/tmp/port-leases/3193.lease` still carried a claim from 14:32 whose pid lives in another
  PID namespace; `port-lease.mjs` classifies that as `unknown` (never "dead") and honours it until
  `DEV_LIVE_SLOT_TTL_MS` (4 h), so 3193 was legitimately unavailable and 3194 was the first free host
  port. That is the lease working as designed, not a collision — and the proof above (same 3194, FAIL
  before / PASS after) removes the port from the causal chain entirely.

**(b) A round-90 decomposition defect — REFUTED.** `bde902939` touched no driver source (only the two
round-90 `drivers-*.log` evidence files). Round 90's own before/after pair recorded the same FAIL in both
runs, which is behaviour identity, not a break. The offending edit predates round 90 by 7 commits.

**(c) A product regression from rounds 83–89 — REFUTED.** The product answer is identical in the FAIL and
PASS runs and is exactly round 83's contract: both ROOT agent-execution commands stay refused with
`ADMISSION_REMOTE_UNAVAILABLE` (`ok:false`), `member.send` is SERVED as work-delivery with a typed
`TEAM_RUNTIME_ACTION_ADDRESSING_REJECTED` (the addressed member does not exist on this row) and adds
**zero** provider requests. `team.create` returned 200 and minted `session-dboot-read-team`. Nothing in
the product changed between the two runs; only the judge changed.

**(d) A flake in the driver's sequencing — REFUTED.** The failure is deterministic: 2/2 identical boots
before, 2/2 identical after; `agreeing pair=true` in both runs. No timeout was widened and no retry was
added.

## 4. The fix (right layer: the judge, not the product)

`tests/world-factory/drivers/d-boot-feasibility/run-boot.mjs#judgeRemoteCreation` now judges the shape
the driver actually measures. The clause keeps its id and is **strictly stronger** than the old one:

- the two ROOT agent-execution commands must both be `ok:false` + `code:"ADMISSION_REMOTE_UNAVAILABLE"`;
- the delivery command must be HTTP 200, served (not `ADMISSION_REMOTE_UNAVAILABLE`), `ok:false` with a
  **typed** non-empty code (the addressing rejection this member-less row must produce);
- provider requests added must be **0**.

The judge's proposition text was corrected to state the round-83 delivery law. No timeout, retry, skip,
assertion drop or product change. No compatibility shim: the sample has one shape and the judge reads it.

After the fix, the same command on the same HEAD reads:

```
[2026-11-23T09:57:18.382Z] [boot1] case d:remote-creation: PASS
[2026-11-23T09:59:44.261Z] [boot2] case d:remote-creation: PASS
[2026-11-23T09:59:44.481Z] RESULT PASS (2/2 boots; agreeing pair=true)
EXIT=0
```

both boots on port 3194. Log: `round91/after-run-boot.log`.

## 5. What this does and does not prove

**Proved:** the red was a stale judge reading a removed sample shape; the product path (create, boundary,
delivery, zero execution) was healthy throughout; the fix makes the judge pass on two agreeing boots at
the same port/home conditions that produced the red.

**Not proved / disclosed:** the judge still measures a scripted-mock row with a per-DSH_HOME operator
(round 74/83 scope, unchanged); `delivery.ok:false` is asserted because this probe addresses a member
that does not exist — a probe targeting a real member would need its own clause. The D4 `d4:routed-wake`
REFUTED state is untouched (known open gap, §10 G1/G2). The claim is about the acceptance instrument;
no C row moves.
