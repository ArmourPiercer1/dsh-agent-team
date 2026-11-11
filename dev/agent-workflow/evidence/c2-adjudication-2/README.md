CANDIDATE-C2

# C2 adjudication — `cand-v0.1.6-2`

Independent C2 adjudication of the frozen candidate `cand-v0.1.6-2`, written by an adjudicator who
authored no product code. This is a **new tree**; the cand-1 adjudication
(`dev/agent-workflow/evidence/c2-adjudication/`) is history and is not edited.

## 0. Frozen identity and what was measured

| field | value |
| --- | --- |
| candidate | `cand-v0.1.6-2` |
| ref | `refs/heads/candidate/v0.1.6-2` |
| commit / product tree | `bb3c158eb1f76f8db429da01e9a4c5a0e118ca90` (candidate ref == product tree) |
| manifest | `dev/engineering/candidates/cand-v0.1.6-2.json` (`96131fa9c`) |
| delta vs cand-1 | exactly PR #710 (A6-STOP-FENCE) + its evidence + kit manifest fixes |
| host pin | `tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84` (DSH 0.2.0-rc.2) |
| Authority | `as20261109r1` / `sha256:d85fdc1a…` / baseline `cb2e41483af8447700fb3c2a25c2686705320692` (unchanged) |
| measurement worktree | `.worktrees/c2-2` at `bb3c158eb`, branch `task/c2-adjudication-2-20261111` |
| host artifacts | tracked `packages/runtime/dist` at the candidate; no rebuild; no product file edited |

Verifier (`scripts/verify-candidate.mjs --check` equivalent, no `--record`):

```
VERIFIED cand-v0.1.6-2 @ bb3c158eb1f76f8db429da01e9a4c5a0e118ca90 — PASS=145
```

With both C2 records attached (verbatim output in `verifier-output.txt`):

```
PASS  evidence.dev/agent-workflow/evidence/c2-adjudication-2/records/C2-A.json: recordClass=CANDIDATE-C2 eligible=false candidateCommit=bb3c158eb…
PASS  evidence.dev/agent-workflow/evidence/c2-adjudication-2/records/C2-B.json: recordClass=CANDIDATE-C2 eligible=false candidateCommit=bb3c158eb…
VERIFIED cand-v0.1.6-2 @ bb3c158eb1f76f8db429da01e9a4c5a0e118ca90 — PASS=146
```

Both records are `recordClass: CANDIDATE-C2` and deliberately do **not** assert
`candidateClaimEligibility`; C2-B is not a pass (see §5/§7/§8).

## 1. Instruments and oracle policy

- **C2-A governed E2E**: `tests/world-factory/drivers/a5sf-pd33-preview-e2e/run-boot.mjs --arms e2e
  --boots 2` (one invocation, two boots, agreeing pair), plus **FS/Search** `c2a-fs-boot1/2`
  (`fs/run-boot.mjs`, 14 rows) — the same instruments as cand-1.
