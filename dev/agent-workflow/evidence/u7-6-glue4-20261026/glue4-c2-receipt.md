# U7-6 GLUE-4 — C2 live receipt (arc-a world, run1 — FIRST boot, all legs green)

Run `u5-u6-arc-a-u76r1-2026-10-26T11-57-28-224Z` · world `u5u76r1-20261026T11-57-28Z` ·
port 3183 (leased, released; verified unbound after) · host log sanitized + raw
stash per `SANITIZATION.json` · **RUN-SUMMARY overall=PASS cases=10 PASS:10**.

Boot budget: **1 of 4 used** (`budget-live.jsonl`, cap `--max-host-starts 4`).
HTU before AND after: `639ed01539`, porcelain 0. `:3080` untouched (never addressed).

## The three legs that were red since run8 — verdicts from DISK facts (RUN record), not tool returns

| leg | verdict | disk evidence (u6arcaDigest) |
| --- | --- | --- |
| `arca:search-grep-live` | **PASS** | `grepResults=[{ok:true, claimsFound:["g1"]}]` — governed `team_grep` found the g1 claim in the fixture over the REAL rg row anchored at the governed root |
| `arca:search-glob-live` | **PASS** | `globResults=[{ok:true, enumHasG3:true, gitDecoyExcluded:true}]` — the confined-rg glob row (arc-a now mounts the landlock trio — the glob row has NO non-confined implementation) enumerated the unicode-named file and excluded the `.git` decoy |
| `arca:search-refusal-zero-effect` | **PASS** | `refusalResult={refused:true, outsideRootCodeSeen:true, admissionRefused:false, censusUnchanged:true, refusalSample:"a5p5-refused kind=backend-failed code=target-outside-governed-root detail=the target lexically escapes the governed root"}` — the `/etc` call now passes the PA face (its envelope is met) and is refused by the BACKEND's own anchor law before any spawn; `admissionRefused=false` is the proof the IO_POLICY story is over on this leg, `censusUnchanged=true` is the zero-effect law |
| `arca:native-grep-control` | **PASS** | `ctlResult={ok:true, claimFound:true}` — the un-governed ctl path still works (control, not assurance) |

Probe-family legs (`arca:mounted`, `arca:probe-positive`, `probe-unbound-…`,
`probe-replay-…`, `probe-unload-settles`) all PASS — the confined-trio mount and the
greper grant changed nothing about the probe family's kernel behavior
(`mount-REFUSED=0`, `placement-REFUSED=0`, lanes exactly as booked).

## Host-log law check (sanitized log, grep counts)

* `IO_POLICY_UNSUPPORTED`: **0** sites (was 3 wire refusals in run8)
* `kind=refused-admission`: **0**
* `target-outside-governed-root`: **1** (the refusal leg, backend-failed, zero spawn)
* placement line: `rows=[team_grep,team_glob,team_bash,read] realm=u6arca-realm-u5u76r1-20261026t11-57-28z`

## What the greper template carries live (least privilege, from the blueprint in the world)

`default: deny`, `ask: []`, `deny: []`, and ONE allow rule:
`{tool: read, resource: {kind: exact, path: <governed root>}}` —
with the plane-mounted class law (`invokeClasses: {grep:[read], glob:[read]}`) this
rule covers exactly the anchored walk envelope (list+read@root, tool-invoke by class
ride) and nothing else. Blinded policies (empty / elsewhere / whole-tool-any) were
proven OFFLINE to keep refusing (`glue4-post-fix-receipt.md` P1/P5/P6) — the harness
did not need extra boots to show the teeth.
