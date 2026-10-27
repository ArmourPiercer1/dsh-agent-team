# U7 AC-1 agent-control/subagents port

## Boot-2 diagnosis (written before fixture change)

Boot 2 reached the Host and mounted the Team remote, but `team.create` failed at the root-agent permission Coverage Gate. The committed record `c2/c2-verdicts-boot2.json:36-46` reports the exact typed failure:

`TEAM_REMOTE_TEAM_CREATE_ROOT_START_FAILED` → `alpha2-permission-coverage-unmanaged-tools`: `run_code (unknown-unmanaged)` on the final model-facing surface. The same record's discovery surface at `:154-177` includes `run_code`; `c2/host-boot2.log:1-5` proves this was a mounted Host run, not an environment failure. The failure is therefore fixture/world-level, not an agent-control product failure.

The AC-1 C2 runner deliberately exempted `run_code` from the computed `builtinToolDeny` list (`c2/run-c2.mjs`, the discovery filter immediately before `assembly.writeMainBlueprint`). That exemption was copied from the PTC presentation rationale, but it leaves the host-reserved PTC transport unmanaged when the strict AC-1 blueprint is created. The other governed fixtures compute `builtinToolDeny` from the live surface and do not exempt this unmanaged host name; the coverage gate is intentionally fail-closed and must not be weakened.

**Exact fixture fix:** keep the AC-1 family names and `todo_write` as the only non-denied names, but remove `run_code` from the runner's exemption list. The resulting `denyList` writes `run_code` into both strict AC-1 templates' `capabilities.builtinToolDeny`, so the final model-facing surface is coverage-complete while the Tier-A subagent route remains fail-closed for any PTC caller. No `packages/**` product semantics or coverage-gate behavior are changed.

Boot-2 evidence was committed first in commit `f69873e95`; all files are below 1 MiB. Boot budget remains 1/3 and 2/3 consumed; boot 3 is the final authorized live attempt.