- **C2-B A6 kit**: `tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs` at the
  candidate, always `C1_ALPHA6_OFFICER=1 C1_PLANE_TAKEOVER=1` (the flag is required: without it the
  kit's saved YAML is invalid and `team.create` reports `blueprint not found in catalog`). Arms:
  allow, deny (`C1_A6_EXEC_NEG=1 C1_A6_RECIPIENTS=1`), stop (`C1_A6_STOP=1`), A6-26
  (`C1_A6_INBOX_UNCLAIMED=1`), sticky (`C1_A6_STICKY_STOP=1`), crash (`C1_A6_CRASH=1`).
- **Oracle policy**: the tool return value is never its own correctness evidence. Cases read durable
  control-ledger rows (decision / consumption / abandonment sequences), guard facts, confined-spawn
  counters, on-disk markers, mock connection counters, host liveness and `/proc`. For A6-12 the
  ledger row set is the oracle; the kit's check label is not.
- Every instrument manifest records `productSha=bb3c158eb…` and `productTree=.worktrees/c2-2`
  (new kit field). The raw driver/kits declare `recordClass: DEV-LIVE`; this record is the
  **CANDIDATE-C2 re-adjudication** of those runs, not a relabelling of their manifests.
- Ports: kit `1300x/1305x–1308x` pairs; the pd33 WorldFactory leases. `:3080` read-only pre-probe.
  Every World torn down; `tests/homes/` ended empty.

## 2. C2-A — governed preset, Alpha.6 OFF: **PASS**

Two pd33 boots (`RESULT PASS (2/2 boots; agreeing pair=true)`, each `overall=PASS selected=10/19`)
and two FS boots (14/14 identical row verdicts: 13 PASS + 1 `NOT_REACHED` `read_image` — the model
declares no image input, outside C2-A scope).

| # | case | pd33 | FS | verdict | decisive line | falsifier |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | read positive | PROVEN | PROVEN | **PASS** | `live:row1… PASS` `bindingAllowFact=true providerServed=true providerConfined=true`; `counts.read=3` | allow without spawn, or bytes without fact |
| A2 | read out-of-lane | PROVEN | PROVEN | **PASS** | `live:row2… readPathDecisions=["deny"] counterRows=0`; `live:row3 exactlyOneBindingDeny=true noProviderRead=true`; `out-of-lane-read-typed codes=["IO_READ_DENIED"] facts=1` | any allow/provider read/leaked byte |
| A3 | write positive | PROVEN | PROVEN | **PASS** | `live:row4a diskMatches=true everyWriteFactOnCeiling=true`; artefact `probe line\nA5SF_PD33_A_EDIT_AFTER` | disk mismatch / no write fact |
| A4 | write negative | PASS | PASS | **PARTIAL** | `live:row4b` PASS at guard (`ceilingWriteAllowed=true noReadLaneWriteAllow=true`) but refusal text "file has not been read" — host policy, not lane algebra | a lane deny fact would be needed |
| A5 | edit positive | PROVEN | PROVEN | **PASS** | `fs:edit-in-lane isError=false writeCalls=1 facts=3` | no write fact |
| A6 | edit negative | PASS | PASS | **PARTIAL** | `fs:edit-outside-ceiling isError=true locus="host-read-before-write-observation-policy" guardFacts=0` | lane deny fact |
| A7 | grep positive | PROVEN | PROVEN | **PASS** | `live:search-row1… IN_LANE_GREP_ALLOWED_AND_CONFINED`; `counts.grep=1` | base-spawn |
| A8 | grep negative | PROVEN | PROVEN | **PASS** | `search-row2 OUT_OF_LANE_REFUSED_BEFORE_ANY_PROCESS`; `search-row3 RESTRICTION_NARROWER_THAN_CEILING_REFUSED_AT_ADMISSION` | any spawn |
| A9 | glob positive | PROVEN | PROVEN | **PASS** | `glob-face inLane PROVEN exactlyOneAllowFact=true`; `counts.glob=1` | match without allow fact |
| A10 | glob negative | PROVEN | PROVEN | **PASS** | `glob-face outside PROVEN exactlyOneDenyFact=true noConfinedProcess=true` | any path/spawn |
| A11 | web positive | PROVEN | PROVEN | **PASS** | `fetch-body-verbatim true`, `fetch-one-connection connections=1`, `fetch-allow-fact facts=1`, search typed-unavailable `POST /search=0` | second connection |
| A12 | web negative | PROVEN | PROVEN | **PASS** | `out-of-lane-host-refused codes=["WEB_DESTINATION_FORBIDDEN"]`, `zero-connections hits=0` | any connection |
| A13 | full E2E ledger flow | PROVEN | PROVEN | **PASS** | `facts-per-tool factless=[] counts={"read":3,"grep":1,"glob":1,"web_fetch":2,"write":1,"web_search":1,"skill":2,"edit":1,"bash":64,"present":2}`; `no-base-web hostWebCalls=0`; goal `rounds=3 finalPhase=complete` | a dispatch with no fact |

C2-A verdict: **PASS**, with A4/A6 **partial** exactly as on cand-1 (the refusal is the host
read-before-write policy; the lane guard itself makes no deny fact).

## 3. C2-B — A6 ON

| arm | verdict | decisive line | boots |
| --- | --- | --- | --- |
| Officer allow | **PASS** | `A6-2 wakes=3 requests=16`, `A6-4` effect file, `A6-5 leaderWakes=0`, `A6-3 resolveCalls=1` | 2/2 |
| single consumption + execution | **PASS** | `A6-6 requests=2 decisions=2 consumptions=2 pending=`; `A6-27 outcome=succeeded facts=1` (`ctrl-0o1nel31wjaa940hzguxl0tz` / `ctrl-0kfb2tc1fpqm5n0drih1y189`) | 2/2 |
| Officer deny (correct invocation) | **PASS** | `A6-28 request=ctrl-1upulzo196o7pv1hx8k0y03b decision=deny consumed=false execFacts=0 file=false`; r2 `ctrl-0p0hr2508cycyu0rxxz2z17t` same shape | 2/2 (10/10 checks) |
| post-consumption throw | **PASS** | `A6-29 request=ctrl-1fy65w01lldcy70wi3lby1sy consumed=true execFacts=failed`; r2 `ctrl-1ymzjmc1vo2xzb1ri4f4u0dw` | 2/2 |
| **Stop (A6-12)** | **PASS — 0/11 consumed** | see §4 | **11** |
| A6-26 accepted-not-claimed | **REPRODUCED-AS-DOCUMENTED** | `verdict=abandoned-terminal recoveryCode=CONTROL_REQUEST_ABANDONED discoverable=true abandoned=1 restart=ok` | 2/2 |
| Sticky Stop | **NOT PASS — latch-scoped as documented** | `markers=` (empty), `wakes=1->1`, `A6-22/23/24/26/27 FAIL` | 2/2 |
| cold recovery after SIGKILL | **PASS** | `A6-13 restart=ok decision=null consumed=false file=false`; `A6-14 abandon=invocation-abandoned` | 2/2 |
| Goal authorisation (A6-on ∧ governed) | **NOT ESTABLISHED** | no instrument boots the conjunction; halves only (§8) | — |

## 4. A6-12 — the decisive arm, measured

**Result: 0 consumed in 11 boots, `file=""` in 11/11, and every late allow refused.** On cand-1 the
same arm consumed in 4 of 6. The rate is not a pass claim by itself; here is the distribution and
the mechanism split.

| run | request | consumed | file | abandonment row | late allow | decision (seq/at) |
| --- | --- | --- | --- | --- | --- | --- |
| r1 | `ctrl-0q3kug015mcyer17n47om0ul` | false | `""` | none | `DECIDED` | 14 / 11:09:43.209 |
| r2 | `ctrl-11xtkvp1ak3cam0uzp6ob1ic` | false | `""` | none | `DECIDED` | 14 / 11:09:45.002 |
| r3 | `ctrl-0077hyd1rt6bdu1d3cqoj0xy` | false | `""` | none | `DECIDED` | 14 / 11:10:05.024 |
| r4 | `ctrl-1jochlb0857t581y2o6zx0l5` | false | `""` | none | `DECIDED` | 14 / 11:10:08.066 |
| r5 | `ctrl-0ogw6ew10lfxjr07mtu8e1vs` | false | `""` | none | `DECIDED` | 14 / 11:10:27.985 |
| r6 | `ctrl-1h7pcwa1un2mu50hlebpo1gj` | false | `""` | none | `DECIDED` | 14 / 11:10:31.040 |
| r7 | `ctrl-0jce02c0fe1dh71o5yygy1us` | false | `""` | none | `DECIDED` | 14 / 11:15:41.834 |
| r8 | `ctrl-1vk8psd1weq53m0xfkdoz0ed` | false | `""` | none | `DECIDED` | 14 / 11:15:44.825 |
| **r9** | `ctrl-0pem4mj02gcppw1gftqrt00u` | false | `""` | **seq 16, `invocation-cancelled-before-consumption`, 11:16:14.738** | **`ABANDONED`** | 14 / 11:16:14.664 |
| r10 | `ctrl-0cw4jm10b6vd9m1sx45wz0b5` | false | `""` | none | `DECIDED` | 14 / 11:16:38.607 |
| r11 | `ctrl-1n9mtsa1f6h3ql0j239m01gw` | false | `""` | none | `DECIDED` | 14 / 11:17:15.145 |

**Mechanism split:** 1 of 11 boots exercised the fence (r9). There, the order is: `allow` decision
seq 14 → **no consumption row** → terminal `control-request-abandoned` seq 16 (+74 ms; seq 15 left
unused by design) → late allow `CONTROL_REQUEST_ABANDONED` → no effect file. In the other 10 boots
the Stop landed **before the guard reached the consumption boundary**: no consumption, no
abandonment row, late allow `CONTROL_REQUEST_DECIDED`. That is the same pre-fence arm that produced
2/6 passes on cand-1.

**What that means, stated carefully.** The arm is clean on this candidate (0/11 consumed, no side
effect), but 10/11 of the passes are the pre-fence Stop, not the new fence; the fence trip itself is
observed once and behaves exactly as documented. Because the pre-fence arm also existed on cand-1,
I do **not** attribute the whole 4/6 → 0/11 shift to the fence; the dominant observed mechanism is
"the Stop wins the dispatch race". The fence's disclosed residual window (a cancellation between the
probe and the consumption write) was not landed in by any of the 11 boots, so its size is not
measured here.

