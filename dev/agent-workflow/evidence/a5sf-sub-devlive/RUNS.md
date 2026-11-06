# RUNS — a5sf Subprocess dev-live, 2026-11-06

Eleven Host starts, all under the owner's standing DEV-LIVE authorisation
(`dev-live-grant.json`: scope `DEV-LIVE`, face `Subprocess`, world
`u5a5sfsub1`), all recorded in `driver/run-ledger.jsonl`
(`budget-intent` → harness start → `dev-live-outcome`, `recordClass: DEV-LIVE`).
Every start: one World, one Host, one isolated `DSH_HOME` under `tests/homes/`,
host port from the 3180 family (3183/3185 only), a mock provider on 3492–3495,
teardown verified by re-probing the port and checking the home is gone.
`:3080` and its `DSH_HOME` were never touched; the pinned host tree was never
modified (`git status --porcelain` empty before every start and after the last).
`CORE_PATCH_BUDGET = 0`; no product file edited; nothing merged.

Run-record vocabulary: `PROVEN`/`REFUTED` are the face verdicts in
`probe-report.json`; the run record maps them to `PASS`/`FAIL`. Cases:
`sub:product-bash-executor`, `sub:face-admitted`, `sub:network-deny` (from boot 1)
and `sub:network-deny-bash-lane` (from boot 10).

## Index

| # | start (UTC) | host / mock port | home (`tests/homes/`) | cases | overall | cause when not green |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 10:53:21 | 3186 / 3495 | `u5u5a5sfsub1-20261106T10-53-21Z` | 3 NOT_REACHED | FAIL (abort `discovery`) | driver: chose a title request (0 tools) as the discovery turn → leader surface (0) |
| 2 | 10:55:27 | 3185 / 3494 | `…10-55-27Z` | 3 FAIL | FAIL | product invariant: native module ADDED `sub_probe` to the Member surface → activation refused |
| 3 | 10:57:55 | 3185 / 3494 | `…10-57-55Z` | 1 PASS, 2 FAIL | FAIL | two wrong judge clauses (see below); `overall` bug found |
| 4 | 11:00:17 | 3185 / 3495 | `…11-00-17Z` | 3 PASS | **PASS** | first green |
| 5 | 11:01:30 | 3185 / 3494 | `…11-01-30Z` | 3 PASS | **PASS** | agrees with 4 on every proposition |
| 6 | 11:04:20 | 3185 / 3494 | `…11-04-20Z` | 3 NOT_REACHED | FAIL (abort `composition`) | fixture: `sandbox-policy` override row without `name` disabled the row → `sandboxPolicy` service absent |
| 7 | 11:07:06 | 3183 / 3492 | `…11-07-06Z` | 2 PASS, 1 FAIL | FAIL | new fixture clause `sandbox-root-pinned` false: the session cwd, not the config, sets the root |
| 8 | 11:08:59 | 3185 / 3494 | `…11-08-59Z` | 3 PASS | **PASS** | clause removed, fact recorded |
| 9 | 11:11:05 | 3183 / 3493 | `…11-11-05Z` | 3 PASS | **PASS** | agrees with 8 |
| 10 | 11:15:22 | 3185 / 3494 | `…11-15-22Z` | 4 PASS | **PASS** | adds `sub:network-deny-bash-lane` (PROVEN) |
| 11 | 11:17:02 | 3185 / 3494 | `…11-17-02Z` | 4 PASS | **PASS** | final driver; agrees with 10 |

