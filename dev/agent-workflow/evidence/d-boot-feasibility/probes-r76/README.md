# Round 76 — cross-world probes of the other two boot drivers

The governed preset changed in round 76 (top-level `tool-bash-persistent` row, which injects
`terminals`). The D1 and D2 worlds compose the SAME preset, so they were probed before and after
their worlds composed the deployment half (`@deepseek-ai/dsh-terminal`, no backend).

| probe | command | verdict |
| --- | --- | --- |
| `d1-before-terminals.log` | `node tests/world-factory/drivers/d-boot-feasibility/run-boot.mjs --boots 1` | **FAIL** — `delegate call=true result={"status":"rejected","code":"TEAM_RUNTIME_DURABLE_WRITE_FAILED","message":"activation: child-session creation failed for member 'inst-0e23ryd1fmn2': RemoteError: tool-bash-persistent (@deepseek-ai/dsh-tool-bash-persistent): waiting for terminals"…}`, `RESULT FAIL`, exit 1 |
| `d1-after-terminals.log` | same | **PASS**, exit 0 (`agreeing pair=false` is expected for `--boots 1`) |
| `d2-before-terminals.log` | `node tests/world-factory/drivers/d-boot-feasibility/run-boot-d2.mjs --boots 1` | **FAIL** — `FAILED at multi-member-delegate: Error: a member first turn never closed: A1=false B1=false` (the same refused activation: both member creations never produced a first turn), `RESULT FAIL`, exit 1 |
| `d2-after-terminals.log` | same | **PASS**, exit 0 |

Both failures are the measured consequence of the deployment requirement documented in
`cordis.patch.yml` beside the persistent row and in `CAPABILITY-MATRIX-C.md` MEASURED (round 76): a
preset row whose injected service is absent is not dormant — it refuses the whole preset.

The tracked `runs/` evidence of D1/D2 was NOT overwritten by these probes (the round-74 two-boot
evidence is preserved); only these logs are added.