Runs r1–r8 were issued as 2-concurrent pairs; r9/r10/r11 ran solo. The trip occurred solo (r9), so
concurrency is a confounder for the mechanism split (not for the consumption result, which is 0 in
both conditions).

## 5. A6-26 — unchanged, reproducible, never PASS

Both boots: `verdict=abandoned-terminal`, `recoveryCode=CONTROL_REQUEST_ABANDONED`, `restart=ok`,
`abandoned=1`, `pendingBefore=1`, `pendingAfter=0`, `discoverable=true`, `pendingCount=0`
(`ctrl-06ku55n1lwue1c0jnqi7d1s3`, `ctrl-08vmd3z0j6wix00uvdh4d0vx`). The kit prints `FAIL` because
its `ok` predicate excludes the documented abandonment; the verdict is
**REPRODUCED-AS-DOCUMENTED**, not PASS, exactly as in cand-1.

## 6. Sticky Stop — unchanged

Both boots: `markers=` empty, `wakes=1->1`, `A6-22` `cancel=true markers=`, `A6-23` `restart=ok
markers=`, `A6-24` `markers=`, `A6-26/27` in this arm `markers=`. This is the documented §4.7
latch-scoped limit (no coordinator ⇒ no durable marker); nothing about the fence changes it. It
remains a non-pass for the arm as specified.

