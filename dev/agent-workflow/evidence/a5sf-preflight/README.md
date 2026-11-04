# a5sf-preflight — zero-boot preflight for the P2-01 six-row live acceptance

**Status: PASS (host-free). 0 boots spent. 0 Host starts. 0 ledger rows.**
This directory certifies the *driver* and the *assembly* before the first of the
three newly granted P2-01 boots is spent. It does not claim any row is PASS on
live data — that is what the boot is for.

- base: `origin/master` @ `6fbe33c01` (fetched, verified)
- branch: `task/a5sf-preflight-20261103` (worktree `.worktrees/a5sf-preflight`)
- head: the commit that introduces this directory (`git log -1 --format=%H -- dev/agent-workflow/evidence/a5sf-preflight`).
  `dry-run.json.head` / `.workingTreeClean` record the tree the committed run executed
  on — it is necessarily the parent (or the same) commit, because the run is itself part
  of the evidence. The go/no-go gate re-runs it **at the exact commit to be booted** (§6 #1).
- `packages/runtime/src/plugin/live/agent-bindings.mjs` sha256
  `df9b46af67cd903641285760cd72a78e57986e87959b2fbdbaf3f86dd6c6464b` — **byte-identical
  to `origin/master`** (CORE PATCH BUDGET = 0; asserted by `dry-run.mjs`, check
  `agent-bindings.mjs is untouched vs origin/master`)
- boot pool: `dev/agent-workflow/budgets/a5sf-boot-pool-20261103.json` (P2-01 now
  holds 6; the preflight consumes none)

One command re-verifies everything in this directory:

```bash
node dev/agent-workflow/evidence/a5sf-preflight/dry-run.mjs   # exit 0, 21/21 checks, goNoGo=true
```

---

## 1. What #575 actually produced (the baseline this preflight repairs)

`dev/agent-workflow/evidence/a5sf-acceptance/run-record.json` @ `6d1b7a1fb`:
overall **FAIL**, 1 `NOT_REACHED` (row 5) and **5 FAIL** (precondition, rows
1–4, row 6), **boots: 1**. The five FAILs are all the same absence: the state
query read a Team with **one leader and no worker** while the acceptance Team was
created under a different root, so `surfacePerMemberRequest` was empty
(`memberRequestSeen: false`), no read/write call was ever made, and every
downstream judge was asked about observables that never existed. Row 6 archives
`null` and still printed FAIL.

Three driver defects, all reproduced in the committed #575 driver
(`dev/agent-workflow/evidence/a5sf-acceptance/run-boot.mjs`):

1. **Split root identity.** `ROOT = 'session-a5sf-acceptance-root'` (line 140)
   drives the p6t6 directive, the state query, the discovery prompt and the
   archive `as:`; `CREATE_ROOT = 'session-a5sf-acceptance-team'` (line 141)
   drives `team.create`, the delegate and the archive payload. The p6t6 state
   route answers for the directive's `rootSessionId`, so the run observed the
   **anchor** team forever. The product *refuses* the other obvious repair:
   `team.create` on an already-bound root takes the cold path and refuses a
   different blueprint (`TEAM_CREATE_BLUEPRINT_MISMATCH`, `s6-remote.ts`), so
   the dynamically built acceptance blueprint cannot bind on the boot root.
   The fix is therefore explicit two-root wiring, not "use one constant".
2. **Dispose-fault filter matched the root session NAME.** The #575 filter was
   `/a5sf: realm dispose failed|residency dispose failed|a5sf: native shadow/`
   and the `git show`-quoted evidence proves the failure mode: `teardown.json`
   records `a5sfFaults` = **all 30 observations**, every one of them an
   `a5p1-guard: … agent=session-a5sf-acceptance-team …` line matched by
   `a5sf: native shadow`-adjacent text. A real fault would have been invisible
   inside 30 false positives — and row 6 printed FAIL for that.
3. **Capture clipping.** The #575 transcript clipped tool results at **320
   chars** (`README.md` §5.3: the activation refusal's cause `(deferred …)` was
   lost with the World). The later committed driver fixed the transcript but
   still clipped `evidence.rowValues` at **900** and the teardown observation
   array at `slice(-20)`.

This directory contains the corrected driver, the shared host-free oracle, the
mount measurement, the negative controls and the go/no-go gate.

---

## 2. The corrected driver — `run-boot.mjs`

Same World, same mock model, same six rows; the defects are fixed *structurally*:

| defect | fix in `run-boot.mjs` |
| --- | --- |
| split root | imports `P2_01_ACCEPTANCE_ROOTS` from the tested contract; **no root literal exists in the driver** (dry-run check 1). `BOOT_ROOT` is the anchor (discovery only, and the production row's anchor); `ACCEPTANCE_ROOT` is `team.create` + archive + delegate + p6t6 directive + state query + oracle. `assertAcceptanceRootWiring()` throws `ACCEPTANCE_ROOT_MISMATCH` unless `createRoot === stateQueryRoot === toolRouteRoot === archiveRoot === oracleRoot === directiveRoot`. |
| order | **discovery → surface → `team.create` → wait for `state(rootSessionId === ACCEPTANCE_ROOT, teamSession !== null)` → drive.** The wait is *after* create and asserts the same constant the create used; a false throws before any row is evaluated ("refusing to evaluate any row against a foreign team"). Dry-run check 4 asserts the source order. |
| dispose filter | `classifyDisposeFaults({observations, managed: {sessionId, instanceId}, duringManagedDisposal, managedRealmCount})`. Closed fault grammar (`^a5sf: realm dispose failed:` / `^p6t6: residency dispose failed for '([^']+)':`); a residency fault is `managed` only for the **exact** child-session id, `foreign` otherwise; the identity-less realm fault is attributed **only** inside this Member's disposal window; every non-fault line is counted as ignored, never as a fault. The #575 input (30 guard lines) classifies as `managed: 0, foreign: 0, ignoredNonFault: 30`. |
| clipping | no driver-imposed bound on any row-verdict input: row results, the full request corpus, the entire observation arrays in `teardown.json`, and every `add()` detail are persisted verbatim. The **only** bound is the Host's own tool-result / mock-response size (evidence, not a capture decision). Display-only `console` lines stay bounded and are labelled as such. |
| FAIL vs NOT_REACHED | every row, precondition and teardown calls a judge from `tests/world-factory/lib/a5sf-acceptance-preflight.mjs`. A row whose observable was never produced is `NOT_REACHED`; a row the product answered wrongly is `REFUTED`; `PROVEN → PASS`. `oracle-samples.json` persists the exact sample + judge output per case. |
| silent `read_image` fallback | `a5sfExpectedTools: { <tool-fs>: ['read','write','edit','read_image'] }` is declared on the row. If the World's `attachments` service ever disappears, the attach fails closed with `A5SF_EXPECTED_TOOLS_UNSHADOWED` **before any row**, naming `read_image` — instead of silently keeping the preset `read_image` with zero guard facts. |

The `#575` archive/delegate asymmetry is also gone: `as:` (actor), the payload
`rootSessionId` and the dispatch target are all `ACCEPTANCE_ROOT`.

---

## 3. The six-row oracle, re-derived in the driver

The decision function lives in
`tests/world-factory/lib/a5sf-acceptance-preflight.mjs` and is pinned by
`tests/world-factory/a5sf-acceptance-preflight.test.mjs` (**17/17 pass**, run by
`dry-run.mjs` check 8). Each row has three outcomes; the test file feeds each
judge a NOT_REACHED sample, a REFUTED sample and a PASS base, and asserts the
verdicts differ (`C0`–`C8`), including a negative control that rebuilds the #575
split literals through the root-identity assertion (`A4`).

| row | PASS requires (state assertion) | REFUTED (the product answered wrongly) | NOT_REACHED (never asked) | #575 defect this repair kills |
| --- | --- | --- | --- | --- |
| precondition | a Member turn was captured (`surfacePerMemberRequest` non-empty), exactly **one** `read` schema, no duplicate names, prompt `read` mentions ≤ discovery's, the `tool:read` section count unchanged, ≥3 `read` calls | any of those clauses false (`MEMBER_SURFACE_DRIFT`) | no Member request at all (`NO_MEMBER_REQUEST`) | #575 printed FAIL with `memberRequestSeen:false` — an absence reported as a failure |
| 1 read A | result not error, planted bytes returned, ≥1 **binding-realm** allow fact with `toolBindingIdentity: 'dsh.fs/read'`, ≥1 confined provider row, and **no base-instance row** | bytes missing / no binding allow / served by base (`ROW1_CLAUSE_FAILED`) | no call or no result (`NO_READ_CALL_A` / `NO_READ_RESULT_A`) | #575 FAIL on a read that never happened |
| 2 read B | `isError`, typed lane refusal, no claim/write-content leak, **exactly one** fact for B and **exactly one** binding deny, **no** provider read | any clause false (`ROW2_CLAUSE_FAILED`) | no call/result (`NO_READ_CALL_B` / `NO_READ_RESULT_B`) | same |
| 3 read C | refused + typed, no leak, exactly one binding deny, no provider read, **and** the lane report shows ceiling `deny`, restriction `allow`, effective `deny`, with no widened allow entry | clause or no-widening false (`ROW3_CLAUSE_FAILED`) | no call/result, **or no lane report**, or no probe for C (`NO_LANE_REPORT_C`, `NO_LANE_PROBE_C`) | the no-widening claim had no channel; "pass" could be produced by an empty report |
| 4 write B | not error, disk equals the written content, a write allow fact exists, **every** write fact is on the ceiling realm (`toolBindingIdentity:null`), **zero** read-lane write facts, confined provider served | any clause false (`ROW4_CLAUSE_FAILED`) | no call/result (`NO_WRITE_CALL_B` / `NO_WRITE_RESULT_B`) | same |
| 5 post-invalidation | Member child session present, late tool registered, invalidation line observed, post-read refused with `A5SF_NATIVE_SHADOW_INVALIDATED` **and** the typed name, no forbidden bytes, sink delta 0, counter delta 0, in-lane read also refused with the typed code | the question was put and the product served bytes / answered without the typed refusal (`ROW5_CLAUSE_FAILED`) | no Member session, no invalidation event, no invalidation line, no post-read (`NO_MEMBER_CHILD_SESSION_IN_STATE`, `INVALIDATION_EVENT_NOT_PRODUCED`, `INVALIDATION_LINE_NOT_OBSERVED`, `NO_POST_INVALIDATION_READ`) | #575's only NOT_REACHED — correct there; now it cannot be mistaken for a pass, and its PASS cannot be produced by the absence of an event |
| 6 teardown | archived lifecycle `ARCHIVED`, every post-stop dispatch explained (422 `NO_LIVE_AGENT` or a 200 refusal), **no** success after stop, **no** forbidden bytes, `classifyDisposeFaults` reports no managed/unattributed fault, sink delta 0, health 200, host alive | any clause false (`ROW6_CLAUSE_FAILED`) | no member, no archive dispatch, archive not ok, no post-stop dispatch (`NO_MEMBER_TO_STOP`, `NO_ARCHIVE_DISPATCH`, `MEMBER_NOT_STOPPED`, `NO_POST_STOP_DISPATCH`) | #575 printed FAIL with `archiveOk:false` and 30 false "faults"; a missing scenario is now NOT_REACHED, and a fault must be identity-attributable |

Every judge returns `{verdict, reason, detail}` with `reason` a **closed code**
(`ACCEPTANCE_VERDICTS` + `C*` reason set); `toRunVerdict` maps `PROVEN→PASS`,
`REFUTED→FAIL`, `NOT_REACHED→NOT_REACHED`. The driver's case list is asserted
equal to `ACCEPTANCE_CASES` before a grant is taken and before boot.

Files: `oracle-samples.json` (written by a live run) persists the sample and the
judge output per case, so the decision can be re-derived without the World.

---

## 4. #576 mount compatibility — MEASURED, host-free

`probe-mount-compat.mjs` (output `mount-compat.json` / `mount-compat.log`) mounts
the **real pinned** `tests/deepseek-harness-test-use/packages/fs/tool-fs/lib/index.js`
through the product entry points (`mountMemberA5sfRealm` +
`attachA5sfNativeToolModules`) on a real Cordis root with real
`@deepseek-ai/dsh-tools` / `dsh-system-prompt` / `dsh-scope`, and declares
`a5sfExpectedTools = ['read','write','edit','read_image']`.

| arm | `attachments` provider | mounted | forwarded by the routed fibers | model-visible surface |
| --- | --- | --- | --- | --- |
| A | **real** `@deepseek-ai/dsh-attachment-local` (`LocalAttachmentStore`, `dshHome` = OS temp dir, deleted) | **yes** | `edit, read, read_image, write` (**4/4**) | `edit, read, read_image, write` |
| B | stub `attachments` service | yes | 4/4 | 4/4 |
| C | **none**, declaration present | **no** — `A5SF_EXPECTED_TOOLS_UNSHADOWED` | attach forwarded `write, edit, read`; message names `read_image` | — |
| D | **none**, undeclared | yes | `edit, read, write` (`read_image` absent) | `edit, read, write` |

The routed-mount metadata (product `NATIVE_REGISTRATION_ROUTING`) for arm A:

```
ceiling realm: toolBindingIdentity=null        forwarded=[write, edit, read_image]  observed=[read, write, edit, read_image]  dropped=[section:tool:read, read]
binding realm: toolBindingIdentity=dsh.fs/read forwarded=[read]                       observed=[read, write, edit, read_image]  dropped=[section:tool:write, write, section:tool:edit, edit, read_image]
```

So: **#576's outcome rule + the router-services merge reach a mounted,
identity-verified native surface with the real pinned module and a real
attachment store** — `mounted=true`, every declared name forwarded, and each name
served by exactly one lane with the other lane dropping both its definition and
its system-prompt section. Arm C proves the declaration is not vacuous; arm D is
the "what the World would look like with no attachments" premise.

Composition fact (also measured, `plan.json.attachmentsProvider`): the pinned
World profile composes `@deepseek-ai/dsh-attachment-local` from
`tests/deepseek-harness-test-use/packages/bundle/base/cordis.patch.yml` lines
138–139 (`- id: attachment-local`). #575 additionally observed the durable store
on the live Host. `dry-run.mjs` fails if that composition disappears — **an
absent provider is a preflight blocker, not something to work around.**

---

## 5. Dry-run output (what was actually executed)

`dry-run.log` (committed) — **21/21 checks PASS, `goNoGo=true`**, ~1 s, no Host:

1. static: no root literal / imports the contract / all seven judges used /
   `team.create` precedes the same-root state assertion / no clipped result /
   full observation arrays / `expectedTools` declared;
2. `agent-bindings.mjs` byte-identical to `origin/master` (sha256 above);
3. `node --test tests/world-factory/a5sf-acceptance-preflight.test.mjs` →
   **17 pass, 0 fail** (three-way oracle + #575 split-root control);
4. `run-boot.mjs --plan` → factory `createWorld` + patch layer emission
   (6085 bytes, sha256 in `plan.json`) + **both blueprints parsed by the host's
   own dist facade** + row-identity preflight (3 rows) + product lane algebra
   (A `allow` / B `deny` / C `deny`) + world **teardown** (`homeDeleted`,
   `releasedPorts: []`, no port ever bound) → `plan.log` / `plan.json`;
5. `probe-mount-compat.mjs` → §4 table → `mount-compat.json`;
6. head/base/pinned-host recorded in `dry-run.json`.

**Negative controls** (`negative-controls.log`, kept as evidence): re-introducing
the two #575 defects into the driver — the `CREATE_ROOT` literal and
`.slice(0, 320)` on `rowValues.a` — makes `dry-run.mjs` exit **1** with exactly
those two checks FAIL (`checks=21 failed=2 goNoGo=false`); restoring the driver
returns it to 21/21. The oracle's own negative controls are `A4` (the #575 split
literals must throw `ACCEPTANCE_ROOT_MISMATCH`) and the `C*` families (a row
whose observable is absent must not be PROVEN).

### Structurally unverifiable without a boot (and why)

1. a live `team.create` of the acceptance blueprint — it is an RPC against a
   running Host; there is no host-free entry point (the plan mode validates the
   blueprint with the host's own parser and pre-checks the row composition
   instead);
2. that the p6t6 directive the driver writes is the one the row reads — the
   directive path is World-internal and materialises only during boot (the
   host-free side proves the *identity* of `createRoot`/`directiveRoot`, not the
   file handoff);
3. that any row is PASS on live data — the dry run proves the decision function
   and the assembly, not the data;
4. that the Host's own teardown disposes the a5sf realm without a fault — the
   dispose-observation channel is a live-State route.

---

## 6. Go / no-go checklist — before spending the first of the three boots

Every line is a **precondition**, not a recommendation. `RE-VERIFY` is the
single command that re-checks all of them (run in the worktree; exit 0 required).

| # | precondition | confirming command / measurement | expected |
| --- | --- | --- | --- |
| 1 | worktree is clean and on the certified commit | `git status --porcelain` ; `git rev-parse HEAD` ; `dry-run.json.head` | empty; the dry run you are about to trust was run at this HEAD (`workingTreeClean:true`) |
| 2 | base still contains nothing newer that touches this lane | `git fetch origin && git log --oneline HEAD..origin/master -- tests/world-factory packages/runtime/src/plugin/live` | empty, or merge forward and re-run `RE-VERIFY` |
| 3 | `agent-bindings.mjs` untouched | `sha256sum packages/runtime/src/plugin/live/agent-bindings.mjs` | `df9b46af…6464b` |
| 4 | shared oracle + all static checks + mount compatibility | `node dev/agent-workflow/evidence/a5sf-preflight/dry-run.mjs` | exit **0**, `goNoGo=true`, 21/21 |
| 5 | World composition still mounts `attachments` | `plan.json` → `attachmentsProvider.mounted` (inside the dry run) | `true`; `false` = **NO-GO** (blocker, not workaround) |
| 6 | the six-row assembly mounts against the real pinned tool-fs | `mount-compat.json` arm A | `mounted=true`, 4/4 forwarded **and** visible; arm C typed refusal |
| 7 | boot budget ledger is clean (no unconsumed/orphan row) | `cat dev/agent-workflow/evidence/a5sf-preflight/ledger.jsonl` (absent = clean) ; `python3 -c "import json;d=json.load(open('dev/agent-workflow/budgets/a5sf-boot-pool-20261103.json'));print(d)"` | no row for this preflight; P2-01 allocation shows the 3 dedicated boots |
| 8 | the mock model fixture and the World factory are the pinned ones | `git rev-parse --verify 639ed015397290b3745d163aafe02ffee4aa3f84` in `tests/deepseek-harness-test-use` | prints the pin (detached tree, unmodified) |
| 9 | port policy: the boot will use the 3180 family, never 3080 | driver `line = 'a5sfacc'` → World factory allocates `3180+` from `tests/homes/` | no `:3080` in `plan.json` / `mount-compat.json` |
| 10 | the run this gate certifies is the run that will execute | compare `dry-run.json.head` to `git rev-parse HEAD` | equal; **re-run the dry run after any forward merge** |

**RE-VERIFY (one command):**

```bash
node dev/agent-workflow/evidence/a5sf-preflight/dry-run.mjs && echo GO
```

Then, and only then: `node dev/agent-workflow/evidence/a5sf-preflight/run-boot.mjs`
(one Host, one ledger row, `maxStarts: 2` intent+start, `:3180` family).

**Least-sure precondition: #5 / #6 (`attachments`).** The provider is proven to
exist in the pinned *composition* and a real store mounts host-free, but the last
mile — the World's profile actually instantiating `attachment-local` for the
acceptance Member and the deferred `read_image` registration settling inside the
routed mount on a live Host — is exactly the intersection #576 changed and
cannot be observed without a boot. The `a5sfExpectedTools` declaration makes that
failure **loud and cheap** (one typed activation refusal, zero rows, and the row
config is the only thing to check), which is why the declaration is part of this
preflight rather than an optional nicety.

---

## 7. Disclosures / residual risk

1. **The realm-dispose observation carries no session identity.** The product
   text `a5sf: realm dispose failed: …` (in `agent-bindings.mjs`) has no
   `sessionId`. The preflight attributes it by (a) the disposal window
   (`duringManagedDisposal`) and (b) exactly one managed realm
   (`managedRealmCount`), and classifies any other occurrence as `unattributed`
   → row 6 REFUTED. A second concurrently-disposed realm with a real fault in the
   same window would be misattributed to this Member; the six-row World has
   exactly one managed realm, and the residency fault (`p6t6: residency dispose
   failed for '<sid>': …`) **is** exact-session. This is the same residual gap
   the #575 README disclosed, now bounded and machine-checked; removing it needs
   a product-side identity in that line, i.e. a core change this lane must not
   make.
2. **`attachments` presence is a composition fact plus a host-free mount
   measurement**, not a live observation of the acceptance World (§6 #5).
3. **`read_image`'s deferred registration is the mount's one async child.** The
   probe measures the current HEAD's settle behaviour with the real module; a
   future change to `dsh-tool-fs`'s inject list or to `DEFERRED_SETTLE_ROUNDS`
   would invalidate arm A without changing this directory. That is why the
   dry-run pins the tool-fs path and the pinned host SHA.
4. **Row 5's preset-definition identity is not HTTP-observable.** The row's PASS
   is the product's own invalidation line + the typed admission refusal (both
   inside the product), not a printed definition object; the host-free P0 arm
   asserts the definition identity directly. Stated in the driver's
   `presetDefinitionVisible` note.
5. **No live result is claimed here.** This preflight's own `run-record.json` is
   absent by design; the live run writes it.

---

## 8. Files

| file | role |
| --- | --- |
| `run-boot.mjs` | the corrected ONE-boot driver (§2) |
| `a5sf-realm-provider-row.mjs` | the six-row `teamA5sfRealm` provider + late-tool route (copied from the #575 composition, unchanged) |
| `probe-mount-compat.mjs` / `mount-compat.json` / `mount-compat.log` | §4, 4-arm move measurement |
| `dry-run.mjs` / `dry-run.log` / `dry-run.json` | §5, the one-command preflight (20 checks) |
| `plan.log` / `plan.json` | World plan: composition, patch layer, blueprints, lane algebra, teardown |
| `negative-controls.log` | the two #575 defects re-introduced → 2 FAILs, restored → 21/21 |
| `README.md` | this gate |

Shared contract (tracked, not in this directory):

- `tests/world-factory/lib/a5sf-acceptance-preflight.mjs` — verdicts, root
  identity, dispose classifier, seven judges, `ACCEPTANCE_CASES`
- `tests/world-factory/a5sf-acceptance-preflight.test.mjs` — 17 tests, 3-way
  oracle per row + #575 split-root control

## 9. Boot-budget accounting

| item | delta |
| --- | --- |
| Host starts in this preflight | **0** |
| ledger rows written by this preflight | **0** (`ledger.jsonl` absent) |
| ports bound | **0** (`plan.json.world.teardown.releasedPorts = []`) |
| DSH_HOME created | 0 (plan worlds live under `tests/homes/` and are deleted; `dshHome` for the attachment store is an OS temp dir, deleted) |
| P2-01 allocation after preflight | unchanged: 6 boots, 3 newly granted dedicated to the six-row acceptance |