Teardown for all eleven: `hostPid: null`, `portStillListening: false`,
`homeExistsAfterTeardown: false`, `releasedPorts` lists the host, the mock and the
host again (the duplicate is the lease's own release receipt). No orphan process,
no leftover home, no port held.

**Stable pair: starts 10 and 11** — identical driver bytes
(`sha256(run-boot.mjs) = a05c62cbbcdb092a65333f3c7fcfe61e0e9da74a643045d220d7d3579bf6cd4a`),
identical verdicts on all eight propositions and all four cases. Starts 4/5 also
agreed on seven propositions with an earlier judge revision (before the deny-lane
bash case existed); they are kept as corroboration, not as the pair.

## Per-start detail

### 1 — abort at `discovery`

The Host booted (3186), health was true, `team.create` was fine, but the driver
read the leader's tool surface from the LAST mock request, which was the session
title request (0 tools). It concluded "leader surface (0)" and refused to drive.
Product behaviour: none observed. **Fix:** select the request whose messages carry
`MK_DISC` and non-empty `tools`, fall back to the last tool-bearing request, and
record `surfaceBasis` (the run log now says `basis=discovery-turn (23)`).
Ledger: `budget-intent`, `a5sf-sub-devlive-boot1`, outcome `FAIL`.

### 2 — the native module could not add a tool (correct refusal)

All three delegates were rejected:
`TEAM_RUNTIME_DURABLE_WRITE_FAILED … activation: child-session creation failed …
TypeError: agent-bindings: the configured a5sfNativeToolModules would CHANGE the
Member's model-visible tool surface (added: ["sub_probe"]; removed: []); refusing
to mount the native shadow — a scoped registration is outside the inherited
tools.restrict filter, so a re-mounted tool could re-enable a builtinToolDeny
lane`. That is the product's surface-neutral rule working as designed.
**Fix:** declare `sub_probe` in the PRESET (`driver/sub-probe-stub.mjs`, one preset
row) so the native module only SHADOWS it. **Not a workaround:** the stub answers
`STUB_NOT_SHADOWED` if the shadow ever stops happening, so the run fails instead
of grading a stub.
Ledger: the outcome row was written with `overall:"PASS"` — wrong; corrected
below.

### 3 — two judges were wrong (and one driver bug surfaced)

The probes ran (delegation succeeded, both Members activated). Verdicts:
executor PROVEN, all four argv vectors PROVEN, `face_control` REFUTED,
`net_deny` REFUTED.

- `face_control` was judged on a `/proc` sighting of the allow marker. The
  confined provider runs a launcher and bwrap `--unshare-pid`, so the confined
  child's argv never carries the marker. **Fix:** the vector now writes a marker
  FILE (`touch '<allowMarker>'`, distinct path from the deny marker) and the case
  judges `existsSync(allowMarker)` — an OS fact that does not come from our
  counters.
- `net_deny` was judged on "exactly one guard fact with
  `decidedBy:NETWORK_UNCONFINED_REALM`". Live, that refusal writes **zero**
  facts: it is thrown directly by the network admission after
  `provider.probe()`, not through the guard. **Fix:** the case now requires 0
  facts (recorded as an asymmetry, with the reason), plus the provider's own
  `network-destination:'unsupported'` capability row as the witness.
- The outcome row said `overall:"PASS"` while the run said `FAIL cases=3 FAIL:2`:
  `lease.finish()` hardcoded `'PASS'` whenever the run did not abort. **Fix:**
  overall = every selected case PASS. Two correction rows were appended to the
  ledger (boots 2 and 3) rather than editing history.

### 4 — first green

3/3 cases PASS, 7/7 propositions PROVEN. Ports 3185/3495, home deleted.

### 5 — corroborating green

Identical verdicts to 4 with the `overall` fix in place. Ports 3185/3494.

### 6 — abort at `composition` (fixture defect)

A config-only insert-override row `{id:'sandbox-policy', config:{…}}` REPLACED the
base row, leaving it nameless; the loader disabled it
(`disabling profile plugin row "sandbox-policy": its declared peer dependencies
cannot be validated: Cannot read properties of undefined (reading 'startsWith')`),
`sandboxPolicy` never rose, and `bash-sandbox` / `fs-sandbox` / `permission` /
`ptc-runtime` stayed pending, so the preset could not bind
(`UNRESOLVED persona observation … waiting for fs/shell`). Host booted, health
route never answered, run aborted before any case. **Fix:** restate `name` on the
override row.

### 7 — the pin does not win against a session cwd (new fact)

With the named override row the composition was fine, but the executor case's new
clause failed: the resolved `sandboxPolicy.workspaceRoot` was the **pristine host
tree**, not the World workspace. Reading the resolver
(`tests/deepseek-harness-test-use/packages/sandbox/sandbox-policy/src/index.ts:168`)
showed why: `resolveWorkspaceRoot(session?.header.cwd ?? this.workspaceRoot)` — a
session cwd wins over the config, and the World sets the Team's session cwd to the
host tree. The override row was removed (restoring the byte-identical base
composition), the clause was dropped, and the fact is recorded as
`probe-report.json#executor.deploymentSandbox` and discussed in README §5.
**This is the only start whose red was a fixture expectation, not a product
finding.**

### 8, 9 — pair under judges v3

3/3 PASS, 7/7 PROVEN, identical. Ports 3185/3494 and 3183/3493.

### 10 — the deny-lane `bash` case (the end-state row)

Added `sub:network-deny-bash-lane`: after the face refused `net_deny`, the SAME
`worker-deny` Member called the model-visible `bash` tool. It RAN:
`isError=false`, stdout marker, `shell-exec` `SandboxBashExecutor`, 0 confined
provider calls with that marker, 1 `/proc` sighting, and the deployment sandbox
argv carries **no `--unshare-net`**. 4/4 PASS.

### 11 — pair under the final driver

4/4 PASS, all eight propositions PROVEN, identical to 10 (run-unique tags, pids
and ports aside).

## Ledger corrections (append-only)

`driver/run-ledger.jsonl` carries, after the eleven `dev-live-outcome` rows, two
`dev-live-outcome-correction` rows for runs
`a5sf-sub-devlive-2026-11-06T10-55-27-164Z` (boot 2) and
`a5sf-sub-devlive-2026-11-06T10-57-55-160Z` (boot 3). Both said `overall:"PASS"`
in their moment because of the hardcoded overall; both runs actually FAILED
(2/3 and 2/3 cases). The correction rows name the driver defect, the true verdicts
and the fix (boot 4 onward computes overall from the finalized record). Nothing
was rewritten.

## Escalation check

Three consecutive same-cause failures with no new diagnostic fact ⇒ stop and
escalate. It did not happen: starts 1, 2, 3, 6 and 7 failed for five DIFFERENT
reasons and every one produced a fact that changed the driver (surface selection,
the surface-neutral invariant, the launcher/marker witness, the fact asymmetry and
the `overall` bug, row-replacement semantics, session-cwd precedence). The longest
same-cause streak was one.

## Budget actually spent

11 Host starts (2 of them aborts before any case), ~35 s of Host runtime each,
~25 min wall clock including diagnosis; 11 Worlds created and deleted; 0 product
files modified; 0 core patches; 0 merges. Ports 3183/3185 reused across starts
through the machine-wide 2-slot lease; the mock never reused a port concurrently.
