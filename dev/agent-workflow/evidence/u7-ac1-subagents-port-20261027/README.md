
## Boot-3 conclusion

Boot 3 was the final authorized boot (3/3), run `u7ac1-c2-mvr2f2jx`, team SHA `2f51cf81`, Host `639ed01539`, port `3184`; the Host mounted and teardown removed the world/home. C2 overall is **FAIL**, with all 11 cases fail-closed because `team.create` could not start the root. The exact typed error in `c2/c2-verdicts-boot3.json:36-44` is:

`tools.restrict() cannot name reserved PTC mode presentation transport "run_code"; restrict end-capability tools instead`

This disproves the initial fixture fix of putting `run_code` into `builtinToolDeny`: the alpha2 coverage gate was correctly satisfied far enough to invoke the host restriction layer, which then rejects the reserved PTC transport name. This is not a reason to weaken the coverage gate and no product code was changed. The final fixture diagnosis is two-part:

1. Boot 2 exposed the unmanaged `run_code` coverage gap; leaving it omitted is invalid for a strict permissions-bearing template.
2. Boot 3 proves the current AC-1 world also cannot deny `run_code` through `builtinToolDeny` when the PTC presentation is on that same strict template. A fixture-only resolution must keep the PTC root on a legacy/non-permissions template (or otherwise keep the PTC transport off the strict template) while retaining strict coverage on the native member template; that requires a future authorized attempt and was not run because the boot budget is exhausted.

Per lane instruction, no boot 4 is attempted. This lane therefore cannot claim C2 PASS or update acceptance rows.


## Main-agent ruling 2026-10-27 (boot budget extension)

Boot 2 + boot 3 together are live evidence that a STRICT (capabilities.permissions) caller with PTC presentation cannot be created at host pin 639ed01539: unmanaged `run_code` fails the alpha2 coverage gate (boot 2), and `builtinToolDeny: [run_code]` is rejected by the host because run_code is the reserved PTC transport (boot 3). Both are fail-closed refusals one layer ABOVE the agent-control family. Therefore:
1. Remove the PTC presentation (`@deepseek-ai/dsh-agent-tool-presentation` mode both) from the AC-1 root/leader preset; the world becomes native presentation on both presets. Remove `run_code` from the fixture deny computation (it must not be on the surface any more; if it still appears in discovery, the run must FAIL at mounted — never deny or ignore it silently). Keep the coverage gate untouched.
2. The `ac:refusal-ptc` case is REMOVED from the live case set. Its coverage is re-grounded as: (a) the family's C1 test for `agent-control-child-ptc-refused` (cite the existing test, or add one if missing, with RED/GREEN), and (b) the live boot-2/boot-3 records as evidence that a strict PTC caller cannot be mounted at this pin. The ledger must NOT claim a live PTC refusal; disclose it.
3. Boot budget extended by the main agent: 2 additional boots (boot 4 and boot 5), disclosed as OVER the original budget of 3 in boot-budget.jsonl and README. Use boot 5 only if boot 4 fails for a reason you fix in between; never boot 6.

Offline C1 update: root and member are native; reserved `run_code` is excluded from deny computation and discovery fails closed.


## Boot-4 diagnosis

Boot 4 was authorized as the first extension boot and the native fixture mounted successfully; pilot1/pilot2/leader all completed and the host remained clean. The run was recorded FAIL only because the evidence driver referenced `AGENT_CONTROL_MANAGED_NAMES` without importing it, causing verdict finalization to fail closed after live execution. This fixture-level driver defect was corrected in commit 43129a619; boot 5 is authorized as the sole retry.
