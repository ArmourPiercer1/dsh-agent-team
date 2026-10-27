
## Boot-3 conclusion

Boot 3 was the final authorized boot (3/3), run `u7ac1-c2-mvr2f2jx`, team SHA `2f51cf81`, Host `639ed01539`, port `3184`; the Host mounted and teardown removed the world/home. C2 overall is **FAIL**, with all 11 cases fail-closed because `team.create` could not start the root. The exact typed error in `c2/c2-verdicts-boot3.json:36-44` is:

`tools.restrict() cannot name reserved PTC mode presentation transport "run_code"; restrict end-capability tools instead`

This disproves the initial fixture fix of putting `run_code` into `builtinToolDeny`: the alpha2 coverage gate was correctly satisfied far enough to invoke the host restriction layer, which then rejects the reserved PTC transport name. This is not a reason to weaken the coverage gate and no product code was changed. The final fixture diagnosis is two-part:

1. Boot 2 exposed the unmanaged `run_code` coverage gap; leaving it omitted is invalid for a strict permissions-bearing template.
2. Boot 3 proves the current AC-1 world also cannot deny `run_code` through `builtinToolDeny` when the PTC presentation is on that same strict template. A fixture-only resolution must keep the PTC root on a legacy/non-permissions template (or otherwise keep the PTC transport off the strict template) while retaining strict coverage on the native member template; that requires a future authorized attempt and was not run because the boot budget is exhausted.

Per lane instruction, no boot 4 is attempted. This lane therefore cannot claim C2 PASS or update acceptance rows.
