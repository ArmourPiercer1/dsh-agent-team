
## Final boot-7 conclusion (supersedes prior budget conclusions below)

**FAIL; PR #418 stays DRAFT; no boot 8.** Run `u7ac1-c2-mvr783ml`, product/driver `64ca32738354e1709cdd80844d0d4df7f216a81e`, pristine Host `639ed01539`, leased port 3184. All ten selected cases are FAIL (missing verdict, fail-closed), not evidence of a family refusal or positive effect. Boot 7 is the fourth boot over the original cap 3, explicitly authorized exactly once. Home removed; ports 3184/3498 released; Host baseline/porcelain unchanged (record lines 143–163). The ledger is unchanged: no new L2/L3/L4 PROVEN claims.

### Precise two-sided diagnosis

At the booted commit, `c2/run-c2.mjs:182–186` destructured injected IO defaults using names that were immediately redeclared locally. With live `io = {}`, evaluating `fetchJsonRetry: http = fetchJsonRetry` entered that local binding's temporal dead zone. Record `c2/c2-verdicts-boot7.json:140–142` contains the exact ReferenceError and both caller frames (drive:183, main:138). The opposite side is `c2/dryrun-fixtures.mjs:56–96`: the fake provided **every** IO key, so no default expression ran. This is a new runner defect, not a Host seam failure and not a product result mismatch. Offline RED/GREEN is valid for the injected path but insufficient for the absent-override path. Postmortem repair captures LIVE_IO outside drive and merges overrides without self-shadowing; **not live validated**, no additional boot. No evidence was retroactively promoted.

### Preboot evidence and remaining disclosure

`c1-dryrun/` records old-face RED (four intended positive failures), current GREEN (10/10), and mutated provider refusal RED; recorded boot-6 bodies plus synthetic ledger drive real create → request/read → resolveControl → effects → judges. Lane/registry/family focused suites are 63/63 green. The preboot work additionally fixed the production catalogue envelopes at their native row outputs, stale lane expectations, obsolete leader extra spawn, inherited fork transcript attribution and unaccounted refusal asks. These fixes remain C1/offline only after the live drive failed.

No live `ac:refusal-ptc` claim: omitted from selected cases; boots 2/3 are disclosure evidence only. A tool-less child's L4 still requires real child-effect witness; no fabricated ledger upgrade is made. :3080 was only status-probed before launch; the drive exception prevented its normal after probe, so a separate read-only postmortem status check is recorded. Stable instance was not modified.

## AC-1 ruling and ledger consequence (2026-10-27)

The governed production listing now receives the exact `callerAuthority` object used by the executor's spawn-amplification fence. Tier A's default authority has empty `providers` and `models`, so `list_subagent_models` correctly renders the native `(no LLM providers)` string. A positive provider/model listing is valid only with an injected authority snapshot; C1 proves provider/model filtering and typed refusal outside that snapshot. The boot-8 non-empty list therefore exceeded caller authority and is downgraded to **DISCLOSED**; this is an offline judge correction/re-grade disclosure, not a new live run. The judge now asserts every listed provider is a member of caller authority.

## Boot 8 conclusion (2026-10-27)

Boot 7 is **VOID** (runner TDZ before drive effect), and exactly one boot 8 was granted. Boot 8 completed with host/home teardown, baseline `639ed01539` and `:3080` unchanged. **9/10 PASS; 1/10 FAIL**: `ac:fork-positive` failed the judge because the first read-back contained `Error: unknown tool "subagent_fork"`, although the subsequent fork result carried `U7AC1_FORK_SAW_TOKEN` and the child-effect witness was present. This is a harness/judge defect, not a product or Host seam failure. Binding condition applies: stop live boots for this round; no boot 9. Ledger remains DISCLOSED; no live PTC or tool-less-child L4 claim.

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


## Boot-5 conclusion

Boot 5 was the sole authorized retry after the boot-4 driver fix (5/5; Host `639ed01539`, port `3184`; world/home teardown clean). Mounting passed and the C1 family ran, but C2 overall is **FAIL** (`2 PASS / 8 FAIL`). The live native surface had no `run_code`; `ac:mounted` passed. Positive tool cases failed because the host tool result schemas reject the family's returned `{ok,...}` envelope (`missing required property value.text` / undeclared `value.models`, `value.agents`, etc.). Refusal cases showed expected typed refusals, but the fixture counts durable asks from both positive and refusal attempts, so those grades fail; this is fixture/contract grading evidence, not a product or upstream seam change. Boot 6 is explicitly authorized by the main agent, over the original budget of 3 and after the prior boot-5 failure; no boot 7 is permitted. This extension is disclosed in `BOOT-BUDGET.md` and the next `boot-budget.jsonl` record.