## 7. What the fence could have regressed

The default allow path still records exactly one consumption and one execution-result:
`A6-6 requests=2 decisions=2 consumptions=2 pending=` and `A6-27 outcome=succeeded facts=1` in both
allow boots, with the deny/throw arms also clean. No regression observed on the approval
consumption path.

## 8. Goal authorisation — still not established

The two halves exist and are measured: A6-off governed `create_goal` runs 3 automatic rounds and
converges through `complete` (pd33 both boots), and the A6-on plane executes an approved call once
(`A6-27`). No shipped driver enables `alpha6ReviewRouting` on the governed preset, so **no single
boot measures the exact A6-on ∧ governed `create_goal` conjunction**. It remains NOT ESTABLISHED;
this candidate did not close it.

## 9. What I could not establish

1. The Goal-authorisation conjunction above (no instrument).
2. The size of the fence's residual window (no boot landed between the probe and the write).
3. Whether the 4/6 → 0/11 Stop improvement is caused by the fence or by timing: 10/11 passes are
   the pre-fence arm, and I have no A/B on the same machine/condition.
4. Any claim about Sticky Stop for a composition that has a coordinator — the kit's composition
   does not provide one.

## 10. What a reader should not conclude

- C2-A PASS does not make the candidate releasable; it is the A6-off governed plane, with A4/A6
  partial negatives.
- C2-B NOT PASS does not mean the Stop arm failed — it is clean here (0/11). It rests on the
  documented Sticky Stop limit and the unmeasured Goal conjunction.
- The A6-26 `FAIL` line is the documented abandonment, not a defect, and it is never rewritten PASS.
- 0/11 consumed does not prove the fence closed the window: the fence tripped once; the rest are the
  Stop winning before the guard.
- Raw driver evidence is `DEV-LIVE`; this report is the CANDIDATE-C2 adjudication of those runs.

## 11. Signature

Adjudicated by the independent C2 adjudicator (session `c2-adjudication-2-20261111`). I authored no
product code, moved no Authority pointer, moved no candidate ref, merged nothing, and did not touch
`.github/workflows/`. The candidate tree was measured read-only; the only writes are this evidence
tree and the throwaway `DSH_HOME`s, all torn down.
