# U4/U5 Independent Security-Test Review — Final G1-F Round 2 + G3

## Verdicts

G1-F: 投机通过
G3: 投机通过

## G1-F findings

1. **Chosen next()-guard is sound against pinned Host dispatch.** The approved branch verifies the scoped `ctx.tools.get()` identity, arms the watcher signal, and calls `next()`; it does not invoke a body directly (`dev/agent-workflow/evidence/u4-g1f-sup-a-20261025/g1fa-plugin.mjs:221-293`). Pinned Host then performs the fused-signal pre-body abort, late resolve, `bodyInvoked`, body call, settlement, and signal restoration (`tests/deepseek-harness-test-use/packages/core/tools/src/index.ts:1564-1591`). The 42-cell run covers pre-abort, in-body abort, signal restore, in-window swap, post-execute replacement/block, finalizer/projector capture, scheduler race, and nested parent-token dispatch (`dev/agent-workflow/evidence/u4-g1f-sup-a-20261025/runs/g1fa-2026-10-25T14-29-16Z/summary.json:77-145`).

2. **Round-1 oracle defect is actually fixed, not merely claimed.** `legsOkFor()` now requires exact expected leg rows and rejects unexpected/absent rows; exact settlement classes and marker sets are asserted (`dev/agent-workflow/evidence/u4-g1f-sup-a-20261025/g1fa-run.mjs:290-344`, `dev/agent-workflow/evidence/u4-g1f-sup-a-20261025/README.md:81-99`). The primary run reports 42/42 and `global_markers_exact=30` (`.../summary.json:17-27,185-191`).

3. **SUP-B self-dispatch evidence is acceptable only as feasibility evidence, not as chosen product design evidence.** Its README explicitly discloses the old form (`dev/agent-workflow/evidence/u4-g1f-sup-b-20261025/README.md:30-42`), while SUP-A provides the selected next()-form Host-equivalence proof. This is sufficient for route credibility by mechanism group; U6 must not reuse SUP-B's self-dispatch implementation.

4. **PoC-4b remains a real conditional gap.** The alpha admitted→served positive control is false; only beta proves the same code path, and the evidence explicitly says another Host start is required (`dev/agent-workflow/evidence/u4-g1f-sup-b-20261025/runs/g1fb-2026-10-25T14-34-41Z/summary.json:137-164`, `.../README.md:171-180`). Carrying this as a U7 condition is acceptable for G1-F feasibility, but U7/MCP delivery cannot claim closure until alpha (or equivalent second dynamic source) is run positive.

5. **`surface:domain_family` is an acceptable named blocker, not a seam failure.** SUP-C records 21 credible routes plus exactly one named blocker because neither obligations side enumerates a domain family; owner, reopen condition, and non-coverage are explicit (`dev/agent-workflow/evidence/u4-g1f-sup-c-20261025/SUMMARY.md:9-17`). It must remain blocked until user scope/registry enumeration ruling; it must not be counted as covered.

6. **Residual composition trust is correctly carried into U6.** The guard assumes center-owned approval tables and first-precedence/closed composition; the plugin catches watcher exceptions but cannot itself prevent a later prepended listener (`dev/agent-workflow/evidence/u4-g1f-sup-a-20261025/g1fa-plugin.mjs:183-200`, `.../README.md:164-185`). This is a design condition, not evidence of a current Host seam blocker.

### G1-F carried conditions / risk ledger

- U6 must enforce closed composition membership, no later prepends for governed events, center-owned generation-bound approval tables, and explicit bind/unbind.
- PoC-4b alpha-positive dynamic-source cell must be rerun before MCP U7 closure; until then MCP remains CONDITIONAL.
- `surface:domain_family` remains NAMED-BLOCKER pending user/ROOT scope and enumerable registry decision.
- PTC `run_code` transport was not mounted; nested parent-token dispatch is the demonstrated shared-funnel proxy (`.../README.md:203-218`).
- PoC-6 proves fixture/session governance and zero effects, not full Team blueprint scoping; that remains U6 integration work.

## G3 findings

1. **Only one Host launcher is used.** `TestWorldFactory.startHost()` constructs the shared `DshInstance` launcher (`tests/world-factory/lib/world-factory.mjs:365-429`), with no replacement Host launcher in the canary/supervisor.

2. **Cleanup is ownership constrained.** World deletion requires a matching `.u5-created.json` marker (`tests/world-factory/lib/world-factory.mjs:507-525`); crash reclaim kills only recorded PIDs whose `/proc/<pid>/environ` proves the World DSH_HOME, and refuses unverifiable/recycled PIDs (`.../world-factory.mjs:539-577`). Port leases use O_EXCL, live-holder refusal, stale reclaim, and external-bind refusal (`tests/world-factory/lib/port-lease.mjs:90-145`).

3. **:3080 is read-only and not touched by teardown.** The only stable-instance operation is a GET probe (`tests/world-factory/lib/world-factory.mjs:108-120`), and both live records report status 401 before/after (`dev/agent-workflow/evidence/u5-g3-20261025/run-core-r3.json:187-205`, `.../run-u5-parallel-recon-2026-10-25T13-52-30-200Z.json:79-101`).

4. **Verdict vocabulary is fail-closed.** `overallVerdict()` folds worst severity, missing selected cases become FAIL, and summary/exit code can emit PASS only for all-PASS cases (`tests/world-factory/lib/run-record.mjs:19-45,97-140`). The negatives record START_FAILED/TIMEOUT/other non-PASS classes without laundering them (`tests/world-factory/README.md:40-53`).

5. **Oracle is independent and sensitive to planted faults.** It requires marker + body ledger evidence + live owned host PID and ignores the tool return for the sound path (`tests/world-factory/lib/oracle.mjs:104-130`). The real core record shows planted defect `soundOracleEffect:false` and blinded divergence (`dev/agent-workflow/evidence/u5-g3-20261025/run-core-r3.json:101-128`).

6. **Parallel non-interference is evidenced, but live crash-reclaim was not exercised.** A completed before the kill and B's kill receipt was `alreadyExited`; reconstruction correctly preserves `abnormal-kill-reclaim=SKIP`, while the offline crash simulation passes through the identical `reclaimWorld` path (`dev/agent-workflow/evidence/u5-g3-20261025/run-u5-parallel-recon-2026-10-25T13-52-30-200Z.json:27-58`). This is honest and not a false PASS, but leaves a residual live crash timing risk.

7. **G3 evidence binding is sufficient for the requested G2 baseline.** Run records bind `teamSha=3288567d3...` and Host `639ed015...`; the evidence manifest identifies PR #368 and its branch, while the run SHA is the G2-final merged-base SHA (`dev/agent-workflow/evidence/u5-g3-20261025/run-core-r3.json:14-27`, `.../manifest.json:123-140`). The PR being listed as unmerged in the manifest is a disclosure about evidence production, not a false claim that it was the G2 baseline.

### G3 carried conditions / risk ledger

- Keep the live abnormal-kill case as SKIP; do not relabel it PASS. A future G3 rerun should attempt a slower/held canary to exercise actual mid-run crash reclaim if budget permits.
- Revalidate the run bindings after PR #368 is merged: the final G3 acceptance record should point to the merged Team SHA plus the same pinned Host/profile/authority digests; any changed input requires rerun.
- Windows descendant process-tree cleanup remains ENV_BLOCK by explicit design; Linux evidence must not be generalized to Windows.
- Fresh-home metadata-contributor disablement is a disclosed public-config workaround, not a product fix (`dev/agent-workflow/evidence/u5-g3-20261025/FINDINGS-request-extension.md:17-48`).
